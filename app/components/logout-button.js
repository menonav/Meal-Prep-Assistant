"use client";

import { useState } from "react";
import { authClient } from "../../lib/auth/client";

export default function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign-out failed");
      window.location.replace("/login");
    } catch {
      setError("We couldn’t log you out. Please try again.");
      setPending(false);
    }
  }

  return <div><button className="button" disabled={pending} onClick={logout}>{pending ? "Logging out…" : "Log out"}</button>{error && <p role="alert">{error}</p>}</div>;
}
