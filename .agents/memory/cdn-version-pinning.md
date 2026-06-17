---
name: CDN version pinning for app-v3.html
description: Why all CDN <script>/<link> deps in this single-file React app must be version-pinned
---

# Pin every CDN dependency in app-v3.html / index.html

This app is a single-file React app loaded entirely from CDNs (React, ReactDOM, Babel standalone, Bootstrap, Font Awesome) with no build step. Unversioned CDN URLs resolve to the latest published version at load time.

**Rule:** Pin a specific version in every CDN URL. Never use an unversioned/major-only URL for the transpiler.

**Why:** An unpinned `@babel/standalone` URL silently upgraded to a new major (8.0.1) and broke the whole app at runtime. The symptom was misleading: a blank page and a console error "Cannot use import statement outside a module" even though there is no `import` anywhere in the source. Babel 8's changed module/sourceType defaults produced output the browser rejected. Pinning Babel back to `@babel/standalone@7.26.4` fixed it.

**How to apply:** If the app suddenly renders blank or throws Babel/parse errors with no relevant source change, suspect an auto-upgraded CDN dep first — check what version the unpinned unpkg URL currently redirects to (`curl -sI <url>`). Keep app-v3.html and index.html identical (always `cp app-v3.html index.html` after edits).
