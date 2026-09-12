import { mkdir, writeFile } from 'node:fs/promises';
// sRGB procedural artwork -> separately graded HDR10 signal.
// Midtones near 203-nit diffuse white; highlight ceiling 600 nits.
export const mastering = 'G(8500,39850)B(6550,2300)R(35400,14600)WP(15635,16450)L(6000000,1)';
export function linear(x) { return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }
export function pq(nits) {
  const p = (Math.max(0, nits) / 10000) ** (2610 / 16384);
  return ((3424 / 4096 + 2413 / 128 * p) / (1 + 2392 / 128 * p)) ** (2523 / 32);
}
export function grade(r,g,b) {
  const l = [linear(r),linear(g),linear(b)];
  const brightness = 203 + 397 * Math.max(...l) ** 2;
  return [
    .627404*l[0]+.329283*l[1]+.043313*l[2],
    .069097*l[0]+.919541*l[1]+.011362*l[2],
    .016391*l[0]+.088013*l[1]+.895596*l[2]
  ].map(c=>pq(c*brightness));
}
export async function writeLut() {
  await mkdir('output', { recursive:true });
  const n=65, lines=['TITLE "Looped HDR 600 nit"','LUT_3D_SIZE '+n,'DOMAIN_MIN 0 0 0','DOMAIN_MAX 1 1 1'];
  for(let b=0;b<n;b++)for(let g=0;g<n;g++)for(let r=0;r<n;r++)lines.push(grade(r/(n-1),g/(n-1),b/(n-1)).map(v=>v.toFixed(9)).join(' '));
  await writeFile('output/hdr-grade.cube',lines.join('\n')+'\n');
}
