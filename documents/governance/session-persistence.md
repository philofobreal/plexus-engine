# Session Persistence

This document extends `../../AGENTS.md`. The root remains authoritative; this contract
applies to opt-in MVP history/workspace checkpoints, not the separate dashboard.

## Ownership and lifecycle

- `MvpVisualController` owns history, musical snapshots, dirty baselines, content identity,
  load/plan/save revisions and accepted restoration. Leaf controls only expose view snapshots
  and restore through their existing owners. `MvpUI` composes the shared leave guard.
- `SessionStore` owns storage publication and single-use restore capabilities.
  `checkpointEncoding` owns only lossless history-string encoding and bounded decoding.
  `sessionCheckpoint` validates a versioned data allowlist; `EditHistory` validates both
  domain chains against the restored current state before replacing the journal.
- Checkpoints contain no audio bytes, blobs, base64, decoded buffers, workers, DOM objects,
  source nodes or GPU state. Audio must be selected again. A cached, full-file SHA-256 digest
  proves byte identity; the existing analysis-descriptor key remains compatible with panel saves.
  An analysis fingerprint alone is insufficient to authorize history replay.
- Restore through normal decode/analysis, verify identity/duration, then publish the checkpoint
  and project controls. AudioEngine owns paused seeking and index alignment. No autoplay,
  resumed export job or automatic native fullscreen; those require new user actions.
- A restore capability is durable across tab closure and consumed before parsing/replay. Edits invalidate a
  previously saved capability. A missing, invalid, consumed or mismatched capability never
  authorizes an older checkpoint. Re-saving is required for another visit.
- Compare tokens before deleting shared track records; an older tab must not remove a newer
  tab's checkpoint. Do not merge journals across tabs. Normal musical saves survive cleanup.

## Performance and failure rules

- No persistence, hashing or journal serialization in audio/render callbacks. Hash once per
  selected file during loading; serialize the bounded journal only on explicit save.
- Slider edits may flip one small localStorage capability once after a save. They must not
  rewrite the checkpoint. Compare small view settings after UI events, not each frame.
- Snapshot interning and a serialized-size budget supplement the step limit. Reject oversized
  checkpoints visibly; do not silently truncate retained undo/redo to claim success.
- Large checkpoints may use versioned same-domain string deltas; plain v1 remains readable.
  Enforce the 1,500,000-character stored budget and 32,000,000-character expanded-input budget.
  Decode at most 600 snapshots, accepting only backwards same-domain references and checking
  cumulative expansion before allocation; then run normal schema and journal-continuity validation.
- Snapshot capture, serialization and publication all belong inside the controller's save
  try/finally boundary. A capture exception must return failure and release the saving lock.
  Propagate validation/size/storage/stale-workspace reasons to the shared modal without clearing
  dirty state; preserve retry and independent panel-save actions.
- Save history is a full checkpoint: publish both artistic slices and history/current/view state
  in one localStorage write. Individual panel saves preserve the other saved slice and cannot
  mark history clean. Capture revisions, reject superseded work and never claim failed saves clean.
- The track record and restore-capability key are separate localStorage writes, not one transaction. Publish an invalid capability first,
  write the complete record, then activate its capability. On activation failure keep the UI dirty
  and fail closed; the ordinary panel slices may already have persisted. Do not claim rollback.
- Never depend on asynchronous work during unload. Browser-native beforeunload restrictions and
  process termination remain platform limits; the application save dialog runs while still open.

## Required evidence

Cover mixed scopes/branches, 300-step bounds, continuity/schema rejection, same-byte renamed
files, equal-descriptor different bytes, no audio persistence, consumption without re-save,
independent panel saves, explicit history opt-out, quota/access failures, stale tokens, stale
loads/saves and scope/view/play changes during saves. Include realistic multi-point plans with
300 small edits, lossless restoration of both branches, malformed/over-expanding delta rejection,
legacy plain checkpoints, capture exceptions and successful retry. Browser QA must include save, reload,
file reselection and usable restored undo/redo. Follow the full reporting rules in
[Testing and Validation](testing-validation.md). Product details and safe transient exclusions
belong in [MVP workspace](../features/mvp-workspace.md), not duplicate root governance.
