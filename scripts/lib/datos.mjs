import { COMBUSTIBLES, C, nombreLugar, nombreMarca, titulo, slug, precioDe } from '../../src/comun.js';

const num = (s) => {
  if (s == null || s === '') return null;
  const v = parseFloat(String(s).trim().replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

export async function descargarMinisterio(url, intentos = 3) {
  for (let i = 1; i <= intentos; i++) {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(120_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (!Array.isArray(j?.ListaEESSPrecio) || !j.ListaEESSPrecio.length) throw new Error('Respuesta vacía');
      return j;
    } catch (err) {
      console.warn(`  Intento ${i} de ${intentos} fallido: ${err.message}`);
      if (i === intentos) throw err;
      await new Promise((ok) => setTimeout(ok, 5000 * i));
    }
  }
}

// "01/10/2026 9:44:16" -> { iso: '2026-10-01', texto: '1 de octubre de 2026', hora: '09:44' }
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function leerFecha(f) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(f || '');
  if (!m) {
    const d = new Date();
    const iso = d.toISOString().slice(0, 10);
    return { iso, isoCompleto: iso, texto: `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`, corto: `${d.getDate()} de ${MESES[d.getMonth()]}`, hora: '' };
  }
  const [, d, mo, y, h, mi] = m;
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const hora = h ? `${h.padStart(2, '0')}:${mi}` : '';
  return {
    iso,
    // Fecha y hora con la zona de Madrid, para dateModified: "2026-10-01T09:44:00+02:00"
    isoCompleto: hora ? `${iso}T${hora}:00${desfaseMadrid(iso, hora)}` : iso,
    texto: `${+d} de ${MESES[+mo - 1]} de ${y}`,
    corto: `${+d} de ${MESES[+mo - 1]}`,
    hora,
  };
}

// "+01:00" en invierno, "+02:00" en verano
function desfaseMadrid(iso, hora) {
  try {
    const n = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Madrid', timeZoneName: 'longOffset' })
      .formatToParts(new Date(`${iso}T${hora}:00Z`)).find((x) => x.type === 'timeZoneName')?.value;
    const m = /GMT([+-]\d{2}:\d{2})/.exec(n || '');
    return m ? m[1] : '+01:00';
  } catch { return '+01:00'; }
}

function resumen(estaciones) {
  const out = {};
  COMBUSTIBLES.forEach((f, i) => {
    let n = 0, suma = 0, min = null, max = null, barata = null;
    for (const e of estaciones) {
      const p = precioDe(e, i);
      if (!p) continue;
      n++; suma += p;
      if (min == null || p < min) { min = p; barata = e; }
      if (max == null || p > max) max = p;
    }
    out[f.k] = n ? { n, media: suma / n, min, max, barata } : null;
  });
  return out;
}

// rutas: registro de las direcciones ya publicadas (ver nuevoRegistroRutas). Se reutilizan
// para que la dirección de cada municipio y marca no cambie nunca de un día para otro.
export function procesar(raw, rutas = nuevoRegistroRutas()) {
  const fecha = leerFecha(raw.Fecha);
  const provincias = new Map();
  const estaciones = [];

  for (const e of raw.ListaEESSPrecio) {
    if ((e['Tipo Venta'] || 'P').trim().toUpperCase() === 'R') continue; // venta restringida a socios
    const lat = num(e['Latitud']), lon = num(e['Longitud (WGS84)']);
    if (lat == null || lon == null || (lat === 0 && lon === 0)) continue;
    const precios = COMBUSTIBLES.map((f) => {
      const p = num(e[f.campo]);
      return p && p > 0.3 && p < 5 ? Math.round(p * 1000) / 1000 : 0;
    });
    if (!precios.some(Boolean)) continue;

    const provId = String(e['IDProvincia'] || '').padStart(2, '0');
    const munId = String(e['IDMunicipio'] || e['Municipio'] || '');
    const est = [
      +e['IDEESS'] || estaciones.length + 1,
      nombreMarca(e['Rótulo']),
      titulo(e['Dirección']),
      nombreLugar(e['Municipio']),
      munId,
      provId,
      (e['C.P.'] || '').trim(),
      Math.round(lat * 1e5) / 1e5,
      Math.round(lon * 1e5) / 1e5,
      (e['Horario'] || '').trim(),
      ...precios,
    ];
    estaciones.push(est);

    let p = provincias.get(provId);
    if (!p) {
      const nombre = nombreLugar(e['Provincia']);
      p = { id: provId, nombre, slug: slug(nombre), estaciones: [], municipios: new Map(), bbox: [90, 180, -90, -180] };
      provincias.set(provId, p);
    }
    p.estaciones.push(est);
    p.bbox = [Math.min(p.bbox[0], est[C.lat]), Math.min(p.bbox[1], est[C.lon]), Math.max(p.bbox[2], est[C.lat]), Math.max(p.bbox[3], est[C.lon])];
    let m = p.municipios.get(munId);
    if (!m) {
      m = { id: munId, nombre: est[C.mun], slug: slug(est[C.mun]), provId, estaciones: [] };
      p.municipios.set(munId, m);
    }
    m.estaciones.push(est);
  }

  // Slugs únicos y estables por provincia, y centroides.
  // Primero los municipios ya publicados (conservan su dirección); después los nuevos,
  // en orden de identificador, sin pisar ninguna dirección usada antes.
  for (const p of provincias.values()) {
    p.ruta = `/gasolineras/${p.slug}/`;
    const usados = new Set(Object.values(rutas.municipios).filter((r) => r.prov === p.id).map((r) => r.ruta));
    const muns = [...p.municipios.values()];
    const nuevos = muns.filter((m) => !rutas.municipios[`${p.id}:${m.id}`]).sort((a, b) => a.id.localeCompare(b.id));
    for (const m of muns) {
      const previa = rutas.municipios[`${p.id}:${m.id}`];
      if (previa) m.ruta = previa.ruta;
    }
    for (const m of nuevos) {
      const k = m.slug || 'municipio';
      let n = 1, ruta = `${p.ruta}${k}/`;
      while (usados.has(ruta)) ruta = `${p.ruta}${k}-${++n}/`;
      usados.add(ruta);
      m.ruta = ruta;
    }
    for (const m of muns) {
      m.slug = m.ruta.slice(p.ruta.length, -1);
      m.lat = m.estaciones.reduce((s, e) => s + e[C.lat], 0) / m.estaciones.length;
      m.lon = m.estaciones.reduce((s, e) => s + e[C.lon], 0) / m.estaciones.length;
      m.resumen = resumen(m.estaciones);
    }
    p.resumen = resumen(p.estaciones);
    // Municipios publicados otros días que hoy no tienen precios: su página se mantiene
    p.ausentes = Object.entries(rutas.municipios)
      .filter(([k, r]) => r.prov === p.id && !p.municipios.has(k.slice(k.indexOf(':') + 1)))
      .map(([, r]) => r);
  }

  // Marcas con presencia suficiente para tener página propia
  const porMarca = new Map();
  for (const e of estaciones) {
    if (e[C.marca] === 'Gasolinera independiente') continue;
    const k = slug(e[C.marca]);
    if (!k) continue;
    const g = porMarca.get(k) || { slug: k, nombre: e[C.marca], estaciones: [] };
    g.estaciones.push(e);
    porMarca.set(k, g);
  }
  // Una marca ya publicada conserva su página aunque baje del mínimo
  const minimo = estaciones.length > 3000 ? 25 : 5;
  const marcas = [...porMarca.values()]
    .filter((m) => m.estaciones.length >= minimo || rutas.marcas[m.slug])
    .sort((a, b) => b.estaciones.length - a.estaciones.length)
    .map((m) => ({ ...m, resumen: resumen(m.estaciones), ruta: `/marcas/${m.slug}/` }));
  const marcasAusentes = Object.entries(rutas.marcas).filter(([k]) => !porMarca.has(k)).map(([, r]) => r);

  const ordenProv = [...provincias.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return { fecha, estaciones, provincias: ordenProv, provMap: provincias, marcas, marcasAusentes, nacional: resumen(estaciones) };
}

// ---------- Registro de direcciones publicadas ----------
export function nuevoRegistroRutas(r) {
  return { municipios: { ...(r?.municipios || {}) }, marcas: { ...(r?.marcas || {}) } };
}

// Junta dos registros. En caso de conflicto manda "a" (lo ya publicado).
export function unirRegistrosRutas(a, b) {
  const x = nuevoRegistroRutas(a), y = nuevoRegistroRutas(b);
  return { municipios: { ...y.municipios, ...x.municipios }, marcas: { ...y.marcas, ...x.marcas } };
}

export function actualizarRegistroRutas(rutas, datos) {
  const r = nuevoRegistroRutas(rutas);
  for (const p of datos.provincias) {
    for (const m of p.municipios.values()) {
      r.municipios[`${p.id}:${m.id}`] = { ruta: m.ruta, nombre: m.nombre, prov: p.id, lat: +m.lat.toFixed(4), lon: +m.lon.toFixed(4) };
    }
  }
  for (const m of datos.marcas) r.marcas[m.slug] = { ruta: m.ruta, nombre: m.nombre };
  return r;
}

// Las N más baratas de una lista para un combustible
export function masBaratas(estaciones, i, n = 10) {
  return estaciones.filter((e) => precioDe(e, i)).sort((a, b) => precioDe(a, i) - precioDe(b, i)).slice(0, n);
}

// ---------- Histórico de medias diarias ----------
export function actualizarHistorico(hist, datos) {
  const h = hist && hist.dias ? hist : { dias: {} };
  const dia = { n: {}, p: {} };
  for (const f of COMBUSTIBLES) if (datos.nacional[f.k]) dia.n[f.k] = +datos.nacional[f.k].media.toFixed(4);
  for (const p of datos.provincias) {
    dia.p[p.id] = {};
    for (const f of COMBUSTIBLES) if (p.resumen[f.k]) dia.p[p.id][f.k] = +p.resumen[f.k].media.toFixed(4);
  }
  h.dias[datos.fecha.iso] = dia;
  const fechas = Object.keys(h.dias).sort();
  for (const f of fechas.slice(0, Math.max(0, fechas.length - 400))) delete h.dias[f];
  return h;
}

// Valor del día anterior disponible para comparar
export function anterior(hist, isoHoy, ruta) {
  const fechas = Object.keys(hist?.dias || {}).filter((f) => f < isoHoy).sort();
  if (!fechas.length) return null;
  const d = hist.dias[fechas[fechas.length - 1]];
  return ruta(d) ?? null;
}

export function serie(hist, ruta, dias = 30) {
  return Object.keys(hist?.dias || {}).sort().slice(-dias)
    .map((f) => ({ f, v: ruta(hist.dias[f]) }))
    .filter((x) => x.v != null);
}
