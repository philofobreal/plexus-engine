# XR ritmusjáték — 2. fejlesztési kör terve

Hatókör: `src/xr/`, `src/gameplay/`, `src/visuals/WormholeCanvasSource.ts` (és az új worker-adapter),
`src/types/CanvasVisualSource.ts`, `src/config/xrWormholeTuning.ts` (csak az XR-host szerzői
Wormhole-értékei, R és T kiegészítés), ADR-009 kiegészítések, `tests/`.

Érintett tulajdonosok (AGENTS.md): gameplay (`src/gameplay/`), XR runtime/scene/UI (`src/xr/`),
visuals és worker (`src/visuals/` Wormhole-adapter + render worker, `src/types/` szerződések),
config (`src/config/xrWormholeTuning.ts`), docs. Az audio, az analyzer, a `State` és a dashboard /
MVP host nem érintett.

Előzmény: a 2026-09-27-i redesign (drawer, track path, game settings, section callout, 2.5D
Wormhole) után a szerzői kérések (2026-10-03): hátrébb álló játékos, dramaturgiai pontozás és
szerkezetkijelzés, gyorsabb/távolabbról érkező célpontok, nagyobb (magasabb) játéktér, hosszabb
kard, olcsóbb Wormhole-háttér, VR-ben is elérhető menü, pályán érkező szakaszkapuk, új
kockadizájn, Ultra fokozat, hosszabb pálya.

Munkamód: egyszerre egy task, utána megállás és kézi Quest-ellenőrzőlista. Tervezési jóváhagyás
(design gate) a T2, a T7 és a T10 előtt. Az alapbeállításokkal generált chart
(`tests/fixtures/xr-chart-default-golden.json`) végig bájtra azonos marad.

## 0. Task-státusz

| Task | Név | Kérés | Függ | Állapot |
|---|---|---|---|---|
| T1 | Wormhole gyorsjavítások: egy réteg, Line stroke, egyenletes ütem, minőség, foveáció, mérés | 6 | — | KÉSZ (2026-10-03, Quest-elfogadás függőben) — ADR-009 Addendum F |
| T7 | Wormhole-rajzolás workerben (OffscreenCanvas) | 6 | T1 | KÉSZ (2026-10-03, Quest-elfogadás függőben) — ADR-009 Addendum G |
| T2 | Futásidejű játékkonfiguráció + közös beállítás-séma | alap | T1 | KÉSZ (2026-10-03) — ADR-009 Addendum H |
| T3 | Kardhossz, kockasebesség, számított játékostávolság, hosszabb pálya | 5, 3, 1, +pálya | T2 | KÉSZ (2026-10-03, Quest-elfogadás függőben) — ADR-009 Addendum I |
| T4 | Dramaturgiai pontozás (tiszta gameplay) | 2 | T2 | KÉSZ (2026-10-03) — ADR-009 Addendum J |
| T5 | Szerkezet- és pontkijelzés: keret-sáv + padló-gyűrű | 2 | T4 | KÉSZ (2026-10-03, Quest-elfogadás függőben) — ADR-009 Addendum K |
| T6 | Pályán érkező szakaszkapuk | 8 | T3, T5 | KÉSZ (2026-10-03, Quest-elfogadás függőben) — ADR-009 Addendum L |
| T8 | Nagyobb/magasabb játéktér | 4 | T3 | KÉSZ (2026-10-03, Quest-elfogadás függőben; Aréna később) — ADR-009 Addendum M |
| T9 | Ultra fokozat | 10 | T4, T8 | KÉSZ (2026-10-03, Quest-elfogadás függőben) — ADR-009 Addendum N |
| T10 | VR-menü + DOM-menü újraépítése közös sémából | 7 | T2… | KÉSZ (2026-10-03, Quest-elfogadás függőben) — ADR-009 Addendum O; a DOM-beállításmenüt az S kiegészítés kiváltotta (vászon-menü desktopon is) |
| T11 | Választható kockadizájn (menüből) + vágási effekt | 9 | T10 a menühöz | KÉSZ (2026-10-03, Quest-elfogadás függőben) — ADR-009 Addendum Q; + Wormhole-élesség: Addendum P |

## 1. Kiinduló tények (kódból)

- Ütésérzékelés: a judge csak `note.time − goodWindowSec (0,11 s)` után fogad el ütést
  (`RhythmJudge.ts`). 4 m/s-nál ez a hit plane mögötti 0,44 m. A hit plane (a start keret síkja)
  0,85 m-re van (`SceneConfig.playfieldForwardMeters`).
- Sorok: 3 sor, 0,34 m köz, a középső 0,55 m-rel a szem alatt → 1,65 m szemmagasságnál
  0,76 / 1,10 / 1,44 m.
- Pontozás: perfect 100, good 50; nincs szorzó, súly, maximum.
- Wormhole: fő szálon futó Canvas2D raszter három vásznon (960×540 + 2×768×432), ~4,7 MB
  textúrafeltöltés frissítésenként 30 Hz-en, három látómezőt kitöltő sík (kettő additív); a 30 Hz
  nem osztója a 72 Hz-nek → egyenetlen 2-2-3 lépés.
- VR-ben a DOM-menü rejtve van; beállítás csak VR-en kívül módosítható.

## 2. Elfogadott döntések (2026-10-03)

| Kérdés | Döntés |
|---|---|
| K1 távolság 4 m/s-nál | Képlet szerinti automatikus távolság, legfeljebb 1,20 m; a maradékot korai „good" ablak fedi (0,11 → ~0,15 s). Opcionális karhossz-kalibráció a Kényelem lapon. |
| K2 szakaszsúly | Dramaturgiai címke és tényleges chart-terhelés 50/50 keveréke. |
| K3 kombószorzó | Lépcsős 1/2/4/8×. |
| K4 pontozási alap | Most időzítés-alapú marad; a lendület-alapú modellről a T4 előtt döntünk. |
| K5 Ultra | Neve **Ultra**; azonos időzítési ablakok; energia/bukás később, opcionálisan. |
| K6 alapértékek | Kard alapból 1,0 m; sebesség alapból Normál. |
| K7 Wormhole-ütem | Menüből állítható; alapértelmezés az alacsonyabb (24 Hz), alternatíva 36 Hz. |
| K8 zenetár | Még nincs; a zene betöltése a VR előtt, a böngészőben történik. |
| K9 VR-menü | Minimális szünet-panel a T3 után, teljes menü a T10-ben. |
| K10 kockadizájn | Shard + Classic, **menüből választható**. |
| T1 vonalvastagság | Az MVP nevén: **Line stroke**, az MVP Advanced csúszka szemantikájával. |
| T7 | A worker-es kiszervezés megvalósul (nem csak feltételes). |

## 3. Taskok

### T1 — Wormhole gyorsjavítások

- XR-ben egyetlen sík (a háromrétegű 2.5D kikapcsolva; a depth cue megmarad).
- **Line stroke** csúszka (MVP Advanced szemantika: 0–100, 50 semleges, 100 = 4×; az XR eddigi
  rögzített értéke 100 volt, ez marad az alapértelmezés).
- **Háttér-frissítés**: 24 Hz (alap) / 36 Hz; a megjelenítési ráta egész osztójára igazítva
  (72 Hz-en minden 3./2. képkocka), csak lejátszás közben; szüneteltetve minden hívás átmegy.
- **Háttér-minőség**: Performance 640×360 / Balanced 768×432 (alap) / High 960×540.
- Foveáció 0,3 → 0,5.
- Diagnosztika: a háttér rajzolási ideje (`?xrDiagnostics=1`).

### T7 — Worker-es kiszervezés

`WormholeCanvasSource` egy dedikált workerben, `OffscreenCanvas`-on rajzol; a fő szál egy
`CanvasVisualSource`-kompatibilis proxyn át csak a kész `ImageBitmap`-et tölti fel. Típusos
üzenetek, prepare-kérésazonosító (elavult válasz eldobása), egyszerre legfeljebb egy képkocka
„repülésben" (backpressure), a fókuszpont a képpel együtt érkezik. Előfeltétel: a
`Canvas2DRendererBackend` injektálható vászonnal (DOM nélkül) működjön. ADR-009 F kiegészítés,
worker-communication szabályok, egyszemélyes tulajdonlás.

### T2 — Futásidejű konfiguráció és beállítás-séma

`DEFAULT_RHYTHM_GAME_CONFIG` helyett munkamenetenként származtatott konfiguráció; egy
leíró-alapú beállítás-séma (a `GENERATION_GROUPS` kiterjesztése), amelyből a DOM- és később a
VR-menü is épül; beállítások mentése böngészőtárba (per-viewer kényelem).

### T3 — Kard, sebesség, játékostávolság, hosszabb pálya

Távolságképlet (a start keret síkja a játékostól):

> P ≥ váll (−0,08) + kar (0,62) + penge töve (0,10) + penge + dőlés (0,10) + fél kocka (0,16) − korai ablak × v

| Sebesség | P (0,9 m penge) | P (1,0 m penge) |
|---|---|---|
| 4 m/s | 1,36 m | 1,46 m → 1,20-ra vágva + korai ablak |
| 7 m/s | 1,03 m | 1,13 m |
| 10 m/s | 0,85 (min) | 0,85 (min) |

- Kard: Rövid 0,9 / Normál 1,0 (alap) / Hosszú 1,1 / Auto (nagy térben +0,1).
- Sebesség: Normál 4 m/s · 2,0 s · 8 m; Gyors 7 m/s · 1,6 s · 11,2 m; Hiper 10 m/s · 1,4 s · 14 m.
  A chart nem változik, csak a megjelenítés és az érzékelési mélység.

**Hosszabb pálya (külön kérés).** Indoklás és korlátok:

- A pálya hossza ne fix legyen, hanem a spawn-távolságból származzon:
  `pályahossz = spawn-távolság + 3 m feloldódási sáv`, felső korlát ~18 m
  (Normál ≈ 11 m, Gyors ≈ 14 m, Hiper ≈ 17–18 m).
- Olvashatóság: 0,32 m-es kocka 14 m-ről ~1,3°, ~30 px a Quest 3-on — még olvasható; 20 m fölött
  már csak folt, ezért 18 m a korlát.
- A célpontok a spawn-pont utáni ~1,5 m-en beúsznak (alfa + méret), így nem „pattannak" elő;
  a Wormhole fókuszpontja felől érkezés érzete erősödik.
- Függőségek: `XrTrackPath` a pálya végét használja hajlítási végpontként (`BEND_END`) és a
  háttér-távolsághoz méretezett célzást; ezeket a hosszhoz kell kötni. A háttér egyetlen síkja
  40 m-en van (T1 után a 12 m-es közeli sík megszűnik, így nincs ütközés). Kamera far = 50 m elég.
  `maxActiveNotes` (64) Ultra sűrűségnél 1,6 s-os ablakkal is bőven elég.
- Költség: a padló áttetsző sík, a hosszabbítás olcsó (több hajlítható csúcs ~+50%, csak
  fókuszváltáskor számol). Kockázat: hosszú, erősen hajlított pálya a perifériában
  szédítő lehet → a hajlítás amplitúdó-korlátai maradnak.
- Döntés: igen, a sebesség-presethez kötött hosszal; a Normál preset is kissé hosszabb
  pályát kap (vizuális mélység), de a spawn-távolsága változatlan.

### T4 — Pontozás

Ütésenként alap × kombószorzó (1/2/4/8×) × szakaszsúly (1,0–2,0; címke + chart-terhelés 50/50).
Hibátlan szakasz bónusz × súly, csupa perfect további bónusz. Előre számolt maximum → százalék,
rang (SS/S/A/B/C), szakaszonkénti eredmény. Determinisztikus, tiszta gameplay.

### T5 — Szerkezet- és pontkijelzés

Start keret: vékony dalszerkezet-sáv a felirat alatt (szakasz-szegmensek, lejátszófej, szorzó,
„hibátlan" jelzés, szakaszvégi felvillanás). Padló: egyetlen shader-gyűrű — külső: körkörös
idővonal szakaszívekkel; belső: szakaszeredmények (hibátlan = arany); kéz-ívek: kombószorzó. A
pontjelző (HUD) áthelyezése, hogy a T8 felső sorával ne ütközzön.

### T6 — Szakaszkapuk

A start keret sarokelemeit idéző, kitöltés nélküli kapu a következő szakasz színében és nevével,
pontosan a szakaszváltáskor ér a start kerethez (z = (t − start) × v), ott indítja az érkezés-
animációt. Feliratok egy előre rajzolt textúra-atlaszból.

### T8 — Nagyobb játéktér

Normál (alap) / Magas (0,40 m sorköz + fej fölötti sor ~szem + 0,25 m, erős pillanatokban,
utána kötelező szünettel) / Aréna (szélesebb sávok is). Testmagassághoz kötött; a keret együtt nő.

### T9 — Ultra

Kb. 55%-kal sűrűbb, gyorsabb kézmozgás, hosszabb nehéz láncok, mindig irányított vágás, több
kétkezes pár; nyolcados futamok megbízható rácson, tizenhatodos csak ha a zene ad hozzá
onsetet. Strukturált szünetek: break/intro/outro ritkább, szakaszváltás előtt 1–2 ütés csend
(egybeesik a szakaszkapuval), sűrű futam legfeljebb ~4 ütem. Csak publikált onsetekre.

### T10 — Menü

Közös sémából DOM- és VR-menü. VR: markolat → szünet-panel, kontroller-sugár + ravasz.
Főmenü / Szünet / Beállítások (Játékmenet, Koreográfia, Látvány, Kényelem) / Eredmények.
Zene betöltése VR előtt, a böngészőben.

### T11 — Kockadizájn

Classic (mostani) és Shard (az irányt a forma is mutatja, világító vágási vonal), menüből
választható; találatkor két félre hasadás a vágás síkjában + szikra, példányosítva.

## 4. A terven kívüli, szerzői kérésre készült kiegészítések (2026-10-03)

| Kiegészítés | Tartalom | Állapot |
|---|---|---|
| ADR-009 Addendum P | Wormhole-élesség: Ultra raszter (1280x720) + GPU-élesítés (Sharpness) | KÉSZ, Quest-elfogadás függőben |
| ADR-009 Addendum R | Szerzői XR Wormhole-értékek (Nebula be), Character fül (Visual character), Wormhole be/ki a menüben; mért költség | KÉSZ, Quest-elfogadás függőben |
| ADR-009 Addendum S | A játékmenü csak a vásznon, desktopon is (Esc / fogaskerék / egér / nyilak + Enter); a HTML-panel csak zenét tölt és indít | KÉSZ, Quest-elfogadás függőben |
| ADR-009 Addendum T | Szerzői játékos-alapértékek (Tall / Hyper / Long, Ultra / Active / Expressive / Crossover, Wormhole be, Shard, Ultra / 36 Hz, Line stroke 34, Sharpness 100, Depth 10); a gameplay-könyvtár és a golden chart változatlan | KÉSZ, Quest-elfogadás függőben |
| ADR-009 Addendum U | Háttér-profilozás Questre: szakaszonkénti mérés a workerben, 2 mp-es átlag a játékmenüben (`?xrDiagnostics=1`). A korábbi "Beat blend" (ütemre igazított kulcskockák) Queston rosszabbul futott, visszavonva (2026-10-04) | KÉSZ, Quest-mérés függőben |

Nyitott következő lépés: a Quest-mérés alapján a Nebula anyag (hordozók felhalmozása, szövés,
elmosás) GPU-ra vitele a fő WebGL-kontextusban; a worker csak a hordozók listáját küldi (U kiegészítés).
