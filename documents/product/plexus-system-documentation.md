# PLEXUS ENGINE - Atfogo Rendszerdokumentacio V0.2

> **Aktualis statusz:** ez a fo rendszerdokumentacio a `plexus-engine/` TypeScript/Vite kodbazis aktualis allapotat irja le. A korabbi single-file HTML prototipus es IIR-alapu DSP megfogalmazasok torteneti hatternek szamitanak, nem kanonikus implementacios szerzodesnek.

## 1. Vezetoi Osszefoglalo

A **Plexus Engine** egy bongeszoben futo, hardvergyorsitott, audio-first generativ vizualizacios motor es eloadoi hangszer (visual instrument). A rendszer alapelve a lejatszas elotti offline zeneanalizis, amely zeneszerkezeti kontextust (szekciok, feszultseggorbek, mintak es cue esemenyek) hoz letre. Lejatszas kozben a renderelo szal nem vegez valos ideju DSP szamitasokat; egy absztrakt modulacios buszon keresztul fogyasztja a normalizalt zenei szandekot, biztositva a stabil szinpadi es produkcios teljesitmenyt.

Az aktualis implementacio ot regisztralt vizualis identitast tart fenn a `VisualIdentity` / `StyleRegistry` architekturan keresztul:

* `classic`: az eredeti Plexus reszecskehalo, kozponti glow, beat shockwave es polygon flash viselkedes.
* `temporal`: ugyanarra az offline analizisre epulo, teljes track-szintu zenei kontextust hasznalo mod, amely section, feature, cue es pattern adatokat hasznal folyamatos vizualis modulaciora.
* `dark-techno`: szigoru monokrom, minimal ipari stilus eles feher/szurke vonalakkal es ritka strobe-szeru polygon flash viselkedessel.
* `organic-ambient`: lassu, folyekony, pasztell zold/kek/foldszinu stilus, amely eles halozati vonalak helyett puha reszecske-glow retegeket hasznal.
* `cyberpunk`: nagy kontrasztu neon magenta/cian stilus kromatikus aberracio-szeru kettos vonalrajzolassal es determinisztikus glitch offsetekkel.

## 1.1. Termekvizio Es Celcsoport

A Plexus Engine elsodleges celcsoportja az **elektronikus zeneszek, producerek, DJ-k es live act eloadok**, akik sajat szamaikhoz szeretnenek azonnal generalt, zeneileg intelligens es eloben testreszabhato vizualis kiseretet.

A szoftver pozicionalasa:

> **Plexus Engine:** browser-based audio-reactive visual engine for musicians who want instant generative visuals from their own tracks.

### Miert Nem Klasszikus VJ Szoftver Vagy Streamer Overlay?

1. **Zenei kontextus-vezerelt (Audio-First):** Nem egyszeru clip-launcher vagy OBS widget, hanem zeneszerkezeti esemenyekre (melody, vocal, FX, buildup, drop) reagalo vizualis hangszer.
2. **Offline track-analizis:** Felismeri a dal dramaturgiai ivet (intro, build, drop, break, peak, outro), es a feszultseggorbet elore anticipalva vezerli a reszecskek es sokszogek dinamikajat.
3. **Produkcios es eloadoi fokusz:** A UI, a Tuning Layer es az offline WebM export a gyors preset-valtast, az atmenetek folytonossagat (morphing), a tiszta stream kimenetet es a megoszthato video-renderelest szolgalja.

### Jovobeli Termekutvonal

A fejlesztesek fokuszaban nem ujabb grafikai effektek, hanem az **eloadoi munkafolyamat es integracio (preset + export + performance workflow)** tamogatasa all:

* Elo vizualis presetek exportalasa, mentese es betoltese (Preset Management).
* Bongeszoben futo, worker-alapu offline WebM export vizjelkartyaval es optionalis Opus hangsavval.
* Megoszthato shareable URL konfiguraciok generalasa.
* OBS-barat, chroma-key es transzparens hatterrel rendelkezo tiszta kimeneti modok.
* MIDI mapping es hardveres BPM szinkronizacio tamogatasa a jovoben.

## 2. Altalanos Architektura Es Adataramlas

A rendszer Vite + TypeScript projekt, explicit runtime retegekkel. A kanonikus modulhatarokat a `documents/governance/architecture-contract.md` es a `documents/implementation/current-typescript-implementation.md` tartja naprakeszen.

1. **Composition (`src/main.ts`):** letrehozza a DOM shellt, az `AudioEngine` peldanyt, a `DashboardUI` peldanyt es a p5 renderert.
2. **UI Layer (`src/ui/DashboardUI.ts`, `src/style.css`):** kezeli a fajlfeltoltest, play/pause/seek/loop vezerlest, visual mode valasztast, preset betoltest, tuning panelt, metrics panelt, auto-hide chrome-ot es a dashboard frissitest.
3. **Audio Engine (`src/audio/AudioEngine.ts`):** felelos a hangfajlok dekodolasaert, a `AudioBufferSourceNode` eletciklusert, a kanonikus idoszamitasert, a seek/end resetert, a worker request id kezelesert, a stale worker eredmenyek eldobasaert es a worker terminalasaert.
4. **Analysis Engine (`src/audio/analyzer.worker.ts`):** dedikalt Web Worker. 1024 mintas Hann-windowed FFT pipeline-t hasznal, spektralis fluxust, relativ savenergiakat, centroidot es flatness erteket szamol, majd `AudioFrame`, `BeatEvent` es `TrackAnalysis` kimenetet publikal.
5. **Shared contracts/state (`src/types/index.ts`, `src/state/store.ts`):** tarolja a megosztott tipusokat, az elfogadott analizis eredmenyeket, a vizualis modot, loop allapotot, aktualis frame-et, cue allapotokat, modulacios buszt, elo tuningot es target tuningot.
6. **Render Engine (`src/visuals/`):** p5 canvas renderer backend adapterrel, amely 75 elore inicializalt reszecsket, lokeshullamokat, event/cue indexeket es a `StyleRegistry`-bol lekert `VisualIdentity` implementaciokat kezeli. A zene-dramaturgiai allapotszabalyozast a `VisualDirectorFSM.ts` modul vegzi, majd `DirectorOutput` formaban ad render-facing jeleket az identitasoknak.
7. **Offline Export (`src/export/`):** a `WebMExporter` a fo szalon vezerli az offline idohurkot, a p5 canvas atmeretezeset, a `VideoFrame` elkapast, az audio buffer szeletelest es a vizjelkartyat. Az `export.worker.ts` WebCodecs `VideoEncoder`/optionalis `AudioEncoder` hasznalataval es pure TypeScript EBML/WebM muxerrel allit elo Blob-ot.

## 3. Funkcionalis Specifikacio

### 3.1. Offline Globalis Analizis

A zene betoltesekor a rendszer nem azonnal inditja a lejatszast. Az `AudioEngine` dekodolja a fajlt, explicit masolatot keszit az elso csatorna sample adataibol, majd ezt az `ArrayBuffer`-t kuldi a workernek. A lejatszashoz szukseges `AudioBuffer` a main thread tulajdonaban marad, igy az analizis transfer nem tudja veletlenul detached allapotba tenni a playback adatot.

Lejatszas kozben a fo szal nem vegez audio analizist. A renderer az `AudioEngine.getCurrentTime()` alapjan frame indexet szamol:

```ts
frameIdx = Math.floor(currentTime * State.sampleRate / State.hopSize);
```

### 3.2. Makro-Dinamikai Allapotgep

A worker a BPM becslesbol 16 beat hosszu blokkokat kepez. A blokk relativ energiaja alapjan a frame `state` erteke `HIGH` vagy `LOW`, real-time jellegu override-okkal:

* `HIGH`: ha a blokk energia aranya legalabb `0.45`.
* `LOW`: ha a blokk energia aranya `0.45` alatt van.
* `LOW_DROP`: ha HIGH blokkban a simitott pillanatnyi energia `0.35` ala esik.
* `LOW_OVERLOAD`: ha a simitott pillanatnyi energia `0.95` fole megy.

Lejatszas kozben a render-facing allapotokat nem kozvetlenul a worker `AudioFrame.state` mezoi jelentik. A `VisualDirectorFSM` a kompatibilis frame allapot, a `buildupConfidence`, a `spectralPivot`, a visual tuning es a modulacios busz alapjan `DirectorState` erteket allit elo:

* `IDLE`: reset, seek vagy kezdeti allapot.
* `INTRO_BREAK`: visszafogott LOW jellegu szakasz, amely csillapitja a modulacios buszt es a finom feature jeleket.
* `BUILDUP`: emelkedo dramaturgiai feszultseg, amely novelheti a `kineticTension` es `macroMomentum` jeleket.
* `DROP`: normal magas energias render allapot.
* `GLITCH_LOW_DROP`: LOW_DROP vagy overload jellegu atmenet, amely glitch kimenetet ad a renderereknek.

Az FSM kimenete a `DirectorOutput` szerzodes:

```ts
interface DirectorOutput {
  state: DirectorState;
  centripetalOrbit: number;
  glitchIntensity: number;
  invertBackground: boolean;
}
```

A `LOW_DROP` igy tovabbra is worker/frame kompatibilitasi allapot marad, mig a vizualis effekt dontes `GLITCH_LOW_DROP` formaban jelenik meg a director kimeneten.

### 3.3. Beat, Cue Es Pattern Kimenetek

A worker a spektralis fluxus csucsai alapjan `BeatEvent` esemenyeket general. A `TrackAnalysis` ezen felul section struktura, `VisualFeatureFrame` sorozat, visual cue esemenyek, significant moments es recurring `MusicPattern` bejegyzesek forrasa.

A pattern detektalas determinisztikus section signature-okbol tortenik. A pattern cue-k opcion ellenorizheto `patternId` mezovel hivatkoznak a megfelelo `MusicPattern` elemre.

A dramaturgiai motor a density, tension, RMS energia es blokk energia iranyvaltozasabol `buildupConfidence` gorbet es `tensionTrends` segmentumokat szamol. A renderer ezt a gorbet a modulacios busz `kineticTension` komponensebe keveri, igy a rendszer a dropok es csucspontok elott finoman novelheti a vizualis feszultseget.

### 3.4. BPM Detektalas Es Kijelzes

A worker 70 es 180 BPM kozotti histogram alapjan becsul BPM-et. A UI-ban a BPM kompakt fejlec badge-kent jelenik meg a betoltott audio fajl neve mellett; a metrics grid nem tartalmaz kulon BPM kartyat.

## 4. Technikai Es Algoritmikus Specifikaciok

### 4.1. DSP A Workerben

Az aktualis worker nem IIR crossover szuroket hasznal. A `src/audio/analyzer.worker.ts` 1024 mintas hop merettel dolgozik, minden frame-et Hann ablakkal sulyoz, majd FFT-n szamolja a spektralis jellemzoket.

Az elfogadott render-facing kimenetek:

* `AudioFrame.e`: normalizalt RMS energia.
* `AudioFrame.b`: simitott density projekcio.
* `AudioFrame.m`: simitott melody-presence projekcio.
* `AudioFrame.t`: simitott fx-presence projekcio.
* `AudioFrame.state`: `IDLE`, `HIGH`, `LOW`, `LOW_DROP` vagy `LOW_OVERLOAD`.
* `AudioFrame.eRatio`: blokk-szintu energia arany.

A UI-ban a legacy `Bass`, `Mid`, `Treble` cimkek tovabbra is lathatok, de ezek az aktualis `b/m/t` projekciokat jelenitik meg, nem nyers crossover savokat.

### 4.2. Plexus Halo Optimalizalas

A visual identity implementaciok negyzetes tavolsagellenorzest hasznalnak hot loopban, amikor reszecske-kapcsolatokat vizsgalnak. A gyokvonas csak akkor tortenik meg, amikor a pontok mar biztosan a maximum tavolsagon belul vannak. A particle pool 75 elemre inicializalodik setupkor, normal draw loopban nem jonnek letre uj `Particle` peldanyok.

Az effekt modulok `VisualRendererBackend` interfeszen keresztul rajzolnak. A p5-specifikus hivasokat a `P5RendererBackend` adapter tartalmazza, igy a scene logika mock backenddel tesztelheto es kesobb WebGPU/shader backend fele mozgathato.

### 4.2.1. Modulacios Busz Es Parameter Morphing

`computeModulationBus()` az aktualis `AudioFrame`, `VisualFeatureFrame`, beat decay, cue decay es tuning alapjan ot normalizalt jelet allit elo: `kineticTension`, `densityDrive`, `spectralChaos`, `rhythmicImpulse`, `macroMomentum`. A keplet minden kimenetet `0.0..1.0` tartomanyba szorit es `audioSensitivity` alapjan skalaz.

`State.visualTuning` az elo, interpolalt allapot. `State.targetTuning` a presetek es UI csuszkak celallapota. A render ciklus elejen az elo tuning a `transitionSpeed` szerint kozelit a celhoz, tulcsuszas nelkul.

A `buildupConfidence` mar nem csak kozvetlen modulacios erosites. A `VisualDirectorFSM` `BUILDUP` allapotban `centripetalOrbit` erteket publikal a `State.directorOutput` mezobe. A particle update ezt az erteket befele mutato es tangencialis komponensre bontja, igy a buildup fazis spiral jellegu, centripetalis mozgasba rendezi a reszecskeket.

### 4.2.2. Playback Fade Es Timeline Waveform Cache

`State.playbackFade` render-facing mozgasi szorzo. Lejatszas kozben az ertek 1 fele kozelit, stop/pause utan pedig fokozatosan csokken. A `Particle` mozgas es a `TemporalMusicEffect` rotacios fazisa ezt fogyasztja, igy a vizual nem fagy be hirtelen, mikozben az audio source node eletciklus tovabbra is az `AudioEngine` tulajdona.

`State.rotationPhase` valtja ki a p5 frame count alapu temporal forgast. A fazis csak a renderer allapotabol es a playback fade-bol kovetkezik, ezert a temporal mod nem lesz kozvetlenul fuggve a canvas backend frame szamlalojatol.

A dramaturgiai timeline waveformja nem minden frame-ben epit nagy canvas pathot. A `DashboardUI` egy ujrahasznalt offscreen canvasba rajzolja a lathato tartomany energiasavjait az elore szamolt `AudioFrame.e` ertekekbol, majd `drawImage` hivasal bliteli a bitmapet a timeline-ra. A cache kulcsa az analizis referencia, a timeline merete, a zoom es a scroll offset; ezek valtozasakor a waveform ujraepul.

### 4.3. Idoszinkronizacio

Az elfogadott kanonikus playback ido formula:

```ts
playbackTime = playOffset + (audioContext.currentTime - playStartTime);
```

Nem elfogadott kanonikus idoforras: UI slider, animation frame timestamp, p5 frame count, media element ido vagy wall-clock timer.

### 4.4. Source Node Eletciklus

Az `AudioBufferSourceNode` one-shot objektum. Pause, stop, seek, replacement vagy cancellation eseten:

1. `source.onended = null`.
2. Guardolt `source.stop()`.
3. `source.disconnect()`.
4. Reference eldobasa.
5. Kovetkezo playback szakaszhoz friss source letrehozasa.

Natural end eseten `Loop` modban a lejatszas 0:00-rol ujraindul. `Once` modban az engine reseteli az idot es playback ended callbacket kuld a UI/render retegnek.

### 4.5. Offline WebM Export

Az export nem a live audio orat hasznalja. A `State.isExporting` es `State.exportTime` mezok az offline render clock szerzodes reszei. Export kozben a renderer az alabbi idoforrast hasznalja:

```ts
let ct = State.isExporting ? State.exportTime : engine.getCurrentTime();
```

A `WebMExporter.startExport()` kozvetlenul `p5Instance.noLoop()` hivasra valt, majd frame-enkent allitja a `State.exportTime` erteket es `p5Instance.redraw()` hivasal kenyszeriti ki a rajzolast. Cleanup soran visszaallitja a canvas meretet, `State.isExporting = false`, `State.exportTime = 0`, majd `p5Instance.loop()` kovetkezik. A renderer nem pollolja az export allapotot es nem birtokolja az export loop/no-loop lifecycle-t.

Az export hurok sorrendje kifejezett szerzodes:

1. `State.exportTime = i / fps`
2. `p5Instance.redraw()`
3. `drawMetadataCard(width, height)`
4. `new VideoFrame(canvas, { timestamp })`
5. `await nextAnimationFrame()`
6. worker `encode_frame`

Ez garantalja, hogy a bal felso zenei informacios kartya/vizjel benne legyen az elkapott kepkockaban, mielott a bongeszo ujabb feladatban puffert cserelhetne vagy torolhetne. Canvas resize utan az exporter egy kulon animation frame-et var az elso frame elott, hogy a p5/bongeszo backing store stabil legyen.

A metadata kartya tartalma: sotet rounded panel, ritmusra pulzalo cian pont (`State.beatDecay`), `PLEXUS ENGINE` felirat, a betoltott track neve es optionalis BPM badge. A track nev tul hosszu esetben `...` suffixszel vagodik. A rajzolas `ctx.save()` / `ctx.restore()` parban tortenik.

Ha a betoltott `AudioBuffer` elerheto, az exporter frame-enkent ketcsatornas planar `Float32Array` hangszeletet kuld a workernek. A worker megprobal Opus `AudioEncoder`-t inicializalni; ha ez nem elerheto, video-only exporttal folytatja. A WebM muxer video trackje 1-es (`0x81`), audio trackje 2-es (`0x82`) SimpleBlock track id-t hasznal.

Az UI export kozben letiltja a playback/seek/file input utakat es blokkolja a canvas click/keydown, illetve global drawing shortcut interakciokat. A `Stop` reszleges Blob mentest indit: megszakitja a frame hurkot, de lefuttatja a worker `finalize_export` agat. A `Cancel` eldobja a folyamatot. Letolteskor az object URL visszavonasa 1000 ms kesleltetessel tortenik.

## 5. ADR Osszefoglalo

### ADR-001: Nativ Web Audio API vs. p5.sound

* **Dontes:** a playback nativ Web Audio API-n, `AudioContext` es `AudioBufferSourceNode` hasznalataval tortenik.
* **Indoklas:** a `p5.sound` nem resze az elfogadott audio pathnak, es nem ad eleg kontrollt a source node eletciklus, seek es memory safety felett.

### ADR-002: Real-time FFT vs. Offline Analizis

* **Dontes:** teljes offline analizis Web Workerben.
* **Indoklas:** a renderernek nem szabad audio analizist, beat detectiont vagy worker spawn-t vegeznie draw loopban.

### ADR-003: Worker Schema Es TrackAnalysis

* **Dontes:** a worker success payload `type`, `requestId`, `bpm`, `frames`, `events`, `hopSize` es `trackAnalysis` mezoket tartalmaz.
* **Indoklas:** a `trackAnalysis` append-only szerzodeskent boviti a legacy frame/event kimenetet, hogy az uj visual mode-ok gazdagabb zenei kontextust kapjanak.

### ADR-004: Selectable Visual Modes

* **Dontes:** a `State.visualMode` ot bepitett azonosito egyike lehet: `classic`, `temporal`, `dark-techno`, `organic-ambient`, `cyberpunk`. A valasztas UI tulajdon, a renderer pedig `StyleRegistry.get(State.visualMode)` utan a kivalasztott `VisualIdentity.draw()` metodusnak delegalt.
* **Indoklas:** az egyes vizualis nyelvek mely modulokban rejthetik el a sajat szinelmeleti, mozgasdinamikai es sokszog-rajzolasi szabalyaikat, mikozben a renderer orchestration es a p5 backend-hatar stabil marad.
* **Fallback:** ismeretlen stilus ID eseten a registry `classic` identitast ad vissza, igy regi vagy hibas presetek nem torik el a renderelest.

### ADR-005: Visual Tuning Presets Es Playback UI Chrome

* **Dontes:** a tuning defaultok es kontroll metadata a `src/config/visualTuning.ts` fajlban vannak. A presetek `public/visual-tuning-presets/` alatt JSON fajlok, listazasuk `index.json` manifestbol tortenik.
* **Indoklas:** statikus Vite app nem tud megbizhatoan public konyvtarat listazni runtime-ban backend vagy manifest nelkul. A target tuning es morphing a live UX resze, mert az eles preset valtasok nem ugorhatnak hirtelen.
* **Kiterjesztes:** a performance preset szerzodes resze a morph profil es dramaturgiai profil. A partial preset normalizalas sticky modon megorzi a hianyzo aktualis ertekeket. A `State.sectionOverrides` teljesen el lett tavolitva; az automatizalas egyseges `PerformanceAutomationPlan` formaban tarolodik a `State.performancePlan` (auto-generalalt) es `State.editedPerformancePlan` (szerkesztett) allomanyokban. A plan pontjai `PerformanceAutomationPoint` tipusuak: `id`, `time`, `sectionId`, `preset`, `confidence`, `intensity` (0.1-4.0), `reason`, `morphDurationSec`, `morphCurve` es opcionalis `locked` mezokkel. A `TimelineLayers` szerzodes (`waveform`, `rms`, `buildup`, `cues`, `automation` lathatosagi booleanok) vezererli az idovonal retegek megjeleneset.

### ADR-006: Render Backend Boundary

* **Dontes:** effekt modulok csak `VisualRendererBackend`-en keresztul adhatnak ki rajzolasi parancsot.
* **Indoklas:** ez levagja az effekt logikat a p5 konkret API-jarol es elokesziti a WebGPU/shader backend lehetoseget.

### ADR-007: Playback Motion Fade Es Waveform Cache

* **Dontes:** stop/pause utan a vizualis mozgas `State.playbackFade` alapjan lassul, a temporal forgasi fazis pedig `State.rotationPhase` allapotbol jon. A timeline waveform alacsony DPI-s offscreen canvas cache-bol kerul blitelesre.
* **Indoklas:** a vizualis folytonossag nem lazithatja fel a Web Audio source node eletciklusat, es a timeline waveform koltseget cache invalidaciohoz kell kotni a frame-enkenti nagy canvas path epites helyett.

## 6. Aktualis TypeScript Struktura

```text
src/
|-- main.ts
|-- audio/
|   |-- AudioEngine.ts
|   `-- analyzer.worker.ts
|-- config/
|   `-- visualTuning.ts
|-- state/
|   `-- store.ts
|-- types/
|   `-- index.ts
|-- export/
|   |-- WebMExporter.ts
|   `-- export.worker.ts
|-- ui/
|   `-- DashboardUI.ts
|-- visuals/
|   |-- PlexusRenderer.ts
|   |-- VisualDirectorFSM.ts
|   |-- VisualIdentity.ts
|   |-- StyleRegistry.ts
|   |-- RendererBackend.ts
|   |-- P5RendererBackend.ts
|   |-- ClassicPlexusEffect.ts
|   |-- TemporalMusicEffect.ts
|   |-- DarkTechnoIdentity.ts
|   |-- OrganicAmbientIdentity.ts
|   |-- CyberpunkIdentity.ts
|   |-- Particle.ts
|   `-- Shockwave.ts
`-- style.css

public/
`-- visual-tuning-presets/
    |-- index.json
    |-- default.json
    |-- temporal1.json
    |-- temporal2.json
    |-- temporal3.json
    `-- temporal4.json
```

## 7. Kulcsfontossagu TypeScript Szerzodesek

```ts
export interface BeatEvent {
    time: number;
    intensity: number;
    type: 1 | 2 | 3;
}

export interface AudioFrame {
    e: number;
    b: number;
    m: number;
    t: number;
    state: 'IDLE' | 'HIGH' | 'LOW' | 'LOW_DROP' | 'LOW_OVERLOAD';
    eRatio: number;
}

export interface ModulationState {
    kineticTension: number;
    densityDrive: number;
    spectralChaos: number;
    rhythmicImpulse: number;
    macroMomentum: number;
}

export type DirectorState = 'IDLE' | 'INTRO_BREAK' | 'BUILDUP' | 'DROP' | 'GLITCH_LOW_DROP';

export interface DirectorOutput {
    state: DirectorState;
    centripetalOrbit: number;
    glitchIntensity: number;
    invertBackground: boolean;
}

export interface AnalysisRequest {
    requestId: number;
    algorithmVersion: number;
    samples: ArrayBuffer;
    sampleRate: number;
}

export interface AnalysisSuccessMessage {
    type: 'analysis_done';
    requestId: number;
    bpm: number;
    frames: AudioFrame[];
    events: BeatEvent[];
    hopSize: number;
    trackAnalysis: TrackAnalysis;
}

export interface AnalysisErrorMessage {
    type: 'analysis_error';
    requestId: number;
    errorCode: string;
    message: string;
}

export interface RenderState {
    isExporting: boolean;
    exportTime: number;
    currentTime: number;
    duration: number;
}
```

## 8. Validacio Es Tesztek

Az aktualis contract tesztek a `tests/contracts.test.mjs` fajlban vannak. Lefedik tobbek kozott:

* worker success/error payload szerzodest,
* `trackAnalysis` precompute es state publication viselkedest,
* recurring temporal pattern detektalast,
* visual mode valasztast,
* visual tuning defaultokat, kontrollokat es preset kompatibilitast,
* visual identity registryt, UI mode integraciot es preset `visualMode` kompatibilitast,
* FFT alapu analizist az IIR crossover megkozelites helyett,
* playback data copy-vs-transfer policyt,
* stale worker result vedelmet,
* seek/stop idoszinkront,
* loop mode, metrics toggle, draggable tuning es auto-hide chrome UI szerzodest.
* modulacios busz, morphing, dramaturgy, renderer boundary es stream profil viselkedest.
* performance preset szerzodest, sticky preset normalizalast, timeline draw/preset paint interakciokat, playback fade-et es waveform cache optimalizaciot.
* ot visual identity determinisztikus, bongeszo- es p5-fuggetlen mock render futasat ot zenei referenciaprofilon keresztul (`tests/styles-deterministic.test.mjs`).
* offline WebM export lifecycle-t, p5 `noLoop()`/`loop()` tulajdonlast, renderer polling tilalmat, resize-settle sorrendet, vizjel kartya rajzolast es `stopAndSave()` reszleges Blob lezarast (`tests/export-deterministic.test.mjs`).
