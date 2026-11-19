/**
 * Plant Perception Pathways: a host of @actualizer/perception-core 0.1.0 (KICKOFF §8.1). This app supplies the pack
 * (its content build's JSON), its theme (Greenhouse Explorer's: index.css + tailwind.config.js), its device-storage
 * namespace and its interface copy. Modules: none (no atlas, no vagus lens; app-requirements §2.2).
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Explorer, definePack } from '@actualizer/perception-core';
import './index.css';
import { HOST_STRINGS } from './host-strings';
import { applyFonts, fontsAfterLoad, fontsBeforeFirstRender } from './lib/fonts';

// the four files the shell and the home page need are in the entry chunk; every other file is its own chunk
const pack = definePack(
  import.meta.glob('./data/{manifest,strings,paths,molecules-index}.json', { eager: true, import: 'default' }),
  import.meta.glob(['./data/*.json', '!./data/{manifest,strings,paths,molecules-index}.json'], { import: 'default' }),
);

const render = () =>
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Explorer pack={pack} theme={{ name: 'greenhouse' }} storageNamespace="plant-perception-pathways" appTitle="Plant Perception Pathways" strings={HOST_STRINGS} modules={[]} />
    </React.StrictMode>,
  );

// Greenhouse Explorer's deferred-font pattern (src/lib/fonts.ts): cached faces before the first frame; otherwise
// fetched (from dist/) after load and applied on the reader's first in-app navigation.
window.addEventListener('hashchange', () => applyFonts(), { once: true });
void fontsBeforeFirstRender().then(() => {
  render();
  fontsAfterLoad();
});
