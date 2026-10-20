# AN-04A: source / part / musical-motif registry, first prototype

Integration owner: Codex / root. Owners: pure analyzer, shared types, pure semantics,
tests and research documentation. Frozen design before first measurement, 2026-10-14.

## Scope and hypothesis

Persistent track-scoped source hypotheses and musical phrase hypotheses must be
separate. A source can change phrase; a phrase can recur on a different source.
The existing Visual Score motifs are artistic choices, not musical motifs.

Implement an explicit offline research API, outside TrackAnalysis, workers and
default visual/gameplay publication. Input: track PCM identity, candidate activity
intervals, isolated-candidate harmonic descriptors and supplied monophonic phrase
notes. Input contains no ground-truth source or motif identifiers. Candidate
boundaries, isolation and note pitches are supplied in this first experiment:
the result is association accuracy conditional on these upstream inputs, not
end-to-end source separation, pitch transcription or real singer recognition.

## Frozen decisions

- Eight relative harmonic amplitudes, Hann-weighted exact-frequency DFT, supplied
  fundamental, DC removal. All eight harmonics must be below 0.4 sample rate;
  at least eight fundamental cycles, PCM RMS above 1e-6. This is a harmonic
  descriptor for approximately stationary periodic candidates, not a universal
  timbre embedding. No neural training or classifier is claimed.
- Source matching: cosine distance <=0.025 to an immutable first-observation
  anchor. Two eligible anchors within 0.005 distance margin cause abstention.
  A matching overlapping interval causes abstention, not invented extra sources.
  A clearly different valid descriptor can create another source hypothesis.
- Phrase matching: at least four supplied notes, exact relative semitone contour,
  equal note count, normalized onset/duration maximum error <=0.02; two matches
  within 0.005 error margin cause abstention. Preserve transposition and duration
  scale. No partial, ornamented, polyphonic or DTW motif claim in this version.
- Same input set gives deterministic canonical ordering and IDs. IDs are scoped
  to this input/algorithm, not stable across arbitrary edited tracks or models.
- Missing descriptors, unresolved mixtures, ambiguous matches and resource limits
  are explicit. Scores are distances, not calibrated probabilities.
- Default observation budget 4096, maximum notes per phrase 64; configurable
  bounded budgets. Never silently discard an observation to satisfy a limit.
- Relations describe observed coactivity and successive musical phrase returns
  or handoffs. No automatic call-and-response intention, dramaturgy cue,
  choreography publication or XR target. Confidence null; diagnostic-only.

## Evidence and evaluation

Author controlled source stems and symbolic notes, multiple sources from the same
family, pauses/reentry, changed phrase, transposed/time-scaled motif handoff,
gain/phase variation, true overlap and indistinguishable negative controls.
Render float32 mixtures and retain their sample-clock/hash plus stem and label
hashes. Extract descriptors from the authored isolated candidates; notes remain
authored inputs. Label IDs exist only in the evaluator. Development and frozen
transfer sweeps use disjoint parameter tuples. They share a generator and are
not independent recorded-music validation. Freeze source hashes before transfer.

Measure source/motif pairwise same/different precision and recall, eligible
association coverage and ambiguous-control abstention; count resolved tracks,
recurrences and cross-source handoffs. Unknown assignments are not negatives.
Show the number of pairs withheld due to abstention alongside recall over all
positive ground-truth pairs. Compare a declared no-memory baseline that creates
one source/motif for every observation. Do not average away ambiguity failures.

No task-compatible two-library source-identity/motif-reference pair is available
in this slice. External reference status is unavailable. Authored ground truth
has its own evidence category and does not replace the user's two-library gate.
Do not reuse onset agreement as source or motif truth. Preserve every previous
test, program and result; append inventory and run the whole cumulative harness.

Promotion requires actual candidate extraction on mixtures, independently
annotated multitrack validation, two actual compatible external providers where
their predictions are used, and consumer timing/cost validation. This first
contract is the foundation for that work, not a production accuracy certificate.
