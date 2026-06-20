import type { TrackAnalysis } from '../types';
import { DEFAULT_ANALYSIS_HOP_SIZE } from './constants';

export const EMPTY_TRACK_ANALYSIS: TrackAnalysis = {
    duration: 0,
    bpm: 0,
    bpmConfidence: 0,
    gridConfidence: 0,
    downbeatConfidence: 0,
    tempoCandidates: [],
    bars: [],
    sections: [],
    patterns: [],
    cues: [],
    significantMoments: [],
    features: [],
    buildupConfidence: [],
    spectralPivot: [],
    tensionTrends: { globalSlope: 0, peakTime: 0, peakValue: 0, segments: [] },
    noveltyCurve: [],
    noveltyPeaks: [],
    boundaryCandidates: [],
    featureHopSize: DEFAULT_ANALYSIS_HOP_SIZE,
    gridOffset: 0,
    tempo: 0,
    tempoConfidence: 0,
    beats: [],
    beatConfidence: 0,
    barStarts: [],
    alternativeTempos: [],
    timingConfidence: { tempo: 0, beat: 0, grid: 0, overall: 0 }
};

export function normalizeTrackAnalysis(trackAnalysis: TrackAnalysis, fallbackBpm = 0): TrackAnalysis {
    return {
        ...EMPTY_TRACK_ANALYSIS,
        ...trackAnalysis,
        bpm: trackAnalysis.bpm || fallbackBpm || 0,
        bpmConfidence: trackAnalysis.bpmConfidence ?? 0,
        gridConfidence: trackAnalysis.gridConfidence ?? 0,
        downbeatConfidence: trackAnalysis.downbeatConfidence ?? 0,
        tempoCandidates: trackAnalysis.tempoCandidates || [],
        bars: (trackAnalysis.bars || []).map(bar => ({ ...bar, avgRms: bar.avgRms ?? 0, peakRms: bar.peakRms ?? 0, bass: bar.bass ?? 0, mid: bar.mid ?? 0, treble: bar.treble ?? 0 })),
        sections: (trackAnalysis.sections || []).map(section => ({ ...section, avgRms: section.avgRms ?? 0, peakRms: section.peakRms ?? 0, reasons: section.reasons ?? [] })),
        cues: (trackAnalysis.cues || []).map(cue => ({ ...cue, reasons: cue.reasons ?? [] })),
        significantMoments: (trackAnalysis.significantMoments || []).map(cue => ({ ...cue, reasons: cue.reasons ?? [] })),
        spectralPivot: trackAnalysis.spectralPivot || [],
        noveltyCurve: trackAnalysis.noveltyCurve || [],
        noveltyPeaks: trackAnalysis.noveltyPeaks || [],
        boundaryCandidates: trackAnalysis.boundaryCandidates || [],
        tensionTrends: trackAnalysis.tensionTrends || EMPTY_TRACK_ANALYSIS.tensionTrends,
        featureHopSize: trackAnalysis.featureHopSize || DEFAULT_ANALYSIS_HOP_SIZE,
        gridOffset: trackAnalysis.gridOffset || 0,
        tempo: trackAnalysis.tempo || trackAnalysis.bpm || fallbackBpm || 0,
        tempoConfidence: trackAnalysis.tempoConfidence ?? 0,
        beats: trackAnalysis.beats || [],
        beatConfidence: trackAnalysis.beatConfidence ?? 0,
        barStarts: trackAnalysis.barStarts || [],
        alternativeTempos: trackAnalysis.alternativeTempos || [],
        timingConfidence: trackAnalysis.timingConfidence || EMPTY_TRACK_ANALYSIS.timingConfidence
    };
}
