import { esc, toast } from './util.js';

export const VERSION_ACTUAL = self.APP_VERSION || '0.0.0';
const INTERVALO = 30 * 60 * 1000; // chequeo automático como mucho cada 30 minutos
let ultimoChequeo = 0;

function comparar(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

/** Consulta la versión publicada en el servidor, sin usar ninguna caché. */
export async function buscarVersion() {
  const r = await fetch(`version.js?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('No se pudo consultar el servidor');
  const txt = await r.text();
  const version = /APP_VERSION\s*=\s*['"]([^'"]+)/.exec(txt)?.[1];
  const notas = /APP_NOTAS\s*=\s*['"]([^'"]*)/.exec(txt)?.[1] || '';
  if (!version) throw new Error('Respuesta inesperada del servidor');
  return { version, notas, hayNueva: comparar(version, VERSION_ACTUAL) > 0 };
}

/** Descarga la versión nueva: actualiza el service worker, vacía la caché de archivos y recarga. Los datos no se tocan. */
export async function aplicarActualizacion() {
  if (!navigator.onLine) return toast('Necesitás conexión para actualizar');
  toast('Actualizando…');
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    reg?.waiting?.postMessage('SKIP_WAITING');
    const claves = await caches.keys();
    await Promise.all(claves.map((k) => caches.delete(k)));
  } catch (err) {
    console.warn(err);
  }
  location.reload();
}

function mostrarBanner(info) {
  const b = document.getElementById('update');
  b.innerHTML = `
    <span class="upd-txt"><b>Versión ${esc(info.version)} disponible</b>${info.notas ? `<small>${esc(info.notas)}</small>` : ''}</span>
    <button class="btn chico" data-upd="si">Actualizar</button>
    <button class="icono-btn" data-upd="no" aria-label="Más tarde">✕</button>`;
  b.hidden = false;
  b.onclick = (e) => {
    const a = e.target.closest('[data-upd]')?.dataset.upd;
    if (a === 'si') aplicarActualizacion();
    if (a === 'no') b.hidden = true;
  };
}

export async function chequeoAutomatico(forzar = false) {
  if (!navigator.onLine || (!forzar && Date.now() - ultimoChequeo < INTERVALO)) return;
  ultimoChequeo = Date.now();
  try {
    const info = await buscarVersion();
    if (info.hayNueva) mostrarBanner(info);
  } catch { /* sin conexión o servidor caído: se reintenta más tarde */ }
}

export function iniciarActualizaciones() {
  // Avisar si la app se acaba de actualizar
  try {
    const previa = localStorage.getItem('mg-version');
    if (previa && previa !== VERSION_ACTUAL) setTimeout(() => toast(`Actualizada a la versión ${VERSION_ACTUAL}`), 600);
    localStorage.setItem('mg-version', VERSION_ACTUAL);
  } catch { /* almacenamiento no disponible */ }

  chequeoAutomatico();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') chequeoAutomatico();
  });
  window.addEventListener('online', () => chequeoAutomatico());
}
