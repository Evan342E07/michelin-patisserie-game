import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { patisserieAudio } from '../../audio/patisserieAudio';
import { enhanceWithStylizedFresnelRim } from '../../shaders/stylizedCozyUpgrades';
import { getAtelierTextures } from '../../textures/atelierTextures';
import {
  createBeveledBoxGeometry,
  createBrassSwanFaucetSpoutGeometry,
  createCitrusLeafGeometry,
  createEggSwingRimTubeGeometry,
  createEggSwingShellGeometry,
  createEspressoSaucerGeometry,
  createFrenchChairLegGeometry,
  createGableCatHouseGeometry,
  createGlassVesselGeometry,
  createScallopedCredenzaApronGeometry,
  createViolinSplatBackrestGeometry,
} from '../../geometry/patisserieGeometry';
import {
  createChamomileDaisyHeadGeometry,
  createLayeredLeafClusterGeometry,
  createMonsteraLeafGeometry,
  createOrganicTreeLimbGeometry,
  createSculptedRoseBlossomGeometry,
  createSwordFernFrondGeometry,
  getCottageCraftAssets,
} from '../environment/cottageTexturesAndFlora';
import {
  createArchedToastSliceGeo,
  createBakedCrustPbr,
  createCatFurPbr,
  createGlassClocheBellGeo,
  createHollowFlutedBundtGeo,
  createHollowVesselLatheGeo,
  createLaminatedCroissantGeo,
  createMicroSurfaceMaps,
  createScoredSourdoughBouleGeo,
  createTreeStumpTopTexture,
  createTurnedBalusterLegGeo,
  createWoodGrainPbr,
  createWovenFabricPbr,
} from './cottageHighCraftPbr';

const LINEN_SCALE = new THREE.Vector2(0.60, 0.60);

/**
 * Distressed Shabby-Chic Cream-Painted Plank Texture (`f95ce79d` Tabletop!)
 */
function createDistressedTablePlankTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#F6EFE0';
  ctx.fillRect(0, 0, size, size);

  let rng = 7171;
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 4294967296;
  };

  const planks = 5;
  const pw = size / planks;
  for (let p = 0; p < planks; p++) {
    const x = p * pw;
    ctx.fillStyle = p % 2 === 0 ? '#F8F1E2' : '#EFE5CF';
    ctx.fillRect(x, 0, pw, size);

    ctx.fillStyle = '#7E502B';
    ctx.fillRect(x, 0, 3.5, size);
    for (let k = 0; k < 24; k++) {
      ctx.fillStyle = 'rgba(148, 96, 50, 0.58)';
      ctx.fillRect(x + (rand() < 0.5 ? 2 : pw - 7), rand() * size, 3 + rand() * 6, 10 + rand() * 34);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Openwork Hand-Crocheted Ecru Lace Doily / Cloth Texture (`f95ce79d` Lace!)
 */
function createCrochetLaceClothTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(250, 243, 226, 0.84)';
  ctx.fillRect(14, 14, size - 28, size - 28);

  ctx.strokeStyle = '#F7EFE0';
  ctx.lineWidth = 2.5;
  for (let y = 22; y < size - 22; y += 16) {
    for (let x = 22; x < size - 22; x += 16) {
      ctx.clearRect(x, y, 6, 6);
      ctx.strokeRect(x - 2, y - 2, 10, 10);
    }
  }

  ctx.fillStyle = '#FAF3E3';
  for (let i = 16; i < size - 16; i += 20) {
    [14, size - 14].forEach((edge) => {
      ctx.beginPath();
      ctx.arc(i, edge, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(edge, i, 9, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Vintage French Pastoral Blue-Green Floral Porcelain Plate Texture (`f95ce79d` Dish Rack & `282f8d29`)
 */
function createFloralPlateTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;

  ctx.fillStyle = '#FBF5E8';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#527060';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(c, c, 108, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c, c, 82, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.fillStyle = i % 2 === 0 ? '#5C7E68' : '#7D9B84';
    ctx.beginPath();
    ctx.arc(c + Math.cos(a) * 95, c + Math.sin(a) * 95, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Center botanical bouquet
  ctx.fillStyle = '#62846E';
  ctx.beginPath();
  ctx.arc(c, c, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#E6A09A';
  ctx.beginPath();
  ctx.arc(c, c, 9, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Vintage Botanical Herbarium Watercolor Illustration (`256×256` Framed Cottage Art)
 */
function createBotanicalIllustrationTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Warm French archival cotton paper
  ctx.fillStyle = '#F7EFE0';
  ctx.fillRect(0, 0, size, size);

  // Double antique gold-olive border rule
  ctx.strokeStyle = '#9C7B48';
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, size - 28, size - 28);
  ctx.strokeStyle = '#C4A874';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(21, 21, size - 42, size - 42);

  // Arching sage botanical stems
  ctx.strokeStyle = '#4B7240';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(96, 206);
  ctx.quadraticCurveTo(122, 138, 134, 68);
  ctx.stroke();

  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(116, 152);
  ctx.quadraticCurveTo(84, 128, 72, 102);
  ctx.moveTo(126, 124);
  ctx.quadraticCurveTo(164, 114, 184, 92);
  ctx.stroke();

  // Veined emerald-sage foliage leaves
  const leaves: Array<[number, number, number, number, number, string]> = [
    [92, 162, 18, 8, -0.55, '#537E47'],
    [136, 148, 20, 9, 0.45, '#466E3C'],
    [78, 124, 15, 7, -0.85, '#669258'],
    [164, 108, 17, 7.5, 0.25, '#537E47'],
    [108, 92, 14, 6.5, -0.4, '#669258'],
  ];
  for (const [lx, ly, rx, ry, rot, col] of leaves) {
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(rot);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3B5C32';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-rx * 0.75, 0);
    ctx.lineTo(rx * 0.75, 0);
    ctx.stroke();
    ctx.restore();
  }

  // Hero Blush-Coral Garden Rose & Side Rosebud
  const drawRose = (cx: number, cy: number, r: number) => {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      ctx.fillStyle = k % 2 === 0 ? '#D46272' : '#E3828E';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.45, r * 0.56, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#F0A4AC';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.44, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F2C364';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.19, 0, Math.PI * 2);
    ctx.fill();
  };
  drawRose(134, 72, 26);
  drawRose(182, 92, 15);

  // Cream Chamomile Blossom Sprig
  const drawDaisy = (cx: number, cy: number, r: number) => {
    ctx.fillStyle = '#FFFDF6';
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * r * 0.65, cy + Math.sin(a) * r * 0.65, r * 0.45, r * 0.24, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#E8B23A';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
  };
  drawDaisy(72, 102, 16);

  // Fine archival herbarium caption lines at bottom
  ctx.fillStyle = '#7C6242';
  ctx.fillRect(88, 222, 80, 2);
  ctx.fillStyle = '#A88E68';
  ctx.fillRect(104, 229, 48, 1.5);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Airy Curved-Spindle Honey-Wood & Floral-Cushion Cottage Garden Chair
 * High-craft 20-seg tapered legs, Lathe dished wooden saddle seat, 14-seg spindles & 16x32 bentwood hoop!
 */
/**
 * Carved French Provincial Violin-Splat Salon Chair (`5adf50b1` craftsmanship!)
 * Features fluted turned legs, beveled saddle seat, laced floral cushion with knotted rear bows,
 * turned rear stiles with acorn finials & openwork carved violin/vase splat crest!
 */
const FrenchViolinSplatSalonChair: React.FC<{
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: number;
  woodMat: THREE.Material;
  cushionMat: THREE.Material;
  laceMat?: THREE.Material;
}> = ({ position, rotation, scale = 1.18, woodMat, cushionMat, laceMat }) => {
  const { legGeo, seatWoodGeo, cushionGeo, splatBackGeo } = useMemo(() => {
    return {
      legGeo: createFrenchChairLegGeometry(0.415, 0.022),
      seatWoodGeo: createBeveledBoxGeometry(0.415, 0.030, 0.395, 0.018, 0.008, 0.008, 3),
      cushionGeo: createBeveledBoxGeometry(0.382, 0.036, 0.362, 0.022, 0.014, 0.014, 4),
      splatBackGeo: createViolinSplatBackrestGeometry(0.355, 0.48),
    };
  }, []);

  useEffect(() => {
    return () => {
      legGeo.dispose();
      seatWoodGeo.dispose();
      cushionGeo.dispose();
      splatBackGeo.dispose();
    };
  }, [legGeo, seatWoodGeo, cushionGeo, splatBackGeo]);

  const legs: Array<[number, number]> = [
    [-0.165, -0.155],
    [0.165, -0.155],
    [-0.165, 0.155],
    [0.165, 0.155],
  ];

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Turned & Fluted French Salon Legs strictly grounded y = 0.000..0.415 */}
      {legs.map(([lx, lz], idx) => (
        <mesh key={`fleg-${idx}`} position={[lx, 0, lz]} geometry={legGeo} material={woodMat} castShadow receiveShadow />
      ))}
      {/* Grounded H-Frame Stretchers joining all 4 legs solidly */}
      {[-0.165, 0.165].map((sx, si) => (
        <mesh key={`fsrail-${si}`} position={[sx, 0.138, 0]} rotation={[Math.PI / 2, 0, 0]} material={woodMat}>
          <cylinderGeometry args={[0.0085, 0.0085, 0.31, 12]} />
        </mesh>
      ))}
      <mesh position={[0, 0.138, 0]} rotation={[0, 0, Math.PI / 2]} material={woodMat}>
        <cylinderGeometry args={[0.0085, 0.0085, 0.33, 12]} />
      </mesh>

      {/* Beveled French Honey-Oak Seat Base & Under-Apron Trim */}
      <mesh position={[0, 0.415, 0]} geometry={seatWoodGeo} material={woodMat} castShadow receiveShadow />

      {/* Tailored Floral Linen Cushion + Ruffled Cream Crochet Lace Skirt + Knotted Back Tie-Bows */}
      <mesh position={[0, 0.446, 0.005]} geometry={cushionGeo} material={cushionMat} castShadow receiveShadow />
      <mesh position={[0, 0.432, 0.005]} scale={[1.0, 0.18, 0.96]} material={laceMat ?? cushionMat}>
        <cylinderGeometry args={[0.198, 0.212, 0.085, 24, 1, true]} />
      </mesh>
      {[-0.155, 0.155].map((tx, ti) => (
        <group key={`tie-bow-${ti}`} position={[tx, 0.445, -0.178]}>
          {[-0.016, 0.016].map((bx, bi) => (
            <mesh key={bi} position={[bx, 0, -0.012]} rotation={[0.4, (bi === 0 ? -1 : 1) * 0.45, 0]} scale={[1.2, 0.55, 0.65]} material={laceMat ?? cushionMat}>
              <sphereGeometry args={[0.014, 10, 8]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Gently Reclined Carved French Violin-Splat Backrest + Turned Rear Stiles & Acorn Finials */}
      <group position={[0, 0.425, -0.172]} rotation={[-0.12, 0, 0]}>
        {[-0.178, 0.178].map((sx, si) => (
          <group key={`stile-post-${si}`} position={[sx, 0, 0]}>
            <mesh position={[0, 0.242, 0]} material={woodMat} castShadow>
              <cylinderGeometry args={[0.014, 0.016, 0.484, 16]} />
            </mesh>
            <mesh position={[0, 0.495, 0]} scale={[0.92, 1.35, 0.92]} material={woodMat} castShadow>
              <sphereGeometry args={[0.018, 14, 12]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.012, 0]} geometry={splatBackGeo} material={woodMat} castShadow receiveShadow />
      </group>
    </group>
  );
};

/**
 * 4-Layer Multi-Species Living Botanical Plant Wall (`970bb675` Masterpiece!)
 * Layer 1: Framed Velvet Moss Backing | Layer 2: Split-Leaf Monstera + Sword Ferns + Trailing Ivy
 * Layer 3: Woven-Basket Potted Areca Palm | Layer 4: Dual Vintage Brass Grazing Spotlights!
 */
const MultiSpeciesLivingPlantWall: React.FC<{
  timberMat: THREE.Material;
  brassMat: THREE.Material;
  wickerMat: THREE.Material;
}> = ({ timberMat, brassMat, wickerMat }) => {
  const mossInstRef = useRef<THREE.InstancedMesh>(null);
  const ivyInstRef = useRef<THREE.InstancedMesh>(null);
  const pearlInstRef = useRef<THREE.InstancedMesh>(null);
  const fernInstRef = useRef<THREE.InstancedMesh>(null);
  const monsteraInstRef = useRef<THREE.InstancedMesh>(null);
  const hydrangeaInstRef = useRef<THREE.InstancedMesh>(null);
  const roseInstRef = useRef<THREE.InstancedMesh>(null);
  const gypsoInstRef = useRef<THREE.InstancedMesh>(null);

  const {
    mossGeo,
    ivyGeo,
    pearlGeo,
    fernGeo,
    monsteraGeo,
    floretGeo,
    roseGeo,
    gypsoGeo,
    seagrassPotGeo,
    barkSlabGeo,
    corkBarkMat,
    soilMat,
  } = useMemo(() => {
    const mGeo = new THREE.SphereGeometry(0.068, 12, 10);
    mGeo.scale(0.55, 1.0, 1.15);
    const pGeo = new THREE.SphereGeometry(0.011, 10, 8);
    const fGeo = new THREE.CircleGeometry(0.019, 7);
    const gGeo = new THREE.DodecahedronGeometry(0.0085, 0);
    return {
      mossGeo: mGeo,
      ivyGeo: createCitrusLeafGeometry(),
      pearlGeo: pGeo,
      fernGeo: createSwordFernFrondGeometry(),
      monsteraGeo: createMonsteraLeafGeometry(),
      floretGeo: fGeo,
      roseGeo: createSculptedRoseBlossomGeometry(),
      gypsoGeo: gGeo,
      seagrassPotGeo: createHollowVesselLatheGeo(0.145, 0.215, 0.175, 0.34, 0.012, 26),
      barkSlabGeo: createBeveledBoxGeometry(0.036, 0.34, 0.14, 0.014, 0.010, 0.010, 2),
      corkBarkMat: new THREE.MeshStandardMaterial({ color: '#5A3E2A', roughness: 0.94 }),
      soilMat: new THREE.MeshStandardMaterial({ color: '#382518', roughness: 0.96 }),
    };
  }, []);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let rng = 6180;
    const rand = () => {
      rng = (rng * 1664525 + 1013904223) >>> 0;
      return rng / 4294967296;
    };

    // Layer 1: 56 Velvet Cushion Moss Mounds
    const moss = mossInstRef.current;
    if (moss) {
      const mossTones = [0x295622, 0x35682a, 0x457c32, 0x568b3b];
      for (let i = 0; i < 56; i++) {
        dummy.position.set(-4.985 + rand() * 0.03, 0.44 + rand() * 2.80, 1.88 + rand() * 2.42);
        dummy.rotation.set((rand() - 0.5) * 0.6, 0, (rand() - 0.5) * 0.4);
        dummy.scale.set(0.85 + rand() * 0.5, 0.85 + rand() * 0.85, 0.85 + rand() * 0.85);
        dummy.updateMatrix();
        moss.setMatrixAt(i, dummy.matrix);
        color.setHex(mossTones[i % mossTones.length]);
        moss.setColorAt(i, color);
      }
      moss.instanceMatrix.needsUpdate = true;
      if (moss.instanceColor) moss.instanceColor.needsUpdate = true;
    }

    // Layer 2: 320 Variegated Pothos & Trailing Cascade Ivy Leaves (includes bottom-edge cascades!)
    const ivy = ivyInstRef.current;
    if (ivy) {
      const greens = [0x2d5e24, 0x3e7430, 0x528b3e, 0x73aa52, 0x89ba68];
      for (let i = 0; i < 320; i++) {
        const isLowerCascade = i >= 272;
        let z = 1.88 + rand() * 2.42;
        let y = 0.45 + rand() * 2.78;
        if (isLowerCascade) {
          const flankLeft = i % 2 === 0;
          z = flankLeft ? 1.87 + rand() * 0.34 : 3.92 + rand() * 0.40;
          y = 0.14 + rand() * 0.34;
        }
        dummy.position.set(-4.95 + rand() * 0.13, y, z);
        dummy.rotation.set(
          (rand() - 0.5) * 0.9,
          Math.PI * 0.5 + (rand() - 0.5) * 0.85,
          isLowerCascade ? -0.95 - rand() * 0.45 : -0.35 - rand() * 0.65
        );
        dummy.scale.setScalar(isLowerCascade ? 1.15 + rand() * 0.65 : 1.45 + rand() * 1.10);
        dummy.updateMatrix();
        ivy.setMatrixAt(i, dummy.matrix);
        color.setHex(greens[i % greens.length]);
        ivy.setColorAt(i, color);
      }
      ivy.instanceMatrix.needsUpdate = true;
      if (ivy.instanceColor) ivy.instanceColor.needsUpdate = true;
    }

    // Layer 3: 126 Beaded String-of-Pearls Tendrils cascading down upper shelves & flanks below frame
    const pearls = pearlInstRef.current;
    if (pearls) {
      const pearlTones = [0x6fa656, 0x82b868, 0x5e9448];
      const anchors = [
        { z: 1.94, topY: 0.48, len: 11 },
        { z: 2.08, topY: 0.46, len: 10 },
        { z: 2.20, topY: 0.44, len: 9 },
        { z: 3.94, topY: 0.46, len: 10 },
        { z: 4.10, topY: 0.48, len: 11 },
        { z: 4.26, topY: 0.45, len: 9 },
        { z: 2.48, topY: 2.95, len: 14 },
        { z: 2.86, topY: 3.12, len: 13 },
        { z: 3.34, topY: 3.04, len: 14 },
        { z: 3.74, topY: 2.88, len: 13 },
        { z: 4.02, topY: 2.52, len: 12 },
      ];
      let pi = 0;
      for (const a of anchors) {
        for (let b = 0; b < a.len && pi < 126; b++) {
          const drop = b * 0.028;
          dummy.position.set(
            -4.88 + Math.sin(b * 0.6 + a.z) * 0.012,
            a.topY - drop,
            a.z + Math.cos(b * 0.55 + a.topY) * 0.015
          );
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(1.0 - (b / a.len) * 0.35);
          dummy.updateMatrix();
          pearls.setMatrixAt(pi, dummy.matrix);
          color.setHex(pearlTones[pi % pearlTones.length]);
          pearls.setColorAt(pi, color);
          pi++;
        }
      }
      while (pi < 126) {
        dummy.position.set(-4.88, 2.2, 2.5);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        pearls.setMatrixAt(pi++, dummy.matrix);
      }
      pearls.instanceMatrix.needsUpdate = true;
      if (pearls.instanceColor) pearls.instanceColor.needsUpdate = true;
    }

    // Layer 4: 96 Arched Boston Sword Fern Fronds (`波士顿蕨`)
    const fern = fernInstRef.current;
    if (fern) {
      const fernGreens = [0x4b8438, 0x5e9a46, 0x3e722e, 0x6ea852];
      for (let i = 0; i < 96; i++) {
        const cluster = i % 8;
        const cz = 1.98 + cluster * 0.32 + (rand() - 0.5) * 0.18;
        const cy = 0.72 + ((i * 3) % 5) * 0.50 + (rand() - 0.5) * 0.18;
        dummy.position.set(-4.91 + rand() * 0.09, cy, cz);
        dummy.rotation.set(0.55 + rand() * 0.65, Math.PI * 0.5 + (rand() - 0.5) * 1.3, (rand() - 0.5) * 0.5);
        dummy.scale.setScalar(0.84 + rand() * 0.44);
        dummy.updateMatrix();
        fern.setMatrixAt(i, dummy.matrix);
        color.setHex(fernGreens[i % fernGreens.length]);
        fern.setColorAt(i, color);
      }
      fern.instanceMatrix.needsUpdate = true;
      if (fern.instanceColor) fern.instanceColor.needsUpdate = true;
    }

    // Layer 5: 44 Sculpted Split-Leaf Monstera Deliciosa Blades
    const mon = monsteraInstRef.current;
    if (mon) {
      const monGreens = [0x2a5a24, 0x386c2e, 0x457c38];
      for (let i = 0; i < 44; i++) {
        const z = 1.95 + rand() * 2.28;
        const y = 0.70 + rand() * 2.34;
        dummy.position.set(-4.87 + rand() * 0.12, y, z);
        dummy.rotation.set(0.35 + rand() * 0.45, Math.PI * 0.5 + (rand() - 0.5) * 0.85, (rand() - 0.5) * 0.45);
        dummy.scale.setScalar(0.76 + rand() * 0.46);
        dummy.updateMatrix();
        mon.setMatrixAt(i, dummy.matrix);
        color.setHex(monGreens[i % monGreens.length]);
        mon.setColorAt(i, color);
      }
      mon.instanceMatrix.needsUpdate = true;
      if (mon.instanceColor) mon.instanceColor.needsUpdate = true;
    }

    // Layer 6: 8 Pastel Hydrangea Mophead Umbels (`绣球花`) + 18 Climbing Cottage Roses + Baby's Breath Mist!
    const hyd = hydrangeaInstRef.current;
    if (hyd) {
      const mopCenters = [
        { y: 2.35, z: 2.22, hex: 0x9cbbe8 },
        { y: 2.72, z: 2.76, hex: 0xcab2e6 },
        { y: 1.56, z: 2.42, hex: 0xf4c2ca },
        { y: 2.02, z: 3.18, hex: 0xa6c4ec },
        { y: 2.78, z: 3.68, hex: 0xf6efe2 },
        { y: 1.48, z: 3.84, hex: 0xcfb8e8 },
        { y: 2.24, z: 4.12, hex: 0x9cbbe8 },
        { y: 1.72, z: 2.86, hex: 0xf6efe2 },
      ];
      let hi = 0;
      for (let m = 0; m < mopCenters.length; m++) {
        const mc = mopCenters[m];
        for (let k = 0; k < 14 && hi < 112; k++) {
          const th = (k / 14) * Math.PI * 2 + m;
          const ph = 0.25 + (k % 3) * 0.42;
          const r = 0.068;
          dummy.position.set(
            -4.84 + Math.sin(ph) * 0.045,
            mc.y + Math.cos(th) * r * Math.cos(ph),
            mc.z + Math.sin(th) * r
          );
          dummy.rotation.set(rand() * 0.8, Math.PI * 0.5 + (rand() - 0.5) * 0.9, rand() * 0.8);
          dummy.scale.setScalar(0.95 + rand() * 0.45);
          dummy.updateMatrix();
          hyd.setMatrixAt(hi, dummy.matrix);
          color.setHex(mc.hex).offsetHSL(0, 0, (rand() - 0.5) * 0.08);
          hyd.setColorAt(hi, color);
          hi++;
        }
      }
      hyd.instanceMatrix.needsUpdate = true;
      if (hyd.instanceColor) hyd.instanceColor.needsUpdate = true;
    }

    const roses = roseInstRef.current;
    if (roses) {
      const rosePalette = [0xf29ca8, 0xf6bea0, 0xfaf0e2, 0xe88696];
      for (let i = 0; i < 18; i++) {
        dummy.position.set(-4.84 + rand() * 0.05, 0.95 + rand() * 2.15, 2.02 + rand() * 2.20);
        dummy.rotation.set((rand() - 0.5) * 0.6, Math.PI * 0.5 + (rand() - 0.5) * 0.8, -0.35);
        dummy.scale.setScalar(0.95 + rand() * 0.45);
        dummy.updateMatrix();
        roses.setMatrixAt(i, dummy.matrix);
        color.setHex(rosePalette[i % rosePalette.length]);
        roses.setColorAt(i, color);
      }
      roses.instanceMatrix.needsUpdate = true;
      if (roses.instanceColor) roses.instanceColor.needsUpdate = true;
    }

    const gypso = gypsoInstRef.current;
    if (gypso) {
      for (let i = 0; i < 110; i++) {
        dummy.position.set(-4.83 + rand() * 0.06, 0.88 + rand() * 2.30, 1.94 + rand() * 2.32);
        dummy.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
        dummy.scale.setScalar(0.75 + rand() * 0.65);
        dummy.updateMatrix();
        gypso.setMatrixAt(i, dummy.matrix);
        color.setHex(i % 4 === 0 ? 0xfcf8ec : 0xffffff);
        gypso.setColorAt(i, color);
      }
      gypso.instanceMatrix.needsUpdate = true;
      if (gypso.instanceColor) gypso.instanceColor.needsUpdate = true;
    }
  }, []);

  useEffect(() => {
    return () => {
      mossGeo.dispose();
      ivyGeo.dispose();
      pearlGeo.dispose();
      fernGeo.dispose();
      monsteraGeo.dispose();
      floretGeo.dispose();
      roseGeo.dispose();
      gypsoGeo.dispose();
      seagrassPotGeo.dispose();
      barkSlabGeo.dispose();
      corkBarkMat.dispose();
      soilMat.dispose();
    };
  }, [
    mossGeo,
    ivyGeo,
    pearlGeo,
    fernGeo,
    monsteraGeo,
    floretGeo,
    roseGeo,
    gypsoGeo,
    seagrassPotGeo,
    barkSlabGeo,
    corkBarkMat,
    soilMat,
  ]);

  const barkLocations = [
    { y: 2.58, z: 2.18, r: 0.14 },
    { y: 1.72, z: 2.66, r: -0.22 },
    { y: 2.86, z: 3.44, r: 0.18 },
    { y: 1.38, z: 3.92, r: -0.15 },
    { y: 2.08, z: 4.18, r: 0.10 },
  ];

  return (
    <group>
      {/* Layer 1: Framed Velvet Forest-Moss Backing Board + Sculpted Cork/Driftwood Bark Plates */}
      <mesh position={[-5.03, 1.85, 3.10]} castShadow receiveShadow>
        <boxGeometry args={[0.06, 2.96, 2.58]} />
        <meshStandardMaterial color="#2C4E22" roughness={0.95} />
      </mesh>
      {[1.81, 4.39].map((fz, fi) => (
        <mesh key={fi} position={[-5.00, 1.85, fz]} material={timberMat} castShadow>
          <boxGeometry args={[0.09, 3.02, 0.06]} />
        </mesh>
      ))}
      {[0.36, 3.34].map((fy, fi) => (
        <mesh key={fi} position={[-5.00, fy, 3.10]} material={timberMat} castShadow>
          <boxGeometry args={[0.09, 0.06, 2.64]} />
        </mesh>
      ))}
      {barkLocations.map((bk, bi) => (
        <mesh
          key={`bark-${bi}`}
          position={[-4.975, bk.y, bk.z]}
          rotation={[bk.r, 0, 0]}
          geometry={barkSlabGeo}
          material={corkBarkMat}
          castShadow
        />
      ))}

      {/* Layers 2–6: Multi-Species Living Wall Ecosystem (`raycast={() => null}` on non-interactive foliage) */}
      <instancedMesh ref={mossInstRef} args={[mossGeo, undefined, 56]} receiveShadow raycast={() => null}>
        <meshStandardMaterial roughness={0.92} />
      </instancedMesh>
      <instancedMesh ref={ivyInstRef} args={[ivyGeo, undefined, 320]} castShadow receiveShadow raycast={() => null}>
        <meshPhysicalMaterial roughness={0.58} clearcoat={0.08} envMapIntensity={0.34} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={pearlInstRef} args={[pearlGeo, undefined, 126]} castShadow raycast={() => null}>
        <meshPhysicalMaterial roughness={0.44} clearcoat={0.14} envMapIntensity={0.36} />
      </instancedMesh>
      <instancedMesh ref={fernInstRef} args={[fernGeo, undefined, 96]} castShadow receiveShadow raycast={() => null}>
        <meshPhysicalMaterial roughness={0.62} clearcoat={0.06} envMapIntensity={0.34} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={monsteraInstRef} args={[monsteraGeo, undefined, 44]} castShadow receiveShadow raycast={() => null}>
        <meshPhysicalMaterial roughness={0.52} clearcoat={0.12} envMapIntensity={0.34} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={hydrangeaInstRef} args={[floretGeo, undefined, 112]} castShadow raycast={() => null}>
        <meshPhysicalMaterial roughness={0.58} sheen={0.42} sheenColor="#FFF8F8" side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={roseInstRef} args={[roseGeo, undefined, 18]} castShadow raycast={() => null}>
        <meshPhysicalMaterial roughness={0.48} sheen={0.48} sheenColor="#FFEBF0" />
      </instancedMesh>
      <instancedMesh ref={gypsoInstRef} args={[gypsoGeo, undefined, 110]} raycast={() => null}>
        <meshStandardMaterial roughness={0.62} />
      </instancedMesh>

      {/* Layer 7: Rich Woven-Seagrass Potted Parlor / Areca Palm seated strictly at platform y = 0.084 */}
      <group position={[-4.54, 0.084, 1.85]}>
        <mesh geometry={seagrassPotGeo} material={wickerMat} castShadow receiveShadow />
        <mesh position={[0, 0.295, 0]} rotation={[-Math.PI / 2, 0, 0]} material={soilMat}>
          <circleGeometry args={[0.165, 22]} />
        </mesh>
        {[
          [-0.04, 0.03, 0.06],
          [0.05, -0.02, -0.05],
          [0.01, 0.05, 0.03],
          [-0.06, -0.04, -0.04],
          [0.04, 0.04, -0.02],
        ].map(([cx, cz, tilt], ci) => (
          <mesh key={`palm-cane-${ci}`} position={[cx, 0.42, cz]} rotation={[tilt, 0, -tilt]} castShadow>
            <cylinderGeometry args={[0.011, 0.016, 0.34, 10]} />
            <meshStandardMaterial color="#6C8C48" roughness={0.65} />
          </mesh>
        ))}
        {Array.from({ length: 16 }).map((_, pi) => {
          const a = (pi / 16) * Math.PI * 2 + (pi % 2) * 0.12;
          const upper = pi % 2 === 0;
          return (
            <mesh
              key={pi}
              position={[Math.cos(a) * (upper ? 0.045 : 0.075), upper ? 0.56 : 0.44, Math.sin(a) * (upper ? 0.045 : 0.075)]}
              rotation={[upper ? 0.44 : 0.72, a, 0]}
              geometry={fernGeo}
              scale={upper ? 1.52 : 1.32}
              castShadow
              raycast={() => null}
            >
              <meshPhysicalMaterial color={pi % 3 === 0 ? '#3E7A2E' : pi % 2 === 0 ? '#4D8838' : '#629E48'} roughness={0.44} side={THREE.DoubleSide} />
            </mesh>
          );
        })}
      </group>

      {/* Dual Overhead Vintage Brass Grazing Spotlights (`970bb675` Top Track Spots!) */}
      {[2.55, 3.65].map((sz, si) => (
        <group key={si} position={[-4.65, 3.48, sz]}>
          <mesh material={brassMat}>
            <cylinderGeometry args={[0.012, 0.012, 0.16, 8]} />
          </mesh>
          <mesh position={[-0.04, -0.08, 0]} rotation={[0, 0, -0.65]} material={brassMat} castShadow>
            <cylinderGeometry args={[0.028, 0.038, 0.10, 12]} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/**
 * Honey-Birch Wooden Pegboard Bric-a-Brac Wall (`970bb675` & `230f538a`!)
 * Holds Straw Tote Bag, Floral Ceramic Rolling Pin, Olivewood Cutting Boards, Red-Gingham Oven Mitt & Botanical Frame!
 */
const WoodenPegboardArtisanWall: React.FC<{
  pegboardMat: THREE.Material;
  ginghamMat: THREE.Material;
  wickerMat: THREE.Material;
  honeyWoodMat: THREE.Material;
  agedWoodMat: THREE.Material;
  floralPlateMat: THREE.Material;
  botanicalPrintMat: THREE.Material;
}> = ({ pegboardMat, ginghamMat, wickerMat, honeyWoodMat, agedWoodMat, floralPlateMat, botanicalPrintMat }) => {
  const { mittPalmGeo, mittThumbGeo, leafGeo, pegPotGeo, toteGeo, leafMat } = useMemo(
    () => ({
      mittPalmGeo: createBeveledBoxGeometry(0.145, 0.21, 0.032, 0.048, 0.012, 0.012, 3),
      mittThumbGeo: createBeveledBoxGeometry(0.062, 0.092, 0.026, 0.024, 0.010, 0.010, 3),
      leafGeo: createCitrusLeafGeometry(),
      pegPotGeo: createHollowVesselLatheGeo(0.038, 0.048, 0.052, 0.105, 0.005, 22),
      toteGeo: createHollowVesselLatheGeo(0.105, 0.128, 0.140, 0.235, 0.008, 22),
      leafMat: new THREE.MeshStandardMaterial({ color: '#4B8236', roughness: 0.62, side: THREE.DoubleSide }),
    }),
    []
  );

  useEffect(() => {
    return () => {
      mittPalmGeo.dispose();
      mittThumbGeo.dispose();
      leafGeo.dispose();
      pegPotGeo.dispose();
      toteGeo.dispose();
      leafMat.dispose();
    };
  }, [mittPalmGeo, mittThumbGeo, leafGeo, pegPotGeo, toteGeo, leafMat]);

  return (
    <group position={[-5.04, 2.48, 0.72]} rotation={[0, Math.PI / 2, 0]}>
      {/* Framed Pegboard Panel (bottom y = 1.87m — leaves crisp >= 33cm plaster clearance above Grand Cat Condo!) */}
      <mesh material={pegboardMat} castShadow receiveShadow>
        <boxGeometry args={[1.36, 1.18, 0.032]} />
      </mesh>
      <mesh position={[0, 0.60, 0.01]} material={agedWoodMat}>
        <boxGeometry args={[1.42, 0.042, 0.05]} />
      </mesh>
      <mesh position={[0, -0.60, 0.01]} material={agedWoodMat}>
        <boxGeometry args={[1.42, 0.042, 0.05]} />
      </mesh>

      {/* Turned Wooden Mounting Pegs anchoring every hanging tool into the pegboard */}
      {[
        [-0.38, 0.34],
        [-0.02, 0.20],
        [-0.36, -0.14],
        [0.06, -0.26],
        [0.30, -0.26],
      ].map(([px, py], pi) => (
        <mesh key={`peg-${pi}`} position={[px, py, 0.042]} rotation={[Math.PI / 2, 0, 0]} material={honeyWoodMat}>
          <cylinderGeometry args={[0.009, 0.009, 0.068, 12]} />
        </mesh>
      ))}

      {/* Pegboard Mini Shelf with Vintage Camera & Hollow Ceramic Leafy Herb Pot (`230f538a`) */}
      <mesh position={[0.28, 0.27, 0.09]} material={honeyWoodMat} castShadow>
        <boxGeometry args={[0.56, 0.024, 0.16]} />
      </mesh>
      <group position={[0.16, 0.282, 0.09]}>
        <mesh geometry={pegPotGeo} castShadow>
          <meshPhysicalMaterial color="#FAF2E2" roughness={0.46} clearcoat={0.16} envMapIntensity={0.38} />
        </mesh>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((li) => {
          const a = (li / 8) * Math.PI * 2;
          return (
            <mesh
              key={li}
              position={[Math.cos(a) * 0.024, 0.105 + (li % 2) * 0.022, Math.sin(a) * 0.024]}
              rotation={[0.55, a, 0.25]}
              geometry={leafGeo}
              material={leafMat}
              scale={0.82}
            />
          );
        })}
      </group>
      {/* Retro Rangefinder Camera on Pegboard Shelf */}
      <group position={[0.40, 0.318, 0.09]}>
        <mesh castShadow>
          <boxGeometry args={[0.11, 0.068, 0.052]} />
          <meshStandardMaterial color="#2C2825" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0, 0.034]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.022, 0.024, 0.025, 18]} />
          <meshStandardMaterial color="#C8C4BC" metalness={0.85} roughness={0.22} />
        </mesh>
      </group>

      {/* 1. Hanging Hollow Woven Straw Market Tote Bag */}
      <group position={[-0.38, 0.14, 0.05]}>
        <mesh position={[0, 0.22, 0]}>
          <torusGeometry args={[0.075, 0.0085, 10, 24, Math.PI]} />
          <meshStandardMaterial color="#9E6E3E" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.02, 0.015]} geometry={toteGeo} material={wickerMat} castShadow />
      </group>

      {/* 2. Hanging Rounded Beveled Red-Gingham Quilted Oven Mitt */}
      <group position={[-0.02, 0.08, 0.04]} rotation={[0, 0, 0.22]}>
        <mesh geometry={mittPalmGeo} material={ginghamMat} castShadow />
        <mesh position={[0.072, -0.02, 0]} rotation={[0, 0, -0.55]} geometry={mittThumbGeo} material={ginghamMat} />
      </group>

      {/* 3. Olivewood Paddle Cutting Board */}
      <group position={[-0.36, -0.32, 0.035]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={honeyWoodMat} castShadow>
          <cylinderGeometry args={[0.135, 0.135, 0.020, 24]} />
        </mesh>
        <mesh position={[0, 0.16, 0]} material={honeyWoodMat}>
          <boxGeometry args={[0.038, 0.10, 0.018]} />
        </mesh>
      </group>

      {/* 4. Floral-Painted Ceramic Rolling Pin resting on Wooden Pegs */}
      <group position={[0.18, -0.26, 0.065]} rotation={[0, 0, Math.PI / 2]}>
        <mesh material={floralPlateMat} castShadow>
          <cylinderGeometry args={[0.030, 0.030, 0.28, 22]} />
        </mesh>
        {[-0.19, 0.19].map((hy, hi) => (
          <mesh key={hi} position={[0, hy, 0]} material={honeyWoodMat}>
            <cylinderGeometry args={[0.014, 0.016, 0.10, 14]} />
          </mesh>
        ))}
      </group>

      {/* 5. Framed Botanical Watercolor Print */}
      <group position={[0.42, -0.01, 0.03]}>
        <mesh material={agedWoodMat} castShadow>
          <boxGeometry args={[0.24, 0.30, 0.022]} />
        </mesh>
        <mesh position={[0, 0, 0.013]} material={botanicalPrintMat}>
          <planeGeometry args={[0.19, 0.25]} />
        </mesh>
      </group>
    </group>
  );
};

/**
 * North Wall Overhead Timber Shelf with Hollow Woven Picnic Baskets & Real Instanced Cascading Ivy Leaves!
 */
const OverheadPicnicBasketShelf: React.FC<{
  agedWoodMat: THREE.Material;
  wickerMat: THREE.Material;
  ginghamMat: THREE.Material;
}> = ({ agedWoodMat, wickerMat, ginghamMat }) => {
  const leafInstRef = useRef<THREE.InstancedMesh>(null);
  const { shelfGeo, basketGeo, leafGeo } = useMemo(
    () => ({
      shelfGeo: createBeveledBoxGeometry(2.15, 0.040, 0.34, 0.010, 0.005, 0.005, 2),
      basketGeo: createHollowVesselLatheGeo(0.18, 0.215, 0.24, 0.255, 0.012, 26),
      leafGeo: createCitrusLeafGeometry(),
    }),
    []
  );

  useLayoutEffect(() => {
    const inst = leafInstRef.current;
    if (!inst) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const greens = [0x3e722e, 0x4f883a, 0x649c48];
    let idx = 0;
    [-0.58, 0.56].forEach((px, pi) => {
      [-0.12, -0.02, 0.09].forEach((vx, vi) => {
        for (let li = 0; li < 9; li++) {
          const clampedLi = li > 5 ? 5 : li;
          dummy.position.set(
            px + vx + Math.sin(li * 0.9 + vi + pi) * 0.024,
            0.22 - clampedLi * 0.092,
            0.21 + Math.cos(li * 0.7) * 0.018
          );
          dummy.rotation.set(0.65 + (li % 3) * 0.2, vi * 1.1 + li * 0.6, (li % 2 - 0.5) * 0.5);
          dummy.scale.setScalar(0.95 - li * 0.045);
          dummy.updateMatrix();
          inst.setMatrixAt(idx, dummy.matrix);
          color.setHex(greens[(idx + vi) % greens.length]);
          inst.setColorAt(idx, color);
          idx++;
        }
      });
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, []);

  useEffect(() => {
    return () => {
      shelfGeo.dispose();
      basketGeo.dispose();
      leafGeo.dispose();
    };
  }, [shelfGeo, basketGeo, leafGeo]);

  return (
    <group position={[0.32, 3.16, -3.42]}>
      <mesh geometry={shelfGeo} material={agedWoodMat} castShadow receiveShadow />
      {[-0.85, 0.85].map((bx, bi) => (
        <mesh key={bi} position={[bx, -0.10, -0.08]} rotation={[0.65, 0, 0]} material={agedWoodMat}>
          <boxGeometry args={[0.045, 0.24, 0.045]} />
        </mesh>
      ))}

      {/* 2 Hollow Woven Picnic Baskets seated flush on shelf top (`y = 0.020`)! */}
      {[-0.58, 0.56].map((px, pi) => (
        <group key={pi} position={[px, 0.020, 0.02]} rotation={[0, pi === 0 ? 0.12 : -0.15, 0]}>
          <mesh geometry={basketGeo} material={wickerMat} castShadow />
          <mesh position={[0, 0.23, 0]} material={ginghamMat}>
            <cylinderGeometry args={[0.246, 0.242, 0.055, 24, 1, true]} />
          </mesh>
          <mesh position={[0, 0.255, 0]} material={wickerMat}>
            <torusGeometry args={[0.19, 0.014, 12, 24, Math.PI]} />
          </mesh>
        </group>
      ))}

      {/* 54 Real Instanced Cascading Ivy Leaves (ZERO dodecahedron balls & ZERO inline loop materials!) */}
      <instancedMesh ref={leafInstRef} args={[leafGeo, undefined, 54]} castShadow>
        <meshStandardMaterial roughness={0.58} side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  );
};

/**
 * Two Adorable Animated Cottage Cats (`7.1` — `f4a71928` & `230f538a` Inspiration!)
 * 1. Sleeping Ginger-and-White Cat breathing softly on the sunlit floral rug
 * 2. Sitting Silver-Tabby-and-White Cat watching the courtyard butterflies by the veranda!
 */
const CozyCottageCats: React.FC = () => {
  const sleepBodyRef = useRef<THREE.Mesh>(null);
  const sleepTailRef = useRef<THREE.Group>(null);
  const sitHeadRef = useRef<THREE.Group>(null);
  const sitTailRef = useRef<THREE.Group>(null);
  const gingerHeartsRef = useRef<THREE.Group>(null);
  const tabbyHeartsRef = useRef<THREE.Group>(null);
  const gingerPetTimerRef = useRef(0);
  const tabbyPetTimerRef = useRef(0);
  const [gingerPetting, setGingerPetting] = useState(false);
  const [tabbyPetting, setTabbyPetting] = useState(false);

  const handlePetCat = (cat: 'ginger' | 'tabby') => {
    patisserieAudio.playCatPurrAndMeow();
    if (cat === 'ginger') {
      gingerPetTimerRef.current = 2.4;
      setGingerPetting(true);
    } else {
      tabbyPetTimerRef.current = 2.4;
      setTabbyPetting(true);
    }
    window.dispatchEvent(
      new CustomEvent('cottage-easter-egg', {
        detail: {
          id: 'cat',
          icon: '🐾',
          message:
            cat === 'ginger'
              ? '轻抚了阳光毯上的小橘猫，它开心地呼噜打滚并冒出爱心 ♥'
              : '轻抚了廊边赏蝶的银渐层小猫，它翘起尾巴轻轻喵了一声 ♥',
        },
      })
    );
  };

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();

    if (gingerPetTimerRef.current > 0) {
      gingerPetTimerRef.current = Math.max(0, gingerPetTimerRef.current - dt);
      if (gingerPetTimerRef.current === 0) setGingerPetting(false);
    }
    if (tabbyPetTimerRef.current > 0) {
      tabbyPetTimerRef.current = Math.max(0, tabbyPetTimerRef.current - dt);
      if (tabbyPetTimerRef.current === 0) setTabbyPetting(false);
    }

    const gExcited = gingerPetTimerRef.current > 0 ? 1 : 0;
    const tExcited = tabbyPetTimerRef.current > 0 ? 1 : 0;

    if (sleepBodyRef.current) {
      const breath = 1.0 + Math.sin(t * (1.8 + gExcited * 5.0)) * (0.035 + gExcited * 0.045);
      sleepBodyRef.current.scale.set(1.22, 0.68 * breath, 0.96);
    }
    if (sleepTailRef.current) {
      sleepTailRef.current.rotation.y = Math.sin(t * (1.1 + gExcited * 6.5)) * (0.18 + gExcited * 0.34);
    }
    if (sitHeadRef.current) {
      sitHeadRef.current.rotation.y = Math.sin(t * (0.75 + tExcited * 4.2)) * (0.24 + tExcited * 0.14);
      sitHeadRef.current.rotation.z = Math.cos(t * (0.55 + tExcited * 5.2)) * (0.06 + tExcited * 0.16);
    }
    if (sitTailRef.current) {
      sitTailRef.current.rotation.x = Math.sin(t * (1.9 + tExcited * 6.0)) * (0.16 + tExcited * 0.32);
    }
    if (gingerHeartsRef.current && gingerPetTimerRef.current > 0) {
      const p = 1.0 - gingerPetTimerRef.current / 2.4;
      gingerHeartsRef.current.position.y = 0.24 + p * 0.38;
      gingerHeartsRef.current.rotation.y = t * 2.2;
    }
    if (tabbyHeartsRef.current && tabbyPetTimerRef.current > 0) {
      const p = 1.0 - tabbyPetTimerRef.current / 2.4;
      tabbyHeartsRef.current.position.y = 0.42 + p * 0.38;
      tabbyHeartsRef.current.rotation.y = t * 2.2;
    }
  });

  const { sleepTailGeo, sitTailGeo, catAssets } = useMemo(() => {
    const sleepCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.016, 0),
      new THREE.Vector3(-0.055, 0.016, 0.045),
      new THREE.Vector3(-0.045, 0.016, 0.115),
      new THREE.Vector3(0.025, 0.018, 0.142),
    ]);
    const sitCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.012, 0.035, -0.065),
      new THREE.Vector3(0.032, 0.105, -0.098),
      new THREE.Vector3(0.024, 0.168, -0.075),
    ]);
    const gingerFur = createCatFurPbr('#E48F44', '#B55B1E', 901);
    const tabbyFur = createCatFurPbr('#9B9790', '#5E5B55', 902);
    const creamFur = createCatFurPbr('#FAF3E6', '#EAE0CE', 903);
    return {
      sleepTailGeo: new THREE.TubeGeometry(sleepCurve, 20, 0.016, 12, false),
      sitTailGeo: new THREE.TubeGeometry(sitCurve, 20, 0.0155, 12, false),
      catAssets: {
        gingerFur,
        tabbyFur,
        creamFur,
        gingerMat: new THREE.MeshPhysicalMaterial({
          map: gingerFur.map,
          bumpMap: gingerFur.bumpMap,
          bumpScale: 0.004,
          roughness: 0.88,
          sheen: 0.58,
          sheenColor: '#F7C992',
          sheenRoughness: 0.72,
        }),
        tabbyMat: new THREE.MeshPhysicalMaterial({
          map: tabbyFur.map,
          bumpMap: tabbyFur.bumpMap,
          bumpScale: 0.004,
          roughness: 0.88,
          sheen: 0.62,
          sheenColor: '#DAD6CE',
          sheenRoughness: 0.72,
        }),
        creamMat: new THREE.MeshPhysicalMaterial({
          map: creamFur.map,
          bumpMap: creamFur.bumpMap,
          bumpScale: 0.003,
          roughness: 0.88,
          sheen: 0.62,
          sheenColor: '#FFFDF6',
          sheenRoughness: 0.74,
        }),
        pinkInnerEarMat: new THREE.MeshStandardMaterial({ color: '#F2A8AA', roughness: 0.78 }),
        pinkNoseMat: new THREE.MeshPhysicalMaterial({ color: '#EC8E92', roughness: 0.48, clearcoat: 0.12, envMapIntensity: 0.34 }),
        whiskerMat: new THREE.MeshStandardMaterial({ color: '#F8F5EE', roughness: 0.6 }),
        heartMat: new THREE.MeshStandardMaterial({ color: '#FF7D96', emissive: '#FF4E74', emissiveIntensity: 1.5 }),
        eyelidMat: new THREE.MeshStandardMaterial({ color: '#3A281E', roughness: 0.6 }),
      },
    };
  }, []);

  useEffect(() => {
    return () => {
      sleepTailGeo.dispose();
      sitTailGeo.dispose();
      catAssets.gingerFur.map.dispose();
      catAssets.gingerFur.bumpMap.dispose();
      catAssets.tabbyFur.map.dispose();
      catAssets.tabbyFur.bumpMap.dispose();
      catAssets.creamFur.map.dispose();
      catAssets.creamFur.bumpMap.dispose();
      catAssets.gingerMat.dispose();
      catAssets.tabbyMat.dispose();
      catAssets.creamMat.dispose();
      catAssets.pinkInnerEarMat.dispose();
      catAssets.pinkNoseMat.dispose();
      catAssets.whiskerMat.dispose();
      catAssets.heartMat.dispose();
      catAssets.eyelidMat.dispose();
      if (document.body.style.cursor === 'pointer') {
        document.body.style.cursor = 'auto';
      }
    };
  }, [sleepTailGeo, sitTailGeo, catAssets]);

  return (
    <group>
      {/* CAT 1: Interactive Sleeping Ginger-and-White Cat curled up on the West Sunlit Nook Rug */}
      <group
        position={[-3.18, 0.09, 2.38]}
        rotation={[0, 0.55, 0]}
        onClick={(e) => {
          if (e.delta > 5) return;
          e.stopPropagation();
          handlePetCat('ginger');
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
        <group ref={gingerHeartsRef} position={[0, 0.26, 0]} visible={gingerPetting}>
          {[-0.04, 0.04, 0].map((hx, hi) => (
            <mesh key={hi} position={[hx, hi * 0.05, (hi - 1) * 0.03]} material={catAssets.heartMat}>
              <sphereGeometry args={[0.022, 12, 10]} />
            </mesh>
          ))}
        </group>
        <mesh ref={sleepBodyRef} position={[0, 0.065, 0]} scale={[1.22, 0.68, 0.96]} material={catAssets.creamMat} castShadow>
          <sphereGeometry args={[0.125, 24, 18]} />
        </mesh>
        {/* Warm Ginger Striped Back Patch */}
        <mesh position={[-0.02, 0.095, -0.02]} scale={[0.92, 0.55, 0.78]} material={catAssets.gingerMat}>
          <sphereGeometry args={[0.095, 20, 16]} />
        </mesh>
        {/* Tucked Sleeping Head with Fur Texture, Outer Closed Eyelids (z=0.074), Pink Nose & Whiskers */}
        <group position={[0.11, 0.085, 0.04]} rotation={[0.12, -0.45, 0]}>
          <mesh material={catAssets.gingerMat} castShadow>
            <sphereGeometry args={[0.072, 22, 18]} />
          </mesh>
          <mesh position={[0, -0.016, 0.054]} scale={[0.78, 0.60, 0.52]} material={catAssets.creamMat}>
            <sphereGeometry args={[0.042, 16, 12]} />
          </mesh>
          <mesh position={[0, -0.008, 0.075]} scale={[1.15, 0.78, 0.65]} material={catAssets.pinkNoseMat}>
            <sphereGeometry args={[0.0085, 12, 10]} />
          </mesh>
          {/* Peaceful closed sleeping eye crescents sitting cleanly ON outer head surface */}
          {[-0.023, 0.023].map((ex, ei) => (
            <mesh key={`seye-${ei}`} position={[ex, 0.010, 0.073]} rotation={[0, ex * 2.4, Math.PI]} material={catAssets.eyelidMat}>
              <torusGeometry args={[0.010, 0.0022, 8, 14, Math.PI * 0.85]} />
            </mesh>
          ))}
          {/* Sleeping Cat Delicate Cheek Whiskers */}
          {[-1, 1].map((side) =>
            [-0.14, 0.0, 0.14].map((ang, wi) => (
              <mesh
                key={`gw-${side}-${wi}`}
                position={[side * 0.044, -0.014 + wi * 0.003, 0.060]}
                rotation={[0, -side * 0.25, Math.PI * 0.5 + side * ang]}
                material={catAssets.whiskerMat}
              >
                <cylinderGeometry args={[0.0008, 0.0008, 0.052, 6]} />
              </mesh>
            ))
          )}
          {/* Sculpted Outer & Pink Inner Ears */}
          {[-0.038, 0.038].map((ex, ei) => (
            <group key={ei} position={[ex, 0.062, 0.01]} rotation={[0.15, 0, ex * -4.5]}>
              <mesh material={catAssets.gingerMat}>
                <coneGeometry args={[0.024, 0.048, 16]} />
              </mesh>
              <mesh position={[0, -0.003, 0.007]} scale={[0.62, 0.68, 0.65]} material={catAssets.pinkInnerEarMat}>
                <coneGeometry args={[0.020, 0.040, 14]} />
              </mesh>
            </group>
          ))}
        </group>
        {/* Grounded Sweeping Fluffy Tail resting directly on the rug (`y = 0.000`) */}
        <group ref={sleepTailRef} position={[-0.12, 0.0, 0.02]}>
          <mesh geometry={sleepTailGeo} material={catAssets.gingerMat} castShadow />
        </group>
      </group>

      {/* CAT 2: Interactive Sitting Silver-Tabby Cat on the Veranda Edge watching Courtyard Butterflies! */}
      <group
        position={[4.58, 0, 2.25]}
        rotation={[0, 1.38, 0]}
        onClick={(e) => {
          if (e.delta > 5) return;
          e.stopPropagation();
          handlePetCat('tabby');
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
        <group ref={tabbyHeartsRef} position={[0, 0.44, 0]} visible={tabbyPetting}>
          {[-0.04, 0.04, 0].map((hx, hi) => (
            <mesh key={hi} position={[hx, hi * 0.05, (hi - 1) * 0.03]} material={catAssets.heartMat}>
              <sphereGeometry args={[0.022, 12, 10]} />
            </mesh>
          ))}
        </group>
        <mesh position={[0, 0.13, 0]} scale={[0.88, 1.25, 0.92]} material={catAssets.tabbyMat} castShadow>
          <sphereGeometry args={[0.115, 24, 18]} />
        </mesh>
        {/* Snowy White Chest Bib & Front Paws */}
        <mesh position={[0, 0.12, 0.055]} scale={[0.68, 1.05, 0.62]} material={catAssets.creamMat}>
          <sphereGeometry args={[0.09, 20, 16]} />
        </mesh>
        {[-0.036, 0.036].map((px, pi) => (
          <mesh key={pi} position={[px, 0.022, 0.075]} scale={[1, 0.65, 1.25]} material={catAssets.creamMat}>
            <sphereGeometry args={[0.026, 16, 14]} />
          </mesh>
        ))}

        {/* Warm Berry-Red Fabric Collar & Gleaming Golden Jingle Bell around Neck */}
        <mesh position={[0, 0.222, 0.016]} rotation={[Math.PI * 0.5 + 0.15, 0, 0]}>
          <torusGeometry args={[0.064, 0.0085, 12, 24]} />
          <meshPhysicalMaterial color="#C84B42" roughness={0.78} sheen={0.55} />
        </mesh>
        <mesh position={[0, 0.205, 0.082]} castShadow>
          <sphereGeometry args={[0.014, 14, 12]} />
          <meshStandardMaterial color="#E6B84C" metalness={0.74} roughness={0.34} envMapIntensity={0.46} />
        </mesh>

        {/* Curious Head Looking Out at the Garden Butterflies & Creek (Tabby Fur + Soft Ghibli Eyes + Whiskers!) */}
        <group ref={sitHeadRef} position={[0, 0.285, 0.03]}>
          <mesh material={catAssets.tabbyMat} castShadow>
            <sphereGeometry args={[0.076, 24, 20]} />
          </mesh>
          <mesh position={[0, -0.02, 0.052]} scale={[0.8, 0.65, 0.6]} material={catAssets.creamMat}>
            <sphereGeometry args={[0.048, 18, 14]} />
          </mesh>
          {[-0.026, 0.026].map((ex, ei) => (
            <group key={`teye-${ei}`} position={[ex, 0.014, 0.066]}>
              <mesh>
                <sphereGeometry args={[0.012, 14, 12]} />
                <meshPhysicalMaterial color="#487A44" roughness={0.14} clearcoat={0.28} envMapIntensity={0.48} />
              </mesh>
              <mesh position={[0, 0, 0.008]} scale={[0.55, 0.85, 0.6]}>
                <sphereGeometry args={[0.0075, 10, 10]} />
                <meshStandardMaterial color="#181614" roughness={0.12} />
              </mesh>
              <mesh position={[0.003, 0.004, 0.011]}>
                <sphereGeometry args={[0.0026, 8, 8]} />
                <meshBasicMaterial color="#FFFFFF" />
              </mesh>
            </group>
          ))}
          <mesh position={[0, -0.006, 0.078]} scale={[1.15, 0.78, 0.65]} material={catAssets.pinkNoseMat}>
            <sphereGeometry args={[0.0085, 12, 10]} />
          </mesh>
          {[-1, 1].map((side) =>
            [-0.14, 0.0, 0.14].map((ang, wi) => (
              <mesh
                key={`w-${side}-${wi}`}
                position={[side * 0.046, -0.014 + wi * 0.003, 0.062]}
                rotation={[0, -side * 0.25, Math.PI * 0.5 + side * ang]}
                material={catAssets.whiskerMat}
              >
                <cylinderGeometry args={[0.0008, 0.0008, 0.056, 6]} />
              </mesh>
            ))
          )}
          {[-0.042, 0.042].map((ex, ei) => (
            <group key={ei} position={[ex, 0.068, 0.0]} rotation={[0.12, 0, ex * -4.2]}>
              <mesh material={catAssets.tabbyMat}>
                <coneGeometry args={[0.025, 0.052, 16]} />
              </mesh>
              <mesh position={[0, -0.003, 0.007]} scale={[0.62, 0.68, 0.65]} material={catAssets.pinkInnerEarMat}>
                <coneGeometry args={[0.020, 0.042, 14]} />
              </mesh>
            </group>
          ))}
        </group>

        {/* Curved Expressive Upward Fluffy Tail (`TubeGeometry` with Tabby Fur) */}
        <group ref={sitTailRef} position={[0, 0.042, -0.088]}>
          <mesh geometry={sitTailGeo} material={catAssets.tabbyMat} castShadow />
        </group>
      </group>
    </group>
  );
};

/**
 * 1:1 MICRO-REFINED HERO RECREATION OF `media_1795263834213_f95ce79d.jpg`:
 * Sunlit Veranda Harvest & Enamel Wash Table
 */
const SunlitVerandaHarvestWashTable: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  agedWoodMat: THREE.Material;
  distressedCreamMat: THREE.Material;
  wickerMat: THREE.Material;
  laceMat: THREE.Material;
  brassMat: THREE.Material;
  porcelainMat: THREE.Material;
  floralPlateMat: THREE.Material;
  sageEnamelMat: THREE.Material;
}> = ({
  position,
  rotation = [0, 0, 0],
  agedWoodMat,
  distressedCreamMat,
  wickerMat,
  laceMat,
  brassMat,
  porcelainMat,
  floralPlateMat,
  sageEnamelMat,
}) => {
  const fanBladeRef = useRef<THREE.Group>(null);

  const {
    faucetSpoutGeo,
    jarGeo,
    plateGeo,
    washLegGeo,
    washTopGeo,
    sideStretcherGeo,
    centerStretcherGeo,
    tumblerGeo,
    tomatoBasketGeo,
    yellowTartMoldGeo,
    fanBladeGeo,
    sharedMats,
  } = useMemo(() => {
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, -0.010);
    bladeShape.quadraticCurveTo(0.045, -0.026, 0.088, -0.008);
    bladeShape.quadraticCurveTo(0.098, 0.006, 0.086, 0.020);
    bladeShape.quadraticCurveTo(0.042, 0.028, 0, 0.010);
    bladeShape.closePath();
    const bGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.003, bevelEnabled: false });
    bGeo.computeVertexNormals();

    return {
      faucetSpoutGeo: createBrassSwanFaucetSpoutGeometry(),
      jarGeo: createGlassVesselGeometry(0.056, 0.064, 0.16, 0.005),
      plateGeo: createEspressoSaucerGeometry(),
      washLegGeo: createBeveledBoxGeometry(0.064, 0.76, 0.064, 0.008, 0.005, 0.005, 2),
      washTopGeo: createBeveledBoxGeometry(1.58, 0.046, 0.94, 0.018, 0.006, 0.006, 3),
      sideStretcherGeo: createBeveledBoxGeometry(0.044, 0.044, 0.78, 0.006, 0.004, 0.004, 2),
      centerStretcherGeo: createBeveledBoxGeometry(1.38, 0.036, 0.14, 0.008, 0.004, 0.004, 2),
      tumblerGeo: createHollowVesselLatheGeo(0.040, 0.047, 0.052, 0.095, 0.004, 24),
      tomatoBasketGeo: createHollowVesselLatheGeo(0.105, 0.132, 0.148, 0.086, 0.010, 26),
      yellowTartMoldGeo: createHollowFlutedBundtGeo(0.062, 0.008, 0.072, 16),
      fanBladeGeo: bGeo,
      sharedMats: {
        enamelRimMat: new THREE.MeshPhysicalMaterial({ color: '#2F5E48', roughness: 0.42, clearcoat: 0.18, envMapIntensity: 0.38 }),
        tomatoMat: new THREE.MeshPhysicalMaterial({ color: '#DF3026', roughness: 0.34, clearcoat: 0.10, envMapIntensity: 0.38 }),
        goldCherryMat: new THREE.MeshPhysicalMaterial({ color: '#EE9E24', roughness: 0.36, clearcoat: 0.10, envMapIntensity: 0.38 }),
        calyxMat: new THREE.MeshStandardMaterial({ color: '#457D32', roughness: 0.75 }),
        appleMat: new THREE.MeshPhysicalMaterial({ color: '#88BA3E', roughness: 0.38, clearcoat: 0.08, envMapIntensity: 0.36 }),
        lemonMat: new THREE.MeshPhysicalMaterial({ color: '#F3CF3A', roughness: 0.42, clearcoat: 0.06, envMapIntensity: 0.34 }),
        grapeMat: new THREE.MeshPhysicalMaterial({ color: '#96CF3E', roughness: 0.34, clearcoat: 0.14, sheen: 0.35, sheenColor: '#D4F288', envMapIntensity: 0.38 }),
        chamWhiteMat: new THREE.MeshStandardMaterial({ color: '#FFFDF6', roughness: 0.58 }),
        chamGoldMat: new THREE.MeshStandardMaterial({ color: '#EAB836', roughness: 0.54 }),
        stemMat: new THREE.MeshStandardMaterial({ color: '#4D7A38', roughness: 0.80 }),
        fanBladeMat: new THREE.MeshStandardMaterial({ color: '#DCE6D8', metalness: 0.36, roughness: 0.42, envMapIntensity: 0.40 }),
        cornMat: new THREE.MeshStandardMaterial({ color: '#F4CA4C', roughness: 0.48 }),
        huskMat: new THREE.MeshStandardMaterial({ color: '#84B44C', roughness: 0.70 }),
      },
    };
  }, []);

  useEffect(() => {
    return () => {
      faucetSpoutGeo.dispose();
      jarGeo.dispose();
      plateGeo.dispose();
      washLegGeo.dispose();
      washTopGeo.dispose();
      sideStretcherGeo.dispose();
      centerStretcherGeo.dispose();
      tumblerGeo.dispose();
      tomatoBasketGeo.dispose();
      yellowTartMoldGeo.dispose();
      fanBladeGeo.dispose();
      Object.values(sharedMats).forEach((m) => m.dispose());
    };
  }, [
    faucetSpoutGeo,
    jarGeo,
    plateGeo,
    washLegGeo,
    washTopGeo,
    sideStretcherGeo,
    centerStretcherGeo,
    tumblerGeo,
    tomatoBasketGeo,
    yellowTartMoldGeo,
    fanBladeGeo,
    sharedMats,
  ]);

  useFrame((_, delta) => {
    if (fanBladeRef.current) {
      fanBladeRef.current.rotation.z += Math.min(delta, 0.05) * 9.5;
    }
  });

  const grapeOffsets: Array<[number, number, number]> = [
    [0, 0.024, 0], [-0.032, 0.022, 0.018], [0.032, 0.022, 0.016],
    [-0.022, 0.022, -0.028], [0.024, 0.022, -0.026], [-0.052, 0.020, -0.005],
    [0.050, 0.020, -0.004], [0, 0.020, 0.042], [-0.016, 0.044, 0.008],
    [0.018, 0.044, 0.006], [0, 0.044, -0.018], [0.002, 0.062, 0.0],
  ];

  return (
    <group position={position} rotation={rotation}>
      {/* Open Beveled Weathered-Timber Trestle Legs + Side Stretchers + Grounded Center Stretcher! */}
      {[-0.68, 0.68].map((lx, xi) => (
        <React.Fragment key={xi}>
          {[-0.38, 0.38].map((lz, zi) => (
            <mesh key={`${xi}-${zi}`} position={[lx, 0.38, lz]} geometry={washLegGeo} material={agedWoodMat} castShadow receiveShadow />
          ))}
          {/* Side end stretcher uniting front & back legs so center beam rests rigidly (ZERO floating stretcher!) */}
          <mesh position={[lx, 0.18, 0]} geometry={sideStretcherGeo} material={agedWoodMat} castShadow receiveShadow />
        </React.Fragment>
      ))}
      <mesh position={[0, 0.18, 0]} geometry={centerStretcherGeo} material={agedWoodMat} castShadow receiveShadow />

      {/* Beveled Tabletop Weathered Pine Frame + Distressed Chippy Cream-Painted Plank Inset */}
      <mesh position={[0, 0.77, 0]} geometry={washTopGeo} material={agedWoodMat} castShadow receiveShadow />
      <mesh position={[-0.05, 0.795, 0.02]} material={distressedCreamMat} receiveShadow>
        <boxGeometry args={[1.36, 0.008, 0.80]} />
      </mesh>

      {/* 3D Draped Hand-Crocheted Ecru Lace Runner lifted cleanly to y = 0.8005 & side drapes flush up to tabletop 0.799! */}
      <mesh position={[0.24, 0.8005, 0.24]} rotation={[-Math.PI / 2, 0, 0.05]} material={laceMat}>
        <planeGeometry args={[0.72, 0.46]} />
      </mesh>
      <mesh position={[0, 0.739, 0.472]} material={laceMat}>
        <planeGeometry args={[1.50, 0.12]} />
      </mesh>
      <mesh position={[-0.792, 0.739, 0]} rotation={[0, Math.PI / 2, 0]} material={laceMat}>
        <planeGeometry args={[0.88, 0.12]} />
      </mesh>

      {/* 1. DEEP WHITE ENAMELWARE BASIN WITH NON-OVERLAPPING FOREST-GREEN RIM (ZERO corner Z-fighting!) */}
      <group position={[-0.14, 0.80, 0.14]}>
        <mesh position={[0, 0.007, 0]} material={porcelainMat} receiveShadow>
          <boxGeometry args={[0.55, 0.014, 0.45]} />
        </mesh>
        {[
          { p: [0, 0.058, 0.22] as [number, number, number], s: [0.556, 0.11, 0.016] as [number, number, number], rs: [0.562, 0.007, 0.020] as [number, number, number] },
          { p: [0, 0.058, -0.22] as [number, number, number], s: [0.556, 0.11, 0.016] as [number, number, number], rs: [0.562, 0.007, 0.020] as [number, number, number] },
          { p: [-0.27, 0.058, 0] as [number, number, number], s: [0.016, 0.11, 0.422] as [number, number, number], rs: [0.020, 0.007, 0.418] as [number, number, number] },
          { p: [0.27, 0.058, 0] as [number, number, number], s: [0.016, 0.11, 0.422] as [number, number, number], rs: [0.020, 0.007, 0.418] as [number, number, number] },
        ].map((w, wi) => (
          <group key={wi}>
            <mesh position={w.p} material={porcelainMat} castShadow receiveShadow>
              <boxGeometry args={w.s} />
            </mesh>
            <mesh position={[w.p[0], 0.1155, w.p[2]]} material={sharedMats.enamelRimMat}>
              <boxGeometry args={w.rs} />
            </mesh>
          </group>
        ))}

        {/* Crystal-Clear Basin Water Surface */}
        <mesh position={[0, 0.068, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.51, 0.41]} />
          <meshPhysicalMaterial color="#CBE6DF" transparent opacity={0.44} roughness={0.14} clearcoat={0.24} envMapIntensity={0.48} />
        </mesh>

        {/* 2 Husked Golden Sweetcorn Cobs + Pale Green Zucchini + Carrot */}
        {[-0.08, 0.02].map((cx, ci) => (
          <group key={`corn-${ci}`} position={[cx, 0.076, -0.06]} rotation={[Math.PI * 0.46, 0, 0.22 * (ci - 0.5)]}>
            <mesh material={sharedMats.cornMat} castShadow>
              <cylinderGeometry args={[0.027, 0.032, 0.15, 20]} />
            </mesh>
            <mesh position={[0, -0.065, 0]} material={sharedMats.huskMat}>
              <cylinderGeometry args={[0.033, 0.024, 0.045, 16]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0.06, 0.076, -0.10]} rotation={[Math.PI * 0.44, 0, -0.08]} castShadow>
          <cylinderGeometry args={[0.022, 0.026, 0.16, 18]} />
          <meshStandardMaterial color="#9EC858" roughness={0.36} />
        </mesh>
        <mesh position={[-0.17, 0.072, 0.12]} rotation={[Math.PI * 0.48, 0, -0.35]} castShadow>
          <coneGeometry args={[0.024, 0.15, 18]} />
          <meshStandardMaterial color="#EB6E24" roughness={0.42} />
        </mesh>

        {/* 4 Glossy Ruby-Red Vine Tomatoes (shared materials!) */}
        {[
          [-0.12, 0.082, 0.05],
          [-0.02, 0.085, 0.07],
          [-0.18, 0.076, -0.04],
          [0.02, 0.076, 0.15],
        ].map(([tx, ty, tz], ti) => (
          <group key={`tom-${ti}`} position={[tx, ty, tz]}>
            <mesh material={sharedMats.tomatoMat} castShadow>
              <sphereGeometry args={[0.040, 18, 14]} />
            </mesh>
            <mesh position={[0, 0.038, 0]} material={sharedMats.calyxMat}>
              <cylinderGeometry args={[0.016, 0.004, 0.008, 5]} />
            </mesh>
          </group>
        ))}

        {/* 4 Crisp Granny-Smith Green Apples, Sweet Orange & Dark-Green Cucumber */}
        {[
          [0.13, 0.080, 0.02],
          [0.17, 0.076, 0.11],
          [0.07, 0.074, 0.09],
          [-0.07, 0.072, 0.14],
        ].map(([ax, ay, az], ai) => (
          <mesh key={`app-${ai}`} position={[ax, ay, az]} material={sharedMats.appleMat} castShadow>
            <sphereGeometry args={[0.038, 18, 14]} />
          </mesh>
        ))}
        <mesh position={[0.15, 0.078, -0.06]} castShadow>
          <sphereGeometry args={[0.040, 18, 14]} />
          <meshPhysicalMaterial color="#EE801E" roughness={0.38} clearcoat={0.12} envMapIntensity={0.36} />
        </mesh>
        {/* Overflowing Brimful Harvest Lemons & Extra Glossy Heirloom Tomatoes */}
        {[
          [-0.14, 0.112, -0.10],
          [0.09, 0.108, -0.09],
          [-0.04, 0.116, 0.12],
        ].map(([lx, ly, lz], li) => (
          <mesh key={`lem-${li}`} position={[lx, ly, lz]} scale={[1.26, 0.88, 0.88]} rotation={[0.2, li * 0.9, 0.15]} material={sharedMats.lemonMat} castShadow>
            <sphereGeometry args={[0.028, 16, 12]} />
          </mesh>
        ))}
        {[
          [-0.19, 0.106, 0.04],
          [0.01, 0.118, -0.02],
          [0.14, 0.110, 0.06],
        ].map(([tx, ty, tz], ti) => (
          <group key={`htom-${ti}`} position={[tx, ty, tz]}>
            <mesh material={sharedMats.tomatoMat} castShadow>
              <sphereGeometry args={[0.034, 16, 12]} />
            </mesh>
            <mesh position={[0, 0.032, 0]} material={sharedMats.calyxMat}>
              <cylinderGeometry args={[0.013, 0.004, 0.007, 5]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0.05, 0.075, 0.05]} rotation={[Math.PI * 0.48, 0, -0.68]} castShadow>
          <cylinderGeometry args={[0.018, 0.020, 0.16, 18]} />
          <meshStandardMaterial color="#2B6028" roughness={0.40} />
        </mesh>
      </group>

      {/* 2. SCULPTED BRASS SWAN-NECK GARDEN BRIDGE FAUCET + FLARED NOZZLE + TOMATO TUMBLER */}
      <group position={[0.20, 0.80, 0.04]} rotation={[0, -Math.PI * 0.55, 0]}>
        {[-0.055, 0.055].map((px, pi) => (
          <group key={pi} position={[px, 0, 0]}>
            <mesh position={[0, 0.008, 0]} material={brassMat}>
              <cylinderGeometry args={[0.022, 0.026, 0.016, 18]} />
            </mesh>
            <mesh position={[0, 0.058, 0]} material={brassMat} castShadow>
              <cylinderGeometry args={[0.012, 0.018, 0.11, 18]} />
            </mesh>
            <mesh position={[0, 0.095, 0.024]} rotation={[Math.PI * 0.38, 0, 0]} material={porcelainMat}>
              <cylinderGeometry args={[0.007, 0.009, 0.048, 14]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.108, 0]} rotation={[0, 0, Math.PI / 2]} material={brassMat}>
          <cylinderGeometry args={[0.011, 0.011, 0.13, 14]} />
        </mesh>
        <mesh position={[0, 0.096, 0]} material={brassMat}>
          <cylinderGeometry args={[0.017, 0.022, 0.032, 18]} />
        </mesh>
        <group position={[0, 0.092, 0]}>
          <mesh geometry={faucetSpoutGeo} material={brassMat} castShadow />
          <mesh position={[0, 0.214, 0.205]} rotation={[0.32, 0, 0]} material={brassMat}>
            <cylinderGeometry args={[0.013, 0.018, 0.024, 16]} />
          </mesh>
        </group>
      </group>

      <group position={[0.16, 0.80, -0.10]}>
        <mesh geometry={tumblerGeo} castShadow>
          <meshPhysicalMaterial color="#F2F8F4" transparent opacity={0.32} roughness={0.14} clearcoat={0.22} envMapIntensity={0.48} />
        </mesh>
        {[-0.018, 0.018, 0.0].map((cx, ci) => (
          <mesh key={ci} position={[cx, 0.042 + ci * 0.014, (ci - 1) * 0.014]} material={sharedMats.tomatoMat}>
            <sphereGeometry args={[0.019, 16, 14]} />
          </mesh>
        ))}
      </group>

      {/* 3. BRAIDED WICKER & CROCHET-LINED BASKET OVERFLOWING WITH RUBY & GOLD CHERRY TOMATOES */}
      <group position={[0.49, 0.80, 0.18]} rotation={[0, -0.22, 0]}>
        <mesh scale={[1.12, 1.0, 0.88]} geometry={tomatoBasketGeo} material={wickerMat} castShadow receiveShadow />
        <mesh position={[0, 0.046, 0]} scale={[1.05, 1.0, 0.82]}>
          <cylinderGeometry args={[0.118, 0.102, 0.042, 22]} />
          <meshPhysicalMaterial color="#F6ECDA" roughness={0.90} sheen={0.45} />
        </mesh>
        <mesh position={[0, 0.088, 0]} scale={[1.12, 1.0, 0.88]} rotation={[Math.PI / 2, 0, 0]} material={laceMat}>
          <torusGeometry args={[0.138, 0.010, 10, 28]} />
        </mesh>
        <mesh position={[0, 0.116, 0]} rotation={[0, 0.3, Math.PI / 2]} material={sharedMats.calyxMat}>
          <cylinderGeometry args={[0.003, 0.003, 0.22, 8]} />
        </mesh>
        {Array.from({ length: 22 }).map((_, bi) => {
          const ring = bi < 14 ? 0 : 1;
          const bx = ring === 0 ? ((bi % 4) - 1.5) * 0.046 : (((bi - 14) % 3) - 1.0) * 0.042;
          const bz = ring === 0 ? (Math.floor(bi / 4) - 1.2) * 0.038 : (Math.floor((bi - 14) / 3) - 0.8) * 0.036;
          const by = ring === 0 ? 0.072 + (bi % 2) * 0.016 : 0.098 + (bi % 2) * 0.014;
          return (
            <mesh
              key={bi}
              position={[bx, by, bz]}
              material={bi % 5 === 2 ? sharedMats.goldCherryMat : sharedMats.tomatoMat}
              castShadow
            >
              <sphereGeometry args={[0.021, 14, 12]} />
            </mesh>
          );
        })}
      </group>

      {/* 4. SCALLOPED WHITE PORCELAIN PLATE PILED WITH DEWY GREEN SHINE-MUSCAT GRAPES */}
      <group position={[-0.44, 0.802, -0.14]}>
        <mesh scale={[1.38, 1.0, 1.38]} geometry={plateGeo} material={porcelainMat} castShadow receiveShadow />
        {grapeOffsets.map(([gx, gy, gz], gi) => (
          <mesh key={gi} position={[gx, gy, gz]} material={sharedMats.grapeMat} castShadow>
            <sphereGeometry args={[0.018, 14, 12]} />
          </mesh>
        ))}
      </group>

      {/* 5. TWO FLUTED GREEN-GLASS JARS WITH VISIBLE WATER LEVEL & MULTI-PETAL CHAMOMILE */}
      {[
        [-0.60, -0.24],
        [0.25, -0.22],
      ].map(([jx, jz], ji) => (
        <group key={`cham-${ji}`} position={[jx, 0.80, jz]}>
          <mesh geometry={jarGeo} castShadow>
            <meshPhysicalMaterial color="#8CB284" transparent opacity={0.40} roughness={0.14} clearcoat={0.22} envMapIntensity={0.48} />
          </mesh>
          <mesh position={[0, 0.055, 0]}>
            <cylinderGeometry args={[0.050, 0.056, 0.09, 18]} />
            <meshPhysicalMaterial color="#A8CA98" transparent opacity={0.38} roughness={0.05} />
          </mesh>
          {[-0.03, 0.0, 0.03, -0.015, 0.02].map((sx, si) => (
            <group key={si} position={[sx, 0.14, ((si % 3) - 1) * 0.025]} rotation={[0.15 * (si - 2), si, 0.15 * (si - 2)]}>
              <mesh material={sharedMats.stemMat}>
                <cylinderGeometry args={[0.0028, 0.0032, 0.18, 8]} />
              </mesh>
              <group position={[0, 0.095, 0]}>
                {[0, 1, 2, 3, 4, 5].map((pi) => {
                  const pa = (pi / 6) * Math.PI * 2;
                  return (
                    <mesh
                      key={pi}
                      position={[Math.cos(pa) * 0.018, 0, Math.sin(pa) * 0.018]}
                      scale={[0.9, 0.35, 1.35]}
                      rotation={[0, -pa, 0]}
                      material={sharedMats.chamWhiteMat}
                    >
                      <sphereGeometry args={[0.011, 8, 6]} />
                    </mesh>
                  );
                })}
                <mesh position={[0, 0.006, 0]} material={sharedMats.chamGoldMat}>
                  <sphereGeometry args={[0.010, 10, 8]} />
                </mesh>
              </group>
            </group>
          ))}
        </group>
      ))}

      {/* 6. GENTLY SPINNING MINT-SAGE VINTAGE RETRO TABLE FAN (PBR Enamel + Sculpted Curved Blades!) */}
      <group position={[-0.30, 0.80, -0.32]} rotation={[0, 0.42, 0]}>
        <mesh position={[0, 0.022, 0]} material={sageEnamelMat} castShadow>
          <cylinderGeometry args={[0.075, 0.095, 0.044, 24]} />
        </mesh>
        <mesh position={[0, 0.09, -0.02]} rotation={[-0.2, 0, 0]} material={sageEnamelMat} castShadow>
          <cylinderGeometry args={[0.016, 0.024, 0.12, 18]} />
        </mesh>
        <group position={[0, 0.17, 0.01]} rotation={[-0.12, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={sageEnamelMat}>
            <cylinderGeometry args={[0.034, 0.034, 0.06, 20]} />
          </mesh>
          <group ref={fanBladeRef} position={[0, 0, 0.036]}>
            {[0, 1, 2, 3].map((bi) => (
              <mesh
                key={bi}
                rotation={[0.24, 0, (bi / 4) * Math.PI * 2]}
                geometry={fanBladeGeo}
                material={sharedMats.fanBladeMat}
              />
            ))}
          </group>
          <mesh position={[0, 0, 0.038]}>
            <torusGeometry args={[0.115, 0.0045, 12, 32]} />
            <meshStandardMaterial color="#D8E0D6" metalness={0.78} roughness={0.24} />
          </mesh>
        </group>
      </group>

      {/* 7. REAL SLATTED WOODEN DISH RACK CLEAR OF BASIN BACK WALL + FLUTED YELLOW TART MOLD + SHELL DISH FLUSH ON LACE */}
      <group position={[0.48, 0.80, -0.20]} rotation={[0, -0.22, 0]}>
        {/* Grounded wooden dish-rack base rails + upright support pegs */}
        {[-0.085, 0.085].map((rx, ri) => (
          <mesh key={`drail-${ri}`} position={[rx, 0.010, 0]} material={agedWoodMat} castShadow>
            <boxGeometry args={[0.018, 0.020, 0.14]} />
          </mesh>
        ))}
        {[-0.048, 0.0, 0.048].map((rz, ri) => (
          <React.Fragment key={`dpeg-${ri}`}>
            <mesh position={[-0.075, 0.055, rz]} material={agedWoodMat}>
              <cylinderGeometry args={[0.006, 0.006, 0.095, 10]} />
            </mesh>
            <mesh position={[0.075, 0.055, rz]} material={agedWoodMat}>
              <cylinderGeometry args={[0.006, 0.006, 0.095, 10]} />
            </mesh>
          </React.Fragment>
        ))}
        {[-0.024, 0.024].map((pz, pi) => (
          <mesh key={pi} position={[0, 0.102, pz]} rotation={[Math.PI * 0.5 + 0.12, 0, 0]} material={floralPlateMat} castShadow>
            <cylinderGeometry args={[0.098, 0.098, 0.010, 28]} />
          </mesh>
        ))}
      </group>
      <mesh position={[0.08, 0.80, -0.28]} geometry={yellowTartMoldGeo} castShadow>
        <meshPhysicalMaterial color="#EBC44C" roughness={0.46} clearcoat={0.16} envMapIntensity={0.36} />
      </mesh>
      <mesh position={[0.18, 0.821, 0.36]} scale={[1.1, 0.35, 0.95]} castShadow>
        <sphereGeometry args={[0.058, 22, 14]} />
        <meshPhysicalMaterial color="#F4B6B0" roughness={0.48} clearcoat={0.14} envMapIntensity={0.36} />
      </mesh>
    </group>
  );
};

/**
 * Phase 9 Signature Feature: Suspended Woven-Rattan Egg Swing Chair
 * Anchored cleanly into the ceiling structural joist lug `[-2.22, 3.91, 4.18]`,
 * open +Z front rotated `2.647 rad` directly toward Central Baking Island `[0, 0.92, 0]`.
 */
const SuspendedRattanEggSwingChair: React.FC<{
  wickerMat: THREE.Material;
  floralCushionMat: THREE.Material;
  agedWoodMat: THREE.Material;
  brassMat: THREE.Material;
}> = ({ wickerMat, floralCushionMat, agedWoodMat, brassMat }) => {
  const pivotRef = useRef<THREE.Group>(null);
  const swingImpulseRef = useRef(0);
  const swingPhaseRef = useRef(0);

  const {
    eggShellGeo,
    eggRimGeo,
    ribGeos,
    chainLinkGeo,
    bouclePbr,
    boucleMat,
    sagePillowMat,
    darkIronMat,
  } = useMemo(() => {
    const bPbr = createWovenFabricPbr('#F9F2E4', '#E5DAC2', 931);
    const rGeos = [-0.26, -0.14, 0.0, 0.14, 0.26].map((rx) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(rx * 0.55, 0.05, -0.10),
        new THREE.Vector3(rx, 0.36, -0.265),
        new THREE.Vector3(rx * 0.96, 0.72, -0.245),
        new THREE.Vector3(rx * 0.32, 1.02, -0.06),
      ]);
      return new THREE.TubeGeometry(curve, 22, 0.0085, 8, false);
    });
    return {
      eggShellGeo: createEggSwingShellGeometry(0.82, 1.08, 0.60),
      eggRimGeo: createEggSwingRimTubeGeometry(0.82, 1.08, 0.60, 0.022),
      ribGeos: rGeos,
      chainLinkGeo: new THREE.TorusGeometry(0.017, 0.0036, 8, 16),
      bouclePbr: bPbr,
      boucleMat: new THREE.MeshPhysicalMaterial({
        map: bPbr.map,
        bumpMap: bPbr.bumpMap,
        bumpScale: 0.006,
        roughnessMap: bPbr.roughnessMap,
        roughness: 1.0,
        sheen: 0.72,
        sheenColor: '#FFFDF7',
        sheenRoughness: 0.68,
      }),
      sagePillowMat: new THREE.MeshPhysicalMaterial({
        color: '#8FA98A',
        roughness: 0.86,
        sheen: 0.65,
        sheenColor: '#DCE8D6',
        sheenRoughness: 0.70,
      }),
      darkIronMat: new THREE.MeshStandardMaterial({
        color: '#2C2A28',
        metalness: 0.76,
        roughness: 0.38,
      }),
    };
  }, []);

  useEffect(() => {
    return () => {
      eggShellGeo.dispose();
      eggRimGeo.dispose();
      ribGeos.forEach((g) => g.dispose());
      chainLinkGeo.dispose();
      bouclePbr.map.dispose();
      bouclePbr.bumpMap.dispose();
      bouclePbr.roughnessMap.dispose();
      boucleMat.dispose();
      sagePillowMat.dispose();
      darkIronMat.dispose();
      if (document.body.style.cursor === 'pointer') {
        document.body.style.cursor = 'auto';
      }
    };
  }, [eggShellGeo, eggRimGeo, ribGeos, chainLinkGeo, bouclePbr, boucleMat, sagePillowMat, darkIronMat]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();
    if (swingImpulseRef.current > 0.001) {
      swingImpulseRef.current = Math.max(0, swingImpulseRef.current * Math.exp(-dt * 0.95));
      swingPhaseRef.current += dt * 4.4;
    }
    if (pivotRef.current) {
      const imp = swingImpulseRef.current;
      pivotRef.current.rotation.x = Math.sin(t * 0.85) * 0.012 + Math.sin(swingPhaseRef.current) * 0.095 * imp;
      pivotRef.current.rotation.z = Math.cos(t * 0.68) * 0.010 + Math.cos(swingPhaseRef.current * 0.75) * 0.042 * imp;
    }
  });

  const handleSwingClick = (e: any) => {
    if (e?.delta > 5) return;
    e?.stopPropagation?.();
    swingImpulseRef.current = 1.0;
    patisserieAudio.playSwingSwayChime();
    window.dispatchEvent(
      new CustomEvent('cottage-easter-egg', {
        detail: {
          id: 'swing',
          icon: '🪑',
          message: '轻推阳光藤编吊篮秋千，迎着庭院微风荡出清脆风铃声 ♥',
        },
      })
    );
  };

  return (
    <group position={[-2.22, 3.91, 4.18]} rotation={[0, 2.647, 0]}>
      {/* Ceiling Wrought-Iron Eye Shackle locked directly into O-Ring Lug [-2.22, 3.91, 4.18] */}
      <mesh position={[0, -0.014, 0]} material={darkIronMat} raycast={() => null}>
        <torusGeometry args={[0.022, 0.0045, 10, 20]} />
      </mesh>

      <group ref={pivotRef} position={[0, 0, 0]}>
        {/* Upper Forged Carabiner + Delicate 51 Matte-Black Suspension Chain Links (3.4cm gauge, y = -0.04 .. -2.28) */}
        <mesh position={[0, -0.042, 0]} rotation={[0, Math.PI / 2, 0]} material={darkIronMat} raycast={() => null}>
          <torusGeometry args={[0.018, 0.0042, 10, 18]} />
        </mesh>
        {Array.from({ length: 51 }).map((_, li) => (
          <mesh
            key={`swing-chain-${li}`}
            position={[0, -0.072 - li * 0.044, 0]}
            rotation={[0, li % 2 === 0 ? 0 : Math.PI / 2, 0]}
            geometry={chainLinkGeo}
            material={darkIronMat}
            castShadow
            raycast={() => null}
          />
        ))}

        {/* Swivel Brass Clevis & Suspension Damper Spring meeting Egg Basket Crown at y = -2.41 */}
        <mesh position={[0, -2.315, 0]} material={brassMat} raycast={() => null}>
          <cylinderGeometry args={[0.014, 0.014, 0.048, 16]} />
        </mesh>
        <mesh position={[0, -2.375, 0]} material={darkIronMat} raycast={() => null}>
          <torusGeometry args={[0.020, 0.0045, 10, 18]} />
        </mesh>

        {/* Woven-Rattan Teardrop Egg Basket (y_local = 0..1.08 => world y = 0.42..1.50m) */}
        <group
          position={[0, -3.49, 0]}
          onClick={handleSwingClick}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            if (document.body.style.cursor === 'pointer') {
              document.body.style.cursor = 'auto';
            }
          }}
        >
          <mesh position={[0, 1.08, 0]} material={brassMat}>
            <torusGeometry args={[0.032, 0.008, 12, 22]} />
          </mesh>
          <mesh geometry={eggShellGeo} material={wickerMat} castShadow receiveShadow />
          <mesh geometry={eggRimGeo} material={agedWoodMat} castShadow />
          {ribGeos.map((rGeo, ri) => (
            <mesh key={`egg-rib-${ri}`} geometry={rGeo} material={agedWoodMat} castShadow raycast={() => null} />
          ))}

          {/* Strictly Contained Inner Bouclé Seat Pad + Horizontal Floral Lumbar Bolster + Inner Throw Fold */}
          <mesh position={[0, 0.152, -0.004]} scale={[0.88, 0.22, 0.64]} material={boucleMat} castShadow receiveShadow>
            <sphereGeometry args={[0.285, 28, 18]} />
          </mesh>
          <mesh position={[0, 0.184, -0.004]} material={agedWoodMat} raycast={() => null}>
            <sphereGeometry args={[0.011, 10, 8]} />
          </mesh>
          <mesh position={[0, 0.295, -0.115]} rotation={[-0.16, 0, 0]} scale={[1.22, 0.54, 0.27]} material={floralCushionMat} castShadow>
            <sphereGeometry args={[0.20, 24, 16]} />
          </mesh>
          <mesh position={[0.145, 0.305, -0.035]} rotation={[0.18, -0.42, -0.26]} scale={[0.78, 0.52, 0.30]} material={sagePillowMat} castShadow>
            <sphereGeometry args={[0.11, 18, 14]} />
          </mesh>
          {/* Compact Woven Sage-and-Cream Folded Throw nestled cleanly INSIDE Left Inner Arm/Seat Curve */}
          <group position={[-0.165, 0.205, 0.010]} rotation={[0.12, 0.38, 0.26]}>
            <mesh scale={[0.88, 0.52, 1.08]} material={sagePillowMat} castShadow raycast={() => null}>
              <sphereGeometry args={[0.085, 16, 12]} />
            </mesh>
            <mesh position={[0, -0.024, 0.025]} scale={[0.84, 0.24, 0.96]} material={boucleMat} raycast={() => null}>
              <sphereGeometry args={[0.082, 14, 10]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
};

/**
 * Artisan Oak & Sisal Multi-Tier Cat Climbing Tree (`[-4.55, 0, 0.65]`, strictly grounded y = 0.000)
 * Complete with 3rd Interactive Cream-Calico Loafing Cat (`CozyCottageCats` companion)!
 */
const ArtisanOakCatClimbingTree: React.FC<{
  honeyWoodMat: THREE.Material;
  agedWoodMat: THREE.Material;
  wickerMat: THREE.Material;
}> = ({ honeyWoodMat, agedWoodMat, wickerMat }) => {
  const calicoHeadRef = useRef<THREE.Group>(null);
  const calicoTailRef = useRef<THREE.Group>(null);
  const kittenBodyRef = useRef<THREE.Mesh>(null);
  const pomPomRef = useRef<THREE.Group>(null);
  const featherRef = useRef<THREE.Group>(null);
  const heartsRef = useRef<THREE.Group>(null);
  const petTimerRef = useRef(0);
  const [petting, setPetting] = useState(false);

  const {
    baseGeo,
    houseGeo,
    houseBackGeo,
    roofSlopeGeo,
    rampGeo,
    perchGeo,
    hammockGeo,
    catGrassPotGeo,
    topPerchGeo,
    sisalPbr,
    shearlingPbr,
    calicoFur,
    gingerPatchFur,
    sisalMat,
    terracottaVelvetMat,
    sageVelvetMat,
    calicoCreamMat,
    calicoGingerMat,
    charcoalPatchMat,
    pinkEarMat,
    pinkNoseMat,
    darkEyeMat,
    whiskerMat,
    pomYarnMat,
    featherMat,
    grassPotMat,
    grassBladeMat,
    heartMat,
    tailGeo,
  } = useMemo(() => {
    const sPbr = createWovenFabricPbr('#D8C294', '#A88A56', 922);
    const shPbr = createWovenFabricPbr('#FFFFFF', '#DED2C0', 923);
    const cFur = createCatFurPbr('#FAF0E0', '#E4D2B8', 924);
    const gFur = createCatFurPbr('#D8742E', '#9C4212', 925);
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.014, 0),
      new THREE.Vector3(0.058, 0.012, 0.048),
      new THREE.Vector3(0.088, -0.008, 0.132),
      new THREE.Vector3(0.046, -0.046, 0.175),
    ]);
    return {
      baseGeo: createBeveledBoxGeometry(0.64, 0.042, 0.54, 0.08, 0.008, 0.008, 3),
      houseGeo: createGableCatHouseGeometry(0.44, 0.22, 0.39, 0.42),
      houseBackGeo: createBeveledBoxGeometry(0.43, 0.24, 0.022, 0.010, 0.004, 0.004, 2),
      roofSlopeGeo: createBeveledBoxGeometry(0.30, 0.022, 0.47, 0.008, 0.004, 0.004, 2),
      rampGeo: createBeveledBoxGeometry(0.15, 0.022, 0.56, 0.012, 0.004, 0.004, 2),
      perchGeo: createBeveledBoxGeometry(0.35, 0.026, 0.31, 0.08, 0.006, 0.006, 2),
      hammockGeo: createHollowVesselLatheGeo(0.085, 0.175, 0.185, 0.105, 0.010, 24),
      catGrassPotGeo: createHollowVesselLatheGeo(0.045, 0.062, 0.064, 0.095, 0.006, 20),
      topPerchGeo: new THREE.CylinderGeometry(0.215, 0.205, 0.026, 30),
      sisalPbr: sPbr,
      shearlingPbr: shPbr,
      calicoFur: cFur,
      gingerPatchFur: gFur,
      sisalMat: new THREE.MeshStandardMaterial({
        map: sPbr.map,
        bumpMap: sPbr.bumpMap,
        bumpScale: 0.010,
        roughnessMap: sPbr.roughnessMap,
        roughness: 1.0,
      }),
      terracottaVelvetMat: new THREE.MeshPhysicalMaterial({
        color: '#B67256',
        bumpMap: shPbr.bumpMap,
        bumpScale: 0.007,
        roughnessMap: shPbr.roughnessMap,
        roughness: 1.0,
        sheen: 0.74,
        sheenColor: '#F6D8C8',
        sheenRoughness: 0.70,
      }),
      sageVelvetMat: new THREE.MeshPhysicalMaterial({
        color: '#78926E',
        bumpMap: shPbr.bumpMap,
        bumpScale: 0.007,
        roughnessMap: shPbr.roughnessMap,
        roughness: 1.0,
        sheen: 0.68,
        sheenColor: '#D6E8D0',
        sheenRoughness: 0.72,
      }),
      calicoCreamMat: new THREE.MeshPhysicalMaterial({
        map: cFur.map,
        bumpMap: cFur.bumpMap,
        bumpScale: 0.003,
        roughness: 0.88,
        sheen: 0.62,
        sheenColor: '#FFFDF6',
        sheenRoughness: 0.74,
      }),
      calicoGingerMat: new THREE.MeshPhysicalMaterial({
        map: gFur.map,
        bumpMap: gFur.bumpMap,
        bumpScale: 0.004,
        roughness: 0.88,
        sheen: 0.56,
        sheenColor: '#F7C992',
        sheenRoughness: 0.72,
      }),
      charcoalPatchMat: new THREE.MeshPhysicalMaterial({ color: '#423832', roughness: 0.88, sheen: 0.45 }),
      pinkEarMat: new THREE.MeshStandardMaterial({ color: '#F2A8AA', roughness: 0.78 }),
      pinkNoseMat: new THREE.MeshPhysicalMaterial({ color: '#EC8E92', roughness: 0.48, clearcoat: 0.12, envMapIntensity: 0.34 }),
      darkEyeMat: new THREE.MeshStandardMaterial({ color: '#2E1F18', roughness: 0.55 }),
      whiskerMat: new THREE.MeshStandardMaterial({ color: '#FFFBF2', roughness: 0.60 }),
      pomYarnMat: new THREE.MeshPhysicalMaterial({ color: '#E8A59E', roughness: 0.90, sheen: 0.65 }),
      featherMat: new THREE.MeshPhysicalMaterial({ color: '#6FB8AC', roughness: 0.52, sheen: 0.55 }),
      grassPotMat: new THREE.MeshPhysicalMaterial({ color: '#D48262', roughness: 0.68, clearcoat: 0.06, envMapIntensity: 0.34 }),
      grassBladeMat: new THREE.MeshStandardMaterial({ color: '#68AC42', roughness: 0.58, side: THREE.DoubleSide }),
      heartMat: new THREE.MeshStandardMaterial({ color: '#FF7D96', emissive: '#FF4E74', emissiveIntensity: 1.5 }),
      tailGeo: new THREE.TubeGeometry(tailCurve, 18, 0.0155, 10, false),
    };
  }, []);

  useEffect(() => {
    return () => {
      baseGeo.dispose();
      houseGeo.dispose();
      houseBackGeo.dispose();
      roofSlopeGeo.dispose();
      rampGeo.dispose();
      perchGeo.dispose();
      hammockGeo.dispose();
      catGrassPotGeo.dispose();
      topPerchGeo.dispose();
      tailGeo.dispose();
      sisalPbr.map.dispose();
      sisalPbr.bumpMap.dispose();
      sisalPbr.roughnessMap.dispose();
      shearlingPbr.map.dispose();
      shearlingPbr.bumpMap.dispose();
      shearlingPbr.roughnessMap.dispose();
      calicoFur.map.dispose();
      calicoFur.bumpMap.dispose();
      gingerPatchFur.map.dispose();
      gingerPatchFur.bumpMap.dispose();
      sisalMat.dispose();
      terracottaVelvetMat.dispose();
      sageVelvetMat.dispose();
      calicoCreamMat.dispose();
      calicoGingerMat.dispose();
      charcoalPatchMat.dispose();
      pinkEarMat.dispose();
      pinkNoseMat.dispose();
      darkEyeMat.dispose();
      whiskerMat.dispose();
      pomYarnMat.dispose();
      featherMat.dispose();
      grassPotMat.dispose();
      grassBladeMat.dispose();
      heartMat.dispose();
      if (document.body.style.cursor === 'pointer') {
        document.body.style.cursor = 'auto';
      }
    };
  }, [
    baseGeo,
    houseGeo,
    houseBackGeo,
    roofSlopeGeo,
    rampGeo,
    perchGeo,
    hammockGeo,
    catGrassPotGeo,
    topPerchGeo,
    tailGeo,
    sisalPbr,
    shearlingPbr,
    calicoFur,
    gingerPatchFur,
    sisalMat,
    terracottaVelvetMat,
    sageVelvetMat,
    calicoCreamMat,
    calicoGingerMat,
    charcoalPatchMat,
    pinkEarMat,
    pinkNoseMat,
    darkEyeMat,
    whiskerMat,
    pomYarnMat,
    featherMat,
    grassPotMat,
    grassBladeMat,
    heartMat,
  ]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();
    if (petTimerRef.current > 0) {
      petTimerRef.current = Math.max(0, petTimerRef.current - dt);
      if (petTimerRef.current === 0) setPetting(false);
    }
    const excited = petTimerRef.current > 0 ? 1 : 0;
    if (calicoHeadRef.current) {
      calicoHeadRef.current.rotation.y = Math.sin(t * (0.65 + excited * 3.8)) * (0.20 + excited * 0.16);
      calicoHeadRef.current.rotation.z = Math.cos(t * (0.5 + excited * 4.5)) * (0.04 + excited * 0.12);
    }
    if (calicoTailRef.current) {
      calicoTailRef.current.rotation.y = Math.sin(t * (1.2 + excited * 5.6)) * (0.14 + excited * 0.30);
    }
    if (kittenBodyRef.current) {
      const kBreath = 1.0 + Math.sin(t * 2.2) * 0.04;
      kittenBodyRef.current.scale.set(1.12, 0.72 * kBreath, 0.96);
    }
    if (pomPomRef.current) {
      pomPomRef.current.rotation.z = Math.sin(t * (2.1 + excited * 5.8)) * (0.07 + excited * 0.38);
      pomPomRef.current.rotation.x = Math.cos(t * (1.7 + excited * 4.9)) * (0.05 + excited * 0.28);
    }
    if (featherRef.current) {
      featherRef.current.rotation.z = Math.cos(t * (2.4 + excited * 6.0)) * (0.08 + excited * 0.36);
    }
    if (heartsRef.current && petTimerRef.current > 0) {
      const p = 1.0 - petTimerRef.current / 2.4;
      heartsRef.current.position.y = 0.18 + p * 0.34;
      heartsRef.current.rotation.y = t * 2.2;
    }
  });

  const handlePetCalico = (e: any) => {
    if (e?.delta > 5) return;
    e?.stopPropagation?.();
    petTimerRef.current = 2.4;
    setPetting(true);
    patisserieAudio.playCatPurrAndMeow();
    window.dispatchEvent(
      new CustomEvent('cottage-easter-egg', {
        detail: {
          id: 'cat',
          icon: '🐾',
          message: '轻抚了猫爬架云朵窝上的三花小猫，它扑着毛线球和羽毛逗猫棒开心呼噜 ♥',
        },
      })
    );
  };

  return (
    <group position={[-4.46, 0.000, 0.58]} rotation={[0, 0.28, 0]}>
      {/* Tier 0: Spacious Grounded Honey-Oak Condo Pedestal strictly at y = 0.000 */}
      <mesh position={[0, 0.021, 0]} geometry={baseGeo} material={honeyWoodMat} castShadow receiveShadow />

      {/* Grounded Terracotta Cat-Grass Pot (`猫草`) on Front-Left Base Corner (`y = 0.042`) */}
      <group position={[-0.24, 0.042, 0.21]}>
        <mesh geometry={catGrassPotGeo} material={grassPotMat} castShadow receiveShadow />
        {Array.from({ length: 14 }).map((_, gi) => {
          const a = (gi / 14) * Math.PI * 2;
          return (
            <mesh
              key={`cgrass-${gi}`}
              position={[Math.cos(a) * 0.025, 0.125, Math.sin(a) * 0.025]}
              rotation={[(gi % 2 === 0 ? 0.22 : -0.18), a, 0.18]}
              material={grassBladeMat}
              raycast={() => null}
            >
              <coneGeometry args={[0.007, 0.095 + (gi % 3) * 0.025, 4]} />
            </mesh>
          );
        })}
      </group>

      {/* Tier 1: Storybook Gabled Oak Cat House (`猫窝`) + Warm Interior Glow + Curled Ginger Kitten #4 */}
      <group position={[-0.08, 0.042, -0.05]}>
        <mesh geometry={houseGeo} material={honeyWoodMat} castShadow receiveShadow />
        <mesh position={[0, 0.125, -0.195]} geometry={houseBackGeo} material={agedWoodMat} castShadow />
        {/* Overhanging Beveled Gable Roof Slopes */}
        <mesh position={[-0.125, 0.315, 0]} rotation={[0, 0, 0.66]} geometry={roofSlopeGeo} material={agedWoodMat} castShadow />
        <mesh position={[0.125, 0.315, 0]} rotation={[0, 0, -0.66]} geometry={roofSlopeGeo} material={agedWoodMat} castShadow />
        {/* Sage Velvet Cushion */}
        <mesh position={[0, 0.030, 0]} scale={[1.25, 0.22, 1.18]} material={sageVelvetMat} receiveShadow>
          <sphereGeometry args={[0.145, 18, 12]} />
        </mesh>
        {/* Cozy Curled Sleeping Ginger Kitten #4 inside Arched Doorway */}
        <group position={[0, 0.068, 0.065]} rotation={[0, 0.35, 0]} onClick={handlePetCalico}>
          <mesh ref={kittenBodyRef} scale={[1.12, 0.72, 0.96]} material={calicoGingerMat} castShadow>
            <sphereGeometry args={[0.056, 18, 14]} />
          </mesh>
          <group position={[0.046, 0.022, 0.028]}>
            <mesh material={calicoGingerMat} castShadow>
              <sphereGeometry args={[0.036, 16, 12]} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={`kear-${s}`} position={[s * 0.022, 0.030, 0]} rotation={[0.1, 0, -s * 0.32]} material={calicoGingerMat}>
                <coneGeometry args={[0.012, 0.024, 10]} />
              </mesh>
            ))}
          </group>
        </group>
      </group>

      {/* Angled Sisal-Rung Climbing Ramp bridging Base (`+Z`, y=0.043) -> Balcony Perch 1 (`-Z`, y=0.561) */}
      <group position={[0.18, 0.302, 0.125]} rotation={[1.18, -0.10, 0]}>
        <mesh geometry={rampGeo} material={honeyWoodMat} castShadow receiveShadow />
        {[-0.20, -0.12, -0.04, 0.04, 0.12, 0.20].map((rz, ri) => (
          <mesh key={`ramp-rung-${ri}`} position={[0, 0.014, rz]} material={sisalMat}>
            <boxGeometry args={[0.132, 0.010, 0.026]} />
          </mesh>
        ))}
      </group>

      {/* Twin Thick Sisal-Wrapped Scratching Columns */}
      {/* Tall Main Tower Column (base y=0.042 -> top cloud perch y=1.54) */}
      <group position={[0.14, 0.042, -0.08]}>
        <mesh position={[0, 0.749, 0]} material={sisalMat} castShadow receiveShadow>
          <cylinderGeometry args={[0.050, 0.050, 1.498, 22]} />
        </mesh>
        {[0.015, 0.51, 1.00, 1.482].map((cy, ci) => (
          <mesh key={`colA-${ci}`} position={[0, cy, 0]} material={agedWoodMat}>
            <cylinderGeometry args={[0.056, 0.056, 0.030, 18]} />
          </mesh>
        ))}
      </group>
      {/* Mid Column rising from Gable House Shoulder (y=0.27 -> left perch y=1.04) */}
      <group position={[-0.14, 0.27, 0.02]}>
        <mesh position={[0, 0.385, 0]} material={sisalMat} castShadow receiveShadow>
          <cylinderGeometry args={[0.044, 0.044, 0.77, 18]} />
        </mesh>
        {[0.014, 0.755].map((cy, ci) => (
          <mesh key={`colB-${ci}`} position={[0, cy, 0]} material={agedWoodMat}>
            <cylinderGeometry args={[0.050, 0.050, 0.026, 16]} />
          </mesh>
        ))}
      </group>

      {/* Tier 2A: Mid Balcony Perch 1 (y = 0.56, sage velvet pad) */}
      <group position={[0.16, 0.56, 0.00]}>
        <mesh position={[0, 0.013, 0]} geometry={perchGeo} material={honeyWoodMat} castShadow receiveShadow />
        <mesh position={[0, 0.030, 0]} scale={[1.18, 0.20, 1.02]} material={sageVelvetMat} receiveShadow>
          <sphereGeometry args={[0.132, 18, 12]} />
        </mesh>
      </group>

      {/* Tier 2B: Hanging Woven-Seagrass Hammock Basket Bed (y = 0.94, between columns) */}
      <group position={[0.00, 0.94, 0.02]}>
        <mesh position={[0.07, 0.02, -0.05]} rotation={[0, -0.45, Math.PI / 2]} material={agedWoodMat} castShadow>
          <cylinderGeometry args={[0.014, 0.014, 0.22, 12]} />
        </mesh>
        <mesh geometry={hammockGeo} material={wickerMat} castShadow receiveShadow />
        <mesh position={[0, 0.045, 0]} scale={[1.05, 0.22, 1.05]} material={sageVelvetMat} receiveShadow>
          <sphereGeometry args={[0.14, 18, 12]} />
        </mesh>
      </group>

      {/* Tier 2C: Staggered Left Leaf Perch 2 (y = 1.04, terracotta pad + dangling feather teaser toy) */}
      <group position={[-0.14, 1.04, 0.02]}>
        <mesh position={[0, 0.013, 0]} geometry={perchGeo} material={honeyWoodMat} castShadow receiveShadow />
        <mesh position={[0, 0.030, 0]} scale={[1.18, 0.20, 1.02]} material={terracottaVelvetMat} receiveShadow>
          <sphereGeometry args={[0.132, 18, 12]} />
        </mesh>
        <group ref={featherRef} position={[-0.10, 0.0, 0.12]}>
          <mesh position={[0, -0.10, 0]} material={sisalMat} raycast={() => null}>
            <cylinderGeometry args={[0.0035, 0.0035, 0.20, 8]} />
          </mesh>
          <mesh position={[0, -0.21, 0]} rotation={[0.25, 0, 0.2]} scale={[0.42, 1.25, 0.22]} material={featherMat} castShadow onClick={handlePetCalico}>
            <sphereGeometry args={[0.036, 12, 10]} />
          </mesh>
        </group>
      </group>

      {/* Tier 3: Top Grand Shearling Cloud Perch (y = 1.54, clear >= 33cm below Pegboard bottom 1.87m!) */}
      <group position={[0.14, 1.54, -0.05]}>
        <mesh position={[0, 0.013, 0]} geometry={topPerchGeo} material={honeyWoodMat} castShadow receiveShadow />
        <mesh position={[0, 0.034, 0]} scale={[1.0, 0.24, 1.0]} material={terracottaVelvetMat} receiveShadow>
          <cylinderGeometry args={[0.202, 0.202, 0.085, 26]} />
        </mesh>
        <mesh position={[0, 0.052, 0]} rotation={[Math.PI / 2, 0, 0]} material={terracottaVelvetMat} castShadow>
          <torusGeometry args={[0.175, 0.036, 12, 28]} />
        </mesh>

        {/* Swaying Sisal Cord & Dangling Yarn Pom-Pom */}
        <group ref={pomPomRef} position={[-0.06, 0.0, 0.18]}>
          <mesh position={[0, -0.11, 0]} material={sisalMat} raycast={() => null}>
            <cylinderGeometry args={[0.004, 0.004, 0.22, 8]} />
          </mesh>
          <mesh position={[0, -0.225, 0]} material={pomYarnMat} castShadow onClick={handlePetCalico}>
            <sphereGeometry args={[0.028, 14, 12]} />
          </mesh>
        </group>

        {/* 3rd Interactive Ginger-Calico Loafing Cat (`1.28x` crisp silhouette atop terracotta bed!) */}
        <group
          position={[0, 0.046, 0.01]}
          rotation={[0, 0.68, 0]}
          scale={1.28}
          onClick={handlePetCalico}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            if (document.body.style.cursor === 'pointer') {
              document.body.style.cursor = 'auto';
            }
          }}
        >
          {petting && (
            <group ref={heartsRef} position={[0, 0.18, 0.02]} raycast={() => null}>
              {[
                [-0.04, 0.04, 0],
                [0.04, 0.07, 0.02],
                [0, 0.11, -0.02],
              ].map(([hx, hy, hz], hi) => (
                <mesh key={hi} position={[hx, hy, hz]} material={heartMat}>
                  <octahedronGeometry args={[0.014, 0]} />
                </mesh>
              ))}
            </group>
          )}
          <mesh position={[0, 0.052, 0]} scale={[1.02, 0.72, 1.24]} material={calicoCreamMat} castShadow>
            <sphereGeometry args={[0.082, 22, 16]} />
          </mesh>
          <mesh position={[0.024, 0.072, -0.006]} scale={[0.92, 0.66, 1.05]} material={calicoGingerMat}>
            <sphereGeometry args={[0.062, 16, 12]} />
          </mesh>
          <mesh position={[-0.042, 0.068, -0.020]} scale={[0.68, 0.56, 0.78]} material={charcoalPatchMat}>
            <sphereGeometry args={[0.052, 16, 12]} />
          </mesh>
          <group ref={calicoHeadRef} position={[0, 0.115, 0.068]}>
            <mesh scale={[1.06, 0.95, 0.96]} material={calicoCreamMat} castShadow>
              <sphereGeometry args={[0.054, 20, 16]} />
            </mesh>
            <mesh position={[0.022, 0.022, 0.008]} scale={[0.74, 0.66, 0.76]} material={calicoGingerMat}>
              <sphereGeometry args={[0.030, 12, 10]} />
            </mesh>
            <mesh position={[-0.022, 0.020, 0.006]} scale={[0.66, 0.60, 0.70]} material={charcoalPatchMat}>
              <sphereGeometry args={[0.027, 12, 10]} />
            </mesh>
            <mesh position={[0, -0.012, 0.044]} scale={[0.8, 0.6, 0.55]} material={calicoCreamMat}>
              <sphereGeometry args={[0.022, 12, 10]} />
            </mesh>
            <mesh position={[0, -0.005, 0.058]} scale={[1.15, 0.78, 0.65]} material={pinkNoseMat}>
              <sphereGeometry args={[0.0058, 10, 8]} />
            </mesh>
            {[-1, 1].map((side) => (
              <mesh
                key={`cat3-eye-${side}`}
                position={[side * 0.020, 0.008, 0.049]}
                rotation={[0, side * 0.2, -side * 0.12]}
                material={darkEyeMat}
              >
                <boxGeometry args={[0.014, 0.0032, 0.003]} />
              </mesh>
            ))}
            {[-1, 1].map((side) =>
              [-0.006, 0.004].map((wy, wi) => (
                <mesh
                  key={`cat3-w-${side}-${wi}`}
                  position={[side * 0.032, -0.008 + wy, 0.048]}
                  rotation={[0, -side * 0.25, side * (wi === 0 ? 0.14 : -0.10)]}
                  material={whiskerMat}
                >
                  <cylinderGeometry args={[0.0010, 0.0008, 0.028, 6]} />
                </mesh>
              ))
            )}
            {[-1, 1].map((side) => (
              <group key={side} position={[side * 0.032, 0.046, -0.004]} rotation={[0.14, 0, -side * 0.34]}>
                <mesh material={side < 0 ? charcoalPatchMat : calicoGingerMat} castShadow>
                  <coneGeometry args={[0.019, 0.040, 14]} />
                </mesh>
                <mesh position={[0, -0.003, 0.006]} scale={[0.6, 0.66, 0.62]} material={pinkEarMat}>
                  <coneGeometry args={[0.015, 0.030, 12]} />
                </mesh>
              </group>
            ))}
          </group>
          <group ref={calicoTailRef} position={[0.032, 0.024, 0.028]}>
            <mesh geometry={tailGeo} material={calicoGingerMat} castShadow />
          </group>
        </group>
      </group>
    </group>
  );
};

/**
 * Cozy West Cat-Corner Connectivity Kit:
 * 1. Braided Jute & Cream-Cotton Oval Floor Runner (`[-4.12, 0, 1.09]`) bridging Condo Ramp to Daybed Step
 * 2. Raised Honey-Oak Feeding Stand & Twin Ceramic Water / Salmon Kibble Bowls (`[-3.98, 0.084, 1.56]`)
 * 3. Twin Floating Oak & Sisal Wall Stepping Shelves (`猫跳板`) at `[-4.96, 1.36, 1.18]` & `[-4.96, 1.66, 1.59]`
 */
const CatCornerConnectivityPack: React.FC<{
  honeyWoodMat: THREE.Material;
  agedWoodMat: THREE.Material;
  brassMat: THREE.Material;
  creamLinenMat: THREE.Material;
  porcelainMat: THREE.Material;
}> = ({ honeyWoodMat, agedWoodMat, brassMat, creamLinenMat, porcelainMat }) => {
  const {
    standDeckGeo,
    catBowlGeo,
    shelf1Geo,
    shelf2Geo,
    pad1Geo,
    pad2Geo,
    jutePbr,
    sisalMat,
    sageRugMat,
    celadonTrimMat,
    waterSurfaceMat,
    kibbleMat,
  } = useMemo(() => {
    const jPbr = createWovenFabricPbr('#CDB384', '#9A7C4A', 931);
    return {
      standDeckGeo: createBeveledBoxGeometry(0.34, 0.016, 0.16, 0.016, 0.004, 0.004, 2),
      catBowlGeo: createHollowVesselLatheGeo(0.044, 0.056, 0.060, 0.048, 0.006, 24),
      shelf1Geo: createBeveledBoxGeometry(0.24, 0.024, 0.36, 0.014, 0.005, 0.005, 2),
      shelf2Geo: createBeveledBoxGeometry(0.24, 0.024, 0.30, 0.014, 0.005, 0.005, 2),
      pad1Geo: createBeveledBoxGeometry(0.20, 0.008, 0.32, 0.010, 0.003, 0.003, 2),
      pad2Geo: createBeveledBoxGeometry(0.20, 0.008, 0.26, 0.010, 0.003, 0.003, 2),
      jutePbr: jPbr,
      sisalMat: new THREE.MeshStandardMaterial({
        map: jPbr.map,
        bumpMap: jPbr.bumpMap,
        bumpScale: 0.009,
        roughnessMap: jPbr.roughnessMap,
        roughness: 1.0,
      }),
      sageRugMat: new THREE.MeshPhysicalMaterial({
        color: '#7E9674',
        map: jPbr.map,
        bumpMap: jPbr.bumpMap,
        bumpScale: 0.006,
        roughnessMap: jPbr.roughnessMap,
        roughness: 1.0,
        sheen: 0.45,
        sheenColor: '#D6E4CC',
      }),
      celadonTrimMat: new THREE.MeshPhysicalMaterial({
        color: '#88AC90',
        roughness: 0.44,
        clearcoat: 0.16,
        clearcoatRoughness: 0.32,
        envMapIntensity: 0.38,
      }),
      waterSurfaceMat: new THREE.MeshPhysicalMaterial({
        color: '#DDF2F6',
        roughness: 0.12,
        clearcoat: 0.24,
        transparent: true,
        opacity: 0.72,
        envMapIntensity: 0.52,
      }),
      kibbleMat: new THREE.MeshStandardMaterial({ color: '#7A4624', roughness: 0.72 }),
    };
  }, []);

  useEffect(() => {
    return () => {
      standDeckGeo.dispose();
      catBowlGeo.dispose();
      shelf1Geo.dispose();
      shelf2Geo.dispose();
      pad1Geo.dispose();
      pad2Geo.dispose();
      jutePbr.map.dispose();
      jutePbr.bumpMap.dispose();
      jutePbr.roughnessMap.dispose();
      sisalMat.dispose();
      sageRugMat.dispose();
      celadonTrimMat.dispose();
      waterSurfaceMat.dispose();
      kibbleMat.dispose();
    };
  }, [
    standDeckGeo,
    catBowlGeo,
    shelf1Geo,
    shelf2Geo,
    pad1Geo,
    pad2Geo,
    jutePbr,
    sisalMat,
    sageRugMat,
    celadonTrimMat,
    waterSurfaceMat,
    kibbleMat,
  ]);

  const kibbleSpots: [number, number, number][] = [
    [0, 0.032, 0],
    [-0.018, 0.028, 0.012],
    [0.019, 0.029, 0.014],
    [-0.014, 0.027, -0.016],
    [0.016, 0.027, -0.015],
    [0.0, 0.024, 0.025],
    [0.026, 0.024, 0.0],
    [-0.026, 0.024, -0.003],
    [0.002, 0.024, -0.024],
    [-0.010, 0.036, 0.005],
    [0.009, 0.035, -0.006],
    [-0.022, 0.022, 0.022],
    [0.022, 0.022, -0.020],
  ];

  const wallShelves = [
    { pos: [-4.96, 1.36, 1.18] as [number, number, number], shelfGeo: shelf1Geo, padGeo: pad1Geo, bz: 0.115 },
    { pos: [-4.96, 1.66, 1.59] as [number, number, number], shelfGeo: shelf2Geo, padGeo: pad2Geo, bz: 0.095 },
  ];

  return (
    <group>
      {/* 1. Braided Jute & Cream-Cotton Oval Floor Runner connecting Cat Condo Ramp -> Daybed Step */}
      <group position={[-4.12, 0.000, 1.09]} rotation={[0, 0.08, 0]} raycast={() => null}>
        <mesh position={[0, 0.004, 0]} scale={[1.0, 1.0, 0.57]} material={sisalMat} receiveShadow castShadow>
          <cylinderGeometry args={[0.37, 0.37, 0.008, 36]} />
        </mesh>
        <mesh position={[0, 0.005, 0]} scale={[1.0, 1.0, 0.57]} material={creamLinenMat} receiveShadow>
          <cylinderGeometry args={[0.305, 0.305, 0.0085, 32]} />
        </mesh>
        <mesh position={[0, 0.0058, 0]} scale={[1.0, 1.0, 0.56]} material={sageRugMat} receiveShadow>
          <cylinderGeometry args={[0.195, 0.195, 0.0092, 28]} />
        </mesh>
        {[-0.378, 0.378].map((tx, ti) =>
          [-0.06, 0, 0.06].map((tz, zi) => (
            <mesh key={`rug-tassel-${ti}-${zi}`} position={[tx, 0.004, tz]} rotation={[0, 0, Math.PI / 2]} material={creamLinenMat}>
              <capsuleGeometry args={[0.0042, 0.018, 4, 8]} />
            </mesh>
          ))
        )}
      </group>

      {/* 2. Raised Honey-Oak Feeding Stand + Twin Ceramic Cat Water & Salmon Kibble Bowls on Cozy Platform */}
      <group position={[-3.98, 0.084, 1.56]} rotation={[0, -0.18, 0]}>
        {[-0.145, 0.145].map((lx, xi) =>
          [-0.056, 0.056].map((lz, zi) => (
            <mesh key={`feed-leg-${xi}-${zi}`} position={[lx, 0.026, lz]} material={agedWoodMat} castShadow>
              <cylinderGeometry args={[0.011, 0.008, 0.052, 12]} />
            </mesh>
          ))
        )}
        <mesh position={[0, 0.058, 0]} geometry={standDeckGeo} material={honeyWoodMat} castShadow receiveShadow />

        {/* Left Ceramic Bowl: Fresh Reflective Water */}
        <group position={[-0.082, 0.066, 0]}>
          <mesh geometry={catBowlGeo} material={porcelainMat} castShadow receiveShadow />
          <mesh position={[0, 0.047, 0]} rotation={[Math.PI / 2, 0, 0]} material={celadonTrimMat}>
            <torusGeometry args={[0.058, 0.0032, 10, 26]} />
          </mesh>
          <mesh position={[0, 0.036, 0]} rotation={[-Math.PI / 2, 0, 0]} material={waterSurfaceMat}>
            <circleGeometry args={[0.051, 24]} />
          </mesh>
        </group>

        {/* Right Ceramic Bowl: Roasted Salmon Kibble Pellets */}
        <group position={[0.082, 0.066, 0]}>
          <mesh geometry={catBowlGeo} material={porcelainMat} castShadow receiveShadow />
          <mesh position={[0, 0.047, 0]} rotation={[Math.PI / 2, 0, 0]} material={brassMat}>
            <torusGeometry args={[0.058, 0.0030, 10, 26]} />
          </mesh>
          <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]} material={kibbleMat}>
            <circleGeometry args={[0.046, 20]} />
          </mesh>
          {kibbleSpots.map(([kx, ky, kz], ki) => (
            <mesh key={`kibble-${ki}`} position={[kx, ky, kz]} scale={[1.1, 0.65, 1.0]} material={kibbleMat} castShadow>
              <sphereGeometry args={[0.0085, 8, 6]} />
            </mesh>
          ))}
        </group>
      </group>

      {/* 3. Twin Staggered Floating Oak & Sisal Wall Stepping Shelves (`猫跳板`) bridging Condo -> Plant Wall */}
      {wallShelves.map((sh, si) => (
        <group key={`cat-wall-shelf-${si}`} position={sh.pos}>
          <mesh geometry={sh.shelfGeo} material={honeyWoodMat} castShadow receiveShadow />
          <mesh position={[0.005, 0.015, 0]} geometry={sh.padGeo} material={sisalMat} receiveShadow />
          {[-sh.bz, sh.bz].map((bz, bi) => (
            <group key={`shelf-bracket-${si}-${bi}`} position={[-0.02, -0.064, bz]}>
              <mesh position={[-0.088, 0, 0]} material={agedWoodMat} castShadow>
                <boxGeometry args={[0.024, 0.110, 0.026]} />
              </mesh>
              <mesh position={[-0.015, 0.008, 0]} rotation={[0, 0, 0.72]} material={agedWoodMat} castShadow>
                <boxGeometry args={[0.018, 0.150, 0.022]} />
              </mesh>
              <mesh position={[-0.072, -0.036, 0]} rotation={[0, 0, Math.PI / 2]} material={brassMat}>
                <cylinderGeometry args={[0.0045, 0.0045, 0.010, 10]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
};

/**
 * Indoor Fruiting Dwarf Calamondin Orange Tree (`[4.12, 0, -2.92]`, clear of curtains/windows/coffee cart)
 */
const DwarfCalamondinOrangeTree: React.FC = () => {
  const leafInstRef = useRef<THREE.InstancedMesh>(null);
  const {
    potGeo,
    trunkGeo,
    limbGeoA,
    limbGeoB,
    leafGeo,
    potMat,
    soilMat,
    barkMat,
    orangeMat,
    blossomMat,
  } = useMemo(() => {
    return {
      potGeo: createHollowVesselLatheGeo(0.112, 0.162, 0.152, 0.27, 0.012, 24),
      trunkGeo: createOrganicTreeLimbGeometry(
        [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(-0.018, 0.16, 0.015),
          new THREE.Vector3(0.014, 0.34, -0.012),
          new THREE.Vector3(0, 0.46, 0),
        ],
        0.026,
        0.013,
        12
      ),
      limbGeoA: createOrganicTreeLimbGeometry(
        [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.065, 0.13, 0.03),
          new THREE.Vector3(0.115, 0.27, 0.05),
        ],
        0.013,
        0.005,
        10
      ),
      limbGeoB: createOrganicTreeLimbGeometry(
        [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(-0.055, 0.12, 0.04),
          new THREE.Vector3(-0.095, 0.24, 0.06),
        ],
        0.012,
        0.005,
        10
      ),
      leafGeo: createCitrusLeafGeometry(),
      potMat: new THREE.MeshPhysicalMaterial({ color: '#D78A68', roughness: 0.70, clearcoat: 0.06, envMapIntensity: 0.34 }),
      soilMat: new THREE.MeshStandardMaterial({ color: '#422B1E', roughness: 0.96 }),
      barkMat: new THREE.MeshStandardMaterial({ color: '#7D5C3E', roughness: 0.88 }),
      orangeMat: new THREE.MeshPhysicalMaterial({ color: '#F08222', roughness: 0.38, clearcoat: 0.14, envMapIntensity: 0.36 }),
      blossomMat: new THREE.MeshStandardMaterial({ color: '#FFFBF0', roughness: 0.58 }),
    };
  }, []);

  useLayoutEffect(() => {
    const inst = leafInstRef.current;
    if (!inst) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const greens = [0x4e8c3a, 0x62a448, 0x78b856, 0x427c32];
    let rng = 4091;
    const rand = () => {
      rng = (rng * 1664525 + 1013904223) >>> 0;
      return rng / 4294967296;
    };
    for (let i = 0; i < 88; i++) {
      const a = rand() * Math.PI * 2;
      const r = 0.04 + Math.pow(rand(), 0.7) * 0.24;
      const y = 0.56 + rand() * 0.44;
      dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      dummy.rotation.set((rand() - 0.5) * 1.1, a, 0.45 + (rand() - 0.5) * 0.7);
      dummy.scale.setScalar(0.95 + rand() * 0.55);
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
      potGeo.dispose();
      trunkGeo.dispose();
      limbGeoA.dispose();
      limbGeoB.dispose();
      leafGeo.dispose();
      potMat.dispose();
      soilMat.dispose();
      barkMat.dispose();
      orangeMat.dispose();
      blossomMat.dispose();
    };
  }, [potGeo, trunkGeo, limbGeoA, limbGeoB, leafGeo, potMat, soilMat, barkMat, orangeMat, blossomMat]);

  const oranges: Array<[number, number, number, number]> = [
    [-0.14, 0.68, 0.12, 0.022],
    [0.12, 0.74, 0.14, 0.024],
    [0.02, 0.86, -0.11, 0.021],
    [-0.16, 0.80, -0.08, 0.020],
    [0.17, 0.64, -0.07, 0.023],
    [-0.04, 0.94, 0.09, 0.022],
    [0.08, 0.90, 0.04, 0.019],
    [-0.11, 0.60, 0.02, 0.021],
    [0.06, 0.68, -0.16, 0.020],
    [-0.02, 0.77, 0.17, 0.023],
    [0.14, 0.84, -0.10, 0.019],
    [-0.18, 0.74, 0.03, 0.020],
    [0.00, 0.62, 0.14, 0.021],
    [0.11, 0.95, -0.02, 0.018],
  ];

  return (
    <group position={[4.12, 0.000, -2.92]}>
      <mesh geometry={potGeo} material={potMat} castShadow receiveShadow />
      <mesh position={[0, 0.242, 0]} rotation={[-Math.PI / 2, 0, 0]} material={soilMat}>
        <circleGeometry args={[0.142, 20]} />
      </mesh>
      <mesh position={[0, 0.24, 0]} geometry={trunkGeo} material={barkMat} castShadow />
      <mesh position={[0, 0.56, 0]} rotation={[0, 0.4, 0]} geometry={limbGeoA} material={barkMat} castShadow />
      <mesh position={[0, 0.58, 0]} rotation={[0, 2.5, 0]} geometry={limbGeoB} material={barkMat} castShadow />
      <mesh position={[0, 0.62, 0]} rotation={[0, -1.6, 0]} geometry={limbGeoA} material={barkMat} castShadow />
      <instancedMesh ref={leafInstRef} args={[leafGeo, undefined, 88]} castShadow receiveShadow raycast={() => null}>
        <meshPhysicalMaterial roughness={0.56} clearcoat={0.10} envMapIntensity={0.34} side={THREE.DoubleSide} />
      </instancedMesh>
      {oranges.map(([ox, oy, oz, r], oi) => (
        <mesh key={`calamondin-${oi}`} position={[ox, oy, oz]} scale={[1.0, 0.94, 1.0]} material={orangeMat} castShadow raycast={() => null}>
          <sphereGeometry args={[r, 14, 12]} />
        </mesh>
      ))}
      {[
        [-0.08, 0.88, 0.14],
        [0.15, 0.78, 0.08],
        [-0.05, 0.66, -0.15],
        [0.09, 0.92, -0.09],
        [-0.14, 0.84, -0.02],
        [0.02, 0.73, 0.16],
      ].map(([bx, by, bz], bi) => (
        <mesh key={`cal-bloss-${bi}`} position={[bx, by, bz]} material={blossomMat} raycast={() => null}>
          <dodecahedronGeometry args={[0.011, 0]} />
        </mesh>
      ))}
    </group>
  );
};

/**
 * Hanging Braided Boston Fern Basket suspended from West Wall Forged Wrought-Iron Scroll Bracket
 * Bracket base rooted flush on West Wall `[-5.07, 3.05, 1.55]`, hook centered at `[-4.62, 3.05, 1.55]`
 */
const HangingBraidedFernBasket: React.FC<{
  wickerMat: THREE.Material;
  brassMat: THREE.Material;
}> = ({ wickerMat, brassMat }) => {
  const swayRef = useRef<THREE.Group>(null);
  const { basketGeo, fernGeo, scrollGeo, ironMat, cordMat, frondMat, trailMat } = useMemo(() => {
    const scrollCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.015, -0.14, 0),
      new THREE.Vector3(0.11, -0.06, 0),
      new THREE.Vector3(0.24, 0.035, 0),
      new THREE.Vector3(0.38, 0.055, 0),
    ]);
    return {
      basketGeo: createHollowVesselLatheGeo(0.11, 0.19, 0.185, 0.16, 0.010, 24),
      fernGeo: createSwordFernFrondGeometry(),
      scrollGeo: new THREE.TubeGeometry(scrollCurve, 22, 0.008, 10, false),
      ironMat: new THREE.MeshStandardMaterial({ color: '#363230', metalness: 0.58, roughness: 0.50, envMapIntensity: 0.38 }),
      cordMat: new THREE.MeshStandardMaterial({ color: '#B49A6E', roughness: 0.90 }),
      frondMat: new THREE.MeshPhysicalMaterial({ color: '#5A9844', roughness: 0.58, clearcoat: 0.08, envMapIntensity: 0.34, side: THREE.DoubleSide }),
      trailMat: new THREE.MeshPhysicalMaterial({ color: '#70AC58', roughness: 0.56, envMapIntensity: 0.34, side: THREE.DoubleSide }),
    };
  }, []);

  useEffect(() => {
    return () => {
      basketGeo.dispose();
      fernGeo.dispose();
      scrollGeo.dispose();
      ironMat.dispose();
      cordMat.dispose();
      frondMat.dispose();
      trailMat.dispose();
    };
  }, [basketGeo, fernGeo, scrollGeo, ironMat, cordMat, frondMat, trailMat]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (swayRef.current) {
      swayRef.current.rotation.z = Math.sin(t * 0.72) * 0.018;
      swayRef.current.rotation.x = Math.cos(t * 0.56) * 0.014;
    }
  });

  return (
    <group position={[-5.07, 3.05, 1.55]}>
      {/* Forged Wrought-Iron Wall Mounting Plate & Curved Arm Bracket anchored flush to x = -5.07 */}
      <mesh position={[0.008, -0.04, 0]} material={ironMat} castShadow raycast={() => null}>
        <boxGeometry args={[0.016, 0.26, 0.048]} />
      </mesh>
      <mesh position={[0.24, 0.06, 0]} material={ironMat} castShadow raycast={() => null}>
        <boxGeometry args={[0.48, 0.018, 0.018]} />
      </mesh>
      <mesh geometry={scrollGeo} material={ironMat} castShadow raycast={() => null} />
      <mesh position={[0.45, 0.04, 0]} material={brassMat} raycast={() => null}>
        <torusGeometry args={[0.016, 0.004, 8, 16]} />
      </mesh>

      {/* Suspended Woven Fern Basket centered cleanly at world `[-4.62, 2.42..2.60, 1.55]` */}
      <group ref={swayRef} position={[0.45, 0.025, 0]}>
        <mesh position={[0, -0.11, 0]} material={cordMat} raycast={() => null}>
          <cylinderGeometry args={[0.0045, 0.0045, 0.20, 8]} />
        </mesh>
        <mesh position={[0, -0.21, 0]} material={brassMat} raycast={() => null}>
          <torusGeometry args={[0.014, 0.004, 8, 14]} />
        </mesh>
        {[0, 1, 2].map((si) => {
          const a = (si / 3) * Math.PI * 2;
          return (
            <mesh
              key={`fern-sling-${si}`}
              position={[Math.cos(a) * 0.088, -0.37, Math.sin(a) * 0.088]}
              rotation={[-Math.sin(a) * 0.38, 0, Math.cos(a) * 0.38]}
              material={cordMat}
              raycast={() => null}
            >
              <cylinderGeometry args={[0.0032, 0.0032, 0.34, 6]} />
            </mesh>
          );
        })}
        <group position={[0, -0.62, 0]}>
          <mesh geometry={basketGeo} material={wickerMat} castShadow receiveShadow />
          {Array.from({ length: 24 }).map((_, fi) => {
            const a = (fi / 24) * Math.PI * 2;
            const outer = fi % 2 === 0;
            return (
              <mesh
                key={`hfern-${fi}`}
                position={[Math.cos(a) * (outer ? 0.095 : 0.04), outer ? 0.145 : 0.165, Math.sin(a) * (outer ? 0.095 : 0.04)]}
                rotation={[outer ? 1.02 : 0.56, a, 0]}
                geometry={fernGeo}
                material={outer ? trailMat : frondMat}
                scale={outer ? 1.18 : 0.92}
                castShadow
                raycast={() => null}
              />
            );
          })}
        </group>
      </group>
    </group>
  );
};

export const ArtisanAtelierFurnishings: React.FC = () => {
  const textures = useMemo(() => getAtelierTextures(), []);
  const craftAssets = useMemo(() => getCottageCraftAssets(), []);
  const distressedPlankTex = useMemo(() => createDistressedTablePlankTexture(), []);
  const laceTex = useMemo(() => createCrochetLaceClothTexture(), []);
  const floralPlateTex = useMemo(() => createFloralPlateTexture(), []);
  const botanicalIllustTex = useMemo(() => createBotanicalIllustrationTexture(), []);
  const stumpTopTex = useMemo(() => createTreeStumpTopTexture(), []);

  // High-Craft Procedural PBR Texture Sets (ZERO dead GPU allocations!)
  const agedWoodPbr = useMemo(() => createWoodGrainPbr('#945B30', '#5E3618', 311), []);
  const honeyWoodPbr = useMemo(() => createWoodGrainPbr('#B27842', '#7C4D22', 417), []);
  const barkWoodPbr = useMemo(() => createWoodGrainPbr('#5A3F2B', '#322014', 777), []);
  const brassMicroMaps = useMemo(() => createMicroSurfaceMaps(0.30, 0.08, true, 521), []);
  const enamelMicroMaps = useMemo(() => createMicroSurfaceMaps(0.36, 0.07, false, 619), []);
  const pastryCrustPbr = useMemo(() => createBakedCrustPbr('#E6AE54', '#A45A20', false, 733), []);
  const sourdoughCrustPbr = useMemo(() => createBakedCrustPbr('#D89A4C', '#94521E', true, 811), []);

  const materials = useMemo(() => {
    return {
      brassMat: new THREE.MeshPhysicalMaterial({
        color: '#C89C4E',
        bumpMap: brassMicroMaps.bumpMap,
        bumpScale: 0.004,
        roughnessMap: brassMicroMaps.roughnessMap,
        metalness: 0.88,
        roughness: 1.0,
        anisotropy: 0.55,
      }),
      agedWoodMat: new THREE.MeshStandardMaterial({
        map: agedWoodPbr.map,
        bumpMap: agedWoodPbr.bumpMap,
        bumpScale: 0.011,
        roughnessMap: agedWoodPbr.roughnessMap,
        roughness: 1.0,
      }),
      honeyWoodMat: new THREE.MeshPhysicalMaterial({
        map: honeyWoodPbr.map,
        bumpMap: honeyWoodPbr.bumpMap,
        bumpScale: 0.008,
        roughnessMap: honeyWoodPbr.roughnessMap,
        roughness: 1.0,
        clearcoat: 0.05,
        clearcoatRoughness: 0.52,
        envMapIntensity: 0.34,
      }),
      barkWoodMat: new THREE.MeshStandardMaterial({
        map: barkWoodPbr.map,
        bumpMap: barkWoodPbr.bumpMap,
        bumpScale: 0.022,
        roughnessMap: barkWoodPbr.roughnessMap,
        roughness: 1.0,
        envMapIntensity: 0.32,
      }),
      stumpTopMat: new THREE.MeshStandardMaterial({
        map: stumpTopTex,
        bumpMap: honeyWoodPbr.bumpMap,
        bumpScale: 0.008,
        roughness: 0.72,
        envMapIntensity: 0.34,
      }),
      distressedCreamMat: new THREE.MeshStandardMaterial({
        map: distressedPlankTex,
        bumpMap: agedWoodPbr.bumpMap,
        bumpScale: 0.006,
        roughness: 0.74,
        envMapIntensity: 0.34,
      }),
      wickerMat: enhanceWithStylizedFresnelRim(
        new THREE.MeshStandardMaterial({
          map: craftAssets.wovenRattan.map,
          normalMap: craftAssets.wovenRattan.normalMap,
          normalScale: LINEN_SCALE,
          roughness: 0.88,
          envMapIntensity: 0.32,
          side: THREE.DoubleSide,
        }),
        { rimColor: '#FFE4B0', rimStrength: 0.28, rimPower: 2.8, topBias: 0.44, cacheTag: 'furnish-wicker' }
      ),
      glazedPotteryMat: enhanceWithStylizedFresnelRim(
        new THREE.MeshPhysicalMaterial({
          map: craftAssets.glazedPottery.map,
          normalMap: craftAssets.glazedPottery.normalMap,
          normalScale: LINEN_SCALE,
          roughness: 0.48,
          clearcoat: 0.16,
          clearcoatRoughness: 0.34,
          envMapIntensity: 0.36,
        }),
        { rimColor: '#FFE4B0', rimStrength: 0.32, rimPower: 2.6, topBias: 0.44, cacheTag: 'furnish-pottery' }
      ),
      copperMoldMat: enhanceWithStylizedFresnelRim(
        new THREE.MeshPhysicalMaterial({
          color: '#D88258',
          bumpMap: brassMicroMaps.bumpMap,
          bumpScale: 0.004,
          roughnessMap: brassMicroMaps.roughnessMap,
          metalness: 0.80,
          roughness: 1.0,
          clearcoat: 0.14,
          clearcoatRoughness: 0.30,
          anisotropy: 0.35,
          envMapIntensity: 0.50,
        }),
        { rimColor: '#FFD8A2', rimStrength: 0.34, rimPower: 2.5, topBias: 0.45, cacheTag: 'furnish-copper' }
      ),
      sageEnamelMat: enhanceWithStylizedFresnelRim(
        new THREE.MeshPhysicalMaterial({
          color: '#7E9C76',
          bumpMap: enamelMicroMaps.bumpMap,
          bumpScale: 0.004,
          roughnessMap: enamelMicroMaps.roughnessMap,
          roughness: 1.0,
          clearcoat: 0.16,
          clearcoatRoughness: 0.32,
          envMapIntensity: 0.38,
        }),
        { rimColor: '#FFE8BC', rimStrength: 0.30, rimPower: 2.7, topBias: 0.42, cacheTag: 'furnish-sage-enamel' }
      ),
      creamEnamelMat: enhanceWithStylizedFresnelRim(
        new THREE.MeshPhysicalMaterial({
          color: '#F7EFE0',
          bumpMap: enamelMicroMaps.bumpMap,
          bumpScale: 0.003,
          roughnessMap: enamelMicroMaps.roughnessMap,
          roughness: 1.0,
          clearcoat: 0.16,
          clearcoatRoughness: 0.32,
          envMapIntensity: 0.38,
        }),
        { rimColor: '#FFE4B0', rimStrength: 0.28, rimPower: 2.8, topBias: 0.42, cacheTag: 'furnish-cream-enamel' }
      ),
      pastryCrustMat: new THREE.MeshStandardMaterial({
        map: pastryCrustPbr.map,
        bumpMap: pastryCrustPbr.bumpMap,
        bumpScale: 0.012,
        roughnessMap: pastryCrustPbr.roughnessMap,
        roughness: 1.0,
      }),
      sourdoughCrustMat: new THREE.MeshStandardMaterial({
        map: sourdoughCrustPbr.map,
        bumpMap: sourdoughCrustPbr.bumpMap,
        bumpScale: 0.016,
        roughnessMap: sourdoughCrustPbr.roughnessMap,
        roughness: 1.0,
      }),
      laceMat: new THREE.MeshPhysicalMaterial({
        map: laceTex,
        transparent: true,
        alphaTest: 0.08,
        roughness: 0.88,
        sheen: 0.55,
        sheenColor: '#FFF9EC',
        sheenRoughness: 0.72,
        side: THREE.DoubleSide,
      }),
      pegboardMat: new THREE.MeshStandardMaterial({
        map: craftAssets.pegboardTex,
        roughness: 0.72,
      }),
      ginghamMat: new THREE.MeshPhysicalMaterial({
        map: craftAssets.ginghamTex,
        roughness: 0.84,
        sheen: 0.42,
        sheenColor: '#FFEAE6',
        sheenRoughness: 0.75,
        side: THREE.DoubleSide,
      }),
      floralPlateMat: new THREE.MeshPhysicalMaterial({
        map: floralPlateTex,
        roughness: 0.44,
        clearcoat: 0.18,
        clearcoatRoughness: 0.32,
        envMapIntensity: 0.38,
      }),
      botanicalPrintMat: new THREE.MeshStandardMaterial({
        map: botanicalIllustTex,
        roughness: 0.72,
      }),
      floralCushionMat: new THREE.MeshPhysicalMaterial({
        map: craftAssets.wallpaperTex,
        normalMap: textures.linenNormalMap,
        normalScale: LINEN_SCALE,
        roughness: 0.88,
        sheen: 0.65,
        sheenColor: '#FAF4E8',
        sheenRoughness: 0.70,
      }),
      mossVelvetMat: new THREE.MeshPhysicalMaterial({
        map: textures.linenColorMap,
        normalMap: textures.linenNormalMap,
        normalScale: LINEN_SCALE,
        color: '#466844',
        roughness: 0.90,
        sheen: 0.82,
        sheenColor: '#84B07A',
        sheenRoughness: 0.55,
      }),
      terracottaPillowMat: new THREE.MeshPhysicalMaterial({
        map: textures.linenColorMap,
        normalMap: textures.linenNormalMap,
        normalScale: LINEN_SCALE,
        color: '#C46E48',
        roughness: 0.88,
        sheen: 0.75,
        sheenColor: '#F2B290',
        sheenRoughness: 0.60,
      }),
      creamLinenMat: new THREE.MeshPhysicalMaterial({
        map: textures.linenColorMap,
        normalMap: textures.linenNormalMap,
        normalScale: LINEN_SCALE,
        color: '#F7EFE0',
        roughness: 0.88,
        sheen: 0.65,
        sheenColor: '#FFFDF6',
        sheenRoughness: 0.68,
      }),
      porcelainMat: new THREE.MeshPhysicalMaterial({
        color: '#FAF6EE',
        roughness: 0.40,
        clearcoat: 0.18,
        clearcoatRoughness: 0.30,
        envMapIntensity: 0.40,
      }),
      darkIronMat: new THREE.MeshStandardMaterial({
        color: '#423C36',
        metalness: 0.62,
        roughness: 0.48,
        envMapIntensity: 0.40,
      }),
      chromeSlotMat: new THREE.MeshStandardMaterial({
        color: '#DCDFE2',
        metalness: 0.78,
        roughness: 0.32,
        envMapIntensity: 0.48,
      }),
    };
  }, [
    textures,
    craftAssets,
    distressedPlankTex,
    laceTex,
    floralPlateTex,
    botanicalIllustTex,
    stumpTopTex,
    agedWoodPbr,
    honeyWoodPbr,
    barkWoodPbr,
    brassMicroMaps,
    enamelMicroMaps,
    pastryCrustPbr,
    sourdoughCrustPbr,
  ]);

  const geos = useMemo(() => {
    const pitcherHandleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.068, 0.185, 0),
      new THREE.Vector3(0.118, 0.175, 0),
      new THREE.Vector3(0.125, 0.115, 0),
      new THREE.Vector3(0.088, 0.065, 0),
    ]);
    return {
      credenzaLegGeo: createFrenchChairLegGeometry(0.744, 0.024),
      daybedLegGeo: createTurnedBalusterLegGeo(0.32, 0.028),
      credenzaBodyGeo: createBeveledBoxGeometry(1.04, 0.264, 0.33, 0.012, 0.005, 0.005, 2),
      credenzaDrawerGeo: createBeveledBoxGeometry(0.45, 0.145, 0.018, 0.008, 0.004, 0.004, 2),
      credenzaApronGeo: createScallopedCredenzaApronGeometry(1.02, 0.072, 0.020),
      credenzaShelfGeo: createBeveledBoxGeometry(1.02, 0.024, 0.31, 0.008, 0.004, 0.004, 2),
      credenzaTopGeo: createBeveledBoxGeometry(1.14, 0.036, 0.38, 0.014, 0.006, 0.006, 3),
      daybedApronGeo: createScallopedCredenzaApronGeometry(1.88, 0.062, 0.020),
      foyerFrameGeo: createBeveledBoxGeometry(0.22, 0.28, 0.016, 0.008, 0.004, 0.004, 2),
      foyerMatBoardGeo: createBeveledBoxGeometry(0.18, 0.24, 0.004, 0.003, 0.002, 0.002, 1),
      roseBlossomGeo: createSculptedRoseBlossomGeometry(),
      leafClusterGeo: createLayeredLeafClusterGeometry(7),
      scalePlinthGeo: createBeveledBoxGeometry(0.26, 0.036, 0.14, 0.014, 0.006, 0.006, 3),
      scalePanGeo: createHollowVesselLatheGeo(0.040, 0.062, 0.070, 0.022, 0.004, 24),
      cookbookGeo: createBeveledBoxGeometry(0.24, 0.032, 0.19, 0.006, 0.003, 0.003, 2),
      hollowBowlGeo: createHollowVesselLatheGeo(0.082, 0.132, 0.142, 0.120, 0.008, 28),
      hollowPitcherGeo: createHollowVesselLatheGeo(0.082, 0.092, 0.064, 0.220, 0.007, 28),
      pitcherHandleGeo: new THREE.TubeGeometry(pitcherHandleCurve, 18, 0.009, 10, false),
      baguetteBasketGeo: createHollowVesselLatheGeo(0.13, 0.155, 0.17, 0.44, 0.012, 28),
      platformGeo: createBeveledBoxGeometry(2.75, 0.084, 3.15, 0.028, 0.010, 0.010, 3),
      daybedFrameGeo: createBeveledBoxGeometry(1.98, 0.046, 0.82, 0.016, 0.006, 0.006, 2),
      mattressGeo: createBeveledBoxGeometry(1.90, 0.145, 0.76, 0.048, 0.024, 0.024, 4),
      pillowLargeGeo: createBeveledBoxGeometry(0.42, 0.32, 0.14, 0.055, 0.036, 0.036, 4),
      pillowMedGeo: createBeveledBoxGeometry(0.38, 0.34, 0.14, 0.055, 0.036, 0.036, 4),
      benchSlatGeo: createBeveledBoxGeometry(1.46, 0.032, 0.11, 0.008, 0.005, 0.005, 2),
      benchBackPostGeo: createBeveledBoxGeometry(0.044, 0.48, 0.044, 0.006, 0.004, 0.004, 2),
      benchLegGeo: createTurnedBalusterLegGeo(0.42, 0.030),
    };
  }, []);

  useEffect(() => {
    return () => {
      distressedPlankTex.dispose();
      laceTex.dispose();
      floralPlateTex.dispose();
      botanicalIllustTex.dispose();
      stumpTopTex.dispose();
      agedWoodPbr.map.dispose();
      agedWoodPbr.bumpMap.dispose();
      agedWoodPbr.roughnessMap.dispose();
      honeyWoodPbr.map.dispose();
      honeyWoodPbr.bumpMap.dispose();
      honeyWoodPbr.roughnessMap.dispose();
      barkWoodPbr.map.dispose();
      barkWoodPbr.bumpMap.dispose();
      barkWoodPbr.roughnessMap.dispose();
      brassMicroMaps.bumpMap.dispose();
      brassMicroMaps.roughnessMap.dispose();
      enamelMicroMaps.bumpMap.dispose();
      enamelMicroMaps.roughnessMap.dispose();
      pastryCrustPbr.map.dispose();
      pastryCrustPbr.bumpMap.dispose();
      pastryCrustPbr.roughnessMap.dispose();
      sourdoughCrustPbr.map.dispose();
      sourdoughCrustPbr.bumpMap.dispose();
      sourdoughCrustPbr.roughnessMap.dispose();
      Object.values(materials).forEach((m) => m.dispose());
      Object.values(geos).forEach((g) => g.dispose());
    };
  }, [
    distressedPlankTex,
    laceTex,
    floralPlateTex,
    botanicalIllustTex,
    stumpTopTex,
    agedWoodPbr,
    honeyWoodPbr,
    barkWoodPbr,
    brassMicroMaps,
    enamelMicroMaps,
    pastryCrustPbr,
    sourdoughCrustPbr,
    materials,
    geos,
  ]);

  return (
    <group>
      {/* 1. HERO VERANDA HARVEST & ENAMEL WASH TABLE (`f95ce79d` angled gracefully toward room & veranda!) */}
      <SunlitVerandaHarvestWashTable
        position={[3.45, 0, 3.55]}
        rotation={[0, -0.58, 0]}
        agedWoodMat={materials.agedWoodMat}
        distressedCreamMat={materials.distressedCreamMat}
        wickerMat={materials.wickerMat}
        laceMat={materials.laceMat}
        brassMat={materials.brassMat}
        porcelainMat={materials.porcelainMat}
        floralPlateMat={materials.floralPlateMat}
        sageEnamelMat={materials.sageEnamelMat}
      />

      {/* 1B. CARVED FRENCH PROVINCIAL RIGHT WINDOW CREDENZA (`[3.35, 0, -3.38]`, `1.14×0.38×0.78m < 1.18m` NE sill) */}
      <group position={[3.35, 0, -3.38]}>
        {[-0.51, 0.51].map((lx, xi) =>
          [-0.15, 0.15].map((lz, zi) => (
            <mesh key={`cred-leg-${xi}-${zi}`} position={[lx, 0, lz]} geometry={geos.credenzaLegGeo} material={materials.agedWoodMat} castShadow receiveShadow />
          ))
        )}
        {/* Lower Slatted Honey-Oak Open Shelf (top y = 0.214m) */}
        <mesh position={[0, 0.202, 0]} geometry={geos.credenzaShelfGeo} material={materials.honeyWoodMat} castShadow receiveShadow />
        {/* Upper Distressed Sage-Cream Drawer Carcass (y = 0.480..0.744) + Carved Scalloped Front Apron */}
        <mesh position={[0, 0.612, 0]} geometry={geos.credenzaBodyGeo} material={materials.creamEnamelMat} castShadow receiveShadow />
        <mesh position={[0, 0.482, 0.165]} geometry={geos.credenzaApronGeo} material={materials.sageEnamelMat} castShadow />
        {[-0.25, 0.25].map((dx, di) => (
          <group key={`cred-drw-${di}`} position={[dx, 0.618, 0.168]}>
            <mesh geometry={geos.credenzaDrawerGeo} material={materials.sageEnamelMat} castShadow />
            {[-0.10, 0.10].map((px, pi) => (
              <group key={`pull-${pi}`} position={[px, 0, 0.014]}>
                <mesh material={materials.brassMat}>
                  <sphereGeometry args={[0.008, 10, 8]} />
                </mesh>
                <mesh position={[0, -0.011, 0.004]} material={materials.brassMat}>
                  <torusGeometry args={[0.011, 0.0028, 8, 16]} />
                </mesh>
              </group>
            ))}
          </group>
        ))}

        {/* Overhanging Beveled Honey-Oak Tabletop (top strictly y = 0.780m) + Crochet Lace Runner */}
        <mesh position={[0, 0.762, 0]} geometry={geos.credenzaTopGeo} material={materials.honeyWoodMat} castShadow receiveShadow />
        <mesh position={[0, 0.781, 0.01]} rotation={[-Math.PI / 2, 0, 0]} material={materials.laceMat}>
          <planeGeometry args={[0.98, 0.31]} />
        </mesh>

        {/* Top Vignette (strictly below 1.18m NE Window sill): Floral Stoneware Pitcher + Botanical Frame + Twin Brass Candlesticks */}
        <group position={[-0.26, 0.781, 0.01]} rotation={[0, 0.35, 0]}>
          <mesh geometry={geos.hollowPitcherGeo} material={materials.glazedPotteryMat} castShadow receiveShadow />
          <mesh geometry={geos.pitcherHandleGeo} material={materials.glazedPotteryMat} castShadow />
          <mesh position={[-0.062, 0.212, 0]} rotation={[0, 0, 0.55]} material={materials.glazedPotteryMat}>
            <coneGeometry args={[0.016, 0.034, 12]} />
          </mesh>
          {[
            [0.0, 0.26, 0.02, 0.2, 0.1],
            [-0.045, 0.24, -0.02, -0.3, -0.4],
            [0.045, 0.25, -0.015, 0.1, 0.4],
          ].map(([fx, fy, fz, rx, rz], fi) => (
            <group key={`hm-fl-${fi}`} position={[fx, fy, fz]} rotation={[rx, fi * 1.1, rz]}>
              <mesh position={[0, -0.04, 0]} rotation={[0.4, fi, 0]} geometry={geos.leafClusterGeo} scale={0.75}>
                <meshStandardMaterial color="#4B7E3E" roughness={0.58} side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[0, 0.012, 0]} geometry={geos.roseBlossomGeo} scale={1.15} castShadow>
                <meshPhysicalMaterial color={fi === 1 ? '#F6E8D8' : '#F29FA8'} roughness={0.48} sheen={0.5} />
              </mesh>
            </group>
          ))}
        </group>

        {/* Vivid Archival Botanical Watercolor Frame (`top y = 1.06m < 1.18m sill`) */}
        <group position={[0.25, 0.781, -0.06]} rotation={[0, -0.18, 0]}>
          <group position={[0, 0.138, 0]} rotation={[-0.14, 0, 0]}>
            <mesh geometry={geos.foyerFrameGeo} material={materials.brassMat} castShadow />
            <mesh position={[0, 0, 0.008]} geometry={geos.foyerMatBoardGeo} material={materials.porcelainMat} />
            <mesh position={[0, 0, 0.0155]} material={materials.botanicalPrintMat}>
              <planeGeometry args={[0.145, 0.195]} />
            </mesh>
          </group>
        </group>

        {/* Twin Turned Brass Beeswax Candlesticks */}
        {[
          { x: -0.46, z: -0.05, h: 0.14 },
          { x: 0.02, z: -0.08, h: 0.11 },
        ].map((cnd, ci) => (
          <group key={`cred-cnd-${ci}`} position={[cnd.x, 0.781, cnd.z]}>
            <mesh position={[0, 0.010, 0]} material={materials.brassMat} castShadow>
              <cylinderGeometry args={[0.028, 0.036, 0.020, 18]} />
            </mesh>
            <mesh position={[0, 0.055, 0]} material={materials.brassMat}>
              <cylinderGeometry args={[0.009, 0.014, 0.08, 14]} />
            </mesh>
            <mesh position={[0, 0.095 + cnd.h * 0.5, 0]} castShadow>
              <cylinderGeometry args={[0.012, 0.013, cnd.h, 14]} />
              <meshStandardMaterial color="#F8EED2" roughness={0.68} />
            </mesh>
            <mesh position={[0, 0.104 + cnd.h, 0]}>
              <sphereGeometry args={[0.008, 10, 8]} />
              <meshStandardMaterial color="#FFF4C4" emissive="#FFA828" emissiveIntensity={0.86} />
            </mesh>
          </group>
        ))}

        {/* Lower Open Shelf (y = 0.214m): Stacked Vintage Cookbooks + Antique Brass Scale + Woven Hamper */}
        <group position={[-0.36, 0.214, 0.0]} rotation={[0, 0.10, 0]} scale={0.88}>
          {['#7A926B', '#C47B68', '#E2BA72'].map((bcol, bi) => (
            <mesh key={`hm-bk-${bi}`} position={[0, 0.016 + bi * 0.032, 0]} rotation={[0, (bi - 1) * 0.08, 0]} geometry={geos.cookbookGeo} castShadow>
              <meshPhysicalMaterial color={bcol} roughness={0.78} sheen={0.35} />
            </mesh>
          ))}
        </group>
        <group position={[0.00, 0.214, 0.01]} rotation={[0, 0.08, 0]} scale={0.78}>
          <mesh position={[0, 0.018, 0]} geometry={geos.scalePlinthGeo} material={materials.agedWoodMat} castShadow />
          <mesh position={[0, 0.14, 0]} material={materials.brassMat} castShadow>
            <cylinderGeometry args={[0.011, 0.018, 0.24, 20]} />
          </mesh>
          <mesh position={[0, 0.24, 0]} rotation={[0, 0, Math.PI / 2 + 0.04]} material={materials.brassMat}>
            <cylinderGeometry args={[0.007, 0.007, 0.30, 14]} />
          </mesh>
          {[-0.135, 0.135].map((px, pi) => {
            const beamY = 0.24 + px * Math.sin(0.04);
            const panBaseY = beamY - 0.088;
            return (
              <group key={`hm-sc-${pi}`} position={[px, panBaseY, 0]}>
                <mesh position={[0, 0.088, 0]} material={materials.brassMat}>
                  <torusGeometry args={[0.009, 0.0022, 8, 16]} />
                </mesh>
                {[0, 1, 2].map((ci) => {
                  const ca = (ci / 3) * Math.PI * 2;
                  const rMid = 0.031;
                  const tilt = Math.atan2(0.062, 0.068);
                  return (
                    <mesh
                      key={ci}
                      position={[Math.cos(ca) * rMid, 0.054, Math.sin(ca) * rMid]}
                      rotation={[-Math.sin(ca) * tilt, 0, Math.cos(ca) * tilt]}
                      material={materials.brassMat}
                    >
                      <cylinderGeometry args={[0.0018, 0.0018, 0.092, 6]} />
                    </mesh>
                  );
                })}
                <mesh geometry={geos.scalePanGeo} material={materials.brassMat} castShadow />
              </group>
            );
          })}
        </group>
        <mesh position={[0.35, 0.214, 0.0]} scale={[1.15, 0.95, 0.92]} geometry={geos.hollowBowlGeo} material={materials.wickerMat} castShadow />
      </group>

      {/* Hollow Thick-Walled Floor Baguette Basket with Grounded Crusty French Baguettes (ZERO floating loaves!) */}
      <group position={[-4.52, 0, -2.42]}>
        <mesh geometry={geos.baguetteBasketGeo} material={materials.wickerMat} castShadow receiveShadow />
        {[
          [-0.045, 0.26, -0.025, 0.14, 0.10],
          [0.050, 0.28, 0.030, -0.15, -0.11],
          [0.004, 0.29, -0.042, 0.10, -0.08],
          [-0.048, 0.25, 0.048, -0.11, 0.14],
        ].map(([bx, by, bz, rx, rz], bi) => (
          <mesh key={bi} position={[bx, by, bz]} rotation={[rx, bi * 0.8, rz]} material={materials.sourdoughCrustMat} castShadow>
            <capsuleGeometry args={[0.034, 0.44, 10, 16]} />
          </mesh>
        ))}
      </group>

      {/* 2. WEST WALL: 4-LAYER LIVING PLANT WALL + WOODEN PEGBOARD + BEVELED STEPPED TIMBER PLATFORM */}
      <MultiSpeciesLivingPlantWall
        timberMat={materials.agedWoodMat}
        brassMat={materials.brassMat}
        wickerMat={materials.wickerMat}
      />
      <WoodenPegboardArtisanWall
        pegboardMat={materials.pegboardMat}
        ginghamMat={materials.ginghamMat}
        wickerMat={materials.wickerMat}
        honeyWoodMat={materials.honeyWoodMat}
        agedWoodMat={materials.agedWoodMat}
        floralPlateMat={materials.floralPlateMat}
        botanicalPrintMat={materials.botanicalPrintMat}
      />
      <OverheadPicnicBasketShelf
        agedWoodMat={materials.agedWoodMat}
        wickerMat={materials.wickerMat}
        ginghamMat={materials.ginghamMat}
      />

      {/* Beveled Stepped Honey-Timber Cozy Nook Platform (`f4a71928`, h = 0.084m) */}
      <mesh position={[-3.68, 0.042, 2.95]} geometry={geos.platformGeo} material={materials.honeyWoodMat} castShadow receiveShadow />

      {/* Open-Legged Cottage Daybed with Arched Carved French Spindle Gallery Headboard & Layered Pillows */}
      <group position={[-4.12, 0.084, 3.05]} rotation={[0, Math.PI / 2, 0]}>
        {[-0.92, 0.92].map((dx, xi) =>
          [-0.36, 0.36].map((dz, zi) => (
            <mesh key={`${xi}-${zi}`} position={[dx, 0, dz]} geometry={geos.daybedLegGeo} material={materials.agedWoodMat} castShadow />
          ))
        )}
        <mesh position={[0, 0.31, 0]} geometry={geos.daybedFrameGeo} material={materials.distressedCreamMat} castShadow receiveShadow />
        <mesh position={[0, 0.295, 0.39]} geometry={geos.daybedApronGeo} material={materials.distressedCreamMat} castShadow />

        {/* Turned Corner Headboard Posts & Carved Acorn Finials */}
        {[-0.96, 0.96].map((px, pi) => (
          <group key={`db-post-${pi}`} position={[px, 0.31, -0.38]}>
            <mesh position={[0, 0.24, 0]} material={materials.agedWoodMat} castShadow>
              <cylinderGeometry args={[0.022, 0.025, 0.48, 16]} />
            </mesh>
            <mesh position={[0, 0.495, 0]} scale={[0.92, 1.32, 0.92]} material={materials.agedWoodMat} castShadow>
              <sphereGeometry args={[0.024, 14, 12]} />
            </mesh>
          </group>
        ))}

        {/* Arched French Crest Gallery Rail + Center Scalloped Medallion + 15 Exact-Height Turned Spindles */}
        {Array.from({ length: 15 }).map((_, si) => {
          const sx = -0.84 + si * 0.12;
          const topY = 0.72 + 0.13 * Math.cos((sx / 0.96) * Math.PI * 0.5);
          const spanH = topY - 0.32;
          return (
            <mesh key={`db-sp-${si}`} position={[sx, 0.32 + spanH * 0.5, -0.38]} material={materials.honeyWoodMat} castShadow>
              <cylinderGeometry args={[0.010, 0.011, spanH, 14]} />
            </mesh>
          );
        })}
        {Array.from({ length: 16 }).map((_, ri) => {
          const x0 = -0.96 + ri * 0.12;
          const x1 = x0 + 0.12;
          const y0 = 0.72 + 0.13 * Math.cos((x0 / 0.96) * Math.PI * 0.5);
          const y1 = 0.72 + 0.13 * Math.cos((x1 / 0.96) * Math.PI * 0.5);
          const mx = (x0 + x1) * 0.5;
          const my = (y0 + y1) * 0.5;
          const len = Math.hypot(x1 - x0, y1 - y0) + 0.008;
          const ang = Math.atan2(y1 - y0, x1 - x0);
          return (
            <mesh key={`db-arch-${ri}`} position={[mx, my, -0.38]} rotation={[0, 0, Math.PI * 0.5 - ang]} material={materials.agedWoodMat} castShadow>
              <cylinderGeometry args={[0.020, 0.020, len, 14]} />
            </mesh>
          );
        })}
        <mesh position={[0, 0.87, -0.38]} scale={[1.6, 0.8, 0.5]} material={materials.agedWoodMat} castShadow>
          <sphereGeometry args={[0.032, 16, 12]} />
        </mesh>

        {/* Plump Beveled Cream Linen Mattress, Lace Throw, Horizontal Linen Bolster & Velvet Pillows */}
        <mesh position={[0, 0.40, 0.02]} geometry={geos.mattressGeo} material={materials.creamLinenMat} castShadow receiveShadow />
        <mesh position={[0.58, 0.476, 0.02]} rotation={[-Math.PI / 2, 0, 0]} material={materials.laceMat}>
          <planeGeometry args={[0.56, 0.78]} />
        </mesh>
        <mesh position={[-0.68, 0.55, -0.27]} rotation={[0.20, 0.28, -0.16]} geometry={geos.pillowMedGeo} material={materials.mossVelvetMat} castShadow />
        <mesh position={[0.0, 0.54, -0.29]} rotation={[0.16, 0, 0]} geometry={geos.pillowLargeGeo} material={materials.terracottaPillowMat} castShadow />
        <mesh position={[0.42, 0.54, -0.26]} rotation={[0.18, -0.24, 0.14]} scale={[0.90, 0.88, 0.92]} geometry={geos.pillowMedGeo} material={materials.floralCushionMat} castShadow />
        <mesh position={[-0.56, 0.525, -0.06]} rotation={[Math.PI / 2, 0, 0.12]} material={materials.creamLinenMat} castShadow>
          <cylinderGeometry args={[0.068, 0.068, 0.44, 18]} />
        </mesh>
      </group>

      {/* Organic Bark Tree-Stump Chamomile Tea Table with Concentric Growth Rings & Grounded Ceramic Lamp! */}
      <group position={[-2.98, 0.084, 3.15]}>
        <mesh position={[0, 0.23, 0]} material={materials.barkWoodMat} castShadow receiveShadow>
          <cylinderGeometry args={[0.31, 0.35, 0.46, 32]} />
        </mesh>
        <mesh position={[0, 0.461, 0]} rotation={[-Math.PI / 2, 0, 0]} material={materials.stumpTopMat} receiveShadow>
          <circleGeometry args={[0.308, 32]} />
        </mesh>
        <mesh position={[0, 0.463, 0]} rotation={[-Math.PI / 2, 0, 0.2]} material={materials.laceMat}>
          <planeGeometry args={[0.46, 0.46]} />
        </mesh>
        <group position={[0.02, 0.464, -0.02]}>
          <mesh position={[0, 0.082, 0]} material={materials.glazedPotteryMat} castShadow>
            <sphereGeometry args={[0.085, 24, 18]} />
          </mesh>
          <mesh position={[0, 0.19, 0]} material={materials.brassMat}>
            <cylinderGeometry args={[0.012, 0.016, 0.06, 16]} />
          </mesh>
          <mesh position={[0, 0.27, 0]} castShadow>
            <cylinderGeometry args={[0.075, 0.155, 0.16, 28, 1, true]} />
            <meshPhysicalMaterial
              color="#FFF6E2"
              emissive="#FFB64E"
              emissiveIntensity={0.48}
              roughness={0.76}
              sheen={0.55}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      </group>

      {/* 3. TWO ADORABLE ANIMATED COTTAGE CATS + SWING CHAIR, GRAND CAT CONDO & INDOOR FLORA */}
      <CozyCottageCats />
      <SuspendedRattanEggSwingChair
        wickerMat={materials.wickerMat}
        floralCushionMat={materials.floralCushionMat}
        agedWoodMat={materials.agedWoodMat}
        brassMat={materials.brassMat}
      />
      <ArtisanOakCatClimbingTree
        honeyWoodMat={materials.honeyWoodMat}
        agedWoodMat={materials.agedWoodMat}
        wickerMat={materials.wickerMat}
      />
      <CatCornerConnectivityPack
        honeyWoodMat={materials.honeyWoodMat}
        agedWoodMat={materials.agedWoodMat}
        brassMat={materials.brassMat}
        creamLinenMat={materials.creamLinenMat}
        porcelainMat={materials.porcelainMat}
      />
      <DwarfCalamondinOrangeTree />
      <HangingBraidedFernBasket
        wickerMat={materials.wickerMat}
        brassMat={materials.brassMat}
      />

      {/* 4. STEP 7 TEA & TASTING CARVED FRENCH SALON CHAIRS & GROUNDED COURTYARD BENCH */}
      <FrenchViolinSplatSalonChair
        position={[4.32, 0, 1.35]}
        rotation={[0, -2.30, 0]}
        scale={1.18}
        woodMat={materials.honeyWoodMat}
        cushionMat={materials.floralCushionMat}
        laceMat={materials.laceMat}
      />
      <FrenchViolinSplatSalonChair
        position={[4.34, 0, -0.10]}
        rotation={[0, -0.84, 0]}
        scale={1.18}
        woodMat={materials.honeyWoodMat}
        cushionMat={materials.floralCushionMat}
        laceMat={materials.laceMat}
      />

      {/* Sunny Lawn Courtyard Slatted Bench grounded cleanly on terrain height & clear of stone wall and herb bed */}
      <group position={[2.85, -0.35, 7.55]} rotation={[0, Math.PI - 0.36, 0]}>
        {[-0.62, 0.62].map((bx, xi) =>
          [-0.17, 0.17].map((bz, zi) => (
            <mesh key={`${xi}-${zi}`} position={[bx, -0.06, bz]} scale={[1, 1.32, 1]} geometry={geos.benchLegGeo} material={materials.agedWoodMat} castShadow />
          ))
        )}
        {[-0.14, 0.0, 0.14].map((sz, si) => (
          <mesh key={`seat-${si}`} position={[0, 0.425, sz]} geometry={geos.benchSlatGeo} material={materials.agedWoodMat} castShadow receiveShadow />
        ))}
        {[-0.62, 0.62].map((bx, bi) => (
          <mesh key={`bp-${bi}`} position={[bx, 0.64, -0.21]} rotation={[-0.14, 0, 0]} geometry={geos.benchBackPostGeo} material={materials.agedWoodMat} castShadow />
        ))}
        {[0.64, 0.80].map((by, bi) => (
          <mesh key={`bs-${bi}`} position={[0, by, -0.21 - (by - 0.64) * 0.14]} rotation={[Math.PI * 0.5 - 0.14, 0, 0]} geometry={geos.benchSlatGeo} material={materials.agedWoodMat} castShadow />
        ))}
        {/* 草编篮前移至坐板正上方安全区，彻底脱离靠背穿模 */}
        <mesh position={[0.34, 0.448, 0.065]} geometry={geos.hollowBowlGeo} material={materials.wickerMat} castShadow />
      </group>
    </group>
  );
};

export default ArtisanAtelierFurnishings;
