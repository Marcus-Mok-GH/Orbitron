# Orbitron

LLM gateway app (OpenRouter-style UI). React/Vite SPA + Express server (`server/`), deployed as a Zo user service.

## Auth: Neon Auth (Managed Better Auth)

- Neon project `orbitron-db` (`wandering-surf-93944145`), branch `br-noisy-truth-bbbro8l2`, PG 18.
- Auth provider: `better_auth` (Managed Better Auth), base URL
  `https://ep-young-tree-bbzkcbzu.neonauth.c-15.us-east-1.aws.neon.tech/neondb/auth`.
- Frontend: `@neon/neon-js` `createAuthClient`. JWT is at `session.token` (NOT `access_token`) in this SDK version.
- Server: `server/neonAuth.ts` verifies the JWT (`jose`, remote JWKS from `NEON_AUTH_JWKS_URL`), `server/auth.ts`
  upserts the user into `public.users` and `server/authRoutes.ts` serves `/api/auth/*`.
- Frontend calls use `authFetch` (`src/lib/auth.tsx`) which adds `Authorization: Bearer <jwt>`.
- Dashboard chat/images still use the auto-provisioned dashboard API key (`src/lib/dashboardKey.ts`).
- Trusted origin for `https://orbitron-marker.zocomputer.io` was added via Neon API `POST .../auth/domains`
  (without it, sign-in returns 403 from cross-origin origin checks). localhost is allowed (`allow_localhost=true`).
- `public.users` is the app-side mirror of `neon_auth.user` keyed by JWT `sub`; sessions list reads `neon_auth.session`.

## Env / secrets

- `DATABASE_URL`, `NEON_AUTH_JWKS_URL`, `VITE_NEON_AUTH_URL` (build-time for the SPA).
- Local dev: `.env.local` (gitignored). Production values are set on the Zo user service `orbitron` (svc_ANg3PuoY44c).
- Provider keys (OPENAI/ANTHROPIC/GOOGLE) are NOT set — /api/status shows providers down until added.

## Build & run

- `npm run dev` — tsx server + vite (port 5000, dev only).
- `npm run build && npm start` — builds `dist/` + `dist-server/`, serves SPA from Express.
- Deployed at https://orbitron-marker.zocomputer.io (public Zo user service, http mode, local_port 5000).
- To redeploy after code changes: rebuild (`npm run build` with `VITE_NEON_AUTH_URL` exported) then
  `update_user_service(service_id="svc_ANg3PuoY44c")` to restart.

## Security settings

- `src/components/SecuritySettings.tsx` owns password changes, email verification, sessions and account deletion; `src/pages/ResetPassword.tsx` provides the public email-code reset flow.
- Use Neon browser SDK session controls; session cookies live on Neon's domain. Session IDs come from `getSession()`, never a user-agent guess. `/api/auth/sessions` returns metadata and full IDs, never session tokens.
- `src/lib/emailSecurity.ts` calls the supported Email OTP endpoints through the SDK's typed `$fetch` (the bundled client types omit plugin helpers).
- Account deletion removes the Neon identity and app data in one database transaction. API keys cannot delete accounts; deleted identities must not be recreated by an unexpired JWT.
- MFA is unsupported by the configured managed provider. Auth-event webhooks are disabled, so do not present active sessions as complete login history.
- `npm run check:security` runs isolated integration checks without live credentials or database changes.
