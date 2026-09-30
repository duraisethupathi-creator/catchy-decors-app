# CATCHY DECORS — Business Management App

Interior decoration **measurement & quotation** app for Android, built with
**React Native + Expo + TypeScript + Expo Router**.

**Package:** `com.catchydecors.app` · **Version:** 1.0.0 · **Min Android:** 7.0 (API 24)

## Quick Start

```bash
npm install
npx expo start          # dev server (scan QR with Expo Go)
```

## Build the Android APK

### Option A — EAS Build (recommended, no local Android SDK needed)

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview     # builds installable APK
```

The committed `eas.json` already defines:
- `preview` → **APK** (direct install / share)
- `production` → AAB (Play Store)

### Option B — Local build

Requires Android Studio / Android SDK + JDK 17+:

```bash
npx expo prebuild --platform android
cd android
./gradlew assembleRelease     # APK at android/app/build/outputs/apk/release/
```

## Login (first run)

| Role | Username | Password | Access |
|------|----------|----------|--------|
| Admin | `admin` | `admin123` | Full access |
| Staff | `staff` | `staff123` | Customers, measurements, quotations |

## Calculation Engine (`src/utils/calculations.ts`)

| Product | Formula |
|---|---|
| Curtains | `((Width / 20) × (Height + 10)) / 40` |
| Blinds / Wallpaper / Headboard / Flooring / Mosquito Net | `(Width × Height) / 144` |
| Accessories | `Curtain Width / 12` |
| Fitting | `No. of Windows × Price per Window` |
| Stitching | `Qty = Curtain Width / 2`, `Total = Qty × Price` |
| Any row | `Total = Quantity × Price` |

All results are rounded to 2 decimals, invalid values become 0, negatives clamp to 0.
Verified by 36 automated unit tests (`npm run test:calc`).

## Offline-first + Supabase Sync

- All data is stored locally in **AsyncStorage** — the app is 100% functional offline.
- Drafts (measurements, accessories, other charges) auto-persist per customer.
- To enable cloud sync: add your Supabase URL + anon key in `app.json` → `extra`,
  then run `supabase/migrations/001_initial_schema.sql` in your Supabase SQL editor
  (creates all 8 tables: users, customers, measurements, accessories, quotations,
  quotation_items, additional_charges, payments).

## PDF & Sharing

Quotations export as branded A4 PDFs (`CatchyDecors_Quotation_CD-YYYY-NNNN.pdf`)
via `expo-print`, shareable through the Android share sheet (WhatsApp, Email, Save).

## Project Structure

See the `app/` (screens) and `src/` (services, utils, components, constants, types)
directories — mirroring the requested architecture exactly.
