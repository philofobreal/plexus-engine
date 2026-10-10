// What the player is doing for the world right now (ADR-010): a pure function of the plan, the
// interaction snapshot and canonical song time, shared by the in-headset status plate and the
// tests. ASCII text only (the canvas draws it); the Tudatter title carries its accent as an escape.

import { encounterStageAt, eraAt } from './WorldTimeline';
import type { WorldInteractionSnapshot, WorldNoteRoleKind, WorldPlan } from './WorldTypes';

export interface WorldObjective {
    /** Era / stage title, e.g. "SEEDER CONSTRUCTION". */
    readonly title: string;
    /** One short line: the current objective and its progress. */
    readonly line: string;
    /** The role colour the objective asks for (null: ordinary targets). */
    readonly role: WorldNoteRoleKind | null;
}

const pct = (value: number) => `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;

export function currentWorldObjective(plan: WorldPlan, snapshot: WorldInteractionSnapshot, songTime: number): WorldObjective {
    const tally = snapshot.roleTally;
    const stage = encounterStageAt(plan, songTime);
    const encounter = snapshot.encounter;
    if (stage === 'detection') return { title: 'FENOM DETECTED', line: 'Anomaly rising. Violet targets will align the field.', role: 'sync' };
    if (stage === 'synchronization' && encounter) {
        return { title: 'FENOM SYNCHRONIZATION',
            line: `Field anchors ${encounter.anchorsHit}/${encounter.anchorsTotal} - stability ${pct(encounter.stability)}`, role: 'sync' };
    }
    if (stage === 'resolution' && encounter) {
        return { title: 'FENOM RESOLUTION', line: `Stability ${pct(encounter.stability)}${encounter.stabilizeHit ? ' - field locked' : ''}`, role: null };
    }
    const activation = plan.events.find(e => e.kind === 'activation');
    switch (eraAt(plan, songTime)) {
        case 'localhost':
            return activation && songTime >= activation.time
                ? { title: 'LOCALHOST', line: `Hall online - formation ${pct(snapshot.formation)}`, role: null }
                : { title: 'LOCALHOST', line: 'Waiting for the first signal.', role: null };
        case 'seeder':
            return { title: 'SEEDER CONSTRUCTION', line: `Gold energy targets ${tally.energy.hit}/${tally.energy.total} - formation ${pct(snapshot.formation)}`, role: 'energy' };
        case 'network':
            return { title: 'TUDATTÉR NETWORK', line: `White signal targets ${tally.signal.hit}/${tally.signal.total} - coherence ${pct(snapshot.coherence)}`, role: 'signal' };
        case 'fenom':
            return { title: 'FENOM', line: `Stability ${pct(encounter?.stability ?? 0)}`, role: null };
        case 'resolution':
            return { title: 'RESOLUTION', line: `Formation ${pct(snapshot.formation)} - coherence ${pct(snapshot.coherence)}`, role: null };
    }
}
