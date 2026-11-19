// Avisos de vencimiento como notificaciones de Android (plugin @capacitor/local-notifications).
// Llegan aunque la app esté cerrada: Android los tiene agendados. Solo dentro de la app Android y solo si
// los activaste en Ajustes. En el navegador y en la PWA nada de esto hace nada.
import { S } from './store.js';
import { hoy } from './util.js';
import { esApp, plugin } from './plataforma.js';
import { planAvisos } from './pagos.js';
import { vencimientosActuales } from './pagos-datos.js';

const CANAL = 'vencimientos';
let ultimo = null;      // último plan agendado, para no reprogramar si no cambió nada
let pendiente = false;  // junta varias recargas seguidas en una sola

/** Fecha y hora del teléfono para un aviso del plan ({ fecha: 'AAAA-MM-DD', hora }). */
const momento = (a) => {
  const [y, m, d] = a.fecha.split('-').map(Number);
  return new Date(y, m - 1, d, a.hora, 0, 0);
};

/**
 * Deja agendados los avisos que corresponden a los vencimientos pendientes de hoy en adelante.
 * Se llama cada vez que cambian los datos (pagar, ocultar, editar un servicio…) y al volver a la app.
 * Si los avisos están desactivados, cancela los que hubiera.
 */
export function programarAvisos() {
  if (!esApp || pendiente) return;
  pendiente = true;
  setTimeout(async () => {
    pendiente = false;
    const LN = plugin('LocalNotifications');
    if (!LN) return;
    try {
      const d = new Date();
      const plan = S.avisosPago
        ? planAvisos(vencimientosActuales(), { fecha: hoy(), minutos: d.getHours() * 60 + d.getMinutes() }, S.avisosHora)
        : [];
      const clave = JSON.stringify(plan);
      if (clave === ultimo) return;
      const { notifications = [] } = await LN.getPending();
      if (notifications.length) await LN.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
      if (plan.length) {
        await LN.createChannel({
          id: CANAL, name: 'Vencimientos de pago', importance: 4, visibility: 1,
          description: 'Avisos antes de cada vencimiento y el mismo día',
        });
        await LN.schedule({
          notifications: plan.map((a) => ({
            id: a.id, title: a.titulo, body: a.cuerpo, channelId: CANAL,
            schedule: { at: momento(a), allowWhileIdle: true },
            // Hora aproximada (Android puede correrlo unos minutos para ahorrar batería): alcanza para un
            // recordatorio y no hace falta pedir el permiso especial de "Alarmas y recordatorios".
            isExactNotification: false,
            extra: { vencimientoId: a.vencimientoId },
          })),
        });
      }
      ultimo = clave;
    } catch (err) {
      console.warn('No se pudieron programar los avisos', err);
    }
  }, 0);
}

/**
 * Pide el permiso de notificaciones de Android (13 o más nuevo lo pide la primera vez).
 * Devuelve true si quedó concedido.
 */
export async function pedirPermisoAvisos() {
  const LN = plugin('LocalNotifications');
  if (!LN) return false;
  let p = await LN.checkPermissions();
  if (p.display !== 'granted') p = await LN.requestPermissions();
  return p.display === 'granted';
}

/** Llama a `fn(vencimientoId)` cuando tocan una notificación de vencimiento (también si abrió la app de cero). */
export function alTocarAviso(fn) {
  if (!esApp) return;
  plugin('LocalNotifications')?.addListener('localNotificationActionPerformed', ({ notification }) => {
    const id = notification?.extra?.vencimientoId;
    if (id) fn(id);
  });
}
