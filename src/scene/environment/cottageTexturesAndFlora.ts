import * as THREE from 'three';

function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function heightToNormalCanvas(
  height: Float32Array,
  w: number,
  h: number,
  strength: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);

  for (let y = 0; y < h; y++) {
    const ym = (y - 1 + h) % h;
    const yp = (y + 1) % h;
    for (let x = 0; x < w; x++) {
      const xm = (x - 1 + w) % w;
      const xp = (x + 1) % w;
      const dx = (height[y * w + xp] - height[y * w + xm]) * strength;
      // Three.js CanvasTexture uses flipY = true (row 0 sits at v = 1), so +v points toward ym = y - 1
      const dy = (height[ym * w + x] - height[yp * w + x]) * strength;
      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const inv = 1.0 / (Math.hypot(nx, ny, nz) || 1.0);
      nx *= inv;
      ny *= inv;
      nz *= inv;
      const idx = (y * w + x) * 4;
      img.data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      img.data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      img.data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  return tex;
}

function drawStainedRose(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  petalOuter: string,
  petalInner: string,
  centerGold: string
) {
  const petals = 5;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 - Math.PI / 2;
    const px = cx + Math.cos(a) * r * 0.52;
    const py = cy + Math.sin(a) * r * 0.52;
    const g = ctx.createRadialGradient(px, py, r * 0.08, px, py, r * 0.56);
    g.addColorStop(0, petalInner);
    g.addColorStop(1, petalOuter);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2B2825';
    ctx.lineWidth = 2.4;
    ctx.stroke();
  }
  ctx.fillStyle = centerGold;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2B2825';
  ctx.lineWidth = 2.2;
  ctx.stroke();
}

function drawStainedLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  angle: number,
  c1 = 'rgba(82, 152, 74, 0.88)',
  c2 = 'rgba(46, 108, 54, 0.90)'
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const g = ctx.createLinearGradient(0, 0, len, 0);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2B2825';
  ctx.lineWidth = 2.0;
  ctx.stroke();
  ctx.restore();
}

/**
 * 1. Art-Nouveau / Tiffany Floral Stained-Glass Arch Window Texture (`2fb763f6` Inspiration!)
 * Features wild pink roses, amber blossoms, emerald leaves in curved lead cames + clear seeded center.
 */
function createTiffanyStainedGlassTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 768;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(202611);

  ctx.clearRect(0, 0, w, h);

  // Subtle warm seeded-glass center so garden trees & sky shine cleanly through!
  const clearGrad = ctx.createLinearGradient(0, 0, w, h);
  clearGrad.addColorStop(0, 'rgba(255, 250, 236, 0.16)');
  clearGrad.addColorStop(0.5, 'rgba(248, 252, 244, 0.10)');
  clearGrad.addColorStop(1, 'rgba(255, 244, 224, 0.18)');
  ctx.fillStyle = clearGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle seeded glass micro-bubbles & cathedral ripples
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h, 1.2 + rand() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Outer frosted amber-ivory stained border band (`bw = 62px`)
  const bw = 64;
  ctx.fillStyle = 'rgba(252, 238, 204, 0.72)';
  ctx.fillRect(0, 0, w, bw * 1.35);
  ctx.fillRect(0, h - bw, w, bw);
  ctx.fillRect(0, 0, bw, h);
  ctx.fillRect(w - bw, 0, bw, h);

  // Fine interior diamond/grid lead cames
  ctx.strokeStyle = 'rgba(46, 44, 40, 0.55)';
  ctx.lineWidth = 2.0;
  for (let gx = bw; gx <= w - bw; gx += (w - bw * 2) / 3) {
    ctx.beginPath();
    ctx.moveTo(gx, bw * 1.35);
    ctx.lineTo(gx, h - bw);
    ctx.stroke();
  }
  for (let gy = bw * 1.35; gy <= h - bw; gy += (h - bw * 2.35) / 4) {
    ctx.beginPath();
    ctx.moveTo(bw, gy);
    ctx.lineTo(w - bw, gy);
    ctx.stroke();
  }

  // Double lead border lines
  ctx.strokeStyle = '#2B2825';
  ctx.lineWidth = 3.2;
  ctx.strokeRect(bw, bw * 1.35, w - bw * 2, h - bw * 2.35);
  ctx.strokeRect(8, 8, w - 16, h - 16);

  // Curved Art-Nouveau vine stems along left, right & top crown
  ctx.strokeStyle = '#2D4828';
  ctx.lineWidth = 3.0;
  [bw * 0.5, w - bw * 0.5].forEach((vx, sideIdx) => {
    ctx.beginPath();
    ctx.moveTo(vx, h - 24);
    for (let y = h - 40; y >= 50; y -= 64) {
      const sway = Math.sin(y * 0.03 + sideIdx * 2.0) * 14;
      ctx.lineTo(vx + sway, y);
    }
    ctx.stroke();
  });

  // Top Crown Garland of Roses & Amber Medallions (`2fb763f6` Arch Crown!)
  const topRoses: Array<[number, number, number, boolean]> = [
    [w * 0.5, 44, 30, true],
    [w * 0.27, 48, 24, false],
    [w * 0.73, 48, 24, false],
    [42, 48, 22, true],
    [w - 42, 48, 22, true],
  ];
  topRoses.forEach(([rx, ry, rr, isPink]) => {
    drawStainedLeaf(ctx, rx - rr * 0.7, ry + 4, rr * 1.05, Math.PI * 0.85);
    drawStainedLeaf(ctx, rx + rr * 0.7, ry + 4, rr * 1.05, Math.PI * 0.15);
    drawStainedRose(
      ctx,
      rx,
      ry,
      rr,
      isPink ? 'rgba(232, 118, 152, 0.90)' : 'rgba(242, 184, 72, 0.90)',
      isPink ? 'rgba(252, 198, 214, 0.92)' : 'rgba(255, 232, 158, 0.92)',
      'rgba(246, 192, 58, 0.95)'
    );
  });

  // Left & Right Vertical Stained-Glass Rose & Leaf Motifs
  const sideYs = [155, 285, 415, 545, 665];
  sideYs.forEach((sy, idx) => {
    const isPink = idx % 2 === 0;
    [32, w - 32].forEach((sx, sIdx) => {
      drawStainedLeaf(ctx, sx, sy - 26, 26, -Math.PI * 0.35 + sIdx * 0.4);
      drawStainedLeaf(ctx, sx, sy + 24, 26, Math.PI * 0.38 - sIdx * 0.4);
      drawStainedRose(
        ctx,
        sx,
        sy,
        21,
        isPink ? 'rgba(234, 122, 156, 0.90)' : 'rgba(240, 182, 70, 0.88)',
        isPink ? 'rgba(254, 206, 220, 0.92)' : 'rgba(255, 234, 168, 0.92)',
        'rgba(242, 184, 52, 0.95)'
      );
    });
  });

  // Bottom border blossoms
  [w * 0.25, w * 0.5, w * 0.75].forEach((bx, idx) => {
    drawStainedLeaf(ctx, bx - 18, h - 32, 24, Math.PI * 0.95);
    drawStainedLeaf(ctx, bx + 18, h - 32, 24, Math.PI * 0.05);
    drawStainedRose(
      ctx,
      bx,
      h - 32,
      20,
      idx === 1 ? 'rgba(232, 118, 152, 0.90)' : 'rgba(136, 168, 226, 0.88)',
      idx === 1 ? 'rgba(252, 204, 218, 0.92)' : 'rgba(206, 224, 252, 0.92)',
      'rgba(246, 192, 58, 0.95)'
    );
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * 2. Horizontal Tiffany Floral Transom Texture (above Bi-Fold Veranda Doors!)
 */
function createTiffanyTransomTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(252, 242, 216, 0.52)';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#2B2825';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(w, 6);
  ctx.moveTo(0, h - 6);
  ctx.lineTo(w, h - 6);
  ctx.stroke();

  // Flowing horizontal vine wave (periodic across width w for RepeatWrapping)
  ctx.strokeStyle = '#35582E';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.5);
  for (let x = 0; x <= w; x += 16) {
    ctx.lineTo(x, h * 0.5 + Math.sin((x / w) * Math.PI * 4) * 16);
  }
  ctx.stroke();

  [64, 160, 256, 352, 448].forEach((rx, idx) => {
    const ry = h * 0.5 + Math.sin((rx / w) * Math.PI * 4) * 12;
    drawStainedLeaf(ctx, rx - 22, ry, 26, Math.PI * 0.9);
    drawStainedLeaf(ctx, rx + 22, ry, 26, Math.PI * 0.1);
    drawStainedRose(
      ctx,
      rx,
      ry,
      idx === 2 ? 25 : 20,
      idx % 2 === 0 ? 'rgba(234, 120, 154, 0.90)' : 'rgba(242, 186, 74, 0.90)',
      idx % 2 === 0 ? 'rgba(254, 206, 220, 0.92)' : 'rgba(255, 236, 172, 0.92)',
      'rgba(245, 190, 56, 0.95)'
    );
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(4.5, 1);
  tex.anisotropy = 8;
  return tex;
}

/**
 * 2B. Perimeter Botanical Stained-Glass Border Mosaic (`85918c0f` Bold Floral Cames & Jewel Glass!)
 * Rich deep roses, golden buttercups, emerald foliage & amber edge tiles framed in bold charcoal lead cames.
 */
function createBotanicalBorderGlassTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(859180);

  // Warm champagne-honey cathedral glass mosaic base (high contrast against bright daylight!)
  const bg = ctx.createLinearGradient(0, 0, w, 0);
  bg.addColorStop(0, 'rgba(222, 166, 54, 0.94)');
  bg.addColorStop(0.18, 'rgba(250, 232, 186, 0.92)');
  bg.addColorStop(0.82, 'rgba(250, 232, 186, 0.92)');
  bg.addColorStop(1, 'rgba(222, 166, 54, 0.94)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Hand-rolled cathedral glass ripples
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.16)' : 'rgba(218, 172, 82, 0.16)';
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h, 2.0 + rand() * 3.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Deep amber-gold stained outer margin bands + bold charcoal lead cames
  ctx.fillStyle = 'rgba(216, 152, 42, 0.72)';
  ctx.fillRect(0, 0, 32, h);
  ctx.fillRect(w - 32, 0, 32, h);

  ctx.strokeStyle = '#181614';
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.moveTo(5, 0);
  ctx.lineTo(5, h);
  ctx.moveTo(32, 0);
  ctx.lineTo(32, h);
  ctx.moveTo(w - 32, 0);
  ctx.lineTo(w - 32, h);
  ctx.moveTo(w - 5, 0);
  ctx.lineTo(w - 5, h);
  ctx.stroke();

  // Horizontal lead cames dividing 4 crisp botanical mosaic cells along V
  const cells = 4;
  const cellH = h / cells;
  ctx.lineWidth = 5.5;
  for (let i = 0; i <= cells; i++) {
    const gy = i * cellH;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
  }

  // Deep forest vine stem connecting all 4 cells cleanly
  ctx.strokeStyle = '#1E4620';
  ctx.lineWidth = 6.0;
  ctx.beginPath();
  for (let y = 0; y <= h; y += 16) {
    const vx = w * 0.5 + Math.sin((y / h) * Math.PI * 4) * 20;
    if (y === 0) ctx.moveTo(vx, y);
    else ctx.lineTo(vx, y);
  }
  ctx.stroke();

  for (let i = 0; i < cells; i++) {
    const cy = (i + 0.5) * cellH;
    const isPink = i % 2 === 0;
    const cx = w * 0.5 + (isPink ? -5 : 5);
    drawStainedLeaf(ctx, cx - 10, cy - 58, 54, -Math.PI * 0.62, 'rgba(66, 148, 62, 0.96)', 'rgba(32, 92, 38, 0.98)');
    drawStainedLeaf(ctx, cx + 10, cy + 58, 54, Math.PI * 0.36, 'rgba(66, 148, 62, 0.96)', 'rgba(32, 92, 38, 0.98)');
    drawStainedLeaf(ctx, cx + 14, cy - 42, 46, -Math.PI * 0.24, 'rgba(84, 162, 74, 0.96)', 'rgba(42, 108, 46, 0.98)');
    drawStainedLeaf(ctx, cx - 14, cy + 44, 46, Math.PI * 0.72, 'rgba(84, 162, 74, 0.96)', 'rgba(42, 108, 46, 0.98)');
    drawStainedRose(
      ctx,
      cx,
      cy,
      isPink ? 56 : 50,
      isPink ? 'rgba(202, 44, 96, 0.98)' : 'rgba(218, 128, 14, 0.98)',
      isPink ? 'rgba(248, 132, 168, 0.98)' : 'rgba(255, 212, 72, 0.98)',
      'rgba(248, 192, 38, 0.99)'
    );
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/**
 * 2C. French Portal Door Stained-Glass Floral Oval Medallion (`85918c0f` Door Leaf!)
 * Clear seeded hammered glass with iron cross-bars and centered Art-Nouveau botanical oval panel.
 */
function createBotanicalDoorMedallionTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(859181);

  // Nearly crystal-clear lightly hammered door glass surround so garden vistas shine brightly
  ctx.fillStyle = 'rgba(252, 248, 238, 0.20)';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 180; i++) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h, 1.5 + rand() * 3.0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Slender wrought-iron outer rectangular pane dividers around oval medallion
  ctx.strokeStyle = 'rgba(38, 35, 32, 0.84)';
  ctx.lineWidth = 4;
  ctx.strokeRect(22, 22, w - 44, h - 44);
  [210, 770].forEach((gy) => {
    ctx.beginPath();
    ctx.moveTo(22, gy);
    ctx.lineTo(w - 22, gy);
    ctx.stroke();
  });
  ctx.beginPath();
  ctx.moveTo(w * 0.5, 22);
  ctx.lineTo(w * 0.5, 210);
  ctx.moveTo(w * 0.5, 770);
  ctx.lineTo(w * 0.5, h - 22);
  ctx.stroke();

  // Centered Oval Stained-Glass Medallion (`cx=256, cy=490, rx=164, ry=274`)
  const cx = w * 0.5;
  const cy = 490;
  const rx = 164;
  const ry = 274;

  // Deep amber-gold stained oval ring
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(222, 162, 46, 0.94)';
  ctx.fill();
  ctx.lineWidth = 7.5;
  ctx.strokeStyle = '#181614';
  ctx.stroke();

  // Warm backlit cathedral ivory inner medallion field
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - 24, ry - 26, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(250, 236, 198, 0.90)';
  ctx.fill();
  ctx.lineWidth = 5.5;
  ctx.strokeStyle = '#181614';
  ctx.stroke();
  ctx.clip();

  // Crisp botanical sunburst lead cames inside medallion
  ctx.strokeStyle = 'rgba(28, 25, 22, 0.62)';
  ctx.lineWidth = 3.2;
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * 320, cy + Math.sin(ang) * 320);
    ctx.stroke();
  }

  // Deep forest green climbing rose stem + rich emerald leaves
  ctx.strokeStyle = '#1D461E';
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy + 230);
  ctx.quadraticCurveTo(cx + 28, cy + 70, cx - 6, cy - 30);
  ctx.quadraticCurveTo(cx - 32, cy - 110, cx + 6, cy - 185);
  ctx.stroke();

  const leafSpots: Array<[number, number, number, number]> = [
    [cx - 12, cy + 160, 58, -2.5],
    [cx + 12, cy + 120, 62, -0.45],
    [cx - 24, cy + 36, 64, -2.65],
    [cx + 20, cy - 18, 58, -0.35],
    [cx - 26, cy - 102, 54, -2.55],
    [cx + 18, cy - 135, 50, -0.42],
  ];
  leafSpots.forEach(([lx, ly, llen, lang]) => {
    drawStainedLeaf(ctx, lx, ly, llen, lang, 'rgba(66, 150, 64, 0.96)', 'rgba(30, 90, 36, 0.98)');
  });

  // High-Contrast Jewel Wild Rose Blossoms
  drawStainedRose(ctx, cx + 6, cy - 165, 54, 'rgba(202, 42, 92, 0.98)', 'rgba(248, 134, 170, 0.98)', 'rgba(248, 192, 36, 0.99)');
  drawStainedRose(ctx, cx - 34, cy - 42, 62, 'rgba(196, 34, 86, 0.98)', 'rgba(246, 122, 162, 0.98)', 'rgba(248, 196, 40, 0.99)');
  drawStainedRose(ctx, cx + 38, cy + 56, 52, 'rgba(218, 132, 18, 0.98)', 'rgba(255, 210, 74, 0.98)', 'rgba(228, 138, 18, 0.99)');
  drawStainedRose(ctx, cx - 12, cy + 128, 44, 'rgba(204, 46, 98, 0.98)', 'rgba(248, 136, 172, 0.98)', 'rgba(248, 192, 38, 0.99)');

  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * 2D. Botanical Stained-Glass Tracery for Upper Clerestory Square Grid Panes (`y = 2.99..3.54`)
 * Keeps the central diamond clear for sunlit sky while framing all 4 pane corners with floral lead cames!
 */
function createTransomFloralGlassTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(859182);

  // Crystal-clear lightly seeded central glass
  ctx.fillStyle = 'rgba(255, 251, 240, 0.16)';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, 1.2 + rand() * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Warm amber-honey & champagne perimeter frame around clear central diamond-arch opening
  const b = 42;
  ctx.fillStyle = 'rgba(246, 220, 158, 0.90)';
  ctx.fillRect(0, 0, size, b);
  ctx.fillRect(0, size - b, size, b);
  ctx.fillRect(0, 0, b, size);
  ctx.fillRect(size - b, 0, b, size);

  // Scalloped amber corner spandrels
  [
    [0, 0],
    [size, 0],
    [0, size],
    [size, size],
  ].forEach(([cx, cy]) => {
    ctx.fillStyle = 'rgba(222, 162, 46, 0.92)';
    ctx.beginPath();
    ctx.arc(cx, cy, 82, 0, Math.PI * 2);
    ctx.fill();
  });

  // Re-clear central octagonal daylight opening cleanly before drawing lead lines
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(b + 26, b);
  ctx.lineTo(size - b - 26, b);
  ctx.lineTo(size - b, b + 26);
  ctx.lineTo(size - b, size - b - 26);
  ctx.lineTo(size - b - 26, size - b);
  ctx.lineTo(b + 26, size - b);
  ctx.lineTo(b, size - b - 26);
  ctx.lineTo(b, b + 26);
  ctx.closePath();
  ctx.clearRect(b + 14, b + 14, size - (b + 14) * 2, size - (b + 14) * 2);
  ctx.fillStyle = 'rgba(255, 251, 240, 0.16)';
  ctx.fill();
  ctx.lineWidth = 5.0;
  ctx.strokeStyle = '#181614';
  ctx.stroke();
  ctx.restore();

  // Outer perimeter & corner lead cames
  ctx.strokeStyle = '#181614';
  ctx.lineWidth = 5.5;
  ctx.strokeRect(3, 3, size - 6, size - 6);
  ctx.beginPath();
  ctx.moveTo(size * 0.5, 0);
  ctx.lineTo(size * 0.5, b);
  ctx.moveTo(size * 0.5, size - b);
  ctx.lineTo(size * 0.5, size);
  ctx.moveTo(0, size * 0.5);
  ctx.lineTo(b, size * 0.5);
  ctx.moveTo(size - b, size * 0.5);
  ctx.lineTo(size, size * 0.5);
  ctx.stroke();

  // Four corner botanical stained-glass florets + emerald leaves
  const corners: Array<[number, number, boolean, number]> = [
    [36, 36, true, 0.78],
    [size - 36, 36, false, 2.35],
    [36, size - 36, false, -0.78],
    [size - 36, size - 36, true, -2.35],
  ];
  corners.forEach(([fx, fy, isPink, leafAng]) => {
    drawStainedLeaf(ctx, fx, fy, 42, leafAng - 0.55, 'rgba(66, 150, 64, 0.96)', 'rgba(30, 90, 36, 0.98)');
    drawStainedLeaf(ctx, fx, fy, 42, leafAng + 0.55, 'rgba(66, 150, 64, 0.96)', 'rgba(30, 90, 36, 0.98)');
    drawStainedRose(
      ctx,
      fx,
      fy,
      28,
      isPink ? 'rgba(202, 42, 92, 0.98)' : 'rgba(218, 132, 18, 0.98)',
      isPink ? 'rgba(248, 134, 170, 0.98)' : 'rgba(255, 210, 74, 0.98)',
      'rgba(248, 192, 36, 0.99)'
    );
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * 2E. Radial Botanical Stained-Glass Rose Window Texture (`r = 0.38m` North & South Gable Windows)
 */
function createCircularRoseGlassTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size * 0.5;
  const cy = size * 0.5;

  ctx.clearRect(0, 0, size, size);

  // Outer amber & champagne floral ring
  ctx.beginPath();
  ctx.arc(cx, cy, 248, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(222, 162, 46, 0.94)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, 222, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(250, 232, 186, 0.92)';
  ctx.fill();

  // Clear inner radial daylight circle (`r = 148`)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 146, 0, Math.PI * 2);
  ctx.clip();
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(255, 251, 240, 0.20)';
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  // Radial charcoal lead spokes & concentric rings
  ctx.strokeStyle = '#181614';
  ctx.lineWidth = 5.5;
  [146, 222, 246].forEach((rr) => {
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.stroke();
  });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 44, cy + Math.sin(a) * 44);
    ctx.lineTo(cx + Math.cos(a) * 246, cy + Math.sin(a) * 246);
    ctx.stroke();
  }

  // 8 Alternating Wild Roses & Golden Buttercups around perimeter ring
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2;
    const fx = cx + Math.cos(a) * 184;
    const fy = cy + Math.sin(a) * 184;
    const isPink = i % 2 === 0;
    drawStainedLeaf(ctx, fx, fy, 42, a + Math.PI * 0.5, 'rgba(66, 150, 64, 0.96)', 'rgba(30, 90, 36, 0.98)');
    drawStainedLeaf(ctx, fx, fy, 42, a - Math.PI * 0.5, 'rgba(66, 150, 64, 0.96)', 'rgba(30, 90, 36, 0.98)');
    drawStainedRose(
      ctx,
      fx,
      fy,
      30,
      isPink ? 'rgba(202, 42, 92, 0.98)' : 'rgba(218, 132, 18, 0.98)',
      isPink ? 'rgba(248, 134, 170, 0.98)' : 'rgba(255, 210, 74, 0.98)',
      'rgba(248, 192, 36, 0.99)'
    );
  }

  // Center jewel rosette medallion
  drawStainedRose(ctx, cx, cy, 42, 'rgba(202, 42, 92, 0.96)', 'rgba(248, 134, 170, 0.98)', 'rgba(248, 192, 36, 0.99)');

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * 3. French Pastoral Hand-Painted Botanical Wallpaper (`2fb763f6` & `f4a71928` Inspiration!)
 */
function createBotanicalWallpaperTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(8472);

  ctx.fillStyle = '#F5EFE0';
  ctx.fillRect(0, 0, size, size);

  // Subtle warm paper fiber wash
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(236, 226, 204, 0.24)' : 'rgba(252, 248, 238, 0.22)';
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, 16 + rand() * 34, 0, Math.PI * 2);
    ctx.fill();
  }

  // Delicate meandering sage vines & tiny wild rose / chamomile motifs (tileable grid)
  const cols = 4;
  const step = size / cols;
  for (let gx = 0; gx < cols; gx++) {
    const cx = gx * step + step * 0.5;
    ctx.strokeStyle = 'rgba(118, 146, 102, 0.38)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    for (let y = 0; y <= size; y += 8) {
      const x = cx + Math.sin((y / size) * Math.PI * 4 + gx * 1.5) * 22;
      if (y === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    for (let gy = 0; gy < 4; gy++) {
      const fy = gy * step + ((gx % 2) * step * 0.5 + 32) % size;
      const fx = cx + Math.sin((fy / size) * Math.PI * 4 + gx * 1.5) * 22;

      // Tiny sage leaves
      ctx.fillStyle = 'rgba(116, 148, 98, 0.42)';
      [-1, 1].forEach((dir) => {
        ctx.save();
        ctx.translate(fx + dir * 8, fy + 8);
        ctx.rotate(dir * 0.65);
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Soft blush rosebud or buttercup blossom
      const isRose = (gx + gy) % 2 === 0;
      ctx.fillStyle = isRose ? 'rgba(224, 142, 152, 0.52)' : 'rgba(232, 192, 98, 0.48)';
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(fx + Math.cos(a) * 5.5, fy + Math.sin(a) * 5.5, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(244, 212, 118, 0.65)';
      ctx.beginPath();
      ctx.arc(fx, fy, 3.0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4.5, 1.8);
  tex.anisotropy = 8;
  return tex;
}

/**
 * 4. Vertical Distressed Cream Beadboard Wainscoting + Normal Map (`f95ce79d` & `230f538a`)
 */
function createBeadboardWainscotSet() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(5150);
  const height = new Float32Array(size * size);

  const planks = 8;
  const pw = size / planks;
  for (let p = 0; p < planks; p++) {
    const x0 = p * pw;
    ctx.fillStyle = p % 2 === 0 ? '#F5ECDA' : '#EEE3CC';
    ctx.fillRect(x0, 0, pw, size);

    // Shadowed V-groove + center bead line
    ctx.fillStyle = '#8C5B32';
    ctx.fillRect(x0, 0, 3, size);
    ctx.fillStyle = 'rgba(168, 134, 96, 0.28)';
    ctx.fillRect(x0 + pw * 0.5, 0, 2, size);

    // Subtle vintage chippy wood wear along plank edges
    for (let k = 0; k < 14; k++) {
      ctx.fillStyle = 'rgba(152, 98, 52, 0.45)';
      ctx.fillRect(x0 + (rand() < 0.5 ? 2 : pw - 6), rand() * size, 2 + rand() * 4, 10 + rand() * 32);
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const lx = x % pw;
      const groove = lx < 4 ? lx / 4 : lx > pw - 3 ? (pw - lx) / 3 : 1.0;
      const midBead = Math.abs(lx - pw * 0.5) < 2.2 ? 0.85 : 1.0;
      height[y * size + x] = groove * midBead;
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(5, 1);
  map.anisotropy = 8;

  const normalMap = heightToNormalCanvas(height, size, size, 2.4, 5, 1);
  return { map, normalMap };
}

/**
 * 5. Honey-Pine Tongue-and-Groove Roof Plank Set (`29686ab3` & `f4a71928`)
 */
function createTongueAndGroovePineSet() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(9912);
  const height = new Float32Array(size * size);

  const planks = 8;
  const ph = size / planks;
  for (let p = 0; p < planks; p++) {
    const y0 = p * ph;
    const baseColors = ['#C48B52', '#BA8048', '#CB935B', '#B47942'];
    ctx.fillStyle = baseColors[p % baseColors.length];
    ctx.fillRect(0, y0, size, ph);

    // Warm pine grain streaks & occasional pine knot
    for (let g = 0; g < 22; g++) {
      ctx.fillStyle = g % 2 === 0 ? 'rgba(132, 78, 36, 0.16)' : 'rgba(238, 196, 142, 0.14)';
      ctx.fillRect(0, y0 + rand() * ph, size, 1.5 + rand() * 2.5);
    }
    const kx = 48 + rand() * (size - 96);
    const ky = y0 + 14 + rand() * (ph - 28);
    ctx.fillStyle = 'rgba(112, 62, 26, 0.42)';
    ctx.beginPath();
    ctx.ellipse(kx, ky, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark tongue-and-groove shadow joint
    ctx.fillStyle = '#6E4220';
    ctx.fillRect(0, y0, size, 3.5);
  }

  for (let y = 0; y < size; y++) {
    const ly = y % ph;
    const groove = ly < 4 ? ly / 4 : 1.0;
    for (let x = 0; x < size; x++) {
      height[y * size + x] = groove;
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 4);
  map.anisotropy = 8;

  const normalMap = heightToNormalCanvas(height, size, size, 2.2, 3, 4);
  return { map, normalMap };
}

/**
 * 6. Crazy-Paving Natural Courtyard Flagstone + Clover/Moss Seams (`106d34c4`)
 */
function createCrazyPavingFlagstoneSet() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const rand = seededRand(3344);

  // Periodic Voronoi sites (36 stones tiled seamlessly!)
  const numSites = 36;
  const sites: Array<{ x: number; y: number; r: number; g: number; b: number }> = [];
  const palette = [
    [206, 194, 168],
    [192, 182, 158],
    [216, 205, 180],
    [182, 174, 152],
    [200, 186, 160],
  ];
  for (let i = 0; i < numSites; i++) {
    const c = palette[i % palette.length];
    sites.push({
      x: rand() * size,
      y: rand() * size,
      r: c[0] + (rand() - 0.5) * 14,
      g: c[1] + (rand() - 0.5) * 14,
      b: c[2] + (rand() - 0.5) * 14,
    });
  }

  for (let y = 0; y < size; y++) {
    const uy = (y / size) * Math.PI * 2;
    for (let x = 0; x < size; x++) {
      const ux = (x / size) * Math.PI * 2;
      let d1 = 1e9;
      let d2 = 1e9;
      let best = sites[0];

      for (let i = 0; i < numSites; i++) {
        const s = sites[i];
        let dx = Math.abs(x - s.x);
        let dy = Math.abs(y - s.y);
        if (dx > size * 0.5) dx = size - dx;
        if (dy > size * 0.5) dy = size - dy;
        // Periodic organic wobble across tile seams
        const wob = Math.sin(ux * 4 + i) * Math.cos(uy * 4 - i) * 4.5;
        const d = Math.hypot(dx, dy) + wob;
        if (d < d1) {
          d2 = d1;
          d1 = d;
          best = s;
        } else if (d < d2) {
          d2 = d;
        }
      }

      const edge = d2 - d1;
      const isMossJoint = edge < 5.2;
      const pIdx = y * size + x;
      const idx = pIdx * 4;
      const grain = (Math.sin(ux * 20) * Math.cos(uy * 20) + Math.sin((ux + uy) * 9)) * 4.5;

      if (isMossJoint) {
        // Soft green moss & sandy mortar between flagstones!
        const mossMix = Math.max(0, 1.0 - edge / 5.2);
        img.data[idx] = Math.round(136 * (1 - mossMix * 0.42) + 78 * mossMix * 0.42);
        img.data[idx + 1] = Math.round(138 * (1 - mossMix * 0.42) + 122 * mossMix * 0.42);
        img.data[idx + 2] = Math.round(108 * (1 - mossMix * 0.42) + 62 * mossMix * 0.42);
        img.data[idx + 3] = 255;
        height[pIdx] = 0.25 + (edge / 5.2) * 0.45;
      } else {
        const bevel = Math.min(1, (edge - 5.2) / 5.0);
        const shade = 0.90 + 0.10 * bevel;
        img.data[idx] = Math.min(255, Math.max(0, Math.round((best.r + grain) * shade)));
        img.data[idx + 1] = Math.min(255, Math.max(0, Math.round((best.g + grain) * shade)));
        img.data[idx + 2] = Math.min(255, Math.max(0, Math.round((best.b + grain) * shade)));
        img.data[idx + 3] = 255;
        height[pIdx] = 0.72 + 0.28 * bevel;
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(4.5, 4.2);
  map.anisotropy = 8;

  const normalMap = heightToNormalCanvas(height, size, size, 3.0, 4.5, 4.2);
  return { map, normalMap };
}

/**
 * 7. Hand-Dressed French Provençal Limestone & River-Stone Masonry Set (`f4a71928`)
 * Larger organically coursed warm stone blocks + subtle earthy recessed mortar (zero harsh cartoon white outlines!)
 */
function periodicStoneHash(ix: number, iy: number, period: number): number {
  const px = ((ix % period) + period) % period;
  const py = ((iy % period) + period) % period;
  const h = Math.sin(px * 127.1 + py * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}

function periodicStoneValueNoise(u: number, v: number, period: number): number {
  const x = u * period;
  const y = v * period;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = periodicStoneHash(ix, iy, period);
  const b = periodicStoneHash(ix + 1, iy, period);
  const c = periodicStoneHash(ix, iy + 1, period);
  const d = periodicStoneHash(ix + 1, iy + 1, period);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function periodicStoneFbm(u: number, v: number, basePeriod = 8, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let period = basePeriod;
  for (let o = 0; o < octaves; o++) {
    sum += amp * periodicStoneValueNoise(u, v, period);
    norm += amp;
    period *= 2;
    amp *= 0.5;
  }
  return sum / norm;
}

function createRandomRubbleStoneSet() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const rand = seededRand(7788);

  // Coursed rustic cottage stone rows (7 irregular rows x 4 blocks per row)
  const numStones = 28;
  const stones: Array<{ x: number; y: number; r: number; g: number; b: number }> = [];
  // Soft Provence sun-baked lime-washed stone & terracotta blocks (#E2CBB2, #D6A984, #E8D8C3)
  const colors = [
    [226, 203, 178], // #E2CBB2
    [214, 169, 132], // #D6A984 terracotta-peach stone
    [232, 216, 195], // #E8D8C3 creamy limestone
    [221, 194, 164],
    [235, 222, 204],
  ];
  for (let i = 0; i < numStones; i++) {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const c = colors[i % colors.length];
    stones.push({
      x: ((col + (row % 2) * 0.45 + (rand() - 0.5) * 0.25) / 4) * size,
      y: ((row + 0.5 + (rand() - 0.5) * 0.22) / 7) * size,
      r: c[0] + (rand() - 0.5) * 8,
      g: c[1] + (rand() - 0.5) * 8,
      b: c[2] + (rand() - 0.5) * 8,
    });
  }

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;
  const rImg = rCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Isotropic periodic FBM edge perturbation (eliminates directional sine grating moire)
      const wobble = (periodicStoneFbm(u + 0.19, v + 0.43, 6, 3) - 0.5) * 7.5;
      let d1 = 1e9;
      let d2 = 1e9;
      let best = stones[0];
      for (let i = 0; i < numStones; i++) {
        const s = stones[i];
        let dx = Math.abs(x - s.x);
        let dy = Math.abs(y - s.y) * 1.38;
        if (dx > size * 0.5) dx = size - dx;
        if (dy > size * 0.5 * 1.38) dy = (size - Math.abs(y - s.y)) * 1.38;
        const blockBias = ((i * 37) % 11) * 0.32;
        const d = Math.hypot(dx, dy) + wobble + blockBias;
        if (d < d1) {
          d2 = d1;
          d1 = d;
          best = s;
        } else if (d < d2) {
          d2 = d;
        }
      }
      const edge = d2 - d1;
      const pIdx = y * size + x;
      const idx = pIdx * 4;
      // Isotropic multi-octave 2D lattice value-noise FBM limestone mineral grain (ZERO diagonal moire!)
      const macroGrain = periodicStoneFbm(u, v, 8, 4) - 0.5;
      const mineralFleck = periodicStoneValueNoise(u + 0.37, v + 0.71, 48) - 0.5;
      const coarse = macroGrain * 1.15 + mineralFleck * 0.30;
      const microGrain = coarse * 10.0;

      let hVal = 0.24;
      let roughByte = 246;

      if (edge < 3.4) {
        // Pale warm-gray / creamy lime mortar (#EAE0CE) — soft flush plaster wash, zero black crevices
        const mDepth = edge / 3.4;
        const mShade = 0.94 + 0.06 * mDepth;
        img.data[idx] = Math.min(255, Math.max(0, Math.round(234 * mShade + microGrain * 0.22)));
        img.data[idx + 1] = Math.min(255, Math.max(0, Math.round(224 * mShade + microGrain * 0.20)));
        img.data[idx + 2] = Math.min(255, Math.max(0, Math.round(206 * mShade + microGrain * 0.18)));
        img.data[idx + 3] = 255;
        hVal = 0.28 + 0.14 * mDepth;
        roughByte = 248;
      } else {
        const bev = Math.min(1, (edge - 3.4) / 8.5);
        const aoEdge = 0.93 + 0.07 * Math.pow(bev, 0.75);
        img.data[idx] = Math.min(255, Math.max(0, Math.round((best.r + microGrain * 0.65) * aoEdge)));
        img.data[idx + 1] = Math.min(255, Math.max(0, Math.round((best.g + microGrain * 0.60) * aoEdge)));
        img.data[idx + 2] = Math.min(255, Math.max(0, Math.round((best.b + microGrain * 0.55) * aoEdge)));
        img.data[idx + 3] = 255;
        hVal = 0.48 + 0.34 * bev + coarse * 0.06;
        // Uniform matte chalky lime-washed stone & hearth brick (0.91 - 0.99 roughness, zero shiny patches)
        roughByte = Math.round(248 - bev * 12 - coarse * 4);
      }

      height[pIdx] = Math.max(0, Math.min(1, hVal));

      const rClamped = Math.max(232, Math.min(252, roughByte));
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rClamped;
      rImg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1.5, 1.6);
  map.anisotropy = 8;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(1.5, 1.6);
  roughnessMap.anisotropy = 8;

  const normalMap = heightToNormalCanvas(height, size, size, 1.1, 1.5, 1.6);
  return { map, normalMap, roughnessMap };
}

/**
 * 8. Vintage Soft French Linen Fine Rose-Terracotta Gingham Fabric (`282f8d29` & `29686ab3`)
 * Refined, muted woven linen threads instead of harsh cartoon red squares!
 */
function createRedGinghamTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#F5EDE0';
  ctx.fillRect(0, 0, size, size);

  const cell = 16;
  ctx.fillStyle = 'rgba(198, 102, 92, 0.36)';
  for (let i = 0; i < size; i += cell * 2) {
    ctx.fillRect(i, 0, cell, size);
    ctx.fillRect(0, i, size, cell);
  }
  ctx.fillStyle = 'rgba(180, 74, 68, 0.62)';
  for (let y = 0; y < size; y += cell * 2) {
    for (let x = 0; x < size; x += cell * 2) {
      ctx.fillRect(x, y, cell, cell);
    }
  }
  // Fine woven linen thread crosshatch
  ctx.fillStyle = 'rgba(255, 250, 240, 0.16)';
  for (let i = 0; i < size; i += 4) {
    ctx.fillRect(i, 0, 1, size);
    ctx.fillRect(0, i, size, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3.5, 2.0);
  tex.anisotropy = 8;
  return tex;
}

/**
 * 8B. Hand-Planed Wide-Plank Reclaimed French Honey-Oak Baking Tabletop (`4` wide boards, organic grain!)
 */
function createWidePlankOakTabletopSet() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const rand = seededRand(4488);
  const height = new Float32Array(size * size);

  const planks = 4;
  const ph = size / planks;
  const tones = ['#C49462', '#B78452', '#CC9D6B', '#BC8B58'];
  // Per-plank natural beeswax oil sheen variation (0.36..0.52 -> bytes 92..133)
  const plankRoughBase = [96, 118, 92, 112];

  for (let p = 0; p < planks; p++) {
    const y0 = p * ph;
    ctx.fillStyle = tones[p % tones.length];
    ctx.fillRect(0, y0, size, ph);

    const rb = plankRoughBase[p % plankRoughBase.length];
    rCtx.fillStyle = `rgb(${rb},${rb},${rb})`;
    rCtx.fillRect(0, y0, size, ph);

    // Crisp multi-scale oak cathedral grain lines & fine longitudinal fibers (`1024px` 20cm macro clarity!)
    for (let g = 0; g < 92; g++) {
      const gy = y0 + rand() * ph;
      const isDarkRing = g % 2 === 0;
      ctx.strokeStyle = isDarkRing ? 'rgba(104, 58, 26, 0.28)' : 'rgba(248, 222, 180, 0.20)';
      ctx.lineWidth = 0.8 + rand() * 2.0;
      rCtx.strokeStyle = isDarkRing ? 'rgba(168, 168, 168, 0.46)' : 'rgba(78, 78, 78, 0.38)';
      rCtx.lineWidth = 1.0 + rand() * 1.9;

      ctx.beginPath();
      rCtx.beginPath();
      for (let x = 0; x <= size; x += 16) {
        const ux = (x / size) * Math.PI * 2;
        const wave = Math.sin(ux + p * 2.1 + g * 0.4) * 9.5 + Math.cos(ux * 3 - g) * 2.8;
        if (x === 0) {
          ctx.moveTo(x, gy + wave);
          rCtx.moveTo(x, gy + wave);
        } else {
          ctx.lineTo(x, gy + wave);
          rCtx.lineTo(x, gy + wave);
        }
      }
      ctx.stroke();
      rCtx.stroke();
    }

    // Crisp anisotropic open-oak vessel pores & subtle medullary ray flecks (razor sharp at 20cm!)
    for (let v = 0; v < 460; v++) {
      const vx = rand() * size;
      const vy = y0 + 6 + rand() * (ph - 12);
      const vlen = 5 + rand() * 16;
      const isDarkPore = v % 4 !== 0;
      ctx.strokeStyle = isDarkPore ? 'rgba(84, 44, 18, 0.34)' : 'rgba(246, 224, 188, 0.16)';
      ctx.lineWidth = isDarkPore ? 0.9 + rand() * 0.7 : 1.1;
      rCtx.strokeStyle = isDarkPore ? 'rgba(192, 192, 192, 0.56)' : 'rgba(86, 86, 86, 0.34)';
      rCtx.lineWidth = 1.0;
      for (const ox of [-size, 0, size]) {
        const px = vx + ox;
        if (px + vlen >= 0 && px <= size) {
          ctx.beginPath();
          ctx.moveTo(px, vy);
          ctx.lineTo(px + vlen, vy + (rand() - 0.5) * 0.9);
          ctx.stroke();
          rCtx.beginPath();
          rCtx.moveTo(px, vy);
          rCtx.lineTo(px + vlen, vy);
          rCtx.stroke();
        }
      }
    }

    // Subtle artisanal pastry-knife micro-scratches wrapped across horizontal seam!
    for (let s = 0; s < 36; s++) {
      const sx = rand() * size;
      const sy = y0 + 12 + rand() * (ph - 24);
      const slen = 18 + rand() * 44;
      const sang = (rand() - 0.5) * 0.50;
      for (const ox of [-size, 0, size]) {
        const px = sx + ox;
        if (px + slen >= 0 && px - slen <= size) {
          ctx.strokeStyle = 'rgba(248, 226, 192, 0.18)';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(px, sy);
          ctx.lineTo(px + Math.cos(sang) * slen, sy + Math.sin(sang) * slen);
          ctx.stroke();

          rCtx.strokeStyle = 'rgba(182, 182, 182, 0.58)';
          rCtx.lineWidth = 1.25;
          rCtx.beginPath();
          rCtx.moveTo(px, sy);
          rCtx.lineTo(px + Math.cos(sang) * slen, sy + Math.sin(sang) * slen);
          rCtx.stroke();
        }
      }
    }

    // Chamfered plank V-groove seam (catches bright micro-bevel highlight + dark shadow crevice)
    ctx.fillStyle = 'rgba(84, 46, 20, 0.68)';
    ctx.fillRect(0, y0, size, 3.2);
    ctx.fillStyle = 'rgba(248, 222, 184, 0.28)';
    ctx.fillRect(0, y0 + 3.4, size, 2.0);
    rCtx.fillStyle = 'rgb(184, 184, 184)';
    rCtx.fillRect(0, y0, size, 4.2);
  }

  // Bake ACTUAL oak cathedral grain, vessel pores & pastry-knife scratches into 1024px height -> normalMap!
  const colData = ctx.getImageData(0, 0, size, size).data;
  const rghData = rCtx.getImageData(0, 0, size, size).data;
  for (let y = 0; y < size; y++) {
    const uy = (y / size) * Math.PI * 2;
    const ly = y % ph;
    const seam = ly < 5.5 ? 0.36 + (ly / 5.5) * 0.64 : ly > ph - 3.0 ? 0.84 : 1.0;
    for (let x = 0; x < size; x++) {
      const ux = (x / size) * Math.PI * 2;
      const idx = (y * size + x) * 4;
      const colLuma = (colData[idx] * 0.30 + colData[idx + 1] * 0.59 + colData[idx + 2] * 0.11) / 255;
      const poreDip = Math.max(0, (rghData[idx] - 135) / 120) * 0.16;
      const fineFiber = Math.sin(uy * 72 + Math.sin(ux * 3) * 1.8) * 0.025 + Math.sin(uy * 160) * 0.012;
      height[y * size + x] = Math.max(0, Math.min(1, seam * (0.64 + colLuma * 0.36) - poreDip + fineFiber));
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1.6, 1.2);
  map.anisotropy = 16;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(1.6, 1.2);
  roughnessMap.anisotropy = 16;

  const normalMap = heightToNormalCanvas(height, size, size, 3.6, 1.6, 1.2);
  normalMap.anisotropy = 16;
  return { map, normalMap, roughnessMap };
}

/**
 * 8C. Hand-Thrown Kiln-Speckled Cream Cottage Stoneware Ceramic Texture
 */
function createSpeckledStonewareTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(9021);

  ctx.fillStyle = '#F5EDE0';
  ctx.fillRect(0, 0, size, size);

  // Subtle horizontal potter's wheel throwing rings
  for (let y = 0; y < size; y += 6) {
    ctx.fillStyle = y % 12 === 0 ? 'rgba(218, 202, 178, 0.16)' : 'rgba(255, 252, 246, 0.16)';
    ctx.fillRect(0, y, size, 2);
  }
  // Organic kiln iron-clay speckles wrapped periodically across x=0/size (ZERO vertical UV seam!)
  for (let i = 0; i < 420; i++) {
    ctx.fillStyle = i % 3 === 0 ? 'rgba(128, 96, 68, 0.42)' : 'rgba(156, 124, 92, 0.28)';
    const sx = rand() * size;
    const sy = rand() * size;
    const sr = 0.7 + rand() * 1.4;
    for (const ox of [-size, 0, size]) {
      if (sx + ox >= -sr && sx + ox <= size + sr) {
        ctx.beginPath();
        ctx.arc(sx + ox, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/**
 * 8D. Rustic Split Birch Firewood Bark Texture
 */
function createBirchBarkTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(6633);

  ctx.fillStyle = '#E4D8C2';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = i % 3 === 0 ? 'rgba(84, 62, 44, 0.55)' : 'rgba(154, 126, 94, 0.36)';
    const bx = rand() * size;
    const by = rand() * size;
    const bw = 12 + rand() * 34;
    const bh = 1.5 + rand() * 3.0;
    for (const ox of [-size, 0, size]) {
      if (bx + ox + bw >= 0 && bx + ox <= size) {
        ctx.fillRect(bx + ox, by, bw, bh);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/**
 * 9. Honey-Birch Wooden Pegboard Texture (`970bb675` & `230f538a`)
 */
function createPegboardTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#D4A56E';
  ctx.fillRect(0, 0, size, size);

  // Subtle wood grain
  ctx.fillStyle = 'rgba(162, 112, 62, 0.14)';
  for (let y = 0; y < size; y += 6) {
    ctx.fillRect(0, y, size, 2);
  }

  const step = 32;
  for (let y = step / 2; y < size; y += step) {
    for (let x = step / 2; x < size; x += step) {
      ctx.fillStyle = 'rgba(255, 236, 204, 0.45)';
      ctx.beginPath();
      ctx.arc(x, y + 1.5, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#52341A';
      ctx.beginPath();
      ctx.arc(x, y, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 4);
  tex.anisotropy = 8;
  return tex;
}

/**
 * 10. French Cottage Sage-Bordered Floral Tapestry Rug (`2fb763f6` Inspiration!)
 */
function createFloralTapestryRugTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  const traceScallopedLoop = (baseR: number, amp: number, lobes = 12, steps = 160) => {
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const r = baseR + Math.sin(a * lobes) * amp;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };

  // Delicate scalloped wool fringe & organic floral rug silhouette (`85918c0f` contour!)
  ctx.fillStyle = '#EFE6D2';
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const r = 230 + Math.sin(a * 12) * 11;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 9.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Outer scalloped sage-green woven tapestry border (`#6E8762`)
  ctx.fillStyle = '#6E8762';
  traceScallopedLoop(229, 11);
  ctx.fill();

  ctx.fillStyle = '#DEC292';
  traceScallopedLoop(206, 9.5);
  ctx.fill();

  ctx.fillStyle = '#F7F0DF';
  traceScallopedLoop(198, 8.5);
  ctx.fill();

  // Floral garland vine hugging the scalloped sage border
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rr = 178 + Math.sin(a * 12) * 6;
    const rx = cx + Math.cos(a) * rr;
    const ry = cy + Math.sin(a) * rr;
    ctx.fillStyle = '#628054';
    ctx.beginPath();
    ctx.ellipse(rx + Math.cos(a + 0.5) * 12, ry + Math.sin(a + 0.5) * 12, 9, 4, a, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = i % 2 === 0 ? '#DF8498' : '#E8B85C';
    ctx.beginPath();
    ctx.arc(rx, ry, 8.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FAF4E4';
    ctx.beginPath();
    ctx.arc(rx, ry, 3.0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Scattered interior botanical rose sprigs
  for (let ring = 0; ring < 2; ring++) {
    const count = ring === 0 ? 6 : 12;
    const rad = ring === 0 ? 60 : 120;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + ring * 0.25;
      const fx = cx + Math.cos(a) * rad;
      const fy = cy + Math.sin(a) * rad;
      ctx.fillStyle = '#6E8C60';
      ctx.beginPath();
      ctx.ellipse(fx - 7, fy + 4, 8, 3.5, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(fx + 7, fy - 4, 8, 3.5, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = (i + ring) % 2 === 0 ? '#E28C9A' : '#EAC26E';
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(fx + Math.cos(pa) * 5, fy + Math.sin(pa) * 5, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#F2CA68';
      ctx.beginPath();
      ctx.arc(fx, fy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * 11. GLSL Animated Breeze Sheer White Embroidered Eyelet-Lace Curtain Shader (`6e8ca27c`!)
 * "带着凉意的风，轻轻吹动窗帘"
 */
export function createBillowingSheerCurtainMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uPhase: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPhase;
      varying vec2 vUv;
      varying float vPleat;
      varying float vBillow;

      void main() {
        vUv = uv;
        vec3 p = position;

        // Top rod (uv.y = 1) stays pinned; lower hem (uv.y = 0) billows STRICTLY INWARD (+Z >= 0) so cloth NEVER clips wooden posts or window frames!
        float hang = 1.0 - uv.y;
        float softPinch = 1.0 - 0.14 * sin(hang * 3.14159265);
        p.x *= softPinch;

        float pleatWave = 0.5 + 0.5 * sin(uv.x * 34.0);
        float pleat = pleatWave * 0.024 * (0.25 + 0.75 * hang);
        float gust = 0.5 + 0.5 * sin(uTime * 1.15 + uv.y * 2.4 + uv.x * 1.9 + uPhase);
        float ripple = 0.5 + 0.5 * cos(uTime * 0.74 - uv.x * 3.2 + uPhase);
        float breeze = (gust * 0.068 + ripple * 0.022) * pow(hang, 1.45);

        p.z += max(0.0, pleat + breeze);
        p.x += (gust - 0.5) * 0.014 * pow(hang, 1.35);

        vPleat = sin(uv.x * 34.0);
        vBillow = breeze;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying float vPleat;
      varying float vBillow;

      void main() {
        // Warm sunlit embroidered cotton-voile cream base (linear space)
        vec3 warmCream = vec3(1.0, 0.96, 0.87);
        vec3 sunRim    = vec3(1.0, 0.88, 0.66);

        // Intricate embroidered French eyelet diamond trellis + 4-petal floret rings (ref 6e8ca27c)
        vec2 grid = fract(vUv * vec2(8.0, 15.0));
        vec2 cell = grid - 0.5;
        float crossLineX = smoothstep(0.052, 0.015, abs(cell.x));
        float crossLineY = smoothstep(0.052, 0.015, abs(cell.y));
        float diagA = smoothstep(0.045, 0.014, abs(cell.x + cell.y));
        float diagB = smoothstep(0.045, 0.014, abs(cell.x - cell.y));
        float r = length(cell);
        float eyeletHole = smoothstep(0.095, 0.052, r);
        float eyeletRing = smoothstep(0.16, 0.11, r) * (1.0 - smoothstep(0.095, 0.065, r));
        float floret = smoothstep(0.24, 0.17, r) * pow(max(0.0, cos(atan(cell.y, cell.x) * 4.0)), 2.0);
        float embroidery = max(max(crossLineX, crossLineY), max(max(diagA, diagB) * 0.45, max(eyeletRing, floret * 0.82)));

        // Scalloped double-arched lower eyelet lace border
        float hemWave = 0.036 + 0.020 * abs(sin(vUv.x * 31.4159));
        if (vUv.y < hemWave * 0.55) discard;
        float hemArchEdge = smoothstep(0.026, 0.008, abs(vUv.y - hemWave * 0.62));

        float pleatShade = 0.90 + 0.10 * vPleat + vBillow * 0.8;
        vec3 col = mix(warmCream, sunRim, clamp(1.0 - vUv.y * 0.6, 0.0, 1.0) * 0.30) * pleatShade;
        col += vec3(0.07) * max(embroidery, hemArchEdge);

        // Crisp sheer cotton gauze with dense satin embroidery & airy eyelet pinholes
        float foldDensity = 0.44 + 0.18 * abs(vPleat);
        float hemLace = smoothstep(0.11, 0.035, vUv.y) * 0.26 + hemArchEdge * 0.28;
        float alpha = clamp((foldDensity + hemLace + embroidery * 0.22) * (1.0 - eyeletHole * 0.72), 0.12, 0.84);

        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * 12. Sculpted 3D Botanical Geometries for the 4-Layer Plant Wall, Floral Arches & Creek!
 */
export function createMonsteraLeafGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  // Left heart lobe with split fenestrations
  shape.bezierCurveTo(-0.09, 0.02, -0.15, 0.09, -0.14, 0.16);
  shape.lineTo(-0.05, 0.15);
  shape.lineTo(-0.13, 0.18);
  shape.bezierCurveTo(-0.13, 0.23, -0.10, 0.27, -0.04, 0.26);
  shape.lineTo(-0.10, 0.29);
  shape.bezierCurveTo(-0.07, 0.34, -0.03, 0.37, 0, 0.40);
  // Right heart lobe with split fenestrations
  shape.bezierCurveTo(0.03, 0.37, 0.07, 0.34, 0.10, 0.29);
  shape.lineTo(0.04, 0.26);
  shape.bezierCurveTo(0.10, 0.27, 0.13, 0.23, 0.13, 0.18);
  shape.lineTo(0.05, 0.15);
  shape.lineTo(0.14, 0.16);
  shape.bezierCurveTo(0.15, 0.09, 0.09, 0.02, 0, 0);

  const geo = new THREE.ShapeGeometry(shape, 8);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // Natural botanical arch & V-fold along midrib
    const droop = -Math.pow(y / 0.4, 1.8) * 0.08;
    const cup = Math.abs(x) * 0.18;
    pos.setZ(i, droop + cup);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createSwordFernFrondGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  const steps = 9;
  const totalLen = 0.48;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 0.65) / steps;
    const t2 = (i + 1) / steps;
    const w = Math.sin(Math.pow(t1, 0.75) * Math.PI) * 0.075;
    shape.lineTo(-0.008, t0 * totalLen);
    shape.lineTo(-w, t1 * totalLen);
    shape.lineTo(-0.007, t2 * totalLen);
  }
  shape.lineTo(0, totalLen + 0.03);
  for (let i = steps - 1; i >= 0; i--) {
    const t2 = (i + 1) / steps;
    const t1 = (i + 0.65) / steps;
    const t0 = i / steps;
    const w = Math.sin(Math.pow(t1, 0.75) * Math.PI) * 0.075;
    shape.lineTo(0.007, t2 * totalLen);
    shape.lineTo(w, t1 * totalLen);
    shape.lineTo(0.008, t0 * totalLen);
  }
  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape, 4);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = y / 0.51;
    // Graceful cascading fern arc!
    pos.setZ(i, Math.sin(t * Math.PI * 0.85) * 0.11 - t * t * 0.14);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createButterflyWingGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.035, 0.038, 0.052, 0.028, 0.042, 0.004);
  shape.bezierCurveTo(0.036, -0.022, 0.018, -0.032, 0, -0.008);
  shape.closePath();
  return new THREE.ShapeGeometry(shape, 6);
}

/**
 * 8E. Hand-Swirled Rustic Buttercream & Berry-Compote Cottage Cake Exterior Set
 */
function createRusticButtercreamSwirlSet() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const height = new Float32Array(size * size);
  const rand = seededRand(5209);
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  // Rich warm buttermilk-cream palette-knife frosted base with visible ridge/trough AO depth!
  ctx.fillStyle = '#EFE3D1';
  ctx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#929292';
  rCtx.fillRect(0, 0, size, size);

  // Horizontal artisan palette-knife frosting ridges (creamy gloss on crests, soft velvet shadow in troughs)
  for (let y = 0; y < size; y += 2) {
    const ridge1 = Math.sin((y / size) * Math.PI * 18) * 0.5 + 0.5;
    const ridge2 = Math.sin((y / size) * Math.PI * 36 + 0.8) * 0.5 + 0.5;
    const crest = ridge1 * 0.72 + ridge2 * 0.28;
    const rVal = Math.round(212 + crest * 38);
    const gVal = Math.round(199 + crest * 41);
    const bVal = Math.round(182 + crest * 42);
    ctx.fillStyle = `rgb(${rVal}, ${gVal}, ${bVal})`;
    ctx.fillRect(0, y, size, 2);

    // Crests have buttery gloss (roughness ~0.28 = 72), troughs are airy matte (~0.62 = 158)
    const roughByte = Math.round(158 - crest * 86);
    rCtx.fillStyle = `rgb(${roughByte}, ${roughByte}, ${roughByte})`;
    rCtx.fillRect(0, y, size, 2);
  }
  // Organic spatula drag wisps, micro air bubbles & crushed vanilla bean flecks wrapped seamlessly across tile edges
  for (let i = 0; i < 360; i++) {
    const px = rand() * size;
    const py = rand() * size;
    if (i % 4 === 0) {
      const r = 1.2 + rand() * 0.9;
      ctx.fillStyle = 'rgba(84, 52, 32, 0.34)';
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          if (px + ox >= -r && px + ox <= size + r && py + oy >= -r && py + oy <= size + r) {
            ctx.beginPath();
            ctx.arc(px + ox, py + oy, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    } else {
      const len = 14 + rand() * 34;
      const sag = (rand() - 0.5) * 4;
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(255, 250, 242, 0.34)' : 'rgba(176, 150, 124, 0.15)';
      ctx.lineWidth = 1.4 + rand() * 2.2;
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          if (px + ox + len >= 0 && px + ox <= size && py + oy >= -6 && py + oy <= size + 6) {
            ctx.beginPath();
            ctx.moveTo(px + ox, py + oy);
            ctx.quadraticCurveTo(px + ox + len * 0.5, py + oy + sag, px + ox + len, py + oy);
            ctx.stroke();
          }
        }
      }
    }
  }

  for (let y = 0; y < size; y++) {
    const uy = (y / size) * Math.PI * 2;
    const ridge =
      Math.sin((y / size) * Math.PI * 18) * 0.44 +
      Math.sin((y / size) * Math.PI * 36 + 0.8) * 0.16;
    for (let x = 0; x < size; x++) {
      const sweep =
        Math.sin((x / size) * Math.PI * 6 + uy * 4) * 0.12 +
        Math.cos((x / size) * Math.PI * 14 - uy * 2) * 0.05;
      height[y * size + x] = 0.5 + ridge + sweep;
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 1);
  map.anisotropy = 8;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(2, 1);
  roughnessMap.anisotropy = 8;

  const normalMap = heightToNormalCanvas(height, size, size, 2.65, 2, 1);
  return { map, normalMap, roughnessMap };
}

/**
 * 8F. Vintage French Cottage Roman-Numeral Wall Clock Dial Texture (`f4a71928` & `29686ab3`)
 */
function createVintageClockDialTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;

  ctx.fillStyle = '#FAF2DE';
  ctx.beginPath();
  ctx.arc(c, c, 124, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#4A3828';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(c, c, 114, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(c, c, 74, 0, Math.PI * 2);
  ctx.stroke();

  const romans = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  ctx.fillStyle = '#36281C';
  ctx.font = 'bold 18px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  romans.forEach((lbl, idx) => {
    const a = (idx / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.fillText(lbl, c + Math.cos(a) * 94, c + Math.sin(a) * 94);
  });

  // Vintage clock hands pointing to cozy 3:10 afternoon tea time!
  ctx.strokeStyle = '#2B2016';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(c, c);
  ctx.lineTo(c + 52, c + 12);
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(c, c);
  ctx.lineTo(c + 44, c - 54);
  ctx.stroke();

  ctx.fillStyle = '#8C5C30';
  ctx.beginPath();
  ctx.arc(c, c, 7, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * 8G. Authentic Woven Rattan / Wicker Basket & Banneton PBR Set (`Color + Normal`)
 */
function createWovenRattanSet() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;
  const height = new Float32Array(size * size);

  // Deep shadow crevices between inter-woven wicker canes
  ctx.fillStyle = '#4B2D12';
  ctx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#EAEAEA';
  rCtx.fillRect(0, 0, size, size);

  const cellW = 32;
  const cellH = 16;
  // Underlying vertical warp stakes peeking through crevices (wrapped across horizontal seam)
  for (let col = 0; col < size / (cellW * 0.5); col++) {
    const vx = col * (cellW * 0.5) - 2;
    ctx.fillStyle = '#6B421E';
    ctx.fillRect(vx, 0, 5, size);
    if (vx < 0) ctx.fillRect(vx + size, 0, 5, size);
  }

  for (let row = 0; row < size / cellH; row++) {
    const y0 = row * cellH;
    const shift = (row % 2) * (cellW * 0.5);
    for (let col = -1; col <= size / cellW; col++) {
      const x0 = col * cellW + shift;
      const g = ctx.createLinearGradient(x0, y0, x0 + cellW, y0);
      g.addColorStop(0.0, '#6B411C');
      g.addColorStop(0.22, '#C89252');
      g.addColorStop(0.50, '#E2B272');
      g.addColorStop(0.78, '#C68E4E');
      g.addColorStop(1.0, '#623B18');
      ctx.fillStyle = g;
      ctx.fillRect(x0 + 1.5, y0 + 2.2, cellW - 3, cellH - 4.4);

      // Glossy natural bamboo-cane reed highlight ridge
      ctx.fillStyle = 'rgba(255, 240, 206, 0.32)';
      ctx.fillRect(x0 + 4, y0 + 4.5, cellW - 8, 2.2);

      const rg = rCtx.createLinearGradient(x0, y0, x0 + cellW, y0);
      rg.addColorStop(0.0, '#D8D8D8');
      rg.addColorStop(0.50, '#727272');
      rg.addColorStop(1.0, '#D8D8D8');
      rCtx.fillStyle = rg;
      rCtx.fillRect(x0 + 1.5, y0 + 2.2, cellW - 3, cellH - 4.4);
    }
  }

  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / cellH);
    const ly = (y % cellH) / cellH;
    const vArch = Math.sin(ly * Math.PI);
    const shift = (row % 2) * (cellW * 0.5);
    const reedFiber = Math.sin((y / size) * Math.PI * 2 * 60) * 0.04;
    for (let x = 0; x < size; x++) {
      const lx = (((x - shift) % cellW) + cellW) % cellW / cellW;
      const hArch = Math.sin(lx * Math.PI);
      height[y * size + x] = Math.max(0, Math.min(1, 0.12 + 0.84 * Math.pow(vArch * hArch, 0.78) + reedFiber));
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 2);
  map.anisotropy = 8;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(3, 2);
  roughnessMap.anisotropy = 8;

  const normalMap = heightToNormalCanvas(height, size, size, 4.4, 3, 2);
  return { map, normalMap, roughnessMap };
}

/**
 * 8H. Artisan Hand-Thrown Dripped-Glaze Ceramic Pottery Set (Cream Kiln Glaze dripping over Warm Terracotta Clay!)
 */
function createArtisanGlazedPotterySet() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const height = new Float32Array(size * size);
  const rand = seededRand(8181);

  // Lower unglazed warm toasted terracotta clay foot (`y > 70%`)
  ctx.fillStyle = '#C48A62';
  ctx.fillRect(0, 0, size, size);

  // Upper dipped matte cream stoneware glaze with periodic organic wavy drip edge (zero Lathe UV seam!)
  ctx.fillStyle = '#F6EFE0';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size, 0);
  const dripAt = (x: number) => {
    const ux = (x / size) * Math.PI * 2;
    return size * 0.72 + Math.sin(ux * 3) * 14 + Math.cos(ux * 8) * 8;
  };
  ctx.lineTo(size, dripAt(size));
  for (let x = size; x >= 0; x -= 8) {
    ctx.lineTo(x, dripAt(x));
  }
  ctx.closePath();
  ctx.fill();

  // Warm honey-toasted rim accent at very top (`y < 14`)
  const rimGrad = ctx.createLinearGradient(0, 0, 0, 18);
  rimGrad.addColorStop(0, '#B2764C');
  rimGrad.addColorStop(1, 'rgba(178, 118, 76, 0)');
  ctx.fillStyle = rimGrad;
  ctx.fillRect(0, 0, size, 18);

  // Kiln iron speckles & subtle potter's wheel ribs wrapped periodically across x = 0 / size
  for (let i = 0; i < 360; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(122, 86, 58, 0.38)' : 'rgba(162, 126, 92, 0.25)';
    const sx = rand() * size;
    const sy = rand() * size;
    const sr = 0.8 + rand() * 1.4;
    for (const ox of [-size, 0, size]) {
      if (sx + ox >= -sr && sx + ox <= size + sr) {
        ctx.beginPath();
        ctx.arc(sx + ox, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  for (let y = 0; y < size; y++) {
    const uy = (y / size) * Math.PI * 2;
    const wheelRib = 0.5 + 0.18 * Math.sin(uy * 22);
    for (let x = 0; x < size; x++) {
      const dripLine = dripAt(x);
      const glazeLift = y < dripLine ? 0.22 : 0.0;
      height[y * size + x] = wheelRib + glazeLift;
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;

  const normalMap = heightToNormalCanvas(height, size, size, 1.8, 1, 1);
  return { map, normalMap };
}

/**
 * 8I. Vintage French Raw Belgian Linen Flour Sack Texture (`MOULIN DU JARDIN · FARINE T55`)
 */
function createFrenchFlourSackTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#EFE4CC';
  ctx.fillRect(0, 0, size, size);

  // Coarse burlap / Belgian flax weave crosshatch
  for (let i = 0; i < size; i += 4) {
    ctx.fillStyle = i % 8 === 0 ? 'rgba(168, 142, 106, 0.18)' : 'rgba(255, 250, 238, 0.16)';
    ctx.fillRect(i, 0, 1.5, size);
    ctx.fillRect(0, i, size, 1.5);
  }

  // Classic faded French grain-sack vertical stripes
  ctx.fillStyle = 'rgba(168, 72, 64, 0.45)';
  ctx.fillRect(0, 108, size, 6);
  ctx.fillRect(0, 174, size, 6);

  ctx.fillStyle = 'rgba(72, 58, 44, 0.78)';
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px "Noto Serif SC", "Songti SC", "Microsoft YaHei", serif';
  ctx.fillText('林间磨坊', 128, 134);
  ctx.font = '600 13px "Noto Serif SC", "PingFang SC", "Microsoft YaHei", serif';
  ctx.fillText('精选低筋小麦粉', 128, 158);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * 8J. Braided Natural Jute & Sage Farmhouse Kitchen Runner Rug Texture
 */
function createJuteRunnerRugTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#D8C49E';
  ctx.fillRect(0, 0, w, h);

  // Horizontal braided jute rows
  for (let y = 0; y < h; y += 8) {
    ctx.fillStyle = y % 16 === 0 ? '#CEB68C' : '#DECBA8';
    ctx.fillRect(0, y, w, 6);
    ctx.fillStyle = 'rgba(128, 96, 58, 0.22)';
    for (let x = (y % 16 === 0 ? 0 : 8); x < w; x += 16) {
      ctx.fillRect(x, y, 8, 2);
    }
  }

  // Woven sage-green & cream country farmhouse end-band stripes
  [28, 48, w - 58, w - 38].forEach((sx, idx) => {
    ctx.fillStyle = idx % 2 === 0 ? '#6E8862' : '#FAF3E2';
    ctx.fillRect(sx, 10, 10, h - 20);
  });

  // Subtle dark border trim
  ctx.strokeStyle = '#8C6A44';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, w - 12, h - 12);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * 8K. Seamless 360° Hand-Painted Provence Floral Cottage Ceramic Glaze (Bowls, Teapots, Cups & Platters!)
 * Every botanical vine, rosebud, forget-me-not & kiln speckle wraps periodically across x=0/512 -> ZERO seam!
 */
function createFloralCeramicTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(8181);

  // Warm antique cream porcelain-stoneware base
  const bg = ctx.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0.0, '#F7F0E2');
  bg.addColorStop(0.55, '#FBF5E9');
  bg.addColorStop(1.0, '#EFE4CF');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Subtle periodic kiln speckles
  for (let i = 0; i < 240; i++) {
    const sx = rand() * size;
    const sy = rand() * size;
    const sr = 0.6 + rand() * 1.2;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(148, 118, 86, 0.22)' : 'rgba(176, 146, 110, 0.16)';
    for (const ox of [-size, 0, size]) {
      if (sx + ox >= -sr && sx + ox <= size + sr) {
        ctx.beginPath();
        ctx.arc(sx + ox, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Hand-brushed sage-green & champagne-gold scalloped rim bands (periodic across 360°!)
  const drawRimBand = (yBand: number) => {
    ctx.fillStyle = '#738E66';
    ctx.fillRect(0, yBand, size, 8);
    ctx.fillStyle = '#C9A254';
    ctx.fillRect(0, yBand + 10, size, 3.5);
    ctx.fillStyle = 'rgba(115, 142, 102, 0.55)';
    for (let k = 0; k < 16; k++) {
      const cx = ((k + 0.5) / 16) * size;
      ctx.beginPath();
      ctx.arc(cx, yBand + 16, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  drawRimBand(24);
  drawRimBand(size - 56);

  // Seamless undulating sage botanical vine garland around vessel belly (period = 4 cycles across 512px!)
  const drawWrappedFlora = (yCenter: number, count: number) => {
    ctx.strokeStyle = '#5F7E4E';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 4) {
      const y = yCenter + Math.sin((x / size) * Math.PI * 2 * count) * 22;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    for (let i = 0; i < count * 2; i++) {
      const u = (i + 0.5) / (count * 2);
      const bx = u * size;
      const by = yCenter + Math.sin(u * Math.PI * 2 * count) * 22;
      const isRose = i % 2 === 0;

      for (const ox of [-size, 0, size]) {
        const px = bx + ox;
        if (px < -44 || px > size + 44) continue;

        // Flanking sage botanical leaves
        ctx.fillStyle = '#6A8B56';
        for (const side of [-1, 1]) {
          ctx.save();
          ctx.translate(px + side * 14, by + (side > 0 ? 6 : -6));
          ctx.rotate(side * 0.65);
          ctx.beginPath();
          ctx.ellipse(0, 0, 12, 5.2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        if (isRose) {
          // Hand-painted Provence blush wild rosebud
          for (let p = 0; p < 5; p++) {
            const a = (p / 5) * Math.PI * 2;
            ctx.fillStyle = p % 2 === 0 ? '#DF8094' : '#F0A8B6';
            ctx.beginPath();
            ctx.arc(px + Math.cos(a) * 6.5, by + Math.sin(a) * 6.5, 6.2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#C65A74';
          ctx.beginPath();
          ctx.arc(px, by, 4.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#F6D368';
          ctx.beginPath();
          ctx.arc(px, by, 2.0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Dainty sky-blue forget-me-not & golden chamomile trio
          for (let p = 0; p < 5; p++) {
            const a = (p / 5) * Math.PI * 2 + 0.3;
            ctx.fillStyle = '#8FAFD6';
            ctx.beginPath();
            ctx.arc(px + Math.cos(a) * 5.2, by + Math.sin(a) * 5.2, 4.2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#F4CA4C';
          ctx.beginPath();
          ctx.arc(px, by, 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  };
  drawWrappedFlora(size * 0.34, 4);
  drawWrappedFlora(size * 0.68, 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/**
 * 8L. Seamless 360° French Country Botanical Porcelain-Enamel Cutlery & Spatula Handle Print!
 */
function createFloralHandleTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Warm French ivory-cream enamel handle base with subtle warm wood/porcelain sheen
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0.0, '#EFE4CF');
  grad.addColorStop(0.18, '#FBF5E8');
  grad.addColorStop(0.82, '#FAF3E4');
  grad.addColorStop(1.0, '#E9DBC2');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Delicate champagne-gold & sage ferrule stripe trim at both ends
  [12, size - 22].forEach((y) => {
    ctx.fillStyle = '#738E66';
    ctx.fillRect(0, y, size, 6);
    ctx.fillStyle = '#C9A254';
    ctx.fillRect(0, y + 7, size, 3);
  });

  // Periodic vertical climbing miniature rosebud & chamomile vine sprays (3 symmetric columns)
  for (let col = 0; col < 3; col++) {
    const cx = ((col + 0.5) / 3) * size;
    ctx.strokeStyle = '#628250';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    for (let y = 26; y <= size - 26; y += 6) {
      const wx = cx + Math.sin((y / size) * Math.PI * 6) * 8;
      if (y === 26) ctx.moveTo(wx, y);
      else ctx.lineTo(wx, y);
    }
    ctx.stroke();

    [58, 108, 158, 204].forEach((by, bi) => {
      const bx = cx + Math.sin((by / size) * Math.PI * 6) * 8;
      ctx.fillStyle = '#6E905A';
      ctx.beginPath();
      ctx.ellipse(bx - 8, by + 3, 6.5, 3.0, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(bx + 8, by - 3, 6.5, 3.0, 0.5, 0, Math.PI * 2);
      ctx.fill();

      const isPink = (bi + col) % 2 === 0;
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        ctx.fillStyle = isPink ? '#E48498' : '#8EB0D8';
        ctx.beginPath();
        ctx.arc(bx + Math.cos(a) * 3.8, by + Math.sin(a) * 3.8, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#F2C94C';
      ctx.beginPath();
      ctx.arc(bx, by, 2.0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/**
 * 8M. Embroidered Belgian Oat-Flax Linen Table Runner with Sage Stripes, Gingham Border & Stitched Daisies!
 */
function createCottageTableRunnerTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Natural oat-flax woven Belgian linen base
  ctx.fillStyle = '#F3EAD7';
  ctx.fillRect(0, 0, w, h);

  // Subtle cross-woven flax thread slubs
  for (let y = 0; y < h; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? 'rgba(182, 162, 130, 0.14)' : 'rgba(255, 252, 244, 0.18)';
    ctx.fillRect(0, y, w, 1.4);
  }
  for (let x = 0; x < w; x += 4) {
    ctx.fillStyle = x % 8 === 0 ? 'rgba(176, 156, 124, 0.12)' : 'rgba(255, 250, 240, 0.12)';
    ctx.fillRect(x, 0, 1.5, h);
  }

  // Country red-gingham & sage-green embroidered double border bands along long edges
  [14, h - 30].forEach((by) => {
    ctx.fillStyle = '#D97C6C';
    ctx.globalAlpha = 0.42;
    ctx.fillRect(0, by, w, 16);
    ctx.globalAlpha = 0.58;
    for (let x = 0; x < w; x += 16) {
      ctx.fillRect(x, by, 8, 8);
      ctx.fillRect(x + 8, by + 8, 8, 8);
    }
    ctx.globalAlpha = 1.0;
  });

  // Sage-green satin hemstitch lines framing center embroidery corridor
  [36, 44, h - 46, h - 38].forEach((sy, idx) => {
    ctx.fillStyle = idx % 2 === 0 ? '#748E68' : '#C9A462';
    ctx.fillRect(0, sy, w, idx % 2 === 0 ? 3.5 : 1.8);
  });

  // Repeating dainty embroidered chamomile daisies & sage leaves along both runner borders
  for (let i = 0; i < 12; i++) {
    const dx = ((i + 0.5) / 12) * w;
    [58, h - 58].forEach((dy) => {
      ctx.fillStyle = '#6D8C5B';
      ctx.beginPath();
      ctx.ellipse(dx - 9, dy, 6, 2.6, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(dx + 9, dy, 6, 2.6, 0.35, 0, Math.PI * 2);
      ctx.fill();

      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * Math.PI * 2;
        ctx.fillStyle = '#FFFDF8';
        ctx.beginPath();
        ctx.arc(dx + Math.cos(a) * 4.2, dy + Math.sin(a) * 4.2, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#E8B63E';
      ctx.beginPath();
      ctx.arc(dx, dy, 2.4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/**
 * 8N. Scalloped French Crochet-Lace & Woven Linen Round Placemat (Color + Alpha Maps!)
 */
function createCrochetLacePlacematMaps(): { map: THREE.CanvasTexture; alphaMap: THREE.CanvasTexture } {
  const size = 512;
  const cMap = document.createElement('canvas');
  const cAlpha = document.createElement('canvas');
  cMap.width = cAlpha.width = size;
  cMap.height = cAlpha.height = size;
  const ctxM = cMap.getContext('2d')!;
  const ctxA = cAlpha.getContext('2d')!;
  const cx = size * 0.5;
  const cy = size * 0.5;

  ctxM.fillStyle = '#F7EFE0';
  ctxM.fillRect(0, 0, size, size);
  ctxA.fillStyle = '#000000';
  ctxA.fillRect(0, 0, size, size);

  // Scalloped 24-petal crochet doily silhouette
  const petals = 24;
  const baseR = size * 0.43;
  const drawScallop = (ctx: CanvasRenderingContext2D, fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * baseR, cy + Math.sin(a) * baseR, size * 0.056, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  drawScallop(ctxA, '#FFFFFF');
  drawScallop(ctxM, '#F6EEDF');

  // Woven linen concentric rings & delicate sage-rose embroidered ring inside center
  ctxM.strokeStyle = 'rgba(166, 146, 114, 0.28)';
  ctxM.lineWidth = 2.0;
  for (let r = 28; r < baseR - 18; r += 12) {
    ctxM.beginPath();
    ctxM.arc(cx, cy, r, 0, Math.PI * 2);
    ctxM.stroke();
  }

  ctxM.strokeStyle = '#7A946E';
  ctxM.lineWidth = 4.5;
  ctxM.beginPath();
  ctxM.arc(cx, cy, baseR * 0.80, 0, Math.PI * 2);
  ctxM.stroke();

  // Pierced crochet eyelet holes around scalloped lace edge (punch cleanly through alphaMap!)
  ctxA.fillStyle = '#000000';
  ctxM.strokeStyle = '#DFD1B8';
  ctxM.lineWidth = 2.5;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    const ex = cx + Math.cos(a) * (baseR * 0.96);
    const ey = cy + Math.sin(a) * (baseR * 0.96);
    ctxA.beginPath();
    ctxA.arc(ex, ey, 7.5, 0, Math.PI * 2);
    ctxA.fill();
    ctxM.beginPath();
    ctxM.arc(ex, ey, 9.0, 0, Math.PI * 2);
    ctxM.stroke();

    const aMid = ((i + 0.5) / petals) * Math.PI * 2;
    const mx = cx + Math.cos(aMid) * (baseR * 0.88);
    const my = cy + Math.sin(aMid) * (baseR * 0.88);
    ctxA.beginPath();
    ctxA.arc(mx, my, 4.5, 0, Math.PI * 2);
    ctxA.fill();
  }

  const map = new THREE.CanvasTexture(cMap);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const alphaMap = new THREE.CanvasTexture(cAlpha);
  alphaMap.colorSpace = THREE.NoColorSpace;
  alphaMap.anisotropy = 4;

  return { map, alphaMap };
}

/**
 * 8O. AAAA Studio Ghibli Painterly Multi-Leaf Twig Cluster Sprig (512×512 RGBA Alpha-Cutout)
 * Replaces ugly giant single-leaf banana paddles with 32 crisp painted small leaves on delicate twigs!
 */
function createGhibliLeafSprigTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(8877);

  ctx.clearRect(0, 0, size, size);

  // Delicate forked woody central twig & lateral shoots
  ctx.strokeStyle = '#5D482E';
  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(256, 488);
  ctx.quadraticCurveTo(252, 330, 260, 112);
  ctx.stroke();

  const branches: Array<[number, number, number, number]> = [
    [254, 410, 112, 300],
    [256, 396, 398, 290],
    [255, 304, 96, 198],
    [258, 294, 414, 192],
    [258, 214, 148, 108],
    [259, 206, 368, 104],
  ];
  ctx.lineWidth = 3.2;
  branches.forEach(([x0, y0, x1, y1]) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) * 0.5, (y0 + y1) * 0.5 + 16, x1, y1);
    ctx.stroke();
  });

  // 42 small, distinct hand-painted sunny Ghibli spring leaves clustered along the twigs
  const leafPalette = [
    '#70A448',
    '#82B652',
    '#94C45C',
    '#A2CE68',
    '#B4DA74',
    '#64983E',
    '#CDE484',
  ];

  const drawPaintedLeaf = (lx: number, ly: number, ang: number, len: number, wid: number, col: string) => {
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(ang);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-wid, -len * 0.28, -wid * 0.85, -len * 0.78, 0, -len);
    ctx.bezierCurveTo(wid * 0.85, -len * 0.78, wid, -len * 0.28, 0, 0);
    ctx.closePath();
    ctx.fill();

    // Sunlit painter's highlight stroke on upper half of leaf
    ctx.fillStyle = 'rgba(232, 248, 178, 0.28)';
    ctx.beginPath();
    ctx.ellipse(-wid * 0.22, -len * 0.54, wid * 0.36, len * 0.24, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // Delicate center midrib
    ctx.strokeStyle = 'rgba(210, 236, 152, 0.36)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(0, -len * 0.82);
    ctx.stroke();
    ctx.restore();
  };

  // Back shadow leaves first, then bright sunlit outer leaves
  for (let pass = 0; pass < 2; pass++) {
    branches.forEach(([x0, y0, x1, y1], bi) => {
      const steps = pass === 0 ? 4 : 5;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const bx = x0 + (x1 - x0) * t + (rand() - 0.5) * 18;
        const by = y0 + (y1 - y0) * t + (rand() - 0.5) * 18;
        const baseAng = Math.atan2(y1 - y0, x1 - x0) + Math.PI * 0.5;
        const spread = (s % 2 === 0 ? 1 : -1) * (0.45 + rand() * 0.55);
        const len = 40 + rand() * 24;
        const wid = 15 + rand() * 8;
        const col = pass === 0 ? leafPalette[(bi + s) % 3] : leafPalette[2 + ((bi + s) % 5)];
        drawPaintedLeaf(bx, by, baseAng + spread, len, wid, col);
      }
    });
    // Crown tip cluster
    for (let k = 0; k < 7; k++) {
      const a = -0.95 + (k / 6) * 1.9 + (rand() - 0.5) * 0.2;
      drawPaintedLeaf(
        256 + (rand() - 0.5) * 34,
        132 + (rand() - 0.5) * 46,
        a,
        44 + rand() * 22,
        16 + rand() * 7,
        leafPalette[3 + (k % 4)]
      );
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * 8P. Painterly Impressionist Tree Canopy Surface Texture (512×512 seamless dappled leaf clusters)
 * Gives sculpted volumetric tree crowns rich Studio Ghibli hand-painted brush foliage texture!
 */
function createPainterlyCanopySurfaceTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(3344);

  // Warm sunlit Ghibli spring meadow foliage under-tone base
  ctx.fillStyle = '#70A448';
  ctx.fillRect(0, 0, size, size);

  const dabs = [
    '#70A448',
    '#7EB250',
    '#8EC05A',
    '#9CC962',
    '#A2CE68',
    '#B6DA74',
    '#CDE484',
  ];

  // Layered painterly foliage dabs wrapped seamlessly across edges
  for (let i = 0; i < 680; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rx = 10 + rand() * 18;
    const ry = 6 + rand() * 11;
    const rot = rand() * Math.PI;
    // Slightly brighten upper palette dabs to create organic micro-clump depth
    const idx = Math.min(dabs.length - 1, Math.floor(Math.pow(rand(), 0.85) * dabs.length));
    ctx.fillStyle = dabs[idx];

    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const px = x + ox;
        const py = y + oy;
        if (px >= -28 && px <= size + 28 && py >= -28 && py <= size + 28) {
          ctx.beginPath();
          ctx.ellipse(px, py, rx, ry, rot, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // Sun-dappled crisp bright leaf sparkle flecks (wrapped seamlessly across edges)
  for (let i = 0; i < 180; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rx = 5 + rand() * 7;
    const ry = 3 + rand() * 4;
    const rot = rand() * Math.PI;
    ctx.fillStyle = 'rgba(224, 245, 162, 0.32)';
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const px = x + ox;
        const py = y + oy;
        if (px >= -16 && px <= size + 16 && py >= -16 && py <= size + 16) {
          ctx.beginPath();
          ctx.ellipse(px, py, rx, ry, rot, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.2, 2.2);
  tex.anisotropy = 8;
  return tex;
}

/**
 * 8Q. Smooth Indexed Sculpted Painterly Ghibli Tree Crown & Boxwood Puff Geometry
 * Uses indexed SphereGeometry (ZERO harsh flat-faceted polyhedron triangles!) with gentle organic billows & sunlit top-to-base gradient!
 */
export function createVolumetricCanopyPuffGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1.0, 28, 18);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const colTop = new THREE.Color('#F2FBC2');    // Airy sunlit Ghibli golden-chartreuse highlights
  const colMid = new THREE.Color('#A2CE68');    // Lively spring garden sage-lime
  const colBot = new THREE.Color('#70A448');    // Warm moss-green underside (zero muddy dark shadows!)
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // Gentle, soft organic cloud-canopy billows (smoothly periodic in 3D space so UV seam aligns!)
    const lobe =
      1.0 +
      0.11 * Math.sin(x * 3.0 + y * 2.2) * Math.cos(z * 2.8) +
      0.065 * Math.cos(x * 5.0 - z * 4.4 + y * 2.8);
    // Slightly flatten bottom & widen shoulders like a sunlit French garden oak / sculpted boxwood
    const squashY = y < 0 ? 0.76 : 0.92;
    const nx = x * lobe * 1.08;
    const ny = y * lobe * squashY;
    const nz = z * lobe * 1.08;
    pos.setXYZ(i, nx, ny, nz);

    const t = THREE.MathUtils.clamp((y + 1.0) * 0.5, 0, 1);
    if (t > 0.50) {
      tmp.lerpColors(colMid, colTop, (t - 0.50) / 0.50);
    } else {
      tmp.lerpColors(colBot, colMid, t / 0.50);
    }
    const sunBias = THREE.MathUtils.clamp(x * 0.14 + 0.05, -0.05, 0.16);
    tmp.offsetHSL(-0.01 * sunBias, 0.03 * sunBias, sunBias * 0.42);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * 8R. Matte Stoneware Ceramic Glaze PBR Set (eggshell-sage mineral glaze, zero plastic shine)
 */
function createMatteCeramicFlowerGlazeSet() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;
  const height = new Float32Array(size * size);
  const rand = seededRand(9142);

  // Warm bisque ceramic base with soft celadon mineral wash
  const baseGrad = ctx.createLinearGradient(0, 0, 0, size);
  baseGrad.addColorStop(0.0, '#EDE7DA');
  baseGrad.addColorStop(0.55, '#E4DED0');
  baseGrad.addColorStop(1.0, '#CFC4B0');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  // Matte satin glaze roughness range (0.64 .. 0.84 -> bytes 163 .. 214)
  rCtx.fillStyle = '#B8B8B8';
  rCtx.fillRect(0, 0, size, size);

  // Subtle kiln-fired mineral speckles & throwing marks wrapped horizontally
  for (let i = 0; i < 420; i++) {
    const sx = rand() * size;
    const sy = rand() * size;
    const sr = 0.6 + rand() * 1.25;
    const isIron = i % 3 === 0;
    ctx.fillStyle = isIron ? 'rgba(118, 98, 76, 0.30)' : 'rgba(255, 252, 245, 0.28)';
    rCtx.fillStyle = isIron ? 'rgba(218, 218, 218, 0.45)' : 'rgba(164, 164, 164, 0.35)';
    for (const ox of [-size, 0, size]) {
      if (sx + ox >= -sr && sx + ox <= size + sr) {
        ctx.beginPath();
        ctx.arc(sx + ox, sy, sr, 0, Math.PI * 2);
        ctx.fill();
        rCtx.beginPath();
        rCtx.arc(sx + ox, sy, sr * 1.1, 0, Math.PI * 2);
        rCtx.fill();
      }
    }
  }

  for (let y = 0; y < size; y++) {
    const uy = (y / size) * Math.PI * 2;
    const wheelBand = 0.5 + 0.14 * Math.sin(uy * 16) + 0.05 * Math.cos(uy * 32);
    for (let x = 0; x < size; x++) {
      const ux = (x / size) * Math.PI * 2;
      height[y * size + x] = wheelBand + Math.sin(ux * 6 + uy * 4) * 0.03;
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = 8;

  const normalMap = heightToNormalCanvas(height, size, size, 1.35, 1, 1);
  return { map, normalMap, roughnessMap };
}

interface RawFloraBuffers {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
}

function createEmptyFloraBuffers(): RawFloraBuffers {
  return { positions: [], normals: [], uvs: [], colors: [], indices: [] };
}

function finalizeFloraBuffers(buf: RawFloraBuffers): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(buf.normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(buf.colors, 3));
  geo.setIndex(buf.indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

function appendTransformedPetal(
  buf: RawFloraBuffers,
  length: number,
  width: number,
  cupDepth: number,
  archDrop: number,
  innerColor: THREE.Color,
  outerColor: THREE.Color,
  matrix: THREE.Matrix4
) {
  const uSeg = 4;
  const vSeg = 5;
  const baseIndex = buf.positions.length / 3;
  const vTmp = new THREE.Vector3();
  const cTmp = new THREE.Color();

  for (let iv = 0; iv <= vSeg; iv++) {
    const v = iv / vSeg; // 0 = base at receptacle, 1 = petal tip
    // Tapered botanical obovate petal silhouette (narrow claw, lush rounded upper blade)
    const widthProfile = Math.sin(Math.pow(v, 0.62) * Math.PI) * (0.35 + 0.65 * Math.sqrt(v));
    const archY = Math.sin(v * Math.PI * 0.85) * cupDepth - Math.pow(v, 2.2) * archDrop;
    const zLen = v * length;
    cTmp.lerpColors(innerColor, outerColor, Math.pow(v, 0.72));

    for (let iu = 0; iu <= uSeg; iu++) {
      const u = iu / uSeg;
      const su = (u - 0.5) * 2.0; // -1 .. +1 across petal width
      const x = su * width * 0.5 * widthProfile;
      // Gentle cupped transverse curve + subtle tip fold
      const cupLift = (su * su) * cupDepth * 0.55 * Math.sin(v * Math.PI);
      vTmp.set(x, archY + cupLift, zLen).applyMatrix4(matrix);
      buf.positions.push(vTmp.x, vTmp.y, vTmp.z);
      buf.normals.push(0, 1, 0);
      buf.uvs.push(u, v);
      buf.colors.push(cTmp.r, cTmp.g, cTmp.b);
    }
  }

  for (let iv = 0; iv < vSeg; iv++) {
    for (let iu = 0; iu < uSeg; iu++) {
      const a = baseIndex + iv * (uSeg + 1) + iu;
      const b = a + 1;
      const c = a + (uSeg + 1);
      const d = c + 1;
      buf.indices.push(a, c, b, b, c, d);
    }
  }
}

/**
 * 8S. Tapered Branching Tree Limb & Root-Flare Stem Geometry (replaces straight cylinders!)
 */
export function createOrganicTreeLimbGeometry(
  curvePoints: THREE.Vector3[],
  baseRadius: number,
  tipRadius: number,
  radialSegments = 10,
  tubularSegments = 18,
  flareRoot = false
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(curvePoints);
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const center = curve.getPointAt(t);
    const nVec = frames.normals[i];
    const bVec = frames.binormals[i];
    const rootButtress = flareRoot ? Math.pow(Math.max(0, 1 - t / 0.22), 2.0) * 0.42 : 0;
    const baseTaper = THREE.MathUtils.lerp(baseRadius, tipRadius, Math.pow(t, 0.85));

    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const theta = u * Math.PI * 2;
      const lobeMod = flareRoot
        ? 1.0 + rootButtress * (0.65 + 0.35 * Math.cos(theta * 5 + t * 2.0))
        : 1.0 + 0.04 * Math.sin(theta * 3 + t * 6.0);
      const r = baseTaper * lobeMod;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      const nx = cosT * nVec.x + sinT * bVec.x;
      const ny = cosT * nVec.y + sinT * bVec.y;
      const nz = cosT * nVec.z + sinT * bVec.z;

      positions.push(center.x + nx * r, center.y + ny * r, center.z + nz * r);
      normals.push(nx, ny, nz);
      uvs.push(u, t * 2.5);
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j;
      const b = a + 1;
      const c = a + (radialSegments + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const tipCenter = curve.getPointAt(1);
  const tipCenterIdx = positions.length / 3;
  const tangentTip = frames.tangents[tubularSegments];
  positions.push(tipCenter.x, tipCenter.y, tipCenter.z);
  normals.push(tangentTip.x, tangentTip.y, tangentTip.z);
  uvs.push(0.5, 1.0);
  const tipRingStart = tubularSegments * (radialSegments + 1);
  for (let j = 0; j < radialSegments; j++) {
    indices.push(tipRingStart + j, tipCenterIdx, tipRingStart + j + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * 8T. Sculpted Multi-Petal Cottage Rose / Peony Blossom (12 curved petals + golden center, zero toy spheres!)
 */
export function createSculptedRoseBlossomGeometry(): THREE.BufferGeometry {
  const buf = createEmptyFloraBuffers();
  const mat = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3(1, 1, 1);

  const innerShade = new THREE.Color('#D4BAC0');
  const outerShade = new THREE.Color('#FFFFFF');

  // Inner tightly cupped whorl (5 petals)
  for (let i = 0; i < 5; i++) {
    const yaw = (i / 5) * Math.PI * 2 + 0.18;
    euler.set(-0.92, yaw, 0.12, 'YXZ');
    q.setFromEuler(euler);
    pos.set(Math.sin(yaw) * 0.008, 0.005, Math.cos(yaw) * 0.008);
    mat.compose(pos, q, scl);
    appendTransformedPetal(buf, 0.036, 0.034, 0.012, 0.002, innerShade, outerShade, mat);
  }

  // Outer lush open reflexed whorl (7 petals)
  for (let i = 0; i < 7; i++) {
    const yaw = (i / 7) * Math.PI * 2 + 0.55;
    euler.set(-0.34, yaw, -0.08, 'YXZ');
    q.setFromEuler(euler);
    pos.set(Math.sin(yaw) * 0.013, 0.002, Math.cos(yaw) * 0.013);
    mat.compose(pos, q, scl);
    appendTransformedPetal(buf, 0.052, 0.044, 0.010, 0.014, innerShade, outerShade, mat);
  }

  // Small honey-gold stamen receptacle dome
  const centerR = 0.011;
  const lat = 4;
  const lon = 8;
  const domeBase = buf.positions.length / 3;
  const stamenCol = new THREE.Color('#E2B448');
  for (let i = 0; i <= lat; i++) {
    const phi = (i / lat) * (Math.PI * 0.55);
    for (let j = 0; j <= lon; j++) {
      const th = (j / lon) * Math.PI * 2;
      const sx = Math.sin(phi) * Math.cos(th) * centerR;
      const sy = Math.cos(phi) * centerR * 0.72 + 0.008;
      const sz = Math.sin(phi) * Math.sin(th) * centerR;
      buf.positions.push(sx, sy, sz);
      buf.normals.push(sx, sy, sz);
      buf.uvs.push(j / lon, i / lat);
      buf.colors.push(stamenCol.r, stamenCol.g, stamenCol.b);
    }
  }
  for (let i = 0; i < lat; i++) {
    for (let j = 0; j < lon; j++) {
      const a = domeBase + i * (lon + 1) + j;
      const b = a + 1;
      const c = a + (lon + 1);
      const d = c + 1;
      buf.indices.push(a, c, b, b, c, d);
    }
  }

  return finalizeFloraBuffers(buf);
}

/**
 * 8U. Chamomile / Meadow Daisy Blossom (10 arched cream petals + textured honey pollen disc)
 */
export function createChamomileDaisyHeadGeometry(): THREE.BufferGeometry {
  const buf = createEmptyFloraBuffers();
  const mat = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3(1, 1, 1);

  const petalInner = new THREE.Color('#F7F1DE');
  const petalOuter = new THREE.Color('#FFFDF8');
  for (let i = 0; i < 10; i++) {
    const yaw = (i / 10) * Math.PI * 2 + (i % 2) * 0.06;
    const tilt = -0.08 + (i % 2) * 0.14;
    euler.set(tilt, yaw, 0, 'YXZ');
    q.setFromEuler(euler);
    pos.set(Math.sin(yaw) * 0.011, 0.002, Math.cos(yaw) * 0.011);
    mat.compose(pos, q, scl);
    appendTransformedPetal(buf, 0.036, 0.014, 0.004, 0.010, petalInner, petalOuter, mat);
  }

  const centerR = 0.013;
  const lat = 4;
  const lon = 10;
  const domeBase = buf.positions.length / 3;
  const pollenCore = new THREE.Color('#C88820');
  const pollenRim = new THREE.Color('#E8B63E');
  const cTmp = new THREE.Color();
  for (let i = 0; i <= lat; i++) {
    const t = i / lat;
    const phi = t * (Math.PI * 0.55);
    cTmp.lerpColors(pollenRim, pollenCore, t);
    for (let j = 0; j <= lon; j++) {
      const th = (j / lon) * Math.PI * 2;
      const sx = Math.sin(phi) * Math.cos(th) * centerR;
      const sy = Math.cos(phi) * centerR * 0.65 + 0.003;
      const sz = Math.sin(phi) * Math.sin(th) * centerR;
      buf.positions.push(sx, sy, sz);
      buf.normals.push(sx, sy, sz);
      buf.uvs.push(j / lon, t);
      buf.colors.push(cTmp.r, cTmp.g, cTmp.b);
    }
  }
  for (let i = 0; i < lat; i++) {
    for (let j = 0; j < lon; j++) {
      const a = domeBase + i * (lon + 1) + j;
      const b = a + 1;
      const c = a + (lon + 1);
      const d = c + 1;
      buf.indices.push(a, c, b, b, c, d);
    }
  }

  return finalizeFloraBuffers(buf);
}

/**
 * 8V. Layered Botanical Foliage Leaf Spray (arched veined leaves on spreading shoots, zero dodecahedron blobs!)
 */
export function createLayeredLeafClusterGeometry(leafCount = 7): THREE.BufferGeometry {
  const buf = createEmptyFloraBuffers();
  const mat = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3(1, 1, 1);

  const deepBase = new THREE.Color('#426B32');
  const sunlitTip = new THREE.Color('#7FA84F');

  for (let i = 0; i < leafCount; i++) {
    const tier = i < 3 ? 0 : 1;
    const yaw = (i / leafCount) * Math.PI * 2 + tier * 0.52;
    const pitch = tier === 0 ? -0.58 : -0.22;
    euler.set(pitch, yaw, ((i % 3) - 1) * 0.14, 'YXZ');
    q.setFromEuler(euler);
    pos.set(Math.sin(yaw) * 0.016, tier === 0 ? 0.018 : 0.004, Math.cos(yaw) * 0.016);
    mat.compose(pos, q, scl);
    const len = tier === 0 ? 0.095 : 0.125;
    const wid = tier === 0 ? 0.052 : 0.064;
    appendTransformedPetal(buf, len, wid, 0.018, 0.022, deepBase, sunlitTip, mat);
  }

  return finalizeFloraBuffers(buf);
}

/**
 * 8W. Sculpted Delphinium / Foxglove Blossom Spire (tapering leafy green stem + 11 spirally arrayed cupped florets!)
 */
export function createDelphiniumSpikeGeometry(): THREE.BufferGeometry {
  const buf = createEmptyFloraBuffers();
  const mat = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3(1, 1, 1);

  // Slender tapered green floral stem
  const stemBase = buf.positions.length / 3;
  const stemSegs = 6;
  const stemRads = 6;
  const stemBot = new THREE.Color('#446C30');
  const stemTop = new THREE.Color('#6F9848');
  const cTmp = new THREE.Color();
  for (let i = 0; i <= stemSegs; i++) {
    const t = i / stemSegs;
    const y = t * 0.66;
    const rad = THREE.MathUtils.lerp(0.0065, 0.0022, t);
    cTmp.lerpColors(stemBot, stemTop, t);
    for (let j = 0; j <= stemRads; j++) {
      const th = (j / stemRads) * Math.PI * 2;
      const sx = Math.cos(th) * rad;
      const sz = Math.sin(th) * rad;
      buf.positions.push(sx, y, sz);
      buf.normals.push(Math.cos(th), 0, Math.sin(th));
      buf.uvs.push(j / stemRads, t);
      buf.colors.push(cTmp.r, cTmp.g, cTmp.b);
    }
  }
  for (let i = 0; i < stemSegs; i++) {
    for (let j = 0; j < stemRads; j++) {
      const a = stemBase + i * (stemRads + 1) + j;
      const b = a + 1;
      const c = a + (stemRads + 1);
      const d = c + 1;
      buf.indices.push(a, c, b, b, c, d);
    }
  }

  // 11 Spirally ascending 3-petal cupped delphinium blossoms tapering up the spire
  const floretBase = new THREE.Color('#6F66BA');
  const floretTip = new THREE.Color('#DBD2FA');
  for (let f = 0; f < 11; f++) {
    const u = f / 10;
    const fy = 0.24 + u * 0.40;
    const spiralYaw = f * 2.18;
    const flowerScale = THREE.MathUtils.lerp(1.08, 0.42, u);
    const outX = Math.sin(spiralYaw) * 0.011;
    const outZ = Math.cos(spiralYaw) * 0.011;
    for (let p = 0; p < 3; p++) {
      const pYaw = spiralYaw + (p - 1) * 0.65;
      euler.set(0.35 + (p === 1 ? -0.18 : 0.12), pYaw, 0, 'YXZ');
      q.setFromEuler(euler);
      pos.set(outX, fy, outZ);
      scl.setScalar(flowerScale);
      mat.compose(pos, q, scl);
      appendTransformedPetal(buf, 0.036, 0.022, 0.009, 0.010, floretBase, floretTip, mat);
    }
  }

  return finalizeFloraBuffers(buf);
}

export function createMeadowGrassTuftGeometry(): THREE.BufferGeometry {
  // Low, broad, outward-arching Ghibli clover & plush turf cushions (0.06 - 0.095m tall — ZERO tall spiky blades!)
  const blades = 6;
  const segs = 4;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const rootCol = new THREE.Color('#85AE56');
  const midCol = new THREE.Color('#A8CE6A');
  const tipCol = new THREE.Color('#D2E688');
  const tmpCol = new THREE.Color();

  for (let b = 0; b < blades; b++) {
    const yaw = (b / blades) * Math.PI * 2 + (b % 2) * 0.28 + b * 0.14;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const bladeH = 0.062 + (b % 3) * 0.015;
    const archOut = 0.072 + (b % 3) * 0.014;
    const baseHalfW = 0.044;
    const ox = cosY * 0.016;
    const oz = sinY * 0.016;

    const baseVert = positions.length / 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      // Soft rounded dome rise that curls gently outward at the petal/clover tip
      const y = Math.sin(t * Math.PI * 0.62) * bladeH;
      const bend = Math.pow(t, 1.15) * archOut;
      // Broad rounded leaf/clover profile (swells in middle, gently rounded tip instead of sharp needle)
      const leafProfile = 0.36 + 0.92 * Math.sin(Math.pow(t, 0.72) * Math.PI * 0.92);
      const w = baseHalfW * leafProfile;
      const cx = ox + cosY * bend;
      const cz = oz + sinY * bend;

      const sideX = -sinY * w;
      const sideZ = cosY * w;

      if (t < 0.5) {
        tmpCol.lerpColors(rootCol, midCol, t * 2.0);
      } else {
        tmpCol.lerpColors(midCol, tipCol, (t - 0.5) * 2.0);
      }

      positions.push(cx - sideX, y, cz - sideZ);
      colors.push(tmpCol.r, tmpCol.g, tmpCol.b);
      uvs.push(0, t);

      positions.push(cx + sideX, y, cz + sideZ);
      colors.push(tmpCol.r, tmpCol.g, tmpCol.b);
      uvs.push(1, t);
    }

    for (let s = 0; s < segs; s++) {
      const r0 = baseVert + s * 2;
      const r1 = r0 + 2;
      indices.push(r0, r0 + 1, r1, r0 + 1, r1 + 1, r1);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

export interface CottageCraftAssetPack {
  tiffanyWindowTex: THREE.CanvasTexture;
  tiffanyTransomTex: THREE.CanvasTexture;
  botanicalBorderGlassTex: THREE.CanvasTexture;
  botanicalDoorMedallionTex: THREE.CanvasTexture;
  transomFloralGlassTex: THREE.CanvasTexture;
  circularRoseGlassTex: THREE.CanvasTexture;
  wallpaperTex: THREE.CanvasTexture;
  beadboard: { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture };
  pineRoof: { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture };
  wideOakTable: { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture };
  flagstone: { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture };
  rubbleStone: { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture };
  buttercreamSwirl: { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture };
  wovenRattan: { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture };
  glazedPottery: { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture };
  matteCeramicGlaze: { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture };
  flourSackTex: THREE.CanvasTexture;
  juteRunnerTex: THREE.CanvasTexture;
  ginghamTex: THREE.CanvasTexture;
  pegboardTex: THREE.CanvasTexture;
  floralRugTex: THREE.CanvasTexture;
  stonewareTex: THREE.CanvasTexture;
  birchBarkTex: THREE.CanvasTexture;
  clockDialTex: THREE.CanvasTexture;
  floralCeramicTex: THREE.CanvasTexture;
  floralHandleTex: THREE.CanvasTexture;
  cottageRunnerTex: THREE.CanvasTexture;
  lacePlacematMaps: { map: THREE.CanvasTexture; alphaMap: THREE.CanvasTexture };
  ghibliLeafSprigTex: THREE.CanvasTexture;
  painterlyCanopyTex: THREE.CanvasTexture;
}

let cachedCottagePack: CottageCraftAssetPack | null = null;

export function getCottageCraftAssets(): CottageCraftAssetPack {
  if (!cachedCottagePack) {
    cachedCottagePack = {
      tiffanyWindowTex: createTiffanyStainedGlassTexture(),
      tiffanyTransomTex: createTiffanyTransomTexture(),
      botanicalBorderGlassTex: createBotanicalBorderGlassTexture(),
      botanicalDoorMedallionTex: createBotanicalDoorMedallionTexture(),
      transomFloralGlassTex: createTransomFloralGlassTexture(),
      circularRoseGlassTex: createCircularRoseGlassTexture(),
      wallpaperTex: createBotanicalWallpaperTexture(),
      beadboard: createBeadboardWainscotSet(),
      pineRoof: createTongueAndGroovePineSet(),
      wideOakTable: createWidePlankOakTabletopSet(),
      flagstone: createCrazyPavingFlagstoneSet(),
      rubbleStone: createRandomRubbleStoneSet(),
      buttercreamSwirl: createRusticButtercreamSwirlSet(),
      wovenRattan: createWovenRattanSet(),
      glazedPottery: createArtisanGlazedPotterySet(),
      matteCeramicGlaze: createMatteCeramicFlowerGlazeSet(),
      flourSackTex: createFrenchFlourSackTexture(),
      juteRunnerTex: createJuteRunnerRugTexture(),
      ginghamTex: createRedGinghamTexture(),
      pegboardTex: createPegboardTexture(),
      floralRugTex: createFloralTapestryRugTexture(),
      stonewareTex: createSpeckledStonewareTexture(),
      birchBarkTex: createBirchBarkTexture(),
      clockDialTex: createVintageClockDialTexture(),
      floralCeramicTex: createFloralCeramicTexture(),
      floralHandleTex: createFloralHandleTexture(),
      cottageRunnerTex: createCottageTableRunnerTexture(),
      lacePlacematMaps: createCrochetLacePlacematMaps(),
      ghibliLeafSprigTex: createGhibliLeafSprigTexture(),
      painterlyCanopyTex: createPainterlyCanopySurfaceTexture(),
    };
  }
  return cachedCottagePack;
}
