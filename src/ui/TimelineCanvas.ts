import type { RenderState, TrackSectionLabel } from '../types';

interface TimelineViewport {
    start: number;
    end: number;
    duration: number;
}

export class TimelineCanvas {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D | null;
    private waveformCache: HTMLCanvasElement | OffscreenCanvas | null = null;
    private waveformPeaks: number[] = [];
    private lastWaveformCacheKey = '';
    private cssWidth = 0;
    private cssHeight = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
    }

    setAudioBuffer(buffer: AudioBuffer): void {
        const channelCount = Math.max(1, buffer.numberOfChannels || 1);
        const sampleCount = Math.max(1, buffer.length || 1);
        const bucketCount = Math.max(512, Math.min(4096, Math.ceil(buffer.duration * 80)));
        const peaks: number[] = [];

        for (let bucket = 0; bucket < bucketCount; bucket++) {
            const start = Math.floor((bucket / bucketCount) * sampleCount);
            const end = Math.max(start + 1, Math.floor(((bucket + 1) / bucketCount) * sampleCount));
            let sumSquares = 0;
            let count = 0;

            for (let channel = 0; channel < channelCount; channel++) {
                const samples = buffer.getChannelData(channel);
                for (let sample = start; sample < end; sample++) {
                    const value = samples[sample] || 0;
                    sumSquares += value * value;
                    count++;
                }
            }

            peaks.push(Math.min(1, Math.sqrt(sumSquares / Math.max(1, count))));
        }

        this.waveformPeaks = peaks;
        this.invalidateWaveformCache();
    }

    getWaveformPeaks(): readonly number[] {
        return this.waveformPeaks;
    }

    render(state: RenderState): void {
        if (!this.ctx) return;
        this.resize();

        const width = this.cssWidth;
        const height = this.cssHeight;
        if (width <= 0 || height <= 0) return;

        const ctx = this.ctx;

        // JAVÍTVA: Biztonságos és tökéletes High-DPI canvas ürítés az identitás-mátrix ideiglenes
        // visszaállításával és a fizikai backing store egész értékeinek használatával.
        // Ezzel elkerüljük az al-pixel kerekítési hibákból adódó alfa-csatorna felhalmozódást.
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.restore();

        this.drawBackground(ctx, width, height);

        if (state.duration <= 0) return;

        const viewport = this.getViewport(state);
        this.drawSections(ctx, state, width, height, viewport);
        this.drawGridlines(ctx, state, width, height, viewport);
        this.drawWaveform(ctx, state, width, height, viewport);
        this.drawRms(ctx, state, width, height, viewport);
        this.drawBuildup(ctx, state, width, height, viewport);
        this.drawTrends(ctx, state, width, height, viewport);
        this.drawCueMarkers(ctx, state, width, height, viewport);
        this.drawPlayhead(ctx, state, width, height, viewport);
    }

    resize(): void {
        const rect = this.canvas.getBoundingClientRect();
        this.cssWidth = Math.max(1, rect.width || this.canvas.clientWidth || this.canvas.width || 1);
        this.cssHeight = Math.max(1, rect.height || this.canvas.clientHeight || this.canvas.height || 1);

        const ratio = window.devicePixelRatio || 1;
        const targetWidth = Math.max(1, Math.floor(this.cssWidth * ratio));
        const targetHeight = Math.max(1, Math.floor(this.cssHeight * ratio));
        if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
            this.canvas.width = targetWidth;
            this.canvas.height = targetHeight;
            this.invalidateWaveformCache();
        }
        this.ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    private getViewport(state: RenderState): TimelineViewport {
        const zoom = this.clamp(state.zoom, 1, 16);
        const visibleDuration = state.duration / zoom;
        const start = this.clamp(state.pan, 0, Math.max(0, state.duration - visibleDuration));
        return {
            start,
            end: Math.min(state.duration, start + visibleDuration),
            duration: visibleDuration
        };
    }

    private drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(255,255,255,0.045)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.18)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    private drawSections(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        width: number,
        height: number,
        viewport: TimelineViewport
    ): void {
        ctx.font = '10px Inter, sans-serif';
        ctx.textBaseline = 'top';
        let labelRight = -Infinity;

        for (const section of state.sections) {
            if (section.end < viewport.start || section.start > viewport.end) continue;
            const startX = this.timeToX(section.start, width, viewport);
            const endX = this.timeToX(section.end, width, viewport);
            const blockWidth = Math.max(1, endX - startX);
            ctx.fillStyle = this.getSectionColor(section.label);
            ctx.fillRect(Math.max(0, startX), 0, Math.min(width, endX) - Math.max(0, startX), height);
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(startX + 0.5, 0);
            ctx.lineTo(startX + 0.5, height);
            ctx.stroke();

            const label = section.label.toUpperCase();
            const labelWidth = ctx.measureText(label).width;
            const labelX = Math.max(0, startX) + 6;
            if (blockWidth >= labelWidth + 12 && labelX > labelRight + 8 && labelX + labelWidth < width && height >= 46) {
                ctx.fillStyle = 'rgba(255,255,255,0.58)';
                ctx.fillText(label, labelX, 7);
                labelRight = labelX + labelWidth;
            }
        }
    }

    private drawGridlines(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        width: number,
        height: number,
        viewport: TimelineViewport
    ): void {
        if (state.bpm <= 0 || state.duration <= 0) return;
        const secondsPerBar = (60 / state.bpm) * 4;
        if (!Number.isFinite(secondsPerBar) || secondsPerBar <= 0) return;

        ctx.save();
        ctx.setLineDash([2, 5]);
        ctx.strokeStyle = 'rgba(255,255,255,0.13)';
        ctx.lineWidth = 1;
        const firstBarTime = Math.max(0, Math.floor(viewport.start / secondsPerBar) * secondsPerBar);
        for (let time = firstBarTime; time <= viewport.end; time += secondsPerBar) {
            const x = Math.round(this.timeToX(time, width, viewport)) + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, height >= 48 ? 18 : 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        ctx.restore();
    }

    private drawWaveform(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        width: number,
        height: number,
        viewport: TimelineViewport
    ): void {
        if (!this.waveformPeaks.length && !state.frames.length) return;
        const cache = this.ensureWaveformCache(width, height);
        const key = `${width}:${height}:${viewport.start}:${viewport.end}:${this.waveformPeaks.length}:${state.frames.length}`;

        if (cache && key !== this.lastWaveformCacheKey) {
            this.lastWaveformCacheKey = key;
            const cacheCtx = cache.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
            if (!cacheCtx) return;
            cacheCtx.setTransform(1, 0, 0, 1, 0, 0);
            cacheCtx.clearRect(0, 0, width, height);

            const topPad = height >= 52 ? 18 : 4;
            const bottomPad = 5;
            const graphHeight = Math.max(8, height - topPad - bottomPad);
            const centerY = topPad + graphHeight / 2;
            cacheCtx.fillStyle = 'rgba(255, 255, 255, 0.11)';

            for (let x = 0; x < width; x += 3) {
                const time = viewport.start + (x / Math.max(1, width)) * viewport.duration;
                const amplitude = this.sampleWaveform(time, state);
                const halfHeight = amplitude * (graphHeight / 2) * 0.95;
                cacheCtx.fillRect(x, centerY - halfHeight, 1.5, Math.max(1, halfHeight * 2));
            }
        }

        if (cache) ctx.drawImage(cache, 0, 0);
    }

    private drawRms(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        width: number,
        height: number,
        viewport: TimelineViewport
    ): void {
        const bars = state.bars;
        if (!bars.length) return;

        const topPad = height >= 52 ? 18 : 4;
        const bottomPad = 5;
        const graphHeight = Math.max(8, height - topPad - bottomPad);

        ctx.beginPath();
        let hasPath = false;
        for (const bar of bars) {
            if (bar.end < viewport.start || bar.start > viewport.end) continue;
            const midTime = (bar.start + bar.end) * 0.5;
            const x = this.timeToX(midTime, width, viewport);
            const y = topPad + graphHeight * (1 - Math.min(1, bar.avgRms));
            if (!hasPath) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            hasPath = true;
        }
        ctx.strokeStyle = 'rgba(213, 84, 172, 0.55)';
        ctx.lineWidth = height >= 72 ? 1.25 : 1;
        if (hasPath) ctx.stroke();

        for (const bar of bars) {
            if (bar.end < viewport.start || bar.start > viewport.end) continue;
            const startX = this.timeToX(bar.start, width, viewport);
            const endX = this.timeToX(bar.end, width, viewport);
            const peakHeight = Math.max(1, bar.peakRms * graphHeight * 0.28);
            const clippedStartX = Math.max(0, startX);
            const clippedEndX = Math.min(width, endX);
            ctx.fillStyle = bar.state === 'HIGH' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.032)';
            ctx.fillRect(clippedStartX, height - bottomPad - peakHeight, Math.max(1, clippedEndX - clippedStartX), peakHeight);
        }
    }

    private drawBuildup(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        width: number,
        height: number,
        viewport: TimelineViewport
    ): void {
        const buildup = state.buildupConfidence;
        if (!buildup.length) return;
        const topPad = height >= 52 ? 18 : 4;
        const bottomPad = 5;
        const graphHeight = Math.max(8, height - topPad - bottomPad);

        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width; x++) {
            const y = this.buildupYAtX(x, state, width, topPad, graphHeight, viewport);
            ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height - bottomPad);
        ctx.closePath();
        const fill = ctx.createLinearGradient(0, topPad, 0, height);
        fill.addColorStop(0, 'rgba(0, 229, 255, 0.24)');
        fill.addColorStop(1, 'rgba(0, 229, 255, 0.025)');
        ctx.fillStyle = fill;
        ctx.fill();

        ctx.beginPath();
        for (let x = 0; x <= width; x++) {
            const y = this.buildupYAtX(x, state, width, topPad, graphHeight, viewport);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.82)';
        ctx.lineWidth = height >= 72 ? 1.5 : 1;
        ctx.stroke();

        this.drawSpectralPivot(ctx, state, width, height, topPad, graphHeight, viewport);
        this.drawDropAnticipation(ctx, state, width, topPad, graphHeight, viewport);
        this.drawSectionOverrides(ctx, state, width, height, topPad, graphHeight, viewport);
    }

    private drawSpectralPivot(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        width: number,
        height: number,
        topPad: number,
        graphHeight: number,
        viewport: TimelineViewport
    ): void {
        ctx.save();
        ctx.strokeStyle = 'rgba(213, 84, 172, 0.95)';
        ctx.lineWidth = height >= 72 ? 2.5 : 1.75;
        ctx.setLineDash([1, 4]);
        ctx.beginPath();
        let isDrawing = false;
        for (let x = 0; x <= width; x++) {
            const time = viewport.start + (x / Math.max(1, width)) * viewport.duration;
            const frameIdx = Math.min(state.buildupConfidence.length - 1, Math.max(0, Math.floor((time / state.duration) * state.buildupConfidence.length)));
            const pivotVal = state.spectralPivot[frameIdx] || 0;
            const value = state.buildupConfidence[frameIdx] || 0;

            if (pivotVal > 0.05) {
                const y = topPad + graphHeight * (1 - value);
                if (!isDrawing) {
                    ctx.moveTo(x, y);
                    isDrawing = true;
                } else {
                    ctx.lineTo(x, y);
                }
            } else {
                isDrawing = false;
            }
        }
        ctx.stroke();
        ctx.restore();
    }

    private drawDropAnticipation(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        width: number,
        topPad: number,
        graphHeight: number,
        viewport: TimelineViewport
    ): void {
        const playheadX = this.timeToX(state.currentTime, width, viewport);
        if (state.dropAnticipation <= 0 || playheadX >= width) return;

        const anticipationWidth = (state.dropAnticipation / Math.max(0.001, viewport.duration)) * width;
        const endX = Math.min(width, playheadX + anticipationWidth);
        const suspenseGrad = ctx.createLinearGradient(playheadX, 0, endX, 0);
        suspenseGrad.addColorStop(0, 'rgba(213, 84, 172, 0.18)');
        suspenseGrad.addColorStop(1, 'rgba(213, 84, 172, 0.01)');
        ctx.fillStyle = suspenseGrad;
        ctx.fillRect(playheadX, topPad, endX - playheadX, graphHeight);
    }

    private drawSectionOverrides(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        width: number,
        height: number,
        topPad: number,
        graphHeight: number,
        viewport: TimelineViewport
    ): void {
        for (let i = 0; i < state.sections.length; i++) {
            const section = state.sections[i];
            if (section.end < viewport.start || section.start > viewport.end) continue;

            const startX = this.timeToX(section.start, width, viewport);
            const endX = this.timeToX(section.end, width, viewport);
            const override = state.sectionOverrides[`section-${i}`];
            const isOverridden = Boolean(override);
            const sensVal = override ? override.sensitivity : state.audioSensitivity;
            const normVal = this.clamp((sensVal - 0.1) / 3.9, 0, 1);
            const yThreshold = topPad + graphHeight * (1 - normVal);

            ctx.save();
            ctx.strokeStyle = isOverridden ? 'rgba(0, 229, 255, 0.85)' : 'rgba(255, 255, 255, 0.22)';
            ctx.lineWidth = isOverridden ? 1.75 : 1.25;
            if (!isOverridden) ctx.setLineDash([3, 3]);

            ctx.beginPath();
            ctx.moveTo(Math.max(0, startX), yThreshold);
            ctx.lineTo(Math.min(width, endX), yThreshold);
            ctx.stroke();

            if (isOverridden && endX - startX > 45) {
                const tagX = Math.max(0, startX) + 4;
                const tagY = this.clamp(yThreshold - 14, topPad + 2, height - 28);
                ctx.fillStyle = 'rgba(0, 229, 255, 0.95)';
                ctx.fillRect(tagX, tagY, 34, 10);
                ctx.fillStyle = '#000000';
                ctx.font = '7px monospace';
                ctx.textBaseline = 'middle';
                ctx.fillText(`S:${sensVal.toFixed(2)}`, tagX + 2, tagY + 5);
            }

            if (override?.preset && endX - startX > 58) {
                const presetLabel = `P:${this.formatPresetName(override.preset)}`;
                const labelWidth = Math.min(Math.ceil(ctx.measureText(presetLabel).width) + 8, Math.max(46, endX - startX - 8));
                const tagX = Math.max(0, startX) + 4;
                const tagY = this.clamp(yThreshold + 5, topPad + 14, height - 14);
                ctx.fillStyle = 'rgba(213, 84, 172, 0.92)';
                ctx.fillRect(tagX, tagY, labelWidth, 11);
                ctx.fillStyle = '#000000';
                ctx.font = '7px monospace';
                ctx.textBaseline = 'middle';
                ctx.fillText(presetLabel, tagX + 3, tagY + 5.5, labelWidth - 6);
            }
            ctx.restore();
        }
    }

    private drawTrends(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        width: number,
        height: number,
        viewport: TimelineViewport
    ): void {
        for (const trend of state.tensionTrends.segments) {
            if (trend.end < viewport.start || trend.start > viewport.end) continue;
            const startX = this.timeToX(trend.start, width, viewport);
            const endX = this.timeToX(trend.end, width, viewport);
            ctx.strokeStyle = this.getTrendColor(trend.direction);
            ctx.lineWidth = Math.max(1, 1 + trend.confidence * 2);
            ctx.beginPath();
            ctx.moveTo(Math.max(0, startX), height - 3);
            ctx.lineTo(Math.min(width, endX), height - 3);
            ctx.stroke();
        }
    }

    private drawCueMarkers(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        width: number,
        height: number,
        viewport: TimelineViewport
    ): void {
        const significant = state.significantMoments.length
            ? state.significantMoments
            : state.cues.filter(cue => cue.kind === 'impact' || cue.kind === 'break');
        let labelRight = -Infinity;

        for (const cue of significant) {
            if (cue.kind !== 'impact' && cue.kind !== 'break') continue;
            if (cue.time < viewport.start || cue.time > viewport.end) continue;

            const x = this.timeToX(cue.time, width, viewport);
            const color = this.getCueColor(cue.kind);
            ctx.fillStyle = color;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, 2);
            ctx.lineTo(x - 4, 10);
            ctx.lineTo(x + 4, 10);
            ctx.closePath();
            ctx.fill();

            ctx.globalAlpha = 0.45;
            ctx.beginPath();
            ctx.moveTo(x + 0.5, 10);
            ctx.lineTo(x + 0.5, height);
            ctx.stroke();
            ctx.globalAlpha = 1;

            const label = cue.kind === 'impact' ? 'IMPACT' : 'BREAK';
            ctx.font = '9px Inter, sans-serif';
            const labelWidth = ctx.measureText(label).width;
            if (height >= 72 && x + 7 > labelRight + 8 && x + 7 + labelWidth < width) {
                ctx.fillStyle = 'rgba(255,255,255,0.64)';
                ctx.fillText(label, x + 7, 5);
                labelRight = x + 7 + labelWidth;
            }
        }
    }

    private drawPlayhead(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        width: number,
        height: number,
        viewport: TimelineViewport
    ): void {
        const currentTimeToDraw = state.scrubTime ?? state.currentTime;
        if (currentTimeToDraw < viewport.start || currentTimeToDraw > viewport.end) return;
        const playheadX = this.timeToX(currentTimeToDraw, width, viewport);
        const isScrubbing = state.scrubTime !== null && state.scrubTime !== undefined;
        ctx.strokeStyle = isScrubbing ? 'rgba(255, 220, 120, 0.98)' : 'rgba(255,255,255,0.94)';
        ctx.lineWidth = 1;
        ctx.shadowColor = isScrubbing ? '#ffd66f' : '#00e5ff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(playheadX + 0.5, 0);
        ctx.lineTo(playheadX + 0.5, height);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = isScrubbing ? '#ffd66f' : '#00e5ff';
        ctx.beginPath();
        ctx.moveTo(playheadX, 1);
        ctx.lineTo(playheadX - 4, 8);
        ctx.lineTo(playheadX + 4, 8);
        ctx.closePath();
        ctx.fill();
    }

    private ensureWaveformCache(width: number, height: number): HTMLCanvasElement | OffscreenCanvas | null {
        const cacheWidth = Math.max(1, Math.floor(width));
        const cacheHeight = Math.max(1, Math.floor(height));
        if (!this.waveformCache) {
            this.waveformCache = typeof OffscreenCanvas !== 'undefined'
                ? new OffscreenCanvas(cacheWidth, cacheHeight)
                : document.createElement('canvas');
        }
        if (this.waveformCache.width !== cacheWidth || this.waveformCache.height !== cacheHeight) {
            this.waveformCache.width = cacheWidth;
            this.waveformCache.height = cacheHeight;
            this.lastWaveformCacheKey = '';
        }
        return this.waveformCache;
    }

    private sampleWaveform(time: number, state: RenderState): number {
        if (this.waveformPeaks.length) {
            const index = this.clamp(Math.floor((time / Math.max(0.001, state.duration)) * this.waveformPeaks.length), 0, this.waveformPeaks.length - 1);
            return this.waveformPeaks[index] || 0;
        }

        const frameIdx = Math.floor((time * state.sampleRate) / Math.max(1, state.hopSize));
        return state.frames[frameIdx]?.e || 0;
    }

    private buildupYAtX(
        x: number,
        state: RenderState,
        width: number,
        topPad: number,
        graphHeight: number,
        viewport: TimelineViewport
    ): number {
        const time = viewport.start + (x / Math.max(1, width)) * viewport.duration;
        const frameIdx = Math.min(state.buildupConfidence.length - 1, Math.max(0, Math.floor((time / state.duration) * state.buildupConfidence.length)));
        const value = state.buildupConfidence[frameIdx] || 0;
        return topPad + graphHeight * (1 - value);
    }

    private timeToX(time: number, width: number, viewport: TimelineViewport): number {
        return ((time - viewport.start) / Math.max(0.001, viewport.duration)) * width;
    }

    private invalidateWaveformCache(): void {
        this.lastWaveformCacheKey = '';
    }

    private getSectionColor(label: TrackSectionLabel): string {
        switch (label) {
            case 'intro': return 'rgba(0, 150, 255, 0.10)';
            case 'outro': return 'rgba(160, 160, 160, 0.08)';
            case 'build': return 'rgba(255, 170, 0, 0.14)';
            case 'drop': return 'rgba(255, 0, 170, 0.17)';
            case 'peak': return 'rgba(0, 229, 255, 0.16)';
            case 'break': return 'rgba(120, 0, 255, 0.10)';
            default: return 'rgba(255, 255, 255, 0.035)';
        }
    }

    private getTrendColor(direction: string): string {
        if (direction === 'rising') return 'rgba(255, 170, 0, 0.9)';
        if (direction === 'falling') return 'rgba(120, 0, 255, 0.75)';
        return 'rgba(255, 255, 255, 0.22)';
    }

    private getCueColor(kind: string): string {
        if (kind === 'impact') return 'rgba(255, 255, 255, 0.78)';
        if (kind === 'break') return 'rgba(120, 0, 255, 0.9)';
        return 'rgba(255, 0, 170, 0.58)';
    }

    private formatPresetName(fileName: string): string {
        return fileName.replace(/\.json$/i, '');
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
    }
}

export type { RenderState };
