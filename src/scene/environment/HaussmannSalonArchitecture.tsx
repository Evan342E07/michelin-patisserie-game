import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getAtelierTextures } from '../../textures/atelierTextures';
import { createBeveledBoxGeometry, createCitrusLeafGeometry } from '../../geometry/patisserieGeometry';
import {
  createButterflyWingGeometry,
  createOrganicTreeLimbGeometry,
  createSculptedRoseBlossomGeometry,
  createSwordFernFrondGeometry,
  createVolumetricCanopyPuffGeometry,
  getCottageCraftAssets,
} from './cottageTexturesAndFlora';
import {
  createMicroSurfaceMaps,
  createWoodGrainPbr,
} from '../props/cottageHighCraftPbr';
import {
  enhanceWithStylizedFoliageToon,
  sampleGhibliTerrainHeight,
} from '../../shaders/ghibliStylizedPipeline';

const LINEN_RUG_NORMAL_SCALE = new THREE.Vector2(0.50, 0.50);

/**
 * Woven Bamboo / Rattan Curved Slatted Cage Pendant Lamp (`f95ce79d` Top-Right!)
 */
const RattanSlattedCagePendant: React.FC<{
  position: [number, number, number];
  cordLength?: number;
  bambooMat: THREE.Material;
  castWarmPool?: boolean;
}> = ({ position, cordLength = 1.15, bambooMat, castWarmPool = false }) => {
  const { ribGeos, topRingGeo, bottomRingGeo } = useMemo(() => {
    const ribs: THREE.BufferGeometry[] = [];
    const numRibs = 20;
    for (let i = 0; i < numRibs; i++) {
      const a = (i / numRibs) * Math.PI * 2;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(cos * 0.08, 0.24, sin * 0.08),
        new THREE.Vector3(cos * 0.23, 0.16, sin * 0.23),
        new THREE.Vector3(cos * 0.30, 0.0, sin * 0.30),
        new THREE.Vector3(cos * 0.26, -0.15, sin * 0.26),
      ]);
      ribs.push(new THREE.TubeGeometry(curve, 14, 0.0055, 6, false));
    }
    return {
      ribGeos: ribs,
      topRingGeo: new THREE.TorusGeometry(0.082, 0.008, 8, 28),
      bottomRingGeo: new THREE.TorusGeometry(0.26, 0.009, 8, 36),
    };
  }, []);

  useEffect(() => {
    return () => {
      ribGeos.forEach((g) => g.dispose());
      topRingGeo.dispose();
      bottomRingGeo.dispose();
    };
  }, [ribGeos, topRingGeo, bottomRingGeo]);

  return (
    <group position={position}>
      <mesh position={[0, 0.24 + cordLength * 0.5, 0]}>
        <cylinderGeometry args={[0.0045, 0.0045, cordLength, 8]} />
        <meshStandardMaterial color="#8E6840" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.24 + cordLength - 0.012, 0]} castShadow>
        <cylinderGeometry args={[0.052, 0.036, 0.028, 16]} />
        <meshStandardMaterial color="#6D5030" metalness={0.55} roughness={0.40} />
      </mesh>

      <mesh position={[0, 0.24, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={topRingGeo} material={bambooMat} />
      <mesh position={[0, -0.15, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={bottomRingGeo} material={bambooMat} />
      {ribGeos.map((g, idx) => (
        <mesh key={idx} geometry={g} material={bambooMat} castShadow />
      ))}

      <mesh position={[0, 0.06, 0]}>
        <sphereGeometry args={[0.045, 14, 14]} />
        <meshStandardMaterial color="#FFF6DC" emissive="#FFB84D" emissiveIntensity={1.65} roughness={0.2} />
      </mesh>
    </group>
  );
};

/**
 * Tiffany Floral Stained-Glass Cottage Dome Lamp (`2fb763f6` Top Center!)
 */
const TiffanyFloralDomeLamp: React.FC<{
  position: [number, number, number];
  stemLength?: number;
  tiffanyTex: THREE.Texture;
}> = ({ position, stemLength = 1.56, tiffanyTex }) => {
  return (
    <group position={position}>
      <mesh position={[0, 0.14 + stemLength * 0.5, 0]}>
        <cylinderGeometry args={[0.006, 0.006, stemLength, 10]} />
        <meshStandardMaterial color="#5A422C" metalness={0.65} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.14 + stemLength - 0.015, 0]}>
        <cylinderGeometry args={[0.058, 0.038, 0.032, 16]} />
        <meshStandardMaterial color="#5A422C" metalness={0.65} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0]} castShadow>
        <sphereGeometry args={[0.25, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshPhysicalMaterial
          map={tiffanyTex}
          emissiveMap={tiffanyTex}
          emissive="#FFD698"
          emissiveIntensity={0.85}
          roughness={0.32}
          clearcoat={0.28}
          envMapIntensity={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.246, 0.008, 8, 32]} />
        <meshStandardMaterial color="#4A3522" metalness={0.58} roughness={0.44} />
      </mesh>
    </group>
  );
};

/**
 * Overhead Blooming Rose, Hydrangea & Cascading Sword-Fern Arch + Staghorn Fern Kokedama (`230f538a` — ZERO ball blobs!)
 */
const BotanicalFloralFernArch: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  span?: number;
  fernGeo: THREE.BufferGeometry;
  leafGeo: THREE.BufferGeometry;
  roseGeo: THREE.BufferGeometry;
  windUniform: { value: number };
}> = ({ position, rotation = [0, 0, 0], span = 1.75, fernGeo, leafGeo, roseGeo, windUniform }) => {
  const leafInstRef = useRef<THREE.InstancedMesh>(null);
  const blossomColors = useMemo(() => ['#F6B8C6', '#FFF5DC', '#F0AA90', '#C4ACE8', '#F2D272'], []);

  const { archLeafMat, archFernMat, kokedamaFernMat, archRoseMats } = useMemo(() => {
    const lMat = createWindSwayLeafMaterial(windUniform, 0.56, 0.014, 'arch-leaf', undefined, 'radial');
    const fMat = createWindSwayLeafMaterial(windUniform, 0.62, 0.022, 'arch-fern', { color: '#548A3C' }, 'radial');
    const kMat = createWindSwayLeafMaterial(windUniform, 0.65, 0.018, 'arch-kokedama-fern', { color: '#6DA054' }, 'radial');
    const rMats = blossomColors.map((col, bi) =>
      createWindSwayLeafMaterial(windUniform, 0.76, 0.011, `arch-rose-${bi}`, { color: col, vertexColors: true }, 'radial')
    );
    return { archLeafMat: lMat, archFernMat: fMat, kokedamaFernMat: kMat, archRoseMats: rMats };
  }, [windUniform, blossomColors]);

  useEffect(() => {
    return () => {
      archLeafMat.dispose();
      archFernMat.dispose();
      kokedamaFernMat.dispose();
      archRoseMats.forEach((m) => m.dispose());
    };
  }, [archLeafMat, archFernMat, kokedamaFernMat, archRoseMats]);

  useLayoutEffect(() => {
    const inst = leafInstRef.current;
    if (!inst) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const greens = [0x38662a, 0x4b7e38, 0x5c9244, 0x2f5a24];
    let rng = 1919;
    const rand = () => {
      rng = (rng * 1664525 + 1013904223) >>> 0;
      return rng / 4294967296;
    };
    for (let i = 0; i < 120; i++) {
      const t = i / 119 - 0.5;
      const x = t * span;
      const archLift = Math.cos(t * Math.PI) * 0.14;
      dummy.position.set(x + (rand() - 0.5) * 0.16, archLift + (rand() - 0.5) * 0.14, 0.04 + (rand() - 0.5) * 0.18);
      dummy.rotation.set(rand() * 2.0, rand() * 3.14, rand() * 2.0);
      dummy.scale.setScalar(1.3 + rand() * 1.1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      color.setHex(greens[i % greens.length]);
      inst.setColorAt(i, color);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, [span]);

  return (
    <group position={position} rotation={rotation}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.026, 0.032, span + 0.35, 10]} />
        <meshStandardMaterial color="#6D4628" roughness={0.84} />
      </mesh>

      {/* 120 Organic Layered Leaves replacing smooth green balls (GPU breeze sway)! */}
      <instancedMesh ref={leafInstRef} args={[leafGeo, archLeafMat, 120]} castShadow />

      {/* Cascading Sword-Fern Fronds & Multi-Petal Garden Roses (GPU breeze sway)! */}
      {Array.from({ length: 11 }).map((_, i) => {
        const t = i / 10 - 0.5;
        const x = t * span;
        const archLift = Math.cos(t * Math.PI) * 0.14;
        const rMat = archRoseMats[i % archRoseMats.length];
        return (
          <group key={i} position={[x, archLift, 0.06]}>
            <mesh position={[0, -0.02, 0.03]} rotation={[Math.PI * 0.90, (i - 5) * 0.18, 0]} geometry={fernGeo} material={archFernMat} />
            {/* Multi-Petal Sculpted Cottage Blossom */}
            <mesh
              position={[0.02, 0.03, 0.085]}
              rotation={[0.92, (i - 5) * 0.25, 0]}
              scale={0.86}
              geometry={roseGeo}
              material={rMat}
            />
          </group>
        );
      })}

      {/* Hanging Mossy Staghorn Fern Kokedama Ball on Right End (`230f538a`) */}
      <group position={[span * 0.52, -0.24, 0.14]}>
        <mesh position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.0025, 0.0025, 0.28, 6]} />
          <meshStandardMaterial color="#9E7E56" roughness={0.9} />
        </mesh>
        <mesh castShadow>
          <sphereGeometry args={[0.088, 14, 12]} />
          <meshStandardMaterial color="#4B7434" roughness={0.96} />
        </mesh>
        {[-0.8, -0.2, 0.4, 1.0, 1.6].map((ang, ai) => (
          <mesh key={ai} position={[0, -0.02, 0]} rotation={[0.92, ang, 0.25]} geometry={fernGeo} material={kokedamaFernMat} scale={0.78} />
        ))}
      </group>
    </group>
  );
};

/**
 * Gently Swaying Natural Seashell & Driftwood Veranda Windchime (`282f8d29`!)
 */
const SwayingSeashellWindchime: React.FC<{
  position: [number, number, number];
}> = ({ position }) => {
  const chimeRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (chimeRef.current) {
      const t = clock.getElapsedTime();
      chimeRef.current.rotation.z = Math.sin(t * 1.35) * 0.065;
      chimeRef.current.rotation.x = Math.cos(t * 0.95) * 0.045;
    }
  });

  return (
    <group position={position} ref={chimeRef}>
      <mesh position={[0, -0.01, 0]}>
        <torusGeometry args={[0.014, 0.003, 6, 16]} />
        <meshStandardMaterial color="#8A6338" metalness={0.72} roughness={0.34} />
      </mesh>
      <mesh position={[0, -0.14, 0]}>
        <cylinderGeometry args={[0.002, 0.002, 0.28, 6]} />
        <meshStandardMaterial color="#C8B496" roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.075, 0.008, 8, 20]} />
        <meshStandardMaterial color="#9E6E42" roughness={0.75} />
      </mesh>
      {[0, 1, 2, 3, 4].map((si) => {
        const a = (si / 5) * Math.PI * 2;
        const rx = Math.cos(a) * 0.068;
        const rz = Math.sin(a) * 0.068;
        return (
          <group key={si} position={[rx, -0.28, rz]}>
            {[0.10, 0.22, 0.34].map((dy, di) => (
              <mesh key={di} position={[0, -dy, 0]} rotation={[0.2 * di, a + di, 0]} scale={[1.0, 1.15, 0.28]}>
                <sphereGeometry args={[0.018, 10, 8]} />
                <meshPhysicalMaterial
                  color={di % 2 === 0 ? '#FFF9EE' : '#F4D4C4'}
                  roughness={0.42}
                  clearcoat={0.22}
                  envMapIntensity={0.32}
                />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
};

/**
 * Real Catenary Wired Festoon String Lights (`106d34c4` — Black Draped Cable + Sockets + Warm Bulbs!)
 */
const WiredCatenaryFestoonStrand: React.FC<{
  start: [number, number, number];
  end: [number, number, number];
  sag?: number;
  bulbCount?: number;
  emissiveIntensity?: number;
}> = ({ start, end, sag = 0.52, bulbCount = 8, emissiveIntensity = 1.85 }) => {
  const { cableGeo, bulbPoints } = useMemo(() => {
    const vStart = new THREE.Vector3(...start);
    const vEnd = new THREE.Vector3(...end);
    const ctrlPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const p = new THREE.Vector3().lerpVectors(vStart, vEnd, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      ctrlPts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(ctrlPts);
    const pts: THREE.Vector3[] = [];
    for (let b = 1; b <= bulbCount; b++) {
      const bt = b / (bulbCount + 1);
      pts.push(curve.getPointAt(bt));
    }
    return {
      cableGeo: new THREE.TubeGeometry(curve, 28, 0.006, 6, false),
      bulbPoints: pts,
    };
  }, [start, end, sag, bulbCount]);

  useEffect(() => {
    return () => {
      cableGeo.dispose();
    };
  }, [cableGeo]);

  return (
    <group>
      <mesh geometry={cableGeo} castShadow>
        <meshStandardMaterial color="#2A2622" roughness={0.78} />
      </mesh>
      {bulbPoints.map((bp, bi) => (
        <group key={bi} position={[bp.x, bp.y, bp.z]}>
          <mesh position={[0, -0.018, 0]}>
            <cylinderGeometry args={[0.010, 0.012, 0.028, 8]} />
            <meshStandardMaterial color="#2A2622" roughness={0.65} />
          </mesh>
          <mesh position={[0, -0.052, 0]}>
            <sphereGeometry args={[0.032, 10, 10]} />
            <meshStandardMaterial color="#FFF6DC" emissive="#FFB648" emissiveIntensity={emissiveIntensity} roughness={0.15} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/**
 * 6 Animated Fluttering Courtyard & Streamside Butterflies (`7.1`)
 */
const CourtyardButterflies: React.FC = () => {
  const wingGeo = useMemo(() => createButterflyWingGeometry(), []);
  const groupRefs = useRef<Array<THREE.Group | null>>([]);
  const leftWingRefs = useRef<Array<THREE.Mesh | null>>([]);
  const rightWingRefs = useRef<Array<THREE.Mesh | null>>([]);

  const flightPaths = useMemo(
    () => [
      { cx: 5.85, cy: 0.65, cz: 0.65, rx: 0.85, rz: 0.65, speed: 0.62, phase: 0.0, color: '#FFF6D6' },
      { cx: 6.25, cy: 0.72, cz: 2.15, rx: 0.72, rz: 0.80, speed: 0.54, phase: 1.4, color: '#FAD0DC' },
      { cx: 7.65, cy: 0.58, cz: 1.05, rx: 0.95, rz: 0.70, speed: 0.48, phase: 2.8, color: '#F8DF8C' },
      { cx: 3.45, cy: 0.62, cz: 5.85, rx: 0.80, rz: 0.55, speed: 0.58, phase: 4.1, color: '#FFF6D6' },
      { cx: 5.45, cy: 0.55, cz: -1.45, rx: 0.65, rz: 0.75, speed: 0.66, phase: 5.2, color: '#F6C2D4' },
      { cx: 1.55, cy: 0.68, cz: 5.95, rx: 0.70, rz: 0.60, speed: 0.52, phase: 2.1, color: '#F8DF8C' },
    ],
    []
  );

  useEffect(() => {
    return () => {
      wingGeo.dispose();
    };
  }, [wingGeo]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    flightPaths.forEach((fp, i) => {
      const grp = groupRefs.current[i];
      const lw = leftWingRefs.current[i];
      const rw = rightWingRefs.current[i];
      if (!grp || !lw || !rw) return;

      const u = t * fp.speed + fp.phase;
      const nx = fp.cx + Math.sin(u) * fp.rx;
      const nz = fp.cz + Math.sin(u * 2.0) * fp.rz * 0.55;
      const ny = fp.cy + Math.sin(u * 3.1) * 0.14;

      const dx = Math.cos(u) * fp.rx;
      const dz = Math.cos(u * 2.0) * 2.0 * fp.rz * 0.55;
      grp.position.set(nx, ny, nz);
      grp.rotation.y = Math.atan2(dx, dz);

      const flap = Math.sin(t * 15.5 + fp.phase * 3.0) * 0.82;
      lw.rotation.y = flap;
      rw.rotation.y = -flap;
    });
  });

  return (
    <group>
      {flightPaths.map((fp, idx) => (
        <group
          key={idx}
          ref={(el) => {
            groupRefs.current[idx] = el;
          }}
        >
          <mesh
            ref={(el) => {
              leftWingRefs.current[idx] = el;
            }}
            geometry={wingGeo}
            rotation={[Math.PI * 0.38, 0, 0]}
          >
            <meshStandardMaterial color={fp.color} roughness={0.55} side={THREE.DoubleSide} />
          </mesh>
          <mesh
            ref={(el) => {
              rightWingRefs.current[idx] = el;
            }}
            geometry={wingGeo}
            scale={[-1, 1, 1]}
            rotation={[Math.PI * 0.38, 0, 0]}
          >
            <meshStandardMaterial color={fp.color} roughness={0.55} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/**
 * GPU Vertex Wind-Sway Leaf Material (onBeforeCompile)
 * Animates 4,100+ instanced tree leaves, shrubs & hanging veranda vines at zero CPU cost
 * with per-instance world-space phase offsets so gusts ripple naturally across the garden!
 */
function createWindSwayLeafMaterial(
  windUniform: { value: number },
  roughness: number,
  swayAmp: number,
  cacheTag: string,
  extraParams?: THREE.MeshStandardMaterialParameters,
  tipMode: 'leaf' | 'radial' | 'canopy' | 'stalk' = 'leaf'
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    roughness,
    envMapIntensity: 0.25,
    side: THREE.DoubleSide,
    ...extraParams,
  });
  const tipExpr =
    tipMode === 'radial'
      ? 'clamp(length(position) * 2.4, 0.0, 1.0)'
      : tipMode === 'canopy'
      ? 'clamp((position.y + 0.72) * 0.72, 0.0, 1.0)'
      : tipMode === 'stalk'
      ? 'clamp((position.y + 0.36) * 1.38, 0.0, 1.0)'
      : 'clamp((position.y + 0.12) * 3.5, 0.0, 1.0)';
  mat.customProgramCacheKey = () => `cottage-wind-leaf-${cacheTag}-${tipMode}`;
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
        vec3 windSeed = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #ifdef USE_INSTANCING
          windSeed = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #endif
        float gustPhase = windSeed.x * 0.65 + windSeed.z * 0.52 + windSeed.y * 0.35;
        float gust = sin(uWindTime * 1.45 + gustPhase) * 0.65 + cos(uWindTime * 2.35 + gustPhase * 1.7) * 0.35;
        float tipMask = ${tipExpr};
        transformed.x += gust * uWindAmp * tipMask;
        transformed.z += cos(uWindTime * 1.25 + gustPhase * 1.3) * uWindAmp * 0.65 * tipMask;`
      );
  };
  // 注入吉卜力三阶兰伯特色阶着色器（树冠受光面金绿亮斑 + 背光面温润蓝绿阴影，彻底去除写实塑料高光）
  enhanceWithStylizedFoliageToon(mat, {
    cacheTag: `haussmann-${cacheTag}-${tipMode}`,
    sunlitColor: cacheTag.includes('cypress') ? '#96C96E' : '#E2F26B',
    shadowColor: cacheTag.includes('cypress') ? '#265456' : '#316E67',
    toonBlend: cacheTag.includes('hyd') || cacheTag.includes('blossom') ? 0.52 : 0.80,
  });
  return mat;
}

/** Gently cupped double-axis botanical leaf-sprig card (never paper-flat!) */
function createCurvedLeafSprigCardGeometry(w = 0.72, h = 0.72): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h, 3, 3);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const arch = -0.09 * (x * x + y * y) / (w * w * 0.25);
    pos.setZ(i, arch);
  }
  g.computeVertexNormals();
  return g;
}

export const HaussmannSalonArchitecture: React.FC = () => {
  const textures = useMemo(() => getAtelierTextures(), []);
  const craftAssets = useMemo(() => getCottageCraftAssets(), []);
  const leafGeo = useMemo(() => createCitrusLeafGeometry(), []);
  const roseGeo = useMemo(() => createSculptedRoseBlossomGeometry(), []);
  const canopyPuffGeo = useMemo(() => createVolumetricCanopyPuffGeometry(), []);
  const sprigCardGeo = useMemo(() => createCurvedLeafSprigCardGeometry(0.74, 0.74), []);
  const fernGeo = useMemo(() => createSwordFernFrondGeometry(), []);
  const raisedBedGeo = useMemo(() => createBeveledBoxGeometry(0.94, 0.24, 2.20, 0.022, 0.008, 0.008, 2), []);

  // 4 Organic Sculpted Tree Trunk-with-Root-Flare & Tapered Branching Limb Archetypes (zero straight poles!)
  const treeArchetypes = useMemo(() => {
    return [0, 1, 2, 3].map((variant) => {
      const leanX = ((variant % 2) * 2 - 1) * (0.14 + variant * 0.03);
      const leanZ = (variant < 2 ? 1 : -1) * (0.12 + (3 - variant) * 0.02);
      const trunkGeo = createOrganicTreeLimbGeometry(
        [
          new THREE.Vector3(0, -0.34, 0),
          new THREE.Vector3(0, 0.04, 0),
          new THREE.Vector3(leanX * 0.35, 0.92, leanZ * 0.35),
          new THREE.Vector3(leanX * 0.85, 1.92, leanZ * 0.75),
          new THREE.Vector3(leanX * 0.65, 2.86, leanZ * 0.45),
        ],
        0.195,
        0.072,
        12,
        16,
        true
      );
      const limbGeos = [0, 1, 2].map((bi) => {
        const ba = bi * 2.094 + variant * 0.65;
        const dx = Math.cos(ba);
        const dz = Math.sin(ba);
        const startY = 2.48 + bi * 0.14;
        const forkStart = new THREE.Vector3(leanX * 0.68, startY, leanZ * 0.50);
        const midPt = new THREE.Vector3(
          forkStart.x + dx * 0.44,
          startY + 0.46,
          forkStart.z + dz * 0.44
        );
        const tipPt = new THREE.Vector3(
          forkStart.x + dx * 0.92,
          startY + 0.88 + (bi % 2) * 0.14,
          forkStart.z + dz * 0.92
        );
        return createOrganicTreeLimbGeometry([forkStart, midPt, tipPt], 0.062, 0.018, 9, 12, false);
      });
      return { trunkGeo, limbGeos };
    });
  }, []);

  const windTimeUniform = useMemo(() => ({ value: 0 }), []);
  // Sculpted volumetric painterly Ghibli tree canopy core (vertex-colored sunlit-top -> sunny meadow base + painted dab texture)
  const windCanopyCoreMat = useMemo(
    () =>
      createWindSwayLeafMaterial(windTimeUniform, 0.86, 0.024, 'canopy-core', {
        map: craftAssets.painterlyCanopyTex,
        vertexColors: true,
        side: THREE.FrontSide,
        emissive: new THREE.Color('#588630'),
        emissiveIntensity: 0.22,
      }),
    [windTimeUniform, craftAssets.painterlyCanopyTex]
  );
  // Crisp alpha-cutout 42-leaf painterly twig sprigs framing the outer canopy rim (ZERO giant flat banana leaves)
  const windCanopySprigMat = useMemo(
    () =>
      createWindSwayLeafMaterial(windTimeUniform, 0.86, 0.036, 'canopy-sprig', {
        map: craftAssets.ghibliLeafSprigTex,
        alphaTest: 0.42,
        emissive: new THREE.Color('#588630'),
        emissiveIntensity: 0.22,
      }),
    [windTimeUniform, craftAssets.ghibliLeafSprigTex]
  );
  const windShrubMat = useMemo(
    () =>
      createWindSwayLeafMaterial(windTimeUniform, 0.86, 0.016, 'shrub-sprig', {
        map: craftAssets.ghibliLeafSprigTex,
        alphaTest: 0.42,
        emissive: new THREE.Color('#588630'),
        emissiveIntensity: 0.22,
      }),
    [windTimeUniform, craftAssets.ghibliLeafSprigTex]
  );
  const windVineMat = useMemo(() => createWindSwayLeafMaterial(windTimeUniform, 0.72, 0.018, 'vine'), [windTimeUniform]);
  const windBlossomMat = useMemo(
    () => createWindSwayLeafMaterial(windTimeUniform, 0.74, 0.036, 'orchard-blossom', { vertexColors: true }, 'radial'),
    [windTimeUniform]
  );
  const windCypressMats = useMemo(
    () =>
      ['#2B4A28', '#33552E', '#3B5E35', '#43683B', '#4D7242'].map((col, ti) =>
        createWindSwayLeafMaterial(
          windTimeUniform,
          0.94,
          0.014 + ti * 0.004,
          `cypress-${ti}`,
          { map: craftAssets.painterlyCanopyTex, color: col },
          'canopy'
        )
      ),
    [windTimeUniform, craftAssets.painterlyCanopyTex]
  );
  const windHydrangeaMats = useMemo(
    () => ({
      '#FAF4E4': createWindSwayLeafMaterial(windTimeUniform, 0.76, 0.012, 'hyd-cream', { color: '#FAF4E4', vertexColors: true }, 'radial'),
      '#F098AE': createWindSwayLeafMaterial(windTimeUniform, 0.76, 0.012, 'hyd-pink', { color: '#F098AE', vertexColors: true }, 'radial'),
      '#F2A0B6': createWindSwayLeafMaterial(windTimeUniform, 0.76, 0.012, 'hyd-rose', { color: '#F2A0B6', vertexColors: true }, 'radial'),
      '#9CB2E8': createWindSwayLeafMaterial(windTimeUniform, 0.76, 0.012, 'hyd-blue', { color: '#9CB2E8', vertexColors: true }, 'radial'),
    }),
    [windTimeUniform]
  );
  const windCornMat = useMemo(
    () => createWindSwayLeafMaterial(windTimeUniform, 0.75, 0.014, 'corn-stalk', { color: '#5A8E3E' }, 'stalk'),
    [windTimeUniform]
  );

  const forestCanopyCoreRef = useRef<THREE.InstancedMesh>(null);
  const forestCanopyRef = useRef<THREE.InstancedMesh>(null);
  const orchardBlossomsRef = useRef<THREE.InstancedMesh>(null);
  const verandaVineRef = useRef<THREE.InstancedMesh>(null);
  const gardenShrubsRef = useRef<THREE.InstancedMesh>(null);
  const shrubCoresRef = useRef<THREE.InstancedMesh>(null);

  useFrame(({ clock }) => {
    windTimeUniform.value = clock.getElapsedTime();
  });

  const bambooPbr = useMemo(() => createWoodGrainPbr('#D89E5C', '#9E6830', 517), []);
  const bedTimberPbr = useMemo(() => createWoodGrainPbr('#8B5630', '#583218', 229), []);
  const barkPbr = useMemo(() => createWoodGrainPbr('#5B412C', '#332214', 707), []);
  const galvMicroMaps = useMemo(() => createMicroSurfaceMaps(0.34, 0.15, false, 613), []);

  const bambooMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: bambooPbr.map,
        bumpMap: bambooPbr.bumpMap,
        bumpScale: 0.008,
        roughnessMap: bambooPbr.roughnessMap,
        roughness: 0.62,
        clearcoat: 0.06,
        envMapIntensity: 0.32,
      }),
    [bambooPbr]
  );

  const timberMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: bedTimberPbr.map,
        bumpMap: bedTimberPbr.bumpMap,
        bumpScale: 0.012,
        roughnessMap: bedTimberPbr.roughnessMap,
        roughness: 0.78,
        envMapIntensity: 0.28,
      }),
    [bedTimberPbr]
  );

  const barkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: barkPbr.map,
        bumpMap: barkPbr.bumpMap,
        bumpScale: 0.022,
        roughnessMap: barkPbr.roughnessMap,
        roughness: 0.92,
        envMapIntensity: 0.22,
      }),
    [barkPbr]
  );

  const galvanizedMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#BDC5C9',
        bumpMap: galvMicroMaps.bumpMap,
        bumpScale: 0.006,
        roughnessMap: galvMicroMaps.roughnessMap,
        metalness: 0.52,
        roughness: 0.48,
        envMapIntensity: 0.38,
      }),
    [galvMicroMaps]
  );

  // Hollow 24-seg Lathe galvanized watering can body with rolled top rim (ZERO solid capped cylinder!)
  const wateringCanBodyGeo = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.0001, 0.0),
      new THREE.Vector2(0.125, 0.0),
      new THREE.Vector2(0.128, 0.015),
      new THREE.Vector2(0.112, 0.255),
      new THREE.Vector2(0.118, 0.268),
      new THREE.Vector2(0.106, 0.272),
      new THREE.Vector2(0.102, 0.255),
      new THREE.Vector2(0.114, 0.020),
      new THREE.Vector2(0.0001, 0.020),
    ];
    const g = new THREE.LatheGeometry(pts, 24);
    g.computeVertexNormals();
    return g;
  }, []);

  // Physical curved hanging woody vine tendrils anchored flush beneath East (`y = 3.525`) & South (`y = 3.545`) veranda eaves!
  const { vineStemGeos, vineLeafSamples } = useMemo(() => {
    const geos: THREE.BufferGeometry[] = [];
    const samples: Array<{ pos: THREE.Vector3; rotY: number; scale: number }> = [];
    // 10 draped vine loops along East eave overhang underside (x = 5.95, y = 3.525) + 9 along South eave (z = 6.02, y = 3.545)
    const eastLoops = 10;
    for (let l = 0; l < eastLoops; l++) {
      const z0 = -2.8 + (l / eastLoops) * 7.6;
      const z1 = -2.8 + ((l + 1) / eastLoops) * 7.6;
      const zMid = (z0 + z1) * 0.5;
      const sag = 0.20 + (l % 3) * 0.12;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(5.95, 3.525, z0),
        new THREE.Vector3(5.97, 3.525 - sag * 0.78, (z0 + zMid) * 0.5),
        new THREE.Vector3(5.99, 3.525 - sag, zMid),
        new THREE.Vector3(5.97, 3.525 - sag * 0.78, (zMid + z1) * 0.5),
        new THREE.Vector3(5.95, 3.525, z1),
      ]);
      geos.push(new THREE.TubeGeometry(curve, 14, 0.014, 8, false));
      for (let k = 0; k < 14; k++) {
        const pt = curve.getPointAt((k + 0.5) / 14);
        samples.push({
          pos: new THREE.Vector3(pt.x + ((k % 3) - 1) * 0.022, pt.y - 0.015, pt.z + ((k % 2) - 0.5) * 0.024),
          rotY: (l * 14 + k) * 0.85,
          scale: 1.15 + (k % 3) * 0.22,
        });
      }
    }
    const southLoops = 9;
    for (let l = 0; l < southLoops; l++) {
      const x0 = -4.2 + (l / southLoops) * 9.8;
      const x1 = -4.2 + ((l + 1) / southLoops) * 9.8;
      const xMid = (x0 + x1) * 0.5;
      const sag = 0.18 + (l % 3) * 0.11;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x0, 3.545, 6.02),
        new THREE.Vector3((x0 + xMid) * 0.5, 3.545 - sag * 0.78, 6.04),
        new THREE.Vector3(xMid, 3.545 - sag, 6.06),
        new THREE.Vector3((xMid + x1) * 0.5, 3.545 - sag * 0.78, 6.04),
        new THREE.Vector3(x1, 3.545, 6.02),
      ]);
      geos.push(new THREE.TubeGeometry(curve, 14, 0.014, 8, false));
      for (let k = 0; k < 13; k++) {
        const pt = curve.getPointAt((k + 0.5) / 13);
        samples.push({
          pos: new THREE.Vector3(pt.x + ((k % 2) - 0.5) * 0.024, pt.y - 0.015, pt.z + ((k % 3) - 1) * 0.022),
          rotY: (l * 13 + k) * 0.9,
          scale: 1.15 + (k % 3) * 0.22,
        });
      }
    }
    return { vineStemGeos: geos, vineLeafSamples: samples };
  }, []);

  const treePositions: Array<[number, number, number, number]> = useMemo(
    () =>
      (
        [
          // 2 Graceful Framing Courtyard Fruit Trees (shifted slightly clear of distant Windmill & Gazebo vista!)
          [7.45, 7.65, 0.78],
          [-5.95, 8.85, 1.02],
          // East Wing Framing Orchard (clears the new Herb Garden Beds around [11.0, 7.6] & distant Windmill!)
          [12.8, -6.8, 1.24],
          [14.2, -3.2, 1.18],
          [14.4, 5.2, 1.20],
          [14.0, 10.9, 1.18],
          // South-East & South-West Framing Groves (wide open central & SE banquet vista clear of Gazebo & Cart!)
          [13.4, 14.5, 1.22],
          [-6.8, 13.6, 1.24],
          [-9.2, 17.5, 1.28],
          // West & North Orchard Surrounding the Cottage
          [-8.4, 4.2, 1.22],
          [-8.8, -0.4, 1.28],
          [-7.8, -4.2, 1.20],
          [-4.6, -6.8, 1.22],
          [-0.8, -7.6, 1.30],
          [2.8, -7.2, 1.26],
          [6.4, -6.4, 1.16],
          // Asymmetric Flowering Orchard Accent Trees anchoring East Meadow & Beyond-Gazebo Manor Estate Horizon
          [17.6, -4.4, 1.12],
          [11.2, 22.8, 1.18],
        ] as Array<[number, number, number]>
      ).map(([tx, tz, sc]) => [tx, sampleGhibliTerrainHeight(tx, tz) - 0.02, tz, sc]),
    []
  );

  // Sculpted Low Manicured Garden Boxwood & Hydrangea Borders grounded squarely in raised beds (`-0.14`) & onto `-0.36` meadow!
  const shrubCenters: Array<[number, number, number, number]> = useMemo(
    () => [
      // 1. Kitchen-garden raised bed #1 & #2（对齐实际地形高度，避开南侧矮石墙）
      [4.45, sampleGhibliTerrainHeight(5.05, -4.48) + 0.08, -4.48, 0.24],
      [5.05, sampleGhibliTerrainHeight(5.05, -4.48) + 0.08, -4.48, 0.26],
      [5.65, sampleGhibliTerrainHeight(5.05, -4.48) + 0.08, -4.48, 0.24],
      [-5.35, sampleGhibliTerrainHeight(-4.75, 8.25) + 0.08, 8.25, 0.24],
      [-4.75, sampleGhibliTerrainHeight(-4.75, 8.25) + 0.08, 8.25, 0.26],
      [-4.15, sampleGhibliTerrainHeight(-4.75, 8.25) + 0.08, 8.25, 0.24],
      // East courtyard stone-curb low flowering borders grounded on `-0.36` meadow
      [6.58, -0.36, -2.95, 0.30],
      [6.58, -0.36, 4.15, 0.32],
      // Paired Low Sculpted Hydrangea Cushions framing South Promenade Stone Gateway (`y = -0.36`)
      [-0.58, -0.36, 7.08, 0.32],
      [2.28, -0.36, 7.08, 0.32],
      // Cottage-side Near-Bank Stone Planter Terrace Hydrangea & Boxwood Accents (keeping far outer bank wild!)
      [7.38, -0.15, -5.25, 0.22],
      [7.04, -0.15, -3.55, 0.22],
      [7.00, -0.15, 2.90, 0.22],
      [5.45, -0.15, 8.05, 0.23],
      [3.15, -0.15, 8.02, 0.23],
      [-2.35, -0.15, 8.75, 0.23],
    ],
    []
  );

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

      // 1A. Volumetric Sculpted Multi-Lobe Ghibli Tree Crowns with Depth Atmospheric Tint Variation!
    const coreInst = forestCanopyCoreRef.current;
    if (coreInst) {
      const nearCrownTints = [0xdff3c2, 0xcdeaaf, 0xe8f6cc, 0xc2e2a0, 0xd8efba];
      const farCrownTints = [0xb8d4a4, 0xacc898, 0xc4ddae, 0xa2bf90];
      let rng = 6103;
      const rand = () => {
        rng = (rng * 1664525 + 1013904223) >>> 0;
        return rng / 4294967296;
      };
      const lobeOffsets: Array<[number, number, number, number]> = [
        [0.0, 0.56, 0.0, 0.92],      // Recessed core volume so outer painterly sprigs shape silhouette
        [0.68, 0.12, 0.42, 0.74],
        [-0.66, 0.16, 0.40, 0.76],
        [0.40, 0.10, -0.68, 0.72],
        [-0.54, 0.20, -0.54, 0.70],
        [0.14, 0.92, -0.08, 0.62],
      ];
      treePositions.forEach(([tx, ty, tz, ts], tIdx) => {
        const isDistant = Math.hypot(tx, tz) > 13.5;
        const crownTints = isDistant ? farCrownTints : nearCrownTints;
        const canopyBaseY = (tIdx < 2 ? 3.12 : 3.26) * ts;
        const twist = tIdx * 1.15;
        const cosT = Math.cos(twist);
        const sinT = Math.sin(twist);
        lobeOffsets.forEach(([ox, oy, oz, lr], li) => {
          const idx = tIdx * 6 + li;
          const rx = (ox * cosT - oz * sinT) * ts;
          const rz = (ox * sinT + oz * cosT) * ts;
          dummy.position.set(
            tx + rx + (rand() - 0.5) * 0.20 * ts,
            ty + canopyBaseY + oy * ts,
            tz + rz + (rand() - 0.5) * 0.20 * ts
          );
          dummy.rotation.set((rand() - 0.5) * 0.35, rand() * Math.PI * 2, (rand() - 0.5) * 0.35);
          const rScale = lr * (0.86 + rand() * 0.22) * ts;
          dummy.scale.set(rScale * 1.08, rScale * 0.80, rScale * 1.08);
          dummy.updateMatrix();
          coreInst.setMatrixAt(idx, dummy.matrix);
          color.setHex(crownTints[(tIdx + li) % crownTints.length]);
          coreInst.setColorAt(idx, color);
        });
      });
      coreInst.instanceMatrix.needsUpdate = true;
      if (coreInst.instanceColor) coreInst.instanceColor.needsUpdate = true;
    }

    // 1B. Airy Outer Rim Multi-Leaf Twig Cluster Sprigs + Flowering Crabapple / Citrus Orchard Blossoms
    const fInst = forestCanopyRef.current;
    const obInst = orchardBlossomsRef.current;
    if (fInst) {
      const sprigTints = [0xf4fae4, 0xe2f3cc, 0xcce4a8, 0xdff0c4];
      const farSprigTints = [0xbdd9aa, 0xb0cd9c, 0xc8e1b4, 0xa8c694];
      const blossomTints = [0xfad6e2, 0xf49eb6, 0xfff9ec, 0xf8c2d2];
      let rng = 8821;
      const rand = () => {
        rng = (rng * 1664525 + 1013904223) >>> 0;
        return rng / 4294967296;
      };
      const sprigsPerTree = 36;
      let bi = 0;
      treePositions.forEach(([tx, ty, tz, ts], tIdx) => {
        const isDistant = Math.hypot(tx, tz) > 13.5;
        const palette = isDistant ? farSprigTints : sprigTints;
        const canopyBaseY = (tIdx < 2 ? 3.18 : 3.32) * ts;
        const isFloweringTree = tIdx === 1 || (tIdx >= 2 && tIdx % 2 === 0);
        for (let k = 0; k < sprigsPerTree; k++) {
          const idx = tIdx * sprigsPerTree + k;
          const th = (k / sprigsPerTree) * Math.PI * 2 + (rand() - 0.5) * 0.55;
          const ph = -0.28 + rand() * 1.42;
          const rad = (0.78 + rand() * 0.72) * ts;
          const sx = tx + Math.cos(th) * Math.cos(ph * 0.65) * rad;
          const sy = ty + canopyBaseY + Math.sin(ph) * rad * 0.80;
          const sz = tz + Math.sin(th) * Math.cos(ph * 0.65) * rad;
          dummy.position.set(sx, sy, sz);
          // Orient outward from crown center with gentle natural droop
          dummy.rotation.set(0.32 + rand() * 0.55, -th + Math.PI * 0.5 + (rand() - 0.5) * 0.6, (rand() - 0.5) * 0.45);
          dummy.scale.setScalar((1.06 + rand() * 0.48) * ts);
          dummy.updateMatrix();
          fInst.setMatrixAt(idx, dummy.matrix);
          color.setHex(palette[(idx + tIdx) % palette.length]);
          fInst.setColorAt(idx, color);

          if (obInst && isFloweringTree && k % 3 === 0 && bi < 96) {
            dummy.position.set(sx, sy + 0.04, sz);
            dummy.rotation.set(0.35 + rand() * 0.6, rand() * Math.PI * 2, (rand() - 0.5) * 0.5);
            dummy.scale.setScalar((1.95 + rand() * 0.75) * ts);
            dummy.updateMatrix();
            obInst.setMatrixAt(bi, dummy.matrix);
            color.setHex(blossomTints[(tIdx + bi) % blossomTints.length]);
            obInst.setColorAt(bi, color);
            bi++;
          }
        }
      });
      if (obInst) {
        for (; bi < 96; bi++) {
          dummy.position.set(0, -10, 0);
          dummy.scale.setScalar(0.001);
          dummy.updateMatrix();
          obInst.setMatrixAt(bi, dummy.matrix);
        }
        obInst.instanceMatrix.needsUpdate = true;
        if (obInst.instanceColor) obInst.instanceColor.needsUpdate = true;
      }
      fInst.instanceMatrix.needsUpdate = true;
      if (fInst.instanceColor) fInst.instanceColor.needsUpdate = true;
    }

    // 2. Sculpted Volumetric Garden Shrub Cushions + Outer Multi-Leaf Sprig Clusters!
    const scInst = shrubCoresRef.current;
    if (scInst) {
      const shrubTints = [0xedf7dc, 0xf6fae8, 0xe4f2d0, 0xeff8df];
      shrubCenters.forEach(([sx, sy, sz, sr], cIdx) => {
        dummy.position.set(sx, sy + sr * 0.55, sz);
        dummy.rotation.set(0, cIdx * 1.3, 0);
        dummy.scale.set(sr * 1.15, sr * 0.76, sr * 1.15);
        dummy.updateMatrix();
        scInst.setMatrixAt(cIdx, dummy.matrix);
        color.setHex(shrubTints[cIdx % shrubTints.length]);
        scInst.setColorAt(cIdx, color);
      });
      scInst.instanceMatrix.needsUpdate = true;
      if (scInst.instanceColor) scInst.instanceColor.needsUpdate = true;
    }

    const sInst = gardenShrubsRef.current;
    if (sInst) {
      const sprigTints = [0xffffff, 0xf0f8e2, 0xe4f1d6, 0xf8fbe8];
      let rng = 5050;
      const rand = () => {
        rng = (rng * 1664525 + 1013904223) >>> 0;
        return rng / 4294967296;
      };
      const sprigsPerShrub = 10;
      shrubCenters.forEach(([sx, sy, sz, sr], cIdx) => {
        for (let k = 0; k < sprigsPerShrub; k++) {
          const idx = cIdx * sprigsPerShrub + k;
          const a = (k / sprigsPerShrub) * Math.PI * 2 + rand() * 0.4;
          const r = sr * (0.55 + rand() * 0.45);
          const h = sr * (0.35 + rand() * 0.65);
          dummy.position.set(sx + Math.cos(a) * r, sy + h, sz + Math.sin(a) * r);
          dummy.rotation.set(0.35 + rand() * 0.5, -a + Math.PI * 0.5, (rand() - 0.5) * 0.4);
          dummy.scale.setScalar(sr * (0.85 + rand() * 0.42));
          dummy.updateMatrix();
          sInst.setMatrixAt(idx, dummy.matrix);
          color.setHex(sprigTints[(idx + cIdx) % sprigTints.length]);
          sInst.setColorAt(idx, color);
        }
      });
      sInst.instanceMatrix.needsUpdate = true;
      if (sInst.instanceColor) sInst.instanceColor.needsUpdate = true;
    }

    // Trailing Ivy Leaves hugging physical hanging woody vine stems (ZERO floating detached leaves!)
    const vInst = verandaVineRef.current;
    if (vInst) {
      const vineGreens = [0x4c8236, 0x629844, 0x3e6f2c, 0x74aa50];
      vineLeafSamples.forEach((sample, i) => {
        dummy.position.copy(sample.pos);
        dummy.rotation.set(0.62, sample.rotY, 0.28);
        dummy.scale.setScalar(sample.scale * 0.92);
        dummy.updateMatrix();
        vInst.setMatrixAt(i, dummy.matrix);
        color.setHex(vineGreens[i % vineGreens.length]);
        vInst.setColorAt(i, color);
      });
      vInst.instanceMatrix.needsUpdate = true;
      if (vInst.instanceColor) vInst.instanceColor.needsUpdate = true;
    }
  }, [treePositions, shrubCenters, vineLeafSamples]);

  useEffect(() => {
    return () => {
      leafGeo.dispose();
      roseGeo.dispose();
      canopyPuffGeo.dispose();
      sprigCardGeo.dispose();
      fernGeo.dispose();
      raisedBedGeo.dispose();
      wateringCanBodyGeo.dispose();
      vineStemGeos.forEach((g) => g.dispose());
      treeArchetypes.forEach(({ trunkGeo, limbGeos }) => {
        trunkGeo.dispose();
        limbGeos.forEach((lg) => lg.dispose());
      });
      windCanopyCoreMat.dispose();
      windCanopySprigMat.dispose();
      windShrubMat.dispose();
      windVineMat.dispose();
      windBlossomMat.dispose();
      windCypressMats.forEach((m) => m.dispose());
      Object.values(windHydrangeaMats).forEach((m) => m.dispose());
      windCornMat.dispose();
      bambooMat.dispose();
      timberMat.dispose();
      barkMat.dispose();
      galvanizedMat.dispose();
      bambooPbr.map.dispose();
      bambooPbr.bumpMap.dispose();
      bambooPbr.roughnessMap.dispose();
      bedTimberPbr.map.dispose();
      bedTimberPbr.bumpMap.dispose();
      bedTimberPbr.roughnessMap.dispose();
      barkPbr.map.dispose();
      barkPbr.bumpMap.dispose();
      barkPbr.roughnessMap.dispose();
      galvMicroMaps.bumpMap.dispose();
      galvMicroMaps.roughnessMap.dispose();
    };
  }, [
    leafGeo,
    roseGeo,
    canopyPuffGeo,
    sprigCardGeo,
    fernGeo,
    raisedBedGeo,
    wateringCanBodyGeo,
    vineStemGeos,
    treeArchetypes,
    windCanopyCoreMat,
    windCanopySprigMat,
    windShrubMat,
    windVineMat,
    windBlossomMat,
    windCypressMats,
    windHydrangeaMats,
    windCornMat,
    bambooMat,
    timberMat,
    barkMat,
    galvanizedMat,
    bambooPbr,
    bedTimberPbr,
    barkPbr,
    galvMicroMaps,
  ]);

  return (
    <group>
      {/* 1. French Sage-Bordered Botanical Floral Tapestry Rugs (`2fb763f6`) */}
      <mesh position={[3.55, 0.0028, 0.65]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={() => null}>
        <circleGeometry args={[1.52, 64]} />
        <meshStandardMaterial
          map={craftAssets.floralRugTex}
          normalMap={textures.linenNormalMap}
          normalScale={LINEN_RUG_NORMAL_SCALE}
          roughness={0.90}
          transparent
          alphaTest={0.05}
        />
      </mesh>
      <mesh
        position={[-3.68, 0.088, 2.95]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[1.18, 1.38, 1]}
        receiveShadow
        raycast={() => null}
      >
        <circleGeometry args={[1.0, 64]} />
        <meshStandardMaterial
          map={craftAssets.floralRugTex}
          normalMap={textures.linenNormalMap}
          normalScale={LINEN_RUG_NORMAL_SCALE}
          roughness={0.90}
          transparent
          alphaTest={0.05}
        />
      </mesh>

      {/* 1B. Braided Natural Jute & Sage Farmhouse Kitchen Runner Rug in front of Hearth & Workbench */}
      <mesh position={[-0.75, 0.0028, -2.02]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={() => null}>
        <planeGeometry args={[4.45, 1.05]} />
        <meshStandardMaterial
          map={craftAssets.juteRunnerTex}
          normalMap={textures.linenNormalMap}
          normalScale={LINEN_RUG_NORMAL_SCALE}
          roughness={0.94}
        />
      </mesh>

      {/* 2. Courtyard Orchard Fruit Trees & 360° Woodland Canopy (Organic Root-Flared Tapered Trunks & Curved Boughs!) */}
      {treePositions.map(([tx, ty, tz, ts], idx) => {
        const arch = treeArchetypes[idx % treeArchetypes.length];
        return (
          <group key={idx} position={[tx, ty, tz]} scale={ts} rotation={[0, (idx * 0.72) % (Math.PI * 2), 0]}>
            <mesh geometry={arch.trunkGeo} material={barkMat} castShadow receiveShadow />
            {arch.limbGeos.map((lg, li) => (
              <mesh key={`limb-${li}`} geometry={lg} material={barkMat} castShadow />
            ))}
            {/* Ripe Red Apples & Golden Citrus nestled naturally inside Courtyard Tree Leaves! */}
            {idx < 2 &&
              [
                [-0.45, 2.98, 0.32],
                [0.40, 3.10, -0.28],
                [-0.22, 3.16, -0.42],
                [0.48, 2.94, 0.38],
                [0.08, 3.12, 0.48],
              ].map(([fx, fy, fz], fi) => (
                <mesh key={fi} position={[fx, fy, fz]} castShadow>
                  <sphereGeometry args={[0.044, 12, 10]} />
                  <meshStandardMaterial
                    color={idx === 0 ? '#D83830' : '#E89228'}
                    roughness={0.42}
                  />
                </mesh>
              ))}
          </group>
        );
      })}
      <instancedMesh ref={forestCanopyCoreRef} args={[canopyPuffGeo, windCanopyCoreMat, treePositions.length * 6]} castShadow receiveShadow userData={{ excludeFromOutline: true }} />
      <instancedMesh ref={forestCanopyRef} args={[sprigCardGeo, windCanopySprigMat, treePositions.length * 36]} userData={{ excludeFromOutline: true }} />
      <instancedMesh ref={orchardBlossomsRef} args={[roseGeo, windBlossomMat, 96]} />
      {/* Deep Mediterranean Olive & Pine Tapered Provence Cypress Silhouettes (GPU breeze sway!) */}
      {[
        [16.8, -0.36, -12.4, 1.32],
        [18.1, -0.36, -10.8, 0.98],
        [17.6, -0.36, 7.8, 1.24],
        [15.4, -0.36, 14.5, 1.18],
        [11.8, -0.36, 20.5, 1.14],
        [-11.2, -0.36, 21.0, 1.22],
        [-12.5, -0.36, 11.2, 1.16],
        [-11.8, -0.36, -9.8, 1.26],
      ].map(([cx, cy, cz, cs], ci) => (
        <group key={`cypress-${ci}`} position={[cx, cy, cz]} scale={cs}>
          <mesh position={[0, 1.05, 0]} material={barkMat} castShadow>
            <cylinderGeometry args={[0.06, 0.12, 2.2, 8]} />
          </mesh>
          {[
            [1.42, 0.36, 1.02, 0.03, 0.02],
            [2.12, 0.32, 0.98, -0.04, 0.03],
            [2.80, 0.27, 0.94, 0.03, -0.03],
            [3.42, 0.21, 0.88, -0.02, -0.02],
            [3.98, 0.14, 0.80, 0.02, 0.02],
          ].map(([ty, tr, sy, ox, oz], ti) => (
            <mesh
              key={`cytier-${ti}`}
              position={[ox, ty, oz]}
              rotation={[0.04 * (ti % 2 === 0 ? 1 : -1), ti * 1.3 + ci, 0]}
              scale={[tr, sy, tr]}
              geometry={canopyPuffGeo}
              material={windCypressMats[ti]}
              castShadow
              receiveShadow
            />
          ))}
        </group>
      ))}
      <instancedMesh ref={shrubCoresRef} args={[canopyPuffGeo, windCanopyCoreMat, shrubCenters.length]} castShadow receiveShadow />
      <instancedMesh ref={gardenShrubsRef} args={[sprigCardGeo, windShrubMat, shrubCenters.length * 10]} castShadow />
      {/* Physical Woody Veranda Eave Vine Tendrils + Hugged Ivy Leaves (ZERO midair detached leaves!) */}
      {vineStemGeos.map((vg, vi) => (
        <mesh key={`vstem-${vi}`} geometry={vg} castShadow>
          <meshStandardMaterial color="#4D5B2E" roughness={0.86} />
        </mesh>
      ))}
      <instancedMesh ref={verandaVineRef} args={[leafGeo, windVineMat, vineLeafSamples.length]} castShadow />

      {/* 3. Blooming Floral & Sword-Fern Arches + Staghorn Moss Ball (`230f538a` — GPU breeze sway!) */}
      <BotanicalFloralFernArch
        position={[-4.96, 3.60, -1.43]}
        rotation={[0, Math.PI / 2, 0]}
        span={1.68}
        fernGeo={fernGeo}
        leafGeo={leafGeo}
        roseGeo={roseGeo}
        windUniform={windTimeUniform}
      />
      <BotanicalFloralFernArch
        position={[4.68, 2.92, 1.35]}
        rotation={[0, -Math.PI / 2, 0]}
        span={2.10}
        fernGeo={fernGeo}
        leafGeo={leafGeo}
        roseGeo={roseGeo}
        windUniform={windTimeUniform}
      />

      {/* 4. 对齐真实地形高度的厨房香草种植箱（取代竹牙签+浮空番茄球，改建分叉枝叶与低矮挂果草莓丛！） */}
      {[
        { pos: [5.05, sampleGhibliTerrainHeight(5.05, -4.48) - 0.02, -4.48] as [number, number, number], rotY: Math.PI * 0.5 },
        { pos: [-4.75, sampleGhibliTerrainHeight(-4.75, 8.25) - 0.02, 8.25] as [number, number, number], rotY: Math.PI * 0.5 },
      ].map((bed, bi) => (
        <group key={`garden-bed-${bi}`} position={bed.pos} rotation={[0, bed.rotY, 0]}>
          <mesh geometry={raisedBedGeo} material={timberMat} castShadow receiveShadow />
          {/* 底部深埋土裙边确保斜坡处绝对零悬空 */}
          <mesh position={[0, -0.12, 0]} material={barkMat}>
            <boxGeometry args={[0.92, 0.20, 2.18]} />
          </mesh>
          <mesh position={[0, 0.11, 0]}>
            <boxGeometry args={[0.84, 0.04, 2.08]} />
            <meshStandardMaterial color="#3B291C" roughness={0.96} />
          </mesh>

          {/* 自然展开的草莓花草簇与挂枝浆果（零浮空红球、零光秃牙签） */}
          {[-0.64, 0.0, 0.64].map((bz, bzi) => (
            <group key={`herb-clump-${bzi}`} position={[0, 0.12, bz]}>
              {[
                [-0.14, 0.08, 0.10, 0.16, 0.10],
                [0.12, 0.09, -0.08, 0.18, 0.11],
                [0.0, 0.12, 0.0, 0.20, 0.13],
              ].map(([lx, ly, lz, scW, scH], li) => (
                <mesh key={`hl-${li}`} position={[lx, ly, lz]} scale={[scW, scH, scW]} geometry={canopyPuffGeo} material={windCornMat} castShadow />
              ))}
              {bzi !== 1 && (
                <>
                  {[
                    [0.16, 0.05, 0.12],
                    [-0.14, 0.06, -0.12],
                    [0.06, 0.07, -0.16],
                  ].map(([fx, fy, fz], fi) => (
                    <mesh key={`sb-${fi}`} position={[fx, fy, fz]} rotation={[0.4, fi * 1.6, 0.2]} castShadow>
                      <coneGeometry args={[0.024, 0.046, 8]} />
                      <meshStandardMaterial color="#DF2822" roughness={0.44} />
                    </mesh>
                  ))}
                </>
              )}
            </group>
          ))}
        </group>
      ))}

      {/* Hollow 24-seg Lathe Galvanized Watering Can resting cleanly ON TOP of East Veranda Deck (`y = -0.06`)! */}
      <group position={[5.52, -0.06, -1.35]} rotation={[0, 0.65, 0]}>
        <mesh geometry={wateringCanBodyGeo} material={galvanizedMat} castShadow receiveShadow />
        <mesh position={[0, 0.16, 0.19]} rotation={[0.92, 0, 0]} material={galvanizedMat} castShadow>
          <cylinderGeometry args={[0.012, 0.024, 0.32, 16]} />
        </mesh>
        <mesh position={[0, 0.26, 0.32]} rotation={[0.92, 0, 0]}>
          <coneGeometry args={[0.044, 0.046, 18]} />
          <meshStandardMaterial color="#B88746" metalness={0.62} roughness={0.44} />
        </mesh>
        <mesh position={[0, 0.27, -0.02]} rotation={[0, Math.PI / 2, 0]} material={galvanizedMat}>
          <torusGeometry args={[0.105, 0.010, 12, 24, Math.PI * 1.2]} />
        </mesh>
      </group>

      {/* Multi-Petal Sculpted Hydrangea Blossoms aligned 1:1 with Grounded Manicured Shrub Cushions (GPU breeze sway!) */}
      {[
        [6.58, -0.04, -2.95, '#FAF4E4'],
        [6.58, -0.02, 4.15, '#F098AE'],
        [-0.58, -0.02, 7.08, '#FAF4E4'],
        [2.28, -0.02, 7.08, '#F2A0B6'],
        [7.38, -0.02, -5.25, '#9CB2E8'],
        [7.04, -0.02, -3.55, '#FAF4E4'],
        [7.00, -0.02, 2.90, '#F2A0B6'],
        [5.45, -0.01, 8.05, '#9CB2E8'],
        [3.15, -0.01, 8.02, '#FAF4E4'],
        [-2.35, -0.01, 8.75, '#F2A0B6'],
      ].map(([bx, by, bz, bcol], idx) => (
        <group key={idx} position={[bx as number, by as number, bz as number]}>
          {[-0.14, 0.0, 0.14].map((ox, oi) => (
            <mesh
              key={oi}
              position={[ox, (oi % 2) * 0.05, (oi - 1) * 0.10]}
              rotation={[-0.22 + oi * 0.16, oi * 1.4, (oi - 1) * 0.25]}
              scale={1.35}
              geometry={roseGeo}
              material={windHydrangeaMats[bcol as keyof typeof windHydrangeaMats]}
            />
          ))}
        </group>
      ))}

      {/* 5. Three Real Wired Catenary Festoon String-Light Runs anchored directly to Veranda Eaves Fascia, Rose Arch & Corner Tree */}
      <WiredCatenaryFestoonStrand
        start={[5.94, 3.50, -3.55]}
        end={[6.38, 2.30, -1.65]}
        sag={0.28}
        bulbCount={6}
        emissiveIntensity={1.45}
      />
      <WiredCatenaryFestoonStrand
        start={[5.94, 3.50, 3.15]}
        end={[7.45, 2.78, 6.45]}
        sag={0.34}
        bulbCount={6}
        emissiveIntensity={1.45}
      />
      <WiredCatenaryFestoonStrand
        start={[5.94, 3.50, 5.98]}
        end={[2.45, 3.50, 5.98]}
        sag={0.36}
        bulbCount={7}
        emissiveIntensity={1.45}
      />

      {/* 6. Roof-Anchored Rattan Cage Lamps + Tiffany Floral Dome Lamp + Hangar-Anchored Windchime + Butterflies! */}
      <RattanSlattedCagePendant
        position={[3.68, 2.34, 3.58]}
        cordLength={1.71}
        bambooMat={bambooMat}
        castWarmPool
      />
      <RattanSlattedCagePendant
        position={[3.55, 2.88, 0.65]}
        cordLength={1.21}
        bambooMat={bambooMat}
        castWarmPool={false}
      />
      <RattanSlattedCagePendant
        position={[-3.35, 2.68, 2.42]}
        cordLength={1.57}
        bambooMat={bambooMat}
        castWarmPool
      />
      <TiffanyFloralDomeLamp
        position={[-3.95, 2.74, -1.43]}
        stemLength={1.42}
        tiffanyTex={craftAssets.tiffanyWindowTex}
      />
      <SwayingSeashellWindchime position={[5.62, 3.595, 3.35]} />
      <CourtyardButterflies />
    </group>
  );
};

export default HaussmannSalonArchitecture;
