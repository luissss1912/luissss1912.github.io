// Gráfico de líneas en SVG generado en el servidor (sin librerías, carga instantánea).
const fmt = (v) => v.toFixed(3).replace('.', ',');
const dia = (iso) => { const [, m, d] = iso.split('-'); return `${+d}/${+m}`; };

export function graficoLineas(series, { alto = 220, ancho = 640 } = {}) {
  const puntos = series.flatMap((s) => s.datos.map((d) => d.v));
  const fechas = [...new Set(series.flatMap((s) => s.datos.map((d) => d.f)))].sort();
  if (fechas.length < 2 || !puntos.length) return '';
  const m = { t: 14, r: 56, b: 26, l: 48 };
  let min = Math.min(...puntos), max = Math.max(...puntos);
  const pad = Math.max((max - min) * 0.15, 0.005);
  min -= pad; max += pad;
  const x = (f) => m.l + (fechas.indexOf(f) / (fechas.length - 1)) * (ancho - m.l - m.r);
  const y = (v) => m.t + (1 - (v - min) / (max - min)) * (alto - m.t - m.b);

  const ticks = [];
  const paso = (max - min) / 4;
  for (let i = 0; i <= 4; i++) ticks.push(min + paso * i);
  const etiquetasX = [fechas[0], fechas[Math.floor((fechas.length - 1) / 2)], fechas[fechas.length - 1]];

  let svg = `<svg class="grafico" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Evolución del precio medio">`;
  for (const t of ticks) svg += `<line x1="${m.l}" x2="${ancho - m.r}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" class="g-rejilla"/><text x="${m.l - 6}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end" class="g-eje">${fmt(t)}</text>`;
  for (const f of etiquetasX) svg += `<text x="${x(f).toFixed(1)}" y="${alto - 6}" text-anchor="middle" class="g-eje">${dia(f)}</text>`;
  series.forEach((s, i) => {
    const d = s.datos.map((p, j) => `${j ? 'L' : 'M'}${x(p.f).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
    const u = s.datos[s.datos.length - 1];
    svg += `<path d="${d}" class="g-linea g-s${i}" fill="none"/>`;
    svg += `<circle cx="${x(u.f).toFixed(1)}" cy="${y(u.v).toFixed(1)}" r="3.5" class="g-punto g-s${i}"/>`;
    svg += `<text x="${(x(u.f) + 7).toFixed(1)}" y="${(y(u.v) + 4).toFixed(1)}" class="g-valor g-s${i}">${fmt(u.v)}</text>`;
  });
  svg += '</svg>';
  const leyenda = series.map((s, i) => `<span class="g-ley g-s${i}">${s.nombre}</span>`).join('');
  return `<figure class="figgrafico">${svg}<figcaption>${leyenda}</figcaption></figure>`;
}
