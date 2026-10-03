// The in-game menu as pure data (ADR-009 Addendum O): screens, their layout on the VR panel canvas,
// and what activating an item does. No Three.js, no DOM. The VR panel (`scene/XrMenuPanel`) draws
// and hit-tests this layout; the desktop command drawer renders the same settings description
// (`XR_SETTINGS`, `XR_SETTING_SECTIONS`) and the same results summary, so both menus offer the same
// choices in the same order.
//
// Screens: Main (track ready), Pause, Results (song finished) and Settings (one tab per settings
// section). "Back" always returns to the screen the session state implies, so a setting that
// rewinds the song lands the player on Main, not on a stale Pause.

import { scoreRank, type RhythmSessionSnapshot, type RhythmSessionState } from '../gameplay';
import {
    changeScope, XR_SETTING_SECTIONS, XR_SETTINGS, type XrSettingDescriptor, type XrSettings, type XrSettingScope,
    type XrSettingSectionId
} from './XrSettings';

export type XrMenuScreen = 'main' | 'pause' | 'results' | 'settings';

export interface XrMenuState {
    readonly screen: XrMenuScreen;
    readonly tab: XrSettingSectionId;
    /** Item under the active pointer (null = none). */
    readonly hover: string | null;
}

/** Final numbers of a finished song (shared by the VR Results screen and the desktop drawer). */
export interface XrMenuResults {
    readonly rank: string;
    /** 0..1 */
    readonly accuracy: number;
    readonly score: number;
    readonly maxCombo: number;
    readonly hits: number;
    readonly misses: number;
    readonly flawlessSections: number;
    readonly sections: number;
}

/** Everything the menu shows that the host owns (plain data, rebuilt whenever it changes). */
export interface XrMenuContext {
    readonly settings: XrSettings;
    readonly sessionState: RhythmSessionState;
    readonly trackTitle: string;
    /** The chart is being (re)generated: Start waits. */
    readonly busy: boolean;
    /** A playable chart is loaded. */
    readonly canStart: boolean;
    readonly status: string;
    readonly results: XrMenuResults | null;
    /** Where the menu is used: the headset (laser + trigger, Exit VR) or the desktop (mouse / keyboard). */
    readonly input?: 'vr' | 'desktop';
}

export type XrMenuCommand =
    | { readonly type: 'start' }
    | { readonly type: 'resume' }
    | { readonly type: 'restart' }
    | { readonly type: 'exit-vr' }
    | { readonly type: 'settings-changed'; readonly settings: XrSettings; readonly scope: XrSettingScope };

export type XrMenuItemKind = 'button' | 'tab' | 'option' | 'step';

export interface XrMenuItem {
    readonly id: string;
    readonly kind: XrMenuItemKind;
    readonly label: string;
    /** Canvas pixels (`MENU_CANVAS`), top-left origin. */
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly selected: boolean;
    readonly disabled: boolean;
    /** Primary call to action (drawn emphasized). */
    readonly primary: boolean;
    readonly hint: string;
}

export type XrMenuTextRole = 'title' | 'heading' | 'label' | 'body' | 'muted' | 'value' | 'accent';

export interface XrMenuText {
    readonly text: string;
    readonly x: number;
    readonly y: number;
    readonly size: number;
    readonly role: XrMenuTextRole;
    readonly align: 'left' | 'center' | 'right';
    /** Long text wraps onto up to this many lines (line height 1.2 x size) before shrinking. */
    readonly maxLines: number;
}

export interface XrMenuLayout {
    readonly items: readonly XrMenuItem[];
    readonly texts: readonly XrMenuText[];
}

/** VR panel canvas in pixels; the panel keeps this aspect ratio. */
export const MENU_CANVAS = { width: 1024, height: 704 } as const;
const MARGIN = 40;
const BUTTON_W = 440;
const BUTTON_H = 64;
const BUTTON_GAP = 14;
const ROW_H = 66;
const LABEL_W = 250;
const OPTION_GAP = 8;
/** A VR stepper moves a range setting in tenths of its span (a slider is too fiddly with a laser). */
const STEPS_PER_RANGE = 10;

export const DEFAULT_MENU_STATE: XrMenuState = Object.freeze({ screen: 'main', tab: XR_SETTING_SECTIONS[0].id, hover: null });

/** The screen a session state returns to (Back, and whenever the menu opens on its own). */
export function menuHomeScreen(state: RhythmSessionState): Exclude<XrMenuScreen, 'settings'> {
    return state === 'paused' || state === 'playing' ? 'pause' : state === 'finished' ? 'results' : 'main';
}

/** Results of a finished session snapshot (null when there is nothing to report). */
export function menuResults(snapshot: RhythmSessionSnapshot): XrMenuResults | null {
    if (!snapshot.totalNotes) return null;
    const accuracy = snapshot.maxScore ? snapshot.score / snapshot.maxScore : 0;
    // Sections with targets complete when their last target resolves; flawless = every target perfect
    // (the song map's definition, Addendum K).
    const completed = (snapshot.sections ?? []).filter(s => s.completedAt !== null && s.resolved > 0);
    return { rank: scoreRank(accuracy), accuracy, score: snapshot.score, maxCombo: snapshot.maxCombo, hits: snapshot.hitCount,
        misses: snapshot.missCount, flawlessSections: completed.filter(s => s.misses === 0 && s.perfects === s.resolved).length,
        sections: completed.length };
}

/** One-line summary, e.g. "Rank S - 91.4% - 123 456 pts - max combo 87 - 3/5 flawless sections". */
export function formatResults(results: XrMenuResults): string {
    const points = String(Math.round(results.score)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `Rank ${results.rank} - ${(results.accuracy * 100).toFixed(1)}% - ${points} pts - max combo ${results.maxCombo}`
        + (results.sections ? ` - ${results.flawlessSections}/${results.sections} flawless sections` : '');
}

function item(id: string, kind: XrMenuItemKind, label: string, x: number, y: number, w: number, h: number,
    options: Partial<Pick<XrMenuItem, 'selected' | 'disabled' | 'primary' | 'hint'>> = {}): XrMenuItem {
    return { id, kind, label, x, y, w, h, selected: options.selected ?? false, disabled: options.disabled ?? false,
        primary: options.primary ?? false, hint: options.hint ?? '' };
}

function text(value: string, x: number, y: number, size: number, role: XrMenuTextRole, align: XrMenuText['align'] = 'left', maxLines = 1): XrMenuText {
    return { text: value, x, y, size, role, align, maxLines };
}

/** Vertically stacked, centered action buttons starting at `top`. */
function buttonStack(top: number, buttons: readonly (readonly [string, string, Partial<Pick<XrMenuItem, 'disabled' | 'primary' | 'hint'>>])[]): XrMenuItem[] {
    const x = (MENU_CANVAS.width - BUTTON_W) / 2;
    return buttons.map(([id, label, options], i) => item(id, 'button', label, x, top + i * (BUTTON_H + BUTTON_GAP), BUTTON_W, BUTTON_H, options));
}

function settingSummary(settings: XrSettings): string {
    const label = (id: string) => {
        const descriptor = XR_SETTINGS.find(d => d.id === id);
        if (!descriptor || descriptor.kind !== 'choice') return '';
        const value = descriptor.read(settings);
        return descriptor.choices.find(c => c.value === value)?.label ?? value;
    };
    return `${label('difficulty')} - ${label('noteSpeed')} speed - ${label('playSpace')} space`;
}

function scopeNote(scope: XrSettingScope): string {
    return scope === 'presentation' ? '' : ' Changing it restarts the song.';
}

/** Rows of one settings section: a label and its options (or a - value + stepper). */
function settingRows(settings: XrSettings, tab: XrSettingSectionId, top: number): { items: XrMenuItem[]; texts: XrMenuText[] } {
    const items: XrMenuItem[] = [], texts: XrMenuText[] = [];
    const left = MARGIN + LABEL_W, width = MENU_CANVAS.width - MARGIN - left;
    let y = top;
    for (const descriptor of XR_SETTINGS.filter(d => d.section === tab)) {
        texts.push(text(descriptor.label, MARGIN, y + ROW_H / 2 - 4, 24, 'label'));
        if (descriptor.kind === 'choice') {
            const current = descriptor.read(settings), n = descriptor.choices.length;
            const w = (width - (n - 1) * OPTION_GAP) / n;
            descriptor.choices.forEach((choice, i) => items.push(item(`opt:${descriptor.id}:${choice.value}`, 'option', choice.label,
                left + i * (w + OPTION_GAP), y, w, ROW_H - 14, { selected: choice.value === current, hint: choice.hint + scopeNote(descriptor.scope) })));
        } else {
            const value = descriptor.read(settings), stepW = 90;
            const hint = `${descriptor.label}: ${value} (${descriptor.min}-${descriptor.max}).${descriptor.hint ? ` ${descriptor.hint}` : ''}${scopeNote(descriptor.scope)}`;
            items.push(item(`step:${descriptor.id}:-1`, 'step', '-', left, y, stepW, ROW_H - 14, { disabled: value <= descriptor.min, hint }));
            items.push(item(`step:${descriptor.id}:1`, 'step', '+', left + width - stepW, y, stepW, ROW_H - 14, { disabled: value >= descriptor.max, hint }));
            texts.push(text(String(value), left + width / 2, y + (ROW_H - 14) / 2 + 2, 30, 'value', 'center'));
        }
        y += ROW_H;
    }
    return { items, texts };
}

/** The full layout of a screen. Pure: equal inputs give equal layouts. */
export function menuLayout(state: XrMenuState, context: XrMenuContext): XrMenuLayout {
    const items: XrMenuItem[] = [], texts: XrMenuText[] = [];
    const center = MENU_CANVAS.width / 2;
    const footerY = MENU_CANVAS.height - MARGIN - 8;
    if (state.screen === 'settings') {
        texts.push(text('SETTINGS', MARGIN, 58, 34, 'title'));
        texts.push(text(context.busy ? context.status || 'Updating...' : context.trackTitle, MENU_CANVAS.width - MARGIN, 58, 20, 'muted', 'right'));
        const tabs = XR_SETTING_SECTIONS, tabW = (MENU_CANVAS.width - 2 * MARGIN - (tabs.length - 1) * OPTION_GAP) / tabs.length;
        const tabHint = context.input === 'desktop' ? 'Left / right arrow keys also switch tabs.' : 'Thumbstick left / right also switches tabs.';
        tabs.forEach((section, i) => items.push(item(`tab:${section.id}`, 'tab', section.title, MARGIN + i * (tabW + OPTION_GAP), 92, tabW, 56,
            { selected: section.id === state.tab, hint: tabHint })));
        const rows = settingRows(context.settings, state.tab, 168);
        items.push(...rows.items); texts.push(...rows.texts);
        const hovered = items.find(i => i.id === state.hover);
        texts.push(text(hovered?.hint ?? '', MARGIN, MENU_CANVAS.height - 122, 21, 'muted', 'left', 2));
        items.push(item('action:back', 'button', 'Back', MARGIN, MENU_CANVAS.height - 24 - 56, 220, 56));
        return { items, texts };
    }
    if (state.screen === 'results' && context.results) {
        const r = context.results;
        texts.push(text('RESULTS', center, 70, 34, 'title', 'center'));
        texts.push(text(context.trackTitle, center, 108, 22, 'muted', 'center'));
        texts.push(text(r.rank, center, 196, 96, 'accent', 'center'));
        texts.push(text(`${(r.accuracy * 100).toFixed(1)}%`, center, 268, 34, 'value', 'center'));
        const points = String(Math.round(r.score)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        texts.push(text(`${points} pts  -  max combo ${r.maxCombo}  -  ${r.hits} hits, ${r.misses} misses`, center, 312, 22, 'body', 'center'));
        if (r.sections) texts.push(text(`${r.flawlessSections} / ${r.sections} sections flawless`, center, 344, 22, 'body', 'center'));
        items.push(...buttonStack(388, withExit(context, [['action:restart', 'Play again', { primary: true }], ['action:settings', 'Settings', {}]])));
        return { items, texts };
    }
    const paused = state.screen === 'pause';
    texts.push(text(paused ? 'PAUSED' : 'PLEXUS XR', center, 78, 40, 'title', 'center'));
    texts.push(text(context.trackTitle || 'No track loaded', center, 122, 24, 'body', 'center'));
    texts.push(text(context.busy ? context.status || 'Updating choreography...' : settingSummary(context.settings), center, 160, 20, 'muted', 'center'));
    const ready = context.canStart && !context.busy;
    items.push(...buttonStack(204, withExit(context, paused
        ? [['action:resume', 'Resume', { primary: true }], ['action:restart', 'Restart', {}], ['action:settings', 'Settings', {}]]
        : [['action:start', 'Start', { primary: true, disabled: !ready }], ['action:settings', 'Settings', {}]])));
    texts.push(text(context.input === 'desktop'
        ? 'Mouse or arrow keys + Enter to choose. Esc: back / resume. Space: play / pause.'
        : 'Point with a controller, pull the trigger to choose. Grip: pause / back.', center, footerY, 20, 'muted', 'center'));
    return { items, texts };
}

type ButtonSpec = readonly [string, string, Partial<Pick<XrMenuItem, 'disabled' | 'primary' | 'hint'>>];

/** Exit VR exists only in the headset. */
function withExit(context: XrMenuContext, buttons: ButtonSpec[]): ButtonSpec[] {
    return context.input === 'desktop' ? buttons : [...buttons, ['action:exit', 'Exit VR', {}]];
}

export type XrMenuDirection = 'next' | 'previous' | 'left' | 'right' | 'up' | 'down';

/**
 * Keyboard focus movement over the enabled items (the hover is the focus). Next / previous follow
 * reading order and wrap; arrows move spatially to the nearest item that way. Left / right past the
 * row's end switch the Settings tab, like the thumbstick. With nothing focused, any key focuses the
 * first enabled item (the primary action on the button screens).
 */
export function moveMenuFocus(state: XrMenuState, layout: XrMenuLayout, direction: XrMenuDirection): XrMenuState {
    const items = layout.items.filter(i => !i.disabled);
    if (!items.length) return state;
    const current = items.find(i => i.id === state.hover);
    if (!current) return { ...state, hover: items[0].id };
    if (direction === 'next' || direction === 'previous') {
        const index = items.indexOf(current), step = direction === 'next' ? 1 : -1;
        return { ...state, hover: items[(index + step + items.length) % items.length].id };
    }
    const cx = current.x + current.w / 2, cy = current.y + current.h / 2;
    const horizontal = direction === 'left' || direction === 'right', sign = direction === 'right' || direction === 'down' ? 1 : -1;
    let best: XrMenuItem | null = null, bestScore = Infinity;
    for (const candidate of items) {
        if (candidate === current) continue;
        const dx = candidate.x + candidate.w / 2 - cx, dy = candidate.y + candidate.h / 2 - cy;
        const along = horizontal ? dx * sign : dy * sign, across = Math.abs(horizontal ? dy : dx);
        // Horizontal moves stay on the row; vertical moves take the nearest row, then the nearest column.
        if (along <= 1 || (horizontal && across > current.h / 2)) continue;
        const score = along + across * 3;
        if (score < bestScore) { bestScore = score; best = candidate; }
    }
    if (best) return { ...state, hover: best.id };
    if (horizontal && state.screen === 'settings') {
        const switched = switchMenuTab(state, sign as -1 | 1);
        return { ...switched, hover: `tab:${switched.tab}` };
    }
    return state;
}

/** The enabled item at a canvas point, or null. */
export function menuItemAt(layout: XrMenuLayout, x: number, y: number): XrMenuItem | null {
    for (const candidate of layout.items) {
        if (x >= candidate.x && x <= candidate.x + candidate.w && y >= candidate.y && y <= candidate.y + candidate.h) return candidate;
    }
    return null;
}

function rangeStep(descriptor: Extract<XrSettingDescriptor, { kind: 'range' }>): number {
    return Math.max(descriptor.step, (descriptor.max - descriptor.min) / STEPS_PER_RANGE);
}

/**
 * Activates an item: navigation changes the menu state, everything else becomes a command for
 * the host (which owns playback and the settings store). Disabled or unknown items do nothing.
 */
export function activateMenuItem(state: XrMenuState, context: XrMenuContext, layout: XrMenuLayout, id: string):
    { readonly state: XrMenuState; readonly command: XrMenuCommand | null } {
    const target = layout.items.find(i => i.id === id);
    if (!target || target.disabled) return { state, command: null };
    const [kind, key, value] = id.split(':');
    if (kind === 'tab') return { state: { ...state, tab: key as XrSettingSectionId }, command: null };
    if (kind === 'action') {
        switch (key) {
            case 'settings': return { state: { ...state, screen: 'settings' }, command: null };
            case 'back': return { state: { ...state, screen: menuHomeScreen(context.sessionState) }, command: null };
            case 'start': return { state, command: { type: 'start' } };
            case 'resume': return { state, command: { type: 'resume' } };
            case 'restart': return { state, command: { type: 'restart' } };
            case 'exit': return { state, command: { type: 'exit-vr' } };
            default: return { state, command: null };
        }
    }
    const descriptor = XR_SETTINGS.find(d => d.id === key);
    if (!descriptor) return { state, command: null };
    const next = descriptor.kind === 'choice' ? descriptor.write(context.settings, value)
        : descriptor.write(context.settings, Math.min(descriptor.max, Math.max(descriptor.min,
            descriptor.read(context.settings) + Number(value) * rangeStep(descriptor))));
    const scope = changeScope(context.settings, next);
    return { state, command: scope ? { type: 'settings-changed', settings: next, scope } : null };
}

/** Thumbstick tab switching on the Settings screen (wraps around). */
export function switchMenuTab(state: XrMenuState, step: -1 | 1): XrMenuState {
    if (state.screen !== 'settings') return state;
    const tabs = XR_SETTING_SECTIONS, index = tabs.findIndex(t => t.id === state.tab);
    return { ...state, tab: tabs[(index + step + tabs.length) % tabs.length].id };
}
