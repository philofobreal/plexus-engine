# WH-03b: időalapú burkolók és kanonikus képkérés

2026-11-07, Europe/Budapest. Előd: `67e3715`.
Tulajdonos: visuals; a p5 host és a privát context a saját állapotát írja.
A meglévő exact-v2 adapter ugyanazt a képkérés-azonosságot és lease-életciklust tartja.
Nincs új audioóra, zenei analízis, UI-kapcsoló, dependency vagy workerprotokoll.

## Változás és szándékos eltérés

- A beat és a type-2 dense villanás az utolsó megfelelő esemény tényleges korából
  számolódik: `rate ** (60 * ageSeconds + 1)`. A +1 megtartja az
  elfogadott 60 Hz-es impulzuskezdetet. Egy később rajzolt esemény nem indul újra
  teljes erővel. A seek nem igényli a köztes események eljátszását.
- A cue a korábbi host max-burkolójának időalapú alakja. Az egyszer előkészített
  prefix-csúcsok megőrzik az erősebb, még lecsengő cue-t egy gyengébb mögött.
  Az embedded context korábbi „csak az utolsó cue” viselkedése itt szándékosan
  javul. A host az aktuális audioSensitivityt egyszer alkalmazza a cue-skalárra;
  az embedded policy korábbi raw cue-skalárja megmarad.
- Az immutable esemény-/cue-publikációhoz egyszer épül dense-index és cue-prefix.
  Kérésenként bináris keresés és egy újrahasznált eredményrekord kell:
  O(log n) mintavétel, O(n) indexmemória. Nincs dalhossznyi replay minden draw-ban.
- Az aktív fade másodpercenként egy egységet lép, az első frame/seek/óracsere
  nem talál ki eltelt időt. A host legacy rotationPhase a fade pontos integrálját
  kapja 60 Hz-es egységekben, a telítésen át is.
- Pause alatt az analízisframe újramásolódik a megállított zenei időből. Ez
  megakadályozza, hogy a director ugyanazt a már csillapított feature-t minden
  újrarajzolással tovább szorozza. A zenei tranziensek megállnak.
  A host kozmetikai leállási fade-je a p5 deltaTime-ból fut, legfeljebb .25 s-os
  lépéssel. Ez kizárólag prezentáció: nem változtatja az esemény-, tuning-,
  director- vagy exportidőt. Az XR embedded pause továbbra is tartja a fade-et.
- A frame nélküli host lecsengés `0.9 ** (60 * deltaSeconds)`,
  nem rajzolásonkénti .9. A publikált spektrumot nem módosítja.

## Pontos mintavétel és költség

A `renderRequestedFrame(frameIndex, fps)` validálja a közös exact órával
az indexet és az fps-t. A 30/60 fps-es kérések a meglévő `renderExportFrame`
kanonikus 60 Hz-es szimulációját folytatják. A 30 fps minden második tickből
mintáz, ugyanazon az úton, mint a 60 fps. Nincs preview cap, lead vagy wall-clock
alapú kihagyás. Egy előrefelé haladó sorozat a köztes tickeket egyszer dolgozza fel.

A rewind-oracle `renderExact(time)` változatlanul elérhető; visszafelé kérésnél,
prezentációváltozás után és a még külön nem minősített fps-eknél használható.
Az ismételt exact kérést újrarajzoljuk, mert a worker bitmapátadása elfogyaszthatja
a surface tartalmát. Ez a ritka ág újrajátszik; a normál előremenő export nem
lesz kvadratikus. A közvetlen `renderExportFrame` ismétlési szerződése megmarad.

Az actual local fallback és az exact-v2 worker is ezt az új belépőt hívja.
A lease-azonosság, a bitmapzárás és a companion bufferek változatlanok.
Ez nem kapcsolja át az éles MVP/dashboard exportot GPU-ra: a közös session és
hostintegráció WH-04/05, a termékexporté WH-06. Nincs igazolt teljes exportgyorsulás.

## Ellenőrzés és megőrzés

Az előd runtime-ok és a módosított tesztpredikátumok pontos Git-commitja/SHA256-ja:
[megőrzési jegyzék](../tests/wormhole-wh03b-predecessor.json).
A korábbi WH-03a inert forrás-oracle-ok és valamennyi teszteset megmarad.
A tuning/gain/szemantikus/channel egyezés továbbra is független elődellenőrzés.
A szándékosan lecserélt full-state időpredikátum helyett tényleges host-hívások
és független exponenciális/integrál-egyenletek ellenőrzik az új időszabályt.
A korábbi dashboard draw/gain-hívásszám nem időminőségi szerződés: a helyes
idle/fade más számú callbacket igényelhet; az aliased gain sorrendjét külön
funkcionális próbák védik.

A tesztek lefedik a 24/30/36/60 Hz-et, off-grid eseményeket, gyengébb átfedő
cue-t, azonos időpontokat, tetszőleges visszatekerést, pause-t, eltérő live/export
órát, publikációimmutabilitást, fade-telítést, üres publikációt és nagy időt.
A meglévő exact oracle megőrzi a fractional/endpoints, preset, presentation,
30/60 fps, ismétlés és visszafelé mintavétel ellenőrzését.
Az exact böngészőfixture megtartja az összes korábbi esetet, és 30/60 fps-es
előre-/vissza-/ismételt valódi bitmapátadással, nem üres képpel egészül ki.

A részletes futási nyugta: `logs/wh03b/acceptance.json`.
Parancsok: `npm run build`; `npm test -- --test-reporter=tap --test-concurrency=4`;
18 explicit célzott Node-tesztfájl (a pontos lista a nyugtában); `node research/export/wormhole-baseline.mjs capture`
és `verify`; a meglévő Chrome-runnerből származtatott helyi exact-frame runner.
Node/npm fut; a Bun-függő deploy script helyett a guardolt Node Pages publisher.
Az első sandboxos Chrome-kísérlet nem indult; ugyanaz a helyi próba engedélyezett,
sandboxon kívüli headless Chrome-mal fut. A sikertelen próbák naplói is megmaradnak.

## Határok és kézi átadás

A 24/30/36/60 Hz-es bizonyíték az időburkolókra és a statikus célhoz tartó
exponenciális morphra vonatkozik. Az exact 30/60 út teljes szimulációja külön,
azonos kanonikus tickekkel egyezik a rewind-oracle-lal. Ez nem állítja, hogy
különböző preview-előzmények vagy hostpolicyk minden történetfüggő grain-release/
route/FSM állapotot pixelpontosan ugyanolyanná tesznek. A preview seek megtartja
a jelenlegi snap/sync policyt; nem játssza vissza a teljes zenét a főszálon.
A statikus nyolcképes WH-01 baseline csak a rasteraritmetikát védi, nem teljes
dalos idővonal- vagy fizikai Quest-teszt.

Kézzel: MVP-ben és dashboardon rövid play, pause/resume, visszatekerés és
preset/makróállítás. A villanások sebessége ne változzon a kijelzés gyakoriságával;
pause alatt ne fogyjanak el újrarajzolásonként a zenei részletek. A normál
felület és az exportformátumok maradnak. Teljes 4K videó és fizikai mobil/Quest
ebben a lépésben nincs újraminősítve. WH-04 csak a kézi elfogadás után indul.


## Kiadási ellenőrzés

- Teljes kör: 2169 teszt, 2160 pass, 9 pontosan korábbi preseteltérés,
  0 skip/cancel; 1013931.9621 ms. A kilenc hibanév és teljes üzenet a WH-03a
  nyugtájával programozottan egyeztetve; nincs új eltérés vagy baseline-átírás.
- Célzott kör: 247/247 pass 18 explicit fájlban, 159284.1234 ms.
- Production TypeScript/Vite build sikeres. A nagy chunk figyelmeztetés tájékoztató.
- Valódi Chrome: 8 rögzített kernelkép és 16 hostsmoke; külön 58 exact-frame eset
  Canvas/WebGL és külső/belső material út mellett, 24/30/60 fps, 24 ismétlés.
  Minden kép nem üres; a local/worker RGBA-eltérés maximuma 0, a companionok egyeznek.
- A teljes WH-01 kép/raw/base/material/line csomag SHA256-ja változatlan:
  937b39bf0a1c2f0b77abc8cdde91654a3840e41b95aecbbb0a98b0245573270f.
- 225 aktív Node-tesztfájl. 15 elődforrás/-predikátum Git-azonossága ellenőrizve.
  Hat módosított dokumentum 191 helyi hivatkozása érvényes; whitespace rendben.
- diff_export.ps1 nem futott: ez célzott implementáció, nem széles PR-review;
  a tényleges forrásdiff és a Git whitespace-ellenőrzés áttekintve.
- A Chrome-harness kezdeti sandbox-, belépőoldal- és túl korai click-kísérletei
  megőrzött sikertelen futások; a végső 58 eset már az onclick készültsége után indult.
  Nincs ezekből származó sikertelen mérés új baseline-ként elfogadva.

A részletes parancslista, loghash-ek, futási útvonalak, a kilenc ismert eltérés és
a kiadás forrás-/Pages-azonossága a helyi acceptance.json nyugtában marad.
A push/deployt a guardolt publisher a kommitált inputokhoz köti, majd a publikus
release marker, assethash-ek és hostroute-ok ellenőrzése zárja.
