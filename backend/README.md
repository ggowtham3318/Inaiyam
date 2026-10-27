# Inaiyam Matrimony backend

Supabase backend for a free matrimony application using Postgres, RLS, Auth, and
private Storage. The frontend API contract is documented in [BACKEND_API.md](./BACKEND_API.md).

Run the commands in this document from the `backend` directory.

## Local setup

```powershell
Set-Location backend
npx supabase start
npx supabase db reset
npx supabase gen types typescript --local > types/database.ts
```

Local seed data includes ten approved sample profiles (five men and five women), two
published success stories, and `seed-admin@example.local` with password
`LocalAdmin@12345`. All sample profile accounts use password `LocalUser@12345`;
their emails are `seed-man-01@example.local` through `seed-man-05@example.local`
and `seed-woman-01@example.local` through `seed-woman-05@example.local`. The sample
profiles have stable local-only accounts and include names, ages, cities, occupations,
and introductions for testing search and profile detail screens. Never use these
credentials outside local development.

Run the repeatable local integration suite by providing the local URL, publishable
key, and service-role key without committing them:

```powershell
$env:SUPABASE_URL = "http://127.0.0.1:54321"
$env:RLS_TEST_ALLOW_LOCAL = "true"
npx supabase status -o env | ForEach-Object {
  if ($_ -match '^ANON_KEY="?([^"]+)"?$')         { $env:SUPABASE_ANON_KEY = $Matches[1] }
  if ($_ -match '^SERVICE_ROLE_KEY="?([^"]+)"?$') { $env:SUPABASE_SERVICE_ROLE_KEY = $Matches[1] }
}
$env:SUPABASE_URL
$env:SUPABASE_ANON_KEY.Length
$env:SUPABASE_SERVICE_ROLE_KEY.Length
powershell -ExecutionPolicy Bypass -File .\tests\rls.ps1
```

To exercise the actual client signup and password-login endpoints, start the local
stack with migrations through `016_consent_version_v1.sql` applied, set the same
local environment variables, and run:

```powershell
$env:RLS_TEST_ALLOW_LOCAL = "true"
powershell -ExecutionPolicy Bypass -File .\tests\auth-smoke.ps1
```

The auth smoke test refuses non-loopback URLs and deletes its temporary user when
it finishes.

## Migrations

Migrations 001-008 establish the schema, RLS, moderation flow, private buckets, and
5 MB file limits. Migration 009 removes paid plans, subscriptions, payment ledgers,
and Razorpay dependencies. Migration 013 is a forward-only staging hardening change:
it restricts profile writes, restores consent, block, cursor-search, interest, contact,
and photo safeguards, and requires complete profile submissions. Apply it only after
a clean local replay and only to a separately verified isolated staging project.

## Production checklist

Before launch:

- Authenticate and link the intended Supabase project.
- Use `npx supabase db push`; never use `db reset` remotely.
- Enable email confirmations and signup in the Auth dashboard.
- Set minimum password length to 8.
- Set the production Site URL and redirect URLs.
- Expose the `app` schema through the API settings.
- Confirm all four buckets are private and have the migration 008 MIME/size limits.
- Configure backups, PITR, logs, retention, DPDP notices, consent, and deletion
  procedures with the product/legal owner.
- Run `tests/rls.ps1` against an isolated project using the gitignored root `.env` file.

No payment gateway, subscriptions, plans, messaging, or ID-document bucket is part
of this backend.
