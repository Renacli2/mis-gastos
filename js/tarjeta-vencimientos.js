// Tarjeta "Próximos vencimientos": solo presentación. No lee la base ni el estado de la app:
// recibe los datos ya armados (paraTarjeta() de js/pagos.js) y avisa las acciones por callbacks.
// Así se puede usar en otra pantalla, y los mismos datos sirven para un widget o un aviso a futuro.
import { esc } from './util.js';

const TILDE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const ddmm = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

function item(x) {
  const como = [...new Set([x.appPago, x.medio].filter(Boolean))].join(' · ');
  return `<div class="pv-item urg-${x.estado}" data-venc="${esc(x.id)}">
    <button type="button" class="pv-tilde" data-pagar="${esc(x.id)}" aria-label="Marcar ${esc(x.nombre)} del ${ddmm(x.fecha)} como pagado">${TILDE}</button>
    <div class="pv-txt">
      <div class="pv-cab"><b>${esc(x.nombre)}</b><span class="badge urg-${x.estado}">${esc(x.texto)}</span></div>
      <small>${ddmm(x.fecha)}${como ? ` · ${esc(como)}` : ''}</small>
      <div class="pv-acc">
        ${x.enlace ? `<a class="link" href="${esc(x.enlace)}" target="_blank" rel="noopener noreferrer">Ir a pagar ↗</a>` : ''}
        <button type="button" class="link" data-ocultar="${esc(x.id)}">Ocultar</button>
      </div>
    </div>
  </div>`;
}

/**
 * datos = { items, resto, siguiente, total } de paraTarjeta(), más:
 *   hayServicios: si hay algún servicio activo
 *   ocultados: [{ id, nombre, fecha }] recién ocultados, para ofrecer deshacer
 *   destino: adónde lleva "Ver todos"
 */
export function htmlTarjeta(datos) {
  const { items, resto, siguiente, hayServicios, ocultados = [], destino = '#/pagos' } = datos;
  let cuerpo;
  if (!hayServicios) {
    cuerpo = `<p class="pv-vacio">Cargá tus servicios (luz, internet, patente…) y la app te recuerda cuándo vencen.</p>
      <a class="btn chico" href="${destino}/nuevo">Agregar servicio</a>`;
  } else if (!items.length) {
    cuerpo = `<p class="pv-vacio"><b>Estás al día.</b> ${siguiente
      ? `El próximo es ${esc(siguiente.nombre)}: ${esc(siguiente.texto.toLowerCase())}.`
      : 'No hay vencimientos pendientes.'}</p>`;
  } else {
    cuerpo = `<div class="pv-lista">${items.map(item).join('')}</div>
      ${resto ? `<a class="link pv-mas" href="${destino}">y ${resto} más</a>` : ''}`;
  }
  const deshacer = ocultados.map((o) => `<div class="pv-oculto" role="status">Ocultaste ${esc(o.nombre)} del ${ddmm(o.fecha)}.
    <button type="button" class="link" data-deshacer="${esc(o.id)}">Deshacer</button></div>`).join('');
  return `<section class="card pv" aria-labelledby="pv-tit">
    <div class="card-tit"><h2 id="pv-tit">Próximos vencimientos</h2>${hayServicios ? `<a href="${destino}" class="link">Ver todos</a>` : ''}</div>
    ${deshacer}${cuerpo}
  </section>`;
}

/** Conecta las acciones de una tarjeta ya dibujada dentro de `raiz`. */
export function montarTarjeta(raiz, { onPagar, onOcultar, onDeshacer }) {
  const tarjeta = raiz.querySelector('.pv');
  if (!tarjeta) return;
  tarjeta.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pagar],[data-ocultar],[data-deshacer]');
    if (!b) return;
    if (b.dataset.pagar) onPagar?.(b.dataset.pagar);
    else if (b.dataset.ocultar) onOcultar?.(b.dataset.ocultar);
    else onDeshacer?.(b.dataset.deshacer);
  });
}
