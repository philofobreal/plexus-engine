import type { WormholeHostRequest, WormholeHostResponse } from '../types/WormholeHostFrame';
import { assertWormholeRenderFrameStamp } from '../types/WormholeRenderFrame';
import { WormholeHostRenderSession } from './WormholeHostRenderSession';

const scope = self as unknown as {
    onmessage: ((event: MessageEvent<WormholeHostRequest>) => void) | null;
    postMessage(message: WormholeHostResponse, transfer?: Transferable[]): void;
};
let session: WormholeHostRenderSession | null = null, generation = 0, contextId: string | undefined;
scope.onmessage = event => {
    const message = event.data;
    try {
        if (!Number.isSafeInteger(message.generation) || message.generation < 0) throw Error('Invalid host generation');
        if (message.type === 'prepare') {
            if (message.generation < generation) return;
            if (message.contextId !== undefined && (typeof message.contextId !== 'string' || !message.contextId.trim() || message.contextId.length > 128)) throw Error('Invalid host context');
            session?.dispose(); generation = message.generation; contextId = message.contextId;
            // Omitted contextId is the retained legacy-v1 research adapter. The MVP producer
            // always negotiates its context and must supply a validated common frame stamp.
            session = new WormholeHostRenderSession(message.analysis, contextId !== undefined);
            scope.postMessage({ type: 'ready', generation, ...(contextId ? { contextId } : {}) }); return;
        }
        if (message.type === 'reset') {
            if (!session || message.generation < generation) return;
            if (message.contextId && message.contextId !== contextId) return;
            generation = message.generation;
            session.reset(); scope.postMessage({ type: 'ready', generation, ...(contextId ? { contextId } : {}) }); return;
        }
        if (message.generation !== generation || !session) return;
        if (contextId) {
            assertWormholeRenderFrameStamp(message.stamp);
            const stamp = message.stamp;
            if (stamp.contextId !== contextId || stamp.generation !== generation || stamp.requestSerial !== message.serial
                || stamp.songTime !== message.frame.currentTime || stamp.mode !== 'preview') throw Error('Mismatched host frame stamp');
        }
        const started = performance.now();
        const { bitmap, raster } = session.render(message.frame);
        try {
            scope.postMessage({ type: 'frame', generation, serial: message.serial, ...(message.stamp ? { stamp: message.stamp } : {}),
                bitmap, raster, renderMs: performance.now() - started }, [bitmap]);
        } catch (error) { bitmap.close(); throw error; }
    } catch (error) {
        session?.dispose(); session = null;
        scope.postMessage({ type: 'failure', generation, ...(contextId ? { contextId } : {}),
            message: error instanceof Error ? error.message : String(error) });
    }
};
