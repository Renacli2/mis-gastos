// Diálogo "Registrar pago": pide el monto (cambia cada mes) y confirma medio, app y fecha.
// Al confirmar crea el gasto vinculado al vencimiento. Se puede abrir desde cualquier pantalla.
import { S, medio } from './store.js';
import { esc, hoy, money, round2 } from './util.js';
import { historialPagos, montoReferencia } from './pagos.js';
import { registrarPago } from './pagos-datos.js';

const ddmm = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
function parseMonto(v) {
  v = String(v).trim();
  if (v === '') return 0;
  // Acepta "33.000", "33000", "33.000,50" o "33000.5"
  if (/,/.test(v) || /^\d{1,3}(\.\d{3})+$/.test(v)) return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;
  return parseFloat(v) || 0;
}
const chips = (items, sel, attr) => items.map((i) =>
  `<button type="button" class="chip ${i.id === sel ? 'sel' : ''}" data-${attr}="${esc(i.id)}">${esc(i.nombre)}</button>`).join('');

/**
 * Abre el diálogo para pagar un vencimiento. Devuelve una promesa con el gasto creado,
 * o null si se canceló. No guarda nada hasta que tocás "Registrar pago".
 */
export function abrirPago(vencimientoId) {
  const v = S.vencimientosPago.find((x) => x.id === vencimientoId);
  const s = v && S.serviciosPago.find((x) => x.id === v.servicioId);
  if (!v || !s || v.estado === 'pagado') return Promise.resolve(null);

  const ref = montoReferencia(s, historialPagos(s.id, S.vencimientosPago, S.gastos));
  const apps = [...S.appsPago];
  if (s.appPago && !apps.includes(s.appPago)) apps.push(s.appPago);
  const f = {
    moneda: 'ARS',
    medioId: s.medioId && S.medios.some((m) => m.id === s.medioId) ? s.medioId : (S.gastos[0]?.medioId || S.medios[0]?.id || null),
    appPago: s.appPago || '',
  };

  const dlg = document.createElement('dialog');
  dlg.className = 'hoja';
  dlg.setAttribute('aria-labelledby', 'dp-tit');
  dlg.innerHTML = `
    <form method="dialog" id="dp-form" autocomplete="off">
      <h2 id="dp-tit">Pagar ${esc(s.nombre)}</h2>
      <p class="dp-sub">Vencimiento del ${ddmm(v.fecha)}</p>

      <div class="monto-wrap">
        <div class="seg" id="dp-moneda"><button type="button" data-v="ARS">Pesos</button><button type="button" data-v="USD">Dólares</button></div>
        <input id="dp-monto" class="monto" type="text" inputmode="decimal" placeholder="0" aria-label="Monto pagado">
      </div>
      ${ref ? `<p class="dp-ref">${ref.origen === 'ultimo-pago' ? 'El último pago fue de' : 'Monto de referencia:'} <b>${money(ref.monto, ref.moneda)}</b>
        <button type="button" class="link" id="dp-usar">Usar ese monto</button></p>` : ''}
      <label class="campo" id="dp-cot-wrap" hidden>Cotización del dólar (ARS por US$)
        <input id="dp-cot" type="text" inputmode="decimal" value="${S.cot || ''}"></label>

      <label class="campo">Fecha de pago <input id="dp-fecha" type="date" value="${hoy()}" required></label>
      <div class="campo"><span>Medio de pago</span><div class="chips" id="dp-medios"></div></div>
      <label class="campo">Dónde lo pagaste <select id="dp-app"></select></label>

      <p class="dp-nota">Se carga un gasto en ${esc(S.categorias.find((c) => c.id === s.categoriaId)?.nombre || 'la categoría del servicio')}, en un pago.</p>
      <div class="dp-btns">
        <button type="button" class="btn" id="dp-cancelar">Cancelar</button>
        <button type="submit" class="btn primario" id="dp-ok">Registrar pago</button>
      </div>
    </form>`;
  document.body.appendChild(dlg);
  const $d = (sel) => dlg.querySelector(sel);

  const pintar = () => {
    dlg.querySelectorAll('#dp-moneda button').forEach((b) => b.classList.toggle('sel', b.dataset.v === f.moneda));
    $d('#dp-cot-wrap').hidden = f.moneda !== 'USD';
    $d('#dp-medios').innerHTML = chips(S.medios, f.medioId, 'medio');
    $d('#dp-app').innerHTML = [...apps, ''].map((a) => `<option value="${esc(a)}" ${a === f.appPago ? 'selected' : ''}>${a ? esc(a) : 'Sin definir'}</option>`).join('');
  };
  pintar();

  return new Promise((resolve) => {
    let resultado = null;
    const cerrar = () => dlg.close();
    // El botón "atrás" (el de Android o el del navegador) cierra el diálogo sin guardar, en vez de cambiar
    // de pantalla o salir de la app: al abrirlo se agrega un paso al historial, y "atrás" lo consume.
    let porAtras = false;
    const alVolver = () => { porAtras = true; cerrar(); };
    history.pushState({ dialogoPago: true }, '');
    window.addEventListener('popstate', alVolver);
    window.addEventListener('hashchange', alVolver);
    dlg.addEventListener('close', () => {
      window.removeEventListener('popstate', alVolver);
      window.removeEventListener('hashchange', alVolver);
      // Si se cerró con los botones, se quita el paso que agregamos (misma dirección: no cambia de pantalla).
      if (!porAtras && history.state?.dialogoPago) history.back();
      dlg.remove();
      resolve(resultado);
    });
    // Tocar afuera del panel cierra sin guardar.
    dlg.addEventListener('click', (e) => { if (e.target === dlg) cerrar(); });
    $d('#dp-cancelar').addEventListener('click', cerrar);
    $d('#dp-moneda').addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return; f.moneda = b.dataset.v; pintar();
    });
    $d('#dp-medios').addEventListener('click', (e) => {
      const b = e.target.closest('[data-medio]'); if (!b) return; f.medioId = b.dataset.medio; pintar();
    });
    $d('#dp-app').addEventListener('change', (e) => { f.appPago = e.target.value; });
    $d('#dp-usar')?.addEventListener('click', () => {
      f.moneda = ref.moneda; pintar();
      $d('#dp-monto').value = String(ref.monto).replace('.', ',');
    });
    $d('#dp-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const ok = $d('#dp-ok');
      if (ok.disabled) return;   // evita registrar dos veces con un doble toque
      const pago = {
        monto: round2(parseMonto($d('#dp-monto').value)),
        moneda: f.moneda,
        cotizacion: f.moneda === 'USD' ? parseMonto($d('#dp-cot').value) || S.cot : null,
        fechaPago: $d('#dp-fecha').value,
        medioId: f.medioId,
        appPago: f.appPago,
      };
      ok.disabled = true;
      const r = await registrarPago(v.id, pago);
      ok.disabled = false;
      if (r.error) {
        $d('#dp-error')?.remove();
        ok.closest('.dp-btns').insertAdjacentHTML('beforebegin', `<p class="dp-error" id="dp-error" role="alert">${esc(r.error)}</p>`);
        return;
      }
      resultado = r.gasto;
      cerrar();
    });
    dlg.showModal();
    setTimeout(() => $d('#dp-monto').focus(), 50);
  });
}

/** Texto corto de un pago registrado: "Luz · $33.000 con Débito". */
export const textoPago = (g, nombre) => `${nombre} · ${money(g.monto, g.moneda)}${g.medioId ? ` con ${medio(g.medioId).nombre}` : ''}`;
