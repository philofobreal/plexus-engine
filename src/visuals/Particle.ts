import p5 from 'p5';

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

    update(energy: number, bass: number, beat: number, isPlaying: boolean) {
        let cx = this.p.width / 2; 
        let cy = this.p.height / 2;
        
        if (this.p.dist(this.pos.x, this.pos.y, cx, cy) > Math.max(this.p.width, this.p.height) * 0.45) {
            let angleToCenter = this.p.atan2(cy - this.pos.y, cx - this.pos.x);
            this.vel.x += this.p.cos(angleToCenter) * 0.05; 
            this.vel.y += this.p.sin(angleToCenter) * 0.05;
            this.vel.normalize(); 
        }
        
        let speed = isPlaying ? (energy * 8) + (beat * 20) : 0.2; 
        if (bass > 0.4) {
            let heading = this.vel.heading() + this.p.random(-0.1, 0.1) * bass;
            this.vel.set(this.p.cos(heading), this.p.sin(heading));
        }
        this.pos.add(p5.Vector.mult(this.vel, speed));
    }
}