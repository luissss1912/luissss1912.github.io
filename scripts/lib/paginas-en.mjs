// English version of the site (under /en/). Same pages and data as paginas.mjs, with English text.
// When you change a page in paginas.mjs, change its twin here too.
import { COMBUSTIBLES, C, precioDe, esc, distancia, es24h, slug } from '../../src/comun.js';
import { anterior, serie, resumen } from './datos.mjs';
import { graficoLineas } from './grafico.mjs';

const I95 = 0, IDIE = 1;
const ALIAS = { plenergy: 'Plenergy (Plenoil)', moeve: 'Moeve (Cepsa)' };
const nombreSEO = (mk) => ALIAS[mk.slug] || mk.nombre;
const MIN_MP = 3;
const nombreMarcaEn = (n) => (n === 'Gasolinera independiente' ? 'Independent station' : n);

export function crearPaginasEn(cfg, ctx, h) {
  const { datos, historico } = ctx;
  const { L, euro, marca } = h;
  const f = h.fecha;
  const hoy = `today, ${f.texto}`;
  const nEst = datos.estaciones.length.toLocaleString('en-GB');
  const nac = datos.nacional;
  const ayerNac = anterior(historico, f.iso, (d) => d.n);
  const paginas = [];
  // The route is always written in Spanish and translated here, so both versions stay paired (hreflang)
  const add = (rutaEs, html, tipo = 'general', extra = {}) => paginas.push({ ruta: L(rutaEs), html, tipo: `en-${tipo}`, ...extra });
  const pg = (o) => h.pagina({ ...o, ruta: L(o.ruta) });
  const cts = (v) => euro(Math.abs(v * 100), 1);
  const est = (n) => (n === 1 ? '1 petrol station' : `${n.toLocaleString('en-GB')} petrol stations`);

  const iconoGps = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>';

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
  const FUERA = new Set(['35', '38', '51', '52']);
  const peninsula = datos.estaciones.filter((e) => !FUERA.has(e[C.prov]));
  const canarias = datos.estaciones.filter((e) => e[C.prov] === '35' || e[C.prov] === '38');

  const desde = (r) => [r.g95 && `unleaded 95 from €${euro(r.g95.min)}/l`, r.diesel && `diesel from €${euro(r.diesel.min)}/l`].filter(Boolean).join(' and ');
  const maps = (e) => `https://www.google.com/maps/dir/?api=1&destination=${e[C.lat]},${e[C.lon]}`;
  const listaFuera = (xs, i) => `<ol class="rank">${xs.map((x, k) => `<li><span class="rank-n">${k + 1}</span><div class="rank-d"><strong>${esc(marca(x.e))}</strong><span>${esc(x.e[C.dir])}, ${esc(x.e[C.mun])}</span><span class="rank-m">${x.d.toFixed(1)} km away · <a href="${maps(x.e)}" target="_blank" rel="noopener">Directions</a></span></div><b class="rank-p">${euro(precioDe(x.e, i))}</b></li>`).join('')}</ol>`;
  const notaPen = '<p class="nota">Mainland Spain and the Balearic Islands. The Canary Islands, Ceuta and Melilla have different taxes.</p>';

  // ================= HOME =================
  {
    const pregs = h.faq([
      ['How do I find the cheapest petrol station near me?', 'Tap «Near me» and allow access to your location, or type an address, a town or a postcode. You will see the stations in the area sorted from cheapest to most expensive, with the distance and opening hours.'],
      ['Where do the prices come from?', `From the official data that every petrol station in Spain must report to the Ministry for the Ecological Transition. We update them several times a day. Last update: ${f.texto}${f.hora ? ' at ' + f.hora : ''}.`],
      ['How much does petrol cost in Spain today?', nac.g95 ? `The average price of unleaded 95 is €${euro(nac.g95.media)} per litre and diesel costs €${euro(nac.diesel?.media)} per litre. The cheapest station in Spain sells unleaded 95 at €${euro(nac.g95.min)}/l.` : ''],
      ['Is it worth driving further to a cheaper station?', `It depends on how much you save per litre and how many extra kilometres you drive. Our <a href="${L('/calculadora-gasolina-viaje/')}#compensa">calculator</a> tells you in seconds.`],
      ['What do the fuel names at Spanish pumps mean?', '«Gasolina 95» is unleaded 95 (E5), «Gasolina 98» is super unleaded, «Gasóleo A» or «Diésel» is regular diesel, «Gasóleo Premium» is premium diesel and «GLP» or «Autogás» is LPG.'],
      ['Can I pay by card at Spanish petrol stations?', 'Almost all stations accept cards. Many low-cost and unmanned stations are card-only and ask you to pay at the pump before filling up.'],
    ].filter((x) => x[1]));

    const cuerpo = `
<section class="buscador" id="buscador">
  <h1>Cheapest petrol stations near you</h1>
  <p class="sub">Official prices for ${hoy}. ${nEst} petrol stations across Spain.</p>
  <form class="bus" id="formBus" role="search" autocomplete="off">
    <div class="inputwrap">
      <label class="vh" for="q">Address, town or postcode</label>
      <input id="q" type="search" enterkeyhint="search" placeholder="Address, town or postcode" role="combobox" aria-expanded="false" aria-controls="sugg" aria-autocomplete="list">
      <ul class="sugg" id="sugg" role="listbox" hidden></ul>
    </div>
    <button type="button" class="gps" id="gps">${iconoGps}<span>Near me</span></button>
  </form>
  <p class="msg" id="msg" role="alert" hidden></p>
  <div class="filtros">
    <div class="chips" id="fuels" role="group" aria-label="Fuel">${COMBUSTIBLES.map((c, i) => `<button type="button" class="chip" data-f="${c.k}" aria-pressed="${i === 0}">${c.en}</button>`).join('')}</div>
    <div class="fila2">
      <label class="sel"><span>Radius</span>
        <select id="radio">${[0.5, 1, 3, 5, 10, 20, 50].map((r) => `<option value="${r}"${r === 3 ? ' selected' : ''}>${r < 1 ? r * 1000 + ' m' : r + ' km'}</option>`).join('')}</select>
      </label>
      <button type="button" class="toggle" id="fAbiertas" aria-pressed="false">Open now</button>
      <button type="button" class="toggle" id="f24" aria-pressed="false">24 hours</button>
    </div>
  </div>
  <div id="resultado" aria-live="polite">
    <div class="vacio">
      <strong>Where do you want to fill up?</strong>
      <span>Today in Spain unleaded 95 costs <b>€${euro(nac.g95?.media)}/l</b> on average and diesel <b>€${euro(nac.diesel?.media)}/l</b>. Search your area to see the cheapest.</span>
      <button type="button" class="gps grande" data-gps>${iconoGps}<span>Search near me</span></button>
    </div>
  </div>
  ${h.hueco('resultados')}
  <div id="favs" hidden></div>
  <div id="listaBloque" hidden>
    <div class="listhead">
      <h2 id="listaTitulo">Petrol stations</h2>
      <div class="seg" role="group" aria-label="View"><button type="button" id="vLista" aria-pressed="true">List</button><button type="button" id="vMapa" aria-pressed="false">Map</button></div>
    </div>
    <div class="seg peq" id="ordenBox" role="group" aria-label="Sort"><button type="button" id="oPrecio" aria-pressed="true">Cheapest</button><button type="button" id="oDist" aria-pressed="false">Nearest</button></div>
    <div id="mapa" class="mapa" hidden></div>
    <ol class="lista" id="lista"></ol>
    <button type="button" class="mas" id="mas" hidden>Show more petrol stations</button>
  </div>
</section>

<section class="bloque">
  <div class="bloque-cab"><h2>Average fuel prices in Spain today</h2><a href="${L('/precio-gasolina-hoy/')}">Trends and provinces ›</a></div>
  ${h.medias(nac, { ayer: ayerNac, solo: ['g95', 'diesel', 'g98', 'glp'] })}
</section>

${h.afiliado('seguro')}

<section class="bloque dos">
  <div><h2>The 10 cheapest stations for unleaded 95 in Spain</h2>${notaPen}${h.ranking(peninsula, I95)}</div>
  <div><h2>The 10 cheapest stations for diesel in Spain</h2><p class="nota">Mainland Spain and the Balearic Islands.</p>${h.ranking(peninsula, IDIE)}</div>
</section>

${h.hueco('articulo')}

<section class="bloque">
  <h2>Cheapest petrol stations by province</h2>
  <div class="tabla-scroll"><table class="tabla prov">
    <thead><tr><th scope="col">Province</th><th scope="col" class="num">Unleaded 95</th><th scope="col" class="num">Diesel</th><th scope="col" class="num">Stations</th></tr></thead>
    <tbody>${datos.provincias.map((p) => `<tr><td><a href="${L(p.ruta)}">${esc(p.nombre)}</a></td><td class="num">${euro(p.resumen.g95?.media)}</td><td class="num">${euro(p.resumen.diesel?.media)}</td><td class="num">${p.estaciones.length}</td></tr>`).join('')}</tbody>
  </table></div>
  <p class="nota">Average price in € per litre.</p>
</section>

<section class="bloque cta-calc">
  <div><h2>How much will your trip cost?</h2><p>Work out the fuel cost of any journey and how much each person should pay.</p></div>
  <a class="btn" href="${L('/calculadora-gasolina-viaje/')}">Open the calculator</a>
</section>

${pregs.html}`;

    add('/', pg({
      ruta: '/',
      titulo: h.titulo(`Cheapest petrol stations near you: today's prices | ${cfg.nombre}`, `Cheapest petrol stations in Spain today | ${cfg.nombre}`, `Cheapest petrol stations near you | ${cfg.nombre}`),
      descripcion: h.descripcion('Find the cheapest petrol station near you in Spain with today\'s official prices.', `Unleaded 95 from €${euro(nac.g95?.min)}/l and diesel from €${euro(nac.diesel?.min)}/l.`),
      cuerpo,
      buscador: true,
      clase: 'inicio',
      schemas: [pregs.schema],
    }));
  }

  // ================= PRICES TODAY =================
  {
    const s95 = serie(historico, (d) => d.n.g95);
    const sDie = serie(historico, (d) => d.n.diesel);
    const graf = graficoLineas([{ nombre: 'Unleaded 95', datos: s95 }, { nombre: 'Diesel', datos: sDie }]);
    const provOrden = [...datos.provincias].filter((p) => p.resumen.g95).sort((a, b) => a.resumen.g95.media - b.resumen.g95.media);
    const barataProv = provOrden[0], caraProv = provOrden[provOrden.length - 1];
    const marcasOrden = [...datos.marcas].filter((m) => m.resumen.g95 && m.resumen.g95.n >= 10).sort((a, b) => a.resumen.g95.media - b.resumen.g95.media);
    const var95 = ayerNac?.g95 != null && nac.g95 ? nac.g95.media - ayerNac.g95 : null;
    const frase = var95 == null ? '' : Math.abs(var95) < 0.0005 ? 'Unchanged since yesterday.' : var95 > 0 ? `Up ${cts(var95)} cents on yesterday.` : `Down ${cts(var95)} cents on yesterday.`;
    const m = h.migas([['/precio-gasolina-hoy/', 'Fuel prices today']]);
    const pregs = h.faq([
      ['What is the price of petrol in Spain today?', `Today, ${f.texto}, the average price of unleaded 95 in Spain is €${euro(nac.g95?.media)} per litre. ${frase}`],
      ['What is the price of diesel in Spain today?', nac.diesel ? `Diesel costs €${euro(nac.diesel.media)} per litre on average. The cheapest station sells it at €${euro(nac.diesel.min)}/l.` : ''],
      barataProv && ['Where is the cheapest petrol in Spain?', `By province, the cheapest unleaded 95 is in ${esc(barataProv.nombre)} (average €${euro(barataProv.resumen.g95.media)}/l) and the most expensive in ${esc(caraProv.nombre)} (€${euro(caraProv.resumen.g95.media)}/l). The Canary Islands, Ceuta and Melilla have lower fuel taxes.`],
      ['How often are the prices updated?', 'Several times a day, using the data that petrol stations report to the Spanish Ministry for the Ecological Transition.'],
    ].filter(Boolean).filter((x) => x[1]));

    const cuerpo = `
${m.html}
<header class="cabecera">
  <h1>Petrol and diesel prices in Spain today, ${f.texto}</h1>
  <p class="sub">Unleaded 95 costs <b>€${euro(nac.g95?.media)}/l</b> on average in Spain today and diesel <b>€${euro(nac.diesel?.media)}/l</b>. ${frase} Official data updated${f.hora ? ' at ' + f.hora : ''}.</p>
</header>
${h.medias(nac, { ayer: ayerNac })}
${h.hueco('superior')}
${graf ? `<section class="bloque"><h2>Price trend over the last ${Math.min(30, s95.length)} days</h2>${graf}</section>` : ''}
<section class="bloque dos">
  <div><h2>Cheapest unleaded 95 in Spain today</h2><p class="nota">Mainland Spain and the Balearic Islands.</p>${h.ranking(peninsula, I95)}</div>
  <div><h2>Cheapest diesel in Spain today</h2><p class="nota">Mainland Spain and the Balearic Islands.</p>${h.ranking(peninsula, IDIE)}</div>
</section>
${canarias.length ? `<section class="bloque dos">
  <div><h2>Cheapest unleaded 95 in the Canary Islands today</h2>${h.ranking(canarias, I95, { n: 5 })}</div>
  <div><h2>Cheapest diesel in the Canary Islands today</h2>${h.ranking(canarias, IDIE, { n: 5 })}</div>
</section>` : ''}
${h.afiliado('tarjeta')}
<section class="bloque">
  <h2>Petrol prices by province, cheapest first</h2>
  <div class="tabla-scroll"><table class="tabla prov">
    <thead><tr><th scope="col">Province</th><th scope="col" class="num">Unleaded 95</th><th scope="col" class="num">Diesel</th><th scope="col" class="num">Cheapest 95</th></tr></thead>
    <tbody>${provOrden.map((p) => `<tr><td><a href="${L(p.ruta)}">${esc(p.nombre)}</a></td><td class="num">${euro(p.resumen.g95?.media)}</td><td class="num">${euro(p.resumen.diesel?.media)}</td><td class="num">${euro(p.resumen.g95?.min)}</td></tr>`).join('')}</tbody>
  </table></div>
</section>
${h.hueco('articulo')}
${marcasOrden.length ? `<section class="bloque">
  <h2>Average unleaded 95 price by brand</h2>
  <div class="tabla-scroll"><table class="tabla">
    <thead><tr><th scope="col">Brand</th><th scope="col" class="num">Unleaded 95</th><th scope="col" class="num">Diesel</th><th scope="col" class="num">Stations</th></tr></thead>
    <tbody>${marcasOrden.map((mk) => `<tr><td><a href="${L(mk.ruta)}">${esc(nombreMarcaEn(mk.nombre))}</a></td><td class="num">${euro(mk.resumen.g95?.media)}</td><td class="num">${euro(mk.resumen.diesel?.media)}</td><td class="num">${mk.estaciones.length}</td></tr>`).join('')}</tbody>
  </table></div>
</section>` : ''}
${pregs.html}`;
    add('/precio-gasolina-hoy/', pg({
      ruta: '/precio-gasolina-hoy/',
      titulo: h.titulo(...h.conMarca(`Petrol prices in Spain today, ${f.corto}: €${euro(nac.g95?.media)}/l`, `Petrol prices in Spain today: €${euro(nac.g95?.media)}/l`)),
      descripcion: h.descripcion(`Petrol and diesel prices in Spain today, ${f.corto}: unleaded 95 at €${euro(nac.g95?.media)}/l and diesel at €${euro(nac.diesel?.media)}/l on average.`, 'The cheapest stations in Spain and by province.', 'Daily trend.'),
      cuerpo,
      schemas: [m.schema, pregs.schema],
    }));
  }

  // ================= PROVINCE INDEX =================
  {
    const m = h.migas([['/gasolineras/', 'Petrol stations by province']]);
    const cuerpo = `${m.html}
<header class="cabecera"><h1>Cheapest petrol stations by province</h1><p class="sub">Choose your province to see the cheapest petrol stations in every town, with prices for ${hoy}.</p></header>
<div class="rejilla-prov">${datos.provincias.map((p) => `<a class="tprov" href="${L(p.ruta)}"><strong>${esc(p.nombre)}</strong><span>95: ${euro(p.resumen.g95?.media)} · Diesel: ${euro(p.resumen.diesel?.media)}</span><small>${est(p.estaciones.length)}</small></a>`).join('')}</div>
${h.hueco('articulo')}`;
    add('/gasolineras/', pg({ ruta: '/gasolineras/', titulo: h.titulo(...h.conMarca('Cheapest petrol stations by province in Spain')), descripcion: h.descripcion(`Average petrol and diesel prices in every Spanish province today, ${f.corto}, and the cheapest petrol stations in each town.`), cuerpo, schemas: [m.schema] }));
  }

  // ================= PROVINCES =================
  for (const p of datos.provincias) {
    const r = p.resumen;
    const ayerP = anterior(historico, f.iso, (d) => d.p[p.id]);
    const graf = graficoLineas([
      { nombre: 'Unleaded 95', datos: serie(historico, (d) => d.p[p.id]?.g95) },
      { nombre: 'Diesel', datos: serie(historico, (d) => d.p[p.id]?.diesel) },
    ]);
    const muns = [...p.municipios.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const munBarato = muns.filter((x) => x.resumen.g95 && x.estaciones.length >= 2).sort((a, b) => a.resumen.g95.media - b.resumen.g95.media)[0];
    const porMarca = new Map();
    for (const e of p.estaciones) {
      if (!precioDe(e, I95)) continue;
      const g = porMarca.get(marca(e)) || { n: 0, s: 0 };
      g.n++; g.s += precioDe(e, I95);
      porMarca.set(marca(e), g);
    }
    const marcasP = [...porMarca.entries()].filter(([, g]) => g.n >= 3).map(([k, g]) => [k, g.s / g.n, g.n]).sort((a, b) => a[1] - b[1]).slice(0, 12);
    const b95 = r.g95?.barata, bDie = r.diesel?.barata;
    const m = h.migas([['/gasolineras/', 'Provinces'], [p.ruta, p.nombre]]);
    const pregs = h.faq([
      b95 && [`Which is the cheapest petrol station in ${p.nombre}?`, `Today the cheapest unleaded 95 in ${esc(p.nombre)} is at ${esc(marca(b95))} (${esc(b95[C.dir])}, ${esc(b95[C.mun])}) for €${euro(r.g95.min)}/l.${bDie ? ` The cheapest diesel is at ${esc(marca(bDie))} (${esc(bDie[C.mun])}) for €${euro(r.diesel.min)}/l.` : ''}`],
      r.g95 && [`How much does petrol cost in ${p.nombre}?`, `The average price of unleaded 95 in ${esc(p.nombre)} is €${euro(r.g95.media)}/l${nac.g95 ? `, compared with €${euro(nac.g95.media)}/l across Spain` : ''}.${r.diesel ? ` Diesel costs €${euro(r.diesel.media)}/l on average.` : ''}`],
      munBarato && [`Which town in ${p.nombre} has the cheapest petrol?`, `Among towns with at least two petrol stations, the cheapest today is <a href="${L(munBarato.ruta)}">${esc(munBarato.nombre)}</a>, with unleaded 95 at €${euro(munBarato.resumen.g95.media)}/l on average.`],
      [`How many petrol stations are there in ${p.nombre}?`, `There are ${est(p.estaciones.length)} open to the public with reported prices, spread across ${p.municipios.size} towns.`],
    ].filter(Boolean));

    const cuerpo = `${m.html}
<header class="cabecera">
  <h1>Cheapest petrol stations in ${esc(p.nombre)} today</h1>
  <p class="sub">Prices for ${hoy} at the ${est(p.estaciones.length)} in ${esc(p.nombre)}.${r.g95 ? ` Unleaded 95 costs €${euro(r.g95.media)}/l on average and the cheapest is €${euro(r.g95.min)}/l.` : ''}</p>
  <a class="btn sec" href="${h.enlaceBuscador((p.bbox[0] + p.bbox[2]) / 2, (p.bbox[1] + p.bbox[3]) / 2, p.nombre)}">Search near me on the map</a>
  <div class="enlaces" style="margin-top:10px"><a href="${L(`/gasolineras-24-horas/${p.slug}/`)}">24 hours</a><a href="${L(`/gasolineras-low-cost/${p.slug}/`)}">Low cost</a><a href="${L('/carreteras/')}">Motorways</a></div>
</header>
${h.medias(r, ayerP ? { ayer: ayerP } : { comparar: nac })}
${h.hueco('superior')}
<section class="bloque dos">
  <div><h2>Cheapest unleaded 95 in ${esc(p.nombre)}</h2>${h.ranking(p.estaciones, I95)}</div>
  <div><h2>Cheapest diesel in ${esc(p.nombre)}</h2>${h.ranking(p.estaciones, IDIE)}</div>
</section>
${h.afiliado('seguro')}
<section class="bloque">
  <h2>Petrol stations in ${esc(p.nombre)} by town</h2>
  <div class="tabla-scroll"><table class="tabla prov">
    <thead><tr><th scope="col">Town</th><th scope="col" class="num">Unleaded 95</th><th scope="col" class="num">Diesel</th><th scope="col" class="num">Stations</th></tr></thead>
    <tbody>${muns.map((x) => `<tr><td><a href="${L(x.ruta)}">${esc(x.nombre)}</a></td><td class="num">${euro(x.resumen.g95?.min)}</td><td class="num">${euro(x.resumen.diesel?.min)}</td><td class="num">${x.estaciones.length}</td></tr>`).join('')}</tbody>
  </table></div>
  <p class="nota">Cheapest price in each town, in € per litre.</p>
</section>
${h.hueco('articulo')}
${graf ? `<section class="bloque"><h2>Average price trend in ${esc(p.nombre)}</h2>${graf}</section>` : ''}
${marcasP.length > 1 ? `<section class="bloque"><h2>Cheapest brands in ${esc(p.nombre)}</h2>
  <div class="tabla-scroll"><table class="tabla"><thead><tr><th scope="col">Brand</th><th scope="col" class="num">Average unleaded 95</th><th scope="col" class="num">Stations</th></tr></thead>
  <tbody>${marcasP.map(([k, v, n]) => `<tr><td>${esc(k)}</td><td class="num">${euro(v)}</td><td class="num">${n}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
${pregs.html}`;
    add(p.ruta, pg({
      ruta: p.ruta,
      titulo: h.titulo(...h.conMarca(`Cheapest petrol stations in ${p.nombre} today`, `Cheap petrol in ${p.nombre} today`, `Petrol prices ${p.nombre}`)),
      descripcion: h.descripcion(`Cheapest petrol stations in ${p.nombre}, Spain, today, ${f.corto}${desde(r) ? `: ${desde(r)}` : ''}.`, `Prices at all ${est(p.estaciones.length)}, town by town.`),
      cuerpo,
      schemas: [m.schema, pregs.schema, h.schemaGasolineras([...p.estaciones].sort((a, b) => (precioDe(a, I95) || 9) - (precioDe(b, I95) || 9)), `Cheapest petrol stations in ${p.nombre}`)],
    }), 'provincias');

    // ================= TOWNS =================
    for (const mu of p.municipios.values()) {
      const rm = mu.resumen;
      const b95m = rm.g95?.barata, bDiem = rm.diesel?.barata;
      const idsPropios = new Set(mu.estaciones.map((e) => e[C.id]));
      const alrededor = cercanas(mu.lat, mu.lon, 15).filter((x) => !idsPropios.has(x.e[C.id]));
      const mejoresFuera = (i) => alrededor.filter((x) => precioDe(x.e, i) && (!rm[COMBUSTIBLES[i].k] || precioDe(x.e, i) < rm[COMBUSTIBLES[i].k].min)).sort((a, b) => precioDe(a.e, i) - precioDe(b.e, i)).slice(0, 5);
      const fuera95 = mejoresFuera(I95), fueraDie = mejoresFuera(IDIE);
      const vecinos = todosMunicipios.filter((x) => x !== mu).map((x) => ({ x, d: distancia(mu.lat, mu.lon, x.lat, x.lon) })).sort((a, b) => a.d - b.d).slice(0, 12);
      const n24 = mu.estaciones.filter((e) => es24h(e[C.horario])).length;
      const m = h.migas([['/gasolineras/', 'Provinces'], [p.ruta, p.nombre], [mu.ruta, mu.nombre]]);
      const n = mu.estaciones.length;

      const pregs = h.faq([
        b95m && [`Which is the cheapest petrol station in ${mu.nombre}?`, `Today the cheapest unleaded 95 in ${esc(mu.nombre)} is at ${esc(marca(b95m))}, ${esc(b95m[C.dir])}, for €${euro(rm.g95.min)}/l.${bDiem ? ` The cheapest diesel is at ${esc(marca(bDiem))}, ${esc(bDiem[C.dir])}, for €${euro(rm.diesel.min)}/l.` : ''}`],
        [`How many petrol stations are there in ${mu.nombre}?`, `There ${n === 1 ? 'is 1 petrol station' : `are ${n} petrol stations`} in ${esc(mu.nombre)} (${esc(p.nombre)}).${fuera95.length ? ` Within 15 km there ${fuera95.length === 1 ? 'is 1 station' : `are ${fuera95.length === 5 ? 'several' : fuera95.length} stations`} with cheaper unleaded 95 than in the town itself.` : ''}`],
        [`Are there 24-hour petrol stations in ${mu.nombre}?`, n24 ? `Yes, ${n24 === 1 ? 'there is 1 petrol station' : `there are ${n24} petrol stations`} open 24 hours in ${esc(mu.nombre)}.` : `According to the opening hours reported to the Ministry, there are no 24-hour petrol stations in ${esc(mu.nombre)}. Use the <a href="${h.enlaceBuscador(mu.lat, mu.lon, mu.nombre)}">search</a> with the «24 hours» filter to find the nearest one.`],
        rm.g95 && p.resumen.g95 && [`Is petrol expensive in ${mu.nombre}?`, `Unleaded 95 costs €${euro(rm.g95.media)}/l on average in ${esc(mu.nombre)}, compared with €${euro(p.resumen.g95.media)}/l across the province of ${esc(p.nombre)}.`],
      ].filter(Boolean));

      const cuerpo = `${m.html}
<header class="cabecera">
  <h1>Cheap petrol stations in ${esc(mu.nombre)} today</h1>
  <p class="sub">Prices for ${hoy} at ${n === 1 ? 'the only petrol station' : `the ${n} petrol stations`} in ${esc(mu.nombre)} (${esc(p.nombre)}).</p>
</header>
<div class="destacadas">
  ${b95m ? `<div class="totem mini"><span class="t-f">Cheapest unleaded 95</span><b class="t-p">${euro(rm.g95.min)}<small>€/l</small></b><strong>${esc(marca(b95m))}</strong><span>${esc(b95m[C.dir])}</span></div>` : ''}
  ${bDiem ? `<div class="totem mini"><span class="t-f">Cheapest diesel</span><b class="t-p">${euro(rm.diesel.min)}<small>€/l</small></b><strong>${esc(marca(bDiem))}</strong><span>${esc(bDiem[C.dir])}</span></div>` : ''}
</div>
${h.medias(rm, { comparar: p.resumen, fraseComparar: `the ${p.nombre} average`, solo: ['g95', 'diesel', 'g98', 'glp'] })}
<p><a class="btn sec" href="${h.enlaceBuscador(mu.lat, mu.lon, mu.nombre)}">See on the map and search near me</a></p>
${h.hueco('superior')}
<section class="bloque">
  <h2>Prices at every petrol station in ${esc(mu.nombre)}</h2>
  ${h.tablaEstaciones(mu.estaciones)}
  <p class="nota">Prices in € per litre. The cheapest for each fuel is shown in green.</p>
</section>
${h.afiliado('seguro')}
${fuera95.length || fueraDie.length ? `<section class="bloque dos">
  ${fuera95.length ? `<div><h2>Cheaper unleaded 95 near ${esc(mu.nombre)}</h2><p class="nota">Within 15 km and cheaper than in ${esc(mu.nombre)}.</p>${listaFuera(fuera95, I95)}</div>` : ''}
  ${fueraDie.length ? `<div><h2>Cheaper diesel near ${esc(mu.nombre)}</h2><p class="nota">Within 15 km and cheaper than in ${esc(mu.nombre)}.</p>${listaFuera(fueraDie, IDIE)}</div>` : ''}
</section>` : ''}
${h.hueco('articulo')}
<section class="bloque">
  <h2>Petrol stations in nearby towns</h2>
  <div class="enlaces">${vecinos.map(({ x, d }) => `<a href="${L(x.ruta)}">${esc(x.nombre)} <small>${d.toFixed(0)} km</small></a>`).join('')}</div>
</section>
${pregs.html}`;

      add(mu.ruta, pg({
        ruta: mu.ruta,
        titulo: h.titulo(...h.conMarca(`Cheap petrol stations in ${mu.nombre} today: prices`, `Cheap petrol stations in ${mu.nombre} today`, `Petrol stations in ${mu.nombre} today`, `Petrol in ${mu.nombre} today`)),
        descripcion: h.descripcion(`Cheapest petrol stations in ${mu.nombre} (${p.nombre}, Spain) today, ${f.corto}${desde(rm) ? `: ${desde(rm)}` : ''}.`, 'Prices, opening hours and directions.'),
        cuerpo,
        schemas: [m.schema, pregs.schema, h.schemaGasolineras([...mu.estaciones].sort((a, b) => (precioDe(a, I95) || 9) - (precioDe(b, I95) || 9)), `Petrol stations in ${mu.nombre}`)],
      }), 'municipios');
    }

    // ===== TOWNS WITHOUT PRICES TODAY =====
    for (const mu of p.ausentes) {
      let radio = 15, alrededor = cercanas(mu.lat, mu.lon, radio);
      if (alrededor.length < 3) alrededor = cercanas(mu.lat, mu.lon, (radio = 30));
      const top = (i) => alrededor.filter((x) => precioDe(x.e, i)).sort((a, b) => precioDe(a.e, i) - precioDe(b.e, i)).slice(0, 8);
      const t95 = top(I95), tDie = top(IDIE);
      const vecinos = todosMunicipios.map((x) => ({ x, d: distancia(mu.lat, mu.lon, x.lat, x.lon) })).sort((a, b) => a.d - b.d).slice(0, 12);
      const m = h.migas([['/gasolineras/', 'Provinces'], [p.ruta, p.nombre], [mu.ruta, mu.nombre]]);
      const cuerpo = `${m.html}
<header class="cabecera">
  <h1>Cheap petrol stations near ${esc(mu.nombre)} today</h1>
  <p class="sub">Today, ${f.texto}, the petrol stations in ${esc(mu.nombre)} (${esc(p.nombre)}) have not reported prices to the Ministry. These are the cheapest within ${radio} km.</p>
</header>
<p><a class="btn sec" href="${h.enlaceBuscador(mu.lat, mu.lon, mu.nombre)}">See on the map and search near me</a></p>
${h.hueco('superior')}
${t95.length || tDie.length ? `<section class="bloque dos">
  ${t95.length ? `<div><h2>Cheapest unleaded 95 near ${esc(mu.nombre)}</h2>${listaFuera(t95, I95)}</div>` : ''}
  ${tDie.length ? `<div><h2>Cheapest diesel near ${esc(mu.nombre)}</h2>${listaFuera(tDie, IDIE)}</div>` : ''}
</section>` : `<p class="nota">There are no petrol stations with prices within ${radio} km. Try the <a href="${h.enlaceBuscador(mu.lat, mu.lon, mu.nombre)}">search</a> with a larger radius.</p>`}
${h.afiliado('seguro')}
${h.hueco('articulo')}
<section class="bloque">
  <h2>Petrol stations in nearby towns</h2>
  <div class="enlaces">${vecinos.map(({ x, d }) => `<a href="${L(x.ruta)}">${esc(x.nombre)} <small>${d.toFixed(0)} km</small></a>`).join('')}</div>
</section>`;
      add(mu.ruta, pg({
        ruta: mu.ruta,
        titulo: h.titulo(...h.conMarca(`Cheap petrol stations near ${mu.nombre} today`, `Petrol stations near ${mu.nombre} today`)),
        descripcion: h.descripcion(`Cheapest petrol stations near ${mu.nombre} (${p.nombre}, Spain) today, ${f.corto}, within ${radio} km.`, 'Prices, opening hours and directions.'),
        cuerpo,
        schemas: [m.schema],
      }), 'municipios');
    }
  }

  // ================= BRANDS =================
  {
    const m = h.migas([['/marcas/', 'Prices by brand']]);
    const orden = [...datos.marcas].sort((a, b) => (a.resumen.g95?.media || 9) - (b.resumen.g95?.media || 9));
    const cuerpo = `${m.html}
<header class="cabecera"><h1>Petrol prices by brand today</h1><p class="sub">Compare the average price at each petrol station brand in Spain, ${hoy}.</p></header>
<div class="tabla-scroll"><table class="tabla">
  <thead><tr><th scope="col">Brand</th><th scope="col" class="num">Unleaded 95</th><th scope="col" class="num">Diesel</th><th scope="col" class="num">Stations</th></tr></thead>
  <tbody>${orden.map((mk) => `<tr><td><a href="${L(mk.ruta)}">${esc(nombreMarcaEn(mk.nombre))}</a></td><td class="num">${euro(mk.resumen.g95?.media)}</td><td class="num">${euro(mk.resumen.diesel?.media)}</td><td class="num">${mk.estaciones.length}</td></tr>`).join('')}</tbody>
</table></div>
${h.hueco('articulo')}`;
    add('/marcas/', pg({ ruta: '/marcas/', titulo: h.titulo(...h.conMarca('Petrol prices by brand in Spain today')), descripcion: h.descripcion(`Which petrol station brand is cheapest in Spain? Average unleaded 95 and diesel prices by brand today, ${f.corto}.`, 'Repsol, Cepsa, BP, Shell, Ballenoil and more.'), cuerpo, schemas: [m.schema] }), 'marcas');

    for (const mk of datos.marcas) {
      const r = mk.resumen;
      const nom = nombreMarcaEn(mk.nombre), seo = nombreMarcaEn(nombreSEO(mk));
      const provs = new Map();
      for (const e of mk.estaciones) {
        const g = provs.get(e[C.prov]) || { n: 0, s95: 0, n95: 0, sd: 0, nd: 0 };
        g.n++;
        if (precioDe(e, I95)) { g.s95 += precioDe(e, I95); g.n95++; }
        if (precioDe(e, IDIE)) { g.sd += precioDe(e, IDIE); g.nd++; }
        provs.set(e[C.prov], g);
      }
      const filas = [...provs.entries()].map(([id, g]) => ({ p: datos.provMap.get(id), ...g })).filter((x) => x.p).sort((a, b) => a.p.nombre.localeCompare(b.p.nombre, 'es'));
      const mm = h.migas([['/marcas/', 'Brands'], [mk.ruta, nom]]);
      const pregs = h.faq([
        r.g95 && [`How much is petrol at ${nom} today?`, `The average price of unleaded 95 at ${esc(nom)} stations is €${euro(r.g95.media)}/l${nac.g95 ? `, compared with €${euro(nac.g95.media)}/l across Spain` : ''}.`],
        r.g95 && [`Which is the cheapest ${nom} station?`, `Today it is the one at ${esc(r.g95.barata[C.dir])}, in ${esc(r.g95.barata[C.mun])}, with unleaded 95 at €${euro(r.g95.min)}/l.`],
        [`How many ${nom} petrol stations are there in Spain?`, `There are ${mk.estaciones.length} ${esc(nom)} stations reporting prices to the Ministry, in ${filas.length} provinces.`],
      ].filter(Boolean));
      const cuerpo = `${mm.html}
<header class="cabecera"><h1>${esc(seo)} petrol prices today</h1><p class="sub">Prices for ${hoy} at the ${mk.estaciones.length} ${esc(nom)} petrol stations in Spain.</p></header>
${h.medias(r, { comparar: nac })}
${h.hueco('superior')}
<section class="bloque dos">
  <div><h2>${esc(nom)} stations with the cheapest unleaded 95</h2>${h.ranking(mk.estaciones, I95)}</div>
  <div><h2>${esc(nom)} stations with the cheapest diesel</h2>${h.ranking(mk.estaciones, IDIE)}</div>
</section>
${h.afiliado('tarjeta')}
<section class="bloque"><h2>${esc(nom)} petrol stations by province</h2>
<div class="tabla-scroll"><table class="tabla prov"><thead><tr><th scope="col">Province</th><th scope="col" class="num">Unleaded 95</th><th scope="col" class="num">Diesel</th><th scope="col" class="num">Stations</th></tr></thead>
<tbody>${filas.map((x) => `<tr><td><a href="${L(x.n >= MIN_MP ? `${mk.ruta}${x.p.slug}/` : x.p.ruta)}">${esc(x.p.nombre)}</a></td><td class="num">${x.n95 ? euro(x.s95 / x.n95) : '—'}</td><td class="num">${x.nd ? euro(x.sd / x.nd) : '—'}</td><td class="num">${x.n}</td></tr>`).join('')}</tbody></table></div></section>
${h.hueco('articulo')}
${pregs.html}`;
      add(mk.ruta, pg({
        ruta: mk.ruta,
        titulo: h.titulo(...h.conMarca(r.g95 ? `${seo} petrol price today: €${euro(r.g95.media)}/l` : `${seo} petrol price today`, `${nom} petrol price today`)),
        descripcion: h.descripcion(`Petrol and diesel prices at ${nom} in Spain today, ${f.corto}${r.g95 ? `: unleaded 95 at €${euro(r.g95.media)}/l on average` : ''}.`, `The cheapest ${nom} stations in Spain and by province.`),
        cuerpo,
        schemas: [mm.schema, pregs.schema],
      }), 'marcas');
    }

    // ===== BRAND × PROVINCE =====
    for (const mk of datos.marcas) {
      const nom = nombreMarcaEn(mk.nombre), seo = nombreMarcaEn(nombreSEO(mk));
      const porProv = new Map();
      for (const e of mk.estaciones) {
        if (!porProv.has(e[C.prov])) porProv.set(e[C.prov], []);
        porProv.get(e[C.prov]).push(e);
      }
      for (const [provId, lista] of porProv) {
        const p = datos.provMap.get(provId);
        if (!p || lista.length < MIN_MP) continue;
        const ruta = `${mk.ruta}${p.slug}/`;
        const r = resumen(lista);
        const rp = p.resumen;
        const munis = new Map();
        for (const e of lista) munis.set(e[C.mun], (munis.get(e[C.mun]) || 0) + 1);
        const listaMun = [...munis.entries()].sort((a, b) => b[1] - a[1]);
        const munRuta = new Map([...p.municipios.values()].map((x) => [x.nombre, x.ruta]));
        const otras = datos.marcas.filter((o) => o !== mk && o.estaciones.some((e) => e[C.prov] === provId && precioDe(e, I95)))
          .map((o) => { const ee = o.estaciones.filter((e) => e[C.prov] === provId); return { o, n: ee.length, r: resumen(ee) }; })
          .filter((x) => x.n >= MIN_MP && x.r.g95).sort((a, b) => a.r.g95.media - b.r.g95.media).slice(0, 8);
        const dif = r.g95 && rp.g95 ? r.g95.media - rp.g95.media : null;
        const mm = h.migas([['/marcas/', 'Brands'], [mk.ruta, nom], [ruta, p.nombre]]);
        const pregs = h.faq([
          r.g95 && [`How much is petrol at ${nom} in ${p.nombre} today?`, `Unleaded 95 at ${esc(nom)} stations in ${esc(p.nombre)} costs €${euro(r.g95.media)}/l on average today${dif != null ? `, ${Math.abs(dif) < 0.005 ? 'the same as' : dif < 0 ? `€${euro(-dif)}/l less than` : `€${euro(dif)}/l more than`} the provincial average (€${euro(rp.g95.media)}/l)` : ''}.`],
          r.diesel && [`How much is diesel at ${nom} in ${p.nombre}?`, `Diesel costs €${euro(r.diesel.media)}/l on average; the cheapest is €${euro(r.diesel.min)}/l at ${esc(r.diesel.barata[C.dir])} (${esc(r.diesel.barata[C.mun])}).`],
          r.g95 && [`Which is the cheapest ${nom} in ${p.nombre}?`, `Today it is the one at ${esc(r.g95.barata[C.dir])}, in ${esc(r.g95.barata[C.mun])}, with unleaded 95 at €${euro(r.g95.min)}/l.`],
          [`How many ${nom} petrol stations are there in ${p.nombre}?`, `There are ${lista.length} ${esc(nom)} stations with prices in ${listaMun.length === 1 ? '1 town' : `${listaMun.length} towns`} in ${esc(p.nombre)}.`],
        ].filter(Boolean));
        const cuerpo = `${mm.html}
<header class="cabecera"><h1>${esc(seo)} petrol prices in ${esc(p.nombre)} today</h1><p class="sub">Prices for ${hoy} at the ${lista.length} ${esc(nom)} petrol stations in ${esc(p.nombre)}, compared with the provincial average.</p></header>
${h.medias(r, { comparar: rp, fraseComparar: `the ${p.nombre} average` })}
${h.hueco('superior')}
<section class="bloque dos">
  <div><h2>${esc(nom)} with the cheapest unleaded 95 in ${esc(p.nombre)}</h2>${h.ranking(lista, I95)}</div>
  <div><h2>${esc(nom)} with the cheapest diesel in ${esc(p.nombre)}</h2>${h.ranking(lista, IDIE)}</div>
</section>
${h.afiliado('tarjeta')}
<section class="bloque"><h2>Towns with ${esc(nom)} petrol stations in ${esc(p.nombre)}</h2>
<div class="enlaces">${listaMun.map(([n, c]) => munRuta.get(n) ? `<a href="${L(munRuta.get(n))}">${esc(n)} <small>${c}</small></a>` : `<span>${esc(n)} (${c})</span>`).join('')}</div></section>
${otras.length ? `<section class="bloque"><h2>Other brands in ${esc(p.nombre)}</h2>
<div class="tabla-scroll"><table class="tabla prov"><thead><tr><th scope="col">Brand</th><th scope="col" class="num">Unleaded 95</th><th scope="col" class="num">Diesel</th><th scope="col" class="num">Stations</th></tr></thead>
<tbody>${otras.map((x) => `<tr><td><a href="${L(`${x.o.ruta}${p.slug}/`)}">${esc(nombreMarcaEn(x.o.nombre))}</a></td><td class="num">${euro(x.r.g95?.media)}</td><td class="num">${euro(x.r.diesel?.media)}</td><td class="num">${x.n}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
<p class="nota"><a href="${L(p.ruta)}">All petrol stations in ${esc(p.nombre)}</a> · <a href="${L(mk.ruta)}">${esc(nom)} across Spain</a></p>
${h.hueco('articulo')}
${pregs.html}`;
        add(ruta, pg({
          ruta,
          titulo: h.titulo(...h.conMarca(r.g95 ? `${seo} ${p.nombre}: petrol at €${euro(r.g95.media)}/l today` : `${seo} prices in ${p.nombre} today`, `${nom} ${p.nombre} petrol price today`)),
          descripcion: h.descripcion(`Petrol and diesel prices at the ${lista.length} ${nom} stations in ${p.nombre} today, ${f.corto}${r.g95 ? `: unleaded 95 from €${euro(r.g95.min)}/l` : ''}.`, `The cheapest ${nom} in ${p.nombre} compared with other brands.`),
          cuerpo,
          schemas: [mm.schema, pregs.schema],
        }), 'marcas');
      }
    }

    for (const mk of datos.marcasAusentes) {
      const nom = nombreMarcaEn(mk.nombre);
      const mm = h.migas([['/marcas/', 'Brands'], [mk.ruta, nom]]);
      add(mk.ruta, pg({
        ruta: mk.ruta,
        titulo: `${nom} petrol price today | ${cfg.nombre}`,
        descripcion: `No ${nom} prices today.`,
        noindex: true,
        cuerpo: `${mm.html}<article class="texto"><h1>${esc(nom)} petrol prices today</h1><p>Today, ${f.texto}, no ${esc(nom)} petrol station has reported prices to the Ministry.</p><p><a class="btn" href="${L('/marcas/')}">See prices at other brands</a> <a class="btn sec" href="${L('/')}">Find the cheapest petrol station near me</a></p></article>`,
      }), 'marcas', { sinMapa: true });
    }
  }

  // ================= LISTINGS: 24 HOURS, LOW COST AND MOTORWAYS =================
  {
    const TRADICIONALES = new Set(['repsol', 'moeve', 'cepsa', 'bp', 'shell', 'galp', 'petronor', 'campsa', 'eni', 'agip', 'q8', 'disa', 'tamoil', 'avia', 'texaco', 'total', 'totalenergies']);
    const esLowCost = (e) => !TRADICIONALES.has(slug(e[C.marca] || ''));
    const pagListado = ({ ruta, migas, h1, sub, est: lista, titulo, descripcion, faqs, extra = '', tipo, enlaces = '' }) => {
      const mm = h.migas(migas);
      const r = resumen(lista);
      const pregs = h.faq(faqs(r).filter(Boolean));
      const cuerpo = `${mm.html}
<header class="cabecera"><h1>${h1}</h1><p class="sub">${sub}</p></header>
${h.medias(r, { comparar: nac })}
${h.hueco('superior')}
<section class="bloque dos">
  <div><h2>Cheapest unleaded 95</h2>${h.ranking(lista, I95)}</div>
  <div><h2>Cheapest diesel</h2>${h.ranking(lista, IDIE)}</div>
</section>
${extra}
${h.afiliado('seguro')}
${lista.length > 10 ? `<section class="bloque"><h2>All of them (${lista.length})</h2>${h.tablaEstaciones(lista.slice().sort((a, b) => (precioDe(a, I95) || 9) - (precioDe(b, I95) || 9)).slice(0, 150))}</section>` : ''}
${enlaces}
${h.hueco('articulo')}
${pregs.html}`;
      add(ruta, pg({ ruta, titulo, descripcion, cuerpo, schemas: [mm.schema, pregs.schema] }), tipo);
      return r;
    };
    const chipsProv = (base, cuenta) => `<section class="bloque"><h2>By province</h2><div class="enlaces">${datos.provincias.filter((p) => cuenta(p) > 0).map((p) => `<a href="${L(`${base}${p.slug}/`)}">${esc(p.nombre)} <small>${cuenta(p)}</small></a>`).join('')}</div></section>`;
    const quien = (e) => `${esc(marca(e))} at ${esc(e[C.dir])} (${esc(e[C.mun])})`;

    // ---- 24 hours ----
    const es24 = (e) => es24h(e[C.horario]);
    const n24 = (p) => p.estaciones.filter(es24).length;
    const todas24 = datos.estaciones.filter(es24);
    pagListado({
      ruta: '/gasolineras-24-horas/', tipo: 'general',
      migas: [['/gasolineras-24-horas/', '24-hour petrol stations']],
      h1: 'Cheapest 24-hour petrol stations in Spain today',
      sub: `The ${todas24.length.toLocaleString('en-GB')} petrol stations open 24 hours a day, ${hoy}, sorted by price.`,
      est: todas24,
      titulo: h.titulo(...h.conMarca('Cheapest 24-hour petrol stations in Spain today', '24-hour petrol stations in Spain')),
      descripcion: h.descripcion(`Cheapest petrol stations open 24 hours in Spain today, ${f.corto}.`, 'Find the cheapest one open at night in each province.'),
      faqs: (r) => [r.g95 && ['Which is the cheapest 24-hour petrol station in Spain?', `Today it is ${quien(r.g95.barata)}, with unleaded 95 at €${euro(r.g95.min)}/l.`],
        ['How many petrol stations are open 24 hours?', `There are ${todas24.length} petrol stations open 24 hours every day, according to the Ministry's data.`]],
      enlaces: chipsProv('/gasolineras-24-horas/', n24),
    });
    for (const p of datos.provincias) {
      const lista = p.estaciones.filter(es24);
      if (lista.length < 3) continue;
      pagListado({
        ruta: `/gasolineras-24-horas/${p.slug}/`, tipo: 'provincias',
        migas: [['/gasolineras-24-horas/', '24-hour petrol stations'], [`/gasolineras-24-horas/${p.slug}/`, p.nombre]],
        h1: `24-hour petrol stations in ${esc(p.nombre)}`,
        sub: `The ${lista.length} petrol stations in ${esc(p.nombre)} open 24 hours a day, ${hoy}, from cheapest to most expensive.`,
        est: lista,
        titulo: h.titulo(...h.conMarca(`24-hour petrol stations in ${p.nombre}: cheapest today`, `24-hour petrol stations ${p.nombre}`)),
        descripcion: h.descripcion(`Petrol stations open 24 hours in ${p.nombre}, Spain, today, ${f.corto}, sorted by price.`, `The ${lista.length} that never close.`),
        faqs: (r) => [r.g95 && [`Which is the cheapest 24-hour petrol station in ${p.nombre}?`, `${quien(r.g95.barata)}, with unleaded 95 at €${euro(r.g95.min)}/l today.`],
          [`How many 24-hour petrol stations are there in ${p.nombre}?`, `There are ${lista.length} petrol stations open 24 hours every day.`]],
        enlaces: `<p class="nota"><a href="${L(p.ruta)}">All petrol stations in ${esc(p.nombre)}</a> · <a href="${L(`/gasolineras-low-cost/${p.slug}/`)}">Low cost in ${esc(p.nombre)}</a></p>`,
      });
    }

    // ---- Low cost ----
    const nLc = (p) => p.estaciones.filter(esLowCost).length;
    const todasLc = datos.estaciones.filter(esLowCost);
    pagListado({
      ruta: '/gasolineras-low-cost/', tipo: 'general',
      migas: [['/gasolineras-low-cost/', 'Low-cost petrol stations']],
      h1: 'Cheapest low-cost petrol stations in Spain today',
      sub: `Low-cost, supermarket and independent petrol stations (not Repsol, Moeve/Cepsa, BP, Shell, Galp…), ${hoy}.`,
      est: todasLc,
      titulo: h.titulo(...h.conMarca('Cheapest low-cost petrol stations in Spain today', 'Low-cost petrol stations in Spain')),
      descripcion: h.descripcion(`Cheapest low-cost and independent petrol stations in Spain today, ${f.corto}: Ballenoil, Plenergy (Plenoil), Petroprix, supermarkets and more.`),
      faqs: (r) => [['What is a low-cost petrol station?', 'They are automated or small-brand petrol stations, often without a shop or staff, that usually sell cheaper than the big brands. The fuel meets the same quality standards.'],
        r.g95 && nac.g95 && ['How much cheaper is a low-cost petrol station?', `Today unleaded 95 costs €${euro(r.g95.media)}/l on average at these stations, compared with €${euro(nac.g95.media)}/l across Spain.`]],
      enlaces: chipsProv('/gasolineras-low-cost/', nLc),
    });
    for (const p of datos.provincias) {
      const lista = p.estaciones.filter(esLowCost);
      if (lista.length < 3) continue;
      pagListado({
        ruta: `/gasolineras-low-cost/${p.slug}/`, tipo: 'provincias',
        migas: [['/gasolineras-low-cost/', 'Low-cost petrol stations'], [`/gasolineras-low-cost/${p.slug}/`, p.nombre]],
        h1: `Low-cost petrol stations in ${esc(p.nombre)}`,
        sub: `The ${lista.length} low-cost, supermarket and independent petrol stations in ${esc(p.nombre)}, ${hoy}.`,
        est: lista,
        titulo: h.titulo(...h.conMarca(`Low-cost petrol stations in ${p.nombre} today`, `Low-cost petrol ${p.nombre}`)),
        descripcion: h.descripcion(`Cheapest low-cost petrol stations in ${p.nombre}, Spain, today, ${f.corto}.`, `${lista.length} petrol stations sorted by price.`),
        faqs: (r) => [r.g95 && [`Which is the cheapest low-cost petrol station in ${p.nombre}?`, `${quien(r.g95.barata)}, with unleaded 95 at €${euro(r.g95.min)}/l today.`]],
        enlaces: `<p class="nota"><a href="${L(p.ruta)}">All petrol stations in ${esc(p.nombre)}</a> · <a href="${L(`/gasolineras-24-horas/${p.slug}/`)}">24 hours in ${esc(p.nombre)}</a></p>`,
      });
    }

    // ---- Motorways and roads ----
    const NOMBRES = { 'A-1': 'Autovía del Norte', 'A-2': 'Autovía del Nordeste', 'A-3': 'Autovía del Este, Madrid–Valencia', 'A-4': 'Autovía del Sur', 'A-5': 'Autovía del Suroeste', 'A-6': 'Autovía del Noroeste', 'A-7': 'Autovía del Mediterráneo', 'AP-7': 'Autopista del Mediterráneo', 'A-8': 'Autovía del Cantábrico', 'A-31': 'Autovía de Alicante', 'A-23': 'Autovía Mudéjar', 'A-66': 'Autovía Ruta de la Plata', 'N-332': 'N-332 road', 'N-340': 'N-340 road' };
    const reVia = /(?:^|[^A-Z0-9])(AP|A|N|E)\s?-\s?(\d{1,3})(?![0-9])/;
    const pareceVia = /AUTOV|AUTOP|CARRET|CTRA|\bKM\b|KM\.?\s?\d|P\.?K\.?\s?\d|\bPK\b/;
    const vias = new Map();
    for (const e of datos.estaciones) {
      const d = String(e[C.dir] || '').toUpperCase();
      if (!pareceVia.test(d)) continue;
      const m = d.match(reVia);
      if (!m) continue;
      const cod = `${m[1]}-${+m[2]}`;
      const kmv = parseFloat(((d.match(/(?:KM|K\.M\.|P\.?K\.?)\s*\.?\s*(\d+(?:[.,]\d+)?)/) || [])[1] || '').replace(',', '.'));
      if (!vias.has(cod)) vias.set(cod, []);
      vias.get(cod).push({ e, km: isFinite(kmv) ? kmv : null });
    }
    const listaVias = [...vias.entries()].filter(([, l]) => l.length >= 5).sort((a, b) => b[1].length - a[1].length);
    for (const [cod, l] of listaVias) {
      const lista = l.map((x) => x.e);
      const ruta = `/carreteras/${slug(cod)}/`;
      const nombre = NOMBRES[cod] ? `${cod} (${NOMBRES[cod]})` : cod;
      const provs = [...new Set(lista.map((e) => datos.provMap.get(e[C.prov])?.nombre).filter(Boolean))];
      const conKm = l.filter((x) => x.km != null).sort((a, b) => a.km - b.km);
      const extra = conKm.length >= 3 ? `<section class="bloque"><h2>Petrol stations on the ${esc(cod)} by kilometre point</h2><div class="tabla-scroll"><table class="tabla"><thead><tr><th scope="col" class="num">Km</th><th scope="col">Petrol station</th><th scope="col" class="num">Unl. 95</th><th scope="col" class="num">Diesel</th></tr></thead><tbody>${conKm.map((x) => `<tr><td class="num">${x.km}</td><td><strong>${esc(marca(x.e))}</strong><span>${esc(x.e[C.mun])} (${esc(datos.provMap.get(x.e[C.prov])?.nombre || '')})</span></td><td class="num">${euro(precioDe(x.e, I95))}</td><td class="num">${euro(precioDe(x.e, IDIE))}</td></tr>`).join('')}</tbody></table></div><p class="nota">Sorted by kilometre point, based on the address reported to the Ministry.</p></section>` : '';
      pagListado({
        ruta, tipo: 'general',
        migas: [['/carreteras/', 'Motorways'], [ruta, cod]],
        h1: `Cheapest petrol stations on the ${esc(nombre)}`,
        sub: `${lista.length} petrol stations on the ${esc(cod)}${provs.length ? ` through ${esc(provs.slice(0, 6).join(', '))}${provs.length > 6 ? '…' : ''}` : ''}, with prices for ${hoy}.`,
        est: lista, extra,
        titulo: h.titulo(...h.conMarca(`Cheap petrol stations on the ${cod} today`, `${cod} petrol stations`)),
        descripcion: h.descripcion(`Cheapest petrol stations on the ${nombre} in Spain today, ${f.corto}, by kilometre point.`, 'Plan where to fill up on your journey.'),
        faqs: (r) => [r.g95 && [`Which is the cheapest petrol station on the ${cod}?`, `Today it is ${quien(r.g95.barata)}, with unleaded 95 at €${euro(r.g95.min)}/l.`],
          r.diesel && [`Where is the cheapest diesel on the ${cod}?`, `At ${esc(marca(r.diesel.barata))} (${esc(r.diesel.barata[C.mun])}), for €${euro(r.diesel.min)}/l.`]],
        enlaces: `<p class="nota">Work out what your journey will cost with the <a href="${L('/calculadora-gasolina-viaje/')}">fuel cost calculator</a>.</p>`,
      });
    }
    {
      const mm = h.migas([['/carreteras/', 'Motorways']]);
      const cuerpo = `${mm.html}
<header class="cabecera"><h1>Cheap petrol stations on Spanish motorways and roads</h1><p class="sub">Choose the road you are travelling on and see where to fill up for less, ${hoy}.</p></header>
${h.hueco('superior')}
<section class="bloque"><div class="enlaces">${listaVias.map(([cod, l]) => `<a href="${L(`/carreteras/${slug(cod)}/`)}">${esc(cod)}${NOMBRES[cod] ? ` · ${esc(NOMBRES[cod])}` : ''} <small>${l.length}</small></a>`).join('')}</div></section>`;
      add('/carreteras/', pg({ ruta: '/carreteras/', titulo: h.titulo(...h.conMarca('Cheap petrol stations on Spanish motorways and roads', 'Petrol stations on Spanish motorways')), descripcion: h.descripcion(`Cheapest petrol stations on the A-3, A-7, AP-7, A-4 and every other motorway and main road in Spain today, ${f.corto}.`), cuerpo, schemas: [mm.schema] }), 'general');
    }
  }

  // ================= ROUTE PLANNER =================
  {
    const m = h.migas([['/ruta/', 'Petrol stations on your route']]);
    const ejemplos = [['Málaga', 'Madrid'], ['Alicante', 'Valencia'], ['Barcelona', 'Madrid'], ['Santander', 'Madrid'], ['Bilbao', 'Barcelona'], ['Madrid', 'Valencia'], ['Valencia', 'Barcelona'], ['Sevilla', 'Málaga']];
    const pregs = h.faq([
      ['How do I find the cheapest petrol station on my journey?', 'Enter your starting point and destination, choose your fuel and how far you are willing to detour. We calculate the driving route and show you the cheapest station on the whole journey, plus where to stop so that you never drive more than the distance you choose between stops.'],
      ['Is it worth a detour to fill up for less?', `With a 2–3 km detour and a 10-cent difference per litre, you save about €5 on a 50-litre tank and spend less than €0.50 on the detour. Use the <a href="${L('/calculadora-gasolina-viaje/')}">calculator</a> for your own case.`],
      ['Where is it cheapest to fill up on a long drive in Spain?', 'Low-cost and supermarket petrol stations near motorway exits are usually cheaper than motorway service areas. Stations on toll motorways tend to be the most expensive.'],
    ]);
    const cuerpo = `${m.html}
<header class="cabecera"><h1>Cheapest petrol stations on your route</h1><p class="sub">Tell us where you are leaving from and where you are going, and we will show you where to fill up for less on the way, with prices for ${hoy}.</p></header>
<form class="ruta-form" id="rForm" autocomplete="off">
  <div class="inputwrap"><label for="rOrigen">From</label><input id="rOrigen" type="text" placeholder="E.g. Málaga" required></div>
  <div class="ruta-btns"><button type="button" class="linkbtn" id="rGps">Use my location</button><button type="button" class="linkbtn" id="rInvertir" aria-label="Swap start and destination">⇅ Swap</button></div>
  <div class="inputwrap"><label for="rDestino">To</label><input id="rDestino" type="text" placeholder="E.g. Madrid" required></div>
  <div class="ruta-opc">
    <label>Fuel<select id="rComb"></select></label>
    <label>Maximum detour<select id="rDesvio"><option value="0.1">100 m</option><option value="0.2">200 m</option><option value="1">1 km</option><option value="3" selected>3 km</option><option value="5">5 km</option><option value="10">10 km</option></select></label>
    <label>Stop at least every<select id="rTramo"><option value="50">50 km</option><option value="100" selected>100 km</option><option value="150">150 km</option><option value="200">200 km</option></select></label>
  </div>
  <button type="submit" class="btn">Find petrol stations on the route</button>
</form>
<p class="msg" id="rMsg" role="alert" hidden></p>
<div id="rRes" class="resultado"></div>
<div id="rMapa" class="mapa ruta-mapa" hidden></div>
${h.hueco('resultados')}
<section class="bloque"><h2>Popular routes</h2><div class="enlaces">${ejemplos.map(([o, d]) => `<a href="${L('/ruta/')}?o=${encodeURIComponent(o)}&amp;d=${encodeURIComponent(d)}">${esc(o)} → ${esc(d)}</a>`).join('')}</div></section>
<p class="nota">You can also see the petrol stations on each <a href="${L('/carreteras/')}">motorway and main road</a>.</p>
${pregs.html}`;
    add('/ruta/', pg({
      ruta: '/ruta/', rutaJs: true,
      titulo: h.titulo(...h.conMarca('Cheapest petrol stations on your route in Spain', 'Petrol stations on your route')),
      descripcion: h.descripcion('Plan your drive in Spain and find the cheapest petrol stations along the way, stop by stop, with today\'s official prices.', 'For example, from Málaga to Madrid.'),
      cuerpo,
      schemas: [m.schema, pregs.schema],
    }));
  }

  // ================= CALCULATOR =================
  {
    const m = h.migas([['/calculadora-gasolina-viaje/', 'Fuel cost calculator']]);
    const opciones = COMBUSTIBLES.filter((c) => nac[c.k]).map((c) => `<option value="${nac[c.k].media.toFixed(3)}">${c.en} (€${euro(nac[c.k].media)}/l)</option>`).join('');
    const pregs = h.faq([
      ['How do you work out the fuel cost of a journey?', 'Multiply the kilometres by your car\'s consumption and divide by 100: that gives you the litres. Then multiply the litres by the price of fuel. For example, 300 km in a car that uses 6 l/100 km is 18 litres; at €1.50/l, that is €27.'],
      ['How do I convert miles per gallon to litres per 100 km?', 'Divide 282.5 by your UK mpg figure. For example, 45 mpg is about 6.3 litres per 100 km. If your car shows US mpg, divide 235.2 by it instead.'],
      ['Is it worth driving further to a cheaper petrol station?', 'Only if the saving per litre, multiplied by the litres you will buy, is greater than the cost of the extra kilometres. The second calculator on this page does it for you.'],
    ]);
    const cuerpo = `${m.html}
<header class="cabecera"><h1>Fuel cost calculator for journeys</h1><p class="sub">Work out how much a car journey costs with today's average fuel price in Spain, and how much each person should pay.</p></header>
<section class="calc" id="calcViaje">
  <div class="campos">
    <label>Distance (km)<input type="number" id="cDist" inputmode="decimal" min="1" value="300"></label>
    <label class="check"><input type="checkbox" id="cIdaVuelta"> Return trip</label>
    <label>Consumption (litres/100 km)<input type="number" id="cCons" inputmode="decimal" min="1" step="0.1" value="6.5"></label>
    <label>Fuel<select id="cComb">${opciones}</select></label>
    <label>Price (€/l)<input type="number" id="cPrecio" inputmode="decimal" step="0.001" value="${nac.g95?.media.toFixed(3) || '1.500'}"></label>
    <label>People in the car<input type="number" id="cPers" inputmode="numeric" min="1" value="1"></label>
  </div>
  <div class="calc-res" aria-live="polite"><span>Journey cost</span><b id="rTotal">—</b><span id="rDetalle"></span></div>
</section>
${h.hueco('superior')}
<section class="calc" id="compensa">
  <h2>Is it worth driving further to a cheaper station?</h2>
  <div class="campos">
    <label>Litres you will buy<input type="number" id="kLitros" inputmode="decimal" value="40"></label>
    <label>Price at the nearby station (€/l)<input type="number" id="kCerca" inputmode="decimal" step="0.001" value="${(nac.g95 ? nac.g95.media + 0.05 : 1.55).toFixed(3)}"></label>
    <label>Price at the further station (€/l)<input type="number" id="kLejos" inputmode="decimal" step="0.001" value="${(nac.g95 ? nac.g95.media - 0.05 : 1.45).toFixed(3)}"></label>
    <label>Extra kilometres (there and back)<input type="number" id="kKm" inputmode="decimal" value="10"></label>
    <label>Consumption (litres/100 km)<input type="number" id="kCons" inputmode="decimal" step="0.1" value="6.5"></label>
  </div>
  <div class="calc-res" aria-live="polite"><span id="kTitulo">Net saving</span><b id="kRes">—</b><span id="kDet"></span></div>
  <p><a class="btn sec" href="${L('/')}">Find the cheapest petrol station near me</a></p>
</section>
${h.afiliado('seguro')}
${h.hueco('articulo')}
${pregs.html}`;
    add('/calculadora-gasolina-viaje/', pg({
      ruta: '/calculadora-gasolina-viaje/',
      titulo: h.titulo(...h.conMarca('Fuel cost calculator: what your journey costs in Spain', 'Fuel cost calculator for journeys')),
      descripcion: h.descripcion('Work out the fuel cost of a car journey in Spain with today\'s prices, how much each person pays and whether it is worth driving further to a cheaper station.'),
      cuerpo, calculadora: true,
      schemas: [m.schema, pregs.schema, {
        '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Fuel cost calculator for journeys', url: h.abs(L('/calculadora-gasolina-viaje/')),
        applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any', inLanguage: 'en-GB',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      }],
    }));
  }

  // ================= LEGAL =================
  // The Spanish version is the legally binding one; these pages are translations for information.
  const Lg = cfg.legal;
  const aviso = '<p class="nota">This is an English translation for information only. In case of discrepancy, the <a href="RUTA_ES">Spanish version</a> prevails.</p>';
  const legal = (ruta, titulo, descripcion, html) => add(ruta, pg({ ruta, titulo: `${titulo} | ${cfg.nombre}`, descripcion, actualizada: false, cuerpo: `<article class="texto"><h1>${titulo}</h1>${html}${ruta === '/sobre-nosotros/' ? '' : aviso.replace('RUTA_ES', ruta)}</article>` }), 'legal');

  legal('/sobre-nosotros/', 'About us', `About ${cfg.nombre} and how to contact us: a free search engine for cheap petrol stations in Spain using the official Ministry prices.`, `
<p>${esc(cfg.nombre)} is a free search engine to find the cheapest petrol station near you in Spain. We use the official prices that petrol stations report to the Spanish Ministry for the Ecological Transition and the Demographic Challenge, and update them several times a day.</p>
<p>The site is free for you because it is funded by advertising and by links to other companies' services, always labelled as advertising.</p>
<h2>Contact</h2>
<p>For any question, price error or suggestion, write to us at <b>${esc(cfg.emailContacto)}</b>. We reply in English or Spanish.</p>`);

  legal('/aviso-legal/', 'Legal notice', `Legal notice for ${cfg.nombre}: website owner, terms of use, source of the petrol station prices and sponsored links.`, `
<p>In accordance with Spanish Law 34/2002 on Information Society Services (LSSI):</p>
<ul><li>Owner: ${esc(Lg.titular)}</li><li>Tax ID (NIF): ${esc(Lg.nif)}</li><li>Address: ${esc(Lg.domicilio)}</li><li>Email: ${esc(cfg.emailContacto)}</li><li>Website: ${esc(cfg.url)}</li></ul>
<h2>Use of the website</h2><p>Price information comes from the Spanish Ministry for the Ecological Transition and the Demographic Challenge and is provided for information only. Prices may change at any time; the valid price is the one shown at the pump. We are not responsible for differences between published and actual prices.</p>
<h2>Intellectual property</h2><p>The design and texts of this website belong to its owner. Price data is public information that may be reused under the rules on re-use of public sector information.</p>
<h2>Links</h2><p>Some links lead to third-party websites, which have their own terms. Sponsored links are labelled as advertising.</p>`);

  legal('/privacidad/', 'Privacy policy', `Privacy policy of ${cfg.nombre}: what data we process (location, searches and preferences), on what legal basis and how to exercise your rights.`, `
<p>Last updated: ${esc(Lg.actualizado || f.texto)}.</p>
<h2>Data controller</h2><p>${esc(Lg.titular)} (NIF ${esc(Lg.nif)}), ${esc(Lg.domicilio)}, Spain. Contact: ${esc(cfg.emailContacto)}.</p>
<h2>What data we process</h2>
<ul>
<li><b>Your location</b>, only if you tap «Near me» and give permission. It is used in your browser to work out which petrol stations are near you and we do not store it. To show you the street name, the coordinates are sent to the Photon service (Komoot).</li>
<li><b>The addresses you type</b> in the search box, which are sent to Photon (Komoot) to locate them.</li>
<li><b>Your preferences</b> (last place searched, fuel, favourite petrol stations), which are stored only in your browser.</li>
<li><b>Usage statistics</b>: if you accept, Google Analytics records in aggregate which pages are visited, from what type of device and how the search is used, so we can improve the site. If you decline, no analytics cookies are stored.</li>
<li><b>Browsing and advertising data</b>: Google AdSense may use cookies and identifiers to show ads and measure their performance, always with your consent where the law requires it.</li>
</ul>
<h2>Legal basis</h2><p>Your consent for location, statistics and advertising cookies, and our legitimate interest in making the service work.</p>
<h2>Third parties</h2><p>Google (advertising and statistics, <a href="https://policies.google.com/technologies/ads?hl=en" rel="noopener" target="_blank">more information</a>), Komoot/Photon (address search) and OpenStreetMap (maps). Some of them may process data outside the European Economic Area with the safeguards provided for in the GDPR.</p>
<h2>Your rights</h2><p>You can access, rectify, erase, object to, restrict and port your data by writing to ${esc(cfg.emailContacto)}, and complain to the Spanish Data Protection Agency (aepd.es).</p>`);

  legal('/cookies/', 'Cookie policy', `Cookie policy of ${cfg.nombre}: what is stored in your browser, what cookies advertising uses and how to change your consent.`, `
<p>We use storage in your browser to remember your preferences (place, fuel and favourites). This is necessary for the search to work as you expect and does not require consent.</p>
<p>Our advertising partners (Google AdSense) use cookies to show ads, limit how many times you see each one and measure their performance. Personalised advertising cookies are only enabled if you give your consent in the notice shown when you arrive. You can change your choice at any time from «Manage cookies» at the bottom of the page.</p>
<p>If you accept, we use Google Analytics (cookies <code>_ga</code> and <code>_ga_*</code>, lasting up to 2 years) to obtain aggregate usage statistics. If you decline, Google Analytics works without cookies and without identifying you.</p>
<p>You can also delete or block cookies in your browser settings.</p>`);

  return paginas;
}
