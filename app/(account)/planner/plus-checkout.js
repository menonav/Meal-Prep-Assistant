"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function PlusCheckout() {
  const router = useRouter();
  const requestActive = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    if (requestActive.current) return;
    requestActive.current = true;
    setPending(true);
    setError("");
    let redirecting = false;
    try {
      const response = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (response.status === 409) {
        setError("Plus is already active. Refreshing your access…");
        router.refresh();
        return;
      }
      if (!response.ok || typeof data?.url !== "string") {
        throw new Error(data?.error || "Couldn’t open checkout. Try again.");
      }
      window.location.assign(data.url);
      redirecting = true;
    } catch (failure) {
      setError(failure.message);
    } finally {
      if (!redirecting) {
        requestActive.current = false;
        setPending(false);
      }
    }
  }

  return <div className="fridge-unlock">
    <button type="button" className="planner-primary" onClick={startCheckout} disabled={pending}>
      {pending ? "Opening Stripe…" : "Upgrade to Plus"}
    </button>
    {error && <p role="status">{error}</p>}
  </div>;
}
