---
name: android-cicd
description: "Automated Android CI/CD pipeline to Google Play — supports TWA, React Native, Flutter, and native Android. Run npx android-cicd to set up keystore generation, GitHub Secrets, and a multi-stage workflow (internal/alpha/beta/production) with auto-bump versionCode."
risk: safe
source: community
date_added: "2026-05-12"
license: MIT
metadata:
  author: ezescholz
  version: "1.0.0"
  npm: android-cicd
---

# Skill: android-cicd

## Purpose

Set up a complete, multi-stage Android CI/CD pipeline that automatically builds and publishes to Google Play via GitHub Actions. Supports TWA (Trusted Web Activity / Bubblewrap), React Native, Flutter, and native Android (Gradle) projects.

## When to Use

- The project has an Android app tracked in a GitHub repository
- No CI/CD pipeline exists yet for the Android build
- Goal: automate publishing to Google Play on every push to `main` and on version tags
- User wants to avoid manual `versionCode` bumping

---

## Quick Start

Run the interactive setup wizard from the root of the target project:

```sh
npx android-cicd
```

The wizard handles: framework detection → keystore generation → GitHub Secrets → workflow scaffold.

---

## Prerequisites

Before running the wizard, ensure:

- Node.js ≥ 18
- JDK 17 installed with `keytool` accessible (`JAVA_HOME` set, or installed via Eclipse Adoptium / Android Studio)
- [`gh` CLI](https://cli.github.com) installed and authenticated (`gh auth login`)
- App already created in [Google Play Console](https://play.google.com/console) — at least **one manual AAB/APK upload** done (required before the API can publish)
- App enrolled in **Play App Signing** (Google manages the signing key; you manage the upload key)
- Google Play Android Developer API enabled in Google Cloud Console
- Service account JSON key downloaded (see Manual Steps below)

---

## Framework Detection

The wizard auto-detects the framework from the project directory structure:

| Condition | Detected framework |
|---|---|
| `pubspec.yaml` contains `flutter:` | `flutter` |
| `android/app/build.gradle` exists + `package.json` has `react-native` dep | `react-native` |
| `android-root-app/build.gradle` or `twa-manifest.json` or `.bubblewrap/config.json` exists | `twa` |
| `app/build.gradle` exists | `native` |
| `android/app/build.gradle` exists (fallback) | `native` |

The user can override the detected framework during the wizard.

---

## Multi-Stage Pipeline

The scaffolded workflow publishes to different tracks based on the git ref:

| Git event | Google Play track |
|---|---|
| Push to `main` | `internal` |
| Tag matching `v*-alpha` (e.g. `v1.2-alpha`) | `alpha` |
| Tag matching `v*-beta` (e.g. `v1.2-beta`) | `beta` |
| Tag matching `v*` (e.g. `v1.2.0`) | `production` |
| Manual `workflow_dispatch` | User-selectable (internal / alpha / beta / production) |

To release to production:
```sh
git tag v1.2.0
git push origin v1.2.0
```

---

## Auto-Bump versionCode

On every push to `main`, CI automatically:

1. Reads the current `versionCode` from the version file for the detected framework
2. Increments it by 1
3. Commits the change with `[skip ci]` (prevents re-triggering the workflow)
4. Pushes the commit back to `main`

Version file by framework:

| Framework | Version file | Field |
|---|---|---|
| TWA | `android-root-app/build.gradle` | `versionCode` |
| React Native | `android/app/build.gradle` | `versionCode` |
| Flutter | `pubspec.yaml` | `version: x.y.z+N` (the `+N` build number) |
| Native | `app/build.gradle` | `versionCode` |

For tag-based builds (alpha / beta / production), auto-bump does **not** run — the tag represents a pinned commit. Increment the version manually before tagging.

---

## Required GitHub Secrets

The wizard sets these automatically via `gh secret set`:

| Secret | Description |
|---|---|
| `KEYSTORE_FILE` | Base64-encoded upload keystore (`.jks`) |
| `KEYSTORE_PASSWORD` | Keystore password |
| `KEY_ALIAS` | Key alias (e.g. `upload`) |
| `KEY_PASSWORD` | Key password (usually same as `KEYSTORE_PASSWORD`) |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Full JSON content of the service account key |

---

## Signing Configuration

### TWA / Native Android

Add to your `build.gradle` (see `templates/gradle/signing.gradle`):

```groovy
android {
    signingConfigs {
        release {
            storeFile file("keystore.jks")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEY_ALIAS")
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            minifyEnabled true
            signingConfig signingConfigs.release
        }
    }
}
```

> **Never** set `org.gradle.java.home` in `gradle.properties` — it breaks Linux CI runners.

### Flutter

The CI workflow creates `android/key.properties` at build time (from secrets) and cleans it up after. Your `android/app/build.gradle` should read from it:

```groovy
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

---

## Manual Steps (Cannot Be Automated)

### 1. Create the service account

1. [Google Cloud Console](https://console.cloud.google.com) → your project → **IAM & Admin** → **Service Accounts**
2. **Create service account** → name: `github-play-publisher` → **Done** (no roles needed)
3. Click the service account → **Keys** tab → **Add key** → **Create new key** → **JSON** → download

### 2. Enable the Play API

Google Cloud Console → **APIs & Services** → search **Google Play Android Developer API** → **Enable**

### 3. Invite the service account in Play Console

1. Play Console → **Users and permissions** → **Invite new user**
2. Email: `github-play-publisher@YOUR-PROJECT.iam.gserviceaccount.com`
3. Account-level permissions:
   - ✅ Release apps to testing tracks
   - ✅ Manage testing tracks and edit testers
4. **Apply**

### 4. First manual upload

Google Play requires at least one manually uploaded AAB before the API can publish. If this is a brand-new app, upload the first build from your local machine before running the CI pipeline.

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `Java home supplied is invalid` | `org.gradle.java.home` hardcoded in `gradle.properties` | Remove that line |
| `signed with the wrong key` | Keystore in secret doesn't match Play's registered upload key | Update `KEYSTORE_FILE` secret |
| `The caller does not have permission` | Service account missing permissions or API not enabled | Re-check Manual Steps 2 and 3 |
| `Upload failed — wrong versionCode` | versionCode not incremented (tag-based build) | Increment versionCode manually before tagging |
| `shallow update not allowed` | Shallow git checkout when pushing version bump | Workflow uses `fetch-depth: 0` — verify the checkout step |
| Workflow not triggering on tag | Tag not pushed to remote | Run `git push origin TAG_NAME` |
| `gh: command not found` | gh CLI not installed | Install from https://cli.github.com |
| `keytool not found` | JDK not installed or not on PATH | Set `JAVA_HOME` or install JDK 17 |

---

## Recovering a Lost Upload Keystore

If the app uses **Play App Signing** (recommended):

1. Generate a new keystore: `npx android-cicd` and choose "I already have a keystore: No"
2. Export the PEM certificate:
   ```sh
   keytool -export -rfc -keystore upload.jks -alias ALIAS -storepass PASSWORD -file cert.pem
   ```
3. Play Console → app → **App integrity** → **App signing** → **Request upload key reset**
4. Select "I forgot my password" → upload `cert.pem`
5. Wait 1–2 business days for Google approval
6. Update the `KEYSTORE_FILE` secret with the new keystore base64

---

## Manually Bumping the Version (Tag Releases)

Before pushing a tag for alpha / beta / production:

**TWA / Native / React Native** — edit `build.gradle`:
```groovy
versionCode 8   // increment
versionName "1.2.0"
```

**Flutter** — edit `pubspec.yaml`:
```yaml
version: 1.2.0+8
```

Then tag and push:
```sh
git add .
git commit -m "chore: bump version to 1.2.0"
git tag v1.2.0
git push origin main --tags
```
