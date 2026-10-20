# Cumulative regression harness

From the `plexus-engine` root, using an existing Python runtime:

```powershell
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py inventory
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py check --report research/analyzer-lab/.cache/inventory-check.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py full --report research/analyzer-lab/.cache/full-validation.json
```

`inventory` explicitly appends additions; it never accepts an edited predecessor silently. Final integration must append the new inventory before running `full`. Each version contains a hash-chained JSON manifest and a ZIP with all original protected bytes. The previous JSON and ZIP remain unchanged. Protect versioned inventories and histories in source control; they are tamper evidence against accidental changes, not a cryptographic signature against an attacker who can rewrite the entire repository.

Protected files include recursively discovered tests, all test-tree helpers, fixtures and historical fixtures/evidence, scripts, diagnostic programs, test configuration, harness executable code, and all reusable lab source, bridge and archive tools (`research/analyzer-lab/src/**`, `bridge/**`, `tools/archive/**`). Generated environments, caches, data, models and run directories are excluded. Hashes are the preservation gate. Byte sizes and textual test/assert counts are diagnostics, not proof that a refactor preserves coverage or behavior. Root development documentation remains editable.

A deliberate replacement requires an explicit per-file migration file passed with `inventory --migrations PATH`. Its exact old/new hashes, reviewer/integration-owner and explanation must match each changed path. The user's authorization permits autonomous implementation and integration review; a named reviewer/integration-owner must still document preserved assertions, helpers, fixtures, and coverage. The harness cannot establish semantic equivalence. There is no blanket accept-changes option. Deletion is blocked; retain the predecessor file if moving its role elsewhere.

```json
[
  {
    "path": "tests/example.test.mjs",
    "predecessorSha256": "OLD_64_HEX_HASH",
    "replacementSha256": "NEW_64_HEX_HASH",
    "reviewedBy": "reviewer identity",
    "reviewedReason": "Specific preserved assertions and replacement/helper mapping, with review evidence."
  }
]
```

`full` runs the declared `npm run build`, the declared `npm test`, any recursively discovered active Node files omitted by a direct Node glob, and the entire Python lab test directory. The recursive production script `node scripts/run-tests.mjs` is verified using its authoritative `--list`; omission or duplication is an error. Reporter arguments must reach the child Node process. No test-name filter, skip flag or silent exclusion is accepted. Structured Node events and pytest JUnit evidence establish executed files. Missing evidence, skipped tests, unknown failure details, changed source during execution, or changed protected files fail the run even if subprocesses return zero. All stages run after an ordinary build/test failure so the report remains cumulative.

Historical `documents/tests` mirrors remain inventoried with hashes. Matching active filename and bytes are recorded as aliases, but these files remain `historical-unexecuted`: their original harness/context is not restored. Nonmatching archived sources are explicit uncovered history, never quietly claimed as executable coverage. Replaying them requires restoration of their original context; this runner does not invent such a replay.

Known failures are frozen in `known-failures.json`, tied to the AN-01 summary and the independently verified clean-HEAD baseline. Classification requires the same active file, test name, error code, assertion actual/expected/operator, and normalized complete error message. Changed numeric output is unknown even when the test name matches. Only quoted paths in the known `EPERM` rename environment error are normalized, because temporary names change. **Known failures remain nonzero failures; there is no masked green status.** Fixing a known failure requires no acceptance entry; a newly passing assertion passes normally.

Node is found via `PLEXUS_NODE`, PATH, or the existing bundled Codex runtime. npm must already exist beside the detected runtime/npm executable. Python prefers the lab `.venv`, otherwise the invoking interpreter. Nothing is installed. Each run exclusively creates a short workspace-local temp root `.cache/t<12-random-hex>/`: native temp uses `n`, pytest uses the initially absent `p`. The absent pytest path is verified before passing `--basetemp`, so pytest never deletes a prior run's fixtures. Locations are recorded in the report/history. Short paths reserve more room for nested fixtures under Windows; arbitrarily long checkout/fixture paths still require operating-system long-path support. This can remove the historical default-Windows-temp rename failure; remaining failures are still classified individually.

Large stdout/stderr logs and XML live under ignored `.cache/regression-harness/<run-id>`; temporary fixture trees use the shorter root above. Explicit JSON reports include commands, exit codes, log hashes, protected inventory, production/lab source identities, executed files and known/unknown failures. Small immutable summaries append under `tools/harness/history`. Each Node stage retains its single global summary counts (per-file summaries are never summed), sorted executed paths/count/hash, expected-path hash/count, missing/unexpected paths and coverage status. Missing or ambiguous global summary evidence is incomplete. Histories also retain the pytest XML SHA256 and a full-evidence digest. Path-list hashes use a sorted unique relative-path array serialized as UTF-8 compact JSON with `ensure_ascii=true`. The full-evidence digest uses UTF-8 compact JSON with sorted keys and `ensure_ascii=false`, excluding only the root keys `history`, `fullEvidenceHash`, and `fullEvidenceHashConvention`; the convention is recorded explicitly. This binds detailed report content while allowing history-path relocation and avoiding a self-referential hash. No command generates or overwrites golden fixtures. Post-run hashes also detect a subprocess attempting to do so. Existing inventory versions and earlier run histories remain unchanged.

Every `--report` path must be new. An existing report is rejected before inventory changes or full execution; exclusive creation also prevents overwriting a concurrently created report. Use a distinct timestamp or run identifier for each result.

Focused harness tests use isolated fake repositories and fake command results, plus real CLI subprocesses; they do not execute the production npm suite:

```powershell
& ./research/analyzer-lab/.venv/Scripts/python.exe -m pytest research/analyzer-lab/tests/test_regression_harness.py -q -p no:cacheprovider --basetemp=research/analyzer-lab/.cache/harness-focused-UNIQUE
```
