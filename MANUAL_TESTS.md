# Manual test script

Run these checks against a **local Supabase project** after applying the repository migrations through `016_consent_version_v1.sql` and starting the frontend with the local Supabase URL and anon key. Use synthetic accounts and profile data. Do not run `seed.sql` against a remote project.

## Authentication and consent

1. With local email confirmation disabled, register a synthetic account and verify it reaches the member area.
2. With email confirmation enabled in a non-production test project, register another account, confirm the emailed link, and verify login succeeds only after confirmation.
3. From Login, open **Forgot your password?**, request a reset link, open it in the same browser, set and confirm a new password, then log in with it.
4. Try an expired or reused reset link and verify the error state offers a way to request another link.
5. Verify the signup consent checkboxes link to Privacy and Terms and record consent version `v1`.

## Settings and account deletion

1. In Settings, submit a valid password change and verify the new password works on the next login.
2. Submit a deletion request, first canceling once and then confirming it. Verify the request appears in the admin **Deletion requests** page.
3. Mark the request processed and verify its status and completion time update. Confirm the member account is not silently deleted by this action.

## Public contact and staff inbox

1. Open Contact while signed out. Submit empty fields, malformed email, and overlong values; verify validation prevents submission.
2. Submit one valid synthetic message and verify a success state appears and the form clears.
3. Submit repeatedly during the service rate limit window and verify the UI gives a wait-and-retry message if Supabase returns a rate-limit response.
4. As staff, open **Contact messages**, verify the submission content and timestamp, mark it handled, and verify its status changes.
5. As a non-staff account, try the staff message list/update through the API and verify access is denied by privileges/RLS.

## Reporting and blocking

1. Prepare two approved synthetic member profiles and sign in as one of them.
2. On the other profile’s detail page, report it with each available category and a description of at least 10 characters. Verify the report appears in the staff reports queue.
3. Cancel a block confirmation, then block the profile and verify the member returns to search.
4. Search as either member and verify the pair is absent from results. Open the other profile by its direct detail URL and verify it is unavailable.
5. Verify an unrelated member can still find both profiles.

## Homepage search

1. On the homepage, choose an age range and enter a city, then submit **Browse profiles**.
2. Verify navigation to `/app/search` includes `ageMin`, `ageMax`, and `city` query parameters and the search controls show those values.
3. Verify results respect the selected filters; try submitting without a city and verify only the selected ages are carried over.

## Legal pages

1. Open Privacy and Terms from the footer and signup form. Verify the structured sections render and links work on desktop and mobile widths.
2. Search the pages for bracketed fields and confirm they are filled and reviewed before production publication.
3. Confirm the version shown during signup is `v1` and that a new local signup records that version in consent records.
