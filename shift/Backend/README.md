# Central Authentication Backend

This is the server-side authentication boundary for the scheduling applications.
The existing `shift/` prototype is intentionally not treated as authenticated.

## Flow

1. A trusted application sends an unauthenticated user to `/login?redirect_to=<encoded trusted URL>`.
2. `/login` validates the destination against `TRUSTED_APP_ORIGINS`.
3. `/auth/sign-in` validates credentials through Supabase Auth.
4. Supabase SSR stores the session in an HttpOnly cookie. `SHARE_AUTH_COOKIE=true` is required before a production `.thainitrate.com` cookie domain is used.
5. The application validates the session server-side with `supabase.auth.getUser()` and then checks `application_memberships`.
6. `/auth/logout` signs out globally and expires the Supabase session through the SSR cookie adapter.

## Environment

Copy `.env.example` to `.env.local` and supply the Supabase project URL and publishable key. Never put a Supabase service-role key in this application’s browser-visible environment or cookies.

`TRUSTED_APP_ORIGINS` must contain exact HTTPS origins. Paths are allowed after those origins; ports, alternate protocols, external hosts, userinfo, and protocol-relative URLs are rejected.

For production SSO, explicitly set `SHARE_AUTH_COOKIE=true` and `AUTH_COOKIE_DOMAIN=.thainitrate.com` only when every receiving subdomain is trusted and deployed with compatible Supabase SSR cookie settings. Keep it false for local and test environments.

## Authorization

Supabase Auth answers “who is this user?”. The `supabase/migrations/0001_authz.sql` schema stores administrator-managed profiles and per-application roles. Authentication does not grant application access automatically; future app routes must call `getAuthenticatedUser()` and `requireAppAccess()` on the server.

API routes should return `401` for missing or invalid sessions and `403` for authenticated users without a provisioned role. Do not accept user IDs, roles, or permissions from the browser.This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
