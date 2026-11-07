import AuthForm from "../../components/auth-form";
import { authConfigurationIssue } from "../../../lib/auth/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log in | Meal Prep Assistant" };

export default function LoginPage() {
  return <AuthForm mode="login" available={!authConfigurationIssue()} />;
}
