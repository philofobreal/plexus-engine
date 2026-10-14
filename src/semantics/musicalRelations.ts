import type { MusicalEntityRegistry, MusicalRelation } from '../types/musicalEntities';

/** Evidence relations, not artistic motifs, intent, cues or XR scoring events. */
export function projectMusicalRelations(registry: MusicalEntityRegistry, maxRelations = 10000): {
    identity: MusicalEntityRegistry['identity']; confidence: null; consumerUse: 'diagnostic-only';
    xrScoring: 'ineligible'; relations: MusicalRelation[];
} {
    if (registry.version !== 1 || registry.algorithm !== 'experimental-musical-entities-v1'
        || registry.consumerUse !== 'diagnostic-only' || registry.xrScoring !== 'ineligible'
        || registry.confidence !== null || registry.groundTruthStatus !== false
        || !Number.isSafeInteger(maxRelations) || maxRelations < 0 || maxRelations > 100000)
        throw new Error('Invalid research relation contract or budget');
    const relations: MusicalRelation[] = [];
    const add = (r: MusicalRelation) => {
        if (relations.length >= maxRelations) throw new Error('Relation budget exceeded');
        relations.push(r);
    };
    const active = registry.assignments.filter(a => a.sourceId !== null);
    const previousMotif = new Map<string, typeof active[number]>();
    for (let i = 0; i < active.length; i++) {
        const a = active[i];
        for (let j = i - 1; j >= 0; j--) {
            const b = active[j];
            if (a.sourceId !== b.sourceId && a.startSample < b.endSample && b.startSample < a.endSample)
                add({ kind: 'source-coactivity', observationIds: [b.observationId, a.observationId],
                    sourceIds: [b.sourceId!, a.sourceId!], motifId: null,
                    startSample: Math.max(a.startSample, b.startSample), endSample: Math.min(a.endSample, b.endSample) });
        }
        if (a.motifId) {
            const previous = previousMotif.get(a.motifId);
            // Simultaneous motif sharing is coactivity, not a chronological return/handoff.
            if (previous && previous.endSample <= a.startSample)
                add({ kind: previous.sourceId === a.sourceId ? 'motif-return-candidate' : 'motif-handoff-candidate',
                    observationIds: [previous.observationId, a.observationId], sourceIds: [previous.sourceId!, a.sourceId!],
                    motifId: a.motifId, startSample: a.startSample, endSample: a.endSample });
            if (!previous || a.endSample >= previous.endSample) previousMotif.set(a.motifId, a);
        }
    }
    return { identity: { ...registry.identity }, confidence: null, consumerUse: 'diagnostic-only', xrScoring: 'ineligible', relations };
}
