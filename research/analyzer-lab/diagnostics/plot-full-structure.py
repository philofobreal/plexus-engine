"""Render a completed comparison as a standalone scientific figure; no inference.

python research/analyzer-lab/diagnostics/plot-full-structure.py --input RESULT.json --output NEW.png
"""
import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Use a new figure path; existing evidence is retained')
    data = json.loads(args.input.read_text(encoding='utf8'))
    results = data['results']
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.patches import Patch
    from matplotlib.lines import Line2D
    labels = sorted({s['label'] for r in results for row in [r['sourceSections'],
                    *[p['sections'] for p in r['comparisons']]] for s in row})
    palette = plt.get_cmap('tab20')
    colors = {label: palette(i) for i, label in enumerate(labels)}
    fig, axes = plt.subplots(len(results), 1, figsize=(16, 3.6 * len(results) + 1.6), squeeze=False)
    for ax, r in zip(axes[:, 0], results):
        rows = [('Plexus', r['sourceSections']), *[(p['family'], p['sections']) for p in r['comparisons']]]
        for y, (name, sections) in enumerate(rows):
            for s in sections:
                ax.barh(y, s['end'] - s['start'], left=s['start'], height=.7,
                        color=colors[s['label']], edgecolor='white', linewidth=.4)
                if s['end'] - s['start'] >= r['durationSec'] * .022:
                    ax.text((s['start'] + s['end']) / 2, y, s['label'][:4], ha='center', va='center', fontsize=7)
        tick_labels = [f'{name} ({len(ss)})' for name, ss in rows]
        automation = r.get('automationSceneEntries')
        if automation is not None:
            for key, color in [('planned', '#999999'), ('published', '#111111')]:
                times = automation[key]
                if times is not None:
                    ax.plot(times, [len(tick_labels)] * len(times), '|', color=color, markersize=13)
                    tick_labels.append(f'{key} scene cue ({len(times)})')
        for c in r['consensus']:
            ax.axvline(c['time'], color='black', linestyle=':', linewidth=.6, alpha=.45)
        for c in r['functionalConsensus']:
            ax.axvline(c['time'], color='#334477', linestyle='--', linewidth=1, alpha=.7)
        ax.set_yticks(range(len(tick_labels)), tick_labels)
        ax.invert_yaxis()
        ax.set_xlim(0, r['durationSec'])
        ax.set_xlabel('Original song time (seconds)')
        ax.set_title(f"{r['name']} - PCM {r['pcmSha256'][:12]}", loc='left', fontsize=11)
        ax.spines[['top', 'right']].set_visible(False)
    handles = [Patch(color=colors[label], label=label) for label in labels]
    handles += [Line2D([0], [0], color='black', linestyle=':', label='shared section boundary'),
                Line2D([0], [0], color='#334477', linestyle='--', label='shared function change')]
    fig.legend(handles=handles,
               loc='lower center', ncol=min(7, len(labels)), frameon=False, bbox_to_anchor=(.5, .035))
    fig.suptitle('Full-song section predictions - agreement is not ground truth', fontsize=14, y=.985)
    fig.text(.5, .015, 'Shared predictions within 1 s are not truth. Ticks: numeric scene cues. Chorus is not mapped to drop.',
             ha='center', fontsize=9)
    fig.tight_layout(rect=(0, .13, 1, .96))
    fig.savefig(args.output, dpi=160)
    plt.close(fig)


if __name__ == '__main__':
    main()
