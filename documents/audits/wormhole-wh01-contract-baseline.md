# WH-01: közös frame-szerződés és változatlan referenciacsomag

Dátum: 2026-11-07, Europe/Budapest. Integrációs tulajdonos: a jelen munkamenet.
Tulajdonosok: `types` a frame-azonosságért; visuals a referenciaképért;
export a későbbi job/encoder ütemezésért; docs a kapukért. Audio, State és UI
tulajdonosi átadás ebben a részfeladatban nincs.

Az [epic](cross-host-wormhole-rendering-epic.md) WH-01 része elkészült.
Ez mérési és szerződéses alap, **nem bekötött GPU-gyorsítás**. A következő
lépés WH-02: ugyanennek a rögzített anyag-/vonalbemenetnek a GPU-s próbája.
A dashboard, MVP és XR éles renderútja, presetjei, exportminősége és menüje
ezen a ponton változatlan. A két korábbi CPU-worker jelölt negatív eredménye
megőrzött kontroll; nincs publikált Turbó-kapcsoló vagy gyorsulási állítás.

## 1. Frame-azonosság és ütemezés

A [WormholeRenderFrame](../../src/types/WormholeRenderFrame.ts) közös,
adatjellegű `protocol: 1` stampet és szigorú határvalidátort ad. Ez külön
névtér a meglévő preview-v1 és exact-v2 worker-protokolloktól; azok üzeneteit
most nem változtatja meg. Az aktív runtime még nem importálja ezt a modult.

Minden stamp tartalmazza a `contextId`, `generation`, `requestSerial`,
`presentationRevision`, `songTime`, `mode` mezőket. Exact módban a `jobId`,
`frameIndex`, `fps` és `timestampUs` is kötelező. Az azonosítók nem üresek,
legfeljebb 128 karakteresek; a számlálók biztonságos egészek. Hiányzó,
örökölt, ismeretlen mező, NaN, negatív idő és nem támogatott fps elutasított.
Az exact óra szigorúan `frameIndex / fps`, a timestamp
`round(frameIndex * 1_000_000 / fps)`, 30 vagy 60 fps mellett, tűrés nélkül.
A `sameWormholeRenderFrame` a már validált mezők mindegyikét összeveti.

A későbbi session tulajdonosi szabályai:

- Preview időforrása az AudioEngine. Exact exporté a frame-index; nincs
  preview lead, kijelzőhöz várás vagy preview felbontási korlát az exportban.
- Új analízis/plan/seed publikálása és reset új generáció. A normál
  automatizációs pont átlépése nem generációváltás. Méret, quality, backend,
  átlátszóság és megjelenítési policy változása presentation-revízió.
- Egy frame képe és társadatai atomikus csomag. Eltérő context, generáció,
  revízió vagy kérés esetén a visszakapott bitmapet le kell zárni; a rétegeket
  nem szabad más pillanatból összepárosítani.
- Preview: legfeljebb egy folyamatban levő kérés és egy legfrissebb igény.
  Exact induló kerete egy render és két encoder-frame; nincs korlátlan sor.
  Stop prefixhatárt rögzít, Cancel fölé kerül; retry új job-azonosságot kap.
- A session birtokolja a contextet, targeteket és erőforrás-lease-eket.
  A presenter/encoder a befejezett frame-et csak kölcsönzi. Drain, hiba,
  Cancel, context loss és supersede esetén is egyszeri takarítás kell.
- Nincs globális State-csere, AudioEngine import a workerben, async p5 draw,
  másodszor alkalmazott makró vagy új zeneelemzés renderelés közben.

Ezek a WH-03/04/06 bekötés elfogadási szabályai, nem már működő új broker
vagy teljes kanonikus időmintavételező bizonyítékai.

## 2. Szűk shaderhatár

Az AGENTS, architecture contract és ADR-009 egyetlen tiszta levélmodult foglal
le: `src/visuals/gpu/WormholeGpuShaders.ts`. Csak az XR GrainMaterialRenderer
és GrainLineRenderer GPU-adapterei importálhatják. A levél shaderforrást és
konstanst tartalmazhat, importként csak a közös grain material/line
adatkontraktusokat használhatja. Three, DOM, state, UI, audio, planning és
GPU-erőforrás létrehozása tilos benne. A tényleges kiemelés WH-02; most nincs
üres placeholder vagy új Three-függőség a 2D hostokban.

A gameplay-purity importguard csak ezt a pontos fájl/adapterszűkítést engedi;
az XR egyéb visual-runtime importtilalma megmarad. ADR-011 a közös context,
ADR-012 az export session tulajdonlását pontosítja. A belső exact session nem
hozza vissza az MVP Isolated Wormhole exportválasztását, a párhuzamos
workspace-szerkesztést vagy a régi fix memóriafeloldó kapcsolót.
Mind a nyolc kiegészítő governance dokumentum driftellenőrzést kapott;
csak architecture és worker communication igényelt módosítást.

## 3. Referenciacsomag és reprodukció

A [capture](../../research/export/wormhole-baseline-capture.mjs) a tényleges
WormholeFrameContext és Canvas2D backend változatlan skalár anyagútját futtatja.
Nyolc eset: dashboard-depth 0 és MVP-depth .6, mindkettő két egymást követő
1/60 s-os pillanattal; sűrű anyag; fordított spirál portréban; transzparens;
anyag kikapcsolva. Alapméret 640x360, portré 360x640. T = 3 s.

**Ez szintetikus kernelreferencia.** A dashboard/MVP elnevezés depth-policyt
jelent; nem teljes hostsession vagy valódi No Good-export felvétele.
Kézzel megadott, statikus 24 sávos spektrum és energia/fluxus biztosít látható
világos anyagot és sötét peremeket. Nincs új DSP, kézi zenei ground truth,
codec- vagy teljes lejátszási egyezési állítás. A stamp exact jelölése az óra
azonosságát bizonyítja, nem a különböző előtörténetek kanonikus egyezését.

Esetenként a csomag tartalma:

- Teljes tuning, semleges makrók, boostok, explicit raw-gain policy, seed,
  szerződéses stamp és az authored jel leírása.
- Skalár végső RGBA8 kép és az external material/line passzok nélküli alap.
- Nyers carrier: 15 float64 little-endian mező. Előkészített material:
  24 float32 little-endian mező; line: 9 float32 little-endian mező.
  Csak az aktív tartomány kerül a csomagba, SHA-256 minden bájtsorhoz.
- Az observer collector nyers carrierfolyamának skalár újrajátszása az eredeti
  L0/L1/L2 Float32 pufferekkel **bájtpontosan** egyezik. Két külön contextből
  ismételt kép/base/carrier/material/line hash minden esetben egyezik.

A [CLI](../../research/export/wormhole-baseline.mjs) külön Vite buildből,
loopback-only szerveren és headless Chrome-ban rögzít. Minden futás új UUID-s
könyvtár; forráslista/hash, Git alapazonosság és dirty állapot, bundlehash,
RGBA/adatcsomag, ellenőrzési JSON és képgaléria megmarad. A 64 MiB-os POST
csak ugyanarról az originről fogadható, fájlírás egyszeri. Az `active-run.txt`
csak a capture és a host smoke sikeres befejezése után frissül.

```powershell
node research/export/wormhole-baseline.mjs capture
node research/export/wormhole-baseline.mjs verify
node research/export/wormhole-baseline.mjs verify <mentett-baseline.json>
```

A verifier ellenőrzi a verziót, policyt, esetsorrendet, clockot, formátumot,
stride/count/byte-hossz egyezést, kanonikus base64-et, SHA-t, véges floatokat
és az ismétlések hashét. Ez sérülésellenőrzés, nem független GPU-render.
A nagy csomagok és galériák az ignored `logs/wh01/` alatt maradnak; forrásuk
verziózott, nincs új termékbeli automatikus naplófájlhalmozás.

Az első látható authored-signal baseline:
`run-24ff3702-aa1e-436b-857e-55379b63803d/baseline.json`, 25,070,281 bájt,
SHA-256 `937b39bf0a1c2f0b77abc8cdde91654a3840e41b95aecbbb0a98b0245573270f`.
Összesen 17,797 nyers carrier, legnagyobb eset 4,488; material-off: 0.
A végső forrással készült ismétlés az alábbi átadási eredményekhez tartozik.
A korábbi, kevésbé látható üres-jel capture-ök és az első sikertelen host
smoke eredményei megmaradtak; nem írtuk át őket sikeres eredménnyé.

## 4. A GPU-jelölt előtt rögzített képi kapuk

A [QUALITY_POLICY](../../research/export/wormhole-quality.mjs) verziója
`wh-01-rgba-v1`. Ezek projektbeli mérnöki célértékek, nem univerzális iparági
szabványok. Mindegyiknek teljesülnie kell ugyanazon bemenet mellett.

| Mérték | Felső határ |
| --- | --- |
| Átlagos abszolút RGB eltérés | 1.5, 8 bites sRGB kódértékben |
| RGB eltérés 99. percentilise | 8 |
| Átlagos alfaeltérés | 0.5 |
| Legnagyobb 8x8 sötét régió előjeles luma-átlaghibája | 0.75, referencia luma <= 32 |
| Szomszédos pixelek luma-hibakülönbségének átlaga | 1.5 |
| Két frame közötti előjeles lumaváltozás eltérése | 1.5 |

Az RGB, sötét régió és időbeli összevetés fekete és fehér háttérre kompozitált
straight-alpha képen a rosszabbik eredményt veszi; láthatatlan RGB nem növeli
a hibát. A spatial kapu a fekete kompozit hibagradiensét vizsgálja.
Az alfa külön kapu. Ez a lokális sötét foltot, rácsot és visszafordított
mozgást is képes elutasítani alacsony globális hiba mellett. SSIM önmagában
nem elfogadás; a sötét gradiensek és mozgás kézi ellenőrzése is szükséges.
Nincs automatikus küszöblazítás: eltérés vizsgálatot és dokumentált döntést kér.
Az RGBA8 kernelkapu nem helyettesíti a megőrzött 10 bites export validálását.

## 5. Teljesítmény- és erőforráskapuk, még nem mért eredmények

Export: legalább három váltott kontroll/jelölt pár, azonos felbontás,
anyagfelbontás, seed, tuning, analízis, fps, bitráta és codec mellett.
Külön kontroll az eredeti éles export, az új Takarékos út és a Turbó.
Legalább 15% kisebb medián teljes jobidő az állított célokon; legfeljebb
5% lassulás a védett célokon, azonos minőséggel. A hideg előkészítés és meleg
futás külön eredmény. Az átfedő részidőket nem adjuk össze. A gyors alaputat
nem szabad mesterségesen lassítani a Turbó látványosabbá tételéhez.

Preview induló, hostonként vizsgálandó CPU-kerete: Wormhole submit/compose
p95 <= 4 ms / p99 <= 8 ms desktopon, p95 <= 6 ms / p99 <= 12 ms fizikai
mobilon; felhasználói parancs-visszajelzés p95 <= 100 ms, nincs a Wormhole-nak
tulajdonítható >= 50 ms főszálas feladat. A már Offscreen MVP kontrollján
legfeljebb 5% regresszió engedett. A dashboard előtt/után külön mérendő.
Ezek a GPU-n történő teljesítés idejétől külön CPU-/interakciós keretek;
nem az összes eszközre tett sebességígéretek. Most mind **unmeasured**.
WH-04/05 instrumentációval igazolja a CPU material raster/pixelkonverzió
hiányát a főszálról a gyors úton, továbbá a kész frame-ek valós pacingjét.

Erőforrás induló korlát: egy front/pending kép, egy render, két encoder-frame,
véges carrierpool és lazy targetek; a pontos felületszám adapterfüggő leltár.
Egy UHD RGBA8 kép 31.64 MiB; 640x360 RGBA Float32 anyagtarget 3.516 MiB,
RGBA16F 1.758 MiB. Minden további codec/GPU/base/bloom target külön számít.
Nincs a rendszer szabad RAM-ját GPU-memóriának tekintő döntés, univerzális
384 MiB-os tiltás vagy mobil 4K tiltás. A meglévő admission/képességpróbák
és tárhelykorlátok megmaradnak. Valós peak/termikus adatot WH-08 előtt
nem állítunk mértnek; kontextusvesztés/fallback/cleanup külön próba.

## 6. Validáció, megőrzött elődök és lefedési határ

Új Node-esetek: preview/exact clock és frame-azonosság; hibás/örökölt mezők;
kép-/sötétrégió-/alfa-/spatial-/temporal kapuk; sérült mentett csomagok.
Az új nyolc teszt sikeres. A célzott hét fájl: 106/106 sikeres.
`npm run build` (tsc + Vite) sikeres, csak a meglévő chunkméret-figyelmeztetés.

```powershell
node --test --test-reporter=tap tests/wormhole-render-contract.test.mjs tests/gameplay-purity.test.mjs tests/wormhole-host-worker.test.mjs tests/wormhole-frame-context.test.mjs tests/wormhole-grain-material-integration.test.mjs tests/mvp-macro-tuning-mapper.test.mjs tests/contracts.test.mjs
npm test -- --test-reporter=tap --test-concurrency=4
npm run build
git diff --check
```

A teljes regresszió eredménye és a végső capture az átadási rekordban lent.
A suite a munkapéldányon belüli TEMP/TMP könyvtárral fut, normál Windows
folyamatjogokkal; a korábbi sandbox-folyamatindítási hibák nem teszthibaként
vannak elrejtve. Nem volt dependency-telepítés vagy Bun-fallback. A Bun-os
deploy script helyett a meglévő `node scripts/release-pages.mjs` végzi a
prepare/publish/verify folyamatot. `diff_export.ps1` nem szükséges ehhez a
szelethez; közvetlen teljes és fájlonkénti Git-diff ellenőrzés készült.

A valódi Chrome host-backend smoke mind a 16 sora sikeres, a worker- és
CPU/WebGL-kapukkal együtt. Ez a valós renderer rögzített órás facade-próbája,
nem AudioEngine-nel futó teljes dashboard/MVP vagy fizikai Quest elfogadás.
Az új galéria képi ellenőrzése megtörtént: látható anyag, portré és off eset.

Két módosított teszt pontos elődje megmaradt:

- [host smoke előd](../tests/wormhole-host-backend.pre-wh01.html), SHA-256
  `b79a219da1cc494964082a30246d441c95fe59fccd39cd51b26005855d7ddae5`.
  Az előd tévesen gain-alkalmazásnak számolta a tiszta `getTuningForMorph`
  olvasásokat: tényleges `[1,1,2]`, várt `[1,1,1]`. Az új próba egyszeri
  PostFX/director futást, változatlan raw targetet és az összes projection
  input azonosságát ellenőrzi; a getterhívások száma diagnosztika.
  A valódi makróalkalmazás egyszeriségét az MVP mapper-regresszió is védi.
  Az eredeti pixel-, worker-, célizolációs és átmenetkapuk változatlanok.
- [purity előd](../tests/gameplay-purity.pre-wh01.mjs), SHA-256
  `7f15cda3b4f52087148efd93558ca868908cf500d65d32adabd7fa642d8d2cba`.
  Csak a pontos két adapter/tiszta shaderlevél kivétel új; nincs általános
  `src/visuals` importengedély. A konkrét shaderlevél tisztasági tesztje az
  első tényleges kiemeléssel, WH-02-ben kerül mellé.

| Bizonyíték | Állapot |
| --- | --- |
| Nyolc szintetikus input/kép és ismételt byte-azonosság | Automatikusan és Chrome-ban ellenőrzött |
| Skalár carrier replay L0/L1/L2 és artifactintegritás | Sikeres |
| Valós host renderer/worker smoke | 16 sikeres sor |
| Közös GPU-kernel numerikus/képi egyezés és sebesség | WH-02, még nincs jelölt |
| 24/30/36/60 Hz és történetfüggetlen canonical timeline | WH-03b |
| Mindhárom teljes host, fallback, context loss, hosszú playback | WH-04/05/08 |
| Valódi No Good 47-60 s és 85 s sötét rész, három referenciazene, teljes export | WH-02/06/08; korábbi 10 bites export bizonyíték történeti kontroll |
| Új tényleges WebM/MP4 videó, bitmélység, hang/Stop/Cancel | WH-06; most nem módosult codec/renderút |
| Fizikai mobil/Quest, peak memória, tartós hőterhelés | Nem futott; WH-08 kapu |

## 7. Átadási rekord

A teljes kumulatív futás: **2144 teszt, 2135 sikeres, 9 hiba, 0 skip/cancel**,
577,425.8 ms. Mind a kilenc hibanevét és pontos hibaüzenetét gépi összevetés
igazolta a megőrzött `logs/timing-cleanup/baseline-failures.json` ellen;
új eltérés nincs. Az érintett hét fájl 106/106, a végső nyolc új teszt
külön ismétlése 8/8 sikeres. Az összes korábbi 288 test-tree fájl megmaradt;
csak a fent dokumentált két teszt változott. Aktív Node-fájlok száma: 223.

Végső capture: `logs/wh01/run-c63b8c2f-55bf-4a81-9187-ed90a140951c/`.
A teljes 25,070,281 bájtos csomag hash-e változatlan:
`937b39bf0a1c2f0b77abc8cdde91654a3840e41b95aecbbb0a98b0245573270f`.
Mind a nyolc eset összes kép/base/raw/material/line hash-e egyezik az első
authored-signal baseline-nal. A végső forrásleltár a host smoke HTML-jét is
tartalmazza. `build.json`, `host-smoke.json`, `verification.json` és
`reference-gallery.png` ugyanebben az egyedi könyvtárban található.
A részletes, eredmény- és elődhash-eket is tartalmazó helyi nyugta
`logs/wh01/acceptance.json`; a korábbi sikertelen/üres-jel futások megőrzöttek.

Kiadás: a meglévő guarded Pages prepare/publish/verify útvonalon, külön
epic-terv és WH-01 implementáció kommitból. A tényleges éles ellenőrzés
eredménye a munkamenet átadásában és a Pages release nyugtájában szerepel.
Következő task: **WH-02 GPU anyag-/vonalkernel próba**, külön felhasználói
folytatás után. A WH-01 átadásánál nincs új 4K teljesexport-próbaigény;
a jelenlegi lejátszás és export használhatóságának rövid ellenőrzése elegendő.
