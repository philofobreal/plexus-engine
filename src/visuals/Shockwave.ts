import p5 from 'p5';
import type { AutoState } from '../types';

export class Shockwave {
    r: number;
    alpha: number;
    thickness: number;
    speed: number;
    color: number[];
    private p: p5;

    constructor(p: p5, intensity: number, mode: AutoState, type: number) {
        this.p = p;         let isLowMode = mode.startsWith('LOW');
        let modeBoost = isLowMode ? 1.3 : 1.0; 

        if (type === 1) { 
            this.r = 40 + (intensity * 60 * modeBoost); this.alpha = 150; this.thickness = 2 * modeBoost; 
            this.speed = 12 + (intensity * 15); this.color = [100, 200, 255];
        } else if (type === 2) { 
            this.r = 20 + (intensity * 80 * modeBoost); this.alpha = 200; this.thickness = 4 * modeBoost; 
            this.speed = 20 + (intensity * 25); this.color = isLowMode ? [255, 100, 200] : [255, 255, 255];
        } else if (type === 3) { 
            this.r = 10 + (intensity * 30); this.alpha = 100; this.thickness = 1; 
            this.speed = 8 + (intensity * 10); this.color = [200, 255, 150];
        } else if (type === 4) {
            this.r = 70 + (intensity * 110); this.alpha = 120; this.thickness = 1.5;
            this.speed = 5 + (intensity * 8); this.color = [130, 220, 255];
        } else if (type === 5) {
            this.r = 35 + (intensity * 120); this.alpha = 165; this.thickness = 3;
            this.speed = 7 + (intensity * 10); this.color = [255, 185, 235];
        } else if (type === 6) {
            this.r = 10 + (intensity * 90); this.alpha = 210; this.thickness = 1;
            this.speed = 24 + (intensity * 32); this.color = [180, 255, 110];
        } else if (type === 7) {
            this.r = 120 + (intensity * 160); this.alpha = 90; this.thickness = 5;
            this.speed = 3 + (intensity * 6); this.color = [255, 220, 120];
        } else {
            this.r = 55 + (intensity * 180); this.alpha = 135; this.thickness = 2.5;
            this.speed = 9 + (intensity * 14); this.color = [120, 255, 210];
        }
    }

    update() { 
        this.r += this.speed + (this.r * 0.05); 
        this.alpha -= 5; 
    }

    draw(cx: number, cy: number) {
        this.p.noFill(); 
        this.p.stroke(this.color[0], this.color[1], this.color[2], this.alpha);
        this.p.strokeWeight(this.thickness); 
        this.p.circle(cx, cy, this.r * 2);
    }
}
