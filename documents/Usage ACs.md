# 🎯 FELHASZNÁLÓI ÉS FUNKCIONÁLIS KRITÉRIUMOK (Usage ACs) V0.2

## 1. Fájlkezelés és Lejátszás (Audio & Playback)
*   **AC 1.1 - Fájl betöltése:** A felhasználó képes `.mp3`, `.wav` és egyéb böngésző által támogatott audio fájlokat betölteni a "Load Audio" gombbal.
*   **AC 1.2 - Betöltési állapot (UI Lock):** Fájl kiválasztásakor a lejátszás megáll, a `Play` és a csúszka (`Seek bar`) inaktívvá (disabled) válik, a státuszszöveg tájékoztat a dekódolásról és az analízisről.
*   **AC 1.3 - Automatikus végállapot:** Amikor a dal a végéhez ér (duration - 0.1s), a lejátszás automatikusan leáll, a csúszka visszaugrik 0-ra, a vizuális állapotok (Energy, BeatDecay) és a UI alaphelyzetbe (IDLE) állnak.
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
*   **AC 3.2 - Távolság-alapú Hálózat:** Vonal (Line) csak akkor rajzolódik két pont közé, ha távolságuk egy adott küszöb alatt van. A küszöb a Basszus értékkel dinamikusan tágul (min 80px, max ~180px).
*   **AC 3.3 - Fehér-beégés (Whiteout) védelem:** 
    *   Egy csomópontból maximum 6 vonal indulhat ki.
    *   Egy csomópont maximum 2 háromszög-képzésben vehet részt.
    *   A háromszögek alapvető maximális alfa (opacity) értéke soha nem haladhatja meg az 50-et (a 255-ből). Kivételt képeznek a Snare/Drop események hirtelen felvillanásai, amik egy pillanatra túlléphetik ezt (max ~200), de gyorsan elhalványulnak, így elkerülve a tartós beégést.
*   **AC 3.4 - Dob-Szignatúra (Shockwaves):** Az ütésekre a rendszerből a középpontból táguló körök (lökéshullámok) indulnak ki.
    *   *Típus 1 (Kick):* Vastag, közepes sebességű, kék színű hullám.
    *   *Típus 2 (Snare/Clap):* Nagyon vastag, extrém gyors, fehér/rózsaszín hullám. Ezen típusnál a Plexus háromszögek is felvillannak.
    *   *Típus 3 (Hi-Hat):* Vékony, gyors, zöldes hullám.

## 4. Felhasználói Felület (Dashboard)
*   **AC 4.1 - Valós idejű metrikák:** A Dashboard (8 kártya) lejátszás közben mutatja a simított (smoothed) Energy, Bass, Mid, Treble, Beat Hit, Progress és Active Strategy értékeket.
*   **AC 4.2 - Teljesítmény-kímélő UI frissítés:** A DOM elemek (`innerText`, `style.width`) frissítése szigorúan csak minden 4. képkockánál (frameCount % 4 === 0) történik meg (~15 FPS), hogy ne terhelje a rajzoló (Canvas) motort.
*   **AC 4.3 - BPM Kijelzés:** A sikeres elemzés után a fejlécben megjelenik a zene kalkulált BPM értéke egy világító plecsnin.
*   **AC 4.4 - Reszponzivitás:** Ha az ablak mérete kisebb, mint 900px széles vagy 100vh magas, a UI nem esik szét, hanem natív böngészős görgetősáv (overflow) jelenik meg. A Canvas ezalatt is fixen a látható ablak (viewport) közepén marad (`position: fixed`).

---

# ⚙️ TECHNIKAI ÉS ARCHITEKTURÁLIS KRITÉRIUMOK (Technical ACs)

## 5. Offline Analízis (Web Worker)
*   **AC 5.1 - Aszinkron működés:** Az audio elemzés egy dedikált háttérszálon fut (`Web Worker`), megakadályozva a Main Thread (UI) lefagyását nagy fájlok (pl. 10 perces mixek) betöltésekor.
*   **AC 5.2 - Crossover szűrés:** A Worker 3 virtuális DSP sávot (Bass, Mid, High) hoz létre IIR (Infinite Impulse Response) szűrőkkel az 1024 sample méretű ablakokon.
*   **AC 5.3 - Kétmenetes (Two-pass) analízis:**
    1.  *Kör:* A Worker kiszámolja az RMS energiákat és a Spektrális Fluxust, majd dinamikai blokkokra osztja a dalt.
    2.  *Kör:* Megkeresi a lokális maximumokat (Peak picking), megállapítja a dob típusát (kombinált Flux pontozás alapján), és a blokk globális energiájához viszonyított Intenzitást (Intensity).
*   **AC 5.4 - Worker Output:** A Worker kizárólag az alábbi adatszerkezetet adja vissza: `bpm (number)`, `frames (Array<AudioFrame>)` (ami tartalmazza a 1024 sample-enkénti sáv-energiákat, a kalkulált `state`-et és `eRatio`-t), valamint a `events (Array<BeatEvent>)`.

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
### 💡 Javaslat a TypeScript portoláshoz:
A kód feldarabolása során érdemes a fenti kategóriákat **külön osztályokba vagy szolgáltatásokba (Services)** szervezni. Pl:
*   `AudioAnalyzerWorker.ts` (AC 5.x)
*   `AudioPlaybackService.ts` (AC 6.x, AC 8.x)
*   `MacroDynamicsEngine.ts` (AC 2.x)
*   `PlexusRenderer.ts` (AC 3.x, AC 7.x)
*   `DashboardUI.tsx` vagy `.vue` (AC 1.x, AC 4.x)

## Current TypeScript AC Addendum

*   **AC 3.5 - Visual mode selection:** The user can switch between `Classic` and `Temporal` visual modes without reloading the audio file. Classic preserves the Plexus network behavior. Temporal uses the same playback and precomputed analysis data as continuous visual modulation: polygon color, movement, density, network sensitivity, background tone, and central mechanism rings follow the detected musical details without turning them into explicit bar-aligned labels.
*   **AC 5.5 - Visual music analysis output:** The worker output includes `trackAnalysis` with per-frame visual features, section structure, significant moments, recurring `MusicPattern` entries, and cue events. Playback and rendering may read this data, but must not perform audio analysis in the render loop.
