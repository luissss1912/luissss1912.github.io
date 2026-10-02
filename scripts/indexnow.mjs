// Avisa a los buscadores que usan IndexNow (Bing, Yandex, Seznam...) de las páginas actualizadas.
// Se ejecuta en GitHub Actions al terminar de generar la web (los buscadores la visitan minutos después). Si falla, no pasa nada: la web ya está publicada.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(raiz, 'sitio.config.json'), 'utf8'));
const clave = cfg.indexNow?.clave;
if (!process.env.GITHUB_ACTIONS) { console.log('IndexNow: solo se avisa desde GitHub Actions'); process.exit(0); }
if (!clave) { console.log('IndexNow: sin clave, nada que hacer'); process.exit(0); }
const base = cfg.url.replace(/\/$/, '');
const host = new URL(base).host;
const DIST = join(raiz, 'dist');

const locs = (fichero) => {
  try { return [...readFileSync(join(DIST, fichero), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]); } catch { return []; }
};
const sitemaps = readdirSync(DIST).filter((f) => /^sitemap-.+\.xml$/.test(f));

// Una vez al día (primera publicación de la mañana) se avisa de todas las páginas, porque cambian los precios.
// En el resto de publicaciones, solo de las principales (portada, noticias, provincias).
const todo = process.env.INDEXNOW_TODO === '1' || new Date().getUTCHours() === 4;
const elegidos = todo ? sitemaps : sitemaps.filter((f) => /general|noticias|provincias/.test(f));
const urls = [...new Set(elegidos.flatMap(locs))].slice(0, 10000);
if (!urls.length) { console.log('IndexNow: no hay URLs'); process.exit(0); }

let r;
try {
  r = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key: clave, keyLocation: `${base}/${clave}.txt`, urlList: urls }),
});
} catch (e) { console.log('IndexNow: error de red, se ignora', e.message); process.exit(0); }
console.log(`IndexNow: ${urls.length} URLs (${todo ? 'todas' : 'principales'}) -> HTTP ${r.status}`);
