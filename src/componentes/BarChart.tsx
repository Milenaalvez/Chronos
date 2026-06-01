import { useState } from "react"

interface DataPoint {
  label: string
  value: number
}

interface BarChartProps {
  data: DataPoint[]
}

export function BarChart({ data }: BarChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-64 text-xs text-muted">
        Nenhum dado disponível.
      </div>
    )
  }

  const values = data.map((d) => d.value)
  const hasNeg = values.some((v) => v < 0)
  const hasPos = values.some((v) => v > 0)
  const maxAbsVal = Math.max(...values.map(Math.abs), 1)
  const posCount = values.filter((v) => v > 0).length
  const negCount = values.filter((v) => v < 0).length
  const zeroCount = values.filter((v) => v === 0).length

  return (
    <div className="w-full flex flex-col gap-5">
      <div className="w-full h-64 relative">
        <svg viewBox="0 0 600 240" className="w-full h-full overflow-visible" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="barPos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5B9B7A" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#5B9B7A" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="barNeg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C96B6B" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#C96B6B" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="barPosHover" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5B9B7A" stopOpacity="1" />
              <stop offset="100%" stopColor="#5B9B7A" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="barNegHover" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C96B6B" stopOpacity="1" />
              <stop offset="100%" stopColor="#C96B6B" stopOpacity="0.6" />
            </linearGradient>
            <filter id="barShadow">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.15" />
            </filter>
          </defs>

          <g opacity="0.05">
            {[0.25, 0.5, 0.75].map((frac) => (
              <line
                key={frac}
                x1={40}
                y1={30 + (240 - 60) * (1 - frac)}
                x2={590}
                y2={30 + (240 - 60) * (1 - frac)}
                stroke="#B1C9EF"
                strokeWidth="1"
              />
            ))}
          </g>

          {hasNeg && hasPos && (
            <line x1={40} y1={150} x2={590} y2={150} stroke="#8AAEE0" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.25" />
          )}

          {data.map((d, i) => {
            const barArea = 530
            const barCount = data.length
            const maxBarWidth = 32
            const barWidth = Math.min(maxBarWidth, (barArea / barCount) * 0.6)
            const gap = barCount > 1 ? (barArea - barWidth * barCount) / (barCount - 1) : 0
            const x = 45 + i * (barWidth + gap)
            const zeroY = 150
            const barH = (Math.abs(d.value) / maxAbsVal) * 110
            const y = d.value >= 0 ? zeroY - barH : zeroY
            const isHovered = hoverIdx === i
            const fill = d.value >= 0
              ? (isHovered ? "url(#barPosHover)" : "url(#barPos)")
              : (isHovered ? "url(#barNegHover)" : "url(#barNeg)")

            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(barH, 2)}
                  rx={4}
                  fill={fill}
                  filter={isHovered ? "url(#barShadow)" : undefined}
                  className="transition-all duration-200"
                  style={{ cursor: "pointer" }}
                />
                <rect
                  x={x - 6}
                  y={15}
                  width={barWidth + 12}
                  height={210}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                />
                {isHovered && (
                  <rect
                    x={x - 2}
                    y={y - 1}
                    width={barWidth + 4}
                    height={Math.max(barH, 2) + 2}
                    rx={5}
                    fill="none"
                    className="stroke-white/60 dark:stroke-white/30"
                    strokeWidth="1.5"
                  />
                )}
                {(isHovered || data.length <= 20) && (
                  <text
                    x={x + barWidth / 2}
                    y={235}
                    textAnchor="middle"
                    className="fill-muted"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {d.label}
                  </text>
                )}
                {isHovered && (
                  <text
                    x={x + barWidth / 2}
                    y={d.value >= 0 ? y - 10 : y + barH + 16}
                    textAnchor="middle"
                    className={`fill-current ${d.value >= 0 ? "text-[#5B9B7A]" : "text-[#C96B6B]"}`}
                    fontSize="11"
                    fontFamily="monospace"
                    fontWeight="700"
                  >
                    {d.value >= 0 ? "+" : ""}{d.value.toFixed(1)}h
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="flex items-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm bg-[#5B9B7A]" />
          <span className="text-secondary">
            <strong className="text-primary">{posCount}</strong> dia{posCount !== 1 ? "s" : ""} positivo{posCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm bg-[#C96B6B]" />
          <span className="text-secondary">
            <strong className="text-primary">{negCount}</strong> dia{negCount !== 1 ? "s" : ""} negativo{negCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm bg-muted/30" />
          <span className="text-secondary">
            <strong className="text-primary">{zeroCount}</strong> neutro{zeroCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  )
}
