# Central Authentication Backend

This is the server-side authentication boundary for the scheduling applications.
This application lives in `apps/auth/`. The scheduling frontend is in `apps/web/`
and its business API is in `apps/api/`. The legacy prototype in
`prototypes/legacy-static/` is intentionally not treated as authenticated.

Dependencies remain managed separately with npm and this directory's
`package-lock.json`. From the repository root, install with
`pnpm deps` to install both applications, then `pnpm dev` to start the local
database, scheduling application and Auth together after configuring the environment
below. Ctrl+C stops both applications and the database started by that command;
a database that was already running is left running. Separate startup remains
available with `pnpm dev:api` and `pnpm dev:auth` (start the database first).
The existing `npm run dev` command inside this directory still works.

## Flow

1. A trusted application sends an unauthenticated user to `/login?redirect_to=<encoded trusted URL>`.
2. `/login` validates the destination against `TRUSTED_APP_ORIGINS`.
3. `/auth/sign-in` validates credentials through Supabase Auth.
4. Supabase SSR stores the session in an HttpOnly cookie. `SHARE_AUTH_COOKIE=true` is required before a production `.thainitrate.com` cookie domain is used.
5. Auth validates the session server-side with `supabase.auth.getUser()`. The scheduling API reads `/api/auth/session` and resolves the Supabase user ID through `users.azure_object_id` in its local PostgreSQL database; `users` and `roles` determine application access.
6. `/auth/logout` signs out globally and expires the Supabase session through the SSR cookie adapter.

## Environment

Create `apps/auth/.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the intended Supabase project. For
local development with the scheduling app, set
`TRUSTED_APP_ORIGINS=http://localhost:3000` and keep `SHARE_AUTH_COOKIE=false`.
The environment file stays in this application directory after the move and is
ignored by Git. Never put a Supabase service-role key in this application’s
browser-visible environment or cookies.

The root command `pnpm dev:auth` reads `AUTH_URL` from the root `.env` (or the
process environment), then uses that origin for both the listening port and
`AUTH_HOST`. If Windows reserves 3000/3001, use root `PORT=4000`,
`APP_ORIGIN=http://localhost:4000`, `AUTH_URL=http://localhost:4001`, and set
`AUTH_HOST=http://localhost:4001`, `TRUSTED_APP_ORIGINS=http://localhost:4000` in
this app's `.env.local`. Keep Supabase credentials unchanged. Microsoft sign-in
also needs the matching callback URL in the Supabase redirect allowlist.

`TRUSTED_APP_ORIGINS` must contain exact trusted origins. In development, local HTTP origins with ports are accepted; production redirects require HTTPS without non-default ports. Redirect paths are allowed, but untrusted origins, userinfo and protocol-relative URLs are rejected. Use the same hostname for the web app and Auth (for example, `localhost` for both): a host-only cookie set on `localhost` is not sent to `127.0.0.1`.

For production SSO, explicitly set `SHARE_AUTH_COOKIE=true` and `AUTH_COOKIE_DOMAIN=.thainitrate.com` only when every receiving subdomain is trusted and deployed with compatible Supabase SSR cookie settings. Keep it false for local and test environments.

## Authorization

Supabase Auth answers “who is this user?”. For the scheduling app, the API uses its local `users`, `roles` and employee/team records. Run `pnpm link-user` from the repository root to inspect links; an authorised administrator can then link the intended user to a Supabase UID. Authentication alone does not grant a scheduling role.

The `supabase/migrations/0001_authz.sql` schema and `requireAppAccess()` helper are retained from the earlier multi-application template. They are not the scheduling API's current authorization path. Do not apply that migration as a required step for running this demo.

API routes return `401` for missing or invalid sessions and `403` for authenticated users without a linked active application account. Do not accept user IDs, roles, or permissions from the browser.

## Integration checkpoint — 2026-10-30

Microsoft 365 routes from PR #20 are now located in `apps/auth`.
The login page keeps both Microsoft 365 and email/password sign-in.

For local development only, set this in the ignored `.env.local`:

```dotenv
DEV_ALLOWED_EMAIL_DOMAINS=thainitrate.com,example.com
```

This setting applies only when `NODE_ENV=development`. Other modes accept only
`thainitrate.com`; wildcard domains are not supported. Signing in does not itself
grant a scheduling role: the API still resolves the existing account link.

Automatic Microsoft-to-employee linking is disabled by default. The API flag
`ENABLE_MICROSOFT_AUTO_LINK=true` is reserved for a later approved decision.
Pending owner discussion: manual provisioning versus automatic email matching,
including who maintains employee email addresses and approves role assignments.
Do not enable it as part of routine setup. Existing demo links remain valid.

Microsoft sign-in still needs an interactive company-account/MFA check and a
matching Supabase redirect allowlist for the local callback. Do not describe the
whole SSO flow as verified based only on the initial OAuth redirect.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3001](http://localhost:3001) with your browser to see the result. Port 3001 keeps port 3000 free for `apps/api` (ShiftFlow), which reads this service's `sb-session` cookie.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
