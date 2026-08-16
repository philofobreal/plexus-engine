# Wormhole refraktív membránfal — implementációs terv

Állapot: mind a 8 fázis megvalósítva (2026-07-18).
Hatókör: `src/visuals/` (Cosmic Wormhole identitás), `src/config/visualTuning.ts`, `src/types/index.ts`, `documents/features/visual-identities.md`, `tests/`.
Döntések (user által jóváhagyva):

1. A `wormholeWall` master paraméter **mérsékelt defaulttal** indul (0.5), tehát a fal minden meglévő wormhole-preset alatt azonnal látszik. A meglévő wormhole-tesztek nem pixel-goldenek, így ez teszt-regressziót nem okoz; a preset-esztétika finomhangolása a 7. fázis feladata.
2. A 8. fázis (térrepedések + pixel-mozaik anyagmód) **a scope része**, a membrán-MVP után következik.

## 1. Cél

A féregjárat fala jelenleg csak implicit (grain-por + háttérrétegek). A cél egy vektoros, optikai torzítás érzetét keltő, rétegzett falanyag:

1. fodrozódó membránrács (alap),
2. Fresnel-perem (üvegszerű hártya-érzet),
3. spektrális kromatikus fénytörési perem,
4. esemény-vezérelt nyomáshullámok,
5. kausztikus spirális fényerek (hero-réteg),
6. peak-only térrepedések + opcionális pixel-mozaik anyagmód (8. fázis).

Valódi framebuffer-/shader-alapú lencsetorzítás ebben a körben **elvetve**: a `VisualRendererBackend` és a kompozitor lényegi bővítését igényelné, aránytalan regressziós kockázattal. A vektoros membrán az esztétikai eredmény nagy részét adja a meglévő primitívekkel.

## 2. Kódban igazolt alapok

- Geometria-alap: `CosmicWormholeIdentity.ts` — `BANDS = 24`, `DEPTH_LAYERS = 15`, `Z_REFERENCE = 1000`, fix konstruktor-allokált pool. A fal ugyanezt a henger-koordinátarendszert (theta, z, `travelDistance`) használja.
- Route-local vetítés készen van: `projectWormholeTubePoint()` (`WormholeGrainField.ts`) theta+radius+z pontot vetít a kamera route-frame-jén át, roll nélkül. A fal nem tart saját kamerát, útvonalat vagy travel phase-t.
- Per-gyűrű route-mintavétel: egy mélységi gyűrű minden pontja azonos z-n van, így gyűrűnként egyetlen `sampleSmoothedLookahead` hívás kell (16 gyűrű × H+V ≈ 32 hívás/frame).
- Esemény-vezérelt, seek-biztos minta: `wormholeKickEnvelopeAtTime()` / `wormholeLowDropAtTime()` (`WormholeTimeline.ts`) tiszta, idő-alapú, FPS-független lookupok. A nyomáshullámok ugyanezzel a mintával készülnek (stateless, bounded visszakeresés a precomputed eseménylistából), nem frame-enkénti spawn-nal.
- Biztonsági limitek újrahasznosítva: `wormholeNearPlaneVisibility`, `wormholeProjectedStrokeWeight` (4.5 cap), `wormholeProjectedTrailScale`.
- Performance-kapcsoló: `shouldUseExpensiveGlow()` / `performanceMode` (`visualTuning.ts`); a galaxy réteg már így gate-elt.
- Költség-kontextus: a jelenlegi frame ~20 000 `line()` hívás körül van (9000 skybox-csillag × 2 pass + 1800 csillag + 360 grain). A tervezett fal ~1200–1500 vonala a budget ~6–8%-a.
- Tesztharness: `tests/*.test.mjs`, Node `node:test` + `ts.transpileModule` + `vm` loader (lásd `wormhole-determinism.test.mjs`). Validáció npm/node-first (governance: nem Bun-first).

Pontosítások a korábbi feltáráshoz képest:

1. A release-lecsengések a házirendben megtett távolság szerint bomlanak (`wormholeReleaseEnvelope`); a falhullám-frontok pozíciója is a kanonikus idő/`travelDistance` forrásból származik, sosem frame-deltából.
2. A hullámokhoz nem kell új esemény-pool: a WormholeTimeline-féle pure időbeli lookup a helyes minta.
3. A fal szektor-hozzárendelésének bitre egyeznie kell a grain-ekével: `bandIndex = floor(theta / 2π × 24)`.

## 3. Modulhatárok

```text
src/visuals/
 ├─ CosmicWormholeIdentity.ts     integráció: draw-sorrend, per-gyűrű route frame-ek
 │                                (marad a route/kamera egyetlen tulajdonosa)
 ├─ WormholeWallGeometry.ts       ÚJ — pure: gyűrű/szegmens paraméterezés, ripple,
 │                                kausztika-görbék, scratch buffer stratégia
 ├─ WormholeWallMaterial.ts       ÚJ — pure: Fresnel-közelítés, szektor-energia,
 │                                kromatikus offset, alpha/stroke
 ├─ WormholeWallWaves.ts          ÚJ — pure: esemény-vezérelt nyomáshullám-front
 │                                evaluáció (WormholeTimeline-minta)
 └─ WormholeWallCracks.ts         ÚJ (8. fázis) — fix pool, peak-only repedések
```

Minden fal-állapot vagy konstruktor-allokált scratch (Float64Array-ek a gyűrűnkénti képernyőpontokhoz, dupla-bufferelt gyűrűváltással), vagy pure függvény kimenete.

Rajzolási sorrend a `draw()`-ban: skybox → galaxy → starfield → **fal (membrán → kausztikák → kromatikus perem)** → grain mező. A por a fal előtt úszik, a fal a hátteret keretezi.

## 4. Fázisok

### 1. fázis — Tuning scaffold

- `VisualTuningConfig` bővítés (`src/types/index.ts`):
  - `wormholeWall` — master, 0–1, **default 0.5**;
  - `wormholeWallRefraction` — 0–1, default 0.5;
  - `wormholeWallCaustics` — 0–1, default 0.5;
  - `wormholeWallWaves` — 0–1, default 0.6.
- Defaults + slider-definíciók a `Wormhole` csoportba (`visualTuning.ts`); ellenőrizni, hogy a preset-normalizálás hiányzó kulcsokra defaultot tölt.
- Minden 1. fázisú kulcs folytonos szám → az `applyTuningMorph` automatikusan morpholja, snap-listába nem kerül.
- Doksi-stub a `documents/features/visual-identities.md` Wormhole Tuning Group szekciójába.

### 2. fázis — `WormholeWallGeometry.ts` + unit tesztek

- Konstansok: `WALL_SEGMENTS = 48` (24 band × 2), `WALL_RINGS = 16`; performance módban 24 × 10.
- A gyűrűk kamera-térben fix z-ken ülnek (nem utaznak, mint a grainek); az anyag-fázis (ripple, kausztika-theta) `travelDistance`-szel scrollozik → folytonos áramló fal objektum-újrahasznosítás nélkül, seek-biztosan.
- Ripple: 2 komponensű, kis amplitúdójú (≤ ~3% radius) szinusz-mező `(theta, ringDepthPhase, travelDistance)` felett; determinisztikus, route-független, sosem írja a headinget.
- Kausztika-görbék: 4–6 analitikus helix `theta(depthPhase, travelDistance)` függvényként, seed-elt `pseudoNoise`-zal.
- Teszt (`tests/wormhole-wall-geometry.test.mjs`): determinizmus, FPS/seek-függetlenség, amplitúdó-korlát, route-frame érintetlenség.

### 3. fázis — `WormholeWallMaterial.ts` + unit tesztek

- Fresnel-közelítés: `wormholeNearPlaneVisibility` × mélységi élkiemelés (közeli, nagy vetített sugarú gyűrűk fényesebbek, távoli fal halvány); pure, monotonitás-tesztelhető.
- Szektor-energia: a grain-ekkel azonos `bandIndex` leképezés; a spektrum csak alpha/refrakció/ripple-sebesség csatornákat hajt, radiust soha (nincs pulzáló fogaskerék).
- Kromatikus offset: a vetített pont radiális képernyő-iránya mentén (gyűrűközéppont = `projectWormholeTubePoint` radius=0-val, gyűrűnként egyszer), ±offset hideg/meleg másolathoz; csak intenzitás-küszöb feletti pontokon (legfényesebb ~20–30%).
- Teszt: Fresnel-monotonitás, szektor-egyezés a grain-leképezéssel, `wormholeWallRefraction = 0` → nulla offset.

### 4. fázis — Integráció a `CosmicWormholeIdentity.draw()`-ba (render smoke kötelező)

- Per-gyűrű route frame-ek (16 × `sampleSmoothedLookahead` H+V), scratch route frame-ek bővítése a meglévő minta szerint.
- Körirányú polyline-ok (48 szegmens/gyűrű, ~768 vonal) + minden 3. thetánál hosszirányú összekötők (~256 vonal).
- Gate-ek: `wormholeWall <= 0` → teljes skip; `performanceMode` → felezett felbontás, kromatikus pass és kausztika-glow kikapcsolva, max 2 kausztika.
- Allokáció-audit: nulla új objektum/closure a draw-ban (Render Anti-Patterns).
- Validáció: `npm run build`, `npm test`, böngészős render smoke (vite dev + vizuális ellenőrzés).

### 5. fázis — `WormholeWallWaves.ts` + tesztek — KÉSZ (2026-07-17)

- Pure evaluátor: adott kanonikus időre a `State.events`-ből bounded ablakban (~2,5 s) visszakeresi a max 3 kvalifikáló eseményt (kick/drop), mindegyikhez Gauss-profilú front `z_front(t − t_event)` pozícióval; állapot nélkül, a `wormholeKickEnvelopeAtTime` mintájára.
- A front a ripple-lel azonos csatornán ad radius-offsetet (korlátozott összamplitúdó), sosem globális pumpálás.
- Karakter: kick → szűk-gyors front; LOW_DROP → széles, lassú kompresszió (`lowDrop.variant` olvasásával).
- Teszt (`tests/wormhole-wall-waves.test.mjs`): seek előtt/után azonos frontok, max 3 aktív, monoton lecsengés, esemény nélkül nulla.
- Megvalósítva: `wormholeWallGatherWaveFronts` (1 slot fenntartva egy élő LOW_DROP-nak `wormholeLowDropAtTime` újrafelhasználásával, a többi a legutóbbi kvalifikáló kick eseményekkel, ugyanazzal a bináris-kereséses mintával mint `wormholeKickEnvelopeAtTime`), `wormholeWallWaveFrontDepthPhase` (kick gyorsabb, mint LOW_DROP), `wormholeWallWaveFrontPeakAmplitude` (saját, csak-decay időbeli burkológörbe front-onkánt, sem a kick, sem a LOW_DROP kereső saját burkolóját nem használja újra — a kettő keverése nem-monoton "attack" szakaszt vitt volna be), `wormholeWallWaveFrontAmplitude` (Gauss térbeli esés a front pozíciója körül), `wormholeWallWaveOffset` (összegzés `WALL_WAVE_MAX_TOTAL_AMPLITUDE`-ra korlátozva). Még **nincs bekötve** a `CosmicWormholeIdentity.draw()`-ba — a terv 5. fázisa (a 2-3. fázisokhoz hasonlóan) csak a modult + teszteket írja elő, az integráció külön fázis feladata marad.

### 6. fázis — Kausztika-réteg integráció — KÉSZ (2026-07-18)

- 4–6 helix polyline a már mintavételezett gyűrű-frame-eken (nincs extra route-hívás), ~100–200 vonal.
- Fényerő a keresztezett szektor band-energiájából; `shouldUseExpensiveGlow` esetén halvány `radialGlow` kísérő a legfényesebb pontokon.
- Megvalósítva: `drawWall()` gyűrű-ciklusán belül, közvetlenül a membrán-szegmensek után, minden `causticIndex < causticCount`-ra újrafelhasználja az adott gyűrű már mintavételezett `this.routeNow`/`this.baseRouteNow`/`verticalDrift` értékeit — nincs extra `routePath` hívás. `wormholeWallCausticTheta` adja a thetát, `wormholeWallBandIndex`+`wormholeWallSectorResponse` a fényerőt (ugyanaz a szektor-leképezés, mint a membránnál). Saját tuning-kulcs (`wormholeWallCaustics`) szorzódik a `wormholeWall` masterrel. Performance-módban `causticCount` 5-ről 2-re csökken, és a `radialGlow` kísérő teljesen kikapcsol (`shouldUseExpensiveGlow` amúgy is `false`-t adna performance-módban, de a `causticGlowEnabled` explicit `!performanceMode` feltétele dokumentálja ezt a szándékot). Külön `causticColor` (alacsony szaturáció, majdnem max fényerő) különbözteti meg a hero-réteget a membrán alap-hue-jától.
- **Regresszió-elhárítás**: a bekötés kezdetben elrontotta a `tests/wormhole-angular-agreement.test.mjs` "starfield, galaxy, and skybox agree on lateral turn direction" tesztet, mert az a galaxis réteg saját, 2-glow-per-galaxy pozíciós feltételezésével olvassa a `backend.glows` tömböt (`glows[idx*2]`), és az új kausztika-glow hívások ugyanabba a tömbbe kerülve eltolták ezt az indexelést. Javítás: a teszt saját, elszigetelt tuning-objektumaiban (`starTuning`/`galaxyTuning`/`skyTuning`) explicit `wormholeWall: 0` állítja le a teljes fal(+kausztika) réteget, ugyanazzal a mintával, ahogy a meglévő tesztek már zérózzák a `wormholeGalaxy`/`wormholeStarfield` kulcsokat az izolációhoz. Ugyanez a "pozíciós index" csapda, amit a Phase 4 jegyzet már dokumentált a `backend.lines`-ra — most a `backend.glows`-ra is érvényesnek bizonyult.
- Validáció: `npm run build` tiszta, `npm test` 622/622 releváns teszt zöld (a 2 ismert, független `wormhole-depth-integrity.test.mjs` hiba változatlanul jelen van, `git stash`-sel újra megerősítve, hogy nem ehhez a munkához köthető). Render smoke: a böngésző képernyőkép-eszköze ebben a munkamenetben megbízhatatlanul időtúllépett (már az első, kódot nem érintő próbálkozásnál is) — helyette a memóriában rögzített konzol-injektálásos technikát használtam: a valódi lefordított `CosmicWormholeIdentity`-t és `State`-et dinamikusan importálva, kézzel felépített canvas-2D-alapú mock backenddel több tuning-konfiguráción (teljes fal+kausztika, performanceMode, `wormholeWall=0`, `wormholeWallCaustics=0`) futtattam a valódi `draw()`-t kivétel nélkül, és a vonal/glow-számok pontosan a várt kapcsolási mintát adták (pl. performanceMode alatt glowCount=0, `wormholeWallCaustics=0` esetén nincs extra vonal a membránhoz képest). Pixel-szintű fényesség-statisztika (`getImageData`) megerősítette, hogy valódi, nem üres tartalom rajzolódott.

### 7. fázis — Finomhangolás, presetek, doksi, teljes validáció — KÉSZ (2026-07-18)

- Preset-átvizsgálás (wormhole clip profil): eltérő fal-intenzitások (pl. `sparse` → alacsony, `collapse`/punch → hangsúlyos hullámok); a mérsékelt default miatt itt kell a preset-esztétikát véglegesíteni.
- `documents/features/visual-identities.md` Cosmic Wormhole szekció + tuning-csoport doksi véglegesítése.
- Teljes kapu: `npm run build`, `npm test` (összes wormhole-teszt), render smoke, determinizmus-ellenőrzés seek/export úton.
- **Megvalósítva**: mind a 10 `vos-wh-*.json` klip-preset most már explicit módon szerzi mind a négy fal-kulcsot (`wormholeWall`, `wormholeWallRefraction`, `wormholeWallCaustics`, `wormholeWallWaves`) a korábbi egységes global default helyett. `sparse` kapja a család legalacsonyabb wall-értékét; `collapse` és `punch` a legkifejezettebb hullámokat; `galaxy` (reveal-showcase) a legmagasabb kausztika-intenzitást. `tests/wormhole-clip-profile.test.mjs`-ben megszűnt a `WORMHOLE_UNPRESETED_KEYS` lista (minden fal-kulcs most factory-preset kulcs), és két új kontraszt-teszt ellenőrzi ezt a szerzői szándékot.
- **Fontos hézag felismerve és lezárva**: a terv 4/6. fázisai explicit "draw-integráció" alfázisok voltak a membránhoz és a kausztikákhoz, de az 5. fázis (hullámok) sosem kapott saját "draw-bekötés" alfázist — a hullám-modul (`WormholeWallWaves.ts`) a 7. fázis megkezdéséig egyáltalán nem volt bekötve a `CosmicWormholeIdentity.draw()`-ba, tehát a most szerzett per-preset `wormholeWallWaves` értékeknek addig szó szerint nulla vizuális hatásuk lett volna. Ez a fázis ezt is lezárja: a `draw()` elején egyszer per-frame összegyűjti a frontokat (`wormholeWallGatherWaveFronts`, ugyanaz a `State.events`/`State.frames`/`State.sampleRate`/`State.hopSize` forrás, amit a kick/LOW_DROP anyag-reakciók már úgyis olvasnak), majd `drawWall()` gyűrűnként egyszer (nem szegmensenként) kiszámolja a `wormholeWallWaveOffset(...)  * clamp01(tuning.wormholeWallWaves)` hozzájárulást, és hozzáadja a `ripple`-lel azonos radius-csatornához (`radius = wallRadius * (1 + ripple + waveOffset)`), sosem a `wallAmount` masterrel szorozva -- pontosan úgy, ahogy a ripple-t sem szorozza a master. Kausztikák továbbra is `waveOffset` nélküli, tiszta `wallRadius`-t használnak (a hullám ugyanahhoz a csatornához tartozik, mint a ripple, nem a kausztikákhoz).
- **Regresszió-elhárítás (2. eset ugyanabból a "pozíciós index" családból)**: a preset-értékek bevezetése elrontotta a `tests/wormhole-depth-integrity.test.mjs` "weak wormhole presets stay visible without a bright always-on grain floor" tesztet, mert az a teszt a grain-alpha "floor"-t méri úgy, hogy `backend.alphas`-t az ÖSSZES `line()`-hívásból (grain ÉS fal ÉS kausztika) átlagolja, `wormholeWall`-t nem izolálva; mivel a `drift`/`sparse`/`dissolve` presetek fal-intenzitása mostantól eltér a `drive`-étól, ez az átlag megváltozott és felborította az összehasonlítást. Javítás: `wormholeWall: 0` hozzáadása ennek a tesztnek a saját, izolált tuning-objektumához, ugyanazzal a mintával, ahogy a `wormholeGalaxy`/`wormholeStarfield` már ott van zérózva -- a teszt neve és célja kizárólag a grain-réteg, nem a fal.
- **Új teljes-stack determinizmus-teszt** (`wormhole-depth-integrity.test.mjs`, "syncPosition also restores deterministic membrane wall, caustic, and pressure-wave geometry (Phase 7 gate)"): két `CosmicWormholeIdentity` példány eltérő számú frame-en át fut ugyanahhoz a dalidőponthoz, majd mindkettő közvetlenül `syncPosition()`-nal ugrik oda (élő kick-eseményekkel és egy aktív LOW_DROP-blokkal, hogy a hullám-front réteg is ténylegesen aktív legyen) -- a renderelt `backend.lines`/`backend.glows` bitre egyezik. Ez a modul-szintű (Phase 2/3/5 saját teszt) tisztaság-bizonyítékot a valódi `draw()`-integráción keresztül is megerősíti.
- Validáció: `npm run build` tiszta; `npm test` 623/625 zöld (a 2 ismert, független `wormhole-depth-integrity.test.mjs` hiba változatlanul jelen van). Render smoke (böngésző képernyőkép-eszköz nélkül, ugyanazzal a konzol-injektálásos technikával, mint a 6. fázisban): mind a 10 valódi preset kivétel nélkül renderelt élő kick/LOW_DROP eseményekkel; közvetlen összehasonlítás igazolta, hogy `wormholeWallWaves=1` vs `=0` (élő eseményekkel) eltérő, valós geometriát ad (max ~29px koordináta-eltérés az első vonaltól kezdve), míg esemény nélkül a két beállítás bitre azonos kimenetet ad.

### 8. fázis — Térrepedések + pixel-mozaik anyagmód (scope-ban) — KÉSZ (2026-07-18)

- `WormholeWallCracks.ts`: előre generált, determinisztikus repedés-pool a henger parametrikus terében (fix kezdő theta, fix mélységtartomány, 4–8 töréspont repedésenként); csak kick/LOW_DROP envelope alatt izzik fel, rövid életű emisszióval és kromatikus szétválással; a fal deformációját követi, a route-ot sosem mozgatja. `performanceMode` alatt teljesen kikapcsol.
- Pixel-mozaik anyagmód: új `wormholeWallMode` diszkrét param (0 = membrán, 1 = mozaik). Diszkrét → a morph snap-listába kerül (a `performanceMode`/`chromaKeyMode` mintájára). A mozaik mélység–szög cellákra bontja a falat (rövid vonal-szegmensek, nem kitöltött cellák), spektrum-vezérelt fénnyel, hullámfrontkor cella-elcsúszással; csak dedikált presetben (`sparse`/`collapse`/digital-fracture jelleg), nem alap falként.
- Tesztek: repedés-pool determinizmus és pool-korlátok; mode-snap viselkedés morph alatt; peak-gate (esemény nélkül nulla emisszió).
- **Megvalósítva — `WormholeWallCracks.ts`**: `WALL_CRACK_COUNT = 7` repedés, mindegyik modul-betöltéskor egyszer seedelve (`buildCrackDef`, nincs `Math.random`, nincs `travelDistance`-függés — a repedés geometriája statikus, csak a fényessége időfüggő). Minden repedés fix `eligibleKind` (kick-only / LOW_DROP-only / mindkettő) és fix `activationRank` küszöböt kap, hogy a család ne villanjon egyszerre minden eseményre. **Nem hoz létre új esemény-poolt**: `wormholeWallCrackEmission(crackIndex, fronts, frontCount)` közvetlenül a `WormholeWallWaves`-ből már összegyűjtött `WormholeWallWaveFront[]`-ot olvassa, saját (a hullám-modulnál jóval rövidebb, "kép-villanás" jellegű) lecsengési állandóval, hogy a repedés ne ugyanazon a görbén fakuljon, mint a radius-hullám.
- **Megvalósítva — `WormholeWallMosaic.ts`**: minimális, csak az új logikát tartalmazó modul — cellaelrendezés (`wormholeMosaicRingCount`, `MOSAIC_SEGMENTS = 24`, egy-az-egyben a 24 spektrális sávval) és a cella-jel (tick) félszélessége (`wormholeMosaicTickHalfWidth`). A cella-elhelyezés maga újrahasznosítja a meglévő `wormholeWallRingDepthPhase`/`wormholeWallSegmentTheta`/`wormholeWallRingZ` függvényeket (nincs duplikált geometria-matek); a cella-elcsúszás a meglévő `wormholeWallWaveOffset` kimenetét skálázza szögbe (`MOSAIC_SHIFT_RADIANS_PER_UNIT`) ahelyett, hogy új Gauss-matekot írna.
- **`CosmicWormholeIdentity.ts` átalakítás**: a korábbi `drawWall()` metódus most egy vékony dispatcher: kiszámolja a közös (`wallAmount`, `performanceMode`, `wallMaxZ`, `wallRadius`) értékeket, majd `tuning.wormholeWallMode` alapján vagy a (változatlan, csak átnevezett) `drawMembraneGrid()`-et, vagy az új `drawMosaicGrid()`-et hívja, végül **módtól függetlenül** mindig meghívja az új `drawCracks()`-et — a repedés a fal *sérülése*, nem egy adott anyag tulajdonsága. Kausztikák szándékosan **nem** kerülnek a mozaik anyagra (a sima analitikus héliszek vizuálisan inkonzisztensek lennének egy blokkos digitális rácson).
- **Tuning-bekötés**: két új kulcs (`wormholeWallCracks` folytonos 0–1, default 0.5; `wormholeWallMode` diszkrét 0/1, default 0) a `types/index.ts`, `visualTuning.ts` (defaultok, slider-defek, és — kritikusan — `wormholeWallMode` felvétele az `applyTuningMorph` snap-listájába) és `identityTuningRegistry.ts` fájlokban. Mind a 10 `vos-wh-*.json` klip-preset explicit szerzi mindkét új kulcsot (`wormholeWallMode: 0` mindegyiken, mivel a terv szerint a mozaik csak egy jövőbeli dedikált presetben kapcsolódna be; `wormholeWallCracks` a család karakteréhez igazítva, hasonló mintázatban, mint a hullámok).
- **Új tesztek**: `tests/wormhole-wall-cracks.test.mjs` (13 teszt: pool-determinizmus/korlátok, monoton mélység a repedés mentén, family-mix, peak-gate, kind-eligibility, monoton lecsengés, defenzív numerikus kezelés), `tests/wormhole-wall-mosaic.test.mjs` (5 teszt: ring-count performance-halvezés, tick-félszélesség determinizmus/korlátok/defenzivitás), `tests/morphing.test.mjs`-ben két új mode-snap teszt (azonnali pattintás nem-nulla és nulla song-time delta esetén is), `tests/wormhole-clip-profile.test.mjs`-ben egy új teszt, hogy egyetlen factory preset se kapcsolja be a mozaikot.
- Validáció: `npm run build` tiszta; `npm test` 642/644 zöld (a 2 ismert, független `wormhole-depth-integrity.test.mjs` hiba változatlanul jelen van — nincs új regresszió ebben a fázisban, a korábbi fázisok "pozíciós index" csapdája ezúttal nem ütött be). Render smoke (konzol-injektálásos technika): mind a membrán, mind a mozaik anyag, mind a performance-mód kivétel nélkül renderel; repedések be/kikapcsolása valós vonalszám-különbséget ad; a mozaik cella-elcsúszása élő kick-eseménnyel valós (~4px), esemény nélkül pontosan nulla geometriai különbséget ad `wormholeWallWaves=1` vs `=0` között — pontosan a tervezett peak-gate viselkedés.

## 5. Kőbe vésett szabályok (governance-ből)

- A fal nem módosíthat route headinget, `travelPhase`-t, kamerát; csak a `CosmicWormholeIdentity` által átadott frame-eket olvassa.
- Minden effekt determinisztikus `(travelDistance, canonicalTime, seed)` függvény; tilos a frame-delta és a `Math.random`.
- Csak `VisualRendererBackend` primitívek (`line`, ritkán `radialGlow`); p5-hívás tilos az effekt-modulban.
- Zéró allokáció a draw loopban; scratch bufferek konstruktorban.
- Stroke/near-plane limitek a meglévő grain-korlátokkal azonosak.
- Spektrum sosem hajt radius-t; radius-csatorna kizárólag ripple + hullámfront, korlátozott összamplitúdóval.

## 6. Kockázatok

| Kockázat | Kezelés |
|---|---|
| A fal elnyomja a grain-spektrográfot (alpha-budget) | fal alap-alpha alacsony (Fresnel-perem dominál), master slider |
| Near-plane gyűrű átcsúszik a kamerán | ugyanaz a cull/fade, mint a graineknél + hoop-szintű skip |
| Mérsékelt default megváltoztatja a preset-vizuálokat | szándékolt döntés; 7. fázis preset-hangolás kezeli |
| Morph közben radius-ugrás | ripple/hullám tisztán travelDistance-fázisú → folytonos |
| `wormholeWallMode` morph-glitch | snap-lista + mode-snap teszt (8. fázis) |

## 7. Validációs parancsok

- `npm run build`
- `npm test` (vagy célzottan: `node --test tests/wormhole-wall-*.test.mjs`)
- Render smoke: `npm run dev` + böngészős vizuális ellenőrzés wormhole módban (governance: visual-only change → render smoke kötelező).
