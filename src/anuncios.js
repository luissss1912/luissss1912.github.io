// Rellena los huecos de publicidad (AdSense) y gestiona el botón de cookies.
const cfg = window.SITIO?.anuncios || {};

function rellenar(raiz = document) {
  raiz.querySelectorAll('[data-hueco]:not([data-listo])').forEach((el) => {
    el.dataset.listo = '1';
    const nombre = el.dataset.hueco;
    const bloque = cfg.bloques?.[nombre];
    if (cfg.modoPrueba) {
      el.classList.add('prueba');
      el.textContent = `Anuncio (${nombre})`;
      return;
    }
    if (!cfg.cliente || !bloque) return; // sin bloque configurado: lo cubren los anuncios automáticos
    el.classList.add('lleno');
    el.innerHTML = `<ins class="adsbygoogle" style="display:block;width:100%" data-ad-client="${cfg.cliente}" data-ad-slot="${bloque}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (err) { console.warn('AdSense', err); }
  });
}

window.rellenarAnuncios = rellenar;
rellenar();

// Botón «Gestionar cookies» (mensaje de consentimiento de Google)
if (cfg.cliente && !cfg.modoPrueba) {
  const b = document.getElementById('gestionarCookies');
  if (b) {
    b.hidden = false;
    b.addEventListener('click', () => {
      window.googlefc = window.googlefc || {};
      window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
      window.googlefc.callbackQueue.push({ CONSENT_API_READY: () => window.googlefc.showRevocationMessage() });
    });
  }
}
