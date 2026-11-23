import * as THREE from 'three';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}

function valueNoise2D(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm2D(x: number, y: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2D(x * freq, y * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return sum;
}

function periodicValueNoise2D(x: number, y: number, period: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y0 = ((yi % period) + period) % period;
  const y1 = (y0 + 1) % period;
  const a = hash2(x0, y0);
  const b = hash2(x1, y0);
  const c = hash2(x0, y1);
  const d = hash2(x1, y1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function periodicFbm2D(x: number, y: number, basePeriod: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * periodicValueNoise2D(x * freq, y * freq, basePeriod * freq);
    freq *= 2;
    amp *= 0.5;
  }
  return sum;
}

/**
 * Converts a periodic scalar heightfield [0..1] into an OpenGL tangent-space Normal Map CanvasTexture.
 */
function heightFieldToNormalTexture(
  height: Float32Array,
  size: number,
  strength: number,
  repeatX: number,
  repeatY: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;

      const hL = height[y * size + xm];
      const hR = height[y * size + xp];
      // Canvas Y grows downward while CanvasTexture flipY=true maps +v upward (toward ym)
      const hAbove = height[ym * size + x];
      const hBelow = height[yp * size + x];

      const dx = (hR - hL) * strength;
      const dy = (hAbove - hBelow) * strength;

      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      const idx = (y * size + x) * 4;
      img.data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      img.data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      img.data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  return tex;
}

let cachedAtelierTextures: ReturnType<typeof generateAllAtelierTextures> | null = null;

function generateAllAtelierTextures() {
  // 1. HERRINGBONE FRENCH OAK PARQUET (鱼骨拼橡木地板: Color + Bump + Tangent Normal + Roughness)
  const oakSize = 512;
  const oakColCanvas = document.createElement('canvas');
  oakColCanvas.width = oakSize;
  oakColCanvas.height = oakSize;
  const oakColCtx = oakColCanvas.getContext('2d')!;

  const oakBumpCanvas = document.createElement('canvas');
  oakBumpCanvas.width = oakSize;
  oakBumpCanvas.height = oakSize;
  const oakBumpCtx = oakBumpCanvas.getContext('2d')!;

  const oakRoughCanvas = document.createElement('canvas');
  oakRoughCanvas.width = oakSize;
  oakRoughCanvas.height = oakSize;
  const oakRoughCtx = oakRoughCanvas.getContext('2d')!;

  const oakImg = oakColCtx.createImageData(oakSize, oakSize);
  const oakBumpImg = oakBumpCtx.createImageData(oakSize, oakSize);
  const oakRoughImg = oakRoughCtx.createImageData(oakSize, oakSize);
  const oakHeightField = new Float32Array(oakSize * oakSize);

  const invSqrt2 = Math.SQRT1_2;
  // Exact diagonal pitch so the 45-degree herringbone parquet tiles seamlessly at oakSize=512!
  const plankW = (oakSize * invSqrt2) / 12;
  const plankL = plankW * 4;

  for (let py = 0; py < oakSize; py++) {
    for (let px = 0; px < oakSize; px++) {
      const u = (px + py) * invSqrt2;
      const v = (py - px + oakSize * 2) * invSqrt2;

      const stepIndex = Math.floor(u / plankW) + Math.floor(v / plankW);
      const isHorizontal = (((stepIndex % 2) + 2) % 2) === 0;

      let wrappedIdX: number;
      let wrappedIdY: number;
      let localAcross: number;
      let localAlong: number;

      if (isHorizontal) {
        const plankIdY = Math.floor(v / plankW);
        const shiftedU = u - plankIdY * plankW;
        const plankIdX = Math.floor(shiftedU / plankL);
        wrappedIdX = ((plankIdX % 6) + 6) % 6;
        wrappedIdY = ((plankIdY % 12) + 12) % 12;
        localAcross = ((v % plankW) + plankW) % plankW;
        localAlong = ((shiftedU % plankL) + plankL) % plankL;
      } else {
        const plankIdX = Math.floor(u / plankW);
        const shiftedV = v - plankIdX * plankW;
        const plankIdY = Math.floor(shiftedV / plankL);
        wrappedIdX = ((plankIdX % 12) + 12) % 12;
        wrappedIdY = ((plankIdY % 6) + 6) % 6;
        localAcross = ((u % plankW) + plankW) % plankW;
        localAlong = ((shiftedV % plankL) + plankL) % plankL;
      }

      const seed = hash2(wrappedIdX * 13.7 + (isHorizontal ? 0 : 71), wrappedIdY * 29.3);
      const grain = fbm2D(localAlong * 0.14 + seed * 20, localAcross * 1.15 + seed * 10, 3);
      const microFiber = fbm2D(localAlong * 0.42 + seed * 13, localAcross * 2.8 + seed * 7, 2);
      const poreLine = Math.sin(localAcross * 4.4 + grain * 8.5) * 0.5 + 0.5;
      const fineVessel = Math.pow(Math.max(0, Math.sin(localAcross * 7.8 + microFiber * 5.2)), 4.0);
      const catheterPore = Math.max(Math.pow(poreLine, 3.0), fineVessel * 0.85);

      // Deep V-bevel groove at plank joints
      const edgeDist = Math.min(
        localAcross,
        plankW - localAcross,
        localAlong,
        plankL - localAlong
      );
      const bevel = edgeDist < 1.55 ? Math.pow(edgeDist / 1.55, 0.78) : 1.0;

      // Rich Parisian honey-walnut oak tone with crisp close-up pore & fiber contrast
      const tone = 0.86 + (seed - 0.5) * 0.20 + (grain - 0.5) * 0.19 - catheterPore * 0.11;
      const seamAO = 0.68 + 0.32 * bevel;
      const r = Math.min(255, Math.max(0, Math.round(202 * tone * seamAO)));
      const g = Math.min(255, Math.max(0, Math.round(158 * tone * seamAO)));
      const b = Math.min(255, Math.max(0, Math.round(108 * tone * seamAO)));

      const pIdx = py * oakSize + px;
      const idx = pIdx * 4;
      oakImg.data[idx] = r;
      oakImg.data[idx + 1] = g;
      oakImg.data[idx + 2] = b;
      oakImg.data[idx + 3] = 255;

      // Micro height: bevel seam + subtle plank warp + crisp open-grain wood pores
      const plankWarp = (seed - 0.5) * 0.08;
      const h = bevel * (0.82 + plankWarp + grain * 0.16 - catheterPore * 0.09);
      oakHeightField[pIdx] = h;

      const bumpVal = Math.max(0, Math.min(255, Math.round(h * 255)));
      oakBumpImg.data[idx] = bumpVal;
      oakBumpImg.data[idx + 1] = bumpVal;
      oakBumpImg.data[idx + 2] = bumpVal;
      oakBumpImg.data[idx + 3] = 255;

      // Gentle hand-rubbed Studio Ghibli satin-matte wood roughness (zero harsh epoxy shine)
      const roughVal = Math.min(
        255,
        Math.round((0.56 + (1 - bevel) * 0.28 + catheterPore * 0.08 + (seed - 0.5) * 0.05) * 255)
      );
      oakRoughImg.data[idx] = roughVal;
      oakRoughImg.data[idx + 1] = roughVal;
      oakRoughImg.data[idx + 2] = roughVal;
      oakRoughImg.data[idx + 3] = 255;
    }
  }
  oakColCtx.putImageData(oakImg, 0, 0);
  oakBumpCtx.putImageData(oakBumpImg, 0, 0);
  oakRoughCtx.putImageData(oakRoughImg, 0, 0);

  const oakColorMap = new THREE.CanvasTexture(oakColCanvas);
  oakColorMap.colorSpace = THREE.SRGBColorSpace;
  oakColorMap.wrapS = oakColorMap.wrapT = THREE.RepeatWrapping;
  oakColorMap.repeat.set(5.5, 5.5);
  oakColorMap.anisotropy = 16;

  const oakBumpMap = new THREE.CanvasTexture(oakBumpCanvas);
  oakBumpMap.wrapS = oakBumpMap.wrapT = THREE.RepeatWrapping;
  oakBumpMap.repeat.set(5.5, 5.5);
  oakBumpMap.anisotropy = 16;

  const oakNormalMap = heightFieldToNormalTexture(oakHeightField, oakSize, 4.2, 5.5, 5.5);
  oakNormalMap.anisotropy = 16;

  const oakRoughnessMap = new THREE.CanvasTexture(oakRoughCanvas);
  oakRoughnessMap.wrapS = oakRoughnessMap.wrapT = THREE.RepeatWrapping;
  oakRoughnessMap.repeat.set(5.5, 5.5);
  oakRoughnessMap.anisotropy = 16;

  // 2. CARRARA & CALACATTA GOLD MARBLE (细腻天然灰金丝脉络 + 专用 Normal / Roughness)
  const mSize = 512;
  const mColCanvas = document.createElement('canvas');
  mColCanvas.width = mSize;
  mColCanvas.height = mSize;
  const mCtx = mColCanvas.getContext('2d')!;
  const mImg = mCtx.createImageData(mSize, mSize);

  const mRoughCanvas = document.createElement('canvas');
  mRoughCanvas.width = mSize;
  mRoughCanvas.height = mSize;
  const mrCtx = mRoughCanvas.getContext('2d')!;
  const mrImg = mrCtx.createImageData(mSize, mSize);
  const marbleHeightField = new Float32Array(mSize * mSize);

  for (let y = 0; y < mSize; y++) {
    for (let x = 0; x < mSize; x++) {
      // Truly periodic [0..2] mineral domain so island slab, tempering slab & tasting table tile seamlessly
      const nx = (x / mSize) * 2.0;
      const ny = (y / mSize) * 2.0;
      const warpX = periodicFbm2D(nx + 0.7, ny + 0.4, 2, 4) * 1.15;
      const warpY = periodicFbm2D(nx + 1.3, ny + 0.9, 2, 4) * 1.15;
      const fineWarp = periodicFbm2D(nx * 2.0 + 0.3, ny * 2.0 + 1.1, 4, 3) * 0.42;

      // Primary soft smoky dove-grey mineral vein
      const veinWave = Math.abs(Math.sin((nx * 1.0 + ny * 1.0 + warpX) * Math.PI * 2.0));
      const primaryVein = Math.pow(Math.max(0, 1 - veinWave), 8.5);

      // Hairline warm champagne-gold Calacatta silk veins
      const goldWave = Math.abs(Math.sin((nx * 2.0 - ny * 1.0 + warpY * 1.2 + fineWarp) * Math.PI * 2.0));
      const fineGoldVein = Math.pow(Math.max(0, 1 - goldWave), 16.0);

      // Ultra-fine secondary feathering
      const featherWave = Math.abs(Math.cos((nx * 3.0 + ny * 2.0 - warpX * 0.85) * Math.PI * 2.0));
      const featherVein = Math.pow(Math.max(0, 1 - featherWave), 18.0);

      const cloud = periodicFbm2D(nx * 2.0, ny * 2.0, 4, 4);

      // Luminous warm alabaster-white stone with dove-grey & hairline gold veins
      const r = 247 - cloud * 10 - primaryVein * 44 - fineGoldVein * 18 - featherVein * 22;
      const g = 243 - cloud * 11 - primaryVein * 46 - fineGoldVein * 26 - featherVein * 24;
      const b = 236 - cloud * 12 - primaryVein * 43 - fineGoldVein * 42 - featherVein * 22;

      const pIdx = y * mSize + x;
      const idx = pIdx * 4;
      mImg.data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      mImg.data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      mImg.data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      mImg.data[idx + 3] = 255;

      // Mineral veins sit microscopically recessed vs polished calcite matrix
      marbleHeightField[pIdx] = 0.85 - primaryVein * 0.22 - fineGoldVein * 0.16 - cloud * 0.08;

      const rough = Math.round(
        Math.min(1, 0.34 + primaryVein * 0.14 + fineGoldVein * 0.09 + cloud * 0.08) * 255
      );
      mrImg.data[idx] = rough;
      mrImg.data[idx + 1] = rough;
      mrImg.data[idx + 2] = rough;
      mrImg.data[idx + 3] = 255;
    }
  }
  mCtx.putImageData(mImg, 0, 0);
  mrCtx.putImageData(mrImg, 0, 0);

  const marbleColorMap = new THREE.CanvasTexture(mColCanvas);
  marbleColorMap.colorSpace = THREE.SRGBColorSpace;
  marbleColorMap.wrapS = marbleColorMap.wrapT = THREE.RepeatWrapping;
  marbleColorMap.repeat.set(2.2, 1.1);
  marbleColorMap.anisotropy = 8;

  const marbleRoughnessMap = new THREE.CanvasTexture(mRoughCanvas);
  marbleRoughnessMap.wrapS = marbleRoughnessMap.wrapT = THREE.RepeatWrapping;
  marbleRoughnessMap.repeat.set(2.2, 1.1);
  marbleRoughnessMap.anisotropy = 8;

  const marbleNormalMap = heightFieldToNormalTexture(marbleHeightField, mSize, 1.45, 2.2, 1.1);

  // 3. MAUVIEL HAND-HAMMERED RED COPPER (Bump + Tangent Normal Map)
  const cSize = 256;
  const cCanvas = document.createElement('canvas');
  cCanvas.width = cSize;
  cCanvas.height = cSize;
  const cCtx = cCanvas.getContext('2d')!;
  cCtx.fillStyle = '#d8d8d8';
  cCtx.fillRect(0, 0, cSize, cSize);
  const rows = 18;
  const cols = 18;
  for (let ry = -1; ry <= rows; ry++) {
    for (let rx = -1; rx <= cols; rx++) {
      const wx = ((rx % cols) + cols) % cols;
      const wy = ((ry % rows) + rows) % rows;
      const jx = (hash2(wx * 17.3, wy * 31.7) - 0.5) * 0.22;
      const jy = (hash2(wx * 43.1, wy * 19.9) - 0.5) * 0.22;
      const jr = hash2(wx * 23.7, wy * 53.3);
      const cx = ((rx + (wy % 2) * 0.5 + jx) / cols) * cSize;
      const cy = ((ry + jy) / rows) * cSize;
      const rad = (cSize / cols) * (0.58 + jr * 0.14);
      const grad = cCtx.createRadialGradient(cx, cy, rad * 0.08, cx, cy, rad);
      grad.addColorStop(0, 'rgba(95, 95, 95, 0.92)');
      grad.addColorStop(0.72, 'rgba(185, 185, 185, 0.75)');
      grad.addColorStop(1, 'rgba(242, 242, 242, 0.0)');
      cCtx.fillStyle = grad;
      cCtx.beginPath();
      cCtx.arc(cx, cy, rad, 0, Math.PI * 2);
      cCtx.fill();
    }
  }
  const cData = cCtx.getImageData(0, 0, cSize, cSize).data;
  const copperHeight = new Float32Array(cSize * cSize);
  for (let i = 0; i < cSize * cSize; i++) {
    copperHeight[i] = cData[i * 4] / 255;
  }

  const hammeredCopperBump = new THREE.CanvasTexture(cCanvas);
  hammeredCopperBump.wrapS = hammeredCopperBump.wrapT = THREE.RepeatWrapping;
  hammeredCopperBump.repeat.set(3, 1.6);

  const hammeredCopperNormalMap = heightFieldToNormalTexture(copperHeight, cSize, 2.2, 3, 1.6);

  // 4. AERATED CELLULAR SPONGE CRUMB MAPS (微孔海绵蛋糕胚法线凹凸)
  const sSize = 256;
  const sColCanvas = document.createElement('canvas');
  sColCanvas.width = sSize;
  sColCanvas.height = sSize;
  const sColCtx = sColCanvas.getContext('2d')!;
  sColCtx.fillStyle = '#f6f3ea';
  sColCtx.fillRect(0, 0, sSize, sSize);

  const sBumpCanvas = document.createElement('canvas');
  sBumpCanvas.width = sSize;
  sBumpCanvas.height = sSize;
  const sBumpCtx = sBumpCanvas.getContext('2d')!;
  sBumpCtx.fillStyle = '#dedede';
  sBumpCtx.fillRect(0, 0, sSize, sSize);

  const randSponge = mulberry32(8821);
  for (let i = 0; i < 2400; i++) {
    const x = randSponge() * sSize;
    const y = randSponge() * sSize;
    const r = 1.0 + randSponge() * 2.6;
    const shade = Math.round(215 + randSponge() * 38);
    sColCtx.fillStyle = `rgb(${shade},${shade - 3},${shade - 10})`;
    sColCtx.beginPath();
    sColCtx.arc(x, y, r, 0, Math.PI * 2);
    sColCtx.fill();
  }
  for (let i = 0; i < 420; i++) {
    const x = randSponge() * sSize;
    const y = randSponge() * sSize;
    const rx = 1.6 + Math.pow(randSponge(), 1.8) * 5.2;
    const ry = rx * (0.72 + randSponge() * 0.45);
    for (const ox of [-sSize, 0, sSize]) {
      for (const oy of [-sSize, 0, sSize]) {
        const gCol = sColCtx.createRadialGradient(x + ox, y + oy, 0.2, x + ox, y + oy, rx);
        gCol.addColorStop(0, 'rgba(112, 106, 92, 0.85)');
        gCol.addColorStop(0.7, 'rgba(185, 178, 162, 0.45)');
        gCol.addColorStop(1, 'rgba(246, 243, 234, 0)');
        sColCtx.fillStyle = gCol;
        sColCtx.beginPath();
        sColCtx.ellipse(x + ox, y + oy, rx, ry, 0, 0, Math.PI * 2);
        sColCtx.fill();

        const gBump = sBumpCtx.createRadialGradient(x + ox, y + oy, 0.2, x + ox, y + oy, rx);
        gBump.addColorStop(0, 'rgba(28, 28, 28, 0.95)');
        gBump.addColorStop(0.78, 'rgba(130, 130, 130, 0.5)');
        gBump.addColorStop(1, 'rgba(222, 222, 222, 0)');
        sBumpCtx.fillStyle = gBump;
        sBumpCtx.beginPath();
        sBumpCtx.ellipse(x + ox, y + oy, rx, ry, 0, 0, Math.PI * 2);
        sBumpCtx.fill();
      }
    }
  }

  const spongeColorMap = new THREE.CanvasTexture(sColCanvas);
  spongeColorMap.colorSpace = THREE.SRGBColorSpace;
  spongeColorMap.wrapS = spongeColorMap.wrapT = THREE.RepeatWrapping;
  spongeColorMap.repeat.set(3, 3);

  const spongeBumpMap = new THREE.CanvasTexture(sBumpCanvas);
  spongeBumpMap.wrapS = spongeBumpMap.wrapT = THREE.RepeatWrapping;
  spongeBumpMap.repeat.set(3, 3);

  // 5. TOASTED HAZELNUT PRALINE FEUILLETINE CRUNCH MAP
  const hCanvas = document.createElement('canvas');
  hCanvas.width = 256;
  hCanvas.height = 256;
  const hCtx = hCanvas.getContext('2d')!;
  hCtx.fillStyle = '#8b5732';
  hCtx.fillRect(0, 0, 256, 256);
  const randNut = mulberry32(3199);
  for (let i = 0; i < 680; i++) {
    const x = randNut() * 256;
    const y = randNut() * 256;
    const w = 3 + randNut() * 9;
    const h = 2 + randNut() * 4.5;
    const ang = randNut() * Math.PI;
    const light = randNut();
    hCtx.save();
    hCtx.translate(x, y);
    hCtx.rotate(ang);
    hCtx.fillStyle =
      light > 0.72
        ? '#dfb278'
        : light > 0.35
          ? '#b87d44'
          : '#5c3419';
    hCtx.fillRect(-w * 0.5, -h * 0.5, w, h);
    hCtx.restore();
  }
  const crunchColorMap = new THREE.CanvasTexture(hCanvas);
  crunchColorMap.colorSpace = THREE.SRGBColorSpace;
  crunchColorMap.wrapS = crunchColorMap.wrapT = THREE.RepeatWrapping;
  crunchColorMap.repeat.set(3, 3);

  // 6. BOURBON VANILLA BEAN SPECK MOUSSE MAP
  const vCanvas = document.createElement('canvas');
  vCanvas.width = 256;
  vCanvas.height = 256;
  const vCtx = vCanvas.getContext('2d')!;
  vCtx.fillStyle = '#fbf4e6';
  vCtx.fillRect(0, 0, 256, 256);
  const randVan = mulberry32(7712);
  for (let i = 0; i < 360; i++) {
    const x = randVan() * 256;
    const y = randVan() * 256;
    const r = 0.55 + randVan() * 0.95;
    vCtx.fillStyle = `rgba(46, 31, 22, ${0.45 + randVan() * 0.45})`;
    vCtx.beginPath();
    vCtx.arc(x, y, r, 0, Math.PI * 2);
    vCtx.fill();
  }
  const vanillaMousseMap = new THREE.CanvasTexture(vCanvas);
  vanillaMousseMap.colorSpace = THREE.SRGBColorSpace;
  vanillaMousseMap.wrapS = vanillaMousseMap.wrapT = THREE.RepeatWrapping;
  vanillaMousseMap.repeat.set(2.5, 2.5);

  // 7. HAND-THROWN FRENCH TERRACOTTA PLANTER (手工粗陶微凸颗粒质感 + Normal)
  const tSize = 256;
  const tColCanvas = document.createElement('canvas');
  tColCanvas.width = tSize;
  tColCanvas.height = tSize;
  const tCtx = tColCanvas.getContext('2d')!;
  const tImg = tCtx.createImageData(tSize, tSize);
  const tHeight = new Float32Array(tSize * tSize);

  for (let y = 0; y < tSize; y++) {
    for (let x = 0; x < tSize; x++) {
      const wheelRing = Math.sin((y / tSize) * Math.PI * 28.0) * 0.08;
      const grit = fbm2D(x * 0.22, y * 0.22, 3);
      const efflorescence = fbm2D(x * 0.04 + 5.1, y * 0.04 + 2.4, 3);
      const h = 0.5 + wheelRing + (grit - 0.5) * 0.45;
      tHeight[y * tSize + x] = h;

      const salt = Math.max(0, efflorescence - 0.62) * 1.4;
      const r = Math.min(255, Math.round(188 + (grit - 0.5) * 26 + salt * 42));
      const g = Math.min(255, Math.round(112 + (grit - 0.5) * 20 + salt * 52));
      const b = Math.min(255, Math.round(78 + (grit - 0.5) * 16 + salt * 58));

      const idx = (y * tSize + x) * 4;
      tImg.data[idx] = r;
      tImg.data[idx + 1] = g;
      tImg.data[idx + 2] = b;
      tImg.data[idx + 3] = 255;
    }
  }
  tCtx.putImageData(tImg, 0, 0);

  const terracottaColorMap = new THREE.CanvasTexture(tColCanvas);
  terracottaColorMap.colorSpace = THREE.SRGBColorSpace;
  terracottaColorMap.wrapS = terracottaColorMap.wrapT = THREE.RepeatWrapping;
  terracottaColorMap.repeat.set(2, 1.5);

  const terracottaNormalMap = heightFieldToNormalTexture(tHeight, tSize, 2.8, 2, 1.5);

  // 8. HAUSSMANN PARISIAN ASHLAR LIMESTONE MASONRY (Pierre de Taille Color + Normal)
  const lSize = 512;
  const lColCanvas = document.createElement('canvas');
  lColCanvas.width = lSize;
  lColCanvas.height = lSize;
  const lCtx = lColCanvas.getContext('2d')!;
  const lImg = lCtx.createImageData(lSize, lSize);
  const lHeight = new Float32Array(lSize * lSize);

  const lRows = 8;
  const lCols = 4;
  const blockH = lSize / lRows;
  const blockW = lSize / lCols;

  for (let y = 0; y < lSize; y++) {
    const row = Math.floor(y / blockH);
    const localY = y - row * blockH;
    const xOffset = (row % 2) * (blockW * 0.5);
    for (let x = 0; x < lSize; x++) {
      const shiftedX = (x + xOffset) % lSize;
      const col = Math.floor(shiftedX / blockW);
      const localX = shiftedX - col * blockW;

      const blockSeed = hash2(col * 19.1, row * 37.7);
      const grain = periodicFbm2D((x / lSize) * 16.0, (y / lSize) * 16.0, 16, 3);
      const streak = periodicFbm2D((x / lSize) * 4.0 + 1.3, (y / lSize) * 8.0 + 2.7, 8, 3);

      const seamDist = Math.min(localX, blockW - localX, localY, blockH - localY);
      const joint = seamDist < 2.2 ? seamDist / 2.2 : 1.0;
      const chamfer = seamDist < 5.0 ? 0.85 + 0.15 * Math.min(1, (seamDist - 2.2) / 2.8) : 1.0;

      const h = (0.28 + 0.72 * joint) * chamfer * (0.86 + (blockSeed - 0.5) * 0.08 + grain * 0.10);
      lHeight[y * lSize + x] = h;

      const baseTone = 0.92 + (blockSeed - 0.5) * 0.09 + (streak - 0.5) * 0.08 + (grain - 0.5) * 0.05;
      const mortarShadow = 0.68 + 0.32 * joint;
      const r = Math.min(255, Math.max(0, Math.round(234 * baseTone * mortarShadow)));
      const g = Math.min(255, Math.max(0, Math.round(223 * baseTone * mortarShadow)));
      const b = Math.min(255, Math.max(0, Math.round(206 * baseTone * mortarShadow)));

      const idx = (y * lSize + x) * 4;
      lImg.data[idx] = r;
      lImg.data[idx + 1] = g;
      lImg.data[idx + 2] = b;
      lImg.data[idx + 3] = 255;
    }
  }
  lCtx.putImageData(lImg, 0, 0);

  const limestoneColorMap = new THREE.CanvasTexture(lColCanvas);
  limestoneColorMap.colorSpace = THREE.SRGBColorSpace;
  limestoneColorMap.wrapS = limestoneColorMap.wrapT = THREE.RepeatWrapping;
  limestoneColorMap.repeat.set(3.2, 2.2);
  limestoneColorMap.anisotropy = 8;

  const limestoneNormalMap = heightFieldToNormalTexture(lHeight, lSize, 2.4, 3.2, 2.2);

  // 9. CORDIERITE BAKING HEARTH STONE (Speckled Refractory Chamotte Color + Roughness)
  const hsSize = 512;
  const hsColCanvas = document.createElement('canvas');
  hsColCanvas.width = hsSize;
  hsColCanvas.height = hsSize;
  const hsCtx = hsColCanvas.getContext('2d')!;
  const hsImg = hsCtx.createImageData(hsSize, hsSize);

  const hsRoughCanvas = document.createElement('canvas');
  hsRoughCanvas.width = hsSize;
  hsRoughCanvas.height = hsSize;
  const hsRoughCtx = hsRoughCanvas.getContext('2d')!;
  const hsRoughImg = hsRoughCtx.createImageData(hsSize, hsSize);

  for (let y = 0; y < hsSize; y++) {
    const v = y / hsSize;
    for (let x = 0; x < hsSize; x++) {
      const u = x / hsSize;
      const macro = periodicFbm2D(u * 4.0, v * 4.0, 4, 3);
      const grain = periodicFbm2D(u * 20.0, v * 20.0, 20, 3);
      // Center deck baking patina + chamfered slab edge warmth
      const dx = (u - 0.5) * 2.0;
      const dz = (v - 0.5) * 2.0;
      const bakeRadius = Math.sqrt(dx * dx + dz * dz);
      const patina = Math.max(0, 1.0 - bakeRadius * 0.92) * 0.14;

      const speckSeed = hash2(x * 1.13, y * 1.79);
      const coarseSeed = hash2(Math.floor(x / 3) * 7.3, Math.floor(y / 3) * 11.7);
      const isDarkGrog = speckSeed > 0.968 || (coarseSeed > 0.945 && speckSeed > 0.72);
      const isQuartz = !isDarkGrog && speckSeed < 0.045;

      let r = 218 + (macro - 0.5) * 18 + (grain - 0.5) * 12 - patina * 38;
      let g = 200 + (macro - 0.5) * 16 + (grain - 0.5) * 10 - patina * 42;
      let b = 172 + (macro - 0.5) * 14 + (grain - 0.5) * 9 - patina * 44;
      let rough = 234 + (grain - 0.5) * 16;

      if (isDarkGrog) {
        const d = 0.45 + (speckSeed - 0.72) * 0.45;
        r -= 36 * d;
        g -= 34 * d;
        b -= 30 * d;
        rough = 248;
      } else if (isQuartz) {
        r += 16;
        g += 15;
        b += 12;
        rough = 220;
      }

      const idx = (y * hsSize + x) * 4;
      hsImg.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      hsImg.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      hsImg.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      hsImg.data[idx + 3] = 255;

      const rv = Math.min(255, Math.max(212, Math.round(rough)));
      hsRoughImg.data[idx] = rv;
      hsRoughImg.data[idx + 1] = rv;
      hsRoughImg.data[idx + 2] = rv;
      hsRoughImg.data[idx + 3] = 255;
    }
  }
  hsCtx.putImageData(hsImg, 0, 0);
  hsRoughCtx.putImageData(hsRoughImg, 0, 0);

  const hearthStoneColorMap = new THREE.CanvasTexture(hsColCanvas);
  hearthStoneColorMap.colorSpace = THREE.SRGBColorSpace;
  hearthStoneColorMap.wrapS = hearthStoneColorMap.wrapT = THREE.RepeatWrapping;
  hearthStoneColorMap.anisotropy = 8;

  const hearthStoneRoughnessMap = new THREE.CanvasTexture(hsRoughCanvas);
  hearthStoneRoughnessMap.wrapS = hearthStoneRoughnessMap.wrapT = THREE.RepeatWrapping;
  hearthStoneRoughnessMap.anisotropy = 8;

  // 10. FRENCH FLAX WOVEN LINEN TORCHON (Color + Tangent Normal Map)
  const lnSize = 256;
  const lnColCanvas = document.createElement('canvas');
  lnColCanvas.width = lnSize;
  lnColCanvas.height = lnSize;
  const lnCtx = lnColCanvas.getContext('2d')!;
  const lnImg = lnCtx.createImageData(lnSize, lnSize);
  const lnHeight = new Float32Array(lnSize * lnSize);

  for (let y = 0; y < lnSize; y++) {
    const v = y / lnSize;
    // Signature French torchon woven bordeaux & gold selvedge stripes
    const inMainStripe = Math.abs(v - 0.16) < 0.022;
    const inPinStripe = Math.abs(v - 0.12) < 0.006 || Math.abs(v - 0.20) < 0.006;
    for (let x = 0; x < lnSize; x++) {
      const u = x / lnSize;
      const cellX = Math.floor(x / 2);
      const cellY = Math.floor(y / 2);
      const checker = (cellX + cellY) % 2 === 0;
      const threadX = Math.sin((x / 2) * Math.PI);
      const threadY = Math.sin((y / 2) * Math.PI);
      const weaveH = checker ? 0.55 + 0.45 * Math.abs(threadX) : 0.48 + 0.40 * Math.abs(threadY);
      const slubX = periodicFbm2D(u * 6.0, v * 28.0, 28, 2);
      const slubY = periodicFbm2D(u * 28.0, v * 6.0, 28, 2);
      const slub = (slubX + slubY) * 0.5;

      const h = weaveH * (0.84 + 0.16 * slub);
      lnHeight[y * lnSize + x] = h;

      let r = 240 - (1.0 - weaveH) * 14 + (slub - 0.5) * 16;
      let g = 232 - (1.0 - weaveH) * 14 + (slub - 0.5) * 15;
      let b = 218 - (1.0 - weaveH) * 15 + (slub - 0.5) * 14;

      if (inMainStripe) {
        r = r * 0.45 + 148 * 0.55;
        g = g * 0.45 + 38 * 0.55;
        b = b * 0.45 + 48 * 0.55;
      } else if (inPinStripe) {
        r = r * 0.55 + 188 * 0.45;
        g = g * 0.55 + 146 * 0.45;
        b = b * 0.55 + 72 * 0.45;
      }

      const idx = (y * lnSize + x) * 4;
      lnImg.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      lnImg.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      lnImg.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      lnImg.data[idx + 3] = 255;
    }
  }
  lnCtx.putImageData(lnImg, 0, 0);

  const linenColorMap = new THREE.CanvasTexture(lnColCanvas);
  linenColorMap.colorSpace = THREE.SRGBColorSpace;
  linenColorMap.wrapS = linenColorMap.wrapT = THREE.RepeatWrapping;
  linenColorMap.repeat.set(1.2, 1.2);
  linenColorMap.anisotropy = 8;

  const linenNormalMap = heightFieldToNormalTexture(lnHeight, lnSize, 2.2, 1.2, 1.2);

  return {
    oakColorMap,
    oakBumpMap,
    oakNormalMap,
    oakRoughnessMap,
    marbleColorMap,
    marbleRoughnessMap,
    marbleNormalMap,
    hammeredCopperBump,
    hammeredCopperNormalMap,
    spongeColorMap,
    spongeBumpMap,
    crunchColorMap,
    vanillaMousseMap,
    terracottaColorMap,
    terracottaNormalMap,
    limestoneColorMap,
    limestoneNormalMap,
    hearthStoneColorMap,
    hearthStoneRoughnessMap,
    linenColorMap,
    linenNormalMap,
  };
}

export function getAtelierTextures() {
  if (!cachedAtelierTextures) {
    cachedAtelierTextures = generateAllAtelierTextures();
  }
  return cachedAtelierTextures;
}

/**
 * Ensures `uv1` (channel 1) & `uv2` exist by aliasing primary `uv`, enabling Three r170 `aoMap`
 * across BoxGeometry, PlaneGeometry, ExtrudeGeometry, and LatheGeometry without seams.
 */
export function ensureSecondaryUv(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const uv = geo.getAttribute('uv');
  if (uv) {
    if (!geo.getAttribute('uv1')) {
      geo.setAttribute('uv1', uv);
    }
    if (!geo.getAttribute('uv2')) {
      geo.setAttribute('uv2', uv);
    }
  }
  return geo;
}

export function applyTextureAnisotropy(
  tex: THREE.Texture,
  renderer?: THREE.WebGLRenderer,
  target = 16
): THREE.Texture {
  const maxAniso = renderer ? renderer.capabilities.getMaxAnisotropy() : target;
  tex.anisotropy = Math.min(target, Math.max(1, maxAniso));
  return tex;
}

export interface ScannedPbrSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  aoMap?: THREE.Texture;
  metalnessMap?: THREE.Texture;
}

interface SharedImageEntry {
  source: THREE.Source;
  subscribers: Set<THREE.Texture>;
  disposeHandlers: Map<THREE.Texture, () => void>;
  loaded: boolean;
  swapping: boolean;
}

const scannedImageCache = new Map<string, SharedImageEntry>();
const scannedSetCache = new Map<string, ScannedPbrSet>();

type PlaceholderHint = 'color' | 'normal' | 'rough' | 'ao' | 'metal';

function createNeutralPlaceholder(fillHex: string, hint: PlaceholderHint = 'color'): HTMLCanvasElement | undefined {
  if (typeof document === 'undefined') return undefined;
  const size = hint === 'color' ? 64 : 4;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = fillHex;
    ctx.fillRect(0, 0, size, size);
    if (hint === 'color') {
      // Subtle deterministic micro-variation so frame 0 reads naturally prior to 2K decode
      ctx.globalAlpha = 0.06;
      for (let i = 0; i < 24; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#2C221A';
        const y = ((i * 19) % size);
        ctx.fillRect(0, y, size, 1 + (i % 3));
      }
      ctx.globalAlpha = 1;
    }
  }
  return c;
}

function loadSharedScannedTexture(
  url: string,
  repeatX: number,
  repeatY: number,
  isColor: boolean,
  placeholderHex: string,
  channel = 0,
  hint: PlaceholderHint = 'color'
): THREE.Texture {
  let entry = scannedImageCache.get(url);
  if (!entry) {
    const placeholder = createNeutralPlaceholder(placeholderHex, hint);
    const source = new THREE.Source(placeholder);
    const subscribers = new Set<THREE.Texture>();
    const disposeHandlers = new Map<THREE.Texture, () => void>();
    entry = { source, subscribers, disposeHandlers, loaded: false, swapping: false };
    scannedImageCache.set(url, entry);

    if (typeof Image !== 'undefined') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Construct a fresh THREE.Source so WebGL2 allocates full 2048x2048 immutable texStorage2D
        // after deallocating the placeholder storage via t.dispose() first (avoids GL_INVALID_VALUE 1281).
        const loadedSource = new THREE.Source(img);
        const targetEntry = entry!;
        targetEntry.source = loadedSource;
        targetEntry.loaded = true;
        targetEntry.swapping = true;
        targetEntry.subscribers.forEach((t) => {
          const handler = targetEntry.disposeHandlers.get(t);
          if (handler) t.removeEventListener('dispose', handler);
          t.dispose();
          t.source = loadedSource;
          t.needsUpdate = true;
        });
        targetEntry.swapping = false;
        targetEntry.subscribers.clear();
        targetEntry.disposeHandlers.clear();
      };
      img.onerror = () => {
        console.warn(`[atelierTextures] Failed to load scanned texture: ${url}`);
      };
      img.src = url;
    }
  }

  const tex = new THREE.Texture();
  tex.source = entry.source;
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 16;
  tex.channel = channel;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  if (!entry.loaded) {
    const targetEntry = entry;
    const onDispose = () => {
      if (!targetEntry.swapping) {
        targetEntry.subscribers.delete(tex);
        targetEntry.disposeHandlers.delete(tex);
      }
    };
    targetEntry.subscribers.add(tex);
    targetEntry.disposeHandlers.set(tex, onDispose);
    tex.addEventListener('dispose', onDispose);
  }
  return tex;
}

function getOrBuildScannedSet(
  key: string,
  basePath: string,
  repeatX: number,
  repeatY: number,
  opts: { hasAo?: boolean; hasMetalness?: boolean; colorPlaceholder?: string; roughPlaceholder?: string } = {}
): ScannedPbrSet {
  const cacheKey = `${key}:${repeatX.toFixed(3)}:${repeatY.toFixed(3)}`;
  const existing = scannedSetCache.get(cacheKey);
  if (existing) return existing;

  const set: ScannedPbrSet = {
    map: loadSharedScannedTexture(
      `${basePath}/diff.jpg`,
      repeatX,
      repeatY,
      true,
      opts.colorPlaceholder ?? '#E8E2D8',
      0,
      'color'
    ),
    normalMap: loadSharedScannedTexture(`${basePath}/nor_gl.jpg`, repeatX, repeatY, false, '#8080FF', 0, 'normal'),
    roughnessMap: loadSharedScannedTexture(
      `${basePath}/rough.jpg`,
      repeatX,
      repeatY,
      false,
      opts.roughPlaceholder ?? '#B8B8B8',
      0,
      'rough'
    ),
    ...(opts.hasAo
      ? { aoMap: loadSharedScannedTexture(`${basePath}/ao.jpg`, repeatX, repeatY, false, '#FFFFFF', 1, 'ao') }
      : {}),
    ...(opts.hasMetalness
      ? { metalnessMap: loadSharedScannedTexture(`${basePath}/metal.jpg`, repeatX, repeatY, false, '#FFFFFF', 0, 'metal') }
      : {}),
  };

  scannedSetCache.set(cacheKey, set);
  return set;
}

const TEXTURES_BASE = `${import.meta.env.BASE_URL}textures`;

export function getParquetPbrSet(repeatX = 5.5, repeatY = 4.4): ScannedPbrSet {
  return getOrBuildScannedSet('parquet', `${TEXTURES_BASE}/parquet`, repeatX, repeatY, {
    hasAo: true,
    colorPlaceholder: '#B89568',
    roughPlaceholder: '#9E9E9E',
  });
}

export function getPlasterPbrSet(repeatX = 3.8, repeatY = 1.4): ScannedPbrSet {
  return getOrBuildScannedSet('plaster', `${TEXTURES_BASE}/plaster`, repeatX, repeatY, {
    hasAo: true,
    colorPlaceholder: '#EAE3D8',
    roughPlaceholder: '#D8D8D8',
  });
}

export function getMarblePbrSet(repeatX = 1.8, repeatY = 1.0): ScannedPbrSet {
  return getOrBuildScannedSet('marble', `${TEXTURES_BASE}/marble`, repeatX, repeatY, {
    hasAo: false,
    colorPlaceholder: '#F2EFEA',
    roughPlaceholder: '#585858',
  });
}

export function getSteelPbrSet(repeatX = 1.0, repeatY = 1.0): ScannedPbrSet {
  return getOrBuildScannedSet('steel', `${TEXTURES_BASE}/steel`, repeatX, repeatY, {
    hasAo: false,
    hasMetalness: true,
    colorPlaceholder: '#D8DCE2',
    roughPlaceholder: '#666666',
  });
}

export function getGrassPbrSet(repeatX = 16, repeatY = 16): ScannedPbrSet {
  return getOrBuildScannedSet('grass', `${TEXTURES_BASE}/grass`, repeatX, repeatY, {
    hasAo: true,
    colorPlaceholder: '#5E7F3E',
    roughPlaceholder: '#C4C4C4',
  });
}

export function getStonePbrSet(repeatX = 8, repeatY = 8): ScannedPbrSet {
  return getOrBuildScannedSet('stone', `${TEXTURES_BASE}/stone`, repeatX, repeatY, {
    hasAo: true,
    colorPlaceholder: '#B8AEA0',
    roughPlaceholder: '#AEAEAE',
  });
}
