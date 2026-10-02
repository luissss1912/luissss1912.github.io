// Buscador de gasolineras: ubicación, direcciones, filtros, lista, mapa, favoritas y compartir.
import { COMBUSTIBLES, C, precioDe, esc, euro, km, distancia, abiertaAhora, es24h, horarioCorto } from './comun.js';

const SITIO = window.SITIO;
const $ = (id) => document.getElementById(id);
const PAG = 20;
const AD_CADA = 7;
const DEPOSITO = 50;
const norm = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const rutaMaps = (lat, lon) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
const icoEstrella = (on) => (on ? '★' : '☆');

// ---------- Estado ----------
const S = { comb: 'g95', radio: 3, abiertas: false, h24: false, orden: 'precio', vista: 'lista', lugar: null, vistos: PAG };
const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
Object.assign(S, leer('sb-estado', {}));
S.vistos = PAG;
let favs = leer('sb-favs', []); // [{id, prov}]
const radioTxt = () => (S.radio < 1 ? Math.round(S.radio * 1000) + ' m' : S.radio + ' km');
const guardar = () => guardarLS('sb-estado', { comb: S.comb, radio: S.radio, abiertas: S.abiertas, h24: S.h24, orden: S.orden, vista: S.vista, lugar: S.lugar });

let INDICE = null;
let LUGARES = null;
const provCache = new Map();
let ultimo = []; // resultados actuales

// ---------- Datos ----------
async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
async function indice() {
  if (!INDICE) INDICE = await json(`/datos/indice.json?${Date.now().toString(36).slice(0, -4)}`);
  return INDICE;
}
async function provincia(id) {
  if (!provCache.has(id)) provCache.set(id, json(`/datos/p/${id}.json?v=${INDICE.version}`).catch((e) => { provCache.delete(id); throw e; }));
  return provCache.get(id);
}
async function lugares() {
  if (!LUGARES) LUGARES = json(`/datos/lugares.json?v=${(await indice()).version}`).then((l) => l.map((x) => ({ n: x[0], sub: x[1], lat: x[2], lon: x[3], c: x[4], cp: x[5] === 1, ruta: x[6], k: norm(x[0] + ' ' + x[1]), kn: norm(x[0]) })));
  return LUGARES;
}
async function estacionesZona(lat, lon, radio) {
  const idx = await indice();
  const dLat = radio / 110, dLon = radio / (111 * Math.cos((lat * Math.PI) / 180));
  const ids = idx.provincias.filter(([, , b]) => lat + dLat >= b[0] && lat - dLat <= b[2] && lon + dLon >= b[1] && lon - dLon <= b[3]).map((p) => p[0]);
  const listas = await Promise.all(ids.map(provincia));
  return listas.flat();
}

// ---------- Utilidades de interfaz ----------
function mensaje(t) { $('msg').textContent = t || ''; $('msg').hidden = !t; }
const combIdx = () => COMBUSTIBLES.findIndex((c) => c.k === S.comb);
const comb = () => COMBUSTIBLES[combIdx()];
function textoLugar(l) {
  if (!l) return '';
  if (l.gps) return l.n ? `${l.n} (tu ubicación)` : 'Tu ubicación';
  return l.sub ? `${l.n}, ${l.sub}` : l.n;
}
function pintarControles() {
  document.querySelectorAll('#fuels [data-f]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === S.comb)));
  $('radio').value = String(S.radio);
  $('fAbiertas').setAttribute('aria-pressed', String(S.abiertas));
  $('f24').setAttribute('aria-pressed', String(S.h24));
  $('oPrecio').setAttribute('aria-pressed', String(S.orden === 'precio'));
  $('oDist').setAttribute('aria-pressed', String(S.orden === 'dist'));
  $('vLista').setAttribute('aria-pressed', String(S.vista === 'lista'));
  $('vMapa').setAttribute('aria-pressed', String(S.vista === 'mapa'));
}

function estadoHorario(h) {
  if (es24h(h)) return '<span class="pill abierta">24 h</span>';
  const a = abiertaAhora(h);
  if (a === true) return `<span class="abierta">Abierta</span> <span>${esc(horarioCorto(h))}</span>`;
  if (a === false) return `<span class="cerrada">Cerrada ahora</span> <span>${esc(horarioCorto(h))}</span>`;
  return `<span>${esc(horarioCorto(h))}</span>`;
}

// ---------- Búsqueda ----------
let generacion = 0;
async function buscar() {
  if (!S.lugar) return;
  const gen = ++generacion;
  const i = combIdx();
  window.gtag?.('event', 'buscar_gasolineras', { combustible: COMBUSTIBLES[i]?.corto, radio_km: S.radio });
  $('resultado').innerHTML = '<div class="vacio"><strong>Buscando gasolineras…</strong></div>';
  let todas;
  try {
    todas = await estacionesZona(S.lugar.lat, S.lugar.lon, S.radio);
  } catch {
    $('resultado').innerHTML = '<div class="vacio"><strong>No hemos podido cargar los precios</strong><span>Comprueba tu conexión e inténtalo de nuevo.</span></div>';
    return;
  }
  if (gen !== generacion) return;
  const ahora = new Date();
  ultimo = [];
  for (const e of todas) {
    const p = precioDe(e, i);
    if (!p) continue;
    const d = distancia(S.lugar.lat, S.lugar.lon, e[C.lat], e[C.lon]);
    if (d > S.radio) continue;
    if (S.h24 && !es24h(e[C.horario])) continue;
    if (S.abiertas && abiertaAhora(e[C.horario], ahora) !== true) continue;
    ultimo.push({ e, precio: p, d, lat: e[C.lat], lon: e[C.lon] });
  }
  pintar();
}

function pintar() {
  pintarControles();
  const c = comb();
  const r = ultimo;
  $('listaBloque').hidden = !S.lugar;
  if (!S.lugar) return;
  const filtros = [S.abiertas && 'abiertas ahora', S.h24 && 'abiertas 24 horas'].filter(Boolean).join(' y ');
  if (!r.length) {
    $('resultado').innerHTML = `<div class="vacio"><strong>No hay gasolineras con ${c.nombre}${filtros ? ' ' + filtros : ''} a menos de ${radioTxt()}</strong><span>Amplía el radio${filtros ? ' o quita los filtros' : ''}.</span></div>`;
    $('listaTitulo').textContent = 'Sin resultados';
    $('lista').innerHTML = '';
    $('mas').hidden = true;
    $('mapa').hidden = true;
    return;
  }
  const porPrecio = [...r].sort((a, b) => a.precio - b.precio || a.d - b.d);
  const mejor = porPrecio[0];
  const media = r.reduce((s, x) => s + x.precio, 0) / r.length;
  const max = porPrecio[porPrecio.length - 1].precio;
  const ahorro = (media - mejor.precio) * DEPOSITO;
  const e = mejor.e;
  $('resultado').innerHTML = `
  <div class="totem">
    <div>
      <span class="t-f">${c.nombre} · la más barata a ${radioTxt()}</span>
      <b class="t-p">${euro(mejor.precio)}<small>€/l</small></b>
      <div class="t-quien">${esc(e[C.marca])}</div>
      <div class="t-donde">${esc(e[C.dir])}, ${esc(e[C.mun])} · a ${km(mejor.d)}</div>
      <div class="t-acc">
        <a href="${rutaMaps(e[C.lat], e[C.lon])}" target="_blank" rel="noopener">Cómo llegar</a>
        <button type="button" class="sec" id="compartir">Compartir</button>
      </div>
    </div>
    <div class="stats">
      <div class="stat ahorro"><b>${euro(ahorro, 2)} €</b><span>Ahorras por depósito de ${DEPOSITO} l vs. la media</span></div>
      <div class="stat"><b>${euro(media)}</b><span>Precio medio en la zona</span></div>
      <div class="stat"><b>${euro(max)}</b><span>La más cara</span></div>
      <div class="stat n"><b>${r.length}</b><span>Gasolineras comparadas</span></div>
    </div>
  </div>`;
  $('compartir').onclick = () => compartir(mejor, c);
  $('listaTitulo').textContent = `${r.length} ${r.length === 1 ? 'gasolinera' : 'gasolineras'} a menos de ${radioTxt()}${filtros ? ' ' + filtros : ''}`;

  $('mapa').hidden = S.vista !== 'mapa';
  $('lista').hidden = S.vista === 'mapa';
  $('ordenBox').hidden = S.vista === 'mapa';
  if (S.vista === 'mapa') { $('mas').hidden = true; pintarMapa(r); return; }

  const lista = S.orden === 'precio' ? porPrecio : [...r].sort((a, b) => a.d - b.d);
  const puesto = new Map(porPrecio.map((x, k) => [x, k + 1]));
  const favIds = new Set(favs.map((f) => f.id));
  const html = [];
  lista.slice(0, S.vistos).forEach((x, k) => {
    const e = x.e, pos = puesto.get(x), dif = x.precio - media;
    const cls = dif < -0.0005 ? 'lo' : dif > 0.0005 ? 'hi' : '';
    const dtxt = `${dif > 0 ? '+' : dif < 0 ? '−' : '±'}${Math.abs(dif * 100).toFixed(1).replace('.', ',')} cts vs. media`;
    const esFav = favIds.has(e[C.id]);
    html.push(`<li class="est${pos === 1 ? ' top' : ''}">
      <div class="pos" title="Puesto por precio">${pos}</div>
      <div style="min-width:0">
        <div class="nom">${esc(e[C.marca])} <button type="button" class="fav" data-fav="${e[C.id]}" data-prov="${e[C.prov]}" aria-pressed="${esFav}" aria-label="${esFav ? 'Quitar de' : 'Guardar en'} mis gasolineras">${icoEstrella(esFav)}</button></div>
        <div class="dir">${esc(e[C.dir])}, ${esc(e[C.mun])}</div>
        <div class="meta"><span>${km(x.d)}</span>${estadoHorario(e[C.horario])}<a href="${rutaMaps(e[C.lat], e[C.lon])}" target="_blank" rel="noopener">Cómo llegar ↗</a></div>
      </div>
      <div class="pr"><b>${euro(x.precio)}</b><span class="delta ${cls}">${dtxt}</span></div>
    </li>`);
    if ((k + 1) % AD_CADA === 0 && k + 1 < Math.min(lista.length, S.vistos)) html.push('<li><div class="ad ad-lista" data-hueco="lista"></div></li>');
  });
  $('lista').innerHTML = html.join('');
  window.rellenarAnuncios?.($('lista'));
  $('mas').hidden = lista.length <= S.vistos;
}

async function pintarMapa(r) {
  $('mapa').hidden = false;
  if (SITIO.mapacss && !document.querySelector('link[data-mapa]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = SITIO.mapacss; l.dataset.mapa = '1';
    document.head.appendChild(l);
  }
  const { pintarMapa: dibujar } = await import('./mapa.js');
  dibujar($('mapa'), SITIO.servicios, S.lugar, S.radio, r, (x) => `<strong>${esc(x.e[C.marca])}</strong><br>${esc(x.e[C.dir])}<b class="p">${euro(x.precio)} €/l</b>${km(x.d)} · <a href="${rutaMaps(x.lat, x.lon)}" target="_blank" rel="noopener">Cómo llegar</a>`);
}

async function compartir(x, c) {
  const e = x.e;
  const url = `${location.origin}/?lat=${S.lugar.lat.toFixed(4)}&lon=${S.lugar.lon.toFixed(4)}&l=${encodeURIComponent(S.lugar.n || '')}`;
  const texto = `⛽ ${c.nombre} a ${euro(x.precio)} €/l en ${e[C.marca]} (${e[C.dir]}, ${e[C.mun]}). La más barata a ${radioTxt()} según ${SITIO.nombre}:`;
  if (navigator.share) {
    try { await navigator.share({ title: SITIO.nombre, text: texto, url }); return; } catch (err) { if (err?.name === 'AbortError') return; }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(texto + ' ' + url)}`, '_blank', 'noopener');
}

// ---------- Favoritas ----------
async function pintarFavs() {
  const box = $('favs');
  if (!favs.length) { box.hidden = true; return; }
  const i = combIdx();
  try {
    await indice();
    const provs = [...new Set(favs.map((f) => f.prov))];
    const todas = (await Promise.all(provs.map(provincia))).flat();
    const porId = new Map(todas.map((e) => [e[C.id], e]));
    const items = favs.map((f) => porId.get(f.id)).filter(Boolean);
    if (!items.length) { box.hidden = true; return; }
    box.innerHTML = `<h2 style="margin-bottom:8px">Mis gasolineras</h2><ol class="lista">${items.map((e) => `<li class="est"><div class="pos">★</div><div style="min-width:0"><div class="nom">${esc(e[C.marca])} <button type="button" class="fav" data-fav="${e[C.id]}" data-prov="${e[C.prov]}" aria-pressed="true" aria-label="Quitar de mis gasolineras">★</button></div><div class="dir">${esc(e[C.dir])}, ${esc(e[C.mun])}</div><div class="meta">${estadoHorario(e[C.horario])}<a href="${rutaMaps(e[C.lat], e[C.lon])}" target="_blank" rel="noopener">Cómo llegar ↗</a></div></div><div class="pr"><b>${euro(precioDe(e, i))}</b><span class="delta">${COMBUSTIBLES[i].corto}</span></div></li>`).join('')}</ol>`;
    box.hidden = false;
  } catch { box.hidden = true; }
}
function alternarFav(id, prov) {
  const ya = favs.some((f) => f.id === id);
  favs = ya ? favs.filter((f) => f.id !== id) : [...favs, { id, prov }].slice(-10);
  guardarLS('sb-favs', favs);
  pintarFavs();
  pintar();
}

// ---------- Lugar ----------
function elegir(l, { buscarYa = true } = {}) {
  S.lugar = { n: l.n, sub: l.sub || '', lat: l.lat, lon: l.lon, gps: !!l.gps };
  S.vistos = PAG;
  $('q').value = textoLugar(S.lugar);
  mensaje('');
  cerrarSug();
  guardar();
  try { history.replaceState(null, '', `/?lat=${l.lat.toFixed(4)}&lon=${l.lon.toFixed(4)}&l=${encodeURIComponent(l.n || '')}`); } catch {}
  if (buscarYa) buscar();
}

function posicion() {
  return new Promise((ok, mal) => {
    if (!('geolocation' in navigator)) return mal(new Error('Tu navegador no permite obtener la ubicación. Escribe una dirección.'));
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (err) => mal(new Error(err.code === 1
        ? 'Has bloqueado el acceso a la ubicación. Actívalo en tu navegador o escribe una dirección.'
        : 'No hemos podido encontrar tu ubicación. Inténtalo de nuevo o escribe una dirección.')),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  });
}

async function cercaDeMi() {
  const btns = document.querySelectorAll('.gps');
  btns.forEach((b) => b.setAttribute('aria-busy', 'true'));
  mensaje('');
  try {
    const { lat, lon } = await posicion();
    elegir({ n: '', lat, lon, gps: true });
    const nombre = await nombreDe(lat, lon);
    if (nombre && S.lugar?.gps && S.lugar.lat === lat) {
      S.lugar.n = nombre;
      $('q').value = textoLugar(S.lugar);
      guardar();
    }
  } catch (err) {
    mensaje(err.message);
  } finally {
    btns.forEach((b) => b.removeAttribute('aria-busy'));
  }
}

// ---------- Direcciones (Photon) ----------
const ESPANA = '-18.3,27.5,4.5,43.9';
function etiquetaPhoton(p) {
  const via = [p.street || (p.osm_key === 'highway' ? p.name : ''), p.housenumber].filter(Boolean).join(' ');
  const n = via || p.name || p.city || '';
  const sub = [via || p.name !== p.city ? p.city || p.county : '', p.postcode].filter(Boolean).join(' · ');
  return { n, sub };
}
async function buscarDirecciones(q, signal) {
  const u = new URL(SITIO.servicios.direcciones);
  u.search = new URLSearchParams({ q, limit: '6', bbox: ESPANA }).toString();
  const r = await fetch(u, { signal });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.features || [])
    .filter((f) => (f.properties.countrycode || 'ES') === 'ES')
    .map((f) => ({ ...etiquetaPhoton(f.properties), lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], tipo: 'dir' }))
    .filter((x) => x.n);
}
async function nombreDe(lat, lon) {
  try {
    const u = new URL(SITIO.servicios.direccionesInversa);
    u.search = new URLSearchParams({ lat, lon }).toString();
    const r = await fetch(u);
    if (!r.ok) return '';
    const f = (await r.json()).features?.[0]?.properties;
    if (!f) return '';
    const e = etiquetaPhoton(f);
    return [e.n, f.city].filter((v, k, a) => v && a.indexOf(v) === k).join(', ');
  } catch { return ''; }
}

// ---------- Sugerencias ----------
let sug = [], sel = -1, temp, abort;
function cerrarSug() { sug = []; sel = -1; dibujarSug(); }
function dibujarSug() {
  const ul = $('sugg');
  ul.hidden = !sug.length;
  $('q').setAttribute('aria-expanded', String(sug.length > 0));
  let html = '', tipo = null;
  sug.forEach((p, k) => {
    const t = p.tipo || (p.cp ? 'cp' : 'mun');
    const grupo = t === 'dir' ? 'Direcciones' : 'Municipios y códigos postales';
    if (grupo !== tipo) { html += `<li class="sep" role="presentation">${grupo}</li>`; tipo = grupo; }
    const extra = t === 'dir' ? esc(p.sub) : `${esc(p.sub)} · ${p.c} gasol.`;
    html += `<li role="option" id="s${k}" data-i="${k}" aria-selected="${k === sel}"><span>${esc(p.n)}</span><small>${extra}</small></li>`;
  });
  ul.innerHTML = html;
}
async function alEscribir(v) {
  const q = norm(v);
  clearTimeout(temp);
  abort?.abort();
  if (!q) { cerrarSug(); return; }
  const L = await lugares();
  const a = [], b = [];
  for (const p of L) {
    if (p.kn.startsWith(q)) a.push(p);
    else if (q.length > 2 && p.k.includes(q)) b.push(p);
  }
  a.sort((x, y) => y.c - x.c); b.sort((x, y) => y.c - x.c);
  const locales = [...a, ...b].slice(0, 5);
  if ($('q').value !== v) return;
  sug = locales; sel = sug.length ? 0 : -1; dibujarSug();
  if (q.length < 4 || /^\d{1,5}$/.test(q)) return;
  temp = setTimeout(async () => {
    abort = new AbortController();
    try {
      const dirs = await buscarDirecciones(v, abort.signal);
      if ($('q').value !== v) return;
      sug = [...locales, ...dirs].slice(0, 10);
      if (sel < 0 && sug.length) sel = 0;
      dibujarSug();
    } catch {}
  }, 350);
}

// ---------- Eventos ----------
function eventos() {
  document.addEventListener('click', (ev) => {
    const t = ev.target;
    const f = t.closest('[data-f]');
    if (f) { S.comb = f.dataset.f; S.vistos = PAG; guardar(); pintarControles(); buscar(); pintarFavs(); }
    if (t.closest('[data-gps]')) cercaDeMi();
    const fav = t.closest('[data-fav]');
    if (fav) alternarFav(+fav.dataset.fav, fav.dataset.prov);
    if (!t.closest('.inputwrap')) cerrarSug();
  });
  $('gps').addEventListener('click', cercaDeMi);
  $('radio').addEventListener('change', (e) => { S.radio = +e.target.value; S.vistos = PAG; guardar(); buscar(); });
  $('fAbiertas').addEventListener('click', () => { S.abiertas = !S.abiertas; guardar(); buscar(); });
  $('f24').addEventListener('click', () => { S.h24 = !S.h24; guardar(); buscar(); });
  $('oPrecio').addEventListener('click', () => { S.orden = 'precio'; S.vistos = PAG; guardar(); pintar(); });
  $('oDist').addEventListener('click', () => { S.orden = 'dist'; S.vistos = PAG; guardar(); pintar(); });
  $('vLista').addEventListener('click', () => { S.vista = 'lista'; guardar(); pintar(); });
  $('vMapa').addEventListener('click', () => { S.vista = 'mapa'; guardar(); pintar(); });
  $('mas').addEventListener('click', () => { S.vistos += PAG; pintar(); });

  const q = $('q');
  q.addEventListener('focus', () => { lugares(); q.select(); });
  q.addEventListener('input', (e) => alEscribir(e.target.value));
  q.addEventListener('keydown', (e) => {
    if (!sug.length) return;
    if (e.key === 'ArrowDown') { sel = (sel + 1) % sug.length; dibujarSug(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = (sel - 1 + sug.length) % sug.length; dibujarSug(); e.preventDefault(); }
    else if (e.key === 'Enter' && sel >= 0) { elegir(sug[sel]); q.blur(); e.preventDefault(); }
    else if (e.key === 'Escape') cerrarSug();
  });
  $('formBus').addEventListener('submit', (e) => { e.preventDefault(); if (sug[sel]) { elegir(sug[sel]); q.blur(); } });
  $('sugg').addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[data-i]');
    if (li) { e.preventDefault(); elegir(sug[+li.dataset.i]); q.blur(); }
  });
}

// ---------- Arranque ----------
async function arrancar() {
  pintarControles();
  eventos();
  try { await indice(); } catch { mensaje('No hemos podido cargar los precios. Comprueba tu conexión.'); return; }
  pintarFavs();

  const p = new URLSearchParams(location.search);
  const lat = parseFloat(p.get('lat')), lon = parseFloat(p.get('lon'));
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    elegir({ n: p.get('l') || '', lat, lon });
    return;
  }
  if (S.lugar) { elegir(S.lugar); return; }
  try {
    const perm = await navigator.permissions?.query({ name: 'geolocation' });
    if (perm?.state === 'granted') cercaDeMi();
  } catch {}
}
arrancar();
