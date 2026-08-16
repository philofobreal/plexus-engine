# Visual tuning presets

Put copied visual tuning JSON files in this folder.

Add each file name to `index.json`:

```json
{
  "presets": [
    "default.json",
    "my-stage-look.json"
  ]
}
```

Preset names shown in the app come from the JSON file names.
Older files may omit newer tuning parameters; missing values are filled from the app defaults when loaded.

## Saving during development

`npm run dev` adds a **Save preset** button beside **Copy config**. It updates only the selected,
registered preset file. Existing keys are refreshed from the live tuning state, and parameters
manually changed since the preset was loaded are appended. This keeps intentionally partial presets
partial while still allowing a newly developed tuning parameter to be authored from the panel.

The button and its file-writing endpoint exist only on the Vite development server. Production and
preview builds cannot write preset files.

### Wormhole storage map

The ten `vos-wh-*.json` files are the dedicated Wormhole presets and each owns its actual authored
`visualTuning` values. `index.json` only registers those file names, while `style-packs.json` only
maps dramaturgy roles to them; neither duplicates the values. Every shipped preset currently carries
at least one `wormhole*` compatibility/master key, but saving still updates exactly one selected JSON
file and never rewrites the manifest or style-pack mappings.
