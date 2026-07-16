# Plexus Engine — Cosmic Wormhole MVP feltárási jelentés

---

## 1. Executive summary

1. **A wormhole geometriai magja architekturálisan kész és kiváló minőségű.** A route-modell (kettős, horizontális+vertikális steering-integrátor, kamera-lokális bázisváltásos projekció, roll-mentes frame) a dokumentált szerződés szerint működik, és 237 célzott teszt védi — mind zöld.
2. **Determinisztikusság: erős.** Travel distance fix-hop prefix-LUT-ból (`WormholeTransport`), authored speed analitikus smoothstep-timeline-ból, seek `resetConverged` tiszta O(1) függvényből áll elő; export/live parity és 30/60/120 FPS invariancia tesztelt (`wormhole-long-run.test.mjs`).
3. **Fő MVP-blokkoló #1: a default identity a `classic`**, nem a wormhole (`store.ts:102`, `main.ts:12` opciósorrend). Egyetlen kanonikus alapérték-váltással + select-szinkronnal megoldható.
4. **Fő MVP-blokkoló #2 (adat, nem kód): az iránydiverzitás hiányzik.** A 10 presetből 6 pontosan egyenes, csak a drift kanyarodik balra (−0.16), csak a galaxy diagonális (+0.22/+0.12); **lefelé ívelő és tisztán vertikális irány egyáltalán nincs** authorálva, pedig a motor (Task 08) teljes értékűen támogatja.
5. **P1 hiba: a `wormholePathBendVertical` preset-szivárgás.** Csak a `vos-wh-galaxy.json` authorálja; a preset-alkalmazás merge-szemantikájú (`normalizeVisualTuningConfig`), így egy galaxy-aktiválás után a 0.12 vertikális ív **örökre ott ragad** minden későbbi „pontosan egyenes" role alatt is.
6. **P1: a skybox réteg alapból ki van kapcsolva** (`featureFlags.wormholeSkybox: false`), miközben a „Skybox opacity" csúszka él a UI-ban és a presetek háttér-master vocabulary-je számol vele — halott kontroll + éles üzemben validálatlan réteg.
7. **Erős következtetés: a skybox lateral-eltolása hosszú, tartós kanyarban korlátlanul nő** (`drawSkybox` a korlátos `routePan` mellett az abszolút `positionX`-et is beszorozza), ami a réteg engedélyezésekor több perces hero-turn alatt lecsúsztatná a platét — ma a kikapcsolt flag rejti.
8. **A lassú evolúciós (LFO) réteg félig már létezik, de nincs bekötve**: a `WormholeMotionProfile` `breathing`/`depthEvolution`/`densityEvolution`/`perspectiveEvolution` mezőit minden frame-ben kiszámolja (bar-fázisból, seek-biztosan), de a `CosmicWormholeIdentity` soha nem olvassa őket.
9. **Dokumentációs drift**: a `wormhole-travel-and-path-bend-plan.md` „period-4 szegmens-mintás" route-integrációt és `FOREGROUND_ROUTE_DRIFT_WEIGHT = 1` („fizikailag korrekt") modellt ír le; a kód analitikus konstans-görbületű steering-mezőt és **explicit `ROUTE_TURN_VISUAL_GAIN = 4` stilizált drift-erősítést** használ.
10. **A tesztkészlet szokatlanul jó**: nem csak matematikai invariánsokat, hanem terméknyelvű élményt véd (látható-csillag-elmozdulási küszöbök, vanishing-point lens-lokalitás, 30 perces hosszú futás, byte-determinista export). A hiányok: kumulatív preset-szekvencia állapot (a 5. pont szivárgása), default-boot konzisztencia, LFO-determinizmus (jövőbeli).
11. **Performancia: a hot-path allokáció-tudatos, de nem nulla.** `projectWormholeTubePoint` + `wormholeTransitionEnergy` grainenként 2-2 friss objektumot ad vissza (~1440 objektum/frame); a csillagmező 1800 star × 4 route-minta/frame; a draw-call költséget a starfield (1800 line) és — ha bekapcsolják — a skybox (9000–18000 line) dominálja Canvas2D-n.
12. **A H/V tengely kezelése aszimmetrikus**: a horizontális kanyar a `localZ`-t is modulálja (tangent-vetítés), a vertikális csak drift-tag a `localY`-on. Authorált tartományban (≤0.22) tesztelten diagonálisnak olvasható; ±1 szélsőértéken mérésre váró kérdés.
13. **A preset→futás lánc két, szándékosan eltérő simítórendszert használ**: speed = anchored analitikus timeline (monotonitás!), minden más = `applyTuningMorph` song-time glide + a bend esetén távolság-domain steering-ease. Ez dokumentált, konzisztens, nem javítandó.
14. **Nincs szükség szerkezeti újraírásra.** A cél célzott adat-retuninggal (irány-mátrix, vertikális kulcs authorálása), egy kis tiszta evolúciós modul bekötésével, default-boot váltással és doksi-frissítéssel elérhető.
15. **A legnagyobb maradék kockázat vizuális, nem architekturális**: a `ROUTE_TURN_VISUAL_GAIN = 4` és a parallax-arányok cinematic helyessége csak manuális design-review-val validálható; automatikus teszt ezt nem bizonyítja.

---

## 2. Repository consistency scorecard

| Dimenzió | Pont | Bizonyíték |
|---|---|---|
| Governance-konzisztencia | **4/5** | `AGENTS.md` ↔ kód összhang jó (single-writer, worker, realtime szabályok betartva); levonás: `wormhole-travel-and-path-bend-plan.md` route-contract drift (ld. F4). |
| Moduláris felépítés | **4/5** | Wormhole-almodulok tisztán vágottak (GrainField=pure math, Timeline=transport, CosmicSync=policy, Emission/Depth=pure). Levonás: `DashboardUI.ts` 132 KB, `CosmicWormholeIdentity.ts` 69 KB monolitok. |
| State ownership | **5/5** | `requestVisualModeChange` egyetlen writer (`visualModeTransition.ts:14`); identity-owned tuning kulcsok registry-vel kikényszerítve (`identityTuningRegistry.ts:32` duplaowner-hibát dob); resolver/FSM boundary ADR-003 szerint. |
| Timing determinisztikusság | **5/5** | Kanonikus óra (`canonicalWormholeTime`), fix-hop LUT, analitikus speed-integrál, seek-konvergens reset; FPS-invariancia és byte-determinista export tesztelve (`wormhole-long-run`, `wormhole-determinism`). |
| Renderer boundary | **5/5** | Identity csak `VisualRendererBackend`-et kap; kompozitor renderer-privát (ADR-006); `renderer-boundary.test.mjs` + `contracts.test.mjs` zöld. |
| Preset-rendszer | **3/5** | Roles/targetMap/vocabulary teljes és tesztelt; levonás: vertikális bend-kulcs szivárgás (F2), iránydiverzitás-hiány (F8), skybox-master halott flag mögött (F3). |
| Tesztlefedettség | **4/5** | 19 wormhole tesztfájl, élmény-szintű invariánsokkal; hiány: kumulatív preset-szekvencia állapot, default-boot, skybox hosszú futás. |
| Performance readiness | **3/5** | Allokáció-tudatos scratch-frame minta, O(1) route-sampling tesztelve; de nincs frame-time budget, nincs valós eszközös mérés, hot-path objektum-allokációk (F6) és skybox draw-call költség méretlen. |
| Wormhole vizuális koherencia | **4/5** | Fg/bg irány-egyezés, kör keresztmetszet, lens-lokális vanishing point numerikusan bizonyított; levonás: gain=4 stilizáció cinematic hatása validálatlan, vertikális tengely gyengébb modellje. |
| MVP-érettség | **3/5** | Motor kész; blokkolók adat/boot-szintűek: default mode, irány-mátrix, vertikális kulcs, skybox-döntés, manuális vizuális gate. |

---

## 3. Aktuális wormhole architektúra

### Moduldiagram (tényleges import-irányokkal)

```
                         State (store.ts)
                        ▲  │ (read: tuning, idő, analízis)
   DashboardUI ─────────┘  ▼
   (preset apply,      CosmicWormholeIdentity.ts  ◄── VisualIdentity interfész
    mode change,          │        │       │
    automation trigger)   │        │       ├──► WormholeMotionProfile (pure, /frame)
                          │        │       ├──► WormholeTimeline (Transport LUT,
   PlexusRenderer.draw()  │        │       │      AuthoredSpeedTimeline, kick/LOW_DROP @time)
     │ applyTuningMorph   │        │       ├──► WormholeDepth (pure fázis-tér)
     │ IdentityTransition │        │       ├──► WormholeEmission (pure gain)
     ▼ Controller ────────┘        │       ├──► WormholeCosmicSync (pure per-layer policy)
   P5RenderTargetCompositor        │       └──► WormholeDiagnostics (dev-flag mögött)
                                   ▼
                        WormholeGrainField.ts
                        (pure route math: sampleWormholeRouteFrame,
                         WormholeRouteState steering, projectWormholeTubePoint,
                         combinedWormholePathBend, envelope-ök)
```

### Adatfolyam (a kért lánc konkrét megvalósulása)

```
preset JSON / automation pont / élő csúszka
  → DashboardUI.applyPerformancePreset()
      • normalizeVisualTuningConfig: MERGE a State.targetTuning fölé (nem authorált kulcs megmarad!)
      • bendMirror: csak wormholePathBend előjelét fordítja (DashboardUI.ts:2044)
      • wormholeMorphDurationFloor(Δspeed, Δbend) padló, cap 4 s (morphFloor.ts)
      • applyAutomationMorphAuthority: intensity→audioSensitivity, morph idő/görbe
  → State.targetTuning
  → applyTuningMorph() minden frame-ben (PlexusRenderer.ts:130)
      • song-time delta, FPS-invariáns exponenciális kompozíció
      • tuningMorphDeltaSec: seek/óraváltás → 0 delta (morph befagy, nem ugrik)
  → State.visualTuning (élő, glide-olt)
  → CosmicWormholeIdentity.draw():
      • travelDistance = Transport.distanceAt(t) + AuthoredSpeedTimeline.offsetAt(t)
        ⚠ a speed a State.targetTuning.wormholeSpeed-ből jön (anchored smoothstep), NEM a glide-olt visualTuning-ból
      • bendH/V = combinedWormholePathBend(visualTuning.wormholePathBend, …Vertical)  [ÉLŐ]
      • routePath.advance(camZ, bendH); routePathVertical.advance(camZ, bendV)
        → distance-domain curvature ease (980 ill. ellenkormányzáskor 180 egység)
      • grain release-generáció-váltáskor: snapshotGrainGeometry (radius, depth, warp,
        curve, ring, coherence) + zenei pillanatfelvétel (kick, bass, density, jitter, emission)
      • projectWormholeTubePoint(routeNow, baseRouteNow, …, ROUTE_TURN_VISUAL_GAIN=4, verticalDrift)
      • starfield/galaxy: sampleSmoothedLookahead + smoothedTurnIntensity(600 unit ablak)
      • skybox (flag mögött): tanh-szaturált heading-pan + abszolút positionX-tag
  → backend.line()/radialGlow() (P5RendererBackend, state-cache-elt)
```

### State ownership, időalapok, snapshot/live

| State | Tulajdonos | Időalap | Snapshot / live |
|---|---|---|---|
| `State.visualMode` | `requestVisualModeChange` (egyetlen writer) | — | logikailag azonnali; prezentáció crossfade |
| `State.targetTuning` | preset/automation/semantic resolver (dokumentált kézátadás) | — | cél |
| `State.visualTuning` | `applyTuningMorph` (renderer frame) | song/export time | élő glide |
| travel distance | `WormholeTransport` + `AuthoredSpeedTimeline` (identity-privát) | analízis-hop + song-time | tiszta függvény |
| route heading/curvature (H és V) | `IntegratedWormholeRoute` (identity-privát, 2 példány) | **távolság-domain** | integrátor + 360-elemű history ring |
| grain release-mezők | grain (generation-index alapján, abszolút) | travel distance | release-snapshot |
| bg turn-mérték | `smoothedTurnIntensity` (600 unit ablak) | távolság | származtatott |
| `travelPhase` | identity (draw + syncPosition) | travel distance | származtatott |
| crossfade rekord | `visualModeTransition.ts` | song/export time | generáció-számlált |

Seek: `syncPosition` → `resetConverged` (tiszta (distance, bend) függvény, nem heading-0 baseline) + minden grain release-állapotának törlése a helyes abszolút generáció-indexszel. Export: azonos kódút export-órával; byte-determinizmus tesztelt. Presetváltás: glide + morph-floor + steering-ease; kontinuitás-harness tesztek (`wormhole-preset-switch-continuity`) küszöbökkel védik.

### Foreground–background kapcsolat

Mindkettő **ugyanabból a két integrált route-ból** származik. Grain-geometria élő route-frame-eket olvas; a háttér parallax-amplitúdója a távolság-simított turn-mértéket — dokumentáltan azért, hogy egy egy frame-es curvature-változás ne váljon háttér-pozícióugrássá. Rétegarányok egyetlen helyről (`WormholeCosmicSync`): star 0.4, galaxy 0.05, skybox 0.035 (cap 6). Nincs külön háttérkamera, nincs egész-vászon transzform (forrás-szintű regressziós guard tiltja a heading-shear-t).

---

## 4. Megállapítások prioritási sorrendben

---

**[P0] F1 — A default visual identity a `classic`, nem a `cosmic-wormhole`**

Bizonyíték:
- `src/state/store.ts:102` — `visualMode: 'classic' as VisualMode`
- `src/main.ts:12-20` — a `#visual-mode` select opciólistája `classic`-kal kezdődik, nincs `selected` attribútum → a böngésző az első opciót választja
- `tests/contracts.test.mjs:407` — a `'classic'` defaultot forrás-regexszel pinneli
- `default.json` nem tartalmaz `visualMode`-ot; boot-kor preset nem töltődik be automatikusan (a `TuningController.updatePresetList` csak a select értékét állítja, `loadPreset` nem fut)

Gyökérok: a default egyetlen helyen (store literál) van definiálva, és az történetileg `classic`.

Felhasználói hatás: az MVP-demó nem a hero-effekttel indul; a felhasználónak kézzel kell váltania.

Architekturális hatás: minimális — a default útvonala tiszta, egyetlen kanonikus pont.

Performanciahatás: nincs.

Javasolt minimális megoldási irány: ld. 8. fejezet (store-default + select-init-szinkron + contracts-teszt frissítés).

Érintett modulok: `store.ts`, `main.ts` (opcionálisan), `DashboardUI.ts` (init-szinkron), `tests/contracts.test.mjs`.

Szükséges validáció: új default-konzisztencia teszt (state = select = style pack); manuális boot-smoke.

---

**[P1] F2 — `wormholePathBendVertical` preset-szivárgás: a galaxy után minden „egyenes" role diagonális marad**

Bizonyíték:
- A 10 `vos-wh-*.json` közül **csak** a `vos-wh-galaxy.json` authorálja a `wormholePathBendVertical: 0.12` kulcsot
- `src/config/visualTuning.ts:233-259` — `normalizeVisualTuningConfig` a jelenlegi `targetTuning` fölé merge-öl: nem authorált kulcs a korábbi értéken marad
- `src/ui/DashboardUI.ts:2041` — `Object.assign(State.targetTuning, normalizeVisualTuningConfig(sourcePayload, State.targetTuning))`
- `documents/features/wormhole-clip-profile.md:98` — „Every role explicitly authors `wormholePathBend`" — csak a horizontálisra igaz

Gyökérok: a Task 08 vertikális tengely bevezetésekor a preset-család nem kapta meg a kulcsot minden role-ban; a merge-szemantika miatt a hiány nem nulla, hanem „örökli az előzőt".

Felhasználói hatás: egy `wormhole.reveal-galaxy` aktiválás után a `straight-drive` már nem pontosan egyenes (0.12 felfelé ív), és ez a teljes hátralévő playback alatt megmarad — a „drive az egzakt egyenes baseline" terméknyelvű kontraktus sérül.

Architekturális hatás: a klip-profil role-kontraszt garanciája (tesztelt kontraktus) futásidőben nem áll fenn szekvenciák alatt.

Performanciahatás: nincs.

Javasolt minimális megoldási irány: adat-fix — mind a 10 presetben explicit `wormholePathBendVertical` (9-ben `0`, galaxyben `0.12`), plusz a klip-profil teszt „explicit role keys" listájának bővítése ezzel a kulccsal.

Érintett modulok: `public/visual-tuning-presets/vos-wh-*.json`, `tests/wormhole-clip-profile.test.mjs`, `documents/features/wormhole-clip-profile.md`.

Szükséges validáció: új kumulatív szekvencia-teszt: galaxy → drive után a `targetTuning.wormholePathBendVertical === 0`.

---

**[P1] F3 — A skybox réteg default-kikapcsolt, miközben a UI és a preset-doktrína élőként kezeli**

Bizonyíték:
- `src/config/featureFlags.ts:4` — `wormholeSkybox: false`
- `src/config/visualTuning.ts:178` — „Skybox opacity" csúszka feltétel nélkül renderelődik a Wormhole csoportban
- `documents/features/wormhole-clip-profile.md` — a `wormholeSkybox`-ot user-global háttér-masterként dokumentálja

Gyökérok: a réteg fejlesztés alatt flag mögé került, a flag sosem fordult át.

Felhasználói hatás: halott csúszka (0→1 állítása semmit nem csinál); a „csillag + galaxy + skybox" három rétegű kozmoszból kettő látszik.

Architekturális hatás: a skybox-út (pan, forward cue, trail) tesztelve van izoláltan, de éles kompozícióban és hosszú futásban validálatlan.

Performanciahatás: bekapcsolása +9000–18000 `line()` hívás/frame — mérés nélkül nem kapcsolható be vakon.

Javasolt minimális megoldási irány: termékdöntés (11. fejezet); ha marad a réteg: flag → `true` + F7 javítása + perf-mérés; ha nem: a csúszka flag-hez kötése (a Hero-csoport mintájára, `visualTuning.ts:225`).

Érintett modulok: `featureFlags.ts`, `visualTuning.ts`, `CosmicWormholeIdentity.ts`.

Szükséges validáció: skybox-os hosszú futás (F7 repró), FPS-mérés 1080p/4K + magas DPR mellett.

---

**[P1] F4 — Dokumentációs drift: a route-contract leírás elavult modellt rögzít**

Bizonyíték:
- `documents/audits/wormhole-travel-and-path-bend-plan.md:99-102` — „turn sign pattern has period 4 in segment index and heading returns to exactly zero after every complete period"; a kódban (`WormholeGrainField.ts:196-212, 690-697`) nincs periodikus mintázat: folytonos konstans-görbületű mező + runtime steering-integrátor korlátozott cél-headinggel
- uo. `:64` — „scaled by FOREGROUND_ROUTE_DRIFT_WEIGHT (1, undamped)… full weight is both the physically correct model"; a kódban ez a konstans nem létezik, helyette `ROUTE_TURN_VISUAL_GAIN = 4` (`WormholeGrainField.ts:76`) — a fizikai modell 4× stilizált erősítése minden rétegen

Gyökérok: a route-modell két nagy revízión ment át (period-4 → analitikus mező → steering-integrátor + vizuális gain), a plan-dokumentum csak részben követte.

Felhasználói hatás: közvetlen nincs; de a doksi alapján dolgozó következő agent hibás modellből indulna ki, és a „gain=1 fizikailag korrekt" állítás alapján a gain=4-et regressziónak minősíthetné.

Architekturális hatás: az `AGENTS.md` szerint a dokumentáció a valós viselkedést írja le — ez itt sérül.

Javasolt minimális megoldási irány: a plan-md „Route Contract" és „Projection" szakaszának frissítése a steering-integrátorra és a vizuális gain explicit dokumentálására (miért 4, mit véd — a tesztnév már utal rá: „direct visual turn gain keeps first bend continuous").

Érintett modulok: csak `documents/audits/wormhole-travel-and-path-bend-plan.md`.

Szükséges validáció: governance-only change: hivatkozás-ellenőrzés.

---

**[P1] F5 — Az evolúciós (LFO) kimenetek kiszámítódnak, de sehol nem hasznosulnak**

Bizonyíték:
- `src/visuals/WormholeMotionProfile.ts:101-118` — `breathing`, `depthEvolution`, `densityEvolution`, `perspectiveEvolution` bar-fázisból számítva
- Grep a teljes `src/`-en: egyetlen consumer sincs; a `CosmicWormholeIdentity.draw()` csak `kickJitter`/`bassWarp`/`densityFill`-t olvassa (a `travelSpeed`, `depthPulse`, `perspectiveCompression` szintén nem olvasott — utóbbi kettő szándékosan, kommentelve, `CosmicWormholeIdentity.ts:444-449`)
- `tests/wormhole-determinism.test.mjs` — „slow evolution is pure and stays within authored bounds" a *függvényt* teszteli, nem a hatását

Gyökérok: a „no whole-field breathing" regresszió-javításkor a geometriai fogyasztókat kivették, az evolúciós csatornát pedig előkészítették, de sosem kötötték be.

Felhasználói hatás: a tunnel hosszú állóképeken statikus/gépies — pont a kért „organikus, cinematic" evolúció hiányzik.

Architekturális hatás: a 9. fejezet LFO-terve erre a meglévő, seek-biztos, tesztelt fázisforrásra építhet — nem kell új framework.

Performanciahatás: elhanyagolható holt számítás (4 `Math.sin`/frame + `wormholeMusicalPhase` O(bars) lineáris keresése — ez utóbbi trivialitás, de indexelhető).

Javasolt minimális megoldási irány: 9. fejezet — a meglévő kimenetek release-snapshot-időben történő fogyasztása (geometria) + korlátos élő anyag-moduláció.

Érintett modulok: `WormholeMotionProfile.ts`, `CosmicWormholeIdentity.ts` (snapshotGrainGeometry + anyagút).

Szükséges validáció: LFO-determinizmus, seek-parity, FPS-invariancia, „no vanishing-point jump" tesztek (14. pont).

---

**[P1] F6 — Skybox lateral-tag: korlátlan növekedés tartós kanyarban (látens, flag-off mögött)**

Bizonyíték:
- `CosmicWormholeIdentity.ts:1018-1023` — `sx = cx + star.x*radius − routePan + baseRoute.positionX * worldScale * 0.002 * routeTurnVisualGain`; a `routePan` tanh-szaturált (korlátos), de a `positionX` konvergált kanyarban lineárisan nő a távolsággal (sin(heading)·Δdistance)
- Nagyságrend: spiral (bend 0.72 → heading ≈ 0.63 rad) mellett ≈ 0.42 px/world-unit × 142 unit/s ≈ **~60 px/s folyamatos plate-csúszás**, tile-wrap nélkül

Gyökérok: a star/galaxy rétegek *relatív* drift-et használnak (look-ahead − kamera pozíció, korlátos), a skybox egyedül abszolút `positionX`-et.

Felhasználói hatás: ma semmi (flag off). Bekapcsolás után több perces hero-turnnál a skybox kiürül a képből.

Javasolt minimális megoldási irány: a skybox lateral-tagját is relatív (kamera-környéki különbségi) driftre állítani, vagy a taghoz szaturációt adni — F3 döntésével együtt kezelendő.

Érintett modulok: `CosmicWormholeIdentity.ts` (`drawSkybox`).

Szükséges validáció: numerikus repró (hosszú konvergált kanyar, skybox-pozíció korlátosság-assert), majd a meglévő angular-agreement tesztek újrafuttatása.

---

**[P1] F7 — Preset-irány-mátrix: hiányzó vertikális és lefelé irányok (adat-szintű)**

Bizonyíték: a 6. fejezet mátrixa — 6/10 preset egzakt egyenes; 1 bal (drift), 2 jobb (spiral, overdrive — mirrorable), 1 diagonális-fel (galaxy); **0 lefelé, 0 tisztán vertikális**.

Gyökérok: a Task 11 irány-kiosztás a horizontális tengelyre és egyetlen diagonálisra koncentrált; a rendszer kifejezőereje (signed H+V, mirrorable, hypot-normalizálás) ennél többre kész.

Felhasználói hatás: a klip-dramaturgia irányélménye szegényes; a „fel/le/diagonális irányok megkülönböztethetők" MVP-kritérium (13.2) nem teljesíthető.

Javasolt minimális megoldási irány: kizárólag preset-retuning a 6. fejezet javasolt mátrixa szerint (kódváltozás nélkül), a klip-profil doksi „exact straight-axis roles" listájának egyidejű pontosításával.

Érintett modulok: `vos-wh-*.json`, `wormhole-clip-profile.md`, `tests/wormhole-clip-profile.test.mjs` (Task11 assert bővítés).

Szükséges validáció: preset-differentiation és switch-continuity tesztek újrafuttatása az új értékekkel; manuális irány-mátrix (14.4).

---

**[P2] F8 — Hot-path objektum-allokációk a grain-loopban**

Bizonyíték:
- `WormholeGrainField.ts:495-524` — `projectWormholeTubePoint` friss `{screenX, screenY}`-t ad vissza; grainenként 2 hívás/frame (now+prev) → 720 objektum/frame
- `WormholeGrainField.ts:639-669` — `wormholeTransitionEnergy` szintén friss objektum, a nulla-amplitúdós korai ágban is; 2 hívás/grain/frame → +720/frame
- Kontraszt: a route-frame-ek scratch-objektumokba mintáznak (out-param), a színek `hueToRgbInto`-val — a minta ismert és követett, csak ez a két függvény tér el

Gyökérok: a pure-function tesztelhetőség kedvéért objektum-visszatérés; out-param opció nincs.

Felhasználói hatás: ~86k rövid életű objektum/s @60fps → minor-GC nyomás; jitter-kockázat hosszú szetteknél, mérés nélkül nem számszerűsíthető.

Javasolt minimális megoldási irány: opcionális `out` paraméter (a `sampleWormholeRoute` mintájára), a teszt-API változatlanul hagyásával; transition-energy nulla-ágban megosztott fagyasztott konstans.

Érintett modulok: `WormholeGrainField.ts`, `CosmicWormholeIdentity.ts`.

Szükséges validáció: allokációs regresszió-teszt bővítése (a meglévő „do not allocate path or grain objects" mintájára); heap-snapshot előtte/utána.

---

**[P2] F9 — H/V projekciós aszimmetria a bend-tengelyek között**

Bizonyíték:
- `projectWormholeTubePoint`: `localX` a bázisváltott radiális + drift; `localZ` a horizontális tangent-vetületből; `localY = radialY + verticalDrift * weight` — a vertikális route headingje a mélység-tengelyt nem érinti
- Tesztelt kompenzáció: „equal-magnitude diagonal bend reads as genuinely diagonal" (átlagos háttér-drift szinten)

Gyökérok: tudatos tervezési döntés (Task 08 komment: „second orthogonal drift term, no roll") — a teljes 3D frame elkerülése a roll/singularitás-mentesség érdekében.

Felhasználói hatás: authorált tartományban (|V| ≤ 0.12) nem kimutatott; csúszka-szélsőértéken (±1) a vertikális kanyar „laposabbnak" olvasódhat, mint az azonos erejű horizontális — **mérésre váró kérdés**.

Javasolt minimális megoldási irány: MVP-hez semmi (a preset-tartomány biztonságos); UI-range szűkítés megfontolható a vertikális csúszkára, vagy dokumentált „scenic axis" jelleg.

Szükséges validáció: manuális A/B: bendH=0.6 vs bendV=0.6 azonos preset mellett, videó-összehasonlítás.

---

**[P2] F10 — `turnIntensity` három eltérő szemantikával létezik**

Bizonyíték:
- pure sampler: `|amount| * smoothstep(distance/18000)` (`WormholeGrainField.ts:253-254`)
- runtime basis: `|curvature| / ROUTE_CURVATURE` (`WormholeGrainField.ts:795-797`)
- fogyasztott mérték: `smoothedTurnIntensity` = ablakolt heading-delta (`CosmicWormholeIdentity.ts:1104-1117`)

Gyökérok: revíziók során a fogalom finomodott, a régi mezők megmaradtak.

Felhasználói hatás: nincs (a parallax konzisztensen a smoothed mértéket olvassa); karbantartási kockázat: új kód rossz mezőt választhat.

Javasolt minimális megoldási irány: átnevezés/doc-komment (`turnIntensity` → pl. `steeringSaturation` a state-változatban), MVP után.

---

**[P2] F11 — Galaxy réteg a `shouldUseExpensiveGlow` mögött: performance módban a kozmosz középső rétege eltűnik**

Bizonyíték: `CosmicWormholeIdentity.ts:515` — `galaxyAmount > 0 && shouldUseExpensiveGlow(tuning)`; `shouldUseExpensiveGlow` chroma módban is false (`visualTuning.ts:448-450`).

Felhasználói hatás: performance/chroma módban a parallax-hierarchia kétrétegűvé esik; degradációs sorrendként ez védhető, de dokumentálatlan.

Javasolt minimális megoldási irány: a 11. fejezet performance-budget doksijában explicit degradációs sorrendként rögzíteni (nem kódváltozás).

---

**[P3] F12 — Monolit modulok: `DashboardUI.ts` (132 KB), `CosmicWormholeIdentity.ts` (69 KB), `types/index.ts` (38 KB)**

- `DashboardUI.ts`: legalább négy felelősség (preset-szolgáltatás/cache, automation-trigger futásidő, export-orchestráció, chrome/gesture UI). Valódi határ: „PresetService" (fetch/cache/apply/preload — a `presetCache`, `presetUrl`, `cachePreloadedPreset`, `applyPerformancePreset`, `loadVisualPreset*` klaszter) és „AutomationRuntime" (`triggerPerformanceAutomation`, plan-view). Függőségek: State + TuningController callbackok. Visszafelé kompatibilis migráció: delegáló metódusok megtartásával. Regressziós kockázat: közepes (sok teszt forrás-regexszel pinneli a DashboardUI-t — pl. morph-floor hívás). Tesztelhetőség-nyereség: magas (a preset-merge szemantika ma DOM-os osztályban ül). **MVP után.**
- `CosmicWormholeIdentity.ts`: a `draw()` ~520 soros, de a szakaszok (skybox/galaxy/star/grain) jól tagoltak és scratch-state-et osztanak — bontása most regressziós kockázat a nyereség nélkül. Egyetlen indokolt kivonás: `IntegratedWormholeRoute` saját fájlba (már ma is export, tesztek közvetlenül használják). **Alacsony komplexitás, MVP után.**
- `types/index.ts`: dependency-light, csak méret-kényelmetlenség. **Nem indokolt** bontani MVP körül (túltervezés lenne).

**Duplikáció-audit eredménye (4.2):** a repo e téren kifejezetten fegyelmezett — a `clamp01`/`pseudoNoise`/`finiteOr` helperek moduljonként másolódnak (tudatos zero-import policy a pure moduloknál, tesztek is pinnelik), ez elfogadott minta. Párhuzamos route- vagy kameramodell **nincs**: a pure sampler (`sampleWormholeRouteFrame`) és a steering-state ugyanarra a görbület-vocabulary-re épül, a legacy `sampleWormholeRoute/BackgroundRoute` explicit zero-bend kompatibilitási wrapper (dokumentált). Használaton kívüli tuningmező nincs; a `wormholeSkybox` a flag miatt hatástalan (F3).

---

## 5. Kanyarodás és cosmic sync elemzés

**Foreground.** A route nem „meghajlított cső", hanem valódi bejárt pálya: a `WormholeRouteState` heading-integrátor a `bend × ROUTE_MAX_HEADING (0.88 rad)` cél-heading felé kormányoz `ROUTE_HEADING_RESPONSE_DISTANCE = 900` egység válaszúttal; a curvature távolság-domain exponenciális ease-szel követ (980 egység; ellenkormányzáskor 180 — a kanyarból kilépés szándékosan gyorsabb). A `wormholePathBend` tehát **cél-heading-intenzitás** (nem turn-rate, nem screen-offset): tartós érték tartós, de korlátos headinget ad — spirális felcsavarodás kizárt. Maradó heading nincs: a recenter-floor (`RECENTER_FLOOR_WINDOW`) garantálja, hogy bend=0 véges távon belül visszakormányoz az egzakt egyenesbe, numerikus dead-zone snappel (tesztelve: „recentres after spiral", „bend=0 exact baseline").

**Camera frame.** Nincs teljes 3D TNB-frame és nincs is rá szükség a jelen modellben: a horizontális route a saját síkjában fordul (tangent/normal analitikusan a headingből), a vertikális egy második, független integrátor drift-tagja. Roll konstrukciósan lehetetlen (nincs olyan transzform, ami előállítaná); frame-flip/singularitás kizárt, mert a heading korlátos és a bázis mindig `sin/cos(heading)`. Grain head és tail **ugyanazon** route-frame-családból mintáz (explicit korábbi távolság-minta, nem sebesség-becslés) — a trail valós térbeli irány.

**Horizontal bend.** Előjeles, tükör-szimmetria bitpontosan tesztelt (route-geometry „signed bend" blokk). A keresztmetszet kör marad minden mélység/bend kombináción (AC1 numerikus bizonyítás) — a drift-tag théta-független szétválasztása miatt a 4× gain sem torzít ellipszissé.

**Vertical bend.** Teljes értékű, saját integrátorral (nem utólagos korrekció): saját converged-seek, saját smoothed turn, saját skybox-pan tükör. Korlátja az F9 aszimmetria (localZ-t nem modulál).

**Diagonal bend.** `combinedWormholePathBend` tengelyenként clampel, majd hypot > 1 esetén közösen skáláz — a diagonális kanyar összintenzitása nem múlhatja felül az 1D presetekét. Háttér-turn a `hypot(h, v)` kombinált mértékből. Diagonális körkeresztmetszet és „genuinely diagonal" háttér-drift tesztelt.

**Background sync.** Mindhárom réteg ugyanabból a kamera-frame-változásból indul; a rate-hierarchia egyetlen modulból (`WormholeCosmicSync`), a turn-parallax korlátos, szimmetrikus boost (≤1.6×). A csillag közel-sík singularitása kettős anyag-fade-del védve (near-visibility + motion-safety gate + viewport-fade), geometria-index stabil marad. Előjel-konvenció rétegek közt egyező (a skybox korábbi fázishibája javítva és tesztelve — Task06 AC4 komment). Késés: a háttér a distance-smoothed mértéket olvassa (600 unit ≈ 2.5 s referencia-rátán) — ez szándékos „indokoltan eltérő smoothing", és épp a presetváltási háttérugrást előzi meg; a turn-cue tesztek szerint a cue folytonos és irányhelyes. **Galaxy presetváltási csúszás ellen** a `syncPosition`-konvergencia és a lookahead-cap véd (a 30k egységes galaxy-lookahead nem extrapolálhat rejtett többfordulatos route-ot — `sampleWormholeRouteStateFrame` cél-headingnél egyenesbe vált).

**Transition continuity.** Kanyar kezdete/csúcsa/kifutása egyetlen időprofil-láncból: targetTuning glide (song-time) → steering-ease (distance-domain). Presetváltáskor az új bend-target folytonosan veszi át a vezérlést (nincs curvature-törlés — „continuity completion record"); morph-floor akadályozza a nagy-delta párok rövid attack-morphba zuhanását; a mirrorable spiral/overdrive ellenirányú váltásai a kontinuitás-harness küszöbein belül (Task09/Task11 tesztek).

**Route exit.** Nullára visszatérő bend kiegyenesít: ellenkormányzási authority-floor + dead-zone snap; „drive preserves the straight route baseline" tesztelt.

**Seek és long-run.** Seek: `resetConverged` tiszta (distance, bend) függvény — hosszú stabil lejátszással megegyező állapot (Task04 tesztek, H+V). Long-run: 30 perces ciklikus preset-futás monoton travellel, korlátos bufferekkel, finit koordinátákkal; export byte-determinista. Numerikus drift: a route-pozíciók abszolút értéke nő, de minden fogyasztó két minta *különbségét* használja — double pontosság mellett órákig biztonságos (kivétel a skybox abszolút `positionX`-tagja — F6).

---

## 6. Preset audit

### Teljes preset-mátrix (authorált értékek)

| Role | radius | depth | speed | warp | curve (grain) | bendH | bendV | ring | coher | contin | emission | jitter | sens | lineα | hue | visual role | movement role | háttér-elvárás |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| establish | 1.6 | 3.4 | 1.2 | 0.3 | 0 | 0 | ∅ | 0 | 0 | 1.1 | cont. | 0.05 | 0.9 | 1.25 | 210 | tér-építés | intro | nyugodt előre-parallax |
| drive | 1.0 | 2.8 | 4.2 | 0.35 | 0 | 0 | ∅ | 0 | 0 | 1.35 | cont. | 0.04 | 1.15 | 1.3 | 195 | groove baseline | verse/groove | egyenes, gyors csillag-trail |
| spiral | 0.9 | 3.0 | 4.8 | 1.65 | 0.32 | **+0.72** | ∅ | 0 | 0.6 | 1.45 | pulse | 0.12 | 1.3 | 1.35 | 275 | hero turn | build/tension | erős, folyamatos oldal-cue |
| sparse | 1.2 | 4.7 | 1.4 | 0.1 | 0.05 | 0 | ∅ | 0 | 0.35 | 2.0 | burst | 0 | 0.8 | 1.35 | 230 | bordázott break | breakdown | csendes mély parallax |
| punch | 0.85 | 2.4 | 7.2 | 1.2 | 0.08 | 0 | ∅ | 0 | 0 | 0.7 | pulse | 0.35 | 1.45 | 1.65 | 320 | drop-ütés | release/drop | hirtelen sebesség-cue |
| overdrive | 0.8 | 2.3 | 9.0 | 2.5 | 0.45 | **+0.42** (mirror.) | ∅ | 0 | 0 | 0.8 | pulse | 0.9 | 1.55 | 1.85 | 335 | túlhajtott csúcs | peak | max trail + bank |
| drift | 1.8 | 5.0 | 0.3 | 0.2 | 0.1 | **−0.16** | ∅ | 0 | 0 | 1.55 | cont. | 0.05 | 0.8 | 1.25 | 250 | utóhatás-tér | aftermath | lassú bal ív |
| collapse | 0.75 | 2.2 | 2.6 | 0.8 | 0.15 | 0 | ∅ | **0.35** | 0.7 | 0.9 | pulse | 0.45 | 1.25 | 1.45 | 15 | gyűrű-kompresszió | fake-drop/átmenet | egyenes, feszült |
| galaxy | 1.5 | 4.6 | 0.75 | 0.35 | 0.12 | **+0.22** | **+0.12** | 0 | 0 | 2.0 | cont. | 0 | 1.1 | 1.55 | 45 | reveal, leghosszabb streak | reveal | elegáns jobb-fel ív |
| dissolve | 2.1 | 4.2 | 0.5 | 0 | 0 | 0 | ∅ | 0 | 0 | 0.9 | cont. | 0 | 0.65 | 1.25 | 220 | feloldódás | outro | kisimuló, halk |

(∅ = **nem authorált** → F2 szivárgás. `bendMirror`: spiral/overdrive/tension/build/peak targetMap-bejegyzései mirrorable-ök.)

**Szerepek és pairwise megkülönböztethetőség.** A kontraszt-mátrix tesztelt kontraktus (speed-sorrend: overdrive > punch > spiral ≈ drive > collapse > sparse > establish > galaxy > dissolve > drift; a projektált előrehaladás sorrendje külön tesztben). Emberi érzékelhetőség szempontjából a leggyengébb párok: **establish ↔ dissolve** (mindkettő tág, lassú, egyenes, folytonos emissziójú; fő különbség a radius/α) és **sparse ↔ drift** (mély-lassú-hosszú-trail mindkettő; a sparse burst-emissziója és koherenciája hordozza a különbséget). Iránnyal olcsón széthúzhatók (ld. lent).

**Veszélyes kombinációk** (mind renderer-oldali védőhálóval fedve, de retuningnál figyelendő): overdrive `speed 9 + warp 2.5 + jitter 0.9` (projection-safe floor teszt védi); drift `depth 5.0 + speed 0.3` (forward-progress teszt védi); collapse `ring 0.35 + coherence 0.7` (depth-integrity teszt védi a populáció-összeomlást); galaxy `continuity 2.0` magas speed-del kombinálva sosem fordul elő (speed 0.75) — ez maradjon így.

### Hiányzó iránydiverzitás — javasolt irány-mátrix (7.2, csak retuning)

| Role | Javasolt (H, V) | Karakter | Belépés/kifutás | Dramaturgiai funkció |
|---|---|---|---|---|
| establish | (0, **+0.06**) | majdnem egyenes, enyhe emelkedés | lassú be, nincs ki | „belépünk a térbe" |
| drive | (0, 0) | **egzakt egyenes** — marad | — | baseline, minden kanyar referenciája |
| drift | (−0.16, **−0.10**) | lassú bal-le sodródás | hosszú be/ki | süllyedő utóhatás |
| spiral | (+0.72, 0) mirrorable — marad | hero turn | morph-floor által védett | tension |
| overdrive | (+0.42, **+0.18**) mirrorable | meredek jobb-fel bank | gyors be, gyors ki | peak-energia |
| galaxy | (+0.22, +0.12) — marad | széles jobb-fel ív | lassú | reveal |
| sparse | (0, **−0.12**) | lefelé sodródó nyugodt ív | lassú | break-tér |
| collapse | (0, 0) — marad egyenes | ring-kompresszió viszi a feszültséget | — | átmenet |
| punch | (0, 0) — marad | az irányváltás-érzetet a szomszédos curved role-ok adják | — | drop-ütés |
| dissolve | (0, 0) — marad, kifutásként | az előző ív kisimítása | hosszú ki | outro |

Indoklás: a drive/punch/collapse/dissolve egyenessége **tesztelt kontraktus** (klip-profil), ezt nem bontanám meg; az establish enyhe emelkedése viszont a doksi „exact straight-axis roles" listájának pontosítását igényli (10. fejezet). Így lefedett: bal (drift), jobb (spiral, overdrive+mirror), fel-diagonál (galaxy, overdrive), le-diagonál (drift), tisztán le (sparse), tisztán enyhe fel (establish) — mind a nyolc kért irányosztályból hat-hét, egyetlen kódsor módosítása nélkül. **A jelenlegi két paraméter (signed H + signed V, hypot-normalizálással, mirrorable metaadattal) elegendő a célhoz; új mező (poláris/irányvektor reprezentáció) bevezetése nem indokolt** — az interpoláció (komponensenkénti glide) természetesen átforduló íveket ad, és a tesztek bitpontos tükör-szimmetriát garantálnak.

**Csak retuninggal megoldható:** iránydiverzitás, establish/dissolve széthúzás, vertikális kulcs authorálása. **Kódváltozást igényel:** default boot (8. fej.), skybox-döntés (F3/F6), LFO-bekötés (7. fej.), allokáció-csökkentés (F8).

---

## 7. LFO / evolution design

### Ownership-javaslat

**Elsődleges tulajdonos: a meglévő `WormholeMotionProfile` evolúciós blokkja, kiegészítve egy kis tiszta `WormholeEvolutionProfile` függvénycsaláddal ugyanabban a fájlban vagy testvérfájlban** — nem új framework, nem közös modulációs busz, nem preset-felülíró globális szorzó. Indokok: a fázisforrás (`wormholeMusicalPhase`) már létezik, bar-hoz kötött, low-confidence fallbackkel, seek-biztos, tesztelt; a fogyasztási pontok (release-snapshot + anyagút) az identityben már szétválasztottak. Elvetve: automation envelope (más időskála, más owner), tuning-morph réteg (shared state-et írna vissza), preset-meta-only (nem tudna grain-release-hez kötni).

**Kritikus szabály, amit a jelenlegi architektúra diktál:** a geometriai kulcsok (radius, depth, warp, curve, ring, coherence) **release-snapshotoltak** — per-frame modulálásuk pontosan azt a „whole-field breathing" regressziót hozná vissza, amit a kód kommentje expliciten tilt (`CosmicWormholeIdentity.ts:444-451`). Ezért a geometriai LFO **release-időben mintázandó**: a `snapshotGrainGeometry` a snapshot pillanatában a szerzői érték × evolúciós szorzót fagyasztja be. Mivel a ~360 grain generáció-váltása fázis-eltolt (depthPhase szerint folyamatosan szóródik), az eredmény lassú, térben elosztott strukturális evolúció lesz — vanishing-point ugrás nélkül, mert egyszerre sosem vált a teljes populáció. Az anyag-kulcsok (emission gain, alpha, continuity, starfield/galaxy masterek) élőben modulálhatók korlátos amplitúdóval.

**Speed-moduláció** csak az authored speed timeline-on át mehet; a 0.05 quantum + hisztézis (`WormholeTimeline.ts:239-247`) az ennél kisebb LFO-t kiszűri (nincs anchor-spam), a nagyobbat analitikusan integrálja — tehát vagy ≥0.05 lépésközű, ritka moduláció, vagy semmi. **Bend-moduláció** biztonságos élőben: a steering-integrátor távolság-domain low-pass-a természetes simító.

### Paraméterbiztonsági mátrix

| Paraméter | Release/live | Mit módosít | Modulálható? | Ajánlott mód | Fő kockázat |
|---|---|---|---|---|---|
| wormholeRadius | release | geometria | igen | release-time, ±4–6% | — |
| wormholeDepth | release | geometria | igen | release-time, ±5% (ellenfázis radiusszal) | depth-population torzulás nagy amplitúdón |
| wormholeSpeed | target-timeline | travel | óvatosan | ritka, kvantált lépések | anchor-kapacitás (256), quantum alatti no-op |
| wormholeWarp | release | grain-flow | igen | release-time, ±8% | — |
| wormholeCurve | release | grain-flow | igen | release-time, ±0.05 abszolút | — |
| wormholePathBend / Vertical | **live** | route | igen | élő, nagyon lassú (60–120 s periódus), ±0.06 | morph-floor mellett is folytonos (glide + steering) |
| wormholeRing | release | geometria | óvatosan | release-time, csak collapse-nál | ring-decay envelope-pal interferál |
| wormholeDepthCoherence | release | geometria | óvatosan | release-time, ±0.08, csak coherent role-oknál | cohort-rezgés |
| wormholeContinuity | live | anyag (trail-hossz) | igen | élő, ±10% | trail-diszkontinuitás nagy ugrásnál — glide véd |
| wormholeStarfield / Galaxy | live | anyag | igen | élő, ±10%, nagyon lassú | user-global master — csak szorzó, sosem írjuk |
| wormholeSkybox | live | anyag | F3 döntés után | — | — |
| emission (gain-út) | live | anyag | igen | élő, a `wormholeEmissionGain` kimenetére | mode-crossfade-del interferálhat |
| wormholeJitter | release-gate | kick-kohorsz | nem ajánlott | — | pont a tiltott „remegés" |

Minden recept: tiszta függvény, abszolút song/export-time + bar-fázis, seeded per-role fázis-offset (pseudoNoise a role-hash-ből), allokációmentes, `Math.random()`-mentes, nem ír shared state-et (a szorzó a fogyasztás pontján alkalmazódik, nem a tuning-objektumban).

### 10 modulációs recept

| # | Név | Cél | Paraméterek (fázisviszony) | Jelforma | Amplitúdó | Periódus | Illik | Nem illik | Kockázat / teszt |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Organic breathing | lélegző keresztmetszet, fix vanishing point | radius ↔ depth **ellenfázis** | sin | ±5% / ±4% | 8 bar | establish, drift, galaxy | punch, overdrive | depth-integrity teszt LFO-val |
| 2 | Perspective swell | közeledés-távolodás hátramenet nélkül | depth + continuity (fázisban), speed (+0.05 lépés, opcionális) | sin | +6% / +8% | 16 bar | drive, galaxy | collapse | forward-only teszt |
| 3 | Helical pulse | élő spirálrajzolat | warp és curve, 90° eltolás | sin | ±8% / ±0.04 | 6 bar | spiral, overdrive | dissolve, sparse | flow-monotonitás teszt |
| 4 | Route arc evolution | ív lassú átfordulása diagonális térben | bendH + bendV vektor-forgás a szerzői érték körül | két sin, 90° | ±0.05 sugár | 60–120 s | drift, galaxy, spiral | drive, punch (egyenes kontraktus!) | straight-baseline teszt bend=0-nál változatlan |
| 5 | Segmentation breathing | lélegző bordázat | coherence + ring (csak ahol authorált), fázisban | sin² | ±0.08 / ±0.05 | 12 bar | collapse, sparse | drive, galaxy | depth-CV diagnosztika korlát |
| 6 | Streak bloom | drop alatti trail-kibomlás | continuity + emission-gain + depth, fázisban, energia-gate-elve | smoothstep-burst (bar-határhoz kötve) | +15% / +10% / +3% | szakasz-esemény | punch, overdrive | establish | trail-cap teszt (projected trail scale) |
| 7 | Cosmic parallax tide | mélyebb rétegzettség | starfield ↔ galaxy master, ~120° fáziseltolás | sin | ±8% | 90 s / 130 s (inkommenzurábilis) | minden | — | csak anyag; determinizmus-teszt |
| 8 | Dissolve entropy | feloldódás folytonos haladás mellett | emission-gain ↓, continuity ↓ lassú rámpán, jitter marad 0 | egyirányú easing | −20% / −10% | outro-hossz | dissolve | minden más | alpha-floor (visibilityFloor) megmarad |
| 9 | Spectral sector tide | a körspektrográf szektor-karakterének lassú hangsúlyvándorlása | LIVE_GRAIN_SHIMMER körüli ±0.05 anyag-súly | sin | ±6% | 24 bar | verse-szerepek | drop | csak alpha-út; sector-teszt változatlan |
| 10 | Horizon shimmer | távoli sík finom élet | galaxy master + skybox (F3 után), ellenfázis | sin | ±5% | 45 s | establish, galaxy, drift | punch | skybox-korlátosság (F6 fix után) |

Performancia: mind fix költségű (néhány sin/frame globálisan, illetve release-enként); regressziós kockázatot a 4-es és 6-os hordoz (route- ill. trail-út), ezekhez kötelező a 14. pontbeli tesztcsomag.

---

## 8. Default wormhole boot terv

**Jelenlegi default-útvonal:** `store.ts:102` (`'classic'`) → `main.ts` select (classic az első opció, nincs selected) → `DashboardUI` **nem** szinkronizálja boot-kor a selectet a state-hez (csak érvénytelen váltásnál, `DashboardUI.ts:333`, és preset-vezérelt váltásnál, `:2070`) → a kettő ma *véletlenül* egyezik → `loadStylePackOptions` → `syncStylePackToVisualMode` a state-ből olvas (`:621,631`) → style pack követi a módot. Preset-lista: `default.json` kiválasztódik, de **nem töltődik be** — `targetTuning` a `cloneDefaultVisualTuning()` marad. Audio-betöltés után a plan-generálás a state-beli módból dolgozik (`handleVisualModePlanChange`, `generatePlan` → Visual OS pack a select-ből). Boot-kor `requestVisualModeChange` nem fut → **nincs induló crossfade** (és `canAnimate=false` miatt nem is lehetne).

**Szükséges minimális változások (egyetlen kanonikus default):**
1. `store.ts`: `visualMode: 'cosmic-wormhole' as VisualMode` — ez az egyetlen igazságforrás.
2. `DashboardUI` init: egyszeri `(this.els.visualMode as HTMLSelectElement).value = State.visualMode` — így a select mindig a state-et tükrözi, a `main.ts` opciósorrendjétől függetlenül (a sorrend átrendezése opcionális kozmetika).
3. `ShockwaveLifecycle` a `State.visualMode`-dal inicializálódik (`PlexusRenderer.ts:57`) — automatikusan követi, nincs teendő.
4. Style pack: `loadStylePackOptions` automatikusan `cosmic-wormhole` packra áll — nincs teendő.
5. Preset selector: maradhat `default.json` a kiválasztott (nem töltődik be); **opcionális** finomítás: wormhole módban `vos-wh-establish.json` előválasztása — de ez már termékdöntés, az MVP-hez nem szükséges, mert a `defaultVisualTuning` wormhole-értékei (bend 0/0, speed 1, minden master 1) korrekt semleges kiindulás.
6. `tests/contracts.test.mjs:407` regex frissítése `'cosmic-wormhole'`-ra.

**Regressziós kockázatok:** alacsony. A `StyleRegistry.get` fallbackja `classic`-ra változatlan marad (hiányzó id-re, nem defaultra vonatkozik). Export, presentation és audio-előtti állapot mind a state-ből olvas. Egyetlen figyelendő: azok a tesztek/fixtúrák, amelyek üres state-tel `classic` viselkedést várnak (grep szerint a `visual-mode-transition` tesztek explicit állítják a módot — nem érintettek).

**Tesztterv:** (a) új default-konzisztencia teszt: store-default === select-érték === `stylePackForVisualMode` leképezés; (b) boot-crossfade-mentesség: `State.visualModeTransition === null` induláskor; (c) meglévő teljes wormhole-csomag újrafuttatása.

---

## 9. Refaktorálási terv

**Phase 0 — Instrumentáció és baseline** (nincs vizuális változás)
- Cél: frame-time és allokációs baseline a retuning előtt. `wormholeDiagnostics` bővítése frame-time percentilis gyűjtéssel (dev-flag mögött); repró-jelenetek: mind a 10 preset 30-30 s, spiral→drive váltás, 1080p és 4K/2×DPR.
- Érintett: `WormholeDiagnostics.ts`; nem érinthető: minden más.
- Exit criteria: dokumentált p50/p95 frame-time és allokáció/frame minden repró-jelenetre. Visszagörgetés: flag off.

**Phase 1 — Geometriai és ownership javítások**
- Cél: F2 (vertikális kulcs minden presetben), F6 (skybox lateral-tag relatívvá), F4 (doksi-frissítés). Nincs route-modell változás — a single source of truth már fennáll.
- Érintett: `vos-wh-*.json`, `CosmicWormholeIdentity.ts` (drawSkybox), `wormhole-travel-and-path-bend-plan.md`, `wormhole-clip-profile.test.mjs`.
- Nem érinthető: `WormholeGrainField.ts` route-matek, `WormholeTimeline.ts`.
- Tesztek: kumulatív szekvencia-teszt (galaxy→drive vertikális visszatérés), skybox-korlátosság-teszt. Kockázat: alacsony. Exit: teljes wormhole-csomag zöld + új tesztek. Visszagörgetés: preset JSON-ok revertje.

**Phase 2 — Preset retuning (irány-mátrix)**
- Cél: a 6. fejezet irány-kiosztása; establish/dissolve pár széthúzása; klip-profil doksi „straight roles" listájának pontosítása.
- Érintett: `vos-wh-*.json`, `wormhole-clip-profile.md`, Task11 teszt-assertek.
- Tesztek: preset-differentiation, switch-continuity, preset-validation újrafuttatás; **manuális irány-mátrix review (kötelező gate)**. Kockázat: közepes (vizuális). Exit: designer sign-off a 14.4 mátrix szerint.

**Phase 3 — Slow evolution / LFO**
- Cél: a meglévő evolúciós kimenetek bekötése (F5) + a 7. fejezet 4–6 receptje role-profilokkal; release-time geometria / élő anyag szétválasztás betartása.
- Érintett: `WormholeMotionProfile.ts`, `CosmicWormholeIdentity.ts` (snapshotGrainGeometry + anyagút). Nem érinthető: `visualTuning.ts` (nincs shared-state visszaírás), automation lánc.
- Tesztek: LFO-determinizmus, seek-parity, FPS-invariancia, straight-baseline-változatlanság bend-recept mellett, projection-safety radius/depth moduláció alatt. Kockázat: közepes. Exit: mind zöld + manuális „nem remeg, nem pumpál" review.

**Phase 4 — UI default és product hardening**
- Cél: 8. fejezet boot-terve; F3 skybox-döntés végrehajtása; F8 allokáció-csökkentés; performance-budget doksi (F11 degradációs sorrenddel).
- Érintett: `store.ts`, `DashboardUI.ts`, `featureFlags.ts`, `WormholeGrainField.ts` (out-param), doksi.
- Tesztek: default-konzisztencia, allokációs regresszió. Kockázat: alacsony. Exit: boot-smoke + budget-doksi.

**Phase 5 — Végső validáció**
- `npm run build`, teljes `npm test`, 14.4 manuális mátrix, 15 perces hosszú futás élőben (nem csak szimulált), export/live parity szemrevételezés, 30/60/120 FPS spot-check.
- Exit: minden zöld + designer sign-off. Visszagörgetési pont: Phase-enkénti commit.

---

## 10. Javasolt új vagy módosított AC-k

Csak a ténylegesen hiányzó szerződések:

1. **Preset-teljesség AC** (új, a klip-profil doksiba): „Minden `vos-wh-*` preset explicit authorálja az összes route-role kulcsot, **beleértve a `wormholePathBendVertical`-t**; a preset-alkalmazás merge-szemantikája miatt nem authorált route-kulcs tilos." (F2 gyökerének szerződésbe emelése.)
2. **Default identity AC** (meglévő usage-AC pontosítása): „Az alkalmazás első betöltéskor `cosmic-wormhole` módban indul; a `#visual-mode` select, a Visual OS pack és a `State.visualMode` boot-kor kötelezően egyezik; induló crossfade nem történik."
3. **Skybox réteg-státusz AC** (döntésfüggő): vagy „a skybox élő réteg, laterális eltolása minden route-állapotban korlátos", vagy „a skybox kontroll a flaghez kötötten rejtett".
4. **Evolution ownership szabály** (rövid kiegészítés a klip-profil vagy egy új rövid feature-doksi részeként): „Wormhole-paramétert modulálni kizárólag a motion/evolution profil tiszta függvényein át szabad; geometriai kulcs release-snapshot-időben, anyag-kulcs draw-time-ban; shared tuning state-et LFO nem írhat."
5. **Route-contract doksi-frissítés** (nem új szabály, F4 rendezése).
6. **Performance budget dokumentum** (új, rövid): 60 FPS-nél wormhole draw ≤ 8 ms p95 1080p@1×DPR-en (kiinduló javaslat, Phase 0 méréssel kalibrálandó); allokáció/frame ≤ jelenlegi baseline; degradációs sorrend: skybox → galaxy (meglévő expensive-glow gate) → starfield-sűrűség.

Governance-módosítás (AGENTS.md, architecture-contract) **nem szükséges** — a meglévő szabályok lefedik a fentieket.

---

## 11. Nyitott kérdések (kódból nem eldönthető)

1. **A `ROUTE_TURN_VISUAL_GAIN = 4` cinematic helyessége** — a kanyar-olvashatóság vs. „túl erős háttér-optika" mérlege csak videó-review-val dönthető el (a 6.2 „galaxy/skybox optikai mozgása túl erős-e" kérdése pontosan ezen múlik).
2. **Skybox: kell-e az MVP-be?** Ha igen, F6 javítás + perf-mérés kötelező; ha nem, a csúszka rejtendő. Rendezői döntés.
3. **Vertikális bend a csúszka-szélsőértékeken** (F9): elfogadható-e a laposabb olvasat ±1-nél, vagy szűkítsük a UI-range-et ±0.5-re?
4. **Irány-mátrix ízlés-kérdései**: az establish kapjon-e enyhe emelkedést (kontraktus-módosítás), és az overdrive ellenirányú vagy azonos irányú legyen-e a spiralhoz képest egy build→peak szekvenciában (a mirrorable flag mindkettőt tudja).
5. **Valós eszközös performance budget**: a célhardver (VJ-laptop? integrált GPU? 4K kivetítő DPR-je?) ismerete nélkül a 8 ms p95 csak javaslat.
6. **Preset-selector defaultja wormhole módban**: maradjon `default.json`, vagy `vos-wh-establish` legyen az induló look?

---

## 12. Végső ajánlás

**A jelenlegi architektúra alkalmas a kívánt MVP-wormhole elérésére — szerkezeti változás nélkül.** A route/kamera/háttér-lánc single-source-of-truth elve már megvalósult, a determinisztikussági és kontinuitási garanciák tesztelten állnak, a Task 08 vertikális tengely és az előjeles bend a többirányú kanyarodás minden szükséges kifejezőerejét adja.

**Célzott refaktor + retuning elegendő.** A kritikus út a legkisebb kockázattal: **(1)** vertikális kulcs authorálása mind a 10 presetben (F2 — adat, órák), **(2)** default boot váltás (F1 — 3 sor + tesztek), **(3)** irány-mátrix retuning (F7 — adat + manuális review), **(4)** doksi-drift rendezése (F4), **(5)** LFO-bekötés a már létező evolúciós csatornára (F5 — az egyetlen érdemi kódmunka), **(6)** skybox-döntés (F3/F6). Ezek után az MVP-t követően valóban csak kreatív finomhangolás marad.

**Valódi szerkezeti változást semmi nem igényel.** Túltervezés lenne: új bend-reprezentáció (poláris/vektor mező), általános LFO-framework, 3D TNB-frame bevezetése, `CosmicWormholeIdentity` szétbontása MVP előtt, types/DashboardUI monolit-bontás MVP előtt, bármilyen renderer-váltás.

**A legnagyobb maradék kockázat nem architekturális, hanem vizuális-ítéleti**: a gain=4, a parallax-arányok és az új irány-mátrix cinematic minőségét kizárólag a 14.4 szerinti manuális design-review gate tudja validálni — ezt a jelentés egyetlen automatikus tesztje sem helyettesíti, és ezt az állítást ez a feltárás sem teszi meg helyettük.

---

## Validáció (futtatott parancsok)

| Parancs | Eredmény |
|---|---|
| `npm run build` (tsc + vite) | ✅ sikeres (432 modul; 1.48 MB bundle, chunk-size warning — nem új) |
| `node --test` batch 1: `wormhole-route-geometry`, `wormhole-angular-agreement`, `wormhole-vertical-bend`, `wormhole-cosmic-sync`, `wormhole-background-turn-cue`, `wormhole-depth-integrity`, `wormhole-projected-motion`, `wormhole-motion-profile` | ✅ **94/94 pass** (87 s) |
| `node --test` batch 2: `wormhole-determinism`, `wormhole-long-run`, `wormhole-preset-differentiation`, `wormhole-preset-switch-continuity`, `wormhole-preset-validation`, `wormhole-clip-profile`, `wormhole-lifecycle`, `morphing`, `contracts`, `styles-deterministic`, `performance-optimizations` | ✅ **143/143 pass** (98 s) |
| `node --test` batch 3: `visual-mode-transition`, `renderer-boundary`, `visual-os` | ✅ **71/71 pass** |

Nem futtattam: a teljes `npm test` (analyzer/semantics/export/UI csomagok, ~40+ további fájl) — időkorlát miatt; a feladatban kötelezően megjelölt mind a 19 wormhole-teszt és a 4 kapcsolódó teszt lefutott. Bukás nem volt; a feltárás fájlt nem módosított, így feltárás-eredetű bukás nem is lehetett. Környezeti korlát: böngészős futtatás/manuális vizuális validáció ebben a fázisban nem történt — a 13. fejezet vizuális kritériumai ezért mérésre váró státuszúak, ahogy a jelentésben jelöltem.