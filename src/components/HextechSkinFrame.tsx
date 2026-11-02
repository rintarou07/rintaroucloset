import React from "react";
import clsx from "clsx";

interface HextechSkinFrameProps {
  isActive?: boolean;
  isHovered?: boolean;
  className?: string;
}

/**
 * Authentic League of Legends Collection Loadscreen SVG Frame.
 * Aspect ratio: 308 x 560
 * Features:
 * - Top-center hollow diamond
 * - Stepped chamfered outer frame with bottom opening for Rarity Gem
 * - 4px inset inner corner accents
 * - Mid-frame notch embellishments
 * - Dynamic color transitions: Antique Gold -> Hover Gold -> Blood Moon Crimson
 */
const HextechSkinFrameComponent: React.FC<HextechSkinFrameProps> = ({
  isActive = false,
  isHovered = false,
  className,
}) => {
  // Determine stroke color
  const strokeColor = isActive
    ? "#E11D48" // Injected / Active Blood Crimson
    : isHovered
    ? "#C89B3C" // LoL Hover Gold
    : "#785A28"; // Default Antique Gold

  const accentColor = isActive
    ? "#F43F5E"
    : isHovered
    ? "#E4C280"
    : "#543F1C";

  return (
    <svg
      viewBox="0 0 308 560"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={clsx(
        "absolute inset-0 w-full h-full pointer-events-none z-20 transition-colors duration-300",
        isActive && "drop-shadow-[0_0_10px_rgba(225,29,72,0.6)]",
        className
      )}
    >
      <defs>
        {/* Glow filter for active/injected skins */}
        <filter id="crimson-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#E11D48" floodOpacity="0.8" />
        </filter>
        <filter id="gold-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#C89B3C" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* Top Center Hollow Diamond */}
      <polygon
        points="154,4 161,11 154,18 147,11"
        fill="#131314"
        stroke={strokeColor}
        strokeWidth="1.8"
      />

      {/* Outer Stepped Frame with Chamfered Corners and Bottom Gem Opening */}
      <path
        d="M 141 11 L 24 11 L 24 19 L 16 19 L 16 27 L 10 27 L 10 532 L 16 532 L 16 540 L 24 540 L 24 548 L 130 548 M 178 548 L 284 548 L 284 540 L 292 540 L 292 532 L 298 532 L 298 27 L 292 27 L 292 19 L 284 19 L 284 11 L 167 11"
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />

      {/* Inner Corner Accent Lines (4px Inset) */}
      {/* Top-Left */}
      <path
        d="M 28 23 L 20 23 L 20 27 L 15 27 L 15 60"
        fill="none"
        stroke={accentColor}
        strokeWidth="1.2"
        strokeOpacity={isActive ? 1 : 0.8}
      />
      {/* Top-Right */}
      <path
        d="M 280 23 L 288 23 L 288 27 L 293 27 L 293 60"
        fill="none"
        stroke={accentColor}
        strokeWidth="1.2"
        strokeOpacity={isActive ? 1 : 0.8}
      />
      {/* Bottom-Left */}
      <path
        d="M 15 500 L 15 532 L 20 532 L 20 536 L 28 536"
        fill="none"
        stroke={accentColor}
        strokeWidth="1.2"
        strokeOpacity={isActive ? 1 : 0.8}
      />
      {/* Bottom-Right */}
      <path
        d="M 293 500 L 293 532 L 288 532 L 288 536 L 280 536"
        fill="none"
        stroke={accentColor}
        strokeWidth="1.2"
        strokeOpacity={isActive ? 1 : 0.8}
      />

      {/* Mid-Left Edge Accent Notch */}
      <path
        d="M 8 274 L 12 280 L 8 286"
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
      />
      {/* Mid-Right Edge Accent Notch */}
      <path
        d="M 300 274 L 296 280 L 300 286"
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
      />

      {/* Bottom Center Gem Mounting Flanges */}
      <path
        d="M 127 544 L 132 552 L 136 552"
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
      />
      <path
        d="M 181 544 L 176 552 L 172 552"
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
      />
    </svg>
  );
};

export const HextechSkinFrame = React.memo(HextechSkinFrameComponent);
export default HextechSkinFrame;

