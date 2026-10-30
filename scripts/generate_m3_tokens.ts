import {
  argbFromHex,
  hexFromArgb,
  Hct,
  SchemeTonalSpot,
  SchemeNeutral,
  SchemeFidelity,
  SchemeContent,
  MaterialDynamicColors,
} from '../web/node_modules/@material/material-color-utilities/index.js';

const seedHex = '#E59500';
const argb = argbFromHex(seedHex);
const hct = Hct.fromInt(argb);
const mdc = MaterialDynamicColors;

console.log('Seed:', seedHex, 'HCT:', Math.round(hct.hue), Math.round(hct.chroma), Math.round(hct.tone));

const variants = [
  { name: 'SchemeTonalSpot', SchemeClass: SchemeTonalSpot },
  { name: 'SchemeNeutral', SchemeClass: SchemeNeutral },
  { name: 'SchemeFidelity', SchemeClass: SchemeFidelity },
  { name: 'SchemeContent', SchemeClass: SchemeContent },
];

for (const { name, SchemeClass } of variants) {
  const light = new SchemeClass(hct, false, 0.0);
  const dark = new SchemeClass(hct, true, 0.0);

  console.log(`\n========================================`);
  console.log(`=== VARIANT: ${name} ===`);
  console.log(`========================================`);
  
  console.log('LIGHT:');
  console.log('  primary:', hexFromArgb(mdc.primary.getArgb(light)));
  console.log('  onPrimary:', hexFromArgb(mdc.onPrimary.getArgb(light)));
  console.log('  primaryContainer:', hexFromArgb(mdc.primaryContainer.getArgb(light)));
  console.log('  onPrimaryContainer:', hexFromArgb(mdc.onPrimaryContainer.getArgb(light)));
  console.log('  secondary:', hexFromArgb(mdc.secondary.getArgb(light)));
  console.log('  onSecondary:', hexFromArgb(mdc.onSecondary.getArgb(light)));
  console.log('  secondaryContainer:', hexFromArgb(mdc.secondaryContainer.getArgb(light)));
  console.log('  onSecondaryContainer:', hexFromArgb(mdc.onSecondaryContainer.getArgb(light)));
  console.log('  tertiary:', hexFromArgb(mdc.tertiary.getArgb(light)));
  console.log('  onTertiary:', hexFromArgb(mdc.onTertiary.getArgb(light)));
  console.log('  tertiaryContainer:', hexFromArgb(mdc.tertiaryContainer.getArgb(light)));
  console.log('  onTertiaryContainer:', hexFromArgb(mdc.onTertiaryContainer.getArgb(light)));
  console.log('  surface:', hexFromArgb(mdc.surface.getArgb(light)));
  console.log('  surfaceDim:', hexFromArgb(mdc.surfaceDim.getArgb(light)));
  console.log('  surfaceBright:', hexFromArgb(mdc.surfaceBright.getArgb(light)));
  console.log('  surfaceContainerLowest:', hexFromArgb(mdc.surfaceContainerLowest.getArgb(light)));
  console.log('  surfaceContainerLow:', hexFromArgb(mdc.surfaceContainerLow.getArgb(light)));
  console.log('  surfaceContainer:', hexFromArgb(mdc.surfaceContainer.getArgb(light)));
  console.log('  surfaceContainerHigh:', hexFromArgb(mdc.surfaceContainerHigh.getArgb(light)));
  console.log('  surfaceContainerHighest:', hexFromArgb(mdc.surfaceContainerHighest.getArgb(light)));
  console.log('  onSurface:', hexFromArgb(mdc.onSurface.getArgb(light)));
  console.log('  onSurfaceVariant:', hexFromArgb(mdc.onSurfaceVariant.getArgb(light)));
  console.log('  outline:', hexFromArgb(mdc.outline.getArgb(light)));
  console.log('  outlineVariant:', hexFromArgb(mdc.outlineVariant.getArgb(light)));

  console.log('DARK:');
  console.log('  primary:', hexFromArgb(mdc.primary.getArgb(dark)));
  console.log('  onPrimary:', hexFromArgb(mdc.onPrimary.getArgb(dark)));
  console.log('  primaryContainer:', hexFromArgb(mdc.primaryContainer.getArgb(dark)));
  console.log('  onPrimaryContainer:', hexFromArgb(mdc.onPrimaryContainer.getArgb(dark)));
  console.log('  secondary:', hexFromArgb(mdc.secondary.getArgb(dark)));
  console.log('  onSecondary:', hexFromArgb(mdc.onSecondary.getArgb(dark)));
  console.log('  secondaryContainer:', hexFromArgb(mdc.secondaryContainer.getArgb(dark)));
  console.log('  onSecondaryContainer:', hexFromArgb(mdc.onSecondaryContainer.getArgb(dark)));
  console.log('  tertiary:', hexFromArgb(mdc.tertiary.getArgb(dark)));
  console.log('  onTertiary:', hexFromArgb(mdc.onTertiary.getArgb(dark)));
  console.log('  tertiaryContainer:', hexFromArgb(mdc.tertiaryContainer.getArgb(dark)));
  console.log('  onTertiaryContainer:', hexFromArgb(mdc.onTertiaryContainer.getArgb(dark)));
  console.log('  surface:', hexFromArgb(mdc.surface.getArgb(dark)));
  console.log('  surfaceDim:', hexFromArgb(mdc.surfaceDim.getArgb(dark)));
  console.log('  surfaceBright:', hexFromArgb(mdc.surfaceBright.getArgb(dark)));
  console.log('  surfaceContainerLowest:', hexFromArgb(mdc.surfaceContainerLowest.getArgb(dark)));
  console.log('  surfaceContainerLow:', hexFromArgb(mdc.surfaceContainerLow.getArgb(dark)));
  console.log('  surfaceContainer:', hexFromArgb(mdc.surfaceContainer.getArgb(dark)));
  console.log('  surfaceContainerHigh:', hexFromArgb(mdc.surfaceContainerHigh.getArgb(dark)));
  console.log('  surfaceContainerHighest:', hexFromArgb(mdc.surfaceContainerHighest.getArgb(dark)));
  console.log('  onSurface:', hexFromArgb(mdc.onSurface.getArgb(dark)));
  console.log('  onSurfaceVariant:', hexFromArgb(mdc.onSurfaceVariant.getArgb(dark)));
  console.log('  outline:', hexFromArgb(mdc.outline.getArgb(dark)));
  console.log('  outlineVariant:', hexFromArgb(mdc.outlineVariant.getArgb(dark)));
}
