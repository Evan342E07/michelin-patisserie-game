export type StepId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type CoutureFlavorId = 'raspberry_vanilla' | 'chocolate_gold' | 'matcha_yuzu';
export type FlavorId = CoutureFlavorId;

export interface FlavorMechanicsSpec {
  ovenTargetTemp: number;
  coulisTargetTemp: number;
  temperCrystalTemp: number;
  temperWorkingTemp: number;
  glazeTargetTemp: number;
}

export type CameraOverride =
  | 'station'
  | 'atelier_grand'
  | 'island_top'
  | 'tasting_closeup'
  | 'tea_tasting'
  | 'hearth_cozy'
  | 'garden_creek';

export type CameraPreset = CameraOverride;

export type JudgmentTier = 'parfait' | 'tres_bien' | 'passable';

export interface JudgmentFeedback {
  id: number;
  tier: JudgmentTier;
  titleFr: string;
  titleCn: string;
  detailCn?: string;
  score?: number;
}

export interface StepConfig {
  id: StepId;
  roman: string;
  titleCn: string;
  titleFr: string;
  stationCn: string;
  keyMetricLabel: string;
  chefTip: string;
  camPos: [number, number, number];
  camTarget: [number, number, number];
  fov: number;
}

export interface EightLayerMeta {
  id: string;
  index: string;
  titleCn: string;
  titleFr: string;
  spec: string;
  side: 'left' | 'right';
  baseY: number;
  explodeOffset: number;
  anchorRadius: number;
}

export interface ScreenCallout {
  id: string;
  index: string;
  titleCn: string;
  titleFr: string;
  spec: string;
  side: 'left' | 'right';
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  visible: boolean;
}
