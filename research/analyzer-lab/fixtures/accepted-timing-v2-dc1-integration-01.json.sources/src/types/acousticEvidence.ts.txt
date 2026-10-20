/** A caller-bound PCM identity; no oracle declaration can replace this clock. */
export interface AcousticEvidenceIdentity {
    pcmSha256: string;
    sampleRate: number;
    sampleCount: number;
    timelineOffsetSeconds: number;
}

export interface AcousticEvidenceCandidate {
    time: number;
    sampleIndex: number;
    supportStartSample: number;
    supportEndSample: number;
    endpointAmbiguous: boolean;
}

export interface PairedOnsetReference {
    class: 'onset';
    time: number;
    acceptance: 'two-library-agreement';
    groundTruthStatus: false;
    confidence: null;
    evidenceType: 'pseudo_label';
    timeInterval: [number, number];
    disagreementSeconds: number;
    votes: {provider: 'librosa' | 'audioflux'; time: number}[];
    identity: AcousticEvidenceIdentity;
}

export interface AcousticEvidenceAssessment {
    policy: 'research-onset-consumer-gate-v1';
    identity: AcousticEvidenceIdentity;
    toleranceSeconds: 0.025;
    events: {
        sampleIndex: number;
        time: number;
        supportStartSample: number;
        supportEndSample: number;
        endpointAmbiguous: boolean;
        referenceStatus: 'two-library-agreement' | 'unqualified';
        reference: PairedOnsetReference | null;
        confidence: null;
        groundTruthStatus: false;
        dramaturgy: 'diagnostic-only';
        choreography: 'diagnostic-only';
        xrScoring: 'ineligible';
        reasons: string[];
    }[];
    uncoveredReferenceCount: number;
    unqualifiedAreNegatives: false;
}
