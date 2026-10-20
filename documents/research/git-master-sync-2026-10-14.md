# A GitHub főág beolvasztása az analyzer worktree-be

Dátum: 2026-10-14, Europe/Budapest. Integrációs tulajdonos: Codex / root.

A frissítés a `codex/analyzer-oracle-lab` ágon történt. A GitHub alapértelmezett
ága `master`; nincs `main` ág. Az itteni `origin` az eredeti helyi repositoryra
mutat. Az eredeti checkout ágát és fájljait nem módosítottuk.

## Elvégzett lépések

1. `git status --short --branch`, `git branch -vv`, `git remote -v` és
   `git worktree list`: a projekt tényleges Git-gyökere a `plexus-engine/` könyvtár.
   A kiinduló commit `29371e4fd65b5fc9defa6ebb4bca0b1488ed5e14` volt.
2. Az eredeti repository állapotának olvasási ellenőrzése és
   `git ls-remote --symref https://github.com/philofobreal/plexus-engine.git HEAD refs/heads/master refs/heads/main`:
   a hiteles frissítési cél `398667436d15ab8af78cbdff0141e0151870241f`.
   A sandbox első hozzáférési hibája után az olvasás és a fetch engedélyezett,
   kibővített jogosultságú parancsfuttatással sikerült.
3. `git remote add upstream https://github.com/philofobreal/plexus-engine.git`,
   majd `git fetch upstream master`: külön távoli bejegyzés őrzi a GitHub
   eredetet, az eredeti `origin` megmaradt. Négy beérkező commit, 55 érintett fájl.
4. A korábbi kumulatív nyilvántartás ellenőrzése sikeres volt: v0010, nulla eltérés.
   `git add -A` és `git commit -m 'chore: preserve analyzer research before syncing master'`:
   az összes Gitbe szánt helyi fejlesztés mentő commitja
   `55df400097bf7fe13e8e6ff1183d556ce03ee76b` (1085 fájl).
   A kizárt futtatási környezetek, generált mérések és helyi audiofájlok a helyükön maradtak.
5. `git merge --no-ff upstream/master -m 'merge: sync GitHub master into analyzer oracle lab'`:
   egyetlen tartalmi konfliktus volt, a `.gitignore` fájlban. Az analyzer labor
   kizárásait és az upstream `*.mp3` kizárását egyaránt megtartottuk.
   A tesztelési governance dokumentum automatikusan összeolvadt: a kumulatív
   megőrzési szabályok és az új XR-tesztek felsorolása együtt maradtak.
   `git add .gitignore`, `git diff --cached --check`, `git commit --no-edit`:
   a merge commit `09ca03d2ff6bf8af13e3e7c03f45c92d840b9d0b`.
6. A Git-fák összehasonlítása igazolta: 1083 helyi fejlesztési fájl blobja és
   fájlmódja változatlan; két közös fájl összevont. Az upstream 53 további
   fájlja pontosan az érkezett változat. Az analyzer, a semantics, a korábbi
   kutatási anyag és a függőségdeklarációk tartalma nem változott a merge során.
   `git merge-base --is-ancestor upstream/master HEAD` sikeres.
7. A főágról érkezett 12 módosított teszt és egy korábban védett segédfájl
   mindegyikéhez külön előd-/utód-SHA256 és integrációs indok készült.
   A régi források a változatlan `v0010.sources.zip` archívumban maradnak;
   három új Node-tesztfájl csatlakozott a kumulatív futtatáshoz.
   A v0011 nyilvántartás létrejött, védett fájl törlése nélkül.
8. A teljes build, Node- és Python-validáció eredménye az alábbi részben szerepel.

## Megőrzött bizonyíték és reprodukció

- [Integrációs bizonyíték](../../research/analyzer-lab/fixtures/git-master-sync-20261014.evidence.json).
- [Tételes tesztmigrációk](../../research/analyzer-lab/fixtures/git-master-sync-20261014.migrations.json).
- [Megőrzési ellenőrzőprogram](../../research/analyzer-lab/diagnostics/record_git_master_sync.py).
- [V0011 kumulatív nyilvántartás](../../research/analyzer-lab/tools/harness/inventories/v0011.json).

Az ellenőrzőprogram bemenete a négy rögzített Git-commit, a v0010 nyilvántartás
és a beolvasztott tesztforrás. Kimenete új, felülírást elutasító migrációs és
bizonyíték-JSON. A fájlonkénti indokok a programban rögzítettek; ez az adott
integráció reprodukciója, nem tetszőleges forrásváltozások automatikus jóváhagyása.
A reprodukció új kimeneti prefixet igényel, az integráció utáni forrásállapotban:

```powershell
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/diagnostics/record_git_master_sync.py --prefix research/analyzer-lab/.cache/git-master-sync-reproduction
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py inventory --migrations research/analyzer-lab/fixtures/git-master-sync-20261014.migrations.json --report research/analyzer-lab/.cache/git-master-sync-inventory.json
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py full --report research/analyzer-lab/.cache/git-master-sync-full.json
```

A jelentések új fájlnevet igényelnek ismételt futtatáskor. A már elkészült
nyilvántartás történeti rekord: nem kell újra létrehozni a validációhoz.

## Validáció

A teljes kumulatív futtatás azonosítója `20261014T172027-8a47517bb051`.
A [megőrzött futtatási jelentés](../../research/analyzer-lab/tools/harness/history/20261014T172027-8a47517bb051.json)
és a hozzá tartozó forrás-/eredményazonosságok a harness történetében maradnak.

- `npm run build`: sikeres, TypeScript és Vite. A nagy bundle figyelmeztetés nem buildhiba.
- `npm test -- --test-reporter=<harness node-reporter.mjs URI>`: 1449 teszt,
  1440 sikeres, 9 sikertelen, nulla kihagyott/cancelled/todo teszt; 145/145 aktív
  Node-tesztfájl futott. A rekurzív tesztfelfedezést a megőrzött `scripts/run-tests.mjs` végzi.
- Labor Python: `python -m pytest tests -q -p no:cacheprovider -o junit_family=xunit1`
  a harness által elkülönített `--basetemp` és `--junitxml` útvonalakkal:
  314 sikeres teszt, 27/27 labor-tesztfájl.
- A kilenc Node-hiba neve és állításbizonyítéka pontosan megfelel a korábbi
  ismert hibáknak: Wormhole clip-profile (4), geometry-LFO (1),
  preset-differentiation (2), projected-motion (2). Ismeretlen/új hiba: 0.
  A harness összesített állapota **failed**, exit code 1; az ismert hibák
  nem változtatják sikeressé a tesztsort.
- Nyilvántartás: v0011, 1145 védett fájl, 13 indokolt forrásmigráció,
  három új Node-tesztfájl és a frissítés megőrzött ellenőrzőprogramja/bizonyítékai.
  A v0011 forrásarchívum SHA256:
  `a90734048058f6c43e030fd69c8bf3d0dbda78473bb84521e2e5fa683e39b447`.
- A források nem változtak a teljes futtatás alatt; a befejező nyilvántartás-ellenőrzés sikeres.
  A teljes futtatási bizonyíték SHA256:
  `eb0deda0021eeb6b8feffa98364507b14167237836ac30a9b3ddc3dc1ad5434b`.
- `git diff --check` sikeres; a forrásokban nincs megmaradt merge-konfliktusjelölő.

Node `v25.2.1`, npm `11.6.2`, a meglévő izolált labor Python környezet.
A harness a megtalált Node-on keresztül indította a meglévő npm CLI-t;
nem volt szükség alternatív runtime-ra vagy új függőségre. A jelentésben
szerepelnek a pontos executable-, reporter-, munkakönyvtár- és logútvonalak.

A rövid életű Vite szerver elindult. Az első HTTP-próba hibásan a base nélküli
`/xr/` útvonalra ment; a helyes cím `/plexus-engine/xr/`. A localhost-kérést
először a sandbox socket-hozzáférése blokkolta; kibővített jogosultsággal a
helyes cím kérése 5 másodperc után időtúllépett. A HTTP/UI smoke ezért nem
igazolt, pixel- vagy headsetes eredményt nem állítunk. A próbaszerverek leálltak.

Nem történt dependency-telepítés, golden-master újragenerálás vagy push.
A frissítés önmagában nem új analyzer-pontossági mérés. A fizikai Quest
elfogadás külön headsetes ellenőrzést igényel; ez a Git-integráció nem helyettesíti.
