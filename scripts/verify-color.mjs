import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { writeLut } from './color.mjs';
await writeLut();
// Test the actual FFmpeg transform against known absolute luminance targets.
function inversePQ(value) {
  const p=Math.max(value,0)**(32/2523);
  return 10000*(Math.max(p-3424/4096,0)/(2413/128-2392/128*p))**(16384/2610);
}
const results=[];
for(const [label,code,min,max] of [['black',0,0,.001],['mid gray',128,46,50],['peak white',255,599,601]]) {
  const input=Buffer.alloc(16*16*3,code);
  const bytes=execFileSync(process.env.FFMPEG_PATH||'ffmpeg',[
    '-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','16x16','-i','pipe:0',
    '-vf','format=gbrp,zscale=rin=full:r=full,format=gbrpf32le,lut3d=file=output/hdr-grade.cube:interp=tetrahedral',
    '-frames:v','1','-f','rawvideo','-pix_fmt','gbrpf32le','pipe:1'
  ],{input,windowsHide:true,maxBuffer:1024*1024});
  const nits=inversePQ(bytes.readFloatLE(0));
  assert.ok(nits>=min&&nits<=max,label+': unexpected '+nits+' nits');
  results.push({label,inputCode:code,decodedNits:nits});
}
await writeFile('exports/color-verification.json',JSON.stringify({checkedAt:new Date().toISOString(),results},null,2)+'\n');
console.log(results);
