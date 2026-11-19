import { S, cargar } from './store.js';
import { seedSiHaceFalta, migrarPaleta, migrarDatos } from './seed.js';
import { sincronizarVencimientos } from './pagos-datos.js';
import { $, $$, sumarMeses, toast } from './util.js';
import { destruirCharts } from './charts.js';
import { iniciarActualizaciones } from './update.js';
import { esApp } from './plataforma.js';
import * as inicio from './views/inicio.js';
import * as gastos from './views/gastos.js';
import * as form from './views/form.js';
import * as analisis from './views/analisis.js';
import * as ajustes from './views/ajustes.js';
import * as vehiculos from './views/vehiculos.js';
import * as servicios from './views/servicios.js';
import * as pagos from './views/pagos.js';

const RUTAS = { '': inicio, gastos, nuevo: form, editar: form, analisis, ajustes, vehiculos, servicios, pagos };

async function ruta() {
  const [path, ...params] = location.hash.replace(/^#\/?/, '').split('/');
  const vista = RUTAS[path] || inicio;
  destruirCharts();
  $$('.nav a').forEach((a) => a.classList.toggle('activo', a.dataset.r === ({ editar: 'gastos', servicios: 'vehiculos', pagos: '' }[path] ?? path)));
  const el = $('#view');
  el.replaceChildren();
  try {
    await vista.render(el, params);
  } catch (err) {
    console.error(err);
    el.innerHTML = `<div class="vacio">Ocurrió un error: ${err.message}</div>`;
  }
  window.scrollTo(0, 0);
}
S.rerender = ruta;

// Selector de mes compartido por todas las vistas
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-mes]');
  if (!b) return;
  S.mes = sumarMeses(S.mes, +b.dataset.mes);
  ruta();
});

// En la app Android, el visor web ignora los enlaces que abren otra pestaña ("Ir a pagar ↗").
// Navegar a una dirección externa hace que Capacitor la abra afuera: en el navegador o, si existe, en la app
// de ese sitio (por ejemplo Mercado Pago). La app queda abierta detrás.
if (esApp) {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[target="_blank"]');
    if (!a || !/^https?:/i.test(a.href) || new URL(a.href).origin === location.origin) return;
    e.preventDefault();
    location.href = a.href;
  });
}

async function init() {
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  await seedSiHaceFalta();
  await migrarPaleta();
  await migrarDatos();
  await cargar();
  await sincronizarVencimientos();
  window.addEventListener('hashchange', ruta);
  await ruta();
  iniciarActualizaciones();
  // Al volver a la app (por ejemplo, otro día) se crean los vencimientos que falten.
  document.addEventListener('visibilitychange', async () => {
    // Solo se redibuja el inicio: en otra pantalla podría haber un formulario a medio completar.
    if (document.visibilityState === 'visible' && await sincronizarVencimientos() && ['', '#', '#/'].includes(location.hash)) ruta();
  });
}

init().catch((err) => {
  console.error(err);
  toast('No se pudo abrir la base de datos');
});

// En la app Android los archivos ya vienen dentro del APK: no hace falta el service worker.
if ('serviceWorker' in navigator && !esApp) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
