// Planificador de ruta: gasolineras más baratas en un trayecto (p. ej. Valencia → Santiago).
import { COMBUSTIBLES, C, precioDe, esc, euro, km, distancia, es24h } from './comun.js';

const $ = (id) => document.getElementById(id);
const ESPANA = '-18.3,27.5,4.5,43.9';
const RUTAS = [
  'https://routing.openstreetmap.de/routed-car/route/v1/driving/',
  'https://router.project-osrm.org/route/v1/driving/',
];
const DEPOSITO = 50;
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

let INDICE = null, LUGARES = null;
const provCache = new Map();
const json = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
async function indice() { if (!INDICE) INDICE = await json(`/datos/indice.json?${Date.now().toString(36).slice(0, -4)}`); return INDICE; }
async function provincia(id) {
  if (!provCache.has(id)) provCache.set(id, json(`/datos/p/${id}.json?v=${INDICE.version}`).catch((e) => { provCache.delete(id); throw e; }));
  return provCache.get(id);
}
async function lugares() {
  if (!LUGARES) LUGARES = json(`/datos/lugares.json?v=${(await indice()).version}`).then((l) => l.map((x) => ({ n: x[0], sub: x[1], lat: x[2], lon: x[3], c: x[4], k: norm(x[0]) })));
  return LUGARES;
}

// ---------- Búsqueda de lugares (municipios propios + Photon para direcciones) ----------
async function sugerencias(q, signal) {
  const nq = norm(q);
  const ls = (await lugares()).filter((l) => l.k.startsWith(nq) || l.k.includes(' ' + nq)).sort((a, b) => (b.k.startsWith(nq) - a.k.startsWith(nq)) || (b.c || 0) - (a.c || 0)).slice(0, 5);
  let dirs = [];
  if (q.length >= 4) {
    try {
      const u = new URL(SITIO.servicios.direcciones);
      u.search = new URLSearchParams({ q, limit: '5', bbox: ESPANA }).toString();
      const r = await fetch(u, { signal });
      if (r.ok) {
        dirs = ((await r.json()).features || []).filter((f) => (f.properties.countrycode || 'ES') === 'ES').map((f) => {
          const p = f.properties;
          const n = [p.name || [p.street, p.housenumber].filter(Boolean).join(' ')].filter(Boolean)[0] || p.city;
          const sub = [p.city !== n ? p.city : '', p.state].filter(Boolean).join(', ');
          return { n, sub, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
        }).filter((x) => x.n);
      }
    } catch { /* sin conexión o cancelado */ }
  }
  return [...ls, ...dirs].slice(0, 7);
}

function autocompletar(input) {
  const caja = document.createElement('ul');
  caja.className = 'sugg';
  caja.hidden = true;
  input.after(caja);
  let ctl = null, lista = [];
  input.addEventListener('input', async () => {
    input._lugar = null;
    const q = input.value.trim();
    if (q.length < 2) { caja.hidden = true; return; }
    ctl?.abort(); ctl = new AbortController();
    lista = await sugerencias(q, ctl.signal);
    caja.innerHTML = lista.map((l, i) => `<li><button type="button" data-i="${i}"><strong>${esc(l.n)}</strong>${l.sub ? ` <span>${esc(l.sub)}</span>` : ''}</button></li>`).join('');
    caja.hidden = !lista.length;
  });
  caja.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    const l = lista[+b.dataset.i];
    input._lugar = l;
    input.value = l.sub ? `${l.n}, ${l.sub}` : l.n;
    caja.hidden = true;
  });
  input.addEventListener('blur', () => setTimeout(() => { caja.hidden = true; }, 200));
}

async function resolver(input) {
  if (input._lugar) return input._lugar;
  const q = input.value.trim();
  if (!q) return null;
  const l = (await sugerencias(q))[0];
  if (l) input._lugar = l;
  return l || null;
}

// ---------- Ruta ----------
async function calcularRuta(a, b) {
  let ultimoError;
  for (const base of RUTAS) {
    try {
      const r = await fetch(`${base}${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (j.code !== 'Ok' || !j.routes?.length) throw new Error(j.code || 'sin ruta');
      return { coords: j.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]), metros: j.routes[0].distance, segundos: j.routes[0].duration };
    } catch (e) { ultimoError = e; }
  }
  throw ultimoError;
}

// Puntos de la ruta cada ~1 km con su kilómetro acumulado
function muestrear(coords, paso = 1) {
  const out = [{ lat: coords[0][0], lon: coords[0][1], km: 0 }];
  let acum = 0, desdeUltimo = 0;
  for (let i = 1; i < coords.length; i++) {
    const [la1, lo1] = coords[i - 1], [la2, lo2] = coords[i];
    const d = distancia(la1, lo1, la2, lo2);
    let t = paso - desdeUltimo;
    while (t <= d) {
      const f = t / d;
      out.push({ lat: la1 + (la2 - la1) * f, lon: lo1 + (lo2 - lo1) * f, km: acum + t });
      t += paso;
    }
    desdeUltimo = (desdeUltimo + d) % paso;
    acum += d;
  }
  const [la, lo] = coords[coords.length - 1];
  out.push({ lat: la, lon: lo, km: acum });
  return out;
}

async function gasolinerasEnRuta(muestras, desvio, i) {
  const idx = await indice();
  const m = desvio / 100 + 0.05;
  const ids = idx.provincias.filter(([, , bb]) => muestras.some((p) => p.lat >= bb[0] - m && p.lat <= bb[2] + m && p.lon >= bb[1] - m && p.lon <= bb[3] + m)).map((p) => p[0]);
  const estaciones = (await Promise.all(ids.map(provincia))).flat();
  const celda = (la, lo) => `${Math.floor(la * 10)}:${Math.floor(lo * 10)}`;
  const rej = new Map();
  for (const p of muestras) { const k = celda(p.lat, p.lon); if (!rej.has(k)) rej.set(k, []); rej.get(k).push(p); }
  const salto = Math.ceil(desvio / 8) + 1;
  const res = [];
  for (const e of estaciones) {
    const precio = precioDe(e, i);
    if (!precio) continue;
    const la = e[C.lat], lo = e[C.lon];
    const a = Math.floor(la * 10), b = Math.floor(lo * 10);
    let mejor = null;
    for (let x = -salto; x <= salto; x++) for (let y = -salto; y <= salto; y++) {
      for (const p of rej.get(`${a + x}:${b + y}`) || []) {
        const d = distancia(la, lo, p.lat, p.lon);
        if (d <= desvio && (!mejor || d < mejor.d)) mejor = { d, km: p.km };
      }
    }
    if (mejor) res.push({ e, precio, desvio: mejor.d, km: mejor.km });
  }
  return res;
}

// ---------- Pintar ----------
const rutaMaps = (lat, lon) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
function tarjeta(x, etiqueta) {
  const e = x.e;
  return `<li class="est">
    <div class="pos">${etiqueta}</div>
    <div style="min-width:0"><div class="nom">${esc(e[C.marca])}</div>
    <div class="dir">${esc(e[C.dir])}, ${esc(e[C.mun])}</div>
    <div class="meta"><span>Km ${Math.round(x.km)} de la ruta</span><span>${x.desvio < 0.3 ? 'en la ruta' : 'desvío ' + km(x.desvio)}</span>${es24h(e[C.horario]) ? '<span class="pill abierta">24 h</span>' : ''}<a href="${rutaMaps(e[C.lat], e[C.lon])}" target="_blank" rel="noopener">Cómo llegar ↗</a></div></div>
    <div class="pr"><b>${euro(x.precio)}</b><span class="delta">€/l</span></div>
  </li>`;
}

let mapa = null, capa = null;
async function pintarMapa(coords, destacadas, resto) {
  const L = (await import('leaflet')).default;
  if (SITIO.mapacss && !document.querySelector('link[data-mapa]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = SITIO.mapacss; l.dataset.mapa = '1';
    document.head.appendChild(l);
  }
  const el = $('rMapa');
  el.hidden = false;
  if (!mapa) {
    mapa = L.map(el, { scrollWheelZoom: false });
    L.tileLayer(SITIO.servicios.mapa, { maxZoom: 19, attribution: SITIO.servicios.mapaAtribucion }).addTo(mapa);
    capa = L.layerGroup().addTo(mapa);
  }
  mapa.invalidateSize();
  capa.clearLayers();
  const linea = L.polyline(coords, { color: '#0a55a6', weight: 4, opacity: 0.8 }).addTo(capa);
  for (const x of resto) L.circleMarker([x.e[C.lat], x.e[C.lon]], { radius: 4, color: '#fff', weight: 1, fillColor: '#8a97a8', fillOpacity: 0.8 }).bindPopup(`${esc(x.e[C.marca])}<br>${euro(x.precio)} €/l`).addTo(capa);
  for (const x of destacadas) L.circleMarker([x.e[C.lat], x.e[C.lon]], { radius: 9, color: '#fff', weight: 2, fillColor: '#16965a', fillOpacity: 0.95 }).bindPopup(`<strong>${esc(x.e[C.marca])}</strong><br>${esc(x.e[C.dir])}, ${esc(x.e[C.mun])}<br><b>${euro(x.precio)} €/l</b> · km ${Math.round(x.km)}<br><a href="${rutaMaps(x.e[C.lat], x.e[C.lon])}" target="_blank" rel="noopener">Cómo llegar</a>`).addTo(capa);
  mapa.fitBounds(linea.getBounds(), { padding: [12, 12] });
}

async function buscar() {
  const msg = $('rMsg'), out = $('rRes');
  msg.hidden = true; out.innerHTML = '<div class="vacio"><strong>Calculando la ruta…</strong></div>';
  try {
    const [a, b] = await Promise.all([resolver($('rOrigen')), resolver($('rDestino'))]);
    if (!a || !b) { out.innerHTML = '<div class="vacio"><strong>Escribe el origen y el destino</strong><span>Por ejemplo, Valencia y Santiago de Compostela.</span></div>'; return; }
    const ci = Math.max(0, COMBUSTIBLES.findIndex((c) => c.k === $('rComb').value));
    const c = COMBUSTIBLES[ci];
    const desvio = +$('rDesvio').value;
    const tramo = +$('rTramo').value;
    window.gtag?.('event', 'buscar_ruta', { combustible: c.corto, desvio_km: desvio });
    const ruta = await calcularRuta(a, b);
    const total = ruta.metros / 1000;
    out.innerHTML = '<div class="vacio"><strong>Buscando gasolineras en el camino…</strong></div>';
    const muestras = muestrear(ruta.coords, 1);
    const todas = await gasolinerasEnRuta(muestras, desvio, ci);
    if (!todas.length) { out.innerHTML = `<div class="vacio"><strong>No hay gasolineras con ${esc(c.nombre)} a menos de ${desvio} km de la ruta</strong><span>Prueba con un desvío mayor.</span></div>`; return; }
    const media = todas.reduce((s, x) => s + x.precio, 0) / todas.length;
    const ordenadas = [...todas].sort((x, y) => x.precio - y.precio);
    const mejor = ordenadas[0];
    const max = ordenadas[ordenadas.length - 1].precio;
    const tramos = [];
    for (let ini = 0; ini < total; ini += tramo) {
      const fin = Math.min(total, ini + tramo);
      const t = todas.filter((x) => x.km >= ini && x.km < fin).sort((x, y) => x.precio - y.precio);
      tramos.push({ ini, fin, mejor: t[0], n: t.length });
    }
    const horas = Math.floor(ruta.segundos / 3600), min = Math.round((ruta.segundos % 3600) / 60);
    const destacadas = [...new Set([mejor, ...tramos.map((t) => t.mejor).filter(Boolean)])];
    const url = `${location.origin}/ruta/?o=${encodeURIComponent($('rOrigen').value)}&d=${encodeURIComponent($('rDestino').value)}&c=${c.k}`;
    const textoWa = `⛽ Ruta ${a.n} → ${b.n}: la ${c.nombre} más barata del camino está en ${mejor.e[C.marca]} (${mejor.e[C.mun]}) a ${euro(mejor.precio)} €/l, km ${Math.round(mejor.km)}. Míralo en ${SITIO.nombre}:`;
    out.innerHTML = `
    <div class="top">
      <div class="t-main">
        <span class="t-f">${esc(c.nombre)} · la más barata de la ruta</span>
        <div class="t-p">${euro(mejor.precio)}<small>€/l</small></div>
        <div class="t-quien">${esc(mejor.e[C.marca])}</div>
        <div class="t-donde">${esc(mejor.e[C.dir])}, ${esc(mejor.e[C.mun])} · km ${Math.round(mejor.km)}${mejor.desvio >= 0.3 ? ` · desvío ${km(mejor.desvio)}` : ''}</div>
        <div class="t-acc"><a href="${rutaMaps(mejor.e[C.lat], mejor.e[C.lon])}" target="_blank" rel="noopener">Cómo llegar</a><a class="wa" href="https://wa.me/?text=${encodeURIComponent(textoWa + ' ' + url)}" target="_blank" rel="noopener" onclick="window.gtag&&gtag('event','compartir',{metodo:'whatsapp_ruta'})">WhatsApp</a></div>
      </div>
      <div class="stats">
        <div class="stat ahorro"><b>${euro((media - mejor.precio) * DEPOSITO, 2)} €</b><span>Ahorras en un depósito de ${DEPOSITO} l vs. la media de la ruta</span></div>
        <div class="stat"><b>${Math.round(total)} km</b><span>${horas} h ${min} min aprox.</span></div>
        <div class="stat"><b>${euro(media)}</b><span>Precio medio en la ruta</span></div>
        <div class="stat n"><b>${todas.length}</b><span>Gasolineras a menos de ${desvio} km</span></div>
      </div>
    </div>
    <h2 class="h-lista">La más barata cada ${tramo} km</h2>
    <ol class="lista">${tramos.map((t) => t.mejor ? tarjeta(t.mejor, `${Math.round(t.ini)}–${Math.round(t.fin)}`) : `<li class="est vacio-tramo"><div class="pos">${Math.round(t.ini)}–${Math.round(t.fin)}</div><div>Sin gasolineras con ${esc(c.nombre)} a menos de ${desvio} km</div></li>`).join('')}</ol>
    <h2 class="h-lista">Las 10 más baratas de toda la ruta</h2>
    <ol class="lista">${ordenadas.slice(0, 10).map((x, k) => tarjeta(x, k + 1)).join('')}</ol>
    <p class="nota">Precios oficiales del Ministerio, ${esc(SITIO.fecha?.texto || '')}. Ruta calculada con OpenStreetMap (OSRM); la ruta real puede variar. La más cara del recorrido está a ${euro(max)} €/l.</p>`;
    history.replaceState(null, '', `/ruta/?o=${encodeURIComponent($('rOrigen').value)}&d=${encodeURIComponent($('rDestino').value)}&c=${c.k}`);
    await pintarMapa(ruta.coords, destacadas, todas.filter((x) => !destacadas.includes(x)));
    window.rellenarAnuncios?.();
  } catch (err) {
    console.warn(err);
    out.innerHTML = '<div class="vacio"><strong>No hemos podido calcular la ruta</strong><span>Comprueba el origen y el destino o inténtalo de nuevo en un momento.</span></div>';
  }
}

// ---------- Inicio ----------
$('rComb').innerHTML = COMBUSTIBLES.map((c) => `<option value="${c.k}">${esc(c.nombre)}</option>`).join('');
autocompletar($('rOrigen'));
autocompletar($('rDestino'));
$('rForm').addEventListener('submit', (e) => { e.preventDefault(); buscar(); });
$('rInvertir').addEventListener('click', () => {
  const o = $('rOrigen'), d = $('rDestino');
  [o.value, d.value] = [d.value, o.value];
  [o._lugar, d._lugar] = [d._lugar, o._lugar];
});
$('rGps').addEventListener('click', () => {
  if (!('geolocation' in navigator)) return;
  $('rOrigen').value = 'Buscando tu ubicación…';
  navigator.geolocation.getCurrentPosition((p) => {
    $('rOrigen')._lugar = { n: 'Mi ubicación', lat: p.coords.latitude, lon: p.coords.longitude };
    $('rOrigen').value = 'Mi ubicación';
  }, () => { $('rOrigen').value = ''; }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
});
{
  const p = new URLSearchParams(location.search);
  if (p.get('c') && COMBUSTIBLES.some((c) => c.k === p.get('c'))) $('rComb').value = p.get('c');
  if (p.get('o')) $('rOrigen').value = p.get('o');
  if (p.get('d')) $('rDestino').value = p.get('d');
  if (p.get('o') && p.get('d')) buscar();
}
