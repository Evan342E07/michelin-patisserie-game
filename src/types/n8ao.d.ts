declare module 'n8ao' {
  import type * as THREE from 'three';
  import type { Pass } from 'three/examples/jsm/postprocessing/Pass.js';

  export const DepthType: {
    readonly Default: 1;
    readonly Log: 2;
    readonly Reverse: 3;
  };

  export type N8AOQualityMode =
    | 'Performance'
    | 'Low'
    | 'Medium'
    | 'High'
    | 'Ultra'
    | 'Neural-Performance'
    | 'Neural-Low'
    | 'Neural-Medium'
    | 'Neural-High';

  export type N8AODisplayMode = 'Combined' | 'AO' | 'No AO' | 'Split' | 'Split AO';

  export interface N8AOConfiguration {
    aoSamples: number;
    aoRadius: number;
    aoTones: number;
    denoiseSamples: number;
    denoiseRadius: number;
    distanceFalloff: number;
    intensity: number;
    denoiseIterations: number;
    renderMode: 0 | 1 | 2 | 3 | 4;
    biasOffset: number;
    biasMultiplier: number;
    color: THREE.Color;
    gammaCorrection: boolean;
    depthBufferType: 1 | 2 | 3;
    screenSpaceRadius: boolean;
    halfRes: boolean;
    depthAwareUpsampling: boolean;
    autoRenderBeauty: boolean;
    colorMultiply: boolean;
    transparencyAware: boolean;
    stencil: boolean;
    accumulate: boolean;
    neuralDenoise: boolean;
  }

  export interface N8AODisposableQuad {
    material?: THREE.Material;
    dispose?: () => void;
  }

  export class N8AOPass extends Pass {
    scene: THREE.Scene;
    camera: THREE.Camera;
    width: number;
    height: number;
    lastTime: number;
    configuration: N8AOConfiguration;

    beautyRenderTarget?: THREE.WebGLRenderTarget | null;
    writeTargetInternal?: THREE.WebGLRenderTarget | null;
    readTargetInternal?: THREE.WebGLRenderTarget | null;
    accumulationRenderTarget?: THREE.WebGLRenderTarget | null;
    depthDownsampleTarget?: THREE.WebGLRenderTarget | null;
    transparencyRenderTargetDWFalse?: THREE.WebGLRenderTarget | null;
    transparencyRenderTargetDWTrue?: THREE.WebGLRenderTarget | null;
    bluenoise?: THREE.DataTexture | null;
    depthMipAtlas?: { target?: THREE.WebGLRenderTarget | null; dispose?: () => void } | null;

    effectShaderQuad?: N8AODisposableQuad | null;
    poissonBlurQuad?: N8AODisposableQuad | null;
    effectCompositerQuad?: N8AODisposableQuad | null;
    depthDownsampleQuad?: N8AODisposableQuad | null;
    depthCopyPass?: N8AODisposableQuad | null;
    accumulationQuad?: N8AODisposableQuad | null;

    standardDenoiseMaterial?: THREE.ShaderMaterial | null;
    neuralDenoiseMaterial?: THREE.ShaderMaterial | null;
    standardCompositerMaterial?: THREE.ShaderMaterial | null;
    neuralCompositerMaterial?: THREE.ShaderMaterial | null;

    constructor(scene: THREE.Scene, camera: THREE.Camera, width?: number, height?: number);

    setQualityMode(mode: N8AOQualityMode): void;
    setDisplayMode(mode: N8AODisplayMode): void;
    setSize(width: number, height: number): void;
    enableDebugMode(): void;
    disableDebugMode(): void;
    firstFrame(): void;
  }

  export class N8AOPostPass extends Pass {
    constructor(scene: THREE.Scene, camera: THREE.Camera, width?: number, height?: number);
    setQualityMode(mode: N8AOQualityMode): void;
    setDisplayMode(mode: N8AODisplayMode): void;
    setSize(width: number, height: number): void;
  }
}
