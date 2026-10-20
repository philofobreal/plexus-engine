# Experiment protocol

1. Record baseline Git revision, actual source fingerprint, environment, config/tolerances and track manifest license/identity. Freeze versions and keep the intended holdout split.
2. Run Plexus and the selected enabled oracle(s) on the same decoded mono PCM/clock. Retain raw and canonical artifacts, provider failures and diagnostics.
3. Inspect BPM absolute/relative error and metric-family ambiguity, one-to-one beat/onset matches, metadata and available section evidence. Preserve oracle/reference orientation. A score measures agreement, not truth or calibrated certainty.
4. Form a falsifiable musical hypothesis. Use reviewed ground truth or human annotation where possible; identify whether an onset is a raw transient or a grid-gated visual-impact event.
5. Propose a separate, explicit Plexus algorithm task. Design from measurements and domain reasoning. Do not port third-party source, copy weights or automatically adjust runtime thresholds.
6. Rerun the same benchmark and inspect train/validation evidence, with held-out test used only at the intended final evaluation. Report failures and unavailable metrics alongside improvements.
7. Run the governance-required regression/build checks and preserve existing golden fixtures unless an intentional, reviewed algorithm improvement justifies a separate baseline change.
8. Accept or reject the hypothesis with measured tradeoffs. Record confidence limits, dataset/model/code licenses and counterexamples. A benchmark win alone is insufficient if timing/ownership/runtime safety regresses.

No self-improvement loop, LLM-created ground truth, production training or automatic source changes are implemented. This task supplies the measurement infrastructure only.

The subsequent user-authorized analyzer review adopts [development method v1](ANALYZER-DEVELOPMENT-METHOD.md), with task/clock contracts, consumer-specific proposed precision, stage losses, independent-group evaluation and explicit promotion gates. Its [policy](../configs/analyzer-evaluation-policy.v1.json) and [draft experiment template](../fixtures/analyzer-experiment.template.json) are review artifacts; automatic promotion and the currently planned metrics are not implemented.
