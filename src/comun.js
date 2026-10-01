// Utilidades compartidas entre el generador (Node) y el buscador (navegador).

export const COMBUSTIBLES = [
  { k: 'g95', nombre: 'Gasolina 95', corto: 'Gasolina 95', campo: 'Precio Gasolina 95 E5' },
  { k: 'diesel', nombre: 'Diésel', corto: 'Diésel', campo: 'Precio Gasoleo A' },
  { k: 'g98', nombre: 'Gasolina 98', corto: 'Gasolina 98', campo: 'Precio Gasolina 98 E5' },
  { k: 'dieselplus', nombre: 'Diésel Premium', corto: 'Diésel+', campo: 'Precio Gasoleo Premium' },
  { k: 'glp', nombre: 'Autogás (GLP)', corto: 'GLP', campo: 'Precio Gases licuados del petróleo' },
];

// Posiciones en el array compacto de cada gasolinera
export const C = { id: 0, marca: 1, dir: 2, mun: 3, munId: 4, prov: 5, cp: 6, lat: 7, lon: 8, horario: 9, precios: 10 };
export const precioDe = (e, i) => e[C.precios + i] || 0;

const MINUS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'a', 'en', 'o', 'u', 'al', 'd', 'i', 'les', 'dels', 'da', 'do', 'das', 'dos']);

export function titulo(s) {
  if (!s) return '';
  const t = String(s).toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
  let primera = true;
  return t.replace(/[\p{L}\p{N}ºª'’.]+/gu, (w) => {
    const r = !primera && MINUS.has(w) ? w : w.charAt(0).toLocaleUpperCase('es') + w.slice(1);
    primera = false;
    return r;
  }).replace(/\b([A-Za-z]{1,3})-(\d+)\b/g, (m, a, n) => `${a.toUpperCase()}-${n}`) // carreteras: A-4, M-406, AP-7
    .replace(/(^|[\s(])([ld])['’](\p{L})/giu, (m, s, a, b) => `${s}${s === '' ? a.toUpperCase() : a.toLowerCase()}'${b.toUpperCase()}`); // L'Hospitalet, d'Alacant
}

// "Palmas de Gran Canaria (Las)" -> "Las Palmas de Gran Canaria"; "VALENCIA / VALÈNCIA" -> "Valencia"
export function nombreLugar(s) {
  if (!s) return '';
  let t = String(s).split(/\s*\/\s*/)[0].trim(); // "Elche/Elx" -> "Elche"
  const m = /^(.*)\s*\((el|la|los|las|l'|els|les|o|a|os|as|illes)\)$/i.exec(t);
  if (m) t = `${m[2]}${m[2].endsWith("'") ? '' : ' '}${m[1].trim()}`;
  return titulo(t);
}

export function slug(s) {
  return String(s)
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const SIGLAS = new Set(['BP', 'GM', 'AN', 'CAMPSA', 'Q8', 'E.LECLERC', 'TGAS', 'ESSO']);
export function nombreMarca(r) {
  const t = String(r || '').trim();
  if (!t || /^\(?(sin r[oó]tulo|ninguno|no tiene|s\/r|-+|\.)\)?$/i.test(t)) return 'Gasolinera independiente';
  const up = t.toUpperCase();
  if (SIGLAS.has(up) || (up.length <= 3 && /^[A-Z0-9]+$/.test(up))) return up;
  return titulo(t);
}

export const euro = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(d).replace('.', ','));
export const km = (d) => (d < 1 ? Math.round(d * 1000) + ' m' : d.toFixed(1).replace('.', ',') + ' km');
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function distancia(a, b, c, d) {
  const R = 6371, r = Math.PI / 180;
  const x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// ---------- Horarios del Ministerio ----------
// Ejemplos: "L-D: 24H", "L-V: 06:00-22:00; S: 07:00-15:00", "L-S: 07:00-22:00; D: 08:00-14:00"
const DIAS = 'LMXJVSD';
export const es24h = (h) => /L-D:\s*(24H|00:00\s*-\s*(23:59|24:00))/i.test(h || '');

function rangoDias(txt) {
  const out = new Set();
  for (const parte of txt.split(',')) {
    const m = /^\s*([LMXJVSD])(?:\s*-\s*([LMXJVSD]))?\s*$/.exec(parte.toUpperCase());
    if (!m) return null;
    const a = DIAS.indexOf(m[1]), b = m[2] ? DIAS.indexOf(m[2]) : a;
    for (let i = a; ; i = (i + 1) % 7) { out.add(i); if (i === b) break; }
  }
  return out;
}

// Devuelve true (abierta), false (cerrada) o null (no se sabe)
export function abiertaAhora(horario, fecha = new Date()) {
  if (!horario) return null;
  const dia = (fecha.getDay() + 6) % 7; // 0 = lunes
  const min = fecha.getHours() * 60 + fecha.getMinutes();
  let entendido = false;
  for (const tramo of horario.split(';')) {
    const m = /^\s*([LMXJVSD,\s-]+):\s*(.+)$/i.exec(tramo);
    if (!m) continue;
    const dias = rangoDias(m[1]);
    if (!dias) continue;
    entendido = true;
    if (!dias.has(dia)) continue;
    if (/24H/i.test(m[2])) return true;
    for (const r of m[2].matchAll(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g)) {
      const ini = +r[1] * 60 + +r[2];
      let fin = +r[3] * 60 + +r[4];
      if (fin <= ini) fin += 24 * 60;
      if ((min >= ini && min < fin) || (min + 1440 >= ini && min + 1440 < fin)) return true;
    }
  }
  return entendido ? false : null;
}

export function horarioCorto(h) {
  if (!h) return '';
  if (es24h(h)) return '24 horas';
  return h.replace(/\s+/g, ' ').replace(/;\s*/g, ' · ');
}
