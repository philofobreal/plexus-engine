// Pure, deterministic hand selection for one accepted score slot (ADR-009). The policy owns only
// WHICH hand plays; density (Activity), shape (Variation) and physical constraints stay with the
// score planner. Automation context modulates the realization inside the chosen pattern but never
// switches the user's pattern. No randomness: ratios use error diffusion, variety uses a hash.

import type { RhythmTexture } from './RhythmTypes';
import type { HandLead, HandPattern } from './RhythmGenerationProfile';

export type Hand = 'left' | 'right';

/** Target share of primary events for the lead hand (a goal, always below physical limits). */
export const LEAD_SHARE = 0.65;

export interface HandSlot {
    readonly time: number;
    readonly eventIndex: number;
    readonly eventType: 1 | 2 | 3;
    /** Position inside the bar, in beats [0, 4). */
    readonly beatPhase: number;
    readonly beatSec: number;
    readonly phraseIndex: number;
    readonly phraseStart: number;
    readonly texture: RhythmTexture;
    /** Normalized automation behaviour energy [0, 1]. */
    readonly energy: number;
    /** True on the first slot after an automation point change. */
    readonly pointChanged: boolean;
    /** Independent: whether this onset belongs to the primary stream, and both stream sizes. */
    readonly primaryStream: boolean;
    readonly phrasePrimary: number;
    readonly phraseSecondary: number;
}

export interface HandReadiness {
    ready(hand: Hand): boolean;
}

const other = (hand: Hand): Hand => (hand === 'left' ? 'right' : 'left');

/** Deterministic [0, 1) hash of small integers. */
export function hash01(a: number, b: number): number {
    let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
}

/** On/near the beat, allowing a small timing tolerance. */
export function isOnBeat(beatPhase: number): boolean {
    const fraction = beatPhase - Math.floor(beatPhase);
    return fraction < 0.15 || fraction > 0.85;
}

export class RhythmHandPolicy {
    private readonly pattern: HandPattern;
    private readonly lead: HandLead;
    /** Hard/Expert: an unready alternate hand hands the onset to the other hand instead of dropping it. */
    private readonly handOver: boolean;
    /** Historical alternation cursor, flipped after every realized group. */
    private nextHand: Hand = 'left';
    /** Error-diffusion balance for the lead share. */
    private balance = 0;

    constructor(pattern: HandPattern, lead: HandLead, handOver = false) {
        this.pattern = pattern;
        this.lead = lead;
        this.handOver = handOver;
    }

    /** Hand for a single target, or null to leave the onset unplayed. */
    choose(slot: HandSlot, hands: HandReadiness): Hand | null {
        switch (this.pattern) {
            case 'call-response': return this.callResponse(slot, hands);
            case 'independent': return this.independent(slot, hands);
            case 'together':
            case 'alternate':
            default: return this.alternate(slot, hands);
        }
    }

    /** Records the realized group so alternation and balance follow what was actually placed. */
    commit(hand: Hand, pair: boolean): void {
        this.nextHand = other(hand);
        if (!pair && this.lead !== 'even') this.balance += LEAD_SHARE - (hand === this.lead ? 1 : 0);
    }

    private alternate(slot: HandSlot, hands: HandReadiness): Hand | null {
        if (this.lead === 'even') {
            // Historical behaviour, byte-for-byte: strict alternation; an unready hand skips the onset.
            if (this.pattern === 'alternate' && !this.handOver) return hands.ready(this.nextHand) ? this.nextHand : null;
            return this.fallback(this.nextHand, hands);
        }
        const lead = this.lead as Hand;
        // A new scene starts on the lead hand; downbeats belong to it; otherwise error diffusion
        // keeps the lead share near LEAD_SHARE with a light deterministic irregularity.
        let preferred: Hand;
        if (slot.pointChanged || (isOnBeat(slot.beatPhase) && slot.beatPhase < 1)) preferred = lead;
        else {
            const wantsLead = this.balance + LEAD_SHARE >= 0.5;
            const nudge = hash01(slot.eventIndex, slot.phraseIndex) < 0.1;
            preferred = wantsLead !== nudge ? lead : other(lead);
        }
        return this.fallback(preferred, hands);
    }

    /**
     * Call & Response: one hand carries a bar-group "call", the other answers the next group.
     * Calls are one bar on impact/drive (or a strong build) and two bars otherwise. With a lead,
     * the lead hand opens every phrase with a call and the other hand answers with a half-length
     * response (a 2:1 cycle). An unready caller leaves the onset empty rather than breaking the call.
     */
    private callResponse(slot: HandSlot, hands: HandReadiness): Hand | null {
        const bars = slot.texture === 'impact' || slot.texture === 'drive' || (slot.texture === 'build' && slot.energy >= 0.65) ? 1 : 2;
        const elapsedBars = Math.max(0, slot.time - slot.phraseStart) / (slot.beatSec * 4) + 1e-9;
        let caller: Hand;
        if (this.lead === 'even') {
            const opener: Hand = slot.phraseIndex % 2 === 0 ? 'left' : 'right';
            caller = Math.floor(elapsedBars / bars) % 2 === 0 ? opener : other(opener);
        } else {
            const unit = bars / 2; // call = 2 units, answer = 1 unit
            caller = Math.floor(elapsedBars / unit) % 3 < 2 ? this.lead : other(this.lead);
        }
        return hands.ready(caller) ? caller : null;
    }

    /**
     * Independent: two musically motivated streams (primary: dense impacts and strong-beat
     * accents; secondary: everything else) with low correlation between the hands. The lead hand
     * takes the denser stream (Even: primary is left). A phrase lacking one stream falls back to
     * alternation instead of inventing material.
     */
    private independent(slot: HandSlot, hands: HandReadiness): Hand | null {
        if (slot.phrasePrimary === 0 || slot.phraseSecondary === 0) return this.fallback(this.nextHand, hands);
        const primary = slot.primaryStream;
        const primaryDenser = slot.phrasePrimary >= slot.phraseSecondary;
        const primaryHand: Hand = this.lead === 'even' ? 'left'
            : primaryDenser ? this.lead as Hand : other(this.lead as Hand);
        const hand = primary ? primaryHand : other(primaryHand);
        return hands.ready(hand) ? hand : null;
    }

    private fallback(preferred: Hand, hands: HandReadiness): Hand | null {
        if (hands.ready(preferred)) return preferred;
        return hands.ready(other(preferred)) ? other(preferred) : null;
    }
}
