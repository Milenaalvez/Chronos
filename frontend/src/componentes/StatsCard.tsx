import type { LucideIcon } from "lucide-react"

interface StatsCardProps {
  icon: LucideIcon
  title: string
  value: string
  subtitle: string
  trend?: "up" | "down"
  trendValue?: string
}

export function StatsCard({ icon: Icon, title, value, subtitle, trend, trendValue }: StatsCardProps) {
  return (
    <div className="flex flex-col gap-1 p-5 border-r border-default/10 last:border-r-0">
      <div className="flex items-center gap-2">
        <Icon size={13} strokeWidth={2} className="text-accent-blue shrink-0" />
        <span className="text-[11px] font-medium text-muted uppercase tracking-wider">{title}</span>
        {trend && trendValue && (
          <span className={`ml-auto flex items-center gap-0.5 text-[11px] font-medium ${trend === "up" ? "text-accent-green" : "text-accent-red"}`}>
            {trend === "up" ? "↑" : "↓"}{trendValue}
          </span>
        )}
      </div>
      <span className="text-2xl font-bold text-primary tracking-tight">{value}</span>
      <span className="text-[11px] text-secondary">{subtitle}</span>
    </div>
  )
}
