import { assertWormholeHostExactConfig, assertWormholeHostExactFrame, sameWormholeHostFrame, type WormholeHostFrame, type WormholeHostExactConfig, type WormholeHostRequest, type WormholeHostResponse } from '../types/WormholeHostFrame';
import { assertWormholeRenderFrameStamp } from '../types/WormholeRenderFrame';
import { WormholeHostRenderSession } from './WormholeHostRenderSession';

const scope = self as unknown as {
    onmessage: ((event: MessageEvent<WormholeHostRequest>) => void) | null;
    postMessage(message: WormholeHostResponse, transfer?: Transferable[]): void;
};
let session: WormholeHostRenderSession | null = null, generation = 0, contextId: string | undefined;
let exact: WormholeHostExactConfig | undefined, lastExactIndex = -1, lastSerial = 0, lastRevision = -1;
let lastExactFrame: WormholeHostFrame | null = null;
scope.onmessage = event => {
    const message = event.data;
    try {
        if (!Number.isSafeInteger(message.generation) || message.generation < 0) throw Error('Invalid host generation');
        if (message.type === 'prepare') {
            if (message.generation < generation) return;
            if (message.contextId !== undefined && (typeof message.contextId !== 'string' || !message.contextId.trim() || message.contextId.length > 128)) throw Error('Invalid host context');
            if (message.exact !== undefined) {
                assertWormholeHostExactConfig(message.exact);
                if (!message.contextId) throw Error('Exact host requires a negotiated context');
            }
            session?.dispose(); generation = message.generation; contextId = message.contextId;
            lastExactFrame = null;
            exact = message.exact ? { ...message.exact } : undefined; lastExactIndex = -1; lastSerial = 0; lastRevision = -1;
            // Omitted contextId is the retained legacy-v1 research adapter. The MVP producer
            // always negotiates its context and must supply a validated common frame stamp.
            session = new WormholeHostRenderSession(message.analysis, contextId !== undefined);
            scope.postMessage({ type: 'ready', generation, ...(contextId ? { contextId } : {}), ...(exact ? { exact } : {}) }); return;
        }
        if (message.type === 'reset') {
            if (!session || message.generation < generation) return;
            if (message.contextId && message.contextId !== contextId) return;
            if (exact) throw Error('Exact host retry requires a new job source');
            generation = message.generation;
            session.reset(); scope.postMessage({ type: 'ready', generation, ...(contextId ? { contextId } : {}) }); return;
        }
        if (message.generation !== generation || !session) return;
        let repeat = false;
        if (contextId) {
            assertWormholeRenderFrameStamp(message.stamp);
            const stamp = message.stamp;
            if (stamp.contextId !== contextId || stamp.generation !== generation || stamp.requestSerial !== message.serial
                || stamp.songTime !== message.frame.currentTime) throw Error('Mismatched host frame stamp');
            if (exact) {
                assertWormholeHostExactFrame(message.frame, stamp, exact);
                if (stamp.frameIndex < lastExactIndex || stamp.requestSerial <= lastSerial || stamp.presentationRevision < lastRevision)
                    throw Error('Out-of-order exact host frame');
                repeat = stamp.frameIndex === lastExactIndex;
                if (repeat && (!lastExactFrame || !sameWormholeHostFrame(lastExactFrame,message.frame))) throw Error('Repeated exact frame inputs changed');
                lastExactFrame = message.frame;
                lastExactIndex = stamp.frameIndex; lastSerial = stamp.requestSerial; lastRevision = stamp.presentationRevision;
            } else if (stamp.mode !== 'preview') throw Error('Preview host cannot accept exact frames');
        }
        const started = performance.now();
        const { bitmap, raster } = repeat ? session.repeat() : session.render(message.frame,Boolean(exact));
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
