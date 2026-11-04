import assert from 'node:assert/strict';
import test from 'node:test';
import { checkMp4Storage, planMp4Storage } from './mp4-storage-admission.mjs';

const MIB = 1024 * 1024;
const config = { frames: 12_317, fps: 30, sampleRate: 48_000, sourceSamples: 19_707_550,
    videoBitrate: 28_000_000, waveHeaderBytes: 4096 };

test('storage accounts for all three coexisting files and the actual frame prefix', () => {
    const plan = planMp4Storage(config);
    assert.equal(plan.samples, 19_707_200);
    assert.equal(plan.limits.audio, 78_832_896);
    assert.equal(plan.required, plan.limits.video + plan.limits.audio + plan.limits.output);
    const prefix = planMp4Storage({ ...config, frames: 6 });
    assert.equal(prefix.samples, 9600);
    assert.equal(planMp4Storage({ ...config, sourceSamples: 1000 }).samples, 1000);
});

test('start and finalize independently enforce quota and keep a bounded reserve', () => {
    const plan = planMp4Storage(config), quota = 8 * 1024 * MIB, reserve = 256 * MIB;
    const at = (free, phase) => checkMp4Storage(plan, { quota, usage: quota - reserve - free }, phase);
    assert.equal(at(plan.required - 1, 'start').reason, 'insufficient-origin-storage');
    assert.equal(at(plan.required, 'start').ok, true);
    assert.equal(at(plan.limits.output - 1, 'finalize').ok, false);
    assert.equal(at(plan.limits.output, 'finalize').ok, true);
    assert.equal(checkMp4Storage(plan, { quota: 120 * MIB, usage: 0 }).reserve, 64 * MIB);
    assert.equal(checkMp4Storage(plan, { quota, usage: quota + 1 }).available, 0);
});

test('invalid clock, unavailable storage and RIFF overflow fail closed', () => {
    const plan = planMp4Storage(config);
    for (const estimate of [undefined, {}, { quota: 1, usage: -1 }, { quota: Infinity, usage: 0 }]) {
        assert.equal(checkMp4Storage(plan, estimate).reason, 'storage-estimate-unavailable');
    }
    assert.equal(planMp4Storage({ ...config, fps: NaN }).reason, 'invalid-export-clock');
    assert.equal(planMp4Storage({ ...config, frames: 1e7, sourceSamples: 1e10 }).reason, 'wav-size-limit');
});
