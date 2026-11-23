import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { RoundedCottageAppliancesPack, SmegRetroPastryFridge } from './RoundedCottageAppliances';
import { CozyBotanicalAndClutterPack } from './CozyBotanicalAndClutterPack';
import {
  createBelliedKettleBodyGeo,
  createFlutedTartShellGeo,
  createHollowFlutedBundtGeo,
  createHollowVesselLatheGeo,
  createMicroSurfaceMaps,
  createPleatedClothCurtainGeo,
  createQuiltedPastryBagTexture,
  createTurnedBalusterLegGeo,
  createWoodGrainPbr,
  createWovenFabricPbr,
} from './cottageHighCraftPbr';
import { patisserieAudio } from '../../audio/patisserieAudio';
import {
  applyTextureAnisotropy,
  ensureSecondaryUv,
  getAtelierTextures,
  getMarblePbrSet,
  getSteelPbrSet,
} from '../../textures/atelierTextures';
import { createVaporMistMaterial, enhanceWithFoodSSS } from '../../shaders/atelierShaders';
import { enhanceWithExtremeMicroCraft } from '../../shaders/extremeThreeJsUpgrades';
import { CozyHanddrawnSteam, enhanceWithStylizedFresnelRim } from '../../shaders/stylizedCozyUpgrades';
import {
  createApothecaryLidGeometry,
  createBakingParchmentDiscGeometry,
  createBeveledBoxGeometry,
  createBeveledFrameGeometry,
  createBeveledMarbleTabletopGeometry,
  createBrassTweezersGeometry,
  createChocolateCurlGeometry,
  createCitrusLeafGeometry,
  createCrankedSpatulaBladeGeometry,
  createCupEarHandleGeometry,
  createDrupeletRaspberryGeometry,
  createEspressoCupGeometry,
  createEspressoSaucerGeometry,
  createFlutedPipingNozzleGeometry,
  createFoldedLinenNapkinGeometry,
  createForgedPanHandleGeometry,
  createGlassVesselGeometry,
  createGoldLeafFlakeGeometry,
  createGueridonPedestalGeometry,
  createMauvielCopperPotGeometry,
  createMauvielTinLinerGeometry,
  createSeamlessLatheGeometry,
  weldLatheSeamNormals,
  createMousseRingGeometry,
  createPipingBagGeometry,
  createPistachioKernelGeometry,
  createRollingPinGeometry,
  createScallopedHutchCorniceGeometry,
  createScraperHandleGeometry,
  createSilverCakeKnifeBladeGeometry,
  createSilverKnifeHandleGeometry,
  createSleekIrProbeGeometry,
  createSlottedEvaporatorGrilleGeometry,
  createMiniStrawberryGeometry,
  createStrawberryCalyxGeometry,
  createTiedFlourSackGeometry,
  createTriangularScraperBladeGeometry,
  createTurnedHandleGeometry,
  createTurntablePedestalGeometry,
  createVanillaPodGeometry,
  createWhiteChocCurlFlakeGeometry,
  createWireWhiskWiresGeometry,
} from '../../geometry/patisserieGeometry';
import { ENTREMET_FLAVOR_PRESETS, resolveFlavorId } from '../cake/cakeFlavors';
import { useGameStore } from '../../store/useGameStore';
import { getCottageCraftAssets } from '../environment/cottageTexturesAndFlora';

const MARBLE_SLAB_NORMAL_SCALE = new THREE.Vector2(0.36, 0.36);
const COPPER_NORMAL_SCALE = new THREE.Vector2(0.75, 0.75);
const LINEN_NORMAL_SCALE = new THREE.Vector2(0.55, 0.55);
const STEEL_NORMAL_SCALE = new THREE.Vector2(0.28, 0.28);

interface OptionalMechanicsSlice {
  mechanics?: {
    ovenActive?: boolean;
    ovenTemp?: number;
    chillerDoorOpen?: boolean;
    chillerActive?: boolean;
  };
}

function drawDigitalReadout(
  canvas: HTMLCanvasElement,
  bg: string,
  fg: string,
  label: string,
  valueText: string
) {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(218, 184, 108, 0.65)';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  ctx.fillStyle = '#D7C49E';
  ctx.font = 'bold 34px "Noto Serif SC", "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, w * 0.5, 56);

  ctx.strokeStyle = 'rgba(218, 184, 108, 0.32)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(42, 74);
  ctx.lineTo(w - 42, 74);
  ctx.stroke();

  ctx.fillStyle = fg;
  ctx.font = 'bold 78px "JetBrains Mono", monospace';
  ctx.fillText(valueText, w * 0.5, 152);
}

function createDigitalReadoutTexture(
  bg: string,
  fg: string,
  label: string,
  valueText: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 192;
  drawDigitalReadout(canvas, bg, fg, label, valueText);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function drawOvenGauge(canvas: HTMLCanvasElement, targetTemp: number) {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  ctx.fillStyle = '#FAF3E3';
  ctx.beginPath();
  ctx.arc(128, 128, 122, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#332920';
  ctx.lineWidth = 4;
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * 0.75 + (i / 12) * (Math.PI * 1.5);
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * 90, 128 + Math.sin(a) * 90);
    ctx.lineTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112);
    ctx.stroke();
  }

  ctx.fillStyle = '#332920';
  ctx.font = 'bold 24px serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(targetTemp)}°C`, 128, 184);

  const norm = THREE.MathUtils.clamp((targetTemp - 120) / 110, 0, 1);
  const needleAngle = Math.PI * 0.75 + norm * Math.PI * 1.5;
  ctx.strokeStyle = '#B82328';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(128, 128);
  ctx.lineTo(128 + Math.cos(needleAngle) * 86, 128 + Math.sin(needleAngle) * 86);
  ctx.stroke();

  ctx.fillStyle = '#C8A256';
  ctx.beginPath();
  ctx.arc(128, 128, 11, 0, Math.PI * 2);
  ctx.fill();
}

function createOvenGaugeTexture(targetTemp: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  drawOvenGauge(canvas, targetTemp);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createOvenKnobDialTexture(kind: 'temp' | 'timer' | 'mode'): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size * 0.5;

  ctx.fillStyle = '#F5ECE0';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#9D7B48';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(half, half, half - 4, 0, Math.PI * 2);
  ctx.stroke();

  const labels =
    kind === 'temp'
      ? ['140', '160', '175', '190', '210']
      : kind === 'timer'
        ? ['0', '15', '30', '45', '60']
        : ['预热', '上下', '石窑', '强火', '保温'];

  ctx.strokeStyle = '#3B2C20';
  ctx.fillStyle = '#3B2C20';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const ang = -Math.PI * 1.2 + t * Math.PI * 1.4;
    const isMajor = i % 2 === 0;
    const r0 = isMajor ? 45 : 49;
    const r1 = 56;
    ctx.lineWidth = isMajor ? 2.2 : 1.2;
    ctx.beginPath();
    ctx.moveTo(half + Math.cos(ang) * r0, half + Math.sin(ang) * r0);
    ctx.lineTo(half + Math.cos(ang) * r1, half + Math.sin(ang) * r1);
    ctx.stroke();
    if (isMajor) {
      const idx = Math.floor(i / 2);
      const tx = half + Math.cos(ang) * 35;
      const ty = half + Math.sin(ang) * 35;
      ctx.fillText(labels[idx] ?? '', tx, ty);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function drawSixPetalRosette(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function createMichelinGuideCoverTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 320;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Rich crimson morocco leather base
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#9B1322');
  grad.addColorStop(0.5, '#8A0F1D');
  grad.addColorStop(1, '#750B16');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle embossed leather pebble grain
  ctx.fillStyle = 'rgba(255, 220, 220, 0.035)';
  for (let y = 0; y < h; y += 4) {
    for (let x = (y % 8 === 0 ? 0 : 2); x < w; x += 4) {
      ctx.fillRect(x, y, 1.5, 1.5);
    }
  }

  // Spine crease shadow on left
  const spineGrad = ctx.createLinearGradient(0, 0, 26, 0);
  spineGrad.addColorStop(0, 'rgba(20, 2, 4, 0.45)');
  spineGrad.addColorStop(0.6, 'rgba(255, 180, 180, 0.08)');
  spineGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = spineGrad;
  ctx.fillRect(0, 0, 26, h);

  // Double gold-foil fillet border
  ctx.strokeStyle = '#E5C06E';
  ctx.lineWidth = 3.5;
  ctx.strokeRect(18, 16, w - 32, h - 32);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(25, 23, w - 46, h - 46);

  // Gold-foil embossed Chinese typography & 3-star rosette emblem
  ctx.fillStyle = '#F2D283';
  ctx.textAlign = 'center';
  ctx.font = 'bold 23px "Noto Serif SC", "Songti SC", "Microsoft YaHei", serif';
  ctx.fillText('林间烘焙手记', w * 0.52, 68);

  ctx.font = '600 13px "Noto Serif SC", "PingFang SC", "Microsoft YaHei", serif';
  ctx.fillStyle = '#DFBA6A';
  ctx.fillText('花房甜品工坊 · 典藏', w * 0.52, 94);

  // Central gold medallion ring
  ctx.strokeStyle = '#E5C06E';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(w * 0.52, 164, 48, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#F6DA8F';
  drawSixPetalRosette(ctx, w * 0.52 - 24, 164, 10);
  drawSixPetalRosette(ctx, w * 0.52, 164, 12);
  drawSixPetalRosette(ctx, w * 0.52 + 24, 164, 10);

  ctx.fillStyle = '#F2D283';
  ctx.font = 'bold 16px "Noto Serif SC", "Songti SC", "Microsoft YaHei", serif';
  ctx.fillText('三星手作精选', w * 0.52, 250);
  ctx.font = '600 12px "Noto Serif SC", "PingFang SC", "Microsoft YaHei", serif';
  ctx.fillStyle = '#DFBA6A';
  ctx.fillText('四季时令 · 庄园寻味', w * 0.52, 274);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createSoftMistSpriteTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.35, 'rgba(240, 250, 255, 0.58)');
  grad.addColorStop(0.72, 'rgba(224, 244, 255, 0.16)');
  grad.addColorStop(1.0, 'rgba(224, 244, 255, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBrassRulerTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 96;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#DFBE70');
  grad.addColorStop(0.5, '#C9A14F');
  grad.addColorStop(1, '#B48B3C');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Fine brushed champagne-brass hairline grain
  ctx.fillStyle = 'rgba(255, 248, 220, 0.09)';
  for (let y = 0; y < h; y += 3) {
    ctx.fillRect(0, y, w, 1);
  }

  // Engraved millimeter & centimeter graduations along top calibration edge
  ctx.strokeStyle = '#332414';
  const startX = 28;
  const usableW = w - 56;
  const totalMm = 200;
  for (let mm = 0; mm <= totalMm; mm += 2) {
    const x = startX + (mm / totalMm) * usableW;
    const isCm = mm % 10 === 0;
    const isHalfCm = mm % 5 === 0;
    const tickH = isCm ? 24 : isHalfCm ? 16 : 9;
    ctx.lineWidth = isCm ? 1.8 : 1.0;
    ctx.beginPath();
    ctx.moveTo(x, 4);
    ctx.lineTo(x, 4 + tickH);
    ctx.stroke();
  }

  ctx.fillStyle = '#332414';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  for (let cm = 0; cm <= 20; cm += 2) {
    const x = startX + (cm / 20) * usableW;
    ctx.fillText(`${cm}`, x, 40);
  }

  ctx.font = 'bold 16px "Noto Serif SC", "Songti SC", "Microsoft YaHei", serif';
  ctx.textAlign = 'left';
  ctx.fillText('林间花房烘焙小屋 · 调温尺', 28, 74);
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('45°C → 27°C → 31.5°C', w - 28, 74);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createTemperedChocolatePuddleGeometry(): THREE.BufferGeometry {
  const outerR = 0.156;
  const maxH = 0.0074;
  const radialSteps = 24;
  const segments = 64;
  const pts: THREE.Vector2[] = [];
  for (let s = 0; s <= radialSteps; s++) {
    const t = s / radialSteps; // 0 (rim) -> 1 (center)
    const r = s === radialSteps ? 0.0 : outerR * (1.0 - t);
    // Smooth cosine meniscus rising cleanly from rounded rim (t=0) to flat glossy center plateau (t=1)
    const h = s === 0 ? 0.0 : maxH * Math.pow(Math.sin(t * Math.PI * 0.5), 0.76);
    pts.push(new THREE.Vector2(r, h));
  }
  const g = new THREE.LatheGeometry(pts, segments);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > 0.002) {
      const ang = Math.atan2(z, x);
      const radialMod = 1.0 + 0.065 * Math.sin(ang * 3.0 + 0.4) + 0.04 * Math.cos(ang * 5.0 - 0.7);
      const edgeDamp = Math.pow(Math.max(0, 1.0 - (r / outerR) ** 2), 2.2);
      // Zero angular ripple across center crown (r <= 0.032m) so center never forms an astigmatic pole pinch
      const centerSmooth = THREE.MathUtils.smoothstep(r, 0.032, 0.092);
      const gentleFlow = y > 0.0018 ? Math.sin(r * 16.0 + ang * 2.0) * 0.00028 * edgeDamp * centerSmooth : 0;
      pos.setXYZ(i, x * radialMod, Math.max(0, y + gentleFlow), z * radialMod);
    }
  }
  weldLatheSeamNormals(g, radialSteps + 1, segments);
  const norm = g.attributes.normal;
  if (norm) {
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      const y = pos.getY(i);
      if (y > maxH * 0.65 && r < 0.016) {
        const blend = 1.0 - THREE.MathUtils.smoothstep(r, 0.001, 0.016);
        const nx = THREE.MathUtils.lerp(norm.getX(i), 0, blend);
        const ny = THREE.MathUtils.lerp(norm.getY(i), 1, blend);
        const nz = THREE.MathUtils.lerp(norm.getZ(i), 0, blend);
        const len = Math.hypot(nx, ny, nz) || 1;
        norm.setXYZ(i, nx / len, ny / len, nz / len);
      }
    }
    norm.needsUpdate = true;
  }
  return g;
}

function createPantryFasciaSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#4E311B');
  grad.addColorStop(0.5, '#3F2614');
  grad.addColorStop(1, '#311C0D');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(218, 178, 102, 0.85)';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  ctx.strokeStyle = 'rgba(218, 178, 102, 0.40)';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

  ctx.fillStyle = '#D9B166';
  for (const sx of [64, canvas.width - 64]) {
    ctx.beginPath();
    ctx.arc(sx, canvas.height * 0.5, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#FAF0D6';
  ctx.font = 'bold 46px "Noto Serif SC", "STKaiti", "Songti SC", "PingFang SC", "Microsoft YaHei", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('林间花房烘焙工坊', canvas.width * 0.5, canvas.height * 0.52);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createFlourSackTagTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#F7EFE0';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#8B2E26';
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, 228, 228);
  ctx.strokeStyle = 'rgba(139, 46, 38, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, 208, 208);

  ctx.fillStyle = '#B8893E';
  ctx.beginPath();
  ctx.arc(128, 66, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#3B2518';
  ctx.font = 'bold 34px "Noto Serif SC", "PingFang SC", "Microsoft YaHei", serif';
  ctx.textAlign = 'center';
  ctx.fillText('法式低筋面粉', 128, 128);

  ctx.fillStyle = '#8B2E26';
  ctx.font = 'bold 44px "Noto Serif SC", Georgia, serif';
  ctx.fillText('T45', 128, 186);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createCanisterLabelTexture(label: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FCF8EE';
  ctx.fillRect(0, 0, 256, 160);
  ctx.strokeStyle = '#A8823B';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 236, 140);
  ctx.strokeStyle = 'rgba(168, 130, 59, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, 220, 124);

  ctx.fillStyle = '#3A281A';
  ctx.font = 'bold 44px "Noto Serif SC", "PingFang SC", "Microsoft YaHei", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 82);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Grand Baker's Pantry Hutch & Storage Credenza (`[0.36, 0.000, -3.30]`, `1.04m × 0.44m × 2.18m`)
 * Grounded cleanly between Stone Hearth and Mint Fridge with tied Chinese-labeled flour sacks,
 * apothecary ingredient jars, honey dipper, nesting mixing bowls, rolling pins, labeled canisters,
 * rosemary & cornice trailing ivy, timber Chinese workshop fascia plaque & forged brass pan rail!
 */
const ArtisanBakerPantryCabinet: React.FC<{
  position: [number, number, number];
  oakWoodMat: THREE.Material;
  elmWoodMat: THREE.Material;
  wickerMat: THREE.Material;
  copperMat: THREE.Material;
  tinMat: THREE.Material;
  brassMat: THREE.Material;
  crystalGlassMat: THREE.Material;
  apothecaryJarGeo: THREE.BufferGeometry;
  apothecaryLidGeo: THREE.BufferGeometry;
  spiceFillGeo: THREE.BufferGeometry;
  utensilCrockGeo: THREE.BufferGeometry;
  herbPotGeo: THREE.BufferGeometry;
  sprigGeo: THREE.BufferGeometry;
  leafMat: THREE.Material;
  creamEnamelMat: THREE.Material;
  celadonGlazeMat: THREE.Material;
  stonewareMat: THREE.Material;
  terracottaMat: THREE.Material;
  porcelainPitcherGeo: THREE.BufferGeometry;
}> = ({
  position,
  oakWoodMat,
  elmWoodMat,
  wickerMat,
  copperMat,
  tinMat,
  brassMat,
  crystalGlassMat,
  apothecaryJarGeo,
  apothecaryLidGeo,
  spiceFillGeo,
  utensilCrockGeo,
  herbPotGeo,
  sprigGeo,
  leafMat,
  creamEnamelMat,
  celadonGlazeMat,
  stonewareMat,
  terracottaMat,
  porcelainPitcherGeo,
}) => {
  const {
    plinthGeo,
    lowerBackGeo,
    lowerSideGeo,
    lowerShelfGeo,
    doorFrameGeo,
    doorPanelGeo,
    drawerFrontGeo,
    worktopGeo,
    hutchBackGeo,
    hutchSideGeo,
    hutchShelfGeo,
    corniceGeo,
    flourSackGeo,
    bannetonGeo,
    loafPanGeo,
    mixingBowlGeo,
    rollingPinGeo,
    canisterGeo,
    vanillaBottleGeo,
    copperCupGeo,
    charlotteMoldGeo,
    harvestBasketGeo,
    handleGeo,
    whiskGeo,
    microMaps,
    linenPbr,
    fasciaTex,
    sackTagTex,
    canisterLabelTexs,
    sageCabinetMat,
    linenSackMat,
    castIronMat,
    honeyMat,
    darkWoodMat,
    soilMat,
    fasciaMat,
    sackTagMat,
    canisterLabelMats,
    cacaoFillMat,
    sugarFillMat,
    almondFillMat,
    pistachioFillMat,
    berryFillMat,
    pastels,
  } = useMemo(() => {
    const mMaps = createMicroSurfaceMaps(0.36, 0.08, false, 642);
    const lPbr = createWovenFabricPbr('#EFE6D2', '#C5B698', 643);
    const fTex = createPantryFasciaSignTexture();
    const sTex = createFlourSackTagTexture();
    const cTexs = [
      createCanisterLabelTexture('纯可可粉'),
      createCanisterLabelTexture('伯爵红茶'),
      createCanisterLabelTexture('香草糖粉'),
    ];
    const makeTintMat = (hex: string, rough = 0.46) =>
      enhanceWithStylizedFresnelRim(
        new THREE.MeshPhysicalMaterial({
          color: hex,
          roughness: rough,
          clearcoat: 0.16,
          clearcoatRoughness: 0.34,
          envMapIntensity: 0.36,
        }),
        { rimColor: '#FFE4B0', rimStrength: 0.30, rimPower: 2.6, topBias: 0.42, cacheTag: `pantry-tin-${hex}` }
      );
    return {
      plinthGeo: createBeveledBoxGeometry(1.04, 0.080, 0.44, 0.014, 0.006, 0.006, 2),
      lowerBackGeo: createBeveledBoxGeometry(1.00, 0.76, 0.022, 0.006, 0.004, 0.004, 1),
      lowerSideGeo: createBeveledBoxGeometry(0.032, 0.76, 0.41, 0.008, 0.004, 0.004, 2),
      lowerShelfGeo: createBeveledBoxGeometry(0.47, 0.026, 0.38, 0.006, 0.004, 0.004, 2),
      doorFrameGeo: createBeveledBoxGeometry(0.43, 0.54, 0.022, 0.008, 0.004, 0.004, 2),
      doorPanelGeo: createBeveledBoxGeometry(0.33, 0.44, 0.014, 0.006, 0.003, 0.003, 2),
      drawerFrontGeo: createBeveledBoxGeometry(0.43, 0.145, 0.024, 0.008, 0.004, 0.004, 2),
      worktopGeo: createBeveledBoxGeometry(1.08, 0.040, 0.46, 0.016, 0.007, 0.007, 3),
      hutchBackGeo: createBeveledBoxGeometry(1.00, 1.24, 0.020, 0.006, 0.003, 0.003, 1),
      hutchSideGeo: createBeveledBoxGeometry(0.030, 1.22, 0.28, 0.008, 0.004, 0.004, 2),
      hutchShelfGeo: createBeveledBoxGeometry(0.96, 0.028, 0.27, 0.008, 0.004, 0.004, 2),
      corniceGeo: createScallopedHutchCorniceGeometry(1.10, 0.11, 0.34),
      flourSackGeo: createTiedFlourSackGeometry(0.084, 0.215),
      bannetonGeo: createHollowVesselLatheGeo(0.075, 0.105, 0.112, 0.068, 0.010, 22),
      loafPanGeo: createBeveledBoxGeometry(0.18, 0.056, 0.095, 0.012, 0.005, 0.005, 2),
      mixingBowlGeo: createHollowVesselLatheGeo(0.055, 0.094, 0.106, 0.088, 0.007, 26),
      rollingPinGeo: createRollingPinGeometry(0.16, 0.020),
      canisterGeo: createHollowVesselLatheGeo(0.042, 0.048, 0.045, 0.125, 0.005, 22),
      vanillaBottleGeo: createHollowVesselLatheGeo(0.018, 0.024, 0.012, 0.145, 0.003, 18),
      copperCupGeo: createHollowVesselLatheGeo(0.024, 0.030, 0.032, 0.042, 0.003, 20),
      charlotteMoldGeo: createHollowVesselLatheGeo(0.066, 0.088, 0.094, 0.092, 0.005, 24),
      harvestBasketGeo: createHollowVesselLatheGeo(0.080, 0.120, 0.132, 0.094, 0.008, 22),
      handleGeo: createTurnedHandleGeometry(0.12, 0.009),
      whiskGeo: createWireWhiskWiresGeometry(5, 0.11, 0.024),
      microMaps: mMaps,
      linenPbr: lPbr,
      fasciaTex: fTex,
      sackTagTex: sTex,
      canisterLabelTexs: cTexs,
      sageCabinetMat: enhanceWithStylizedFresnelRim(
        new THREE.MeshPhysicalMaterial({
          color: '#889E82',
          bumpMap: mMaps.bumpMap,
          bumpScale: 0.0022,
          roughnessMap: mMaps.roughnessMap,
          roughness: 1.0,
          clearcoat: 0.06,
          clearcoatRoughness: 0.48,
          envMapIntensity: 0.32,
        }),
        { rimColor: '#FFE8BC', rimStrength: 0.30, rimPower: 2.7, topBias: 0.42, cacheTag: 'pantry-sage-rim' }
      ),
      linenSackMat: new THREE.MeshPhysicalMaterial({
        map: lPbr.map,
        bumpMap: lPbr.bumpMap,
        bumpScale: 0.006,
        roughnessMap: lPbr.roughnessMap,
        roughness: 1.0,
        sheen: 0.45,
        sheenColor: '#FAF3E4',
        envMapIntensity: 0.34,
      }),
      castIronMat: new THREE.MeshStandardMaterial({ color: '#383431', metalness: 0.46, roughness: 0.62, envMapIntensity: 0.32 }),
      honeyMat: new THREE.MeshPhysicalMaterial({ color: '#D8841E', roughness: 0.18, clearcoat: 0.24, transparent: true, opacity: 0.88, envMapIntensity: 0.45 }),
      darkWoodMat: new THREE.MeshStandardMaterial({ color: '#5A3820', roughness: 0.62 }),
      soilMat: new THREE.MeshStandardMaterial({ color: '#3B281A', roughness: 0.96 }),
      fasciaMat: new THREE.MeshStandardMaterial({ map: fTex, roughness: 0.48 }),
      sackTagMat: new THREE.MeshStandardMaterial({ map: sTex, roughness: 0.78 }),
      canisterLabelMats: cTexs.map((t) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.42 })),
      cacaoFillMat: new THREE.MeshStandardMaterial({ color: '#54301E', roughness: 0.90 }),
      sugarFillMat: new THREE.MeshStandardMaterial({ color: '#F9F5EB', roughness: 0.78 }),
      almondFillMat: new THREE.MeshStandardMaterial({ color: '#EAD29B', roughness: 0.84 }),
      pistachioFillMat: new THREE.MeshStandardMaterial({ color: '#86B254', roughness: 0.72 }),
      berryFillMat: new THREE.MeshStandardMaterial({ color: '#B62D42', roughness: 0.68 }),
      pastels: [
        makeTintMat('#F4D4CE'),
        makeTintMat('#DCE7D2'),
        makeTintMat('#F4DFA2'),
      ],
    };
  }, []);

  useEffect(() => {
    return () => {
      plinthGeo.dispose();
      lowerBackGeo.dispose();
      lowerSideGeo.dispose();
      lowerShelfGeo.dispose();
      doorFrameGeo.dispose();
      doorPanelGeo.dispose();
      drawerFrontGeo.dispose();
      worktopGeo.dispose();
      hutchBackGeo.dispose();
      hutchSideGeo.dispose();
      hutchShelfGeo.dispose();
      corniceGeo.dispose();
      flourSackGeo.dispose();
      bannetonGeo.dispose();
      loafPanGeo.dispose();
      mixingBowlGeo.dispose();
      rollingPinGeo.dispose();
      canisterGeo.dispose();
      vanillaBottleGeo.dispose();
      copperCupGeo.dispose();
      charlotteMoldGeo.dispose();
      harvestBasketGeo.dispose();
      handleGeo.dispose();
      whiskGeo.dispose();
      microMaps.bumpMap.dispose();
      microMaps.roughnessMap.dispose();
      linenPbr.map.dispose();
      linenPbr.bumpMap.dispose();
      linenPbr.roughnessMap.dispose();
      fasciaTex.dispose();
      sackTagTex.dispose();
      canisterLabelTexs.forEach((t) => t.dispose());
      sageCabinetMat.dispose();
      linenSackMat.dispose();
      castIronMat.dispose();
      honeyMat.dispose();
      darkWoodMat.dispose();
      soilMat.dispose();
      fasciaMat.dispose();
      sackTagMat.dispose();
      canisterLabelMats.forEach((m) => m.dispose());
      cacaoFillMat.dispose();
      sugarFillMat.dispose();
      almondFillMat.dispose();
      pistachioFillMat.dispose();
      berryFillMat.dispose();
      pastels.forEach((m) => m.dispose());
    };
  }, [
    plinthGeo,
    lowerBackGeo,
    lowerSideGeo,
    lowerShelfGeo,
    doorFrameGeo,
    doorPanelGeo,
    drawerFrontGeo,
    worktopGeo,
    hutchBackGeo,
    hutchSideGeo,
    hutchShelfGeo,
    corniceGeo,
    flourSackGeo,
    bannetonGeo,
    loafPanGeo,
    mixingBowlGeo,
    rollingPinGeo,
    canisterGeo,
    vanillaBottleGeo,
    copperCupGeo,
    charlotteMoldGeo,
    harvestBasketGeo,
    handleGeo,
    whiskGeo,
    microMaps,
    linenPbr,
    fasciaTex,
    sackTagTex,
    canisterLabelTexs,
    sageCabinetMat,
    linenSackMat,
    castIronMat,
    honeyMat,
    darkWoodMat,
    soilMat,
    fasciaMat,
    sackTagMat,
    canisterLabelMats,
    cacaoFillMat,
    sugarFillMat,
    almondFillMat,
    pistachioFillMat,
    berryFillMat,
    pastels,
  ]);

  const apothecaryContents = [
    { x: -0.41, mat: cacaoFillMat },
    { x: -0.25, mat: sugarFillMat },
    { x: -0.09, mat: almondFillMat },
    { x: 0.07, mat: sugarFillMat },
    { x: 0.23, mat: pistachioFillMat },
    { x: 0.39, mat: berryFillMat },
  ];

  return (
    <group position={position}>
      {/* Tier 0: Honey-Oak Plinth Base strictly grounded y = 0.000..0.080 */}
      <mesh position={[0, 0.040, 0]} geometry={plinthGeo} material={oakWoodMat} castShadow receiveShadow />

      {/* Tier 1: Lower Sage-Green & Oak Credenza (y = 0.080..0.840) */}
      <mesh position={[0, 0.46, -0.20]} geometry={lowerBackGeo} material={sageCabinetMat} receiveShadow />
      {[-0.49, -0.015, 0.49].map((sx, si) => (
        <mesh key={`p-lside-${si}`} position={[sx, 0.46, 0]} geometry={lowerSideGeo} material={sageCabinetMat} castShadow receiveShadow />
      ))}
      <mesh position={[0, 0.092, 0]} geometry={lowerBackGeo} rotation={[Math.PI / 2, 0, 0]} scale={[1.0, 0.50, 1.0]} material={oakWoodMat} receiveShadow />
      <mesh position={[0.24, 0.45, 0]} geometry={lowerShelfGeo} material={oakWoodMat} castShadow receiveShadow />

      {/* Left Paneled Shaker Door + Upper Drawer with Brass Hardware */}
      <group position={[-0.252, 0, 0.195]}>
        <mesh position={[0, 0.37, 0]} geometry={doorFrameGeo} material={sageCabinetMat} castShadow />
        <mesh position={[0, 0.37, 0.006]} geometry={doorPanelGeo} material={creamEnamelMat} />
        <mesh position={[0.165, 0.52, 0.022]} material={brassMat}>
          <sphereGeometry args={[0.013, 12, 10]} />
        </mesh>
        <mesh position={[0, 0.745, 0]} geometry={drawerFrontGeo} material={sageCabinetMat} castShadow />
        <mesh position={[0, 0.745, 0.018]} rotation={[0, 0, Math.PI / 2]} material={brassMat}>
          <cylinderGeometry args={[0.006, 0.006, 0.085, 10]} />
        </mesh>
      </group>

      {/* Right Open Baker's Cubbies: Tied Chinese-Labeled T45 Flour Sacks + Banneton + Ceramic Crocks + Cast-Iron Loaf Pans */}
      {[
        { x: 0.12, z: 0.04, rot: 0.16, sc: 1.0 },
        { x: 0.34, z: 0.02, rot: -0.22, sc: 0.92 },
      ].map((sack, si) => (
        <group key={`flour-sack-${si}`} position={[sack.x, 0.102, sack.z]} rotation={[0, sack.rot, 0]} scale={sack.sc}>
          <mesh geometry={flourSackGeo} material={linenSackMat} castShadow receiveShadow />
          <mesh position={[0, 0.072, 0.0635]} rotation={[-0.08, 0, 0]} material={sackTagMat}>
            <planeGeometry args={[0.066, 0.066]} />
          </mesh>
          <mesh position={[0, 0.166, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.0, 0.72, 1.0]} material={elmWoodMat}>
            <torusGeometry args={[0.028, 0.0045, 8, 18]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0.23, 0.102, -0.105]} geometry={bannetonGeo} material={wickerMat} castShadow />
      {[0.12, 0.25].map((cx, ci) => (
        <mesh
          key={`butter-crock-${ci}`}
          position={[cx, 0.464, 0.02]}
          scale={0.72 - ci * 0.08}
          geometry={utensilCrockGeo}
          material={ci === 0 ? stonewareMat : celadonGlazeMat}
          castShadow
        />
      ))}
      {[0.0, 0.032].map((ly, li) => (
        <mesh
          key={`loaf-pan-${li}`}
          position={[0.39, 0.492 + ly, 0.01]}
          rotation={[0, li * 0.08, 0]}
          geometry={loafPanGeo}
          material={castIronMat}
          castShadow
        />
      ))}

      {/* Tier 2: Butcher-Block Honey-Oak Prep Ledge (top strictly at y = 0.880m) */}
      <mesh position={[0, 0.860, 0]} geometry={worktopGeo} material={oakWoodMat} castShadow receiveShadow />

      {/* 6 Glass Apothecary Ingredient Jars + Honey Jar + Tart Tampers + Whisk/Brush Crock at y = 0.880 */}
      {apothecaryContents.map((jar, ji) => (
        <group key={`pantry-jar-${ji}`} position={[jar.x, 0.880, -0.095]} scale={0.72}>
          <mesh position={[0, 0.056, 0]} geometry={spiceFillGeo} material={jar.mat} />
          <mesh geometry={apothecaryJarGeo} material={crystalGlassMat} castShadow />
          <mesh position={[0, 0.138, 0]} geometry={apothecaryLidGeo} material={brassMat} />
        </group>
      ))}
      <group position={[-0.32, 0.880, 0.095]}>
        <mesh position={[0, 0.044, 0]} scale={[0.85, 0.72, 0.85]} geometry={spiceFillGeo} material={honeyMat} />
        <mesh scale={[0.92, 0.72, 0.92]} geometry={apothecaryJarGeo} material={crystalGlassMat} castShadow />
        <mesh position={[0.018, 0.095, 0.008]} rotation={[0.25, 0.2, -0.35]} geometry={handleGeo} material={elmWoodMat} />
      </group>
      {[-0.06, 0.12].map((tx, ti) => (
        <group key={`tamper-scoop-${ti}`} position={[tx, 0.880, 0.095]} rotation={[0, ti * 0.4 - 0.2, 0]}>
          <mesh position={[0, 0.016, 0]} material={darkWoodMat} castShadow>
            <cylinderGeometry args={[0.026, 0.022, 0.032, 16]} />
          </mesh>
          <mesh position={[0, 0.046, 0]} material={darkWoodMat} castShadow>
            <cylinderGeometry args={[0.014, 0.018, 0.036, 14]} />
          </mesh>
          <mesh position={[0.052, 0.018, 0.01]} rotation={[0, 0.2, Math.PI / 2]} geometry={copperCupGeo} material={copperMat} castShadow />
        </group>
      ))}
      <group position={[0.37, 0.880, 0.090]}>
        <mesh scale={0.82} geometry={utensilCrockGeo} material={creamEnamelMat} castShadow />
        <mesh position={[-0.012, 0.055, 0]} rotation={[0.18, 0.1, 0.22]} geometry={handleGeo} material={elmWoodMat} />
        <group position={[0.014, 0.058, 0.008]} rotation={[-0.14, 0.3, -0.18]}>
          <mesh geometry={handleGeo} material={darkWoodMat} />
          <mesh position={[0, 0.126, 0]} geometry={whiskGeo} material={tinMat} />
        </group>
      </group>

      {/* Tier 3: Shallow Open Upper Baker's Dresser Hutch (y = 0.880..2.180, z in [-0.21..+0.09]) */}
      <mesh position={[0, 1.50, -0.20]} geometry={hutchBackGeo} material={sageCabinetMat} receiveShadow />
      {[-0.485, 0.485].map((sx, si) => (
        <mesh key={`p-hside-${si}`} position={[sx, 1.48, -0.06]} geometry={hutchSideGeo} material={sageCabinetMat} castShadow receiveShadow />
      ))}
      {[1.306, 1.746].map((sy, si) => (
        <mesh key={`p-hshelf-${si}`} position={[0, sy, -0.055]} geometry={hutchShelfGeo} material={oakWoodMat} castShadow receiveShadow />
      ))}
      <mesh position={[0, 2.070, -0.05]} geometry={corniceGeo} material={oakWoodMat} castShadow />

      {/* Chinese Bakery Workshop Timber Fascia Plaque ("林间花房烘焙工坊") centered flush on Cornice */}
      <group position={[0, 2.126, 0.124]}>
        <mesh material={darkWoodMat} castShadow>
          <boxGeometry args={[0.56, 0.072, 0.012]} />
        </mesh>
        <mesh position={[0, 0, 0.0072]} material={fasciaMat}>
          <planeGeometry args={[0.535, 0.056]} />
        </mesh>
        {[-0.258, 0.258].map((rx, ri) => (
          <mesh key={`fascia-rivet-${ri}`} position={[rx, 0, 0.008]} material={brassMat}>
            <sphereGeometry args={[0.0038, 10, 8]} />
          </mesh>
        ))}
      </group>

      {/* Curated Top Cornice Shelf Decor (`y = 2.180`): Copper Charlotte Mold, Harvest Basket, Cream Canister & Trailing Ivy */}
      <group position={[0, 2.180, -0.04]}>
        {/* 1. Hammered Copper Charlotte Mold (`x = -0.34`) */}
        <group position={[-0.34, 0, 0]}>
          <mesh geometry={charlotteMoldGeo} material={copperMat} castShadow receiveShadow />
          <mesh position={[0, 0.090, 0]} rotation={[Math.PI / 2, 0, 0]} material={brassMat}>
            <torusGeometry args={[0.094, 0.0042, 10, 24]} />
          </mesh>
          <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} material={tinMat}>
            <circleGeometry args={[0.064, 24]} />
          </mesh>
        </group>

        {/* 2. Woven Harvest Basket with Folded Cream Linen Cloth (`x = -0.09`) */}
        <group position={[-0.09, 0, -0.01]}>
          <mesh geometry={harvestBasketGeo} material={wickerMat} castShadow receiveShadow />
          <mesh position={[0, 0.092, 0]} rotation={[Math.PI / 2, 0, 0]} material={wickerMat}>
            <torusGeometry args={[0.130, 0.008, 10, 26]} />
          </mesh>
          <mesh position={[0.01, 0.054, 0.01]} rotation={[0.12, 0.4, -0.08]} scale={[1.2, 0.58, 0.96]} material={linenSackMat} castShadow>
            <sphereGeometry args={[0.086, 16, 12]} />
          </mesh>
        </group>

        {/* 3. Large Cream Enamel Storage Canister with Brass Knobbed Lid (`x = +0.17`) */}
        <group position={[0.17, 0, 0]}>
          <mesh scale={1.12} geometry={canisterGeo} material={creamEnamelMat} castShadow receiveShadow />
          <mesh position={[0, 0.140, 0]} material={brassMat} castShadow>
            <cylinderGeometry args={[0.050, 0.052, 0.018, 22]} />
          </mesh>
          <mesh position={[0, 0.156, 0]} material={brassMat}>
            <sphereGeometry args={[0.011, 12, 10]} />
          </mesh>
        </group>

        {/* 4. Terracotta Trailing Ivy Pot (`x = +0.37`) cascading over right cornice edge */}
        <group position={[0.37, 0, 0.01]}>
          <mesh geometry={herbPotGeo} material={terracottaMat} castShadow receiveShadow />
          <mesh position={[0, 0.112, 0]} rotation={[-Math.PI / 2, 0, 0]} material={soilMat}>
            <circleGeometry args={[0.058, 20]} />
          </mesh>
          {Array.from({ length: 10 }).map((_, si) => {
            const sa = (si / 10) * Math.PI * 2;
            const cascade = si % 3 !== 0;
            return (
              <mesh
                key={`cornice-ivy-${si}`}
                position={[
                  Math.cos(sa) * (cascade ? 0.068 : 0.030),
                  cascade ? 0.082 - (si % 2) * 0.045 : 0.148,
                  Math.sin(sa) * (cascade ? 0.068 : 0.030) + (cascade ? 0.024 : 0),
                ]}
                rotation={[cascade ? 1.85 : 0.45, -sa, cascade ? 0.35 : 0.2]}
                scale={cascade ? 1.15 : 0.95}
                geometry={sprigGeo}
                material={leafMat}
                castShadow
                raycast={() => null}
              />
            );
          })}
        </group>
      </group>

      {/* Integrated Forged Brass Pot Rail Inside Hutch Alcove (y = 1.24) + 2 Concave Copper Skillets + Measuring Cups */}
      <mesh position={[0, 1.24, -0.158]} rotation={[0, 0, Math.PI / 2]} material={brassMat} castShadow>
        <cylinderGeometry args={[0.006, 0.006, 0.82, 12]} />
      </mesh>
      {[
        { x: -0.24, r: 0.068, d: 0.032, len: 0.090, tilt: 0.04 },
        { x: -0.03, r: 0.058, d: 0.028, len: 0.082, tilt: -0.04 },
      ].map((pan, pi) => (
        <group key={`hutch-skillet-${pi}`} position={[pan.x, 1.072 + (0.068 - pan.r), -0.186]}>
          <group rotation={[0, 0, Math.PI + pan.tilt]}>
            <group rotation={[Math.PI / 2, 0, 0]}>
              <MauvielCopperSaucepan
                radius={pan.r}
                height={pan.d}
                copperMat={copperMat}
                tinMat={tinMat}
                brassMat={brassMat}
                handleLength={pan.len}
              />
            </group>
          </group>
        </group>
      ))}
      {[0.21, 0.34].map((cx, ci) => (
        <group key={`hutch-cup-${ci}`} position={[cx, 1.18, -0.168]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} geometry={copperCupGeo} material={copperMat} castShadow />
          <mesh position={[0, 0.045, 0.012]} material={brassMat}>
            <torusGeometry args={[0.012, 0.003, 8, 14]} />
          </mesh>
        </group>
      ))}

      {/* Middle Hutch Shelf (y_top = 1.320): 3 Nesting Mixing Bowls + 2 Rolling Pins + 3 Pastel Canisters */}
      {[
        { sc: 1.0, y: 1.320, mat: creamEnamelMat },
        { sc: 0.78, y: 1.346, mat: celadonGlazeMat },
        { sc: 0.58, y: 1.370, mat: terracottaMat },
      ].map((bowl, bi) => (
        <mesh key={`nest-bowl-${bi}`} position={[-0.34, bowl.y, -0.05]} scale={bowl.sc} geometry={mixingBowlGeo} material={bowl.mat} castShadow />
      ))}
      {[
        { z: -0.01, rot: 0.05 },
        { z: -0.08, rot: -0.06 },
      ].map((rp, ri) => (
        <mesh key={`hutch-rpin-${ri}`} position={[0.0, 1.320, rp.z]} rotation={[0, rp.rot, 0]} geometry={rollingPinGeo} material={elmWoodMat} castShadow />
      ))}
      {pastels.map((mat, ci) => {
        const sc = 0.92 - ci * 0.04;
        return (
          <group key={`hutch-tin-${ci}`} position={[0.25 + ci * 0.095, 1.320, -0.05]}>
            <mesh scale={sc} geometry={canisterGeo} material={mat} castShadow />
            <mesh position={[0, 0.064 * sc, 0.0475 * sc]} material={canisterLabelMats[ci]}>
              <planeGeometry args={[0.046 * sc, 0.030 * sc]} />
            </mesh>
            <mesh position={[0, 0.121 - ci * 0.005, 0]} material={brassMat}>
              <cylinderGeometry args={[0.043, 0.045, 0.016, 18]} />
            </mesh>
          </group>
        );
      })}

      {/* Top Hutch Shelf (y_top = 1.760): Vanilla Extract Bottles + Ceramic Pitcher + Trailing Rosemary */}
      {[-0.36, -0.26].map((bx, bi) => (
        <group key={`van-bot-${bi}`} position={[bx, 1.760, -0.05]}>
          <mesh scale={1.0 - bi * 0.12} geometry={vanillaBottleGeo} material={honeyMat} castShadow />
          <mesh position={[0, 0.145 - bi * 0.016, 0]} material={elmWoodMat}>
            <cylinderGeometry args={[0.008, 0.007, 0.018, 10]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0.02, 1.760, -0.05]} scale={0.95} geometry={porcelainPitcherGeo} material={creamEnamelMat} castShadow />
      <group position={[0.33, 1.760, -0.04]}>
        <mesh geometry={herbPotGeo} material={terracottaMat} castShadow />
        {[0, 1, 2, 3, 4, 5].map((si) => {
          const sa = (si / 6) * Math.PI * 2;
          return (
            <mesh
              key={`rosemary-${si}`}
              position={[Math.cos(sa) * 0.028, 0.148 + (si % 2) * 0.02, Math.sin(sa) * 0.028]}
              rotation={[0.45, -sa, 0.25]}
              geometry={sprigGeo}
              material={leafMat}
            />
          );
        })}
      </group>
    </group>
  );
};

/**
 * Genuine Hollow 3D Fluted French Copper Kugelhopf/Brioche Wall Mold with Tin-Lined Interior Cavity
 */
const FlutedCopperWallMold: React.FC<{
  radius: number;
  depth: number;
  copperMat: THREE.Material;
  tinMat: THREE.Material;
  brassMat: THREE.Material;
}> = ({ radius, depth, copperMat, tinMat, brassMat }) => {
  const chimneyR = radius * 0.25;
  const { moldGeo, tinLinerGeo } = useMemo(() => {
    const mGeo = createHollowFlutedBundtGeo(radius, chimneyR, depth, 16);
    const pts = [
      new THREE.Vector2(radius * 0.89, depth * 0.94),
      new THREE.Vector2(radius * 0.84, depth * 0.48),
      new THREE.Vector2(radius * 0.77, 0.011),
      new THREE.Vector2(chimneyR + 0.0085, 0.011),
      new THREE.Vector2(chimneyR + 0.0045, depth * 0.92),
    ];
    const tGeo = createSeamlessLatheGeometry(pts, 36);
    return { moldGeo: mGeo, tinLinerGeo: tGeo };
  }, [radius, chimneyR, depth]);

  useEffect(() => {
    return () => {
      moldGeo.dispose();
      tinLinerGeo.dispose();
    };
  }, [moldGeo, tinLinerGeo]);

  return (
    <group>
      <group rotation={[Math.PI / 2, 0, 0]}>
        <mesh geometry={moldGeo} material={copperMat} castShadow receiveShadow />
        <mesh geometry={tinLinerGeo} material={tinMat} receiveShadow />
      </group>
      <mesh position={[0, radius + 0.012, 0.010]} material={brassMat}>
        <torusGeometry args={[0.014, 0.0032, 8, 16]} />
      </mesh>
      <mesh position={[0, radius + 0.018, -0.004]} rotation={[Math.PI / 2, 0, 0]} material={brassMat}>
        <cylinderGeometry args={[0.004, 0.004, 0.022, 10]} />
      </mesh>
    </group>
  );
};

const MauvielCopperSaucepan: React.FC<{
  radius: number;
  height: number;
  copperMat: THREE.Material;
  tinMat: THREE.Material;
  brassMat: THREE.Material;
  handleLength?: number;
}> = ({ radius, height, copperMat, tinMat, brassMat, handleLength = 0.21 }) => {
  const { potGeo, tinGeo, handleGeo } = useMemo(
    () => ({
      potGeo: createMauvielCopperPotGeometry(radius, height),
      tinGeo: createMauvielTinLinerGeometry(radius, height),
      handleGeo: createForgedPanHandleGeometry(handleLength),
    }),
    [radius, height, handleLength]
  );

  useEffect(() => {
    return () => {
      potGeo.dispose();
      tinGeo.dispose();
      handleGeo.dispose();
    };
  }, [potGeo, tinGeo, handleGeo]);

  return (
    <group>
      <mesh geometry={potGeo} material={copperMat} castShadow receiveShadow />
      <mesh geometry={tinGeo} material={tinMat} receiveShadow />
      {/* Forged Arched Brass Handle + Dual Brass Rivets */}
      <group position={[0, height * 0.76, radius + 0.002]} rotation={[Math.PI * 0.42, 0, 0]}>
        <mesh geometry={handleGeo} material={brassMat} castShadow />
        <mesh position={[-0.011, 0.002, -0.005]} material={brassMat}>
          <sphereGeometry args={[0.0045, 8, 8]} />
        </mesh>
        <mesh position={[0.011, 0.002, -0.005]} material={brassMat}>
          <sphereGeometry args={[0.0045, 8, 8]} />
        </mesh>
      </group>
    </group>
  );
};

/**
 * 1. ELEVATED OVERHEAD MAUVIEL HAMMERED RED-COPPER POT RACK & WIRE BALLOON WHISKS
 * Elevated to y = 2.58m (lowest pot rim y = 2.10m) so Step 2 Deck Oven & island_top view stay 100% clear!
 */
const OverheadMauvielCopperRack: React.FC<{
  copperMat: THREE.Material;
  tinMat: THREE.Material;
  brassMat: THREE.Material;
  stainlessMat: THREE.Material;
  ironMat: THREE.Material;
}> = ({ brassMat }) => {
  const rackLeafGeo = useMemo(() => createCitrusLeafGeometry(), []);
  const rackVineRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const inst = rackVineRef.current;
    if (!inst) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const greens = [0x3d6d2e, 0x4f843a, 0x5c8e48, 0x6c9c56];
    for (let i = 0; i < 64; i++) {
      const t = i / 63;
      const x = -1.16 + t * 2.32;
      const sideZ = (i % 2 === 0 ? 1 : -1) * (0.04 + (i % 3) * 0.02);
      const endDrop = Math.abs(x) > 0.92 && i % 3 === 0 ? ((Math.abs(x) - 0.90) * 1.1 + (i % 4) * 0.06) : 0;
      dummy.position.set(x, 0.025 - endDrop + Math.sin(i * 1.7) * 0.025, sideZ);
      dummy.rotation.set(0.45 + (i % 3) * 0.3, i * 0.9, (i % 2 === 0 ? 1 : -1) * 0.35);
      dummy.scale.setScalar(0.95 + (i % 4) * 0.22);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      color.setHex(greens[i % greens.length]);
      inst.setColorAt(i, color);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, []);

  useEffect(() => {
    return () => {
      rackLeafGeo.dispose();
    };
  }, [rackLeafGeo]);

  return (
    <group position={[0, 3.02, -0.06]}>
      {/* 2 Twisted Hemp Suspension Ropes anchored cleanly inside the sloped pine roof soffit (tops 5.230m / 5.140m — zero exterior roof poke!) */}
      {[
        { rx: -0.98, len: 2.21, cupTilt: 0.30 },
        { rx: 0.98, len: 2.12, cupTilt: -0.31 },
      ].map(({ rx, len, cupTilt }, xi) => (
        <group key={xi} position={[rx, len * 0.5, 0]}>
          <mesh>
            <cylinderGeometry args={[0.0085, 0.0085, len, 8]} />
            <meshStandardMaterial color="#B69468" roughness={0.92} />
          </mesh>
          <mesh position={[0, len * 0.5 - 0.02, 0]} rotation={[0, 0, cupTilt]} material={brassMat}>
            <cylinderGeometry args={[0.028, 0.018, 0.028, 16]} />
          </mesh>
          <mesh position={[0, -len * 0.5 + 0.01, 0]}>
            <torusGeometry args={[0.032, 0.009, 8, 16]} />
            <meshStandardMaterial color="#A8865A" roughness={0.92} />
          </mesh>
        </group>
      ))}

      {/* Sculpted Rustic Aged-Timber Driftwood Chandelier Beam (`原木枝干干花暖光吊灯`, clears north window arch & print in panorama!) */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.032, 0.038, 2.38, 12]} />
        <meshStandardMaterial color="#7C4E2B" roughness={0.72} />
      </mesh>
      <mesh position={[-0.65, 0.02, 0.06]} rotation={[0.18, 0.25, Math.PI / 2 - 0.12]} castShadow>
        <cylinderGeometry args={[0.016, 0.024, 0.85, 10]} />
        <meshStandardMaterial color="#8A5732" roughness={0.74} />
      </mesh>
      <mesh position={[0.68, -0.01, -0.05]} rotation={[-0.15, -0.22, Math.PI / 2 + 0.10]} castShadow>
        <cylinderGeometry args={[0.016, 0.022, 0.82, 10]} />
        <meshStandardMaterial color="#8A5732" roughness={0.74} />
      </mesh>

      {/* Delicate Cascading Eucalyptus & Ivy Leaves along Chandelier Branch */}
      <instancedMesh ref={rackVineRef} args={[rackLeafGeo, undefined, 64]} castShadow>
        <meshStandardMaterial roughness={0.55} side={THREE.DoubleSide} />
      </instancedMesh>

      {/* 3 French Scalloped Milk-Glass & Pleated Cream-Linen Cottage Pendant Shades casting Warm Honey Glow! */}
      {[-0.82, 0.0, 0.82].map((bx, bi) => (
        <group key={bi} position={[bx, -0.15, 0]}>
          {/* Twisted linen cord from branch */}
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.004, 0.004, 0.14, 8]} />
            <meshStandardMaterial color="#B8986E" roughness={0.88} />
          </mesh>
          {/* Antique brass bulb holder */}
          <mesh position={[0, 0.01, 0]} material={brassMat}>
            <cylinderGeometry args={[0.018, 0.024, 0.042, 14]} />
          </mesh>
          {/* Scalloped Pleated Cream-Linen / Milk-Glass Cottage Shade (`法式荷叶边暖光灯罩`) */}
          <mesh position={[0, -0.055, 0]} castShadow>
            <cylinderGeometry args={[0.058, 0.175, 0.125, 24, 1, true]} />
            <meshStandardMaterial
              color="#FFF6E2"
              emissive="#FFB95A"
              emissiveIntensity={0.48}
              roughness={0.72}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Scalloped Brass Rim Trim */}
          <mesh position={[0, -0.118, 0]} rotation={[Math.PI / 2, 0, 0]} material={brassMat}>
            <torusGeometry args={[0.175, 0.0045, 8, 28]} />
          </mesh>
          {/* Warm Amber Filament Bulb inside Shade */}
          <mesh position={[0, -0.075, 0]}>
            <sphereGeometry args={[0.030, 12, 12]} />
            <meshStandardMaterial color="#FFF8E6" emissive="#FFB648" emissiveIntensity={0.88} />
          </mesh>
        </group>
      ))}

      {/* 12 Tiny Warm-Gold Twinkle Fairy-Light Beads woven along Driftwood Chandelier Branch */}
      {Array.from({ length: 12 }).map((_, fi) => {
        const fx = -1.26 + (fi / 11) * 2.52;
        const fy = -0.02 + Math.sin(fi * 1.3) * 0.045;
        const fz = Math.cos(fi * 1.7) * 0.045;
        return (
          <mesh key={`fairy-${fi}`} position={[fx, fy, fz]}>
            <sphereGeometry args={[0.013, 8, 8]} />
            <meshStandardMaterial color="#FFF6D6" emissive="#FFBA42" emissiveIntensity={0.78} />
          </mesh>
        );
      })}

      {/* 4 Upside-Down Hanging Dried French Lavender, Golden Wheat & Chamomile Bundles (`倒挂干花束`) */}
      {[
        { x: -1.10, color: '#9E84C8', accent: '#6B8854' },
        { x: -0.42, color: '#E4C26A', accent: '#C8A452' },
        { x: 0.42, color: '#FFFDF4', accent: '#E8B838' },
        { x: 1.10, color: '#9E84C8', accent: '#6B8854' },
      ].map((b, bi) => (
        <group key={`dried-${bi}`} position={[b.x, -0.10, (bi % 2 === 0 ? 0.04 : -0.04)]} rotation={[0, bi * 0.7, (bi - 1.5) * 0.04]}>
          {/* Twine hanging loop */}
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.0025, 0.0025, 0.12, 6]} />
            <meshStandardMaterial color="#B28E62" roughness={0.92} />
          </mesh>
          {/* Tied Stem Knot */}
          <mesh position={[0, 0.0, 0]}>
            <cylinderGeometry args={[0.016, 0.020, 0.05, 8]} />
            <meshStandardMaterial color="#9E7A50" roughness={0.90} />
          </mesh>
          {/* Flared Upside-Down Dried Herb & Flower Stalks */}
          {[-0.032, -0.014, 0.0, 0.016, 0.032].map((sx, si) => (
            <group key={si} position={[sx, -0.08, ((si % 3) - 1) * 0.022]} rotation={[0.16 * (si - 2), si, -0.22 * (si - 2)]}>
              <mesh>
                <cylinderGeometry args={[0.003, 0.004, 0.16, 6]} />
                <meshStandardMaterial color={b.accent} roughness={0.86} />
              </mesh>
              <mesh position={[0, -0.095, 0]} scale={[0.72, 1.35, 0.72]}>
                <sphereGeometry args={[0.018, 7, 6]} />
                <meshStandardMaterial color={b.color} roughness={0.78} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
};

/**
 * 2. DECLUTTERED ISLAND SURFACE EQUIPMENT & ARTISANAL TRAYS
 * Foreground x in [-1.05, 0.60] is kept clean & wide open for Steps 1/3/4/5/6!
 * Side props rest neatly on Left Walnut-Brass Ingredient Tray (x = -1.36) and
 * Right Walnut-Brass Finishing Tray (x = 1.24).
 */
const IslandSurfaceEquipment: React.FC<{
  copperMat: THREE.Material;
  brassMat: THREE.Material;
  stainlessMat: THREE.Material;
  rosewoodMat: THREE.Material;
  walnutMat: THREE.Material;
  crystalGlassMat: THREE.Material;
}> = ({ copperMat, brassMat, stainlessMat, rosewoodMat, walnutMat, crystalGlassMat }) => {
  const textures = useMemo(() => getAtelierTextures(), []);
  const craftAssets = useMemo(() => getCottageCraftAssets(), []);
  const stonewareBowlMat = useMemo(
    () =>
      enhanceWithStylizedFresnelRim(
        new THREE.MeshPhysicalMaterial({
          map: craftAssets.floralCeramicTex,
          color: '#FCF7ED',
          roughness: 0.46,
          clearcoat: 0.16,
          clearcoatRoughness: 0.32,
          envMapIntensity: 0.38,
        }),
        { rimColor: '#FFE4B0', rimStrength: 0.32, rimPower: 2.6, topBias: 0.44, cacheTag: 'equip-stoneware-bowl' }
      ),
    [craftAssets]
  );
  const sageBowlMat = useMemo(
    () =>
      enhanceWithStylizedFresnelRim(
        new THREE.MeshPhysicalMaterial({
          map: craftAssets.floralCeramicTex,
          color: '#DDE8D4',
          roughness: 0.46,
          clearcoat: 0.16,
          clearcoatRoughness: 0.32,
          envMapIntensity: 0.38,
        }),
        { rimColor: '#FFE8BC', rimStrength: 0.34, rimPower: 2.5, topBias: 0.44, cacheTag: 'equip-sage-bowl' }
      ),
    [craftAssets]
  );
  const tableRunnerMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: craftAssets.cottageRunnerTex,
        normalMap: textures.linenNormalMap,
        normalScale: LINEN_NORMAL_SCALE,
        roughness: 0.92,
        sheen: 0.56,
        sheenColor: '#FFFDF6',
        sheenRoughness: 0.74,
      }),
    [craftAssets, textures]
  );
  const lacePlacematMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: craftAssets.lacePlacematMaps.map,
        alphaMap: craftAssets.lacePlacematMaps.alphaMap,
        alphaTest: 0.36,
        normalMap: textures.linenNormalMap,
        normalScale: LINEN_NORMAL_SCALE,
        roughness: 0.92,
        sheen: 0.52,
        sheenColor: '#FFFDF6',
        side: THREE.DoubleSide,
      }),
    [craftAssets, textures]
  );
  const marbleSlabPbr = useMemo(() => getMarblePbrSet(0.95, 0.72), []);
  const raspberryGeo = useMemo(() => createDrupeletRaspberryGeometry(), []);
  const miniStrawberryGeo = useMemo(() => createMiniStrawberryGeometry(0.015, 0.025), []);
  const strawberryCalyxGeo = useMemo(() => createStrawberryCalyxGeometry(0.013), []);
  const goldLeafGeo = useMemo(() => createGoldLeafFlakeGeometry(1.15), []);
  const chocCurlGeo = useMemo(() => createChocolateCurlGeometry(), []);
  const whiteChocFlakeGeo = useMemo(() => createWhiteChocCurlFlakeGeometry(0.020, 0.040), []);
  const chocPuddleGeo = useMemo(() => createTemperedChocolatePuddleGeometry(), []);
  const culDePouleGeo = useMemo(() => createHollowVesselLatheGeo(0.042, 0.078, 0.084, 0.074, 0.0045, 64), []);
  // Left-center pastry linen runner (ends cleanly at x=-0.01 so burner trivet at [0.28,-0.32] sits OFF linen!)
  const tableRunnerGeo = useMemo(() => createBeveledBoxGeometry(1.40, 0.0028, 0.34, 0.014, 0.001, 0.001, 2), []);
  const slateTrivetGeo = useMemo(() => createBeveledMarbleTabletopGeometry(0.172, 0.004), []);
  const bouquetPitcherGeo = useMemo(() => createHollowVesselLatheGeo(0.046, 0.056, 0.038, 0.128, 0.0048, 64), []);
  const bouquetLeafGeo = useMemo(() => createCitrusLeafGeometry(), []);
  const bouquetStemGeo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.003, 0.034, 0.002),
      new THREE.Vector3(0.006, 0.072, 0.005),
    ]);
    return new THREE.TubeGeometry(curve, 12, 0.0018, 8, false);
  }, []);
  const bouquetPetalGeo = useMemo(() => {
    const p = new THREE.Shape();
    p.moveTo(0, 0);
    p.bezierCurveTo(0.0048, 0.0026, 0.0062, 0.010, 0.0028, 0.0155);
    p.bezierCurveTo(0.0010, 0.0172, -0.0010, 0.0172, -0.0028, 0.0155);
    p.bezierCurveTo(-0.0062, 0.010, -0.0048, 0.0026, 0, 0);
    p.closePath();
    const g = new THREE.ExtrudeGeometry(p, {
      depth: 0.0011,
      bevelEnabled: true,
      bevelThickness: 0.00045,
      bevelSize: 0.00045,
      bevelSegments: 2,
      curveSegments: 8,
    });
    g.rotateX(-Math.PI * 0.40);
    g.computeVertexNormals();
    return g;
  }, []);
  const bouquetFloretGeo = useMemo(() => {
    const f = new THREE.Shape();
    f.moveTo(0, 0);
    f.bezierCurveTo(0.0028, 0.0015, 0.0036, 0.0055, 0.0016, 0.0085);
    f.bezierCurveTo(0.0005, 0.0096, -0.0005, 0.0096, -0.0016, 0.0085);
    f.bezierCurveTo(-0.0036, 0.0055, -0.0028, 0.0015, 0, 0);
    f.closePath();
    const g = new THREE.ExtrudeGeometry(f, {
      depth: 0.0009,
      bevelEnabled: true,
      bevelThickness: 0.00035,
      bevelSize: 0.00035,
      bevelSegments: 2,
      curveSegments: 6,
    });
    g.rotateX(-Math.PI * 0.34);
    g.computeVertexNormals();
    return g;
  }, []);
  const bouquetCenterGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.0056, 14, 10);
    g.scale(1.0, 0.62, 1.0);
    return g;
  }, []);
  const honeyBoardGeo = useMemo(() => createBeveledBoxGeometry(0.28, 0.012, 0.17, 0.024, 0.003, 0.003, 2), []);
  const honeyPotGeo = useMemo(() => createHollowVesselLatheGeo(0.034, 0.046, 0.035, 0.078, 0.0042, 64), []);
  const sugarPotGeo = useMemo(() => createHollowVesselLatheGeo(0.038, 0.044, 0.042, 0.062, 0.0042, 64), []);
  const rightVaseGeo = useMemo(() => createHollowVesselLatheGeo(0.028, 0.036, 0.021, 0.108, 0.0032, 64), []);
  const tastingPlateGeo = useMemo(() => createEspressoSaucerGeometry(), []);
  const miniTartShellGeo = useMemo(() => createFlutedTartShellGeo(0.034, 0.015), []);
  const trayRailLeftGeo = useMemo(() => createBeveledBoxGeometry(0.484, 0.012, 0.007, 0.002, 0.0015, 0.0015, 2), []);
  const traySideLeftGeo = useMemo(() => createBeveledBoxGeometry(0.007, 0.012, 0.384, 0.002, 0.0015, 0.0015, 2), []);
  const trayRailRightGeo = useMemo(() => createBeveledBoxGeometry(0.464, 0.012, 0.007, 0.002, 0.0015, 0.0015, 2), []);
  const traySideRightGeo = useMemo(() => createBeveledBoxGeometry(0.007, 0.012, 0.524, 0.002, 0.0015, 0.0015, 2), []);
  const irProbeGeo = useMemo(() => createSleekIrProbeGeometry(), []);
  const irLeatherPadGeo = useMemo(() => createBeveledBoxGeometry(0.115, 0.004, 0.195, 0.012, 0.0015, 0.0015, 2), []);
  const irBezelGeo = useMemo(() => createBeveledBoxGeometry(0.068, 0.042, 0.007, 0.006, 0.002, 0.002, 2), []);
  const parchmentDiscGeo = useMemo(() => createBakingParchmentDiscGeometry(0.236), []);
  const flutedNozzleGeo = useMemo(() => createFlutedPipingNozzleGeometry(0.012, 0.0040, 0.036, 8), []);
  const standbyFlutedNozzleGeo = useMemo(() => createFlutedPipingNozzleGeometry(0.010, 0.0036, 0.032, 8), []);
  const nozzleDockGeo = useMemo(() => createBeveledBoxGeometry(0.165, 0.024, 0.062, 0.010, 0.003, 0.003, 2), []);
  const nozzleDockTrimGeo = useMemo(() => createBeveledBoxGeometry(0.171, 0.006, 0.068, 0.011, 0.002, 0.002, 2), []);
  const couplerRingGeo = useMemo(() => new THREE.CylinderGeometry(0.0135, 0.0125, 0.012, 24), []);

  // Hoisted shared micro-tool PBR materials (ZERO inline loop material instances!)
  const irAnodizedMicro = useMemo(() => createMicroSurfaceMaps(0.32, 0.08, true, 751), []);
  const quiltedBagPbr = useMemo(() => createQuiltedPastryBagTexture('#FBF4E5', '#C6B08E', 812), []);
  const microToolMats = useMemo(
    () => ({
      irBodyMat: new THREE.MeshPhysicalMaterial({
        color: '#343A40',
        bumpMap: irAnodizedMicro.bumpMap,
        bumpScale: 0.003,
        roughnessMap: irAnodizedMicro.roughnessMap,
        metalness: 0.62,
        roughness: 1.0,
        anisotropy: 0.38,
        clearcoat: 0.08,
        clearcoatRoughness: 0.36,
        envMapIntensity: 0.45,
      }),
      irLeatherMat: new THREE.MeshPhysicalMaterial({
        color: '#4E3222',
        bumpMap: irAnodizedMicro.bumpMap,
        bumpScale: 0.0025,
        roughnessMap: irAnodizedMicro.roughnessMap,
        roughness: 1.0,
        sheen: 0.18,
        sheenColor: '#8B6244',
        envMapIntensity: 0.34,
      }),
      parchmentMat: new THREE.MeshStandardMaterial({
        color: '#F7EFE0',
        normalMap: textures.linenNormalMap,
        normalScale: new THREE.Vector2(0.18, 0.18),
        roughness: 0.88,
        envMapIntensity: 0.30,
      }),
      dewdropMat: new THREE.MeshPhysicalMaterial({
        color: '#FFFFFF',
        transparent: true,
        opacity: 0.56,
        roughness: 0.10,
        clearcoat: 0.22,
        envMapIntensity: 0.48,
      }),
      goldLeafMat: new THREE.MeshPhysicalMaterial({
        color: '#EFC964',
        metalness: 0.88,
        roughness: 0.26,
        anisotropy: 0.28,
        envMapIntensity: 0.60,
        side: THREE.DoubleSide,
      }),
      vanillaPodMat: new THREE.MeshPhysicalMaterial({
        color: '#2B1910',
        bumpMap: irAnodizedMicro.bumpMap,
        bumpScale: 0.003,
        roughness: 0.46,
        clearcoat: 0.06,
        envMapIntensity: 0.34,
      }),
      pipingCreamMat: new THREE.MeshPhysicalMaterial({
        map: quiltedBagPbr.map,
        bumpMap: quiltedBagPbr.bumpMap,
        bumpScale: 0.0055,
        roughnessMap: quiltedBagPbr.roughnessMap,
        roughness: 1.0,
        sheen: 0.62,
        sheenColor: '#FFFDF8',
      }),
      pipingCaramelMat: new THREE.MeshPhysicalMaterial({
        map: quiltedBagPbr.map,
        color: '#E6A054',
        bumpMap: quiltedBagPbr.bumpMap,
        bumpScale: 0.0055,
        roughnessMap: quiltedBagPbr.roughnessMap,
        roughness: 1.0,
        sheen: 0.45,
        sheenColor: '#FAD4A0',
      }),
      stemSageMat: new THREE.MeshStandardMaterial({ color: '#4D7838', roughness: 0.78 }),
      driedStemMat: new THREE.MeshStandardMaterial({ color: '#8A7C54', roughness: 0.84 }),
      leafGreenAMat: new THREE.MeshStandardMaterial({ color: '#558640', roughness: 0.62, side: THREE.DoubleSide }),
      leafGreenBMat: new THREE.MeshStandardMaterial({ color: '#6A9A52', roughness: 0.62, side: THREE.DoubleSide }),
      roseOuterMat: new THREE.MeshPhysicalMaterial({
        color: '#EC94A8',
        roughness: 0.56,
        sheen: 0.48,
        sheenColor: '#FFE4EB',
      }),
      roseInnerMat: new THREE.MeshPhysicalMaterial({
        color: '#E06E89',
        roughness: 0.54,
        sheen: 0.46,
        sheenColor: '#FFD6E0',
      }),
      daisyPetalMat: new THREE.MeshPhysicalMaterial({
        color: '#FCF8EC',
        roughness: 0.58,
        sheen: 0.42,
        sheenColor: '#FFFFFF',
      }),
      daisyCenterMat: new THREE.MeshStandardMaterial({ color: '#E5B83E', roughness: 0.62 }),
      lavenderFloretMat: new THREE.MeshPhysicalMaterial({
        color: '#967BC8',
        roughness: 0.66,
        sheen: 0.30,
        sheenColor: '#DED2F4',
      }),
      lavenderAltMat: new THREE.MeshPhysicalMaterial({
        color: '#AA90DB',
        roughness: 0.66,
        sheen: 0.30,
        sheenColor: '#EBE2FA',
      }),
      wheatGrainMat: new THREE.MeshStandardMaterial({ color: '#DFBC68', roughness: 0.72 }),
    }),
    [irAnodizedMicro, quiltedBagPbr, textures]
  );

  // Precision Lathe/Extrude/Tube Tool Geometries
  const scraperBladeGeo = useMemo(() => ensureSecondaryUv(createTriangularScraperBladeGeometry(0.122, 0.092, 0.0018)), []);
  const scraperHandleGeo = useMemo(() => createScraperHandleGeometry(0.130), []);
  const crankedBladeGeo = useMemo(() => ensureSecondaryUv(createCrankedSpatulaBladeGeometry()), []);
  const crankedHandleGeo = useMemo(() => createTurnedHandleGeometry(0.125, 0.013), []);
  const tweezersGeo = useMemo(() => createBrassTweezersGeometry(0.155), []);

  // Sculpted Lathe / Beveled Extrude Pedestals, Trays, Rings & Artisanal Props
  const turntablePedGeo = useMemo(() => createTurntablePedestalGeometry(), []);
  const turntablePlatterGeo = useMemo(() => ensureSecondaryUv(createBeveledMarbleTabletopGeometry(0.242, 0.018)), []);
  const temperingSlabGeo = useMemo(() => ensureSecondaryUv(createBeveledBoxGeometry(0.56, 0.032, 0.42, 0.014, 0.004, 0.004, 3)), []);
  const leftTrayGeo = useMemo(() => ensureSecondaryUv(createBeveledBoxGeometry(0.48, 0.018, 0.38, 0.012, 0.003, 0.003, 2)), []);
  const rightTrayGeo = useMemo(() => ensureSecondaryUv(createBeveledBoxGeometry(0.46, 0.018, 0.52, 0.012, 0.003, 0.003, 2)), []);
  const pistachioKernelGeo = useMemo(() => createPistachioKernelGeometry(), []);
  const vanillaPodGeos = useMemo(
    () => [
      createVanillaPodGeometry(0.014, 0.175),
      createVanillaPodGeometry(-0.011, 0.168),
      createVanillaPodGeometry(0.016, 0.178),
      createVanillaPodGeometry(-0.015, 0.172),
    ],
    []
  );
  const pipingBagGeo = useMemo(() => createPipingBagGeometry(0.046, 0.19), []);
  const islandNapkinGeo = useMemo(() => createFoldedLinenNapkinGeometry(0.22, 0.16, 0.0056), []);
  const brassRulerGeo = useMemo(() => createBeveledBoxGeometry(0.22, 0.0032, 0.036, 0.004, 0.001, 0.001, 2), []);
  const brassRulerTex = useMemo(() => createBrassRulerTexture(), []);

  // Thick-walled Crystal Glass Vessels (LatheGeometry with transmission refraction)
  const berryBowlGeo = useMemo(() => createGlassVesselGeometry(0.098, 0.064, 0.076, 0.0045), []);
  const pistachioBowlGeo = useMemo(() => createGlassVesselGeometry(0.082, 0.056, 0.066, 0.0042), []);
  const vanillaJarGeo = useMemo(() => createGlassVesselGeometry(0.042, 0.038, 0.124, 0.0038), []);
  const goldDishGeo = useMemo(() => createGlassVesselGeometry(0.074, 0.060, 0.032, 0.0038), []);

  const pistachioInstRef = useRef<THREE.InstancedMesh>(null);
  const turntablePlatterRef = useRef<THREE.Group>(null);
  const chocPuddleRef = useRef<THREE.Mesh>(null);
  const chocPuddleUniformsRef = useRef({
    uTime: { value: 0 },
    uScrapePos: { value: new THREE.Vector2(0, 0) },
    uScrapeWave: { value: 0 },
    uTemperShine: { value: 0 },
  });
  const scraperRightRef = useRef<THREE.Group>(null);
  const scraperLeftRef = useRef<THREE.Group>(null);
  const lastIrKeyRef = useRef('');

  const currentStep = useGameStore((s) => s.currentStep);
  const selectedFlavor = useGameStore((s) => s.selectedFlavor);
  const chocPhase = useGameStore((s) => s.chocPhase);
  const chocCurlsCount = useGameStore((s) => s.chocCurlsCount);

  const flavor = useMemo(() => ENTREMET_FLAVOR_PRESETS[resolveFlavorId(selectedFlavor)], [selectedFlavor]);

  // Velvety Ghibli patisserie tempering puddle: 45°C warm satin cocoa -> silky tempered lustre (no glaring mirror!)
  const chocPuddleMat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: '#4A2816',
      roughness: 0.36,
      clearcoat: 0.08,
      clearcoatRoughness: 0.28,
      envMapIntensity: 0.35,
    });
    const uniforms = chocPuddleUniformsRef.current;
    m.customProgramCacheKey = () => 'choc-puddle-wave-v2';
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.uniforms.uScrapePos = uniforms.uScrapePos;
      shader.uniforms.uScrapeWave = uniforms.uScrapeWave;
      shader.uniforms.uTemperShine = uniforms.uTemperShine;
      shader.vertexShader = shader.vertexShader
        .replace(
          'void main() {',
          `uniform float uTime;\nuniform vec2 uScrapePos;\nuniform float uScrapeWave;\nuniform float uTemperShine;\nvarying vec2 vChocPos;\nvarying float vChocRidge;\nvoid main() {`
        )
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
          vec2 cpDiff = position.xz - uScrapePos;
          float cpDist = length(cpDiff);
          float cpEnv = exp(-cpDist * cpDist * 115.0) * smoothstep(0.0, 0.022, cpDist);
          float cpPhase = cpDist * 88.0 - uTime * 9.6;
          float cpAmp = 0.0032 * uScrapeWave;
          float cpSlope = (cpDist > 0.001) ? (cpAmp * cpEnv * 88.0 * cos(cpPhase)) : 0.0;
          vec2 cpGrad = (cpDist > 0.001) ? (cpDiff / cpDist) * cpSlope : vec2(0.0);
          objectNormal = normalize(objectNormal + vec3(-cpGrad.x, 0.0, -cpGrad.y));
          vChocPos = position.xz;
          vChocRidge = clamp(uScrapeWave * cpEnv * (0.5 + 0.5 * sin(cpPhase)), 0.0, 1.0);`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          transformed.y += cpAmp * cpEnv * sin(cpPhase);`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          'void main() {',
          `uniform float uTemperShine;\nvarying vec2 vChocPos;\nvarying float vChocRidge;\nvoid main() {`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          float ribAngle = atan(vChocPos.y, vChocPos.x + 1e-4);
          float sheenBand = 0.5 + 0.5 * sin(length(vChocPos) * 42.0 - ribAngle * 2.0);
          float sheenMod = mix(0.045, -0.012, uTemperShine) * (sheenBand * 0.5 + vChocRidge * 0.5);
          roughnessFactor = clamp(roughnessFactor + sheenMod, 0.024, 0.42);`
        );
    };
    return m;
  }, []);

  useEffect(() => {
    chocPuddleMat.color.set(flavor.chocolateColor);
  }, [chocPuddleMat, flavor.chocolateColor]);

  const irDisplayTex = useMemo(
    () => createDigitalReadoutTexture('#0B1814', '#6AFFAF', '果泥温度', '68.0°C'),
    []
  );

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();
    const state = useGameStore.getState();
    const step = state.currentStep;
    const tempVal = Math.round((step === 4 ? state.chocTemp : state.berryTemp) * 10) / 10;
    const irKey = `${step === 4 ? 4 : 3}:${tempVal.toFixed(1)}`;
    if (irKey !== lastIrKeyRef.current) {
      lastIrKeyRef.current = irKey;
      const label = step === 4 ? '巧浆温度' : '果泥温度';
      drawDigitalReadout(
        irDisplayTex.image as HTMLCanvasElement,
        '#0B1814',
        '#6AFFAF',
        label,
        `${tempVal.toFixed(1)}°C`
      );
      irDisplayTex.needsUpdate = true;
    }

    if (turntablePlatterRef.current) {
      turntablePlatterRef.current.rotation.y = state.turntableAngle;
    }

    const activePhase = state.chocPhase;
    const cycle = state.chocScrapeCycle;
    const bladeDrag = state.liveBladeDrag;
    const curlArc = state.liveCurlArc;
    const isTablage = step === 4 && (cycle > 0.01 || Math.abs(bladeDrag) > 0.02);
    const isLiveCurling = step === 4 && activePhase === 'curling' && curlArc > 0.01;
    const scrapeX = isTablage ? Math.sin(cycle * 1.6) * 0.082 + bladeDrag * 0.098 : 0;
    const scrapeZ = isTablage ? Math.cos(cycle * 0.8) * 0.048 : 0;

    // Dramatic physical phase progression: 45°C warm cocoa paste -> razor-gloss 5-form tempered couverture
    const coolProgress = THREE.MathUtils.clamp((45.0 - state.chocTemp) / 18.0, 0, 1);
    const temperTarget =
      activePhase === 'curling' || activePhase === 'done'
        ? 1.0
        : activePhase === 'warming_to_31'
          ? 0.62 + THREE.MathUtils.clamp((state.chocTemp - 27.0) / 4.5, 0, 1) * 0.34
          : coolProgress * 0.56;
    const temperShine = THREE.MathUtils.damp(chocPuddleUniformsRef.current.uTemperShine.value, temperTarget, 6.5, dt);
    chocPuddleUniformsRef.current.uTemperShine.value = temperShine;

    chocPuddleUniformsRef.current.uTime.value = t;
    const targetWave = isLiveCurling ? 0.62 : isTablage ? 1.18 : 0.0;
    chocPuddleUniformsRef.current.uScrapeWave.value = THREE.MathUtils.damp(
      chocPuddleUniformsRef.current.uScrapeWave.value,
      targetWave,
      9.0,
      dt
    );
    if (isLiveCurling) {
      chocPuddleUniformsRef.current.uScrapePos.value.x = THREE.MathUtils.damp(
        chocPuddleUniformsRef.current.uScrapePos.value.x,
        bladeDrag * 0.035,
        14.0,
        dt
      );
      chocPuddleUniformsRef.current.uScrapePos.value.y = THREE.MathUtils.damp(
        chocPuddleUniformsRef.current.uScrapePos.value.y,
        0.068 - curlArc * 0.145,
        14.0,
        dt
      );
    } else {
      chocPuddleUniformsRef.current.uScrapePos.value.x = THREE.MathUtils.damp(
        chocPuddleUniformsRef.current.uScrapePos.value.x,
        scrapeX,
        12.0,
        dt
      );
      chocPuddleUniformsRef.current.uScrapePos.value.y = THREE.MathUtils.damp(
        chocPuddleUniformsRef.current.uScrapePos.value.y,
        scrapeZ,
        12.0,
        dt
      );
    }

    if (chocPuddleRef.current) {
      const targetPx = -0.04 + (isTablage ? Math.sin(cycle) * 0.015 + bladeDrag * 0.018 : 0);
      chocPuddleRef.current.position.x = THREE.MathUtils.damp(chocPuddleRef.current.position.x, targetPx, 10.0, dt);
      chocPuddleRef.current.position.y = 0.041;
      chocPuddleRef.current.position.z = -0.02;

      const targetSx = 1.05 + (isTablage ? Math.abs(Math.sin(cycle)) * 0.072 + Math.abs(bladeDrag) * 0.045 : 0);
      const targetSy = 1.0 - (isTablage ? Math.abs(Math.sin(cycle)) * 0.09 : 0);
      const targetSz = 0.78 + (isTablage ? Math.cos(cycle * 2) * 0.052 : 0);
      chocPuddleRef.current.scale.x = THREE.MathUtils.damp(chocPuddleRef.current.scale.x, targetSx, 10.0, dt);
      chocPuddleRef.current.scale.y = THREE.MathUtils.damp(chocPuddleRef.current.scale.y, targetSy, 10.0, dt);
      chocPuddleRef.current.scale.z = THREE.MathUtils.damp(chocPuddleRef.current.scale.z, targetSz, 10.0, dt);
    }

    chocPuddleMat.roughness = THREE.MathUtils.lerp(0.36, 0.14, temperShine);
    chocPuddleMat.clearcoat = THREE.MathUtils.lerp(0.08, 0.44, temperShine);
    chocPuddleMat.clearcoatRoughness = THREE.MathUtils.lerp(0.28, 0.14, temperShine);
    chocPuddleMat.envMapIntensity = THREE.MathUtils.lerp(0.35, 0.68, temperShine);

    if (scraperRightRef.current) {
      let tx = 0.135;
      let ty = 0.052;
      let tz = 0.135;
      let rx = Math.PI * 0.5;
      let ry = 0.0;
      let rz = 0.36;
      let lambda = 8.0;

      if (isLiveCurling) {
        tx = -0.04 + bladeDrag * 0.035;
        ty = 0.076;
        tz = 0.119 - curlArc * 0.145;
        rx = 0.74;
        ry = 0.0;
        rz = 0.0;
        lambda = 14.0;
      } else if (isTablage) {
        tx = 0.06 + scrapeX * 0.72;
        ty = 0.082;
        tz = 0.105 + scrapeZ * 0.45;
        rx = 0.56;
        ry = -0.22 - Math.sin(cycle) * 0.12 - bladeDrag * 0.18;
        rz = 0.04;
        lambda = 13.0;
      }

      const travelDist = Math.hypot(tx - scraperRightRef.current.position.x, tz - scraperRightRef.current.position.z);
      const smoothLift = Math.min(0.030, travelDist * 0.24);
      scraperRightRef.current.position.x = THREE.MathUtils.damp(scraperRightRef.current.position.x, tx, lambda, dt);
      scraperRightRef.current.position.y = THREE.MathUtils.damp(scraperRightRef.current.position.y, ty + smoothLift, lambda, dt);
      scraperRightRef.current.position.z = THREE.MathUtils.damp(scraperRightRef.current.position.z, tz, lambda, dt);
      scraperRightRef.current.rotation.x = THREE.MathUtils.damp(scraperRightRef.current.rotation.x, rx, lambda, dt);
      scraperRightRef.current.rotation.y = THREE.MathUtils.damp(scraperRightRef.current.rotation.y, ry, lambda, dt);
      scraperRightRef.current.rotation.z = THREE.MathUtils.damp(scraperRightRef.current.rotation.z, rz, lambda, dt);
    }

    if (scraperLeftRef.current) {
      const activeLeft = isTablage && !isLiveCurling;
      const ltx = activeLeft ? -0.145 + scrapeX * 0.42 : -0.150;
      const lty = activeLeft ? 0.072 : 0.0425;
      const ltz = activeLeft ? 0.105 - scrapeZ * 0.32 : 0.128;
      const lrx = activeLeft ? 0.22 : 0.0;
      const lry = activeLeft ? -0.52 + Math.cos(cycle) * 0.14 : -0.44;
      const lrz = activeLeft ? -0.14 : 0.0;
      const lLambda = activeLeft ? 12.0 : 8.0;
      const lTravel = Math.hypot(ltx - scraperLeftRef.current.position.x, ltz - scraperLeftRef.current.position.z);
      const lLift = Math.min(0.026, lTravel * 0.22);

      scraperLeftRef.current.position.x = THREE.MathUtils.damp(scraperLeftRef.current.position.x, ltx, lLambda, dt);
      scraperLeftRef.current.position.y = THREE.MathUtils.damp(scraperLeftRef.current.position.y, lty + lLift, lLambda, dt);
      scraperLeftRef.current.position.z = THREE.MathUtils.damp(scraperLeftRef.current.position.z, ltz, lLambda, dt);
      scraperLeftRef.current.rotation.x = THREE.MathUtils.damp(scraperLeftRef.current.rotation.x, lrx, lLambda, dt);
      scraperLeftRef.current.rotation.y = THREE.MathUtils.damp(scraperLeftRef.current.rotation.y, lry, lLambda, dt);
      scraperLeftRef.current.rotation.z = THREE.MathUtils.damp(scraperLeftRef.current.rotation.z, lrz, lLambda, dt);
    }
  });

  const berryMat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: '#D6283E',
      roughness: 0.28,
      clearcoat: 0,
      envMapIntensity: 0.40,
    });
    return enhanceWithFoodSSS(m, { sssColor: '#FF6A7E', sssStrength: 0.34, cacheTag: 'equip-berry' });
  }, []);

  // Populate 140 instanced roasted Sicilian Bronte pistachio kernels mounded organically inside the crystal bowl
  useLayoutEffect(() => {
    const inst = pistachioInstRef.current;
    if (!inst) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let rng = 4242;
    const rand = () => {
      rng = (rng * 1664525 + 1013904223) >>> 0;
      return rng / 4294967296;
    };
    const palette = [0x8eb845, 0x769f34, 0xa2cb59, 0x678a2d, 0x99bd4c];
    for (let i = 0; i < 140; i++) {
      const layer = Math.floor(i / 46); // 3 heaped granular tiers
      const maxR = layer === 0 ? 0.056 : layer === 1 ? 0.048 : 0.036;
      const rad = Math.sqrt(rand()) * maxR;
      const a = rand() * Math.PI * 2;
      const baseH = 0.020 + layer * 0.011 + (1.0 - rad / 0.062) * 0.014;
      dummy.position.set(Math.cos(a) * rad, baseH, Math.sin(a) * rad);
      dummy.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
      dummy.scale.setScalar(0.85 + rand() * 0.45);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      color.setHex(palette[i % palette.length]);
      inst.setColorAt(i, color);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, []);

  useEffect(() => {
    return () => {
      irDisplayTex.dispose();
      brassRulerTex.dispose();
      raspberryGeo.dispose();
      miniStrawberryGeo.dispose();
      strawberryCalyxGeo.dispose();
      goldLeafGeo.dispose();
      chocCurlGeo.dispose();
      whiteChocFlakeGeo.dispose();
      chocPuddleGeo.dispose();
      chocPuddleMat.dispose();
      culDePouleGeo.dispose();
      trayRailLeftGeo.dispose();
      traySideLeftGeo.dispose();
      trayRailRightGeo.dispose();
      traySideRightGeo.dispose();
      irProbeGeo.dispose();
      irLeatherPadGeo.dispose();
      irBezelGeo.dispose();
      parchmentDiscGeo.dispose();
      flutedNozzleGeo.dispose();
      standbyFlutedNozzleGeo.dispose();
      nozzleDockGeo.dispose();
      nozzleDockTrimGeo.dispose();
      couplerRingGeo.dispose();
      irAnodizedMicro.bumpMap.dispose();
      irAnodizedMicro.roughnessMap.dispose();
      quiltedBagPbr.map.dispose();
      quiltedBagPbr.bumpMap.dispose();
      quiltedBagPbr.roughnessMap.dispose();
      Object.values(microToolMats).forEach((m) => m.dispose());
      scraperBladeGeo.dispose();
      scraperHandleGeo.dispose();
      crankedBladeGeo.dispose();
      crankedHandleGeo.dispose();
      tweezersGeo.dispose();
      turntablePedGeo.dispose();
      turntablePlatterGeo.dispose();
      temperingSlabGeo.dispose();
      leftTrayGeo.dispose();
      rightTrayGeo.dispose();
      tableRunnerGeo.dispose();
      slateTrivetGeo.dispose();
      tableRunnerMat.dispose();
      lacePlacematMat.dispose();
      bouquetPitcherGeo.dispose();
      bouquetLeafGeo.dispose();
      bouquetStemGeo.dispose();
      bouquetPetalGeo.dispose();
      bouquetFloretGeo.dispose();
      bouquetCenterGeo.dispose();
      honeyBoardGeo.dispose();
      honeyPotGeo.dispose();
      sugarPotGeo.dispose();
      rightVaseGeo.dispose();
      tastingPlateGeo.dispose();
      miniTartShellGeo.dispose();
      pistachioKernelGeo.dispose();
      vanillaPodGeos.forEach((g) => g.dispose());
      pipingBagGeo.dispose();
      islandNapkinGeo.dispose();
      brassRulerGeo.dispose();
      berryBowlGeo.dispose();
      pistachioBowlGeo.dispose();
      vanillaJarGeo.dispose();
      goldDishGeo.dispose();
      berryMat.dispose();
      stonewareBowlMat.dispose();
      sageBowlMat.dispose();
    };
  }, [
    irDisplayTex,
    brassRulerTex,
    raspberryGeo,
    miniStrawberryGeo,
    strawberryCalyxGeo,
    goldLeafGeo,
    chocCurlGeo,
    whiteChocFlakeGeo,
    chocPuddleGeo,
    chocPuddleMat,
    culDePouleGeo,
    trayRailLeftGeo,
    traySideLeftGeo,
    trayRailRightGeo,
    traySideRightGeo,
    irProbeGeo,
    irLeatherPadGeo,
    irBezelGeo,
    parchmentDiscGeo,
    flutedNozzleGeo,
    standbyFlutedNozzleGeo,
    nozzleDockGeo,
    nozzleDockTrimGeo,
    couplerRingGeo,
    irAnodizedMicro,
    quiltedBagPbr,
    microToolMats,
    scraperBladeGeo,
    scraperHandleGeo,
    crankedBladeGeo,
    crankedHandleGeo,
    tweezersGeo,
    turntablePedGeo,
    turntablePlatterGeo,
    temperingSlabGeo,
    leftTrayGeo,
    rightTrayGeo,
    tableRunnerGeo,
    slateTrivetGeo,
    tableRunnerMat,
    lacePlacematMat,
    bouquetPitcherGeo,
    bouquetLeafGeo,
    bouquetStemGeo,
    bouquetPetalGeo,
    bouquetFloretGeo,
    bouquetCenterGeo,
    honeyBoardGeo,
    honeyPotGeo,
    sugarPotGeo,
    rightVaseGeo,
    tastingPlateGeo,
    miniTartShellGeo,
    pistachioKernelGeo,
    vanillaPodGeos,
    pipingBagGeo,
    islandNapkinGeo,
    brassRulerGeo,
    berryBowlGeo,
    pistachioBowlGeo,
    vanillaJarGeo,
    goldDishGeo,
    berryMat,
    stonewareBowlMat,
    sageBowlMat,
  ]);

  return (
    <group position={[0, 0.921, 0]}>
      {/* ====================================================================
          0. PASTORAL TABLE RUNNER (Left-Center Prep Zone ONLY) + STONE TRIVET + PLACEMATS
         ==================================================================== */}
      {/* Embroidered Belgian Linen Runner spanning x ∈ [-1.41, -0.01] — cleanly clear of [0.28, -0.32] glowing burner! */}
      <mesh position={[-0.71, 0.0014, -0.35]} geometry={tableRunnerGeo} material={tableRunnerMat} receiveShadow raycast={() => null} />
      {/* Dedicated Slate-Stone Hearth Trivet Base isolating Step 3 Induction Burner OFF embroidered linen */}
      <mesh position={[0.28, 0.0018, -0.32]} geometry={slateTrivetGeo} receiveShadow raycast={() => null}>
        <meshStandardMaterial color="#383430" roughness={0.84} metalness={0.08} />
      </mesh>
      {/* Scalloped Crochet-Lace Placemats seated strictly ABOVE the flat linen tablecloth (y=0.9228 vs 0.9211) */}
      {[
        { pos: [-1.05, 0.0018, 0.08] as [number, number, number], r: 0.228 },
        { pos: [-0.46, 0.0018, -0.10] as [number, number, number], r: 0.104 },
        { pos: [0.58, 0.0018, 0.20] as [number, number, number], r: 0.272 },
        { pos: [-1.49, 0.0018, -0.28] as [number, number, number], r: 0.088 },
      ].map((pm, pi) => (
        <mesh
          key={`placemat-${pi}`}
          position={pm.pos}
          rotation={[-Math.PI / 2, 0, pi * 0.45]}
          material={lacePlacematMat}
          receiveShadow
          raycast={() => null}
        >
          <circleGeometry args={[pm.r, 40]} />
        </mesh>
      ))}

      {/* ====================================================================
          A. STATION 5 & 6: TURNED WALNUT & FLORAL STONEWARE TURNTABLE (x = +0.58, z = +0.20)
         ==================================================================== */}
      <group position={[0.58, 0, 0.20]}>
        <mesh geometry={turntablePedGeo} material={walnutMat} castShadow receiveShadow />
        <group ref={turntablePlatterRef} position={[0, 0.083, 0]}>
          <mesh geometry={turntablePlatterGeo} material={stonewareBowlMat} castShadow receiveShadow />
          <mesh position={[0, 0.002, 0]} rotation={[Math.PI / 2, 0, 0]} material={brassMat}>
            <torusGeometry args={[0.242, 0.0055, 14, 56]} />
          </mesh>
          {/* Die-cut French Cream Baking Parchment Sheet seated flush inside Step 5 stainless mousse ring (zero bottom void!) */}
          <mesh
            position={[0, 0.0092, 0]}
            geometry={parchmentDiscGeo}
            material={microToolMats.parchmentMat}
            receiveShadow
            visible={currentStep <= 5}
          />
        </group>
      </group>

      {/* ====================================================================
          B. STATION 4: BEVELED CARRARA TEMPERING SLAB & TRIANGULAR SCRAPERS
         ==================================================================== */}
      <group position={[-0.28, 0, 0.22]}>
        {[
          [-0.24, 0.005, -0.17],
          [0.24, 0.005, -0.17],
          [-0.24, 0.005, 0.17],
          [0.24, 0.005, 0.17],
        ].map((fp, idx) => (
          <mesh key={idx} position={fp as [number, number, number]} material={brassMat}>
            <cylinderGeometry args={[0.016, 0.018, 0.010, 14]} />
          </mesh>
        ))}
        <mesh position={[0, 0.025, 0]} geometry={temperingSlabGeo} castShadow receiveShadow>
          <meshPhysicalMaterial
            map={marbleSlabPbr.map}
            normalMap={marbleSlabPbr.normalMap}
            normalScale={MARBLE_SLAB_NORMAL_SCALE}
            roughnessMap={marbleSlabPbr.roughnessMap}
            roughness={1.0}
            clearcoat={0.10}
            clearcoatRoughness={0.36}
            envMapIntensity={0.36}
          />
        </mesh>
        {/* Organic Sculpted Tempered Chocolate Puddle with live wave ripples pushed by scraper */}
        <mesh
          ref={chocPuddleRef}
          position={[-0.04, 0.041, -0.02]}
          scale={[1.05, 1.0, 0.78]}
          geometry={chocPuddleGeo}
          material={chocPuddleMat}
          receiveShadow
        />

        {/* MOF Tablage Pairing driven smoothly via refs in useFrame */}
        <group
          ref={scraperRightRef}
          position={[0.135, 0.052, 0.135]}
          rotation={[Math.PI * 0.5, 0.0, 0.36]}
        >
          <mesh geometry={scraperBladeGeo} material={stainlessMat} castShadow />
          <mesh position={[0, 0.048, 0]} geometry={scraperHandleGeo} material={rosewoodMat} castShadow />
        </group>
        <group
          ref={scraperLeftRef}
          position={[-0.150, 0.0425, 0.128]}
          rotation={[0.0, -0.44, 0.0]}
        >
          <mesh geometry={crankedBladeGeo} material={stainlessMat} castShadow />
          <mesh position={[0.042, 0.018, 0]} rotation={[0, 0, -Math.PI / 2]} material={brassMat}>
            <cylinderGeometry args={[0.011, 0.011, 0.012, 20]} />
          </mesh>
          <mesh
            position={[0.048, 0.018, 0]}
            rotation={[0, 0, -Math.PI / 2]}
            geometry={crankedHandleGeo}
            material={rosewoodMat}
            castShadow
          />
        </group>

        {/* Thick-Walled Seamless Hammered Copper 45°C Mother-Chocolate Reserve Bowl — 4.2cm CLEAR of Marble Slab & Runner! */}
        <group position={[-0.18, 0.0016, -0.32]}>
          <mesh position={[0, 0.005, 0]} rotation={[Math.PI / 2, 0, 0]} material={brassMat}>
            <torusGeometry args={[0.046, 0.0045, 14, 36]} />
          </mesh>
          <mesh position={[0, 0.004, 0]} geometry={culDePouleGeo} material={copperMat} castShadow receiveShadow />
          <mesh position={[0, 0.044, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.072, 36]} />
            <meshPhysicalMaterial color={flavor.chocolateColor} roughness={0.22} clearcoat={0.24} envMapIntensity={0.42} />
          </mesh>
        </group>

        {currentStep !== 4 && chocCurlsCount === 0 && (
          <mesh position={[0.19, 0.042, -0.11]} rotation={[0, 0.35, 0]} scale={1.45} geometry={whiteChocFlakeGeo} castShadow>
            <meshPhysicalMaterial
              color="#FFF6E2"
              roughness={0.38}
              clearcoat={0}
              envMapIntensity={0.36}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}
      </group>

      {/* ====================================================================
          C. STATION 3 & 4 SLEEK DIGITAL PASTRY IR STYLUS & BACKLIT OLED DISPLAY ON LEATHER MAT
             (Zero pedestal pole or toy L-gun clutter — crisp legible OLED facing Step 3 & Step 4 cameras!)
         ==================================================================== */}
      <group position={[0.64, 0, -0.36]} rotation={[0, 0.62, 0]} visible={currentStep <= 4}>
        {/* Stitched espresso leather probe resting mat */}
        <mesh position={[0, 0.0022, 0]} geometry={irLeatherPadGeo} material={microToolMats.irLeatherMat} receiveShadow />
        {/* Low-profile walnut cradle rest lifting sensor snout toward pot */}
        <mesh position={[0, 0.011, 0.025]} material={walnutMat} castShadow>
          <boxGeometry args={[0.044, 0.014, 0.036]} />
        </mesh>
        <group position={[0, 0.024, 0]} rotation={[-0.14, 0, 0]}>
          {/* Ergonomic tapered dark titanium body + walnut lower grip collar */}
          <mesh geometry={irProbeGeo} material={microToolMats.irBodyMat} castShadow />
          <mesh position={[0, -0.003, 0.042]} rotation={[Math.PI / 2, 0, 0]} material={brassMat}>
            <cylinderGeometry args={[0.016, 0.017, 0.010, 24]} />
          </mesh>
          <mesh position={[0, 0.002, -0.074]} rotation={[Math.PI / 2, 0, 0]} material={brassMat} castShadow>
            <cylinderGeometry args={[0.0085, 0.0125, 0.022, 24]} />
          </mesh>
          <mesh position={[0, 0.002, -0.086]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0062, 0.0062, 0.004, 20]} />
            <meshStandardMaterial color="#121820" metalness={0.88} roughness={0.12} />
          </mesh>
          {/* Large tilted brushed-brass bezel + high-contrast backlit OLED temperature readout */}
          <group position={[0, 0.022, 0.008]} rotation={[-0.68, 0, 0]}>
            <mesh geometry={irBezelGeo} material={brassMat} castShadow />
            <mesh position={[0, 0, 0.0042]}>
              <planeGeometry args={[0.056, 0.030]} />
              <meshBasicMaterial map={irDisplayTex} />
            </mesh>
          </group>
        </group>
      </group>

      {/* ====================================================================
          D. LEFT WING WALNUT & BRASS GALLERY TRAY (x = -1.12, z = -0.34, generous spacing!)
         ==================================================================== */}
      <group position={[-1.12, 0.0028, -0.34]} raycast={() => null}>
        <mesh position={[0, 0.009, 0]} geometry={leftTrayGeo} material={walnutMat} castShadow receiveShadow />
        {[-0.190, 0.190].map((rz, ri) => (
          <mesh key={`lrz-${ri}`} position={[0, 0.020, rz]} geometry={trayRailLeftGeo} material={brassMat} castShadow />
        ))}
        {[-0.240, 0.240].map((rx, ri) => (
          <mesh key={`lrx-${ri}`} position={[rx, 0.020, 0]} geometry={traySideLeftGeo} material={brassMat} castShadow />
        ))}
        {[-0.240, 0.240].map((px, xi) =>
          [-0.190, 0.190].map((pz, zi) => (
            <mesh key={`lp-${xi}-${zi}`} position={[px, 0.026, pz]} material={brassMat} castShadow>
              <sphereGeometry args={[0.0065, 12, 10]} />
            </mesh>
          ))
        )}

        {/* 1. Hand-Thrown Speckled Cream Stoneware Bowl of Grounded Iridescent-Dewdrop Raspberries */}
        <group position={[-0.118, 0.018, 0.068]}>
          <mesh geometry={berryBowlGeo} material={stonewareBowlMat} castShadow receiveShadow />
          {[
            { p: [0, 0.018, 0], d: [0.010, 0.022, 0.012] },
            { p: [-0.036, 0.016, 0.022], d: [-0.011, 0.021, 0.009] },
            { p: [0.036, 0.016, 0.018], d: [0.012, 0.020, -0.008] },
            { p: [-0.018, 0.017, -0.034], d: [-0.009, 0.022, -0.011] },
            { p: [0.026, 0.017, -0.030], d: [0.010, 0.021, 0.010] },
            { p: [0.0, 0.042, 0.010], d: [0.008, 0.024, 0.012] },
            { p: [-0.020, 0.038, -0.012], d: [-0.012, 0.022, 0.008] },
          ].map((b, idx) => (
            <group key={idx} position={b.p as [number, number, number]}>
              <mesh geometry={raspberryGeo} material={berryMat} castShadow />
              <mesh position={b.d as [number, number, number]} material={microToolMats.dewdropMat}>
                <sphereGeometry args={[0.0036, 12, 10]} />
              </mesh>
            </group>
          ))}
        </group>

        {/* 2. Sage-Glazed Handmade Stoneware Bowl of Roasted Sicilian Pistachio Kernels */}
        <group position={[0.125, 0.018, 0.058]}>
          <mesh geometry={pistachioBowlGeo} material={sageBowlMat} castShadow receiveShadow />
          <mesh position={[0, 0.016, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.055, 24]} />
            <meshStandardMaterial color="#67862D" roughness={0.90} />
          </mesh>
          <instancedMesh ref={pistachioInstRef} args={[pistachioKernelGeo, undefined, 140]} castShadow>
            <meshStandardMaterial roughness={0.62} />
          </instancedMesh>
        </group>

        {/* 3. Tall Crystal Vessel of Curved Madagascar Bourbon Vanilla Pods (> 7cm clear of both bowls!) */}
        <group position={[0.004, 0.018, -0.108]}>
          <mesh geometry={vanillaJarGeo} material={crystalGlassMat} castShadow />
          <mesh position={[0, 0.007, 0]} material={brassMat} castShadow>
            <cylinderGeometry args={[0.0435, 0.045, 0.014, 28]} />
          </mesh>
          <mesh position={[0, 0.014, 0]}>
            <cylinderGeometry args={[0.034, 0.034, 0.008, 22]} />
            <meshStandardMaterial color="#1A100B" roughness={0.92} />
          </mesh>
          {vanillaPodGeos.map((podGeo, idx) => {
            const ang = idx * 1.55 + 0.3;
            return (
              <mesh
                key={idx}
                position={[Math.cos(ang) * 0.008, 0.016, Math.sin(ang) * 0.008]}
                rotation={[0.06 * (idx % 2 ? 1 : -1), ang, 0.09]}
                geometry={podGeo}
                material={microToolMats.vanillaPodMat}
                castShadow
              />
            );
          })}
        </group>
      </group>

      {/* ====================================================================
          D2. REAR-LEFT SIDE PASTORAL BOUQUET PITCHER (clear of Step 1 Copper Bowl sightline!)
              Hand-painted stoneware pitcher with multi-petal cupped roses, chamomile & lavender florets!
         ==================================================================== */}
      <group position={[-1.49, 0.0018, -0.28]} rotation={[0, 0.42, 0]} raycast={() => null}>
        <mesh geometry={bouquetPitcherGeo} material={stonewareBowlMat} castShadow receiveShadow />
        {/* Delicate ceramic ear handle */}
        <mesh position={[0.048, 0.078, 0]} material={stonewareBowlMat} castShadow>
          <torusGeometry args={[0.028, 0.0055, 12, 24, Math.PI]} />
        </mesh>
        {/* Arching eucalyptus & sage foliage stems */}
        {[0, 1, 2, 3, 4, 5].map((li) => {
          const a = (li / 6) * Math.PI * 2 + 0.25;
          return (
            <group key={`bleaf-${li}`} position={[Math.cos(a) * 0.015, 0.118, Math.sin(a) * 0.015]} rotation={[0.42 * Math.sin(a), -a, -0.42 * Math.cos(a)]}>
              <mesh geometry={bouquetStemGeo} material={microToolMats.stemSageMat} scale={[1, 0.86, 1]} />
              <mesh
                position={[0.006, 0.056, 0.004]}
                rotation={[0.35, 0, 0]}
                scale={[0.92, 0.92, 0.92]}
                geometry={bouquetLeafGeo}
                material={li % 2 === 0 ? microToolMats.leafGreenAMat : microToolMats.leafGreenBMat}
                castShadow
              />
            </group>
          );
        })}
        {/* Sculpted Multi-Petal Cupped Garden Roses, 8-Petal Chamomile Daisies & Whorl Lavender Spikes */}
        {[
          { p: [-0.020, 0.178, 0.016], s: 1.0, kind: 'rose' },
          { p: [0.022, 0.172, -0.012], s: 0.90, kind: 'rose' },
          { p: [0.002, 0.194, -0.020], s: 1.0, kind: 'daisy' },
          { p: [-0.016, 0.168, -0.018], s: 0.90, kind: 'daisy' },
          { p: [0.016, 0.186, 0.018], s: 1.0, kind: 'lav' },
          { p: [-0.004, 0.200, 0.006], s: 0.95, kind: 'lavAlt' },
        ].map((fl, fi) => (
          <group key={`bfl-${fi}`} position={fl.p as [number, number, number]}>
            <mesh position={[-0.004, -0.068, -0.003]} geometry={bouquetStemGeo} material={microToolMats.stemSageMat} />
            {fl.kind === 'lav' || fl.kind === 'lavAlt' ? (
              <group rotation={[0.10 * (fi % 2 ? 1 : -1), fi * 0.7, 0.08]}>
                {[0, 1, 2, 3, 4].map((tier) =>
                  [0, 1, 2].map((w) => {
                    const wa = (w / 3) * Math.PI * 2 + tier * 0.65;
                    const fy = -0.014 + tier * 0.0085;
                    const tr = 0.0034 - tier * 0.00035;
                    return (
                      <mesh
                        key={`fl-${tier}-${w}`}
                        position={[Math.cos(wa) * tr, fy, Math.sin(wa) * tr]}
                        rotation={[0.28, -wa + Math.PI * 0.5, 0]}
                        scale={[fl.s, fl.s, fl.s]}
                        geometry={bouquetFloretGeo}
                        material={fl.kind === 'lav' ? microToolMats.lavenderFloretMat : microToolMats.lavenderAltMat}
                        castShadow
                      />
                    );
                  })
                )}
              </group>
            ) : fl.kind === 'rose' ? (
              <group scale={fl.s}>
                {[0, 1, 2, 3, 4].map((pi) => {
                  const pa = (pi / 5) * Math.PI * 2;
                  return (
                    <mesh
                      key={`ro-${pi}`}
                      position={[Math.cos(pa) * 0.0045, 0, Math.sin(pa) * 0.0045]}
                      rotation={[0.42, -pa + Math.PI * 0.5, 0]}
                      scale={[1.05, 0.95, 1.05]}
                      geometry={bouquetPetalGeo}
                      material={microToolMats.roseOuterMat}
                      castShadow
                    />
                  );
                })}
                {[0, 1, 2, 3].map((pi) => {
                  const pa = (pi / 4) * Math.PI * 2 + 0.4;
                  return (
                    <mesh
                      key={`ri-${pi}`}
                      position={[Math.cos(pa) * 0.0022, 0.0025, Math.sin(pa) * 0.0022]}
                      rotation={[0.88, -pa + Math.PI * 0.5, 0]}
                      scale={[0.78, 0.78, 0.78]}
                      geometry={bouquetPetalGeo}
                      material={microToolMats.roseInnerMat}
                      castShadow
                    />
                  );
                })}
                <mesh position={[0, 0.0042, 0]} scale={0.72} geometry={bouquetCenterGeo} material={microToolMats.roseInnerMat} />
              </group>
            ) : (
              <group scale={fl.s}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((pi) => {
                  const pa = (pi / 8) * Math.PI * 2;
                  return (
                    <mesh
                      key={`dp-${pi}`}
                      position={[Math.cos(pa) * 0.0032, 0, Math.sin(pa) * 0.0032]}
                      rotation={[0.16, -pa + Math.PI * 0.5, 0]}
                      scale={[0.66, 0.85, 0.88]}
                      geometry={bouquetPetalGeo}
                      material={microToolMats.daisyPetalMat}
                      castShadow
                    />
                  );
                })}
                <mesh position={[0, 0.0024, 0]} geometry={bouquetCenterGeo} material={microToolMats.daisyCenterMat} />
              </group>
            )}
          </group>
        ))}
      </group>

      {/* ====================================================================
          D3. REAR-CENTER WALNUT HONEY & SUGAR PREP BOARD (x = -0.28, z = -0.34, ~11cm clear of pot handle!)
              Stirring rods mathematically bounded strictly inside cup inner radius (ZERO wall clipping!)
         ==================================================================== */}
      <group position={[-0.28, 0.0028, -0.34]} raycast={() => null}>
        <mesh position={[0, 0.006, 0]} geometry={honeyBoardGeo} material={walnutMat} castShadow receiveShadow />
        {/* Hand-Painted Floral Ceramic Honey Pot + Turned Beechwood Honey Dipper (100% inside inner rim!) */}
        <group position={[-0.064, 0.012, 0.006]}>
          <mesh geometry={honeyPotGeo} material={stonewareBowlMat} castShadow receiveShadow />
          <mesh position={[0, 0.056, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.031, 32]} />
            <meshPhysicalMaterial color="#DF8E1A" roughness={0.16} clearcoat={0.24} clearcoatRoughness={0.16} envMapIntensity={0.45} />
          </mesh>
          <group position={[0.002, 0.072, 0]} rotation={[0.04, 0.2, -0.13]}>
            <mesh material={walnutMat} castShadow>
              <cylinderGeometry args={[0.0030, 0.0035, 0.092, 16]} />
            </mesh>
            {[0, 1, 2].map((ri) => (
              <mesh key={ri} position={[0, -0.035 + ri * 0.006, 0]} rotation={[Math.PI / 2, 0, 0]} material={walnutMat}>
                <torusGeometry args={[0.0072, 0.0021, 10, 20]} />
              </mesh>
            ))}
          </group>
        </group>
        {/* Sage-Floral Sugar Cellar + Tiny Brushed Brass Spoon (100% inside inner rim!) */}
        <group position={[0.064, 0.012, -0.006]}>
          <mesh geometry={sugarPotGeo} material={sageBowlMat} castShadow receiveShadow />
          <mesh position={[0, 0.048, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.035, 32]} />
            <meshStandardMaterial color="#FCF7EC" roughness={0.92} />
          </mesh>
          <group position={[0.004, 0.058, 0]} rotation={[0.04, 0.15, -0.16]}>
            <mesh material={brassMat} castShadow>
              <cylinderGeometry args={[0.0022, 0.0028, 0.074, 14]} />
            </mesh>
            <mesh position={[0, -0.034, 0.002]} scale={[1.0, 0.45, 1.35]} material={brassMat}>
              <sphereGeometry args={[0.0065, 14, 10]} />
            </mesh>
          </group>
        </group>
      </group>

      {/* Neatly Folded Red-Gingham & Floral Pastry Napkin + Floral-Handle Cottage Butter Spreader Knife */}
      <group position={[-0.84, 0.001, 0.44]} rotation={[0, 0.08, 0]} raycast={() => null}>
        <mesh geometry={islandNapkinGeo} castShadow receiveShadow>
          <meshPhysicalMaterial
            map={craftAssets.ginghamTex}
            normalMap={textures.linenNormalMap}
            normalScale={LINEN_NORMAL_SCALE}
            roughness={0.88}
            sheen={0.65}
            sheenColor="#FFFDF5"
            sheenRoughness={0.68}
          />
        </mesh>
        {/* Dainty Floral-Handle Cottage Butter Knife resting flush on folded napkin */}
        <group position={[0.01, 0.008, 0.01]} rotation={[0, 0.16, 0]}>
          <mesh position={[-0.042, 0, 0]} material={stainlessMat} castShadow>
            <boxGeometry args={[0.082, 0.0018, 0.012]} />
          </mesh>
          <mesh position={[0.002, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={brassMat}>
            <cylinderGeometry args={[0.0055, 0.0055, 0.008, 16]} />
          </mesh>
          <mesh position={[0.044, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={rosewoodMat} castShadow>
            <capsuleGeometry args={[0.0068, 0.066, 10, 18]} />
          </mesh>
        </group>
      </group>

      {/* Graduated Anisotropic Champagne-Brass Patisserie Tempering Ruler (orderly front-right alignment) */}
      <mesh
        position={[0.98, 0.0016, 0.44]}
        rotation={[0, -0.06, 0]}
        geometry={brassRulerGeo}
        castShadow
        receiveShadow
        raycast={() => null}
      >
        <meshPhysicalMaterial map={brassRulerTex} metalness={0.88} roughness={0.20} anisotropy={0.60} />
      </mesh>

      {/* ====================================================================
          E. RIGHT WING WALNUT & BRASS GALLERY FINISHING TRAY (x = 1.22, z = -0.30, flush on oak slab!)
         ==================================================================== */}
      <group position={[1.22, 0.0005, -0.30]} raycast={() => null}>
        <mesh position={[0, 0.009, 0]} geometry={rightTrayGeo} material={walnutMat} castShadow receiveShadow />
        {[-0.260, 0.260].map((rz, ri) => (
          <mesh key={`rrz-${ri}`} position={[0, 0.020, rz]} geometry={trayRailRightGeo} material={brassMat} castShadow />
        ))}
        {[-0.230, 0.230].map((rx, ri) => (
          <mesh key={`rrx-${ri}`} position={[rx, 0.020, 0]} geometry={traySideRightGeo} material={brassMat} castShadow />
        ))}
        {[-0.230, 0.230].map((px, xi) =>
          [-0.260, 0.260].map((pz, zi) => (
            <mesh key={`rp-${xi}-${zi}`} position={[px, 0.026, pz]} material={brassMat} castShadow>
              <sphereGeometry args={[0.0065, 12, 10]} />
            </mesh>
          ))
        )}

        {/* Turned Walnut & Brushed-Brass Piping Bag Stand with Quilted Cloth Bags & Star-Fluted Nozzles */}
        <group position={[0.05, 0.018, -0.06]}>
          <mesh position={[0, 0.01, 0]} material={walnutMat} castShadow receiveShadow>
            <cylinderGeometry args={[0.096, 0.104, 0.02, 36]} />
          </mesh>
          <mesh position={[0, 0.004, 0]} rotation={[Math.PI / 2, 0, 0]} material={brassMat}>
            <torusGeometry args={[0.102, 0.0032, 12, 36]} />
          </mesh>
          <mesh position={[0, 0.115, -0.044]} material={brassMat} castShadow>
            <cylinderGeometry args={[0.0075, 0.0075, 0.21, 20]} />
          </mesh>
          {/* Rigid widened brass T-crossbar separating both rings cleanly with 1.4cm daylight */}
          <mesh position={[0, 0.207, -0.044]} rotation={[0, 0, Math.PI / 2]} material={brassMat} castShadow>
            <cylinderGeometry args={[0.0052, 0.0052, 0.122, 16]} />
          </mesh>
          {[-0.058, 0.058].map((bx, idx) => (
            <group key={idx} position={[bx, 0.135, 0]}>
              <mesh material={brassMat} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.072, 0]} castShadow>
                <torusGeometry args={[0.044, 0.0045, 14, 28]} />
              </mesh>
              <mesh
                position={[0, 0.02, 0]}
                geometry={pipingBagGeo}
                material={idx === 0 ? microToolMats.pipingCreamMat : microToolMats.pipingCaramelMat}
                castShadow
              />
              {/* Ribbed Coupler Ring + 8-Tooth Star-Fluted Stainless Nozzle (replaces bare grey cone) */}
              <mesh position={[0, -0.070, 0]} geometry={couplerRingGeo} material={brassMat} />
              <mesh position={[0, -0.074, 0]} rotation={[Math.PI, 0, 0]} geometry={flutedNozzleGeo} material={stainlessMat} castShadow />
            </group>
          ))}
        </group>

        {/* Sculpted Walnut & Brushed-Brass French Nozzle Organizer Block (`douilles cannelées`) */}
        <group position={[0.095, 0.029, 0.092]}>
          <mesh position={[0, -0.008, 0]} geometry={nozzleDockTrimGeo} material={brassMat} castShadow />
          <mesh geometry={nozzleDockGeo} material={walnutMat} castShadow receiveShadow />
          {[-0.054, -0.018, 0.018, 0.054].map((nx, idx) => (
            <group key={`noz-${idx}`} position={[nx, 0.012, 0]}>
              <mesh position={[0, 0.002, 0]} material={brassMat}>
                <cylinderGeometry args={[0.0135, 0.014, 0.004, 24]} />
              </mesh>
              <mesh position={[0, 0.003, 0]} rotation={[0, idx * 0.4, 0]} geometry={standbyFlutedNozzleGeo} material={stainlessMat} castShadow />
            </group>
          ))}
        </group>

        {/* Crystal Glass Dish with 24K Gold Leaf Flakes nestled solidly inside dish floor (`y = 0.009..0.015 < 0.032`)! */}
        <group position={[-0.09, 0.018, 0.14]}>
          <mesh geometry={goldDishGeo} material={crystalGlassMat} castShadow />
          <mesh position={[0, 0.031, 0]} rotation={[Math.PI / 2, 0, 0]} material={brassMat}>
            <torusGeometry args={[0.074, 0.0024, 12, 32]} />
          </mesh>
          {[-0.020, 0.016, 0.0, -0.006].map((ox, idx) => (
            <mesh
              key={idx}
              position={[ox, 0.0085 + idx * 0.0020, (idx - 1.5) * 0.012]}
              rotation={[0.05 * idx, idx * 1.15, 0]}
              geometry={goldLeafGeo}
              material={microToolMats.goldLeafMat}
            />
          ))}
        </group>
        {/* Precision Brass Gold-Leaf Tweezers resting flush on Walnut Tray (clear of nozzle dock!) */}
        <mesh
          position={[0.12, 0.020, 0.19]}
          rotation={[0, -0.32, 0]}
          geometry={tweezersGeo}
          material={brassMat}
          castShadow
        />
      </group>

      {/* Stainless Cranked Offset Palette Spatula with Floral Country Handle (orderly right-front zone) */}
      <group position={[1.16, 0.002, 0.24]} rotation={[0, 0.22, -0.02]}>
        <mesh geometry={crankedBladeGeo} material={stainlessMat} castShadow />
        <mesh position={[0.042, 0.018, 0]} rotation={[0, 0, -Math.PI / 2]} material={brassMat}>
          <cylinderGeometry args={[0.011, 0.011, 0.012, 24]} />
        </mesh>
        <mesh position={[0.048, 0.018, 0]} rotation={[0, 0, -Math.PI / 2]} geometry={crankedHandleGeo} material={rosewoodMat} castShadow />
      </group>

      {/* MOF Brushed-Brass & Walnut Entremet Unmolding Micro-Torch (generous 10cm clear of right gallery tray!) */}
      <group position={[0.92, 0, 0.25]} rotation={[0, -0.52, 0]}>
        <mesh position={[0, 0.008, 0]} material={brassMat} castShadow>
          <cylinderGeometry args={[0.034, 0.040, 0.016, 28]} />
        </mesh>
        <mesh position={[0, 0.018, 0]} rotation={[Math.PI / 2, 0, 0]} material={brassMat}>
          <torusGeometry args={[0.030, 0.003, 12, 28]} />
        </mesh>
        <mesh position={[0, 0.068, 0]} material={walnutMat} castShadow>
          <cylinderGeometry args={[0.024, 0.026, 0.104, 24]} />
        </mesh>
        <mesh position={[0, 0.128, 0]} material={brassMat} castShadow>
          <cylinderGeometry args={[0.020, 0.024, 0.026, 24]} />
        </mesh>
        {/* Angled Brass Flame Nozzle Shroud (24 segs!) */}
        <mesh position={[-0.032, 0.148, 0]} rotation={[0, 0, 1.18]} material={brassMat} castShadow>
          <cylinderGeometry args={[0.0075, 0.0095, 0.072, 24]} />
        </mesh>
        <mesh position={[-0.064, 0.162, 0]} rotation={[0, 0, 1.18]} material={stainlessMat}>
          <cylinderGeometry args={[0.0085, 0.0085, 0.018, 24]} />
        </mesh>
        {/* Knurled Gas Flow Knob (20 segs!) */}
        <mesh position={[0.022, 0.132, 0]} rotation={[0, 0, Math.PI / 2]} material={brassMat}>
          <cylinderGeometry args={[0.0085, 0.0085, 0.016, 20]} />
        </mesh>
      </group>

      {/* ====================================================================
          F. FRONT-RIGHT SYMMETRICAL DECOR: MINI GLASS DRIED-FLOWER BUD VASE & BERRY TARTLET SAUCER
         ==================================================================== */}
      <group position={[1.32, 0, 0.34]} raycast={() => null}>
        {/* Petite Ribbed Glass Bud Vase with Multi-Whorl Dried Lavender & Golden Wheat Ears */}
        <group position={[0.04, 0, -0.08]}>
          <mesh geometry={rightVaseGeo} material={crystalGlassMat} castShadow />
          {[
            { a: 0.2, s: 1.0, kind: 'lav' },
            { a: 2.3, s: 1.08, kind: 'wheat' },
            { a: 4.1, s: 0.94, kind: 'lavAlt' },
          ].map((st, si) => (
            <group key={si} position={[Math.cos(st.a) * 0.006, 0.072, Math.sin(st.a) * 0.006]} rotation={[0.14 * Math.sin(st.a), st.a, -0.14 * Math.cos(st.a)]}>
              <mesh geometry={bouquetStemGeo} material={microToolMats.driedStemMat} scale={[0.9, 1.15 * st.s, 0.9]} />
              {[0, 1, 2, 3, 4].map((tier) =>
                [0, 1].map((w) => {
                  const wa = (w * Math.PI) + tier * 0.72;
                  return (
                    <mesh
                      key={`rw-${tier}-${w}`}
                      position={[0.005 + Math.cos(wa) * 0.0028, (0.068 + tier * 0.0085) * st.s, 0.004 + Math.sin(wa) * 0.0028]}
                      rotation={[0.32, -wa + Math.PI * 0.5, 0]}
                      scale={[st.s, st.s, st.s]}
                      geometry={bouquetFloretGeo}
                      material={
                        st.kind === 'wheat'
                          ? microToolMats.wheatGrainMat
                          : st.kind === 'lav'
                            ? microToolMats.lavenderFloretMat
                            : microToolMats.lavenderAltMat
                      }
                      castShadow
                    />
                  );
                })
              )}
            </group>
          ))}
        </group>
        {/* Floral Ceramic Tasting Saucer holding a Mini Chantilly Strawberry Cream Tartlet (`迷你奶油草莓挞`) */}
        <group position={[-0.03, 0, 0.05]}>
          <mesh scale={[0.92, 0.92, 0.92]} geometry={tastingPlateGeo} material={stonewareBowlMat} castShadow receiveShadow />
          <mesh position={[0, 0.008, 0]} geometry={miniTartShellGeo} castShadow>
            <meshStandardMaterial color="#D99B52" roughness={0.72} envMapIntensity={0.30} />
          </mesh>
          <mesh position={[0, 0.022, 0]} scale={[1.0, 0.54, 1.0]} castShadow>
            <sphereGeometry args={[0.026, 24, 16]} />
            <meshPhysicalMaterial color="#FFF9ED" roughness={0.58} clearcoat={0} envMapIntensity={0.35} />
          </mesh>
          <group position={[-0.004, 0.028, 0.002]} rotation={[0.65, 0.25, -0.32]}>
            <mesh geometry={miniStrawberryGeo} castShadow>
              <meshPhysicalMaterial color="#DF3446" roughness={0.25} clearcoat={0} envMapIntensity={0.40} />
            </mesh>
            <mesh position={[0, 0.0248, 0]} geometry={strawberryCalyxGeo}>
              <meshStandardMaterial color="#548C3C" roughness={0.62} side={THREE.DoubleSide} />
            </mesh>
          </group>
          <mesh position={[0.016, 0.031, 0.010]} rotation={[0.2, 0.8, 0.3]} scale={0.55} geometry={whiteChocFlakeGeo} castShadow>
            <meshPhysicalMaterial color="#FFF6E2" roughness={0.38} clearcoat={0} envMapIntensity={0.35} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>
    </group>
  );
};

/**
 * 3. REAR & SIDE PATISSERIE EQUIPMENT MATRIX
 */
export const PatisserieEquipment: React.FC = () => {
  const { gl } = useThree();
  const textures = useMemo(() => getAtelierTextures(), []);
  const craftAssets = useMemo(() => getCottageCraftAssets(), []);
  const steelPbr = useMemo(() => getSteelPbrSet(1.2, 1.2), []);
  const hearthRubbleMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: craftAssets.rubbleStone.map,
        normalMap: craftAssets.rubbleStone.normalMap,
        normalScale: new THREE.Vector2(0.10, 0.10),
        color: '#E6DAC4',
        roughness: 0.93,
        metalness: 0.0,
        envMapIntensity: 0.16,
      }),
    [craftAssets]
  );
  // Animated GLSL Crackling Hearth Fireplace Flame Shader (warm dancing orange-gold tongues + white-hot core!)
  const hearthFlameMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
        },
        vertexShader: /* glsl */ `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 p = position;
            float sway = sin(uTime * 7.5 + p.y * 12.0 + p.x * 9.0) * 0.022 * uv.y;
            float swayZ = cos(uTime * 6.2 + p.y * 10.0) * 0.014 * uv.y;
            p.x += sway;
            p.z += swayZ;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying vec2 vUv;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
          }

          void main() {
            vec2 uv = vUv;
            float n1 = noise(vec2(uv.x * 5.0, uv.y * 5.5 - uTime * 4.8));
            float n2 = noise(vec2(uv.x * 10.0 + 3.1, uv.y * 9.0 - uTime * 7.4));
            float fbm = n1 * 0.65 + n2 * 0.35;

            // Organic licking flame teardrop silhouette
            float xDist = abs(uv.x - 0.5) * 2.0;
            float taper = mix(0.95, 0.08, pow(uv.y, 0.85));
            float flameMask = smoothstep(taper, taper * 0.22, xDist + (fbm - 0.48) * 0.55);
            flameMask *= smoothstep(0.0, 0.14, uv.y) * smoothstep(1.0, 0.52, uv.y + (fbm - 0.5) * 0.35);

            if (flameMask < 0.04) discard;

            // Deep ember-orange -> golden amber -> incandescent butter-yellow core
            vec3 outerCol = vec3(1.15, 0.24, 0.04);
            vec3 midCol   = vec3(1.55, 0.68, 0.12);
            vec3 coreCol  = vec3(2.10, 1.65, 0.72);
            float heat = clamp(flameMask * (1.15 - uv.y * 0.58) + fbm * 0.25, 0.0, 1.0);
            vec3 col = mix(outerCol, midCol, smoothstep(0.15, 0.58, heat));
            col = mix(col, coreCol, smoothstep(0.62, 0.94, heat));

            gl_FragColor = vec4(col, flameMask * 0.92);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
      }),
    []
  );
  const hearthFireLightRef = useRef<THREE.PointLight>(null);
  const ginghamSkirtMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: craftAssets.ginghamTex,
        normalMap: textures.linenNormalMap,
        normalScale: LINEN_NORMAL_SCALE,
        roughness: 0.88,
        sheen: 0.54,
        sheenColor: '#FFF5EB',
        sheenRoughness: 0.72,
        side: THREE.DoubleSide,
      }),
    [craftAssets, textures]
  );
  const mixerWhipRef = useRef<THREE.Group>(null);
  const chillerDoorRef = useRef<THREE.Group>(null);
  const mistParticlesRef = useRef<THREE.Points>(null);
  const silverKnifeGroupRef = useRef<THREE.Group>(null);
  const ovenTempKnobRef = useRef<THREE.Group>(null);
  const ovenDoorRef = useRef<THREE.Group>(null);
  const spongeDiscRef = useRef<THREE.Mesh>(null);
  const spongeDomeRef = useRef<THREE.Mesh>(null);
  const spongeDiscMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const spongeDomeMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const lastOvenTempRef = useRef(-1);
  const spongeRawColRef = useRef(new THREE.Color('#E3D2AC'));
  const spongeGoldColRef = useRef(new THREE.Color('#BA7A25'));
  const spongeBurntColRef = useRef(new THREE.Color('#4B2810'));
  const spongeBlendColRef = useRef(new THREE.Color('#E3D2AC'));
  const lastSpongeFlavorRef = useRef<string>('');
  const knifePulseTimerRef = useRef(0);
  const lastKnifePulseRef = useRef(0);

  const cryoMistMat = useMemo(() => createVaporMistMaterial('#F6ECE0', 0.18), []);

  // Sync anisotropic filtering across active 2K scanned PBR sets to active GPU ceiling
  useEffect(() => {
    [steelPbr, getMarblePbrSet(0.85, 0.85), getMarblePbrSet(0.95, 0.72)].forEach((pbr) => {
      applyTextureAnisotropy(pbr.map, gl, 16);
      applyTextureAnisotropy(pbr.normalMap, gl, 16);
      applyTextureAnisotropy(pbr.roughnessMap, gl, 16);
      if (pbr.metalnessMap) applyTextureAnisotropy(pbr.metalnessMap, gl, 16);
    });
  }, [gl, steelPbr]);

  // WebGL2 High-Craft Physical PBR Tool Materials (Anisotropy + Heat-Patina Iridescence + Wood Grain!)
  const toolPbrAssets = useMemo(
    () => ({
      brassMicro: createMicroSurfaceMaps(0.32, 0.08, true, 541),
      rosewoodPbr: createWoodGrainPbr('#4B2817', '#261007', 631),
      walnutPbr: createWoodGrainPbr('#8E6743', '#56381D', 637),
    }),
    []
  );

  const copperMat = useMemo(
    () =>
      enhanceWithStylizedFresnelRim(
        enhanceWithExtremeMicroCraft(
          new THREE.MeshPhysicalMaterial({
            color: '#DC855E',
            metalness: 0.86,
            roughness: 0.28,
            normalMap: textures.hammeredCopperNormalMap,
            normalScale: COPPER_NORMAL_SCALE,
            clearcoat: 0.16,
            clearcoatRoughness: 0.28,
            anisotropy: 0.36,
            envMapIntensity: 0.54,
          }),
          { boxProjectedIBL: true, detailKind: 'brushed_metal', detailStrength: 0.10, cacheTag: 'equip-copper' }
        ),
        { rimColor: '#FFD8A2', rimStrength: 0.36, rimPower: 2.4, topBias: 0.45, cacheTag: 'equip-copper-rim' }
      ),
    [textures]
  );

  const tinMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#DCDFE5',
        metalness: 0.84,
        roughness: 0.35,
        anisotropy: 0.36,
        envMapIntensity: 0.52,
      }),
    []
  );

  const brassMat = useMemo(
    () =>
      enhanceWithStylizedFresnelRim(
        enhanceWithExtremeMicroCraft(
          new THREE.MeshPhysicalMaterial({
            color: '#BE9858',
            bumpMap: toolPbrAssets.brassMicro.bumpMap,
            bumpScale: 0.0030,
            roughnessMap: toolPbrAssets.brassMicro.roughnessMap,
            metalness: 0.78,
            roughness: 1.0,
            anisotropy: 0.45,
            envMapIntensity: 0.48,
          }),
          { boxProjectedIBL: true, detailKind: 'brushed_metal', detailStrength: 0.10, cacheTag: 'equip-brass' }
        ),
        { rimColor: '#FFE6B4', rimStrength: 0.32, rimPower: 2.6, topBias: 0.42, cacheTag: 'equip-brass-rim' }
      ),
    [toolPbrAssets]
  );

  const ironMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#343638',
        metalness: 0.62,
        roughness: 0.50,
        envMapIntensity: 0.38,
      }),
    []
  );

  const stainlessMat = useMemo(
    () =>
      enhanceWithExtremeMicroCraft(
        new THREE.MeshPhysicalMaterial({
          color: '#ECEFF4',
          map: steelPbr.map,
          normalMap: steelPbr.normalMap,
          normalScale: STEEL_NORMAL_SCALE,
          roughnessMap: steelPbr.roughnessMap,
          metalnessMap: steelPbr.metalnessMap,
          metalness: 0.86,
          roughness: 1.0,
          anisotropy: 0.54,
          clearcoat: 0.0,
          envMapIntensity: 0.54,
        }),
        { boxProjectedIBL: true, detailKind: 'brushed_metal', detailStrength: 0.10, cacheTag: 'equip-stainless' }
      ),
    [steelPbr]
  );

  const epdmGasketMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#252629',
        roughness: 0.94,
        metalness: 0.04,
      }),
    []
  );

  const rosewoodMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: craftAssets.floralHandleTex,
        roughness: 0.68,
        clearcoat: 0.06,
        clearcoatRoughness: 0.48,
        envMapIntensity: 0.34,
      }),
    [craftAssets]
  );

  const walnutMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: toolPbrAssets.walnutPbr.map,
        bumpMap: toolPbrAssets.walnutPbr.bumpMap,
        bumpScale: 0.006,
        roughnessMap: toolPbrAssets.walnutPbr.roughnessMap,
        roughness: 1.0,
        clearcoat: 0.05,
        clearcoatRoughness: 0.52,
        envMapIntensity: 0.34,
      }),
    [toolPbrAssets]
  );

  const crystalGlassMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#F5F2E8',
        transparent: true,
        opacity: 0.24,
        roughness: 0.18,
        metalness: 0.02,
        ior: 1.48,
        reflectivity: 0.36,
        clearcoat: 0.16,
        clearcoatRoughness: 0.22,
        specularIntensity: 0.36,
        envMapIntensity: 0.36,
      }),
    []
  );

  // Precision Rear, Oven/Chiller Detailing & Tasting Table Geometries
  const mixerBowlGeo = useMemo(() => ensureSecondaryUv(createGlassVesselGeometry(0.138, 0.092, 0.20, 0.004)), []);
  const mixerBaseGeo = useMemo(() => ensureSecondaryUv(createBeveledBoxGeometry(0.26, 0.05, 0.36, 0.024, 0.005, 0.005, 3)), []);
  const mixerCounterTopGeo = useMemo(() => ensureSecondaryUv(createBeveledBoxGeometry(1.28, 0.03, 0.82, 0.016, 0.004, 0.004, 2)), []);
  const mixerWhipWiresGeo = useMemo(() => createWireWhiskWiresGeometry(5, 0.14, 0.044), []);
  const apothecaryJarGeo = useMemo(() => createGlassVesselGeometry(0.056, 0.054, 0.145, 0.004), []);
  const apothecaryLidGeo = useMemo(() => createApothecaryLidGeometry(0.058), []);
  const ovenFrontBezelGeo = useMemo(() => ensureSecondaryUv(createBeveledFrameGeometry(1.36, 0.47, 0.055, 0.024, 0.004)), []);
  const ovenDoorBevelFrameGeo = useMemo(() => ensureSecondaryUv(createBeveledFrameGeometry(1.24, 0.45, 0.056, 0.036, 0.004)), []);
  const ovenGasketGeo = useMemo(() => ensureSecondaryUv(createBeveledFrameGeometry(1.18, 0.41, 0.020, 0.016, 0.002)), []);
  const gueridonPedGeo = useMemo(() => createGueridonPedestalGeometry(), []);
  const tastingMarbleTopGeo = useMemo(() => ensureSecondaryUv(createBeveledMarbleTabletopGeometry(0.76, 0.036)), []);
  const tastingNapkinGeo = useMemo(() => createFoldedLinenNapkinGeometry(0.21, 0.15, 0.0054), []);
  const ovenRingGeo = useMemo(() => ensureSecondaryUv(createMousseRingGeometry(0.245, 0.070, 0.0028, 72)), []);
  const crystalKnifeRestGeo = useMemo(() => createBeveledBoxGeometry(0.018, 0.014, 0.052, 0.004, 0.003, 0.003, 2), []);
  const silverKnifeBladeGeo = useMemo(() => ensureSecondaryUv(createSilverCakeKnifeBladeGeometry()), []);
  const silverKnifeHandleGeo = useMemo(() => createSilverKnifeHandleGeometry(), []);
  const espressoCupGeo = useMemo(() => createEspressoCupGeometry(), []);
  const espressoSaucerGeo = useMemo(() => createEspressoSaucerGeometry(), []);
  const espressoHandleGeo = useMemo(() => createCupEarHandleGeometry(), []);

  // Iteration 1 Red-Team Hardened Beveled Hearth, Pleated Curtain & Lathe Workbench Assets (100% disposed!)
  const hearthCraft = useMemo(() => {
    const elmPbr = createWoodGrainPbr('#87532C', '#522E14', 601);
    const oakPbr = createWoodGrainPbr('#B27A48', '#764822', 602);
    const enamelMicro = createMicroSurfaceMaps(0.36, 0.07, false, 603);
    const journalLinen = createWovenFabricPbr('#769062', '#526B44', 604);
    const knobDialTexs = [
      createOvenKnobDialTexture('temp'),
      createOvenKnobDialTexture('timer'),
      createOvenKnobDialTexture('mode'),
    ];
    const knobPointerGeo = createBeveledBoxGeometry(0.005, 0.018, 0.006, 0.001, 0.0005, 0.0005, 1);

    const wbLegGeo = createTurnedBalusterLegGeo(0.90, 0.034);
    const wbLowerGeo = createBeveledBoxGeometry(1.18, 0.028, 0.66, 0.016, 0.005, 0.005, 2);
    const pleatedCurtainGeo = createPleatedClothCurtainGeo(1.14, 0.64, 11, 0.022);
    const porcelainPitcherGeo = createHollowVesselLatheGeo(0.056, 0.062, 0.044, 0.155, 0.005, 64);
    const utensilCrockGeo = createHollowVesselLatheGeo(0.050, 0.058, 0.055, 0.152, 0.006, 64);
    const breadboxBaseGeo = createBeveledBoxGeometry(0.32, 0.14, 0.22, 0.024, 0.008, 0.008, 3);
    // Sculpted bark-ridged split firewood log (organic bark relief — NOT a smooth cylinder!)
    const birchLogGeo = new THREE.CylinderGeometry(0.058, 0.066, 0.68, 24, 6);
    {
      const lPos = birchLogGeo.attributes.position;
      for (let i = 0; i < lPos.count; i++) {
        const vx = lPos.getX(i);
        const vy = lPos.getY(i);
        const vz = lPos.getZ(i);
        const r = Math.hypot(vx, vz);
        if (r > 0.01) {
          const ang = Math.atan2(vz, vx);
          const barkRidge = 1.0 + 0.055 * Math.sin(ang * 7.0 + vy * 8.0) + 0.032 * Math.cos(ang * 13.0 - vy * 5.0);
          lPos.setXYZ(i, vx * barkRidge, vy, vz * barkRidge);
        }
      }
      birchLogGeo.computeVertexNormals();
    }
    const quoinStoneGeo = createBeveledBoxGeometry(0.24, 0.14, 0.12, 0.024, 0.016, 0.016, 3);
    const breadPeelBladeGeo = createBeveledBoxGeometry(0.26, 0.32, 0.018, 0.045, 0.005, 0.005, 3);
    const ovenControlBarGeo = createBeveledBoxGeometry(1.18, 0.15, 0.022, 0.018, 0.005, 0.005, 2);
    const hearthArchitraveGeo = createBeveledFrameGeometry(1.48, 0.78, 0.095, 0.044, 0.008);
    const hingeBracketGeo = createBeveledBoxGeometry(0.034, 0.044, 0.020, 0.004, 0.002, 0.002, 2);
    const ovenRailGeo = createBeveledBoxGeometry(0.018, 0.016, 0.48, 0.003, 0.002, 0.002, 1);
    const rivetGeo = new THREE.SphereGeometry(0.007, 10, 8);
    const limestoneSurroundMat = new THREE.MeshStandardMaterial({
      map: craftAssets.rubbleStone.map,
      normalMap: craftAssets.rubbleStone.normalMap,
      normalScale: new THREE.Vector2(0.10, 0.10),
      color: '#EAE0CE',
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.18,
    });
    const ovenEnamelMat = new THREE.MeshStandardMaterial({
      color: '#F4EBDA',
      roughness: 0.56,
      metalness: 0.08,
      envMapIntensity: 0.30,
    });
    const agedBronzeHardwareMat = new THREE.MeshStandardMaterial({
      color: '#3D2B1F',
      roughness: 0.52,
      metalness: 0.36,
      envMapIntensity: 0.30,
    });

    // A-Frame Ladder Rack Beveled Posts, Shelves & Hollow Lathe Basket/Pots (64-seg smooth!)
    const rackLegGeo = createBeveledBoxGeometry(0.038, 2.08, 0.042, 0.008, 0.004, 0.004, 2);
    const rackShelfGeos = [0.34, 0.30, 0.26, 0.22].map((d) =>
      createBeveledBoxGeometry(0.98, 0.026, d, 0.012, 0.004, 0.004, 2)
    );
    const rackBasketGeo = createHollowVesselLatheGeo(0.155, 0.195, 0.20, 0.20, 0.012, 64);
    const herbPotGeo = createHollowVesselLatheGeo(0.050, 0.066, 0.068, 0.13, 0.006, 64);
    const spiceFillGeo = new THREE.CylinderGeometry(0.047, 0.047, 0.105, 32);

    // Tasting Table High-Craft Hollow Teapot, Curved Spout, Glass Bud Vase & Beveled Journal!
    const teapotBodyGeo = createBelliedKettleBodyGeo(0.078, 0.128);
    const teapotSpoutCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.066, 0.048, 0),
      new THREE.Vector3(0.104, 0.072, 0),
      new THREE.Vector3(0.124, 0.114, 0),
    ]);
    const teapotSpoutGeo = new THREE.TubeGeometry(teapotSpoutCurve, 22, 0.009, 16, false);
    const budVaseGeo = createHollowVesselLatheGeo(0.032, 0.036, 0.018, 0.138, 0.003, 64);
    const journalPagesGeo = createBeveledBoxGeometry(0.194, 0.015, 0.258, 0.006, 0.002, 0.002, 2);
    const journalCoverGeo = createBeveledBoxGeometry(0.204, 0.004, 0.272, 0.008, 0.0015, 0.0015, 2);
    const journalLinenMat = new THREE.MeshStandardMaterial({
      map: journalLinen.map,
      bumpMap: journalLinen.bumpMap,
      bumpScale: 0.004,
      roughnessMap: journalLinen.roughnessMap,
      roughness: 1.0,
    });
    const terracottaMat = new THREE.MeshStandardMaterial({
      map: craftAssets.glazedPottery.map,
      normalMap: craftAssets.glazedPottery.normalMap,
      color: '#CC7E58',
      roughness: 0.80,
    });
    const wovenRattanMat = new THREE.MeshPhysicalMaterial({
      map: craftAssets.wovenRattan.map,
      normalMap: craftAssets.wovenRattan.normalMap,
      normalScale: new THREE.Vector2(1.42, 1.42),
      roughnessMap: craftAssets.wovenRattan.roughnessMap,
      roughness: 1.0,
      sheen: 0.30,
      sheenColor: '#F4DCB0',
      sheenRoughness: 0.68,
      side: THREE.DoubleSide,
    });
    const stonewareTeaMat = enhanceWithStylizedFresnelRim(
      new THREE.MeshPhysicalMaterial({
        map: craftAssets.floralCeramicTex,
        color: '#FCF7ED',
        roughness: 0.46,
        clearcoat: 0.16,
        clearcoatRoughness: 0.32,
        envMapIntensity: 0.38,
      }),
      { rimColor: '#FFE4B0', rimStrength: 0.32, rimPower: 2.6, topBias: 0.44, cacheTag: 'tasting-tea-stoneware' }
    );

    // Beveled Hewn-Stone Hearth Blocks & Reclaimed Elm Mantel (ZERO sharp 90° raw boxes!)
    const hearthBaseGeo = createBeveledBoxGeometry(1.54, 0.12, 0.96, 0.028, 0.012, 0.012, 3);
    const hearthPierGeo = createBeveledBoxGeometry(0.38, 0.88, 0.90, 0.024, 0.010, 0.010, 3);
    const hearthShelfGeo = createBeveledBoxGeometry(1.56, 0.075, 0.98, 0.024, 0.010, 0.010, 3);
    const hearthUpperGeo = createBeveledBoxGeometry(1.44, 0.42, 0.90, 0.024, 0.010, 0.010, 3);
    const elmMantelGeo = createBeveledBoxGeometry(1.66, 0.105, 1.00, 0.026, 0.014, 0.014, 4);

    // Organic Curved Mantel Garland Vine + Shared Foliage/Blossom Geometries
    const garlandCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.70, 0.01, 0.02),
      new THREE.Vector3(-0.36, 0.03, 0.05),
      new THREE.Vector3(0.0, 0.015, 0.04),
      new THREE.Vector3(0.38, 0.032, 0.05),
      new THREE.Vector3(0.70, 0.01, 0.02),
    ]);
    const garlandVineGeo = new THREE.TubeGeometry(garlandCurve, 28, 0.009, 8, false);
    const garlandSamples = [0.06, 0.17, 0.29, 0.41, 0.54, 0.67, 0.80, 0.93].map((t) => garlandCurve.getPointAt(t));
    const sprigGeo = new THREE.ConeGeometry(0.022, 0.105, 8);
    const blossomGeo = new THREE.SphereGeometry(0.014, 10, 8);

    const elmWoodMat = new THREE.MeshStandardMaterial({
      map: elmPbr.map,
      bumpMap: elmPbr.bumpMap,
      bumpScale: 0.006,
      roughnessMap: elmPbr.roughnessMap,
      roughness: 1.0,
      envMapIntensity: 0.34,
    });
    const oakWoodMat = new THREE.MeshStandardMaterial({
      map: oakPbr.map,
      bumpMap: oakPbr.bumpMap,
      bumpScale: 0.005,
      roughnessMap: oakPbr.roughnessMap,
      roughness: 1.0,
      envMapIntensity: 0.34,
    });
    const creamEnamelMat = enhanceWithStylizedFresnelRim(
      new THREE.MeshPhysicalMaterial({
        color: '#F8EFE0',
        roughness: 1.0,
        roughnessMap: enamelMicro.roughnessMap,
        bumpMap: enamelMicro.bumpMap,
        bumpScale: 0.0018,
        clearcoat: 0.18,
        clearcoatRoughness: 0.30,
        envMapIntensity: 0.38,
      }),
      { rimColor: '#FFE4B0', rimStrength: 0.30, rimPower: 2.7, topBias: 0.42, cacheTag: 'hearth-cream-enamel' }
    );
    const butterYellowMat = new THREE.MeshPhysicalMaterial({
      color: '#F0C860',
      roughness: 1.0,
      roughnessMap: enamelMicro.roughnessMap,
      bumpMap: enamelMicro.bumpMap,
      bumpScale: 0.0018,
      clearcoat: 0.18,
      clearcoatRoughness: 0.30,
      envMapIntensity: 0.38,
    });
    const birchLightMat = new THREE.MeshStandardMaterial({
      map: craftAssets.birchBarkTex,
      color: '#DEC9AA',
      roughness: 0.90,
    });
    const birchWarmMat = new THREE.MeshStandardMaterial({
      map: craftAssets.birchBarkTex,
      color: '#AC7E54',
      roughness: 0.90,
    });

    // Procedural Natural Charred Timber & Subtle Ash-Fissure Log-End + Hearth Bed Textures
    const charSize = 256;
    const charColorCanvas = document.createElement('canvas');
    const charEmissiveCanvas = document.createElement('canvas');
    const charBumpCanvas = document.createElement('canvas');
    charColorCanvas.width = charEmissiveCanvas.width = charBumpCanvas.width = charSize;
    charColorCanvas.height = charEmissiveCanvas.height = charBumpCanvas.height = charSize;
    const cc = charColorCanvas.getContext('2d')!;
    const ce = charEmissiveCanvas.getContext('2d')!;
    const cb = charBumpCanvas.getContext('2d')!;
    const cHalf = charSize * 0.5;
    const logGrad = cc.createRadialGradient(cHalf, cHalf, 4, cHalf, cHalf, cHalf);
    logGrad.addColorStop(0.0, '#2E2118');
    logGrad.addColorStop(0.58, '#231912');
    logGrad.addColorStop(0.86, '#18110D');
    logGrad.addColorStop(1.0, '#100B08');
    cc.fillStyle = logGrad;
    cc.fillRect(0, 0, charSize, charSize);
    ce.fillStyle = '#000000';
    ce.fillRect(0, 0, charSize, charSize);
    cb.fillStyle = '#7E7E7E';
    cb.fillRect(0, 0, charSize, charSize);

    let charSeed = 9183;
    const charRand = () => {
      charSeed = (charSeed * 1664525 + 1013904223) >>> 0;
      return charSeed / 4294967296;
    };

    // Subtle organic charcoal tree-growth rings (broken arcs, no harsh uniform target rings)
    for (let r = 10; r < cHalf * 0.90; r += 7) {
      const arcs = 3 + Math.floor(charRand() * 3);
      for (let a = 0; a < arcs; a++) {
        const sAng = charRand() * Math.PI * 2;
        const span = 0.65 + charRand() * 1.45;
        cc.strokeStyle = r > cHalf * 0.72 ? 'rgba(18, 12, 9, 0.72)' : 'rgba(62, 46, 36, 0.40)';
        cc.lineWidth = 1.6 + charRand() * 1.2;
        cc.beginPath();
        cc.arc(cHalf, cHalf, r + (charRand() - 0.5) * 1.5, sAng, sAng + span);
        cc.stroke();
        cb.strokeStyle = 'rgba(148, 148, 148, 0.45)';
        cb.lineWidth = 1.6;
        cb.beginPath();
        cb.arc(cHalf, cHalf, r, sAng, sAng + span);
        cb.stroke();
      }
    }

    // Soft smoked-ash soot mottling across cut grain
    for (let d = 0; d < 64; d++) {
      const ang = charRand() * Math.PI * 2;
      const dist = Math.sqrt(charRand()) * (cHalf * 0.88);
      const rad = 5 + charRand() * 13;
      cc.fillStyle = d % 3 === 0 ? 'rgba(98, 88, 80, 0.16)' : 'rgba(14, 10, 8, 0.24)';
      cc.beginPath();
      cc.arc(cHalf + Math.cos(ang) * dist, cHalf + Math.sin(ang) * dist, rad, 0, Math.PI * 2);
      cc.fill();
    }

    // Natural short charcoal bark fissures (dark carbonized cracks; restrained tiny ember pockets only)
    for (let k = 0; k < 28; k++) {
      const baseAngle = (k / 28) * Math.PI * 2 + (charRand() - 0.5) * 0.30;
      const startR = cHalf * (0.14 + charRand() * 0.42);
      const endR = Math.min(cHalf * 0.90, startR + cHalf * (0.14 + charRand() * 0.28));
      const midR = (startR + endR) * 0.5;
      const midA = baseAngle + (charRand() - 0.5) * 0.22;
      const endA = baseAngle + (charRand() - 0.5) * 0.28;
      cc.strokeStyle = k % 4 === 0 ? '#321D12' : '#0E0A07';
      cc.lineWidth = 1.6 + charRand() * 1.4;
      cc.lineCap = 'round';
      cc.beginPath();
      cc.moveTo(cHalf + Math.cos(baseAngle) * startR, cHalf + Math.sin(baseAngle) * startR);
      cc.lineTo(cHalf + Math.cos(midA) * midR, cHalf + Math.sin(midA) * midR);
      cc.lineTo(cHalf + Math.cos(endA) * endR, cHalf + Math.sin(endA) * endR);
      cc.stroke();

      cb.strokeStyle = '#242424';
      cb.lineWidth = 2.6;
      cb.lineCap = 'round';
      cb.beginPath();
      cb.moveTo(cHalf + Math.cos(baseAngle) * startR, cHalf + Math.sin(baseAngle) * startR);
      cb.lineTo(cHalf + Math.cos(midA) * midR, cHalf + Math.sin(midA) * midR);
      cb.lineTo(cHalf + Math.cos(endA) * endR, cHalf + Math.sin(endA) * endR);
      cb.stroke();

      // Restrained deep-ember glow inside select inner heat cracks (avoid bright radial pie spokes)
      if (k % 3 === 0 && startR < cHalf * 0.52) {
        ce.strokeStyle = k % 6 === 0 ? 'rgba(224, 106, 34, 0.72)' : 'rgba(176, 62, 16, 0.55)';
        ce.lineWidth = 1.4;
        ce.lineCap = 'round';
        ce.beginPath();
        ce.moveTo(cHalf + Math.cos(baseAngle) * startR, cHalf + Math.sin(baseAngle) * startR);
        ce.lineTo(cHalf + Math.cos(midA) * midR, cHalf + Math.sin(midA) * midR);
        ce.stroke();
      }
    }

    // Scattered tiny smoldering pinpoints & warm charcoal edge ring
    for (let sp = 0; sp < 18; sp++) {
      const ang = charRand() * Math.PI * 2;
      const dist = cHalf * (0.12 + charRand() * 0.58);
      ce.fillStyle = sp % 2 === 0 ? 'rgba(232, 112, 34, 0.78)' : 'rgba(168, 56, 14, 0.60)';
      ce.beginPath();
      ce.arc(cHalf + Math.cos(ang) * dist, cHalf + Math.sin(ang) * dist, 1.1 + charRand() * 1.4, 0, Math.PI * 2);
      ce.fill();
    }
    cc.strokeStyle = '#110B08';
    cc.lineWidth = 18;
    cc.beginPath();
    cc.arc(cHalf, cHalf, cHalf - 6, 0, Math.PI * 2);
    cc.stroke();
    ce.strokeStyle = '#000000';
    ce.lineWidth = 24;
    ce.beginPath();
    ce.arc(cHalf, cHalf, cHalf - 6, 0, Math.PI * 2);
    ce.stroke();

    const charredEndMap = new THREE.CanvasTexture(charColorCanvas);
    charredEndMap.colorSpace = THREE.SRGBColorSpace;
    const charredEndEmissiveMap = new THREE.CanvasTexture(charEmissiveCanvas);
    charredEndEmissiveMap.colorSpace = THREE.SRGBColorSpace;
    const charredEndBumpMap = new THREE.CanvasTexture(charBumpCanvas);

    const charredLogEndMat = new THREE.MeshStandardMaterial({
      map: charredEndMap,
      emissiveMap: charredEndEmissiveMap,
      emissive: '#F2641E',
      emissiveIntensity: 0.42,
      bumpMap: charredEndBumpMap,
      bumpScale: 0.008,
      roughness: 0.96,
    });
    const coalBedColorTex = charredEndMap.clone();
    coalBedColorTex.wrapS = coalBedColorTex.wrapT = THREE.RepeatWrapping;
    coalBedColorTex.repeat.set(2.2, 2.2);
    coalBedColorTex.needsUpdate = true;
    const coalBedEmissiveTex = charredEndEmissiveMap.clone();
    coalBedEmissiveTex.wrapS = coalBedEmissiveTex.wrapT = THREE.RepeatWrapping;
    coalBedEmissiveTex.repeat.set(2.2, 2.2);
    coalBedEmissiveTex.needsUpdate = true;
    const coalBedBumpTex = charredEndBumpMap.clone();
    coalBedBumpTex.wrapS = coalBedBumpTex.wrapT = THREE.RepeatWrapping;
    coalBedBumpTex.repeat.set(2.2, 2.2);
    coalBedBumpTex.needsUpdate = true;
    const coalBedMat = new THREE.MeshStandardMaterial({
      map: coalBedColorTex,
      emissiveMap: coalBedEmissiveTex,
      emissive: '#FF6A1E',
      emissiveIntensity: 1.15,
      bumpMap: coalBedBumpTex,
      bumpScale: 0.012,
      roughness: 0.96,
    });
    const birchLogLightMats = [birchLightMat, charredLogEndMat, charredLogEndMat];
    const birchLogWarmMats = [birchWarmMat, charredLogEndMat, charredLogEndMat];
    const garlandLeafA = new THREE.MeshStandardMaterial({ color: '#4B7D36', roughness: 0.72 });
    const garlandLeafB = new THREE.MeshStandardMaterial({ color: '#619446', roughness: 0.70 });
    const garlandLavMat = new THREE.MeshStandardMaterial({ color: '#A088C6', roughness: 0.65 });
    const garlandCreamMat = new THREE.MeshStandardMaterial({ color: '#FFF8E6', roughness: 0.58 });
    const vineWoodMat = new THREE.MeshStandardMaterial({ color: '#66492D', roughness: 0.88 });

    // Round 4B High-Craft Tasting Table Teapot Lid, Celadon Glaze, Radial Tea Surface, Journal Emblem & Sculpted Vase Bouquet!
    const teapotLidPts = [
      new THREE.Vector2(0.0001, 0.018),
      new THREE.Vector2(0.018, 0.0175),
      new THREE.Vector2(0.036, 0.012),
      new THREE.Vector2(0.048, 0.005),
      new THREE.Vector2(0.050, 0.001),
      new THREE.Vector2(0.045, 0.0),
      new THREE.Vector2(0.041, -0.005),
      new THREE.Vector2(0.0001, -0.005),
    ];
    const teapotLidGeo = createSeamlessLatheGeometry(teapotLidPts, 48);

    const celadonGlazeMat = enhanceWithStylizedFresnelRim(
      new THREE.MeshPhysicalMaterial({
        map: craftAssets.stonewareTex,
        color: '#88A47E',
        bumpMap: enamelMicro.bumpMap,
        bumpScale: 0.0016,
        roughnessMap: enamelMicro.roughnessMap,
        roughness: 1.0,
        clearcoat: 0.16,
        clearcoatRoughness: 0.30,
        envMapIntensity: 0.38,
      }),
      { rimColor: '#FFE8BC', rimStrength: 0.36, rimPower: 2.5, topBias: 0.44, cacheTag: 'tasting-celadon' }
    );

    const teaCanvas = document.createElement('canvas');
    teaCanvas.width = 128;
    teaCanvas.height = 128;
    const teaCtx = teaCanvas.getContext('2d')!;
    const teaGrad = teaCtx.createRadialGradient(64, 64, 4, 64, 64, 62);
    teaGrad.addColorStop(0.0, '#AD6A14');
    teaGrad.addColorStop(0.58, '#CE8822');
    teaGrad.addColorStop(0.86, '#E8AE42');
    teaGrad.addColorStop(1.0, '#F6D178');
    teaCtx.fillStyle = teaGrad;
    teaCtx.fillRect(0, 0, 128, 128);
    const teaSurfaceTex = new THREE.CanvasTexture(teaCanvas);
    teaSurfaceTex.colorSpace = THREE.SRGBColorSpace;
    const teaLiquidMat = new THREE.MeshPhysicalMaterial({
      map: teaSurfaceTex,
      roughness: 0.18,
      clearcoat: 0.25,
      clearcoatRoughness: 0.16,
      ior: 1.34,
      envMapIntensity: 0.48,
    });

    // Sculpted vase bouquet shared geometries & materials (ZERO inline .map() allocations!)
    const vaseStemGeo = new THREE.CylinderGeometry(0.0022, 0.0026, 0.125, 12);
    const vasePetalShape = new THREE.Shape();
    vasePetalShape.moveTo(0, 0);
    vasePetalShape.bezierCurveTo(0.0055, 0.003, 0.0075, 0.012, 0.0035, 0.019);
    vasePetalShape.bezierCurveTo(0.0012, 0.021, -0.0012, 0.021, -0.0035, 0.019);
    vasePetalShape.bezierCurveTo(-0.0075, 0.012, -0.0055, 0.003, 0, 0);
    vasePetalShape.closePath();
    const vasePetalGeo = new THREE.ExtrudeGeometry(vasePetalShape, {
      depth: 0.0014,
      bevelEnabled: true,
      bevelThickness: 0.0006,
      bevelSize: 0.0006,
      bevelSegments: 2,
      curveSegments: 8,
    });
    vasePetalGeo.rotateX(-Math.PI * 0.44);
    vasePetalGeo.computeVertexNormals();
    const vaseCenterGeo = new THREE.SphereGeometry(0.0075, 16, 12);
    vaseCenterGeo.scale(1.0, 0.62, 1.0);
    const vaseStemMat = new THREE.MeshStandardMaterial({ color: '#4E7D36', roughness: 0.72 });
    const vaseWhitePetalMat = new THREE.MeshPhysicalMaterial({
      color: '#FFFDF5',
      roughness: 0.46,
      sheen: 0.48,
      sheenColor: '#FFFFFF',
    });
    const vaseRosePetalMat = new THREE.MeshPhysicalMaterial({
      color: '#F2A4B6',
      roughness: 0.44,
      sheen: 0.52,
      sheenColor: '#FFE0E8',
    });
    const vaseGoldCenterMat = new THREE.MeshStandardMaterial({ color: '#E8B838', roughness: 0.55 });
    const vaseRoseCenterMat = new THREE.MeshStandardMaterial({ color: '#DE748C', roughness: 0.48 });
    const journalMedallionGeo = createBeveledBoxGeometry(0.048, 0.0028, 0.064, 0.008, 0.001, 0.001, 2);

    return {
      elmPbr,
      oakPbr,
      enamelMicro,
      journalLinen,
      wbLegGeo,
      wbLowerGeo,
      pleatedCurtainGeo,
      porcelainPitcherGeo,
      utensilCrockGeo,
      breadboxBaseGeo,
      birchLogGeo,
      quoinStoneGeo,
      breadPeelBladeGeo,
      ovenControlBarGeo,
      hearthArchitraveGeo,
      hingeBracketGeo,
      ovenRailGeo,
      rivetGeo,
      limestoneSurroundMat,
      ovenEnamelMat,
      agedBronzeHardwareMat,
      rackLegGeo,
      rackShelfGeos,
      rackBasketGeo,
      herbPotGeo,
      spiceFillGeo,
      teapotBodyGeo,
      teapotLidGeo,
      teapotSpoutGeo,
      budVaseGeo,
      journalPagesGeo,
      journalCoverGeo,
      journalMedallionGeo,
      journalLinenMat,
      terracottaMat,
      wovenRattanMat,
      stonewareTeaMat,
      celadonGlazeMat,
      teaSurfaceTex,
      teaLiquidMat,
      vaseStemGeo,
      vasePetalGeo,
      vaseCenterGeo,
      vaseStemMat,
      vaseWhitePetalMat,
      vaseRosePetalMat,
      vaseGoldCenterMat,
      vaseRoseCenterMat,
      hearthBaseGeo,
      hearthPierGeo,
      hearthShelfGeo,
      hearthUpperGeo,
      elmMantelGeo,
      garlandVineGeo,
      garlandSamples,
      sprigGeo,
      blossomGeo,
      elmWoodMat,
      oakWoodMat,
      creamEnamelMat,
      butterYellowMat,
      birchLightMat,
      birchWarmMat,
      charredEndMap,
      charredEndEmissiveMap,
      charredEndBumpMap,
      coalBedColorTex,
      coalBedEmissiveTex,
      coalBedBumpTex,
      charredLogEndMat,
      coalBedMat,
      birchLogLightMats,
      birchLogWarmMats,
      garlandLeafA,
      garlandLeafB,
      garlandLavMat,
      garlandCreamMat,
      vineWoodMat,
      knobDialTexs,
      knobPointerGeo,
    };
  }, [craftAssets]);

  useEffect(() => {
    return () => {
      if (document.body.style.cursor === 'pointer') {
        document.body.style.cursor = 'auto';
      }
      hearthCraft.elmPbr.map.dispose();
      hearthCraft.elmPbr.bumpMap.dispose();
      hearthCraft.elmPbr.roughnessMap.dispose();
      hearthCraft.oakPbr.map.dispose();
      hearthCraft.oakPbr.bumpMap.dispose();
      hearthCraft.oakPbr.roughnessMap.dispose();
      hearthCraft.enamelMicro.bumpMap.dispose();
      hearthCraft.enamelMicro.roughnessMap.dispose();
      hearthCraft.journalLinen.map.dispose();
      hearthCraft.journalLinen.bumpMap.dispose();
      hearthCraft.journalLinen.roughnessMap.dispose();
      hearthCraft.wbLegGeo.dispose();
      hearthCraft.wbLowerGeo.dispose();
      hearthCraft.pleatedCurtainGeo.dispose();
      hearthCraft.porcelainPitcherGeo.dispose();
      hearthCraft.utensilCrockGeo.dispose();
      hearthCraft.breadboxBaseGeo.dispose();
      hearthCraft.birchLogGeo.dispose();
      hearthCraft.breadPeelBladeGeo.dispose();
      hearthCraft.ovenControlBarGeo.dispose();
      hearthCraft.hearthArchitraveGeo.dispose();
      hearthCraft.hingeBracketGeo.dispose();
      hearthCraft.ovenRailGeo.dispose();
      hearthCraft.rivetGeo.dispose();
      hearthCraft.limestoneSurroundMat.dispose();
      hearthCraft.ovenEnamelMat.dispose();
      hearthCraft.agedBronzeHardwareMat.dispose();
      hearthCraft.rackLegGeo.dispose();
      hearthCraft.rackShelfGeos.forEach((g) => g.dispose());
      hearthCraft.rackBasketGeo.dispose();
      hearthCraft.herbPotGeo.dispose();
      hearthCraft.spiceFillGeo.dispose();
      hearthCraft.teapotBodyGeo.dispose();
      hearthCraft.teapotLidGeo.dispose();
      hearthCraft.teapotSpoutGeo.dispose();
      hearthCraft.budVaseGeo.dispose();
      hearthCraft.journalPagesGeo.dispose();
      hearthCraft.journalCoverGeo.dispose();
      hearthCraft.journalMedallionGeo.dispose();
      hearthCraft.journalLinenMat.dispose();
      hearthCraft.terracottaMat.dispose();
      hearthCraft.wovenRattanMat.dispose();
      hearthCraft.stonewareTeaMat.dispose();
      hearthCraft.celadonGlazeMat.dispose();
      hearthCraft.teaSurfaceTex.dispose();
      hearthCraft.teaLiquidMat.dispose();
      hearthCraft.vaseStemGeo.dispose();
      hearthCraft.vasePetalGeo.dispose();
      hearthCraft.vaseCenterGeo.dispose();
      hearthCraft.vaseStemMat.dispose();
      hearthCraft.vaseWhitePetalMat.dispose();
      hearthCraft.vaseRosePetalMat.dispose();
      hearthCraft.vaseGoldCenterMat.dispose();
      hearthCraft.vaseRoseCenterMat.dispose();
      hearthCraft.hearthBaseGeo.dispose();
      hearthCraft.hearthPierGeo.dispose();
      hearthCraft.hearthShelfGeo.dispose();
      hearthCraft.hearthUpperGeo.dispose();
      hearthCraft.quoinStoneGeo.dispose();
      hearthCraft.elmMantelGeo.dispose();
      hearthCraft.garlandVineGeo.dispose();
      hearthCraft.sprigGeo.dispose();
      hearthCraft.blossomGeo.dispose();
      hearthCraft.elmWoodMat.dispose();
      hearthCraft.oakWoodMat.dispose();
      hearthCraft.creamEnamelMat.dispose();
      hearthCraft.butterYellowMat.dispose();
      hearthCraft.birchLightMat.dispose();
      hearthCraft.birchWarmMat.dispose();
      hearthCraft.charredEndMap.dispose();
      hearthCraft.charredEndEmissiveMap.dispose();
      hearthCraft.charredEndBumpMap.dispose();
      hearthCraft.coalBedColorTex.dispose();
      hearthCraft.coalBedEmissiveTex.dispose();
      hearthCraft.coalBedBumpTex.dispose();
      hearthCraft.charredLogEndMat.dispose();
      hearthCraft.coalBedMat.dispose();
      hearthCraft.garlandLeafA.dispose();
      hearthCraft.garlandLeafB.dispose();
      hearthCraft.garlandLavMat.dispose();
      hearthCraft.garlandCreamMat.dispose();
      hearthCraft.vineWoodMat.dispose();
      hearthCraft.knobDialTexs.forEach((t) => t.dispose());
      hearthCraft.knobPointerGeo.dispose();
    };
  }, [hearthCraft]);

  // Low-frequency store selectors; high-frequency animation fields are polled via getState() inside useFrame
  const currentStep = useGameStore((s) => s.currentStep);
  const selectedFlavor = useGameStore((s) => s.selectedFlavor);
  const isBaking = useGameStore((s) => s.isBaking);
  const isChilling = useGameStore((s) => s.isChilling);
  const mechanics = useGameStore((s) => (s as unknown as OptionalMechanicsSlice).mechanics);

  const flavor = useMemo(() => ENTREMET_FLAVOR_PRESETS[resolveFlavorId(selectedFlavor)], [selectedFlavor]);

  const [fridgePeekOpen, setFridgePeekOpen] = useState(false);
  const [radioPlaying, setRadioPlaying] = useState(false);

  const isOvenLit = currentStep === 2 || isBaking || Boolean(mechanics?.ovenActive);
  const isChillerOpen = currentStep === 3 || isChilling || Boolean(mechanics?.chillerDoorOpen) || fridgePeekOpen;

  const ovenGaugeTex = useMemo(() => createOvenGaugeTexture(useGameStore.getState().ovenSetTemp), []);
  const cryoMistTex = useMemo(() => createSoftMistSpriteTexture(), []);

  const cryoParticlesGeo = useMemo(() => {
    const count = 180;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 0.78;
      positions[i * 3 + 1] = 0.25 + Math.random() * 1.15;
      positions[i * 3 + 2] = 0.28 + Math.random() * 0.85;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);

  const spiceJars = useMemo(() => {
    const spiceColors = [
      '#C81D3B',
      '#7C9A46',
      '#E6A825',
      '#4A2B1D',
      '#4B7034',
      '#F5EFE2',
      '#D97A2B',
      '#8E4B62',
    ];
    const list: Array<{ x: number; y: number; color: string }> = [];
    const shelfYs = [0.88, 1.38];
    shelfYs.forEach((sy, rIdx) => {
      for (let c = 0; c < 5; c++) {
        list.push({
          x: -0.34 + c * 0.17,
          y: sy,
          color: spiceColors[(rIdx * 5 + c) % spiceColors.length],
        });
      }
    });
    return list;
  }, []);

  useEffect(() => {
    return () => {
      ovenGaugeTex.dispose();
      cryoMistTex.dispose();
      cryoParticlesGeo.dispose();
      cryoMistMat.dispose();
      copperMat.dispose();
      tinMat.dispose();
      brassMat.dispose();
      ironMat.dispose();
      stainlessMat.dispose();
      epdmGasketMat.dispose();
      rosewoodMat.dispose();
      walnutMat.dispose();
      toolPbrAssets.brassMicro.bumpMap.dispose();
      toolPbrAssets.brassMicro.roughnessMap.dispose();
      toolPbrAssets.rosewoodPbr.map.dispose();
      toolPbrAssets.rosewoodPbr.bumpMap.dispose();
      toolPbrAssets.rosewoodPbr.roughnessMap.dispose();
      toolPbrAssets.walnutPbr.map.dispose();
      toolPbrAssets.walnutPbr.bumpMap.dispose();
      toolPbrAssets.walnutPbr.roughnessMap.dispose();
      crystalGlassMat.dispose();
      hearthRubbleMat.dispose();
      hearthFlameMat.dispose();
      ginghamSkirtMat.dispose();
      mixerBowlGeo.dispose();
      mixerBaseGeo.dispose();
      mixerCounterTopGeo.dispose();
      mixerWhipWiresGeo.dispose();
      apothecaryJarGeo.dispose();
      apothecaryLidGeo.dispose();
      ovenFrontBezelGeo.dispose();
      ovenDoorBevelFrameGeo.dispose();
      ovenGasketGeo.dispose();
      gueridonPedGeo.dispose();
      tastingMarbleTopGeo.dispose();
      tastingNapkinGeo.dispose();
      ovenRingGeo.dispose();
      crystalKnifeRestGeo.dispose();
      silverKnifeBladeGeo.dispose();
      silverKnifeHandleGeo.dispose();
      espressoCupGeo.dispose();
      espressoSaucerGeo.dispose();
      espressoHandleGeo.dispose();
    };
  }, [
    ovenGaugeTex,
    cryoMistTex,
    cryoParticlesGeo,
    cryoMistMat,
    copperMat,
    tinMat,
    brassMat,
    ironMat,
    stainlessMat,
    epdmGasketMat,
    rosewoodMat,
    walnutMat,
    toolPbrAssets,
    crystalGlassMat,
    hearthRubbleMat,
    hearthFlameMat,
    ginghamSkirtMat,
    mixerBowlGeo,
    mixerBaseGeo,
    mixerCounterTopGeo,
    mixerWhipWiresGeo,
    apothecaryJarGeo,
    apothecaryLidGeo,
    ovenFrontBezelGeo,
    ovenDoorBevelFrameGeo,
    ovenGasketGeo,
    gueridonPedGeo,
    tastingMarbleTopGeo,
    tastingNapkinGeo,
    ovenRingGeo,
    crystalKnifeRestGeo,
    silverKnifeBladeGeo,
    silverKnifeHandleGeo,
    espressoCupGeo,
    espressoSaucerGeo,
    espressoHandleGeo,
  ]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();
    const state = useGameStore.getState();

    cryoMistMat.uniforms.uTime.value = t;
    hearthFlameMat.uniforms.uTime.value = t;
    if (hearthFireLightRef.current) {
      // Natural crackling wood-fire flicker (warm amber glow spilling onto herringbone floor & logs!)
      hearthFireLightRef.current.intensity =
        2.35 + Math.sin(t * 9.2) * 0.34 + Math.cos(t * 15.7) * 0.22 + Math.sin(t * 23.1) * 0.12;
    }
    cryoMistMat.uniforms.uOpacity.value = isChillerOpen
      ? THREE.MathUtils.lerp(cryoMistMat.uniforms.uOpacity.value, 0.20, dt * 4)
      : 0.0;

    if (mixerWhipRef.current) {
      mixerWhipRef.current.rotation.y += dt * 4.5;
    }

    if (chillerDoorRef.current) {
      const targetAngle = isChillerOpen ? -1.42 : 0.0;
      chillerDoorRef.current.rotation.y = THREE.MathUtils.lerp(
        chillerDoorRef.current.rotation.y,
        targetAngle,
        dt * 3.8
      );
    }

    if (mistParticlesRef.current && isChillerOpen) {
      const posAttr = mistParticlesRef.current.geometry.attributes.position as THREE.BufferAttribute;
      const speed = 0.42;
      for (let i = 0; i < posAttr.count; i++) {
        let y = posAttr.getY(i) - dt * speed;
        let z = posAttr.getZ(i) + dt * 0.24;
        if (y < 0.05 || z > 1.35) {
          y = 0.85 + Math.random() * 0.65;
          z = 0.25 + Math.random() * 0.25;
        }
        posAttr.setY(i, y);
        posAttr.setZ(i, z);
      }
      posAttr.needsUpdate = true;
    }

    // Pyrometer gauge dial + mechanical temp knob rotation synced with ovenSetTemp (throttled redraw)
    const roundedTemp = Math.round(state.ovenSetTemp);
    if (roundedTemp !== lastOvenTempRef.current) {
      lastOvenTempRef.current = roundedTemp;
      drawOvenGauge(ovenGaugeTex.image as HTMLCanvasElement, roundedTemp);
      ovenGaugeTex.needsUpdate = true;
    }
    if (ovenTempKnobRef.current) {
      const norm = THREE.MathUtils.clamp((state.ovenSetTemp - 140) / 70, 0, 1);
      const targetRot = (0.5 - norm) * 1.4 * Math.PI;
      ovenTempKnobRef.current.rotation.z = THREE.MathUtils.lerp(
        ovenTempKnobRef.current.rotation.z,
        targetRot,
        dt * 12
      );
    }
    if (ovenDoorRef.current) {
      const crackedOpen =
        state.currentStep === 2 && !state.isBaking && (state.bakeProgress > 0.12 || state.stepCompleted[2]);
      const targetDoorRot = crackedOpen ? 0.18 : 0.0;
      ovenDoorRef.current.rotation.x = THREE.MathUtils.lerp(
        ovenDoorRef.current.rotation.x,
        targetDoorRot,
        dt * 5.0
      );
    }

    // Direct 60fps sponge oven-spring rise & Maillard browning aligned to warm golden #D99B52 chiffon!
    if (state.selectedFlavor !== lastSpongeFlavorRef.current) {
      lastSpongeFlavorRef.current = state.selectedFlavor;
      const flavorSpec = ENTREMET_FLAVOR_PRESETS[resolveFlavorId(state.selectedFlavor)];
      spongeRawColRef.current.set(flavorSpec.spongeColor).lerp(spongeBlendColRef.current.set('#F2E0BA'), 0.45);
      spongeGoldColRef.current.set(flavorSpec.spongeColor).lerp(spongeBlendColRef.current.set('#D99B52'), 0.72);
    }
    const bp = state.bakeProgress;
    const riseY = 0.35 + Math.min(1.05, bp) * 0.82;
    const puffXZ = 1 + Math.sin(Math.min(1, bp) * Math.PI) * 0.018;
    const springJiggle = state.isBaking ? Math.sin(t * 9.5) * 0.016 * Math.sin(Math.min(1, bp) * Math.PI) : 0;
    if (bp <= 0.92) {
      spongeBlendColRef.current.lerpColors(
        spongeRawColRef.current,
        spongeGoldColRef.current,
        THREE.MathUtils.clamp(bp / 0.92, 0, 1)
      );
    } else {
      spongeBlendColRef.current.lerpColors(
        spongeGoldColRef.current,
        spongeBurntColRef.current,
        THREE.MathUtils.clamp((bp - 0.92) / 0.30, 0, 1)
      );
    }
    if (spongeDiscRef.current) {
      spongeDiscRef.current.position.y = 0.036 * riseY;
      spongeDiscRef.current.scale.set(puffXZ, riseY * (1 + springJiggle), puffXZ);
    }
    if (spongeDomeRef.current) {
      spongeDomeRef.current.visible = bp > 0.25;
      if (bp > 0.25) {
        spongeDomeRef.current.position.y = 0.070 * riseY;
        spongeDomeRef.current.scale.set(
          1.0,
          0.16 * THREE.MathUtils.smoothstep(bp, 0.25, 0.95) * (1 + springJiggle * 2.2),
          1.0
        );
      }
    }
    if (spongeDiscMatRef.current) {
      spongeDiscMatRef.current.color.copy(spongeBlendColRef.current);
    }
    if (spongeDomeMatRef.current) {
      spongeDomeMatRef.current.color.copy(spongeBlendColRef.current);
    }

    // Ceremonial silver knife strike pulse animation (lifts cleanly off stationary crystal rest)
    if (state.knifeStrikePulse > lastKnifePulseRef.current) {
      lastKnifePulseRef.current = state.knifeStrikePulse;
      knifePulseTimerRef.current = 0.75;
    }
    if (silverKnifeGroupRef.current) {
      if (knifePulseTimerRef.current > 0) {
        knifePulseTimerRef.current = Math.max(0, knifePulseTimerRef.current - dt);
        const s = Math.sin((knifePulseTimerRef.current / 0.75) * Math.PI);
        silverKnifeGroupRef.current.position.y = 0.8355 + s * 0.024;
        silverKnifeGroupRef.current.rotation.z = -0.055 + s * 0.10;
      } else {
        silverKnifeGroupRef.current.position.y = 0.8355;
        silverKnifeGroupRef.current.rotation.z = -0.055;
      }
    }
  });

  return (
    <group>
      {/* Overhead Mauviel Copper Rack (Elevated to y = 2.58m) */}
      <OverheadMauvielCopperRack
        copperMat={copperMat}
        tinMat={tinMat}
        brassMat={brassMat}
        stainlessMat={stainlessMat}
        ironMat={ironMat}
      />

      {/* Decluttered Island Surface Equipment */}
      <IslandSurfaceEquipment
        copperMat={copperMat}
        brassMat={brassMat}
        stainlessMat={stainlessMat}
        rosewoodMat={rosewoodMat}
        walnutMat={walnutMat}
        crystalGlassMat={crystalGlassMat}
      />

      {/* ====================================================================
          A. REAR LEFT: BEVELED HONEY-OAK WORKBENCH, 3D PLEATED GINGHAM SKIRT & MIXER
             100% Turned Lathe Legs, Wood-Grain PBR, Pleated 3D Cloth, Shared Materials!
         ==================================================================== */}
      <group position={[-2.62, 0, -2.96]}>
        {[-0.56, 0.56].map((lx, xi) =>
          [-0.34, 0.34].map((lz, zi) => (
            <mesh
              key={`${xi}-${zi}`}
              position={[lx, 0, lz]}
              geometry={hearthCraft.wbLegGeo}
              material={hearthCraft.oakWoodMat}
              castShadow
              receiveShadow
            />
          ))
        )}
        {/* Beveled Lower Stretcher Shelf */}
        <mesh position={[0, 0.23, 0]} geometry={hearthCraft.wbLowerGeo} material={hearthCraft.oakWoodMat} castShadow receiveShadow />
        {/* 3D Pleated Red-and-White Gingham Cloth Curtain Skirt with Real Drape Thickness! */}
        <mesh position={[0, 0.58, 0.372]} geometry={hearthCraft.pleatedCurtainGeo} material={ginghamSkirtMat} castShadow receiveShadow />

        {/* Thick Beveled Wood-Grain Honey-Oak Workbench Slab (top at y = 0.930m — flush with NW extension!) */}
        <mesh position={[0, 0.915, 0]} geometry={mixerCounterTopGeo} material={hearthCraft.oakWoodMat} receiveShadow castShadow />

        {/* Charming Butter-Yellow & Cream Vintage Stand Mixer (shared PBR enamel materials!) */}
        <group position={[-0.32, 0.93, 0.04]} rotation={[0, 0.14, 0]}>
          <mesh position={[0, 0.025, 0]} geometry={mixerBaseGeo} material={hearthCraft.creamEnamelMat} castShadow />
          <mesh position={[0, 0.22, -0.11]} material={hearthCraft.creamEnamelMat} castShadow>
            <cylinderGeometry args={[0.075, 0.095, 0.36, 26]} />
          </mesh>
          <mesh position={[0, 0.39, -0.01]} rotation={[Math.PI / 2, 0, 0]} material={hearthCraft.butterYellowMat} castShadow>
            <capsuleGeometry args={[0.088, 0.22, 14, 24]} />
          </mesh>
          <mesh position={[0, 0.39, 0.02]} rotation={[Math.PI / 2, 0, 0]} material={brassMat}>
            <cylinderGeometry args={[0.091, 0.091, 0.03, 28]} />
          </mesh>
          <mesh position={[0.094, 0.39, -0.02]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.010, 0.010, 0.03, 14]} />
            <meshStandardMaterial color="#2A241E" roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.04, 0.07]} geometry={mixerBowlGeo} material={stainlessMat} castShadow />
          <group ref={mixerWhipRef} position={[0, 0.26, 0.07]}>
            <mesh position={[0, 0.03, 0]} material={stainlessMat}>
              <cylinderGeometry args={[0.012, 0.012, 0.06, 12]} />
            </mesh>
            <mesh geometry={mixerWhipWiresGeo} material={stainlessMat} />
          </group>
        </group>

        {/* Hollow Lathe Porcelain Pitcher with Pink Tulips (`29686ab3`!) */}
        <group position={[0.02, 0.93, -0.12]} rotation={[0, -0.15, 0]}>
          <mesh geometry={hearthCraft.porcelainPitcherGeo} material={hearthCraft.creamEnamelMat} castShadow />
          <mesh position={[0.058, 0.09, 0]} material={hearthCraft.creamEnamelMat}>
            <torusGeometry args={[0.034, 0.007, 10, 20, Math.PI]} />
          </mesh>
          {[-0.024, 0.0, 0.024].map((tx, ti) => (
            <group key={ti} position={[tx, 0.16, (ti - 1) * 0.015]} rotation={[0.14 * (ti - 1), ti * 0.6, -0.18 * (ti - 1)]}>
              <mesh>
                <cylinderGeometry args={[0.0035, 0.004, 0.14, 8]} />
                <meshStandardMaterial color="#55883E" roughness={0.76} />
              </mesh>
              <mesh position={[0, 0.074, 0]} scale={[0.85, 1.32, 0.85]}>
                <sphereGeometry args={[0.021, 14, 12]} />
                <meshStandardMaterial color={ti === 1 ? '#F6A8B8' : '#EE8298'} roughness={0.44} />
              </mesh>
            </group>
          ))}
        </group>

        {/* Hollow Lathe Ceramic Utensil Crock full of Wooden Spoons */}
        <group position={[0.16, 0.93, -0.22]} rotation={[0, 0.22, 0]}>
          <mesh geometry={hearthCraft.utensilCrockGeo} castShadow>
            <meshStandardMaterial
              map={craftAssets.glazedPottery.map}
              normalMap={craftAssets.glazedPottery.normalMap}
              roughness={0.36}
            />
          </mesh>
          {[-0.018, 0.0, 0.018].map((ux, ui) => (
            <mesh
              key={ui}
              position={[ux, 0.16, (ui - 1) * 0.012]}
              rotation={[0.15 * (ui - 1), ui, -0.18 * (ui - 1)]}
              material={hearthCraft.oakWoodMat}
              castShadow
            >
              <cylinderGeometry args={[0.006, 0.005, 0.22, 10]} />
            </mesh>
          ))}
        </group>

        {/* Butter-Yellow Beveled Roll-Top Retro Breadbox (shared PBR butterYellowMat!) */}
        <group position={[0.38, 0.93, -0.02]} rotation={[0, -0.16, 0]}>
          <mesh position={[0, 0.07, 0]} geometry={hearthCraft.breadboxBaseGeo} material={hearthCraft.butterYellowMat} castShadow />
          <mesh position={[0, 0.14, 0]} rotation={[0, 0, Math.PI / 2]} material={hearthCraft.butterYellowMat} castShadow>
            <cylinderGeometry args={[0.108, 0.108, 0.312, 24, 1, false, 0, Math.PI]} />
          </mesh>
          <mesh position={[0, 0.115, 0.116]} rotation={[0, 0, Math.PI / 2]} material={brassMat}>
            <capsuleGeometry args={[0.008, 0.056, 6, 10]} />
          </mesh>
        </group>
      </group>

      {/* ====================================================================
          B. STEP 2 SCULPTED 3D-RELIEF STONE FIREPLACE HEARTH OVEN WITH LIVE CRACKLING FIRE!
             Protruding Beveled Cobblestone Quoins, Bark-Ridged Split Logs & Dancing GLSL Flames!
         ==================================================================== */}
      <group position={[-1.15, 0, -3.12]}>
        <mesh position={[0, 0.06, 0.02]} geometry={hearthCraft.hearthBaseGeo} material={hearthRubbleMat} castShadow receiveShadow />
        {[-0.55, 0.55].map((px, pi) => (
          <mesh key={pi} position={[px, 0.54, 0.02]} geometry={hearthCraft.hearthPierGeo} material={hearthRubbleMat} castShadow receiveShadow />
        ))}
        {/* Real 3D Protruding Sculpted Beveled Stone Quoin Relief Blocks strictly outside Oven Frame & Hinge Jambs */}
        {[
          [-0.63, 0.22, 0.435, 0.98, 0.92, 0.85], [-0.50, 0.39, 0.44, 0.88, 1.00, 0.90], [-0.61, 0.57, 0.435, 1.00, 0.90, 0.86],
          [-0.51, 0.74, 0.44, 0.92, 0.96, 0.88], [-0.60, 0.87, 0.435, 0.96, 0.76, 0.84],
          [0.63, 0.22, 0.435, 0.98, 0.92, 0.85], [0.50, 0.39, 0.44, 0.88, 1.00, 0.90], [0.61, 0.57, 0.435, 1.00, 0.90, 0.86],
          [0.51, 0.74, 0.44, 0.92, 0.96, 0.88], [0.60, 0.87, 0.435, 0.96, 0.76, 0.84],
          [-0.75, 1.18, 0.36, 0.62, 0.82, 0.68], [-0.75, 1.38, 0.36, 0.62, 0.80, 0.66],
          [0.75, 1.18, 0.36, 0.62, 0.82, 0.68], [0.75, 1.38, 0.36, 0.62, 0.80, 0.66],
        ].map(([qx, qy, qz, sx, sy, sz], qi) => (
          <mesh
            key={`quoin-${qi}`}
            position={[qx, qy, qz]}
            scale={[sx, sy, sz]}
            rotation={[0, (qi % 3 - 1) * 0.025, (qi % 2 === 0 ? 1 : -1) * 0.012]}
            geometry={hearthCraft.quoinStoneGeo}
            material={hearthRubbleMat}
            castShadow
            receiveShadow
          />
        ))}
        {/* Warm Soot-Softened Kiln Firebox Backing Wall & Glowing Ash/Coal Ember Bed */}
        <mesh position={[0, 0.54, -0.34]} receiveShadow>
          <boxGeometry args={[0.74, 0.88, 0.10]} />
          <meshStandardMaterial color="#4D372A" roughness={0.96} envMapIntensity={0.18} />
        </mesh>
        <mesh position={[0, 0.135, 0.02]} scale={[1.0, 0.26, 0.82]} material={hearthCraft.coalBedMat}>
          <sphereGeometry args={[0.28, 20, 12]} />
        </mesh>
        {/* Cast-Iron Fireplace Andiron Grate Bars */}
        {[-0.24, 0.24].map((ax, ai) => (
          <mesh key={`andiron-${ai}`} position={[ax, 0.15, 0.22]} material={ironMat} castShadow>
            <boxGeometry args={[0.032, 0.055, 0.42]} />
          </mesh>
        ))}
        {/* Sculpted Bark-Ridged Split Birch Firewood Logs with Charred Cracked-Ember End Caps! */}
        {[
          [-0.18, 0.195, 0.06, 0.14, 0.18],
          [0.02, 0.195, 0.04, -0.06, -0.10],
          [0.19, 0.195, 0.07, -0.16, 0.14],
          [-0.10, 0.305, 0.02, 0.22, -0.32],
          [0.11, 0.305, 0.04, -0.24, 0.28],
        ].map(([lx, ly, lz, rx, rz], li) => (
          <mesh
            key={li}
            position={[lx, ly, lz]}
            rotation={[Math.PI / 2 + rx, 0, rz]}
            geometry={hearthCraft.birchLogGeo}
            material={li % 2 === 0 ? hearthCraft.birchLogLightMats : hearthCraft.birchLogWarmMats}
            castShadow
            receiveShadow
          />
        ))}
        {/* Dancing Layered GLSL Crackling Fireplace Flames + Warm Flickering Hearth Firelight! */}
        <group position={[0, 0.44, 0.08]}>
          <mesh position={[0, 0, 0.02]} rotation={[0, 0.08, 0]} material={hearthFlameMat} raycast={() => null}>
            <planeGeometry args={[0.42, 0.56, 8, 12]} />
          </mesh>
          <mesh position={[-0.08, -0.04, -0.02]} rotation={[0, 0.65, 0]} material={hearthFlameMat} raycast={() => null}>
            <planeGeometry args={[0.32, 0.46, 8, 12]} />
          </mesh>
          <mesh position={[0.09, -0.03, -0.01]} rotation={[0, -0.58, 0]} material={hearthFlameMat} raycast={() => null}>
            <planeGeometry args={[0.34, 0.48, 8, 12]} />
          </mesh>
          <pointLight
            ref={hearthFireLightRef}
            position={[0, 0.06, 0.38]}
            color="#FF9642"
            intensity={1.35}
            distance={4.8}
            decay={1.85}
          />
        </group>

        {/* Beveled Hewn Stone Hearth Shelf (top at y = 1.0125m cleanly below oven frame) */}
        <mesh position={[0, 0.975, 0.02]} geometry={hearthCraft.hearthShelfGeo} material={hearthRubbleMat} castShadow receiveShadow />

        {/* Carved Honed Limestone Hearth Surround Architrave framing Brass Oven Front Cleanly */}
        <mesh position={[0, 1.40, 0.448]} geometry={hearthCraft.hearthArchitraveGeo} material={hearthCraft.limestoneSurroundMat} castShadow receiveShadow />

        {/* Beveled Random-Rubble Stone Hearth Chamber Body (recessed strictly behind z = 0.448 architrave!) */}
        <mesh position={[0, 1.66, -0.02]} geometry={hearthCraft.hearthUpperGeo} material={hearthRubbleMat} castShadow receiveShadow />
        <mesh position={[0, 1.26, -0.29]} material={hearthRubbleMat} castShadow receiveShadow>
          <boxGeometry args={[1.44, 0.38, 0.30]} />
        </mesh>
        <mesh position={[-0.635, 1.26, 0.13]} material={hearthRubbleMat} castShadow receiveShadow>
          <boxGeometry args={[0.17, 0.38, 0.58]} />
        </mesh>
        <mesh position={[0.635, 1.26, 0.13]} material={hearthRubbleMat} castShadow receiveShadow>
          <boxGeometry args={[0.17, 0.38, 0.58]} />
        </mesh>

        {/* Heavy Beveled Wood-Grain Reclaimed Elm Mantel Beam (`f4a71928`!) */}
        <mesh position={[0, 1.91, 0.06]} geometry={hearthCraft.elmMantelGeo} material={hearthCraft.elmWoodMat} castShadow receiveShadow />

        {/* Organic Curved Rosemary & Lavender Mantel Garland resting cleanly on front Elm Mantel Ledge */}
        <group position={[0, 1.968, 0.472]}>
          <mesh geometry={hearthCraft.garlandVineGeo} material={hearthCraft.vineWoodMat} castShadow />
          {hearthCraft.garlandSamples.map((pt, gi) => (
            <group
              key={gi}
              position={[pt.x, pt.y, pt.z]}
              rotation={[0.35 + (gi % 3) * 0.18, gi * 0.85, (gi % 2 === 0 ? 1 : -1) * (0.45 + (gi % 3) * 0.15)]}
            >
              <mesh
                geometry={hearthCraft.sprigGeo}
                material={gi % 2 === 0 ? hearthCraft.garlandLeafA : hearthCraft.garlandLeafB}
                castShadow
              />
              <mesh
                position={[0.02, 0.04, 0.02]}
                geometry={hearthCraft.blossomGeo}
                material={gi % 3 === 0 ? hearthCraft.garlandLavMat : hearthCraft.garlandCreamMat}
              />
            </group>
          ))}
        </group>

        {/* True World-Axis Symmetric Tapered Stone Fireplace Hood (scale on parent group AFTER 45° mesh rotation -> ZERO shear/crookedness!) */}
        <group position={[0, 3.20, -0.02]} scale={[1.02, 1.0, 0.63]}>
          <mesh
            rotation={[0, Math.PI / 4, 0]}
            material={hearthRubbleMat}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[0.42, 0.98, 2.48, 4]} />
          </mesh>
        </group>
        {/* Exterior Stone Chimney Stack & Copper Cap above Cottage Roof */}
        <mesh position={[0, 4.95, -0.04]} material={hearthRubbleMat} castShadow>
          <boxGeometry args={[0.56, 1.20, 0.48]} />
        </mesh>
        <mesh position={[0, 5.62, -0.04]} material={copperMat}>
          <coneGeometry args={[0.38, 0.20, 4]} />
        </mesh>

        {/* Vintage Cottage Wall Clock mounted 100% FLUSH & DEAD-CENTER on Symmetric Sloped Stone Hood Front Face! */}
        <group position={[0, 2.54, 0.376]} rotation={[-0.1003, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.20, 0.20, 0.048, 36]} />
            <meshStandardMaterial color="#8A5630" roughness={0.55} />
          </mesh>
          <mesh position={[0, 0, 0.026]}>
            <circleGeometry args={[0.175, 36]} />
            <meshStandardMaterial map={craftAssets.clockDialTex} roughness={0.52} />
          </mesh>
        </group>

        {/* 2 Warm Pleated-Linen Vintage Brass Wall Sconces symmetrically flanking the Stone Fireplace (flush against z = -3.62 wall) */}
        {[-1.02, 1.02].map((sx, si) => (
          <group key={`sconce-${si}`} position={[sx, 2.42, -0.50]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={brassMat}>
              <cylinderGeometry args={[0.052, 0.052, 0.022, 16]} />
            </mesh>
            <mesh position={[0, -0.02, 0.06]} rotation={[Math.PI / 2, 0, 0]} material={brassMat}>
              <cylinderGeometry args={[0.008, 0.008, 0.12, 8]} />
            </mesh>
            <mesh position={[0, 0.06, 0.11]} castShadow>
              <cylinderGeometry args={[0.045, 0.088, 0.135, 18, 1, true]} />
              <meshStandardMaterial color="#F8E6C2" emissive="#FFB042" emissiveIntensity={0.36} roughness={0.78} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}

        {/* Vintage French Wall-Hung Hollow Fluted Hammered-Copper Brioche & Kugelhopf Molds (left plaster bay x=-2.03, clear of Pantry & sconce) */}
        {[
          { y: 1.82, r: 0.075, h: 0.044 },
          { y: 1.54, r: 0.064, h: 0.038 },
        ].map((mold, mi) => (
          <group key={`wall-copper-mold-${mi}`} position={[-0.88, mold.y, -0.495]}>
            <FlutedCopperWallMold
              radius={mold.r}
              depth={mold.h}
              copperMat={copperMat}
              tinMat={tinMat}
              brassMat={brassMat}
            />
          </group>
        ))}

        {/* Warm Beeswax Pillar Candles in Brass Holders cleanly seated on Front Elm Mantel Ledge */}
        {[-0.68, 0.68].map((cx, ci) => (
          <group key={`candle-${ci}`} position={[cx, 1.962, 0.47]}>
            <mesh position={[0, 0.015, 0]} material={brassMat}>
              <cylinderGeometry args={[0.045, 0.052, 0.025, 20]} />
            </mesh>
            <mesh position={[0, 0.08 + ci * 0.03, 0]} castShadow>
              <cylinderGeometry args={[0.024, 0.025, 0.12 + ci * 0.06, 18]} />
              <meshStandardMaterial color="#F8ECCE" roughness={0.68} />
            </mesh>
            <mesh position={[0, 0.155 + ci * 0.03, 0]}>
              <sphereGeometry args={[0.010, 10, 8]} />
              <meshStandardMaterial color="#FFF4C4" emissive="#FFA222" emissiveIntensity={0.88} />
            </mesh>
          </group>
        ))}

        {/* Long-Handled Beveled Wooden Baker's Bread Peel leaning cleanly edge-on beside Stone Pier (`world [-0.31, 0.742, -3.22]`) */}
        <group position={[0.84, 0.742, -0.10]} rotation={[0.02, Math.PI * 0.48, 0.04]}>
          <mesh position={[0, 0.22, 0]} material={hearthCraft.oakWoodMat} castShadow>
            <cylinderGeometry args={[0.015, 0.017, 1.48, 16]} />
          </mesh>
          <mesh position={[0, -0.58, 0]} geometry={hearthCraft.breadPeelBladeGeo} material={hearthCraft.oakWoodMat} castShadow />
        </group>

        {/* Matte Aged-Bronze Front Bezel, Rivets, Cream-Enamel Control Bar & Etched Knobs (flush ahead of limestone surround) */}
        <mesh position={[0, 1.26, 0.485]} geometry={ovenFrontBezelGeo} material={hearthCraft.agedBronzeHardwareMat} castShadow />
        <mesh position={[0, 1.26, 0.478]} geometry={ovenGasketGeo} material={epdmGasketMat} />
        {[-0.645, 0.0, 0.645].map((rx, ri) =>
          [1.045, 1.475].map((ry, rj) => (
            <mesh key={`rivet-${ri}-${rj}`} position={[rx, ry, 0.496]} geometry={hearthCraft.rivetGeo} material={hearthCraft.agedBronzeHardwareMat} />
          ))
        )}

        <mesh position={[0, 1.66, 0.486]} geometry={hearthCraft.ovenControlBarGeo} material={hearthCraft.ovenEnamelMat} castShadow />
        <mesh position={[-0.42, 1.66, 0.500]}>
          <circleGeometry args={[0.052, 28]} />
          <meshStandardMaterial map={ovenGaugeTex} roughness={0.48} metalness={0.04} envMapIntensity={0.30} />
        </mesh>
        {[-0.14, 0.12, 0.38].map((kx, idx) => (
          <group key={idx} position={[kx, 1.66, 0.498]}>
            <mesh position={[0, 0, 0.002]}>
              <circleGeometry args={[0.036, 28]} />
              <meshStandardMaterial map={hearthCraft.knobDialTexs[idx]} roughness={0.52} metalness={0.04} envMapIntensity={0.28} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={hearthCraft.agedBronzeHardwareMat}>
              <cylinderGeometry args={[0.038, 0.038, 0.003, 24]} />
            </mesh>
            <group
              ref={idx === 0 ? ovenTempKnobRef : undefined}
              rotation={[0, 0, idx === 0 ? 0 : idx === 1 ? 0.28 : -0.34]}
            >
              <mesh position={[0, 0, 0.013]} rotation={[Math.PI / 2, 0, 0]} material={hearthCraft.agedBronzeHardwareMat}>
                <cylinderGeometry args={[0.019, 0.023, 0.022, 22]} />
              </mesh>
              <mesh position={[0, 0.010, 0.024]} geometry={hearthCraft.knobPointerGeo}>
                <meshStandardMaterial color="#2A2018" roughness={0.48} />
              </mesh>
            </group>
          </group>
        ))}

        {/* Illuminated Refractory Bisque-Terracotta Firebrick Baking Chamber (Gentle Roughness, Zero Greasy Glare!) */}
        <group position={[0, 1.26, 0.15]}>
          <mesh position={[0, 0, -0.285]}>
            <planeGeometry args={[1.08, 0.38]} />
            <meshStandardMaterial
              map={textures.hearthStoneColorMap}
              normalMap={craftAssets.rubbleStone.normalMap}
              normalScale={MARBLE_SLAB_NORMAL_SCALE}
              roughnessMap={textures.hearthStoneRoughnessMap}
              color="#78523A"
              emissive="#FF7E2A"
              emissiveIntensity={isOvenLit ? 0.24 : 0.06}
              roughness={1.0}
              envMapIntensity={0.18}
            />
          </mesh>
          <mesh position={[-0.538, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.58, 0.38]} />
            <meshStandardMaterial
              map={textures.hearthStoneColorMap}
              normalMap={craftAssets.rubbleStone.normalMap}
              normalScale={MARBLE_SLAB_NORMAL_SCALE}
              roughnessMap={textures.hearthStoneRoughnessMap}
              color="#6E4A34"
              emissive="#FF7422"
              emissiveIntensity={isOvenLit ? 0.20 : 0.05}
              roughness={1.0}
              envMapIntensity={0.18}
            />
          </mesh>
          <mesh position={[0.538, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[0.58, 0.38]} />
            <meshStandardMaterial
              map={textures.hearthStoneColorMap}
              normalMap={craftAssets.rubbleStone.normalMap}
              normalScale={MARBLE_SLAB_NORMAL_SCALE}
              roughnessMap={textures.hearthStoneRoughnessMap}
              color="#6E4A34"
              emissive="#FF7422"
              emissiveIntensity={isOvenLit ? 0.20 : 0.05}
              roughness={1.0}
              envMapIntensity={0.18}
            />
          </mesh>
          <mesh position={[0, 0.188, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.08, 0.58]} />
            <meshStandardMaterial
              map={textures.hearthStoneColorMap}
              normalMap={craftAssets.rubbleStone.normalMap}
              normalScale={MARBLE_SLAB_NORMAL_SCALE}
              roughnessMap={textures.hearthStoneRoughnessMap}
              color="#62412E"
              emissive="#FF6E1E"
              emissiveIntensity={isOvenLit ? 0.18 : 0.05}
              roughness={1.0}
              envMapIntensity={0.18}
            />
          </mesh>
        </group>
        <pointLight
          position={[0, 1.34, 0.12]}
          intensity={isOvenLit ? 0.65 : 0.18}
          distance={2.2}
          decay={2.0}
          color="#FF9438"
        />

        {[-0.36, -0.12, 0.12, 0.36].map((hx, idx) => (
          <mesh key={idx} position={[hx, 1.415, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0095, 0.0095, 0.44, 10]} />
            <meshStandardMaterial
              color="#4A2212"
              emissive="#FF5612"
              emissiveIntensity={isOvenLit ? 1.55 : 0.18}
              roughness={0.36}
            />
          </mesh>
        ))}

        <mesh position={[0, 1.10, 0.22]} receiveShadow>
          <boxGeometry args={[1.02, 0.032, 0.46]} />
          <meshStandardMaterial
            map={textures.hearthStoneColorMap}
            normalMap={craftAssets.rubbleStone.normalMap}
            normalScale={MARBLE_SLAB_NORMAL_SCALE}
            roughnessMap={textures.hearthStoneRoughnessMap}
            color="#A88E70"
            roughness={1.0}
            envMapIntensity={0.20}
          />
        </mesh>

        {/* Brushed Stainless Interior Baking Shelf Side Rack Rails */}
        {[-0.495, 0.495].map((rx, ri) => (
          <mesh key={`rack-rail-${ri}`} position={[rx, 1.115, 0.22]} geometry={hearthCraft.ovenRailGeo} material={stainlessMat} castShadow />
        ))}

        {/* Rising & Maillard-Browning Golden Chiffon Sponge Cake Disc (`#D99B52`) with Soft Matte Airy Crumb! */}
        <group position={[0, 1.12, 0.25]}>
          <mesh rotation={[0, Math.PI, 0]} geometry={ovenRingGeo}>
            <meshStandardMaterial color="#CFD4DA" metalness={0.78} roughness={0.34} envMapIntensity={0.48} />
          </mesh>
          <mesh ref={spongeDiscRef} position={[0, 0.0126, 0]} scale={[1, 0.35, 1]}>
            <cylinderGeometry args={[0.226, 0.228, 0.072, 64]} />
            <meshPhysicalMaterial
              ref={spongeDiscMatRef}
              color="#F2E0BA"
              map={textures.spongeColorMap}
              bumpMap={textures.spongeBumpMap}
              bumpScale={0.014}
              roughness={0.88}
              clearcoat={0}
              envMapIntensity={0.28}
            />
          </mesh>
          {/* Rising Soft Oven-Spring Crown Dome puffing gently above the ring as batter bakes */}
          <mesh ref={spongeDomeRef} visible={false} position={[0, 0.025, 0]} scale={[1.0, 0.01, 1.0]}>
            <sphereGeometry args={[0.225, 48, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <meshPhysicalMaterial
              ref={spongeDomeMatRef}
              color="#F2E0BA"
              map={textures.spongeColorMap}
              bumpMap={textures.spongeBumpMap}
              bumpScale={0.014}
              roughness={0.88}
              clearcoat={0}
              envMapIntensity={0.28}
            />
          </mesh>
        </group>

        {/* Bottom-Hinged Aged-Bronze Viewing Door (flush ahead of limestone architrave at z = 0.494) */}
        <group ref={ovenDoorRef} position={[0, 1.06, 0.494]}>
          {/* Twin Matte Aged-Bronze Lower Hinge Brackets & Pins */}
          {[-0.50, 0.50].map((hx, hi) => (
            <group key={`hinge-${hi}`} position={[hx, 0, 0.004]}>
              <mesh geometry={hearthCraft.hingeBracketGeo} material={hearthCraft.agedBronzeHardwareMat} castShadow />
              <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0.012]} material={hearthCraft.agedBronzeHardwareMat}>
                <cylinderGeometry args={[0.008, 0.008, 0.044, 14]} />
              </mesh>
            </group>
          ))}
          <group position={[0, 0.20, 0]}>
            <mesh geometry={ovenDoorBevelFrameGeo} material={hearthCraft.agedBronzeHardwareMat} castShadow />
            {/* Central Top Aged-Bronze Door Latch */}
            <mesh position={[0, 0.215, 0.020]} material={hearthCraft.agedBronzeHardwareMat}>
              <boxGeometry args={[0.064, 0.022, 0.016]} />
            </mesh>
            {/* Plump Turned Honey-Wood Hearth Oven Handle & Rounded Aged-Bronze Corner Medallions */}
            <mesh position={[0, 0.22, 0.056]} rotation={[0, 0, Math.PI / 2]} material={rosewoodMat} castShadow>
              <capsuleGeometry args={[0.018, 0.78, 10, 16]} />
            </mesh>
            {[-0.58, 0.58].map((mx, mi) =>
              [-0.195, 0.195].map((my, mj) => (
                <mesh key={`med-${mi}-${mj}`} position={[mx, my, 0.024]} material={hearthCraft.agedBronzeHardwareMat}>
                  <sphereGeometry args={[0.022, 14, 12]} />
                </mesh>
              ))
            )}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[1.12, 0.37, 0.014]} />
              <meshPhysicalMaterial
                color="#3A2C22"
                transparent
                opacity={0.24}
                roughness={0.14}
                ior={1.48}
                reflectivity={0.48}
                clearcoat={0.22}
                clearcoatRoughness={0.18}
                envMapIntensity={0.45}
              />
            </mesh>
          </group>
        </group>

        {/* Stylized Hand-Drawn Warm Oven Steam drifting cleanly out of the Upper Kiln Door Seam */}
        <CozyHanddrawnSteam
          position={[0, 1.46, 0.45]}
          intensity={isBaking ? 1.28 : isOvenLit ? 0.96 : 0.55}
          tint="#FFF7EB"
          puffCount={9}
          riseHeight={0.48}
          spreadRadius={0.10}
          puffScale={0.11}
          driftX={0.012}
        />
      </group>

      {/* ====================================================================
          C. STEP 3 OPEN-LEGGED CEDAR & COPPER-BOUND ARTISAN ICE CHEST (GLACIÈRE)
             Stands on 4 open turned timber legs — 100% open forest view above y = 1.88m!
         ==================================================================== */}
      <SmegRetroPastryFridge
        position={[1.58, 0, -3.12]}
        isChillerOpen={isChillerOpen}
        isChilling={isChilling}
        chillerProgress={0}
        currentStep={currentStep}
        jellyColor={flavor.jellyColor}
        chillerDoorRef={chillerDoorRef}
        mistParticlesRef={mistParticlesRef}
        cryoParticlesGeo={cryoParticlesGeo}
        cryoMistTex={cryoMistTex}
        cryoMistMat={cryoMistMat}
        brassMat={brassMat}
        stainlessMat={stainlessMat}
        onPeekToggle={() => {
          setFridgePeekOpen((prev) => {
            const next = !prev;
            patisserieAudio.playSoftUiTick();
            window.dispatchEvent(
              new CustomEvent('cottage-easter-egg', {
                detail: {
                  id: 'fridge',
                  icon: '❄️',
                  message: next
                    ? '打开了薄荷复古甜品冰箱，草莓奶油小蛋糕与鲜奶正静静冰镇着'
                    : '轻轻关上了圆润薄荷甜品冰箱门',
                },
              })
            );
            return next;
          });
        }}
      />

      <RoundedCottageAppliancesPack
        radioPlaying={radioPlaying}
        onRadioToggle={() => {
          setRadioPlaying((prev) => {
            const next = !prev;
            patisserieAudio.setRadioPlaying(next);
            window.dispatchEvent(
              new CustomEvent('cottage-easter-egg', {
                detail: {
                  id: 'radio',
                  icon: '🎵',
                  message: next
                    ? '复古核桃木收音机响起了温暖的林间八音盒圆舞曲'
                    : '轻轻拧停了核桃木收音机',
                },
              })
            );
            return next;
          });
        }}
        onKettleTap={() => {
          patisserieAudio.playKettleWhistle();
          window.dispatchEvent(
            new CustomEvent('cottage-easter-egg', {
              detail: {
                id: 'kettle',
                icon: '☕',
                message: '红铜茶壶发出轻柔哨鸣，洋甘菊与蜜橘的暖香弥漫小屋',
              },
            })
          );
        }}
      />
      <CozyBotanicalAndClutterPack />

      {/* Leaning Rustic Wooden Cottage Ladder grounded strictly at y=0.000 against clear North-East Wall (z = -3.48, flush top at -3.62) */}
      <group position={[4.48, 1.172, -3.48]} rotation={[-0.12, 0, 0]}>
        {[-0.17, 0.17].map((lx, li) => (
          <mesh key={li} position={[lx, 0, 0]} material={hearthCraft.oakWoodMat} castShadow>
            <cylinderGeometry args={[0.018, 0.020, 2.36, 16]} />
          </mesh>
        ))}
        {[-0.85, -0.45, -0.05, 0.35, 0.75].map((ry, ri) => (
          <mesh key={ri} position={[0, ry, 0]} rotation={[0, 0, Math.PI / 2]} material={hearthCraft.oakWoodMat} castShadow>
            <cylinderGeometry args={[0.012, 0.012, 0.34, 14]} />
          </mesh>
        ))}
      </group>

      {/* ====================================================================
          D. GRAND BAKER'S PANTRY HUTCH (`[0.36, 0.000, -3.30]`) + HEARTH FIREWOOD BASKET (`[-0.16, 0.000, -2.80]`)
         ==================================================================== */}
      {/* Compact Grounded Wicker Birch-Log Firewood Basket right beside Hearth Stone & clear of Peel/Pantry */}
      <group position={[-0.16, 0.000, -2.80]} scale={0.80}>
        <mesh geometry={hearthCraft.rackBasketGeo} material={hearthCraft.wovenRattanMat} castShadow receiveShadow />
        {[
          { p: [-0.048, 0.19, 0.025] as [number, number, number], r: [0.18, 0.2, -0.16] as [number, number, number], m: hearthCraft.birchLightMat },
          { p: [0.052, 0.20, -0.02] as [number, number, number], r: [-0.15, 0.8, 0.18] as [number, number, number], m: hearthCraft.birchWarmMat },
          { p: [-0.012, 0.21, -0.052] as [number, number, number], r: [0.22, -0.4, 0.08] as [number, number, number], m: hearthCraft.birchLightMat },
          { p: [0.022, 0.18, 0.048] as [number, number, number], r: [-0.20, 1.3, -0.10] as [number, number, number], m: hearthCraft.birchWarmMat },
        ].map((log, li) => (
          <mesh
            key={`hearth-basket-log-${li}`}
            position={log.p}
            rotation={log.r}
            scale={[0.78, 0.46, 0.78]}
            geometry={hearthCraft.birchLogGeo}
            material={log.m}
            castShadow
            receiveShadow
          />
        ))}
      </group>

      {/* Grand Baker's Pantry Hutch & Storage Credenza (`z_min = -3.530` clear of North Chair Rail & Timber Post) */}
      <ArtisanBakerPantryCabinet
        position={[0.36, 0.000, -3.30]}
        oakWoodMat={hearthCraft.oakWoodMat}
        elmWoodMat={hearthCraft.elmWoodMat}
        wickerMat={hearthCraft.wovenRattanMat}
        copperMat={copperMat}
        tinMat={tinMat}
        brassMat={brassMat}
        crystalGlassMat={crystalGlassMat}
        apothecaryJarGeo={apothecaryJarGeo}
        apothecaryLidGeo={apothecaryLidGeo}
        spiceFillGeo={hearthCraft.spiceFillGeo}
        utensilCrockGeo={hearthCraft.utensilCrockGeo}
        herbPotGeo={hearthCraft.herbPotGeo}
        sprigGeo={hearthCraft.sprigGeo}
        leafMat={hearthCraft.garlandLeafA}
        creamEnamelMat={hearthCraft.creamEnamelMat}
        celadonGlazeMat={hearthCraft.celadonGlazeMat}
        stonewareMat={hearthCraft.stonewareTeaMat}
        terracottaMat={hearthCraft.terracottaMat}
        porcelainPitcherGeo={hearthCraft.porcelainPitcherGeo}
      />

      {/* ====================================================================
          E. COURTYARD VERANDA TASTING NOOK: WOOD-GRAIN TEA TABLE, HOLLOW LATHE TEAPOT
             + GOLDEN SCULPTING RIM LIGHT FOR HERO CHANTILLY CAKE!
         ==================================================================== */}
      <group position={[3.55, 0, 0.65]}>
        <mesh geometry={gueridonPedGeo} material={hearthCraft.oakWoodMat} castShadow receiveShadow />

        {/* Round Warm Distressed Cream-Painted Cottage Wood Top */}
        <mesh position={[0, 0.8085, 0]} geometry={tastingMarbleTopGeo} castShadow receiveShadow>
          <meshPhysicalMaterial
            map={craftAssets.beadboard.map}
            normalMap={craftAssets.beadboard.normalMap}
            normalScale={MARBLE_SLAB_NORMAL_SCALE}
            color="#F5ECDA"
            roughness={0.80}
            clearcoat={0.05}
            clearcoatRoughness={0.44}
            envMapIntensity={0.32}
          />
        </mesh>
        {/* Real-Thickness Ecru Linen Lace Centerpiece Doily (top strictly at y = 0.8268m) */}
        <mesh position={[0, 0.8263, 0]} receiveShadow raycast={() => null}>
          <cylinderGeometry args={[0.425, 0.425, 0.0010, 56]} />
          <meshStandardMaterial
            map={textures.linenColorMap}
            normalMap={textures.linenNormalMap}
            normalScale={LINEN_NORMAL_SCALE}
            color="#EFE2CA"
            roughness={0.92}
          />
        </mesh>
        <mesh position={[0, 0.8055, 0]} rotation={[Math.PI / 2, 0, 0]} material={hearthCraft.oakWoodMat}>
          <torusGeometry args={[0.765, 0.020, 14, 56]} />
        </mesh>

        {/* Folded Natural Unbleached Oat-Flax Linen Napkin cleanly outside Doily & Teacup Saucer */}
        <mesh
          position={[-0.41, 0.8272, 0.45]}
          rotation={[0, -0.38, 0]}
          geometry={tastingNapkinGeo}
          castShadow
          receiveShadow
          raycast={() => null}
        >
          <meshPhysicalMaterial
            map={textures.linenColorMap}
            normalMap={textures.linenNormalMap}
            normalScale={LINEN_NORMAL_SCALE}
            color="#DFCFAF"
            roughness={0.88}
            sheen={0.32}
            sheenColor="#F6EBD4"
          />
        </mesh>

        {/* Beveled Sage-Linen Country Baking & Botanical Recipe Journal (4.9cm clear of centerpiece doily!) */}
        <group position={[-0.39, 0.8355, -0.51]} rotation={[0, 0.52, 0]}>
          <mesh position={[0.005, 0, 0]} geometry={hearthCraft.journalPagesGeo} castShadow>
            <meshStandardMaterial color="#F2E7CE" roughness={0.82} />
          </mesh>
          <mesh position={[0, -0.008, 0]} geometry={hearthCraft.journalCoverGeo} material={hearthCraft.journalLinenMat} castShadow />
          <mesh position={[0, 0.008, 0]} geometry={hearthCraft.journalCoverGeo} material={hearthCraft.journalLinenMat} castShadow />
          <mesh position={[-0.098, 0, 0]} rotation={[Math.PI / 2, 0, 0]} material={hearthCraft.journalLinenMat} castShadow>
            <cylinderGeometry args={[0.0096, 0.0096, 0.27, 20]} />
          </mesh>
          {/* Embossed Gilded-Brass Botanical Bookplate Medallion replacing raw primitive cylinder */}
          <mesh position={[0.010, 0.0112, 0]} geometry={hearthCraft.journalMedallionGeo} material={brassMat} castShadow />
          <mesh position={[0.010, 0.0132, 0]} geometry={hearthCraft.vaseCenterGeo} material={hearthCraft.vaseGoldCenterMat} scale={0.75} />
        </group>

        {/* High-Craft Hollow Lathe Cream Stoneware Chamomile Teapot + Domed Celadon Lid + Ferruled Wood Handle! */}
        <group position={[-0.57, 0.827, -0.08]} rotation={[0, 0.55, 0]}>
          <mesh geometry={hearthCraft.teapotBodyGeo} material={hearthCraft.stonewareTeaMat} castShadow receiveShadow />
          <mesh position={[0, 0.122, 0]} geometry={hearthCraft.teapotLidGeo} material={hearthCraft.celadonGlazeMat} castShadow receiveShadow />
          <mesh position={[0, 0.144, 0]} material={hearthCraft.oakWoodMat} castShadow>
            <sphereGeometry args={[0.0135, 20, 14]} />
          </mesh>
          <mesh geometry={hearthCraft.teapotSpoutGeo} material={hearthCraft.stonewareTeaMat} castShadow />
          {/* Wooden handle with twin turned brass mounting ferrules gripping the teapot shoulder */}
          <mesh position={[-0.068, 0.072, 0]} rotation={[0, 0, Math.PI * 0.52]} material={hearthCraft.oakWoodMat} castShadow>
            <torusGeometry args={[0.046, 0.008, 16, 28, Math.PI * 1.15]} />
          </mesh>
          <mesh position={[-0.060, 0.114, 0]} rotation={[0, 0, 0.42]} material={brassMat}>
            <cylinderGeometry args={[0.0105, 0.0115, 0.012, 20]} />
          </mesh>
          <mesh position={[-0.068, 0.028, 0]} rotation={[0, 0, -0.35]} material={brassMat}>
            <cylinderGeometry args={[0.0105, 0.0115, 0.012, 20]} />
          </mesh>
        </group>

        {/* Hand-Thrown Celadon-Rimmed Stoneware Teacup (6.0cm clear of centerpiece doily, radial golden chamomile tea!) */}
        <group position={[-0.50, 0.827, 0.25]}>
          <mesh geometry={espressoSaucerGeo} material={hearthCraft.stonewareTeaMat} receiveShadow castShadow />
          <mesh position={[0, 0.010, 0]} rotation={[Math.PI / 2, 0, 0]} material={hearthCraft.celadonGlazeMat}>
            <torusGeometry args={[0.074, 0.0028, 14, 36]} />
          </mesh>
          <mesh position={[0, 0.006, 0]} geometry={espressoCupGeo} material={hearthCraft.stonewareTeaMat} castShadow />
          <mesh position={[0, 0.006, 0]} geometry={espressoHandleGeo} material={hearthCraft.stonewareTeaMat} />
          <mesh position={[0, 0.052, 0]} rotation={[-Math.PI / 2, 0, 0]} material={hearthCraft.teaLiquidMat}>
            <circleGeometry args={[0.036, 32]} />
          </mesh>
        </group>

        {/* Hollow Lathe Green-Glass Bud Vase with Sculpted Hoisted Botanical Stems & Petals (ZERO inline .map() allocations!) */}
        <group position={[0.32, 0.827, -0.53]}>
          <mesh geometry={hearthCraft.budVaseGeo} castShadow>
            <meshPhysicalMaterial color="#8CB285" transparent opacity={0.46} roughness={0.14} clearcoat={0.20} envMapIntensity={0.48} />
          </mesh>
          {[-0.012, 0.012].map((fx, fi) => (
            <group key={fi} position={[fx, 0.145, fi * 0.01]} rotation={[0.14 * (fi === 0 ? 1 : -1), fi, 0.12]}>
              <mesh geometry={hearthCraft.vaseStemGeo} material={hearthCraft.vaseStemMat} />
              <group position={[0, 0.064, 0]}>
                {[0, 1, 2, 3, 4, 5].map((pi) => {
                  const pa = (pi / 6) * Math.PI * 2;
                  return (
                    <mesh
                      key={pi}
                      position={[Math.cos(pa) * 0.003, 0, Math.sin(pa) * 0.003]}
                      rotation={[0, -pa, 0]}
                      geometry={hearthCraft.vasePetalGeo}
                      material={fi === 0 ? hearthCraft.vaseWhitePetalMat : hearthCraft.vaseRosePetalMat}
                      castShadow
                    />
                  );
                })}
                <mesh
                  position={[0, 0.004, 0]}
                  geometry={hearthCraft.vaseCenterGeo}
                  material={fi === 0 ? hearthCraft.vaseGoldCenterMat : hearthCraft.vaseRoseCenterMat}
                />
              </group>
            </group>
          ))}
        </group>

        {/* Hand-Glazed Speckled Celadon Ceramic Leaf Knife Rest grounded flush at y=0.8265 */}
        <group position={[0.16, 0.8315, 0.565]} rotation={[0, -0.42, 0]}>
          <mesh
            position={[0.0, 0, 0]}
            scale={[1.2, 0.72, 1.35]}
            geometry={crystalKnifeRestGeo}
            material={hearthCraft.celadonGlazeMat}
            castShadow
            receiveShadow
          />
        </group>

        {/* Hand-Forged Satin Steel & Floral-Printed Porcelain Cottage Cake Knife nestled cleanly inside Celadon Rest Saddle */}
        <group
          ref={silverKnifeGroupRef}
          position={[0.16, 0.8355, 0.565]}
          rotation={[0, -0.42, -0.055]}
        >
          <mesh position={[-0.10, 0, 0]} geometry={silverKnifeBladeGeo} material={stainlessMat} castShadow />
          <mesh position={[0.005, 0, 0]} geometry={silverKnifeHandleGeo} material={rosewoodMat} castShadow />
        </group>

        {/* Celadon-Rimmed Floral Pastoral Stoneware Dessert Plate & Floral-Handle Pastry Fork */}
        <group position={[0.50, 0.827, -0.32]} rotation={[0, -0.58, 0]}>
          <mesh scale={[1.45, 0.85, 1.45]} geometry={espressoSaucerGeo} material={hearthCraft.stonewareTeaMat} receiveShadow castShadow />
          <mesh position={[0, 0.012, 0]} rotation={[Math.PI / 2, 0, 0]} material={hearthCraft.celadonGlazeMat}>
            <torusGeometry args={[0.108, 0.0032, 14, 48]} />
          </mesh>
          <group position={[0.135, 0.006, 0.01]} rotation={[0, 0.12, 0]}>
            <mesh position={[0, 0, 0.038]} rotation={[Math.PI / 2, 0, 0]} material={rosewoodMat} castShadow>
              <cylinderGeometry args={[0.0046, 0.0062, 0.092, 24]} />
            </mesh>
            <mesh position={[0, 0, -0.012]} rotation={[Math.PI / 2, 0, 0]} material={stainlessMat}>
              <cylinderGeometry args={[0.0085, 0.0045, 0.014, 20]} />
            </mesh>
            {[-0.0055, 0, 0.0055].map((tx, ti) => (
              <mesh key={ti} position={[tx, 0, -0.034]} rotation={[Math.PI / 2, 0, 0]} material={stainlessMat}>
                <capsuleGeometry args={[0.0012, 0.032, 6, 12]} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
};

export default PatisserieEquipment;
