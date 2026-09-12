import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { getBrowser } from './browser.mjs';
import { scenes } from './scenes.mjs';
const sourceOnly=process.argv.includes('--source-only');
const report={checkedAt:new Date().toISOString(),scenes:[]};
const browser=await getBrowser();
const probeArgs=['-v','error','-of','json'];
function probe(file,args){return JSON.parse(execFileSync(process.env.FFPROBE_PATH||'ffprobe',[...probeArgs,...args,file],{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024}));}
try{
 const page=await browser.newPage({viewport:{width:2560,height:1440},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await mkdir('output/review',{recursive:true});
 for(const {name} of scenes){
  await page.goto(pathToFileURL(path.resolve('backgrounds/'+name+'.html')).href+'?render');
  const metrics=await page.evaluate(()=>{
   const c=document.querySelector('canvas'),ctx=c.getContext('2d');
   const pixels=t=>{window.background.render(t);return ctx.getImageData(0,0,c.width,c.height).data;};
   const diff=(a,b)=>{let sum=0,max=0;for(let i=0;i<a.length;i+=4)for(let ch=0;ch<3;ch++){const d=Math.abs(a[i+ch]-b[i+ch]);sum+=d;max=Math.max(max,d);}return {mean:sum/(a.length/4*3),max};};
   const zero=pixels(0),end=pixels(12),last=pixels(12-1/60),next=pixels(1/60),middle=pixels(6);
   let minGap=Infinity;
   for(let frame=0;frame<720;frame++){
    const ps=window.background.geometry(frame/60);
    for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){
     let dx=Math.abs(ps[i].x-ps[j].x),dy=Math.abs(ps[i].y-ps[j].y);
     dx=Math.min(dx,2560-dx);dy=Math.min(dy,1440-dy);
     const gap=Math.hypot(dx,dy)-ps[i].radius*1.09-ps[j].radius*1.09;
     minGap=Math.min(minGap,gap);
    }
   }
   return {width:c.width,height:c.height,duration:window.background.duration,loop:diff(zero,end),seamStep:diff(last,zero),normalStep:diff(zero,next),motion:diff(zero,middle),particles:window.background.particleCount,minGap:Number.isFinite(minGap)?minGap:null,geometryFrames:720};
  });
  assert.equal(metrics.width,2560);assert.equal(metrics.height,1440);assert.equal(metrics.duration,12);
  assert.equal(metrics.loop.max,0,name+': loop endpoints differ');
  assert.ok(metrics.motion.mean>.01,name+': static animation');
  assert.ok(metrics.seamStep.mean<metrics.normalStep.mean*1.4+.02,name+': seam discontinuity');
  if(metrics.particles)assert.ok(metrics.minGap>=20,name+': overlapping silhouettes');
  for(const seconds of [0,3,6,9,11.983333333333333]){
   await page.evaluate(t=>window.background.render(t),seconds);
   await page.screenshot({path:'output/review/'+name+'-'+Math.round(seconds*60)+'.jpg',type:'jpeg',quality:90});
  }
  if(!sourceOnly){
   metrics.videos=[];
   for(const hdr of [false,true]){
    const file='exports/'+name+(hdr?'-hdr10':'')+'.mp4';
    const data=probe(file,['-count_frames','-show_streams','-show_format']);
    assert.equal(data.streams.length,1);
    const s=data.streams[0];
    assert.equal(s.width,2560);assert.equal(s.height,1440);assert.equal(s.avg_frame_rate,'60/1');
    assert.equal(Number(s.nb_read_frames),720);assert.equal(Number(s.duration),12);
    assert.equal(s.pix_fmt,hdr?'yuv420p10le':'yuv420p');assert.equal(s.codec_name,hdr?'hevc':'h264');
    assert.equal(s.color_transfer,hdr?'smpte2084':'bt709');assert.equal(s.color_primaries,hdr?'bt2020':'bt709');
    assert.equal(s.color_space,hdr?'bt2020nc':'bt709');assert.equal(s.color_range,'tv');
    let metadata;
    if(hdr){
     assert.equal(s.profile,'Main 10');assert.equal(s.codec_tag_string,'hvc1');
     const first=probe(file,['-select_streams','v:0','-read_intervals','%+#1','-show_frames']);
     const side=first.frames[0].side_data_list;
     const mastering=side.find(x=>x.side_data_type==='Mastering display metadata');
     const light=side.find(x=>x.side_data_type==='Content light level metadata');
     assert.ok(mastering);assert.ok(light);assert.equal(mastering.max_luminance,'6000000/10000');
     assert.equal(light.max_content,600);assert.equal(light.max_average,200);
     metadata={mastering,light};
    }
    metrics.videos.push({file,codec:s.codec_name,profile:s.profile,pixelFormat:s.pix_fmt,fps:s.avg_frame_rate,frames:Number(s.nb_read_frames),duration:Number(s.duration),primaries:s.color_primaries,transfer:s.color_transfer,bytes:Number(data.format.size),...(metadata?{metadata}:{})});
   }
  }
  report.scenes.push({name,...metrics});console.log(name+': PASS, gap='+metrics.minGap+', loop='+metrics.loop.max+(sourceOnly?'':', SDR + HDR10 verified'));
 }
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 assert.equal(await page.locator('article').count(),5);
 assert.equal(await page.locator('img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)),true);
 await page.setViewportSize({width:1440,height:1040});
 await page.screenshot({path:'output/review/gallery-desktop.jpg',type:'jpeg',quality:90,fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'output/review/gallery-mobile.jpg',type:'jpeg',quality:90,fullPage:true});
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const {name} of scenes){
  await page.goto(pathToFileURL(path.resolve('backgrounds/'+name+'.html')).href);
  const a=await page.screenshot();await page.waitForTimeout(100);const b=await page.screenshot();
  assert.ok(a.equals(b),name+': reduced motion failed');
 }
 assert.deepEqual(errors,[]);
 if(!sourceOnly){
  await page.goto(pathToFileURL(path.resolve('player.html')).href+'?scene=04-nacre');
  await page.waitForFunction(()=>document.querySelector('video').readyState>=1);
  assert.equal(await page.locator('#title').textContent(),'Nacre');
  assert.equal(await page.locator('video').evaluate(v=>v.duration),12);
  await page.locator('video').evaluate(v=>v.play());
  await page.waitForFunction(()=>document.querySelector('video').currentTime>.05);
  await page.locator('video').evaluate(v=>v.pause());
  await page.locator('[data-mode="hdr"]').click();
  // Exercise the explicit fallback path even on a browser with HEVC support.
  await page.locator('video').evaluate(v=>v.dispatchEvent(new Event('error')));
  assert.ok((await page.locator('video').getAttribute('src')).endsWith('04-nacre.mp4'));
  assert.equal(await page.locator('[data-mode="sdr"]').getAttribute('aria-pressed'),'true');
  assert.deepEqual(errors,[]);
 }
 report.browser={errors,mobileOverflow:false,galleryImages:'pass',reducedMotion:'all five pass',...(sourceOnly?{}:{sdrPlayback:'pass',hdrErrorFallback:'pass'})};
 await writeFile('exports/'+(sourceOnly?'source-verification':'verification')+'.json',JSON.stringify(report,null,2)+'\n');
}finally{await browser.close();}
