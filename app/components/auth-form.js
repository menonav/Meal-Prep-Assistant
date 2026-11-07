"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "../../lib/auth/client";

export default function AuthForm({ mode, available }) {
  const signingUp = mode === "signup";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (pending || !available) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    setNotice("");
    try {
      const credentials = {
        email: String(form.get("email")).trim(),
        password: String(form.get("password")),
      };
      const result = signingUp
        ? await authClient.signUp.email({
          ...credentials,
          name: String(form.get("name")).trim(),
          callbackURL: `${window.location.origin}/dashboard`,
        })
        : await authClient.signIn.email({ ...credentials, rememberMe: true });
      if (result.error) {
        setError(signingUp
          ? "We couldn’t create your account. Check your details, or log in if you already have an account."
          : "We couldn’t log you in. Check your email and password, and verify your email if required.");
        return;
      }
      // Confirm a real session before navigating; some Neon projects require verification.
      const { data: session, error: sessionError } = await authClient.getSession();
      if (sessionError) {
        setError("We couldn’t confirm your session. Please try logging in again.");
      } else if (session?.user) {
        // Full navigation discards any cached protected pages from a previous account.
        window.location.assign("/dashboard");
      } else {
        setNotice(signingUp
          ? "Account created. If Neon requires verification, check your inbox, then return here to log in."
          : "Please verify your email, then try logging in again.");
      }
    } catch {
      setError("Account access is temporarily unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="account-card">
      <p className="eyebrow">Your kitchen, your account</p>
      <h1>{signingUp ? "Create your account." : "Welcome back."}</h1>
      <p>{signingUp ? "A little less planning starts here." : "Log in to Meal Prep Assistant."}</p>
      {!available && <p role="alert">Account access is being set up. Please try again later.</p>}
      <form onSubmit={submit}>
        <fieldset disabled={pending || !available}>
          {signingUp && <label>Your name<input name="name" autoComplete="name" required maxLength={100} /></label>}
          <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
          <label>Password<input name="password" type="password" autoComplete={signingUp ? "new-password" : "current-password"} required minLength={signingUp ? 8 : undefined} maxLength={128} aria-describedby={signingUp ? "password-help" : undefined} /></label>
          {signingUp && <p id="password-help" className="account-help">Use at least 8 characters.</p>}
          <button className="button" type="submit">{pending ? "Please wait…" : signingUp ? "Sign up" : "Log in"}</button>
        </fieldset>
        {error && <p className="account-error" role="alert">{error}</p>}
        {notice && <p role="status">{notice} {signingUp && <Link href="/login">Go to login</Link>}</p>}
      </form>
      <p>{signingUp ? "Already have an account?" : "New here?"} <Link href={signingUp ? "/login" : "/signup"}>{signingUp ? "Log in" : "Create an account"}</Link></p>
    </section>
  );
}
