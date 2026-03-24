import { ReactNode } from "react";

interface DashboardCardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

const DashboardCard = ({ title, description, children, className = "" }: DashboardCardProps) => (
  <div className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`}>
    {(title || description) && (
      <div className="px-6 py-4 border-b border-gray-50">
        {title && <h3 className="text-sm font-semibold text-gray-900">{title}</h3>}
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

export default DashboardCard;
