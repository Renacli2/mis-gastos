import { S, cargar, alCargar } from './store.js';
import { seedSiHaceFalta, migrarPaleta, migrarDatos } from './seed.js';
import { sincronizarVencimientos } from './pagos-datos.js';
import { $, $$, sumarMeses, toast } from './util.js';
import { destruirCharts } from './charts.js';
import { iniciarActualizaciones } from './update.js';
import { esApp, plugin } from './plataforma.js';
import { publicarWidget, aplicarAccionesWidget, aperturaWidget } from './widget-datos.js';
import { abrirPago } from './dialogo-pago.js';
import { programarAvisos, alTocarAviso } from './avisos.js';
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
// Cada cambio en los datos deja al día la copia que lee el widget de Android (en el navegador no hace nada).
alCargar(publicarWidget);
// …y reprograma los avisos de vencimiento (si están activados).
alCargar(programarAvisos);

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
  // Botón "atrás" de Android: si hay un diálogo abierto (por ejemplo el de pago), lo cierra sin guardar;
  // si no, vuelve a la pantalla anterior. Si no hay adónde volver, la app pasa a segundo plano.
  // El diálogo se cierra a mano porque, si lo abrió el widget, Android no cuenta ese paso del historial.
  plugin('App')?.addListener('backButton', ({ canGoBack }) => {
    const dialogo = document.querySelector('dialog[open]');
    if (dialogo) dialogo.close();
    else if (canGoBack) history.back();
    else plugin('App').minimizeApp();
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[target="_blank"]');
    if (!a || !/^https?:/i.test(a.href) || new URL(a.href).origin === location.origin) return;
    e.preventDefault();
    location.href = a.href;
  });
}

/** Si la app se abrió tocando el widget, va a la pantalla pedida. */
async function abrirDesdeWidget() {
  const d = await aperturaWidget();
  if (d) await irA(d);
}

/**
 * Va a una pantalla y, si se pide, abre el pago de un vencimiento: el mismo diálogo que la tarjeta
 * del inicio (el monto cambia cada mes: hay que escribirlo). Lo usan el widget y las notificaciones.
 * d = { ruta: '#/…', pagar: idVencimiento | null }
 */
async function irA(d) {
  if ((location.hash || '#/') !== d.ruta) {
    history.pushState(null, '', d.ruta);   // sin disparar hashchange: el redibujo lo hacemos acá y esperamos que termine
    await ruta();
  }
  if (!d.pagar) return;
  const boton = document.querySelector(`.pv [data-pagar="${CSS.escape(d.pagar)}"]`);
  if (boton) return boton.click();   // misma acción que tocarlo en la tarjeta (con "Deshacer" incluido)
  const v = S.vencimientosPago.find((x) => x.id === d.pagar);
  if (!v) return toast('Ese vencimiento ya no existe');
  if (v.estado === 'pagado') return toast('Ese vencimiento ya figura como pagado');
  if (await abrirPago(d.pagar)) { toast('Pago registrado y gasto cargado'); await ruta(); }
}

// Tocar una notificación de vencimiento abre su pago. Si la app arrancó por eso, espera a que termine de cargar.
let avisarListo;
const listo = new Promise((r) => { avisarListo = r; });
alTocarAviso(async (vencimientoId) => {
  await listo;
  if (document.querySelector('dialog[open]')) return;   // ya hay un pago abierto: no se encima otro
  await irA({ ruta: '#/', pagar: vencimientoId });
});

async function init() {
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  await seedSiHaceFalta();
  await migrarPaleta();
  await migrarDatos();
  await cargar();
  await aplicarAccionesWidget();
  await sincronizarVencimientos();
  publicarWidget();
  programarAvisos();
  window.addEventListener('hashchange', ruta);
  await ruta();
  await abrirDesdeWidget();
  avisarListo();
  iniciarActualizaciones();
  // Al volver a la app (por ejemplo, otro día) se aplica lo pedido desde el widget y se crean los vencimientos que falten.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    const delWidget = await aplicarAccionesWidget();
    const nuevos = await sincronizarVencimientos();
    publicarWidget();   // también cambia la fecha de la copia si pasó el día
    programarAvisos();  // y deja de lado los avisos que ya pasaron
    // Solo se redibuja el inicio: en otra pantalla podría haber un formulario a medio completar.
    if ((delWidget || nuevos) && ['', '#', '#/'].includes(location.hash)) await ruta();
    await abrirDesdeWidget();
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
