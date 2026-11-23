import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  createChamomileDaisyHeadGeometry,
  createDelphiniumSpikeGeometry,
  createLayeredLeafClusterGeometry,
  createSculptedRoseBlossomGeometry,
  createVolumetricCanopyPuffGeometry,
  getCottageCraftAssets,
} from '../environment/cottageTexturesAndFlora';
import {
  createBeveledBoxGeometry,
  createCitrusLeafGeometry,
  createMiniStrawberryGeometry,
  createStrawberryCalyxGeometry,
  createTerracottaPlanterGeometry,
} from '../../geometry/patisserieGeometry';
import { getMarblePbrSet } from '../../textures/atelierTextures';
import { CozyHanddrawnSteam, enhanceWithStylizedFresnelRim } from '../../shaders/stylizedCozyUpgrades';
import {
  enhanceWithStylizedFoliageToon,
  sampleGhibliTerrainHeight,
} from '../../shaders/ghibliStylizedPipeline';
import {
  createArchedOpenBookGeo,
  createBakedCrustPbr,
  createFlutedTartShellGeo,
  createHollowVesselLatheGeo,
  createLaminatedCroissantGeo,
  createMicroSurfaceMaps,
  createScoredSourdoughBouleGeo,
  createWoodGrainPbr,
  createWovenFabricPbr,
} from './cottageHighCraftPbr';

function applyInstancedWindSway<T extends THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial>(
  mat: T,
  windUniform: { value: number },
  opts: {
    swayAmp: number;
    freqA: number;
    freqB: number;
    tipExpr: string;
    yBob?: number;
    cacheTag: string;
  }
): T {
  const prevCompile = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|cozy-bot-wind-${opts.cacheTag}`;
  mat.onBeforeCompile = (shader, renderer) => {
    prevCompile?.(shader, renderer);
    shader.uniforms.uWindTime = windUniform;
    shader.uniforms.uWindAmp = { value: opts.swayAmp };
    const yBobLine =
      opts.yBob && opts.yBob > 0
        ? `transformed.y += windGust * ${opts.yBob.toFixed(4)} * windMask;`
        : '';
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uWindTime;
        uniform float uWindAmp;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 windSeed = position;
        #ifdef USE_INSTANCING
          windSeed = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #endif
        float windPhase = windSeed.x * 0.65 + windSeed.z * 0.52 + windSeed.y * 0.35;
        float windGust = sin(uWindTime * ${opts.freqA.toFixed(2)} + windPhase) * 0.65 + cos(uWindTime * ${opts.freqB.toFixed(2)} + windPhase * 1.7) * 0.35;
        float windMask = ${opts.tipExpr};
        float windZ = cos(uWindTime * ${(opts.freqA * 0.86).toFixed(2)} + windPhase * 1.3);
        transformed.x += windGust * uWindAmp * windMask;
        transformed.z += windZ * uWindAmp * 0.65 * windMask;
        ${yBobLine}`
      );
  };
  return mat;
}

function createChalkboardMenuTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 768;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#263129';
  ctx.fillRect(0, 0, w, h);

  // Subtle wiped-chalk botanical patina
  ctx.fillStyle = 'rgba(255, 250, 236, 0.038)';
  for (let i = 0; i < 64; i++) {
    ctx.beginPath();
    ctx.arc((i * 137) % w, (i * 193) % h, 26 + (i % 34), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(248, 236, 208, 0.78)';
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, w - 48, h - 48);
  ctx.lineWidth = 1.8;
  ctx.strokeRect(36, 36, w - 72, h - 72);

  // Corner botanical flourishes
  ctx.strokeStyle = '#C9DDA8';
  ctx.lineWidth = 2;
  [
    [48, 48, 1, 1],
    [w - 48, 48, -1, 1],
    [48, h - 48, 1, -1],
    [w - 48, h - 48, -1, -1],
  ].forEach(([cx, cy, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + 20 * sy);
    ctx.quadraticCurveTo(cx, cy, cx + 20 * sx, cy);
    ctx.stroke();
  });

  ctx.fillStyle = '#FCEAC2';
  ctx.font = 'bold 40px "PingFang SC", "Microsoft YaHei", "Noto Serif SC", "SimHei", serif';
  ctx.textAlign = 'center';
  ctx.fillText('林间花房烘焙工坊', w / 2, 110);

  ctx.fillStyle = '#E5BF78';
  ctx.font = '600 22px "PingFang SC", "Microsoft YaHei", "Noto Serif SC", sans-serif';
  ctx.fillText('· 今日手作甜品 ·', w / 2, 152);

  ctx.strokeStyle = '#E8B872';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(64, 174);
  ctx.lineTo(w - 64, 174);
  ctx.stroke();

  const items = [
    ['香草柚子挞', '当季鲜果'],
    ['森林野莓慕斯', '主厨推荐'],
    ['海盐焦糖布蕾', '慢熬流心'],
    ['黄油可颂', '晨烤金酥'],
    ['洋甘菊花茶', '庄园鲜泡'],
  ];
  items.forEach(([name, tag], i) => {
    const y = 248 + i * 86;
    ctx.fillStyle = '#E8B872';
    ctx.beginPath();
    ctx.arc(62, y - 9, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FAF2E2';
    ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(name, 80, y);

    ctx.fillStyle = '#C9E2BA';
    ctx.font = '500 20px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(tag, w - 58, y);

    if (i < items.length - 1) {
      ctx.strokeStyle = 'rgba(248, 236, 208, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(64, y + 32);
      ctx.lineTo(w - 64, y + 32);
      ctx.stroke();
    }
  });

  ctx.fillStyle = '#E8B872';
  ctx.font = 'italic 21px "PingFang SC", "Microsoft YaHei", "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.fillText('✦ 晨露鲜果 · 法式花房私宴 ✦', w / 2, 692);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createWeddingWelcomeSignTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 320;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FAF3E4';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#C69D5E';
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, w - 36, h - 36);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(26, 26, w - 52, h - 52);

  // Subtle painted botanical garland at top & bottom center
  ctx.fillStyle = '#75926A';
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.ellipse(w / 2 + i * 24, 58 + Math.abs(i) * 2.5, 9, 4, i * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#EB9BB0';
  ctx.beginPath();
  ctx.arc(w / 2, 58, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#4A3A2B';
  ctx.font = 'bold 34px "PingFang SC", "Microsoft YaHei", "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.fillText('林间草坪婚礼 · 誓约花亭', w / 2, 146);

  ctx.strokeStyle = '#C69D5E';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(96, 174);
  ctx.lineTo(w - 96, 174);
  ctx.stroke();

  ctx.fillStyle = '#7D6A54';
  ctx.font = 'italic 20px Georgia, "Times New Roman", serif';
  ctx.fillText('Jardin des Vœux · Forest Rose Ceremony', w / 2, 214);

  ctx.fillStyle = '#8F7A62';
  ctx.font = '500 18px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('诚挚邀您步入繁花誓言小径与林间夜宴', w / 2, 260);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createBanquetAwningTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const stripes = 8;
  const sw = size / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#FAF3E4' : '#859C7E';
    ctx.fillRect(i * sw, 0, sw + 1, size);
  }
  ctx.fillStyle = 'rgba(72, 54, 38, 0.06)';
  for (let y = 0; y < size; y += 4) {
    ctx.fillRect(0, y, size, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function createBotanicalPrintTexture(variant: 'cake' | 'berry' | 'lavender'): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FBF4E4';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#D8C8AA';
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, size - 28, size - 28);

  if (variant === 'cake') {
    ctx.fillStyle = '#D5A978';
    ctx.fillRect(72, 178, 112, 14);
    ctx.fillStyle = '#FFF6E6';
    ctx.beginPath();
    ctx.roundRect(76, 108, 104, 70, 14);
    ctx.fill();
    ctx.fillStyle = '#F5A5B4';
    ctx.beginPath();
    ctx.roundRect(76, 136, 104, 16, 6);
    ctx.fill();
    [98, 128, 158].forEach((bx) => {
      ctx.fillStyle = '#D83848';
      ctx.beginPath();
      ctx.arc(bx, 98, 13, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#5E8848';
    ctx.beginPath();
    ctx.ellipse(128, 84, 18, 7, -0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (variant === 'berry') {
    ctx.strokeStyle = '#5D7C46';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(64, 198);
    ctx.quadraticCurveTo(120, 136, 184, 76);
    ctx.stroke();
    [
      [104, 148],
      [146, 122],
      [166, 92],
    ].forEach(([x, y]) => {
      ctx.fillStyle = '#6A944C';
      ctx.beginPath();
      ctx.ellipse(x - 16, y - 6, 16, 9, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#DF4452';
      ctx.beginPath();
      ctx.arc(x + 8, y + 12, 14, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    for (let i = -3; i <= 3; i++) {
      ctx.strokeStyle = '#5D8248';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(128 + i * 5, 198);
      ctx.lineTo(128 + i * 16, 68 + Math.abs(i) * 8);
      ctx.stroke();
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = k % 2 === 0 ? '#987CC8' : '#B498DC';
        ctx.beginPath();
        ctx.ellipse(128 + i * (13 + k * 0.6), 72 + Math.abs(i) * 8 + k * 12, 6, 4, 0.2 * i, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#E89284';
    ctx.fillRect(108, 162, 40, 10);
  }

  ctx.fillStyle = '#7E6448';
  ctx.font = '600 17px "Noto Serif SC", "Songti SC", "Microsoft YaHei", serif';
  ctx.textAlign = 'center';
  ctx.fillText(variant === 'cake' ? '草莓奶油蛋糕' : variant === 'berry' ? '林间野莓' : '薰衣草花束', 128, 224);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createOpenRecipeBookTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 192;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FDF6E6';
  ctx.fillRect(0, 0, w, h);
  const spineGrad = ctx.createLinearGradient(w * 0.44, 0, w * 0.56, 0);
  spineGrad.addColorStop(0, 'rgba(130, 96, 62, 0.0)');
  spineGrad.addColorStop(0.5, 'rgba(110, 78, 48, 0.24)');
  spineGrad.addColorStop(1, 'rgba(130, 96, 62, 0.0)');
  ctx.fillStyle = spineGrad;
  ctx.fillRect(w * 0.44, 0, w * 0.12, h);

  ctx.fillStyle = '#F6C2C8';
  ctx.beginPath();
  ctx.arc(64, 78, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7A5E42';
  ctx.font = 'bold 14px "Noto Serif SC", "Songti SC", "Microsoft YaHei", serif';
  ctx.textAlign = 'center';
  ctx.fillText('七号手作食谱', 64, 34);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = 'rgba(100, 76, 52, 0.45)';
    ctx.fillRect(24, 126 + i * 12, 80, 4);
  }

  ctx.fillStyle = '#7A5E42';
  ctx.fillText('精选原料', 192, 34);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = 'rgba(100, 76, 52, 0.40)';
    ctx.fillRect(146, 50 + i * 14, 88 - (i % 3) * 14, 4);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Custom Shaped Quilted Oven Mitt with Thumb Silhouette (Replaces Rectangular Box!)
 */
function createShapedOvenMittGeo(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.045, 0.10);
  s.lineTo(0.045, 0.10);
  s.lineTo(0.052, -0.02);
  s.quadraticCurveTo(0.088, -0.02, 0.086, -0.065);
  s.quadraticCurveTo(0.075, -0.09, 0.048, -0.08);
  s.lineTo(0.046, -0.105);
  s.quadraticCurveTo(0.0, -0.135, -0.052, -0.105);
  s.lineTo(-0.052, 0.08);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.006,
    bevelSegments: 3,
    curveSegments: 12,
  });
  g.center();
  g.computeVertexNormals();
  return g;
}

/**
 * Custom Contoured Draped Linen Baker's Apron with Bib & Pleat Wave (Replaces Flat Box!)
 */
function createDrapedApronGeo(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.068, 0.21);
  s.lineTo(0.068, 0.21);
  s.quadraticCurveTo(0.078, 0.09, 0.125, 0.06);
  s.lineTo(0.138, -0.20);
  s.quadraticCurveTo(0.0, -0.225, -0.138, -0.20);
  s.lineTo(-0.125, 0.06);
  s.quadraticCurveTo(-0.078, 0.09, -0.068, 0.21);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.004,
    bevelSegments: 3,
    curveSegments: 12,
  });
  g.center();
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const drape = Math.sin(x * 34) * 0.009 * Math.max(0, 0.5 - y / 0.42);
    pos.setZ(i, z + drape);
  }
  g.computeVertexNormals();
  return g;
}

function buildFrenchChairFrameGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const nonIdx = g.index ? g.toNonIndexed() : g.clone();
    nonIdx.deleteAttribute('color');
    const posAttr = nonIdx.attributes.position;
    if (!nonIdx.attributes.uv) {
      nonIdx.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(posAttr.count * 2), 2));
    }
    if (rx || ry || rz) {
      nonIdx.rotateX(rx);
      nonIdx.rotateY(ry);
      nonIdx.rotateZ(rz);
    }
    nonIdx.translate(x, y, z);
    parts.push(nonIdx);
    g.dispose();
  };

  // 4 Tapered fluted French legs (feet grounded strictly at y = 0.000 up to seat rail y = 0.43)
  [
    [-0.175, -0.175, 0.03],
    [0.175, -0.175, -0.03],
    [-0.17, 0.17, 0.04],
    [0.17, 0.17, -0.04],
  ].forEach(([lx, lz, splay]) => {
    add(new THREE.CylinderGeometry(0.019, 0.012, 0.44, 10), lx, 0.22, lz, 0, 0, splay);
  });

  // Molded oval seat frame apron
  add(createBeveledBoxGeometry(0.41, 0.044, 0.40, 0.04, 0.008, 0.008, 2), 0, 0.435, 0);

  // Two backrest stiles connecting seat back (-Z = -0.185) up to medallion frame (y = 0.56)
  [-0.145, 0.145].forEach((sx) => {
    add(new THREE.CylinderGeometry(0.014, 0.016, 0.20, 8), sx, 0.52, -0.185, -0.08, 0, 0);
  });

  // Carved oval Louis XVI medallion backrest hoop (centered y = 0.75, z = -0.195)
  const hoop = new THREE.TorusGeometry(0.18, 0.017, 10, 28);
  hoop.scale(1.02, 1.24, 0.72);
  add(hoop, 0, 0.755, -0.195);

  // Subtle carved crest finial at top center of backrest
  add(new THREE.SphereGeometry(0.022, 10, 8), 0, 0.99, -0.195);

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

function buildSheerOrganzaPillarDrapeGeo(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = 0.02 + t * 2.18;
    const pinch = Math.exp(-Math.pow((t - 0.44) / 0.16, 2));
    const r = 0.175 - pinch * 0.082 + Math.sin(t * Math.PI) * 0.018;
    pts.push(new THREE.Vector2(r, y));
  }
  const g = new THREE.LatheGeometry(pts, 28);
  g.computeVertexNormals();
  return g;
}

/** 生成普罗旺斯暖色复古拼花地砖贴图（512×512：暖陶赤红 × 奶油米白 × 浅鼠尾草绿几何拼花） */
function createProvenceMosaicTileTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#E8DBC4';
  ctx.fillRect(0, 0, size, size);

  const cells = 8;
  const step = size / cells;
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const x = c * step;
      const y = r * step;
      const isWarm = (r + c) % 2 === 0;
      // 暖陶赤红与温润奶油米白交错底砖
      ctx.fillStyle = isWarm ? '#D99372' : '#F6ECD8';
      ctx.fillRect(x + 2, y + 2, step - 4, step - 4);

      // 砖内精致法式菱形/四叶花嵌饰
      ctx.save();
      ctx.translate(x + step * 0.5, y + step * 0.5);
      ctx.fillStyle = isWarm ? '#F7EBD6' : '#C97B59';
      ctx.beginPath();
      ctx.moveTo(0, -step * 0.24);
      ctx.lineTo(step * 0.24, 0);
      ctx.lineTo(0, step * 0.24);
      ctx.lineTo(-step * 0.24, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = isWarm ? '#8EA480' : '#E3B46C';
      ctx.beginPath();
      ctx.arc(0, 0, step * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 细腻暖灰砖缝
      ctx.strokeStyle = 'rgba(132, 108, 86, 0.42)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, step - 2, step - 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.4, 2.4);
  tex.anisotropy = 8;
  return tex;
}

const WeddingAndBanquetShowcase: React.FC<{
  creamPaintMat: THREE.Material;
  honeyOakMat: THREE.Material;
  linenCreamMat: THREE.Material;
  brassMat: THREE.Material;
  berryRedMat: THREE.Material;
  glassJarMat: THREE.Material;
  roseGeo: THREE.BufferGeometry;
  strawberryGeo: THREE.BufferGeometry;
  calyxGeo: THREE.BufferGeometry;
}> = ({
  creamPaintMat,
  honeyOakMat,
  linenCreamMat,
  brassMat,
  berryRedMat,
  glassJarMat,
  roseGeo,
  strawberryGeo,
  calyxGeo,
}) => {
  const craftAssets = useMemo(() => getCottageCraftAssets(), []);
  const marblePbr = useMemo(() => getMarblePbrSet(1.2, 0.8), []);
  const chairFrameInstRef = useRef<THREE.InstancedMesh>(null);
  const chairCushionInstRef = useRef<THREE.InstancedMesh>(null);
  const chairBackPadInstRef = useRef<THREE.InstancedMesh>(null);
  const chairSashInstRef = useRef<THREE.InstancedMesh>(null);
  const aislePetalInstRef = useRef<THREE.InstancedMesh>(null);
  const banquetFestoonBulbInstRef = useRef<THREE.InstancedMesh>(null);

  const showcase = useMemo(() => {
    const weddingSignTex = createWeddingWelcomeSignTexture();
    const awningTex = createBanquetAwningTexture();
    const gazeboTileTex = createProvenceMosaicTileTexture();
    const delphiniumGeo = createDelphiniumSpikeGeometry();
    const foliageClusterGeo = createLayeredLeafClusterGeometry(7);
    const urnGeo = createTerracottaPlanterGeometry(0.24, 0.13, 0.36);

    // 白色花亭立柱密集螺旋攀援月季花藤几何（绕柱攀爬 2.6 圈，从柱脚浪漫缠绕至亭檐！）
    const vineCtrlPts: THREE.Vector3[] = [];
    const vineAnchors: Array<{ pos: [number, number, number]; ang: number; isPink: boolean; sc: number }> = [];
    const turns = 2.6;
    const vineSteps = 26;
    for (let k = 0; k <= vineSteps; k++) {
      const t = k / vineSteps;
      const a = t * turns * Math.PI * 2;
      const rad = 0.098 + Math.sin(t * Math.PI * 4) * 0.008;
      const vy = 0.08 + t * 2.16;
      const vx = Math.cos(a) * rad;
      const vz = Math.sin(a) * rad;
      vineCtrlPts.push(new THREE.Vector3(vx, vy, vz));
      if (k > 0 && k < vineSteps && k % 2 === 0) {
        vineAnchors.push({
          pos: [vx * 1.12, vy, vz * 1.12],
          ang: a,
          isPink: k % 4 !== 0,
          sc: 1.18 + (k % 3) * 0.24,
        });
      }
    }
    const pillarVineCurve = new THREE.CatmullRomCurve3(vineCtrlPts);
    const pillarVineTubeGeo = new THREE.TubeGeometry(pillarVineCurve, 44, 0.011, 7, false);
    const pillarVineWoodMat = new THREE.MeshStandardMaterial({ color: '#4E6B3C', roughness: 0.86 });
    const gazeboTileMat = new THREE.MeshStandardMaterial({
      map: gazeboTileTex,
      roughness: 0.78,
      metalness: 0.02,
    });

    const chairFrameGeo = buildFrenchChairFrameGeometry();
    const chairCushionGeo = createBeveledBoxGeometry(0.37, 0.044, 0.36, 0.04, 0.014, 0.014, 2);
    const chairBackPadGeo = new THREE.CylinderGeometry(0.145, 0.145, 0.024, 22);
    chairBackPadGeo.rotateX(Math.PI / 2);
    chairBackPadGeo.scale(1.0, 1.24, 1.0);
    const chairSashGeo = createBeveledBoxGeometry(0.32, 0.095, 0.044, 0.014, 0.008, 0.008, 2);

    const organzaDrapeGeo = buildSheerOrganzaPillarDrapeGeo();
    const petalGeo = new THREE.CircleGeometry(0.030, 8);
    petalGeo.rotateX(-Math.PI / 2);

    const tableClothGeo = createBeveledBoxGeometry(0.92, 0.75, 2.74, 0.036, 0.012, 0.012, 2);
    const banquetRugGeo = createBeveledBoxGeometry(4.75, 0.016, 4.35, 0.06, 0.006, 0.006, 2);

    const strandPairs: Array<[[number, number, number], [number, number, number]]> = [
      [[-2.22, 2.86, -1.85], [2.22, 2.86, 2.25]],
      [[2.22, 2.86, -1.85], [-2.22, 2.86, 2.25]],
      [[-2.22, 2.86, -1.85], [2.22, 2.86, -1.85]],
      [[-2.22, 2.86, 2.25], [2.22, 2.86, 2.25]],
      [[-2.22, 2.86, -1.85], [-2.22, 2.86, 2.25]],
      [[2.22, 2.86, -1.85], [2.22, 2.86, 2.25]],
    ];
    const festoonCableGeos: THREE.BufferGeometry[] = [];
    const festoonBulbPts: THREE.Vector3[] = [];
    strandPairs.forEach(([s, e]) => {
      const vs = new THREE.Vector3(...s);
      const ve = new THREE.Vector3(...e);
      const ctrl: THREE.Vector3[] = [];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        const p = new THREE.Vector3().lerpVectors(vs, ve, t);
        p.y -= Math.sin(t * Math.PI) * 0.34;
        ctrl.push(p);
      }
      const crv = new THREE.CatmullRomCurve3(ctrl);
      festoonCableGeos.push(new THREE.TubeGeometry(crv, 22, 0.0065, 6, false));
      for (let b = 1; b <= 7; b++) {
        festoonBulbPts.push(crv.getPointAt(b / 8));
      }
    });

    const marbleAltarMat = new THREE.MeshPhysicalMaterial({
      map: marblePbr.map,
      normalMap: marblePbr.normalMap,
      roughnessMap: marblePbr.roughnessMap,
      color: '#FAF6EE',
      roughness: 1.0,
      clearcoat: 0.14,
      clearcoatRoughness: 0.36,
      envMapIntensity: 0.36,
    });
    const sheerOrganzaMat = new THREE.MeshPhysicalMaterial({
      color: '#FFFDF8',
      transparent: true,
      opacity: 0.62,
      roughness: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const blushSatinMat = new THREE.MeshPhysicalMaterial({
      color: '#EBC2CA',
      roughness: 0.36,
      sheen: 0.75,
      sheenColor: new THREE.Color('#FFF2F4'),
    });
    const ivoryLinenMat = new THREE.MeshStandardMaterial({
      map: craftAssets.cottageRunnerTex,
      color: '#FAF4E8',
      roughness: 0.88,
    });
    const awningMat = new THREE.MeshStandardMaterial({
      map: awningTex,
      roughness: 0.84,
      side: THREE.DoubleSide,
    });
    const candleFlameMat = new THREE.MeshStandardMaterial({
      color: '#FFF6D6',
      emissive: '#FFAA36',
      emissiveIntensity: 1.85,
      roughness: 0.28,
    });

    return {
      weddingSignTex,
      awningTex,
      gazeboTileTex,
      gazeboTileMat,
      pillarVineTubeGeo,
      pillarVineWoodMat,
      vineAnchors,
      delphiniumGeo,
      foliageClusterGeo,
      urnGeo,
      chairFrameGeo,
      chairCushionGeo,
      chairBackPadGeo,
      chairSashGeo,
      organzaDrapeGeo,
      petalGeo,
      tableClothGeo,
      banquetRugGeo,
      festoonCableGeos,
      festoonBulbPts,
      marbleAltarMat,
      sheerOrganzaMat,
      blushSatinMat,
      ivoryLinenMat,
      awningMat,
      candleFlameMat,
    };
  }, [craftAssets, marblePbr]);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    // 1. 仪式长廊 16 把法式椅：逐把贴合实际山坡地形高度 sampleGhibliTerrainHeight，彻底消灭活埋成墓碑！
    const chairTransforms: Array<{ x: number; y: number; z: number; ry: number; sashHex: number }> = [];
    const rowZs = [15.28, 16.18, 17.08, 17.98];
    rowZs.forEach((rz) => {
      [-0.68, -1.32].forEach((lx) => {
        chairTransforms.push({ x: lx, y: sampleGhibliTerrainHeight(lx, rz) + 0.015, z: rz, ry: Math.PI * 0.44, sashHex: 0xf4ced6 });
      });
      [1.84, 2.48].forEach((rx) => {
        chairTransforms.push({ x: rx, y: sampleGhibliTerrainHeight(rx, rz) + 0.015, z: rz, ry: -Math.PI * 0.44, sashHex: 0xf4ced6 });
      });
    });

    // 2. 户外宴会草坪 12 把座椅：整体坐落于水平石砌方台（banquetTerraceY）之上，彻底零倾斜、零土埋！
    const banquetTerraceY = Math.max(
      sampleGhibliTerrainHeight(8.2, 17.8),
      sampleGhibliTerrainHeight(6.8, 16.0),
      sampleGhibliTerrainHeight(9.6, 19.6)
    ) + 0.08;
    const bCenter = new THREE.Vector3(8.2, banquetTerraceY + 0.016, 17.8);
    const bRot = -0.18;
    const cosB = Math.cos(bRot);
    const sinB = Math.sin(bRot);
    const tableLocalXs = [-1.06, 1.06];
    const seatZs = [-0.62, 0.22, 1.06];
    tableLocalXs.forEach((tx) => {
      seatZs.forEach((sz, si) => {
        const lx = tx - 0.58;
        const wxL = bCenter.x + lx * cosB + sz * sinB;
        const wzL = bCenter.z - lx * sinB + sz * cosB;
        chairTransforms.push({
          x: wxL,
          y: bCenter.y,
          z: wzL,
          ry: Math.PI * 0.5 + bRot,
          sashHex: si % 2 === 0 ? 0xedd8c0 : 0xf4ced6,
        });
        const rx = tx + 0.58;
        const wxR = bCenter.x + rx * cosB + sz * sinB;
        const wzR = bCenter.z - rx * sinB + sz * cosB;
        chairTransforms.push({
          x: wxR,
          y: bCenter.y,
          z: wzR,
          ry: -Math.PI * 0.5 + bRot,
          sashHex: si % 2 === 0 ? 0xf4ced6 : 0xedd8c0,
        });
      });
    });

    const fInst = chairFrameInstRef.current;
    const cInst = chairCushionInstRef.current;
    const bInst = chairBackPadInstRef.current;
    const sInst = chairSashInstRef.current;
    if (fInst && cInst && bInst && sInst) {
      chairTransforms.forEach((ch, idx) => {
        dummy.position.set(ch.x, ch.y, ch.z);
        dummy.rotation.set(0, ch.ry, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        fInst.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(ch.x, ch.y + 0.468, ch.z);
        dummy.updateMatrix();
        cInst.setMatrixAt(idx, dummy.matrix);

        const bx = ch.x - Math.sin(ch.ry) * 0.195;
        const bz = ch.z - Math.cos(ch.ry) * 0.195;
        dummy.position.set(bx, ch.y + 0.755, bz);
        dummy.updateMatrix();
        bInst.setMatrixAt(idx, dummy.matrix);

        const sx = ch.x - Math.sin(ch.ry) * 0.215;
        const sz = ch.z - Math.cos(ch.ry) * 0.215;
        dummy.position.set(sx, ch.y + 0.675, sz);
        dummy.updateMatrix();
        sInst.setMatrixAt(idx, dummy.matrix);
        color.setHex(ch.sashHex);
        sInst.setColorAt(idx, color);
      });
      fInst.instanceMatrix.needsUpdate = true;
      cInst.instanceMatrix.needsUpdate = true;
      bInst.instanceMatrix.needsUpdate = true;
      sInst.instanceMatrix.needsUpdate = true;
      if (sInst.instanceColor) sInst.instanceColor.needsUpdate = true;
    }

    const pInst = aislePetalInstRef.current;
    if (pInst) {
      const petalHex = [0xf6b2c6, 0xfdf2e4, 0xf290aa, 0xfad2dc];
      for (let i = 0; i < 72; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const t = Math.floor(i / 2) / 36;
        const pz = 14.42 + t * 4.65;
        const px = 0.58 + side * (0.48 + ((i * 37) % 10) * 0.015);
        dummy.position.set(px, sampleGhibliTerrainHeight(px, pz) + 0.018, pz);
        dummy.rotation.set(0, (i * 1.37) % (Math.PI * 2), 0);
        dummy.scale.set(0.95 + (i % 3) * 0.25, 1, 0.72 + (i % 2) * 0.25);
        dummy.updateMatrix();
        pInst.setMatrixAt(i, dummy.matrix);
        color.setHex(petalHex[i % petalHex.length]);
        pInst.setColorAt(i, color);
      }
      pInst.instanceMatrix.needsUpdate = true;
      if (pInst.instanceColor) pInst.instanceColor.needsUpdate = true;
    }

    const fbInst = banquetFestoonBulbInstRef.current;
    if (fbInst) {
      showcase.festoonBulbPts.forEach((bp, idx) => {
        dummy.position.set(bp.x, bp.y - 0.045, bp.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        fbInst.setMatrixAt(idx, dummy.matrix);
      });
      fbInst.instanceMatrix.needsUpdate = true;
    }
  }, [showcase]);

  useEffect(() => {
    return () => {
      showcase.weddingSignTex.dispose();
      showcase.awningTex.dispose();
      showcase.gazeboTileTex.dispose();
      showcase.gazeboTileMat.dispose();
      showcase.pillarVineTubeGeo.dispose();
      showcase.pillarVineWoodMat.dispose();
      showcase.delphiniumGeo.dispose();
      showcase.foliageClusterGeo.dispose();
      showcase.urnGeo.dispose();
      showcase.chairFrameGeo.dispose();
      showcase.chairCushionGeo.dispose();
      showcase.chairBackPadGeo.dispose();
      showcase.chairSashGeo.dispose();
      showcase.organzaDrapeGeo.dispose();
      showcase.petalGeo.dispose();
      showcase.tableClothGeo.dispose();
      showcase.banquetRugGeo.dispose();
      showcase.festoonCableGeos.forEach((g) => g.dispose());
      showcase.marbleAltarMat.dispose();
      showcase.sheerOrganzaMat.dispose();
      showcase.blushSatinMat.dispose();
      showcase.ivoryLinenMat.dispose();
      showcase.awningMat.dispose();
      showcase.candleFlameMat.dispose();
    };
  }, [showcase]);

  const innerAisleChairCoords: Array<{ x: number; y: number; z: number; side: number }> = [];
  [15.28, 16.18, 17.08, 17.98].forEach((rz) => {
    innerAisleChairCoords.push({ x: -0.44, y: sampleGhibliTerrainHeight(-0.44, rz) + 0.65, z: rz, side: 1 });
    innerAisleChairCoords.push({ x: 1.60, y: sampleGhibliTerrainHeight(1.60, rz) + 0.65, z: rz, side: -1 });
  });

  const gazeboTerrainY = sampleGhibliTerrainHeight(0.58, 21.15) - 0.04;
  const archTerrainY = sampleGhibliTerrainHeight(0.58, 14.32);
  const welcomeSignY = sampleGhibliTerrainHeight(-1.05, 13.72);
  const banquetTerraceY = Math.max(
    sampleGhibliTerrainHeight(8.2, 17.8),
    sampleGhibliTerrainHeight(6.8, 16.0),
    sampleGhibliTerrainHeight(9.6, 19.6)
  ) + 0.08;

  return (
    <group>
      {/* 1. UPGRADED BRIDAL ROSE PAVILION GAZEBO (严格对齐坡顶高度并向下加厚石台裙边防止一侧露缝！) */}
      <group position={[0.58, gazeboTerrainY, 21.15]}>
        <mesh position={[0, -0.04, 0]} receiveShadow>
          <cylinderGeometry args={[1.92, 2.18, 0.56, 8]} />
          <meshStandardMaterial map={craftAssets.rubbleStone.map} color="#C8BFA8" roughness={0.88} />
        </mesh>
        <mesh position={[0, 0.28, 0]} receiveShadow>
          <cylinderGeometry args={[1.72, 1.80, 0.10, 8]} />
          <meshStandardMaterial color="#DFD6C2" roughness={0.82} />
        </mesh>
        {/* 白色花亭内部暖色普罗旺斯复古拼花地砖（暖陶红 × 奶油米白八角拼花！） */}
        <mesh position={[0, 0.333, 0]} rotation={[-Math.PI / 2, Math.PI / 8, 0]} material={showcase.gazeboTileMat} receiveShadow>
          <circleGeometry args={[1.66, 8]} />
        </mesh>
        <mesh position={[0, 0.10, -1.96]} receiveShadow>
          <boxGeometry args={[1.28, 0.20, 0.46]} />
          <meshStandardMaterial map={craftAssets.rubbleStone.map} color="#CFC6B2" roughness={0.86} />
        </mesh>

        {Array.from({ length: 6 }).map((_, ci) => {
          const ang = (ci / 6) * Math.PI * 2;
          const cx = Math.cos(ang) * 1.48;
          const cz = Math.sin(ang) * 1.48;
          return (
            <group key={`gz-col-${ci}`} position={[cx, 0.33, cz]} rotation={[0, -ang, 0]}>
              <mesh position={[0, 0.08, 0]} material={creamPaintMat}>
                <cylinderGeometry args={[0.105, 0.125, 0.16, 16]} />
              </mesh>
              <mesh position={[0, 1.18, 0]} material={creamPaintMat} castShadow>
                <cylinderGeometry args={[0.072, 0.084, 2.18, 18]} />
              </mesh>
              <mesh position={[0, 2.28, 0]} material={creamPaintMat}>
                <cylinderGeometry args={[0.12, 0.082, 0.12, 16]} />
              </mesh>
              <mesh position={[0, 0.10, 0]} geometry={showcase.organzaDrapeGeo} material={showcase.sheerOrganzaMat} />
              <mesh position={[0, 1.06, 0]} rotation={[Math.PI / 2, 0, 0]} material={showcase.blushSatinMat}>
                <torusGeometry args={[0.095, 0.020, 8, 20]} />
              </mesh>
              {/* 密集螺旋缠绕花亭立柱的粉色攀援月季花藤与繁密绿叶花朵！ */}
              <mesh
                rotation={[0, ci * 1.05, 0]}
                geometry={showcase.pillarVineTubeGeo}
                material={showcase.pillarVineWoodMat}
                castShadow
              />
              <group rotation={[0, ci * 1.05, 0]}>
                {showcase.vineAnchors.map((va, vi) => (
                  <group key={`pvine-${vi}`} position={va.pos} rotation={[0, -va.ang, 0]}>
                    <mesh scale={va.sc * 0.92} geometry={showcase.foliageClusterGeo} castShadow>
                      <meshStandardMaterial vertexColors roughness={0.78} side={THREE.DoubleSide} />
                    </mesh>
                    <mesh
                      position={[0.03, 0.02, 0]}
                      rotation={[0.35, vi * 1.3, 0.2]}
                      scale={va.sc * 1.12}
                      geometry={roseGeo}
                    >
                      <meshStandardMaterial
                        color={va.isPink ? (vi % 3 === 0 ? '#EC82A2' : '#F5A6BC') : '#FDF2DE'}
                        vertexColors
                        roughness={0.72}
                        side={THREE.DoubleSide}
                      />
                    </mesh>
                  </group>
                ))}
              </group>
            </group>
          );
        })}

        <mesh position={[0, 2.66, 0]} material={creamPaintMat} castShadow>
          <cylinderGeometry args={[1.66, 1.62, 0.18, 12]} />
        </mesh>
        <mesh position={[0, 3.24, 0]} castShadow>
          <coneGeometry args={[1.92, 1.04, 8]} />
          <meshStandardMaterial color="#7B9372" roughness={0.76} />
        </mesh>
        <mesh position={[0, 3.84, 0]} material={brassMat}>
          <cylinderGeometry args={[0.018, 0.032, 0.34, 12]} />
        </mesh>
        <mesh position={[0, 4.02, 0]} material={brassMat}>
          <sphereGeometry args={[0.072, 14, 12]} />
        </mesh>

        {/* Hanging Rose-and-Wisteria Floral Chandelier + Glowing Sanctuary Lantern */}
        <group position={[0, 2.38, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={brassMat}>
            <torusGeometry args={[0.62, 0.014, 10, 28]} />
          </mesh>
          {Array.from({ length: 6 }).map((_, ri) => {
            const ra = (ri / 6) * Math.PI * 2;
            const rx = Math.cos(ra) * 0.62;
            const rz = Math.sin(ra) * 0.62;
            return (
              <group key={`gch-${ri}`} position={[rx, -0.02, rz]} rotation={[0, -ra, 0]}>
                <mesh scale={1.45} geometry={showcase.foliageClusterGeo}>
                  <meshStandardMaterial vertexColors roughness={0.76} side={THREE.DoubleSide} />
                </mesh>
                <mesh position={[0, -0.02, 0.02]} rotation={[0.4, ri, 0]} scale={1.55} geometry={roseGeo}>
                  <meshStandardMaterial color={ri % 2 === 0 ? '#F4A2B8' : '#FAF2E0'} vertexColors roughness={0.74} side={THREE.DoubleSide} />
                </mesh>
                <mesh position={[0, -0.10, 0]} rotation={[Math.PI, 0, 0]} scale={[0.72, 0.56, 0.72]} geometry={showcase.delphiniumGeo}>
                  <meshStandardMaterial color="#DFCFF8" vertexColors roughness={0.72} side={THREE.DoubleSide} />
                </mesh>
              </group>
            );
          })}
          <mesh position={[0, 0.14, 0]} material={brassMat}>
            <cylinderGeometry args={[0.010, 0.010, 0.32, 8]} />
          </mesh>
          <mesh position={[0, -0.10, 0]}>
            <cylinderGeometry args={[0.10, 0.08, 0.22, 10]} />
            <meshStandardMaterial color="#FFF3CC" emissive="#FFA838" emissiveIntensity={1.65} roughness={0.32} />
          </mesh>
        </group>

        {/* Central Oak & Marble Wedding Ceremony Altar Podium + Twin Brass Candelabras & Bridal Spray */}
        <group position={[0, 0.33, 0.14]}>
          <mesh position={[0, 0.42, 0]} material={creamPaintMat} castShadow receiveShadow>
            <boxGeometry args={[0.84, 0.84, 0.48]} />
          </mesh>
          <mesh position={[0, 0.865, 0]} material={showcase.marbleAltarMat} castShadow receiveShadow>
            <boxGeometry args={[0.92, 0.05, 0.54]} />
          </mesh>
          <mesh position={[0, 0.44, -0.245]} material={brassMat}>
            <torusGeometry args={[0.14, 0.012, 8, 24]} />
          </mesh>
          <group position={[0, 0.90, -0.06]}>
            <mesh scale={[2.1, 1.4, 1.7]} geometry={showcase.foliageClusterGeo}>
              <meshStandardMaterial vertexColors roughness={0.78} side={THREE.DoubleSide} />
            </mesh>
            {[
              [-0.14, 0.08, 0.04, '#F29EB4', 1.55],
              [0.0, 0.11, -0.02, '#FAF2E0', 1.72],
              [0.14, 0.08, 0.03, '#F29EB4', 1.50],
            ].map(([fx, fy, fz, fc, fs], fi) => (
              <mesh key={`arose-${fi}`} position={[fx as number, fy as number, fz as number]} scale={fs as number} geometry={roseGeo}>
                <meshStandardMaterial color={fc as string} vertexColors roughness={0.74} side={THREE.DoubleSide} />
              </mesh>
            ))}
          </group>
          {[-0.32, 0.32].map((cx, ci) => (
            <group key={`candel-${ci}`} position={[cx, 0.89, 0.06]}>
              <mesh position={[0, 0.16, 0]} material={brassMat}>
                <cylinderGeometry args={[0.014, 0.055, 0.32, 12]} />
              </mesh>
              <mesh position={[0, 0.30, 0]} material={brassMat}>
                <boxGeometry args={[0.18, 0.014, 0.014]} />
              </mesh>
              {[-0.08, 0, 0.08].map((tx, ti) => (
                <group key={`taper-${ti}`} position={[tx, 0.36 + (ti === 1 ? 0.04 : 0), 0]}>
                  <mesh>
                    <cylinderGeometry args={[0.009, 0.010, 0.12, 8]} />
                    <meshStandardMaterial color="#FDF8EE" roughness={0.48} />
                  </mesh>
                  <mesh position={[0, 0.072, 0]} material={showcase.candleFlameMat}>
                    <sphereGeometry args={[0.011, 8, 8]} />
                  </mesh>
                </group>
              ))}
            </group>
          ))}
        </group>

        {[-1.02, 1.02].map((lx, li) => (
          <group key={`gz-flant-${li}`} position={[lx, 0.33, -1.68]}>
            <mesh position={[0, 0.14, 0]}>
              <boxGeometry args={[0.16, 0.28, 0.16]} />
              <meshStandardMaterial color="#2D2B28" roughness={0.5} metalness={0.6} />
            </mesh>
            <mesh position={[0, 0.13, 0]} material={showcase.candleFlameMat}>
              <cylinderGeometry args={[0.036, 0.036, 0.14, 10]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 2. WEDDING CEREMONY LAWN (对齐地形高度：拱门、迎宾牌、双花钵与 16 把走廊椅) */}
      <group>
        <group position={[0.58, archTerrainY - 0.04, 14.32]}>
          {[-0.94, 0.94].map((px, pi) => (
            <group key={`warch-col-${pi}`} position={[px, 0, 0]}>
              <mesh position={[0, 1.08, 0]} material={creamPaintMat} castShadow>
                <boxGeometry args={[0.10, 2.16, 0.10]} />
              </mesh>
              <mesh position={[0, 0.10, 0]} material={creamPaintMat}>
                <boxGeometry args={[0.18, 0.20, 0.18]} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 2.14, 0]} material={creamPaintMat} castShadow>
            <torusGeometry args={[0.94, 0.055, 10, 28, Math.PI]} />
          </mesh>
          {Array.from({ length: 9 }).map((_, ai) => {
            const ang = (ai / 8) * Math.PI;
            const ax = Math.cos(ang) * 0.96;
            const ay = 2.14 + Math.sin(ang) * 0.96;
            return (
              <group key={`warch-fl-${ai}`} position={[ax, ay, 0.04]}>
                <mesh scale={1.75} geometry={showcase.foliageClusterGeo}>
                  <meshStandardMaterial vertexColors roughness={0.78} side={THREE.DoubleSide} />
                </mesh>
                <mesh position={[0, 0.05, 0.06]} scale={1.85} geometry={roseGeo}>
                  <meshStandardMaterial color={ai % 2 === 0 ? '#F29DB4' : '#FAF3E2'} vertexColors roughness={0.74} side={THREE.DoubleSide} />
                </mesh>
                <mesh position={[-0.08, -0.02, -0.03]} rotation={[0.3, 1.2, 0]} scale={1.45} geometry={roseGeo}>
                  <meshStandardMaterial color={ai % 2 === 1 ? '#F29DB4' : '#FAF3E2'} vertexColors roughness={0.74} side={THREE.DoubleSide} />
                </mesh>
              </group>
            );
          })}
        </group>

        {/* 迎宾木牌稍微向前左侧空位微移并对齐地形高度，彻底露全文字不被花草半埋！ */}
        <group position={[-1.08, welcomeSignY - 0.02, 13.72]} rotation={[0, Math.PI - 0.26, 0]}>
          {[-0.24, 0.24].map((lx, li) => (
            <mesh key={`ws-fleg-${li}`} position={[lx, 0.56, 0.04]} rotation={[-0.14, 0, 0]} material={honeyOakMat} castShadow>
              <boxGeometry args={[0.036, 1.15, 0.032]} />
            </mesh>
          ))}
          <mesh position={[0, 0.56, -0.18]} rotation={[0.24, 0, 0]} material={honeyOakMat} castShadow>
            <boxGeometry args={[0.036, 1.16, 0.032]} />
          </mesh>
          <group position={[0, 0.78, 0.02]} rotation={[-0.14, 0, 0]}>
            <mesh material={honeyOakMat} castShadow>
              <boxGeometry args={[0.78, 0.48, 0.032]} />
            </mesh>
            <mesh position={[0, 0, 0.018]}>
              <planeGeometry args={[0.72, 0.43]} />
              <meshStandardMaterial map={showcase.weddingSignTex} roughness={0.72} />
            </mesh>
          </group>
        </group>

        {/* 彻底删除笔直的纯白矩形板路面，改为 FrenchFormalManorGarden 中的自然 S 弯曲碎石青石板小径！ */}
        <instancedMesh ref={aislePetalInstRef} args={[showcase.petalGeo, undefined, 72]}>
          <meshStandardMaterial roughness={0.68} side={THREE.DoubleSide} />
        </instancedMesh>

        {[
          [-0.72, sampleGhibliTerrainHeight(-0.72, 14.55) - 0.02, 14.55],
          [1.88, sampleGhibliTerrainHeight(1.88, 14.55) - 0.02, 14.55],
        ].map(([ux, uy, uz], ui) => (
          <group key={`wurn-${ui}`} position={[ux, uy, uz]}>
            <mesh position={[0, 0.24, 0]} material={creamPaintMat} castShadow receiveShadow>
              <boxGeometry args={[0.38, 0.48, 0.38]} />
            </mesh>
            <mesh position={[0, 0.48, 0]} geometry={showcase.urnGeo} castShadow>
              <meshStandardMaterial color="#D6CBB8" roughness={0.82} />
            </mesh>
            <mesh position={[0, 0.85, 0]} scale={[2.2, 1.9, 2.2]} geometry={showcase.foliageClusterGeo} castShadow>
              <meshStandardMaterial vertexColors roughness={0.78} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0.99, 0]} scale={1.85} geometry={roseGeo}>
              <meshStandardMaterial color={ui % 2 === 0 ? '#F29EB4' : '#FAF2E0'} vertexColors roughness={0.74} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[-0.09, 0.94, 0.07]} rotation={[0.35, 1.1, 0]} scale={1.45} geometry={roseGeo}>
              <meshStandardMaterial color="#FAF2E0" vertexColors roughness={0.74} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0.09, 0.93, -0.06]} rotation={[-0.25, 2.2, 0]} scale={1.40} geometry={roseGeo}>
              <meshStandardMaterial color="#F29EB4" vertexColors roughness={0.74} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}

        {innerAisleChairCoords.map((ic, ii) => (
          <group key={`aisle-posy-${ii}`} position={[ic.x, ic.y, ic.z]}>
            <mesh scale={1.0} geometry={showcase.foliageClusterGeo}>
              <meshStandardMaterial vertexColors roughness={0.78} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[ic.side * 0.03, 0.04, 0]} scale={1.25} geometry={roseGeo}>
              <meshStandardMaterial color={ii % 2 === 0 ? '#F29EB4' : '#FAF3E2'} vertexColors roughness={0.74} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 3. SHARED 28 INSTANCED FRENCH WEDDING & BANQUET CHAIRS (16 Ceremony + 12 Banquet) */}
      <instancedMesh ref={chairFrameInstRef} args={[showcase.chairFrameGeo, undefined, 28]} castShadow receiveShadow>
        <primitive object={creamPaintMat} attach="material" />
      </instancedMesh>
      <instancedMesh ref={chairCushionInstRef} args={[showcase.chairCushionGeo, undefined, 28]} castShadow>
        <primitive object={linenCreamMat} attach="material" />
      </instancedMesh>
      <instancedMesh ref={chairBackPadInstRef} args={[showcase.chairBackPadGeo, undefined, 28]}>
        <primitive object={linenCreamMat} attach="material" />
      </instancedMesh>
      <instancedMesh ref={chairSashInstRef} args={[showcase.chairSashGeo, undefined, 28]} castShadow>
        <meshPhysicalMaterial roughness={0.38} sheen={0.72} sheenColor="#FFF5F6" />
      </instancedMesh>

      {/* 4. 户外草坪宴会露台（增设暖灰法式石砖水平方台基座深埋坡土，让餐桌/12把椅/甜品车彻底告别坡地活埋！） */}
      <group position={[8.2, banquetTerraceY, 17.8]} rotation={[0, -0.18, 0]}>
        {/* 水平法式暖灰石质方台露台 + 深埋坡地防露缝裙边 */}
        <mesh position={[0, -0.44, -0.38]} receiveShadow castShadow>
          <boxGeometry args={[5.35, 0.88, 6.25]} />
          <meshStandardMaterial map={craftAssets.rubbleStone.map} color="#CFC6B3" roughness={0.92} />
        </mesh>
        <mesh position={[0, -0.01, -0.38]} receiveShadow>
          <boxGeometry args={[5.48, 0.04, 6.38]} />
          <meshStandardMaterial color="#DFD6C3" roughness={0.86} />
        </mesh>
        <mesh position={[0, 0.016, 0.22]} geometry={showcase.banquetRugGeo} receiveShadow>
          <meshStandardMaterial map={craftAssets.juteRunnerTex} color="#D8CEBA" roughness={0.94} />
        </mesh>

        {[
          [-2.22, -1.85],
          [2.22, -1.85],
          [-2.22, 2.25],
          [2.22, 2.25],
        ].map(([px, pz], pi) => (
          <group key={`banq-pole-${pi}`} position={[px, 0, pz]}>
            <mesh position={[0, 1.45, 0]} material={honeyOakMat} castShadow>
              <cylinderGeometry args={[0.042, 0.056, 2.90, 14]} />
            </mesh>
            <mesh position={[0, 0.11, 0]} material={creamPaintMat} castShadow>
              <boxGeometry args={[0.24, 0.22, 0.24]} />
            </mesh>
          </group>
        ))}
        {showcase.festoonCableGeos.map((cg, ci) => (
          <mesh key={`banq-cable-${ci}`} geometry={cg}>
            <meshStandardMaterial color="#2A2622" roughness={0.78} />
          </mesh>
        ))}
        <instancedMesh ref={banquetFestoonBulbInstRef} args={[undefined, undefined, showcase.festoonBulbPts.length]}>
          <sphereGeometry args={[0.032, 10, 10]} />
          <meshStandardMaterial color="#FFF6DC" emissive="#FFB648" emissiveIntensity={1.65} roughness={0.28} />
        </instancedMesh>

        {[-1.06, 1.06].map((tx, ti) => (
          <group key={`banq-tbl-${ti}`} position={[tx, 0, 0.22]}>
            <mesh position={[0, 0.375, 0]} geometry={showcase.tableClothGeo} material={showcase.ivoryLinenMat} castShadow receiveShadow />
            <mesh position={[0, 0.754, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.32, 2.66]} />
              <meshStandardMaterial
                map={craftAssets.lacePlacematMaps.map}
                alphaMap={craftAssets.lacePlacematMaps.alphaMap}
                transparent
                alphaTest={0.22}
                roughness={0.92}
              />
            </mesh>
            {/* 6 Dining Place Settings aligned 1:1 with Banquet Chairs (`seatZs = [-0.62, 0.22, 1.06]`) */}
            {[-0.84, 0.0, 0.84].map((pz) =>
              [-0.27, 0.27].map((px, si) => (
                <group key={`pset-${pz}-${si}`} position={[px, 0.756, pz]}>
                  <mesh position={[0, 0.006, 0]}>
                    <cylinderGeometry args={[0.125, 0.11, 0.012, 18]} />
                    <meshStandardMaterial color="#EFE8DA" roughness={0.44} envMapIntensity={0.36} />
                  </mesh>
                  <mesh position={[0, 0.015, 0]}>
                    <cylinderGeometry args={[0.088, 0.075, 0.010, 16]} />
                    <meshStandardMaterial color="#FAF6EE" roughness={0.40} envMapIntensity={0.38} />
                  </mesh>
                  <mesh position={[px > 0 ? -0.11 : 0.11, 0.055, 0.06]}>
                    <cylinderGeometry args={[0.018, 0.006, 0.09, 10]} />
                    <primitive object={glassJarMat} attach="material" />
                  </mesh>
                  <mesh position={[px > 0 ? -0.11 : 0.11, 0.062, 0.06]}>
                    <cylinderGeometry args={[0.013, 0.008, 0.036, 10]} />
                    <meshStandardMaterial color="#F5DFA0" roughness={0.28} envMapIntensity={0.38} />
                  </mesh>
                </group>
              ))
            )}
            {[-0.42, 0.42].map((cz, ci) => (
              <group key={`bcent-${ci}`} position={[0, 0.756, cz]}>
                <mesh position={[0, 0.04, 0]} material={brassMat}>
                  <cylinderGeometry args={[0.09, 0.045, 0.07, 14]} />
                </mesh>
                <mesh position={[0, 0.09, 0]} scale={1.35} geometry={showcase.foliageClusterGeo}>
                  <meshStandardMaterial vertexColors roughness={0.78} side={THREE.DoubleSide} />
                </mesh>
                <mesh position={[0, 0.145, 0]} scale={1.45} geometry={roseGeo}>
                  <meshStandardMaterial color={ci % 2 === 0 ? '#F29EB4' : '#FAF3E2'} vertexColors roughness={0.74} side={THREE.DoubleSide} />
                </mesh>
                <mesh position={[0.05, 0.125, 0.05]} rotation={[0.25, 1.2, 0]} scale={1.15} geometry={roseGeo}>
                  <meshStandardMaterial color={ci % 2 === 1 ? '#F29EB4' : '#FAF3E2'} vertexColors roughness={0.74} side={THREE.DoubleSide} />
                </mesh>
                {[-0.14, 0.14].map((kx, ki) => (
                  <group key={`bcand-${ki}`} position={[0, 0, kx]}>
                    <mesh position={[0, 0.09, 0]} material={brassMat}>
                      <cylinderGeometry args={[0.008, 0.022, 0.18, 8]} />
                    </mesh>
                    <mesh position={[0, 0.19, 0]} material={showcase.candleFlameMat}>
                      <sphereGeometry args={[0.011, 8, 8]} />
                    </mesh>
                  </group>
                ))}
              </group>
            ))}
            <group position={[0, 0.756, ti === 0 ? -0.92 : 0.92]}>
              <mesh position={[0, 0.08, 0]}>
                <cylinderGeometry args={[0.075, 0.055, 0.16, 16]} />
                <meshStandardMaterial color="#D8DCE0" metalness={0.68} roughness={0.38} envMapIntensity={0.45} />
              </mesh>
              <mesh position={[0.01, 0.15, 0]} rotation={[0.12, 0, -0.18]}>
                <cylinderGeometry args={[0.024, 0.032, 0.22, 12]} />
                <meshPhysicalMaterial color="#4A723E" roughness={0.32} clearcoat={0.16} envMapIntensity={0.40} />
              </mesh>
            </group>
          </group>
        ))}

        {/* Garden Champagne & Wedding Cake Cart cleanly seated on level Banquet Stone Terrace */}
        <group position={[0, 0.01, -2.55]} rotation={[0, -0.35, 0]}>
          <mesh position={[0, 0.22, 0]} material={honeyOakMat} castShadow>
            <boxGeometry args={[0.98, 0.04, 0.56]} />
          </mesh>
          <mesh position={[0, 0.78, 0]} material={showcase.marbleAltarMat} castShadow receiveShadow>
            <boxGeometry args={[1.04, 0.045, 0.62]} />
          </mesh>
          {[-0.44, 0.44].map((cx) =>
            [-0.24, 0.24].map((cz) => (
              <mesh key={`cartleg-${cx}-${cz}`} position={[cx, 0.42, cz]} material={creamPaintMat}>
                <cylinderGeometry args={[0.026, 0.028, 0.74, 10]} />
              </mesh>
            ))
          )}
          {/* 右侧两只黄铜万向脚轮 + 左端双实木大轮（严格贴地 y=0 不埋土不悬空） */}
          {[-0.29, 0.29].map((wz, wi) => (
            <group key={`cartwhl-${wi}`} position={[-0.42, 0.23, wz]}>
              <mesh material={honeyOakMat} castShadow>
                <torusGeometry args={[0.21, 0.022, 8, 22]} />
              </mesh>
              {[0, 1, 2].map((si) => (
                <mesh key={`cwsp-${si}`} rotation={[0, 0, (si * Math.PI) / 3]} material={honeyOakMat}>
                  <cylinderGeometry args={[0.010, 0.010, 0.40, 6]} />
                </mesh>
              ))}
              <mesh rotation={[Math.PI / 2, 0, 0]} material={brassMat}>
                <cylinderGeometry args={[0.036, 0.036, 0.05, 12]} />
              </mesh>
            </group>
          ))}
          {[-0.24, 0.24].map((cz, ci) => (
            <mesh key={`caster-${ci}`} position={[0.44, 0.04, cz]} rotation={[Math.PI / 2, 0, 0]} material={brassMat}>
              <cylinderGeometry args={[0.042, 0.042, 0.032, 12]} />
            </mesh>
          ))}
          {[-0.46, 0.46].map((ax) =>
            [-0.25, 0.25].map((az) => (
              <mesh key={`up-${ax}-${az}`} position={[ax, 1.32, az]} material={brassMat}>
                <cylinderGeometry args={[0.011, 0.011, 1.06, 8]} />
              </mesh>
            ))
          )}
          <mesh position={[0, 1.84, 0]} rotation={[0, 0, Math.PI / 2]} material={showcase.awningMat} castShadow>
            <cylinderGeometry args={[0.38, 0.38, 1.12, 18, 1, true, 0, Math.PI]} />
          </mesh>

          <group position={[-0.22, 0.80, 0]}>
            <mesh position={[0, 0.04, 0]} material={brassMat}>
              <cylinderGeometry args={[0.16, 0.09, 0.07, 20]} />
            </mesh>
            <mesh position={[0, 0.14, 0]}>
              <cylinderGeometry args={[0.14, 0.14, 0.13, 24]} />
              <meshStandardMaterial color="#FCF7EC" roughness={0.38} />
            </mesh>
            <mesh position={[0, 0.25, 0]}>
              <cylinderGeometry args={[0.10, 0.10, 0.11, 24]} />
              <meshStandardMaterial color="#FFF9F0" roughness={0.36} />
            </mesh>
            <mesh position={[0, 0.345, 0]}>
              <cylinderGeometry args={[0.065, 0.065, 0.085, 22]} />
              <meshStandardMaterial color="#FCF7EC" roughness={0.36} />
            </mesh>
            <mesh position={[0, 0.405, 0]} scale={0.92} geometry={roseGeo}>
              <meshStandardMaterial color="#F29EB4" vertexColors roughness={0.72} side={THREE.DoubleSide} />
            </mesh>
          </group>
          <group position={[0.22, 0.80, 0.06]}>
            <mesh position={[0, 0.02, 0]} material={brassMat}>
              <cylinderGeometry args={[0.14, 0.12, 0.016, 18]} />
            </mesh>
            {[-0.05, 0.0, 0.05].map((bx, bi) => (
              <group key={`cart-b-${bi}`} position={[bx, 0.032, (bi % 2 - 0.5) * 0.04]} rotation={[0.2 * (bi - 1), bi * 0.9, 0]}>
                <mesh scale={1.1} geometry={strawberryGeo} material={berryRedMat} castShadow />
                <mesh position={[0, 0.024, 0]} geometry={calyxGeo}>
                  <meshStandardMaterial color="#548C3C" roughness={0.64} side={THREE.DoubleSide} />
                </mesh>
              </group>
            ))}
          </group>
          <mesh position={[0.25, 0.87, -0.14]}>
            <cylinderGeometry args={[0.026, 0.010, 0.12, 12]} />
            <primitive object={glassJarMat} attach="material" />
          </mesh>
        </group>
      </group>
    </group>
  );
};

/**
 * ITERATION 2 RED-TEAM HARDENED:
 * Cozy Architectural Warmth, Sculpted Artisan Pastries, Curved Sine Fence Rails,
 * Grounded Hinged Chalkboard, Stemmed Lavender, Lily-Pad Water Lilies, Natural Book/Vine Rhythm & 100% PBR!
 */
export const CozyBotanicalAndClutterPack: React.FC = () => {
  const craftAssets = useMemo(() => getCottageCraftAssets(), []);
  const distantTreeCanopyRef = useRef<THREE.InstancedMesh>(null);
  const distantTreeTrunkRef = useRef<THREE.InstancedMesh>(null);
  const meadowFlowersRef = useRef<THREE.InstancedMesh>(null);
  const windmillSailsRef = useRef<THREE.Group>(null);
  const lavenderSpikesRef = useRef<THREE.InstancedMesh>(null);
  const lavenderStemsRef = useRef<THREE.InstancedMesh>(null);
  const shelfVineLeavesRef = useRef<THREE.InstancedMesh>(null);
  const hearthEmbersRef = useRef<THREE.Group>(null);

  const assets = useMemo(() => {
    const windTimeUniform = { value: 0 };
    const oakPbr = createWoodGrainPbr('#A66E3E', '#6D4220', 501);
    const creamWoodPbr = createWoodGrainPbr('#F6EEDD', '#DDD1B8', 502);
    const sageWoodPbr = createWoodGrainPbr('#7D9976', '#567250', 503);
    const croissantPbr = createBakedCrustPbr('#E4AA52', '#A8581E', false, 504);
    const sourdoughPbr = createBakedCrustPbr('#CF9248', '#8F4E1E', true, 505);
    const linenCreamPbr = createWovenFabricPbr('#F4EAD6', '#D4C4A4', 506);
    const pillowSagePbr = createWovenFabricPbr('#A5C0A0', '#7D9B78', 507);
    const pillowBlushPbr = createWovenFabricPbr('#F2CBC2', '#D4A296', 508);
    const pillowButterPbr = createWovenFabricPbr('#F5DA8E', '#D4B662', 509);
    const metalMicro = createMicroSurfaceMaps(0.22, 0.08, true, 510);

    const chalkboardTex = createChalkboardMenuTexture();
    const cakePrintTex = createBotanicalPrintTexture('cake');
    const berryPrintTex = createBotanicalPrintTexture('berry');
    const lavenderPrintTex = createBotanicalPrintTexture('lavender');
    const recipeBookTex = createOpenRecipeBookTexture();

    // Organic trailing vine stems anchored cleanly to segmented North loft beams!
    const vineAnchors: Array<{ x: number; y: number; z: number; len: number; sway: number }> = [
      { x: -4.86, y: 3.24, z: -3.34, len: 0.60, sway: 0.05 },
      { x: -4.26, y: 3.24, z: -3.34, len: 0.48, sway: -0.04 },
      { x: 1.56, y: 3.24, z: -3.34, len: 0.54, sway: 0.05 },
      { x: 2.28, y: 3.24, z: -3.34, len: 0.46, sway: -0.05 },
    ];
    const vineStemGeos: THREE.BufferGeometry[] = [];
    const vineLeafTransforms: Array<{ pos: THREE.Vector3; strand: number; step: number }> = [];
    vineAnchors.forEach((va, sIdx) => {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 6; k++) {
        const f = k / 6;
        pts.push(
          new THREE.Vector3(
            va.x + Math.sin(f * Math.PI * 1.8 + sIdx) * va.sway,
            va.y - f * va.len,
            va.z + Math.cos(f * Math.PI * 1.3 + sIdx) * 0.028
          )
        );
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      vineStemGeos.push(new THREE.TubeGeometry(curve, 14, 0.0045, 6, false));
      const leafCount = 14;
      for (let l = 1; l <= leafCount; l++) {
        const u = l / (leafCount + 0.5);
        vineLeafTransforms.push({ pos: curve.getPointAt(u), strand: sIdx, step: l });
      }
    });

    // High-Craft Sculpted Geometries (trimmed & segmented cleanly for solid wall bays!)
    const pegRailGeo = createBeveledBoxGeometry(0.94, 0.068, 0.032, 0.014, 0.006, 0.006, 2);
    const loftBeamLeftGeo = createBeveledBoxGeometry(0.86, 0.060, 0.34, 0.016, 0.006, 0.006, 2);
    const loftBeamRightGeo = createBeveledBoxGeometry(0.96, 0.060, 0.34, 0.016, 0.006, 0.006, 2);
    const artFrameGeo = createBeveledBoxGeometry(0.46, 0.54, 0.028, 0.014, 0.006, 0.006, 2);
    const windowBenchGeo = createBeveledBoxGeometry(0.68, 0.44, 1.48, 0.028, 0.010, 0.010, 3);
    const cushionGeo = createBeveledBoxGeometry(0.64, 0.11, 1.44, 0.048, 0.026, 0.026, 5);
    const tailoredPillowGeo = createBeveledBoxGeometry(0.11, 0.34, 0.36, 0.042, 0.022, 0.022, 4);
    const tailoredSmallPillowGeo = createBeveledBoxGeometry(0.10, 0.28, 0.30, 0.036, 0.018, 0.018, 4);
    const throwBlanketGeo = createBeveledBoxGeometry(0.32, 0.044, 0.36, 0.018, 0.015, 0.018, 3);
    const chalkboardFrameGeo = createBeveledBoxGeometry(0.56, 0.84, 0.034, 0.018, 0.006, 0.006, 3);
    const chalkboardFrontLegGeo = createBeveledBoxGeometry(0.040, 0.976, 0.030, 0.008, 0.004, 0.004, 2);
    const chalkboardRearLegGeo = createBeveledBoxGeometry(0.036, 0.988, 0.028, 0.008, 0.004, 0.004, 2);
    const chalkboardCrossbarGeo = createBeveledBoxGeometry(0.44, 0.032, 0.024, 0.006, 0.004, 0.004, 2);
    const eggCartonGeo = createBeveledBoxGeometry(0.18, 0.044, 0.12, 0.014, 0.006, 0.006, 2);
    const doughBoardGeo = createBeveledBoxGeometry(0.42, 0.024, 0.30, 0.022, 0.006, 0.006, 3);
    const verandaMatGeo = createBeveledBoxGeometry(1.15, 0.014, 0.58, 0.08, 0.005, 0.005, 3);
    const ovenMittGeo = createShapedOvenMittGeo();
    const apronGeo = createDrapedApronGeo();
    const cuttingBoardGeo = createBeveledBoxGeometry(0.18, 0.24, 0.018, 0.022, 0.005, 0.005, 2);
    const bookStandGeo = createBeveledBoxGeometry(0.30, 0.21, 0.016, 0.012, 0.004, 0.004, 2);
    const openBookGeo = createArchedOpenBookGeo(0.27, 0.19);

    // Sculpted Food & Bakery Vessels!
    const croissantGeo = createLaminatedCroissantGeo();
    const tartShellGeo = createFlutedTartShellGeo(0.038, 0.022);
    const sourdoughBouleGeo = createScoredSourdoughBouleGeo(0.092);
    const sourdoughSmallGeo = createScoredSourdoughBouleGeo(0.078);
    const breadBasketGeo = createHollowVesselLatheGeo(0.165, 0.205, 0.210, 0.22, 0.012, 64);
    const jamJarGeo = createHollowVesselLatheGeo(0.040, 0.044, 0.038, 0.102, 0.004, 64);
    const bookGeo = createBeveledBoxGeometry(0.056, 0.24, 0.18, 0.008, 0.004, 0.004, 2);
    const birdhouseBodyGeo = createBeveledBoxGeometry(0.24, 0.24, 0.22, 0.016, 0.006, 0.006, 2);

    // Volumetric Painterly Ghibli Ridge Crown Geometry (replaces giant flat floating leaves!)
    const ridgeLeafGeo = createVolumetricCanopyPuffGeometry();
    const shelfLeafGeo = createCitrusLeafGeometry();
    const lilyPadGeo = new THREE.CylinderGeometry(0.145, 0.145, 0.008, 22, 1, false, 0.28, Math.PI * 1.84);
    const lilyBlossomGeo = createSculptedRoseBlossomGeometry();
    const lilyCoreGeo = new THREE.SphereGeometry(0.018, 10, 8);
    const berryTopGeo = createMiniStrawberryGeometry(0.013, 0.022);
    const calyxGeo = createStrawberryCalyxGeometry(0.011);
    const custardPeakGeo = new THREE.SphereGeometry(0.024, 12, 10);
    const fairyBulbGeo = new THREE.SphereGeometry(0.013, 10, 8);
    const orangeSliceGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.005, 16);
    const shelfDaisyGeo = createChamomileDaisyHeadGeometry();
    const emberGeo = new THREE.SphereGeometry(0.0085, 8, 6);
    const emberWarmMat = new THREE.MeshBasicMaterial({ color: '#FFB844' });
    const emberHotMat = new THREE.MeshBasicMaterial({ color: '#FF7C24' });

    // High-Craft Shared PBR Materials (Ghibli Provence Golden Hour soft matte-satin palette + Warm Fresnel Contour Rim)
    const honeyOakMat = enhanceWithStylizedFresnelRim(
      new THREE.MeshStandardMaterial({
        map: oakPbr.map,
        bumpMap: oakPbr.bumpMap,
        bumpScale: 0.005,
        roughnessMap: oakPbr.roughnessMap,
        roughness: 1.0,
        envMapIntensity: 0.34,
      }),
      { rimColor: '#FFE4B0', rimStrength: 0.28, rimPower: 2.8, topBias: 0.42, cacheTag: 'bot-honey-oak-rim' }
    );
    const creamPaintMat = enhanceWithStylizedFresnelRim(
      new THREE.MeshStandardMaterial({
        map: creamWoodPbr.map,
        bumpMap: creamWoodPbr.bumpMap,
        bumpScale: 0.004,
        roughnessMap: creamWoodPbr.roughnessMap,
        roughness: 1.0,
        envMapIntensity: 0.34,
      }),
      { rimColor: '#FFE8BE', rimStrength: 0.28, rimPower: 2.8, topBias: 0.42, cacheTag: 'bot-cream-paint-rim' }
    );
    const sageWoodMat = enhanceWithStylizedFresnelRim(
      new THREE.MeshStandardMaterial({
        map: sageWoodPbr.map,
        bumpMap: sageWoodPbr.bumpMap,
        bumpScale: 0.004,
        roughnessMap: sageWoodPbr.roughnessMap,
        roughness: 1.0,
        envMapIntensity: 0.34,
      }),
      { rimColor: '#FFE8BC', rimStrength: 0.30, rimPower: 2.7, topBias: 0.42, cacheTag: 'bot-sage-wood-rim' }
    );
    const brassMat = enhanceWithStylizedFresnelRim(
      new THREE.MeshStandardMaterial({
        color: '#C8A258',
        metalness: 0.78,
        roughness: 1.0,
        roughnessMap: metalMicro.roughnessMap,
        bumpMap: metalMicro.bumpMap,
        bumpScale: 0.0016,
        envMapIntensity: 0.50,
      }),
      { rimColor: '#FFE6B4', rimStrength: 0.32, rimPower: 2.6, topBias: 0.42, cacheTag: 'bot-brass-rim' }
    );
    const wovenRattanMat = enhanceWithStylizedFresnelRim(
      new THREE.MeshStandardMaterial({
        map: craftAssets.wovenRattan.map,
        normalMap: craftAssets.wovenRattan.normalMap,
        roughness: 0.85,
        envMapIntensity: 0.32,
      }),
      { rimColor: '#FFE4B0', rimStrength: 0.34, rimPower: 2.5, topBias: 0.45, cacheTag: 'bot-rattan-basket-rim' }
    );
    const pastryGoldMat = enhanceWithStylizedFresnelRim(
      new THREE.MeshPhysicalMaterial({
        map: croissantPbr.map,
        bumpMap: croissantPbr.bumpMap,
        bumpScale: 0.0055,
        roughnessMap: croissantPbr.roughnessMap,
        roughness: 1.0,
        clearcoat: 0.12,
        clearcoatRoughness: 0.38,
        envMapIntensity: 0.34,
      }),
      { rimColor: '#FFE8B6', rimStrength: 0.24, rimPower: 2.8, topBias: 0.44, cacheTag: 'bot-pastry-rim' }
    );
    const sourdoughMat = new THREE.MeshStandardMaterial({
      map: sourdoughPbr.map,
      bumpMap: sourdoughPbr.bumpMap,
      bumpScale: 0.007,
      roughnessMap: sourdoughPbr.roughnessMap,
      roughness: 1.0,
      envMapIntensity: 0.32,
    });
    const linenCreamMat = new THREE.MeshStandardMaterial({
      map: linenCreamPbr.map,
      bumpMap: linenCreamPbr.bumpMap,
      bumpScale: 0.005,
      roughnessMap: linenCreamPbr.roughnessMap,
      roughness: 1.0,
      envMapIntensity: 0.32,
    });
    const pillowSageMat = new THREE.MeshStandardMaterial({
      map: pillowSagePbr.map,
      bumpMap: pillowSagePbr.bumpMap,
      bumpScale: 0.005,
      roughnessMap: pillowSagePbr.roughnessMap,
      roughness: 1.0,
      envMapIntensity: 0.32,
    });
    const pillowBlushMat = new THREE.MeshStandardMaterial({
      map: pillowBlushPbr.map,
      bumpMap: pillowBlushPbr.bumpMap,
      bumpScale: 0.005,
      roughnessMap: pillowBlushPbr.roughnessMap,
      roughness: 1.0,
      envMapIntensity: 0.32,
    });
    const pillowButterMat = new THREE.MeshStandardMaterial({
      map: pillowButterPbr.map,
      bumpMap: pillowButterPbr.bumpMap,
      bumpScale: 0.005,
      roughnessMap: pillowButterPbr.roughnessMap,
      roughness: 1.0,
      envMapIntensity: 0.32,
    });
    const glassJarMat = new THREE.MeshPhysicalMaterial({
      color: '#F5F2E8',
      transparent: true,
      opacity: 0.24,
      roughness: 0.18,
      metalness: 0.02,
      ior: 1.48,
      reflectivity: 0.34,
      clearcoat: 0.16,
      clearcoatRoughness: 0.22,
      specularIntensity: 0.36,
      envMapIntensity: 0.34,
    });
    const fairyGlowMat = new THREE.MeshStandardMaterial({
      color: '#FFF1C2',
      emissive: '#FFA22A',
      emissiveIntensity: 0.72,
    });
    const driedOrangeMat = new THREE.MeshStandardMaterial({
      color: '#DE7F2A',
      bumpMap: croissantPbr.bumpMap,
      bumpScale: 0.004,
      roughness: 0.68,
    });
    const vineStemMat = new THREE.MeshStandardMaterial({ color: '#58442C', roughness: 0.88 });
    const lilyPadMat = new THREE.MeshStandardMaterial({ color: '#589448', roughness: 0.70, envMapIntensity: 0.32 });
    const lilyPinkMat = new THREE.MeshStandardMaterial({ color: '#FAD2DE', vertexColors: true, roughness: 0.74, side: THREE.DoubleSide });
    const lilyIvoryMat = new THREE.MeshStandardMaterial({ color: '#FFF7E4', vertexColors: true, roughness: 0.74, side: THREE.DoubleSide });
    const lilyCoreMat = new THREE.MeshStandardMaterial({ color: '#F4C440', roughness: 0.50 });
    const berryRedMat = new THREE.MeshPhysicalMaterial({
      color: '#DF3446',
      roughness: 0.26,
      clearcoat: 0,
      envMapIntensity: 0.40,
    });
    const berryApricotMat = new THREE.MeshPhysicalMaterial({
      color: '#EE9E38',
      roughness: 0.42,
      clearcoat: 0,
      envMapIntensity: 0.36,
    });
    const custardMat = new THREE.MeshPhysicalMaterial({
      color: '#FFF9ED',
      roughness: 0.58,
      clearcoat: 0,
      envMapIntensity: 0.34,
    });
    const bookMats = ['#CF7466', '#7E9E78', '#DFBA62', '#957EB2', '#D8966C', '#72929F'].map(
      (c) =>
        new THREE.MeshStandardMaterial({
          color: c,
          bumpMap: linenCreamPbr.bumpMap,
          bumpScale: 0.004,
          roughness: 0.82,
        })
    );
    const distantTreeCanopyMat = enhanceWithStylizedFoliageToon(
      applyInstancedWindSway(
        new THREE.MeshStandardMaterial({
          map: craftAssets.painterlyCanopyTex,
          vertexColors: true,
          roughness: 0.94,
          metalness: 0.0,
        }),
        windTimeUniform,
        {
          swayAmp: 0.032,
          freqA: 1.45,
          freqB: 2.35,
          tipExpr: 'clamp((position.y + 0.85) * 0.55, 0.0, 1.0)',
          cacheTag: 'distant-canopy-v2',
        }
      ),
      {
        cacheTag: 'distant-ridge-trees',
        sunlitColor: '#DAE864',
        shadowColor: '#366E6A',
        toonBlend: 0.82,
      }
    );
    const meadowFlowersMat = applyInstancedWindSway(
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.78,
        side: THREE.DoubleSide,
      }),
      windTimeUniform,
      {
        swayAmp: 0.015,
        freqA: 1.65,
        freqB: 2.50,
        tipExpr: '0.35 + 0.65 * clamp(length(position.xz) * 20.0, 0.0, 1.0)',
        yBob: 0.004,
        cacheTag: 'meadow-flowers-v1',
      }
    );
    const lavenderStemMat = applyInstancedWindSway(
      new THREE.MeshStandardMaterial({
        color: '#4D7E3A',
        roughness: 0.80,
      }),
      windTimeUniform,
      {
        swayAmp: 0.018,
        freqA: 1.65,
        freqB: 2.50,
        tipExpr: 'clamp((position.y + 0.12) / 0.24, 0.0, 1.0)',
        cacheTag: 'lavender-stem-v1',
      }
    );
    const lavenderSpikeMat = applyInstancedWindSway(
      new THREE.MeshStandardMaterial({
        roughness: 0.76,
      }),
      windTimeUniform,
      {
        swayAmp: 0.018,
        freqA: 1.65,
        freqB: 2.50,
        tipExpr: '1.0 + clamp((position.y + 0.09) / 0.18, 0.0, 1.0) * 0.45',
        cacheTag: 'lavender-spike-v1',
      }
    );

    return {
      windTimeUniform,
      oakPbr,
      creamWoodPbr,
      sageWoodPbr,
      croissantPbr,
      sourdoughPbr,
      linenCreamPbr,
      pillowSagePbr,
      pillowBlushPbr,
      pillowButterPbr,
      metalMicro,
      chalkboardTex,
      cakePrintTex,
      berryPrintTex,
      lavenderPrintTex,
      recipeBookTex,
      vineStemGeos,
      vineLeafTransforms,
      pegRailGeo,
      loftBeamLeftGeo,
      loftBeamRightGeo,
      artFrameGeo,
      windowBenchGeo,
      cushionGeo,
      tailoredPillowGeo,
      tailoredSmallPillowGeo,
      throwBlanketGeo,
      chalkboardFrameGeo,
      chalkboardFrontLegGeo,
      chalkboardRearLegGeo,
      chalkboardCrossbarGeo,
      eggCartonGeo,
      doughBoardGeo,
      verandaMatGeo,
      ovenMittGeo,
      apronGeo,
      cuttingBoardGeo,
      bookStandGeo,
      openBookGeo,
      croissantGeo,
      tartShellGeo,
      sourdoughBouleGeo,
      sourdoughSmallGeo,
      breadBasketGeo,
      jamJarGeo,
      bookGeo,
      birdhouseBodyGeo,
      ridgeLeafGeo,
      shelfLeafGeo,
      lilyPadGeo,
      lilyBlossomGeo,
      lilyCoreGeo,
      berryTopGeo,
      calyxGeo,
      custardPeakGeo,
      fairyBulbGeo,
      orangeSliceGeo,
      shelfDaisyGeo,
      emberGeo,
      emberWarmMat,
      emberHotMat,
      honeyOakMat,
      creamPaintMat,
      sageWoodMat,
      brassMat,
      wovenRattanMat,
      pastryGoldMat,
      sourdoughMat,
      linenCreamMat,
      pillowSageMat,
      pillowBlushMat,
      pillowButterMat,
      glassJarMat,
      fairyGlowMat,
      driedOrangeMat,
      vineStemMat,
      lilyPadMat,
      lilyPinkMat,
      lilyIvoryMat,
      lilyCoreMat,
      berryRedMat,
      berryApricotMat,
      custardMat,
      bookMats,
      distantTreeCanopyMat,
      meadowFlowersMat,
      lavenderStemMat,
      lavenderSpikeMat,
    };
  }, []);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    // 1. Distant Manor Estate Groves — 44 Deep Mediterranean Olive Oaks & Asymmetric Tapered Provence Cypresses
    const cInst = distantTreeCanopyRef.current;
    const tInst = distantTreeTrunkRef.current;
    if (cInst && tInst) {
      const oakTints = [0x78ac4e, 0x8ec25e, 0xa4d06a, 0x6c9c44, 0x82b656];
      const cypressTints = [0x5a8e46, 0x6ba252, 0x7ab45c, 0x4e7e3c];
      let rng = 4242;
      const rand = () => {
        rng = (rng * 1664525 + 1013904223) >>> 0;
        return rng / 4294967296;
      };
      const lobesPerTree = 4;
      // Asymmetric staggered Provence cypress & estate clusters behind Manor Garden Parapet Wall (`z >= 24.4`, zero mirror pairs!)
      const estateTrees: Array<[number, number, number, boolean]> = [
        [-4.9, 24.8, 1.24, true],
        [-3.7, 25.5, 0.92, true],
        [-6.6, 24.4, 1.08, false],
        [4.1, 24.9, 1.32, true],
        [5.4, 25.7, 0.96, true],
        [7.6, 24.5, 1.14, false],
        [15.8, 16.6, 1.18, true],
      ];

      for (let i = 0; i < 44; i++) {
        let tx = 0;
        let tz = 0;
        let isCypress = false;
        let sc = 1.0;
        const groundY = -0.44;

        if (i < estateTrees.length) {
          [tx, tz, sc, isCypress] = estateTrees[i];
        } else {
          // Wrap generously around distant hills while carving wide sunlit sightline vistas:
          // 1. East Footbridge Vista & NE Windmill Vista (`[24.5, -14.5]`)
          // 2. South Wedding Gazebo & Banquet Lawn (`[0.58, 21.15]` & `[8.2, 17.8]`)
          const ang = -0.82 + ((i - 7) / 36) * 3.24;
          const inEastVista = ang > -0.08 && ang < 0.34;
          const inWindmillVista = ang > -0.68 && ang < -0.38;
          const inSouthVista = ang > 0.72 && ang < 1.88;
          if (inEastVista || inWindmillVista || inSouthVista) {
            dummy.position.set(0, -30, 0);
            dummy.scale.setScalar(0.001);
            dummy.updateMatrix();
            tInst.setMatrixAt(i, dummy.matrix);
            for (let k = 0; k < lobesPerTree; k++) {
              cInst.setMatrixAt(i * lobesPerTree + k, dummy.matrix);
            }
            continue;
          }
          const ring = i % 3;
          const dist = 20.8 + ring * 3.6 + (rand() - 0.5) * 1.8;
          tx = Math.cos(ang) * dist;
          tz = Math.sin(ang) * dist;
          isCypress = i % 4 === 1;
          sc = 0.88 + (i % 4) * 0.24 + ring * 0.12;
        }

        // Grounded trunk rooted firmly onto the Simplex rolling hills surface
        const treeBaseY = sampleGhibliTerrainHeight(tx, tz) - 0.08;
        dummy.position.set(tx, treeBaseY + (isCypress ? 0.95 : 1.15) * sc, tz);
        dummy.rotation.set(0, i * 0.9, 0);
        dummy.scale.set((isCypress ? 0.085 : 0.16) * sc, (isCypress ? 1.9 : 2.3) * sc, (isCypress ? 0.085 : 0.16) * sc);
        dummy.updateMatrix();
        tInst.setMatrixAt(i, dummy.matrix);

        if (isCypress) {
          // Slender organic Mediterranean cypress spire (narrow staggered canopy tufts, zero fat cones!)
          const tiers: Array<[number, number, number, number, number]> = [
            [1.48, 0.35, 1.12, 0.04, 0.03],
            [2.32, 0.30, 1.08, -0.05, 0.02],
            [3.12, 0.23, 1.02, 0.03, -0.04],
            [3.82, 0.14, 0.92, -0.02, 0.02],
          ];
          tiers.forEach(([hy, r, sy, ox, oz], k) => {
            const idx = i * lobesPerTree + k;
            dummy.position.set(tx + ox * sc, treeBaseY + hy * sc, tz + oz * sc);
            dummy.rotation.set(0.04 * (k % 2 === 0 ? 1 : -1), rand() * Math.PI * 2, 0);
            dummy.scale.set(r * sc, sy * sc, r * sc);
            dummy.updateMatrix();
            cInst.setMatrixAt(idx, dummy.matrix);
            color.setHex(cypressTints[(i + k) % cypressTints.length]);
            cInst.setColorAt(idx, color);
          });
        } else {
          // Irregular asymmetric orchard / woodland oak crown (4 overlapping painterly clusters!)
          const oakLobes: Array<[number, number, number, number]> = [
            [0.0, 2.72, 0.0, 1.42],
            [0.86, 2.18, 0.50, 1.12],
            [-0.76, 2.38, 0.44, 1.14],
            [0.14, 2.26, -0.84, 1.08],
          ];
          const tw = i * 1.4;
          const ct = Math.cos(tw);
          const st = Math.sin(tw);
          oakLobes.forEach(([ox, oy, oz, rad], k) => {
            const idx = i * lobesPerTree + k;
            dummy.position.set(
              tx + (ox * ct - oz * st) * sc,
              treeBaseY + oy * sc,
              tz + (ox * st + oz * ct) * sc
            );
            dummy.rotation.set((rand() - 0.5) * 0.28, rand() * Math.PI * 2, (rand() - 0.5) * 0.28);
            dummy.scale.set(rad * sc * 1.08, rad * sc * 0.80, rad * sc * 1.08);
            dummy.updateMatrix();
            cInst.setMatrixAt(idx, dummy.matrix);
            color.setHex(oakTints[(i + k) % oakTints.length]);
            cInst.setColorAt(idx, color);
          });
        }
      }
      tInst.instanceMatrix.needsUpdate = true;
      cInst.instanceMatrix.needsUpdate = true;
      if (cInst.instanceColor) cInst.instanceColor.needsUpdate = true;
    }

    // 2B. Tightly Clumped Botanical Meadow Wildflower Drifts (grouped organically near banks, hedgerows & tree bases!)
    const mfInst = meadowFlowersRef.current;
    if (mfInst) {
      const flowerColors = [0xfffbf0, 0xf7b6ca, 0xf8dc86, 0xddd0f6, 0xfff6e0];
      let rng = 9182;
      const rand = () => {
        rng = (rng * 1664525 + 1013904223) >>> 0;
        return rng / 4294967296;
      };
      const wildPatches: Array<[number, number, number]> = [
        // Drifts tucked beside Gazebo parapet & South creek bank margins
        [-2.8, 12.2, 0.88],
        [-4.6, 14.5, 0.92],
        [4.1, 12.4, 0.86],
        [6.2, 14.2, 0.95],
        [-3.4, 21.8, 0.90],
        [5.6, 21.8, 0.90],
        [-1.8, 22.3, 0.82],
        [4.2, 22.4, 0.82],
        // Clustered drifts flanking East creek bank & distant hedgerow margin
        [10.8, -2.4, 0.84],
        [13.4, -4.8, 0.90],
        [11.2, 4.4, 0.82],
        [14.8, 3.8, 0.92],
        [13.8, 7.2, 0.85],
        [10.4, 6.8, 0.72],
        [15.6, -1.6, 0.88],
        [15.4, 1.4, 0.84],
      ];
      let fi = 0;
      wildPatches.forEach(([px, pz, rad], pi) => {
        const count = pi < 4 ? 12 : 11;
        for (let k = 0; k < count && fi < 180; k++) {
          const a = rand() * Math.PI * 2;
          const r = Math.pow(rand(), 0.72) * rad;
          const wx = px + Math.cos(a) * r;
          const wz = pz + Math.sin(a) * r;
          const sc = 0.62 + rand() * 0.45;
          dummy.position.set(wx, -0.348 + rand() * 0.012, wz);
          dummy.rotation.set((rand() - 0.5) * 0.28, rand() * Math.PI * 2, (rand() - 0.5) * 0.28);
          dummy.scale.setScalar(sc);
          dummy.updateMatrix();
          mfInst.setMatrixAt(fi, dummy.matrix);
          color.setHex(flowerColors[(pi + k) % flowerColors.length]);
          mfInst.setColorAt(fi, color);
          fi++;
        }
      });
      for (; fi < 180; fi++) {
        dummy.position.set(0, -10, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        mfInst.setMatrixAt(fi, dummy.matrix);
      }
      mfInst.instanceMatrix.needsUpdate = true;
      if (mfInst.instanceColor) mfInst.instanceColor.needsUpdate = true;
    }

    // 3. Stemmed French Lavender nestled strictly along Cottage-Side Near-Bank Stone Terraces & Courtyard Borders!
    const lInst = lavenderSpikesRef.current;
    const lsInst = lavenderStemsRef.current;
    if (lInst && lsInst) {
      const clusters: Array<[number, number, number]> = [
        // Terrace 0 (NE near-bank curved stone planter)
        [7.55, -0.15, -5.85],
        [7.24, -0.15, -4.65],
        [6.98, -0.15, -3.05],
        // Terrace 1 (East near-bank curved stone planter south of footbridge)
        [6.95, -0.15, 2.35],
        [7.08, -0.15, 3.70],
        [7.20, -0.15, 4.95],
        // Terrace 2 (SE near-bank curved stone planter)
        [6.15, -0.15, 7.82],
        [4.45, -0.15, 8.14],
        [2.65, -0.15, 7.90],
        // Terrace 3 (SW near-bank curved stone planter)
        [-0.85, -0.15, 8.10],
        [-3.05, -0.15, 9.08],
        [-4.25, -0.15, 9.68],
        // Cottage Courtyard East & South Curb Borders (grounded at y = -0.36)
        [6.48, -0.36, -3.65],
        [6.48, -0.36, -0.35],
        [6.48, -0.36, 2.25],
        [6.48, -0.36, 5.45],
        [4.25, -0.36, 6.85],
        [3.15, -0.36, 6.85],
        [1.75, -0.36, 6.85],
        [-0.18, -0.36, 6.85],
      ];
      let idx = 0;
      clusters.forEach(([cx, baseY, cz], ci) => {
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * Math.PI * 2 + ci * 0.7;
          const r = 0.04 + (k % 3) * 0.06;
          const rx = (k % 3 - 1) * 0.14;
          const rz = (k % 2 - 0.5) * 0.16;
          const px = cx + Math.cos(a) * r;
          const pz = cz + Math.sin(a) * r;

          // Green slender stalk anchored into soil
          dummy.position.set(px, baseY + 0.12, pz);
          dummy.rotation.set(rx, a, rz);
          dummy.scale.set(1, 0.95 + (k % 3) * 0.16, 1);
          dummy.updateMatrix();
          lsInst.setMatrixAt(idx, dummy.matrix);

          // Blooming lavender tip perched atop stem
          dummy.position.set(px + Math.sin(rz) * -0.04, baseY + 0.27 + (k % 2) * 0.03, pz + Math.sin(rx) * 0.04);
          dummy.rotation.set(rx, a, rz);
          dummy.scale.set(1, 0.90 + (k % 3) * 0.18, 1);
          dummy.updateMatrix();
          lInst.setMatrixAt(idx, dummy.matrix);
          color.setHex(k % 2 === 0 ? 0x8a6ec8 : 0xa68ce2);
          lInst.setColorAt(idx, color);
          idx++;
        }
      });
      lsInst.instanceMatrix.needsUpdate = true;
      lInst.instanceMatrix.needsUpdate = true;
      if (lInst.instanceColor) lInst.instanceColor.needsUpdate = true;
    }

    // 4. Indoor Cascading Shelf & Loft-Beam Pothos Leaves anchored strictly along vineStemGeos!
    const svInst = shelfVineLeavesRef.current;
    if (svInst) {
      const vineGreens = [0x4c8238, 0x5e9846, 0x3e6e2e, 0x6ea854];
      assets.vineLeafTransforms.forEach((vt, i) => {
        dummy.position.set(vt.pos.x, vt.pos.y, vt.pos.z);
        dummy.rotation.set(0.55, vt.strand * 1.1 + vt.step * 0.65, (vt.step % 2 === 0 ? 1 : -1) * 0.35);
        dummy.scale.setScalar(1.05 + (vt.step % 3) * 0.24);
        dummy.updateMatrix();
        svInst.setMatrixAt(i, dummy.matrix);
        color.setHex(vineGreens[i % vineGreens.length]);
        svInst.setColorAt(i, color);
      });
      svInst.instanceMatrix.needsUpdate = true;
      if (svInst.instanceColor) svInst.instanceColor.needsUpdate = true;
    }
  }, [assets]);

  useEffect(() => {
    return () => {
      [
        assets.oakPbr,
        assets.creamWoodPbr,
        assets.sageWoodPbr,
        assets.croissantPbr,
        assets.sourdoughPbr,
        assets.linenCreamPbr,
        assets.pillowSagePbr,
        assets.pillowBlushPbr,
        assets.pillowButterPbr,
      ].forEach((p) => {
        p.map.dispose();
        p.bumpMap.dispose();
        p.roughnessMap.dispose();
      });
      assets.metalMicro.bumpMap.dispose();
      assets.metalMicro.roughnessMap.dispose();
      assets.chalkboardTex.dispose();
      assets.cakePrintTex.dispose();
      assets.berryPrintTex.dispose();
      assets.lavenderPrintTex.dispose();
      assets.recipeBookTex.dispose();
      assets.vineStemGeos.forEach((g) => g.dispose());
      assets.pegRailGeo.dispose();
      assets.loftBeamLeftGeo.dispose();
      assets.loftBeamRightGeo.dispose();
      assets.artFrameGeo.dispose();
      assets.windowBenchGeo.dispose();
      assets.cushionGeo.dispose();
      assets.tailoredPillowGeo.dispose();
      assets.tailoredSmallPillowGeo.dispose();
      assets.throwBlanketGeo.dispose();
      assets.chalkboardFrameGeo.dispose();
      assets.chalkboardFrontLegGeo.dispose();
      assets.chalkboardRearLegGeo.dispose();
      assets.chalkboardCrossbarGeo.dispose();
      assets.eggCartonGeo.dispose();
      assets.doughBoardGeo.dispose();
      assets.verandaMatGeo.dispose();
      assets.ovenMittGeo.dispose();
      assets.apronGeo.dispose();
      assets.cuttingBoardGeo.dispose();
      assets.bookStandGeo.dispose();
      assets.openBookGeo.dispose();
      assets.croissantGeo.dispose();
      assets.tartShellGeo.dispose();
      assets.sourdoughBouleGeo.dispose();
      assets.sourdoughSmallGeo.dispose();
      assets.breadBasketGeo.dispose();
      assets.jamJarGeo.dispose();
      assets.bookGeo.dispose();
      assets.birdhouseBodyGeo.dispose();
      assets.ridgeLeafGeo.dispose();
      assets.shelfLeafGeo.dispose();
      assets.lilyPadGeo.dispose();
      assets.lilyBlossomGeo.dispose();
      assets.lilyCoreGeo.dispose();
      assets.berryTopGeo.dispose();
      assets.calyxGeo.dispose();
      assets.custardPeakGeo.dispose();
      assets.fairyBulbGeo.dispose();
      assets.orangeSliceGeo.dispose();
      assets.shelfDaisyGeo.dispose();
      assets.emberGeo.dispose();
      assets.emberWarmMat.dispose();
      assets.emberHotMat.dispose();
      assets.honeyOakMat.dispose();
      assets.creamPaintMat.dispose();
      assets.sageWoodMat.dispose();
      assets.brassMat.dispose();
      assets.wovenRattanMat.dispose();
      assets.pastryGoldMat.dispose();
      assets.sourdoughMat.dispose();
      assets.linenCreamMat.dispose();
      assets.pillowSageMat.dispose();
      assets.pillowBlushMat.dispose();
      assets.pillowButterMat.dispose();
      assets.glassJarMat.dispose();
      assets.fairyGlowMat.dispose();
      assets.driedOrangeMat.dispose();
      assets.vineStemMat.dispose();
      assets.lilyPadMat.dispose();
      assets.lilyPinkMat.dispose();
      assets.lilyIvoryMat.dispose();
      assets.lilyCoreMat.dispose();
      assets.berryRedMat.dispose();
      assets.berryApricotMat.dispose();
      assets.custardMat.dispose();
      assets.bookMats.forEach((m) => m.dispose());
      assets.distantTreeCanopyMat.dispose();
      assets.meadowFlowersMat.dispose();
      assets.lavenderStemMat.dispose();
      assets.lavenderSpikeMat.dispose();
    };
  }, [assets]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    assets.windTimeUniform.value = t;
    if (hearthEmbersRef.current) {
      hearthEmbersRef.current.children.forEach((ember, idx) => {
        const p = (t * 0.65 + idx * 0.17) % 1;
        ember.position.y = p * 0.28;
        ember.position.x = Math.sin(t * 2.4 + idx * 1.9) * 0.14;
        ember.scale.setScalar(Math.max(0.05, (1.0 - p) * 0.95));
      });
    }
    if (windmillSailsRef.current) {
      windmillSailsRef.current.rotation.z = -t * 0.28;
    }
  });

  // Standing/stacked Loft Books grounded 0.000m flush on segmented Oak Loft Beams (`beamTopY = 3.290m`)!
  const beamTopY = 3.290;
  const standBookY = (scY: number, rotZ: number) =>
    beamTopY + Math.cos(rotZ) * 0.12 * scY + Math.abs(Math.sin(rotZ)) * 0.028;

  const loftBooks = [
    // Left Loft Beam (`x in [-5.05, -4.19]`, clear of North Window #1 curtain rod!)
    { x: -4.90, y: standBookY(1.04, 0.04), rotZ: 0.04, scY: 1.04, matIdx: 0 },
    { x: -4.82, y: standBookY(0.96, 0.01), rotZ: 0.01, scY: 0.96, matIdx: 1 },
    { x: -4.74, y: standBookY(1.10, -0.02), rotZ: -0.02, scY: 1.10, matIdx: 2 },
    { x: -4.64, y: standBookY(0.98, -0.18), rotZ: -0.18, scY: 0.98, matIdx: 3 },
    { x: -4.38, y: beamTopY + 0.028, rotZ: Math.PI / 2, scY: 1.0, matIdx: 4 },
    { x: -4.36, y: beamTopY + 0.084, rotZ: Math.PI / 2, scY: 0.92, matIdx: 5 },
    // Right Loft Beam (`x in [1.46, 2.42]`, alongside woven basket at x = 2.16)
    { x: 1.56, y: standBookY(1.02, 0.12), rotZ: 0.12, scY: 1.02, matIdx: 1 },
    { x: 1.65, y: standBookY(1.08, 0.02), rotZ: 0.02, scY: 1.08, matIdx: 0 },
    { x: 1.74, y: standBookY(0.94, -0.14), rotZ: -0.14, scY: 0.94, matIdx: 2 },
  ];

  return (
    <group>
      {/* ====================================================================
          1. BEVELED WOODEN PEG RAIL MOUNTED ON SOLID WEST-NORTH WALL BAY!
         ==================================================================== */}
      <group position={[-5.05, 1.48, -2.98]} rotation={[0, Math.PI / 2, 0]}>
        <mesh geometry={assets.pegRailGeo} material={assets.honeyOakMat} castShadow />
        {[-0.36, -0.18, 0, 0.18, 0.36].map((px, pi) => (
          <mesh key={pi} position={[px, 0, 0.032]} rotation={[Math.PI / 2, 0, 0]} material={assets.brassMat}>
            <cylinderGeometry args={[0.010, 0.012, 0.055, 14]} />
          </mesh>
        ))}
        {/* Copper Ring Cookie Cutter Hanging on Left Peg */}
        <mesh position={[-0.36, -0.09, 0.044]} rotation={[0, 0, 0.22]} material={assets.brassMat}>
          <torusGeometry args={[0.042, 0.008, 10, 22]} />
        </mesh>
        {/* Shaped Quilted Gingham Oven Mitt */}
        <mesh position={[-0.18, -0.13, 0.042]} rotation={[0, 0, 0.14]} geometry={assets.ovenMittGeo} castShadow>
          <meshStandardMaterial map={craftAssets.ginghamTex} roughness={0.88} />
        </mesh>
        {/* Beveled Hanging Cutting Board with Handle */}
        <group position={[0.0, -0.16, 0.038]} rotation={[0, 0, -0.05]}>
          <mesh geometry={assets.cuttingBoardGeo} material={assets.honeyOakMat} castShadow />
          <mesh position={[0, 0.145, 0]} material={assets.honeyOakMat}>
            <capsuleGeometry args={[0.018, 0.06, 6, 10]} />
          </mesh>
        </group>
        {/* Contoured Draped Woven-Linen Baker's Apron */}
        <mesh position={[0.36, -0.23, 0.042]} geometry={assets.apronGeo} material={assets.linenCreamMat} castShadow />
      </group>

      {/* ====================================================================
          3. BEVELED FRAMED BOTANICAL & PATISSERIE WATERCOLOR ART PRINTS (CLEAR OF POSTS & PEGBOARD!)
         ==================================================================== */}
      {[
        { pos: [-4.36, 2.18, -3.59] as [number, number, number], rotY: 0, tex: assets.cakePrintTex },
        { pos: [1.98, 2.58, -3.59] as [number, number, number], rotY: 0, tex: assets.berryPrintTex },
        { pos: [4.46, 2.68, -3.59] as [number, number, number], rotY: 0, tex: assets.lavenderPrintTex },
      ].map((art, ai) => (
        <group key={`art-${ai}`} position={art.pos} rotation={[0, art.rotY, 0]}>
          <mesh geometry={assets.artFrameGeo} material={assets.honeyOakMat} castShadow />
          <mesh position={[0, 0, 0.016]}>
            <planeGeometry args={[0.39, 0.47]} />
            <meshStandardMaterial map={art.tex} roughness={0.78} />
          </mesh>
        </group>
      ))}

      {/* ====================================================================
          4. SEGMENTED HIGH LOFT COOKBOOK GALLERY (CLEAR OF WINDOW #1 ROD, CHIMNEY HOOD & BASKET SHELF!)
         ==================================================================== */}
      <mesh position={[-4.62, 3.26, -3.44]} geometry={assets.loftBeamLeftGeo} material={assets.honeyOakMat} castShadow receiveShadow />
      <mesh position={[1.94, 3.26, -3.44]} geometry={assets.loftBeamRightGeo} material={assets.honeyOakMat} castShadow receiveShadow />
      {loftBooks.map((bk, bi) => (
        <mesh
          key={`loft-book-${bi}`}
          position={[bk.x, bk.y, -3.42]}
          rotation={[0, (bi % 3 - 1) * 0.05, bk.rotZ]}
          scale={[1, bk.scY, 1]}
          geometry={assets.bookGeo}
          material={assets.bookMats[bk.matIdx]}
          castShadow
        />
      ))}
      {/* Hollow Lathe Woven Basket seated cleanly on Right Loft Beam (`beamTopY = 3.290m`) */}
      <mesh position={[2.16, 3.290, -3.42]} rotation={[0, 0.3, 0]} geometry={assets.breadBasketGeo} material={assets.wovenRattanMat} castShadow />

      {/* Beveled Thick Braided Threshold Mat on East Veranda Timber Deck (ZERO paper-thin plane!) */}
      <mesh position={[5.32, -0.052, 0.65]} rotation={[0, Math.PI / 2, 0]} geometry={assets.verandaMatGeo} receiveShadow raycast={() => null}>
        <meshStandardMaterial map={craftAssets.juteRunnerTex} roughness={0.94} />
      </mesh>

      {/* ====================================================================
          5. COZY WICKER SOURDOUGH BASKET CLEAR OF KITCHEN RUNNER!
         ==================================================================== */}
      <group position={[1.82, 0, -1.85]} rotation={[0, -0.45, 0]}>
        <mesh geometry={assets.breadBasketGeo} material={assets.wovenRattanMat} castShadow receiveShadow />
        <mesh position={[0, 0.19, 0]} scale={[1.1, 0.32, 1.1]}>
          <sphereGeometry args={[0.175, 18, 10]} />
          <meshStandardMaterial map={craftAssets.ginghamTex} roughness={0.88} />
        </mesh>
        {/* Custom Sculpted Artisan Scored Sourdough Boules with Flour-Dusted Crust PBR! */}
        <mesh position={[-0.05, 0.215, 0.02]} rotation={[0.08, 0.45, -0.10]} geometry={assets.sourdoughBouleGeo} material={assets.sourdoughMat} castShadow />
        <mesh position={[0.075, 0.225, -0.035]} rotation={[-0.06, -0.72, 0.12]} geometry={assets.sourdoughSmallGeo} material={assets.sourdoughMat} castShadow />
      </group>

      {/* ====================================================================
          6. BEVELED WEST COZY WINDOW SEAT BENCH WITH TAILORED FRENCH LINEN & BOLSTER CUSHIONS
         ==================================================================== */}
      <group position={[-4.72, 0, -1.43]}>
        <mesh position={[0, 0.22, 0]} geometry={assets.windowBenchGeo} material={assets.honeyOakMat} castShadow receiveShadow />
        <mesh position={[0.02, 0.485, 0]} geometry={assets.cushionGeo} material={assets.linenCreamMat} castShadow receiveShadow />
        {/* Piped sage square linen backrest pillow with center button tuft */}
        <group position={[-0.22, 0.70, -0.34]} rotation={[0.06, 0.24, -0.22]}>
          <mesh geometry={assets.tailoredPillowGeo} material={assets.pillowSageMat} castShadow />
          <mesh position={[0.056, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={assets.linenCreamMat}>
            <cylinderGeometry args={[0.015, 0.015, 0.010, 12]} />
          </mesh>
        </group>
        {/* Soft blush tailored French cottage throw pillow */}
        <group position={[-0.19, 0.675, -0.02]} rotation={[-0.08, 0.06, -0.24]}>
          <mesh geometry={assets.tailoredSmallPillowGeo} material={assets.pillowBlushMat} castShadow />
          <mesh position={[0.052, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={assets.linenCreamMat}>
            <cylinderGeometry args={[0.013, 0.013, 0.010, 12]} />
          </mesh>
        </group>
        {/* Warm butter-linen cylindrical bolster pillow + cream end button caps */}
        <group position={[-0.15, 0.625, 0.42]} rotation={[Math.PI / 2 - 0.10, 0.0, 0.26]}>
          <mesh material={assets.pillowButterMat} castShadow>
            <cylinderGeometry args={[0.082, 0.082, 0.36, 22]} />
          </mesh>
          {[-0.18, 0.18].map((ey, ei) => (
            <mesh key={`bolcap-${ei}`} position={[0, ey, 0]} material={assets.linenCreamMat}>
              <cylinderGeometry args={[0.024, 0.024, 0.012, 14]} />
            </mesh>
          ))}
        </group>
        {/* Folded sage-linen throw neatly tucked over front-right seat cushion */}
        <mesh position={[0.14, 0.548, 0.46]} rotation={[0.02, -0.14, 0.06]} geometry={assets.throwBlanketGeo} material={assets.pillowSageMat} castShadow receiveShadow />
      </group>

      {/* ====================================================================
          7. SCULPTED 2-TIER PASTRY DISPLAY STAND ON COFFEE CART CENTER
             Custom Laminated Butter Croissants + Fluted Scalloped Fruit Tartlets!
         ==================================================================== */}
      <group position={[3.82, 0.859, -2.08]} rotation={[0, -0.32, 0]}>
        <mesh position={[0, 0.135, 0]} material={assets.honeyOakMat} castShadow>
          <cylinderGeometry args={[0.022, 0.032, 0.27, 22]} />
        </mesh>
        <mesh position={[0, 0.015, 0]} material={assets.honeyOakMat} castShadow receiveShadow>
          <cylinderGeometry args={[0.19, 0.18, 0.024, 32]} />
        </mesh>
        <mesh position={[0, 0.215, 0]} material={assets.honeyOakMat} castShadow receiveShadow>
          <cylinderGeometry args={[0.142, 0.134, 0.022, 32]} />
        </mesh>
        {/* Bottom Tier: 3 Custom Sculpted Tapered Laminated Butter Croissants! */}
        {[
          [-0.088, 0.026, 0.048, 0.55],
          [0.018, 0.026, -0.058, 2.45],
          [0.095, 0.026, 0.042, -1.10],
        ].map(([cx, cy, cz, ry], ci) => (
          <mesh
            key={`crois-${ci}`}
            position={[cx, cy, cz]}
            rotation={[0, ry, 0]}
            geometry={assets.croissantGeo}
            material={assets.pastryGoldMat}
            castShadow
          />
        ))}
        {/* Top Tier: 3 Fluted Scalloped Fruit Tartlets with Custard & Glossy Berries! */}
        {[
          { p: [-0.052, 0.236, 0.032] as [number, number, number], m: assets.berryRedMat },
          { p: [0.056, 0.236, 0.022] as [number, number, number], m: assets.berryApricotMat },
          { p: [-0.004, 0.236, -0.056] as [number, number, number], m: assets.berryRedMat },
        ].map((tart, ti) => (
          <group key={`tart-${ti}`} position={tart.p} rotation={[0, ti * 0.8, 0]}>
            <mesh geometry={assets.tartShellGeo} material={assets.pastryGoldMat} castShadow />
            <mesh position={[0, 0.014, 0]} scale={[1, 0.65, 1]} geometry={assets.custardPeakGeo} material={assets.custardMat} />
            <group position={[0, 0.022, 0]} rotation={[0.18, ti * 0.5, 0.12]}>
              <mesh geometry={assets.berryTopGeo} material={tart.m} castShadow />
              <mesh position={[0, 0.022, 0]} geometry={assets.calyxGeo}>
                <meshStandardMaterial color="#548C3C" roughness={0.64} side={THREE.DoubleSide} />
              </mesh>
            </group>
          </group>
        ))}
      </group>

      {/* ====================================================================
          8. MATHEMATICALLY GROUNDED HINGED CHALKBOARD "MENU DU JOUR" EASEL
             Both front & rear legs touch y = 0.000 + solid brass top hinge bar!
         ==================================================================== */}
      <group position={[4.52, 0, -1.24]} rotation={[0, -0.96, 0]}>
        {/* Brass Hinge Bar at top apex (y = 0.96, z = 0.0) joining front & rear A-frame! */}
        <mesh position={[0, 0.96, 0]} rotation={[0, 0, Math.PI / 2]} material={assets.brassMat} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 0.56, 16]} />
        </mesh>
        {/* Front Chalkboard Panel pivoted cleanly from top apex [0, 0.96, 0] */}
        <group position={[0, 0.96, 0]} rotation={[-0.18, 0, 0]}>
          <mesh position={[0, -0.43, 0.018]} geometry={assets.chalkboardFrameGeo} material={assets.honeyOakMat} castShadow receiveShadow />
          <mesh position={[0, -0.42, 0.037]}>
            <planeGeometry args={[0.48, 0.74]} />
            <meshStandardMaterial map={assets.chalkboardTex} roughness={0.86} />
          </mesh>
          {/* Beveled Front Legs extending cleanly down to y = 0.000 */}
          {[-0.24, 0.24].map((lx, li) => (
            <mesh key={li} position={[lx, -0.488, 0.018]} geometry={assets.chalkboardFrontLegGeo} material={assets.honeyOakMat} castShadow />
          ))}
        </group>
        {/* Beveled Rear Support Legs pivoted from exact same top apex [0, 0.96, 0] touching y = 0.000! */}
        <group position={[0, 0.96, 0]} rotation={[0.24, 0, 0]}>
          {[-0.22, 0.22].map((bx, bi) => (
            <mesh key={bi} position={[bx, -0.494, -0.018]} geometry={assets.chalkboardRearLegGeo} material={assets.honeyOakMat} castShadow />
          ))}
          <mesh position={[0, -0.62, -0.018]} geometry={assets.chalkboardCrossbarGeo} material={assets.honeyOakMat} castShadow />
        </group>
      </group>

      {/* ====================================================================
          9. ARCHED OPEN RECIPE BOOK, BEVELED DOUGH BOARD, EGGS & LADDER JAM JARS
         ==================================================================== */}
      {/* Curved Open Illustrated Recipe Book on Beveled Wooden Stand (y = 0.930m!) */}
      <group position={[-3.42, 0.930, -2.72]} rotation={[0, 0.24, 0]}>
        <mesh position={[0, 0.088, -0.01]} rotation={[-0.56, 0, 0]} geometry={assets.bookStandGeo} material={assets.honeyOakMat} castShadow />
        <mesh position={[0, 0.095, 0.002]} rotation={[-0.56, 0, 0]} geometry={assets.openBookGeo}>
          <meshStandardMaterial map={assets.recipeBookTex} roughness={0.82} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Beveled Dough Board + Zero-Z-Fight Flour Mound + Flush Rolling Pin (y = 0.930m!) */}
      <group position={[-3.84, 0.930, -2.74]} rotation={[0, 0.12, 0]}>
        <mesh position={[0, 0.012, 0]} geometry={assets.doughBoardGeo} material={assets.honeyOakMat} castShadow receiveShadow />
        {/* Slightly raised matte flour dusting disc (y = 0.0265 — ZERO Z-fighting!) */}
        <mesh position={[-0.02, 0.0265, 0.01]} scale={[1.0, 0.06, 0.94]}>
          <sphereGeometry args={[0.125, 22, 8]} />
          <meshStandardMaterial color="#FDF9EE" roughness={0.97} />
        </mesh>
        <mesh position={[0.025, 0.030, 0.01]}>
          <cylinderGeometry args={[0.092, 0.096, 0.007, 28]} />
          <meshStandardMaterial color="#F2DCAA" roughness={0.78} />
        </mesh>
        {/* Turned Beechwood Rolling Pin resting strictly FLUSH on board top (0.024 + 0.022 = 0.046!) */}
        <group position={[0.02, 0.046, -0.082]} rotation={[0, 0.18, Math.PI / 2]}>
          <mesh material={assets.honeyOakMat} castShadow>
            <cylinderGeometry args={[0.022, 0.022, 0.22, 22]} />
          </mesh>
          <mesh material={assets.honeyOakMat}>
            <cylinderGeometry args={[0.011, 0.011, 0.34, 16]} />
          </mesh>
        </group>
      </group>

      {/* Beveled Kraft Egg Carton cleanly placed on Left Workbench Front Open Spot (`[-2.42, 0.930, -2.64]` — ZERO overlaps!) */}
      <group position={[-2.42, 0.930, -2.64]} rotation={[0, 0.14, 0]}>
        <mesh position={[0, 0.022, 0]} geometry={assets.eggCartonGeo} castShadow>
          <meshStandardMaterial color="#D8C2A0" bumpMap={assets.linenCreamPbr.bumpMap} bumpScale={0.004} roughness={0.94} />
        </mesh>
        {[-0.05, 0.0, 0.05].map((ex, ei) => (
          <mesh key={ei} position={[ex, 0.056, 0]} scale={[0.85, 1.15, 0.85]} castShadow>
            <sphereGeometry args={[0.022, 16, 12]} />
            <meshStandardMaterial color={ei === 1 ? '#F7EFE0' : '#DEC09A'} roughness={0.58} />
          </mesh>
        ))}
      </group>

      {/* 2 Hollow Lathe Honey & Strawberry Jam Jars cleanly clear of Breadbox & Egg Carton! */}
      {[
        { x: -2.18, z: -2.74, fill: '#E49E24' },
        { x: -2.04, z: -2.74, fill: '#C82838' },
      ].map((jam, ji) => (
        <group key={`jam-${ji}`} position={[jam.x, 0.930, jam.z]} rotation={[0, ji * 0.5, 0]}>
          <mesh position={[0, 0.048, 0]}>
            <cylinderGeometry args={[0.036, 0.038, 0.088, 20]} />
            <meshPhysicalMaterial color={jam.fill} roughness={0.34} clearcoat={0.14} envMapIntensity={0.36} />
          </mesh>
          <mesh geometry={assets.jamJarGeo} material={assets.glassJarMat} castShadow />
          <mesh position={[0, 0.105, 0]} scale={[1.15, 0.50, 1.15]}>
            <sphereGeometry args={[0.042, 16, 10]} />
            <meshStandardMaterial map={craftAssets.ginghamTex} roughness={0.88} />
          </mesh>
        </group>
      ))}

      {/* ====================================================================
          10. LOTUS-PAD CREEK WATER LILIES, BEVELED BIRDHOUSE, CURVED PICKET FENCE
              & PAINTERLY RIDGE TREELINE!
         ==================================================================== */}
      {/* Blooming Water Lilies seated on Floating Emerald Lily Pads at sunken creek level (`y = -0.382`) */}
      {[
        { p: [7.65, -0.382, -1.85] as [number, number, number], pink: true, r: 0.4 },
        { p: [8.32, -0.382, -0.45] as [number, number, number], pink: false, r: 1.8 },
        { p: [7.82, -0.382, 2.55] as [number, number, number], pink: true, r: 2.6 },
        { p: [8.58, -0.382, 3.85] as [number, number, number], pink: false, r: 4.1 },
        { p: [8.95, -0.382, 6.25] as [number, number, number], pink: true, r: 0.9 },
      ].map((wl, li) => (
        <group key={`wlily-${li}`} position={wl.p} rotation={[0, wl.r, 0]}>
          <mesh geometry={assets.lilyPadGeo} material={assets.lilyPadMat} />
          <mesh
            position={[0, 0.012, 0]}
            scale={[1.45, 0.85, 1.45]}
            geometry={assets.lilyBlossomGeo}
            material={wl.pink ? assets.lilyPinkMat : assets.lilyIvoryMat}
          />
          <mesh position={[0, 0.022, 0]} geometry={assets.lilyCoreGeo} material={assets.lilyCoreMat} />
        </group>
      ))}

      {/* Cozy Garden Warm Post Lantern grounded cleanly at `y = -0.36` */}
      <group position={[6.32, -0.36, 2.08]}>
        <mesh position={[0, 0.68, 0]} material={assets.honeyOakMat} castShadow>
          <cylinderGeometry args={[0.042, 0.056, 1.36, 16]} />
        </mesh>
        <mesh position={[0, 1.42, 0]}>
          <cylinderGeometry args={[0.088, 0.072, 0.20, 8]} />
          <meshStandardMaterial color="#FFF2CA" emissive="#FFA838" emissiveIntensity={1.85} roughness={0.22} />
        </mesh>
        <mesh position={[0, 1.56, 0]} material={assets.sageWoodMat} castShadow>
          <coneGeometry args={[0.14, 0.12, 8]} />
        </mesh>
      </group>

      {/* Beveled French Cottage Birdhouse grounded cleanly at `y = -0.36` East of sunken creek */}
      <group position={[9.72, -0.36, -1.55]} rotation={[0, -1.25, 0]}>
        <mesh position={[0, 0.86, 0]} material={assets.honeyOakMat} castShadow>
          <cylinderGeometry args={[0.034, 0.042, 1.72, 16]} />
        </mesh>
        <mesh position={[0, 1.76, 0]} geometry={assets.birdhouseBodyGeo} material={assets.creamPaintMat} castShadow />
        <mesh position={[0, 1.94, 0]} rotation={[0, Math.PI / 4, 0]} material={assets.sageWoodMat} castShadow>
          <coneGeometry args={[0.22, 0.17, 4]} />
        </mesh>
        <mesh position={[0, 1.78, 0.112]} rotation={[Math.PI / 2, 0, 0]} material={assets.honeyOakMat}>
          <torusGeometry args={[0.036, 0.008, 8, 20]} />
        </mesh>
        <mesh position={[0, 1.78, 0.111]}>
          <circleGeometry args={[0.032, 18]} />
          <meshStandardMaterial color="#2D1D14" roughness={0.95} />
        </mesh>
        <mesh position={[0, 1.71, 0.135]} rotation={[Math.PI / 2, 0, 0]} material={assets.honeyOakMat}>
          <cylinderGeometry args={[0.006, 0.006, 0.055, 10]} />
        </mesh>
      </group>

      {/* Distant Painterly Ghibli Volumetric Woodland & Provence Cypress Groves (ZERO giant flat leaves!) */}
      <instancedMesh ref={distantTreeTrunkRef} args={[undefined, undefined, 44]} userData={{ excludeFromOutline: true }}>
        <cylinderGeometry args={[0.55, 0.92, 1.0, 10]} />
        <meshStandardMaterial color="#6D4E38" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={distantTreeCanopyRef} args={[assets.ridgeLeafGeo, undefined, 44 * 4]} material={assets.distantTreeCanopyMat} userData={{ excludeFromOutline: true }} />

      {/* 隐藏旧版山坡零散野花，全面改为法式庄园成簇绣球花境与整齐薰衣草花田带 */}
      <instancedMesh ref={meadowFlowersRef} visible={false} args={[assets.shelfDaisyGeo, undefined, 180]} material={assets.meadowFlowersMat} />

      {/* Grounded Working French Storybook Stone Windmill on Mossy Plinth (relocated clear off East Footbridge vista!) */}
      <group position={[24.5, sampleGhibliTerrainHeight(24.5, -14.5) - 0.04, -14.5]} rotation={[0, -0.78, 0]}>
        {/* Mossy Dry-Stone Foundation Mound & Circular Apron embedded firmly below meadow y=-0.36 */}
        <mesh position={[0, 0.22, 0]} receiveShadow>
          <cylinderGeometry args={[1.48, 1.95, 0.56, 22]} />
          <meshStandardMaterial map={craftAssets.rubbleStone.map} roughness={0.94} color="#8E967E" />
        </mesh>
        {/* Tapered Warm Cream-Stone Windmill Tower */}
        <mesh position={[0, 1.72, 0]} material={assets.creamPaintMat} castShadow receiveShadow>
          <cylinderGeometry args={[0.72, 1.18, 2.65, 24]} />
        </mesh>
        {/* Stone Base Collar Trim */}
        <mesh position={[0, 0.56, 0]}>
          <cylinderGeometry args={[1.20, 1.26, 0.28, 24]} />
          <meshStandardMaterial map={craftAssets.rubbleStone.map} roughness={0.92} color="#9C9584" />
        </mesh>
        {/* Arched Oak Mill Door + Timber Frame + Stone Step */}
        <mesh position={[0, 0.92, 1.12]} material={assets.honeyOakMat}>
          <boxGeometry args={[0.48, 0.78, 0.12]} />
        </mesh>
        <mesh position={[0, 1.31, 1.12]} rotation={[Math.PI / 2, 0, 0]} material={assets.honeyOakMat}>
          <cylinderGeometry args={[0.24, 0.24, 0.12, 16]} />
        </mesh>
        <mesh position={[0, 0.50, 1.24]}>
          <boxGeometry args={[0.62, 0.14, 0.30]} />
          <meshStandardMaterial color="#9E988A" roughness={0.92} />
        </mesh>
        {/* Recessed Shuttered Upper Cottage Windows */}
        {[-0.55, 0.55].map((wa, wi) => (
          <group key={`wm-win-${wi}`} position={[Math.sin(wa) * 0.94, 2.02, Math.cos(wa) * 0.94]} rotation={[0, wa, 0]}>
            <mesh material={assets.honeyOakMat}>
              <boxGeometry args={[0.32, 0.38, 0.08]} />
            </mesh>
            <mesh position={[0, 0, 0.044]}>
              <planeGeometry args={[0.22, 0.28]} />
              <meshStandardMaterial color="#FFE7A6" emissive="#FFB84A" emissiveIntensity={0.55} roughness={0.35} />
            </mesh>
            <mesh position={[-0.20, 0, 0.02]} material={assets.sageWoodMat}>
              <boxGeometry args={[0.10, 0.36, 0.04]} />
            </mesh>
            <mesh position={[0.20, 0, 0.02]} material={assets.sageWoodMat}>
              <boxGeometry args={[0.10, 0.36, 0.04]} />
            </mesh>
          </group>
        ))}
        {/* Encircling Wooden Miller's Gallery Deck & Timber Baluster Rail */}
        <mesh position={[0, 1.56, 0]} material={assets.honeyOakMat}>
          <cylinderGeometry args={[1.38, 1.32, 0.09, 24]} />
        </mesh>
        <mesh position={[0, 1.92, 0]} rotation={[Math.PI / 2, 0, 0]} material={assets.honeyOakMat}>
          <torusGeometry args={[1.34, 0.032, 8, 28]} />
        </mesh>
        {Array.from({ length: 12 }).map((_, bi) => {
          const ba = (bi / 12) * Math.PI * 2;
          return (
            <mesh key={bi} position={[Math.cos(ba) * 1.33, 1.74, Math.sin(ba) * 1.33]} material={assets.honeyOakMat}>
              <cylinderGeometry args={[0.022, 0.024, 0.36, 6]} />
            </mesh>
          );
        })}
        {/* Conical Terracotta-Shingled Roof Cap + Brass Finial Spire */}
        <mesh position={[0, 3.48, 0]} castShadow>
          <coneGeometry args={[0.92, 1.02, 24]} />
          <meshStandardMaterial color="#B86446" roughness={0.84} />
        </mesh>
        <mesh position={[0, 4.10, 0]} material={assets.brassMat}>
          <cylinderGeometry args={[0.015, 0.025, 0.36, 10]} />
        </mesh>
        <mesh position={[0, 4.24, 0]} material={assets.brassMat}>
          <sphereGeometry args={[0.06, 12, 10]} />
        </mesh>
        {/* Slowly Rotating Timber Hub + 4 Latticed Wooden Sail Frames with Cream Linen Canvas Sails! */}
        <group ref={windmillSailsRef} position={[0, 2.78, 0.86]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={assets.honeyOakMat}>
            <cylinderGeometry args={[0.14, 0.16, 0.24, 16]} />
          </mesh>
          {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((ang, si) => (
            <group key={si} rotation={[0, 0, ang + 0.35]}>
              {/* Main tapered wooden sail spar */}
              <mesh position={[0, 1.05, 0.04]} material={assets.honeyOakMat}>
                <boxGeometry args={[0.07, 2.05, 0.05]} />
              </mesh>
              {/* Side lattice rail + 5 cross-battens */}
              <mesh position={[0.38, 1.18, 0.04]} material={assets.honeyOakMat}>
                <boxGeometry args={[0.036, 1.58, 0.036]} />
              </mesh>
              {[0.52, 0.84, 1.16, 1.48, 1.80].map((ry, ri) => (
                <mesh key={ri} position={[0.19, ry, 0.04]} material={assets.honeyOakMat}>
                  <boxGeometry args={[0.42, 0.032, 0.032]} />
                </mesh>
              ))}
              {/* Stitched cream linen sail cloth */}
              <mesh position={[0.20, 1.18, 0.064]}>
                <planeGeometry args={[0.34, 1.50]} />
                <meshStandardMaterial color="#FAF3E2" roughness={0.86} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
        </group>
      </group>

      {/* Forest Lawn Wedding Gazebo, Ceremony Aisle, 28 French Chairs & Adjacent Outdoor Banquet Showcase */}
      <WeddingAndBanquetShowcase
        creamPaintMat={assets.creamPaintMat}
        honeyOakMat={assets.honeyOakMat}
        linenCreamMat={assets.linenCreamMat}
        brassMat={assets.brassMat}
        berryRedMat={assets.berryRedMat}
        glassJarMat={assets.glassJarMat}
        roseGeo={assets.lilyBlossomGeo}
        strawberryGeo={assets.berryTopGeo}
        calyxGeo={assets.calyxGeo}
      />

      {/* Stemmed French Lavender nestled strictly on Near-Bank Stone Planter Terraces & Cottage Curb Borders */}
      <instancedMesh ref={lavenderStemsRef} args={[undefined, undefined, 180]} material={assets.lavenderStemMat}>
        <cylinderGeometry args={[0.005, 0.007, 0.24, 6]} />
      </instancedMesh>
      <instancedMesh ref={lavenderSpikesRef} args={[undefined, undefined, 180]} material={assets.lavenderSpikeMat}>
        <capsuleGeometry args={[0.020, 0.14, 6, 10]} />
      </instancedMesh>

      {/* Indoor Cascading Trailing Vine Stems + Attached Pothos Leaves (ZERO stemless floating leaves!) */}
      {assets.vineStemGeos.map((vg, vi) => (
        <mesh key={`vstem-${vi}`} geometry={vg} material={assets.vineStemMat} />
      ))}
      <instancedMesh ref={shelfVineLeavesRef} args={[assets.shelfLeafGeo, undefined, assets.vineLeafTransforms.length]} castShadow>
        <meshStandardMaterial roughness={0.60} side={THREE.DoubleSide} />
      </instancedMesh>

      {/* Stylized Hand-Drawn Curling Tea Steam aligned strictly to Step 7 Teapot Spout Tip (`[3.086, 0.941, 0.505]`) */}
      <CozyHanddrawnSteam
        position={[3.086, 0.941, 0.505]}
        intensity={1.08}
        tint="#FFF9EE"
        puffCount={8}
        riseHeight={0.38}
        spreadRadius={0.028}
        puffScale={0.068}
        driftX={0.016}
      />

      {/* Warm Glowing Hearth Ember Sparks rising inside the open burning log firebox (`y = 0.24..0.52`) */}
      <group ref={hearthEmbersRef} position={[-1.15, 0.24, -3.02]}>
        {[0, 1, 2, 3, 4, 5].map((ei) => (
          <mesh
            key={ei}
            position={[(ei - 2.5) * 0.09, 0.06, 0]}
            geometry={assets.emberGeo}
            material={ei % 2 === 0 ? assets.emberWarmMat : assets.emberHotMat}
            raycast={() => null}
          />
        ))}
      </group>
    </group>
  );
};
