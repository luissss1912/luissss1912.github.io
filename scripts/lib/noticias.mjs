// Noticias automáticas escritas a partir de los precios oficiales.
// - Diaria: "Precio de la gasolina hoy, 2 de octubre: …" (se actualiza durante el día y se congela al cambiar de día).
// - Semanal (lunes): balance de los últimos 7 días.
// - Aviso: cuando la gasolina o el diésel cambian 3 céntimos o más en una semana.
// Cada noticia se guarda como datos (historico/noticias.json) y su página se vuelve a generar en cada publicación.
import { C, precioDe, esc, euro } from '../../src/comun.js';
import { serie } from './datos.mjs';
import { graficoLineas } from './grafico.mjs';

const I95 = 0, IDIE = 1;
const FUERA = new Set(['35', '38', '51', '52']); // Canarias, Ceuta y Melilla: otros impuestos
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const UMBRAL_AVISO = 0.03;

// ---------- Utilidades ----------
const fechaDe = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const isoDe = (dt) => dt.toISOString().slice(0, 10);
const restarDias = (iso, n) => isoDe(new Date(fechaDe(iso).getTime() - n * 864e5));
const textoFecha = (iso) => { const d = fechaDe(iso); return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`; };
const textoFechaLarga = (iso) => `${textoFecha(iso)} de ${fechaDe(iso).getUTCFullYear()}`;
const diaSemana = (iso) => DIAS[fechaDe(iso).getUTCDay()];
const cts = (v) => Math.abs(v * 100).toFixed(1).replace('.', ',');
const r4 = (v) => (v == null ? null : +v.toFixed(4));
// Elige una variante de texto fija para cada día (para que no todos los artículos digan lo mismo)
const variante = (semilla, opciones) => {
  let h = 0;
  for (const c of semilla) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return opciones[h % opciones.length];
};
const mov = (d, { m = 'masc' } = {}) => {
  if (d == null) return null;
  if (Math.abs(d) < 0.0005) return m === 'fem' ? 'se mantiene' : 'se mantiene';
  return d > 0 ? `sube ${cts(d)} céntimos` : `baja ${cts(d)} céntimos`;
};

// Valor del histórico en una fecha concreta o el más cercano anterior (hasta 'margen' días)
function valorEn(hist, iso, ruta, margen = 2) {
  for (let i = 0; i <= margen; i++) {
    const d = hist?.dias?.[restarDias(iso, i)];
    const v = d && ruta(d);
    if (v != null) return { iso: restarDias(iso, i), v };
  }
  return null;
}

// ---------- Foto de los datos de hoy ----------
function foto(datos, hist) {
  const f = datos.fecha;
  const nac = {};
  for (const k of ['g95', 'diesel', 'g98', 'glp']) if (datos.nacional[k]) nac[k] = { media: r4(datos.nacional[k].media), min: datos.nacional[k].min, n: datos.nacional[k].n };
  const ayer = {};
  const semana = {};
  for (const k of Object.keys(nac)) {
    const a = valorEn(hist, restarDias(f.iso, 1), (d) => d.n?.[k], 3);
    if (a) ayer[k] = a.v;
    const s = valorEn(hist, restarDias(f.iso, 7), (d) => d.n?.[k], 2);
    if (s) semana[k] = s.v;
  }
  const rutaMun = (e) => datos.provMap.get(e[C.prov])?.municipios.get(e[C.munId])?.ruta || null;
  const est = (e, i) => ({ marca: e[C.marca], dir: e[C.dir], mun: e[C.mun], prov: datos.provMap.get(e[C.prov])?.nombre || '', ruta: rutaMun(e), precio: precioDe(e, i), lat: e[C.lat], lon: e[C.lon] });
  const pen = datos.estaciones.filter((e) => !FUERA.has(e[C.prov]));
  const top = (i) => pen.filter((e) => precioDe(e, i)).sort((a, b) => precioDe(a, i) - precioDe(b, i)).slice(0, 5).map((e) => est(e, i));

  const provs = datos.provincias.filter((p) => !FUERA.has(p.id) && p.resumen.g95 && p.estaciones.length >= 20)
    .map((p) => {
      const a = valorEn(hist, restarDias(f.iso, 1), (d) => d.p?.[p.id]?.g95, 3);
      const s = valorEn(hist, restarDias(f.iso, 7), (d) => d.p?.[p.id]?.g95, 2);
      const ad = valorEn(hist, restarDias(f.iso, 1), (d) => d.p?.[p.id]?.diesel, 3);
      return { id: p.id, nombre: p.nombre, ruta: p.ruta, g95: r4(p.resumen.g95.media), diesel: r4(p.resumen.diesel?.media), d95: a ? r4(p.resumen.g95.media - a.v) : null, dDie: ad && p.resumen.diesel ? r4(p.resumen.diesel.media - ad.v) : null, s95: s ? r4(p.resumen.g95.media - s.v) : null };
    });
  const por95 = [...provs].sort((a, b) => a.g95 - b.g95);
  const marcas = datos.marcas.filter((m) => m.resumen.g95 && m.estaciones.length >= 50)
    .map((m) => ({ nombre: m.nombre, ruta: m.ruta, g95: r4(m.resumen.g95.media), diesel: r4(m.resumen.diesel?.media), n: m.estaciones.length }))
    .sort((a, b) => a.g95 - b.g95);
  const can = datos.provincias.filter((p) => p.id === '35' || p.id === '38');
  const canMedia = can.length ? can.reduce((s, p) => s + (p.resumen.g95?.media || 0) * p.estaciones.length, 0) / can.reduce((s, p) => s + p.estaciones.length, 0) : null;

  return {
    fecha: { iso: f.iso, texto: f.texto, corto: f.corto, hora: f.hora, isoCompleto: f.isoCompleto || f.iso },
    nac, ayer, semana,
    baratas95: top(I95), baratasDie: top(IDIE),
    provBaratas: por95.slice(0, 3), provCaras: por95.slice(-3).reverse(),
    provSuben: provs.filter((p) => p.d95 != null && p.d95 > 0.0005).sort((a, b) => b.d95 - a.d95).slice(0, 3),
    provBajan: provs.filter((p) => p.d95 != null && p.d95 < -0.0005).sort((a, b) => a.d95 - b.d95).slice(0, 3),
    provSemana: provs.filter((p) => p.s95 != null).sort((a, b) => b.s95 - a.s95),
    marcasBaratas: marcas.slice(0, 3), marcasCaras: marcas.slice(-2).reverse(),
    canarias: canMedia ? r4(canMedia) : null,
    nEst: datos.estaciones.length,
  };
}

// ---------- Generar / actualizar la lista de noticias ----------
export function actualizarNoticias(previas, datos, hist) {
  const lista = Array.isArray(previas?.lista) ? previas.lista : [];
  const porId = new Map(lista.map((n) => [n.id, n]));
  const f = datos.fecha;
  const d = foto(datos, hist);
  const guardar = (n) => {
    const ya = porId.get(n.id);
    porId.set(n.id, { ...n, publicada: ya?.publicada || f.isoCompleto || f.iso, actualizada: f.isoCompleto || f.iso });
  };

  // 1. Diaria
  guardar({ id: `diaria-${f.iso}`, tipo: 'diaria', iso: f.iso, slug: `/noticias/precio-gasolina-hoy-${textoFechaLarga(f.iso).replace(/ de /g, '-').replace(/\s+/g, '-')}/`, d });

  // 2. Semanal (los lunes, si hay datos de hace una semana)
  if (fechaDe(f.iso).getUTCDay() === 1 && d.semana.g95 != null) {
    const desdeIso = restarDias(f.iso, 7);
    guardar({ id: `semanal-${f.iso}`, tipo: 'semanal', iso: f.iso, desde: desdeIso, slug: `/noticias/precio-gasolina-semana-${f.iso}/`, d });
  }

  // 3. Aviso de subida o bajada fuerte en 7 días (como mucho uno al día: el cambio mayor)
  const avisos = ['g95', 'diesel']
    .filter((k) => d.semana[k] != null && d.nac[k])
    .map((k) => ({ k, delta: d.nac[k].media - d.semana[k] }))
    .filter((a) => Math.abs(a.delta) >= UMBRAL_AVISO)
    .map((a) => ({ ...a, signo: a.delta > 0 ? 'sube' : 'baja' }))
    .filter((a) => ![...porId.values()].some((n) => n.tipo === 'aviso' && n.comb === a.k && n.signo === a.signo && n.iso > restarDias(f.iso, 6) && n.iso !== f.iso))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  for (const n of [...porId.values()]) if (n.tipo === 'aviso' && n.iso === f.iso && !avisos.slice(0, 1).some((a) => n.comb === a.k)) porId.delete(n.id);
  const a = avisos[0];
  if (a) guardar({ id: `aviso-${a.k}-${a.signo}-${f.iso}`, tipo: 'aviso', comb: a.k, signo: a.signo, delta: r4(a.delta), iso: f.iso, slug: `/noticias/${a.k === 'g95' ? 'gasolina' : 'diesel'}-${a.signo}-${f.iso}/`, d });

  const todas = [...porId.values()].sort((a, b) => (b.iso + b.tipo).localeCompare(a.iso + a.tipo)).slice(0, 1500);
  return { lista: todas };
}

// ---------- Textos ----------
const nombreComb = { g95: 'gasolina 95', diesel: 'diésel', g98: 'gasolina 98', glp: 'autogás' };

function titular(n) {
  const d = n.d;
  const fecha = textoFecha(n.iso);
  if (n.tipo === 'aviso') {
    const quien = n.comb === 'g95' ? 'La gasolina' : 'El diésel';
    return `${quien} ${n.signo} ${cts(n.delta)} céntimos en una semana y se sitúa en ${euro(d.nac[n.comb].media)} €/l`;
  }
  if (n.tipo === 'semanal') {
    const d95 = d.nac.g95.media - d.semana.g95;
    const dDie = d.nac.diesel && d.semana.diesel != null ? d.nac.diesel.media - d.semana.diesel : null;
    const a = Math.abs(d95) < 0.0005 ? 'La gasolina se mantiene' : `La gasolina ${d95 > 0 ? 'sube' : 'baja'} ${cts(d95)} céntimos`;
    const b = dDie == null ? '' : Math.abs(dDie) < 0.0005 ? ' y el diésel se mantiene' : ` y el diésel ${dDie > 0 ? 'sube' : 'baja'} ${cts(dDie)}`;
    const mismoMes = n.desde.slice(0, 7) === n.iso.slice(0, 7);
    return `${a}${b} esta semana: balance del ${mismoMes ? fechaDe(n.desde).getUTCDate() : textoFecha(n.desde)} al ${fecha}`;
  }
  // diaria
  const cambios = ['g95', 'diesel'].filter((k) => d.ayer[k] != null && d.nac[k]).map((k) => ({ k, v: d.nac[k].media - d.ayer[k] }));
  const mayor = cambios.sort((a, b) => Math.abs(b.v) - Math.abs(a.v))[0];
  if (!mayor) return `Precio de la gasolina hoy, ${fecha}: la 95 a ${euro(d.nac.g95.media)} €/l y el diésel a ${euro(d.nac.diesel?.media)} €/l`;
  if (Math.abs(mayor.v) < 0.0005) return `Precio de la gasolina hoy, ${fecha}: precios estables, la 95 a ${euro(d.nac.g95.media)} €/l`;
  const art = mayor.k === 'g95' ? 'la gasolina' : 'el diésel';
  return `Precio de la gasolina hoy, ${fecha}: ${art} ${mayor.v > 0 ? 'sube' : 'baja'} ${cts(mayor.v)} céntimos`;
}

function entradilla(n) {
  const d = n.d;
  const g = d.nac.g95, di = d.nac.diesel;
  if (n.tipo === 'aviso') {
    return `El precio medio del ${n.comb === 'g95' ? 'litro de gasolina 95' : 'litro de diésel'} en España ${n.signo === 'sube' ? 'ha subido' : 'ha bajado'} ${cts(n.delta)} céntimos en los últimos siete días, hasta ${euro(d.nac[n.comb].media)} €. Te contamos dónde repostar más barato.`;
  }
  if (n.tipo === 'semanal') {
    return `Repasamos cómo ha cambiado el precio de la gasolina y el diésel en España del ${textoFecha(n.desde)} al ${textoFecha(n.iso)}, qué provincias han subido más y dónde sigue siendo más barato repostar.`;
  }
  const a95 = d.ayer.g95 != null ? `, ${mov(g.media - d.ayer.g95)} respecto a ayer` : '';
  const aDi = di && d.ayer.diesel != null ? ` (${mov(di.media - d.ayer.diesel)})` : '';
  return `El litro de gasolina 95 cuesta hoy de media ${euro(g.media)} € en España${a95}, y el de diésel ${euro(di?.media)} €${aDi}. Estas son las gasolineras más baratas para repostar hoy ${diaSemana(n.iso)}.`;
}

const enlace = (ruta, texto) => (ruta ? `<a href="${ruta}">${esc(texto)}</a>` : esc(texto));
const listaProv = (ps, campo = 'g95') => ps.map((p) => `${enlace(p.ruta, p.nombre)} (${euro(p[campo])} €/l)`).join(', ').replace(/, ([^,]*)$/, ' y $1');

function tablaTop(xs, titulo) {
  if (!xs.length) return '';
  return `<div><h3>${titulo}</h3><ol class="rank">${xs.map((x, k) => `<li><span class="rank-n">${k + 1}</span><div class="rank-d"><strong>${esc(x.marca)}</strong><span>${esc(x.dir)}, ${enlace(x.ruta, x.mun)} (${esc(x.prov)})</span><span class="rank-m"><a href="https://www.google.com/maps/dir/?api=1&destination=${x.lat},${x.lon}" target="_blank" rel="noopener">Cómo llegar</a></span></div><b class="rank-p">${euro(x.precio)}</b></li>`).join('')}</ol></div>`;
}

function cuerpoDiaria(n, h) {
  const d = n.d, g = d.nac.g95, di = d.nac.diesel;
  const p = [];
  const sem = (k) => (d.semana[k] != null && d.nac[k] ? d.nac[k].media - d.semana[k] : null);
  // Precio medio
  p.push(`<p>${variante(n.iso, [
    `Según los datos oficiales del Ministerio para la Transición Ecológica, actualizados a las ${esc(d.fecha.hora || '—')}, el precio medio de la gasolina 95 en España es hoy de <b>${euro(g.media)} €/l</b>${d.ayer.g95 != null ? `, lo que significa que ${mov(g.media - d.ayer.g95)} con respecto a ayer` : ''}. El diésel se sitúa en <b>${euro(di?.media)} €/l</b>${di && d.ayer.diesel != null ? ` y ${mov(di.media - d.ayer.diesel)}` : ''}.`,
    `Llenar el depósito cuesta hoy ${diaSemana(n.iso)} algo ${d.ayer.g95 != null && g.media > d.ayer.g95 ? 'más' : d.ayer.g95 != null && g.media < d.ayer.g95 ? 'menos' : 'lo mismo'} que ayer. La gasolina 95 marca una media de <b>${euro(g.media)} €/l</b> y el diésel de <b>${euro(di?.media)} €/l</b>, según los precios que ${d.nEst.toLocaleString('es-ES')} gasolineras han comunicado al Ministerio.`,
    `La gasolina 95 se vende hoy a una media de <b>${euro(g.media)} €/l</b> en las gasolineras españolas${d.ayer.g95 != null ? ` (${mov(g.media - d.ayer.g95)} frente a ayer)` : ''}, mientras que el diésel cuesta <b>${euro(di?.media)} €/l</b>${di && d.ayer.diesel != null ? ` (${mov(di.media - d.ayer.diesel)})` : ''}.`,
  ])}</p>`);
  const s95 = sem('g95'), sDi = sem('diesel');
  if (s95 != null) p.push(`<p>En la última semana, la gasolina 95 acumula ${Math.abs(s95) < 0.0005 ? 'precios estables' : `una ${s95 > 0 ? 'subida' : 'bajada'} de ${cts(s95)} céntimos`}${sDi != null ? ` y el diésel ${Math.abs(sDi) < 0.0005 ? 'se mantiene' : `${sDi > 0 ? 'sube' : 'baja'} ${cts(sDi)} céntimos`}` : ''}.${d.nac.g98 ? ` La gasolina 98 está a ${euro(d.nac.g98.media)} €/l de media${d.nac.glp ? ` y el autogás (GLP) a ${euro(d.nac.glp.media)} €/l` : ''}.` : ''}</p>`);

  // Más baratas
  const b = d.baratas95[0], bd = d.baratasDie[0];
  p.push(`<h2>Las gasolineras más baratas de España hoy</h2>`);
  if (b) p.push(`<p>${variante(n.iso + 'b', [
    `La gasolinera con la gasolina 95 más barata de la península y Baleares es hoy <b>${esc(b.marca)}</b>, en ${esc(b.dir)} (${enlace(b.ruta, b.mun)}, ${esc(b.prov)}), a <b>${euro(b.precio)} €/l</b>: ${cts(g.media - b.precio)} céntimos por debajo de la media.`,
    `Si buscas la gasolina 95 más barata, hoy hay que ir a <b>${esc(b.marca)}</b>, en ${enlace(b.ruta, b.mun)} (${esc(b.prov)}), donde el litro cuesta <b>${euro(b.precio)} €</b>, ${cts(g.media - b.precio)} céntimos menos que la media nacional.`,
  ])}${bd ? ` Para el diésel, la más barata es <b>${esc(bd.marca)}</b> en ${enlace(bd.ruta, bd.mun)} (${esc(bd.prov)}), a <b>${euro(bd.precio)} €/l</b>.` : ''}</p>`);
  p.push(`<div class="bloque dos">${tablaTop(d.baratas95, 'Gasolina 95 más barata')}${tablaTop(d.baratasDie, 'Diésel más barato')}</div>`);
  p.push(`<p class="nota">Península y Baleares. Canarias, Ceuta y Melilla tienen impuestos distintos${d.canarias ? `: en Canarias la gasolina 95 cuesta de media ${euro(d.canarias)} €/l` : ''}.</p>`);
  p.push(h.hueco('articulo'));

  // Provincias
  p.push(`<h2>Precio de la gasolina por provincias</h2>`);
  p.push(`<p>Por provincias, la gasolina 95 más barata está hoy en ${listaProv(d.provBaratas)}. En el lado contrario, las provincias más caras son ${listaProv(d.provCaras)}.${d.provBaratas[0] && d.provCaras[0] ? ` Entre la más barata y la más cara hay ${cts(d.provCaras[0].g95 - d.provBaratas[0].g95)} céntimos por litro de diferencia.` : ''}</p>`);
  if (d.provSuben.length || d.provBajan.length) {
    p.push(`<p>${d.provSuben.length ? `Las mayores subidas respecto a ayer se registran en ${d.provSuben.map((x) => `${enlace(x.ruta, x.nombre)} (+${cts(x.d95)} cts)`).join(', ').replace(/, ([^,]*)$/, ' y $1')}` : 'Ninguna provincia sube hoy'}${d.provBajan.length ? `, mientras que bajan sobre todo ${d.provBajan.map((x) => `${enlace(x.ruta, x.nombre)} (−${cts(x.d95)} cts)`).join(', ').replace(/, ([^,]*)$/, ' y $1')}` : ''}.</p>`);
  }

  // Marcas
  if (d.marcasBaratas.length >= 2) {
    p.push(`<h2>Qué marca es más barata hoy</h2>`);
    p.push(`<p>Entre las cadenas con más de 50 gasolineras, las más baratas para la gasolina 95 son ${d.marcasBaratas.map((m) => `${enlace(m.ruta, m.nombre)} (${euro(m.g95)} €/l)`).join(', ').replace(/, ([^,]*)$/, ' y $1')}. Las más caras, ${d.marcasCaras.map((m) => `${enlace(m.ruta, m.nombre)} (${euro(m.g95)} €/l)`).join(' y ')}.</p>`);
  }

  // Ahorro
  if (b) p.push(`<h2>Cuánto puedes ahorrar</h2><p>Llenar un depósito de 50 litros de gasolina 95 en la gasolinera más barata en lugar de pagarlo al precio medio supone un ahorro de <b>${euro((g.media - b.precio) * 50, 2)} €</b>. Las diferencias dentro de una misma ciudad también son grandes, así que merece la pena comparar antes de repostar.</p>`);
  p.push(`<p><a class="btn" href="/">Buscar la gasolinera más barata cerca de mí</a> <a class="btn sec" href="/precio-gasolina-hoy/">Ver todos los precios de hoy</a></p>`);
  return p.join('\n');
}

function cuerpoSemanal(n, h, hist) {
  const d = n.d;
  const p = [];
  const fila = (k) => {
    if (!d.nac[k] || d.semana[k] == null) return '';
    const v = d.nac[k].media - d.semana[k];
    return `<tr><td>${nombreComb[k][0].toUpperCase() + nombreComb[k].slice(1)}</td><td class="num">${euro(d.semana[k])}</td><td class="num">${euro(d.nac[k].media)}</td><td class="num">${Math.abs(v) < 0.0005 ? '=' : `${v > 0 ? '+' : '−'}${cts(v)}`}</td></tr>`;
  };
  p.push(`<p>${entradilla(n)}</p>`);
  p.push(`<div class="tabla-scroll"><table class="tabla"><thead><tr><th scope="col">Combustible</th><th scope="col" class="num">${textoFecha(n.desde)}</th><th scope="col" class="num">${textoFecha(n.iso)}</th><th scope="col" class="num">Cambio (cts)</th></tr></thead><tbody>${['g95', 'diesel', 'g98', 'glp'].map(fila).join('')}</tbody></table></div>`);
  const graf = graficoLineas([
    { nombre: 'Gasolina 95', datos: serie(hist, (x) => x.n?.g95).filter((x) => x.f <= n.iso) },
    { nombre: 'Diésel', datos: serie(hist, (x) => x.n?.diesel).filter((x) => x.f <= n.iso) },
  ]);
  if (graf) p.push(`<h2>Evolución del precio medio</h2>${graf}`);
  p.push(h.hueco('articulo'));
  const ps = d.provSemana || [];
  if (ps.length >= 6) {
    const suben = ps.filter((x) => x.s95 > 0.0005).slice(0, 3), bajan = [...ps].reverse().filter((x) => x.s95 < -0.0005).slice(0, 3);
    p.push(`<h2>Las provincias que más han cambiado</h2><p>${suben.length ? `Donde más ha subido la gasolina 95 esta semana es en ${suben.map((x) => `${enlace(x.ruta, x.nombre)} (+${cts(x.s95)} cts)`).join(', ').replace(/, ([^,]*)$/, ' y $1')}.` : 'Ninguna provincia ha subido esta semana.'} ${bajan.length ? `Donde más ha bajado: ${bajan.map((x) => `${enlace(x.ruta, x.nombre)} (−${cts(x.s95)} cts)`).join(', ').replace(/, ([^,]*)$/, ' y $1')}.` : ''}</p>`);
  }
  p.push(`<h2>Dónde repostar más barato</h2><p>Hoy la gasolina 95 es más barata en ${listaProv(d.provBaratas)}.</p>`);
  p.push(`<div class="bloque dos">${tablaTop(d.baratas95, 'Gasolina 95 más barata')}${tablaTop(d.baratasDie, 'Diésel más barato')}</div>`);
  p.push(`<p><a class="btn" href="/">Buscar la gasolinera más barata cerca de mí</a></p>`);
  return p.join('\n');
}

function cuerpoAviso(n, h) {
  const d = n.d, k = n.comb;
  const p = [];
  p.push(`<p>${entradilla(n)}</p>`);
  p.push(`<p>Hace una semana, el litro de ${nombreComb[k]} costaba de media ${euro(d.semana[k])} €; hoy cuesta <b>${euro(d.nac[k].media)} €</b>. Para un depósito de 50 litros, la diferencia es de ${euro(Math.abs(n.delta) * 50, 2)} € ${n.signo === 'sube' ? 'más' : 'menos'}.</p>`);
  p.push(`<h2>Dónde repostar más barato hoy</h2>`);
  p.push(tablaTop(k === 'g95' ? d.baratas95 : d.baratasDie, k === 'g95' ? 'Gasolina 95 más barata' : 'Diésel más barato'));
  p.push(h.hueco('articulo'));
  p.push(`<p>Por provincias, la gasolina 95 más barata está en ${listaProv(d.provBaratas)}.</p>`);
  p.push(`<p><a class="btn" href="/">Buscar la gasolinera más barata cerca de mí</a></p>`);
  return p.join('\n');
}

// ---------- Páginas ----------
export function paginasNoticias(cfg, noticias, hist, h) {
  const paginas = [];
  const lista = noticias.lista;
  const fechaCorta = (iso) => { const d = fechaDe(iso); return `${d.getUTCDate()} ${MESES[d.getUTCMonth()].slice(0, 3)}. ${d.getUTCFullYear()}`; };
  const etiqueta = { diaria: 'Precio hoy', semanal: 'Balance semanal', aviso: 'Última hora' };
  const tarjeta = (n) => `<li class="noti"><a href="${n.slug}"><span class="noti-et">${etiqueta[n.tipo]} · <time datetime="${n.iso}">${fechaCorta(n.iso)}</time></span><strong>${esc(titular(n))}</strong><span class="noti-ent">${esc(entradilla(n))}</span></a></li>`;
  const autor = { '@type': 'Organization', name: cfg.nombre, url: h.abs('/') };

  for (const n of lista) {
    const t = titular(n);
    const m = h.migas([['/noticias/', 'Noticias'], [n.slug, textoFechaLarga(n.iso)]]);
    const cuerpo = n.tipo === 'semanal' ? cuerpoSemanal(n, h, hist) : n.tipo === 'aviso' ? cuerpoAviso(n, h) : cuerpoDiaria(n, h);
    const relacionadas = lista.filter((x) => x !== n && x.iso <= n.iso).slice(0, 4);
    const html = `${m.html}
<article class="noticia">
  <header class="cabecera">
    <span class="noti-et">${etiqueta[n.tipo]}</span>
    <h1>${esc(t)}</h1>
    <p class="sub">${esc(n.tipo === 'diaria' ? entradilla(n) : '')}</p>
    <p class="noti-meta">Por ${esc(cfg.nombre)} · <time datetime="${n.publicada}">${textoFechaLarga(n.iso)}</time>${n.d.fecha.hora ? ` · Datos de las ${n.d.fecha.hora}` : ''}</p>
  </header>
  ${h.hueco('superior')}
  <div class="noti-cuerpo">${cuerpo}</div>
  <p class="nota">Fuente: precios comunicados por las gasolineras al Ministerio para la Transición Ecológica y el Reto Demográfico. Pueden cambiar a lo largo del día: compruébalo en el surtidor.</p>
</article>
${h.afiliado('seguro')}
${relacionadas.length ? `<section class="bloque"><h2>Más noticias</h2><ul class="notis">${relacionadas.map(tarjeta).join('')}</ul></section>` : ''}`;
    paginas.push({
      ruta: n.slug, tipo: 'noticias',
      html: h.pagina({
        ruta: n.slug,
        titulo: h.titulo(...h.conMarca(t), t),
        descripcion: h.descripcion(entradilla(n)),
        cuerpo: html,
        actualizada: false,
        ogTipo: 'article',
        ogExtra: `\n<meta property="article:published_time" content="${n.publicada}">\n<meta property="article:modified_time" content="${n.actualizada}">`,
        schemas: [m.schema, {
          '@context': 'https://schema.org', '@type': 'NewsArticle', headline: t.slice(0, 110), description: entradilla(n),
          datePublished: n.publicada, dateModified: n.actualizada, inLanguage: 'es-ES',
          image: [h.abs('/og.png')], author: autor, publisher: { ...autor, logo: { '@type': 'ImageObject', url: h.abs('/icono-512.png') } },
          mainEntityOfPage: h.abs(n.slug),
        }],
      }),
    });
  }

  // Índice de noticias
  const recientes = lista.slice(0, 40);
  const m = h.migas([['/noticias/', 'Noticias']]);
  paginas.push({
    ruta: '/noticias/', tipo: 'noticias',
    html: h.pagina({
      ruta: '/noticias/',
      titulo: h.titulo(`Noticias del precio de la gasolina y el diésel | ${cfg.nombre}`, 'Noticias del precio de la gasolina'),
      descripcion: h.descripcion('Cada día, cuánto cuesta la gasolina y el diésel en España, dónde está más barata y cómo cambian los precios.', 'Con datos oficiales.'),
      cuerpo: `${m.html}
<header class="cabecera"><h1>Noticias del precio de la gasolina</h1><p class="sub">Cada día publicamos cuánto cuesta la gasolina y el diésel, dónde está más barata y cómo han cambiado los precios, con los datos oficiales del Ministerio.</p></header>
${recientes.length ? `<ul class="notis">${recientes.map(tarjeta).join('')}</ul>` : '<p>Pronto publicaremos la primera noticia.</p>'}
${h.hueco('articulo')}
${lista.length > recientes.length ? `<p><a href="/noticias/archivo/">Ver todas las noticias anteriores</a></p>` : ''}`,
      schemas: [m.schema],
    }),
  });
  if (lista.length > recientes.length) {
    const ma = h.migas([['/noticias/', 'Noticias'], ['/noticias/archivo/', 'Archivo']]);
    paginas.push({
      ruta: '/noticias/archivo/', tipo: 'noticias',
      html: h.pagina({
        ruta: '/noticias/archivo/', titulo: `Archivo de noticias | ${cfg.nombre}`, descripcion: 'Todas las noticias sobre el precio de la gasolina y el diésel.',
        cuerpo: `${ma.html}<header class="cabecera"><h1>Archivo de noticias</h1></header><ul class="archivo">${lista.map((n) => `<li><time datetime="${n.iso}">${fechaCorta(n.iso)}</time> <a href="${n.slug}">${esc(titular(n))}</a></li>`).join('')}</ul>`,
        schemas: [ma.schema],
      }),
    });
  }

  // Bloque "Últimas noticias" para otras páginas
  const ultimas = lista.length ? `<section class="bloque"><div class="bloque-cab"><h2>Últimas noticias</h2><a href="/noticias/">Ver todas ›</a></div><ul class="notis">${lista.slice(0, 3).map(tarjeta).join('')}</ul></section>` : '';

  // RSS
  const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rfc = (iso) => new Date(iso.length > 10 ? iso : `${iso}T08:00:00+02:00`).toUTCString();
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${x(cfg.nombre)}: noticias del precio de la gasolina</title>
<link>${h.abs('/noticias/')}</link>
<atom:link href="${h.abs('/noticias/rss.xml')}" rel="self" type="application/rss+xml"/>
<description>Precio de la gasolina y el diésel en España, cada día.</description>
<language>es-es</language>
${lista.slice(0, 30).map((n) => `<item><title>${x(titular(n))}</title><link>${h.abs(n.slug)}</link><guid>${h.abs(n.slug)}</guid><pubDate>${rfc(n.publicada)}</pubDate><description>${x(entradilla(n))}</description></item>`).join('\n')}
</channel>
</rss>
`;
  return { paginas, ultimas, rss };
}
