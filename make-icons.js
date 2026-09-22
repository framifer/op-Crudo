// Pure-Node PNG icon generator for op-Crudo (no external deps).
const fs = require('fs');
const zlib = require('zlib');

function crc32(buf){
  let c, table = crc32._t;
  if(!table){ table=[]; for(let n=0;n<256;n++){ c=n; for(let k=0;k<8;k++) c = c&1 ? 0xEDB88320 ^ (c>>>1) : c>>>1; table[n]=c>>>0; } crc32._t=table; }
  let crc = 0xFFFFFFFF;
  for(let i=0;i<buf.length;i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc>>>8);
  return (crc ^ 0xFFFFFFFF)>>>0;
}
function chunk(type, data){
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length,0);
  const t = Buffer.from(type,'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t,data])),0);
  return Buffer.concat([len,t,data,crc]);
}
function encodePNG(w,h,rgba){
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4);
  ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0; // 8-bit RGBA
  // filtered raw: each row prefixed with filter byte 0
  const raw = Buffer.alloc((w*4+1)*h);
  for(let y=0;y<h;y++){
    raw[y*(w*4+1)] = 0;
    rgba.copy(raw, y*(w*4+1)+1, y*w*4, y*w*4 + w*4);
  }
  const idat = zlib.deflateSync(raw, {level:9});
  return Buffer.concat([sig, chunk('IHDR',ihdr), chunk('IDAT',idat), chunk('IEND',Buffer.alloc(0))]);
}

function render(size, maskable){
  const w=size, h=size;
  const buf = Buffer.alloc(w*h*4);
  const cx=w/2, cy=h/2;
  const pad = maskable ? size*0.14 : size*0.06;      // maskable needs safe padding
  const r = size*0.18;                                // corner radius of the tile
  const x0=pad, y0=pad, x1=w-pad, y1=h-pad;
  function set(x,y,rr,gg,bb,aa){
    if(x<0||y<0||x>=w||y>=h) return;
    const i=(y*w+x)*4; buf[i]=rr; buf[i+1]=gg; buf[i+2]=bb; buf[i+3]=aa;
  }
  function inRounded(x,y){
    if(x<x0||x>x1||y<y0||y>y1) return false;
    // corners
    const corners=[[x0+r,y0+r],[x1-r,y0+r],[x0+r,y1-r],[x1-r,y1-r]];
    if(x<x0+r&&y<y0+r) return Math.hypot(x-corners[0][0],y-corners[0][1])<=r;
    if(x>x1-r&&y<y0+r) return Math.hypot(x-corners[1][0],y-corners[1][1])<=r;
    if(x<x0+r&&y>y1-r) return Math.hypot(x-corners[2][0],y-corners[2][1])<=r;
    if(x>x1-r&&y>y1-r) return Math.hypot(x-corners[3][0],y-corners[3][1])<=r;
    return true;
  }
  // background transparent; tile light aluminium with subtle vertical gradient
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      if(inRounded(x,y)){
        const t=(y-y0)/(y1-y0);
        const base=216 - t*20; // #d8 -> darker
        set(x,y, base, base-3, base-9, 255);
      }
    }
  }
  // top dark screen strip
  const sx0=x0+size*0.10, sx1=x1-size*0.10, sy0=y0+size*0.12, sy1=y0+size*0.36;
  for(let y=Math.floor(sy0);y<sy1;y++) for(let x=Math.floor(sx0);x<sx1;x++){ if(inRounded(x,y)) set(x,y,12,18,24,255); }
  // 4 colored encoder dots row (blue, green, white, orange)
  const colors=[[47,109,240],[55,194,107],[244,241,234],[240,130,30]];
  const dotY=y0+size*0.56, dotR=size*0.075;
  for(let k=0;k<4;k++){
    const dotX=x0 + (size-2*pad)*( (k+0.5)/4 );
    for(let y=Math.floor(dotY-dotR);y<=dotY+dotR;y++) for(let x=Math.floor(dotX-dotR);x<=dotX+dotR;x++){
      if(Math.hypot(x-dotX,y-dotY)<=dotR){ const c=colors[k]; set(x,y,c[0],c[1],c[2],255); }
    }
  }
  // bottom black keyboard hint bar
  const ky0=y0+size*0.72, ky1=y1-size*0.06;
  for(let y=Math.floor(ky0);y<ky1;y++) for(let x=Math.floor(sx0);x<sx1;x++){ if(inRounded(x,y)) set(x,y,30,30,34,255); }
  return encodePNG(w,h,buf);
}

fs.writeFileSync('icon-192.png', render(192,false));
fs.writeFileSync('icon-512.png', render(512,false));
fs.writeFileSync('icon-512-maskable.png', render(512,true));
console.log('icons written: icon-192.png, icon-512.png, icon-512-maskable.png');
