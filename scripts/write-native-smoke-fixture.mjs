// Repeat the existing synthetic PCM16 WAV four times for a longer manual XR menu journey.
// node scripts/write-native-smoke-fixture.mjs [input.wav] [logs/t06/native-smoke.wav]
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const input=process.argv[2]??'logs/t02b/halo-smoke.wav',output=process.argv[3]??'logs/t06/native-smoke.wav';
const bytes=fs.readFileSync(input);
if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE'||bytes.toString('ascii',36,40)!=='data')throw Error('Expected canonical 44-byte PCM WAV header');
const header=Buffer.from(bytes.subarray(0,44)),pcm=bytes.subarray(44);const payload=Buffer.concat([pcm,pcm,pcm,pcm]);
header.writeUInt32LE(36+payload.length,4);header.writeUInt32LE(payload.length,40);const result=Buffer.concat([header,payload]);fs.writeFileSync(output,result);
console.log(JSON.stringify({input,output,bytes:result.length,seconds:payload.length/header.readUInt32LE(28),sha256:createHash('sha256').update(result).digest('hex')}));
