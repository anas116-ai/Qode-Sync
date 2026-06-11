import { motion } from "framer-motion";
import { useId } from "react";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  variant?: "wordmark" | "lettermark" | "pictorial" | "abstract" | "combination";
}

const sizes = {
  xs: { icon: 28, text: "text-lg", showTagline: false },
  sm: { icon: 34, text: "text-xl", showTagline: false },
  md: { icon: 44, text: "text-2xl", showTagline: true },
  lg: { icon: 52, text: "text-3xl", showTagline: true },
  xl: { icon: 64, text: "text-4xl", showTagline: true },
};

const YELLOW = "#FFF44F";
const ORANGE = "#FF6B00";

function getSize(size: LogoProps["size"]) {
  return sizes[size || "md"];
}

function MainIcon({ iconSize, uid }: { iconSize: number; uid: string }) {
  return (
    <svg viewBox="0 0 64 64" width={iconSize} height={iconSize} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" fill="#000000" />
      <path d="M 16 32 A 16 16 0 0 1 48 32" stroke={YELLOW} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M 16 32 A 16 16 0 0 0 48 32" stroke={YELLOW} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M 19 27 Q 32 24, 45 27" stroke={YELLOW} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 19 32 Q 32 35, 45 32" stroke={ORANGE} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 19 37 Q 32 40, 45 37" stroke={YELLOW} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function AbstractMark({ iconSize, uid }: { iconSize: number; uid: string }) {
  return (
    <svg viewBox="0 0 64 64" width={iconSize} height={iconSize} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" fill="#000000" />
      <path d="M 16 32 A 14 14 0 0 1 48 32" stroke={YELLOW} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M 16 32 A 14 14 0 0 0 48 32" stroke={YELLOW} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M 20 28 Q 32 25, 44 28" stroke={YELLOW} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M 20 32 Q 32 35, 44 32" stroke={ORANGE} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M 20 36 Q 32 39, 44 36" stroke={YELLOW} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function PictorialMark({ iconSize, uid }: { iconSize: number; uid: string }) {
  return (
    <svg viewBox="0 0 64 64" width={iconSize} height={iconSize} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" fill="#000000" />
      <path d="M 18 26 Q 32 22, 46 26" stroke={YELLOW} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M 18 32 Q 32 36, 46 32" stroke={ORANGE} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M 18 38 Q 32 42, 46 38" stroke={YELLOW} strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function Wordmark({ textSize, showTagline }: { textSize: string; showTagline: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="flex items-baseline" style={{ gap: "0.25em" }}>
        <span className={`font-stencil font-bold ${textSize} leading-none`} style={{ color: YELLOW, letterSpacing: "0.06em" }}>Qode</span>
        <span className={`font-stencil font-bold ${textSize} leading-none`} style={{ color: YELLOW, letterSpacing: "0.06em" }}>Sync</span>
      </span>
      {showTagline && (
        <span className="text-[11px] font-normal tracking-[0.18em] uppercase mt-0.5" style={{ color: ORANGE, opacity: 1, textShadow: "0 0 8px rgba(255,107,0,0.35)" }}>
          Intelligent Synchronization
        </span>
      )}
    </div>
  );
}

export function Logo({ size = "md", showText = true, variant = "combination" }: LogoProps) {
  const uid = useId();
  const s = getSize(size);
  const showTagline = s.showTagline && showText;
  const common = { iconSize: s.icon, uid };

  const renderIcon = () => {
    switch (variant) {
      case "lettermark": return <MainIcon {...common} />;
      case "pictorial": return <PictorialMark {...common} />;
      case "abstract": return <AbstractMark {...common} />;
      case "combination": return <><MainIcon {...common} /><Wordmark textSize={s.text} showTagline={showTagline} /></>;
      default: return null;
    }
  };

  return (
    <motion.a href="/" className="flex items-center gap-3 group" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
      {variant === "wordmark" ? <Wordmark textSize={s.text} showTagline={showTagline} /> : null}
      {variant !== "wordmark" && variant !== "combination" && showText && <Wordmark textSize={s.text} showTagline={showTagline} />}
      {renderIcon()}
    </motion.a>
  );
}
