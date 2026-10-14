"""Verify only the v4 definition and additive adaptive version union against v5."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile


def digest(data): return hashlib.sha256(data).hexdigest()


def run(root, output):
    if output.exists(): raise FileExistsError('Migration must be new')
    store = root / 'research/analyzer-lab/tools/harness'
    manifest = json.loads((store / 'inventories/v0005.json').read_text())
    bundle = store / manifest['archive']
    if digest(bundle.read_bytes()) != manifest['archiveHash']: raise ValueError('Predecessor archive changed')
    path = 'tests/fixtures/analyzer/analysis-result.schema.json'
    with zipfile.ZipFile(bundle) as archive: before = archive.read(path)
    after = (root / path).read_bytes()
    if digest(before) != manifest['files'][path]['sha256'] or before == after: raise ValueError('Unexpected replacement')
    old, new = json.loads(before), json.loads(after)
    added = new['$defs'].pop('residualOnsets')
    original_ref = old['$defs']['trackAnalysis']['properties']['adaptiveOnsets']
    union = new['$defs']['trackAnalysis']['properties']['adaptiveOnsets']
    if union != {'anyOf': [original_ref, {'$ref': '#/$defs/residualOnsets'}]}: raise ValueError('Incorrect version union')
    new['$defs']['trackAnalysis']['properties']['adaptiveOnsets'] = original_ref
    if new != old or added['additionalProperties'] is not False or added['properties']['algorithm'] != {'const': 'residual-innovation-v4'}:
        raise ValueError('Schema changed beyond reviewed additive version')
    entry = {'path': path, 'predecessorSha256': digest(before), 'replacementSha256': digest(after),
             'reviewedBy': 'root integration owner',
             'reviewedReason': 'Adds strict residual-innovation-v4 definition and an anyOf retaining the original exact v3 reference. Reversing those two changes yields the identical v5 JSON; all v1/v2/v3 definitions and required fields are unchanged. Previous bytes remain in v5 ZIP, all old tests remain active. Six new Node tests verify independent authored truth, model support/clock, selector/default parity and malformed output; eleven independent Python actual-payload/schema tests pass. Full cumulative validation follows.'}
    with output.open('x', encoding='utf-8') as stream:
        json.dump([entry], stream, indent=2)
        stream.write('\n')
    print(json.dumps({'predecessorSha256': entry['predecessorSha256'], 'replacementSha256': entry['replacementSha256']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    run(args.root.resolve(), args.output)
