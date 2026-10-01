import L from 'leaflet';

let mapa, capa;

// Verde (más barata) → ámbar → rojo (más cara)
function color(t) {
  const p = [[22, 150, 90], [240, 170, 30], [205, 60, 45]];
  const x = Math.min(1, Math.max(0, t)) * 2;
  const i = Math.min(1, Math.floor(x)), f = x - i;
  return `rgb(${p[i].map((v, k) => Math.round(v + (p[i + 1][k] - v) * f)).join(',')})`;
}

export function pintarMapa(el, servicios, lugar, radioKm, resultados, popup) {
  if (!mapa) {
    mapa = L.map(el, { scrollWheelZoom: false });
    L.tileLayer(servicios.mapa, { maxZoom: 19, attribution: servicios.mapaAtribucion }).addTo(mapa);
    capa = L.layerGroup().addTo(mapa);
  }
  mapa.invalidateSize();
  capa.clearLayers();
  const centro = [lugar.lat, lugar.lon];
  L.circle(centro, { radius: radioKm * 1000, color: '#0a55a6', weight: 1, fillOpacity: 0.04, interactive: false }).addTo(capa);
  L.marker(centro, { icon: L.divIcon({ className: '', html: '<div class="pin-yo"></div>', iconSize: [16, 16] }), interactive: false, zIndexOffset: 1000 }).addTo(capa);
  if (resultados.length) {
    const ps = resultados.map((r) => r.precio);
    const min = Math.min(...ps), max = Math.max(...ps);
    [...resultados].sort((a, b) => b.precio - a.precio).forEach((r) => {
      L.circleMarker([r.lat, r.lon], {
        radius: r.precio === min ? 11 : 8, color: '#fff', weight: 2,
        fillColor: color(max > min ? (r.precio - min) / (max - min) : 0), fillOpacity: 0.95,
      }).bindPopup(popup(r)).addTo(capa);
    });
  }
  mapa.fitBounds(L.latLng(centro).toBounds(radioKm * 2000), { padding: [10, 10] });
}
