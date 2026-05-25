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
