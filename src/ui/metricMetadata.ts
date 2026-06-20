export interface MetricMetadata {
    name: string;
    description: string;
    source: string;
    range: string;
    tooltip: string;
}

export const dashboardMetricMetadata = {
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
        source: 'AudioFrame.densityProj',
        range: '0.00..1.00',
        tooltip: 'Motion density from spectral flux.\nNot bass level.'
    },
    melodyPresence: {
        name: 'Melody Presence',
        description: 'Smoothed spectral heuristic for tonal melodic presence.',
        source: 'AudioFrame.melodyProj / VisualFeatureFrame.melody',
        range: '0.00..1.00',
        tooltip: 'Spectral melody-presence heuristic.\nNot melody extraction or stem separation.'
    },
    vocal: {
        name: 'Vocal',
        description: 'Spectral vocal/formant heuristic gated by tonal and low-noise evidence.',
        source: 'VisualFeatureFrame.vocal',
        range: '0.00..1.00',
        tooltip: 'Vocal/formant-like spectral heuristic.\nNot vocal stem separation.'
    },
    fx: {
        name: 'FX',
        description: 'Noise, brightness, and transient estimate from Zero Crossing Rate, rolloff, and flatness.',
        source: 'VisualFeatureFrame.fx',
        range: '0.00..1.00',
        tooltip: 'FX/noise strength from ZCR and spectral rolloff.\nNot the FX Presence projection.'
    },
    beatImpulse: {
        name: 'Beat Impulse',
        description: 'Renderer decay from accepted percussive BeatEvents.',
        source: 'State.beatDecay from consumed BeatEvent[]',
        range: '0.00..1.00',
        tooltip: 'Decaying visual pulse from accepted percussive beat events.\nNot BPM, raw bass, or drum stem detection.'
    },
    dynamicsState: {
        name: 'Dynamics State',
        description: 'Current macro dynamics state from normalized energy ratio.',
        source: 'AudioFrame.state and AudioFrame.eRatio',
        range: 'IDLE, HIGH, LOW, LOW [DROP], LOW [OVERLOAD]',
        tooltip: 'LOW: Csendesebb, építkező rész. A vizuál visszafogott, a vonalak vékonyabbak.\nHIGH: A szám fő része (Drop/Verze). Maximális vizuális mozgás és vonalsűrűség.\nLOW [DROP]: Hirtelen elnémulás vagy törés a fő részben. Vizuális villanás és felkészülés az újbóli robbanásra.\nLOW [OVERLOAD]: Extrém hangerő, túlvezérlés. A vizuális motor automatikusan tompítja a fényeket a szem kímélése érdekében.'
    }
};

export type DashboardMetricKey = keyof typeof dashboardMetricMetadata;
