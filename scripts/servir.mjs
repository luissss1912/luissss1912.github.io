// Servidor local para ver la web antes de publicarla: http://localhost:8080
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PUERTO = Number(process.env.PUERTO) || 8080;
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

createServer(async (req, res) => {
  try {
    let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    ruta = normalize(ruta).replace(/^(\.\.[/\\])+/, '');
    let archivo = join(DIST, ruta);
    const s = await stat(archivo).catch(() => null);
    if (s?.isDirectory()) archivo = join(archivo, 'index.html');
    const datos = await readFile(archivo).catch(() => null);
    if (!datos) {
      res.writeHead(404, { 'Content-Type': TIPOS['.html'] });
      res.end(await readFile(join(DIST, '404.html')).catch(() => 'No encontrado'));
      return;
    }
    res.writeHead(200, { 'Content-Type': TIPOS[extname(archivo)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(datos);
  } catch (err) {
    res.writeHead(500); res.end(String(err));
  }
}).listen(PUERTO, () => {
  const url = `http://localhost:${PUERTO}`;
  console.log(`\nWeb funcionando en ${url}\nPulsa Ctrl + C para pararla.\n`);
  if (!process.env.SIN_NAVEGADOR) {
    const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
    exec(cmd, () => {});
  }
});
