# Timeline Modularization Design

## 1. Bevezetes es Epiteszeti Osszefoglalo

A Plexus Engine korabbi idovonal-megoldasa tul sok felelosseget gyujtott a `DashboardUI.ts` fajlba. Ugyanaz az osztaly kezelte a DOM elemek kikereseset, az audiolejatsszas vezerleset, a globalis `State` frissiteset, az alacsony szintu pointer- es touch-esemenyeket, a zoom/pan matematikat, a canvas pixel-szintu kirajzolasat, a HDPI meretezest, a hullamforma cache-t, valamint a dramaturgiai rajzolasi es preset-festesi uzleti logikat.

Ez a monolitikus forma magas kognitiv terhelest okozott: egy kisebb interakcios modositasnal is egyszerre kellett megerteni a DOM-esemenyeket, a zenei szekcio-adatmodellt, a canvas renderelest es az audio seek mellekhatasait. A tesztelhetoseg is romlott, mert a tisztan bemeneti logika es a tisztan renderelesi logika nem volt kulon vizsgalhato. A refaktor celja ezert nem egyszeruen fajlok szetvagasa volt, hanem John Ousterhout APoSD elvei szerinti mely modulok kialakitasa: keves, stabil, egyszeru interfesz, amely mogott a modul elrejti a sajat komplexitasat.

Az uj felosztas:

```text
DashboardUI.ts (Facade)
  -> GestureEngine.ts (Deep Interaction Engine)
  -> TimelineCanvas.ts (Deep Renderer)
```

Ebben a mintaban a `DashboardUI` homlokzatkent mukodik. Ismeri az alkalmazas zenei fogalmait, a globalis `State`-et es az `AudioEngine`-t, de nem tartalmaz nyers browser input-normalizalast es nem rajzol kozvetlenul canvasra. A `GestureEngine` a nyers eger, wheel es touch esemenyeket normalizalt szemantikus callbackekke alakitja. A `TimelineCanvas` egy deklarativ renderelo: egy `RenderState` adathordozobol rajzol, mikozben elrejti a HDPI meretezest, az idobeli viewportot es a hullamforma cache-t.

Fontos tervezesi dontes, hogy nem keszultek kulon sekely osztalyok a zoomra, panre, scrubbingra vagy threshold-dragre. Ezek nem onallo architekturalis modulok, hanem a ket mely modul es a facade kozotti felelossegi hatarok menten helyezkednek el. A `GestureEngine` nem tudja, mit jelent a pan vagy a threshold; csak normalizalt inputot ad. A `DashboardUI` tudja, hogy az adott input mit jelent zenei es UI-kontekstusban. A `TimelineCanvas` pedig csak azt tudja, hogyan kell az adott allapotot kirajzolni.

## 2. GestureEngine: Mely Interakcios Modul

A `GestureEngine` az APoSD mely modul elvet ugy valositja meg, hogy a kulso interfesze kicsi es normalizalt, mikozben a belso implementacio tobb inputmodalitast kezel:

- `mousedown`, `mousemove`, `mouseup`, `mouseleave`
- `wheel`
- `touchstart`, `touchmove`, `touchend`, `touchcancel`
- `dblclick`
- multi-touch tavolsagmeres pinch-to-zoomhoz
- elem-bounding-box alapu koordinata-normalizalas
- aktiv drag allapot es elozo pont kovetese
- passziv es nem passziv event listener opciok elkulonitese
- `destroy()` alapu listener takaritas

A publikus szerzodes a `GestureCallbacks` interfesz:

```typescript
onStart?: (focusX, focusY, button, shiftKey) => boolean | void;
onMove?: (focusX, focusY, deltaX, deltaY) => void;
onEnd?: () => void;
onZoom?: (delta, focusX) => void;
onHover?: (focusX, focusY) => void;
onDoubleClick?: (focusX, focusY) => void;
```

A modul nem `clientX`, `touches[0]`, `DOMRect`, `preventDefault` vagy pointertipus reszleteket exportal. Ehelyett minden poziciot 0 es 1 kozotti `focusX` es `focusY` ertekke alakit az elem aktualis merete alapjan. A drag delta szinten normalizalt arany, nem pixel. Ez az informacio-elrejtes lenyege: a kulso kodnak nem kell tudnia, hogy egerrol, erintokepernyorol vagy touchpad zoomrol erkezett-e a bemenet.

A `GestureEngine` teljesen fuggetlen a zenei kontextustol. Nincs tudasa:

- track szekciokrol
- BPM-rol
- lejatszasi poziciorol
- `State.duration` ertekrol
- sensitivity override-rol
- preset brushrol
- canvas renderelesrol

Ez szandekos. Ha a modul tudna, mi az a szekcio vagy preset, az interfesze sekelyebbnek tunhetne, de a belseje osszekeverne input-normalizalast es alkalmazasi uzleti logikat. Ehelyett a `GestureEngine` csak azt donti el, hogy van-e aktiv interakcio. Az `onStart` visszateresi erteke jelzi, hogy a facade szeretne-e kovetni a draget. Ha igen, a modul tovabbi `onMove` es `onEnd` callbackeket kuld. Ha nincs aktiv drag, a `mousemove` es `touchmove` `onHover` callbacket ad, amelyre a Dashboard peldaul `row-resize` kurzort allithat.

Ez a kialakitas tesztelheto bongeszo nelkul is: egy mockolt element eleg, amely `addEventListener`, `removeEventListener` es `getBoundingClientRect` metodusokat ad. A `GestureEngine.test.mjs` ilyen kornyezetben ellenorzi a normalizalt start, move, hover, zoom es double-click mukodest.

## 3. TimelineCanvas: Mely Deklarativ Renderelo

A `TimelineCanvas` a renderelesi komplexitast rejti el. A kulso kod nem rajzol vonalat, nem szamol playhead pixelt, nem allit HDPI transzformaciot, es nem kezeli a hullamforma canvas cache-t. A kulso szerzodes lenyege:

```typescript
setAudioBuffer(buffer: AudioBuffer): void;
render(state: RenderState): void;
resize(): void;
```

A `render(state)` deklarativ. A `RenderState` tartalmazza a kirajzolashoz szukseges adatokat:

- `currentTime`, `duration`
- `zoom`, `pan`
- `bpm`, `sampleRate`, `hopSize`
- audio frame-ek
- szekciok, barok, cue-k es significant momentek
- buildup confidence, spectral pivot es tension trendek
- section override-ok
- aktualis audio sensitivity es drop anticipation
- opcionalis `scrubTime`

A renderelo nem olvas kozvetlenul a globalis `State`-bol. Ez az informacio-elrejtes masik oldala: a `TimelineCanvas` nem tudja, honnan jon az adat, csak azt, hogyan kell azt vizualisan lekepzeni. Ez csokkenti a rejtett fuggosegeket es egyszerubbe teszi a tesztelest, mert a renderelo mockolt canvas-kontextussal es konstrualt `RenderState` objektummal is futtathato.

A modul belso allapota minimalis es renderelesi jellegu:

- `ctx`
- `cssWidth`, `cssHeight`
- `waveformCache`
- `waveformPeaks`
- `lastWaveformCacheKey`

Ez nem alkalmazasi allapot, hanem teljesitmenyoptimalizalasi cache. A zenei igazsag tovabbra is a `RenderState`-ben van.

### Offscreen Caching

A hullamforma renderelese kulonosen erzekeny teljesitmenyre, mert zoom es pan kozben sokszor frissulhet. A `setAudioBuffer` elore kiszamolja a hullamforma RMS-jellegu amplitudo bucketjeit. A bucketek szama korlatozott: legalabb 512, legfeljebb 4096, es a track hossza alapjan skalazodik. Ez egyszeri CPU-munka az audio buffer betoltese utan.

A `drawWaveform` ezutan nem minden frame-ben szamolja ujra az audio mintakat. Ehelyett a renderelo egy memoriabeli canvasra rajzolja fel a hullamformat. Ha elerheto az `OffscreenCanvas`, azt hasznalja; kulonben egy lathatatlan `document.createElement('canvas')` cache a fallback. A cache ervenyesseget a `lastWaveformCacheKey` hatarozza meg, amely figyelembe veszi a meretet, viewportot es adatforras hosszat.

Amikor a cache ervenyes, a lathato canvasra csak egy `drawImage(cache, 0, 0)` tortenik. Ez a CPU oldali ujraszamolast es a fill-rate terhelest csokkenti. Zoomolas es vonszolas soran a renderelo a viewportot ujraszamolja, de a hullamforma mintak feldolgozasa nem szivodik vissza a Dashboardba. A Dashboard csak `zoom` es `pan` ertekeket ad at a `RenderState`-ben.

A `TimelineCanvas` tovabbi belso reszleteket is elrejt:

- HDPI meretezes `devicePixelRatio` alapjan
- idotartomany viewport szamitas
- idobol pixelbe lekepezes
- dramaturgiai szekciok szinezese
- gridline-ok BPM alapjan
- RMS es peak barok
- buildup es spectral pivot overlay
- drop anticipation sav
- sensitivity es preset override jelolesek
- cue markerek
- scrub/playhead allapot

## 4. DashboardUI: A Tiszta Homlokzat

A `DashboardUI` a ket mely modul kozotti koordinacios pont. Ez a facade felelos:

- DOM elemek kikereseseert
- `TimelineCanvas` es `GestureEngine` peldanyositasert
- `GestureEngine` callbackek bekotesert
- globalis `State` frissitesert
- `AudioEngine.seek()` hivasaert
- `AudioEngine.getAudioBuffer()` utan `TimelineCanvas.setAudioBuffer()` hivasaert
- `ResizeObserver` bekoteseert
- `RenderState` osszeallitasert
- playback, upload, presetlista, tuning panel es metric UI megtartasaert

A `DashboardUI` nem rajzol kozvetlenul canvasra. A `drawDramaturgyTimeline()` lenyege, hogy koveti a playheadet, majd meghivja:

```typescript
this.timelineCanvas.render(this.getRenderState());
```

Ez tiszta facade viselkedes: a Dashboard osszegyujti az allapotot es tovabbitja a renderelonek. Az alacsony szintu pixelmunka a `TimelineCanvas`-ban marad.

### Threshold Dragging

A threshold dragging egy alkalmazas-specifikus interakcio, ezert nem a `GestureEngine`-ben es nem a `TimelineCanvas`-ban van. A `GestureEngine` csak normalizalt `focusX` es `focusY` erteket ad. A `DashboardUI` forditja ezt zenei es UI-jelenteste.

Hover kozben a Dashboard:

1. `focusX` alapjan kiszamolja a `hoverTime` erteket `getTimelineTimeAtPercent(focusX)` segitsegevel.
2. Megkeresi azt a track szekciot, amelybe a hover ido esik.
3. Kiszamolja a grafikon belso mereteit: `topPad`, `bottomPad`, `graphHeight`.
4. A szekcio override ertekebol vagy globalis `audioSensitivity` ertekbol `normVal`-t kepez.
5. Kiszamolja a cyan threshold vonal pixelmagassagat:

```typescript
yThreshold = topPad + graphHeight * (1 - normVal)
```

6. Ha a kurzor Y pozicioja a vonaltol 12 pixelen belul van, `canvas.style.cursor = 'row-resize'`.

Drag inditaskor, ha a pointer threshold kozeleben van, a Dashboard beallitja:

```typescript
this.isDraggingThreshold = true;
this.draggingSectionIdx = thresholdHit.sectionIdx;
```

Mozgas kozben a Dashboard a normalizalt `focusY` ertekbol visszaszamolja az uj sensitivity erteket:

```typescript
const normVal = clamp(1 - (mouseY - topPad) / graphHeight, 0, 1);
const sensVal = 0.1 + normVal * 3.9;
```

Majd a megfelelo section override-ot frissiti:

```typescript
State.sectionOverrides[key] = { sensitivity };
```

vagy letezo override eseten csak a `sensitivity` mezot irja at. Ez az uzleti logika a Dashboardban marad, mert itt van meg a zenei szekcio es a globalis state kontextusa.

### Dramaturgy Automation es Preset Brushing

A draw mode szinten Dashboard-szintu uzleti logika. Ha `State.drawModeActive` igaz es bal gombbal indul az interakcio, a Dashboard:

```typescript
State.isDrawingEnvelope = true;
this.drawAutomationAtPointer(focusX, focusY);
```

A `drawAutomationAtPointer` feladata, hogy a normalizalt pointerbol zenei muveletet hozzon letre:

1. `focusX` -> `hoverTime`
2. `hoverTime` -> aktualis szekcio index
3. BPM alapjan `secondsPerBar = (60 / State.bpm) * 4`
4. Ha a szekcio eleg hosszu, megprobal bar-hatarra splitelni:

```typescript
getNearestBarSplitTime(hoverTime, section.start, section.end, secondsPerBar)
```

5. Ha a split valid, a `splitTimelineSection` ket reszre bontja a szekciot, es atvezeti a `sectionOverrides` kulcsait, hogy a korabbi override-ok ne vesszenek el.

Ezutan a Dashboard a draw target alapjan dont:

- Ha `timelineDrawTarget === 'preset'`, akkor a `timelinePresetBrush` aktualis erteket alkalmazza `setSectionPresetOverride` segitsegevel.
- Egyebkent sensitivity envelope rajzolas tortenik, ugyanazzal a `sensVal = 0.1 + normVal * 3.9` lekepezessel, mint threshold draggingnel.

A preset brushing lenyege, hogy a rajzolasi mozdulat nem kozvetlenul vizualis objektumot hoz letre, hanem szekcio-szintu override-ot:

```typescript
State.sectionOverrides[key] = {
    sensitivity: State.visualTuning.audioSensitivity,
    preset
};
```

Rendereleskor a `TimelineCanvas` csak megjeleniti ezt az override-ot: cyan sensitivity cimke es magenta preset cimke formajaban. A preset betoltese es alkalmazasa tovabbra is a Dashboard/State/AudioEngine korul marad, nem a rendereloben.

## 5. Tesztelhetoseg es Karbantarthatosag

Az uj architektura legfontosabb karbantarthatosagi nyerese, hogy a bemenet, a rendereles es az alkalmazasi orkestracio kulon tesztelheto.

A `GestureEngine.test.mjs` bongeszo futtatasa nelkul ellenorzi a bemeneti modult. Egy minimalis mock element eleg:

- `addEventListener`
- `removeEventListener`
- `getBoundingClientRect`

Ezzel tesztelheto, hogy:

- a hover normalizalt `focusX/focusY` ertekeket ad
- a drag start normalizalt poziciot, gombot es `shiftKey` allapotot tovabbit
- a drag move normalizalt delta ertekeket ad
- az `onEnd` lefut
- a wheel zoom szemantikus `delta` es `focusX` erteket ad
- a double-click normalizalt poziciot tovabbit
- a `destroy()` eltavolitja a listener-eket

A `TimelineCanvas.test.mjs` mockolt canvas es 2D context mellett ellenorzi a renderelo lenyegi tulajdonsagait. A hullamforma RMS amplitudo bucketjei `AudioBuffer` mockbol szamolhatok, fizikai kepernyo nelkul. A renderelo invalid zoom es pan bemenetekre sem dob hibat, hanem belso clampelesen keresztul hatarok kozott tartja a viewportot.

A `contracts.test.mjs` tovabbra is vedo szerepet tolt be. Kifejezetten ellenorzi, hogy a helyreallitott specialis idovonal-funkciok megvannak:

- `drawAutomationAtPointer`
- `State.isDrawingEnvelope = true`
- `getNearestBarSplitTime`
- `splitTimelineSection`
- `State.sectionOverrides[key] = { sensitivity }`
- `setSectionPresetOverride`

Ez a tesztelasi retegezodes osszhangban van az APoSD szemlelettel. A mely modulok kis interfeszeiket stabilan tartjak, belso komplexitasuk pedig celzottan tesztelheto. A Dashboard maradhat az alkalmazasi dontesek helye, de nem kell egyszerre input-engine-nek es canvas-renderernek is lennie. Ennek eredmenye kisebb regresszios felulet, tisztabb modulfuggosegek es alacsonyabb kognitiv terheles a jovo fejleszteseinel.
