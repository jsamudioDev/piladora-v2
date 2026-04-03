/**
 * gen-icons.mjs — genera pwa-192.png y pwa-512.png desde un SVG inline.
 * Uso: node scripts/gen-icons.mjs
 */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '../public');

// SVG del ícono de la app — círculo púrpura con letra P
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#7c6af7"/>
  <text x="256" y="340" font-family="system-ui,sans-serif" font-size="300"
        font-weight="700" fill="#ffffff" text-anchor="middle">P</text>
</svg>`;

for (const size of [192, 512]) {
  const resvg = new Resvg(SVG, { fitTo: { mode: 'width', value: size } });
  const png   = resvg.render().asPng();
  writeFileSync(resolve(PUBLIC, `pwa-${size}.png`), png);
  console.log(`✓ pwa-${size}.png generado`);
}
