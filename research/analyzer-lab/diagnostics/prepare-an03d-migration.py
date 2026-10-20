"""Verify exact additive v5 schema and numeric unsupported-version test transition."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile


def digest(data): return hashlib.sha256(data).hexdigest()


def run(root, output):
    if output.exists(): raise FileExistsError('Migration must be new')
    store = root / 'research/analyzer-lab/tools/harness'
    manifest = json.loads((store / 'inventories/v0006.json').read_text())
    bundle = store / manifest['archive']
    if digest(bundle.read_bytes()) != manifest['archiveHash']: raise ValueError('Predecessor archive changed')
    paths = ['tests/fixtures/analyzer/analysis-result.schema.json', 'tests/analyzer-residual-onsets.test.mjs']
    entries = []
    with zipfile.ZipFile(bundle) as archive:
        for path in paths:
            before = archive.read(path); after = (root / path).read_bytes()
            if digest(before) != manifest['files'][path]['sha256'] or before == after: raise ValueError('Unexpected replacement')
            if path.endswith('.json'):
                old, new = json.loads(before), json.loads(after)
                added = new['$defs'].pop('differenceOnsets')
                original = old['$defs']['trackAnalysis']['properties']['adaptiveOnsets']
                expected = {'anyOf': [*original['anyOf'], {'$ref': '#/$defs/differenceOnsets'}]}
                if new['$defs']['trackAnalysis']['properties']['adaptiveOnsets'] != expected: raise ValueError('Incorrect union')
                new['$defs']['trackAnalysis']['properties']['adaptiveOnsets'] = original
                if new != old or added['properties']['algorithm'] != {'const': 'confirmed-difference-v5'} or added['additionalProperties'] is not False:
                    raise ValueError('Schema changed outside additive v5')
                reason = 'Only adds strict confirmed-difference-v5 definition and reference. Reversing both yields identical v6 JSON; existing definitions and required fields remain intact. Actual mixed v1/v2/v5 payload is independently schema-validated.'
            else:
                old = before.decode('utf-8').replace('\r\n', '\n')
                new = after.decode('utf-8').replace('\r\n', '\n')
                token = '[null, 0, 3, 5, 4.1, NaN'
                if old.count(token) != 1 or new != old.replace(token, '[null, 0, 3, 6, 4.1, NaN'):
                    raise ValueError('Unexpected prior-test rewrite')
                reason = 'Version 5 is now deliberately supported; move only its unsupported numeric example to 6. All other v4 assertions remain identical. New v5 tests explicitly cover supported 5 and unsupported 6. Exact predecessor retained in v6 ZIP.'
            entries.append({'path': path, 'predecessorSha256': digest(before), 'replacementSha256': digest(after),
                'reviewedBy': 'root integration owner', 'reviewedReason': reason + ' No failure exclusion or baseline refresh; cumulative full validation follows.'})
    with output.open('x', encoding='utf-8') as stream:
        json.dump(entries, stream, indent=2); stream.write('\n')
    print(json.dumps(entries))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    run(args.root.resolve(), args.output)
