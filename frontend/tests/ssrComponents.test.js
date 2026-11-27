import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import esbuild from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const ssrCacheDir = path.join(frontendRoot, 'node_modules', '.cache', 'aurapulse-ssr-test');

async function loadJsxModule(relPath) {
  fs.mkdirSync(ssrCacheDir, { recursive: true });
  const entryPath = path.join(frontendRoot, relPath);
  const outName = `${path.basename(relPath, '.jsx')}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.mjs`;
  const outPath = path.join(ssrCacheDir, outName);

  await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    outfile: outPath,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    plugins: [
      {
        name: 'ignore-css',
        setup(build) {
          build.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'js' }));
        },
      },
    ],
  });

  return import(pathToFileURL(outPath).href);
}

after(() => {
  fs.rmSync(ssrCacheDir, { recursive: true, force: true });
});

describe('Frontend React SSR Component Integrity & Accessibility', () => {
  it('renders Footer with accessible semantic headings and safe GitHub external links', async () => {
    const { default: Footer } = await loadJsxModule('src/components/Footer/Footer.jsx');
    const html = renderToStaticMarkup(React.createElement(Footer, { onSelectTab: () => {} }));
    assert.match(html, /<footer/);
    assert.match(html, /<h2 class="footer-col-title">Explore<\/h2>/);
    assert.match(html, /rel="noopener noreferrer"/);
    assert.match(html, /aria-label="Footer navigation"/);
  });

  it('renders ErrorBoundary wrapping healthy children seamlessly', async () => {
    const { default: ErrorBoundary } = await loadJsxModule('src/components/ErrorBoundary.jsx');
    const html = renderToStaticMarkup(
      React.createElement(ErrorBoundary, null, React.createElement('div', null, 'Healthy Child')),
    );
    assert.match(html, /Healthy Child/);
  });

  it('renders Room3dTwin with toggle aria-pressed states, economics & ₹0 fixes', async () => {
    const { default: Room3dTwin } = await loadJsxModule('src/components/IndoorAirSimulator/Room3dTwin.jsx');
    const html = renderToStaticMarkup(
      React.createElement(Room3dTwin, {
        fanPreviewOn: true,
        setFanPreviewOn: () => {},
        displayedPm: 32,
        diyTotalCadr: 350,
        outdoorPM: 165,
        sealType: 'other',
        source: 'other',
        customSourceDesc: 'Candles',
        econ: {
          filter_life_days: 45,
          yearly_savings_estimate: '₹14,200/yr',
          monthly_electricity_cost: '₹95/mo',
        },
        hacks: [{ emoji: '🪟', label: 'Seal balcony gap' }],
      }),
    );
    assert.match(html, /3D Room Air Twin/);
    assert.match(html, /aria-pressed="true"/);
    assert.match(html, /~45 Days/);
    assert.match(html, /Seal balcony gap/);
  });

  it('renders SymptomDetectivePanel with accessible input labels and doctor summary', async () => {
    const { default: SymptomDetectivePanel } = await loadJsxModule(
      'src/components/FamilyAdviceCard/SymptomDetectivePanel.jsx',
    );
    const html = renderToStaticMarkup(
      React.createElement(SymptomDetectivePanel, {
        onCheckSymptom: () => {},
        loading: false,
        symptomResult: {
          trigger_emoji: '🕯️',
          likely_trigger: 'Indoor candle smoke',
          confidence_pct: 91,
          rescue_stickers: [{ emoji: '🌀', action: 'Purifier Max' }],
          doctor_summary: 'Patient reported wheeze during indoor candle soot spike.',
        },
      }),
    );
    assert.match(html, /aria-label="Describe custom symptom"/);
    assert.match(html, /Indoor candle smoke/);
    assert.match(html, /91% match/);
    assert.match(html, /Copy Doctor Note/);
  });
});
