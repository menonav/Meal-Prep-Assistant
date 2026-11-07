"use client";

export default function AccountError({ reset }) {
  return <section className="account-card"><h1>Let’s try again.</h1><p role="alert">We couldn’t reach your account. Please try again in a moment.</p><button className="button" onClick={reset}>Try again</button></section>;
}
