import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoader} from './helpers/xr-loader.mjs';
const {resolveMp4Vp9Color,mp4Vp9ColorArgs}=createLoader()('export/Mp4Vp9Color.ts');

test('VP9 stream copy keeps explicit encoder color metadata and uses accepted SDR defaults only when missing',()=>{
    assert.deepEqual({...resolveMp4Vp9Color()},{primaries:'bt709',transfer:'bt709'});
    const input={codec:'vp09.02.51.10',colorSpace:{primaries:'bt709',transfer:'iec61966-2-1',matrix:'bt709',fullRange:true}};
    const original=structuredClone(input);assert.deepEqual({...resolveMp4Vp9Color(input)},{primaries:'bt709',transfer:'iec61966-2-1'});assert.deepEqual(input,original);
    assert.deepEqual({...resolveMp4Vp9Color({codec:'vp09.02.50.10.01.02.02.01.01'})},{primaries:'bt709',transfer:'bt709'});
});

test('CICP color fields are read at their actual positions and preserve explicit HDR descriptions rather than relabelling them',()=>{
    const metadata={codec:'vp09.02.51.10.01.09.16.09.00',colorSpace:{primaries:'bt709',transfer:'bt709'}};
    assert.deepEqual({...resolveMp4Vp9Color(metadata)},{primaries:'bt2020',transfer:'smpte2084'});
    assert.deepEqual({...resolveMp4Vp9Color({codec:'vp09.02.51.10.01.01.13.01.01'})},{primaries:'bt709',transfer:'iec61966-2-1'});
    assert.deepEqual({...resolveMp4Vp9Color({colorSpace:{primaries:'bt2020',transfer:'hlg'}})},{primaries:'bt2020',transfer:'arib-std-b67'});
});

test('untrusted color names cannot escape the finite FFmpeg metadata mapping or add a pixel/GOP conversion',()=>{
    const color=resolveMp4Vp9Color({codec:'vp09.02.51.10',colorSpace:{primaries:'constructor',transfer:'__proto__'}});
    assert.deepEqual([...mp4Vp9ColorArgs(color)],['-color_primaries','bt709','-color_trc','bt709']);
    assert.deepEqual([...mp4Vp9ColorArgs(resolveMp4Vp9Color({colorSpace:{transfer:'iec61966-2-1'}}))],
        ['-color_primaries','bt709','-color_trc','iec61966-2-1']);
});
