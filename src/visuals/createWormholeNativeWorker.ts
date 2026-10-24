/** Kept separate so browser-free tests can inject a transport without evaluating import.meta.url. */
export function createWormholeNativeWorker():Worker {
    return new Worker(new URL('./wormholeNative.worker.ts',import.meta.url),{type:'module'});
}
