# Web de gasolineras baratas: guía para ponerla en marcha

## Mañana, paso a paso

### Paso 1. Verla funcionando en tu PC (10 minutos)
1. Instala **Node.js** desde https://nodejs.org (botón «LTS», siguiente, siguiente…).
2. Descomprime esta carpeta en un sitio fácil, por ejemplo `Documentos\gasolineras`.
3. Doble clic en **`1-VER-LA-WEB.bat`**. Hace esto:
   - instala lo necesario (solo la primera vez, tarda 1 o 2 minutos),
   - descarga los precios de hoy de las cerca de 12.000 gasolineras de España,
   - genera todas las páginas y abre la web en tu navegador (http://localhost:8080).
4. Pruébalo todo: «Cerca de mí», escribir tu calle o tu pueblo, los filtros, el mapa, las páginas de tu provincia y tu municipio, y la calculadora.

Los recuadros grises que pone «Anuncio (…)» son los huecos donde saldrán los anuncios. Los cuadros amarillos son los enlaces de afiliado.

### Paso 2. Decidir nombre y dominio
- Busca un dominio libre (.es o .com, unos 10 €/año en DonDominio, Namecheap o Cloudflare). Mejor si lleva palabras clave, por ejemplo `gasolinabarata…`, `surtidor…` o `repostar…`.
- Abre **`sitio.config.json`** con el Bloc de notas y cambia:
  - `nombre` → el nombre de la web.
  - `url` → `https://www.tudominio.es`
  - `emailContacto` → un correo para la web.
  - `legal` → tu nombre, NIF y domicilio. La LSSI obliga a ponerlo en una web con anuncios.

### Paso 3. Publicarla gratis con GitHub (se actualiza sola cada 2 horas)
1. Crea una cuenta en https://github.com.
2. Instala **GitHub Desktop** (https://desktop.github.com), entra con tu cuenta y elige *File > Add local repository*, apuntando a esta carpeta. Si te pregunta, pulsa *create a repository*.
3. Pulsa **Publish repository**. Puede ser público: no hay nada secreto.
4. En la web de GitHub, entra en tu repositorio y ve a *Settings > Pages*. En *Source* elige **GitHub Actions**.
5. Ve a la pestaña *Actions*, elige **Publicar web** y pulsa **Run workflow**. En 2 o 3 minutos la web está publicada.
6. Dominio: en *Settings > Pages > Custom domain* escribe tu dominio y sigue las instrucciones para configurar el DNS en tu proveedor de dominio.

A partir de ahí GitHub descarga los precios y regenera la web **cada 2 horas**, sin que hagas nada.

> **Plan B:** si en *Actions* el paso «Generar la web» falla porque el Ministerio no responde a GitHub, publica desde tu PC con Cloudflare Pages. Doble clic en `2-PUBLICAR-DESDE-MI-PC.bat`: la primera vez te pide entrar en Cloudflare, que es gratis. Después, con `3-PROGRAMAR-PUBLICACION.bat` se publica sola cada 2 horas mientras el PC esté encendido.

### Paso 4. Activar los ingresos
**Google AdSense** (anuncios):
1. Con la web ya publicada en tu dominio, date de alta en https://adsense.google.com y añade tu dominio.
2. Copia tu ID de editor (`ca-pub-…`) en `adsenseCliente` y pon `"modoPrueba": false` en `sitio.config.json`. Sube el cambio (GitHub Desktop: *Commit* y *Push*).
3. En AdSense:
   - Activa los **anuncios automáticos**.
   - Activa el **mensaje de consentimiento RGPD** en *Privacidad y mensajes*. Es obligatorio en Europa, y la web ya tiene el botón «Gestionar cookies».
   - Cuando te aprueben, crea bloques de anuncio «display» y pega sus números en `bloques` para rellenar los huecos fijos.
4. El archivo `ads.txt` se genera solo con tu ID.

**Afiliados** (los cuadros amarillos):
1. Date de alta como afiliado en **Awin** (https://www.awin.com/es). Tiene comparadores de seguros de coche y de otros productos del motor. Una web de la competencia usa esta misma red para los seguros.
2. Cuando te acepten en un programa, pega tu enlace en el campo `url` del cuadro correspondiente de `afiliados`. Sin `url`, el cuadro no se muestra en la web publicada.

**Google Search Console** (para que Google encuentre todas las páginas):
1. Entra en https://search.google.com/search-console, añade tu dominio y verifícalo.
2. En *Sitemaps*, envía `sitemap.xml`.

---

## Cómo está pensada para ganar dinero

| Qué | Por qué |
|---|---|
| **Una página por municipio** (unas 3.000), **una por provincia** (52) y **una por marca** | La gente busca en Google «gasolineras baratas en [su pueblo]» y «precio gasolina Repsol». Cada página responde a una de esas búsquedas con datos que cambian cada día. Así lo hacen las webs grandes del sector. |
| **Precio de la gasolina hoy** | Es una búsqueda diaria enorme: los periódicos publican ese artículo cada día. La página se actualiza sola, con el título fechado y la variación respecto a ayer. |
| **Calculadora de viaje** y **¿compensa ir más lejos?** | Atraen visitas todo el año, sobre todo en vacaciones, y la gente pasa tiempo en la página, así que se ven más anuncios. |
| **Anuncios en sitios visibles**: bajo el resultado, cada 7 gasolineras de la lista y a mitad de cada página | Son los puntos donde más se miran. El espacio está reservado para que la página no «salte» al cargar el anuncio, algo que Google penaliza. |
| **Afiliados de seguros y tarjetas de carburante** | Quien busca gasolina barata quiere ahorrar en el coche. Cada contratación paga mucho más que miles de visitas a anuncios. |
| **Favoritas, compartir por WhatsApp e instalable como app** | Hacen que la gente vuelva y que la web se difunda sola. |
| **Carga muy rápida**: páginas ya generadas, sin frameworks, con datos por provincia | La velocidad cuenta para Google y para que la gente no se vaya. |

**Qué esperar:** Google tarda semanas o meses en posicionar una web nueva. Los primeros ingresos serán pequeños y crecen con el tráfico. Ayuda compartir la web en grupos locales y redes, sobre todo en momentos de subida de precios.

---

## Cosas útiles

| Archivo o carpeta | Qué es |
|---|---|
| `sitio.config.json` | **Lo único que tienes que tocar**: nombre, dominio, anuncios, afiliados y datos legales. |
| `1-VER-LA-WEB.bat` | Genera la web con los precios de ahora y la abre en tu PC. |
| `dist/` | La web generada. No se toca, se regenera cada vez. |
| `historico/` | Medias de cada día, para los gráficos y el «vs. ayer». |
| `src/` y `scripts/` | El código de la web. |
| `static/og.png` | La imagen que sale al compartir la web. Lleva el nombre «Surtidor Barato»: si cambias el nombre, pídeme que la regenere. |

**Servicios gratuitos que usa:** Photon (Komoot) para buscar direcciones y OpenStreetMap para el mapa. Con uso normal no hay problema. Si la web llega a tener muchísimo tráfico, cámbialos por un proveedor de pago en `servicios`.
