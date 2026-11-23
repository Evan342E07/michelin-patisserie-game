import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  createGlazeStreamShaderMaterial,
  createMirrorGlazePourShaderMaterial,
} from '../../shaders/patisserieShaders';
import { useGameStore } from '../../store/useGameStore';
import { ENTREMET_FLAVOR_PRESETS, resolveFlavorId } from './cakeFlavors';
import { createMicroSurfaceMaps } from '../props/cottageHighCraftPbr';
import { enhanceWithStylizedFresnelRim } from '../../shaders/stylizedCozyUpgrades';

type ExtendedStore = ReturnType<typeof useGameStore.getState> & {
  selectedFlavor?: string;
  flavor?: string;
  glazeProgress?: number;
};

export interface MirrorGlazePourProps {
  glazeProgress?: number;
  pourAngle?: number;
  isPouring?: boolean;
  selectedFlavor?: string;
  position?: [number, number, number];
  scale?: number;
  showWireRack?: boolean;
  onPourStep?: (angleDelta: number) => void;
}

/**
 * Builds a seamless rounded dome LatheGeometry matching the Hero Entremet shoulder profile
 * with subdivided vertical flanks (22 rings), concentric flat-crown subdivisions, analytical pole normals,
 * and planar top-projection UVs so specular reflections and advancing glaze have zero pole seam.
 */
function buildSeamlessGlazingDomeGeo(
  radius = 0.452 / 2.2,
  height = 0.336 / 2.2,
  shoulderStart = 0.148 / 2.2,
  shoulderRadius = 0.174 / 2.2
): THREE.BufferGeometry {
  const baseY = 0.003 / 2.2;
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.0, baseY)];
  pts.push(new THREE.Vector2(radius, baseY));

  const wallSegs = 20;
  for (let i = 1; i <= wallSegs; i++) {
    const t = i / wallSegs;
    pts.push(new THREE.Vector2(radius, baseY + t * (shoulderStart - baseY)));
  }

  const segs = 32;
  const flatR = radius - shoulderRadius;
  const shoulderH = height - shoulderStart;
  const superExp = 2 / 2.35;
  for (let i = 1; i <= segs; i++) {
    const a = (i / segs) * (Math.PI * 0.5);
    pts.push(
      new THREE.Vector2(
        flatR + Math.pow(Math.cos(a), superExp) * shoulderRadius,
        shoulderStart + Math.pow(Math.sin(a), superExp) * shoulderH
      )
    );
  }

  // Concentric planar rings isolating shoulder roll-off from exact flat center pole
  for (const frac of [0.78, 0.56, 0.36, 0.18, 0.06]) {
    pts.push(new THREE.Vector2(flatR * frac, height));
  }
  pts.push(new THREE.Vector2(0.0, height));

  const radialSegs = 100;
  const g = new THREE.LatheGeometry(pts, radialSegs, 0, Math.PI * 2);
  g.computeVertexNormals();

  const pos = g.attributes.position as THREE.BufferAttribute;
  const norm = g.attributes.normal as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const nRing = pts.length;

  for (let j = 0; j < nRing; j++) {
    const i0 = j;
    const iEnd = radialSegs * nRing + j;
    if (iEnd < norm.count) {
      pos.setXYZ(iEnd, pos.getX(i0), pos.getY(i0), pos.getZ(i0));
      const nx = (norm.getX(i0) + norm.getX(iEnd)) * 0.5;
      const ny = (norm.getY(i0) + norm.getY(iEnd)) * 0.5;
      const nz = (norm.getZ(i0) + norm.getZ(iEnd)) * 0.5;
      const len = Math.hypot(nx, ny, nz) || 1;
      norm.setXYZ(i0, nx / len, ny / len, nz / len);
      norm.setXYZ(iEnd, nx / len, ny / len, nz / len);
    }
  }

  // Analytical vertical normals at bottom & top center poles
  for (let i = 0; i <= radialSegs; i++) {
    norm.setXYZ(i * nRing, 0, -1, 0);
    norm.setXYZ(i * nRing + (nRing - 1), 0, 1, 0);
  }

  // Singularity-free planar UVs across the flat crown
  for (let idx = 0; idx < pos.count; idx++) {
    if (pos.getY(idx) >= height - 0.002) {
      uv.setXY(
        idx,
        0.5 + pos.getX(idx) / (2 * radius),
        0.5 + pos.getZ(idx) / (2 * radius)
      );
    }
  }

  pos.needsUpdate = true;
  norm.needsUpdate = true;
  uv.needsUpdate = true;
  return g;
}

/**
 * Hammered Copper Glazing Sauceboat Pitcher Vessel (revolved profile with stepped foot, belly curve & rolled neck collar)
 */
function buildCopperGlazingPitcherGeo(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, -0.062),
    new THREE.Vector2(0.044, -0.062),
    new THREE.Vector2(0.047, -0.056),
    new THREE.Vector2(0.045, -0.048),
    new THREE.Vector2(0.056, -0.010),
    new THREE.Vector2(0.053, 0.026),
    new THREE.Vector2(0.048, 0.046),
    new THREE.Vector2(0.054, 0.058),
    new THREE.Vector2(0.051, 0.061),
    new THREE.Vector2(0.045, 0.046),
    new THREE.Vector2(0.050, 0.022),
    new THREE.Vector2(0.052, -0.010),
    new THREE.Vector2(0.042, -0.054),
    new THREE.Vector2(0.0001, -0.054),
  ];
  const g = new THREE.LatheGeometry(pts, 64);
  g.computeVertexNormals();
  return g;
}

/**
 * Extruded Sculpted Open U-Trough Copper Pouring Beak ("鹰嘴铜制淋面壶嘴")
 * Cantilevered cleanly from -0.046 -> -0.088 along -X with crisp double-walled U-trough thickness.
 */
function buildCopperSpoutBeakGeo(): THREE.BufferGeometry {
  const segU = 14;
  const segV = 12; // closed cross-section ring around U-channel wall thickness
  const thick = 0.0018;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iu = 0; iu <= segU; iu++) {
    const u = iu / segU;
    const x = THREE.MathUtils.lerp(-0.046, -0.088, u);
    const yFloor = 0.044 + u * 0.0155 + Math.sin(u * Math.PI) * 0.0025;
    const halfW = THREE.MathUtils.lerp(0.0175, 0.0048, Math.pow(u, 0.82));
    const wallH = THREE.MathUtils.lerp(0.016, 0.0055, Math.pow(u, 0.90));

    for (let iv = 0; iv <= segV; iv++) {
      const v = iv / segV;
      // Parameterize cross-section around U trough: outer contour (0..0.5) -> inner trough (0.5..1.0)
      let pz = 0;
      let py = 0;
      if (v <= 0.5) {
        const a = (v / 0.5) * Math.PI; // 0..PI across U trough
        const rW = halfW + thick;
        const rH = wallH + thick;
        pz = -Math.cos(a) * rW;
        py = yFloor + wallH - Math.sin(a) * rH;
      } else {
        const a = ((1.0 - v) / 0.5) * Math.PI; // reverse PI..0 for inside U channel
        pz = -Math.cos(a) * halfW;
        py = yFloor + wallH - Math.sin(a) * wallH;
      }
      positions.push(x, py, pz);
      uvs.push(u, v);
    }
  }

  const row = segV + 1;
  for (let iu = 0; iu < segU; iu++) {
    for (let iv = 0; iv < segV; iv++) {
      const a = iu * row + iv;
      const b = a + 1;
      const c = (iu + 1) * row + iv + 1;
      const d = (iu + 1) * row + iv;
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
 * Arched Ergonomic Dark-Walnut Pouring Handle extending gracefully on +X opposite the copper beak.
 */
function buildWalnutPitcherHandleGeo(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.050, 0.032, 0),
    new THREE.Vector3(0.088, 0.044, 0),
    new THREE.Vector3(0.106, 0.012, 0),
    new THREE.Vector3(0.094, -0.028, 0),
    new THREE.Vector3(0.046, -0.044, 0),
  ]);
  const g = new THREE.TubeGeometry(curve, 24, 0.0058, 12, false);
  g.computeVertexNormals();
  return g;
}

/**
 * Glossy 32°C Molten Glaze Liquid Tongue nestled cleanly inside the Copper Beak U-Trough
 * from the upper vessel reservoir (-0.022) smoothly out to the rounded pouring lip (-0.0872).
 */
function buildSpoutGlazeTongueGeo(): THREE.BufferGeometry {
  const segU = 18;
  const segV = 16;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iu = 0; iu <= segU; iu++) {
    const u = iu / segU;
    const x = THREE.MathUtils.lerp(-0.022, -0.0872, u);
    const tBeak = THREE.MathUtils.clamp((-x - 0.046) / (0.088 - 0.046), 0, 1);

    let yFloor: number;
    let halfW: number;
    let wallH: number;
    if (x >= -0.046) {
      const tIn = THREE.MathUtils.clamp((-x - 0.022) / (0.046 - 0.022), 0, 1);
      yFloor = THREE.MathUtils.lerp(0.018, 0.044, Math.pow(tIn, 0.85));
      halfW = THREE.MathUtils.lerp(0.021, 0.0158, tIn);
      wallH = THREE.MathUtils.lerp(0.018, 0.014, tIn);
    } else {
      yFloor = 0.044 + tBeak * 0.0155 + Math.sin(tBeak * Math.PI) * 0.0025;
      halfW = THREE.MathUtils.lerp(0.0175, 0.0048, Math.pow(tBeak, 0.82)) * 0.88;
      wallH = THREE.MathUtils.lerp(0.016, 0.0055, Math.pow(tBeak, 0.90));
    }

    const endCap =
      u < 0.06
        ? Math.max(0.08, Math.sin((u / 0.06) * Math.PI * 0.5))
        : u > 0.94
          ? Math.max(0.14, Math.cos(((u - 0.94) / 0.06) * Math.PI * 0.45))
          : 1.0;
    const rx = halfW * endCap;
    const yBed = yFloor + 0.0006;
    const yTop = yFloor + wallH * (x >= -0.046 ? 0.68 : THREE.MathUtils.lerp(0.68, 0.84, tBeak));
    const yMid = (yBed + yTop) * 0.5;
    const ry = Math.max(0.0008, (yTop - yBed) * 0.5 * endCap);

    for (let iv = 0; iv <= segV; iv++) {
      const v = iv / segV;
      const theta = v * Math.PI * 2;
      const pz = Math.sin(theta) * rx;
      const py = yMid + Math.cos(theta) * ry;
      positions.push(x, py, pz);
      uvs.push(u, v);
    }
  }

  const row = segV + 1;
  for (let iu = 0; iu < segU; iu++) {
    for (let iv = 0; iv < segV; iv++) {
      const a = iu * row + iv;
      const b = (iu + 1) * row + iv;
      const c = (iu + 1) * row + iv + 1;
      const d = iu * row + iv + 1;
      indices.push(a, b, d, b, c, d);
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
 * Allocates reusable topology for a gravity-tapered liquid glaze stream along a CatmullRomCurve3.
 */
function createStreamBufferGeometry(tubularSegs: number, radialSegs: number): THREE.BufferGeometry {
  const vertCount = (tubularSegs + 1) * (radialSegs + 1);
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices: number[] = [];

  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    for (let j = 0; j <= radialSegs; j++) {
      const idx = i * (radialSegs + 1) + j;
      uvs[idx * 2] = u;
      uvs[idx * 2 + 1] = j / radialSegs;
    }
  }

  const row = radialSegs + 1;
  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * row + j;
      const b = (i + 1) * row + j;
      const c = (i + 1) * row + (j + 1);
      const d = i * row + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(indices);
  return g;
}

const STREAM_POINT_SCRATCH = new THREE.Vector3();
const STREAM_NORMAL_SCRATCH = new THREE.Vector3();

/**
 * Updates the pre-allocated stream BufferGeometry in-place (zero per-frame GC allocation):
 * thicker at pitcher lip, slender during free-fall acceleration, flaring softly into a silk coil on impact.
 */
function updateTaperedGlazeStreamGeometry(
  geo: THREE.BufferGeometry,
  curve: THREE.CatmullRomCurve3,
  tubularSegs: number,
  radialSegs: number,
  momentum: number,
  taperScale = 1.0
): void {
  const frames = curve.computeFrenetFrames(tubularSegs, false);
  const posAttr = geo.attributes.position as THREE.BufferAttribute;
  const normAttr = geo.attributes.normal as THREE.BufferAttribute;
  const flowBoost = (0.72 + momentum * 0.48) * Math.max(0.05, taperScale);

  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    curve.getPointAt(u, STREAM_POINT_SCRATCH);

    const entryCap = THREE.MathUtils.smoothstep(u, 0.0, 0.08);
    const neck = 0.42 + 0.58 * (1.0 - 0.44 * Math.sin(u * Math.PI * 0.88));
    const coilFlare = Math.pow(Math.max(0, (u - 0.70) / 0.30), 1.5) * 0.44;
    const radius = (0.0056 * (0.28 + 0.72 * entryCap) * neck + 0.0074 * coilFlare) * flowBoost;

    const normalVec = frames.normals[i];
    const binormalVec = frames.binormals[i];

    for (let j = 0; j <= radialSegs; j++) {
      const v = (j / radialSegs) * Math.PI * 2;
      const sin = Math.sin(v);
      const cos = -Math.cos(v);

      STREAM_NORMAL_SCRATCH.x = cos * normalVec.x + sin * binormalVec.x;
      STREAM_NORMAL_SCRATCH.y = cos * normalVec.y + sin * binormalVec.y;
      STREAM_NORMAL_SCRATCH.z = cos * normalVec.z + sin * binormalVec.z;
      STREAM_NORMAL_SCRATCH.normalize();

      const idx = i * (radialSegs + 1) + j;
      posAttr.setXYZ(
        idx,
        STREAM_POINT_SCRATCH.x + radius * STREAM_NORMAL_SCRATCH.x,
        STREAM_POINT_SCRATCH.y + radius * STREAM_NORMAL_SCRATCH.y,
        STREAM_POINT_SCRATCH.z + radius * STREAM_NORMAL_SCRATCH.z
      );
      normAttr.setXYZ(idx, STREAM_NORMAL_SCRATCH.x, STREAM_NORMAL_SCRATCH.y, STREAM_NORMAL_SCRATCH.z);
    }
  }

  posAttr.needsUpdate = true;
  normAttr.needsUpdate = true;
  geo.computeBoundingSphere();
}

/**
 * Step 6: Real-time 32°C Mirror Glaze Waterfall Pour (Glaçage Miroir en Cascade)
 * Driven by `glazeProgress` (0 -> 1) and `selectedFlavor` from `useGameStore` or props.
 */
export const MirrorGlazePour: React.FC<MirrorGlazePourProps> = ({
  glazeProgress: propGlazeProgress,
  pourAngle: propPourAngle,
  isPouring: propIsPouring,
  selectedFlavor: propFlavor,
  position = [0, 0, 0],
  scale = 1,
  showWireRack = true,
  onPourStep,
}) => {
  const store = useGameStore((s) => s as ExtendedStore);
  const storePourOrbit = useGameStore((s) => s.pourMirrorGlazeOrbit);

  const rawProgress = propGlazeProgress ?? store.glazeProgress ?? store.glazeCoverage;
  const rawAngle = propPourAngle ?? store.glazePourAngle;
  const rawPouring = propIsPouring ?? store.isPouringGlaze;
  const flavorId = resolveFlavorId(propFlavor ?? store.selectedFlavor ?? store.flavor);
  const flavor = ENTREMET_FLAVOR_PRESETS[flavorId];

  const domeRadius = 0.452 / 2.2;
  const domeHeight = 0.336 / 2.2;
  const shoulderStart = 0.148 / 2.2;
  const shoulderRadius = 0.174 / 2.2;
  const streamTubularSegs = 24;
  const streamRadialSegs = 12;

  const domeGeo = useMemo(
    () => buildSeamlessGlazingDomeGeo(domeRadius, domeHeight, shoulderStart, shoulderRadius),
    [domeRadius, domeHeight, shoulderStart, shoulderRadius]
  );
  const pitcherGeo = useMemo(() => buildCopperGlazingPitcherGeo(), []);
  const pitcherBeakGeo = useMemo(() => buildCopperSpoutBeakGeo(), []);
  const spoutTongueGeo = useMemo(() => buildSpoutGlazeTongueGeo(), []);
  const pitcherPoolGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.042, 0.039, 0.044, 36);
    g.computeVertexNormals();
    return g;
  }, []);
  const pitcherHandleGeo = useMemo(() => buildWalnutPitcherHandleGeo(), []);
  const streamGeo = useMemo(
    () => createStreamBufferGeometry(streamTubularSegs, streamRadialSegs),
    []
  );
  const unitWireBarGeo = useMemo(() => new THREE.CylinderGeometry(0.0022, 0.0022, 1.0, 16), []);
  const wireSteelMicro = useMemo(() => createMicroSurfaceMaps(0.22, 0.07, true, 821), []);
  const trayCopperMat = useMemo(
    () =>
      enhanceWithStylizedFresnelRim(
        new THREE.MeshPhysicalMaterial({
          color: '#D88254',
          bumpMap: wireSteelMicro.bumpMap,
          bumpScale: 0.0020,
          roughnessMap: wireSteelMicro.roughnessMap,
          metalness: 0.88,
          roughness: 1.0,
          clearcoat: 0.14,
          clearcoatRoughness: 0.28,
          anisotropy: 0.35,
          envMapIntensity: 0.55,
          side: THREE.DoubleSide,
        }),
        { rimColor: '#FFE2B4', rimStrength: 0.30, rimPower: 2.5, topBias: 0.42, cacheTag: 'pour-tray-copper' }
      ),
    [wireSteelMicro]
  );
  const wireBarMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#D4AC64',
        bumpMap: wireSteelMicro.bumpMap,
        bumpScale: 0.0014,
        roughnessMap: wireSteelMicro.roughnessMap,
        metalness: 0.86,
        roughness: 1.0,
        anisotropy: 0.45,
        envMapIntensity: 0.52,
      }),
    [wireSteelMicro]
  );
  const dripPoolMat = useMemo(
    () =>
      enhanceWithStylizedFresnelRim(
        new THREE.MeshPhysicalMaterial({
          color: flavor.glazeColor,
          emissive: flavor.glazeDeep,
          emissiveIntensity: 0.08,
          roughness: 0.54,
          clearcoat: 0.0,
          sheen: 0.44,
          sheenColor: new THREE.Color('#FFF4D8'),
          envMapIntensity: 0.34,
        }),
        { rimColor: '#FFF2CE', rimStrength: 0.24, rimPower: 2.7, topBias: 0.45, cacheTag: 'pour-drip-pool' }
      ),
    []
  );
  const pitcherGlazeMat = useMemo(
    () =>
      enhanceWithStylizedFresnelRim(
        new THREE.MeshPhysicalMaterial({
          color: flavor.glazeColor,
          emissive: flavor.glazeDeep,
          emissiveIntensity: 0.10,
          roughness: 0.54,
          clearcoat: 0.0,
          sheen: 0.44,
          sheenColor: new THREE.Color('#FFF4D8'),
          envMapIntensity: 0.34,
        }),
        { rimColor: '#FFF2CE', rimStrength: 0.24, rimPower: 2.7, topBias: 0.45, cacheTag: 'pour-pitcher-cream' }
      ),
    []
  );
  const copperPitcherMat = useMemo(
    () =>
      enhanceWithStylizedFresnelRim(
        new THREE.MeshPhysicalMaterial({
          color: '#D88254',
          bumpMap: wireSteelMicro.bumpMap,
          bumpScale: 0.0020,
          roughnessMap: wireSteelMicro.roughnessMap,
          metalness: 0.88,
          roughness: 1.0,
          clearcoat: 0.14,
          clearcoatRoughness: 0.28,
          anisotropy: 0.35,
          envMapIntensity: 0.55,
          side: THREE.DoubleSide,
        }),
        { rimColor: '#FFE2B4', rimStrength: 0.34, rimPower: 2.5, topBias: 0.42, cacheTag: 'pour-copper-pitcher' }
      ),
    [wireSteelMicro]
  );
  const pitcherBrassMat = useMemo(
    () =>
      enhanceWithStylizedFresnelRim(
        new THREE.MeshPhysicalMaterial({
          color: '#D4AC64',
          bumpMap: wireSteelMicro.bumpMap,
          bumpScale: 0.0014,
          roughnessMap: wireSteelMicro.roughnessMap,
          metalness: 0.86,
          roughness: 1.0,
          anisotropy: 0.45,
          envMapIntensity: 0.52,
        }),
        { rimColor: '#FFE6B8', rimStrength: 0.28, rimPower: 2.6, topBias: 0.42, cacheTag: 'pour-pitcher-brass' }
      ),
    [wireSteelMicro]
  );
  const walnutHandleMat = useMemo(
    () =>
      enhanceWithStylizedFresnelRim(
        new THREE.MeshPhysicalMaterial({
          color: '#5C3822',
          bumpMap: wireSteelMicro.bumpMap,
          bumpScale: 0.0012,
          roughness: 0.54,
          clearcoat: 0.10,
          clearcoatRoughness: 0.34,
          envMapIntensity: 0.36,
        }),
        { rimColor: '#FFE0AE', rimStrength: 0.26, rimPower: 2.7, topBias: 0.42, cacheTag: 'pour-walnut-handle' }
      ),
    [wireSteelMicro]
  );
  const waterfallMat = useMemo(
    () =>
      createMirrorGlazePourShaderMaterial({
        mousseColor: flavor.mousseColor,
        mousseSssColor: flavor.mousseSssColor,
        glazeDeep: flavor.glazeDeep,
        glazeBright: flavor.glazeBright,
      }),
    []
  );
  const streamMat = useMemo(
    () =>
      createGlazeStreamShaderMaterial({
        glazeDeep: flavor.glazeDeep,
        glazeBright: flavor.glazeBright,
      }),
    []
  );

  // Sync shader colors when flavor switches without recompiling shaders
  useEffect(() => {
    waterfallMat.uniforms.uMousseColor.value.set(flavor.mousseColor);
    waterfallMat.uniforms.uMousseSssColor.value.set(flavor.mousseSssColor);
    waterfallMat.uniforms.uGlazeDeep.value.set(flavor.glazeDeep);
    waterfallMat.uniforms.uGlazeBright.value.set(flavor.glazeBright);
    waterfallMat.uniforms.uDomeRadius.value = domeRadius;
    waterfallMat.uniforms.uDomeHeight.value = domeHeight;

    streamMat.uniforms.uGlazeDeep.value.set(flavor.glazeDeep);
    streamMat.uniforms.uGlazeBright.value.set(flavor.glazeBright);

    if (pitcherLinerMatRef.current) {
      pitcherLinerMatRef.current.color.set(flavor.glazeColor);
      pitcherLinerMatRef.current.emissive.set(flavor.glazeDeep);
    }
    pitcherGlazeMat.color.set(flavor.glazeColor);
    pitcherGlazeMat.emissive.set(flavor.glazeDeep);
    dripPoolMat.color.set(flavor.glazeColor);
    dripPoolMat.emissive.set(flavor.glazeDeep);
  }, [flavor, waterfallMat, streamMat, dripPoolMat, pitcherGlazeMat, domeRadius, domeHeight]);

  useEffect(() => {
    return () => {
      domeGeo.dispose();
      pitcherGeo.dispose();
      pitcherBeakGeo.dispose();
      spoutTongueGeo.dispose();
      pitcherPoolGeo.dispose();
      pitcherHandleGeo.dispose();
      streamGeo.dispose();
      unitWireBarGeo.dispose();
      trayCopperMat.dispose();
      wireBarMat.dispose();
      dripPoolMat.dispose();
      pitcherGlazeMat.dispose();
      copperPitcherMat.dispose();
      pitcherBrassMat.dispose();
      walnutHandleMat.dispose();
      wireSteelMicro.bumpMap.dispose();
      wireSteelMicro.roughnessMap.dispose();
      waterfallMat.dispose();
      streamMat.dispose();
    };
  }, [
    domeGeo,
    pitcherGeo,
    pitcherBeakGeo,
    spoutTongueGeo,
    pitcherPoolGeo,
    pitcherHandleGeo,
    streamGeo,
    unitWireBarGeo,
    trayCopperMat,
    wireBarMat,
    dripPoolMat,
    pitcherGlazeMat,
    copperPitcherMat,
    pitcherBrassMat,
    walnutHandleMat,
    wireSteelMicro,
    waterfallMat,
    streamMat,
  ]);

  const pitcherGroupRef = useRef<THREE.Group>(null);
  const pitcherBeakMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const pitcherLinerMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const pitcherLiquidMeshRef = useRef<THREE.Mesh>(null);
  const spoutTongueMeshRef = useRef<THREE.Mesh>(null);
  const streamMeshRef = useRef<THREE.Mesh>(null);
  const poolMeshRef = useRef<THREE.Mesh>(null);
  const grateDripGroupRef = useRef<THREE.Group>(null);
  const smoothProgressRef = useRef(rawProgress);
  const smoothAngleRef = useRef(rawAngle);
  const lastAngleRef = useRef(rawAngle);
  const momentumRef = useRef(0.25);

  useEffect(() => {
    if (pitcherGroupRef.current) {
      pitcherGroupRef.current.visible = rawProgress < 0.985;
    }
  }, []);

  const streamCurvePoints = useMemo(
    () => [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ],
    []
  );
  const streamCurve = useMemo(() => new THREE.CatmullRomCurve3(streamCurvePoints), [streamCurvePoints]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();

    if (rawProgress < 0.05 && smoothProgressRef.current > 0.7) {
      smoothProgressRef.current = rawProgress;
    } else {
      // 模拟 32°C 高粘度香缇奶盖慢流垂滴感（较原 11/15 显著放缓）
      const progressLerpRate = rawProgress >= 0.96 ? 5.8 : 4.2;
      smoothProgressRef.current = THREE.MathUtils.lerp(
        smoothProgressRef.current,
        rawProgress,
        1 - Math.exp(-dt * progressLerpRate)
      );
      if (rawProgress >= 0.998 && smoothProgressRef.current > 0.996) {
        smoothProgressRef.current = rawProgress;
      }
    }
    const targetAngle = rawAngle + (rawPouring ? Math.sin(t * 2.0) * 0.14 : 0);
    smoothAngleRef.current = THREE.MathUtils.lerp(
      smoothAngleRef.current,
      targetAngle,
      1 - Math.exp(-dt * 4.5)
    );

    // Measure pouring angular momentum for dynamic stream thickness & crown ripple strength
    const angleDelta = Math.abs(smoothAngleRef.current - lastAngleRef.current);
    lastAngleRef.current = smoothAngleRef.current;
    const instantMom = THREE.MathUtils.clamp(angleDelta / Math.max(dt * 3.5, 0.001) + (rawPouring ? 0.35 : 0.12), 0.15, 1.0);
    momentumRef.current = THREE.MathUtils.lerp(momentumRef.current, instantMom, 1 - Math.exp(-dt * 7.5));

    const cov = smoothProgressRef.current;
    const ang = smoothAngleRef.current;
    const mom = momentumRef.current;

    // Keep early spiral centered beneath pitcher so stream plunges cleanly into the spreading pool
    const spiralBlend = THREE.MathUtils.smoothstep(cov, 0.24, 0.58);
    const earlyTightR = 0.004 + 0.012 * Math.sin(cov * Math.PI * 3.0);
    const wideSweepR = 0.016 + 0.068 * Math.max(0, Math.sin(cov * Math.PI * 0.95 + 0.15));
    const spiralR = THREE.MathUtils.lerp(earlyTightR, wideSweepR, spiralBlend);
    const impactX = Math.cos(ang) * spiralR;
    const impactZ = Math.sin(ang) * spiralR;

    waterfallMat.uniforms.uTime.value = t;
    waterfallMat.uniforms.uGlazeProgress.value = cov;
    waterfallMat.uniforms.uPourAngle.value = ang;
    waterfallMat.uniforms.uPourMomentum.value = mom;
    waterfallMat.uniforms.uImpactPos.value.set(impactX, impactZ);

    // Subtle Q弹 soft-body bounce on frozen mousse dome under pouring stream impact
    const activePourSplash = (rawPouring || (cov > 0.01 && cov < 0.992)) ? 1 : 0;
    const splashPulse = Math.sin(t * 14.5) * 0.0022 * mom * activePourSplash;
    waterfallMat.uniforms.uWobbleVec.value.set(
      Math.cos(ang) * splashPulse,
      Math.sin(ang) * splashPulse
    );
    waterfallMat.uniforms.uWobbleAmp.value = Math.abs(splashPulse) * 1.4;

    streamMat.uniforms.uTime.value = t;
    streamMat.uniforms.uPourMomentum.value = mom;

    const rackOffsetY = showWireRack ? 0.022 : 0.0;
    const finishEase = THREE.MathUtils.smoothstep(cov, 0.90, 0.985);
    const pitcherExitEase = THREE.MathUtils.smoothstep(cov, 0.95, 0.984);
    const pitcherAlpha = 1.0 - pitcherExitEase;
    const isPitcherFading = pitcherExitEase > 0.001;
    const isPitcherVisible = cov < 0.985 && pitcherAlpha > 0.02;

    const spoutOffsetAngle = ang + 0.32;
    const pourActive = rawPouring ? 1.0 : THREE.MathUtils.smoothstep(cov, 0.0, 0.035);
    const wristDip = Math.sin(t * 3.8) * 0.028 * mom;
    const pitcherTilt =
      0.22 + (0.36 + cov * 0.20 + wristDip) * pourActive - finishEase * 0.48 - pitcherExitEase * 0.14;
    // Exact local copper beak tip (-0.084, 0.0612, 0) transformed by Rz(pitcherTilt)
    const cosTilt = Math.cos(pitcherTilt);
    const sinTilt = Math.sin(pitcherTilt);
    const localLipX = -0.084 * cosTilt - 0.0612 * sinTilt;
    const localLipY = -0.084 * sinTilt + 0.0612 * cosTilt;

    const dirX = Math.cos(spoutOffsetAngle);
    const dirZ = Math.sin(spoutOffsetAngle);
    // Offset pitcher center back by (-localLipX) so the copper beak lip hovers directly above the impact spiral!
    const pitcherCenterX = impactX + dirX * (-localLipX + 0.003);
    const pitcherCenterZ = impactZ + dirZ * (-localLipX + 0.003);
    const pitcherCenterY = rackOffsetY + domeHeight + 0.168 + finishEase * 0.045 + pitcherExitEase * 0.090;

    if (pitcherGroupRef.current) {
      pitcherGroupRef.current.visible = isPitcherVisible;
      pitcherGroupRef.current.position.set(pitcherCenterX, pitcherCenterY, pitcherCenterZ);
      pitcherGroupRef.current.rotation.set(0, -spoutOffsetAngle, pitcherTilt);
    }

    // Keep internal molten glaze surface strictly level under gravity and feeding directly up into beak throat
    if (pitcherLiquidMeshRef.current) {
      const liquidFill = Math.max(0.42, 1.0 - cov * 0.44);
      pitcherLiquidMeshRef.current.rotation.set(0, 0, -pitcherTilt);
      pitcherLiquidMeshRef.current.scale.set(0.96, liquidFill, 0.96);
      pitcherLiquidMeshRef.current.position.set(
        -0.004 * sinTilt,
        0.002 + (1.0 - cov) * 0.010 + sinTilt * 0.016,
        0
      );
    }
    if (spoutTongueMeshRef.current) {
      const tongueVisible = isPitcherVisible && (rawPouring || cov > 0.002) && finishEase < 0.95;
      spoutTongueMeshRef.current.visible = tongueVisible;
      const tongueWidth = Math.max(0.28, 1.0 - finishEase * 0.72);
      spoutTongueMeshRef.current.position.set(finishEase * 0.022, 0, 0);
      spoutTongueMeshRef.current.scale.set(1.0, 1.0, tongueWidth);
    }

    for (const mat of [
      copperPitcherMat,
      pitcherBrassMat,
      walnutHandleMat,
      pitcherBeakMatRef.current,
      pitcherLinerMatRef.current,
      pitcherGlazeMat,
    ]) {
      if (!mat) continue;
      mat.transparent = isPitcherFading;
      mat.depthWrite = !isPitcherFading;
      mat.opacity = pitcherAlpha;
      mat.envMapIntensity = 0.52 * pitcherAlpha;
    }

    if (streamMeshRef.current) {
      const showStream = cov < 0.985 && (rawPouring || cov > 0.006);
      streamMeshRef.current.visible = showStream;
      if (showStream) {
        const taperScale = 1.0 - finishEase;
        streamMat.uniforms.uOpacity.value = taperScale;

        // Silky viscous rope-coiling loop right where the stream lands on the crown
        const coilRadius = 0.0046 * (0.5 + 0.5 * mom) * taperScale;
        const coilX = Math.cos(t * 15.5) * coilRadius;
        const coilZ = Math.sin(t * 15.5) * coilRadius;

        // Exact transform from pitcher-local point (lx, ly, 0) into streamMeshRef local coords (y=0 at rackOffsetY)
        const toStreamSpace = (lx: number, ly: number) => {
          const rx = lx * cosTilt - ly * sinTilt;
          const ry = lx * sinTilt + ly * cosTilt;
          return {
            x: pitcherCenterX + rx * dirX,
            y: pitcherCenterY + ry - rackOffsetY,
            z: pitcherCenterZ + rx * dirZ,
          };
        };

        // Anchor point 0 strictly INSIDE beak lip glaze tongue (-0.082, 0.0612) with tangent guide (-0.098, 0.041)
        const lipStart = toStreamSpace(-0.082, 0.0612);
        const lipGuide = toStreamSpace(-0.098, 0.041);
        const lipY = lipStart.y;
        const fallSpan = Math.max(0.04, lipY - domeHeight);

        streamCurvePoints[0].set(lipStart.x, lipStart.y, lipStart.z);
        streamCurvePoints[1].set(
          THREE.MathUtils.lerp(lipGuide.x, impactX, 0.16),
          Math.max(domeHeight + 0.025, THREE.MathUtils.lerp(lipGuide.y, domeHeight, 0.18)),
          THREE.MathUtils.lerp(lipGuide.z, impactZ, 0.16)
        );
        streamCurvePoints[2].set(
          THREE.MathUtils.lerp(lipStart.x, impactX, 0.68),
          domeHeight + fallSpan * 0.34,
          THREE.MathUtils.lerp(lipStart.z, impactZ, 0.68)
        );
        streamCurvePoints[3].set(impactX + coilX * 0.65, domeHeight + 0.011, impactZ + coilZ * 0.65);
        streamCurvePoints[4].set(impactX + coilX, domeHeight - 0.008, impactZ + coilZ);

        updateTaperedGlazeStreamGeometry(
          streamGeo,
          streamCurve,
          streamTubularSegs,
          streamRadialSegs,
          mom,
          taperScale
        );
      } else {
        streamMat.uniforms.uOpacity.value = 0.0;
      }
    }

    if (poolMeshRef.current) {
      const poolScale = THREE.MathUtils.smoothstep(cov, 0.28, 0.98);
      poolMeshRef.current.visible = poolScale > 0.01;
      poolMeshRef.current.scale.set(0.38 + poolScale * 0.62, 1, 0.38 + poolScale * 0.62);
    }
    if (grateDripGroupRef.current) {
      const dripGrow = THREE.MathUtils.smoothstep(cov, 0.30, 0.92);
      grateDripGroupRef.current.visible = dripGrow > 0.02;
      grateDripGroupRef.current.scale.set(1, 0.2 + dripGrow * 0.85, 1);
    }
  });

  const handleInteractivePour = (delta: number) => {
    if (onPourStep) {
      onPourStep(delta);
    } else {
      storePourOrbit(delta);
    }
  };

  return (
    <group
      position={position}
      scale={scale}
      onPointerMove={(e) => {
        if (e.buttons > 0) {
          handleInteractivePour(0.14);
        }
      }}
      onClick={(e) => {
        if (e.delta > 5) return;
        e.stopPropagation();
        handleInteractivePour(0.85);
      }}
    >
      {/* Hammered Copper Drip Tray & French Brass Wire Glazing Grate catching wet glaze drip ribbons */}
      {showWireRack && (
        <group position={[0, 0, 0]}>
          <mesh position={[0, 0.005, 0]} material={trayCopperMat} receiveShadow>
            <cylinderGeometry args={[0.218, 0.204, 0.010, 48]} />
          </mesh>
          <mesh position={[0, 0.010, 0]} rotation={[Math.PI / 2, 0, 0]} material={trayCopperMat}>
            <torusGeometry args={[0.217, 0.0032, 12, 48]} />
          </mesh>
          <mesh ref={poolMeshRef} position={[0, 0.0108, 0]} material={dripPoolMat} visible={false}>
            <cylinderGeometry args={[0.202, 0.206, 0.003, 44]} />
          </mesh>
          {/* Elevated French Brass Circular Grate Ring + 4 Support Feet + Welded Wire Bars */}
          <mesh position={[0, 0.022, 0]} rotation={[Math.PI / 2, 0, 0]} material={wireBarMat}>
            <torusGeometry args={[0.210, 0.0028, 12, 48]} />
          </mesh>
          {[0.4, 1.97, 3.54, 5.11].map((fa, fi) => (
            <mesh
              key={`foot-${fi}`}
              position={[Math.cos(fa) * 0.198, 0.016, Math.sin(fa) * 0.198]}
              material={wireBarMat}
            >
              <cylinderGeometry args={[0.0032, 0.0040, 0.012, 12]} />
            </mesh>
          ))}
          {[-0.15, -0.10, -0.05, 0, 0.05, 0.10, 0.15].map((offset, i) => {
            const barLen = Math.max(0.14, 2 * Math.sqrt(Math.max(0, 0.208 * 0.208 - offset * offset)));
            return (
              <mesh
                key={i}
                position={[0, 0.022, offset]}
                rotation={[0, 0, Math.PI / 2]}
                scale={[1, barLen, 1]}
                geometry={unitWireBarGeo}
                material={wireBarMat}
              />
            );
          })}
          {/* Viscous mirror-glaze drip ribbons falling from brass grate edge into copper drip tray */}
          <group ref={grateDripGroupRef} position={[0, 0.021, 0]} visible={false}>
            {[0.35, 1.38, 2.42, 3.35, 4.48, 5.45].map((da, di) => (
              <mesh
                key={`gdrip-${di}`}
                position={[Math.cos(da) * 0.198, -0.006, Math.sin(da) * 0.198]}
                material={dripPoolMat}
              >
                <cylinderGeometry args={[0.0024, 0.0038, 0.012, 10]} />
              </mesh>
            ))}
          </group>
        </group>
      )}

      {/* Chilled Ivory Vanilla-Speckled Entremet Dome receiving 32°C Mirror Glaze Waterfall Shader */}
      <mesh
        position={[0, showWireRack ? 0.022 : 0.0, 0]}
        geometry={domeGeo}
        material={waterfallMat}
        castShadow
        receiveShadow
      />

      {/* Continuous Gravity-Tapered Spiral Liquid Glaze Stream */}
      <mesh
        ref={streamMeshRef}
        position={[0, showWireRack ? 0.022 : 0.0, 0]}
        geometry={streamGeo}
        material={streamMat}
        castShadow
      />

      {/* Orbiting Hammered Copper & Dark-Walnut Beak Glazing Sauceboat Pitcher ("鹰嘴铜制淋面壶") */}
      <group ref={pitcherGroupRef} position={[0.08, domeHeight + 0.174, 0]}>
        <mesh geometry={pitcherGeo} material={copperPitcherMat} castShadow />
        {/* Brass Rim & Collar Trim */}
        <mesh position={[0, 0.059, 0]} rotation={[Math.PI / 2, 0, 0]} material={pitcherBrassMat}>
          <torusGeometry args={[0.0525, 0.0024, 12, 48]} />
        </mesh>
        {/* Cantilevered Copper Open U-Trough Pouring Beak */}
        <mesh geometry={pitcherBeakGeo} castShadow>
          <meshPhysicalMaterial
            ref={pitcherBeakMatRef}
            color="#D88254"
            bumpMap={wireSteelMicro.bumpMap}
            bumpScale={0.0018}
            roughnessMap={wireSteelMicro.roughnessMap}
            metalness={0.88}
            roughness={1.0}
            clearcoat={0.14}
            envMapIntensity={0.55}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Arched Turned Dark-Walnut Handle + Brass Mounting Ferrules */}
        <mesh geometry={pitcherHandleGeo} material={walnutHandleMat} castShadow />
        <mesh position={[0.050, 0.032, 0]} rotation={[0, 0, Math.PI / 2]} material={pitcherBrassMat}>
          <cylinderGeometry args={[0.0085, 0.0085, 0.012, 16]} />
        </mesh>
        <mesh position={[0.046, -0.044, 0]} rotation={[0, 0, Math.PI / 2]} material={pitcherBrassMat}>
          <cylinderGeometry args={[0.0085, 0.0085, 0.012, 16]} />
        </mesh>
        {/* Velvety Chantilly Interior Coating inside upper copper vessel */}
        <mesh position={[0, 0.006, 0]}>
          <cylinderGeometry args={[0.0465, 0.0435, 0.078, 32, 1, true]} />
          <meshPhysicalMaterial
            ref={pitcherLinerMatRef}
            color={flavor.glazeColor}
            emissive={flavor.glazeDeep}
            emissiveIntensity={0.08}
            roughness={0.54}
            clearcoat={0.0}
            sheen={0.42}
            sheenColor="#FFF4D8"
            envMapIntensity={0.34}
            side={THREE.BackSide}
          />
        </mesh>
        {/* Sculpted Glossy Liquid Mirror Glaze Tongue flowing through the U-Trough Beak */}
        <mesh ref={spoutTongueMeshRef} geometry={spoutTongueGeo} material={pitcherGlazeMat} />
        {/* Gravity-Leveled Horizontal 32°C Molten Glaze Pool */}
        <mesh
          ref={pitcherLiquidMeshRef}
          position={[-0.002, 0.008, 0]}
          geometry={pitcherPoolGeo}
          material={pitcherGlazeMat}
        />
      </group>
    </group>
  );
};

export default MirrorGlazePour;
