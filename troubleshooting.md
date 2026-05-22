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

**Root Cause**: The Direct Upload API accepted the files but could not serve them correctly. The manifest hash format or the file grouping was not interpreted correctly by Cloudflare's serving infrastructure. All `deploy` stage logs showed success but the CDN edge returned 500.

**Fix Applied**:
- Abandoned the Direct Upload API approach entirely.
- Created a new Cloudflare Pages project **connected to the GitHub repository** (`rekaku3d/revit-version-scanner`) via the source API:
```python
payload = {
    "name": "revitversionscan",
    "production_branch": "main",
    "source": {
        "type": "github",
        "config": {"owner": "rekaku3d", "repo_name": "revit-version-scanner", ...}
    }
}
```
- Triggered a deployment from the `main` branch using the Deployments API.
- Cloudflare cloned the repository, served files directly, and returned HTTP 200 ✅.

---

## Error 3: PWA Installation → HTTP 500 After Launch

**Date**: 2026-05-22  
**Symptom**: After installing the PWA via the browser prompt, launching the installed app returned HTTP 500.

**Root Cause (Multiple)**:

1. **`start_url` was `"./index.html"`** — Relative paths in `manifest.json` can resolve incorrectly depending on the PWA's install scope. Cloudflare Pages serves at the root `/`, but `./index.html` resolved to an unexpected path on relaunch.

2. **Service Worker used Cache-First strategy** — `sw.js` pre-cached all assets during `install` and served everything from cache. After installation, if the cached responses were not fully populated or were stale, navigation requests returned an empty or error response from the cache layer rather than from the network.

3. **SW registered via relative path `./sw.js`** — After PWA installation, the base URL context may shift, causing `./sw.js` to fail registration or register at the wrong scope.

**Fixes Applied**:

### `manifest.json`
- Changed `"start_url"` from `"./index.html"` → `"/"`
- Added `"scope": "/"` to explicitly anchor the PWA scope to the root
- Changed icon `src` from `"icon.svg"` → `"/icon.svg"` (absolute path)

```json
{
  "start_url": "/",
  "scope": "/",
  "icons": [{ "src": "/icon.svg", ... }]
}
```

### `sw.js`
- Replaced **Cache-First** strategy with **Network-First** strategy
- SW now always tries the live network first; only falls back to cache if the network is unavailable
- Pre-cache on install is now non-blocking (errors are caught and ignored)
- Cross-origin requests and non-GET requests are **skipped entirely** (not intercepted)

```js
// Before (Cache-First — caused 500 on PWA launch):
caches.match(e.request).then(cached => cached || fetch(e.request))

// After (Network-First — always hits Cloudflare first):
fetch(e.request)
  .then(res => { cache.put(e.request, res.clone()); return res; })
  .catch(() => caches.match(e.request))
```

### `app.js`
- Changed SW registration path from `'./sw.js'` → `'/sw.js'` (absolute)
- Added `reg.update()` call after registration to force SW refresh on every load, preventing stale service worker from persisting

---

## Summary Table

| # | Error | Status Code | Root Cause | Fix |
|---|-------|-------------|------------|-----|
| 1 | CF Pages Direct Upload missing manifest | 400 | Missing `manifest` field in multipart body | Added manifest with hash+size per file |
| 2 | CF Pages site 500 after Direct Upload | 500 | Files uploaded but not served by CF edge | Switched to GitHub-connected deployment |
| 3 | PWA launch 500 after installation | 500 | Cache-first SW + relative `start_url` + relative SW path | Network-first SW, absolute paths in manifest and SW registration |

---

## Online Webapp Transition Notes

The app was originally built as a **fully offline PWA** (all assets cached on install). It has been transitioned to an **online webapp** with optional PWA installation:

| Feature | Before | After |
|---------|--------|-------|
| Caching strategy | Cache-First (offline-first) | Network-First (online-first) |
| Offline support | Full | Fallback only (if cached) |
| SW path | `./sw.js` (relative) | `/sw.js` (absolute) |
| `start_url` | `./index.html` | `/` |
| `scope` | Not defined | `/` |
| SW update on load | No | Yes (`reg.update()`) |
