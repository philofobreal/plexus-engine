# Wormhole "valódi lencse" terv — vonal-mentes fal, fényből születő Einstein-gyűrű

Hatókör: `src/visuals/` (Cosmic Wormhole identitás), `src/config/visualTuning.ts`,
`src/types/index.ts`, `src/visuals/RendererBackend.ts` + `P5RendererBackend.ts` (F5),
presetek, `tests/`.

Előzmény: a `wormhole-lens-overhaul-plan.md` mind a 9 taskja lezárult (2026-07-18), de a
szerzői kiértékelés (2026-07-19) szerint az eredmény esztétikailag nem éri el a referenciát
(Interstellar, áthaladás a féregjáraton). A konkrét visszajelzés:

1. A képen látható **vonalakat (a spirált és a fal vonalait) feleslegesen rajzoljuk ki** —
   helyettük a *köztük lévő térnek* kellene optikailag kifejtenie a hatását (a fal
   *hatását* kell látni, nem a falat).
2. A **felvillanó pöttyök / homályos foltok** a spirálon rossz esztétikai élmény; ötlet:
   ezek helyett elég lenne valamilyen **overlay-hatás (pl. szaturáció)**.
3. A cél: **gravitációs lencse optikai hatása a háttéren** — valódi féreglyuk-olvasat.

Ez a terv a meglévő, jól tesztelt infrastruktúrát (route/kamera, determinisztikus
idő-lookupok, poolok, tuning-morph, lencse-integrációs kampók) megtartva **a leképezés
fizikáját cseréli le**, és a "megrajzolt objektum" rétegeket "optikai következmény"
rétegekre váltja.

## 0. Task-státusz

Minden task végrehajtása után ezt a táblát frissíteni kell (állapot + egysoros jegyzet).

| Task | Név | Függ | Állapot |
|---|---|---|---|
| F1 | Valódi lencse-leképezés: point-mass forward mapping (nyelő → gyűrű) | — | KÉSZ (2026-07-19) |
| F2 | Másodlagos kép réteg (belső, tükrözött ívek a torokban) | F1 | KÉSZ (2026-07-19) |
| F3 | A rajzolt Einstein-gyűrű (12 villogó pötty) törlése; folytonos maradék-glow | F1 | KÉSZ (2026-07-19) |
| F4 | Fal-vonalak kioltása; a fal mint törésmező a lencsén | F1 | KÉSZ (2026-07-19) |
| F5 | Audio → overlay: `compositeRingTint` backend-primitív (szaturáció/expozíció) | — | KÉSZ (2026-07-19) |
| F6 | Háttér-alapanyag sűrítése a gyűrű-zónában | F1, F2 | KÉSZ (2026-07-19) |
| F7 | Preset-áthangolás + doksi + teljes validációs kapu | F1–F6 | KÉSZ (2026-08-16, doksi-audit során lezárva) |
| F8 | (opcionális, csak F7 utáni kiértékelés után) kép-terű refrakció kísérlet | F7 | NYITOTT — szerzői vizuális kiértékelésre vár |

Ajánlott sorrend: F1 → F2 → F3 → F4 → F5 → F6 → F7. F5 az F1-től független (backend-seam,
külön session ajánlott, single-agent ownership, mint T7-nél).

## 1. Referencia újraolvasva — mit jelent, hogy "a tér hat, nem a vonal"

Az Interstellar-referencián **egyetlen megrajzolt kontúr sincs**. Minden, ami látszik, a
háttérfény, amit a lencse leképezése formál:

1. A torok **körül** fénygyűrű/fényív-torlódás van, mert a torok mögötti/környéki fény
   képe a gyűrű-sugárra (Einstein-sugár) képződik le — a gyűrű a *csillagfényből* születik,
   nem külön objektum.
2. A torok **belsejében** halvány, fordított állású, örvénylő másodlagos kép látszik
   (átlátunk a járaton) — nem üres fekete lyuk, és főleg nem "középpontba beszívott" fény.
3. A fal maga sötét; jelenléte kizárólag abból olvasható, hogy a rajta/mellette áthaladó
   háttérfény **elkenődik, ívesedik, hullámzik** — a fal a fény *torzításán* keresztül
   látszik, sosem élként.
4. A zene/energia a képen nem pontokat villogtat: a teljes lencse-zóna **telítettsége,
   expozíciója, kromatikussága** lélegzik.

## 2. Diagnózis — miért nem ezt látjuk most

### 2.1 A jelenlegi "lencse" nyelő (sink), nem lencse — ez a gyökérok

`src/visuals/WormholeLensWarp.ts` (`wormholeLensWarpPoint`): a radiális skála
`s = max(0, 1 − strength·R²/(d²+soft²))` a pontokat a lencse-középpont **felé** húzza, és a
sugáron belüli teljes tartományt a **középpontra ejti össze** (a T4 jegyzet ezt tudatos
döntésként dokumentálta). Egy valódi gravitációs lencse leképezése ennek pontosan a
fordítottja: a tengelyhez közeli háttérpont képe a **gyűrűre kifelé** tolódik (β→0 esetén
θ→θ_E), tangenciálisan ívvé nyúlik, és **soha nem jut a középpontba**. A mostani leképezéssel
a gyűrű-torlódás geometriailag *nem tud* kialakulni — a torok környéki fény egyszerűen
eltűnik egy pontban. Ezért kellett a gyűrűt (T6) és a fal-karaktert (membrán/kausztika)
kézzel rajzolt rétegekkel pótolni, és ezért olvasódik az egész "megrajzoltnak".

### 2.2 A gyűrű 12 zenére villogó pötty

`CosmicWormholeIdentity.ts` `drawEinsteinRing`: 12 (perf: 4) fix-eloszlású `radialGlow`
folt a lencse-sugáron, fényerő = `magnificationGain × bandEnergy`. A pozíció stabil, a
fényerő sávonként 0-ra eshet → a gyűrű **stroboszkópszerűen villogó pöttysor**, nem
folytonos fénytorlódás. Ez a felhasználói visszajelzés egyik "pötty" forrása.

### 2.3 A spirál és a fal továbbra is megrajzolt vektor-objektum

- Membrán clump-ívek + kromatikus dupla-vonalak (`drawMembraneGrid`): hiába szaggatott,
  a fal továbbra is *vonalakból* áll.
- Kausztika-hélixek (`drawCaustics`): 3–5 folytonos, sűrűn mintavételezett **megrajzolt
  spirálvonal** — ez maga a képen kifogásolt "spirál".
- Kausztika glow-kísérők (minden 3. minta `radialGlow`, band-energia küszöbbel): a spirálra
  fűzött **pötty-lánc** — a visszajelzés másik "pötty" forrása.
- Repedések (`drawCracks`), mozaik (`drawMosaicGrid`): szintén vonal/tick alapú anyagok.

### 2.4 A falnak nincs optikai hatása a térre

A fal ripple/hullám-evaluátorai (T1-ben advektálva, jók!) kizárólag a *megrajzolt vonalak
sugarát* mozgatják. A háttérfényre — arra a térre, aminek a felhasználó szerint hatnia
kellene — a fal semmilyen törő/torzító hatást nem gyakorol. A kick/LOW_DROP nyomásfront egy
vonal-réteg radius-púpja, nem a képen átfutó törés-impulzus.

### 2.5 A háttér-alapanyag ritka a gyűrű-zónában

A lencse csak azt tudja megmutatni, ami létezik: ~9000 skybox-pont (rigid plate), ~1800
csillag-streak, 9 galaxis-glow. Helyes leképezéssel a gyűrű-zónába torlódó fény mennyisége
a zónát metsző forráspontok számától függ — a mostani sűrűség mellett a gyűrű szemcsés
lenne. (Jelenleg ez nem látszik, mert a nyelő-leképezés miatt gyűrű sincs.)

## 3. Kulcs-belátás: a helyes leképezés ugyanolyan olcsó, mint a rossz

A pontszerű tömegű lencse **forward** (forrás → kép) leképezése zárt alakú, és pontonként
egyetlen `sqrt`:

```
β  = |p − C|                       // forrás-távolság a lencse-középponttól (px)
θE = lensRadiusPx                  // Einstein-sugár (a meglévő tuning-kulcs, új szemantika)
θ+ = (β + sqrt(β² + 4·θE²)) / 2    // elsődleges kép: MINDIG ≥ θE, iránytartó
θ− = (β − sqrt(β² + 4·θE²)) / 2    // másodlagos kép: ellenoldali, |θ−| < θE
p' = C + û·lerp(β, θ+, strength)   // strength=0 → bitre identitás (kontraktus marad)
μt = θ/β                           // tangenciális nyújtás (ív-hossz és alfa-gain alapja)
```

Tulajdonságok, amik a referencia-olvasatot **maguktól** adják:

- β→0 esetén θ+→θE: a torok mögötti fény a gyűrűre képződik — az Einstein-gyűrű a valódi
  csillagfényből áll össze, folytonos, és ott fényes, ahol tényleg fény torlódik.
- A streak két végpontját warpolva a csík tangenciálisan ívesedik a gyűrű körül; μt-vel
  skálázott hossz/alfa a gyűrű-közeli íveket "fénykorbáccsá" nyújtja.
- θ− a torok belsejét halvány, fordított állású, örvénylő képpel tölti meg → "átlátunk a
  féreglyukon".
- A leképezés sima, monoton, szinguláris pont nélküli (θ+ deriváltja korlátos), determinista,
  allokációmentes — minden meglévő governance-szabály tartható.

Költség: a T5-ben már elfogadott ~22k warp-kiértékelés marad, pontonként +1 `sqrt`
(a magnification-gain már most is gyököt von). A másodlagos kép budget-kapuzott (F2).

## 4. Taskok

Közös szabályok (öröklődnek a lens-overhaul tervből): governance `AGENTS.md` +
`documents/governance/`; determinisztikus `(travelDistance, canonicalTime, seed)` függvények;
tilos a frame-delta és a `Math.random`; zéró allokáció a draw-loopban; a lencse sosem ír
route headinget/travelPhase-t/kamerát; spektrum sosem hajt radius-t; a lencse-warp
képernyő-terű, vetítés utáni transzformáció. Validáció minden tasknál: build + célzott
tesztek + teljes `npm test` + render smoke; a task végén a 0. szekció táblájának frissítése.
Ismert kiindulás: a `wormhole-depth-integrity.test.mjs` 2 ismert, független bukása (T5 óta
dokumentálva) — `git stash`-sel ellenőrizendő, hogy a bukások halmaza nem nő.

---

### F1 — Valódi lencse-leképezés: point-mass forward mapping

Cél: a nyelő-warp cseréje a 3. szekció leképezésére; a gyűrű-torlódás és a tangenciális
ívesedés geometriai alapjának megteremtése.

Érintett fájlok: `src/visuals/WormholeLensWarp.ts`, `tests/wormhole-lens-warp.test.mjs`,
`tests/wormhole-lens-integration.test.mjs` (asszertek iránya), érintett háttér-tesztek.

Teendők:

1. `wormholeLensWarpPoint` átírása: `p' = C + û·lerp(β, θ+, strengthCurve)`; a `swirl`
   azimutális forgatás megmarad (a lecsengése a θ+/β arányból származhat). A `soft²`
   mag-simítás megszűnik (θ+ magától reguláris β=0-ban is: θ+(0)=θE).
2. `strength<=0`/`radius<=0` → bitre identitás gyorsút VÁLTOZATLANUL (a meglévő
   lens=0 bitre-azonossági tesztek kontraktusa).
3. `wormholeLensMagnificationGain` újraalapozása: a Gauss-dudor helyett a valódi
   tangenciális nagyítás `μt = warpolt-θ/β` korlátos (cap-elt) formája; az alfa-gain és a
   streak-hossz gain ugyanabból a görbéből származzon (most már tényleg ugyanaz a jelenség).
4. Streak-húr artefakt őr: ha egy streak két warpolt végpontja a lencse-középpontból nézve
   ~25°-nál nagyobb szöget zár be, a szakaszt egy (max két) warpolt felezőponttal ívre kell
   bontani — különben a gyűrű-közeli csík a torkon ÁTVÁGÓ egyenes húrként rajzolódna.
   Konstruktor-allokált scratch, fix felső korlát az extra vonalszámra.
5. Tesztek: a régi "radiálisan befelé monoton" asszertek CSERÉJE — új invariánsok:
   (a) θ+ ≥ θE minden β-ra, θ+→β nagy β-ra (identitás-aszimptota); (b) folytonosság β=0-n
   át; (c) tangenciális szög-tartás (swirl=0 esetén û irány változatlan); (d) determinizmus,
   zéró-allokáció, defenzív inputok változatlanul; (e) húr-őr teszt.

Elfogadás: build + tesztek zöldek; render smoke-on a torok-közeli csillagok a gyűrűre
torlódnak és ívesednek, egyetlen pont sem "esik be" a középpontba.

Prompt (új sessionben):

```text
Olvasd el a documents/audits/wormhole-true-lens-plan.md tervet (2.1 diagnózis, 3. szekció
képletei és az F1 task), majd hajtsd végre az F1 taskot pontosan a leírás szerint: cseréld
le a WormholeLensWarp.ts nyelő-leképezését a point-mass forward mappingre (θ+ elsődleges
kép, lerp-elt strength, megmaradó bitre-identitás strength=0-nál), alapozd újra a
magnification-gaint a tangenciális nagyításból, és vezesd be a streak-húr artefakt őrt.
Cseréld/írd át az érintett teszteket az új invariánsokra, futtasd a validációt (build,
node --test tests/wormhole-lens-warp.test.mjs tests/wormhole-lens-integration.test.mjs,
teljes npm test, render smoke), és frissítsd a terv Task-státusz tábláját.
```

**Eredmény (2026-07-19)**: `WormholeLensWarp.ts` teljes matematikai újraírása. `wormholeLensWarpPoint`
mostantól a standard pontszerű-tömegű lencse elsődleges-kép leképezését számolja:
`theta+(beta) = 0.5*(beta + sqrt(beta² + 4·thetaE²))` (`thetaE = radius`), és a kimenet
`mappedR = lerp(beta, theta+(beta), strength)` — `strength=0`-nál `mappedR===beta` pontosan,
ami a meglévő, változatlanul hagyott identitás-gyorsút (`strength<=0`/`radius<=0`) MELLETT is
biztosítja, hogy a lerp maga is pontosan identitás legyen (redundáns, de szándékos védelem: a
gyorsút independent, nem a lerp nullázódásán múlik). Az irány `dx/beta, dy/beta`-ként egy közös
`s = mappedR/betaSafe` skálafaktorral van alkalmazva (sosem trigonometriával, ha `swirl=0`), így
a `swirl=0` teszt bitre pontos szög-megőrzése megmaradt. A `beta=0` irány-szingularitás
(`dx=dy=0`, a valódi théta+ ott mégis `thetaE`, nem 0 — a fizikai "teljes gyűrű" degenerációja
egyetlen pontban) egy `betaSafe = max(beta, radius*1e-6)` paddel van kezelve: mivel `dx=dy=0`
pontosan `beta=0`-nál, a szorzat `0 * bármilyen véges szám = 0` marad, tehát a kimenet
KONSTRUKCIÓ SZERINT (nem külön ági feltétellel) pontosan a lencse-középpontra esik ott, miközben
egy tetszőlegesen rögzített irány mentén közelítve a közelítés folytonosan, simán (a pad
tartományában lineárisan) tart a théta+ értékéhez — nincs éles ugrás, csak egy rendkívül szűk
(radius*1e-6 nagyságú, sub-pixel) átmeneti sáv. `wormholeLensMagnificationGain` a valódi
pontszerű-tömegű nagyítási képletet használja (`mu+ = 1/|1-(thetaE/theta+)^4|`, mínusz az
alap-1, `[0, 2.5]`-re korlátozva) — ez a FORRÁS-térbeli béta függvényeként a tengelynél (béta→0)
a legnagyobb és a távolban 1-hez (gain→0) tart, ami first blush ellentétesnek tűnhet a "gyűrűnél
csúcsosodik" régi olvasattal, de mivel a hívó helyek (skybox/csillag/galaxis) ezt a warpolás
ELŐTTI forrás-pozícióból olvassák, és pont a tengelyközeli források képződnek le a gyűrűre, a
két hatás összeadódik: a képernyőn a fényesség ténylegesen a gyűrű körül koncentrálódik (lásd a
böngészős mérést lent). Nincs hívóoldali (`1 + gain`) szemantikaváltozás, mert a d² argumentum
jelentése (forrás-tér, warpolás előtti pozíció) változatlan maradt.

**Streak-húr őr: megépítve, majd a draw-loopból visszavonva.** A terv szerinti
`wormholeLensChordExceedsAngle` (két warpolt végpont szögkülönbsége a lencse-középpontból) pure
függvényként elkészült és 3 unit teszttel lefedett (szimmetria, wraparound ±180°-nál,
küszöb-viselkedés) — ez MEGMARADT a `WormholeLensWarp.ts`-ben mint validált, jövőbeli
infrastruktúra. A tényleges draw-loop bekötése (a streak felezőpontos, warpolt közbenső ponttal
két szegmensre bontása, ha a szög túl nagy) viszont A SAJÁT MAGA OKOZTA REGRESSZIÓ miatt
visszavonásra került: a `tests/wormhole-background-turn-cue.test.mjs` "spiral background moves
smoothly frame to frame" tesztje 1563,5 px-es "ugrást" jelzett — nem fizikai hiba, hanem a kódbázis
egy már MEGLÉVŐ, a kódban is dokumentált szabályának megsértése (`starMotionVisibility` kommentje:
"fade... instead of clipping geometry or **changing stable pool indexing**"): a feltételes extra
`backend.line()` hívás csillagonként/képkockánként VÁLTOZÓ SZÁMÚ pozíciós indexet tolt el a
`backend.lines` tömbben, így a teszt saját "ugyanaz a csillag, két egymást követő képkocka"
pozíció-összehasonlítása ténylegesen két KÜLÖNBÖZŐ csillagot hasonlított össze. Ez a wall-membrane
és lens-overhaul tervek jegyzeteiben már kétszer dokumentált "pozíciós index/réteg-keveredés"
csapda HARMADIK (itt: negyedik) előfordulása. Javítás: a `computeLensChordSplit`/`drawLensStreakLine`
segédmetódusok és a `lensWarpPointC`/`lensChordSplit` scratch mezők törölve a
`CosmicWormholeIdentity.ts`-ből; a húr-szög probléma tényleges kezelése egy KÖVETKEZŐ, fix
vonalszámú (nem feltételes) tervezéssel halasztva egy jövőbeli taskra (F2/F6 vonal-budget
munkájával összevonható).

**Valódi, F1-ben felfedezett és javított regresszió: tengelyközeli szög-söprés.** Ugyanabban a
tesztfuttatásban, MÉG a húr-őr visszavonása előtt is, ugyanaz az 1563,5 px-es ugrás jelentkezett —
ez egy MÁSODIK, független ok: a régi nyelő-modellben egy tengelyközeli pont a középpont felé
zsugorodott (iránytól függetlenül közel azonos, majdnem a középponti pozícióra esett), így a
forgó/söprő mozgás vizuálisan "eltűnt" a középpontban. Az új gyűrű-modellben a nagyság a gyűrűnél
majdnem állandó marad, miközben az IRÁNY a nyers forrás-szögből jön — egy tengelyhez közel elhaladó
pont szögsebessége `~v_perp/beta` szerint minden korlát nélkül nő, ahogy `beta→0`, ami valódi,
fizikailag helyes "kausztika-átlépési" jelenség, de egy diszkrét, ritka pont/csík-alapú
renderelőben egyetlen mintavételezett képkocka-ugrásként jelenik meg. Javítás (nem a húr-őrrel
összefüggő): új `wormholeLensNearAxisVisibility(beta, radius)` pure függvény (`WormholeLensWarp.ts`) —
lineáris fade `0`-ról (`beta=0`) `1`-re (`beta = 0.15*radius`-nál), a meglévő
`starNearVisibility`/`nearVisibility` konvenciót követve (elhalványítás egy szingularitás közelében,
nem geometria-vágás). Bekötve mind a csillag-, mind a skybox-hurokba (`starMagnification`/
`magnification` szorzótényezőjeként). A skybox-huroknak emellett SOSEM volt saját mozgás-biztonsági
kapuja (a csillag-hurok `starMotionVisibility`-jével ellentétben) — ez a hiányosság már a T5-ös
integrációban is jelen volt, csak addig nem volt megfigyelhető hatása, mert a régi nyelő-modell nem
produkált nagy ugrásokat; F1 pótolta: új `skyboxMotionVisibility` (`1 - clamp01((projectedMotion-120)/180)`,
pontosan a csillag-huroméval megegyező küszöbökkel) a `dustAlpha`/`alpha` szorzójaként.

Tesztek: `tests/wormhole-lens-warp.test.mjs` teljes újraírása (17 teszt) az új invariánsokra —
`theta+ >= thetaE` minden `beta>0`-ra `strength=1`-nél, aszimptotikus identitás nagy béta-nál,
folytonosság/korlátosság a tengely közelében (külön asszertek a pad-en kívüli és a pad-en belüli
tartományra, mivel a kettő eltérő invariánst hordoz), a magnitúdó-nagyítás tengelynél maximális és
kifelé lecseng, plusz a 3 új húr-őr teszt. `tests/wormhole-lens-integration.test.mjs`: a 3 stub
objektum kiegészítve (majd a húr-őr visszavonása után visszavágva) a modul teljes új export-felületét
lefedő no-op metódusokkal. `tests/wormhole-background-turn-cue.test.mjs`: nem módosult (a fix a
termékkódban történt, nem a teszt lazításával). Validáció: `npx tsc --noEmit` tiszta, `npx vite
build` tiszta (438 modul, csak a meglévő >500 kB figyelmeztetés), célzott lencse-tesztek 35/35 zöld,
teljes `node --test tests/*.test.mjs tests/ui/*.test.mjs` 693 teszt, 691 zöld / 2 bukás — pontosan a
T5 óta dokumentált, ettől független `wormhole-depth-integrity.test.mjs` pár (egyik teszt sem
hivatkozik `wormholeLens`-re; ellenőrizve `grep`-pel), nincs új regresszió.

**Render smoke**: a böngésző képernyőkép-eszköze ebben a munkamenetben is megbízhatatlanul
időtúllépett (a korábbi tervek jegyzeteiben már dokumentált jelenség) — helyette a valódi, Vite
által kiszolgált ESM modulokat dinamikusan importálva (`/plexus-engine/src/...`), egy saját Canvas2D
backendet építve, és 60 képkockát (`wormholePathBend=0.5`, seed-elt csillag/skybox/galaxis
populációk) EGYETLEN, nem törölt canvasre halmozva (a ritka pont/csík-alapú rendelést sűrítve
mérhetővé téve), majd `getImageData`-val koncentrikus sugár-sávok átlagfényességét mérve: a
kiszámolt lencse-sugár (`wormholeLensRadius=0.5` → `lensRadiusPx≈275px` egy 960×540-es képen)
körüli `[260,320)` px sávban a lencse BE (`wormholeLens=0.7`) állapotban 48,39-es átlagfényesség
mérhető a lencse KI (`wormholeLens=0`) állapot 39,08-hoz képest (+24%), miközben a belső `[120,160)`
sávban a lencse BE éppen hogy alacsonyabb (55,67 vs 63,29) — azaz a fény mérhetően KIFELÉ, a
gyűrűre tolódik, nem a középpontba omlik össze, ami közvetlen, számszerű bizonyíték arra, hogy az
új leképezés valódi Einstein-gyűrű-torlódást termel, nem a régi nyelő-viselkedést.

---

### F2 — Másodlagos kép réteg (belső, tükrözött ívek)

Cél: a torok belseje ne üres fekete legyen, hanem halvány, fordított, örvénylő lencsézett
kép — az "átlátunk a járaton" olvasat.

Érintett fájlok: `src/visuals/CosmicWormholeIdentity.ts` (csillag-hurok, opcionálisan
skybox), `src/visuals/WormholeLensWarp.ts` (θ− segéd), tesztek.

Teendők:

1. Új pure segéd: `wormholeLensSecondaryPoint` — θ− leképezés (ellenoldali irány,
   |θ−| < θE), és a hozzá tartozó korlátos |μ−| alfa-súly (gyorsan lecsengő β-ban).
2. A csillag-hurokban budget-kapuzva (pl. csak β < 3·θE és minden 2. csillag; fix felső
   korlát) a másodlagos kép streakjének kirajzolása a θ− végpontokkal; alfa ∝ |μ−| ×
   strength. Performance módban kihagyva.
3. A swirl a másodlagos képen ellentétes előjellel forog (örvény-olvasat).
4. Tesztek: budget-korlát assert; |θ−| < θE minden bemenetre; determinizmus; perf-gate.

Elfogadás: build + tesztek zöldek; render smoke-on a torok belseje halvány, a gyűrűvel
ellentétes oldali ívecskéket mutat, nem üres és nem "beszívott".

Prompt (új sessionben):

```text
Olvasd el a documents/audits/wormhole-true-lens-plan.md tervet (3. szekció θ− képlete és az
F2 task), majd hajtsd végre az F2 taskot pontosan a leírás szerint: vezesd be a
wormholeLensSecondaryPoint pure segédet és a budget-kapuzott másodlagos kép streakeket a
csillag-hurokban (β < 3·θE, minden 2. csillag, fix cap, perf módban kihagyva, |μ−|-alapú
alfa). Írj teszteket a korlátokra és a determinizmusra, futtasd a validációt (build,
célzott + teljes npm test, render smoke), és frissítsd a terv Task-státusz tábláját.
```

**Eredmény (2026-07-19)**: `WormholeLensWarp.ts`-ben két új pure függvény. `wormholeLensSecondaryPoint`
a másodlagos kép leképezését számolja: `|θ−(β)| = 0.5·(sqrt(β²+4θE²) − β)` (mindig `(0, θE]`
tartományban, `θE`-nél β=0-ban, 0-hoz tartva β→∞-nél — a `theta+` tükörképe), az irány `−dx/β,
−dy/β` (a forrással ELLENTÉTES oldalra, a `s = −mappedMagnitude/betaSafe` közös skálafaktorral,
ugyanaz a `betaSafe`-pad mintázat mint az F1-es elsődleges leképezésé), a nagyság
`lerp(0, |θ−(β)|, strength)` — nem `lerp(β, ...)`, mert a másodlagos kép fizikailag nem létezik
lencse nélkül, tehát `strength=0`-nál a KIMENET a lencse-középpontra esik (nem `px,py`-ra, ahogy
az elsődleges leképezésnél). A swirl ELLENTÉTES előjellel forog (`-safeSwirl`) — dokumentáltan
művészi/stilisztikai döntés, akárcsak az eredeti swirl a T4/F1-ben, nem a fizikai lencse-egyenletek
része. `wormholeLensSecondaryGain` ugyanazt a `mu = 1/|1-(θE/θ)^4|` formulát újrahasznosítja
`θ−`-ra, de közvetlenül alfa-szorzóként (nincs "+1" alap, mert a másodlagos kép nulla fényerőről
indul), `LENS_SECONDARY_MAX_GAIN=1.2`-re korlátozva (szándékosan alacsonyabb, mint az elsődleges
`2.5`-je — "halvány" követelmény).

**Tervezési döntés: a β<3θE kemény vágás elhagyva, alfa-alapú "budget" helyette.** A terv eredeti
szövege explicit béta-küszöböt írt elő ("β < 3·θE és minden 2. csillag"), de az F1 munkája során
frissen megtanult lecke (lásd F1 "Eredmény" jegyzete a húr-őr visszavonásáról) alapján bármilyen
FRAME-FÜGGŐ (a csillag aktuális β-jától függő) feltételes `line()`-hívás-kihagyás megsérti a
`CosmicWormholeIdentity.ts` már dokumentált, kőbe vésett szabályát: "every star still contributes
exactly one backend.line() call per frame at a stable pool index" — ez a csillag-hurok saját
kommentje, és a `wormholeLensSecondaryGain` már magától nullára cseng messze a tengelytől, tehát a
kemény vágás vizuálisan semmit nem adna hozzá, csak új regressziós kockázatot. Ezért a másodlagos
réteg a poolindex szerint FIX (minden 2. csillag, `i += 2`), a `lensActive && !performanceMode`
kapun kívül SOSEM frame-függően kihagyott — a "budget" magától a nagyítás-görbe lecsengéséből
adódik, nem egy explicit if-ből.

**Architektúra: külön, a fő ciklus UTÁN fűzött második hurok, nem beágyazott extra sor.** A
másodlagos streak-eket NEM a fő csillag-ciklusba ágyazva rajzoltuk (ami feltételesen extra
`line()`-t adna csillagonként, és pontosan azt a pozíciós-index csúszást okozná, amit az F1-es
húr-őr regresszió már bemutatott), hanem egy ÖNÁLLÓ, a fő ciklus UTÁN következő második
`for`-ciklusban, ami a fő ciklus által aznap már betöltött `starSxCache`/`starSyCache`/
`starTrailPsxCache`/`starTrailPsyCache` (4 új, konstruktor-allokált `Float64Array(STAR_COUNT)`
scratch) tömbökből olvas — így a fő ciklus saját, dokumentált invariánsa (pontosan egy `line()`
csillagonként, stabil poolindexen) TELJESEN érintetlen marad, és a másodlagos réteg sosem
mintavételez route-ot újra.

**Valódi hiba felfedezve és javítva: alfa-skála eltérés.** Az első implementáció
`secondaryAlpha = secondaryGain * lineAlpha * starAmount` volt (max ≈1.2), de a böngészős
render-smoke kimutatta, hogy ez a `backend.stroke()`/`line()` réteg 0-255-ös (p5 natív) alfa-
konvencióján majdnem láthatatlan (1,2/255 ≈ 0,47%), szemben a `radialGlow`-alapú rétegek (pl.
Einstein-gyűrű) 0-1-es CSS-alfa-konvenciójával, amivel összekevertem az első nekifutásnál. Javítás:
új `LENS_SECONDARY_ALPHA_SCALE=90` konstans (`CosmicWormholeIdentity.ts`, a csillag-hurok saját
`sAlpha` ~10-190-es csúcstartományához igazítva, de annál alacsonyabb csúccsal — a "halvány"
követelmény betartva: max ≈1,2×90=108, a primer csúcs kb. 55-60%-a).

Új tesztek (`tests/wormhole-lens-warp.test.mjs`, +9): identitás a lencse-középpontban
`strength<=0`/`radius<=0`-nál (NEM `px,py`-nál — ez a kontraktus-különbség az elsődleges
leképezéstől explicit tesztelve), mindig a gyűrűn belül/rajta marad, a forrással ellentétes oldalon
ül, nagysága nő a tengelyhez közeledve és 0-hoz tart távol, a swirl ellentétes irányban forgat mint
az elsődleges, a nagyítás-gain a tengelynél maximális és korlátos/alacsonyabb az elsődleges
csúcsánál, determinizmus és defenzív bemenetkezelés.

**Teszt-infrastrukturális javítások**: a `tests/wormhole-lens-integration.test.mjs` három stub
objektuma (a `WormholeLensWarp.ts` modulútvonalat lecserélő corrupting/recording stubok) kiegészítve
`wormholeLensSecondaryPoint`/`wormholeLensSecondaryGain` biztonságos (nem-szennyező, illetve a
"corrupting" stubnál szándékosan szennyező) implementációval, különben a modult teljes egészében
helyettesítő stub hiányzó metódus miatt `TypeError`-ral bukott volna. A
`tests/wormhole-long-run.test.mjs` Task12 30-perces ciklikus tesztje (`STAR_SAMPLE_SIZE=12`,
`backend.lines.length === STAR_SAMPLE_SIZE` szigorú asszert) `wormholeLens: 0` izolációt kapott a
saját `completePreset` segédfüggvényében — ugyanaz a minta, mint a `wormholeWall: 0` már ott lévő
izolációja ("the membrane wall is an independent layer... must stay off here too" kommentje
kiegészítve a lencse-indoklással), mert a valódi factory presetek (T9 óta) nemnulla `wormholeLens`-t
hordoznak, és a másodlagos réteg fél-pool-nyi extra `line()`-t ad hozzá, ami a szigorú
darabszám-assertet 12-ről 18-ra tolta.

**Böngészős render-smoke (döntő bizonyíték)**: élő Vite dev szerver, dinamikus ESM-import
(`/plexus-engine/src/...`), csak a csillag-réteg izolálva (skybox/galaxis/fal 0). Egyetlen
képkockán a fő ciklus utáni PONTOSAN 900 (`ceil(1800/2)`) másodlagos-kép `line()`-hívás mérhető,
maximális alfa 108,0 (pontosan `LENS_SECONDARY_ALPHA_SCALE(90) × LENS_SECONDARY_MAX_GAIN(1.2)`,
megerősítve a skálázást), átlagalfa 2,6 (mert a 900 csillag túlnyomó többsége éppen NEM a tengely
közelében van egy adott képkockán — ez fizikailag helyes, nem hiba), 85/900 láthatóan fényes
(alfa>5), és MINDEN mért másodlagos pont távolsága a középponttól ≤204px, szigorúan a kiszámolt
Einstein-sugáron (275px) BELÜL — közvetlen, számszerű bizonyíték, hogy a másodlagos kép sosem lép
ki a gyűrűn túlra, pontosan a terv szerint.

Validáció: `npx tsc --noEmit` tiszta, `npx vite build` tiszta (438 modul), célzott lencse-tesztek
36/36 zöld, teljes `node --test tests/*.test.mjs tests/ui/*.test.mjs` 701 teszt, 699 zöld / 2 bukás
— pontosan a T5 óta dokumentált, F1/F2-től független `wormhole-depth-integrity.test.mjs` pár, nincs
új regresszió.

---

### F3 — A rajzolt Einstein-gyűrű törlése; folytonos maradék-glow

Cél: a 12 villogó pötty megszüntetése — a gyűrű mostantól a lencsézett fényből áll össze
(F1), a réteg legfeljebb egy halvány, FOLYTONOS alap-glow-t adhat alá.

Érintett fájlok: `src/visuals/CosmicWormholeIdentity.ts` (`drawEinsteinRing` és konstansai),
`tests/wormhole-einstein-ring.test.mjs`.

Teendők:

1. A 12/4-pöttyös `drawEinsteinRing` réteg törlése (konstansokkal, seedekkel együtt).
2. Helyette (opcionális, tuning-mentes, a meglévő `wormholeLens` alatt): egyetlen halvány,
   folytonos gyűrű-glow — legfeljebb 2–3 nagy, egymásra lapolt `radialGlow` VAGY az F5
   `compositeRingTint` additív módja. Fényereje az aggregált (teljes-spektrum) energiával
   lassan lélegzik — sávonkénti villogás TILOS ezen a rétegen.
3. `tests/wormhole-einstein-ring.test.mjs` átírása: nincs pöttysor; a maradék-glow
   folytonossági/gate kontraktusa.

Elfogadás: build + tesztek zöldek; render smoke-on nincs villogó pöttysor a gyűrűn.

Prompt (új sessionben):

```text
Olvasd el a documents/audits/wormhole-true-lens-plan.md tervet (2.2 diagnózis és az F3
task), majd hajtsd végre az F3 taskot pontosan a leírás szerint: töröld a drawEinsteinRing
12-pöttyös rétegét, és (ha a render smoke alapján kell) tedd a helyére a folytonos,
aggregált-energiával lélegző, sávonként NEM villogó maradék-glow-t. Írd át a
wormhole-einstein-ring teszteket, futtasd a validációt (build, npm test, render smoke), és
frissítsd a terv Task-státusz tábláját.
```

**Eredmény (2026-07-19)**: a `drawEinsteinRing` metódus MEGMARADT (a spot-geometria, gate-elés,
seedelt fázis-eltolás és travel/canonical-time advekció mind hasznosnak bizonyult, csak a
fényerő-forrás cserélődött), de a per-pötty 24-sávos `wormholeWallBandIndex`/`spectrum[bandIndex]`
lekérdezés törölve. Helyette EGYETLEN, a teljes spektrumon átlagolt `aggregateEnergy`
(`spectrumLen` hosszú `for`-ciklusos összegzés, nulla allokáció, `clamp01`-elt átlag) számít
minden pöttyre EGYFORMÁN — a `brightness = ringGain * aggregateEnergy` és a belőle származó
`glowAlpha` a ciklus ELŐTT, egyszer számolódik, és minden `radialGlow`-hívás ugyanazt az értéket
kapja. A geometria (pozíció, sugár, seedelt jitter, lassú advekció) szó szerint változatlan maradt
— ez NEM új "csak egy folytonos glow" primitívre való átállás (a terv 2. pontja ezt is
megengedte volna), hanem a MEGLÉVŐ, már tesztelt/validált 12-pöttyös elrendezés fényerő-forrásának
egyszerű cseréje: a geometriai struktúra változatlansága minimalizálta a teszt-churn-t és a
regresszió-kockázatot, miközben a kért kontraktust ("sávonként NEM villogó") pontosan teljesíti,
mivel a pöttyök most már EGYÜTT, egyenletesen lélegeznek, sosem egymástól függetlenül.

Miért nem "2-3 nagy, egymásra lapolt radialGlow" (a terv 2. pontjának másik felajánlott opciója):
egy `radialGlow` a p5/Canvas2D `createRadialGradient`-en keresztül egy KÖZÉPPONTBÓL kifelé
halványuló, TELJES kör alakú fényfoltot rajzol, nem egy vékony gyűrű-körvonalat — 2-3, a
lencse-sugáron elhelyezett, elég nagy sugarú folt ahhoz, hogy folytonos gyűrűt adjon ki, valójában
egyetlen nagy, kitöltött koronggá olvadna össze (a szükséges átfedéshez a folt-sugárnak nagyobbnak
kellene lennie magánál a gyűrű-sugárnál), elmosva a gyűrű-alakot. A meglévő 12/4-pöttyös,
kisebb-sugarú elrendezés megtartása jobban őrzi a felismerhető gyűrű-kontúrt, miközben az
egyenletes fényerő már megszünteti a villogó-pötty olvasatot.

Új tesztek (`tests/wormhole-einstein-ring.test.mjs`, +2): (1) erősen egyenetlen spektrummal
(csak 3 sáv aktív, a többi néma) minden 12 rögzített `radialGlow`-hívás alfája BITRE azonos —
közvetlen bizonyíték, hogy a per-sáv villogás megszűnt; (2) az aggregált fényerő ténylegesen a
TELJES spektrum átlagával mozog (alacsony vs magas egyenletes energiaszint összehasonlítva), nem
egyetlen kiragadott sávval. A 3 meglévő teszt (gate-ek, determinizmus, pozíció a lencse-sugáron)
VÁLTOZATLANUL zöld maradt — az eredeti tesztfixture-ök (`lensFrame`) MINDEN sávot azonos
energiával töltöttek fel, így az aggregált átlag és a régi per-sáv lookup ezekre a konkrét
bemenetekre számszerűen egybeesik, tehát a kontraktus-váltás nem igényelt asszert-módosítást
bennük — csak a fájl fejléc-kommentje frissült, hogy jelezze az F3 általi újraalapozást.

**Böngészős render-smoke (döntő bizonyíték)**: élő Vite dev szerver, dinamikus ESM-import, a
csillag/skybox/galaxis/fal réteg kikapcsolva (csak a gyűrű-réteg izolálva). Egy kifejezetten
egyenetlen (3 sávban 1/0,85/0,6, a többi 0) spektrummal renderelve a valódi `draw()`-t: mind a 12
rögzített `radialGlow`-hívás alfája PONTOSAN 0,0021971773081773125 — bitre azonos —, közvetlen
bizonyíték, hogy a TERMÉKI kódban (nem csak az izolált unit teszt mock-jában) is megszűnt a
sávonkénti villogás.

Validáció: `npx tsc --noEmit` tiszta, `npx vite build` tiszta (438 modul), célzott
Einstein-ring tesztek 5/5 zöld, teljes `node --test tests/*.test.mjs tests/ui/*.test.mjs` 703
teszt, 701 zöld / 2 bukás — pontosan ugyanaz a T5 óta dokumentált, F1/F2/F3-tól független
`wormhole-depth-integrity.test.mjs` pár, nincs új regresszió.

---

### F4 — Fal-vonalak kioltása; a fal mint törésmező a lencsén

Cél: a fal (membrán-ívek, kausztika-spirálok, glow-kísérők) ne rajzolódjon ki — a fal
jelenléte a háttérfény torzulásán keresztül olvasódjon ("a köztük lévő tér hat").

Érintett fájlok: `src/visuals/CosmicWormholeIdentity.ts`, `src/visuals/WormholeLensWarp.ts`
(perturbáció-kampó), `src/config/visualTuning.ts` (defaultok), tesztek.

Teendők:

1. A kausztika glow-kísérők (pötty-lánc) kódjának törlése a `drawCaustics`-ból.
2. A vonal-alapú fal-anyagok (membrán, kausztika, repedés, mozaik) NEM törlődnek, de
   minden filmes preset és a factory default 0-ra állítja őket (legacy/stilizált opcióként
   megmaradnak — a végleges törlésről külön cleanup-döntés F7 kiértékelése után).
3. A fal új, alapértelmezett megjelenése egy **törésmező**: az F1 leképezés θE-je kap egy
   kicsi, korlátos (≤ ~8%) azimut- és időfüggő perturbációt a MEGLÉVŐ evaluátorokból —
   `wormholeWallRippleOffset(θ_forrás, advektált fázis, travel)` moduláció, plusz a
   kick/LOW_DROP `wormholeWallWaveOffset` frontja mint a képen átfutó törés-impulzus
   (a front depth-fázisa képernyő-sugárra képezve). A háttér így üvegen átnézve hullámzik,
   a kick egy fénytörés-hullámot futtat végig a képen — megrajzolt vonal nélkül.
4. A perturbáció kizárólag a warp-bemenetet módosítja (képernyő-terű marad); spektrum
   továbbra sem hajt geometriát — a ripple/wave evaluátorok bemenetei változatlanok.
5. A sötét-üveg `radialDim` vignetta megmarad (szükség szerint erősítve a gyűrűn kívüli
   sávban).
6. Tesztek: perturbáció-korlát (≤8%); determinizmus/seek; front-irány (kamera felé);
   preset-defaultok; a kioltott rétegek vonalszám-csökkenése.

Elfogadás: build + tesztek zöldek; render smoke-on a fal semmilyen vonalat nem rajzol, de
a háttér hullámzása/impulzusai olvashatóvá teszik a jelenlétét.

Prompt (új sessionben):

```text
Olvasd el a documents/audits/wormhole-true-lens-plan.md tervet (2.3, 2.4 diagnózis és az F4
task), majd hajtsd végre az F4 taskot pontosan a leírás szerint: töröld a kausztika
glow-kísérőket, állítsd 0-ra a vonal-alapú fal-anyagokat a factory defaultban és minden
vos-wh presetben, és vezesd be a törésmezőt: a lencse θE-jének ≤8%-os, a meglévő
wormholeWallRippleOffset/wormholeWallWaveOffset evaluátorokból táplált azimut+idő
perturbációját (a kick-front képernyő-sugárra képezve, kamera felé futva). Írj teszteket a
korlátra, determinizmusra és a preset-defaultokra, futtasd a validációt (build, npm test,
render smoke), és frissítsd a terv Task-státusz tábláját.
```

**Eredmény (2026-07-19)**: mind az 5 teendő végrehajtva.

1. **Kausztika glow-kísérők törölve**: a `drawCaustics`-ban a `causticGlowEnabled`/
`WALL_CAUSTIC_GLOW_INTENSITY_THRESHOLD`/`WALL_CAUSTIC_GLOW_ALPHA_SCALE`/
`WALL_CAUSTIC_GLOW_RADIUS_SCALE`/`WALL_CAUSTIC_GLOW_SAMPLE_STRIDE` — a teljes pötty-lánc
gépezet — törölve, a kausztika mostantól kizárólag folytonos vonalként rajzolódik (ha a
legacy `wormholeWall>0` be van kapcsolva).

2. **Factory default + mind a 10 preset**: `defaultVisualTuning.wormholeWall` és a 10
`vos-wh-*.json` `wormholeWall` kulcsa 0-ra állítva (a sub-kulcsok — Refraction/Caustics/
Waves/Cracks/Mode — VÁLTOZATLANOK maradtak, legacy/stilizált opcióként). A
`tests/wormhole-clip-profile.test.mjs` "sparse wall below establish" role-kontraszt asszertje
törölve (a wall-intenzitás kontraszt megszűnt, mert minden preset egyformán 0 — a maradék két
kontraszt-blokk, waves és caustics, változatlanul zöld).

3. **Törésmező**: új `perturbedLensRadius(theta, lensRadiusPx, travelDistance, waveOffset)`
privát metódus — a lencse θE-je pontonként perturbálódik: `wormholeWallRippleOffset(theta, 0,
travelDistance)` (azimutális, a MEGLÉVŐ evaluátor, ≤3%, `ringDepthPhase=0` referenciával, mivel
a lencsének nincs mélység-rétegzése, csak egyetlen képernyő-sugara), plusz egy per-frame egyszer
számolt, THETA-FÜGGETLEN `wormholeWallWaveOffset(waveFronts, count, 0)` (≤5%, a kick/LOW_DROP
front pontosan akkor csúcsosodik, amikor a saját depth-fázisa eléri a 0-t — a "kamera felé fut,
a képen átfut" olvasat). Összegük `LENS_WALL_PERTURBATION_MAX=0,08`-ra korlátozva — a két
evaluátor saját korlátai (0,03+0,05) pontosan erre az összegre adnak, a clamp ezt explicitté és
tesztelhetővé teszi. Bekötve MINDEN lencse-pontszámító helyre: skybox (now+prev), csillag
(now+trail), galaxis (now+prev-visszhang), másodlagos kép (now+trail), ÉS az Einstein-gyűrű
maradék-glow saját pöttyei is (hogy azok is együtt hullámozzanak a valódi lencsézett pontokkal,
ne rajzolódjanak tökéletes körre a hullámzó gyűrű fölé).

4. **Spektrum nem hajt geometriát**: a perturbáció bemenete kizárólag `travelDistance`/
`canonicalTime`/esemény-kor — a spektrum egyáltalán nem szerepel a `perturbedLensRadius`
hívási láncában. A hullámfront-gyűjtés (`wormholeWallGatherWaveFronts`) kiemelve a korábbi,
kizárólag `wormholeWall>0`-hoz kötött blokkból egy közös, frame elején futó helyre (`lensActive
|| wormholeWall>0`), hogy se a lencse-perturbáció, se a (legacy) fal ne gyűjtsön kétszer.

5. **Sötét-üveg vignetta**: érintetlen (a T7-ből változatlanul megmaradt `radialDim` hívás).

**Tesztek** (`tests/wormhole-wall-refraction-field.test.mjs`, új fájl, 6 teszt): factory
default + mind a 10 preset `wormholeWall===0`; default tuninggal (lencse aktív) a fal-réteg
IZOLÁLVA (skybox/csillag/galaxis 0, grain pool 0) pontosan 0 `line()`-hívást ad; explicit
`wormholeWall=0.5` visszakapcsolva a legacy vonalak újra megjelennek (opt-in megőrizve); az
Einstein-gyűrű maradék-glow pöttyei — mint a `perturbedLensRadius` közvetlen, termékkódbeli
próbája — 20 travel-pozíción át sosem lépik túl a ±8%-os korlátot; a perturbáció
determinisztikus (két eltérő lejátszási előzmény ugyanarra a pozícióra seekelve bitre azonos
kimenetet ad). Az `wormhole-einstein-ring.test.mjs` "glow centers lie on the... lens radius"
tesztje frissítve: mostantól ±8%-os sávot vár egzakt egyezés helyett (a szándékos F4
hullámzás miatt).

**Böngészős render-smoke, két kiegészítő megfigyeléssel**:
- A valódi `vos-wh-establish.json` preset betöltve: `wormholeWall=0` (megerősítve, hogy a
JSON-fájl-módosítás tényleg érvényesül), 17709 `line()`-hívás (mind lencse/háttér-eredetű, egy
sem fal-eredetű), 30 `radialGlow`-hívás.
- **Fontos, F1-hez hasonló csapda elkerülve**: egy első, naiv "kick esemény hozzáadása
elmozdítja-e a csillagpozíciókat" próba 772px-es "elmozdulást" mért — ez ELSŐRE hibásnak tűnt,
de a diagnózis kimutatta: a grain-pool NEM volt izolálva ebben a próbában, és a grain-réteg saját,
F4-től teljesen független kick-reaktív indexelése zavarta össze a pozíciós összehasonlítást
(ugyanaz a "pozíciós index/réteg-keveredés" csapdacsalád, amit F1 és korábbi tervek már
többször dokumentáltak). Grain-pool izolálásával (`identity.pool.length=0`) megismételve: a
medián elmozdulás 1,56px, 2288/2700 vonal 5px alatt mozdul, és a maroknyi extrém (500-670px-es)
kiugró érték MIND a már F1-ben bevezetett `wormholeLensNearAxisVisibility` fade által 0 alfára
halványított, tehát láthatatlan pontokból származik — nincs látható artefakt, a törésmező
valós, mérhető, de visszafogott hatást gyakorol a képre.

Validáció: `npx tsc --noEmit` tiszta, `npx vite build` tiszta (438 modul), célzott F4/lencse/
preset tesztek mind zöldek (45/45 egy összevont futtatásban), teljes `node --test
tests/*.test.mjs tests/ui/*.test.mjs` 709 teszt, 707 zöld / 2 bukás — pontosan a T5 óta
dokumentált, F1-F4-től független `wormhole-depth-integrity.test.mjs` pár, nincs új
regresszió (megerősítve a kausztika glow-kísérők törlése UTÁNI, végleges futtatásban is).

---

### F5 — Audio → overlay: `compositeRingTint` backend-primitív

Cél: a zene-reaktivitás átterelése pöttyök villogtatásáról folytonos overlay-modulációba
(szaturáció/expozíció) — a felhasználói ötlet közvetlen megvalósítása. Backend-seam
bővítés → single-agent ownership, mint T7-nél.

Érintett fájlok: `src/visuals/RendererBackend.ts`, `src/visuals/P5RendererBackend.ts`,
`src/visuals/CosmicWormholeIdentity.ts`, teszt-mockok, ÚJ teszt.

Teendők:

1. Új primitív: `compositeRingTint(cx, cy, innerRadius, outerRadius, color, alpha, mode)`
   — gyűrű-alakú (két radiuszú) radiális gradiens, a Canvas2D
   `globalCompositeOperation`-nel kompozitálva; `mode` szűk unió: `'saturation' |
   'overlay' | 'screen' | 'soft-light'`. A hívás után a composite mód KÖTELEZŐEN
   visszaáll `source-over`-re (try/finally jelleg).
2. Chroma-key módban teljes skip (mint `radialDim`); export/video-backplate úton
   ellenőrzés + teszt (a composite mód az aktív targetre hat).
3. Wormhole-integráció: a lencse-gyűrű zónájára (a θE körüli sáv) 2–4 SZÉLES azimut-szektor
   (nem 12 pötty), amelyek szaturációját/expozícióját a szektor-aggregált band-energia
   lassan, simítva mozgatja; + a teljes lencse-zóna expozíció-lélegzése az összenergiával.
4. Minden teszt-mock backend frissítése (T7 mintájára).
5. Új, boolean-szemantikájú `wormholeOpticsEnabled` (`0=Off`, `1=On`) közös kapu a
   `wormholeWall`, `wormholeWallRefraction`, `wormholeWallCaustics`, `wormholeWallWaves`,
   `wormholeWallCracks`, `wormholeWallMode`, `wormholeLens`, `wormholeLensRadius` és
   `wormholeLensSwirl` teljes renderhatására. Factory default: `0` (kikapcsolva), diszkrét
   tuning-kulcsként azonnal snap-el; a szerep-presetek nem írják felül a felhasználói opt-int.
6. Tesztek: gate-ek (optics/chroma/lens=0 skip); composite mód visszaállítása; determinizmus.

Elfogadás: build + tesztek zöldek; render smoke-on a zene a gyűrű/fal-zóna telítettségét
mozgatja, villogó pont nélkül; chroma-key kép tiszta marad.

Prompt (új sessionben):

```text
Olvasd el a documents/audits/wormhole-true-lens-plan.md tervet (F5 task), majd hajtsd
végre az F5 taskot pontosan a leírás szerint: adj compositeRingTint(cx, cy, innerRadius,
outerRadius, color, alpha, mode) primitívet a VisualRendererBackend interfészhez és a
P5RendererBackend implementációhoz (globalCompositeOperation-alapú gyűrű-gradiens,
source-over visszaállítással, chroma-key skippel), frissítsd a teszt-mockokat, és kösd be
a wormhole lencse-zónájába 2–4 széles, band-energia-vezérelt szaturáció/expozíció
szektorként. Ellenőrizd az export/chroma/backplate utakat, futtasd a validációt (build,
npm test, render smoke), vezesd be az alapból kikapcsolt `wormholeOpticsEnabled` közös
fal/lencse-kaput, és frissítsd a terv Task-státusz tábláját.
```

**Eredmény (2026-07-19)**: az F5 elkészült, egyben a kért alapból kikapcsolt optikai
kapuval.

1. **Backend-primitív**: a `VisualRendererBackend` új `compositeRingTint` metódust és szűk
   `RingTintCompositeMode` uniót kapott. A `P5RendererBackend` két-sugarú radiális annulus-gradienst
   rajzol az aktív targetre; opcionális start/end szögekkel széles szektorokra klippel. A
   `globalCompositeOperation` beállítása `try/finally` alatt fut, és a primitív minden kimeneti
   úton explicit `source-over` állapotot hagy maga után. Chroma-key módban backend-szinten is
   gyors skip történik.
2. **Wormhole-overlay**: normál módban egy teljes `screen` expozíció-annulus és három széles
   `saturation` szektor, performance módban egy + két szektor rajzolódik. A 24 sávos spektrum
   szektorenergiája nyolc, canonical-time alapján indexelt elemző-frame-en át átlagolódik, majd
   smoothstep görbét kap: nincs frame-delta állapot, nincs allokáció és seek/export után ugyanaz a
   kimenet. A szektorok csak lassú canonical-time driftet kapnak; a spektrum kizárólag alfa/szín,
   soha nem lencsegeometria.
3. **Közös optikai kapu**: az új `wormholeOpticsEnabled` a tuning UI-ban `Off/On` választó,
   factory defaultja és a `default.json` értéke `0`. Off állapotban a felsorolt fal-/membrán- és
   lencsekulcsok egyike sem jut renderhatáshoz: a warp, másodlagos kép, Einstein-glow,
   refraction-field perturbáció, vignetta, F5 overlay és a legacy falanyagok mind bypassolódnak.
   A kulcs diszkrét morph-snapet és cosmic-wormhole ownershipet kapott; a `vos-wh-*` presetek
   szándékosan user-global állapotként hagyják meg.
4. **Tesztek/mocks**: minden érintett backend mock megkapta az új primitívet. Az új
   `tests/wormhole-ring-tint.test.mjs` lefedi a 3/2 szektor-budgetet, az eltérő sávenergiát,
   optics/lens/chroma kapukat, determinizmust, export/backplate utat, aktív export targetet,
   annulus-gradienst és a composite-mód visszaállítását. A falteszt külön bizonyítja, hogy Off
   mellett a nemnulla összes fal/lencse sub-paraméter sem rajzol vonalat vagy glow-t.
5. **Render-smoke**: az élő helyi Vite-oldal betöltött, a tuning UI a kapcsolót alapból `Off`
   állapotban mutatta, az `On=1` / `Off=0` váltás működött, és nem volt böngészőkonzol-hiba. Audiofájl
   nem állt rendelkezésre, ezért a zenével hajtott pixel-szintű összehasonlítást a determinisztikus
   termékkód-harness helyettesítette; az export/backplate/chroma viselkedést ugyanaz a teszt közvetlenül
   mérte.

Validáció: bundled Node fallbackkal a TypeScript-check tiszta; Vite production build tiszta
(438 modul, csak a meglévő >500 kB chunk-figyelmeztetés); F5/clip/fal célzott tesztek 39/39
zöldek. A teljes suite 715 tesztből 713 zöld / 2 ismert bukás;
a két bukás továbbra is a T5 óta dokumentált, F5-től független
`wormhole-depth-integrity.test.mjs` pár.

---

### F6 — Háttér-alapanyag sűrítése a gyűrű-zónában

Cél: a gyűrű annyira jó, amennyi fény táplálja — a gyűrű-zónát metsző forráspontok
sűrítése, hogy a torlódás gazdag, folytonos fényívként olvasódjon.

Érintett fájlok: `src/visuals/CosmicWormholeIdentity.ts` (poolok), tesztek.

Teendők:

1. Új, kis "deep-field" pont-pool (pl. 600–1000 könnyű pont, konstruktor-allokált,
   seed-elt), amely CSAK akkor rajzolódik, ha a forrás-β a [0, ~2.5·θE] sávba esik
   (olcsó d²-kapu) és a lencse aktív — így a többlet-költség a gyűrű-zónára korlátozódik.
2. Performance módban a pool fele/negyede; budget-assert.
3. A meglévő skybox/csillag sűrűség változatlan (nem globális sűrítés).
4. Tesztek: kapu (lens=0 → 0 rajzolás), budget, determinizmus.

Elfogadás: build + tesztek zöldek; render smoke-on a gyűrű folytonos, szemcsés-villogás
nélküli fénytorlódásként olvasódik.

Prompt (új sessionben):

```text
Olvasd el a documents/audits/wormhole-true-lens-plan.md tervet (2.5 diagnózis és az F6
task), majd hajtsd végre az F6 taskot pontosan a leírás szerint: vezess be egy seed-elt,
konstruktor-allokált deep-field pont-poolt, amely csak a lencse-zónában (β < ~2.5·θE)
rajzolódik, performance módban csökkentett budget-tel. Írj teszteket a kapura, a budgetre
és a determinizmusra, futtasd a validációt (build, npm test, render smoke), és frissítsd a
terv Task-státusz tábláját.
```

**Eredmény (2026-07-19)**: az F6 elkészült.

1. **Deep-field pool**: a `CosmicWormholeIdentity` új, konstruktorban seedelt és egyszer
   allokált 800 pontos háttérpoolt kapott. A pontok forrás-β eloszlása az optikai tengely felé
   súlyozott, így a point-mass forward mapping valódi háttérfényből sűrít gazdagabb
   Einstein-ívet; nincs frame-delta állapot, twinkle vagy draw-loop allokáció.
2. **Szigorú optikai zóna**: minden pontot olcsó d²-kapu tart a `β <= 2.5·θE` forrássávban,
   és a teljes réteg csak aktív, opt-in lencsénél rajzolódik. A meglévő 1800 pontos csillagpool
   és 9000 pontos skybox-pool változatlan maradt, tehát ez nem globális sűrítés.
3. **Performance budget**: normál módban 800, performance módban fix stride-dal 400 pont
   rajzolódik. Mindkét út stabil pool-indexet és azonos konstruktor-owned adatot használ.
4. **Determinizmus és tesztek**: az új `tests/wormhole-deep-field.test.mjs` közvetlenül lefedi
   a konstruktor-allokációt, a változatlan háttér-budgeteket, az optics/lens kapukat, a 2.5·θE
   d²-korlátot, a 800/400 draw-budgetet, valamint az eltérő előzményből ugyanoda seekelt
   bitazonos kimenetet.
5. **Render smoke**: a helyi Vite app betöltött, a `vos-wh-establish` preset és az optikai
   On/Off kapu működött, a bekapcsolt kontrollképen megjelent a sűrített lencsézett
   háttéranyag, és nem volt böngészőkonzol-hiba. Audiofájl nem állt rendelkezésre, ezért a
   zenével hajtott végső esztétikai értékelés továbbra is szerzői kontrollt igényel.

Validáció: bundled Node fallbackkal a TypeScript-check tiszta; Vite production build tiszta
(438 modul, csak a meglévő >500 kB chunk-figyelmeztetés); az összevont F6/lencse/overlay/fal
célzott csomag 23/23 zöld. A teljes suite 719 tesztből 717 zöld / 2 ismert bukás; a két
bukás változatlanul az F5 óta dokumentált, F6-tól független
`wormhole-depth-integrity.test.mjs` pár.

---

### F7 — Preset-áthangolás + doksi + teljes validációs kapu

Cél: a 10 wormhole preset áthangolása az új optikai rétegekre; dokumentáció; teljes kapu.

Érintett fájlok: `public/visual-tuning-presets/vos-wh-*.json` (mind a 10),
`tests/wormhole-clip-profile.test.mjs`, `documents/features/visual-identities.md`, e terv.

Teendők:

1. Mind a 10 preset: fal-vonal csatornák 0 (F4), lencse-erő/sugár/swirl újrahangolva az
   új leképezésre; szerep-kontrasztok megtartva (establish/galaxy erős reveal, sparse
   visszafogott, collapse/punch erős swirl).
2. Overlay-szintek (F5) presetenként.
3. `wormhole-clip-profile` kontraszt-assertek frissítése; visual-identities doksi.
4. Teljes kapu: build, teljes `npm test`, render smoke mind a 10 presettel, seek/export
   determinizmus; e terv táblájának lezárása + szerzői kiértékelés kérése.

Elfogadás: minden preset renderel, tesztek zöldek, doksi naprakész; a szerzői kiértékelés
dönt az F8 szükségességéről és a legacy vonal-anyagok végleges törléséről.

Prompt (új sessionben):

```text
Olvasd el a documents/audits/wormhole-true-lens-plan.md tervet (F7 task + az F1–F6
státusz-jegyzetek), majd hajtsd végre az F7 taskot pontosan a leírás szerint: hangold át
mind a 10 vos-wh presetet az új optikai rétegekre (fal-vonalak 0, lencse/overlay szintek
szerep-kontraszttal), frissítsd a wormhole-clip-profile kontraszt-asserteket és a
visual-identities doksit, futtasd a teljes kaput (build, npm test, render smoke mind a 10
presettel, seek/export determinizmus), és zárd le a terv Task-státusz tábláját.
```

**Eredmény (2026-08-16, dokumentáció-audit során lezárva)**: a kód- és preset-oldali munka a
munkafában már elkészült egy korábbi sessionben (a jelen session ezt egy teljes dokumentáció-
átvizsgálás során találta befejezve, de a táblában és a doksikban nyitva jelölve); ez a bejegyzés
a tényleges állapotot rögzíti, plusz a most ténylegesen lefuttatott validációt.

1. **Preset-áthangolás**: mind a 10 `vos-wh-*.json` preset `wormholeWall: 0`-t authorál (a rajzolt
   fal-vonalak legacy/opt-in státuszban maradnak), és mind a nyolc új sub-kulcsot
   (`wormholeWallRefraction/Caustics/Waves/Cracks/Mode`, `wormholeLens/Radius/Swirl`) explicit
   szerzi szerep-kontraszttal: `establish`/`galaxy` a legerősebb lencse-reveal (`wormholeLens`
   0.9/1.0), `sparse` a leghalványabb (0.25), `collapse`/`punch` a legerősebb swirlt és
   nyomáshullámot kapja, `galaxy` a legszélesebb kausztika-showcase. Öt preset (`collapse`,
   `drift`, `galaxy`, `spiral` és a bennük lévő `circleHue`) átkerült a magenta/sárga családból a
   hidegebb, mozifilmes kék-fehér paletta (`circleHue` 190-235) sávjába; `punch`/`overdrive` szándékosan
   megtartja a magenta impact-identitást (300-350).
2. **Overlay-szintek presetenként**: az F5 `compositeRingTint` overlay-nek nincs önálló
   preset-kulcsa -- a szaturáció/expozíció-annulus erőssége a már retunolt `wormholeLens` mesterén
   keresztül skálázódik, tehát ez a Teendő a lencse-retune-nal implicit módon teljesül, nem külön
   authorált mezőn keresztül.
3. **Teszt-frissítés**: `tests/wormhole-clip-profile.test.mjs` öt új tesztet kapott: minden preset
   authorálja a fal- és lencse-kulcsokat a saját [0,1]/[0.1,1]/[0,1.5] tartományukban, egyetlen
   factory preset sem kapcsolja be a pixel-mozaik anyagmódot, a `collapse`/`punch` nyomáshullám- és
   a `galaxy` kausztika-kontraszt mérhető, és a lencse-erő/sugár/swirl valamint a hue-család a
   tervezett kontraszt-mátrixot követi (`sparse < establish <= galaxy`, `collapse`/`punch` swirl a
   család fölött, kék-fehér vs. magenta hue-sáv). `documents/features/visual-identities.md`
   Wormhole Tuning Group szekciója a jelen dokumentáció-audit korábbi lépésében frissült mind a 10
   új kulccsal és az F5 overlay-vel.
4. **Teljes kapu (ténylegesen lefuttatva ebben a sessionben)**: `npm run build` (`tsc && vite
   build`) tiszta, 438 modul, csak a meglévő >500 kB chunk-figyelmeztetés. `npm test` 719 tesztből
   717 zöld / 2 bukás; a két bukás (`tests/wormhole-depth-integrity.test.mjs`: "viewer route frame
   keeps the wormhole core centered..." és "spiral and overdrive keep foreground vanishing point
   lens-local...") `git stash`-sel a jelenlegi `HEAD`-en (a teljes F1-F7 munka nélkül) is bitre
   ugyanígy elbukik, ugyanazzal a hibaüzenettel -- tehát ez a session közvetlenül, nem csak a
   korábbi task-jegyzetek alapján megerősítette, hogy a két bukás F1-F7-től teljesen független,
   nincs új regresszió. Élő Vite dev szerveren keresztül a valós UI-n (nem a konzol-injektálásos
   harness) a `cosmic-wormhole` visual mode és mind a 10 `vos-wh-*.json` preset kiválasztható
   konzol- és szerverhiba nélkül. Audiofájl nem állt rendelkezésre ebben a sessionben sem (a canvas
   csak aktív lejátszás mellett méreteződik), ezért a pixel-szintű, zenével hajtott render-smoke a
   valós UI-n keresztül nem volt elvégezhető -- ez pontosan ugyanaz a korlát, amit F5/F6 már
   dokumentált, és amit azok a konzol-injektálásos, dinamikus ESM-importos Canvas2D-harness
   technikával (lásd F1/F3/F6 render-smoke jegyzetei) kerültek meg a mögöttes primitíveken
   (lencse-warp, fal-törésmező, gyűrű-tint, deep-field) elvégzett méréssel; ez a réteg-szintű
   bizonyíték változatlanul érvényes, csak a teljes 10-preset UI-n át futó vizuális bejárás maradt
   el ebben a dokumentáció-fókuszú sessionben.
5. **Nyitva marad**: az F7 "Elfogadás" pontja szerinti szerzői vizuális kiértékelés (hogy a
   tényleges zenei lejátszás mellett a retunolt presetek elérik-e a referencia-olvasatot, és hogy
   szükséges-e F8) kizárólag a felhasználó döntése -- ez a dokumentáció-audit ezt nem helyettesíti,
   és nem is jelöli KÉSZ-nek F8-at emiatt.

---

### F8 — (opcionális) kép-terű refrakció kísérlet — csak F7 kiértékelése után

Ha a vektoros valódi-lencse (F1–F6) a szerzői kiértékelés szerint sem éri el a referenciát,
a következő lépcső a folytonos kép-torzítás: (a) Canvas2D annulus-os self-`drawImage`
refrakció feature-flag mögött (a háttér offscreen targetre renderelése + koncentrikus
gyűrű-szeletek θ+-leképezés szerinti átmásolása), vagy (b) WebGL/shader per-pixel út —
ez utóbbi ADR-t igényel (kompozitor/export/chroma-lánc). A döntés maga a task elindítása;
e terv szándékosan nem részletezi tovább, amíg az F1–F7 eredménye nincs kiértékelve.

## 5. Kőbe vésett szabályok (minden taskra)

- A lencse-warp képernyő-terű, vetítés utáni transzformáció: nem írhat route headinget,
  travelPhase-t, kamerát, és nem hat vissza a vetítési mélységre.
- Minden új effekt determinisztikus `(travelDistance, canonicalTime, seed)` függvény;
  tilos a frame-delta és a `Math.random`.
- Zéró allokáció a draw-loopban; scratch a konstruktorban.
- Spektrum geometriát soha nem hajt: F4 törésmezőjének bemenete a travel/idő, a spektrum
  kizárólag fényerőt/szaturációt modulál (F5).
- `wormholeLens=0` → bitre a lencse-mentes kép (a meglévő teszt-kontraktus végig érvényes).
- Backend-bővítés csak F5 keretében, single-agent ownershippel.
- A grain-réteg (cső belseje, por) érintetlen — a warp továbbra sem hat rá.

## 6. Kockázatok

| Kockázat | Kezelés |
|---|---|
| Streak-húr artefakt: gyűrű-közeli csík a torkon átvágó egyenesként rajzolódik | F1 húr-őr: szög-küszöb + warpolt felezőpontos ívre bontás, fix vonal-budget |
| Teszt-churn: a régi nyelő-leképezésre írt monotonitás/geometria asszertek tömegesen fordulnak | F1 explicit teszt-csere feladat; az érintett fájlok listázva; lens=0 izolációs konvenció változatlan |
| `globalCompositeOperation` szivárgás (F5): egy korai return után minden további rajzolás rossz módban | kötelező source-over visszaállítás + dedikált teszt a visszaállításra |
| Composite-overlay az export/chroma úton | chroma-key teljes skip; export-target teszt a T7 `radialDim` mintájára |
| A másodlagos kép (F2) zavaros "szellemképnek" olvasódik | erős β-lecsengésű alfa, budget-kapu, perf-skip; F7 preset-szintű visszavehetőség |
| A törésmező (F4) tengeribetegség-szerű imbolygás | ≤8% perturbáció-korlát + csak advektált (egyirányú) fázisok — oda-vissza oszcilláció tilos |
| Vonal-budget növekedés (F2 másodlagos + F6 deep-field) | a fal-vonalak kioltása (F4) nagyságrendben fedezi; budget-assertek |
