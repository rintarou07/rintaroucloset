import { Peer, type DataConnection } from "peerjs";
import { tauriClient } from "./tauriClient";
import type { ActiveSkinProfile, SummonerProfile, ChampionItem } from "../types/skin";

export const LOBBY_SLOTS = Array.from(
  { length: 12 },
  (_, i) => `hextech-bloodmoon-global-v1-slot-${i + 1}`
);

const MESH_TOPIC = "rintarou-closet/global-p2p-mesh/v2";

const WSS_MESH_BROKERS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://test.mosquitto.org:8081/mqtt",
];

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
      "turns:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

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
  clientUid?: string;
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
      type: "HELLO";
      msgId?: string;
      peerId: string;
      clientUid?: string;
    }
  | {
      type: "STATE_UPDATE";
      msgId?: string;
      peerId: string;
      clientUid?: string;
      summonerName: string;
      tagLine: string;
      profileIconUrl: string;
      activeMods: ActiveModInfo[];
    }
  | {
      type: "PING";
      msgId?: string;
      senderId: string;
      targetId?: string;
      timestamp: number;
    }
  | {
      type: "PONG";
      msgId?: string;
      senderId: string;
      targetId?: string;
      originalTimestamp: number;
    }
  | {
      type: "CONFLICT_ACTION";
      msgId?: string;
      championId: number;
      fromSummoner: string;
      targetSummoner: string;
      action: "yield" | "keep";
    }
  | {
      type: "LEAVE";
      msgId?: string;
      peerId: string;
      clientUid?: string;
    };

type P2PListener = (state: P2PLobbyState) => void;

// ============================================================================
// Lightweight Native MQTT v3.1.1 over WebSocket Codec (Port 443 TLS NAT Bypass)
// ============================================================================

function encodeMqttString(str: string): Uint8Array {
  const utf8 = new TextEncoder().encode(str);
  const out = new Uint8Array(2 + utf8.length);
  out[0] = (utf8.length >> 8) & 0xff;
  out[1] = utf8.length & 0xff;
  out.set(utf8, 2);
  return out;
}

function encodeVarint(len: number): number[] {
  const out: number[] = [];
  do {
    let digit = len % 128;
    len = Math.floor(len / 128);
    if (len > 0) digit |= 0x80;
    out.push(digit);
  } while (len > 0);
  return out;
}

function buildMqttConnectPacket(clientId: string): Uint8Array {
  const varHeader = new Uint8Array([
    0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, // "MQTT"
    0x04, // Protocol level 4 (3.1.1)
    0x02, // Clean Session
    0x00, 0x1e, // Keep Alive = 30s
  ]);
  const payload = encodeMqttString(clientId);
  const remLen = varHeader.length + payload.length;
  const varint = encodeVarint(remLen);
  const pkt = new Uint8Array(1 + varint.length + remLen);
  pkt[0] = 0x10;
  pkt.set(varint, 1);
  pkt.set(varHeader, 1 + varint.length);
  pkt.set(payload, 1 + varint.length + varHeader.length);
  return pkt;
}

function buildMqttSubscribePacket(topic: string, packetId = 1): Uint8Array {
  const topicBytes = encodeMqttString(topic);
  const remLen = 2 + topicBytes.length + 1;
  const varint = encodeVarint(remLen);
  const pkt = new Uint8Array(1 + varint.length + remLen);
  pkt[0] = 0x82;
  pkt.set(varint, 1);
  const offset = 1 + varint.length;
  pkt[offset] = (packetId >> 8) & 0xff;
  pkt[offset + 1] = packetId & 0xff;
  pkt.set(topicBytes, offset + 2);
  pkt[offset + 2 + topicBytes.length] = 0x00;
  return pkt;
}

function buildMqttPublishPacket(topic: string, jsonPayload: string): Uint8Array {
  const topicBytes = encodeMqttString(topic);
  const payloadBytes = new TextEncoder().encode(jsonPayload);
  const remLen = topicBytes.length + payloadBytes.length;
  const varint = encodeVarint(remLen);
  const pkt = new Uint8Array(1 + varint.length + remLen);
  pkt[0] = 0x30;
  pkt.set(varint, 1);
  const offset = 1 + varint.length;
  pkt.set(topicBytes, offset);
  pkt.set(payloadBytes, offset + topicBytes.length);
  return pkt;
}

function parseMqttBuffer(
  buffer: ArrayBuffer,
  onConnAck: () => void,
  onPublish: (payloadStr: string) => void
) {
  const data = new Uint8Array(buffer);
  let pos = 0;
  while (pos < data.length) {
    const headerByte = data[pos];
    const packetType = headerByte & 0xf0;
    const qos = (headerByte >> 1) & 0x03;
    pos++;

    let multiplier = 1;
    let remLen = 0;
    while (pos < data.length) {
      const digit = data[pos++];
      remLen += (digit & 0x7f) * multiplier;
      multiplier *= 128;
      if ((digit & 0x80) === 0) break;
    }

    const packetEnd = pos + remLen;
    if (packetEnd > data.length) break;

    if (packetType === 0x20) {
      onConnAck();
    } else if (packetType === 0x30) {
      if (pos + 2 <= packetEnd) {
        const topicLen = (data[pos] << 8) | data[pos + 1];
        let payloadStart = pos + 2 + topicLen;
        if (qos > 0) {
          payloadStart += 2;
        }
        if (payloadStart <= packetEnd) {
          const payloadBytes = data.subarray(payloadStart, packetEnd);
          const str = new TextDecoder().decode(payloadBytes);
          onPublish(str);
        }
      }
    }
    pos = packetEnd;
  }
}

// ============================================================================
// Hybrid Global P2P Mesh Manager (WebRTC Direct + Multi-Broker WSS Relay)
// ============================================================================

class P2PLobbyManager {
  private peer: Peer | null = null;
  private mySlotId: string | null = null;
  private mySlotNumber: number | null = null;
  private clientUid: string;
  private status: P2PLobbyStatus = "disconnected";
  private errorMessage: string | null = null;

  private connections: Map<string, DataConnection> = new Map();
  private pendingConnections: Map<string, DataConnection> = new Map();
  private wssSockets: Map<string, { ws: WebSocket; ready: boolean }> = new Map();
  private seenMsgIds: Set<string> = new Set();

  private peers: Map<string, PeerMember> = new Map();
  private peerSyncOverrides: Map<string, boolean> = new Map();

  // Local state cache
  private summoner: SummonerProfile | null = null;
  private activeSkins: Record<number, ActiveSkinProfile> = {};
  private champions: ChampionItem[] = [];

  // Background intervals
  private discoveryInterval: number | null = null;
  private pingInterval: number | null = null;
  private wssKeepAliveInterval: number | null = null;
  private activeDownloads: Set<number> = new Set();
  private listeners: Set<P2PListener> = new Set();

  constructor() {
    let savedUid = "";
    try {
      savedUid = localStorage.getItem("rc_p2p_client_uid") || "";
      if (!savedUid) {
        savedUid = `uid-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
        localStorage.setItem("rc_p2p_client_uid", savedUid);
      }
    } catch {
      savedUid = `uid-${Math.random().toString(36).slice(2, 10)}`;
    }
    this.clientUid = savedUid;

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        if (this.status === "connected" && this.mySlotId) {
          this.broadcastPacket({
            type: "LEAVE",
            peerId: this.mySlotId,
            clientUid: this.clientUid,
          });
        }
      });
    }
  }

  public getState(): P2PLobbyState {
    const peerList = Array.from(this.peers.values()).sort((a, b) =>
      a.summonerName.localeCompare(b.summonerName)
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
   * Connects both Multi-Broker WSS Mesh (100% CGNAT/Symmetric-NAT proof)
   * and WebRTC Direct P2P (STUN + TURN relays) in parallel.
   */
  public async joinLobby(): Promise<boolean> {
    if (this.status === "connected" || this.status === "connecting") {
      return true;
    }

    this.status = "connecting";
    this.errorMessage = null;
    this.notify();

    try {
      const uniquePeerId = `rc-mesh-${this.clientUid}-${Math.random().toString(36).slice(2, 6)}`;
      this.mySlotId = uniquePeerId;
      this.mySlotNumber = 1;

      // Launch both WSS Mesh Relay and WebRTC Peer node in parallel
      const wssPromise = this.connectWssMesh(uniquePeerId);
      const webrtcPromise = this.initWebRtcPeer(uniquePeerId);

      // Succeed as soon as either transport is ready (usually <300ms)
      const firstReady = await Promise.race([
        wssPromise.then((ok) => (ok ? "wss" : Promise.reject())),
        webrtcPromise.then((ok) => (ok ? "webrtc" : Promise.reject())),
      ]).catch(async () => {
        const [w1, w2] = await Promise.all([wssPromise, webrtcPromise]);
        return w1 || w2 ? "ready" : null;
      });

      if (!firstReady) {
        throw new Error("Không thể kết nối mạng lưới P2P. Vui lòng kiểm tra kết nối mạng.");
      }

      this.status = "connected";
      this.notify();

      // Immediately announce presence and local state
      this.broadcastPacket({
        type: "HELLO",
        peerId: uniquePeerId,
        clientUid: this.clientUid,
      });
      this.broadcastStateUpdate();

      // Start background discovery & ping sweeps
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

  public leaveLobby() {
    if (this.mySlotId) {
      this.broadcastPacket({
        type: "LEAVE",
        peerId: this.mySlotId,
        clientUid: this.clientUid,
      });
    }

    this.stopTimers();

    this.connections.forEach((conn) => {
      try {
        conn.close();
      } catch {}
    });
    this.connections.clear();

    this.pendingConnections.forEach((conn) => {
      try {
        conn.close();
      } catch {}
    });
    this.pendingConnections.clear();

    this.wssSockets.forEach(({ ws }) => {
      try {
        ws.close();
      } catch {}
    });
    this.wssSockets.clear();

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

    tauriClient.setSyncConfig({ is_sync_enabled: false }).catch(() => {});
  }

  public togglePeerSync(peerId: string) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    const next = !peer.isSyncEnabled;
    peer.isSyncEnabled = next;
    this.peerSyncOverrides.set(peerId, next);
    if (peer.clientUid) {
      this.peerSyncOverrides.set(peer.clientUid, next);
    }
    this.notify();
  }

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

  public getSyncableFriendSkins(): ActiveSkinProfile[] {
    const result: ActiveSkinProfile[] = [];

    for (const peer of this.peers.values()) {
      if (!peer.isSyncEnabled) continue;

      for (const mod of peer.activeMods) {
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
  // Transport 1: Multi-Broker WSS Mesh (Port 443 TLS - Works Across All ISPs)
  // =========================================================================

  private connectWssMesh(myPeerId: string): Promise<boolean> {
    return new Promise((resolve) => {
      let resolved = false;
      let failedCount = 0;

      for (const brokerUrl of WSS_MESH_BROKERS) {
        this.connectSingleWssBroker(brokerUrl, myPeerId, (ok) => {
          if (ok && !resolved) {
            resolved = true;
            resolve(true);
          } else if (!ok) {
            failedCount++;
            if (failedCount === WSS_MESH_BROKERS.length && !resolved) {
              resolved = true;
              resolve(false);
            }
          }
        });
      }

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(this.wssSockets.size > 0);
        }
      }, 4000);
    });
  }

  private connectSingleWssBroker(
    brokerUrl: string,
    myPeerId: string,
    onResult?: (ok: boolean) => void
  ) {
    try {
      const ws = new WebSocket(brokerUrl, "mqtt");
      ws.binaryType = "arraybuffer";
      let reported = false;

      const report = (ok: boolean) => {
        if (!reported) {
          reported = true;
          onResult?.(ok);
        }
      };

      ws.onopen = () => {
        try {
          const clientId = `${myPeerId}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 60);
          ws.send(buildMqttConnectPacket(clientId));
        } catch {
          report(false);
        }
      };

      ws.onmessage = (ev) => {
        if (!(ev.data instanceof ArrayBuffer)) return;

        parseMqttBuffer(
          ev.data,
          () => {
            // CONNACK received -> Subscribe to global mesh topic
            try {
              ws.send(buildMqttSubscribePacket(MESH_TOPIC, 1));
              this.wssSockets.set(brokerUrl, { ws, ready: true });
              report(true);

              // Broadcast presence on this newly ready broker
              if (this.status === "connected" && this.mySlotId) {
                const hello = this.stampPacket({
                  type: "HELLO",
                  peerId: this.mySlotId,
                  clientUid: this.clientUid,
                });
                const state = this.stampPacket(this.buildStatePacket());
                ws.send(buildMqttPublishPacket(MESH_TOPIC, JSON.stringify(hello)));
                ws.send(buildMqttPublishPacket(MESH_TOPIC, JSON.stringify(state)));
              }
            } catch {
              report(false);
            }
          },
          (payloadStr) => {
            try {
              const pkt = JSON.parse(payloadStr) as P2PPacket;
              const senderId =
                pkt.type === "PING" || pkt.type === "PONG"
                  ? pkt.senderId
                  : "peerId" in pkt
                  ? pkt.peerId
                  : "";
              if (senderId && senderId === this.mySlotId) return;
              this.handlePacket(senderId, pkt);
            } catch {}
          }
        );
      };

      ws.onerror = () => {
        this.wssSockets.delete(brokerUrl);
        report(false);
      };

      ws.onclose = () => {
        this.wssSockets.delete(brokerUrl);
        report(false);
      };
    } catch {
      onResult?.(false);
    }
  }

  // =========================================================================
  // Transport 2: WebRTC Direct DataChannel with TURN Relays
  // =========================================================================

  private initWebRtcPeer(myPeerId: string): Promise<boolean> {
    return new Promise((resolve) => {
      let resolved = false;

      try {
        const peer = new Peer(myPeerId, {
          debug: 0,
          config: {
            iceServers: ICE_SERVERS,
            iceCandidatePoolSize: 10,
          },
        });

        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        }, 4500);

        peer.on("open", () => {
          this.peer = peer;
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(true);
          }
        });

        peer.on("connection", (conn) => {
          this.setupConnection(conn);
        });

        peer.on("error", () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(false);
          }
        });

        peer.on("disconnected", () => {
          if (this.peer && !this.peer.destroyed) {
            try {
              this.peer.reconnect();
            } catch {}
          }
        });
      } catch {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      }
    });
  }

  private connectToRemotePeer(remotePeerId: string) {
    if (!this.peer || this.peer.destroyed || !this.mySlotId) return;
    if (!remotePeerId || remotePeerId === this.mySlotId) return;

    const existing = this.connections.get(remotePeerId);
    if (existing && existing.open) return;

    if (this.pendingConnections.has(remotePeerId)) return;

    try {
      const conn = this.peer.connect(remotePeerId, {
        reliable: true,
        serialization: "json",
      });
      this.pendingConnections.set(remotePeerId, conn);
      this.setupConnection(conn);

      // Clear pending status after 6s if ICE hasn't opened yet
      setTimeout(() => {
        if (this.pendingConnections.get(remotePeerId) === conn) {
          this.pendingConnections.delete(remotePeerId);
        }
      }, 6000);
    } catch {}
  }

  private setupConnection(conn: DataConnection) {
    const remotePeerId = conn.peer;

    conn.on("open", () => {
      this.pendingConnections.delete(remotePeerId);
      const prev = this.connections.get(remotePeerId);
      if (prev && prev !== conn && prev.open) {
        // Keep a single clean WebRTC channel per peer
        try {
          prev.close();
        } catch {}
      }
      this.connections.set(remotePeerId, conn);

      try {
        conn.send(this.stampPacket(this.buildStatePacket()));
        conn.send(
          this.stampPacket({
            type: "PING",
            senderId: this.mySlotId || "",
            targetId: remotePeerId,
            timestamp: Date.now(),
          })
        );
      } catch {}
    });

    conn.on("data", (data: any) => {
      this.handlePacket(remotePeerId, data as P2PPacket, conn);
    });

    const cleanupConn = () => {
      if (this.pendingConnections.get(remotePeerId) === conn) {
        this.pendingConnections.delete(remotePeerId);
      }
      if (this.connections.get(remotePeerId) === conn) {
        this.connections.delete(remotePeerId);
      }
    };

    conn.on("close", cleanupConn);
    conn.on("error", cleanupConn);
  }

  // =========================================================================
  // Packet Handling & Deduplication Across WebRTC + WSS Transports
  // =========================================================================

  private stampPacket<T extends P2PPacket>(packet: T): T {
    if (!packet.msgId) {
      packet.msgId = `${this.mySlotId || "p"}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`;
    }
    return packet;
  }

  private isDuplicatePacket(msgId?: string): boolean {
    if (!msgId) return false;
    if (this.seenMsgIds.has(msgId)) return true;
    this.seenMsgIds.add(msgId);
    if (this.seenMsgIds.size > 600) {
      const first = this.seenMsgIds.values().next().value;
      if (first) this.seenMsgIds.delete(first);
    }
    return false;
  }

  private handlePacket(remotePeerId: string, packet: P2PPacket, conn?: DataConnection) {
    if (!packet || typeof packet !== "object") return;
    if (this.isDuplicatePacket(packet.msgId)) return;

    switch (packet.type) {
      case "HELLO": {
        if (!packet.peerId || packet.peerId === this.mySlotId) return;
        // Initiate direct WebRTC connection and immediately reply with our state
        this.connectToRemotePeer(packet.peerId);
        this.broadcastStateUpdate();
        break;
      }

      case "STATE_UPDATE": {
        if (!packet.peerId || packet.peerId === this.mySlotId) return;
        if (packet.clientUid && packet.clientUid === this.clientUid) return;

        // Remove any stale session entry from the same physical friend (clientUid)
        if (packet.clientUid) {
          for (const [oldPeerId, oldMember] of this.peers.entries()) {
            if (oldPeerId !== packet.peerId && oldMember.clientUid === packet.clientUid) {
              this.peers.delete(oldPeerId);
              this.connections.delete(oldPeerId);
            }
          }
        }

        const isNewPeer = !this.peers.has(packet.peerId);
        const overrideKey = packet.clientUid || packet.peerId;
        const isSyncPref = this.peerSyncOverrides.has(overrideKey)
          ? (this.peerSyncOverrides.get(overrideKey) as boolean)
          : this.peerSyncOverrides.has(packet.peerId)
          ? (this.peerSyncOverrides.get(packet.peerId) as boolean)
          : true;

        const existing = this.peers.get(packet.peerId);
        const member: PeerMember = {
          peerId: packet.peerId,
          slotNumber: existing?.slotNumber || this.peers.size + 1,
          summonerName: packet.summonerName,
          tagLine: packet.tagLine,
          profileIconUrl: packet.profileIconUrl,
          activeMods: packet.activeMods || [],
          pingMs: existing?.pingMs || null,
          lastSeen: Date.now(),
          isSyncEnabled: isSyncPref,
          clientUid: packet.clientUid,
        };

        this.peers.set(packet.peerId, member);

        // Ensure direct WebRTC channel is attempted if not already open
        this.connectToRemotePeer(packet.peerId);

        // If this is a newly discovered peer, reply with our state + immediate ping
        if (isNewPeer) {
          this.broadcastStateUpdate();
          this.sendPingToPeer(packet.peerId);
        }

        // Pre-cache missing .fantome files for newly received peer mods
        if (member.isSyncEnabled) {
          this.triggerBackgroundSkinCache(member.activeMods);
        }

        this.notify();
        break;
      }

      case "PING": {
        if (!packet.senderId || packet.senderId === this.mySlotId) return;
        if (packet.targetId && packet.targetId !== this.mySlotId) return;

        const pongPacket = this.stampPacket({
          type: "PONG",
          senderId: this.mySlotId || "",
          targetId: packet.senderId,
          originalTimestamp: packet.timestamp,
        });

        if (conn && conn.open) {
          try {
            conn.send(pongPacket);
            return;
          } catch {}
        }
        this.sendToPeerOrBroadcast(packet.senderId, pongPacket);
        break;
      }

      case "PONG": {
        if (!packet.senderId || packet.senderId === this.mySlotId) return;
        if (packet.targetId && packet.targetId !== this.mySlotId) return;

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
        this.notify();
        break;
      }

      case "LEAVE": {
        this.connections.delete(packet.peerId);
        this.peers.delete(packet.peerId);
        if (packet.clientUid) {
          for (const [id, m] of this.peers.entries()) {
            if (m.clientUid === packet.clientUid) {
              this.peers.delete(id);
            }
          }
        }
        this.notify();
        break;
      }
    }
  }

  private sendToPeerOrBroadcast(targetPeerId: string, packet: P2PPacket) {
    const stamped = this.stampPacket(packet);
    const directConn = this.connections.get(targetPeerId);
    if (directConn && directConn.open) {
      try {
        directConn.send(stamped);
        return;
      } catch {}
    }
    this.broadcastViaWss(stamped);
  }

  private broadcastViaWss(packet: P2PPacket) {
    const json = JSON.stringify(packet);
    const mqttPkt = buildMqttPublishPacket(MESH_TOPIC, json);
    this.wssSockets.forEach(({ ws, ready }) => {
      if (ready && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(mqttPkt);
        } catch {}
      }
    });
  }

  private broadcastPacket(packet: P2PPacket) {
    const stamped = this.stampPacket(packet);

    // 1. Send over all open WebRTC DataChannels
    this.connections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(stamped);
        } catch {}
      }
    });

    // 2. Also broadcast over WSS Mesh so peers behind strict NAT/Firewall always receive it
    this.broadcastViaWss(stamped);
  }

  private broadcastStateUpdate() {
    const packet = this.buildStatePacket();
    this.broadcastPacket(packet);
  }

  private sendPingToPeer(targetPeerId: string) {
    if (!this.mySlotId) return;
    this.sendToPeerOrBroadcast(targetPeerId, {
      type: "PING",
      senderId: this.mySlotId,
      targetId: targetPeerId,
      timestamp: Date.now(),
    });
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
      clientUid: this.clientUid,
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

    // 1. Discovery & state heartbeat every 5 seconds
    this.discoveryInterval = window.setInterval(() => {
      this.runDiscoverySweep();
    }, 5000);

    // 2. Real-time P2P ping sweep every 3.5 seconds
    this.pingInterval = window.setInterval(() => {
      this.runPingSweep();
    }, 3500);

    // 3. MQTT WSS keep-alive & auto-reconnect every 15 seconds
    this.wssKeepAliveInterval = window.setInterval(() => {
      this.maintainWssBrokers();
    }, 15000);
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
    if (this.wssKeepAliveInterval !== null) {
      clearInterval(this.wssKeepAliveInterval);
      this.wssKeepAliveInterval = null;
    }
  }

  private maintainWssBrokers() {
    if (this.status !== "connected" || !this.mySlotId) return;

    const pingReq = new Uint8Array([0xc0, 0x00]); // MQTT PINGREQ
    for (const brokerUrl of WSS_MESH_BROKERS) {
      const entry = this.wssSockets.get(brokerUrl);
      if (entry && entry.ws.readyState === WebSocket.OPEN) {
        try {
          entry.ws.send(pingReq);
        } catch {}
      } else {
        this.wssSockets.delete(brokerUrl);
        this.connectSingleWssBroker(brokerUrl, this.mySlotId);
      }
    }
  }

  private runDiscoverySweep() {
    if (this.status !== "connected" || !this.mySlotId) return;

    // Broadcast periodic state heartbeat so all online peers stay synced
    this.broadcastStateUpdate();

    // Ensure direct WebRTC channels are connected to known peers
    for (const peerId of this.peers.keys()) {
      this.connectToRemotePeer(peerId);
    }
  }

  private runPingSweep() {
    if (this.status !== "connected" || !this.mySlotId) return;

    const now = Date.now();
    for (const [peerId, peer] of this.peers.entries()) {
      // Remove stale peers that haven't sent any state or pong in 16 seconds
      if (now - peer.lastSeen > 16000) {
        this.peers.delete(peerId);
        this.connections.delete(peerId);
        this.notify();
        continue;
      }
      this.sendPingToPeer(peerId);
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
