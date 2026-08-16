# Wormhole "Interstellar-look" feljavítási terv — lencsézés, áramló fal, wireframe-mentesítés

Hatókör: `src/visuals/` (Cosmic Wormhole identitás), `src/config/visualTuning.ts`, `src/types/index.ts`, presetek, `tests/`.
Előzmény: a `wormhole-wall-membrane-plan.md` mind a 8 fázisa lezárult, de a vizuális eredmény
nem éri el a szándékolt referenciát (Interstellar féregjárat). Ez a terv a meglévő, jól tesztelt
infrastruktúrát (route, determinisztikus idő-lookupok, poolok, tuning-morph) **megtartva** cseréli
le azt, ami a képen ténylegesen látszik.

## 0. Task-státusz

Minden task végrehajtása után ezt a táblát frissíteni kell (állapot + egysoros eredmény-jegyzet).

| Task | Név | Függ | Állapot |
|---|---|---|---|
| T1 | Fal-advekció: áramló mintázat, ellenforgás megszüntetése, front-irány | — | KÉSZ (2026-07-18) |
| T2 | Drótváz-mentesítés: összekötők törlése + clump-ívek | T1 | KÉSZ (2026-07-18) |
| T3 | Kausztika-újramintavételezés (szögletes poligonok megszüntetése) | T1 | KÉSZ (2026-07-18) |
| T4 | `WormholeLensWarp.ts` pure modul + unit tesztek | — | KÉSZ (2026-07-18) |
| T5 | Lencse tuning-kulcsok + draw-integráció + render smoke | T4 | KÉSZ (2026-07-18) |
| T6 | Einstein-gyűrű fénytorlódás réteg | T5 | KÉSZ (2026-07-18) |
| T7 | (opcionális) `radialDim` backend-primitív + sötét-üveg vignetta | T5 | KÉSZ (2026-07-18) |
| T8 | Smear-karakter: csík-hosszak, por-finomítás | T5 | KÉSZ (2026-07-18) |
| T9 | Preset-áthangolás + doksi + teljes validációs kapu | T1–T6 (+T7/T8 ha kész) | KÉSZ (2026-07-18) |

Ajánlott sorrend: T1 → T2 → T3 → T4 → T5 → T6 → (T7) → (T8) → T9.
T4 bármikor futtatható (pure modul, nem függ T1–T3-tól).

## 1. Referencia-elemzés — mit mutat az Interstellar-féle kép

A cél-képeken (belső utazás + külső gömb-nézet) négy vizuális összetevő hordozza az élményt:

1. **Gravitációs lencsézés**: a háttér-csillagmező a torok (a járat kijárata) körül ívekbe,
   örvénybe torzul; a fény "körbefolyik" a torkon. Nincs egyenes vonal.
2. **Einstein-gyűrű jellegű fénytorlódás**: a torok pereme környékén a fény felhalmozódik —
   vakító, elmosódott, folytonos fénygyűrű/fényfolt-sáv, nem vektoros kontúr.
3. **Sötét, üveges fal**: a járat fala maga majdnem fekete; csak elkent, szétmaszatolt
   fényfoltok (lencsézett csillagfény) és kausztika-sávok olvashatók rajta. Semmilyen
   rács/drótváz nem látszik.
4. **Sebesség-smear**: haladáskor minden fal-fény hosszú, folyamatos csíkká húzódik és
   **egy irányban, folyamatosan áramlik hátra** — soha nem oszcillál.

## 2. Diagnózis — mit rajzol most a kód, és miért nem ezt

### 2.1 A fehér, szögletes vonalak = alulmintavételezett kausztika-hélixek

`WormholeWallGeometry.ts`: a kausztika theta-ja `twistRate * depthPhase`, ahol
`twistRate = (1.4…3.6) × 2π`, de a hélixet csak a **16 gyűrűn** mintavételezzük
(`drawMembraneGrid` gyűrű-ciklusa). Ez gyűrűnként akár `3.6×2π/16 ≈ 81°` theta-ugrás —
durva Nyquist-sértés: a "spirál" 4–5 töréspontos, csillag-poligonszerű cikkcakká fajul.
A `causticColor` (alacsony szaturáció, 0.98 fényerő) miatt ezek a **fehér** szögletes
alakzatok a képen; a rájuk ültetett `radialGlow` pöttyök az "összekötött fehér pontok".

### 2.2 A drótváz-olvasat = gyűrű-poligonok + hosszanti összekötők

A membrán 16 gyűrű × 48 szegmens zárt polyline + minden 3. szegmensnél hosszanti összekötő
(~256 vonal). Ez definíció szerint drótváz-kalitka ("Tron-cső"), nem üveges membrán. A
referencián a falnak **nincs látható éle**.

### 2.3 A fal nem áramlik — számokkal

- A gyűrűk **fix kamera-térbeli z-n ülnek** (`wormholeWallRingZ`); az egyetlen mozgásforrás
  a ripple/kausztika fázis-scroll.
- Referencia-utazási sebesség ~240 unit/s (lásd `ROUTE_BACKWARD_RESET_THRESHOLD` kommentje:
  24 unit ≈ 0,1 s). A grainek a 1000 unit-os horizontot **~4,2 s** alatt teszik meg.
- A ripple fázisa `travelDistance × 0.0012`, azaz 0,29 rad/s → **egy teljes ciklus ~22 s**.
  A fal textúrája ~50× lassabban mozog, mint a por — állóképnek olvasódik.
- A kausztika `driftRate × travelDistance` = 0,06–0,17 rad/s → **egy körbefordulás 37–105 s**.

### 2.4 Az "oda-vissza ugrálás" oka

- A ripple két komponense **ellentétes theta-irányú** (`phaseA ∝ +3θ`, `phaseB ∝ −5θ`), és
  mindkettő fázisa a travel-lel nő → a két minta ellentétes irányban forog → interferáló
  állóhullám, ami helyben imbolyog, nem áramlik.
- A kick/LOW_DROP nyomásfrontok (`wormholeWallWaveFrontDepthPhase = age × speed`) a kamerától
  **kifelé, a horizont felé** futnak — a haladási iránnyal szemben olvasódnak.

### 2.5 Nincs semmilyen lencsézés

A csillag/galaxis/skybox rétegek vetítése tisztán perspektivikus; semmi nem téríti el a
háttérfényt a torok körül. A "gravitációs lencse" effekt jelenleg **nem létezik** a kódban.

### 2.6 Pöttyök

A csillagok rövid, vastag `line()` szegmensek; a skybox 9000 pont-csillaga főleg álló pötty.
A referencián a fénypontok a torok környékén **ívesen elkentek**.

## 3. Ami jó és megmarad (performance-barát alapok)

- Canvas2D + `line()`/`radialGlow` backend, ~20k vonal/frame budget — **nem** térünk át
  WebGL-re ebben a körben (lásd 7. pont).
- Route/kamera rendszer, `projectWormholeTubePoint`, per-gyűrű route-mintavétel.
- Determinisztikus idő/`travelDistance` alapú evaluátorok (`WormholeTimeline`,
  `WormholeWallWaves` mintája), seek-biztosság, zéró-allokáció, fix poolok.
- Grain-spektrográf réteg és a 24-sávos szektor-leképezés.
- Tuning-morph, preset-rendszer, tesztharness (`tests/*.test.mjs`, Node `node:test`).

## 4. Kulcs-belátás: a lencsézés vektorosan is megvalósítható

Mivel **minden** képpont a saját kódunk által vetített vonal-végpont, a gravitációs lencse
nem igényel framebuffer-műveletet: egy **képernyő-terű, analitikus warp-függvény** a vetítés
után minden háttér-végpontra alkalmazható. Pontonként ~8 flop (gyök nélkül,
`r²`-alapú softened point-mass deflekcióval):

```
d² = (p − C)·(p − C)            // C = a torok vetített képernyő-pozíciója
s  = 1 − k·R² / (d² + soft²)    // radiális deflekció (softened lens)
p' = C + (p − C)·s              // + opcionális azimutális swirl-rotáció φ(d²)
```

- A csíkok (prev→now vonalak) mindkét végpontját warpolva a streak **magától tangenciálisan
  megnyúlik és ívesedik** a torok körül — pontosan a referencia-smear.
- A nagyítás (|ds/dr| alapú) alfa-gain a torok-perem közelében fénytorlódást ad →
  Einstein-gyűrű olvasat.
- `C` nem a képközéppont, hanem a horizont-pont vetülete
  (`projectWormholeTubePoint(…, z=horizon, radius=0)`), így a lencse a route-kanyarokat követi.
- Tisztán determinisztikus, allokációmentes, seek-független; `strength=0` → identitás.

Költség: ~9000 skybox + 1800 csillag + 9 galaxis × 2 végpont ≈ 22k kiértékelés ≈ elhanyagolható
a 20k Canvas2D `line()` hívás mellett. Performance-módban a skybox-warp kihagyható.

## 5. Taskok

Minden task önállóan végrehajtható. Közös szabályok minden taskra:

- Governance: `AGENTS.md` + `documents/governance/` kötelező; determinisztikus
  `(travelDistance, canonicalTime, seed)` függvények, tilos a frame-delta és a `Math.random`;
  zéró allokáció a draw-loopban; a fal/lencse sosem írhat route headinget, `travelPhase`-t,
  kamerát; spektrum sosem hajt radius-t.
- Validáció minden tasknál: `npm run build` + `npm test` (célzottan:
  `node --test tests/<érintett>.test.mjs`); vizuális változásnál render smoke.
- Ismert kiindulási állapot: a `tests/wormhole-depth-integrity.test.mjs`-ben van 2 ismert,
  független, már a kiindulásnál is bukó teszt — ez nem az adott task regressziója, de
  `git stash`-sel ellenőrizendő, hogy a bukások halmaza nem nőtt.
- A task végén: a 0. szekció Task-státusz táblájának frissítése (állapot + egysoros jegyzet),
  és a lefuttatott validációs parancsok felsorolása a záró összefoglalóban.

---

### T1 — Fal-advekció: áramló mintázat, ellenforgás megszüntetése, front-irány

Cél: a fal textúrája a porral megegyező sebességgel, folyamatosan a kamera felé áramoljon;
az oda-vissza imbolygás és a "hátrafelé futó" nyomásfrontok megszüntetése.

Érintett fájlok: `src/visuals/WormholeWallGeometry.ts`, `src/visuals/WormholeWallWaves.ts`,
`tests/wormhole-wall-geometry.test.mjs`, `tests/wormhole-wall-waves.test.mjs`.

Teendők:

1. `wormholeWallRippleOffset`: a `travelDistance × 0.0012/0.0019` fázistagok cseréje
   advekciós tagra — a minta a `depthPhase + travelDistance / 1000` (Z_REFERENCE) domainben
   mozogjon, azaz a mintázat mélységben folyjon át a fix gyűrűkön a grain-sebességgel
   (konvejor-elv). A ≤3% amplitúdó-korlát marad.
2. A két ripple-komponens theta-előjele legyen azonos (eltérő frekvenciával), hogy ne
   ellentétes irányban forogjanak.
3. `wormholeWallCausticTheta`: ugyanez az advekciós elv — a hélix a mélység-áramlással
   együtt mozogjon (a `driftRate` lassú extra forgás maradhat, de a domináns mozgás az
   advekció legyen).
4. `wormholeWallWaveFrontDepthPhase`: a front a horizont felől a kamera felé fusson
   (`1 − age × speed` jelleg, [0,1]-re vágva), hogy a haladás-olvasatot erősítse.
5. Tesztek frissítése + új assertek: (a) advekciós sebesség-egyezés — a mintázat egy adott
   jellemzője pontosan `ΔtravelDistance / 1000` depth-fázissal mozdul el; (b) determinizmus
   és seek-függetlenség változatlanul áll; (c) front-irány assert.

Elfogadás: build + célzott tesztek zöldek; a `drawMembraneGrid`/`drawMosaicGrid` hívási
felülete nem változik (a `CosmicWormholeIdentity.ts`-t lehetőleg nem kell módosítani).

Prompt (új sessionben):

```text
Olvasd el a documents/audits/wormhole-lens-overhaul-plan.md tervet (2.3, 2.4 diagnózis és
az 5. szekció T1 taskja), majd hajtsd végre a T1 taskot pontosan a leírás szerint:
a wormhole fal ripple/kausztika mintázata advekcióval áramoljon a kamera felé a grain-
sebességgel, a két ripple-komponens ellenforgása szűnjön meg, és a nyomásfrontok a horizont
felől a kamera felé fussanak. Frissítsd az érintett teszteket, futtasd a validációt
(npm run build, node --test tests/wormhole-wall-geometry.test.mjs
tests/wormhole-wall-waves.test.mjs, majd teljes npm test), és a végén frissítsd a terv
Task-státusz tábláját.
```

**Eredmény (2026-07-18)**: Bevezetve `WALL_ADVECTION_HORIZON = 1000` (`WormholeWallGeometry.ts`,
duplikálva a `CosmicWormholeIdentity.ts`-beli `Z_REFERENCE`-ból, ugyanaz a minta, mint a
24-sávos konvenció duplikálása a `WormholeWallMaterial.ts`-ben) és a `wormholeWallAdvectedPhase(
ringDepthPhase, travelDistance) = wrap01(ringDepthPhase + travelDistance / WALL_ADVECTION_HORIZON)`
belső segédfüggvény, ami a `WormholeDepth.ts` `depthFromPhase`-ének
(`wrapDepthPhase(grainPhase - travelPhase)`) pontos inverze — "melyik anyag-identitás van most
ezen a fix gyűrűn" —, így a fal mintázata bitre ugyanazzal a rátával áramlik, mint a grain-ek
(egy teljes `WALL_ADVECTION_HORIZON` travel = egy teljes depth-fázis ciklus). `wormholeWallRippleOffset`
mindkét harmonikusa most ezt az advektált fázist olvassa (a korábbi önálló, ~50×-szer lassabb
`travelDistance*0.0012/0.0019` tagok helyett), és mindkét theta-együttható azonos előjelű (3, 5 —
korábban +3/-5, ami ellentétes irányú forgást, állóhullám-imbolygást okozott).
`wormholeWallCausticTheta` twist-tagja ugyanezt az advektált fázist olvassa; a `driftRate*travel`
lassú, önálló forgás megmaradt, de a twist-advekció ~13-30×-szer nagyobb rátájú, tehát domináns
(tesztelve). `wormholeWallWaveFrontDepthPhase` (`WormholeWallWaves.ts`) szemantikája megfordítva:
`clamp01(1 - ageSec*speed)` — a front most a horizonton (depthPhase 1) születik és a kamera felé
fut (depthPhase 0), [0,1]-re clampelve; a hívó `wormholeWallWaveFrontAmplitude` változatlan, mert
mindig ennek a függvénynek a visszatérési értékét olvassa mint "a front jelenlegi pozíciója".
Új/frissített tesztek: `wormhole-wall-geometry.test.mjs` (+3: advekció shift-invariancia,
egy-horizontos periodicitás, kausztika-advekció dominancia), `wormhole-wall-waves.test.mjs`
(a front-irány teszt átírva az új szemantikára; a "peaks at own position" teszt változatlanul
zöld maradt, mert a saját visszatérési értékéből számol referenciát, nem hardcode-olt előjelet).
Validáció: `npm run build` tiszta, `npx tsc --noEmit` tiszta, célzott tesztek (32/32) és teljes
`npm test` (649 teszt, 647 zöld / 2 bukás) — a 2 bukás pontosan a `wormhole-depth-integrity.test.mjs`
korábbról (a wall-membrane-plan Phase 6/7 jegyzeteiben `git stash`-sel már megerősített) ismert,
független hibája, azonos teszt-név/hely/üzenet — nincs új regresszió.

**Utólagos javítás (T3 munkája közben felfedezve, 2026-07-18)**: a `wormholeWallAdvectedPhase`
`wrap01`-je csak akkor "láthatatlan" a fogyasztó szempontjából, ha a fogyasztó **egész szám**-szor
szorozza meg, mielőtt egy `Math.sin`/`Math.cos`-on átmegy (mert csak akkor esik a wrap-ugrás
pontosan egy teljes `TWO_PI` többszörösére). A ripple `phaseB` tagja `advectedPhase * TWO_PI * 3.4`
volt — a 3.4 **nem egész szám** —, tehát minden generációnként egyszer, a `travelDistance`-től
függő, tetszőleges pozíción egy valódi, látható szög-ugrást (tépést) okozott volna. Ezt a T1 commit
maga még nem vette észre, mert az akkor írt tesztek kizárólag kerek `travelDistance` értékeket
(5000, 7000 stb. — mind az 1000-es horizonnak pontos többszöröse) használtak, amik a wrap-határt
mindig a mintavételi tartományon KÍVÜLRE, nem pedig belülre helyezték — így a hiba a tesztekben
nem bukkant elő. A T3 munka közben, a kausztika sűrű mintavételezésének böngészős
render-smoke-ellenőrzésekor (nem kerek `travelDistance`-szel) derült ki: egy 134°-os, éles
törés jelent meg a hélix képernyő-vetületén. Lásd a T3 eredmény-jegyzetét a teljes javításért
(mindkét ripple-frekvencia egész számra állítva, a kausztika csavar-tagja pedig teljesen
wrap-mentesre átírva) és az új, kerekítetlen `travelDistance`-sel dolgozó regressziós tesztekért.

---

### T2 — Drótváz-mentesítés: összekötők törlése + clump-ívek

Cél: a fal ne drótváz-kalitkának, hanem üvegen elkent, foltos fénynek olvasódjon.

Érintett fájlok: `src/visuals/CosmicWormholeIdentity.ts` (`drawMembraneGrid`),
`src/visuals/WormholeWallMaterial.ts` (új pure clump-függvény),
`tests/wormhole-wall-material.test.mjs`, esetleg érintett wormhole-tesztek.

Teendők:

1. A hosszanti összekötő vonalak (WALL_CONNECTOR_*) teljes törlése (~256 vonal megszűnik):
   a `wallConnectorX/Y/Valid` scratch bufferekkel és a `WALL_CONNECTOR_STEP/SLOTS`
   konstansokkal együtt.
2. Új pure függvény (`WormholeWallMaterial.ts`): determinisztikus clump-maszk
   `(theta, advektált depthPhase, seed)` felett (pseudoNoise-alapú, allokációmentes), ami a
   szegmensek ~40–60%-át teljesen kioltja, a maradékot változó hosszú, fényes ívfoltokká
   csoportosítja. A spektrum (szektor-energia) csak a folt fényerejét szorozza, a maszk
   mintáját nem mozgatja (nem villoghat a zenére).
3. A zárt gyűrű-polyline helyett a szegmens csak akkor rajzolódik, ha a clump-maszk > 0;
   a membrán alap-alfa csökkentése, hogy a folt-kontraszt vigye az olvasatot.
4. A clump-maszk az advektált depth-fázison mozogjon (T1 eredményére épül), így a foltok
   a fallal együtt áramlanak.
5. Tesztek: clump-determinizmus és seek-függetlenség; kioltási arány sávja (40–60%);
   vonalszám-csökkenés assert (összekötők eltűntek); a meglévő wormhole-tesztek zöldek.

Elfogadás: build + tesztek zöldek; render smoke-on a fal nem mutat rács-/poligonélt.

Prompt (új sessionben):

```text
Olvasd el a documents/audits/wormhole-lens-overhaul-plan.md tervet (2.2 diagnózis és az
5. szekció T2 taskja), majd hajtsd végre a T2 taskot pontosan a leírás szerint: töröld a
wormhole fal hosszanti összekötő vonalait, és a zárt gyűrű-polyline-ok helyett vezess be
determinisztikus clump-maszkot, ami a szegmensek 40–60%-át kioltja és a maradékot áramló,
fényes ívfoltokká csoportosítja. A spektrum csak fényerőt szorozhat, a maszk mintáját nem
mozgathatja. Írj/aktualizálj teszteket, futtasd a validációt (npm run build, npm test,
render smoke), és a végén frissítsd a terv Task-státusz tábláját.
```

**Eredmény (2026-07-18)**: `CosmicWormholeIdentity.ts`-ből törölve a teljes hosszanti-összekötő
gépezet (`WALL_CONNECTOR_STEP`/`WALL_CONNECTOR_SLOTS` konstansok, `wallConnectorX/Y/Valid`
scratch-tömbök, a `connectorSlot`-ciklus a `drawMembraneGrid`-ben — ~256 vonal/frame megszűnt).
Új `wormholeWallClumpField`/`wormholeWallClumpGain` (`WormholeWallMaterial.ts`): három fix
frekvenciájú (egész `TWO_PI`-szorzós, ezért a fázisban pontosan 1-periódusú) szinusz-harmonikus
súlyozott összege `(theta, advectedDepthPhase)` felett, [0,1]-re remap-elve, majd
`CLUMP_THRESHOLD=0.5 ± CLUMP_SOFT_EDGE=0.04` smoothstep-kapu — numerikusan kalibrálva (200×200-as
sűrű sweep), a teljesen kioltott arány ~45,3%. `wormholeWallAdvectedPhase` exportálva lett a
`WormholeWallGeometry.ts`-ből, hogy a `drawMembraneGrid` gyűrűnként egyszer számolja ki és adja
át a clump-kapunak — ugyanaz az advektált fázis, amit a ripple T1 óta már úgyis olvas, tehát a
foltok a fallal PONTOSAN együtt áramlanak (nem külön órán futnak). A szegmens-rajzolás mostantól
`clump`-pal szorzza az alfát és kihagyja a `backend.line()` hívást, ha `clump<=0.001`; a
gyűrű-záró szegmens a 0. szegmens saját clump-értékével van kapuzva (nem feltétel nélkül zár be
többé). `WALL_ALPHA_SCALE` 160→120 (a folt-kontraszt viszi az olvasatot, nem az alapháttér).
Új tesztek (`wormhole-wall-material.test.mjs`, +6): determinizmus/[0,1]-korlát, 40–60%-os
kioltási arány sűrű sweepen, térbeli koherencia (egy teljesen világos pont szomszédjának
>85%-ban szintén világosnak kell lennie — kizárja a per-szegmens független zajt), pontos
1-periódusú mozgás az advektált mélységfázisban, defenzív numerikus kezelés.
**Render smoke**: a böngésző képernyőkép-eszköze ebben a munkamenetben is megbízhatatlanul
időtúllépett (a wall-membrane-plan Phase 6/7-ben már dokumentált jelenség) — helyette a valódi,
Vite által kiszolgált ESM modulokat dinamikusan importálva (`/plexus-engine/src/...`), a
`CosmicWormholeIdentity` privát `drawWall()`-ját közvetlenül meghívva (bracket-access, a
kausztika/repedés/hullám rétegeket tuning-gal nullázva), majd a kirajzolt Canvas2D képet
`getImageData`-val, több sugáron körkörösen mintavételezve igazoltam: (1) semelyik vizsgált
sugáron (10–400px, 10px lépésköz) nincs egyetlen teljesen zárt, folytonos gyűrű sem — mindenhol
töredezett ívek (litFraction 0,03–0,17, több különálló "run"), szemben a régi, garantáltan
100%-osan zárt körvonallal; (2) ugyanazon időpontra kétszer renderelve bitre azonos mintázat
(determinizmus, diff=0/480 mintapont); (3) t=3,0s és t=3,2s között a mintázat érdemben elmozdul
(64/480 mintapont vált állapotot), miközben a lefedettség nagyságrendje stabil marad (73 vs 69
világos pont) — ez az "áramlik, nem villog/ugrál" viselkedés közvetlen bizonyítéka.
Validáció: `npm run build` tiszta, `npx tsc --noEmit` tiszta, célzott material-tesztek (19/19),
teljes `npm test` 654 teszt, 652 zöld / 2 bukás — a 2 bukás pontosan a már ismert, független
`wormhole-depth-integrity.test.mjs` hiba (azonos név/hely/üzenet), nincs új regresszió.

---

### T3 — Kausztika-újramintavételezés (szögletes poligonok megszüntetése)

Cél: a fehér, szögletes vonalak eltüntetése — a kausztika sima, folytonos spirál-ívként
rajzolódjon.

Érintett fájlok: `src/visuals/CosmicWormholeIdentity.ts` (kausztika-rajzolás),
`src/visuals/WormholeWallGeometry.ts` (twist-korlát), `tests/wormhole-wall-geometry.test.mjs`.

Teendők:

1. A kausztika-hélixek kiemelése a 16 gyűrűs mintavételből: saját, sűrű mélység-menti
   mintavétel (5 hélix × 48–64 lépés ≈ 240–320 vonal). Költség-korlát: a
   `sampleSmoothedLookahead` route-hívások száma nem nőhet lényegesen — a gyűrűknél már
   mintavételezett route frame-ek scratch-be mentése és köztes mélységekre lineáris
   interpolálása megengedett (allokáció nélkül, konstruktor-allokált Float64Array-ekkel).
2. `twistRate` levágása ≤ ~1,5 fordulat/horizontra, hogy a spirál olvasható maradjon.
3. Nyquist-őr assert a tesztben: két szomszédos kausztika-minta közti theta-lépés < ~20°.
4. Vonal-budget: az összekötők T2-es törlése (−256) fedezi a többletet (+~200); budget
   assert a tesztben.
5. A kausztika-glow kísérők ritkítása/finomítása, hogy ne "pötty-lánc" legyen.

Elfogadás: build + tesztek zöldek; render smoke-on a kausztika sima ívként olvasódik,
szögletes fehér poligon nem látható.

Prompt (új sessionben):

```text
Olvasd el a documents/audits/wormhole-lens-overhaul-plan.md tervet (2.1 diagnózis és az
5. szekció T3 taskja), majd hajtsd végre a T3 taskot pontosan a leírás szerint: a wormhole
fal kausztika-hélixei saját, sűrű mélység-menti mintavétellel rajzolódjanak (5 × 48–64 lépés)
a 16 gyűrűs alulmintavételezés helyett, twist-korláttal és Nyquist-őr teszttel, úgy, hogy a
route-mintavételek száma érdemben nem nő (gyűrű-frame-ek scratch-interpolációja megengedett,
zéró allokációval). Futtasd a validációt (npm run build, npm test, render smoke), és a végén
frissítsd a terv Task-státusz tábláját.
```

**Eredmény (2026-07-18)**: `WALL_CAUSTIC_MAX_TURNS = 1.5` (min 0.5) exportált korlát a
`WormholeWallGeometry.ts`-ben, a korábbi 1.4–3.6 fordulat helyett. `CosmicWormholeIdentity.ts`:
a `drawMembraneGrid` gyűrű-ciklusa mostantól **minden** gyűrűnél (a fresnel-alapú láthatósági
gate ELŐTT) elmenti a saját route-frame-jét, vertikális driftjét és depth-fázisát a konstruktorban
allokált `wallRingFrames`/`wallRingVerticalDrift`/`wallRingDepthPhase` (méret `WALL_RINGS`=16)
tömbökbe — a korábbi, fresnel-alapú korai `continue` miatt ez korábban NEM történt meg minden
gyűrűnél; a mostani cache-elés függetlenítve lett a láthatósági kaputól, mert a sűrű kausztika-
mintavétel ugyanezeket a keretezéseket bracket-ként újrahasznosítja, függetlenül attól, hogy az
adott gyűrű membránja látszik-e. A kausztika-rajzolás kikerült a gyűrű-ciklusból egy önálló
`drawCaustics` metódusba: 48 (performance módban 32) minta mélységenként hélixenként, a
`wormholeWallRingDepthPhase`/`wormholeWallRingZ` generikus (bármely mintaszámmal hívható) pure
függvényeit újrahasznosítva a saját, sűrű rácsán. Minden finom mintához egy két-mutatós
("two-pointer") keresés találja meg a bracketelő két gyűrűt (mindkét szekvencia monoton nő
depth-fázisban), majd egy új `lerpWormholeRouteFrame` segédfüggvény (a meglévő
`interpolateRouteHistoryFrame` mintáját követve: pozíció+heading lerp, tangent/normal
újralevezetve a lerpelt headingből, sosem a nyers vektorokat lerpelve) állítja elő az interpolált
keretet — **nulla új `sampleSmoothedLookahead` hívás** a sűrű mintavételhez. A glow-kísérő
`WALL_CAUSTIC_GLOW_SAMPLE_STRIDE=3`-mal ritkítva (48/16=3), hogy a sűrűbb vonalmintavétel ne
"pötty-lánc"-cá torzítsa a fényglóriát. Vonalszám: ~75→~235/hélix-készlet (+~160), amit a T2-ben
törölt ~256 összekötő-vonal fedez.

**Kritikus, T3 közben felfedezett és javított hiba (lásd a T1 utólagos jegyzetét is)**: a
`wormholeWallAdvectedPhase`-t hordozó `wrap01` csak akkor ártalmatlan, ha a fogyasztó egész
számmal szorozza meg `Math.sin`/`Math.cos` előtt. A ripple `phaseB`-je (3.4-es, nem egész
együttható) és a kausztika csavar-tagja (a `turns` paraméter szándékosan **tört szám**, 0.5–1.5,
a sima spirál-hatásért) mindkettő megsértette ezt — minden generációnként egyszer, a
`travelDistance`-től függő, előre nem jelezhető pozíción egy valódi, éles törést okozva a
hélix vetített alakján (böngészős méréssel: 134°-os csúcsszög egy kép-térbeli töréspontnál,
szemben a javítás utáni ~10°-os, sima, perspektíva-magyarázható maximum-mal). Javítás: (1) a
ripple mindkét mélység-frekvenciája egész számra állítva (3.4 → 3); (2) a kausztika theta-ja
mostantól **nem** a wrap01-elt `wormholeWallAdvectedPhase`-t olvassa, hanem egy helyben számolt,
sosem wrap-elt `depthPhase + travelDistance / WALL_ADVECTION_HORIZON` összeget — mivel a downstream
fogyasztó (`Math.cos`/`Math.sin` a `projectWormholeTubePoint`-ban) bármely valós thetára pontosan
periodikus, a korlátlanul növekvő fázis pontosan ugyanolyan folytonos, mint egy wrap-elt, csak
tépés nélkül. Ez a hiba a T1 commitban keletkezett, de ott rejtve maradt, mert a T1 tesztjei
kizárólag kerek (1000 többszörös) `travelDistance` értékeket használtak, amik a wrap-határt mindig
a mintavételi tartományon kívülre helyezték. Új regressziós tesztek (`wormhole-wall-geometry.test.mjs`):
"stays continuous as travelDistance sweeps densely across an advection-horizon wrap boundary"
(ripple) és "stays continuous across the full depth sweep at every travelDistance" (kausztika) —
mindkettő kifejezetten NEM kerek `travelDistance`-eket és/vagy a wrap-határon sűrűn átívelő
söpréseket használ, hogy ez a hibaosztály a jövőben ne csúszhasson át észrevétlenül.

**Regresszió-elhárítás (harmadik eset ugyanabból a "pozíciós index/réteg-keveredés" családból)**:
a T2+T3 együttes hatására (a klump-kapu csökkenti a membrán vonalszámát, a sűrű kausztika-
mintavétel pedig jelentősen növeli a kausztika vonalszámát) megbukott a
`wormhole-depth-integrity.test.mjs` "automation morph reaches existing render geometry within
one second without waiting for grain release" tesztje (1.987px elmozdulás a 2px-es küszöb alatt).
Kiderült: ez a teszt a `spiral` preset TELJES objektumát szórja szét a saját bázis-tuningjára
(`{...spiral, wormholePathBend: 0, ...}`), ami csendben felülírja a fájl `setupReleaseTestState`
segédfüggvényének explicit `wormholeWall = 0` izolációját (amire a fájl MINDEN MÁS grain-viselkedési
tesztje támaszkodik, ugyanazzal a dokumentált indoklással: "these tests read backend.lines/alphas
positionally as one entry per surviving grain, so the membrane wall's own line() calls... must not
be interleaved into that stream"). A teszt neve és célja kizárólag a grain-réteg reakcióját méri,
nem a fal/kausztika-réteget — a helyes javítás (nem workaround) a `wormholeWall: 0` hozzáadása a
teszt saját `baseline` objektumához, ugyanazzal a mintával, ahogy a wall-membrane-plan Phase 6/7-je
már kétszer dokumentálta ugyanezt a "pozíciós index/réteg-keveredés" csapdát (`backend.glows`,
majd `backend.alphas` esetén). Ellenőrizve: a fix után a teszt zölddé vált, és a diagnosztikai
mérés megerősítette, hogy a fal/kausztika réteg kizárása visszaállítja a 2px fölötti,
komfortos elmozdulás-tartományt.

Validáció: `npm run build` tiszta, `npx tsc --noEmit` tiszta, célzott tesztek (18 majd 19/19 a
folytonossági regressziós tesztek hozzáadása után), teljes `npm test` 657 teszt, 655 zöld / 2 bukás
— a 2 bukás pontosan a már ismert, független `wormhole-depth-integrity.test.mjs` hiba (azonos
név/hely/üzenet), nincs új regresszió. Render smoke: böngészős élő ESM-importtal (Vite dev szerver,
konzol-injektálásos technika, ugyanaz a minta mint T1/T2-nél) — a `drawCaustics` privát metódust
közvetlenül meghívva, a gyűrű-cache-t kézzel feltöltve, majd a kép-térbeli vetített pontok
szomszédos szegmensei közti irányszög-változást mérve: a javítás előtt 134°-os csúcs (valódi
törés), a javítás után 10,6°-os maximum, mind a "legrosszabb" pontok a horizont-közeli, perspektíva
által természetesen megnövelt szögváltozású tartományban (depthPhase ≈ 0,9–0,95) — nem
alulmintavételezési műtermék.

---

### T4 — `WormholeLensWarp.ts` pure modul + unit tesztek

Cél: a gravitációs lencse képernyő-terű warp matematikája önálló, pure modulként.

Érintett fájlok: ÚJ `src/visuals/WormholeLensWarp.ts`, ÚJ `tests/wormhole-lens-warp.test.mjs`.

Teendők:

1. A terv 4. szekciójának képlete szerint: `wormholeLensWarpPoint(px, py, cx, cy, radius,
   strength, swirl, out)` — softened point-mass radiális deflekció + sugárral lecsengő
   azimutális swirl-rotáció; gyökmentes (`d²`-alapú) forma, ahol lehet; caller-owned out
   struktúra (zéró allokáció); minden bemenet defenzíven kezelve (NaN/Infinity → identitás).
2. `wormholeLensMagnificationGain(d², radius, strength)`: korlátos (cap-elt) fényerő-gain a
   lencse-sugár környékén — az Einstein-gyűrű torlódás alapja.
3. Csak számokat számol: nem olvas route/kamera/State-et, nem allokál, determinisztikus.
4. Unit tesztek: `strength=0` → bitre identitás; determinizmus; radiális monotonitás a
   soft-core-on kívül; folytonosság a core-on át (nincs szingularitás d²→0-nál);
   magnification-cap; swirl=0 → tiszta radiális warp; defenzív input-kezelés.

Elfogadás: build + új teszt zöld; a modult még semmi nem importálja (az integráció T5).

Prompt (új sessionben):

```text
Olvasd el a documents/audits/wormhole-lens-overhaul-plan.md tervet (4. szekció és az
5. szekció T4 taskja), majd hajtsd végre a T4 taskot pontosan a leírás szerint: hozd létre
a src/visuals/WormholeLensWarp.ts pure modult (softened point-mass képernyő-terű lencse-warp
+ swirl + magnification-gain, zéró allokáció, defenzív inputkezelés, semmilyen State/route
olvasás) és a tests/wormhole-lens-warp.test.mjs unit teszteket. A modult még ne integráld a
rendererbe. Futtasd a validációt (npm run build, node --test tests/wormhole-lens-warp.test.mjs,
npm test), és a végén frissítsd a terv Task-státusz tábláját.
```

**Eredmény (2026-07-18)**: `wormholeLensWarpPoint(px, py, cx, cy, radius, strength, swirl, out)`
— softened point-mass radiális deflekció `s = max(0, 1 − strength·R²/(d²+soft²))` (a `soft²` a
sugár 0,18×-ának négyzete, elkerülve a `d²→0` szingularitást) + opcionális azimutális swirl-forgás
(`swirlAngle = swirl · min(falloff, 6)`, ugyanazt a `falloff = R²/(d²+soft²)` görbét újrahasznosítva,
a 6-os felső korlát a forgásszöget tartja kordában a magon belül). `strength<=0` vagy `radius<=0`
→ bitre pontos identitás (gyors út is egyben). Minden számítás `d²`-térben (gyökmentes) — csak a
`wormholeLensMagnificationGain(d², radius, strength)` használ egy `Math.sqrt`-öt, mert a
gyűrű-fényesedés Gauss-dudora szándékosan a valódi képernyő-távolság (`r`, nem `d²`) körül
szimmetrikus, hogy a gyűrű vastagsága ne torzuljon a sugártól függően; korlátos
`[0, LENS_MAGNIFICATION_MAX_GAIN=2.5]`-re. A két függvény szándékosan **független**: a deflekciós
görbe legmeredekebb szakasza a mag közelében van (nem a sugárnál), míg a fényesedés-dudor pontosan
a sugárra van centrálva — más vizuális szerepet töltenek be (pozíció-torzítás vs. fényesítés egy
adott sugárnál), ezért nem egy közös `|ds/dr|` deriváltból származnak.
Tervezési döntés (dokumentálva a kódban): a `strength≈1`-nél a teljes sugáron belüli terület a
lencse-középpontra omlik össze (nem csak enyhén tolódik el) — ez szándékos, mert a referenciaképek
sötét, fényt elnyelő torkot mutatnak fényes, elkent gyűrűvel körülötte, nem enyhén torzított
háttércsillagokat a toroknyíláson belül is.
Tesztek (`tests/wormhole-lens-warp.test.mjs`, 12 teszt): identitás `strength<=0`/`radius<=0`-nál,
determinizmus, `swirl=0` → a pont a lencse-középponttól mért szög változatlan marad (tiszta
radiális warp), nemnulla swirl ténylegesen elforgatja a pontot, a radiális skálafaktor monoton nő
a távolsággal, folytonosság/korlátosság a mag közelében (bitre pontosan a középpontra esik `d=0`-nál),
a magnification-gain a sugárnál csúcsosodik és mindkét irányban lecseng, korlátos minden bemenetre,
nulla ha `strength<=0`/`radius<=0`, defenzív NaN/Infinity-kezelés, nem olvas semmilyen
route-frame-szerű vagy State-szerű megosztott objektumot.
Validáció: `npm run build` tiszta, `npx tsc --noEmit` tiszta (a modult még semmi nem importálja —
a Vite build 437 modult transzformál, változatlanul, mivel a fájl egyelőre halott kód a bundle
szempontjából, ez a T5 integráció előtt várt állapot), célzott tesztek 12/12, teljes `npm test`
669 teszt, 667 zöld / 2 bukás — a 2 bukás pontosan a már ismert, független
`wormhole-depth-integrity.test.mjs` hiba, nincs új regresszió.

---

### T5 — Lencse tuning-kulcsok + draw-integráció + render smoke

Cél: a lencse-warp élesítése a háttér-rétegeken, tuning-vezérléssel.

Érintett fájlok: `src/types/index.ts`, `src/config/visualTuning.ts`,
`src/config/identityTuningRegistry.ts`, `src/visuals/CosmicWormholeIdentity.ts`,
tesztek (`tests/wormhole-*.test.mjs` érintettek).

Teendők:

1. Új tuning-kulcsok: `wormholeLens` (master, 0–1, default ~0.6), `wormholeLensRadius`
   (0–1, default 0.5), `wormholeLensSwirl` (0–1, default ~0.35). Folytonosak → az
   `applyTuningMorph` automatikusan morpholja őket, snap-listába nem kerülnek. Defaults +
   slider-definíciók a Wormhole csoportba + registry-bejegyzés; a preset-normalizálás
   hiányzó kulcsokra defaultot tölt (ellenőrizni).
2. Lencse-középpont: frame-enként egyszer a horizont-pont vetülete
   (`projectWormholeTubePoint(routeNow@horizon, …, radius=0)`) — a route-kanyart követi.
3. A skybox-, csillag- és galaxis-rétegek vetített végpontjaira (prev és now egyaránt)
   `wormholeLensWarpPoint` alkalmazása; a magnification-gain az alfát szorozza. A
   `viewportVisibility` és a motion-safety fade a **warpolt** pontokon fusson.
4. Gate-ek: `wormholeLens <= 0` → teljes skip, bitre azonos a mai képpel;
   `performanceMode` → skybox-warp kihagyva (csillag+galaxis marad).
5. A grain-rétegre (cső belseje) NEM megy warp.
6. Tesztek: lens=0 bitre-azonossági teszt (backend.lines összevetés); lencse-középpont
   folytonossága route-kanyarban; determinizmus/seek teszt a warpolt úton.
7. Render smoke: vite dev, vizuális ellenőrzés — a csillagcsíkok a torok körül ívesednek.

Elfogadás: build + tesztek zöldek; `wormholeLens=0`-nál bitre változatlan kimenet.

Prompt (új sessionben):

```text
Olvasd el a documents/audits/wormhole-lens-overhaul-plan.md tervet (4. szekció és az
5. szekció T5 taskja), majd hajtsd végre a T5 taskot pontosan a leírás szerint: vezesd be a
wormholeLens / wormholeLensRadius / wormholeLensSwirl tuning-kulcsokat (types, visualTuning
defaults+sliderek, identityTuningRegistry), és integráld a WormholeLensWarp modult a
CosmicWormholeIdentity draw()-jába: a skybox/csillag/galaxis rétegek mindkét streak-végpontja
warpolódik, a magnification-gain alfát szoroz, a lencse-középpont a horizont-pont vetülete.
wormholeLens=0 → bitre azonos kimenet (teszttel bizonyítva); performanceMode → skybox-warp
kihagyva; grain-réteg warp-mentes. Futtasd a validációt (npm run build, npm test, render
smoke böngészőben), és a végén frissítsd a terv Task-státusz tábláját.
```

**Eredmény (2026-07-18)**: A tuning-kulcsok (`wormholeLens`/`wormholeLensRadius`/`wormholeLensSwirl` —
types, `defaultVisualTuning` (0.6/0.5/0.35), sliderek, `identityTuningRegistry`, snap-lista-mentes
folytonos morph) egy korábbi, félbeszakadt sessionben már elkészültek; ez a session a tényleges
draw-integrációt végezte el. `CosmicWormholeIdentity.ts` `draw()`-ja a route-frame-ek mintavétele
után (a skybox-blokk előtt) egyszer per-frame kiszámolja a `lensCenterX/Y`-t
(`this.routePath.sampleSmoothedLookahead(camZ + Z_REFERENCE, …)` + `projectWormholeTubePoint(…,
radius=0, …)` — ugyanaz a horizont-vetületi minta, mint a fal gyűrű-középpontjaié) és a
`lensRadiusPx`-t (`wormholeLensRadius × képernyő fél-átló`), csak ha `tuning.wormholeLens > 0`
(`lensActive`) — egyébként a régi, `WormholeLensWarp`-ot importáló ág egyáltalán nem fut le, ami
`wormholeLens<=0`-nál bitre pontos azonosságot garantál (nem csak a modul saját belső
identitás-útjára támaszkodva). A skybox (`drawSkybox`, új `applyLens`/`lensCenterX/Y`/`lensRadiusPx`/
`lensStrength`/`lensSwirl` paraméterek), a csillag-hurok (inline a `draw()`-ban) és a galaxis-hurok
(mindkét radialGlow-hívás — az aktuális "now" fényudvar ÉS a halványabb előző-frame visszhang —
külön-külön warpolva) mindegyike a saját prev/now végpontját `wormholeLensWarpPoint`-tal warpolja,
a `wormholeLensMagnificationGain`-t pedig `1 + gain` alakban szorozza az alfába (nem `gain`
önmagában — ez a döntés dokumentálva a kódban: a gain-görbe messze a lencse-sugártól nulla, tehát
egy sima `alpha *= gain` mindent kioltana a gyűrűn kívül; az `1 + gain` additív fénytorlódásként
viselkedik, ahogy a terv 4. szekciója is "fénytorlódást ad" — nem "helyettesíti a fényt" — nyelvezettel
írja le). A csillag-hurok viewport-visibility/motion-safety-gate mostantól a WARPOLT végpontokon fut
(a terv 3. pontja szerint). `performanceMode` csak a skybox-warpot hagyja ki (`applySkyboxLens =
lensActive && !performanceMode`); csillag és galaxis performance-módban is warpol, mert a terv
explicit "csillag+galaxis marad" nyelvezete ezt írja elő. A grain-réteg (cső belseje) egyáltalán nem
látja a lencse-kódot.
Új tesztek (`tests/wormhole-lens-integration.test.mjs`, 7 teszt), a `wormhole-depth-integrity.test.mjs`
`createSourceLoader`+mock-backend mintáját követve: (1) `wormholeLens=0` bitre azonos kimenet — nem
csak két valódi renderelés összevetésével, hanem egy **manipuláló stub**-bal a `WormholeLensWarp.ts`
helyén (minden warpolt pontot egy jól látható marker-értékre írna át, ha meghívódna), ami erősebb
bizonyíték: a marker sosem jelenik meg, tehát a modul MEG SEM HÍVÓDIK `wormholeLens<=0`-nál; (2-4)
ugyanezzel a marker-stubbal külön-külön igazolva, hogy a skybox/csillag/galaxis réteg ténylegesen a
lencsén át fut, és hogy `performanceMode` kizárólag a skyboxot kapcsolja ki (a csillag réteg marker-je
performanceMode alatt is megjelenik); (5) a grain/fal réteg SOHA nem hordozza a markert, wormholeWall
be- és kikapcsolt állapotban is; (6) seek-determinizmus a warpolt úton (két identity, eltérő
frame-történettel ugyanarra az időpontra szinkronizálva, bitre azonos `lines`/`glows`); (7) a
lencse-középpont a route-kanyart követi (egyenes útnál pontosan képernyő-középpont, íves útnál
mérhetően eltolódik, és két közeli travel-pozíció között nem ugrik) — egy **rögzítő** stubbal (nem
korrumpáló), ami a valódi warpot változatlanul hagyja, csak feljegyzi, milyen `(cx, cy)` középponttal
hívták meg minden ponton.
**Teszt-infrastrukturális csapdák (a saját új tesztfájlban, nem a terméki kódban)**: (a) a
`backend.lines`/`glows` `assert.deepEqual`-lal való összevetése két KÜLÖNBÖZŐ `createSourceLoader()`
(= külön `vm` realm) hívásból származó renderelés között hamis mismatch-et adott, mert a beágyazott,
újrahasznosított `galaxyColor` tömb a saját realmjának `Array.prototype`-jét hordozza — a
`makeBackend()`-ben JSON-round-trip klónozással (`JSON.parse(JSON.stringify(args))`) oldva meg,
dokumentálva a kódban, hogy a jövőbeli hasonló tesztek ne essenek ugyanebbe a csapdába; (b) a
lencse-középpont folytonossági tesztben a felmelegítő (warm-up) képkockák is meghívták a rögzítő
stubot, és a teszt tévesen az ELSŐ (alig konvergált) képkocka középpontját hasonlította össze — javítva
a `centersByCall` tömb törlésével közvetlenül a mért, végleges `draw()` hívás előtt.
**Regresszió más tesztfájlokban (kilenc, mind a `wormholeLens` új, nem-nulla (0.6) default értéke
miatt)**: mivel a lencse most ténylegesen olvassa `tuning.wormholeLens`-t, minden meglévő teszt, ami
korábban implicit "lencse-mentes" háttér-projekciót feltételezett (csillag/galaxis/skybox szög,
sugár, egymáshoz képesti irány pontos egyezése) — de nem állította explicit nullára — mostantól a
0.6-os alapértelmezett lencsével torzított geometriát mér. Ez NEM a lencse-kód hibája, hanem a
tesztek saját izolációjának hiánya (pontosan ugyanaz a minta, mint a `wormholeWall=0` már meglévő
izolációs konvenciója számos helyen) — javítás: `wormholeLens: 0` hozzáadása minden érintett teszt
saját tuning-objektumához, kommenttel indokolva. Érintett fájlok/tesztek:
`tests/wormhole-background-turn-cue.test.mjs` (a `starAngleSeries` helper + a `separationAt`
függvény a "cosmos bend response" tesztben), `tests/wormhole-angular-agreement.test.mjs` (a
"bend=0 skybox trail" és a "starfield/galaxy/skybox agree on lateral turn direction" tesztek saját
tuning-objektumai), `tests/wormhole-vertical-bend.test.mjs` (a Task08 fagyasztott-fixture teszt és a
mirror-symmetry teszt), `tests/wormhole-preset-switch-continuity.test.mjs` (a közös `completePreset`
segédfüggvényben, ami minden preset-pár tesztet lefedi). Egy tizedik, tényleg csak a lencse-kulcsokkal
összefüggő hiba: `tests/wormhole-clip-profile.test.mjs`-ben a `WORMHOLE_TUNING_KEYS` hardcode-olt
lista nem tartalmazta az új 3 kulcsot (az `identityTuningRegistry.ts`-ben viszont már ott voltak egy
korábbi sessionből) — bővítve, és egy új `WORMHOLE_LENS_KEYS` kizárási lista bevezetve
(`WORMHOLE_BACKGROUND_MASTER_KEYS` mintájára), hogy a "minden preset explicit szerzi az összes
factory-kulcsot" kontraktus NE követelje meg a lencse-kulcsok preset-szintű szerzését — az T9 feladata.
**`git stash`-sel megerősített, T5-ön KÍVÜLI, T1–T4-ből örökölt ismert hiba (a bukások halmaza nem
nőtt)**: a `CosmicWormholeIdentity.ts`-t ideiglenesen stash-elve (a lencse-integráció nélküli, T1–T4
utáni állapotra visszaállítva) a `wormhole-depth-integrity.test.mjs` két tesztje —
"viewer route frame keeps the wormhole core centered while backgrounds sell the turn" és "spiral and
overdrive keep foreground vanishing point lens-local while bending orientation" — MÁR AKKOR IS bukott,
tehát nem az én T5 munkám regressziója (a korábbi, T3-as jegyzetben dokumentált "2 ismert bukás" névsora
azóta, valamikor T1–T4 között, megváltozott — ez önmagában nem T5 hatásköre, jegyzetként hagyva a
jövőbeli munkának).
Validáció: `npm run build` tiszta, `npx tsc --noEmit` tiszta, célzott lencse-integrációs tesztek
(7/7) és a T4 lencse-warp unit tesztek (12/12) zöldek, teljes `npm test` 676 teszt, 674 zöld / 2
bukás — pontosan a fent dokumentált, T5-ön kívüli, T1–T4-ből örökölt 2 hiba, nincs új regresszió.
Render smoke: élő Vite dev szerver (böngésző JS-konzol, dinamikus ESM-importtal a valódi forrásból,
ugyanaz a T1–T3-ban bevált technika), egy 480×270-es Canvas2D backendre renderelve, `wormholeLens=0`
és `wormholeLens=0.7` mellett is — a két kép vizuálisan egyértelműen eltér: lencse be mellett a
torok-közeli csillagcsíkok láthatóan ívesen a közép felé húzódnak, és egy fényesebb, melegebb tónusú
torlódás jelenik meg a torok körül (a T6 saját, dedikált Einstein-gyűrű rétege nélkül is már jól
olvasható előzetes jel).

---

### T6 — Einstein-gyűrű fénytorlódás réteg

Cél: a torok pereme körüli vakító, elmosódott fénygyűrű (a referencia 2. komponense).

Érintett fájlok: `src/visuals/CosmicWormholeIdentity.ts`, esetleg kis pure segédfüggvény a
`WormholeLensWarp.ts`-ben; tesztek.

Teendők:

1. A lencse-sugár mentén 8–16 íves `radialGlow` folt; fényerő = magnification-gain × a
   keresztezett szektor band-energiája (a meglévő 24-sávos `wormholeWallBandIndex`
   leképezéssel) — a gyűrű a zenével él, de a pozíciója stabil.
2. A foltok theta-eloszlása determinisztikus (seed-elt), enyhén advektált, hogy ne
   mechanikus óralap legyen.
3. Gate-ek: `shouldUseExpensiveGlow` + performance-módban 4 foltra csökken;
   `wormholeLens <= 0` → skip.
4. Teszt: glow-hívások száma a gate-ek szerint; determinizmus; pozíció a lencse-sugáron.

Elfogadás: build + tesztek zöldek; render smoke-on folytonos, puha fénygyűrű-olvasat.

Prompt (új sessionben):

```text
Olvasd el a documents/audits/wormhole-lens-overhaul-plan.md tervet (1. szekció 2. pont és az
5. szekció T6 taskja), majd hajtsd végre a T6 taskot pontosan a leírás szerint: rajzolj a
wormhole lencse-sugara mentén 8–16 determinisztikusan elosztott, band-energia-vezérelt
radialGlow foltot Einstein-gyűrű fénytorlódásként, shouldUseExpensiveGlow/performanceMode
gate-ekkel (performance-módban 4 folt), wormholeLens<=0 esetén teljes skippel. Írj teszteket
a gate-ekre és a determinizmusra, futtasd a validációt (npm run build, npm test, render
smoke), és a végén frissítsd a terv Task-státusz tábláját.
```

**Eredmény (2026-07-18)**: A `CosmicWormholeIdentity.ts` új, külön `drawEinsteinRing` rétege a
T5-ben már egyszer kiszámolt `lensCenterX`, `lensCenterY`, `lensRadiusPx` és `lensStrength`
értékeket használja újra, közvetlenül a háttér-rétegek után és a fal előtt. Normál módban 12
(a terv 8-16-os keretén belüli), performance módban pontosan 4, konstruktoron kívüli allokáció
nélküli `radialGlow` foltot rajzol. Minden folt pozíciója pontosan a lencse sugarán van; az
egyenletes körhelyzetet slotonkénti seedelt fáziseltolás töri meg, a kicsi advekció pedig kizárólag
`travelDistance`-ből és `canonicalTime`-ból jön. Nincs `Math.random`, frame-delta vagy új
per-frame tároló. A folt a saját theta-ján a már létező 24-sávos `wormholeWallBandIndex`-et
olvassa; az alfa alapfényessége szó szerint `wormholeLensMagnificationGain(R², ...) × bandEnergy`,
amelyet csak a fix megjelenítési skála és a meglévő `lineAlpha` szoroz tovább. A spektrum így csak
a fényt mozgatja, a sugarat és a stabil eloszlást nem. A normál minőségi kapu a
`shouldUseExpensiveGlow(tuning)`; mivel az a megosztott helper performance módban is false-t ad,
a T6 explicit követelményének megfelelően ott egy külön, továbbra is chroma-key-tiltott, 4-foltos
korlátos út marad aktív. `wormholeLens <= 0` teljesen kihagyja a réteget.

Új `tests/wormhole-einstein-ring.test.mjs` (3 teszt), a T5 VM-es source-loader mintájával és
izolált háttér/fal rétegekkel: (1) `wormholeLens=0` esetén nincs glow, normál módban 12, performance
módban 4, chroma-key módban pedig a shared glow-gate miatt 0 hívás; (2) két, eltérő draw-történetű,
majd azonos időpontra seekelt identity bitegyező glow-kimenetet ad; (3) minden rögzített glow
távolsága pontosan a már kiszámolt lencse-sugár. Validáció: a célzott teszt 3/3 zöld,
`npx tsc --noEmit` helyett a PATH-ról hiányzó npx miatt a csomagolt Node-dzsal futtatott
`node_modules/typescript/bin/tsc --noEmit` zöld; `npm run build` helyett a PATH-ról hiányzó npm és
a sérült pnpm bin-remap miatt a helyi `node_modules/vite/bin/vite.js build` zöld (438 modul,
csak a meglévő >500 kB chunk-figyelmeztetés). A teljes Node tesztfuttatásban kizárólag a már ismert,
T1-T5 után is meglévő két `wormhole-depth-integrity.test.mjs` bukás maradt: "viewer route frame
keeps the wormhole core centered while backgrounds sell the turn" és "spiral and overdrive keep
foreground vanishing point lens-local while bending orientation"; új bukás nincs. Render smoke:
a Vite szerver HTTP-n 200-zal elérhető volt, de az in-app Browser és a Chrome automation egyaránt
`ERR_CONNECTION_REFUSED`-ot kapott localhostra, ezért a kért böngészős `getImageData`/`toDataURL`
pixel-ellenőrzés ebben a sessionben nem futtatható; a dev szervert leállítottam.

---

### T7 — (opcionális) `radialDim` backend-primitív + sötét-üveg vignetta

Cél: a torkon kívüli háttér elsötétítése, hogy a fal "sötét üvegnek" olvasódjon (a
referencia 3. komponense). Backend-seam bővítés → csak explicit döntés után futtatandó;
a task elindítása maga a döntés.

Érintett fájlok: `src/visuals/RendererBackend.ts`, `src/visuals/P5RendererBackend.ts`,
`src/visuals/CosmicWormholeIdentity.ts`, tesztek (backend-mock frissítések!).

Teendők:

1. Új primitív: `radialDim(cx, cy, innerRadius, outerRadius, alpha)` — inverz radiális
   gradiens (középen átlátszó, kifelé sötét), egyetlen gradiens-fill; a
   `VisualRendererBackend` interfészbe és a `P5RendererBackend`-be.
2. Figyelem: minden teszt-mock és a kompozitor-út (export, chroma-key, video-backplate)
   ellenőrzendő — az interfész-bővítés miatt a tesztek kézzel épített mock backendjeit is
   frissíteni kell.
3. A wormhole draw-ban a skybox/galaxis réteg után, a fal előtt: egy `radialDim` a
   lencse-középpontra, erőssége a `wormholeLens` × fal-intenzitás függvénye.
4. Teszt: dim-hívás gate-elése; lens=0 → nincs hívás; mock-frissítések zöldek.

Elfogadás: build + tesztek zöldek; export/chroma-key út render smoke-kal ellenőrizve.

Prompt (új sessionben):

```text
Olvasd el a documents/audits/wormhole-lens-overhaul-plan.md tervet (5. szekció T7 task),
majd hajtsd végre a T7 taskot pontosan a leírás szerint: adj radialDim(cx, cy, innerRadius,
outerRadius, alpha) primitívet a VisualRendererBackend interfészhez és a P5RendererBackend
implementációhoz (inverz radiális gradiens), frissítsd a tesztek mock backendjeit, és kösd
be a wormhole draw()-ba a háttérrétegek után sötét-üveg vignettaként a lencse-középpontra.
Ellenőrizd az export/chroma-key/video-backplate utakat. Futtasd a validációt (npm run build,
npm test, render smoke), és a végén frissítsd a terv Task-státusz tábláját.
```

**Eredmény (2026-07-18)**: A `VisualRendererBackend` és a `P5RendererBackend` új
`radialDim(cx, cy, innerRadius, outerRadius, alpha)` primitívet kapott. Az implementáció egyetlen,
középen átlátszó és kifelé feketébe sötétedő Canvas2D radiális gradiens-fillt rajzol, véges/biztonságos
sugár- és alfa-clampeléssel; a backend meglévő aktív-target feloldása miatt ugyanaz a kód működik a
normál canvas, az export target és a compositor két offscreen targetje felé. A wormhole draw a teljes
háttér (skybox/galaxis/csillagmező) után, az Einstein-gyűrű és a fal előtt hívja meg a primitívet a
már kiszámolt route-követő lencseközéppel. A belső/külső sugár a lencsesugár `0.82×`/`2.35×` értéke,
az alfa `clamp01(wormholeLens × wormholeWall) × 0.58`; `wormholeLens<=0`, `wormholeWall<=0` vagy
chroma-key mód esetén teljes skip történik, hogy a vignetta ne szennyezze a kulcsszínt. Performance,
export és video-backplate módban az egyetlen gradiens-fill aktív marad. Minden kézzel épített
teszt-backend mock frissült. Az új `tests/wormhole-radial-dim.test.mjs` 4 tesztje lefedi a gate-eket,
a lencseközép/sugár/alfa kontraktust, az Einstein-gyűrű előtti rétegsorrendet, az export- és
video-backplate draw-utat, valamint a P5 implementáció egyetlen inverz gradiens-filljét az aktív
export targeten. Validáció a PATH-ról hiányzó `node`/`npm` miatt a Codex csomagolt Node-jával:
`node.exe --test tests/wormhole-radial-dim.test.mjs tests/renderer-boundary.test.mjs
tests/wormhole-einstein-ring.test.mjs` (8/8 zöld), `node.exe --test
tests/wormhole-angular-agreement.test.mjs tests/wormhole-background-turn-cue.test.mjs
tests/wormhole-radial-dim.test.mjs` (16/16 zöld), `node.exe node_modules/typescript/bin/tsc --noEmit`
(tiszta), `node.exe node_modules/vite/bin/vite.js build` (tiszta, csak a meglévő >500 kB
chunk-figyelmeztetés), teljes `node.exe --test tests/*.test.mjs tests/ui/*.test.mjs` (683 teszt,
681 zöld / 2 bukás). A két bukás pontosan a T5-T6 óta dokumentált, T7-től független
`wormhole-depth-integrity.test.mjs` eset: "viewer route frame keeps the wormhole core centered while
backgrounds sell the turn" és "spiral and overdrive keep foreground vanishing point lens-local while
bending orientation"; új regresszió nincs. Böngészős render smoke: a Vite app és a
`vos-wh-establish` preset normál módban sötét-üveg karakterrel renderelt; chroma módra váltva a
fekete vignetta nem szennyezte a kulcsszínű hátteret, és egyik úton sem volt konzolhiba. Tényleges
video-export audiofájl nélkül az UI-ban nem indítható; az export-target és video-backplate utat az új
automatizált backend/draw integrációs teszt ellenőrizte.

---

### T8 — Smear-karakter: csík-hosszak, por-finomítás

Cél: gyors szakaszokon a kép a referencia "fénykorbács" jellegét vegye fel; a pöttyös
olvasat csökkentése.

Érintett fájlok: `src/visuals/CosmicWormholeIdentity.ts` (streak-skálázás),
`src/visuals/WormholeCosmicSync.ts` (ha a trail-szorzók ott élnek), tesztek.

Teendők:

1. A csillag/skybox streak-hossz erősebb skálázása a kanonikus travel-rátával, kiemelten a
   torok-közeli (lencse-sugáron belüli) pontokon; a meglévő
   `wormholeProjectedTrailScale`/motion-safety cap-ek érintetlenül maradnak.
2. Grain-réteg finomítás: a streak-folytonosság (`wormholeContinuity` hatás) és a
   vonalvastagság-arányok átvizsgálása, hogy a por finom szemcse maradjon, ne kövér pötty.
3. Teszt: trail-hossz monoton nő a travel-rátával; cap-ek érvényesülnek; determinizmus.

Elfogadás: build + tesztek zöldek; render smoke gyors szakaszon (magas wormholeSpeed
preset) hosszú, folytonos csíkokat mutat.

Prompt (új sessionben):

```text
Olvasd el a documents/audits/wormhole-lens-overhaul-plan.md tervet (1. szekció 4. pont és az
5. szekció T8 taskja), majd hajtsd végre a T8 taskot pontosan a leírás szerint: a wormhole
csillag/skybox streak-hosszak skálázódjanak erősebben a kanonikus travel-rátával (kiemelten
a lencse-sugáron belül), a meglévő trail/motion-safety cap-ek megtartásával, és finomítsd a
grain-réteg vastagság-arányait a pöttyös olvasat ellen. Írj tesztet a monoton
rátafüggésre és a cap-ek érvényesülésére, futtasd a validációt (npm run build, npm test,
render smoke), és a végén frissítsd a terv Task-státusz tábláját.
```

**Eredmény (2026-07-18)**: A `WormholeCosmicSync.ts` két új pure, determinisztikus és korlátos
smear-segédfüggvényt kapott. A `wormholeSmearRateGain` a kanonikus world-unit/sec rátát egy
1–2,2 közötti gainné alakítja; a meglévő lineáris `wormholeTrailSeparation` eredményével szorozva a
gyors szakaszok csíkhossza a telítési pontig a rátánál erősebben nő. A
`wormholeLensSmearGain` kizárólag a képernyőtérben, a lencsesugáron belül ad további 1–1,65 közötti
tail-nyújtást, négyzetes távolságból (hot-path `sqrt` nélkül); a fejet, route-ot, travel phase-t,
vetítési mélységet és spektrum-geometriát nem módosítja.

A `CosmicWormholeIdentity` a rate-gainnel növelt, de továbbra is
`SKYBOX_TRAVEL_RATE_CAP`-pel korlátozott korábbi skybox route-mintát, valamint rate-gainnel növelt
starfield `vzStar` mintát használ. A torok-közeli csillagok előző képernyőpontja külön lens-local
nyújtást kap a meglévő lens warp előtt; a már warpolt végpontokon futó 120–300 px-es
motion-safety fade változatlan maradt. A skybox forward cue minden pontnál továbbra is az eredeti
`SKYBOX_FORWARD_CUE_CAP` alatt marad, a grain-ek `wormholeProjectedTrailScale` cap-je pedig érintetlen.
Nincs új draw-loop objektum, closure, frame-delta vagy `Math.random`.

A grain-karakter új súly/trail arányai a populáció 56%-át adó finom port 0,32–0,54 közötti
hairline súlyra és 0,9–1,25 közötti folytonos trailre hangolják; a strukturális grain-ek hosszabbak,
a ritka sparkok felső súlya 1,85-ről 1,6-ra csökkent. A meglévő, byte-ra fagyasztott
`wormholePathBendVertical=0` fixture előző star-endpointjai a szándékos T8 csíkhossz-geometriára
frissültek; a jelenlegi endpointok, glow-k és a zéró vertikális route invariánsai változatlanok.

Tesztek: a `wormhole-cosmic-sync.test.mjs` új T8 esetei ellenőrzik a monoton/szuperlineáris
rátafüggést, a rate- és lens-capeket, a torok-kizárást, a determinizmust, valamint a meglévő projected
trail ceiling érvényét; a `wormhole-motion-profile.test.mjs` rögzíti a finom por hairline és
folytonossági szerződését. Célzott kapuk: 71/71 és a fixture-frissítés utáni 32/32 zöld.
Validáció: a PATH-ról hiányzó `node`/`npm` miatt a Codex csomagolt Node-jával futott; a deklarált
`pnpm run build` a már dokumentált sérült Bun-bin remap miatt nem tudott processzt indítani, ezért a
governance szerinti helyi-entrypoint fallback `node_modules/typescript/bin/tsc --noEmit` és
`node_modules/vite/bin/vite.js build` egyaránt zöld (438 modul, csak a meglévő >500 kB
chunk-figyelmeztetés). A teljes Node suite 686 tesztből 684 zöld / 2 bukás: pontosan a T5–T7 óta
dokumentált két, T8-tól független `wormhole-depth-integrity.test.mjs` eset maradt, új regresszió nincs.
Böngészős render smoke: az élő Vite app HTTP 200-zal betöltött az in-app Browserben, a 2560×1440-es
fő canvas láthatóan nem üres volt, a `vos-wh-overdrive` preset kiválasztása warning/error nélküli
renderutat adott. Audiofájl nélkül tényleges gyors playback nem indítható; a nagy-rátájú
csíkhossz-geometriát ezért a fenti automatizált renderút- és pure tesztek ellenőrizték.

---

### T9 — Preset-áthangolás + doksi + teljes validációs kapu

Cél: a 10 wormhole klip-preset áthangolása az új rétegekre, dokumentáció, teljes kapu.

Érintett fájlok: `public/visual-tuning-presets/vos-wh-*.json` (mind a 10),
`tests/wormhole-clip-profile.test.mjs`, `documents/features/visual-identities.md`,
ez a tervdokumentum.

Teendők:

1. Mind a 10 preset explicit szerzi az új kulcsokat (`wormholeLens`, `wormholeLensRadius`,
   `wormholeLensSwirl`): pl. `establish`/`galaxy` erős lencse, `sparse` visszafogott,
   `collapse`/`punch` erős swirl. Fal-alfa lejjebb, kausztika-karakter újra-balansz.
2. Paletta-döntés: alacsonyabb szaturációjú, kék-fehér irányú hue a hitelesebb filmes
   look-ért — presetenként mérlegelve (a magenta karakter maradhat ahol szerzői szándék).
3. `tests/wormhole-clip-profile.test.mjs`: az új kulcsok factory-preset kulcsok legyenek;
   kontraszt-assertek a szerzői szándékra (pl. sparse < establish lencse-erő).
4. `documents/features/visual-identities.md` Cosmic Wormhole szekció frissítése.
5. Teljes kapu: `npm run build`, teljes `npm test`, render smoke mind a 10 presettel,
   seek/export determinizmus-ellenőrzés; e terv Task-státusz táblájának lezárása.

Elfogadás: minden preset renderel, tesztek zöldek, doksi naprakész.

Prompt (új sessionben):

```text
Olvasd el a documents/audits/wormhole-lens-overhaul-plan.md tervet (5. szekció T9 task, és
nézd át a T1–T8 taskok státusz-jegyzeteit), majd hajtsd végre a T9 taskot pontosan a leírás
szerint: mind a 10 vos-wh-*.json preset explicit szerezze az új lencse-kulcsokat a task
szerinti karakter-eloszlással, balanszold újra a fal/kausztika intenzitásokat, mérlegeld
presetenként a kék-fehér irányú palettát, frissítsd a wormhole-clip-profile teszteket
kontraszt-assertekkel és a documents/features/visual-identities.md doksit. Futtasd a teljes
kaput (npm run build, npm test, render smoke mind a 10 presettel, seek/export determinizmus),
és zárd le a terv Task-státusz tábláját.
```

**Eredmény (2026-07-18)**: Mind a 10 `vos-wh-*.json` preset explicit szerzi a
`wormholeLens`, `wormholeLensRadius` és `wormholeLensSwirl` kulcsokat. Az értékek szerepalapú
kontrasztot adnak: `establish`/`galaxy` erős és széles reveal-lencsék, `sparse` a család leggyengébb
lencséje, `collapse`/`punch` a legerősebb swirl-akcentusok. A `wormholeWall` master minden presetben
lejjebb került, hogy a fal sötét üvegként, ne fényes ketrecként olvasódjon; a kausztika új
egyensúlyában `galaxy` maradt a hero-reveal maximum, míg a visszafogott szerepek jelentősen
alacsonyabbak. A paletta hét filmes szerepnél kék–fehér tartományba került (a korábbi vörös
`collapse` és arany `galaxy` is), `punch`/`overdrive` megtartotta a szerzői magenta impact-karaktert,
`spiral` pedig kék-ibolya átmenet maradt.

A `tests/wormhole-clip-profile.test.mjs` megszüntette a lencsekulcsok ideiglenes T9-kivételét:
mindhárom most factory-preset kulcs. Külön teszt ellenőrzi a tíz preset explicit, control-range-en
belüli lencseértékeit, és kontraszt-assertek rögzítik a reveal/sparse/swirl/paletta szerzői
szándékot. A `documents/features/visual-identities.md` dokumentálja a három lencsevezérlő pontos
felelősségét, a wall/caustic új balanszát és a filmes kontra magenta palettadöntést.

Validáció: a deklarált `pnpm run build`/`pnpm test` scriptindítás ebben a környezetben azért nem
futott végig, mert a csomagkezelő alfolyamata nem találta a PATH-ról hiányzó `node` parancsot.
A governance szerinti csomagolt-Node fallbackkel a közvetlen, azonos entrypointok futottak:
`node.exe node_modules/typescript/bin/tsc --noEmit` és
`node.exe node_modules/vite/bin/vite.js build` tiszta (438 modul; csak a meglévő >500 kB
chunk-figyelmeztetés), a teljes `node.exe --test tests/*.test.mjs tests/ui/*.test.mjs` kapu
688 tesztből 686 zöld / 2 bukás. A két bukás pontosan a T5 óta dokumentált, T9-től független
`wormhole-depth-integrity.test.mjs` eset (`viewer route frame keeps...` és
`spiral and overdrive keep...`); új regresszió nincs. A külön T9 seek/export csomag
(`wormhole-clip-profile`, `wormhole-lens-integration`, `wormhole-radial-dim`,
`wormhole-preset-switch-continuity`) 54/54 zöld: az aktív lencsés seek különböző előzmények után
bitazonos, az export/video-backplate target út működik, és a presetváltási folytonosság megmaradt.

Böngészős render smoke: az élő Vite appban mind a 10 preset egyenként kiválasztható volt, mind a
10 egyedi presetérték ténylegesen megjelent a select állapotában, a látható 2560×1440 fő canvas
végig nem üres maradt, és nem keletkezett warning/error. Audiofájl nélkül a kanonikus song-time
morph áll, ezért az egymás után rögzített canvas-képek bitazonosak; a smoke így a renderút és a
preset-alkalmazás hibamentességét igazolja, az értékkontrasztot az új contract-teszt és a teljes
determinista style harness ellenőrzi.

## 6. Kőbe vésett szabályok (minden taskra)

- A lencse-warp **képernyő-terű, vetítés utáni** transzformáció: nem írhat route headinget,
  travelPhase-t, kamerát, és nem hathat vissza a vetítési mélységre.
- Minden új effekt determinisztikus `(travelDistance, canonicalTime, seed)` függvény; tilos a
  frame-delta és a `Math.random`.
- Zéró allokáció a draw-loopban; scratch a konstruktorban.
- Spektrum továbbra sem hajt radius-t; a lencse a *háttérfény képernyő-pozícióját* torzítja,
  nem a cső geometriáját.
- Backend-bővítés csak a T7 keretében, single-agent ownershippel.

## 7. Elvetett / elhalasztott alternatívák

| Alternatíva | Miért nem most |
|---|---|
| WebGL/shader-alapú valódi per-pixel refrakció | Teljes backend/kompozitor-csere, ADR-t igényel; a vektoros warp a look ~80%-át adja nulla architektúra-kockázattal. Ha T5–T6 után is kevés, külön ADR-ben tervezendő. |
| Canvas2D annulus-os self-`drawImage` refrakció | Frame-önmintavételezés a kompozitor-láncban; export/chroma-key/backplate utakkal interferálhat. Csak feature-flag mögötti kísérletként, T5 kiértékelése után. |
| A fal-rács megtartása "sűrűbb ráccsal" | A rács mint olvasat a probléma, nem a felbontása; a referencián nincs él. |

## 8. Kockázatok

| Kockázat | Kezelés |
|---|---|
| Warp + viewport-kilépés: a warpolt pont képernyőn kívülre kerül | a meglévő `viewportVisibility` fade a warpolt ponton fut, nem az eredetin |
| Lencse-középpont ugrása route-kanyarban | `C` a smoothed-lookahead horizont-vetületből jön (már simított); teszt: folytonosság assert |
| A clump-függvény "villog" a spektrumtól | a clump-minta térbeli (theta, advektált depth) — a spektrum csak a fényerőt szorozza, a mintát nem mozgatja |
| Vonalszám-növekedés (kausztika-újramintavétel) | összekötők törlése (−256) fedezi a kausztika-többletet (+~200); budget-assert tesztben |
| Preset-look törés a meglévő családban | T9 explicit áthangolás; `wormholeLens=0` fallback bitre a mai kép |
| Backend-interfész bővítés (T7) töri a teszt-mockokat | a T7 task explicit tartalmazza a mock-frissítéseket és az export/chroma-key út ellenőrzését |
