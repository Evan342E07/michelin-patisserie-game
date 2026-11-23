import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface SplitLayerGeometries {
  fullGeo: THREE.BufferGeometry;
  mainWallGeo: THREE.BufferGeometry;
  mainCapsGeo: THREE.BufferGeometry;
  sliceWallGeo: THREE.BufferGeometry;
  sliceCapsGeo: THREE.BufferGeometry;
}



/**
 * Welds the phi=0 and phi=2PI seam column vertex normals on any full-circle LatheGeometry
 * so zero vertical shading crease ever appears on bowls, pots, cups, jars, platters, or vases.
 */
export function weldLatheSeamNormals(
  geo: THREE.BufferGeometry,
  profileLen: number,
  segments: number
): THREE.BufferGeometry {
  geo.computeVertexNormals();
  const norm = geo.attributes.normal;
  if (!norm || norm.count < (segments + 1) * profileLen) return geo;

  for (let j = 0; j < profileLen; j++) {
    const i0 = j;
    const iEnd = segments * profileLen + j;
    const nx = (norm.getX(i0) + norm.getX(iEnd)) * 0.5;
    const ny = (norm.getY(i0) + norm.getY(iEnd)) * 0.5;
    const nz = (norm.getZ(i0) + norm.getZ(iEnd)) * 0.5;
    const len = Math.hypot(nx, ny, nz) || 1;
    norm.setXYZ(i0, nx / len, ny / len, nz / len);
    norm.setXYZ(iEnd, nx / len, ny / len, nz / len);
  }
  norm.needsUpdate = true;
  return geo;
}

/**
 * Creates a 360-degree LatheGeometry with seam-welded normals (zero vertical seam lines!).
 */
export function createSeamlessLatheGeometry(
  pts: THREE.Vector2[],
  segments = 64
): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(pts, segments);
  return weldLatheSeamNormals(g, pts.length, segments);
}

/**
 * Normalizes indexed/non-indexed & attribute sets across parts, merges them cleanly,
 * and disposes every intermediate BufferGeometry so zero temporary buffers leak.
 */
function mergePartsSafely(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (parts.length === 0) {
    throw new Error('mergePartsSafely requires at least one BufferGeometry');
  }

  const anyNonIndexed = parts.some((g) => g.index === null);
  const normalized: THREE.BufferGeometry[] = [];

  try {
    for (const part of parts) {
      let g = part;
      if (anyNonIndexed && g.index !== null) {
        g = part.toNonIndexed();
        part.dispose();
      }
      if (!g.getAttribute('normal')) {
        g.computeVertexNormals();
      }
      normalized.push(g);
    }

    const commonAttrs = Object.keys(normalized[0].attributes).filter((key) =>
      normalized.every((g) => Boolean(g.getAttribute(key)))
    );
    for (const g of normalized) {
      for (const key of Object.keys(g.attributes)) {
        if (!commonAttrs.includes(key)) {
          g.deleteAttribute(key);
        }
      }
    }

    const merged = mergeGeometries(normalized, false);
    if (!merged) {
      throw new Error('mergeGeometries returned null after attribute normalization');
    }
    return merged;
  } finally {
    const uniqueParts = new Set<THREE.BufferGeometry>([...parts, ...normalized]);
    uniqueParts.forEach((g) => g.dispose());
  }
}

/**
 * Builds a revolved surface along [thetaStart, thetaStart + thetaLength] from a closed 2D profile.
 * Splits consecutive profile edges so sharp architectural cross-section corners stay crisp while
 * rounded dome curves remain silky smooth!
 */
function buildRevolvedWall(
  profile: Array<[number, number]>,
  thetaStart: number,
  thetaLength: number,
  radialSegs: number,
  weldFullCircle: boolean
): THREE.BufferGeometry {
  const pts = profile.map(([x, y]) => new THREE.Vector2(Math.max(0.0001, x), y));
  // Ensure closed loop
  if (pts[0].distanceTo(pts[pts.length - 1]) > 1e-5) {
    pts.push(pts[0].clone());
  }

  const g = new THREE.LatheGeometry(pts, radialSegs, thetaStart, thetaLength);
  if (weldFullCircle) {
    // Weld theta=0 and theta=2PI seam normals for 100% seamless mirror glaze reflection!
    g.computeVertexNormals();
    const pos = g.attributes.position;
    const norm = g.attributes.normal;
    const nRing = pts.length;
    for (let j = 0; j < nRing; j++) {
      const i0 = j;
      const iEnd = radialSegs * nRing + j;
      if (iEnd < pos.count) {
        const nx = (norm.getX(i0) + norm.getX(iEnd)) * 0.5;
        const ny = (norm.getY(i0) + norm.getY(iEnd)) * 0.5;
        const nz = (norm.getZ(i0) + norm.getZ(iEnd)) * 0.5;
        const len = Math.hypot(nx, ny, nz) || 1;
        norm.setXYZ(i0, nx / len, ny / len, nz / len);
        norm.setXYZ(iEnd, nx / len, ny / len, nz / len);
      }
    }
    norm.needsUpdate = true;
  } else {
    g.computeVertexNormals();
  }
  return g;
}

/**
 * Triangulates a 2D polygon [(r, y), ...] onto a vertical radial cut plane at angle `theta`
 * (using Three.js LatheGeometry convention: x = r * sin(theta), y = y, z = r * cos(theta)).
 * Produces razor-flat normals and distortion-free planar (r, y) UVs for porous sponge & crunch maps!
 */
function buildPlanarCutCap(
  profile: Array<[number, number]>,
  theta: number,
  flipNormal: boolean
): THREE.BufferGeometry {
  const contour = profile.map(([r, y]) => new THREE.Vector2(r, y));
  // Ensure consistent CCW winding in 2D before ShapeUtils.triangulateShape
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

  // Tangent er = (sinT, 0, cosT), ey = (0, 1, 0) -> er x ey = (-cosT, 0, sinT)
  const sign = flipNormal ? -1 : 1;
  const nx = -cosT * sign;
  const ny = 0;
  const nz = sinT * sign;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  for (const tri of faces) {
    const idxOrder = flipNormal ? [tri[0], tri[2], tri[1]] : [tri[0], tri[1], tri[2]];
    for (const vi of idxOrder) {
      const p = contour[vi];
      positions.push(p.x * sinT, p.y, p.x * cosT);
      normals.push(nx, ny, nz);
      uvs.push(p.x * 2.2, p.y * 2.2);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return g;
}

export function buildSplitCakeLayerGeometry(
  profile: Array<[number, number]>,
  fullSegs = 96
): SplitLayerGeometries {
  const quarterSegs = Math.max(20, Math.round(fullSegs * 0.25));
  const threeQuarterSegs = Math.max(56, fullSegs - quarterSegs);

  const fullGeo = buildRevolvedWall(profile, 0, Math.PI * 2, fullSegs, true);

  // 1/4 front-right wedge: theta in [0, PI/2]
  const sliceWallGeo = buildRevolvedWall(profile, 0, Math.PI * 0.5, quarterSegs, false);
  const sliceCap0 = buildPlanarCutCap(profile, 0, false);
  const sliceCap90 = buildPlanarCutCap(profile, Math.PI * 0.5, true);
  const sliceCapsGeo = mergePartsSafely([sliceCap0, sliceCap90]);

  // 3/4 main cake body: theta in [PI/2, 2*PI]
  const mainWallGeo = buildRevolvedWall(profile, Math.PI * 0.5, Math.PI * 1.5, threeQuarterSegs, false);
  const mainCap90 = buildPlanarCutCap(profile, Math.PI * 0.5, false);
  const mainCap360 = buildPlanarCutCap(profile, Math.PI * 2.0, true);
  const mainCapsGeo = mergePartsSafely([mainCap90, mainCap360]);

  return {
    fullGeo,
    mainWallGeo,
    mainCapsGeo,
    sliceWallGeo,
    sliceCapsGeo,
  };
}

/**
 * Generates all 7 structural rotational cake layer geometries (non-overlapping 2D profiles -> ZERO Z-fighting!)
 */
export function buildMasterEntremetGeometries() {
  // 01: Hazelnut Praline Feuilletine Crunch Base (y: 0.000 .. 0.042, r: 0 .. 0.432)
  const crunchProfile: Array<[number, number]> = [
    [0.0, 0.000],
    [0.428, 0.000],
    [0.432, 0.006],
    [0.432, 0.038],
    [0.426, 0.042],
    [0.0, 0.042],
  ];

  // 02: Sicilian Pistachio Joconde Sponge (y: 0.044 .. 0.112, r: 0 .. 0.402)
  const spongeProfile: Array<[number, number]> = [
    [0.0, 0.044],
    [0.402, 0.044],
    [0.402, 0.112],
    [0.0, 0.112],
  ];

  // 03: Valrhona 70% Guanaja Ganache Veil (y: 0.114 .. 0.146, r: 0 .. 0.388)
  const ganacheProfile: Array<[number, number]> = [
    [0.0, 0.114],
    [0.388, 0.114],
    [0.388, 0.146],
    [0.0, 0.146],
  ];

  // 04: Salted Butter Caramel Molten Core (y: 0.148 .. 0.206, r: 0 .. 0.305)
  const caramelProfile: Array<[number, number]> = [
    [0.0, 0.148],
    [0.298, 0.148],
    [0.305, 0.162],
    [0.305, 0.194],
    [0.296, 0.206],
    [0.0, 0.206],
  ];

  // 05: 103°C Ruby Raspberry Coulis Jelly Disc (y: 0.208 .. 0.268, r: 0 .. 0.365)
  const jellyProfile: Array<[number, number]> = [
    [0.0, 0.208],
    [0.358, 0.208],
    [0.365, 0.218],
    [0.365, 0.258],
    [0.356, 0.268],
    [0.0, 0.268],
  ];

  // 06: Bourbon Vanilla Mascarpone Mousse (Sculpted rounded crown + outer enveloping collar!)
  const mousseProfile: Array<[number, number]> = [
    [0.0, 0.270],
    [0.367, 0.270],
    [0.367, 0.207],
    [0.307, 0.207],
    [0.307, 0.147],
    [0.390, 0.147],
    [0.390, 0.113],
    [0.404, 0.113],
    [0.404, 0.044],
    [0.432, 0.044],
    [0.432, 0.285],
  ];
  // Smooth G2-like rounded upper pillow shoulder from (0.432, 0.285) -> (0.340, 0.368)
  const shoulderSegs = 10;
  for (let i = 1; i <= shoulderSegs; i++) {
    const a = (i / shoulderSegs) * (Math.PI * 0.5);
    const rx = 0.340 + Math.cos(a) * 0.092;
    const ry = 0.285 + Math.sin(a) * 0.083;
    mousseProfile.push([rx, ry]);
  }
  mousseProfile.push([0.0, 0.368]);

  // 07: 32°C Ruby Mirror Glaze Outer Shell (0.018 thick glossy dome & skirt!)
  const glazeProfile: Array<[number, number]> = [
    [0.0, 0.370],
  ];
  for (let i = shoulderSegs; i >= 0; i--) {
    const a = (i / shoulderSegs) * (Math.PI * 0.5);
    const rx = 0.340 + Math.cos(a) * 0.094;
    const ry = 0.285 + Math.sin(a) * 0.085;
    glazeProfile.push([rx, ry]);
  }
  glazeProfile.push([0.434, 0.004]);
  glazeProfile.push([0.454, 0.004]);
  glazeProfile.push([0.450, 0.025]);
  glazeProfile.push([0.450, 0.286]);
  for (let i = 0; i <= shoulderSegs; i++) {
    const a = (i / shoulderSegs) * (Math.PI * 0.5);
    const rx = 0.340 + Math.cos(a) * 0.110;
    const ry = 0.286 + Math.sin(a) * 0.102;
    glazeProfile.push([rx, ry]);
  }
  glazeProfile.push([0.0, 0.388]);

  return {
    crunch: buildSplitCakeLayerGeometry(crunchProfile),
    sponge: buildSplitCakeLayerGeometry(spongeProfile),
    ganache: buildSplitCakeLayerGeometry(ganacheProfile),
    caramel: buildSplitCakeLayerGeometry(caramelProfile),
    jelly: buildSplitCakeLayerGeometry(jellyProfile),
    mousse: buildSplitCakeLayerGeometry(mousseProfile),
    glaze: buildSplitCakeLayerGeometry(glazeProfile),
  };
}

/**
 * Viscous caramel ooze bead along a radial cut face (bulges outward & drips slightly when sliced!)
 */
export function createCaramelOozeBeadGeometry(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector3(0.03, 0.175, 0.0),
    new THREE.Vector3(0.10, 0.168, 0.012),
    new THREE.Vector3(0.18, 0.156, 0.022),
    new THREE.Vector3(0.25, 0.164, 0.015),
    new THREE.Vector3(0.29, 0.176, 0.002),
  ];
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, 24, 0.024, 12, false);
  g.scale(1, 1.15, 0.72);
  g.computeVertexNormals();
  return g;
}

/**
 * Compound Drupelet Raspberry Geometry (real cluster of 24 berry drupelets — NOT a crude sphere!)
 */
export function createDrupeletRaspberryGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const rings = [
    { y: 0.010, r: 0.022, count: 8, drupeR: 0.0095 },
    { y: 0.023, r: 0.020, count: 8, drupeR: 0.0092 },
    { y: 0.035, r: 0.014, count: 6, drupeR: 0.0085 },
    { y: 0.045, r: 0.006, count: 3, drupeR: 0.0078 },
  ];
  for (let ri = 0; ri < rings.length; ri++) {
    const ring = rings[ri];
    for (let i = 0; i < ring.count; i++) {
      const a = (i / ring.count) * Math.PI * 2 + ri * 0.4;
      const s = new THREE.SphereGeometry(ring.drupeR, 10, 8);
      s.scale(1.05, 0.92, 1.05);
      s.translate(Math.cos(a) * ring.r, ring.y, Math.sin(a) * ring.r);
      parts.push(s);
    }
  }
  const merged = mergePartsSafely(parts);
  merged.computeVertexNormals();
  return merged;
}

/**
 * French Tempered Dark-Chocolate Spiral Curl / Cigar Geometry (铲起的法式巧克力螺旋卷)
 * High-segment finite-thickness solid ribbon with split-normal rim bevels & end caps (zero polygon sawteeth).
 */
export function createChocolateCurlGeometry(): THREE.BufferGeometry {
  const turns = 2.3;
  const segs = 112;
  const len = 0.11;
  const halfThick = 0.00085;

  // Compute solid 4-corner ring profile at every angular step along the conical spiral
  const rings: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]> = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const ang = u * Math.PI * 2 * turns;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const r = 0.010 + u * 0.012;
    const r0 = r * 0.85;
    const r1 = r * 1.15;
    const zBase = u * 0.015;

    const p0 = new THREE.Vector3(ca * r0, sa * r0 + 0.022, -0.5 * len + zBase);
    const p1 = new THREE.Vector3(ca * r1, sa * r1 + 0.022, 0.5 * len + zBase);

    // Outward normal perpendicular to spiral surface (in radial-Z plane)
    const tanU = new THREE.Vector3(-sa, ca, 0);
    const tanV = new THREE.Vector3().subVectors(p1, p0).normalize();
    const outN = new THREE.Vector3().crossVectors(tanU, tanV).normalize();

    const pOut0 = p0.clone().addScaledVector(outN, halfThick);
    const pOut1 = p1.clone().addScaledVector(outN, halfThick);
    const pIn1 = p1.clone().addScaledVector(outN, -halfThick);
    const pIn0 = p0.clone().addScaledVector(outN, -halfThick);
    rings.push([pOut0, pOut1, pIn1, pIn0]);
  }

  const parts: THREE.BufferGeometry[] = [];
  // 4 split-normal ribbon walls: outer shell, +Z flared rim, inner shell, -Z rim
  for (let face = 0; face < 4; face++) {
    const nextCorner = (face + 1) % 4;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const pA = rings[i][face];
      const pB = rings[i][nextCorner];
      positions.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
      uvs.push(u, 0, u, 1);
    }

    for (let i = 0; i < segs; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2 + 1;
      const d = (i + 1) * 2;
      // Tangent u = d - a (+ang); edge = b - a (+face->nextCorner).
      // (a, c, b), (a, d, c) matches outward normals on all 4 corners [pOut0, pOut1, pIn1, pIn0].
      indices.push(a, c, b, a, d, c);
    }

    const strip = new THREE.BufferGeometry();
    strip.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    strip.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    strip.setIndex(indices);
    strip.computeVertexNormals();
    parts.push(strip);
  }

  // Crisp sheared end caps at start (u=0) and trailing tip (u=1)
  for (const endIdx of [0, segs]) {
    const [p0, p1, p2, p3] = rings[endIdx];
    const cap = new THREE.BufferGeometry();
    cap.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z],
        3
      )
    );
    cap.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    cap.setIndex(endIdx === 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
    cap.computeVertexNormals();
    parts.push(cap);
  }

  const merged = mergePartsSafely(parts);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Faceted Crinkled 24K Edible Gold Leaf Flake Geometry
 */
export function createGoldLeafFlakeGeometry(scale = 1): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(0.038 * scale, 0.028 * scale, 5, 4);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // Organic irregular torn leaf border & crinkled gold facets
    const n = Math.sin(x * 130 + i) * 0.004 * scale + Math.cos(z * 160 - i * 0.7) * 0.003 * scale;
    pos.setXYZ(i, x * (0.85 + 0.3 * Math.sin(i * 2.1)), Math.abs(n) + 0.002, z * (0.85 + 0.3 * Math.cos(i * 1.7)));
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Mauviel Spun Hammered Copper Saucepan Outer Body (LatheGeometry with rounded heel & rolled top bead)
 */
export function createMauvielCopperPotGeometry(radius: number, height: number): THREE.BufferGeometry {
  const rBottom = radius * 0.91;
  const rInner = radius - 0.004;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, 0),
    new THREE.Vector2(rBottom * 0.92, 0),
    new THREE.Vector2(rBottom, 0.004),
    new THREE.Vector2(radius * 0.97, 0.014),
    new THREE.Vector2(radius, height * 0.92),
    new THREE.Vector2(radius + 0.0045, height * 0.96),
    new THREE.Vector2(radius + 0.0035, height),
    new THREE.Vector2(rInner, height),
    new THREE.Vector2(rInner, height * 0.94),
  ];
  return createSeamlessLatheGeometry(pts, 64);
}

/**
 * Hand-Wiped Brushed Tin Interior Liner for Mauviel Copper Saucepan (LatheGeometry)
 */
export function createMauvielTinLinerGeometry(radius: number, height: number): THREE.BufferGeometry {
  const rInner = radius - 0.0038;
  const rBot = radius * 0.90;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(rInner, height * 0.96),
    new THREE.Vector2(rInner * 0.99, 0.016),
    new THREE.Vector2(rBot * 0.92, 0.006),
    new THREE.Vector2(0.0001, 0.0055),
  ];
  return createSeamlessLatheGeometry(pts, 56);
}

/**
 * Forged Arched French Saucepan Handle + Hanging Eye Loop (TubeGeometry)
 */
export function createForgedPanHandleGeometry(length = 0.22): THREE.BufferGeometry {
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, length * 0.35, 0.008),
    new THREE.Vector3(0, length * 0.72, 0.014),
    new THREE.Vector3(0, length, 0.006),
  ]);
  const stem = new THREE.TubeGeometry(stemCurve, 20, 0.0072, 10, false);

  const loopCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, length, 0.006),
      new THREE.Vector3(0.012, length + 0.014, 0.003),
      new THREE.Vector3(0, length + 0.028, 0.0),
      new THREE.Vector3(-0.012, length + 0.014, 0.003),
    ],
    true
  );
  const loop = new THREE.TubeGeometry(loopCurve, 20, 0.0042, 8, true);

  const merged = mergePartsSafely([stem, loop]);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Multi-Loop Elastic Wire Balloon Whisk Cage (TubeGeometry)
 */
export function createWireWhiskWiresGeometry(wireCount = 5, length = 0.16, bulbR = 0.036): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < wireCount; i++) {
    const yaw = (i / wireCount) * Math.PI;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(bulbR * 0.75, -length * 0.38, 0),
      new THREE.Vector3(bulbR, -length * 0.78, 0),
      new THREE.Vector3(0, -length, 0),
      new THREE.Vector3(-bulbR, -length * 0.78, 0),
      new THREE.Vector3(-bulbR * 0.75, -length * 0.38, 0),
      new THREE.Vector3(0, 0, 0),
    ]);
    const tube = new THREE.TubeGeometry(curve, 32, 0.0018, 6, false);
    tube.rotateY(yaw);
    parts.push(tube);
  }
  const merged = mergePartsSafely(parts);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Turned Ergonomic Handle (LatheGeometry) for Whisks, Spatulas & Tools
 */
export function createTurnedHandleGeometry(length = 0.14, maxR = 0.013): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, 0),
    new THREE.Vector2(maxR * 0.75, 0.004),
    new THREE.Vector2(maxR * 0.85, length * 0.15),
    new THREE.Vector2(maxR, length * 0.55),
    new THREE.Vector2(maxR * 0.92, length * 0.88),
    new THREE.Vector2(maxR * 0.65, length * 0.98),
    new THREE.Vector2(0.0001, length),
  ];
  return createSeamlessLatheGeometry(pts, 32);
}



/**
 * Dual-Edge Beveled Triangular Chocolate Tempering Scraper Blade (ExtrudeGeometry)
 */
export function createTriangularScraperBladeGeometry(
  topWidth = 0.125,
  height = 0.095,
  thickness = 0.0018
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-topWidth * 0.5, height * 0.45);
  shape.lineTo(topWidth * 0.5, height * 0.45);
  shape.lineTo(topWidth * 0.38, -height * 0.45);
  shape.lineTo(-topWidth * 0.38, -height * 0.45);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.0007,
    bevelSize: 0.0009,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

/**
 * Rounded Rosewood Ergonomic Handle Spine for Tempering Scraper (ExtrudeGeometry)
 */
export function createScraperHandleGeometry(width = 0.132): THREE.BufferGeometry {
  const r = 0.010;
  const hw = width * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -r);
  shape.lineTo(hw - r, -r);
  shape.quadraticCurveTo(hw, -r, hw, 0);
  shape.quadraticCurveTo(hw, r, hw - r, r);
  shape.lineTo(-hw + r, r);
  shape.quadraticCurveTo(-hw, r, -hw, 0);
  shape.quadraticCurveTo(-hw, -r, -hw + r, -r);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.003,
    bevelSegments: 3,
  });
  geo.center();
  return geo;
}

/**
 * Cranked Offset Stainless Palette Spatula Blade with Rounded Tip & S-Neck (ExtrudeGeometry)
 */
export function createCrankedSpatulaBladeGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // Tapered rounded-tip palette blade lying in XY, extruded thinly
  shape.moveTo(0, -0.011);
  shape.lineTo(-0.145, -0.012);
  shape.absarc(-0.155, 0, 0.012, -Math.PI * 0.5, Math.PI * 0.5, true);
  shape.lineTo(0, 0.011);
  shape.closePath();

  const blade = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0018,
    bevelEnabled: true,
    bevelThickness: 0.0004,
    bevelSize: 0.0005,
    bevelSegments: 2,
  });
  blade.rotateX(-Math.PI / 2);

  // S-cranked offset neck joining blade (y=0) to elevated handle bolster (y=0.018)
  const crankCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.002, 0.001, 0),
    new THREE.Vector3(0.014, 0.002, 0),
    new THREE.Vector3(0.026, 0.017, 0),
    new THREE.Vector3(0.042, 0.018, 0),
  ]);
  const neck = new THREE.TubeGeometry(crankCurve, 14, 0.0042, 8, false);
  neck.scale(1, 0.55, 1.35);

  const merged = mergePartsSafely([blade, neck]);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Streamlined Ergonomic Infrared Thermometer Pistol-Grip Housing (ExtrudeGeometry)
 */
export function createIRThermometerBodyGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // Side silhouette (Z = forward-back, Y = up-down)
  shape.moveTo(-0.056, 0.022); // top front snout
  shape.lineTo(0.042, 0.024);  // top rear
  shape.quadraticCurveTo(0.058, 0.024, 0.058, 0.006); // rounded back crown
  shape.lineTo(0.048, -0.014); // rear display slope
  shape.lineTo(0.024, -0.022); // grip inner crook
  shape.lineTo(0.042, -0.088); // back of pistol handle
  shape.quadraticCurveTo(0.044, -0.102, 0.026, -0.104); // handle base
  shape.lineTo(0.008, -0.098);
  shape.lineTo(-0.008, -0.028); // trigger front contour
  shape.quadraticCurveTo(-0.014, -0.012, -0.032, -0.012);
  shape.lineTo(-0.056, -0.008); // bottom front barrel
  shape.quadraticCurveTo(-0.064, 0.007, -0.056, 0.022);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.030,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.005,
    bevelSegments: 4,
  });
  geo.center();
  // Rotate so side profile aligns with YZ plane (extrusion along X, barrel pointing -Z)
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Thick-Walled Crystal Glass Bowl / Apothecary Cylinder (LatheGeometry with inner & outer surfaces for realistic refraction)
 */
export function createGlassVesselGeometry(
  topR: number,
  bottomR: number,
  height: number,
  wall = 0.0045
): THREE.BufferGeometry {
  const baseThick = Math.max(0.008, wall * 2.2);
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, 0),
    new THREE.Vector2(bottomR * 0.92, 0),
    new THREE.Vector2(bottomR, 0.005),
    new THREE.Vector2(topR, height - 0.003),
    new THREE.Vector2(topR - wall * 0.35, height),
    new THREE.Vector2(topR - wall, height - 0.003),
    new THREE.Vector2(Math.max(0.01, bottomR - wall), baseThick + 0.004),
    new THREE.Vector2(Math.max(0.008, bottomR * 0.85 - wall), baseThick),
    new THREE.Vector2(0.0001, baseThick),
  ];
  return createSeamlessLatheGeometry(pts, 64);
}

/**
 * Sculpted Hand-Thrown French Orangerie Terracotta Planter (LatheGeometry with rolled collar & waist bead)
 */
export function createTerracottaPlanterGeometry(
  topR = 0.28,
  bottomR = 0.19,
  height = 0.50
): THREE.BufferGeometry {
  const rimH = height * 0.14;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, 0),
    new THREE.Vector2(bottomR * 0.96, 0),
    new THREE.Vector2(bottomR * 1.03, 0.025), // foot ring
    new THREE.Vector2(bottomR, 0.045),
    new THREE.Vector2(bottomR + (topR - bottomR) * 0.52, height * 0.48),
    new THREE.Vector2(bottomR + (topR - bottomR) * 0.56, height * 0.50), // subtle waist bead
    new THREE.Vector2(bottomR + (topR - bottomR) * 0.54, height * 0.52),
    new THREE.Vector2(topR * 0.96, height - rimH),
    new THREE.Vector2(topR * 1.07, height - rimH * 0.85), // rolled collar lip
    new THREE.Vector2(topR * 1.08, height - 0.012),
    new THREE.Vector2(topR * 1.01, height),
    new THREE.Vector2(topR * 0.91, height),
    new THREE.Vector2(topR * 0.90, height - 0.055),
    new THREE.Vector2(0.0001, height - 0.055),
  ];
  return createSeamlessLatheGeometry(pts, 56);
}

/**
 * Arched Elliptical Glossy Citrus Leaf Geometry (for InstancedMesh foliage canopy)
 */
export function createCitrusLeafGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.024, 0.016, 0.028, 0.058, 0, 0.088);
  shape.bezierCurveTo(-0.028, 0.058, -0.024, 0.016, 0, 0);

  const g = new THREE.ShapeGeometry(shape, 6);
  // Subtle natural lengthwise arch & V-fold midrib curl
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const t = y / 0.088;
    const archZ = -Math.pow(t, 1.8) * 0.018 + Math.abs(x) * 0.25;
    pos.setZ(i, archZ);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Ornate French Sterling Silver Pastry Knife Blade & Fluted Handle
 */
export function createSilverCakeKnifeBladeGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.008);
  shape.lineTo(-0.185, -0.013);
  shape.quadraticCurveTo(-0.210, -0.008, -0.215, 0.008);
  shape.quadraticCurveTo(-0.140, 0.012, 0, 0.009);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0018,
    bevelEnabled: true,
    bevelThickness: 0.0005,
    bevelSize: 0.0005,
    bevelSegments: 2,
  });
  geo.center();
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export function createSilverKnifeHandleGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, 0),
    new THREE.Vector2(0.011, 0.006), // bolster collar
    new THREE.Vector2(0.008, 0.018),
    new THREE.Vector2(0.0095, 0.055),
    new THREE.Vector2(0.0135, 0.105), // flared baroque pommel
    new THREE.Vector2(0.012, 0.122),
    new THREE.Vector2(0.0001, 0.128),
  ];
  const g = createSeamlessLatheGeometry(pts, 32);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/**
 * Limoges Porcelain Espresso Cup, Saucer & Curved Ear Handle
 */
export function createEspressoCupGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, 0),
    new THREE.Vector2(0.024, 0),
    new THREE.Vector2(0.027, 0.007),
    new THREE.Vector2(0.036, 0.032),
    new THREE.Vector2(0.042, 0.056),
    new THREE.Vector2(0.040, 0.058),
    new THREE.Vector2(0.038, 0.055),
    new THREE.Vector2(0.025, 0.009),
    new THREE.Vector2(0.0001, 0.009),
  ];
  return createSeamlessLatheGeometry(pts, 40);
}



export function createEspressoSaucerGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, 0),
    new THREE.Vector2(0.036, 0),
    new THREE.Vector2(0.072, 0.010),
    new THREE.Vector2(0.076, 0.013),
    new THREE.Vector2(0.073, 0.015),
    new THREE.Vector2(0.035, 0.006),
    new THREE.Vector2(0.0001, 0.006),
  ];
  return createSeamlessLatheGeometry(pts, 56);
}

export function createCupEarHandleGeometry(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.038, 0.048, 0),
    new THREE.Vector3(0.057, 0.049, 0),
    new THREE.Vector3(0.058, 0.030, 0),
    new THREE.Vector3(0.033, 0.020, 0),
  ]);
  const g = new THREE.TubeGeometry(curve, 16, 0.0035, 8, false);
  g.computeVertexNormals();
  return g;
}

/**
 * Artisanal French Pastry Gold-Leaf Precision Tweezers (ExtrudeGeometry V-silhouette)
 */
export function createBrassTweezersGeometry(length = 0.16): THREE.BufferGeometry {
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-length * 0.5, 0.001, -0.004),
    new THREE.Vector3(0, 0.004, -0.005),
    new THREE.Vector3(length * 0.48, 0.008, -0.0012),
    new THREE.Vector3(length * 0.5, 0.0015, 0),
    new THREE.Vector3(length * 0.48, 0.008, 0.0012),
    new THREE.Vector3(0, 0.004, 0.005),
    new THREE.Vector3(-length * 0.5, 0.001, 0.004),
  ]);
  const g = new THREE.TubeGeometry(armCurve, 32, 0.0016, 8, false);
  g.scale(1, 0.65, 1.15);
  g.computeVertexNormals();
  return g;
}

/**
 * Beveled Rounded-Edge Rectangular Extrusion centered at origin with exact outer [width, height, depth]
 * and clean normalized [0, 1] box-projected UVs so procedural marble/wood/brass textures never stretch!
 */
export function createBeveledBoxGeometry(
  width: number,
  height: number,
  depth: number,
  cornerRadius = 0.012,
  bevelSize = 0.004,
  bevelThickness = 0.004,
  bevelSegments = 3
): THREE.BufferGeometry {
  const bs = Math.min(bevelSize, width * 0.2, depth * 0.2);
  const bt = Math.min(bevelThickness, height * 0.35);
  const hw = Math.max(0.001, width * 0.5 - bs);
  const hd = Math.max(0.001, depth * 0.5 - bs);
  const r = Math.max(0.0005, Math.min(cornerRadius, hw * 0.48, hd * 0.48));
  const coreH = Math.max(0.0005, height - 2 * bt);

  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: coreH,
    bevelEnabled: true,
    bevelThickness: bt,
    bevelSize: bs,
    bevelSegments,
    curveSegments: 6,
  });
  geo.rotateX(-Math.PI / 2);
  geo.center();
  geo.computeVertexNormals();

  // Box-project normalized [0, 1] UVs using vertex normal dominance
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  if (pos && norm && uv) {
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const ax = Math.abs(norm.getX(i));
      const ay = Math.abs(norm.getY(i));
      const az = Math.abs(norm.getZ(i));
      if (ay >= ax && ay >= az) {
        uv.setXY(i, x / width + 0.5, z / depth + 0.5);
      } else if (ax >= az) {
        uv.setXY(i, z / depth + 0.5, y / height + 0.5);
      } else {
        uv.setXY(i, x / width + 0.5, y / height + 0.5);
      }
    }
    uv.needsUpdate = true;
  }
  return geo;
}

/**
 * Beveled Architectural Haussmann Picture-Frame Molding (for Island Cabinet Panel Trim)
 */
export function createBeveledFrameGeometry(
  width: number,
  height: number,
  borderWidth: number,
  depth = 0.010,
  bevelSize = 0.0025
): THREE.BufferGeometry {
  const bs = Math.min(bevelSize, borderWidth * 0.25);
  const hw = width * 0.5 - bs;
  const hh = height * 0.5 - bs;
  const iw = Math.max(0.01, width * 0.5 - borderWidth + bs);
  const ih = Math.max(0.01, height * 0.5 - borderWidth + bs);

  const outer = new THREE.Shape();
  outer.moveTo(-hw, -hh);
  outer.lineTo(hw, -hh);
  outer.lineTo(hw, hh);
  outer.lineTo(-hw, hh);
  outer.closePath();

  const hole = new THREE.Path();
  hole.moveTo(-iw, -ih);
  hole.lineTo(iw, -ih);
  hole.lineTo(iw, ih);
  hole.lineTo(-iw, ih);
  hole.closePath();
  outer.holes.push(hole);

  const bt = Math.min(0.0025, depth * 0.3);
  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: Math.max(0.001, depth - 2 * bt),
    bevelEnabled: true,
    bevelThickness: bt,
    bevelSize: bs,
    bevelSegments: 2,
  });
  geo.center();
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  if (pos && uv) {
    const invW = 1 / Math.max(0.001, width);
    const invH = 1 / Math.max(0.001, height);
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) * invW + 0.5, pos.getY(i) * invH + 0.5);
    }
    uv.needsUpdate = true;
  }
  return geo;
}

/**
 * Turned Bullnose Marble Tabletop / Turntable Platter (LatheGeometry with normalized planar UVs)
 */
export function createBeveledMarbleTabletopGeometry(radius: number, thickness: number): THREE.BufferGeometry {
  const ht = thickness * 0.5;
  const bevel = Math.min(0.0045, ht * 0.4);
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, -ht),
    new THREE.Vector2(radius - bevel, -ht),
    new THREE.Vector2(radius, -ht + bevel * 0.85),
    new THREE.Vector2(radius, ht - bevel),
    new THREE.Vector2(radius - bevel * 0.45, ht - bevel * 0.25),
    new THREE.Vector2(radius - bevel, ht),
    new THREE.Vector2(0.0001, ht),
  ];
  const g = createSeamlessLatheGeometry(pts, 84);

  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  if (pos && uv) {
    const invD = 1 / (radius * 2);
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) * invD + 0.5, pos.getZ(i) * invD + 0.5);
    }
    uv.needsUpdate = true;
  }
  return g;
}

/**
 * Sculpted Brass Revolving Turntable Pedestal Column (y = 0 .. 0.074, LatheGeometry)
 */
export function createTurntablePedestalGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, 0.0),
    new THREE.Vector2(0.186, 0.0),
    new THREE.Vector2(0.184, 0.008),
    new THREE.Vector2(0.165, 0.016),
    new THREE.Vector2(0.145, 0.025),
    new THREE.Vector2(0.068, 0.032),
    new THREE.Vector2(0.052, 0.042),
    new THREE.Vector2(0.044, 0.053),
    new THREE.Vector2(0.058, 0.059), // turned torus collar
    new THREE.Vector2(0.046, 0.064),
    new THREE.Vector2(0.072, 0.070),
    new THREE.Vector2(0.105, 0.074),
    new THREE.Vector2(0.0001, 0.074),
  ];
  return createSeamlessLatheGeometry(pts, 72);
}

/**
 * Belle-Epoque Turned Gilded Tasting Table Pedestal Column (y = 0 .. 0.7905, LatheGeometry)
 */
export function createGueridonPedestalGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, 0.0),
    new THREE.Vector2(0.405, 0.0),
    new THREE.Vector2(0.400, 0.018),
    new THREE.Vector2(0.372, 0.034),
    new THREE.Vector2(0.335, 0.056),
    new THREE.Vector2(0.240, 0.074),
    new THREE.Vector2(0.135, 0.092),
    new THREE.Vector2(0.104, 0.135),
    new THREE.Vector2(0.128, 0.185), // lower baluster collar
    new THREE.Vector2(0.094, 0.220),
    new THREE.Vector2(0.078, 0.350),
    new THREE.Vector2(0.114, 0.390), // central node ring
    new THREE.Vector2(0.076, 0.430),
    new THREE.Vector2(0.088, 0.560),
    new THREE.Vector2(0.122, 0.595), // upper astragal
    new THREE.Vector2(0.082, 0.635),
    new THREE.Vector2(0.118, 0.740),
    new THREE.Vector2(0.185, 0.778),
    new THREE.Vector2(0.215, 0.7905),
    new THREE.Vector2(0.0001, 0.7905),
  ];
  return createSeamlessLatheGeometry(pts, 72);
}

/**
 * Rolled-Lip Brushed Stainless Patisserie Mousse Ring (LatheGeometry, resting y = 0 .. height)
 * Seam normals at phi=0 and phi=2PI are welded smoothly so zero vertical seam line appears under backlight.
 */
export function createMousseRingGeometry(
  radius: number,
  height: number,
  wall = 0.0022,
  segs = 64
): THREE.BufferGeometry {
  const rIn = Math.max(0.01, radius - wall);
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(rIn, 0.0),
    new THREE.Vector2(radius, 0.0),
    new THREE.Vector2(radius, height - 0.003),
    new THREE.Vector2(radius + 0.0022, height - 0.0012), // top rolled flange
    new THREE.Vector2(radius + 0.0014, height),
    new THREE.Vector2(rIn, height),
    new THREE.Vector2(rIn, 0.0),
  ];
  const g = new THREE.LatheGeometry(pts, segs);
  g.computeVertexNormals();

  // Weld seam normals between first (phi=0) and last (phi=2PI) ring columns
  const norm = g.attributes.normal;
  const stride = pts.length;
  if (norm && norm.count >= (segs + 1) * stride) {
    const n0 = new THREE.Vector3();
    const n1 = new THREE.Vector3();
    for (let j = 0; j < stride; j++) {
      const idxA = j;
      const idxB = segs * stride + j;
      n0.fromBufferAttribute(norm, idxA);
      n1.fromBufferAttribute(norm, idxB);
      n0.add(n1).normalize();
      norm.setXYZ(idxA, n0.x, n0.y, n0.z);
      norm.setXYZ(idxB, n0.x, n0.y, n0.z);
    }
    norm.needsUpdate = true;
  }
  return g;
}

/**
 * Turned Brass Apothecary Spice Jar Lid with Ball Finial (LatheGeometry)
 */
export function createApothecaryLidGeometry(outerRadius = 0.058): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, 0.0),
    new THREE.Vector2(outerRadius, 0.0),
    new THREE.Vector2(outerRadius, 0.012),
    new THREE.Vector2(outerRadius * 0.86, 0.018),
    new THREE.Vector2(outerRadius * 0.34, 0.021),
    new THREE.Vector2(outerRadius * 0.16, 0.024),
    new THREE.Vector2(outerRadius * 0.24, 0.031), // finial ball waist
    new THREE.Vector2(outerRadius * 0.20, 0.038),
    new THREE.Vector2(0.0001, 0.041),
  ];
  return createSeamlessLatheGeometry(pts, 72);
}

/**
 * Sculpted Bronte Pistachio Kernel Geometry for InstancedMesh Granular Jar Fill
 */
export function createPistachioKernelGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, -0.0072),
    new THREE.Vector2(0.0034, -0.0048),
    new THREE.Vector2(0.0044, -0.0006),
    new THREE.Vector2(0.0036, 0.0044),
    new THREE.Vector2(0.0018, 0.0070),
    new THREE.Vector2(0.0001, 0.0076),
  ];
  const g = new THREE.LatheGeometry(pts, 14);
  g.scale(1.0, 1.0, 0.72);
  return weldLatheSeamNormals(g, pts.length, 14);
}

/**
 * Curved Natural Madagascar Bourbon Vanilla Bean Pod (TubeGeometry with stem hook)
 */
export function createVanillaPodGeometry(bend = 0.016, length = 0.178): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(bend * 0.35, length * 0.32, bend * 0.25),
    new THREE.Vector3(bend, length * 0.68, -bend * 0.2),
    new THREE.Vector3(bend * 0.65, length * 0.94, bend * 0.15),
    new THREE.Vector3(bend * 1.15, length, bend * 0.35),
  ]);
  const g = new THREE.TubeGeometry(curve, 20, 0.0038, 8, false);
  g.scale(1.0, 1.0, 0.82);
  g.computeVertexNormals();
  return g;
}

/**
 * Turned Pleated Fabric Pastry Piping Bag (High-Res 72-Segment Smooth Organic Cloth Bag!)
 */
export function createPipingBagGeometry(radius = 0.046, height = 0.19): THREE.BufferGeometry {
  const hh = height * 0.5;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, -hh),
    new THREE.Vector2(0.0085, -hh + 0.006),
    new THREE.Vector2(radius * 0.24, -hh + height * 0.16),
    new THREE.Vector2(radius * 0.44, -hh + height * 0.32),
    new THREE.Vector2(radius * 0.64, -hh + height * 0.48),
    new THREE.Vector2(radius * 0.80, -hh + height * 0.66),
    new THREE.Vector2(radius * 0.94, hh - 0.032),
    new THREE.Vector2(radius * 1.02, hh - 0.014),
    new THREE.Vector2(radius * 1.04, hh - 0.006), // rolled folded cloth collar
    new THREE.Vector2(radius * 0.90, hh),
    new THREE.Vector2(0.0001, hh - 0.012),
  ];
  return createSeamlessLatheGeometry(pts, 72);
}



/**
 * Sculpted Thin Draped French Linen Torchon Pastry Napkin (<= 0.0058m profile)
 * Closed 2-sheet grid with crisp stepped lap-fold crease, organic woven ripples, and relaxed hem corners.
 */
export function createFoldedLinenNapkinGeometry(
  width = 0.23,
  depth = 0.165,
  maxThickness = 0.0056
): THREE.BufferGeometry {
  const nx = 28;
  const nz = 20;
  const cols = nx + 1;
  const rows = nz + 1;
  const halfBase = maxThickness * 0.44;
  const flapExtra = maxThickness * 0.42;

  const smoothstep = (e0: number, e1: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };

  const evalGridPoint = (iu: number, iv: number) => {
    const su = iu / nx; // 0..1
    const sv = iv / nz; // 0..1
    const uc = su - 0.5;
    const vc = sv - 0.5;

    // Subtle bowed cloth edges & gently relaxed folded corner silhouette
    const edgeBowX = Math.sin(sv * Math.PI) * 0.0045 * (uc >= 0 ? 1 : -1);
    const edgeBowZ = Math.cos(su * Math.PI * 1.4) * 0.0032;
    const x = uc * width + edgeBowX;
    const z = vc * depth + edgeBowZ;

    // Soft central fold arch & offset tri-fold lap edge diagonal
    const edgeDist = Math.min(su, 1 - su, sv, 1 - sv);
    const hemPinch = smoothstep(0.0, 0.09, edgeDist);
    const lapFold = smoothstep(-0.14, 0.02, uc + vc * 0.18);
    const softCrease =
      Math.sin(uc * Math.PI * 3.1 + vc * 1.4) * 0.00055 * hemPinch +
      Math.cos(vc * Math.PI * 2.4) * 0.00042 * hemPinch;

    const yBot = 0.0002 + (1 - hemPinch) * 0.0002;
    const yTop = Math.min(
      maxThickness,
      yBot + halfBase * (0.35 + 0.65 * hemPinch) + flapExtra * lapFold * hemPinch + softCrease
    );
    return { x, z, yTop, yBot, su, sv };
  };

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Layer 0..cols*rows-1: top cloth surface; Layer cols*rows..2*cols*rows-1: bottom cloth surface
  for (let pass = 0; pass < 2; pass++) {
    for (let iv = 0; iv <= nz; iv++) {
      for (let iu = 0; iu <= nx; iu++) {
        const pt = evalGridPoint(iu, iv);
        positions.push(pt.x, pass === 0 ? pt.yTop : pt.yBot, pt.z);
        uvs.push(pt.su, pt.sv);
      }
    }
  }

  const botOffset = cols * rows;
  for (let iv = 0; iv < nz; iv++) {
    for (let iu = 0; iu < nx; iu++) {
      const a = iv * cols + iu;
      const b = a + 1;
      const c = (iv + 1) * cols + iu + 1;
      const d = (iv + 1) * cols + iu;
      // Top (+Y) & Bottom (-Y) winding
      indices.push(a, d, c, a, c, b);
      const ba = botOffset + a;
      const bb = botOffset + b;
      const bc = botOffset + c;
      const bd = botOffset + d;
      indices.push(ba, bb, bc, ba, bc, bd);
    }
  }

  // Stitch clean perimeter hem around all 4 cloth borders
  const stitchEdge = (ringIdxs: number[]) => {
    for (let k = 0; k < ringIdxs.length - 1; k++) {
      const t0 = ringIdxs[k];
      const t1 = ringIdxs[k + 1];
      const b0 = botOffset + t0;
      const b1 = botOffset + t1;
      indices.push(t0, b0, b1, t0, b1, t1);
    }
  };
  const topEdge: number[] = [];
  for (let iu = 0; iu <= nx; iu++) topEdge.push(iu);
  const rightEdge: number[] = [];
  for (let iv = 0; iv <= nz; iv++) rightEdge.push(iv * cols + nx);
  const botEdge: number[] = [];
  for (let iu = nx; iu >= 0; iu--) botEdge.push(nz * cols + iu);
  const leftEdge: number[] = [];
  for (let iv = nz; iv >= 0; iv--) leftEdge.push(iv * cols);

  stitchEdge(topEdge);
  stitchEdge(rightEdge);
  stitchEdge(botEdge);
  stitchEdge(leftEdge);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Reusable Linear Architectural Molding Extrusion along X ([-length/2 .. +length/2])
 * Profile points are [zOutwardDepth, yHeight] in meters; UVs normalized cleanly for PBR tiling.
 */
export function createContouredBoiserieStripGeometry(
  length: number,
  profilePoints: Array<[number, number]>,
  bevelSize = 0.0025
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  profilePoints.forEach(([pz, py], idx) => {
    if (idx === 0) shape.moveTo(pz, py);
    else shape.lineTo(pz, py);
  });
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, length - bevelSize * 2),
    bevelEnabled: true,
    bevelThickness: bevelSize,
    bevelSize: bevelSize,
    bevelSegments: 2,
    curveSegments: 8,
  });
  geo.center();
  // Rotate -PI/2 around Y: extrude +Z -> -X, shape X (+zOutward) -> +Z!
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  geo.computeBoundingBox();

  const bb = geo.boundingBox;
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  if (bb && pos && uv) {
    const sx = Math.max(0.001, bb.max.x - bb.min.x);
    const sy = Math.max(0.001, bb.max.y - bb.min.y);
    const sz = Math.max(0.001, bb.max.z - bb.min.z);
    for (let i = 0; i < pos.count; i++) {
      const u = (pos.getX(i) - bb.min.x) / sx;
      const v = (pos.getY(i) - bb.min.y) / sy * 0.7 + ((pos.getZ(i) - bb.min.z) / sz) * 0.3;
      uv.setXY(i, u, v);
    }
    uv.needsUpdate = true;
  }
  return geo;
}

/**
 * Classical Multi-Stepped Parisian Haussmann Crown Cornice Molding
 */
export function createHaussmannCorniceGeometry(length: number): THREE.BufferGeometry {
  return createContouredBoiserieStripGeometry(length, [
    [0.0, -0.12],
    [0.045, -0.12],
    [0.045, -0.085],
    [0.072, -0.068],
    [0.095, -0.015],
    [0.145, 0.032],
    [0.145, 0.068],
    [0.175, 0.088],
    [0.175, 0.12],
    [0.0, 0.12],
  ]);
}

/**
 * Contoured Haussmann Wall Chair-Rail (Dado Molding)
 */
export function createHaussmannDadoRailGeometry(length: number): THREE.BufferGeometry {
  return createContouredBoiserieStripGeometry(length, [
    [0.0, -0.045],
    [0.028, -0.045],
    [0.046, -0.024],
    [0.058, 0.0],
    [0.046, 0.026],
    [0.022, 0.045],
    [0.0, 0.045],
  ]);
}

/**
 * Stepped Haussmann Baseboard Wainscot Plinthe
 */
export function createHaussmannBaseboardGeometry(length: number): THREE.BufferGeometry {
  return createContouredBoiserieStripGeometry(length, [
    [0.0, -0.16],
    [0.048, -0.16],
    [0.048, 0.08],
    [0.036, 0.115],
    [0.026, 0.142],
    [0.014, 0.16],
    [0.0, 0.16],
  ]);
}

/**
 * Recessed Slotted Brushed-Stainless Evaporator Fin & Fan Shroud Plate for -25°C Blast Chiller
 */
export function createSlottedEvaporatorGrilleGeometry(
  width = 0.72,
  height = 0.24,
  slotCount = 8
): THREE.BufferGeometry {
  const hw = width * 0.5;
  const hh = height * 0.5;
  const plate = new THREE.Shape();
  plate.moveTo(-hw, -hh);
  plate.lineTo(hw, -hh);
  plate.lineTo(hw, hh);
  plate.lineTo(-hw, hh);
  plate.closePath();

  // Horizontal ventilation louver slots across evaporator plate (strictly clear of central turbine aperture)
  const apertureR = Math.min(height * 0.30, 0.068);
  const slotW = width * 0.23;
  const slotH = 0.011;
  const cols = [-width * 0.295, width * 0.295];
  for (const cx of cols) {
    for (let s = 0; s < slotCount; s++) {
      const cy = -hh + 0.030 + (s / Math.max(1, slotCount - 1)) * (height - 0.060);
      const hole = new THREE.Path();
      hole.moveTo(cx - slotW * 0.5, cy - slotH * 0.5);
      hole.lineTo(cx + slotW * 0.5, cy - slotH * 0.5);
      hole.lineTo(cx + slotW * 0.5, cy + slotH * 0.5);
      hole.lineTo(cx - slotW * 0.5, cy + slotH * 0.5);
      hole.closePath();
      plate.holes.push(hole);
    }
  }

  // Central circular cryo turbine vent aperture
  const centerAperture = new THREE.Path();
  centerAperture.absarc(0, 0, apertureR, 0, Math.PI * 2, true);
  plate.holes.push(centerAperture);

  const geo = new THREE.ExtrudeGeometry(plate, {
    depth: 0.010,
    bevelEnabled: true,
    bevelThickness: 0.0015,
    bevelSize: 0.0015,
    bevelSegments: 2,
    curveSegments: 16,
  });
  geo.center();
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  if (pos && uv) {
    const invW = 1 / Math.max(0.001, width);
    const invH = 1 / Math.max(0.001, height);
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) * invW + 0.5, pos.getY(i) * invH + 0.5);
    }
    uv.needsUpdate = true;
  }
  return geo;
}

/**
 * Lathe-turned French Star-Fluted Stainless Piping Nozzle (`douille cannelée`):
 * Rolled base collar, satin tapered cone, and 8 crisp fluted star teeth around the opening.
 */
export function createFlutedPipingNozzleGeometry(
  baseRadius = 0.013,
  tipRadius = 0.0044,
  height = 0.036,
  flutes = 8
): THREE.BufferGeometry {
  const segs = 64;
  const wall = 0.0014;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(Math.max(0.002, baseRadius - wall), 0.0),
    new THREE.Vector2(baseRadius + 0.0022, 0.0),
    new THREE.Vector2(baseRadius + 0.0022, 0.0026),
    new THREE.Vector2(baseRadius, 0.0036),
    new THREE.Vector2(THREE.MathUtils.lerp(baseRadius, tipRadius, 0.45), height * 0.46),
    new THREE.Vector2(tipRadius, height),
    new THREE.Vector2(Math.max(0.0016, tipRadius - wall), height),
    new THREE.Vector2(Math.max(0.002, baseRadius - wall), 0.003),
    new THREE.Vector2(Math.max(0.002, baseRadius - wall), 0.0),
  ];
  const g = new THREE.LatheGeometry(pts, segs);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (y > height * 0.48 && r > 0.001) {
      const t = THREE.MathUtils.clamp((y - height * 0.48) / (height * 0.52), 0, 1);
      const ang = Math.atan2(z, x);
      const star = 1.0 + Math.cos(ang * flutes) * (0.18 * t);
      const notchY = t > 0.85 ? -Math.max(0, Math.cos(ang * flutes)) * 0.0026 : 0;
      pos.setXYZ(i, x * star, y + notchY, z * star);
    }
  }
  return weldLatheSeamNormals(g, pts.length, segs);
}

/**
 * Ergonomic Brushed-Brass & Oiled Walnut Digital Pastry IR Probe Stylus Body (`0.148m` tapered beveled wand).
 */
export function createSleekIrProbeGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.017, -0.070);
  shape.lineTo(0.017, -0.070);
  shape.quadraticCurveTo(0.022, -0.020, 0.018, 0.036);
  shape.lineTo(0.011, 0.072);
  shape.lineTo(-0.011, 0.072);
  shape.lineTo(-0.018, 0.036);
  shape.quadraticCurveTo(-0.022, -0.020, -0.017, -0.070);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.0035,
    bevelSize: 0.0032,
    bevelSegments: 3,
    curveSegments: 16,
  });
  geo.rotateX(Math.PI / 2);
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

/**
 * Die-Cut French Cream Baking Parchment Disc with Twin Lift Tabs (sits flush inside bottom of mousse ring).
 */
export function createBakingParchmentDiscGeometry(radius = 0.236): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0012,
    bevelEnabled: true,
    bevelThickness: 0.0003,
    bevelSize: 0.0004,
    bevelSegments: 1,
    curveSegments: 64,
  });
  geo.rotateX(-Math.PI / 2);
  geo.center();
  geo.computeVertexNormals();
  return geo;
}


/**
 * Double-curved teardrop Woven-Rattan Egg Swing Basket shell whose open front mouth faces +Z.
 * Bottom bowl and top crown close 360° smoothly while the mid mouth opens symmetrically.
 */
export function createEggSwingShellGeometry(
  width = 0.80,
  height = 1.08,
  depth = 0.58
): THREE.BufferGeometry {
  const uSegs = 40;
  const vSegs = 28;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const openAngleAt = (v: number): number => {
    if (v <= 0.14 || v >= 0.92) return 0;
    const t = (v - 0.14) / (0.92 - 0.14);
    return 0.35 * Math.PI * Math.pow(Math.sin(t * Math.PI), 0.78);
  };

  for (let vi = 0; vi <= vSegs; vi++) {
    const v = vi / vSegs;
    const y = v * height;
    const prof = Math.sin(Math.pow(v, 0.82) * Math.PI);
    const scaleR = 0.045 + 0.955 * Math.pow(Math.max(0, prof), 0.62);
    const rx = width * 0.5 * scaleR;
    const rz = depth * 0.5 * scaleR;
    const open = openAngleAt(v);
    const span = Math.PI * 2 - 2 * open;

    for (let ui = 0; ui <= uSegs; ui++) {
      const u = ui / uSegs;
      const phi = open + u * span;
      const x = rx * Math.sin(phi);
      const z = rz * Math.cos(phi);
      positions.push(x, y, z);
      uvs.push(u * 2.5, v * 2.2);
    }
  }

  const rowStride = uSegs + 1;
  for (let vi = 0; vi < vSegs; vi++) {
    for (let ui = 0; ui < uSegs; ui++) {
      const a = vi * rowStride + ui;
      const b = a + 1;
      const c = a + rowStride;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  // Bottom solid woven floor cap so low angles never show an empty hole at the egg base
  const bottomCenterIdx = positions.length / 3;
  positions.push(0, 0.002, 0);
  uvs.push(0.5, 0.0);
  for (let ui = 0; ui < uSegs; ui++) {
    indices.push(bottomCenterIdx, ui + 1, ui);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Continuous 3D braided rattan rim hoop framing the open +Z teardrop mouth of the Egg Swing Chair.
 */
export function createEggSwingRimTubeGeometry(
  width = 0.80,
  height = 1.08,
  depth = 0.58,
  tubeRadius = 0.022
): THREE.BufferGeometry {
  const rimPts: THREE.Vector3[] = [];
  const sampleCount = 32;

  const evalRim = (v: number, side: 1 | -1) => {
    const t = Math.max(0, Math.min(1, (v - 0.14) / (0.92 - 0.14)));
    const open = 0.35 * Math.PI * Math.pow(Math.sin(t * Math.PI), 0.78);
    const prof = Math.sin(Math.pow(v, 0.82) * Math.PI);
    const scaleR = 0.045 + 0.955 * Math.pow(Math.max(0, prof), 0.62);
    const rx = width * 0.5 * scaleR;
    const rz = depth * 0.5 * scaleR;
    return new THREE.Vector3(side * rx * Math.sin(open), v * height, rz * Math.cos(open));
  };

  for (let i = 0; i <= sampleCount; i++) {
    const v = 0.14 + (i / sampleCount) * (0.92 - 0.14);
    rimPts.push(evalRim(v, 1));
  }
  for (let i = sampleCount - 1; i >= 1; i--) {
    const v = 0.14 + (i / sampleCount) * (0.92 - 0.14);
    rimPts.push(evalRim(v, -1));
  }

  const curve = new THREE.CatmullRomCurve3(rimPts, true, 'catmullrom', 0.35);
  const geo = new THREE.TubeGeometry(curve, 64, tubeRadius, 12, true);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Slim French half-moon (D-profile) foyer console tabletop centered in X with flat wall edge at -Z.
 */
export function createHalfMoonConsoleTopGeometry(
  width = 0.96,
  depth = 0.38,
  thickness = 0.032
): THREE.BufferGeometry {
  const halfW = width * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-halfW, 0);
  shape.absarc(0, 0, halfW, Math.PI, Math.PI * 2, false);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 2,
    curveSegments: 32,
  });
  // Scale Y before rotating so semi-ellipse spans [0, depth] along +Z after rotateX(-PI/2)
  geo.scale(1, depth / halfW, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.006, -depth * 0.5);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Horizontal French tapered beechwood rolling pin with turned handles (total length = 0.42m).
 */
export function createRollingPinGeometry(
  barrelLen = 0.24,
  barrelR = 0.027
): THREE.BufferGeometry {
  const h = barrelLen * 0.5;
  const pts = [
    new THREE.Vector2(0.0002, -h - 0.09),
    new THREE.Vector2(0.011, -h - 0.088),
    new THREE.Vector2(0.015, -h - 0.068),
    new THREE.Vector2(0.014, -h - 0.036),
    new THREE.Vector2(0.009, -h - 0.012),
    new THREE.Vector2(barrelR * 0.92, -h),
    new THREE.Vector2(barrelR, -h * 0.45),
    new THREE.Vector2(barrelR, h * 0.45),
    new THREE.Vector2(barrelR * 0.92, h),
    new THREE.Vector2(0.009, h + 0.012),
    new THREE.Vector2(0.014, h + 0.036),
    new THREE.Vector2(0.015, h + 0.068),
    new THREE.Vector2(0.011, h + 0.088),
    new THREE.Vector2(0.0002, h + 0.09),
  ];
  const geo = createSeamlessLatheGeometry(pts, 28);
  geo.rotateZ(Math.PI / 2);
  geo.translate(0, barrelR, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Curved roll-top cottage enamel bakery breadbox (bottom strictly flush at y = 0).
 */
export function createBreadboxRollTopGeometry(
  width = 0.34,
  height = 0.155,
  depth = 0.22
): THREE.BufferGeometry {
  const hd = depth * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hd, 0);
  shape.lineTo(hd, 0);
  shape.lineTo(hd, height * 0.38);
  shape.quadraticCurveTo(hd, height, 0.02, height);
  shape.lineTo(-hd + 0.022, height);
  shape.quadraticCurveTo(-hd, height, -hd, height - 0.022);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: 0.007,
    bevelSize: 0.007,
    bevelSegments: 2,
    curveSegments: 16,
  });
  geo.translate(0, 0, -width * 0.5);
  geo.rotateY(-Math.PI / 2);
  geo.translate(0, 0.007, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * High-arch brass swan-neck garden tap spout anchored at y = 0 base and arcing +Z over the basin.
 */
export function createBrassSwanFaucetSpoutGeometry(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.02, 0),
    new THREE.Vector3(0, 0.21, -0.02),
    new THREE.Vector3(0, 0.31, 0.06),
    new THREE.Vector3(0, 0.295, 0.165),
    new THREE.Vector3(0, 0.215, 0.205),
  ]);
  const geo = new THREE.TubeGeometry(curve, 32, 0.011, 14, false);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sculpted arched honey-oak cat cubby enclosure with true arched front doorway cutout (bottom at y = 0).
 */
export function createCatTreeArchCubbyGeometry(
  width = 0.38,
  height = 0.30,
  depth = 0.36
): THREE.BufferGeometry {
  const hw = width * 0.5;
  const springY = height * 0.56;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw, springY);
  shape.absarc(0, springY, hw, 0, Math.PI, false);
  shape.closePath();

  // Inner vaulted cat nook cutout (front-to-back arched tunnel with thin floor sill)
  const iw = hw - 0.036;
  const doorSpring = height * 0.44;
  const hole = new THREE.Path();
  hole.moveTo(-iw, 0.022);
  hole.lineTo(iw, 0.022);
  hole.lineTo(iw, doorSpring);
  hole.absarc(0, doorSpring, iw, 0, Math.PI, false);
  hole.closePath();
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 24,
  });
  geo.translate(0, 0.008, -depth * 0.5);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Turned & gently fluted French salon chair / credenza leg (bottom strictly flush at y = 0).
 */
export function createFrenchChairLegGeometry(
  height = 0.43,
  topRadius = 0.022
): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0002, 0.0),
    new THREE.Vector2(topRadius * 0.56, 0.003),
    new THREE.Vector2(topRadius * 0.68, height * 0.05),
    new THREE.Vector2(topRadius * 0.50, height * 0.12),
    new THREE.Vector2(topRadius * 0.72, height * 0.46),
    new THREE.Vector2(topRadius * 0.94, height * 0.72),
    new THREE.Vector2(topRadius * 0.70, height * 0.80),
    new THREE.Vector2(topRadius * 1.04, height * 0.88),
    new THREE.Vector2(topRadius * 0.98, height),
    new THREE.Vector2(0.0002, height),
  ];
  const geo = createSeamlessLatheGeometry(pts, 20);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Carved openwork French Provincial violin-splat salon chair backrest + arched scroll crest (`y = 0..height`).
 */
export function createViolinSplatBackrestGeometry(
  width = 0.36,
  height = 0.48
): THREE.BufferGeometry {
  const hw = width * 0.5;
  const frame = new THREE.Shape();
  frame.moveTo(-hw + 0.015, 0.0);
  frame.lineTo(hw - 0.015, 0.0);
  frame.lineTo(hw, height * 0.84);
  frame.quadraticCurveTo(hw * 0.55, height * 0.90, 0, height);
  frame.quadraticCurveTo(-hw * 0.55, height * 0.90, -hw, height * 0.84);
  frame.closePath();

  // Left & Right pierced openings flanking the central carved violin/vase splat
  [-1, 1].forEach((side) => {
    const hole = new THREE.Path();
    const xOut = side * (hw - 0.028);
    const xInMid = side * 0.052;
    const xInWaist = side * 0.032;
    const xInTop = side * 0.062;
    if (side > 0) {
      hole.moveTo(xInWaist, 0.05);
      hole.lineTo(xOut, 0.05);
      hole.lineTo(xOut * 0.96, height * 0.78);
      hole.quadraticCurveTo(xInTop, height * 0.83, xInTop, height * 0.70);
      hole.bezierCurveTo(xInMid + 0.022, height * 0.52, xInWaist - 0.012, height * 0.34, xInMid, height * 0.22);
      hole.closePath();
    } else {
      hole.moveTo(xOut, 0.05);
      hole.lineTo(xInWaist, 0.05);
      hole.lineTo(xInMid, height * 0.22);
      hole.bezierCurveTo(xInWaist + 0.012, height * 0.34, xInMid - 0.022, height * 0.52, xInTop, height * 0.70);
      hole.quadraticCurveTo(xInTop, height * 0.83, xOut * 0.96, height * 0.78);
      hole.closePath();
    }
    frame.holes.push(hole);
  });

  const geo = new THREE.ExtrudeGeometry(frame, {
    depth: 0.020,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.0035,
    bevelSegments: 2,
    curveSegments: 18,
  });
  geo.translate(0, 0.0035, -0.010);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Scalloped French Provincial apron valance trim (top at y = 0, scalloped curves dropping to -dropH).
 */
export function createScallopedCredenzaApronGeometry(
  width = 1.06,
  dropH = 0.082,
  thickness = 0.022
): THREE.BufferGeometry {
  const hw = width * 0.5;
  const s = new THREE.Shape();
  s.moveTo(-hw, 0);
  s.lineTo(hw, 0);
  s.lineTo(hw, -dropH * 0.78);
  s.quadraticCurveTo(hw * 0.68, -dropH * 0.42, hw * 0.34, -dropH * 0.82);
  s.quadraticCurveTo(0, -dropH * 1.12, -hw * 0.34, -dropH * 0.82);
  s.quadraticCurveTo(-hw * 0.68, -dropH * 0.42, -hw, -dropH * 0.78);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
    curveSegments: 16,
  });
  geo.translate(0, 0, -thickness * 0.5);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Molded French baker's dresser hutch overhanging crown cornice (bottom strictly flush at y = 0).
 */
export function createScallopedHutchCorniceGeometry(
  width = 1.12,
  height = 0.11,
  depth = 0.34
): THREE.BufferGeometry {
  const geo = createBeveledBoxGeometry(width, height * 0.62, depth, 0.012, 0.008, 0.008, 3);
  geo.translate(0, height * 0.62 * 0.5 + height * 0.38, 0);
  const sub = createBeveledBoxGeometry(width - 0.05, height * 0.38, depth - 0.035, 0.010, 0.006, 0.006, 2);
  sub.translate(0, height * 0.38 * 0.5, -0.012);
  const merged = mergePartsSafely([geo, sub]);
  geo.dispose();
  sub.dispose();
  merged.computeVertexNormals();
  return merged;
}

/**
 * Storybook gabled oak cat cubby enclosure with arched front cat doorway (bottom strictly flush at y = 0).
 */
export function createGableCatHouseGeometry(
  width = 0.44,
  wallH = 0.22,
  peakH = 0.39,
  depth = 0.42
): THREE.BufferGeometry {
  const hw = width * 0.5;
  const s = new THREE.Shape();
  s.moveTo(-hw, 0);
  s.lineTo(hw, 0);
  s.lineTo(hw, wallH);
  s.lineTo(0, peakH);
  s.lineTo(-hw, wallH);
  s.closePath();

  const doorW = hw * 0.54;
  const doorSpring = wallH * 0.56;
  const hole = new THREE.Path();
  hole.moveTo(-doorW, 0.022);
  hole.lineTo(doorW, 0.022);
  hole.lineTo(doorW, doorSpring);
  hole.absarc(0, doorSpring, doorW, 0, Math.PI, false);
  hole.closePath();
  s.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 20,
  });
  geo.translate(0, 0.008, -depth * 0.5);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Plump tied linen baker's flour sack (FARINE T45) with cinched neck ruffle (bottom flush at y = 0).
 */
export function createTiedFlourSackGeometry(
  radius = 0.085,
  height = 0.21
): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0002, 0.0),
    new THREE.Vector2(radius * 0.78, 0.004),
    new THREE.Vector2(radius * 1.02, height * 0.22),
    new THREE.Vector2(radius * 0.96, height * 0.54),
    new THREE.Vector2(radius * 0.44, height * 0.76),
    new THREE.Vector2(radius * 0.28, height * 0.82),
    new THREE.Vector2(radius * 0.56, height * 0.96),
    new THREE.Vector2(radius * 0.42, height),
    new THREE.Vector2(0.0002, height * 0.90),
  ];
  const geo = createSeamlessLatheGeometry(pts, 24);
  geo.scale(1.0, 1.0, 0.72);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Teardrop sculpted French garden strawberry (base/apex grounded at y = 0, crown at y = height).
 */
export function createMiniStrawberryGeometry(
  radius = 0.015,
  height = 0.025
): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0002, 0.0),
    new THREE.Vector2(radius * 0.30, height * 0.08),
    new THREE.Vector2(radius * 0.68, height * 0.26),
    new THREE.Vector2(radius * 0.96, height * 0.52),
    new THREE.Vector2(radius * 1.00, height * 0.72),
    new THREE.Vector2(radius * 0.80, height * 0.88),
    new THREE.Vector2(radius * 0.44, height * 0.97),
    new THREE.Vector2(0.0002, height),
  ];
  const geo = createSeamlessLatheGeometry(pts, 20);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const acheneRipple = 1.0 + 0.03 * Math.sin(a * 9.0 + y * 420.0);
    pos.setXYZ(i, x * acheneRipple, y, z * acheneRipple * 0.94);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * 5-lobed fresh strawberry green calyx star resting atop crown.
 */
export function createStrawberryCalyxGeometry(radius = 0.013): THREE.BufferGeometry {
  const star = new THREE.Shape();
  const lobes = 5;
  for (let i = 0; i < lobes * 2; i++) {
    const ang = (i / (lobes * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? radius : radius * 0.36;
    const px = Math.cos(ang) * r;
    const py = Math.sin(ang) * r;
    if (i === 0) star.moveTo(px, py);
    else star.lineTo(px, py);
  }
  star.closePath();
  const geo = new THREE.ExtrudeGeometry(star, {
    depth: 0.0014,
    bevelEnabled: true,
    bevelThickness: 0.0005,
    bevelSize: 0.0004,
    bevelSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    pos.setY(i, y - r * r * 14.0);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Thin delicate curled ivory white-chocolate shaving ribbon (replaces dark shiny pipe curl).
 */
export function createWhiteChocCurlFlakeGeometry(
  width = 0.018,
  length = 0.036
): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(width, length, 4, 14);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const t = (py / length) + 0.5; // 0..1
    const curlAngle = t * Math.PI * 1.45;
    const rCurl = 0.012 - t * 0.003;
    const ny = rCurl * Math.sin(curlAngle);
    const nz = rCurl * (1.0 - Math.cos(curlAngle));
    pos.setXYZ(i, px * (1.0 - 0.18 * Math.abs(t - 0.5)), Math.max(0, ny), nz - rCurl * 0.5);
  }
  geo.computeVertexNormals();
  return geo;
}
