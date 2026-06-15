import { getBackgroundClearStyle } from '../config/visualTuning';
import { HeroMetronome } from '../audio/HeroMetronome';
import { State } from '../state/store';
import type { BeatEvent } from '../types';
import type { Particle } from './Particle';
import type { VisualRendererBackend } from './RendererBackend';
import type { Shockwave } from './Shockwave';
import type { VisualIdentity } from './VisualIdentity';

class HeroEffectIdentity implements VisualIdentity {
    readonly id = 'hero';
    readonly name = 'Hero';
    private readonly defaultColor: [number, number, number] = [0, 229, 255];
    private readonly denseImpactColor: [number, number, number] = [255, 255, 255];
    private readonly transientColor: [number, number, number] = [255, 76, 190];

    draw(backend: VisualRendererBackend, _particles: Particle[], _shockwaves: Shockwave[]): void {
        const pulse = Math.max(State.modulation.rhythmicImpulse, State.beatDecay);
        const clear = getBackgroundClearStyle(State.visualTuning, pulse * 7);
        backend.background(clear.r, clear.g, clear.b, clear.a);

        const playheadX = backend.width * 0.2;
        const laneY = backend.height * (1 - this.getBottomOffset());
        const pxPerSecond = Math.max(80, backend.width * 0.16);
        const visibleSeconds = Math.max(0, (backend.width - playheadX) / pxPerSecond);

        this.drawLane(backend, playheadX, laneY, pulse);
        this.drawEventDots(backend, playheadX, laneY, pxPerSecond, visibleSeconds);
        this.drawPlayhead(backend, playheadX, laneY, pulse);
    }

    private drawLane(backend: VisualRendererBackend, playheadX: number, laneY: number, pulse: number): void {
        backend.stroke(90, 210, 230, 80 + pulse * 80);
        backend.strokeWeight((1.2 + pulse * 1.8) * State.visualTuning.lineWeight);
        backend.line(0, laneY, backend.width, laneY);

        backend.stroke(255, 255, 255, 30 + pulse * 40);
        backend.strokeWeight(1);
        backend.line(playheadX, laneY - backend.height * 0.09, playheadX, laneY + backend.height * 0.09);
    }

    private drawPlayhead(backend: VisualRendererBackend, playheadX: number, laneY: number, pulse: number): void {
        const baseRadius = (9 + pulse * 10) * State.visualTuning.circleSize;
        backend.noStroke();
        backend.fill(0, 229, 255, 44 + pulse * 70);
        backend.circle(playheadX, laneY, baseRadius * 3.6);
        backend.fill(255, 255, 255, 180 + pulse * 75);
        backend.circle(playheadX, laneY, baseRadius);
    }

    private drawEventDots(
        backend: VisualRendererBackend,
        playheadX: number,
        laneY: number,
        pxPerSecond: number,
        visibleSeconds: number
    ): void {
        const eventMode = this.getEventMode();
        if (eventMode === 2) {
            this.drawBeepEventDots(backend, playheadX, laneY, pxPerSecond, visibleSeconds);
            return;
        }

        for (let i = 0; i < State.events.length; i++) {
            const event = State.events[i];
            if (eventMode === 1 && event.type === 1) continue;
            const deltaTime = event.time - State.currentTime;
            if (deltaTime <= 0) {
                if (deltaTime > -0.12) this.drawHitFlash(backend, playheadX, laneY, event);
                continue;
            }

            const x = playheadX + deltaTime * pxPerSecond;
            if (x < 0 || x > backend.width) continue;
            this.drawEventDot(backend, x, laneY, event.type, event.intensity);
        }
    }

    private drawBeepEventDots(
        backend: VisualRendererBackend,
        playheadX: number,
        laneY: number,
        pxPerSecond: number,
        visibleSeconds: number
    ): void {
        const events = HeroMetronome.getBeepEventsInWindow(
            State.trackAnalysis,
            State.currentTime,
            State.currentTime + visibleSeconds
        );
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const deltaTime = event.time - State.currentTime;
            const x = playheadX + deltaTime * pxPerSecond;
            if (x < 0 || x > backend.width) continue;
            this.drawEventDot(backend, x, laneY, 2, event.intensity);
        }
    }

    private drawEventDot(backend: VisualRendererBackend, x: number, laneY: number, type: BeatEvent['type'], rawIntensity: number): void {
        const intensity = Math.max(0, Math.min(1, rawIntensity));
        const radius = this.getEventRadius(type, intensity);
        const [r, g, b] = this.getEventColor(type);

        backend.noStroke();
        backend.fill(r, g, b, 42 + intensity * 58);
        backend.circle(x, laneY, radius * 2.6);
        backend.fill(r, g, b, 150 + intensity * 95);
        backend.circle(x, laneY, radius);

        if (type === 3) {
            backend.stroke(r, g, b, 160 + intensity * 80);
            backend.strokeWeight(Math.max(1, 1.2 * State.visualTuning.lineWeight));
            backend.line(x - radius * 0.9, laneY, x + radius * 0.9, laneY);
            backend.line(x, laneY - radius * 0.9, x, laneY + radius * 0.9);
        }
    }

    private drawHitFlash(backend: VisualRendererBackend, playheadX: number, laneY: number, event: BeatEvent): void {
        const intensity = Math.max(0, Math.min(1, event.intensity));
        const age = Math.max(0, Math.min(1, (State.currentTime - event.time) / 0.12));
        const alpha = (1 - age) * (80 + intensity * 120);
        const radius = this.getEventRadius(event.type, intensity) * (2.2 + age * 1.8);
        const [r, g, b] = this.getEventColor(event.type);
        backend.noStroke();
        backend.fill(r, g, b, alpha);
        backend.circle(playheadX, laneY, radius);
    }

    private getEventRadius(type: BeatEvent['type'], intensity: number): number {
        const typeScale = type === 2 ? 1.85 : type === 3 ? 0.72 : 1;
        return (5 + intensity * 8) * typeScale * State.visualTuning.circleSize;
    }

    private getEventColor(type: BeatEvent['type']): [number, number, number] {
        if (type === 2) return this.denseImpactColor;
        if (type === 3) return this.transientColor;
        return this.defaultColor;
    }

    private getBottomOffset(): number {
        const value = State.visualTuning.heroLaneBottomOffset;
        return Math.max(0.05, Math.min(0.9, Number.isFinite(value) ? value : 0.2));
    }

    private getEventMode(): number {
        const value = State.visualTuning.heroEventMode;
        return Math.max(0, Math.min(2, Math.round(Number.isFinite(value) ? value : 2)));
    }
}

export const heroEffectIdentity: VisualIdentity = new HeroEffectIdentity();
