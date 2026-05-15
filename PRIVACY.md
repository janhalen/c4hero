# Privacy

c4hero is a **local-first** application. This document describes exactly what
data the app handles, where it lives, and what is sent over the network.

## Workspaces and diagrams

- All workspace data — your model elements, relationships, views, tags, styles,
  groups, and node positions — is stored on your device.
- When you save to a `.dsl` file (or to a folder of `.dsl` files), the data is
  written to your filesystem via the browser's native file APIs.
- For crash recovery, c4hero also keeps a copy of your active workspace in
  your browser's `localStorage`. This data never leaves your device.
- Nothing is uploaded to a c4hero server. There is no c4hero server in the
  data path. The browser app is a static bundle.

## File system access

- Single-file editing (`.dsl`) works in every modern browser.
- Folder-based collections rely on the
  [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API),
  which is currently only available in Chromium-based browsers (Chrome, Edge,
  Brave, Arc, Opera). Granted folder/file handles are stored in
  `IndexedDB` so c4hero can re-open them on reload; revoking permission in your
  browser revokes c4hero's access immediately.

## Logging and hosted observability

- The app emits structured logs in the browser console for diagnostics.
- Hosted observability is **disabled by default** in the open source build.
  Self-hosted builds only send data to third-party observability services if
  the operator sets the related `VITE_*` variables at build time.
- The hosted app at [app.c4hero.com](https://app.c4hero.com) may use
  Cloudflare Web Analytics for aggregate page counts and Web Vitals on
  non-editor routes. The in-app beacon is not loaded on `/collection/*`, and
  Cloudflare SPA route tracking is disabled so collection, workspace, and view
  slugs are not sent through the Web Analytics beacon.
- The hosted app may use Sentry for client-side error reports. The integration
  is configured with `sendDefaultPii: false`, no session replay, no performance
  tracing, and route scrubbing that replaces collection/workspace/view slugs
  with placeholders before an error report is sent.
- Cloudflare analytics and Sentry initialization both respect Global Privacy
  Control, Do Not Track, and a local opt-out flag at
  `localStorage["c4hero:observability:disabled"] = "true"`.
- If a hosted deployment is proxied through Cloudflare or uses Cloudflare
  dashboard auto-injection, the operator must keep Web Analytics disabled or
  excluded for `/collection/*` so editor route paths are not collected outside
  the app's beacon guard.
- The optional `VITE_LOG_ENDPOINT` build-time variable can be set by an
  operator to forward `warn`/`error` log entries to an HTTPS endpoint via
  `navigator.sendBeacon`. This is **disabled by default** in this open source
  build. If you set it for a hosted deployment, also add the endpoint origin
  to your CSP `connect-src` policy and document the destination for your
  users.

## Cookies

c4hero does not set cookies.

## What's stored, where

| Data | Location | Cleared by |
| --- | --- | --- |
| Active workspace (crash recovery) | `localStorage` | Clearing site data; loading a different workspace |
| Recent file/folder handles | `IndexedDB` | Clearing site data; revoking handle in the browser |
| Settings (theme, panel state) | `localStorage` | Clearing site data |
| Workspace files (`.dsl`, `.c4hero.json` sidecar) | Filesystem (your machine) | Deleting the files |

## Reporting

If you find a privacy or security issue, please report it as described in
[SECURITY.md](SECURITY.md).
