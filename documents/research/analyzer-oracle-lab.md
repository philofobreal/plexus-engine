# Analyzer Oracle Lab integration

[Research lab quickstart](../../research/analyzer-lab/README.md) describes the isolated Python MIR measurement pipeline. It consumes the existing `src/analyzer/analyzeAudio()` through a research-only Node bridge and stores canonical evidence, differential reports and training JSONL outside the browser runtime.

The lab is not a production dependency and does not change analyzer ownership, `AnalysisResult`, worker messages, AudioEngine, State, UI, rendering, gameplay or XR. Production algorithms remain the analyzer owner's responsibility under [ADR-002](../adr/ADR-002-headless-analyzer-core.md). The subsequent user-authorized improvement cycle includes a separately validated [tonal-sustain correction](../features/analyzer-tonal-sustain.md) in the production analyzer, algorithm version 6.

The [P0 Musical Event Layer research cycle](../../research/analyzer-lab/docs/DRUM-EVENT-CLASSIFIER.md) now supplies an original kick/snare/hi-hat classifier, reviewed local MIDI import, procedural dataset, and frozen-model holdout benchmark with optional oracle consensus. This is a research baseline; real-mixture accuracy and production integration remain unvalidated.

The [expanded improvement cycle](../../research/analyzer-lab/docs/DRUM-IMPROVEMENT-CYCLE.md) adds an opt-in v2 model, independent expanded corpus, paired measurements and actual library-onset evaluation. All expanded holdout drum classes improve; historical kick/snare regressions remain documented and prevent unconditional model promotion.

The [analyzer development strategy](analyzer-development-strategy.md) records the mathematical/DSP/consumer audit and a versioned development method for VJ dramaturgy/choreography and XR timing. Lab event measurements now add signed timing bias/tails and explicit false-positive/miss counts; broader metrics and physical acceptance remain separately identified future work.
