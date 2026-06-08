import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Gate for owner-only routes. While the initial session check is in flight we
 * render a spinner (never the protected UI), then either render children or
 * bounce to /login — preserving the attempted path so login can return there.
 */
const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};

export default RequireAuth;
