/**
 * Plant Perception Pathways: a host of @actualizer/perception-core 0.3.0 (KICKOFF §8.1; K40). This app supplies the pack
 * (its content build's JSON), its theme (Greenhouse Explorer's: index.css + tailwind.config.js), its device-storage
 * namespace and its interface copy. Modules: none (no atlas, no vagus lens; app-requirements §2.2).
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Explorer, definePack } from '@actualizer/perception-core';
import './index.css';
import { HOST_STRINGS } from './host-strings';
import { applyFonts, fontsAfterLoad, fontsBeforeFirstRender } from './lib/fonts';

// UI-33: where this app links its pack's 101s (app-methods §12.2); a slot whose 101 the pack lacks shows nothing
const CONCEPT_LINKS = {
  stage_row: 'how-a-path-is-curated',
  hierarchy: 'how-a-path-is-curated',
  viewer: 'reading-a-structure',
  computed_badge: 'experimental-vs-predicted',
} as const;

// app-requirements §3.3: the Greenhouse Explorer mark (public/brand/web, byte for byte from greenhouse-explorer at
// 32a18ad) in the core's header logo slot (0.3.0 B9); decorative, the wordmark names the app
const BASE = import.meta.env.BASE_URL;
const LOGO = (
  <>
    <img src={`${BASE}brand/web/mark-64.png`} alt="" width={30} height={30} className="gx-mark gx-mark-light" />
    <img src={`${BASE}brand/web/mark-dark-64.png`} alt="" width={30} height={30} className="gx-mark gx-mark-dark" />
  </>
);

// the four files the shell and the home page need are in the entry chunk; every other file is its own chunk
const pack = definePack(
  import.meta.glob('./data/{manifest,strings,paths,molecules-index}.json', { eager: true, import: 'default' }),
  import.meta.glob(['./data/*.json', '!./data/{manifest,strings,paths,molecules-index}.json'], { import: 'default' }),
);

const render = () =>
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Explorer pack={pack} theme={{ name: 'greenhouse' }} storageNamespace="plant-perception-pathways" appTitle="Plant Perception Pathways" strings={HOST_STRINGS} modules={[]} conceptLinks={CONCEPT_LINKS} logo={LOGO} />
    </React.StrictMode>,
  );

// Greenhouse Explorer's deferred-font pattern (src/lib/fonts.ts): cached faces before the first frame; otherwise
// fetched (from dist/) after load and applied on the reader's first in-app navigation.
window.addEventListener('hashchange', () => applyFonts(), { once: true });
void fontsBeforeFirstRender().then(() => {
  render();
  fontsAfterLoad();
});
