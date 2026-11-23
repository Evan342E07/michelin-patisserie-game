export type InteractiveStationId =
  | 'sieve'
  | 'jfold'
  | 'oven_dial'
  | 'pot'
  | 'marble'
  | 'turntable'
  | 'glaze'
  | 'knife';

export interface DragPoint {
  x: number;
  y: number;
}

export interface JFoldEvaluation {
  isTap: boolean;
  shapeValid: boolean;
  accuracy: number;
}

/**
 * Evaluates raw pointer drag distance (in pixels) for tactile 3D culinary actions
 * so rapid frantic swiping on the brass sieve penalizes foam purity while smooth motion progresses cleanly.
 */
export function computeStationDragDelta(station: InteractiveStationId, pixelDistance: number) {
  switch (station) {
    case 'sieve': {
      const harshness = Math.min(1, Math.max(0, (pixelDistance - 18) / 36));
      return {
        amount: Math.min(0.08, pixelDistance * 0.0032),
        harshness,
      };
    }
    case 'jfold':
      return {
        amount: pixelDistance,
        harshness: Math.min(1, Math.max(0, (pixelDistance - 24) / 40)),
      };
    case 'oven_dial':
      return {
        amount: pixelDistance,
        harshness: 0,
      };
    case 'pot':
      return {
        amount: Math.min(0.95, pixelDistance * 0.025),
        harshness: 0,
      };
    case 'marble':
      return {
        amount: Math.min(1.1, pixelDistance * 0.024),
        harshness: 0,
      };
    case 'turntable':
      return {
        amount: Math.min(0.075, pixelDistance * 0.0022),
        harshness: 0,
      };
    case 'glaze':
    case 'knife':
      return {
        amount: pixelDistance,
        harshness: 0,
      };
  }
}

/**
 * Evaluates a discrete pointer polyline on the 3D bowl (or HUD pad) for a real French macaronnage J-fold:
 * requires sufficient path length, 2D breadth, and an actual hooked turn rather than a straight cut line.
 */
export function evaluateJFoldPolyline(
  points: readonly DragPoint[],
  avgSegmentSpeed = 12
): JFoldEvaluation {
  if (points.length < 3) {
    return { isTap: true, shapeValid: false, accuracy: 0 };
  }

  let totalLen = 0;
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  for (let i = 1; i < points.length; i++) {
    const seg = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    totalLen += seg;
    if (points[i].x < minX) minX = points[i].x;
    if (points[i].x > maxX) maxX = points[i].x;
    if (points[i].y < minY) minY = points[i].y;
    if (points[i].y > maxY) maxY = points[i].y;
  }

  if (totalLen < 20) {
    return { isTap: true, shapeValid: false, accuracy: 0 };
  }

  const start = points[0];
  const end = points[points.length - 1];
  const chordX = end.x - start.x;
  const chordY = end.y - start.y;
  const chordLen = Math.hypot(chordX, chordY);

  const dxSpan = maxX - minX;
  const dySpan = maxY - minY;

  let maxPerp = 0;
  if (chordLen > 1e-4) {
    for (let i = 1; i < points.length - 1; i++) {
      const px = points[i].x - start.x;
      const py = points[i].y - start.y;
      const perp = Math.abs(px * chordY - py * chordX) / chordLen;
      if (perp > maxPerp) maxPerp = perp;
    }
  }

  const mid = points[Math.floor(points.length * 0.55)];
  const v1x = mid.x - start.x;
  const v1y = mid.y - start.y;
  const v2x = end.x - mid.x;
  const v2y = end.y - mid.y;
  const l1 = Math.hypot(v1x, v1y);
  const l2 = Math.hypot(v2x, v2y);
  let turnAngleDeg = 0;
  if (l1 > 4 && l2 > 4) {
    const cosT = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (l1 * l2)));
    turnAngleDeg = (Math.acos(cosT) * 180) / Math.PI;
  }

  const straightness = chordLen / totalLen;
  const hasCurvedHook =
    turnAngleDeg >= 28 || maxPerp >= 11 || (straightness <= 0.88 && Math.min(dxSpan, dySpan) >= 14);

  if (totalLen < 38 || Math.min(dxSpan, dySpan) < 12 || !hasCurvedHook) {
    return { isTap: false, shapeValid: false, accuracy: 0.48 };
  }

  const hookIdeal = 1.0 - Math.min(1, Math.abs(turnAngleDeg - 92) / 95) * 0.18;
  const perpRatio = maxPerp / totalLen;
  const arcBalance = 1.0 - Math.min(1, Math.abs(perpRatio - 0.22) / 0.35) * 0.14;
  const speedPenalty = Math.max(0, (avgSegmentSpeed - 22) / 48) * 0.16;
  const accuracy = Math.max(0.65, Math.min(0.99, hookIdeal * arcBalance - speedPenalty));

  return { isTap: false, shapeValid: true, accuracy };
}

/**
 * Computes generous coaxial insert precision (0.10..1.0) on the Step 5 mousse ring:
 * - Inside the golden bullseye core (`normR <= 0.22`): smooth magnetic assist (`0.94..1.00`)
 * - Within inner insert disk (`normR <= 0.68`): balanced craft score (`0.68..0.94`)
 * - Anywhere else inside the stainless mousse ring (`normR <= 0.98`): forgiving score floor (`>= 0.58`)
 * - Outside the ring rim (`normR > 1.02`): steep drop (< 0.16 rejection zone)
 */
export function computeCoaxialInsertPrecision(dx: number, dz: number, ringRadius = 0.181): number {
  const r = Math.hypot(dx, dz);
  const normR = r / Math.max(0.05, ringRadius);
  if (normR <= 0.22) {
    return Number((1.0 - (normR / 0.22) * 0.06).toFixed(3));
  }
  if (normR <= 0.68) {
    return Number((0.94 - ((normR - 0.22) / 0.46) * 0.26).toFixed(3));
  }
  if (normR <= 1.00) {
    return Number((0.68 - ((normR - 0.68) / 0.32) * 0.10).toFixed(3));
  }
  return Number(Math.max(0.08, 0.50 - ((normR - 1.00) / 0.30) * 0.38).toFixed(3));
}

/**
 * Applies smooth magnetic snap-assist pull toward the Step 5 mousse ring bullseye center `(0, 0)`
 * so the golden live aiming reticle settles effortlessly onto the target center.
 */
export function computeMagneticReticleXZ(
  lx: number,
  lz: number,
  ringRadius = 0.181
): [number, number] {
  const r = Math.hypot(lx, lz);
  const normR = r / Math.max(0.05, ringRadius);
  if (normR <= 0.14) {
    return [lx * 0.18, lz * 0.18];
  }
  if (normR <= 0.44) {
    const pull = 0.18 + ((normR - 0.14) / 0.30) * 0.72;
    return [lx * pull, lz * pull];
  }
  return [lx, lz];
}

/**
 * Computes garnish placement accuracy (0.64..0.99) for direct clicks on the Step 7 Hero Cake top.
 */
export function computeGarnishPlacementPrecision(dx: number, dz: number, garnishStep: number): number {
  const r = Math.hypot(dx, dz);
  const targetRadii = [0.095, 0.06, 0.075, 0.0];
  const idealR = targetRadii[Math.min(3, Math.max(0, garnishStep))];
  const radialErr = Math.abs(r - idealR);
  return Number(Math.max(0.64, Math.min(0.99, 0.99 - radialErr * 1.9)).toFixed(3));
}
