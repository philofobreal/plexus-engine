# AI Task Playbook

Purpose: provide deterministic execution paths for common Plexus Engine tasks.

## 1. Metrics Audit

Read in order:
1. current-typescript-implementation.md
2. PLEXUS ENGINE - system documentation.md
3. worker-communication.md
4. realtime-audio-safety.md

Validation:
- Verify metric ownership.
- Verify metric source (`src/analyzer/` offline core vs realtime render state).
- Verify dashboard label matches actual calculation.
- Verify no metric is derived twice.

Deliverables:
- Metric inventory.
- Source-of-truth mapping.
- Drift findings.
- Refactor proposal.

---

## 2. Analyzer Algorithm Change

Read:
1. architecture-contract.md
2. worker-communication.md
3. realtime-audio-safety.md
4. ADR-002-headless-analyzer-core.md

Required checks:
- `src/analyzer/` remains the DSP and dramaturgy source of truth
- `src/audio/analyzer.worker.ts` remains a thin message adapter
- Node.js execution through `analyzeAudio()` still works without Worker APIs
- requestId safety
- cancellation safety
- deterministic output
- schema compatibility
- no DSP, scoring, BPM, dramaturgy threshold, worker protocol, or AudioEngine public API drift

---

## 3. Renderer Performance Audit

Read:
1. architecture-contract.md
2. anti-patterns.md
3. realtime-audio-safety.md

Required checks:
- allocations inside draw loop
- object growth
- DOM updates
- expensive distance calculations
- p5-only coupling

---

## 4. UI Change

Read:
1. architecture-contract.md
2. testing-validation.md

Required checks:
- ownership rules
- dashboard updates
- responsive behavior
- disabled/enabled states

---

## 5. Documentation Change

Read:
1. AGENTS.md
2. architecture-contract.md
3. platform-operations.md

Required checks:
- avoid duplicated governance
- avoid conflicting rules
- link integrity
- update validation notes
