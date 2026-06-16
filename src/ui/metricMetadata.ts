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
        description: 'Smoothed tonal/melodic presence projection.',
        source: 'AudioFrame.melodyProj / VisualFeatureFrame.melody',
        range: '0.00..1.00',
        tooltip: 'Tonal melody presence.\nNot a MIDI melody track.'
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
    dynamicsState: {
        name: 'Dynamics State',
        description: 'Current macro dynamics state from normalized energy ratio.',
        source: 'AudioFrame.state and AudioFrame.eRatio',
        range: 'IDLE, HIGH, LOW, LOW [DROP], LOW [OVERLOAD]',
        tooltip: 'LOW: Csendesebb, építkező rész. A vizuál visszafogott, a vonalak vékonyabbak.\nHIGH: A szám fő része (Drop/Verze). Maximális vizuális mozgás és vonalsűrűség.\nLOW [DROP]: Hirtelen elnémulás vagy törés a fő részben. Vizuális villanás és felkészülés az újbóli robbanásra.\nLOW [OVERLOAD]: Extrém hangerő, túlvezérlés. A vizuális motor automatikusan tompítja a fényeket a szem kímélése érdekében.'
    }
};

export type DashboardMetricKey = keyof typeof dashboardMetricMetadata;
