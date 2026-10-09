import { redirect } from "next/navigation";

import { loginRedirectTarget } from "@/lib/auth/redirects";
import { getAuthenticatedUser } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ redirect_to?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectTo = loginRedirectTarget(params.redirect_to);
  const { user } = await getAuthenticatedUser();

  if (user) redirect(redirectTo);

  return (
    <main>
      <h1>Sign in</h1>
      {params.error ? <p role="alert">Unable to sign in. Check your credentials and try again.</p> : null}
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