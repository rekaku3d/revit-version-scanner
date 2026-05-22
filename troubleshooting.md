# Troubleshooting Log — Revit Version Scanner

A record of errors encountered during development and deployment, along with their root causes and fixes applied.

---

## Error 1: Cloudflare Pages Direct Upload API — HTTP 400 Missing Manifest

**Date**: 2026-05-20  
**Symptom**: Deployment API call returned HTTP 400 with error code `8000096`:
```json
{
  "code": 8000096,
  "message": "A \"manifest\" field was expected in the request body but was not provided."
}
```

**Root Cause**: The Cloudflare Pages Direct Upload API requires a `manifest` field in the multipart form body. Initial deploy script only uploaded raw files without the required manifest.

**Fix Applied**:
- Built a `manifest` JSON object mapping each file path (e.g. `/index.html`) to its SHA-256 content hash and file size.
- Added the manifest as the first field in the multipart POST body.

```python
manifest["/index.html"] = {"hash": hashlib.sha256(content).hexdigest()[:32], "size": len(content)}
parts = [("manifest", (None, json.dumps(manifest), "application/json"))]
```

---

## Error 2: Cloudflare Pages Live Site — HTTP 500 (Empty Body)

**Date**: 2026-05-20  
**Symptom**: Despite the API returning `"status": "success"`, visiting `https://revitversionscan.pages.dev` returned HTTP 500 with no response body.

**Root Cause**: The Direct Upload API accepted the files but could not serve them correctly. The manifest hash format or file grouping was not interpreted correctly by Cloudflare's serving infrastructure. All `deploy` stage logs showed success but the CDN edge returned 500.

**Fix Applied**:
- Abandoned the Direct Upload API approach entirely.
- Created a new Cloudflare Pages project **connected to the GitHub repository** (`rekaku3d/revit-version-scanner`) via the source API.
- Triggered a deployment from the `main` branch using the Deployments API.
- Cloudflare cloned the repository, served files directly, and returned HTTP 200 ✅.

---

## Error 3: PWA Installation → HTTP 500 After Launch

**Date**: 2026-05-22  
**Symptom**: After installing the PWA via the browser prompt, launching the installed app returned HTTP 500.

**Root Cause (Multiple)**:

1. **`start_url` was `"./index.html"`** — Relative paths in `manifest.json` resolve incorrectly when a PWA is launched from the OS shell. Cloudflare Pages serves at root `/`, but `./index.html` resolved to an unexpected path on relaunch.

2. **Service Worker used Cache-First strategy** — `sw.js` pre-cached all assets during `install` and served everything from cache. Stale or incomplete cache entries caused navigation to return empty/error responses.

3. **SW registered via relative path `./sw.js`** — After PWA installation, the base URL context shifts, causing `./sw.js` to fail registration or register at the wrong scope.

**Fixes Applied**:

### `manifest.json`
- Changed `"start_url"` from `"./index.html"` → `"/"`
- Added `"scope": "/"` to explicitly anchor the PWA scope to root
- Changed icon `src` from `"icon.svg"` → `"/icon.svg"` (absolute)

### `sw.js`
- Replaced **Cache-First** → **Network-First** strategy
- SW always tries live network first; falls back to cache only if network unavailable
- Pre-cache on install is now non-blocking (errors caught and ignored)
- Non-GET and cross-origin requests are skipped entirely

```js
// Before (Cache-First — caused 500 on PWA launch):
caches.match(e.request).then(cached => cached || fetch(e.request))

// After (Network-First — always hits Cloudflare first):
fetch(e.request)
  .then(res => { cache.put(e.request, res.clone()); return res; })
  .catch(() => caches.match(e.request))
```

### `app.js`
- Changed SW path from `'./sw.js'` → `'/sw.js'` (absolute)
- Added `reg.update()` after registration to force SW refresh on every page load

---

## Error 4: Stale Browser Cache Showing "Offline Local App" After Rebranding

**Date**: 2026-05-22  
**Symptom**: After removing all "Offline Local App" references from the source and pushing to GitHub, the live site still displayed the old badge. Verified on `https://revitversionscan.pages.dev`.

**Root Cause (Two issues)**:

1. **Cloudflare auto-deploy did not trigger** — The GitHub-connected Pages project was recreated via API during a redeployment cycle. The webhook connection to auto-deploy on push was not preserved. New commits pushed to `main` were not automatically deployed.

2. **Old Service Worker serving cached HTML** — The browser had installed the previous SW (`revit-scanner-v1` / `v3`) which was cache-first and was still serving the old `index.html` from its cache, bypassing the network entirely.

**Fixes Applied**:
- Bumped the SW cache name from `revit-scanner-v3` → `revit-scanner-v4` to force all browsers to discard the old cache on next SW activation.
- Manually triggered a new Cloudflare Pages deployment via the API pointing at the latest commit (`3c5ad4d`).
- Verified fix: live page confirmed `"Offline"` text absent, `"Web App"` badge present, HTTP 200.

---

## Error 5: GitHub Push Protection — API Token in Committed Files

**Date**: 2026-05-22  
**Symptom**: `git push` rejected with:
```
remote: - GITHUB PUSH PROTECTION
remote:   Push cannot contain secrets
remote:   —— Cloudflare User API Token ————
remote:   locations: cf_check.py:4, deploy_cloudflare.py:8
```

**Root Cause**: Temporary Python deployment scripts (`cf_check.py`, `deploy_cloudflare.py`) containing the Cloudflare API token were accidentally staged and committed.

**Fix Applied**:
- Deleted both files locally.
- Removed them from git tracking with `git rm --cached`.
- Created `.gitignore` to exclude all `*.py` files from future commits.
- Amended the commit with `git commit --amend --no-edit` to rewrite history without the secrets.
- Force-pushed the amended commit: `git push origin main --force`.

---

## Summary Table

| # | Error | Code | Root Cause | Fix |
|---|-------|------|------------|-----|
| 1 | CF Pages Direct Upload missing manifest | 400 | Missing `manifest` field in multipart body | Added manifest JSON with hash+size per file |
| 2 | CF Pages site blank after Direct Upload | 500 | Files uploaded but not served by CF edge | Switched to GitHub-connected deployment |
| 3 | PWA launch after installation | 500 | Cache-first SW + relative `start_url` + relative SW path | Network-first SW, absolute paths, `scope: "/"` |
| 4 | Old "Offline" badge shown after rebranding | UI stale | Auto-deploy not triggered + old SW cache serving stale HTML | Bumped SW cache to v4, manually triggered CF deployment |
| 5 | GitHub push rejected — API token in files | Push blocked | Temp scripts with hardcoded token accidentally committed | Deleted files, `.gitignore` for `*.py`, amended commit, force push |

---

## Online Webapp Transition Notes

The app was originally built as a **fully offline PWA**. It has been transitioned to an **online webapp** with optional PWA installation:

| Feature | Before | After |
|---------|--------|-------|
| Caching strategy | Cache-First (offline-first) | Network-First (online-first) |
| Offline support | Full | Fallback only (if cached) |
| SW path | `./sw.js` (relative) | `/sw.js` (absolute) |
| `start_url` | `./index.html` | `/` |
| `scope` | Not defined | `/` |
| SW update on load | No | Yes (`reg.update()`) |
| SW cache version | v1 | v4 |
| Header badge | "Offline Local App" (blue) | "Web App" (emerald green) |
| Footer text | "Runs completely offline..." | "Files processed in browser, nothing uploaded" |
