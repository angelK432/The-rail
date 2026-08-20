import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import TheRail from "./TheRail.jsx";
import { supabase } from "./supabaseClient.js";

// Backs window.storage with a per-user row in Supabase instead of the
// browser's local storage, so items persist across devices and survive
// Safari/iOS clearing home-screen app data.
function wireStorage() {
  window.storage = {
    async get(key) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_storage")
        .select("value")
        .eq("user_id", user.id)
        .eq("key", key)
        .maybeSingle();
      if (error || !data) return null;
      return { key, value: data.value, shared: false };
    },
    async set(key, value) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { error } = await supabase
        .from("user_storage")
        .upsert({ user_id: user.id, key, value, updated_at: new Date().toISOString() });
      if (error) return null;
      return { key, value, shared: false };
    },
    async delete(key) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      await supabase.from("user_storage").delete().eq("user_id", user.id).eq("key", key);
      return { key, deleted: true, shared: false };
    },
    async list(prefix) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { keys: [], prefix, shared: false };
      const { data } = await supabase.from("user_storage").select("key").eq("user_id", user.id);
      const keys = (data || []).map((r) => r.key).filter((k) => !prefix || k.startsWith(prefix));
      return { keys, prefix, shared: false };
    },
  };
}

function AuthGate() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div style={centerStyle}>Loading…</div>;
  }

  if (!session) {
    async function handleSubmit(e) {
      e.preventDefault();
      setBusy(true);
      setMessage("");
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setMessage(error.message);
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) setMessage(error.message);
        else setMessage("Check your email to confirm your account, then log in.");
      }
      setBusy(false);
    }

    return (
      <div style={centerStyle}>
        <form onSubmit={handleSubmit} style={{ width: 280, display: "flex", flexDirection: "column", gap: 10 }}>
          <h2 style={{ fontFamily: "sans-serif", margin: "0 0 6px" }}>The Rail</h2>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={inputStyle}
          />
          <button type="submit" disabled={busy} style={btnStyle}>
            {mode === "login" ? "Log in" : "Sign up"}
          </button>
          {message && <p style={{ fontSize: 13, color: "#8A4A66", margin: 0 }}>{message}</p>}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setMessage("");
            }}
            style={linkStyle}
          >
            {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
          </button>
        </form>
      </div>
    );
  }

  wireStorage();
  return (
    <>
      <button onClick={() => supabase.auth.signOut()} style={signOutStyle}>
        Log out
      </button>
      <TheRail />
    </>
  );
}

const centerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
  fontFamily: "sans-serif",
  padding: 20,
  boxSizing: "border-box",
};
const inputStyle = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1.5px solid #E8DCEE",
  fontSize: 16,
  fontFamily: "sans-serif",
};
const btnStyle = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "none",
  background: "#B48FD1",
  color: "#fff",
  fontWeight: 600,
  fontFamily: "sans-serif",
  cursor: "pointer",
};
const linkStyle = {
  background: "none",
  border: "none",
  color: "#9384A3",
  fontSize: 12.5,
  textDecoration: "underline",
  cursor: "pointer",
  fontFamily: "sans-serif",
};
const signOutStyle = {
  position: "fixed",
  top: 10,
  right: 10,
  zIndex: 20,
  padding: "6px 12px",
  borderRadius: 999,
  border: "1.5px solid #E8DCEE",
  background: "#fff",
  fontSize: 12,
  cursor: "pointer",
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>
);
