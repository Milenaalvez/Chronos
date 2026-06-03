interface ClockIconProps {
  size?: number
  accent?: string
  className?: string
}

export function ClockIcon({ size = 48, accent: _accent, className }: ClockIconProps) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} fill="none">
      <circle cx="24" cy="24" r="21" stroke="#B1C9EF" strokeWidth="2.5" strokeDasharray="118 14" strokeDashoffset="16" strokeLinecap="round" />
      <line x1="24" y1="24" x2="24" y2="14" stroke="#F0F3FA" strokeWidth="3" strokeLinecap="round" />
      <line x1="24" y1="24" x2="33" y2="24" stroke="#F0F3FA" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
      <circle cx="24" cy="24" r="3" fill="#F0F3FA" />
    </svg>
  )
}

interface ChronosBrandProps {
  size?: "sm" | "md" | "lg" | "xl"
  variant?: "horizontal" | "inline"
  dark?: boolean
  showSubtitle?: boolean
}

const sizeMap = {
  sm: { icon: 28, title: "text-lg", subtitle: "text-[8px]" },
  md: { icon: 36, title: "text-xl", subtitle: "text-[9px]" },
  lg: { icon: 48, title: "text-3xl", subtitle: "text-[10px]" },
  xl: { icon: 56, title: "text-5xl", subtitle: "text-xs" },
}

export function ChronosBrand({ size = "md", variant = "horizontal", dark = true, showSubtitle = true }: ChronosBrandProps) {
  const s = sizeMap[size]
  const textColor = dark ? "text-[#F8FAFC]" : "text-[#0F172A]"
  const subColor = dark ? "text-[#94A3B8]" : "text-[#5F6F89]"
  const accent = dark ? "#60A5FA" : "#3B82F6"

  if (variant === "inline") {
    const parts = "CHRONOS".split("")
    return (
      <span className={`inline-flex items-center ${textColor} font-bold tracking-tight ${s.title}`}>
        {parts.map((ch, i) => {
          if (ch === "O") {
            return (
              <span key={i} className="inline-flex items-center mx-[-2px]">
                <ClockIcon size={parseInt(s.title) * 1.1} accent={accent} />
              </span>
            )
          }
          return <span key={i}>{ch}</span>
        })}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <div className="shrink-0">
        <ClockIcon size={s.icon} accent={accent} />
      </div>
      <div className="flex flex-col">
        <h1 className={`${s.title} font-bold leading-none tracking-tight ${textColor}`}>Chronos</h1>
        {showSubtitle && (
          <span className={`${s.subtitle} font-semibold uppercase tracking-[0.2em] mt-0.5 ${subColor}`}>Gestão de Pessoas</span>
        )}
      </div>
    </div>
  )
}

export function FaviconSvg({ size = 32 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="21" stroke="#B1C9EF" strokeWidth="2.5" strokeDasharray="118 14" strokeDashoffset="16" strokeLinecap="round" />
      <line x1="24" y1="24" x2="24" y2="14" stroke="#F0F3FA" strokeWidth="3" strokeLinecap="round" />
      <line x1="24" y1="24" x2="33" y2="24" stroke="#F0F3FA" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
      <circle cx="24" cy="24" r="3" fill="#F0F3FA" />
    </svg>
  )
}
