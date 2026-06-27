# PLEXUS ENGINE - Atfogo Rendszerdokumentacio V0.2

> **Aktualis statusz:** ez a fo rendszerdokumentacio a `plexus-engine/` TypeScript/Vite kodbazis aktualis allapotat irja le. A korabbi single-file HTML prototipus es IIR-alapu DSP megfogalmazasok torteneti hatternek szamitanak, nem kanonikus implementacios szerzodesnek.

## 1. Vezetoi Osszefoglalo

A **Plexus Engine** egy bongeszoben futo, hardvergyorsitott, audio-first generativ vizualizacios motor es eloadoi hangszer (visual instrument). A rendszer alapelve a lejatszas elotti offline zeneanalizis, amely zeneszerkezeti kontextust (szekciok, feszultseggorbek, mintak es cue esemenyek) hoz letre. Lejatszas kozben a renderelo szal nem vegez valos ideju DSP szamitasokat; egy absztrakt modulacios buszon keresztul fogyasztja a normalizalt zenei szandekot, biztositva a stabil szinpadi es produkcios teljesitmenyt. Az aktualis rendszer audio fajlok mellett bongeszo altal tamogatott video fajlokat is be tud tolteni: a video kep muted backplate-kent fut a p5 canvas mogott, mikozben az audio tovabbra is a Web Audio / `AudioEngine` master clock szerint szol.

Az aktualis implementacio het regisztralt vizualis identitast tart fenn a `VisualIdentity` / `StyleRegistry` architekturan keresztul (a `hero` csak akkor regisztralodik, ha a `featureFlags.heroEffect` engedelyezve van):

* `classic`: az eredeti Plexus reszecskehalo, kozponti glow, beat shockwave es polygon flash viselkedes.
* `temporal`: ugyanarra az offline analizisre epulo, teljes track-szintu zenei kontextust hasznalo mod, amely section, feature, cue es pattern adatokat hasznal folyamatos vizualis modulaciora.
* `dark-techno`: szigoru monokrom, minimal ipari stilus eles feher/szurke vonalakkal es ritka strobe-szeru polygon flash viselkedessel.
* `organic-ambient`: lassu, folyekony, pasztell zold/kek/foldszinu stilus, amely eles halozati vonalak helyett puha reszecske-glow retegeket hasznal.
* `cyberpunk`: nagy kontrasztu neon magenta/cian stilus kromatikus aberracio-szeru kettos vonalrajzolassal es determinisztikus glitch offsetekkel.
* `cosmic-wormhole`: 3D terhatasu "csoben repules" mod. Egy konstruktorban allokalt csillagpor-poolt vetit henger-koordinatakbol 2D-be a 24-savos `perceptualSpectrum` es a modulacios busz alapjan. Esemenyvezerelt cso-kanyarodast (a `wormholeCurve` master szerint skalazva), abszolut vilag-koordinatas parallax csillagmezot es egy melyebb `radialGlow` galaxis-reteget ad, amelyek kovetik a kamera elorehaladaset es kanyarodasat. Csak `backend.line`-t es a kapuzott galaxis-glow-t hasznal, determinisztikusan `pseudoNoise()` alapjan. Parameterei a `Wormhole` tuning csoportban talalhatok: `wormholeRadius`, `wormholeDepth`, `wormholeSpeed`, `wormholeWarp`, `wormholeCurve`, `wormholeRing`, `wormholeStarfield`, `wormholeGalaxy`.
* `hero`: bal also playhead pontra szervezett, also horizontalis lane-en jobbrol balra mozgo event-dot vizual, ahol a dot poziciok determinisztikusan `event.time - State.currentTime` alapjan szamolodnak. A mod sajat interaktiv metronomot is hasznalhat: a lane elore mutatja a `PerformanceAutomationPlan` altal utemezett beep ritmust.

## 1.1. Termekvizio Es Celcsoport

A Plexus Engine elsodleges celcsoportja az **elektronikus zeneszek, producerek, DJ-k es live act eloadok**, akik sajat szamaikhoz szeretnenek azonnal generalt, zeneileg intelligens es eloben testreszabhato vizualis kiseretet.

A szoftver pozicionalasa:

> **Plexus Engine:** browser-based audio-reactive visual engine for musicians who want instant generative visuals from their own tracks.

### Miert Nem Klasszikus VJ Szoftver Vagy Streamer Overlay?

1. **Zenei kontextus-vezerelt (Audio-First):** Nem egyszeru clip-launcher vagy OBS widget, hanem zeneszerkezeti esemenyekre (melody, vocal, FX, buildup, drop) reagalo vizualis hangszer.
2. **Offline track-analizis:** Felismeri a dal dramaturgiai ivet (intro, build, drop, break, peak, outro), es a feszultseggorbet elore anticipalva vezerli a reszecskek es sokszogek dinamikajat.
3. **Produkcios es eloadoi fokusz:** A UI, a Tuning Layer es az offline WebM export a gyors preset-valtast, az atmenetek folytonossagat (morphing), a tiszta stream kimenetet es a megoszthato video-renderelest szolgalja. Ha video fajl van betoltve, a rendszer a generativ reteg moge rendereli az eredeti video kepet, es exportkor kompozit WebM-et allit elo.

### Jovobeli Termekutvonal

A fejlesztesek fokuszaban nem ujabb grafikai effektek, hanem az **eloadoi munkafolyamat es integracio (preset + export + performance workflow)** tamogatasa all:

* Elo vizualis presetek exportalasa, mentese es betoltese (Preset Management).
* Bongeszoben futo, worker-alapu offline WebM export, amely OPFS (Origin Private File System) segitsegevel kozvetlenul lemezre streamel. Ez garantalja a mobil-biztos (OOM vedett) mukodest akar 4K felbontas eseten is.
* Megoszthato shareable URL konfiguraciok generalasa.
* OBS-barat, chroma-key es transzparens hatterrel rendelkezo tiszta kimeneti modok.
* MIDI mapping es hardveres BPM szinkronizacio tamogatasa a jovoben.

## 2. Altalanos Architektura Es Adataramlas

A rendszer Vite + TypeScript projekt, explicit runtime retegekkel. A kanonikus modulhatarokat a `documents/governance/architecture-contract.md` es a `documents/implementation/current-typescript-implementation.md` tartja naprakeszen.

1. **Composition (`src/main.ts`):** letrehozza a DOM shellt, az `AudioEngine` peldanyt, a `DashboardUI` peldanyt es a p5 renderert. A kezdeti `#app-loader` eltavolitasat csak akkor inditja, ha a renderer inicializacioja befejezodott es a `bootStart` ota legalabb 800ms eltelt.
2. **UI Layer (`src/ui/DashboardUI.ts`, `src/ui/controllers/`, `src/style.css`):** a `DashboardUI` mar facade/orchestrator szerepet tolt be, nem monolitikus DOM-binding osztaly. A konkret UI kotest a `PlaybackController`, `TuningController` es `ExportController` vegzi; ezek callbackeken keresztul delegalt szandekot adnak vissza a `DashboardUI`-nak. A media loader overlay es progress bar vizualis frissiteset a `PlaybackController` vegzi.
3. **Audio Engine (`src/audio/AudioEngine.ts`):** felelos a hangfajlok dekodolasaert, a `AudioBufferSourceNode` eletciklusert, a kanonikus idoszamitasert, a seek/end resetert, a worker request id kezelesert, a stale worker eredmenyek eldobasaert es a worker terminalasaert. Az `onProgress(progress, stage)` callbacken keresztul a decode fazist es a worker progress telemetriat is tovabbitja a UI-nak. A Hero metronomhoz negy szintetizalt beep stemet tart parhuzamosan szinkronban, es preset automatizalas alapjan sima gain crossfade-del valt koztuk.
4. **Analysis Engine (`src/audio/analyzer.worker.ts`):** dedikalt Web Worker. Nem monolitikus `onmessage` algoritmus: a feldolgozas `SpectralCalibration`, `FeatureExtractor`, `GridAligner`, `SectionAnalyzer` es `DramaturgyBuilder` osztalyokra van bontva. 1024 mintas Hann-windowed FFT pipeline-t hasznal, spektralis fluxust, Hz-alapu relativ savenergiakat, centroidot es flatness erteket szamol, majd `AudioFrame`, `BeatEvent` es `TrackAnalysis` kimenetet publikal. A tempo kimenet mar nem csak scalar BPM: a worker confidence mezoket es rendezett `tempoCandidates` listat is ad, gyenge grid esetben pedig a sectioning energia-reaktiv fallbacket hasznalhat. A nehez FFT ciklus alatt `analysis_progress` uzenetekkel folyamatos telemetriat is kuld a fo szalnak.
5. **Shared contracts/state (`src/types/index.ts`, `src/state/store.ts`):** tarolja a megosztott tipusokat, az elfogadott analizis eredmenyeket, a vizualis modot, loop allapotot, aktualis frame-et, cue allapotokat, modulacios buszt, `videoDominantColor`-t, elo tuningot es target tuningot.
6. **Render Engine (`src/visuals/`):** p5 canvas renderer backend adapterrel, amely 75 elore inicializalt reszecsket, lokeshullamokat, event/cue indexeket es a `StyleRegistry`-bol lekert `VisualIdentity` implementaciokat kezeli. A zene-dramaturgiai allapotszabalyozast a `VisualDirectorFSM.ts` modul vegzi, majd `DirectorOutput` formaban ad render-facing jeleket az identitasoknak.
7. **Offline Export (`src/export/`):** a `WebMExporter` a fo szalon vezerli az offline idohurkot, a p5 canvas atmeretezeset, a `VideoFrame` elkapast, az audio buffer szeletelest es a vizjelkartyat. Ha video backplate aktiv, az export frame-enkent megkeresi az eredeti video megfelelo kepkockajat, azt hatterkent kompozitalja, erre rajzolja a p5 generativ reteget, majd legfelulre a metadata kartyat. Az `export.worker.ts` WebCodecs `VideoEncoder`/optionalis `AudioEncoder` hasznalataval es pure TypeScript EBML/WebM muxerrel allit elo Blob-ot. A fo szal szigoru hardver-encoder-sor alapu visszanyomast (backpressure) alkalmaz, es rendszeresen atveszi a vezerlest a bongeszoesemanyhurkoktol, hogy megelozze a felhasznaloi felulet lefagyasat es a memoriaosszeomlasat mobil eszkozokkel.

## 3. Funkcionalis Specifikacio

### 3.1. Offline Globalis Analizis

A zene vagy tamogatott video betoltesekor a rendszer nem azonnal inditja a lejatszast. Az `AudioEngine` dekodolja a fajl audio tartalmat, explicit masolatot keszit az elso csatorna sample adataibol, majd ezt az `ArrayBuffer`-t kuldi a workernek. A lejatszashoz szukseges `AudioBuffer` a main thread tulajdonaban marad, igy az analizis transfer nem tudja veletlenul detached allapotba tenni a playback adatot. Video fajloknal a UI dinamikus meretlimitet ervenyesit, mielott a fajl `arrayBuffer()`/`decodeAudioData()` utvonalra kerulne: mobilon 150 MB, desktopon 600 MB.

A betoltes UI-ja ket kulon fazist kezel. Az alkalmazas indulaskor a `#app-loader` FOUC-vedelmi overlay legalabb 800ms-ig lathato marad: a `src/main.ts` a renderer inicializaciojat es a minimum kesleltetest `Promise.all`-lal varja, majd fade-out utan eltavolitja a loader elemet. Media betolteskor ettol fuggetlenul a `#media-loader-overlay` jelenik meg. A `PlaybackController` a file valasztasakor nullazza a bar szelesseget, letiltja a lejatszasi kontrollokat, majd a `DashboardUI` altal bekotott `AudioEngine.onProgress()` callbackbol frissiti a `#media-loader-text` es `#media-loader-bar` elemeket. A file input `change` esemenye utan a controller torli az input value-t, igy ugyanaz a media fajl ujra kivalaszthato es ujratoltheto. Ez csak DOM input reset; az `AudioEngine` tovabbra is egyedul birtokolja a dekodolast, a playback source-node eletciklust, a worker request id-ket es a stale eredmenyek eldobasat. A decode fazis `Decoding audio...` allapotot ad, a worker FFT fazisa pedig `analysis_progress` uzeneteken keresztul `Analyzing music...` allapotot es normalizalt progress erteket kuld. Az `AudioEngine` a worker `0.0..1.0` progress erteket a teljes media-load UI `0.2..1.0` savjaba mappeli, igy a progress bar a valodi feldolgozasi telemetriat koveti.

Ha video fajl kerul betoltesre, a `DashboardUI` kezeli a muted `<video>` backplate elemet es az object URL eletciklust. A video play/pause/seek/stop allapotai tovabbra is az `AudioEngine` master clock esemenyeit kovetik, de lejatszas kozben a `DashboardUI` finoman modositja a `video.playbackRate` erteket a `State.modulation.macroMomentum` es `State.modulation.rhythmicImpulse` alapjan, `0.5x..2.0x` kozott. Export inditasakor, pause/stop es clear utvonalakon a sebesseg visszaall `1.0x`-re, es export alatt a sebessegmodulacio nem fut. A video elem sajat hangja mindig muted, hogy ne keletkezzen echo a Web Audio lejatszas mellett. A p5 canvas hattere ilyenkor automatikusan transzparensre valt, hogy a video hatter lathato maradjon. A `DashboardUI` egy 4x4-es offscreen canvasba ritkitva mintat vesz az aktualis video frame-bol, atlagolja az RGB csatornakat, es a `State.videoDominantColor` mezobe irja a renderelok szamara elokeszitett dominans szint.

Uj track betoltesekor, hibaagakon es megszakitasnal az `AudioEngine.clearAnalysisState()` friss, deep copy-val allitja vissza a `State.trackAnalysis` ures allapotat:

```ts
State.trackAnalysis = JSON.parse(JSON.stringify(EMPTY_TRACK_ANALYSIS));
```

Ez memoria- es referencia-szigetelesi szerzodes. Az ures `TrackAnalysis` sablon beagyazott tomboket es objektumokat tartalmaz, ezert referencia szerinti hozzarendeles eseten egy kesobbi betoltes szennyezheti vagy orokolheti az elozo track nested allapotat.

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

A pattern detektalas determinisztikus, de mar nem egzakt string-signature egyezesre epul. A `DramaturgyBuilder` minden eleg hosszu sectiont vektoros jellemzokkel hasonlit a mar letrejott pattern csoportok centroidjahoz: energia, density es dominans feature. Az euklideszi tavolsag `matchThreshold` alatt ugyanabba a zenei motivumba sorolja a sectiont, majd frissiti a csoport centroidjat. Ez stabilabban fogja ossze az ismetlodo refrent vagy dropot akkor is, ha a masodik elofordulas energiaszintje kisse elter. A pattern cue-k opcion ellenorizheto `patternId` mezovel hivatkoznak a megfelelo `MusicPattern` elemre.

A dramaturgiai motor a density, tension, RMS energia es blokk energia iranyvaltozasabol `buildupConfidence` gorbet es `tensionTrends` segmentumokat szamol. A renderer ezt a gorbet a modulacios busz `kineticTension` komponensebe keveri, igy a rendszer a dropok es csucspontok elott finoman novelheti a vizualis feszultseget.

### 3.4. BPM Detektalas Es Kijelzes

A worker 70 es 185 BPM kozott becsul tempot az onset envelope autokorrelacios/comb-filter elemzesevel (`TempoEstimator`), majd rendezett `TempoCandidate` listat publikal. A top-level `bpm` mindig a `tempoCandidates[0].bpm` erteke, ha van candidate. A candidate struktura `bpm`, `score`, `intervalSec`, `peakCount`, `isHalfTime` es `isDoubleTime` mezokkel jelzi a fo es alternativ tempokat, beleertve a half/double-time aliasokat. A `GridAligner` ezen felul kozzeteszi az autoritativ zenei gridet (`beats`, `barStarts`, `gridOffset`), a `tempo`/`alternativeTempos` ertekeket es az egyesitett `timingConfidence` modellt is.

A tempo confidence mezok a root `AnalysisResult` es a `TrackAnalysis` reszen is megjelennek:

* `bpmConfidence`: autokorrelacios tempo salience es beat-onset illeszkedes, onset-szam evidence es kick-transient evidence (RMS rise x bass) altal cappelve.
* `gridConfidence`: onset-grid illeszkedes es timing error alapjan becsult grid megbizhatosag; nem low-end transient hangeron mulik, de gyenge BPM evidencia mellett konzervativ capet kap.
* `downbeatConfidence`: downbeat dominancia, de BPM/grid evidencia altal cappelve.
* `tempoCandidates`: rendezett alternativ tempo lista.
* `timingConfidence`: egyesitett `{ tempo, beat, grid, overall }` modell (`0..1` komponensenkent); az `overall` a harom komponens kevereke, es nem haladja meg a legerosebbet.

A low/kick-transient evidence cap szandekosan nem altalanos ritmus-confidence: low/kick transient supportot mer, ezert bass-light vagy magas tartomanyu ritmusoknal konzervativan viselkedhet. A downbeat confidence nem lehet magas, ha a BPM vagy grid confidence alacsony. A UI-ban a BPM kompakt fejlec badge-kent jelenik meg a betoltott audio fajl neve mellett; a metrics grid nem tartalmaz kulon BPM kartyat. A BPM/grid/downbeat confidence es alternativ tempo debug tooltip csak `featureFlags.analyzerDebugOverlay` alatt jelenik meg.

## 4. Technikai Es Algoritmikus Specifikaciok

### 4.1. DSP A Workerben

Az aktualis worker nem IIR crossover szuroket hasznal. A `src/audio/analyzer.worker.ts` 1024 mintas hop merettel dolgozik, minden frame-et Hann ablakkal sulyoz, majd FFT-n szamolja a spektralis jellemzoket.

A worker belso felelossegei adat-orientalt pipeline-ba vannak bontva:

1. `SpectralCalibration`: determinisztikus pre-pass, amely track-szintu spektralis kozeppontokat, safety range-en beluli Hz savokat es lightweight musical profile hintet becsul, alacsony confidence eseten default savokra esik vissza.
2. `FeatureExtractor`: Hann-windowed FFT, RMS, spectral flux, Hz-alapu sub/bass/lowMid/mid/presence/brilliance/air band ratio, centroid, flatness, pitch confidence, Zero Crossing Rate, 85% spectral rolloff, spectral crest es tipikus RMS/flux maximumok.
3. `GridAligner`: az egyetlen autoritativ idozitesi motor. Pipeline: onset envelope -> `TempoEstimator` (autokorrelacios/comb tempo candidate-ek) -> half/double feloldas -> `BeatTracker` (dinamikus programozasu beat tracking) -> bar/downbeat illesztes. Kimenete a rendezett tempo candidate-ek, a zenei grid (`beats`, `barStarts`, `gridOffset`), a `tempo`/`alternativeTempos`, az egyesitett `timingConfidence` es a legacy BPM/grid/downbeat confidence. A `TempoEstimator` es a `BeatTracker` determinisztikus, tiszta `Float32Array`/`Math` modulok; a `BeatTracker` a gridet csendes/breakdown szakaszokon at is extrapolalja.
4. `FeatureNormalizer`: mar kiszamolt tipikus maximumokkal normalizalja a nyers `Float32Array` jeleket; nem vegez masodik sortolast az orchestratorban.
5. `FeatureClassifier`: normalizalt vektorokbol szamolja a semantic feature jeleket (`melodyRaw`, `vocalRaw`, `fxRaw`, `densityRaw`, `brightnessRaw`, `tensionRaw`). A melody es vocal ertekek spektralis heurisztikak, nem stem separation; ZCR-t, spectral crestet, flatnesst, rolloffot, Hz savaranyokat es kis sulyu `SpectralCalibrationMusicalProfile` hintet hasznalnak.
6. `TemporalSmoother`: EMA simitast alkalmaz a classifier kimeneteire, az elso input ertekrol inditva, fals track-eleji fade-in nelkul.
7. `NoveltyAnalyzer`: determinisztikus, grid-fuggetlen valtozas-evidencia detektor. Kizarolag a mar kiszamolt `VisualFeatureFrame`/`AudioFrame` adatokbol dolgozik (nincs realtime FFT, nincs audio buffer olvasas, nincs render-loop matek), idoalapu trailing-vs-leading feature-ablak kontraszttal szamol egy normalizalt `0..1` `noveltyCurve` gorbet. A curve pontjai csak szamok; az `AnalysisReason` taxonomy (`energy-rise`, `energy-drop`, `density-rise`, `bass-return`, `bass-drop`, `high-transient`, `novelty-peak`) kizarolag a sparse `noveltyPeaks` listan szereplo lokalis csucsokon jelenik meg, amelyet a section-hatar snapeles fogyaszt.
8. `SectionAnalyzer`: normal esetben BPM-gridhez igazodott bar aggregacio, kritikusan alacsony `gridConfidence` es `bpmConfidence` eseten energia-reaktiv time-window fallback; adaptive threshold, `BarAnalysis`, `TrackSection`, RMS mezok, dominans feature es evidence-based szekciocimkezes. A novelty csucsokbol `boundaryCandidates` listat publikal (megbizhato grid eseten barhoz snapelt `bar-aligned`, kulonben `novelty`/`energy-reactive` `timingMode`), es minden szekciot `reasons` tombbel annotal. A label dontes tobb-idotavu kontrasztot hasznal: a `drop` cimke a megelozo 4-8 bar-hoz kepesti magas energiaju erkezest kovetel (buildup vagy break utan, valodi elozmeny-kontextussal), igy a csendes intro utani elso groove es a sima hangos verse nem sul el dropkent; gyenge evidencia eseten `verse` fallback. A szigoru-grid hatarpoziciok valtozatlanok maradnak, igy a regresszios masterek nem driftelnek.
9. `DramaturgyBuilder`: `VisualCueEvent`, significant moment es fuzzy, euklideszi tavolsaggal csoportositott `MusicPattern` kimenetek. A `BeatEvent`-ek az autoritativ `GridAligner.beats`-bol szarmaznak, nem onallo peak-pickerbol; a csendes/extrapolalt beateket (ahol nincs erdemi onset energia) vizualis eventkent elnyomja, igy a breakdown nem araszt el a renderert fantom villanasokkal, mikozben a grid maga atfedi a csendet. Az impact/break significant moment cue-k a legkozelebbi novelty csucsbol kapnak `reasons` taxonomiat.
10. `BeatEventClassifier`: egy beatet a beat frame-en mert bass ratio, ZCR, rolloff es high-band context alapjan sorol be belso hit tipusba, majd visszater a publikus `1 | 2 | 3` beat type szerzodessel.
11. `SpectralPivot`: offline post-process, amely a buildup/LOW_DROP kompenzaciot es a `sE <= 0.04` zajzarat kezeli; mutalja a feature/frame tomboket es visszaadja a `spectralPivot` tombot.

Az `src/analyzer/analyzeAudio.ts` orkesztrator ennek megfeleloen mar inline matematikatol mentes: peldanyositja es sorba rendezi a pipeline lepeseket, osszerakja a `TrackAnalysis` payloadot, majd visszaadja a typed `AnalysisResult` objektumot. A `src/audio/analyzer.worker.ts` tovabbra is csak worker boundary: bemeneti uzenetet olvas, `analyzeAudio()`-t hiv, progress/success/error uzenetet posztol vissza.

Az elfogadott render-facing kimenetek:

* `AudioFrame.e`: normalizalt RMS energia.
* `AudioFrame.densityProj`: simitott density projekcio.
* `AudioFrame.melodyProj`: simitott spektralis melody-presence heurisztika.
* `AudioFrame.fxProj`: simitott fx-presence projekcio.
* `AudioFrame.state`: `IDLE`, `HIGH`, `LOW`, `LOW_DROP` vagy `LOW_OVERLOAD`.
* `AudioFrame.eRatio`: blokk-szintu energia arany.

A UI-ban a korabbi `Bass`, `Mid`, `Treble` dashboard narrativak megszuntek. A metrics grid `Density`, `Melody Presence`, `Vocal`, `FX`, `Beat Impulse` es `Dynamics State` cimkeket hasznal. A `Melody Presence` es `Vocal` spektralis heurisztikak, nem stem separation vagy hangjegy/lyrics felismeres. A BarAnalysis `bass/mid/treble` mezoi tovabbra is nyers spektralis savaranyok, de ezek csak timeline/debug kontextusban jelennek meg, nem az `AudioFrame` projekciok nevei.

### 4.2. Plexus Halo Optimalizalas

A visual identity implementaciok negyzetes tavolsagellenorzest hasznalnak hot loopban, amikor reszecske-kapcsolatokat vizsgalnak. A gyokvonas csak akkor tortenik meg, amikor a pontok mar biztosan a maximum tavolsagon belul vannak. A particle pool 75 elemre inicializalodik setupkor, normal draw loopban nem jonnek letre uj `Particle` peldanyok.

Az effekt modulok `VisualRendererBackend` interfeszen keresztul rajzolnak. A p5-specifikus hivasokat a `P5RendererBackend` adapter tartalmazza, igy a scene logika mock backenddel tesztelheto es kesobb WebGPU/shader backend fele mozgathato.

### 4.2.1. Modulacios Busz Es Parameter Morphing

`computeModulationBus()` az aktualis `AudioFrame`, `VisualFeatureFrame`, beat decay, cue decay es tuning alapjan ot normalizalt jelet allit elo: `kineticTension`, `densityDrive`, `spectralChaos`, `rhythmicImpulse`, `macroMomentum`. A keplet minden kimenetet `0.0..1.0` tartomanyba szorit es `audioSensitivity` alapjan skalaz.

A performance plan generator preset valasztasa metadata-alapu. `GeneratorOptions.presetMetadata` a UI altal elore betoltott preset JSON tartalmat kapja (`State.preloadedPresets`), a `choosePreset()` pedig eloszor a tuning es dramaturgiai metadata alapjan rangsorol: peldaul drop/peak szekcioknal a magas `particleEnergySpeed`, `particleBeatSpeed`, `polygonFlash`, `fxChaos` es alacsony `dropDampening`; build szekcioknal a `buildupIntensity` es temporal mozgasi parameterek; break/intro szekcioknal a visszafogott energia es `breakRestraint` erositik a pontszamot. Ha nincs hasznalhato metadata, a regi nev-hint fallback tovabbra is biztonsagi halo.

`State.visualTuning` az elo, interpolalt allapot. `State.targetTuning` a presetek es UI csuszkak celallapota. A render ciklus elejen az elo tuning a `transitionSpeed` szerint kozelit a celhoz, tulcsuszas nelkul.

A `buildupConfidence` mar nem csak kozvetlen modulacios erosites. A `VisualDirectorFSM` `BUILDUP` allapotban `centripetalOrbit` erteket publikal a `State.directorOutput` mezobe. A particle update ezt az erteket befele mutato es tangencialis komponensre bontja, igy a buildup fazis spiral jellegu, centripetalis mozgasba rendezi a reszecskeket.

A Hero mod interaktiv metronomja az "Interactive Stem Switching" technikat hasznalja. Az analizis utan a `HeroMetronome` negy mono stemet general a negy ritmusmodhoz (quarter, off-beat, triplet, syncopated). Lejatszas kozben az `AudioEngine` mind a negy stemet a fo audio source-szal azonos offsetrol inditja, a nem aktiv gainjeit nullan tartja, es `heroBeepMode` / `heroBeepVolume` alapjan siman atkeveri az aktiv stemet. Igy az automatizalt presetvaltas ritmusa hallhatoan es vizualisan is idoben marad.

### 4.2.2. Playback Fade Es Timeline Waveform Cache

`State.playbackFade` render-facing mozgasi szorzo. Lejatszas kozben az ertek 1 fele kozelit, stop/pause utan pedig fokozatosan csokken. A `Particle` mozgas es a `TemporalMusicEffect` rotacios fazisa ezt fogyasztja, igy a vizual nem fagy be hirtelen, mikozben az audio source node eletciklus tovabbra is az `AudioEngine` tulajdona.

`State.rotationPhase` valtja ki a p5 frame count alapu temporal forgast. A fazis csak a renderer allapotabol es a playback fade-bol kovetkezik, ezert a temporal mod nem lesz kozvetlenul fuggve a canvas backend frame szamlalojatol.

A dramaturgiai timeline waveformja nem minden frame-ben epit nagy canvas pathot. A `TimelineCanvas` az `AudioEngine.getAudioBuffer()` utan kapott bufferbol elore szamolt, RMS-jellegu peak bucketeket tarol `Float32Array` waveform cache-ben. A cel felbontas 80 Hz, legalabb 512 bucket es legfeljebb 500000 pont. A lathato waveform egy ujrahasznalt offscreen canvasba rajzolodik, majd `drawImage` hivasal blitelodik a timeline-ra. A cache kulcsa a waveform forras hossza, a timeline merete es a timeline viewport (`State.zoom`/`State.pan`). Mely zoomnal a mintavetelezes linearis interpolacioval tortenik a szomszedos peak bucketek kozott, igy a waveform nem lesz lepcsos. Ha nincs audio-buffer peak cache, a renderelo csak az elore szamolt `AudioFrame.e` projection ertekekre esik vissza. Ez tovabbra is precomputed waveform projection, nem runtime audio analysis.

### 4.2.3. Timeline Viewport, Automation Zone Es Chrome Auto-Hide

A timeline viewport kanonikus allapota a `State.zoom` es `State.pan`. A `State.pan` masodpercben tarolja a lathato ablak kezdetet, a `State.zoom` pedig a nagyitast. A maximum zoom nem fix 16x: a `DashboardUI` es a `TimelineCanvas` ugyanazt a `max(16, duration / 5.0)` kepletet hasznalja, igy hosszu trackeknel is legalabb korulbelul 5 masodperc marad lathato, mikozben rovidebb trackeknel megmarad a korabbi 16x minimum plafon. A wheel zoom a kurzor alatti idot tartja stabilan, a Shift-drag vagy kozepso gomb panolja a timeline viewportot, a sima bal drag pedig scrub buffering utvonalon mozgatja a playheadet.

A timeline automation rendering nem vagja le elore a morph curve x koordinatait. A `TimelineCanvas` unclipped koordinatakkal szamolja a `linear`, `easeInOut` es `exponential` gorbeket, majd a canvas clippingre bizza a kilogo pixelek eltunteteset. Ezert a reszben lathato automation zone-ok nem tunhetnek el a timeline viewport szeleinel. A preset-szin signature jeloli a zone kitoltest, a morph curve-et, az intensity/sensitivity handle vonalat es a hover/selection allapotot. A morph utani zonaszakasz halvanyitott. A gorbe szegmensszama minimum 15, de nagyobb morph szelessegnel dinamikusan no. Az RMS/bar vonal kis idobeli rahagyassal rajzolodik, hogy a timeline viewport bal es jobb szelen is folytonos maradjon.

A chrome auto-hide UI chrome viselkedes. A dashboard indulaskor locked-visible allapotban van, igy a chrome auto-hide nem fut, amig a felhasznalo a visual surface single-click gesztussal ki nem oldja. Az explicit unpin gyors, 400ms hide feedbacket hasznal; az ordinary inactivity, hover leave es focus-out utvonalak kb. 1400ms kesleltetest hasznalnak. Hover/focus kozben a hide timer torlodik vagy ujra van utemezve. Ez nem renderer, analyzer vagy playback felelosseg.

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
2. aktiv video eseten `video.currentTime = State.exportTime`, majd `seeked` es szukseg szerint `loadeddata` varakozas
3. `p5Instance.redraw()`
4. video hatter, p5 overlay es metadata kartya kompozitalasa
5. `new VideoFrame(canvas, { timestamp })`
6. `await nextAnimationFrame()`
7. worker `encode_frame`

Ez garantalja, hogy a bal felso zenei informacios kartya/vizjel benne legyen az elkapott kepkockaban, mielott a bongeszo ujabb feladatban puffert cserelhetne vagy torolhetne. Canvas resize utan az exporter egy kulon animation frame-et var az elso frame elott, hogy a p5/bongeszo backing store stabil legyen.

A metadata kartya tartalma: sotet rounded panel, ritmusra pulzalo cian pont (`State.beatDecay`), `PLEXUS ENGINE` felirat, a betoltott track neve es optionalis BPM badge. A track nev tul hosszu esetben `...` suffixszel vagodik. A rajzolas `ctx.save()` / `ctx.restore()` parban tortenik.

Ha a betoltott `AudioBuffer` elerheto, az exporter frame-enkent ketcsatornas planar `Float32Array` hangszeletet kuld a workernek. A worker megprobal Opus `AudioEncoder`-t inicializalni; ha ez nem elerheto, video-only exporttal folytatja. A WebM muxer video trackje 1-es (`0x81`), audio trackje 2-es (`0x82`) SimpleBlock track id-t hasznal.

A tenyleges `VideoEncoder` konfiguracio es az `encoder.encode()` hivas az `export.worker.ts` felelossege; a `WebMExporter` backend-facade es fo-szali orchestrator. A worker `latencyMode: 'quality'` es `bitrateMode: 'constant'` beallitast hasznal. Minden export elso frame-je keyframe, majd masodpercenkent uj keyframe kenyszeritett: az intervallum `max(1, round(framerate))`, vagyis 60 FPS-nel 60, 30 FPS-nel 30 frame. A szamlalo minden `start_export` elejen ujraindul.

A veges es pozitiv explicit `StartExportRequest.bitrate` egeszre kerekitve felulirja a fallbacket; nulla, negativ, nem veges vagy hianyzo erteknel a worker fallbacket hasznal. Az export-minosegi CBR savok mar a nevleges pixelszam 75%-atol ervenyesek: 720p savban 8 Mbps, 1080p savban 14 Mbps, 4K savban 40 Mbps. Ez megakadalyozza, hogy egy 4K-kozeli crop vagy bongeszo altal kerekitett meret 14 Mbps-ra essen vissza. A legkisebb sav alatt pixelszam-aranyos skala ervenyes legalabb 2 Mbps ertekkel. A policy a sotet es statikus generativ jelenetek blokk- es gradiensstabilitasat celozza. Dither nincs a normal export utvonalon, mert rontana a pixel-determinizmust; csak valos bongeszotesztben megmarado artifact eseten lehet kesobbi fallback.

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
* **Kiterjesztes:** a worker success payload resze az `adaptiveThreshold`, a tempo contract resze pedig a `bpmConfidence`, `gridConfidence`, `downbeatConfidence` es `tempoCandidates` root es `TrackAnalysis` szinten. Ha candidate letezik, `bpm === tempoCandidates[0].bpm`. Az autoritativ idozitesi modell publikus contract mezokent jelenik meg: root szinten `beats`, `barStarts` es `timingConfidence`, a `TrackAnalysis`-en pedig a teljes modell (`tempo`, `tempoConfidence`, `beats`, `beatConfidence`, `barStarts`, `alternativeTempos`, `timingConfidence`). Regi payload normalizalasnal a confidence mezok `0`, a candidate/grid listak ures tombok, a `timingConfidence` pedig nulla komponensekkel toltodik. Append-only modon tovabbi opcionalis mezok kerultek a `TrackAnalysis`-re: `noveltyCurve` (per-frame `number[]`, 0..1), `noveltyPeaks` (`Array<NoveltyPoint>`, a reason taxonomiat csak ezek a sparse csucsok hordozzak), es `boundaryCandidates` (`Array<SectionBoundaryCandidate>`), valamint a `TrackSection`/`VisualCueEvent` opcionalis `reasons` (`AnalysisReason[]`) mezoje; regi mentesek/exportok normalizalasakor ezek ures tombre esnek vissza.
* **Indoklas:** a `trackAnalysis` append-only szerzodeskent boviti a legacy frame/event kimenetet, hogy az uj visual mode-ok gazdagabb zenei kontextust kapjanak, es a downstream reteg ne kezelje ugy a gyenge tempo-grid becslest, mintha biztos lenne.

### ADR-004: Selectable Visual Modes

* **Dontes:** a `State.visualMode` het bepitett azonosito egyike lehet: `classic`, `temporal`, `dark-techno`, `organic-ambient`, `cyberpunk`, `cosmic-wormhole`, `hero` (utobbi feature-flag mogott). A valasztas UI tulajdon, a renderer pedig `StyleRegistry.get(State.visualMode)` utan a kivalasztott `VisualIdentity.draw()` metodusnak delegalt.
* **Indoklas:** az egyes vizualis nyelvek mely modulokban rejthetik el a sajat szinelmeleti, mozgasdinamikai es sokszog-rajzolasi szabalyaikat, mikozben a renderer orchestration es a p5 backend-hatar stabil marad.
* **Fallback:** ismeretlen stilus ID eseten a registry `classic` identitast ad vissza, igy regi vagy hibas presetek nem torik el a renderelest.

### ADR-005: Visual Tuning Presets Es Playback UI Chrome

* **Dontes:** a tuning defaultok es kontroll metadata a `src/config/visualTuning.ts` fajlban vannak. A presetek `public/visual-tuning-presets/` alatt JSON fajlok, listazasuk `index.json` manifestbol tortenik.
* **Indoklas:** statikus Vite app nem tud megbizhatoan public konyvtarat listazni runtime-ban backend vagy manifest nelkul. A target tuning es morphing a live UX resze, mert az eles preset valtasok nem ugorhatnak hirtelen.
* **Kiterjesztes:** a performance preset szerzodes resze a morph profil es dramaturgiai profil. A partial preset normalizalas sticky modon megorzi a hianyzo aktualis ertekeket. A `State.sectionOverrides` teljesen el lett tavolitva; az automatizalas egyseges `PerformanceAutomationPlan` formaban tarolodik a `State.performancePlan` (auto-generalalt) es `State.editedPerformancePlan` (szerkesztett) allomanyokban. A plan pontjai `PerformanceAutomationPoint` tipusuak: `id`, `time`, `sectionId`, `preset`, `confidence`, `intensity` (0.1-4.0), `reason`, `morphDurationSec`, `morphCurve`, opcionalis `analysisConfidence`, `timingMode` (`bar-aligned` | `novelty` | `energy-reactive`) es opcionalis `locked` mezokkel. A `TimelineLayers` szerzodes (`waveform`, `rms`, `buildup`, `cues`, `automation` lathatosagi booleanok) vezererli az idovonal retegek megjeleneset. A timeline viewport `State.zoom`/`State.pan` parja kanonikus; max zoomja dinamikus (`max(16, duration / 5.0)`). Az automation zone renderelesnek viewport szeleken is meg kell tartania a reszben lathato zonakat, unclipped morph curve geometriaval es preset-szin alapjelolessel.

### ADR-006: Render Backend Boundary

* **Dontes:** effekt modulok csak `VisualRendererBackend`-en keresztul adhatnak ki rajzolasi parancsot.
* **Indoklas:** ez levagja az effekt logikat a p5 konkret API-jarol es elokesziti a WebGPU/shader backend lehetoseget.

### ADR-007: Playback Motion Fade Es Waveform Cache

* **Dontes:** stop/pause utan a vizualis mozgas `State.playbackFade` alapjan lassul, a temporal forgasi fazis pedig `State.rotationPhase` allapotbol jon. A timeline waveform alacsony DPI-s offscreen canvas cache-bol kerul blitelesre; a peak cache `Float32Array`, 80 Hz cel felbontassal es 500000 pontos plafonnal, mely zoomnal linearis interpolacioval mintazva.
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
|   |-- DashboardUI.ts
|   |-- GestureEngine.ts
|   |-- TimelineCanvas.ts
|   `-- controllers/
|       |-- PlaybackController.ts
|       |-- TuningController.ts
|       `-- ExportController.ts
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
|   |-- HeroEffectIdentity.ts
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
    e: number;                    // normalized RMS energy
    densityProj: number;          // smoothed spectral-flux density projection
    melodyProj: number;           // smoothed tonal melody-presence projection
    fxProj: number;               // smoothed FX/noise/transient projection
    perceptualSpectrum: number[]; // 24-band track-relative balance, log 20 Hz..16 kHz
    state: 'IDLE' | 'HIGH' | 'LOW' | 'LOW_DROP' | 'LOW_OVERLOAD';
    eRatio: number;
}

// Explanatory taxonomy for WHY a boundary/label/cue was chosen (append-only union).
export type AnalysisReason =
    | 'bar-aligned' | 'energy-rise' | 'energy-drop' | 'density-rise' | 'bass-return'
    | 'bass-drop' | 'high-transient' | 'percussive-onset' | 'after-buildup'
    | 'low-grid-confidence' | 'novelty-peak' | 'section-position' | 'weak-evidence-fallback';

export interface NoveltyPoint { time: number; value: number; reasons: AnalysisReason[]; }

export interface SectionBoundaryCandidate {
    time: number;
    confidence: number;
    timingMode: 'bar-aligned' | 'energy-reactive' | 'novelty';
    reasons: AnalysisReason[];
}

// Append-only novelty extensions on TrackAnalysis (alongside the existing timing/section model):
//   noveltyCurve?:        number[]                     // per-frame 0..1; time = i * featureHopSize / sampleRate
//   noveltyPeaks?:        NoveltyPoint[]               // sparse labeled peaks (the curve itself carries no reasons)
//   boundaryCandidates?:  SectionBoundaryCandidate[]   // realized internal section boundaries only; no track-start candidate
// TrackSection and VisualCueEvent additionally carry an optional `reasons?: AnalysisReason[]`.

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
    phraseSize: number;
}

export interface AnalysisSuccessMessage {
    type: 'analysis_done';
    requestId: number;
    bpm: number;
    bpmConfidence: number;
    gridConfidence: number;
    downbeatConfidence: number;
    tempoCandidates: TempoCandidate[];
    adaptiveThreshold: number;
    frames: AudioFrame[];
    events: BeatEvent[];
    hopSize: number;
    beats: number[];
    barStarts: number[];
    timingConfidence: TimingConfidence;
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
    // ... viewport (zoom/pan), frames, sections, bars, cues, plan, layers, hover/selection ...
    noveltyCurve?: number[];                       // per-frame novelty values for the debug overlay
    boundaryCandidates?: SectionBoundaryCandidate[];
    showAnalyzerDebugOverlay?: boolean;            // declarative gate for the analyzer debug overlay
}

export interface TempoCandidate {
    bpm: number;
    score: number;
    intervalSec: number;
    peakCount: number;
    isHalfTime: boolean;
    isDoubleTime: boolean;
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
* hat bepitett visual identity (a `cosmic-wormhole`-lal egyutt) determinisztikus, bongeszo- es p5-fuggetlen mock render futasat ot zenei referenciaprofilon keresztul (`tests/styles-deterministic.test.mjs`).
* offline WebM export lifecycle-t, p5 `noLoop()`/`loop()` tulajdonlast, renderer polling tilalmat, resize-settle sorrendet, vizjel kartya rajzolast es `stopAndSave()` reszleges Blob lezarast (`tests/export-deterministic.test.mjs`).
* a dramaturgia (performance-automation terv) vagolapra mentesenek es betoltesenek szerializalasat, validalasat es normalizalasat, az osszes edge-case-szel egyutt (`tests/dramaturgy-transfer.test.mjs`).
