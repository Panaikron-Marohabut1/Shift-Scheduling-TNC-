import { redirect } from "next/navigation";

import { getAuthConfig } from "@/lib/auth/config";
import { loginRedirectTarget } from "@/lib/auth/redirects";
import { getAuthenticatedUser } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ redirect_to?: string; error?: string }>;
};

function allowedDomainsText() {
  return getAuthConfig().allowedEmailDomains.map((domain) => `@${domain}`).join(", ");
}

function errorMessage(error: string) {
  if (error === "microsoft_unavailable") return "Microsoft 365 sign-in is not available right now. Try again or sign in with email.";
  if (error === "domain_not_allowed") return `Only ${allowedDomainsText()} accounts can sign in.`;
  if (error === "invalid_callback") return "Microsoft 365 sign-in was cancelled or failed. Try again.";
  return "Unable to sign in. Check your credentials and try again.";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectTo = loginRedirectTarget(params.redirect_to);
  const { user } = await getAuthenticatedUser();

  if (user) redirect(redirectTo);

  return (
    <main>
      <h1>Sign in</h1>
      <p>Use your {allowedDomainsText()} account.</p>
      {params.error ? <p role="alert">{errorMessage(params.error)}</p> : null}
      <form action="/auth/microsoft" method="post">
        <input type="hidden" name="redirect_to" value={redirectTo} />
        <button type="submit">Sign in with Microsoft 365</button>
      </form>
      <p>or sign in with email</p>
      <form action="/auth/sign-in" method="post">
        <input type="hidden" name="redirect_to" value={redirectTo} />
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}