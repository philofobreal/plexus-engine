# A megmaradt fejlesztések értékelése — 2026. október 20.

## Döntési összefoglaló

Mindkét fejlesztés megőrzendő. Az onset-placement közvetlenül releváns az Analyzer és az XR közös
adatútjához, de kísérleti időzítésjavítás, még nem igazolt általános minőségjavulás. A World Formation
egy jelentős, működő XR-játékmeneti és látványbővítés; az Analyzer Oracle beemelésének nem függősége.
Az alábbi részletes vizsgálat után a felhasználó az onset alapos ellenőrzését és kísérleti
integrálását kérte, a World Formation ágat pedig későbbi fejlesztésre külön megőrzi.

A két üres worktree (`6576`, `dc51`) és a két megnevezett üres Claude-maradványmappa lezárása/törlése
megtörtént, ellenőrzött útvonalakon, force nélkül. Az első felméréskor az XR, a `7966` Oracle és
a `9242` onset fejlesztés még külön munkapéldányban volt. Ezek teljes eredeti tartalma az
integráció utáni lezáráskor is megőrzendő, az Oracle figyelmen kívül hagyott modelljeivel,
futtatásaival és Python-környezetével együtt. A World Formation távoli ág, nincs külön aktív
worktree-je az összeírt munkapéldányok között. A primer checkout az integrált mastert kapja;
az azon kívüli, más projekthez tartozó módosításokhoz nem nyúlunk.

## 1. Onset-placement — mi van benne?

Forrás: `9242/novy/Plexus Engine (VJ System)/plexus-engine`, `codex/onset-placement`, alapcommit
`72800fe`. A munkapéldányban 29 módosított követett és 158 követetlen fájl van. A követetlenek
között tényleges forrás, teszt és megőrzött mérési bizonyíték is szerepel; ez nem eldobható másolat.
A történeti inventoryk egy részének változása sortörésből ered, ezt külön kell kezelni a funkciótól.

### Cél és algoritmus

A meglévő Analyzer már elfogadott eseményeinek időpontját finomítja a feldolgozási kereten belül.
A `refineAcceptedEventTiming` legfeljebb 30 ms-nyi előreirányú ablakban keres lokális, fizikai
frekvenciasávokra épülő támadáskezdetet. Előtte 60 ms, utána 30 ms PCM-környezetet használ.
Csak egyértelmű, legfeljebb 3 ms-on belül összetartozó jelöltek mellett javít; bizonytalan vagy
elégtelen jel esetén megtartja az eredeti időpontot. Nem talál ki új hangjegyet, nem javít hiányzó
vagy téves eseménykiválasztást, nem tesz korábbra támadást, és nem oldja meg a tempó-, ütemmutató-
vagy headset-késleltetés kérdését.

A v2 egy további kapuval próbálja kizárni a lassú felfutásokat: a jelölt utáni első 1 ms átlagos
nyers jelteljesítményét az első 12 ms-éhez hasonlítja. Ez az ismert kontrollokon megszüntet néhány
téves javítást, ugyanakkor rövid impulzusokon jó találatokat is elveszít.

### Bekötés és felépítés

- A `?eventTiming=local-band-v1` vagy `local-band-v2` kapcsoló a dashboard, MVP és XR belépési
  pontjából az AudioEngine-en és a meglévő workerhatáron át jut az elemzőhöz. Alapesetben a
  jelenlegi algoritmus és a publikált eredmény változatlan marad.
- Az eredmény a `TrackAnalysis.eventTiming` alatt megőrzi az algoritmusazonosítót, a pontos
  mintavételi órát és az egyes korrekciók indokát. A normalizáló ellenőrzi az eseményszámot,
  időpontokat és óraegyezést. Csak a ténylegesen kapcsolódó percussive-onset impact cue követi a
  hangjegy korrekcióját.
- A szemantikus automatizáció külön szerepeket őriz meg: strukturális határ, támadás, lecsengés,
  dallami változás. A megfelelő automatizációs elemek ezekhez igazodhatnak, korlátos kereséssel;
  a kézi és zárolt elhelyezéseket megőrzi. Ez a viselkedés jelenleg ugyanahhoz a kísérleti
  kapcsolóhoz kötött, mint a DSP-javítás, ezért a két hatás önálló méréséhez érdemes külön kapcsoló.
- Az XR a javított eseményidőt használja a megjelenéshez és a találathoz is. Az MVP mentési
  azonosítója megkülönbözteti a kísérleti algoritmust. A normál mód kulcsa kompatibilis marad.
- Van determinisztikus mérő- és előkészítő eszköz: PCM-azonosság, párosítás, toleranciaablakok,
  negatív kontrollok, részlegesen annotált intervallumok és megőrzött forrásbizonyítékok. Az eszköz
  nem nevezi kézi referenciának a gépi eredményt.

Ez érdemi, végig bekötött fejlesztés. A DSP, a szerializált bizonyíték, az alkalmazásintegráció és
a mérési környezet felelőssége többnyire jól elkülönül. A hosszú vagy sűrű, nagy mintavételű hang
esetén az 50 millió lokálisan vizsgált mintás munkakeret teljes kísérleti elemzést elutasíthat;
ez dokumentált korlát, nem részleges eredményt visszaadó fallback.

### Mit bizonyítanak a mérések?

A megőrzött, a fejlesztés közben már látott szintetikus kontrollok 228 ismert pozitív támadást
tartalmaznak. A ±2 ms-os találatszám alap/v1/v2 rendre **56 / 148 / 132**; ±10 ms-nál
**98 / 158 / 147**, ±25 ms-nál mindhárom **158**. A 25 ms-on belül párosított találatok medián
hibája 5,333 ms-ról 0,479 ms-ra csökken, de ez csak a párosított részhalmaz, nem összesített recall.
Az alacsony, 8 kHz-es csoportban ±2 ms-nál visszaesés is van: **14 → 11 → 10**.

A v1 22 ismert fokozatos felfutást tévesen finomít. A v2 ezeket kivédi a megőrzött negatív
kontrollokon, viszont a v1-hez képest 24 pozitív visszaesése van, főleg rövid impulzusokon.
Ezek fejlesztési kontrollok, nem független holdout igazolás.

A három Prodigy-számból kivágott kilenc, összesen 180 másodpercnyi értékelt részletben 659
elfogadott esemény van. A v2 85-öt módosít, körülbelül 12,9%-ot. **Nincs hozzá kézzel annotált
időzítési referencia**, így ebből a valódi zenei pontosság javulása nem állapítható meg.
A futási költség egyszeri, sorrendben végzett megfigyelés, nem kontrollált headset-benchmark.

### Új, reprodukált hiba

**P2: kis DC-eltolás átengedi a v2 által tiltani kívánt fokozatos támadást.**
A `src/analyzer/AcceptedEventTiming.ts:48–54` nyers PCM-teljesítménye DC-érzékeny. A meglévő
`acceptedTimingFixture` ramp kontrollján, 44 100 Hz, phase=0,25, gain=1 mellett a v2 helyesen
`gradual-attack` státuszt ad. Ugyanahhoz a PCM-hez 0,01-et adva `refined` lesz, és 5,828 ms-ot
tol az időn; phase=0,95 mellett 22,086 ms-ot. Nem keletkezett új támadás, a bemenet továbbra is
érvényes a deklarált szerződés szerint.

Ez indokolja a lokális alapvonal/AC-komponens kezelését és DC-, háttér-, fázis- és mintavételi
kontrollok hozzáadását, majd az összes eddigi negatív/pozitív mérés újraértékelését. Alapértelmezett
bekapcsolás előtt javítandó. A fejlesztés ettől még értékes kísérlet és infrastruktúra.

### Relevancia és összevonási feltételek

Közvetlenül releváns: az Oracle kutatási eredményeit a tényleges Analyzer-eseményekre és azok
alkalmazásbeli fogyasztóira viszi át. Az Oracle AN-04D harmonikus előrejelzése más problémát old
meg; egyik nem helyettesíti a másikat. A BandOnsets és a közös jelfeldolgozási kutatási modulok
megegyeznek a legújabb Oracle megfelelő moduljaival.

A fő összevonási nehézség a bizonyítékok története. A két ág ugyanazon `v0015` inventory- és
forrásarchívum-útvonalon külön fejlődött; az onset oldalon `v0016` is van. A harness összefüggő,
hash-elt láncot vár. Mindkét történeti ágat meg kell őrizni és a kombinált állapotot felülvizsgált
migrációval hozzáfűzni. Történeti ZIP-et, eredményt vagy hash-t pusztán a tesztzöldítésért
átírni hibás lenne. A globális `* -text` és az Oracle célzott byte-megőrzése szintén egyeztetendő.
A közös védett előzményfájlok közül a `tests/contracts.test.mjs` eltérése dokumentált migráció;
nem teszttörlés.

**Javaslat:** megőrizni, majd külön egységekben beemelni: mérőeszközök és bizonyítékkezelés;
opt-in időzítés; szemantikus fogyasztók. Előtte DC-hiba javítás, v1/v2/módváltásos mentési útvonal
tesztelés, inventory-egyeztetés. Valódi zenén kézi referencia kell az általános minőségi állításhoz.

### Most ténylegesen lefuttatott ellenőrzés

Az eredeti `9242` tartalmát változatlanul hagyva, a követett és követetlen, nem ignorált fájlok
byte-pontos másolatán (`review-onset.local`, 1957 fájl) dolgoztam. `npm run build`: sikeres.
A következő tíz suite **56/56 tesztje sikeres**:

```text
accepted-event-timing, accepted-event-timing-v2, accepted-timing-measurement,
automation-cue-roles, event-timing-consumers, event-timing-evaluator,
event-timing-review-preparation, automation-cue-alignment,
xr-audio-integration, rhythm-chart
```

A teljes új suite-ot és Python-mátrixot most nem futtattam újra. A megőrzött korábbi eredmény
1516 Node-tesztből 1507 sikeres és 9 ismert Wormhole-hiba, Python 316/316. A történeti teljes
harness sikertelensége expliciten dokumentált; nem állítom teljes zöldnek. Nincs új mobil/Quest
vagy kézi zenei annotációs validáció. Logok: `review-onset.local/onset-build.local.log`,
`review-onset.local/onset-tests.local.log`.

## 2. World Formation — a végső értékelés

Forrás: `claude/xr-world-formation`, `6ef28d1`, négy külön commit. A masterrel közös alaphoz
képest 29 fájl, 4217 hozzáadott és 19 törölt sor. A régebbi ág és a mai master közvetlen
összehasonlításában látható újabb spatial/WebGL-fájlok hiánya nem szándékos törlés.

### Mit tud, mi a célja?

A zenére egy fokozatosan felépülő sci-fi világot szervez: ipari Localhost csarnok → Seeder
építkezés → Tudattér-hálózat → alkalmas zenei csúcsponton Fenom anomália és stabilizálás →
lezárás. A zene határozza meg az átalakulás menetét, a találatok és hibák annak minőségét.
Nem minden számban erőltet anomáliát vagy nyugodt lezárást; vannak dokumentált fallbackek.

Az elemző szakaszai, cue-jai, bizonyossága, az automatizáció metaadatai és az elfogadott chart
alapján determinisztikus világtervet épít. 41 építménypozíció, legfeljebb 48 különleges hangjegyszerep
és 64 esemény van. A találatok építési minőséget, koherenciát és stabilitást alakítanak.
Megjelennek építőegységek, drónok, kapcsolatok, áramlások, szerepjelölő glóriák, célok és eredmény.
A mentett beállítás Off / Reduced / Full; jelenleg Full az alapérték, régi mentéseknél is.

### A kódfelépítés megfelel-e a szándéknak?

Nagyrészt igen. A tiszta `WorldDirector` egyszer épít tervet; a `WorldTimeline` a közös dalidőből
számol; a `WorldInteractionSession` a meglévő RhythmGameSession elfogadott találatait és hibáit
figyeli. Nincs külön pontozás, találatbíró vagy hangóra. A különleges szerepek oldalsó adatként
kapcsolódnak a hangjegyekhez, nem írják át a chartot. A Three.js csak megjelenít; nem dönt DSP-ről.
Ez jól illik egy zenére reagáló XR-játékrendszerhez, és kerüli a vezérlőbe zsúfolt új világmotort.

A renderelés rögzített geometriát, instancingot, shadereket, korlátos állapotot és explicit
erőforrás-felszabadítást használ. A lifecycle foglalkozik új dallal, chartregenerálással, pause-zal,
seekkel, újrakezdéssel, XR-megszakítással és kilépéssel. A dokumentáció részletesen megadja a
szabályokat, képleteket, tulajdonosi határokat és mérési korlátokat.

### A review konkrét megállapításai

1. **P2: rövid szakasznál látható karakterugrás.** A `WorldDirector.ts:301` legalább 0,25 s
   átmenetet állít, akkor is, ha a szakasz rövidebb. A `WorldTimeline.ts:59` a következő
   átmenetet az előző célértéktől indítja, amelyet a rövid szakasz még nem ért el.
   Reprodukció: 60 s dal, első hangjegy 2 s-nál, intro 0–2,1 s, verse 2,1–60 s.
   Az industry csatorna 2,0999 s-nál 0,3497378, 2,1001 s-nál 0,6630000; a construction
   0,04217-ről 0,12-re ugrik. A fázishosszhoz korlátozott átmenet vagy tényleges végpontot
   átadó interpoláció és sűrű határokra írt regressziós teszt kell.
2. **A dokumentált impact-only drónscan nem típusfüggő.** A `WorldDirector.ts:467–475`
   erősséget/bizonyosságot/időt szűr, cue.kind-et nem. Break@10 és vocal@20, 0,9 confidence
   mellett is scan keletkezik. A szabály vagy a megvalósítás és teszt egyeztetendő.
3. **A mozgásgesztusokból képzett `WorldPhase.motion` nincs bekötve a látványba.** A tervező
   kitölti, a timeline és renderer nem olvassa. A climax metaadat befolyásolja a találkozás
   kiválasztását, de a mozgásszókincs egyelőre meg nem valósított ígéret.
4. A dokumentált „frozen WorldPlan” ténylegesen TypeScript readonly szerződés, nem runtime
   Object.freeze. A „nothing allocated per frame” teszt kapacitást és tervírásokat vizsgál,
   nem allokációt. A trackerben maradt elavult commit/push jóváhagyási szöveg. Ezeket a
   dokumentációs és mérési állításokat pontosítani kell.

### Teljesítmény, validáció, mai relevancia

A branchben megőrzött desktop-mérés szerint a tervépítés 12,8 ms, a világ frissítése 74 µs,
kb. 10 extra draw és 7 ezer háromszög, plusz jelölők/státusz/flow. Ezek történeti desktopadatok.
A csarnokfalak Wormhole feletti túlfestése és a scaffold fragmentterhelése valós nyitott GPU-kockázat;
Reduced módban sem tűnik el minden ilyen felület. Quest-mérés nincs, a sztereo komfortot sem
igazolják a CPU-oldali tesztek. Emiatt a mindenkinél automatikus Full indulást még korainak tartom.

A pontos branch snapshoton (`review-world.local`) az új `npm run build` sikeres, és a world
plan/render/session, rhythm session/judge, gameplay purity, controller regeneration/settings
suite-ok **97/97 tesztje sikeres**. Ezek nem fedték fel a rövid fázishatár hibáját; külön reprodukció
szükséges volt. A branch történeti teljes futása 1300 tesztből 1291 sikeres, 9 ismert Wormhole-hiba;
korábbi desktop browser-smoke szerepel a trackerben. Új teljes suite, browser/GPU- és headsetfutás
most nem történt. Logok: `review-world.local/world-build.local.log`, `world-tests.local.log`.

A master ellen végzett, munkafájlokat és referenciákat nem módosító `merge-tree` előnézet három
szöveges konfliktust mutat: `documents/governance/testing-validation.md`,
`src/xr/XrAppController.ts`, `src/xr/scene/RhythmGameScene.ts`.
Ez még nem tartalmazza a jelenlegi nem commitált XR-javításokkal való teljes összevonást.
A mai 200 m-es, spatial field/WebGL/4K hátteret, menüt, kamerakezelést és erőforráskeretet
külön együtt kell tesztelni vele. Nem szabad a régebbi facade/scene verzióval felülírni az újakat.

**Javaslat:** az ágat és a négy commitot megtartani. Érdemes továbbvinni, ha a projekt célja a
zenére épülő XR-élmény mélyítése. Az Analyzer pontosságának javításához közvetett fogyasztó,
nem előfeltétel. A három működési/dokumentációs eltérés rendezése után külön, opcionális
funkcióként integrálnám, elsőként Off vagy óvatos Reduced alapértékkel, majd a mai teljes
pipeline-on és Quest eszközön igazolt kerettel. Az Oracle + jelenlegi XR fő integrációját
önmagában nem indokolja késleltetni.

## A későbbi döntés és az integráció eredménye

Az eredeti vizsgálat fent a döntéskori állapotot írja le. A további falszifikáció igazolta a v2
DC-érzékenységét; a javított algoritmus külön `accepted-frame-band-timing-v2-dc1` azonosítót kapott.
A `local-band-v2` továbbra is csak tudatosan bekapcsolható opció, az alapértelmezés változatlan.
840 valódi rámpás/DC/erősítés/polaritás/fázis esetben nem maradt téves finomítás, 114 éles
zajimpulzus lokalizációja és 720 izolált kaputeszt is sikeres. Ugyanakkor a 336 tónussal kevert
rámpás ellenpéldából nyolc továbbra is téves finomítást ad; ezeket nem rejtettük el és nem
nevezzük általános támadásdetektálási megoldásnak.

A friss, teljes Analyzer-mérés mind a 340 mesterséges kontrollt és mind a kilenc eredeti
PCM-részletet lefuttatta. A 659 rögzített eseményből 85 finomodik; a korábbi v2 időpontjai és
státuszai változatlanok, a megfigyelt jeltámasz bővül. Zenei annotáció híján az accuracy továbbra
is ismeretlen. Az eredeti onset munkapéldány teljes forrása és saját, eltérő mérési/inventory
lánca külön, ellenőrzött történeti archívumként megmarad, az Oracle láncát nem írja felül.

A World Formation `claude/xr-world-formation` ága változatlanul külön marad (`6ef28d1`).
A három feltárt eltérés és a Quest-mérés hiánya a későbbi munka kiindulópontja.
A végleges teljes teszt-, byte-azonossági, böngészős és lezárási bizonyíték az
[integrációs review-ban](xr-oracle-onset-integration-2026-10-20.md) olvasható. A review-másolatok
és logok segédanyagok, nem új termékforrások vagy önálló fejlesztési ágak.
