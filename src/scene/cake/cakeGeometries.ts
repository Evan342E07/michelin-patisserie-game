import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface SplitLayerGeometries {
  fullGeo: THREE.BufferGeometry;
  mainWallGeo: THREE.BufferGeometry;
  mainCapsGeo: THREE.BufferGeometry;
  sliceWallGeo: THREE.BufferGeometry;
  sliceCapsGeo: THREE.BufferGeometry;
}

export interface HeroEntremetGeometries {
  crunch: SplitLayerGeometries;
  sponge: SplitLayerGeometries;
  spongeBottom: SplitLayerGeometries;
  spongeMid: SplitLayerGeometries;
  spongeTop: SplitLayerGeometries;
  caramel: SplitLayerGeometries;
  jelly: SplitLayerGeometries;
  mousse: SplitLayerGeometries;
  mousseLowerRing: SplitLayerGeometries;
  mousseUpperRing: SplitLayerGeometries;
  mousseTopBed: SplitLayerGeometries;
  glaze: SplitLayerGeometries;
  semiNakedFullGeo: THREE.BufferGeometry;
  semiNakedMainGeo: THREE.BufferGeometry;
  semiNakedSliceGeo: THREE.BufferGeometry;
  pedestalMarbleGeo: THREE.BufferGeometry;
  pedestalGoldGeo: THREE.BufferGeometry;
  caramelMainRibbonsGeo: THREE.BufferGeometry;
  caramelSliceRibbonsGeo: THREE.BufferGeometry;
  caramelMainDropsGeo: THREE.BufferGeometry;
  caramelSliceDropsGeo: THREE.BufferGeometry;
  wholeStrawberryGeo: THREE.BufferGeometry;
  strawberryCalyxGeo: THREE.BufferGeometry;
  halfStrawberryOuterGeo: THREE.BufferGeometry;
  halfStrawberryCutGeo: THREE.BufferGeometry;
  blueberryGeo: THREE.BufferGeometry;
  macaronShellsGeo: THREE.BufferGeometry;
  macaronFillingGeo: THREE.BufferGeometry;
  whiteChocShavingGeo: THREE.BufferGeometry;
  icingSugarClusterGeo: THREE.BufferGeometry;
  saintHonoreBorderGeo: THREE.BufferGeometry;
  goldFlakeGeo: THREE.BufferGeometry;
  crownGoldGeo: THREE.BufferGeometry;
  chantillyPearlGeo: THREE.BufferGeometry;
  mintLeafGeo: THREE.BufferGeometry;
  chamomilePetalGeo: THREE.BufferGeometry;
  gardenRoseHeadGeo: THREE.BufferGeometry;
  rosemarySprigGeo: THREE.BufferGeometry;
  pollenDiscGeo: THREE.BufferGeometry;
  pipedRosetteGeo: THREE.BufferGeometry;
  caramelCascadeSkirtGeo: THREE.BufferGeometry;
  fruitChunkGeo: THREE.BufferGeometry;
  crunchShardGeo: THREE.BufferGeometry;
  crunchWedgeGeo: THREE.BufferGeometry;
  caramelSplashRingGeo: THREE.BufferGeometry;
}

type LayerCutReliefKind = 'crunch' | 'sponge' | 'caramel' | 'jelly';

interface LayerCutSpec {
  kind: LayerCutReliefKind;
  yMin: number;
  yMax: number;
  rMax: number;
  heightSegs: number;
  radialSegs: number;
  outerRadiusAtY: (y: number) => number;
}

function hash3D(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return s - Math.floor(s);
}

function smoothNoise3D(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);

  const n000 = hash3D(ix, iy, iz);
  const n100 = hash3D(ix + 1, iy, iz);
  const n010 = hash3D(ix, iy + 1, iz);
  const n110 = hash3D(ix + 1, iy + 1, iz);
  const n001 = hash3D(ix, iy, iz + 1);
  const n101 = hash3D(ix + 1, iy, iz + 1);
  const n011 = hash3D(ix, iy + 1, iz + 1);
  const n111 = hash3D(ix + 1, iy + 1, iz + 1);

  const nx00 = n000 + (n100 - n000) * ux;
  const nx10 = n010 + (n110 - n010) * ux;
  const nx01 = n001 + (n101 - n001) * ux;
  const nx11 = n011 + (n111 - n011) * ux;
  const nxy0 = nx00 + (nx10 - nx00) * uy;
  const nxy1 = nx01 + (nx11 - nx01) * uy;
  return (nxy0 + (nxy1 - nxy0) * uz) * 2.0 - 1.0;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Shared deterministic micro-relief evaluated identically on both revolved wall edges
 * and subdivided cut caps so sponge crumb & crunch shards have zero CAD lines and zero gaps.
 */
function sampleLayerMicroRelief(
  r: number,
  y: number,
  theta: number,
  cutNormalSign: number,
  cutBlend: number,
  spec: LayerCutSpec
): { deltaCut: number; deltaR: number; deltaY: number } {
  const { kind, yMin, yMax, rMax } = spec;
  const yNorm = Math.max(0, Math.min(1, (y - yMin) / Math.max(0.001, yMax - yMin)));
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  // Taper cut displacement smoothly to zero along center spine (r=0) where theta=0 & PI/2 meet
  const spineMask = smoothstep(0.015, 0.055, r);
  const rimMask = smoothstep(rMax * 0.88, rMax, r);
  const topCornerMask = smoothstep(0.84, 1.0, yNorm);

  let deltaCut = 0;
  let deltaR = 0;
  let deltaY = 0;

  if (kind === 'caramel') {
    // 焦糖核心在顶面隆起成流动黄金穹顶球冠（打破平面饼感！）
    const rFrac = Math.min(1.0, r / Math.max(0.01, rMax));
    const topBlend = smoothstep(0.45, 1.0, yNorm);
    const dome = Math.max(0, 1.0 - rFrac * rFrac) * 0.036;
    const wave = Math.sin(theta * 5.0 + r * 26.0) * 0.0042 + Math.cos(theta * 3.0 - r * 14.0) * 0.0032;
    deltaY = topBlend * (dome + wave);
    return { deltaCut: 0, deltaR: 0, deltaY };
  }

  if (kind === 'jelly') {
    // 果胶皇冠浪花：边缘明显八瓣波涛起伏与顶部浪花尖峰（告别扁塑料垫片！）
    const rFrac = Math.min(1.0, r / Math.max(0.01, rMax));
    const flowWave =
      Math.sin(theta * 8.0 + yNorm * 4.2) * 0.012 +
      Math.cos(theta * 12.0 - yNorm * 3.0) * 0.005;
    deltaR = flowWave * rimMask;
    const crownRimLift = smoothstep(0.55, 0.96, rFrac) * (0.014 * (0.5 + 0.5 * Math.sin(theta * 8.0)));
    const innerDip = -Math.max(0, 1.0 - rFrac * rFrac) * 0.008;
    deltaY = smoothstep(0.50, 1.0, yNorm) * (crownRimLift + innerDip);
    return { deltaCut: 0, deltaR, deltaY };
  }

  if (kind === 'crunch') {
    const nRim = smoothNoise3D(cosT * 5.5 + 1.3, sinT * 5.5 - 2.1, yNorm * 7.0 + 4.2);
    const nRimFine = smoothNoise3D(cosT * 13.0 - 3.7, sinT * 13.0 + 5.1, yNorm * 14.0);
    // 强化莎布蕾烤脆边缘的酥碎不规则齿缘，彻底告别平板直边
    deltaR = -(0.0008 + (nRim * 0.5 + 0.5) * 0.0048 + (nRimFine * 0.5 + 0.5) * 0.0024) * rimMask;
    deltaY = -topCornerMask * rimMask * (0.0008 + (nRim * 0.5 + 0.5) * 0.0018);

    if (cutBlend > 0) {
      const nMed = smoothNoise3D(r * 24.0 + cosT * 1.9, yNorm * 8.5, sinT * 1.9 + 7.1);
      const nShard = smoothNoise3D(r * 58.0 - sinT * 2.7, yNorm * 18.0 + 3.4, cosT * 2.7);
      const edgeBreak = smoothNoise3D(cosT * 8.0 + r * 14.0, yNorm * 12.0, sinT * 8.0);
      deltaCut =
        (nMed * 0.0023 + nShard * 0.0014 + edgeBreak * 0.0009 * rimMask) *
        cutNormalSign *
        spineMask *
        cutBlend;
    }
  } else {
    const nRim = smoothNoise3D(cosT * 6.2 + 8.4, sinT * 6.2 + 1.9, yNorm * 8.5 + 2.7);
    deltaR = -(0.0002 + (nRim * 0.5 + 0.5) * 0.0013) * rimMask;
    deltaY = -topCornerMask * rimMask * (0.0004 + (nRim * 0.5 + 0.5) * 0.0008);

    if (cutBlend > 0) {
      const nCrumb = smoothNoise3D(r * 21.0 + sinT * 2.2, y * 115.0 + 9.1, cosT * 2.2);
      const nTear = smoothNoise3D(r * 54.0 + cosT * 3.1, y * 240.0, sinT * 3.1 + 4.8);
      deltaCut =
        (nCrumb * 0.0014 + nTear * 0.00085) *
        cutNormalSign *
        spineMask *
        cutBlend;
    }
  }

  return { deltaCut, deltaR, deltaY };
}

function buildSubdividedLayerProfile(spec: LayerCutSpec): Array<[number, number]> {
  const pts: Array<[number, number]> = [[0.0, spec.yMin]];
  const rBaseMax = spec.outerRadiusAtY(spec.yMin);
  for (let i = 1; i <= spec.radialSegs; i++) {
    pts.push([(i / spec.radialSegs) * rBaseMax, spec.yMin]);
  }
  // Duplicate rim vertex separates flat cap (planar UVs) cleanly from vertical wall (cylindrical UVs)
  pts.push([rBaseMax, spec.yMin]);
  for (let j = 1; j <= spec.heightSegs; j++) {
    const y = spec.yMin + (j / spec.heightSegs) * (spec.yMax - spec.yMin);
    pts.push([spec.outerRadiusAtY(y), y]);
  }
  const rTopMax = spec.outerRadiusAtY(spec.yMax);
  pts.push([rTopMax, spec.yMax]);
  for (let i = spec.radialSegs - 1; i >= 1; i--) {
    pts.push([(i / spec.radialSegs) * rTopMax, spec.yMax]);
  }
  pts.push([0.0, spec.yMax]);
  return pts;
}

function ensureSecondaryUvAttribute(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const uv = geo.attributes.uv;
  if (uv && !geo.attributes.uv1) {
    geo.setAttribute('uv1', uv.clone());
  }
  return geo;
}

/**
 * Revolves a closed 2D profile [(r, y), ...] around Y with:
 *  - Exact r=0 pole preservation (avoiding degenerate internal axis needles)
 *  - Bit-exact position/normal seam welding across theta=0/2PI
 *  - Analytical (0, ±1, 0) pole normals so flat mirror glaze crowns never exhibit radial spokes
 *  - Isotropic arc-length UVs so vanilla specks & honeycomb pores never stretch vertically or per-slice
 */
function buildRevolvedWall(
  profile: Array<[number, number]>,
  thetaStart: number,
  thetaLength: number,
  radialSegs: number,
  weldFullCircle: boolean,
  planarCrownMinY?: number,
  cutSpec?: LayerCutSpec,
  planarBothCaps = false
): THREE.BufferGeometry {
  const pts = profile.map(([x, y]) => new THREE.Vector2(x <= 1e-6 ? 0.0 : x, y));
  const endsOnAxis = pts[0].x <= 1e-6 && pts[pts.length - 1].x <= 1e-6;
  if (!endsOnAxis && pts[0].distanceTo(pts[pts.length - 1]) > 1e-5) {
    pts.push(pts[0].clone());
  }

  const g = new THREE.LatheGeometry(pts, radialSegs, thetaStart, thetaLength);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nRing = pts.length;

  if (cutSpec) {
    for (let i = 0; i <= radialSegs; i++) {
      const phi = thetaStart + (i / radialSegs) * thetaLength;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const blendStart = !weldFullCircle && i <= 3 ? Math.max(0, 1 - i / 3) : 0;
      const blendEnd = !weldFullCircle && i >= radialSegs - 3 ? Math.max(0, 1 - (radialSegs - i) / 3) : 0;
      const cutBlend = Math.max(blendStart, blendEnd);
      const useStart = blendStart >= blendEnd;
      const cutTheta = useStart ? thetaStart : thetaStart + thetaLength;
      const cutSign = useStart ? 1 : -1;

      for (let j = 0; j < nRing; j++) {
        const idx = i * nRing + j;
        const r = pts[j].x;
        const y = pts[j].y;
        const { deltaCut, deltaR, deltaY } = sampleLayerMicroRelief(
          r,
          y,
          phi,
          cutSign,
          cutBlend,
          cutSpec
        );
        const effR = r <= 1e-6 ? 0.0 : Math.max(0, r + deltaR);
        const nx = effR * sinPhi + (cutBlend > 0 ? -Math.cos(cutTheta) * deltaCut : 0);
        const ny = cutSpec.yMin === 0 ? Math.max(0, y + deltaY) : y + deltaY;
        const nz = effR * cosPhi + (cutBlend > 0 ? Math.sin(cutTheta) * deltaCut : 0);
        pos.setXYZ(idx, nx, ny, nz);
      }
    }
  }

  g.computeVertexNormals();

  const norm = g.attributes.normal as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;

  let maxR = 0.01;
  const arcLen = new Float32Array(nRing);
  for (let j = 0; j < nRing; j++) {
    if (pts[j].x > maxR) maxR = pts[j].x;
    if (j > 0) {
      arcLen[j] = arcLen[j - 1] + pts[j].distanceTo(pts[j - 1]);
    }
  }
  const circScale = 1.0 / (2 * Math.PI * maxR);
  const thetaFraction = thetaLength / (Math.PI * 2);

  if (weldFullCircle) {
    for (let j = 0; j < nRing; j++) {
      const i0 = j;
      const iEnd = radialSegs * nRing + j;
      if (iEnd < pos.count) {
        pos.setXYZ(iEnd, pos.getX(i0), pos.getY(i0), pos.getZ(i0));
        const nx = (norm.getX(i0) + norm.getX(iEnd)) * 0.5;
        const ny = (norm.getY(i0) + norm.getY(iEnd)) * 0.5;
        const nz = (norm.getZ(i0) + norm.getZ(iEnd)) * 0.5;
        const len = Math.hypot(nx, ny, nz) || 1;
        norm.setXYZ(i0, nx / len, ny / len, nz / len);
        norm.setXYZ(iEnd, nx / len, ny / len, nz / len);
      }
    }
  }

  // Enforce exact vertical (0, ±1, 0) normals at every central axis pole ring
  for (let j = 0; j < nRing; j++) {
    if (pts[j].x <= 1e-6) {
      let radialDelta = 0;
      if (j === 0 && nRing > 1) {
        radialDelta = pts[1].x - pts[0].x;
      } else if (j === nRing - 1 && nRing > 1) {
        radialDelta = pts[j].x - pts[j - 1].x;
      } else if (j > 0 && j < nRing - 1) {
        radialDelta = pts[j + 1].x - pts[j - 1].x;
      }
      const poleSign = radialDelta >= 0 ? -1 : 1;
      for (let i = 0; i <= radialSegs; i++) {
        const idx = i * nRing + j;
        norm.setXYZ(idx, 0, poleSign, 0);
      }
    }
  }

  // Assign isotropic arc-length UVs (plus seamless planar (x, z) UVs on flat top/bottom caps)
  for (let i = 0; i <= radialSegs; i++) {
    const uCyl = (i / radialSegs) * thetaFraction;
    for (let j = 0; j < nRing; j++) {
      const idx = i * nRing + j;
      const isCrownPlanar =
        planarCrownMinY !== undefined &&
        pos.getY(idx) >= planarCrownMinY &&
        norm.getY(idx) > 0.25;
      const isFlatCapPlanar = planarBothCaps && Math.abs(norm.getY(idx)) > 0.72;
      if (isCrownPlanar || isFlatCapPlanar) {
        uv.setXY(
          idx,
          0.5 + pos.getX(idx) / (2 * maxR),
          0.5 + pos.getZ(idx) / (2 * maxR)
        );
      } else {
        uv.setXY(idx, uCyl, arcLen[j] * circScale);
      }
    }
  }

  pos.needsUpdate = true;
  norm.needsUpdate = true;
  uv.needsUpdate = true;
  return ensureSecondaryUvAttribute(g);
}

/**
 * Triangulates a closed 2D radial cross-section polygon onto a vertical cut plane at `theta`
 * with razor-flat normals and distortion-free planar (r, y) UVs for honeycomb sponge & knife-drag mousse maps.
 */
function buildPlanarCutCap(
  profile: Array<[number, number]>,
  theta: number,
  flipNormal: boolean
): THREE.BufferGeometry {
  const contour: THREE.Vector2[] = [];
  for (const [r, y] of profile) {
    const prev = contour[contour.length - 1];
    if (!prev || Math.hypot(r - prev.x, y - prev.y) > 1e-6) {
      contour.push(new THREE.Vector2(r, y));
    }
  }
  if (
    contour.length > 1 &&
    contour[0].distanceTo(contour[contour.length - 1]) <= 1e-6
  ) {
    contour.pop();
  }
  let signedArea = 0;
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i];
    const b = contour[(i + 1) % contour.length];
    signedArea += a.x * b.y - b.x * a.y;
  }
  if (signedArea < 0) {
    contour.reverse();
  }

  const faces = THREE.ShapeUtils.triangulateShape(contour, []);
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);
  const sign = flipNormal ? -1 : 1;
  const nx = -cosT * sign;
  const nz = sinT * sign;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  for (const tri of faces) {
    const order = flipNormal ? [tri[0], tri[2], tri[1]] : [tri[0], tri[1], tri[2]];
    for (const vi of order) {
      const p = contour[vi];
      positions.push(p.x * sinT, p.y, p.x * cosT);
      normals.push(nx, 0, nz);
      uvs.push(p.x * 2.4, p.y * 2.4);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return ensureSecondaryUvAttribute(g);
}

/**
 * High-density subdivided vertical cut cap (24 x 14..16 grid) with deterministic micro-relief
 * matching the wall cut boundary seamlessly so sponge crumb & crunch shards have zero seams or holes.
 */
function buildSubdividedCutCap(
  spec: LayerCutSpec,
  theta: number,
  flipNormal: boolean
): THREE.BufferGeometry {
  const { radialSegs, heightSegs, yMin, yMax, outerRadiusAtY } = spec;
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);
  const sign = flipNormal ? -1 : 1;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const cols = radialSegs + 1;

  for (let iy = 0; iy <= heightSegs; iy++) {
    const y = yMin + (iy / heightSegs) * (yMax - yMin);
    const rMaxAtY = outerRadiusAtY(y);
    for (let ir = 0; ir <= radialSegs; ir++) {
      const r = (ir / radialSegs) * rMaxAtY;
      const { deltaCut, deltaR, deltaY } = sampleLayerMicroRelief(
        r,
        y,
        theta,
        sign,
        1.0,
        spec
      );
      const effR = r <= 1e-6 ? 0.0 : Math.max(0, r + deltaR);
      const px = effR * sinT - cosT * deltaCut;
      const py = spec.yMin === 0 ? Math.max(0, y + deltaY) : y + deltaY;
      const pz = effR * cosT + sinT * deltaCut;
      positions.push(px, py, pz);
      uvs.push(r * 2.4, y * 2.4);
    }
  }

  for (let iy = 0; iy < heightSegs; iy++) {
    for (let ir = 0; ir < radialSegs; ir++) {
      const a = iy * cols + ir;
      const b = a + 1;
      const c = (iy + 1) * cols + ir + 1;
      const d = (iy + 1) * cols + ir;
      if (flipNormal) {
        indices.push(a, d, b, b, d, c);
      } else {
        indices.push(a, b, d, b, c, d);
      }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return ensureSecondaryUvAttribute(g);
}

export function buildSplitLayerGeometry(
  profile: Array<[number, number]>,
  fullSegs = 96,
  planarCrownMinY?: number,
  cutSpec?: LayerCutSpec,
  planarBothCaps = false
): SplitLayerGeometries {
  const quarterSegs = Math.max(24, Math.round(fullSegs * 0.25));
  const threeQuarterSegs = Math.max(64, fullSegs - quarterSegs);

  const fullGeo = buildRevolvedWall(profile, 0, Math.PI * 2, fullSegs, true, planarCrownMinY, cutSpec, planarBothCaps);

  // 1/4 sliding wedge: theta in [0, PI/2]
  const sliceWallGeo = buildRevolvedWall(profile, 0, Math.PI * 0.5, quarterSegs, false, planarCrownMinY, cutSpec, planarBothCaps);
  const sliceCap0 = cutSpec
    ? buildSubdividedCutCap(cutSpec, 0, false)
    : buildPlanarCutCap(profile, 0, false);
  const sliceCap90 = cutSpec
    ? buildSubdividedCutCap(cutSpec, Math.PI * 0.5, true)
    : buildPlanarCutCap(profile, Math.PI * 0.5, true);
  const sliceCapsGeo = ensureSecondaryUvAttribute(mergeGeometries([sliceCap0, sliceCap90], false)!);
  sliceCap0.dispose();
  sliceCap90.dispose();

  // 3/4 main body: theta in [PI/2, 2*PI]
  const mainWallGeo = buildRevolvedWall(profile, Math.PI * 0.5, Math.PI * 1.5, threeQuarterSegs, false, planarCrownMinY, cutSpec, planarBothCaps);
  const mainCap90 = cutSpec
    ? buildSubdividedCutCap(cutSpec, Math.PI * 0.5, false)
    : buildPlanarCutCap(profile, Math.PI * 0.5, false);
  const mainCap360 = cutSpec
    ? buildSubdividedCutCap(cutSpec, Math.PI * 2.0, true)
    : buildPlanarCutCap(profile, Math.PI * 2.0, true);
  const mainCapsGeo = ensureSecondaryUvAttribute(mergeGeometries([mainCap90, mainCap360], false)!);
  mainCap90.dispose();
  mainCap360.dispose();

  return {
    fullGeo,
    mainWallGeo,
    mainCapsGeo,
    sliceWallGeo,
    sliceCapsGeo,
  };
}

/**
 * Layer 8: Gilded-Rim Carrara Marble Footed Cake Pedestal Stand (y = 0.000 .. 0.120)
 */
function buildMarblePedestalGeometries(): {
  pedestalMarbleGeo: THREE.BufferGeometry;
  pedestalGoldGeo: THREE.BufferGeometry;
} {
  const marbleProfile: Array<[number, number]> = [
    [0.0, 0.000],
    [0.282, 0.000],
    [0.286, 0.014],
    [0.226, 0.022],
    [0.112, 0.030],
    [0.076, 0.046],
    [0.068, 0.064],
    [0.094, 0.082],
    [0.155, 0.092],
    [0.634, 0.096],
    [0.646, 0.106],
    [0.642, 0.120],
    [0.500, 0.120],
    [0.340, 0.120],
    [0.180, 0.120],
    [0.060, 0.120],
    [0.0, 0.120],
  ];
  const pedestalMarbleGeo = buildRevolvedWall(marbleProfile, 0, Math.PI * 2, 72, true, 0.119);

  const goldFootProfile: Array<[number, number]> = [
    [0.280, 0.000],
    [0.296, 0.000],
    [0.298, 0.008],
    [0.288, 0.016],
    [0.280, 0.014],
  ];
  const goldCollarProfile: Array<[number, number]> = [
    [0.068, 0.056],
    [0.086, 0.059],
    [0.086, 0.066],
    [0.068, 0.069],
  ];
  const goldRimProfile: Array<[number, number]> = [
    [0.634, 0.095],
    [0.658, 0.098],
    [0.662, 0.112],
    [0.654, 0.1195],
    [0.642, 0.1195],
    [0.646, 0.106],
  ];

  const footGeo = buildRevolvedWall(goldFootProfile, 0, Math.PI * 2, 64, true);
  const collarGeo = buildRevolvedWall(goldCollarProfile, 0, Math.PI * 2, 48, true);
  const rimGeo = buildRevolvedWall(goldRimProfile, 0, Math.PI * 2, 72, true);
  const pedestalGoldGeo = mergeGeometries([footGeo, collarGeo, rimGeo], false)!;
  footGeo.dispose();
  collarGeo.dispose();
  rimGeo.dispose();

  return { pedestalMarbleGeo, pedestalGoldGeo };
}

/**
 * Builds a single closed variable-radius fluid caramel ribbon along a 3D curve,
 * compressed slightly perpendicular to the cut wall so it drapes organically over sponge pores.
 */
function buildTaperedCaramelRibbonGeometry(
  points: THREE.Vector3[],
  baseRadius: number,
  flattenAxis: 'x' | 'z',
  isDripTip: boolean,
  tubularSegs = 26,
  radialSegs = 12
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(tubularSegs, false);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const p = new THREE.Vector3();

  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    curve.getPointAt(u, p);
    const nVec = frames.normals[i];
    const bVec = frames.binormals[i];

    let radScale: number;
    if (isDripTip) {
      // Wide seam attachment -> slender stretched neck -> plump amber teardrop tip -> closed pole
      const endPinch = u > 0.92 ? Math.max(0.05, Math.cos(((u - 0.92) / 0.08) * (Math.PI * 0.5))) : 1.0;
      const rootFlare = 1.28 * Math.exp(-u * 6.5);
      const neckPinch = 0.52 + 0.48 * Math.pow(Math.abs(u - 0.50) * 2.0, 1.3);
      const tipBulb = 0.42 * Math.exp(-Math.pow((u - 0.85) / 0.11, 2.0));
      radScale = (0.48 * neckPinch + rootFlare + tipBulb) * endPinch;
      if (u < 0.02) radScale *= 0.45 + (u / 0.02) * 0.55;
    } else {
      const capTaper = Math.sin(u * Math.PI);
      const wave = 0.82 + 0.26 * Math.sin(u * Math.PI * 5.0);
      radScale = Math.max(0.05, Math.pow(capTaper, 0.35) * wave);
    }
    const r = baseRadius * radScale;

    for (let j = 0; j <= radialSegs; j++) {
      const v = (j / radialSegs) * Math.PI * 2;
      const cosV = Math.cos(v);
      const sinV = Math.sin(v);
      let dx = (cosV * nVec.x + sinV * bVec.x) * r;
      const dy = (cosV * nVec.y + sinV * bVec.y) * r * (isDripTip ? 1.0 : 1.25);
      let dz = (cosV * nVec.z + sinV * bVec.z) * r;
      if (flattenAxis === 'x') dx *= 0.62;
      else dz *= 0.62;
      positions.push(p.x + dx, p.y + dy, p.z + dz);
      uvs.push(u, j / radialSegs);
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
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return ensureSecondaryUvAttribute(g);
}

/**
 * 5–6 asymmetrical varying-length refracting caramel ribbons & meniscus pooling collar
 * draped organically down across the cut-face sponge & crunch edge.
 */
function createAsymmetricCaramelRibbonsGeometry(isMain: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const s = isMain ? 1 : -1;

  // Meniscus collar hugging +X / -X cut seam (x = 0, z in [0.02..0.306])
  parts.push(
    buildTaperedCaramelRibbonGeometry(
      [
        new THREE.Vector3(0.0018 * s, 0.100, 0.022),
        new THREE.Vector3(0.0054 * s, 0.094, 0.086),
        new THREE.Vector3(0.0062 * s, 0.090, 0.155),
        new THREE.Vector3(0.0052 * s, 0.095, 0.228),
        new THREE.Vector3(0.0046 * s, 0.091, 0.278),
        new THREE.Vector3(0.0015 * s, 0.099, 0.306),
      ],
      0.0068,
      'x',
      false,
      36,
      12
    )
  );

  // Meniscus collar hugging +Z / -Z cut seam (z = 0, x in [0.02..0.306])
  parts.push(
    buildTaperedCaramelRibbonGeometry(
      [
        new THREE.Vector3(0.022, 0.100, 0.0018 * s),
        new THREE.Vector3(0.092, 0.092, 0.0058 * s),
        new THREE.Vector3(0.168, 0.095, 0.0050 * s),
        new THREE.Vector3(0.242, 0.089, 0.0060 * s),
        new THREE.Vector3(0.306, 0.099, 0.0015 * s),
      ],
      0.0066,
      'z',
      false,
      32,
      12
    )
  );

  if (isMain) {
    // 4 asymmetrical flowing ribbons on sunlit +X cut face (mainCap360)
    parts.push(
      buildTaperedCaramelRibbonGeometry(
        [
          new THREE.Vector3(0.0038, 0.096, 0.062),
          new THREE.Vector3(0.0052, 0.082, 0.066),
          new THREE.Vector3(0.0048, 0.071, 0.061),
          new THREE.Vector3(0.0054, 0.061, 0.063),
        ],
        0.0058,
        'x',
        true
      ),
      buildTaperedCaramelRibbonGeometry(
        [
          new THREE.Vector3(0.0042, 0.095, 0.136),
          new THREE.Vector3(0.0058, 0.076, 0.143),
          new THREE.Vector3(0.0050, 0.055, 0.138),
          new THREE.Vector3(0.0056, 0.038, 0.141),
        ],
        0.0068,
        'x',
        true
      ),
      buildTaperedCaramelRibbonGeometry(
        [
          new THREE.Vector3(0.0040, 0.096, 0.214),
          new THREE.Vector3(0.0055, 0.080, 0.208),
          new THREE.Vector3(0.0048, 0.064, 0.212),
          new THREE.Vector3(0.0054, 0.050, 0.209),
        ],
        0.0062,
        'x',
        true
      ),
      buildTaperedCaramelRibbonGeometry(
        [
          new THREE.Vector3(0.0036, 0.095, 0.276),
          new THREE.Vector3(0.0050, 0.082, 0.272),
          new THREE.Vector3(0.0052, 0.069, 0.275),
        ],
        0.0052,
        'x',
        true
      ),
      // 2 asymmetrical flowing ribbons on +Z cut face (mainCap90)
      buildTaperedCaramelRibbonGeometry(
        [
          new THREE.Vector3(0.108, 0.095, 0.0040),
          new THREE.Vector3(0.114, 0.078, 0.0056),
          new THREE.Vector3(0.109, 0.061, 0.0050),
          new THREE.Vector3(0.112, 0.048, 0.0055),
        ],
        0.0062,
        'z',
        true
      ),
      buildTaperedCaramelRibbonGeometry(
        [
          new THREE.Vector3(0.236, 0.094, 0.0042),
          new THREE.Vector3(0.230, 0.073, 0.0058),
          new THREE.Vector3(0.235, 0.053, 0.0050),
          new THREE.Vector3(0.233, 0.039, 0.0056),
        ],
        0.0066,
        'z',
        true
      )
    );
  } else {
    // 5 asymmetrical flowing ribbons on sliding 1/4 slice (-X and -Z cut faces)
    parts.push(
      buildTaperedCaramelRibbonGeometry(
        [
          new THREE.Vector3(-0.0038, 0.096, 0.072),
          new THREE.Vector3(-0.0054, 0.080, 0.076),
          new THREE.Vector3(-0.0048, 0.065, 0.071),
          new THREE.Vector3(-0.0054, 0.053, 0.073),
        ],
        0.0058,
        'x',
        true
      ),
      buildTaperedCaramelRibbonGeometry(
        [
          new THREE.Vector3(-0.0042, 0.095, 0.164),
          new THREE.Vector3(-0.0058, 0.074, 0.158),
          new THREE.Vector3(-0.0050, 0.054, 0.163),
          new THREE.Vector3(-0.0056, 0.038, 0.160),
        ],
        0.0066,
        'x',
        true
      ),
      buildTaperedCaramelRibbonGeometry(
        [
          new THREE.Vector3(-0.0036, 0.095, 0.254),
          new THREE.Vector3(-0.0050, 0.080, 0.258),
          new THREE.Vector3(-0.0052, 0.065, 0.255),
        ],
        0.0052,
        'x',
        true
      ),
      buildTaperedCaramelRibbonGeometry(
        [
          new THREE.Vector3(0.098, 0.095, -0.0040),
          new THREE.Vector3(0.104, 0.076, -0.0056),
          new THREE.Vector3(0.099, 0.056, -0.0050),
          new THREE.Vector3(0.102, 0.042, -0.0056),
        ],
        0.0064,
        'z',
        true
      ),
      buildTaperedCaramelRibbonGeometry(
        [
          new THREE.Vector3(0.222, 0.095, -0.0038),
          new THREE.Vector3(0.217, 0.078, -0.0054),
          new THREE.Vector3(0.221, 0.058, -0.0052),
        ],
        0.0056,
        'z',
        true
      )
    );
  }

  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return ensureSecondaryUvAttribute(merged);
}

/**
 * Asymmetrical suspended amber caramel teardrop droplets clinging to exposed sponge cut faces.
 */
function createAsymmetricCaramelDropsGeometry(isMain: boolean): THREE.BufferGeometry {
  const dropPts = [
    new THREE.Vector2(0.0, 0.000),
    new THREE.Vector2(0.0056, 0.0032),
    new THREE.Vector2(0.0068, 0.0085),
    new THREE.Vector2(0.0046, 0.0160),
    new THREE.Vector2(0.0024, 0.0235),
    new THREE.Vector2(0.0012, 0.0300),
    new THREE.Vector2(0.0, 0.0335),
  ];

  const specs = isMain
    ? [
        { pos: [0.0044, 0.062, 0.098], scale: [0.88, 0.92, 0.65] as [number, number, number] },
        { pos: [0.0048, 0.040, 0.175], scale: [1.05, 1.10, 0.72] as [number, number, number] },
        { pos: [0.0042, 0.056, 0.246], scale: [0.78, 0.84, 0.64] as [number, number, number] },
        { pos: [0.172, 0.054, 0.0046], scale: [0.68, 0.96, 0.94] as [number, number, number] },
      ]
    : [
        { pos: [-0.0046, 0.048, 0.118], scale: [0.92, 1.02, 0.66] as [number, number, number] },
        { pos: [-0.0044, 0.055, 0.208], scale: [0.80, 0.86, 0.62] as [number, number, number] },
        { pos: [0.158, 0.046, -0.0046], scale: [0.66, 0.98, 0.92] as [number, number, number] },
      ];

  const parts: THREE.BufferGeometry[] = [];
  for (const s of specs) {
    const g = new THREE.LatheGeometry(dropPts, 20);
    g.scale(s.scale[0], s.scale[1], s.scale[2]);
    g.translate(s.pos[0], s.pos[1], s.pos[2]);
    g.computeVertexNormals();
    parts.push(g);
  }

  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return ensureSecondaryUvAttribute(merged);
}

/**
 * Evaluates sculpted teardrop strawberry radius (y in [0..0.041], widest shoulder at y~0.028, tip at y=0).
 */
function sampleStrawberryRadius(v: number, theta: number): { r: number; y: number } {
  const y = v * 0.0405 - Math.pow(Math.max(0, (v - 0.90) / 0.10), 2.0) * 0.0022;
  let rBase: number;
  if (v <= 0.001) {
    rBase = 0.0;
  } else if (v >= 0.999) {
    rBase = 0.0;
  } else {
    // Organic strawberry heart-teardrop silhouette: tapered rounded nose -> plump shoulder -> tucked stem crown
    const taper = Math.pow(Math.sin(Math.pow(v, 0.72) * Math.PI), 0.78);
    const shoulder = 0.76 + 0.34 * Math.exp(-Math.pow((v - 0.68) / 0.24, 2.0));
    rBase = 0.0168 * taper * shoulder;
  }
  const lobe = 1.0 + 0.045 * Math.cos(theta * 5.0 + 0.4) * Math.sin(v * Math.PI);
  return { r: Math.max(0, rBase * lobe), y: Math.max(0, y) };
}

/**
 * Reusable Exported Sculpted Whole Strawberry Geometry (teardrop contour + natural 5-lobe shoulder + stem dimple).
 */
export function createWholeStrawberryGeometry(): THREE.BufferGeometry {
  const rings = 26;
  const sectors = 32;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let ir = 0; ir <= rings; ir++) {
    const v = ir / rings;
    for (let is = 0; is <= sectors; is++) {
      const u = is / sectors;
      const theta = u * Math.PI * 2;
      const { r, y } = sampleStrawberryRadius(v, theta);
      const x = r * Math.sin(theta);
      const z = r * Math.cos(theta);
      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  const row = sectors + 1;
  for (let ir = 0; ir < rings; ir++) {
    for (let is = 0; is < sectors; is++) {
      const a = ir * row + is;
      const b = a + 1;
      const c = (ir + 1) * row + is + 1;
      const d = (ir + 1) * row + is;
      indices.push(a, d, b, b, d, c);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();

  // Weld seam & enforce exact vertical pole normals
  const pos = g.attributes.position as THREE.BufferAttribute;
  const norm = g.attributes.normal as THREE.BufferAttribute;
  for (let ir = 0; ir <= rings; ir++) {
    const i0 = ir * row;
    const iEnd = ir * row + sectors;
    pos.setXYZ(iEnd, pos.getX(i0), pos.getY(i0), pos.getZ(i0));
    const nx = (norm.getX(i0) + norm.getX(iEnd)) * 0.5;
    const ny = (norm.getY(i0) + norm.getY(iEnd)) * 0.5;
    const nz = (norm.getZ(i0) + norm.getZ(iEnd)) * 0.5;
    const len = Math.hypot(nx, ny, nz) || 1;
    norm.setXYZ(i0, nx / len, ny / len, nz / len);
    norm.setXYZ(iEnd, nx / len, ny / len, nz / len);
  }
  for (let is = 0; is <= sectors; is++) {
    norm.setXYZ(is, 0, -1, 0);
    norm.setXYZ(rings * row + is, 0, 1, 0);
  }
  pos.needsUpdate = true;
  norm.needsUpdate = true;
  return ensureSecondaryUvAttribute(g);
}

/**
 * Reusable Exported Delicate 8-Leaf Strawberry Calyx Crown + Short Pedicel Stem (sits flush at y=0.0385 atop berry).
 */
export function createStrawberryCalyxGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const sepalCount = 8;

  for (let s = 0; s < sepalCount; s++) {
    const ang = (s / sepalCount) * Math.PI * 2 + (s % 2) * 0.14;
    const len = 0.0155 + (s % 2) * 0.0032;
    const maxW = 0.0046;
    const segU = 7;
    const segV = 4;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const width = maxW * Math.sin(Math.pow(u, 0.55) * Math.PI);
      const rOut = 0.0018 + u * len;
      const archY = 0.0390 - Math.pow(u, 1.35) * 0.0028 + Math.sin(u * Math.PI) * 0.0024 + (s % 2) * 0.0008;
      for (let iv = 0; iv <= segV; iv++) {
        const v = iv / segV;
        const side = (v * 2 - 1) * width;
        const cup = Math.abs(v * 2 - 1) * 0.0011 * (1 - u * 0.5);
        const lx = rOut;
        const lz = side;
        const rx = lx * Math.cos(ang) - lz * Math.sin(ang);
        const rz = lx * Math.sin(ang) + lz * Math.cos(ang);
        positions.push(rx, archY + cup, rz);
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
        indices.push(a, b, d, b, c, d);
      }
    }
    const sepal = new THREE.BufferGeometry();
    sepal.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    sepal.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    sepal.setIndex(indices);
    sepal.computeVertexNormals();
    parts.push(sepal);
  }

  // Short curved green stem pedicel
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.0385, 0),
    new THREE.Vector3(0.0012, 0.044, 0.0008),
    new THREE.Vector3(0.0028, 0.049, 0.0016),
  ]);
  const stem = new THREE.TubeGeometry(stemCurve, 6, 0.0015, 6, false);
  parts.push(stem);

  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

/**
 * Reusable Exported Halved Fresh Strawberry Geometry:
 *  - `berryGeo`: sculpted exterior half dome (z >= 0) with achene skin UVs
 *  - `cutFaceGeo`: crisp flat cross-section plane (z = 0, facing -Z) with planar heart UVs matching `strawberryCutMap`
 */
export function createHalfStrawberryGeometry(): {
  berryGeo: THREE.BufferGeometry;
  cutFaceGeo: THREE.BufferGeometry;
} {
  const rings = 24;
  const sectors = 18;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let ir = 0; ir <= rings; ir++) {
    const v = ir / rings;
    for (let is = 0; is <= sectors; is++) {
      const u = is / sectors;
      // Half circumference theta in [-PI/2 .. +PI/2] -> cos(theta) >= 0 (z >= 0)
      const theta = -Math.PI * 0.5 + u * Math.PI;
      const { r, y } = sampleStrawberryRadius(v, theta);
      positions.push(r * Math.sin(theta), y, r * Math.cos(theta));
      uvs.push(u * 0.5, v);
    }
  }
  const row = sectors + 1;
  for (let ir = 0; ir < rings; ir++) {
    for (let is = 0; is < sectors; is++) {
      const a = ir * row + is;
      const b = a + 1;
      const c = (ir + 1) * row + is + 1;
      const d = (iuOrZero(ir) + 1) * row + is;
      indices.push(a, d, b, b, d, c);
    }
  }
  function iuOrZero(x: number) {
    return x;
  }

  const berryGeo = new THREE.BufferGeometry();
  berryGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  berryGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  berryGeo.setIndex(indices);
  berryGeo.computeVertexNormals();
  const bNorm = berryGeo.attributes.normal as THREE.BufferAttribute;
  for (let is = 0; is <= sectors; is++) {
    bNorm.setXYZ(is, 0, -1, 0);
    bNorm.setXYZ(rings * row + is, 0, 1, 0);
  }
  bNorm.needsUpdate = true;

  // Flat vertical heart-shaped strawberry cross-section cap on z = 0 facing -Z
  const contour: THREE.Vector2[] = [];
  for (let ir = 1; ir < rings; ir++) {
    const v = ir / rings;
    const { r, y } = sampleStrawberryRadius(v, Math.PI * 0.5);
    contour.push(new THREE.Vector2(r, y));
  }
  for (let ir = rings - 1; ir >= 1; ir--) {
    const v = ir / rings;
    const { r, y } = sampleStrawberryRadius(v, -Math.PI * 0.5);
    contour.push(new THREE.Vector2(-r, y));
  }
  const faces = THREE.ShapeUtils.triangulateShape(contour, []);
  const cutPos: number[] = [];
  const cutNorm: number[] = [];
  const cutUv: number[] = [];
  for (const tri of faces) {
    // Wind clockwise in XY so normal faces -Z cleanly
    for (const vi of [tri[0], tri[2], tri[1]]) {
      const p = contour[vi];
      cutPos.push(p.x, p.y, 0);
      cutNorm.push(0, 0, -1);
      cutUv.push(0.5 + p.x / 0.036, p.y / 0.041);
    }
  }
  const cutFaceGeo = new THREE.BufferGeometry();
  cutFaceGeo.setAttribute('position', new THREE.Float32BufferAttribute(cutPos, 3));
  cutFaceGeo.setAttribute('normal', new THREE.Float32BufferAttribute(cutNorm, 3));
  cutFaceGeo.setAttribute('uv', new THREE.Float32BufferAttribute(cutUv, 2));

  return {
    berryGeo: ensureSecondaryUvAttribute(berryGeo),
    cutFaceGeo: ensureSecondaryUvAttribute(cutFaceGeo),
  };
}

/**
 * Reusable Exported Sculpted Frosted Blueberry Geometry (oblate sphere + 5-point indented calyx crown).
 */
export function createBlueberryGeometry(): THREE.BufferGeometry {
  const rings = 20;
  const sectors = 28;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let ir = 0; ir <= rings; ir++) {
    const v = ir / rings;
    const phi = v * Math.PI;
    for (let is = 0; is <= sectors; is++) {
      const u = is / sectors;
      const theta = u * Math.PI * 2;
      const baseR = 0.0112 * Math.sin(phi) * (1.0 + 0.032 * Math.cos(theta * 5.0));
      let y = 0.0086 - Math.cos(phi) * 0.0086;
      // Indented 5-point blossom calyx dimple & tiny pointed calyx rim at top pole (v > 0.80)
      if (v > 0.82) {
        const crownT = (v - 0.82) / 0.18;
        const calyxRim = Math.exp(-Math.pow((crownT - 0.35) / 0.25, 2.0)) * (0.0014 + 0.0012 * Math.max(0, Math.cos(theta * 5.0)));
        const dimpleDip = Math.pow(crownT, 1.5) * 0.0026;
        y += calyxRim - dimpleDip;
      }
      positions.push(baseR * Math.sin(theta), Math.max(0, y), baseR * Math.cos(theta));
      uvs.push(u, v);
    }
  }

  const row = sectors + 1;
  for (let ir = 0; ir < rings; ir++) {
    for (let is = 0; is < sectors; is++) {
      const a = ir * row + is;
      const b = a + 1;
      const c = (ir + 1) * row + is + 1;
      const d = (ir + 1) * row + is;
      indices.push(a, d, b, b, d, c);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  const pos = g.attributes.position as THREE.BufferAttribute;
  const norm = g.attributes.normal as THREE.BufferAttribute;
  for (let ir = 0; ir <= rings; ir++) {
    const i0 = ir * row;
    const iEnd = ir * row + sectors;
    pos.setXYZ(iEnd, pos.getX(i0), pos.getY(i0), pos.getZ(i0));
    const nx = (norm.getX(i0) + norm.getX(iEnd)) * 0.5;
    const ny = (norm.getY(i0) + norm.getY(iEnd)) * 0.5;
    const nz = (norm.getZ(i0) + norm.getZ(iEnd)) * 0.5;
    const len = Math.hypot(nx, ny, nz) || 1;
    norm.setXYZ(i0, nx / len, ny / len, nz / len);
    norm.setXYZ(iEnd, nx / len, ny / len, nz / len);
  }
  for (let is = 0; is <= sectors; is++) {
    norm.setXYZ(is, 0, -1, 0);
    norm.setXYZ(rings * row + is, 0, 1, 0);
  }
  pos.needsUpdate = true;
  norm.needsUpdate = true;
  return g;
}

/**
 * Reusable Exported Parisian French Macaron Geometry:
 *  - `shellsGeo`: twin almond meringue domed shells with lacy bubbly *pied* skirts (UV v < 0.25 maps pied zone!)
 *  - `fillingGeo`: plump cushioned whipped Chantilly/ganache cream center sandwiched between both shells
 */
export function createFrenchMacaronGeometry(): {
  shellsGeo: THREE.BufferGeometry;
  fillingGeo: THREE.BufferGeometry;
} {
  const buildShell = (isTop: boolean): THREE.BufferGeometry => {
    const sectors = 48;
    const profile: Array<[number, number, number]> = [
      // [radius, y, uvV]
      [0.0, 0.0, 0.22],
      [0.015, 0.0, 0.22],
      [0.0292, 0.0, 0.14],
      [0.0322, 0.0014, 0.12], // airy lacy pied foot
      [0.0325, 0.0030, 0.16],
      [0.0308, 0.0040, 0.24], // waist tuck above pied
      [0.0314, 0.0054, 0.42],
      [0.0282, 0.0076, 0.60],
      [0.0210, 0.0092, 0.78],
      [0.0110, 0.0101, 0.90],
      [0.0, 0.0104, 1.0],
    ];
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const nRing = profile.length;

    for (let is = 0; is <= sectors; is++) {
      const u = is / sectors;
      const theta = u * Math.PI * 2;
      for (let ir = 0; ir < nRing; ir++) {
        const [rBase, yLocal, uvV] = profile[ir];
        const isPied = uvV >= 0.10 && uvV <= 0.24 ? 1.0 : 0.0;
        const r = rBase + isPied * 0.00075 * Math.sin(theta * 24.0 + ir * 1.3);
        const y = isTop ? 0.0150 + yLocal : 0.0104 - yLocal;
        positions.push(r * Math.sin(theta), y, r * Math.cos(theta));
        uvs.push(u, uvV);
      }
    }
    for (let is = 0; is < sectors; is++) {
      for (let ir = 0; ir < nRing - 1; ir++) {
        const a = is * nRing + ir;
        const b = a + 1;
        const c = (is + 1) * nRing + ir + 1;
        const d = (is + 1) * nRing + ir;
        if (isTop) {
          indices.push(a, d, b, b, d, c);
        } else {
          indices.push(a, b, d, b, c, d);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    const pos = g.attributes.position as THREE.BufferAttribute;
    const norm = g.attributes.normal as THREE.BufferAttribute;
    for (let ir = 0; ir < nRing; ir++) {
      const i0 = ir;
      const iEnd = sectors * nRing + ir;
      pos.setXYZ(iEnd, pos.getX(i0), pos.getY(i0), pos.getZ(i0));
      const nx = (norm.getX(i0) + norm.getX(iEnd)) * 0.5;
      const ny = (norm.getY(i0) + norm.getY(iEnd)) * 0.5;
      const nz = (norm.getZ(i0) + norm.getZ(iEnd)) * 0.5;
      const len = Math.hypot(nx, ny, nz) || 1;
      norm.setXYZ(i0, nx / len, ny / len, nz / len);
      norm.setXYZ(iEnd, nx / len, ny / len, nz / len);
    }
    return g;
  };

  const botShell = buildShell(false);
  const topShell = buildShell(true);
  const shellsGeo = mergeGeometries([botShell, topShell], false)!;
  botShell.dispose();
  topShell.dispose();

  const fillProfile: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.0092),
    new THREE.Vector2(0.0285, 0.0092),
    new THREE.Vector2(0.0314, 0.0110),
    new THREE.Vector2(0.0320, 0.0127),
    new THREE.Vector2(0.0314, 0.0144),
    new THREE.Vector2(0.0285, 0.0162),
    new THREE.Vector2(0.0, 0.0162),
  ];
  const fillingGeo = new THREE.LatheGeometry(fillProfile, 40);
  fillingGeo.computeVertexNormals();

  return { shellsGeo, fillingGeo };
}

/**
 * Reusable Exported Delicate Ivory White-Chocolate Thin Shaving (light curved chisel ribbon, zero thick black pipe!).
 */
export function createWhiteChocShavingGeometry(): THREE.BufferGeometry {
  const segU = 28;
  const segV = 8;
  const thick = 0.00075;
  const rings: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]> = [];

  for (let i = 0; i <= segU; i++) {
    const u = i / segU;
    const ang = u * Math.PI * 2.15;
    const rad = 0.0052 + u * 0.0085;
    const halfW = 0.0115 * (0.45 + 0.55 * Math.sin(u * Math.PI));
    const cx = Math.cos(ang) * rad;
    const cy = 0.011 + Math.sin(ang) * rad * 0.85;
    const cz = u * 0.005;
    const nx = Math.cos(ang);
    const ny = Math.sin(ang);
    const fluteTilt = Math.sin(u * Math.PI * 3.0) * 0.0014;

    rings.push([
      new THREE.Vector3(cx + nx * halfW * 0.14, cy + ny * halfW * 0.14 + thick, cz - halfW + fluteTilt),
      new THREE.Vector3(cx + nx * halfW * 0.14, cy + ny * halfW * 0.14 + thick, cz + halfW + fluteTilt),
      new THREE.Vector3(cx + nx * halfW * 0.14, cy + ny * halfW * 0.14, cz + halfW + fluteTilt),
      new THREE.Vector3(cx + nx * halfW * 0.14, cy + ny * halfW * 0.14, cz - halfW + fluteTilt),
    ]);
  }
  void segV;

  const parts: THREE.BufferGeometry[] = [];
  for (let face = 0; face < 4; face++) {
    const next = (face + 1) % 4;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= segU; i++) {
      const pA = rings[i][face];
      const pB = rings[i][next];
      positions.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
      uvs.push(i / segU, 0, i / segU, 1);
    }
    for (let i = 0; i < segU; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2 + 1;
      const d = (i + 1) * 2;
      indices.push(a, b, c, a, c, d);
    }
    const strip = new THREE.BufferGeometry();
    strip.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    strip.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    strip.setIndex(indices);
    strip.computeVertexNormals();
    parts.push(strip);
  }
  for (const endIdx of [0, segU]) {
    const [p0, p1, p2, p3] = rings[endIdx];
    const cap = new THREE.BufferGeometry();
    cap.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z], 3)
    );
    cap.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    cap.setIndex(endIdx === 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
    cap.computeVertexNormals();
    parts.push(cap);
  }
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

/**
 * Fine Icing Sugar Dusting Cluster (delicate snow-white micro sugar grains dusted across strawberries & crown).
 */
function createIcingSugarClusterGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const count = 48;
  for (let i = 0; i < count; i++) {
    const a = i * 2.39996;
    const r = 0.004 + Math.sqrt((i + 0.5) / count) * 0.036;
    const sz = 0.00065 + (i % 5) * 0.00022;
    const grain = new THREE.OctahedronGeometry(sz, 0);
    grain.scale(1.2, 0.55, 1.1);
    grain.rotateY(a);
    grain.translate(Math.cos(a) * r, 0.0005 + (i % 3) * 0.0003, Math.sin(a) * r);
    parts.push(grain);
  }
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

/**
 * Faceted Irregularly Torn 24K Edible Gold Leaf Flake (polar organic contour + fine crinkled facets)
 */
function createGoldLeafFlakeGeometry(scale = 1): THREE.BufferGeometry {
  const rings = 7;
  const sectors = 24;
  const baseRadius = 0.021 * scale;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let ir = 0; ir <= rings; ir++) {
    const rFrac = ir / rings;
    for (let is = 0; is <= sectors; is++) {
      const theta = (is / sectors) * Math.PI * 2;
      const contourWarp =
        1.0 +
        0.26 * Math.sin(theta * 3.0 + 0.7) +
        0.16 * Math.cos(theta * 5.0 - 1.2) +
        0.10 * Math.sin(theta * 7.0 + 2.1);
      const r = baseRadius * rFrac * contourWarp;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r * 0.78;

      const crinkle =
        Math.sin((x * 290) / scale + (z * 210) / scale) * 0.0029 * scale +
        Math.cos((z * 360) / scale - (x * 170) / scale) * 0.0019 * scale;
      const edgeCurl = Math.pow(rFrac, 2.0) * (0.0046 + 0.0028 * Math.sin(theta * 2.0 + 0.4)) * scale;
      const y = Math.abs(crinkle) + edgeCurl + 0.0008;

      positions.push(x, y, z);
      uvs.push(0.5 + x / (baseRadius * 2.6), 0.5 + z / (baseRadius * 2.6));
    }
  }

  const row = sectors + 1;
  for (let ir = 0; ir < rings; ir++) {
    for (let is = 0; is < sectors; is++) {
      const a = ir * row + is;
      const b = a + 1;
      const c = (ir + 1) * row + is + 1;
      const d = (ir + 1) * row + is;
      indices.push(a, b, c, a, c, d);
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
 * Artisanal 6-flute spiraled open-star piped Chantilly rosette peak with soft pastry-tip curl.
 */
function createChantillyQuenelleGeometry(): THREE.BufferGeometry {
  const rings = 24;
  const sectors = 48;
  const height = 0.030;
  const baseR = 0.0185;
  const flutes = 6;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let ir = 0; ir <= rings; ir++) {
    const v = ir / rings;
    // Plump scalloped rosette skirt spiraling smoothly into a fine piped peak
    const profileR = baseR * (1.0 - Math.pow(v, 1.32)) * (1.0 + 0.22 * Math.sin(v * Math.PI));
    const fluteAmp = 0.34 * (1.0 - 0.44 * v) * Math.min(1.0, v / 0.12 + 0.38);
    const twist = v * 2.85;
    // Dynamic curved piping-tip curl at apex
    const hookT = Math.max(0, (v - 0.60) / 0.40);
    const hookX = hookT * hookT * 0.0068;
    const hookZ = hookT * hookT * 0.0026;
    const y = v * height;

    for (let is = 0; is <= sectors; is++) {
      const u = is / sectors;
      const theta = u * Math.PI * 2;
      const wave = Math.cos(flutes * theta - twist);
      // Sharpen valleys slightly while keeping star ribs plump and pillowy
      const starRib = 1.0 + fluteAmp * (wave >= 0 ? Math.pow(wave, 0.82) : -Math.pow(-wave, 1.15));
      const r = Math.max(0.0002, profileR * starRib);
      const x = Math.cos(theta) * r + hookX;
      const z = Math.sin(theta) * r + hookZ;
      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  const row = sectors + 1;
  for (let ir = 0; ir < rings; ir++) {
    for (let is = 0; is < sectors; is++) {
      const a = ir * row + is;
      const b = a + 1;
      const c = (ir + 1) * row + is + 1;
      const d = (ir + 1) * row + is;
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
 * Reusable Exported Authentic French Saint-Honoré Piped Cream Wave Border (y >= 0, tangent along +X/-X).
 * Replaces serrated gear-tooth rosettes with plump overlapping teardrop-crested cream petals!
 */
export function createSaintHonoreBorderGeometry(): THREE.BufferGeometry {
  const lengthSegs = 28;
  const radialSegs = 28;
  const length = 0.094;
  const maxR = 0.0235;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= lengthSegs; i++) {
    const u = i / lengthSegs; // 0 = plump forward pillow petal (+X), 1 = softly tucked tail (-X)
    const env = Math.sin(Math.pow(u, 0.56) * Math.PI) * (1.0 - 0.16 * u);
    const scaleR = Math.max(0.0008, maxR * env);
    const centerX = (0.34 - u) * length;
    const archY = Math.sin(Math.pow(u, 0.58) * Math.PI) * 0.024 + 0.0028 * (1.0 - u);
    const softCrest = Math.sin(u * Math.PI) * 0.0024;

    for (let j = 0; j <= radialSegs; j++) {
      const v = j / radialSegs;
      const theta = v * Math.PI * 2;
      // Soft pillowy overlapping Saint-Honoré cream wave petal (zero jagged teeth!)
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      const gentleFold = sinT > 0.15 ? Math.pow((sinT - 0.15) / 0.85, 1.35) : 0;
      const ly = sinT * scaleR * 0.94 + gentleFold * softCrest;
      const lz = cosT * scaleR * (1.18 - gentleFold * 0.12);
      const y = Math.max(0.0006, archY + ly);
      const z = lz;
      positions.push(centerX, y, z);
      uvs.push(u, v);
    }
  }

  const row = radialSegs + 1;
  for (let i = 0; i < lengthSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * row + j;
      const b = a + 1;
      const c = (i + 1) * row + j + 1;
      const d = (i + 1) * row + j;
      indices.push(a, b, d, b, c, d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return ensureSecondaryUvAttribute(g);
}

/**
 * Sculpted Botanical Mint Leaf Blade (length along +X, upward +Y front normals, arched cleanly above cake crown)
 */
function createSculptedMintLeafGeometry(): THREE.BufferGeometry {
  const segU = 14;
  const segV = 10;
  const len = 0.038;
  const maxHalfW = 0.0132;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iu = 0; iu <= segU; iu++) {
    const u = iu / segU; // 0 = stem base, 1 = pointed tip
    const baseProfile = Math.sin(Math.pow(u, 0.78) * Math.PI);
    const serration = 1.0 + 0.075 * Math.sin(u * Math.PI * 10.0) * smoothstep(0.12, 0.35, u) * (1.0 - smoothstep(0.80, 1.0, u));
    const halfW = maxHalfW * baseProfile * serration;
    // Gently arched upward so leaf tip NEVER plunges into the buttercream crown
    const archY = 0.0028 + Math.sin(u * Math.PI) * 0.0068 - u * u * 0.0014;

    for (let iv = 0; iv <= segV; iv++) {
      const v = iv / segV; // 0..1 across width
      const s = v * 2.0 - 1.0; // -1..+1
      const z = s * halfW;
      const cupY = Math.abs(s) * 0.0032 * baseProfile;
      const veinRipple = Math.sin(u * Math.PI * 6.0 - Math.abs(s) * 2.6) * 0.00050 * baseProfile;
      const y = archY + cupY + veinRipple;
      const x = u * len;
      positions.push(x, y, z);
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
      // Verified upward +Y front normals: (b-a)[+Z] x (d-a)[+X] = +Y!
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
 * Delicate Arched Spoon-Shaped Wild Chamomile Petal Blade (length along +X, upward +Y front normals)
 */
function createChamomilePetalGeometry(): THREE.BufferGeometry {
  const segU = 10;
  const segV = 6;
  const len = 0.023;
  const maxHalfW = 0.0058;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iu = 0; iu <= segU; iu++) {
    const u = iu / segU;
    const widthProfile = Math.sin(Math.pow(u, 0.65) * Math.PI) * (0.45 + 0.55 * Math.pow(u, 0.35));
    const halfW = maxHalfW * widthProfile;
    const archY = 0.0012 + Math.sin(u * Math.PI) * 0.0036 - Math.pow(u, 2.4) * 0.0015;

    for (let iv = 0; iv <= segV; iv++) {
      const v = iv / segV;
      const s = v * 2.0 - 1.0;
      const z = s * halfW;
      const cupY = s * s * 0.0012 * widthProfile;
      positions.push(u * len, archY + cupY, z);
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
      // Verified upward +Y front normals!
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
 * Sculpted Multi-Ring Spiraling French Garden Rose Head (inner tight spiral bud + 5 cupped mid petals + 7 recurved outer petals)
 */
function createGardenRoseHeadGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const buildCuppedRosePetal = (
    radius: number,
    height: number,
    arcSpan: number,
    flareOut: number,
    curlTip: number
  ): THREE.BufferGeometry => {
    const segU = 10;
    const segV = 10;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let iv = 0; iv <= segV; iv++) {
      const v = iv / segV; // 0 = base, 1 = top rim
      const rLayer = radius * (0.42 + 0.58 * Math.pow(v, 0.55)) + Math.pow(v, 1.8) * flareOut;
      const yBase = v * height;
      const tipCurlOut = Math.pow(Math.max(0, (v - 0.62) / 0.38), 2.0) * curlTip;

      for (let iu = 0; iu <= segU; iu++) {
        const u = iu / segU;
        const s = u * 2.0 - 1.0; // -1..+1 across petal width
        const petalShape = Math.sin(u * Math.PI);
        const angle = s * arcSpan * 0.5 * (0.55 + 0.45 * Math.sin(v * Math.PI * 0.85));
        const r = rLayer + tipCurlOut * (0.4 + 0.6 * petalShape);
        // Slightly notched heart-shaped rose petal upper rim
        const y = yBase * (0.72 + 0.28 * petalShape) - tipCurlOut * 0.38;
        positions.push(Math.sin(angle) * r, y, Math.cos(angle) * r);
        uvs.push(u, v);
      }
    }

    const row = segU + 1;
    for (let iv = 0; iv < segV; iv++) {
      for (let iu = 0; iu < segU; iu++) {
        const a = iv * row + iu;
        const b = a + 1;
        const c = (iv + 1) * row + iu + 1;
        const d = (iv + 1) * row + iu;
        indices.push(a, b, c, a, c, d);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  };

  // Ring 0: Tightly scrolled central rosebud (3 inner petals)
  for (let i = 0; i < 3; i++) {
    const p = buildCuppedRosePetal(0.0085, 0.022, 2.35, 0.0022, 0.0028);
    p.rotateY((i / 3) * Math.PI * 2 + 0.2);
    p.translate(0, 0.006, 0);
    parts.push(p);
  }
  // Ring 1: 5 cupped middle petals
  for (let i = 0; i < 5; i++) {
    const p = buildCuppedRosePetal(0.0155, 0.025, 1.55, 0.0062, 0.0065);
    p.rotateY((i / 5) * Math.PI * 2 + 0.65);
    p.translate(0, 0.004, 0);
    parts.push(p);
  }
  // Ring 2: 7 lush recurved outer garden-rose petals
  for (let i = 0; i < 7; i++) {
    const p = buildCuppedRosePetal(0.0235, 0.024, 1.28, 0.0115, 0.0105);
    p.rotateY((i / 7) * Math.PI * 2 + 0.15);
    p.translate(0, 0.001, 0);
    parts.push(p);
  }

  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

/**
 * Sculpted Fresh Rosemary Sprig (curved woody stem + radiating slender needle blades along +X)
 */
function createRosemarySprigGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.001, 0),
    new THREE.Vector3(0.018, 0.008, 0.002),
    new THREE.Vector3(0.036, 0.012, -0.001),
    new THREE.Vector3(0.052, 0.011, 0.002),
  ]);
  const stem = new THREE.TubeGeometry(stemCurve, 12, 0.0014, 6, false);
  parts.push(stem);

  // 10 pairs of opposing slender rosemary needles fanning along the curved twig
  for (let i = 1; i <= 10; i++) {
    const t = i / 11;
    const pt = stemCurve.getPointAt(t);
    const scaleLen = 0.0135 * (1.0 - 0.35 * t);
    for (const side of [-1, 1]) {
      const needle = new THREE.ConeGeometry(0.0016, scaleLen, 5, 1);
      needle.scale(1.0, 1.0, 0.45);
      needle.translate(0, scaleLen * 0.5, 0);
      needle.rotateZ(-Math.PI * 0.28);
      needle.rotateY(side * (0.68 + (i % 2) * 0.25));
      needle.rotateX(side * 0.22);
      needle.translate(pt.x, pt.y, pt.z);
      parts.push(needle);
    }
  }

  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

/**
 * Micro-dimpled golden pollen cushion dome for chamomile daisies (20x10 smooth hemisphere)
 */
function createPollenDiscGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.0088, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.62);
  g.scale(1.0, 0.58, 1.0);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const dimple = Math.sin(x * 820) * Math.cos(z * 820) * 0.00045;
    pos.setY(i, y + dimple);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

function mergeSplitLayerGeometries(parts: SplitLayerGeometries[]): SplitLayerGeometries {
  const fullGeo = ensureSecondaryUvAttribute(mergeGeometries(parts.map((p) => p.fullGeo), false)!);
  const mainWallGeo = ensureSecondaryUvAttribute(mergeGeometries(parts.map((p) => p.mainWallGeo), false)!);
  const mainCapsGeo = ensureSecondaryUvAttribute(mergeGeometries(parts.map((p) => p.mainCapsGeo), false)!);
  const sliceWallGeo = ensureSecondaryUvAttribute(mergeGeometries(parts.map((p) => p.sliceWallGeo), false)!);
  const sliceCapsGeo = ensureSecondaryUvAttribute(mergeGeometries(parts.map((p) => p.sliceCapsGeo), false)!);
  for (const p of parts) {
    p.fullGeo.dispose();
    p.mainWallGeo.dispose();
    p.mainCapsGeo.dispose();
    p.sliceWallGeo.dispose();
    p.sliceCapsGeo.dispose();
  }
  return { fullGeo, mainWallGeo, mainCapsGeo, sliceWallGeo, sliceCapsGeo };
}

function evalChantillySwirlY(r: number, theta: number): number {
  // 饱满实心圆顶帽穹顶高度 + 柔和顺滑抹刀旋纹（切口处平滑收边，彻底消除锯齿波浪与空心薄环感！）
  const rNorm = Math.min(1.0, r / 0.422);
  const domeLift = (1.0 - rNorm * rNorm) * 0.0115;
  // 在 theta=0 与 theta=PI/2 的 1/4 切口边缘柔和收敛波纹振幅，确保切面干净平滑
  const cutEdgeDist = Math.min(
    Math.abs(Math.sin(theta)),
    Math.abs(Math.cos(theta))
  );
  const cutSmooth = smoothstep(0.0, 0.16, cutEdgeDist);
  const ridgeEnv = smoothstep(0.025, 0.10, r) * (1.0 - smoothstep(0.34, 0.412, r)) * cutSmooth;
  const spiral = Math.sin(r * 38.0 - theta * 1.0);
  const centerTuft = Math.exp(-r * r * 920) * 0.0052;
  return 0.336 + domeLift + spiral * 0.0034 * ridgeEnv + centerTuft;
}

function applyVertexColorTint(geo: THREE.BufferGeometry, r: number, g: number, b: number): THREE.BufferGeometry {
  const count = geo.attributes.position.count;
  const cols = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    cols[i * 3] = r;
    cols[i * 3 + 1] = g;
    cols[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  return geo;
}

const CHANTILLY_DRIP_SPECS: Array<{ theta: number; len: number; width: number; bulge: number }> = [
  // 5 asymmetrical sculptural mirror drips on 1/4 slice sector [0.14 .. PI/2 - 0.14]
  { theta: 0.19, len: 0.135, width: 0.019, bulge: 0.0088 },
  { theta: 0.46, len: 0.072, width: 0.015, bulge: 0.0072 },
  { theta: 0.76, len: 0.195, width: 0.022, bulge: 0.0102 },
  { theta: 1.08, len: 0.098, width: 0.016, bulge: 0.0076 },
  { theta: 1.38, len: 0.158, width: 0.020, bulge: 0.0094 },
  // 17 asymmetrical long glaze waterfall drips on 3/4 main sector
  { theta: 1.78, len: 0.188, width: 0.021, bulge: 0.0098 },
  { theta: 2.06, len: 0.082, width: 0.015, bulge: 0.0074 },
  { theta: 2.34, len: 0.215, width: 0.023, bulge: 0.0108 },
  { theta: 2.64, len: 0.104, width: 0.017, bulge: 0.0078 },
  { theta: 2.94, len: 0.168, width: 0.020, bulge: 0.0095 },
  { theta: 3.22, len: 0.074, width: 0.015, bulge: 0.0072 },
  { theta: 3.52, len: 0.204, width: 0.022, bulge: 0.0104 },
  { theta: 3.82, len: 0.112, width: 0.017, bulge: 0.0080 },
  { theta: 4.10, len: 0.172, width: 0.020, bulge: 0.0094 },
  { theta: 4.38, len: 0.078, width: 0.015, bulge: 0.0072 },
  { theta: 4.68, len: 0.208, width: 0.023, bulge: 0.0106 },
  { theta: 4.96, len: 0.118, width: 0.018, bulge: 0.0084 },
  { theta: 5.22, len: 0.154, width: 0.019, bulge: 0.0090 },
  { theta: 5.48, len: 0.070, width: 0.015, bulge: 0.0070 },
  { theta: 5.74, len: 0.186, width: 0.021, bulge: 0.0098 },
  { theta: 5.96, len: 0.094, width: 0.016, bulge: 0.0076 },
  { theta: 6.14, len: 0.146, width: 0.019, bulge: 0.0088 },
];

function buildChantillyDripsForSector(minTheta: number, maxTheta: number): THREE.BufferGeometry {
  const baseR = 0.4455;
  const yStart = 0.319;
  const segV = 14;
  const segU = 10;
  const parts: THREE.BufferGeometry[] = [];

  for (const d of CHANTILLY_DRIP_SPECS) {
    if (d.theta < minTheta || d.theta > maxTheta) continue;
    const sinT = Math.sin(d.theta);
    const cosT = Math.cos(d.theta);
    const tx = cosT;
    const tz = -sinT;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let iv = 0; iv <= segV; iv++) {
      const v = iv / segV; // 0 = 顶盖融肩, 1 = 饱满圆润奶滴挂珠底端
      const y = yStart - v * d.len;
      // 上宽融肩 -> 中段柔细收腰 -> 下端圆润挂珠水滴（彻底告别僵硬圆柱白条！）
      const shoulderFlare = 1.0 + 0.42 * Math.exp(-Math.pow(v / 0.14, 2.0));
      const neckPinch = 1.0 - 0.44 * Math.sin(Math.min(1.0, v * 1.18) * Math.PI);
      const dropSwell = 1.0 + 0.58 * Math.exp(-Math.pow((v - 0.85) / 0.13, 2.0));
      const tipTaper = v > 0.87 ? Math.max(0.04, Math.cos(((v - 0.87) / 0.13) * (Math.PI * 0.5))) : 1.0;
      const halfW = d.width * 0.88 * shoulderFlare * neckPinch * dropSwell * tipTaper;
      const bulgeOut = d.bulge * (0.42 + 0.72 * dropSwell) * tipTaper;

      for (let iu = 0; iu <= segU; iu++) {
        const u = iu / segU; // 0..1 across width [-PI/2 .. +PI/2]
        const phi = -Math.PI * 0.5 + u * Math.PI;
        const sideOffset = Math.sin(phi) * halfW;
        const radOut = baseR - 0.001 + Math.cos(phi) * bulgeOut;
        const px = sinT * radOut + tx * sideOffset;
        const pz = cosT * radOut + tz * sideOffset;
        positions.push(px, y, pz);
        uvs.push(u, 1.0 - v);
      }
    }

    const row = segU + 1;
    for (let iv = 0; iv < segV; iv++) {
      for (let iu = 0; iu < segU; iu++) {
        const a = iv * row + iu;
        const b = (iv + 1) * row + iu;
        const c = (iv + 1) * row + (iu + 1);
        const dIdx = iv * row + (iu + 1);
        indices.push(a, b, dIdx, b, c, dIdx);
      }
    }

    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    dg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    dg.setIndex(indices);
    dg.computeVertexNormals();
    parts.push(dg);
  }

  const merged = ensureSecondaryUvAttribute(mergeGeometries(parts, false)!);
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

function buildSwirledChantillyCrownSplit(fullSegs = 120): SplitLayerGeometries {
  // 有厚度的实心圆顶奶油帽轮廓（y = 0.308 .. 0.348，告别薄片空心环！）
  const baseProfile: Array<[number, number]> = [
    [0.0, 0.308],
    [0.20, 0.308],
    [0.436, 0.308],
    [0.448, 0.313],
    [0.453, 0.322],
    [0.449, 0.331],
    [0.437, 0.336],
    [0.422, 0.336],
  ];
  const topStartIdx = baseProfile.length;
  const topSteps = 26;
  for (let s = 1; s <= topSteps; s++) {
    const r = 0.422 * (1.0 - s / topSteps);
    baseProfile.push([r <= 1e-6 ? 0.0 : r, 0.336]);
  }

  const buildSeg = (thetaStart: number, thetaLength: number, segs: number, weld: boolean) => {
    const g = buildRevolvedWall(baseProfile, thetaStart, thetaLength, segs, weld, 0.330, undefined, true);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const nRing = baseProfile.length;

    for (let i = 0; i <= segs; i++) {
      const phi = thetaStart + (i / segs) * thetaLength;
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);
      for (let j = topStartIdx; j < nRing; j++) {
        const idx = i * nRing + j;
        const r = baseProfile[j][0];
        const ySwirl = evalChantillySwirlY(r, phi);
        pos.setXYZ(idx, r * sinP, ySwirl, r * cosP);
        uv.setXY(idx, 0.5 + (r * sinP) / (2 * 0.452), 0.5 + (r * cosP) / (2 * 0.452));
      }
    }
    g.computeVertexNormals();
    const norm = g.attributes.normal as THREE.BufferAttribute;
    if (weld) {
      for (let j = 0; j < nRing; j++) {
        const i0 = j;
        const iEnd = segs * nRing + j;
        pos.setXYZ(iEnd, pos.getX(i0), pos.getY(i0), pos.getZ(i0));
        const nx = (norm.getX(i0) + norm.getX(iEnd)) * 0.5;
        const ny = (norm.getY(i0) + norm.getY(iEnd)) * 0.5;
        const nz = (norm.getZ(i0) + norm.getZ(iEnd)) * 0.5;
        const len = Math.hypot(nx, ny, nz) || 1;
        norm.setXYZ(i0, nx / len, ny / len, nz / len);
        norm.setXYZ(iEnd, nx / len, ny / len, nz / len);
      }
    }
    for (let i = 0; i <= segs; i++) {
      norm.setXYZ(i * nRing, 0, -1, 0);
      norm.setXYZ(i * nRing + nRing - 1, 0, 1, 0);
    }
    pos.needsUpdate = true;
    norm.needsUpdate = true;
    uv.needsUpdate = true;
    return ensureSecondaryUvAttribute(g);
  };

  const buildCutCapSwirl = (theta: number, flip: boolean) => {
    const cutPts: Array<[number, number]> = baseProfile.map(([r, y], j) =>
      j >= topStartIdx ? [r, evalChantillySwirlY(r, theta)] : [r, y]
    );
    return buildPlanarCutCap(cutPts, theta, flip);
  };

  const qSegs = Math.max(24, Math.round(fullSegs * 0.25));
  const mSegs = Math.max(64, fullSegs - qSegs);

  const rawFull = applyVertexColorTint(buildSeg(0, Math.PI * 2, fullSegs, true), 1.0, 1.0, 1.0);
  const dripsAll = applyVertexColorTint(buildChantillyDripsForSector(0, Math.PI * 2), 0.974, 0.863, 0.672);
  const fullGeo = ensureSecondaryUvAttribute(mergeGeometries([rawFull, dripsAll], false)!);
  rawFull.dispose();
  dripsAll.dispose();

  const rawSlice = applyVertexColorTint(buildSeg(0, Math.PI * 0.5, qSegs, false), 1.0, 1.0, 1.0);
  const dripsSlice = applyVertexColorTint(buildChantillyDripsForSector(0, Math.PI * 0.5), 0.974, 0.863, 0.672);
  const sliceWallGeo = ensureSecondaryUvAttribute(mergeGeometries([rawSlice, dripsSlice], false)!);
  rawSlice.dispose();
  dripsSlice.dispose();

  const rawMain = applyVertexColorTint(buildSeg(Math.PI * 0.5, Math.PI * 1.5, mSegs, false), 1.0, 1.0, 1.0);
  const dripsMain = applyVertexColorTint(buildChantillyDripsForSector(Math.PI * 0.5, Math.PI * 2), 0.974, 0.863, 0.672);
  const mainWallGeo = ensureSecondaryUvAttribute(mergeGeometries([rawMain, dripsMain], false)!);
  rawMain.dispose();
  dripsMain.dispose();

  const sCap0 = applyVertexColorTint(buildCutCapSwirl(0, false), 1.0, 1.0, 1.0);
  const sCap90 = applyVertexColorTint(buildCutCapSwirl(Math.PI * 0.5, true), 1.0, 1.0, 1.0);
  const sliceCapsGeo = ensureSecondaryUvAttribute(mergeGeometries([sCap0, sCap90], false)!);
  sCap0.dispose();
  sCap90.dispose();

  const mCap90 = applyVertexColorTint(buildCutCapSwirl(Math.PI * 0.5, false), 1.0, 1.0, 1.0);
  const mCap360 = applyVertexColorTint(buildCutCapSwirl(Math.PI * 2.0, true), 1.0, 1.0, 1.0);
  const mainCapsGeo = ensureSecondaryUvAttribute(mergeGeometries([mCap90, mCap360], false)!);
  mCap90.dispose();
  mCap360.dispose();

  return { fullGeo, mainWallGeo, mainCapsGeo, sliceWallGeo, sliceCapsGeo };
}

function buildSemiNakedCoatWall(thetaStart: number, thetaLength: number, segs: number, weld: boolean): THREE.BufferGeometry {
  const r = 0.4465;
  const yMin = 0.004;
  const yMax = 0.3065;
  const hSegs = 24;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let is = 0; is <= segs; is++) {
    const phi = thetaStart + (is / segs) * thetaLength;
    const sinP = Math.sin(phi);
    const cosP = Math.cos(phi);
    const u = phi / (Math.PI * 2);
    for (let ih = 0; ih <= hSegs; ih++) {
      const v = ih / hSegs;
      const y = yMin + v * (yMax - yMin);
      positions.push(r * sinP, y, r * cosP);
      uvs.push(u, v);
    }
  }

  const row = hSegs + 1;
  for (let is = 0; is < segs; is++) {
    for (let ih = 0; ih < hSegs; ih++) {
      const a = is * row + ih;
      const b = a + 1;
      const c = (is + 1) * row + ih + 1;
      const d = (is + 1) * row + ih;
      indices.push(a, d, b, b, d, c);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  if (weld) {
    const pos = g.attributes.position as THREE.BufferAttribute;
    const norm = g.attributes.normal as THREE.BufferAttribute;
    for (let ih = 0; ih < row; ih++) {
      const i0 = ih;
      const iEnd = segs * row + ih;
      pos.setXYZ(iEnd, pos.getX(i0), pos.getY(i0), pos.getZ(i0));
      const nx = (norm.getX(i0) + norm.getX(iEnd)) * 0.5;
      const ny = (norm.getY(i0) + norm.getY(iEnd)) * 0.5;
      const nz = (norm.getZ(i0) + norm.getZ(iEnd)) * 0.5;
      const len = Math.hypot(nx, ny, nz) || 1;
      norm.setXYZ(i0, nx / len, ny / len, nz / len);
      norm.setXYZ(iEnd, nx / len, ny / len, nz / len);
    }
    pos.needsUpdate = true;
    norm.needsUpdate = true;
  }
  return ensureSecondaryUvAttribute(g);
}

let cachedGeometries: HeroEntremetGeometries | null = null;

/**
 * Builds and caches all 8 non-overlapping French Semi-Naked Chiffon Cake structural geometries.
 */
/**
 * 商业影视级 8 层异形补充几何生成器：
 * 1. 法式星形挤花嘴玫瑰花结 (Piped Rosette Swirl) -> Layer 03 香缇花边冠
 * 2. 焦糖芯 360° 悬浮粘稠瀑布拉丝裙 (Caramel Cascade Drip Skirt) -> Layer 05 爆炸流体细节
 * 3. 鲜切不规则果肉块 (Fruit Chunk) -> Layer 04 草莓果胶宝石嵌粒
 * 4. 烘烤杏仁碎脆片 (Crunch Almond Shard) -> Layer 07 黄油脆底颗粒质感
 */
function createPipedRosetteGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.036, 18, 12);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const ang = Math.atan2(z, x);
    // 10 瓣星嘴旋转螺旋褶皱 + 上尖下圆水滴感
    const yNorm = (y + 0.036) / 0.072;
    const starFlute = 1.0 + 0.22 * Math.sin(ang * 10.0 + yNorm * 4.8);
    const taper = y > 0 ? Math.max(0.18, 1.0 - Math.pow(yNorm, 1.7) * 0.68) : 1.05;
    pos.setXYZ(i, x * starFlute * taper * 1.12, y * 0.85 + Math.pow(yNorm, 2.0) * 0.014, z * starFlute * taper * 1.12);
    if (r < 0.005 && y > 0.02) {
      pos.setY(i, y + 0.010);
    }
  }
  geo.computeVertexNormals();
  return ensureSecondaryUvAttribute(geo);
}

function createCaramelCascadeSkirtGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const dripCount = 16;
  for (let i = 0; i < dripCount; i++) {
    const ang = (i / dripCount) * Math.PI * 2 + (i % 2) * 0.14;
    const len = 0.042 + (i % 3) * 0.024 + (i % 5) * 0.008;
    const rRadius = 0.011 + (i % 2) * 0.004;
    // 细长粘稠焦糖悬滴条
    const strand = new THREE.CylinderGeometry(rRadius * 0.95, rRadius * 0.35, len, 10, 6);
    strand.translate(Math.sin(ang) * 0.338, 0.098 - len * 0.5, Math.cos(ang) * 0.338);
    parts.push(strand);
    // 底部挂着的圆润琥珀泪滴珠
    const drop = new THREE.SphereGeometry(rRadius * 1.18, 10, 8);
    drop.scale(0.95, 1.35, 0.95);
    drop.translate(Math.sin(ang) * 0.338, 0.098 - len - rRadius * 0.5, Math.cos(ang) * 0.338);
    parts.push(drop);
  }
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return ensureSecondaryUvAttribute(merged);
}

function createFruitChunkGeometry(): THREE.BufferGeometry {
  const geo = new THREE.DodecahedronGeometry(0.022, 1);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const jitter = 0.85 + 0.30 * Math.abs(Math.sin(x * 95.0 + y * 60.0 - z * 75.0));
    pos.setXYZ(i, x * jitter * 1.25, y * jitter * 0.65, z * jitter);
  }
  geo.computeVertexNormals();
  return ensureSecondaryUvAttribute(geo);
}

function createCrunchAlmondShardGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(0.028, 0.007, 0.018, 2, 1, 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const arch = Math.sin((x / 0.014) * Math.PI * 0.5) * 0.0025;
    pos.setXYZ(i, x, y + arch, z * (0.85 + 0.25 * Math.cos(x * 80.0)));
  }
  geo.computeVertexNormals();
  return ensureSecondaryUvAttribute(geo);
}

/**
 * 1/8 放射状杏仁焦糖碎瓦片扇块：爆炸态下 8 块放射炸裂并微翘，彻底告别平直圆饼脆底！
 */
function createCrunchWedgeGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const rIn = 0.04;
  const rOut = 0.445;
  const halfAng = Math.PI / 8 - 0.035;
  shape.moveTo(Math.sin(-halfAng) * rIn, Math.cos(-halfAng) * rIn);
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const a = -halfAng + (i / steps) * (halfAng * 2);
    const jagged = 1.0 + Math.sin(i * 2.4) * 0.042;
    shape.lineTo(Math.sin(a) * rOut * jagged, Math.cos(a) * rOut * jagged);
  }
  shape.lineTo(Math.sin(halfAng) * rIn, Math.cos(halfAng) * rIn);
  shape.closePath();

  const extrude = new THREE.ExtrudeGeometry(shape, {
    depth: 0.026,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
  });
  extrude.rotateX(-Math.PI / 2);
  extrude.computeVertexNormals();
  return ensureSecondaryUvAttribute(extrude);
}

/**
 * 360° 悬浮飞溅琥珀焦糖液滴水珠环（让 05 流心芯呈现出液态飞溅爆裂的动态定格感）
 */
function createCaramelSplashRingGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const count = 14;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + (i % 3) * 0.18;
    const rad = 0.375 + (i % 3) * 0.048;
    const yOff = 0.118 + (i % 4) * 0.022;
    const sz = 0.015 + (i % 3) * 0.006;
    const drop = new THREE.SphereGeometry(sz, 10, 8);
    drop.scale(0.85, 1.45, 0.85);
    drop.rotateZ(Math.cos(ang) * 0.45);
    drop.rotateX(-Math.sin(ang) * 0.45);
    drop.translate(Math.sin(ang) * rad, yOff, Math.cos(ang) * rad);
    parts.push(drop);
  }
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return ensureSecondaryUvAttribute(merged);
}

export function getHeroEntremetGeometries(): HeroEntremetGeometries {
  if (cachedGeometries) return cachedGeometries;

  // Layer 7: 粗犷杏仁黄油脆底（0.000 .. 0.027，严格不与上层底层海绵交叠避免切面 Z-fighting）
  const crunchSpec: LayerCutSpec = {
    kind: 'crunch',
    yMin: 0.0,
    yMax: 0.027,
    rMax: 0.445,
    heightSegs: 12,
    radialSegs: 24,
    outerRadiusAtY: (y: number) => {
      if (y < 0.006) return 0.441 + (y / 0.006) * 0.004;
      if (y > 0.022) return 0.445 - ((y - 0.022) / 0.005) * 0.004;
      return 0.445;
    },
  };
  const crunchProfile = buildSubdividedLayerProfile(crunchSpec);

  // Layer 6: 彻底打破三层一模一样克隆！三层坯体在半径、厚度与截面廓形上完全分化，层间留 1.5mm 洁净间隙消除 Z-fighting
  const makeCustomSpongeTier = (
    yMin: number,
    yMax: number,
    rMax: number,
    outerRadiusAtY: (y: number) => number
  ) => {
    const spec: LayerCutSpec = {
      kind: 'sponge',
      yMin,
      yMax,
      rMax,
      heightSegs: 12,
      radialSegs: 24,
      outerRadiusAtY,
    };
    const profile = buildSubdividedLayerProfile(spec);
    return buildSplitLayerGeometry(profile, 96, undefined, spec, true);
  };
  const spongeBottom = makeCustomSpongeTier(0.0285, 0.094, 0.444, (y) => {
    const t = (y - 0.0285) / 0.0655;
    return 0.438 + Math.sin(t * Math.PI) * 0.006;
  });
  // 中层彻底改造为【真·中空镂空花环】，内径 0.215、外径 0.398，一眼看穿内部流心与草莓！
  const midHollowRingProfile: Array<[number, number]> = [
    [0.215, 0.133],
    [0.396, 0.133],
    [0.402, 0.164],
    [0.396, 0.195],
    [0.215, 0.195],
    [0.208, 0.164],
  ];
  const spongeMid = buildSplitLayerGeometry(midHollowRingProfile, 96, undefined, undefined, true);
  const spongeTop = makeCustomSpongeTier(0.239, 0.291, 0.422, (y) => {
    const t = (y - 0.239) / 0.052;
    return t > 0.65 ? 0.422 - ((t - 0.65) / 0.35) * 0.014 : 0.422;
  });
  const sponge = spongeMid;

  // Layer 5: 琥珀蜂蜜焦糖软流心芯（0.096 .. 0.131，rMax 0.338 严格退让外侧奶油环 2mm 绝不交叠）
  const caramelSpec: LayerCutSpec = {
    kind: 'caramel',
    yMin: 0.096,
    yMax: 0.131,
    rMax: 0.338,
    heightSegs: 12,
    radialSegs: 22,
    outerRadiusAtY: (y: number) => {
      const t = (y - 0.096) / 0.035;
      return 0.332 + Math.sin(t * Math.PI) * 0.006;
    },
  };
  const caramelProfile = buildSubdividedLayerProfile(caramelSpec);

  // Layer 4: 鲜切草莓宝石果胶浮岛（0.197 .. 0.237，rMax 0.374 严格退让外侧奶油环绝不穿模闪烁）
  const jellySpec: LayerCutSpec = {
    kind: 'jelly',
    yMin: 0.197,
    yMax: 0.237,
    rMax: 0.374,
    heightSegs: 12,
    radialSegs: 22,
    outerRadiusAtY: (y: number) => {
      const t = (y - 0.197) / 0.040;
      return 0.365 + Math.sin(t * Math.PI) * 0.009;
    },
  };
  const jellyProfile = buildSubdividedLayerProfile(jellySpec);

  // Layer 3: Whipped Vanilla Chantilly Filling Rings + Top Cushion Bed (strictly non-overlapping!)
  const lowerCreamRingProfile: Array<[number, number]> = [
    [0.340, 0.096],
    [0.440, 0.096],
    [0.440, 0.131],
    [0.340, 0.131],
  ];
  const upperCreamRingProfile: Array<[number, number]> = [
    [0.376, 0.197],
    [0.440, 0.197],
    [0.440, 0.237],
    [0.376, 0.237],
  ];
  const topCreamBedProfile: Array<[number, number]> = [
    [0.0, 0.293],
    [0.22, 0.293],
    [0.441, 0.293],
    [0.441, 0.3065],
    [0.22, 0.3065],
    [0.0, 0.3065],
  ];
  // 独立拆分为下/中奶油外环（爆炸时伴随对应夹心悬浮）与上层饱满香缇奶油垫层！
  const mousseLowerRing = buildSplitLayerGeometry(lowerCreamRingProfile, 96, undefined, undefined, true);
  const mousseUpperRing = buildSplitLayerGeometry(upperCreamRingProfile, 96, undefined, undefined, true);
  const mousseTopBed = buildSplitLayerGeometry(topCreamBedProfile, 96, 0.320, undefined, true);
  const mousse = mousseTopBed;

  const glaze = buildSwirledChantillyCrownSplit(120);
  const semiNakedFullGeo = buildSemiNakedCoatWall(0, Math.PI * 2, 96, true);
  const semiNakedMainGeo = buildSemiNakedCoatWall(Math.PI * 0.5, Math.PI * 1.5, 72, false);
  const semiNakedSliceGeo = buildSemiNakedCoatWall(0, Math.PI * 0.5, 24, false);

  const { pedestalMarbleGeo, pedestalGoldGeo } = buildMarblePedestalGeometries();
  const { berryGeo: halfStrawberryOuterGeo, cutFaceGeo: halfStrawberryCutGeo } = createHalfStrawberryGeometry();
  const { shellsGeo: macaronShellsGeo, fillingGeo: macaronFillingGeo } = createFrenchMacaronGeometry();

  cachedGeometries = {
    crunch: buildSplitLayerGeometry(crunchProfile, 96, undefined, crunchSpec, true),
    sponge,
    spongeBottom,
    spongeMid,
    spongeTop,
    caramel: buildSplitLayerGeometry(caramelProfile, 96, undefined, caramelSpec, true),
    jelly: buildSplitLayerGeometry(jellyProfile, 96, undefined, jellySpec, true),
    mousse,
    mousseLowerRing,
    mousseUpperRing,
    mousseTopBed,
    glaze,
    semiNakedFullGeo,
    semiNakedMainGeo,
    semiNakedSliceGeo,
    pedestalMarbleGeo,
    pedestalGoldGeo,
    caramelMainRibbonsGeo: createAsymmetricCaramelRibbonsGeometry(true),
    caramelSliceRibbonsGeo: createAsymmetricCaramelRibbonsGeometry(false),
    caramelMainDropsGeo: createAsymmetricCaramelDropsGeometry(true),
    caramelSliceDropsGeo: createAsymmetricCaramelDropsGeometry(false),
    wholeStrawberryGeo: createWholeStrawberryGeometry(),
    strawberryCalyxGeo: createStrawberryCalyxGeometry(),
    halfStrawberryOuterGeo,
    halfStrawberryCutGeo,
    blueberryGeo: createBlueberryGeometry(),
    macaronShellsGeo,
    macaronFillingGeo,
    whiteChocShavingGeo: createWhiteChocShavingGeometry(),
    icingSugarClusterGeo: createIcingSugarClusterGeometry(),
    saintHonoreBorderGeo: createSaintHonoreBorderGeometry(),
    goldFlakeGeo: createGoldLeafFlakeGeometry(1.15),
    crownGoldGeo: createGoldLeafFlakeGeometry(1.80),
    chantillyPearlGeo: createChantillyQuenelleGeometry(),
    mintLeafGeo: createSculptedMintLeafGeometry(),
    chamomilePetalGeo: createChamomilePetalGeometry(),
    gardenRoseHeadGeo: createGardenRoseHeadGeometry(),
    rosemarySprigGeo: createRosemarySprigGeometry(),
    pollenDiscGeo: createPollenDiscGeometry(),
    pipedRosetteGeo: createPipedRosetteGeometry(),
    caramelCascadeSkirtGeo: createCaramelCascadeSkirtGeometry(),
    fruitChunkGeo: createFruitChunkGeometry(),
    crunchShardGeo: createCrunchAlmondShardGeometry(),
    crunchWedgeGeo: createCrunchWedgeGeometry(),
    caramelSplashRingGeo: createCaramelSplashRingGeometry(),
  };

  return cachedGeometries;
}

export function disposeHeroEntremetGeometries(): void {
  if (!cachedGeometries) return;
  const disposeSplit = (s: SplitLayerGeometries) => {
    s.fullGeo.dispose();
    s.mainWallGeo.dispose();
    s.mainCapsGeo.dispose();
    s.sliceWallGeo.dispose();
    s.sliceCapsGeo.dispose();
  };
  disposeSplit(cachedGeometries.crunch);
  disposeSplit(cachedGeometries.spongeBottom);
  disposeSplit(cachedGeometries.spongeMid);
  disposeSplit(cachedGeometries.spongeTop);
  disposeSplit(cachedGeometries.caramel);
  disposeSplit(cachedGeometries.jelly);
  disposeSplit(cachedGeometries.mousseLowerRing);
  disposeSplit(cachedGeometries.mousseUpperRing);
  disposeSplit(cachedGeometries.mousseTopBed);
  disposeSplit(cachedGeometries.glaze);
  cachedGeometries.semiNakedFullGeo.dispose();
  cachedGeometries.semiNakedMainGeo.dispose();
  cachedGeometries.semiNakedSliceGeo.dispose();
  cachedGeometries.pedestalMarbleGeo.dispose();
  cachedGeometries.pedestalGoldGeo.dispose();
  cachedGeometries.caramelMainRibbonsGeo.dispose();
  cachedGeometries.caramelSliceRibbonsGeo.dispose();
  cachedGeometries.caramelMainDropsGeo.dispose();
  cachedGeometries.caramelSliceDropsGeo.dispose();
  cachedGeometries.wholeStrawberryGeo.dispose();
  cachedGeometries.strawberryCalyxGeo.dispose();
  cachedGeometries.halfStrawberryOuterGeo.dispose();
  cachedGeometries.halfStrawberryCutGeo.dispose();
  cachedGeometries.blueberryGeo.dispose();
  cachedGeometries.macaronShellsGeo.dispose();
  cachedGeometries.macaronFillingGeo.dispose();
  cachedGeometries.whiteChocShavingGeo.dispose();
  cachedGeometries.icingSugarClusterGeo.dispose();
  cachedGeometries.saintHonoreBorderGeo.dispose();
  cachedGeometries.goldFlakeGeo.dispose();
  cachedGeometries.crownGoldGeo.dispose();
  cachedGeometries.chantillyPearlGeo.dispose();
  cachedGeometries.mintLeafGeo.dispose();
  cachedGeometries.chamomilePetalGeo.dispose();
  cachedGeometries.gardenRoseHeadGeo.dispose();
  cachedGeometries.rosemarySprigGeo.dispose();
  cachedGeometries.pollenDiscGeo.dispose();
  cachedGeometries.pipedRosetteGeo.dispose();
  cachedGeometries.caramelCascadeSkirtGeo.dispose();
  cachedGeometries.fruitChunkGeo.dispose();
  cachedGeometries.crunchShardGeo.dispose();
  cachedGeometries.crunchWedgeGeo.dispose();
  cachedGeometries.caramelSplashRingGeo.dispose();
  cachedGeometries = null;
}
