import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  createBeveledBoxGeometry,
  createTerracottaPlanterGeometry,
} from '../../geometry/patisserieGeometry';
import {
  createButterflyWingGeometry,
  createVolumetricCanopyPuffGeometry,
  getCottageCraftAssets,
} from './cottageTexturesAndFlora';
import { createWoodGrainPbr } from '../props/cottageHighCraftPbr';
import {
  enhanceWithStylizedFoliageToon,
  sampleGhibliTerrainHeight,
} from '../../shaders/ghibliStylizedPipeline';
import { CozyHanddrawnSteam } from '../../shaders/stylizedCozyUpgrades';

/**
 * 《林间花房烘焙小屋》户外游戏级叙事造景与动态生灵包（Phase 14）：
 * 1. 南法香草种植角（左中景溪流对岸草坪）：两排木质高架种植箱（迷迭香/薰衣草/草莓苗）+
 *    倾倒的复古白铁皮洒水壶 + 堆叠红陶花盆 + 迷你木制手推独轮车（满载鲜摘草莓与香草）
 * 2. 远山坡顶法式乡村小风车农舍（红瓦屋顶+烟囱袅袅白烟+缓慢旋转四叶木风车）与 6 棵饱满红苹果/黄柠檬果树
 * 3. 天空蓬松手绘感 3D 积云与掠过天际的展翅白鸽剪影群
 * 4. 8 只扇翅飞舞的黄白色小蝴蝶与 4 只小蜜蜂
 * 5. 溪岸老橡木桩上打盹的橘白相间小猫咪（胸口呼吸起伏 + 悠闲摇尾巴）+ 复古鸟屋旁跳跃啄食的两只小麻雀
 */
export const ProvenceStorybookGarden: React.FC = () => {
  const craftAssets = useMemo(() => getCottageCraftAssets(), []);
  const timberPbr = useMemo(() => createWoodGrainPbr('#9B663B', '#623A1C', 913), []);
  const darkOakPbr = useMemo(() => createWoodGrainPbr('#764B2A', '#462814', 641), []);
  const windTimeUniform = useMemo(() => ({ value: 0 }), []);

  // 共享实体几何体与风格化材质（全部参与全屏 #3d2b1f 边缘检测手绘描边与阴影投射）
  const {
    bedPlankLongGeo,
    bedPlankShortGeo,
    potGeo,
    canopyPuffGeo,
    butterflyWingGeo,
    weatheredWoodMat,
    darkWoodMat,
    soilMat,
    terracottaMat,
    galvanizedMat,
    foliageToonMat,
    rosemaryToonMat,
    lavenderBloomMat,
    strawberryMat,
    appleMat,
    lemonMat,
    redTileRoofMat,
    creamPlasterMat,
    cloudMat,
  } = useMemo(() => {
    const wood = new THREE.MeshStandardMaterial({
      map: timberPbr.map,
      bumpMap: timberPbr.bumpMap,
      bumpScale: 0.012,
      roughness: 0.88,
      metalness: 0.0,
    });
    const dWood = new THREE.MeshStandardMaterial({
      map: darkOakPbr.map,
      bumpMap: darkOakPbr.bumpMap,
      bumpScale: 0.014,
      roughness: 0.90,
      metalness: 0.0,
    });
    const soil = new THREE.MeshStandardMaterial({
      color: '#5A3D28',
      roughness: 0.96,
    });
    const terra = new THREE.MeshStandardMaterial({
      color: '#C8724E',
      roughness: 0.82,
      metalness: 0.02,
    });
    // 复古哑光镀锌白铁皮（洒水壶）
    const galv = new THREE.MeshStandardMaterial({
      color: '#C6CED0',
      roughness: 0.42,
      metalness: 0.58,
    });

    // 3-Band Toon 树冠与香草枝叶（含顶点风动）
    const makeWindToonMat = (colorHex: string, tag: string, amp: number, sunlit = '#DFF068', shadow = '#2E6A62') => {
      const m = new THREE.MeshStandardMaterial({
        color: colorHex,
        map: craftAssets.painterlyCanopyTex,
        roughness: 0.94,
        metalness: 0.0,
      });
      m.customProgramCacheKey = () => `provence-wind-${tag}`;
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uWindTime = windTimeUniform;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>\nuniform float uWindTime;`)
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            vec3 wpSeed = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            float wPhase = wpSeed.x * 0.45 + wpSeed.z * 0.38;
            float wTip = clamp((position.y + 0.5) * 0.85, 0.0, 1.0);
            transformed.x += sin(uWindTime * 1.55 + wPhase) * ${amp.toFixed(4)} * wTip;
            transformed.z += cos(uWindTime * 1.25 + wPhase * 1.3) * ${(amp * 0.65).toFixed(4)} * wTip;`
          );
      };
      return enhanceWithStylizedFoliageToon(m, {
        cacheTag: tag,
        sunlitColor: sunlit,
        shadowColor: shadow,
        toonBlend: 0.82,
      });
    };

    const foliage = makeWindToonMat('#6EB04A', 'orchard-fruit-canopy', 0.045);
    const rosemary = makeWindToonMat('#4E8748', 'herb-rosemary', 0.018, '#9CD670', '#2B5B50');
    const lavMat = new THREE.MeshStandardMaterial({
      color: '#9B7EE0',
      roughness: 0.84,
    });
    const strawMat = new THREE.MeshStandardMaterial({
      color: '#E6424C',
      roughness: 0.46,
    });
    const appMat = new THREE.MeshStandardMaterial({
      color: '#DC4138',
      roughness: 0.44,
    });
    const lemMat = new THREE.MeshStandardMaterial({
      color: '#F6D042',
      roughness: 0.48,
    });
    const tileRoof = new THREE.MeshStandardMaterial({
      color: '#C25F42',
      roughness: 0.86,
    });
    const plaster = new THREE.MeshStandardMaterial({
      color: '#F5EADB',
      roughness: 0.90,
    });

    // 手绘吉卜力蓬松积云材质（暖奶油受光顶 + 淡薰衣草蓝底影）
    const cloud = new THREE.MeshStandardMaterial({
      color: '#FFF9EC',
      emissive: '#F5E4C6',
      emissiveIntensity: 0.32,
      roughness: 0.96,
      metalness: 0.0,
      fog: false,
    });

    return {
      bedPlankLongGeo: createBeveledBoxGeometry(1.76, 0.30, 0.065, 0.01, 0.005, 0.005, 2),
      bedPlankShortGeo: createBeveledBoxGeometry(0.065, 0.30, 0.82, 0.01, 0.005, 0.005, 2),
      potGeo: createTerracottaPlanterGeometry(0.135, 0.09, 0.22),
      canopyPuffGeo: createVolumetricCanopyPuffGeometry(),
      butterflyWingGeo: createButterflyWingGeometry(),
      weatheredWoodMat: wood,
      darkWoodMat: dWood,
      soilMat: soil,
      terracottaMat: terra,
      galvanizedMat: galv,
      foliageToonMat: foliage,
      rosemaryToonMat: rosemary,
      lavenderBloomMat: lavMat,
      strawberryMat: strawMat,
      appleMat: appMat,
      lemonMat: lemMat,
      redTileRoofMat: tileRoof,
      creamPlasterMat: plaster,
      cloudMat: cloud,
    };
  }, [craftAssets.painterlyCanopyTex, darkOakPbr, timberPbr, windTimeUniform]);

  useEffect(() => {
    return () => {
      bedPlankLongGeo.dispose();
      bedPlankShortGeo.dispose();
      potGeo.dispose();
      canopyPuffGeo.dispose();
      butterflyWingGeo.dispose();
      weatheredWoodMat.dispose();
      darkWoodMat.dispose();
      soilMat.dispose();
      terracottaMat.dispose();
      galvanizedMat.dispose();
      foliageToonMat.dispose();
      rosemaryToonMat.dispose();
      lavenderBloomMat.dispose();
      strawberryMat.dispose();
      appleMat.dispose();
      lemonMat.dispose();
      redTileRoofMat.dispose();
      creamPlasterMat.dispose();
      cloudMat.dispose();
      timberPbr.map.dispose();
      timberPbr.bumpMap.dispose();
      timberPbr.roughnessMap.dispose();
      darkOakPbr.map.dispose();
      darkOakPbr.bumpMap.dispose();
      darkOakPbr.roughnessMap.dispose();
    };
  }, [
    bedPlankLongGeo,
    bedPlankShortGeo,
    potGeo,
    canopyPuffGeo,
    butterflyWingGeo,
    weatheredWoodMat,
    darkWoodMat,
    soilMat,
    terracottaMat,
    galvanizedMat,
    foliageToonMat,
    rosemaryToonMat,
    lavenderBloomMat,
    strawberryMat,
    appleMat,
    lemonMat,
    redTileRoofMat,
    creamPlasterMat,
    cloudMat,
    timberPbr,
    darkOakPbr,
  ]);

  // 动画 Refs
  const hillWindmillSailRef = useRef<THREE.Group>(null);
  const catBodyRef = useRef<THREE.Group>(null);
  const catTailRef = useRef<THREE.Group>(null);
  const sparrowRefs = useRef<Array<THREE.Group | null>>([]);
  const sparrowHeadRefs = useRef<Array<THREE.Group | null>>([]);
  const butterflyGroupRefs = useRef<Array<THREE.Group | null>>([]);
  const butterflyLRefs = useRef<Array<THREE.Mesh | null>>([]);
  const butterflyRRefs = useRef<Array<THREE.Mesh | null>>([]);
  const beeRefs = useRef<Array<THREE.Group | null>>([]);
  const doveGroupRefs = useRef<Array<THREE.Group | null>>([]);
  const doveLRefs = useRef<Array<THREE.Mesh | null>>([]);
  const doveRRefs = useRef<Array<THREE.Mesh | null>>([]);
  const cloudGroupRefs = useRef<Array<THREE.Group | null>>([]);

  // 8 只黄白色小蝴蝶的曲线巡游配置（环绕蔷薇木桥、香草种植箱、花藤拱门与野花丛）
  const butterflies = useMemo(
    () => [
      { cx: 8.15, cy: 0.72, cz: 1.05, rx: 1.15, rz: 0.95, ry: 0.24, sp: 1.15, ph: 0.2, col: '#FFF6B8' },
      { cx: 6.85, cy: 0.65, cz: 11.85, rx: 1.45, rz: 1.25, ry: 0.28, sp: 1.05, ph: 1.4, col: '#FFFDF2' },
      { cx: 6.45, cy: 0.78, cz: 12.25, rx: 1.10, rz: 0.95, ry: 0.22, sp: 1.30, ph: 2.8, col: '#FDE278' },
      { cx: 9.25, cy: 0.58, cz: 5.85, rx: 1.35, rz: 1.40, ry: 0.26, sp: 0.95, ph: 4.1, col: '#FFFBE4' },
      { cx: 1.05, cy: 0.85, cz: 9.25, rx: 1.25, rz: 1.05, ry: 0.25, sp: 1.22, ph: 5.3, col: '#FCE88E' },
      { cx: 6.85, cy: 1.12, cz: -1.45, rx: 0.85, rz: 0.75, ry: 0.24, sp: 1.35, ph: 0.9, col: '#FFFDF5' },
      { cx: 7.45, cy: 0.68, cz: 8.20, rx: 1.30, rz: 1.10, ry: 0.22, sp: 1.12, ph: 3.5, col: '#FDE892' },
      { cx: 9.95, cy: 0.62, cz: 3.85, rx: 0.95, rz: 0.85, ry: 0.20, sp: 1.26, ph: 2.1, col: '#FFF9DF' },
    ],
    []
  );

  // 4 只勤劳的小蜜蜂（在草莓苗与薰衣草花穗间采蜜）
  const bees = useMemo(
    () => [
      { cx: 6.75, cy: 0.24, cz: 11.35, rx: 0.52, rz: 0.36, sp: 2.2, ph: 0.4 },
      { cx: 7.45, cy: 0.28, cz: 12.65, rx: 0.48, rz: 0.42, sp: 2.5, ph: 1.8 },
      { cx: 8.25, cy: 0.52, cz: 1.25, rx: 0.44, rz: 0.38, sp: 2.1, ph: 3.1 },
      { cx: 6.45, cy: 0.30, cz: 12.10, rx: 0.56, rz: 0.34, sp: 2.4, ph: 4.6 },
    ],
    []
  );

  // 10 棵南法果园饱满果树（6 棵南侧庄园果树 + 4 棵矮石墙后方东侧远坡果树，错落拱卫红圈风车农舍！）
  const orchardFruitTrees = useMemo(
    () =>
      (
        [
          { x: 4.5, z: 22.8, s: 1.15, fruit: 'apple' as const },
          { x: -5.6, z: 24.2, s: 1.24, fruit: 'lemon' as const },
          { x: 2.2, z: 26.5, s: 1.18, fruit: 'lemon' as const },
          { x: -7.8, z: 27.6, s: 1.28, fruit: 'apple' as const },
          { x: 9.8, z: 24.4, s: 1.16, fruit: 'apple' as const },
          { x: -12.6, z: 21.5, s: 1.24, fruit: 'lemon' as const },
          // 东侧矮石墙后方远景山坡果树（左右层次拱卫风塔，彻底打破光秃绿色曲线！）
          { x: 21.4, z: -2.2, s: 0.96, fruit: 'apple' as const },
          { x: 24.4, z: -1.4, s: 1.06, fruit: 'lemon' as const },
          { x: 22.8, z: 6.4, s: 1.02, fruit: 'apple' as const },
          { x: 27.6, z: 6.8, s: 1.14, fruit: 'lemon' as const },
        ]
      ).map((t) => ({ ...t, y: sampleGhibliTerrainHeight(t.x, t.z) - 0.08 })),
    []
  );

  // 远山坡顶法式乡村风车农舍坐标（精准移入东侧窗外两棵大树间的红圈视廊正中，正面朝向烘焙小屋！）
  const windmillPos = useMemo<[number, number, number]>(() => {
    const wx = 25.8;
    const wz = 2.95;
    return [wx, sampleGhibliTerrainHeight(wx, wz) - 0.16, wz];
  }, []);

  // 天空 8 朵蓬松手绘积云（覆盖南侧远山与东侧风塔上方天际）
  const clouds = useMemo(
    () => [
      { bx: -7.5, by: 9.6, bz: 34.0, s: 1.85, sp: 0.16, ph: 0.0 },
      { bx: 0.5, by: 10.4, bz: 37.0, s: 2.15, sp: 0.12, ph: 1.3 },
      { bx: 9.0, by: 9.2, bz: 33.0, s: 1.75, sp: 0.18, ph: 2.5 },
      { bx: -16.5, by: 9.0, bz: 29.0, s: 1.65, sp: 0.14, ph: 3.7 },
      { bx: 16.0, by: 9.8, bz: 30.0, s: 1.85, sp: 0.15, ph: 4.9 },
      { bx: -2.5, by: 8.6, bz: 31.5, s: 1.35, sp: 0.20, ph: 5.6 },
      // 东侧风塔上方暖奶油吉卜力蓬松白云（精准映入室内窗外红圈天际）
      { bx: 31.5, by: 9.8, bz: 2.2, s: 1.65, sp: 0.14, ph: 1.8 },
      { bx: 34.0, by: 10.6, bz: 8.5, s: 1.80, sp: 0.12, ph: 4.2 },
    ],
    []
  );

  // 6 只掠过远山风车农舍与花房上空的展翅白鸽剪影
  const doves = useMemo(
    () => [
      { cx: 1.2, cy: 6.2, cz: 19.5, rx: 5.2, rz: 3.2, sp: 0.38, ph: 0.0, s: 1.22 },
      { cx: 1.8, cy: 6.5, cz: 20.1, rx: 5.0, rz: 3.0, sp: 0.38, ph: 0.22, s: 1.12 },
      { cx: 0.6, cy: 5.9, cz: 19.0, rx: 5.4, rz: 3.4, sp: 0.38, ph: 0.44, s: 1.04 },
      { cx: -2.4, cy: 6.9, cz: 22.8, rx: 5.8, rz: 3.6, sp: 0.32, ph: 2.4, s: 1.15 },
      // 东侧风车塔上空轻盈盘旋的白鸽双影
      { cx: 23.5, cy: 6.8, cz: 2.6, rx: 2.8, rz: 3.6, sp: 0.36, ph: 1.1, s: 1.08 },
      { cx: 24.2, cy: 7.1, cz: 3.2, rx: 2.6, rz: 3.4, sp: 0.36, ph: 1.34, s: 0.98 },
    ],
    []
  );

  // 香草种植角世界坐标（避开溪岸急坡边缘，稳固坐落于平缓草地）
  const herbCornerX = 5.65;
  const herbCornerZ = 11.45;
  const herbCornerY = useMemo(() => sampleGhibliTerrainHeight(herbCornerX, herbCornerZ) - 0.03, []);
  // 打盹橘白小猫咪所在溪岸老橡木桩坐标（高出底部 UI 栏的溪岸黄金中前景，全身清晰可见！）
  const catStumpY = useMemo(() => sampleGhibliTerrainHeight(9.85, 4.15), []);
  // 鸟屋与跳跃小麻雀所在草坪坐标（与打盹橘猫相邻呼应）
  const birdhouseY = useMemo(() => sampleGhibliTerrainHeight(10.05, 5.45), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    windTimeUniform.value = t;

    // 1. 远山风车木叶柔和旋转
    if (hillWindmillSailRef.current) {
      hillWindmillSailRef.current.rotation.z = -t * 0.34;
    }

    // 2. 打盹橘白小猫咪：胸口柔和呼吸起伏 + 悠闲摇摆的橘白尾巴
    if (catBodyRef.current) {
      const breath = Math.sin(t * 2.15);
      catBodyRef.current.scale.set(1.0 + breath * 0.024, 1.0 + breath * 0.036, 1.0 + breath * 0.018);
    }
    if (catTailRef.current) {
      catTailRef.current.rotation.y = Math.sin(t * 1.65) * 0.32 + Math.sin(t * 3.1) * 0.08;
      catTailRef.current.rotation.z = Math.cos(t * 1.65) * 0.08;
    }

    // 3. 鸟屋旁两只小麻雀：周期性欢快弹跳 + 低头啄食动画
    sparrowRefs.current.forEach((sp, idx) => {
      if (!sp) return;
      const cycle = (t * 1.15 + idx * 1.7) % 4.0;
      const hopPhase = cycle < 0.7 ? Math.sin((cycle / 0.7) * Math.PI * 2) : 0;
      const hopY = Math.max(0, hopPhase) * 0.065;
      const peckPhase = cycle > 1.6 && cycle < 2.8 ? Math.abs(Math.sin((cycle - 1.6) * 8.5)) : 0;
      sp.position.y = 0.055 + hopY;
      sp.rotation.x = peckPhase * 0.48;
      sp.rotation.y = (idx === 0 ? 0.85 : -1.15) + Math.sin(t * 0.9 + idx * 2.3) * 0.42;
      const head = sparrowHeadRefs.current[idx];
      if (head) {
        head.rotation.z = Math.sin(t * 2.4 + idx * 3.1) * 0.16;
      }
    });

    // 4. 8 只黄白小蝴蝶曲线翩跹飞舞 + 高频扇翅
    butterflies.forEach((b, i) => {
      const g = butterflyGroupRefs.current[i];
      if (!g) return;
      const ang = t * b.sp + b.ph;
      const nx = b.cx + Math.cos(ang) * b.rx + Math.sin(ang * 2.1) * 0.24;
      const nz = b.cz + Math.sin(ang * 0.85) * b.rz;
      const ny = b.cy + Math.sin(ang * 1.9 + 0.5) * b.ry;
      const dx = -Math.sin(ang) * b.rx * b.sp + Math.cos(ang * 2.1) * 0.5;
      const dz = Math.cos(ang * 0.85) * b.rz * 0.85 * b.sp;
      g.position.set(nx, ny, nz);
      g.rotation.set(0.12, Math.atan2(dx, dz), Math.sin(ang * 2.0) * 0.18);

      const flap = Math.sin(t * 13.5 + b.ph * 4.0) * 0.95;
      if (butterflyLRefs.current[i]) butterflyLRefs.current[i]!.rotation.z = 0.25 + flap;
      if (butterflyRRefs.current[i]) butterflyRRefs.current[i]!.rotation.z = -0.25 - flap;
    });

    // 5. 4 只小蜜蜂花间盘旋
    bees.forEach((bee, i) => {
      const g = beeRefs.current[i];
      if (!g) return;
      const a = t * bee.sp + bee.ph;
      g.position.set(
        bee.cx + Math.cos(a) * bee.rx,
        bee.cy + Math.sin(a * 2.3) * 0.08,
        bee.cz + Math.sin(a * 1.2) * bee.rz
      );
      g.rotation.y = Math.atan2(-Math.sin(a) * bee.rx, Math.cos(a * 1.2) * bee.rz);
    });

    // 6. 5 只掠过远山天际的白鸽滑翔扇翅
    doves.forEach((d, i) => {
      const g = doveGroupRefs.current[i];
      if (!g) return;
      const a = t * d.sp + d.ph;
      const x = d.cx + Math.cos(a) * d.rx;
      const z = d.cz + Math.sin(a) * d.rz;
      const y = d.cy + Math.sin(a * 2.0) * 0.55;
      const vx = -Math.sin(a) * d.rx;
      const vz = Math.cos(a) * d.rz;
      g.position.set(x, y, z);
      g.rotation.set(0, Math.atan2(vx, vz), Math.sin(a) * 0.16);
      const wingFlap = Math.sin(t * 6.8 + d.ph * 5.0) * 0.52;
      if (doveLRefs.current[i]) doveLRefs.current[i]!.rotation.z = wingFlap;
      if (doveRRefs.current[i]) doveRRefs.current[i]!.rotation.z = -wingFlap;
    });

    // 7. 积云缓慢横移飘浮
    clouds.forEach((c, i) => {
      const cg = cloudGroupRefs.current[i];
      if (!cg) return;
      cg.position.x = c.bx + Math.sin(t * 0.045 * c.sp + c.ph) * 3.2;
      cg.position.y = c.by + Math.cos(t * 0.08 + c.ph) * 0.25;
    });
  });

  return (
    <group name="ProvenceStorybookGarden">
      {/* =====================================================================
          1. 精炼南法香草生活角（对齐真实地形高度 + 深埋柱脚 + 洒水壶稳妥置放绝不悬空！）
         ===================================================================== */}
      <group position={[herbCornerX, herbCornerY, herbCornerZ]} rotation={[0, 0.32, 0]}>
        {/* 单排精致木质低矮香草花架（带下延柱脚深扎入斜坡，零悬空） */}
        {[0].map((rowZ, rowIdx) => (
          <group key={`herb-bed-${rowIdx}`} position={[0, 0, rowZ]}>
            <mesh position={[0, 0.15, 0.39]} geometry={bedPlankLongGeo} material={weatheredWoodMat} castShadow receiveShadow />
            <mesh position={[0, 0.15, -0.39]} geometry={bedPlankLongGeo} material={weatheredWoodMat} castShadow receiveShadow />
            <mesh position={[0.85, 0.15, 0]} geometry={bedPlankShortGeo} material={weatheredWoodMat} castShadow receiveShadow />
            <mesh position={[-0.85, 0.15, 0]} geometry={bedPlankShortGeo} material={weatheredWoodMat} castShadow receiveShadow />
            {[
              [-0.86, 0.04, -0.40],
              [0.86, 0.04, -0.40],
              [-0.86, 0.04, 0.40],
              [0.86, 0.04, 0.40],
            ].map(([px, py, pz], pi) => (
              <mesh key={`post-${pi}`} position={[px, py, pz]} material={darkWoodMat} castShadow>
                <boxGeometry args={[0.09, 0.62, 0.09]} />
              </mesh>
            ))}
            {/* 加厚底部围板封堵斜坡缝隙 */}
            <mesh position={[0, -0.02, 0]} material={darkWoodMat} receiveShadow>
              <boxGeometry args={[1.68, 0.14, 0.78]} />
            </mesh>
            {/* 肥沃松土床 */}
            <mesh position={[0, 0.24, 0]} material={soilMat} receiveShadow>
              <boxGeometry args={[1.64, 0.08, 0.72]} />
            </mesh>

            {rowIdx === 0 ? (
              <group position={[0, 0.28, 0]}>
                {[-0.58, -0.18, 0.22, 0.58].map((hx, hi) => (
                  <React.Fragment key={`herb-row1-${hi}`}>
                    <group position={[hx, 0, -0.16]}>
                      <mesh position={[0, 0.11, 0]} scale={[0.20, 0.24, 0.20]} geometry={canopyPuffGeo} material={rosemaryToonMat} castShadow />
                      <mesh position={[0.08, 0.08, 0.04]} scale={[0.14, 0.17, 0.14]} geometry={canopyPuffGeo} material={rosemaryToonMat} castShadow />
                    </group>
                    {/* 带细茎分节的普罗旺斯薰衣草簇（扎实入土绝不悬浮） */}
                    <group position={[hx, 0, 0.17]}>
                      <mesh position={[0, 0.06, 0]} scale={[0.16, 0.10, 0.16]} geometry={canopyPuffGeo} material={rosemaryToonMat} castShadow />
                      {[-0.07, -0.02, 0.03, 0.08].map((lx, li) => (
                        <group key={`lav-${li}`} position={[lx, 0.04, (li % 2 === 0 ? -0.04 : 0.04)]} rotation={[0.12 * (li - 1.5), li * 0.9, 0.14 * (li - 1.5)]}>
                          <mesh position={[0, 0.11, 0]}>
                            <cylinderGeometry args={[0.005, 0.007, 0.22, 6]} />
                            <meshStandardMaterial color="#58854A" roughness={0.85} />
                          </mesh>
                          {[0.18, 0.22, 0.25].map((by, bi) => (
                            <mesh key={`fl-${bi}`} position={[0, by, 0]} material={lavenderBloomMat} castShadow>
                              <dodecahedronGeometry args={[0.017 - bi * 0.003, 0]} />
                            </mesh>
                          ))}
                        </group>
                      ))}
                    </group>
                  </React.Fragment>
                ))}
              </group>
            ) : null}
          </group>
        ))}

        {/* 稳稳坐落于花架前侧石板垫块上的复古白铁皮洒水壶（彻底告别河岸半空悬浮！） */}
        <group position={[1.18, 0.02, 0.22]} rotation={[0, -0.78, 0]}>
          <mesh position={[0, -0.02, 0]} receiveShadow>
            <cylinderGeometry args={[0.24, 0.26, 0.10, 12]} />
            <meshStandardMaterial color="#BFB7A4" roughness={0.92} />
          </mesh>
          <group position={[0, 0.15, 0]}>
            <mesh material={galvanizedMat} castShadow receiveShadow>
              <cylinderGeometry args={[0.105, 0.125, 0.25, 16]} />
            </mesh>
            <mesh position={[0, 0.125, 0]} material={galvanizedMat}>
              <cylinderGeometry args={[0.105, 0.105, 0.016, 16, 1, false, 0, Math.PI]} />
            </mesh>
            <mesh position={[0.18, 0.06, 0]} rotation={[0, 0, -0.95]} material={galvanizedMat} castShadow>
              <cylinderGeometry args={[0.014, 0.028, 0.26, 10]} />
            </mesh>
            <mesh position={[0.30, 0.15, 0]} rotation={[0, 0, -0.95]} castShadow>
              <coneGeometry args={[0.048, 0.055, 12]} />
              <meshStandardMaterial color="#B89056" metalness={0.55} roughness={0.44} />
            </mesh>
            <mesh position={[-0.08, 0.04, 0]} rotation={[0, 0, 0.4]} material={galvanizedMat}>
              <torusGeometry args={[0.11, 0.012, 8, 18, Math.PI * 1.25]} />
            </mesh>
          </group>
        </group>

        {/* 隐藏冗余独轮车与花盆堆叠，保持前景与溪对岸草坪干净清爽！ */}
        <group position={[1.32, 0.0, 0.32]} visible={false}>
          <mesh position={[0, 0.11, 0]} geometry={potGeo} material={terracottaMat} castShadow receiveShadow />
          <mesh position={[0.02, 0.24, -0.01]} rotation={[0.08, 0.5, -0.06]} geometry={potGeo} material={terracottaMat} castShadow />
          <mesh position={[0.28, 0.11, 0.12]} geometry={potGeo} material={terracottaMat} castShadow receiveShadow />
          {/* 盆内绿植嫩苗 */}
          <mesh position={[0.28, 0.22, 0.12]} scale={[0.14, 0.13, 0.14]} geometry={canopyPuffGeo} material={rosemaryToonMat} castShadow />
          {/* 侧卧红陶花盆 */}
          <mesh position={[0.18, 0.11, -0.24]} rotation={[1.38, 0.4, 0.7]} geometry={potGeo} material={terracottaMat} castShadow />
        </group>

        {/* 迷你木制手推独轮车（Wooden Wheelbarrow，移至香草箱靠溪流前端草地，在默认外景视角中 100% 完整展示！） */}
        <group position={[0.42, 0.0, -1.48]} rotation={[0, -0.45, 0]} visible={false}>
          {/* 梯形实木车斗 */}
          <mesh position={[0, 0.34, 0]} material={weatheredWoodMat} castShadow receiveShadow>
            <boxGeometry args={[0.62, 0.24, 0.46]} />
          </mesh>
          <mesh position={[0, 0.45, 0.23]} rotation={[0.15, 0, 0]} material={darkWoodMat} castShadow>
            <boxGeometry args={[0.66, 0.05, 0.04]} />
          </mesh>
          <mesh position={[0, 0.45, -0.23]} rotation={[-0.15, 0, 0]} material={darkWoodMat} castShadow>
            <boxGeometry args={[0.66, 0.05, 0.04]} />
          </mesh>
          {/* 双木推把与支撑后腿 */}
          {[-0.18, 0.18].map((tz, ti) => (
            <React.Fragment key={`wb-rail-${ti}`}>
              <mesh position={[-0.10, 0.26, tz]} rotation={[0, 0, -0.08]} material={darkWoodMat} castShadow>
                <boxGeometry args={[1.32, 0.045, 0.045]} />
              </mesh>
              <mesh position={[-0.24, 0.13, tz]} material={darkWoodMat} castShadow>
                <boxGeometry args={[0.042, 0.26, 0.042]} />
              </mesh>
            </React.Fragment>
          ))}
          {/* 实木轮辐前轮 */}
          <group position={[0.48, 0.19, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={darkWoodMat} castShadow>
              <torusGeometry args={[0.175, 0.026, 10, 20]} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 0.07, 12]} />
              <meshStandardMaterial color="#3A3835" metalness={0.5} roughness={0.5} />
            </mesh>
            {[0, 1, 2, 3].map((si) => (
              <mesh key={`spoke-${si}`} rotation={[0, 0, (si / 4) * Math.PI]} material={weatheredWoodMat}>
                <boxGeometry args={[0.024, 0.34, 0.024]} />
              </mesh>
            ))}
          </group>
          {/* 车斗里的丰收农产：松土 + 现摘鲜红草莓堆 + 新鲜迷迭香束 */}
          <mesh position={[0, 0.46, 0]} material={soilMat}>
            <boxGeometry args={[0.54, 0.04, 0.38]} />
          </mesh>
          <mesh position={[0.08, 0.52, -0.06]} scale={[0.22, 0.15, 0.20]} geometry={canopyPuffGeo} material={rosemaryToonMat} castShadow />
          {[
            [-0.12, 0.50, 0.06],
            [-0.04, 0.51, 0.08],
            [-0.15, 0.49, -0.04],
            [-0.07, 0.50, -0.06],
            [-0.09, 0.54, 0.02],
          ].map(([bx, by, bz], bi) => (
            <mesh key={`wb-berry-${bi}`} position={[bx, by, bz]} material={strawberryMat} castShadow>
              <sphereGeometry args={[0.036, 10, 8]} />
            </mesh>
          ))}
        </group>
      </group>

      {/* =====================================================================
          2. 远山坡顶法式乡村小风车农舍（彻底解决小屋与风车穿模，增加半木结构、百叶花窗、木质环廊、灯笼与暖光特效！）
         ===================================================================== */}
      <group position={windmillPos} rotation={[0, -Math.PI * 0.56, 0]} scale={0.86}>
        {/* 加宽分层夯实石砌坡顶台基（托住独立错落的农舍与风车，零悬空浮角） */}
        <mesh position={[-0.25, 0.20, 0.10]} receiveShadow castShadow>
          <cylinderGeometry args={[3.10, 3.65, 0.92, 20]} />
          <meshStandardMaterial color="#8E9682" roughness={0.94} />
        </mesh>
        <mesh position={[1.45, 0.56, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[1.65, 1.95, 0.65, 18]} />
          <meshStandardMaterial color="#9BA28F" roughness={0.92} />
        </mesh>

        {/* 独立左侧法式红瓦乡村农舍（与右侧风车拉开充足间距并用矮连廊过渡，彻底零穿模！） */}
        <group position={[-1.82, 0.62, 0.24]}>
          {/* 石砌墙裙底座 */}
          <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.34, 0.44, 1.94]} />
            <meshStandardMaterial color="#9BA091" roughness={0.94} />
          </mesh>
          {/* 暖奶油石膏主屋 */}
          <mesh position={[0, 1.24, 0]} material={creamPlasterMat} castShadow receiveShadow>
            <boxGeometry args={[2.24, 1.68, 1.84]} />
          </mesh>
          {/* 法式乡村半木构外露深棕木梁框（横梁、立柱、斜撑） */}
          <mesh position={[0, 0.46, 0.925]} material={darkWoodMat}>
            <boxGeometry args={[2.28, 0.08, 0.05]} />
          </mesh>
          <mesh position={[0, 1.96, 0.925]} material={darkWoodMat}>
            <boxGeometry args={[2.28, 0.09, 0.05]} />
          </mesh>
          {[-1.06, -0.02, 1.06].map((tx, ti) => (
            <mesh key={`timber-col-${ti}`} position={[tx, 1.21, 0.925]} material={darkWoodMat}>
              <boxGeometry args={[0.09, 1.56, 0.05]} />
            </mesh>
          ))}
          {/* 经典普罗旺斯人字红瓦坡屋顶 + 屋脊瓦压条 */}
          <mesh position={[0, 2.52, 0]} rotation={[0, Math.PI / 4, 0]} material={redTileRoofMat} castShadow>
            <coneGeometry args={[1.82, 1.08, 4]} />
          </mesh>
          <mesh position={[0, 3.04, 0]} rotation={[0, Math.PI / 4, 0]} material={darkWoodMat}>
            <cylinderGeometry args={[0.07, 0.14, 0.14, 4]} />
          </mesh>
          {/* 红砖壁炉烟囱 + 袅袅手绘白烟 */}
          <mesh position={[-0.64, 2.74, -0.22]} material={redTileRoofMat} castShadow>
            <boxGeometry args={[0.38, 0.98, 0.38]} />
          </mesh>
          <mesh position={[-0.64, 3.26, -0.22]} material={darkWoodMat}>
            <boxGeometry args={[0.48, 0.08, 0.48]} />
          </mesh>
          <CozyHanddrawnSteam
            position={[-0.64, 3.36, -0.22]}
            puffCount={7}
            puffScale={0.48}
            riseHeight={2.65}
            spreadRadius={0.24}
            driftX={0.42}
            intensity={0.85}
            tint="#FFF9EE"
          />
          {/* 带鼠尾草绿木百叶、格子木棂与鲜红花槽的暖光花窗 */}
          {[-0.56, 0.56].map((wx, wi) => (
            <group key={`farm-win-${wi}`} position={[wx, 1.38, 0.935]}>
              <mesh material={darkWoodMat}>
                <boxGeometry args={[0.46, 0.52, 0.05]} />
              </mesh>
              <mesh position={[0, 0, 0.030]}>
                <planeGeometry args={[0.34, 0.40]} />
                <meshStandardMaterial color="#FFF0B8" emissive="#FFBA48" emissiveIntensity={1.45} roughness={0.32} />
              </mesh>
              {/* 十字格子木窗棂 */}
              <mesh position={[0, 0, 0.036]} material={darkWoodMat}>
                <boxGeometry args={[0.34, 0.03, 0.015]} />
              </mesh>
              <mesh position={[0, 0, 0.036]} material={darkWoodMat}>
                <boxGeometry args={[0.03, 0.40, 0.015]} />
              </mesh>
              {/* 左右鼠尾草绿百叶窗扇 */}
              {[-0.31, 0.31].map((sx, si) => (
                <mesh key={`f-shut-${si}`} position={[sx, 0, 0.01]} material={rosemaryToonMat}>
                  <boxGeometry args={[0.14, 0.50, 0.035]} />
                </mesh>
              ))}
              {/* 窗台木花槽 + 粉红与暖黄小花点缀 */}
              <mesh position={[0, -0.30, 0.07]} material={weatheredWoodMat}>
                <boxGeometry args={[0.48, 0.09, 0.12]} />
              </mesh>
              {[-0.12, 0.0, 0.12].map((fx, fi) => (
                <mesh key={`wb-fl-${fi}`} position={[fx, -0.23, 0.09]} material={fi === 1 ? lemonMat : strawberryMat}>
                  <sphereGeometry args={[0.048, 7, 6]} />
                </mesh>
              ))}
            </group>
          ))}
          {/* 农舍圆拱橡木正门 + 小斜木雨棚 + 门前暖灯笼 */}
          <group position={[0, 0.62, 0.935]}>
            <mesh position={[0, 0, 0]} material={darkWoodMat} castShadow>
              <boxGeometry args={[0.48, 0.84, 0.05]} />
            </mesh>
            <mesh position={[0, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]} material={darkWoodMat}>
              <cylinderGeometry args={[0.24, 0.24, 0.05, 14, 1, false, 0, Math.PI]} />
            </mesh>
            <mesh position={[0, 0.72, 0.14]} rotation={[0.45, 0, 0]} material={redTileRoofMat} castShadow>
              <boxGeometry args={[0.72, 0.05, 0.34]} />
            </mesh>
            <mesh position={[0.32, 0.48, 0.09]}>
              <sphereGeometry args={[0.055, 8, 8]} />
              <meshStandardMaterial color="#FFEBA8" emissive="#FFB238" emissiveIntensity={1.75} />
            </mesh>
          </group>
        </group>

        {/* 农舍与风车之间的石木矮连廊过渡墙（严密衔接不穿帮！） */}
        <group position={[-0.28, 0.76, 0.12]}>
          <mesh position={[0, 0.34, 0]} material={creamPlasterMat} castShadow>
            <boxGeometry args={[1.05, 0.68, 0.62]} />
          </mesh>
          <mesh position={[0, 0.78, 0]} material={redTileRoofMat} castShadow>
            <boxGeometry args={[1.15, 0.16, 0.76]} />
          </mesh>
        </group>

        {/* 独立右移升高的锥形奶油石风车圆塔（彻底远离小屋屋顶，叶尖扫转零穿模！） */}
        <group position={[1.45, 0.82, 0]}>
          {/* 石砌圆塔底座腰裙 */}
          <mesh position={[0, 0.45, 0]} receiveShadow castShadow>
            <cylinderGeometry args={[1.26, 1.38, 0.90, 20]} />
            <meshStandardMaterial color="#9BA091" roughness={0.92} />
          </mesh>
          {/* 锥形白泥塔身 */}
          <mesh position={[0, 2.25, 0]} material={creamPlasterMat} castShadow receiveShadow>
            <cylinderGeometry args={[0.88, 1.26, 3.20, 20]} />
          </mesh>
          {/* 环绕风车塔腰的木质观景栏杆栈道 + 发光暖金小灯笼 */}
          <mesh position={[0, 1.62, 0]} material={darkWoodMat} castShadow>
            <cylinderGeometry args={[1.38, 1.38, 0.08, 20]} />
          </mesh>
          {Array.from({ length: 12 }).map((_, pi) => {
            const ang = (pi / 12) * Math.PI * 2;
            const px = Math.cos(ang) * 1.32;
            const pz = Math.sin(ang) * 1.32;
            return (
              <mesh key={`mill-post-${pi}`} position={[px, 1.84, pz]} material={weatheredWoodMat}>
                <cylinderGeometry args={[0.025, 0.028, 0.42, 6]} />
              </mesh>
            );
          })}
          <mesh position={[0, 2.02, 0]} rotation={[Math.PI / 2, 0, 0]} material={weatheredWoodMat}>
            <torusGeometry args={[1.32, 0.028, 6, 24]} />
          </mesh>
          {/* 塔身正面暖灯圆形小窗 + 双盏壁挂暖光灯笼（触发柔和游戏光晕！） */}
          <group position={[0, 2.48, 1.02]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={darkWoodMat}>
              <torusGeometry args={[0.21, 0.032, 8, 18]} />
            </mesh>
            <mesh position={[0, 0, 0.01]}>
              <circleGeometry args={[0.19, 16]} />
              <meshStandardMaterial color="#FFF0B8" emissive="#FFBA48" emissiveIntensity={1.65} />
            </mesh>
          </group>
          {[-0.68, 0.68].map((lx, li) => (
            <mesh key={`mill-lamp-${li}`} position={[lx, 1.98, 1.15]}>
              <sphereGeometry args={[0.072, 10, 8]} />
              <meshStandardMaterial color="#FFF5CE" emissive="#FFB438" emissiveIntensity={1.95} />
            </mesh>
          ))}
          {/* 红瓦圆锥风车顶帽 + 铜风向标 */}
          <mesh position={[0, 4.38, 0]} material={redTileRoofMat} castShadow>
            <coneGeometry args={[1.08, 1.24, 20]} />
          </mesh>
          <mesh position={[0, 5.14, 0]}>
            <cylinderGeometry args={[0.022, 0.034, 0.44, 8]} />
            <meshStandardMaterial color="#8E6B3E" metalness={0.55} roughness={0.45} />
          </mesh>
          {/* 抬高轴心并微收半径的旋转木叶四翼风车（最低扫过点离小屋屋顶安全净空 > 0.6m，100% 不穿模！） */}
          <group ref={hillWindmillSailRef} position={[0, 3.68, 0.96]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={darkWoodMat} castShadow>
              <cylinderGeometry args={[0.18, 0.22, 0.34, 14]} />
            </mesh>
            {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((ang, si) => (
              <group key={`hill-sail-${si}`} rotation={[0, 0, ang + 0.32]}>
                <mesh position={[0, 1.16, 0.04]} material={darkWoodMat} castShadow>
                  <boxGeometry args={[0.085, 2.28, 0.06]} />
                </mesh>
                <mesh position={[0.42, 1.24, 0.04]} material={weatheredWoodMat} castShadow>
                  <boxGeometry args={[0.042, 1.72, 0.042]} />
                </mesh>
                {[0.54, 0.88, 1.22, 1.56, 1.90].map((ry, ri) => (
                  <mesh key={ri} position={[0.21, ry, 0.04]} material={weatheredWoodMat}>
                    <boxGeometry args={[0.46, 0.038, 0.038]} />
                  </mesh>
                ))}
                <mesh position={[0.22, 1.24, 0.07]}>
                  <planeGeometry args={[0.38, 1.62]} />
                  <meshStandardMaterial color="#FDF6E6" roughness={0.88} side={THREE.DoubleSide} />
                </mesh>
              </group>
            ))}
          </group>
        </group>
      </group>

      {/* =====================================================================
          3. 远山坡上的 6 棵南法果园饱满果树（结满红苹果 / 黄柠檬，3-Band Toon 树叶）
         ===================================================================== */}
      {orchardFruitTrees.map((tree, ti) => (
        <group key={`fruit-tree-${ti}`} position={[tree.x, tree.y, tree.z]} scale={tree.s}>
          {/* 粗壮暖棕有机树干 */}
          <mesh position={[0, 1.05, 0]} material={darkWoodMat} castShadow receiveShadow>
            <cylinderGeometry args={[0.16, 0.28, 2.15, 12]} />
          </mesh>
          {/* 饱满云朵状 3-Band Toon 树冠团簇 */}
          {[
            [0, 2.65, 0, 1.32],
            [0.72, 2.25, 0.45, 0.96],
            [-0.68, 2.38, 0.38, 0.98],
            [0.12, 2.32, -0.74, 0.92],
            [0.18, 3.12, 0.14, 0.82],
          ].map(([cx, cy, cz, cr], ci) => (
            <mesh
              key={`crown-${ci}`}
              position={[cx, cy, cz]}
              scale={[cr, cr * 0.84, cr]}
              geometry={canopyPuffGeo}
              material={foliageToonMat}
              castShadow
            />
          ))}
          {/* 挂满树冠外缘的红苹果 / 黄柠檬果实 */}
          {[
            [0.92, 2.48, 0.62],
            [-0.86, 2.52, 0.56],
            [0.34, 2.98, 0.84],
            [-0.38, 2.18, 0.92],
            [0.74, 2.08, -0.35],
            [-0.62, 2.86, -0.45],
            [0.12, 2.38, 1.08],
            [0.52, 2.75, 0.72],
            [-0.18, 3.18, 0.52],
          ].map(([fx, fy, fz], fi) => (
            <mesh
              key={`fruit-${fi}`}
              position={[fx, fy, fz]}
              scale={tree.fruit === 'lemon' ? [1.22, 0.92, 0.92] : [1.0, 0.96, 1.0]}
              material={tree.fruit === 'apple' ? appleMat : lemonMat}
              castShadow
            >
              <sphereGeometry args={[0.095, 10, 8]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* =====================================================================
          4. 天空蓬松手绘感 3D 积云与掠过天际的展翅白鸽剪影
         ===================================================================== */}
      {clouds.map((c, ci) => (
        <group
          key={`cloud-${ci}`}
          ref={(el) => {
            cloudGroupRefs.current[ci] = el;
          }}
          position={[c.bx, c.by, c.bz]}
          scale={c.s}
          userData={{ excludeFromOutline: true }}
        >
          {[
            [0, 0.25, 0, 1.25, 0.85, 0.95],
            [-1.05, 0.0, 0.12, 0.95, 0.65, 0.82],
            [1.08, 0.05, -0.08, 1.02, 0.72, 0.85],
            [-0.48, 0.42, -0.22, 0.88, 0.72, 0.78],
            [0.55, 0.36, 0.18, 0.85, 0.68, 0.76],
          ].map(([px, py, pz, sx, sy, sz], pi) => (
            <mesh
              key={`puff-${pi}`}
              position={[px, py, pz]}
              scale={[sx, sy, sz]}
              material={cloudMat}
              userData={{ excludeFromOutline: true }}
            >
              <sphereGeometry args={[1.0, 14, 10]} />
            </mesh>
          ))}
        </group>
      ))}

      {doves.map((d, di) => (
        <group
          key={`dove-${di}`}
          ref={(el) => {
            doveGroupRefs.current[di] = el;
          }}
          scale={d.s}
        >
          <mesh scale={[0.22, 0.18, 0.65]}>
            <sphereGeometry args={[0.16, 8, 6]} />
            <meshStandardMaterial color="#FFFDF8" roughness={0.7} />
          </mesh>
          <mesh
            ref={(el) => {
              doveLRefs.current[di] = el;
            }}
            position={[-0.14, 0.02, 0]}
            scale={[0.38, 0.03, 0.16]}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#FFFBF2" roughness={0.72} />
          </mesh>
          <mesh
            ref={(el) => {
              doveRRefs.current[di] = el;
            }}
            position={[0.14, 0.02, 0]}
            scale={[0.38, 0.03, 0.16]}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#FFFBF2" roughness={0.72} />
          </mesh>
        </group>
      ))}

      {/* =====================================================================
          5. 飞舞的黄白色小蝴蝶（8 只）与小蜜蜂（4 只）
         ===================================================================== */}
      {butterflies.map((b, bi) => (
        <group
          key={`bfly-${bi}`}
          ref={(el) => {
            butterflyGroupRefs.current[bi] = el;
          }}
          scale={1.38}
        >
          <mesh
            ref={(el) => {
              butterflyLRefs.current[bi] = el;
            }}
            geometry={butterflyWingGeo}
            rotation={[Math.PI * 0.38, 0, 0]}
          >
            <meshStandardMaterial color={b.col} roughness={0.48} side={THREE.DoubleSide} />
          </mesh>
          <mesh
            ref={(el) => {
              butterflyRRefs.current[bi] = el;
            }}
            geometry={butterflyWingGeo}
            scale={[-1, 1, 1]}
            rotation={[Math.PI * 0.38, 0, 0]}
          >
            <meshStandardMaterial color={b.col} roughness={0.48} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {bees.map((_, bi) => (
        <group
          key={`bee-${bi}`}
          ref={(el) => {
            beeRefs.current[bi] = el;
          }}
        >
          <mesh scale={[0.75, 0.72, 1.15]}>
            <sphereGeometry args={[0.022, 8, 6]} />
            <meshStandardMaterial color="#F8C832" roughness={0.45} />
          </mesh>
          <mesh position={[0, 0, 0]} scale={[0.78, 0.75, 0.35]}>
            <sphereGeometry args={[0.022, 8, 6]} />
            <meshStandardMaterial color="#2C2218" roughness={0.6} />
          </mesh>
          <mesh position={[-0.018, 0.018, 0]} rotation={[0.2, 0, 0.5]} scale={[0.028, 0.004, 0.016]}>
            <sphereGeometry args={[1, 6, 4]} />
            <meshStandardMaterial color="#FFFFFF" transparent opacity={0.7} />
          </mesh>
          <mesh position={[0.018, 0.018, 0]} rotation={[0.2, 0, -0.5]} scale={[0.028, 0.004, 0.016]}>
            <sphereGeometry args={[1, 6, 4]} />
            <meshStandardMaterial color="#FFFFFF" transparent opacity={0.7} />
          </mesh>
        </group>
      ))}

      {/* =====================================================================
          6. 溪岸老橡木桩上打盹的橘白相间小猫咪（呼吸起伏 + 悠闲摇尾巴）
         ===================================================================== */}
      <group position={[9.85, catStumpY, 4.15]} rotation={[0, -2.15, 0]}>
        {/* 带年轮切面的老橡木桩（稳固扎根溪岸草地） */}
        <mesh position={[0, 0.19, 0]} material={darkWoodMat} castShadow receiveShadow>
          <cylinderGeometry args={[0.26, 0.31, 0.42, 16]} />
        </mesh>
        <mesh position={[0, 0.402, 0]} receiveShadow>
          <cylinderGeometry args={[0.245, 0.245, 0.012, 16]} />
          <meshStandardMaterial color="#DFC092" roughness={0.86} />
        </mesh>

        {/* 蜷缩在木桩顶上晒太阳打盹的橘白小猫咪 */}
        <group position={[0, 0.41, 0]}>
          <group ref={catBodyRef}>
            {/* 橘色圆滚滚猫背与身体 */}
            <mesh position={[0, 0.095, 0]} scale={[1.18, 0.78, 0.96]} castShadow receiveShadow>
              <sphereGeometry args={[0.135, 16, 12]} />
              <meshStandardMaterial color="#EB8B3E" roughness={0.82} />
            </mesh>
            {/* 奶白色柔软猫肚皮/胸毛 */}
            <mesh position={[0.04, 0.072, 0.085]} scale={[0.92, 0.68, 0.72]}>
              <sphereGeometry args={[0.105, 14, 10]} />
              <meshStandardMaterial color="#FFF7EA" roughness={0.84} />
            </mesh>
            {/* 圆润小猫头（微微低垂打盹） */}
            <group position={[0.11, 0.145, 0.08]} rotation={[0.22, 0.35, -0.14]}>
              <mesh castShadow>
                <sphereGeometry args={[0.088, 16, 12]} />
                <meshStandardMaterial color="#EC8E42" roughness={0.80} />
              </mesh>
              {/* 奶白小脸颊与嘴巴 */}
              <mesh position={[0, -0.026, 0.056]} scale={[1.15, 0.72, 0.72]}>
                <sphereGeometry args={[0.052, 12, 10]} />
                <meshStandardMaterial color="#FFF8EE" roughness={0.82} />
              </mesh>
              {/* 粉嫩小鼻头 */}
              <mesh position={[0, -0.012, 0.088]}>
                <sphereGeometry args={[0.011, 8, 6]} />
                <meshStandardMaterial color="#F29AA4" roughness={0.55} />
              </mesh>
              {/* 微微闭起的弯月睡眼 */}
              {[-0.032, 0.032].map((ex, ei) => (
                <mesh key={`eye-${ei}`} position={[ex, 0.008, 0.078]} rotation={[0, 0, ei === 0 ? -0.15 : 0.15]}>
                  <boxGeometry args={[0.024, 0.005, 0.006]} />
                  <meshStandardMaterial color="#3D2B1F" roughness={0.6} />
                </mesh>
              ))}
              {/* 一对三角形橘猫尖耳 + 粉红耳窝 */}
              {[-0.052, 0.052].map((earX, ei) => (
                <group key={`ear-${ei}`} position={[earX, 0.072, -0.005]} rotation={[0.1, 0, ei === 0 ? 0.32 : -0.32]}>
                  <mesh castShadow>
                    <coneGeometry args={[0.032, 0.068, 4]} />
                    <meshStandardMaterial color="#E68236" roughness={0.82} />
                  </mesh>
                  <mesh position={[0, -0.006, 0.012]}>
                    <coneGeometry args={[0.018, 0.042, 4]} />
                    <meshStandardMaterial color="#F7B2BA" roughness={0.8} />
                  </mesh>
                </group>
              ))}
            </group>
            {/* 缩在脸颊前的奶白小爪子 */}
            {[-0.04, 0.06].map((px, pi) => (
              <mesh key={`paw-${pi}`} position={[0.13 + px * 0.4, 0.034, 0.15]} scale={[1.1, 0.65, 1.3]} castShadow>
                <sphereGeometry args={[0.032, 10, 8]} />
                <meshStandardMaterial color="#FFF8EE" roughness={0.84} />
              </mesh>
            ))}
          </group>

          {/* 悠闲轻摇的橘白相间小猫尾巴 */}
          <group ref={catTailRef} position={[-0.12, 0.055, -0.04]}>
            <mesh position={[-0.06, 0.01, 0.05]} rotation={[0.2, 0.7, 1.32]} castShadow>
              <capsuleGeometry args={[0.022, 0.14, 6, 10]} />
              <meshStandardMaterial color="#E88438" roughness={0.82} />
            </mesh>
            <mesh position={[-0.12, 0.022, 0.11]} castShadow>
              <sphereGeometry args={[0.025, 10, 8]} />
              <meshStandardMaterial color="#FFF8EE" roughness={0.84} />
            </mesh>
          </group>
        </group>
      </group>

      {/* 清理紧贴露台前景挡景的鸟屋木柱，仅保留老橡木桩上的打盹橘白小猫 + 香草花架与旧洒水壶，留出干净前景框景呼吸区 */}
      <group position={[10.05, birdhouseY, 5.45]} visible={false}>
        {/* 复古法式奶油色高脚木鸟屋 */}
        <mesh position={[0, 0.56, 0]} material={darkWoodMat} castShadow>
          <cylinderGeometry args={[0.032, 0.042, 1.16, 10]} />
        </mesh>
        <group position={[0, 1.24, 0]} rotation={[0, -0.85, 0]}>
          <mesh material={creamPlasterMat} castShadow>
            <boxGeometry args={[0.26, 0.28, 0.24]} />
          </mesh>
          <mesh position={[0, 0.21, 0]} rotation={[0, Math.PI / 4, 0]} material={redTileRoofMat} castShadow>
            <coneGeometry args={[0.24, 0.18, 4]} />
          </mesh>
          <mesh position={[0, 0.02, 0.122]}>
            <circleGeometry args={[0.042, 12]} />
            <meshStandardMaterial color="#3A281D" roughness={0.95} />
          </mesh>
          <mesh position={[0, -0.05, 0.15]} rotation={[Math.PI / 2, 0, 0]} material={darkWoodMat}>
            <cylinderGeometry args={[0.008, 0.008, 0.08, 8]} />
          </mesh>
        </group>

        {/* 鸟屋底部草地上两只圆滚滚的跳跃啄食小麻雀 */}
        {[
          [-0.24, 0.18],
          [0.22, -0.14],
        ].map(([sx, sz], idx) => (
          <group
            key={`sparrow-${idx}`}
            ref={(el) => {
              sparrowRefs.current[idx] = el;
            }}
            position={[sx, 0.055, sz]}
          >
            {/* 棕白圆滚滚麻雀躯干 */}
            <mesh scale={[0.88, 0.85, 1.15]} castShadow>
              <sphereGeometry args={[0.046, 12, 10]} />
              <meshStandardMaterial color="#8E6240" roughness={0.82} />
            </mesh>
            <mesh position={[0, -0.015, 0.012]} scale={[0.78, 0.72, 0.88]}>
              <sphereGeometry args={[0.040, 10, 8]} />
              <meshStandardMaterial color="#F7EFE2" roughness={0.84} />
            </mesh>
            {/* 翘起小尾巴 */}
            <mesh position={[0, 0.02, -0.058]} rotation={[0.55, 0, 0]} castShadow>
              <boxGeometry args={[0.026, 0.008, 0.052]} />
              <meshStandardMaterial color="#66432B" roughness={0.84} />
            </mesh>
            {/* 灵动小鸟头 + 暖黄小尖喙 */}
            <group
              ref={(el) => {
                sparrowHeadRefs.current[idx] = el;
              }}
              position={[0, 0.036, 0.042]}
            >
              <mesh castShadow>
                <sphereGeometry args={[0.030, 10, 8]} />
                <meshStandardMaterial color="#7C5234" roughness={0.80} />
              </mesh>
              <mesh position={[0, -0.004, 0.034]} rotation={[Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.009, 0.024, 6]} />
                <meshStandardMaterial color="#EAB248" roughness={0.55} />
              </mesh>
              {[-0.018, 0.018].map((ex, ei) => (
                <mesh key={`seye-${ei}`} position={[ex, 0.006, 0.018]}>
                  <sphereGeometry args={[0.005, 6, 6]} />
                  <meshStandardMaterial color="#201610" roughness={0.3} />
                </mesh>
              ))}
            </group>
          </group>
        ))}
      </group>
    </group>
  );
};

export default ProvenceStorybookGarden;
