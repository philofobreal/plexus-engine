// Compact game-style command chrome for the /xr/ desktop page (ADR-009): a persistent corner menu
// button plus a slide-out command drawer that overlays the renderer without resizing it. This
// module owns only DOM structure, open/close state, Escape and focus handling. XrAppController
// keeps every behavioral decision (loading, playback, Enter VR) and wires the exposed elements.

import { DEFAULT_RHYTHM_GENERATION_SETTINGS, normalizeGenerationSettings, type RhythmGenerationSettings } from '../gameplay';

export type XrDrawerStatus = 'idle' | 'busy' | 'ready' | 'error';

const PANEL_ID = 'xr-command-drawer';
/** Spoken form of the menu button's status light (the LED itself is decorative). */
const STATUS_TEXT: Record<XrDrawerStatus, string> = { idle: 'no track loaded', busy: 'analyzing', ready: 'track ready', error: 'error' };

type GenerationKey = keyof RhythmGenerationSettings;
interface GenerationChoice { readonly value: string; readonly label: string; readonly hint: string }
interface GenerationGroup { readonly key: GenerationKey; readonly legend: string; readonly choices: readonly GenerationChoice[] }

/** User-facing generation axes: difficulty (Activity), complexity (Variation) and hand coordination. */
export const GENERATION_GROUPS: readonly GenerationGroup[] = [
    { key: 'difficulty', legend: 'Difficulty', choices: [
        { value: 'easy', label: 'Easy', hint: 'Slow and spacious: fewer targets, more free cuts, gentle moves.' },
        { value: 'normal', label: 'Normal', hint: 'The standard challenge.' },
        { value: 'hard', label: 'Hard', hint: 'Denser streams, faster hand moves, strictly directional cuts.' },
        { value: 'expert', label: 'Expert', hint: 'Maximum density and speed, chains of hard moves on big moments.' }] },
    { key: 'activity', legend: 'Activity', choices: [
        { value: 'macro', label: 'Calm', hint: 'Fewer targets, more room to breathe.' },
        { value: 'balanced', label: 'Balanced', hint: 'Standard target density.' },
        { value: 'active', label: 'Active', hint: 'As dense as the music and safe spacing allow.' }] },
    { key: 'variation', legend: 'Variation', choices: [
        { value: 'stable', label: 'Stable', hint: 'Few repeating patterns, mostly vertical cuts.' },
        { value: 'paired', label: 'Paired', hint: 'Two to three pattern families per scene.' },
        { value: 'expressive', label: 'Expressive', hint: 'Shorter phrases and the widest cut vocabulary.' }] },
    { key: 'handPattern', legend: 'Hands', choices: [
        { value: 'alternate', label: 'Alternate', hint: 'The hands take turns.' },
        { value: 'call-response', label: 'Call & Response', hint: 'One hand calls a bar, the other answers.' },
        { value: 'together', label: 'Together', hint: 'More two-hand accents on strong beats.' },
        { value: 'independent', label: 'Independent', hint: 'Each hand follows its own musical stream.' }] },
    { key: 'handLead', legend: 'Lead', choices: [
        { value: 'left', label: 'Left', hint: 'The left hand carries more primary beats.' },
        { value: 'even', label: 'Even', hint: 'Both hands share the work evenly.' },
        { value: 'right', label: 'Right', hint: 'The right hand carries more primary beats.' }] },
    { key: 'zones', legend: 'Zones', choices: [
        { value: 'split', label: 'Own side', hint: 'Each saber stays in its own half.' },
        { value: 'shared', label: 'Shared center', hint: 'Both sabers may also use the center lane.' },
        { value: 'cross', label: 'Crossover', hint: 'On energetic moments a saber reaches into the other half.' }] }
];

export class XrCommandDrawer {
    /** Pointer-transparent chrome layer; hidden entirely while an immersive session presents. */
    readonly root: HTMLDivElement;
    readonly menuButton: HTMLButtonElement;
    /** The drawer panel (keeps the historical `xr-launch-overlay` class). */
    readonly panel: HTMLDivElement;
    readonly fileInput: HTMLInputElement;
    readonly trackTitleEl: HTMLParagraphElement;
    readonly progressEl: HTMLParagraphElement;
    readonly errorEl: HTMLParagraphElement;
    readonly trackInfoEl: HTMLParagraphElement;
    readonly capabilityEl: HTMLParagraphElement;
    readonly enterVrButton: HTMLButtonElement;
    readonly previewButton: HTMLButtonElement;
    readonly wormholeToggle: HTMLInputElement;
    /** Generation controls: changes are reported; the controller decides when to regenerate. */
    readonly generationFieldset: HTMLFieldSetElement;
    onGenerationChange: ((settings: RhythmGenerationSettings) => void) | null = null;
    private generation: RhythmGenerationSettings = DEFAULT_RHYTHM_GENERATION_SETTINGS;
    private readonly generationInputs: { key: GenerationKey; input: HTMLInputElement }[] = [];
    private readonly generationHints = new Map<GenerationKey, HTMLParagraphElement>();
    private readonly doc: Document;
    private opened = false;
    private status: XrDrawerStatus = 'idle';
    private readonly handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Escape' || !this.opened || this.root.hidden) return;
        event.preventDefault();
        this.close();
    };

    constructor(doc: Document = document) {
        this.doc = doc;
        const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] => {
            const element = doc.createElement(tag);
            if (className) element.className = className;
            return element;
        };
        this.root = el('div', 'xr-chrome');

        this.menuButton = el('button', 'xr-menu-button');
        this.menuButton.type = 'button';
        this.menuButton.setAttribute('aria-controls', PANEL_ID);
        const icon = el('span', 'xr-menu-icon');
        icon.setAttribute('aria-hidden', 'true');
        icon.append(el('span'), el('span'), el('span'));
        const led = el('span', 'xr-menu-status');
        led.setAttribute('aria-hidden', 'true');
        this.menuButton.append(icon, led);
        this.menuButton.addEventListener('click', () => this.toggle());

        this.panel = el('div', 'xr-launch-overlay xr-drawer');
        this.panel.id = PANEL_ID;
        this.panel.setAttribute('role', 'region');
        this.panel.setAttribute('aria-label', 'Plexus XR commands');

        const title = el('h1', 'xr-launch-title');
        title.textContent = 'Plexus XR';
        const instructions = el('p', 'xr-launch-instructions');
        instructions.textContent = 'Desktop: blue = left click, pink = right click; cut direction is assisted. Space: play / pause. VR: follow the arrows with the matching saber; dots allow any direction. Paired targets share a beat. Trigger: start / resume. Grip: pause.';

        this.fileInput = el('input', 'xr-file-input');
        this.fileInput.type = 'file';
        this.fileInput.accept = 'audio/*';
        this.fileInput.setAttribute('aria-label', 'Choose audio track');

        this.trackTitleEl = el('p', 'xr-track-title');
        this.progressEl = el('p', 'xr-progress');
        this.progressEl.setAttribute('aria-live', 'polite');
        this.errorEl = el('p', 'xr-error');
        this.errorEl.setAttribute('role', 'alert');
        this.trackInfoEl = el('p', 'xr-track-info');
        this.capabilityEl = el('p', 'xr-capability');
        this.capabilityEl.textContent = 'Checking WebXR support...';

        this.enterVrButton = el('button', 'xr-enter-button');
        this.enterVrButton.type = 'button';
        this.enterVrButton.textContent = 'Enter VR';
        this.enterVrButton.disabled = true;
        this.previewButton = el('button', 'xr-preview-button');
        this.previewButton.type = 'button';
        this.previewButton.textContent = 'Play';
        this.previewButton.disabled = true;
        const actions = el('div', 'xr-actions');
        actions.append(this.enterVrButton, this.previewButton);

        this.wormholeToggle = el('input');
        this.wormholeToggle.type = 'checkbox';
        const wormholeLabel = el('label', 'xr-wormhole-toggle');
        wormholeLabel.append(this.wormholeToggle, doc.createTextNode(' Wormhole background'));

        this.generationFieldset = el('fieldset', 'xr-generation');
        const generationLegend = el('legend', 'xr-generation-title');
        generationLegend.textContent = 'Game settings';
        this.generationFieldset.append(generationLegend);
        for (const group of GENERATION_GROUPS) {
            const fieldset = el('fieldset', 'xr-segment');
            const legend = el('legend', 'xr-segment-legend');
            legend.textContent = group.legend;
            const options = el('div', 'xr-segment-options');
            for (const choice of group.choices) {
                const label = el('label', 'xr-segment-option');
                const input = el('input');
                input.type = 'radio';
                input.name = `xr-generation-${group.key}`;
                input.value = choice.value;
                input.addEventListener('change', () => { if (input.checked) this.selectGeneration(group.key, choice.value); });
                const text = el('span');
                text.textContent = choice.label;
                label.append(input, text);
                options.append(label);
                this.generationInputs.push({ key: group.key, input });
            }
            const hint = el('p', 'xr-segment-hint');
            hint.id = `xr-generation-hint-${group.key}`;
            fieldset.setAttribute('aria-describedby', hint.id);
            this.generationHints.set(group.key, hint);
            fieldset.append(legend, options, hint);
            this.generationFieldset.append(fieldset);
        }
        this.setGenerationSettings(DEFAULT_RHYTHM_GENERATION_SETTINGS);

        this.panel.append(title, instructions, this.fileInput, this.trackTitleEl, this.progressEl, this.errorEl,
            this.trackInfoEl, this.capabilityEl, this.generationFieldset, actions, wormholeLabel);
        this.root.append(this.menuButton, this.panel);
        doc.addEventListener('keydown', this.handleKeyDown);
        this.setStatus('idle');
        this.open();
    }

    get isOpen(): boolean { return this.opened; }

    open(): void { this.apply(true); }

    /** Closes the drawer; focus inside it returns to the menu button instead of being lost. */
    close(): void {
        const active = this.doc.activeElement;
        const focusInside = !!active && this.panel.contains(active);
        this.apply(false);
        if (focusInside) this.menuButton.focus({ preventScroll: true });
    }

    toggle(): void {
        if (this.opened) this.close(); else this.open();
    }

    setStatus(status: XrDrawerStatus): void {
        if (this.status === status && this.menuButton.dataset.status === status) return;
        this.status = status;
        this.menuButton.dataset.status = status;
        this.menuButton.title = STATUS_TEXT[status];
        this.applyLabel();
    }

    get generationSettings(): RhythmGenerationSettings { return this.generation; }

    /** Reflects settings in the controls without reporting a change. */
    setGenerationSettings(settings: Partial<RhythmGenerationSettings>): void {
        this.generation = normalizeGenerationSettings(settings);
        for (const { key, input } of this.generationInputs) input.checked = this.generation[key] === input.value;
        for (const group of GENERATION_GROUPS) {
            const hint = this.generationHints.get(group.key);
            const choice = group.choices.find(c => c.value === this.generation[group.key]);
            if (hint && choice) hint.textContent = choice.hint;
        }
    }

    private selectGeneration(key: GenerationKey, value: string): void {
        if (this.generation[key] === value) return;
        this.setGenerationSettings({ ...this.generation, [key]: value });
        this.onGenerationChange?.(this.generation);
    }

    /** Immersive sessions hide the desktop chrome without changing the drawer's open state. */
    setVisible(visible: boolean): void {
        this.root.hidden = !visible;
    }

    dispose(): void {
        this.doc.removeEventListener('keydown', this.handleKeyDown);
        this.root.remove();
    }

    private apply(open: boolean): void {
        this.opened = open;
        this.panel.dataset.open = String(open);
        this.panel.inert = !open;
        this.panel.setAttribute('aria-hidden', String(!open));
        this.menuButton.setAttribute('aria-expanded', String(open));
        this.applyLabel();
    }

    private applyLabel(): void {
        this.menuButton.setAttribute('aria-label', `${this.opened ? 'Close' : 'Open'} command menu, ${STATUS_TEXT[this.status]}`);
    }
}
