// Idiomas de la web: direcciones equivalentes en español e inglés y fechas en inglés.
// La versión en inglés vive en /en/ con direcciones traducidas. Las noticias solo existen en español.

// Prefijos de las direcciones en español -> en inglés (el orden importa: los más largos primero)
const PREFIJOS = [
  ['/precio-gasolina-hoy/', '/en/fuel-prices-today/'],
  ['/gasolineras-24-horas/', '/en/24-hour-petrol-stations/'],
  ['/gasolineras-low-cost/', '/en/low-cost-petrol-stations/'],
  ['/gasolineras/', '/en/petrol-stations/'],
  ['/marcas/', '/en/brands/'],
  ['/carreteras/', '/en/motorways/'],
  ['/ruta/', '/en/route-planner/'],
  ['/calculadora-gasolina-viaje/', '/en/fuel-cost-calculator/'],
  ['/sobre-nosotros/', '/en/about/'],
  ['/aviso-legal/', '/en/legal-notice/'],
  ['/privacidad/', '/en/privacy/'],
  ['/cookies/', '/en/cookies/'],
];

// Dirección en inglés de una página en español, o null si no tiene versión en inglés
export function rutaEn(ruta) {
  if (ruta == null) return null;
  const [camino, query = ''] = String(ruta).split(/(?=[?#])/);
  if (camino === '/') return '/en/' + query;
  for (const [es, en] of PREFIJOS) if (camino.startsWith(es)) return en + camino.slice(es.length) + query;
  return null;
}

// Dirección en español de una página en inglés, o null
export function rutaEs(ruta) {
  if (ruta == null) return null;
  const [camino, query = ''] = String(ruta).split(/(?=[?#])/);
  if (camino === '/en/') return '/' + query;
  for (const [es, en] of PREFIJOS) if (camino.startsWith(en)) return es + camino.slice(en.length) + query;
  return null;
}

// Fechas en inglés británico a partir de la fecha de los datos ({ iso, hora })
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function fechaEn(f) {
  const [y, m, d] = f.iso.split('-').map(Number);
  return { ...f, texto: `${d} ${MONTHS[m - 1]} ${y}`, corto: `${d} ${MONTHS[m - 1].slice(0, 3)}` };
}
