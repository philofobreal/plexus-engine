# WH-03a: közös, viselkedésmegőrző frame-előkészítés

2026-11-07, Europe/Budapest. Kiinduló forrás: `f05963a`.
Integrációs tulajdonos: a jelen munkamenet; érintett: visuals/config adatelőkészítés,
types, a meglévő host-worker producer és dokumentáció. Audio, UI, worker render,
codec és export job nem kap új tulajdonost.

Az [epic](cross-host-wormhole-rendering-epic.md) WH-03a lépése a már elfogadott
WH-02 GPU-mag előtt szükséges adatelőkészítési határt választja ki. A p5
dashboard/MVP és a privát WormholeFrameContext ugyanazokat a tuning-,
szemantikus vetítési és signal-aritmetikai függvényeket használja. A különböző
idő-/eseménypolicyk megőrzése szándékos; egységesítésük WH-03b.

## Kód és tulajdonosi határ

| Kód | Feladat |
| --- | --- |
| [VisualFramePreparation](../../src/visuals/VisualFramePreparation.ts) | Gainfeloldás, szemantikus base/target másolatok, morph és render-overlay; immutable analízis másolása; moduláció/director közös aritmetikája |
| [HostVisualFramePreparation](../../src/visuals/HostVisualFramePreparation.ts) | A p5 callbackből kiemelt szemantikus cursor/cache, tervcsere és visszafelé mintavétel, hostportok és transition callback |
| [PlexusRenderer](../../src/visuals/PlexusRenderer.ts) | AudioEngine-/exportóra, idle gate, fade/rotation, eseménycursor és shockwave, UI invalidálás, kompozíció és PostFX |
| [WormholeFrameContext](../../src/visuals/WormholeFrameContext.ts) | Saját seed/state, előkészített assetek, preset és finite/spirál orchestráció, explicit embedded policy és identity-prezentáció |
| [WormholeHostFrame](../../src/types/WormholeHostFrame.ts) | Új belső ResolvedWormholeFrameView v1; a meglévő wire-sémák változatlanok |
| [Host-worker producer](../../src/visuals/WormholeHostWorkerSource.ts) | Az előkészített view értékeit a korábbi packetbe teszi; a worker csak renderel, nem oldja fel újra a gain/preset/director állapotot |

A két új modul nem importál State-et, UI-t, AudioEngine-t, p5-öt, DOM-ot,
GPU-t vagy új zenei detektort. Nincs modulglobális contextállapot. A hostport
csak a már meglévő szinkron tuning-/automation műveleteket hívja. A gain,
morph és projection kódja egy helyen van; a presetek offline betöltése és a
host-specifikus kiválasztása a meglévő tulajdonosánál marad.

`beginTuning` sorrendje: resolved target -> szükség esetén másolat -> lazy base
feloldás -> előző render-overlay visszaállítása -> morph/snap. Ezután a host
finite/spirál csatornája fut, végül `finishTuning` egyszer alkalmazza a jelenlegi
szemantikus deltát. A másolat szükséges, mert az MVP egyetlen újrahasznált
gainbuffert ad vissza mindkét kérésre. A raw target/base nem kap halmozott gaint.

A bus és director egyszer fut a már publikált live frame-en. A host megőrzi
a directorOutput objektumát és annak mezőit frissíti; az embedded context a
korábbi módon lecseréli a kimeneti objektumot. A modulációs buffer mindkettőnél
újrahasznált. A publikus analízis nem válik a mutálható live frame-mé.

## Explicit megőrzött policyk

| Terület | Dashboard/MVP host | Embedded context |
| --- | --- | --- |
| Óra/dt | AudioEngine vagy exportóra; meglévő tuningMorphDeltaSec | Adapter adja a time/dt/jump/snap értékeket |
| Fade | Meglévő targetFrameRate lépés és pause fade-out | Meglévő dt emelés; pause alatt megőrzés |
| Beat/dense/cue | Eseménycursor után a meglévő hívásonkénti decay | Legutóbbi esemény bináris keresése és abszolút transientDecayAfter |
| Frame-másolás | Explicit mezők, hiányzó sub/bass érték 0 | Korábbi Object.assign policy, hiányzó mező megőrzése |
| Lookahead | Csak aktív lejátszás/export | Korábbi embedded elérhetőség pause alatt is |
| Hiányzó buildup/pivot | Korábbi falsy -> 0 | Korábbi nullish -> 0 |

Ezeket most nem korrigáljuk és nem nevezzük history-/fps-független kanonikus
mintavételnek. A frame-számfüggő fade/decay és eltérő kadenciák javítása a
WH-03b feladata, az itt rögzített elődök és bizonyítékok mellett.

## Belső resolved view és worker-kompatibilitás

A view `version: 1`, `tuningStage: resolved`, `ownership: borrowed-until-clone`
jelölést hordoz. A `visualTuning` már gaint kapott; a `targetTuning` az eredeti
raw cél/provenance marad. A view nem tartalmaz teljes analízist, preset assetet,
DOM-ot, renderert vagy függvényt. A mezők kölcsönzöttek, nem mélyen fagyasztott
pillanatfelvételek: await fölött nem tarthatók meg.

A host producer szinkron módon unwrapolja a values-t, az eredeti mezősorrenddel,
majd a meglévő postMessage szinkron structured clone-ja lezárja a pillanatot.
Az új belső verzió nem kerül bele a preview-v1 wire-ba; exact-v2 és a WH-01
frame-stamp sem változik. Mély másolatot a clone utáni fogyasztó birtokol.
Új session/lease, háttérmunka, worker-/GPU-bekötés, pacing vagy menü nincs ebben
a taskban. A régi Isolated Wormhole exportválasztó nem tér vissza.

## Független előd-összevetés és tesztek

A [Visual frame preparation tesztek](../../tests/visual-frame-preparation.test.mjs)
két külön VM/module-cache alatt futtatják a megtartott régi és az új valódi
PlexusRenderer/WormholeFrameContext kódot. A p5/identity rajzolóperem kontrollált;
a tuning, bus/director, szemantikus és automation-függőségek ténylegesek.
Ez adatelőkészítési összevetés, nem teljes történeti böngészőbundle-replay.

Lefedés: raw/meta és újrahasznált gainbuffer; active/pause/settled idle;
exportóra a live órától eltérő helyen; forward/backward seek; természetes end;
motif/score és időalapú semantic bridge; tervcsere/eltávolítás, flag-/stílusváltás;
private preset/presentation/rewind. Az összevetés a resolved/target tuningot,
frame/features/modulation/directort, fade/transienseket, transition/anchor és
choreography adatokat nézi, továbbá a gainhívások teljes bemeneti sorát és az
event/UI hívásszámot. A bemeneti analízis változatlansága külön assertion.

Önálló elvárt-érték tesztek védik a borrowed view verzióját/clone-izolációját,
a hiányzó mezők és lookahead explicit policyját, a bus újrahasználatát és a
gain/base/channel/semantic sorrendet. Utóbbi konkrét .4 base + .1 csatorna + .8
szemantikus delta = 1.3 eredményt kér számon, és elutasítja a dupla overlayt.
Import/AST guard védi a data-only modulhatárt.

Megőrzött elődök:

- [PlexusRenderer](../tests/PlexusRenderer.pre-wh03a.ts), SHA-256
  `997de9c01073809618bc39d84df0d523a18972f2d669b5fa02970d94854fbac8`.
- [WormholeFrameContext](../tests/WormholeFrameContext.pre-wh03a.ts), SHA-256
  `43f522dca0bf810dc4ce10aef68ca19a906ee3a0a4a66aa9a5d4c6dc6c9e1d62`.
- [Contracts](../tests/contracts.pre-wh03a.mjs) és
  [performance guards](../tests/performance-optimizations.pre-wh03a.mjs): a
  kiemelt kód ellenőrzése az új tulajdonos fájlját és a bekötést is nézi;
  immutability, semantic gating, cursor/memo és lookahead feltételek megmaradtak.
  A korábbi helyhez kötött öt failure eredménye is megőrzött az első célzott logban.
  Előd SHA-256-ok: contracts
  `417e51e381fad09248a9fc6cbe727957cc4349b7124db94de63032fbe66737e0`,
  performance guards `dc346725a0ebfdfccf70d53f6f98bd63ebb09217eb71a7dec65e75b3077fc80d`.

A WH-01 nyolcesetes raw/base/material/line/kép csomagja ismét azonos SHA-256:
`937b39bf0a1c2f0b77abc8cdde91654a3840e41b95aecbbb0a98b0245573270f`.
A 16 soros valódi Chrome host/worker/composition smoke szintén sikeres.
A static kernelreferencia nem teljes No Good lejátszás és nem 4K-kodekpróba;
a state-oracle és a renderer smoke külön bizonyíték, egyik sem helyettesíti
a későbbi kanonikus idő- vagy teljesexport-kaput.

Validációs parancsok:

```powershell
npm run build
npm test -- --test-reporter=tap --test-concurrency=4
node --test --test-reporter=tap tests/visual-frame-preparation.test.mjs tests/paused-renderer.test.mjs tests/wormhole-frame-context.test.mjs tests/wormhole-host-worker.test.mjs tests/semantics-integration.test.mjs tests/mvp-macro-tuning-mapper.test.mjs tests/contracts.test.mjs tests/performance-optimizations.test.mjs tests/wormhole-exact-frame.test.mjs tests/wormhole-exact-worker.test.mjs tests/export-deterministic.test.mjs tests/visual-mode-transition.test.mjs tests/postfx-fragmentation.test.mjs tests/wormhole-lifecycle.test.mjs tests/wormhole-determinism.test.mjs
node research/export/wormhole-baseline.mjs capture
node research/export/wormhole-baseline.mjs verify
git diff --check
```

Node/npm az elérhető projekt-runtime; nincs dependency-telepítés. A teljes
tesztkör workspace TEMP/TMP mellett fut normál Windows folyamatjogokkal.
A Bun-os deploy script helyett a meglévő `node scripts/release-pages.mjs`
prepare/publish/verify őrzi a forrás és a kiszolgált fájlok azonosságát.
Diff-export snapshot nem szükséges; a közvetlen diff és az elődazonosságok
ellenőrzése készült.

Végső eredmény: **196/196 célzott teszt** 15 fájlban. A teljes kumulatív kör
**2164 eset, 2155 sikeres, 9 hiba, 0 skip/cancel**, 475,605.6 ms. A kilenc
hibanevet és pontos hibaüzenetet gépileg összevetettük a megőrzött baseline-nal;
mind egyezik. Az új, konkrét morph-sorrend teszt a teljes kör fájlbetöltése után
került a 196-os célzott körbe: a futások uniója 2165 eset, 2156 sikeres és
ugyanaz a 9 hiba; nem állítunk második teljes futást. 225 aktív Node-fájl,
mind a 291 korábbi test-tree fájl megőrzött. Csak a fent dokumentált két
helyhez kötött szerződésteszt módosult, az eredetiek archiválva.

A végső static képcsomag `logs/wh01/run-22f9918f-d5c8-4e2c-a2b1-cb739ba3fada/`
alatt van: 8 ismételt referencia, változatlan teljes csomaghash és 16 sikeres
host/worker sor. Helyi nyugta: `logs/wh03a/acceptance.json`, az összes aktív teszt,
előd és log hash-ével. Build sikeres; csak a meglévő Vite chunkméret-figyelmeztetés.
Fizikai mobil/Quest, új teljes No Good-/4K-videó és sebességmérés nem futott:
ezek nem a viselkedésmegőrző adatréteg-refaktor promóciós állításai. A tényleges
source/release-azonosság és éles ellenőrzés a kiadási nyugtához kerül.

## Kézi átadás és következő lépés

Elvárt felhasználói eredmény most a megszokott látvány és vezérlés megőrzése.
Rövid MVP/dashboard lejátszás, pause, visszatekerés, preset-/makróváltoztatás
elegendő; nem szükséges új teljes 4K videót exportálni. A GPU-gyorsítás éles
bekötése WH-04/05/06; ebben a taskban nem állítunk gyorsulást.
Következő: **WH-03b kanonikus idő**, a kézi elfogadási megálló után.
