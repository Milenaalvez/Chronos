import { type ReactNode } from "react"
import { Loader2 } from "lucide-react"

interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  loading?: boolean
}

export function PageHeader({ title, subtitle, actions, loading }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex items-start gap-3 min-w-0">
        <span className="w-[3px] h-5 rounded-full bg-accent-blue shrink-0 mt-[7px]" />
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-primary">{title}</h1>
            {loading && <Loader2 size={16} className="animate-spin text-accent-purple shrink-0" />}
          </div>
          {subtitle && (
            <p className="text-sm text-secondary mt-1">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
