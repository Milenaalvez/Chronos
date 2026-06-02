import type { ReactNode } from "react"

interface ChartCardProps {
  title: string
  subtitle?: string
  insight?: string
  children: ReactNode
}

export function ChartCard({ title, subtitle, insight, children }: ChartCardProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        {subtitle && <span className="text-[11px] text-secondary">{subtitle}</span>}
      </div>
      <div className="flex-1 flex flex-col items-center justify-center rounded-lg py-4 px-3">
        {children}
      </div>
      {insight && (
        <div className="text-[11px] text-secondary leading-relaxed">
          {insight}
        </div>
      )}
    </div>
  )
}
