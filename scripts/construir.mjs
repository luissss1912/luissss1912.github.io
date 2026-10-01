// Genera la web completa en la carpeta "dist".
// Uso: npm run construir            (descarga los precios de hoy)
//      npm run construir -- --sin-descarga   (usa la última descarga guardada)
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { descargarMinisterio, procesar, actualizarHistorico, nuevoRegistroRutas, unirRegistrosRutas, actualizarRegistroRutas } from './lib/datos.mjs';
import { crearHtml } from './lib/html.mjs';
import { crearPaginas } from './lib/paginas.mjs';
import { C } from '../src/comun.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const r = (...p) => join(RAIZ, ...p);
const DIST = r('dist');
const args = process.argv.slice(2);
const cfg = JSON.parse(readFileSync(r('sitio.config.json'), 'utf8'));
const t0 = Date.now();
const log = (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
const escribir = (ruta, contenido) => { mkdirSync(dirname(ruta), { recursive: true }); writeFileSync(ruta, contenido); };

// ---------- 1. Precios ----------
const CACHE = r('.cache', 'ministerio.json');
let raw;
const fichero = args.find((a) => a.startsWith('--datos='))?.split('=')[1];
if (fichero) {
  raw = JSON.parse(readFileSync(fichero, 'utf8'));
  log(`Usando datos del archivo ${fichero}`);
} else if (args.includes('--sin-descarga') && existsSync(CACHE)) {
  raw = JSON.parse(readFileSync(CACHE, 'utf8'));
  log('Usando la última descarga guardada');
} else {
  log('Descargando precios del Ministerio…');
  try {
    raw = await descargarMinisterio(cfg.datos.apiMinisterio);
    escribir(CACHE, JSON.stringify(raw));
  } catch (err) {
    if (existsSync(CACHE)) {
      console.warn(`No se pudo descargar (${err.message}). Uso la última descarga guardada.`);
      raw = JSON.parse(readFileSync(CACHE, 'utf8'));
    } else {
      console.error(`\nNo se pudieron descargar los precios: ${err.message}\nComprueba la conexión a internet y vuelve a intentarlo.`);
      process.exit(1);
    }
  }
}
// Lo ya publicado en la web (histórico y direcciones), por si se perdió la copia local
const urlPublica = !/tudominio|localhost/.test(cfg.url);
async function recuperarPublicado(archivo) {
  if (!urlPublica) return null;
  try {
    const rh = await fetch(`${cfg.url.replace(/\/$/, '')}/datos/${archivo}`, { signal: AbortSignal.timeout(20000) });
    if (rh.ok) return await rh.json();
  } catch { /* primera publicación o sin conexión */ }
  return null;
}

// ---------- 2. Direcciones publicadas (para que no cambien ni desaparezcan) ----------
const RUTAS = r('historico', 'rutas.json');
let rutas = nuevoRegistroRutas(existsSync(RUTAS) ? JSON.parse(readFileSync(RUTAS, 'utf8')) : null);
const rutasRemotas = await recuperarPublicado('rutas.json');
if (rutasRemotas) { rutas = unirRegistrosRutas(rutasRemotas, rutas); log('Direcciones publicadas recuperadas'); }

const datos = procesar(raw, rutas);
log(`${datos.estaciones.length} gasolineras, ${datos.provincias.length} provincias, precios del ${datos.fecha.texto} ${datos.fecha.hora}`);
rutas = actualizarRegistroRutas(rutas, datos);
escribir(RUTAS, JSON.stringify(rutas));
const nAusentes = datos.provincias.reduce((s, p) => s + p.ausentes.length, 0);
if (nAusentes) log(`${nAusentes} municipios sin precios hoy: se mantiene su página`);

// ---------- 3. Histórico (medias diarias para gráficos y "vs. ayer") ----------
const HIST = r('historico', 'historico.json');
let historico = existsSync(HIST) ? JSON.parse(readFileSync(HIST, 'utf8')) : null;
const remoto = await recuperarPublicado('historico.json');
if (remoto) {
  historico = { dias: { ...(remoto.dias || {}), ...(historico?.dias || {}) } };
  log('Histórico publicado recuperado');
}
historico = actualizarHistorico(historico, datos);
escribir(HIST, JSON.stringify(historico));
log(`Histórico: ${Object.keys(historico.dias).length} días`);

// ---------- 4. Limpiar y compilar JS/CSS ----------
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 8);
const res = await esbuild.build({
  entryPoints: { app: r('src/app.js'), anuncios: r('src/anuncios.js'), calculadora: r('src/calculadora.js'), estilos: r('src/estilos.css'), mapacss: r('node_modules/leaflet/dist/leaflet.css') },
  external: ['/fuentes/*'],
  bundle: true, splitting: true, format: 'esm', minify: true, target: ['es2020'],
  outdir: join(DIST, 'assets'), entryNames: '[name]-[hash]', chunkNames: 'c-[hash]', assetNames: '[name]-[hash]',
  loader: { '.png': 'file', '.woff2': 'file' }, metafile: true, logLevel: 'warning', legalComments: 'none',
});
const assets = {};
for (const [out, info] of Object.entries(res.metafile.outputs)) {
  if (!info.entryPoint) continue;
  const nombre = info.entryPoint.split('/').pop().replace(/\.(js|css)$/, '');
  if (out.endsWith('.css')) assets[nombre === 'estilos' ? 'css' : nombre === 'leaflet' ? 'mapacss' : nombre] = '/' + out.slice(out.indexOf('assets'));
  if (out.endsWith('.js')) assets[nombre] = '/' + out.slice(out.indexOf('assets'));
}
log('JS y CSS compilados');

// ---------- 5. Datos para el buscador (divididos por provincia) ----------
const version = hash(raw.Fecha || String(Date.now()));
const provIndex = datos.provincias.map((p) => [p.id, p.nombre, p.bbox.map((v) => +v.toFixed(4)), p.estaciones.length, p.ruta]);
escribir(join(DIST, 'datos', 'indice.json'), JSON.stringify({ fecha: datos.fecha, version, provincias: provIndex }));
for (const p of datos.provincias) escribir(join(DIST, 'datos', 'p', `${p.id}.json`), JSON.stringify(p.estaciones));

// Lugares para las sugerencias: municipios y códigos postales
const lugares = [];
for (const p of datos.provincias) {
  for (const m of p.municipios.values()) lugares.push([m.nombre, p.nombre, +m.lat.toFixed(4), +m.lon.toFixed(4), m.estaciones.length, 0, m.ruta]);
  const cps = new Map();
  for (const e of p.estaciones) {
    if (!/^\d{5}$/.test(e[C.cp])) continue;
    const g = cps.get(e[C.cp]) || { mun: e[C.mun], lat: 0, lon: 0, n: 0 };
    g.lat += e[C.lat]; g.lon += e[C.lon]; g.n++;
    cps.set(e[C.cp], g);
  }
  for (const [cp, g] of cps) lugares.push([cp, g.mun, +(g.lat / g.n).toFixed(4), +(g.lon / g.n).toFixed(4), g.n, 1]);
}
escribir(join(DIST, 'datos', 'lugares.json'), JSON.stringify(lugares));
escribir(join(DIST, 'datos', 'historico.json'), JSON.stringify(historico));
escribir(join(DIST, 'datos', 'rutas.json'), JSON.stringify(rutas));
log('Datos del buscador listos');

// ---------- 6. Páginas ----------
const h = crearHtml(cfg, { assets, datos });
const paginas = crearPaginas(cfg, { datos, historico }, h);
for (const pg of paginas) {
  const destino = pg.archivo ? join(DIST, pg.archivo) : join(DIST, pg.ruta, 'index.html');
  escribir(destino, pg.html);
}
log(`${paginas.length} páginas generadas`);

// ---------- 7. Archivos estáticos ----------
const copiarDir = (de, a) => {
  if (!existsSync(de)) return;
  for (const n of readdirSync(de)) {
    const o = join(de, n), d = join(a, n);
    if (statSync(o).isDirectory()) { mkdirSync(d, { recursive: true }); copiarDir(o, d); } else copyFileSync(o, d);
  }
};
copiarDir(r('static'), DIST);
const fuentes = {
  'barlow-400.woff2': 'node_modules/@fontsource/barlow/files/barlow-latin-400-normal.woff2',
  'barlow-500.woff2': 'node_modules/@fontsource/barlow/files/barlow-latin-500-normal.woff2',
  'barlow-600.woff2': 'node_modules/@fontsource/barlow/files/barlow-latin-600-normal.woff2',
  'barlow-condensed-600.woff2': 'node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2',
  'barlow-condensed-700.woff2': 'node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2',
  'share-tech-mono-400.woff2': 'node_modules/@fontsource/share-tech-mono/files/share-tech-mono-latin-400-normal.woff2',
};
mkdirSync(join(DIST, 'fuentes'), { recursive: true });
for (const [n, o] of Object.entries(fuentes)) copyFileSync(r(o), join(DIST, 'fuentes', n));

const base = cfg.url.replace(/\/$/, '');
// Un sitemap por tipo de página, para ver en Search Console qué se indexa de cada grupo.
// Las páginas con precios cambian cada día; las legales no llevan fecha (no cambian).
const indexables = paginas.filter((p) => !p.sinMapa);
const grupos = ['general', 'provincias', 'municipios', 'marcas', 'legal'];
const xml = (s) => s.replace(/&/g, '&amp;');
const lastmod = (g) => (g === 'legal' ? '' : `<lastmod>${datos.fecha.iso}</lastmod>`);
const delGrupo = (g) => indexables.filter((p) => (p.tipo || 'general') === g);
for (const g of grupos) {
  const urls = delGrupo(g).map((p) => `<url><loc>${xml(base + p.ruta)}</loc>${lastmod(g)}</url>`);
  escribir(join(DIST, `sitemap-${g}.xml`), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
}
escribir(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${grupos.map((g) => `<sitemap><loc>${base}/sitemap-${g}.xml</loc>${lastmod(g)}</sitemap>`).join('\n')}\n</sitemapindex>\n`);
log(`Sitemaps: ${grupos.map((g) => `${g} ${delGrupo(g).length}`).join(', ')}`);
// /datos/ no se bloquea: el buscador lo necesita y Google debe poder ver la página completa
escribir(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);
const pub = (cfg.anuncios.adsenseCliente || '').replace(/^ca-/, '');
escribir(join(DIST, 'ads.txt'), pub ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` : '# Rellena "adsenseCliente" en sitio.config.json\n');
escribir(join(DIST, 'manifest.webmanifest'), JSON.stringify({
  name: cfg.nombre, short_name: cfg.nombre, start_url: '/', display: 'standalone', lang: 'es',
  description: 'La gasolinera más barata cerca de ti, con los precios oficiales de hoy.',
  background_color: '#0a55a6', theme_color: '#0a55a6',
  icons: [{ src: '/icono-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icono-512.png', sizes: '512x512', type: 'image/png' }, { src: '/icono.svg', sizes: 'any', type: 'image/svg+xml' }],
}, null, 2));
escribir(join(DIST, 'sw.js'), `// Guarda la web para abrirla rápido y sin conexión
const V='${version}';
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
 if(u.pathname.startsWith('/assets/')||u.pathname.startsWith('/fuentes/')){e.respondWith(caches.open(V).then(c=>c.match(e.request).then(r=>r||fetch(e.request).then(n=>{c.put(e.request,n.clone());return n}))));return}
 e.respondWith(fetch(e.request).then(n=>{if(n.ok){const cp=n.clone();caches.open(V).then(c=>c.put(e.request,cp))}return n}).catch(()=>caches.match(e.request)))});
`);
try {
  const host = new URL(cfg.url).hostname;
  if (!/tudominio|github\.io|localhost/.test(host)) escribir(join(DIST, 'CNAME'), host + '\n');
} catch {}
escribir(join(DIST, '.nojekyll'), '');

const tam = (dir) => readdirSync(dir).reduce((s, n) => { const p = join(dir, n); return s + (statSync(p).isDirectory() ? tam(p) : statSync(p).size); }, 0);
log(`Web lista en la carpeta dist (${(tam(DIST) / 1e6).toFixed(1)} MB)`);
