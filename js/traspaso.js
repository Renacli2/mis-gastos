// Pasar los datos de la app web (PWA en Chrome) a la app Android.
// No se pueden copiar solos: Chrome guarda los datos de la PWA en un lugar que ninguna otra app puede leer.
// Por eso el traspaso usa el menú "Compartir" de Android:
//   1. En la app web: Ajustes → Backup → "Pasar mis datos a la app Android" comparte un backup.
//   2. En el menú se elige "Mis Gastos": la app Android lo recibe, pide confirmación y lo restaura.
// También sirve "Abrir con Mis Gastos" sobre un backup .json desde Archivos.
import * as db from './db.js';
import { S, cargar } from './store.js';
import { hoy } from './util.js';
import { esApp, plugin } from './plataforma.js';
import { migrarPaleta, migrarDatos } from './seed.js';

// Chrome solo deja compartir algunos tipos de archivo (no .json): el backup viaja como texto.
const archivoBackup = (texto) => new File([texto], `mis-gastos-backup-${hoy()}.txt`, { type: 'text/plain' });

/** En la app web: true si el navegador puede compartir el backup como archivo (Chrome en Android). */
export function puedePasarALaApp() {
  // Solo en Chrome para Android: es donde está la app Android a la que se pasan los datos.
  if (esApp || !/Android/i.test(navigator.userAgent)) return false;
  try {
    return !!navigator.canShare?.({ files: [archivoBackup('{}')] });
  } catch {
    return false;
  }
}

/** En la app web: abre "Compartir" con el backup, para elegir la app Mis Gastos. Devuelve true si se compartió. */
export async function pasarALaApp() {
  const texto = JSON.stringify(await db.exportAll());
  try {
    await navigator.share({ files: [archivoBackup(texto)], title: 'Backup de Mis Gastos' });
    return true;
  } catch (err) {
    if (err?.name === 'AbortError') return false;   // cerró el menú sin elegir
    throw err;
  }
}

/** Resumen de un backup para la confirmación: "123 gastos y 9 servicios a pagar". */
export function resumenBackup(obj) {
  const n = (k) => obj?.data?.[k]?.length ?? 0;
  const cant = (k, uno, varios) => `${n(k)} ${n(k) === 1 ? uno : varios}`;
  const partes = [cant('gastos', 'gasto', 'gastos')];
  if (n('serviciosPago')) partes.push(cant('serviciosPago', 'servicio a pagar', 'servicios a pagar'));
  if (n('vehiculos')) partes.push(cant('vehiculos', 'vehículo', 'vehículos'));
  return partes.join(', ').replace(/, ([^,]*)$/, ' y $1');
}

/**
 * En la app Android: si le compartieron un backup, lo restaura (con confirmación).
 * Devuelve true si cambiaron los datos.
 */
export async function importarCompartido() {
  if (!esApp) return false;
  let texto = null;
  try {
    ({ texto = null } = await plugin('WidgetDatos').tomarImportacion());
  } catch {
    return false;
  }
  if (!texto) return false;
  let obj;
  try {
    obj = JSON.parse(texto);
  } catch {
    alert('Lo que compartiste con Mis Gastos no es un backup de la app.');
    return false;
  }
  if (obj?.app !== 'mis-gastos') {
    alert('Lo que compartiste con Mis Gastos no es un backup de la app.');
    return false;
  }
  const hayDatos = S.gastos.length > 0 || S.serviciosPago.length > 0;
  const fecha = obj.exportado ? ` del ${new Date(obj.exportado).toLocaleDateString('es-AR')}` : '';
  const ok = confirm(`¿Pasar a esta app el backup${fecha}?\n\nTrae ${resumenBackup(obj)}.`
    + (hayDatos ? '\n\nSe reemplazan TODOS los datos que tengas en esta app.' : ''));
  if (!ok) return false;
  try {
    await db.importAll(obj);
    await migrarPaleta();
    await migrarDatos();
    await cargar();
    return true;
  } catch (err) {
    alert(err.message || 'No se pudo restaurar el backup');
    return false;
  }
}
