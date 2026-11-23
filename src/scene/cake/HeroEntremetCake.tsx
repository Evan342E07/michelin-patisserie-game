import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import {
  createMoltenCaramelLavaMaterial,
  enhanceMaterialWithFoodSSS,
  updateFoodSSSUniforms,
} from '../../shaders/patisserieShaders';
import { useGameStore } from '../../store/useGameStore';
import { ScreenCallout } from '../../types';
import {
  ENTREMET_FLAVOR_PRESETS,
  EntremetFlavorPreset,
  HERO_EIGHT_LAYERS,
  resolveFlavorId,
} from './cakeFlavors';
import {
  getHeroEntremetGeometries,
  HeroEntremetGeometries,
  SplitLayerGeometries,
} from './cakeGeometries';
import { getCakeProceduralTextures } from './cakeTextures';
import { MirrorGlazePour } from './MirrorGlazePour';
import { getCottageCraftAssets } from '../environment/cottageTexturesAndFlora';
import { createWoodGrainPbr } from '../props/cottageHighCraftPbr';
import { enhanceWithExtremeMicroCraft } from '../../shaders/extremeThreeJsUpgrades';
import { enhanceWithStylizedFresnelRim } from '../../shaders/stylizedCozyUpgrades';

const CRUNCH_NORMAL_SCALE = new THREE.Vector2(1.45, 1.45);
const SPONGE_NORMAL_SCALE = new THREE.Vector2(1.55, 1.55);
const JELLY_NORMAL_SCALE = new THREE.Vector2(0.74, 0.74);
const MOUSSE_CAP_NORMAL_SCALE = new THREE.Vector2(0.62, 0.62);
const STRAWBERRY_SKIN_NORMAL_SCALE = new THREE.Vector2(1.25, 1.25);
const STRAWBERRY_CUT_NORMAL_SCALE = new THREE.Vector2(0.85, 0.85);

// 严格 360° 匀称无缝闭环 44 朵圣安娜底层花边（步长 2π/44，半步偏移，完整态零接缝缺口，1/4 切块不跨切面！）
const SAINT_HONORE_TOTAL = 44;
const SAINT_HONORE_STEP = (Math.PI * 2) / SAINT_HONORE_TOTAL;
const SLICE_SHELL_ANGLES: number[] = Array.from({ length: 11 }, (_, i) =>
  (i + 0.5) * SAINT_HONORE_STEP
);
const MAIN_SHELL_ANGLES: number[] = Array.from({ length: 33 }, (_, i) =>
  (i + 11.5) * SAINT_HONORE_STEP
);

function createNeutralWhiteTexture(): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a crisp 512x512 pierced scalloped French paper lace doily texture set
 * (colorMap + alphaMap + bumpMap) with 36 perimeter scallops & filigree lace eyelets.
 */
function createScallopedLaceDoilyMaps(): {
  colorMap: THREE.CanvasTexture;
  alphaMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 512;
  const cx = size * 0.5;
  const cy = size * 0.5;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d')!;

  const alphaCanvas = document.createElement('canvas');
  alphaCanvas.width = size;
  alphaCanvas.height = size;
  const aCtx = alphaCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  // Background transparent / black alpha
  cCtx.fillStyle = '#FAF3E4';
  cCtx.fillRect(0, 0, size, size);
  aCtx.fillStyle = '#000000';
  aCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#686868';
  bCtx.fillRect(0, 0, size, size);

  const scallops = 36;
  const outerR = size * 0.475;
  const innerScallopR = size * 0.448;

  // Draw scalloped outer silhouette onto alpha & bump
  const traceScallopedRim = (ctx: CanvasRenderingContext2D, rBase: number, rAmp: number) => {
    ctx.beginPath();
    const steps = scallops * 12;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const lobe = Math.abs(Math.sin(a * scallops * 0.5));
      const r = rBase + Math.pow(lobe, 0.65) * rAmp;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  traceScallopedRim(aCtx, innerScallopR, outerR - innerScallopR);
  aCtx.fillStyle = '#FFFFFF';
  aCtx.fill();

  traceScallopedRim(bCtx, innerScallopR, outerR - innerScallopR);
  bCtx.fillStyle = '#A8A8A8';
  bCtx.fill();

  // Warm subtle parchment paper fiber gradient on color canvas
  const paperGrad = cCtx.createRadialGradient(cx, cy, size * 0.08, cx, cy, outerR);
  paperGrad.addColorStop(0.0, '#FCF7EC');
  paperGrad.addColorStop(0.74, '#F7EEDB');
  paperGrad.addColorStop(0.92, '#FDF8EE');
  paperGrad.addColorStop(1.0, '#EFE4CE');
  cCtx.fillStyle = paperGrad;
  cCtx.fillRect(0, 0, size, size);

  // Embossed concentric beading & delicate lace rings
  const ringRadii = [size * 0.34, size * 0.375, size * 0.415, size * 0.436];
  for (const rr of ringRadii) {
    cCtx.strokeStyle = 'rgba(218, 200, 170, 0.45)';
    cCtx.lineWidth = 2.0;
    cCtx.beginPath();
    cCtx.arc(cx, cy, rr, 0, Math.PI * 2);
    cCtx.stroke();

    bCtx.strokeStyle = '#E8E8E8';
    bCtx.lineWidth = 2.6;
    bCtx.beginPath();
    bCtx.arc(cx, cy, rr, 0, Math.PI * 2);
    bCtx.stroke();
  }

  // Pierced filigree lace cutouts around perimeter (teardrops + diamond eyelets + soft darkened lace border shadows)
  aCtx.fillStyle = '#000000';
  bCtx.fillStyle = '#262626';
  for (let i = 0; i < scallops; i++) {
    const ang = ((i + 0.5) / scallops) * Math.PI * 2;
    const midAng = (i / scallops) * Math.PI * 2;

    // Outer scalloped lace eyelet hole + crisp embossed rim ring on color canvas
    const rOuterHole = size * 0.442;
    const ox = cx + Math.cos(ang) * rOuterHole;
    const oy = cy + Math.sin(ang) * rOuterHole;
    cCtx.strokeStyle = 'rgba(176, 152, 122, 0.62)';
    cCtx.lineWidth = 2.0;
    cCtx.beginPath();
    cCtx.ellipse(ox, oy, 6.2, 4.4, ang, 0, Math.PI * 2);
    cCtx.stroke();

    aCtx.beginPath();
    aCtx.ellipse(ox, oy, 5.4, 3.8, ang, 0, Math.PI * 2);
    aCtx.fill();
    bCtx.beginPath();
    bCtx.ellipse(ox, oy, 6.4, 4.6, ang, 0, Math.PI * 2);
    bCtx.fill();

    // Inner filigree teardrop cutout
    const rMidHole = size * 0.398;
    const mx = cx + Math.cos(midAng) * rMidHole;
    const my = cy + Math.sin(midAng) * rMidHole;
    cCtx.beginPath();
    cCtx.ellipse(mx, my, 7.6, 4.0, midAng, 0, Math.PI * 2);
    cCtx.stroke();

    aCtx.beginPath();
    aCtx.ellipse(mx, my, 7.0, 3.6, midAng, 0, Math.PI * 2);
    aCtx.fill();
    bCtx.beginPath();
    bCtx.ellipse(mx, my, 7.8, 4.4, midAng, 0, Math.PI * 2);
    bCtx.fill();

    // Fine embossed petal scroll bead between holes
    const bx = cx + Math.cos(ang) * (size * 0.360);
    const by = cy + Math.sin(ang) * (size * 0.360);
    bCtx.fillStyle = '#F0F0F0';
    bCtx.beginPath();
    bCtx.arc(bx, by, 3.4, 0, Math.PI * 2);
    bCtx.fill();
    bCtx.fillStyle = '#262626';
  }

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.anisotropy = 8;

  const alphaMap = new THREE.CanvasTexture(alphaCanvas);
  alphaMap.colorSpace = THREE.NoColorSpace;
  alphaMap.anisotropy = 8;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.anisotropy = 8;

  return { colorMap, alphaMap, bumpMap };
}

type ExtendedGameStore = ReturnType<typeof useGameStore.getState> & {
  selectedFlavor?: string;
  flavor?: string;
  explodeFactor?: number;
  sliceOpenFactor?: number;
  glazeProgress?: number;
};

export interface HeroEntremetCakeProps {
  /** Override flavor ID ('raspberry_vanilla' | 'black_gold_caramel' | 'kyoto_matcha_yuzu') */
  selectedFlavor?: string;
  /** Override vertical explosion spacing factor (0 -> 1) */
  explodeFactor?: number;
  /** Override 1/4 wedge slice-open slide factor (0 -> 1) */
  sliceOpenFactor?: number;
  /** Override Step 6 mirror glaze pour progress (0 -> 1) */
  glazeProgress?: number;
  /** Override garnish stage (0..4, defaults to 4 when inspected or store garnishStep) */
  garnishStep?: number;
  /** Whether to render Layer 8 Carrara marble gilded pedestal stand (default: true) */
  showMarbleStand?: boolean;
  /** Whether to render MirrorGlazePour automatically when currentStep === 6 (default: true) */
  enableStep6GlazePour?: boolean;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  onCalloutsUpdate?: (callouts: ScreenCallout[]) => void;
}

/**
 * Renders a single rotational entremet layer in either:
 *  - Seamless 360° whole mode (isSplit === false)
 *  - 3/4 Main Body + 1/4 Sliding Wedge with razor-flat planar cut caps (isSplit === true)
 */
const SplitCakeLayer: React.FC<{
  geos: SplitLayerGeometries;
  wallMat: THREE.Material;
  capMat?: THREE.Material;
  yOffset: number;
  rotationY?: number;
  radialScale?: number;
  isSplit: boolean;
  sliceOffset: [number, number, number];
  sliceYaw: number;
}> = ({
  geos,
  wallMat,
  capMat,
  yOffset,
  rotationY = 0,
  radialScale = 1,
  isSplit,
  sliceOffset,
  sliceYaw,
}) => {
  const effectiveCapMat = capMat ?? wallMat;

  if (!isSplit) {
    return (
      <group position={[0, yOffset, 0]} rotation={[0, rotationY, 0]} scale={[radialScale, 1, radialScale]}>
        <mesh geometry={geos.fullGeo} material={wallMat} castShadow receiveShadow />
      </group>
    );
  }

  return (
    <group position={[0, yOffset, 0]} scale={[radialScale, 1, radialScale]}>
      <mesh geometry={geos.mainWallGeo} material={wallMat} castShadow receiveShadow />
      <mesh geometry={geos.mainCapsGeo} material={effectiveCapMat} receiveShadow />

      <group position={sliceOffset} rotation={[0, sliceYaw, 0]}>
        <mesh geometry={geos.sliceWallGeo} material={wallMat} castShadow receiveShadow />
        <mesh geometry={geos.sliceCapsGeo} material={effectiveCapMat} receiveShadow />
      </group>
    </group>
  );
};

/**
 * 商业广告级爆炸专属粒子涡旋特效：
 * 仅在结构爆炸展示（e > 0.08）时激活：包含 42 枚缓慢盘旋闪耀的 24K 金箔碎屑 + 72 颗暖金细糖霜微光粒子
 */
const HeroExplodeVFX: React.FC<{
  explodeFactor: number;
  goldFlakeGeo: THREE.BufferGeometry;
  goldMat: THREE.Material;
}> = ({ explodeFactor, goldFlakeGeo, goldMat }) => {
  const foilInstRef = useRef<THREE.InstancedMesh>(null);
  const dustRef = useRef<THREE.Points>(null);

  const { foilSeeds, dustGeo, dustMat } = useMemo(() => {
    const seeds = Array.from({ length: 42 }, (_, i) => {
      const t = i / 42;
      return {
        ang: t * Math.PI * 2 * 3.1 + (i % 3) * 0.4,
        rad: 0.48 + (i % 5) * 0.065 + Math.sin(i * 1.7) * 0.04,
        yBase: 0.12 + t * 1.48,
        speed: 0.24 + (i % 4) * 0.06,
        scale: 0.65 + (i % 3) * 0.35,
        phase: i * 1.37,
      };
    });

    const pCount = 72;
    const positions = new Float32Array(pCount * 3);
    const phases = new Float32Array(pCount);
    for (let i = 0; i < pCount; i++) {
      const a = (i / pCount) * Math.PI * 2 * 4.0;
      const r = 0.25 + ((i * 37) % 100) / 100 * 0.56;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = 0.08 + (i / pCount) * 1.56;
      positions[i * 3 + 2] = Math.sin(a) * r;
      phases[i] = i * 0.89;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    dg.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const dm = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uFade: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute float aPhase;
        uniform float uTime;
        uniform float uFade;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          float spin = uTime * 0.22;
          float cs = cos(spin);
          float sn = sin(spin);
          p.xz = mat2(cs, -sn, sn, cs) * p.xz;
          p.y += sin(uTime * 0.9 + aPhase) * 0.035;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float pulse = 0.55 + 0.45 * sin(uTime * 2.2 + aPhase * 1.7);
          gl_PointSize = clamp((18.0 * pulse) / max(0.8, -mv.z), 2.5, 16.0);
          vAlpha = uFade * (0.45 + 0.55 * pulse);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          if (d > 1.0) discard;
          float glow = exp(-d * d * 5.2) + pow(max(0.0, 1.0 - d), 2.4) * 0.45;
          vec3 col = vec3(1.0, 0.90, 0.62) * 1.55;
          gl_FragColor = vec4(col, clamp(glow * vAlpha, 0.0, 1.0));
        }
      `,
    });

    return { foilSeeds: seeds, dustGeo: dg, dustMat: dm };
  }, []);

  useEffect(() => {
    return () => {
      dustGeo.dispose();
      dustMat.dispose();
    };
  }, [dustGeo, dustMat]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    const fade = THREE.MathUtils.smoothstep(explodeFactor, 0.08, 0.45);
    dustMat.uniforms.uTime.value = clock.getElapsedTime();
    dustMat.uniforms.uFade.value = fade;

    const inst = foilInstRef.current;
    if (inst && fade > 0.01) {
      const t = clock.getElapsedTime();
      foilSeeds.forEach((s, i) => {
        const ang = s.ang + t * s.speed * 0.45;
        const rad = s.rad * (0.78 + 0.28 * fade);
        dummy.position.set(
          Math.cos(ang) * rad,
          s.yBase * (0.35 + 0.65 * explodeFactor) + Math.sin(t * 1.25 + s.phase) * 0.028,
          Math.sin(ang) * rad
        );
        dummy.rotation.set(t * 1.3 + s.phase, t * 1.7 + s.phase * 0.6, t * 0.9);
        dummy.scale.setScalar(s.scale * fade * 1.75);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      });
      inst.instanceMatrix.needsUpdate = true;
    }
  });

  if (explodeFactor <= 0.08) return null;

  return (
    <group>
      <instancedMesh ref={foilInstRef} args={[goldFlakeGeo, goldMat, 42]} raycast={() => null} />
      <points ref={dustRef} geometry={dustGeo} material={dustMat} raycast={() => null} />
    </group>
  );
};

/**
 * Evaluates exact surface Y on the hand-swirled Chantilly frosting crown at (r, theta)
 * so every strawberry, macaron, blueberry, chamomile blossom & cream rosette sits strictly flush.
 */
function sampleCrownSurfaceY(r: number, theta = 0): number {
  const s = (edge0: number, edge1: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };
  if (r <= 0.418) {
    const ridgeEnv = s(0.014, 0.085, r) * (1.0 - s(0.355, 0.418, r));
    const spiral = Math.sin(r * 52.0 - theta);
    const centerTuft = Math.exp(-r * r * 1150) * 0.0062;
    return 0.332 + spiral * 0.0052 * ridgeEnv + centerTuft;
  }
  const dx = Math.min(0.034, Math.max(0, r - 0.418));
  const t = dx / 0.034;
  return 0.332 - t * t * 0.012;
}

interface TopGarnishCrownProps {
  geos: HeroEntremetGeometries;
  flavor: EntremetFlavorPreset;
  garnishLevel: number;
  explodeFactor?: number;
  isSplit: boolean;
  sliceOffset: [number, number, number];
  sliceYaw: number;
  materials: {
    strawberryOuterMat: THREE.MeshPhysicalMaterial;
    strawberryCutMat: THREE.MeshPhysicalMaterial;
    calyxMat: THREE.MeshPhysicalMaterial;
    blueberryMat: THREE.MeshPhysicalMaterial;
    macaronPrimaryMat: THREE.MeshPhysicalMaterial;
    macaronSecondaryMat: THREE.MeshPhysicalMaterial;
    whiteChocMat: THREE.MeshPhysicalMaterial;
    icingSugarMat: THREE.MeshPhysicalMaterial;
    goldLeafMat: THREE.MeshPhysicalMaterial;
    chantillyMat: THREE.MeshPhysicalMaterial;
    mintLeafMat: THREE.MeshPhysicalMaterial;
    rosemaryMat: THREE.MeshPhysicalMaterial;
    daisyPetalMat: THREE.MeshPhysicalMaterial;
    blushPetalMat: THREE.MeshPhysicalMaterial;
    gardenRoseMat: THREE.MeshPhysicalMaterial;
    pollenMat: THREE.MeshPhysicalMaterial;
  };
}

/**
 * Layer 1: French Countryside Chantilly Fruit & Macaron Crown
 * (Whole & Halved Strawberries with Calyx, Frosted Blueberries, Twin-Hue French Macarons,
 *  White-Chocolate Shavings, Hand-Piped Chantilly Swirls, Chamomile/Rose Garden & Icing Sugar)
 * All angles maintain >= 0.16 rad buffer from slice cut planes (theta = 0 and PI/2).
 */
const TopGarnishCrown: React.FC<TopGarnishCrownProps> = ({
  geos,
  flavor,
  garnishLevel,
  explodeFactor = 0,
  isSplit,
  sliceOffset,
  sliceYaw,
  materials,
}) => {
  const burst = THREE.MathUtils.smoothstep(explodeFactor, 0.08, 0.92);
  const fruitAngles = [0.56, 1.18, 2.08, 2.86, 3.66, 4.44, 5.34];
  const macaronAngles = [0.84, 2.46, 4.02, 5.66];
  const rosetteAngles = [0.34, 1.32, 2.34, 3.36, 4.88];
  const shavingAngles = [0.72, 1.92, 2.98, 3.88, 4.78, 5.76];
  const botanicalAngles = [0.44, 1.24, 1.98, 2.74, 3.52, 4.30, 5.18];

  const wrapForSlice = (ang: number, key: string, child: React.ReactNode) => {
    const inSlice = isSplit && ang >= 0 && ang <= Math.PI * 0.5;
    if (!inSlice) return child;
    return (
      <group key={`slice-${key}`} position={sliceOffset} rotation={[0, sliceYaw, 0]}>
        {child}
      </group>
    );
  };

  return (
    <group>
      {/* Sub-garnish 1: Fresh Whole & Halved Strawberries + Frosted 5-Crown Blueberries (高空轻微穹顶腾空！) */}
      {garnishLevel >= 1 &&
        fruitAngles.map((ang, idx) => {
          const r = 0.258 + (idx % 2 === 0 ? 0.010 : -0.012) + burst * 0.055;
          const y = sampleCrownSurfaceY(r - burst * 0.055, ang) + burst * (0.04 + (idx % 2) * 0.035);
          const pos: [number, number, number] = [Math.sin(ang) * r, y, Math.cos(ang) * r];
          const isHalved = idx % 2 === 1;

          // Two tucked blueberries flanking each berry cluster on the Chantilly wave
          const b1Ang = ang + 0.11;
          const b1R = r + 0.044 + burst * 0.02;
          const b1Pos: [number, number, number] = [
            Math.sin(b1Ang) * b1R,
            sampleCrownSurfaceY(b1R - burst * 0.075, b1Ang) - 0.0012 + burst * 0.075,
            Math.cos(b1Ang) * b1R,
          ];
          const b2Ang = ang - 0.10;
          const b2R = r - 0.036;
          const b2Pos: [number, number, number] = [
            Math.sin(b2Ang) * b2R,
            sampleCrownSurfaceY(b2R - burst * 0.055, b2Ang) - 0.0010 + burst * 0.06,
            Math.cos(b2Ang) * b2R,
          ];

          const node = (
            <group key={`fruit-${idx}`}>
              {isHalved ? (
                <group
                  position={[pos[0], pos[1] + 0.0045, pos[2]]}
                  rotation={[0.90, ang + Math.PI, (idx % 3 - 1) * 0.14]}
                  scale={1.48}
                >
                  <mesh geometry={geos.halfStrawberryOuterGeo} material={materials.strawberryOuterMat} castShadow receiveShadow />
                  <mesh geometry={geos.halfStrawberryCutGeo} material={materials.strawberryCutMat} castShadow receiveShadow />
                  <mesh position={[0, 0.014, -0.001]} scale={0.48} geometry={geos.icingSugarClusterGeo} material={materials.icingSugarMat} />
                </group>
              ) : (
                <group
                  position={[pos[0], pos[1] - 0.0022, pos[2]]}
                  rotation={[0.24 + (idx % 3) * 0.06, ang + 0.4, (idx % 2 === 0 ? 1 : -1) * 0.12]}
                  scale={1.44}
                >
                  <mesh geometry={geos.wholeStrawberryGeo} material={materials.strawberryOuterMat} castShadow receiveShadow />
                  <mesh geometry={geos.strawberryCalyxGeo} material={materials.calyxMat} castShadow />
                  <mesh position={[0, 0.025, 0]} scale={0.52} geometry={geos.icingSugarClusterGeo} material={materials.icingSugarMat} />
                </group>
              )}

              <mesh
                position={b1Pos}
                rotation={[0.16, b1Ang * 1.7, 0.08]}
                scale={1.34}
                geometry={geos.blueberryGeo}
                material={materials.blueberryMat}
                castShadow
                receiveShadow
              />
              <mesh
                position={b2Pos}
                rotation={[-0.12, b2Ang * 2.1, -0.10]}
                scale={1.22}
                geometry={geos.blueberryGeo}
                material={materials.blueberryMat}
                castShadow
                receiveShadow
              />
            </group>
          );

          return wrapForSlice(ang, `fruit-${idx}`, node);
        })}

      {/* Sub-garnish 2: French Macarons (Rose-Pink & Pistachio), Chantilly Rosette Puffs & White-Chocolate Shavings */}
      {garnishLevel >= 2 && (
        <>
          {macaronAngles.map((ang, idx) => {
            const r = 0.212 + burst * 0.095;
            const y = sampleCrownSurfaceY(0.212, ang) + burst * 0.105;
            const pos: [number, number, number] = [Math.sin(ang) * r, y + 0.016, Math.cos(ang) * r];
            const shellMat = idx % 2 === 0 ? materials.macaronPrimaryMat : materials.macaronSecondaryMat;
            const node = (
              <group
                key={`mac-${idx}`}
                position={pos}
                rotation={[0.50 + burst * 0.25, ang + 0.36, (idx % 2 === 0 ? 1 : -1) * (0.16 + burst * 0.20)]}
                scale={1.36}
              >
                <mesh geometry={geos.macaronShellsGeo} material={shellMat} castShadow receiveShadow />
                <mesh geometry={geos.macaronFillingGeo} material={materials.chantillyMat} castShadow receiveShadow />
              </group>
            );
            return wrapForSlice(ang, `mac-${idx}`, node);
          })}

          {rosetteAngles.map((ang, idx) => {
            const r = 0.348 + burst * 0.04;
            const y = sampleCrownSurfaceY(0.348, ang) + burst * 0.025;
            const pos: [number, number, number] = [Math.sin(ang) * r, y - 0.0022, Math.cos(ang) * r];
            const node = (
              <mesh
                key={`chan-${idx}`}
                position={pos}
                rotation={[0.04, ang, 0]}
                scale={1.18}
                geometry={geos.chantillyPearlGeo}
                material={materials.chantillyMat}
                castShadow
                receiveShadow
              />
            );
            return wrapForSlice(ang, `chan-${idx}`, node);
          })}

          {shavingAngles.map((ang, idx) => {
            const r = 0.162 + burst * 0.045;
            const y = sampleCrownSurfaceY(0.162, ang) + burst * 0.175;
            const pos: [number, number, number] = [Math.sin(ang) * r, y + 0.0035, Math.cos(ang) * r];
            const node = (
              <group key={`wchoc-${idx}`} position={pos} rotation={[0.16 + burst * 0.35, ang + 0.85, 0.10]} scale={1.14}>
                <mesh geometry={geos.whiteChocShavingGeo} material={materials.whiteChocMat} castShadow />
                {flavor.garnishTheme === 'black_gold' && idx % 2 === 0 && (
                  <mesh
                    position={[0.004, 0.012, 0.002]}
                    rotation={[0.15, ang, 0.2]}
                    scale={0.36}
                    geometry={geos.goldFlakeGeo}
                    material={materials.goldLeafMat}
                  />
                )}
              </group>
            );
            return wrapForSlice(ang, `wchoc-${idx}`, node);
          })}
        </>
      )}

      {/* Sub-garnish 3: French Countryside Wild Chamomile Blossoms & Sugar-Dusted Mint Leaves */}
      {garnishLevel >= 3 &&
        botanicalAngles.map((ang, idx) => {
          const r = 0.312;
          const y = sampleCrownSurfaceY(r, ang);
          const pos: [number, number, number] = [Math.sin(ang) * r, y + 0.0024, Math.cos(ang) * r];
          const isBlush = idx % 3 === 1;
          const petalMat = isBlush ? materials.blushPetalMat : materials.daisyPetalMat;
          const node = (
            <group key={`daisy-${idx}`} position={pos} rotation={[0.03, ang * 1.4, -0.02]} scale={1.26}>
              <mesh
                position={[-0.003, 0.002, 0.004]}
                rotation={[0.05, 2.48, 0.08]}
                geometry={geos.mintLeafGeo}
                material={materials.mintLeafMat}
                castShadow
              />
              <mesh
                position={[0.003, 0.002, 0.004]}
                rotation={[0.05, 0.66, 0.08]}
                geometry={geos.mintLeafGeo}
                material={materials.mintLeafMat}
                castShadow
              />
              {[0, 1, 2, 3, 4, 5, 6].map((pi) => {
                const pa = (pi / 7) * Math.PI * 2;
                return (
                  <mesh
                    key={pi}
                    position={[Math.cos(pa) * 0.003, 0.009, Math.sin(pa) * 0.003]}
                    rotation={[0.04, -pa, 0.12]}
                    geometry={geos.chamomilePetalGeo}
                    material={petalMat}
                    castShadow
                  />
                );
              })}
              <mesh position={[0, 0.010, 0]} geometry={geos.pollenDiscGeo} material={materials.pollenMat} castShadow />
            </group>
          );
          return wrapForSlice(ang, `daisy-${idx}`, node);
        })}

      {/* Sub-garnish 4: Ghibli Cottage Centerpiece (Blush Garden Rose, Center Whole Strawberry, Rosemary & Icing Sugar Snow)
          Anchored safely inside 3/4 main body (-X/-Z quadrant) so ZERO element hangs across the 1/4 slice void! */}
      {garnishLevel >= 4 && (
        <group
          position={[
            -0.082,
            sampleCrownSurfaceY(Math.hypot(0.082, 0.082), Math.atan2(-0.082, -0.082)),
            -0.082,
          ]}
          scale={1.24}
        >
          {/* Radiating Sculpted Fresh Rosemary Sprigs & Mint Leaves */}
          {[0, 1, 2, 3, 4, 5].map((si) => {
            const sa = (si / 6) * Math.PI * 2 + 0.25;
            const useRosemary = si % 2 === 0;
            return (
              <mesh
                key={si}
                position={[Math.cos(sa) * 0.012, 0.004, Math.sin(sa) * 0.012]}
                rotation={[0.04, -sa, 0.10]}
                geometry={useRosemary ? geos.rosemarySprigGeo : geos.mintLeafGeo}
                material={useRosemary ? materials.rosemaryMat : materials.mintLeafMat}
                scale={useRosemary ? 1.06 : 1.26}
                castShadow
              />
            );
          })}
          {/* Plump Center Strawberry Jewel tucked into Chantilly centerpiece */}
          <group position={[-0.018, 0.002, 0.016]} rotation={[0.20, 0.55, -0.14]} scale={1.18}>
            <mesh geometry={geos.wholeStrawberryGeo} material={materials.strawberryOuterMat} castShadow receiveShadow />
            <mesh geometry={geos.strawberryCalyxGeo} material={materials.calyxMat} castShadow />
          </group>
          {/* Sculpted 15-Petal Spiraling French Blush Garden Rose */}
          <mesh
            position={[0.012, 0.004, -0.008]}
            rotation={[0.05, 0.42, -0.04]}
            geometry={geos.gardenRoseHeadGeo}
            material={materials.gardenRoseMat}
            scale={1.08}
            castShadow
            receiveShadow
          />
          {/* Twin Sculpted White Chamomile Blossoms flanking Rose */}
          {[-0.036, 0.028].map((cx, ci) => (
            <group key={ci} position={[cx, 0.012, ci === 0 ? -0.024 : -0.030]} rotation={[0.10, ci * 1.4, ci === 0 ? 0.10 : -0.10]} scale={0.76}>
              {[0, 1, 2, 3, 4, 5, 6].map((cp) => {
                const ca = (cp / 7) * Math.PI * 2;
                return (
                  <mesh
                    key={cp}
                    position={[Math.cos(ca) * 0.0025, 0.003, Math.sin(ca) * 0.0025]}
                    rotation={[0.04, -ca, 0.12]}
                    geometry={geos.chamomilePetalGeo}
                    material={materials.daisyPetalMat}
                    castShadow
                  />
                );
              })}
              <mesh position={[0, 0.0045, 0]} geometry={geos.pollenDiscGeo} material={materials.pollenMat} />
            </group>
          ))}
          {/* Delicate Fine Icing Sugar Snow Dusting Halo */}
          <mesh position={[0, 0.002, 0]} scale={2.4} geometry={geos.icingSugarClusterGeo} material={materials.icingSugarMat} />
        </group>
      )}
    </group>
  );
};

/**
 * <HeroEntremetCake />
 * Unified 8-Layer Haute Pâtisserie Entremet Showpiece Component.
 * Directly reads state from `useGameStore` (and accepts optional props overrides) for:
 *  - `explodeFactor` (0 -> 1): Independent 8-layer vertical exploded inspection
 *  - `sliceOpenFactor` (0 -> 1): 1/4 radial sector cut & slide-out with viscous caramel ooze
 *  - `selectedFlavor`: Classic Raspberry Vanilla / Black Gold Caramel / Kyoto Matcha Yuzu
 *  - `glazeProgress`: Step 6 real-time 32°C mirror glaze waterfall cascade
 */
export const HeroEntremetCake: React.FC<HeroEntremetCakeProps> = ({
  selectedFlavor: propFlavor,
  explodeFactor: propExplode,
  sliceOpenFactor: propSliceOpen,
  glazeProgress: propGlazeProgress,
  garnishStep: propGarnishStep,
  showMarbleStand = true,
  enableStep6GlazePour = true,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  onCalloutsUpdate,
}) => {
  const { camera, size } = useThree();
  const store = useGameStore((s) => s as ExtendedGameStore);
  const placeNextGarnishWithTweezers = useGameStore((s) => s.placeNextGarnishWithTweezers);

  const flavorId = resolveFlavorId(propFlavor ?? store.selectedFlavor ?? store.flavor);
  const flavor = ENTREMET_FLAVOR_PRESETS[flavorId];

  const targetExplode = propExplode ?? store.explodeFactor ?? store.explodeTarget ?? 0;
  const targetSlice = propSliceOpen ?? store.sliceOpenFactor ?? store.silverCutTarget ?? 0;
  const targetGlaze = propGlazeProgress ?? store.glazeProgress ?? store.glazeCoverage ?? 1;
  const effectiveGarnish =
    propGarnishStep ??
    (store.currentStep === 6 ? 0 : store.currentStep === 7 ? store.garnishStep : 4);

  const geos = useMemo(() => getHeroEntremetGeometries(), []);
  const textures = useMemo(() => getCakeProceduralTextures(), []);
  const craftAssets = useMemo(() => getCottageCraftAssets(), []);
  const pedestalWoodPbr = useMemo(() => createWoodGrainPbr('#9E673C', '#6B3E20', 811), []);
  const doilyMaps = useMemo(() => createScallopedLaceDoilyMaps(), []);
  const neutralWhiteTex = useMemo(() => createNeutralWhiteTexture(), []);

  // Construct all food-grade PBR + Custom GLSL SSS Materials once, updating uniforms/colors cleanly
  const materials = useMemo(() => {
    // Hand-Thrown Warm Oat-Speckled Stoneware & Aged Honey-Walnut Cottage Cake Stand
    // Enhanced with Box-Projected Room IBL Parallax + Micro-Pitting Detail (no buttercreamSwirl map!)
    const marbleStandMat = enhanceWithStylizedFresnelRim(
      enhanceWithExtremeMicroCraft(
        new THREE.MeshPhysicalMaterial({
          map: craftAssets.stonewareTex,
          color: '#5C4438',
          bumpMap: textures.marbleRoughnessMap,
          bumpScale: 0.0022,
          roughnessMap: textures.marbleRoughnessMap,
          roughness: 0.82,
          clearcoat: 0.24,
          clearcoatRoughness: 0.22,
          envMapIntensity: 0.45,
        }),
        { boxProjectedIBL: true, detailKind: 'stone_ceramic', detailStrength: 0.14, cacheTag: 'hero-stoneware-platter-dark' }
      ),
      { rimColor: '#FFE0A4', rimStrength: 0.36, rimPower: 2.6, topBias: 0.45, cacheTag: 'hero-rim-stand' }
    );

    const goldTrimMat = enhanceWithStylizedFresnelRim(
      new THREE.MeshPhysicalMaterial({
        map: pedestalWoodPbr.map,
        bumpMap: pedestalWoodPbr.bumpMap,
        bumpScale: 0.0040,
        roughnessMap: pedestalWoodPbr.roughnessMap,
        roughness: 1.0,
        clearcoat: 0.10,
        clearcoatRoughness: 0.36,
        envMapIntensity: 0.36,
      }),
      { rimColor: '#FFE0AE', rimStrength: 0.26, rimPower: 2.6, topBias: 0.40, cacheTag: 'hero-rim-wood' }
    );

    const doilyMat = new THREE.MeshPhysicalMaterial({
      map: doilyMaps.colorMap,
      alphaMap: doilyMaps.alphaMap,
      bumpMap: doilyMaps.bumpMap,
      bumpScale: 0.0026,
      alphaTest: 0.42,
      roughness: 0.90,
      sheen: 0.36,
      sheenColor: new THREE.Color('#FFFBF2'),
      envMapIntensity: 0.30,
      side: THREE.DoubleSide,
    });

    // Layer 7: Almond-Butter Sablé Crunch Base
    const crunchMat = enhanceMaterialWithFoodSSS(
      new THREE.MeshPhysicalMaterial({
        color: flavor.crunchColor,
        map: textures.crunchColorMap,
        normalMap: textures.crunchNormalMap,
        normalScale: CRUNCH_NORMAL_SCALE,
        bumpMap: textures.crunchBumpMap,
        bumpScale: 0.0001,
        roughnessMap: textures.crunchRoughnessMap,
        roughness: 1.0,
        envMapIntensity: 0.28,
      }),
      {
        sssColor: '#B87236',
        sssStrength: 0.12,
        wrapAmount: 0.42,
        rimWarmth: 0.16,
        pomStrength: 0.012,
        contactAO: {
          minY: 0.0,
          maxY: 0.028,
          bottomStrength: 0.30,
          topStrength: 0.26,
          falloff: 0.0032,
          rimRadius: 0.435,
          rimStrength: 0.18,
        },
        cacheTag: 'hero-crunch',
      }
    );

    // Layer 6: 三层绝不雷同的差异化戚风坯材质（底层焦糖烤壳、中层冻干果粒嵌入、上层树莓/柚露酒润泽釉边）
    const makeSpongeTierMat = (
      tintHex: string,
      tag: string,
      kind: 'bottom' | 'mid' | 'top'
    ) => {
      const m = enhanceWithStylizedFresnelRim(
        enhanceMaterialWithFoodSSS(
          new THREE.MeshPhysicalMaterial({
            color: tintHex,
            map: textures.spongeColorMap,
            normalMap: textures.spongeNormalMap,
            normalScale: SPONGE_NORMAL_SCALE,
            bumpMap: textures.spongeBumpMap,
            bumpScale: kind === 'bottom' ? 0.013 : 0.010,
            roughnessMap: textures.spongeRoughnessMap,
            roughness: kind === 'top' ? 0.82 : 1.0,
            sheen: kind === 'top' ? 0.56 : 0.34,
            sheenColor: new THREE.Color(flavor.spongeSssColor),
            envMapIntensity: kind === 'top' ? 0.38 : 0.28,
          }),
          {
            sssColor: flavor.spongeSssColor,
            sssStrength: kind === 'mid' ? 0.52 : 0.42,
            wrapAmount: 0.62,
            rimWarmth: 0.36,
            pomStrength: 0.008,
            maillardEdge: {
              minY: 0.028,
              maxY: 0.302,
              maxR: 0.443,
              edgeColor: kind === 'bottom' ? '#8A4818' : '#B97834',
              strength: kind === 'bottom' ? 0.52 : 0.28,
            },
            contactAO: {
              minY: 0.028,
              maxY: 0.302,
              bottomStrength: 0.30,
              topStrength: 0.26,
              falloff: 0.0034,
              rimRadius: 0.314,
              rimStrength: 0.16,
            },
            cacheTag: `hero-sponge-${tag}`,
          }
        ),
        { rimColor: '#FFE0A6', rimStrength: 0.30, rimPower: 2.6, topBias: 0.45, cacheTag: `hero-rim-sponge-${tag}` }
      );
      const prevComp = m.onBeforeCompile;
      const prevKey = m.customProgramCacheKey?.bind(m);
      m.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|tier-detail-${kind}-v2`;
      m.onBeforeCompile = (shader, renderer) => {
        prevComp?.(shader, renderer);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying float vSpongeLocalY;\nvarying vec3 vSpongeObjPos;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSpongeLocalY = position.y;\nvSpongeObjPos = position;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vSpongeLocalY;\nvarying vec3 vSpongeObjPos;\nfloat spHash3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }')
          .replace(
            '#include <color_fragment>',
            /* glsl */ `
            #include <color_fragment>
            {
              float dSeam = min(
                min(abs(vSpongeLocalY - 0.028), abs(vSpongeLocalY - 0.096)),
                min(
                  min(abs(vSpongeLocalY - 0.132), abs(vSpongeLocalY - 0.196)),
                  min(abs(vSpongeLocalY - 0.242), abs(vSpongeLocalY - 0.296))
                )
              );
              float moistBand = 1.0 - smoothstep(0.0005, 0.0095, dSeam);
              float microCrevice = 1.0 - smoothstep(0.0, 0.0028, dSeam);
              diffuseColor.rgb *= mix(vec3(1.0), vec3(0.84, 0.72, 0.56), moistBand * 0.52);
              diffuseColor.rgb *= (1.0 - microCrevice * 0.20);
              ${
                kind === 'bottom'
                  ? `// 底层：浓郁烘烤深焦糖壳渐变
              float crustRim = smoothstep(0.36, 0.44, length(vSpongeObjPos.xz));
              diffuseColor.rgb *= mix(vec3(0.95, 0.88, 0.78), vec3(0.72, 0.48, 0.28), crustRim * 0.72);`
                  : kind === 'mid'
                    ? `// 中层：嵌入真实感红莓/果干碎斑粒（打破单一纯色圆饼！）
              vec3 cell = floor(vSpongeObjPos * 58.0);
              float fleck = step(0.86, spHash3(cell));
              float speckSize = smoothstep(0.42, 0.16, length(fract(vSpongeObjPos * 58.0) - 0.5));
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.68, 0.16, 0.22), fleck * speckSize * 0.78);`
                    : `// 上层：顶缘浸润树莓利口酒露渐变光泽带
              float topSyrup = smoothstep(0.278, 0.296, vSpongeLocalY);
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.22, 0.28), topSyrup * 0.46);`
              }
            }
            `
          );
      };
      return m;
    };

    const spongeBottomMat = makeSpongeTierMat(flavor.spongeBottomColor, 'bottom', 'bottom');
    const spongeMidMat = makeSpongeTierMat(flavor.spongeColor, 'mid', 'mid');
    const spongeTopMat = makeSpongeTierMat(flavor.spongeTopColor, 'top', 'top');
    const spongeMat = spongeMidMat;

    // Layer 5: Honeyed Strawberry-Caramel Cream Core GLSL Shader
    const caramelMat = createMoltenCaramelLavaMaterial({
      deepColor: flavor.caramelDeep,
      warmColor: flavor.caramelWarm,
      highlightColor: flavor.caramelHighlight,
    });

    // Layer 5 Ribbons & Drops: Softened Honey-Cream Ooze (matte-satin glow, zero plastic mirror glare!)
    const caramelRibbonMat = enhanceMaterialWithFoodSSS(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(flavor.caramelWarm),
        emissive: new THREE.Color(flavor.caramelWarm),
        emissiveIntensity: 0.08,
        roughness: 0.28,
        metalness: 0.0,
        transparent: true,
        opacity: 0.88,
        ior: 1.44,
        clearcoat: 0.0,
        specularIntensity: 0.45,
        envMapIntensity: 0.36,
      }),
      {
        sssColor: flavor.caramelHighlight,
        sssStrength: 0.44,
        wrapAmount: 0.66,
        backScatterPower: 2.2,
        rimWarmth: 0.44,
        cacheTag: 'hero-caramel-ribbon',
      }
    );

    // Layer 4: 晶莹红宝石半透明鲜切草莓果胶浮岛（大幅提高 transmission 折射与亮面清漆反光！）
    const jellyMat = enhanceMaterialWithFoodSSS(
      new THREE.MeshPhysicalMaterial({
        color: flavor.jellyColor,
        map: textures.jellyPulpMap,
        normalMap: textures.jellyNormalMap,
        normalScale: JELLY_NORMAL_SCALE,
        roughness: 0.08,
        transmission: 0.54,
        thickness: 0.18,
        attenuationColor: new THREE.Color(flavor.jellyColor),
        attenuationDistance: 0.26,
        ior: 1.46,
        clearcoat: 0.82,
        clearcoatRoughness: 0.08,
        specularIntensity: 0.85,
        envMapIntensity: 0.68,
      }),
      {
        sssColor: flavor.jellySssColor,
        sssStrength: 0.78,
        wrapAmount: 0.76,
        backScatterPower: 1.9,
        rimWarmth: 0.64,
        contactAO: {
          minY: 0.196,
          maxY: 0.238,
          bottomStrength: 0.28,
          topStrength: 0.24,
          falloff: 0.0032,
        },
        cacheTag: 'hero-jelly-v3',
      }
    );

    // 立体埋入果胶层的深红果肉粒与香烤杏仁脆片材质
    const fruitChunkMat = enhanceMaterialWithFoodSSS(
      new THREE.MeshPhysicalMaterial({
        color: flavor.berryColor,
        roughness: 0.22,
        clearcoat: 0.45,
        clearcoatRoughness: 0.18,
        envMapIntensity: 0.42,
      }),
      { sssColor: flavor.berrySssColor, sssStrength: 0.52, cacheTag: 'hero-fruit-chunk' }
    );
    const almondShardMat = new THREE.MeshPhysicalMaterial({
      color: '#D8A66C',
      roughness: 0.58,
      clearcoat: 0.12,
      envMapIntensity: 0.30,
    });

    // 破壳退让半透明奶油光环材质（供爆炸时下/中香缇护环优雅外扩淡出，彻底显露内部流心与果胶芯！）
    const mousseRingExpandMat = enhanceWithStylizedFresnelRim(
      enhanceMaterialWithFoodSSS(
        new THREE.MeshPhysicalMaterial({
          color: flavor.mousseColor,
          map: textures.vanillaMousseMap,
          bumpMap: textures.chantillyBumpMap,
          bumpScale: 0.0026,
          roughnessMap: textures.chantillyRoughnessMap,
          roughness: 1.0,
          transparent: true,
          opacity: 1.0,
          sheen: 0.44,
          sheenColor: new THREE.Color('#FFF4D8'),
          envMapIntensity: 0.38,
        }),
        {
          sssColor: flavor.mousseSssColor,
          sssStrength: 0.42,
          wrapAmount: 0.64,
          cacheTag: 'hero-mousse-ring-expand',
        }
      ),
      { rimColor: '#FFF0C6', rimStrength: 0.28, rimPower: 2.6, topBias: 0.48, cacheTag: 'hero-rim-mousse-ring' }
    );

    // Layer 3 (Wall): Bourbon Vanilla Mascarpone Chantilly Filling
    const mousseWallMat = enhanceWithStylizedFresnelRim(
      enhanceMaterialWithFoodSSS(
        new THREE.MeshPhysicalMaterial({
          color: flavor.mousseColor,
          map: textures.vanillaMousseMap,
          bumpMap: textures.chantillyBumpMap,
          bumpScale: 0.0026,
          roughnessMap: textures.chantillyRoughnessMap,
          roughness: 1.0,
          clearcoat: 0.0,
          sheen: 0.44,
          sheenColor: new THREE.Color('#FFF4D8'),
          envMapIntensity: 0.38,
        }),
        {
          sssColor: flavor.mousseSssColor,
          sssStrength: 0.42,
          wrapAmount: 0.64,
          backScatterPower: 2.3,
          rimWarmth: 0.44,
          contactAO: {
            minY: 0.094,
            maxY: 0.319,
            bottomStrength: 0.16,
            topStrength: 0.10,
            falloff: 0.0028,
          },
          cacheTag: 'hero-mousse-wall',
        }
      ),
      { rimColor: '#FFF0C6', rimStrength: 0.24, rimPower: 2.8, topBias: 0.48, cacheTag: 'hero-rim-mousse-wall' }
    );

    // Layer 3 (Slice Cap): Creamy Silky Chantilly Cut Face with crisp Vanilla Bean Specks
    const mousseCapMat = enhanceWithStylizedFresnelRim(
      enhanceMaterialWithFoodSSS(
        new THREE.MeshPhysicalMaterial({
          color: flavor.mousseColor,
          map: textures.vanillaMousseMap,
          normalMap: textures.mousseSliceNormalMap,
          normalScale: MOUSSE_CAP_NORMAL_SCALE,
          roughness: 0.56,
          clearcoat: 0.0,
          sheen: 0.42,
          sheenColor: new THREE.Color('#FFF4D8'),
          envMapIntensity: 0.36,
        }),
        {
          sssColor: flavor.mousseSssColor,
          sssStrength: 0.42,
          wrapAmount: 0.64,
          backScatterPower: 2.3,
          rimWarmth: 0.44,
          contactAO: {
            minY: 0.094,
            maxY: 0.319,
            bottomStrength: 0.16,
            topStrength: 0.10,
            falloff: 0.0028,
          },
          cacheTag: 'hero-mousse-cap',
        }
      ),
      { rimColor: '#FFF0C6', rimStrength: 0.22, rimPower: 2.8, topBias: 0.45, cacheTag: 'hero-rim-mousse-cap' }
    );

    // Layer 2: 高对比镜面流瀑皇冠淋面与艺术长挂滴（粉樱/黑巧/翠绿镜面釉，彻底区分于白奶油！）
    const glazeMat = enhanceWithStylizedFresnelRim(
      enhanceMaterialWithFoodSSS(
        new THREE.MeshPhysicalMaterial({
          color: flavor.glazeColor,
          bumpMap: textures.chantillyBumpMap,
          bumpScale: 0.0018,
          roughness: 0.14,
          metalness: 0.0,
          clearcoat: 0.86,
          clearcoatRoughness: 0.10,
          sheen: 0.25,
          sheenColor: new THREE.Color(flavor.glazeBright),
          specularIntensity: 0.85,
          envMapIntensity: 0.72,
        }),
        {
          sssColor: flavor.glazeBright,
          glazeDeepColor: flavor.glazeDeep,
          sssStrength: 0.36,
          wrapAmount: 0.64,
          backScatterPower: 2.4,
          rimWarmth: 0.44,
          glazeMicroBreakup: 0.0,
          contactAO: {
            minY: 0.001,
            maxY: 0.336,
            bottomStrength: 0.14,
            topStrength: 0.0,
            falloff: 0.0028,
          },
          cacheTag: 'hero-chantilly-crown',
        }
      ),
      { rimColor: '#FFF2CE', rimStrength: 0.26, rimPower: 2.7, topBias: 0.50, cacheTag: 'hero-rim-crown' }
    );

    // Layer 2 Semi-Naked Side Crumb-Coat Veil: translucent palette-knife cream stripes revealing 3 golden chiffon tiers
    const semiNakedCoatMat = enhanceWithStylizedFresnelRim(
      enhanceMaterialWithFoodSSS(
        new THREE.MeshPhysicalMaterial({
          color: flavor.glazeColor,
          map: textures.semiNakedCoatMap,
          alphaMap: textures.semiNakedAlphaMap,
          bumpMap: textures.chantillyBumpMap,
          bumpScale: 0.0024,
          roughnessMap: textures.chantillyRoughnessMap,
          roughness: 1.0,
          clearcoat: 0.0,
          transparent: true,
          depthWrite: false,
          alphaTest: 0.02,
          sheen: 0.40,
          sheenColor: new THREE.Color('#FFF4D8'),
          envMapIntensity: 0.36,
        }),
        {
          sssColor: flavor.glazeBright,
          glazeDeepColor: flavor.glazeDeep,
          sssStrength: 0.34,
          wrapAmount: 0.62,
          backScatterPower: 2.4,
          rimWarmth: 0.40,
          glazeMicroBreakup: 0.0,
          cacheTag: 'hero-semi-naked',
        }
      ),
      { rimColor: '#FFF0CA', rimStrength: 0.22, rimPower: 2.8, topBias: 0.45, cacheTag: 'hero-rim-seminaked' }
    );

    // Layer 1 & Embedded Fruit Garnish Materials (Fresh Strawberries, Cut Faces, Frosted Blueberries, Macarons & Shavings)
    const createStrawberryOuterMat = (enableWobble: boolean, cacheTag: string) =>
      enhanceWithStylizedFresnelRim(
        enhanceMaterialWithFoodSSS(
          new THREE.MeshPhysicalMaterial({
            color: flavor.berryColor,
            map: textures.strawberrySkinMap,
            normalMap: textures.strawberrySeedNormalMap,
            normalScale: STRAWBERRY_SKIN_NORMAL_SCALE,
            roughness: 0.25,
            clearcoat: 0.0,
            sheen: 0.26,
            sheenColor: new THREE.Color('#FFE8EC'),
            sheenRoughness: 0.48,
            envMapIntensity: 0.40,
          }),
          {
            sssColor: flavor.berrySssColor,
            sssStrength: 0.48,
            wrapAmount: 0.62,
            rimWarmth: 0.44,
            enableWobble,
            cacheTag,
          }
        ),
        { rimColor: '#FFC8B4', rimStrength: 0.34, rimPower: 2.5, topBias: 0.48, cacheTag: `rim-${cacheTag}` }
      );

    const createStrawberryCutMat = (enableWobble: boolean, cacheTag: string) =>
      enhanceMaterialWithFoodSSS(
        new THREE.MeshPhysicalMaterial({
          color: '#FFFFFF',
          map: textures.strawberryCutMap,
          normalMap: textures.strawberryCutNormalMap,
          normalScale: STRAWBERRY_CUT_NORMAL_SCALE,
          roughness: 0.24,
          clearcoat: 0.0,
          sheen: 0.22,
          sheenColor: new THREE.Color('#FFF2EE'),
          envMapIntensity: 0.38,
        }),
        {
          sssColor: '#FF8FA0',
          sssStrength: 0.52,
          wrapAmount: 0.66,
          rimWarmth: 0.42,
          enableWobble,
          cacheTag,
        }
      );

    const strawberryOuterMat = createStrawberryOuterMat(false, 'hero-strawberry-outer');
    const strawberryCutMat = createStrawberryCutMat(false, 'hero-strawberry-cut');
    const embeddedStrawberryOuterMat = createStrawberryOuterMat(true, 'hero-embedded-strawberry-outer');
    const embeddedStrawberryCutMat = createStrawberryCutMat(true, 'hero-embedded-strawberry-cut');

    const calyxMat = enhanceMaterialWithFoodSSS(
      new THREE.MeshPhysicalMaterial({
        color: '#5C8A40',
        roughness: 0.58,
        clearcoat: 0.0,
        sheen: 0.28,
        sheenColor: new THREE.Color('#BFE09A'),
        envMapIntensity: 0.30,
        side: THREE.DoubleSide,
      }),
      {
        sssColor: '#98CC5A',
        sssStrength: 0.36,
        wrapAmount: 0.62,
        enableWobble: false,
        cacheTag: 'hero-strawberry-calyx',
      }
    );

    const blueberryMat = enhanceWithStylizedFresnelRim(
      enhanceMaterialWithFoodSSS(
        new THREE.MeshPhysicalMaterial({
          color: '#FFFFFF',
          map: textures.blueberryFrostMap,
          roughness: 0.58,
          clearcoat: 0.0,
          sheen: 0.65,
          sheenColor: new THREE.Color('#DCE4F8'),
          sheenRoughness: 0.48,
          envMapIntensity: 0.32,
        }),
        {
          sssColor: '#7684C4',
          sssStrength: 0.24,
          wrapAmount: 0.56,
          enableWobble: false,
          cacheTag: 'hero-blueberry',
        }
      ),
      { rimColor: '#DCE6FF', rimStrength: 0.32, rimPower: 2.4, topBias: 0.52, cacheTag: 'hero-rim-blueberry' }
    );

    const createMacaronShellMat = (color: string, cacheTag: string) =>
      enhanceWithStylizedFresnelRim(
        enhanceMaterialWithFoodSSS(
          new THREE.MeshPhysicalMaterial({
            color,
            bumpMap: textures.macaronShellBumpMap,
            bumpScale: 0.0022,
            roughness: 0.48,
            clearcoat: 0.0,
            sheen: 0.26,
            sheenColor: new THREE.Color('#FFF8F0'),
            envMapIntensity: 0.36,
          }),
          {
            sssColor: '#FFEAD8',
            sssStrength: 0.28,
            wrapAmount: 0.58,
            enableWobble: false,
            cacheTag,
          }
        ),
        { rimColor: '#FFF0CE', rimStrength: 0.30, rimPower: 2.6, topBias: 0.48, cacheTag: `rim-${cacheTag}` }
      );

    const macaronPrimaryMat = createMacaronShellMat(flavor.macaronPrimaryColor, 'hero-macaron-primary');
    const macaronSecondaryMat = createMacaronShellMat(flavor.macaronSecondaryColor, 'hero-macaron-secondary');

    const whiteChocMat = enhanceMaterialWithFoodSSS(
      new THREE.MeshPhysicalMaterial({
        color: flavor.chocolateColor,
        roughness: 0.38,
        clearcoat: 0.0,
        sheen: 0.24,
        sheenColor: new THREE.Color('#FFFDF6'),
        envMapIntensity: 0.34,
        side: THREE.DoubleSide,
      }),
      {
        sssColor: '#FFF3DA',
        sssStrength: 0.22,
        wrapAmount: 0.56,
        enableWobble: false,
        cacheTag: 'hero-white-choc',
      }
    );

    const icingSugarMat = new THREE.MeshPhysicalMaterial({
      color: '#FFFFFF',
      emissive: new THREE.Color('#FFF9EE'),
      emissiveIntensity: 0.14,
      roughness: 0.85,
      clearcoat: 0.0,
      envMapIntensity: 0.22,
    });

    const goldLeafMat = new THREE.MeshPhysicalMaterial({
      color: '#F5D276',
      metalness: 0.92,
      roughness: 0.20,
      anisotropy: 0.35,
      clearcoat: 0.06,
      clearcoatRoughness: 0.22,
      envMapIntensity: 0.72,
      side: THREE.DoubleSide,
    });

    const chantillyMat = enhanceWithStylizedFresnelRim(
      enhanceMaterialWithFoodSSS(
        new THREE.MeshPhysicalMaterial({
          color: flavor.chantillyColor,
          bumpMap: textures.chantillyBumpMap,
          bumpScale: 0.0025,
          roughnessMap: textures.chantillyRoughnessMap,
          roughness: 1.0,
          clearcoat: 0.0,
          sheen: 0.48,
          sheenColor: new THREE.Color('#FFF8EA'),
          envMapIntensity: 0.36,
        }),
        {
          sssColor: flavor.mousseSssColor,
          sssStrength: 0.42,
          wrapAmount: 0.64,
          enableWobble: false,
          cacheTag: 'hero-chantilly',
        }
      ),
      { rimColor: '#FFF2CE', rimStrength: 0.24, rimPower: 2.8, topBias: 0.46, cacheTag: 'hero-rim-chantilly' }
    );

    // Sculpted Botanical Garnish Food-SSS Materials (matte natural foliage, zero plastic gloss!)
    const mintLeafMat = enhanceMaterialWithFoodSSS(
      new THREE.MeshPhysicalMaterial({
        color: '#5A8D44',
        bumpMap: textures.berryFuzzNormalMap,
        bumpScale: 0.0022,
        roughness: 0.56,
        clearcoat: 0.0,
        sheen: 0.36,
        sheenColor: new THREE.Color('#CBE8A4'),
        envMapIntensity: 0.32,
        side: THREE.DoubleSide,
      }),
      {
        sssColor: '#98CC5A',
        sssStrength: 0.38,
        wrapAmount: 0.62,
        enableWobble: false,
        cacheTag: 'hero-mint-leaf',
      }
    );

    const rosemaryMat = enhanceMaterialWithFoodSSS(
      new THREE.MeshPhysicalMaterial({
        color: '#638C52',
        roughness: 0.58,
        clearcoat: 0.0,
        sheen: 0.40,
        sheenColor: new THREE.Color('#CFE2C2'),
        envMapIntensity: 0.30,
        side: THREE.DoubleSide,
      }),
      {
        sssColor: '#8FB876',
        sssStrength: 0.28,
        wrapAmount: 0.54,
        enableWobble: false,
        cacheTag: 'hero-rosemary',
      }
    );

    const daisyPetalMat = enhanceMaterialWithFoodSSS(
      new THREE.MeshPhysicalMaterial({
        color: '#FFFDF5',
        roughness: 0.48,
        clearcoat: 0.0,
        sheen: 0.52,
        sheenColor: new THREE.Color('#FFFFFF'),
        envMapIntensity: 0.32,
        side: THREE.DoubleSide,
      }),
      {
        sssColor: '#FFF2CC',
        sssStrength: 0.36,
        wrapAmount: 0.66,
        enableWobble: false,
        cacheTag: 'hero-daisy-petal',
      }
    );

    const blushPetalMat = enhanceMaterialWithFoodSSS(
      new THREE.MeshPhysicalMaterial({
        color: '#F7CBD6',
        roughness: 0.48,
        clearcoat: 0.0,
        sheen: 0.54,
        sheenColor: new THREE.Color('#FFEBF2'),
        envMapIntensity: 0.32,
        side: THREE.DoubleSide,
      }),
      {
        sssColor: '#FF98B4',
        sssStrength: 0.40,
        wrapAmount: 0.64,
        enableWobble: false,
        cacheTag: 'hero-blush-petal',
      }
    );

    const gardenRoseMat = enhanceMaterialWithFoodSSS(
      new THREE.MeshPhysicalMaterial({
        color: '#F0A4B6',
        roughness: 0.46,
        clearcoat: 0.0,
        sheen: 0.60,
        sheenColor: new THREE.Color('#FFE2EA'),
        envMapIntensity: 0.32,
        side: THREE.DoubleSide,
      }),
      {
        sssColor: '#FF86A4',
        sssStrength: 0.46,
        wrapAmount: 0.68,
        rimWarmth: 0.44,
        enableWobble: false,
        cacheTag: 'hero-garden-rose',
      }
    );

    const pollenMat = new THREE.MeshPhysicalMaterial({
      color: '#EBB942',
      bumpMap: textures.crunchBumpMap,
      bumpScale: 0.0026,
      roughness: 0.68,
      clearcoat: 0.0,
      sheen: 0.48,
      sheenColor: new THREE.Color('#FFE588'),
      envMapIntensity: 0.28,
    });

    return {
      marbleStandMat,
      goldTrimMat,
      doilyMat,
      crunchMat,
      spongeMat,
      spongeBottomMat,
      spongeMidMat,
      spongeTopMat,
      caramelMat,
      caramelRibbonMat,
      jellyMat,
      fruitChunkMat,
      almondShardMat,
      mousseRingExpandMat,
      mousseWallMat,
      mousseCapMat,
      glazeMat,
      semiNakedCoatMat,
      strawberryOuterMat,
      strawberryCutMat,
      embeddedStrawberryOuterMat,
      embeddedStrawberryCutMat,
      calyxMat,
      blueberryMat,
      macaronPrimaryMat,
      macaronSecondaryMat,
      whiteChocMat,
      icingSugarMat,
      goldLeafMat,
      chantillyMat,
      mintLeafMat,
      rosemaryMat,
      daisyPetalMat,
      blushPetalMat,
      gardenRoseMat,
      pollenMat,
    };
  }, [textures, craftAssets, pedestalWoodPbr, doilyMaps]);

  // Dispose all component-owned materials & procedural textures on unmount
  useEffect(() => {
    return () => {
      Object.values(materials).forEach((mat) => mat.dispose());
      pedestalWoodPbr.map.dispose();
      pedestalWoodPbr.bumpMap.dispose();
      pedestalWoodPbr.roughnessMap.dispose();
      doilyMaps.colorMap.dispose();
      doilyMaps.alphaMap.dispose();
      doilyMaps.bumpMap.dispose();
      neutralWhiteTex.dispose();
    };
  }, [materials, pedestalWoodPbr, doilyMaps, neutralWhiteTex]);

  // Live-update all 8 layer materials when `selectedFlavor` changes (zero shader recompilation!)
  useEffect(() => {
    materials.crunchMat.color.set(flavor.crunchColor);
    updateFoodSSSUniforms(materials.crunchMat, {
      sssColor: flavor.id === 'black_gold_caramel' ? '#7A482A' : '#B87236',
    });

    materials.spongeBottomMat.color.set(flavor.spongeBottomColor);
    materials.spongeMidMat.color.set(flavor.spongeColor);
    materials.spongeTopMat.color.set(flavor.spongeTopColor);
    [
      materials.spongeBottomMat,
      materials.spongeMidMat,
      materials.spongeTopMat,
    ].forEach((sm, si) => {
      sm.sheenColor.set(flavor.spongeSssColor);
      updateFoodSSSUniforms(sm, {
        sssColor: flavor.spongeSssColor,
        maillardColor: flavor.id === 'black_gold_caramel' ? '#4A2814' : si === 0 ? '#8A4818' : '#B97834',
      });
    });

    materials.fruitChunkMat.color.set(flavor.berryColor);
    updateFoodSSSUniforms(materials.fruitChunkMat, { sssColor: flavor.berrySssColor });
    materials.almondShardMat.color.set(flavor.id === 'black_gold_caramel' ? '#B87642' : '#D8A66C');

    const useSpecksRim = flavor.mousseVanillaSpecks > 0.45;
    materials.mousseRingExpandMat.color.set(flavor.mousseColor);
    materials.mousseRingExpandMat.map = useSpecksRim ? textures.vanillaMousseMap : neutralWhiteTex;
    updateFoodSSSUniforms(materials.mousseRingExpandMat, { sssColor: flavor.mousseSssColor });

    materials.caramelMat.uniforms.uDeepColor.value.set(flavor.caramelDeep);
    materials.caramelMat.uniforms.uWarmColor.value.set(flavor.caramelWarm);
    materials.caramelMat.uniforms.uHighlightColor.value.set(flavor.caramelHighlight);

    materials.caramelRibbonMat.color.set(flavor.caramelWarm);
    materials.caramelRibbonMat.emissive.set(flavor.caramelWarm);
    updateFoodSSSUniforms(materials.caramelRibbonMat, {
      sssColor: flavor.caramelHighlight,
    });

    materials.jellyMat.color.set(flavor.jellyColor);
    updateFoodSSSUniforms(materials.jellyMat, {
      sssColor: flavor.jellySssColor,
      sssStrength: flavor.garnishTheme === 'matcha_yuzu' ? 0.68 : 0.62,
      wrapAmount: 0.70,
    });

    const useSpecks = flavor.mousseVanillaSpecks > 0.45;
    const mousseMap = useSpecks ? textures.vanillaMousseMap : neutralWhiteTex;
    materials.mousseWallMat.color.set(flavor.mousseColor);
    materials.mousseWallMat.map = mousseMap;
    updateFoodSSSUniforms(materials.mousseWallMat, { sssColor: flavor.mousseSssColor });

    materials.mousseCapMat.color.set(flavor.mousseColor);
    materials.mousseCapMat.map = mousseMap;
    updateFoodSSSUniforms(materials.mousseCapMat, { sssColor: flavor.mousseSssColor });

    materials.glazeMat.color.set(flavor.glazeColor);
    updateFoodSSSUniforms(materials.glazeMat, {
      sssColor: flavor.glazeBright,
      glazeDeepColor: flavor.glazeDeep,
      sssStrength: 0.36,
      rimWarmth: 0.44,
    });

    materials.semiNakedCoatMat.color.set(flavor.glazeColor);
    updateFoodSSSUniforms(materials.semiNakedCoatMat, {
      sssColor: flavor.glazeBright,
      glazeDeepColor: flavor.glazeDeep,
    });

    materials.strawberryOuterMat.color.set(flavor.berryColor);
    updateFoodSSSUniforms(materials.strawberryOuterMat, { sssColor: flavor.berrySssColor });
    materials.embeddedStrawberryOuterMat.color.set(flavor.berryColor);
    updateFoodSSSUniforms(materials.embeddedStrawberryOuterMat, { sssColor: flavor.berrySssColor });

    materials.macaronPrimaryMat.color.set(flavor.macaronPrimaryColor);
    materials.macaronSecondaryMat.color.set(flavor.macaronSecondaryColor);

    materials.whiteChocMat.color.set(flavor.chocolateColor);
    updateFoodSSSUniforms(materials.whiteChocMat, {
      sssColor: flavor.garnishTheme === 'black_gold' ? '#C48A5E' : '#FFF3DA',
      sssStrength: 0.22,
    });

    materials.chantillyMat.color.set(flavor.chantillyColor);
    updateFoodSSSUniforms(materials.chantillyMat, { sssColor: flavor.mousseSssColor });
  }, [flavor, materials, textures, neutralWhiteTex]);

  const rootRef = useRef<THREE.Group>(null);
  const wobbleCrownRef = useRef<THREE.Group>(null);
  const explodeAnimRef = useRef(targetExplode);
  const explodeVelRef = useRef(0);
  const sliceAnimRef = useRef(targetSlice);
  const sliceVelRef = useRef(0);
  const smoothGlazeRef = useRef(targetGlaze);
  const prevStepRef = useRef(store.currentStep);
  const wobbleRef = useRef({
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    prevTweezer: 0,
    prevKnifePulse: 0,
    prevExplodeTarget: targetExplode,
    prevSliceTarget: targetSlice,
  });
  const [, forceRender] = useState(0);
  const projVec = useMemo(() => new THREE.Vector3(), []);
  const worldScaleVec = useMemo(() => new THREE.Vector3(), []);
  const camRightVec = useMemo(() => new THREE.Vector3(), []);
  const camForwardVec = useMemo(() => new THREE.Vector3(), []);
  const hudRectsRef = useRef({ topBarBottom: 0, botConsoleTop: 99999, lastSample: -1 });

  useEffect(() => {
    if (rootRef.current) {
      rootRef.current.rotation.y = rotation[1];
    }
  }, [rotation[1]]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();
    const liveState = useGameStore.getState();

    if (rootRef.current) {
      const targetYaw =
        liveState.currentStep === 6 && enableStep6GlazePour
          ? rotation[1] + liveState.turntableAngle
          : rotation[1];
      rootRef.current.rotation.y = THREE.MathUtils.lerp(
        rootRef.current.rotation.y,
        targetYaw,
        1 - Math.exp(-dt * 14)
      );
    }

    const wb = wobbleRef.current;

    if (prevStepRef.current !== store.currentStep) {
      prevStepRef.current = store.currentStep;
      smoothGlazeRef.current = targetGlaze;
      wb.prevTweezer = liveState.tweezerPulse;
      wb.prevKnifePulse = liveState.knifeStrikePulse;
      wb.prevExplodeTarget = targetExplode;
      wb.prevSliceTarget = targetSlice;
      wb.vx += 0.045;
      wb.vz += 0.035;
    }

    const prevE = explodeAnimRef.current;
    const prevS = sliceAnimRef.current;
    const prevG = smoothGlazeRef.current;

    // Trigger soft-body Q弹 jelly impulses on garnish drops, knife cleave, glaze finish & explode transitions
    if (liveState.tweezerPulse !== wb.prevTweezer) {
      wb.prevTweezer = liveState.tweezerPulse;
      wb.vx += Math.cos(liveState.tweezerPulse * 2.1) * 0.088;
      wb.vz += Math.sin(liveState.tweezerPulse * 2.1) * 0.088;
    }
    if (liveState.knifeStrikePulse !== wb.prevKnifePulse) {
      wb.prevKnifePulse = liveState.knifeStrikePulse;
      wb.vx += 0.155;
      wb.vz += 0.135;
    }
    if (Math.abs(targetSlice - wb.prevSliceTarget) > 0.05) {
      const opening = targetSlice > wb.prevSliceTarget;
      wb.prevSliceTarget = targetSlice;
      wb.vx += opening ? 0.095 : -0.070;
      wb.vz += opening ? 0.082 : -0.058;
    }
    if (Math.abs(targetExplode - wb.prevExplodeTarget) > 0.04) {
      wb.prevExplodeTarget = targetExplode;
      wb.vx += 0.068;
      wb.vz -= 0.052;
    }

    // Second-order Damped Harmonic Spring Physics (subtle ~3.5% organic overshoot & tactile settle!)
    const springK = 128;
    const springC = 17.5;

    const eForce = (targetExplode - prevE) * springK - explodeVelRef.current * springC;
    explodeVelRef.current += eForce * dt;
    explodeAnimRef.current = Math.max(0, prevE + explodeVelRef.current * dt);

    const sForce = (targetSlice - prevS) * springK - sliceVelRef.current * springC;
    sliceVelRef.current += sForce * dt;
    sliceAnimRef.current = Math.max(0, prevS + sliceVelRef.current * dt);

    if (store.currentStep === 6 && targetGlaze >= 0.996 && prevG < 0.995) {
      smoothGlazeRef.current = THREE.MathUtils.lerp(prevG, 1.0, 1 - Math.exp(-dt * 10.5));
      if (smoothGlazeRef.current >= 0.994) {
        smoothGlazeRef.current = 1.0;
        wb.vx += 0.074;
        wb.vz += 0.058;
        forceRender((v) => (v + 1) % 10000);
      }
    } else {
      smoothGlazeRef.current = targetGlaze;
    }

    // Underdamped 2D soft-body mousse/gelatin jelly wobble spring (195 stiffness, 7.4 damping -> ~2.2 Hz crisp settle)
    const wobbleK = 195.0;
    const wobbleC = 7.4;
    wb.vx += (-wb.x * wobbleK - wb.vx * wobbleC) * dt;
    wb.vz += (-wb.z * wobbleK - wb.vz * wobbleC) * dt;
    wb.x += wb.vx * dt;
    wb.z += wb.vz * dt;
    const rawWobbleMag = Math.hypot(wb.x, wb.z);
    if (rawWobbleMag > 0.016) {
      const clampScale = 0.016 / rawWobbleMag;
      wb.x *= clampScale;
      wb.z *= clampScale;
    } else if (rawWobbleMag < 0.00004 && Math.hypot(wb.vx, wb.vz) < 0.0005) {
      wb.x = 0;
      wb.z = 0;
      wb.vx = 0;
      wb.vz = 0;
    }

    if (Math.abs(explodeAnimRef.current - targetExplode) < 0.0008 && Math.abs(explodeVelRef.current) < 0.002) {
      explodeAnimRef.current = targetExplode;
      explodeVelRef.current = 0;
    }
    if (Math.abs(sliceAnimRef.current - targetSlice) < 0.0008 && Math.abs(sliceVelRef.current) < 0.002) {
      sliceAnimRef.current = targetSlice;
      sliceVelRef.current = 0;
    }

    if (
      Math.abs(explodeAnimRef.current - prevE) > 0.0004 ||
      Math.abs(sliceAnimRef.current - prevS) > 0.0004
    ) {
      forceRender((v) => (v + 1) % 10000);
    }

    const e = explodeAnimRef.current;
    const wobbleAtten = Math.max(0.28, 1.0 - e * 0.65);
    const wxEff = wb.x * wobbleAtten;
    const wzEff = wb.z * wobbleAtten;
    const wAmpEff = Math.min(0.020, Math.hypot(wxEff, wzEff) * 1.15);

    materials.semiNakedCoatMat.opacity = Math.max(0, 1.0 - e / 0.06);
    // 破壳显芯魔法：爆炸时上下外圈奶油护环轻盈外扩并柔化为 0.14 薄纱光环，彻底释放正中琥珀拉丝与红宝石果胶芯！
    materials.mousseRingExpandMat.opacity =
      e <= 0.05 ? 1.0 : THREE.MathUtils.lerp(1.0, 0.14, THREE.MathUtils.smoothstep(e, 0.05, 0.45));
    materials.mousseRingExpandMat.depthWrite = e <= 0.06;

    materials.caramelMat.uniforms.uTime.value = t;
    materials.caramelMat.uniforms.uCutProgress.value = sliceAnimRef.current;
    materials.caramelMat.uniforms.uExplodeProgress.value = e;
    materials.caramelMat.uniforms.uWobbleVec.value.set(wxEff, wzEff);
    materials.caramelMat.uniforms.uWobbleAmp.value = wAmpEff;
    for (const sssMat of [
      materials.crunchMat,
      materials.spongeBottomMat,
      materials.spongeMidMat,
      materials.spongeTopMat,
      materials.caramelRibbonMat,
      materials.jellyMat,
      materials.fruitChunkMat,
      materials.mousseRingExpandMat,
      materials.mousseWallMat,
      materials.mousseCapMat,
      materials.glazeMat,
      materials.semiNakedCoatMat,
      materials.embeddedStrawberryOuterMat,
      materials.embeddedStrawberryCutMat,
    ]) {
      updateFoodSSSUniforms(sssMat, {
        explodeProgress: e,
        wobbleX: wxEff,
        wobbleZ: wzEff,
        wobbleAmp: wAmpEff,
      });
    }
    if (wobbleCrownRef.current) {
      wobbleCrownRef.current.position.set(wxEff, -wAmpEff * 0.13, wzEff);
    }

    // 电影级“波浪错峰滞后”曲线，与下层渲染位移严格一致，保证 HUD 8 条金线精准咬合悬浮层！
    const stagger = (idx: number, val: number) => {
      const lag = idx * 0.042;
      return THREE.MathUtils.smoothstep(val, lag, Math.min(1.0, lag + 0.72));
    };

    // Project 8-layer callout screen anchors when exploded & callback provided
    if (onCalloutsUpdate && rootRef.current) {
      if (e > 0.08) {
        const worldScale = rootRef.current.getWorldScale(worldScaleVec).x;
        camRightVec.set(1, 0, 0).applyQuaternion(camera.quaternion).setY(0);
        if (camRightVec.lengthSq() > 1e-6) {
          camRightVec.normalize();
        } else {
          camRightVec.set(1, 0, 0);
        }
        camForwardVec.set(0, 0, -1).applyQuaternion(camera.quaternion).setY(0);
        if (camForwardVec.lengthSq() > 1e-6) {
          camForwardVec.normalize();
        } else {
          camForwardVec.set(0, 0, -1);
        }

        // Responsive vertical band clear of wrapped topbar & bottom console on mobile portrait, landscape & desktop viewports
        const isNarrow = size.width <= 860;
        const isShortLandscape = size.height <= 540 && size.width > size.height;
        const fallbackMinTop = isShortLandscape ? 54 : isNarrow ? 116 : size.height <= 760 ? 94 : 104;
        const fallbackMaxBot = Math.max(
          fallbackMinTop + (isShortLandscape ? 140 : isNarrow ? 170 : 210),
          size.height - (isShortLandscape ? 64 : isNarrow ? 196 : 204)
        );
        if (t - hudRectsRef.current.lastSample > 0.25 && typeof document !== 'undefined') {
          hudRectsRef.current.lastSample = t;
          const topEl = document.querySelector('.hud-topbar');
          const botEl = document.querySelector('.hud-bottom-console');
          const teleEl = document.querySelector('.atelier-telemetry-panel');
          const topRect = topEl?.getBoundingClientRect();
          const botRect = botEl?.getBoundingClientRect();
          const teleRect = teleEl?.getBoundingClientRect();
          hudRectsRef.current.topBarBottom = topRect && topRect.height > 0 ? topRect.bottom : 0;
          let lowestObstacleTop = size.height;
          if (botRect && botRect.height > 0) {
            lowestObstacleTop = Math.min(lowestObstacleTop, botRect.top);
          }
          if (teleRect && teleRect.height > 0) {
            lowestObstacleTop = Math.min(lowestObstacleTop, teleRect.top);
          }
          hudRectsRef.current.botConsoleTop = lowestObstacleTop;
        }
        const domMinTop = hudRectsRef.current.topBarBottom > 0 ? hudRectsRef.current.topBarBottom + (isShortLandscape ? 12 : 24) : 0;
        const domMaxBot =
          hudRectsRef.current.botConsoleTop < size.height
            ? hudRectsRef.current.botConsoleTop - (isShortLandscape ? 18 : isNarrow ? 42 : 48)
            : size.height;
        const minTop = Math.max(fallbackMinTop, domMinTop);
        const maxBot = Math.max(minTop + 120, Math.min(fallbackMaxBot, domMaxBot));
        const marginX = size.width <= 640 ? 8 : size.width <= 960 ? 12 : 24;

        interface ProjectedAnchor {
          meta: (typeof HERO_EIGHT_LAYERS)[number];
          sx: number;
          rawSy: number;
          sy: number;
          visible: boolean;
        }

        const projected: ProjectedAnchor[] = HERO_EIGHT_LAYERS.map((meta, mIdx) => {
          const isLeft = meta.side === 'left';
          const eStag = stagger(mIdx, e);
          const localY = meta.baseY + meta.explodeOffset * eStag;
          const sideSign = isLeft ? -1 : 1;

          projVec.set(0, localY, 0);
          rootRef.current!.localToWorld(projVec);
          projVec.addScaledVector(camRightVec, sideSign * meta.anchorRadius * 0.88 * worldScale);
          projVec.addScaledVector(camForwardVec, -meta.anchorRadius * 0.18 * worldScale);
          projVec.project(camera);

          const sx = (projVec.x * 0.5 + 0.5) * size.width;
          const rawSy = (-projVec.y * 0.5 + 0.5) * size.height;
          const sy = THREE.MathUtils.clamp(rawSy, minTop - 8, maxBot + 16);
          return { meta, sx, rawSy, sy, visible: projVec.z < 1 };
        });

        // Sort each side strictly monotonically top-to-bottom by screen Y -> ZERO crossing leader lines!
        const sortMonotonic = (arr: ProjectedAnchor[]) =>
          [...arr].sort((a, b) => a.rawSy - b.rawSy || Number(a.meta.index) - Number(b.meta.index));

        const leftSorted = sortMonotonic(projected.filter((p) => p.meta.side === 'left'));
        const rightSorted = sortMonotonic(projected.filter((p) => p.meta.side === 'right'));

        const labelYById = new Map<string, number>();
        leftSorted.forEach((item, idx) => {
          const denom = Math.max(1, leftSorted.length - 1);
          labelYById.set(item.meta.id, Math.round(minTop + (idx / denom) * (maxBot - minTop)));
        });
        rightSorted.forEach((item, idx) => {
          const denom = Math.max(1, rightSorted.length - 1);
          labelYById.set(item.meta.id, Math.round(minTop + (idx / denom) * (maxBot - minTop)));
        });

        const out: ScreenCallout[] = projected.map((p) => ({
          id: p.meta.id,
          index: p.meta.index,
          titleCn: p.meta.titleCn,
          titleFr: p.meta.titleFr,
          spec: p.meta.spec,
          side: p.meta.side,
          x: p.sx,
          y: p.sy,
          labelX: p.meta.side === 'left' ? marginX : size.width - marginX,
          labelY: labelYById.get(p.meta.id) ?? minTop,
          visible: p.visible,
        }));
        onCalloutsUpdate(out);
      } else {
        onCalloutsUpdate([]);
      }
    }
  });

  const eAnim = explodeAnimRef.current;
  const sAnim = sliceAnimRef.current;

  const isStep6PouringMode =
    enableStep6GlazePour &&
    store.currentStep === 6 &&
    (targetGlaze < 0.996 || smoothGlazeRef.current < 0.994);

  // Slice split & slide kinematics: 1/4 sector occupies theta in [0, PI/2], bisector along (+sin45, 0, +cos45)
  // slideDist = 0.118 seats the pulled-out 1/4 wedge + piped shells (reach 0.601m) cleanly 4.1cm inside the 0.642m oat stoneware platter!
  const isSplit = sAnim > 0.015;
  const slideProgress = THREE.MathUtils.smoothstep(sAnim, 0.14, 1.0);
  const slideDist = 0.118 * slideProgress;
  const slideLift = 0.0025 * slideProgress;
  const sliceOffset: [number, number, number] = [
    Math.SQRT1_2 * slideDist,
    slideLift,
    Math.SQRT1_2 * slideDist,
  ];
  const sliceYaw = 0.036 * slideProgress;

  const cakeBaseY = showMarbleStand ? 0.1218 : 0.0;

  return (
    <group
      ref={rootRef}
      position={position}
      rotation-x={rotation[0]}
      rotation-z={rotation[2]}
      scale={scale}
      onClick={(e) => {
        if (e.delta > 5) return;
        if (store.currentStep === 7 && rootRef.current) {
          e.stopPropagation();
          const localHit = rootRef.current.worldToLocal(e.point.clone());
          const radialDist = Math.hypot(localHit.x, localHit.z);
          const invR = radialDist > 0.01 ? 1 / radialDist : 0;
          wobbleRef.current.vx += (invR > 0 ? -localHit.x * invR : 0.7) * 0.085;
          wobbleRef.current.vz += (invR > 0 ? -localHit.z * invR : 0.7) * 0.085;
          if (store.garnishStep < 4) {
            const prec = THREE.MathUtils.clamp(1.0 - Math.abs(radialDist - 0.22) * 1.1, 0.72, 0.99);
            placeNextGarnishWithTweezers(prec);
          }
        }
      }}
    >
      {/* LAYER 8: Hand-Thrown Warm Oat Stoneware & Aged Honey-Walnut Cottage Cake Stand + Pierced Scalloped Lace Doily */}
      {showMarbleStand && (
        <group position={[0, HERO_EIGHT_LAYERS[7].explodeOffset * eAnim, 0]}>
          <mesh geometry={geos.pedestalMarbleGeo} material={materials.marbleStandMat} castShadow receiveShadow />
          <mesh geometry={geos.pedestalGoldGeo} material={materials.goldTrimMat} castShadow receiveShadow />
          {/* Crisp Pierced 36-Scallop Ecru French Lace Paper Doily (y=0.1216 clears platter cleanly — zero Z-fighting!) */}
          <mesh position={[0, 0.1216, 0]} rotation={[-Math.PI / 2, 0, 0]} material={materials.doilyMat} receiveShadow>
            <circleGeometry args={[0.578, 72]} />
          </mesh>
        </group>
      )}

      {/* STEP 6: Live 32°C Mirror Glaze Waterfall Pouring Mode */}
      {isStep6PouringMode ? (
        <MirrorGlazePour
          position={[0, cakeBaseY, 0]}
          scale={2.2}
          showWireRack={true}
          glazeProgress={targetGlaze}
          selectedFlavor={flavorId}
        />
      ) : (
        /* LAYERS 1..7: 商业影视级交响爆炸秀场（错峰阶梯波浪浮空 + 破壳显芯 + 琥珀瀑布拉丝 + 果肉晶冻 + 裱花冠 + VFX 粒子） */
        <group position={[0, cakeBaseY, 0]}>
          {/* 仅在爆炸态亮起的暖金逆光透射边缘灯（零阴影开销，点亮红宝石果胶与焦糖悬垂滴！） */}
          {eAnim > 0.05 && (
            <pointLight
              position={[-0.75, 1.38, -0.85]}
              color="#FFE2A4"
              intensity={2.85 * THREE.MathUtils.smoothstep(eAnim, 0.05, 0.50)}
              distance={4.2}
              decay={1.6}
              castShadow={false}
            />
          )}

          {/* 商业大片金箔微尘粒子涡旋 */}
          <HeroExplodeVFX
            explodeFactor={eAnim}
            goldFlakeGeo={geos.goldFlakeGeo}
            goldMat={materials.goldLeafMat}
          />

          {/* LAYER 7: 合体态保持无缝圆盘脆底；爆炸态爆裂为【8 块放射状焦糖碎瓦片星芒阵】+ 杏仁脆片，彻底告别圆饼！ */}
          <group
            position={[
              0,
              HERO_EIGHT_LAYERS[6].explodeOffset * THREE.MathUtils.smoothstep(eAnim, 0.252, 0.972),
              0,
            ]}
          >
            {eAnim <= 0.08 ? (
              <SplitCakeLayer
                geos={geos.crunch}
                wallMat={materials.crunchMat}
                yOffset={0}
                isSplit={isSplit}
                sliceOffset={sliceOffset}
                sliceYaw={sliceYaw}
              />
            ) : (
              Array.from({ length: 8 }).map((_, wi) => {
                const ang = (wi / 8) * Math.PI * 2 + Math.PI / 8;
                const spread = THREE.MathUtils.smoothstep(eAnim, 0.08, 0.72);
                const radOut = spread * 0.105;
                const inSl = isSplit && ang >= 0 && ang <= Math.PI * 0.5;
                const wedge = (
                  <group
                    key={`crunch-wedge-${wi}`}
                    position={[Math.sin(ang) * radOut, spread * (wi % 2 === 0 ? 0.024 : 0.008), Math.cos(ang) * radOut]}
                    rotation={[0, ang, 0]}
                  >
                    <mesh
                      rotation={[-spread * (wi % 2 === 0 ? 0.14 : 0.06), 0, 0]}
                      geometry={geos.crunchWedgeGeo}
                      material={materials.crunchMat}
                      castShadow
                      receiveShadow
                    />
                  </group>
                );
                return inSl ? (
                  <group key={`cw-s-${wi}`} position={sliceOffset} rotation={[0, sliceYaw, 0]}>
                    {wedge}
                  </group>
                ) : (
                  wedge
                );
              })
            )}
            {/* 爆炸态显露在酥脆层顶缘的 20 枚立体烘焙杏仁碎片 */}
            {eAnim > 0.04 &&
              Array.from({ length: 20 }).map((_, ai) => {
                const ang = (ai / 20) * Math.PI * 2 + (ai % 2) * 0.18;
                const rad = 0.26 + (ai % 4) * 0.042;
                const inSl = isSplit && ang >= 0 && ang <= Math.PI * 0.5;
                const sPop = THREE.MathUtils.smoothstep(eAnim, 0.04, 0.36);
                const shard = (
                  <mesh
                    key={`almond-shard-${ai}`}
                    position={[Math.sin(ang) * rad, 0.031 + (ai % 3) * 0.002, Math.cos(ang) * rad]}
                    rotation={[(ai % 3 - 1) * 0.24, ang * 1.4, ((ai + 1) % 3 - 1) * 0.18]}
                    scale={sPop * (0.95 + (ai % 3) * 0.18)}
                    geometry={geos.crunchShardGeo}
                    material={materials.almondShardMat}
                    castShadow
                  />
                );
                return inSl ? (
                  <group key={`al-s-${ai}`} position={sliceOffset} rotation={[0, sliceYaw, 0]}>
                    {shard}
                  </group>
                ) : (
                  shard
                );
              })}
            {MAIN_SHELL_ANGLES.map((ang, di) => (
              <mesh
                key={`base-saint-main-${di}`}
                position={[Math.sin(ang) * 0.464, 0.0005, Math.cos(ang) * 0.464]}
                rotation={[0, ang, 0]}
                geometry={geos.saintHonoreBorderGeo}
                material={materials.chantillyMat}
                castShadow
                receiveShadow
              />
            ))}
            <group position={isSplit ? sliceOffset : [0, 0, 0]} rotation={[0, isSplit ? sliceYaw : 0, 0]}>
              {SLICE_SHELL_ANGLES.map((ang, di) => (
                <mesh
                  key={`base-saint-slice-${di}`}
                  position={[Math.sin(ang) * 0.464, 0.0005, Math.cos(ang) * 0.464]}
                  rotation={[0, ang, 0]}
                  geometry={geos.saintHonoreBorderGeo}
                  material={materials.chantillyMat}
                  castShadow
                  receiveShadow
                />
              ))}
            </group>
          </group>

          {/* LAYER 6A: 底层厚烤焦糖外壳大底坯（r = 0.443） */}
          <SplitCakeLayer
            geos={geos.spongeBottom}
            wallMat={materials.spongeBottomMat}
            yOffset={0.27 * THREE.MathUtils.smoothstep(eAnim, 0.23, 0.95)}
            rotationY={isSplit ? 0 : -0.14 * eAnim}
            isSplit={isSplit}
            sliceOffset={sliceOffset}
            sliceYaw={sliceYaw}
          />

          {/* LAYER 5: 蜂蜜琥珀焦糖流心核 + 360° 悬浮瀑布拉丝垂滴 + 破壳外扩柔白奶油纱环 */}
          <group
            position={[
              0,
              HERO_EIGHT_LAYERS[4].explodeOffset * THREE.MathUtils.smoothstep(eAnim, 0.168, 0.888),
              0,
            ]}
          >
            <SplitCakeLayer
              geos={geos.caramel}
              wallMat={materials.caramelMat}
              yOffset={0}
              isSplit={isSplit}
              sliceOffset={sliceOffset}
              sliceYaw={sliceYaw}
            />
            {/* 爆炸态缓缓垂挂露出的 16 根 360° 粘稠琥珀焦糖瀑布拉丝 + 14 颗向外飞溅的黄金水珠 */}
            {eAnim > 0.06 && (
              <>
                <mesh
                  geometry={geos.caramelCascadeSkirtGeo}
                  material={materials.caramelRibbonMat}
                  position={[0, 0.098 * (1 - THREE.MathUtils.smoothstep(eAnim, 0.06, 0.45)), 0]}
                  scale={[1, THREE.MathUtils.smoothstep(eAnim, 0.06, 0.45), 1]}
                />
                <mesh
                  geometry={geos.caramelSplashRingGeo}
                  material={materials.caramelMat}
                  scale={THREE.MathUtils.lerp(0.85, 1.18, THREE.MathUtils.smoothstep(eAnim, 0.06, 0.72))}
                />
              </>
            )}
            {eAnim <= 0.14 && (
              <SplitCakeLayer
                geos={geos.mousseLowerRing}
                wallMat={materials.mousseRingExpandMat}
                capMat={materials.mousseCapMat}
                yOffset={0}
                radialScale={1 + 0.12 * THREE.MathUtils.smoothstep(eAnim, 0.05, 0.14)}
                isSplit={isSplit}
                sliceOffset={sliceOffset}
                sliceYaw={sliceYaw}
              />
            )}
            {/* 下层半埋入奶油壁的饱满微凸 3D 切半草莓（跟随外环温和外移破壳） */}
            <group scale={[1 + 0.16 * THREE.MathUtils.smoothstep(eAnim, 0.05, 0.65), 1, 1 + 0.16 * THREE.MathUtils.smoothstep(eAnim, 0.05, 0.65)]}>
              {[2.24, 2.94, 3.64, 4.34, 5.06, 5.74].map((ang, si) => (
                <group
                  key={`seam-low-main-${si}`}
                  position={[Math.sin(ang) * 0.4465, 0.113, Math.cos(ang) * 0.4465]}
                  rotation={[0, ang + Math.PI, si % 2 === 0 ? 0.08 : -0.08]}
                  scale={[1.04, 1.04, 0.96]}
                >
                  <mesh geometry={geos.halfStrawberryOuterGeo} material={materials.embeddedStrawberryOuterMat} />
                  <mesh geometry={geos.halfStrawberryCutGeo} material={materials.embeddedStrawberryCutMat} />
                </group>
              ))}
              <group position={isSplit ? sliceOffset : [0, 0, 0]} rotation={[0, isSplit ? sliceYaw : 0, 0]}>
                {[0.58, 1.18].map((ang, si) => (
                  <group
                    key={`seam-low-slice-${si}`}
                    position={[Math.sin(ang) * 0.4465, 0.113, Math.cos(ang) * 0.4465]}
                    rotation={[0, ang + Math.PI, si % 2 === 0 ? 0.08 : -0.08]}
                    scale={[1.04, 1.04, 0.96]}
                  >
                    <mesh geometry={geos.halfStrawberryOuterGeo} material={materials.embeddedStrawberryOuterMat} />
                    <mesh geometry={geos.halfStrawberryCutGeo} material={materials.embeddedStrawberryCutMat} />
                  </group>
                ))}
              </group>
            </group>
            {slideProgress > 0.04 && (
              <>
                <mesh
                  geometry={geos.caramelMainRibbonsGeo}
                  material={materials.caramelRibbonMat}
                  position={[0, 0.094 * (1 - (0.35 + slideProgress * 0.65)), 0]}
                  scale={[1, 0.35 + slideProgress * 0.65, 1]}
                />
                <mesh
                  geometry={geos.caramelMainDropsGeo}
                  material={materials.caramelRibbonMat}
                  position={[0, 0.072 * (1 - (0.55 + slideProgress * 0.45)) - slideProgress * 0.002, 0]}
                  scale={[1, 0.55 + slideProgress * 0.45, 1]}
                />

                <group position={sliceOffset} rotation={[0, sliceYaw, 0]}>
                  <mesh
                    geometry={geos.caramelSliceRibbonsGeo}
                    material={materials.caramelRibbonMat}
                    position={[0, 0.094 * (1 - (0.35 + slideProgress * 0.65)), 0]}
                    scale={[1, 0.35 + slideProgress * 0.65, 1]}
                  />
                  <mesh
                    geometry={geos.caramelSliceDropsGeo}
                    material={materials.caramelRibbonMat}
                    position={[0, 0.072 * (1 - (0.55 + slideProgress * 0.45)) - slideProgress * 0.002, 0]}
                    scale={[1, 0.55 + slideProgress * 0.45, 1]}
                  />
                </group>
              </>
            )}
          </group>

          {/* LAYER 6B: 中层内缩瘦腰 + 嵌入冻干草莓碎斑戚风海绵坯（r = 0.394，错落阶梯感！） */}
          <SplitCakeLayer
            geos={geos.spongeMid}
            wallMat={materials.spongeMidMat}
            yOffset={HERO_EIGHT_LAYERS[5].explodeOffset * THREE.MathUtils.smoothstep(eAnim, 0.21, 0.93)}
            rotationY={isSplit ? 0 : 0.16 * eAnim}
            isSplit={isSplit}
            sliceOffset={sliceOffset}
            sliceYaw={sliceYaw}
          />

          {/* LAYER 4: 晶莹红宝石草莓果胶浮岛 + 18 颗鲜切果肉丁 + 破壳外扩奶油纱环 */}
          <group
            position={[
              0,
              HERO_EIGHT_LAYERS[3].explodeOffset * THREE.MathUtils.smoothstep(eAnim, 0.126, 0.846),
              0,
            ]}
          >
            <SplitCakeLayer
              geos={geos.jelly}
              wallMat={materials.jellyMat}
              yOffset={0}
              isSplit={isSplit}
              sliceOffset={sliceOffset}
              sliceYaw={sliceYaw}
            />
            {/* 爆炸态显露的 18 颗半埋入晶莹鲜草莓果肉丁 */}
            {eAnim > 0.05 &&
              Array.from({ length: 18 }).map((_, fi) => {
                const ang = (fi / 18) * Math.PI * 2 + 0.15;
                const rad = 0.16 + (fi % 3) * 0.088;
                const inSl = isSplit && ang >= 0 && ang <= Math.PI * 0.5;
                const fPop = THREE.MathUtils.smoothstep(eAnim, 0.05, 0.38);
                const chunk = (
                  <mesh
                    key={`fruit-chunk-${fi}`}
                    position={[Math.sin(ang) * rad, 0.236 + (fi % 2) * 0.003, Math.cos(ang) * rad]}
                    rotation={[fi * 0.6, ang, fi * 0.4]}
                    scale={fPop * (0.90 + (fi % 3) * 0.20)}
                    geometry={geos.fruitChunkGeo}
                    material={materials.fruitChunkMat}
                    castShadow
                  />
                );
                return inSl ? (
                  <group key={`fc-s-${fi}`} position={sliceOffset} rotation={[0, sliceYaw, 0]}>
                    {chunk}
                  </group>
                ) : (
                  chunk
                );
              })}
            {eAnim <= 0.14 && (
              <SplitCakeLayer
                geos={geos.mousseUpperRing}
                wallMat={materials.mousseRingExpandMat}
                capMat={materials.mousseCapMat}
                yOffset={0}
                radialScale={1 + 0.12 * THREE.MathUtils.smoothstep(eAnim, 0.05, 0.14)}
                isSplit={isSplit}
                sliceOffset={sliceOffset}
                sliceYaw={sliceYaw}
              />
            )}
            {/* 中层半埋入奶油壁的饱满微凸 3D 切半草莓 */}
            <group scale={[1 + 0.16 * THREE.MathUtils.smoothstep(eAnim, 0.05, 0.65), 1, 1 + 0.16 * THREE.MathUtils.smoothstep(eAnim, 0.05, 0.65)]}>
              {[1.92, 2.58, 3.28, 3.98, 4.68, 5.42, 5.95].map((ang, si) => (
                <group
                  key={`seam-up-main-${si}`}
                  position={[Math.sin(ang) * 0.4465, 0.217, Math.cos(ang) * 0.4465]}
                  rotation={[0, ang + Math.PI, si % 2 === 0 ? 0.08 : -0.08]}
                  scale={[1.04, 1.04, 0.96]}
                >
                  <mesh geometry={geos.halfStrawberryOuterGeo} material={materials.embeddedStrawberryOuterMat} />
                  <mesh geometry={geos.halfStrawberryCutGeo} material={materials.embeddedStrawberryCutMat} />
                </group>
              ))}
              <group position={isSplit ? sliceOffset : [0, 0, 0]} rotation={[0, isSplit ? sliceYaw : 0, 0]}>
                {[0.36, 1.08].map((ang, si) => (
                  <group
                    key={`seam-up-slice-${si}`}
                    position={[Math.sin(ang) * 0.4465, 0.217, Math.cos(ang) * 0.4465]}
                    rotation={[0, ang + Math.PI, si % 2 === 0 ? 0.08 : -0.08]}
                    scale={[1.04, 1.04, 0.96]}
                  >
                    <mesh geometry={geos.halfStrawberryOuterGeo} material={materials.embeddedStrawberryOuterMat} />
                    <mesh geometry={geos.halfStrawberryCutGeo} material={materials.embeddedStrawberryCutMat} />
                  </group>
                ))}
              </group>
            </group>
            {isSplit && (
              <>
                {[0.14, 0.27].map((rDist, si) => (
                  <React.Fragment key={`l4-cut-${si}`}>
                    <group
                      position={[0.0012, 0.215, rDist]}
                      rotation={[0, -Math.PI / 2, si === 0 ? 0.08 : -0.10]}
                      scale={[0.88, 0.90, 0.80]}
                    >
                      <mesh geometry={geos.halfStrawberryOuterGeo} material={materials.embeddedStrawberryOuterMat} />
                      <mesh geometry={geos.halfStrawberryCutGeo} material={materials.embeddedStrawberryCutMat} />
                    </group>
                    <group
                      position={[rDist + 0.015, 0.215, 0.0012]}
                      rotation={[0, Math.PI, si === 0 ? -0.09 : 0.09]}
                      scale={[0.88, 0.90, 0.80]}
                    >
                      <mesh geometry={geos.halfStrawberryOuterGeo} material={materials.embeddedStrawberryOuterMat} />
                      <mesh geometry={geos.halfStrawberryCutGeo} material={materials.embeddedStrawberryCutMat} />
                    </group>
                  </React.Fragment>
                ))}
                <group position={sliceOffset} rotation={[0, sliceYaw, 0]}>
                  {[0.14, 0.27].map((rDist, si) => (
                    <React.Fragment key={`l4-slice-cut-${si}`}>
                      <group
                        position={[-0.0012, 0.215, rDist]}
                        rotation={[0, Math.PI / 2, si === 0 ? -0.08 : 0.10]}
                        scale={[0.88, 0.90, 0.80]}
                      >
                        <mesh geometry={geos.halfStrawberryOuterGeo} material={materials.embeddedStrawberryOuterMat} />
                        <mesh geometry={geos.halfStrawberryCutGeo} material={materials.embeddedStrawberryCutMat} />
                      </group>
                      <group
                        position={[rDist + 0.015, 0.215, -0.0012]}
                        rotation={[0, 0, si === 0 ? 0.09 : -0.09]}
                        scale={[0.88, 0.90, 0.80]}
                      >
                        <mesh geometry={geos.halfStrawberryOuterGeo} material={materials.embeddedStrawberryOuterMat} />
                        <mesh geometry={geos.halfStrawberryCutGeo} material={materials.embeddedStrawberryCutMat} />
                      </group>
                    </React.Fragment>
                  ))}
                </group>
              </>
            )}
          </group>

          {/* LAYER 6C: 上层超薄精致树莓酒露浸润戚风片（h = 0.054，顶缘带果露釉光） */}
          <SplitCakeLayer
            geos={geos.spongeTop}
            wallMat={materials.spongeTopMat}
            yOffset={0.82 * THREE.MathUtils.smoothstep(eAnim, 0.19, 0.91)}
            rotationY={isSplit ? 0 : -0.18 * eAnim}
            isSplit={isSplit}
            sliceOffset={sliceOffset}
            sliceYaw={sliceYaw}
          />

          {/* LAYER 3: 爆炸时隐藏厚白圆饼，变成纯白【24 朵星嘴法式奶油玫瑰挤花镂空花环冠】！ */}
          <group
            position={[
              0,
              HERO_EIGHT_LAYERS[2].explodeOffset * THREE.MathUtils.smoothstep(eAnim, 0.084, 0.804),
              0,
            ]}
          >
            {eAnim <= 0.14 && (
              <SplitCakeLayer
                geos={geos.mousseTopBed}
                wallMat={materials.mousseWallMat}
                capMat={materials.mousseCapMat}
                yOffset={0}
                isSplit={isSplit}
                sliceOffset={sliceOffset}
                sliceYaw={sliceYaw}
              />
            )}
            {eAnim > 0.04 &&
              Array.from({ length: 24 }).map((_, ri) => {
                const ang = (ri / 24) * Math.PI * 2;
                const rad = 0.398;
                const inSl = isSplit && ang >= 0 && ang <= Math.PI * 0.5;
                const rScale = THREE.MathUtils.smoothstep(eAnim, 0.04, 0.36) * (0.95 + (ri % 2) * 0.14);
                const rosette = (
                  <mesh
                    key={`mousse-rosette-${ri}`}
                    position={[Math.sin(ang) * rad, 0.332, Math.cos(ang) * rad]}
                    rotation={[0, ang, 0]}
                    scale={rScale}
                    geometry={geos.pipedRosetteGeo}
                    material={materials.chantillyMat}
                    castShadow
                  />
                );
                return inSl ? (
                  <group key={`mr-s-${ri}`} position={sliceOffset} rotation={[0, sliceYaw, 0]}>
                    {rosette}
                  </group>
                ) : (
                  rosette
                );
              })}
          </group>

          {/* LAYER 2: 丝绒香缇实心旋顶帽 + 自然挂珠垂滴 */}
          <group
            position={[
              0,
              HERO_EIGHT_LAYERS[1].explodeOffset * THREE.MathUtils.smoothstep(eAnim, 0.042, 0.762),
              0,
            ]}
          >
            <SplitCakeLayer
              geos={geos.glaze}
              wallMat={materials.glazeMat}
              yOffset={0}
              rotationY={isSplit ? 0 : 0.14 * eAnim}
              isSplit={isSplit}
              sliceOffset={sliceOffset}
              sliceYaw={sliceYaw}
            />

            {/* 半裸抹面仅在未爆炸合体态贴附蛋糕侧壁 */}
            {eAnim <= 0.06 &&
              (!isSplit ? (
                <mesh geometry={geos.semiNakedFullGeo} material={materials.semiNakedCoatMat} receiveShadow />
              ) : (
                <>
                  <mesh geometry={geos.semiNakedMainGeo} material={materials.semiNakedCoatMat} receiveShadow />
                  <group position={sliceOffset} rotation={[0, sliceYaw, 0]}>
                    <mesh geometry={geos.semiNakedSliceGeo} material={materials.semiNakedCoatMat} receiveShadow />
                  </group>
                </>
              ))}
          </group>

          {/* LAYER 1: 鲜草莓、粉霜蓝莓、法式马卡龙与玫瑰冠冕（爆炸最高点微幅轻旋悬停！） */}
          <group
            position={[
              0,
              HERO_EIGHT_LAYERS[0].explodeOffset * THREE.MathUtils.smoothstep(eAnim, 0.0, 0.72),
              0,
            ]}
            rotation={[0, isSplit ? 0 : -0.18 * eAnim, 0]}
          >
            <group ref={wobbleCrownRef}>
              <TopGarnishCrown
                geos={geos}
                flavor={flavor}
                garnishLevel={effectiveGarnish}
                explodeFactor={eAnim}
                isSplit={isSplit}
                sliceOffset={sliceOffset}
                sliceYaw={sliceYaw}
                materials={{
                  strawberryOuterMat: materials.strawberryOuterMat,
                  strawberryCutMat: materials.strawberryCutMat,
                  calyxMat: materials.calyxMat,
                  blueberryMat: materials.blueberryMat,
                  macaronPrimaryMat: materials.macaronPrimaryMat,
                  macaronSecondaryMat: materials.macaronSecondaryMat,
                  whiteChocMat: materials.whiteChocMat,
                  icingSugarMat: materials.icingSugarMat,
                  goldLeafMat: materials.goldLeafMat,
                  chantillyMat: materials.chantillyMat,
                  mintLeafMat: materials.mintLeafMat,
                  rosemaryMat: materials.rosemaryMat,
                  daisyPetalMat: materials.daisyPetalMat,
                  blushPetalMat: materials.blushPetalMat,
                  gardenRoseMat: materials.gardenRoseMat,
                  pollenMat: materials.pollenMat,
                }}
              />
            </group>
          </group>
        </group>
      )}
    </group>
  );
};

export default HeroEntremetCake;
