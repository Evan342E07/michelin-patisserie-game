import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getCottageCraftAssets } from '../environment/cottageTexturesAndFlora';
import {
  createBeveledBoxGeometry,
  createBreadboxRollTopGeometry,
  createGlassVesselGeometry,
  createMiniStrawberryGeometry,
  createMousseRingGeometry,
  createRollingPinGeometry,
  createSlottedEvaporatorGrilleGeometry,
  createStrawberryCalyxGeometry,
  createTurnedHandleGeometry,
  createWireWhiskWiresGeometry,
} from '../../geometry/patisserieGeometry';
import { enhanceWithExtremeMicroCraft } from '../../shaders/extremeThreeJsUpgrades';
import { CozyHanddrawnSteam, enhanceWithStylizedFresnelRim } from '../../shaders/stylizedCozyUpgrades';
import { useGameStore } from '../../store/useGameStore';
import {
  createBelliedKettleBodyGeo,
  createCanisterCeramicTexture,
  createHollowVesselLatheGeo,
  createMicroSurfaceMaps,
  createRadioDialTexture,
  createTurnedBalusterLegGeo,
  createWoodGrainPbr,
  createWovenFabricPbr,
} from './cottageHighCraftPbr';

function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const s = new THREE.Shape();
  const hw = width * 0.5;
  const hh = height * 0.5;
  const r = Math.min(radius, hw * 0.9, hh * 0.9);
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
}

function createPillowyCabinetGeo(
  width: number,
  height: number,
  depth: number,
  cornerRadius = 0.14,
  bevel = 0.044
): THREE.BufferGeometry {
  const shape = createRoundedRectShape(
    width - bevel * 2,
    height - bevel * 2,
    Math.max(0.02, cornerRadius - bevel * 0.5)
  );
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.02, depth - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 6,
    curveSegments: 18,
  });
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

/**
 * Arched viewing window glass shape matching the arched door cutout strictly (ZERO corner clipping!)
 */
function createArchedGlassPaneGeo(innerW: number, innerH: number, thickness = 0.014): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const hw = innerW * 0.5;
  const hh = innerH * 0.5;
  const r = Math.min(hw * 0.98, 0.34);
  shape.moveTo(-hw + 0.055, -hh);
  shape.lineTo(hw - 0.055, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + 0.055);
  shape.lineTo(hw, hh - r);
  shape.absarc(0, hh - r, hw, 0, Math.PI, false);
  shape.lineTo(-hw, -hh + 0.055);
  shape.quadraticCurveTo(-hw, -hh, -hw + 0.055, -hh);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 22,
  });
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

function createRoundedArchFrameGeo(
  outerW: number,
  outerH: number,
  innerW: number,
  innerH: number,
  depth = 0.036
): THREE.BufferGeometry {
  const shape = createRoundedRectShape(outerW, outerH, 0.12);
  const hole = new THREE.Path();
  const hw = innerW * 0.5;
  const hh = innerH * 0.5;
  const r = Math.min(hw * 0.98, 0.34);
  hole.moveTo(-hw + 0.055, -hh);
  hole.lineTo(hw - 0.055, -hh);
  hole.quadraticCurveTo(hw, -hh, hw, -hh + 0.055);
  hole.lineTo(hw, hh - r);
  hole.absarc(0, hh - r, hw, 0, Math.PI, false);
  hole.lineTo(-hw, -hh + 0.055);
  hole.quadraticCurveTo(-hw, -hh, -hw + 0.055, -hh);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.010,
    bevelSegments: 5,
    curveSegments: 22,
  });
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

function drawPastelRetroDial(
  canvas: HTMLCanvasElement,
  label: string,
  accent: string,
  tempText: string,
  needleFrac = 0.25
): void {
  const size = canvas.width;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#F7EEDB';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(128, 128, 114, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#5E4934';
  ctx.lineWidth = 3.5;
  for (let i = 0; i <= 12; i++) {
    const ang = -Math.PI * 1.2 + (i / 12) * Math.PI * 1.4;
    const r0 = i % 3 === 0 ? 74 : 88;
    const r1 = 102;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(ang) * r0, 128 + Math.sin(ang) * r0);
    ctx.lineTo(128 + Math.cos(ang) * r1, 128 + Math.sin(ang) * r1);
    ctx.stroke();
  }

  const clampedFrac = THREE.MathUtils.clamp(needleFrac, 0, 1);
  const needleAngle = -Math.PI * 1.2 + clampedFrac * Math.PI * 1.4;
  ctx.strokeStyle = '#C94E3E';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(128, 128);
  ctx.lineTo(128 + Math.cos(needleAngle) * 68, 128 + Math.sin(needleAngle) * 68);
  ctx.stroke();

  ctx.fillStyle = '#B88D40';
  ctx.beginPath();
  ctx.arc(128, 128, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#4E3B2A';
  ctx.font = 'bold 24px "Noto Serif SC", "Songti SC", "Microsoft YaHei", serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, 128, 174);
  ctx.fillStyle = '#336A5A';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(tempText, 128, 206);
}

/**
 * Vintage pastel analog fridge/scale dial texture (rendered via PBR meshStandardMaterial — ZERO white blowout!)
 */
function createPastelRetroDialTexture(
  label: string,
  accent: string,
  tempText: string,
  needleFrac = 0.25
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  drawPastelRetroDial(canvas, label, accent, tempText, needleFrac);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createCuteBakeryScriptTexture(title: string, bg: string, fg: string): THREE.CanvasTexture {
  const w = 256;
  const h = 96;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = fg;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(10, 10, w - 20, h - 20, 18);
  ctx.stroke();

  ctx.fillStyle = fg;
  ctx.font = 'bold 34px "Noto Serif SC", "Songti SC", "Microsoft YaHei", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, w / 2, h / 2 + 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface SmegRetroPastryFridgeProps {
  position: [number, number, number];
  isChillerOpen: boolean;
  isChilling: boolean;
  chillerProgress: number;
  currentStep: number;
  jellyColor: string;
  chillerDoorRef: React.RefObject<THREE.Group>;
  mistParticlesRef: React.RefObject<THREE.Points>;
  cryoParticlesGeo: THREE.BufferGeometry;
  cryoMistTex: THREE.Texture;
  cryoMistMat: THREE.Material;
  brassMat: THREE.Material;
  stainlessMat: THREE.Material;
  onPeekToggle?: () => void;
}

/**
 * ITERATION 1 RED-TEAM HARDENED:
 * Pillowy Rounded Pastel Pistachio-Sage & Butter-Cream Smeg Retro Cottage Pastry Fridge!
 * - Zero raw boxGeometry on shell/skirt/drawer/cheeks (100% beveled ExtrudeGeometry)
 * - Zero vertical pole clipping shelves (clean beveled horizontal wooden rails + glass trays!)
 * - Zero floating crown dial/badge (mounted flush on front apron with PBR lighting, zero meshBasicMaterial!)
 * - Arched glass pane strictly contoured inside arched door frame (zero corner clipping!)
 * - Real TubeGeometry vine stem connecting fridge-top ivy leaves!
 */
export const SmegRetroPastryFridge: React.FC<SmegRetroPastryFridgeProps> = ({
  position,
  isChillerOpen,
  isChilling,
  chillerProgress: _chillerProgress,
  currentStep,
  jellyColor,
  chillerDoorRef,
  mistParticlesRef,
  cryoParticlesGeo,
  cryoMistTex,
  cryoMistMat,
  brassMat,
  stainlessMat,
  onPeekToggle,
}) => {
  const craftAssets = useMemo(() => getCottageCraftAssets(), []);
  const [hovered, setHovered] = useState(false);
  const jellyInsertRef = useRef<THREE.Group>(null);
  const jellyInsertMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const frostRimRef = useRef<THREE.Mesh>(null);
  const lastDialKeyRef = useRef('');

  const assets = useMemo(() => {
    const woodPbr = createWoodGrainPbr('#A67144', '#6E4222', 111);
    const enamelMicro = createMicroSurfaceMaps(0.32, 0.07, false, 202);
    const ceramicMicro = createMicroSurfaceMaps(0.40, 0.08, false, 203);

    // Unified pillowy rounded rear shell (recessed behind luminous interior liner — ZERO burial!)
    const backShellGeo = createPillowyCabinetGeo(1.06, 1.72, 0.18, 0.16, 0.042);
    const cheekGeo = createPillowyCabinetGeo(0.15, 1.12, 0.56, 0.06, 0.024);
    const lowerBaseGeo = createPillowyCabinetGeo(1.06, 0.44, 0.70, 0.14, 0.040);
    const drawerFrontGeo = createPillowyCabinetGeo(0.84, 0.25, 0.06, 0.065, 0.018);
    const topCrownGeo = createPillowyCabinetGeo(1.06, 0.24, 0.70, 0.14, 0.042);
    const badgePlaqueGeo = createBeveledBoxGeometry(0.31, 0.105, 0.014, 0.018, 0.004, 0.004, 2);
    const doorOuterFrameGeo = createRoundedArchFrameGeo(0.92, 1.08, 0.68, 0.84, 0.038);
    const archedGlassGeo = createArchedGlassPaneGeo(0.68, 0.84, 0.012);
    const shelfRailGeo = createBeveledBoxGeometry(0.76, 0.020, 0.026, 0.006, 0.003, 0.003, 2);
    const shelfGlassGeo = createBeveledBoxGeometry(0.75, 0.012, 0.36, 0.008, 0.002, 0.002, 2);
    const evapGrilleGeo = createSlottedEvaporatorGrilleGeometry(0.68, 0.34, 6);
    const evapFinGeo = createBeveledBoxGeometry(0.010, 0.94, 0.014, 0.002, 0.001, 0.001, 1);
    const wireRackSpanGeo = new THREE.CylinderGeometry(0.0022, 0.0022, 0.71, 8);
    const wireRackDepthGeo = new THREE.CylinderGeometry(0.0020, 0.0020, 0.32, 8);
    const butterDishGeo = createBeveledBoxGeometry(0.16, 0.016, 0.12, 0.016, 0.004, 0.004, 2);
    const butterStickGeo = createBeveledBoxGeometry(0.105, 0.046, 0.066, 0.008, 0.004, 0.004, 2);
    const jellyRingGeo = createMousseRingGeometry(0.184, 0.036, 0.0035, 48);

    // Hollow Lathe ceramic/crystal vessels inside fridge & on top (64-seg silky smooth!)
    const milkCarafeGeo = createGlassVesselGeometry(0.028, 0.045, 0.175, 0.0035);
    const creamFillGeo = createHollowVesselLatheGeo(0.039, 0.039, 0.026, 0.112, 0.004, 48);
    const ramekinGeo = createHollowVesselLatheGeo(0.042, 0.048, 0.048, 0.066, 0.005, 64);
    const planterGeo = createHollowVesselLatheGeo(0.072, 0.096, 0.094, 0.148, 0.008, 64);
    const basketGeo = createHollowVesselLatheGeo(0.125, 0.158, 0.162, 0.155, 0.010, 64);

    // Curved ergonomic brass pull handle
    const hCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.17, 0.0),
      new THREE.Vector3(0, 0.145, 0.062),
      new THREE.Vector3(0, 0.0, 0.076),
      new THREE.Vector3(0, -0.145, 0.062),
      new THREE.Vector3(0, -0.17, 0.0),
    ]);
    const handleCurveGeo = new THREE.TubeGeometry(hCurve, 24, 0.014, 12, false);

    // Curved woody vine stem draping over right shoulder of fridge (ZERO floating leaves!)
    const vineCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.04, 0.13, 0.03),
      new THREE.Vector3(0.12, 0.11, 0.10),
      new THREE.Vector3(0.16, -0.02, 0.15),
      new THREE.Vector3(0.20, -0.18, 0.16),
      new THREE.Vector3(0.22, -0.34, 0.14),
    ]);
    const vineStemGeo = new THREE.TubeGeometry(vineCurve, 20, 0.0055, 8, false);
    const vinePoints = [0.22, 0.36, 0.50, 0.64, 0.78, 0.92].map((t) => vineCurve.getPointAt(t));

    // Shared small leaf, sprig & sculpted strawberry garnish geometries (ZERO duplicate allocations in .map()!)
    const leafGeo = new THREE.SphereGeometry(0.028, 10, 8);
    const rosemarySprigGeo = new THREE.ConeGeometry(0.018, 0.12, 8);
    const chamomileGeo = new THREE.SphereGeometry(0.014, 10, 8);
    const miniStrawberryGeo = createMiniStrawberryGeometry(0.016, 0.026);
    const strawberryCalyxGeo = createStrawberryCalyxGeometry(0.014);

    const dialTex = createPastelRetroDialTexture('急冻温表', '#739A7E', '+4.0°C', 0.14);
    const badgeTex = createCuteBakeryScriptTexture('林间甜室', '#F6EBCD', '#6B4D30');
    const postcardTex = createCuteBakeryScriptTexture('手写食谱', '#FFF8E8', '#C66A62');

    const sageEnamelMat = enhanceWithStylizedFresnelRim(
      enhanceWithExtremeMicroCraft(
        new THREE.MeshPhysicalMaterial({
          color: '#A5C7A0',
          roughness: 1.0,
          roughnessMap: enamelMicro.roughnessMap,
          bumpMap: enamelMicro.bumpMap,
          bumpScale: 0.0012,
          metalness: 0.03,
          clearcoat: 0.16,
          clearcoatRoughness: 0.30,
          envMapIntensity: 0.38,
        }),
        { boxProjectedIBL: true, detailKind: 'stone_ceramic', detailStrength: 0.03, cacheTag: 'smeg-mint-enamel' }
      ),
      { rimColor: '#FFE8BC', rimStrength: 0.34, rimPower: 2.5, topBias: 0.45, cacheTag: 'smeg-mint-rim' }
    );
    const creamEnamelMat = enhanceWithStylizedFresnelRim(
      enhanceWithExtremeMicroCraft(
        new THREE.MeshPhysicalMaterial({
          color: '#F3E5CA',
          roughness: 1.0,
          roughnessMap: enamelMicro.roughnessMap,
          bumpMap: enamelMicro.bumpMap,
          bumpScale: 0.0012,
          metalness: 0.02,
          clearcoat: 0.16,
          clearcoatRoughness: 0.30,
          envMapIntensity: 0.38,
        }),
        { boxProjectedIBL: true, detailKind: 'stone_ceramic', detailStrength: 0.03, cacheTag: 'smeg-cream-enamel' }
      ),
      { rimColor: '#FFE4B0', rimStrength: 0.28, rimPower: 2.7, topBias: 0.42, cacheTag: 'smeg-cream-rim' }
    );
    const woodFeetMat = new THREE.MeshStandardMaterial({
      map: woodPbr.map,
      bumpMap: woodPbr.bumpMap,
      bumpScale: 0.004,
      roughnessMap: woodPbr.roughnessMap,
      roughness: 1.0,
      envMapIntensity: 0.34,
    });
    const jellyRingMat = new THREE.MeshStandardMaterial({
      color: '#B8C0C8',
      metalness: 0.68,
      roughness: 0.44,
      envMapIntensity: 0.45,
    });
    const dialMat = new THREE.MeshStandardMaterial({
      map: dialTex,
      roughness: 0.48,
      metalness: 0.02,
      envMapIntensity: 0.32,
    });
    const badgeMat = new THREE.MeshStandardMaterial({
      map: badgeTex,
      roughness: 0.46,
      metalness: 0.06,
      envMapIntensity: 0.35,
    });
    const postcardMat = new THREE.MeshStandardMaterial({
      map: postcardTex,
      roughness: 0.86,
      envMapIntensity: 0.28,
    });
    const shelfGlassMat = new THREE.MeshPhysicalMaterial({
      color: '#F5F2E8',
      transparent: true,
      opacity: 0.22,
      roughness: 0.18,
      ior: 1.48,
      reflectivity: 0.34,
      clearcoat: 0.16,
      clearcoatRoughness: 0.22,
      envMapIntensity: 0.32,
    });
    const ceramicCreamMat = enhanceWithStylizedFresnelRim(
      new THREE.MeshPhysicalMaterial({
        color: '#FBF5E8',
        emissive: '#FFE0A4',
        emissiveIntensity: 0.22,
        roughness: 1.0,
        roughnessMap: ceramicMicro.roughnessMap,
        bumpMap: ceramicMicro.bumpMap,
        bumpScale: 0.002,
        clearcoat: 0.16,
        clearcoatRoughness: 0.32,
        envMapIntensity: 0.34,
      }),
      { rimColor: '#FFE4B0', rimStrength: 0.26, rimPower: 2.7, cacheTag: 'smeg-cer-cream' }
    );
    const ceramicBlushMat = enhanceWithStylizedFresnelRim(
      new THREE.MeshPhysicalMaterial({
        color: '#F0C2BC',
        emissive: '#FFDCA0',
        emissiveIntensity: 0.18,
        roughness: 1.0,
        roughnessMap: ceramicMicro.roughnessMap,
        clearcoat: 0.16,
        clearcoatRoughness: 0.32,
        envMapIntensity: 0.34,
      }),
      { rimColor: '#FFE4B0', rimStrength: 0.26, rimPower: 2.7, cacheTag: 'smeg-cer-blush' }
    );
    const ceramicButterMat = enhanceWithStylizedFresnelRim(
      new THREE.MeshPhysicalMaterial({
        color: '#F6E1AC',
        emissive: '#FFE09E',
        emissiveIntensity: 0.20,
        roughness: 1.0,
        roughnessMap: ceramicMicro.roughnessMap,
        clearcoat: 0.16,
        clearcoatRoughness: 0.32,
        envMapIntensity: 0.34,
      }),
      { rimColor: '#FFE4B0', rimStrength: 0.26, rimPower: 2.7, cacheTag: 'smeg-cer-butter' }
    );
    const herbLeafMat = new THREE.MeshStandardMaterial({ color: '#588E42', roughness: 0.68, envMapIntensity: 0.32 });
    const herbLeafLightMat = new THREE.MeshStandardMaterial({ color: '#70A654', roughness: 0.66, envMapIntensity: 0.32 });
    const vineStemMat = new THREE.MeshStandardMaterial({ color: '#644E36', roughness: 0.86 });
    const chamomileMat = new THREE.MeshStandardMaterial({ color: '#FFF8E2', roughness: 0.56 });
    const evapWallMat = new THREE.MeshPhysicalMaterial({
      color: '#F5EAD6',
      emissive: '#FFE4B4',
      emissiveIntensity: 0.10,
      bumpMap: enamelMicro.bumpMap,
      bumpScale: 0.001,
      metalness: 0.04,
      roughness: 0.62,
      envMapIntensity: 0.28,
    });
    const ledCoveMat = new THREE.MeshStandardMaterial({
      color: '#FFF6E4',
      emissive: '#FFE2AE',
      emissiveIntensity: 0.42,
      roughness: 0.44,
    });
    const frostTrimMat = new THREE.MeshStandardMaterial({
      color: '#EFEAD8',
      emissive: '#FFE4B8',
      emissiveIntensity: 0.08,
      roughness: 0.64,
      transparent: true,
      opacity: 0.32,
    });
    const crystalCarafeMat = new THREE.MeshPhysicalMaterial({
      color: '#FAF3E4',
      emissive: '#FFDCA0',
      emissiveIntensity: 0.16,
      transparent: true,
      opacity: 0.24,
      roughness: 0.18,
      ior: 1.48,
      reflectivity: 0.34,
      clearcoat: 0.16,
      clearcoatRoughness: 0.22,
      envMapIntensity: 0.32,
    });

    return {
      woodPbr,
      enamelMicro,
      ceramicMicro,
      backShellGeo,
      cheekGeo,
      lowerBaseGeo,
      drawerFrontGeo,
      topCrownGeo,
      badgePlaqueGeo,
      doorOuterFrameGeo,
      archedGlassGeo,
      shelfRailGeo,
      shelfGlassGeo,
      evapGrilleGeo,
      evapFinGeo,
      wireRackSpanGeo,
      wireRackDepthGeo,
      butterDishGeo,
      butterStickGeo,
      jellyRingGeo,
      milkCarafeGeo,
      creamFillGeo,
      ramekinGeo,
      planterGeo,
      basketGeo,
      handleCurveGeo,
      vineStemGeo,
      vinePoints,
      leafGeo,
      rosemarySprigGeo,
      chamomileGeo,
      miniStrawberryGeo,
      strawberryCalyxGeo,
      dialTex,
      badgeTex,
      postcardTex,
      sageEnamelMat,
      creamEnamelMat,
      woodFeetMat,
      jellyRingMat,
      dialMat,
      badgeMat,
      postcardMat,
      shelfGlassMat,
      ceramicCreamMat,
      ceramicBlushMat,
      ceramicButterMat,
      herbLeafMat,
      herbLeafLightMat,
      vineStemMat,
      chamomileMat,
      evapWallMat,
      ledCoveMat,
      frostTrimMat,
      crystalCarafeMat,
    };
  }, []);

  useEffect(() => {
    return () => {
      assets.woodPbr.map.dispose();
      assets.woodPbr.bumpMap.dispose();
      assets.woodPbr.roughnessMap.dispose();
      assets.enamelMicro.bumpMap.dispose();
      assets.enamelMicro.roughnessMap.dispose();
      assets.ceramicMicro.bumpMap.dispose();
      assets.ceramicMicro.roughnessMap.dispose();
      assets.backShellGeo.dispose();
      assets.cheekGeo.dispose();
      assets.lowerBaseGeo.dispose();
      assets.drawerFrontGeo.dispose();
      assets.topCrownGeo.dispose();
      assets.badgePlaqueGeo.dispose();
      assets.doorOuterFrameGeo.dispose();
      assets.archedGlassGeo.dispose();
      assets.shelfRailGeo.dispose();
      assets.shelfGlassGeo.dispose();
      assets.evapGrilleGeo.dispose();
      assets.evapFinGeo.dispose();
      assets.wireRackSpanGeo.dispose();
      assets.wireRackDepthGeo.dispose();
      assets.butterDishGeo.dispose();
      assets.butterStickGeo.dispose();
      assets.jellyRingGeo.dispose();
      assets.milkCarafeGeo.dispose();
      assets.creamFillGeo.dispose();
      assets.ramekinGeo.dispose();
      assets.planterGeo.dispose();
      assets.basketGeo.dispose();
      assets.handleCurveGeo.dispose();
      assets.vineStemGeo.dispose();
      assets.leafGeo.dispose();
      assets.rosemarySprigGeo.dispose();
      assets.chamomileGeo.dispose();
      assets.miniStrawberryGeo.dispose();
      assets.strawberryCalyxGeo.dispose();
      assets.dialTex.dispose();
      assets.badgeTex.dispose();
      assets.postcardTex.dispose();
      assets.sageEnamelMat.dispose();
      assets.creamEnamelMat.dispose();
      assets.woodFeetMat.dispose();
      assets.jellyRingMat.dispose();
      assets.dialMat.dispose();
      assets.badgeMat.dispose();
      assets.postcardMat.dispose();
      assets.shelfGlassMat.dispose();
      assets.ceramicCreamMat.dispose();
      assets.ceramicBlushMat.dispose();
      assets.ceramicButterMat.dispose();
      assets.herbLeafMat.dispose();
      assets.herbLeafLightMat.dispose();
      assets.vineStemMat.dispose();
      assets.chamomileMat.dispose();
      assets.evapWallMat.dispose();
      assets.ledCoveMat.dispose();
      assets.frostTrimMat.dispose();
      assets.crystalCarafeMat.dispose();
      if (document.body.style.cursor === 'pointer') {
        document.body.style.cursor = 'auto';
      }
    };
  }, [assets]);

  useFrame(() => {
    const state = useGameStore.getState();
    const cp = state.chillerProgress;
    const liveTemp = state.chillerTemp;
    const roundedHalf = Math.round(liveTemp * 2) / 2;
    const key = `${roundedHalf.toFixed(1)}`;
    if (key !== lastDialKeyRef.current) {
      lastDialKeyRef.current = key;
      const frac = THREE.MathUtils.clamp((4.0 - roundedHalf) / 29.0, 0.08, 0.96);
      const sign = roundedHalf > 0.05 ? '+' : '';
      drawPastelRetroDial(
        assets.dialTex.image as HTMLCanvasElement,
        '急冻温表',
        '#739A7E',
        `${sign}${roundedHalf.toFixed(1)}°C`,
        frac
      );
      assets.dialTex.needsUpdate = true;
    }
    if (jellyInsertRef.current) {
      jellyInsertRef.current.visible =
        state.currentStep <= 4 && (state.isChilling || cp > 0 || state.currentStep === 3);
    }
    if (jellyInsertMatRef.current) {
      jellyInsertMatRef.current.roughness = Math.max(0.03, 0.07 - cp * 0.03);
    }
    if (frostRimRef.current) {
      frostRimRef.current.visible = cp > 0.25;
    }
  });

  return (
    <group
      position={position}
      onClick={(e) => {
        if (e.delta > 5) return;
        if (useGameStore.getState().currentStep === 3) return;
        e.stopPropagation();
        onPeekToggle?.();
      }}
      onPointerOver={(e) => {
        if (useGameStore.getState().currentStep === 3) return;
        e.stopPropagation();
        setHovered(true);
        if (document.body.style.cursor !== 'grabbing') {
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={() => {
        setHovered(false);
        if (document.body.style.cursor === 'pointer') {
          document.body.style.cursor = 'auto';
        }
      }}
    >
      {/* 4 Plump Turned Honey-Wood Bun Feet with Brass Floor Ferrules strictly grounded at y = 0.000! */}
      {[-0.36, 0.36].map((fx, xi) =>
        [-0.21, 0.21].map((fz, zi) => (
          <group key={`foot-${xi}-${zi}`} position={[fx, 0, fz]}>
            <mesh position={[0, 0.022, 0]} material={brassMat} castShadow>
              <cylinderGeometry args={[0.044, 0.050, 0.044, 24]} />
            </mesh>
            <mesh position={[0, 0.102, 0]} scale={[1.05, 0.85, 1.05]} material={assets.woodFeetMat} castShadow receiveShadow>
              <sphereGeometry args={[0.082, 22, 16]} />
            </mesh>
          </group>
        ))
      )}

      {/* Pillowy Beveled Lower Base Skirt + Curved Storage Drawer (ZERO raw boxGeometry!) */}
      <mesh position={[0, 0.36, 0.0]} geometry={assets.lowerBaseGeo} material={assets.sageEnamelMat} castShadow receiveShadow />
      <mesh position={[0, 0.36, 0.345]} geometry={assets.drawerFrontGeo} material={assets.creamEnamelMat} castShadow />
      <mesh position={[0, 0.36, 0.388]} material={brassMat} castShadow>
        <sphereGeometry args={[0.026, 18, 14]} />
      </mesh>

      {/* Main Pillowy Beveled Back Cabinet strictly BEHIND interior liner (front face at z = -0.17 < -0.085!) */}
      <mesh position={[0, 1.04, -0.26]} geometry={assets.backShellGeo} material={assets.sageEnamelMat} castShadow receiveShadow />
      <mesh position={[-0.455, 1.14, 0.07]} geometry={assets.cheekGeo} material={assets.sageEnamelMat} castShadow receiveShadow />
      <mesh position={[0.455, 1.14, 0.07]} geometry={assets.cheekGeo} material={assets.sageEnamelMat} castShadow receiveShadow />

      {/* Pillowy Domed Crown Cap (front face sits cleanly at z = +0.35!) */}
      <mesh position={[0, 1.80, 0.0]} geometry={assets.topCrownGeo} material={assets.sageEnamelMat} castShadow receiveShadow />

      {/* Warm Cream Interior Cavity: 排除内部细鳍片/格栅描边，避免玻璃门内乱画黑线 */}
      <group position={[0, 1.14, 0.11]}>
        <mesh position={[0, 0, -0.195]} material={assets.evapWallMat} userData={{ excludeFromOutline: true }}>
          <planeGeometry args={[0.77, 1.04]} />
        </mesh>
        {[-0.30, -0.24, -0.18, -0.12, -0.06, 0.0, 0.06, 0.12, 0.18, 0.24, 0.30].map((fx, fi) => (
          <mesh key={`fin-${fi}`} position={[fx, -0.02, -0.188]} geometry={assets.evapFinGeo} material={assets.evapWallMat} userData={{ excludeFromOutline: true }} />
        ))}
        <mesh position={[0, 0.29, -0.179]} geometry={assets.evapGrilleGeo} material={stainlessMat} castShadow userData={{ excludeFromOutline: true }} />
        <mesh position={[0, 0.29, -0.186]} rotation={[Math.PI / 2, 0, 0]} material={brassMat} userData={{ excludeFromOutline: true }}>
          <cylinderGeometry args={[0.024, 0.028, 0.012, 20]} />
        </mesh>
        <mesh position={[0, -0.34, -0.179]} scale={[0.88, 0.56, 0.8]} geometry={assets.evapGrilleGeo} material={stainlessMat} userData={{ excludeFromOutline: true }} />
        <mesh position={[-0.366, 0.01, -0.176]} material={assets.ledCoveMat} userData={{ excludeFromOutline: true }}>
          <boxGeometry args={[0.012, 0.96, 0.012]} />
        </mesh>
        <mesh position={[0.366, 0.01, -0.176]} material={assets.ledCoveMat} userData={{ excludeFromOutline: true }}>
          <boxGeometry args={[0.012, 0.96, 0.012]} />
        </mesh>
        <mesh position={[0, 0.502, -0.04]} material={assets.ledCoveMat} userData={{ excludeFromOutline: true }}>
          <boxGeometry args={[0.66, 0.010, 0.016]} />
        </mesh>
        <mesh position={[-0.382, 0, 0]} rotation={[0, Math.PI / 2, 0]} userData={{ excludeFromOutline: true }}>
          <planeGeometry args={[0.40, 1.04]} />
          <meshStandardMaterial color="#F6ECDA" roughness={0.56} metalness={0.02} />
        </mesh>
        <mesh position={[0.382, 0, 0]} rotation={[0, -Math.PI / 2, 0]} userData={{ excludeFromOutline: true }}>
          <planeGeometry args={[0.40, 1.04]} />
          <meshStandardMaterial color="#F6ECDA" roughness={0.56} metalness={0.02} />
        </mesh>
        <mesh position={[0, 0.518, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ excludeFromOutline: true }}>
          <planeGeometry args={[0.77, 0.40]} />
          <meshStandardMaterial color="#FAF2E2" roughness={0.52} />
        </mesh>
        <mesh position={[0, -0.518, 0]} rotation={[-Math.PI / 2, 0, 0]} userData={{ excludeFromOutline: true }}>
          <planeGeometry args={[0.77, 0.40]} />
          <meshStandardMaterial color="#EFE3CE" roughness={0.56} metalness={0.02} />
        </mesh>
        <mesh position={[0, -0.510, -0.180]} material={assets.frostTrimMat} userData={{ excludeFromOutline: true }}>
          <boxGeometry args={[0.74, 0.014, 0.018]} />
        </mesh>
      </group>

      {/* 3 Chrome Wire Cooling Racks atop Beveled Glass Shelves (全部排除描边，杜绝细钢丝乱描黑线！) */}
      {[0.82, 1.12, 1.42].map((sy, sIdx) => (
        <group key={`shelf-${sIdx}`} position={[0, sy, 0.12]}>
          <mesh position={[0, 0, 0]} geometry={assets.shelfGlassGeo} material={assets.shelfGlassMat} userData={{ excludeFromOutline: true }} />
          <mesh position={[0, 0, 0.18]} geometry={assets.shelfRailGeo} material={assets.woodFeetMat} castShadow userData={{ excludeFromOutline: true }} />
          <mesh position={[0, 0.007, 0.158]} material={assets.frostTrimMat} userData={{ excludeFromOutline: true }}>
            <boxGeometry args={[0.72, 0.0025, 0.010]} />
          </mesh>
          <mesh position={[0, 0.0085, -0.155]} rotation={[0, 0, Math.PI / 2]} geometry={assets.wireRackSpanGeo} material={stainlessMat} userData={{ excludeFromOutline: true }} />
          <mesh position={[0, 0.0085, 0.155]} rotation={[0, 0, Math.PI / 2]} geometry={assets.wireRackSpanGeo} material={stainlessMat} userData={{ excludeFromOutline: true }} />
          {[-0.30, -0.24, -0.18, -0.12, -0.06, 0.0, 0.06, 0.12, 0.18, 0.24, 0.30].map((wx, wi) => (
            <mesh
              key={`wr-${wi}`}
              position={[wx, 0.0085, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              geometry={assets.wireRackDepthGeo}
              material={stainlessMat}
              userData={{ excludeFromOutline: true }}
            />
          ))}
        </group>
      ))}

      {/* Top Shelf: Faceted Crystal Cream Carafe with Brass Collar/Stopper + 2 Glazed Custard Ramekins */}
      <group position={[-0.20, 1.431, 0.12]}>
        <mesh position={[0, 0.005, 0]} geometry={assets.creamFillGeo} material={assets.ceramicCreamMat} />
        <mesh geometry={assets.milkCarafeGeo} material={assets.crystalCarafeMat} castShadow />
        <mesh position={[0, 0.172, 0]} material={brassMat}>
          <cylinderGeometry args={[0.029, 0.031, 0.012, 24]} />
        </mesh>
        <mesh position={[0, 0.188, 0]} material={brassMat} castShadow>
          <sphereGeometry args={[0.017, 16, 12]} />
        </mesh>
      </group>
      {[0.08, 0.22].map((rx, ri) => (
        <group key={`ram-${ri}`} position={[rx, 1.431, 0.14]}>
          <mesh geometry={assets.ramekinGeo} material={ri === 0 ? assets.ceramicBlushMat : assets.ceramicButterMat} castShadow />
          <mesh position={[0, 0.064, 0]} scale={[1, 0.55, 1]} material={assets.ceramicCreamMat}>
            <sphereGeometry args={[0.036, 16, 10]} />
          </mesh>
        </group>
      ))}

      {/* Bottom Shelf: Mini Chantilly Strawberry Cream Cake + Beveled Butter Dish */}
      <group position={[0.14, 0.831, 0.13]}>
        <mesh position={[0, 0.009, 0]} material={assets.ceramicCreamMat}>
          <cylinderGeometry args={[0.11, 0.092, 0.018, 28]} />
        </mesh>
        <mesh position={[0, 0.056, 0]} castShadow>
          <cylinderGeometry args={[0.078, 0.080, 0.076, 28]} />
          <meshPhysicalMaterial color="#FFF9ED" roughness={0.58} clearcoat={0} envMapIntensity={0.34} />
        </mesh>
        <group position={[0, 0.094, 0]}>
          <mesh geometry={assets.miniStrawberryGeo} castShadow>
            <meshPhysicalMaterial color="#DF3446" roughness={0.25} clearcoat={0} envMapIntensity={0.40} />
          </mesh>
          <mesh position={[0, 0.026, 0]} geometry={assets.strawberryCalyxGeo}>
            <meshStandardMaterial color="#548C3C" roughness={0.62} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>
      <group position={[-0.18, 0.831, 0.13]}>
        <mesh position={[0, 0.008, 0]} geometry={assets.butterDishGeo} material={assets.ceramicCreamMat} />
        <mesh position={[0, 0.039, 0]} geometry={assets.butterStickGeo}>
          <meshStandardMaterial color="#F5DC7E" roughness={0.48} envMapIntensity={0.32} />
        </mesh>
      </group>

      {/* Step 3 Interactive Fruit Jelly Insert Cooling on Middle Shelf (muted soft Ghibli fruit mousse gel) */}
      <group
        ref={jellyInsertRef}
        position={[0, 1.131, 0.14]}
        visible={currentStep <= 4 && (isChilling || _chillerProgress > 0 || currentStep === 3)}
      >
        <mesh geometry={assets.jellyRingGeo} material={assets.jellyRingMat} castShadow />
        <mesh position={[0, 0.018, 0]}>
          <cylinderGeometry args={[0.178, 0.178, 0.034, 40]} />
          <meshPhysicalMaterial
            ref={jellyInsertMatRef}
            color={jellyColor}
            roughness={0.28}
            clearcoat={0}
            envMapIntensity={0.40}
          />
        </mesh>
        <mesh ref={frostRimRef} position={[0, 0.036, 0]} rotation={[Math.PI / 2, 0, 0]} visible={_chillerProgress > 0.25}>
          <torusGeometry args={[0.180, 0.004, 10, 40]} />
          <meshStandardMaterial color="#D6ECFA" roughness={0.55} transparent opacity={0.72} />
        </mesh>
      </group>

      {/* Retro Analog Temp Dial & Brass Script Crest FLUSH against Front Crown (z = 0.352, PBR lit — ZERO white blowout!) */}
      <group position={[-0.25, 1.80, 0.352]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={brassMat} castShadow>
          <cylinderGeometry args={[0.066, 0.068, 0.022, 28]} />
        </mesh>
        <mesh position={[0, 0, 0.012]} material={assets.dialMat}>
          <circleGeometry args={[0.056, 28]} />
        </mesh>
      </group>
      <group position={[0.15, 1.80, 0.354]}>
        <mesh geometry={assets.badgePlaqueGeo} material={brassMat} castShadow />
        <mesh position={[0, 0, 0.008]} material={assets.badgeMat}>
          <planeGeometry args={[0.29, 0.088]} />
        </mesh>
      </group>

      {/* Hinged Rounded Arched Pastry Door with Strictly Contoured Arched Glass Pane */}
      <group ref={chillerDoorRef} position={[-0.46, 1.14, 0.36]}>
        <mesh position={[0.46, 0, -0.004]} geometry={assets.archedGlassGeo} userData={{ excludeFromOutline: true }}>
          <meshPhysicalMaterial
            color="#F5F2E8"
            transparent
            opacity={0.18}
            roughness={0.18}
            metalness={0.02}
            ior={1.48}
            reflectivity={0.32}
            clearcoat={0.16}
            clearcoatRoughness={0.22}
            specularIntensity={0.34}
            envMapIntensity={0.32}
          />
        </mesh>
        <mesh position={[0.46, 0, 0]} geometry={assets.doorOuterFrameGeo} material={assets.creamEnamelMat} castShadow />
        <mesh position={[0.84, 0.02, 0.024]} geometry={assets.handleCurveGeo} material={brassMat} castShadow />
        {[-0.36, 0.36].map((hy, hi) => (
          <mesh key={hi} position={[0.015, hy, 0.018]} material={brassMat}>
            <capsuleGeometry args={[0.014, 0.04, 8, 14]} />
          </mesh>
        ))}
      </group>

      {/* Pinned Illustrated Recipe Postcard Flush on Right Smooth Cheek (clean brass bar clip — zero awkward colored pegs!) */}
      <group position={[0.5315, 1.28, 0.06]} rotation={[0, Math.PI / 2, 0]}>
        <mesh rotation={[0, 0, 0.05]} material={assets.postcardMat}>
          <boxGeometry args={[0.17, 0.13, 0.003]} />
        </mesh>
        <mesh position={[0, 0.064, 0.004]} rotation={[0, 0, 0.05]} material={brassMat}>
          <boxGeometry args={[0.044, 0.008, 0.004]} />
        </mesh>
      </group>

      {/* Fridge Crown Styling: Hollow Lathe Woven Picnic Basket + Glazed Herb Planter with Connected Tube Vine Stem! */}
      <group position={[-0.22, 1.92, -0.02]} rotation={[0, 0.14, 0]}>
        <mesh geometry={assets.basketGeo} castShadow>
          <meshPhysicalMaterial
            map={craftAssets.wovenRattan.map}
            normalMap={craftAssets.wovenRattan.normalMap}
            roughnessMap={craftAssets.wovenRattan.roughnessMap}
            roughness={1.0}
            sheen={0.30}
            sheenColor="#F4DCB0"
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0.135, 0]} scale={[1.1, 0.42, 1.1]}>
          <sphereGeometry args={[0.118, 16, 10]} />
          <meshStandardMaterial map={craftAssets.ginghamTex} roughness={0.88} />
        </mesh>
      </group>
      <group position={[0.26, 1.92, 0.03]} rotation={[0, -0.18, 0]}>
        <mesh geometry={assets.planterGeo} castShadow>
          <meshStandardMaterial
            map={craftAssets.glazedPottery.map}
            normalMap={craftAssets.glazedPottery.normalMap}
            roughness={0.38}
          />
        </mesh>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((li) => {
          const a = (li / 8) * Math.PI * 2 + 0.2 * (li % 3);
          return (
            <group
              key={li}
              position={[Math.cos(a) * 0.042, 0.132, Math.sin(a) * 0.042]}
              rotation={[Math.sin(a) * 0.36, a, Math.cos(a) * 0.36]}
            >
              <mesh
                position={[0, 0.062, 0]}
                geometry={assets.rosemarySprigGeo}
                material={li % 2 === 0 ? assets.herbLeafMat : assets.herbLeafLightMat}
                castShadow
              />
              {li % 2 === 0 && (
                <mesh position={[0, 0.132, 0]} geometry={assets.chamomileGeo} material={assets.chamomileMat} />
              )}
            </group>
          );
        })}
        {/* Real Curved Vine Stem + Attached Trailing Ivy Leaves (ZERO floating leaves!) */}
        <mesh geometry={assets.vineStemGeo} material={assets.vineStemMat} />
        {assets.vinePoints.map((pt, ti) => (
          <mesh
            key={`vine-leaf-${ti}`}
            position={[pt.x, pt.y, pt.z]}
            rotation={[0.45, ti * 0.95, 0.32]}
            scale={[1.15, 0.24, 0.72]}
            geometry={assets.leafGeo}
            material={ti % 2 === 0 ? assets.herbLeafMat : assets.herbLeafLightMat}
          />
        ))}
      </group>

      {/* Step 3 Cryo Frost Mist Particles */}
      <group visible={isChillerOpen}>
        <points ref={mistParticlesRef} geometry={cryoParticlesGeo} visible={isChillerOpen} raycast={() => null}>
          <pointsMaterial
            map={cryoMistTex}
            color="#FFF6E6"
            size={0.060}
            transparent
            opacity={isChillerOpen ? 0.22 : 0}
            alphaTest={0.01}
            depthWrite={false}
          />
        </points>
        <mesh position={[0, 0.96, 0.50]} visible={isChillerOpen} material={cryoMistMat} raycast={() => null}>
          <planeGeometry args={[0.98, 0.84, 8, 8]} />
        </mesh>
      </group>
    </group>
  );
};

/**
 * ITERATION 1 RED-TEAM HARDENED:
 * Full Rounded Cozy Appliances Pack — 100% Beveled Furniture, Turned Lathe Legs,
 * Real Hollow Lathe Pottery/Cups, Brushed PBR Metals, Wood Grain, Handwritten Canisters,
 * Soft Steam Sprites & Zero Collisions/Floating!
 */
export const RoundedCottageAppliancesPack: React.FC<{
  onRadioToggle?: () => void;
  onKettleTap?: () => void;
  radioPlaying?: boolean;
}> = ({ onRadioToggle, onKettleTap, radioPlaying = false }) => {
  const craftAssets = useMemo(() => getCottageCraftAssets(), []);
  const radioNoteRef = useRef<THREE.Group>(null);

  const assets = useMemo(() => {
    const oakPbr = createWoodGrainPbr('#B67F4E', '#7A4B26', 401);
    const walnutPbr = createWoodGrainPbr('#764B2C', '#462814', 402);
    const enamelMicro = createMicroSurfaceMaps(0.36, 0.07, false, 403);
    const metalMicro = createMicroSurfaceMaps(0.28, 0.08, true, 404);
    const speakerFabric = createWovenFabricPbr('#E6D2AE', '#B69A6E', 405);
    const radioDialTex = createRadioDialTexture();
    const scaleDialTex = createPastelRetroDialTexture('五百克', '#6D9AA4', '250克');

    const farineTex = createCanisterCeramicTexture('低筋面粉', '#FAF0DC', '#C29A64');
    const sucreTex = createCanisterCeramicTexture('细砂糖', '#D8E6D3', '#7E9E78');
    const theTex = createCanisterCeramicTexture('洋甘菊茶', '#F6D8CE', '#C8847A');

    // Beveled Furniture & Turned Baluster Legs (24 segments!)
    const nwCounterTopGeo = createBeveledBoxGeometry(1.36, 0.040, 0.80, 0.022, 0.008, 0.008, 3);
    const nwLowerShelfGeo = createBeveledBoxGeometry(1.26, 0.028, 0.66, 0.016, 0.005, 0.005, 2);
    const nwLegGeo = createTurnedBalusterLegGeo(0.91, 0.034);

    // Wider 1.24m Rolling Coffee & Pastry Cart (gives Espresso + 2-Tier Stand + Radio generous clearance!)
    const cartTopGeo = createBeveledBoxGeometry(1.24, 0.038, 0.56, 0.024, 0.008, 0.008, 3);
    const cartLowerGeo = createBeveledBoxGeometry(1.16, 0.028, 0.50, 0.018, 0.005, 0.005, 2);
    const cartLegGeo = createTurnedBalusterLegGeo(0.75, 0.024);

    // Curved Brass Cart Push-Handle Brackets (bolts solidly into cart edge — ZERO floating!)
    const bracketCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.0, -0.05, 0),
      new THREE.Vector3(-0.045, -0.03, 0),
      new THREE.Vector3(-0.068, 0.04, 0),
    ]);
    const cartBracketGeo = new THREE.TubeGeometry(bracketCurve, 14, 0.010, 10, false);

    // Beveled Appliance Bodies & Hollow Lathe Vessels
    const espressoBaseGeo = createBeveledBoxGeometry(0.28, 0.044, 0.29, 0.028, 0.008, 0.008, 3);
    const espressoCupGeo = createHollowVesselLatheGeo(0.021, 0.029, 0.028, 0.048, 0.0035, 24);
    const plateGeo = createHollowVesselLatheGeo(0.088, 0.112, 0.118, 0.018, 0.004, 28);
    const tartOvenGeo = createPillowyCabinetGeo(0.46, 0.30, 0.34, 0.075, 0.028);
    const waffleBodyGeo = createPillowyCabinetGeo(0.25, 0.098, 0.23, 0.085, 0.022);
    const radioBodyGeo = createPillowyCabinetGeo(0.30, 0.24, 0.18, 0.078, 0.022);

    // Concave Lathe Weighing Pan for Vintage Mint Scale
    const scalePanGeo = createHollowVesselLatheGeo(0.056, 0.095, 0.112, 0.036, 0.004, 28);
    const canisterGeo = createHollowVesselLatheGeo(0.056, 0.064, 0.058, 0.150, 0.006, 28);
    const butterBellGeo = createHollowVesselLatheGeo(0.044, 0.052, 0.046, 0.082, 0.005, 24);
    const utensilCrockGeo = createHollowVesselLatheGeo(0.048, 0.056, 0.054, 0.142, 0.006, 26);
    const breadboxGeo = createBreadboxRollTopGeometry(0.28, 0.145, 0.19);
    const rollingPinGeo = createRollingPinGeometry(0.20, 0.022);
    const utensilHandleGeo = createTurnedHandleGeometry(0.145, 0.010);
    const whiskWiresGeo = createWireWhiskWiresGeometry(5, 0.125, 0.028);
    const basketGeo = createHollowVesselLatheGeo(0.125, 0.158, 0.162, 0.145, 0.010, 28);
    const pitcherGeo = createHollowVesselLatheGeo(0.078, 0.108, 0.082, 0.22, 0.007, 28);

    // Genuine Sculpted Bellied Copper Kettle + Curved S-Tube Gooseneck Spout!
    const kettleBodyGeo = createBelliedKettleBodyGeo(0.096, 0.145);
    const spoutCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.082, 0.055, 0),
      new THREE.Vector3(0.128, 0.092, 0),
      new THREE.Vector3(0.146, 0.148, 0),
      new THREE.Vector3(0.168, 0.162, 0),
    ]);
    const kettleSpoutGeo = new THREE.TubeGeometry(spoutCurve, 20, 0.011, 12, false);
    const strawberryGeo = createMiniStrawberryGeometry(0.018, 0.028);

    // Shared High-Craft PBR Materials (calibrated roughness = 1.0 wherever roughnessMap is bound!)
    const oakWoodMat = new THREE.MeshStandardMaterial({
      map: oakPbr.map,
      bumpMap: oakPbr.bumpMap,
      bumpScale: 0.005,
      roughnessMap: oakPbr.roughnessMap,
      roughness: 1.0,
      envMapIntensity: 0.34,
    });
    const walnutWoodMat = new THREE.MeshStandardMaterial({
      map: walnutPbr.map,
      bumpMap: walnutPbr.bumpMap,
      bumpScale: 0.005,
      roughnessMap: walnutPbr.roughnessMap,
      roughness: 1.0,
      envMapIntensity: 0.34,
    });
    const sageEnamelMat = enhanceWithStylizedFresnelRim(
      new THREE.MeshPhysicalMaterial({
        color: '#A9C5A8',
        roughness: 1.0,
        roughnessMap: enamelMicro.roughnessMap,
        bumpMap: enamelMicro.bumpMap,
        bumpScale: 0.0018,
        metalness: 0.03,
        clearcoat: 0.16,
        clearcoatRoughness: 0.30,
        envMapIntensity: 0.38,
      }),
      { rimColor: '#FFE8BC', rimStrength: 0.32, rimPower: 2.6, topBias: 0.44, cacheTag: 'app-sage-rim' }
    );
    const blushEnamelMat = enhanceWithStylizedFresnelRim(
      new THREE.MeshPhysicalMaterial({
        color: '#F2B8B0',
        roughness: 1.0,
        roughnessMap: enamelMicro.roughnessMap,
        bumpMap: enamelMicro.bumpMap,
        bumpScale: 0.0018,
        metalness: 0.03,
        clearcoat: 0.16,
        clearcoatRoughness: 0.30,
        envMapIntensity: 0.38,
      }),
      { rimColor: '#FFE8C2', rimStrength: 0.30, rimPower: 2.6, topBias: 0.44, cacheTag: 'app-blush-rim' }
    );
    const creamEnamelMat = enhanceWithStylizedFresnelRim(
      new THREE.MeshPhysicalMaterial({
        color: '#F8EEDB',
        roughness: 1.0,
        roughnessMap: enamelMicro.roughnessMap,
        bumpMap: enamelMicro.bumpMap,
        bumpScale: 0.0016,
        metalness: 0.02,
        clearcoat: 0.16,
        clearcoatRoughness: 0.32,
        envMapIntensity: 0.38,
      }),
      { rimColor: '#FFE4B0', rimStrength: 0.28, rimPower: 2.7, topBias: 0.42, cacheTag: 'app-cream-rim' }
    );
    const butterYellowEnamelMat = enhanceWithStylizedFresnelRim(
      new THREE.MeshPhysicalMaterial({
        color: '#F3D27A',
        roughness: 1.0,
        roughnessMap: enamelMicro.roughnessMap,
        bumpMap: enamelMicro.bumpMap,
        bumpScale: 0.0016,
        metalness: 0.03,
        clearcoat: 0.18,
        clearcoatRoughness: 0.30,
        envMapIntensity: 0.38,
      }),
      { rimColor: '#FFF0C4', rimStrength: 0.30, rimPower: 2.6, topBias: 0.44, cacheTag: 'app-butter-rim' }
    );
    const utensilCrockMat = enhanceWithStylizedFresnelRim(
      new THREE.MeshPhysicalMaterial({
        color: '#F6EEDF',
        roughness: 1.0,
        roughnessMap: enamelMicro.roughnessMap,
        bumpMap: enamelMicro.bumpMap,
        bumpScale: 0.0018,
        metalness: 0.02,
        clearcoat: 0.18,
        clearcoatRoughness: 0.30,
        envMapIntensity: 0.38,
      }),
      { rimColor: '#FFE4B0', rimStrength: 0.30, rimPower: 2.6, topBias: 0.44, cacheTag: 'app-crock-rim' }
    );
    const warmBrassMat = enhanceWithStylizedFresnelRim(
      new THREE.MeshStandardMaterial({
        color: '#C8A258',
        metalness: 0.78,
        roughness: 1.0,
        roughnessMap: metalMicro.roughnessMap,
        bumpMap: metalMicro.bumpMap,
        bumpScale: 0.0016,
        envMapIntensity: 0.50,
      }),
      { rimColor: '#FFE6B4', rimStrength: 0.32, rimPower: 2.6, topBias: 0.42, cacheTag: 'app-brass-rim' }
    );
    const brushedChromeMat = new THREE.MeshStandardMaterial({
      color: '#E4E2DC',
      metalness: 0.80,
      roughness: 1.0,
      roughnessMap: metalMicro.roughnessMap,
      bumpMap: metalMicro.bumpMap,
      bumpScale: 0.0014,
      envMapIntensity: 0.52,
    });
    const hammeredCopperMat = enhanceWithStylizedFresnelRim(
      new THREE.MeshStandardMaterial({
        color: '#D48050',
        metalness: 0.80,
        roughness: 1.0,
        roughnessMap: metalMicro.roughnessMap,
        bumpMap: enamelMicro.bumpMap,
        bumpScale: 0.0032,
        envMapIntensity: 0.52,
      }),
      { rimColor: '#FFD8A2', rimStrength: 0.38, rimPower: 2.4, topBias: 0.45, cacheTag: 'app-copper-kettle-rim' }
    );
    const speakerMat = new THREE.MeshStandardMaterial({
      map: speakerFabric.map,
      bumpMap: speakerFabric.bumpMap,
      bumpScale: 0.004,
      roughnessMap: speakerFabric.roughnessMap,
      roughness: 1.0,
      envMapIntensity: 0.30,
    });
    const radioDialMat = new THREE.MeshStandardMaterial({
      map: radioDialTex,
      emissiveMap: radioDialTex,
      emissive: '#FFA838',
      emissiveIntensity: 0.52,
      roughness: 0.44,
    });
    const scaleDialMat = new THREE.MeshStandardMaterial({
      map: scaleDialTex,
      roughness: 0.48,
    });
    const strawberryMat = new THREE.MeshPhysicalMaterial({
      color: '#DE3446',
      roughness: 0.28,
      bumpMap: enamelMicro.bumpMap,
      bumpScale: 0.003,
      clearcoat: 0,
      envMapIntensity: 0.40,
    });
    const canisterMats = [farineTex, sucreTex, theTex].map(
      (tex) =>
        new THREE.MeshPhysicalMaterial({
          map: tex,
          roughness: 1.0,
          roughnessMap: enamelMicro.roughnessMap,
          bumpMap: enamelMicro.bumpMap,
          bumpScale: 0.0018,
          clearcoat: 0.16,
          clearcoatRoughness: 0.32,
          envMapIntensity: 0.38,
        })
    );
    const cupBlushMat = new THREE.MeshPhysicalMaterial({
      color: '#F5CFC6',
      roughness: 1.0,
      roughnessMap: enamelMicro.roughnessMap,
      bumpMap: enamelMicro.bumpMap,
      bumpScale: 0.0016,
      clearcoat: 0.16,
      clearcoatRoughness: 0.32,
      envMapIntensity: 0.38,
    });
    const cupCreamMat = new THREE.MeshPhysicalMaterial({
      color: '#FAF0D6',
      roughness: 1.0,
      roughnessMap: enamelMicro.roughnessMap,
      bumpMap: enamelMicro.bumpMap,
      bumpScale: 0.0016,
      clearcoat: 0.16,
      clearcoatRoughness: 0.32,
      envMapIntensity: 0.38,
    });
    const cupSageMat = new THREE.MeshPhysicalMaterial({
      color: '#D6E4D2',
      roughness: 1.0,
      roughnessMap: enamelMicro.roughnessMap,
      bumpMap: enamelMicro.bumpMap,
      bumpScale: 0.0016,
      clearcoat: 0.16,
      clearcoatRoughness: 0.32,
      envMapIntensity: 0.38,
    });
    return {
      oakPbr,
      walnutPbr,
      enamelMicro,
      metalMicro,
      speakerFabric,
      radioDialTex,
      scaleDialTex,
      farineTex,
      sucreTex,
      theTex,
      nwCounterTopGeo,
      nwLowerShelfGeo,
      nwLegGeo,
      cartTopGeo,
      cartLowerGeo,
      cartLegGeo,
      cartBracketGeo,
      espressoBaseGeo,
      espressoCupGeo,
      plateGeo,
      tartOvenGeo,
      waffleBodyGeo,
      radioBodyGeo,
      scalePanGeo,
      canisterGeo,
      butterBellGeo,
      utensilCrockGeo,
      breadboxGeo,
      rollingPinGeo,
      utensilHandleGeo,
      whiskWiresGeo,
      basketGeo,
      pitcherGeo,
      kettleBodyGeo,
      kettleSpoutGeo,
      strawberryGeo,
      oakWoodMat,
      walnutWoodMat,
      sageEnamelMat,
      blushEnamelMat,
      creamEnamelMat,
      butterYellowEnamelMat,
      utensilCrockMat,
      warmBrassMat,
      brushedChromeMat,
      hammeredCopperMat,
      speakerMat,
      radioDialMat,
      scaleDialMat,
      strawberryMat,
      canisterMats,
      cupBlushMat,
      cupCreamMat,
      cupSageMat,
    };
  }, []);

  useEffect(() => {
    return () => {
      assets.oakPbr.map.dispose();
      assets.oakPbr.bumpMap.dispose();
      assets.oakPbr.roughnessMap.dispose();
      assets.walnutPbr.map.dispose();
      assets.walnutPbr.bumpMap.dispose();
      assets.walnutPbr.roughnessMap.dispose();
      assets.enamelMicro.bumpMap.dispose();
      assets.enamelMicro.roughnessMap.dispose();
      assets.metalMicro.bumpMap.dispose();
      assets.metalMicro.roughnessMap.dispose();
      assets.speakerFabric.map.dispose();
      assets.speakerFabric.bumpMap.dispose();
      assets.speakerFabric.roughnessMap.dispose();
      assets.radioDialTex.dispose();
      assets.scaleDialTex.dispose();
      assets.farineTex.dispose();
      assets.sucreTex.dispose();
      assets.theTex.dispose();
      assets.nwCounterTopGeo.dispose();
      assets.nwLowerShelfGeo.dispose();
      assets.nwLegGeo.dispose();
      assets.cartTopGeo.dispose();
      assets.cartLowerGeo.dispose();
      assets.cartLegGeo.dispose();
      assets.cartBracketGeo.dispose();
      assets.espressoBaseGeo.dispose();
      assets.espressoCupGeo.dispose();
      assets.plateGeo.dispose();
      assets.tartOvenGeo.dispose();
      assets.waffleBodyGeo.dispose();
      assets.radioBodyGeo.dispose();
      assets.scalePanGeo.dispose();
      assets.canisterGeo.dispose();
      assets.butterBellGeo.dispose();
      assets.utensilCrockGeo.dispose();
      assets.breadboxGeo.dispose();
      assets.rollingPinGeo.dispose();
      assets.utensilHandleGeo.dispose();
      assets.whiskWiresGeo.dispose();
      assets.basketGeo.dispose();
      assets.pitcherGeo.dispose();
      assets.kettleBodyGeo.dispose();
      assets.kettleSpoutGeo.dispose();
      assets.strawberryGeo.dispose();
      assets.oakWoodMat.dispose();
      assets.walnutWoodMat.dispose();
      assets.sageEnamelMat.dispose();
      assets.blushEnamelMat.dispose();
      assets.creamEnamelMat.dispose();
      assets.butterYellowEnamelMat.dispose();
      assets.utensilCrockMat.dispose();
      assets.warmBrassMat.dispose();
      assets.brushedChromeMat.dispose();
      assets.hammeredCopperMat.dispose();
      assets.speakerMat.dispose();
      assets.radioDialMat.dispose();
      assets.scaleDialMat.dispose();
      assets.strawberryMat.dispose();
      assets.canisterMats.forEach((m) => m.dispose());
      assets.cupBlushMat.dispose();
      assets.cupCreamMat.dispose();
      assets.cupSageMat.dispose();
      if (document.body.style.cursor === 'pointer') {
        document.body.style.cursor = 'auto';
      }
    };
  }, [assets]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    assets.radioDialMat.emissiveIntensity = radioPlaying ? 0.72 : 0.32;
    if (radioNoteRef.current) {
      radioNoteRef.current.visible = radioPlaying;
      if (radioPlaying) {
        radioNoteRef.current.position.y = 0.27 + Math.sin(t * 2.6) * 0.04;
        radioNoteRef.current.rotation.y = t * 1.4;
      }
    }
  });

  return (
    <group>
      {/* ====================================================================
          0A. BEVELED HONEY-OAK NORTH-WEST PREP COUNTER EXTENSION
              Top strictly at y = 0.930m — 0.000m seamless flush join with Left Workbench!
         ==================================================================== */}
      <group position={[-3.95, 0, -2.96]}>
        {[-0.60, 0.60].map((lx, xi) =>
          [-0.32, 0.32].map((lz, zi) => (
            <mesh
              key={`nwleg-${xi}-${zi}`}
              position={[lx, 0, lz]}
              geometry={assets.nwLegGeo}
              material={assets.oakWoodMat}
              castShadow
              receiveShadow
            />
          ))
        )}
        <mesh position={[0, 0.23, 0]} geometry={assets.nwLowerShelfGeo} material={assets.oakWoodMat} castShadow receiveShadow />
        <mesh position={[0, 0.910, 0]} geometry={assets.nwCounterTopGeo} material={assets.oakWoodMat} castShadow receiveShadow />
        {/* Lower Shelf Hollow Lathe Basket & Glazed Pitcher */}
        <mesh position={[-0.34, 0.244, 0.02]} rotation={[0, 0.22, 0]} geometry={assets.basketGeo} castShadow>
          <meshStandardMaterial
            map={craftAssets.wovenRattan.map}
            normalMap={craftAssets.wovenRattan.normalMap}
            roughness={0.85}
          />
        </mesh>
        <mesh position={[0.26, 0.244, -0.02]} rotation={[0, -0.18, 0]} geometry={assets.pitcherGeo} castShadow>
          <meshStandardMaterial
            map={craftAssets.glazedPottery.map}
            normalMap={craftAssets.glazedPottery.normalMap}
            roughness={0.36}
          />
        </mesh>
      </group>

      {/* ====================================================================
          0B. WIDER 1.24m BEVELED ROLLING COFFEE & PASTRY CART (`[3.82, 0, -2.08]`)
              Zero overlap between Espresso (-0.42), 2-Tier Stand (0.00) & Radio (+0.43)!
              Bolted Brass Push Handle + Real Caster Forks grounded strictly at y = 0.000!
         ==================================================================== */}
      <group position={[3.82, 0, -2.08]} rotation={[0, -0.32, 0]}>
        {[-0.54, 0.54].map((lx, xi) =>
          [-0.22, 0.22].map((lz, zi) => (
            <group key={`cleg-${xi}-${zi}`} position={[lx, 0, lz]}>
              {/* Brass Caster Fork & Rubber Wheel grounded strictly at y = 0.000 */}
              <mesh position={[0, 0.038, 0]} rotation={[0, 0, Math.PI / 2]} material={assets.warmBrassMat} castShadow>
                <cylinderGeometry args={[0.038, 0.038, 0.022, 20]} />
              </mesh>
              <mesh position={[0, 0.068, 0]} material={assets.warmBrassMat}>
                <cylinderGeometry args={[0.018, 0.026, 0.038, 16]} />
              </mesh>
              <mesh position={[0, 0.085, 0]} geometry={assets.cartLegGeo} material={assets.oakWoodMat} castShadow />
            </group>
          ))
        )}
        <mesh position={[0, 0.26, 0]} geometry={assets.cartLowerGeo} material={assets.oakWoodMat} castShadow receiveShadow />
        <mesh position={[0, 0.84, 0]} geometry={assets.cartTopGeo} material={assets.oakWoodMat} castShadow receiveShadow />

        {/* Bolted Curved Brass Push Handle with 2 Solid Side Brackets (ZERO floating!) */}
        {[-0.21, 0.21].map((hz, hi) => (
          <mesh key={`hbrk-${hi}`} position={[-0.61, 0.875, hz]} geometry={assets.cartBracketGeo} material={assets.warmBrassMat} castShadow />
        ))}
        <mesh position={[-0.678, 0.915, 0]} rotation={[Math.PI / 2, 0, 0]} material={assets.warmBrassMat} castShadow>
          <capsuleGeometry args={[0.012, 0.42, 8, 14]} />
        </mesh>

        {/* Lower Cart Shelf: Stacked Hollow Lathe Plates & Woven Napkin Basket */}
        {[0, 1, 2, 3].map((pi) => (
          <mesh
            key={pi}
            position={[-0.30, 0.274 + pi * 0.018, 0.01]}
            geometry={assets.plateGeo}
            material={pi % 2 === 0 ? assets.cupCreamMat : assets.cupSageMat}
            castShadow
          />
        ))}
        <mesh position={[0.30, 0.274, -0.01]} rotation={[0, 0.28, 0]} geometry={assets.basketGeo} castShadow>
          <meshStandardMaterial
            map={craftAssets.wovenRattan.map}
            normalMap={craftAssets.wovenRattan.normalMap}
            roughness={0.85}
          />
        </mesh>

        {/* PASTEL SAGE ROUNDED ITALIAN ESPRESSO MACHINE (Left bay x = -0.43, ZERO overlap!) */}
        <group position={[-0.43, 0.859, -0.01]} rotation={[0, 0.16, 0]}>
          <mesh position={[0, 0.022, 0.02]} geometry={assets.espressoBaseGeo} material={assets.brushedChromeMat} castShadow />
          {/* Curved Sage Enamel Tower */}
          <mesh position={[0, 0.21, -0.04]} material={assets.sageEnamelMat} castShadow receiveShadow>
            <cylinderGeometry args={[0.128, 0.134, 0.34, 28]} />
          </mesh>
          {/* Flat Brushed-Brass Cup-Warmer Deck atop Espresso Tower (y = 0.382 — cups sit 100% FLUSH!) */}
          <mesh position={[0, 0.384, -0.04]} material={assets.warmBrassMat} castShadow>
            <cylinderGeometry args={[0.132, 0.128, 0.016, 28]} />
          </mesh>
          <mesh position={[0, 0.402, -0.04]} rotation={[Math.PI / 2, 0, 0]} material={assets.warmBrassMat}>
            <torusGeometry args={[0.124, 0.005, 8, 28]} />
          </mesh>
          {/* Brass Brew Head Collar + Connected Portafilter Basket & Walnut Handle */}
          <mesh position={[0, 0.23, 0.095]} rotation={[Math.PI / 2, 0, 0]} material={assets.warmBrassMat} castShadow>
            <cylinderGeometry args={[0.044, 0.044, 0.056, 24]} />
          </mesh>
          <mesh position={[0, 0.185, 0.105]} material={assets.brushedChromeMat} castShadow>
            <cylinderGeometry args={[0.036, 0.030, 0.042, 20]} />
          </mesh>
          <mesh position={[0, 0.185, 0.175]} rotation={[Math.PI / 2, 0, 0]} material={assets.walnutWoodMat} castShadow>
            <capsuleGeometry args={[0.013, 0.10, 8, 14]} />
          </mesh>
          {/* PBR Pressure Gauge */}
          <mesh position={[0, 0.305, 0.090]} rotation={[Math.PI / 2, 0, 0]} material={assets.warmBrassMat}>
            <cylinderGeometry args={[0.034, 0.034, 0.014, 22]} />
          </mesh>
          <mesh position={[0, 0.305, 0.098]} material={assets.scaleDialMat}>
            <circleGeometry args={[0.028, 22]} />
          </mesh>
          {/* Curved Chrome Steam Wand */}
          <mesh position={[0.092, 0.155, 0.088]} rotation={[0.25, 0, -0.22]} material={assets.brushedChromeMat}>
            <cylinderGeometry args={[0.005, 0.005, 0.14, 12]} />
          </mesh>
          {/* 2 Hollow Lathe Espresso Cups resting FLUSH on Cup-Warmer Deck + 1 Brewing on Drip Grate */}
          {[
            { p: [-0.046, 0.392, -0.04] as [number, number, number], m: assets.cupBlushMat },
            { p: [0.048, 0.392, -0.05] as [number, number, number], m: assets.cupCreamMat },
            { p: [0.0, 0.044, 0.105] as [number, number, number], m: assets.cupCreamMat },
          ].map((c, ci) => (
            <group key={`ecup-${ci}`} position={c.p} rotation={[0, ci * 0.9, 0]}>
              <mesh geometry={assets.espressoCupGeo} material={c.m} castShadow />
              <mesh position={[0.028, 0.028, 0]} material={c.m}>
                <torusGeometry args={[0.012, 0.0032, 8, 16]} />
              </mesh>
            </group>
          ))}
        </group>

        {/* VINTAGE WALNUT CATHEDRAL BAKERY RADIO (Right bay x = +0.43, ZERO overlap!) */}
        <group
          position={[0.43, 0.859, -0.02]}
          rotation={[0, -0.22, 0]}
          onClick={(e) => {
            if (e.delta > 5) return;
            e.stopPropagation();
            onRadioToggle?.();
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            if (document.body.style.cursor !== 'grabbing') {
              document.body.style.cursor = 'pointer';
            }
          }}
          onPointerOut={() => {
            if (document.body.style.cursor === 'pointer') {
              document.body.style.cursor = 'auto';
            }
          }}
        >
          <mesh position={[0, 0.12, 0]} geometry={assets.radioBodyGeo} material={assets.walnutWoodMat} castShadow receiveShadow />
          {/* Woven Fabric Speaker Grille + Brass Bezel */}
          <mesh position={[0, 0.142, 0.092]} material={assets.speakerMat}>
            <planeGeometry args={[0.195, 0.105]} />
          </mesh>
          {/* Warm Backlit Analog Tuning Dial (PBR textured scale + coral needle!) */}
          <mesh position={[0, 0.056, 0.093]} material={assets.radioDialMat}>
            <planeGeometry args={[0.16, 0.038]} />
          </mesh>
          {[-0.102, 0.102].map((kx, ki) => (
            <mesh key={ki} position={[kx, 0.056, 0.098]} rotation={[Math.PI / 2, 0, 0]} material={assets.warmBrassMat}>
              <cylinderGeometry args={[0.015, 0.017, 0.018, 18]} />
            </mesh>
          ))}
          <group ref={radioNoteRef} position={[0, 0.28, 0]} visible={radioPlaying}>
            <mesh position={[-0.03, 0, 0]}>
              <sphereGeometry args={[0.022, 12, 10]} />
              <meshStandardMaterial color="#FFE280" emissive="#FFB020" emissiveIntensity={0.68} />
            </mesh>
            <mesh position={[0.03, 0.05, 0]}>
              <sphereGeometry args={[0.018, 12, 10]} />
              <meshStandardMaterial color="#F8B4C4" emissive="#FF7496" emissiveIntensity={0.62} />
            </mesh>
          </group>
        </group>
      </group>

      {/* ====================================================================
          1. PILLOWY CREAM MINI TARTLET & TOAST OVEN (NW Counter Left, y = 0.930m!)
         ==================================================================== */}
      <group position={[-4.34, 0.930, -3.02]} rotation={[0, 0.24, 0]}>
        <mesh position={[0, 0.166, 0]} geometry={assets.tartOvenGeo} material={assets.creamEnamelMat} castShadow receiveShadow />
        {[-0.16, 0.16].map((fx, xi) =>
          [-0.10, 0.10].map((fz, zi) => (
            <mesh key={`tf-${xi}-${zi}`} position={[fx, 0.018, fz]} material={assets.oakWoodMat}>
              <sphereGeometry args={[0.022, 14, 10]} />
            </mesh>
          ))
        )}
        <mesh position={[-0.05, 0.172, 0.172]}>
          <planeGeometry args={[0.26, 0.16]} />
          <meshStandardMaterial color="#F6DAA2" emissive="#FF9E3A" emissiveIntensity={0.34} roughness={0.38} />
        </mesh>
        <mesh position={[-0.05, 0.264, 0.188]} rotation={[0, 0, Math.PI / 2]} material={assets.oakWoodMat}>
          <capsuleGeometry args={[0.011, 0.19, 8, 12]} />
        </mesh>
        {[0.20, 0.13].map((ky, ki) => (
          <mesh key={ki} position={[0.145, ky, 0.175]} rotation={[Math.PI / 2, 0, 0]} material={assets.oakWoodMat}>
            <cylinderGeometry args={[0.022, 0.024, 0.022, 18]} />
          </mesh>
        ))}
      </group>

      {/* ====================================================================
          2. BLUSH-PINK ROUNDED WAFFLE MAKER (NW Counter Back-Center, y = 0.930m!)
         ==================================================================== */}
      <group position={[-3.90, 0.930, -3.16]} rotation={[0, -0.14, 0]}>
        <mesh position={[0, 0.050, 0]} geometry={assets.waffleBodyGeo} material={assets.blushEnamelMat} castShadow receiveShadow />
        <mesh position={[0, 0.064, 0.125]} rotation={[0, 0, Math.PI / 2]} material={assets.oakWoodMat}>
          <capsuleGeometry args={[0.014, 0.09, 8, 12]} />
        </mesh>
        <mesh position={[0.055, 0.102, 0.055]}>
          <sphereGeometry args={[0.009, 10, 8]} />
          <meshStandardMaterial color="#F8DC88" emissive="#FFA82E" emissiveIntensity={0.44} />
        </mesh>
      </group>

      {/* ====================================================================
          3. VINTAGE MINT DIAL KITCHEN SCALE (CRITICAL #4 FIXED — Bezel properly rotated!)
         ==================================================================== */}
      <group position={[-4.24, 0.930, -2.68]} rotation={[0, 0.42, 0]}>
        <mesh position={[0, 0.070, 0]} material={assets.sageEnamelMat} castShadow>
          <cylinderGeometry args={[0.068, 0.088, 0.14, 28]} />
        </mesh>
        {/* Fixed Math.PI/2 - 0.12 rotation: Chrome bezel frames vertical dial face cleanly! */}
        <mesh position={[0, 0.078, 0.072]} rotation={[Math.PI / 2 - 0.12, 0, 0]} material={assets.brushedChromeMat}>
          <cylinderGeometry args={[0.048, 0.048, 0.016, 26]} />
        </mesh>
        <mesh position={[0, 0.079, 0.081]} rotation={[-0.12, 0, 0]} material={assets.scaleDialMat}>
          <circleGeometry args={[0.042, 26]} />
        </mesh>
        <mesh position={[0, 0.140, 0]} geometry={assets.scalePanGeo} material={assets.brushedChromeMat} castShadow />
        {/* Shared strawberry geometry + PBR material (ZERO duplicate PhysicalMaterial!) */}
        {[
          [-0.028, 0.166, 0.012],
          [0.030, 0.166, -0.018],
          [0.008, 0.184, 0.024],
          [-0.016, 0.164, -0.028],
        ].map(([sx, sy, sz], si) => (
          <mesh
            key={si}
            position={[sx, sy, sz]}
            rotation={[0.2 * si, si * 1.1, -0.15]}
            scale={[0.92, 1.18, 0.92]}
            geometry={assets.strawberryGeo}
            material={assets.strawberryMat}
            castShadow
          />
        ))}
      </group>

      {/* ====================================================================
          4. HANDWRITTEN FRENCH CERAMIC CANISTER TRIO (`Farine / Sucre / Thé` — Facing +Z Player!)
             LatheGeometry u=0.5 faces -Z, so Math.PI + can.rotY turns all 3 labels directly toward player!
         ==================================================================== */}
      {[
        { x: -3.62, sc: 1.06, rotY: 0.10 },
        { x: -3.46, sc: 0.94, rotY: -0.06 },
        { x: -3.33, sc: 0.84, rotY: 0.14 },
      ].map((can, ci) => (
        <group key={`canister-${ci}`} position={[can.x, 0.930, -3.22]} rotation={[0, Math.PI + can.rotY, 0]} scale={can.sc}>
          <mesh geometry={assets.canisterGeo} material={assets.canisterMats[ci]} castShadow />
          <mesh position={[0, 0.154, 0]} material={assets.oakWoodMat} castShadow>
            <cylinderGeometry args={[0.058, 0.060, 0.022, 24]} />
          </mesh>
          <mesh position={[0, 0.178, 0]} material={assets.oakWoodMat}>
            <sphereGeometry args={[0.018, 14, 10]} />
          </mesh>
        </group>
      ))}

      {/* ====================================================================
          5. SCULPTED LATHE BELLIED COPPER TEA KETTLE + SOFT SPRITE STEAM!
         ==================================================================== */}
      <group
        position={[-2.64, 0.930, -2.74]}
        rotation={[0, 0.52, 0]}
        onClick={(e) => {
          if (e.delta > 5) return;
          e.stopPropagation();
          onKettleTap?.();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (document.body.style.cursor !== 'grabbing') {
            document.body.style.cursor = 'pointer';
          }
        }}
        onPointerOut={() => {
          if (document.body.style.cursor === 'pointer') {
            document.body.style.cursor = 'auto';
          }
        }}
      >
        <mesh geometry={assets.kettleBodyGeo} material={assets.hammeredCopperMat} castShadow receiveShadow />
        <mesh position={[0, 0.152, 0]} material={assets.oakWoodMat}>
          <sphereGeometry args={[0.020, 14, 10]} />
        </mesh>
        <mesh geometry={assets.kettleSpoutGeo} material={assets.hammeredCopperMat} castShadow />
        {/* Arching Oak & Brass Handle anchored into Kettle Shoulders */}
        <mesh position={[0, 0.142, 0]} material={assets.oakWoodMat} castShadow>
          <torusGeometry args={[0.088, 0.010, 12, 28, Math.PI]} />
        </mesh>
        {/* Hand-drawn Curling Steam Wisps aligned to NW Kettle Spout */}
        <CozyHanddrawnSteam
          position={[0.172, 0.168, 0]}
          intensity={0.48}
          tint="#FFF8EE"
          puffCount={6}
          riseHeight={0.28}
          spreadRadius={0.024}
          puffScale={0.056}
          driftX={0.010}
        />
      </group>

      {/* ====================================================================
          6. CUTE TOMATO MECHANICAL TIMER & HOLLOW LATHE CERAMIC BUTTER BELL
         ==================================================================== */}
      <group position={[-3.36, 0.930, -2.98]} rotation={[0, 0.25, 0]}>
        <mesh position={[0, 0.033, 0]} scale={[1.12, 0.86, 1.12]} castShadow>
          <sphereGeometry args={[0.038, 22, 16]} />
          <meshPhysicalMaterial
            color="#E25240"
            roughness={1.0}
            roughnessMap={assets.enamelMicro.roughnessMap}
            clearcoat={0.16}
            clearcoatRoughness={0.32}
            envMapIntensity={0.36}
          />
        </mesh>
        <mesh position={[0, 0.066, 0]}>
          <coneGeometry args={[0.016, 0.018, 8]} />
          <meshStandardMaterial color="#4D883C" roughness={0.62} />
        </mesh>
      </group>
      <group position={[-3.50, 0.930, -2.98]}>
        <mesh geometry={assets.butterBellGeo} castShadow>
          <meshStandardMaterial
            map={craftAssets.glazedPottery.map}
            normalMap={craftAssets.glazedPottery.normalMap}
            roughness={0.44}
            envMapIntensity={0.34}
          />
        </mesh>
        <mesh position={[0, 0.088, 0]} material={assets.cupCreamMat}>
          <sphereGeometry args={[0.017, 14, 10]} />
        </mesh>
      </group>

      {/* ====================================================================
          7. PHASE 9 NW PREP COUNTER ENRICHMENT (STRICTLY FLUSH AT y = 0.930m, ZERO OVERLAP!)
         ==================================================================== */}
      {/* 7A. Butter-Yellow Roll-Top Enamel Bakery Breadbox (`[-3.84, 0.930, -2.84]`) */}
      <group position={[-3.84, 0.930, -2.84]} rotation={[0, 0.05, 0]}>
        <mesh geometry={assets.breadboxGeo} material={assets.butterYellowEnamelMat} castShadow receiveShadow />
        {/* Warm Walnut Bottom Base Trim & Turned Brass Roll-Top Handle */}
        <mesh position={[0, 0.006, 0]} material={assets.walnutWoodMat}>
          <boxGeometry args={[0.282, 0.012, 0.192]} />
        </mesh>
        <mesh position={[0, 0.064, 0.103]} rotation={[0, 0, Math.PI / 2]} material={assets.warmBrassMat} castShadow>
          <cylinderGeometry args={[0.0055, 0.0055, 0.078, 12]} />
        </mesh>
        {[-0.028, 0.028].map((hx, hi) => (
          <mesh key={`bb-stud-${hi}`} position={[hx, 0.064, 0.097]} rotation={[Math.PI / 2, 0, 0]} material={assets.warmBrassMat}>
            <cylinderGeometry args={[0.005, 0.005, 0.014, 10]} />
          </mesh>
        ))}
      </group>

      {/* 7B. Sculpted French Beechwood Tapered Rolling Pin (`[-3.78, 0.930, -2.64]`) */}
      <group position={[-3.78, 0.930, -2.64]} rotation={[0, 0.14, 0]}>
        <mesh geometry={assets.rollingPinGeo} material={assets.oakWoodMat} castShadow receiveShadow />
        {[-0.105, 0.105].map((rx, ri) => (
          <mesh key={`rpin-ring-${ri}`} position={[rx, 0.022, 0]} rotation={[0, Math.PI / 2, 0]} material={assets.warmBrassMat}>
            <torusGeometry args={[0.012, 0.0022, 8, 18]} />
          </mesh>
        ))}
      </group>

      {/* 7C. Glazed Ceramic Utensil Crock with Wooden Ladles & Balloon Whisk (`[-3.38, 0.930, -2.74]`) */}
      <group position={[-3.38, 0.930, -2.74]}>
        <mesh geometry={assets.utensilCrockGeo} material={assets.utensilCrockMat} castShadow receiveShadow />
        <mesh position={[0, 0.139, 0]} rotation={[Math.PI / 2, 0, 0]} material={assets.sageEnamelMat}>
          <torusGeometry args={[0.053, 0.006, 10, 26]} />
        </mesh>
        {/* Turned Wooden Tasting Ladle */}
        <group position={[-0.014, 0.045, 0.008]} rotation={[0.14, 0.18, 0.22]}>
          <mesh geometry={assets.utensilHandleGeo} material={assets.oakWoodMat} castShadow />
          <mesh position={[0, 0.156, 0.006]} rotation={[0.32, 0, 0]} scale={[1.0, 0.45, 1.15]} material={assets.oakWoodMat} castShadow>
            <sphereGeometry args={[0.022, 16, 12]} />
          </mesh>
        </group>
        {/* Dark Walnut Pastry Mixing Spoon */}
        <group position={[0.015, 0.048, -0.010]} rotation={[-0.16, -0.22, -0.20]}>
          <mesh geometry={assets.utensilHandleGeo} material={assets.walnutWoodMat} castShadow />
          <mesh position={[0, 0.162, 0]} material={assets.walnutWoodMat} castShadow>
            <cylinderGeometry args={[0.018, 0.010, 0.048, 12]} />
          </mesh>
        </group>
        {/* Brass-Ferruled Wire Balloon Whisk */}
        <group position={[0.004, 0.052, 0.012]} rotation={[0.18, 0.35, -0.10]}>
          <mesh geometry={assets.utensilHandleGeo} material={assets.walnutWoodMat} castShadow />
          <mesh position={[0, 0.145, 0]} material={assets.warmBrassMat}>
            <cylinderGeometry args={[0.009, 0.008, 0.022, 12]} />
          </mesh>
          <mesh position={[0, 0.152, 0]} geometry={assets.whiskWiresGeo} material={assets.brushedChromeMat} castShadow />
        </group>
      </group>
    </group>
  );
};
