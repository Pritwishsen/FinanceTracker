# Spendly (FinanceTracker)

## User Preferences

Preferred communication style: Simple, everyday language.

## Overview

A mobile-first personal finance app (expenses, income, budgets, bills, debts, bank accounts,
transfers, goals, net worth). See `README.md` for how to run, test and deploy it.

## Architecture (current)

- **Frontend:** the whole React 18 app is one file, `app-v3.html` (React, ReactDOM and Babel from
  a CDN, no build step). `index.html` is a byte-identical copy and must stay that way.
- **Storage:** the browser's `localStorage`. There is no database and no backend API.
- **Accounts and sync:** optional Firebase sign-in; optional backup to Google Drive or OneDrive,
  which is also how devices sync. Firestore only stores each user's backup-provider choice.
- **Server:** `serve.js` (Node, port 5000) serves the static files, injects Firebase/OAuth config
  from environment variables, and sends Contact Us emails.
- **Styles:** `src/styles/spendly.css` and `src/styles/App.css`.
- **Tests:** Jest in `tests/`, run with `npm test`.

## History note

The original 2025 prototype had a PostgreSQL/Drizzle backend (`server/`) and an earlier split-file
frontend (`src/App.js`, `src/components/`). Neither was used by the live app, and both were removed
in October 2026 (DEF-044).
