// Piezas comunes de HTML: estructura de página, anuncios, afiliados, tablas, FAQ.
import { COMBUSTIBLES, C, precioDe, esc, euro, horarioCorto, es24h } from '../../src/comun.js';

export function crearHtml(cfg, ctx) {
  const base = cfg.url.replace(/\/$/, '');
  const abs = (ruta) => base + ruta;
  const { assets, datos } = ctx;
  const f = datos.fecha;

  // ---------- Título y descripción a la medida de Google ----------
  // Google corta los títulos de más de unos 60 caracteres y las descripciones de más de unos 155.
  const largo = (s) => [...s].length;
  // El primer candidato que quepa; si no cabe ninguno, el último
  const titulo = (...candidatos) => {
    const c = candidatos.filter(Boolean);
    return c.find((t) => largo(t) <= 60) || c[c.length - 1];
  };
  // Cada texto con el nombre de la web detrás y, si no cabe, sin él
  const conMarca = (...textos) => textos.flatMap((t) => [`${t} | ${cfg.nombre}`, t]);
  // Añade frases mientras quepan. La primera va siempre.
  const descripcion = (...frases) => frases.filter(Boolean).reduce((d, s) => (!d ? s : largo(`${d} ${s}`) <= 155 ? `${d} ${s}` : d), '');
  const gasolineras = (n) => (n === 1 ? '1 gasolinera' : `${n.toLocaleString('es-ES')} gasolineras`);

  // ---------- Anuncios ----------
  const hueco = (nombre, clase = '') => `<div class="ad ad-${nombre} ${clase}" data-hueco="${nombre}" aria-hidden="true"></div>`;

  function afiliado(id) {
    const a = (cfg.afiliados || []).find((x) => x.id === id);
    if (!a) return '';
    if (!a.url && !cfg.anuncios.modoPrueba) return '';
    const url = a.url || '#';
    return `<aside class="afil" data-afiliado="${esc(a.id)}">
      <span class="afil-et">${esc(a.etiqueta)} · Publicidad</span>
      <strong>${esc(a.titulo)}</strong>
      <p>${esc(a.texto)}</p>
      <a class="btn" href="${esc(url)}" rel="sponsored noopener" target="_blank">${esc(a.boton)}</a>
      ${a.url ? '' : '<small class="pend">Enlace de afiliado pendiente (solo visible en modo prueba)</small>'}
    </aside>`;
  }

  // ---------- Navegación y estructura ----------
  const nav = [
    ['/', 'Buscador'],
    ['/ruta/', 'Ruta'],
    ['/precio-gasolina-hoy/', 'Precio hoy'],
    ['/noticias/', 'Noticias'],
    ['/gasolineras/', 'Provincias'],
    ['/marcas/', 'Marcas'],
    ['/calculadora-gasolina-viaje/', 'Calculadora'],
  ];

  function migas(items) {
    if (!items?.length) return { html: '', schema: null };
    const todos = [['/', 'Inicio'], ...items];
    const html = `<nav class="migas" aria-label="Estás en">${todos.map(([r, t], i) => (i < todos.length - 1 ? `<a href="${r}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`)).join('<span aria-hidden="true">›</span>')}</nav>`;
    const schema = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: todos.map(([r, t], i) => ({ '@type': 'ListItem', position: i + 1, name: t, item: abs(r) })),
    };
    return { html, schema };
  }

  function faq(preguntas) {
    const ps = preguntas.filter(Boolean);
    if (!ps.length) return { html: '', schema: null };
    const html = `<section class="faq"><h2>Preguntas frecuentes</h2>${ps.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${a}</p></details>`).join('')}</section>`;
    const schema = {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: ps.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') } })),
    };
    return { html, schema };
  }

  const piePaginaProvincias = datos.provincias.map((p) => `<a href="${p.ruta}">${esc(p.nombre)}</a>`).join('');

  // actualizada: la página muestra precios del día (lleva dateModified con la hora de los datos)
  function pagina({ ruta, titulo, descripcion, cuerpo, schemas = [], noindex = false, actualizada = true, clase = '', buscador = false, calculadora = false, rutaJs = false, ogTipo = 'website', ogExtra = '' }) {
    const adsense = cfg.anuncios.adsenseCliente && !cfg.anuncios.modoPrueba
      ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(cfg.anuncios.adsenseCliente)}" crossorigin="anonymous"></script>`
      : '';
    // Google Analytics 4 con Consent Mode v2: todo denegado hasta que el usuario acepte en el aviso de cookies de Google.
    const ga4 = cfg.analitica?.ga4 || '';
    const analitica = ga4 ? `<script>
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});
try{if(localStorage.getItem('sb-analitica')==='si')gtag('consent','update',{analytics_storage:'granted'});}catch(e){}
gtag('set','ads_data_redaction',true);gtag('set','url_passthrough',true);
gtag('js',new Date());gtag('config','${esc(ga4)}');
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a');if(!a)return;
if(/google\\.[a-z.]+\\/maps/.test(a.href))gtag('event','como_llegar',{pagina:location.pathname});
else if(a.closest('[data-afiliado]'))gtag('event','clic_afiliado',{afiliado:a.closest('[data-afiliado]').dataset.afiliado});});
</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(ga4)}"></script>` : '';
    const webPage = !noindex && {
      '@context': 'https://schema.org', '@type': 'WebPage', '@id': abs(ruta), url: abs(ruta), name: titulo,
      description: descripcion, inLanguage: cfg.idioma || 'es-ES', isPartOf: { '@id': abs('/#web') },
      ...(actualizada ? { dateModified: f.isoCompleto || f.iso } : {}),
    };
    const ld = [webPage, ...schemas].filter(Boolean).map((s) => `<script type="application/ld+json">${JSON.stringify(s).replace(/</g, '\\u003c')}</script>`).join('');
    const cfgCliente = {
      nombre: cfg.nombre,
      anuncios: { modoPrueba: cfg.anuncios.modoPrueba, cliente: cfg.anuncios.adsenseCliente, bloques: cfg.anuncios.bloques },
      servicios: cfg.servicios,
      mapacss: assets.mapacss,
      fecha: f,
    };
    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${abs(ruta)}">\n<meta name="robots" content="index, follow, max-image-preview:large">`}
<meta property="og:type" content="${ogTipo}">${ogExtra}
<meta property="og:site_name" content="${esc(cfg.nombre)}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:url" content="${abs(ruta)}">
<meta property="og:image" content="${abs('/og.png')}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(cfg.nombre)}: gasolineras más baratas cerca de ti"><meta property="og:locale" content="es_ES">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0a55a6">
<link rel="icon" href="/icono.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icono-180.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="alternate" type="application/rss+xml" title="${esc(cfg.nombre)}: noticias" href="/noticias/rss.xml">
<link rel="preload" href="/fuentes/barlow-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fuentes/barlow-condensed-700.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${assets.css}">
${cfg.anuncios.adsenseCliente ? `<meta name="google-adsense-account" content="${esc(cfg.anuncios.adsenseCliente)}">` : ''}
${analitica}
${adsense}
${ld}
</head>
<body class="${clase}">
<a class="saltar" href="#contenido">Saltar al contenido</a>
<header class="cab">
  <div class="cab-in">
    <a class="marca" href="/" aria-label="${esc(cfg.nombre)}, inicio">${marcaHtml(cfg.nombre)}</a>
    <nav class="menu" aria-label="Principal">${nav.map(([r, t]) => `<a href="${r}"${r === ruta || (r !== '/' && ruta.startsWith(r)) ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
  </div>
</header>
<main id="contenido" class="wrap">
${cuerpo}
</main>
${noindex ? '' : `<aside class="wrap compartir-pag"><a class="wa" href="https://wa.me/?text=${encodeURIComponent(titulo + ' ' + abs(ruta))}" target="_blank" rel="noopener" onclick="window.gtag&&gtag('event','compartir',{metodo:'whatsapp_pagina'})">Enviar por WhatsApp</a><a class="tg" href="https://t.me/share/url?url=${encodeURIComponent(abs(ruta))}&amp;text=${encodeURIComponent(titulo)}" target="_blank" rel="noopener" onclick="window.gtag&&gtag('event','compartir',{metodo:'telegram_pagina'})">Telegram</a></aside>`}
<footer class="pie">
  <div class="wrap">
    <p class="pie-titulo">Gasolineras más baratas por provincia</p>
    <nav class="pie-prov" aria-label="Búsquedas"><a href="/gasolineras-24-horas/">Gasolineras 24 horas</a><a href="/gasolineras-low-cost/">Gasolineras low cost</a><a href="/carreteras/">Gasolineras en autovías</a><a href="/marcas/">Precios por marca</a><a href="/precio-gasolina-hoy/">Precio gasolina hoy</a><a href="/noticias/">Noticias</a></nav>
    <nav class="pie-prov" aria-label="Provincias">${piePaginaProvincias}</nav>
    <p>Precios oficiales del <a href="https://geoportalgasolineras.es/" rel="noopener" target="_blank">Ministerio para la Transición Ecológica y el Reto Demográfico</a>, actualizados el ${esc(f.texto)}${f.hora ? ' a las ' + f.hora : ''}. Las gasolineras pueden haber cambiado el precio después: compruébalo en el surtidor.</p>
    <nav class="pie-legal" aria-label="Legal">
      <a href="/sobre-nosotros/">Quiénes somos y contacto</a>
      <a href="/aviso-legal/">Aviso legal</a>
      <a href="/privacidad/">Privacidad</a>
      <a href="/cookies/">Cookies</a>
      <button type="button" class="linkbtn" id="gestionarCookies" hidden>Gestionar cookies</button>
    </nav>
  </div>
</footer>
<script>window.SITIO=${JSON.stringify(cfgCliente).replace(/</g, '\\u003c')};</script>
<script type="module" src="${assets.anuncios}"></script>
${buscador ? `<script type="module" src="${assets.app}"></script>` : ''}
${calculadora ? `<script type="module" src="${assets.calculadora}"></script>` : ''}
${rutaJs ? `<script type="module" src="${assets.ruta}"></script>` : ''}
<script>if('serviceWorker' in navigator){addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}</script>
</body>
</html>`;
  }

  // ---------- Bloques de datos ----------
  const flecha = (d) => {
    if (d == null || Math.abs(d) < 0.0005) return '<span class="var igual">= igual que ayer</span>';
    const c = Math.abs(d * 100).toFixed(1).replace('.', ',');
    return d > 0 ? `<span class="var sube">▲ ${c} cts vs. ayer</span>` : `<span class="var baja">▼ ${c} cts vs. ayer</span>`;
  };
  const vs = (a, b, frase) => {
    if (a == null || b == null) return '';
    const d = a - b;
    if (Math.abs(d) < 0.0005) return `<span class="var igual">igual que ${frase}</span>`;
    const c = Math.abs(d * 100).toFixed(1).replace('.', ',');
    return d > 0 ? `<span class="var sube">${c} cts más que ${frase}</span>` : `<span class="var baja">${c} cts menos que ${frase}</span>`;
  };

  // Tarjetas con precio medio por combustible
  function medias(resumen, { ayer = null, comparar = null, fraseComparar = 'la media de España', solo = null } = {}) {
    const lista = COMBUSTIBLES.filter((c) => resumen[c.k] && (!solo || solo.includes(c.k)));
    return `<div class="medias">${lista.map((c) => {
      const r = resumen[c.k];
      const extra = ayer ? flecha(ayer[c.k] != null ? r.media - ayer[c.k] : null)
        : comparar ? vs(r.media, comparar[c.k]?.media, fraseComparar) : '';
      return `<div class="media"><span class="media-n">${c.nombre}</span><b>${euro(r.media)}<small> €/l</small></b>${extra}<span class="media-r">Desde ${euro(r.min)} · ${gasolineras(r.n)}</span></div>`;
    }).join('')}</div>`;
  }

  const ruta = (e) => `https://www.google.com/maps/dir/?api=1&destination=${e[C.lat]},${e[C.lon]}`;
  const lugarDe = (e) => {
    const p = datos.provMap.get(e[C.prov]);
    const m = p?.municipios.get(e[C.munId]);
    return m ? `<a href="${m.ruta}">${esc(e[C.mun])}</a>` : esc(e[C.mun]);
  };

  // Ranking de las más baratas para un combustible
  function ranking(estaciones, i, { conLugar = true, n = 10 } = {}) {
    const lista = estaciones.filter((e) => precioDe(e, i)).sort((a, b) => precioDe(a, i) - precioDe(b, i)).slice(0, n);
    if (!lista.length) return '<p class="nota">No hay gasolineras con este combustible.</p>';
    return `<ol class="rank">${lista.map((e, k) => `<li>
      <span class="rank-n">${k + 1}</span>
      <div class="rank-d"><strong>${esc(e[C.marca])}</strong><span>${esc(e[C.dir])}${conLugar ? ', ' + lugarDe(e) : ''}</span><span class="rank-m">${es24h(e[C.horario]) ? '<span class="pill">24 h</span>' : esc(horarioCorto(e[C.horario]))} · <a href="${ruta(e)}" target="_blank" rel="noopener">Cómo llegar</a></span></div>
      <b class="rank-p">${euro(precioDe(e, i))}</b>
    </li>`).join('')}</ol>`;
  }

  // Tabla completa con todos los combustibles
  function tablaEstaciones(estaciones, { orden = 0 } = {}) {
    const cols = COMBUSTIBLES.map((c, i) => ({ ...c, i })).filter((c) => estaciones.some((e) => precioDe(e, c.i)));
    const lista = [...estaciones].sort((a, b) => (precioDe(a, orden) || 9) - (precioDe(b, orden) || 9));
    const minimos = cols.map((c) => Math.min(...estaciones.map((e) => precioDe(e, c.i) || 99)));
    return `<div class="tabla-scroll"><table class="tabla">
      <thead><tr><th scope="col">Gasolinera</th>${cols.map((c) => `<th scope="col" class="num">${c.corto}</th>`).join('')}</tr></thead>
      <tbody>${lista.map((e) => `<tr>
        <td><strong>${esc(e[C.marca])}</strong><span>${esc(e[C.dir])}</span><span class="t-m">${es24h(e[C.horario]) ? '<span class="pill">24 h</span>' : esc(horarioCorto(e[C.horario]))} · <a href="${ruta(e)}" target="_blank" rel="noopener">Cómo llegar</a></span></td>
        ${cols.map((c, k) => { const p = precioDe(e, c.i); return `<td class="num${p && p === minimos[k] ? ' mejor' : ''}">${p ? euro(p) : '—'}</td>`; }).join('')}
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  // Esquema de datos estructurados de gasolineras
  function schemaGasolineras(estaciones, nombreLista) {
    return {
      '@context': 'https://schema.org', '@type': 'ItemList', name: nombreLista,
      itemListElement: estaciones.slice(0, 30).map((e, k) => ({
        '@type': 'ListItem', position: k + 1,
        item: {
          '@type': 'GasStation', name: `${e[C.marca]} ${e[C.dir]}`,
          address: { '@type': 'PostalAddress', streetAddress: e[C.dir], addressLocality: e[C.mun], postalCode: e[C.cp], addressCountry: 'ES' },
          geo: { '@type': 'GeoCoordinates', latitude: e[C.lat], longitude: e[C.lon] },
          ...(es24h(e[C.horario]) ? { openingHours: 'Mo-Su 00:00-23:59' } : {}),
        },
      })),
    };
  }

  const enlaceBuscador = (lat, lon, etiqueta) => `/?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&l=${encodeURIComponent(etiqueta)}`;

  return { titulo, conMarca, descripcion, gasolineras, pagina, hueco, afiliado, migas, faq, medias, ranking, tablaEstaciones, schemaGasolineras, enlaceBuscador, vs, flecha, abs };
}

export function marcaHtml(nombre) {
  const p = nombre.trim().split(/\s+/);
  const u = p.length > 1 ? p.pop() : '';
  return `${esc(p.join(' '))}${u ? ` <span>${esc(u)}</span>` : ''}`;
}
