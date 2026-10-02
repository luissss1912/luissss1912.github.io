// Genera el HTML de cada página del sitio.
import { COMBUSTIBLES, C, precioDe, esc, euro, distancia, es24h, slug } from '../../src/comun.js';
import { anterior, serie, resumen } from './datos.mjs';
import { graficoLineas } from './grafico.mjs';

const I95 = 0, IDIE = 1;
// Nombres por los que la gente busca marcas que han cambiado de nombre
const ALIAS = { plenergy: 'Plenergy (Plenoil)', moeve: 'Moeve (Cepsa)' };
const nombreSEO = (mk) => ALIAS[mk.slug] || mk.nombre;
const MIN_MP = 3; // mínimo de gasolineras de una marca en una provincia para tener página propia

export function crearPaginas(cfg, ctx, h) {
  const { datos, historico } = ctx;
  const ultimasNoticias = ctx.ultimasNoticias || '';
  const f = datos.fecha;
  const hoy = `hoy, ${f.texto}`;
  const nEst = datos.estaciones.length.toLocaleString('es-ES');
  const nac = datos.nacional;
  const ayerNac = anterior(historico, f.iso, (d) => d.n);
  const paginas = [];
  // tipo: grupo del sitemap (general, provincias, municipios, marcas o legal)
  const add = (ruta, html, tipo = 'general', extra = {}) => paginas.push({ ruta, html, tipo, ...extra });

  const iconoGps = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>';

  // Rejilla espacial para buscar gasolineras cercanas rápido
  const rejilla = new Map();
  const celda = (lat, lon) => `${Math.floor(lat * 10)}:${Math.floor(lon * 10)}`;
  for (const e of datos.estaciones) {
    const k = celda(e[C.lat], e[C.lon]);
    if (!rejilla.has(k)) rejilla.set(k, []);
    rejilla.get(k).push(e);
  }
  function cercanas(lat, lon, radio) {
    const out = [];
    const a = Math.floor(lat * 10), b = Math.floor(lon * 10), r = Math.ceil(radio / 8);
    for (let i = a - r; i <= a + r; i++) for (let j = b - r; j <= b + r; j++) {
      for (const e of rejilla.get(`${i}:${j}`) || []) {
        const d = distancia(lat, lon, e[C.lat], e[C.lon]);
        if (d <= radio) out.push({ e, d });
      }
    }
    return out;
  }

  const todosMunicipios = datos.provincias.flatMap((p) => [...p.municipios.values()]);
  // Canarias, Ceuta y Melilla tienen otros impuestos: los rankings nacionales se hacen sin ellas
  const FUERA = new Set(['35', '38', '51', '52']);
  const peninsula = datos.estaciones.filter((e) => !FUERA.has(e[C.prov]));
  const canarias = datos.estaciones.filter((e) => e[C.prov] === '35' || e[C.prov] === '38');

  // "gasolina 95 desde 1,609 €/l y diésel desde 1,509 €/l" (para descripciones)
  const desde = (r) => [r.g95 && `gasolina 95 desde ${euro(r.g95.min)} €/l`, r.diesel && `diésel desde ${euro(r.diesel.min)} €/l`].filter(Boolean).join(' y ');

  // Lista de gasolineras de fuera del municipio, con la distancia
  const listaFuera = (xs, i) => `<ol class="rank">${xs.map((x, k) => `<li><span class="rank-n">${k + 1}</span><div class="rank-d"><strong>${esc(x.e[C.marca])}</strong><span>${esc(x.e[C.dir])}, ${esc(x.e[C.mun])}</span><span class="rank-m">a ${x.d.toFixed(1).replace('.', ',')} km · <a href="https://www.google.com/maps/dir/?api=1&destination=${x.e[C.lat]},${x.e[C.lon]}" target="_blank" rel="noopener">Cómo llegar</a></span></div><b class="rank-p">${euro(precioDe(x.e, i))}</b></li>`).join('')}</ol>`;

  // ================= INICIO =================
  {
    const pregs = h.faq([
      ['¿Cómo encuentro la gasolinera más barata cerca de mí?', `Pulsa «Cerca de mí» y permite el acceso a tu ubicación, o escribe una dirección, un municipio o un código postal. Verás las gasolineras de la zona ordenadas de más barata a más cara, con la distancia y el horario.`],
      ['¿De dónde salen los precios?', `De los datos oficiales que las gasolineras están obligadas a comunicar al Ministerio para la Transición Ecológica. Los actualizamos varias veces al día. Última actualización: ${f.texto}${f.hora ? ' a las ' + f.hora : ''}.`],
      ['¿Cuánto cuesta hoy la gasolina en España?', nac.g95 ? `El precio medio de la gasolina 95 es de ${euro(nac.g95.media)} €/l y el del diésel de ${euro(nac.diesel?.media)} €/l. La más barata de España está a ${euro(nac.g95.min)} €/l.` : ''],
      ['¿Compensa ir a una gasolinera más lejos?', `Depende de cuánto ahorres por litro y de los kilómetros extra. Con nuestra <a href="/calculadora-gasolina-viaje/#compensa">calculadora</a> lo sabes en segundos.`],
      ['¿Qué día de la semana es más barato repostar?', 'Los precios cambian a diario y varían mucho entre gasolineras. Suele ahorrarse más eligiendo bien la gasolinera que esperando a un día concreto: entre la más cara y la más barata de una misma ciudad puede haber más de 20 céntimos por litro.'],
    ].filter((x) => x[1]));

    const cuerpo = `
<section class="buscador" id="buscador">
  <h1>Gasolineras más baratas cerca de ti</h1>
  <p class="sub">Precios oficiales de ${hoy}. ${nEst} gasolineras en toda España.</p>
  <form class="bus" id="formBus" role="search" autocomplete="off">
    <div class="inputwrap">
      <label class="vh" for="q">Dirección, municipio o código postal</label>
      <input id="q" type="search" enterkeyhint="search" placeholder="Dirección, municipio o código postal" role="combobox" aria-expanded="false" aria-controls="sugg" aria-autocomplete="list">
      <ul class="sugg" id="sugg" role="listbox" hidden></ul>
    </div>
    <button type="button" class="gps" id="gps">${iconoGps}<span>Cerca de mí</span></button>
  </form>
  <p class="msg" id="msg" role="alert" hidden></p>
  <div class="filtros">
    <div class="chips" id="fuels" role="group" aria-label="Combustible">${COMBUSTIBLES.map((c, i) => `<button type="button" class="chip" data-f="${c.k}" aria-pressed="${i === 0}">${c.nombre}</button>`).join('')}</div>
    <div class="fila2">
      <label class="sel"><span>Radio</span>
        <select id="radio">${[0.5, 1, 3, 5, 10, 20, 50].map((r) => `<option value="${r}"${r === 3 ? ' selected' : ''}>${r < 1 ? r * 1000 + ' m' : r + ' km'}</option>`).join('')}</select>
      </label>
      <button type="button" class="toggle" id="fAbiertas" aria-pressed="false">Abiertas ahora</button>
      <button type="button" class="toggle" id="f24" aria-pressed="false">24 horas</button>
    </div>
  </div>
  <div id="resultado" aria-live="polite">
    <div class="vacio">
      <strong>¿Dónde quieres repostar?</strong>
      <span>Hoy en España la gasolina 95 cuesta de media <b>${euro(nac.g95?.media)} €/l</b> y el diésel <b>${euro(nac.diesel?.media)} €/l</b>. Busca tu zona para ver las más baratas.</span>
      <button type="button" class="gps grande" data-gps>${iconoGps}<span>Buscar cerca de mí</span></button>
    </div>
  </div>
  ${h.hueco('resultados')}
  <div id="favs" hidden></div>
  <div id="listaBloque" hidden>
    <div class="listhead">
      <h2 id="listaTitulo">Gasolineras</h2>
      <div class="seg" role="group" aria-label="Vista"><button type="button" id="vLista" aria-pressed="true">Lista</button><button type="button" id="vMapa" aria-pressed="false">Mapa</button></div>
    </div>
    <div class="seg peq" id="ordenBox" role="group" aria-label="Ordenar"><button type="button" id="oPrecio" aria-pressed="true">Más baratas</button><button type="button" id="oDist" aria-pressed="false">Más cercanas</button></div>
    <div id="mapa" class="mapa" hidden></div>
    <ol class="lista" id="lista"></ol>
    <button type="button" class="mas" id="mas" hidden>Ver más gasolineras</button>
  </div>
</section>

<section class="bloque">
  <div class="bloque-cab"><h2>Precio medio hoy en España</h2><a href="/precio-gasolina-hoy/">Ver evolución y provincias ›</a></div>
  ${h.medias(nac, { ayer: ayerNac, solo: ['g95', 'diesel', 'g98', 'glp'] })}
</section>

${ultimasNoticias}
${h.afiliado('seguro')}

<section class="bloque dos">
  <div><h2>Las 10 gasolineras con la gasolina 95 más barata de España</h2><p class="nota">Península y Baleares. Canarias, Ceuta y Melilla tienen impuestos distintos.</p>${h.ranking(peninsula, I95)}</div>
  <div><h2>Las 10 gasolineras con el diésel más barato de España</h2><p class="nota">Península y Baleares.</p>${h.ranking(peninsula, IDIE)}</div>
</section>

${h.hueco('articulo')}

<section class="bloque">
  <h2>Gasolineras más baratas por provincia</h2>
  <div class="tabla-scroll"><table class="tabla prov">
    <thead><tr><th scope="col">Provincia</th><th scope="col" class="num">Gasolina 95</th><th scope="col" class="num">Diésel</th><th scope="col" class="num">Gasolineras</th></tr></thead>
    <tbody>${datos.provincias.map((p) => `<tr><td><a href="${p.ruta}">${esc(p.nombre)}</a></td><td class="num">${euro(p.resumen.g95?.media)}</td><td class="num">${euro(p.resumen.diesel?.media)}</td><td class="num">${p.estaciones.length}</td></tr>`).join('')}</tbody>
  </table></div>
  <p class="nota">Precio medio en €/litro.</p>
</section>

<section class="bloque cta-calc">
  <div><h2>¿Cuánto te cuesta el viaje?</h2><p>Calcula el gasto de gasolina de cualquier trayecto y cuánto toca pagar a cada uno.</p></div>
  <a class="btn" href="/calculadora-gasolina-viaje/">Abrir calculadora</a>
</section>

${pregs.html}`;

    add('/', h.pagina({
      ruta: '/',
      titulo: h.titulo(`Gasolineras más baratas cerca de ti: precios de hoy | ${cfg.nombre}`, `Gasolineras más baratas cerca de ti, hoy | ${cfg.nombre}`, `Gasolineras más baratas cerca de ti | ${cfg.nombre}`),
      descripcion: h.descripcion(`Encuentra la gasolinera más barata cerca de ti con los precios oficiales de hoy.`, `Gasolina 95 desde ${euro(nac.g95?.min)} €/l y diésel desde ${euro(nac.diesel?.min)} €/l.`),
      cuerpo,
      buscador: true,
      clase: 'inicio',
      schemas: [
        {
          '@context': 'https://schema.org', '@type': 'Organization', '@id': h.abs('/#organizacion'), name: cfg.nombre, url: h.abs('/'),
          logo: { '@type': 'ImageObject', url: h.abs('/icono-512.png'), width: 512, height: 512 },
          ...(cfg.emailContacto && !/tudominio/.test(cfg.emailContacto) ? { email: cfg.emailContacto } : {}),
          ...(cfg.redesSociales?.filter(Boolean).length ? { sameAs: cfg.redesSociales.filter(Boolean) } : {}),
        },
        { '@context': 'https://schema.org', '@type': 'WebSite', '@id': h.abs('/#web'), name: cfg.nombre, url: h.abs('/'), inLanguage: cfg.idioma || 'es-ES', publisher: { '@id': h.abs('/#organizacion') } },
        pregs.schema,
      ],
    }));
  }

  // ================= PRECIO HOY =================
  {
    const s95 = serie(historico, (d) => d.n.g95);
    const sDie = serie(historico, (d) => d.n.diesel);
    const graf = graficoLineas([{ nombre: 'Gasolina 95', datos: s95 }, { nombre: 'Diésel', datos: sDie }]);
    const provOrden = [...datos.provincias].filter((p) => p.resumen.g95).sort((a, b) => a.resumen.g95.media - b.resumen.g95.media);
    const barataProv = provOrden[0], caraProv = provOrden[provOrden.length - 1];
    const marcasOrden = [...datos.marcas].filter((m) => m.resumen.g95 && m.resumen.g95.n >= 10).sort((a, b) => a.resumen.g95.media - b.resumen.g95.media);
    const var95 = ayerNac?.g95 != null && nac.g95 ? nac.g95.media - ayerNac.g95 : null;
    const frase = var95 == null ? '' : Math.abs(var95) < 0.0005 ? 'Se mantiene igual que ayer.' : var95 > 0 ? `Sube ${Math.abs(var95 * 100).toFixed(1).replace('.', ',')} céntimos respecto a ayer.` : `Baja ${Math.abs(var95 * 100).toFixed(1).replace('.', ',')} céntimos respecto a ayer.`;
    const m = h.migas([['/precio-gasolina-hoy/', 'Precio de la gasolina hoy']]);
    const pregs = h.faq([
      ['¿Cuál es el precio de la gasolina hoy?', `Hoy, ${f.texto}, el precio medio de la gasolina 95 en España es de ${euro(nac.g95?.media)} €/l. ${frase}`],
      ['¿Cuál es el precio del diésel hoy?', nac.diesel ? `El diésel cuesta de media ${euro(nac.diesel.media)} €/l. La gasolinera más barata lo vende a ${euro(nac.diesel.min)} €/l.` : ''],
      barataProv && ['¿Dónde está la gasolina más barata de España?', `Por provincias, la gasolina 95 más barata está en ${esc(barataProv.nombre)} (media de ${euro(barataProv.resumen.g95.media)} €/l) y la más cara en ${esc(caraProv.nombre)} (${euro(caraProv.resumen.g95.media)} €/l). Canarias, Ceuta y Melilla tienen impuestos más bajos.`],
      ['¿Cada cuánto se actualizan los precios?', 'Varias veces al día, con los datos que las gasolineras comunican al Ministerio para la Transición Ecológica.'],
    ].filter(Boolean).filter((x) => x[1]));

    const cuerpo = `
${m.html}
<header class="cabecera">
  <h1>Precio de la gasolina y el diésel hoy, ${f.texto}</h1>
  <p class="sub">La gasolina 95 cuesta hoy de media <b>${euro(nac.g95?.media)} €/l</b> en España y el diésel <b>${euro(nac.diesel?.media)} €/l</b>. ${frase} Datos oficiales actualizados${f.hora ? ' a las ' + f.hora : ''}.</p>
</header>
${h.medias(nac, { ayer: ayerNac })}
${h.hueco('superior')}
${graf ? `<section class="bloque"><h2>Evolución del precio en los últimos ${Math.min(30, s95.length)} días</h2>${graf}</section>` : ''}
<section class="bloque dos">
  <div><h2>Gasolina 95 más barata de España hoy</h2><p class="nota">Península y Baleares.</p>${h.ranking(peninsula, I95)}</div>
  <div><h2>Diésel más barato de España hoy</h2><p class="nota">Península y Baleares.</p>${h.ranking(peninsula, IDIE)}</div>
</section>
${canarias.length ? `<section class="bloque dos">
  <div><h2>Gasolina 95 más barata de Canarias hoy</h2>${h.ranking(canarias, I95, { n: 5 })}</div>
  <div><h2>Diésel más barato de Canarias hoy</h2>${h.ranking(canarias, IDIE, { n: 5 })}</div>
</section>` : ''}
${h.afiliado('tarjeta')}
<section class="bloque">
  <h2>Precio de la gasolina por provincia, de más barata a más cara</h2>
  <div class="tabla-scroll"><table class="tabla prov">
    <thead><tr><th scope="col">Provincia</th><th scope="col" class="num">Gasolina 95</th><th scope="col" class="num">Diésel</th><th scope="col" class="num">95 más barata</th></tr></thead>
    <tbody>${provOrden.map((p) => `<tr><td><a href="${p.ruta}">${esc(p.nombre)}</a></td><td class="num">${euro(p.resumen.g95?.media)}</td><td class="num">${euro(p.resumen.diesel?.media)}</td><td class="num">${euro(p.resumen.g95?.min)}</td></tr>`).join('')}</tbody>
  </table></div>
</section>
${h.hueco('articulo')}
${marcasOrden.length ? `<section class="bloque">
  <h2>Precio medio de la gasolina 95 por marca</h2>
  <div class="tabla-scroll"><table class="tabla">
    <thead><tr><th scope="col">Marca</th><th scope="col" class="num">Gasolina 95</th><th scope="col" class="num">Diésel</th><th scope="col" class="num">Gasolineras</th></tr></thead>
    <tbody>${marcasOrden.map((mk) => `<tr><td><a href="${mk.ruta}">${esc(mk.nombre)}</a></td><td class="num">${euro(mk.resumen.g95?.media)}</td><td class="num">${euro(mk.resumen.diesel?.media)}</td><td class="num">${mk.estaciones.length}</td></tr>`).join('')}</tbody>
  </table></div>
</section>` : ''}
${ultimasNoticias}
${pregs.html}`;
    add('/precio-gasolina-hoy/', h.pagina({
      ruta: '/precio-gasolina-hoy/',
      titulo: h.titulo(...h.conMarca(`Precio de la gasolina hoy, ${f.corto}: ${euro(nac.g95?.media)} €/l`, `Precio de la gasolina hoy: ${euro(nac.g95?.media)} €/l`)),
      descripcion: h.descripcion(`Precio de la gasolina y el diésel hoy, ${f.corto}: gasolina 95 a ${euro(nac.g95?.media)} €/l y diésel a ${euro(nac.diesel?.media)} €/l de media.`, 'Las más baratas de España y por provincia.', 'Evolución diaria.'),
      cuerpo,
      schemas: [m.schema, pregs.schema],
    }));
  }

  // ================= ÍNDICE DE PROVINCIAS =================
  {
    const m = h.migas([['/gasolineras/', 'Gasolineras por provincia']]);
    const cuerpo = `${m.html}
<header class="cabecera"><h1>Gasolineras más baratas por provincia</h1><p class="sub">Elige tu provincia para ver las gasolineras más baratas de cada municipio, con precios de ${hoy}.</p></header>
<div class="rejilla-prov">${datos.provincias.map((p) => `<a class="tprov" href="${p.ruta}"><strong>${esc(p.nombre)}</strong><span>95: ${euro(p.resumen.g95?.media)} · Diésel: ${euro(p.resumen.diesel?.media)}</span><small>${p.estaciones.length} gasolineras</small></a>`).join('')}</div>
${h.hueco('articulo')}`;
    add('/gasolineras/', h.pagina({ ruta: '/gasolineras/', titulo: h.titulo(...h.conMarca('Gasolineras más baratas por provincia hoy')), descripcion: h.descripcion(`Precio medio de la gasolina y el diésel en cada provincia de España hoy, ${f.corto}, y las gasolineras más baratas de cada municipio.`), cuerpo, schemas: [m.schema] }));
  }

  // ================= PROVINCIAS =================
  for (const p of datos.provincias) {
    const r = p.resumen;
    const ayerP = anterior(historico, f.iso, (d) => d.p[p.id]);
    const graf = graficoLineas([
      { nombre: 'Gasolina 95', datos: serie(historico, (d) => d.p[p.id]?.g95) },
      { nombre: 'Diésel', datos: serie(historico, (d) => d.p[p.id]?.diesel) },
    ]);
    const muns = [...p.municipios.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const munBarato = muns.filter((x) => x.resumen.g95 && x.estaciones.length >= 2).sort((a, b) => a.resumen.g95.media - b.resumen.g95.media)[0];
    const porMarca = new Map();
    for (const e of p.estaciones) {
      if (!precioDe(e, I95)) continue;
      const g = porMarca.get(e[C.marca]) || { n: 0, s: 0 };
      g.n++; g.s += precioDe(e, I95);
      porMarca.set(e[C.marca], g);
    }
    const marcasP = [...porMarca.entries()].filter(([, g]) => g.n >= 3).map(([k, g]) => [k, g.s / g.n, g.n]).sort((a, b) => a[1] - b[1]).slice(0, 12);
    const b95 = r.g95?.barata, bDie = r.diesel?.barata;
    const m = h.migas([['/gasolineras/', 'Provincias'], [p.ruta, p.nombre]]);
    const pregs = h.faq([
      b95 && [`¿Cuál es la gasolinera más barata de ${p.nombre}?`, `Hoy, la gasolina 95 más barata de ${esc(p.nombre)} está en ${esc(b95[C.marca])} (${esc(b95[C.dir])}, ${esc(b95[C.mun])}) a ${euro(r.g95.min)} €/l.${bDie ? ` El diésel más barato, en ${esc(bDie[C.marca])} (${esc(bDie[C.mun])}) a ${euro(r.diesel.min)} €/l.` : ''}`],
      r.g95 && [`¿Cuánto cuesta la gasolina en ${p.nombre}?`, `El precio medio de la gasolina 95 en ${esc(p.nombre)} es de ${euro(r.g95.media)} €/l${nac.g95 ? `, frente a ${euro(nac.g95.media)} €/l de media en España` : ''}.${r.diesel ? ` El diésel está a ${euro(r.diesel.media)} €/l de media.` : ''}`],
      munBarato && [`¿En qué municipio de ${p.nombre} es más barata la gasolina?`, `Entre los municipios con al menos dos gasolineras, el más barato hoy es <a href="${munBarato.ruta}">${esc(munBarato.nombre)}</a>, con una media de ${euro(munBarato.resumen.g95.media)} €/l para la gasolina 95.`],
      [`¿Cuántas gasolineras hay en ${p.nombre}?`, `Hay ${p.estaciones.length} gasolineras abiertas al público con precios comunicados, repartidas en ${p.municipios.size} municipios.`],
    ].filter(Boolean));

    const cuerpo = `${m.html}
<header class="cabecera">
  <h1>Gasolineras más baratas en ${esc(p.nombre)} hoy</h1>
  <p class="sub">Precios de ${hoy} en las ${p.estaciones.length} gasolineras de ${esc(p.nombre)}.${r.g95 ? ` La gasolina 95 cuesta de media ${euro(r.g95.media)} €/l y la más barata está a ${euro(r.g95.min)} €/l.` : ''}</p>
  <a class="btn sec" href="${h.enlaceBuscador((p.bbox[0] + p.bbox[2]) / 2, (p.bbox[1] + p.bbox[3]) / 2, p.nombre)}">Buscar cerca de mí en el mapa</a>
  <div class="enlaces" style="margin-top:10px"><a href="/gasolineras-24-horas/${p.slug}/">24 horas</a><a href="/gasolineras-low-cost/${p.slug}/">Low cost</a><a href="/carreteras/">Carreteras</a></div>
</header>
${h.medias(r, ayerP ? { ayer: ayerP } : { comparar: nac })}
${h.hueco('superior')}
<section class="bloque dos">
  <div><h2>Gasolina 95 más barata en ${esc(p.nombre)}</h2>${h.ranking(p.estaciones, I95)}</div>
  <div><h2>Diésel más barato en ${esc(p.nombre)}</h2>${h.ranking(p.estaciones, IDIE)}</div>
</section>
${h.afiliado('seguro')}
<section class="bloque">
  <h2>Gasolineras de ${esc(p.nombre)} por municipio</h2>
  <div class="tabla-scroll"><table class="tabla prov">
    <thead><tr><th scope="col">Municipio</th><th scope="col" class="num">Gasolina 95</th><th scope="col" class="num">Diésel</th><th scope="col" class="num">Gasolineras</th></tr></thead>
    <tbody>${muns.map((x) => `<tr><td><a href="${x.ruta}">${esc(x.nombre)}</a></td><td class="num">${euro(x.resumen.g95?.min)}</td><td class="num">${euro(x.resumen.diesel?.min)}</td><td class="num">${x.estaciones.length}</td></tr>`).join('')}</tbody>
  </table></div>
  <p class="nota">Precio más barato de cada municipio, en €/litro.</p>
</section>
${h.hueco('articulo')}
${graf ? `<section class="bloque"><h2>Evolución del precio medio en ${esc(p.nombre)}</h2>${graf}</section>` : ''}
${marcasP.length > 1 ? `<section class="bloque"><h2>Marcas más baratas en ${esc(p.nombre)}</h2>
  <div class="tabla-scroll"><table class="tabla"><thead><tr><th scope="col">Marca</th><th scope="col" class="num">Media gasolina 95</th><th scope="col" class="num">Gasolineras</th></tr></thead>
  <tbody>${marcasP.map(([k, v, n]) => `<tr><td>${esc(k)}</td><td class="num">${euro(v)}</td><td class="num">${n}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
${pregs.html}`;
    add(p.ruta, h.pagina({
      ruta: p.ruta,
      titulo: h.titulo(...h.conMarca(`Gasolineras más baratas en ${p.nombre} hoy`, `Gasolineras baratas en ${p.nombre} hoy`)),
      descripcion: h.descripcion(`Gasolineras más baratas de ${p.nombre} hoy, ${f.corto}${desde(r) ? `: ${desde(r)}` : ''}.`, `Precios de las ${p.estaciones.length} gasolineras por municipio.`),
      cuerpo,
      schemas: [m.schema, pregs.schema, h.schemaGasolineras([...p.estaciones].sort((a, b) => (precioDe(a, I95) || 9) - (precioDe(b, I95) || 9)), `Gasolineras más baratas en ${p.nombre}`)],
    }), 'provincias');

    // ================= MUNICIPIOS =================
    for (const mu of p.municipios.values()) {
      const rm = mu.resumen;
      const b95m = rm.g95?.barata, bDiem = rm.diesel?.barata;
      const idsPropios = new Set(mu.estaciones.map((e) => e[C.id]));
      const alrededor = cercanas(mu.lat, mu.lon, 15).filter((x) => !idsPropios.has(x.e[C.id]));
      const mejoresFuera = (i) => alrededor.filter((x) => precioDe(x.e, i) && (!rm[COMBUSTIBLES[i].k] || precioDe(x.e, i) < rm[COMBUSTIBLES[i].k].min)).sort((a, b) => precioDe(a.e, i) - precioDe(b.e, i)).slice(0, 5);
      const fuera95 = mejoresFuera(I95), fueraDie = mejoresFuera(IDIE);
      const vecinos = todosMunicipios.filter((x) => x !== mu).map((x) => ({ x, d: distancia(mu.lat, mu.lon, x.lat, x.lon) })).sort((a, b) => a.d - b.d).slice(0, 12);
      const n24 = mu.estaciones.filter((e) => es24h(e[C.horario])).length;
      const m = h.migas([['/gasolineras/', 'Provincias'], [p.ruta, p.nombre], [mu.ruta, mu.nombre]]);

      const pregs = h.faq([
        b95m && [`¿Cuál es la gasolinera más barata de ${mu.nombre}?`, `Hoy, la gasolina 95 más barata de ${esc(mu.nombre)} está en ${esc(b95m[C.marca])}, ${esc(b95m[C.dir])}, a ${euro(rm.g95.min)} €/l.${bDiem ? ` El diésel más barato está en ${esc(bDiem[C.marca])}, ${esc(bDiem[C.dir])}, a ${euro(rm.diesel.min)} €/l.` : ''}`],
        [`¿Cuántas gasolineras hay en ${mu.nombre}?`, `${mu.estaciones.length === 1 ? 'Hay 1 gasolinera' : `Hay ${mu.estaciones.length} gasolineras`} en ${esc(mu.nombre)} (${esc(p.nombre)}).${fuera95.length ? ` En un radio de 15 km hay ${fuera95.length === 5 ? 'varias' : fuera95.length} con la gasolina 95 más barata que en el propio municipio.` : ''}`],
        [`¿Hay gasolineras 24 horas en ${mu.nombre}?`, n24 ? `Sí, ${n24 === 1 ? 'hay 1 gasolinera abierta' : `hay ${n24} gasolineras abiertas`} las 24 horas en ${esc(mu.nombre)}.` : `Según los horarios comunicados al Ministerio, en ${esc(mu.nombre)} no hay gasolineras abiertas las 24 horas. Usa el <a href="${h.enlaceBuscador(mu.lat, mu.lon, mu.nombre)}">buscador</a> con el filtro «24 horas» para encontrar la más cercana.`],
        rm.g95 && p.resumen.g95 && [`¿Es cara la gasolina en ${mu.nombre}?`, `La gasolina 95 cuesta de media ${euro(rm.g95.media)} €/l en ${esc(mu.nombre)}, frente a ${euro(p.resumen.g95.media)} €/l en el conjunto de ${esc(p.nombre)}.`],
      ].filter(Boolean));

      const cuerpo = `${m.html}
<header class="cabecera">
  <h1>Gasolineras baratas en ${esc(mu.nombre)} hoy</h1>
  <p class="sub">Precios de ${hoy} en ${mu.estaciones.length === 1 ? 'la gasolinera' : `las ${mu.estaciones.length} gasolineras`} de ${esc(mu.nombre)} (${esc(p.nombre)}).</p>
</header>
<div class="destacadas">
  ${b95m ? `<div class="totem mini"><span class="t-f">Gasolina 95 más barata</span><b class="t-p">${euro(rm.g95.min)}<small>€/l</small></b><strong>${esc(b95m[C.marca])}</strong><span>${esc(b95m[C.dir])}</span></div>` : ''}
  ${bDiem ? `<div class="totem mini"><span class="t-f">Diésel más barato</span><b class="t-p">${euro(rm.diesel.min)}<small>€/l</small></b><strong>${esc(bDiem[C.marca])}</strong><span>${esc(bDiem[C.dir])}</span></div>` : ''}
</div>
${h.medias(rm, { comparar: p.resumen, fraseComparar: `la media de ${p.nombre}`, solo: ['g95', 'diesel', 'g98', 'glp'] })}
<p><a class="btn sec" href="${h.enlaceBuscador(mu.lat, mu.lon, mu.nombre)}">Ver en el mapa y buscar cerca de mí</a></p>
${h.hueco('superior')}
<section class="bloque">
  <h2>Precios de todas las gasolineras de ${esc(mu.nombre)}</h2>
  ${h.tablaEstaciones(mu.estaciones)}
  <p class="nota">Precios en €/litro. En verde, el más barato de cada combustible.</p>
</section>
${h.afiliado('seguro')}
${fuera95.length || fueraDie.length ? `<section class="bloque dos">
  ${fuera95.length ? `<div><h2>Gasolina 95 más barata cerca de ${esc(mu.nombre)}</h2><p class="nota">A menos de 15 km y más barata que en ${esc(mu.nombre)}.</p>${listaFuera(fuera95, I95)}</div>` : ''}
  ${fueraDie.length ? `<div><h2>Diésel más barato cerca de ${esc(mu.nombre)}</h2><p class="nota">A menos de 15 km y más barato que en ${esc(mu.nombre)}.</p>${listaFuera(fueraDie, IDIE)}</div>` : ''}
</section>` : ''}
${h.hueco('articulo')}
<section class="bloque">
  <h2>Gasolineras en municipios cercanos</h2>
  <div class="enlaces">${vecinos.map(({ x, d }) => `<a href="${x.ruta}">${esc(x.nombre)} <small>${d.toFixed(0)} km</small></a>`).join('')}</div>
</section>
${pregs.html}`;

      add(mu.ruta, h.pagina({
        ruta: mu.ruta,
        titulo: h.titulo(...h.conMarca(`Gasolineras baratas en ${mu.nombre} hoy: precios`, `Gasolineras baratas en ${mu.nombre} hoy`, `Gasolineras en ${mu.nombre} hoy`)),
        descripcion: h.descripcion(`Gasolineras más baratas en ${mu.nombre} (${p.nombre}) hoy, ${f.corto}${desde(rm) ? `: ${desde(rm)}` : ''}.`, 'Precios, horarios y cómo llegar.'),
        cuerpo,
        schemas: [m.schema, pregs.schema, h.schemaGasolineras([...mu.estaciones].sort((a, b) => (precioDe(a, I95) || 9) - (precioDe(b, I95) || 9)), `Gasolineras en ${mu.nombre}`)],
      }), 'municipios');
    }

    // ===== MUNICIPIOS SIN PRECIOS HOY =====
    // Tuvieron página otros días. Se mantiene (sin error 404) con las más baratas de alrededor.
    for (const mu of p.ausentes) {
      let radio = 15, alrededor = cercanas(mu.lat, mu.lon, radio);
      if (alrededor.length < 3) alrededor = cercanas(mu.lat, mu.lon, (radio = 30));
      const top = (i) => alrededor.filter((x) => precioDe(x.e, i)).sort((a, b) => precioDe(a.e, i) - precioDe(b.e, i)).slice(0, 8);
      const t95 = top(I95), tDie = top(IDIE);
      const vecinos = todosMunicipios.map((x) => ({ x, d: distancia(mu.lat, mu.lon, x.lat, x.lon) })).sort((a, b) => a.d - b.d).slice(0, 12);
      const m = h.migas([['/gasolineras/', 'Provincias'], [p.ruta, p.nombre], [mu.ruta, mu.nombre]]);
      const cuerpo = `${m.html}
<header class="cabecera">
  <h1>Gasolineras baratas cerca de ${esc(mu.nombre)} hoy</h1>
  <p class="sub">Hoy, ${f.texto}, las gasolineras de ${esc(mu.nombre)} (${esc(p.nombre)}) no han comunicado precios al Ministerio. Estas son las más baratas a menos de ${radio} km.</p>
</header>
<p><a class="btn sec" href="${h.enlaceBuscador(mu.lat, mu.lon, mu.nombre)}">Ver en el mapa y buscar cerca de mí</a></p>
${h.hueco('superior')}
${t95.length || tDie.length ? `<section class="bloque dos">
  ${t95.length ? `<div><h2>Gasolina 95 más barata cerca de ${esc(mu.nombre)}</h2>${listaFuera(t95, I95)}</div>` : ''}
  ${tDie.length ? `<div><h2>Diésel más barato cerca de ${esc(mu.nombre)}</h2>${listaFuera(tDie, IDIE)}</div>` : ''}
</section>` : `<p class="nota">No hay gasolineras con precios a menos de ${radio} km. Prueba el <a href="${h.enlaceBuscador(mu.lat, mu.lon, mu.nombre)}">buscador</a> con un radio mayor.</p>`}
${h.afiliado('seguro')}
${h.hueco('articulo')}
<section class="bloque">
  <h2>Gasolineras en municipios cercanos</h2>
  <div class="enlaces">${vecinos.map(({ x, d }) => `<a href="${x.ruta}">${esc(x.nombre)} <small>${d.toFixed(0)} km</small></a>`).join('')}</div>
</section>`;
      add(mu.ruta, h.pagina({
        ruta: mu.ruta,
        titulo: h.titulo(...h.conMarca(`Gasolineras baratas cerca de ${mu.nombre} hoy`, `Gasolineras cerca de ${mu.nombre} hoy`)),
        descripcion: h.descripcion(`Gasolineras más baratas cerca de ${mu.nombre} (${p.nombre}) hoy, ${f.corto}, a menos de ${radio} km.`, 'Precios, horarios y cómo llegar.'),
        cuerpo,
        schemas: [m.schema],
      }), 'municipios');
    }
  }

  // ================= MARCAS =================
  {
    const m = h.migas([['/marcas/', 'Precios por marca']]);
    const orden = [...datos.marcas].sort((a, b) => (a.resumen.g95?.media || 9) - (b.resumen.g95?.media || 9));
    const cuerpo = `${m.html}
<header class="cabecera"><h1>Precio de la gasolina por marca hoy</h1><p class="sub">Compara el precio medio de cada marca de gasolineras en España, ${hoy}.</p></header>
<div class="tabla-scroll"><table class="tabla">
  <thead><tr><th scope="col">Marca</th><th scope="col" class="num">Gasolina 95</th><th scope="col" class="num">Diésel</th><th scope="col" class="num">Gasolineras</th></tr></thead>
  <tbody>${orden.map((mk) => `<tr><td><a href="${mk.ruta}">${esc(mk.nombre)}</a></td><td class="num">${euro(mk.resumen.g95?.media)}</td><td class="num">${euro(mk.resumen.diesel?.media)}</td><td class="num">${mk.estaciones.length}</td></tr>`).join('')}</tbody>
</table></div>
${h.hueco('articulo')}`;
    add('/marcas/', h.pagina({ ruta: '/marcas/', titulo: h.titulo(...h.conMarca('Precio de la gasolina por marca hoy')), descripcion: h.descripcion(`¿Qué marca de gasolinera es más barata? Precio medio de la gasolina 95 y el diésel por marca hoy, ${f.corto}.`, 'Repsol, Cepsa, BP, Shell, Ballenoil y más.'), cuerpo, schemas: [m.schema] }), 'marcas');

    for (const mk of datos.marcas) {
      const r = mk.resumen;
      const provs = new Map();
      for (const e of mk.estaciones) {
        const g = provs.get(e[C.prov]) || { n: 0, s95: 0, n95: 0, sd: 0, nd: 0 };
        g.n++;
        if (precioDe(e, I95)) { g.s95 += precioDe(e, I95); g.n95++; }
        if (precioDe(e, IDIE)) { g.sd += precioDe(e, IDIE); g.nd++; }
        provs.set(e[C.prov], g);
      }
      const filas = [...provs.entries()].map(([id, g]) => ({ p: datos.provMap.get(id), ...g })).filter((x) => x.p).sort((a, b) => a.p.nombre.localeCompare(b.p.nombre, 'es'));
      const mm = h.migas([['/marcas/', 'Marcas'], [mk.ruta, mk.nombre]]);
      const pregs = h.faq([
        r.g95 && [`¿Cuánto cuesta hoy la gasolina en ${mk.nombre}?`, `El precio medio de la gasolina 95 en las gasolineras ${esc(mk.nombre)} es de ${euro(r.g95.media)} €/l${nac.g95 ? `, frente a ${euro(nac.g95.media)} €/l de media en España` : ''}.`],
        r.g95 && [`¿Cuál es la gasolinera ${mk.nombre} más barata?`, `Hoy es la de ${esc(r.g95.barata[C.dir])}, en ${esc(r.g95.barata[C.mun])}, con la gasolina 95 a ${euro(r.g95.min)} €/l.`],
        [`¿Cuántas gasolineras ${mk.nombre} hay en España?`, `Hay ${mk.estaciones.length} gasolineras ${esc(mk.nombre)} con precios comunicados al Ministerio en ${filas.length} provincias.`],
      ].filter(Boolean));
      const cuerpo = `${mm.html}
<header class="cabecera"><h1>Precio de la gasolina en ${esc(nombreSEO(mk))} hoy</h1><p class="sub">Precios de ${hoy} en las ${mk.estaciones.length} gasolineras ${esc(mk.nombre)} de España.</p></header>
${h.medias(r, { comparar: nac })}
${h.hueco('superior')}
<section class="bloque dos">
  <div><h2>${esc(mk.nombre)} con la gasolina 95 más barata</h2>${h.ranking(mk.estaciones, I95)}</div>
  <div><h2>${esc(mk.nombre)} con el diésel más barato</h2>${h.ranking(mk.estaciones, IDIE)}</div>
</section>
${h.afiliado('tarjeta')}
<section class="bloque"><h2>Gasolineras ${esc(mk.nombre)} por provincia</h2>
<div class="tabla-scroll"><table class="tabla prov"><thead><tr><th scope="col">Provincia</th><th scope="col" class="num">Gasolina 95</th><th scope="col" class="num">Diésel</th><th scope="col" class="num">Gasolineras</th></tr></thead>
<tbody>${filas.map((x) => `<tr><td><a href="${x.n >= MIN_MP ? `${mk.ruta}${x.p.slug}/` : x.p.ruta}">${esc(x.p.nombre)}</a></td><td class="num">${x.n95 ? euro(x.s95 / x.n95) : '—'}</td><td class="num">${x.nd ? euro(x.sd / x.nd) : '—'}</td><td class="num">${x.n}</td></tr>`).join('')}</tbody></table></div></section>
${h.hueco('articulo')}
${pregs.html}`;
      add(mk.ruta, h.pagina({
        ruta: mk.ruta,
        titulo: h.titulo(...h.conMarca(r.g95 ? `Precio gasolina ${nombreSEO(mk)} hoy: ${euro(r.g95.media)} €/l` : `Precio gasolina ${nombreSEO(mk)} hoy`, `Precio gasolina ${mk.nombre} hoy`)),
        descripcion: h.descripcion(`Precio de la gasolina y el diésel en ${mk.nombre} hoy, ${f.corto}${r.g95 ? `: gasolina 95 a ${euro(r.g95.media)} €/l de media` : ''}.`, `Las ${mk.nombre} más baratas de España y por provincia.`),
        cuerpo,
        schemas: [mm.schema, pregs.schema],
      }), 'marcas');
    }

    // ===== MARCA × PROVINCIA ("Plenoil Valencia precio hoy") =====
    for (const mk of datos.marcas) {
      const porProv = new Map();
      for (const e of mk.estaciones) {
        if (!porProv.has(e[C.prov])) porProv.set(e[C.prov], []);
        porProv.get(e[C.prov]).push(e);
      }
      for (const [provId, est] of porProv) {
        const p = datos.provMap.get(provId);
        if (!p || est.length < MIN_MP) continue;
        const ruta = `${mk.ruta}${p.slug}/`;
        const r = resumen(est);
        const rp = p.resumen;
        const munis = new Map();
        for (const e of est) munis.set(e[C.mun], (munis.get(e[C.mun]) || 0) + 1);
        const listaMun = [...munis.entries()].sort((a, b) => b[1] - a[1]);
        const munRuta = new Map([...p.municipios.values()].map((m) => [m.nombre, m.ruta]));
        const otras = datos.marcas.filter((o) => o !== mk && o.estaciones.some((e) => e[C.prov] === provId && precioDe(e, I95)))
          .map((o) => { const ee = o.estaciones.filter((e) => e[C.prov] === provId); return { o, n: ee.length, r: resumen(ee) }; })
          .filter((x) => x.n >= MIN_MP && x.r.g95).sort((a, b) => a.r.g95.media - b.r.g95.media).slice(0, 8);
        const dif = r.g95 && rp.g95 ? r.g95.media - rp.g95.media : null;
        const mm = h.migas([['/marcas/', 'Marcas'], [mk.ruta, mk.nombre], [ruta, p.nombre]]);
        const pregs = h.faq([
          r.g95 && [`¿Cuánto cuesta hoy la gasolina en ${mk.nombre} ${p.nombre}?`, `La gasolina 95 en las gasolineras ${esc(mk.nombre)} de ${esc(p.nombre)} cuesta de media ${euro(r.g95.media)} €/l hoy${dif != null ? `, ${Math.abs(dif) < 0.005 ? 'igual que' : dif < 0 ? `${euro(-dif)} €/l menos que` : `${euro(dif)} €/l más que`} la media de la provincia (${euro(rp.g95.media)} €/l)` : ''}.`],
          r.diesel && [`¿Cuánto cuesta el diésel en ${mk.nombre} ${p.nombre}?`, `El diésel está a ${euro(r.diesel.media)} €/l de media; el más barato, a ${euro(r.diesel.min)} €/l en ${esc(r.diesel.barata[C.dir])} (${esc(r.diesel.barata[C.mun])}).`],
          r.g95 && [`¿Cuál es la ${mk.nombre} más barata de ${p.nombre}?`, `Hoy es la de ${esc(r.g95.barata[C.dir])}, en ${esc(r.g95.barata[C.mun])}, con la gasolina 95 a ${euro(r.g95.min)} €/l.`],
          [`¿Cuántas gasolineras ${mk.nombre} hay en ${p.nombre}?`, `Hay ${est.length} gasolineras ${esc(mk.nombre)} con precios en ${listaMun.length === 1 ? '1 municipio' : `${listaMun.length} municipios`} de ${esc(p.nombre)}.`],
        ].filter(Boolean));
        const cuerpo = `${mm.html}
<header class="cabecera"><h1>Precio gasolina ${esc(nombreSEO(mk))} en ${esc(p.nombre)} hoy</h1><p class="sub">Precios de ${hoy} en las ${est.length} gasolineras ${esc(mk.nombre)} de ${esc(p.nombre)}, comparados con la media de la provincia.</p></header>
${h.medias(r, { comparar: rp, fraseComparar: `la media de ${p.nombre}` })}
${h.hueco('superior')}
<section class="bloque dos">
  <div><h2>${esc(mk.nombre)} con la gasolina 95 más barata en ${esc(p.nombre)}</h2>${h.ranking(est, I95)}</div>
  <div><h2>${esc(mk.nombre)} con el diésel más barato en ${esc(p.nombre)}</h2>${h.ranking(est, IDIE)}</div>
</section>
${h.afiliado('tarjeta')}
<section class="bloque"><h2>Municipios con gasolineras ${esc(mk.nombre)} en ${esc(p.nombre)}</h2>
<div class="enlaces">${listaMun.map(([n, c]) => munRuta.get(n) ? `<a href="${munRuta.get(n)}">${esc(n)} <small>${c}</small></a>` : `<span>${esc(n)} (${c})</span>`).join('')}</div></section>
${otras.length ? `<section class="bloque"><h2>Otras marcas en ${esc(p.nombre)}</h2>
<div class="tabla-scroll"><table class="tabla prov"><thead><tr><th scope="col">Marca</th><th scope="col" class="num">Gasolina 95</th><th scope="col" class="num">Diésel</th><th scope="col" class="num">Gasolineras</th></tr></thead>
<tbody>${otras.map((x) => `<tr><td><a href="${x.o.ruta}${p.slug}/">${esc(x.o.nombre)}</a></td><td class="num">${euro(x.r.g95?.media)}</td><td class="num">${euro(x.r.diesel?.media)}</td><td class="num">${x.n}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
<p class="nota"><a href="${p.ruta}">Todas las gasolineras de ${esc(p.nombre)}</a> · <a href="${mk.ruta}">${esc(mk.nombre)} en toda España</a></p>
${h.hueco('articulo')}
${pregs.html}`;
        add(ruta, h.pagina({
          ruta,
          titulo: h.titulo(...h.conMarca(r.g95 ? `${nombreSEO(mk)} ${p.nombre}: gasolina a ${euro(r.g95.media)} €/l hoy` : `Precio ${nombreSEO(mk)} en ${p.nombre} hoy`, `${mk.nombre} ${p.nombre} precio hoy`)),
          descripcion: h.descripcion(`Precio de la gasolina y el diésel en las ${est.length} gasolineras ${mk.nombre} de ${p.nombre} hoy, ${f.corto}${r.g95 ? `: 95 desde ${euro(r.g95.min)} €/l` : ''}.`, `La ${mk.nombre} más barata de ${p.nombre} y comparación con otras marcas.`),
          cuerpo,
          schemas: [mm.schema, pregs.schema],
        }), 'marcas');
      }
    }

    // Marcas publicadas otros días que hoy no tienen ninguna gasolinera con precios:
    // la dirección sigue funcionando, pero no se indexa mientras esté vacía.
    for (const mk of datos.marcasAusentes) {
      const mm = h.migas([['/marcas/', 'Marcas'], [mk.ruta, mk.nombre]]);
      add(mk.ruta, h.pagina({
        ruta: mk.ruta,
        titulo: `Precio gasolina ${mk.nombre} hoy | ${cfg.nombre}`,
        descripcion: `Hoy no hay precios de gasolineras ${mk.nombre}.`,
        noindex: true,
        cuerpo: `${mm.html}<article class="texto"><h1>Precio de la gasolina en ${esc(mk.nombre)} hoy</h1><p>Hoy, ${f.texto}, ninguna gasolinera ${esc(mk.nombre)} ha comunicado precios al Ministerio.</p><p><a class="btn" href="/marcas/">Ver precios de otras marcas</a> <a class="btn sec" href="/">Buscar la gasolinera más barata cerca de mí</a></p></article>`,
      }), 'marcas', { sinMapa: true });
    }
  }

  // ================= LISTADOS: 24 HORAS, LOW COST Y CARRETERAS =================
  {
    const TRADICIONALES = new Set(['repsol', 'moeve', 'cepsa', 'bp', 'shell', 'galp', 'petronor', 'campsa', 'eni', 'agip', 'q8', 'disa', 'tamoil', 'avia', 'texaco', 'total', 'totalenergies']);
    const esLowCost = (e) => !TRADICIONALES.has(slug(e[C.marca] || ''));
    const pagListado = ({ ruta, migas, h1, sub, est, titulo, descripcion, faqs, extra = '', tipo, enlaces = '' }) => {
      const mm = h.migas(migas);
      const r = resumen(est);
      const pregs = h.faq(faqs(r).filter(Boolean));
      const cuerpo = `${mm.html}
<header class="cabecera"><h1>${h1}</h1><p class="sub">${sub}</p></header>
${h.medias(r, { comparar: nac })}
${h.hueco('superior')}
<section class="bloque dos">
  <div><h2>Gasolina 95 más barata</h2>${h.ranking(est, I95)}</div>
  <div><h2>Diésel más barato</h2>${h.ranking(est, IDIE)}</div>
</section>
${extra}
${h.afiliado('seguro')}
${est.length > 10 ? `<section class="bloque"><h2>Todas (${est.length})</h2>${h.tablaEstaciones(est.slice().sort((a, b) => (precioDe(a, I95) || 9) - (precioDe(b, I95) || 9)).slice(0, 150))}</section>` : ''}
${enlaces}
${h.hueco('articulo')}
${pregs.html}`;
      add(ruta, h.pagina({ ruta, titulo, descripcion, cuerpo, schemas: [mm.schema, pregs.schema] }), tipo);
      return r;
    };
    const chipsProv = (base, cuenta) => `<section class="bloque"><h2>Por provincia</h2><div class="enlaces">${datos.provincias.filter((p) => cuenta(p) > 0).map((p) => `<a href="${base}${p.slug}/">${esc(p.nombre)} <small>${cuenta(p)}</small></a>`).join('')}</div></section>`;

    // ---- 24 horas ----
    const es24 = (e) => es24h(e[C.horario]);
    const n24 = (p) => p.estaciones.filter(es24).length;
    const todas24 = datos.estaciones.filter(es24);
    pagListado({
      ruta: '/gasolineras-24-horas/', tipo: 'general',
      migas: [['/gasolineras-24-horas/', 'Gasolineras 24 horas']],
      h1: 'Gasolineras 24 horas más baratas de España hoy',
      sub: `Las ${todas24.length.toLocaleString('es-ES')} gasolineras abiertas las 24 horas, ${hoy}, ordenadas por precio.`,
      est: todas24,
      titulo: h.titulo(...h.conMarca('Gasolineras 24 horas más baratas hoy', 'Gasolineras 24 horas baratas')),
      descripcion: h.descripcion(`Gasolineras abiertas 24 horas más baratas de España hoy, ${f.corto}.`, 'Busca por provincia la más barata abierta de noche.'),
      faqs: (r) => [r.g95 && ['¿Cuál es la gasolinera 24 horas más barata de España?', `Hoy es ${esc(r.g95.barata[C.marca])} en ${esc(r.g95.barata[C.dir])} (${esc(r.g95.barata[C.mun])}), con la gasolina 95 a ${euro(r.g95.min)} €/l.`],
        ['¿Cuántas gasolineras abren 24 horas?', `Hay ${todas24.length} gasolineras con horario de 24 horas todos los días según los datos del Ministerio.`]],
      enlaces: chipsProv('/gasolineras-24-horas/', n24),
    });
    for (const p of datos.provincias) {
      const est = p.estaciones.filter(es24);
      if (est.length < 3) continue;
      pagListado({
        ruta: `/gasolineras-24-horas/${p.slug}/`, tipo: 'provincias',
        migas: [['/gasolineras-24-horas/', 'Gasolineras 24 horas'], [`/gasolineras-24-horas/${p.slug}/`, p.nombre]],
        h1: `Gasolineras 24 horas en ${esc(p.nombre)}`,
        sub: `Las ${est.length} gasolineras de ${esc(p.nombre)} abiertas las 24 horas, ${hoy}, de la más barata a la más cara.`,
        est,
        titulo: h.titulo(...h.conMarca(`Gasolineras 24 horas en ${p.nombre}: más baratas hoy`, `Gasolineras 24 horas ${p.nombre}`)),
        descripcion: h.descripcion(`Gasolineras abiertas 24 horas en ${p.nombre} hoy, ${f.corto}, ordenadas por precio.`, `Las ${est.length} que no cierran nunca.`),
        faqs: (r) => [r.g95 && [`¿Cuál es la gasolinera 24 horas más barata de ${p.nombre}?`, `${esc(r.g95.barata[C.marca])} en ${esc(r.g95.barata[C.dir])} (${esc(r.g95.barata[C.mun])}), con la gasolina 95 a ${euro(r.g95.min)} €/l hoy.`],
          [`¿Cuántas gasolineras 24 horas hay en ${p.nombre}?`, `Hay ${est.length} gasolineras abiertas las 24 horas todos los días.`]],
        enlaces: `<p class="nota"><a href="${p.ruta}">Todas las gasolineras de ${esc(p.nombre)}</a> · <a href="/gasolineras-low-cost/${p.slug}/">Low cost en ${esc(p.nombre)}</a></p>`,
      });
    }

    // ---- Low cost ----
    const nLc = (p) => p.estaciones.filter(esLowCost).length;
    const todasLc = datos.estaciones.filter(esLowCost);
    pagListado({
      ruta: '/gasolineras-low-cost/', tipo: 'general',
      migas: [['/gasolineras-low-cost/', 'Gasolineras low cost']],
      h1: 'Gasolineras low cost más baratas de España hoy',
      sub: `Gasolineras low cost, de supermercado e independientes (sin Repsol, Moeve/Cepsa, BP, Shell, Galp…), ${hoy}.`,
      est: todasLc,
      titulo: h.titulo(...h.conMarca('Gasolineras low cost más baratas hoy', 'Gasolineras low cost')),
      descripcion: h.descripcion(`Gasolineras low cost e independientes más baratas de España hoy, ${f.corto}: Ballenoil, Plenergy (Plenoil), Petroprix, supermercados y más.`),
      faqs: (r) => [['¿Qué es una gasolinera low cost?', 'Son gasolineras automáticas o de marcas pequeñas, sin tienda ni personal en muchos casos, que suelen vender más barato que las grandes marcas. El combustible cumple la misma normativa de calidad.'],
        r.g95 && nac.g95 && ['¿Cuánto más barata es una gasolinera low cost?', `Hoy la gasolina 95 cuesta de media ${euro(r.g95.media)} €/l en estas gasolineras, frente a ${euro(nac.g95.media)} €/l de media en España.`]],
      enlaces: chipsProv('/gasolineras-low-cost/', nLc),
    });
    for (const p of datos.provincias) {
      const est = p.estaciones.filter(esLowCost);
      if (est.length < 3) continue;
      pagListado({
        ruta: `/gasolineras-low-cost/${p.slug}/`, tipo: 'provincias',
        migas: [['/gasolineras-low-cost/', 'Gasolineras low cost'], [`/gasolineras-low-cost/${p.slug}/`, p.nombre]],
        h1: `Gasolineras low cost en ${esc(p.nombre)}`,
        sub: `Las ${est.length} gasolineras low cost, de supermercado e independientes de ${esc(p.nombre)}, ${hoy}.`,
        est,
        titulo: h.titulo(...h.conMarca(`Gasolineras low cost en ${p.nombre} hoy`, `Low cost ${p.nombre}`)),
        descripcion: h.descripcion(`Gasolineras low cost más baratas de ${p.nombre} hoy, ${f.corto}.`, `${est.length} gasolineras ordenadas por precio.`),
        faqs: (r) => [r.g95 && [`¿Cuál es la gasolinera low cost más barata de ${p.nombre}?`, `${esc(r.g95.barata[C.marca])} en ${esc(r.g95.barata[C.dir])} (${esc(r.g95.barata[C.mun])}), con la gasolina 95 a ${euro(r.g95.min)} €/l hoy.`]],
        enlaces: `<p class="nota"><a href="${p.ruta}">Todas las gasolineras de ${esc(p.nombre)}</a> · <a href="/gasolineras-24-horas/${p.slug}/">24 horas en ${esc(p.nombre)}</a></p>`,
      });
    }

    // ---- Carreteras (A-3, AP-7, N-332...) a partir de la dirección ----
    const NOMBRES = { 'A-1': 'Autovía del Norte', 'A-2': 'Autovía del Nordeste', 'A-3': 'Autovía del Este, Madrid–Valencia', 'A-4': 'Autovía del Sur', 'A-5': 'Autovía del Suroeste', 'A-6': 'Autovía del Noroeste', 'A-7': 'Autovía del Mediterráneo', 'AP-7': 'Autopista del Mediterráneo', 'A-8': 'Autovía del Cantábrico', 'A-31': 'Autovía de Alicante', 'A-23': 'Autovía Mudéjar', 'A-66': 'Autovía Ruta de la Plata', 'N-332': 'Carretera N-332', 'N-340': 'Carretera N-340' };
    const reVia = /(?:^|[^A-Z0-9])(AP|A|N|E)\s?-\s?(\d{1,3})(?![0-9])/;
    const pareceVia = /AUTOV|AUTOP|CARRET|CTRA|\bKM\b|KM\.?\s?\d|P\.?K\.?\s?\d|\bPK\b/;
    const vias = new Map();
    for (const e of datos.estaciones) {
      const d = String(e[C.dir] || '').toUpperCase();
      if (!pareceVia.test(d)) continue;
      const m = d.match(reVia);
      if (!m) continue;
      const cod = `${m[1]}-${+m[2]}`;
      const km = parseFloat(((d.match(/(?:KM|K\.M\.|P\.?K\.?)\s*\.?\s*(\d+(?:[.,]\d+)?)/) || [])[1] || '').replace(',', '.'));
      if (!vias.has(cod)) vias.set(cod, []);
      vias.get(cod).push({ e, km: isFinite(km) ? km : null });
    }
    const listaVias = [...vias.entries()].filter(([, l]) => l.length >= 5).sort((a, b) => b[1].length - a[1].length);
    for (const [cod, l] of listaVias) {
      const est = l.map((x) => x.e);
      const ruta = `/carreteras/${slug(cod)}/`;
      const nombre = NOMBRES[cod] ? `${cod} (${NOMBRES[cod]})` : cod;
      const provs = [...new Set(est.map((e) => datos.provMap.get(e[C.prov])?.nombre).filter(Boolean))];
      const conKm = l.filter((x) => x.km != null).sort((a, b) => a.km - b.km);
      const extra = conKm.length >= 3 ? `<section class="bloque"><h2>Gasolineras de la ${esc(cod)} por punto kilométrico</h2><div class="tabla-scroll"><table class="tabla"><thead><tr><th scope="col" class="num">Km</th><th scope="col">Gasolinera</th><th scope="col" class="num">G95</th><th scope="col" class="num">Diésel</th></tr></thead><tbody>${conKm.map((x) => `<tr><td class="num">${x.km}</td><td><strong>${esc(x.e[C.marca])}</strong><span>${esc(x.e[C.mun])} (${esc(datos.provMap.get(x.e[C.prov])?.nombre || '')})</span></td><td class="num">${euro(precioDe(x.e, I95))}</td><td class="num">${euro(precioDe(x.e, IDIE))}</td></tr>`).join('')}</tbody></table></div><p class="nota">Ordenadas por kilómetro según la dirección comunicada al Ministerio.</p></section>` : '';
      pagListado({
        ruta, tipo: 'general',
        migas: [['/carreteras/', 'Carreteras'], [ruta, cod]],
        h1: `Gasolineras más baratas en la ${esc(nombre)}`,
        sub: `${est.length} gasolineras en la ${esc(cod)}${provs.length ? ` a su paso por ${esc(provs.slice(0, 6).join(', '))}${provs.length > 6 ? '…' : ''}` : ''}, con precios de ${hoy}.`,
        est, extra,
        titulo: h.titulo(...h.conMarca(`Gasolineras baratas en la ${cod} hoy`, `Gasolineras ${cod}`)),
        descripcion: h.descripcion(`Gasolineras más baratas en la ${nombre} hoy, ${f.corto}, por punto kilométrico.`, 'Planifica dónde repostar en tu viaje.'),
        faqs: (r) => [r.g95 && [`¿Cuál es la gasolinera más barata de la ${cod}?`, `Hoy es ${esc(r.g95.barata[C.marca])} en ${esc(r.g95.barata[C.dir])} (${esc(r.g95.barata[C.mun])}), con la gasolina 95 a ${euro(r.g95.min)} €/l.`],
          r.diesel && [`¿Dónde está el diésel más barato en la ${cod}?`, `En ${esc(r.diesel.barata[C.marca])} (${esc(r.diesel.barata[C.mun])}), a ${euro(r.diesel.min)} €/l.`]],
        enlaces: '<p class="nota">Calcula cuánto te costará el viaje con la <a href="/calculadora-gasolina-viaje/">calculadora de gasolina</a>.</p>',
      });
    }
    {
      const mm = h.migas([['/carreteras/', 'Carreteras']]);
      const cuerpo = `${mm.html}
<header class="cabecera"><h1>Gasolineras baratas en autovías y carreteras</h1><p class="sub">Elige la carretera de tu viaje y mira dónde repostar más barato, ${hoy}.</p></header>
${h.hueco('superior')}
<section class="bloque"><div class="enlaces">${listaVias.map(([cod, l]) => `<a href="/carreteras/${slug(cod)}/">${esc(cod)}${NOMBRES[cod] ? ` · ${esc(NOMBRES[cod])}` : ''} <small>${l.length}</small></a>`).join('')}</div></section>`;
      add('/carreteras/', h.pagina({ ruta: '/carreteras/', titulo: h.titulo(...h.conMarca('Gasolineras baratas en autovías y carreteras de España', 'Gasolineras en carreteras')), descripcion: h.descripcion(`Gasolineras más baratas en la A-3, A-7, AP-7, A-4 y el resto de autovías y carreteras de España hoy, ${f.corto}.`), cuerpo, schemas: [mm.schema] }), 'general');
    }
  }

  // ================= CALCULADORA =================
  {
    const m = h.migas([['/calculadora-gasolina-viaje/', 'Calculadora de gasolina']]);
    const opciones = COMBUSTIBLES.filter((c) => nac[c.k]).map((c) => `<option value="${nac[c.k].media.toFixed(3)}">${c.nombre} (${euro(nac[c.k].media)} €/l)</option>`).join('');
    const pregs = h.faq([
      ['¿Cómo se calcula el gasto de gasolina de un viaje?', 'Multiplica los kilómetros por el consumo de tu coche y divide entre 100: te da los litros. Después multiplica los litros por el precio del combustible. Por ejemplo, 300 km con un coche que gasta 6 l/100 km son 18 litros; a 1,50 €/l, 27 €.'],
      ['¿Cuánto consume un coche normal?', 'Un utilitario de gasolina suele gastar entre 5 y 7 litros cada 100 km, y uno diésel entre 4 y 6. Mira la media que marca el ordenador de a bordo de tu coche para afinar el cálculo.'],
      ['¿Compensa ir a una gasolinera más lejos para ahorrar?', 'Solo si el ahorro por litro, multiplicado por los litros que vas a echar, es mayor que lo que gastas en los kilómetros extra. La segunda calculadora de esta página lo hace por ti.'],
    ]);
    const cuerpo = `${m.html}
<header class="cabecera"><h1>Calculadora de gasolina para viajes</h1><p class="sub">Calcula cuánto te cuesta un trayecto en coche con el precio medio del combustible de hoy, y cuánto toca pagar a cada uno.</p></header>
<section class="calc" id="calcViaje">
  <div class="campos">
    <label>Distancia (km)<input type="number" id="cDist" inputmode="decimal" min="1" value="300"></label>
    <label class="check"><input type="checkbox" id="cIdaVuelta"> Ida y vuelta</label>
    <label>Consumo (litros/100 km)<input type="number" id="cCons" inputmode="decimal" min="1" step="0.1" value="6.5"></label>
    <label>Combustible<select id="cComb">${opciones}</select></label>
    <label>Precio (€/l)<input type="number" id="cPrecio" inputmode="decimal" step="0.001" value="${nac.g95?.media.toFixed(3) || '1.500'}"></label>
    <label>Personas en el coche<input type="number" id="cPers" inputmode="numeric" min="1" value="1"></label>
  </div>
  <div class="calc-res" aria-live="polite"><span>Coste del viaje</span><b id="rTotal">—</b><span id="rDetalle"></span></div>
</section>
${h.hueco('superior')}
<section class="calc" id="compensa">
  <h2>¿Compensa ir a una gasolinera más lejos?</h2>
  <div class="campos">
    <label>Litros que vas a echar<input type="number" id="kLitros" inputmode="decimal" value="40"></label>
    <label>Precio en la cercana (€/l)<input type="number" id="kCerca" inputmode="decimal" step="0.001" value="${(nac.g95 ? nac.g95.media + 0.05 : 1.55).toFixed(3)}"></label>
    <label>Precio en la lejana (€/l)<input type="number" id="kLejos" inputmode="decimal" step="0.001" value="${(nac.g95 ? nac.g95.media - 0.05 : 1.45).toFixed(3)}"></label>
    <label>Kilómetros de más (ida y vuelta)<input type="number" id="kKm" inputmode="decimal" value="10"></label>
    <label>Consumo (litros/100 km)<input type="number" id="kCons" inputmode="decimal" step="0.1" value="6.5"></label>
  </div>
  <div class="calc-res" aria-live="polite"><span id="kTitulo">Ahorro neto</span><b id="kRes">—</b><span id="kDet"></span></div>
  <p><a class="btn sec" href="/">Buscar la gasolinera más barata cerca de mí</a></p>
</section>
${h.afiliado('seguro')}
${h.hueco('articulo')}
${pregs.html}`;
    add('/calculadora-gasolina-viaje/', h.pagina({
      ruta: '/calculadora-gasolina-viaje/',
      titulo: h.titulo(...h.conMarca('Calculadora de gasolina para viajes: coste por trayecto', 'Calculadora de gasolina para viajes')),
      descripcion: h.descripcion('Calcula cuánto cuesta la gasolina de un viaje en coche con el precio de hoy, cuánto paga cada persona y si compensa ir a una gasolinera más lejos.'),
      cuerpo, calculadora: true,
      schemas: [m.schema, pregs.schema, {
        '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Calculadora de gasolina para viajes', url: h.abs('/calculadora-gasolina-viaje/'),
        applicationCategory: 'UtilitiesApplication', operatingSystem: 'Cualquiera', inLanguage: cfg.idioma || 'es-ES',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      }],
    }));
  }

  // ================= LEGALES =================
  const L = cfg.legal;
  const legal = (ruta, titulo, descripcion, html) => add(ruta, h.pagina({ ruta, titulo: `${titulo} | ${cfg.nombre}`, descripcion, actualizada: false, cuerpo: `<article class="texto"><h1>${titulo}</h1>${html}</article>` }), 'legal');

  legal('/sobre-nosotros/', 'Quiénes somos', `Quiénes somos y cómo contactar con ${cfg.nombre}, el buscador gratuito de gasolineras baratas con los precios oficiales del Ministerio.`, `
<p>${esc(cfg.nombre)} es un buscador gratuito para encontrar la gasolinera más barata cerca de ti. Usamos los precios oficiales que las gasolineras comunican al Ministerio para la Transición Ecológica y el Reto Demográfico y los actualizamos varias veces al día.</p>
<p>La web es gratuita para ti porque se financia con publicidad y con enlaces a servicios de otras empresas, siempre señalados como publicidad.</p>
<h2>Contacto</h2>
<p>Para cualquier duda, error en un precio o propuesta, escríbenos a <b>${esc(cfg.emailContacto)}</b>.</p>`);

  legal('/aviso-legal/', 'Aviso legal', `Aviso legal de ${cfg.nombre}: titular de la web, condiciones de uso, origen de los precios de las gasolineras y enlaces patrocinados.`, `
<p>En cumplimiento de la Ley 34/2002 de Servicios de la Sociedad de la Información (LSSI):</p>
<ul><li>Titular: ${esc(L.titular)}</li><li>NIF: ${esc(L.nif)}</li><li>Domicilio: ${esc(L.domicilio)}</li><li>Correo electrónico: ${esc(cfg.emailContacto)}</li><li>Sitio web: ${esc(cfg.url)}</li></ul>
<h2>Uso de la web</h2><p>La información de precios procede del Ministerio para la Transición Ecológica y el Reto Demográfico y se ofrece con fines informativos. Los precios pueden cambiar en cualquier momento; el precio válido es el que marque el surtidor. No nos hacemos responsables de diferencias entre los precios publicados y los reales.</p>
<h2>Propiedad intelectual</h2><p>El diseño y los textos de esta web pertenecen a su titular. Los datos de precios son información pública reutilizable según la normativa de reutilización de la información del sector público.</p>
<h2>Enlaces</h2><p>Algunos enlaces llevan a webs de terceros, que tienen sus propias condiciones. Los enlaces patrocinados están señalados como publicidad.</p>`);

  legal('/privacidad/', 'Política de privacidad', `Política de privacidad de ${cfg.nombre}: qué datos tratamos (ubicación, búsquedas y preferencias), con qué base legal y cómo ejercer tus derechos.`, `
<p>Última actualización: ${esc(L.actualizado || f.texto)}.</p>
<h2>Responsable</h2><p>${esc(L.titular)} (NIF ${esc(L.nif)}), ${esc(L.domicilio)}. Contacto: ${esc(cfg.emailContacto)}.</p>
<h2>Qué datos tratamos</h2>
<ul>
<li><b>Tu ubicación</b>, solo si pulsas «Cerca de mí» y das permiso. Se usa en tu navegador para calcular qué gasolineras tienes cerca y no la guardamos. Para mostrarte el nombre de la calle, las coordenadas se envían al servicio Photon (Komoot).</li>
<li><b>Las direcciones que escribes</b> en el buscador, que se envían a Photon (Komoot) para localizarlas.</li>
<li><b>Tus preferencias</b> (último lugar buscado, combustible, gasolineras favoritas), que se guardan solo en tu navegador.</li>
<li><b>Estadísticas de uso</b>: si lo aceptas, Google Analytics registra de forma agregada qué páginas se visitan, desde qué tipo de dispositivo y cómo se usa el buscador, para mejorar la web. Si lo rechazas, no se guardan cookies de análisis.</li>
<li><b>Datos de navegación y publicidad</b>: Google AdSense puede usar cookies e identificadores para mostrar anuncios y medir su rendimiento, siempre con tu consentimiento cuando la ley lo exige.</li>
</ul>
<h2>Base legal</h2><p>Tu consentimiento para la ubicación, las estadísticas y las cookies publicitarias, y nuestro interés legítimo en que el servicio funcione.</p>
<h2>Terceros</h2><p>Google (publicidad y estadísticas, <a href="https://policies.google.com/technologies/ads?hl=es" rel="noopener" target="_blank">más información</a>), Komoot/Photon (búsqueda de direcciones) y OpenStreetMap (mapas). Algunos pueden tratar datos fuera del Espacio Económico Europeo con las garantías previstas en el RGPD.</p>
<h2>Tus derechos</h2><p>Puedes acceder, rectificar, suprimir, oponerte, limitar y portar tus datos escribiendo a ${esc(cfg.emailContacto)}, y reclamar ante la Agencia Española de Protección de Datos (aepd.es).</p>`);

  legal('/cookies/', 'Política de cookies', `Política de cookies de ${cfg.nombre}: qué se guarda en tu navegador, qué cookies usa la publicidad y cómo cambiar tu consentimiento.`, `
<p>Usamos almacenamiento en tu navegador para recordar tus preferencias (lugar, combustible y favoritas). Es necesario para que el buscador funcione como esperas y no requiere consentimiento.</p>
<p>Nuestros socios publicitarios (Google AdSense) usan cookies para mostrar anuncios, limitar cuántas veces ves cada uno y medir su rendimiento. Solo se activan las cookies publicitarias personalizadas si das tu consentimiento en el aviso que aparece al entrar. Puedes cambiar tu elección cuando quieras desde «Gestionar cookies», al pie de la página.</p>
<p>Si lo aceptas, usamos Google Analytics (cookies <code>_ga</code> y <code>_ga_*</code>, duración hasta 2 años) para obtener estadísticas de uso agregadas. Si lo rechazas, Google Analytics funciona sin cookies y sin identificarte.</p>
<p>También puedes borrar o bloquear las cookies desde la configuración de tu navegador.</p>`);

  // 404
  paginas.push({ ruta: '/404.html', archivo: '404.html', sinMapa: true, html: h.pagina({ ruta: '/404.html', titulo: `Página no encontrada | ${cfg.nombre}`, descripcion: 'Página no encontrada', noindex: true, actualizada: false, cuerpo: `<article class="texto"><h1>No encontramos esta página</h1><p>Puede que el enlace esté mal o que la página ya no exista.</p><p><a class="btn" href="/">Ir al buscador de gasolineras</a> <a class="btn sec" href="/gasolineras/">Ver provincias</a></p></article>` }) });

  return paginas;
}
