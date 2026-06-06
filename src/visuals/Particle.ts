import p5 from 'p5';
import { State } from '../state/store';

export class Particle {
    pos: p5.Vector;
    vel: p5.Vector;
    private p: p5;

    constructor(p: p5) {
        this.p = p;
        
        let cx = this.p.windowWidth / 2; 
        let cy = this.p.windowHeight / 2;
        this.pos = this.p.createVector(cx + this.p.random(-400, 400), cy + this.p.random(-300, 300));
        this.vel = this.p.createVector(this.p.random(-1, 1), this.p.random(-1, 1)).normalize();
    }

    update(energy: number, activity: number, beat: number, isPlaying: boolean, centripetalOrbit = 0) {
        const effectivePlaying = isPlaying || State.isExporting;
        let cx = this.p.width / 2; 
        let cy = this.p.height / 2;
        let dx = cx - this.pos.x;
        let dy = cy - this.pos.y;
        let distSq = dx * dx + dy * dy;
        let maxRadius = Math.max(this.p.width, this.p.height) * 0.45;
        let maxRadiusSq = maxRadius * maxRadius;
        
        if (distSq > maxRadiusSq) {
            let dist = Math.sqrt(distSq);
            if (dist > 0) {
                this.vel.x += (dx / dist) * State.visualTuning.particleBoundaryPull; 
                this.vel.y += (dy / dist) * State.visualTuning.particleBoundaryPull;
                this.vel.normalize(); 
            }
        }

        if (centripetalOrbit > 0 && distSq > 0.0001) {
            let dist = Math.sqrt(distSq);
            let orbitForce = centripetalOrbit * 0.15;
            let inwardX = dx / dist;
            let inwardY = dy / dist;
            let tangentX = -inwardY;
            let tangentY = inwardX;
            this.vel.x += inwardX * orbitForce + tangentX * orbitForce;
            this.vel.y += inwardY * orbitForce + tangentY * orbitForce;
            this.vel.normalize();
        }
        
        let speed = (effectivePlaying
            ? (energy * State.visualTuning.particleEnergySpeed) + (beat * State.visualTuning.particleBeatSpeed)
            : State.visualTuning.particleIdleSpeed) * State.playbackFade;
        if (activity > 0.4) {
            let heading = this.vel.heading() + this.p.random(-State.visualTuning.particleActivityTurn, State.visualTuning.particleActivityTurn) * activity;
            this.vel.set(this.p.cos(heading), this.p.sin(heading));
        }
        this.pos.x += this.vel.x * speed;
        this.pos.y += this.vel.y * speed;
    }
}
