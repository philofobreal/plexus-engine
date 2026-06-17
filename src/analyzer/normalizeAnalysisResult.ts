import type { TrackAnalysis } from '../types';
import { DEFAULT_ANALYSIS_HOP_SIZE } from './constants';

export const EMPTY_TRACK_ANALYSIS: TrackAnalysis = {
    duration: 0,
    bpm: 0,
    bars: [],
    sections: [],
    patterns: [],
    cues: [],
    significantMoments: [],
    features: [],
    buildupConfidence: [],
    spectralPivot: [],
    tensionTrends: { globalSlope: 0, peakTime: 0, peakValue: 0, segments: [] },
    featureHopSize: DEFAULT_ANALYSIS_HOP_SIZE,
    gridOffset: 0
};

export function normalizeTrackAnalysis(trackAnalysis: TrackAnalysis, fallbackBpm = 0): TrackAnalysis {
    return {
        ...EMPTY_TRACK_ANALYSIS,
        ...trackAnalysis,
        bpm: trackAnalysis.bpm || fallbackBpm || 0,
        bars: (trackAnalysis.bars || []).map(bar => ({ ...bar, avgRms: bar.avgRms ?? 0, peakRms: bar.peakRms ?? 0, bass: bar.bass ?? 0, mid: bar.mid ?? 0, treble: bar.treble ?? 0 })),
        sections: (trackAnalysis.sections || []).map(section => ({ ...section, avgRms: section.avgRms ?? 0, peakRms: section.peakRms ?? 0 })),
        spectralPivot: trackAnalysis.spectralPivot || [],
        tensionTrends: trackAnalysis.tensionTrends || EMPTY_TRACK_ANALYSIS.tensionTrends,
        featureHopSize: trackAnalysis.featureHopSize || DEFAULT_ANALYSIS_HOP_SIZE,
        gridOffset: trackAnalysis.gridOffset || 0
    };
}

