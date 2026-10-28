// Secondary desktop browser observation, deliberately outside the player.
export async function runBrowserExperiment(config, progress = () => {}) {
    const hash = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map(v => v.toString(16).padStart(2, '0')).join('');
    const inputBytes = await (await fetch(config.pcmURL)).arrayBuffer();
    const samples = new Float32Array(inputBytes);
    const inputHash = await hash(inputBytes);
    const modules = {}, importMs = {};
    for (const mode of ['reference', 'resident']) {
        const t = performance.now(); modules[mode] = await import(config.trees[mode]); importMs[mode] = performance.now() - t;
    }
    const input = { samples, sampleRate: 44100, options: { rhythmOnsets: true } }, runs = [];
    for (const mode of ['reference', 'resident']) { progress('Warmup: ' + mode); modules[mode].analyzeAudio(input); }
    for (let trial = 0; trial < 3; trial++) {
        for (const mode of trial % 2 ? ['resident', 'reference'] : ['reference', 'resident']) {
            progress(`Trial ${trial + 1}/3: ${mode}`);
            await new Promise(resolve => requestAnimationFrame(resolve));
            const t = performance.now(); const value = modules[mode].analyzeAudio(input); const elapsedMs = performance.now() - t;
            const resultSha256 = await hash(new TextEncoder().encode(JSON.stringify(value)));
            runs.push({ trial, mode, elapsedMs, resultSha256 });
        }
    }
    const med = mode => runs.filter(r => r.mode === mode).map(r => r.elapsedMs).sort((a, b) => a - b)[1];
    return { kind: 'T17 secondary desktop browser observation', userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency, crossOriginIsolated, importMs, runs,
        referenceMedianMs: med('reference'), residentMedianMs: med('resident'), improvement: 1 - med('resident') / med('reference'),
        pcmSha256: inputHash, pcmUnchanged: inputHash === await hash(inputBytes),
        parity: runs.every(r => r.resultSha256 === runs[0].resultSha256),
        memory: performance.memory ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize } : null,
        limitations: 'One desktop browser/recording, same page, no forced GC or process maxRSS; not the primary gate or a Quest measurement.' };
}
