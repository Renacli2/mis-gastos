import * as db from '../db.js';
import { S, cargar, catsDe, medio, cat, vehiculo, vehiculosActivos } from '../store.js';
import { $, $$, esc, uid, hoy, mesDe, sumarMeses, fechaEnMes, round2, money, toast } from '../util.js';
import { cargasDe, validarCarga, precioPorLitro, odometroVehiculo } from '../combustible.js';
import { htmlVoz, montarVoz } from '../voz-ui.js';
import { interpretar, textoEntendido } from '../voz-interpretar.js';
import { SINONIMOS } from '../voz-sinonimos.js';

const SIN_VEHICULO = 'ninguno';
const km = (n) => `${Math.round(n || 0).toLocaleString('es-AR')} km`;
const parseLitros = (v) => parseFloat(String(v).trim().replace(',', '.')) || 0;
const parseKm = (v) => { const s = String(v).replace(/\D/g, ''); return s === '' ? NaN : parseInt(s, 10); };

/** Deja el odómetro del vehículo al día después de guardar o borrar una de sus cargas. */
async function actualizarOdometro(vehiculoId, odoPrevio = null) {
  const v = (await db.all('vehiculos')).find((x) => x.id === vehiculoId);
  if (!v) return;
  const nuevo = odometroVehiculo(v.odometro, cargasDe(await db.all('gastos'), vehiculoId), odoPrevio);
  if (nuevo !== v.odometro) await db.put('vehiculos', { ...v, odometro: nuevo });
}

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
  // El gasto de un servicio se edita desde el servicio, para que no queden desfasados.
  if (orig?.servicioId && S.servicios.some((s) => s.id === orig.servicioId)) { location.replace(`#/servicios/${orig.servicioId}`); return; }

  const f = orig
    ? { ...orig }
    : {
        fecha: hoy(), monto: '', moneda: 'ARS', cotizacion: S.cot || '',
        rubroId: null, categoriaId: null, medioId: S.gastos[0]?.medioId || S.medios[0]?.id,
        descripcion: '', prescindible: false, cuotas: 1, recurrente: false,
      };

  // Combustible: vehículos elegibles (los activos, más el del gasto que se edita aunque esté inactivo)
  const vehs = vehiculosActivos();
  if (orig?.vehiculoId && !vehs.some((v) => v.id === orig.vehiculoId) && vehiculo(orig.vehiculoId)) vehs.push(vehiculo(orig.vehiculoId));
  const ultimaCarga = S.gastos.find((g) => g.vehiculoId && vehs.some((v) => v.id === g.vehiculoId));
  // En un gasto nuevo el vehículo arranca en "Ninguno"; al elegir Combustible se propone el último usado.
  const vehPorDefecto = ultimaCarga?.vehiculoId || vehs[0]?.id || SIN_VEHICULO;
  let vehElegidoAMano = !!orig;
  f.vehiculoId = orig ? (orig.vehiculoId || SIN_VEHICULO) : SIN_VEHICULO;
  f.tanqueLleno = orig?.tanqueLleno ?? true;

  el.innerHTML = `
    <h1 class="titulo">${orig ? 'Editar gasto' : 'Cargar gasto'}</h1>
    <form id="form" class="form" autocomplete="off">
      ${orig ? '' : htmlVoz()}
      <div class="monto-wrap">
        <div class="seg" id="moneda">
          <button type="button" data-v="ARS">Pesos</button><button type="button" data-v="USD">Dólares</button>
        </div>
        <input id="monto" class="monto" type="text" inputmode="decimal" placeholder="0" value="${f.monto !== '' ? String(f.monto).replace('.', ',') : ''}" required>
      </div>
      <label id="cot-wrap" class="campo">Cotización del dólar (ARS por US$)
        <input id="cot" type="text" inputmode="decimal" value="${f.cotizacion || ''}"></label>

      <label class="campo">Fecha <input id="fecha" type="date" value="${f.fecha}" required></label>

      <div class="campo"><span>Rubro</span><div class="chips" id="rubros"></div></div>
      <div class="campo"><span>Categoría</span><div class="chips" id="cats"></div></div>

      <div id="comb-wrap" class="bloque" hidden>
        ${vehs.length ? `
        <div class="campo" style="margin-top:0"><span>Vehículo</span><div class="chips" id="vehs"></div></div>
        <small id="comb-ayuda" style="display:block;margin-top:8px"></small>
        <div id="comb-datos">
          <div class="grid2">
            <label class="campo">Litros
              <input id="litros" type="text" inputmode="decimal" placeholder="Ej: 35,5" value="${orig?.litros ? String(orig.litros).replace('.', ',') : ''}"></label>
            <label class="campo">Odómetro (km)
              <input id="odo" type="text" inputmode="numeric" value="${orig?.odometro ?? ''}"></label>
          </div>
          <small id="comb-info"></small>
          <label class="switch"><input type="checkbox" id="lleno" ${f.tanqueLleno ? 'checked' : ''}>
            <span><b>Tanque lleno</b><small>Marcalo si llenaste el tanque. Se usa para calcular el consumo.</small></span></label>
        </div>`
        : '<p class="nota" style="margin:0">Para registrar litros y odómetro, primero <a class="link" href="#/vehiculos/nuevo">agregá un vehículo</a>.</p>'}
      </div>

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
        ${i.color ? `style="--c:${i.color}"` : ''}>${i.color ? '<i></i>' : ''}${esc(i.nombre)}</button>`).join('') || '<small>—</small>';
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
  // Un gasto histórico en cuotas no se puede convertir en carga: su monto es solo una parte de la compra.
  const esCombustible = () => cat(f.categoriaId).tipo === 'combustible' && !orig?.cuotaGrupo;
  /** Es una carga con datos de consumo: categoría de combustible y un vehículo elegido. */
  const esCargaVeh = () => esCombustible() && vehs.length > 0 && f.vehiculoId !== SIN_VEHICULO;
  /** El rubro tiene las categorías de vehículos (Transporte): sus gastos se pueden asociar a un vehículo. */
  const esRubroVeh = () => vehs.length > 0 && !!f.rubroId && catsDe(f.rubroId).some((c) => c.tipo);
  /** Un gasto viejo de combustible se puede asociar a un vehículo sin litros ni odómetro: cuenta para el costo, no para el consumo. */
  const soloAsociar = () => !!orig && !(orig.litros > 0) && $('#litros').value.trim() === '' && $('#odo').value.trim() === '';
  const ajustarVehiculo = () => {
    if (!vehElegidoAMano) f.vehiculoId = esCombustible() ? vehPorDefecto : SIN_VEHICULO;
  };
  const pintarCuotas = () => {
    // El combustible va siempre en un pago: una carga partida en cuotas rompería el cálculo de consumo.
    const esCredito = medio(f.medioId).tipo === 'credito' && !esCombustible();
    $('#cuotas-wrap').hidden = !esCredito || !!orig;
    const n = esCredito ? Math.max(1, parseInt($('#cuotas').value) || 1) : 1;
    const m = parseMonto();
    $('#cuota-info').textContent = n > 1 && m ? `${n} cuotas de ${money(m / n, f.moneda)}` : '';
    const rec = $('#rec-wrap');
    if (rec) rec.hidden = (esCredito && n > 1) || esCombustible();
  };
  const pintarCombInfo = () => {
    if (!esCargaVeh()) return;
    const v = vehiculo(f.vehiculoId);
    const ppl = precioPorLitro(parseMonto(), parseLitros($('#litros').value));
    $('#comb-info').textContent = [
      ppl ? `${money(ppl, f.moneda)} por litro` : '',
      v ? `Odómetro de ${v.alias}: ${km(v.odometro)}` : '',
    ].filter(Boolean).join(' · ');
  };
  const pintarComb = () => {
    $('#comb-wrap').hidden = !(esCombustible() || esRubroVeh());
    if (!vehs.length) return;
    chips('#vehs', [...vehs.map((v) => ({ id: v.id, nombre: v.alias })), { id: SIN_VEHICULO, nombre: 'Ninguno' }], f.vehiculoId, 'veh');
    $('#comb-datos').hidden = !esCargaVeh();
    $('#comb-ayuda').textContent = esCombustible()
      ? (orig && !(orig.litros > 0) ? 'Podés dejar litros y odómetro vacíos: el gasto cuenta para el costo del vehículo, pero no para el consumo.' : '')
      : 'Opcional. Elegí un vehículo para sumar este gasto a su costo (seguro, patente, peajes…).';
    pintarCombInfo();
  };

  pintarRubros(); pintarCats(); pintarMedios(); pintarMoneda(); pintarComb(); pintarCuotas();

  $('#moneda').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    f.moneda = b.dataset.v; pintarMoneda(); pintarCuotas();
  });
  $('#rubros').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rubro]'); if (!b) return;
    f.rubroId = b.dataset.rubro;
    const cs = catsDe(f.rubroId);
    f.categoriaId = cs.length === 1 ? cs[0].id : null;
    ajustarVehiculo(); pintarRubros(); pintarCats(); pintarComb(); pintarCuotas();
  });
  $('#cats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    f.categoriaId = b.dataset.cat; ajustarVehiculo(); pintarCats(); pintarComb(); pintarCuotas();
  });
  $('#vehs')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-veh]'); if (!b) return;
    f.vehiculoId = b.dataset.veh; vehElegidoAMano = true; pintarComb();
  });
  $('#litros')?.addEventListener('input', pintarCombInfo);
  $('#monto').addEventListener('input', pintarCombInfo);
  $('#moneda').addEventListener('click', pintarCombInfo);
  $('#medios').addEventListener('click', (e) => {
    const b = e.target.closest('[data-medio]'); if (!b) return;
    f.medioId = b.dataset.medio; pintarMedios(); pintarCuotas();
  });
  $('#monto').addEventListener('input', pintarCuotas);
  $('#cuotas').addEventListener('input', pintarCuotas);
  if (!orig) setTimeout(() => $('#monto').focus(), 50);

  // ---- Carga por voz: rellena el formulario con lo dictado. Nunca guarda: se confirma con el botón de siempre. ----
  const marcar = (sel) => $(sel)?.closest('.campo, .monto-wrap')?.classList.add('voz-ok');
  // Un campo deja de estar resaltado cuando lo tocás o lo corregís a mano.
  $$('.campo, .monto-wrap', $('#form')).forEach((c) => ['input', 'click'].forEach((ev) =>
    c.addEventListener(ev, (e) => { if (e.isTrusted) c.classList.remove('voz-ok'); })));
  const repintar = () => { pintarRubros(); pintarCats(); pintarMedios(); pintarMoneda(); pintarComb(); pintarCuotas(); };
  const ponerCategoria = (id) => {
    f.categoriaId = id; f.rubroId = cat(id).rubroId; ajustarVehiculo();
    marcar('#rubros'); marcar('#cats');
  };
  const ponerMonto = (n) => { $('#monto').value = String(n).replace('.', ','); marcar('#monto'); };
  const ponerMedio = (id) => { f.medioId = id; marcar('#medios'); };
  const ponerVehiculo = (id) => { f.vehiculoId = id; vehElegidoAMano = true; marcar('#vehs'); };

  const aplicarVoz = (texto) => {
    const ctx = { rubros: S.rubros, categorias: S.categorias, medios: S.medios, vehiculos: vehs, hoy: hoy(), sinonimos: SINONIMOS };
    const r = interpretar(texto, ctx);
    if (r.monto !== null) ponerMonto(r.monto);
    if (r.moneda) { f.moneda = r.moneda; marcar('#monto'); }
    if (r.fecha) { $('#fecha').value = r.fecha; marcar('#fecha'); }
    if (r.categoriaId) ponerCategoria(r.categoriaId);
    else if (r.rubroId && r.rubroId !== f.rubroId) {
      const cs = catsDe(r.rubroId);
      f.rubroId = r.rubroId; f.categoriaId = cs.length === 1 ? cs[0].id : null; ajustarVehiculo();
      marcar('#rubros');
    }
    if (r.medioId) ponerMedio(r.medioId);
    if (r.vehiculoId) ponerVehiculo(r.vehiculoId);
    if (r.litros !== null && $('#litros')) { $('#litros').value = String(r.litros).replace('.', ','); marcar('#litros'); }
    if (r.odometro !== null && $('#odo')) { $('#odo').value = r.odometro; marcar('#odo'); }
    repintar();

    // Lo ambiguo no se decide: se ofrece como opciones.
    const dudas = [
      { titulo: '¿Cuál es el monto?', ids: () => r.montosPosibles, nombre: (n) => money(+n, f.moneda), elegir: (n) => { r.monto = +n; r.montosPosibles = []; ponerMonto(+n); } },
      { titulo: '¿Qué categoría?', ids: () => (r.categoriasPosibles.length <= 6 ? r.categoriasPosibles : []), nombre: (id) => cat(id).nombre, elegir: (id) => { r.categoriaId = id; r.categoriasPosibles = []; ponerCategoria(id); } },
      { titulo: '¿Con qué pagaste?', ids: () => r.mediosPosibles, nombre: (id) => medio(id).nombre, elegir: (id) => { r.medioId = id; r.mediosPosibles = []; ponerMedio(id); } },
      { titulo: '¿Qué vehículo?', ids: () => r.vehiculosPosibles, nombre: (id) => vehiculo(id)?.alias, elegir: (id) => { r.vehiculoId = id; r.vehiculosPosibles = []; ponerVehiculo(id); } },
    ];
    const res = $('#voz-res');
    const pintarRes = () => {
      const entendio = textoEntendido(r, ctx);
      const hayDudas = dudas.some((d) => d.ids().length);
      res.hidden = false;
      const titulo = !entendio.startsWith('Entendí') && hayDudas ? 'Hay más de una opción: elegí cuál va' : entendio;
      res.innerHTML = `<b>${esc(titulo)}</b>`
        + dudas.map((d, k) => (d.ids().length ? `<div class="voz-duda"><span>${d.titulo}</span><div class="chips">${
          d.ids().map((id) => `<button type="button" class="chip" data-duda="${k}" data-id="${esc(String(id))}">${esc(d.nombre(id))}</button>`).join('')}</div></div>` : '')).join('')
        + `<small>${entendio.startsWith('Entendí') || hayDudas ? 'Revisá los campos resaltados y tocá Guardar. Nada se guarda solo.' : 'Probá de nuevo o completá el gasto a mano.'}</small>`;
    };
    res.onclick = (e) => {
      const b = e.target.closest('[data-duda]'); if (!b) return;
      dudas[+b.dataset.duda].elegir(b.dataset.id); repintar(); pintarRes();
    };
    pintarRes();
  };
  if (!orig) montarVoz({ onFrase: aplicarVoz });

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

    // Datos de consumo: van en el mismo gasto, no en un registro aparte.
    const carga = { vehiculoId: null, litros: null, odometro: null, tanqueLleno: null };
    // Cualquier gasto del rubro de vehículos puede quedar asociado a uno, para sumar a su costo.
    if ((esCombustible() || esRubroVeh()) && vehs.length && f.vehiculoId !== SIN_VEHICULO) carga.vehiculoId = f.vehiculoId;
    if (esCargaVeh() && !soloAsociar()) {
      Object.assign(carga, {
        vehiculoId: f.vehiculoId, litros: round2(parseLitros($('#litros').value)),
        odometro: parseKm($('#odo').value), tanqueLleno: $('#lleno').checked,
      });
      const otras = cargasDe(S.gastos, carga.vehiculoId).filter((g) => g.id !== orig?.id);
      const error = validarCarga({ monto, litros: carga.litros, odometro: carga.odometro, fecha: base.fecha }, otras);
      if (error) return toast(error);
    }
    Object.assign(base, carga);
    if (f.moneda === 'USD' && !S.cot) await db.setConfig('cotizacion', cot);

    if (orig) {
      await db.put('gastos', { ...orig, ...base, monto });
      if (orig.vehiculoId && orig.vehiculoId !== carga.vehiculoId) await actualizarOdometro(orig.vehiculoId, orig.odometro);
      if (carga.vehiculoId) await actualizarOdometro(carga.vehiculoId, orig.vehiculoId === carga.vehiculoId ? orig.odometro : null);
      await cargar();
      toast('Gasto actualizado');
      history.back();
      return;
    }

    const n = medio(f.medioId).tipo === 'credito' && !esCombustible() ? Math.max(1, Math.min(60, parseInt($('#cuotas').value) || 1)) : 1;
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
      if ($('#rec')?.checked && !esCombustible()) {
        recurrenteId = uid();
        await db.put('recurrentes', {
          id: recurrenteId, descripcion: base.descripcion || (S.categorias.find((c) => c.id === base.categoriaId)?.nombre ?? 'Gasto fijo'),
          monto, moneda: base.moneda, rubroId: base.rubroId, categoriaId: base.categoriaId, medioId: base.medioId,
          prescindible: base.prescindible, dia: +base.fecha.slice(8), activo: true,
          desdeMes: mesDe(base.fecha), ultimoMes: mesDe(base.fecha),
        });
      }
      await db.put('gastos', { ...base, id, monto, creado: ahora, recurrenteId });
      if (carga.vehiculoId) await actualizarOdometro(carga.vehiculoId);
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
    if (orig.vehiculoId) await actualizarOdometro(orig.vehiculoId, orig.odometro);
    await cargar();
    toast('Eliminado');
    history.back();
  });
}
