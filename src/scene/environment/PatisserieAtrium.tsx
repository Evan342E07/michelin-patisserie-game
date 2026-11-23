import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import {
  applyTextureAnisotropy,
  ensureSecondaryUv,
  getAtelierTextures,
  getMarblePbrSet,
  getParquetPbrSet,
  getPlasterPbrSet,
} from '../../textures/atelierTextures';
import { createGodRayShaderMaterial } from '../../shaders/atelierShaders';
import {
  enhanceWithExtremeMicroCraft,
  enhanceWithGpuClothBreeze,
} from '../../shaders/extremeThreeJsUpgrades';
import {
  createBeveledBoxGeometry,
  createCitrusLeafGeometry,
  createSeamlessLatheGeometry,
  createTerracottaPlanterGeometry,
} from '../../geometry/patisserieGeometry';
import { useGameStore } from '../../store/useGameStore';
import { PatisserieEquipment } from '../props/PatisserieEquipment';
import {
  createBillowingSheerCurtainMaterial,
  createChamomileDaisyHeadGeometry,
  createDelphiniumSpikeGeometry,
  createLayeredLeafClusterGeometry,
  createSculptedRoseBlossomGeometry,
  createSwordFernFrondGeometry,
  getCottageCraftAssets,
} from './cottageTexturesAndFlora';
import {
  createGhibliMeadowTerrainMaterial,
  sampleGhibliTerrainHeight,
} from '../../shaders/ghibliStylizedPipeline';
import {
  createHollowVesselLatheGeo,
  createMicroSurfaceMaps,
  createPleatedClothCurtainGeo,
  createWoodGrainPbr,
} from '../props/cottageHighCraftPbr';

interface OptionalMechanicsSlice {
  mechanics?: {
    ovenActive?: boolean;
    chillerDoorOpen?: boolean;
    burnerActive?: boolean;
  };
}

const MARBLE_NORMAL_SCALE = new THREE.Vector2(0.85, 0.85);
const OAK_NORMAL_SCALE = new THREE.Vector2(0.75, 0.75);
const PLASTER_NORMAL_SCALE = new THREE.Vector2(0.24, 0.24);
const BEADBOARD_NORMAL_SCALE = new THREE.Vector2(0.45, 0.45);
const PINE_ROOF_NORMAL_SCALE = new THREE.Vector2(0.42, 0.42);
const FLAGSTONE_NORMAL_SCALE = new THREE.Vector2(0.65, 0.65);
const RUBBLE_NORMAL_SCALE = new THREE.Vector2(0.10, 0.10);
const ISLAND_SHADOW_SCALE: [number, number] = [3.12, 1.28];

/**
 * Warm Provence Golden-Hour & Soft Meadow-Bounce Equirectangular Environment (512x256 Float)
 * Smooth, creamy light dome with lifted warm ground/wood bounce and wide diffused solar glow
 * so interiors have luminous soft fill and ZERO harsh glare or black underside spots!
 */
function createPastoralGardenHdrEnvironment(): THREE.DataTexture {
  const w = 512;
  const h = 256;
  const data = new Float32Array(w * h * 4);

  for (let y = 0; y < h; y++) {
    const v = y / (h - 1); // 0 = ground, 1 = zenith
    const phi = (v - 0.5) * Math.PI;
    const cosPhi = Math.cos(phi);
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      const theta = u * Math.PI * 2;
      // Align soft sun corona azimuth with directional key light [8.8, 5.2, 3.4]
      const du = Math.min(Math.abs(u - 0.560), 1.0 - Math.abs(u - 0.560)) * Math.max(0.35, cosPhi);
      const sunDist = Math.hypot(du * 2.15, v - 0.642);

      let r = 0.62;
      let g = 0.52;
      let b = 0.36;

      if (v >= 0.48) {
        const skyT = (v - 0.48) / 0.52;
        // Creamy golden horizon (#FCE7BD) -> soft pastel azure zenith (#7DB8E2)
        r = THREE.MathUtils.lerp(1.52, 0.92, Math.pow(skyT, 0.78));
        g = THREE.MathUtils.lerp(1.38, 1.16, Math.pow(skyT, 0.85));
        b = THREE.MathUtils.lerp(1.06, 1.38, Math.pow(skyT, 0.92));

        // Soft drifting sunlit cumulus cloud lobes in upper hemisphere
        const cloudWave =
          0.5 +
          0.26 * Math.sin(theta * 3.0 + v * 9.0) * Math.cos(theta * 5.0 - v * 6.0) +
          0.20 * Math.sin(theta * 7.0 + v * 14.0);
        const cloudBand = Math.exp(-Math.pow((v - 0.72) / 0.16, 2)) * Math.max(0, cloudWave - 0.46);
        r += cloudBand * 0.56;
        g += cloudBand * 0.52;
        b += cloudBand * 0.44;

        // Sunlit sage spring canopy bounce near horizon
        const canopyNoise =
          0.52 +
          0.24 * Math.sin(theta * 8.0 + 0.6) +
          0.18 * Math.cos(theta * 17.0 - v * 12.0);
        const canopyMask = Math.exp(-Math.pow((v - 0.535) / 0.095, 2)) * THREE.MathUtils.clamp(canopyNoise, 0, 1);
        r = THREE.MathUtils.lerp(r, 0.72, canopyMask * 0.40);
        g = THREE.MathUtils.lerp(g, 1.02, canopyMask * 0.40);
        b = THREE.MathUtils.lerp(b, 0.54, canopyMask * 0.40);

        // Warm honey-timber interior ceiling bounce
        const indoorCeilingMask =
          Math.exp(-Math.pow((v - 0.84) / 0.16, 2)) *
          Math.max(0, Math.cos(theta - Math.PI * 1.15));
        r = THREE.MathUtils.lerp(r, 1.32, indoorCeilingMask * 0.42);
        g = THREE.MathUtils.lerp(g, 1.08, indoorCeilingMask * 0.42);
        b = THREE.MathUtils.lerp(b, 0.74, indoorCeilingMask * 0.42);
      } else {
        // Lifted warm honey-oak floor & sunny meadow bounce so undersides never go dark!
        const gndT = v / 0.48;
        const woodVar = 0.96 + 0.04 * Math.sin(theta * 10.0);
        r = THREE.MathUtils.lerp(0.58, 0.96, gndT) * woodVar;
        g = THREE.MathUtils.lerp(0.48, 0.84, gndT) * woodVar;
        b = THREE.MathUtils.lerp(0.32, 0.58, gndT) * woodVar;
      }

      // Wide, velvety warm golden-hour solar corona (zero blinding HDR point hotspot)
      if (sunDist < 0.36) {
        const corona = Math.pow(1.0 - sunDist / 0.36, 1.85);
        r += 1.55 * corona;
        g += 1.24 * corona;
        b += 0.76 * corona;
      }
      if (sunDist < 0.095) {
        const core = Math.pow(1.0 - sunDist / 0.095, 1.6);
        r += 1.85 * core;
        g += 1.48 * core;
        b += 0.92 * core;
      }

      const idx = (y * w + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 1.0;
    }
  }

  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 360° Pure Studio-Ghibli Provence Golden-Hour Sky Dome Material
 * Clear sky-blue top (#7DB8E2) -> soft airy cyan (#CBE6EF) -> warm sunlit horizon (#FFEAAB/#FCE7BD)
 * with creamy golden-edged cumulus clouds and misty far rolling hills.
 */
function createPastoralSkyDomeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorldDir;

      float skyHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float skyNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(skyHash(i), skyHash(i + vec2(1.0, 0.0)), u.x),
          mix(skyHash(i + vec2(0.0, 1.0)), skyHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float cloudFbm(vec2 p) {
        float v = 0.0;
        float a = 0.52;
        for (int i = 0; i < 4; i++) {
          v += a * skyNoise(p);
          p = p * 2.04 + vec2(7.3, 3.1);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y, 0.0, 1.0);
        float phi = atan(dir.z, dir.x);

        // Studio Ghibli Provence sky gradient (#FFEAAB/#FCE7BD -> #CBE6EF -> #7DB8E2 in linear space)
        vec3 horizonGold = vec3(1.02, 0.84, 0.46);
        vec3 midCyan     = vec3(0.60, 0.79, 0.88);
        vec3 zenithAzure = vec3(0.23, 0.50, 0.78);
        vec3 col = mix(horizonGold, midCyan, smoothstep(0.0, 0.22, h));
        col = mix(col, zenithAzure, smoothstep(0.20, 0.74, h));

        // Soft drifting Ghibli cumulus clouds with warm cream crests & gentle pastel lavender-gray undersides
        if (dir.y > 0.006) {
          vec2 cloudUv = dir.xz / (dir.y + 0.30) * 1.25 + vec2(uTime * 0.006, uTime * 0.002);
          float c = cloudFbm(cloudUv);
          float cMask = smoothstep(0.47, 0.74, c) * smoothstep(0.006, 0.11, dir.y) * (1.0 - smoothstep(0.56, 0.92, dir.y));
          float lit = smoothstep(0.38, 0.76, cloudFbm(cloudUv + vec2(0.16, 0.08)));
          vec3 cloudShadow = vec3(0.66, 0.72, 0.80);
          vec3 cloudBright = vec3(1.04, 0.96, 0.82);
          vec3 cloudCol = mix(cloudShadow, cloudBright, lit);
          col = mix(col, cloudCol, cMask * 0.74);
        }

        // Layered hazy Provence countryside hill silhouettes along the far horizon (zero HDR dark bands)
        float farRidge = 0.068 + 0.028 * sin(phi * 3.0 + 0.4) + 0.016 * cos(phi * 7.0 - 0.8);
        float nearRidge = 0.036 + 0.020 * sin(phi * 5.0 + 1.5) + 0.012 * cos(phi * 11.0 + 0.2);
        float farMask = 1.0 - smoothstep(farRidge - 0.014, farRidge + 0.014, dir.y);
        float nearMask = 1.0 - smoothstep(nearRidge - 0.012, nearRidge + 0.012, dir.y);
        vec3 farHillCol = mix(vec3(0.54, 0.68, 0.66), horizonGold, 0.34);
        vec3 nearHillCol = mix(vec3(0.46, 0.64, 0.42), vec3(0.90, 0.82, 0.56), 0.26);
        col = mix(col, farHillCol, farMask * 0.76);
        col = mix(col, nearHillCol, nearMask * 0.85);

        // Warm diffused Provence afternoon sun halo
        vec3 sunDir = normalize(vec3(8.8, 5.2, 3.4));
        float sunGlow = pow(max(0.0, dot(dir, sunDir)), 7.0);
        col += vec3(0.52, 0.34, 0.14) * sunGlow;

        gl_FragColor = vec4(clamp(col, 0.0, 6.0), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * Animated GLSL Sparkling Creek Water Shader Material
 * Clear Ghibli sunlit brook with Voronoi caustics, gentle ripples, and golden-hour sky reflection
 */
function createCreekWaterShaderMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec3 p = position;
        float edgeFade = sin(uv.x * 3.14159265);
        p.y += sin(uv.y * 26.0 - uTime * 2.4 + uv.x * 5.0) * 0.014 * edgeFade;
        p.y += cos(uv.y * 17.0 - uTime * 1.7 - uv.x * 7.5) * 0.007 * edgeFade;
        vec4 worldPos = modelMatrix * vec4(p, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;

      vec2 hash22(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.xx + p3.yz) * p3.zy);
      }

      float waveHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float waveNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(waveHash(i), waveHash(i + vec2(1.0, 0.0)), u.x),
          mix(waveHash(i + vec2(0.0, 1.0)), waveHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float voronoiCausticWeb(vec2 x, float t) {
        vec2 n = floor(x);
        vec2 f = fract(x);
        float f1 = 8.0;
        float f2 = 8.0;
        for (int j = -1; j <= 1; j++) {
          for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash22(n + g);
            o = 0.5 + 0.44 * sin(t * 1.25 + 6.2831 * o);
            vec2 r = g + o - f;
            float d = length(r);
            if (d < f1) {
              f2 = f1;
              f1 = d;
            } else if (d < f2) {
              f2 = d;
            }
          }
        }
        float edgeDist = f2 - f1;
        return pow(1.0 - smoothstep(0.0, 0.22, edgeDist), 2.3);
      }

      float waterHeight(vec2 wp, float t) {
        vec2 flow = vec2(wp.x * 1.85, wp.y * 1.85 - t * 0.72);
        float h1 = waveNoise(flow * 1.45);
        float h2 = waveNoise(vec2(wp.x * 3.1 - t * 0.22, wp.y * 3.1 - t * 1.05));
        float h3 = waveNoise(vec2(wp.x * 5.6 + t * 0.18, wp.y * 5.6 - t * 1.42));
        return h1 * 0.52 + h2 * 0.32 + h3 * 0.16;
      }

      void main() {
        float bankDist = sin(vUv.x * 3.14159265);
        vec2 wp = vWorldPos.xz;
        float eps = 0.045;
        float hC = waterHeight(wp, uTime);
        float hX = waterHeight(wp + vec2(eps, 0.0), uTime);
        float hZ = waterHeight(wp + vec2(0.0, eps), uTime);

        vec3 N = normalize(vec3((hC - hX) * 4.0, 1.0, (hC - hZ) * 4.0));
        vec3 V = normalize(cameraPosition - vWorldPos);
        float ndv = max(dot(N, V), 0.0);
        float fresnel = 0.03 + 0.97 * pow(1.0 - ndv, 4.0);

        vec2 refractWp = wp + N.xz * 0.14;
        float pebbles = waveNoise(refractWp * 5.5);
        float pebbleSpeck = waveNoise(refractWp * 13.0);
        vec3 shallowPebble = mix(vec3(0.32, 0.28, 0.20), vec3(0.56, 0.50, 0.36), pebbles * 0.68 + pebbleSpeck * 0.32);
        vec3 midAqua       = vec3(0.11, 0.39, 0.42);
        vec3 deepEmerald   = vec3(0.07, 0.26, 0.32);

        vec3 bodyCol = mix(shallowPebble, midAqua, smoothstep(0.04, 0.42, bankDist));
        bodyCol = mix(bodyCol, deepEmerald, smoothstep(0.42, 0.92, bankDist));

        float cA = voronoiCausticWeb(refractWp * 1.65 - vec2(0.0, uTime * 0.22), uTime);
        float cB = voronoiCausticWeb(refractWp * 2.55 + vec2(0.4, -uTime * 0.34), uTime * 1.15);
        float causticWeb = (cA * 0.60 + cB * 0.40) * smoothstep(0.06, 0.35, bankDist);
        bodyCol += vec3(0.38, 0.48, 0.34) * causticWeb * 0.68;

        vec3 R = reflect(-V, N);
        float skyGrad = clamp(R.y * 1.3 + 0.15, 0.0, 1.0);
        vec3 reflSky = mix(vec3(0.95, 0.82, 0.56), vec3(0.36, 0.64, 0.82), skyGrad);

        vec2 weirDelta = wp - vec2(8.32, -4.15);
        float weirDist = length(weirDelta * vec2(0.88, 0.54));
        float riffleZone = exp(-weirDist * weirDist * 1.9);
        float riffleWave = 0.5 + 0.5 * sin(weirDelta.y * 16.0 - uTime * 3.8 + hC * 4.5);
        N = normalize(N + vec3(sin(weirDelta.x * 12.0), 0.0, cos(weirDelta.y * 14.0)) * riffleZone * 0.20);

        vec3 waterCol = mix(bodyCol, reflSky, clamp(fresnel * 0.72, 0.08, 0.76));

        // 柔和收敛水面卡通白线波纹，突出水底鹅卵石清澈透视与局部星芒水光
        vec2 rippleFlow = vec2(wp.x * 2.4 + sin(wp.y * 1.8 - uTime * 1.35) * 0.24, wp.y * 1.9 - uTime * 0.85);
        float rippleWave = sin(rippleFlow.y * 4.2 + waveNoise(rippleFlow * 1.2) * 3.6);
        float cartoonBand = smoothstep(0.82, 0.92, rippleWave) * (1.0 - smoothstep(0.93, 0.99, rippleWave));
        float bankArc = sin(bankDist * 18.0 - uTime * 2.4 + waveNoise(wp * 2.1) * 2.6);
        float bankRipple = smoothstep(0.78, 0.89, bankArc) * (1.0 - smoothstep(0.06, 0.30, bankDist));
        float sunlitMask = smoothstep(0.08, 0.45, bankDist);
        waterCol += vec3(0.78, 0.92, 0.88) * (cartoonBand * 0.11 * sunlitMask + bankRipple * 0.13);

        // Sparkling micro-star diamond water glints dancing across sunlit ripples
        vec2 glintGrid = wp * 3.6 + vec2(0.0, -uTime * 0.52);
        vec2 glintCell = floor(glintGrid);
        vec2 glintF = fract(glintGrid) - 0.5;
        vec2 cellRnd = hash22(glintCell);
        vec2 glintOff = (cellRnd - 0.5) * 0.55;
        vec2 gp = glintF - glintOff;
        float crossStar = exp(-abs(gp.x) * 20.0) * exp(-abs(gp.y) * 5.5) + exp(-abs(gp.y) * 20.0) * exp(-abs(gp.x) * 5.5);
        float glintCore = exp(-dot(gp, gp) * 95.0);
        float sparkPulse = pow(max(0.0, sin(uTime * 3.2 + cellRnd.x * 31.4) * cos(uTime * 2.4 + cellRnd.y * 21.7)), 6.0);
        float sparkGate = step(0.56, fract(cellRnd.x * 17.3 + cellRnd.y * 9.1)) * sparkPulse * sunlitMask;
        waterCol += vec3(1.55, 1.38, 0.92) * (crossStar * 0.62 + glintCore * 0.85) * sparkGate;

        vec3 sunDir = normalize(vec3(8.8, 5.2, 3.4));
        vec3 H = normalize(sunDir + V);
        float sunSparkle = pow(max(dot(N, H), 0.0), 96.0) * smoothstep(0.08, 0.50, bankDist);
        float broadSheen = pow(max(dot(N, H), 0.0), 20.0) * 0.14 * smoothstep(0.06, 0.48, bankDist);
        waterCol += vec3(1.38, 1.12, 0.72) * (sunSparkle * 0.88 + broadSheen);

        float bankFoam = (1.0 - smoothstep(0.02, 0.14, bankDist)) * smoothstep(0.38, 0.70, hC);
        float weirFoam = riffleZone * smoothstep(0.35, 0.78, riffleWave * 0.68 + hC * 0.42) * smoothstep(0.05, 0.35, bankDist);
        waterCol = mix(waterCol, vec3(0.88, 0.92, 0.84), bankFoam * 0.64);
        waterCol = mix(waterCol, vec3(0.94, 0.97, 0.92), weirFoam * 0.70);

        if (any(isnan(waterCol)) || any(isinf(waterCol))) waterCol = bodyCol;
        float alpha = smoothstep(0.0, 0.08, bankDist) * mix(0.78, 0.94, fresnel * 0.65);
        gl_FragColor = vec4(clamp(waterCol, 0.0, 6.0), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function creekHalfWidthAtT(t: number, baseHalfWidth: number): number {
  return baseHalfWidth * (0.92 + 0.14 * Math.sin(t * Math.PI * 7.0));
}

function createMeanderingCreekGeometry(
  curve: THREE.CatmullRomCurve3,
  width: number,
  segsU = 160,
  segsV = 12,
  vRepeat = 14.0
): THREE.BufferGeometry {
  const positions = new Float32Array((segsU + 1) * (segsV + 1) * 3);
  const uvs = new Float32Array((segsU + 1) * (segsV + 1) * 2);
  const indices: number[] = [];

  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3();
  const baseHalfW = width * 0.5;

  for (let i = 0; i <= segsU; i++) {
    const t = i / segsU;
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    side.crossVectors(up, tan).normalize();

    const wMod = creekHalfWidthAtT(t, baseHalfW) * 2.0;

    for (let j = 0; j <= segsV; j++) {
      const u = j / segsV;
      const offset = (u - 0.5) * wMod;
      const idx = i * (segsV + 1) + j;
      positions[idx * 3] = pt.x + side.x * offset;
      positions[idx * 3 + 1] = pt.y;
      positions[idx * 3 + 2] = pt.z + side.z * offset;

      uvs[idx * 2] = u;
      uvs[idx * 2 + 1] = t * vRepeat;
    }
  }

  for (let i = 0; i < segsU; i++) {
    for (let j = 0; j < segsV; j++) {
      const a = i * (segsV + 1) + j;
      const b = a + 1;
      const c = (i + 1) * (segsV + 1) + j + 1;
      const d = (i + 1) * (segsV + 1) + j;
      indices.push(a, d, b, b, d, c);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/**
 * Sunken Earthen Gravel & Mossy Embankment Channel (`-0.35m` bank lip down to `-0.45m` submerged gravel bed)
 */
function createCreekEmbankmentGeometry(
  curve: THREE.CatmullRomCurve3,
  waterBaseWidth: number,
  segsU = 180
): THREE.BufferGeometry {
  const segsV = 10;
  const positions = new Float32Array((segsU + 1) * (segsV + 1) * 3);
  const uvs = new Float32Array((segsU + 1) * (segsV + 1) * 2);
  const colors = new Float32Array((segsU + 1) * (segsV + 1) * 3);
  const indices: number[] = [];

  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3();
  const baseHalfW = waterBaseWidth * 0.5;

  const colBed = new THREE.Color('#7B6E58');
  const colWetShore = new THREE.Color('#8E8068');
  const colMossLip = new THREE.Color('#647B46');
  const tmpCol = new THREE.Color();

  // Transverse bank cross-section stations (sideSign * offsetAdd + sideSign * hw * factor, heightY, color)
  const profile: Array<{ hwMul: number; pad: number; y: number; tone: number }> = [
    { hwMul: -1.0, pad: -0.68, y: -0.376, tone: 1.0 },
    { hwMul: -1.0, pad: -0.34, y: -0.348, tone: 0.85 },
    { hwMul: -1.0, pad: -0.04, y: -0.386, tone: 0.45 },
    { hwMul: -0.78, pad: 0.0, y: -0.432, tone: 0.15 },
    { hwMul: -0.36, pad: 0.0, y: -0.448, tone: 0.0 },
    { hwMul: 0.0, pad: 0.0, y: -0.452, tone: 0.0 },
    { hwMul: 0.36, pad: 0.0, y: -0.448, tone: 0.0 },
    { hwMul: 0.78, pad: 0.0, y: -0.432, tone: 0.15 },
    { hwMul: 1.0, pad: 0.04, y: -0.386, tone: 0.45 },
    { hwMul: 1.0, pad: 0.34, y: -0.348, tone: 0.85 },
    { hwMul: 1.0, pad: 0.68, y: -0.376, tone: 1.0 },
  ];

  for (let i = 0; i <= segsU; i++) {
    const t = i / segsU;
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    side.crossVectors(up, tan).normalize();
    const hw = creekHalfWidthAtT(t, baseHalfW);

    for (let j = 0; j <= segsV; j++) {
      const p = profile[j];
      const offset = p.hwMul * hw + p.pad;
      const idx = i * (segsV + 1) + j;
      positions[idx * 3] = pt.x + side.x * offset;
      positions[idx * 3 + 1] = p.y;
      positions[idx * 3 + 2] = pt.z + side.z * offset;

      uvs[idx * 2] = j / segsV;
      uvs[idx * 2 + 1] = t * 18.0;

      if (p.tone < 0.45) {
        tmpCol.lerpColors(colBed, colWetShore, p.tone / 0.45);
      } else {
        tmpCol.lerpColors(colWetShore, colMossLip, (p.tone - 0.45) / 0.55);
      }
      colors[idx * 3] = tmpCol.r;
      colors[idx * 3 + 1] = tmpCol.g;
      colors[idx * 3 + 2] = tmpCol.b;
    }
  }

  for (let i = 0; i < segsU; i++) {
    for (let j = 0; j < segsV; j++) {
      const a = i * (segsV + 1) + j;
      const b = a + 1;
      const c = (i + 1) * (segsV + 1) + j + 1;
      const d = (i + 1) * (segsV + 1) + j;
      indices.push(a, d, b, b, d, c);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/**
 * 多层次吉卜力风起伏草海地形（156m × 156m，多层 Simplex 噪声塑造连绵远山，溪流河道平滑下挖至 `-0.485m`）
 */
function createCarvedMeadowGeometry(curve: THREE.CatmullRomCurve3, waterBaseWidth: number): THREE.BufferGeometry {
  const size = 156;
  const segs = 172;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const curveSamples = 220;
  const sampleX = new Float32Array(curveSamples);
  const sampleZ = new Float32Array(curveSamples);
  const sampleHW = new Float32Array(curveSamples);
  const baseHalfW = waterBaseWidth * 0.5;
  for (let k = 0; k < curveSamples; k++) {
    const t = k / (curveSamples - 1);
    const p = curve.getPointAt(t);
    sampleX[k] = p.x;
    sampleZ[k] = p.z;
    sampleHW[k] = creekHalfWidthAtT(t, baseHalfW);
  }

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    let minRatio = 99.0;
    for (let k = 0; k < curveSamples; k++) {
      const dx = Math.abs(vx - sampleX[k]);
      const dz = Math.abs(vz - sampleZ[k]);
      if (dx > 2.6 || dz > 2.6) continue;
      const d = Math.hypot(dx, dz);
      const ratio = d / (sampleHW[k] + 0.52);
      if (ratio < minRatio) minRatio = ratio;
    }

    let y = sampleGhibliTerrainHeight(vx, vz);
    if (minRatio < 1.0) {
      const t = THREE.MathUtils.smoothstep(minRatio, 0.58, 1.0);
      y = THREE.MathUtils.lerp(-0.485, y, t);
    }
    pos.setY(i, y);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Exact Pitched Gable Triangle Wall Geometry (replaces crude flattened pyramid so roof & gable fit 100% seamlessly!)
 */
function createGableTriangleGeometry(halfSpan: number, rise: number, thickness: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-halfSpan, 0);
  shape.lineTo(halfSpan, 0);
  shape.lineTo(0, rise);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
  });
  geo.translate(0, 0, -thickness * 0.5);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Arched Wall Header Spandrel above Window Opening (leaves semicircular transom arch 100% open!)
 */
function createArchedWindowWallHeaderGeo(
  halfOpenW: number,
  springY: number,
  wallTopY: number,
  thickness: number
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-halfOpenW, springY);
  shape.absarc(0, springY, halfOpenW, Math.PI, 0, true);
  shape.lineTo(halfOpenW, wallTopY);
  shape.lineTo(-halfOpenW, wallTopY);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 28,
  });
  geo.translate(0, 0, -thickness * 0.5);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + halfOpenW) / 3.4, (pos.getY(i) - 1.16) / 2.76);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sculpted Sill S-Scroll Corbel Bracket supporting deep interior oak casement sills
 */
function createWindowSillCorbelGeo(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(0.15, 0);
  s.lineTo(0.15, -0.024);
  s.quadraticCurveTo(0.08, -0.048, 0.045, -0.11);
  s.quadraticCurveTo(0.025, -0.155, 0, -0.165);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.044,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 12,
  });
  g.translate(0, 0, -0.022);
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/**
 * Curved Near-Bank Mossy Dry-Stone Terraced Planter Bed ("一圈石台") + Soil Infill + Ivy Tendril Anchors
 */
function createCurvedStonePlanterBedData(
  pts2D: Array<[number, number]>,
  width = 0.58,
  wallH = 0.25,
  yBase = -0.365,
  segs = 22
) {
  const curve = new THREE.CatmullRomCurve3(pts2D.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const halfW = width * 0.5;
  const up = new THREE.Vector3(0, 1, 0);
  const copingLip = 0.028;
  const wallThick = 0.11;
  const yTop = yBase + wallH;
  const yUnderCoping = yTop - 0.045;
  const ySoil = yTop - 0.032;

  // Closed stone U-wall cross section (outer base -> outer coping -> inner top -> soil curb -> outer wall back to base)
  const stoneCross: Array<[number, number]> = [
    [-halfW, yBase],
    [-halfW, yUnderCoping],
    [-halfW - copingLip, yUnderCoping],
    [-halfW - copingLip, yTop],
    [-halfW + wallThick, yTop],
    [-halfW + wallThick, ySoil],
    [halfW - wallThick, ySoil],
    [halfW - wallThick, yTop],
    [halfW + copingLip, yTop],
    [halfW + copingLip, yUnderCoping],
    [halfW, yUnderCoping],
    [halfW, yBase],
  ];

  const pos: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const soilPos: number[] = [];
  const soilUvs: number[] = [];
  const soilIdx: number[] = [];
  const plantCenters: Array<{ x: number; y: number; z: number; rotY: number }> = [];
  const ivyStems: THREE.BufferGeometry[] = [];

  const stations: Array<{ pt: THREE.Vector3; side: THREE.Vector3; rotY: number }> = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const side = new THREE.Vector3().crossVectors(up, tan).normalize();
    const rotY = Math.atan2(tan.x, tan.z);
    stations.push({ pt, side, rotY });

    if (i > 0 && i < segs && i % 2 === 1) {
      plantCenters.push({ x: pt.x, y: ySoil, z: pt.z, rotY });
    }
    // Cascading ivy runners draping off the creek-facing side (+side)
    if (i > 1 && i < segs - 1 && i % 4 === 0) {
      const iStart = new THREE.Vector3(pt.x + side.x * (halfW - 0.03), yTop, pt.z + side.z * (halfW - 0.03));
      const iMid = new THREE.Vector3(pt.x + side.x * (halfW + copingLip + 0.035), yTop - 0.11, pt.z + side.z * (halfW + copingLip + 0.035));
      const iEnd = new THREE.Vector3(pt.x + side.x * (halfW + copingLip + 0.08), yBase + 0.03, pt.z + side.z * (halfW + copingLip + 0.08));
      ivyStems.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([iStart, iMid, iEnd]), 8, 0.008, 6, false));
    }
  }

  // Non-indexed quad strip per segment so bevelled masonry stone faces get clean crisp normals
  const pushQuad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, u0: number, v0: number, u1: number, v1: number) => {
    const base = pos.length / 3;
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z);
    uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  for (let i = 0; i < segs; i++) {
    const s0 = stations[i];
    const s1 = stations[i + 1];
    const u0 = (i / segs) * 4.0;
    const u1 = ((i + 1) / segs) * 4.0;
    for (let k = 0; k < stoneCross.length - 1; k++) {
      const [o0, y0] = stoneCross[k];
      const [o1, y1] = stoneCross[k + 1];
      const a = new THREE.Vector3(s0.pt.x + s0.side.x * o0, y0, s0.pt.z + s0.side.z * o0);
      const b = new THREE.Vector3(s1.pt.x + s1.side.x * o0, y0, s1.pt.z + s1.side.z * o0);
      const c = new THREE.Vector3(s1.pt.x + s1.side.x * o1, y1, s1.pt.z + s1.side.z * o1);
      const d = new THREE.Vector3(s0.pt.x + s0.side.x * o1, y1, s0.pt.z + s0.side.z * o1);
      pushQuad(a, b, c, d, u0, k / stoneCross.length, u1, (k + 1) / stoneCross.length);
    }

    // Soil strip between inner masonry edges
    const sb = soilPos.length / 3;
    const innerSpan = halfW - wallThick;
    const sa = new THREE.Vector3(s0.pt.x - s0.side.x * innerSpan, ySoil, s0.pt.z - s0.side.z * innerSpan);
    const sd = new THREE.Vector3(s0.pt.x + s0.side.x * innerSpan, ySoil, s0.pt.z + s0.side.z * innerSpan);
    const sbb = new THREE.Vector3(s1.pt.x - s1.side.x * innerSpan, ySoil, s1.pt.z - s1.side.z * innerSpan);
    const sc = new THREE.Vector3(s1.pt.x + s1.side.x * innerSpan, ySoil, s1.pt.z + s1.side.z * innerSpan);
    soilPos.push(sa.x, sa.y, sa.z, sbb.x, sbb.y, sbb.z, sc.x, sc.y, sc.z, sd.x, sd.y, sd.z);
    soilUvs.push(u0, 0, u1, 0, u1, 1, u0, 1);
    soilIdx.push(sb, sb + 1, sb + 2, sb, sb + 2, sb + 3);
  }

  // Close start & end masonry caps so neither curved stone bed end is ever hollow!
  [0, segs].forEach((si, endIdx) => {
    const st = stations[si];
    const pBL = new THREE.Vector3(st.pt.x - st.side.x * halfW, yBase, st.pt.z - st.side.z * halfW);
    const pBR = new THREE.Vector3(st.pt.x + st.side.x * halfW, yBase, st.pt.z + st.side.z * halfW);
    const pTR = new THREE.Vector3(st.pt.x + st.side.x * (halfW + copingLip), yTop, st.pt.z + st.side.z * (halfW + copingLip));
    const pTL = new THREE.Vector3(st.pt.x - st.side.x * (halfW + copingLip), yTop, st.pt.z - st.side.z * (halfW + copingLip));
    if (endIdx === 0) {
      pushQuad(pBR, pBL, pTL, pTR, 0, 0, 1, 1);
    } else {
      pushQuad(pBL, pBR, pTR, pTL, 0, 0, 1, 1);
    }
  });

  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  wallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  wallGeo.setIndex(indices);
  wallGeo.computeVertexNormals();

  const soilGeo = new THREE.BufferGeometry();
  soilGeo.setAttribute('position', new THREE.Float32BufferAttribute(soilPos, 3));
  soilGeo.setAttribute('uv', new THREE.Float32BufferAttribute(soilUvs, 2));
  soilGeo.setIndex(soilIdx);
  soilGeo.computeVertexNormals();

  return { wallGeo, soilGeo, plantCenters, ivyStems };
}

/**
 * 高清程序化法式田园风亚麻桌布纹理（1024×512）：
 * 暖奶油亚麻织纹底色 + 鼠尾草绿与柔蜜桃粉法式细格纹 + 四周手绘小雏菊、玫瑰花蕾与薰衣草田园绣花边
 */
function createPastoralTableclothTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // 1. 温润柔和的法式奶油亚麻底色（细腻纱线质感，告别粗糙灰黄感）
  ctx.fillStyle = '#F5ECDA';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(202, 182, 148, 0.10)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 8) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // 2. 清新法式田园格纹（鼠尾草绿 + 蜜桃粉柔和交织，在第一步近景下清晰可见！）
  const step = 44;
  for (let x = 0; x < w; x += step) {
    ctx.fillStyle = (x / step) % 2 === 0 ? 'rgba(128, 166, 118, 0.16)' : 'rgba(228, 152, 164, 0.13)';
    ctx.fillRect(x, 0, 10, h);
  }
  for (let y = 0; y < h; y += step) {
    ctx.fillStyle = (y / step) % 2 === 0 ? 'rgba(128, 166, 118, 0.16)' : 'rgba(228, 152, 164, 0.13)';
    ctx.fillRect(0, y, w, 10);
  }

  // 3. 外沿裙摆边框线 + 桌面工位可见内框双线花边（确保第 1 步铜锅视角也能看到精致花边绣纹！）
  ctx.strokeStyle = 'rgba(112, 148, 98, 0.56)';
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 20, w - 48, h - 40);
  ctx.strokeRect(92, 82, w - 184, h - 164);
  ctx.strokeStyle = 'rgba(218, 134, 148, 0.52)';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(34, 30, w - 68, h - 60);
  ctx.strokeRect(102, 92, w - 204, h - 184);

  // 4. 法式手绘小雏菊、蔷薇花蕾与绿叶绣花纹样
  const drawFloralMotif = (cx: number, cy: number, scale = 1) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#6A9A58';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(dir * 16, 2, 10, 4.5, dir * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#EB8EA4';
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 6.5, Math.sin(a) * 6.5, 4.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#F7D262';
    ctx.beginPath();
    ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // 裙摆外围一圈刺绣玫瑰
  for (let x = 72; x <= w - 72; x += 68) {
    drawFloralMotif(x, 48, 0.92);
    drawFloralMotif(x, h - 48, 0.92);
  }
  for (let y = 96; y <= h - 96; y += 76) {
    drawFloralMotif(56, y, 0.85);
    drawFloralMotif(w - 56, y, 0.85);
  }
  // 桌面内框（近景操作区周围可见！）绣花散点花环
  for (let x = 148; x <= w - 148; x += 88) {
    drawFloralMotif(x, 118, 0.72);
    drawFloralMotif(x, h - 118, 0.72);
  }
  for (let y = 160; y <= h - 160; y += 92) {
    drawFloralMotif(132, y, 0.72);
    drawFloralMotif(w - 132, y, 0.72);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * 细腻柔滑的法式精梳亚麻织物法线贴图（大幅降低颗粒硬度，消除粗麻袋/纱窗纹感）
 */
function createLinenFabricNormalMap(): THREE.CanvasTexture {
  const size = 512;
  const height = new Float32Array(size * size);
  let rng = 20261123;
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 4294967296;
  };
  const threadJitterX = new Float32Array(size);
  const threadJitterY = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    threadJitterX[i] = (rand() - 0.5) * 0.14;
    threadJitterY[i] = (rand() - 0.5) * 0.14;
  }

  const freq = (Math.PI * 2) / 4.0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const warp = Math.sin(x * freq + threadJitterY[y]) * 0.5 + 0.5;
      const weft = Math.sin(y * freq + threadJitterX[x]) * 0.5 + 0.5;
      const checker = (((x >> 2) + (y >> 2)) & 1) === 0 ? 1.0 : -1.0;
      const weave = 0.5 * (warp + weft) + 0.16 * checker * (warp - weft);
      const slub = (threadJitterX[x] + threadJitterY[y]) * 0.22;
      height[y * size + x] = weave + slub;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const strength = 0.55;

  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const dx = (height[y * size + xp] - height[y * size + xm]) * strength;
      const dy = (height[yp * size + x] - height[ym * size + x]) * strength;
      const invLen = 1.0 / Math.hypot(-dx, -dy, 1.0);
      const idx = (y * size + x) * 4;
      data[idx] = Math.round((-dx * invLen * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((-dy * invLen * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((1.0 * invLen * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 7);
  tex.anisotropy = 8;
  return tex;
}

/**
 * 一体化无缝细分垂坠亚麻桌布网格（Subdivision + Soft Cloth Drape v2 - 零木框与桌垫穿模版）：
 * - 桌面中心严格 y = 0.0000 完全水平（绝不顶破上方铜锅蕾丝桌垫），
 * - 滚边基准外扩至橡木框外沿（innerW = 1.634, innerD = 0.694）之外再柔和自然波浪下垂。
 */
function createDrapedTableclothGeometry(
  innerW = 1.634,
  innerD = 0.694,
  dropLen = 0.212,
  rollRadius = 0.036,
  segX = 88,
  segZ = 48
): THREE.BufferGeometry {
  const flatHalfW = innerW + rollRadius + dropLen;
  const flatHalfD = innerD + rollRadius + dropLen;
  const rollArc = (Math.PI * 0.5) * rollRadius;

  const cols = segX + 1;
  const rows = segZ + 1;
  const positions = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);
  const drapeWeights = new Float32Array(cols * rows);
  const indices: number[] = [];

  for (let iz = 0; iz <= segZ; iz++) {
    const v = iz / segZ; // 0..1
    const fz = (v * 2 - 1) * flatHalfD;
    for (let ix = 0; ix <= segX; ix++) {
      const u = ix / segX; // 0..1
      const fx = (u * 2 - 1) * flatHalfW;

      const absX = Math.abs(fx);
      const absZ = Math.abs(fz);
      const sx = fx >= 0 ? 1 : -1;
      const sz = fz >= 0 ? 1 : -1;

      const ox = Math.max(0, absX - innerW);
      const oz = Math.max(0, absZ - innerD);
      const overhang = Math.hypot(ox, oz);

      let x = fx;
      let y = 0;
      let z = fz;
      let drape = 0;

      if (overhang <= 1e-6) {
        // 桌面中心平铺区：严格零起伏 y=0，彻底避免与顶部蕾丝垫发生斜切穿模！
        y = 0;
        drape = 0;
      } else {
        const dirX = ox / overhang;
        const dirZ = oz / overhang;
        const baseX = sx * Math.min(absX, innerW);
        const baseZ = sz * Math.min(absZ, innerD);

        if (overhang <= rollArc) {
          // 在木框最外沿之外开始的柔软圆弧滚边（绝不切入橡木桌角与长边！）
          const theta = overhang / rollRadius;
          const outDist = Math.sin(theta) * rollRadius;
          x = baseX + sx * dirX * outDist;
          z = baseZ + sz * dirZ * outDist;
          y = -(1.0 - Math.cos(theta)) * rollRadius;
          drape = (theta / (Math.PI * 0.5)) * 0.16;
        } else {
          // 自然重力下垂裙摆：所有波浪与四角垂褶偏移均严格 >= 0（只向外舒展，零内凹穿模！）
          const hang = overhang - rollArc;
          const maxStraightHang = Math.max(0.02, dropLen - rollArc);
          const s = Math.min(1.35, hang / maxStraightHang);
          const sClamped = Math.min(1.0, s);

          const cornerMask = Math.min(1.0, (2.0 * ox * oz) / (overhang * overhang + 1e-6));
          const perimAngle = Math.atan2(fz * (innerW / innerD), fx);

          // 正向波浪布褶（[0, +0.019]）+ 正向桌角自然聚褶（[0, +0.032]）
          const edgeWave =
            ((Math.sin(perimAngle * 22.0) * 0.5 + 0.5) * 0.014 +
              (Math.sin(perimAngle * 38.0 + 1.3) * 0.5 + 0.5) * 0.005) *
            Math.pow(sClamped, 1.30);
          const cornerPleat =
            cornerMask *
            (0.010 +
              (Math.cos(perimAngle * 16.0) * 0.5 + 0.5) * 0.018 +
              (Math.sin(perimAngle * 28.0) * 0.5 + 0.5) * 0.005) *
            Math.pow(sClamped, 1.20);

          const outFlare = rollRadius + 0.008 * sClamped + edgeWave + cornerPleat;
          x = baseX + sx * dirX * outFlare;
          z = baseZ + sz * dirZ * outFlare;

          const hemWave = Math.sin(perimAngle * 26.0) * 0.006 * Math.pow(sClamped, 1.35);
          y = -rollRadius - hang * (1.0 + 0.22 * cornerMask) + hemWave;
          drape = Math.min(1.0, 0.16 + 0.84 * sClamped);
        }
      }

      const vi = iz * cols + ix;
      positions[vi * 3] = x;
      positions[vi * 3 + 1] = y;
      positions[vi * 3 + 2] = z;
      uvs[vi * 2] = u;
      uvs[vi * 2 + 1] = 1.0 - v;
      drapeWeights[vi] = drape;
    }
  }

  for (let iz = 0; iz < segZ; iz++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iz * cols + ix;
      const b = a + 1;
      const c = (iz + 1) * cols + ix;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('aClothDrape', new THREE.BufferAttribute(drapeWeights, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * 复古法式手绘烘焙工坊外墙招牌 LOGO 贴图（1024×384）：
 * 「林间花房烘焙小屋 · LA PÂTISSERIE DU JARDIN · EST. 1924」+ 手绘金色麦穗与法式草莓蛋糕纹章
 */
function createPatisserieSignLogoTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // 温润奶油手绘木牌底色
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#FCF6E8');
  bg.addColorStop(1, '#F2E5CB');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // 鼠尾草绿与复古鎏金双层雕花边框
  ctx.strokeStyle = '#5D7B57';
  ctx.lineWidth = 10;
  ctx.strokeRect(18, 18, w - 36, h - 36);
  ctx.strokeStyle = '#C79B52';
  ctx.lineWidth = 3.5;
  ctx.strokeRect(32, 32, w - 64, h - 64);

  // 四角法式藤蔓小玫瑰装饰
  const corners = [
    [54, 54],
    [w - 54, 54],
    [54, h - 54],
    [w - 54, h - 54],
  ];
  corners.forEach(([cx, cy]) => {
    ctx.fillStyle = '#6E9462';
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#EB92A8';
    ctx.beginPath();
    ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // 顶部中央手绘草莓奶油蛋糕徽记 + 两侧金色麦穗（提高色彩浓度防白底隐没）
  ctx.save();
  ctx.translate(w / 2, 92);
  ctx.strokeStyle = '#A67222';
  ctx.fillStyle = '#C68C32';
  ctx.lineWidth = 3.0;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 38, 12);
    ctx.quadraticCurveTo(dir * 95, 10, dir * 135, -14);
    ctx.stroke();
    for (let k = 0; k < 5; k++) {
      const gx = dir * (56 + k * 17);
      const gy = 8 - k * 4.5;
      ctx.beginPath();
      ctx.ellipse(gx, gy - 5, 7, 3.2, dir * -0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(gx + dir * 3, gy + 5, 6.5, 3.0, dir * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#D99B52';
  ctx.fillRect(-24, -6, 48, 22);
  ctx.fillStyle = '#FFF7E8';
  ctx.fillRect(-26, -12, 52, 9);
  ctx.fillStyle = '#D83846';
  ctx.beginPath();
  ctx.arc(0, -19, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4E7D3C';
  ctx.fillRect(-5, -29, 10, 4);
  ctx.restore();

  // 主标题：林间花房烘焙小屋
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#3D2B1F';
  ctx.font = '700 66px "Microsoft YaHei", "PingFang SC", "Noto Serif SC", serif';
  ctx.fillText('林间花房烘焙小屋', w / 2, 198);

  // 优雅法文副标
  ctx.fillStyle = '#6B523E';
  ctx.font = '600 26px Georgia, "Times New Roman", serif';
  ctx.fillText('—  LA PÂTISSERIE DU JARDIN · EST. 1924  —', w / 2, 272);

  // 底部法式手写小注脚
  ctx.fillStyle = '#5B7C54';
  ctx.font = '500 20px "Microsoft YaHei", sans-serif';
  ctx.fillText('✦ 手作法式甜点 · 现摘庄园草莓与香草 ✦', w / 2, 318);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Conservatory Window-Mullion & Swaying Vine-Leaf Gobo Sunlight Texture (512×512)
 * Projects warm golden-afternoon French casement light panes crossed by crisp mullion bars
 * and dappled botanical vine-leaf silhouettes onto the herringbone floor & oak baking table!
 */
function createDappledSunPatchTexture(tintedJewel = false): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  let rng = tintedJewel ? 4040 : 909;
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 4294967296;
  };

  if (tintedJewel) {
    // Stained-glass Tiffany jewel light pools near North/West arched windows
    const jewelColors = [
      'rgba(248, 162, 180, 0.34)',
      'rgba(255, 212, 122, 0.40)',
      'rgba(156, 218, 152, 0.28)',
    ];
    for (let i = 0; i < 36; i++) {
      const bx = 56 + rand() * (size - 112);
      const by = 56 + rand() * (size - 112);
      const br = 24 + rand() * 52;
      const g = ctx.createRadialGradient(bx, by, 4, bx, by, br);
      g.addColorStop(0, jewelColors[i % jewelColors.length]);
      g.addColorStop(1, 'rgba(255, 224, 152, 0.0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // 1. Slanted 3×2 Conservatory French-Window Sunlight Panes (crisp mullions + soft penumbra)
    ctx.save();
    ctx.filter = 'blur(4px)';
    const cols = 3;
    const rows = 2;
    const padX = 48;
    const padY = 58;
    const gap = 22;
    const paneW = (size - padX * 2 - gap * (cols - 1)) / cols;
    const paneH = (size - padY * 2 - gap * (rows - 1)) / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = padX + c * (paneW + gap);
        const py = padY + r * (paneH + gap);
        const g = ctx.createLinearGradient(px, py, px + paneW, py + paneH);
        g.addColorStop(0.0, 'rgba(255, 220, 142, 0.54)');
        g.addColorStop(0.55, 'rgba(255, 206, 118, 0.46)');
        g.addColorStop(1.0, 'rgba(255, 192, 100, 0.34)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(px, py, paneW, paneH, 10);
        ctx.fill();
      }
    }

    // 2. Carve organic swaying vine-leaf shadow silhouettes out of the sunlit panes (destination-out!)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.filter = 'blur(5px)';
    // Main trailing vine stem curving across upper panes
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(28, 128);
    ctx.bezierCurveTo(160, 82, 310, 215, 488, 158);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(64, 340);
    ctx.bezierCurveTo(205, 295, 345, 405, 476, 330);
    ctx.stroke();

    // Organic overlapping elliptical garden leaves dappled across the window light
    for (let i = 0; i < 42; i++) {
      const lx = 44 + rand() * (size - 88);
      const ly = 54 + rand() * (size - 108);
      const rx = 18 + rand() * 34;
      const ry = 8 + rand() * 16;
      const rot = (rand() - 0.5) * Math.PI;
      ctx.fillStyle = `rgba(0, 0, 0, ${(0.42 + rand() * 0.44).toFixed(2)})`;
      ctx.beginPath();
      ctx.ellipse(lx, ly, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Soft radial outer feathering so plane borders are 100% invisible on any surface
    ctx.filter = 'none';
    const maskGrad = ctx.createRadialGradient(
      size * 0.5,
      size * 0.5,
      size * 0.24,
      size * 0.5,
      size * 0.5,
      size * 0.50
    );
    maskGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.0)');
    maskGrad.addColorStop(0.75, 'rgba(0, 0, 0, 0.16)');
    maskGrad.addColorStop(1.0, 'rgba(0, 0, 0, 1.0)');
    ctx.fillStyle = maskGrad;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Shared GPU Vertex Breeze-Sway Helper for Potted Plants, Window Flora, Terrace Roses, Ferns & Hanging Wisteria
 */
function createGardenBotanicalWindMat(
  windUniform: { value: number },
  options: {
    swayAmp?: number;
    yBase?: number;
    yRange?: number;
    radialPin?: boolean;
    cacheTag: string;
  } & THREE.MeshStandardMaterialParameters
): THREE.MeshStandardMaterial {
  const { swayAmp = 0.014, yBase = 0.0, yRange = 0.32, radialPin = false, cacheTag, ...stdParams } = options;
  const mat = new THREE.MeshStandardMaterial({
    envMapIntensity: 0.22,
    ...stdParams,
  });
  const tipExpr = radialPin
    ? 'clamp(length(position) * 4.2, 0.0, 1.0)'
    : `clamp((position.y - ${yBase.toFixed(3)}) / ${Math.max(0.02, yRange).toFixed(3)}, 0.0, 1.0)`;
  mat.customProgramCacheKey = () => `patisserie-botanical-wind-${cacheTag}`;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniform;
    shader.uniforms.uWindAmp = { value: swayAmp };
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
        vec3 wSeed = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #ifdef USE_INSTANCING
          wSeed = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #endif
        float wPhase = wSeed.x * 0.62 + wSeed.z * 0.54 + wSeed.y * 0.30;
        float wWave = sin(uWindTime * 1.55 + wPhase) * 0.68 + cos(uWindTime * 2.45 + wPhase * 1.6) * 0.32;
        float wTip = ${tipExpr};
        wTip = wTip * (0.45 + 0.55 * wTip);
        transformed.x += wWave * uWindAmp * wTip;
        transformed.z += cos(uWindTime * 1.32 + wPhase * 1.25) * uWindAmp * 0.65 * wTip;`
      );
  };
  return mat;
}

/**
 * Drifting Golden Sunlit Firefly & Flour Dust Motes
 * Spread across the cozy flower conservatory sunbeams and sunlit outdoor veranda with glowing HDR Bloom halos!
 */
const SunlitDustMotes: React.FC = () => {
  const { geo, mat } = useMemo(() => {
    // 扩大至全玻璃花房采光廊与户外阳光交界（x ∈ [-3.2, 5.4], z ∈ [-2.2, 8.8]），重现梦幻空气散光微粒！
    const count = 260;
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const t = Math.random();
      if (i < 175) {
        // 室内暖阳走廊与中岛斜光微粒（包含桌面周围与东、南落地花窗采光带）
        positions[i * 3] = THREE.MathUtils.lerp(-2.85, 5.15, t) + (Math.random() - 0.5) * 0.65;
        positions[i * 3 + 1] = THREE.MathUtils.lerp(0.85, 3.28, Math.random());
        positions[i * 3 + 2] = -2.2 + Math.random() * 6.8;
      } else {
        // 门廊至溪畔花境空中的金色萤火光尘
        positions[i * 3] = THREE.MathUtils.lerp(-4.5, 8.5, t);
        positions[i * 3 + 1] = THREE.MathUtils.lerp(0.65, 2.85, Math.random());
        positions[i * 3 + 2] = 5.2 + Math.random() * 8.5;
      }
      sizes[i] = 14.5 + Math.pow(Math.random(), 1.9) * 18.0;
      phases[i] = Math.random() * Math.PI * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      vertexShader: /* glsl */ `
        attribute float aPhase;
        attribute float aSize;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vAlpha;
        varying float vWarmth;
        varying float vPulse;
        void main() {
          vec3 p = position;
          p.y += sin(uTime * 0.45 + aPhase) * 0.18 + mod(uTime * 0.04 + aPhase * 0.25, 0.7) * 0.24;
          p.x += cos(uTime * 0.30 + aPhase * 1.7) * 0.20;
          p.z += sin(uTime * 0.25 + aPhase * 1.3) * 0.14;

          float sunCorridor = smoothstep(-3.6, 1.5, p.x) * smoothstep(9.2, 4.2, p.x);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float breathSlow = 0.5 + 0.5 * sin(uTime * 1.05 + aPhase * 2.1);
          float breathFast = 0.5 + 0.5 * sin(uTime * 2.45 + aPhase * 5.3);
          float pulse = mix(breathSlow, breathSlow * breathFast, 0.46);
          gl_PointSize = clamp((aSize * (0.95 + 0.42 * pulse) * uPixelRatio) / max(1.05, -mv.z), 3.0, 26.0);
          vAlpha = (0.48 + 0.52 * pow(pulse, 1.15)) * mix(0.45, 0.98, sunCorridor);
          vWarmth = sunCorridor;
          vPulse = pulse;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        varying float vWarmth;
        varying float vPulse;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          if (d > 1.0) discard;
          // HDR emissive firefly core + dual soft golden Bloom halo
          float core = exp(-d * d * 9.5);
          float innerHalo = exp(-d * d * 2.8) * (0.58 + 0.26 * vPulse);
          float outerHalo = pow(max(1e-4, 1.0 - d), 2.1) * 0.52;
          vec3 col = mix(vec3(1.0, 0.90, 0.58), vec3(1.0, 0.78, 0.36), vWarmth) * (1.42 + 0.48 * vPulse);
          gl_FragColor = vec4(clamp(col, 0.0, 3.2), clamp((core + innerHalo + outerHalo) * vAlpha, 0.0, 1.0));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    return { geo: g, mat: m };
  }, []);

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.getElapsedTime();
  });

  return <points geometry={geo} material={mat} userData={{ excludeFromDepthAO: true }} raycast={() => null} />;
};

/**
 * Profiled Sage-Green Enamel Conservatory Arch Casement (`85918c0f` Botanical Stained-Glass Perimeter Tiles + Clear 6-Pane Center,
 * Concentric Stained-Glass Fanlight Crown, Brass Cremone Latch, Corbelled Herb Sill & Embroidered Eyelet Lace Curtains!)
 */
const ConservatoryCasementWindow: React.FC<{
  position: [number, number, number];
  width?: number;
  sillY?: number;
  springY?: number;
  sageFrameMat: THREE.Material;
  glassMat: THREE.Material;
  stainedBorderMat: THREE.Material;
  ironMat: THREE.Material;
  curtainMat: THREE.ShaderMaterial;
  showSillFlowers?: boolean;
}> = ({
  position,
  width = 1.28,
  sillY = 1.18,
  springY = 2.52,
  sageFrameMat,
  glassMat,
  stainedBorderMat,
  ironMat,
  curtainMat,
  showSillFlowers = true,
}) => {
  const halfW = width * 0.5;
  const rectH = springY - sillY;
  const archR = halfW;
  const crownY = springY + archR;
  const midRectY = sillY + rectH * 0.5;
  const rodY = crownY + 0.18;
  const rodSpan = width + 0.36;
  const curtTopY = rodY;
  const curtBotY = sillY + 0.068;
  const curtH = Math.max(0.42, curtTopY - curtBotY);
  const curtMidY = (curtTopY + curtBotY) * 0.5;
  const borderBandW = 0.155;
  const jambInnerW = 0.068;
  const sillTopOffset = 0.018;
  const clearInnerW = width - jambInnerW * 2 - borderBandW * 2;
  const clearInnerH = Math.max(0.40, rectH - sillTopOffset - borderBandW - 0.036);
  const clearMidY = sillY + sillTopOffset + borderBandW + clearInnerH * 0.5;
  const archOuterR = archR - 0.022;
  const archInnerR = Math.max(0.18, archOuterR - borderBandW);

  const { sillGeo, corbelGeo, jambBorderGeo, bottomBorderGeo, archBorderGeo } = useMemo(() => {
    const jGeo = new THREE.PlaneGeometry(borderBandW, rectH - 0.036);
    const jUv = jGeo.attributes.uv;
    for (let i = 0; i < jUv.count; i++) {
      jUv.setY(i, jUv.getY(i) * 2.15);
    }

    const bGeo = new THREE.PlaneGeometry(clearInnerW + 0.012, borderBandW);
    const bUv = bGeo.attributes.uv;
    for (let i = 0; i < bUv.count; i++) {
      const u = bUv.getX(i);
      const v = bUv.getY(i);
      bUv.setXY(i, v, u * 1.50);
    }

    const aGeo = new THREE.RingGeometry(archInnerR, archOuterR, 36, 1, 0, Math.PI);
    const aPos = aGeo.attributes.position;
    const aUv = aGeo.attributes.uv;
    for (let i = 0; i < aPos.count; i++) {
      const px = aPos.getX(i);
      const py = aPos.getY(i);
      const r = Math.hypot(px, py);
      const ang = THREE.MathUtils.clamp(Math.atan2(Math.max(0, py), px), 0, Math.PI);
      const u = THREE.MathUtils.clamp((r - archInnerR) / Math.max(0.01, archOuterR - archInnerR), 0, 1);
      const v = (ang / Math.PI) * 2.55;
      aUv.setXY(i, u, v);
    }

    return {
      sillGeo: createBeveledBoxGeometry(width + 0.28, 0.056, 0.30, 0.014, 0.008, 0.008, 2),
      corbelGeo: createWindowSillCorbelGeo(),
      jambBorderGeo: jGeo,
      bottomBorderGeo: bGeo,
      archBorderGeo: aGeo,
    };
  }, [width, rectH, borderBandW, clearInnerW, archInnerR, archOuterR]);

  useEffect(() => {
    return () => {
      sillGeo.dispose();
      corbelGeo.dispose();
      jambBorderGeo.dispose();
      bottomBorderGeo.dispose();
      archBorderGeo.dispose();
    };
  }, [sillGeo, corbelGeo, jambBorderGeo, bottomBorderGeo, archBorderGeo]);

  return (
    <group position={position}>
      {/* Profiled Sage-Green Enamel Recessed Window Reveal Jambs + Outer Casing Moldings */}
      {[-halfW + 0.032, halfW - 0.032].map((jx, ji) => (
        <group key={`jamb-${ji}`}>
          <mesh position={[jx, midRectY, 0]} material={sageFrameMat} castShadow receiveShadow>
            <boxGeometry args={[jambInnerW, rectH + 0.04, 0.23]} />
          </mesh>
          {[-0.105, 0.105].map((mz, mi) => (
            <mesh
              key={`casing-${mi}`}
              position={[jx + (ji === 0 ? -0.022 : 0.022), midRectY, mz]}
              material={sageFrameMat}
              castShadow
            >
              <boxGeometry args={[0.048, rectH + 0.05, 0.032]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Horizontal Profiled Sage-Green Transom Bar */}
      <mesh position={[0, springY, 0]} material={sageFrameMat} castShadow receiveShadow>
        <boxGeometry args={[width + 0.05, 0.072, 0.23]} />
      </mesh>
      {/* Interior & Exterior Profiled Sage-Green Enamel Arch Casings */}
      {[-0.10, 0.10].map((rz, ri) => (
        <mesh key={`arch-${ri}`} position={[0, springY, rz]} material={sageFrameMat} castShadow>
          <torusGeometry args={[archR - 0.018, 0.042, 14, 36, Math.PI]} />
        </mesh>
      ))}
      {/* Inner Sage-Enamel & Lead Glazing Divider Framing Botanical Stained Border from Clear Center Panes */}
      {[-halfW + jambInnerW + borderBandW - 0.002, halfW - jambInnerW - borderBandW + 0.002].map((lx, li) => (
        <mesh key={`lbar-${li}`} position={[lx, clearMidY, 0]} material={sageFrameMat} castShadow>
          <boxGeometry args={[0.026, clearInnerH + borderBandW + 0.02, 0.032]} />
        </mesh>
      ))}
      <mesh position={[0, sillY + sillTopOffset + borderBandW, 0]} material={sageFrameMat}>
        <boxGeometry args={[clearInnerW + 0.024, 0.026, 0.032]} />
      </mesh>
      <mesh position={[0, springY, 0]} material={sageFrameMat}>
        <torusGeometry args={[archInnerR, 0.016, 10, 36, Math.PI]} />
      </mesh>
      <mesh position={[0, springY, 0]} material={ironMat}>
        <torusGeometry args={[archInnerR - 0.012, 0.007, 8, 36, Math.PI]} />
      </mesh>

      {/* Bold Botanical Stained-Glass Perimeter Border Tiles (15.5cm Jambs, Bottom Border & Curved Fanlight Crown!) */}
      {[-halfW + jambInnerW + borderBandW * 0.5 - 0.002, halfW - jambInnerW - borderBandW * 0.5 + 0.002].map(
        (bx, bi) => (
          <mesh key={`stborder-v-${bi}`} position={[bx, midRectY, 0]} geometry={jambBorderGeo} material={stainedBorderMat} />
        )
      )}
      <mesh
        position={[0, sillY + sillTopOffset + borderBandW * 0.5, 0]}
        geometry={bottomBorderGeo}
        material={stainedBorderMat}
      />
      <mesh position={[0, springY, 0]} geometry={archBorderGeo} material={stainedBorderMat} />

      {/* CRYSTAL-CLEAR 2×3 French Center Window Panes + Meeting Stile & Glazing Bars */}
      <mesh position={[0, clearMidY, 0]} material={glassMat}>
        <planeGeometry args={[clearInnerW, clearInnerH]} />
      </mesh>
      <mesh position={[0, clearMidY, 0]} material={sageFrameMat} castShadow>
        <boxGeometry args={[0.036, clearInnerH + 0.02, 0.044]} />
      </mesh>
      {[sillY + sillTopOffset + borderBandW + clearInnerH * 0.34, sillY + sillTopOffset + borderBandW + clearInnerH * 0.68].map((my, mi) => (
        <mesh key={`muntin-${mi}`} position={[0, my, 0]} material={sageFrameMat}>
          <boxGeometry args={[clearInnerW, 0.022, 0.034]} />
        </mesh>
      ))}

      {/* Brushed-Brass Espagnolette / Cremone Latch Hardware on Center Meeting Stile */}
      <group position={[0, sillY + rectH * 0.44, 0.028]}>
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.0055, 0.0055, rectH - 0.14, 10]} />
          <meshStandardMaterial color="#B88A44" metalness={0.62} roughness={0.44} />
        </mesh>
        <mesh position={[0, 0, 0.006]}>
          <boxGeometry args={[0.024, 0.068, 0.018]} />
          <meshStandardMaterial color="#B88A44" metalness={0.62} roughness={0.44} />
        </mesh>
        <mesh position={[0.024, -0.016, 0.016]} rotation={[0, 0, -0.35]}>
          <capsuleGeometry args={[0.006, 0.042, 6, 10]} />
          <meshStandardMaterial color="#C89B54" metalness={0.64} roughness={0.42} />
        </mesh>
      </group>

      {/* Clear Inner Arched Transom Fanlight Pane + 3 Slender Radial Sage Fanlight Spokes + Rosette Hub */}
      <mesh position={[0, springY, 0]} material={glassMat}>
        <circleGeometry args={[archInnerR - 0.004, 28, 0, Math.PI]} />
      </mesh>
      <mesh position={[0, springY + 0.02, 0]} material={sageFrameMat}>
        <cylinderGeometry args={[0.065, 0.065, 0.038, 16, 1, false, 0, Math.PI]} />
      </mesh>
      {[-0.78, 0.0, 0.78].map((ang, ai) => {
        const len = archOuterR - 0.02;
        return (
          <mesh
            key={`spoke-${ai}`}
            position={[Math.sin(ang) * (len * 0.5), springY + Math.cos(ang) * (len * 0.5), 0]}
            rotation={[0, 0, -ang]}
            material={sageFrameMat}
          >
            <boxGeometry args={[0.022, len, 0.034]} />
          </mesh>
        );
      })}

      {/* Corbelled Profiled Sage-Enamel Interior Windowsill + 3 Tidy Sculpted Herb Pots */}
      <mesh position={[0, sillY - 0.01, 0.12]} geometry={sillGeo} material={sageFrameMat} castShadow receiveShadow />
      {[-halfW * 0.72, halfW * 0.72].map((cx, ci) => (
        <mesh key={`corbel-${ci}`} position={[cx, sillY - 0.038, 0.125]} geometry={corbelGeo} material={sageFrameMat} castShadow />
      ))}
      {showSillFlowers && <SillPlanterArrangement width={width} sillTopY={sillY + 0.018} />}

      {/* Wall-Mounted Forged Wrought-Iron Rod Proud (`z = 0.235 > post zMax 0.16`) & Clear-of-Sill Lace Curtains */}
      <group position={[0, rodY, 0.235]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.011, 0.011, rodSpan, 14]} />
          <meshStandardMaterial color="#2C2926" metalness={0.42} roughness={0.58} />
        </mesh>
        {[-rodSpan * 0.5, rodSpan * 0.5].map((fx, fi) => (
          <mesh key={`fin-${fi}`} position={[fx, 0, 0]}>
            <sphereGeometry args={[0.024, 12, 10]} />
            <meshStandardMaterial color="#2C2926" metalness={0.42} roughness={0.56} />
          </mesh>
        ))}
        {[-halfW - 0.04, halfW + 0.04].map((bx, bi) => (
          <mesh key={`brk-${bi}`} position={[bx, -0.004, -0.062]}>
            <boxGeometry args={[0.022, 0.028, 0.128]} />
            <meshStandardMaterial color="#2C2926" metalness={0.42} roughness={0.58} />
          </mesh>
        ))}
      </group>
      {/* Embroidered Eyelet Lace Drape Panels hung Proud (`z = 0.235`) & Strictly Above Sill (`y_bot = sillY + 0.068`) */}
      {[-halfW - 0.01, halfW + 0.01].map((cx, ci) => (
        <mesh
          key={`curt-${ci}`}
          position={[cx, curtMidY, 0.235]}
          material={curtainMat}
          raycast={() => null}
        >
          <planeGeometry args={[0.20, curtH, 10, 18]} />
        </mesh>
      ))}
    </group>
  );
};

/**
 * Brass-Arm Pleated Silk Cottage Wall Sconce (`85918c0f` Wall Lamps flanking Portals & Arched Casements!)
 */
const CottageWallSconce: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
}> = ({ position, rotation = [0, 0, 0] }) => (
  <group position={position} rotation={rotation}>
    {/* Turned antique brass wall backplate */}
    <mesh position={[0, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.044, 0.050, 0.022, 18]} />
      <meshStandardMaterial color="#B5893E" metalness={0.62} roughness={0.44} />
    </mesh>
    {/* Curved brass sconce arm + candle cup */}
    <mesh position={[0, -0.02, 0.068]} rotation={[0.42, 0, 0]}>
      <cylinderGeometry args={[0.007, 0.009, 0.11, 10]} />
      <meshStandardMaterial color="#B5893E" metalness={0.62} roughness={0.44} />
    </mesh>
    <mesh position={[0, 0.02, 0.11]}>
      <cylinderGeometry args={[0.018, 0.012, 0.042, 12]} />
      <meshStandardMaterial color="#C89B50" metalness={0.62} roughness={0.44} />
    </mesh>
    {/* Pleated Warm Cream-Linen Lampshade with Gentle Inner Glow */}
    <mesh position={[0, 0.105, 0.11]}>
      <cylinderGeometry args={[0.056, 0.095, 0.14, 18, 1, false]} />
      <meshStandardMaterial
        color="#FFF5DE"
        emissive="#FFD48C"
        emissiveIntensity={0.88}
        roughness={0.78}
        side={THREE.DoubleSide}
      />
    </mesh>
  </group>
);

const SillPlanterArrangement: React.FC<{ width: number; sillTopY: number }> = ({ width, sillTopY }) => {
  const craftAssets = useMemo(() => getCottageCraftAssets(), []);
  const { leafGeo, daisyGeo, roseGeo } = useMemo(
    () => ({
      leafGeo: createLayeredLeafClusterGeometry(7),
      daisyGeo: createChamomileDaisyHeadGeometry(),
      roseGeo: createSculptedRoseBlossomGeometry(),
    }),
    []
  );

  useEffect(() => {
    return () => {
      leafGeo.dispose();
      daisyGeo.dispose();
      roseGeo.dispose();
    };
  }, [leafGeo, daisyGeo, roseGeo]);

  return (
    <group position={[0, sillTopY, 0.155]}>
      {/* Left Pot: Chamomile Daisies in Matte Terracotta-Bisque Ceramic */}
      <group position={[-width * 0.30, 0, 0]}>
        <mesh position={[0, 0.052, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.056, 0.042, 0.104, 18]} />
          <meshStandardMaterial
            map={craftAssets.matteCeramicGlaze.map}
            normalMap={craftAssets.matteCeramicGlaze.normalMap}
            roughnessMap={craftAssets.matteCeramicGlaze.roughnessMap}
            color="#CE8B66"
            roughness={0.82}
          />
        </mesh>
        <mesh position={[0, 0.10, 0]}>
          <cylinderGeometry args={[0.048, 0.044, 0.014, 14]} />
          <meshStandardMaterial color="#4A3624" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.11, 0]} geometry={leafGeo} castShadow>
          <meshStandardMaterial vertexColors roughness={0.78} side={THREE.DoubleSide} />
        </mesh>
        {[
          { pos: [-0.018, 0.175, 0.014] as [number, number, number], rot: [0.18, 0.2, -0.15] as [number, number, number], s: 1.0 },
          { pos: [0.022, 0.185, -0.010] as [number, number, number], rot: [-0.14, 1.1, 0.22] as [number, number, number], s: 0.90 },
          { pos: [-0.004, 0.20, 0.020] as [number, number, number], rot: [0.24, 2.3, 0.10] as [number, number, number], s: 0.85 },
        ].map((fl, fi) => (
          <group key={fi} position={fl.pos}>
            <mesh position={[0, -0.034, 0]} rotation={[0, 0, fl.rot[2] * 0.5]}>
              <cylinderGeometry args={[0.0028, 0.004, 0.072, 8]} />
              <meshStandardMaterial color="#4C7434" roughness={0.80} />
            </mesh>
            <mesh rotation={fl.rot} scale={fl.s} geometry={daisyGeo}>
              <meshStandardMaterial vertexColors roughness={0.76} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Center-Left Small Herb Pot: Culinary Rosemary / Thyme Leaf Spray in Sage Ceramic */}
      <group position={[-width * 0.13, 0, 0.01]}>
        <mesh position={[0, 0.042, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.044, 0.034, 0.084, 16]} />
          <meshStandardMaterial
            map={craftAssets.matteCeramicGlaze.map}
            normalMap={craftAssets.matteCeramicGlaze.normalMap}
            roughnessMap={craftAssets.matteCeramicGlaze.roughnessMap}
            color="#98AA8E"
            roughness={0.82}
          />
        </mesh>
        <mesh position={[0, 0.088, 0]} scale={[0.92, 1.18, 0.92]} geometry={leafGeo} castShadow>
          <meshStandardMaterial vertexColors roughness={0.80} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Right Pot: Blush Mini Rosebud Spray in Warm Ivory Stoneware */}
      <group position={[width * 0.28, 0, 0]}>
        <mesh position={[0, 0.048, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.050, 0.038, 0.096, 18]} />
          <meshStandardMaterial
            map={craftAssets.matteCeramicGlaze.map}
            normalMap={craftAssets.matteCeramicGlaze.normalMap}
            roughnessMap={craftAssets.matteCeramicGlaze.roughnessMap}
            color="#E8DFCE"
            roughness={0.80}
          />
        </mesh>
        <mesh position={[0, 0.10, 0]} scale={0.95} geometry={leafGeo} castShadow>
          <meshStandardMaterial vertexColors roughness={0.78} side={THREE.DoubleSide} />
        </mesh>
        {[
          [-0.016, 0.165, 0.012],
          [0.018, 0.178, -0.008],
        ].map(([rx, ry, rz], ri) => (
          <mesh
            key={ri}
            position={[rx, ry, rz]}
            rotation={[0.25, ri * 1.4, -0.15]}
            scale={0.85}
            geometry={roseGeo}
          >
            <meshStandardMaterial color={ri === 0 ? '#F2B2C2' : '#FADAD4'} vertexColors roughness={0.76} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

/**
 * Climbing-Rose Wooden Garden Arch Gate (Dual Parallel Arches + Pergola Cross-Rungs + Spiral Woody Vine Stems!)
 */
const ClimbingRoseGardenArchGate: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  timberMat: THREE.Material;
  windTime: { value: number };
}> = ({ position, rotation = [0, 0, 0], timberMat, windTime }) => {
  const leafInstRef = useRef<THREE.InstancedMesh>(null);
  const { leafGeo, roseGeo, postGeo, vineStemLeftGeo, vineStemRightGeo } = useMemo(() => {
    const makeSpiralVine = (sideSign: number) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        if (t < 0.64) {
          const u = t / 0.64;
          const ang = u * Math.PI * 3.5;
          pts.push(
            new THREE.Vector3(
              sideSign * 0.70 + Math.cos(ang) * 0.055,
              0.22 + u * 1.76,
              Math.sin(ang) * 0.16
            )
          );
        } else {
          const u = (t - 0.64) / 0.36;
          const a = sideSign < 0 ? Math.PI - u * Math.PI * 0.55 : u * Math.PI * 0.55;
          pts.push(
            new THREE.Vector3(
              Math.cos(a) * 0.70,
              1.98 + Math.sin(a) * 0.70,
              Math.sin(u * Math.PI * 3.0) * 0.14
            )
          );
        }
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.011, 8, false);
    };
    return {
      leafGeo: createCitrusLeafGeometry(),
      roseGeo: createSculptedRoseBlossomGeometry(),
      postGeo: createBeveledBoxGeometry(0.075, 2.04, 0.075, 0.008, 0.006, 0.006, 2),
      vineStemLeftGeo: makeSpiralVine(-1),
      vineStemRightGeo: makeSpiralVine(1),
    };
  }, []);

  const roseBlossoms: Array<[number, number, number, string]> = useMemo(
    () => [
      [-0.70, 1.48, 0.12, '#F4A2B6'],
      [-0.68, 1.92, -0.10, '#FAD6DF'],
      [-0.44, 2.52, 0.12, '#EE88A0'],
      [-0.12, 2.66, -0.09, '#FFF6EA'],
      [0.18, 2.65, 0.10, '#F4A2B6'],
      [0.48, 2.48, -0.10, '#FAD6DF'],
      [0.68, 1.90, 0.11, '#EE88A0'],
      [0.70, 1.44, -0.10, '#FFF6EA'],
    ],
    []
  );

  const { gateLeafMat, gateRoseMats } = useMemo(() => {
    const lMat = createGardenBotanicalWindMat(windTime, {
      swayAmp: 0.013,
      radialPin: true,
      roughness: 0.54,
      emissive: '#4E7024',
      emissiveIntensity: 0.14,
      side: THREE.DoubleSide,
      cacheTag: 'gate-arch-leaf',
    });
    const palette = ['#F4A2B6', '#FAD6DF', '#EE88A0', '#FFF6EA'];
    const rMap: Record<string, THREE.MeshStandardMaterial> = {};
    palette.forEach((col, pi) => {
      rMap[col] = createGardenBotanicalWindMat(windTime, {
        swayAmp: 0.009,
        radialPin: true,
        color: col,
        vertexColors: true,
        roughness: 0.76,
        side: THREE.DoubleSide,
        cacheTag: `gate-rose-${pi}`,
      });
    });
    return { gateLeafMat: lMat, gateRoseMats: rMap };
  }, [windTime]);

  useLayoutEffect(() => {
    const inst = leafInstRef.current;
    if (!inst) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const greens = [0x38662a, 0x487a36, 0x5c9044, 0x2f5a24];
    let rng = 3030;
    const rand = () => {
      rng = (rng * 1664525 + 1013904223) >>> 0;
      return rng / 4294967296;
    };

    for (let i = 0; i < 150; i++) {
      let lx = 0;
      let ly = 0;
      let lz = 0;
      if (i < 42) {
        lx = -0.70 + (rand() - 0.5) * 0.12;
        ly = 0.45 + (i / 42) * 1.54;
        lz = (rand() - 0.5) * 0.34;
      } else if (i < 84) {
        lx = 0.70 + (rand() - 0.5) * 0.12;
        ly = 0.45 + ((i - 42) / 42) * 1.54;
        lz = (rand() - 0.5) * 0.34;
      } else {
        const a = ((i - 84) / 66) * Math.PI;
        const r = 0.70 + (rand() - 0.5) * 0.10;
        lx = Math.cos(a) * r;
        ly = 1.98 + Math.sin(a) * r;
        lz = (rand() - 0.5) * 0.32;
      }
      dummy.position.set(lx, ly, lz);
      dummy.rotation.set(rand() * 2.0, rand() * 3.14, rand() * 2.0);
      dummy.scale.setScalar(1.25 + rand() * 0.75);
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
      leafGeo.dispose();
      roseGeo.dispose();
      postGeo.dispose();
      vineStemLeftGeo.dispose();
      vineStemRightGeo.dispose();
      gateLeafMat.dispose();
      Object.values(gateRoseMats).forEach((m) => m.dispose());
    };
  }, [leafGeo, roseGeo, postGeo, vineStemLeftGeo, vineStemRightGeo, gateLeafMat, gateRoseMats]);

  return (
    <group position={position} rotation={rotation}>
      {/* Four Beveled Vertical Pergola Posts + Side Ladder Rungs */}
      {[-0.70, 0.70].map((px, pi) => (
        <React.Fragment key={pi}>
          <mesh position={[px, 1.02, -0.16]} geometry={postGeo} material={timberMat} castShadow />
          <mesh position={[px, 1.02, 0.16]} geometry={postGeo} material={timberMat} castShadow />
          {[0.45, 0.85, 1.25, 1.65].map((ry, ri) => (
            <mesh key={`rung-${ri}`} position={[px, ry, 0]} material={timberMat} castShadow>
              <boxGeometry args={[0.042, 0.036, 0.34]} />
            </mesh>
          ))}
        </React.Fragment>
      ))}
      {/* Dual Parallel Top Arches seated directly atop front & back post pairs (ZERO floating arch!) */}
      {[-0.16, 0.16].map((az, ai) => (
        <mesh key={`arch-${ai}`} position={[0, 1.98, az]} material={timberMat} castShadow>
          <torusGeometry args={[0.70, 0.038, 14, 36, Math.PI]} />
        </mesh>
      ))}
      {/* 7 Transverse Pergola Arch Cross-Slats tying front & back arches rigidly together */}
      {[0.12, 0.25, 0.38, 0.50, 0.62, 0.75, 0.88].map((t, ti) => {
        const ang = t * Math.PI;
        const rx = Math.cos(ang) * 0.70;
        const ry = 1.98 + Math.sin(ang) * 0.70;
        return (
          <mesh key={`slat-${ti}`} position={[rx, ry, 0]} rotation={[0, 0, ang - Math.PI * 0.5]} material={timberMat} castShadow>
            <boxGeometry args={[0.045, 0.035, 0.42]} />
          </mesh>
        );
      })}
      {/* Spiral Woody Rose Cane Stems climbing both sides into the arch */}
      <mesh geometry={vineStemLeftGeo} castShadow>
        <meshStandardMaterial color="#4A5A2E" roughness={0.82} />
      </mesh>
      <mesh geometry={vineStemRightGeo} castShadow>
        <meshStandardMaterial color="#4A5A2E" roughness={0.82} />
      </mesh>

      {/* 150 Organic Layered Climbing-Rose Leaves clinging tightly to posts & canes (GPU breeze sway!) */}
      <instancedMesh ref={leafInstRef} args={[leafGeo, gateLeafMat, 150]} castShadow />

      {/* Delicate Sculpted Multi-Petal Garden Roses tucked inside the Rose Leaves (GPU breeze sway!) */}
      {roseBlossoms.map(([rx, ry, rz, rcol], idx) => (
        <mesh
          key={idx}
          position={[rx, ry, rz]}
          rotation={[0.45 + (idx % 3) * 0.28, idx * 1.15, (idx % 2 === 0 ? 1 : -1) * 0.35]}
          scale={1.32 + (idx % 2) * 0.16}
          geometry={roseGeo}
          material={gateRoseMats[rcol]}
          castShadow
        />
      ))}

      {/* Half-Open Picket Garden Gate Leaf welcoming you toward the Creek */}
      <group position={[-0.66, 0.44, 0]} rotation={[0, 0.92, 0]}>
        <mesh position={[0.32, 0.24, 0]} material={timberMat} castShadow>
          <boxGeometry args={[0.64, 0.045, 0.035]} />
        </mesh>
        <mesh position={[0.32, -0.18, 0]} material={timberMat} castShadow>
          <boxGeometry args={[0.64, 0.045, 0.035]} />
        </mesh>
        {[0.06, 0.19, 0.32, 0.45, 0.58].map((gx, gi) => (
          <mesh key={gi} position={[gx, 0.05, 0.02]} material={timberMat} castShadow>
            <boxGeometry args={[0.055, 0.72, 0.022]} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

/**
 * Potted Rosemary & Blooming Dwarf Lemon Tree for Veranda Terracotta Planters (fills empty pots!)
 */
const PottedVerandaHerbBush: React.FC<{
  position: [number, number, number];
  potGeo: THREE.BufferGeometry;
  terracottaTex: THREE.Texture;
  windTime: { value: number };
}> = ({ position, potGeo, terracottaTex, windTime }) => {
  const leafGeo = useMemo(() => createCitrusLeafGeometry(), []);
  const leafWindMat = useMemo(
    () =>
      createGardenBotanicalWindMat(windTime, {
        swayAmp: 0.012,
        radialPin: true,
        roughness: 0.56,
        side: THREE.DoubleSide,
        cacheTag: 'veranda-citrus-bush',
      }),
    [windTime]
  );
  const leavesRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const inst = leavesRef.current;
    if (!inst) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const greens = [0x3d702c, 0x4f843a, 0x629848, 0x356226];
    for (let i = 0; i < 48; i++) {
      const a = i * 2.39996;
      const r = 0.04 + ((i % 7) / 7) * 0.20;
      const y = 0.44 + (i / 48) * 0.36;
      dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      dummy.rotation.set(0.45 + (i % 3) * 0.25, a, 0.25);
      dummy.scale.setScalar(1.3 + (i % 4) * 0.25);
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
      leafGeo.dispose();
      leafWindMat.dispose();
    };
  }, [leafGeo, leafWindMat]);

  return (
    <group position={position}>
      <mesh geometry={potGeo} castShadow receiveShadow>
        <meshStandardMaterial map={terracottaTex} roughness={0.86} />
      </mesh>
      <mesh position={[0, 0.39, 0]}>
        <cylinderGeometry args={[0.20, 0.18, 0.04, 16]} />
        <meshStandardMaterial color="#3E2C1E" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.56, 0]} castShadow>
        <cylinderGeometry args={[0.014, 0.022, 0.36, 8]} />
        <meshStandardMaterial color="#6D4A2E" roughness={0.85} />
      </mesh>
      <instancedMesh ref={leavesRef} args={[leafGeo, leafWindMat, 48]} castShadow />
      {[
        [0.10, 0.64, 0.08],
        [-0.09, 0.70, -0.06],
        [0.02, 0.74, -0.10],
      ].map(([lx, ly, lz], li) => (
        <mesh key={li} position={[lx, ly, lz]} scale={[0.9, 1.15, 0.9]}>
          <sphereGeometry args={[0.026, 10, 10]} />
          <meshPhysicalMaterial color="#F2CC46" roughness={0.44} clearcoat={0.14} envMapIntensity={0.32} />
        </mesh>
      ))}
    </group>
  );
};

/**
 * 升级法式田园弧形跨溪小木桥：
 * - 做旧原木弧形拱梁、扶手、X形田园护栏与石墩落岸
 * - 两侧栏杆螺旋缠绕盛开的粉色蔷薇花藤（多瓣粉/淡粉蔷薇 + 嫩绿叶簇）
 * - 桥头复古铸铁矮庭院灯（镂空灯罩 + 柔暖黄微光）
 */
const CedarCreekFootbridge: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  timberMat: THREE.Material;
  stoneMat: THREE.Material;
  roseGeo?: THREE.BufferGeometry;
  leafGeo?: THREE.BufferGeometry;
}> = ({ position, rotation = [0, 0, 0], timberMat, stoneMat, roseGeo, leafGeo }) => {
  const halfSpan = 1.56;
  const archRise = 0.42;
  const railHeight = 0.72;
  const archY = (x: number) => Math.cos((x / halfSpan) * Math.PI * 0.5) * archRise;
  const archSlope = (x: number) => -Math.sin((x / halfSpan) * Math.PI * 0.5) * (archRise * Math.PI * 0.5 / halfSpan);

  const { archBeamGeo, handrailGeo, lowerRailGeo, plankGeo, abutmentGeo, vineTubeGeos, vineBlooms } = useMemo(() => {
    const beamPts: THREE.Vector3[] = [];
    const railPts: THREE.Vector3[] = [];
    const lowerPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      const bx = THREE.MathUtils.lerp(-halfSpan, halfSpan, t);
      beamPts.push(new THREE.Vector3(bx, archY(bx), 0));
      const rx = THREE.MathUtils.lerp(-1.42, 1.42, t);
      railPts.push(new THREE.Vector3(rx, archY(rx) + railHeight, 0));
      lowerPts.push(new THREE.Vector3(rx, archY(rx) + 0.22, 0));
    }

    // 沿两侧弧形栏杆螺旋缠绕的蔷薇木质花藤
    const vines: THREE.TubeGeometry[] = [];
    const blooms: Array<{ p: [number, number, number]; r: [number, number, number]; s: number; col: string; isLeaf: boolean }> = [];
    const rosePalette = ['#F497B6', '#FAD0DF', '#EC789E', '#FCE2EA'];

    [-0.58, 0.58].forEach((bz, sideIdx) => {
      const vPts: THREE.Vector3[] = [];
      for (let k = 0; k <= 34; k++) {
        const u = k / 34;
        const vx = THREE.MathUtils.lerp(-1.36, 1.36, u);
        const coil = u * Math.PI * 7.5 + sideIdx * 1.4;
        const vy = archY(vx) + railHeight - 0.04 + Math.sin(coil) * 0.085;
        const vz = bz + Math.cos(coil) * 0.055;
        vPts.push(new THREE.Vector3(vx, vy, vz));

        if (k > 1 && k < 33) {
          blooms.push({
            p: [vx, vy + 0.01, vz + (sideIdx === 0 ? -0.025 : 0.025)],
            r: [Math.sin(coil) * 0.45, k * 0.9, Math.cos(coil) * 0.35],
            s: 0.72 + (k % 3) * 0.14,
            col: '#4C8B3E',
            isLeaf: true,
          });
          if (k % 2 === 0) {
            blooms.push({
              p: [vx + Math.sin(k * 1.7) * 0.03, vy + 0.03 + Math.cos(coil) * 0.025, vz + (sideIdx === 0 ? -0.04 : 0.04)],
              r: [0.25 * Math.sin(k), k * 1.3, 0.22 * Math.cos(k)],
              s: 1.05 + (k % 3) * 0.22,
              col: rosePalette[(k + sideIdx) % rosePalette.length],
              isLeaf: false,
            });
          }
        }
      }
      vines.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vPts), 40, 0.012, 7, false));
    });

    return {
      archBeamGeo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(beamPts), 32, 0.052, 16, false),
      handrailGeo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), 32, 0.030, 16, false),
      lowerRailGeo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lowerPts), 28, 0.019, 12, false),
      plankGeo: createBeveledBoxGeometry(0.172, 0.036, 1.28, 0.008, 0.004, 0.004, 2),
      abutmentGeo: createBeveledBoxGeometry(0.34, 0.32, 1.42, 0.024, 0.012, 0.012, 2),
      vineTubeGeos: vines,
      vineBlooms: blooms,
    };
  }, []);

  useEffect(() => {
    return () => {
      archBeamGeo.dispose();
      handrailGeo.dispose();
      lowerRailGeo.dispose();
      plankGeo.dispose();
      abutmentGeo.dispose();
      vineTubeGeos.forEach((g) => g.dispose());
    };
  }, [archBeamGeo, handrailGeo, lowerRailGeo, plankGeo, abutmentGeo, vineTubeGeos]);

  return (
    <group position={position} rotation={rotation}>
      {/* Grounded Mossy Stone Bridge Abutments anchoring both ends cleanly into the creek banks */}
      {[-1.56, 1.56].map((ax, ai) => (
        <mesh key={`abut-${ai}`} position={[ax, -0.10, 0]} geometry={abutmentGeo} material={stoneMat} castShadow receiveShadow />
      ))}

      {[-0.58, 0.58].map((bz, zi) => (
        <React.Fragment key={zi}>
          <mesh position={[0, 0, bz]} geometry={archBeamGeo} material={timberMat} castShadow />
          <mesh position={[0, 0, bz]} geometry={handrailGeo} material={timberMat} castShadow />
          <mesh position={[0, 0, bz]} geometry={lowerRailGeo} material={timberMat} castShadow />
          {/* Closed spherical end-caps on handrail tubes */}
          {[-1.42, 1.42].map((ex, ei) => (
            <mesh key={`rcap-${ei}`} position={[ex, archY(ex) + railHeight, bz]} material={timberMat}>
              <sphereGeometry args={[0.032, 14, 12]} />
            </mesh>
          ))}
          {/* X 形法式乡村木交叉护栏 */}
          {[-1.06, -0.35, 0.35, 1.06].map((cx, ci) => {
            const cy = archY(cx) + 0.46;
            return (
              <group key={`xbrace-${ci}`} position={[cx, cy, bz]}>
                <mesh rotation={[0, 0, 0.68]} material={timberMat} castShadow>
                  <boxGeometry args={[0.72, 0.024, 0.024]} />
                </mesh>
                <mesh rotation={[0, 0, -0.68]} material={timberMat} castShadow>
                  <boxGeometry args={[0.72, 0.024, 0.024]} />
                </mesh>
              </group>
            );
          })}
          {[-1.42, -0.71, 0.0, 0.71, 1.42].map((px, pi) => {
            const baseY = archY(px);
            const isEndPost = pi === 0 || pi === 4;
            return (
              <group key={pi} position={[px, baseY, bz]}>
                <mesh position={[0, railHeight * 0.5, 0]} material={timberMat} castShadow>
                  <cylinderGeometry args={[0.030, 0.035, railHeight + 0.05, 16]} />
                </mesh>
                <mesh position={[0, railHeight + 0.036, 0]} material={timberMat}>
                  <sphereGeometry args={[isEndPost ? 0.044 : 0.034, 14, 12]} />
                </mesh>
              </group>
            );
          })}
        </React.Fragment>
      ))}

      {/* 缠绕在桥栏杆上的盛开粉色蔷薇花藤与嫩叶 */}
      {vineTubeGeos.map((vg, vi) => (
        <mesh key={`bvine-${vi}`} geometry={vg} castShadow>
          <meshStandardMaterial color="#446C34" roughness={0.86} />
        </mesh>
      ))}
      {vineBlooms.map((b, bi) => (
        <mesh
          key={`bbloom-${bi}`}
          position={b.p}
          rotation={b.r}
          scale={b.isLeaf ? [b.s * 0.9, b.s * 0.9, b.s * 0.9] : [b.s * 0.85, b.s * 0.85, b.s * 0.85]}
          geometry={b.isLeaf ? leafGeo : roseGeo}
          castShadow
        >
          {!b.isLeaf && !roseGeo && <dodecahedronGeometry args={[0.042, 0]} />}
          {b.isLeaf && !leafGeo && <sphereGeometry args={[0.045, 8, 6]} />}
          <meshStandardMaterial color={b.col} roughness={0.74} />
        </mesh>
      ))}

      {/* 桥头复古铸铁矮庭院灯（立于桥头一侧石墩旁，带柔暖黄微光，清晰不被底栏遮挡） */}
      <group position={[-1.62, -0.06, 0.76]}>
        {/* 石基座与铸铁八角灯柱 */}
        <mesh position={[0, 0.08, 0]} material={stoneMat} castShadow receiveShadow>
          <cylinderGeometry args={[0.12, 0.15, 0.18, 12]} />
        </mesh>
        <mesh position={[0, 0.48, 0]} castShadow>
          <cylinderGeometry args={[0.028, 0.044, 0.72, 12]} />
          <meshStandardMaterial color="#2D302E" metalness={0.55} roughness={0.48} />
        </mesh>
        <mesh position={[0, 0.84, 0]} castShadow>
          <cylinderGeometry args={[0.095, 0.055, 0.04, 6]} />
          <meshStandardMaterial color="#2D302E" metalness={0.55} roughness={0.46} />
        </mesh>
        {/* 暖黄磨砂发光灯芯 */}
        <mesh position={[0, 0.95, 0]}>
          <cylinderGeometry args={[0.072, 0.056, 0.18, 6]} />
          <meshStandardMaterial color="#FFF3CC" emissive="#FFBA4A" emissiveIntensity={1.25} roughness={0.28} />
        </mesh>
        {/* 铸铁镂空棱框与伞状复古灯帽 */}
        {[0, 1, 2, 3, 4, 5].map((ri) => {
          const ra = (ri / 6) * Math.PI * 2;
          return (
            <mesh key={`rib-${ri}`} position={[Math.cos(ra) * 0.072, 0.95, Math.sin(ra) * 0.072]}>
              <cylinderGeometry args={[0.006, 0.006, 0.19, 6]} />
              <meshStandardMaterial color="#282B29" metalness={0.58} roughness={0.44} />
            </mesh>
          );
        })}
        <mesh position={[0, 1.09, 0]} castShadow>
          <coneGeometry args={[0.135, 0.11, 6]} />
          <meshStandardMaterial color="#2D302E" metalness={0.55} roughness={0.46} />
        </mesh>
        <mesh position={[0, 1.16, 0]}>
          <sphereGeometry args={[0.024, 10, 8]} />
          <meshStandardMaterial color="#3A3C38" metalness={0.58} roughness={0.42} />
        </mesh>
      </group>

      {Array.from({ length: 16 }).map((_, i) => {
        const t = (i / 15) * 2 - 1;
        const px = t * 1.46;
        const py = archY(px) + 0.044;
        const slope = archSlope(px);
        return (
          <mesh
            key={i}
            position={[px, py, 0]}
            rotation={[0, 0, slope]}
            geometry={plankGeo}
            material={timberMat}
            castShadow
            receiveShadow
          />
        );
      })}
    </group>
  );
};

/**
 * 溪流清澈水底游动的 4 条橘红色小锦鲤（带流线鱼身、奶白花斑与实时正弦摆尾动画）
 */
const CreekKoiFish: React.FC<{ curve: THREE.CatmullRomCurve3 }> = ({ curve }) => {
  const fishRefs = useRef<Array<THREE.Group | null>>([]);
  const tailRefs = useRef<Array<THREE.Mesh | null>>([]);

  const koiSpecs = useMemo(
    () => [
      { tBase: 0.34, tSpan: 0.11, speed: 0.18, lateral: -0.26, scale: 1.05, col: '#F25C2A', spot: '#FFF8EE', phase: 0.2 },
      { tBase: 0.42, tSpan: 0.10, speed: 0.15, lateral: 0.28, scale: 0.92, col: '#F57A34', spot: '#FFF4E2', phase: 1.9 },
      { tBase: 0.49, tSpan: 0.12, speed: 0.16, lateral: -0.14, scale: 1.12, col: '#E84A24', spot: '#FFFFFF', phase: 3.4 },
      { tBase: 0.56, tSpan: 0.09, speed: 0.19, lateral: 0.22, scale: 0.86, col: '#F68B3C', spot: '#FFF6E8', phase: 5.1 },
    ],
    []
  );

  const upVec = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const tmpPt = useMemo(() => new THREE.Vector3(), []);
  const tmpTan = useMemo(() => new THREE.Vector3(), []);
  const tmpSide = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    koiSpecs.forEach((k, idx) => {
      const grp = fishRefs.current[idx];
      if (!grp) return;
      // 柔和往返巡游曲线，保持在镜头最清晰的中近景清澈河段
      const swimSin = Math.sin(time * k.speed + k.phase);
      const swimDir = Math.cos(time * k.speed + k.phase) >= 0 ? 1 : -1;
      const t = THREE.MathUtils.clamp(k.tBase + swimSin * k.tSpan, 0.24, 0.68);
      curve.getPointAt(t, tmpPt);
      curve.getTangentAt(t, tmpTan).normalize();
      tmpSide.crossVectors(upVec, tmpTan).normalize();

      const swayOffset = Math.sin(time * 1.4 + k.phase) * 0.16;
      const offset = k.lateral + swayOffset;
      grp.position.set(
        tmpPt.x + tmpSide.x * offset,
        -0.412 + Math.sin(time * 2.0 + k.phase) * 0.004,
        tmpPt.z + tmpSide.z * offset
      );
      const yaw = Math.atan2(tmpTan.x * swimDir, tmpTan.z * swimDir);
      grp.rotation.set(0, yaw + Math.sin(time * 5.2 + k.phase) * 0.08, 0);

      const tail = tailRefs.current[idx];
      if (tail) {
        tail.rotation.y = Math.sin(time * 8.5 + k.phase) * 0.42;
      }
    });
  });

  return (
    <group>
      {koiSpecs.map((k, idx) => (
        <group
          key={`koi-${idx}`}
          ref={(el) => {
            fishRefs.current[idx] = el;
          }}
          scale={k.scale}
        >
          {/* 流线型锦鲤躯干 */}
          <mesh scale={[0.38, 0.24, 1.0]} castShadow>
            <sphereGeometry args={[0.13, 14, 10]} />
            <meshStandardMaterial color={k.col} roughness={0.45} />
          </mesh>
          {/* 奶白锦鲤背斑（红白相间更有辨识度） */}
          <mesh position={[0, 0.016, 0.02]} scale={[0.34, 0.18, 0.46]}>
            <sphereGeometry args={[0.10, 10, 8]} />
            <meshStandardMaterial color={k.spot} roughness={0.48} />
          </mesh>
          {/* 左右胸鳍 */}
          <mesh position={[-0.048, -0.005, 0.025]} rotation={[0.1, 0.55, 0.15]} scale={[1.0, 0.18, 0.55]}>
            <sphereGeometry args={[0.044, 8, 6]} />
            <meshStandardMaterial color="#FFF4E4" roughness={0.5} />
          </mesh>
          <mesh position={[0.048, -0.005, 0.025]} rotation={[0.1, -0.55, -0.15]} scale={[1.0, 0.18, 0.55]}>
            <sphereGeometry args={[0.044, 8, 6]} />
            <meshStandardMaterial color="#FFF4E4" roughness={0.5} />
          </mesh>
          {/* 摇曳薄纱尾鳍 */}
          <mesh
            ref={(el) => {
              tailRefs.current[idx] = el;
            }}
            position={[0, 0, -0.125]}
            rotation={[Math.PI * 0.5, 0, 0]}
          >
            <coneGeometry args={[0.046, 0.11, 4]} />
            <meshStandardMaterial color="#FFD8BC" roughness={0.55} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/**
 * Bi-Fold French Cottage Wood & Tiffany-Bordered Glass Door Pair (Swung Wide Open into the Veranda!)
 */
const OpenBiFoldCottageDoors: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  foldDirection: 1 | -1;
  frameMat: THREE.Material;
  glassMat: THREE.Material;
}> = ({ position, rotation = [0, 0, 0], foldDirection, frameMat, glassMat }) => {
  return (
    <group position={position} rotation={rotation}>
      <group rotation={[0, foldDirection * 1.22, 0]}>
        <group position={[foldDirection * 0.36, 1.38, 0]}>
          <mesh position={[0, -0.98, 0]} material={frameMat} castShadow>
            <boxGeometry args={[0.70, 0.78, 0.045]} />
          </mesh>
          <mesh position={[-0.32, 0, 0]} material={frameMat} castShadow>
            <boxGeometry args={[0.065, 2.76, 0.045]} />
          </mesh>
          <mesh position={[0.32, 0, 0]} material={frameMat} castShadow>
            <boxGeometry args={[0.065, 2.76, 0.045]} />
          </mesh>
          <mesh position={[0, 1.35, 0]} material={frameMat} castShadow>
            <boxGeometry args={[0.70, 0.065, 0.045]} />
          </mesh>
          <mesh position={[0, 0.36, 0]} material={glassMat}>
            <planeGeometry args={[0.58, 1.92]} />
          </mesh>
        </group>

        <group position={[foldDirection * 0.72, 0, 0]} rotation={[0, -foldDirection * 2.18, 0]}>
          <group position={[foldDirection * 0.35, 1.38, 0]}>
            <mesh position={[0, -0.98, 0]} material={frameMat} castShadow>
              <boxGeometry args={[0.68, 0.78, 0.045]} />
            </mesh>
            <mesh position={[-0.31, 0, 0]} material={frameMat}>
              <boxGeometry args={[0.06, 2.76, 0.045]} />
            </mesh>
            <mesh position={[0.31, 0, 0]} material={frameMat}>
              <boxGeometry args={[0.06, 2.76, 0.045]} />
            </mesh>
            <mesh position={[0, 1.35, 0]} material={frameMat}>
              <boxGeometry args={[0.68, 0.065, 0.045]} />
            </mesh>
            <mesh position={[0, 0.36, 0]} material={glassMat}>
              <planeGeometry args={[0.56, 1.92]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
};

/**
 * 同款法式彩绘椭圆花窗折叠木屏风 + 黑色铁杆白色蕾丝纱帘
 * 完美适配东/南玻璃廊柱各敞空跨间（图 2 左右框、图 3 红框、图 4 红框），透光不闷堵且保持花房造型 100% 统一！
 */
const FrenchStainedFoldingScreen: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  panels?: 2 | 3;
  foldAngle?: number;
  withCurtain?: boolean;
  frameMat: THREE.Material;
  glassMat: THREE.Material;
  ironMat: THREE.Material;
  curtainMat: THREE.Material;
}> = ({
  position,
  rotation = [0, 0, 0],
  panels = 2,
  foldAngle = 0.26,
  withCurtain = true,
  frameMat,
  glassMat,
  ironMat,
  curtainMat,
}) => {
  const pw = 0.68;
  const dx = Math.cos(foldAngle * 0.5) * pw;
  return (
    <group position={position} rotation={rotation}>
      {Array.from({ length: panels }).map((_, pi) => {
        const sgn = pi % 2 === 0 ? 1 : -1;
        const px = (pi - (panels - 1) * 0.5) * (dx * 0.94);
        const pz = (pi % 2 === 0 ? 1 : -1) * Math.sin(foldAngle * 0.5) * (pw * 0.28);
        return (
          <group key={`scr-p-${pi}`} position={[px, 1.38, pz]} rotation={[0, sgn * foldAngle * 0.5, 0]}>
            <mesh position={[0, -0.98, 0]} material={frameMat} castShadow>
              <boxGeometry args={[pw, 0.78, 0.045]} />
            </mesh>
            <mesh position={[-pw * 0.455, 0, 0]} material={frameMat} castShadow>
              <boxGeometry args={[0.06, 2.76, 0.045]} />
            </mesh>
            <mesh position={[pw * 0.455, 0, 0]} material={frameMat} castShadow>
              <boxGeometry args={[0.06, 2.76, 0.045]} />
            </mesh>
            <mesh position={[0, 1.35, 0]} material={frameMat} castShadow>
              <boxGeometry args={[pw, 0.065, 0.045]} />
            </mesh>
            <mesh position={[0, 0.36, 0]} material={glassMat}>
              <planeGeometry args={[pw - 0.12, 1.92]} />
            </mesh>
          </group>
        );
      })}
      {withCurtain && (
        <group position={[0, 0, -0.14]}>
          <mesh position={[0, 2.86, 0]} rotation={[0, 0, Math.PI / 2]} material={ironMat}>
            <cylinderGeometry args={[0.010, 0.010, panels * dx * 0.96, 10]} />
          </mesh>
          <mesh position={[-(panels - 1) * 0.18, 1.44, -0.02]} material={curtainMat} raycast={() => null}>
            <planeGeometry args={[0.42, 2.78, 10, 16]} />
          </mesh>
        </group>
      )}
    </group>
  );
};

/**
 * Open-Legged Weathered Timber & Distressed Cream-Plank Baking Table ([0, 0, 0])
 * High-Craft 28-seg Turned Balusters, Beveled Oak Slabs, Hollow Lathe Stoneware Bowls & Forged Brass Corner Brackets!
 */
const OpenTrestleArtisanBakingTable: React.FC<{
  burnerActive: boolean;
  beadboardMat: THREE.Material;
  agedTimberMat: THREE.Material;
}> = ({ burnerActive, beadboardMat, agedTimberMat }) => {
  const craftAssets = useMemo(() => getCottageCraftAssets(), []);

  const {
    apronFrameGeo,
    oakTopFrameGeo,
    lowerShelfGeo,
    marbleSlabGeo,
    bracketGeo,
    drapedTableclothGeo,
    legGeo,
    flourSackGeo,
    towelGeo,
    fruitBasketGeo,
    bannetonGeo,
    bowlLargeGeo,
    bowlMedGeo,
    bowlSmallGeo,
  } = useMemo(() => {
    const legPts = [
      new THREE.Vector2(0.0001, 0),
      new THREE.Vector2(0.040, 0),
      new THREE.Vector2(0.046, 0.08),
      new THREE.Vector2(0.035, 0.22),
      new THREE.Vector2(0.052, 0.48),
      new THREE.Vector2(0.042, 0.72),
      new THREE.Vector2(0.056, 0.84),
      new THREE.Vector2(0.0001, 0.84),
    ];
    const lGeo = createSeamlessLatheGeometry(legPts, 48);

    // Sculpted Pinched-Neck Tied Linen Flour Sack / Striped Ceramic Jar (High-Res 72-seg Smooth Profile!)
    const sackPts = [
      new THREE.Vector2(0.0001, 0),
      new THREE.Vector2(0.140, 0),
      new THREE.Vector2(0.165, 0.024),
      new THREE.Vector2(0.178, 0.068),
      new THREE.Vector2(0.176, 0.118),
      new THREE.Vector2(0.166, 0.168),
      new THREE.Vector2(0.142, 0.214),
      new THREE.Vector2(0.108, 0.254),
      new THREE.Vector2(0.066, 0.284),
      new THREE.Vector2(0.060, 0.296),
      new THREE.Vector2(0.078, 0.324),
      new THREE.Vector2(0.086, 0.340),
      new THREE.Vector2(0.0001, 0.332),
    ];
    const sGeo = createSeamlessLatheGeometry(sackPts, 72);

    return {
      apronFrameGeo: createBeveledBoxGeometry(2.96, 0.11, 1.14, 0.016, 0.004, 0.004, 2),
      oakTopFrameGeo: createBeveledBoxGeometry(3.24, 0.056, 1.36, 0.026, 0.006, 0.006, 3),
      lowerShelfGeo: createBeveledBoxGeometry(2.82, 0.034, 0.98, 0.018, 0.005, 0.005, 2),
      marbleSlabGeo: ensureSecondaryUv(createBeveledBoxGeometry(2.98, 0.026, 1.16, 0.020, 0.004, 0.004, 3)),
      bracketGeo: createBeveledBoxGeometry(0.052, 0.086, 0.052, 0.006, 0.004, 0.004, 2),
      drapedTableclothGeo: createDrapedTableclothGeometry(1.634, 0.694, 0.212, 0.036, 88, 48),
      legGeo: lGeo,
      flourSackGeo: sGeo,
      towelGeo: createBeveledBoxGeometry(0.34, 0.026, 0.26, 0.014, 0.008, 0.008, 3),
      fruitBasketGeo: createHollowVesselLatheGeo(0.16, 0.20, 0.22, 0.165, 0.012, 64),
      bannetonGeo: createHollowVesselLatheGeo(0.105, 0.125, 0.135, 0.095, 0.010, 64),
      bowlLargeGeo: createHollowVesselLatheGeo(0.112, 0.165, 0.185, 0.148, 0.009, 64),
      bowlMedGeo: createHollowVesselLatheGeo(0.088, 0.132, 0.145, 0.112, 0.008, 64),
      bowlSmallGeo: createHollowVesselLatheGeo(0.066, 0.096, 0.106, 0.086, 0.007, 64),
    };
  }, []);

  const {
    bracketMicro,
    bracketMat,
    tableclothTex,
    linenNormalTex,
    tableclothMat,
    laceBreezeTime,
    oakSlabMat,
    shelfAoTex,
    shelfAoMat,
  } = useMemo(() => {
    const bm = createMicroSurfaceMaps(0.28, 0.08, true, 829);
    const bMat = enhanceWithExtremeMicroCraft(
      new THREE.MeshPhysicalMaterial({
        color: '#C29648',
        bumpMap: bm.bumpMap,
        bumpScale: 0.004,
        roughnessMap: bm.roughnessMap,
        metalness: 0.65,
        roughness: 0.52,
        anisotropy: 0.25,
        envMapIntensity: 0.36,
      }),
      { boxProjectedIBL: true, detailKind: 'brushed_metal', detailStrength: 0.10, cacheTag: 'table-brass-bracket' }
    );
    const tcTex = createPastoralTableclothTexture();
    const lnNorm = createLinenFabricNormalMap();
    const breezeTime = { value: 0 };
    const tcMat = new THREE.MeshPhysicalMaterial({
      map: tcTex,
      normalMap: lnNorm,
      normalScale: new THREE.Vector2(0.13, 0.13),
      color: '#FFFFFF',
      roughness: 0.90,
      metalness: 0.0,
      sheen: 0.56,
      sheenColor: '#FFFBF0',
      sheenRoughness: 0.74,
      side: THREE.DoubleSide,
    });
    // 注入「柔风裙摆微动 + 窗棂格栅影与摇曳斑驳树叶暖阳斜光」吉卜力绘本着色器！
    tcMat.customProgramCacheKey = () => 'ghibli-draped-linen-dappled-sun-v1';
    tcMat.onBeforeCompile = (shader) => {
      shader.uniforms.uClothTime = breezeTime;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          /* glsl */ `
          #include <common>
          attribute float aClothDrape;
          uniform float uClothTime;
          varying vec3 vClothWorldPos;
          varying float vClothDrape;
          `
        )
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `
          #include <begin_vertex>
          {
            // 仅轻拂自然垂坠的桌布裙摆，保持桌面道具区 0 位移零穿模！
            float swayMask = smoothstep(0.18, 0.95, aClothDrape);
            float w1 = sin(uClothTime * 1.35 + position.x * 3.1 + position.z * 2.4) * 0.0055;
            float w2 = cos(uClothTime * 2.05 + position.x * 5.2 - position.z * 4.1) * 0.0024;
            vec2 outDir = normalize(vec2(position.x * 0.45, position.z) + vec2(1e-4));
            transformed.x += outDir.x * (w1 + w2) * swayMask;
            transformed.z += outDir.y * (w1 + w2) * swayMask;
            transformed.y += sin(uClothTime * 1.15 + position.x * 2.5) * 0.0018 * swayMask;
          }
          `
        )
        .replace(
          '#include <worldpos_vertex>',
          /* glsl */ `
          #include <worldpos_vertex>
          vClothWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vClothDrape = aClothDrape;
          `
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `
          #include <common>
          uniform float uClothTime;
          varying vec3 vClothWorldPos;
          varying float vClothDrape;

          float clothHash21(vec2 p) {
            p = fract(p * vec2(127.1, 311.7));
            p += dot(p, p + 34.5);
            return fract(p.x * p.y);
          }

          float clothNoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(clothHash21(i), clothHash21(i + vec2(1.0, 0.0)), u.x),
              mix(clothHash21(i + vec2(0.0, 1.0)), clothHash21(i + vec2(1.0, 1.0)), u.x),
              u.y
            );
          }
          `
        )
        .replace(
          '#include <color_fragment>',
          /* glsl */ `
          #include <color_fragment>
          {
            // 1) 窗棂斜向光格（32° 普罗旺斯午后暖阳穿过花房落地窗棂投射到白桌布上）
            vec2 wp = vClothWorldPos.xz;
            float ang = 0.56;
            mat2 rotSun = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
            vec2 sp = rotSun * (wp + vec2(0.18, -0.05));
            float barX = smoothstep(0.035, 0.105, abs(fract(sp.x * 0.92) - 0.5));
            float barY = smoothstep(0.030, 0.095, abs(fract(sp.y * 1.12) - 0.5));
            float mullionLight = 0.34 + 0.66 * (barX * barY);

            // 2) 随微风轻柔摇曳的斑驳树叶剪影（Dappled Tree Shadows）
            vec2 leafDrift1 = vec2(sin(uClothTime * 0.55) * 0.08, cos(uClothTime * 0.44) * 0.06);
            vec2 leafDrift2 = vec2(cos(uClothTime * 0.85) * 0.05, sin(uClothTime * 0.72) * 0.05);
            float nMacro = clothNoise(sp * 1.65 + leafDrift1);
            float nLeaves = clothNoise(sp * 3.85 + leafDrift2) * 0.6 + clothNoise(sp * 6.5 - leafDrift1 * 1.3) * 0.4;
            float dappleOpen = smoothstep(0.30, 0.72, mix(nMacro, nLeaves, 0.58));

            float sunPattern = clamp(mullionLight * (0.42 + 0.58 * dappleOpen), 0.0, 1.0);

            // 3) 温润吉卜力冷暖光影：树影呈清透浅薰衣草蓝灰、受光斑呈午后蜂蜜暖金，裙摆下部柔和自带折褶影
            vec3 shadowTint = vec3(0.835, 0.852, 0.905);
            vec3 sunlitTint = vec3(1.055, 1.022, 0.935);
            vec3 lightMod = mix(shadowTint, sunlitTint, sunPattern);
            float skirtSoftShade = mix(1.0, 0.935, smoothstep(0.25, 1.0, vClothDrape));
            diffuseColor.rgb *= lightMod * skirtSoftShade;
          }
          `
        );
    };
    const oSlabMat = enhanceWithExtremeMicroCraft(
      new THREE.MeshPhysicalMaterial({
        map: craftAssets.wideOakTable.map,
        normalMap: craftAssets.wideOakTable.normalMap,
        normalScale: MARBLE_NORMAL_SCALE,
        roughnessMap: craftAssets.wideOakTable.roughnessMap,
        color: '#DDB686',
        roughness: 0.72,
        clearcoat: 0.08,
        clearcoatRoughness: 0.36,
        clearcoatNormalMap: craftAssets.wideOakTable.normalMap,
        clearcoatNormalScale: MARBLE_NORMAL_SCALE,
        envMapIntensity: 0.34,
      }),
      { boxProjectedIBL: true, detailKind: 'wood', detailStrength: 0.16, cacheTag: 'baking-table-oak-slab' }
    );
    const aoCanvas = document.createElement('canvas');
    aoCanvas.width = aoCanvas.height = 128;
    const ctx = aoCanvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
    grad.addColorStop(0, 'rgba(34, 20, 10, 0.56)');
    grad.addColorStop(0.65, 'rgba(34, 20, 10, 0.24)');
    grad.addColorStop(1, 'rgba(34, 20, 10, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const aoTex = new THREE.CanvasTexture(aoCanvas);
    const aoMat = new THREE.MeshBasicMaterial({
      map: aoTex,
      transparent: true,
      depthWrite: false,
    });
    return {
      bracketMicro: bm,
      bracketMat: bMat,
      tableclothTex: tcTex,
      linenNormalTex: lnNorm,
      tableclothMat: tcMat,
      laceBreezeTime: breezeTime,
      oakSlabMat: oSlabMat,
      shelfAoTex: aoTex,
      shelfAoMat: aoMat,
    };
  }, [craftAssets]);

  useFrame(({ clock }) => {
    laceBreezeTime.value = clock.getElapsedTime();
  });

  useEffect(() => {
    return () => {
      apronFrameGeo.dispose();
      oakTopFrameGeo.dispose();
      lowerShelfGeo.dispose();
      marbleSlabGeo.dispose();
      bracketGeo.dispose();
      drapedTableclothGeo.dispose();
      legGeo.dispose();
      flourSackGeo.dispose();
      towelGeo.dispose();
      fruitBasketGeo.dispose();
      bannetonGeo.dispose();
      bowlLargeGeo.dispose();
      bowlMedGeo.dispose();
      bowlSmallGeo.dispose();
      bracketMicro.bumpMap.dispose();
      bracketMicro.roughnessMap.dispose();
      bracketMat.dispose();
      tableclothTex.dispose();
      linenNormalTex.dispose();
      tableclothMat.dispose();
      oakSlabMat.dispose();
      shelfAoTex.dispose();
      shelfAoMat.dispose();
    };
  }, [
    apronFrameGeo,
    oakTopFrameGeo,
    lowerShelfGeo,
    marbleSlabGeo,
    bracketGeo,
    drapedTableclothGeo,
    legGeo,
    flourSackGeo,
    towelGeo,
    fruitBasketGeo,
    bannetonGeo,
    bowlLargeGeo,
    bowlMedGeo,
    bowlSmallGeo,
    bracketMicro,
    bracketMat,
    tableclothTex,
    linenNormalTex,
    tableclothMat,
    oakSlabMat,
    shelfAoTex,
    shelfAoMat,
  ]);

  return (
    <group position={[0, 0, 0]}>
      {[-1.38, 1.38].map((lx, xi) =>
        [-0.50, 0.50].map((lz, zi) => (
          <mesh key={`${xi}-${zi}`} position={[lx, 0, lz]} geometry={legGeo} material={agedTimberMat} castShadow receiveShadow />
        ))
      )}

      {/* Warm Reclaimed Honey-Oak Lower Shelf with Tactile Hollow Baskets, Flour Sack, Towels & Grounded Nested Bowls! */}
      <group position={[0, 0.22, 0]}>
        <mesh position={[0, 0.015, 0]} geometry={lowerShelfGeo} castShadow receiveShadow>
          <meshPhysicalMaterial
            map={craftAssets.wideOakTable.map}
            normalMap={craftAssets.wideOakTable.normalMap}
            normalScale={OAK_NORMAL_SCALE}
            roughnessMap={craftAssets.wideOakTable.roughnessMap}
            color="#CEA070"
            roughness={0.78}
            clearcoat={0.05}
            clearcoatRoughness={0.38}
            envMapIntensity={0.28}
          />
        </mesh>

        {/* Soft Contact AO Shadows directly beneath all 4 lower-shelf prop clusters */}
        {[
          [-0.92, 0.04, 0.50],
          [-0.22, -0.04, 0.44],
          [0.38, 0.08, 0.48],
          [0.98, 0.02, 0.44],
        ].map(([ax, az, as], ai) => (
          <mesh key={`sao-${ai}`} position={[ax, 0.0326, az]} rotation={[-Math.PI / 2, 0, 0]} material={shelfAoMat} raycast={() => null}>
            <planeGeometry args={[as, as * 0.85]} />
          </mesh>
        ))}

        {/* Hollow Thick-Walled Woven Rattan Orchard Fruit Basket with Grounded Fruits on Linen Liner! */}
        <group position={[-0.92, 0.032, 0.04]}>
          <mesh geometry={fruitBasketGeo} castShadow receiveShadow>
            <meshPhysicalMaterial
              map={craftAssets.wovenRattan.map}
              normalMap={craftAssets.wovenRattan.normalMap}
              normalScale={RUBBLE_NORMAL_SCALE}
              roughnessMap={craftAssets.wovenRattan.roughnessMap}
              roughness={0.96}
              sheen={0.30}
              sheenColor="#F4DCB0"
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Soft Linen Basket Liner Cushion supporting orchard fruit pile */}
          <mesh position={[0, 0.048, 0]}>
            <cylinderGeometry args={[0.165, 0.148, 0.068, 24]} />
            <meshPhysicalMaterial color="#F3E8D4" roughness={0.92} sheen={0.45} />
          </mesh>
          {[
            [-0.072, 0.118, 0.042, '#8CB842'],
            [0.065, 0.118, 0.048, '#D84836'],
            [0.002, 0.120, -0.056, '#E8882C'],
            [-0.058, 0.116, -0.048, '#D84836'],
            [0.068, 0.116, -0.032, '#8CB842'],
            [-0.015, 0.166, 0.018, '#92C246'],
            [0.055, 0.160, -0.012, '#DF3E30'],
          ].map(([ax, ay, az, acol], oi) => (
            <mesh key={oi} position={[ax as number, ay as number, az as number]} castShadow>
              <sphereGeometry args={[0.044, 16, 12]} />
              <meshPhysicalMaterial color={acol as string} roughness={0.44} clearcoat={0.14} envMapIntensity={0.32} />
            </mesh>
          ))}
        </group>

        {/* Vintage Printed French Mill Belgian Linen Flour Sack (`MOULIN DU JARDIN · FARINE T55`) */}
        <group position={[-0.22, 0.032, -0.04]} rotation={[0, 0.18, 0]}>
          <mesh geometry={flourSackGeo} castShadow receiveShadow>
            <meshPhysicalMaterial map={craftAssets.flourSackTex} roughness={0.92} sheen={0.55} sheenColor="#FAF3E2" />
          </mesh>
          <mesh position={[0, 0.285, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.062, 0.008, 10, 24]} />
            <meshStandardMaterial color="#8C5E34" roughness={0.88} />
          </mesh>
        </group>

        {/* Folded Stack of Soft Beveled Belgian Linen Baker's Tea Towels + True Hollow Rattan Banneton! */}
        <group position={[0.38, 0.032, 0.08]} rotation={[0, -0.14, 0]}>
          {[0, 1, 2].map((ti) => (
            <mesh key={ti} position={[0, 0.013 + ti * 0.026, 0]} rotation={[0, (ti - 1) * 0.06, 0]} geometry={towelGeo} castShadow receiveShadow>
              <meshPhysicalMaterial
                map={ti === 1 ? craftAssets.ginghamTex : craftAssets.flourSackTex}
                color={ti === 0 ? '#F4ECDC' : '#FAF4E8'}
                roughness={0.92}
                sheen={0.52}
                sheenColor="#FFFDF6"
              />
            </mesh>
          ))}
          <mesh position={[0, 0.078, -0.02]} geometry={bannetonGeo} castShadow receiveShadow>
            <meshPhysicalMaterial
              map={craftAssets.wovenRattan.map}
              normalMap={craftAssets.wovenRattan.normalMap}
              normalScale={RUBBLE_NORMAL_SCALE}
              roughnessMap={craftAssets.wovenRattan.roughnessMap}
              color="#E6D2B2"
              roughness={0.96}
              sheen={0.30}
              sheenColor="#F6E6C8"
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>

        {/* Nested Hollow Hand-Thrown Artisan Stoneware Bowls — Physically Grounded inside Each Other! */}
        <group position={[0.98, 0.032, 0.02]}>
          <mesh position={[0, 0, 0]} geometry={bowlLargeGeo} castShadow receiveShadow>
            <meshPhysicalMaterial
              map={craftAssets.glazedPottery.map}
              normalMap={craftAssets.glazedPottery.normalMap}
              normalScale={MARBLE_NORMAL_SCALE}
              roughness={0.44}
              clearcoat={0.16}
              clearcoatRoughness={0.34}
              envMapIntensity={0.32}
            />
          </mesh>
          {/* Seated squarely onto large bowl inner bottom (y = 0.013) with gentle natural tilt */}
          <mesh position={[0.012, 0.014, -0.008]} rotation={[0.04, 0.8, 0.06]} geometry={bowlMedGeo} castShadow receiveShadow>
            <meshPhysicalMaterial
              map={craftAssets.glazedPottery.map}
              normalMap={craftAssets.glazedPottery.normalMap}
              normalScale={MARBLE_NORMAL_SCALE}
              color="#D4E0CC"
              roughness={0.42}
              clearcoat={0.16}
              clearcoatRoughness={0.34}
              envMapIntensity={0.32}
            />
          </mesh>
          {/* Seated squarely onto medium bowl inner bottom (y = 0.028) */}
          <mesh position={[-0.006, 0.028, 0.006]} rotation={[-0.04, 1.8, -0.05]} geometry={bowlSmallGeo} castShadow>
            <meshPhysicalMaterial
              map={craftAssets.glazedPottery.map}
              normalMap={craftAssets.glazedPottery.normalMap}
              color="#F2D8B8"
              roughness={0.44}
              clearcoat={0.16}
              clearcoatRoughness={0.34}
              envMapIntensity={0.32}
            />
          </mesh>
        </group>
      </group>

      {/* Distressed Cream Beadboard Apron + Beveled Forged Brass Corner Brackets */}
      <mesh position={[0, 0.81, 0]} geometry={apronFrameGeo} material={beadboardMat} castShadow receiveShadow />
      {[-1.47, 1.47].map((bx, xi) =>
        [-0.562, 0.562].map((bz, zi) => (
          <mesh key={`brkt-${xi}-${zi}`} position={[bx, 0.808, bz]} geometry={bracketGeo} material={bracketMat} castShadow />
        ))
      )}

      {/* Wide-Plank Hand-Planed French Honey-Oak Country Baking Table Top */}
      <mesh position={[0, 0.882, 0]} geometry={oakTopFrameGeo} material={agedTimberMat} castShadow receiveShadow />
      <mesh position={[0, 0.908, 0]} geometry={marbleSlabGeo} material={oakSlabMat} castShadow receiveShadow />

      {/* 一体化无缝细分垂坠亚麻桌布（严格置于 y=0.9211，低于顶部蕾丝垫 0.9228 彻底消除斜切穿模） */}
      <mesh
        position={[0, 0.9211, 0]}
        geometry={drapedTableclothGeo}
        material={tableclothMat}
        castShadow
        receiveShadow
        raycast={() => null}
      />
      {/* Solid Beveled Wrought-Iron & Hammered-Copper Hearth Warming Trivet for Step 3 aligned cleanly to [0.28, -0.32] */}
      <group position={[0.28, 0.921, -0.32]}>
        {/* Cast-iron recessed burner plate with real 4mm thickness */}
        <mesh position={[0, 0.002, 0]} receiveShadow>
          <cylinderGeometry args={[0.152, 0.156, 0.004, 36]} />
          <meshStandardMaterial
            color="#342B24"
            emissive="#FF5A1E"
            emissiveIntensity={burnerActive ? 0.85 : 0.10}
            metalness={0.54}
            roughness={0.54}
          />
        </mesh>
        <mesh position={[0, 0.0055, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.156, 0.0065, 14, 36]} />
          <meshPhysicalMaterial color="#B86B42" metalness={0.64} roughness={0.40} envMapIntensity={0.38} />
        </mesh>
      </group>
    </group>
  );
};

export const PatisserieAtrium: React.FC = () => {
  const { scene, gl } = useThree();
  const textures = useMemo(() => getAtelierTextures(), []);
  const parquetPbr = useMemo(() => getParquetPbrSet(3.6, 3.0), []);
  const plasterPbr = useMemo(() => getPlasterPbrSet(3.6, 1.4), []);
  const craftAssets = useMemo(() => getCottageCraftAssets(), []);

  const skyDomeMat = useMemo(() => createPastoralSkyDomeMaterial(), []);
  const creekWaterMat = useMemo(() => createCreekWaterShaderMaterial(), []);
  const sheerCurtainMat = useMemo(() => createBillowingSheerCurtainMaterial(), []);
  const grassWindTime = useMemo(() => ({ value: 0 }), []);
  const meadowTerrainMat = useMemo(() => createGhibliMeadowTerrainMaterial(grassWindTime), [grassWindTime]);
  const signLogoTex = useMemo(() => createPatisserieSignLogoTexture(), []);
  const sunPatchTex = useMemo(() => createDappledSunPatchTexture(false), []);
  const jewelCausticTex = useMemo(() => createDappledSunPatchTexture(true), []);
  const godRayMat = useMemo(() => {
    const m = createGodRayShaderMaterial();
    m.uniforms.uOpacity.value = 0.115;
    m.uniforms.uColor.value.set('#FFE3A8');
    m.vertexShader = m.vertexShader
      .replace('varying vec3 vViewDir;', 'varying vec3 vViewDir;\nvarying vec3 vRayWorldPos;')
      .replace(
        'vec4 mvPos = modelViewMatrix * vec4(position, 1.0);',
        'vec4 rayWp = modelMatrix * vec4(position, 1.0);\nvRayWorldPos = rayWp.xyz;\nvec4 mvPos = viewMatrix * rayWp;'
      );
    m.fragmentShader = m.fragmentShader
      .replace('varying vec3 vViewDir;', 'varying vec3 vViewDir;\nvarying vec3 vRayWorldPos;')
      .replace(
        'float alpha = xFade * yFade * louvers * shimmer * facing * uOpacity;',
        'float westFade = smoothstep(-2.4, 0.85, vRayWorldPos.x);\nfloat alpha = xFade * yFade * louvers * shimmer * facing * uOpacity * mix(0.14, 1.0, westFade);'
      );
    return m;
  }, []);
  const streamFernGeo = useMemo(() => createSwordFernFrondGeometry(), []);
  const {
    streamFernWindMat,
    lilyPadWindMat,
    lilyFlowerWindMat,
    reedBladeWindMat,
    terraceLeafWindMat,
    terraceDaisyWindMat,
    terraceRoseWindMats,
    delphiniumWindMats,
  } = useMemo(() => {
    const rosePalette = ['#EA90A8', '#FDF3DF', '#F0B28C', '#E47B96', '#F29EB4', '#FAF2DF', '#EAB48E', '#EB8CA4', '#FAF0DC', '#F2A4BA'];
    const rMap: Record<string, THREE.MeshStandardMaterial> = {};
    rosePalette.forEach((col, i) => {
      rMap[col] = createGardenBotanicalWindMat(grassWindTime, {
        swayAmp: 0.010,
        radialPin: true,
        color: col,
        vertexColors: true,
        roughness: 0.76,
        side: THREE.DoubleSide,
        cacheTag: `terrace-rose-${i}`,
      });
    });
    const delphPalette = ['#FFFFFF', '#E2D6FA', '#D4BEF6', '#DFD4FA', '#FFF8EC', '#D4B6F4', '#E3CEFA', '#CFC0F6', '#E6DAFC'];
    const dMap: Record<string, THREE.MeshStandardMaterial> = {};
    delphPalette.forEach((col, i) => {
      dMap[col] = createGardenBotanicalWindMat(grassWindTime, {
        swayAmp: 0.020,
        yBase: 0.0,
        yRange: 0.55,
        color: col,
        vertexColors: true,
        roughness: 0.74,
        side: THREE.DoubleSide,
        cacheTag: `terrace-delph-${i}`,
      });
    });
    return {
      streamFernWindMat: createGardenBotanicalWindMat(grassWindTime, {
        swayAmp: 0.024,
        yBase: 0.0,
        yRange: 0.48,
        roughness: 0.62,
        side: THREE.DoubleSide,
        cacheTag: 'stream-fern',
      }),
      lilyPadWindMat: createGardenBotanicalWindMat(grassWindTime, {
        swayAmp: 0.007,
        yBase: -0.02,
        yRange: 0.05,
        roughness: 0.48,
        cacheTag: 'lily-pad',
      }),
      lilyFlowerWindMat: createGardenBotanicalWindMat(grassWindTime, {
        swayAmp: 0.008,
        radialPin: true,
        vertexColors: true,
        roughness: 0.62,
        side: THREE.DoubleSide,
        cacheTag: 'lily-flower',
      }),
      reedBladeWindMat: createGardenBotanicalWindMat(grassWindTime, {
        swayAmp: 0.020,
        yBase: -0.24,
        yRange: 0.48,
        color: '#3B6D2C',
        roughness: 0.72,
        cacheTag: 'reed-blade',
      }),
      terraceLeafWindMat: createGardenBotanicalWindMat(grassWindTime, {
        swayAmp: 0.014,
        yBase: 0.0,
        yRange: 0.16,
        vertexColors: true,
        roughness: 0.78,
        side: THREE.DoubleSide,
        cacheTag: 'terrace-leaf',
      }),
      terraceDaisyWindMat: createGardenBotanicalWindMat(grassWindTime, {
        swayAmp: 0.010,
        radialPin: true,
        vertexColors: true,
        roughness: 0.76,
        side: THREE.DoubleSide,
        cacheTag: 'terrace-daisy',
      }),
      terraceRoseWindMats: rMap,
      delphiniumWindMats: dMap,
    };
  }, [grassWindTime]);

  const boulderInstRef = useRef<THREE.InstancedMesh>(null);
  const lilyPadInstRef = useRef<THREE.InstancedMesh>(null);
  const lilyFlowerInstRef = useRef<THREE.InstancedMesh>(null);
  const streamFernInstRef = useRef<THREE.InstancedMesh>(null);
  const tastingTarget = useMemo(() => {
    const obj = new THREE.Object3D();
    obj.position.set(3.55, 0.94, 0.65);
    return obj;
  }, []);

  const {
    cottageFloorGeo,
    courtyardPatioGeo,
    meadowGeo,
    creekCurve,
    creekBankGeo,
    creekRibbonGeo,
    creekBedGeo,
    boulderGeo,
    lilyPadGeo,
    gableGeo,
    northWindowWallHeaderGeo,
    westWindowWallHeaderGeo,
    terraceRoseGeo,
    terraceLeafGeo,
    terraceDaisyGeo,
    terraceDelphiniumGeo,
    terracePotGeo,
    urnBasinGeo,
    nearBankTerraces,
    creekSamples,
    potGeo,
    steppingStonePositions,
    eastDeckGeo,
    southDeckGeo,
  } = useMemo(() => {
    const creekCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(16.0, -0.39, -32.0),
      new THREE.Vector3(11.6, -0.39, -18.5),
      new THREE.Vector3(9.15, -0.39, -8.0),
      new THREE.Vector3(8.08, -0.39, -2.5),
      new THREE.Vector3(8.16, -0.39, 0.95),
      new THREE.Vector3(8.52, -0.39, 4.4),
      new THREE.Vector3(9.18, -0.39, 7.8),
      new THREE.Vector3(5.45, -0.39, 9.85),
      new THREE.Vector3(0.85, -0.39, 9.25),
      new THREE.Vector3(-4.45, -0.39, 11.35),
      new THREE.Vector3(-9.6, -0.39, 12.9),
      new THREE.Vector3(-17.8, -0.39, 15.6),
      new THREE.Vector3(-27.5, -0.39, 19.2),
      new THREE.Vector3(-37.0, -0.39, 22.8),
    ]);
    const bedCurve = new THREE.CatmullRomCurve3(
      creekCurve.points.map((p) => new THREE.Vector3(p.x, -0.44, p.z))
    );

    const samples: Array<{ pt: THREE.Vector3; side: THREE.Vector3; hw: number }> = [];
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 48; i++) {
      const t = 0.18 + (i / 47) * 0.64;
      const pt = creekCurve.getPointAt(t);
      const tan = creekCurve.getTangentAt(t).normalize();
      const side = new THREE.Vector3().crossVectors(up, tan).normalize();
      samples.push({ pt, side, hw: creekHalfWidthAtT(t, 1.175) });
    }

    const rawBoulder = new THREE.SphereGeometry(0.18, 16, 12);
    const bPos = rawBoulder.attributes.position;
    for (let i = 0; i < bPos.count; i++) {
      const vx = bPos.getX(i);
      const vy = bPos.getY(i);
      const vz = bPos.getZ(i);
      const n =
        1.0 +
        0.08 * Math.sin(vx * 10.0 + vy * 8.0) +
        0.06 * Math.cos(vz * 11.0 - vx * 7.0);
      const flatBottom = vy < -0.04 ? 0.42 : 0.62;
      bPos.setXYZ(i, vx * n * 1.15, vy * n * flatBottom, vz * n * 1.05);
    }
    rawBoulder.computeVertexNormals();

    // 沿实际地形高度对齐所有青石汀步石（防止低洼浮空与高坡穿破）
    const rawStepStones: Array<[number, number, number]> = [
      // East bridge approach & gentle curve into open sunlit garden glade
      [6.54, 0.92, 0.34],
      [9.92, 1.04, 0.38],
      [10.85, 1.32, 0.36],
      [11.78, 1.82, 0.36],
      [12.68, 2.48, 0.35],
      // South terrace gateway -> South creek bridge approach
      [0.85, 6.84, 0.44],
      [0.85, 7.36, 0.42],
      // NE Climbing Rose Arch Gate walkway stone
      [6.92, -1.65, 0.42],
    ];
    const stepStones: Array<[number, number, number, number]> = rawStepStones.map(([sx, sz, sr]) => [
      sx,
      sampleGhibliTerrainHeight(sx, sz) + 0.015,
      sz,
      sr,
    ]);

    const terraceDefs: Array<Array<[number, number]>> = [
      [[7.65, -6.20], [7.18, -4.40], [6.92, -2.75]],
      [[6.92, 2.15], [7.06, 3.65], [7.22, 5.15]],
      [[6.55, 7.62], [5.15, 8.15], [3.65, 8.12], [2.32, 7.82]],
      [[-0.35, 8.45], [-1.75, 8.85], [-3.25, 9.35], [-4.55, 9.85]],
    ];
    const terraces = terraceDefs.map((pts) => createCurvedStonePlanterBedData(pts, 0.56, 0.25, -0.365, 18));

    return {
      cottageFloorGeo: ensureSecondaryUv(createBeveledBoxGeometry(10.1, 0.14, 8.75, 0.08, 0.01, 0.01, 2)),
      courtyardPatioGeo: createBeveledBoxGeometry(7.2, 0.06, 7.6, 0.45, 0.015, 0.015, 2),
      meadowGeo: ensureSecondaryUv(createCarvedMeadowGeometry(creekCurve, 2.35)),
      creekCurve,
      creekBankGeo: createCreekEmbankmentGeometry(creekCurve, 2.35, 180),
      creekRibbonGeo: createMeanderingCreekGeometry(creekCurve, 2.35, 180, 12, 16.0),
      creekBedGeo: createMeanderingCreekGeometry(bedCurve, 2.60, 140, 6, 16.0),
      boulderGeo: rawBoulder,
      lilyPadGeo: new THREE.CylinderGeometry(0.16, 0.16, 0.012, 20, 1, false, 0.25, Math.PI * 1.85),
      gableGeo: createGableTriangleGeometry(5.02, 1.56, 0.18),
      northWindowWallHeaderGeo: createArchedWindowWallHeaderGeo(0.64, 2.52, 3.92, 0.20),
      westWindowWallHeaderGeo: createArchedWindowWallHeaderGeo(0.72, 2.50, 3.92, 0.20),
      terraceRoseGeo: createSculptedRoseBlossomGeometry(),
      terraceLeafGeo: createLayeredLeafClusterGeometry(7),
      terraceDaisyGeo: createChamomileDaisyHeadGeometry(),
      terraceDelphiniumGeo: createDelphiniumSpikeGeometry(),
      terracePotGeo: createTerracottaPlanterGeometry(0.14, 0.095, 0.24),
      urnBasinGeo: createTerracottaPlanterGeometry(0.24, 0.14, 0.38),
      nearBankTerraces: terraces,
      creekSamples: samples,
      potGeo: createTerracottaPlanterGeometry(0.24, 0.16, 0.42),
      steppingStonePositions: stepStones,
      eastDeckGeo: createBeveledBoxGeometry(1.32, 0.07, 8.76, 0.016, 0.008, 0.008, 2),
      southDeckGeo: createBeveledBoxGeometry(11.25, 0.07, 1.24, 0.016, 0.008, 0.008, 2),
    };
  }, []);

  const agedWoodPbr = useMemo(() => createWoodGrainPbr('#8B5630', '#5A3418', 211), []);
  const sageMicroMaps = useMemo(() => createMicroSurfaceMaps(0.48, 0.09, false, 419), []);

  const cottageFloorMat = useMemo(
    () =>
      enhanceWithExtremeMicroCraft(
        new THREE.MeshPhysicalMaterial({
          map: parquetPbr.map,
          normalMap: parquetPbr.normalMap,
          normalScale: OAK_NORMAL_SCALE,
          roughnessMap: parquetPbr.roughnessMap,
          aoMap: parquetPbr.aoMap,
          aoMapIntensity: 0.46,
          color: '#D2A676',
          roughness: 0.72,
          clearcoat: 0.06,
          clearcoatRoughness: 0.40,
          clearcoatNormalMap: parquetPbr.normalMap,
          clearcoatNormalScale: OAK_NORMAL_SCALE,
          envMapIntensity: 0.32,
        }),
        { boxProjectedIBL: true, detailKind: 'wood', detailStrength: 0.18, cacheTag: 'cottage-parquet-floor' }
      ),
    [parquetPbr]
  );
  useEffect(() => () => cottageFloorMat.dispose(), [cottageFloorMat]);

  const {
    wallpaperMat,
    agedTimberMat,
    sageEnamelFrameMat,
    beadboardMat,
    pineRoofMat,
    flagstoneMat,
    rubbleStoneMat,
    conservatoryGlassMat,
    stainedBorderGlassMat,
    doorMedallionGlassMat,
    transomFloralGlassMat,
    circularRoseGlassMat,
    wroughtIronMat,
    terraceSoilMat,
  } = useMemo(() => {
    return {
      wallpaperMat: new THREE.MeshStandardMaterial({
        map: craftAssets.wallpaperTex,
        normalMap: plasterPbr.normalMap,
        normalScale: PLASTER_NORMAL_SCALE,
        roughness: 0.88,
        envMapIntensity: 0.24,
      }),
      agedTimberMat: new THREE.MeshStandardMaterial({
        map: agedWoodPbr.map,
        bumpMap: agedWoodPbr.bumpMap,
        bumpScale: 0.012,
        roughnessMap: agedWoodPbr.roughnessMap,
        roughness: 0.80,
        envMapIntensity: 0.26,
      }),
      sageEnamelFrameMat: new THREE.MeshPhysicalMaterial({
        color: '#768B6E',
        bumpMap: sageMicroMaps.bumpMap,
        bumpScale: 0.003,
        roughnessMap: sageMicroMaps.roughnessMap,
        roughness: 0.56,
        clearcoat: 0.06,
        clearcoatRoughness: 0.36,
        envMapIntensity: 0.30,
      }),
      beadboardMat: new THREE.MeshStandardMaterial({
        map: craftAssets.beadboard.map,
        normalMap: craftAssets.beadboard.normalMap,
        normalScale: BEADBOARD_NORMAL_SCALE,
        roughness: 0.76,
        envMapIntensity: 0.26,
      }),
      pineRoofMat: new THREE.MeshStandardMaterial({
        map: craftAssets.pineRoof.map,
        normalMap: craftAssets.pineRoof.normalMap,
        normalScale: PINE_ROOF_NORMAL_SCALE,
        roughness: 0.78,
        envMapIntensity: 0.26,
      }),
      flagstoneMat: new THREE.MeshStandardMaterial({
        map: craftAssets.flagstone.map,
        normalMap: craftAssets.flagstone.normalMap,
        normalScale: FLAGSTONE_NORMAL_SCALE,
        roughness: 0.90,
        envMapIntensity: 0.22,
      }),
      rubbleStoneMat: new THREE.MeshStandardMaterial({
        map: craftAssets.rubbleStone.map,
        normalMap: craftAssets.rubbleStone.normalMap,
        normalScale: RUBBLE_NORMAL_SCALE,
        color: '#E8DEC8',
        roughness: 0.94,
        metalness: 0.0,
        envMapIntensity: 0.18,
      }),
      conservatoryGlassMat: new THREE.MeshPhysicalMaterial({
        color: '#F3FAFF',
        transparent: true,
        opacity: 0.14,
        roughness: 0.14,
        metalness: 0.0,
        ior: 1.48,
        reflectivity: 0.45,
        clearcoat: 0.25,
        clearcoatRoughness: 0.18,
        envMapIntensity: 0.42,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      stainedBorderGlassMat: new THREE.MeshPhysicalMaterial({
        map: craftAssets.botanicalBorderGlassTex,
        emissiveMap: craftAssets.botanicalBorderGlassTex,
        emissive: '#FFF4DA',
        emissiveIntensity: 0.08,
        transparent: true,
        opacity: 0.96,
        roughness: 0.18,
        clearcoat: 0.25,
        clearcoatRoughness: 0.18,
        envMapIntensity: 0.42,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      doorMedallionGlassMat: new THREE.MeshPhysicalMaterial({
        map: craftAssets.botanicalDoorMedallionTex,
        emissiveMap: craftAssets.botanicalDoorMedallionTex,
        emissive: '#FFF4DA',
        emissiveIntensity: 0.10,
        transparent: true,
        opacity: 0.96,
        roughness: 0.18,
        clearcoat: 0.25,
        clearcoatRoughness: 0.18,
        envMapIntensity: 0.42,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      transomFloralGlassMat: new THREE.MeshPhysicalMaterial({
        map: craftAssets.transomFloralGlassTex,
        emissiveMap: craftAssets.transomFloralGlassTex,
        emissive: '#FFF4DA',
        emissiveIntensity: 0.08,
        transparent: true,
        opacity: 0.96,
        roughness: 0.18,
        clearcoat: 0.25,
        clearcoatRoughness: 0.18,
        envMapIntensity: 0.42,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      circularRoseGlassMat: new THREE.MeshPhysicalMaterial({
        map: craftAssets.circularRoseGlassTex,
        emissiveMap: craftAssets.circularRoseGlassTex,
        emissive: '#FFF4DA',
        emissiveIntensity: 0.10,
        transparent: true,
        opacity: 0.96,
        roughness: 0.18,
        clearcoat: 0.25,
        clearcoatRoughness: 0.18,
        envMapIntensity: 0.42,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      wroughtIronMat: new THREE.MeshStandardMaterial({
        color: '#3D2B1F',
        metalness: 0.36,
        roughness: 0.56,
        envMapIntensity: 0.28,
      }),
      terraceSoilMat: new THREE.MeshStandardMaterial({
        color: '#4E3929',
        roughness: 0.96,
        envMapIntensity: 0.18,
      }),
    };
  }, [craftAssets, plasterPbr, agedWoodPbr, sageMicroMaps]);

  useLayoutEffect(() => {
    const bInst = boulderInstRef.current;
    if (bInst) {
      const dummy = new THREE.Object3D();
      const color = new THREE.Color();
      const rockPalette = [0x92968a, 0x76856e, 0xa2a69a, 0x6b7f62, 0x8a8e82];
      creekSamples.forEach((s, idx) => {
        let bankSign = idx % 2 === 0 ? -1 : 1;
        let offset = bankSign * (s.hw + 0.14 + (idx % 3) * 0.12);
        let bx = s.pt.x + s.side.x * offset;
        let bz = s.pt.z + s.side.z * offset;
        // Strictly keep river cobbles off veranda decks, courtyard wall, East bridge (x≈8.16, z≈0.95) & South bridge (x≈0.85, z≈9.25)!
        const blocksEastBridge = Math.abs(bz - 0.95) < 1.35 && bx > 5.8 && bx < 10.4;
        const blocksSouthBridge = Math.abs(bx - 0.85) < 1.45 && bz > 7.2 && bz < 11.2;
        const blocksVeranda = bx < 6.62 && bz < 6.85;
        if (blocksVeranda) {
          bankSign = 1;
          offset = bankSign * (s.hw + 0.18 + (idx % 3) * 0.12);
          bx = s.pt.x + s.side.x * offset;
          bz = s.pt.z + s.side.z * offset;
        }
        if (blocksEastBridge || blocksSouthBridge) {
          dummy.position.set(0, -10, 0);
          dummy.scale.setScalar(0.001);
        } else {
          dummy.position.set(bx, -0.375, bz);
          dummy.rotation.set(0, idx * 1.1, 0);
          dummy.scale.set(0.68 + (idx % 4) * 0.16, 0.54 + (idx % 3) * 0.12, 0.72 + (idx % 3) * 0.16);
        }
        dummy.updateMatrix();
        bInst.setMatrixAt(idx, dummy.matrix);
        color.setHex(rockPalette[idx % rockPalette.length]);
        bInst.setColorAt(idx, color);
      });
      bInst.instanceMatrix.needsUpdate = true;
      if (bInst.instanceColor) bInst.instanceColor.needsUpdate = true;
    }

    const lInst = lilyPadInstRef.current;
    const lfInst = lilyFlowerInstRef.current;
    if (lInst) {
      const dummy = new THREE.Object3D();
      const color = new THREE.Color();
      let fi = 0;
      for (let i = 0; i < 42; i++) {
        // 仅稀疏点缀 16 片荷叶与 6 朵睡莲，留出大片清澈溪面透视鹅卵石与锦鲤！
        if (i >= 16) {
          dummy.position.set(0, -10, 0);
          dummy.scale.setScalar(0.001);
          dummy.updateMatrix();
          lInst.setMatrixAt(i, dummy.matrix);
          continue;
        }
        const s = creekSamples[(i * 5 + 4) % creekSamples.length];
        const offset = ((i % 3) - 1) * (s.hw * 0.36);
        const px = s.pt.x + s.side.x * offset;
        const pz = s.pt.z + s.side.z * offset;
        const sc = 0.78 + (i % 3) * 0.20;
        dummy.position.set(px, -0.382, pz);
        dummy.rotation.set(0, i * 1.7, 0);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        lInst.setMatrixAt(i, dummy.matrix);
        color.setHex(i % 2 === 0 ? 0x3f7836 : 0x518c42);
        lInst.setColorAt(i, color);

        if (lfInst && i % 3 === 0 && fi < 6) {
          dummy.position.set(px + Math.cos(i * 1.7) * 0.025, -0.376, pz + Math.sin(i * 1.7) * 0.025);
          dummy.rotation.set(0.08, i * 2.1, -0.06);
          dummy.scale.setScalar(1.32 + (fi % 2) * 0.20);
          dummy.updateMatrix();
          lfInst.setMatrixAt(fi, dummy.matrix);
          color.setHex(fi % 2 === 0 ? 0xfad2de : 0xfff7e4);
          lfInst.setColorAt(fi, color);
          fi++;
        }
      }
      if (lfInst) {
        dummy.position.set(0, -10, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        for (; fi < 14; fi++) lfInst.setMatrixAt(fi, dummy.matrix);
      }
      lInst.instanceMatrix.needsUpdate = true;
      if (lInst.instanceColor) lInst.instanceColor.needsUpdate = true;
      if (lfInst) {
        lfInst.instanceMatrix.needsUpdate = true;
        if (lfInst.instanceColor) lfInst.instanceColor.needsUpdate = true;
      }
    }

    // 96 Streamside Feathery Sword Ferns anchored flush onto `-0.36` creek bank lips!
    const fInst = streamFernInstRef.current;
    if (fInst) {
      const dummy = new THREE.Object3D();
      const color = new THREE.Color();
      for (let i = 0; i < 96; i++) {
        const s = creekSamples[(i * 3) % creekSamples.length];
        let bankSign = i % 2 === 0 ? -1 : 1;
        let offset = bankSign * (s.hw + 0.34 + (i % 3) * 0.16);
        let fx = s.pt.x + s.side.x * offset;
        let fz = s.pt.z + s.side.z * offset;
        // Keep near-bank ferns strictly off the manicured cottage-side stone planter terraces (keep wild lush ferns on far outer bank!)
        if (fx < 6.75 && fz < 6.95) {
          bankSign = 1;
        } else if (fx > -5.2 && fz < 10.4 && bankSign < 0) {
          bankSign = 1;
        }
        offset = bankSign * (s.hw + 0.34 + (i % 3) * 0.16);
        fx = s.pt.x + s.side.x * offset;
        fz = s.pt.z + s.side.z * offset;
        const blocksEast = Math.abs(fz - 0.95) < 1.35 && fx > 5.8 && fx < 10.4;
        const blocksSouth = Math.abs(fx - 0.85) < 1.45 && fz > 7.2 && fz < 11.2;
        const fanAngle = ((i % 6) / 6) * Math.PI * 2;
        if (blocksEast || blocksSouth) {
          dummy.position.set(0, -10, 0);
          dummy.scale.setScalar(0.001);
        } else {
          dummy.position.set(fx, -0.365, fz);
          dummy.rotation.set(-0.65, fanAngle, 0.15);
          dummy.scale.setScalar(0.76 + (i % 3) * 0.18);
        }
        dummy.updateMatrix();
        fInst.setMatrixAt(i, dummy.matrix);
        color.setHex(i % 2 === 0 ? 0x467b34 : 0x5b9444);
        fInst.setColorAt(i, color);
      }
      fInst.instanceMatrix.needsUpdate = true;
      if (fInst.instanceColor) fInst.instanceColor.needsUpdate = true;
    }
    // 满山坡随机杂草与零散野花已彻底移除，改为平滑法式修剪丝绒草坪 + 正规园艺花坛/绣球/薰衣草带！
  }, [creekSamples]);

  const currentStep = useGameStore((s) => s.currentStep);
  const mechanics = useGameStore((s) => (s as unknown as OptionalMechanicsSlice).mechanics);
  const burnerActive = currentStep === 3 || Boolean(mechanics?.burnerActive);

  // Pure Provence Golden-Hour Environment IBL, Warm Horizon Mist & Texture Anisotropy
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();

    const gardenHdrTex = createPastoralGardenHdrEnvironment();
    const envRT = pmrem.fromEquirectangular(gardenHdrTex);
    gardenHdrTex.dispose();

    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.34;
    scene.background = new THREE.Color('#f7eedc');
    // 推远并减轻纯白雾墙（0.0155 -> 0.0068），以近暖春绿->中鼠尾草->远山青黛灰蓝呈现清透吉卜力空气透视！
    scene.fog = new THREE.FogExp2('#f7eedc', 0.0068);

    [parquetPbr, plasterPbr, getMarblePbrSet(2.2, 0.92), getMarblePbrSet()].forEach((pbr) => {
      applyTextureAnisotropy(pbr.map, gl, 16);
      applyTextureAnisotropy(pbr.normalMap, gl, 16);
      applyTextureAnisotropy(pbr.roughnessMap, gl, 16);
      if (pbr.aoMap) applyTextureAnisotropy(pbr.aoMap, gl, 16);
    });

    return () => {
      if (scene.environment === envRT.texture) {
        scene.environment = null;
      }
      scene.background = null;
      scene.fog = null;
      envRT.dispose();
      pmrem.dispose();
    };
  }, [scene, gl, parquetPbr, plasterPbr]);

  useEffect(() => {
    return () => {
      skyDomeMat.dispose();
      creekWaterMat.dispose();
      sheerCurtainMat.dispose();
      meadowTerrainMat.dispose();
      signLogoTex.dispose();
      sunPatchTex.dispose();
      jewelCausticTex.dispose();
      godRayMat.dispose();
      streamFernGeo.dispose();
      streamFernWindMat.dispose();
      lilyPadWindMat.dispose();
      lilyFlowerWindMat.dispose();
      reedBladeWindMat.dispose();
      terraceLeafWindMat.dispose();
      terraceDaisyWindMat.dispose();
      Object.values(terraceRoseWindMats).forEach((m) => m.dispose());
      Object.values(delphiniumWindMats).forEach((m) => m.dispose());
      wallpaperMat.dispose();
      agedTimberMat.dispose();
      sageEnamelFrameMat.dispose();
      beadboardMat.dispose();
      pineRoofMat.dispose();
      flagstoneMat.dispose();
      rubbleStoneMat.dispose();
      conservatoryGlassMat.dispose();
      stainedBorderGlassMat.dispose();
      doorMedallionGlassMat.dispose();
      transomFloralGlassMat.dispose();
      circularRoseGlassMat.dispose();
      wroughtIronMat.dispose();
      terraceSoilMat.dispose();
      cottageFloorGeo.dispose();
      courtyardPatioGeo.dispose();
      meadowGeo.dispose();
      creekBankGeo.dispose();
      creekRibbonGeo.dispose();
      creekBedGeo.dispose();
      boulderGeo.dispose();
      lilyPadGeo.dispose();
      gableGeo.dispose();
      northWindowWallHeaderGeo.dispose();
      westWindowWallHeaderGeo.dispose();
      terraceRoseGeo.dispose();
      terraceLeafGeo.dispose();
      terraceDaisyGeo.dispose();
      terraceDelphiniumGeo.dispose();
      terracePotGeo.dispose();
      urnBasinGeo.dispose();
      nearBankTerraces.forEach((tr) => {
        tr.wallGeo.dispose();
        tr.soilGeo.dispose();
        tr.ivyStems.forEach((g) => g.dispose());
      });
      potGeo.dispose();
      eastDeckGeo.dispose();
      southDeckGeo.dispose();
      agedWoodPbr.map.dispose();
      agedWoodPbr.bumpMap.dispose();
      agedWoodPbr.roughnessMap.dispose();
      sageMicroMaps.bumpMap.dispose();
      sageMicroMaps.roughnessMap.dispose();
    };
  }, [
    skyDomeMat,
    creekWaterMat,
    sheerCurtainMat,
    meadowTerrainMat,
    signLogoTex,
    sunPatchTex,
    jewelCausticTex,
    godRayMat,
    streamFernGeo,
    streamFernWindMat,
    lilyPadWindMat,
    lilyFlowerWindMat,
    reedBladeWindMat,
    terraceLeafWindMat,
    terraceDaisyWindMat,
    terraceRoseWindMats,
    delphiniumWindMats,
    wallpaperMat,
    agedTimberMat,
    sageEnamelFrameMat,
    beadboardMat,
    pineRoofMat,
    flagstoneMat,
    rubbleStoneMat,
    conservatoryGlassMat,
    stainedBorderGlassMat,
    doorMedallionGlassMat,
    transomFloralGlassMat,
    circularRoseGlassMat,
    wroughtIronMat,
    terraceSoilMat,
    cottageFloorGeo,
    courtyardPatioGeo,
    meadowGeo,
    creekBankGeo,
    creekRibbonGeo,
    creekBedGeo,
    boulderGeo,
    lilyPadGeo,
    gableGeo,
    northWindowWallHeaderGeo,
    westWindowWallHeaderGeo,
    terraceRoseGeo,
    terraceLeafGeo,
    terraceDaisyGeo,
    terraceDelphiniumGeo,
    terracePotGeo,
    urnBasinGeo,
    nearBankTerraces,
    potGeo,
    eastDeckGeo,
    southDeckGeo,
    agedWoodPbr,
    sageMicroMaps,
  ]);

  const sunPatchRefs = useRef<Array<THREE.Mesh | null>>([]);
  const tableSunPatchRef = useRef<THREE.Mesh | null>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    skyDomeMat.uniforms.uTime.value = t;
    godRayMat.uniforms.uTime.value = t;
    creekWaterMat.uniforms.uTime.value = t;
    sheerCurtainMat.uniforms.uTime.value = t;
    grassWindTime.value = t;

    const baseSpots: Array<[number, number, number]> = [
      [1.85, 2.25, -0.34],
      [0.45, 2.95, -0.32],
      [2.68, -0.68, -0.36],
    ];
    for (let i = 0; i < baseSpots.length; i++) {
      const m = sunPatchRefs.current[i];
      if (!m) continue;
      const [bx, bz, brot] = baseSpots[i];
      m.position.x = bx + Math.sin(t * 0.48 + i * 1.4) * 0.065;
      m.position.z = bz + Math.cos(t * 0.38 + i * 1.9) * 0.048;
      m.rotation.z = brot + Math.sin(t * 0.34 + i * 2.1) * 0.022;
    }
    if (tableSunPatchRef.current) {
      tableSunPatchRef.current.position.x = 0.56 + Math.sin(t * 0.46) * 0.022;
      tableSunPatchRef.current.position.z = -0.02 + Math.cos(t * 0.38) * 0.016;
    }
  });

  // Only outer end trusses (`z = -3.4` North, `z = 4.6` South) + 4 interior corner braces — open clear central pine ceiling!
  const rafterZs = [-3.4, 4.6];
  const eastClerestoryBays = [-3.65, -3.00, -2.35, -1.70, -1.05, -0.35, 0.30, 0.95, 1.60, 2.25, 2.75, 3.45, 4.20, 4.96];
  const southClerestoryBays = [-4.96, -4.35, -3.70, -3.05, -2.40, -1.75, -1.15, -0.45, 0.25, 0.95, 1.65, 2.35, 3.05, 3.68, 4.32, 4.96];

  return (
    <group>
      <mesh material={skyDomeMat} raycast={() => null}>
        <sphereGeometry args={[74, 40, 24]} />
      </mesh>

      {/* ====================================================================
          1. PROVENCE GOLDEN-HOUR GHIBLI SUNLIGHT, TIGHT ISLAND SHADOW & SCULPTED FILL
         ==================================================================== */}
      <hemisphereLight args={['#FFF4DF', '#6E5D78', 0.78]} />

      <directionalLight
        position={[11.2, 6.4, 5.2]}
        intensity={1.52}
        color="#FFE8B8"
        castShadow
        shadow-mapSize-width={1536}
        shadow-mapSize-height={1536}
        shadow-camera-near={1.0}
        shadow-camera-far={44.0}
        shadow-camera-left={-14.5}
        shadow-camera-right={15.5}
        shadow-camera-top={16.5}
        shadow-camera-bottom={-14.5}
        shadow-bias={-0.00018}
        shadow-normalBias={0.016}
        shadow-radius={4.0}
      />

      {/* 紧致中岛台斜向立体投影主光（1024×1024 包覆 ±2.0m 中岛台） */}
      <directionalLight
        position={[5.2, 3.3, 1.8]}
        intensity={1.10}
        color="#FFE6B2"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.8}
        shadow-camera-far={12.0}
        shadow-camera-left={-2.0}
        shadow-camera-right={2.0}
        shadow-camera-top={1.2}
        shadow-camera-bottom={-1.2}
        shadow-bias={-0.00008}
        shadow-normalBias={0.002}
        shadow-radius={1.6}
      />

      <primitive object={tastingTarget} />
      <spotLight
        position={[4.85, 2.25, -0.45]}
        target={tastingTarget}
        angle={0.44}
        penumbra={0.86}
        intensity={1.15}
        distance={5.8}
        decay={1.5}
        color="#FFEAD0"
      />

      {/* 静态烘焙关键接触阴影（frames=1 & 256px，兼顾接地质感与极速性能！） */}
      <ContactShadows
        position={[0.0, 0.003, 0.5]}
        opacity={0.26}
        scale={13.5}
        blur={1.95}
        far={4.2}
        resolution={256}
        color="#5E4B6C"
        frames={1}
      />
      <ContactShadows
        position={[0, 0.9218, 0]}
        opacity={0.28}
        scale={ISLAND_SHADOW_SCALE}
        blur={1.95}
        far={0.56}
        resolution={256}
        color="#5E4B6C"
        frames={1}
      />

      {/* ====================================================================
          2. 法式庄园修剪丝绒草坪（Velvet Lawn，彻底清除满山坡随机杂草与散乱野花！）
         ==================================================================== */}
      <mesh geometry={meadowGeo} material={meadowTerrainMat} receiveShadow />

      {/* Natural Earthen Gravel & Mossy Stone Creek Embankment framing `-0.44m` Bed & `-0.39m` Water */}
      <mesh geometry={creekBankGeo} receiveShadow>
        <meshStandardMaterial
          normalMap={craftAssets.rubbleStone.normalMap}
          normalScale={RUBBLE_NORMAL_SCALE}
          vertexColors
          roughness={0.94}
        />
      </mesh>

      {/* Meandering Creek Bed, Sparkling Water, Mossy Boulders, Lily Pads & Streamside Flora */}
      <mesh geometry={creekBedGeo} receiveShadow>
        <meshStandardMaterial
          map={craftAssets.rubbleStone.map}
          normalMap={craftAssets.rubbleStone.normalMap}
          normalScale={RUBBLE_NORMAL_SCALE}
          color="#948A72"
          roughness={0.92}
        />
      </mesh>
      <mesh geometry={creekRibbonGeo} material={creekWaterMat} raycast={() => null} />
      {/* 清澈溪底悠然游动的 4 条橘红色小锦鲤 */}
      <CreekKoiFish curve={creekCurve} />
      {/* 溪水中圆润青苔鹅卵石（独立平滑青苔圆帽置于石顶 y=0.072，彻底消除凹凸共面造成的绿条纹穿模！） */}
      {[
        { p: [8.48, -0.402, 2.35] as [number, number, number], s: [1.55, 0.72, 1.25] as [number, number, number], r: 0.4 },
        { p: [8.12, -0.405, 3.65] as [number, number, number], s: [1.32, 0.65, 1.18] as [number, number, number], r: 1.2 },
        { p: [8.94, -0.400, 4.95] as [number, number, number], s: [1.62, 0.78, 1.32] as [number, number, number], r: 2.1 },
        { p: [8.55, -0.404, 6.20] as [number, number, number], s: [1.35, 0.68, 1.15] as [number, number, number], r: 0.8 },
        { p: [9.02, -0.398, 7.65] as [number, number, number], s: [1.70, 0.82, 1.40] as [number, number, number], r: 1.8 },
        { p: [7.65, -0.404, 8.95] as [number, number, number], s: [1.44, 0.72, 1.28] as [number, number, number], r: 2.6 },
        { p: [6.05, -0.402, 9.75] as [number, number, number], s: [1.52, 0.74, 1.22] as [number, number, number], r: 0.5 },
        { p: [3.85, -0.404, 9.60] as [number, number, number], s: [1.38, 0.68, 1.16] as [number, number, number], r: 1.5 },
      ].map((cob, ci) => (
        <group key={`moss-cobble-${ci}`} position={cob.p} rotation={[0, cob.r, 0]} scale={cob.s}>
          <mesh scale={[1.0, 0.52, 1.0]} castShadow receiveShadow>
            <sphereGeometry args={[0.24, 16, 12]} />
            <meshStandardMaterial color={ci % 2 === 0 ? '#96968A' : '#A6A092'} roughness={0.86} />
          </mesh>
          <mesh position={[0.02, 0.095, 0.01]} scale={[0.68, 0.28, 0.64]} receiveShadow>
            <sphereGeometry args={[0.20, 14, 10]} />
            <meshStandardMaterial color={ci % 2 === 0 ? '#6A964E' : '#78A458'} roughness={0.94} />
          </mesh>
        </group>
      ))}

      <instancedMesh ref={boulderInstRef} args={[boulderGeo, undefined, creekSamples.length]} castShadow receiveShadow>
        <meshStandardMaterial
          normalMap={craftAssets.rubbleStone.normalMap}
          normalScale={RUBBLE_NORMAL_SCALE}
          roughness={0.88}
        />
      </instancedMesh>
      <instancedMesh ref={lilyPadInstRef} args={[lilyPadGeo, lilyPadWindMat, 42]} />
      <instancedMesh ref={lilyFlowerInstRef} args={[terraceRoseGeo, lilyFlowerWindMat, 14]} />
      {/* Natural Upstream Mossy Limestone Cascade Riffle / Bubbling Weir Stones (`[8.32, -4.15]`) */}
      {[
        [-0.58, -0.41, -0.18, 1.35, 0.45, 1.05],
        [-0.22, -0.395, 0.04, 1.48, 0.52, 1.12],
        [0.18, -0.39, -0.06, 1.42, 0.48, 1.18],
        [0.54, -0.405, 0.14, 1.28, 0.44, 0.98],
        [-0.36, -0.42, 0.34, 1.15, 0.42, 0.92],
        [0.34, -0.415, 0.38, 1.22, 0.42, 0.95],
        [0.0, -0.415, -0.32, 1.18, 0.40, 0.88],
      ].map(([wx, wy, wz, sx, sy, sz], wi) => (
        <mesh
          key={`weir-${wi}`}
          position={[8.32 + wx, wy, -4.15 + wz]}
          rotation={[0.04 * (wi % 3 - 1), wi * 0.85, 0]}
          scale={[sx, sy, sz]}
          geometry={boulderGeo}
          receiveShadow
          castShadow
        >
          <meshStandardMaterial
            normalMap={craftAssets.rubbleStone.normalMap}
            normalScale={RUBBLE_NORMAL_SCALE}
            color={wi % 2 === 0 ? '#788870' : '#8E9484'}
            roughness={0.86}
          />
        </mesh>
      ))}
      <instancedMesh ref={streamFernInstRef} args={[streamFernGeo, streamFernWindMat, 96]} castShadow />

      {/* Sculpted Streamside Cattail Reeds & 3-Petal Bearded Purple Irises grounded cleanly on `-0.36` creek bank lips */}
      {[
        { pos: [6.82, -0.37, -0.45] as [number, number, number], kind: 'iris' as const },
        { pos: [6.88, -0.37, 2.38] as [number, number, number], kind: 'cattail' as const },
        { pos: [7.02, -0.37, 4.45] as [number, number, number], kind: 'iris' as const },
        { pos: [9.42, -0.37, -0.35] as [number, number, number], kind: 'cattail' as const },
        { pos: [9.52, -0.37, 2.48] as [number, number, number], kind: 'iris' as const },
        { pos: [9.28, -0.37, -3.75] as [number, number, number], kind: 'iris' as const },
        { pos: [9.48, -0.37, -4.95] as [number, number, number], kind: 'cattail' as const },
      ].map((clump, idx) => (
        <group key={`flora-${idx}`} position={clump.pos}>
          {/* Arching sword-shaped marsh reed foliage at clump base (GPU breeze sway!) */}
          {[0, 1, 2, 3, 4].map((bi) => {
            const ba = (bi / 5) * Math.PI * 2 + idx * 0.5;
            return (
              <mesh
                key={`blade-${bi}`}
                position={[Math.cos(ba) * 0.05, 0.22, Math.sin(ba) * 0.05]}
                rotation={[0.28 * Math.sin(ba), ba, -0.28 * Math.cos(ba)]}
                material={reedBladeWindMat}
              >
                <coneGeometry args={[0.018, 0.48, 5]} />
              </mesh>
            );
          })}
          {[-0.08, 0.0, 0.08].map((sx, si) => {
            const stemH = 0.52 + (si % 2) * 0.11;
            return (
              <group key={si} position={[sx, 0, (si - 1) * 0.07]} rotation={[0.07 * (si - 1), si * 1.1, 0.09 * (si - 1)]}>
                <mesh position={[0, stemH * 0.5, 0]} castShadow>
                  <cylinderGeometry args={[0.006, 0.010, stemH, 10]} />
                  <meshStandardMaterial color="#3D6B2C" roughness={0.76} />
                </mesh>
                {clump.kind === 'cattail' ? (
                  <>
                    {/* True velvety slender cylindrical-capsule cattail spike + tapered tip */}
                    <mesh position={[0, stemH - 0.02, 0]} castShadow>
                      <capsuleGeometry args={[0.018, 0.13, 8, 16]} />
                      <meshStandardMaterial color="#58341E" roughness={0.96} />
                    </mesh>
                    <mesh position={[0, stemH + 0.095, 0]}>
                      <cylinderGeometry args={[0.002, 0.005, 0.075, 8]} />
                      <meshStandardMaterial color="#6D7A44" roughness={0.82} />
                    </mesh>
                  </>
                ) : (
                  /* True 3-Petal Sculpted Bearded Violet Iris Blossom */
                  <group position={[0, stemH + 0.02, 0]}>
                    {[0, 1, 2].map((pi) => {
                      const pa = (pi / 3) * Math.PI * 2;
                      return (
                        <React.Fragment key={pi}>
                          {/* Drooping outer fall petal */}
                          <mesh
                            position={[Math.cos(pa) * 0.026, -0.008, Math.sin(pa) * 0.026]}
                            rotation={[Math.sin(pa) * 0.85, -pa, -Math.cos(pa) * 0.85]}
                            scale={[0.55, 1.35, 0.25]}
                          >
                            <sphereGeometry args={[0.028, 10, 8]} />
                            <meshStandardMaterial color="#685AC2" roughness={0.54} />
                          </mesh>
                          {/* Upright inner standard petal */}
                          <mesh
                            position={[Math.cos(pa + 1.05) * 0.014, 0.022, Math.sin(pa + 1.05) * 0.014]}
                            rotation={[Math.sin(pa + 1.05) * 0.28, -pa, -Math.cos(pa + 1.05) * 0.28]}
                            scale={[0.48, 1.25, 0.22]}
                          >
                            <sphereGeometry args={[0.024, 10, 8]} />
                            <meshStandardMaterial color="#8A7CE0" roughness={0.50} />
                          </mesh>
                        </React.Fragment>
                      );
                    })}
                    {/* Golden iris beard center */}
                    <mesh position={[0, 0.006, 0]}>
                      <sphereGeometry args={[0.011, 8, 8]} />
                      <meshStandardMaterial color="#F2C84B" roughness={0.58} />
                    </mesh>
                  </group>
                )}
              </group>
            );
          })}
        </group>
      ))}

      {/* 仅保留 1 座优雅东侧跨溪木拱桥作前景核心视觉引导（删除第二座重复南桥，还 S 形清澈溪流完整畅通视野！） */}
      <CedarCreekFootbridge
        position={[8.16, -0.30, 0.95]}
        rotation={[0, -0.04, 0]}
        timberMat={agedTimberMat}
        stoneMat={rubbleStoneMat}
        roseGeo={terraceRoseGeo}
        leafGeo={terraceLeafGeo}
      />

      {/* Natural Crazy-Paving Flagstone Courtyard Terrace grounded flush onto `-0.36` meadow (`top = -0.30`) */}
      <mesh position={[2.15, -0.33, 2.95]} geometry={courtyardPatioGeo} material={flagstoneMat} receiveShadow />

      {/* Near-Bank Curved Mossy Dry-Stone Planter Terraces ("一圈石台") packed with Manicured Owner-Tended Flora! */}
      {nearBankTerraces.map((tr, ti) => (
        <group key={`terrace-${ti}`}>
          <mesh geometry={tr.wallGeo} material={rubbleStoneMat} castShadow receiveShadow />
          <mesh geometry={tr.soilGeo} material={terraceSoilMat} receiveShadow />
          {tr.ivyStems.map((ig, ii) => (
            <mesh key={`tivy-${ii}`} geometry={ig} castShadow>
              <meshStandardMaterial color="#4D6832" roughness={0.86} />
            </mesh>
          ))}
          {tr.plantCenters.map((pc, pi) => {
            const roseColors = ['#EA90A8', '#FDF3DF', '#F0B28C', '#E47B96'];
            const rCol = roseColors[(ti + pi) % roseColors.length];
            const showPot = (ti + pi) % 3 === 1;
            return (
              <group key={`tpl-${pi}`} position={[pc.x, pc.y, pc.z]} rotation={[0, pc.rotY + pi * 0.7, 0]}>
                {showPot ? (
                  <group position={[0, -0.004, 0]}>
                    <mesh geometry={terracePotGeo} castShadow receiveShadow>
                      <meshStandardMaterial
                        map={craftAssets.matteCeramicGlaze.map}
                        normalMap={craftAssets.matteCeramicGlaze.normalMap}
                        roughnessMap={craftAssets.matteCeramicGlaze.roughnessMap}
                        color={(ti + pi) % 2 === 0 ? '#CE8A65' : '#9AA98C'}
                        roughness={0.82}
                      />
                    </mesh>
                    <mesh position={[0, 0.23, 0]} scale={1.15} geometry={terraceLeafGeo} material={terraceLeafWindMat} castShadow />
                    <mesh
                      position={[0.02, 0.31, 0.01]}
                      rotation={[0.25, pi, 0.1]}
                      scale={1.2}
                      geometry={terraceRoseGeo}
                      material={terraceRoseWindMats[rCol]}
                    />
                  </group>
                ) : (
                  <>
                    <mesh position={[0, 0.02, 0]} scale={[1.45, 1.35, 1.45]} geometry={terraceLeafGeo} material={terraceLeafWindMat} castShadow />
                    {/* Tall Tapering Provence Delphinium / Foxglove Spires + Shasta Daisies woven between roses */}
                    {(ti + pi) % 2 === 0 && (
                      <>
                        <mesh
                          position={[-0.06, 0.0, -0.05]}
                          rotation={[0.08, pi * 1.1, -0.06]}
                          scale={[1.0, 0.88 + (pi % 3) * 0.14, 1.0]}
                          geometry={terraceDelphiniumGeo}
                          material={delphiniumWindMats[pi % 2 === 0 ? '#FFFFFF' : '#E2D6FA']}
                          castShadow
                        />
                        <mesh
                          position={[0.07, 0.0, 0.04]}
                          rotation={[-0.06, pi * 1.9, 0.09]}
                          scale={[0.92, 0.78 + (ti % 2) * 0.16, 0.92]}
                          geometry={terraceDelphiniumGeo}
                          material={delphiniumWindMats['#D4BEF6']}
                          castShadow
                        />
                      </>
                    )}
                    {[
                      [0.09, 0.15, 0.06],
                      [-0.09, 0.13, -0.05],
                    ].map(([dx, dy, dz], di) => (
                      <mesh
                        key={`tdsy-${di}`}
                        position={[dx, dy, dz]}
                        rotation={[0.25 * (di === 0 ? 1 : -1), di * 1.6 + pi, 0.12]}
                        scale={1.35}
                        geometry={terraceDaisyGeo}
                        material={terraceDaisyWindMat}
                      />
                    ))}
                    {[
                      [0.0, 0.14, 0.0, 1.38],
                      [-0.08, 0.11, 0.06, 1.15],
                      [0.08, 0.12, -0.05, 1.22],
                    ].map(([rx, ry, rz, rs], ri) => (
                      <mesh
                        key={`trose-${ri}`}
                        position={[rx, ry, rz]}
                        rotation={[0.25 * (ri - 1), ri * 2.1 + pi, 0.18]}
                        scale={rs}
                        geometry={terraceRoseGeo}
                        material={terraceRoseWindMats[rCol]}
                        castShadow
                      />
                    ))}
                  </>
                )}
              </group>
            );
          })}
        </group>
      ))}

      {/* 4 Weathered French Carved Stone & Terracotta Topiary Urns flanking Veranda & Promenade Entries */}
      {[
        { pos: [6.48, -0.36, -0.58] as [number, number, number], roseCol: '#F29EB4' },
        { pos: [6.48, -0.36, 2.35] as [number, number, number], roseCol: '#FAF2DF' },
        { pos: [-0.95, -0.36, 6.45] as [number, number, number], roseCol: '#F29EB4' },
        { pos: [2.65, -0.36, 6.45] as [number, number, number], roseCol: '#EAB48E' },
      ].map((urn, ui) => (
        <group key={`stone-urn-${ui}`} position={urn.pos}>
          {/* Molded stone square plinth + carved French urn pedestal & ribbed bowl */}
          <mesh position={[0, 0.06, 0]} material={rubbleStoneMat} castShadow receiveShadow>
            <boxGeometry args={[0.38, 0.12, 0.38]} />
          </mesh>
          <mesh position={[0, 0.18, 0]} material={rubbleStoneMat} castShadow>
            <cylinderGeometry args={[0.10, 0.15, 0.14, 16]} />
          </mesh>
          <mesh position={[0, 0.24, 0]} geometry={urnBasinGeo} castShadow receiveShadow>
            <meshStandardMaterial
              map={craftAssets.matteCeramicGlaze.map}
              normalMap={craftAssets.matteCeramicGlaze.normalMap}
              roughnessMap={craftAssets.matteCeramicGlaze.roughnessMap}
              color={ui % 2 === 0 ? '#D4C8B4' : '#C98A68'}
              roughness={0.84}
            />
          </mesh>
          <mesh position={[0, 0.59, 0]} scale={[2.35, 2.15, 2.35]} geometry={terraceLeafGeo} material={terraceLeafWindMat} castShadow />
          <mesh
            position={[0.02, 0.68, 0.01]}
            rotation={[0.15, ui * 1.3, 0.08]}
            scale={0.95}
            geometry={terraceDelphiniumGeo}
            material={delphiniumWindMats[ui % 2 === 0 ? '#DFD4FA' : '#FFF8EC']}
            castShadow
          />
          {[
            [0.09, 0.71, 0.08],
            [-0.08, 0.69, -0.07],
            [0.06, 0.67, -0.09],
          ].map(([rx, ry, rz], ri) => (
            <mesh
              key={`urn-rose-${ri}`}
              position={[rx, ry, rz]}
              rotation={[0.28, ri * 2.1 + ui, 0.16]}
              scale={1.35}
              geometry={terraceRoseGeo}
              material={terraceRoseWindMats[urn.roseCol]}
              castShadow
            />
          ))}
        </group>
      ))}

      {/* Cascading Blooming Provence Wisteria Racemes along Rose Arch Pergola & Veranda Eave Beams (GPU breeze sway!) */}
      {[
        { pos: [6.38, 2.28, -2.05] as [number, number, number], rotY: Math.PI / 2, sc: 1.02 },
        { pos: [6.38, 2.32, -1.25] as [number, number, number], rotY: Math.PI / 2, sc: 0.96 },
        { pos: [5.88, 3.47, -2.15] as [number, number, number], rotY: 0.4, sc: 1.05 },
        { pos: [5.88, 3.47, 2.15] as [number, number, number], rotY: 1.2, sc: 1.05 },
        { pos: [3.95, 3.49, 5.98] as [number, number, number], rotY: 0.8, sc: 1.02 },
        { pos: [0.85, 3.49, 5.98] as [number, number, number], rotY: 2.1, sc: 1.04 },
      ].map((wis, wi) => (
        <group key={`wisteria-${wi}`} position={wis.pos} rotation={[0, wis.rotY, 0]} scale={wis.sc}>
          <mesh position={[0, 0.02, 0]} scale={[1.65, 1.15, 1.65]} geometry={terraceLeafGeo} material={terraceLeafWindMat} castShadow />
          {[
            [-0.12, -0.02, 0.06, 0.72],
            [0.02, 0.0, -0.05, 0.82],
            [0.14, -0.03, 0.04, 0.68],
          ].map(([wx, wy, wz, ws], ci) => (
            <mesh
              key={`wrac-${ci}`}
              position={[wx, wy, wz]}
              rotation={[Math.PI + 0.08 * (ci - 1), ci * 1.4, 0.05 * (ci - 1)]}
              scale={[1.05, ws, 1.05]}
              geometry={terraceDelphiniumGeo}
              material={delphiniumWindMats[ci % 2 === 0 ? '#D4B6F4' : '#E3CEFA']}
              castShadow
            />
          ))}
        </group>
      ))}

      {/* Cotswold / Provence Manor Estate Limestone Parapet Wall, Finial Piers & Rose-Lavender Hedgerows framing Gazebo & East Vista */}
      {[
        { pos: [-4.4, -0.02, 23.15] as [number, number, number], rotY: -0.10, w: 2.8 },
        { pos: [-1.65, -0.02, 23.38] as [number, number, number], rotY: -0.04, w: 2.7 },
        { pos: [1.20, -0.02, 23.48] as [number, number, number], rotY: 0.0, w: 3.1 },
        { pos: [4.10, -0.02, 23.38] as [number, number, number], rotY: 0.05, w: 2.7 },
        { pos: [6.80, -0.02, 23.12] as [number, number, number], rotY: 0.12, w: 2.8 },
        // Asymmetric East meadow estate dry-stone border flanking distant meadow (clear of East step stones & Windmill!)
        { pos: [16.5, -0.04, -2.6] as [number, number, number], rotY: 1.48, w: 3.6 },
        { pos: [16.9, -0.04, 4.4] as [number, number, number], rotY: 1.66, w: 3.4 },
      ].map((seg, si) => (
        <group key={`estate-wall-${si}`} position={seg.pos} rotation={[0, seg.rotY, 0]}>
          <mesh material={rubbleStoneMat} castShadow receiveShadow>
            <boxGeometry args={[seg.w, 0.68, 0.34]} />
          </mesh>
          <mesh position={[0, 0.355, 0]} castShadow receiveShadow>
            <boxGeometry args={[seg.w + 0.06, 0.055, 0.40]} />
            <meshStandardMaterial
              normalMap={craftAssets.rubbleStone.normalMap}
              normalScale={RUBBLE_NORMAL_SCALE}
              color="#798C64"
              roughness={0.92}
            />
          </mesh>
          {/* Layered Blooming Delphinium, Rose & Foliage Hedgerow nestled along the front stone footing (`y = -0.34`) */}
          {[-seg.w * 0.32, 0, seg.w * 0.32].map((hx, hi) => (
            <group key={`ehedge-${hi}`} position={[hx, -0.34, -0.30]} rotation={[0, hi * 1.1 + si, 0]}>
              <mesh scale={[2.2, 1.9, 2.2]} geometry={terraceLeafGeo} material={terraceLeafWindMat} castShadow />
              <mesh
                position={[0.04, -0.02, 0.02]}
                scale={[1.1, 1.05, 1.1]}
                geometry={terraceDelphiniumGeo}
                material={delphiniumWindMats[(si + hi) % 2 === 0 ? '#CFC0F6' : '#E6DAFC']}
              />
              {[
                [-0.08, 0.14, 0.04],
                [0.08, 0.16, -0.03],
              ].map(([rx, ry, rz], ri) => (
                <mesh
                  key={`ehrose-${ri}`}
                  position={[rx, ry, rz]}
                  rotation={[0.3, ri * 2.1, 0.1]}
                  scale={1.45}
                  geometry={terraceRoseGeo}
                  material={terraceRoseWindMats[(si + ri) % 2 === 0 ? '#EB8CA4' : '#FAF0DC']}
                />
              ))}
            </group>
          ))}
        </group>
      ))}
      {/* Carved Limestone Estate Pier Columns with Finial Spheres & Terracotta Urns along Behind-Gazebo Parapet */}
      {[
        { pos: [-5.8, -0.36, 23.02] as [number, number, number], urn: false },
        { pos: [-3.0, -0.36, 23.28] as [number, number, number], urn: false },
        { pos: [-0.35, -0.36, 23.44] as [number, number, number], urn: true },
        { pos: [2.75, -0.36, 23.44] as [number, number, number], urn: true },
        { pos: [5.4, -0.36, 23.26] as [number, number, number], urn: false },
        { pos: [8.15, -0.36, 22.98] as [number, number, number], urn: false },
        { pos: [16.3, -0.36, -0.8] as [number, number, number], urn: true },
        { pos: [16.7, -0.36, 2.7] as [number, number, number], urn: true },
      ].map((pier, pi) => (
        <group key={`epier-${pi}`} position={pier.pos}>
          <mesh position={[0, 0.46, 0]} material={rubbleStoneMat} castShadow receiveShadow>
            <boxGeometry args={[0.46, 0.92, 0.46]} />
          </mesh>
          <mesh position={[0, 0.945, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.54, 0.06, 0.54]} />
            <meshStandardMaterial
              normalMap={craftAssets.rubbleStone.normalMap}
              normalScale={RUBBLE_NORMAL_SCALE}
              color="#8C9382"
              roughness={0.88}
            />
          </mesh>
          {pier.urn ? (
            <group position={[0, 0.975, 0]}>
              <mesh geometry={urnBasinGeo} castShadow>
                <meshStandardMaterial
                  map={craftAssets.matteCeramicGlaze.map}
                  normalMap={craftAssets.matteCeramicGlaze.normalMap}
                  roughnessMap={craftAssets.matteCeramicGlaze.roughnessMap}
                  color="#C98A68"
                  roughness={0.84}
                />
              </mesh>
              <mesh position={[0, 0.34, 0]} scale={[2.1, 1.9, 2.1]} geometry={terraceLeafGeo} material={terraceLeafWindMat} />
              <mesh position={[0, 0.46, 0]} scale={1.35} geometry={terraceRoseGeo} material={terraceRoseWindMats['#F2A4BA']} />
            </group>
          ) : (
            <mesh position={[0, 1.12, 0]} material={rubbleStoneMat} castShadow>
              <sphereGeometry args={[0.16, 16, 12]} />
            </mesh>
          )}
        </group>
      ))}

      {/* Rolling Simplex Hills are now seamlessly sculpted directly into meadowGeo with Ghibli Gradient Shader! */}

      {/* Curved Natural Flagstone Stepping Stones (`青石汀步`) grounded flush onto `-0.36` meadow! */}
      {steppingStonePositions.map(([sx, sy, sz, sr], idx) => (
        <mesh
          key={`step-stone-${idx}`}
          position={[sx, sy, sz]}
          rotation={[0, idx * 0.55, 0]}
          scale={[1.18, 0.22, 0.90]}
          material={flagstoneMat}
          receiveShadow
        >
          <cylinderGeometry args={[sr, sr * 1.03, 0.24, 16]} />
        </mesh>
      ))}

      {/* Low Mossy Dry-Stone Garden Curb grounded onto terrain height */}
      {[
        { pos: [6.36, sampleGhibliTerrainHeight(6.36, -3.22) + 0.12, -3.22] as [number, number, number], size: [0.28, 0.28, 1.24] as [number, number, number] },
        { pos: [6.36, sampleGhibliTerrainHeight(6.36, 4.95) + 0.12, 4.95] as [number, number, number], size: [0.28, 0.28, 3.45] as [number, number, number] },
        { pos: [4.01, sampleGhibliTerrainHeight(4.01, 6.78) + 0.12, 6.78] as [number, number, number], size: [4.42, 0.28, 0.28] as [number, number, number] },
        { pos: [-2.65, sampleGhibliTerrainHeight(-2.65, 6.78) + 0.12, 6.78] as [number, number, number], size: [5.05, 0.28, 0.28] as [number, number, number] },
      ].map((w, wi) => (
        <group key={`yard-wall-${wi}`} position={w.pos}>
          <mesh material={rubbleStoneMat} castShadow receiveShadow>
            <boxGeometry args={w.size} />
          </mesh>
          <mesh position={[0, 0.155, 0]} castShadow receiveShadow>
            <boxGeometry args={[w.size[0] + 0.04, 0.04, w.size[2] + 0.04]} />
            <meshStandardMaterial
              normalMap={craftAssets.rubbleStone.normalMap}
              normalScale={RUBBLE_NORMAL_SCALE}
              color="#688052"
              roughness={0.92}
            />
          </mesh>
        </group>
      ))}
      {/* Paired Mossy Stone Entry Piers grounded onto terrain height framing South Promenade Gateway */}
      {[-0.08, 1.78].map((px, pi) => (
        <group key={`gate-pier-${pi}`} position={[px, sampleGhibliTerrainHeight(px, 6.78) + 0.19, 6.78]}>
          <mesh material={rubbleStoneMat} castShadow receiveShadow>
            <boxGeometry args={[0.36, 0.38, 0.36]} />
          </mesh>
          <mesh position={[0, 0.21, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.42, 0.05, 0.42]} />
            <meshStandardMaterial
              normalMap={craftAssets.rubbleStone.normalMap}
              normalScale={RUBBLE_NORMAL_SCALE}
              color="#768C60"
              roughness={0.88}
            />
          </mesh>
        </group>
      ))}

      {/* Climbing-Rose Garden Arch grounded cleanly at `y = -0.36` & clear of East Stone Yard Wall! */}
      <ClimbingRoseGardenArchGate
        position={[6.38, -0.36, -1.65]}
        rotation={[0, Math.PI / 2, 0]}
        timberMat={agedTimberMat}
        windTime={grassWindTime}
      />

      {/* ====================================================================
          3. THE SEMI-OPEN COUNTRY COTTAGE HOUSE & COVERED VERANDA ENGAWA
         ==================================================================== */}
      {/* Warm Sun-Aged Satin Cottage Wood Floor with World-Space Wood-Fiber Micro-Detail & Box-Projected Sheen */}
      <mesh position={[-0.15, -0.07, 0.62]} geometry={cottageFloorGeo} material={cottageFloorMat} receiveShadow castShadow />

      {/* LAYER 2: Raised Covered Timber Veranda Deck (`木质挑檐廊台`, y = -0.06m) — Non-overlapping Beveled Decks + Fascia Skirt! */}
      <group>
        {/* East Veranda Timber Deck (x = 4.78 .. 6.10, z = -3.80 .. +4.96 — stops flush at South Deck, ZERO Z-fighting!) */}
        <mesh position={[5.44, -0.095, 0.58]} geometry={eastDeckGeo} material={pineRoofMat} castShadow receiveShadow />
        {/* East Veranda Under-Deck Apron Fascia Board */}
        <mesh position={[6.07, -0.175, 0.58]} material={agedTimberMat} castShadow receiveShadow>
          <boxGeometry args={[0.05, 0.14, 8.76]} />
        </mesh>
        {/* East Wide Wooden Porch Step + Solid Stone Lower Riser grounded flush onto `-0.36` meadow */}
        <mesh position={[6.22, -0.145, 0.85]} material={agedTimberMat} castShadow receiveShadow>
          <boxGeometry args={[0.26, 0.06, 3.20]} />
        </mesh>
        <mesh position={[6.28, -0.265, 0.85]} material={rubbleStoneMat} castShadow receiveShadow>
          <boxGeometry args={[0.32, 0.19, 3.20]} />
        </mesh>
        {/* South Veranda Timber Deck (x = -5.18 .. 6.08, z = 4.96 .. 6.20) */}
        <mesh position={[0.45, -0.095, 5.58]} geometry={southDeckGeo} material={pineRoofMat} castShadow receiveShadow />
        <mesh position={[0.45, -0.175, 6.17]} material={agedTimberMat} castShadow receiveShadow>
          <boxGeometry args={[11.25, 0.14, 0.05]} />
        </mesh>
        <mesh position={[0.85, -0.145, 6.32]} material={agedTimberMat} castShadow receiveShadow>
          <boxGeometry args={[3.80, 0.06, 0.26]} />
        </mesh>
        <mesh position={[0.85, -0.265, 6.38]} material={rubbleStoneMat} castShadow receiveShadow>
          <boxGeometry args={[3.80, 0.19, 0.32]} />
        </mesh>

        {/* 严丝合缝的法式廊檐木斜撑（精准顶贴檐底，绝不穿透屋檐顶板！） */}
        {[-3.45, -1.05, 2.75, 4.55].map((pz, ei) => (
          <group key={`eave-cbrk-e-${ei}`} position={[4.86, 3.12, pz]}>
            <mesh position={[0.32, 0.22, 0]} rotation={[0, 0, 0.72]} material={agedTimberMat} castShadow>
              <boxGeometry args={[0.09, 0.68, 0.09]} />
            </mesh>
            <mesh position={[0.38, 0.42, 0]} rotation={[0, 0, -0.22]} material={agedTimberMat} castShadow>
              <boxGeometry args={[0.82, 0.075, 0.09]} />
            </mesh>
          </group>
        ))}
        {[-4.65, -1.30, 2.65, 4.45].map((px, si) => (
          <group key={`eave-cbrk-s-${si}`} position={[px, 3.12, 5.04]}>
            <mesh position={[0, 0.22, 0.32]} rotation={[-0.72, 0, 0]} material={agedTimberMat} castShadow>
              <boxGeometry args={[0.09, 0.68, 0.09]} />
            </mesh>
            <mesh position={[0, 0.42, 0.38]} rotation={[0.22, 0, 0]} material={agedTimberMat} castShadow>
              <boxGeometry args={[0.09, 0.075, 0.82]} />
            </mesh>
          </group>
        ))}
        {/* 移除悬空断裂的铜雨链，留出清爽优雅的东/南木露台呼吸框景 */}
      </group>

      {/* Oblique Conservatory Window-Mullion & Vine-Leaf Gobo Sunlight Pools */}
      {[
        { pos: [1.85, 0.0026, 2.25] as [number, number, number], size: [2.65, 1.92] as [number, number], rot: -0.34, op: 0.68 },
        { pos: [0.45, 0.0026, 2.95] as [number, number, number], size: [2.25, 1.65] as [number, number], rot: -0.32, op: 0.56 },
        { pos: [2.68, 0.0026, -0.68] as [number, number, number], size: [2.40, 1.75] as [number, number], rot: -0.36, op: 0.60 },
      ].map((sp, idx) => (
        <mesh
          key={`sunpatch-${idx}`}
          ref={(el) => {
            sunPatchRefs.current[idx] = el;
          }}
          position={sp.pos}
          rotation={[-Math.PI / 2, 0, sp.rot]}
          raycast={() => null}
        >
          <planeGeometry args={sp.size} />
          <meshBasicMaterial
            map={sunPatchTex}
            color="#FFE09C"
            transparent
            opacity={sp.op}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* Dedicated Swaying Window+Leaf Sunbeam Patch strictly BELOW Tabletop ContactShadows (0.9215 < 0.9223) */}
      <mesh
        ref={tableSunPatchRef}
        position={[0.56, 0.9215, -0.02]}
        rotation={[-Math.PI / 2, 0, -0.34]}
        raycast={() => null}
      >
        <planeGeometry args={[1.14, 0.70]} />
        <meshBasicMaterial
          map={sunPatchTex}
          color="#FFDF98"
          transparent
          opacity={0.42}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
      {[
        [-3.15, -2.55],
        [3.35, -2.55],
        [-3.95, -1.45],
      ].map(([jx, jz], idx) => (
        <mesh
          key={`jewel-${idx}`}
          position={[jx, 0.0025, jz]}
          rotation={[-Math.PI / 2, 0, 0.18]}
          raycast={() => null}
        >
          <planeGeometry args={[1.45, 1.25]} />
          <meshBasicMaterial
            map={jewelCausticTex}
            transparent
            opacity={jx < 0 ? 0.24 : 0.56}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* A. NORTH COTTAGE WALL (z = -3.72): True Arched Window Openings + 6-Pane Recessed French Casements! */}
      <group position={[-0.15, 0, -3.72]}>
        {/* Lower Beadboard Wainscoting & Molded Chair Rail */}
        <mesh position={[0, 0.56, 0]} material={beadboardMat} receiveShadow>
          <boxGeometry args={[10.1, 1.12, 0.22]} />
        </mesh>
        <mesh position={[0, 1.14, 0.03]} material={agedTimberMat} castShadow>
          <boxGeometry args={[10.16, 0.065, 0.28]} />
        </mesh>

        {/* Precision Non-Overlapping Botanical Wallpaper Wall Segments */}
        {/* Window 1 opening: x in [-3.64, -2.36] (center -3.00 -> world x = -3.15) */}
        {/* Window 2 opening: x in [+2.86, +4.14] (center +3.50 -> world x = +3.35) */}
        {[
          { x: -4.345, w: 1.41 },
          { x: 0.25, w: 5.22 },
          { x: 4.595, w: 0.91 },
        ].map((seg, si) => (
          <mesh key={si} position={[seg.x, 2.54, 0]} material={wallpaperMat} receiveShadow>
            <boxGeometry args={[seg.w, 2.76, 0.20]} />
          </mesh>
        ))}
        {/* True Arched Spandrel Wall Headers above Windows (leaves semicircular fanlight arch 100% open to sky & trees!) */}
        <mesh position={[-3.00, 0, 0]} geometry={northWindowWallHeaderGeo} material={wallpaperMat} receiveShadow />
        <mesh position={[3.50, 0, 0]} geometry={northWindowWallHeaderGeo} material={wallpaperMat} receiveShadow />

        {/* 2 Architectural Profiled Sage-Green Enamel Conservatory Casements (`85918c0f` Botanical Stained-Glass Border + Clear 6-Pane Center!) */}
        <ConservatoryCasementWindow
          position={[-3.00, 0, 0]}
          width={1.28}
          sillY={1.18}
          springY={2.52}
          sageFrameMat={sageEnamelFrameMat}
          glassMat={conservatoryGlassMat}
          stainedBorderMat={stainedBorderGlassMat}
          ironMat={wroughtIronMat}
          curtainMat={sheerCurtainMat}
        />
        <ConservatoryCasementWindow
          position={[3.50, 0, 0]}
          width={1.28}
          sillY={1.18}
          springY={2.52}
          sageFrameMat={sageEnamelFrameMat}
          glassMat={conservatoryGlassMat}
          stainedBorderMat={stainedBorderGlassMat}
          ironMat={wroughtIronMat}
          curtainMat={sheerCurtainMat}
        />

        {/* Exposed Half-Timbering Cottage Posts */}
        {[-4.98, -2.18, 0.42, 2.68, 4.92].map((tx, ti) => (
          <mesh key={ti} position={[tx, 1.98, 0.04]} material={agedTimberMat} castShadow>
            <boxGeometry args={[0.13, 3.96, 0.24]} />
          </mesh>
        ))}
      </group>

      {/* B. WEST COTTAGE WALL (x = -5.18): True Arched Window Opening + Grand Sage-Enamel Stained-Glass Border Casement! */}
      <group position={[-5.18, 0, 0.62]} rotation={[0, Math.PI / 2, 0]}>
        {/* Note: In rotated local coords, local +X points toward world -Z! */}
        {/* Window opening at local x = +2.05 (world z = -1.43), width = 1.44m -> local [1.33, 2.77] */}
        <mesh position={[0, 0.56, 0]} material={beadboardMat} receiveShadow>
          <boxGeometry args={[8.75, 1.12, 0.22]} />
        </mesh>
        <mesh position={[0, 1.14, 0.03]} material={agedTimberMat}>
          <boxGeometry args={[8.80, 0.065, 0.28]} />
        </mesh>
        {[
          { x: -1.5225, w: 5.705 },
          { x: 3.5725, w: 1.605 },
        ].map((seg, si) => (
          <mesh key={si} position={[seg.x, 2.54, 0]} material={wallpaperMat} receiveShadow>
            <boxGeometry args={[seg.w, 2.76, 0.20]} />
          </mesh>
        ))}
        <mesh position={[2.05, 0, 0]} geometry={westWindowWallHeaderGeo} material={wallpaperMat} receiveShadow />

        <ConservatoryCasementWindow
          position={[2.05, 0, 0]}
          width={1.44}
          sillY={1.18}
          springY={2.50}
          sageFrameMat={sageEnamelFrameMat}
          glassMat={conservatoryGlassMat}
          stainedBorderMat={stainedBorderGlassMat}
          ironMat={wroughtIronMat}
          curtainMat={sheerCurtainMat}
        />

        {/* Pleated Silk Sconce between West Casement & Cat Tree */}
        <CottageWallSconce position={[0.84, 2.28, 0.12]} />
      </group>

      {/* C. EAST & SOUTH CONSERVATORY SAGE-ENAMEL PORTALS & BOTANICAL MEDALLION FRENCH DOORS (`85918c0f`) */}
      <group position={[4.78, 0, 0]}>
        {/* Outer Corner Posts + 2 Full-Height Sage-Green Portal Threshold Piers framing the Open East Veranda Porch Walkthrough! */}
        {[-3.65, -1.05, 2.75, 4.96].map((pz, pi) => (
          <mesh key={pi} position={[0, 1.87, pz]} material={sageEnamelFrameMat} castShadow receiveShadow>
            <boxGeometry args={[0.16, 3.74, 0.16]} />
          </mesh>
        ))}
        {/* Upper Sage-Enamel Portal Header Beam + Horizontal Transom Beam */}
        <mesh position={[0, 3.74, 0.65]} material={sageEnamelFrameMat} castShadow>
          <boxGeometry args={[0.22, 0.40, 8.80]} />
        </mesh>
        <mesh position={[0, 2.94, 0.65]} material={sageEnamelFrameMat} castShadow>
          <boxGeometry args={[0.20, 0.10, 8.80]} />
        </mesh>
        {/* Botanical Stained-Glass Tracery Clerestory Grid Panes (`y = 2.99 .. 3.54`) + Sage Vertical Mullions */}
        {eastClerestoryBays.slice(0, -1).map((z0, bi) => {
          const z1 = eastClerestoryBays[bi + 1];
          return (
            <mesh
              key={`eclere-${bi}`}
              position={[0, 3.26, (z0 + z1) * 0.5]}
              rotation={[0, -Math.PI / 2, 0]}
              material={transomFloralGlassMat}
            >
              <planeGeometry args={[z1 - z0, 0.56]} />
            </mesh>
          );
        })}
        {[-3.00, -2.35, -1.70, -0.35, 0.30, 0.95, 1.60, 2.25, 3.45, 4.20].map((mz, mi) => (
          <mesh key={`emul-${mi}`} position={[0, 3.26, mz]} material={sageEnamelFrameMat} castShadow>
            <boxGeometry args={[0.08, 0.56, 0.045]} />
          </mesh>
        ))}

        {/* Pleated Cottage Wall Sconces flanking the Open East Veranda Portal */}
        <CottageWallSconce position={[-0.08, 2.28, -1.05]} rotation={[0, -Math.PI / 2, 0]} />
        <CottageWallSconce position={[-0.08, 2.28, 2.75]} rotation={[0, -Math.PI / 2, 0]} />

        {/* Bi-Fold French Doors + 同款鼠尾草绿彩绘花窗折叠屏风与白蕾丝纱帘（填补图2左框 & 图3红框敞空边界！） */}
        <OpenBiFoldCottageDoors
          position={[0.08, 0, -3.48]}
          rotation={[0, -Math.PI / 2, 0]}
          foldDirection={1}
          frameMat={sageEnamelFrameMat}
          glassMat={doorMedallionGlassMat}
        />
        {/* 图3 北中段收音机旁至黑板后方：三扇微折彩绘花窗屏风 + 蕾丝白帘 */}
        <FrenchStainedFoldingScreen
          position={[0.16, 0, -2.35]}
          rotation={[0, Math.PI / 2, 0]}
          panels={3}
          foldAngle={0.22}
          frameMat={sageEnamelFrameMat}
          glassMat={doorMedallionGlassMat}
          ironMat={wroughtIronMat}
          curtainMat={sheerCurtainMat}
        />
        {/* 图3 黑板后正对风车与图2 左框核心跨：双组连贯双扇花窗屏风，透光赏景同时端庄框景 */}
        <FrenchStainedFoldingScreen
          position={[0.16, 0, -0.18]}
          rotation={[0, Math.PI / 2, 0]}
          panels={2}
          foldAngle={0.26}
          frameMat={sageEnamelFrameMat}
          glassMat={doorMedallionGlassMat}
          ironMat={wroughtIronMat}
          curtainMat={sheerCurtainMat}
        />
        <FrenchStainedFoldingScreen
          position={[0.16, 0, 1.88]}
          rotation={[0, Math.PI / 2, 0]}
          panels={3}
          foldAngle={0.22}
          frameMat={sageEnamelFrameMat}
          glassMat={doorMedallionGlassMat}
          ironMat={wroughtIronMat}
          curtainMat={sheerCurtainMat}
        />
        <FrenchStainedFoldingScreen
          position={[0.16, 0, 3.65]}
          rotation={[0, Math.PI / 2, 0]}
          panels={2}
          foldAngle={0.26}
          frameMat={sageEnamelFrameMat}
          glassMat={doorMedallionGlassMat}
          ironMat={wroughtIronMat}
          curtainMat={sheerCurtainMat}
        />
        <OpenBiFoldCottageDoors
          position={[0.08, 0, 4.78]}
          rotation={[0, -Math.PI / 2, 0]}
          foldDirection={-1}
          frameMat={sageEnamelFrameMat}
          glassMat={doorMedallionGlassMat}
        />

        {/* Framed Corner Pier Linen Curtains hung Proud (`x = -0.24`) on Transom-Anchored Wrought-Iron Rods, clear of Corner Posts! */}
        {[
          { rz: -3.14, len: 0.86, curtZ: -3.22 },
          { rz: 4.44, len: 0.86, curtZ: 4.52 },
        ].map((cr, ci) => (
          <group key={`epier-curt-${ci}`}>
            <mesh position={[-0.24, 2.93, cr.rz]} rotation={[Math.PI / 2, 0, 0]} material={wroughtIronMat}>
              <cylinderGeometry args={[0.011, 0.011, cr.len, 12]} />
            </mesh>
            {[-cr.len * 0.44, cr.len * 0.44].map((bz, bi) => (
              <mesh key={`ebrk-${bi}`} position={[-0.17, 2.93, cr.rz + bz]} material={wroughtIronMat}>
                <boxGeometry args={[0.14, 0.025, 0.022]} />
              </mesh>
            ))}
            <mesh
              position={[-0.24, 1.495, cr.curtZ]}
              rotation={[0, -Math.PI / 2, 0]}
              material={sheerCurtainMat}
              raycast={() => null}
            >
              <planeGeometry args={[0.44, 2.87, 14, 22]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* South Conservatory Portal (z = +4.96): Framed Steps Walkthrough + Sage-Enamel Portal Frame & Floral Medallion French Doors! */}
      <group position={[-0.15, 0, 4.96]}>
        {[-4.96, -1.15, 3.05, 4.96].map((px, pi) => (
          <mesh key={`spier-${pi}`} position={[px, 1.87, 0]} material={sageEnamelFrameMat} castShadow receiveShadow>
            <boxGeometry args={[0.16, 3.74, 0.16]} />
          </mesh>
        ))}
        <mesh position={[0, 3.74, 0]} material={sageEnamelFrameMat} castShadow>
          <boxGeometry args={[10.10, 0.40, 0.22]} />
        </mesh>
        <mesh position={[0, 2.94, 0]} material={sageEnamelFrameMat} castShadow>
          <boxGeometry args={[10.10, 0.10, 0.20]} />
        </mesh>
        {/* Botanical Stained-Glass Tracery Clerestory Grid Panes + Sage Vertical Mullions */}
        {southClerestoryBays.slice(0, -1).map((x0, bi) => {
          const x1 = southClerestoryBays[bi + 1];
          return (
            <mesh
              key={`sclere-${bi}`}
              position={[(x0 + x1) * 0.5, 3.26, 0]}
              rotation={[0, Math.PI, 0]}
              material={transomFloralGlassMat}
            >
              <planeGeometry args={[x1 - x0, 0.56]} />
            </mesh>
          );
        })}
        {[-4.35, -3.70, -3.05, -2.40, -1.75, -0.45, 0.25, 0.95, 1.65, 2.35, 3.68, 4.32].map((mx, mi) => (
          <mesh key={`smul-${mi}`} position={[mx, 3.26, 0]} material={sageEnamelFrameMat} castShadow>
            <boxGeometry args={[0.045, 0.56, 0.08]} />
          </mesh>
        ))}

        <OpenBiFoldCottageDoors
          position={[-4.72, 0, 0.08]}
          rotation={[0, Math.PI, 0]}
          foldDirection={-1}
          frameMat={sageEnamelFrameMat}
          glassMat={doorMedallionGlassMat}
        />
        {/* 图4 蛋壳藤吊椅背后西跨红框 & 图2 右红框东跨：加装同款彩绘椭圆花窗木屏风 + 黑色铁杆白纱帘 */}
        <FrenchStainedFoldingScreen
          position={[-3.68, 0, 0.16]}
          rotation={[0, 0, 0]}
          panels={3}
          foldAngle={0.22}
          frameMat={sageEnamelFrameMat}
          glassMat={doorMedallionGlassMat}
          ironMat={wroughtIronMat}
          curtainMat={sheerCurtainMat}
        />
        <FrenchStainedFoldingScreen
          position={[-1.92, 0, 0.16]}
          rotation={[0, 0, 0]}
          panels={2}
          foldAngle={0.24}
          frameMat={sageEnamelFrameMat}
          glassMat={doorMedallionGlassMat}
          ironMat={wroughtIronMat}
          curtainMat={sheerCurtainMat}
        />
        <FrenchStainedFoldingScreen
          position={[3.82, 0, 0.16]}
          rotation={[0, 0, 0]}
          panels={2}
          foldAngle={0.24}
          frameMat={sageEnamelFrameMat}
          glassMat={doorMedallionGlassMat}
          ironMat={wroughtIronMat}
          curtainMat={sheerCurtainMat}
        />
        <OpenBiFoldCottageDoors
          position={[4.68, 0, 0.08]}
          rotation={[0, Math.PI, 0]}
          foldDirection={1}
          frameMat={sageEnamelFrameMat}
          glassMat={doorMedallionGlassMat}
        />

        {/* Framed Corner Pier Linen Curtains hung Proud (`z = -0.24`) on Transom-Anchored Wrought-Iron Rods, clear of Corner Posts! */}
        {[
          { rx: -4.40, len: 0.90, curtX: -4.46 },
          { rx: 4.40, len: 0.90, curtX: 4.46 },
        ].map((cr, ci) => (
          <group key={`spier-curt-${ci}`}>
            <mesh position={[cr.rx, 2.93, -0.24]} rotation={[0, 0, Math.PI / 2]} material={wroughtIronMat}>
              <cylinderGeometry args={[0.011, 0.011, cr.len, 12]} />
            </mesh>
            {[-cr.len * 0.44, cr.len * 0.44].map((bx, bi) => (
              <mesh key={`sbrk-${bi}`} position={[cr.rx + bx, 2.93, -0.17]} material={wroughtIronMat}>
                <boxGeometry args={[0.022, 0.025, 0.14]} />
              </mesh>
            ))}
            <mesh
              position={[cr.curtX, 1.495, -0.24]}
              rotation={[0, Math.PI, 0]}
              material={sheerCurtainMat}
              raycast={() => null}
            >
              <planeGeometry args={[0.46, 2.87, 14, 22]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* D. 精雕法式田园双坡松木屋顶 + 双面彩绘玫瑰山墙 + 复古烘焙坊招牌 LOGO + 无穿帮廊檐 */}
      <group position={[-0.15, 3.92, 0.62]}>
        {/* 严丝合缝双坡屋顶（长度 9.48m 优雅悬挑盖住南北山墙，精确匹配山墙 0.3012 rad 坡角，零穿帮缝隙！） */}
        <mesh position={[-2.62, 0.78, 0]} rotation={[0, 0, 0.3012]} material={pineRoofMat} castShadow receiveShadow>
          <boxGeometry args={[5.48, 0.095, 9.48]} />
        </mesh>
        <mesh position={[2.62, 0.78, 0]} rotation={[0, 0, -0.3012]} material={pineRoofMat} castShadow receiveShadow>
          <boxGeometry args={[5.48, 0.095, 9.48]} />
        </mesh>
        {/* 精致法式人字封檐护板（Bargeboards）与屋脊护盖，彻底消除屋檐侧边木板毛刺穿帮 */}
        {[-4.72, 4.72].map((bz, bi) => (
          <group key={`barge-${bi}`} position={[0, 0, bz]}>
            <mesh position={[-2.62, 0.76, 0]} rotation={[0, 0, 0.3012]} material={agedTimberMat} castShadow>
              <boxGeometry args={[5.54, 0.16, 0.09]} />
            </mesh>
            <mesh position={[2.62, 0.76, 0]} rotation={[0, 0, -0.3012]} material={agedTimberMat} castShadow>
              <boxGeometry args={[5.54, 0.16, 0.09]} />
            </mesh>
            {/* 人字顶脊尖饰（法式尖顶木雕 Finial） */}
            <mesh position={[0, 1.82, 0]} material={sageEnamelFrameMat} castShadow>
              <cylinderGeometry args={[0.025, 0.055, 0.42, 12]} />
            </mesh>
            <mesh position={[0, 2.04, 0]} material={agedTimberMat}>
              <sphereGeometry args={[0.065, 12, 10]} />
            </mesh>
          </group>
        ))}

        {/* 屋脊主梁 + 复古古铜屋顶小风向标 */}
        <mesh position={[0, 1.60, 0]} material={agedTimberMat} castShadow>
          <boxGeometry args={[0.22, 0.18, 9.54]} />
        </mesh>
        <group position={[0, 1.72, 2.65]}>
          <mesh position={[0, 0.32, 0]}>
            <cylinderGeometry args={[0.016, 0.024, 0.64, 10]} />
            <meshStandardMaterial color="#8A6338" metalness={0.58} roughness={0.42} />
          </mesh>
          <mesh position={[0, 0.56, 0]} rotation={[0, 0.45, Math.PI / 2]}>
            <cylinderGeometry args={[0.010, 0.010, 0.56, 8]} />
            <meshStandardMaterial color="#B58946" metalness={0.62} roughness={0.38} />
          </mesh>
          <mesh position={[0, 0.62, 0]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshStandardMaterial color="#C89C4E" metalness={0.62} roughness={0.38} />
          </mesh>
        </group>

        {/* 双坡玻璃天窗脊带 */}
        {[-0.42, 0.42].map((sx, si) => (
          <mesh
            key={si}
            position={[sx, 1.49, 0]}
            rotation={[0, 0, si === 0 ? 0.3012 : -0.3012]}
            raycast={() => null}
          >
            <boxGeometry args={[0.88, 0.03, 8.95]} />
            <meshPhysicalMaterial color="#FFFDF5" transparent opacity={0.18} roughness={0.18} clearcoat={0.25} clearcoatRoughness={0.18} envMapIntensity={0.42} depthWrite={false} />
          </mesh>
        ))}

        {/* 精雕南北山墙（内外双面彩绘玫瑰圆窗 + 法式半木结构人字雕花饰条，彻底告别光秃白三角！） */}
        {[-4.34, 4.34].map((gz, gi) => {
          const isSouth = gi === 1;
          const outSign = isSouth ? 1 : -1;
          return (
            <group key={gi} position={[0, 0, gz]}>
              <mesh geometry={gableGeo} material={wallpaperMat} receiveShadow />
              {/* 外立面底部鼠尾草绿水平腰线 + 半木结构对称竖梁与斜撑装饰 */}
              <mesh position={[0, 0.06, outSign * 0.105]} material={sageEnamelFrameMat} castShadow>
                <boxGeometry args={[10.04, 0.14, 0.065]} />
              </mesh>
              {[-3.2, -1.65, 1.65, 3.2].map((tx, ti) => {
                const maxH = Math.max(0.28, (1.0 - Math.abs(tx) / 5.02) * 1.48);
                return (
                  <mesh key={`ht-${ti}`} position={[tx, maxH * 0.5, outSign * 0.102]} material={agedTimberMat} castShadow>
                    <boxGeometry args={[0.10, maxH, 0.05]} />
                  </mesh>
                );
              })}
              {/* 外立面人字对称斜木饰条 */}
              {[-1, 1].map((sd, sdi) => (
                <mesh
                  key={`hd-${sdi}`}
                  position={[sd * 2.42, 0.46, outSign * 0.102]}
                  rotation={[0, 0, sd * -0.52]}
                  material={agedTimberMat}
                >
                  <boxGeometry args={[1.48, 0.075, 0.046]} />
                </mesh>
              ))}
              {/* 内外双面透光法式圆形彩绘玫瑰山墙窗（从室外庭院与室内都能欣赏精致彩绘！） */}
              {[-0.115, 0.115].map((zOff, zi) => (
                <group key={`rosew-${zi}`} position={[0, 0.76, zOff]}>
                  <mesh rotation={[0, zOff < 0 ? Math.PI : 0, 0]} material={circularRoseGlassMat}>
                    <circleGeometry args={[0.42, 32]} />
                  </mesh>
                  <mesh position={[0, 0, zOff < 0 ? -0.008 : 0.008]} material={sageEnamelFrameMat}>
                    <boxGeometry args={[0.82, 0.026, 0.030]} />
                  </mesh>
                  <mesh position={[0, 0, zOff < 0 ? -0.008 : 0.008]} material={sageEnamelFrameMat}>
                    <boxGeometry args={[0.026, 0.82, 0.030]} />
                  </mesh>
                  <mesh position={[0, 0, zOff < 0 ? -0.008 : 0.008]} material={sageEnamelFrameMat}>
                    <torusGeometry args={[0.43, 0.048, 12, 32]} />
                  </mesh>
                </group>
              ))}
            </group>
          );
        })}

        {/* 法式烘焙坊外墙立体雕花招牌 LOGO #1：面向南侧花园主立面（清晰置于山墙净空区，绝不穿屋顶与窗横梁！） */}
        <group position={[0, 0.02, 4.78]}>
          {/* 实木雕花外框 */}
          <mesh material={agedTimberMat} castShadow>
            <boxGeometry args={[2.16, 0.78, 0.08]} />
          </mesh>
          {/* 招牌正面高清手绘 LOGO（林间花房烘焙小屋 · LA PÂTISSERIE DU JARDIN） */}
          <mesh position={[0, 0, 0.044]}>
            <planeGeometry args={[2.02, 0.68]} />
            <meshStandardMaterial map={signLogoTex} roughness={0.68} />
          </mesh>
          {/* 顶部复古铁艺饰条 + 左右带完整弯臂支架暖光壁灯 */}
          <mesh position={[0, 0.42, 0]} material={wroughtIronMat}>
            <boxGeometry args={[2.26, 0.04, 0.095]} />
          </mesh>
          {[-1.22, 1.22].map((lx, li) => (
            <group key={`sign-lamp-s-${li}`} position={[lx, 0.18, 0.02]}>
              <mesh position={[lx < 0 ? 0.07 : -0.07, 0.02, 0.04]} material={wroughtIronMat}>
                <boxGeometry args={[0.16, 0.035, 0.035]} />
              </mesh>
              <mesh position={[0, 0.02, 0.12]} material={wroughtIronMat}>
                <boxGeometry args={[0.035, 0.035, 0.18]} />
              </mesh>
              <mesh position={[0, -0.06, 0.18]}>
                <sphereGeometry args={[0.062, 12, 10]} />
                <meshStandardMaterial color="#FFF6DA" emissive="#FFB84A" emissiveIntensity={1.18} roughness={0.3} />
              </mesh>
              <mesh position={[0, 0.01, 0.18]} material={wroughtIronMat}>
                <coneGeometry args={[0.098, 0.065, 12]} />
              </mesh>
            </group>
          ))}
        </group>

        {/* 法式烘焙坊外墙立体雕花招牌 LOGO #2：面向东侧跨溪木桥与庭院（下移避开斜屋檐顶，补全左右锻铁支架臂！） */}
        <group position={[5.82, -0.02, 1.25]} rotation={[0, Math.PI / 2, 0]}>
          <mesh material={agedTimberMat} castShadow>
            <boxGeometry args={[2.04, 0.74, 0.08]} />
          </mesh>
          <mesh position={[0, 0, 0.044]}>
            <planeGeometry args={[1.90, 0.64]} />
            <meshStandardMaterial map={signLogoTex} roughness={0.68} />
          </mesh>
          <mesh position={[0, 0, -0.044]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[1.90, 0.64]} />
            <meshStandardMaterial map={signLogoTex} roughness={0.68} />
          </mesh>
          <mesh position={[0, 0.40, 0]} material={wroughtIronMat}>
            <boxGeometry args={[2.14, 0.04, 0.095]} />
          </mesh>
          {[-1.18, 1.18].map((lx, li) => (
            <group key={`sign-lamp-e-${li}`} position={[lx, 0.16, 0.02]}>
              {/* 横向连接木框支架 + 前伸弯臂（彻底消除悬空灯具！） */}
              <mesh position={[lx < 0 ? 0.08 : -0.08, 0.02, 0.02]} material={wroughtIronMat}>
                <boxGeometry args={[0.18, 0.032, 0.032]} />
              </mesh>
              <mesh position={[0, 0.02, 0.09]} material={wroughtIronMat}>
                <boxGeometry args={[0.032, 0.032, 0.16]} />
              </mesh>
              <mesh position={[0, -0.055, 0.14]}>
                <sphereGeometry args={[0.058, 12, 10]} />
                <meshStandardMaterial color="#FFF6DA" emissive="#FFB84A" emissiveIntensity={1.18} roughness={0.3} />
              </mesh>
              <mesh position={[0, 0.015, 0.14]} material={wroughtIronMat}>
                <coneGeometry args={[0.092, 0.062, 12]} />
              </mesh>
            </group>
          ))}
        </group>

        {/* ONLY Outer End Timber Trusses (`z = -3.4, 4.6`) — middle ceiling kept 100% open & unobstructed! */}
        {rafterZs.map((rz, ri) => (
          <group key={ri} position={[0, 0, rz - 0.62]}>
            <mesh position={[0, 0.06, 0]} material={agedTimberMat} castShadow>
              <boxGeometry args={[9.85, 0.14, 0.14]} />
            </mesh>
            <mesh position={[0, 0.80, 0]} material={agedTimberMat}>
              <boxGeometry args={[0.12, 1.44, 0.12]} />
            </mesh>
            <mesh position={[-2.52, 0.76, 0]} rotation={[0, 0, 0.3012]} material={agedTimberMat}>
              <boxGeometry args={[5.15, 0.12, 0.11]} />
            </mesh>
            <mesh position={[2.52, 0.76, 0]} rotation={[0, 0, -0.3012]} material={agedTimberMat}>
              <boxGeometry args={[5.15, 0.12, 0.11]} />
            </mesh>
            <mesh position={[-0.62, 0.44, 0]} rotation={[0, 0, -0.75]} material={agedTimberMat}>
              <boxGeometry args={[0.92, 0.08, 0.09]} />
            </mesh>
            <mesh position={[0.62, 0.44, 0]} rotation={[0, 0, 0.75]} material={agedTimberMat}>
              <boxGeometry args={[0.92, 0.08, 0.09]} />
            </mesh>
          </group>
        ))}

        {/* 4 Angled Timber Corner Knee Braces & Diagonal Top-Plate Corner Ties (NW, NE, SW, SE interior corners) */}
        {[
          { x: -4.45, z: -3.76, ry: Math.PI / 4, kx: -4.60, kz: -4.02, krz: 0.78 },
          { x: 4.37, z: -3.76, ry: -Math.PI / 4, kx: 4.52, kz: -4.02, krz: -0.78 },
          { x: -4.45, z: 3.78, ry: -Math.PI / 4, kx: -4.60, kz: 3.98, krz: 0.78 },
          { x: 4.37, z: 3.78, ry: Math.PI / 4, kx: 4.52, kz: 3.98, krz: -0.78 },
        ].map((cb, ci) => (
          <group key={`cbrace-${ci}`}>
            <mesh position={[cb.x, 0.06, cb.z]} rotation={[0, cb.ry, 0]} material={agedTimberMat} castShadow>
              <boxGeometry args={[1.18, 0.11, 0.11]} />
            </mesh>
            <mesh position={[cb.kx, -0.14, cb.kz]} rotation={[0, 0, cb.krz]} material={agedTimberMat} castShadow>
              <boxGeometry args={[0.10, 0.62, 0.10]} />
            </mesh>
          </group>
        ))}

        {/* Compact SW Perimeter Cantilever Beam (`world x=-2.22, y=3.98, z in [4.10..4.96]`) + O-Ring Lug at `[-2.22, 3.91, 4.18]` */}
        <group position={[-2.07, 0.06, 3.91]}>
          <mesh material={agedTimberMat} castShadow receiveShadow>
            <boxGeometry args={[0.14, 0.14, 0.86]} />
          </mesh>
          {/* Diagonal oak cantilever brace from South end truss (`z=4.60`) top down to anchor tip (`z=4.18`) */}
          <mesh position={[0, 0.10, -0.14]} rotation={[-0.44, 0, 0]} material={agedTimberMat} castShadow>
            <boxGeometry args={[0.10, 0.10, 0.52]} />
          </mesh>
          {[0.07, 0.43].map((bz, bi) => (
            <mesh key={`jstrap-${bi}`} position={[0, -0.005, bz]} material={wroughtIronMat} castShadow>
              <boxGeometry args={[0.16, 0.155, 0.06]} />
            </mesh>
          ))}
          <group position={[0, -0.07, -0.35]}>
            <mesh position={[0, 0.004, 0]} material={wroughtIronMat}>
              <boxGeometry args={[0.10, 0.016, 0.12]} />
            </mesh>
            <mesh position={[0, -0.004, 0]} rotation={[0, Math.PI / 2, 0]} material={wroughtIronMat}>
              <torusGeometry args={[0.022, 0.0065, 10, 24]} />
            </mesh>
          </group>
        </group>

        {/* 严丝合缝防穿帮的东侧与南侧廊台遮雨檐（精确收口零斜插重叠，边缘加精致鼠尾草绿封檐饰线！） */}
        <group position={[5.62, -0.22, 0.15]}>
          <mesh rotation={[0, 0, -0.22]} material={pineRoofMat} castShadow receiveShadow>
            <boxGeometry args={[1.56, 0.07, 9.24]} />
          </mesh>
          <mesh position={[0.76, -0.18, 0]} material={sageEnamelFrameMat} castShadow>
            <boxGeometry args={[0.06, 0.12, 9.28]} />
          </mesh>
        </group>
        <group position={[0.05, -0.22, 5.18]}>
          <mesh rotation={[0.22, 0, 0]} material={pineRoofMat} castShadow receiveShadow>
            <boxGeometry args={[10.42, 0.07, 1.48]} />
          </mesh>
          <mesh position={[0, -0.18, 0.72]} material={sageEnamelFrameMat} castShadow>
            <boxGeometry args={[10.46, 0.12, 0.06]} />
          </mesh>
        </group>
        {/* 东南转角平顺对接过渡小檐盖（完美消弭两檐相交缝隙！） */}
        <mesh position={[5.62, -0.22, 5.18]} rotation={[0.16, 0, -0.16]} material={pineRoofMat} castShadow>
          <boxGeometry args={[1.52, 0.07, 1.48]} />
        </mesh>
      </group>

      {/* Lush Potted Rosemary & Blooming Dwarf Lemon Planter flanking Veranda Steps (indoor citrus upgraded to Calamondin Tree) */}
      <PottedVerandaHerbBush position={[5.78, -0.06, -0.82]} potGeo={potGeo} terracottaTex={textures.terracottaColorMap} windTime={grassWindTime} />

      {/* ====================================================================
          4. GHIBLI AFTERNOON VOLUMETRIC SUNBEAMS, SPARKLING DUST MOTES & BAKING TABLE
         ==================================================================== */}
      <group>
        {[
          { pos: [3.25, 2.08, -1.45] as [number, number, number], rot: [-0.06, -0.34, -0.96] as [number, number, number], w: 2.10, h: 4.9 },
          { pos: [2.85, 2.02, 0.55] as [number, number, number], rot: [-0.06, -0.34, -0.96] as [number, number, number], w: 2.50, h: 5.1 },
          { pos: [2.45, 1.96, 2.35] as [number, number, number], rot: [-0.06, -0.34, -0.96] as [number, number, number], w: 2.30, h: 4.8 },
          { pos: [1.35, 2.65, -0.25] as [number, number, number], rot: [-0.04, -0.28, -0.94] as [number, number, number], w: 1.55, h: 4.0 },
        ].map((b, idx) => (
          <mesh key={idx} position={b.pos} rotation={b.rot} material={godRayMat} raycast={() => null}>
            <planeGeometry args={[b.w, b.h]} />
          </mesh>
        ))}
        <SunlitDustMotes />
      </group>

      <OpenTrestleArtisanBakingTable burnerActive={burnerActive} beadboardMat={beadboardMat} agedTimberMat={agedTimberMat} />
    </group>
  );
};

export const AtelierEnvironment: React.FC = () => {
  return (
    <group>
      <PatisserieAtrium />
      <PatisserieEquipment />
    </group>
  );
};

export default AtelierEnvironment;
