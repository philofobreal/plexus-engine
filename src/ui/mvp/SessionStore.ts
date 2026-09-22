import { MAX_CHECKPOINT_CHARS, normalizeCheckpoint, type SessionCheckpoint } from './sessionCheckpoint';
import { readTrackCheckpoint, removeTrackCheckpoint, saveTrackChanges, type TrackSaveChanges } from './metaTuningStorage';
import { decodeCheckpoint, encodeCheckpoint, MAX_EXPANDED_CHECKPOINT_CHARS } from './checkpointEncoding';

const POINTER = 'plexus-mvp-session:v1';
interface Pointer { fingerprint: string; token: string; valid: boolean }
export type SessionSaveError = 'too-large' | 'invalid-checkpoint' | 'storage' | 'changed';

/** Single-use restore capability survives tab closure. Large writes require explicit Save. */
export class SessionStore {
    private pointer: Pointer | null = null;
    private saveError: SessionSaveError | null = null;
    getSaveError(): SessionSaveError | null { return this.saveError; }
    private readPointer(): Pointer | null {
        const p = JSON.parse(localStorage.getItem(POINTER) ?? 'null');
        return p && typeof p.fingerprint === 'string' && typeof p.token === 'string' && typeof p.valid === 'boolean' ? p : null;
    }

    invalidate(): boolean {
        if (!this.pointer?.valid) return true;
        try {
            // An older tab must not disarm another tab's more recent save.
            if (this.readPointer()?.token === this.pointer.token) localStorage.setItem(POINTER, JSON.stringify({ ...this.pointer, valid: false }));
        }
        catch {
            try { removeTrackCheckpoint(this.pointer.fingerprint, this.pointer.token); }
            catch { return false; }
        }
        this.pointer.valid = false;
        return true;
    }

    discard(): boolean {
        if (!this.invalidate()) return false;
        const p = this.pointer;
        if (!p) return true;
        try { removeTrackCheckpoint(p.fingerprint, p.token); } catch { /* Invalid token already prevents replay. */ }
        return true;
    }

    async save(checkpoint: SessionCheckpoint, changes: TrackSaveChanges, stillCurrent: () => boolean): Promise<boolean> {
        this.saveError = null;
        const previous = this.pointer;
        let p: Pointer | null = null;
        try {
            if (!this.invalidate()) { this.saveError = 'storage'; return false; }
            const serialized = JSON.stringify(checkpoint);
            if (serialized.length > MAX_EXPANDED_CHECKPOINT_CHARS) { this.saveError = 'too-large'; return false; }
            if (!normalizeCheckpoint(checkpoint)) { this.saveError = 'invalid-checkpoint'; return false; }
            const stored = serialized.length <= MAX_CHECKPOINT_CHARS ? checkpoint : encodeCheckpoint(checkpoint);
            if (JSON.stringify(stored).length > MAX_CHECKPOINT_CHARS) { this.saveError = 'too-large'; return false; }
            p = { fingerprint: checkpoint.fingerprint, token: checkpoint.token, valid: false };
            // Invalidate the capability before publishing the atomic localStorage record.
            localStorage.setItem(POINTER, JSON.stringify(p));
            this.pointer = p;
            if (!stillCurrent()) { this.saveError = 'changed'; throw new Error('Workspace changed while saving.'); }
            if (!saveTrackChanges(p.fingerprint, { ...changes, checkpoint: stored })) throw new Error('Storage unavailable.');
            localStorage.setItem(POINTER, JSON.stringify({ ...p, valid: true }));
            p.valid = true;
            if (previous && previous.token !== p.token) {
                try { removeTrackCheckpoint(previous.fingerprint, previous.token); } catch { /* Orphan has no valid capability. */ }
            }
            return true;
        } catch {
            this.saveError ??= p ? 'storage' : 'invalid-checkpoint';
            if (p) {
                try { removeTrackCheckpoint(p.fingerprint, p.token); } catch { /* Invalid capability is fail-closed. */ }
            }
            return false;
        }
    }

    async consume(): Promise<SessionCheckpoint | null> {
        try {
            const p = this.readPointer();
            if (!p) return null;
            this.pointer = p;
            const valid = p.valid;
            if (!this.invalidate()) return null; // Burn the capability BEFORE reads, parsing or asynchronous decode.
            const raw = readTrackCheckpoint(p.fingerprint);
            const checkpoint = valid && JSON.stringify(raw).length <= MAX_CHECKPOINT_CHARS ? normalizeCheckpoint(decodeCheckpoint(raw)) : null;
            removeTrackCheckpoint(p.fingerprint, p.token);
            if (this.readPointer()?.token === p.token) localStorage.removeItem(POINTER);
            if (!checkpoint || checkpoint.token !== p.token || checkpoint.fingerprint !== p.fingerprint) return null;
            return checkpoint;
        } catch { return null; }
    }
}
