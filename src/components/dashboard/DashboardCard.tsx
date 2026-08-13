import { ReactNode } from "react";

interface DashboardCardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Optional controls rendered on the right of the header (filters, refresh…). */
  action?: ReactNode;
}

const DashboardCard = ({ title, description, children, className = "", action }: DashboardCardProps) => (
  <div className={`bg-card rounded-xl border border-border shadow-sm ${className}`}>
    {(title || description || action) && (
      <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-4">
        <div>
          {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);


export default DashboardCard;
