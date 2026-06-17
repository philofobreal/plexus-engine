export function averageRange(values: number[], start: number, end: number) {
    let sum = 0;
    let count = 0;
    for (let i = start; i < end && i < values.length; i++) {
        sum += values[i];
        count++;
    }
    return count > 0 ? sum / count : 0;
}
export function clampUnit(value: number) { return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0)); }
export function clampSigned(value: number) { return Math.min(1, Math.max(-1, Number.isFinite(value) ? value : 0)); }
