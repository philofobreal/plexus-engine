# PLEXUS ENGINE – Átfogó Rendszerdokumentáció V0.2
https://aistudio.google.com/prompts/1fd-DLh6ASLPZPzMbirNAJqUYC5T8Tu0t

## 1. Vezetői Összefoglaló (Executive Summary)
A **Plexus Engine** egy böngészőben futó, hardvergyorsított, reaktív audio-vizualizációs motor. Fő megkülönböztető jegye a hagyományos vizualizátorokhoz (pl. Winamp, egyszerű webes equalizerek) képest a **zéró-késleltetésű (zero-latency) előzetes analízis (Pre-computation)** és a **makro-dinamikai állapotgép (Macro-Dynamics State Machine)**. A rendszer megérti a zene szerkezetét (kiállások, dropok), azonosítja a dobok típusát (Kick, Snare, Hi-hat), és a vizuális stratégiát (High/Low) ehhez igazítja.

---

## 2. Általános Architektúra és Adatáramlás
A rendszer jelenleg négy fő logikai rétegre oszlik, amelyek egy fájlban (HTML) találhatók. A TypeScript refaktorálás során ezeket szigorúan el kell különíteni.

1. **UI Layer (HTML/CSS):** Glassmorphism stílusú, reszponzív (min-width/min-height limitált) felület. Kezeli a fájlfeltöltést, a lejátszásvezérlést, és a valós idejű műszerfal (Dashboard) frissítését.
2. **Audio Engine (Native Web Audio API):** Felelős a hangfájlok dekódolásáért (`AudioContext.decodeAudioData`), a pufferelésért és a mikroszekundum-pontos lejátszásért (`AudioBufferSourceNode`).
3. **Analysis Engine (Web Worker):** A főszáltól (Main Thread) függetlenül futó algoritmus. A fájl betöltésekor a teljes hanganyagot végigelemzi. Szűrőket (IIR) alkalmaz, fluxust számol, blokkokra bontja a dalt, és egy kész "Térképet" küld vissza a rajzolónak.
4. **Render Engine (p5.js Canvas):** 60 FPS sebességgel futó vizuális mag. A kapott idővonal-térkép és a Web Audio API aktuális ideje (`currentTime`) alapján szinkronizálja és mozgatja a részecskéket (Particles), rajzolja a Plexus hálót és a lökéshullámokat (Shockwaves).

---

## 3. Részletes Feature Dokumentáció (Functional Specs)

### 3.1. Offline Globális Analízis (Zéró-CPU Lejátszás)
A zene betöltésekor a rendszer nem azonnal indítja a lejátszást. A nyers PCM hangadatokat átadja egy Web Workernek. A Worker ezredmásodperc pontossággal kiszámolja az egész dal energiaszintjeit, és egy JSON-szerű adatszerkezetet ad vissza. Lejátszáskor a főszál *nem végez hang-matematikát*, csak a lejátszó idejéhez (Playhead) tartozó előre kiszámolt indexet olvassa ki a tömbből ($O(1)$ komplexitás).

### 3.2. Makro-Dinamikai Állapotgép (Auto-Routing)
A zene dinamikusan, az analizált BPM alapján ütem-blokkokra (pl. 16 beat) van osztva. Minden blokk kap egy relatív energia-értéket (`energyRatio` 0.0 és 1.0 között) a dal globális minimumához és maximumához képest.
*   **HIGH Állapot:** Ha az energia $\ge$ 45%. A vizuál 100%-os érzékenységgel működik, minden dobot megmutat.
*   **LOW Állapot:** Ha az energia < 45%. A vizuál elfojtja magát. A háttér sötétebb (zöldes/sárgás helyett lila), a kisebb zörejeket ignorálja (Büntetés / Penalty kalkuláció).
*   **Real-time Override:** Ha a blokk HIGH-ban van, de az élő energia hirtelen leesik (Drop / Kiállás), vagy túl magasra megy (Overload / Torzítás), a rendszer azonnal lekezeli ezt az állapotot (`LOW_DROP` / `LOW_OVERLOAD`), megelőzve a fals felvillanásokat.

### 3.3. Multi-Band Dob Detektor (Drum Signature)
A motor három frekvenciasávra (Bass, Mid, High) bontja a hangot. A sávok energiájának hirtelen megugrásából (Spectral Flux) típusokba sorolja az ütéseket:
*   **Típus 1 (Kick):** Csak mély, kevés magas. Hatalmas kék lökéshullám, a poligonháló megrezzen.
*   **Típus 2 (Snare/Drop):** Mély, közép és magas is van jelen. Gyors, vastag fehér/magenta hullám, a poligonok szikrázóan vakítóra villannak.
*   **Típus 3 (Hi-Hat):** Csak magas/közép. Apró, vékony zöldes hullám, nincs poligon-villanás.

### 3.4. BPM Detektálás és Kijelző
A Worker az ütések közötti távolságokból (ms) kiszámolja a lehetséges BPM-eket, majd egy hisztogram segítségével megkeresi a leggyakoribb értéket (70 és 180 BPM között).

---

## 4. Technikai és Algoritmikus Specifikációk

### 4.1. DSP (Digital Signal Processing) a Workerben
A sávokra bontáshoz egypólusú IIR (Infinite Impulse Response) aluláteresztő szűrőket használ a kód:
```javascript
let a_bass = Math.exp(-2 * Math.PI * 150 / sampleRate);  // 150 Hz
let a_high = Math.exp(-2 * Math.PI * 4000 / sampleRate); // 4000 Hz
```
Ebből generálódik a `Bass (0-150Hz)`, `Mid (150-4000Hz)` és `High (4000Hz+)` sáv.
A *Spectral Flux* kiszámítása: `Math.max(0, currentRMS - previousRMS)` sávonként.

### 4.2. A Plexus Hálózat optimalizálása ($O(N^2)$)
A hálózat kirajzolása köbös ($O(N^3)$) művelet lenne, ami lehetetlen 60 FPS mellett 100 részecskénél.
**Optimalizációs lépések:**
1. Gyökvonás elkerülése: `distSq = dx*dx + dy*dy`. A `Math.sqrt()` csak akkor fut le, ha a pontok bizonyítottan a küszöbön belül vannak.
2. Kapcsolati limit: `if (linesDrawn > 6) break;`. Egy pontból maximum 6 vonal indulhat.
3. Poligon limit: `if (polysDrawn < 2)`. Egy pont maximum 2 háromszögnek lehet a része.
4. Natív renderelés: `beginShape()` helyett a p5.js `triangle()` függvényének használata.

### 4.3. Időszinkronizáció (Timekeeping)
Mivel az `AudioBufferSourceNode` nem ad vissza `currentTime` tulajdonságot, az aktuális lejátszási időt manuálisan kell számolni a hardver órájához képest:
`playbackTime = playStartOffset + (audioContext.currentTime - playStartContextTime)`

---

## 5. ADR (Architectural Decision Records)

Az alábbi döntések a prototípus evolúciója során születtek. Ezeket a TypeScript átírás során **tilos megváltoztatni** anélkül, hogy a következményeket (pl. memóriaszivárgás, CPU túlterhelés) megvizsgálnánk.

### ADR-001: Natív Web Audio API vs. p5.sound lejátszás
*   **Kontextus:** Eredetileg a `p5.sound` `loadSound()` és `play()` metódusait használtuk.
*   **Döntés:** Elvetve. A p5.sound memóriaszivárgást okozott a Play/Pause gyors váltogatásakor, és nehezen viselte a csúszkával (Seek) történő gyors tekerést.
*   **Jelenlegi állapot:** Közvetlen `AudioContext` és `AudioBufferSourceNode` használata. Újraindításkor a régi node eldobódik, új jön létre.

### ADR-002: Real-time FFT vs. Pre-computed (Offline) Analízis
*   **Kontextus:** A vizuál és a dob-detektor valós időben, a `draw()` ciklusban próbálta kitalálni, hogy mikor van drop.
*   **Döntés:** Teljes offline analízis a Web Workerben.
*   **Indoklás:** Valós időben a rendszer nem ismeri a dal jövőjét, így nem tud dinamikai arányokat (relatív hangerőt) számolni. Egy halk introban lévő dobot dropnak érzékelt. A Worker előre megismeri a dal "legmagasabb hegyeit és legmélyebb völgyeit", így tökéletes küszöbértékeket állít be. Lejátszáskor a CPU terhelés drasztikusan csökkent.

### ADR-003: Poligonok Alfa-összeadódása (Whiteout / Overdraw)
*   **Kontextus:** A sok részecske által generált egymást átfedő háromszögek átlátszósága (opacity) összeadódott, ami miatt a képernyő vakító fehér folttá vált.
*   **Döntés:** Szigorú, hardkódolt alap Alpha korlátozás (max 50), melyet csak a pergődob/drop felvillanása léphet át tranzikens módon.
*   **Indoklás:** A háromszögek alapértelmezett maximális alfa értéke még a legnagyobb ütésnél (Drop) sem haladhatja meg az 50-et. Tranzikens, ritkán előforduló snare/drop események hirtelen megdobhatják az alfát 200 felé, azonban ez a következő keretekben rapid módon elhalványul. Ezzel a Plexus háló alapállapotban opálos marad és nem ég ki a retina.

---

## 6. TypeScript Refaktorálási Útmutató (Roadmap)

A jövőbeli fejlesztéshez (Vite + TypeScript + OOP) az alábbi fájl- és osztálystruktúra kialakítása javasolt.

### 6.1. Javasolt Könyvtárszerkezet
```text
src/
├── main.ts                 # Belépési pont, p5 instance inicializálása
├── audio/
│   ├── AudioEngine.ts      # Web Audio API wrapper (Play, Pause, Seek, Timekeeping)
│   ├── AudioWorker.ts      # A Web Worker kódja (exportálandó string/blobként vagy Vite worker importként)
│   └── Types.ts            # Audio interface-ek (BeatEvent, FrameData, BlockData)
├── visuals/
│   ├── PlexusEngine.ts     # A fő rajzoló menedzser (tartalmazza a részecskéket és a hálót)
│   ├── Particle.ts         # A részecske osztály
│   ├── Shockwave.ts        # A lökéshullám osztály
│   └── ColorPalettes.ts    # HIGH és LOW állapotok színkódjai
├── state/
│   └── Store.ts            # Reakítv állapotkezelő (Zustand vagy egyedi PubSub a UI és a Canvas között)
└── ui/
    └── Dashboard.ts        # DOM manipuláció, csúszkák, gombok eseménykezelői
```

### 6.2. Kulcsfontosságú TypeScript Interface-ek (Tervezet)

```typescript
// Az offline analízisből visszatérő egyetlen dobütés
export interface BeatEvent {
    time: number;          // Lejátszási idő másodpercben
    intensity: number;     // 0.0 - 1.0 (Lokális hangerő)
    type: 1 | 2 | 3;       // 1: Kick, 2: Snare/Drop, 3: Hi-hat
}

// Egy 2.5 másodperces dinamikai blokk
export interface AudioBlock {
    startTime: number;
    endTime: number;
    energyRatio: number;   // 0.0 - 1.0 (Viszonyítva a dal globális csúcsához)
}

// Egy 1024-es ablakmérethez (hopSize) tartozó simított adat és állapot
export interface AudioFrame {
    e: number; // Teljes energia
    b: number; // Basszus
    m: number; // Közép
    t: number; // Magas
    state: 'HIGH' | 'LOW' | 'LOW_DROP' | 'LOW_OVERLOAD';
    eRatio: number;
}
```

### 6.3. Technikai Megjegyzések a Portoláshoz
* A p5.js globális módban van a jelenlegi kódban. A TypeScript-es projektben az **Instance Mode** (`new p5((p) => { ... })`) használata kötelező a globális névtér szennyezésének elkerülése végett.
* A Web Worker kódját Vite (vagy Webpack) alatt érdemes egy külön `.worker.ts` fájlba tenni, és a bundler beépített Worker importálóját használni (pl. `import MyWorker from './audio.worker.ts?worker'`), a jelenlegi Blob-os hack helyett.
* A DOM (UI) manipuláció és a p5.js (Canvas) közötti kommunikációt egy Eseménybuszon (Event Bus) vagy Állapotkezelőn keresztül kell megoldani, hogy ne hivatkozzanak egymásra direkten.

---

## 7. Current TypeScript ADR Addendum

### ADR-004: Full-track visual-music analysis as an append-only worker contract
*   **Context:** Beat events and macro-dynamic frames were not enough to represent melody-like, vocal-like, fx-like, or recurring temporal content.
*   **Decision:** The worker output now includes `trackAnalysis` with section structure, per-frame visual features, visual cue events, significant moments, and recurring `MusicPattern` entries. This is added to the existing payload instead of replacing `frames` or `events`.
*   **Rationale:** Future effects can opt into richer musical context while the original Plexus effect and playback synchronization continue to read the legacy frame/event arrays.

### ADR-005: Selectable visual modes
*   **Context:** The original Plexus network remains useful, but the new pattern-analysis output needs a more expressive effect that reacts to repeated temporal shapes.
*   **Decision:** The app exposes a `classic` mode and a `temporal` mode in separate effect files. `classic` preserves the existing Plexus network. `temporal` reuses the same particle and shockwave primitives, but treats track-analysis output as continuous modulation of polygon color, movement, density, connection sensitivity, background tone, and central mechanism rings for beat, melody, vocal, fx, and pattern resonance.
*   **Rationale:** Keeping both modes makes the new behavior testable and reversible without deleting the established visual language. Pattern analysis exists to make the visual response more sensitive and sophisticated, not to turn musical sections into explicit bar-aligned labels.
