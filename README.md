# Spendly (FinanceTracker)

A mobile-first personal finance app: expenses, income, budgets, bills, recurring payments, debts,
bank accounts and transfers, savings goals and net worth, for one person or a shared household.

Data lives in the browser (`localStorage`). Signing in with Firebase is optional, and so is backing
up to Google Drive or OneDrive, which is also how two devices stay in sync.

## How it is built

- **One file app.** The whole React app is in `app-v3.html`. React 18 and Babel load from a CDN and
  JSX is compiled in the browser, so there is no build step.
- **`index.html` must stay byte-identical to `app-v3.html`.** Edit `app-v3.html`, then copy it over.
  CI fails if they differ.
- **Styles** are in `src/styles/spendly.css` (the current design) and `src/styles/App.css`.
- **`serve.js`** is a small Node static server. It injects the Firebase and OAuth config from
  environment variables into the page, refuses dotfiles, and handles the Contact Us form.
- **`demo/`** is the clickable demo (mock data only) opened from "Try the demo" on the login screen.

## Run it locally

```bash
npm install
node serve.js          # http://localhost:5000
```

With no environment variables set, the app runs in local-only mode: the account and all data stay
in this browser. To turn on sign-in and cloud backup, set these before starting the server:

| Variable | Used for |
|---|---|
| `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID` | Firebase sign-in |
| `GOOGLE_OAUTH_CLIENT_ID` | Google Drive backup |
| `MICROSOFT_CLIENT_ID` | OneDrive backup |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `SUPPORT_EMAIL` | Contact Us emails |
| `REPLIT_DEPLOYMENT` | Set by Replit in a deployment; hides dev-only pages such as `scripts/cloud-sync-test.html` |

## Test

```bash
npm test
```

Jest runs the suites in `tests/`. `tests/helpers/loadInlineClasses.js` pulls the service classes
(`DataService`, `ValidationUtils`, `DateUtils`, ...) out of `app-v3.html` and runs them in a sandbox,
so tests exercise the real app code. GitHub Actions runs the same suite on every push and pull request.

## Deploy

Replit runs `node serve.js` on port 5000 (see `.replit`). After pulling new commits, run
`npm install` before starting the server, in case a new dependency was added.
