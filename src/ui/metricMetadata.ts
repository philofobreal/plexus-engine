export interface MetricMetadata {
    name: string;
    description: string;
    source: string;
    range: string;
    tooltip: string;
}

export const dashboardMetricMetadata = {
    bpm: {
        name: 'BPM',
        description: 'Estimated tempo for the loaded track.',
        source: 'Analysis worker tempo estimate',
        range: '0..300 typical, -- before analysis',
        tooltip: 'Estimated track tempo.\nNot a live beat detector.'
    },
    energy: {
        name: 'Energy',
        description: 'Normalized RMS energy for the current frame.',
        source: 'AudioFrame.e',
        range: '0.00..1.00',
        tooltip: 'Normalized loudness energy.\nNot spectral bass.'
    },
    density: {
        name: 'Density',
        description: 'Smoothed spectral-flux density projection.',
        source: 'AudioFrame.b legacy density projection',
        range: '0.00..1.00',
        tooltip: 'Motion density from spectral flux.\nNot bass level.'
    },
    melodyPresence: {
        name: 'Melody Presence',
        description: 'Smoothed tonal/melodic presence projection.',
        source: 'AudioFrame.m / VisualFeatureFrame.melody',
        range: '0.00..1.00',
        tooltip: 'Tonal melody presence.\nNot a MIDI melody track.'
    },
    fxPresence: {
        name: 'FX Presence',
        description: 'Smoothed high-transient and noise-like FX presence.',
        source: 'AudioFrame.t legacy FX projection',
        range: '0.00..1.00',
        tooltip: 'High-transient FX presence.\nNot a treble EQ meter.'
    },
    vocal: {
        name: 'Vocal',
        description: 'Formant-weighted vocal presence estimate.',
        source: 'VisualFeatureFrame.vocal',
        range: '0.00..1.00',
        tooltip: 'Vocal-formant presence.\nNot lyric or voice ID.'
    },
    fx: {
        name: 'FX',
        description: 'Noise, brightness, and transient FX feature estimate.',
        source: 'VisualFeatureFrame.fx',
        range: '0.00..1.00',
        tooltip: 'FX/noise feature strength.\nNot the FX Presence projection.'
    },
    beatImpulse: {
        name: 'Beat Impulse',
        description: 'Renderer beat-event decay used for visual impulses.',
        source: 'State.beatDecay',
        range: '0.00..1.00',
        tooltip: 'Decaying beat impulse.\nNot raw beat strength.'
    },
    progress: {
        name: 'Progress',
        description: 'Playback position through the loaded track.',
        source: 'State.currentTime / State.duration',
        range: '0%..100%',
        tooltip: 'Track playback progress.\nNot a musical section score.'
    },
    dynamicsState: {
        name: 'Dynamics State',
        description: 'Current macro dynamics state from normalized energy ratio.',
        source: 'AudioFrame.state and AudioFrame.eRatio',
        range: 'IDLE, HIGH, LOW, LOW [DROP], LOW [OVERLOAD]',
        tooltip: 'Macro energy state.\nNot genre or section label.'
    }
};

export type DashboardMetricKey = keyof typeof dashboardMetricMetadata;
