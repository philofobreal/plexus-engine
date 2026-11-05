import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTimedCaptions, captionAtTime, captionLimits } from '../src/presentation/timedCaptions.ts';

const block = (start, end, text, style = '') => `## ${start} --> ${end}${style ? ' [' + style + ']' : ''}\n${text}`;

test('timed Markdown retains accented text, styles and explicit paragraph breaks', () => {
    const parsed = parseTimedCaptions('\uFEFF' + block('00:12.500', '00:17.000',
        '**NEON** _Őrült ütem_\r\n\r\nÚj szakasz.', 'title').replace('\n', '\r\n'), 17000);
    assert.deepEqual(parsed, { ok: true, plan: [{ startMs: 12500, endMs: 17000, style: 'title', lines: [
        [{ text: 'NEON', emphasis: 'bold' }, { text: ' ', emphasis: 'none' }, { text: 'Őrült ütem', emphasis: 'italic' }],
        [], [{ text: 'Új szakasz.', emphasis: 'none' }],
    ] }] });
    assert.ok(Object.isFrozen(parsed.plan) && Object.isFrozen(parsed.plan[0]) && Object.isFrozen(parsed.plan[0].lines[0][0]));
    assert.throws(() => { parsed.plan[0].lines[0][0].text = 'edited'; }, TypeError);
});

test('half-open intervals preserve exact boundaries, gaps and backward seeks', () => {
    const parsed = parseTimedCaptions([
        block('00:03.000', '00:04.000', 'third'), block('00:01.000', '00:02.000', 'first'),
        block('00:02.000', '00:02.500', 'second', 'small'),
    ].join('\n\n'));
    assert.equal(parsed.ok, true);
    assert.deepEqual([999.99, 1000, 2000, 2500, 3000, 4000, 1999.99, NaN, -1].map(
        ms => captionAtTime(parsed.plan, ms)?.lines[0][0].text),
    [undefined, 'first', 'second', undefined, 'third', undefined, 'first', undefined, undefined]);
});

test('bad time, overlapping intervals and invalid track ranges publish no partial plan', () => {
    const parsed = parseTimedCaptions([
        'text before cues',
        block('00:00.000', '00:02.000', 'valid'),
        block('00:01.000', '00:01.200', 'overlap'),
        block('00:02.000', '00:01.500', 'reversed'),
        block('-00:01.000', '00:02.000', 'negative'),
        block('00:02.000', '00:04.001', 'past end'),
        block('00:02.000', '00:03.000', ''),
    ].join('\n'), 4000);
    assert.equal(parsed.ok, false);
    assert.equal('plan' in parsed, false);
    assert.deepEqual(parsed.diagnostics.map(d => [d.line, d.code]),
        [[1, 'outside-cue'], [6, 'interval'], [8, 'header'], [10, 'track-range'], [12, 'empty'], [4, 'overlap']]);
});

test('unsupported HTML, URLs and delimiters remain inert text', () => {
    const content = '<img src=x onerror=alert(1)> [x](javascript:alert(2)) foo_bar __not__ _yes_ ***literal***';
    const parsed = parseTimedCaptions(block('00:00.000', '00:01.000', content));
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.plan[0].lines[0].map(run => run.emphasis), ['none', 'italic', 'none']);
    assert.equal(parsed.plan[0].lines[0].map(run => run.text).join(''), content.replace('_yes_', 'yes'));
});

test('rejects oversized source, long Unicode lines, too many lines and too many cues', () => {
    assert.equal(parseTimedCaptions('x'.repeat(captionLimits.sourceUnits + 1)).diagnostics[0].code, 'source-size');
    const line = '🎵'.repeat(captionLimits.codePointsPerLine);
    assert.equal(parseTimedCaptions(block('00:00.000', '00:01.000', line)).ok, true);
    assert.equal(parseTimedCaptions(block('00:00.000', '00:01.000', line + 'ő')).diagnostics[0].code, 'line-size');
    assert.equal(parseTimedCaptions(block('00:00.000', '00:01.000', 'a\n'.repeat(captionLimits.linesPerCue + 1))).diagnostics[0].code, 'line-count');
    const tiny = block('00:00.000', '00:00.001', 'a') + '\n';
    assert.equal(parseTimedCaptions(tiny.repeat(captionLimits.cues + 1)).diagnostics[0].code, 'cue-count');
    assert.deepEqual(parseTimedCaptions('\n'), { ok: true, plan: [] });
});
