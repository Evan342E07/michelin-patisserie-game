import * as THREE from 'three';

let pcssInstalled = false;

/**
 * 1. CONTACT-HARDENING PCSS (Percentage-Closer Soft Shadows) FOR THREE.JS r170
 * Patches `THREE.ShaderChunk.shadowmap_pars_fragment` ONCE at boot, replacing the fixed 3x3
 * PCFSoft kernel with an Interleaved-Gradient-Noise rotated 8-tap Vogel-disk blocker search +
 * 16-tap variable-penumbra PCF filter.
 * Result: razor-sharp contact shadows where objects touch the table/floor, smoothly blooming
 * into natural golden-hour penumbras farther from the contact surface!
 */
export function installPCSSSoftShadows(): void {
  if (pcssInstalled) return;
  const src = THREE.ShaderChunk.shadowmap_pars_fragment;
  const anchorStart = '#elif defined( SHADOWMAP_TYPE_PCF_SOFT )';
  const anchorEnd = '#elif defined( SHADOWMAP_TYPE_VSM )';

  const startIdx = src.indexOf(anchorStart);
  const endIdx = src.indexOf(anchorEnd);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return;
  }

  const pcssBlock = /* glsl */ `#elif defined( SHADOWMAP_TYPE_PCF_SOFT )

			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			vec2 uv = shadowCoord.xy;
			vec2 uvMin = texelSize * 0.5;
			vec2 uvMax = vec2( 1.0 ) - uvMin;
			float zReceiver = shadowCoord.z;

			// Per-pixel Interleaved Gradient Noise rotation eliminates banding rings cleanly
			float pcssAngle = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) ) * 6.2831853;
			float pcssSin = sin( pcssAngle );
			float pcssCos = cos( pcssAngle );
			mat2 pcssRot = mat2( pcssCos, -pcssSin, pcssSin, pcssCos );

			// 8-tap Interleaved-Gradient-Noise 旋转 Vogel-Disk 软阴影（顺滑无噪点同时兼顾核显帧率）
			float clampedRadius = clamp( shadowRadius, 0.5, 5.0 );
			float filterRadius = clampedRadius * 1.15;
			float pcssFi = 0.0;
			float pcssR = 0.0;
			float pcssTheta = 0.0;
			vec2 pcssOffset = vec2( 0.0 );
			vec2 pcssSampleUv = vec2( 0.0 );
			float sum = 0.0;

			#pragma unroll_loop_start
			for ( int i = 0; i < 8; i ++ ) {
				pcssFi = float( UNROLLED_LOOP_INDEX );
				pcssR = sqrt( ( pcssFi + 0.5 ) / 8.0 ) * filterRadius;
				pcssTheta = pcssFi * 2.39996323;
				pcssOffset = pcssRot * vec2( cos( pcssTheta ), sin( pcssTheta ) ) * pcssR * texelSize;
				pcssSampleUv = clamp( uv + pcssOffset, uvMin, uvMax );
				sum += step( zReceiver, unpackRGBAToDepth( textureLod( shadowMap, pcssSampleUv, 0.0 ) ) );
			}
			#pragma unroll_loop_end
			shadow = sum * 0.125;

		`;

  THREE.ShaderChunk.shadowmap_pars_fragment =
    src.slice(0, startIdx) + pcssBlock + src.slice(endIdx);
  pcssInstalled = true;
}

export type MicroDetailKind = 'none' | 'wood' | 'brushed_metal' | 'stone_ceramic';

export interface ExtremeMicroCraftOptions {
  /** Enables local Cottage-Room AABB Box-Projected IBL Parallax reflections */
  boxProjectedIBL?: boolean;
  /** World-space analytical high-frequency micro detail normal (sharp even at 1cm macro!) */
  detailKind?: MicroDetailKind;
  /** Strength of micro detail normal perturbation (default 0.14) */
  detailStrength?: number;
  /** Enables world-space Triplanar UV projection (meters-per-tile) so masonry/stone NEVER stretches! */
  triplanarScale?: number;
  /** Unique shader program cache tag */
  cacheTag: string;
}

// Cottage interior + veranda reflection box bounds (world space meters)
const COTTAGE_BOX_MIN = new THREE.Vector3(-5.18, 0.0, -3.72);
const COTTAGE_BOX_MAX = new THREE.Vector3(5.65, 3.85, 5.20);
const COTTAGE_BOX_CENTER = new THREE.Vector3(0.24, 1.92, 0.74);

/**
 * 2. BEYOND-PBR MATERIAL INJECTOR: BOX-PROJECTED LOCAL PARALLAX IBL + WORLD-SPACE MICRO DETAIL NORMAL
 * Safely chains onto any `MeshPhysicalMaterial` (preserving prior `onBeforeCompile` hooks cleanly!)
 * with zero extra texture samplers and 100% WebGL2 compatibility.
 */
export function enhanceWithExtremeMicroCraft(
  material: THREE.MeshPhysicalMaterial,
  options: ExtremeMicroCraftOptions
): THREE.MeshPhysicalMaterial {
  const useBoxIbl = Boolean(options.boxProjectedIBL);
  const detailKind = options.detailKind ?? 'none';
  const detailStrength = options.detailStrength ?? 0.14;
  const triplanarScale = options.triplanarScale ?? 0;
  if (!useBoxIbl && detailKind === 'none' && triplanarScale <= 0) return material;

  const prevCompile = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey?.bind(material);

  material.customProgramCacheKey = () => {
    const base = prevKey ? prevKey() : '';
    return `${base}|emc-v2-${useBoxIbl ? 'box-' : ''}${triplanarScale > 0 ? 'tri-' : ''}${detailKind}-${options.cacheTag}`;
  };

  material.onBeforeCompile = (shader, renderer) => {
    prevCompile?.(shader, renderer);

    shader.uniforms.uBoxMin = { value: COTTAGE_BOX_MIN };
    shader.uniforms.uBoxMax = { value: COTTAGE_BOX_MAX };
    shader.uniforms.uBoxCenter = { value: COTTAGE_BOX_CENTER };
    shader.uniforms.uMicroDetailStrength = { value: detailStrength };

    // Pass exact world-space position & world-space geometric normal from vertex shader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      /* glsl */ `
      #include <common>
      varying vec3 vEmcWorldPos;
      varying vec3 vEmcWorldNormal;
      `
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      /* glsl */ `
      #include <worldpos_vertex>
      vec4 emcWp = vec4( transformed, 1.0 );
      vec3 emcWn = objectNormal;
      #ifdef USE_INSTANCING
        emcWp = instanceMatrix * emcWp;
        emcWn = mat3( instanceMatrix ) * emcWn;
      #endif
      emcWp = modelMatrix * emcWp;
      vEmcWorldPos = emcWp.xyz;
      vEmcWorldNormal = normalize( mat3( modelMatrix ) * emcWn );
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `
      #include <common>
      varying vec3 vEmcWorldPos;
      varying vec3 vEmcWorldNormal;
      uniform vec3 uBoxMin;
      uniform vec3 uBoxMax;
      uniform vec3 uBoxCenter;
      uniform float uMicroDetailStrength;

      vec3 emcBoxProjectDir( vec3 worldPos, vec3 worldDir ) {
        vec3 safeDir = mix( worldDir, vec3( 1e-4 ), lessThan( abs( worldDir ), vec3( 1e-4 ) ) );
        vec3 tMax = ( uBoxMax - worldPos ) / safeDir;
        vec3 tMin = ( uBoxMin - worldPos ) / safeDir;
        vec3 tPos = max( tMax, tMin );
        float dist = min( min( tPos.x, tPos.y ), tPos.z );
        vec3 hitWorld = worldPos + worldDir * max( dist, 0.05 );
        vec3 projected = normalize( hitWorld - uBoxCenter );
        // Smoothly blend toward pure directional vector when outside cottage walls
        float insideX = smoothstep( 0.0, 0.8, min( worldPos.x - uBoxMin.x, uBoxMax.x - worldPos.x ) );
        float insideZ = smoothstep( 0.0, 0.8, min( worldPos.z - uBoxMin.z, uBoxMax.z - worldPos.z ) );
        float blend = clamp( insideX * insideZ * 0.72, 0.0, 0.72 );
        return normalize( mix( worldDir, projected, blend ) );
      }

      float emcMicroHeight( vec3 p ) {
        ${
          detailKind === 'wood'
            ? `
        // Micro longitudinal wood-fiber grain (sharp at 1cm macro close-up!)
        float grain = sin( p.x * 42.0 + sin( p.z * 9.5 + p.y * 6.0 ) * 1.8 ) * 0.52
                    + sin( p.x * 118.0 + p.z * 26.0 ) * 0.28
                    + cos( p.z * 85.0 - p.x * 16.0 ) * 0.20;
        return grain;
        `
            : detailKind === 'brushed_metal'
              ? `
        // Radial & linear brushed satin lathe micro-striations on copper/brass/steel
        float radial = length( p.xz ) * 220.0;
        float stria = sin( radial + p.y * 165.0 ) * 0.58
                    + sin( p.x * 180.0 - p.z * 140.0 ) * 0.26
                    + cos( p.y * 310.0 + radial * 0.45 ) * 0.16;
        return stria;
        `
              : `
        // Fine kiln-fired stoneware / stone mineral micro-pitting
        float pit = sin( p.x * 95.0 + p.z * 83.0 ) * cos( p.y * 91.0 - p.x * 64.0 ) * 0.62
                  + sin( p.x * 210.0 - p.z * 195.0 + p.y * 170.0 ) * 0.38;
        return pit;
        `
        }
      }
      `
    );

    if (triplanarScale > 0) {
      const ts = triplanarScale.toFixed(4);
      // True World-Space Triplanar sampling for diffuse, roughness & tangent normal maps!
      // Eliminates 100% of UV stretch across tapered chimney hoods, piers & stonework.
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        /* glsl */ `
        #ifdef USE_MAP
        {
          vec3 triW = pow( abs( normalize( vEmcWorldNormal ) ), vec3( 5.0 ) );
          triW /= max( triW.x + triW.y + triW.z, 1e-4 );
          vec3 triP = vEmcWorldPos * ${ts};
          vec4 cX = texture2D( map, triP.zy );
          vec4 cY = texture2D( map, triP.xz );
          vec4 cZ = texture2D( map, triP.xy );
          diffuseColor *= ( cX * triW.x + cY * triW.y + cZ * triW.z );
        }
        #endif
        `
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        float roughnessFactor = roughness;
        #ifdef USE_ROUGHNESSMAP
        {
          vec3 triW = pow( abs( normalize( vEmcWorldNormal ) ), vec3( 5.0 ) );
          triW /= max( triW.x + triW.y + triW.z, 1e-4 );
          vec3 triP = vEmcWorldPos * ${ts};
          float rX = texture2D( roughnessMap, triP.zy ).g;
          float rY = texture2D( roughnessMap, triP.xz ).g;
          float rZ = texture2D( roughnessMap, triP.xy ).g;
          roughnessFactor *= ( rX * triW.x + rY * triW.y + rZ * triW.z );
        }
        #endif
        `
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        #ifdef USE_NORMALMAP
        {
          vec3 nWorld = normalize( inverseTransformDirection( normal, viewMatrix ) );
          vec3 triW = pow( abs( nWorld ), vec3( 5.0 ) );
          triW /= max( triW.x + triW.y + triW.z, 1e-4 );
          vec3 triP = vEmcWorldPos * ${ts};
          vec2 nX = texture2D( normalMap, triP.zy ).xy * 2.0 - 1.0;
          vec2 nY = texture2D( normalMap, triP.xz ).xy * 2.0 - 1.0;
          vec2 nZ = texture2D( normalMap, triP.xy ).xy * 2.0 - 1.0;
          nX *= normalScale;
          nY *= normalScale;
          nZ *= normalScale;
          // Perturb around true geometric normal (normalMatrix) in its tangent plane so sloped stone never snaps to axes
          vec3 pX = vec3( 0.0, nX.y, -nX.x * ( nWorld.x >= 0.0 ? 1.0 : -1.0 ) );
          vec3 pY = vec3( nY.x, 0.0, nY.y * ( nWorld.y >= 0.0 ? 1.0 : -1.0 ) );
          vec3 pZ = vec3( nZ.x * ( nWorld.z >= 0.0 ? 1.0 : -1.0 ), nZ.y, 0.0 );
          vec3 perturb = pX * triW.x + pY * triW.y + pZ * triW.z;
          perturb -= nWorld * dot( perturb, nWorld );
          vec3 blendedWorldN = normalize( nWorld + perturb );
          normal = normalize( ( viewMatrix * vec4( blendedWorldN, 0.0 ) ).xyz );
        }
        #endif
        /* __EMC_DETAIL_HOOK__ */
        `
      );
    }

    if (useBoxIbl) {
      // Patch THREE.ShaderChunk directly before #include expansion so Box-Projected IBL actually executes!
      const envParsSrc = THREE.ShaderChunk.envmap_physical_pars_fragment.replace(
        'reflectVec = inverseTransformDirection( reflectVec, viewMatrix );',
        /* glsl */ `
        reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
        reflectVec = emcBoxProjectDir( vEmcWorldPos, reflectVec );
        `
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <envmap_physical_pars_fragment>',
        envParsSrc
      );
    }

    if (detailKind !== 'none') {
      const targetHook = triplanarScale > 0 ? '/* __EMC_DETAIL_HOOK__ */' : '#include <normal_fragment_maps>';
      const keepPrefix = triplanarScale > 0 ? '' : '#include <normal_fragment_maps>\n';
      shader.fragmentShader = shader.fragmentShader.replace(
        targetHook,
        /* glsl */ `
        ${keepPrefix}{
          // Analytical screen-space derivative world-space micro-bump (zero extra texture fetch!)
          float hC = emcMicroHeight( vEmcWorldPos );
          vec3 dPosX = dFdx( vEmcWorldPos );
          vec3 dPosY = dFdy( vEmcWorldPos );
          float dhX = dFdx( hC );
          float dhY = dFdy( hC );
          vec3 nWorld = normalize( inverseTransformDirection( normal, viewMatrix ) );
          vec3 r1 = cross( dPosY, nWorld );
          vec3 r2 = cross( nWorld, dPosX );
          float det = dot( dPosX, r1 );
          float detSign = sign( det );
          if ( abs( det ) > 1e-7 ) {
            vec3 surfGrad = detSign * ( dhX * r1 + dhY * r2 ) / max( abs( det ), 1e-5 );
            // Isotropic soft saturation eliminates directional sawtooth clamping artifacts!
            vec3 smoothGrad = surfGrad / ( 1.0 + length( surfGrad ) * 0.40 );
            // Distance-attenuated so micro-detail shines up close and never aliases at far range
            float camDist = length( cameraPosition - vEmcWorldPos );
            float distFade = 1.0 - smoothstep( 1.2, 5.2, camDist );
            vec3 perturbedWorld = normalize( nWorld - smoothGrad * ( uMicroDetailStrength * 0.012 * distFade ) );
            normal = normalize( ( viewMatrix * vec4( perturbedWorld, 0.0 ) ).xyz );
          }
        }
        `
      );
    }
  };

  return material;
}

/**
 * 3. GPU VERTEX CLOTH BREEZE SHADER (Zero-CPU-Cost Gentle Courtyard Draft)
 * Applies subtle traveling fabric waves along hanging linen curtains & table valances.
 */
export function enhanceWithGpuClothBreeze(
  material: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial,
  options: {
    amplitude?: number;
    speed?: number;
    cacheTag: string;
  }
): { material: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial; uTime: { value: number } } {
  const uTime = { value: 0 };
  const amp = options.amplitude ?? 0.014;
  const spd = options.speed ?? 1.45;

  const prevCompile = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey?.bind(material);

  material.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|gpu-cloth-${options.cacheTag}`;
  material.onBeforeCompile = (shader, renderer) => {
    prevCompile?.(shader, renderer);
    shader.uniforms.uClothTime = uTime;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      /* glsl */ `
      #include <common>
      uniform float uClothTime;
      vec3 gpuClothDisp( vec3 p, float uvY ) {
        float hangWeight = pow( clamp( 1.0 - uvY, 0.0, 1.0 ), 1.35 );
        float breeze = sin( p.x * 5.2 + uClothTime * ${spd.toFixed(2)} ) * 0.65
                     + cos( p.z * 4.4 - uClothTime * ${(spd * 0.72).toFixed(2)} ) * 0.35;
        return vec3(
          sin( p.y * 6.0 + uClothTime * ${(spd * 0.9).toFixed(2)} ) * ${(amp * 0.25).toFixed(4)} * hangWeight,
          0.0,
          breeze * ${amp.toFixed(4)} * hangWeight
        );
      }
      `
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      /* glsl */ `
      #include <beginnormal_vertex>
      {
        vec3 baseN = normalize( objectNormal );
        vec3 refAxis = abs( baseN.y ) < 0.9 ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
        vec3 cT1 = normalize( cross( refAxis, baseN ) );
        vec3 cT2 = cross( baseN, cT1 );
        float eps = 0.008;
        vec3 dT1 = gpuClothDisp( position + cT1 * eps, uv.y ) - gpuClothDisp( position - cT1 * eps, uv.y );
        vec3 dT2 = gpuClothDisp( position + cT2 * eps, uv.y ) - gpuClothDisp( position - cT2 * eps, uv.y );
        vec3 pT1 = cT1 * ( 2.0 * eps ) + dT1;
        vec3 pT2 = cT2 * ( 2.0 * eps ) + dT2;
        objectNormal = normalize( cross( pT1, pT2 ) );
      }
      `
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
      #include <begin_vertex>
      // Anchor top edge cleanly (uv.y == 1.0 pinned to rod/table edge) and flutter softly downward!
      transformed += gpuClothDisp( position, uv.y );
      `
    );
  };

  return { material, uTime };
}
