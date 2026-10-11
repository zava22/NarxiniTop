import { createClient } from "@supabase/supabase-js";

/*
 * Remember what the URL looked like BEFORE Supabase processes it.
 * When a user clicks the confirmation link in their email, Supabase
 * redirects to /auth/confirm with tokens (#access_token=...) or a code
 * (?code=...) — or with an error (#error=access_denied&error_code=otp_expired).
 * The Supabase client removes these from the address bar as soon as it has
 * read them, so the confirmation page needs this snapshot.
 */
const rawHash = window.location.hash.replace(/^#/, "");
const rawSearch = window.location.search.replace(/^\?/, "");
const urlParams = new URLSearchParams(`${rawSearch}&${rawHash}`);

export const initialUrlParams = {
  hasTokens:
    urlParams.has("access_token") ||
    urlParams.has("code") ||
    urlParams.has("token_hash"),
  error: urlParams.get("error_code") || urlParams.get("error") || null,
  errorDescription: urlParams.get("error_description") || null,
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing VITE_SUPABASE_URL (see .env.example)");
}

if (!supabasePublishableKey) {
  throw new Error(
    "Missing VITE_SUPABASE_PUBLISHABLE_KEY (see .env.example)"
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
