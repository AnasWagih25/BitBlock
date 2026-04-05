

interface CassetteMascotProps {
  size?: number;
  animate?: boolean;
  mood?: "happy" | "thinking" | "excited" | "idle";
  className?: string;
}

export default function CassetteMascot({
  size = 200,
  animate = true,
  mood = "happy",
  className = "",
}: CassetteMascotProps) {
  // We keep the component name as CassetteMascot for compatibility across the codebase,
  // but it now renders the "Bit" microcontroller companion character matching the theme.

  const renderFace = () => {
    switch (mood) {
      case "thinking":
        return (
          <>
            {/* Eyes straight line */}
            <rect x="32" y="42" width="12" height="6" fill="#F2F2F0" rx="3" />
            <rect x="56" y="42" width="12" height="6" fill="#F2F2F0" rx="3" />
            {/* Mouth small flat */}
            <rect x="44" y="56" width="12" height="4" fill="#B94FF0" rx="2" />
            {/* Thinking processing dot */}
            <circle cx="70" cy="36" r="3" fill="#9D27DE" className="animate-pulse" />
          </>
        );
      case "excited":
        return (
          <>
            {/* Eyes > < cuter */}
            <path d="M 32 38 L 42 45 L 32 52" stroke="#F2F2F0" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M 68 38 L 58 45 L 68 52" stroke="#F2F2F0" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {/* Mouth open shouting block */}
            <rect x="42" y="56" width="16" height="12" fill="#B94FF0" rx="6" />
          </>
        );
      case "idle":
        return (
          <>
            {/* Eyes blocky round */}
            <rect x="34" y="42" width="10" height="10" fill="#E0D8F0" rx="4" />
            <rect x="56" y="42" width="10" height="10" fill="#E0D8F0" rx="4" />
            {/* Mouth tiny pixel */}
            <circle cx="50" cy="60" r="2.5" fill="#9D27DE" />
          </>
        );
      case "happy":
      default:
        return (
          <>
            {/* Eyes ^ ^ cuter & softer */}
            <path d="M 30 48 L 38 38 L 46 48" stroke="#F2F2F0" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M 54 48 L 62 38 L 70 48" stroke="#F2F2F0" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            
            {/* Cute pink blushes */}
            <ellipse cx="28" cy="56" rx="6" ry="3.5" fill="#EE82EE" opacity="0.6" />
            <ellipse cx="72" cy="56" rx="6" ry="3.5" fill="#EE82EE" opacity="0.6" />
            
            {/* Mouth pixel smile */}
            <path d="M 44 54 Q 50 64 56 54" stroke="#B94FF0" strokeWidth="5" strokeLinecap="round" fill="none" />
          </>
        );
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${animate ? "animate-float" : ""} ${className}`}
      style={{ filter: "drop-shadow(0 0 20px rgba(157,39,222,0.4))" }}
    >
      <defs>
        {/* Deep tech screen gradient */}
        <radialGradient id="screenGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(157,39,222,0.25)" />
          <stop offset="100%" stopColor="#0A0A0A" />
        </radialGradient>
        
        {/* Metal chassis subtle gradient */}
        <linearGradient id="chassisGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3D1455" />
          <stop offset="100%" stopColor="#1A0628" />
        </linearGradient>
      </defs>

      {/* Top microchip pins */}
      <rect x="30" y="6" width="6" height="12" fill="#B94FF0" rx="1" />
      <rect x="47" y="3" width="6" height="15" fill="#9D27DE" rx="1" />
      <rect x="64" y="6" width="6" height="12" fill="#B94FF0" rx="1" />

      {/* Bottom microchip pins */}
      <rect x="30" y="82" width="6" height="12" fill="#B94FF0" rx="1" />
      <rect x="47" y="82" width="6" height="15" fill="#9D27DE" rx="1" />
      <rect x="64" y="82" width="6" height="12" fill="#B94FF0" rx="1" />
      
      {/* Left microchip pins */}
      <rect x="6" y="35" width="12" height="6" fill="#B94FF0" rx="1" />
      <rect x="5" y="59" width="13" height="6" fill="#9D27DE" rx="1" />

      {/* Right microchip pins */}
      <rect x="82" y="35" width="12" height="6" fill="#B94FF0" rx="1" />
      <rect x="82" y="59" width="13" height="6" fill="#9D27DE" rx="1" />

      {/* Main CPU Chassis Block - Softer corners (rx=14) */}
      <rect x="15" y="15" width="70" height="70" rx="14" fill="url(#chassisGrad)" stroke="#9D27DE" strokeWidth="2.5" />
      
      {/* Corner tech accents / screws */}
      <circle cx="24" cy="24" r="2.5" fill="#0A0A0A" />
      <circle cx="76" cy="24" r="2.5" fill="#0A0A0A" />
      <circle cx="24" cy="76" r="2.5" fill="#0A0A0A" />
      <circle cx="76" cy="76" r="2.5" fill="#0A0A0A" />

      {/* Internal circuitry lines */}
      <path d="M 24 50 L 29 50 M 71 50 L 76 50" stroke="rgba(157,39,222,0.4)" strokeWidth="2" strokeLinecap="round" />
      <path d="M 50 24 L 50 29 M 50 71 L 50 76" stroke="rgba(157,39,222,0.4)" strokeWidth="2" strokeLinecap="round" />

      {/* Deep Screen Area - Softer corners */}
      <rect x="25" y="28" width="50" height="44" rx="10" fill="url(#screenGlow)" stroke="#9D27DE" strokeWidth="1.5" />
      
      {/* Screen Glare reflection */}
      <path d="M 28 30 L 72 30 L 72 40 L 28 35 Z" fill="rgba(242,242,240,0.03)" />
      
      {/* Scanline subtle lines inside screen */}
      <line x1="28" y1="36" x2="72" y2="36" stroke="rgba(242,242,240,0.03)" strokeWidth="1.5" />
      <line x1="28" y1="46" x2="72" y2="46" stroke="rgba(242,242,240,0.03)" strokeWidth="1.5" />
      <line x1="28" y1="56" x2="72" y2="56" stroke="rgba(242,242,240,0.03)" strokeWidth="1.5" />
      <line x1="28" y1="66" x2="72" y2="66" stroke="rgba(242,242,240,0.03)" strokeWidth="1.5" />

      {/* Render the dynamic face */}
      {renderFace()}
      
    </svg>
  );
}
