"""Verify exactly the reviewed additive adaptive schema against immutable v4."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile


def digest(data): return hashlib.sha256(data).hexdigest()


def run(root, output):
    if output.exists(): raise FileExistsError('Migration must be new')
    store = root / 'research/analyzer-lab/tools/harness'
    manifest = json.loads((store / 'inventories/v0004.json').read_text())
    bundle_path = store / manifest['archive']
    if digest(bundle_path.read_bytes()) != manifest['archiveHash']: raise ValueError('Predecessor archive changed')
    path = 'tests/fixtures/analyzer/analysis-result.schema.json'
    with zipfile.ZipFile(bundle_path) as bundle: before = bundle.read(path)
    after = (root / path).read_bytes()
    if digest(before) != manifest['files'][path]['sha256'] or before == after: raise ValueError('Unexpected replacement')
    old, new = json.loads(before), json.loads(after)
    added = new['$defs'].pop('adaptiveOnsets')
    reference = new['$defs']['trackAnalysis']['properties'].pop('adaptiveOnsets')
    if new != old or reference != {'$ref': '#/$defs/adaptiveOnsets'} or added['additionalProperties'] is not False:
        raise ValueError('Changed beyond reviewed additive transport')
    if added['properties']['algorithm'] != {'const': 'adaptive-innovation-v3'}: raise ValueError('Incorrect algorithm identity')
    entry = {'path': path, 'predecessorSha256': digest(before), 'replacementSha256': digest(after),
             'reviewedBy': 'root integration owner',
             'reviewedReason': 'Adds only strict optional adaptive-innovation-v3 definition/property, with local contrast and minimum spacing metadata. Formatting is normalized; JSON structure after removing these two additions is identical to immutable v4, including all required fields and v1/v2 schemas. The predecessor remains in v4 ZIP. Original tests stay active; six new Node tests verify core quality, clocks, malformed transport and default parity; nine independent Python actual-payload/schema tests pass. Full cumulative validation follows.'}
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
