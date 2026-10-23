# PowerShell source export

Owner: build/tooling. `export-source_updated.ps1` creates a Markdown context export;
it does not change analyzer code, audio files, fixtures or historical results.

Run `./export-source_updated.ps1` to choose a profile, or pass `-Mode`:

| Menu | Mode | Contents |
|---|---|---|
| 1 | `developer` | Development source and configuration, excluding tests and measurement data |
| 2 | `test` | Test source and executable fixture helpers, excluding measurement data |
| 3 | `docs` | Documentation, excluding generated measurement reports |
| 4 | `all` | All supported source and documentation; recommended for ordinary context exports |
| 5 | `data` | Profile 4 plus test/analyzer fixtures, snapshots and measurement reports |
| 6 | `full` | Profile 5 plus audio files encoded as Base64 in the same Markdown file |

Profiles 1-5 never embed audio. Profile 6 includes MP3, WAV, FLAC, OGG, M4A,
AAC, Opus and AIFF files, including local gitignored music when `-UseGit` is set.
Other source and measurement files still follow `git ls-files` with `-UseGit`.
Base64 increases audio size by about one third, so choose profile 6 only when
the actual audio bytes are needed. Audio has a separate statistics row and zero
source lines. Decode each audio section's Base64 block to recover the original file.

```powershell
# Recommended: complete source without audio or measurement payloads.
.\export-source_updated.ps1 -Mode all -UseGit -Output plexus-source-export.md

# Include analyzer research measurements, but no music.
.\export-source_updated.ps1 -Mode data -UseGit -Output analyzer-source-export.md

# Explicitly include everything supported, with local audio.
.\export-source_updated.ps1 -Mode full -UseGit -Output full-source-export.md
```

The data profiles control non-executable files under `tests/fixtures/`,
the archived mirror `documents/tests/fixtures/`,
`tests/audio/`, analyzer-lab `fixtures/`, `diagnostics/`, `runs/`, `data/`, `tmp/`
and harness `inventories/` and `history/`. Python and JavaScript helpers remain
source files. Python source is included alongside the existing TS/JS formats;
`.jsonl`, `.csv` and `.tsv` are supported by profiles 5-6.

All profiles exclude dependencies, builds, caches, Python environments, Graphify
output, `*.local` folders, the current output and previous source exports. Custom
export names are recognized by their `# Source Export` header. Archives, models,
images and other unsupported binary formats are not a backup target even in profile 6.
Use a fresh output filename: an existing output is replaced.

The legacy `export-source.ps1` and Bash exporter are unchanged. These profiles
apply specifically to `export-source_updated.ps1`.

Validation: `node --test tests/source-export-powershell.test.mjs`. The integration
suite exercises all profiles with filesystem/Git inputs, interactive choices,
repeated exports, ignored audio and byte-exact Base64 recovery. It runs with
`pwsh` and, on Windows, `powershell` when available; without either it is skipped.
