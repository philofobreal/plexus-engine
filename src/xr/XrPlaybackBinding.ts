// Audio event ordering has a single integration owner; position notifications do not reset scores.
import type { AudioEngine } from '../audio/AudioEngine';
import type { RhythmGameSession } from '../gameplay';

export class XrPlaybackBinding {
    private readonly unsubscribe: Array<() => void>;
    constructor(engine: AudioEngine, session: RhythmGameSession, resetMotion: () => void, changed: () => void = () => {}) {
        this.unsubscribe = [
            engine.addPlaybackStateListener((event, time) => {
                resetMotion();
                if (event === 'seek') session.seek(time);
                else if (event === 'pause') session.pause();
                else if (event === 'play') {
                    if (session.getState() === 'ready' || session.getState() === 'finished') session.start();
                    else session.resume();
                }
                // stop precedes natural-end; do not turn the session idle before end arrives.
                changed();
            }),
            engine.addPlaybackEndedListener(() => { session.finish(); changed(); })
        ];
    }
    dispose(): void { for (const unsubscribe of this.unsubscribe) unsubscribe(); }
}
