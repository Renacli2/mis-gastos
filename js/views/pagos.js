// Servicios a pagar (luz, internet, patente…): lista, alta, edición y baja lógica.
// Rutas: #/pagos · #/pagos/nuevo · #/pagos/<id>/editar
import * as db from '../db.js';
import { S, cargar, cat, catsDe, medio } from '../store.js';
import { $, $$, esc, uid, hoy, round2, toast } from '../util.js';
import { vacio, engranaje } from '../componentes.js';
import {
  FRECUENCIAS, NOMBRE_FRECUENCIA, DIAS_AVISO, validarServicioPago, pendientesDe, siguienteVencimiento,
  urgencia, textoUrgencia, enlaceSeguro,
} from '../pagos.js';
import { sincronizarVencimientos } from '../pagos-datos.js';

const NINGUNA = '__ninguna';
const OTRA = '__otra';
const servicioPago = (id) => S.serviciosPago.find((s) => s.id === id) || null;
const fechaLarga = (f) => { const [y, m, d] = f.split('-'); return `${d}/${m}/${y}`; };
function parseMonto(v) {
  v = String(v).trim();
  if (v === '') return null;
  if (/,/.test(v) || /^\d{1,3}(\.\d{3})+$/.test(v)) return parseFloat(v.replace(/\./g, '').replace(',', '.'));
  return parseFloat(v);
}

/** "Mensual · día 10" / "Anual · 15/03" / "Única vez · 05/01/2027" */
export function textoFrecuencia(s) {
  const dia = +s.primerVenc.slice(8, 10);
  if (s.frecuencia === 'unica') return `Única vez · ${fechaLarga(s.primerVenc)}`;
  if (s.frecuencia === 'anual') return `Anual · ${s.primerVenc.slice(8, 10)}/${s.primerVenc.slice(5, 7)}`;
  return `${NOMBRE_FRECUENCIA[s.frecuencia]} · día ${dia}`;
}

export function render(el, params) {
  if (params[0] === 'nuevo' || params[1] === 'editar') return formulario(el, params[0]);
  lista(el);
}

/** Próximo vencimiento pendiente de un servicio (el más viejo primero: puede estar vencido). */
const proximoPendiente = (s) => S.vencimientosPago.find((v) => v.servicioId === s.id && v.estado === 'pendiente') || null;

function lista(el) {
  const activos = S.serviciosPago.filter((s) => s.activo !== false);
  const pausados = S.serviciosPago.filter((s) => s.activo === false);
  const fila = (s) => {
    const v = s.activo !== false ? proximoPendiente(s) : null;
    const u = v ? urgencia(v.fecha, hoy(), s.diasAviso ?? DIAS_AVISO) : null;
    const como = [...new Set([s.appPago, s.medioId ? medio(s.medioId).nombre : ''].filter(Boolean))].join(' · ');
    return `<a class="item ${s.activo === false ? 'inactivo' : ''}" href="#/pagos/${s.id}/editar">
      <span class="item-txt"><b>${esc(s.nombre)}</b><small>${esc(textoFrecuencia(s))}${como ? ` · ${esc(como)}` : ''}</small>
        ${s.activo === false ? '<span class="badges"><span class="badge">pausado</span></span>' : ''}</span>
      ${u ? `<span class="item-der"><span class="badge urg-${u.estado}">${esc(textoUrgencia(u, v.fecha))}</span></span>` : ''}
    </a>`;
  };
  el.innerHTML = `
    <div class="cab"><h1 class="titulo">Servicios a pagar</h1>${engranaje}</div>
    <p class="nota">Facturas que vencen todos los meses (o cada tanto) y cuyo monto cambia: luz, internet, patente… La app te recuerda cada vencimiento y, al pagarlo, carga el gasto.</p>
    ${activos.length ? `<div class="lista">${activos.map(fila).join('')}</div>`
      : vacio('Todavía no cargaste ningún servicio a pagar. Agregá uno para que la app te recuerde sus vencimientos.')}
    ${pausados.length ? `<h2 class="subtit">Pausados</h2><div class="lista">${pausados.map(fila).join('')}</div>` : ''}
    <a class="btn primario" href="#/pagos/nuevo">Agregar servicio</a>`;
}

function formulario(el, id) {
  const orig = id === 'nuevo' ? null : servicioPago(id);
  if (id !== 'nuevo' && !orig) { location.hash = '#/pagos'; return; }
  const pend = orig ? proximoPendiente(orig) : null;
  const f = orig
    ? {
        ...orig,
        // La fecha que se edita es el próximo vencimiento; desde ahí se rehace el calendario.
        primerVenc: pend?.fecha || siguienteVencimiento(orig, hoy()) || orig.primerVenc,
      }
    : { nombre: '', categoriaId: null, frecuencia: 'mensual', primerVenc: '', appPago: '', medioId: null, enlace: '', diasAviso: DIAS_AVISO, montoRef: null, activo: true };
  let rubroId = f.categoriaId ? cat(f.categoriaId).rubroId : null;
  const apps = [...S.appsPago];
  if (f.appPago && !apps.includes(f.appPago)) apps.push(f.appPago);   // una app que después se quitó de la lista

  el.innerHTML = `
    <h1 class="titulo">${orig ? 'Editar servicio' : 'Agregar servicio a pagar'}</h1>
    <form id="form-p" class="form" autocomplete="off">
      <label class="campo" style="margin-top:0">Nombre
        <input id="p-nombre" type="text" maxlength="40" placeholder="Ej: Luz, Internet, Patente" value="${esc(f.nombre)}" required></label>

      <div class="campo"><span>Rubro</span><div class="chips" id="p-rubros"></div></div>
      <div class="campo"><span>Categoría del gasto</span><div class="chips" id="p-cats"></div></div>

      <div class="campo"><span>Cada cuánto vence</span><div class="chips" id="p-frec">${Object.keys(FRECUENCIAS).map((k) =>
        `<button type="button" class="chip" data-frec="${k}">${NOMBRE_FRECUENCIA[k]}</button>`).join('')}</div></div>
      <label class="campo">${orig ? 'Próximo vencimiento' : 'Fecha del próximo vencimiento'}
        <input id="p-fecha" type="date" value="${f.primerVenc}" required></label>
      <small id="p-fecha-info" class="ayuda"></small>

      <div class="campo"><span>Dónde lo pagás</span><div class="chips" id="p-apps"></div></div>
      <div class="inline nuevo" id="p-app-nueva" hidden>
        <input class="txt" id="p-app-txt" maxlength="30" placeholder="Ej: Cuenta DNI">
        <button type="button" class="btn chico" id="p-app-ok">Agregar</button></div>

      <div class="campo"><span>Medio de pago</span><div class="chips" id="p-medios"></div></div>

      <label class="campo">Enlace para pagar (opcional)
        <input id="p-enlace" type="text" inputmode="url" autocapitalize="off" spellcheck="false" maxlength="300" placeholder="Ej: https://www.mercadopago.com.ar" value="${esc(f.enlace || '')}"></label>
      <small class="ayuda">Solo la dirección de la web o app. Nunca guardes acá usuarios, claves ni números de tarjeta.</small>

      <div class="grid2">
        <label class="campo">Avisar con (días)
          <input id="p-aviso" type="text" inputmode="numeric" maxlength="2" value="${f.diasAviso ?? DIAS_AVISO}"></label>
        <label class="campo">Monto de referencia (opcional)
          <input id="p-ref" type="text" inputmode="decimal" placeholder="Ej: 30.000" value="${f.montoRef ? String(f.montoRef).replace('.', ',') : ''}"></label>
      </div>
      <small class="ayuda">El monto se ingresa cada vez que pagás. El de referencia es solo una guía hasta que tengas pagos registrados.</small>

      <button class="btn primario" type="submit">${orig ? 'Guardar cambios' : 'Guardar servicio'}</button>
      ${orig ? (orig.activo === false
        ? '<button class="btn" type="button" id="p-activar">Reactivar</button>'
        : '<button class="btn peligro" type="button" id="p-pausar">Dar de baja</button>') : ''}
      <a class="btn" href="#/pagos">Cancelar</a>
    </form>`;

  const chips = (cont, items, sel, attr) => {
    $(cont).innerHTML = items.map((i) =>
      `<button type="button" class="chip ${i.id === sel ? 'sel' : ''}" data-${attr}="${esc(i.id)}"
        ${i.color ? `style="--c:${i.color}"` : ''}>${i.color ? '<i></i>' : ''}${esc(i.nombre)}</button>`).join('') || '<small>—</small>';
  };
  const pintarRubros = () => chips('#p-rubros', S.rubros, rubroId, 'rubro');
  const pintarCats = () => chips('#p-cats', rubroId ? catsDe(rubroId) : [], f.categoriaId, 'cat');
  const pintarFrec = () => $$('#p-frec .chip').forEach((b) => b.classList.toggle('sel', b.dataset.frec === f.frecuencia));
  const pintarApps = () => chips('#p-apps', [
    ...apps.map((a) => ({ id: a, nombre: a })), { id: NINGUNA, nombre: 'Sin definir' }, { id: OTRA, nombre: '+ Otra' },
  ], f.appPago || NINGUNA, 'app');
  const pintarMedios = () => chips('#p-medios', [...S.medios, { id: NINGUNA, nombre: 'Sin definir' }], f.medioId || NINGUNA, 'medio');
  const pintarFecha = () => {
    const v = $('#p-fecha').value;
    if (!v) { $('#p-fecha-info').textContent = ''; return; }
    const dia = +v.slice(8, 10);
    const partes = [];
    if (f.frecuencia === 'mensual') partes.push(`Vence el día ${dia} de cada mes.`);
    else if (f.frecuencia === 'bimestral') partes.push(`Vence el día ${dia}, cada dos meses.`);
    else if (f.frecuencia === 'trimestral') partes.push(`Vence el día ${dia}, cada tres meses.`);
    else if (f.frecuencia === 'anual') partes.push('Vence una vez por año, en esa fecha.');
    else partes.push('Vence una sola vez.');
    if (dia > 28 && f.frecuencia !== 'unica') partes.push('En los meses sin ese día, vence el último día del mes.');
    if (v < hoy()) partes.push('Es una fecha pasada: va a aparecer como vencido.');
    $('#p-fecha-info').textContent = partes.join(' ');
  };
  pintarRubros(); pintarCats(); pintarFrec(); pintarApps(); pintarMedios(); pintarFecha();

  $('#p-rubros').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rubro]'); if (!b) return;
    rubroId = b.dataset.rubro;
    const cs = catsDe(rubroId);
    f.categoriaId = cs.length === 1 ? cs[0].id : null;
    pintarRubros(); pintarCats();
  });
  $('#p-cats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    f.categoriaId = b.dataset.cat; pintarCats();
  });
  $('#p-frec').addEventListener('click', (e) => {
    const b = e.target.closest('[data-frec]'); if (!b) return;
    f.frecuencia = b.dataset.frec; pintarFrec(); pintarFecha();
  });
  $('#p-fecha').addEventListener('input', pintarFecha);
  $('#p-apps').addEventListener('click', (e) => {
    const b = e.target.closest('[data-app]'); if (!b) return;
    if (b.dataset.app === OTRA) { $('#p-app-nueva').hidden = false; $('#p-app-txt').focus(); return; }
    f.appPago = b.dataset.app === NINGUNA ? '' : b.dataset.app;
    $('#p-app-nueva').hidden = true; pintarApps();
  });
  // Una app nueva se suma a la lista editable (Ajustes → Servicios a pagar) y queda elegida.
  $('#p-app-ok').addEventListener('click', async () => {
    const nombre = $('#p-app-txt').value.trim(); if (!nombre) return;
    const existente = apps.find((a) => a.toLowerCase() === nombre.toLowerCase());
    if (!existente) {
      apps.push(nombre);
      await db.setConfig('appsPago', [...S.appsPago, nombre]);
      S.appsPago = [...S.appsPago, nombre];
    }
    f.appPago = existente || nombre;
    $('#p-app-txt').value = ''; $('#p-app-nueva').hidden = true; pintarApps();
  });
  $('#p-app-txt').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#p-app-ok').click(); } });
  $('#p-medios').addEventListener('click', (e) => {
    const b = e.target.closest('[data-medio]'); if (!b) return;
    f.medioId = b.dataset.medio === NINGUNA ? null : b.dataset.medio; pintarMedios();
  });

  /** Guarda el servicio y rehace sus vencimientos pendientes (los pagados y ocultos no se tocan). */
  const guardar = async (datos, mensaje) => {
    await db.put('serviciosPago', datos);
    if (orig) await db.delMany('vencimientosPago', pendientesDe(datos.id, S.vencimientosPago));
    await cargar();
    await sincronizarVencimientos();
    toast(mensaje);
    location.hash = '#/pagos';
  };

  $('#form-p').addEventListener('submit', async (e) => {
    e.preventDefault();
    const enlace = $('#p-enlace').value.trim();
    const datos = {
      ...(orig || { id: uid(), creado: Date.now(), activo: true }),
      nombre: $('#p-nombre').value.trim(),
      categoriaId: f.categoriaId,
      frecuencia: f.frecuencia,
      primerVenc: $('#p-fecha').value,
      appPago: f.appPago || '',
      medioId: f.medioId || null,
      enlace: enlace ? enlaceSeguro(enlace) || enlace : '',
      diasAviso: parseInt($('#p-aviso').value, 10),
      montoRef: parseMonto($('#p-ref').value),
    };
    if (Number.isNaN(datos.diasAviso)) datos.diasAviso = DIAS_AVISO;
    if (datos.montoRef !== null) datos.montoRef = round2(datos.montoRef);
    const error = validarServicioPago(datos);
    if (error) return toast(error);
    if (!orig && S.serviciosPago.some((s) => s.activo !== false && s.nombre.toLowerCase() === datos.nombre.toLowerCase())
      && !confirm(`Ya tenés un servicio activo llamado “${datos.nombre}”. ¿Agregarlo igual?`)) return;
    await guardar(datos, orig ? 'Servicio actualizado' : 'Servicio guardado');
  });

  // Baja lógica: el servicio y su historial se conservan; deja de generar y mostrar vencimientos.
  $('#p-pausar')?.addEventListener('click', async () => {
    if (!confirm(`¿Dar de baja “${orig.nombre}”? Deja de aparecer en los vencimientos. Los pagos ya registrados y sus gastos se conservan, y podés reactivarlo cuando quieras.`)) return;
    await db.put('serviciosPago', { ...orig, activo: false });
    await cargar();
    toast('Servicio dado de baja');
    location.hash = '#/pagos';
  });
  // Al reactivar no se reclaman los vencimientos del tiempo en pausa.
  $('#p-activar')?.addEventListener('click', async () => {
    await db.put('serviciosPago', { ...orig, activo: true, desde: hoy() });
    await cargar();
    await sincronizarVencimientos();
    toast('Servicio reactivado');
    location.hash = '#/pagos';
  });
}
