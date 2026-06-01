import { useState } from "react"

interface DataPoint {
  label: string
  value: number
}

interface LineChartProps {
  data: DataPoint[]
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ""
  if (points.length === 1) return `M${points[0].x},${points[0].y}`
  let d = `M${points[0].x},${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2 >= points.length ? points.length - 1 : i + 2]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
  }
  return d
}

export function LineChart({ data }: LineChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const W = 400
  const H = 180
  const padL = 38
  const padR = 12
  const padT = 14
  const padB = 28
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const values = data.map((d) => d.value)
  const minVal = Math.min(...values, 0)
  const maxVal = Math.max(...values, 0)
  const range = maxVal - minVal || 1
  const paddedMin = minVal - range * 0.15
  const paddedMax = maxVal + range * 0.15
  const paddedRange = paddedMax - paddedMin || 1

  const toY = (v: number) => padT + chartH - ((v - paddedMin) / paddedRange) * chartH
  const toX = (_i: number, len: number) => {
    if (len < 2) return padL + chartW / 2
    return padL + (_i / (len - 1)) * chartW
  }

  const pts = data.map((d, i) => ({ x: toX(i, data.length), y: toY(d.value) }))
  const linePath = data.length < 2 ? '' : smoothPath(pts)
  const fillPath = data.length < 2 ? '' : linePath + ` L${pts[pts.length - 1].x},${padT + chartH} L${pts[0].x},${padT + chartH} Z`

  const yTicks = 4
  const yStep = (paddedMax - paddedMin) / yTicks

  const zeroY = toY(0)
  const hovered = hoverIdx !== null ? data[hoverIdx] : null
  const hoverPt = hoverIdx !== null ? pts[hoverIdx] : null

  return (
    <div className="w-full h-48 relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8AAEE0" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#8AAEE0" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="lineAreaGradRev" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#C96B6B" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#C96B6B" stopOpacity="0.05" />
          </linearGradient>
          <filter id="lineGlow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="pointGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const val = paddedMin + yStep * i
          const y = toY(val)
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} className="stroke-[#D5DEEF] dark:stroke-[#1F3250]" strokeWidth="1" />
              <text x={padL - 5} y={y + 3} textAnchor="end" className="fill-[#5F6F89] dark:fill-[#B1C9EF]" fontSize="9" fontFamily="monospace">
                {val >= 0 ? "+" : ""}{val.toFixed(1)}
              </text>
            </g>
          )
        })}

        {minVal < 0 && maxVal > 0 && (
          <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke="#8AAEE0" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
        )}

        <path d={fillPath} fill="url(#lineAreaGrad)" className="transition-all duration-700" />

        <path
          d={linePath}
          fill="none"
          stroke="#8AAEE0"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#lineGlow)"
          className="transition-all duration-700"
        />

        {hoverIdx !== null && hoverPt && (
          <>
            <line
              x1={hoverPt.x}
              y1={padT}
              x2={hoverPt.x}
              y2={padT + chartH}
              stroke="#8AAEE0"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.4"
              className="transition-all duration-200"
            />
            <rect
              x={hoverPt.x - 56}
              y={hoverPt.y - 42}
              width={112}
              height={34}
              rx="6"
              className="fill-[#FFFFFF] dark:fill-[#1B2A41] stroke-[#D5DEEF] dark:stroke-[#1F3250] stroke-1 transition-all duration-200"
            />
            <text x={hoverPt.x} y={hoverPt.y - 28} textAnchor="middle" className="fill-[#5F6F89] dark:fill-[#B1C9EF]" fontSize="9" fontFamily="monospace">
              {hovered!.label}
            </text>
            <text x={hoverPt.x} y={hoverPt.y - 14} textAnchor="middle" className="fill-[#1B2A41] dark:fill-[#FFFFFF]" fontSize="11" fontFamily="monospace" fontWeight="700">
              {hovered!.value >= 0 ? "+" : ""}{hovered!.value.toFixed(1)}h
            </text>
          </>
        )}

        {pts.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hoverIdx === i ? "5" : "3.5"}
              className={`transition-all duration-200 ${hoverIdx === i ? "fill-[#8AAEE0]" : "fill-[#FFFFFF] dark:fill-[#081120]"}`}
              stroke={data[i].value >= 0 ? "#5B9B7A" : "#C96B6B"}
              strokeWidth={hoverIdx === i ? "2.5" : "2"}
              filter={hoverIdx === i ? "url(#pointGlow)" : undefined}
              style={{ cursor: "pointer" }}
            />
            <circle
              cx={p.x}
              cy={p.y}
              r="10"
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          </g>
        ))}

        {data.map((d, i) => {
          const x = toX(i, data.length)
          return (
            <text key={i} x={x} y={H - 4} textAnchor="middle" className="fill-[#5F6F89] dark:fill-[#B1C9EF]" fontSize="9" fontFamily="monospace">
              {d.label}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
