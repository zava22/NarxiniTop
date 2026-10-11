import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

/* The profile photo lives in MongoDB (server/avatar.js). A copy is kept in localStorage so the
 * photo appears instantly on the next visit while the server copy is being fetched. */
const avatarCache = (id) => `narxtop_avatar_${id}`;
const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

/*
 * IMPORTANT — these URLs must be allowed in
 * Supabase → Authentication → URL Configuration → Redirect URLs
 * (see SETUP.md). Otherwise the link in the confirmation email
 * opens an error page.
 */
const confirmUrl = () => `${window.location.origin}/auth/confirm`;

export function getDisplayName(user) {
  if (!user) return "";

  const meta = user.user_metadata || {};

  return (
    meta.name ||
    meta.given_name ||
    meta.full_name?.split(" ")[0] ||
    user.email?.split("@")[0] ||
    ""
  );
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const [avatar, setAvatarState] = useState(null); // data URL stored in MongoDB
  const tokenRef = useRef(null);
  tokenRef.current = session?.access_token ?? null;

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Failed to get session:", error);
      }

      if (mounted) {
        setSession(data?.session ?? null);
        setUser(data?.session?.user ?? null);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(newSession ?? null);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /* ---------------------- PROFILE PHOTO (MongoDB) ---------------------- */
  // Whenever someone signs in (or the page reloads while signed in) fetch their saved photo.
  const userId = user?.id ?? null;
  const hasToken = Boolean(session?.access_token);
  useEffect(() => {
    if (!userId) { setAvatarState(null); return; }
    let cancelled = false;
    try { const cached = localStorage.getItem(avatarCache(userId)); if (cached) setAvatarState(cached); } catch { /* ignore */ }
    if (!hasToken) return;
    fetch("/api/avatar", { headers: authHeader(tokenRef.current) })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body?.success) return;
        setAvatarState(body.avatar ?? null);
        try { body.avatar ? localStorage.setItem(avatarCache(userId), body.avatar) : localStorage.removeItem(avatarCache(userId)); } catch { /* quota */ }
      })
      .catch(() => { /* server offline: keep the cached photo */ });
    return () => { cancelled = true; };
  }, [userId, hasToken]);

  const saveAvatar = useCallback(async (dataUrl) => {
    const res = await fetch("/api/avatar", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader(tokenRef.current) },
      body: JSON.stringify({ image: dataUrl }),
    });
    if (!res.ok) throw new Error(`avatar ${res.status}`);
    setAvatarState(dataUrl);
    try { if (userId) localStorage.setItem(avatarCache(userId), dataUrl); } catch { /* quota */ }
  }, [userId]);

  const removeAvatar = useCallback(async () => {
    const res = await fetch("/api/avatar", { method: "DELETE", headers: authHeader(tokenRef.current) });
    if (!res.ok) throw new Error(`avatar ${res.status}`);
    setAvatarState(null);
    try { if (userId) localStorage.removeItem(avatarCache(userId)); } catch { /* ignore */ }
  }, [userId]);

  /* ----------------------------- SIGN UP ----------------------------- */
  const signUp = useCallback(
    async ({ name, secondName, phone, email, password }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: confirmUrl(),
          data: {
            name,
            second_name: secondName,
            phone,
          },
        },
      });

      if (error) throw error;

      // Supabase returns a user with no identities (and no error) when
      // the e-mail is already registered — treat it as an error.
      if (data?.user && data.user.identities?.length === 0) {
        throw new Error("User already registered");
      }

      return data;
    },
    []
  );

  /* ----------------------- RESEND CONFIRMATION ----------------------- */
  const resendConfirmation = useCallback(async (email) => {
    const { data, error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: confirmUrl() },
    });

    if (error) throw error;
    return data;
  }, []);

  /* ----------------------------- SIGN IN ----------------------------- */
  const signIn = useCallback(async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }, []);

  /* ------------------------------ GOOGLE ------------------------------ */
  const signInWithGoogle = useCallback(async (next) => {
    try { if (next) sessionStorage.setItem("narxtop_next", next); } catch { /* ignore */ }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) throw error;
    return data;
  }, []);

  /* ----------------------------- SIGN OUT ----------------------------- */
  const signOut = useCallback(async () => {
    try { if (userId) localStorage.removeItem(avatarCache(userId)); } catch { /* ignore */ }
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    setSession(null);
    setUser(null);
  }, [userId]);

  /* -------------------------- PASSWORD RESET -------------------------- */
  const sendPasswordRecovery = useCallback(async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/reset-password` }
    );

    if (error) throw error;
    return data;
  }, []);

  const updatePassword = useCallback(async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
    return data;
  }, []);

  /* --------------------------- UPDATE PROFILE --------------------------- */
  const updateProfile = useCallback(async (fields) => {
    const { data, error } = await supabase.auth.updateUser({ data: fields });

    if (error) throw error;
    if (data?.user) setUser(data.user);
    return data;
  }, []);

  const value = useMemo(
    () => ({
      session,
      user,
      loading,
      isAuthenticated: Boolean(user),
      recovery,
      displayName: getDisplayName(user),
      avatar,
      saveAvatar,
      removeAvatar,

      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      resendConfirmation,
      sendPasswordRecovery,
      updatePassword,
      updateProfile,
    }),
    [
      avatar,
      saveAvatar,
      removeAvatar,
      session,
      user,
      loading,
      recovery,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      resendConfirmation,
      sendPasswordRecovery,
      updatePassword,
      updateProfile,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
