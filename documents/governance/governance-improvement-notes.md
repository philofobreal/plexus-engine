# Governance Improvement Notes

## Recommended Consolidation

The following topics appear in multiple governance documents and should have a single canonical owner:

- Worker lifecycle
- Request ID safety
- Playback time ownership
- Validation reporting

Other documents should reference the canonical source rather than restating rules.

## Encoding Policy

All governance files should be UTF-8 encoded.
Do not commit mojibake or mixed encodings.

## Documentation Structure

Preferred hierarchy:

AGENTS.md
â”śâ”€ architecture-contract.md
â”śâ”€ realtime-audio-safety.md
â”śâ”€ worker-communication.md
â”śâ”€ platform-operations.md
â”śâ”€ anti-patterns.md
â”śâ”€ testing-validation.md
â””â”€ AI_TASK_PLAYBOOK.md

## Review Trigger

Run a governance review whenever:
- shared contracts change
- worker schemas change
- state ownership changes
- renderer backend abstractions change
