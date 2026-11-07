# WH-02: közös GPU-anyagmag és böngészős összehasonlító labor

2026-11-07, Europe/Budapest. Tulajdonos: visuals/GPU; XR csak shaderadapter;
research a próba és mérés; build a külön laboroldal; docs az eredmények.
Audio, analízis, State, automatizáció, codec és éles host/export ütemezés nem változik.

Az [epic](cross-host-wormhole-rendering-epic.md) korai megvalósíthatósági próbája.
**A GPU-anyagút minőségi kapuja teljesíthető. A teljes GPU-vonalprofil még
nem minősített.** A referenciafedettséget őrző laborprofil a Canvas-vonalakat
ugyanabban az Offscreen workerben rajzolja, miközben az anyagot, weave-et,
resolve-ot és bloomot a GPU számolja. Ez még nem gyorsított éles export.

## Mit készítettünk?

- [WormholeGpuShaders](../../src/visuals/gpu/WormholeGpuShaders.ts): tiszta közös
  shaderlevél. Az eredeti kilenc XR shader szövege változatlan; a
  `1cf7f56` kommitból külön rögzített SHA-256 fixture mindet védi.
  Az XR Three-adapterek ugyanazokat a stringeket importálják, azonos
  uniformokkal, targetekkel és ütemezéssel. Az XR nem kap új defaultot.
- [WormholeGpuRaster](../../src/visuals/gpu/WormholeGpuRaster.ts): Three nélküli,
  workerben is használható WebGL2-adapter. Instanced carrierquads, additív
  float akkumuláció, resolve, emissziós bloom gather, referencia-IIR,
  alfahelyes Bayer-kvantálás és végső kompozíció. Korlátos input/targetek,
  újrafelhasznált erőforrások, explicit resize, hibajelzés és idempotens dispose.
- [Worker](../../research/export/wormhole-gpu.worker.ts): külön kutatási v1 wire,
  soros kérések, WH-01 stamp, ellenőrzött typed carrieradatok. Bitmap és raw
  readback külön, a fogadó oldalon explicit bitmap.close. Hibás kérés után
  context/erőforrások felszabadítása, új kérésből új adapter.
- [Labor](../../research/export/wormhole-gpu.html): külön Vite entry. Eredeti
  skalár kép, GPU-kép és nyolcszoros különbségkép; Float16/Float32 akkumuláció,
  Canvas-referencia vagy kísérleti GPU-vonalprofil. Ezek laborvezérlők,
  nem játékos-/exportbeállítások; nem írják át a host storage-ot.
- [Runner](../../research/export/wormhole-gpu-spike.mjs): a változatlan WH-01
  csomagot pontos SHA-256-tal kéri számon, saját UUID-s buildet, forrás- és
  bundle-leltárt, reportot, képet és host-smoke eredményt őriz meg.
  A publikált labor ugyanazokat a szintetikus kontrollokat helyben állítja elő;
  nem tölt fel zenét vagy mérési adatot. A helyi frozen módot a runner szolgálja ki.

Az AGENTS és architecture contract pontosítja: a shaderleaf XR-importkivétele
csak az XR két grain adapterének szól; a visuals saját adaptere normálisan
importálja. A levélben nincs Three, GPU-erőforrás, DOM, audio, State vagy I/O.
Mind a nyolc kiegészítő governance dokumentum driftellenőrzése megtörtént;
architecture és ADR-009 igényelt aktuális szöveget, a worker wire továbbra is
csak kutatási és nem helyettesíti a production preview-v1/exact-v2 protokollt.

## A képminőségi vizsgálat és a korrekció oka

A kontroll a [WH-01](wormhole-wh01-contract-baseline.md) 25,070,281 bájtos,
nyolcesetes input/képcsomagja, SHA-256:
`937b39bf0a1c2f0b77abc8cdde91654a3840e41b95aecbbb0a98b0245573270f`.
A toleranciák és a referencia változatlanok. Nem lazítottuk a 0.75-ös sötét
tile kaput, nem cseréltünk ki hibás eredményt jobb képre.

| Vizsgált változat | Eredmény és következmény |
| --- | --- |
| Eredeti XR Gauss-szűrés és közvetlen float kompozíció | 7/8 eset sötétrégió-kapuja elbukott. Globális RGB-átlag csak kb. 0.13-0.44 kódérték; ez önmagában félrevezető lett volna. |
| Referenciával azonos Bayer/alpha kvantálás | Javulás, de a Gauss-közelítés még nem adja a 2D referencia bloomját. Float32 akkumuláció önmagában nem javította meg. |
| GPU-n a skalár oksági/visszafelé IIR-szűrés, Canvas-vonalak | Float32 mellett minden képi kapu teljesíthető. Az eredeti XR Gauss-profil megmarad; nincs indokolatlan XR-képcsere. |
| Minden float target félpontosságú | A sűrű és transzparens esetek még elbuknak: az ismételt szűrés kerekítési hibája láthatóvá válik. |
| **Float16 akkumuláció, Float32 resolve/bloom, Canvas-vonalak** | **8/8 referencia, két időbeli kapu és bitmap-paritás sikeres.** Ez a labor alapprofilja. |
| Valódi vonalszélesség, rögzített 32x32 területfedettség a GPU-n | Javít az XR hairline/ramp közelítésén, de két eset még elbukott: kb. 0.916 és 0.802 sötét tile hiba a 0.75 kapu ellen. Kutatási jelölt, nem automatikus gyors út. |

A referencia-IIR a CPU 3 x keep .5 és 5 x keep .4 szűrését követi, a négy
irányt azonos sorrendben, ping-pong targetekkel. Minden fragment egy korlátos
prefixet számol; nincs egymás írásait olvasó fragmentverseny. Ez numerikus
tolerancián belüli GPU-egyezés, nem Float64/Float32 bitazonossági állítás.
A 32x32 vonalminták kizárólag kontúrpixeleknél futnak, fix pozícióval;
nincs frame-random zaj. Az eltérő Canvas/Skia fedettség ettől még nem tűnt el.

A minőségvédett út **nem olvassa vissza a Canvas-vonalak pixeleit CPU-ra**:
az OffscreenCanvas közvetlen textúrafeltöltéssel kerül a GPU kompozíciójába.
A vonal-előkészítés és feltöltés teljes költsége benne van a mért jelöltben.
Éles integrációban az identity normál Canvas-base passzán maradhatnak a
vonalak, amíg a külön GPU-vonalprofil nem felel meg. Ettől az eddigi drága,
JavaScriptben számolt anyagraszter a GPU-ra vihető.

## Képességek, memória és mérés

Float targethez tényleges extension-, framebuffer-, shader- és draw-próba
tartozik. A Float32 additív blend külön képesség; a Float16 akkumuláció és
nem blendelt Float32 szűrőtargetek nem követelik meg ezt. A bilineáris
anyagmintavétel shaderben történik, ezért nincs Float32-linear-filter függés.
Források: [Khronos color buffer float](https://registry.khronos.org/webgl/extensions/EXT_color_buffer_float/),
[Khronos float blend](https://registry.khronos.org/webgl/extensions/EXT_float_blend/).

A targetek méretváltáskor allokálódnak, az alaptextúra normál frame-nél
texSubImage frissítést kap. A report `targetBytes` csak a saját FBO-textúrák
számított mérete: nincs benne driver-, default backbuffer-, base-, carrier-,
Canvas- vagy codec-memória. Ez nem peak/free RAM-mérés. A production
admission/fallback és az inaktív anyagút GPU-bypass-a WH-04/06 feladata.

A worker külön rögzíti a hideg shader/context előkészítést, az első mintát,
három váltott CPU/GPU mintát, command issue-t és gl.finish utáni teljesítést.
A readback és transferToImageBitmap külön mérés, utóbbit a fogadó Canvas2D-n
is ellenőrizzük, majd lezárjuk. A gl.finish itt kutatási mérőhatár, nem
tervezett minden-frame-es production szinkronizálás. Az átfedő részidőket
nem adjuk össze; a roundtrip az ellenőrző CPU-újrajátszást is tartalmazza.
Az utolsó három kör GPU-jelöltje a nyers carrieradatok tényleges producer-
előkészítését is újrafuttatja a mért időn belül; nem csak egy tárolt prepared
puffer feltöltését mérjük. A teljes identity/geometria/zenei sampler mindkét
oldalon ezen kernelkontrollon kívül marad.

**Ez kernelmérés, nem teljesexport-gyorsulás.** A teljes regresszióval
párhuzamos futások időadatai terheltek, nem promóciós adatok. Az éles
15%-os whole-job kapu, 4K output, codec és fizikailag mért mobil továbbra
is WH-06/08. A minták authored spektrumot használnak, nem No Good zenés
sessiont; az új kód nem módosítja a meglévő 10 bites videóexportot.

## Tesztek, elődmegőrzés és átadás

Új Node-regressziók: kilenc eredeti shader pontos hash-e; AST-alapú tiszta
modulhatár; typed buffer/méret/count/finite/range/mutation; GPU hiánya és
ismeretlen precision elutasítása. A valódi GPU-/worker-/pixelpróbák Chrome-ban
futnak, nem mock shadereken.

A valós workerpróba hibás countot elutasít, következő érvényes kérésből
azonos képet ad; WEBGL_lose_context után új contextből reprodukál; 2x2-re
átméretezve nem hagy előző material pixeleket; explicit dispose után leáll.
A labor tulajdonosa minden kimenetnél terminálja a workert.

A [korábbi XR GPU-line teszt](../tests/xr-gpu-lines.pre-wh02.mjs) pontos
elődje megőrzött, SHA-256:
`ffc09802f6ec6cbcd931cb5265110ecfde34958f5476d03331b34c998f3d6c36`.
Csak a shaderforrás olvasása követi a kód kiemelését: ugyanazok az assertionök
a ténylegesen importált `LINE_COMPOSITE_FRAGMENT` stringre futnak.
Az összes korábbi aktív teszt és fixture megmarad.

```powershell
npm run build
npm test -- --test-reporter=tap --test-concurrency=4
node --test --test-reporter=tap tests/wormhole-gpu-raster.test.mjs tests/xr-gpu-material.test.mjs tests/xr-gpu-lines.test.mjs tests/gameplay-purity.test.mjs tests/wormhole-render-contract.test.mjs tests/contracts.test.mjs
node node_modules/typescript/bin/tsc --ignoreConfig --allowJs --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022,DOM,DOM.Iterable research/export/wormhole-gpu.worker.ts
node research/export/wormhole-gpu-spike.mjs capture float16 cpu-lines
node research/export/wormhole-gpu-spike.mjs capture float32
node research/export/wormhole-gpu-spike.mjs verify <run-directory>
git diff --check
```

A worker külön típusellenőrzése TS6 alatt --ignoreConfig és --allowJs
kapcsolót használ: az utóbbi a már meglévő, közös JS carrier-layout modul
típusainak követésére kell. Nincs új dependency vagy Bun-fallback. A Pages
kiadást a meglévő guarded Node prepare/publish/verify végzi. Diff-export
snapshot nem készült; közvetlen forrás-/Git-diff és hash-ellenőrzés történt.

Az első, teljes Node-futással párhuzamos browser-kör GPU/lifecycle reportja
sikeres, de a külön, korábbi host smoke 120 rAF-os várakozása lejárt
(`offscreen-pending`). A sikertelen eredmény megmaradt, a fixture kapuja
változatlan. Az idle ismétlés külön eredmény, nem az előző felülírása.

Végső teljes Node: **2150 / 2141 sikeres / 9 hiba / 0 skip/cancel**,
1,030,575.7 ms. A kilenc név és pontos hibaüzenet egyezik a korábbi baseline-nal.
Végső célzott hét fájl: **88/88**, build/tsc és a külön worker-típusellenőrzés
sikeres. A teljes kör után hozzáadott egy release-input teszt célzottan futott;
az igazolt futásunió 2151 eset, nem egy második teljes futás. 224 aktív Node-fájl;
mind a 289 korábbi test-tree fájl megmaradt. Az XR adapter runtime-függvényei
a kiemelt deklarációk után forrásszinten is változatlanok.

A publikált labor miatt a guarded Pages-leltár a hat valódi research/build
bemenetét is köti a kommitolt forráshoz. Az új teszt ezek változását külön-külön
elutasítja, a nem publikált más kísérleteket nem keveri a release-be.
A kibővített release-teszt pontos elődje is megőrzött:
[release-pages előd](../tests/release-pages.pre-wh02.mjs), SHA-256
`947b9a40bc2fd0581b71cb5c291fad7a3659c735be938b4a4c7f46c8dfbc9d2a`.
Egyetlen korábbi assertion sem gyengült.

Három végső produceres kör, minden esetben 8/8 kép, két temporal kontroll,
bitmap-paritás, malformed/retry, valódi context-loss/recreate, resize/dispose
és mind a 16 korábbi host-smoke sor sikeres. A reportok a GPU/CPU/bitmap
képeket helyi frozen módban nyersen is megőrzik, formátummal és SHA-val.
Ezekből a Node-verifier az összes képi és időbeli mutatót újraszámolta.
A megváltoztatott pixelbájt és kitalált metrika elutasítását is ellenőriztük.
A publikus labor csak a tömör eredményt tartja; nem generál automatikus fájlokat.
Az első összehasonlító kép szemrevételezése is megtörtént.

| Szintetikus eset | Skalár producer/material/compose medián | GPU-jelölt producer/Canvas-lines/compose + GPU-befejezés medián |
| --- | --- | --- |
| MVP-policy | 11.0 ms | 6.7 ms |
| Sűrű anyag | 54.5 ms | 15.5 ms |
| Fordított portré | 31.0 ms | 4.9 ms |
| Anyag Off | 0.5 ms | 1.1 ms |

Kilenc váltott minta/eset, három külön helyi körből; Intel Arc 140V,
ANGLE/D3D11, Chrome 156. Ezek korlátos kerneladatok, nem production fps vagy
teljesexport-arányok. Az Off eset mutatja, miért kell az integrációban
kikerülni a fölösleges GPU-copyt, ha nincs anyag. Nincs általános backend-
vagy defaultpromóció ebből a táblázatból; a whole-job kapu továbbra is nyitott.

Megőrzött végső körök `logs/wh02/` alatt:

| Kör | Könyvtár | gpu-report.json SHA-256 |
| --- | --- | --- |
| Producer 1 | run-9f3beb2b-3486-45ac-b573-6148cd3b5040 | 49f1219168dcde15d65b9c4b9499618a596c2391abb24cb7b7b77416d68fc07a |
| Producer 2 | run-e9a56dff-7874-40d8-9817-7f52d3754ef7 | 5ecfe381f0cad4cf3a3b635a1b07e8f50e3a6a04b298a07bcbc5852b53602609 |
| Producer 3 | run-bbbaef0e-3b48-490c-808d-cb6eaf302693 | 261a5f4ea3d02056aabae7c98eb5eda467bf70bd926d99561712d060e80ca47a |

A végső, nyersképes GPU-vonaljelölt `run-96e748df-2879-4135-9b88-ccf604118100`:
6/8 kép sikeres, kettő sötét tile-határ felett. Ez elutasított jelölt marad.
A korábbi sikertelen és terhelt körök is megőrzöttek; az `active-run.txt`
csak a legutóbbi befejezett laborfutás mutatója, nem promóciós engedély.
Teljes nyugta: `logs/wh02/acceptance.json`, külön release- és forrásazonossággal.
Fizikai mobil/Quest, valódi teljes dal és új 4K videó nem futott ebben a taskban.
Ezek a host/export integráció és végső minősítés kapui.

Következő: WH-03a frame-előkészítés kiemelése, majd WH-03b canonical idő.
A megvalósítható, minőségvédett GPU-anyagmag adott; a GPU-vonalprofil nyitott
minősítési ág marad, nem blokkolja a pontos Canvas-vonalakat őrző integrációt.
MVP átállás WH-04, dashboard WH-05, tényleges exportgyorsítás WH-06,
Takarékos/Turbó menü WH-07. Ezen task átadása után kézi megálló következik.

## Kézi visszajelzés: alfahelyes különbségnézet (2026-11-07)

A felhasználó a transparent eset sokkal színesebb Difference x8 képét jelezte.
A labor a straight RGB-ket vonta ki alfa nélkül, majd teljesen fedő képként
mutatta az eredményt. Ez a láthatatlan/alacsony alfájú RGB eltéréseit is erősen
kiemelte. A numerikus kapuk már helyesen a fekete/fehér kompozitokat használták;
azok és a GPU-raster változatlanok, a diagnosztikai megjelenítést javítottuk.

A mentett producer-3 transparent esetben a nyers RGB abszolút átlaghibája
0.5430 kódérték, a fekete kompozité 0.0128, a fehéré 0.0421 a 0..255 skálán;
a pixelek 93.47%-án az alfa legfeljebb 8/255. Ezek helyi mentett adatok,
nem a felhasználó böngészőjéből visszanyert mérések.

A Visible difference x8 most ugyanazt a csatornánként rosszabb fekete/fehér
kompoziteltérést mutatja, mint az RGB-kapu. Így az alfa-only hiba látható marad,
a teljesen átlátszó RGB nem ad hamis jelzést. Új Inspection background:
Dark/Black/White/Checkerboard, csak laborbeli CSS-háttér, nincs player/storage
változás. Az ellenőrző canvasokat visszaolvasásra kérjük. Az első, hagyományos
canvasos hash-próba sikertelen futása megőrzött; a visszaolvasásra kért
displaycanvasokkal a szigorú, azonos pixelhash-követelmény teljesül mind a négy
háttéren. A referencia, nyers capture és korábbi eredmények nem cserélődtek.

Három új regresszió: láthatatlan RGB/opaque hiba, alacsony alfa és csak alfát
érintő eltérés, hibás buffer/gain és a kapuval egyező skála. A korábbi teszt
pontos [elődje](../tests/wormhole-render-contract.pre-wh02-alpha.mjs) megőrzött,
SHA-256 `dd96c601248ef8b799fd24fde5085b070fd9e4ba387ee5874d411bcf7eec4cd2`;
korábbi assertion nem változott. Célzott hét fájl **91/91**, `npm run build`
sikeres. Új teljes Node-kör nem futott ehhez a kizárólag laborbeli javításhoz;
az előző kumulatív kör és a 9 ismert preseteltérés továbbra is külön nyugta.

Valódi Chrome: 8/8 kép, temporal/bitmap/lifecycle és 16 host smoke sor sikeres;
a mentett pixeladatok metrikái külön újraszámolva. Mind a négy háttérhez azonos
referencia/GPU canvas-hash; checker kép szemrevételezve. Végső helyi futás:
`logs/wh02/run-f6df3a56-93b6-4b2c-b4a1-000b1c6463e1`, kiegészítő logok
`logs/wh02-alpha/`. Reprodukció:

```powershell
node --test --test-reporter=tap tests/wormhole-render-contract.test.mjs tests/wormhole-gpu-raster.test.mjs tests/xr-gpu-material.test.mjs tests/xr-gpu-lines.test.mjs tests/gameplay-purity.test.mjs tests/contracts.test.mjs tests/release-pages.test.mjs
npm run build
node research/export/wormhole-gpu-spike.mjs capture float16 cpu-lines
node research/export/wormhole-gpu-spike.mjs verify
```

A következő epic task változatlanul WH-03a, még nem indult. A kézi ellenőrzéshez
az első két képet White/Checkerboard háttéren kell összevetni; a harmadik kép
felerősített diagnosztika, nem önálló látványterv. Nincs szükség teljes exportpróbára.
