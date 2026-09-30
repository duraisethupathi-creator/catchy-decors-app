# CATCHY DECORS — Complete Build Project

Production-ready source for the CATCHY DECORS Android app (`com.catchydecors.app`, v1.0.0).
Includes all screens, calculation engine, editable final quotation, GST invoice, branded PDF export,
offline-first storage (AsyncStorage) with Supabase sync layer, and the pre-generated `android/` project.

## What's inside

```
catchy-decors/
├── app/                    # Expo Router screens
│   ├── (auth)/login.tsx            # Admin/Staff login
│   ├── (tabs)/                     # dashboard, customers, quotations, reports, settings
│   ├── customer/new.tsx            # customer entry/edit
│   ├── measurement/new.tsx         # measurements (curtains, blinds, wallpaper, …)
│   └── quotation/                  # new.tsx, [id].tsx, preview.tsx (fully editable)
├── src/
│   ├── components/common/          # UI kit + Logo (brand image wired)
│   ├── constants/                  # colors (navy/red/orange/gold), company, products
│   ├── services/                   # auth, customer, measurement, quotation, pdf, db, supabase
│   ├── types/                      # customer, measurement, quotation
│   └── utils/                      # calculations, currency, validation, sha256
├── android/                # Pre-generated native project (Gradle 8.10.2)
├── supabase/               # SQL migration (001_initial_schema.sql)
├── scripts/                # Unit-test suite (test-calculations.ts — 51 tests)
├── assets/images/          # New brand logo (CD monogram) wired into icon/splash/adaptive
├── app.json                # Expo config · package com.catchydecors.app
├── eas.json                # EAS profiles: preview (APK) · production (AAB)
└── package.json            # Expo SDK ~52.0.46 · React Native 0.76.9
```

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22.x LTS | project verified on v22.23.2 |
| JDK | **17** | required by RN 0.76 / AGP 8.6 — do NOT use JDK 21+ |
| Android SDK | platform **android-35**, build-tools **35.0.0** | or just use Option A (cloud) |
| Gradle | 8.10.2 | auto-downloaded by the wrapper |

Versions above are read from the project's own files: `android/build.gradle`
(compileSdk 35 · targetSdk 34 · minSdk 24 · buildTools 35.0.0 · Kotlin 1.9.25),
`android/gradle/wrapper/gradle-wrapper.properties` (Gradle 8.10.2), `package.json`
(Expo ~52.0.46, RN 0.76.9).

## Option A — Cloud build (recommended: no local SDK/RAM needed)

```bash
npm install
npm install -g eas-cli
eas login                      # free Expo account
eas build -p android --profile preview
```

~15–20 min → download the signed APK from the build page → install on phone
(enable "install unknown apps"). `eas.json` already pins Node 22.11.0 / npm 10.9.1.

## Option B — Local build

```bash
npm install                    # MUST run before Gradle (autolinking needs node_modules)
cd android
./gradlew assembleRelease      # Windows: gradlew.bat assembleRelease
```

APK output: `android/app/build/outputs/apk/release/app-release.apk`
(signed with the included `debug.keystore` — fine for internal distribution).

### Low-memory machines (< 8 GB RAM)

If the build is killed or freezes, edit `android/gradle.properties`:

```properties
org.gradle.jvmargs=-Xmx1100m -XX:MaxMetaspaceSize=400m
reactNativeArchitectures=arm64-v8a
```

`arm64-v8a` alone covers all modern Android phones and roughly halves native build work.
The shipped defaults (`-Xmx2048m`, all 4 ABIs) suit normal 8 GB+ machines.

## Verify before building (optional)

```bash
npm run typecheck              # TypeScript — expect 0 errors
npm run test:calc              # 51 unit tests — expect "51 passed, 0 failed"
```

## Default logins

- Admin — `admin` / `admin123`
- Staff — `staff` / `staff123`

## Signing for Play Store (later)

The release build uses the bundled debug keystore. For Google Play, generate a real
keystore (`keytool -genkeypair -v -keystore catchy-decors.keystore -alias cd -keyalg RSA -keysize 2048 -validity 10000`),
add a `signingConfigs.release` block in `android/app/build.gradle`, and keep the keystore private.

## App identity

- Package: `com.catchydecors.app` · Version 1.0.0 (versionCode 1)
- Brand: Navy `#101D4A` · Red `#ED1C24` · Orange `#FF7A00` · Gold `#FFC107`
- Company: CATCHY DECORS, Karur · +91 91591 94440 · www.catchydecors.in
