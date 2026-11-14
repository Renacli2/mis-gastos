import { S, cargar } from './store.js';
import { seedSiHaceFalta, migrarPaleta, migrarDatos } from './seed.js';
import { $, $$, sumarMeses, toast } from './util.js';
import { destruirCharts } from './charts.js';
import { iniciarActualizaciones } from './update.js';
import * as inicio from './views/inicio.js';
import * as gastos from './views/gastos.js';
import * as form from './views/form.js';
import * as analisis from './views/analisis.js';
import * as ajustes from './views/ajustes.js';
import * as vehiculos from './views/vehiculos.js';
import * as servicios from './views/servicios.js';

const RUTAS = { '': inicio, gastos, nuevo: form, editar: form, analisis, ajustes, vehiculos, servicios };

async function ruta() {
  const [path, ...params] = location.hash.replace(/^#\/?/, '').split('/');
  const vista = RUTAS[path] || inicio;
  destruirCharts();
  $$('.nav a').forEach((a) => a.classList.toggle('activo', a.dataset.r === ({ editar: 'gastos', servicios: 'vehiculos' }[path] ?? path)));
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

async function init() {
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  await seedSiHaceFalta();
  await migrarPaleta();
  await migrarDatos();
  await cargar();
  window.addEventListener('hashchange', ruta);
  await ruta();
  iniciarActualizaciones();
}

init().catch((err) => {
  console.error(err);
  toast('No se pudo abrir la base de datos');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
