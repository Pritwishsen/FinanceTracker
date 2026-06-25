---
name: Firebase Auth integration
description: How Firebase Auth is wired into the single-file CDN app, and the dual-path (Firebase / localStorage fallback) pattern used throughout.
---

# Firebase Auth integration

## Architecture
- `serve.js` reads env vars `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID` and injects `window.FIREBASE_CONFIG = {...}` into app-v3.html at request time (string-replace on `<head>`).
- Workflow uses `node serve.js` (not `npx serve`) so injection runs on every request.
- `app-v3.html` loads Firebase compat SDK v10.12.2 CDN scripts, then an inline init block sets `window.__firebaseReady`, `window.__firebaseAuth`, `window.__firebaseDb`.

## Fallback pattern
- `AuthUtils.firebaseReady` getter returns `!!window.__firebaseReady`.
- Every auth handler (handleSubmit, handleSignIn, handleChangePw, handleLogoutConfirm) has an `if (AuthUtils.firebaseReady) { ... } else { /* localStorage path */ }` branch.
- When Firebase is NOT configured, the app behaves exactly as before (localStorage passwordHash auth).

**Why:** Firebase config must be supplied by the user (external Firebase project). The app must work without it so existing users aren't broken.

## Firestore schema
- `users/{uid}` document: `{ displayName, storagePreference: 'local', createdAt }`.
- `storagePreference` is written to `localStorage` as `financeApp_storagePreference` on sign-in (for Task #2 Storage Picker).
- NO financial data ever touches Firestore.

## Migration path
- On sign-in, if Firebase returns `user-not-found`/`invalid-credential` AND a localStorage account exists with matching email + correct passwordHash → silently calls `AuthUtils.register()` to create Firebase account, then proceeds as normal login.

## Session management in App
- `authLoading` state starts `true` when Firebase is ready; a full-screen spinner shows until `onAuthStateChanged` fires.
- `currentUser` useState initializer returns `null` when Firebase is ready (avoids stale localStorage session flash).

## Password change (ProfileScreen)
- Firebase path: `reauthenticateWithCredential(EmailAuthProvider.credential(email, currPw))` then `fbUser.updatePassword(newPw)`.
- Uses `firebase.auth.EmailAuthProvider` (compat SDK global).
