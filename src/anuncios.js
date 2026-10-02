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

// Consentimiento de estadísticas (Google Analytics).
// Mientras el aviso de Google (CMP de AdSense) no esté activo, mostramos un aviso propio
// solo para las cookies de análisis. Cuando el aviso de Google funcione, él gestiona todo.
const CLAVE = 'sb-analitica';
const leerEleccion = () => { try { return localStorage.getItem(CLAVE); } catch { return null; } };
const guardarEleccion = (v) => { try { localStorage.setItem(CLAVE, v); } catch {} };

// El aviso de Google está activo si se está mostrando o si el usuario ya decidió en él.
// (Antes de que AdSense apruebe la web, el CMP carga pero no muestra nada.)
function cmpGoogleActivo() {
  return new Promise((res) => {
    if (typeof window.__tcfapi !== 'function') return res(false);
    const fin = setTimeout(() => res(false), 2000);
    try {
      window.__tcfapi('ping', 2, (p) => {
        if (p && p.displayStatus === 'visible') { clearTimeout(fin); return res(true); }
        window.__tcfapi('addEventListener', 2, (d, ok) => {
          clearTimeout(fin);
          res(!!(ok && d && d.tcString));
          if (d && d.listenerId != null) try { window.__tcfapi('removeEventListener', 2, () => {}, d.listenerId); } catch {}
        });
      });
    } catch { clearTimeout(fin); res(false); }
  });
}

function avisoAnalitica() {
  if (document.getElementById('avisoCookies')) return;
  const d = document.createElement('div');
  d.id = 'avisoCookies';
  d.className = 'aviso-cookies';
  d.setAttribute('role', 'dialog');
  d.setAttribute('aria-label', 'Cookies de estadísticas');
  d.innerHTML = `<p>Usamos cookies de estadísticas (Google Analytics) para saber cuánta gente usa la web y mejorarla. No se usan para publicidad. <a href="/cookies/">Más información</a></p>
  <div class="aviso-botones"><button type="button" class="btn-sec" data-v="no">Rechazar</button><button type="button" class="btn-pri" data-v="si">Aceptar</button></div>`;
  d.addEventListener('click', (e) => {
    const v = e.target.closest('button')?.dataset.v;
    if (!v) return;
    guardarEleccion(v);
    window.gtag?.('consent', 'update', { analytics_storage: v === 'si' ? 'granted' : 'denied' });
    d.remove();
  });
  document.body.appendChild(d);
}

if (cfg.cliente && !cfg.modoPrueba) {
  const b = document.getElementById('gestionarCookies');
  if (b) b.hidden = false;
  const listo = (fn) => (document.readyState === 'complete' ? fn() : addEventListener('load', fn));
  listo(() => setTimeout(async () => {
    const google = await cmpGoogleActivo();
    if (!google && window.gtag && leerEleccion() === null) avisoAnalitica();
  }, 2500));
  b?.addEventListener('click', async () => {
    if (await cmpGoogleActivo()) {
      window.googlefc = window.googlefc || {};
      window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
      window.googlefc.callbackQueue.push({ CONSENT_API_READY: () => window.googlefc.showRevocationMessage() });
    } else {
      avisoAnalitica();
    }
  });
}
