import Link from "next/link";
import "./account.css";

export const metadata = { robots: { index: false, follow: false } };

export default function AccountLayout({ children }) {
  return <div className="wrap account-shell"><header><Link className="brand" href="/">Meal Prep Assistant</Link><Link className="account-home" href="/">Back to home ↗</Link></header><main className="account-main">{children}</main></div>;
}
