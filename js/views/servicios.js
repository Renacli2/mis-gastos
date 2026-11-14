import * as db from '../db.js';
import { S, cargar, vehiculo, vehiculosActivos } from '../store.js';
import { $, esc, uid, hoy, round2, toast } from '../util.js';
import { validarServicio, gastoDeServicio } from '../servicios.js';

const parseKm = (v) => { const s = String(v).replace(/\D/g, ''); return s === '' ? NaN : parseInt(s, 10); };
function parseMonto(v) {
  v = String(v).trim();
  if (v === '') return 0;
  // Acepta "85.000", "85000", "85.000,50" o "85000.5"
  if (/,/.test(v) || /^\d{1,3}(\.\d{3})+$/.test(v)) return parseFloat(v.replace(/\./g, '').replace(',', '.'));
  return parseFloat(v);
}

// Rutas: #/servicios/nuevo/<vehiculoId>  ·  #/servicios/<servicioId>
export function render(el, params) {
  const orig = params[0] === 'nuevo' ? null : S.servicios.find((s) => s.id === params[0]);
  if (params[0] !== 'nuevo' && !orig) { location.hash = '#/vehiculos'; return; }

  const vehs = vehiculosActivos();
  if (orig && !vehs.some((v) => v.id === orig.vehiculoId) && vehiculo(orig.vehiculoId)) vehs.push(vehiculo(orig.vehiculoId));
  if (!vehs.length) { location.hash = '#/vehiculos'; return; }

  const gastoPrevio = orig?.gastoId ? S.gastos.find((g) => g.id === orig.gastoId) : null;
  const tipos = [...S.tiposServicio];
  if (orig && !tipos.includes(orig.tipo)) tipos.push(orig.tipo); // tipo que después se quitó de la lista
  const f = orig
    ? { ...orig, medioId: gastoPrevio?.medioId || orig.medioId || S.gastos[0]?.medioId || S.medios[0]?.id }
    : {
        vehiculoId: vehs.some((v) => v.id === params[1]) ? params[1] : vehs[0].id,
        tipo: '', fecha: hoy(), odometro: '', taller: '', notas: '', costo: '', proxKm: null, proxFecha: '',
        medioId: S.gastos[0]?.medioId || S.medios[0]?.id,
      };
  if (!orig) f.odometro = vehiculo(f.vehiculoId).odometro;
  const volver = () => { location.hash = `#/vehiculos/${f.vehiculoId}`; };

  el.innerHTML = `
    <h1 class="titulo">${orig ? 'Editar servicio' : 'Registrar servicio'}</h1>
    <form id="form-s" class="form" autocomplete="off">
      <div class="campo" style="margin-top:0"><span>Vehículo</span><div class="chips" id="s-vehs"></div></div>
      <div class="campo"><span>Tipo de servicio</span><div class="chips" id="s-tipos"></div></div>
      <div class="grid2">
        <label class="campo">Fecha <input id="s-fecha" type="date" value="${f.fecha}" required></label>
        <label class="campo">Odómetro (km) <input id="s-odo" type="text" inputmode="numeric" value="${f.odometro}"></label>
      </div>
      <label class="campo">Taller (opcional)
        <input id="s-taller" type="text" maxlength="50" placeholder="Ej: Lubricentro Sur" value="${esc(f.taller)}"></label>
      <label class="campo">Notas (opcional)
        <input id="s-notas" type="text" maxlength="140" placeholder="Ej: aceite 5W30 sintético y filtro" value="${esc(f.notas)}"></label>

      <div class="bloque">
        <label class="campo" style="margin-top:0">Costo en pesos
          <input id="s-costo" type="text" inputmode="decimal" placeholder="0" value="${f.costo ? String(f.costo).replace('.', ',') : ''}"></label>
        <div id="s-pago" hidden>
          <div class="campo"><span>Medio de pago</span><div class="chips" id="s-medios"></div></div>
          <small id="s-pago-info" style="display:block;margin-top:10px"></small>
        </div>
      </div>

      <div class="bloque">
        <b>Próximo vencimiento</b>
        <small style="display:block">Opcional. Completá los km, la fecha o los dos: avisa lo que ocurra primero.</small>
        <div class="grid2">
          <label class="campo">A los (km) <input id="s-proxkm" type="text" inputmode="numeric" placeholder="Ej: 110000" value="${f.proxKm ?? ''}"></label>
          <label class="campo">O el día <input id="s-proxfecha" type="date" value="${f.proxFecha || ''}"></label>
        </div>
      </div>

      <button class="btn primario" type="submit">${orig ? 'Guardar cambios' : 'Guardar servicio'}</button>
      ${orig ? '<button class="btn peligro" type="button" id="s-borrar">Eliminar servicio</button>' : ''}
      <button class="btn" type="button" id="s-cancelar">Cancelar</button>
    </form>`;

  const chips = (cont, items, sel, attr) => {
    $(cont).innerHTML = items.map((i) =>
      `<button type="button" class="chip ${i.id === sel ? 'sel' : ''}" data-${attr}="${esc(i.id)}">${esc(i.nombre)}</button>`).join('');
  };
  const pintarVehs = () => chips('#s-vehs', vehs.map((v) => ({ id: v.id, nombre: v.alias })), f.vehiculoId, 'veh');
  const pintarTipos = () => chips('#s-tipos', tipos.map((t) => ({ id: t, nombre: t })), f.tipo, 'tipo');
  const pintarPago = () => {
    const costo = parseMonto($('#s-costo').value);
    $('#s-pago').hidden = !(costo > 0);
    chips('#s-medios', S.medios, f.medioId, 'medio');
    $('#s-pago-info').textContent = gastoPrevio
      ? 'Este servicio ya tiene su gasto: se actualiza junto con el servicio.'
      : 'Se registra también como gasto de mantenimiento. No hace falta cargarlo aparte.';
  };
  pintarVehs(); pintarTipos(); pintarPago();

  $('#s-vehs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-veh]'); if (!b) return;
    const odoSugerido = String(vehiculo(f.vehiculoId).odometro);
    f.vehiculoId = b.dataset.veh; pintarVehs();
    // Si el odómetro seguía siendo el sugerido del vehículo anterior, se actualiza al del nuevo
    if (!orig && $('#s-odo').value === odoSugerido) $('#s-odo').value = vehiculo(f.vehiculoId).odometro;
  });
  $('#s-tipos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tipo]'); if (!b) return;
    f.tipo = b.dataset.tipo; pintarTipos();
  });
  $('#s-medios').addEventListener('click', (e) => {
    const b = e.target.closest('[data-medio]'); if (!b) return;
    f.medioId = b.dataset.medio; pintarPago();
  });
  $('#s-costo').addEventListener('input', pintarPago);
  $('#s-cancelar').addEventListener('click', volver);

  $('#form-s').addEventListener('submit', async (e) => {
    e.preventDefault();
    const proxKmTxt = $('#s-proxkm').value.trim();
    const costo = round2(parseMonto($('#s-costo').value));
    const s = {
      ...(orig || { id: uid(), creado: Date.now() }),
      vehiculoId: f.vehiculoId, tipo: f.tipo, fecha: $('#s-fecha').value, odometro: parseKm($('#s-odo').value),
      taller: $('#s-taller').value.trim(), notas: $('#s-notas').value.trim(),
      costo, medioId: costo > 0 ? f.medioId : null,
      proxKm: proxKmTxt ? parseKm(proxKmTxt) : null, proxFecha: $('#s-proxfecha').value || '',
    };
    const error = validarServicio(s);
    if (error) return toast(error);

    // Gasto vinculado: uno solo por servicio. Se crea, se actualiza o se borra junto con él.
    const categoria = S.categorias.find((c) => c.tipo === 'mantenimiento');
    if (costo > 0 && !categoria) return toast('Falta la categoría de mantenimiento. Reabrí la app para que se vuelva a crear.');
    s.gastoId = costo > 0 ? (gastoPrevio?.id || uid()) : null;
    const gasto = gastoDeServicio(s, categoria, vehiculo(s.vehiculoId).alias, gastoPrevio);
    if (gasto) await db.put('gastos', gasto);
    else if (gastoPrevio) await db.del('gastos', gastoPrevio.id);
    await db.put('servicios', s);

    const v = vehiculo(s.vehiculoId);
    if (s.odometro > (v.odometro || 0)) await db.put('vehiculos', { ...v, odometro: s.odometro });
    await cargar();
    toast(orig ? 'Servicio actualizado' : 'Servicio guardado');
    volver();
  });

  $('#s-borrar')?.addEventListener('click', async () => {
    const aviso = gastoPrevio ? '¿Eliminar este servicio? También se elimina su gasto de mantenimiento.' : '¿Eliminar este servicio?';
    if (!confirm(aviso)) return;
    if (gastoPrevio) await db.del('gastos', gastoPrevio.id);
    await db.del('servicios', orig.id);
    await cargar();
    toast('Servicio eliminado');
    volver();
  });
}
