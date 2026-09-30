# CATCHY DECORS — Integration Setup

Everything in this app works **offline with zero configuration**. The two integrations below are
optional and each needs **your own credentials** — they cannot be pre-filled by anyone else.

- **Google Sign-In + Drive backup** → needs your own OAuth client IDs (Section A)
- **Supabase cloud sync** → needs your own project URL + anon key (Section B)

> Neither integration can be verified end-to-end from outside your accounts. Treat both as
> "configured by you, then tested on your device".

---

## Section A — Google Sign-In & Drive Backup

The app signs in with Google and stores one backup file, `catchy-decors-backup.json`, in the
**private app-data folder** of your Drive (`drive.appdata` scope). Files in that folder are not
visible in the normal Drive listing and can only be touched by this app.

### A1. Create the Google Cloud project

1. Go to <https://console.cloud.google.com/> and create a project, e.g. `catchy-decors`.
2. **APIs & Services → Library** → search **Google Drive API** → **Enable**.

### A2. Configure the OAuth consent screen

1. **APIs & Services → OAuth consent screen**.
2. User type: **External** → Create.
3. App name `CATCHY DECORS`, support email = your email, developer contact = your email → Save.
4. **Scopes** → Add `.../auth/drive.appdata`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` → Save.
5. **Test users** → add the Google account you will sign in with. (While the app is in "Testing",
   only these accounts can sign in. Publish the app later to allow anyone.)

### A3. Get your Android SHA-1 fingerprint

```bash
npx eas-cli credentials        # choose: android → your project → Keystore: View
```

Copy the **SHA-1 Fingerprint** value. (If you build locally with `./gradlew assembleRelease`, get it
instead from the bundled debug keystore:)

```bash
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

### A4. Create the OAuth clients

**Client 1 — Android**

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Android**.
3. Package name: `com.catchydecors.app` (must match `app.json` exactly).
4. Paste the **SHA-1** from A3 → Create.

**Client 2 — Web** (used to obtain a refresh token so backups keep working after the first hour)

1. Create another OAuth client → Application type: **Web application**.
2. No redirect URIs are required for this flow → Create.
3. Copy the client ID.

### A5. Put the IDs into the app

Edit `app.json` → `expo.extra`:

```json
"extra": {
  "supabaseUrl": "",
  "supabaseAnonKey": "",
  "googleAndroidClientId": "1234567890-xxxxxxxx.apps.googleusercontent.com",
  "googleWebClientId": "1234567890-yyyyyyyy.apps.googleusercontent.com",
  "googleIosClientId": ""
}
```

Then rebuild (client IDs are baked in at build time):

```bash
npx eas-cli build -p android --profile preview
```

### A6. Use it

Open **Settings → Google Account & Drive Backup → Sign in with Google**.

- **Back up now to Google Drive** — writes/overwrites the backup file.
- **Restore from Google Drive** — shows a summary first, then overwrites local data on confirm.
- **Test Drive Connection** — confirms the token and lists backup files.
- **What gets backed up?** — lists every store (`customers`, `quotations`, measurements,
  accessories, business profile, template, cloud credentials are excluded).

### A7. Notes and limits

- Redirect URI used by the app is shown on the Diagnostics card, e.g. `catchydecors://oauthredirect`.
- Only **one** backup file is kept; each "Back up now" updates it in place.
- The access token expires hourly; the app refreshes it automatically when the Web client ID is
  present. Without one, you may need to sign in again.
- If sign-in returns "Access blocked", add your Google account under **Test users** (A2) — accounts
  not on that list are rejected while the consent screen is in Testing mode.

---

## Section B — Supabase Cloud Sync (manual)

### B1. Create the project

1. Go to <https://supabase.com/> → **New project**. Pick a region close to you (e.g. Mumbai).
2. Wait for provisioning to finish.

### B2. Create the schema

1. **SQL Editor → New query**.
2. Paste the entire contents of `supabase/002_schema_with_rls.sql` → **Run**.
3. The last statement returns `catchy_decors_tables = 5`. That confirms success.

<details>
<summary>What the script creates</summary>

- Tables: `customers`, `quotations`, `measurements`, `accessories`, `app_settings`
- Indexes on phone, customer_id and created_at
- `touch_updated_at()` trigger to maintain `updated_at`
- Row Level Security **enabled** on all five tables with an anon-access policy
- `quotations` stores `items`, `accessories`, `charges` and `gst` as `jsonb`, so the nested
  document structure round-trips without extra tables

</details>

### B3. Copy the credentials

**Project Settings → API**:

- **Project URL** → `https://<your-project>.supabase.co`
- **anon / public** key → the long `eyJ…` string

> Use the **anon** key, never the `service_role` key. The service key bypasses RLS and must never
> ship inside a mobile app.

### B4. Paste them into the app

**Settings → Cloud Sync (Supabase)**:

1. Paste **Project URL** and **Anon key** → **Save Credentials**.
2. Tap **Test Connection**. Expected: *"Connected successfully."*

Other messages and what they mean:

| Message | Meaning |
|---|---|
| Connected, but the "customers" table is missing | Step B2 was not run |
| Rejected — check the anon key and RLS policies | Wrong key, or policies altered |
| URL should look like https://<project>.supabase.co | Malformed URL |

### B5. Sync

- **Push Local → Cloud** — upserts every local record (`on conflict id do update`). Customers are
  pushed first so quotations keep their foreign keys.
- **Pull Cloud → Local** — merges cloud rows into this device; the cloud value wins per field.
- Each write also queues an entry, shown as "Queued changes", which Push drains.

### B6. Tightening security before multi-user use

The shipped policies allow the anon role full access, which suits a single business on trusted
devices. If several businesses will share one Supabase project, enable **Supabase Auth** and
replace each policy with an ownership check, for example:

```sql
alter table public.customers add column owner_id uuid default auth.uid();
drop policy "customers anon access" on public.customers;
create policy "customers own rows" on public.customers
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
```

Repeat for the other four tables, and switch the app's client from the anon key to a per-user
Supabase session token.

---

## Section C — Where customisation lives in the app

| What you want to change | Where |
|---|---|
| Business name, tagline, address, phone, email, GSTIN | Settings → **Business Profile** |
| Logo (gallery pick) | Settings → Business Profile → Logo |
| Bank / UPI details | Settings → Business Profile → Payment Details |
| Quotation numbering (prefix, separator, year, digits, start) | Settings → **Quotation & Invoice Template** |
| Document titles (QUOTATION / TAX INVOICE) | Template → Document Headings |
| Accent colour used across app + PDF | Template → Branding |
| Which table columns print (S.No, Area, Type, Width, Height) | Template → Table Columns |
| GST defaults, rate, HSN/SAC, tax label, GSTIN visibility | Template → GST Defaults |
| Terms, notes, footer, thank-you line, validity days | Template → Terms & Notes |
| Signature block and signatory label | Template → Sign-off |
| Per-quotation values (customer, items, quantities, prices, discount, GST on/off) | Quotation → open any quotation → edit inline |

Every one of these flows straight into the printed document: the logo you pick, the business profile,
library numbering, column toggles, accent colour, GST defaults and terms are read from Settings at
PDF/invoice generation time (the picked logo is embedded in the PDF header, no rebuild needed).

Every quotation screen saves through the same local store, so edits made any way remain visible in
Reports and in the PDF/WhatsApp share flows.
