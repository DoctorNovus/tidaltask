# TidalTask

**TidalTask** is an ADHD-focused task management app built to help manage the unique challenges of ADHD. Created by Daniel Wedding ([@DoctorNovus](https://github.com/DoctorNovus)), it provides structured, supportive tools for day-to-day organization.

## Features

- **Task scheduling** — prioritize and organize tasks with due dates and repeating schedules
- **Reminders** — local and server-pushed notifications
- **Tags & groups** — filter tasks by custom labels or shared team groups
- **Calendar view** — week and day views with task occurrence tracking
- **Priority levels** — High / Medium / Low priority with visual indicators
- **Announcements** — in-app What's New feed for release notes
- **Two-factor authentication** — TOTP-based 2FA with AES-256-GCM encrypted secrets at rest
- **Passkeys** — WebAuthn passkey registration and login
- **API keys** — per-user API keys (stored as SHA-256 hashes) for programmatic access
- **OAuth 2.0** — authorization server with PKCE support for third-party integrations
- **MCP endpoint** — Model Context Protocol endpoint at `POST /mcp` for AI assistant integration
- **Data portability** — full GDPR Art. 20 data export
- **Right to erasure** — GDPR Art. 17 / CCPA-compliant account + data deletion
- **PWA + native** — installable as a web app or native iOS/Android app

## Download

| iOS | Android |
| :-: | :-: |
| [<img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" height="44">](https://apps.apple.com/us/app/sequenced-adhd-manager/id6478198104) | [<img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" height="44">](https://play.google.com/store/apps/details?id=com.ottegi.sequenced) |

---

## Repository layout

```
sequenced/
├── packages/
│   ├── app/          # React + Vite + Capacitor frontend
│   └── api/          # Node/Express backend
├── .habitat/         # Habitat deployment config (docker-compose + dockerfiles)
├── docker/           # Nginx config for production
└── .env              # Root env vars (picked up by Habitat/Docker Compose)
```

---

## Local development

### Prerequisites

- **Node.js** ≥ 22 and **npm** ≥ 10
- **MongoDB** running locally (or any MongoDB URI)

### 1. Clone and install

```bash
git clone https://github.com/DoctorNovus/sequenced.git
cd sequenced
npm install
```

### 2. Configure environment

Create `.env` in the repo root (used by the API in dev):

```bash
# Required
DATABASE_URL=mongodb://localhost:27017/sequenced
PORT=8080
SESSION_SECRET=<random 64-char string>
APP_URL=http://localhost:5173
FRONTEND_URL=http://localhost:5173

# 2FA — encrypt TOTP secrets at rest (AES-256-GCM)
TOTP_ENCRYPTION_KEY=<64-char hex string (32 random bytes)>

# WebAuthn / Passkeys
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME=TidalTask
```

For email features (password reset, welcome emails):

```bash
RESEND_API_KEY=re_...
RESET_FROM_EMAIL=no-reply@yourdomain.com
WELCOME_FROM_EMAIL=no-reply@yourdomain.com
WELCOME_EMAIL_SUBJECT=Welcome to TidalTask
```

For Discord webhook logging (optional):

```bash
UPDATES_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### 3. Start the API

```bash
cd packages/api
npm run dev        # starts on http://localhost:8080
```

### 4. Start the frontend

In a second terminal:

```bash
cd packages/app
npm run dev        # starts on http://localhost:5173
```

The frontend auto-detects `DEV` mode and points to `http://localhost:8080`.

---

## Production deployment

### Prerequisites

- A Linux server with **Docker** and **Docker Compose** installed
- A domain with DNS pointing to the server
- TLS certificates in `/etc/letsencrypt` (e.g. via Certbot)

### 1. Clone on the server

```bash
git clone https://github.com/DoctorNovus/sequenced.git /root/sequenced
cd /root/sequenced
npm install
```

### 2. Configure environment

Create `.env` in `/root/sequenced`:

```bash
# Required
DATABASE_URL=mongodb://mongouser:mongopassword@mongo:27017/sequenced?authSource=admin
SESSION_SECRET=<random 64-char string>
APP_URL=https://api.yourdomain.com
PORT=8080
FRONTEND_URL=https://yourdomain.com

# 2FA encryption — generate once and keep secret
TOTP_ENCRYPTION_KEY=<64-char hex string (32 random bytes)>

# WebAuthn / Passkeys
WEBAUTHN_RP_ID=yourdomain.com
WEBAUTHN_RP_NAME=TidalTask

# Email (Resend)
RESEND_API_KEY=re_...
RESET_FROM_EMAIL=no-reply@yourdomain.com
WELCOME_FROM_EMAIL=no-reply@yourdomain.com
WELCOME_EMAIL_SUBJECT=Welcome to TidalTask

# Discord webhook logging (optional)
UPDATES_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

> **Note:** If `TOTP_ENCRYPTION_KEY` is set, the API automatically migrates any plaintext TOTP secrets to AES-256-GCM on startup. If it is not set and users have 2FA enabled, a warning is logged.

### 3. Configure Nginx

Edit `docker/nginx/conf.d/` to match your domain and certificate paths. The stack includes an Nginx reverse proxy that routes:

- `yourdomain.com` → frontend (port 80 internally)
- `api.yourdomain.com` → API (port 8080 internally)

### 4. Deploy

```bash
npm run deploy
```

This runs `habitat build && habitat start` — builds the Docker images and starts all containers (API, frontend, MongoDB, Nginx) in one step.

For subsequent deployments, pull and redeploy:

```bash
git pull && npm run deploy
```

### Individual habitat commands

```bash
npm run habitat:build   # build images only
npm run habitat:start   # start containers
npm run habitat:stop    # stop containers
```

### Continuous deployment (GitHub Actions)

Push to `main` to trigger the `deploy.yml` workflow. It SSHs into the server, pulls the latest code, and redeploys. Required GitHub secrets:

| Secret | Description |
|---|---|
| `DEPLOY_SSH_KEY` | Private SSH key for the server |

---

## iOS distribution

### Prerequisites

- macOS with **Xcode** and **Xcode Command Line Tools**
- **Ruby** ≥ 2.6 and **Bundler** (`gem install bundler`)
- An **Apple Developer** account with a distribution certificate and provisioning profile
- An **App Store Connect API key** (Key ID, Issuer ID, and `.p8` file)

### One-time setup

Create `packages/app/.env.asc.local` (gitignored):

```bash
ASC_KEY_ID=XXXXXXXXXX
ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# Provide one of:
ASC_KEY_PATH=~/private_keys/AuthKey_XXXXXXXXXX.p8
# or base64-encoded content of the .p8:
# ASC_KEY_CONTENT=$(base64 -i AuthKey_XXXXXXXXXX.p8)
```

Install Ruby gems:

```bash
cd packages/app
npm run fastlane:setup
```

### Build + open in Xcode

```bash
cd packages/app
npm run open:ios:full    # builds web, syncs Capacitor, opens Xcode
```

### Upload to TestFlight

Builds the app, auto-increments the build number against the latest TestFlight build, and uploads:

```bash
npm run upload:ios:asc
```

### Submit for App Review

Same as above but also waits for processing and submits directly to App Review with auto-generated release notes from git commits:

```bash
npm run release:ios:asc
```

### CI (GitHub Actions)

The `ios-release` job in `deploy.yml` runs on every push to `main`. Required secrets:

| Secret | Description |
|---|---|
| `IOS_CERTIFICATE_BASE64` | Base64-encoded `.p12` distribution certificate |
| `IOS_CERTIFICATE_PASSWORD` | Password for the `.p12` |
| `IOS_PROVISIONING_PROFILE_BASE64` | Base64-encoded `.mobileprovision` |
| `ASC_KEY_ID` | App Store Connect API key ID |
| `ASC_ISSUER_ID` | App Store Connect issuer ID |
| `ASC_KEY_CONTENT` | Base64-encoded `.p8` API key content |

---

## Version management

All platform version files are updated in one command:

```bash
cd packages/app
npm run bump-version 3.2.0
```

This updates:

| File | Field |
|---|---|
| `packages/app/package.json` | `"version"` |
| `ios/App/App.xcodeproj/project.pbxproj` | `MARKETING_VERSION` (both build configs) |
| `android/app/build.gradle` | `versionName` + `versionCode` (e.g. `3.2.0` → `30200`) |

---

## Security & compliance

- **GDPR Art. 13/17/20/32** and **CCPA** — users can export or permanently delete all their data from the app settings
- **TOTP secrets** are encrypted with AES-256-GCM at rest; plaintext secrets are migrated automatically on first server startup after `TOTP_ENCRYPTION_KEY` is set
- **API keys** are stored as SHA-256 hashes — raw values are shown only once at generation time
- **Session cookies** are `httpOnly`, `secure` (production), `sameSite: lax`
- **Security headers** — `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
- **Auth rate limiting** — 20 failed attempts per 15 minutes on login, register, and password reset endpoints

---

## Contact

Questions, feedback, or bug reports: [support@tidaltask.app](mailto:support@tidaltask.app)
