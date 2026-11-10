import * as db from '../db.js';
import { S, cargar, catsDe, medio } from '../store.js';
import { $, $$, esc, uid, hoy, mesDe, sumarMeses, fechaEnMes, round2, money, toast } from '../util.js';

/** Rubros ordenados por uso en los últimos 90 días (los más usados primero). */
function rubrosPorUso() {
  const desde = sumarMeses(mesDe(hoy()), -3);
  const uso = {};
  S.gastos.forEach((g) => { if (g.fecha >= desde) uso[g.rubroId] = (uso[g.rubroId] || 0) + 1; });
  return [...S.rubros].sort((a, b) => (uso[b.id] || 0) - (uso[a.id] || 0) || a.orden - b.orden);
}
function catsPorUso(rubroId) {
  const uso = {};
  S.gastos.forEach((g) => { if (g.rubroId === rubroId) uso[g.categoriaId] = (uso[g.categoriaId] || 0) + 1; });
  return catsDe(rubroId).sort((a, b) => (uso[b.id] || 0) - (uso[a.id] || 0) || a.orden - b.orden);
}

export function render(el, params) {
  const editId = params[0];
  const orig = editId ? S.gastos.find((g) => g.id === editId) : null;
  if (editId && !orig) { location.hash = '#/gastos'; return; }

  const f = orig
    ? { ...orig }
    : {
        fecha: hoy(), monto: '', moneda: 'ARS', cotizacion: S.cot || '',
        rubroId: null, categoriaId: null, medioId: S.gastos[0]?.medioId || S.medios[0]?.id,
        descripcion: '', prescindible: false, cuotas: 1, recurrente: false,
      };

  el.innerHTML = `
    <h1 class="titulo">${orig ? 'Editar gasto' : 'Nuevo gasto'}</h1>
    <form id="form" class="card form" autocomplete="off">
      <div class="monto-wrap">
        <div class="seg" id="moneda">
          <button type="button" data-v="ARS">$ ARS</button><button type="button" data-v="USD">US$</button>
        </div>
        <input id="monto" class="monto" type="text" inputmode="decimal" placeholder="0" value="${f.monto !== '' ? String(f.monto).replace('.', ',') : ''}" required>
      </div>
      <label id="cot-wrap" class="campo">Cotización del dólar (ARS por US$)
        <input id="cot" type="text" inputmode="decimal" value="${f.cotizacion || ''}"></label>

      <label class="campo">Fecha <input id="fecha" type="date" value="${f.fecha}" required></label>

      <div class="campo"><span>Rubro</span><div class="chips" id="rubros"></div></div>
      <div class="campo"><span>Categoría</span><div class="chips" id="cats"></div></div>
      <div class="campo"><span>Medio de pago</span><div class="chips" id="medios"></div></div>

      <div id="cuotas-wrap" class="campo">
        <span>Cuotas</span>
        <div class="cuotas"><input id="cuotas" type="number" min="1" max="60" value="${f.cuotas || 1}"><small id="cuota-info"></small></div>
      </div>

      <label class="campo">Descripción (opcional)
        <input id="desc" type="text" maxlength="80" placeholder="Ej: compra semanal" value="${esc(f.descripcion)}"></label>

      <label class="switch"><input type="checkbox" id="presc" ${f.prescindible ? 'checked' : ''}>
        <span><b>Prescindible</b><small>Gasto que podrías evitar o reducir</small></span></label>
      ${orig ? '' : `<label class="switch" id="rec-wrap"><input type="checkbox" id="rec">
        <span><b>Repetir todos los meses</b><small>Se agrega como gasto fijo (alquiler, suscripciones…)</small></span></label>`}

      ${orig?.cuotaTotal > 1 ? `<p class="nota">Cuota ${orig.cuotaNro} de ${orig.cuotaTotal}. Los cambios se aplican solo a esta cuota.</p>` : ''}
      <button class="btn primario" type="submit">${orig ? 'Guardar cambios' : 'Guardar gasto'}</button>
      ${orig ? '<button class="btn peligro" type="button" id="borrar">Eliminar</button>' : ''}
    </form>`;

  const chips = (cont, items, sel, attr) => {
    $(cont).innerHTML = items.map((i) =>
      `<button type="button" class="chip ${i.id === sel ? 'sel' : ''}" data-${attr}="${i.id}"
        ${i.color ? `style="--c:${i.color}"` : ''}>${i.icono ? i.icono + ' ' : ''}${esc(i.nombre)}</button>`).join('') || '<small>—</small>';
  };

  const pintarRubros = () => chips('#rubros', rubrosPorUso(), f.rubroId, 'rubro');
  const pintarCats = () => chips('#cats', f.rubroId ? catsPorUso(f.rubroId) : [], f.categoriaId, 'cat');
  const pintarMedios = () => chips('#medios', S.medios, f.medioId, 'medio');
  const pintarMoneda = () => {
    $$('#moneda button').forEach((b) => b.classList.toggle('sel', b.dataset.v === f.moneda));
    $('#cot-wrap').hidden = f.moneda !== 'USD';
  };
  const parse = (v) => parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;
  const parseMonto = () => {
    const v = $('#monto').value.trim();
    // Acepta "1.234,56", "1234,56", "1.500" (miles) o "1234.56"
    if (/,/.test(v) || /^\d{1,3}(\.\d{3})+$/.test(v)) return parse(v);
    return parseFloat(v) || 0;
  };
  const pintarCuotas = () => {
    const esCredito = medio(f.medioId).tipo === 'credito';
    $('#cuotas-wrap').hidden = !esCredito || !!orig;
    const n = Math.max(1, parseInt($('#cuotas').value) || 1);
    const m = parseMonto();
    $('#cuota-info').textContent = n > 1 && m ? `${n} cuotas de ${money(m / n, f.moneda)}` : '';
    const rec = $('#rec-wrap');
    if (rec) rec.hidden = esCredito && n > 1;
  };

  pintarRubros(); pintarCats(); pintarMedios(); pintarMoneda(); pintarCuotas();

  $('#moneda').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    f.moneda = b.dataset.v; pintarMoneda(); pintarCuotas();
  });
  $('#rubros').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rubro]'); if (!b) return;
    f.rubroId = b.dataset.rubro;
    const cs = catsDe(f.rubroId);
    f.categoriaId = cs.length === 1 ? cs[0].id : null;
    pintarRubros(); pintarCats();
  });
  $('#cats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    f.categoriaId = b.dataset.cat; pintarCats();
  });
  $('#medios').addEventListener('click', (e) => {
    const b = e.target.closest('[data-medio]'); if (!b) return;
    f.medioId = b.dataset.medio; pintarMedios(); pintarCuotas();
  });
  $('#monto').addEventListener('input', pintarCuotas);
  $('#cuotas').addEventListener('input', pintarCuotas);
  if (!orig) setTimeout(() => $('#monto').focus(), 50);

  $('#form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const monto = round2(parseMonto());
    if (!(monto > 0)) return toast('Ingresá un monto');
    if (!f.rubroId) return toast('Elegí un rubro');
    if (!f.medioId) return toast('Elegí un medio de pago');
    const cot = f.moneda === 'USD' ? parse($('#cot').value) || S.cot : null;
    if (f.moneda === 'USD' && !cot) return toast('Ingresá la cotización del dólar');

    const base = {
      fecha: $('#fecha').value || hoy(), moneda: f.moneda, cotizacion: cot,
      rubroId: f.rubroId, categoriaId: f.categoriaId, medioId: f.medioId,
      descripcion: $('#desc').value.trim(), prescindible: $('#presc').checked,
    };
    if (f.moneda === 'USD' && !S.cot) await db.setConfig('cotizacion', cot);

    if (orig) {
      await db.put('gastos', { ...orig, ...base, monto });
      await cargar();
      toast('Gasto actualizado');
      history.back();
      return;
    }

    const n = medio(f.medioId).tipo === 'credito' ? Math.max(1, Math.min(60, parseInt($('#cuotas').value) || 1)) : 1;
    const ahora = Date.now();
    if (n > 1) {
      const grupo = uid();
      const cuota = round2(monto / n);
      const dia = +base.fecha.slice(8);
      const lista = Array.from({ length: n }, (_, i) => ({
        ...base, id: uid(), creado: ahora + i,
        fecha: fechaEnMes(sumarMeses(mesDe(base.fecha), i), dia),
        monto: i === n - 1 ? round2(monto - cuota * (n - 1)) : cuota,
        cuotaGrupo: grupo, cuotaNro: i + 1, cuotaTotal: n, montoTotal: monto,
      }));
      await db.putMany('gastos', lista);
    } else {
      const id = uid();
      let recurrenteId = null;
      if ($('#rec')?.checked) {
        recurrenteId = uid();
        await db.put('recurrentes', {
          id: recurrenteId, descripcion: base.descripcion || (S.categorias.find((c) => c.id === base.categoriaId)?.nombre ?? 'Gasto fijo'),
          monto, moneda: base.moneda, rubroId: base.rubroId, categoriaId: base.categoriaId, medioId: base.medioId,
          prescindible: base.prescindible, dia: +base.fecha.slice(8), activo: true,
          desdeMes: mesDe(base.fecha), ultimoMes: mesDe(base.fecha),
        });
      }
      await db.put('gastos', { ...base, id, monto, creado: ahora, recurrenteId });
    }
    S.mes = mesDe(base.fecha);
    await cargar();
    toast(n > 1 ? `Compra en ${n} cuotas guardada` : 'Gasto guardado');
    location.hash = '#/';
  });

  $('#borrar')?.addEventListener('click', async () => {
    if (orig.cuotaGrupo) {
      const todas = confirm(`Este gasto es la cuota ${orig.cuotaNro}/${orig.cuotaTotal}.\n\nAceptar = borrar TODAS las cuotas de esta compra\nCancelar = elegir otra opción`);
      if (todas) {
        await db.delMany('gastos', S.gastos.filter((g) => g.cuotaGrupo === orig.cuotaGrupo).map((g) => g.id));
      } else if (confirm('¿Borrar solo esta cuota?')) {
        await db.del('gastos', orig.id);
      } else return;
    } else {
      if (!confirm('¿Eliminar este gasto?')) return;
      await db.del('gastos', orig.id);
    }
    await cargar();
    toast('Eliminado');
    history.back();
  });
}
