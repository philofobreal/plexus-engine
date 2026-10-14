# Plexus analyzer: stabil fejlesztési stratégia

Állapot: **forráskód- és elvaudit alapján rögzített fejlesztési módszer, 1.0; az első AN-01 csomag implementált**. Az elvaudit az algoritmus 6-os állapotát rögzíti; a [jel-, idő- és szintszerződés](../features/analyzer-signal-contract.md) most 7-es verzióval működik. Ez nem teljesített zenei pontossági tanúsítás. A cél az, hogy a Plexus a saját feladataiban adjon egyre pontosabb, használhatóbb zenei információt: a vizuális dramaturgiának, a koreográfiának és az XR játék célpontjainak. Az egész library képességlistájával való általános verseny helyett feladatonként mérünk.

A [kódhoz kötött audit](analyzer-principles-audit.md), a [rögzített kísérleti protokoll](../../research/analyzer-lab/docs/ANALYZER-DEVELOPMENT-METHOD.md), a [géppel olvasható v1 célprofil](../../research/analyzer-lab/configs/analyzer-evaluation-policy.v1.json) és a [kísérleti rekord sablonja](../../research/analyzer-lab/fixtures/analyzer-experiment.template.json) együtt alkotja a módszert. A célprofil számai kezdeti mérnöki követelmények; nem a jelenlegi analyzer eredményei és nem általános pszichoakusztikai szabványok. Fizikai XR mérések után új, verziózott profillal pontosíthatók.

## A legfontosabb döntés: mit állít egy adat?

Négy külön réteget kell mérni és fejleszteni:

1. **Akusztikai megfigyelés:** RMS/power, spektrum, fluxus, tonális stabilitás, támadásjelöltek. Rögzített mértékegység, ablak, időbélyeg és csatornakezelés tartozik hozzá.
2. **Zenei következtetés:** beat, lokális tempó/fázis, downbeat/metrum, dob- vagy forrásaktivitás, frázis, szerkezeti határ. Bizonytalanságot és alternatív értelmezést is megőriz.
3. **Dramaturgiai értelmezés:** feszültség, felépítés, kontraszt, elengedés, visszatérés. A zenei bizonyítékból választ értelmezést; egy hangos szakasz önmagában nem bizonyított drop.
4. **Fogyasztói döntés:** mely esemény kap vizuális hangsúlyt, hol indul jelenetváltás, mely támadásból lesz játszható XR célpont. Ezek művészi/játéktervezési döntések, nem új akusztikai tények.

Ez fogalmi szétválasztás, nem új, párhuzamos modulok létrehozására adott utasítás. A meglévő tulajdonosi határokat megtartjuk: DSP és alapvető zenei elemzés `src/analyzer`; a TrackAnalysis-ból képzett narratíva/intent `src/semantics`; vizuális megvalósítás `src/automation` és renderer; célpont- és mozgáspolitika `src/gameplay`. Az analyzer marad tiszta, determinisztikus, offline feldolgozó. A worker csak adapter; a render loop nem végez FFT-t vagy zenei újraelemzést.

A jelenlegi `vocal` és `melody` értékek spektrális vizuális heurisztikák. Nem énekdetektálási valószínűségek, nem F0 és nem hangjegyek. A `BeatEvent.type` három vizuális eseményosztályt jelöl, nem kick/snare/hi-hat osztályokat. A `patterns` jelenleg szakaszok energiasűrűség/hasonlóság szerinti csoportosítása, nem igazolt zenei motívumazonosság. Ezeket a további fejlesztés sem kezelheti erősebb bizonyítékként a tényleges mérésüknél.

## Milyen információ kell a fogyasztóknak?

| Felhasználás | Kötelező releváns adat | Mi lehet bizonytalan vagy hiányzó? | Kezdeti pontossági cél |
| --- | --- | --- | --- |
| Gyors vizuális akcentus | Hallható, kiemelhető támadás ideje, salience, eseménykor, intenzitás | Hangszerazonosság nem kötelező | Előjeles medián hiba abszolútértéke ≤10 ms; párosított események p95 hibája ≤30 ms; külön precision/recall és negatív téves jelzési ráta |
| Ritmikus vizuális mozgás | Beat-idősor, helyi fázis/tempó, folytonosság; külön bar/downbeat | Fél/dupla tempó, metrum és beatless részek | Stabil tempójú, annotált szakaszon p95 fázishiba ≤30 ms; metrikus tévedést és hosszú driftet külön mérünk |
| Makro dramaturgia | Szerkezeti határ, kontraszt, visszatérés, akusztikai ismétlődés, funkcionális szerep | Verse/drop/build címke lehet bizonytalan | Határ P/R/F 0,5/1/3 s-nál; egyértelmű érkezésnél szigorúbb hiba ≤min(250 ms, negyed beat); szerepcímke külön emberi értékeléssel |
| Koreográfia | Bizonyított akcentusok/frázisok, szakaszívek; megbízható subdivision | Generált mozgásfrázis nem bizonyít zenei frázist | Az akcentus és az átmenet időzítése külön; gyenge ritmikai bizonyíték esetén ritkább, szakaszalapú terv |
| XR célpont | Hallható támadás eredeti ideje, bizonyíték/uncertainty, választási és kihagyási ok | Dobazonosság csak akkor, ha a játék ténylegesen használja | Célként kijelölt, annotált támadásokon precision ≥0,98 és recall ≥0,90 ±25 ms-nál; abszolút medián bias ≤10 ms, p95 ≤25 ms, p99 ≤40 ms |
| XR teljes időzítés | Analyzer-idő + audió/prezentáció + input + ütközés-interpoláció | Device latency ismeretlen maradhat, de ekkor nincs teljes garancia | Fizikailag mért teljes p95 hiba ≤50 ms, abszolút bias ≤10 ms; ez külön elfogadási mérés |

Az XR precision/recall nevezője előre kijelölt, teljesen annotált akusztikai célhalmaz. A mozgási nehézség miatt elhagyott célok nem analyzer-missként számítanak: külön kimutatjuk a jelöltfelismerés, a zenei elfogadás és a chart sűrűségi/biztonsági szűrésének veszteségeit. A vizuális precision/recall is kijelölt salient eseményekre vonatkozik, nem minden hang minden támadására.

Az időhiba eloszlását a szigorú találati tolerancia mellett tágabb, előre rögzített ±70 ms-os diagnosztikai párosítással is vizsgáljuk. A ±25 ms-nál párosított eseményekből nem igazolható a 40 ms-os p99 cél: a szigorú matching levágja ezt a hibafarkat. Mindkét méréshez közöljük a recallt, a téves jelzéseket és a párosított mintaszámot.

A jelenlegi XR alapablakok perfect ±80 ms, good ±110 ms, miss 160 ms. Ezek játékbeli tűrések, nem analyzer-pontossági igazolások. Egy 50–70 ms-os benchmarktűrés nagy részét felhasználhatja a perfect költségkeretnek. A teljes hibában külön szerepel a szisztematikus eltolás és a változó jitter. Komponensenkénti p95 értékek összege nem bizonyít teljes p95 garanciát; az összesített láncot meg kell mérni.

## Az audit által indokolt fejlesztési sorrend

| ID / prioritás | Konkrét fejlesztés | Elkészülési bizonyíték |
| --- | --- | --- |
| AN-01 / P0 | Jel-, csatorna-, idő- és mértékegység-szerződés; érvénytelen inputok védelme; frame-tail politika; `avgRms` jelentésének rendezése | Stereo bal/jobb/ellenfázis parity; véges kimenetek; rövid/tail inputok; azonos audioóra; matematikai RMS fixture |
| AN-02 / P0 | FFT-ablak és hop különválasztása; átfedő, fázisrobosztus támadásjelöltek; helyes flatness numerika; időalapú EMA | Teljes hop-fázis sweep; halk/gyors/decaying támadások; tone/noise/ramp negatívok; több mintavételi frekvencia; ismert időkonstans |
| AN-03 / P0–P1 | Akusztikai támadás, kiválasztott vizuális impact és ritmikai rács külön bizonyítéka; javaslat→osztályozás→NMS→consumer veszteség kimutatása | Jelölt-recall plafon; időhiba-görbe; silence/sustain FP per perc; szándékos chart kihagyások külön száma |
| AN-04 / P1 | Lokális beat/tempó/fázis; nagy szünet és tempóváltás kezelése; külön downbeat és metrum hipotézisek | CML/AML folytonosság és Cemgil; helyi bias/drift; swing, syncopation, half/double, 3/4 és más metrum fixture; abstention |
| AN-05 / P1 | Immutable akusztikai feature és művészi kiemelés szétválasztása; helyi és globális confidence külön; szakasz- és cue-bizonytalanság továbbadása | SpectralPivot előtti/utáni szerződés; narratíva nem teszi a gyenge címkét bizonyossá; alacsony confidence safe fallback |
| AN-06 / P1–P2 | Szerkezeti változás, akusztikai ismétlődés és dramaturgiai szerep külön becslése; lokális build-ív és tág anticipation külön | Flat groove/ramp/non-drop hangosítás negatív; emberi drop/build/phrase annotáció; határ+szerep külön score; téves jelenetváltási ráta |
| AN-07 / P2 | Mért, önálló drum/bass/vocal activity; szükség esetén F0/harmonikus változás | Feladatspecifikus adat és library; ritka/átfedő események, complete negatives; külső valódi hanganyag; saját holdout |
| AN-08 / folytonos | Profilozás és azonos kimenetű optimalizálás | Stage time/memory, hosszú track; prefix sums, lineáris bar/event traversal; determinisztikus és fogyasztói parity |

Az első implementációs csomag **AN-01 elkészült; az AN-02 első, szűk jelöltfelismerési ciklusa is implementált**. Az új átfedő akusztikai adatfolyam headless opt-in; a 7-es alapértelmezett analyzer elfogadott eseményei és fogyasztói döntései megmaradnak. A [külön jegyzőkönyv](../../research/analyzer-lab/docs/AN-02-VALIDATION.md) izolált impulzusokra és rögzített támadásokra igazol eredményt; sűrű keverékek, halk támadások, rampok és valódi zenék további ciklusokat igényelnek. A legacy flatness/EMA migráció még hátravan. AN-04 előtt nem érdemes a rácsra újabb, erősebb dramaturgiai állításokat építeni. A dobos v2 jelenleg kutatási opt-in marad: a történelmi snare-regresszió kizárja az általános előléptetést.

A clock/latency vagy worker-adatséma változása egyetlen integrációs tulajdonost igényel. AudioEngine, renderer-dispatch és fizikai XR kalibráció külön fogyasztói csomagok; hibáikat nem az analyzer küszöbeinek eltolásával kompenzáljuk. Az ADR-003 gyors/lassú vizuális csatornái és az ADR-005 szemantikai tulajdonosa megmaradnak. Új közös adatmező csak additív, explicit legacy-fallbackkel kerülhet a worker/types/consumers határára.

## A stabil fejlesztési ciklus

1. **Egyetlen falszifikálható feladatot választunk.** Például: „a támadásfelismerés ne függjön a hopon belüli fázistól”; nem általánosan „jobb zeneértés”. Leírjuk a fogyasztót, az akusztikai igazságot, a bizonytalanságot és a negatív eseteket.
2. **Mérés előtt rögzítjük a protokollt.** Source/config/environment/data/annotation hash; csatorna, resampling és időbélyeg-jelentés; objective, toleranciagörbe, ablation, tiltott regresszió, selection grid. A tervnek nincs teszteredményből visszamenőleg módosítható része.
3. **Független zenei eredet szerint osztunk.** Ugyanazon MIDI, performance, remix, stem, hangszínvariáns és procedurális generátor családja együtt marad. Audiohash és track ID önmagában nem bizonyít függetlenséget.
4. **Train/development és validation iteráció.** Saját, eredeti algoritmus; nincs library-forrás vagy súly átmásolás. Train adja a normalizálást és súlyokat; validation választ. Az összetevőket ablationnel külön mérjük.
5. **Modell és kód befagyasztása után egy végső holdout értékelés.** Track/group szintű párosított változás, előre rögzített rétegek, precision/recall/timing/negatív exposure, kellő esetben csoport-bootstrap. A library-ket ugyanazon független címkékhez mérjük.
6. **Elfogadás vagy visszautasítás.** A fő feladat javulása mellett a védett rétegek, történelmi hibák, idő/egység/séma, determinisztikusság, build/regresszió és fogyasztói biztonság is kapu. Hiányzó evidence nem siker. Egy kritikus réteg romlását nem fedheti el jobb átlag.
7. **Archiválás és következő ciklus.** A látott holdout ismert regressziós anyaggá válik. Új általános javulási állításhoz új független holdout kell. A kiadott analyzer algoritmusverziója és cache-azonossága követi a viselkedésváltozást.

Nem lehet minden zenén monoton jobb számot ígérni. A módszer azt rögzíti, hogy mit jelent a javulás, milyen környezetben igazolt, mely hibákat nem engedjük vissza, és mikor marad egy változat kutatási státuszban.

A projekt [kumulatív harness-e](../../research/analyzer-lab/tools/harness/README.md) minden korábbi aktív Node/Python tesztet az újakkal együtt futtat, ellenőrzi a tényleges fájllefedettséget, és hash-lánccal megőrzi a teszt-, fixture- és kutatási forráselőzményeket. Cseréhez pontos régi/új hash és megindokolt felülvizsgálat szükséges. A [segédkódok megőrzési rekordja](../../research/analyzer-lab/docs/RESEARCH-CODE-RETENTION.md) az eredeti programok bájtazonos másolatait és a használható újrafuttató eszközöket is rögzíti. A meglévő sikertelen teszt nem lesz elrejtett siker; a korábbi mérés nem írható át új eredménynek. Az archivált, eredeti futtatási környezet nélküli tesztek külön, nem végrehajtott történeti anyagként láthatók.

## AN-02 C2: a következő fejlesztési szelet bizonyítéka

Az [AN-02 második tesztköre](../../research/analyzer-lab/docs/AN-02-C2-VALIDATION.md)
144 új szintetikus feltétellel külön méri a halk jeleket, a tartott basszus fölötti
támadásokat, a sűrű eseményeket és a támadás nélküli modulációt. A köztes jelöltek
naplózása alapján a 30 ms-os teljes energián alkalmazott kétszeres növekedési
feltétel jelentős kihagyási forrás. A feltétel elhagyása, illetve az erősség szerinti
összevonás viszont növeli a téves jelzéseket; egyik sem került a fogyasztókhoz.

A következő fejlesztési szelet ezért a **frekvenciasávonkénti akusztikai újdonság
és a tartott háttér külön becslése**, külön rögzített hallhatósági/szintpolitika
mellett. A jelöltkeresést, időfinomítást és a vizuális/XR célpontválasztást külön
kell mérni. A most látott korpusz ismert fejlesztési/regressziós anyag marad;
általános javulási állításhoz új, független annotált hanganyag szükséges. A pontos
mérési eredmények és a megőrzött sikertelen próbálkozások a jegyzőkönyvben vannak.

## AN-03: az eddigi tesztek alapján implementált javítás

Az [AN-03 fejlesztés](../../research/analyzer-lab/docs/AN-03-VALIDATION.md) már
az analyzer tényleges DSP-kódját módosítja: a tartott háttér predikciós hibájából
keres új támadást, külön `predictiveOnsets: true` API-kapcsolóval. Az ismert kevert
korpuszon 0/144-ről 144/144-re javítja a találatokat; új szintetikus feltételeken
72/72 támadást talál meg. A klipkezdet bizonytalan jelöltjei és a sűrű események
kihagyásai megmaradó korlátok, ezért az új jelöltek nem lesznek automatikusan
elfogadott dramaturgiai vagy XR célpontok. A régi v1 és az alapértelmezett kimenet
megmarad; az új algoritmus, séma és regressziók együtt képezik a következő lépcsőt.

## AN-03B: sűrű támadások és hangvégek

Az [AN-03B következő fejlesztési kör](../../research/analyzer-lab/docs/AN-03B-VALIDATION.md)
az összehasonlítási ablakot a háttér előrejelezhetőségéhez igazítja és külön védi
a hangvégeket. Az ismert sűrű támadások találata ±2 ms-nál 132/216-ról 216/216-ra
javult; a C2 ramp-tévesztés megszűnt. Új szintetikus kevert/sűrű eseteken viszont
86/144 a találat, két ramp-tévesztéssel: ezek új megőrzött regressziós korlátok.
Az `adaptiveOnsets: true` új, külön verziójú jelöltadatot ad; az alapértelmezett
zenei és fogyasztói döntések megmaradnak. Teljes XR vagy valódi zenei megfelelőség
ebből még nem állítható.

## AN-03C: gyenge támadások tisztább háttérmodellel

Az [AN-03C kör](../../research/analyzer-lab/docs/AN-03C-VALIDATION.md) több rövid,
egyező előzményből választ tisztább háttérmodellt. Az ismert gyenge, ismétlődő
támadások 86/144-ről 144/144-re javultak ±2 ms-nál, a két ramp-tévesztés eltűnt.
Új feltételeken az egyhangú háttér fölötti találatok 12/72-ről 68/72-re javultak,
de a többszólamú háttéren nincs javulás és öt beating-tévesztés megmaradt.
A v4 a meglévő adatfolyamban explicit verzióválasztással használható, a becslés
mintatartományának és modellválasztásának megőrzésével. Az alapértelmezett és v3
kimenetek megmaradnak; böngészős/XR bekapcsolás és valódi zenei megfelelőség még
nincs igazolva. A következő modellfejlesztés a többszólamú háttér reprezentációja.

## AN-03D: több hang fölötti támadásbizonyíték

Az [AN-03D kör](../../research/analyzer-lab/docs/AN-03D-VALIDATION.md) rögzített
negyedik differenciaszűrőt kapcsol össze a v4 megerősített jelöltjeivel. Az ismert
AN-03C esetek 158/216-ról 216/216-ra javultak ±2 ms-nál, az öt beating-tévesztés
megszűnt; a korábbi 648 helyes találat és tévesesemény-szám megmaradt. Új, részben
négyszólamú feltételeken 84/288-ról 217/288-ra javult a találat, minden zajszerű
támadás helyes, de 71 lágy pengetés kimaradt és hat hanglevétel téves támadásként
megmaradt. A v5 opt-in marad (`adaptiveOnsetVersion: 5`), megőrzi a bizonyíték
ágát és tényleges mintatartományát. Többlet feldolgozási költsége van; az ismert
és új átlagos precision még nem éri el az XR-célt. Következő lépés a hanglevétel
és hozzáadott támadás szétválasztása, valamint a sűrű lágy támadások kezelése.
Fogyasztói elfogadáshoz önálló zenei annotáció és határbizonytalansági szabály is kell.

## Külső library-k szerepe

| Referencia | Mire hasznos? | Plexusban igazolt állapot / korlát |
| --- | --- | --- |
| librosa | Onset, tempo/beat, spektrális összevetés | Valóban futó lab-adapter; onset nem dobazonosság, önmagában nem ground truth |
| mir_eval | Event/beat/section mérési módszerek | Event matching működik; beat continuity/Cemgil és teljes strukturális label-mérés még fejlesztendő |
| madmom | Független beat/downbeat modellreferencia | Lehetséges következő ritmikai oracle; helyi validált adapter/model nincs |
| Essentia | Leírók, predominant melody, tonal/key/chord összevetés | Feladatonkénti adapter/license/model review kell; upstream képesség nem helyi mérés |
| Omnizart | Feladatspecifikus drum/vocal/note/beat/chord modellek | Dobazonossághoz releváns lehet; tényleges helyi checkpoint-mérés nincs |
| Basic Pitch | Instrument-agnostic hangjegybizonyíték | Nem hangszerazonosság és nem automatikusan fődallam |
| MSAF | Szerkezeti határ/akusztikai ismétlődés | Akusztikai szerkezetet hasonlít; verse/build/drop jelentés külön értékelendő |

A [protokoll forrásai](../../research/analyzer-lab/docs/ANALYZER-DEVELOPMENT-METHOD.md#primary-reference-sources) pontosítják az upstream képességeket. Több oracle egyezése hasznos hibakeresési jel, de a korrelált tévedés és eltérő confidence-jelentés miatt nem lesz automatikusan igazság. A külső modulokat csak a saját céljaikban validált eredményekhez használjuk; a Plexus előnye a megbízható, fogyasztóspecifikus összekapcsolás lehet.

## Ebben a körben ténylegesen elkészült

Az audit és a fejlesztési szerződés mellett a lab event reportjai most külön közlik a téves/mulasztott eseményszámot, az előjeles átlag/medián időhibát, az abszolút mediánt, p95/p99-et és a mintaszámot. A matching, az F-mérték és a választási küszöbök nem változtak. Az időhiba **csak párosított eseményekre** vonatkozik: rossz recall mellett a kis p95 nem elfogadási bizonyíték. Kis mintából számított p99 nem populációs hibagarancia.

Az audit után az AN-01 javította a bemeneti védelmet, a hangvég megőrzését, a feature-időalapot, az RMS jelentését és a lab csatornapolitikáját. A [külön AN-01 jegyzőkönyv](../../research/analyzer-lab/docs/AN-01-VALIDATION.md) rögzíti a konkrét bizonyítékot és a részablak támadásfelismerésének korlátját. A többi feltárt production hiba további ciklusok feladata. Az [eredeti audit jegyzőkönyve](../../research/analyzer-lab/docs/ANALYZER-AUDIT-VALIDATION.md) történeti, 6-os állapotú rekord marad; valódi audió/Quest méréseket nem helyettesít.

## AN-03E: hanglevétel-szűrés és valódi felvételek

Az [AN-03E kör](../../research/analyzer-lab/docs/AN-03E-VALIDATION.md) külön
kutatási analyzer-függvényben a folytatási és második differencia teljesítményének
irányára épít. Az ismert 1081 találat megmaradt; a hanglevételi téves jelöltek
6-ról 2-re, az új szintetikus mátrixon 14-ről 0-ra csökkentek. A lágy támadások
kimaradását ez a részhalmaz-szűrő nem javítja. Három felhasználói MP3 kilenc,
összesen 180 s részletén 647 Plexus és 1318 librosa jelölt keletkezett; 25 ms-nál
426 közös eseménnyel. Annotáció nélkül ez eltérés, nem pontosságmérés. Következő
lépés önálló zenei jelölés és pozitív, több frekvenciasávos támadásbizonyíték.
A production alapértelmezés, worker és verzióválasztás változatlan maradt.

## AN-03F: két library egyezése és visszautasított csúcsdetektor

Az [AN-03F kör](../../research/analyzer-lab/docs/AN-03F-VALIDATION.md) tényleges
librosa/audioFlux futással, ugyanazon PCM-en 1184 közös onset-referenciát rögzít.
A felhasználó tartós szabálya szerint csak két külső library azonos képességben
és mérésben kapott egyezése lehet elfogadott fejlesztési referencia. Az egyoldalú
eredmény ismeretlen marad; a Plexus nem szavaz saját referenciájára. A jelöltnek
mindkét eredeti időponthoz külön illeszkednie kell. A
[referenciapolitika](../../research/analyzer-lab/docs/TWO-LIBRARY-REFERENCE-POLICY.md)
az eddigi megengedő konszenzus/export kimeneteit történeti diagnosztikának tekinti,
nem elfogadott tanítási célpontnak. Más képességhez külön két működő referencia kell.

Az egyezés még nem ground truth: egy kontrollon közös hanglevételi tévesztés is
előfordult. Az új csúcsdetektor az ismert eseteken 11 további támadást talált,
de az előre rögzített új eseteken 58 további pontatlan/többletjelöltet adott
±2 ms-nál, ezért **nem kapcsoljuk be javításként**. A v6 szűrőnél is megmarad
egy új kihagyási ellenpélda. A programok, eredmények és sikertelen változatok
megőrzése lehetővé teszi, hogy a következő frekvenciasávos támadásmodell ezeket
is javítsa. Minden korábbi aktív teszt együtt fut az újakkal; vizuális/XR
célpontokhoz továbbra is külön annotáció, pontosság- és költségkapu szükséges.

## AN-03G: fizikai frekvenciasávok és értelmezési kapu

Az [AN-03G kör](../../research/analyzer-lab/docs/AN-03G-VALIDATION.md) tényleges
DSP-fejlesztés: rögzített Hz-es sávokban külön méri a háttér előrejelezhetőségét
és az új támadást, majd az eredeti PCM-en finomítja az időpontot. A kiválasztott
változat 589 ismert feltételen 63,112 új feltételen71 további támadást talál
±2 ms-nál, a korábbi többlet- és negatív jelöltszámok megtartásával. Az első,
sikertelen paraméterrácsok is megmaradnak. Ez korlátozott szintetikus igazolás,
nem általános vagy XR-kész zeneértés; a meglévő kihagyások és tévesztések élnek.

A külön szemantikai `assessAcousticOnsets` kapu azonos PCM/időalaphoz köt,
mindkét külső könyvtár eredeti időpontját megköveteli és változatlanul őrzi a
jelölt idejét. A kilenc valódi részleten 379-ről439-re nő a minősített egyezés,
a korábbi library-futások befagyasztott eredményeit újrahasználva. A kutatási
jelölt továbbra is diagnosztika: nem lesz automatikus dramaturgiai tény,
koreográfiai esemény vagy XR-pontozási cél. A production integráció előtt
független zenei annotáció és fogyasztói időzítés/költség mérés szükséges.
