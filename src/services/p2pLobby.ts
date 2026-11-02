import { Peer, type DataConnection } from "peerjs";
import { tauriClient } from "./tauriClient";
import type { ActiveSkinProfile, SummonerProfile, ChampionItem } from "../types/skin";

export const LOBBY_SLOTS = Array.from(
  { length: 12 },
  (_, i) => `hextech-bloodmoon-global-v1-slot-${i + 1}`
);

export interface ActiveModInfo {
  championId: number;
  championName: string;
  skinId: number;
  skinName: string;
  chromaId?: number;
  loadScreenUrl: string;
  championIconUrl: string;
}

export interface PeerMember {
  peerId: string;
  slotNumber: number;
  summonerName: string;
  tagLine: string;
  profileIconUrl: string;
  activeMods: ActiveModInfo[];
  pingMs: number | null;
  lastSeen: number;
  isSyncEnabled: boolean;
}

export type P2PLobbyStatus = "disconnected" | "connecting" | "connected" | "error";

export interface P2PLobbyState {
  status: P2PLobbyStatus;
  myPeerId: string | null;
  mySlotNumber: number | null;
  errorMessage: string | null;
  peers: PeerMember[];
  totalRoomSkins: number;
  syncedSkinsCount: number;
}

export type P2PPacket =
  | {
      type: "STATE_UPDATE";
      peerId: string;
      summonerName: string;
      tagLine: string;
      profileIconUrl: string;
      activeMods: ActiveModInfo[];
    }
  | {
      type: "PING";
      senderId: string;
      timestamp: number;
    }
  | {
      type: "PONG";
      senderId: string;
      originalTimestamp: number;
    }
  | {
      type: "CONFLICT_ACTION";
      championId: number;
      fromSummoner: string;
      targetSummoner: string;
      action: "yield" | "keep";
    }
  | {
      type: "LEAVE";
      peerId: string;
    };

type P2PListener = (state: P2PLobbyState) => void;

class P2PLobbyManager {
  private peer: Peer | null = null;
  private mySlotId: string | null = null;
  private mySlotNumber: number | null = null;
  private status: P2PLobbyStatus = "disconnected";
  private errorMessage: string | null = null;

  private connections: Map<string, DataConnection> = new Map();
  private peers: Map<string, PeerMember> = new Map();
  private peerSyncOverrides: Map<string, boolean> = new Map(); // peerId -> boolean

  // Local state cache
  private summoner: SummonerProfile | null = null;
  private activeSkins: Record<number, ActiveSkinProfile> = {};
  private champions: ChampionItem[] = [];

  // Background sweep intervals
  private discoveryInterval: number | null = null;
  private pingInterval: number | null = null;
  private activeDownloads: Set<number> = new Set();
  private listeners: Set<P2PListener> = new Set();

  constructor() {
    // Empty constructor
  }

  public getState(): P2PLobbyState {
    const peerList = Array.from(this.peers.values()).sort(
      (a, b) => a.slotNumber - b.slotNumber
    );

    let totalRoomSkins = Object.keys(this.activeSkins).length;
    let syncedSkinsCount = Object.keys(this.activeSkins).length;

    for (const p of peerList) {
      totalRoomSkins += p.activeMods.length;
      if (p.isSyncEnabled) {
        syncedSkinsCount += p.activeMods.length;
      }
    }

    return {
      status: this.status,
      myPeerId: this.mySlotId,
      mySlotNumber: this.mySlotNumber,
      errorMessage: this.errorMessage,
      peers: peerList,
      totalRoomSkins,
      syncedSkinsCount,
    };
  }

  public subscribe(listener: P2PListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const st = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(st);
      } catch (err) {
        console.error("P2P listener error:", err);
      }
    });
  }

  /**
   * Updates local summoner, active skins and champion catalog,
   * then broadcasts the updated STATE_UPDATE packet to the entire mesh.
   */
  public updateLocalMods(
    summoner: SummonerProfile | null,
    activeSkins: Record<number, ActiveSkinProfile>,
    champions: ChampionItem[]
  ) {
    this.summoner = summoner;
    this.activeSkins = activeSkins;
    this.champions = champions;

    if (this.status === "connected" && this.mySlotId) {
      this.broadcastStateUpdate();
      this.notify();
    }
  }

  /**
   * 1-Click Join Global P2P Mesh Lobby.
   * Deterministically finds and claims the first free slot (1..12),
   * then connects to all other slots in parallel.
   */
  public async joinLobby(): Promise<boolean> {
    if (this.status === "connected" || this.status === "connecting") {
      return true;
    }

    this.status = "connecting";
    this.errorMessage = null;
    this.notify();

    try {
      // Step 1: Claim first available slot sequentially
      const { peer, slotId, slotNumber } = await this.claimFirstAvailableSlot();
      this.peer = peer;
      this.mySlotId = slotId;
      this.mySlotNumber = slotNumber;
      this.status = "connected";
      this.notify();

      // Step 2: Handle incoming connections from other peers
      peer.on("connection", (conn) => {
        this.setupConnection(conn, false);
      });

      peer.on("error", (err: any) => {
        if (err?.type === "peer-unavailable") {
          // Normal when a targeted slot is unoccupied
          return;
        }
        console.warn("PeerJS mesh warning:", err);
      });

      peer.on("disconnected", () => {
        // Attempt immediate reconnect to signaling server to keep slot claimed
        if (this.peer && !this.peer.destroyed) {
          try {
            this.peer.reconnect();
          } catch {}
        }
      });

      // Step 3: Connect in parallel to all other 11 slots
      this.connectToOtherSlots();

      // Step 4: Start background discovery sweep (every 8s) & ping sweep (every 3.5s)
      this.startTimers();

      // Persist enabled state to config
      tauriClient.setSyncConfig({ is_sync_enabled: true }).catch(() => {});

      return true;
    } catch (err: any) {
      this.status = "error";
      this.errorMessage = err?.message || "Không thể tham gia phòng P2P toàn cầu.";
      this.leaveLobby();
      this.notify();
      return false;
    }
  }

  /**
   * Leaves the global P2P lobby, notifies peers, and cleans up connections.
   */
  public leaveLobby() {
    if (this.mySlotId) {
      this.broadcastPacket({
        type: "LEAVE",
        peerId: this.mySlotId,
      });
    }

    this.stopTimers();

    // Close connections
    this.connections.forEach((conn) => {
      try {
        conn.close();
      } catch {}
    });
    this.connections.clear();
    this.peers.clear();

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {}
      this.peer = null;
    }

    this.mySlotId = null;
    this.mySlotNumber = null;
    this.status = "disconnected";
    this.notify();

    // Persist disabled state to config
    tauriClient.setSyncConfig({ is_sync_enabled: false }).catch(() => {});
  }

  /**
   * Toggles whether to sync skins from a specific peer.
   */
  public togglePeerSync(peerId: string) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    const current = peer.isSyncEnabled;
    const next = !current;
    peer.isSyncEnabled = next;
    this.peerSyncOverrides.set(peerId, next);
    this.notify();
  }

  /**
   * Sends a conflict decision (yield/keep) over WebRTC mesh.
   */
  public sendConflictAction(
    championId: number,
    targetSummoner: string,
    action: "yield" | "keep"
  ) {
    const fromSummoner = this.getEffectiveSummonerName();
    this.broadcastPacket({
      type: "CONFLICT_ACTION",
      championId,
      fromSummoner,
      targetSummoner,
      action,
    });
  }

  /**
   * Returns list of friend skins that are currently active, enabled for sync,
   * and do not conflict with local player's selection.
   */
  public getSyncableFriendSkins(): ActiveSkinProfile[] {
    const result: ActiveSkinProfile[] = [];

    for (const peer of this.peers.values()) {
      if (!peer.isSyncEnabled) continue;

      for (const mod of peer.activeMods) {
        // Exclude if local player already picked a skin for this champion
        if (!this.activeSkins[mod.championId]) {
          result.push({
            champion_id: mod.championId,
            skin_id: mod.skinId,
            skin_name: mod.skinName,
            is_chroma: Boolean(mod.chromaId),
            chroma_id: mod.chromaId || null,
            parent_skin_id: mod.chromaId || null,
            fantome_path: "",
            applied_at: Date.now(),
          });
        }
      }
    }

    return result;
  }

  // =========================================================================
  // Internal Mesh Claiming & Connection Logic
  // =========================================================================

  private async claimFirstAvailableSlot(): Promise<{
    peer: Peer;
    slotId: string;
    slotNumber: number;
  }> {
    for (let i = 0; i < LOBBY_SLOTS.length; i++) {
      const slotId = LOBBY_SLOTS[i];
      const slotNumber = i + 1;

      try {
        const peer = await this.tryCreatePeerSlot(slotId);
        return { peer, slotId, slotNumber };
      } catch (err: any) {
        if (err?.type === "unavailable-id") {
          // Slot is taken by an active player, proceed to next slot
          continue;
        }
        // If other error, retry or continue
      }
    }

    throw new Error("Tất cả 12 vị trí trong phòng P2P toàn cầu hiện đã đầy!");
  }

  private tryCreatePeerSlot(slotId: string): Promise<Peer> {
    return new Promise((resolve, reject) => {
      let resolved = false;

      const peer = new Peer(slotId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun3.l.google.com:19302" },
            { urls: "stun:stun4.l.google.com:19302" },
          ],
        },
      });

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          peer.destroy();
          reject(new Error("Timeout kết nối tới máy chủ P2P STUN"));
        }
      }, 4500);

      peer.on("open", () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(peer);
        }
      });

      peer.on("error", (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          peer.destroy();
          reject(err);
        }
      });
    });
  }

  private connectToOtherSlots() {
    if (!this.peer || !this.mySlotId) return;

    for (let i = 0; i < LOBBY_SLOTS.length; i++) {
      const targetSlot = LOBBY_SLOTS[i];
      if (targetSlot === this.mySlotId) continue;
      this.connectToSlot(targetSlot);
    }
  }

  private connectToSlot(targetSlot: string) {
    if (!this.peer || this.peer.destroyed || targetSlot === this.mySlotId) return;
    if (this.connections.has(targetSlot)) {
      const existing = this.connections.get(targetSlot);
      if (existing && existing.open) return;
    }

    try {
      const conn = this.peer.connect(targetSlot, {
        reliable: true,
      });
      this.setupConnection(conn, true);
    } catch (err) {
      // Ignore initial connect attempts to offline slots
    }
  }

  private setupConnection(conn: DataConnection, _isOutgoing: boolean = false) {
    const remotePeerId = conn.peer;

    conn.on("open", () => {
      this.connections.set(remotePeerId, conn);

      // Send local state immediately upon open
      const statePacket = this.buildStatePacket();
      conn.send(statePacket);

      // Immediately measure initial ping
      conn.send({
        type: "PING",
        senderId: this.mySlotId || "",
        timestamp: Date.now(),
      });
    });

    conn.on("data", (data: any) => {
      this.handlePacket(remotePeerId, data as P2PPacket, conn);
    });

    conn.on("close", () => {
      this.connections.delete(remotePeerId);
      this.peers.delete(remotePeerId);
      this.notify();
    });

    conn.on("error", () => {
      this.connections.delete(remotePeerId);
      this.peers.delete(remotePeerId);
      this.notify();
    });
  }

  private handlePacket(remotePeerId: string, packet: P2PPacket, conn: DataConnection) {
    if (!packet || typeof packet !== "object") return;

    switch (packet.type) {
      case "STATE_UPDATE": {
        const slotIdx = LOBBY_SLOTS.indexOf(packet.peerId);
        const slotNumber = slotIdx >= 0 ? slotIdx + 1 : 0;

        const isSyncPref = this.peerSyncOverrides.has(packet.peerId)
          ? (this.peerSyncOverrides.get(packet.peerId) as boolean)
          : true;

        const existing = this.peers.get(packet.peerId);
        const member: PeerMember = {
          peerId: packet.peerId,
          slotNumber,
          summonerName: packet.summonerName,
          tagLine: packet.tagLine,
          profileIconUrl: packet.profileIconUrl,
          activeMods: packet.activeMods || [],
          pingMs: existing?.pingMs || null,
          lastSeen: Date.now(),
          isSyncEnabled: isSyncPref,
        };

        this.peers.set(packet.peerId, member);

        // Pre-cache missing .fantome files for newly received peer mods
        if (member.isSyncEnabled) {
          this.triggerBackgroundSkinCache(member.activeMods);
        }

        this.notify();
        break;
      }

      case "PING": {
        try {
          conn.send({
            type: "PONG",
            senderId: this.mySlotId || "",
            originalTimestamp: packet.timestamp,
          });
        } catch {}
        break;
      }

      case "PONG": {
        const ping = Math.max(1, Date.now() - packet.originalTimestamp);
        const peer = this.peers.get(packet.senderId || remotePeerId);
        if (peer) {
          peer.pingMs = ping;
          peer.lastSeen = Date.now();
          this.notify();
        }
        break;
      }

      case "CONFLICT_ACTION": {
        // Trigger conflict alert/resolution if it involves local player
        this.notify();
        break;
      }

      case "LEAVE": {
        this.connections.delete(packet.peerId);
        this.peers.delete(packet.peerId);
        this.notify();
        break;
      }
    }
  }

  private broadcastPacket(packet: P2PPacket) {
    this.connections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(packet);
        } catch {}
      }
    });
  }

  private broadcastStateUpdate() {
    const packet = this.buildStatePacket();
    this.broadcastPacket(packet);
  }

  private buildStatePacket(): P2PPacket {
    const summonerName = this.getEffectiveSummonerName();
    const tagLine = this.summoner?.tag_line || "VN";
    const profileIconUrl =
      this.summoner?.profile_icon_url ||
      "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/29.jpg";

    const activeMods: ActiveModInfo[] = [];

    for (const [champIdStr, s] of Object.entries(this.activeSkins)) {
      const champId = Number(champIdStr);
      const champ = this.champions.find((c) => c.id === champId);
      const champName = champ?.name_vi || champ?.name || champ?.key || `Tướng ${champId}`;
      const skin = champ?.skins.find((item) => item.id === s.skin_id);

      const loadScreenUrl =
        skin?.load_screen_url ||
        skin?.splash_url ||
        `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/uncentered/${champId}/${s.skin_id}.jpg`;

      const championIconUrl =
        champ?.square_icon_url ||
        champ?.icon_url ||
        `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${champId}.png`;

      activeMods.push({
        championId: champId,
        championName: champName,
        skinId: s.skin_id,
        skinName: s.skin_name,
        chromaId: s.chroma_id || undefined,
        loadScreenUrl,
        championIconUrl,
      });
    }

    return {
      type: "STATE_UPDATE",
      peerId: this.mySlotId || "",
      summonerName,
      tagLine,
      profileIconUrl,
      activeMods,
    };
  }

  private triggerBackgroundSkinCache(mods: ActiveModInfo[]) {
    for (const mod of mods) {
      if (!mod.championId || !mod.skinId) continue;
      if (this.activeDownloads.has(mod.skinId)) continue;

      tauriClient
        .isFantomeCached(mod.championId, mod.skinId)
        .then((isCached) => {
          if (!isCached && !this.activeDownloads.has(mod.skinId)) {
            this.activeDownloads.add(mod.skinId);
            tauriClient
              .ensureSkinCached({
                champion_id: mod.championId,
                skin_id: mod.skinId,
                skin_name: mod.skinName,
                is_chroma: Boolean(mod.chromaId),
                parent_skin_id: mod.chromaId || null,
                fantome_url: null,
              })
              .finally(() => {
                this.activeDownloads.delete(mod.skinId);
                this.notify();
              });
          }
        })
        .catch(() => {});
    }
  }

  private startTimers() {
    this.stopTimers();

    // 1. Discovery sweep every 8 seconds to connect to any newly joined slot
    this.discoveryInterval = window.setInterval(() => {
      this.runDiscoverySweep();
    }, 8000);

    // 2. Real-time P2P ping sweep every 3.5 seconds
    this.pingInterval = window.setInterval(() => {
      this.runPingSweep();
    }, 3500);
  }

  private stopTimers() {
    if (this.discoveryInterval !== null) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private runDiscoverySweep() {
    if (this.status !== "connected" || !this.peer || this.peer.destroyed) return;

    for (let i = 0; i < LOBBY_SLOTS.length; i++) {
      const slot = LOBBY_SLOTS[i];
      if (slot === this.mySlotId) continue;

      const conn = this.connections.get(slot);
      if (!conn || !conn.open) {
        this.connectToSlot(slot);
      }
    }
  }

  private runPingSweep() {
    if (this.status !== "connected" || !this.mySlotId) return;

    const now = Date.now();
    this.connections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send({
            type: "PING",
            senderId: this.mySlotId || "",
            timestamp: now,
          });
        } catch {}
      }
    });

    // Prune peers that haven't responded or had closed connection
    for (const [peerId, peer] of this.peers.entries()) {
      const conn = this.connections.get(peerId);
      if (!conn || !conn.open) {
        if (now - peer.lastSeen > 12000) {
          this.peers.delete(peerId);
          this.notify();
        }
      }
    }
  }

  public getEffectiveSummonerName(): string {
    if (this.summoner?.game_name && this.summoner.tag_line) {
      return `${this.summoner.game_name} #${this.summoner.tag_line}`;
    }
    if (this.summoner?.game_name) {
      return this.summoner.game_name;
    }
    return "Bạn bè P2P";
  }
}

export const p2pLobby = new P2PLobbyManager();

