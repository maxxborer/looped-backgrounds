import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { scenes } from './scenes.mjs';
const measurements=[];
for(const {name} of scenes) {
  const frames=[];
  for(const time of [0,3,6,9]) {
    const buffer=execFileSync(process.env.FFMPEG_PATH||'ffmpeg',[
      '-v','error','-ss',String(time),'-i','exports/'+name+'-hdr10.mp4',
      '-vf','zscale=t=linear:npl=100,format=gbrpf32le',
      '-frames:v','1','-f','rawvideo','-pix_fmt','gbrpf32le','pipe:1'
    ],{windowsHide:true,maxBuffer:64*1024*1024});
    const pixels=2560*1440,plane=pixels*4;let sum=0,peak=0;
    assert.equal(buffer.length,plane*3);
    for(let i=0;i<pixels;i++) {
      const luminance=100*(.2627*buffer.readFloatLE(plane+i*4)+.678*buffer.readFloatLE(i*4)+.0593*buffer.readFloatLE(plane*2+i*4));
      assert.ok(Number.isFinite(luminance));sum+=luminance;peak=Math.max(peak,luminance);
    }
    const average=sum/pixels;
    assert.ok(peak<650,'Unexpected HDR overshoot');assert.ok(average<200,'Frame average exceeds declared ceiling');
    frames.push({time,peakLuminanceNits:peak,averageLuminanceNits:average});
  }
  measurements.push({name,frames});console.log(name+': sampled HDR luminance verified');
}
await writeFile('exports/hdr-luminance.json',JSON.stringify({checkedAt:new Date().toISOString(),method:'Four decoded frames per scene; numeric luminance, not a physical display measurement or exhaustive MaxCLL scan.',measurements},null,2)+'\n');
