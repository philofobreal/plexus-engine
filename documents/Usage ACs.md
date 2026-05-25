# 🎯 FELHASZNÁLÓI ÉS FUNKCIONÁLIS KRITÉRIUMOK (Usage ACs) V0.2

> **Aktuális státusz:** ez a dokumentum a V0.2 termék- és viselkedési AC-k kódhű, TypeScript implementációhoz igazított változata. A régi prototípusos megfogalmazások helyett a `src/`, `public/visual-tuning-presets/` és `tests/` aktuális állapota az irányadó.

## 1. Fájlkezelés és Lejátszás (Audio & Playback)
*   **AC 1.1 - Fájl betöltése:** A felhasználó képes `.mp3`, `.wav` és egyéb böngésző által támogatott audio fájlokat betölteni a "Load Audio" gombbal.
*   **AC 1.2 - Betöltési állapot (UI Lock):** Fájl kiválasztásakor a lejátszás megáll, a `Play` és a csúszka (`Seek bar`) inaktívvá (disabled) válik, a státuszszöveg tájékoztat a dekódolásról és az analízisről.
*   **AC 1.3 - Automatikus végállapot és loop:** Amikor a dal a végéhez ér (duration - 0.1s), a `Loop` mód az alapértelmezett, ezért a lejátszás 0:00-ról újraindul. `Once` módban a lejátszás leáll, a csúszka visszaugrik 0-ra, a vizuális állapotok (`beatDecay`, `snareFlash`, cue állapotok, event indexek) és a UI alaphelyzetbe állnak.
*   **AC 1.4 - Élő Keresés (Seek):** A csúszka húzásakor (drag) az idő-kijelző valós időben frissül. Az egér/ujj elengedésekor, vagy húzás közben (input event) a zene azonnal, pattogás és memóriaszivárgás nélkül a megfelelő időpontra ugrik.

## 2. Makro-Dinamikai Állapotgép (Auto-Routing)
*   **AC 2.1 - Blokkos felosztás:** A rendszer felismeri, hogy az aktuális lejátszási idő a dal melyik zenei ütem-alapú (pl. 4 ütem / 16 beat hosszú) dinamikai blokkjába tartozik, és annak relatív energiáját (0.0 - 1.0) veszi alapul.
*   **AC 2.2 - HIGH Állapot:** Ha a blokk relatív energiája $\ge$ 45% (`0.45`), a rendszer HIGH állapotba lép. A UI-on a szöveg `HIGH` feliratra vált (Cián színnel). A vizuál minden kiszámolt dobütést megjelenít (0.0 büntetés).
*   **AC 2.3 - LOW Állapot:** Ha a blokk relatív energiája < 45%, a rendszer LOW állapotba lép. A UI-on a szöveg `LOW` feliratra vált (Magenta színnel). A vizuál elfojtja a halk zörejeket (büntető algoritmus az aktuális energia alapján).
*   **AC 2.4 - Valós idejű felülbírálat (Drop & Overload Override):**
    *   Ha a rendszer HIGH állapotban van, de a pillanatnyi élő energia beesik 35% alá (`0.35`), azonnal LOW módba kényszerül és a UI-on a `LOW [DROP]` jelzés jelenik meg.
    *   Ha a pillanatnyi élő energia 95% felé (`0.95`) megy, azonnal LOW módba kényszerül és a UI-on a `LOW [OVERLOAD]` jelzés jelenik meg, hogy védje a vizuált a zajos túlvezérléstől.

## 3. Vizuális Reakciók és Plexus Motor
*   **AC 3.1 - Központba vonzó gravitáció:** A részecskék (maximum 75 db) folyamatosan mozognak az aktuális `Energy` alapján. Ha a képernyő középpontjától számított sugaruk meghaladja a látható tér 45%-át, mozgásvektoruk lágyan a középpont felé kezd fordulni.
*   **AC 3.2 - Távolság-alapú Hálózat:** Vonal (Line) csak akkor rajzolódik két pont közé, ha távolságuk egy adott küszöb alatt van. A küszöb az aktuális `AudioFrame.b` render-facing density projekcióval dinamikusan tágul.
*   **AC 3.3 - Fehér-beégés (Whiteout) védelem:** 
    *   Egy csomópontból maximum 6 vonal indulhat ki.
    *   Egy csomópont maximum 2 háromszög-képzésben vehet részt.
    *   A háromszögek alapvető maximális alfa (opacity) értéke soha nem haladhatja meg az 50-et (a 255-ből). Kivételt képeznek a Snare/Drop események hirtelen felvillanásai, amik egy pillanatra túlléphetik ezt (max ~200), de gyorsan elhalványulnak, így elkerülve a tartós beégést.
*   **AC 3.4 - Dob-Szignatúra (Shockwaves):** Az ütésekre a rendszerből a középpontból táguló körök (lökéshullámok) indulnak ki.
    *   *Típus 1 (Kick):* Vastag, közepes sebességű, kék színű hullám.
    *   *Típus 2 (Snare/Clap):* Nagyon vastag, extrém gyors, fehér/rózsaszín hullám. Ezen típusnál a Plexus háromszögek is felvillannak.
    *   *Típus 3 (Hi-Hat):* Vékony, gyors, zöldes hullám.

## 4. Felhasználói Felület (Dashboard)
*   **AC 4.1 - Valós idejű metrikák:** A Dashboard metrikakártyái lejátszás közben mutatják a BPM-et, Energy-t, a render-facing `AudioFrame.b/m/t` értékeket, Melody/Vocal/FX feature értékeket, Beat Hit-et, Progress-t és a `Music Block & Dynamics` állapotot. A látható `Bass`, `Mid`, `Treble` címkék legacy UI-címkék; az aktuális worker contract szerint a mögöttük lévő `b`, `m`, `t` értékek density, melody-presence és fx-presence projekciók.
*   **AC 4.2 - Teljesítmény-kímélő UI frissítés:** A DOM elemek (`innerText`, `style.width`) frissítése szigorúan csak minden 4. képkockánál (frameCount % 4 === 0) történik meg (~15 FPS), hogy ne terhelje a rajzoló (Canvas) motort.
*   **AC 4.3 - BPM Kijelzés:** A sikeres elemzés után a kalkulált BPM a metrics panel normál metrikakártyájaként jelenik meg. A fejléc csak a betöltött audio fájl nevét mutatja.
*   **AC 4.4 - Reszponzivitás:** A tuning panel, metrics grid és seekbar viewport-szélességhez igazodó layoutot használ. A Canvas a teljes ablakra méretezett p5 felület, és `windowResized` eseménynél újraméreteződik.

---

# ⚙️ TECHNIKAI ÉS ARCHITEKTURÁLIS KRITÉRIUMOK (Technical ACs)

## 5. Offline Analízis (Web Worker)
*   **AC 5.1 - Aszinkron működés:** Az audio elemzés egy dedikált háttérszálon fut (`Web Worker`), megakadályozva a Main Thread (UI) lefagyását nagy fájlok (pl. 10 perces mixek) betöltésekor.
*   **AC 5.2 - FFT-alapú spektrális bontás:** A Worker 1024 sample méretű, Hann-ablakkal súlyozott blokkokon futtat FFT-t. Az elemzés ebből számolja a relatív Bass, Mid és High sávokat, a spektrális fluxust, a spektrális centroidot és a spektrális flatness értéket; a vizuális és dob-esemény kimenetek ezekből a spektrális jellemzőkből készülnek, nem IIR crossover szűrőkből.
*   **AC 5.3 - Kétmenetes (Two-pass) analízis:**
    1.  *Kör:* A Worker kiszámolja az RMS energiát, spektrális fluxust, relatív sávenergiákat, centroidot és flatness értéket, majd beat-alapú makro dinamikai blokkokra osztja a dalt.
    2.  *Kör:* A spektrális jellemzőket simítja, ezekből előállítja az `AudioFrame` idővonalat, a `VisualFeatureFrame` sorozatot, a peak picking alapján a `BeatEvent` eseményeket, valamint a szekciókat, cue-kat és ismétlődő zenei mintákat.
*   **AC 5.4 - Worker Output:** A Worker success üzenete az alábbi adatszerkezetet adja vissza: `type: 'analysis_done'`, `requestId`, `bpm`, `frames (Array<AudioFrame>)` (1024 sample-enkénti simított energia/density/melody/fx vetületekkel, `state`-tel és `eRatio`-val), `events (Array<BeatEvent>)`, `hopSize`, valamint `trackAnalysis`. Hiba esetén `type: 'analysis_error'`, `requestId`, `errorCode` és `message` érkezik.

## 6. Lejátszó Motor (Audio Rendering)
*   **AC 6.1 - Natív Web Audio API:** Tilos a `p5.sound` modult használni hang lejátszására. A lejátszást dedikált `AudioBufferSourceNode` végzi a zéró-késleltetés, a pontos időmérés (`audioContext.currentTime`) és a memóriaszivárgások elkerülése érdekében.
*   **AC 6.2 - Pre-computed Szinkronizáció:** Lejátszás közben a főszál (Main Thread) *semmilyen* audio-matematikát nem végez a dob-detektáláshoz. Csak az időbélyeg (timestamp) alapján keresi ki a következő pre-kalkulált ütést és keretet.

## 7. Grafikus Renderelő Motor (Canvas & p5.js)
*   **AC 7.1 - Z-Index Menedzsment:** A Canvas réteg `z-index: 1`, a UI wrapper réteg `z-index: 10`. A UI wrapper `pointer-events: none` attribútummal rendelkezik az üres területeken, hogy a kattintások átmenjenek rajta.
*   **AC 7.2 - O(N²) Optimalizáció:** A Plexus hálózat távolságmérésénél a kód négyzetes távolságot (`distSq = dx*dx + dy*dy`) használ. A CPU-igényes `Math.sqrt()` függvény csak akkor hívódik meg, ha a pontok már biztosan a `maxDistSq` határon belül vannak.
*   **AC 7.3 - Natív Rajz-utasítások:** Háromszögek rajzolásakor a drága `beginShape() ... endShape()` helyett a p5.js hardverközelibb `triangle(x1,y1, x2,y2, x3,y3)` eljárását kell alkalmazni.

## 8. Memória- és Állapotmenedzsment
*   **AC 8.1 - Zombi Node-ok elkerülése:** Pause/Stop esetén, vagy a zene beletekerésekor a meglévő `AudioBufferSourceNode` `onended` eseménykezelője nullázódik, a node leáll és leválasztódik (`disconnect()`), hogy a Garbage Collector azonnal takaríthassa.
*   **AC 8.2 - Objektum újrahasznosítás:** A `particles` tömb a futás kezdetekor egyszer inicializálódik (75 elem). Futás közben a kód nem hoz létre (`new Particle()`) és nem töröl részecskéket, megelőzve a memóriatöredezést. A `Shockwaves` tömb dinamikusan ürül (`splice`), amint egy hullám alfája $\le$ 0.
---
### 💡 Aktuális TypeScript modulok:
A kód a fenti kategóriákat az alábbi modulokra bontja:
*   `src/audio/analyzer.worker.ts` (AC 5.x)
*   `src/audio/AudioEngine.ts` (AC 1.x, AC 6.x, AC 8.x)
*   `src/state/store.ts` és `src/types/index.ts` (megosztott állapot és szerződések)
*   `src/visuals/PlexusRenderer.ts`, `ClassicPlexusEffect.ts`, `TemporalMusicEffect.ts`, `Particle.ts`, `Shockwave.ts` (AC 3.x, AC 7.x)
*   `src/ui/DashboardUI.ts` és `src/main.ts` (AC 1.x, AC 4.x, playback/tuning/preset UI)

## Current TypeScript AC Addendum

*   **AC 3.5 - Visual mode selection:** The user can switch between `Classic` and `Temporal` visual modes without reloading the audio file. Classic preserves the Plexus network behavior. Temporal uses the same playback and precomputed analysis data as continuous visual modulation: polygon color, movement, density, network sensitivity, background tone, and central mechanism rings follow the detected musical details without turning them into explicit bar-aligned labels.
*   **AC 5.5 - Visual music analysis output:** The worker output includes `trackAnalysis` with per-frame visual features, section structure, significant moments, recurring `MusicPattern` entries, and cue events. Playback and rendering may read this data, but must not perform audio analysis in the render loop.
