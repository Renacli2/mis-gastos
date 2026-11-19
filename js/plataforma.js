// Dónde corre la app: en el navegador (PWA) o dentro de la app Android (Capacitor).
// Capacitor inyecta window.Capacitor antes de cargar la página, así que no hace falta importar nada:
// la misma copia de los archivos funciona en los dos lados.
const cap = typeof window !== 'undefined' ? window.Capacitor : undefined;

/** true dentro de la app Android; false en el navegador o la PWA. */
export const esApp = !!cap?.isNativePlatform?.();

/** Un plugin nativo de Capacitor por nombre (Filesystem, Share…), o undefined en el navegador. */
export const plugin = (nombre) => (esApp ? cap?.Plugins?.[nombre] : undefined);
