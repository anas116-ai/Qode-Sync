import { motion } from "framer-motion";
import { useId } from "react";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  variant?: "wordmark" | "lettermark" | "pictorial" | "abstract" | "combination";
}

const sizes = {
  xs: { icon: 24, text: "text-sm", showTagline: false },
  sm: { icon: 30, text: "text-base", showTagline: false },
  md: { icon: 36, text: "text-lg", showTagline: true },
  lg: { icon: 46, text: "text-xl", showTagline: true },
  xl: { icon: 58, text: "text-2xl", showTagline: true },
};

/* Brand palette */
const YELLOW_LIGHT = "#e8f553";
const YELLOW_MID = "#c8d930";
const YELLOW_DARK = "#a8b820";
const ORANGE_TEXT = "#f97316";
const ORANGE_DARK = "#ea580c";
const DARK_BG = "#0a0d18";

function getSize(size: LogoProps["size"]) {
  return sizes[size || "md"];
}

/* ═══ Professional Q icon with sync arrows ═══ */
function QSyncIcon({ iconSize, uid }: { iconSize: number; uid: string }) {
  const gId = `qs-${uid}`;
  const padding = iconSize < 30 ? 0 : 2;
  const viewSz = 64 + padding * 2;
  
  return (
    <svg 
      viewBox={`0 0 ${viewSz} ${viewSz}`} 
      width={iconSize} 
      height={iconSize} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`${gId}-brand`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={YELLOW_LIGHT} />
          <stop offset="50%" stopColor={YELLOW_MID} />
          <stop offset="100%" stopColor={YELLOW_DARK} />
        </linearGradient>
        <linearGradient id={`${gId}-orange`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={ORANGE_TEXT} />
          <stop offset="100%" stopColor={ORANGE_DARK} />
        </linearGradient>
        <filter id={`${gId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer ring - Q shape */}
      <circle
        cx="32" cy="32" r="28"
        stroke={`url(#${gId}-brand)`}
        strokeWidth="3"
        fill="none"
        filter={`url(#${gId}-glow)`}
      />

      {/* Q tail */}
      <line
        x1="48" y1="48" x2="58" y2="58"
        stroke={`url(#${gId}-brand)`}
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Q letter inside */}
      <text 
        x="32" y="44" 
        textAnchor="middle" 
        fill={`url(#${gId}-orange)`}
        fontSize="32" 
        fontWeight="700" 
        fontFamily="'Cabinet Grotesk', sans-serif"
        opacity="0.95"
      >
        Q
      </text>

      {/* Sync arrows going around */}
      <g opacity="0.9">
        {/* Top-right arrow */}
        <path 
          d="M46 18 A22 22 0 0 1 54 32" 
          stroke={YELLOW_LIGHT} 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          fill="none"
          strokeDasharray="12 6"
        >
          <animateTransform 
            attributeName="transform" 
            type="rotate" 
            from="0 32 32" 
            to="360 32 32" 
            dur="4s" 
            repeatCount="indefinite" 
          />
        </path>
        {/* Bottom-right arrow */}
        <path 
          d="M54 32 A22 22 0 0 1 46 46" 
          stroke={YELLOW_MID} 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          fill="none"
          strokeDasharray="10 8"
        >
          <animateTransform 
            attributeName="transform" 
            type="rotate" 
            from="0 32 32" 
            to="360 32 32" 
            dur="4s" 
            repeatCount="indefinite" 
          />
        </path>
        {/* Arrowhead */}
        <polygon 
          points="56,30 58,36 53,33" 
          fill={YELLOW_LIGHT}
        >
          <animateTransform 
            attributeName="transform" 
            type="rotate" 
            from="0 32 32" 
            to="360 32 32" 
            dur="4s" 
            repeatCount="indefinite" 
          />
        </polygon>
      </g>

      {/* Small dot accents */}
      <circle cx="20" cy="18" r="2" fill={YELLOW_LIGHT} opacity="0.6">
        <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="44" cy="18" r="1.5" fill={YELLOW_DARK} opacity="0.4">
        <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* ═══ Abstract Mark: Code brackets style ═══ */
function AbstractMark({ iconSize, uid }: { iconSize: number; uid: string }) {
  const gId = `qs-${uid}`;
  return (
    <svg viewBox="0 0 64 64" width={iconSize} height={iconSize} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${gId}-ring`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={YELLOW_LIGHT} />
          <stop offset="50%" stopColor={YELLOW_MID} />
          <stop offset="100%" stopColor={YELLOW_DARK} />
        </linearGradient>
        <filter id={`${gId}-glow`}>
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="30" cy="28" r="20" stroke={`url(#${gId}-ring)`} strokeWidth="4.5" fill="none" filter={`url(#${gId}-glow)`} />
      <line x1="40" y1="38" x2="52" y2="52" stroke={`url(#${gId}-ring)`} strokeWidth="4.5" strokeLinecap="round" filter={`url(#${gId}-glow)`} />
      <path d="M22 22 L17 27 L22 32" stroke={YELLOW_LIGHT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.8" />
      <line x1="27" y1="20" x2="23" y2="34" stroke={YELLOW_MID} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M32 22 L37 27 L32 32" stroke={YELLOW_LIGHT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.8" />
    </svg>
  );
}

/* ═══ Sync waves pictorial ═══ */
function PictorialMark({ iconSize, uid }: { iconSize: number; uid: string }) {
  const gId = `pm-${uid}`;
  return (
    <svg viewBox="0 0 64 64" width={iconSize} height={iconSize} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${gId}-1`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={YELLOW_LIGHT} />
          <stop offset="100%" stopColor={YELLOW_MID} />
        </linearGradient>
        <linearGradient id={`${gId}-2`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={YELLOW_MID} />
          <stop offset="100%" stopColor={YELLOW_DARK} />
        </linearGradient>
      </defs>
      <path d="M16 32 C16 18, 48 18, 48 32" stroke={`url(#${gId}-1)`} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M48 32 C48 46, 16 46, 16 32" stroke={`url(#${gId}-2)`} strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="16" cy="32" r="4" fill={YELLOW_LIGHT} />
      <circle cx="48" cy="32" r="4" fill={YELLOW_DARK} />
      <circle cx="32" cy="32" r="3" fill={YELLOW_MID} opacity="0.8" />
    </svg>
  );
}

/* ═══ Wordmark: "Qode Sync" in Orange ═══ */
function Wordmark({ textSize, showTagline }: { textSize: string; showTagline: boolean }) {
  return (
    <div className="flex flex-col">
      <span
        className={`font-display font-bold ${textSize} tracking-tight leading-none`}
        style={{
          background: `linear-gradient(135deg, ${ORANGE_TEXT} 0%, ${ORANGE_DARK} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Qode Sync
      </span>
      {showTagline && (
        <span 
          className="text-[9px] font-medium tracking-[0.2em] uppercase -mt-0.5" 
          style={{ color: YELLOW_MID, opacity: 0.8 }}
        >
          Intelligent Synchronization
        </span>
      )}
    </div>
  );
}

/* ═══ Main Logo Export ═══ */
export function Logo({ size = "md", showText = true, variant = "combination" }: LogoProps) {
  const uid = useId();
  const s = getSize(size);
  const showTagline = s.showTagline && showText;
  const common = { iconSize: s.icon, uid };

  const glow = (child: React.ReactNode) => (
    <div className="relative" style={{ width: s.icon, height: s.icon }}>
      <div 
        className="absolute inset-0 rounded-xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity duration-500" 
        style={{ 
          background: `radial-gradient(circle, ${YELLOW_MID}44 0%, transparent 70%)`,
        }} 
      />
      {child}
    </div>
  );

  const renderIcon = () => {
    switch (variant) {
      case "lettermark":
        return glow(<QSyncIcon {...common} />);
      case "pictorial":
        return glow(<PictorialMark {...common} />);
      case "abstract":
        return glow(<AbstractMark {...common} />);
      case "combination":
        return (
          <>
            {glow(<QSyncIcon {...common} />)}
            <Wordmark textSize={s.text} showTagline={showTagline} />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <motion.a
      href="/"
      className="flex items-center gap-2.5 group"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
    >
      {variant === "wordmark" ? (
        <Wordmark textSize={s.text} showTagline={showTagline} />
      ) : null}
      {variant !== "wordmark" && variant !== "combination" && showText && (
        <Wordmark textSize={s.text} showTagline={showTagline} />
      )}
      {renderIcon()}
    </motion.a>
  );
}