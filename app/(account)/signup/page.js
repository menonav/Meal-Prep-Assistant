import AuthForm from "../../components/auth-form";
import { authConfigurationIssue } from "../../../lib/auth/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign up | Meal Prep Assistant" };

export default function SignupPage() {
  return <AuthForm mode="signup" available={!authConfigurationIssue()} />;
}
