/** Vitest: install this app's pack before a test file imports perception-core modules (they read it at load time). */
import { installPack } from '../node_modules/@actualizer/perception-core/src/pack';
import { HOST_STRINGS } from '../src/host-strings';

installPack(import.meta.glob('../src/data/*.json', { eager: true, import: 'default' }), {
  storageNamespace: 'plant-perception-pathways',
  theme: { name: 'greenhouse' },
  modules: [],
  strings: HOST_STRINGS,
  appTitle: 'Plant Perception Pathways',
});
