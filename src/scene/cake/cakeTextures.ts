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

function periodicValueNoise2D(u: number, v: number, period: number): number {
  const px = u * period;
  const py = v * period;
  const xi = Math.floor(px);
  const yi = Math.floor(py);
  const xf = px - xi;
  const yf = py - yi;
  const ux = xf * xf * (3 - 2 * xf);
  const uy = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y0 = ((yi % period) + period) % period;
  const y1 = (y0 + 1) % period;
  const a = hash2(x0, y0);
  const b = hash2(x1, y0);
  const c = hash2(x0, y1);
  const d = hash2(x1, y1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function periodicFbm2D(u: number, v: number, basePeriod: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let period = Math.max(1, Math.round(basePeriod));
  for (let i = 0; i < octaves; i++) {
    sum += amp * periodicValueNoise2D(u, v, period);
    norm += amp;
    period *= 2;
    amp *= 0.5;
  }
  return norm > 0 ? sum / norm : 0;
}

export interface CakeProceduralTextures {
  spongeColorMap: THREE.CanvasTexture;
  spongeBumpMap: THREE.CanvasTexture;
  spongeNormalMap: THREE.CanvasTexture;
  spongeRoughnessMap: THREE.CanvasTexture;
  vanillaMousseMap: THREE.CanvasTexture;
  vanillaMousseBumpMap: THREE.CanvasTexture;
  mousseSliceNormalMap: THREE.CanvasTexture;
  chantillyBumpMap: THREE.CanvasTexture;
  chantillyRoughnessMap: THREE.CanvasTexture;
  semiNakedCoatMap: THREE.CanvasTexture;
  semiNakedAlphaMap: THREE.CanvasTexture;
  jellyPulpMap: THREE.CanvasTexture;
  jellyBumpMap: THREE.CanvasTexture;
  jellyNormalMap: THREE.CanvasTexture;
  crunchColorMap: THREE.CanvasTexture;
  crunchBumpMap: THREE.CanvasTexture;
  crunchNormalMap: THREE.CanvasTexture;
  crunchRoughnessMap: THREE.CanvasTexture;
  berryFuzzNormalMap: THREE.CanvasTexture;
  strawberrySkinMap: THREE.CanvasTexture;
  strawberrySeedNormalMap: THREE.CanvasTexture;
  strawberryCutMap: THREE.CanvasTexture;
  strawberryCutNormalMap: THREE.CanvasTexture;
  blueberryFrostMap: THREE.CanvasTexture;
  macaronShellBumpMap: THREE.CanvasTexture;
  marbleColorMap: THREE.CanvasTexture;
  marbleRoughnessMap: THREE.CanvasTexture;
}

let cachedTextures: CakeProceduralTextures | null = null;

function createCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function makeSeamlessTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  isColor: boolean
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  return tex;
}

/**
 * Converts a seamless toroidal 2D heightfield [0..1] into a crisp RGB tangent-space normal map.
 */
function buildTangentNormalCanvas(
  height: Float32Array,
  size: number,
  strength: number
): HTMLCanvasElement {
  const [canvas, ctx] = createCanvas(size);
  const img = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;

      const hL = height[y * size + xm];
      const hR = height[y * size + xp];
      const hU = height[ym * size + x];
      const hD = height[yp * size + x];

      const dx = (hL - hR) * strength;
      // Under CanvasTexture (flipY=true), +v points upward (ym = y-1, yp = y+1), so -dh/dv = hD - hU
      const dy = (hD - hU) * strength;
      const dz = 1.0;
      const invLen = 1.0 / Math.hypot(dx, dy, dz);

      const idx = (y * size + x) * 4;
      img.data[idx] = Math.round((dx * invLen * 0.5 + 0.5) * 255);
      img.data[idx + 1] = Math.round((dy * invLen * 0.5 + 0.5) * 255);
      img.data[idx + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255);
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function generateCakeProceduralTextures(): CakeProceduralTextures {
  // -------------------------------------------------------------------------
  // 1. HIGH-FREQUENCY CELLULAR HONEYCOMB SPONGE (512x512 + Tangent NormalMap)
  // -------------------------------------------------------------------------
  const sSize = 512;
  const [sColCanvas, sColCtx] = createCanvas(sSize);
  const [sBumpCanvas, sBumpCtx] = createCanvas(sSize);
  const [sRoughCanvas, sRoughCtx] = createCanvas(sSize);
  const sHeight = new Float32Array(sSize * sSize);

  // Base moist crumb heightfield + seamless periodic micro grain
  for (let y = 0; y < sSize; y++) {
    for (let x = 0; x < sSize; x++) {
      const micro = periodicFbm2D(x / sSize, y / sSize, 32, 3);
      sHeight[y * sSize + x] = 0.72 + (micro - 0.5) * 0.24;
    }
  }

  const randSponge = mulberry32(91042);

  // 高细腻度蓬松戚风蜂窝气孔：告别粗糙大洞与廉价暗斑，营造温润绵密的法式戚风切面！
  for (let i = 0; i < 2800; i++) {
    const isFinePin = i >= 1200;
    const cx = randSponge() * sSize;
    const cy = randSponge() * sSize;
    const rx = isFinePin ? 0.75 + randSponge() * 1.35 : 1.15 + Math.pow(randSponge(), 2.2) * 4.2;
    const ry = rx * (0.72 + randSponge() * 0.42);
    const cosA = Math.cos(randSponge() * Math.PI);
    const sinA = Math.sin(randSponge() * Math.PI);
    const depth = isFinePin ? 0.24 + randSponge() * 0.22 : 0.30 + randSponge() * 0.30;

    const maxR = Math.ceil(Math.max(rx, ry)) + 2;
    for (let dy = -maxR; dy <= maxR; dy++) {
      for (let dx = -maxR; dx <= maxR; dx++) {
        const lx = dx * cosA + dy * sinA;
        const ly = -dx * sinA + dy * cosA;
        const d2 = (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry);
        if (d2 >= 1.0) continue;

        const px = ((Math.round(cx) + dx) % sSize + sSize) % sSize;
        const py = ((Math.round(cy) + dy) % sSize + sSize) % sSize;
        const cup = Math.pow(1.0 - d2, 0.82) * depth;
        const rim = Math.exp(-Math.pow((Math.sqrt(d2) - 0.88) / 0.14, 2.0)) * 0.07;
        const idx = py * sSize + px;
        sHeight[idx] = Math.max(0.18, Math.min(1.0, sHeight[idx] - cup + rim));
      }
    }
  }

  const sColImg = sColCtx.createImageData(sSize, sSize);
  const sBumpImg = sBumpCtx.createImageData(sSize, sSize);
  const sRoughImg = sRoughCtx.createImageData(sSize, sSize);

  for (let y = 0; y < sSize; y++) {
    for (let x = 0; x < sSize; x++) {
      const h = sHeight[y * sSize + x];
      const ao = THREE.MathUtils.smoothstep(h, 0.16, 0.84);
      // 柔和蜂蜜戚风绵密色阶（彻底清除深黑方块/暗斑噪点！）
      const cellTint = 0.72 + 0.28 * ao;

      const r = Math.min(255, Math.round(252 * cellTint));
      const g = Math.min(255, Math.round(244 * cellTint));
      const b = Math.min(255, Math.round(226 * cellTint));

      const pIdx = (y * sSize + x) * 4;
      sColImg.data[pIdx] = r;
      sColImg.data[pIdx + 1] = g;
      sColImg.data[pIdx + 2] = b;
      sColImg.data[pIdx + 3] = 255;

      const bv = Math.round(h * 255);
      sBumpImg.data[pIdx] = bv;
      sBumpImg.data[pIdx + 1] = bv;
      sBumpImg.data[pIdx + 2] = bv;
      sBumpImg.data[pIdx + 3] = 255;

      // Soft airy matte chiffon roughness (0.80 .. 0.98)
      const rv = Math.round((0.98 - ao * 0.18) * 255);
      sRoughImg.data[pIdx] = rv;
      sRoughImg.data[pIdx + 1] = rv;
      sRoughImg.data[pIdx + 2] = rv;
      sRoughImg.data[pIdx + 3] = 255;
    }
  }
  sColCtx.putImageData(sColImg, 0, 0);
  sBumpCtx.putImageData(sBumpImg, 0, 0);
  sRoughCtx.putImageData(sRoughImg, 0, 0);

  const sNormalCanvas = buildTangentNormalCanvas(sHeight, sSize, 5.8);

  const spongeColorMap = makeSeamlessTexture(sColCanvas, 3.4, 3.4, true);
  const spongeBumpMap = makeSeamlessTexture(sBumpCanvas, 3.4, 3.4, false);
  const spongeNormalMap = makeSeamlessTexture(sNormalCanvas, 3.4, 3.4, false);
  const spongeRoughnessMap = makeSeamlessTexture(sRoughCanvas, 3.4, 3.4, false);

  // -------------------------------------------------------------------------
  // 2. BOURBON VANILLA BEAN SPECK MOUSSE + KNIFE-DRAG SLICE NORMAL MAP
  // -------------------------------------------------------------------------
  const mSize = 512;
  const [vColCanvas, vColCtx] = createCanvas(mSize);
  const [vBumpCanvas, vBumpCtx] = createCanvas(mSize);
  const sliceHeight = new Float32Array(mSize * mSize);

  vColCtx.fillStyle = '#fcfaf5';
  vColCtx.fillRect(0, 0, mSize, mSize);
  vBumpCtx.fillStyle = '#dadada';
  vBumpCtx.fillRect(0, 0, mSize, mSize);

  // Ultra-subtle curved silver-knife sweep micro-texture + seamless periodic whipped cream aeration
  for (let y = 0; y < mSize; y++) {
    const ny = y / mSize;
    for (let x = 0; x < mSize; x++) {
      const nx = x / mSize;
      const microAir = periodicFbm2D(nx, ny, 44, 3);
      const broadVelvet = periodicFbm2D(nx + 0.25, ny + 0.18, 8, 2);
      const curvedSweep = Math.sin((nx * 2.0 + ny * 4.0 + broadVelvet * 0.45) * Math.PI * 2.0) * 0.026;
      sliceHeight[y * mSize + x] = 0.65 + curvedSweep + (microAir - 0.5) * 0.105;
    }
  }

  const randVan = mulberry32(44109);
  // Subtle creamy bavarois micro-luminance swirls
  for (let i = 0; i < 650; i++) {
    const x = randVan() * mSize;
    const y = randVan() * mSize;
    const r = 6.0 + randVan() * 14.0;
    const creamShade = randVan() > 0.5 ? 'rgba(255, 252, 245, 0.22)' : 'rgba(241, 232, 214, 0.16)';
    for (const ox of [-mSize, 0, mSize]) {
      for (const oy of [-mSize, 0, mSize]) {
        if (x + ox < -r || x + ox > mSize + r || y + oy < -r || y + oy > mSize + r) continue;
        vColCtx.fillStyle = creamShade;
        vColCtx.beginPath();
        vColCtx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
        vColCtx.fill();
      }
    }
  }
  // Velvety whipped micro-cream aeration dimples (toroidal wrap)
  for (let i = 0; i < 1800; i++) {
    const x = randVan() * mSize;
    const y = randVan() * mSize;
    const r = 0.9 + randVan() * 2.6;
    const shade = Math.round(246 + randVan() * 9);
    const colStyle = `rgb(${shade},${shade - 1},${shade - 3})`;
    const bVal = Math.round(206 + randVan() * 28);
    const bumpStyle = `rgb(${bVal},${bVal},${bVal})`;
    for (const ox of [-mSize, 0, mSize]) {
      for (const oy of [-mSize, 0, mSize]) {
        if (x + ox < -r || x + ox > mSize + r || y + oy < -r || y + oy > mSize + r) continue;
        vColCtx.fillStyle = colStyle;
        vColCtx.beginPath();
        vColCtx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
        vColCtx.fill();

        vBumpCtx.fillStyle = bumpStyle;
        vBumpCtx.beginPath();
        vBumpCtx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
        vBumpCtx.fill();
      }
    }
  }
  // Sub-surface diffused suspended Bourbon vanilla bean specks beneath cream surface (toroidal wrap)
  for (let i = 0; i < 720; i++) {
    const x = randVan() * mSize;
    const y = randVan() * mSize;
    const rx = 1.4 + randVan() * 2.0;
    const ry = rx * (0.64 + randVan() * 0.30);
    const rot = randVan() * Math.PI;
    vColCtx.fillStyle = `rgba(92, 54, 28, ${0.22 + randVan() * 0.18})`;
    for (const ox of [-mSize, 0, mSize]) {
      for (const oy of [-mSize, 0, mSize]) {
        if (x + ox < -rx || x + ox > mSize + rx || y + oy < -rx || y + oy > mSize + rx) continue;
        vColCtx.beginPath();
        vColCtx.ellipse(x + ox, y + oy, rx, ry, rot, 0, Math.PI * 2);
        vColCtx.fill();
      }
    }
  }
  // Crisp crushed Madagascar Bourbon vanilla pod seeds + soft micro-dimples (legible in macro close-up!)
  for (let i = 0; i < 1550; i++) {
    const x = randVan() * mSize;
    const y = randVan() * mSize;
    const rx = 1.15 + randVan() * 1.65;
    const ry = rx * (0.62 + randVan() * 0.34);
    const rot = randVan() * Math.PI;
    const alpha = 0.88 + randVan() * 0.12;
    vColCtx.fillStyle = `rgba(22, 10, 4, ${alpha})`;
    vBumpCtx.fillStyle = 'rgba(128, 128, 128, 0.72)';
    for (const ox of [-mSize, 0, mSize]) {
      for (const oy of [-mSize, 0, mSize]) {
        if (x + ox < -rx || x + ox > mSize + rx || y + oy < -rx || y + oy > mSize + rx) continue;
        vColCtx.beginPath();
        vColCtx.ellipse(x + ox, y + oy, rx, ry, rot, 0, Math.PI * 2);
        vColCtx.fill();

        vBumpCtx.beginPath();
        vBumpCtx.ellipse(x + ox, y + oy, rx * 1.08, ry * 1.08, rot, 0, Math.PI * 2);
        vBumpCtx.fill();
      }
    }

    // Soft micro-tear dimple behind seed from silver knife pass
    const px = ((Math.floor(x) % mSize) + mSize) % mSize;
    const py = ((Math.floor(y) % mSize) + mSize) % mSize;
    for (let tx = 0; tx < 5; tx++) {
      const sx = (px + tx) % mSize;
      sliceHeight[py * mSize + sx] -= 0.056 * (1 - tx / 5);
    }
  }

  const mSliceNormCanvas = buildTangentNormalCanvas(sliceHeight, mSize, 2.35);

  const vanillaMousseMap = makeSeamlessTexture(vColCanvas, 2.8, 2.8, true);
  const vanillaMousseBumpMap = makeSeamlessTexture(vBumpCanvas, 2.8, 2.8, false);
  const mousseSliceNormalMap = makeSeamlessTexture(mSliceNormCanvas, 2.4, 2.4, false);

  // -------------------------------------------------------------------------
  // 3. FRUIT COULIS / JELLY PULP & SUSPENDED MICRO-SEEDS (256x256 + Deep Relief Normal)
  // -------------------------------------------------------------------------
  const jSize = 256;
  const [jColCanvas, jColCtx] = createCanvas(jSize);
  const [jBumpCanvas, jBumpCtx] = createCanvas(jSize);
  const jHeight = new Float32Array(jSize * jSize);
  for (let y = 0; y < jSize; y++) {
    for (let x = 0; x < jSize; x++) {
      jHeight[y * jSize + x] = 0.50 + (periodicFbm2D(x / jSize, y / jSize, 12, 4) - 0.5) * 0.34;
    }
  }

  // Deep luminous base gradient (gives rich translucent compote depth instead of flat red brick!)
  jColCtx.fillStyle = '#E8D8DC';
  jColCtx.fillRect(0, 0, jSize, jSize);
  jBumpCtx.fillStyle = '#c8c8c8';
  jBumpCtx.fillRect(0, 0, jSize, jSize);

  const randJelly = mulberry32(61205);
  // Crushed ruby fruit pulp strata & luminous translucent juice pockets (toroidally wrapped)
  for (let i = 0; i < 620; i++) {
    const x = randJelly() * jSize;
    const y = randJelly() * jSize;
    const rx = 2.5 + randJelly() * 9.5;
    const ry = 1.6 + randJelly() * 5.2;
    const rot = randJelly() * Math.PI;
    const mode = i % 3;
    const colStyle =
      mode === 0
        ? `rgba(118, 22, 42, ${0.26 + randJelly() * 0.24})`
        : mode === 1
          ? `rgba(255, 220, 228, ${0.30 + randJelly() * 0.24})`
          : `rgba(186, 56, 78, ${0.22 + randJelly() * 0.22})`;
    const bumpStyle = mode === 0 ? 'rgba(170,170,170,0.45)' : 'rgba(240,240,240,0.45)';
    for (const ox of [-jSize, 0, jSize]) {
      for (const oy of [-jSize, 0, jSize]) {
        if (x + ox < -rx || x + ox > jSize + rx || y + oy < -rx || y + oy > jSize + rx) continue;
        jColCtx.fillStyle = colStyle;
        jColCtx.beginPath();
        jColCtx.ellipse(x + ox, y + oy, rx, ry, rot, 0, Math.PI * 2);
        jColCtx.fill();

        jBumpCtx.fillStyle = bumpStyle;
        jBumpCtx.beginPath();
        jBumpCtx.ellipse(x + ox, y + oy, rx * 0.8, ry * 0.8, rot, 0, Math.PI * 2);
        jBumpCtx.fill();
      }
    }
  }
  // Crisp suspended raspberry achene micro-seeds with golden rims & raised relief (toroidally wrapped)
  for (let i = 0; i < 440; i++) {
    const x = randJelly() * jSize;
    const y = randJelly() * jSize;
    const r = 0.90 + randJelly() * 1.30;
    const rot = randJelly() * Math.PI;
    for (const ox of [-jSize, 0, jSize]) {
      for (const oy of [-jSize, 0, jSize]) {
        const cx = x + ox;
        const cy = y + oy;
        if (cx < -r * 2 || cx > jSize + r * 2 || cy < -r * 2 || cy > jSize + r * 2) continue;
        jColCtx.fillStyle = 'rgba(224, 162, 86, 0.64)';
        jColCtx.beginPath();
        jColCtx.ellipse(cx, cy, r * 1.65, r * 1.12, rot, 0, Math.PI * 2);
        jColCtx.fill();

        jColCtx.fillStyle = 'rgba(64, 18, 12, 0.92)';
        jColCtx.beginPath();
        jColCtx.ellipse(cx, cy, r * 1.22, r * 0.78, rot, 0, Math.PI * 2);
        jColCtx.fill();

        jBumpCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        jBumpCtx.beginPath();
        jBumpCtx.arc(cx, cy, r * 1.1, 0, Math.PI * 2);
        jBumpCtx.fill();
      }
    }

    const ix = ((Math.floor(x) % jSize) + jSize) % jSize;
    const iy = ((Math.floor(y) % jSize) + jSize) % jSize;
    jHeight[iy * jSize + ix] += 0.45;
  }

  const jNormCanvas = buildTangentNormalCanvas(jHeight, jSize, 3.8);
  const jellyPulpMap = makeSeamlessTexture(jColCanvas, 2.6, 2.6, true);
  const jellyBumpMap = makeSeamlessTexture(jBumpCanvas, 2.6, 2.6, false);
  const jellyNormalMap = makeSeamlessTexture(jNormCanvas, 2.6, 2.6, false);

  // -------------------------------------------------------------------------
  // 4. FRENCH ALMOND BUTTER SABLÉ & PASTRY CRUNCH (Warm Golden Baked Crumb)
  // -------------------------------------------------------------------------
  const cSize = 512;
  const [cColCanvas, cColCtx] = createCanvas(cSize);
  const [cBumpCanvas, cBumpCtx] = createCanvas(cSize);
  const [cRoughCanvas, cRoughCtx] = createCanvas(cSize);
  const cHeight = new Float32Array(cSize * cSize);

  // 温暖奶油金法式莎布蕾饼干底色（明亮柔和，绝不发暗发灰）
  cColCtx.fillStyle = '#E6BD7B';
  cColCtx.fillRect(0, 0, cSize, cSize);
  cBumpCtx.fillStyle = '#7A7A7A';
  cBumpCtx.fillRect(0, 0, cSize, cSize);
  // 柔和微润酥松烘焙粗糙度
  cRoughCtx.fillStyle = '#9C9C9C';
  cRoughCtx.fillRect(0, 0, cSize, cSize);

  for (let y = 0; y < cSize; y++) {
    for (let x = 0; x < cSize; x++) {
      const n = periodicFbm2D(x / cSize, y / cSize, 20, 3);
      cHeight[y * cSize + x] = 0.42 + n * 0.14;
    }
  }

  const randCrunch = mulberry32(31997);
  for (let i = 0; i < 2400; i++) {
    const isFineCrumb = i >= 1600;
    const x = randCrunch() * cSize;
    const y = randCrunch() * cSize;
    const w = isFineCrumb ? 1.6 + randCrunch() * 3.0 : 4.2 + randCrunch() * 10.5;
    const h = isFineCrumb ? 1.4 + randCrunch() * 2.5 : 3.2 + randCrunch() * 6.8;
    const ang = randCrunch() * Math.PI;
    const kind = randCrunch();
    const hVal = kind > 0.72 ? 0.78 : kind > 0.34 ? 0.62 : 0.46;

    for (const ox of [-cSize, 0, cSize]) {
      for (const oy of [-cSize, 0, cSize]) {
        const cx = x + ox;
        const cy = y + oy;
        if (cx < -18 || cx > cSize + 18 || cy < -18 || cy > cSize + 18) continue;

        cColCtx.save();
        cColCtx.translate(cx, cy);
        cColCtx.rotate(ang);
        cColCtx.fillStyle =
          kind > 0.80
            ? '#FFF4DA' // 白杏仁薄片与香草奶油酥粒
            : kind > 0.45
              ? '#F3CE8D' // 暖金黄法式曲奇酥屑
              : kind > 0.18
                ? '#D7A35D' // 浅焦糖烘焙金边粒
                : '#C28946'; // 柔暖烤杏仁香气微点（不再采用泥黑色）
        cColCtx.beginPath();
        cColCtx.ellipse(0, 0, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
        cColCtx.fill();
        cColCtx.restore();

        cBumpCtx.save();
        cBumpCtx.translate(cx, cy);
        cBumpCtx.rotate(ang);
        const bv = Math.round(hVal * 255);
        cBumpCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
        cBumpCtx.beginPath();
        cBumpCtx.ellipse(0, 0, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
        cBumpCtx.fill();
        cBumpCtx.restore();

        cRoughCtx.save();
        cRoughCtx.translate(cx, cy);
        cRoughCtx.rotate(ang);
        // 柔和黄油酥饼质感：杏仁脆粒(0.54)、金黄酥屑(0.66)、润泽焦糖缝隙(0.40)
        const rv = kind > 0.72 ? 142 : kind > 0.34 ? 172 : 106;
        cRoughCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
        cRoughCtx.beginPath();
        cRoughCtx.ellipse(0, 0, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
        cRoughCtx.fill();
        cRoughCtx.restore();
      }
    }

    // Stamp soft rounded crumb into heightfield for tangent-space normal map derivation
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);
    const hw = w * 0.5;
    const hh = h * 0.5;
    const bound = Math.ceil(Math.hypot(hw, hh));
    for (let dy = -bound; dy <= bound; dy++) {
      for (let dx = -bound; dx <= bound; dx++) {
        const lx = (dx * cosA + dy * sinA) / Math.max(0.5, hw);
        const ly = (-dx * sinA + dy * cosA) / Math.max(0.5, hh);
        if (lx * lx + ly * ly <= 1.0) {
          const px = ((Math.round(x) + dx) % cSize + cSize) % cSize;
          const py = ((Math.round(y) + dy) % cSize + cSize) % cSize;
          cHeight[py * cSize + px] = hVal;
        }
      }
    }
  }

  const cNormalCanvas = buildTangentNormalCanvas(cHeight, cSize, 2.0);
  const crunchColorMap = makeSeamlessTexture(cColCanvas, 3.2, 3.2, true);
  const crunchBumpMap = makeSeamlessTexture(cBumpCanvas, 3.2, 3.2, false);
  const crunchNormalMap = makeSeamlessTexture(cNormalCanvas, 3.2, 3.2, false);
  const crunchRoughnessMap = makeSeamlessTexture(cRoughCanvas, 3.2, 3.2, false);

  // -------------------------------------------------------------------------
  // 5. RASPBERRY DRUPELET MICRO-VELVET FUZZ NORMAL MAP (128x128)
  // -------------------------------------------------------------------------
  const fSize = 128;
  const fHeight = new Float32Array(fSize * fSize);
  const randFuzz = mulberry32(55201);
  for (let i = 0; i < fSize * fSize; i++) {
    fHeight[i] = 0.5 + (randFuzz() - 0.5) * 0.35;
  }
  const fNormCanvas = buildTangentNormalCanvas(fHeight, fSize, 1.45);
  const berryFuzzNormalMap = makeSeamlessTexture(fNormCanvas, 4.0, 4.0, false);

  // -------------------------------------------------------------------------
  // 5B. WHIPPED CHANTILLY CREAM BUMP & MATTE ROUGHNESS (0.55..0.68, ZERO CLEARCOAT!)
  // -------------------------------------------------------------------------
  const chSize = 512;
  const [chBumpCanvas, chBumpCtx] = createCanvas(chSize);
  const [chRoughCanvas, chRoughCtx] = createCanvas(chSize);
  const chBumpImg = chBumpCtx.createImageData(chSize, chSize);
  const chRoughImg = chRoughCtx.createImageData(chSize, chSize);
  const randChant = mulberry32(77319);
  const chField = new Float32Array(chSize * chSize);

  for (let y = 0; y < chSize; y++) {
    const v = y / chSize;
    for (let x = 0; x < chSize; x++) {
      const u = x / chSize;
      // Fine whipped micro-aeration + gentle horizontal palette-knife sweep lines
      const microWhip = periodicFbm2D(u, v, 48, 3);
      const grainNoise = periodicFbm2D(u + 0.13, v + 0.37, 96, 2);
      const spatulaStreak =
        0.5 + 0.5 * Math.sin((v * 14.0 + periodicFbm2D(u, v, 8, 2) * 1.4) * Math.PI * 2.0);
      chField[y * chSize + x] = 0.56 + (microWhip - 0.5) * 0.26 + (grainNoise - 0.5) * 0.16 + (spatulaStreak - 0.5) * 0.14;
    }
  }
  // Tiny delicate whipped micro-air pinholes
  for (let i = 0; i < 2400; i++) {
    const cx = Math.floor(randChant() * chSize);
    const cy = Math.floor(randChant() * chSize);
    const rad = randChant() > 0.72 ? 2 : 1;
    const dip = 0.16 + randChant() * 0.18;
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (dx * dx + dy * dy > rad * rad + 0.5) continue;
        const px = ((cx + dx) % chSize + chSize) % chSize;
        const py = ((cy + dy) % chSize + chSize) % chSize;
        chField[py * chSize + px] = Math.max(0.08, chField[py * chSize + px] - dip * (1 - Math.hypot(dx, dy) / (rad + 0.8)));
      }
    }
  }
  for (let i = 0; i < chSize * chSize; i++) {
    const val = Math.max(0, Math.min(1, chField[i]));
    const bv = Math.round(val * 255);
    // Strict matte-creamy Chantilly roughness in 0.55 .. 0.68 (bytes 140 .. 174)
    const rv = Math.round((0.68 - val * 0.13) * 255);
    const p = i * 4;
    chBumpImg.data[p] = chBumpImg.data[p + 1] = chBumpImg.data[p + 2] = bv;
    chBumpImg.data[p + 3] = 255;
    chRoughImg.data[p] = chRoughImg.data[p + 1] = chRoughImg.data[p + 2] = rv;
    chRoughImg.data[p + 3] = 255;
  }
  chBumpCtx.putImageData(chBumpImg, 0, 0);
  chRoughCtx.putImageData(chRoughImg, 0, 0);
  const chantillyBumpMap = makeSeamlessTexture(chBumpCanvas, 3.0, 3.0, false);
  const chantillyRoughnessMap = makeSeamlessTexture(chRoughCanvas, 3.0, 3.0, false);

  // -------------------------------------------------------------------------
  // 5C. SEMI-NAKED SPATULA FROSTING ALPHA & COAT MAP (Revealing 3 Chiffon Tiers!)
  // -------------------------------------------------------------------------
  const snSize = 512;
  const [snColCanvas, snColCtx] = createCanvas(snSize);
  const [snAlphaCanvas, snAlphaCtx] = createCanvas(snSize);
  const snColImg = snColCtx.createImageData(snSize, snSize);
  const snAlphaImg = snAlphaCtx.createImageData(snSize, snSize);

  for (let y = 0; y < snSize; y++) {
    // Canvas y=0 is top (v=1.0 top rim), y=snSize-1 is bottom (v=0.0 cake base)
    const v = 1.0 - y / (snSize - 1);
    // Sponge tier windows around v~0.19, 0.50, 0.79 where rustic spatula scrapes clear so golden #d99b52 chiffon reads crisply!
    const band1 = Math.exp(-Math.pow((v - 0.19) / 0.095, 2.0));
    const band2 = Math.exp(-Math.pow((v - 0.50) / 0.095, 2.0));
    const band3 = Math.exp(-Math.pow((v - 0.79) / 0.095, 2.0));
    const spongePeak = Math.max(band1, Math.max(band2, band3));

    for (let x = 0; x < snSize; x++) {
      const u = x / snSize;
      // 水平顺滑转台抹刀肌理（彻底消除侧面竖条纹感！）
      const knifeNoise = periodicFbm2D(u * 0.5, v * 4.5, 4, 3);
      const horizSweep = periodicFbm2D(u * 0.35 + 0.15, v * 16.0, 6, 2);
      const topBottomCollar = Math.max(
        1.0 - THREE.MathUtils.smoothstep(v, 0.015, 0.065),
        THREE.MathUtils.smoothstep(v, 0.92, 0.98)
      );

      // Authentic French semi-naked horizontal palette-knife wipe: smooth translucent chiffon reveal
      let alpha = 0.88 - spongePeak * (0.62 + (knifeNoise - 0.5) * 0.24) + (horizSweep - 0.5) * 0.09;
      alpha = Math.max(alpha, topBottomCollar * 0.90);
      alpha *= THREE.MathUtils.smoothstep(v, 0.0, 0.012) * (1.0 - THREE.MathUtils.smoothstep(v, 0.988, 1.0));
      alpha = Math.max(0.04, Math.min(0.95, alpha));

      // Warm cream smeared with subtle golden chiffon crumb warmth along thin spatula wipes
      const crumbTint = spongePeak * (1.0 - knifeNoise * 0.7) * 0.24;
      const cr = Math.round(255 - crumbTint * 28);
      const cg = Math.round(250 - crumbTint * 74);
      const cb = Math.round(238 - crumbTint * 126);
      const av = Math.round(alpha * 255);

      const idx = (y * snSize + x) * 4;
      snColImg.data[idx] = cr;
      snColImg.data[idx + 1] = cg;
      snColImg.data[idx + 2] = cb;
      snColImg.data[idx + 3] = 255;
      snAlphaImg.data[idx] = av;
      snAlphaImg.data[idx + 1] = av;
      snAlphaImg.data[idx + 2] = av;
      snAlphaImg.data[idx + 3] = 255;
    }
  }
  snColCtx.putImageData(snColImg, 0, 0);
  snAlphaCtx.putImageData(snAlphaImg, 0, 0);
  const semiNakedCoatMap = makeSeamlessTexture(snColCanvas, 3.0, 1.0, true);
  semiNakedCoatMap.wrapT = THREE.ClampToEdgeWrapping;
  const semiNakedAlphaMap = makeSeamlessTexture(snAlphaCanvas, 3.0, 1.0, false);
  semiNakedAlphaMap.wrapT = THREE.ClampToEdgeWrapping;

  // -------------------------------------------------------------------------
  // 5D. FRESH STRAWBERRY SKIN (Dimpled Achenes) + HALVED CUT FLESH CROSS-SECTION
  // -------------------------------------------------------------------------
  const stSize = 256;
  const [stColCanvas, stColCtx] = createCanvas(stSize);
  const stHeight = new Float32Array(stSize * stSize);
  for (let y = 0; y < stSize; y++) {
    const v = y / stSize;
    for (let x = 0; x < stSize; x++) {
      const u = x / stSize;
      const skinN = periodicFbm2D(u, v, 10, 3);
      stHeight[y * stSize + x] = 0.78 + (skinN - 0.5) * 0.08;
    }
  }
  const stGrad = stColCtx.createLinearGradient(0, 0, 0, stSize);
  stGrad.addColorStop(0, '#E46A56');
  stGrad.addColorStop(0.22, '#D8343C');
  stGrad.addColorStop(0.75, '#C4242E');
  stGrad.addColorStop(1, '#A61C26');
  stColCtx.fillStyle = stGrad;
  stColCtx.fillRect(0, 0, stSize, stSize);

  // Staggered phyllotaxis achene seed dimple pockets
  const colsA = 18;
  const rowsA = 14;
  for (let r = 0; r < rowsA; r++) {
    for (let c = 0; c < colsA; c++) {
      const stagger = (r % 2) * 0.5;
      const cx = (((c + stagger) / colsA) * stSize) % stSize;
      const cy = ((r + 0.5) / rowsA) * stSize;
      const rx = 4.2;
      const ry = 5.6;
      for (let dy = -6; dy <= 6; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
          const d2 = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
          if (d2 >= 1.0) continue;
          const px = ((Math.round(cx) + dx) % stSize + stSize) % stSize;
          const py = ((Math.round(cy) + dy) % stSize + stSize) % stSize;
          const cup = (1.0 - d2) * 0.52;
          const seedBump = Math.exp(-d2 * 7.5) * 0.30;
          stHeight[py * stSize + px] = Math.max(0.05, Math.min(1.0, stHeight[py * stSize + px] - cup + seedBump));
        }
      }
      for (const ox of [-stSize, 0, stSize]) {
        const px = cx + ox;
        if (px < -10 || px > stSize + 10) continue;
        // Soft shaded dimple halo
        stColCtx.fillStyle = 'rgba(116, 16, 24, 0.42)';
        stColCtx.beginPath();
        stColCtx.ellipse(px, cy, 3.2, 4.2, 0, 0, Math.PI * 2);
        stColCtx.fill();
        // Warm golden-amber strawberry achene seed inside dimple
        stColCtx.fillStyle = '#F0CB78';
        stColCtx.beginPath();
        stColCtx.ellipse(px, cy + 0.4, 1.35, 2.0, 0, 0, Math.PI * 2);
        stColCtx.fill();
      }
    }
  }
  const stNormCanvas = buildTangentNormalCanvas(stHeight, stSize, 3.6);
  const strawberrySkinMap = makeSeamlessTexture(stColCanvas, 1.0, 1.0, true);
  strawberrySkinMap.wrapT = THREE.ClampToEdgeWrapping;
  const strawberrySeedNormalMap = makeSeamlessTexture(stNormCanvas, 1.0, 1.0, false);
  strawberrySeedNormalMap.wrapT = THREE.ClampToEdgeWrapping;

  // Halved Strawberry Cut Flesh Cross-Section (planar heart UV [0..1]x[0..1], y=0 bottom tip, y=1 top crown)
  const scSize = 256;
  const [scColCanvas, scColCtx] = createCanvas(scSize);
  const scImg = scColCtx.createImageData(scSize, scSize);
  const scHeight = new Float32Array(scSize * scSize);
  for (let y = 0; y < scSize; y++) {
    const v = 1.0 - y / (scSize - 1); // 0 = base tip, 1 = calyx top
    for (let x = 0; x < scSize; x++) {
      const u = x / (scSize - 1);
      const du = (u - 0.5) * 2.0;
      const dv = (v - 0.54) * 2.0;
      const rHeart = Math.hypot(du * (1.12 - v * 0.16), dv * 1.02);
      const ang = Math.atan2(dv, du);
      const ray = 0.5 + 0.5 * Math.sin(ang * 14.0 + Math.sin(rHeart * 9.0) * 0.8);
      const cellN = periodicFbm2D(u, v, 24, 3);

      // Outer crimson flesh -> rosy vascular ring -> creamy-ivory fibrous center pith
      const coreMask = 1.0 - THREE.MathUtils.smoothstep(rHeart, 0.14, 0.42 - ray * 0.08);
      const midRose = 1.0 - THREE.MathUtils.smoothstep(rHeart, 0.36, 0.72 + ray * 0.07);
      const edgeRim = THREE.MathUtils.smoothstep(rHeart, 0.76, 0.98);

      let cr = 216;
      let cg = 56;
      let cb = 64;
      // Mid rose flesh transition
      cr = Math.round(cr * (1 - midRose * 0.18) + 245 * (midRose * 0.18));
      cg = Math.round(cg + midRose * 74);
      cb = Math.round(cb + midRose * 72);
      // Pale creamy heart core + vascular star rays
      cr = Math.round(cr + coreMask * (252 - cr));
      cg = Math.round(cg + coreMask * (234 - cg));
      cb = Math.round(cb + coreMask * (226 - cb));
      // Deep ripe crimson outer rim
      cr = Math.round(cr * (1 - edgeRim * 0.18));
      cg = Math.round(cg * (1 - edgeRim * 0.34));
      cb = Math.round(cb * (1 - edgeRim * 0.30));
      // Natural juicy micro-variation
      const jVar = (cellN - 0.5) * 18;
      const idx = (y * scSize + x) * 4;
      scImg.data[idx] = Math.max(0, Math.min(255, cr + jVar));
      scImg.data[idx + 1] = Math.max(0, Math.min(255, cg + jVar * 0.6));
      scImg.data[idx + 2] = Math.max(0, Math.min(255, cb + jVar * 0.6));
      scImg.data[idx + 3] = 255;

      scHeight[y * scSize + x] = 0.62 - coreMask * 0.18 + ray * 0.08 + (cellN - 0.5) * 0.14;
    }
  }
  scColCtx.putImageData(scImg, 0, 0);
  const scNormCanvas = buildTangentNormalCanvas(scHeight, scSize, 2.2);
  const strawberryCutMap = makeSeamlessTexture(scColCanvas, 1.0, 1.0, true);
  strawberryCutMap.wrapS = THREE.ClampToEdgeWrapping;
  strawberryCutMap.wrapT = THREE.ClampToEdgeWrapping;
  const strawberryCutNormalMap = makeSeamlessTexture(scNormCanvas, 1.0, 1.0, false);
  strawberryCutNormalMap.wrapS = THREE.ClampToEdgeWrapping;
  strawberryCutNormalMap.wrapT = THREE.ClampToEdgeWrapping;

  // -------------------------------------------------------------------------
  // 5E. FROSTED BLUEBERRY BLOOM & FRENCH MACARON SHELL BUMP MAPS
  // -------------------------------------------------------------------------
  const bbSize = 256;
  const [bbCanvas, bbCtx] = createCanvas(bbSize);
  const bbImg = bbCtx.createImageData(bbSize, bbSize);
  for (let y = 0; y < bbSize; y++) {
    const v = y / bbSize;
    for (let x = 0; x < bbSize; x++) {
      const u = x / bbSize;
      const bloomN = periodicFbm2D(u, v, 6, 4);
      const microWax = periodicFbm2D(u + 0.3, v + 0.1, 22, 2);
      // Powdery silver-lavender natural fruit bloom across deep indigo skin
      const bloom = Math.max(0, Math.min(1, bloomN * 0.72 + microWax * 0.28 - 0.12));
      const p = (y * bbSize + x) * 4;
      bbImg.data[p] = Math.round(THREE.MathUtils.lerp(42, 166, bloom));
      bbImg.data[p + 1] = Math.round(THREE.MathUtils.lerp(52, 180, bloom));
      bbImg.data[p + 2] = Math.round(THREE.MathUtils.lerp(94, 214, bloom));
      bbImg.data[p + 3] = 255;
    }
  }
  bbCtx.putImageData(bbImg, 0, 0);
  const blueberryFrostMap = makeSeamlessTexture(bbCanvas, 1.0, 1.0, true);

  const macSize = 256;
  const [macCanvas, macCtx] = createCanvas(macSize);
  const macImg = macCtx.createImageData(macSize, macSize);
  for (let y = 0; y < macSize; y++) {
    const v = 1.0 - y / (macSize - 1);
    for (let x = 0; x < macSize; x++) {
      const u = x / macSize;
      const almondGrain = periodicFbm2D(u, v, 42, 3);
      // Lower skirt (pied, v < 0.26) gets bubbly airy lacy honeycomb bumps; dome above is finely ground smooth eggshell
      const isPied = 1.0 - THREE.MathUtils.smoothstep(v, 0.18, 0.28);
      const piedPore = periodicFbm2D(u * 2.0, v * 4.0, 28, 3);
      const h = 0.64 + (almondGrain - 0.5) * 0.14 - isPied * (piedPore > 0.52 ? 0.42 : -0.18);
      const bv = Math.max(0, Math.min(255, Math.round(h * 255)));
      const p = (y * macSize + x) * 4;
      macImg.data[p] = macImg.data[p + 1] = macImg.data[p + 2] = bv;
      macImg.data[p + 3] = 255;
    }
  }
  macCtx.putImageData(macImg, 0, 0);
  const macaronShellBumpMap = makeSeamlessTexture(macCanvas, 1.0, 1.0, false);
  macaronShellBumpMap.wrapT = THREE.ClampToEdgeWrapping;

  // -------------------------------------------------------------------------
  // 6. HONED CARRARA MARBLE FOR LAYER 8 PEDESTAL STAND (512x512)
  // -------------------------------------------------------------------------
  const marSize = 512;
  const [marColCanvas, marColCtx] = createCanvas(marSize);
  const [marRoughCanvas, marRoughCtx] = createCanvas(marSize);
  const marImg = marColCtx.createImageData(marSize, marSize);
  const marRoughImg = marRoughCtx.createImageData(marSize, marSize);

  for (let y = 0; y < marSize; y++) {
    for (let x = 0; x < marSize; x++) {
      const u = x / marSize;
      const v = y / marSize;
      const warpX = periodicFbm2D(u + 0.31, v + 0.17, 4, 4) * 1.85;
      const warpY = periodicFbm2D(u + 0.84, v + 0.52, 4, 4) * 1.85;
      const veinWave = Math.abs(Math.sin((u * 4.0 + v * 2.0 + warpX) * Math.PI));
      const primaryVein = Math.pow(Math.max(0, 1 - veinWave), 7.8);
      const secondaryWave = Math.abs(Math.sin((u * 8.0 - v * 6.0 + warpY * 1.4) * Math.PI));
      const goldVein = Math.pow(Math.max(0, 1 - secondaryWave), 15.0);
      const cloud = periodicFbm2D(u, v, 6, 3);

      const r = 250 - cloud * 7 - primaryVein * 34 - goldVein * 12;
      const g = 247 - cloud * 8 - primaryVein * 36 - goldVein * 18;
      const b = 241 - cloud * 9 - primaryVein * 35 - goldVein * 28;

      const idx = (y * marSize + x) * 4;
      marImg.data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      marImg.data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      marImg.data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      marImg.data[idx + 3] = 255;

      const rough = Math.round((0.14 + primaryVein * 0.11 + cloud * 0.05) * 255);
      marRoughImg.data[idx] = rough;
      marRoughImg.data[idx + 1] = rough;
      marRoughImg.data[idx + 2] = rough;
      marRoughImg.data[idx + 3] = 255;
    }
  }
  marColCtx.putImageData(marImg, 0, 0);
  marRoughCtx.putImageData(marRoughImg, 0, 0);

  const marbleColorMap = makeSeamlessTexture(marColCanvas, 1.5, 1.5, true);
  const marbleRoughnessMap = makeSeamlessTexture(marRoughCanvas, 1.5, 1.5, false);

  return {
    spongeColorMap,
    spongeBumpMap,
    spongeNormalMap,
    spongeRoughnessMap,
    vanillaMousseMap,
    vanillaMousseBumpMap,
    mousseSliceNormalMap,
    chantillyBumpMap,
    chantillyRoughnessMap,
    semiNakedCoatMap,
    semiNakedAlphaMap,
    jellyPulpMap,
    jellyBumpMap,
    jellyNormalMap,
    crunchColorMap,
    crunchBumpMap,
    crunchNormalMap,
    crunchRoughnessMap,
    berryFuzzNormalMap,
    strawberrySkinMap,
    strawberrySeedNormalMap,
    strawberryCutMap,
    strawberryCutNormalMap,
    blueberryFrostMap,
    macaronShellBumpMap,
    marbleColorMap,
    marbleRoughnessMap,
  };
}

export function getCakeProceduralTextures(): CakeProceduralTextures {
  if (!cachedTextures) {
    cachedTextures = generateCakeProceduralTextures();
  }
  return cachedTextures;
}

export function disposeCakeProceduralTextures(): void {
  if (!cachedTextures) return;
  Object.values(cachedTextures).forEach((tex) => tex.dispose());
  cachedTextures = null;
}
