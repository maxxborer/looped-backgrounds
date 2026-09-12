/* Deterministic 12-second motion; no external assets. */
(() => {
  'use strict';
  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const scene = document.body.dataset.scene;
  const W = 2560, H = 1440, TAU = Math.PI * 2, duration = 12;
  const manual = new URLSearchParams(location.search).has('render');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mod = (x, n) => (x % n + n) % n;
  let seed = {ultraviolet: 5307, starfall: 8712, hearts: 2941, nacre: 5197, orrery: 7136}[scene];
  function random() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  const palettes = {
    ultraviolet: ['#ba69ed','#e877d3','#996aea','#d88ef0','#a475f4'],
    starfall: ['#5ca6ed','#76c3eb','#7d93e7','#8daeee','#648ed7'],
    hearts: ['#ec77a8','#df6fb1','#d18be0','#ed829d','#ce76bc'],
    nacre: ['#397b83','#62a9aa','#d9d8bd','#b77c67','#426b7e'],
    orrery: ['#d49a56','#f5dca2','#797e70','#a57549','#507a7b']
  };
  const palette = palettes[scene];
  const particleScene = ['ultraviolet','starfall','hearts'].includes(scene);
  function shape(c, heart, r) {
    c.beginPath();
    if (heart) {
      c.moveTo(0,r*.85);
      c.bezierCurveTo(-r*.24,r*.64,-r*.91,r*.17,-r*.91,-r*.28);
      c.bezierCurveTo(-r*.91,-r*.9,-r*.23,-r*1.02,0,-r*.48);
      c.bezierCurveTo(r*.23,-r*1.02,r*.91,-r*.9,r*.91,-r*.28);
      c.bezierCurveTo(r*.91,r*.17,r*.24,r*.64,0,r*.85);
    } else {
      for (let i=0;i<10;i++) {
        const a=-Math.PI/2+i*Math.PI/5, radius=(i%2?.47:1)*r;
        if (!i) c.moveTo(Math.cos(a)*radius,Math.sin(a)*radius);
        else c.lineTo(Math.cos(a)*radius,Math.sin(a)*radius);
      }
    }
    c.closePath();
  }
  function makeSprite(p) {
    const s=document.createElement('canvas'); s.width=s.height=512;
    const c=s.getContext('2d'); c.translate(256,256);
    const radius=128, unit=radius/p.radius;
    c.lineJoin='round'; c.lineCap='round';
    shape(c,scene==='hearts',radius);
    c.strokeStyle=p.color; c.fillStyle=p.color;
    c.lineWidth=(p.filled?1.2:2.8)*unit;
    // A broad halo and a continuous, separately drawn core; no dot mask.
    c.shadowColor=p.color; c.shadowBlur=9*unit;
    if(p.filled) { c.globalAlpha=.84; c.fill(); } else c.stroke();
    c.shadowBlur=3.2*unit; c.globalAlpha=.92;
    if(p.filled) c.fill(); else c.stroke();
    c.shadowBlur=0;
    if(!p.filled) { c.strokeStyle=p.color; c.lineWidth=2.15*unit; c.stroke(); }
    return s;
  }
  const particles=[];
  if(particleScene) {
    const count={ultraviolet:100,starfall:94,hearts:75}[scene];
    // Conservative toroidal packing reserves room for every rotation and wobble.
    // Common vertical translation preserves separation over the entire loop.
    for(let i=0;i<count;i++) {
      const radius=scene==='hearts'?19+random()**1.5*39:14+random()**1.6*38;
      const p={radius, bound:radius*1.09+12, color:palette[i%palette.length],
        phase:random()*TAU, angle:(random()-.5)*.6, filled:scene==='ultraviolet'&&i%3===0};
      let placed=false;
      for(let attempt=0;attempt<20000;attempt++) {
        p.x=random()*W; p.y=random()*H;
        if(particles.every(q=>{
          const dx=Math.min(Math.abs(p.x-q.x),W-Math.abs(p.x-q.x));
          const dy=Math.min(Math.abs(p.y-q.y),H-Math.abs(p.y-q.y));
          return Math.hypot(dx,dy)>p.bound+q.bound+20;
        })) {placed=true;break;}
      }
      if(!placed) throw new Error('Unable to place all particles with safe spacing');
      p.sprite=makeSprite(p); particles.push(p);
    }
  }
  const dust=Array.from({length:scene==='ultraviolet'?330:scene==='nacre'?0:90},()=>({
    x:random()*W,y:random()*H,r:.7+random()*1.15,phase:random()*TAU,color:palette[Math.floor(random()*5)]
  }));
  const ambient=document.createElement('canvas'); ambient.width=W; ambient.height=H;
  const ac=ambient.getContext('2d');
  const base={ultraviolet:'#080512',starfall:'#030811',hearts:'#0b050d',nacre:'#071d25',orrery:'#06181c'}[scene];
  ac.fillStyle=base; ac.fillRect(0,0,W,H);
  for(let i=0;i<4;i++){
    const x=random()*W,y=random()*H;
    const g=ac.createRadialGradient(x,y,0,x,y,1000);
    g.addColorStop(0,palette[i]+(particleScene?'0b':'15'));g.addColorStop(1,palette[i]+'00');
    ac.fillStyle=g;ac.fillRect(0,0,W,H);
  }
  function positions(seconds) {
    const t=mod(seconds,duration)/duration,a=t*TAU;
    return particles.map(p=>({
      x:mod(p.x+6*Math.sin(a+p.phase),W),
      y:mod(p.y+(scene==='ultraviolet'?0:(scene==='hearts'?-1:1)*H*t)+6*Math.cos(a+p.phase),H),
      radius:p.radius*(1+.025*Math.sin(a+p.phase)),
      angle:p.angle+.13*Math.sin(a+p.phase),p
    }));
  }
  function drawParticles(seconds,a) {
    for(const o of positions(seconds)){
      const size=o.radius*4, p=o.p;
      ctx.globalAlpha=.78+.16*(.5+.5*Math.sin(a+p.phase));
      for(const dx of [-W,0,W]) for(const dy of [-H,0,H]){
        const x=o.x+dx,y=o.y+dy;
        if(x+size/2<0||x-size/2>W||y+size/2<0||y-size/2>H)continue;
        ctx.save();ctx.translate(x,y);ctx.rotate(o.angle);
        ctx.drawImage(p.sprite,-size/2,-size/2,size,size);ctx.restore();
      }
    }
    ctx.globalAlpha=1;
  }
  function ribbonPoint(u,v,k,a) {
    const x=-200+(W+400)*u;
    const envelope=Math.sin(u*Math.PI);
    const y=H*.5+(k-2)*255-.34*(x-W*.5)
      +126*Math.sin(u*TAU*.9+a*.0+Math.sin(a)*.35+k*.21)
      +65*Math.sin(u*TAU*1.7-a+k*.3)*envelope
      +v*(57+28*Math.sin(u*TAU+a+k*.35));
    return [x,y];
  }
  function nacre(a) {
    for(let k=0;k<5;k++){
      // Closely spaced continuous filaments form a softly folded silk surface.
      const grad=ctx.createLinearGradient(0,0,W,H);
      grad.addColorStop(0,'#386d7a');grad.addColorStop(.28,'#70ada8');
      grad.addColorStop(.52,'#e3d8b9');grad.addColorStop(.72,'#bb8276');grad.addColorStop(1,'#396e7c');
      for(let line=0;line<62;line++){
        const v=-1+2*line/61;
        const highlight=Math.pow(.5+.5*Math.cos(v*2.1+Math.sin(a+k*.45)*.65),5);
        ctx.globalAlpha=.11+.63*highlight;
        ctx.strokeStyle=grad;ctx.lineWidth=2.65;
        ctx.beginPath();
        for(let step=0;step<=108;step++){
          const point=ribbonPoint(step/108,v,k,a);
          if(step===0)ctx.moveTo(...point);else ctx.lineTo(...point);
        }ctx.stroke();
      }
      ctx.globalAlpha=.58;ctx.strokeStyle='#d6e4d0';ctx.lineWidth=1.15;
      ctx.beginPath();
      for(let step=0;step<=108;step++){
        const point=ribbonPoint(step/108,-.16,k,a);
        if(step===0)ctx.moveTo(...point);else ctx.lineTo(...point);
      }ctx.stroke();
    }
    ctx.globalAlpha=1;
  }
  const sculptures=[
    {x:W*.22,y:H*.43,r:254,phase:.3},
    {x:W*.57,y:H*.69,r:208,phase:2.1},
    {x:W*.81,y:H*.29,r:176,phase:4.3}
  ];
  function orbitPoint(theta,ring,obj,a){
    const r=obj.r*(.78+ring*.09),p=obj.phase;
    let x=r*Math.cos(theta),y=r*Math.sin(theta),z=0;
    const tilt=.42+ring*.57+.18*Math.sin(a+p);
    z=y*Math.sin(tilt);y*=Math.cos(tilt);
    const turn=ring*.83+p+.25*Math.sin(a+p);
    const xx=x*Math.cos(turn)-y*Math.sin(turn);y=x*Math.sin(turn)+y*Math.cos(turn);x=xx;
    return [obj.x+x,obj.y+y,z];
  }
  function orrery(a) {
    for(const obj of sculptures) {
      const glow=ctx.createRadialGradient(obj.x,obj.y,0,obj.x,obj.y,obj.r*1.5);
      glow.addColorStop(0,'#c8975110');glow.addColorStop(1,'#c8975100');
      ctx.fillStyle=glow;ctx.fillRect(obj.x-obj.r*2,obj.y-obj.r*2,obj.r*4,obj.r*4);
      const segments=[];
      for(let ring=0;ring<3;ring++){
        for(let i=0;i<144;i++){
          const p=orbitPoint(i/144*TAU,ring,obj,a),q=orbitPoint((i+1)/144*TAU,ring,obj,a);
          segments.push({p,q,z:(p[2]+q[2])/2,ring});
        }
      }
      segments.sort((s,t)=>s.z-t.z);
      ctx.lineCap='round';
      for(const s of segments) {
        const light=.35+.65*(s.z/obj.r+1)/2;
        ctx.strokeStyle='rgb('+Math.round(219*light)+' '+Math.round(172*light)+' '+Math.round(106*light)+')';
        ctx.lineWidth=3.6;ctx.beginPath();ctx.moveTo(s.p[0],s.p[1]);ctx.lineTo(s.q[0],s.q[1]);ctx.stroke();
      }
      for(let ring=0;ring<3;ring++){
        const p=orbitPoint(a+ring*2.1+obj.phase,ring,obj,a),radius=6.5+ring*1.7;
        const g=ctx.createRadialGradient(p[0]-radius*.3,p[1]-radius*.4,0,p[0],p[1],radius);
        g.addColorStop(0,'#fff2cb');g.addColorStop(.4,'#e4b977');g.addColorStop(1,'#78532f');
        ctx.shadowColor='#eabf7a';ctx.shadowBlur=15;ctx.fillStyle=g;ctx.beginPath();ctx.arc(p[0],p[1],radius,0,TAU);ctx.fill();ctx.shadowBlur=0;
      }
      const core=ctx.createRadialGradient(obj.x-7,obj.y-9,0,obj.x,obj.y,21);
      core.addColorStop(0,'#a1b1a5');core.addColorStop(.35,'#577e7f');core.addColorStop(1,'#142f35');
      ctx.fillStyle=core;ctx.beginPath();ctx.arc(obj.x,obj.y,21,0,TAU);ctx.fill();
    }
  }
  function render(seconds=0){
    const a=mod(seconds,duration)/duration*TAU;
    // Preserve shape proportions on phones and ultrawide screens; crop centrally.
    const scale=Math.max(canvas.width/W,canvas.height/H);
    ctx.setTransform(scale,0,0,scale,(canvas.width-W*scale)/2,(canvas.height-H*scale)/2);
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.drawImage(ambient,0,0);
    for(const d of dust){
      ctx.globalAlpha=.12+.28*(.5+.5*Math.sin(a+d.phase));ctx.fillStyle=d.color;
      ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,TAU);ctx.fill();
    }
    ctx.globalAlpha=1;
    if(particleScene)drawParticles(seconds,a);
    else if(scene==='nacre')nacre(a);
    else orrery(a);
  }
  function resize(){
    const dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);render(0);
  }
  addEventListener('resize',resize);resize();
  window.background={render,duration,scene,width:W,height:H,
    geometry:seconds=>positions(seconds).map(o=>({x:o.x,y:o.y,radius:o.radius})),
    particleCount:particles.length};
  const start=performance.now();
  function animate(now){if(!manual){render(reduced.matches?0:(now-start)/1000);requestAnimationFrame(animate);}}
  if(!manual)requestAnimationFrame(animate);
})();
