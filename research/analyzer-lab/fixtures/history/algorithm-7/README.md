# Frozen algorithm-7 regression snapshots before AN-02

These ten JSON files are exact copies of the accepted AN-01 working-tree snapshots
before introducing the optional acoustic candidate stream on 2026-10-10. They are
not the algorithm-6 Git HEAD goldens. The immutable
[AN-01 summary](../../an01-signal-contract.summary.json) records that earlier change.

The active tests continue to use `tests/fixtures/analyzer/headless-baseline.summary.json`
and the nine `tests/fixtures/golden/*.json` files. No active snapshot was rewritten
for AN-02. The cumulative harness records the bytes/hashes of both historical and
active snapshots and preserves them in its first versioned source archive.

These historical copies are evidence rather than another independent test corpus.
Never update them when creating a future reviewed active snapshot.
