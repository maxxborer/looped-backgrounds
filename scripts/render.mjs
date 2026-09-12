import { mkdir, rename } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { getBrowser } from './browser.mjs';
import { scenes } from './scenes.mjs';
import { writeLut, mastering } from './color.mjs';
const args=process.argv.slice(2);
const preview=args.includes('--preview');
const chosen=args.find(x=>x.startsWith('--scene='))?.split('=')[1];
const frameCount=Number(args.find(x=>x.startsWith('--frames='))?.split('=')[1]||720);
if(!Number.isInteger(frameCount)||frameCount<1||frameCount>720)throw Error('Invalid frame count');
await mkdir('exports',{recursive:true});
if(!preview)await writeLut();
const browser=await getBrowser();
try{
  const page=await browser.newPage({viewport:{width:2560,height:1440},deviceScaleFactor:1});
  let pageError;page.on('pageerror',e=>{pageError=e;});
  for(const {name} of scenes.filter(s=>!chosen||s.name===chosen)){
    await page.goto(pathToFileURL(path.resolve('backgrounds/'+name+'.html')).href+'?render');
    await page.waitForFunction(()=>window.background);
    await page.evaluate(()=>window.background.render(3));
    await page.screenshot({path:'exports/'+name+'.jpg',type:'jpeg',quality:95});
    if(preview){console.log('Preview '+name);continue;}
    const stem=frameCount===720?'exports/'+name:'output/'+name+'-sample';
    const sdr=stem+'.partial.mp4',hdr=stem+'-hdr10.partial.mp4';
    const filter='[0:v]split=2[s][h];'+
      '[s]format=gbrp,zscale=rin=full:r=full,format=gbrpf32le,zscale=pin=bt709:tin=iec61966-2-1:min=gbr:rin=full:p=bt709:t=bt709:m=bt709:r=limited:dither=error_diffusion,format=yuv420p[sdr];'+
      '[h]format=gbrp,zscale=rin=full:r=full,format=gbrpf32le,lut3d=file=output/hdr-grade.cube:interp=tetrahedral,zscale=pin=bt2020:tin=smpte2084:min=gbr:rin=full:p=bt2020:t=smpte2084:m=bt2020nc:r=limited:dither=error_diffusion,format=yuv420p10le[hdr]';
    const encoder=spawn(process.env.FFMPEG_PATH||'ffmpeg',[
      '-y','-hide_banner','-loglevel','error','-filter_complex_threads','4',
      '-f','image2pipe','-vcodec','png','-framerate','60','-i','pipe:0','-filter_complex',filter,
      '-map','[sdr]','-an','-c:v','libx264','-preset','medium','-crf','16','-threads','6',
      '-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709',
      '-color_range','tv','-r','60','-frames:v',String(frameCount),'-movflags','+faststart',sdr,
      '-map','[hdr]','-an','-c:v','libx265','-preset','fast','-crf','18',
      '-pix_fmt','yuv420p10le','-profile:v','main10','-tag:v','hvc1',
      '-x265-params','pools=6:frame-threads=3:log-level=error:hdr10=1:hdr10-opt=1:repeat-headers=1:colorprim=bt2020:transfer=smpte2084:colormatrix=bt2020nc:range=limited:master-display='+mastering+':max-cll=600,200',
      '-color_primaries','bt2020','-color_trc','smpte2084','-colorspace','bt2020nc','-color_range','tv',
      '-r','60','-frames:v',String(frameCount),'-movflags','+faststart',hdr
    ],{windowsHide:true,stdio:['pipe','ignore','pipe']});
    let stderr='';encoder.stderr.on('data',c=>{stderr+=c;});
    let stopped=false;
    const finished=once(encoder,'close').then(([code])=>{stopped=true;return code;});
    finished.catch(()=>{});
    encoder.stdin.on('error',()=>{});
    try {
      for(let frame=0;frame<frameCount;frame++){
        if(pageError)throw pageError;
        if(stopped)throw Error('Encoder stopped: '+stderr);
        const data=await page.evaluate(frame=>{
          window.background.render(frame/60);
          return document.querySelector('canvas').toDataURL('image/png').split(',')[1];
        },frame);
        if(!encoder.stdin.write(Buffer.from(data,'base64'))){
          await Promise.race([once(encoder.stdin,'drain'),finished.then(()=>{throw Error('Encoder stopped: '+stderr);})]);
        }
        if(frame%120===0)console.log(name+': '+frame+'/'+frameCount+' (SDR + HDR10)');
      }
      encoder.stdin.end();
      const code=await finished;
      if(code!==0)throw Error('FFmpeg failed: '+stderr);
      await rename(sdr,stem+'.mp4');await rename(hdr,stem+'-hdr10.mp4');
      console.log(name+': both exports complete');
    }catch(error){encoder.kill();throw error;}
  }
}finally{await browser.close();}
