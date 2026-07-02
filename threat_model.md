# Threat Model

## Project Overview

Personal Finance App is a browser-first finance tracker served as a static HTML/JS application by `serve.js`. In production, the main reachable surface is `app-v3.html`, which handles authentication, local persistence, backup export/import, and optional Google Drive / OneDrive sync entirely in the browser. Firebase authentication and Firestore profile storage are enabled only when related environment variables are present; otherwise the app falls back to local browser-only authentication.

## Assets

- **Financial records** — expenses, income, budgets, debts, goals, bills, and notes stored in browser storage and optionally synced to the user’s cloud drive. Exposure reveals sensitive personal financial history.
- **Authentication state** — Firebase sessions when configured, or locally stored account/session state when Firebase is absent. Compromise allows account impersonation within the app.
- **Cloud backup access tokens** — Google Drive and Microsoft Graph OAuth tokens stored in browser session state. Theft allows reading or overwriting cloud backups.
- **Backup archives** — exported JSON and CSV files contain a large portion of the user’s financial data and may be moved off-device.
- **Configuration and identity metadata** — display names, people lists, storage preferences, and backup ownership markers influence data isolation and restore behavior.

## Trust Boundaries

- **Browser UI to browser storage** — all user input eventually lands in `localStorage` or `sessionStorage`; the browser must be treated as hostile and user-controlled.
- **Browser to third-party identity/storage providers** — Firebase Auth, Firestore, Google Drive, Microsoft Graph, and exchange-rate API calls cross external trust boundaries and rely on safe token handling.
- **Browser to exported/imported files** — downloaded backups, uploaded backups, and CSV imports/exports cross from the app into external tools and back again.
- **Static server to client** — `serve.js` injects runtime config into HTML and serves static assets. Since the live app is client-heavy, any compromise of shipped JS affects all secrets and user data handled in-browser.
- **Production vs legacy/dev-only code** — `serve.js` does not expose the database CRUD classes under `server/`; treat `server/api.js`, `server/storage.js`, and `server/db.js` as out of production scope unless a live route or alternate runtime proves they are reachable.

## Scan Anchors

- **Production entry points:** `serve.js`, `app-v3.html`, `index.html`, `start.sh`
- **Highest-risk code areas:** auth and session logic in `app-v3.html` (`AuthUtils`, registration/login screens), cloud sync services (`GDriveService`, `OneDriveService`, `SyncService`), backup import/export helpers, and any browser-side file generation/parsing.
- **Public vs authenticated surfaces:** static app shell is public; app data views are gated only by client-side auth state; cloud sync operations require OAuth tokens.
- **Usually ignore unless reachability changes:** `server/api.js`, `server/storage.js`, `server/db.js`, `server/init-db.js`, `src/services/DataService.js` (older duplicate implementation), and workflow/test helpers.

## Threat Categories

### Spoofing

The app must only treat a user as authenticated when a real Firebase session exists or when a local-only mode intentionally grants access to that same device’s stored data. Any identity used to decide whether cloud backups belong to the current user must be resistant to client-side tampering, because the browser is fully attacker-controlled.

### Tampering

All imported backups, CSV uploads, and browser-stored state are attacker-controlled inputs. The application must validate and constrain those inputs before trusting them, and must not let imported data silently alter security-sensitive state or produce malicious files on export.

### Information Disclosure

The main disclosure risks are exposure of financial data, OAuth tokens, session state, and backup archives. The app must avoid leaking tokens to logs or the DOM, must scope cloud restore behavior to the correct user, and must not make exported files unexpectedly dangerous to open in spreadsheet tools.

### Denial of Service

Because parsing and storage happen in-browser, oversized or malformed backups and bulk uploads could freeze the UI or corrupt local state. External API calls should fail safely without locking users out of local data.

### Elevation of Privilege

There is no trusted server-side authorization layer on the main production path, so any feature that assumes client-side identity is trustworthy is high risk. The app must not rely on writable browser storage alone for privilege decisions, backup ownership checks, or account protection guarantees.
