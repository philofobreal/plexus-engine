# Analyzer jel-, idő- és szintszerződés — AN-01

Állapot: implementált, analyzer algoritmusverzió **7**. A [kísérleti terv](../../research/analyzer-lab/docs/AN-01-EXPERIMENT.md) és a [mérési jegyzőkönyv](../../research/analyzer-lab/docs/AN-01-VALIDATION.md) rögzíti az elfogadás bizonyítékait. Ez a csomag az elemzés matematikai és adatszerződését javítja; a zenei pontossági célok teljesítését külön mérjük.

## Bemenet és csatorna

A tiszta `analyzeAudio` belépési pont nem üres, véges `Float32Array` PCM-et fogad, [-8,8] amplitúdótartományban. Az 1 fölötti amplitúdó megengedett headroom; nincs néma clipping. A sample rate egész, 1000–384000 Hz; a jelenlegi közös hop/FFT-ablak kettőhatvány, 4–65536 minta. A request ID nemnegatív biztonságos egész. Hibás input a DSP és a progress callback előtt hibát ad. A matematikai FFT külön a 2 mintás transzformációt is támogatja; elemzéshez a 2 mintás szimmetrikus Hann használhatatlan.

Az AudioEngine csatorna 0-t használ; a lab alapértelmezése most ugyanez. A lab explicit `arithmetic-mean` vetítést is fogad, de rögzíti a `monoProjection` mezőt és a dekódolt mono f32le PCM SHA256 hashét. Az összehasonlítás eltérő PCM-identitás vagy óra esetén hibát ad. A régi egysávos annotáció mean/channel-0 megnevezése elfogadható, mert a jel azonos; különböző többcsatornás vetítések nem azonosak. A szintetikus WAV-ellenőrzés igazolja a csatornapolitikát. A böngésző és SoundFile tényleges dekódolásának/resamplingjának egyezése még külön mérés.

## Valódi mintatartomány és idő

L valódi minta, fs sample rate és H hop mellett a frame-ek száma `ceil(L/H)`, az audió hossza `L/fs`. A végső FFT-ablak hiányzó része nulla; az RMS és ZCR csak a valódi mintákat számolja. A bass/sub feature-ök azonos frame-számot adnak. A publikált beat/bar-start időpontok az audió `[0,L/fs)` tartományába esnek; a záró bar/szakasz és tension-trend vége legfeljebb L/fs.

Az opcionális `TrackAnalysis.featureClock` mező:

```ts
{ sampleRate, sampleCount, hopSize, windowSize,
  originSample: 0, timestamp: 'window-start', tailPolicy: 'zero-pad' }
```

A jelenlegi `windowSize === hopSize`. A mező csak a duration, feature-szám és featureHopSize egyezése esetén érvényes. A cue evidence, transition dynamics és performance-plan buildup vetítése ugyanazt a H/fs lépést használja. A normalizáló megőrzi a helyes órát, az ellentmondásos órát eldobja. Régi payload esetén megmarad a duration/frameCount vetítés; nem találunk ki sample rate-et vagy sample countot.

A frame-start időbélyeg a mérési ablak eredete. Nem garantálja egy hallható támadás mintapontos helyét, és önmagában nem bizonyít XR időzítési pontosságot.

## A hiányos végső ablak bizonyítéka

A részleges ablak akusztikai feature-ei megmaradnak, de ebből az ablakból nem fogadunk el vizuális támadást vagy grid-inferencia bizonyítékot. A track tipikus maximuma és sustain-referenciái teljes ablakokra épülnek; teljes ablak nélküli rövid jel saját akusztikai adatai továbbra is leírhatók. Ez megakadályozza, hogy egy levágott kitartott hang hamis ütést vagy új rácsfázist hozzon létre.

Az utolsó részablakban induló valódi támadás ezért kimaradhat az eseményekből. Az ebből a következtetésből kizárt részablak valódi támogatása rövidebb egy hopnál: 1024 mintánál 44,1 kHz-en 23,22 ms, 48 kHz-en 21,33 ms. Ez az ablak támogatási korlátja, nem általános időhiba- vagy recall-garancia; az ablakhatárra eső korábbi támadások felismerése is külön fázisvizsgálatot igényel. A kihagyás bizonyítékhiány, nem igazolt csend. Az AN-02 átfedő ablakolásának és teljes fázissweepjének kell feloldania; a jelenlegi guard nem általános onset-detektor.

## RMS és dramaturgiai energia

A bar és szakasz új, opcionális `rmsAmplitude` mezője a megvalósított frame-intervallum valódi mintákkal súlyozott amplitúdó-RMS-e:

`sqrt(sum(blockRms[j]^2 * validSamples[j]) / sum(validSamples[j]))`.

Ez PCM amplitúdóegység, nem SPL és nem dB. A szakaszhatárra eső blokkot frame-intervallum szerint rendeljük hozzá; nincs új mintaszintű határfinomítás. A végső bar részablaka akkor is beleszámít, ha a valódi audióhossz pontosan egész másodperc.

Az `avgRms = clamp(rmsAmplitude / max(typRms, 1e-6), 0, 1)` barban és szakaszban azonos jelentésű; a `peakRms` a maximum blokk-RMS ugyanilyen normalizálása. Az `energy` továbbra is külön arrangement-relative dramaturgiai jellemző. A régi payload hiányzó fizikai RMS-értékét nem gyártjuk le az energy mezőből.

## Fejlesztői használat

A [stabil módszer](../../research/analyzer-lab/docs/ANALYZER-DEVELOPMENT-METHOD.md) szerint a következő ciklus új hipotézissel és előre rögzített védett regressziókkal indul. Az AN-01 bemeneti/óra/RMS tesztjei új adatszerződések kapui; a kilenc ismert zenei golden továbbra is regressziós anyag. Ezen a körön nincs új modellválasztás, dobmodell-előléptetés vagy független zenei holdout állítás. Az algoritmusverzió-emelés új cache-identitást ad.
