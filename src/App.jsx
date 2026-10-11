import { Component, useEffect } from "react";
import { Link, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import Home from "./pages/Home";
import Search from "./pages/Search";
import Cart from "./pages/Cart";
import ProductDetail from "./pages/ProductDetail";
import Stores from "./pages/Stores";
import Auth from "./pages/Auth";
import AuthConfirm from "./pages/AuthConfirm";
import ResetPassword from "./pages/ResetPassword";
import Account from "./pages/Account";
import Contact from "./pages/Contact";
import About from "./pages/About";
import Admin from "./pages/Admin";
import PageShell from "./components/layout/PageShell";
import Toaster from "./components/ui/Toaster";
import LogoutOverlay from "./components/ui/LogoutOverlay";
import { EmptyState } from "./components/ui/States";

import { useAuth } from "./context/AuthContext";
import { useLang } from "./context/LanguageContext";
import { toast } from "./lib/toast";
import { safeNext } from "./lib/authUtils";

/* Greets the user (once per tab) right after sign-in. */
function WelcomeWatcher() {
  const { user, displayName } = useAuth();
  const { t } = useLang();
  useEffect(() => {
    if (!user) return;
    const key = `narxtop_welcomed_${user.id}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* ignore */ }
    toast(t("auth.welcome", { name: displayName }), { confetti: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  return null;
}

/* Remembers every signed-in user in MongoDB (shown in the admin panel). Once per tab session. */
function UserSync() {
  const { user, session } = useAuth();
  const token = session?.access_token;
  useEffect(() => {
    if (!user?.id || !token) return;
    const key = `narxtop_synced_${user.id}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* ignore */ }
    fetch("/api/users/sync", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => { try { sessionStorage.removeItem(key); } catch { /* ignore */ } });
  }, [user?.id, token]);
  return null;
}

/* After Google OAuth the browser lands on "/"; send the user where they wanted to go. */
function PostAuthRedirect() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!user || pathname !== "/") return;
    try {
      const next = sessionStorage.getItem("narxtop_next");
      if (next) { sessionStorage.removeItem("narxtop_next"); navigate(safeNext(next), { replace: true }); }
    } catch { /* ignore */ }
  }, [user, pathname, navigate]);
  return null;
}

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
  return null;
}

function NotFound() {
  const { t } = useLang();
  return <PageShell><EmptyState icon="compass" title={t("p.notFound")} action={<Link to="/" className="nt-btn nt-btn-primary">{t("nav.home")}</Link>} /></PageShell>;
}

class Boundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error("UI crashed:", error); }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="nt-state" role="alert"><h3>Something went wrong</h3><button type="button" className="nt-btn nt-btn-primary" onClick={() => { this.setState({ error: null }); window.location.assign("/"); }}>Reload</button></div>;
  }
}

export default function App() {
  const location = useLocation();
  const path = location.pathname.replace(/\/+$/, "") || "/";
  return (
    <Boundary>
      <ScrollTop />
      <Routes location={{ ...location, pathname: path }}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/confirm" element={<AuthConfirm />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/account" element={<Account />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/about" element={<About />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
      </Routes>
      <UserSync />
      <WelcomeWatcher />
      <PostAuthRedirect />
      <Toaster />
      <LogoutOverlay />
    </Boundary>
  );
}
