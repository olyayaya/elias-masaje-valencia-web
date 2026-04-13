import { ReactNode } from "react";

interface DashboardCardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

const DashboardCard = ({ title, description, children, className = "" }: DashboardCardProps) => (
  <div className={`bg-card rounded-xl border border-border shadow-sm ${className}`}>
    {(title || description) && (
      <div className="px-6 py-4 border-b border-border">
        {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

export default DashboardCard;
