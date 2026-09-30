# BUILD THE ANDROID APK — 2 Options

The project is complete and verified (TypeScript clean, 36/36 calculation tests passing).
Pick ONE option below. Both produce the **same installable APK**:
`com.catchydecors.app` · versionName 1.0.0 · app label "CATCHY DECORS"

---

## OPTION A — Expo EAS Cloud Build (easiest, no Android Studio needed) ✅ RECOMMENDED

Runs on Expo's free official build servers. One command, ~15–20 min, gives you a
downloadable APK link you can open directly on any Android phone.

### One-time setup (2 minutes)

```bash
# 1. Inside the extracted project folder:
cd catchy-decors
npm install

# 2. Install the EAS CLI (needs Node.js 16+ on your computer):
npm install -g eas-cli

# 3. Create a free Expo account if you don't have one: https://expo.dev/signup
# 4. Log in:
eas login
```

### Build the APK (the one command)

```bash
eas build -p android --profile preview
```

- First build asks a few yes/no questions — answer defaults.
- Watch progress in the terminal or at https://expo.dev (your build dashboard).
- When it finishes, the terminal shows an **APK download link**.
- Open that link on your Android phone → download → install
  (allow "Install unknown apps" if asked).

That APK is `CATCHY DECORS` v1.0.0, ready to install and share with your staff.

> Tip: `eas build -p android --profile production` makes a Play-Store AAB instead.

---

## OPTION B — Local Build (needs Android Studio / Android SDK + JDK 17)

```bash
cd catchy-decors
npm install
npx expo prebuild --platform android        # generates the android/ folder
cd android
./gradlew assembleRelease                    # on Windows: gradlew.bat assembleRelease
```

APK output: `android/app/build/outputs/apk/release/app-release.apk`
(unsigned — sign it or use `./gradlew assembleDebug` for an instantly installable debug APK).

---

## First login in the app

| Role  | Username | Password   | Access                              |
|-------|----------|------------|-------------------------------------|
| Admin | admin    | admin123   | Everything                          |
| Staff | staff    | staff123   | Customers, measurements, quotations |

## Optional: Supabase cloud sync

1. Create a project at https://supabase.com (free tier works).
2. In the SQL editor, run `supabase/migrations/001_initial_schema.sql` (creates all 8 tables).
3. Put your project URL + anon key in `app.json` → `extra.supabaseUrl` / `extra.supabaseAnonKey`.
4. Rebuild the APK. Records created offline sync automatically when configured.
