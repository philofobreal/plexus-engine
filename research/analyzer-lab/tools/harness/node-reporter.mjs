// Structured evidence only; the Node runner retains its ordinary nonzero exit status.
export default async function* reporter(events) {
    for await (const { type, data } of events) {
        if (!['test:pass', 'test:fail', 'test:summary'].includes(type)) continue;
        let error = data.details?.error;
        while (error?.cause && typeof error.cause === 'object') error = error.cause;
        const failure = error ? Object.fromEntries(
            ['message', 'code', 'actual', 'expected', 'operator', 'errno', 'syscall']
                .filter(key => error[key] !== undefined).map(key => [key, error[key]])
        ) : undefined;
        const seen = new WeakSet();
        yield JSON.stringify({ type, name: data.name, file: data.file,
            skip: data.skip, todo: data.todo, failureType: data.details?.error?.failureType,
            failure, counts: data.counts, durationMs: data.duration_ms }, (_key, value) => {
                if (typeof value === 'bigint') return { bigint: String(value) };
                if (value && typeof value === 'object') {
                    if (seen.has(value)) return '[Circular]';
                    seen.add(value);
                }
                return value;
            }) + '\n';
    }
}
