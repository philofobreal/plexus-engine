const STAGES = [
    { label: 'Rhythm', threshold: 0 },
    { label: 'Structure', threshold: 0.15 },
    { label: 'Visual Journey', threshold: 0.55 },
    { label: 'Preparing Preview', threshold: 0.9 }
];

/**
 * User-facing analysis progress (design doc §13): the real AudioEngine progress value (0..1,
 * currently just "Decoding audio..." then "Analyzing music...") is bucketed into four friendly
 * stage labels here. No DSP terminology is ever shown to the user.
 */
export class AnalyzingScreen {
    readonly root: HTMLElement;
    private readonly trackNameEl: HTMLElement;
    private readonly stageEls: HTMLElement[];

    constructor() {
        this.root = document.createElement('div');
        this.root.className = 'mvp-centered-screen';
        this.root.innerHTML = `
            <div class="mvp-analyzing-card">
                <div class="mvp-analyzing-track">
                    <div class="mvp-analyzing-thumb"></div>
                    <div>
                        <p class="mvp-analyzing-name">Analyzing your track</p>
                        <p class="mvp-analyzing-meta mvp-analyzing-file"></p>
                    </div>
                </div>
                <div class="mvp-stage-row">
                    ${STAGES.map((s, i) => `
                        ${i > 0 ? '<div class="mvp-stage-connector"></div>' : ''}
                        <div class="mvp-stage" data-stage="${i}">
                            <div class="mvp-stage-dot">${i === 0 ? '♪' : i === 1 ? '▦' : i === 2 ? '✦' : '○'}</div>
                            <div class="mvp-stage-label">${s.label}</div>
                            <div class="mvp-stage-status">Pending</div>
                        </div>
                    `).join('')}
                </div>
                <div class="mvp-analyzing-note">
                    <span>&#9889;</span>
                    <span>Plexus is mapping the energy, emotion, and flow of your track. This may take a few moments.</span>
                </div>
            </div>
        `;
        this.trackNameEl = this.root.querySelector('.mvp-analyzing-file')!;
        this.stageEls = Array.from(this.root.querySelectorAll('.mvp-stage'));
    }

    setTrackName(name: string): void {
        this.trackNameEl.textContent = name;
    }

    setProgress(progress: number): void {
        let activeIndex = 0;
        for (let i = STAGES.length - 1; i >= 0; i--) {
            if (progress >= STAGES[i].threshold) { activeIndex = i; break; }
        }
        const connectors = Array.from(this.root.querySelectorAll('.mvp-stage-connector'));
        this.stageEls.forEach((el, i) => {
            const status = el.querySelector('.mvp-stage-status')!;
            el.classList.remove('is-done', 'is-active');
            if (i < activeIndex) { el.classList.add('is-done'); status.textContent = 'Complete'; }
            else if (i === activeIndex) { el.classList.add('is-active'); status.textContent = progress >= 1 ? 'Complete' : 'Analyzing…'; }
            else { status.textContent = 'Pending'; }
            const connector = connectors[i - 1];
            if (connector) connector.classList.toggle('is-done', i <= activeIndex);
        });
    }
}
