import { useAuth } from "../../context/AuthContext";
import { GUEST_BROWSING } from "../../lib/constants";
import LockedContent from "./LockedContent";
import { Skeleton } from "./States";

/* Shows children to signed-in users; guests see the sign-up prompt. */
export default function Gate({ children, compact = false }) {
  const { isAuthenticated, loading } = useAuth();
  if (GUEST_BROWSING || isAuthenticated) return children;
  if (loading) return <Skeleton h={220} r={20} />;
  return <LockedContent compact={compact} />;
}
