// Generates the CKAgram logo ("Level-Up Stack"), app icons, splash image and wordmark.
// Three containers climbing like stairs: Kubernetes + leveling up.
// Run: node scripts/make-brand.mjs   (outputs into assets/brand/)
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets', 'brand');
const font = join(root, 'assets', 'fonts', 'LilitaOne-Regular.ttf');
mkdirSync(join(out, 'src'), { recursive: true });

export const BRAND = {
  navy: '#101426',
  gold: ['#FFE08A', '#FFB020', '#E08A00'],
  pink: ['#FFA3BC', '#FF4F79', '#D92D5A'],
  blue: ['#A9C4FF', '#3D7BFF', '#2350C8'],
};

// Isometric cube: top, left and right faces.
function cube(cx, cy, s, [top, left, right], opacity = [1, 1, 1]) {
  const h = s * 0.58;
  const d = s * 1.05;
  return `<polygon points="${cx},${cy - h} ${cx + s},${cy} ${cx},${cy + h} ${cx - s},${cy}" fill="${top}" fill-opacity="${opacity[0]}"/>
  <polygon points="${cx - s},${cy} ${cx},${cy + h} ${cx},${cy + h + d} ${cx - s},${cy + d}" fill="${left}" fill-opacity="${opacity[1]}"/>
  <polygon points="${cx + s},${cy} ${cx},${cy + h} ${cx},${cy + h + d} ${cx + s},${cy + d}" fill="${right}" fill-opacity="${opacity[2]}"/>`;
}

/** The mark on a 1024 canvas, centered. mono = single-color silhouette for themed icons. */
function glyph(scale = 1, mono = false) {
  const c = (colors) => (mono ? ['#fff', '#fff', '#fff'] : colors);
  const o = mono ? [1, 0.72, 0.5] : [1, 1, 1];
  const sparkFill = mono ? '#fff' : '#fff';
  return `<g transform="translate(512 512) scale(${scale}) translate(-512 -478)">
    ${cube(330, 600, 118, c(BRAND.gold), o)}
    ${cube(512, 480, 118, c(BRAND.pink), o)}
    ${cube(694, 360, 118, c(BRAND.blue), o)}
    <circle cx="694" cy="190" r="26" fill="${sparkFill}"/>
    <circle cx="790" cy="240" r="14" fill="${sparkFill}" opacity="0.8"/>
    <circle cx="610" cy="215" r="12" fill="${sparkFill}" opacity="0.6"/>
  </g>`;
}

const glow = `<radialGradient id="glow" cx="0.5" cy="0.42" r="0.6"><stop offset="0" stop-color="#1D2550"/><stop offset="1" stop-color="${BRAND.navy}"/></radialGradient>`;
const svg = (w, h, body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;

const files = {
  'icon.png': svg(1024, 1024, `<rect width="1024" height="1024" rx="236" fill="url(#glow)"/>${glyph(1)}`, glow),
  // Android adaptive icon: the foreground stays inside the ~61% safe circle.
  'android-icon-background.png': svg(1024, 1024, `<rect width="1024" height="1024" fill="url(#glow)"/>`, glow),
  'android-icon-foreground.png': svg(1024, 1024, glyph(0.72)),
  'android-icon-monochrome.png': svg(1024, 1024, glyph(0.72, true)),
  'splash-icon.png': svg(512, 512, `<g transform="scale(0.5)">${glyph(0.95)}</g>`),
  'mark.png': svg(256, 256, `<rect width="256" height="256" rx="60" fill="url(#glow)"/><g transform="scale(0.25)">${glyph(1)}</g>`, glow),
};

for (const [name, source] of Object.entries(files)) {
  writeFileSync(join(out, name), new Resvg(source).render().asPng());
  writeFileSync(join(out, 'src', name.replace('.png', '.svg')), source);
}

// Wordmark: "CKA" in white, "gram" in gold. Transparent, for the dark header.
const word = svg(
  640,
  180,
  `<text x="320" y="130" text-anchor="middle" font-family="Lilita One" font-size="132" fill="#fff">CKA<tspan fill="${BRAND.gold[1]}">gram</tspan></text>`
);
writeFileSync(
  join(out, 'wordmark.png'),
  new Resvg(word, { font: { fontFiles: [font], loadSystemFonts: false, defaultFontFamily: 'Lilita One' } }).render().asPng()
);
writeFileSync(join(out, 'src', 'wordmark.svg'), word);

console.log('brand assets written to', out);
