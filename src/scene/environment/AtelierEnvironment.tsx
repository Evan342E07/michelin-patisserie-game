import React from 'react';
import { PatisserieAtrium } from './PatisserieAtrium';
import { HaussmannSalonArchitecture } from './HaussmannSalonArchitecture';
import { PatisserieEquipment } from '../props/PatisserieEquipment';
import { ArtisanAtelierFurnishings } from '../props/ArtisanAtelierFurnishings';
import { ProvenceStorybookGarden } from './ProvenceStorybookGarden';
import { FrenchFormalManorGarden } from './FrenchFormalManorGarden';

/**
 * Complete Parisian Haute Pâtisserie Conservatory & Salon Environment
 * Composes core atrium & workstation equipment (untouched) with warm Belle-Époque
 * salon lighting, woven Aubusson rug, framed lithographs, and full perimeter furnishings.
 */
export const AtelierEnvironment: React.FC = () => {
  return (
    <group>
      <PatisserieAtrium />
      <PatisserieEquipment />
      <HaussmannSalonArchitecture />
      <ArtisanAtelierFurnishings />
      <ProvenceStorybookGarden />
      <FrenchFormalManorGarden />
    </group>
  );
};

export { PatisserieAtrium, HaussmannSalonArchitecture };
export default AtelierEnvironment;
