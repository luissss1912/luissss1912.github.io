const $ = (id) => document.getElementById(id);
const n = (id) => parseFloat(String($(id)?.value || '').replace(',', '.')) || 0;
const EN = window.SITIO?.lang === 'en';
const loc = EN ? 'en-GB' : 'es-ES';
const eur = (v, d = 2) => (EN ? '€' + v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d }) : v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d }) + ' €');

function viaje() {
  const km = n('cDist') * ($('cIdaVuelta').checked ? 2 : 1);
  const litros = (km * n('cCons')) / 100;
  const total = litros * n('cPrecio');
  const pers = Math.max(1, Math.round(n('cPers')));
  $('rTotal').textContent = km > 0 ? eur(total) : '—';
  $('rDetalle').textContent = km <= 0 ? (EN ? 'Enter the distance' : 'Escribe la distancia')
    : EN ? `${litros.toLocaleString(loc, { maximumFractionDigits: 1 })} litres for ${km.toLocaleString(loc)} km${pers > 1 ? ` · ${eur(total / pers)} per person` : ''}`
    : `${litros.toLocaleString(loc, { maximumFractionDigits: 1 })} litros para ${km.toLocaleString(loc)} km${pers > 1 ? ` · ${eur(total / pers)} por persona` : ''}`;
}

function compensa() {
  const ahorro = n('kLitros') * (n('kCerca') - n('kLejos'));
  const gastoExtra = ((n('kKm') * n('kCons')) / 100) * n('kLejos');
  const neto = ahorro - gastoExtra;
  $('kTitulo').textContent = EN ? (neto >= 0 ? 'Worth it. Net saving' : 'Not worth it. You lose') : neto >= 0 ? 'Sí compensa. Ahorro neto' : 'No compensa. Pierdes';
  $('kRes').textContent = eur(Math.abs(neto));
  $('kDet').textContent = EN ? `You save ${eur(ahorro)} on the fill-up and spend ${eur(gastoExtra)} on the ${n('kKm')} extra km.` : `Ahorras ${eur(ahorro)} en el depósito y gastas ${eur(gastoExtra)} en los ${n('kKm')} km extra.`;
}

$('cComb')?.addEventListener('change', (e) => { $('cPrecio').value = e.target.value; viaje(); });
document.querySelectorAll('#calcViaje input').forEach((el) => el.addEventListener('input', viaje));
document.querySelectorAll('#compensa input').forEach((el) => el.addEventListener('input', compensa));
viaje();
compensa();
