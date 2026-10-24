# ADR-013: Studio server session and deployment boundary

## Status

Proposed by T01 on 2026-10-23; implementation stack and deployment target unresolved.
Integration owner: this chat; owners: platform/server, host composition/UI and build.
Related: [plan](../audits/xr-development-plan.md),
[ADR-008](ADR-008-mvp-host-and-shared-renderer.md),
[ADR-012](ADR-012-isolated-export-job-runtime.md).

## Problem

The current application is a static Vite MPA with root dashboard, MVP and XR, a GitHub Pages
base and no server auth. A password modal or localStorage flag cannot protect Studio files or
API calls. Owning a DotRoll domain does not establish support for a persistent Node server,
native FFmpeg, a session store or cross-origin isolation.

## Proposed deployment-neutral contract

Root becomes a lightweight public launcher; /studio/ reuses the dashboard composition;
/mvp/ and /xr/ remain public independent hosts. Root never imports or initializes audio, analyzer,
Three, p5 or the Studio runtime. Base URL comes from explicit deployment configuration, with
root and test-subpath smoke. Same-origin storage keys stay unchanged unless a real migration
need is proven. No cross-origin session-sharing assumption.

The server, or a verified hosting-supported gate, authenticates before serving protected routes.
Implement in the supported language/runtime only after T23's capability check. No new paid
infrastructure, framework, proxy, container, VPS or durable process is assumed by this decision.

Proposed API v1 under same-origin `/api/v1/auth/` (resolved against the configured deployment base):

| Route | Contract |
| --- | --- |
| GET session | 200 `{authenticated: boolean, csrfToken?}`; no password/session identifier in JSON; no-store |
| POST session | Validated JSON password, server verification and rate limit; 204 plus rotated cookie on success; 401 invalid, 429 throttled |
| DELETE session | Origin/CSRF checked logout and server invalidation; 204 and cleared cookie; idempotent |
| Protected business APIs | Auth checked before operation; unauthenticated 401, unauthorized 403, typed JSON errors; never HTML redirect as success |

Cookie: host-only, HttpOnly, Secure on HTTPS, SameSite=Lax, Path covering launcher/auth/Studio.
Use an unpredictable opaque ID and server-side validated state with expiry/revocation. Hash the
password server-side using an available supported password-hashing primitive and secret storage;
algorithm/parameters and session-store adapter are selected against the actual platform in T23.
Proposed first policy: 30-minute idle, 8-hour absolute expiry, login ID rotation; confirm before
implementation. Rate-limit by bounded server-side client and global counters; exact limits and
trusted proxy addressing require that platform check. No secrets in Vite public env or bundles.

Mutations enforce same-origin/Origin policy and session-bound CSRF tokens; apply it to login and
logout too. GET session may issue a short-lived anonymous CSRF challenge; this is not an authenticated
session. Bound request size; malformed/auth/service-unavailable errors stay distinguishable without
revealing the secret. Logs omit password, cookie and token values. Session API and protected
responses use no-store; test CDN/browser caching, logout, expiry and concurrent requests.

Normalize and gate `/studio`, `/studio/`, `/studio/index.html`, encoded/duplicate-slash variants
and supported descendant routes before file resolution. Sessionless HTML requests redirect to
the configured public launcher. Resolve public API/static paths explicitly; do not create a
wildcard catch-all that turns API failures into HTML or bypasses the gate through rewrites.

Treat Studio-specific HTML/assets as protected; keep their private outputs distinguishable in
the build manifest. Public MVP/XR shared engine assets remain public. If proprietary DSP/plan code
must be hidden, move that computation behind a separate service; an asset gate cannot hide
shared engine code already required by a public host. Direct asset requests need explicit tests.

## UI and availability

Studio click checks session, then either navigates or opens the designed password modal. Server
success permits navigation. Invalid password, throttling and unavailable auth are separate states;
keyboard/focus/Escape/back behavior are tested. Frontend state never decides authorization.
No runtime imports before navigation. When auth is unavailable, fail closed for Studio while
public MVP/XR remain usable. A development-only stub must be explicitly labelled and cannot be
included in a public release that claims protected Studio.

## Business authority inventory

| Concern | Authority / movement | Latency, offline and failure policy |
| --- | --- | --- |
| Password, authorization, secrets | Server only; password over HTTPS once, opaque cookie thereafter | Studio requires available auth; fail closed |
| Session/revocation | Server store/gate | Expiry/logout invalidates direct API and HTML access |
| Local MVP workspace/history | Existing client owner; no automatic upload | Preserve current offline edits/restore and content identity |
| Server saves or export jobs | Server validates authorized request and immutable job IDs | Not implemented until explicitly selected; retries/status/cancellation required |
| Proprietary analysis/plan service | Unresolved product/IP boundary; input PCM/upload and output provenance must be designed | Upload cost, privacy, failure and offline fallback need a separate migration decision |
| Offline analyzer/planners today | Existing headless client modules | Keep current behavior until an approved service migration; no hidden network dependency |
| Live playback clock/input/judge/render | AudioEngine and local runtime | No per-frame network request; auth latency cannot gate a strike or frame |

## Versions, rollout and rollback

API namespace v1 and server session-store schema v1 are proposed, independent of XR settings v1
and MVP checkpoints. Version support and revocation must be defined before release/rollback.
No production auth-bypass flag. Authentication is mandatory for public Studio; a missing backend
blocks that release, not independent XR changes. Use a staging environment and deployment base
config before T24. Never publish sessionless Studio as a temporary fallback.

Rollback restores a previously verified release/gate atomically or by a documented checked upload;
maintain compatible session validation or revoke sessions. If the gate fails, keep Studio closed
and public hosts served. DNS/TLS/hosting changes require an identified target and access; this
proposal selects none. T24 will verify WebXR HTTPS, MIME, routing, headers and actual rollback.

## Acceptance and unresolved gate

T23 must prove direct HTML/asset/API access cannot bypass auth, session fixation/replay/expiry/
logout and CSRF/Origin are handled, and secrets are absent from client outputs. T22 requires
dev and production HTTP route/asset/reload smoke. T24 requires actual target HTTPS/auth/Quest
checks and attempted rollback. Domain/package/runtime/process/FFmpeg/header capabilities and
the intended IP boundary are unknown; request them only when starting the dependent work.
