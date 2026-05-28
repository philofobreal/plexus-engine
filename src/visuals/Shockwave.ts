import p5 from 'p5';
import { hueToRgb } from '../config/visualTuning';
import { State } from '../state/store';
import type { AutoState } from '../types';
import type { VisualRendererBackend } from './RendererBackend';

export class Shockwave {
    r: number;
    alpha: number;
    thickness: number;
    speed: number;
    color: number[];

    constructor(_p: p5, intensity: number, mode: AutoState, type: number) {
        let isLowMode = mode.startsWith('LOW');
        let modeBoost = isLowMode ? 1.3 : 1.0; 
        let colorHue = State.visualTuning.circleHue;

        if (type === 1) { 
            this.r = 40 + (intensity * 60 * modeBoost); this.alpha = 150; this.thickness = 2 * modeBoost; 
            this.speed = 12 + (intensity * 15); this.color = hueToRgb(colorHue);
        } else if (type === 2) { 
            this.r = 20 + (intensity * 80 * modeBoost); this.alpha = 200; this.thickness = 4 * modeBoost; 
            this.speed = 20 + (intensity * 25); this.color = isLowMode ? hueToRgb(colorHue + 105) : hueToRgb(colorHue + 35, 0.4, 0.9);
        } else if (type === 3) { 
            this.r = 10 + (intensity * 30); this.alpha = 100; this.thickness = 1; 
            this.speed = 8 + (intensity * 10); this.color = hueToRgb(colorHue + 85);
        } else if (type === 4) {
            this.r = 70 + (intensity * 110); this.alpha = 120; this.thickness = 1.5;
            this.speed = 5 + (intensity * 8); this.color = hueToRgb(colorHue + 10);
        } else if (type === 5) {
            this.r = 35 + (intensity * 120); this.alpha = 165; this.thickness = 3;
            this.speed = 7 + (intensity * 10); this.color = hueToRgb(colorHue + 125);
        } else if (type === 6) {
            this.r = 10 + (intensity * 90); this.alpha = 210; this.thickness = 1;
            this.speed = 24 + (intensity * 32); this.color = hueToRgb(colorHue + 70);
        } else if (type === 7) {
            this.r = 120 + (intensity * 160); this.alpha = 90; this.thickness = 5;
            this.speed = 3 + (intensity * 6); this.color = hueToRgb(colorHue + 45);
        } else {
            this.r = 55 + (intensity * 180); this.alpha = 135; this.thickness = 2.5;
            this.speed = 9 + (intensity * 14); this.color = hueToRgb(colorHue + 160);
        }

        this.r *= State.visualTuning.shockwaveRadius;
        this.alpha *= State.visualTuning.shockwaveAlpha;
        this.thickness *= State.visualTuning.shockwaveThickness;
        this.speed *= State.visualTuning.shockwaveSpeed;
    }

    update() { 
        this.r += this.speed + (this.r * State.visualTuning.shockwaveExpansion); 
        this.alpha -= State.visualTuning.shockwaveDecay; 
    }

    draw(backend: VisualRendererBackend, cx: number, cy: number) {
        backend.noFill(); 
        backend.stroke(this.color[0], this.color[1], this.color[2], Math.min(this.alpha, 255));
        backend.strokeWeight(this.thickness); 
        backend.circle(cx, cy, this.r * 2);
    }
}
