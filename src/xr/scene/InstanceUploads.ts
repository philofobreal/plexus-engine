// Bounded instance-buffer uploads for the XR scene's instanced draws (ADR-009). Pools are
// preallocated at their full capacity; only the drawn prefix is uploaded when it is rewritten, and
// an empty draw uploads nothing.

import type * as THREE from 'three';

/**
 * Flags the first `count` instances of each per-instance attribute for upload. Nothing is drawn
 * beyond `count`, so the rest of the buffer is never re-sent; with `count` 0 nothing is uploaded at
 * all. A later call before the next render replaces the pending range (only the latest prefix is drawn).
 */
export function markAttributesWritten(attributes: readonly (THREE.BufferAttribute | null)[], count: number): void {
    if (!(count > 0)) return;
    for (const attribute of attributes) {
        if (!attribute) continue;
        attribute.clearUpdateRanges();
        attribute.addUpdateRange(0, count * attribute.itemSize);
        attribute.needsUpdate = true;
    }
}
