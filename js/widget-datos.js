// Puente con el widget de Android (plugin nativo WidgetDatos). Solo hace algo dentro de la app Android;
// en el navegador y en la PWA todas estas funciones no hacen nada.
import { S } from './store.js';
import { hoy } from './util.js';
import { esApp, plugin } from './plataforma.js';
import { datosWidget } from './pagos.js';
import { vencimientosActuales, ocultarVencimiento } from './pagos-datos.js';

let ultimo = null;      // último JSON enviado, para no reescribir si no cambió nada
let pendiente = false;  // junta varias recargas seguidas en un solo envío

/** Deja al día la copia de los vencimientos que lee el widget. */
export function publicarWidget() {
  if (!esApp || pendiente) return;
  pendiente = true;
  setTimeout(async () => {
    pendiente = false;
    try {
      const hayServicios = S.serviciosPago.some((s) => s.activo !== false);
      const datos = JSON.stringify(datosWidget(vencimientosActuales(), hoy(), hayServicios));
      if (datos === ultimo) return;
      await plugin('WidgetDatos').guardar({ datos });
      ultimo = datos;
    } catch (err) {
      console.warn('No se pudieron guardar los datos del widget', err);
    }
  }, 0);
}

/**
 * Adónde pidió ir el widget al tocarlo, ya traducido a una acción de la app:
 *   { ruta: '#/…', pagar: idVencimiento | null }, o null si la app no se abrió desde el widget.
 */
export async function aperturaWidget() {
  if (!esApp) return null;
  let url = null;
  try {
    ({ url = null } = await plugin('WidgetDatos').tomarApertura());
  } catch (err) {
    console.warn('No se pudo leer la apertura del widget', err);
  }
  return url ? destinoWidget(url) : null;
}

/** Traduce misgastos://pagar/ID, misgastos://servicio/ID, etc. a una ruta de la app. */
export function destinoWidget(url) {
  const m = /^misgastos:\/\/([a-z-]+)\/?(.*)$/.exec(url || '');
  if (!m) return null;
  const id = decodeURIComponent(m[2] || '');
  switch (m[1]) {
    case 'pagar': return id ? { ruta: '#/', pagar: id } : { ruta: '#/', pagar: null };
    case 'servicio': return { ruta: id ? `#/pagos/${encodeURIComponent(id)}` : '#/pagos', pagar: null };
    case 'nuevo-servicio': return { ruta: '#/pagos/nuevo', pagar: null };
    case 'pagos': return { ruta: '#/pagos', pagar: null };
    default: return { ruta: '#/', pagar: null };
  }
}

/**
 * Aplica lo que se pidió desde el widget mientras la app estaba cerrada (por ahora, ocultar vencimientos).
 * Devuelve true si cambió algo. Las acciones sobre vencimientos que ya no existen o ya se pagaron se ignoran.
 */
export async function aplicarAccionesWidget() {
  if (!esApp) return false;
  let acciones = [];
  try {
    ({ acciones = [] } = await plugin('WidgetDatos').tomarAcciones());
  } catch (err) {
    console.warn('No se pudieron leer las acciones del widget', err);
    return false;
  }
  let cambio = false;
  for (const a of acciones) {
    if (a?.tipo === 'ocultar' && a.id && await ocultarVencimiento(a.id)) cambio = true;
  }
  return cambio;
}
