// Captura de voz con la Web Speech API del navegador. Sin backend, sin claves.
// Nunca arranca sola: solo escucha cuando alguien llama a escuchar(), y eso pasa al tocar el micrófono.

const Reconocedor = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;

export const soportaVoz = () => !!Reconocedor();

/** Estado del permiso de micrófono sin pedirlo: 'granted', 'denied', 'prompt' o 'desconocido'. */
export async function permisoMicrofono() {
  try { return (await navigator.permissions.query({ name: 'microphone' })).state; } catch { return 'desconocido'; }
}

/**
 * Empieza una escucha. Termina sola cuando la persona deja de hablar, a los `silencioMs` sin oír nada,
 * o al llamar a detener() (se queda con lo oído) o cancelar() (lo descarta).
 * - onParcial(texto): lo que se va reconociendo
 * - onFin(texto): el texto final; vacío si no se oyó nada
 * - onError(codigo): 'not-allowed', 'network', 'audio-capture', 'no-inicio'…
 */
export function escuchar({ onParcial, onFin, onError, silencioMs = 8000, idiomas = ['es-AR', 'es-ES'] }) {
  let rec = null, reloj = null, idioma = 0;
  let final = '', parcial = '', error = null, cancelado = false, cerrado = false, reintentar = false;

  const cerrar = () => {
    if (cerrado) return;
    cerrado = true; clearTimeout(reloj);
    if (cancelado) return;
    if (error && error !== 'no-speech') onError(error); else onFin(`${final} ${parcial}`.trim());
  };
  const esperarSilencio = () => { clearTimeout(reloj); reloj = setTimeout(() => { try { rec.stop(); } catch { cerrar(); } }, silencioMs); };

  const arrancar = () => {
    rec = new (Reconocedor())();
    rec.lang = idiomas[idioma];
    rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      final = ''; parcial = '';
      for (const r of e.results) { if (r.isFinal) final += `${r[0].transcript} `; else parcial += `${r[0].transcript} `; }
      if (!cancelado) onParcial(`${final} ${parcial}`.replace(/\s+/g, ' ').trim());
      esperarSilencio();
    };
    rec.onerror = (e) => {
      // Si el navegador no tiene es-AR, se prueba con es-ES.
      if (e.error === 'language-not-supported' && idioma < idiomas.length - 1) { idioma++; reintentar = true; return; }
      if (e.error !== 'aborted') error = e.error;
    };
    rec.onend = () => { if (reintentar && !cancelado) { reintentar = false; arrancar(); } else cerrar(); };
    try { rec.start(); esperarSilencio(); } catch { error = 'no-inicio'; cerrar(); }
  };
  arrancar();

  return {
    detener() { try { rec.stop(); } catch { cerrar(); } },
    cancelar() { cancelado = true; clearTimeout(reloj); try { rec.abort(); } catch { /* ya estaba cerrado */ } },
  };
}
