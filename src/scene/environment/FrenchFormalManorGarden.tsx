import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  createVolumetricCanopyPuffGeometry,
  getCottageCraftAssets,
} from './cottageTexturesAndFlora';
import {
  createGhibliSwayingGrassClumpGeometry,
  createLavenderSpikeClusterGeometry,
  enhanceWithStylizedFoliageToon,
  sampleGhibliTerrainHeight,
} from '../../shaders/ghibliStylizedPipeline';
import { CozyHanddrawnSteam } from '../../shaders/stylizedCozyUpgrades';
import { createWoodGrainPbr } from '../props/cottageHighCraftPbr';

/** 生成浅米白色法式精细碎石园艺小径纹理（512×512，自然石灰岩砂砾肌理） */
function createFrenchGravelTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#E5DAC4';
  ctx.fillRect(0, 0, size, size);

  let rng = 192405;
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 4294967296;
  };

  const tones = ['#F0E7D4', '#D7C9AE', '#C9BA9E', '#F3ECE0', '#DFD2B8'];
  for (let i = 0; i < 4200; i++) {
    ctx.fillStyle = tones[i % tones.length];
    const x = rand() * size;
    const y = rand() * size;
    const r = 1.1 + rand() * 3.1;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.18, r * 0.82, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.5, 13);
  tex.anisotropy = 8;
  return tex;
}

/** 沿 2D 曲线生成自然弯曲贴地碎石小径（边缘自然羽化起伏，告别生硬直线水泥条！） */
function createCurvedGravelPathGeometry(
  pts2D: Array<[number, number]>,
  halfWidth: number,
  segments: number
): { pathGeo: THREE.BufferGeometry; curve: THREE.CatmullRomCurve3 } {
  const curve = new THREE.CatmullRomCurve3(pts2D.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const up = new THREE.Vector3(0, 1, 0);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let accLen = 0;
  let prevPt: THREE.Vector3 | null = null;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const side = new THREE.Vector3().crossVectors(up, tan).normalize();
    if (prevPt) accLen += pt.distanceTo(prevPt);
    prevPt = pt.clone();

    // 轻微自然宽度呼吸起伏，让小径宛如手工铺设的南法乡间碎石道
    const widthBreath = 1.0 + Math.sin(t * Math.PI * 5.0) * 0.08 + Math.cos(t * Math.PI * 9.0) * 0.04;
    const hw = halfWidth * widthBreath;

    const lx = pt.x - side.x * hw;
    const lz = pt.z - side.z * hw;
    const rx = pt.x + side.x * hw;
    const rz = pt.z + side.z * hw;
    const ly = sampleGhibliTerrainHeight(lx, lz) + 0.015;
    const ry = sampleGhibliTerrainHeight(rx, rz) + 0.015;

    positions.push(lx, ly - 0.032, lz);
    positions.push(lx, ly, lz);
    positions.push(rx, ry, rz);
    positions.push(rx, ry - 0.032, rz);

    uvs.push(0, accLen * 0.36, 0, accLen * 0.36, 1, accLen * 0.36, 1, accLen * 0.36);
  }

  for (let i = 0; i < segments; i++) {
    const b0 = i * 4;
    const b1 = (i + 1) * 4;
    indices.push(b0 + 1, b1 + 1, b0 + 2, b0 + 2, b1 + 1, b1 + 2);
    indices.push(b0 + 0, b1 + 0, b0 + 1, b0 + 1, b1 + 0, b1 + 1);
    indices.push(b0 + 2, b1 + 2, b0 + 3, b0 + 3, b1 + 2, b1 + 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return { pathGeo: geo, curve };
}

/** 生成不规则天然青石板踏步几何（七边形有机倒角石板） */
function createOrganicFlagstoneGeo(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const pts: Array<[number, number]> = [
    [-0.28, -0.18],
    [0.02, -0.23],
    [0.31, -0.15],
    [0.35, 0.06],
    [0.21, 0.22],
    [-0.10, 0.24],
    [-0.32, 0.10],
  ];
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.036,
    bevelEnabled: true,
    bevelThickness: 0.010,
    bevelSize: 0.014,
    bevelSegments: 2,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * 南法森林庄园庭院深度造景重构：
 * 1. 自然 S 弯曲浅米色碎石小径（带摇曳斑驳树影）+ 不规则天然青石板踏步 + 矮石块与野花镶边
 * 2. 彻底取代排排坐绿圆球：高低错落的绣球花丛 + 自然弧形薰衣草花带 + 风吹观赏草丛 + 5 棵南法橄榄树 + 白三叶与黄野花地被
 * 3. 右侧大树下光秃斜坡（x ∈ [-9.6..-2.4], z ∈ [12.8..22.8]）：3 层做旧原木阶梯草莓香草花坛 + 花藤木秋千 + 鼠尾草绿木长椅与打盹小猫
 * 4. 远景山坡中上部爬满藤蔓的法式石灰岩矮墙 + 赤陶红瓦烟囱南法乡村石砌小屋
 * 5. 保留东侧矮石墙后方 3 排层叠圆润灌木、白色野花带及 72 棵加密森林树墙（树冠标记 excludeFromOutline 零黑框）
 */
export const FrenchFormalManorGarden: React.FC = () => {
  const craftAssets = useMemo(() => getCottageCraftAssets(), []);
  const timberPbr = useMemo(() => createWoodGrainPbr('#8D5D38', '#56331B', 719), []);
  const windTimeUniform = useMemo(() => ({ value: 0 }), []);

  const swingSeatRef = useRef<THREE.Group>(null);
  const benchCatBodyRef = useRef<THREE.Group>(null);
  const benchCatTailRef = useRef<THREE.Group>(null);

  const {
    gravelTex,
    gravelMat,
    flagstoneGeo,
    flagstoneMat,
    borderStoneMat,
    limestoneMat,
    weatheredTimberMat,
    soilMat,
    sageBenchMat,
    terracottaRoofMat,
    farmPlasterMat,
    oliveToonMat,
    foliageBorderMat,
    cypressToonMat,
    forestWallToonMat,
    hillShrubLightMat,
    hillShrubMidMat,
    hillShrubDeepMat,
    ornamentalGrassGeo,
    ornamentalGrassMat,
    lavenderSpikeGeo,
    lavenderSpikeMat,
    whiteWildflowerMat,
    yellowWildflowerMat,
    wildflowerCoreMat,
    strawberryMat,
    trunkBarkMat,
    oliveBarkMat,
    hydrangeaMats,
    lavenderBloomMat,
    ironMat,
    brassMat,
    paths,
    southPathCurve,
    canopyPuffGeo,
  } = useMemo(() => {
    const gTex = createFrenchGravelTexture();
    const gMat = new THREE.MeshStandardMaterial({
      map: gTex,
      roughness: 0.94,
      metalness: 0.0,
    });
    // 给碎石小径注入随微风摇曳的斑驳树叶暖金光影（Dappled Sunlight），消除路面平板感！
    gMat.customProgramCacheKey = () => 'provence-gravel-dappled-sun-v1';
    gMat.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = windTimeUniform;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGravelWp;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGravelWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uWindTime;
          varying vec3 vGravelWp;
          float gHash(vec2 p){ p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 34.5); return fract(p.x * p.y); }
          float gNoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f); return mix(mix(gHash(i), gHash(i+vec2(1,0)), u.x), mix(gHash(i+vec2(0,1)), gHash(i+vec2(1,1)), u.x), u.y); }`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          {
            vec2 wp = vGravelWp.xz;
            vec2 drift = vec2(sin(uWindTime * 0.48) * 0.18, cos(uWindTime * 0.36) * 0.14);
            float n1 = gNoise(wp * 0.38 + drift);
            float n2 = gNoise(wp * 0.92 - drift * 0.7);
            float dapple = smoothstep(0.32, 0.72, n1 * 0.62 + n2 * 0.38);
            vec3 shadeTint = vec3(0.76, 0.79, 0.85);
            vec3 sunTint = vec3(1.10, 1.04, 0.91);
            diffuseColor.rgb *= mix(shadeTint, sunTint, dapple);
          }`
        );
    };

    const fGeo = createOrganicFlagstoneGeo();
    const fMat = new THREE.MeshStandardMaterial({
      color: '#9BA09B',
      roughness: 0.88,
      metalness: 0.02,
    });
    const bStoneMat = new THREE.MeshStandardMaterial({
      color: '#CFC5B2',
      roughness: 0.92,
      metalness: 0.0,
    });
    const limeMat = new THREE.MeshStandardMaterial({
      color: '#E6DCC8',
      roughness: 0.88,
      metalness: 0.0,
    });
    const wTimber = new THREE.MeshStandardMaterial({
      map: timberPbr.map,
      bumpMap: timberPbr.bumpMap,
      bumpScale: 0.014,
      roughness: 0.88,
      metalness: 0.0,
    });
    const sMat = new THREE.MeshStandardMaterial({ color: '#583C28', roughness: 0.96 });
    const benchMat = new THREE.MeshStandardMaterial({ color: '#7D9878', roughness: 0.72, metalness: 0.02 });
    const roofMat = new THREE.MeshStandardMaterial({ color: '#C66343', roughness: 0.84 });
    const plasterMat = new THREE.MeshStandardMaterial({ color: '#F4E9D6', roughness: 0.90 });

    const makeFoliageToon = (
      colorHex: string,
      tag: string,
      sunlit = '#DDF06A',
      shadow = '#2A635A',
      swayAmp = 0.015
    ) => {
      const m = new THREE.MeshStandardMaterial({
        color: colorHex,
        map: craftAssets.painterlyCanopyTex,
        roughness: 0.94,
        metalness: 0.0,
      });
      m.customProgramCacheKey = () => `formal-manor-v2-${tag}`;
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uWindTime = windTimeUniform;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>\nuniform float uWindTime;`)
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            vec3 fwSeed = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            #ifdef USE_INSTANCING
              fwSeed = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
            #endif
            float fwPhase = fwSeed.x * 0.42 + fwSeed.z * 0.36;
            float fwTip = clamp((position.y + 0.5) * 0.72, 0.0, 1.0);
            transformed.x += sin(uWindTime * 1.4 + fwPhase) * ${swayAmp.toFixed(4)} * fwTip;
            transformed.z += cos(uWindTime * 1.15 + fwPhase * 1.2) * ${(swayAmp * 0.65).toFixed(4)} * fwTip;`
          );
      };
      return enhanceWithStylizedFoliageToon(m, {
        cacheTag: tag,
        sunlitColor: sunlit,
        shadowColor: shadow,
        toonBlend: 0.80,
      });
    };

    // 带绿茎与锥形渐变花穗的真·薰衣草丛几何（100% 扎根地面，彻底消灭悬浮紫胶囊棒！）
    const lavSpikeGeo = createLavenderSpikeClusterGeometry();
    const lavSpikeMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.86,
      metalness: 0.0,
    });

    // 柔弯观赏草丛（Ornamental Grasses）风动材质
    const oGrassGeo = createGhibliSwayingGrassClumpGeometry();
    const oGrassMat = new THREE.MeshStandardMaterial({
      color: '#A6C472',
      vertexColors: true,
      roughness: 0.90,
      side: THREE.DoubleSide,
    });
    oGrassMat.customProgramCacheKey = () => 'provence-ornamental-grass-sway-v1';
    oGrassMat.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = windTimeUniform;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uWindTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec3 gSeed = vec3(0.0);
          #ifdef USE_INSTANCING
            gSeed = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          #endif
          float gTip = smoothstep(0.02, 0.24, position.y);
          float gPhase = gSeed.x * 0.7 + gSeed.z * 0.6;
          transformed.x += sin(uWindTime * 1.8 + gPhase) * 0.048 * gTip;
          transformed.z += cos(uWindTime * 1.4 + gPhase * 1.2) * 0.032 * gTip;`
        );
    };

    // 1. 自然 S 形弯曲通向白色花亭的浅米色法式碎石小径（彻底取代纯白笔直矩形路！）
    const southCurved = createCurvedGravelPathGeometry(
      [
        [1.15, 10.65],
        [0.08, 12.65],
        [1.06, 14.85],
        [0.14, 17.05],
        [0.58, 19.35],
      ],
      0.66,
      44
    );

    // 2. 东侧溪岸弯曲游园碎石小径（从主木桥柔和蜿蜒至下午茶露台与花亭）
    const eastCurved = createCurvedGravelPathGeometry(
      [
        [9.72, 0.95],
        [10.85, 2.55],
        [11.20, 5.60],
        [10.75, 9.20],
        [9.10, 12.25],
        [6.65, 14.70],
        [4.25, 15.55],
        [1.25, 15.10],
      ],
      0.54,
      54
    );

    // 3. 通往右侧大树下阶梯花坛、秋千与长椅的支线碎石小径
    const rightHillPath = createCurvedGravelPathGeometry(
      [
        [0.18, 16.95],
        [-1.85, 17.25],
        [-3.65, 17.65],
      ],
      0.42,
      20
    );

    return {
      gravelTex: gTex,
      gravelMat: gMat,
      flagstoneGeo: fGeo,
      flagstoneMat: fMat,
      borderStoneMat: bStoneMat,
      limestoneMat: limeMat,
      weatheredTimberMat: wTimber,
      soilMat: sMat,
      sageBenchMat: benchMat,
      terracottaRoofMat: roofMat,
      farmPlasterMat: plasterMat,
      oliveToonMat: makeFoliageToon('#88A682', 'provence-olive', '#C8DCB4', '#4B6B5A', 0.018),
      foliageBorderMat: makeFoliageToon('#5C9544', 'border-foliage', '#C6E468', '#2A5E4D', 0.010),
      cypressToonMat: makeFoliageToon('#467642', 'wall-cypress', '#8AC264', '#234F4E', 0.022),
      forestWallToonMat: makeFoliageToon('#67A84A', 'wall-broadleaf', '#D8EC64', '#2E6A62', 0.035),
      hillShrubLightMat: makeFoliageToon('#77B64C', 'hill-shrub-light', '#E0F272', '#346E5A', 0.014),
      hillShrubMidMat: makeFoliageToon('#5A9650', 'hill-shrub-mid', '#BBE074', '#2B5F58', 0.014),
      hillShrubDeepMat: makeFoliageToon('#4B7E58', 'hill-shrub-deep', '#9BC878', '#285258', 0.016),
      ornamentalGrassGeo: oGrassGeo,
      ornamentalGrassMat: oGrassMat,
      lavenderSpikeGeo: lavSpikeGeo,
      lavenderSpikeMat: lavSpikeMat,
      whiteWildflowerMat: new THREE.MeshStandardMaterial({ color: '#FFFDF5', roughness: 0.84 }),
      yellowWildflowerMat: new THREE.MeshStandardMaterial({ color: '#F6D65E', roughness: 0.78 }),
      wildflowerCoreMat: new THREE.MeshStandardMaterial({ color: '#E8B646', roughness: 0.78 }),
      strawberryMat: new THREE.MeshStandardMaterial({ color: '#E43E4B', roughness: 0.44 }),
      trunkBarkMat: new THREE.MeshStandardMaterial({ color: '#6E4C34', roughness: 0.92 }),
      oliveBarkMat: new THREE.MeshStandardMaterial({ color: '#867866', roughness: 0.94 }),
      hydrangeaMats: {
        pink: new THREE.MeshStandardMaterial({ color: '#F39EB8', roughness: 0.78 }),
        blue: new THREE.MeshStandardMaterial({ color: '#9BBCEE', roughness: 0.78 }),
        lavender: new THREE.MeshStandardMaterial({ color: '#BEB6F0', roughness: 0.78 }),
        cream: new THREE.MeshStandardMaterial({ color: '#FAF3E4', roughness: 0.80 }),
      },
      lavenderBloomMat: new THREE.MeshStandardMaterial({ color: '#8E6FD6', roughness: 0.84 }),
      ironMat: new THREE.MeshStandardMaterial({ color: '#3D2B1F', metalness: 0.45, roughness: 0.52 }),
      brassMat: new THREE.MeshStandardMaterial({ color: '#C6994E', metalness: 0.56, roughness: 0.38 }),
      paths: [southCurved.pathGeo, eastCurved.pathGeo, rightHillPath.pathGeo],
      southPathCurve: southCurved.curve,
      canopyPuffGeo: createVolumetricCanopyPuffGeometry(),
    };
  }, [craftAssets.painterlyCanopyTex, timberPbr, windTimeUniform]);

  useEffect(() => {
    return () => {
      gravelTex.dispose();
      gravelMat.dispose();
      flagstoneGeo.dispose();
      flagstoneMat.dispose();
      borderStoneMat.dispose();
      limestoneMat.dispose();
      weatheredTimberMat.dispose();
      soilMat.dispose();
      sageBenchMat.dispose();
      terracottaRoofMat.dispose();
      farmPlasterMat.dispose();
      oliveToonMat.dispose();
      foliageBorderMat.dispose();
      cypressToonMat.dispose();
      forestWallToonMat.dispose();
      hillShrubLightMat.dispose();
      hillShrubMidMat.dispose();
      hillShrubDeepMat.dispose();
      ornamentalGrassGeo.dispose();
      ornamentalGrassMat.dispose();
      lavenderSpikeGeo.dispose();
      lavenderSpikeMat.dispose();
      whiteWildflowerMat.dispose();
      yellowWildflowerMat.dispose();
      wildflowerCoreMat.dispose();
      strawberryMat.dispose();
      trunkBarkMat.dispose();
      oliveBarkMat.dispose();
      Object.values(hydrangeaMats).forEach((m) => m.dispose());
      lavenderBloomMat.dispose();
      ironMat.dispose();
      brassMat.dispose();
      canopyPuffGeo.dispose();
      paths.forEach((g) => g.dispose());
      timberPbr.map.dispose();
      timberPbr.bumpMap.dispose();
      timberPbr.roughnessMap.dispose();
    };
  }, [
    gravelTex,
    gravelMat,
    flagstoneGeo,
    flagstoneMat,
    borderStoneMat,
    limestoneMat,
    weatheredTimberMat,
    soilMat,
    sageBenchMat,
    terracottaRoofMat,
    farmPlasterMat,
    oliveToonMat,
    foliageBorderMat,
    cypressToonMat,
    forestWallToonMat,
    hillShrubLightMat,
    hillShrubMidMat,
    hillShrubDeepMat,
    ornamentalGrassGeo,
    ornamentalGrassMat,
    lavenderSpikeGeo,
    lavenderSpikeMat,
    whiteWildflowerMat,
    yellowWildflowerMat,
    wildflowerCoreMat,
    strawberryMat,
    trunkBarkMat,
    oliveBarkMat,
    hydrangeaMats,
    lavenderBloomMat,
    ironMat,
    brassMat,
    canopyPuffGeo,
    paths,
    timberPbr,
  ]);

  // InstancedMesh Refs
  const pathBorderStoneRef = useRef<THREE.InstancedMesh>(null);
  const ornamentalGrassRef = useRef<THREE.InstancedMesh>(null);
  const cloverWhiteRef = useRef<THREE.InstancedMesh>(null);
  const wildYellowRef = useRef<THREE.InstancedMesh>(null);
  const naturalLavenderLeafRef = useRef<THREE.InstancedMesh>(null);
  const naturalLavenderSpikeRef = useRef<THREE.InstancedMesh>(null);
  const wallTrunkRef = useRef<THREE.InstancedMesh>(null);
  const wallBroadleafRef = useRef<THREE.InstancedMesh>(null);
  const wallCypressRef = useRef<THREE.InstancedMesh>(null);
  const hillShrubLightRef = useRef<THREE.InstancedMesh>(null);
  const hillShrubMidRef = useRef<THREE.InstancedMesh>(null);
  const hillShrubDeepRef = useRef<THREE.InstancedMesh>(null);
  const hillWhiteBloomRef = useRef<THREE.InstancedMesh>(null);
  const hillWhiteCoreRef = useRef<THREE.InstancedMesh>(null);

  // 沿弯曲碎石小径排布 11 块自然大小错落的青石板踏步（拉开呼吸感，告别规整灰饼干排队）
  const steppingSlabs = useMemo(() => {
    const out: Array<{ pos: [number, number, number]; rotY: number; sx: number; sz: number; col: string }> = [];
    const palette = ['#8E9692', '#9BA096', '#838C89', '#A3A398'];
    const count = 11;
    for (let i = 0; i < count; i++) {
      const t = 0.04 + (i / (count - 1)) * 0.92;
      const pt = southPathCurve.getPointAt(t);
      const tan = southPathCurve.getTangentAt(t);
      const yaw = Math.atan2(tan.x, tan.z) + Math.sin(i * 2.7) * 0.36;
      const jitterX = Math.sin(i * 2.1) * 0.14;
      const px = pt.x + jitterX;
      const pz = pt.z;
      const py = sampleGhibliTerrainHeight(px, pz) + 0.018;
      out.push({
        pos: [px, py, pz],
        rotY: yaw,
        sx: 0.78 + (i % 3) * 0.24,
        sz: 0.72 + ((i + 1) % 3) * 0.22,
        col: palette[i % palette.length],
      });
    }
    return out;
  }, [southPathCurve]);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let rng = 20261123;
    const rand = () => {
      rng = (rng * 1664525 + 1013904223) >>> 0;
      return rng / 4294967296;
    };

    // 1. 小径两侧半埋入土的错落自然石块镶边（大小错落深埋半截，不再像土豆队列）
    const stInst = pathBorderStoneRef.current;
    if (stInst) {
      const up = new THREE.Vector3(0, 1, 0);
      let idx = 0;
      const stoneCols = [0xd4cab6, 0xc7bea9, 0xded5c4, 0xbab29f];
      for (let i = 0; i < 38 && idx < 76; i++) {
        const t = (i + 0.3) / 38;
        const pt = southPathCurve.getPointAt(t);
        const tan = southPathCurve.getTangentAt(t).normalize();
        const side = new THREE.Vector3().crossVectors(up, tan).normalize();
        for (const sgn of [-1, 1]) {
          const dist = 0.68 + (rand() - 0.5) * 0.22;
          const sx = pt.x + side.x * sgn * dist;
          const sz = pt.z + side.z * sgn * dist;
          const sy = sampleGhibliTerrainHeight(sx, sz);
          const ryScale = 0.045 + rand() * 0.035;
          dummy.position.set(sx, sy + ryScale * 0.25, sz);
          dummy.rotation.set((rand() - 0.5) * 0.28, rand() * Math.PI * 2, (rand() - 0.5) * 0.28);
          dummy.scale.set(0.08 + rand() * 0.11, ryScale, 0.07 + rand() * 0.09);
          dummy.updateMatrix();
          stInst.setMatrixAt(idx, dummy.matrix);
          color.setHex(stoneCols[idx % stoneCols.length]);
          stInst.setColorAt(idx, color);
          idx++;
        }
      }
      stInst.instanceMatrix.needsUpdate = true;
      if (stInst.instanceColor) stInst.instanceColor.needsUpdate = true;
    }

    // 2. 秩序整齐、成团收敛的真·薰衣草边框带（精简掉小径边散插乱草，保留 180 株紧凑贴地花境）
    const lavLeaf = naturalLavenderLeafRef.current;
    const lavSpike = naturalLavenderSpikeRef.current;
    if (lavLeaf && lavSpike) {
      const drifts: Array<{ cx: number; cz: number; rx: number; rz: number; n: number }> = [
        { cx: 2.25, cz: 13.6, rx: 0.72, rz: 0.95, n: 22 },
        { cx: -1.15, cz: 13.8, rx: 0.68, rz: 0.85, n: 22 },
        { cx: 2.38, cz: 17.8, rx: 0.78, rz: 0.95, n: 22 },
        { cx: -1.45, cz: 20.6, rx: 0.85, rz: 0.95, n: 24 },
      ];
      let li = 0;
      let si = 0;
      drifts.forEach((d) => {
        for (let k = 0; k < d.n && li < 180; k++) {
          const ang = rand() * Math.PI * 2;
          const rr = Math.sqrt(rand());
          const lx = d.cx + Math.cos(ang) * d.rx * rr;
          const lz = d.cz + Math.sin(ang) * d.rz * rr;
          const ly = sampleGhibliTerrainHeight(lx, lz);
          const sc = 0.56 + rand() * 0.30;
          dummy.position.set(lx, ly + 0.04 * sc, lz);
          dummy.rotation.set(0, rand() * Math.PI * 2, 0);
          dummy.scale.set(0.14 * sc, 0.08 * sc, 0.14 * sc);
          dummy.updateMatrix();
          lavLeaf.setMatrixAt(li++, dummy.matrix);

          for (let sp = 0; sp < 2 && si < 360; sp++) {
            dummy.position.set(lx + (rand() - 0.5) * 0.09, ly + 0.015, lz + (rand() - 0.5) * 0.09);
            dummy.rotation.set((rand() - 0.5) * 0.14, rand() * Math.PI * 2, (rand() - 0.5) * 0.14);
            const hSc = (0.78 + rand() * 0.28) * sc;
            dummy.scale.set(0.90 * sc, hSc, 0.90 * sc);
            dummy.updateMatrix();
            lavSpike.setMatrixAt(si++, dummy.matrix);
          }
        }
      });
      dummy.position.set(0, -40, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      for (; li < 180; li++) lavLeaf.setMatrixAt(li, dummy.matrix);
      for (; si < 360; si++) lavSpike.setMatrixAt(si, dummy.matrix);
      lavLeaf.instanceMatrix.needsUpdate = true;
      lavSpike.instanceMatrix.needsUpdate = true;
    }

    // 3. 彻底清空右侧大面积水稻状高杂草，仅保留 36 簇矮化细腻点缀草靠近远山林缘石墙
    const ogInst = ornamentalGrassRef.current;
    if (ogInst) {
      const grassCenters: Array<[number, number, number, number]> = [
        [2.25, 22.8, 0.85, 12],
        [-2.85, 23.6, 0.95, 12],
        [-8.6, 20.5, 1.10, 12],
      ];
      let gi = 0;
      grassCenters.forEach(([cx, cz, rad, cnt]) => {
        for (let k = 0; k < cnt && gi < 160; k++) {
          const a = rand() * Math.PI * 2;
          const r = Math.sqrt(rand()) * rad;
          const gx = cx + Math.cos(a) * r;
          const gz = cz + Math.sin(a) * r;
          const gy = sampleGhibliTerrainHeight(gx, gz);
          const sc = 0.52 + rand() * 0.24;
          dummy.position.set(gx, gy - 0.01, gz);
          dummy.rotation.set(0, rand() * Math.PI * 2, 0);
          dummy.scale.set(sc * 0.85, sc * 0.65, sc * 0.85);
          dummy.updateMatrix();
          ogInst.setMatrixAt(gi++, dummy.matrix);
        }
      });
      dummy.position.set(0, -40, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      for (; gi < 160; gi++) ogInst.setMatrixAt(gi, dummy.matrix);
      ogInst.instanceMatrix.needsUpdate = true;
    }

    // 4. 克制干净的白三叶草（180 簇）与黄色小野花（120 簇）团块地被（清理右侧长椅旁过多杂花碎点！）
    const cwInst = cloverWhiteRef.current;
    const ywInst = wildYellowRef.current;
    if (cwInst && ywInst) {
      const patches: Array<[number, number, number, number]> = [
        [2.0, 11.8, 1.5, 34],
        [-1.3, 12.6, 1.5, 30],
        [2.4, 16.2, 1.6, 36],
        [-6.4, 21.8, 2.2, 34],
        [-3.4, 21.8, 2.0, 28],
        [3.8, 19.8, 2.0, 28],
        // 补足左侧宴会/甜品推车周围大草坡地被（打破空白绿塑料板感）
        [9.8, 13.6, 2.4, 42],
        [11.6, 17.8, 2.6, 42],
      ];
      let ci = 0;
      let yi = 0;
      patches.forEach(([cx, cz, rad, cnt]) => {
        for (let k = 0; k < cnt; k++) {
          const a = rand() * Math.PI * 2;
          const r = Math.sqrt(rand()) * rad;
          const fx = cx + Math.cos(a) * r;
          const fz = cz + Math.sin(a) * r;
          // 避开弯曲小径中心
          if (Math.abs(fx - 0.6) < 0.72 && fz > 10.5 && fz < 19.4) continue;
          const fy = sampleGhibliTerrainHeight(fx, fz);
          const isWhite = k % 5 < 3;
          const sc = 0.042 + rand() * 0.045;
          dummy.position.set(fx, fy + sc * 0.75, fz);
          dummy.rotation.set(0, rand() * Math.PI * 2, 0);
          dummy.scale.set(sc * 1.35, sc * 0.62, sc * 1.35);
          dummy.updateMatrix();
          if (isWhite && ci < 240) cwInst.setMatrixAt(ci++, dummy.matrix);
          else if (!isWhite && yi < 180) ywInst.setMatrixAt(yi++, dummy.matrix);
        }
      });
      dummy.position.set(0, -40, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      for (; ci < 240; ci++) cwInst.setMatrixAt(ci, dummy.matrix);
      for (; yi < 180; yi++) ywInst.setMatrixAt(yi, dummy.matrix);
      cwInst.instanceMatrix.needsUpdate = true;
      ywInst.instanceMatrix.needsUpdate = true;
    }

    // 5. 加密背景森林树林墙（72 棵，精准避让南侧红瓦乡村小屋 [-4.8, 29.4] 与东侧风车视廊！）
    const tInst = wallTrunkRef.current;
    const bInst = wallBroadleafRef.current;
    const cInst = wallCypressRef.current;
    if (tInst && bInst && cInst) {
      const wallTrees: Array<{ x: number; z: number; sc: number; isCypress: boolean }> = [];
      for (let i = 0; i < 48; i++) {
        const frac = i / 47;
        const x = THREE.MathUtils.lerp(-25.0, 23.0, frac) + (rand() - 0.5) * 1.4;
        const tier = i % 3;
        const z = 27.5 + tier * 4.4 + (rand() - 0.5) * 1.6;
        // 精准避让南侧山坡红瓦乡村小屋 [-3.2, 27.6] 及其前方视廊！
        if (x > -7.2 && x < 0.4 && z > 22.8 && z < 34.0) continue;
        const isCypress = i % 3 === 1;
        const sc = 1.08 + rand() * 0.58 + tier * 0.16;
        wallTrees.push({ x, z, sc, isCypress });
      }
      for (let i = 0; i < 24; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const x = side * (17.8 + (i % 4) * 3.2 + rand() * 2.0);
        const z = -6.0 + (i / 23) * 34.0;
        if (Math.hypot(x - 24.5, z + 14.5) < 4.5) continue;
        if (x > 16.5 && z > -1.6 && z < 6.6) continue;
        wallTrees.push({ x, z, sc: 1.05 + rand() * 0.55, isCypress: i % 3 === 0 });
      }

      let bIdx = 0;
      let cIdx = 0;
      let tIdx = 0;
      wallTrees.forEach((tr, i) => {
        if (tIdx >= 72) return;
        const gy = sampleGhibliTerrainHeight(tr.x, tr.z) - 0.12;
        dummy.position.set(tr.x, gy + (tr.isCypress ? 1.15 : 1.35) * tr.sc, tr.z);
        dummy.rotation.set(0, i * 0.85, 0);
        dummy.scale.set(
          (tr.isCypress ? 0.10 : 0.20) * tr.sc,
          (tr.isCypress ? 2.3 : 2.7) * tr.sc,
          (tr.isCypress ? 0.10 : 0.20) * tr.sc
        );
        dummy.updateMatrix();
        tInst.setMatrixAt(tIdx++, dummy.matrix);

        if (tr.isCypress) {
          const tiers: Array<[number, number, number]> = [
            [1.8, 0.55, 1.35],
            [3.0, 0.46, 1.32],
            [4.1, 0.36, 1.24],
            [5.1, 0.22, 1.05],
          ];
          tiers.forEach(([hy, r, sy], k) => {
            if (cIdx >= 160) return;
            dummy.position.set(tr.x + (k % 2 === 0 ? 0.05 : -0.05), gy + hy * tr.sc, tr.z);
            dummy.rotation.set(0, rand() * Math.PI * 2, 0);
            dummy.scale.set(r * tr.sc, sy * tr.sc, r * tr.sc);
            dummy.updateMatrix();
            cInst.setMatrixAt(cIdx++, dummy.matrix);
          });
        } else {
          const lobes: Array<[number, number, number, number]> = [
            [0, 3.15, 0, 1.75],
            [0.95, 2.55, 0.55, 1.32],
            [-0.88, 2.70, -0.48, 1.36],
          ];
          lobes.forEach(([ox, oy, oz, rad]) => {
            if (bIdx >= 180) return;
            dummy.position.set(tr.x + ox * tr.sc, gy + oy * tr.sc, tr.z + oz * tr.sc);
            dummy.rotation.set((rand() - 0.5) * 0.2, rand() * Math.PI * 2, (rand() - 0.5) * 0.2);
            dummy.scale.set(rad * tr.sc, rad * 0.82 * tr.sc, rad * tr.sc);
            dummy.updateMatrix();
            bInst.setMatrixAt(bIdx++, dummy.matrix);
          });
        }
      });
      dummy.position.set(0, -40, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      for (; tIdx < 72; tIdx++) tInst.setMatrixAt(tIdx, dummy.matrix);
      for (; bIdx < 180; bIdx++) bInst.setMatrixAt(bIdx, dummy.matrix);
      for (; cIdx < 160; cIdx++) cInst.setMatrixAt(cIdx, dummy.matrix);
      tInst.instanceMatrix.needsUpdate = true;
      bInst.instanceMatrix.needsUpdate = true;
      cInst.instanceMatrix.needsUpdate = true;
    }

    // 6. 保留东侧矮石墙后方远景山坡 3 排深浅灌木 + 白色野花带（不破坏东侧风塔视廊！）
    const slInst = hillShrubLightRef.current;
    const smInst = hillShrubMidRef.current;
    const sdInst = hillShrubDeepRef.current;
    const wfInst = hillWhiteBloomRef.current;
    const wcInst = hillWhiteCoreRef.current;
    const placeShrubRow = (
      inst: THREE.InstancedMesh | null,
      maxCount: number,
      baseX: number,
      zStart: number,
      zEnd: number,
      count: number,
      radMin: number,
      radMax: number,
      waveAmp: number
    ) => {
      if (!inst) return;
      let idx = 0;
      for (let i = 0; i < count && idx < maxCount; i++) {
        const frac = i / Math.max(1, count - 1);
        const z = THREE.MathUtils.lerp(zStart, zEnd, frac) + (rand() - 0.5) * 0.45;
        const x = baseX + Math.sin(frac * Math.PI * 3.2 + baseX) * waveAmp + (rand() - 0.5) * 0.55;
        if (Math.hypot(x - 25.8, z - 2.95) < 3.35) continue;
        const gy = sampleGhibliTerrainHeight(x, z);
        const rad = THREE.MathUtils.lerp(radMin, radMax, rand());
        const hScale = rad * (0.64 + rand() * 0.24);
        dummy.position.set(x, gy + hScale * 0.42, z);
        dummy.rotation.set((rand() - 0.5) * 0.14, rand() * Math.PI * 2, (rand() - 0.5) * 0.14);
        dummy.scale.set(rad * (0.95 + rand() * 0.28), hScale, rad * (0.95 + rand() * 0.28));
        dummy.updateMatrix();
        inst.setMatrixAt(idx++, dummy.matrix);
      }
      dummy.position.set(0, -40, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      for (; idx < maxCount; idx++) inst.setMatrixAt(idx, dummy.matrix);
      inst.instanceMatrix.needsUpdate = true;
    };
    placeShrubRow(slInst, 48, 18.6, -4.8, 8.8, 42, 0.52, 0.88, 0.65);
    placeShrubRow(smInst, 48, 21.6, -5.6, 9.6, 44, 0.68, 1.12, 0.85);
    placeShrubRow(sdInst, 52, 26.8, -6.5, 11.2, 48, 0.85, 1.42, 1.15);

    if (wfInst && wcInst) {
      const ribbons = [
        { baseX: 18.0, z0: -3.8, z1: 7.4, amp: 0.48, freq: 2.6, clusters: 78 },
        { baseX: 20.5, z0: -4.2, z1: 8.2, amp: 0.72, freq: 3.1, clusters: 86 },
        { baseX: 23.2, z0: -3.2, z1: 7.8, amp: 0.65, freq: 2.4, clusters: 76 },
      ];
      let fIdx = 0;
      ribbons.forEach((rb, rbi) => {
        for (let k = 0; k < rb.clusters && fIdx < 260; k++) {
          const t = k / Math.max(1, rb.clusters - 1);
          const z = THREE.MathUtils.lerp(rb.z0, rb.z1, t) + (rand() - 0.5) * 0.24;
          const x = rb.baseX + Math.sin(t * Math.PI * rb.freq + rbi * 1.4) * rb.amp + (rand() - 0.5) * 0.42;
          if (Math.hypot(x - 25.8, z - 2.95) < 3.1) continue;
          const gy = sampleGhibliTerrainHeight(x, z);
          const s = 0.085 + rand() * 0.075;
          dummy.position.set(x, gy + s * 0.85, z);
          dummy.rotation.set(0, rand() * Math.PI * 2, 0);
          dummy.scale.set(s * 1.28, s * 0.72, s * 1.28);
          dummy.updateMatrix();
          wfInst.setMatrixAt(fIdx, dummy.matrix);
          dummy.position.set(x, gy + s * 1.24, z);
          dummy.scale.set(s * 0.46, s * 0.34, s * 0.46);
          dummy.updateMatrix();
          wcInst.setMatrixAt(fIdx, dummy.matrix);
          fIdx++;
        }
      });
      dummy.position.set(0, -40, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      for (; fIdx < 260; fIdx++) {
        wfInst.setMatrixAt(fIdx, dummy.matrix);
        wcInst.setMatrixAt(fIdx, dummy.matrix);
      }
      wfInst.instanceMatrix.needsUpdate = true;
      wcInst.instanceMatrix.needsUpdate = true;
    }
  }, [southPathCurve]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    windTimeUniform.value = t;
    // 花藤木秋千随南法微风悠闲轻摆
    if (swingSeatRef.current) {
      swingSeatRef.current.rotation.x = Math.sin(t * 1.05) * 0.11 + Math.sin(t * 0.42) * 0.04;
    }
    // 长椅上打盹小猫柔和呼吸与摇尾
    if (benchCatBodyRef.current) {
      const br = Math.sin(t * 2.0 + 1.1);
      benchCatBodyRef.current.scale.set(1.0 + br * 0.025, 1.0 + br * 0.038, 1.0 + br * 0.02);
    }
    if (benchCatTailRef.current) {
      benchCatTailRef.current.rotation.y = Math.sin(t * 1.55 + 0.8) * 0.34;
    }
  });

  // 精简克制的高低绣球花团边界（清出右侧长椅与阶梯花床留白呼吸感，彻底告别乱草杂堆！）
  const hydrangeaBorders: Array<{ x: number; z: number; palette: Array<'pink' | 'blue' | 'lavender' | 'cream'>; sc: number }> =
    useMemo(
      () => [
        { x: -0.78, z: 13.7, palette: ['cream', 'pink', 'blue'], sc: 1.08 },
        { x: 2.15, z: 13.9, palette: ['pink', 'lavender', 'cream'], sc: 1.12 },
        { x: -1.15, z: 16.4, palette: ['blue', 'cream', 'pink'], sc: 1.12 },
        { x: 2.25, z: 16.9, palette: ['pink', 'cream', 'blue'], sc: 1.08 },
        { x: -1.65, z: 20.2, palette: ['pink', 'cream', 'blue'], sc: 1.18 },
        { x: 2.78, z: 20.1, palette: ['blue', 'pink', 'cream'], sc: 1.16 },
      ],
      []
    );

  // 5 棵银绿叶南法橄榄树（扭曲苍劲树干 + 柔和银绿树冠，拉升南法庄园调性！）
  const oliveTrees = useMemo(
    () =>
      [
        { x: 3.35, z: 13.6, s: 0.96, rot: 0.4 },
        { x: -2.45, z: 15.2, s: 1.05, rot: 1.6 },
        { x: 3.85, z: 19.8, s: 1.12, rot: 2.8 },
        { x: -3.15, z: 22.4, s: 1.02, rot: 4.1 },
        { x: -8.35, z: 14.8, s: 1.08, rot: 5.2 },
      ].map((t) => ({ ...t, y: sampleGhibliTerrainHeight(t.x, t.z) - 0.06 })),
    []
  );

  // 右侧斜坡秩序感 3 层平行阶梯原木花床（远离小径留足丝绒草坪留白，告别杂乱堆砌！）
  const terracedTimberBeds = useMemo(
    () =>
      [
        { x: -5.65, z: 15.2, rot: 0.16, w: 2.10, d: 0.86, h: 0.30, crop: 'strawberry' as const },
        { x: -6.55, z: 17.0, rot: 0.16, w: 2.25, d: 0.88, h: 0.36, crop: 'strawberry' as const },
        { x: -7.45, z: 18.8, rot: 0.16, w: 2.40, d: 0.90, h: 0.42, crop: 'strawberry' as const },
      ].map((b) => ({ ...b, y: sampleGhibliTerrainHeight(b.x, b.z) })),
    []
  );

  // 右侧大树下花藤木秋千、鼠尾草绿木长椅与远景乡村小屋坐标
  const swingPos = useMemo<[number, number, number]>(() => {
    const sx = -7.15;
    const sz = 15.25;
    return [sx, sampleGhibliTerrainHeight(sx, sz), sz];
  }, []);
  const benchPos = useMemo<[number, number, number]>(() => {
    const bx = -3.85;
    const bz = 18.45;
    return [bx, sampleGhibliTerrainHeight(bx, bz), bz];
  }, []);
  const farmhousePos = useMemo<[number, number, number]>(() => {
    const fx = -3.2;
    const fz = 27.6;
    return [fx, sampleGhibliTerrainHeight(fx, fz) + 0.24, fz];
  }, []);

  // 山坡中上部爬满藤蔓的法式石灰岩矮墙段（横贯白花亭右后方至右侧树林前方！）
  const hillsideWallSegs = useMemo(
    () =>
      [
        { x: -9.8, z: 24.4, rot: -0.18, len: 2.4 },
        { x: -7.5, z: 24.9, rot: -0.12, len: 2.4 },
        { x: -5.1, z: 25.3, rot: -0.06, len: 2.4 },
        { x: -2.7, z: 25.5, rot: 0.04, len: 2.4 },
        { x: -0.3, z: 25.4, rot: 0.10, len: 2.2 },
      ].map((s) => ({ ...s, y: sampleGhibliTerrainHeight(s.x, s.z) })),
    []
  );

  return (
    <group name="FrenchFormalManorGarden">
      {/* =====================================================================
          1. 自然 S 形弯曲浅米色法式碎石小径（带摇曳斑驳树影）+ 不规则青石板踏步 + 矮石块镶边
         ===================================================================== */}
      {paths.map((geo, idx) => (
        <mesh key={`curved-gravel-${idx}`} geometry={geo} material={gravelMat} receiveShadow />
      ))}
      {steppingSlabs.map((slab, si) => (
        <mesh
          key={`flagstone-step-${si}`}
          position={slab.pos}
          rotation={[0, slab.rotY, 0]}
          scale={[slab.sx, 1, slab.sz]}
          geometry={flagstoneGeo}
          receiveShadow
          castShadow
        >
          <meshStandardMaterial color={slab.col} roughness={0.88} metalness={0.02} />
        </mesh>
      ))}
      <instancedMesh ref={pathBorderStoneRef} args={[undefined, borderStoneMat, 76]} receiveShadow>
        <dodecahedronGeometry args={[1, 1]} />
      </instancedMesh>

      {/* =====================================================================
          2. 多层次法式混合花境：高细分饱满绣球花丛 + 真带茎薰衣草 + 观赏草 + 橄榄树
         ===================================================================== */}
      {hydrangeaBorders.map((h, idx) => {
        const hy = sampleGhibliTerrainHeight(h.x, h.z);
        return (
          <group key={`hydrangea-border-${idx}`} position={[h.x, hy, h.z]} scale={h.sc}>
            {/* 自然舒展多层叶丛基座（深埋地面 4cm 防露缝，多叠交错告别发光绿土豆！） */}
            <mesh position={[0, 0.15, 0]} scale={[0.52, 0.24, 0.46]} geometry={canopyPuffGeo} material={foliageBorderMat} receiveShadow />
            <mesh position={[0.26, 0.12, -0.14]} scale={[0.36, 0.18, 0.34]} geometry={canopyPuffGeo} material={foliageBorderMat} />
            <mesh position={[-0.24, 0.11, 0.16]} scale={[0.34, 0.17, 0.32]} geometry={canopyPuffGeo} material={foliageBorderMat} />
            {[
              [0.0, 0.34, 0.04, 0.19, h.palette[0]],
              [-0.22, 0.28, 0.14, 0.155, h.palette[1]],
              [0.24, 0.29, 0.08, 0.16, h.palette[2]],
              [-0.08, 0.30, -0.18, 0.15, h.palette[1]],
              [0.16, 0.25, -0.16, 0.14, h.palette[0]],
              [-0.28, 0.22, -0.05, 0.13, h.palette[2]],
            ].map(([bx, by, bz, br, colKey], bi) => (
              <mesh
                key={`hb-${bi}`}
                position={[bx as number, by as number, bz as number]}
                material={hydrangeaMats[colKey as 'pink' | 'blue' | 'lavender' | 'cream']}
                castShadow
              >
                <icosahedronGeometry args={[br as number, 2]} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* 带根绿茎与锥形花穗薰衣草丛（360 株零悬空） */}
      <instancedMesh ref={naturalLavenderLeafRef} args={[canopyPuffGeo, foliageBorderMat, 180]} />
      <instancedMesh ref={naturalLavenderSpikeRef} args={[lavenderSpikeGeo, lavenderSpikeMat, 360]} />

      {/* 风吹观赏草丛 + 白三叶与黄色小野花地被 */}
      <instancedMesh ref={ornamentalGrassRef} args={[ornamentalGrassGeo, ornamentalGrassMat, 160]} userData={{ excludeFromOutline: true }} />
      <instancedMesh ref={cloverWhiteRef} args={[undefined, whiteWildflowerMat, 240]} userData={{ excludeFromOutline: true }}>
        <dodecahedronGeometry args={[1, 0]} />
      </instancedMesh>
      <instancedMesh ref={wildYellowRef} args={[undefined, yellowWildflowerMat, 180]} userData={{ excludeFromOutline: true }}>
        <dodecahedronGeometry args={[1, 0]} />
      </instancedMesh>

      {/* 5 棵精致南法银绿叶橄榄树 */}
      {oliveTrees.map((ot, oi) => (
        <group key={`olive-tree-${oi}`} position={[ot.x, ot.y, ot.z]} rotation={[0, ot.rot, 0]} scale={ot.s}>
          {/* 苍劲微弯双叉橄榄树干 */}
          <mesh position={[0, 0.85, 0]} rotation={[0.08, 0, -0.10]} material={oliveBarkMat} castShadow receiveShadow>
            <cylinderGeometry args={[0.10, 0.18, 1.75, 10]} />
          </mesh>
          <mesh position={[0.24, 1.55, 0.12]} rotation={[0.22, 0.3, -0.45]} material={oliveBarkMat} castShadow>
            <cylinderGeometry args={[0.055, 0.09, 0.95, 8]} />
          </mesh>
          <mesh position={[-0.22, 1.50, -0.10]} rotation={[-0.18, -0.2, 0.42]} material={oliveBarkMat} castShadow>
            <cylinderGeometry args={[0.055, 0.09, 0.90, 8]} />
          </mesh>
          {/* 轻盈错落的银绿橄榄叶云团 */}
          {[
            [0.0, 2.25, 0.0, 0.96, 0.62],
            [0.58, 1.98, 0.32, 0.72, 0.50],
            [-0.56, 2.02, -0.22, 0.74, 0.52],
            [0.14, 2.55, -0.28, 0.64, 0.46],
          ].map(([cx, cy, cz, cr, cyS], ci) => (
            <mesh
              key={`ol-${ci}`}
              position={[cx, cy, cz]}
              scale={[cr, cyS, cr]}
              geometry={canopyPuffGeo}
              material={oliveToonMat}
              castShadow
              userData={{ excludeFromOutline: true }}
            />
          ))}
        </group>
      ))}

      {/* =====================================================================
          3. 填补右侧大树下光秃斜坡：3 层做旧原木阶梯花坛 + 花藤木秋千 + 鼠尾草绿木长椅与打盹小猫！
         ===================================================================== */}
      {terracedTimberBeds.map((bed, bi) => (
        <group key={`timber-terrace-${bi}`} position={[bed.x, bed.y, bed.z]} rotation={[0, bed.rot, 0]}>
          {/* 做旧原木阶梯围框与四角立桩 */}
          <mesh position={[0, bed.h * 0.5, bed.d * 0.5]} material={weatheredTimberMat} castShadow receiveShadow>
            <boxGeometry args={[bed.w, bed.h, 0.085]} />
          </mesh>
          <mesh position={[0, bed.h * 0.5, -bed.d * 0.5]} material={weatheredTimberMat} castShadow receiveShadow>
            <boxGeometry args={[bed.w, bed.h, 0.085]} />
          </mesh>
          <mesh position={[bed.w * 0.5, bed.h * 0.5, 0]} material={weatheredTimberMat} castShadow receiveShadow>
            <boxGeometry args={[0.085, bed.h, bed.d]} />
          </mesh>
          <mesh position={[-bed.w * 0.5, bed.h * 0.5, 0]} material={weatheredTimberMat} castShadow receiveShadow>
            <boxGeometry args={[0.085, bed.h, bed.d]} />
          </mesh>
          {[-bed.w * 0.48, 0, bed.w * 0.48].map((px, pi) =>
            [-bed.d * 0.48, bed.d * 0.48].map((pz, pj) => (
              <mesh key={`tp-${pi}-${pj}`} position={[px, bed.h * 0.54, pz]} material={trunkBarkMat} castShadow>
                <cylinderGeometry args={[0.055, 0.062, bed.h + 0.08, 8]} />
              </mesh>
            ))
          )}
          {/* 加深斜坡地基立柱与围挡，严实扎入右山坡土壤零浮角 */}
          <mesh position={[0, -0.08, 0]} material={soilMat}>
            <boxGeometry args={[bed.w - 0.04, 0.28, bed.d - 0.04]} />
          </mesh>
          {/* 肥沃暗棕花坛松土 */}
          <mesh position={[0, bed.h - 0.06, 0]} material={soilMat} receiveShadow>
            <boxGeometry args={[bed.w - 0.10, 0.08, bed.d - 0.10]} />
          </mesh>
          {/* 阶梯花坛作物：舒展多叶草莓藤簇与扎根带茎真薰衣草（告别绿面包团插紫香棒！） */}
          {Array.from({ length: 6 }).map((_, ci) => {
            const cx = -bed.w * 0.38 + (ci / 5) * (bed.w * 0.76);
            const cz = (ci % 2 === 0 ? 1 : -1) * 0.16;
            const isStrawberry = bed.crop === 'strawberry' || (bed.crop === 'mixed' && ci % 2 === 0);
            return (
              <group key={`crop-${ci}`} position={[cx, bed.h - 0.02, cz]}>
                <mesh position={[0, 0.08, 0]} scale={[0.18, 0.10, 0.17]} geometry={canopyPuffGeo} material={foliageBorderMat} />
                <mesh position={[0.09, 0.06, 0.05]} scale={[0.13, 0.08, 0.13]} geometry={canopyPuffGeo} material={foliageBorderMat} />
                {isStrawberry ? (
                  <>
                    {[
                      [0.10, 0.06, 0.11],
                      [-0.08, 0.08, 0.09],
                      [0.03, 0.10, -0.08],
                    ].map(([sx, sy, sz], si) => (
                      <mesh key={`sb-${si}`} position={[sx, sy, sz]} rotation={[0.4, si * 1.4, 0.2]} material={strawberryMat}>
                        <coneGeometry args={[0.024, 0.048, 8]} />
                      </mesh>
                    ))}
                    <mesh position={[0, 0.14, 0.04]} material={whiteWildflowerMat}>
                      <sphereGeometry args={[0.018, 6, 6]} />
                    </mesh>
                  </>
                ) : (
                  <mesh geometry={lavenderSpikeGeo} material={lavenderSpikeMat} position={[0, 0.02, 0]} scale={1.15} />
                )}
              </group>
            );
          })}
        </group>
      ))}

      {/* 两棵右侧大树之间的花藤木秋千（微风轻摆 + 满缠粉色蔷薇与青藤！） */}
      <group position={swingPos} rotation={[0, 0.34, 0]}>
        {/* 做旧原木 A 形林间树架与顶横梁 */}
        {[-1.12, 1.12].map((sx, si) => (
          <group key={`sw-leg-${si}`} position={[sx, 0, 0]}>
            <mesh position={[0, 1.32, -0.34]} rotation={[0.24, 0, 0]} material={weatheredTimberMat} castShadow>
              <cylinderGeometry args={[0.065, 0.085, 2.75, 10]} />
            </mesh>
            <mesh position={[0, 1.32, 0.34]} rotation={[-0.24, 0, 0]} material={weatheredTimberMat} castShadow>
              <cylinderGeometry args={[0.065, 0.085, 2.75, 10]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 2.60, 0]} rotation={[0, 0, Math.PI / 2]} material={weatheredTimberMat} castShadow>
          <cylinderGeometry args={[0.075, 0.075, 2.75, 12]} />
        </mesh>
        {/* 横梁垂挂的浪漫粉色蔷薇与常春藤花环 */}
        {[-0.88, -0.45, 0.0, 0.45, 0.88].map((vx, vi) => (
          <group key={`sw-vine-${vi}`} position={[vx, 2.62, 0.05]}>
            <mesh scale={[0.26, 0.18, 0.22]} geometry={canopyPuffGeo} material={foliageBorderMat} castShadow />
            <mesh position={[0.04, 0.06, 0.08]} material={hydrangeaMats.pink}>
              <icosahedronGeometry args={[0.075, 1]} />
            </mesh>
            <mesh position={[-0.06, -0.04, 0.06]} material={hydrangeaMats.cream}>
              <icosahedronGeometry args={[0.06, 1]} />
            </mesh>
          </group>
        ))}
        {/* 微风轻摆的秋千双麻绳 + 花藤缠绳 + 原木坐板 */}
        <group ref={swingSeatRef} position={[0, 2.58, 0]}>
          {[-0.48, 0.48].map((rx, ri) => (
            <group key={`sw-rope-${ri}`} position={[rx, 0, 0]}>
              <mesh position={[0, -0.94, 0]} material={limestoneMat} castShadow>
                <cylinderGeometry args={[0.014, 0.014, 1.88, 8]} />
              </mesh>
              {[-0.38, -0.82, -1.26, -1.62].map((ry, rj) => (
                <group key={`rv-${rj}`} position={[0, ry, 0]}>
                  <mesh scale={[0.09, 0.07, 0.09]} geometry={canopyPuffGeo} material={foliageBorderMat} />
                  {rj % 2 === 0 && (
                    <mesh position={[0.04 * (ri === 0 ? -1 : 1), 0.01, 0.03]} material={hydrangeaMats.pink}>
                      <sphereGeometry args={[0.038, 8, 6]} />
                    </mesh>
                  )}
                </group>
              ))}
            </group>
          ))}
          <mesh position={[0, -1.88, 0]} material={weatheredTimberMat} castShadow receiveShadow>
            <boxGeometry args={[1.18, 0.065, 0.42]} />
          </mesh>
          {/* 秋千坐板上的柔暖奶油坐垫 */}
          <mesh position={[0, -1.83, 0]} castShadow>
            <boxGeometry args={[0.92, 0.055, 0.34]} />
            <meshStandardMaterial color="#FAF1E0" roughness={0.88} />
          </mesh>
        </group>
      </group>

      {/* 大树下的鼠尾草绿法式木长椅（带整洁平整石灰石板地台，彻底清走杂草碎花！） + 蜷缩打盹的奶油橘白小猫咪 */}
      <group position={benchPos} rotation={[0, -0.32, 0]}>
        {/* 深埋山坡的整洁青石板长椅露台底座 */}
        <mesh position={[0, -0.05, 0.05]} material={limestoneMat} receiveShadow castShadow>
          <boxGeometry args={[2.18, 0.18, 1.16]} />
        </mesh>
        {/* 椅腿与扶手 */}
        {[-0.74, 0.74].map((lx, li) => (
          <group key={`b-leg-${li}`} position={[lx, 0, 0]}>
            <mesh position={[0, 0.24, 0.22]} material={sageBenchMat} castShadow>
              <boxGeometry args={[0.065, 0.48, 0.065]} />
            </mesh>
            <mesh position={[0, 0.48, -0.22]} material={sageBenchMat} castShadow>
              <boxGeometry args={[0.065, 0.96, 0.065]} />
            </mesh>
            <mesh position={[0, 0.62, 0.0]} material={sageBenchMat} castShadow>
              <boxGeometry args={[0.068, 0.052, 0.52]} />
            </mesh>
          </group>
        ))}
        {/* 坐面木条与格栅靠背 */}
        {[-0.14, 0.0, 0.14].map((sz, si) => (
          <mesh key={`bs-${si}`} position={[0, 0.46, sz]} material={sageBenchMat} castShadow receiveShadow>
            <boxGeometry args={[1.62, 0.042, 0.11]} />
          </mesh>
        ))}
        <mesh position={[0, 0.92, -0.22]} material={sageBenchMat} castShadow>
          <boxGeometry args={[1.62, 0.058, 0.055]} />
        </mesh>
        <mesh position={[0, 0.58, -0.22]} material={sageBenchMat} castShadow>
          <boxGeometry args={[1.56, 0.042, 0.045]} />
        </mesh>
        {[-0.60, -0.40, -0.20, 0.0, 0.20, 0.40, 0.60].map((kx, ki) => (
          <mesh key={`bk-${ki}`} position={[kx, 0.75, -0.22]} material={sageBenchMat} castShadow>
            <boxGeometry args={[0.036, 0.34, 0.030]} />
          </mesh>
        ))}
        {/* 长椅左侧田园抱枕 */}
        <mesh position={[-0.48, 0.60, -0.06]} rotation={[0.22, 0.28, -0.12]} scale={[1.0, 0.95, 0.45]} castShadow>
          <sphereGeometry args={[0.16, 14, 12]} />
          <meshStandardMaterial color="#F6E9D6" roughness={0.90} />
        </mesh>
        {/* 长椅右侧打盹呼吸摇尾的奶油橘白小猫咪 */}
        <group position={[0.38, 0.49, 0.02]} rotation={[0, -0.55, 0]}>
          <group ref={benchCatBodyRef}>
            <mesh position={[0, 0.09, 0]} scale={[1.18, 0.78, 0.95]} castShadow>
              <sphereGeometry args={[0.13, 14, 10]} />
              <meshStandardMaterial color="#EB8C40" roughness={0.82} />
            </mesh>
            <mesh position={[0.04, 0.068, 0.08]} scale={[0.90, 0.65, 0.70]}>
              <sphereGeometry args={[0.10, 12, 10]} />
              <meshStandardMaterial color="#FFF7EA" roughness={0.84} />
            </mesh>
            <group position={[0.105, 0.14, 0.075]} rotation={[0.20, 0.32, -0.12]}>
              <mesh castShadow>
                <sphereGeometry args={[0.085, 14, 10]} />
                <meshStandardMaterial color="#EC8E42" roughness={0.80} />
              </mesh>
              <mesh position={[0, -0.024, 0.054]} scale={[1.1, 0.7, 0.7]}>
                <sphereGeometry args={[0.048, 10, 8]} />
                <meshStandardMaterial color="#FFF8EE" roughness={0.82} />
              </mesh>
              {[-0.048, 0.048].map((ex, ei) => (
                <mesh key={`ce-${ei}`} position={[ex, 0.068, 0]} rotation={[0.1, 0, ei === 0 ? 0.30 : -0.30]} castShadow>
                  <coneGeometry args={[0.030, 0.065, 4]} />
                  <meshStandardMaterial color="#E68236" roughness={0.82} />
                </mesh>
              ))}
            </group>
          </group>
          <group ref={benchCatTailRef} position={[-0.11, 0.052, -0.03]}>
            <mesh position={[-0.055, 0.01, 0.045]} rotation={[0.2, 0.7, 1.32]} castShadow>
              <capsuleGeometry args={[0.021, 0.14, 6, 10]} />
              <meshStandardMaterial color="#E88438" roughness={0.82} />
            </mesh>
            <mesh position={[-0.11, 0.02, 0.10]}>
              <sphereGeometry args={[0.024, 8, 6]} />
              <meshStandardMaterial color="#FFF8EE" roughness={0.84} />
            </mesh>
          </group>
        </group>
      </group>

      {/* =====================================================================
          4. 远景庄园建筑：山坡中上部爬满藤蔓的法式石灰岩矮墙 + 赤陶红瓦烟囱南法乡村小屋！
         ===================================================================== */}
      {hillsideWallSegs.map((ws, wi) => (
        <group key={`hill-stone-wall-${wi}`} position={[ws.x, ws.y, ws.z]} rotation={[0, ws.rot, 0]}>
          <mesh position={[0, 0.42, 0]} material={limestoneMat} castShadow receiveShadow>
            <boxGeometry args={[ws.len, 0.88, 0.42]} />
          </mesh>
          <mesh position={[0, 0.89, 0]} material={borderStoneMat} castShadow receiveShadow>
            <boxGeometry args={[ws.len + 0.08, 0.08, 0.48]} />
          </mesh>
          {/* 石墙顶端与前立面自然垂挂缠绕的青藤与粉白蔷薇 */}
          {[-0.75, 0.0, 0.75].map((vx, vi) => (
            <group key={`wv-${vi}`} position={[vx, 0.76 - (vi % 2) * 0.14, -0.22]}>
              <mesh scale={[0.38, 0.30, 0.22]} geometry={canopyPuffGeo} material={foliageBorderMat} castShadow />
              <mesh position={[0.08, 0.06, -0.08]} material={vi % 2 === 0 ? hydrangeaMats.pink : hydrangeaMats.cream}>
                <icosahedronGeometry args={[0.08, 1]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* 矮墙后方山坡上的南法普罗旺斯吉卜力法式童话城堡庄园（卢瓦尔式青石蓝尖塔 + 双圆柱塔楼 + 锯齿雉堞 + 发光玫瑰花窗 + 零穿模！） */}
      <group position={farmhousePos} rotation={[0, Math.PI + 0.16, 0]} scale={1.12}>
        {/* 深埋坡地的双层城堡灰岩巨石台基 */}
        <mesh position={[0, -0.25, 0]} material={borderStoneMat} receiveShadow castShadow>
          <boxGeometry args={[6.40, 1.65, 4.10]} />
        </mesh>
        <mesh position={[0, 0.72, 0.10]} material={limestoneMat} receiveShadow castShadow>
          <boxGeometry args={[5.85, 0.34, 3.65]} />
        </mesh>
        {/* 城堡中央主宫殿主体（奶白石灰岩筑砌） */}
        <mesh position={[0, 2.25, -0.10]} material={farmPlasterMat} castShadow receiveShadow>
          <boxGeometry args={[3.85, 2.75, 2.70]} />
        </mesh>
        {/* 主宫殿斜铺青石蓝板岩人字主屋顶（整齐矩形坡板严密拟合，彻底消除刺出墙外的丑白三角刺！） */}
        <mesh position={[0, 4.02, 0.62]} rotation={[0.56, 0, 0]} castShadow>
          <boxGeometry args={[4.10, 0.14, 1.84]} />
          <meshStandardMaterial color="#586E88" roughness={0.78} />
        </mesh>
        <mesh position={[0, 4.02, -0.82]} rotation={[-0.56, 0, 0]} castShadow>
          <boxGeometry args={[4.10, 0.14, 1.84]} />
          <meshStandardMaterial color="#586E88" roughness={0.78} />
        </mesh>
        <mesh position={[0, 4.54, -0.10]} rotation={[0, 0, Math.PI / 2]} material={brassMat}>
          <cylinderGeometry args={[0.10, 0.10, 4.16, 10]} />
        </mesh>
        {/* 中央主殿高耸钟楼小尖塔 */}
        <group position={[0, 4.45, -0.10]}>
          <mesh position={[0, 0.45, 0]} material={farmPlasterMat} castShadow>
            <cylinderGeometry args={[0.56, 0.62, 1.15, 16]} />
          </mesh>
          <mesh position={[0, 1.48, 0]} castShadow>
            <coneGeometry args={[0.72, 1.28, 16]} />
            <meshStandardMaterial color="#4D647F" roughness={0.74} />
          </mesh>
          <mesh position={[0, 2.22, 0]} material={brassMat}>
            <sphereGeometry args={[0.09, 10, 8]} />
          </mesh>
          <mesh position={[0, 2.42, 0]} material={brassMat}>
            <cylinderGeometry args={[0.015, 0.028, 0.38, 8]} />
          </mesh>
        </group>
        {/* 主墙锯齿女墙雉堞装饰带 */}
        {[-1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5].map((cx, ci) => (
          <mesh key={`cren-${ci}`} position={[cx, 3.68, 1.24]} material={limestoneMat} castShadow>
            <boxGeometry args={[0.28, 0.26, 0.16]} />
          </mesh>
        ))}
        {/* 城堡偏后暖红砖壁炉烟囱与袅袅白烟 */}
        <mesh position={[1.18, 4.18, -0.35]} material={terracottaRoofMat} castShadow>
          <boxGeometry args={[0.42, 1.15, 0.42]} />
        </mesh>
        <mesh position={[1.18, 4.78, -0.35]} material={borderStoneMat}>
          <boxGeometry args={[0.50, 0.09, 0.50]} />
        </mesh>
        <CozyHanddrawnSteam
          position={[1.18, 4.86, -0.35]}
          puffCount={6}
          puffScale={0.44}
          riseHeight={2.5}
          spreadRadius={0.22}
          driftX={0.35}
          intensity={0.78}
          tint="#FFF9EE"
        />
        {/* 左右对称高耸法式圆柱双塔楼 + 蓝灰尖顶圆锥帽 + 金顶饰球 */}
        {[-2.28, 2.28].map((tx, ti) => (
          <group key={`castle-tower-${ti}`} position={[tx, 0.88, 0.25]}>
            <mesh position={[0, 0.52, 0]} material={borderStoneMat} castShadow receiveShadow>
              <cylinderGeometry args={[0.88, 0.98, 1.04, 18]} />
            </mesh>
            <mesh position={[0, 2.25, 0]} material={farmPlasterMat} castShadow receiveShadow>
              <cylinderGeometry args={[0.78, 0.86, 2.75, 18]} />
            </mesh>
            <mesh position={[0, 3.66, 0]} material={limestoneMat} castShadow>
              <cylinderGeometry args={[0.92, 0.80, 0.20, 18]} />
            </mesh>
            <mesh position={[0, 4.62, 0]} castShadow>
              <coneGeometry args={[1.02, 1.84, 18]} />
              <meshStandardMaterial color="#4F6682" roughness={0.74} />
            </mesh>
            <mesh position={[0, 5.60, 0]} material={brassMat}>
              <sphereGeometry args={[0.10, 10, 8]} />
            </mesh>
            <mesh position={[0, 5.82, 0]} material={brassMat}>
              <cylinderGeometry args={[0.015, 0.032, 0.36, 8]} />
            </mesh>
            {[1.65, 2.85].map((wy, wi) => (
              <group key={`tw-${wi}`} position={[0, wy, 0.80]}>
                <mesh material={weatheredTimberMat}>
                  <boxGeometry args={[0.34, 0.48, 0.05]} />
                </mesh>
                <mesh position={[0, 0, 0.03]}>
                  <planeGeometry args={[0.24, 0.38]} />
                  <meshStandardMaterial color="#FFEBA8" emissive="#FFB84A" emissiveIntensity={1.55} />
                </mesh>
              </group>
            ))}
          </group>
        ))}

        {/* 主宫殿暖灯拱窗 + 玫瑰圆窗 + 圆拱城门 + 双暖金灯笼 */}
        {[-0.95, 0.95].map((wx, wi) => (
          <group key={`cw-${wi}`} position={[wx, 2.52, 1.26]}>
            <mesh material={limestoneMat}>
              <boxGeometry args={[0.58, 0.82, 0.08]} />
            </mesh>
            <mesh position={[0, 0, 0.046]}>
              <planeGeometry args={[0.42, 0.66]} />
              <meshStandardMaterial color="#FFF0B8" emissive="#FFBA4C" emissiveIntensity={1.5} roughness={0.35} />
            </mesh>
            <mesh position={[0, 0.42, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.24, 0.24, 0.08, 12, 1, false, 0, Math.PI]} />
              <meshStandardMaterial color="#FFF0B8" emissive="#FFBA4C" emissiveIntensity={1.5} />
            </mesh>
          </group>
        ))}
        <group position={[0, 2.75, 1.28]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={limestoneMat}>
            <torusGeometry args={[0.36, 0.05, 8, 20]} />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <circleGeometry args={[0.34, 20]} />
            <meshStandardMaterial color="#FFF2C6" emissive="#FFC260" emissiveIntensity={1.75} />
          </mesh>
        </group>
        <group position={[0, 1.48, 1.28]}>
          <mesh position={[0, 0, 0]} material={weatheredTimberMat} castShadow>
            <boxGeometry args={[0.88, 1.18, 0.09]} />
          </mesh>
          <mesh position={[0, 0.59, 0]} rotation={[Math.PI / 2, 0, 0]} material={weatheredTimberMat}>
            <cylinderGeometry args={[0.44, 0.44, 0.09, 16, 1, false, 0, Math.PI]} />
          </mesh>
          {[-0.64, 0.64].map((lx, li) => (
            <mesh key={`cl-${li}`} position={[lx, 0.48, 0.14]}>
              <sphereGeometry args={[0.075, 10, 8]} />
              <meshStandardMaterial color="#FFF6D4" emissive="#FFB640" emissiveIntensity={1.9} />
            </mesh>
          ))}
        </group>
        <mesh position={[-1.45, 1.24, 1.38]} scale={[0.56, 0.48, 0.28]} geometry={canopyPuffGeo} material={foliageBorderMat} />
        <mesh position={[1.45, 1.24, 1.38]} scale={[0.56, 0.48, 0.28]} geometry={canopyPuffGeo} material={foliageBorderMat} />
      </group>

      {/* =====================================================================
          5. 保留白花亭左侧单一法式草坪下午茶阳伞露台
         ===================================================================== */}
      {[{ x: 4.35, z: 15.65, rot: -0.35, umbrellaCol: '#F7EFE0', trimCol: '#7B9B6F' }].map((patio, pi) => {
        const py = sampleGhibliTerrainHeight(patio.x, patio.z);
        return (
          <group key={`tea-patio-${pi}`} position={[patio.x, py, patio.z]} rotation={[0, patio.rot, 0]}>
            <mesh position={[0, 0.025, 0]} material={limestoneMat} receiveShadow castShadow>
              <cylinderGeometry args={[1.48, 1.54, 0.05, 24]} />
            </mesh>
            <mesh position={[0, 0.38, 0]} material={ironMat} castShadow>
              <cylinderGeometry args={[0.036, 0.055, 0.74, 12]} />
            </mesh>
            <mesh position={[0, 0.06, 0]} material={ironMat}>
              <cylinderGeometry args={[0.26, 0.32, 0.04, 12]} />
            </mesh>
            <mesh position={[0, 0.76, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.56, 0.62, 0.14, 24]} />
              <meshStandardMaterial color="#FAF3E5" roughness={0.88} />
            </mesh>
            <mesh position={[0, 1.38, 0]} material={brassMat} castShadow>
              <cylinderGeometry args={[0.026, 0.030, 2.55, 10]} />
            </mesh>
            <mesh position={[0, 2.46, 0]} castShadow>
              <coneGeometry args={[1.38, 0.44, 10]} />
              <meshStandardMaterial color={patio.umbrellaCol} roughness={0.86} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 2.19, 0]}>
              <cylinderGeometry args={[1.38, 1.40, 0.11, 10, 1, true]} />
              <meshStandardMaterial color={patio.trimCol} roughness={0.86} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 2.71, 0]} material={brassMat}>
              <sphereGeometry args={[0.045, 10, 8]} />
            </mesh>
            {[-0.92, 0.92].map((chx, chi) => (
              <group key={`tea-chair-${chi}`} position={[chx, 0.05, 0]} rotation={[0, chi === 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
                {/* 柔软亚麻坐垫 + 椅座铁圈围框 */}
                <mesh position={[0, 0.44, 0]} castShadow>
                  <cylinderGeometry args={[0.21, 0.20, 0.048, 16]} />
                  <meshStandardMaterial color="#FAF2E4" roughness={0.86} />
                </mesh>
                <mesh position={[0, 0.422, 0]} rotation={[Math.PI / 2, 0, 0]} material={ironMat}>
                  <torusGeometry args={[0.205, 0.012, 8, 18]} />
                </mesh>
                {/* 靠背圆环 + 左右两根焊实连接椅座的锻铁立柱（彻底消除黑圆环凭空悬空！） */}
                <mesh position={[0, 0.72, -0.19]} material={ironMat} castShadow>
                  <torusGeometry args={[0.18, 0.015, 8, 18]} />
                </mesh>
                {[-0.145, 0.145].map((bx, bi) => (
                  <mesh key={`ch-backpost-${bi}`} position={[bx, 0.56, -0.19]} material={ironMat} castShadow>
                    <cylinderGeometry args={[0.012, 0.012, 0.28, 8]} />
                  </mesh>
                ))}
                {/* 4 条微外撇铸铁椅腿与脚垫 */}
                {[
                  [-0.14, 0.21, -0.14, 0.08, -0.08],
                  [0.14, 0.21, -0.14, 0.08, 0.08],
                  [-0.14, 0.21, 0.14, -0.08, -0.08],
                  [0.14, 0.21, 0.14, -0.08, 0.08],
                ].map(([lx, ly, lz, rx, rz], li) => (
                  <group key={`cl-${li}`}>
                    <mesh position={[lx, ly, lz]} rotation={[rx, 0, rz]} material={ironMat} castShadow>
                      <cylinderGeometry args={[0.013, 0.011, 0.44, 8]} />
                    </mesh>
                    <mesh position={[lx * 1.12, 0.01, lz * 1.12]} material={ironMat}>
                      <cylinderGeometry args={[0.018, 0.020, 0.02, 8]} />
                    </mesh>
                  </group>
                ))}
              </group>
            ))}
          </group>
        );
      })}

      {/* =====================================================================
          6. 加密背景森林树林墙（关闭远景树墙阴影投射，剧降 Shadow Map 顶点开销，保留零描边屏蔽）
         ===================================================================== */}
      <instancedMesh ref={wallTrunkRef} args={[undefined, undefined, 72]} material={trunkBarkMat} userData={{ excludeFromOutline: true }}>
        <cylinderGeometry args={[0.55, 0.92, 1.0, 10]} />
      </instancedMesh>
      <instancedMesh
        ref={wallBroadleafRef}
        args={[canopyPuffGeo, forestWallToonMat, 180]}
        userData={{ excludeFromOutline: true }}
      />
      <instancedMesh
        ref={wallCypressRef}
        args={[canopyPuffGeo, cypressToonMat, 160]}
        userData={{ excludeFromOutline: true }}
      />

      {/* =====================================================================
          7. 东侧矮石墙后方远景山坡层次造景（3 排深浅层叠圆润灌木丛 + 蜿蜒白色野花带）
         ===================================================================== */}
      <instancedMesh ref={hillShrubLightRef} args={[canopyPuffGeo, hillShrubLightMat, 48]} receiveShadow userData={{ excludeFromOutline: true }} />
      <instancedMesh ref={hillShrubMidRef} args={[canopyPuffGeo, hillShrubMidMat, 48]} receiveShadow userData={{ excludeFromOutline: true }} />
      <instancedMesh ref={hillShrubDeepRef} args={[canopyPuffGeo, hillShrubDeepMat, 52]} receiveShadow userData={{ excludeFromOutline: true }} />
      <instancedMesh ref={hillWhiteBloomRef} args={[undefined, whiteWildflowerMat, 260]} receiveShadow userData={{ excludeFromOutline: true }}>
        <dodecahedronGeometry args={[1, 1]} />
      </instancedMesh>
      <instancedMesh ref={hillWhiteCoreRef} args={[undefined, wildflowerCoreMat, 260]} userData={{ excludeFromOutline: true }}>
        <sphereGeometry args={[1, 8, 6]} />
      </instancedMesh>
    </group>
  );
};

export default FrenchFormalManorGarden;
