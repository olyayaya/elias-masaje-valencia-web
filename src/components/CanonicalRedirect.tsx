import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { normalizePathname } from "@/lib/canonical-url";

/**
 * Keeps in-app navigations on canonical paths (no trailing slash, lowercase,
 * no duplicate slashes) using a history replace so no extra entry is created.
 */
const CanonicalRedirect = () => {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const canonical = normalizePathname(pathname);
    if (canonical !== pathname) {
      navigate(`${canonical}${search}${hash}`, { replace: true });
    }
  }, [pathname, search, hash, navigate]);

  return null;
};

export default CanonicalRedirect;
