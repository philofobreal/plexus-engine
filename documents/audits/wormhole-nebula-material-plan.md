# Wormhole Nebula Material terv — SUPERSEDED architecture contract

> **SUPERSEDED (2026-08-19).** A felhasználói követelmény-korrekció visszavonta az önálló,
> lencse-inverzen mintavételezett `(theta, log r)` background-field architektúrát. A Nebula anyag
> hordozója a meglévő foreground grain/head/trail renderút; külön lens-space/background mező nem
> fogadható el. Ez a dokumentum történeti Phase 1/2 feljegyzés, nem aktív implementációs contract.
> Az aktív architecture gate:
> [wormhole-nebula-grain-material-architecture-gate.md](wormhole-nebula-grain-material-architecture-gate.md).

Hatókör: `src/visuals/` (Cosmic Wormhole identitás + renderer backend), `src/config/visualTuning.ts`,
`src/config/identityTuningRegistry.ts`, `src/types/index.ts`, `tests/`.

Előzmény: `wormhole-lens-overhaul-plan.md` (T1-T9 KÉSZ) és `wormhole-true-lens-plan.md`
(F1-F7 KÉSZ, F8 nyitott). Az F1 valódi point-mass lencse-leképezést vezetett be, az F6 pedig
már diagnosztizálta a mostani feladat gyökerét: *"A lencse csak azt tudja megmutatni, ami
létezik"* — a gyűrű-zónában a háttér-alapanyag ~9000 skybox-pont, ~1800 csillag-streak és
9 galaxis-glow, azaz **diszkrét objektumok, nem folytonos mező**.

Ez a terv nem geometriát cserél. A meglévő route-, lencse-, idő- és grain-rendszert
változatlanul hagyja, és **egyetlen új réteget** tesz mellé: egy folytonos, több térbeli
frekvenciájú fény-/sűrűségmezőt, amely a **már meglévő lencse-leképezés analitikus inverzén**
keresztül pontosan ugyanabban a vizuális térben él, mint a lencsézett háttérrétegek.

Státusz: PHASE 1 (architecture gate) lezárva. PHASE 2 W1-W5 KÉSZ (2026-08-19): lencse-inverz
(`WormholeLensWarp.ts`), tuning-kulcsok, pure field modul (`wormholeNebulaField.ts`), renderer
primitív + `CanvasFieldRasterSurface.ts`, és az identitás-bekötés (`CosmicWormholeIdentity.ts`
`drawNebulaField`) mind mergelve, `tsc --noEmit` tiszta, a 12. szakasz teljes regressziós listája
zöld, és egy end-to-end smoke teszt (`wormholeNebulaAmount>0`, valódi `draw()` hívások) is lefutott
hiba/NaN nélkül. A smoke teszt egy valós méretezési hibát is elkapott és javított: a cél-téglalap
eredetileg a lencse sugarából (`NEBULA_COVERAGE_RADIUS_SCALE`) számolódott, ami szélső
`wormholeLensRadius` tuning mellett a vászon többszörösére nőhetett volna -- most a vászon méretéből
(`NEBULA_COVERAGE_FRACTION`) származik. PHASE 3 (W6 vizuális finomítás, W7 regresszió+perf) nyitott;
lásd a "Follow-up notes" szakaszt a fájl végén.

---

## 1. Current state — mit tud ma a Wormhole

### 1.1 Draw-sorrend (`CosmicWormholeIdentity.draw()`, 606-1385)

| # | Stage | Sorok | Primitív | Lencsézett? |
|---|---|---|---|---|
| 1 | clear | 624-630 | `background` | — |
| 2 | modulation + lencse-setup | 632-753 | — | — |
| 3 | skybox plate (9000 sky star, 2 `line`/db) | 755-778, `drawSkybox` 2188-2302 | `line` | igen |
| 4 | galaxisok (9, + előző echo) | 780-894 | `radialGlow` x2 | igen |
| 5 | csillagmező (1800 streak) | 900-1055 | `line` | igen |
| 6 | csillag másodlagos kép (minden 2.) | 1068-1098 | `line` | igen |
| 7 | lens deep field (800 pont) | 1105-1110, `drawLensDeepField` 1394-1448 | `circle` | igen |
| 8 | hue/spectrum resolve | 1112-1120 | — | — |
| 9 | dark-glass vignette | 1127-1136 | `radialDim` | — |
| 10 | annular ring tint | 1142-1147, `drawLensRingTint` 1456-1517 | `compositeRingTint` | — |
| 11 | Einstein maradék-glow (12/4 folt) | 1154-1164, `drawEinsteinRing` 1595-1644 | `radialGlow` | — |
| 12 | fal (membrán / mozaik / kausztika / repedés) | 1169-1182, `drawWall` 1653-1691 | `line` | **nem** |
| 13 | grain field (360 szemcse) | 1189-1383 | `line` | **nem** |

A 3-7. slot a **lencsézett fél**, a 12-13. a **lencsézetlen alagút-belső**.

### 1.2 A lencse (`WormholeLensWarp.ts`)

Zárt alakú point-mass **forward** leképezés (forrás -> kép), 6 exportált tiszta függvény,
nulla allokáció, nem olvas State-et:

```
theta+(beta) = 0.5 * (beta + sqrt(beta^2 + 4*E^2))        // elsődleges kép, mindig >= E
mappedR      = beta + (theta+ - beta) * strength           // strength=0 -> bitre identitás
swirl        : mappedR utáni forgatás, szöge = swirl * min(E^2/beta^2, 6)
```

Öt hívási hely: skybox 2268-2275, galaxis 843-848 + 883-888, csillagok 1019-1030,
deep field 1431-1440; másodlagos kép `wormholeLensSecondaryPoint` 1083-1090.

### 1.3 Idő- és determinizmus-modell

Egyetlen kanonikus óra: `canonicalWormholeTime(State.currentTime, State.isExporting,
State.exportTime)` (608). Egyetlen kanonikus távolság: `travelDistance = travelDistanceAt(timeSec)`
(619), prefix-LUT + authored speed timeline. `Z_REFERENCE = 1000` fix horizont.
Advekció mindenütt `travelDistance / Z_REFERENCE * K + timeSec * K2`.

Valódi akkumulátor csak: `routePath` / `routePathVertical` (`IntegratedWormholeRoute`,
360 mintás history), a grain-enkénti latch-elt `release*` mezők, a transition-pulse id és az
authored speed anchorok. **Minden más frame-enként újraszámolódik a kanonikus időből.**

`src/` egészében **nulla `Math.random()` hívás**; a `frameCount` sehol nem szerepel identitás
döntési útvonalon.

### 1.4 Renderer határ

`VisualRendererBackend` (`RendererBackend.ts`) ma 14 primitívet ad: `background`, `noStroke`,
`noFill`, `fill`, `stroke`, `strokeWeight`, `line`, `circle`, `triangle`,
`beginShape`/`vertex`/`endShape`, `radialGlow`, `radialDim`, `compositeRingTint`.
**Nincs raszter/kép primitív.**

TS-ben egyetlen implementáció van: `P5RendererBackend`. `radialGlow`, `radialDim` és
`compositeRingTint` már ma is a nyers 2D kontextushoz nyúl (`target.drawingContext as
CanvasRenderingContext2D`, `P5RendererBackend.ts:136/147/179`) — azaz **a "számok be, pixelek ki"
escape-hatch primitív már bevett minta a backendben.**

Export/HiDPI seam: `P5RendererBackend.target` (`:24-31`) oldja fel a `__plexusExportTarget`-et;
a backend-primitívek user/CSS px-ben dolgoznak, aktív transzformmal (a post FX ezzel szemben
device px-ben, semlegesített transzformmal — `PostFxTypes.ts:14`).

---

## 2. Problem — miért nem elég a mostani anyag

A referencia-karakter (mély fekete torok, körülötte örvénylő, szálas, több léptékű fényanyag,
kobalt -> violet -> magenta térbeli színmező, lokális near-white csúcsok) **folytonos mezőt**
igényel. A mostani rendszer minden fénye **diszkrét objektum**: pont, streak, glow-folt, vonal.

Ebből három konkrét vizuális hiány következik:

1. **A fényöv pöttysorként olvasódik.** A gyűrű-zóna fényét véges sok streak és glow adja;
   ahol nincs objektum, ott üres a kép. Ezt a `wormhole-true-lens-plan.md` 2.5 már leírta.
2. **Nincs meso-lépték.** Van makro (galaxis-glow, vignette) és van mikro (csillagszemcse), de a
   kettő között — a szálas, csavarodó filamentek szintjén — semmi nincs, pedig vizuálisan
   **ez a réteg hordozza a "nebula" karaktert**.
3. **A korábbi próbálkozás vonalakkal ment.** A membrán/kausztika/repedés rétegek megrajzolt
   vektorobjektumok; a szerzői kiértékelés (2026-07-19) pont ezeket kifogásolta
   ("a *hatást* kell látni, nem a falat"). Ugyanezt a hibát nem szabad megismételni: a meso
   filamenteket **nem** szabad polyline-okkal megrajzolni.

**A hiányzó komponens tehát nem geometria, hanem folytonos, több térbeli frekvenciájú
sűrűség-/fénymező.** A PHASE 1 alaphipotézis megerősítve.

---

## 3. Chosen architecture

### 3.1 A kulcs-belátás: a meglévő lencsének van zárt alakú inverze

Egy raszterizált mező pixelenként a **fordított** kérdést teszi fel, mint egy pont-réteg:
"ennek a cél-pixelnek melyik forrás-koordináta felel meg?". Ehhez a lencse **inverze** kell.
A repóban ma nincs inverz (`WormholeLensWarp.ts` mind a 6 exportja forward), **de zárt alakban
levezethető** — és numerikusan igazolt:

```
R = a*beta + b*sqrt(beta^2 + 4E^2)          ahol a = 1 - s/2, b = s/2, a + b = 1
=> (1-s)*beta^2 - 2*a*R*beta + (R^2 - 4*b^2*E^2) = 0
s = 1 esetén elfajul:  beta = R - E^2/R
```

Numerikus ellenőrzés (round-trip forward -> inverz, E=120, beta 0.5..900 px):

| strength | max round-trip hiba |
|---|---|
| 0.25 | 1.0e-12 px |
| 0.50 | 4.5e-13 px |
| 0.75 | 4.5e-13 px |
| 1.00 | 1.1e-13 px |

Két fontos következmény:

- **A swirl nem rontja el az inverzet.** A swirl a radiális skálázás *után* alkalmazott forgatás,
  a forgatás pedig sugártartó — ezért `beta = radialInverse(R)` swirl mellett is *pontos*, és a
  forrás-azimut `= kép-azimut - swirlAngle(beta)`, iteráció nélkül. (Az AUDITOR A által jelzett
  fixpont-iteráció csak az azimut-függő `perturbedLensRadius` ±8%-os falhullám-perturbációra
  vonatkozna; azt a forward kód is a *kép-térbeli* `atan2` szöggel indexeli —
  `CosmicWormholeIdentity.ts:1014` —, így a mező ugyanezt teszi, és marad konzisztens a meglévő
  rétegekkel.)
- **A torok magától sötét marad.** `E` sugáron belül (`R < E`) `beta` előjelet vált, `R -> 0`
  esetén `|beta| -> végtelen`: a középponti pixelek a mező **tetszőlegesen távoli** részét
  mintavételezik. Egy sugárban lecsengő burkolóval ez automatikusan mély fekete torkot ad,
  nem külön kézzel rajzolt maszkot. (Ellenőrzés: E=120, R=60 -> beta = -180; R=E -> beta = 0.)

Ez a terv gerince: **a Nebula nem kap saját warp-geometriát. A meglévő lencse inverzén ül.**
Ezzel a PHASE 4 acceptance criterion 9 ("a lencse és a Nebula vizuálisan ugyanahhoz a térhez
tartozik") nem közelítés, hanem matematikai azonosság.

### 3.2 A második kulcs-belátás: naiv per-pixel zaj nem fér bele

Mért adat (Node, ugyanaz a gép; 7 zaj-oktáv/pixel + domain warp + paletta):

| felbontás | naiv per-pixel zaj | 60fps budget |
|---|---|---|
| 320x180 | 7.71 ms | 46% |
| 480x270 | 16.28 ms | 98% |
| 640x360 | 30.34 ms | 182% |
| 1920x1080 | 290.42 ms | 1742% |

**~133 ns/px** — ez egybevág az AUDITOR B független becslésével (80-150 ns/px integer hash-sel).
Ezen az úton a használható felbontás ~192x108, ami a meso filamentekhez kevés.

Megoldás: **a zaj ne frame-enként számolódjon.** A wormhole mozgása lencse-lokális polárban
lényegében kétirányú scroll: a radiális travel a `log r` tengelyen, a swirl a `theta` tengelyen
csúszik. Ezért a mező **egyszer** előszámolható egy toroidális `(theta, log r)` atlaszba, és
frame-enként már csak mintavételezni kell.

Három szint:

1. **Statikus geometria-LUT** (csak raszter-méret változáskor épül): pixelenként `radiusBucket`
   (Uint16) és `angleIndex` (Float32). Se `atan2`, se `sqrt` frame-enként.
2. **Frame-enkénti 1D radiális LUT** (1024 bejegyzés): lencse-inverz, swirl-eltolás,
   magnifikáció, core-maszk. Ez frame-enként 1024 kiértékelés — elhanyagolható.
3. **Per-pixel**: 2 tömb-olvasás + 3 bilineáris atlasz-minta + paletta + 4 írás.

Mért adat ugyanezen a gépen:

| felbontás | LUT + atlasz | 60fps budget | ns/px |
|---|---|---|---|
| 320x180 | 1.32 ms | 7.9% | 23.0 |
| 480x270 | 2.62 ms | 15.7% | 20.2 |
| 640x360 | 4.60 ms | 27.6% | 20.0 |
| 960x540 | 9.35 ms | 56.1% | 18.0 |

**~6.6x gyorsulás**, és ezzel 480x270 (2.6 ms) a normál mód reális célja, 640x360 az export/high
tier. Egyszeri költségek: geometria-LUT 640x360-ra 2.3 ms (csak resize-kor), atlasz-építés
512x256-ra 34.5 ms (csak seed/tuning változáskor), memória 0.25-1.0 MB (Uint8 atlasz).

### 3.3 A harmadik belátás: a lencse-középpont ne legyen a LUT-ban

A lencse középpontja frame-enként mozog a route-tal. Ha a geometria-LUT abszolút képernyő-
koordinátákra épülne, minden frame-ben újra kellene építeni (2.3 ms). Ehelyett a raszter
**lencse-centrikus**: a LUT a *raszter saját közepére* épül, és a blit cél-téglalapja tolódik a
lencse-középponttal (`dstX = lensCenterX - dstW/2`). A LUT így lencse-pozíció-invariáns, a
mozgás pedig ingyen van.

### 3.4 Multi-scale bloom global blur pass nélkül

A mező-kitöltő ciklus **egy menetben** három puffert tölt:

```
L0  teljes raszter (pl. 480x270)   -> sharp filament + micro detail
L1  L0/4 (120x68)                   -> medium bloom (csak a küszöb feletti fényes anyag)
L2  L0/16 (30x17)                   -> large haze
```

A blit három `drawImage`-dzsel megy, mindegyik a **teljes** cél-téglalapra,
`imageSmoothingEnabled = true` mellett — a kis pufferek bilineáris felnagyítása *maga a blur*,
ingyen, GPU-n. Kompozíció: L2 és L1 `lighter`, L0 `source-over`/`screen`.

Ez pontosan a brief 15. pontja: nincs egyetlen globális blur pass, a bloom forrása a fényes
material field, és a sharp pass külön marad. `ctx.filter` nem kell (a repóban ma sehol nem
használt), így nincs böngésző-verziófüggő kimenet, és `p5.Graphics`-en (export) is azonos.

Megjegyzés: az ADR-006 `lighter`-tilalma (`architecture-contract.md:76`) az **identitás-csere
kompozitálására** vonatkozik, nem egy identitás saját rajzán belüli keverésre.

### 3.5 Modul-térkép

```
CosmicWormholeIdentity                    (orchestration only)
        |
        +-- meglévő geometria / route / grain / star / lens        [VÁLTOZATLAN]
        |
        +-- wormholeNebulaField.ts        (PURE math, no canvas, no typed array at module scope)
        |        buildNebulaAtlas(...)       (seed + tuning -> atlasz)
        |        buildNebulaGeometryLut(...) (méret -> LUT)
        |        updateNebulaRadialLut(...)  (idő + lencse-állapot -> 1D LUT)
        |        fillNebulaRaster(...)       (LUT + atlasz -> L0/L1/L2 float pufferek)
        |
        v
VisualRendererBackend                     (+2 új primitív)
        |
        v
P5RendererBackend -> CanvasFieldRasterSurface.ts   (RENDERER-OWNED buffers + blit)
```

---

## 4. Data flow

```
canonicalWormholeTime(State.currentTime, isExporting, exportTime)   -> timeSec
travelDistanceAt(timeSec)                                           -> travelDistance
lensCenterX/Y, lensRadiusPx, lensStrength, lensSwirl (draw 710-732)  -> lencse-állapot
State.modulation / motion profile (draw 636-648)                     -> bounded audio moduláció
tuning.wormholeNebula{Amount,Detail,Bloom}                           -> mesterek
        |
        v
[1] atlasz cache-check  (seed + detail változott? -> újraépít, különben újrahasznál)
[2] geometria-LUT cache-check (raszter-méret változott? -> újraépít)
[3] updateNebulaRadialLut(timeSec, travelDistance, E, strength, swirl)   ~1024 iteráció
[4] backend.beginFieldRaster(layer, cols, rows)  -> renderer-owned Float32Array, vagy null
[5] fillNebulaRaster(...)                        -> L0 + L1 + L2 kitöltés egy menetben
[6] backend.drawFieldRaster(layer, dst..., gain, blend) x3
```

Beszúrási pont: **slot 7 után, slot 9 előtt** (`CosmicWormholeIdentity.ts` ~1110, közvetlenül a
`drawLensDeepField` után). Indoklás:

- A lencsézett fél végén van, tehát a lencsézett háttérrétegekhez tartozik.
- A vignette (`radialDim`, 1127) **utána** fut, tehát tompítja a torok környékén — ez a mély
  core-t erősíti, nem rontja.
- A ring tint (1142) és az Einstein-glow (1154) is utána fut, tehát a Nebulára is rákerülnek —
  a rétegek vizuálisan összekapcsolódnak.
- A fal (12) és a grain (13) elé kerül, tehát az előtér-anyag a Nebula *előtt* marad.

---

## 5. Ownership

| Felelősség | Tulajdonos | Tilos |
|---|---|---|
| mező matematika (zaj, warp, ridge, paletta, maszkok) | `wormholeNebulaField.ts` | canvas, ctx, p5, DOM, State, render target |
| atlasz/LUT tartalom | `wormholeNebulaField.ts` | typed array **modul-szinten** (lásd 9.2) |
| raszter puffer, ImageData, offscreen canvas, blit, resize | `CanvasFieldRasterSurface.ts` (renderer) | mező-matematika |
| primitív-szerződés | `RendererBackend.ts` | identitás-specifikus fogalom a szignatúrában |
| beszúrás, tuning-olvasás, lencse-állapot átadás | `CosmicWormholeIdentity` | zaj-implementáció, pixel-ciklus, canvas-életciklus, bloom-algoritmus |
| lencse-inverz | `WormholeLensWarp.ts` (új export) | identitásban újraimplementált inverz |

Az `identityOwnedTuningKeys['cosmic-wormhole']` bővül a 3 új kulccsal
(`identityTuningRegistry.ts:37` után).

---

## 6. Renderer contract — a két új primitív

```ts
// RendererBackend.ts, a VisualRendererBackend interfészbe
/** Renderer-owned, reused RGBA float scratch for one field layer. Null when the backend
 *  refuses the request (too large, or no raster capability). The identity fills it and must
 *  not retain it beyond the matching drawFieldRaster call. */
beginFieldRaster(layer: 0 | 1 | 2, cols: number, rows: number): Float32Array | null;

/** Blits the layer filled by the matching beginFieldRaster into the destination rect, in the
 *  same user/CSS pixel space every other primitive uses. */
drawFieldRaster(
    layer: 0 | 1 | 2,
    dstX: number, dstY: number, dstW: number, dstH: number,
    gain: number,
    blend: 'source-over' | 'screen' | 'lighter'
): void;
```

Szerződéses döntések és indoklásuk:

- **RGBA float, nem skalár + backend-oldali paletta.** A színmező művészi döntés, tehát az
  identitáshoz tartozik; a renderer csak konvertál és blittel. Skalár + backend-paletta esetén a
  paletta renderer-policy lenne — rossz ownership.
- **A backend `cols*rows`-t felső korláttal vágja** (pl. `<= 640*360`), így egy identitás nem
  kérhet 1080p per-pixel JS-t.
- **User/CSS px cél-téglalap, aktív transzform** — ez a *backend* konvenciója (`radialDim`
  `fillRect(0, 0, target.width, target.height)`, `P5RendererBackend.ts:159`), nem a post FX
  device-px konvenciója. Így dpr=2 és 4K export egyaránt magától helyes: a forrás-raszter kicsi,
  a felnagyítást a GPU végzi.
- **`ctx.save()` / `finally { ctx.restore(); }`**, `imageSmoothingEnabled` és
  `globalCompositeOperation` visszaállítással — a `compositeRingTint` mintája
  (`P5RendererBackend.ts:200-216`). A `radialGlow` fill-cache hibáját (nyers `ctx.fillStyle`
  írás a memoizált fill-állapot érvénytelenítése nélkül) **nem** szabad megismételni.

---

## 7. Field model

### 7.1 Koordináta-lánc

```
cél-pixel (raszter-lokális, lencse-centrikus)
    -> R = radiusBucket -> 1D LUT
    -> beta = lensRadialInverse(R, E, strength)          [zárt alak, 3.1]
    -> forrás-azimut = angleIndex - swirlAngle(beta)
    -> (u, v) = (azimut, log|beta| * radialScale + travelOffset)   toroidális atlasz-koordináta
    -> 3 bilineáris minta különböző léptéken és scroll-sebességgel
    -> maszkok (core, annular, magnifikáció)
    -> spatial palette -> RGBA
```

### 7.2 Három struktúra-szint

| szint | forrás | lépték | mozgás |
|---|---|---|---|
| **Macro** — haze, luminozitás-clump, kék/lila energiaeloszlás | atlasz A, 0.35x lépték | lassú | leglassabb radiális scroll + enyhe swirl |
| **Meso** — filament, ridge, csavarodó fényöv, szakadozott energiafolyam | atlasz A, 1.0x lépték, **ridged** (`1-|2n-1|`, négyzetezve) | közepes | közepes radiális + teljes swirl |
| **Micro** — szemcsézettség, 1-4 px luminancia-struktúra, apró szakadás | atlasz B, ~1:1 texel-sűrűség | finom | leggyorsabb |

Az atlasz **toroidális** mindkét tengelyen: a `theta` tengely periódusa pontosan egy teljes
körülfordulás (fizikailag helyes, nem artefakt), a `log r` tengelyé pedig úgy skálázandó, hogy
egy periódus a látható sugártartománynál nagyobb ratiót fedjen — különben radiális sáv-ismétlődés
látszik. **Ez a periodicitás a Phase 3 vizuális finomítás első ellenőrzendő pontja.**

Aliasing-figyelmeztetés: a micro réteget **nem** szabad az A atlaszból nagy léptékfaktorral
mintavételezni (undersampling -> mozaik-hatás, amit a brief kifejezetten tilt). Külön B atlasz
kell, a saját frekvenciatartalmával, ~1:1 texel-sűrűségen.

### 7.3 Mozgás

Legalább három komponens, ahogy a brief kéri:

- **radial travel**: `travelDistance / Z_REFERENCE` -> a `log r` tengely scrollja
  (ugyanaz az advekciós konvenció, mint a deep field 1411-1412 és a wall 1768)
- **angular swirl**: a lencse `swirl` + egy lassú, kanonikus időből származó azimut-drift
- **slow domain warp**: az atlaszba **beépítve** (építéskor domain-warpolt koordinátán generált),
  plusz egy nagyon lassú, alacsony frekvenciás futásidejű eltolás a mintavételi koordinátán

Nem forgó textúra: a radiális és azimutális komponens léptékenként **eltérő sebességű**, ami
parallaxist és folyamatos átrendeződést ad.

### 7.4 Spatial palette

Nem az audio határozza meg a színt. A paletta térbeli:

```
base (deep blue -> cobalt -> violet -> magenta)
  + azimutális variáció (a forrás-azimutból)
  + radiális/mélységi variáció (log|beta|-ból)
  + lassú determinisztikus variáció (kanonikus időből)
  + bounded audio moduláció (exponáltság/telítettség, ±korlátos)
```

Near-white lokális csúcs: a kimeneti luminanciára alkalmazott felső, telítődő görbe
(`e^2` és `e^4` tag keverése), így csak a legfényesebb anyag megy fehérbe.
Az audio **modulál**, nem randomizál.

---

## 8. Determinism

A mező elvi állapota:

```
F(canonicalTime, seed, tuning, lensState, travelDistance, publishedModulation)
```

Garanciák és hogyan érvényesülnek:

| Követelmény | Mechanizmus |
|---|---|
| nincs `previousFrame` függés | a radiális LUT minden frame-ben nulláról épül a kanonikus időből |
| nincs `frameCount` függés | `frameCount` nem szerepel a mező egyetlen bemenetében sem; a `performance-optimizations.test.mjs:77` tiltása így teljesül |
| nincs `deltaTime` akkumuláció | `travelDistance` prefix-LUT-ból jön, nem integrálásból |
| nincs `Math.random()` | integer avalanche hash (`Math.imul`), a `temporalFragmentationPlan.ts:245` `hash32`/`unit` stílusában; a `sin`-alapú `pseudoNoise` duplikátumok **nem** használandók (túl lassúak, precíziós kockázat) |
| seek ugyanarra az időre ugyanaz | az atlasz seed+tuning függvénye, a scroll a kanonikus idő függvénye |
| live == export | `canonicalWormholeTime` már ma kezeli az `exportTime`-ot; a mező semmi mást nem olvas |
| FPS-független | nincs frame-enkénti integrálás |

Az atlasz cache **nem** állapot a determinizmus értelmében: tartalma tisztán `(seed, detail,
atlaszméret)` függvénye, tehát újraépítve bitre ugyanaz. A cache csak költséget spórol.

---

## 9. Constraints discovered in the audit (kötelező betartani)

### 9.1 A test-mockok duck-typed JS objektumok

15 teszt kézzel írt `VisualRendererBackend` mockot használ (`renderer-boundary`,
`styles-deterministic`, `wormhole-long-run`, és 12 további `wormhole-*`). **Egyik sem
ellenőrzi strukturálisan a teljes interfészt** — tehát új metódus csak akkor töri őket, ha
ténylegesen meghívódik. `wormholeNebulaAmount = 0` alapértéknél a hívás sosem történik meg,
így **a meglévő mockokat nem kell módosítani**. TS-ben egyetlen implementor van
(`P5RendererBackend`), azt kötelező bővíteni.

### 9.2 A vm-sandboxok nem ismerik a `Float32Array`-t

A tesztek saját in-file TS-loadert használnak `vm.runInNewContext`-tel, kézzel felsorolt
globálokkal. Konkrétan:

- `wormhole-long-run.test.mjs:36-38`: `Math, Number, Array, Object, Map, Set, Uint16Array, Float64Array`
- `wormhole-lens-integration` / `wormhole-deep-field`: `... Uint16Array, Float64Array, Uint8Array`
- `wormhole-determinism.test.mjs:26-28`: csak `Math, Number, Float64Array`

**`Float32Array` és `Uint8ClampedArray` egyikben sincs.** Ezért:

- `wormholeNebulaField.ts` **nem allokálhat typed array-t modul-szinten** (a modul-törzs
  import-kor lefut, tehát azonnal `X is not defined`-ot dobna ~12 wormhole tesztben).
- Minden typed array a renderer-oldali `CanvasFieldRasterSurface.ts`-ben él, amit ezek a tesztek
  soha nem töltenek be.
- Az új Nebula-teszt saját sandbox-listát visz, benne `Float32Array`-jel.

### 9.3 Draw-call-szám lezárva

`wormhole-long-run.test.mjs:169` pontos egyenlőséget vár (`lines.length === STAR_SAMPLE_SIZE`),
`:296` pedig route `sample()` <= 64-et. A Nebula nem hívhat `line()`-t és nem mintavételezhet
route-ot; alapból kikapcsolva ez triviálisan teljesül.

### 9.4 Source-text szerződések a `draw()` törzsére

`wormhole-long-run.test.mjs:298-301` kivágja a `draw()` törzsét és tiltja benne a
`new IntegratedWormholeRoute` / `createRouteFrame()` mintát; `wormhole-determinism.test.mjs`
további `assert.match` / `doesNotMatch` szerződéseket tart. Az új stage nem allokálhat a
`draw()`-ban és nem hozhat vissza tiltott azonosítót.

---

## 10. Tuning

Három kulcs, a brief 18. pontja szerint:

| kulcs | jelentés | default |
|---|---|---|
| `wormholeNebulaAmount` | mester intenzitás; 0 = teljes bypass, legacy viselkedés | **0** |
| `wormholeNebulaDetail` | meso/micro struktúra súlya és raszter-minőségi tier | 0.5 |
| `wormholeNebulaBloom` | L1/L2 bloom rétegek erőssége | 0.5 |

Regisztrációs checklist (AUDITOR C nyomán, forrás-ellenőrzött):

1. `src/types/index.ts:179` — 3 mező a `VisualTuningConfig`-ba, doc-kommenttel.
2. `src/config/visualTuning.ts:108` — 3 default a `defaultVisualTuning`-ba.
   (`visualTuningKeys` = `Object.keys(defaultVisualTuning)`, származtatott, nem kell külön lista.)
3. `src/config/visualTuning.ts:330` — 3 control-bejegyzés `group: 'Wormhole'`, a
   `wormholeWall` (`:270-275`) mintájára. **Ez teszi a kulcsot bounded / morphable /
   preset-serializable / resolver-clamped-dé.**
4. `src/config/identityTuningRegistry.ts:37` — 3 kulcs a `'cosmic-wormhole'` tömbbe.
5. `tests/wormhole-clip-profile.test.mjs:70-102` — a hardcode-olt `WORMHOLE_TUNING_KEYS`
   tömb bővítése (sorrend-érzékeny `assert.deepEqual` a `:185`-nél). **Ez az egyetlen
   kimerítő kulcslista-assert a repóban.**
6. `tests/wormhole-clip-profile.test.mjs:103-105` — mindhárom kulcs a
   `WORMHOLE_USER_GLOBAL_KEYS`-be (a `wormholeOpticsEnabled` tier-je). Ez **megtiltja**, hogy a
   10 `vos-wh-*.json` factory preset authorálja őket — MVP-ben pont ezt akarjuk: nulla
   preset-fájl churn, és a Nebula opt-in marad.

**Nem kell** módosítani: preset szerializáció/copy-config (generikus, `DashboardUI.ts:2296-2314`),
tuning UI (metadata-vezérelt, `TuningController.ts:99-127`), `normalizeVisualTuningConfig`
(generikus), `SemanticRuntimeAdapter` (származtatott), `state/store.ts` (klónozott default).
A morph snap-lista (`visualTuning.ts:562-566`) **sem** — mindhárom kulcs folytonos.

`src/semantics/motifResolver.ts`: **nincs delta-bejegyzés.** ADR-007 precedens
(`architecture-contract.md:107-109`): a control-listában való jelenlét érvényessé és clampeltté
teszi a kulcsot, de nem teszi szemantikailag birtokolttá. A `STYLE_DELTAS`-ba **ne** kerüljön be.

### LFO interakció

A Radius/Depth LFO ma **release-sampled** grain-geometriát vezérel: az LFO értéke a generációs
átlépéskor egyszer mintavételeződik és befagy (`snapshotGrainGeometry`, 2113-2134), amitől az
LFO haladó hullámfrontként olvasódik. Egy élő, folyamatos Nebula-geometria-pulzálás **kétféle
idő-szemantikájú geometriát** hozna egy képbe — ez tilos.

MVP-ben a Nebula LFO-reakciója ezért **enyhe és csak anyagi**: sűrűség / fényerő moduláció,
geometria nem. (Analógia: `LIVE_GRAIN_SHIMMER = 0.88`, ami szintén csak anyagot modulál.)

---

## 11. Performance strategy

**Quality tier-ek** (a mező matematikája tier-től független; csak a rasterizáció pontossága
változik):

| tier | L0 raszter | mért L0 költség | megjegyzés |
|---|---|---|---|
| Performance (`performanceMode >= 0.5`) | — | 0 | **teljes bypass**, mint `PostFxPipeline.ts:46` |
| Normal | 480x270 | 2.6 ms | alapértelmezett |
| High / export | 640x360 | 4.6 ms | |

L1 (1/16 px) és L2 (1/256 px) költsége elhanyagolható; a három blit GPU-oldali.

**Erőforrás-életciklus** (a `CanvasPostFxSurface` mintája, `:78-89`):

1. minden bypass-guard az allokáció *előtt* (amount == 0, performanceMode, paused/stopped);
2. lusta allokáció az első ténylegesen aktív frame-en, soha nem frame-enként;
3. resize kizárólag valódi dimenzióváltozáskor, a cache-elt 2D kontextus nullázásával;
4. allokáció/resize számlálók a tesztelhetőséghez;
5. injektálható canvas factory (DOM-opcionális);
6. minden írás `save()` / `setTransform` / `restore()` közé;
7. újrahasznált mutable objektum visszaadása, amit a hívó nem tarthat meg.

Egyszeri költségek: geometria-LUT 2.3 ms (resize), atlasz 34.5 ms @512x256 (seed/detail
változás). Memória: atlasz 0.25-1.0 MB (Uint8) + L0/L1/L2 float pufferek (480x270 RGBA float
= 2.07 MB; Uint8-ra váltható, ha a mérés indokolja).

**Kikapcsolt állapotban nulla**: se atlasz, se LUT, se puffer, se blit.

---

## 12. Tests

Új tesztfájl: `tests/wormhole-nebula-field.test.mjs` (saját vm-sandbox `Float32Array`-jel).

| Csoport | Amit bizonyít |
|---|---|
| lencse-inverz | round-trip `forward(inverse(R)) == R` 1e-9 alatt, strength 0/0.25/0.5/0.75/1; `strength=0` bitre identitás; `R < E` -> negatív beta (másodlagos ág); `R == E` -> beta == 0 |
| determinizmus | azonos `(timeSec, seed, tuning, lensState)` -> bitre azonos raszter; live vs export azonos; seek-reprodukció |
| FPS-függetlenség | 30/60/120 fps-en ugyanaz az állapot ugyanazon a song-time-on |
| numerikus biztonság | nincs NaN/Infinity a raszterben szélsőséges lencse-paramétereknél (E=0, strength=0/1, beta->0) |
| randomness-tilalom | forrás-assert: nincs `Math.random` / `Date.now` / `performance.now` / `frameCount` a modulban |
| erőforrás-életciklus | lusta egyszeri allokáció, resize csak dimenzióváltáskor, disabled -> nulla allokáció (számlálókkal) |
| disabled equivalence | `wormholeNebulaAmount = 0` -> a backend egyetlen field-hívást sem kap |
| tuning contract | a 3 kulcs bounded, default 0/0.5/0.5, nincs `STYLE_DELTAS` bejegyzés |

Meglévő, kötelezően frissítendő: `tests/wormhole-clip-profile.test.mjs` (10. szakasz 5-6. pont).

Regressziós futtatás Phase 3-ban: `wormhole-determinism`, `wormhole-long-run`,
`wormhole-lens-integration`, `wormhole-lens-warp`, `wormhole-deep-field`, `wormhole-einstein-ring`,
`wormhole-depth-integrity`, `wormhole-route-geometry`, `wormhole-cosmic-sync`,
`wormhole-lifecycle`, `wormhole-motion-profile`, `wormhole-projected-motion`,
`wormhole-preset-*`, `wormhole-wall-*`, `styles-deterministic`, `renderer-boundary`,
`postfx-fragmentation`, `visual-mode-transition`, `morphing`, `semantics`,
`performance-optimizations`, `stream-profiles`, `export-deterministic`.

Egy fájl futtatása: `node --test tests/wormhole-determinism.test.mjs`
(a `wormhole-long-run` a leglassabb, azt hagyd a végére).

---

## 13. Rejected alternatives

| Alternatíva | Miért elutasítva |
|---|---|
| **Particle/grain count drasztikus növelése** | a hiány nem mennyiségi, hanem strukturális: diszkrét objektumokból nem lesz folytonos mező, akárhány van; a brief kifejezetten tiltja |
| **Sok `radialGlow` folt** | `radialGlow` gradienst allokál hívásonként (`P5RendererBackend.ts:137`); 1080p lefedéshez ~150-250 hívás, 8-40 ms/frame + GC; és csak foltokat ad, nem több-oktávos struktúrát |
| **Meso filamentek polyline-ként** | ez pontosan az a "megrajzolt vonal" olvasat, amit a szerzői kiértékelés (2026-07-19) elutasított a kausztika-spirálnál |
| **Naiv per-pixel többoktávos zaj** | mérve 133 ns/px -> 480x270 = 98% frame budget (3.2 szakasz) |
| **`sin`-alapú `pseudoNoise` újrahasználata** | 5x duplikált a repóban, `sin`-enként ~12 hívás/px, ~300-600 ns/px, precíziós kockázat nagy argumentumon |
| **Új renderer seam az identitás-rajz elé/közé** | ADR-007 szerint a post seam identitás-független; egy identitás-specifikus pre-seam `State.visualMode` elágazást követelne a rendererben (tiltva, `architecture-contract.md:63`), és ADR-006 crossfade alatt nem fadeelne az identitásával |
| **Wormhole material PostFX-ként** | ugyanaz: identitás-specifikus, és a post chain a kész képen fut, tehát a fal/grain elé nem lehetne rétegezni |
| **WebGL / p5 shader** | a teljes downstream `drawingContext`-et `CanvasRenderingContext2D`-nek castolja (`P5RendererBackend.ts:136`, `P5RenderTargetCompositor.ts:39`, `CanvasPostFxSurface.ts:58-60`); WEBGL canvason nincs `createRadialGradient`, a crossfade és a post chain törne, az export target is migrálna. Nagyságrenddel a hatókörön kívül |
| **`ctx.filter = 'blur()'` bloomra** | a repó első `ctx.filter` függése lenne, böngésző-verziófüggő kimenettel; a downscale/upscale `drawImage` lánc determinisztikusabb és olcsóbb |
| **Skalár raszter + backend-oldali paletta** | a paletta művészi döntés; backendbe téve renderer-policy lenne, rossz ownership |
| **Abszolút képernyő-koordinátás geometria-LUT** | a mozgó lencse-középpont miatt frame-enkénti 2.3 ms újraépítést követelne (3.3 szakasz) |
| **Temporal Fragmentation / mozaik-fal erősítés** | a brief kifejezetten tiltja; más problémát old meg |

---

## 14. Implementation work packages

| WP | Név | Függ | Tulajdonos | Tartalom |
|---|---|---|---|---|
| **W1** | Lencse-inverz | — | single | `wormholeLensUnwarpRadius(R, E, strength)` + `wormholeLensUnwarpPoint(...)` a `WormholeLensWarp.ts`-be, a meglévő zero-alloc `out` szerződéssel. Teszt: round-trip a forward ellen. **Önmagában is értékes, önállóan mergelhető.** |
| **W2** | Tuning-kulcsok | — | single | 10. szakasz 1-6. pont. Viselkedés-változás nélkül (default 0). |
| **W3** | Pure field modul | W1 | FIELD ENGINEER | `wormholeNebulaField.ts`: hash, toroidális value noise, atlasz-építés, geometria-LUT, radiális LUT, raszter-kitöltés (L0/L1/L2), spatial palette. **Nulla typed array modul-szinten (9.2).** Headless unit-tesztek. |
| **W4** | Renderer primitív + surface | W2 | RENDERER ENGINEER | `RendererBackend.ts` +2 metódus, `P5RendererBackend` implementáció, új `CanvasFieldRasterSurface.ts` a `CanvasPostFxSurface` életciklus-mintájára. Renderer-tesztek (lusta alloc, resize, restore). |
| **W5** | Identitás-bekötés | W3, W4 | INTEGRATION OWNER | beszúrás a ~1110-es slotba, cache-vezérlés, lencse-állapot átadás, bypass-guardok. Csak orchestration. |
| **W6** | Vizuális finomítás | W5 | INTEGRATION OWNER | periodicitás, micro-aliasing, core-mélység, paletta-koherencia, bloom/sharp arány, lencse-illeszkedés. |
| **W7** | Regresszió + perf | W6 | validation | 12. szakasz teljes lista, disabled equivalence, mért perf-profil. |

W3 és W4 **párhuzamosítható** (nincs közös fájl: W3 tiszta matematika, W4 renderer).
W1 és W2 is párhuzamos. W5 utána, egyetlen tulajdonossal.

Kifejezetten **nem** része az MVP-nek: görbült streakek (brief 28.), per-preset Nebula-hangolás
(factory tier promóció), WebGL, echo/history rétegek.

---

## 15. Follow-up notes (Phase 2 close-out, 2026-08-19)

W1-W5 mind mergelve. `npx tsc --noEmit` tiszta; a 12. szakasz teljes regressziós listája
(`wormhole-*`, `renderer-boundary`, `styles-deterministic`, `postfx-fragmentation`,
`visual-mode-transition`, `morphing`, `semantics`, `performance-optimizations`, `stream-profiles`,
`export-deterministic`) zöld, a `wormhole-long-run` 30 perces harness-t is beleértve. Egy dedikált
end-to-end smoke teszt (`wormholeNebulaAmount=0.8`, `wormholeOpticsEnabled=1`, valódi
`identity.draw()` hívások öt egymást követő frame-en) is lefutott: nincs kivétel, nincs NaN/Infinity
a kitöltött rasztereken, és a `backend.drawFieldRaster` valóban megkapja mindhárom réteget.

**Egy valós hiba, amit csak ez a smoke teszt kapott el** (a 12. szakasz meglévő tesztjei mind
`wormholeNebulaAmount=0` mellett futnak, tehát a pozitív útvonalat sosem gyakorolják): a Nebula
cél-téglalapja eredetileg a lencse képernyő-terű sugarából (`lensRadiusPx * 7`) számolódott, ami
alap `wormholeLensRadius=0.5` tuning mellett is a vászon kétszeresére nőtt (1280x720 vásznon
2570x1446 dst-rect). Javítva: a cél-téglalap most a vászon méretéből (`NEBULA_COVERAGE_FRACTION =
1.2`) származik, a raszter-lokális Einstein-sugár pedig ebből számolt olcsó per-frame arány, nem
rögzített konstans. Lásd `CosmicWormholeIdentity.ts`'s `drawNebulaField` doc-kommentjét.

**Egy Phase 1 alapfeltevés tévesnek bizonyult, de ártalmatlanul.** A 9.2 szakasz "load-bearing"
korlátja -- hogy a `vm.runInNewContext` sandboxok hiányzó `Float32Array`/`Uint8ClampedArray` miatt
eldobnának egy typed array konstrukciót -- empirikusan **nem igaz** erre a mechanizmusra: egy új
V8-kontextus mindig hordozza a szabvány ECMAScript intrinsic-eket (typed array-ekkel együtt) a
sandbox-objektumba explicit felsorolt globálisoktól függetlenül (`vm.runInNewContext('new
Float32Array(4).length', { Math, Number })` sikeresen visszaadja a 4-et). Ez azt jelenti, hogy a
W3 modul (`wormholeNebulaField.ts`) plain `number[]`-alapú atlasz/LUT reprezentációja **szigorúbb
volt, mint amit a sandbox ténylegesen megkövetelt** -- nem hibás, csak a doc saját indoklása
pontatlan volt. Gyakorlati következmény: a plain array-alapú belső reprezentáció valószínűleg
lassabb, mint a terv 3.2 szakaszában mért ~20ns/px typed-array-alapú budget (a W3 agent saját mérése
szerint az atlasz-építés maga ~67-71ms volt sima Node-ban, kb 2x a tervezett 34.5ms). **W7 (perf
validáció) kifejezetten mérje meg**, hogy a jelen implementáció tartja-e a 480x270 normál tier ~2.6ms
frame-budget-et; ha nem, a `wormholeNebulaField.ts` belső LUT/atlasz reprezentációja biztonságosan
átállítható typed array-ekre (a fenti méréssel igazoltan), mivel a valódi korlát csak arra
vonatkozik, hogy a modul *ne* legyen a sandboxban azonnal, betöltéskor hibát dobó módon
típusos-tömb-függő -- amit a jelenlegi kód mindenképp betart típusannotációkkal, `new` hívás nélkül.

Nyitva marad: **W6** (periodicitás/micro-aliasing/core-mélység/paletta-koherencia/bloom-arány/
lencse-illeszkedés vizuális finomítása -- ehhez tényleges renderelt kép szükséges, amit ez a
munkamenet nem tudott előállítani) és **W7** (teljes perf-profil mérés, a fenti tétel plusz a
12. szakasz "disabled equivalence" tételének explicit, dedikált tesztje -- a jelen smoke teszt ezt
csak ad-hoc igazolta, nem regressziós tesztként).
