// Builds data/geography/world-map.json (SVG paths per country) from a Natural Earth
// TopoJSON file such as world-atlas countries-50m.json.
// Run: node scripts/build-map.mjs path/to/countries-50m.json
import { readFile, writeFile } from 'node:fs/promises';

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/build-map.mjs countries-50m.json'); process.exit(1); }

const topo = JSON.parse(await readFile(src, 'utf8'));
const deck = JSON.parse(await readFile('data/geography/countries.json', 'utf8'));

// Natural Earth names that differ from the deck's country names.
const RENAME = {
  'Dem. Rep. Congo': 'Democratic Republic of the Congo',
  'Congo': 'Republic of the Congo',
  'Dominican Rep.': 'Dominican Republic',
  'Central African Rep.': 'Central African Republic',
  'Eq. Guinea': 'Equatorial Guinea',
  'Bosnia and Herz.': 'Bosnia and Herzegovina',
  'Czech Rep.': 'Czechia',
  'Macedonia': 'North Macedonia',
  'Swaziland': 'Eswatini',
  'eSwatini': 'Eswatini',
  'S. Sudan': 'South Sudan',
  'Solomon Is.': 'Solomon Islands',
  'Marshall Is.': 'Marshall Islands',
  'Fed. States of Micronesia': 'Micronesia',
  'Micronesia (Fed. States of)': 'Micronesia',
  'Cabo Verde': 'Cabo Verde',
  'Cape Verde': 'Cabo Verde',
  'Cote d\'Ivoire': 'Côte d\'Ivoire',
  'Ivory Coast': 'Côte d\'Ivoire',
  'Timor-Leste': 'Timor-Leste',
  'East Timor': 'Timor-Leste',
  'St. Kitts and Nevis': 'Saint Kitts and Nevis',
  'St. Vin. and Gren.': 'Saint Vincent and the Grenadines',
  'Saint Vincent and the Grenadines': 'Saint Vincent and the Grenadines',
  'Saint Lucia': 'Saint Lucia',
  'St. Lucia': 'Saint Lucia',
  'Antigua and Barb.': 'Antigua and Barbuda',
  'Sao Tome and Principe': 'São Tomé and Príncipe',
  'São Tomé and Principe': 'São Tomé and Príncipe',
  'Brunei': 'Brunei',
  'Myanmar': 'Myanmar',
  'Turkey': 'Turkey',
  'Vatican': 'Vatican City',
  'N. Cyprus': null,
  'Somaliland': null,
  'Kosovo': null,
  'W. Sahara': null,
  'Taiwan': null,
  'Antarctica': null,
  'Fr. S. Antarctic Lands': null,
  'Falkland Is.': null,
  'Greenland': null,
  'New Caledonia': null,
  'Puerto Rico': null,
  'Palestine': 'Palestine',
  'United States of America': 'United States',
};

// Translate the shared-arc topology into rings of [lon, lat].
const { scale, translate } = topo.transform;
const arcs = topo.arcs.map((arc) => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * scale[0] + translate[0], y * scale[1] + translate[1]]; });
});
const ring = (idx) => idx.flatMap((i) => (i >= 0 ? arcs[i] : [...arcs[~i]].reverse()).slice(1));

// Natural Earth projection (Šavrič et al. 2015).
function project(lon, lat) {
  const l = (lon * Math.PI) / 180, p = (lat * Math.PI) / 180;
  const p2 = p * p, p4 = p2 * p2;
  return [
    l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))),
    -p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4))),
  ];
}

const W = 1000;
const K = W / (2 * project(180, 0)[0]);
const H = Math.round(-project(0, 90)[1] * K * 2);
const px = (lon, lat) => { const [x, y] = project(lon, lat); return [x * K + W / 2, y * K + H / 2]; };
const f = (n) => String(Math.round(n * 10) / 10);

function pathOf(rings) {
  let d = '';
  for (const r of rings) {
    let prev = null;
    const pts = [];
    for (const [lon, lat] of r) {
      const [x, y] = px(lon, lat);
      if (prev && Math.hypot(x - prev[0], y - prev[1]) < 0.7) continue;
      pts.push(f(x) + ' ' + f(y));
      prev = [x, y];
    }
    if (pts.length < 3) continue;
    d += `M${pts.join('L')}Z`;
  }
  return d;
}

function unwrap(r) {
  const out = [];
  let shift = 0, wrapped = false;
  r.forEach(([lon, lat], i) => {
    if (i) {
      const d = lon + shift - out[i - 1][0];
      if (d > 180) { shift -= 360; wrapped = true; } else if (d < -180) { shift += 360; wrapped = true; }
    }
    out.push([lon + shift, lat]);
  });
  if (!wrapped) return [r];
  const mean = out.reduce((a, p) => a + p[0], 0) / out.length;
  const copy = (k) => out.map(([lon, lat]) => [lon + k, lat]);
  return [out, copy(mean > 0 ? -360 : 360)];
}
const byName = new Map(deck.items.map((it) => [it.name, it]));
const shapes = {};
const centroids = {};
const extent = {};
const background = [];
const unmatched = [];
for (const g of topo.objects.countries.geometries) {
  let name = g.properties.name;
  if (name in RENAME) name = RENAME[name];
  if (name === null) { if (!['Antarctica', 'Fr. S. Antarctic Lands'].includes(g.properties.name)) background.push(pathOf((g.type === 'Polygon' ? [g.arcs] : g.arcs).flatMap((poly) => poly.map(ring)).flatMap(unwrap))); continue; }
  if (!byName.has(name)) { unmatched.push(g.properties.name); continue; }
  const polys = g.type === 'Polygon' ? [g.arcs] : g.arcs;
  const rings = polys.flatMap((poly) => poly.map(ring)).flatMap(unwrap);
  // Centroid of the largest ring (by bounding box) for marker placement.
  let best = null, bestArea = -1;
  for (const r of rings) {
    const xs = r.map((p) => p[0]), ys = r.map((p) => p[1]);
    const a = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    if (a > bestArea) { bestArea = a; best = [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2]; }
  }
  const [cx, cy] = px(...best);
  shapes[name] = pathOf(rings);
  extent[name] = Math.max(...polys.flatMap((poly) => poly.map((rg) => { const xs = ring(rg).map((p) => px(...p)[0]); return Math.max(...xs) - Math.min(...xs); })).map((w) => (w > 500 ? 0 : w)));
  centroids[name] = [Math.round(cx * 10) / 10, Math.round(cy * 10) / 10];
}

// Countries too small for the 1:50m dataset get a marker at their (lon, lat).
const POINTS = {
  'Andorra': [1.6, 42.5], 'Antigua and Barbuda': [-61.8, 17.1], 'Bahrain': [50.55, 26.05], 'Barbados': [-59.55, 13.2],
  'Cabo Verde': [-23.6, 15.1], 'Comoros': [43.35, -11.75], 'Dominica': [-61.35, 15.4], 'Grenada': [-61.7, 12.1],
  'Kiribati': [173, 1.4], 'Liechtenstein': [9.55, 47.15], 'Maldives': [73.5, 3.2], 'Malta': [14.4, 35.9],
  'Marshall Islands': [171.2, 7.1], 'Mauritius': [57.55, -20.25], 'Micronesia': [158.2, 6.9], 'Monaco': [7.4, 43.74],
  'Nauru': [166.93, -0.53], 'Palau': [134.5, 7.5], 'Saint Kitts and Nevis': [-62.75, 17.35], 'Saint Lucia': [-60.98, 13.9],
  'Saint Vincent and the Grenadines': [-61.2, 13.25], 'Samoa': [-172.4, -13.75], 'San Marino': [12.46, 43.94],
  'São Tomé and Príncipe': [6.7, 0.3], 'Seychelles': [55.5, -4.65], 'Singapore': [103.82, 1.35], 'Tonga': [-175.2, -21.2],
  'Tuvalu': [179.2, -8.5], 'Vatican City': [12.45, 41.9], 'Bahamas': [-77.4, 25.0], 'Trinidad and Tobago': [-61.2, 10.5],
  'Fiji': [178, -17.8], 'Vanuatu': [167, -16.2], 'Solomon Islands': [160, -9.6], 'Brunei': [114.7, 4.5],
  'Timor-Leste': [125.9, -8.8], 'Luxembourg': [6.1, 49.8], 'Kuwait': [47.6, 29.3], 'Qatar': [51.2, 25.3],
};
const SMALL_WITH_SHAPE = ['Kiribati', 'Bahrain', 'Luxembourg', 'Kuwait', 'Qatar', 'Brunei', 'Timor-Leste', 'Fiji', 'Vanuatu', 'Solomon Islands', 'Trinidad and Tobago', 'Bahamas'];
// Anything under ~8px wide at world scale also gets a clickable marker (and loses an unreadable sliver of a shape).
const points = {};
for (const it of deck.items) {
  const n = it.name;
  const tiny = !(n in shapes) || extent[n] < 8 || !shapes[n];
  if (!tiny && !SMALL_WITH_SHAPE.includes(n)) continue;
  const ll = POINTS[n];
  if (ll) points[n] = px(...ll).map((v) => Math.round(v * 10) / 10);
  else if (centroids[n]) points[n] = centroids[n];
  else { console.warn('no geometry or point for', n); continue; }
  if (!shapes[n]) delete shapes[n];
}
console.log('unmatched topology names (ignored):', unmatched.join(', ') || 'none');
console.log(`${Object.keys(shapes).length} shapes, ${Object.keys(points).length} markers`);
const missing = deck.items.filter((it) => !(it.name in shapes) && !(it.name in points)).map((it) => it.name);
if (missing.length) console.warn('MISSING:', missing.join(', '));

// Pan/zoom boxes per region as [lonW, latS, lonE, latN] -> SVG viewBox. Oceania runs past 180 so Samoa and Tonga fit.
const BOXES = {
  Global: null,
  'North America': [-170, 4, -48, 84],
  'South America': [-93, -57, -30, 14],
  Europe: [-27, 34, 45, 72],
  Africa: [-20, -36, 53, 38],
  Asia: [25, -12, 150, 78],
  Oceania: [108, -50, 196, 4],
};
const regions = {};
for (const [name, b] of Object.entries(BOXES)) {
  if (!b) { regions[name] = [0, 0, W, H]; continue; }
  const [x0, y1] = px(b[0], b[1]), [x1, y0] = px(b[2], b[3]);
  regions[name] = [x0, y0, x1 - x0, y1 - y0].map((v) => Math.round(v * 10) / 10);
}
// Positions east of the antimeridian for the Oceania view.
const wrap = {};
for (const n of ['Samoa', 'Tonga', 'Tuvalu', 'Kiribati']) wrap[n] = px(POINTS[n][0] < 0 ? POINTS[n][0] + 360 : POINTS[n][0], POINTS[n][1]).map((v) => Math.round(v * 10) / 10);

await writeFile('data/geography/world-map.json', JSON.stringify({ width: W, height: H, regions, shapes, background, centroids, points, wrap }));
