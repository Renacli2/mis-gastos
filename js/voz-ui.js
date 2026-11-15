// Botón de micrófono del formulario de gasto. La voz es un complemento: si no está disponible,
// el bloque no aparece o queda deshabilitado, y el formulario sigue igual.
import { $, esc } from './util.js';
import { soportaVoz, observarPermiso, escuchar } from './voz.js';

// Qué decir según el error que informa el navegador.
const MENSAJES = {
  'not-allowed': 'El navegador no dio acceso al micrófono. Tocá de nuevo y elegí “Permitir”, o cargá el gasto a mano.',
  'service-not-allowed': 'Este navegador tiene desactivado el reconocimiento de voz. Cargá el gasto a mano.',
  'audio-capture': 'No se encontró un micrófono que funcione. Cargá el gasto a mano.',
  network: 'El dictado necesita internet. Cargá el gasto a mano o probá cuando tengas conexión.',
  'language-not-supported': 'Este navegador no reconoce voz en español. Cargá el gasto a mano.',
  otro: 'Probá de nuevo o cargá el gasto a mano.',
};

const MIC = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
const EJEMPLO = 'Tocá el micrófono y decí, por ejemplo, “quince mil en supermercado”.';
const AVISO_VISTO = 'voz-aviso-visto';
const recuerda = (k) => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };
const recordar = (k) => { try { localStorage.setItem(k, '1'); } catch { /* sin almacenamiento: se vuelve a avisar */ } };

export const htmlVoz = () => (soportaVoz() ? `
  <div class="voz" id="voz">
    <div class="voz-fila">
      <button type="button" class="voz-btn" id="voz-btn" aria-pressed="false" aria-label="Dictar el gasto por voz">${MIC}</button>
      <div class="voz-txt" aria-live="polite"><b id="voz-estado">Dictar el gasto</b><small id="voz-det">${EJEMPLO}</small></div>
      <button type="button" class="link voz-cancelar" id="voz-cancelar" hidden>Cancelar</button>
    </div>
    <div class="voz-res" id="voz-res" hidden></div>
    <div class="voz-aviso" id="voz-aviso" hidden>
      <p>Para dictar, el navegador te va a pedir permiso para usar el micrófono. Solo se usa mientras el botón está activo.</p>
      <p>La transcripción la hace el navegador (en Chrome, con los servidores de Google) y necesita internet. La app no guarda el audio ni lo envía a ningún otro lado.</p>
      <div class="voz-aviso-btns"><button type="button" class="btn chico" id="voz-ok">Usar el micrófono</button>
        <button type="button" class="link" id="voz-no">Ahora no</button></div>
    </div>
  </div>` : '');

/**
 * Conecta el bloque de voz ya dibujado con htmlVoz().
 * onFrase(texto) se llama con cada frase terminada; no se guarda nada acá.
 */
export function montarVoz({ onFrase }) {
  const btn = $('#voz-btn');
  if (!btn) return;
  let escucha = null, permiso = 'desconocido';
  const vivo = () => document.body.contains(btn);   // el formulario sigue en pantalla
  const estado = (titulo, detalle = '') => { if (!vivo()) return; $('#voz-estado').textContent = titulo; $('#voz-det').innerHTML = detalle; };
  const pintar = (activo) => {
    btn.classList.toggle('escuchando', activo);
    btn.setAttribute('aria-pressed', String(activo));
    btn.setAttribute('aria-label', activo ? 'Terminar de dictar' : 'Dictar el gasto por voz');
    if (vivo()) $('#voz-cancelar').hidden = !activo;
  };
  const bloquear = () => {
    btn.disabled = true;
    if (vivo()) $('#voz-aviso').hidden = true;
    estado('Micrófono bloqueado', 'Para dictar, permití el micrófono en los ajustes del sitio del navegador. Podés seguir cargando a mano.');
  };
  // Si el permiso cambia (lo bloqueás o lo habilitás desde el navegador), el botón se acomoda solo.
  const alCambiarPermiso = (p) => {
    if (!vivo()) return;
    permiso = p;
    if (p === 'denied') { cancelar(); bloquear(); } else if (btn.disabled) { btn.disabled = false; estado('Dictar el gasto', EJEMPLO); }
  };
  observarPermiso(alCambiarPermiso);

  const soltar = () => {
    escucha = null; pintar(false);
    window.removeEventListener('hashchange', cancelar);
    document.removeEventListener('visibilitychange', alOcultar);
  };
  function cancelar() {
    if (!escucha) return;
    escucha.cancelar(); soltar();
    estado('Dictar el gasto', EJEMPLO);
  }
  // Si la app pasa a segundo plano, deja de escuchar.
  function alOcultar() { if (document.hidden) cancelar(); }

  const empezar = () => {
    $('#voz-aviso').hidden = true;
    if (navigator.onLine === false) return estado('Sin conexión', MENSAJES.network);
    pintar(true);
    estado('Escuchando…', 'Decí el gasto. Tocá de nuevo el micrófono para terminar.');
    window.addEventListener('hashchange', cancelar);
    document.addEventListener('visibilitychange', alOcultar);
    escucha = escuchar({
      onParcial: (t) => { if (vivo()) $('#voz-det').textContent = `“${t}”`; },
      onFin: (t) => {
        soltar();
        if (!vivo()) return;
        permiso = 'granted';
        if (!t) return estado('No escuché nada', 'Tocá el micrófono y hablá cerca del celular, o cargá el gasto a mano.');
        estado('Escuché', `“${esc(t)}”`);
        // Un problema al interpretar no puede romper el formulario: queda el texto y se sigue a mano.
        try { onFrase?.(t); } catch (e) { console.error(e); estado('Escuché, pero no pude interpretarlo', `“${esc(t)}”. Completá el gasto a mano.`); }
      },
      onError: (codigo) => {
        soltar();
        const [titulo, detalle] = { 'not-allowed': ['No hay permiso para el micrófono', MENSAJES['not-allowed']], network: ['Sin conexión', MENSAJES.network] }[codigo]
          || ['No se pudo escuchar', MENSAJES[codigo] || MENSAJES.otro];
        estado(titulo, detalle);
      },
    });
  };

  btn.addEventListener('click', () => {
    if (escucha) return escucha.detener();           // segundo toque: termina y se queda con lo oído
    // La primera vez se explica para qué es el permiso antes de que el navegador lo pida.
    if (permiso !== 'granted' && !recuerda(AVISO_VISTO)) { $('#voz-aviso').hidden = false; return; }
    empezar();
  });
  $('#voz-ok').addEventListener('click', () => { recordar(AVISO_VISTO); empezar(); });
  $('#voz-no').addEventListener('click', () => { $('#voz-aviso').hidden = true; });
  $('#voz-cancelar').addEventListener('click', cancelar);
}
