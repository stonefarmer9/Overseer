import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier/flat';

// Feature-Sliced Design import boundaries (see AGENTS.md section 2).
// Layers from highest to lowest. A layer may import only from layers below it.
const LAYERS = ['app', 'widgets', 'features', 'entities', 'shared'];
// Layers split into slices, which must not import each other and must be
// imported through their public API (index.ts, or server.ts for server-only code).
const SLICED_LAYERS = ['widgets', 'features', 'entities'];
const SEE_RULES = 'See AGENTS.md section 2 (Feature-Sliced Design).';

const srcDir = path.join(import.meta.dirname, 'src');

function slicesOf(layer) {
  return fs
    .readdirSync(path.join(srcDir, layer), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function fsdRestrictions(layer, slice) {
  const patterns = [];

  const higherLayers = LAYERS.slice(0, LAYERS.indexOf(layer));
  if (higherLayers.length > 0) {
    patterns.push({
      group: higherLayers.flatMap((higher) => [`@/${higher}`, `@/${higher}/**`]),
      message: `The "${layer}" layer must not import from higher layers (${higherLayers.join(', ')}). ${SEE_RULES}`,
    });
  }

  if (slice) {
    patterns.push({
      group: [`@/${layer}/*`, `@/${layer}/*/**`, `!@/${layer}/${slice}`, `!@/${layer}/${slice}/**`],
      message: `Slices on the "${layer}" layer must not import each other. Move shared code down a layer. ${SEE_RULES}`,
    });
  }

  patterns.push({
    group: SLICED_LAYERS.flatMap((sliced) => [`@/${sliced}/*/**`, `!@/${sliced}/*/server`]).concat(
      slice ? [`!@/${layer}/${slice}/**`] : []
    ),
    message: `Import other slices through their public API (index.ts, or server.ts for server-only code), not their internal files. ${SEE_RULES}`,
  });

  return { 'no-restricted-imports': ['error', { patterns }] };
}

const fsdBoundaries = LAYERS.flatMap((layer) =>
  SLICED_LAYERS.includes(layer)
    ? slicesOf(layer).map((slice) => ({
        name: `fsd/${layer}/${slice}`,
        files: [`src/${layer}/${slice}/**/*.{ts,tsx}`],
        rules: fsdRestrictions(layer, slice),
      }))
    : [
        {
          name: `fsd/${layer}`,
          files: [`src/${layer}/**/*.{ts,tsx}`],
          rules: fsdRestrictions(layer),
        },
      ]
);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettierConfig,
  ...fsdBoundaries,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
