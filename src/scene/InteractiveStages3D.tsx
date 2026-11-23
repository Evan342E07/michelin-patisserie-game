import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '../store/useGameStore';
import { ensureSecondaryUv, getAtelierTextures, getSteelPbrSet } from '../textures/atelierTextures';
import {
  createVaporMistMaterial,
  enhanceWithFoodSSS,
} from '../shaders/atelierShaders';
import { enhanceWithExtremeMicroCraft } from '../shaders/extremeThreeJsUpgrades';
import {
  enhanceWithStylizedFresnelRim,
  FloatingPropGuideBadge,
  stepJellySpring,
  StylizedInkOutline,
} from '../shaders/stylizedCozyUpgrades';
import {
  createBeveledBoxGeometry,
  createForgedPanHandleGeometry,
  createMousseRingGeometry,
  createPipingBagGeometry,
  createSeamlessLatheGeometry,
  createTurnedHandleGeometry,
} from '../geometry/patisserieGeometry';
import { getCottageCraftAssets } from './environment/cottageTexturesAndFlora';
import {
  createMicroSurfaceMaps,
  createWoodGrainPbr,
} from './props/cottageHighCraftPbr';
import { ENTREMET_FLAVOR_PRESETS, resolveFlavorId } from './cake/cakeFlavors';
import { getCakeProceduralTextures } from './cake/cakeTextures';
import {
  computeCoaxialInsertPrecision,
  computeGarnishPlacementPrecision,
  computeMagneticReticleXZ,
  computeStationDragDelta,
  DragPoint,
  evaluateJFoldPolyline,
  InteractiveStationId,
} from '../systems/interactionMechanics';
import { patisserieAudio } from '../audio/patisserieAudio';

function createSoftParticleSpriteTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  grad.addColorStop(0.0, 'rgba(255, 253, 248, 1.0)');
  grad.addColorStop(0.38, 'rgba(255, 252, 244, 0.78)');
  grad.addColorStop(0.75, 'rgba(255, 250, 240, 0.22)');
  grad.addColorStop(1.0, 'rgba(255, 250, 240, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSoftFocusAuraMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#D8B36A') },
      uInnerRatio: { value: 0.72 },
      uOpacity: { value: 0.13 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uInnerRatio;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float bandCenter = mix(uInnerRatio, 1.0, 0.52);
        float halfBand = max(0.05, (1.0 - uInnerRatio) * 0.5);
        float dist = abs(r - bandCenter) / halfBand;
        float falloff = exp(-dist * dist * 3.4) * (1.0 - smoothstep(0.82, 1.0, r)) * smoothstep(uInnerRatio * 0.88, uInnerRatio, r);
        float pulse = 0.85 + 0.15 * sin(uTime * 2.4);
        float alpha = falloff * uOpacity * pulse;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(uColor, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function sampleMeringueDomeY(theta: number, u: number): number {
  const domeBaseY = 0.044 + Math.cos(u * Math.PI * 0.48) * 0.035;
  const spiralAng = theta - u * 4.4;
  const fold1 = Math.sin(spiralAng * 4.0) * Math.pow(u, 0.72) * (1.0 - u) * 0.019;
  const fold2 = Math.cos(theta * 7.0 + u * 5.6) * Math.pow(u, 0.9) * (1.0 - u) * 0.007;
  const peakTwist = 0.68 + 0.32 * Math.sin(theta * 3.0 - u * 8.0) * Math.min(1.0, u * 5.0);
  const peak = Math.exp(-u * u * 14.0) * 0.017 + Math.exp(-u * u * 48.0) * 0.010 * peakTwist;
  return domeBaseY + (fold1 + fold2 + peak) * (1.0 - u * 0.12);
}

function buildWhippedMeringueDomeGeo(): THREE.BufferGeometry {
  const radialSegs = 72;
  const rings = 32;
  const maxR = 0.150;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= radialSegs; i++) {
    const theta = (i / radialSegs) * Math.PI * 2;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    for (let j = 0; j <= rings; j++) {
      const u = j / rings;
      const r = Math.max(0.0001, u * maxR);
      const y = sampleMeringueDomeY(theta, u);

      positions.push(cosT * r, y, sinT * r);
      uvs.push(i / radialSegs, u);
    }
  }

  const row = rings + 1;
  for (let i = 0; i < radialSegs; i++) {
    for (let j = 0; j < rings; j++) {
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

  const norm = g.attributes.normal;
  for (let j = 0; j <= rings; j++) {
    const i0 = j;
    const iEnd = radialSegs * row + j;
    const nx = (norm.getX(i0) + norm.getX(iEnd)) * 0.5;
    const ny = (norm.getY(i0) + norm.getY(iEnd)) * 0.5;
    const nz = (norm.getZ(i0) + norm.getZ(iEnd)) * 0.5;
    const len = Math.hypot(nx, ny, nz) || 1;
    norm.setXYZ(i0, nx / len, ny / len, nz / len);
    norm.setXYZ(iEnd, nx / len, ny / len, nz / len);
  }
  norm.needsUpdate = true;
  return g;
}

/**
 * Finely sifted almond-sugar flour snow blanket draped flush along the whipped Swiss meringue folds.
 */
function buildDustedAlmondFlourGeo(): THREE.BufferGeometry {
  const radialSegs = 64;
  const rings = 24;
  const maxR = 0.132;
  const meringueScaleR = maxR / 0.150;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= radialSegs; i++) {
    const theta = (i / radialSegs) * Math.PI * 2;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    for (let j = 0; j <= rings; j++) {
      const u = j / rings;
      const r = Math.max(0.0001, u * maxR);
      const uMeringue = u * meringueScaleR;
      const baseMeringueY = sampleMeringueDomeY(theta, uMeringue);
      const powderGrain =
        (Math.cos(theta * 15 + u * 18) * 0.0006 + Math.sin(theta * 9 - u * 12) * 0.0005) *
        (1 - u * 0.7);
      const snowLift = 0.0022 * (1 - Math.pow(u, 2.2)) + powderGrain;
      const rimSink = -0.0026 * Math.pow(u, 4);
      const y = baseMeringueY + snowLift + rimSink;

      positions.push(cosT * r, y, sinT * r);
      uvs.push(0.5 + cosT * 0.48 * u, 0.5 + sinT * 0.48 * u);
    }
  }

  const row = rings + 1;
  for (let i = 0; i < radialSegs; i++) {
    for (let j = 0; j < rings; j++) {
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

  // Weld radial seam normals (i = 0 and i = radialSegs) for seamless shading
  const norm = g.attributes.normal;
  for (let j = 0; j <= rings; j++) {
    const i0 = j;
    const iEnd = radialSegs * row + j;
    const nx = (norm.getX(i0) + norm.getX(iEnd)) * 0.5;
    const ny = (norm.getY(i0) + norm.getY(iEnd)) * 0.5;
    const nz = (norm.getZ(i0) + norm.getZ(iEnd)) * 0.5;
    const len = Math.hypot(nx, ny, nz) || 1;
    norm.setXYZ(i0, nx / len, ny / len, nz / len);
    norm.setXYZ(iEnd, nx / len, ny / len, nz / len);
  }
  norm.needsUpdate = true;
  return g;
}

/**
 * Sculpted Solid-Skirt 3D Conical Sifted Almond-Flour Snow Mound.
 * Outer skirt anchors strictly at local y = 0 (world y <= 0.045m, buried INSIDE the whipped meringue dome)
 * and rises monotonically to peak y_local = +0.071m (world y = 0.045 + 0.071 = 0.116m < 0.118m resting sieve mesh!).
 * Animated purely via vertical translation from buried -> emerged (ZERO negative-coordinate Y-scaling, ZERO floating rim!).
 */
function buildSiftedFlourConeMoundGeo(): THREE.BufferGeometry {
  const radialSegs = 48;
  const rings = 20;
  const maxR = 0.106;
  const baseAnchorY = 0.045;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= radialSegs; i++) {
    const theta = (i / radialSegs) * Math.PI * 2;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    for (let j = 0; j <= rings; j++) {
      const u = j / rings;
      const r = Math.max(0.0001, u * maxR);
      // Smooth sculpted powder mountain rising monotonically from y_local = 0 at rim (u=1) to +0.071m at center apex (u=0)
      const avalancheRidge =
        (Math.sin(theta * 5.0 + u * 4.2) * 0.0016 + Math.cos(theta * 9.0 - u * 7.5) * 0.0009) *
        u *
        (1.0 - u);
      const profile = Math.pow(1.0 - u, 1.38) * 0.071;
      const localY = Math.max(0.0, profile + avalancheRidge);

      positions.push(cosT * r, localY, sinT * r);
      uvs.push(0.5 + cosT * 0.48 * u, 0.5 + sinT * 0.48 * u);
    }
  }

  const row = rings + 1;
  for (let i = 0; i < radialSegs; i++) {
    for (let j = 0; j < rings; j++) {
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

  // Weld seam normals cleanly at i = 0 and i = radialSegs
  const norm = g.attributes.normal;
  for (let j = 0; j <= rings; j++) {
    const i0 = j;
    const iEnd = radialSegs * row + j;
    const nx = (norm.getX(i0) + norm.getX(iEnd)) * 0.5;
    const ny = (norm.getY(i0) + norm.getY(iEnd)) * 0.5;
    const nz = (norm.getZ(i0) + norm.getZ(iEnd)) * 0.5;
    const len = Math.hypot(nx, ny, nz) || 1;
    norm.setXYZ(i0, nx / len, ny / len, nz / len);
    norm.setXYZ(iEnd, nx / len, ny / len, nz / len);
  }
  norm.needsUpdate = true;
  // Keep reference note on baseAnchorY = 0.045
  g.userData.baseAnchorY = baseAnchorY;
  return g;
}

/**
 * Shared exact parametric French "J"-fold curve used identically by BOTH the 3D Silicone Spatula (JS)
 * and the GPU Meringue Furrow Shader (GLSL) so blade tip & carved trench match with 0.0° phase error!
 */
function sampleJFoldCurveXZ(s: number): [number, number] {
  if (s < 0.45) {
    const u = s / 0.45;
    return [0.0, THREE.MathUtils.lerp(-0.078, 0.076, u)];
  }
  const u = (s - 0.45) / 0.55;
  const ang = u * 2.15;
  return [-Math.sin(ang) * 0.086, Math.cos(ang) * 0.076];
}

/**
 * Unified Food-Grade SSS + Live 3D J-Fold Spatula Furrow Trail Shader for Step 1 Whipped Meringue.
 * Evaluates true finite-difference perturbed normals in #include <beginnormal_vertex> so directional
 * sunlight and MeshPhysicalMaterial clearcoat carve crisp physical shadows & wet cream highlights
 * along the recessed -12.5mm trench and raised +6.2mm shoulder berms!
 */
function enhanceMeringueWithJFoldFurrow(material: THREE.MeshPhysicalMaterial): THREE.MeshPhysicalMaterial {
  const uSssColor = { value: new THREE.Color('#FFE2B8') };
  const uSssStrength = { value: 0.24 };
  const uWrap = { value: 0.48 };
  const uSunDir = { value: new THREE.Vector3(8.2, 4.35, 3.1).normalize() };
  const uFoldProgress = { value: 0.0 };
  const uFoldIntensity = { value: 0.0 };
  const uLivePos = { value: new THREE.Vector2(0.0, 0.0) };
  const uLiveWeight = { value: 0.0 };
  const uWobbleVec = { value: new THREE.Vector2(0.0, 0.0) };

  material.userData.sssUniforms = { uSssColor, uSssStrength, uWrap, uSunDir };
  material.userData.jFoldUniforms = {
    uFoldProgress,
    uFoldIntensity,
    uLivePos,
    uLiveWeight,
    uWobbleVec,
  };
  material.customProgramCacheKey = () => 'stage-meringue-jfold-sss-v3';

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSssColor = uSssColor;
    shader.uniforms.uSssStrength = uSssStrength;
    shader.uniforms.uWrap = uWrap;
    shader.uniforms.uSunDir = uSunDir;
    shader.uniforms.uFoldProgress = uFoldProgress;
    shader.uniforms.uFoldIntensity = uFoldIntensity;
    shader.uniforms.uLivePos = uLivePos;
    shader.uniforms.uLiveWeight = uLiveWeight;
    shader.uniforms.uWobbleVec = uWobbleVec;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      /* glsl */ `
      #include <common>
      uniform float uFoldProgress;
      uniform float uFoldIntensity;
      uniform vec2 uLivePos;
      uniform float uLiveWeight;
      uniform vec2 uWobbleVec;
      varying float vFurrowHeight;

      vec2 sampleJCurve(float s) {
        if (s < 0.45) {
          float u = s / 0.45;
          return vec2(0.0, mix(-0.078, 0.076, u));
        }
        float u = (s - 0.45) / 0.55;
        float ang = u * 2.15;
        return vec2(-sin(ang) * 0.086, cos(ang) * 0.076);
      }

      float distToJSegment(vec2 p, vec2 a, vec2 b) {
        vec2 pa = p - a;
        vec2 ba = b - a;
        float h = clamp(dot(pa, ba) / max(1e-6, dot(ba, ba)), 0.0, 1.0);
        return length(pa - ba * h);
      }

      float evalJFoldDisp(vec2 xz) {
        float disp = 0.0;
        float bowlMask = smoothstep(0.145, 0.110, length(xz));
        if (uFoldIntensity > 0.002 && uFoldProgress > 0.01) {
          float minD = 10.0;
          vec2 prevPt = sampleJCurve(0.0);
          for (int seg = 1; seg <= 8; seg++) {
            float sCurr = (float(seg) / 8.0) * uFoldProgress;
            vec2 currPt = sampleJCurve(sCurr);
            minD = min(minD, distToJSegment(xz, prevPt, currPt));
            prevPt = currPt;
          }
          float trough = exp(-(minD * minD) / 0.00026);
          float berm = exp(-pow((minD - 0.025) / 0.012, 2.0));
          disp += (-0.0148 * trough + 0.0072 * berm) * bowlMask * uFoldIntensity;
        }
        if (uLiveWeight > 0.004) {
          float dLive = length(xz - uLivePos);
          float spoonDip = exp(-(dLive * dLive) / 0.00038) * -0.0155;
          float spoonBerm = exp(-pow((dLive - 0.028) / 0.013, 2.0)) * 0.0076;
          disp += (spoonDip + spoonBerm) * bowlMask * uLiveWeight;
        }
        return disp;
      }
      `
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      /* glsl */ `
      #include <beginnormal_vertex>
      if ((uFoldIntensity > 0.002 && uFoldProgress > 0.01) || uLiveWeight > 0.004) {
        float eps = 0.0042;
        float hC = evalJFoldDisp(position.xz);
        float hX = evalJFoldDisp(position.xz + vec2(eps, 0.0));
        float hZ = evalJFoldDisp(position.xz + vec2(0.0, eps));
        float dHdx = (hX - hC) / eps;
        float dHdz = (hZ - hC) / eps;
        objectNormal = normalize(objectNormal + vec3(-dHdx * 1.24, 0.0, -dHdz * 1.24));
      }
      `
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
      #include <begin_vertex>
      float furrowDisp = evalJFoldDisp(transformed.xz);
      transformed.y += furrowDisp;
      float heightFlex = pow(clamp((transformed.y - 0.025) / 0.065, 0.0, 1.0), 1.65);
      transformed.xz += uWobbleVec * heightFlex;
      vFurrowHeight = furrowDisp;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `
      #include <common>
      uniform vec3 uSssColor;
      uniform float uSssStrength;
      uniform float uWrap;
      uniform vec3 uSunDir;
      varying float vFurrowHeight;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      /* glsl */ `
      #include <lights_fragment_end>
      // Subtle physical cavity micro-AO inside deep recessed J-fold trench (highlights driven 100% by recomputed PBR normal + clearcoat!)
      float troughAO = clamp(1.0 + vFurrowHeight * 12.0, 0.86, 1.03);
      reflectedLight.directDiffuse *= troughAO;
      reflectedLight.indirectDiffuse *= troughAO;

      vec3 sssLightView = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
      float wrapNdotL = clamp((dot(geometryNormal, sssLightView) + uWrap) / (1.0 + uWrap), 0.0, 1.0);
      float backScatter = pow(max(1e-4, clamp(dot(geometryViewDir, -sssLightView + geometryNormal * 0.42), 0.0, 1.0)), 2.8);
      float rimSoft = pow(max(1e-4, 1.0 - saturate(dot(geometryNormal, geometryViewDir))), 2.2);
      reflectedLight.indirectDiffuse += uSssColor * diffuseColor.rgb * (wrapNdotL * 0.45 + backScatter * 0.85 + rimSoft * 0.28) * uSssStrength;
      `
    );
  };

  return material;
}

const CELEBRATION_STATION_ANCHORS: Record<number, [number, number, number]> = {
  1: [-1.05, 0.20, 0.08],
  2: [-1.15, 0.42, -2.72],
  3: [0.28, 0.22, -0.32],
  4: [-0.28, 0.14, 0.22],
  5: [0.58, 0.24, 0.20],
  6: [0.58, 0.34, 0.20],
  7: [3.55, 0.22, 0.65],
};

/**
 * GPU-Friendly Golden Starlight & Blush-Petal Celebration Burst (72 pre-allocated particles, ZERO GC in useFrame!)
 */
const CelebrationStarBurst: React.FC<{ pulse: number; step: number }> = ({ pulse, step }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const lastPulseRef = useRef(pulse);
  const ageRef = useRef(99);

  const { geo, mat, velBuf } = useMemo(() => {
    const count = 72;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const seeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -10;
      positions[i * 3 + 2] = 0;
      sizes[i] = 16.0 + (i % 5) * 4.2;
      seeds[i] = (i * 0.6180339) % 1.0;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uAlpha: { value: 0 },
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aSeed;
        uniform float uPixelRatio;
        uniform float uTime;
        varying float vSeed;
        varying float vTwinkle;
        void main() {
          vSeed = aSeed;
          vTwinkle = 0.65 + 0.35 * sin(uTime * 9.5 + aSeed * 25.0);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp((aSize * uPixelRatio) / max(0.85, -mv.z), 3.0, 26.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uAlpha;
        varying float vSeed;
        varying float vTwinkle;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv) * 2.0;
          if (d > 1.0) discard;
          // Soft 4-point warm starlight sparkle + radial bokeh glow (zero hard square pixels!)
          float core = exp(-d * d * 8.5);
          float crossStar = exp(-abs(uv.x) * 18.0) * exp(-abs(uv.y) * 5.0)
                          + exp(-abs(uv.y) * 18.0) * exp(-abs(uv.x) * 5.0);
          float mask = clamp(core + crossStar * 0.55, 0.0, 1.0) * smoothstep(1.0, 0.45, d);
          vec3 goldCol = vec3(1.0, 0.86, 0.46);
          vec3 petalCol = vec3(1.0, 0.78, 0.82);
          vec3 col = mix(goldCol, petalCol, step(0.72, vSeed));
          gl_FragColor = vec4(col, mask * uAlpha * vTwinkle);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    return { geo: g, mat: m, velBuf: velocities };
  }, []);

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    mat.uniforms.uTime.value = clock.getElapsedTime();

    if (pulse < lastPulseRef.current) {
      lastPulseRef.current = pulse;
    }
    if (pulse > lastPulseRef.current) {
      lastPulseRef.current = pulse;
      ageRef.current = 0;
      const anchor = CELEBRATION_STATION_ANCHORS[step] ?? CELEBRATION_STATION_ANCHORS[1];
      const posAttr = geo.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < posAttr.count; i++) {
        const theta = (i / posAttr.count) * Math.PI * 2 + (i % 7) * 0.41;
        const speed = 0.24 + ((i * 37) % 100) / 100 * 0.42;
        const lift = 0.34 + ((i * 53) % 100) / 100 * 0.46;
        arr[i * 3] = anchor[0] + Math.cos(theta) * 0.04;
        arr[i * 3 + 1] = anchor[1];
        arr[i * 3 + 2] = anchor[2] + Math.sin(theta) * 0.04;
        velBuf[i * 3] = Math.cos(theta) * speed;
        velBuf[i * 3 + 1] = lift;
        velBuf[i * 3 + 2] = Math.sin(theta) * speed;
      }
      posAttr.needsUpdate = true;
      if (pointsRef.current) pointsRef.current.visible = true;
    }

    if (ageRef.current < 1.55) {
      ageRef.current += dt;
      const posAttr = geo.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const drag = Math.exp(-dt * 2.2);
      for (let i = 0; i < posAttr.count; i++) {
        velBuf[i * 3] *= drag;
        velBuf[i * 3 + 1] = velBuf[i * 3 + 1] * drag - dt * 0.42;
        velBuf[i * 3 + 2] *= drag;
        arr[i * 3] += velBuf[i * 3] * dt;
        arr[i * 3 + 1] += velBuf[i * 3 + 1] * dt;
        arr[i * 3 + 2] += velBuf[i * 3 + 2] * dt;
      }
      posAttr.needsUpdate = true;
      const tNorm = ageRef.current / 1.55;
      mat.uniforms.uAlpha.value = Math.sin(Math.min(1, tNorm * 4.5) * Math.PI * 0.5) * (1.0 - tNorm * tNorm);
    } else if (pointsRef.current && pointsRef.current.visible) {
      pointsRef.current.visible = false;
      mat.uniforms.uAlpha.value = 0;
    }
  });

  return <points ref={pointsRef} geometry={geo} material={mat} visible={false} frustumCulled={false} raycast={() => null} />;
};

function createDustedFlourAlphaTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);

  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size * 0.48);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.58, 'rgba(255, 255, 255, 0.92)');
  grad.addColorStop(0.84, 'rgba(205, 205, 205, 0.48)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Fine sugar-almond stipple speckles for organic sifted dusting breakup at perimeter
  let seed = 1337;
  const nextRand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let k = 0; k < 520; k++) {
    const angle = nextRand() * Math.PI * 2;
    const rad = (0.18 + Math.pow(nextRand(), 0.72) * 0.30) * size;
    const px = size / 2 + Math.cos(angle) * rad;
    const py = size / 2 + Math.sin(angle) * rad;
    const dotR = 0.8 + nextRand() * 1.9;
    const bright = nextRand() > 0.35;
    ctx.fillStyle = bright ? 'rgba(255,255,255,0.65)' : 'rgba(60,60,60,0.5)';
    ctx.beginPath();
    ctx.arc(px, py, dotR, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

function buildFrenchSpatulaBladeGeo(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.005, 0.0);
  shape.bezierCurveTo(-0.008, -0.018, -0.022, -0.024, -0.022, -0.048);
  shape.bezierCurveTo(-0.022, -0.068, -0.013, -0.078, 0.002, -0.078);
  shape.bezierCurveTo(0.016, -0.078, 0.021, -0.064, 0.020, -0.042);
  shape.bezierCurveTo(0.019, -0.020, 0.008, -0.016, 0.005, 0.0);
  shape.closePath();

  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0032,
    bevelEnabled: true,
    bevelThickness: 0.0014,
    bevelSize: 0.0014,
    bevelSegments: 3,
    curveSegments: 14,
  });
  g.translate(0, 0, -0.0016);
  g.computeVertexNormals();
  return g;
}

function buildPlanarBeveledDiscGeo(
  radius: number,
  height: number,
  bevel = 0.0035
): THREE.BufferGeometry {
  const halfH = height * 0.5;
  const rInner = Math.max(0.001, radius - bevel);
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, -halfH),
    new THREE.Vector2(rInner, -halfH),
    new THREE.Vector2(radius, -halfH + bevel),
    new THREE.Vector2(radius, halfH - bevel),
    new THREE.Vector2(rInner, halfH),
    new THREE.Vector2(0.0001, halfH),
  ];
  const g = createSeamlessLatheGeometry(pts, 56);

  // Project distortion-free planar UVs across top/bottom disc faces so food maps read crisply
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const invSpan = 1 / Math.max(0.001, radius * 2);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const pz = pos.getZ(i);
    uv.setXY(i, px * invSpan + 0.5, pz * invSpan + 0.5);
  }
  uv.needsUpdate = true;
  return g;
}

function buildMousseWallCollarGeo(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.1715, 0.0),
    new THREE.Vector2(0.1815, 0.0),
    new THREE.Vector2(0.1815, 0.132),
    new THREE.Vector2(0.1735, 0.134),
    new THREE.Vector2(0.1715, 0.128),
    new THREE.Vector2(0.1715, 0.0),
  ];
  return createSeamlessLatheGeometry(pts, 64);
}

/**
 * Thick-walled Rolled-Rim Brass Flour Sieve Drum (Seamless LatheGeometry, 64 segs)
 * Replaces paper-thin open cylinder wall with real physical wall thickness & rolled top/bottom lips.
 */
function buildThickBrassSieveDrumGeo(): THREE.BufferGeometry {
  const rIn = 0.121;
  const rOut = 0.126;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(rIn, -0.024),
    new THREE.Vector2(rOut + 0.0014, -0.024),
    new THREE.Vector2(rOut + 0.0020, -0.021),
    new THREE.Vector2(rOut, -0.018),
    new THREE.Vector2(rOut, 0.020),
    new THREE.Vector2(rOut + 0.0024, 0.0225), // top rolled brass bead lip
    new THREE.Vector2(rOut + 0.0012, 0.0252),
    new THREE.Vector2(rIn, 0.0245),
    new THREE.Vector2(rIn, -0.024),
  ];
  return createSeamlessLatheGeometry(pts, 64);
}

/**
 * Tapered French Beechwood Stirring Spoon Handle (Seamless LatheGeometry, y = 0 .. 0.195)
 */
function buildFrenchWoodenSpoonHandleGeo(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, -0.004),
    new THREE.Vector2(0.0052, 0.0),
    new THREE.Vector2(0.0048, 0.045),
    new THREE.Vector2(0.0056, 0.110),
    new THREE.Vector2(0.0068, 0.172),
    new THREE.Vector2(0.0062, 0.188),
    new THREE.Vector2(0.0038, 0.194),
    new THREE.Vector2(0.0001, 0.196),
  ];
  return createSeamlessLatheGeometry(pts, 32);
}

/**
 * Sculpted Concave Oval Beechwood Spoon Bowl (y = -0.056 .. 0.004)
 */
function buildFrenchWoodenSpoonBowlGeo(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.004);
  shape.bezierCurveTo(0.011, 0.002, 0.018, -0.014, 0.017, -0.032);
  shape.bezierCurveTo(0.016, -0.048, 0.008, -0.056, 0, -0.056);
  shape.bezierCurveTo(-0.008, -0.056, -0.016, -0.048, -0.017, -0.032);
  shape.bezierCurveTo(-0.018, -0.014, -0.011, 0.002, 0, 0.004);
  shape.closePath();

  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0046,
    bevelEnabled: true,
    bevelThickness: 0.0022,
    bevelSize: 0.0020,
    bevelSegments: 3,
    curveSegments: 16,
  });
  g.translate(0, 0, -0.0023);
  // Gently dish the spoon bowl along Z for authentic concave silhouette
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const normX = px / 0.019;
    const normY = (py + 0.028) / 0.030;
    const r2 = Math.min(1, normX * normX + normY * normY);
    const dishOffset = (1 - r2) * 0.0048;
    pos.setZ(i, pz - dishOffset);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

function createWovenSieveMeshTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const step = 12;
  // Subtle alternating warp/weft brass wire weave with metallic highlight & shadow edge
  for (let i = 0; i <= size; i += step) {
    ctx.strokeStyle = 'rgba(130, 108, 72, 0.85)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(232, 212, 168, 0.96)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(i - 0.5, 0);
    ctx.lineTo(i - 0.5, size);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(130, 108, 72, 0.85)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(240, 222, 182, 0.96)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, i - 0.5);
    ctx.lineTo(size, i - 0.5);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3.5, 3.5);
  tex.anisotropy = 8;
  return tex;
}

function buildLatheCopperBowlGeo(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, 0.0),
    new THREE.Vector2(0.088, 0.0),
    new THREE.Vector2(0.118, 0.012),
    new THREE.Vector2(0.152, 0.044),
    new THREE.Vector2(0.172, 0.086),
    new THREE.Vector2(0.178, 0.112),
    new THREE.Vector2(0.186, 0.116),
    new THREE.Vector2(0.184, 0.123),
    new THREE.Vector2(0.170, 0.114),
    new THREE.Vector2(0.165, 0.086),
    new THREE.Vector2(0.145, 0.046),
    new THREE.Vector2(0.112, 0.017),
    new THREE.Vector2(0.082, 0.006),
    new THREE.Vector2(0.0001, 0.005),
  ];
  return createSeamlessLatheGeometry(pts, 72);
}

function buildLatheMauvielPotGeo(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, 0.0),
    new THREE.Vector2(0.132, 0.0),
    new THREE.Vector2(0.138, 0.007),
    new THREE.Vector2(0.141, 0.098),
    new THREE.Vector2(0.147, 0.112),
    new THREE.Vector2(0.153, 0.117),
    new THREE.Vector2(0.149, 0.122),
    new THREE.Vector2(0.139, 0.114),
    new THREE.Vector2(0.134, 0.096),
    new THREE.Vector2(0.132, 0.011),
    new THREE.Vector2(0.124, 0.006),
    new THREE.Vector2(0.0001, 0.006),
  ];
  return createSeamlessLatheGeometry(pts, 72);
}

function buildCeramicSpoonRestGeo(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, 0.0),
    new THREE.Vector2(0.024, 0.0),
    new THREE.Vector2(0.036, 0.004),
    new THREE.Vector2(0.041, 0.011),
    new THREE.Vector2(0.039, 0.0135),
    new THREE.Vector2(0.034, 0.0115),
    new THREE.Vector2(0.022, 0.0052),
    new THREE.Vector2(0.0001, 0.0045),
  ];
  const g = createSeamlessLatheGeometry(pts, 40);
  g.scale(1.0, 1.0, 1.48);
  g.computeVertexNormals();
  return g;
}

function buildSpatulaBatterClingGeo(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.022, 24, 16);
  g.scale(1.02, 1.26, 0.36);
  g.translate(0, -0.056, 0);
  return g;
}

function buildStarFlutedNozzleGeo(): THREE.BufferGeometry {
  const segs = 36;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0145, 0.021),
    new THREE.Vector2(0.0155, 0.018),
    new THREE.Vector2(0.0145, 0.014),
    new THREE.Vector2(0.0096, -0.006),
    new THREE.Vector2(0.0064, -0.021),
    new THREE.Vector2(0.0048, -0.021),
    new THREE.Vector2(0.0128, 0.018),
    new THREE.Vector2(0.0145, 0.021),
  ];
  const g = createSeamlessLatheGeometry(pts, segs);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    if (py < -0.006) {
      const tipWeight = THREE.MathUtils.smoothstep(-py, 0.006, 0.021);
      const ang = Math.atan2(pz, px);
      const starMod = 1.0 + 0.24 * Math.cos(ang * 6.0) * tipWeight;
      const toothZ = Math.max(0, Math.cos(ang * 6.0)) * 0.0022 * tipWeight;
      pos.setXYZ(i, px * starMod, py - toothZ, pz * starMod);
    }
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

function buildStarFlutedSpiralGeo(curve: THREE.CatmullRomCurve3): THREE.BufferGeometry {
  const steps = 112;
  const radialSegs = 24;
  const frames = curve.computeFrenetFrames(steps, false);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const p = new THREE.Vector3();
  const v = new THREE.Vector3();

  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    curve.getPointAt(u, p);
    const n = frames.normals[i];
    const b = frames.binormals[i];
    const twist = u * Math.PI * 5.2;
    const taper = THREE.MathUtils.smoothstep(u, 0.0, 0.06) * (0.94 + 0.08 * Math.sin(u * Math.PI));

    for (let j = 0; j <= radialSegs; j++) {
      const phi = (j / radialSegs) * Math.PI * 2;
      const flute = 1.0 + 0.22 * Math.cos(phi * 6.0);
      const r = 0.0185 * flute * taper;
      const a = phi + twist;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      v.copy(p)
        .addScaledVector(n, ca * r)
        .addScaledVector(b, sa * r);
      v.y = Math.max(0.004, v.y);
      positions.push(v.x, v.y, v.z);
      uvs.push(u * 8.0, j / radialSegs);
    }
  }

  const row = radialSegs + 1;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < radialSegs; j++) {
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
 * Delicate thin French ivory white-chocolate flake/shaving ribbon (0.95 ruffled turns, wafer-thin curved shell)
 * replacing thick dark chocolate pipes on the Step 4 marble tempering slab.
 */
function buildWhiteChocShavingCurlGeo(): THREE.BufferGeometry {
  const segW = 14;
  const segL = 48;
  const width = 0.068;
  const halfThick = 0.00045;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iy = 0; iy <= segL; iy++) {
    const t = iy / segL;
    const theta = -Math.PI * 0.48 + t * Math.PI * 1.92; // ~0.96 delicate open crescent curl
    const r = THREE.MathUtils.lerp(0.0155, 0.0085, t);
    const cy = 0.0162 + Math.sin(theta) * r;
    const cz = Math.cos(theta) * r;

    for (let ix = 0; ix <= segW; ix++) {
      const s = ix / segW;
      const xNorm = s * 2.0 - 1.0;
      const taper = 1.0 - t * 0.28;
      const ruffle = Math.sin(s * Math.PI * 3.0 + t * 4.2) * 0.0011;
      const x = xNorm * (width * 0.5) * taper + t * 0.016;
      const y = Math.max(0.0008, cy + ruffle + (1.0 - Math.cos(xNorm * 1.1)) * 0.0018);
      const z = cz + Math.sin(xNorm * 2.2) * 0.0015 + halfThick * 0.1;
      positions.push(x, y, z);
      uvs.push(s, t);
    }
  }

  const row = segW + 1;
  for (let iy = 0; iy < segL; iy++) {
    for (let ix = 0; ix < segW; ix++) {
      const a = iy * row + ix;
      const b = a + 1;
      const c = (iy + 1) * row + ix + 1;
      const d = (iy + 1) * row + ix;
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
 * Subdivided DoubleSide thin foil ribbon UV grid pre-shaped into a light 1.15-turn ruffled white-chocolate shaving,
 * dynamically curling off the Step 4 steel scraper blade via `createProgressiveCurlMaterial`.
 */
function buildHollowSpiralCurlGeo(): THREE.BufferGeometry {
  const segW = 16;
  const segL = 96;
  const width = 0.082;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iy = 0; iy <= segL; iy++) {
    const t = iy / segL;
    const u = 1.0 - t;
    const r = 0.0155 - u * 0.0082;
    const theta = -Math.PI * 0.5 - u * Math.PI * 2.0 * 1.15;
    const cy = 0.0165 + Math.sin(theta) * r;
    const cz = Math.cos(theta) * r - THREE.MathUtils.smoothstep(u, 0.0, 0.25) * 0.007;

    for (let ix = 0; ix <= segW; ix++) {
      const s = ix / segW;
      const xNorm = s * 2.0 - 1.0;
      const x = xNorm * (width * 0.5) * THREE.MathUtils.lerp(0.96, 1.08, u) + u * 0.016;
      positions.push(x, Math.max(0.0010, cy), cz);
      uvs.push(s, t);
    }
  }

  const row = segW + 1;
  for (let iy = 0; iy < segL; iy++) {
    for (let ix = 0; ix < segW; ix++) {
      const a = iy * row + ix;
      const b = a + 1;
      const c = (iy + 1) * row + ix + 1;
      const d = (iy + 1) * row + ix;
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

function createProgressiveCurlMaterial(): {
  mat: THREE.MeshPhysicalMaterial;
  uCurlArc: { value: number };
} {
  const uCurlArc = { value: 0.0 };
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#FFF5DE',
    roughness: 0.38,
    clearcoat: 0,
    sheen: 0.28,
    sheenColor: new THREE.Color('#FFFDF6'),
    sheenRoughness: 0.65,
    envMapIntensity: 0.36,
    side: THREE.DoubleSide,
  });
  mat.customProgramCacheKey = () => 'live-white-choc-shaving-v3';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCurlArc = uCurlArc;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform float uCurlArc;
        varying float vCurlU;
        varying float vCurlXNorm;

        vec3 evalLiveCurlPoint(float t, float xNorm, float arc) {
          float activeArc = clamp(arc, 0.08, 1.0);
          float u = (1.0 - t) * activeArc;
          float baseR = mix(0.0155, 0.0072, u);
          float endFlare = mix(0.86, 1.18, smoothstep(-1.0, 1.0, xNorm));
          float r = baseR * mix(1.0, endFlare, smoothstep(0.0, 0.16, u));
          float yCenter = 0.0165 + smoothstep(0.0, 0.24, u) * max(0.0, xNorm) * 0.0032;
          float theta = -1.5707963 - u * 7.22566;
          float cz = cos(theta) * r - smoothstep(0.0, 0.22, u) * 0.007;
          float ruffle = sin(xNorm * 5.2 + u * 4.0) * 0.0010 * smoothstep(0.05, 0.35, u);
          float cy = max(0.0010, yCenter + sin(theta) * r + ruffle);
          float px = xNorm * 0.041 * mix(0.96, 1.08, u) + u * 0.016;
          float yaw = u * 0.22;
          float cY = cos(yaw);
          float sY = sin(yaw);
          return vec3(px * cY - cz * sY, cy, px * sY + cz * cY);
        }
        `
      )
      .replace(
        '#include <beginnormal_vertex>',
        /* glsl */ `
        #include <beginnormal_vertex>
        float tN = clamp(uv.y, 0.0, 1.0);
        float xN = uv.x * 2.0 - 1.0;
        float t0 = clamp(tN - 0.008, 0.0, 0.992);
        float t1 = t0 + 0.008;
        float x0 = clamp(xN - 0.04, -1.0, 0.96);
        float x1 = x0 + 0.04;
        vec3 tangT = normalize(evalLiveCurlPoint(t1, xN, uCurlArc) - evalLiveCurlPoint(t0, xN, uCurlArc));
        vec3 tangX = normalize(evalLiveCurlPoint(tN, x1, uCurlArc) - evalLiveCurlPoint(tN, x0, uCurlArc));
        objectNormal = normalize(cross(tangT, tangX));
        `
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        #include <begin_vertex>
        float tP = clamp(uv.y, 0.0, 1.0);
        float xP = uv.x * 2.0 - 1.0;
        vCurlU = (1.0 - tP) * clamp(uCurlArc, 0.08, 1.0);
        vCurlXNorm = xP;
        transformed = evalLiveCurlPoint(tP, xP, uCurlArc);
        `
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        varying float vCurlU;
        varying float vCurlXNorm;
        `
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `
        #include <color_fragment>
        // Warm translucent ivory-caramel interior shading for delicate white-chocolate flake curls
        float hollowShade = gl_FrontFacing ? mix(0.95, 0.78, clamp(vCurlU * 1.05, 0.0, 1.0)) : 1.0;
        float edgeLip = smoothstep(0.82, 1.0, abs(vCurlXNorm));
        diffuseColor.rgb *= hollowShade * mix(1.0, 1.06, edgeLip);
        `
      );
  };
  return { mat, uCurlArc };
}

function createFlavorSimmeringPureeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTemp: { value: 68.0 },
      uStirOmega: { value: 0.0 },
      uStirAngle: { value: 0.0 },
      uBaseDeep: { value: new THREE.Color('#6A0616') },
      uBaseBright: { value: new THREE.Color('#C81432') },
      uFoamColor: { value: new THREE.Color('#FFD2DD') },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uTemp;
      uniform float uStirOmega;
      uniform float uStirAngle;
      varying vec2 vUv;
      varying float vWave;
      varying vec3 vSmoothNormal;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec3 pos = position;
        float boil = smoothstep(72.0, 104.0, uTemp);
        float stirMag = clamp(abs(uStirOmega) * 0.22, 0.0, 1.0);
        vec2 c = (uv - 0.5) * 2.0;
        float r = length(c);
        float theta = atan(c.y, c.x);

        // Spiral fluid vortex & curved spoon wake ridges driven live by angular stirring omega
        float swirlPhase = theta - uStirOmega * (0.30 + (1.0 - r) * 0.78) + r * 2.4 * sign(uStirOmega + 0.001);
        float wakeAngle = theta - uStirAngle;
        float wakeWave = sin(wakeAngle * 3.0 + r * 8.5) * stirMag * smoothstep(0.12, 0.78, r);
        float w1 = sin(r * 10.5 - uTime * (2.0 + boil * 2.2) + sin(swirlPhase * 3.0) * 1.2);
        float w2 = cos(c.x * 7.8 + c.y * 6.2 - uTime * (1.6 + boil * 1.7));
        float centerDip = -smoothstep(0.45, 0.0, r) * 0.0038 * stirMag;
        float meniscusClimb = smoothstep(0.76, 0.99, r) * (0.0032 + 0.0022 * stirMag);
        float subtleMotion = (w1 * 0.34 + w2 * 0.36 + wakeWave * 0.65) * max(boil, stirMag * 0.85);
        vWave = subtleMotion;
        pos.z += subtleMotion * 0.0016 + centerDip + meniscusClimb;

        vec2 radialDir = r > 0.001 ? c / r : vec2(1.0, 0.0);
        vec2 tangDir = vec2(-radialDir.y, radialDir.x);
        float radSlope = cos(r * 10.5 - uTime * 2.8) * 0.014 * boil + stirMag * 0.022 * (r - 0.2);
        float tangSlope = cos(wakeAngle * 3.0 + r * 8.5) * 0.036 * stirMag;
        vSmoothNormal = normalize(vec3(
          -radialDir.x * radSlope - tangDir.x * tangSlope,
          1.0,
          -radialDir.y * radSlope - tangDir.y * tangSlope
        ));

        vec4 world = modelMatrix * vec4(pos, 1.0);
        vWorldPos = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uTemp;
      uniform float uStirOmega;
      uniform float uStirAngle;
      uniform vec3 uBaseDeep;
      uniform vec3 uBaseBright;
      uniform vec3 uFoamColor;
      varying vec2 vUv;
      varying float vWave;
      varying vec3 vSmoothNormal;
      varying vec3 vWorldPos;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float valueNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        float boil = smoothstep(78.0, 103.5, uTemp);
        float stirMag = clamp(abs(uStirOmega) * 0.22, 0.0, 1.0);
        vec2 c = (vUv - 0.5) * 2.0;
        float radial = length(c);
        float theta = atan(c.y, c.x);

        // Spiral liquid advection for swirling seeds, sugar ribbons & translucent coulis depth
        float twistAngle = theta - uStirOmega * 0.22 * (1.2 - radial) + radial * 1.4 * stirMag;
        vec2 swirlUv = vec2(cos(twistAngle), sin(twistAngle)) * radial * 0.5 + 0.5;

        vec3 N = normalize(vSmoothNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(vec3(0.55, 0.78, 0.30));
        vec3 H = normalize(L + V);

        float coreGlow = smoothstep(0.85, 0.05, radial) * 0.36;
        vec3 col = mix(uBaseDeep * 0.85, uBaseBright * 1.12, clamp(0.38 + coreGlow + vWave * 0.24, 0.0, 1.0));

        // Wet caramelized pectin meniscus clinging around inner copper rim
        float rimMeniscus = smoothstep(0.82, 0.99, radial);
        col = mix(col, uBaseDeep * 0.42, rimMeniscus * 0.68);

        // Suspended swirling fruit seeds & pulp streaks
        float seedNoise = fract(sin(dot(floor(swirlUv * 96.0), vec2(12.9898, 78.233))) * 43758.5453);
        float seeds = smoothstep(0.962, 0.996, seedNoise) * (1.0 - rimMeniscus);
        col = mix(col, uBaseDeep * 0.38, seeds * 0.55);

        float n1 = valueNoise(swirlUv * 24.0 + vec2(uTime * 0.42, -uTime * 0.30));
        float n2 = valueNoise(swirlUv * 54.0 - vec2(uTime * 0.65, uTime * 0.48));
        float organicNoise = n1 * 0.62 + n2 * 0.38;
        float collarBand = smoothstep(0.68, 0.91, radial) * (1.0 - smoothstep(0.93, 0.995, radial));
        float edgeFoam = collarBand * smoothstep(0.48, 0.80, organicNoise) * max(boil, stirMag * 0.45);
        float wakeStream = smoothstep(0.55, 0.92, sin((theta - uStirAngle) * 2.0 + radial * 5.0)) * stirMag * 0.14;

        float simmerHeat = smoothstep(86.0, 103.0, uTemp);
        float bubbleRim = 0.0;
        for (int b = 0; b < 5; b++) {
          float fb = float(b);
          float cycle = fract(uTime * (0.55 + fb * 0.13) + fb * 0.37);
          vec2 bPos = vec2(sin(fb * 2.4 + floor(uTime * 0.55 + fb) * 1.7), cos(fb * 3.1 + floor(uTime * 0.55 + fb) * 2.3)) * 0.50;
          float d = length(c - bPos) + (organicNoise - 0.5) * 0.018;
          float rad = mix(0.008, 0.036, cycle);
          float ring = smoothstep(rad + 0.014, rad, d) * smoothstep(rad - 0.018, rad - 0.003, d);
          bubbleRim += ring * sin(cycle * 3.14159265) * simmerHeat;
        }
        col = mix(col, uFoamColor, clamp(edgeFoam * 0.48 + wakeStream + bubbleRim * 0.16, 0.0, 0.52));

        // Soft Ghibli fruit compote Fresnel warmth (zero harsh white sky glare)
        float fres = pow(max(0.0001, 1.0 - clamp(dot(N, V), 0.0, 1.0)), 3.2);
        vec3 skyReflect = mix(vec3(0.95, 0.94, 0.88), vec3(1.0, 0.90, 0.78), 0.56);
        float spec = pow(max(dot(N, H), 0.0001), 48.0) * (0.28 + stirMag * 0.22 + bubbleRim * 0.08);
        col += skyReflect * fres * (0.14 + rimMeniscus * 0.10) + vec3(1.0, 0.95, 0.86) * spec;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

const ASSEMBLY_LAYER_REST_Y = [0.074, 0.094, 0.114, 0.134] as const;
const SIFT_SHAKE_DURATION = 0.74;
const SIFT_ACTIVE_PORTION = 0.42;
const JELLY_NORMAL_SCALE = new THREE.Vector2(0.45, 0.45);
const SPONGE_NORMAL_SCALE = new THREE.Vector2(1.25, 1.25);
const CRUNCH_NORMAL_SCALE = new THREE.Vector2(1.30, 1.30);
const LINEN_BAG_NORMAL_SCALE = new THREE.Vector2(0.28, 0.28);

/**
 * Active Culinary Craft Vessels & Simulation Loop on the Central Marble Island
 * Coordinates cleanly with <AtelierEnvironment /> (which renders the island, marble tempering slab,
 * IR gun, brass revolving turntable, rear ovens & blast chiller) and <HeroEntremetCake /> (Steps 6 & 7).
 */
export const InteractiveStages3D: React.FC = () => {
  const { camera, size, gl } = useThree();
  const textures = useMemo(() => getAtelierTextures(), []);
  const cakeTextures = useMemo(() => getCakeProceduralTextures(), []);
  const craftAssets = useMemo(() => getCottageCraftAssets(), []);

  const currentStep = useGameStore((s) => s.currentStep);
  const selectedFlavor = useGameStore((s) => s.selectedFlavor);
  const celebrationPulse = useGameStore((s) => s.celebrationPulse);
  const stepFailures = useGameStore((s) => s.stepFailures);
  const stepCompleted = useGameStore((s) => s.stepCompleted);
  const isBaking = useGameStore((s) => s.isBaking);
  const bakeProgress = useGameStore((s) => s.bakeProgress);
  const setInteractingWithProp = useGameStore((s) => s.setInteractingWithProp);
  const retryStep = useGameStore((s) => s.retryStep);
  const flavorId = resolveFlavorId(selectedFlavor);
  const flavor = ENTREMET_FLAVOR_PRESETS[flavorId];

  const siftProgress = useGameStore((s) => s.siftProgress);
  const sieveShakeImpulse = useGameStore((s) => s.sieveShakeImpulse);
  const jFoldCount = useGameStore((s) => s.jFoldCount);
  const jFoldAnim = useGameStore((s) => s.jFoldAnim);
  const shakeSieve = useGameStore((s) => s.shakeSieve);
  const performJFoldStroke = useGameStore((s) => s.performJFoldStroke);

  const setOvenTemp = useGameStore((s) => s.setOvenTemp);
  const startOvenBake = useGameStore((s) => s.startOvenBake);
  const pullFromOven = useGameStore((s) => s.pullFromOven);
  const tickOvenBake = useGameStore((s) => s.tickOvenBake);

  const berryTemp = useGameStore((s) => s.berryTemp);
  const stirAngle = useGameStore((s) => s.stirAngle);
  const berryLockedTemp = useGameStore((s) => s.berryLockedTemp);
  const stirCopperPot = useGameStore((s) => s.stirCopperPot);
  const pourAtCurrentTemp = useGameStore((s) => s.pourAtCurrentTemp);
  const tickCopperPotThermal = useGameStore((s) => s.tickCopperPotThermal);
  const tickBlastChiller = useGameStore((s) => s.tickBlastChiller);

  const chocPhase = useGameStore((s) => s.chocPhase);
  const chocCurlsCount = useGameStore((s) => s.chocCurlsCount);
  const scrapeMarbleChocolate = useGameStore((s) => s.scrapeMarbleChocolate);
  const shaveChocolateCurl = useGameStore((s) => s.shaveChocolateCurl);

  const mousseSpiralProgress = useGameStore((s) => s.mousseSpiralProgress);
  const turntableAngle = useGameStore((s) => s.turntableAngle);
  const assembledStage = useGameStore((s) => s.assembledStage);
  const pipeMousseSpiral = useGameStore((s) => s.pipeMousseSpiral);
  const placeNextAssemblyInsert = useGameStore((s) => s.placeNextAssemblyInsert);

  const glazeCoverage = useGameStore((s) => s.glazeCoverage);
  const pourMirrorGlazeOrbit = useGameStore((s) => s.pourMirrorGlazeOrbit);
  const tickGlazeThermal = useGameStore((s) => s.tickGlazeThermal);
  const setPouringGlaze = useGameStore((s) => s.setPouringGlaze);

  const garnishStep = useGameStore((s) => s.garnishStep);
  const placeNextGarnishWithTweezers = useGameStore((s) => s.placeNextGarnishWithTweezers);
  const toggleSilverKnifeCut = useGameStore((s) => s.toggleSilverKnifeCut);
  const setLiveCraftPhysics = useGameStore((s) => s.setLiveCraftPhysics);

  const step1BowlSpringRef = useRef<THREE.Group>(null);
  const meringueMeshRef = useRef<THREE.Mesh>(null);
  const sieveGroupRef = useRef<THREE.Group>(null);
  const sieveHoveredRef = useRef(false);
  const sieveParkBlendRef = useRef(siftProgress >= 0.99 ? 1 : 0);
  const spatulaTransitRef = useRef(siftProgress >= 0.99 && jFoldCount < 3 ? 1 : 0);
  const flourSnowRef = useRef<THREE.Points>(null);
  const flourSnowMatRef = useRef<THREE.PointsMaterial>(null);
  const spatulaFoldRef = useRef<THREE.Group>(null);
  const batterClingMeshRef = useRef<THREE.Mesh>(null);
  const simmerSurfaceRef = useRef<THREE.Mesh>(null);
  const spoonOrbitGroupRef = useRef<THREE.Group>(null);
  const spoonFollowRef = useRef<THREE.Group>(null);
  const smoothStirAngleRef = useRef(stirAngle);
  const prevStirAngleRef = useRef(stirAngle);
  const stirVelSmoothRef = useRef(0);
  const chocCurlRefs = useRef<Array<THREE.Mesh | null>>([null, null, null]);
  const chocCurlPopRef = useRef<number[]>([0, 0, 0]);
  const prevCurlCountRef = useRef(chocCurlsCount);
  const liveCurlGroupRef = useRef<THREE.Group>(null);
  const liveBladeDragLocalRef = useRef(0);
  const liveCurlArcLocalRef = useRef(0);
  const liveBladeDragSmoothRef = useRef(0);
  const liveCurlArcSmoothRef = useRef(0);
  const turntableGroupRef = useRef<THREE.Group>(null);
  const smoothTurntableAngleRef = useRef(turntableAngle);
  const bullseyeGroupRef = useRef<THREE.Group>(null);
  const pipingBagGroupRef = useRef<THREE.Group>(null);
  const pipingBagMeshRef = useRef<THREE.Mesh>(null);
  const coaxialReticleRef = useRef<THREE.Mesh>(null);
  const lastAudioTimeRef = useRef<Record<string, number>>({});
  const triggerCooledAudio = useCallback((channel: string, cooldownMs: number, playFn: () => void) => {
    const now = performance.now();
    const prev = lastAudioTimeRef.current[channel] ?? 0;
    if (now - prev >= cooldownMs) {
      lastAudioTimeRef.current[channel] = now;
      playFn();
    }
  }, []);
  const meringueJiggleRef = useRef(0);
  const meringueJiggleVelRef = useRef(0);
  const batterWobbleVecRef = useRef(new THREE.Vector2(0, 0));
  const batterWobbleVelRef = useRef(new THREE.Vector2(0, 0));

  const lastImpulseRef = useRef(sieveShakeImpulse);
  const shakeTimerRef = useRef(0);
  const lastJFoldAnimRef = useRef(jFoldAnim);
  const jFoldTimerRef = useRef(0);
  const foldFurrowLevelRef = useRef(0);
  const jFoldLiveActiveRef = useRef(false);
  const jFoldStartClientRef = useRef<{ x: number; y: number } | null>(null);
  const jFoldLiveXZRef = useRef<[number, number]>([0, 0]);
  const jFoldSmoothXZRef = useRef<[number, number]>([0, 0]);
  const jFoldLiveWeightRef = useRef(0);
  const bowlTiltZRef = useRef(0);
  const bowlTiltVelZRef = useRef(0);
  const bowlSquashRef = useRef(0);
  const bowlSquashVelRef = useRef(0);
  const smoothSpiralRef = useRef(mousseSpiralProgress);

  // Step 5 spring drop-in refs for assembled layers 2..5 (indices 0..3)
  const dropGroupRefs = useRef<Array<THREE.Group | null>>([null, null, null, null]);
  const dropOffsetRef = useRef<number[]>([0.14, 0.14, 0.14, 0.14]);
  const dropVelRef = useRef<number[]>([0, 0, 0, 0]);
  const dropTriggeredRef = useRef<boolean[]>([false, false, false, false]);

  // Direct 3D Prop Dragging State (pointerId-tracked + window blur/contextmenu safe)
  const activeDragStationRef = useRef<InteractiveStationId | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const lastDragClientRef = useRef<{ x: number; y: number } | null>(null);
  const jFoldPointsRef = useRef<DragPoint[]>([]);
  const jFoldSpeedAccumRef = useRef<{ sum: number; count: number }>({ sum: 0, count: 0 });
  const ovenDialAccumRef = useRef(0);
  const curlDragAccumRef = useRef(0);
  const curlStrokeShavedRef = useRef(false);
  const knifeStrokeTriggeredRef = useRef(false);
  const knifeDragAccumRef = useRef(0);
  const lastGlazeAngleRef = useRef<number | null>(null);
  const glazeCenterScreenRef = useRef(new THREE.Vector3());
  const hoveredCursorModeRef = useRef<'pointer' | 'grab' | null>(null);
  const hoveredStepRef = useRef<number | null>(null);
  const [hoveredPropKey, setHoveredPropKey] = useState<string | null>(null);
  const hoveredPropKeyRef = useRef<string | null>(null);
  hoveredPropKeyRef.current = hoveredPropKey;

  const step1BowlVisualRef = useRef<THREE.Group>(null);
  const step1SieveVisualRef = useRef<THREE.Group>(null);
  const step1SpatulaVisualRef = useRef<THREE.Group>(null);
  const step3PotVisualRef = useRef<THREE.Group>(null);
  const step4ShavingsVisualRef = useRef<THREE.Group>(null);
  const step5RingVisualRef = useRef<THREE.Group>(null);
  const step5PipingVisualRef = useRef<THREE.Group>(null);
  const jellySpringsRef = useRef({
    step1Bowl: { value: 1, velocity: 0 },
    step1Sieve: { value: 1, velocity: 0 },
    step1Spatula: { value: 1, velocity: 0 },
    step3Pot: { value: 1, velocity: 0 },
    step4Shavings: { value: 1, velocity: 0 },
    step5Ring: { value: 1, velocity: 0 },
    step5Piping: { value: 1, velocity: 0 },
  });

  const neutralWhiteTex = useMemo(() => {
    const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);

  const hitboxMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
      }),
    []
  );

  const steelPbr = useMemo(() => getSteelPbrSet(1.6, 0.65), []);

  const stageToolPbr = useMemo(
    () => ({
      brassMicro: createMicroSurfaceMaps(0.20, 0.08, true, 643),
      rosewoodPbr: createWoodGrainPbr('#4E2B19', '#281108', 641),
      beechwoodPbr: createWoodGrainPbr('#C99F6D', '#8C633B', 647),
    }),
    []
  );

  const copperBowlMat = useMemo(
    () =>
      enhanceWithStylizedFresnelRim(
        enhanceWithExtremeMicroCraft(
          new THREE.MeshPhysicalMaterial({
            color: '#D87D50',
            metalness: 0.90,
            roughness: 0.28,
            normalMap: textures.hammeredCopperNormalMap,
            normalScale: new THREE.Vector2(0.32, 0.32),
            clearcoat: 0.14,
            clearcoatRoughness: 0.36,
            anisotropy: 0.40,
            iridescence: 0.10,
            iridescenceIOR: 1.36,
            envMapIntensity: 0.52,
            side: THREE.DoubleSide,
          }),
          { boxProjectedIBL: true, detailKind: 'brushed_metal', detailStrength: 0.12, cacheTag: 'stage-copper-v2' }
        ),
        { rimColor: '#FFE4B0', rimStrength: 0.30, rimPower: 2.6, topBias: 0.44, cacheTag: 'stage-copper-rim-v1' }
      ),
    [textures]
  );

  const stainlessMat = useMemo(
    () =>
      enhanceWithStylizedFresnelRim(
        enhanceWithExtremeMicroCraft(
          new THREE.MeshPhysicalMaterial({
            color: '#EAECEF',
            map: steelPbr.map,
            normalMap: steelPbr.normalMap,
            normalScale: new THREE.Vector2(0.24, 0.24),
            roughnessMap: steelPbr.roughnessMap,
            metalnessMap: steelPbr.metalnessMap,
            metalness: 0.88,
            roughness: 0.96,
            anisotropy: 0.62,
            clearcoat: 0.06,
            clearcoatRoughness: 0.38,
            envMapIntensity: 0.50,
          }),
          { boxProjectedIBL: true, detailKind: 'brushed_metal', detailStrength: 0.12, cacheTag: 'stage-stainless-v2' }
        ),
        { rimColor: '#FFF5E0', rimStrength: 0.28, rimPower: 2.7, topBias: 0.45, cacheTag: 'stage-stainless-rim-v1' }
      ),
    [steelPbr]
  );

  const brassMat = useMemo(
    () =>
      enhanceWithStylizedFresnelRim(
        enhanceWithExtremeMicroCraft(
          new THREE.MeshPhysicalMaterial({
            color: '#CFA65B',
            bumpMap: stageToolPbr.brassMicro.bumpMap,
            bumpScale: 0.0028,
            roughnessMap: stageToolPbr.brassMicro.roughnessMap,
            metalness: 0.88,
            roughness: 1.0,
            anisotropy: 0.58,
            envMapIntensity: 0.52,
          }),
          { boxProjectedIBL: true, detailKind: 'brushed_metal', detailStrength: 0.12, cacheTag: 'stage-brass-v2' }
        ),
        { rimColor: '#FFE8B6', rimStrength: 0.28, rimPower: 2.6, topBias: 0.45, cacheTag: 'stage-brass-rim-v1' }
      ),
    [stageToolPbr]
  );

  const focusAuraMat = useMemo(() => createSoftFocusAuraMaterial(), []);
  const rosewoodMat = useMemo(
    () =>
      enhanceWithStylizedFresnelRim(
        new THREE.MeshPhysicalMaterial({
          map: craftAssets.floralHandleTex,
          roughness: 0.48,
          clearcoat: 0.10,
          clearcoatRoughness: 0.38,
          envMapIntensity: 0.36,
        }),
        { rimColor: '#FFD6A2', rimStrength: 0.24, rimPower: 2.6, cacheTag: 'stage-rosewood-rim-v1' }
      ),
    [craftAssets]
  );
  const beechwoodMat = useMemo(
    () =>
      enhanceWithStylizedFresnelRim(
        new THREE.MeshPhysicalMaterial({
          map: stageToolPbr.beechwoodPbr.map,
          bumpMap: stageToolPbr.beechwoodPbr.bumpMap,
          bumpScale: 0.0044,
          roughnessMap: stageToolPbr.beechwoodPbr.roughnessMap,
          roughness: 1.0,
          clearcoat: 0.04,
          clearcoatRoughness: 0.55,
          envMapIntensity: 0.32,
        }),
        { rimColor: '#FFE5B4', rimStrength: 0.26, rimPower: 2.6, cacheTag: 'stage-beech-rim-v1' }
      ),
    [stageToolPbr]
  );
  const pipingBagMat = useMemo(
    () =>
      enhanceWithStylizedFresnelRim(
        new THREE.MeshPhysicalMaterial({
          color: '#FBF6ED',
          normalMap: textures.linenNormalMap,
          normalScale: LINEN_BAG_NORMAL_SCALE,
          roughness: 0.74,
          sheen: 0.56,
          sheenColor: new THREE.Color('#FFFBF2'),
          sheenRoughness: 0.78,
          envMapIntensity: 0.28,
          transparent: true,
          opacity: 0.95,
        }),
        { rimColor: '#FFF6DE', rimStrength: 0.30, rimPower: 2.4, topBias: 0.48, cacheTag: 'stage-bag-rim-v1' }
      ),
    [textures]
  );
  const chocCurlMat = useMemo(
    () =>
      enhanceWithStylizedFresnelRim(
        new THREE.MeshPhysicalMaterial({
          color: '#FFF5DE',
          roughness: 0.40,
          clearcoat: 0,
          sheen: 0.26,
          sheenColor: new THREE.Color('#FFFDF6'),
          sheenRoughness: 0.68,
          envMapIntensity: 0.34,
          side: THREE.DoubleSide,
        }),
        { rimColor: '#FFF8E4', rimStrength: 0.30, rimPower: 2.5, cacheTag: 'stage-whitechoc-rim-v1' }
      ),
    []
  );
  const siliconeMat = useMemo(
    () =>
      enhanceWithStylizedFresnelRim(
        new THREE.MeshPhysicalMaterial({
          color: '#F2EADA',
          roughness: 0.56,
          clearcoat: 0,
          envMapIntensity: 0.34,
        }),
        { rimColor: '#FFF6E0', rimStrength: 0.28, rimPower: 2.6, cacheTag: 'stage-silicone-rim-v1' }
      ),
    []
  );

  const berrySimmerMat = useMemo(() => createFlavorSimmeringPureeMaterial(), []);
  const potSteamMat = useMemo(() => createVaporMistMaterial('#FFF5F7', 0.22), []);
  const caramelMat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: '#D99B52',
      normalMap: cakeTextures.jellyNormalMap,
      normalScale: new THREE.Vector2(0.10, 0.10),
      roughness: 0.34,
      clearcoat: 0,
      sheen: 0.32,
      sheenColor: new THREE.Color('#FFE8BA'),
      sheenRoughness: 0.55,
      envMapIntensity: 0.40,
    });
    return enhanceWithStylizedFresnelRim(
      enhanceWithFoodSSS(m, {
        sssColor: '#F3B469',
        sssStrength: 0.36,
        wrapAmount: 0.52,
        cacheTag: 'stage-caramel-velvet',
      }),
      { rimColor: '#FFE4A8', rimStrength: 0.28, rimPower: 2.6, cacheTag: 'stage-caramel-rim-v1' }
    );
  }, [cakeTextures]);
  const chocCurlGeo = useMemo(() => ensureSecondaryUv(buildWhiteChocShavingCurlGeo()), []);
  const copperBowlGeo = useMemo(() => ensureSecondaryUv(buildLatheCopperBowlGeo()), []);
  const mauvielPotGeo = useMemo(() => ensureSecondaryUv(buildLatheMauvielPotGeo()), []);
  const sieveDrumGeo = useMemo(() => ensureSecondaryUv(buildThickBrassSieveDrumGeo()), []);
  const sieveEarTabGeo = useMemo(() => createBeveledBoxGeometry(0.064, 0.0055, 0.020, 0.0014), []);
  const sieveEarHookGeo = useMemo(() => new THREE.TorusGeometry(0.011, 0.0028, 12, 20, Math.PI), []);
  const potMountPlateGeo = useMemo(() => createBeveledBoxGeometry(0.010, 0.024, 0.038, 0.0022), []);
  const woodenSpoonHandleGeo = useMemo(() => ensureSecondaryUv(buildFrenchWoodenSpoonHandleGeo()), []);
  const woodenSpoonBowlGeo = useMemo(() => ensureSecondaryUv(buildFrenchWoodenSpoonBowlGeo()), []);
  const mousseRingGeo = useMemo(
    () => ensureSecondaryUv(createMousseRingGeometry(0.185, 0.145, 0.0026, 64)),
    []
  );
  const pipingBagGeo = useMemo(
    () => ensureSecondaryUv(createPipingBagGeometry(0.054, 0.205)),
    []
  );
  const nozzleConeGeo = useMemo(
    () => ensureSecondaryUv(buildStarFlutedNozzleGeo()),
    []
  );
  const nozzleRimGeo = useMemo(
    () => ensureSecondaryUv(new THREE.TorusGeometry(0.0058, 0.0014, 12, 24)),
    []
  );
  const spoonRestGeo = useMemo(() => ensureSecondaryUv(buildCeramicSpoonRestGeo()), []);
  const spoonRestMat = useMemo(
    () =>
      enhanceWithStylizedFresnelRim(
        new THREE.MeshPhysicalMaterial({
          color: '#F2E9DA',
          roughness: 0.46,
          clearcoat: 0.14,
          clearcoatRoughness: 0.28,
          envMapIntensity: 0.36,
        }),
        { rimColor: '#FFF4DC', rimStrength: 0.28, rimPower: 2.6, cacheTag: 'stage-rest-rim-v1' }
      ),
    []
  );
  const batterClingGeo = useMemo(() => buildSpatulaBatterClingGeo(), []);
  const liveCurlGeo = useMemo(() => ensureSecondaryUv(buildHollowSpiralCurlGeo()), []);
  const liveCurlMatBundle = useMemo(() => createProgressiveCurlMaterial(), []);
  const parchmentMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#F4EAD6',
        roughness: 0.84,
        sheen: 0.24,
        sheenColor: new THREE.Color('#FFFBF2'),
        envMapIntensity: 0.28,
      }),
    []
  );
  const bullseyeRingMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#E5BD68',
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  );
  const whippedMeringueGeo = useMemo(() => ensureSecondaryUv(buildWhippedMeringueDomeGeo()), []);
  const dustedFlourGeo = useMemo(() => ensureSecondaryUv(buildDustedAlmondFlourGeo()), []);
  const siftMoundGeo = useMemo(() => ensureSecondaryUv(buildSiftedFlourConeMoundGeo()), []);
  const dustedFlourAlphaTex = useMemo(() => createDustedFlourAlphaTexture(), []);
  const dustedFlourMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#F5EAD6',
        roughness: 0.96,
        metalness: 0.0,
        sheen: 0.78,
        sheenColor: new THREE.Color('#FFFDF8'),
        sheenRoughness: 0.86,
        bumpMap: cakeTextures.spongeBumpMap,
        bumpScale: 0.0042,
        alphaMap: dustedFlourAlphaTex,
        alphaTest: 0.14,
        side: THREE.DoubleSide,
      }),
    [cakeTextures, dustedFlourAlphaTex]
  );
  const siftMoundMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#F8F0E0',
        roughness: 0.97,
        metalness: 0.0,
        sheen: 0.86,
        sheenColor: new THREE.Color('#FFFDF9'),
        sheenRoughness: 0.82,
        bumpMap: cakeTextures.spongeBumpMap,
        bumpScale: 0.0056,
      }),
    [cakeTextures]
  );
  const spatulaBladeGeo = useMemo(() => buildFrenchSpatulaBladeGeo(), []);
  const spatulaHandleGeo = useMemo(() => createTurnedHandleGeometry(0.145, 0.0115), []);
  const potHandleGeo = useMemo(() => createForgedPanHandleGeometry(0.19), []);
  const mousseCollarGeo = useMemo(() => buildMousseWallCollarGeo(), []);
  const jellyInsertGeo = useMemo(() => buildPlanarBeveledDiscGeo(0.162, 0.024, 0.0035), []);
  const caramelInsertGeo = useMemo(() => buildPlanarBeveledDiscGeo(0.144, 0.022, 0.0035), []);
  const spongeInsertGeo = useMemo(() => buildPlanarBeveledDiscGeo(0.171, 0.024, 0.0028), []);
  const crunchInsertGeo = useMemo(() => buildPlanarBeveledDiscGeo(0.180, 0.018, 0.0025), []);
  const sieveMeshTex = useMemo(() => createWovenSieveMeshTexture(), []);
  const particleSpriteTex = useMemo(() => createSoftParticleSpriteTexture(), []);

  const flourSnowGeo = useMemo(() => {
    const count = 260;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(Math.random()) * 0.105;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = -0.02 - Math.random() * 0.135;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  const spiralPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const total = 90;
    for (let i = 0; i <= total; i++) {
      const t = i / total;
      const a = t * Math.PI * 6.5;
      const r = t * 0.155;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0.022 + t * 0.018, Math.sin(a) * r));
    }
    return new THREE.CatmullRomCurve3(pts);
  }, []);

  const spiralGeo = useMemo(() => ensureSecondaryUv(buildStarFlutedSpiralGeo(spiralPoints)), [spiralPoints]);

  const mousseSssMat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: '#FFF9ED',
      map: textures.vanillaMousseMap,
      bumpMap: cakeTextures.chantillyBumpMap,
      bumpScale: 0.0022,
      roughnessMap: cakeTextures.chantillyRoughnessMap,
      roughness: 1.0,
      clearcoat: 0,
      sheen: 0.46,
      sheenColor: new THREE.Color('#FFF4D8'),
      sheenRoughness: 0.72,
      envMapIntensity: 0.36,
    });
    return enhanceWithStylizedFresnelRim(
      enhanceWithFoodSSS(m, { sssColor: '#FFE8B0', sssStrength: 0.34, cacheTag: 'stage-chantilly-v3' }),
      { rimColor: '#FFF3D4', rimStrength: 0.26, rimPower: 2.6, cacheTag: 'stage-chantilly-rim-v1' }
    );
  }, [textures, cakeTextures]);

  const meringueSssMat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: '#FFF2DC',
      bumpMap: cakeTextures.chantillyBumpMap,
      bumpScale: 0.0038,
      roughnessMap: cakeTextures.chantillyRoughnessMap,
      roughness: 0.92,
      clearcoat: 0,
      sheen: 0.52,
      sheenColor: new THREE.Color('#FFEAC6'),
      sheenRoughness: 0.76,
      envMapIntensity: 0.28,
    });
    return enhanceMeringueWithJFoldFurrow(m);
  }, [cakeTextures]);

  // Dispose component-owned geometries, textures & materials on unmount (shared steelPbr singleton textures stay cached)
  useEffect(() => {
    return () => {
      hitboxMat.dispose();
      copperBowlMat.dispose();
      stainlessMat.dispose();
      brassMat.dispose();
      rosewoodMat.dispose();
      beechwoodMat.dispose();
      pipingBagMat.dispose();
      chocCurlMat.dispose();
      stageToolPbr.brassMicro.bumpMap.dispose();
      stageToolPbr.brassMicro.roughnessMap.dispose();
      stageToolPbr.rosewoodPbr.map.dispose();
      stageToolPbr.rosewoodPbr.bumpMap.dispose();
      stageToolPbr.rosewoodPbr.roughnessMap.dispose();
      stageToolPbr.beechwoodPbr.map.dispose();
      stageToolPbr.beechwoodPbr.bumpMap.dispose();
      stageToolPbr.beechwoodPbr.roughnessMap.dispose();
      siliconeMat.dispose();
      focusAuraMat.dispose();
      berrySimmerMat.dispose();
      potSteamMat.dispose();
      caramelMat.dispose();
      chocCurlGeo.dispose();
      copperBowlGeo.dispose();
      mauvielPotGeo.dispose();
      sieveDrumGeo.dispose();
      sieveEarTabGeo.dispose();
      sieveEarHookGeo.dispose();
      potMountPlateGeo.dispose();
      woodenSpoonHandleGeo.dispose();
      woodenSpoonBowlGeo.dispose();
      mousseRingGeo.dispose();
      pipingBagGeo.dispose();
      nozzleConeGeo.dispose();
      nozzleRimGeo.dispose();
      whippedMeringueGeo.dispose();
      dustedFlourGeo.dispose();
      siftMoundGeo.dispose();
      dustedFlourAlphaTex.dispose();
      dustedFlourMat.dispose();
      siftMoundMat.dispose();
      spatulaBladeGeo.dispose();
      spatulaHandleGeo.dispose();
      potHandleGeo.dispose();
      mousseCollarGeo.dispose();
      jellyInsertGeo.dispose();
      caramelInsertGeo.dispose();
      spongeInsertGeo.dispose();
      crunchInsertGeo.dispose();
      sieveMeshTex.dispose();
      particleSpriteTex.dispose();
      flourSnowGeo.dispose();
      spiralGeo.dispose();
      mousseSssMat.dispose();
      meringueSssMat.dispose();
      spoonRestGeo.dispose();
      spoonRestMat.dispose();
      batterClingGeo.dispose();
      liveCurlGeo.dispose();
      liveCurlMatBundle.mat.dispose();
      parchmentMat.dispose();
      bullseyeRingMat.dispose();
      neutralWhiteTex.dispose();
    };
  }, [
    hitboxMat,
    copperBowlMat,
    stainlessMat,
    brassMat,
    rosewoodMat,
    beechwoodMat,
    pipingBagMat,
    chocCurlMat,
    stageToolPbr,
    siliconeMat,
    focusAuraMat,
    berrySimmerMat,
    potSteamMat,
    caramelMat,
    chocCurlGeo,
    copperBowlGeo,
    mauvielPotGeo,
    sieveDrumGeo,
    sieveEarTabGeo,
    sieveEarHookGeo,
    potMountPlateGeo,
    woodenSpoonHandleGeo,
    woodenSpoonBowlGeo,
    mousseRingGeo,
    pipingBagGeo,
    nozzleConeGeo,
    nozzleRimGeo,
    whippedMeringueGeo,
    dustedFlourGeo,
    siftMoundGeo,
    dustedFlourAlphaTex,
    dustedFlourMat,
    siftMoundMat,
    spatulaBladeGeo,
    spatulaHandleGeo,
    potHandleGeo,
    mousseCollarGeo,
    jellyInsertGeo,
    caramelInsertGeo,
    spongeInsertGeo,
    crunchInsertGeo,
    sieveMeshTex,
    particleSpriteTex,
    flourSnowGeo,
    spiralGeo,
    mousseSssMat,
    meringueSssMat,
    spoonRestGeo,
    spoonRestMat,
    batterClingGeo,
    liveCurlGeo,
    liveCurlMatBundle,
    parchmentMat,
    bullseyeRingMat,
    neutralWhiteTex,
  ]);

  // Ensure flour snow starts hidden cleanly until first impulse
  useEffect(() => {
    if (flourSnowRef.current) {
      flourSnowRef.current.visible = false;
    }
  }, []);

  // Synchronize Step 3 puree & steam and Step 5 mousse & molten core colors to selectedFlavor
  useEffect(() => {
    // Step 3 simmering puree colors
    const deepCol = new THREE.Color(flavor.jellyAttenuation).lerp(new THREE.Color(flavor.jellyColor), 0.22);
    const brightCol = new THREE.Color(flavor.jellyColor);
    const foamCol = new THREE.Color(flavor.jellySssColor).lerp(new THREE.Color('#FFF8F2'), 0.48);
    berrySimmerMat.uniforms.uBaseDeep.value.copy(deepCol);
    berrySimmerMat.uniforms.uBaseBright.value.copy(brightCol);
    berrySimmerMat.uniforms.uFoamColor.value.copy(foamCol);

    potSteamMat.uniforms.uTint.value
      .set('#FFF8FA')
      .lerp(new THREE.Color(flavor.jellySssColor), 0.16);

    // Step 5 Chantilly & SSS tint (swaps to neutralWhiteTex instead of null to avoid runtime shader recompilation!)
    mousseSssMat.color.set('#FFF9ED').lerp(new THREE.Color(flavor.mousseColor), 0.72);
    mousseSssMat.map = flavor.mousseVanillaSpecks > 0.45 ? textures.vanillaMousseMap : neutralWhiteTex;
    const sssUniforms = mousseSssMat.userData.sssUniforms as
      | { uSssColor?: { value: THREE.Color } }
      | undefined;
    sssUniforms?.uSssColor?.value.set(flavor.mousseSssColor);

    // Step 4 ivory white-chocolate / caramel flake color sync (guards against dark pipe hues)
    const rawShavingCol = new THREE.Color(flavor.chocolateColor);
    const hsl = { h: 0, s: 0, l: 0 };
    rawShavingCol.getHSL(hsl);
    const softShavingCol =
      hsl.l >= 0.42
        ? rawShavingCol
        : new THREE.Color('#FFF5DE').lerp(new THREE.Color('#E9CFA8'), 0.42);
    chocCurlMat.color.copy(softShavingCol);
    liveCurlMatBundle.mat.color.copy(softShavingCol);

    // Step 5 warm golden caramel cremeux core PBR + SSS tint
    caramelMat.color
      .set('#D99B52')
      .lerp(new THREE.Color(flavor.caramelWarm), 0.48);
    const caramelSssUniforms = caramelMat.userData.sssUniforms as
      | { uSssColor?: { value: THREE.Color } }
      | undefined;
    caramelSssUniforms?.uSssColor?.value.set(flavor.caramelWarm);
  }, [
    flavor,
    textures,
    neutralWhiteTex,
    berrySimmerMat,
    potSteamMat,
    mousseSssMat,
    caramelMat,
    chocCurlMat,
    liveCurlMatBundle,
  ]);

  // Update spiral TubeGeometry drawRange cleanly in useEffect (never in render body)
  useEffect(() => {
    if (spiralGeo.index) {
      spiralGeo.setDrawRange(0, Math.floor(spiralGeo.index.count * mousseSpiralProgress));
    }
    if (mousseSpiralProgress === 0) {
      smoothSpiralRef.current = 0;
    }
  }, [spiralGeo, mousseSpiralProgress]);

  // Trigger & reset smooth spring drop-in offsets for Step 5 layers 2..5
  useLayoutEffect(() => {
    for (let i = 0; i < 4; i++) {
      const stageReq = i + 2;
      const g = dropGroupRefs.current[i];
      if (assembledStage >= stageReq) {
        if (!dropTriggeredRef.current[i]) {
          dropTriggeredRef.current[i] = true;
          dropOffsetRef.current[i] = 0.14;
          dropVelRef.current[i] = 0;
          patisserieAudio.playStep5InsertDrop(i);
        }
        if (g) {
          g.position.y = dropOffsetRef.current[i];
        }
      } else {
        dropTriggeredRef.current[i] = false;
        dropOffsetRef.current[i] = 0.14;
        dropVelRef.current[i] = 0;
        if (g) {
          g.position.y = 0.14;
        }
      }
    }
  }, [assembledStage]);

  const clearActiveDragState = useCallback(
    (restoreCursor = true) => {
      const finishedStation = activeDragStationRef.current;
      activeDragStationRef.current = null;
      activePointerIdRef.current = null;
      lastDragClientRef.current = null;
      jFoldPointsRef.current = [];
      jFoldSpeedAccumRef.current = { sum: 0, count: 0 };
      jFoldLiveActiveRef.current = false;
      jFoldStartClientRef.current = null;
      ovenDialAccumRef.current = 0;
      curlDragAccumRef.current = 0;
      curlStrokeShavedRef.current = false;
      liveBladeDragLocalRef.current = 0;
      liveCurlArcLocalRef.current = 0;
      knifeStrokeTriggeredRef.current = false;
      knifeDragAccumRef.current = 0;
      lastGlazeAngleRef.current = null;
      setLiveCraftPhysics({ stirOmega: 0, liveBladeDrag: 0, liveCurlArc: 0 });
      if (finishedStation === 'glaze') {
        setPouringGlaze(false);
      }
      setInteractingWithProp(false);
      if (!restoreCursor) {
        document.body.style.cursor = 'auto';
        return;
      }
      const state = useGameStore.getState();
      const stillActive =
        hoveredStepRef.current === state.currentStep &&
        ((state.currentStep === 1 && !state.stepFailures[1] && (state.siftProgress < 0.99 || state.jFoldCount < 3)) ||
          (state.currentStep === 2 && !state.stepFailures[2]) ||
          (state.currentStep === 3 && !state.stepFailures[3] && state.berryLockedTemp === null) ||
          (state.currentStep === 4 && !state.stepFailures[4] && state.chocCurlsCount < 3) ||
          (state.currentStep === 5 && !state.stepFailures[5] && state.assembledStage < 5) ||
          (state.currentStep === 6 && !state.stepFailures[6] && state.glazeCoverage < 1) ||
          state.currentStep === 7);
      document.body.style.cursor = stillActive
        ? state.currentStep === 5 && state.assembledStage > 0
          ? 'pointer'
          : (hoveredCursorModeRef.current ?? 'grab')
        : 'auto';
    },
    [setInteractingWithProp, setPouringGlaze, setLiveCraftPhysics]
  );

  // Hover cursor & prop drag cleanup on step change & unmount
  useEffect(() => {
    hoveredStepRef.current = null;
    hoveredCursorModeRef.current = null;
    setHoveredPropKey(null);
    clearActiveDragState(false);
    return () => {
      hoveredStepRef.current = null;
      hoveredCursorModeRef.current = null;
      setHoveredPropKey(null);
      clearActiveDragState(false);
    };
  }, [currentStep, clearActiveDragState]);

  // Window-level drag tracking with pointerId isolation, blur/contextmenu safety, and discrete stroke evaluation
  useEffect(() => {
    const handleWinMove = (e: PointerEvent) => {
      const station = activeDragStationRef.current;
      if (!station) return;
      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
        return;
      }
      const prev = lastDragClientRef.current;
      if (prev) {
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) {
          const state = useGameStore.getState();
          if (station === 'sieve' && state.currentStep === 1 && state.siftProgress < 0.99) {
            const { amount, harshness } = computeStationDragDelta('sieve', dist);
            shakeSieve(amount, harshness);
            triggerCooledAudio('sieve', 165, () => patisserieAudio.playSieveBrassTap());
          } else if (station === 'jfold' && state.currentStep === 1 && state.jFoldCount < 3) {
            jFoldPointsRef.current.push({ x: e.clientX, y: e.clientY });
            jFoldSpeedAccumRef.current.sum += dist;
            jFoldSpeedAccumRef.current.count += 1;
            const startPt = jFoldStartClientRef.current ?? prev;
            const relX = THREE.MathUtils.clamp((e.clientX - startPt.x) * 0.00115, -0.098, 0.098);
            const relZ = THREE.MathUtils.clamp((e.clientY - startPt.y) * 0.00115, -0.098, 0.098);
            const rLen = Math.hypot(relX, relZ);
            if (rLen > 0.098) {
              const sR = 0.098 / rLen;
              jFoldLiveXZRef.current = [relX * sR, relZ * sR];
            } else {
              jFoldLiveXZRef.current = [relX, relZ];
            }
            batterWobbleVelRef.current.x += THREE.MathUtils.clamp(dx * 0.0028, -0.18, 0.18);
            batterWobbleVelRef.current.y += THREE.MathUtils.clamp(dy * 0.0028, -0.18, 0.18);
          } else if (station === 'oven_dial' && state.currentStep === 2) {
            ovenDialAccumRef.current += dx;
            const steps = Math.trunc(ovenDialAccumRef.current / 7);
            if (steps !== 0) {
              ovenDialAccumRef.current -= steps * 7;
              setOvenTemp(state.ovenSetTemp + steps);
              triggerCooledAudio('ovenDial', 55, () => patisserieAudio.playOvenDialClick());
            }
          } else if (station === 'pot' && state.currentStep === 3) {
            const { amount } = computeStationDragDelta('pot', dist);
            stirCopperPot(amount);
            setLiveCraftPhysics({ stirOmega: THREE.MathUtils.clamp(amount * 8.5, 0, 12) });
            triggerCooledAudio('pot', 240, () =>
              patisserieAudio.playCopperPotBubble(state.berryTemp >= 95 ? 1.1 : 0.78)
            );
          } else if (station === 'marble' && state.currentStep === 4) {
            const nextBlade = THREE.MathUtils.clamp(
              liveBladeDragLocalRef.current + dx * 0.011,
              -1,
              1
            );
            liveBladeDragLocalRef.current = nextBlade;
            if (state.chocPhase === 'cooling_to_27' || state.chocPhase === 'warming_to_31') {
              const { amount } = computeStationDragDelta('marble', dist);
              scrapeMarbleChocolate(amount);
              setLiveCraftPhysics({ liveBladeDrag: nextBlade, liveCurlArc: 0 });
              triggerCooledAudio('marble', 210, () => patisserieAudio.playMarbleScrape());
            } else if (
              state.chocPhase === 'curling' &&
              state.chocCurlsCount < 3 &&
              !curlStrokeShavedRef.current
            ) {
              curlDragAccumRef.current += Math.max(0, -dy) + dist * 0.35;
              const arc = THREE.MathUtils.clamp(curlDragAccumRef.current / 54, 0, 1);
              liveCurlArcLocalRef.current = arc;
              setLiveCraftPhysics({ liveBladeDrag: nextBlade, liveCurlArc: arc });
              if (arc >= 0.92) {
                curlStrokeShavedRef.current = true;
                liveCurlArcLocalRef.current = 0;
                shaveChocolateCurl(true);
                patisserieAudio.playChocCurlSnap();
              }
            }
          } else if (station === 'turntable' && state.currentStep === 5 && state.assembledStage === 0) {
            const { amount } = computeStationDragDelta('turntable', dist);
            pipeMousseSpiral(amount);
            triggerCooledAudio('pipe', 190, () => patisserieAudio.playMoussePipe());
          } else if (station === 'glaze' && state.currentStep === 6 && state.glazeCoverage < 1) {
            const rect = gl.domElement.getBoundingClientRect();
            const proj = glazeCenterScreenRef.current.set(0.58, 1.08, 0.20).project(camera);
            const cx = rect.left + (proj.x * 0.5 + 0.5) * size.width;
            const cy = rect.top + (-proj.y * 0.5 + 0.5) * size.height;
            const curAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
            const radialDist = Math.hypot(e.clientX - cx, e.clientY - cy);
            if (lastGlazeAngleRef.current !== null) {
              let angleDelta = curAngle - lastGlazeAngleRef.current;
              while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
              while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
              if (Math.abs(angleDelta) > 0.015) {
                // 对靠近投影圆心的角跳变与单帧急速划动做限幅，避免瞬间浇满
                const dampedDelta =
                  THREE.MathUtils.clamp(angleDelta, -0.32, 0.32) *
                  THREE.MathUtils.clamp(radialDist / 28, 0.35, 1.0);
                pourMirrorGlazeOrbit(dampedDelta);
                lastGlazeAngleRef.current = curAngle;
                triggerCooledAudio('glaze', 250, () => patisserieAudio.playGlazePour());
              }
            } else {
              lastGlazeAngleRef.current = curAngle;
            }
          } else if (station === 'knife' && state.currentStep === 7 && !knifeStrokeTriggeredRef.current) {
            knifeDragAccumRef.current += dist;
            if (knifeDragAccumRef.current >= 30) {
              knifeStrokeTriggeredRef.current = true;
              toggleSilverKnifeCut();
              patisserieAudio.playSilverKnifeCrispCut();
            }
          }
        }
      }
      lastDragClientRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleWinUp = (e: PointerEvent) => {
      if (!activeDragStationRef.current) return;
      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
        return;
      }
      if (activeDragStationRef.current === 'jfold') {
        const pts = jFoldPointsRef.current;
        const avgSpeed =
          jFoldSpeedAccumRef.current.count > 0
            ? jFoldSpeedAccumRef.current.sum / jFoldSpeedAccumRef.current.count
            : 12;
        const evaluation = evaluateJFoldPolyline(pts, avgSpeed);
        if (!evaluation.isTap) {
          batterWobbleVelRef.current.add(new THREE.Vector2(0.14, -0.12));
          performJFoldStroke(evaluation.accuracy, {
            shapeValid: evaluation.shapeValid,
            discrete: true,
          });
          patisserieAudio.playBatterFoldCream();
        }
      } else if (
        activeDragStationRef.current === 'marble' &&
        !curlStrokeShavedRef.current &&
        liveCurlArcLocalRef.current >= 0.62
      ) {
        const st = useGameStore.getState();
        if (st.currentStep === 4 && st.chocPhase === 'curling' && st.chocCurlsCount < 3) {
          curlStrokeShavedRef.current = true;
          shaveChocolateCurl(true);
          patisserieAudio.playChocCurlSnap();
        }
      }
      clearActiveDragState(true);
    };

    const handleCancelGlobal = () => {
      if (activeDragStationRef.current) {
        clearActiveDragState(false);
      }
    };

    window.addEventListener('pointermove', handleWinMove);
    window.addEventListener('pointerup', handleWinUp);
    window.addEventListener('pointercancel', handleWinUp);
    window.addEventListener('blur', handleCancelGlobal);
    window.addEventListener('contextmenu', handleCancelGlobal);
    return () => {
      window.removeEventListener('pointermove', handleWinMove);
      window.removeEventListener('pointerup', handleWinUp);
      window.removeEventListener('pointercancel', handleWinUp);
      window.removeEventListener('blur', handleCancelGlobal);
      window.removeEventListener('contextmenu', handleCancelGlobal);
    };
  }, [
    camera,
    size.width,
    size.height,
    gl,
    clearActiveDragState,
    shakeSieve,
    performJFoldStroke,
    setOvenTemp,
    stirCopperPot,
    scrapeMarbleChocolate,
    shaveChocolateCurl,
    pipeMousseSpiral,
    pourMirrorGlazeOrbit,
    toggleSilverKnifeCut,
    setLiveCraftPhysics,
    triggerCooledAudio,
  ]);

  const startStationDrag = useCallback(
    (
      station: InteractiveStationId,
      e: { stopPropagation: () => void; clientX: number; clientY: number; pointerId?: number; button?: number }
    ) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.stopPropagation();
      activeDragStationRef.current = station;
      activePointerIdRef.current = typeof e.pointerId === 'number' ? e.pointerId : null;
      lastDragClientRef.current = { x: e.clientX, y: e.clientY };
      jFoldPointsRef.current = station === 'jfold' ? [{ x: e.clientX, y: e.clientY }] : [];
      jFoldSpeedAccumRef.current = { sum: 0, count: 0 };
      jFoldLiveActiveRef.current = station === 'jfold';
      jFoldStartClientRef.current = station === 'jfold' ? { x: e.clientX, y: e.clientY } : null;
      if (station === 'jfold') {
        jFoldLiveXZRef.current = [0, -0.06];
      }
      ovenDialAccumRef.current = 0;
      curlDragAccumRef.current = 0;
      curlStrokeShavedRef.current = false;
      liveCurlArcLocalRef.current = 0;
      knifeStrokeTriggeredRef.current = false;
      knifeDragAccumRef.current = 0;
      if (station === 'glaze') {
        const rect = gl.domElement.getBoundingClientRect();
        const proj = glazeCenterScreenRef.current.set(0.58, 1.08, 0.20).project(camera);
        const cx = rect.left + (proj.x * 0.5 + 0.5) * size.width;
        const cy = rect.top + (-proj.y * 0.5 + 0.5) * size.height;
        lastGlazeAngleRef.current = Math.atan2(e.clientY - cy, e.clientX - cx);
        setPouringGlaze(true);
      } else {
        lastGlazeAngleRef.current = null;
      }
      setInteractingWithProp(true);
      document.body.style.cursor = 'grabbing';
    },
    [camera, gl, size.width, size.height, setInteractingWithProp, setPouringGlaze]
  );

  const setStationPointer = useCallback(
    (
      active: boolean,
      e: { stopPropagation: () => void },
      mode: 'pointer' | 'grab' = 'pointer',
      propKey: string | null = null
    ) => {
      if (!active) return;
      e.stopPropagation();
      hoveredStepRef.current = useGameStore.getState().currentStep;
      hoveredCursorModeRef.current = mode;
      setHoveredPropKey(propKey);
      if (!activeDragStationRef.current) {
        document.body.style.cursor = mode;
      }
    },
    []
  );

  const resetPointer = useCallback(() => {
    hoveredStepRef.current = null;
    hoveredCursorModeRef.current = null;
    setHoveredPropKey(null);
    if (!activeDragStationRef.current) {
      document.body.style.cursor = 'auto';
    }
  }, []);

  const spoonRestTargetVec = useMemo(() => new THREE.Vector3(0.258, 0.015, 0.06), []);
  const readyFoldTargetVec = useMemo(() => new THREE.Vector3(0.095, 0.124, 0.045), []);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();

    tickOvenBake(dt);
    tickCopperPotThermal(dt);
    tickBlastChiller(dt);
    tickGlazeThermal(dt);

    // Subtle breathing aura on active station
    focusAuraMat.uniforms.uTime.value = t;

    berrySimmerMat.uniforms.uTime.value = t;
    berrySimmerMat.uniforms.uTemp.value = berryLockedTemp ?? berryTemp;
    potSteamMat.uniforms.uTime.value = t;
    potSteamMat.uniforms.uOpacity.value = THREE.MathUtils.lerp(
      0.06,
      0.30,
      THREE.MathUtils.clamp(((berryLockedTemp ?? berryTemp) - 70) / 33, 0, 1)
    );

    // Step 1: Smooth 3-stage sieve lift (>= 0.285m clear above 0.145m copper bowl rim) -> lateral park
    if (siftProgress < 0.99) {
      sieveParkBlendRef.current = THREE.MathUtils.damp(sieveParkBlendRef.current, 0, 5.2, dt);
    } else {
      sieveParkBlendRef.current = THREE.MathUtils.damp(sieveParkBlendRef.current, 1, 3.8, dt);
    }
    const park = sieveParkBlendRef.current;

    if (sieveShakeImpulse > lastImpulseRef.current) {
      shakeTimerRef.current = SIFT_SHAKE_DURATION;
      bowlTiltVelZRef.current += (sieveShakeImpulse % 2 === 0 ? 1 : -1) * 0.42;
      bowlSquashVelRef.current -= 0.16;
    }
    lastImpulseRef.current = sieveShakeImpulse;
    const isActivelyShaking = currentStep === 1 && shakeTimerRef.current > 0 && siftProgress < 0.99;
    const targetSieveY = isActivelyShaking
      ? 0.235
      : sieveHoveredRef.current && currentStep === 1 && siftProgress < 0.99
        ? 0.168
        : 0.137;

    const parkLiftT = THREE.MathUtils.smoothstep(park, 0.00, 0.30);
    const parkLatT = THREE.MathUtils.smoothstep(park, 0.30, 0.74);
    const parkDropT = THREE.MathUtils.smoothstep(park, 0.74, 1.00);
    const parkedPosX = THREE.MathUtils.lerp(0, -0.355, parkLatT);
    const parkedPosZ = THREE.MathUtils.lerp(0, 0.125, parkLatT);
    const liftBaseY =
      THREE.MathUtils.lerp(targetSieveY, 0.285, parkLiftT) + Math.sin(parkLatT * Math.PI) * 0.032;
    const parkedPosY = THREE.MathUtils.lerp(liftBaseY, 0.025, parkDropT);

    if (shakeTimerRef.current > 0 && siftProgress < 0.99) {
      shakeTimerRef.current = Math.max(0, shakeTimerRef.current - dt);
      const lingerSpan = SIFT_SHAKE_DURATION - SIFT_ACTIVE_PORTION;
      const activeShakeRatio = Math.max(0, (shakeTimerRef.current - lingerSpan) / SIFT_ACTIVE_PORTION);
      const cloudFadeRatio = Math.min(1, shakeTimerRef.current / (lingerSpan + 0.08));

      if (sieveGroupRef.current) {
        const snapWave = Math.sin(t * 44);
        sieveGroupRef.current.position.x = THREE.MathUtils.damp(
          sieveGroupRef.current.position.x,
          snapWave * 0.032 * activeShakeRatio,
          18,
          dt
        );
        sieveGroupRef.current.position.y = THREE.MathUtils.damp(
          sieveGroupRef.current.position.y,
          targetSieveY + Math.abs(snapWave) * 0.012 * activeShakeRatio,
          14,
          dt
        );
        sieveGroupRef.current.rotation.z = THREE.MathUtils.damp(
          sieveGroupRef.current.rotation.z,
          Math.cos(t * 44) * 0.056 * activeShakeRatio,
          16,
          dt
        );
        sieveGroupRef.current.rotation.x = THREE.MathUtils.damp(
          sieveGroupRef.current.rotation.x,
          Math.sin(t * 22) * 0.025 * activeShakeRatio,
          16,
          dt
        );
      }
      if (flourSnowRef.current) {
        flourSnowRef.current.visible = shakeTimerRef.current > 0.005;
        const attr = flourSnowRef.current.geometry.attributes.position as THREE.BufferAttribute;
        const fallRate = 0.24 + 0.36 * activeShakeRatio;
        for (let i = 0; i < attr.count; i++) {
          let y = attr.getY(i) - dt * fallRate;
          let x = attr.getX(i) + Math.sin(t * 5.2 + i * 0.7) * dt * 0.028;
          let z = attr.getZ(i) + Math.cos(t * 4.6 + i * 0.9) * dt * 0.024;
          if (y < -0.155) {
            y = -0.02;
            const r = Math.sqrt(((i * 37) % 100) / 100) * 0.095;
            const a = i * 2.39996;
            x = Math.cos(a) * r;
            z = Math.sin(a) * r;
          }
          attr.setXYZ(i, x, y, z);
        }
        attr.needsUpdate = true;
      }
      if (flourSnowMatRef.current) {
        flourSnowMatRef.current.opacity = 0.88 * cloudFadeRatio;
      }
    } else {
      if (sieveGroupRef.current) {
        sieveGroupRef.current.position.x = THREE.MathUtils.damp(sieveGroupRef.current.position.x, parkedPosX, 12, dt);
        sieveGroupRef.current.position.y = THREE.MathUtils.damp(sieveGroupRef.current.position.y, parkedPosY, 12, dt);
        sieveGroupRef.current.position.z = THREE.MathUtils.damp(sieveGroupRef.current.position.z, parkedPosZ, 12, dt);
        sieveGroupRef.current.rotation.y = THREE.MathUtils.damp(sieveGroupRef.current.rotation.y, parkLatT * 1.25, 10, dt);
        sieveGroupRef.current.rotation.z = THREE.MathUtils.damp(sieveGroupRef.current.rotation.z, 0.0, 9, dt);
        sieveGroupRef.current.rotation.x = THREE.MathUtils.damp(sieveGroupRef.current.rotation.x, 0.0, 9, dt);
      }
      if (flourSnowRef.current) {
        flourSnowRef.current.visible = false;
      }
      if (flourSnowMatRef.current) {
        flourSnowMatRef.current.opacity = 0;
      }
    }

    // Step 1: Deep Batter Mixing Plunge + Live Drag Tracking + Q弹 Spring Wobble + Batter Cling
    const jFoldUniforms = meringueSssMat.userData.jFoldUniforms as
      | {
          uFoldProgress: { value: number };
          uFoldIntensity: { value: number };
          uLivePos: { value: THREE.Vector2 };
          uLiveWeight: { value: number };
          uWobbleVec: { value: THREE.Vector2 };
        }
      | undefined;
    if (jFoldAnim < lastJFoldAnimRef.current) {
      lastJFoldAnimRef.current = jFoldAnim;
      foldFurrowLevelRef.current = 0;
      if (jFoldUniforms) {
        jFoldUniforms.uFoldProgress.value = 0;
        jFoldUniforms.uFoldIntensity.value = 0;
      }
    }
    if (jFoldAnim > lastJFoldAnimRef.current) {
      jFoldTimerRef.current = 1.0;
      foldFurrowLevelRef.current = 1.0;
      bowlTiltVelZRef.current -= 0.38;
      bowlSquashVelRef.current -= 0.14;
      meringueJiggleVelRef.current += 2.65;
    }
    lastJFoldAnimRef.current = jFoldAnim;

    const canEnterBowl = siftProgress >= 0.99 && park >= 0.78;
    const isLiveFolding = canEnterBowl && jFoldLiveActiveRef.current;
    jFoldLiveWeightRef.current = THREE.MathUtils.damp(
      jFoldLiveWeightRef.current,
      isLiveFolding ? 1.0 : 0.0,
      isLiveFolding ? 14 : 6,
      dt
    );

    const shouldBeInBowl =
      canEnterBowl && !(jFoldCount >= 3 && jFoldTimerRef.current <= 0 && !isLiveFolding);
    spatulaTransitRef.current = THREE.MathUtils.damp(
      spatulaTransitRef.current,
      shouldBeInBowl ? 1 : 0,
      4.6,
      dt
    );
    const sTrans = spatulaTransitRef.current;

    if (spatulaFoldRef.current) {
      if (!shouldBeInBowl || sTrans < 0.96) {
        // True 3-stage lift -> clear-air lateral transit -> gentle vertical drop (zero copper rim clipping!)
        const sLiftT = THREE.MathUtils.smoothstep(sTrans, 0.00, 0.32);
        const sLatT = THREE.MathUtils.smoothstep(sTrans, 0.30, 0.74);
        const sDropT = THREE.MathUtils.smoothstep(sTrans, 0.72, 1.00);
        const spX = THREE.MathUtils.lerp(spoonRestTargetVec.x, readyFoldTargetVec.x, sLatT);
        const spZ = THREE.MathUtils.lerp(spoonRestTargetVec.z, readyFoldTargetVec.z, sLatT);
        const hoverY = THREE.MathUtils.lerp(spoonRestTargetVec.y, 0.275, sLiftT) + Math.sin(sLatT * Math.PI) * 0.032;
        const spY = THREE.MathUtils.lerp(hoverY, readyFoldTargetVec.y, sDropT);
        spatulaFoldRef.current.position.set(spX, spY, spZ);
        spatulaFoldRef.current.rotation.set(
          THREE.MathUtils.lerp(Math.PI * 0.5, 0.24, sLiftT),
          THREE.MathUtils.lerp(0.04, 0.35, sLiftT),
          THREE.MathUtils.lerp(-0.14, -0.36, sLiftT)
        );
      } else if (isLiveFolding) {
        const [tx, tz] = jFoldLiveXZRef.current;
        const prevSX = jFoldSmoothXZRef.current[0];
        const prevSZ = jFoldSmoothXZRef.current[1];
        const sx = THREE.MathUtils.damp(prevSX, tx, 14, dt);
        const sz = THREE.MathUtils.damp(prevSZ, tz, 14, dt);
        jFoldSmoothXZRef.current = [sx, sz];
        const vx = sx - prevSX;
        const vz = sz - prevSZ;
        // Plunge 3.5cm+ deep directly through whippedMeringueGeo dome surface (y = 0.112 -> tip 0.034m)
        spatulaFoldRef.current.position.set(
          THREE.MathUtils.damp(spatulaFoldRef.current.position.x, sx, 16, dt),
          THREE.MathUtils.damp(spatulaFoldRef.current.position.y, 0.112, 12, dt),
          THREE.MathUtils.damp(spatulaFoldRef.current.position.z, sz, 16, dt)
        );
        spatulaFoldRef.current.rotation.set(
          THREE.MathUtils.damp(spatulaFoldRef.current.rotation.x, 0.22 + THREE.MathUtils.clamp(vz * 8.0, -0.25, 0.25), 14, dt),
          THREE.MathUtils.damp(spatulaFoldRef.current.rotation.y, 0.35 + Math.atan2(vx + 1e-4, vz + 1e-4) * 0.35, 14, dt),
          THREE.MathUtils.damp(spatulaFoldRef.current.rotation.z, -0.28 + THREE.MathUtils.clamp(-vx * 8.0, -0.25, 0.25), 14, dt)
        );
      } else if (jFoldTimerRef.current > 0) {
        jFoldTimerRef.current = Math.max(0, jFoldTimerRef.current - dt * 1.40);
        const p = 1 - jFoldTimerRef.current;
        const easedP = p < 0.14 ? p * 0.45 : THREE.MathUtils.smoothstep(p, 0.10, 0.94);
        const [jx, jz] = sampleJFoldCurveXZ(easedP);
        const scoopLift = Math.sin(easedP * Math.PI) * 0.018 + (p > 0.80 ? Math.sin(((p - 0.80) / 0.20) * Math.PI) * 0.022 : 0);
        spatulaFoldRef.current.position.set(jx, 0.114 + scoopLift, jz);
        spatulaFoldRef.current.rotation.set(
          0.30 * Math.cos(easedP * Math.PI),
          easedP * 1.72,
          -0.28 + easedP * 0.62
        );
        if (jFoldUniforms) {
          jFoldUniforms.uFoldProgress.value = THREE.MathUtils.clamp(easedP * 1.04, 0.05, 1.0);
        }
      } else {
        spatulaFoldRef.current.position.set(
          THREE.MathUtils.damp(spatulaFoldRef.current.position.x, readyFoldTargetVec.x, 8, dt),
          THREE.MathUtils.damp(spatulaFoldRef.current.position.y, readyFoldTargetVec.y, 8, dt),
          THREE.MathUtils.damp(spatulaFoldRef.current.position.z, readyFoldTargetVec.z, 8, dt)
        );
        spatulaFoldRef.current.rotation.x = THREE.MathUtils.damp(spatulaFoldRef.current.rotation.x, 0.24, 8, dt);
        spatulaFoldRef.current.rotation.y = THREE.MathUtils.damp(spatulaFoldRef.current.rotation.y, 0.35, 8, dt);
        spatulaFoldRef.current.rotation.z = THREE.MathUtils.damp(spatulaFoldRef.current.rotation.z, -0.36, 8, dt);
        const residual = jFoldCount > 0 ? 0.64 : 0.0;
        foldFurrowLevelRef.current = THREE.MathUtils.damp(foldFurrowLevelRef.current, residual, 1.5, dt);
      }
    }

    // Damped Q弹 lateral flex spring on whipped batter dome
    const wobbleAx = -135 * batterWobbleVecRef.current.x - 8.5 * batterWobbleVelRef.current.x;
    const wobbleAz = -135 * batterWobbleVecRef.current.y - 8.5 * batterWobbleVelRef.current.y;
    batterWobbleVelRef.current.x += wobbleAx * dt;
    batterWobbleVelRef.current.y += wobbleAz * dt;
    batterWobbleVecRef.current.x = THREE.MathUtils.clamp(batterWobbleVecRef.current.x + batterWobbleVelRef.current.x * dt, -0.014, 0.014);
    batterWobbleVecRef.current.y = THREE.MathUtils.clamp(batterWobbleVecRef.current.y + batterWobbleVelRef.current.y * dt, -0.014, 0.014);

    if (jFoldUniforms) {
      jFoldUniforms.uFoldIntensity.value = foldFurrowLevelRef.current;
      jFoldUniforms.uLivePos.value.set(jFoldSmoothXZRef.current[0], jFoldSmoothXZRef.current[1]);
      jFoldUniforms.uLiveWeight.value = jFoldLiveWeightRef.current;
      jFoldUniforms.uWobbleVec.value.copy(batterWobbleVecRef.current);
    }
    if (batterClingMeshRef.current) {
      batterClingMeshRef.current.visible =
        siftProgress >= 0.99 && (jFoldCount > 0 || isLiveFolding || jFoldTimerRef.current > 0);
    }

    // Damped elastic meringue vertical squash-stretch bounce
    const jiggleAcc = -165 * meringueJiggleRef.current - 11.5 * meringueJiggleVelRef.current;
    meringueJiggleVelRef.current += jiggleAcc * dt;
    meringueJiggleRef.current = THREE.MathUtils.clamp(meringueJiggleRef.current + meringueJiggleVelRef.current * dt, -0.14, 0.14);
    if (meringueMeshRef.current) {
      const baseY = 1 - (jFoldCount / 3) * 0.14;
      const w = meringueJiggleRef.current;
      meringueMeshRef.current.scale.set(1 - w * 0.38, baseY * (1 + w * 0.85), 1 - w * 0.38);
    }

    // Step 3: Viscous Coulis Liquid Vortex + Submerged Wooden Spoon Follow-Through
    smoothStirAngleRef.current = THREE.MathUtils.damp(smoothStirAngleRef.current, stirAngle, 12, dt);
    const sAngle = smoothStirAngleRef.current;
    const stirDelta = sAngle - prevStirAngleRef.current;
    prevStirAngleRef.current = sAngle;
    const rawStirVel = THREE.MathUtils.clamp(stirDelta / Math.max(0.008, dt), -14, 14);
    stirVelSmoothRef.current = THREE.MathUtils.damp(stirVelSmoothRef.current, rawStirVel, 9, dt);
    berrySimmerMat.uniforms.uStirOmega.value = stirVelSmoothRef.current;
    berrySimmerMat.uniforms.uStirAngle.value = sAngle;
    if (spoonOrbitGroupRef.current) {
      spoonOrbitGroupRef.current.position.set(Math.cos(sAngle) * 0.064, 0.104, Math.sin(sAngle) * 0.064);
      spoonOrbitGroupRef.current.rotation.y = -sAngle;
    }
    if (spoonFollowRef.current) {
      spoonFollowRef.current.rotation.z = -0.36 - THREE.MathUtils.clamp(stirVelSmoothRef.current * 0.024, -0.18, 0.18);
      spoonFollowRef.current.rotation.x = Math.sin(sAngle * 2.0) * 0.065;
    }
    if (simmerSurfaceRef.current) {
      const heatNorm = THREE.MathUtils.clamp(((berryLockedTemp ?? berryTemp) - 72) / 31, 0, 1);
      const boilPulse = Math.sin(t * (5.0 + heatNorm * 9.0)) * 0.0022 * heatNorm;
      simmerSurfaceRef.current.position.y = 0.086 + boilPulse + Math.abs(stirVelSmoothRef.current) * 0.0004;
    }

    // Step 4: Smooth Viscous Unrolling Curl Ahead of Blade + Pop-Bounce on Shaved Curls
    if (activeDragStationRef.current !== 'marble' && Math.abs(liveBladeDragLocalRef.current) > 0.002) {
      liveBladeDragLocalRef.current = THREE.MathUtils.damp(liveBladeDragLocalRef.current, 0, 8, dt);
    }
    liveBladeDragSmoothRef.current = THREE.MathUtils.damp(
      liveBladeDragSmoothRef.current,
      liveBladeDragLocalRef.current,
      14,
      dt
    );
    liveCurlArcSmoothRef.current = THREE.MathUtils.damp(
      liveCurlArcSmoothRef.current,
      liveCurlArcLocalRef.current,
      14,
      dt
    );
    if (liveCurlGroupRef.current) {
      const showLive = currentStep === 4 && chocPhase === 'curling' && liveCurlArcSmoothRef.current > 0.02;
      liveCurlGroupRef.current.visible = showLive;
      if (showLive) {
        liveCurlGroupRef.current.position.set(
          -0.04 + liveBladeDragSmoothRef.current * 0.035,
          0.0415,
          0.086 - liveCurlArcSmoothRef.current * 0.145
        );
        liveCurlMatBundle.uCurlArc.value = liveCurlArcSmoothRef.current;
      }
    }

    if (chocCurlsCount < prevCurlCountRef.current) {
      chocCurlPopRef.current = [0, 0, 0];
    }
    prevCurlCountRef.current = chocCurlsCount;
    for (let ci = 0; ci < 3; ci++) {
      if (chocCurlsCount > ci) {
        chocCurlPopRef.current[ci] = Math.min(1, chocCurlPopRef.current[ci] + dt * 2.85);
        const p = chocCurlPopRef.current[ci];
        const m = chocCurlRefs.current[ci];
        if (m) {
          const overshoot = p >= 1
            ? 1.0
            : 1.0 - Math.exp(-p * 6.5) * Math.cos(p * Math.PI * 2.6);
          const s = 0.88 * Math.max(0.08, overshoot);
          const stretchY = p < 0.45 ? 1.0 + Math.sin((p / 0.45) * Math.PI) * 0.16 : 1.0;
          m.scale.set(s / Math.sqrt(stretchY), s * stretchY, s);
          m.rotation.z = (1 - Math.min(1, p * 1.4)) * -0.55;
        }
      }
    }

    // Damped-spring Step 1 copper bowl recoil
    const kBowl = 210;
    const cBowl = 19;
    const tiltAcc = -kBowl * bowlTiltZRef.current - cBowl * bowlTiltVelZRef.current;
    bowlTiltVelZRef.current += tiltAcc * dt;
    bowlTiltZRef.current = THREE.MathUtils.clamp(bowlTiltZRef.current + bowlTiltVelZRef.current * dt, -0.032, 0.032);
    const sqAcc = -240 * bowlSquashRef.current - 22 * bowlSquashVelRef.current;
    bowlSquashVelRef.current += sqAcc * dt;
    bowlSquashRef.current = THREE.MathUtils.clamp(bowlSquashRef.current + bowlSquashVelRef.current * dt, -0.018, 0.012);
    if (step1BowlSpringRef.current) {
      step1BowlSpringRef.current.position.y = Math.abs(bowlTiltZRef.current) * 0.088;
      step1BowlSpringRef.current.rotation.z = bowlTiltZRef.current;
      const sy = 1 + bowlSquashRef.current;
      const sxz = 1 - bowlSquashRef.current * 0.45;
      step1BowlSpringRef.current.scale.set(sxz, sy, sxz);
    }

    // Step 5: Viscous Revolving Turntable & Piping Bag + Pulsing Golden Bullseye Guide
    smoothTurntableAngleRef.current = THREE.MathUtils.damp(
      smoothTurntableAngleRef.current,
      turntableAngle,
      10,
      dt
    );
    if (turntableGroupRef.current) {
      turntableGroupRef.current.rotation.y = smoothTurntableAngleRef.current;
    }
    if (bullseyeGroupRef.current) {
      const pulse = 1 + Math.sin(t * 4.2) * 0.065;
      bullseyeGroupRef.current.scale.set(pulse, 1, pulse);
      bullseyeRingMat.opacity = 0.78 + Math.sin(t * 4.2) * 0.16;
    }
    if (mousseSpiralProgress === 0 && smoothSpiralRef.current > 0.5) {
      smoothSpiralRef.current = 0;
    } else {
      smoothSpiralRef.current = THREE.MathUtils.damp(smoothSpiralRef.current, mousseSpiralProgress, 11, dt);
    }
    if (pipingBagGroupRef.current && currentStep === 5 && assembledStage === 0) {
      const p = smoothSpiralRef.current;
      const a = p * Math.PI * 6.5;
      const r = p * 0.155;
      const pipeVel = Math.abs(mousseSpiralProgress - smoothSpiralRef.current);
      const squeezePulse = Math.min(0.11, pipeVel * 0.95) + (p > 0.01 ? Math.sin(t * 7.5) * 0.018 : 0);
      pipingBagGroupRef.current.position.set(
        Math.cos(a) * r,
        0.095 + p * 0.018 + Math.sin(t * 6.0) * 0.0022,
        Math.sin(a) * r
      );
      pipingBagGroupRef.current.rotation.set(0.14 + squeezePulse * 0.6, -a, 0.18 + Math.sin(t * 5.2) * 0.032);
      if (pipingBagMeshRef.current) {
        pipingBagMeshRef.current.scale.set(1 - squeezePulse * 0.75, 1 + squeezePulse * 0.55, 1 - squeezePulse * 0.75);
      }
    }

    // Step 5: Elastic Q弹 Drop-Bounce Squash & Settle for Layers 2..5
    const stiffness = 168;
    const damping = 12.2;
    for (let i = 0; i < 4; i++) {
      const g = dropGroupRefs.current[i];
      if (!g || !dropTriggeredRef.current[i]) continue;
      let offset = dropOffsetRef.current[i];
      let vel = dropVelRef.current[i];
      if (Math.abs(offset) > 0.0004 || Math.abs(vel) > 0.001) {
        const accel = -stiffness * offset - damping * vel;
        vel += accel * dt;
        offset = Math.max(-0.004, offset + vel * dt);
        dropOffsetRef.current[i] = offset;
        dropVelRef.current[i] = vel;
        g.position.y = Math.max(0, offset);
        // Stretch subtly while falling; squash softly outward on touchdown cushion!
        const impactSquash = offset <= 0.005 ? THREE.MathUtils.clamp(-vel * 0.12, -0.06, 0.11) : -Math.min(0.08, Math.abs(vel) * 0.06);
        const sy = 1 - impactSquash;
        const sxz = 1 + impactSquash * 0.52;
        g.scale.set(sxz, sy, sxz);
      } else if (offset !== 0) {
        dropOffsetRef.current[i] = 0;
        dropVelRef.current[i] = 0;
        g.position.y = 0;
        g.scale.set(1, 1, 1);
      }
    }

    // Hover Q-bounce jelly springs (applied strictly on inner visual wrappers so outer drag transforms stay untouched!)
    const hKey = hoveredPropKeyRef.current;
    const springs = jellySpringsRef.current;
    const sBowl = stepJellySpring(springs.step1Bowl, hKey === 'step1_bowl' || hKey === 'step1_spatula' ? 1.03 : 1.0, dt, 260, 14);
    const sSieve = stepJellySpring(springs.step1Sieve, hKey === 'step1_sieve' ? 1.04 : 1.0, dt, 280, 14);
    const sSpat = stepJellySpring(springs.step1Spatula, hKey === 'step1_spatula' ? 1.04 : 1.0, dt, 280, 14);
    const sPot = stepJellySpring(springs.step3Pot, hKey === 'step3_pot' ? 1.04 : 1.0, dt, 260, 14);
    const sShav = stepJellySpring(springs.step4Shavings, hKey === 'step4_curls' ? 1.04 : 1.0, dt, 280, 14);
    const sRing = stepJellySpring(springs.step5Ring, hKey === 'step5_ring' ? 1.04 : 1.0, dt, 260, 14);
    const sPipe = stepJellySpring(springs.step5Piping, hKey === 'step5_piping' ? 1.04 : 1.0, dt, 280, 14);

    if (step1BowlVisualRef.current) step1BowlVisualRef.current.scale.setScalar(sBowl);
    if (step1SieveVisualRef.current) step1SieveVisualRef.current.scale.setScalar(sSieve);
    if (step1SpatulaVisualRef.current) step1SpatulaVisualRef.current.scale.setScalar(sSpat);
    if (step3PotVisualRef.current) step3PotVisualRef.current.scale.setScalar(sPot);
    if (step4ShavingsVisualRef.current) step4ShavingsVisualRef.current.scale.setScalar(sShav);
    if (step5RingVisualRef.current) step5RingVisualRef.current.scale.setScalar(sRing);
    if (step5PipingVisualRef.current) step5PipingVisualRef.current.scale.setScalar(sPipe);
  });

  const foldedRatio = jFoldCount / 3;
  useEffect(() => {
    const meringueBase = new THREE.Color('#FFF9ED');
    const lightFlavorSponge = new THREE.Color('#D99B52').lerp(meringueBase, 0.52);
    meringueSssMat.color.copy(meringueBase).lerp(lightFlavorSponge, foldedRatio);
    meringueSssMat.roughness = 0.88 - foldedRatio * 0.08;
    meringueSssMat.clearcoat = 0;
    const sssU = meringueSssMat.userData.sssUniforms as
      | { uSssColor?: { value: THREE.Color } }
      | undefined;
    sssU?.uSssColor?.value.set(flavor.spongeSssColor).lerp(new THREE.Color('#FFE8B8'), 0.58);
  }, [flavor.spongeColor, flavor.spongeSssColor, foldedRatio, meringueSssMat]);

  useEffect(() => {
    const siftCutoff = THREE.MathUtils.lerp(0.62, 0.14, THREE.MathUtils.clamp(siftProgress, 0, 1));
    dustedFlourMat.alphaTest = THREE.MathUtils.clamp(siftCutoff + foldedRatio * 0.44, 0.14, 0.92);
  }, [siftProgress, foldedRatio, dustedFlourMat]);

  // Coplanar Y height of the Step 5 visual bullseye & flush raycast target disc across insert stages 1..4
  const step5TargetY = [0.0725, 0.088, 0.107, 0.128][Math.min(3, Math.max(0, assembledStage - 1))];
  const disableStep5MeshRaycast = assembledStage >= 1 && assembledStage < 5 && !stepFailures[5];
  const step5MeshRaycast = disableStep5MeshRaycast ? () => null : undefined;

  return (
    <>
      <group position={[0, 0.921, 0]}>
        {/* Soft Champagne Diegetic Radial Aura (whisper-subtle edge fade, zero sticker borders) */}
      {currentStep === 1 && (
        <mesh
          position={[-1.05, 0.0025, 0.08]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={focusAuraMat}
          raycast={() => null}
        >
          <planeGeometry args={[0.48, 0.48]} />
        </mesh>
      )}
      {currentStep === 3 && (
        <mesh
          position={[0.28, 0.003, -0.32]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={focusAuraMat}
          raycast={() => null}
        >
          <planeGeometry args={[0.42, 0.42]} />
        </mesh>
      )}
      {currentStep === 4 && (
        <mesh
          position={[-0.28, 0.0025, 0.22]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={focusAuraMat}
          raycast={() => null}
        >
          <planeGeometry args={[0.72, 0.58]} />
        </mesh>
      )}
      {currentStep === 5 && (
        <mesh
          position={[0.58, 0.0025, 0.20]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={focusAuraMat}
          raycast={() => null}
        >
          <planeGeometry args={[0.58, 0.58]} />
        </mesh>
      )}

      {/* ====================================================================
          STATION 1 (x = -1.05, z = 0.08): SIFTING & 'J'-STROKE MACARONNAGE
         ==================================================================== */}
      <group
        position={[-1.05, 0, 0.08]}
        onPointerOver={(e) => {
          if (currentStep === 1 && (siftProgress < 0.99 || jFoldCount < 3)) {
            sieveHoveredRef.current = true;
            setStationPointer(true, e, 'grab', siftProgress < 0.99 ? 'step1_sieve' : 'step1_spatula');
          }
        }}
        onPointerOut={() => {
          sieveHoveredRef.current = false;
          resetPointer();
        }}
        onPointerDown={(e) => {
          if (currentStep === 1 && !stepFailures[1]) {
            if (siftProgress < 0.99) {
              startStationDrag('sieve', e);
            } else if (jFoldCount < 3) {
              startStationDrag('jfold', e);
            }
          }
        }}
        onClick={(e) => {
          if (e.delta > 5) return;
          if (currentStep === 1) {
            if (stepFailures[1]) {
              retryStep(1);
            } else if (siftProgress < 0.99) {
              shakeSieve(0.14, 0.05);
              patisserieAudio.playSieveBrassTap();
            }
          }
        }}
      >
        {/* Generous invisible hitbox covering copper bowl rim, brass sieve & ceramic spoon-rest spatula */}
        {currentStep === 1 && (siftProgress < 0.99 || jFoldCount < 3) && (
          <>
            <mesh
              position={[0, 0.11, 0]}
              userData={{ excludeFromDepthAO: true }}
              material={hitboxMat}
            >
              <cylinderGeometry args={[0.22, 0.22, 0.20, 24]} />
            </mesh>
            <mesh
              position={[0.258, 0.04, 0.06]}
              userData={{ excludeFromDepthAO: true }}
              material={hitboxMat}
            >
              <boxGeometry args={[0.14, 0.09, 0.24]} />
            </mesh>
          </>
        )}

        <group ref={step1BowlSpringRef}>
          <group ref={step1BowlVisualRef}>
            <mesh
              geometry={copperBowlGeo}
              material={copperBowlMat}
              castShadow
              receiveShadow
            />
            <StylizedInkOutline
              geometry={copperBowlGeo}
              hovered={hoveredPropKey === 'step1_bowl' || (currentStep === 1 && hoveredPropKey === 'step1_spatula')}
              active={currentStep === 1 && !stepFailures[1] && (siftProgress < 0.99 || jFoldCount < 3)}
            />
          </group>

          {/* Sculpted Swiss Meringue Whipped Peaks Dome + Live GPU J-Fold Spatula Furrow Trail + Elastic Wobble */}
          <mesh
            ref={meringueMeshRef}
            position={[0, 0, 0]}
            scale={[1, 1 - foldedRatio * 0.14, 1]}
            geometry={whippedMeringueGeo}
            material={meringueSssMat}
            castShadow
            receiveShadow
          />

          {/* Finely Dusted Almond-Sugar Flour Snow Layer — drapes flush during sifting, clears immediately once J-folding reveals glossy meringue trench! */}
          {siftProgress > 0.02 && jFoldCount === 0 && (
            <mesh
              position={[0, 0, 0]}
              geometry={dustedFlourGeo}
              material={dustedFlourMat}
              receiveShadow
              raycast={() => null}
            />
          )}

          {/* Growing Solid-Skirt 3D Conical Sifted Almond-Flour Snow Mound:
              Rises monotonically from buried inside meringue (y = 0.016..0.045, peak <= 0.116m < 0.118m sieve mesh,
              ZERO negative-Y floating rim!), and folds cleanly into meringue once J-folding starts! */}
          {siftProgress > 0.06 && jFoldCount === 0 && (() => {
            const moundGrowth = THREE.MathUtils.clamp((siftProgress - 0.06) / 0.94, 0, 1);
            const rScale = 0.72 + 0.28 * moundGrowth;
            const riseY = THREE.MathUtils.lerp(0.016, 0.045, moundGrowth);
            return (
              <mesh
                position={[0, riseY, 0]}
                scale={[rScale, 1.0, rScale]}
                geometry={siftMoundGeo}
                material={siftMoundMat}
                castShadow
                receiveShadow
                raycast={() => null}
              />
            );
          })()}
        </group>

        {(currentStep === 1 || siftProgress < 0.99) && (
          <group
            ref={sieveGroupRef}
            position={[0, 0.137, 0]}
          >
            <group ref={step1SieveVisualRef}>
              {/* Thick-walled Rolled-Rim Brushed Brass Flour Sieve Drum (zero paper-thin open cylinder) */}
              <mesh geometry={sieveDrumGeo} material={brassMat} castShadow receiveShadow />
              <StylizedInkOutline
                geometry={sieveDrumGeo}
                hovered={hoveredPropKey === 'step1_sieve'}
                active={currentStep === 1 && !stepFailures[1] && siftProgress < 0.99}
              />
              {/* Opposing Beveled Forged Brass Rim Rest Ears bridging onto Copper Bowl Lip */}
              {[-1, 1].map((side) => (
                <group key={side} position={[side * 0.155, -0.014, 0]}>
                  <mesh geometry={sieveEarTabGeo} material={brassMat} castShadow />
                  <mesh
                    position={[side * 0.028, 0.004, 0]}
                    rotation={[0, Math.PI / 2, 0]}
                    geometry={sieveEarHookGeo}
                    material={brassMat}
                  />
                </group>
              ))}
              <mesh position={[0, -0.019, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.122, 40]} />
                <meshStandardMaterial
                  map={sieveMeshTex}
                  color="#EFEAE0"
                  roughness={0.62}
                  metalness={0.36}
                  envMapIntensity={0.40}
                  transparent
                  alphaTest={0.08}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
            <points ref={flourSnowRef} geometry={flourSnowGeo} raycast={() => null}>
              <pointsMaterial
                ref={flourSnowMatRef}
                map={particleSpriteTex}
                color="#FFFDF8"
                size={0.011}
                sizeAttenuation
                transparent
                alphaTest={0.01}
                opacity={0}
                depthWrite={false}
              />
            </points>
          </group>
        )}

        {/* Sculpted Cream Ceramic Spoon-Rest grounded outside Copper Bowl (zero sieve clipping!) */}
        <mesh
          position={[0.258, 0.001, 0.06]}
          geometry={spoonRestGeo}
          material={spoonRestMat}
          castShadow
          receiveShadow
          raycast={() => null}
        />

        {/* Ergonomic French Silicone Spatula with Brass Ferrule, Rosewood Handle & Clinging Batter Coating */}
        <group
          ref={spatulaFoldRef}
          position={[0.258, 0.015, 0.06]}
          rotation={[Math.PI * 0.5, 0.04, -0.14]}
        >
          <group ref={step1SpatulaVisualRef}>
            <mesh position={[0, 0.020, 0]} geometry={spatulaHandleGeo} material={rosewoodMat} castShadow />
            <StylizedInkOutline
              geometry={spatulaHandleGeo}
              position={[0, 0.020, 0]}
              hovered={hoveredPropKey === 'step1_spatula'}
              active={currentStep === 1 && !stepFailures[1] && siftProgress >= 0.99 && jFoldCount < 3}
              thicknessPx={0.68}
            />
            <mesh position={[0, 0.010, 0]} material={brassMat} castShadow>
              <cylinderGeometry args={[0.0092, 0.0086, 0.022, 24]} />
            </mesh>
            <mesh position={[0, 0, 0]} geometry={spatulaBladeGeo} material={siliconeMat} castShadow />
            <StylizedInkOutline
              geometry={spatulaBladeGeo}
              hovered={hoveredPropKey === 'step1_spatula'}
              active={currentStep === 1 && !stepFailures[1] && siftProgress >= 0.99 && jFoldCount < 3}
              thicknessPx={0.68}
            />
            <mesh
              ref={batterClingMeshRef}
              visible={false}
              geometry={batterClingGeo}
              material={meringueSssMat}
              castShadow
            />
          </group>
        </group>
        {/* 第1步铜筛与硅胶翻拌铲上方漂浮引导小图标 */}
        <FloatingPropGuideBadge
          position={siftProgress < 0.99 ? [0, 0.245, 0] : [0.06, 0.22, 0.04]}
          visible={currentStep === 1 && !stepFailures[1] && (siftProgress < 0.99 || jFoldCount < 3)}
          hovered={hoveredPropKey === 'step1_sieve' || hoveredPropKey === 'step1_spatula' || hoveredPropKey === 'step1_bowl'}
          variant="drag"
        />
      </group>

      {/* ====================================================================
          STATION 3 (x = +0.28, z = -0.32): MAUVIEL COPPER POT SIMMERING (Step 3 only!)
         ==================================================================== */}
      {currentStep === 3 && (
      <group
        position={[0.28, 0.0015, -0.32]}
        onPointerOver={(e) => setStationPointer(currentStep === 3 && !stepFailures[3] && berryLockedTemp === null, e, 'grab', 'step3_pot')}
        onPointerOut={resetPointer}
        onPointerDown={(e) => {
          if (currentStep === 3 && !stepFailures[3] && berryLockedTemp === null) {
            startStationDrag('pot', e);
          }
        }}
        onClick={(e) => {
          if (e.delta > 5) return;
          if (currentStep === 3) {
            if (stepFailures[3]) retryStep(3);
            else if (berryLockedTemp === null) {
              stirCopperPot(1.1);
              patisserieAudio.playCopperPotBubble(berryTemp >= 95 ? 1.1 : 0.78);
            }
          }
        }}
      >
        {/* Generous invisible cylinder hitbox covering pot, simmering puree & wooden spoon */}
        {currentStep === 3 && !stepFailures[3] && berryLockedTemp === null && (
          <mesh
            position={[0, 0.11, 0]}
            userData={{ excludeFromDepthAO: true }}
            material={hitboxMat}
          >
            <cylinderGeometry args={[0.20, 0.20, 0.22, 24]} />
          </mesh>
        )}
        <group ref={step3PotVisualRef}>
          <mesh geometry={mauvielPotGeo} material={copperBowlMat} castShadow receiveShadow />
          <StylizedInkOutline
            geometry={mauvielPotGeo}
            hovered={hoveredPropKey === 'step3_pot'}
            active={!stepFailures[3] && berryLockedTemp === null}
          />
          {/* Flush Dual-Riveted Beveled Forged Brass Escutcheon Handle Mount along Radial Pot Wall */}
          <group position={[0, 0.082, 0]} rotation={[0, 0.26, 0]}>
            <mesh position={[-0.139, 0, 0]} geometry={potMountPlateGeo} material={brassMat} castShadow />
            <mesh position={[-0.144, 0.004, -0.010]} material={brassMat}>
              <sphereGeometry args={[0.0038, 16, 12]} />
            </mesh>
            <mesh position={[-0.144, 0.004, 0.010]} material={brassMat}>
              <sphereGeometry args={[0.0038, 16, 12]} />
            </mesh>
            <mesh
              position={[-0.141, 0, 0]}
              rotation={[0, 0, 1.38]}
              geometry={potHandleGeo}
              material={brassMat}
              castShadow
            />
            <StylizedInkOutline
              geometry={potHandleGeo}
              position={[-0.141, 0, 0]}
              rotation={[0, 0, 1.38]}
              hovered={hoveredPropKey === 'step3_pot'}
              active={!stepFailures[3] && berryLockedTemp === null}
              thicknessPx={0.66}
            />
          </group>
          <mesh ref={simmerSurfaceRef} position={[0, 0.086, 0]} rotation={[-Math.PI / 2, 0, 0]} material={berrySimmerMat}>
            <ringGeometry args={[0.0001, 0.133, 56, 18]} />
          </mesh>
          <mesh position={[0, 0.22, 0]} material={potSteamMat} raycast={() => null}>
            <planeGeometry args={[0.26, 0.26, 8, 8]} />
          </mesh>
          {/* Sculpted Beechwood Stirring Spoon dipped deep into swirling coulis & orbiting cleanly inside rim */}
          <group
            ref={spoonOrbitGroupRef}
            position={[Math.cos(stirAngle) * 0.064, 0.104, Math.sin(stirAngle) * 0.064]}
            rotation={[0, -stirAngle, 0]}
          >
            <group ref={spoonFollowRef} rotation={[0, 0, -0.36]}>
              <mesh geometry={woodenSpoonHandleGeo} material={beechwoodMat} castShadow receiveShadow />
              <StylizedInkOutline
                geometry={woodenSpoonHandleGeo}
                hovered={hoveredPropKey === 'step3_pot'}
                active={!stepFailures[3] && berryLockedTemp === null}
                thicknessPx={0.64}
              />
              <mesh geometry={woodenSpoonBowlGeo} material={beechwoodMat} castShadow receiveShadow />
              <StylizedInkOutline
                geometry={woodenSpoonBowlGeo}
                hovered={hoveredPropKey === 'step3_pot'}
                active={!stepFailures[3] && berryLockedTemp === null}
                thicknessPx={0.64}
              />
            </group>
          </group>
        </group>
        <FloatingPropGuideBadge
          position={[0, 0.255, 0]}
          visible={!stepFailures[3] && berryLockedTemp === null}
          hovered={hoveredPropKey === 'step3_pot'}
          variant="drag"
        />
      </group>
      )}

      {/* ====================================================================
          STATION 4 HIT-ZONE & EXTRA CURLS OVER MARBLE TEMPERING SLAB
         ==================================================================== */}
      <group
        position={[-0.28, 0, 0.22]}
        onPointerOver={(e) => setStationPointer(currentStep === 4 && !stepFailures[4] && chocCurlsCount < 3, e, 'grab', 'step4_curls')}
        onPointerOut={resetPointer}
        onPointerDown={(e) => {
          if (currentStep === 4 && !stepFailures[4] && chocCurlsCount < 3) {
            startStationDrag('marble', e);
          }
        }}
        onClick={(e) => {
          if (e.delta > 5) return;
          if (currentStep === 4) {
            if (stepFailures[4]) {
              retryStep(4);
            } else if (chocPhase === 'cooling_to_27' || chocPhase === 'warming_to_31') {
              scrapeMarbleChocolate(0.8);
              patisserieAudio.playMarbleScrape();
            } else if (chocPhase === 'curling') {
              shaveChocolateCurl(true);
              patisserieAudio.playChocCurlSnap();
            }
          }
        }}
      >
        {/* Invisible interactive slab hitbox (visible=true + opacity=0 so Raycaster hits 100%, excluded from AO/DoF) */}
        {currentStep === 4 && chocCurlsCount < 3 && (
          <mesh
            position={[0, 0.07, 0]}
            userData={{ excludeFromDepthAO: true }}
            material={hitboxMat}
          >
            <boxGeometry args={[0.62, 0.14, 0.48]} />
          </mesh>
        )}
        <group ref={step4ShavingsVisualRef}>
          {[
            { pos: [-0.205, 0.0415, -0.142] as [number, number, number], rotY: -0.26 },
            { pos: [0.195, 0.0415, -0.155] as [number, number, number], rotY: 0.26 },
            { pos: [0.232, 0.0415, 0.032] as [number, number, number], rotY: -0.12 },
          ].map((curlSpec, ci) =>
            chocCurlsCount > ci ? (
              <group key={ci}>
                <mesh
                  ref={(el) => {
                    chocCurlRefs.current[ci] = el;
                  }}
                  position={curlSpec.pos}
                  rotation={[0, curlSpec.rotY, 0]}
                  scale={0.88}
                  geometry={chocCurlGeo}
                  material={chocCurlMat}
                  castShadow
                />
                <StylizedInkOutline
                  geometry={chocCurlGeo}
                  position={curlSpec.pos}
                  rotation={[0, curlSpec.rotY, 0]}
                  scale={0.88}
                  hovered={hoveredPropKey === 'step4_curls'}
                  active={currentStep === 4 && !stepFailures[4]}
                  thicknessPx={0.62}
                />
              </group>
            ) : null
          )}
        </group>
        {/* Live progressively unrolling 3D Ivory White-Chocolate Shaving ahead of the pushed scraper edge */}
        <group ref={liveCurlGroupRef} visible={false} position={[-0.04, 0.0415, 0.086]}>
          <mesh
            geometry={liveCurlGeo}
            material={liveCurlMatBundle.mat}
            castShadow
            raycast={() => null}
          />
        </group>
        <FloatingPropGuideBadge
          position={[0, 0.295, 0]}
          visible={currentStep === 4 && chocCurlsCount < 3 && !stepFailures[4]}
          hovered={hoveredPropKey === 'step4_curls'}
          variant="drag"
        />
      </group>

      {/* ====================================================================
          STATION 5: UPSIDE-DOWN ENTREMET RING ASSEMBLY ATOP BRASS TURNTABLE
         ==================================================================== */}
      {currentStep === 5 && (
        <group
          ref={turntableGroupRef}
          position={[0.58, 0.0925, 0.20]}
          onPointerOver={(e) => {
            if (assembledStage === 0 || stepFailures[5]) {
              setStationPointer(!stepFailures[5] && assembledStage < 5, e, 'grab', assembledStage === 0 ? 'step5_piping' : 'step5_ring');
            }
          }}
          onPointerOut={() => {
            if (assembledStage === 0 || stepFailures[5]) {
              resetPointer();
            }
          }}
          onPointerDown={(e) => {
            if (currentStep === 5 && !stepFailures[5] && assembledStage === 0) {
              startStationDrag('turntable', e);
            }
          }}
          onClick={(e) => {
            if (e.delta > 5) return;
            if (currentStep === 5) {
              if (stepFailures[5]) {
                retryStep(5);
              } else if (assembledStage === 0) {
                pipeMousseSpiral(0.16);
                patisserieAudio.playMoussePipe();
              }
            }
          }}
        >
          {/* Solid Thick-Walled Rolled-Lip Stainless Patisserie Ring + Flush Parchment Base (zero bottom void!) */}
          <group ref={step5RingVisualRef}>
            <mesh
              position={[0, 0, 0]}
              geometry={mousseRingGeo}
              material={stainlessMat}
              castShadow
              receiveShadow
              raycast={step5MeshRaycast}
            />
            <StylizedInkOutline
              geometry={mousseRingGeo}
              hovered={hoveredPropKey === 'step5_ring'}
              active={assembledStage >= 1 && assembledStage < 5 && !stepFailures[5]}
              thicknessPx={0.70}
            />
          </group>
          <mesh position={[0, 0.0014, 0]} material={parchmentMat} receiveShadow raycast={step5MeshRaycast}>
            <cylinderGeometry args={[0.1805, 0.1805, 0.0024, 64]} />
          </mesh>
          <mesh position={[0.184, 0.0014, 0]} material={parchmentMat} receiveShadow raycast={step5MeshRaycast}>
            <boxGeometry args={[0.022, 0.0022, 0.030]} />
          </mesh>
          {/* Unmistakable Pulsing Golden Bullseye Guide + Flush Coplanar Raycast Target Disc for Stages 1..4 */}
          {assembledStage >= 1 && assembledStage < 5 && !stepFailures[5] && (
            <>
              <group ref={bullseyeGroupRef} position={[0, step5TargetY, 0]}>
                <mesh rotation={[-Math.PI / 2, 0, 0]} material={bullseyeRingMat} raycast={() => null}>
                  <ringGeometry args={[0.056, 0.062, 48]} />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]} material={bullseyeRingMat} raycast={() => null}>
                  <ringGeometry args={[0.022, 0.026, 36]} />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]} material={bullseyeRingMat} raycast={() => null}>
                  <circleGeometry args={[0.0085, 24]} />
                </mesh>
                {[0, Math.PI * 0.5, Math.PI, Math.PI * 1.5].map((rotY, ri) => (
                  <mesh
                    key={ri}
                    position={[Math.cos(rotY) * 0.041, 0, Math.sin(rotY) * 0.041]}
                    rotation={[-Math.PI / 2, 0, -rotY]}
                    material={bullseyeRingMat}
                    raycast={() => null}
                  >
                    <planeGeometry args={[0.018, 0.0032]} />
                  </mesh>
                ))}
              </group>
              <mesh
                ref={coaxialReticleRef}
                visible={false}
                rotation={[-Math.PI / 2, 0, 0]}
                raycast={() => null}
              >
                <ringGeometry args={[0.017, 0.025, 32]} />
                <meshBasicMaterial color="#FFF0A8" transparent opacity={0.92} side={THREE.DoubleSide} />
              </mesh>
              <mesh
                position={[0, step5TargetY, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                userData={{ excludeFromDepthAO: true }}
                onPointerOver={(e) => setStationPointer(true, e, 'pointer', 'step5_ring')}
                onPointerOut={() => {
                  if (coaxialReticleRef.current) coaxialReticleRef.current.visible = false;
                  resetPointer();
                }}
                onPointerMove={(e) => {
                  if (coaxialReticleRef.current) {
                    const dx = e.point.x - 0.58;
                    const dz = e.point.z - 0.20;
                    const activeAng = smoothTurntableAngleRef.current;
                    const invCos = Math.cos(-activeAng);
                    const invSin = Math.sin(-activeAng);
                    const lx = dx * invCos - dz * invSin;
                    const lz = dx * invSin + dz * invCos;
                    const [mx, mz] = computeMagneticReticleXZ(lx, lz, 0.181);
                    coaxialReticleRef.current.visible = true;
                    coaxialReticleRef.current.position.set(mx, step5TargetY + 0.0015, mz);
                  }
                }}
                onClick={(e) => {
                  if (e.delta > 5) return;
                  e.stopPropagation();
                  const precision = computeCoaxialInsertPrecision(e.point.x - 0.58, e.point.z - 0.20, 0.181);
                  placeNextAssemblyInsert(precision);
                }}
              >
                <circleGeometry args={[0.22, 36]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
              </mesh>
            </>
          )}
          {/* Tall turntable/piping hitbox strictly confined to Stage 0 piping so insert clicks NEVER intercept high */}
          {assembledStage === 0 && (
            <mesh
              position={[0, 0.12, 0]}
              userData={{ excludeFromDepthAO: true }}
              material={hitboxMat}
            >
              <cylinderGeometry args={[0.28, 0.28, 0.42, 28]} />
            </mesh>
          )}

          {/* Animated 3D Pastry Piping Bag & Stainless Star Nozzle along spiral tip */}
          {currentStep === 5 && assembledStage === 0 && (
            <group ref={pipingBagGroupRef} position={[0, 0.11, 0]}>
              <group ref={step5PipingVisualRef}>
                {/* Stainless fluted 6-point star nozzle (sharp toothed mouth unobscured at tip) */}
                <mesh position={[0, -0.028, 0]} geometry={nozzleConeGeo} material={stainlessMat} castShadow />
                <StylizedInkOutline
                  geometry={nozzleConeGeo}
                  position={[0, -0.028, 0]}
                  hovered={hoveredPropKey === 'step5_piping'}
                  active={!stepFailures[5]}
                  thicknessPx={0.62}
                />
                <mesh position={[0, -0.010, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={nozzleRimGeo} material={stainlessMat} />
                {/* Piping bag collar coupler */}
                <mesh position={[0, -0.004, 0]}>
                  <cylinderGeometry args={[0.017, 0.016, 0.014, 24]} />
                  <meshPhysicalMaterial color="#F7F4EC" roughness={0.52} envMapIntensity={0.32} />
                </mesh>
                {/* Sculpted pleated French linen pastry bag with Disney squeeze pulse */}
                <mesh ref={pipingBagMeshRef} position={[0, 0.098, 0]} geometry={pipingBagGeo} material={pipingBagMat} castShadow />
                <StylizedInkOutline
                  geometry={pipingBagGeo}
                  position={[0, 0.098, 0]}
                  hovered={hoveredPropKey === 'step5_piping'}
                  active={!stepFailures[5]}
                  thicknessPx={0.68}
                />
                {/* Visible flavored Chantilly cream inside top cuff */}
                <mesh position={[0, 0.194, 0]} material={mousseSssMat}>
                  <sphereGeometry args={[0.019, 16, 12]} />
                </mesh>
                {/* Extruded star-fluted mousse bead issuing seamlessly from nozzle mouth */}
                {mousseSpiralProgress > 0.005 && (
                  <mesh position={[0, -0.053, 0]} material={mousseSssMat}>
                    <cylinderGeometry args={[0.0062, 0.0115, 0.018, 16]} />
                  </mesh>
                )}
              </group>
            </group>
          )}
          <FloatingPropGuideBadge
            position={[0, assembledStage === 0 ? 0.36 : step5TargetY + 0.14, 0]}
            visible={!stepFailures[5] && assembledStage < 5}
            hovered={hoveredPropKey === 'step5_piping' || hoveredPropKey === 'step5_ring'}
            variant={assembledStage === 0 ? 'drag' : 'tap'}
          />

          {mousseSpiralProgress > 0.01 && <mesh geometry={spiralGeo} material={mousseSssMat} raycast={step5MeshRaycast} />}
          {assembledStage >= 1 && (
            <>
              <mesh position={[0, 0.036, 0]} material={mousseSssMat} receiveShadow raycast={step5MeshRaycast}>
                <cylinderGeometry args={[0.181, 0.181, 0.068, 56]} />
              </mesh>
              <mesh position={[0, 0.006, 0]} geometry={mousseCollarGeo} material={mousseSssMat} receiveShadow raycast={step5MeshRaycast} />
            </>
          )}
          {assembledStage >= 2 && (
            <group
              ref={(el) => {
                dropGroupRefs.current[0] = el;
              }}
            >
              <mesh position={[0, ASSEMBLY_LAYER_REST_Y[0], 0]} geometry={jellyInsertGeo} castShadow receiveShadow raycast={step5MeshRaycast}>
                <meshPhysicalMaterial
                  color={flavor.jellyColor}
                  map={cakeTextures.jellyPulpMap}
                  normalMap={cakeTextures.jellyNormalMap}
                  normalScale={JELLY_NORMAL_SCALE}
                  transparent
                  opacity={0.92}
                  roughness={0.28}
                  clearcoat={0}
                  envMapIntensity={0.40}
                />
              </mesh>
            </group>
          )}
          {assembledStage >= 3 && (
            <group
              ref={(el) => {
                dropGroupRefs.current[1] = el;
              }}
            >
              <mesh position={[0, ASSEMBLY_LAYER_REST_Y[1], 0]} geometry={caramelInsertGeo} material={caramelMat} castShadow receiveShadow raycast={step5MeshRaycast} />
            </group>
          )}
          {assembledStage >= 4 && (
            <group
              ref={(el) => {
                dropGroupRefs.current[2] = el;
              }}
            >
              <mesh position={[0, ASSEMBLY_LAYER_REST_Y[2], 0]} geometry={spongeInsertGeo} castShadow receiveShadow raycast={step5MeshRaycast}>
                <meshPhysicalMaterial
                  color="#D99B52"
                  map={cakeTextures.spongeColorMap}
                  normalMap={cakeTextures.spongeNormalMap}
                  normalScale={SPONGE_NORMAL_SCALE}
                  roughnessMap={cakeTextures.spongeRoughnessMap}
                  roughness={0.92}
                  sheen={0.24}
                  sheenColor={flavor.spongeSssColor}
                  envMapIntensity={0.28}
                />
              </mesh>
            </group>
          )}
          {assembledStage >= 5 && (
            <group
              ref={(el) => {
                dropGroupRefs.current[3] = el;
              }}
            >
              <mesh position={[0, ASSEMBLY_LAYER_REST_Y[3], 0]} geometry={crunchInsertGeo} castShadow receiveShadow>
                <meshPhysicalMaterial
                  color={flavor.crunchColor}
                  map={cakeTextures.crunchColorMap}
                  normalMap={cakeTextures.crunchNormalMap}
                  normalScale={CRUNCH_NORMAL_SCALE}
                  roughnessMap={cakeTextures.crunchRoughnessMap}
                  roughness={0.86}
                  envMapIntensity={0.26}
                />
              </mesh>
            </group>
          )}
        </group>
      )}
      <CelebrationStarBurst pulse={celebrationPulse} step={currentStep} />
    </group>

      {/* ====================================================================
          WORLD-SPACE 3D TRIGGERS: STEP 2 OVEN, STEP 3 CHILLER, STEP 6 GLAZE, STEP 7 GARNISH & KNIFE
         ==================================================================== */}
      {currentStep === 2 && (
        <group>
          {/* Oven Brass Dial Bar (horizontal drag or click left/right to set oven temperature) */}
          <mesh
            position={[-1.03, 1.66, -2.63]}
            userData={{ excludeFromDepthAO: true }}
            material={hitboxMat}
            onPointerOver={(e) => setStationPointer(true, e, 'grab', 'step2_dial')}
            onPointerOut={resetPointer}
            onPointerDown={(e) => {
              if (!stepFailures[2]) startStationDrag('oven_dial', e);
            }}
            onClick={(e) => {
              if (e.delta > 5) return;
              e.stopPropagation();
              if (stepFailures[2]) {
                retryStep(2);
                return;
              }
              const cur = useGameStore.getState().ovenSetTemp;
              const delta = e.point.x < -1.16 ? -3 : e.point.x > -0.90 ? 3 : 1;
              setOvenTemp(cur + delta);
              patisserieAudio.playOvenDialClick();
            }}
          >
            <boxGeometry args={[0.88, 0.16, 0.16]} />
          </mesh>
          <FloatingPropGuideBadge
            position={[-0.92, 1.57, -2.53]}
            visible={!stepFailures[2] && !isBaking && bakeProgress < 0.12 && !stepCompleted[2]}
            hovered={hoveredPropKey === 'step2_dial'}
            variant="dial"
          />

          {/* Oven Viewing Door & Handle (click to start baking or pull sponge out at peak) */}
          <mesh
            position={[-1.15, 1.26, -2.64]}
            userData={{ excludeFromDepthAO: true }}
            material={hitboxMat}
            onPointerOver={(e) => setStationPointer(true, e, 'pointer', 'step2_door')}
            onPointerOut={resetPointer}
            onClick={(e) => {
              if (e.delta > 5) return;
              e.stopPropagation();
              const s = useGameStore.getState();
              if (s.stepFailures[2]) {
                retryStep(2);
              } else if (s.isBaking) {
                pullFromOven();
                patisserieAudio.playOvenDoorLatch();
              } else if (s.bakeProgress < 0.12 || s.stepCompleted[2]) {
                startOvenBake();
                patisserieAudio.playOvenDoorLatch();
              } else {
                pullFromOven();
                patisserieAudio.playOvenDoorLatch();
              }
            }}
          >
            <boxGeometry args={[1.26, 0.50, 0.18]} />
          </mesh>
          <FloatingPropGuideBadge
            position={[-1.15, 1.52, -2.54]}
            visible={!stepFailures[2] && (isBaking || bakeProgress >= 0.12) && !stepCompleted[2]}
            hovered={hoveredPropKey === 'step2_door'}
            variant="tap"
          />
        </group>
      )}

      {/* Step 3 -25°C Mint Chiller Door Trigger */}
      {currentStep === 3 && berryLockedTemp === null && !stepFailures[3] && (
        <group>
          <mesh
            position={[1.58, 1.14, -2.72]}
            userData={{ excludeFromDepthAO: true }}
            material={hitboxMat}
            onPointerOver={(e) => setStationPointer(true, e, 'pointer', 'step3_chiller')}
            onPointerOut={resetPointer}
            onClick={(e) => {
              if (e.delta > 5) return;
              e.stopPropagation();
              pourAtCurrentTemp();
            }}
          >
            <boxGeometry args={[0.96, 1.12, 0.22]} />
          </mesh>
          <FloatingPropGuideBadge
            position={[1.58, 1.72, -2.62]}
            visible={berryTemp >= 76}
            hovered={hoveredPropKey === 'step3_chiller'}
            variant="tap"
          />
        </group>
      )}

      {/* Step 6 Velvety Chantilly Cream Pour Circular Hitbox */}
      {currentStep === 6 && glazeCoverage < 1 && !stepFailures[6] && (
        <group>
          <mesh
            position={[0.58, 1.12, 0.20]}
            userData={{ excludeFromDepthAO: true }}
            material={hitboxMat}
            onPointerOver={(e) => setStationPointer(true, e, 'grab', 'step6_glaze')}
            onPointerOut={resetPointer}
            onPointerDown={(e) => startStationDrag('glaze', e)}
            onClick={(e) => {
              if (e.delta > 5) return;
              e.stopPropagation();
              pourMirrorGlazeOrbit(0.24);
              setPouringGlaze(false);
              patisserieAudio.playGlazePour();
            }}
          >
            <cylinderGeometry args={[0.34, 0.34, 0.36, 28]} />
          </mesh>
          <FloatingPropGuideBadge
            position={[0.58, 1.40, 0.20]}
            visible
            hovered={hoveredPropKey === 'step6_glaze'}
            variant="drag"
          />
        </group>
      )}

      {/* Step 7 Direct Cake Crown Garnish Placement + Olive-Wood/Steel Knife Quarter Slice */}
      {currentStep === 7 && (
        <group>
          {garnishStep < 4 && !stepFailures[7] && (
            <>
              <mesh
                position={[3.55, 1.04, 0.65]}
                userData={{ excludeFromDepthAO: true }}
                material={hitboxMat}
                onPointerOver={(e) => setStationPointer(true, e, 'pointer', 'step7_cake')}
                onPointerOut={resetPointer}
                onClick={(e) => {
                  if (e.delta > 5) return;
                  e.stopPropagation();
                  const precision = computeGarnishPlacementPrecision(
                    e.point.x - 3.55,
                    e.point.z - 0.65,
                    garnishStep
                  );
                  placeNextGarnishWithTweezers(precision);
                  patisserieAudio.playTweezerClick();
                }}
              >
                <cylinderGeometry args={[0.26, 0.26, 0.24, 24]} />
              </mesh>
              <FloatingPropGuideBadge
                position={[3.55, 1.31, 0.65]}
                visible
                hovered={hoveredPropKey === 'step7_cake'}
                variant="tap"
              />
            </>
          )}
          <mesh
            position={[3.674, 0.855, 1.199]}
            rotation={[0, -0.42, 0]}
            userData={{ excludeFromDepthAO: true }}
            material={hitboxMat}
            onPointerOver={(e) => setStationPointer(true, e, 'grab', 'step7_knife')}
            onPointerOut={resetPointer}
            onPointerDown={(e) => startStationDrag('knife', e)}
            onClick={(e) => {
              if (e.delta > 5) return;
              e.stopPropagation();
              toggleSilverKnifeCut();
              patisserieAudio.playSilverKnifeCrispCut();
            }}
          >
            <boxGeometry args={[0.36, 0.10, 0.14]} />
          </mesh>
          <FloatingPropGuideBadge
            position={[3.674, 1.02, 1.199]}
            visible={garnishStep >= 4 && !stepFailures[7]}
            hovered={hoveredPropKey === 'step7_knife'}
            variant="knife"
          />
        </group>
      )}
    </>
  );
};
