import * as THREE from 'three';
import {
  createSeamlessLatheGeometry,
  weldLatheSeamNormals,
} from '../../geometry/patisserieGeometry';

/**
 * High-Craft Procedural PBR Textures & Studio-Grade Lathe/Extrude/Deformed Geometry Builders
 * Eliminates raw boxGeometry, low-segment cylinders, and flat plastic solid-color materials!
 */

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function drawPeriodicCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rad: number,
  w: number,
  h: number
): void {
  const oxList = x < rad ? [0, w] : x > w - rad ? [-w, 0] : [0];
  const oyList = y < rad ? [0, h] : y > h - rad ? [-h, 0] : [0];
  for (const ox of oxList) {
    for (const oy of oyList) {
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export interface PbrTextureTriplet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

/**
 * Generates crisp 512x512 French honey-oak / walnut wood grain with fine open fibers, pore flecks & satin roughness.
 */
export function createWoodGrainPbr(baseHex: string, darkHex: string, seed = 101): PbrTextureTriplet {
  const size = 512;
  const cMap = document.createElement('canvas');
  const cBump = document.createElement('canvas');
  const cRough = document.createElement('canvas');
  cMap.width = cBump.width = cRough.width = size;
  cMap.height = cBump.height = cRough.height = size;

  const ctxM = cMap.getContext('2d')!;
  const ctxB = cBump.getContext('2d')!;
  const ctxR = cRough.getContext('2d')!;
  const rand = seededRand(seed);

  ctxM.fillStyle = baseHex;
  ctxM.fillRect(0, 0, size, size);
  ctxB.fillStyle = '#808080';
  ctxB.fillRect(0, 0, size, size);
  ctxR.fillStyle = '#BCBCBC'; // ~0.74 soft matte oiled Ghibli timber when paired with roughness: 1.0
  ctxR.fillRect(0, 0, size, size);

  // High-frequency crisp longitudinal wood fiber striations (seamless vertical & horizontal wrap)
  for (let i = 0; i < 420; i++) {
    const y = rand() * size;
    const h = 0.8 + rand() * 1.9;
    const alpha = 0.08 + rand() * 0.18;
    const bVal = Math.floor(112 + (rand() - 0.5) * 54);
    const rVal = Math.floor(188 + (rand() - 0.5) * 28);
    const yOffsets = y + h > size ? [0, -size] : [0];
    for (const oy of yOffsets) {
      ctxM.fillStyle = darkHex;
      ctxM.globalAlpha = alpha;
      ctxM.fillRect(0, y + oy, size, h);

      ctxB.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
      ctxB.globalAlpha = 0.62;
      ctxB.fillRect(0, y + oy, size, Math.max(0.8, h * 0.75));

      ctxR.fillStyle = `rgb(${rVal},${rVal},${rVal})`;
      ctxR.globalAlpha = 0.55;
      ctxR.fillRect(0, y + oy, size, h);
    }
  }

  // Fine dark open medullary oak/walnut pore flecks (wrapped across X & Y tile borders for razor close-up reads)
  for (let p = 0; p < 520; p++) {
    const px = rand() * size;
    const py = rand() * size;
    const plen = 6 + rand() * 16;
    const ph = 1.0 + rand() * 0.8;
    const xOffsets = px + plen > size ? [0, -size] : [0];
    for (const ox of xOffsets) {
      ctxM.fillStyle = darkHex;
      ctxM.globalAlpha = 0.22 + rand() * 0.16;
      ctxM.fillRect(px + ox, py, plen, ph);
      ctxB.fillStyle = '#4A4A4A';
      ctxB.globalAlpha = 0.58;
      ctxB.fillRect(px + ox, py, plen, ph);
      ctxR.fillStyle = '#D2D2D2';
      ctxR.globalAlpha = 0.45;
      ctxR.fillRect(px + ox, py, plen, ph);
    }
  }

  ctxM.globalAlpha = 1;
  ctxB.globalAlpha = 1;
  ctxR.globalAlpha = 1;

  // Fine wavy cathedral growth lines (2pi horizontal period + wrapped vertical offsets)
  ctxM.strokeStyle = darkHex;
  ctxM.globalAlpha = 0.22;
  ctxM.lineWidth = 1.4;
  for (let k = 0; k < 20; k++) {
    const cy = (k / 20) * size;
    const yOffsets = cy < 16 ? [0, size] : cy > size - 16 ? [-size, 0] : [0];
    for (const oy of yOffsets) {
      ctxM.beginPath();
      for (let x = 0; x <= size; x += 16) {
        const wy = cy + oy + Math.sin((x / size) * Math.PI * 2 + k * 0.7) * 8;
        if (x === 0) ctxM.moveTo(x, wy);
        else ctxM.lineTo(x, wy);
      }
      ctxM.stroke();
    }
  }
  ctxM.globalAlpha = 1;

  const finish = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 16;
    return t;
  };
  return {
    map: finish(cMap, true),
    bumpMap: finish(cBump, false),
    roughnessMap: finish(cRough, false),
  };
}

/**
 * Generates subtle micro-orange-peel & hand-rubbed satin roughness for pastel enamel, brass & ceramic glazes.
 */
export function createMicroSurfaceMaps(
  baseRoughness = 0.42,
  variance = 0.05,
  anisotropic = false,
  seed = 303
): { bumpMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
  const size = 256;
  const cBump = document.createElement('canvas');
  const cRough = document.createElement('canvas');
  cBump.width = cRough.width = size;
  cBump.height = cRough.height = size;
  const ctxB = cBump.getContext('2d')!;
  const ctxR = cRough.getContext('2d')!;
  const rand = seededRand(seed);

  const baseR = Math.round(THREE.MathUtils.clamp(baseRoughness, 0.08, 0.95) * 255);
  ctxB.fillStyle = '#808080';
  ctxB.fillRect(0, 0, size, size);
  ctxR.fillStyle = `rgb(${baseR},${baseR},${baseR})`;
  ctxR.fillRect(0, 0, size, size);

  if (anisotropic) {
    // Fine brushed metal horizontal micro-streaks (seamless along X & periodic along Y)
    for (let i = 0; i < 420; i++) {
      const y = Math.floor(rand() * size);
      const b = Math.round(128 + (rand() - 0.5) * 38);
      const r = Math.round(THREE.MathUtils.clamp(baseR + (rand() - 0.5) * variance * 255, 22, 235));
      ctxB.fillStyle = `rgb(${b},${b},${b})`;
      ctxB.fillRect(0, y, size, 1);
      ctxR.fillStyle = `rgb(${r},${r},${r})`;
      ctxR.fillRect(0, y, size, 1);
    }
  } else {
    // Organic ceramic/enamel micro-speckle wrapped seamlessly across tile boundaries
    for (let i = 0; i < 900; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const rad = 1 + rand() * 3.2;
      const b = Math.round(128 + (rand() - 0.5) * 32);
      const r = Math.round(THREE.MathUtils.clamp(baseR + (rand() - 0.5) * variance * 255, 28, 240));
      ctxB.fillStyle = `rgba(${b},${b},${b},0.35)`;
      drawPeriodicCircle(ctxB, x, y, rad, size, size);
      ctxR.fillStyle = `rgba(${r},${r},${r},0.35)`;
      drawPeriodicCircle(ctxR, x, y, rad, size, size);
    }
  }

  const wrap = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    t.anisotropy = 8;
    return t;
  };
  return { bumpMap: wrap(cBump), roughnessMap: wrap(cRough) };
}

/**
 * Generates golden-brown laminated pastry / flour-dusted sourdough crust PBR texture!
 */
export function createBakedCrustPbr(
  lightHex = '#E5AE58',
  toastedHex = '#A85B22',
  flourDust = false,
  seed = 707
): PbrTextureTriplet {
  const size = 256;
  const cMap = document.createElement('canvas');
  const cBump = document.createElement('canvas');
  const cRough = document.createElement('canvas');
  cMap.width = cBump.width = cRough.width = size;
  cMap.height = cBump.height = cRough.height = size;
  const ctxM = cMap.getContext('2d')!;
  const ctxB = cBump.getContext('2d')!;
  const ctxR = cRough.getContext('2d')!;
  const rand = seededRand(seed);

  const grad = ctxM.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, toastedHex);
  grad.addColorStop(0.45, lightHex);
  grad.addColorStop(1, toastedHex);
  ctxM.fillStyle = grad;
  ctxM.fillRect(0, 0, size, size);

  ctxB.fillStyle = '#808080';
  ctxB.fillRect(0, 0, size, size);
  ctxR.fillStyle = flourDust ? '#DCDCDC' : '#ABABAB'; // crisp matte-flaky pastry ~0.67 / sourdough ~0.86 at roughness=1.0
  ctxR.fillRect(0, 0, size, size);

  // Baked blister pores & caramel Maillard mottling (periodic wrap X & Y)
  for (let i = 0; i < 650; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1 + rand() * 5;
    ctxM.fillStyle = i % 3 === 0 ? toastedHex : lightHex;
    ctxM.globalAlpha = 0.14;
    drawPeriodicCircle(ctxM, x, y, r, size, size);

    const bv = i % 2 === 0 ? 168 : 88;
    ctxB.fillStyle = `rgba(${bv},${bv},${bv},0.35)`;
    drawPeriodicCircle(ctxB, x, y, r * 0.7, size, size);
  }
  ctxM.globalAlpha = 1;

  if (flourDust) {
    // Artisan white rye-flour dusting speckles across top of boule (wrapped horizontally)
    for (let i = 0; i < 420; i++) {
      const x = rand() * size;
      const y = rand() * size * 0.72;
      const r = 1.2 + rand() * 4.5;
      const oxList = x < r ? [0, size] : x > size - r ? [-size, 0] : [0];
      for (const ox of oxList) {
        ctxM.fillStyle = `rgba(252, 246, 234, ${0.14 + rand() * 0.28})`;
        ctxM.beginPath();
        ctxM.arc(x + ox, y, r, 0, Math.PI * 2);
        ctxM.fill();
        ctxR.fillStyle = 'rgba(242,242,242,0.55)';
        ctxR.beginPath();
        ctxR.arc(x + ox, y, r, 0, Math.PI * 2);
        ctxR.fill();
      }
    }
  }

  const wrap = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return {
    map: wrap(cMap, true),
    bumpMap: wrap(cBump, false),
    roughnessMap: wrap(cRough, false),
  };
}

/**
 * Generates woven vintage linen / tweed cloth texture (aprons, pillows, radio speaker grille).
 */
export function createWovenFabricPbr(baseHex: string, threadHex: string, seed = 909): PbrTextureTriplet {
  const size = 256;
  const cMap = document.createElement('canvas');
  const cBump = document.createElement('canvas');
  const cRough = document.createElement('canvas');
  cMap.width = cBump.width = cRough.width = size;
  cMap.height = cBump.height = cRough.height = size;
  const ctxM = cMap.getContext('2d')!;
  const ctxB = cBump.getContext('2d')!;
  const ctxR = cRough.getContext('2d')!;
  const rand = seededRand(seed);

  ctxM.fillStyle = baseHex;
  ctxM.fillRect(0, 0, size, size);
  ctxB.fillStyle = '#787878';
  ctxB.fillRect(0, 0, size, size);
  ctxR.fillStyle = '#DCDCDC';
  ctxR.fillRect(0, 0, size, size);

  for (let p = 0; p < size; p += 4) {
    ctxM.fillStyle = threadHex;
    ctxM.globalAlpha = 0.12 + rand() * 0.12;
    ctxM.fillRect(0, p, size, 1.5);
    ctxM.fillRect(p, 0, 1.5, size);

    ctxB.fillStyle = p % 8 === 0 ? '#A8A8A8' : '#585858';
    ctxB.globalAlpha = 0.45;
    ctxB.fillRect(0, p, size, 2);
    ctxB.fillRect(p, 0, 2, size);
  }
  ctxM.globalAlpha = 1;
  ctxB.globalAlpha = 1;

  const wrap = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return {
    map: wrap(cMap, true),
    bumpMap: wrap(cBump, false),
    roughnessMap: wrap(cRough, false),
  };
}

/**
 * Generates handwritten French canister ceramic label texture ("Farine", "Sucre", "Thé") with glaze speckles!
 */
export function createCanisterCeramicTexture(label: string, bgHex: string, borderHex: string): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(label.charCodeAt(0) * 97);

  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, w, h);

  // Fine artisan stoneware speckles wrapped seamlessly along cylinder perimeter
  for (let i = 0; i < 420; i++) {
    ctx.fillStyle = `rgba(110, 86, 64, ${0.06 + rand() * 0.12})`;
    drawPeriodicCircle(ctx, rand() * w, rand() * h, 0.8 + rand() * 1.8, w, h);
  }

  // Front cartouche badge centered around u = 0.25 (facing +Z on standard cylinder UV)
  const cx = w * 0.5;
  const cy = h * 0.52;
  ctx.fillStyle = '#FFFBF0';
  ctx.strokeStyle = borderHex;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(cx - 94, cy - 42, 188, 84, 24);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#5B422E';
  ctx.font = 'bold 34px "Noto Serif SC", "Songti SC", "Microsoft YaHei", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy + 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Generates soft radial steam / mist sprite texture (eliminates hard sphere steam balls!)
 */
export function createSoftSteamSpriteTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size * 0.5, size * 0.5, 4, size * 0.5, size * 0.5, size * 0.5);
  g.addColorStop(0.0, 'rgba(255, 252, 244, 0.72)');
  g.addColorStop(0.45, 'rgba(255, 250, 240, 0.28)');
  g.addColorStop(1.0, 'rgba(255, 250, 240, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * Generates warm backlit vintage cathedral radio tuning dial texture (FM / AM scale + warm needle)
 */
export function createRadioDialTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#FFF1C6');
  g.addColorStop(1, '#F2CA78');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#5E3D22';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(16, 36);
  ctx.lineTo(w - 16, 36);
  ctx.stroke();

  for (let i = 0; i <= 16; i++) {
    const x = 20 + (i / 16) * (w - 40);
    const len = i % 4 === 0 ? 14 : 7;
    ctx.beginPath();
    ctx.moveTo(x, 36 - len);
    ctx.lineTo(x, 36);
    ctx.stroke();
  }

  // Glowing coral frequency indicator needle
  ctx.strokeStyle = '#D24838';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(148, 12);
  ctx.lineTo(148, 52);
  ctx.stroke();

  ctx.fillStyle = '#5E3D22';
  ctx.font = 'bold 11px "Noto Serif SC", "Microsoft YaHei", serif';
  ctx.textAlign = 'center';
  ctx.fillText('88   94   100   104   108 兆赫', w / 2, 54);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * High-Precision Turned Wooden French Baluster Table/Cart Leg (LatheGeometry, 24 segments!)
 */
export function createTurnedBalusterLegGeo(height: number, maxR = 0.032): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, 0),
    new THREE.Vector2(maxR * 0.72, 0),
    new THREE.Vector2(maxR * 0.76, height * 0.04),
    new THREE.Vector2(maxR * 0.58, height * 0.12),
    new THREE.Vector2(maxR * 0.68, height * 0.25),
    new THREE.Vector2(maxR * 0.92, height * 0.58),
    new THREE.Vector2(maxR * 0.74, height * 0.76),
    new THREE.Vector2(maxR * 1.0, height * 0.84),
    new THREE.Vector2(maxR * 0.88, height * 0.92),
    new THREE.Vector2(maxR * 0.98, height),
    new THREE.Vector2(0.0001, height),
  ];
  return createSeamlessLatheGeometry(pts, 32);
}

/**
 * Real Hollow Lathe Ceramic Cup / Vessel / Jug with Smooth Rolled Rim & Wall Thickness (seamless 56+ segs!)
 */
export function createHollowVesselLatheGeo(
  bottomR: number,
  bellyR: number,
  topR: number,
  height: number,
  wall = 0.006,
  segs = 48
): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, 0),
    new THREE.Vector2(bottomR, 0),
    new THREE.Vector2(bottomR * 1.04, height * 0.12),
    new THREE.Vector2(bellyR, height * 0.48),
    new THREE.Vector2(topR * 1.02, height * 0.90),
    new THREE.Vector2(topR, height),
    new THREE.Vector2(Math.max(0.002, topR - wall * 0.5), height + wall * 0.35),
    new THREE.Vector2(Math.max(0.002, topR - wall), height * 0.96),
    new THREE.Vector2(Math.max(0.002, bellyR - wall), height * 0.46),
    new THREE.Vector2(Math.max(0.002, bottomR - wall), height * 0.08),
    new THREE.Vector2(0.0001, height * 0.07),
  ];
  return createSeamlessLatheGeometry(pts, Math.max(segs, 48));
}

/**
 * Genuine Sculpted Bellied Copper Stovetop Kettle Body (Seamless LatheGeometry, 56 segments!)
 */
export function createBelliedKettleBodyGeo(radius = 0.098, height = 0.145): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, 0),
    new THREE.Vector2(radius * 0.86, 0),
    new THREE.Vector2(radius * 1.02, height * 0.24),
    new THREE.Vector2(radius * 0.96, height * 0.58),
    new THREE.Vector2(radius * 0.62, height * 0.88),
    new THREE.Vector2(radius * 0.52, height * 0.96),
    new THREE.Vector2(radius * 0.58, height),
    new THREE.Vector2(radius * 0.48, height * 1.02),
    new THREE.Vector2(0.0001, height * 0.96),
  ];
  return createSeamlessLatheGeometry(pts, 56);
}

/**
 * 3D Sinusoidal Pleated Cloth Curtain Geometry with Real Thickness (Replaces Paper-Thin planeGeometry!)
 */
export function createPleatedClothCurtainGeo(
  width: number,
  height: number,
  folds = 11,
  amp = 0.022
): THREE.BufferGeometry {
  const segX = folds * 6;
  const segY = 14;
  const g = new THREE.BoxGeometry(width, height, 0.008, segX, segY, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const u = (x / width + 0.5) * Math.PI * 2 * folds;
    const v = 0.5 - y / height; // 0 at top rod, 1 at bottom hem
    const drape = Math.sin(u) * amp * (0.35 + 0.65 * v);
    const flare = Math.sin(v * Math.PI) * 0.012;
    pos.setZ(i, z + drape + flare);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Sculpted Tapered Laminated French Butter Croissant Geometry (Replaces Pipe-Like Torus!)
 */
export function createLaminatedCroissantGeo(): THREE.BufferGeometry {
  const segU = 36;
  const segV = 18;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segU; i++) {
    const t = i / segU; // 0 -> 1 along crescent arc
    const ang = -1.25 + t * 2.50;
    const arcR = 0.056;
    const cx = Math.sin(ang) * arcR;
    const cz = Math.cos(ang) * arcR - 0.022;

    // Belly widest at center (t = 0.5), tapered to crisp tips at ends + layered pastry ridges!
    const bell = Math.sin(t * Math.PI);
    const ridge = 1.0 + 0.16 * Math.sin(t * Math.PI * 7.0) * bell;
    const rTube = (0.0055 + 0.021 * Math.pow(bell, 0.78)) * ridge;

    // Tangent along crescent
    const tx = Math.cos(ang);
    const tz = -Math.sin(ang);
    const nx = -tz;
    const nz = tx;

    for (let j = 0; j <= segV; j++) {
      const v = (j / segV) * Math.PI * 2;
      const cosV = Math.cos(v);
      const sinV = Math.sin(v);
      // Slightly flattened underside resting solidly at exact y = 0.000 (ZERO floating croissants!)
      const yScale = sinV < 0 ? 0.58 : 1.05;
      const px = cx + nx * cosV * rTube;
      const py = Math.max(0.0, sinV * rTube * yScale + rTube * 0.58);
      const pz = cz + nz * cosV * rTube;
      positions.push(px, py, pz);
      uvs.push(t * 2.0, j / segV);
    }
  }

  const row = segV + 1;
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * row + j;
      const b = a + 1;
      const c = (i + 1) * row + j + 1;
      const d = (i + 1) * row + j;
      indices.push(a, d, b, b, d, c);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/**
 * Fluted Scalloped French Tartlet Pastry Shell (Custom Sinusoidal Fluted Rim!)
 */
export function createFlutedTartShellGeo(radius = 0.042, height = 0.022): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(radius, radius * 0.80, height, 48, 3, false);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > radius * 0.55) {
      const a = Math.atan2(z, x);
      const flute = 1.0 + 0.075 * Math.sin(a * 16.0);
      pos.setX(i, x * flute);
      pos.setZ(i, z * flute);
      if (y > height * 0.35) {
        pos.setY(i, y + 0.0018 * Math.sin(a * 16.0));
      }
    }
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Artisan Scored Sourdough Boule with Organic Ear & Slight Hand-Shaped Asymmetry
 */
export function createScoredSourdoughBouleGeo(radius = 0.095): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(radius, 32, 22);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    // Flatten bottom to sit flush on linen/rack
    if (y < -radius * 0.32) {
      y = -radius * 0.32 + (y + radius * 0.32) * 0.12;
    } else {
      y *= 0.72;
    }
    // Natural hand-shaped oval + subtle diagonal baker's score ridge ("ear") across crown
    const scoreDist = Math.abs(x * 0.82 + z * 0.56);
    if (y > radius * 0.25) {
      const ear = Math.exp(-Math.pow((scoreDist - 0.012) / 0.014, 2)) * 0.011;
      const slash = Math.exp(-Math.pow(scoreDist / 0.008, 2)) * 0.008;
      y += ear - slash;
    }
    const organic = 1.0 + 0.035 * Math.sin(x * 28 + z * 19);
    pos.setXYZ(i, x * 1.12 * organic, y + radius * 0.34, z * 0.96 * organic);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Curved Open Recipe Book Geometry (Arched Left & Right Pages with Center Spine Valley!)
 */
export function createArchedOpenBookGeo(width = 0.28, height = 0.19): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(width, height, 28, 6);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const u = Math.abs(x) / (width * 0.5); // 0 at center spine, 1 at outer page edges
    const arch = Math.sin(u * Math.PI) * 0.014 + Math.min(1, u * 4) * 0.004;
    pos.setZ(i, arch);
  }
  g.computeVertexNormals();
  return g;
}


/**
 * Single-Piece Unified Glass Cloche Bell Dome with Rolled Rim & Wall Thickness (ZERO cylinder/dome gap!)
 * Bottom rim sits flush at exact y = 0.000.
 */
export function createGlassClocheBellGeo(radius = 0.148, straightH = 0.115, wall = 0.0045): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  pts.push(new THREE.Vector2(radius + 0.003, 0.0));
  pts.push(new THREE.Vector2(radius + 0.004, 0.008));
  pts.push(new THREE.Vector2(radius, 0.014));
  pts.push(new THREE.Vector2(radius * 0.97, straightH));
  const domeSteps = 14;
  for (let i = 1; i <= domeSteps; i++) {
    const a = (i / domeSteps) * (Math.PI * 0.5);
    pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a) * radius * 0.97), straightH + Math.sin(a) * radius * 0.92));
  }
  for (let i = domeSteps; i >= 1; i--) {
    const a = (i / domeSteps) * (Math.PI * 0.5);
    pts.push(
      new THREE.Vector2(
        Math.max(0.0001, Math.cos(a) * (radius * 0.97 - wall)),
        straightH + Math.sin(a) * (radius * 0.92 - wall)
      )
    );
  }
  pts.push(new THREE.Vector2(radius * 0.97 - wall, straightH));
  pts.push(new THREE.Vector2(radius - wall, 0.010));
  pts.push(new THREE.Vector2(radius + 0.003, 0.0));

  return createSeamlessLatheGeometry(pts, 56);
}

/**
 * True Hollow Fluted Bundt / Gugelhupf / Canelé Copper Bakeware Mold with Central Chimney Tube
 * Bottom sits flush at exact y = 0.000.
 */
export function createHollowFlutedBundtGeo(
  outerR = 0.106,
  chimneyR = 0.028,
  height = 0.092,
  flutes = 16
): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(chimneyR, 0.0),
    new THREE.Vector2(outerR * 0.84, 0.0),
    new THREE.Vector2(outerR * 0.98, height * 0.55),
    new THREE.Vector2(outerR, height * 0.94),
    new THREE.Vector2(outerR + 0.005, height),
    new THREE.Vector2(outerR - 0.004, height),
    new THREE.Vector2(outerR * 0.90, height * 0.48),
    new THREE.Vector2(outerR * 0.78, 0.010),
    new THREE.Vector2(chimneyR + 0.008, 0.010),
    new THREE.Vector2(chimneyR + 0.004, height * 0.95),
    new THREE.Vector2(chimneyR - 0.002, height * 0.95),
    new THREE.Vector2(chimneyR, 0.0),
  ];
  const g = new THREE.LatheGeometry(pts, 48);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > outerR * 0.65 && y > 0.006 && y < height * 0.96) {
      const a = Math.atan2(z, x);
      const flute = 1.0 + 0.068 * Math.sin(a * flutes);
      pos.setX(i, x * flute);
      pos.setZ(i, z * flute);
    }
  }
  return weldLatheSeamNormals(g, pts.length, 48);
}

/**
 * Arched Beveled Brioche Toast Slice Geometry (for Retro Smeg Toaster)
 */
export function createArchedToastSliceGeo(w = 0.125, h = 0.056, depth = 0.016): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const hw = w * 0.5;
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw, h * 0.64);
  shape.quadraticCurveTo(hw * 1.06, h, 0, h * 1.08);
  shape.quadraticCurveTo(-hw * 1.06, h, -hw, h * 0.64);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
  });
  g.translate(0, 0, -depth * 0.5);
  g.computeVertexNormals();
  return g;
}

/**
 * Procedural Soft Directional Cat Fur & Tabby/Ginger Stripe PBR Texture Set
 */
export function createCatFurPbr(
  baseHex: string,
  stripeHex: string,
  seed = 919
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const size = 256;
  const cMap = document.createElement('canvas');
  const cBump = document.createElement('canvas');
  cMap.width = cBump.width = size;
  cMap.height = cBump.height = size;
  const ctxM = cMap.getContext('2d')!;
  const ctxB = cBump.getContext('2d')!;
  const rand = seededRand(seed);

  ctxM.fillStyle = baseHex;
  ctxM.fillRect(0, 0, size, size);
  ctxB.fillStyle = '#808080';
  ctxB.fillRect(0, 0, size, size);

  ctxM.fillStyle = stripeHex;
  for (let s = 0; s < 10; s++) {
    const sy = (s / 10) * size;
    const ry = 7 + rand() * 5;
    ctxM.globalAlpha = 0.28 + rand() * 0.16;
    const oyList = sy < ry ? [0, size] : sy > size - ry ? [-size, 0] : [0];
    for (const oy of oyList) {
      ctxM.beginPath();
      ctxM.ellipse(size * 0.5, sy + oy, size * 0.58, ry, 0, 0, Math.PI * 2);
      ctxM.fill();
    }
  }
  ctxM.globalAlpha = 1;

  for (let i = 0; i < 1600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 5 + rand() * 9;
    const dx = (rand() - 0.5) * 3;
    const dxB = (rand() - 0.5) * 2.5;
    const strokeAlpha = 0.25 + rand() * 0.25;
    const bv = Math.floor(110 + rand() * 48);
    const oxList = x < 4 ? [0, size] : x > size - 4 ? [-size, 0] : [0];
    const oyList = y + len > size ? [0, -size] : [0];
    for (const ox of oxList) {
      for (const oy of oyList) {
        ctxM.strokeStyle = i % 3 === 0 ? stripeHex : baseHex;
        ctxM.globalAlpha = strokeAlpha;
        ctxM.lineWidth = 1.1;
        ctxM.beginPath();
        ctxM.moveTo(x + ox, y + oy);
        ctxM.lineTo(x + ox + dx, y + oy + len);
        ctxM.stroke();

        ctxB.strokeStyle = `rgb(${bv},${bv},${bv})`;
        ctxB.globalAlpha = 0.45;
        ctxB.lineWidth = 1.0;
        ctxB.beginPath();
        ctxB.moveTo(x + ox, y + oy);
        ctxB.lineTo(x + ox + dxB, y + oy + len);
        ctxB.stroke();
      }
    }
  }
  ctxM.globalAlpha = 1;
  ctxB.globalAlpha = 1;

  const tMap = new THREE.CanvasTexture(cMap);
  tMap.colorSpace = THREE.SRGBColorSpace;
  tMap.wrapS = tMap.wrapT = THREE.RepeatWrapping;
  tMap.anisotropy = 8;
  const tBump = new THREE.CanvasTexture(cBump);
  tBump.wrapS = tBump.wrapT = THREE.RepeatWrapping;
  tBump.anisotropy = 8;
  return { map: tMap, bumpMap: tBump };
}

/**
 * Natural Tree-Stump Concentric Growth Rings & Bark Rim Canvas Texture
 */
export function createTreeStumpTopTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const half = size * 0.5;

  ctx.fillStyle = '#523824';
  ctx.fillRect(0, 0, size, size);

  const grad = ctx.createRadialGradient(half, half, 4, half, half, half * 0.92);
  grad.addColorStop(0, '#BC8850');
  grad.addColorStop(0.55, '#D4A46A');
  grad.addColorStop(0.88, '#C89458');
  grad.addColorStop(0.95, '#68452A');
  grad.addColorStop(1, '#4A311E');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(half, half, half * 0.96, 0, Math.PI * 2);
  ctx.fill();

  for (let r = 8; r < half * 0.88; r += 6.5) {
    ctx.strokeStyle = 'rgba(110, 68, 32, 0.34)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.15) {
      const rr = r + Math.sin(a * 3 + r * 0.1) * 2.2;
      const px = half + Math.cos(a) * rr;
      const py = half + Math.sin(a) * rr;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(72, 42, 18, 0.52)';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(half, half);
  ctx.lineTo(half + half * 0.65, half + half * 0.22);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates diamond-quilted French natural cotton pastry bag PBR texture (crisp stitched seams + tactile softness).
 */
export function createQuiltedPastryBagTexture(
  baseHex = '#FBF4E5',
  stitchHex = '#C6B08E',
  seed = 812
): PbrTextureTriplet {
  const size = 256;
  const cMap = document.createElement('canvas');
  const cBump = document.createElement('canvas');
  const cRough = document.createElement('canvas');
  cMap.width = cBump.width = cRough.width = size;
  cMap.height = cBump.height = cRough.height = size;
  const ctxM = cMap.getContext('2d')!;
  const ctxB = cBump.getContext('2d')!;
  const ctxR = cRough.getContext('2d')!;
  const rand = seededRand(seed);

  ctxM.fillStyle = baseHex;
  ctxM.fillRect(0, 0, size, size);
  ctxB.fillStyle = '#929292';
  ctxB.fillRect(0, 0, size, size);
  ctxR.fillStyle = '#D4D4D4'; // ~0.83 woven matte pastry cotton at roughness=1.0
  ctxR.fillRect(0, 0, size, size);

  // Subtle woven cotton thread weave
  for (let i = 0; i < size; i += 4) {
    ctxM.fillStyle = 'rgba(190, 170, 140, 0.06)';
    ctxM.fillRect(0, i, size, 1);
    ctxM.fillRect(i, 0, 1, size);
    const bv = 136 + Math.round((rand() - 0.5) * 18);
    ctxB.fillStyle = `rgb(${bv},${bv},${bv})`;
    ctxB.fillRect(0, i, size, 1);
  }

  // Seamless 45-degree diamond quilting seams (step = 32 divides 256 cleanly)
  const step = 32;
  ctxM.strokeStyle = stitchHex;
  ctxM.lineWidth = 1.4;
  ctxB.strokeStyle = '#383838';
  ctxB.lineWidth = 3.0;
  ctxR.strokeStyle = '#ECECEC';
  ctxR.lineWidth = 2.4;

  for (let offset = -size; offset <= size * 2; offset += step) {
    for (const ctx of [ctxM, ctxB, ctxR]) {
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset + size, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(offset, size);
      ctx.lineTo(offset + size, 0);
      ctx.stroke();
    }
  }

  // Tufted stitch intersection pinpoints
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      ctxB.fillStyle = '#222222';
      drawPeriodicCircle(ctxB, x, y, 2.1, size, size);
      ctxM.fillStyle = stitchHex;
      drawPeriodicCircle(ctxM, x, y, 1.3, size, size);
    }
  }

  const finish = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return {
    map: finish(cMap, true),
    bumpMap: finish(cBump, false),
    roughnessMap: finish(cRough, false),
  };
}
