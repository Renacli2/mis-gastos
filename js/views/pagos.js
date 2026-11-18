// Servicios a pagar (luz, internet, patente…): lista, alta, edición y baja lógica.
// Rutas: #/pagos · #/pagos/nuevo · #/pagos/<id> (ficha) · #/pagos/<id>/editar · #/pagos/ocultos
import * as db from '../db.js';
import { S, cargar, cat, catsDe, medio } from '../store.js';
import { $, $$, esc, uid, hoy, round2, toast, money, sum } from '../util.js';
import { vacio, engranaje } from '../componentes.js';
import {
  FRECUENCIAS, NOMBRE_FRECUENCIA, DIAS_AVISO, validarServicioPago, pendientesDe, siguienteVencimiento,
  urgencia, textoUrgencia, enlaceSeguro, historialPagos, montoReferencia,
} from '../pagos.js';
import { sincronizarVencimientos, vencimientosActuales, ocultarVencimiento, restaurarVencimiento, deshacerPago } from '../pagos-datos.js';
import { abrirPago } from '../dialogo-pago.js';

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
  if (params[0] === 'ocultos') return ocultos(el);
  if (params[0]) return ficha(el, params[0]);
  lista(el);
}

/**
 * Envuelve el contenido recién dibujado en un contenedor propio y lo devuelve. Los eventos van ahí
 * (y no en el contenedor de la pantalla, que es siempre el mismo) para que no se acumulen al redibujar.
 */
function propio(el) {
  const raiz = document.createElement('div');
  raiz.append(...el.childNodes);
  el.append(raiz);
  return raiz;
}

const fechaCorta = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(2, 4)}`;

/** Fila de un vencimiento oculto con su botón para restaurarlo. */
const filaOculto = (v, conNombre) => `<div class="fila">
  <span>${conNombre ? `<b>${esc(servicioPago(v.servicioId)?.nombre || '—')}</b> ` : ''}<small>vencía el ${fechaLarga(v.fecha)}</small></span>
  <button type="button" class="btn chico" data-restaurar="${esc(v.id)}">Restaurar</button></div>`;

async function alRestaurar(e, volver) {
  const b = e.target.closest('[data-restaurar]'); if (!b) return;
  await restaurarVencimiento(b.dataset.restaurar);
  toast('Vencimiento restaurado'); volver();
}

/** Ficha: próximos vencimientos, monto de referencia, historial de pagos y ocultos del servicio. */
function ficha(el, id) {
  const s = servicioPago(id);
  if (!s) { location.hash = '#/pagos'; return; }
  const hist = historialPagos(s.id, S.vencimientosPago, S.gastos);
  const ref = montoReferencia(s, hist);
  const pendientes = vencimientosActuales().filter((x) => x.servicioId === s.id);
  const ocultosS = S.vencimientosPago.filter((v) => v.servicioId === s.id && v.estado === 'oculto').sort((a, b) => b.fecha.localeCompare(a.fecha));
  const enlace = enlaceSeguro(s.enlace);
  const como = [...new Set([s.appPago, s.medioId ? medio(s.medioId).nombre : ''].filter(Boolean))].join(' · ');
  const anio = hoy().slice(0, 4);
  const delAnio = hist.filter((h) => h.fechaPago.startsWith(anio) && h.moneda === 'ARS');

  el.innerHTML = `
    <div class="cab"><h1 class="titulo">${esc(s.nombre)}</h1>
      <a class="icono-btn" href="#/pagos/${s.id}/editar" aria-label="Editar servicio"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg></a></div>
    <p class="nota">${esc(textoFrecuencia(s))} · ${esc(cat(s.categoriaId).nombre || 'sin categoría')}${como ? ` · ${esc(como)}` : ''}</p>
    ${s.activo === false ? '<p class="card aviso">Este servicio está dado de baja: no genera vencimientos. Podés reactivarlo desde Editar.</p>' : ''}
    ${enlace ? `<a class="btn" href="${esc(enlace)}" target="_blank" rel="noopener noreferrer">Ir a pagar ↗</a>` : ''}

    <div class="kpis" style="margin-top:14px">
      <div class="kpi"><small>${ref?.origen === 'manual' ? 'Monto de referencia' : 'Último pago'}</small><b>${ref ? money(ref.monto, ref.moneda) : '—'}</b>
        <small>${hist[0] ? `pagado el ${fechaCorta(hist[0].fechaPago)}` : ref ? 'cargado a mano' : 'todavía sin pagos'}</small></div>
      <div class="kpi"><small>Pagado en ${anio}</small><b>${money(sum(delAnio.map((h) => h.monto)))}</b>
        <small>${delAnio.length === 1 ? '1 pago' : `${delAnio.length} pagos`}${hist.some((h) => h.moneda !== 'ARS') ? ' en pesos' : ''}</small></div>
    </div>

    <section class="sec">
      <div class="card-tit"><h2>Por pagar</h2></div>
      ${pendientes.length ? `<div class="lista">${pendientes.map((x) => `<div class="fila">
          <span><b>${fechaLarga(x.fecha)}</b> <span class="badge urg-${x.estado}">${esc(x.texto)}</span></span>
          <span class="fila-der"><button type="button" class="btn chico" data-pagar="${esc(x.id)}">Pagar</button>
            <button type="button" class="icono-btn" data-ocultar="${esc(x.id)}" aria-label="Ocultar el vencimiento del ${fechaLarga(x.fecha)}">✕</button></span>
        </div>`).join('')}</div>`
        : vacio(s.activo === false ? 'Sin vencimientos: el servicio está dado de baja.' : 'No hay vencimientos pendientes.')}
    </section>

    <section class="sec">
      <div class="card-tit"><h2>Historial de pagos</h2></div>
      ${hist.length ? `<div class="lista">${hist.map((h) => `<div class="fila">
          <a class="pago-link" href="#/editar/${esc(h.gastoId)}"><b>${money(h.monto, h.moneda)}</b>
            <small>pagado el ${fechaCorta(h.fechaPago)} · vencía el ${fechaCorta(h.vencimiento)}${h.appPago ? ` · ${esc(h.appPago)}` : ''}</small></a>
          <button type="button" class="link" data-deshacer="${esc(h.vencimientoId)}">Deshacer</button>
        </div>`).join('')}</div>
        <p class="nota">Tocá un pago para ver o corregir su gasto.</p>`
        : vacio('Todavía no registraste pagos de este servicio. Tildá un vencimiento en el inicio para cargar el primero.')}
    </section>

    ${ocultosS.length ? `<section class="sec">
      <div class="card-tit"><h2>Ocultos</h2></div>
      <div class="lista">${ocultosS.map((v) => filaOculto(v, false)).join('')}</div>
    </section>` : ''}

    <a class="btn" href="#/pagos">Volver a servicios a pagar</a>`;

  const volver = () => ficha(el, id);
  propio(el).addEventListener('click', async (e) => {
    const pagar = e.target.closest('[data-pagar]');
    if (pagar) { if (await abrirPago(pagar.dataset.pagar)) { toast('Pago registrado y gasto cargado'); volver(); } return; }
    const ocultar = e.target.closest('[data-ocultar]');
    if (ocultar) { await ocultarVencimiento(ocultar.dataset.ocultar); toast('Vencimiento oculto'); volver(); return; }
    const deshacer = e.target.closest('[data-deshacer]');
    if (deshacer) {
      const h = hist.find((x) => x.vencimientoId === deshacer.dataset.deshacer);
      if (!confirm(`¿Deshacer el pago de ${money(h.monto, h.moneda)}? Se borra el gasto y el vencimiento del ${fechaLarga(h.vencimiento)} vuelve a pendiente.`)) return;
      await deshacerPago(h.vencimientoId); toast('Pago deshecho'); volver(); return;
    }
    alRestaurar(e, volver);
  });
}

/** Todos los vencimientos ocultos, para verlos y restaurarlos. */
function ocultos(el) {
  const lista = S.vencimientosPago.filter((v) => v.estado === 'oculto').sort((a, b) => b.fecha.localeCompare(a.fecha));
  el.innerHTML = `
    <h1 class="titulo">Vencimientos ocultos</h1>
    <p class="nota">Los que ocultaste no aparecen en el inicio ni generan gasto. Restaurá uno para que vuelva a quedar pendiente.</p>
    ${lista.length ? `<div class="lista">${lista.map((v) => filaOculto(v, true)).join('')}</div>` : vacio('No hay vencimientos ocultos.')}
    <a class="btn" href="#/pagos">Volver a servicios a pagar</a>`;
  propio(el).addEventListener('click', (e) => alRestaurar(e, () => ocultos(el)));
}

/** Próximo vencimiento pendiente de un servicio (el más viejo primero: puede estar vencido). */
const proximoPendiente = (s) => S.vencimientosPago.find((v) => v.servicioId === s.id && v.estado === 'pendiente') || null;

function lista(el) {
  const activos = S.serviciosPago.filter((s) => s.activo !== false);
  const pausados = S.serviciosPago.filter((s) => s.activo === false);
  const nOcultos = S.vencimientosPago.filter((v) => v.estado === 'oculto').length;
  const fila = (s) => {
    const v = s.activo !== false ? proximoPendiente(s) : null;
    const u = v ? urgencia(v.fecha, hoy(), s.diasAviso ?? DIAS_AVISO) : null;
    const como = [...new Set([s.appPago, s.medioId ? medio(s.medioId).nombre : ''].filter(Boolean))].join(' · ');
    return `<a class="item ${s.activo === false ? 'inactivo' : ''}" href="#/pagos/${s.id}">
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
    <a class="btn primario" href="#/pagos/nuevo">Agregar servicio</a>
    ${nOcultos ? `<a class="btn" href="#/pagos/ocultos">Vencimientos ocultos (${nOcultos})</a>` : ''}`;
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
      <a class="btn" href="${orig ? `#/pagos/${orig.id}` : '#/pagos'}">Cancelar</a>
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
    location.hash = orig ? `#/pagos/${datos.id}` : '#/pagos';
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
    location.hash = `#/pagos/${orig.id}`;
  });
  // Al reactivar no se reclaman los vencimientos del tiempo en pausa.
  $('#p-activar')?.addEventListener('click', async () => {
    await db.put('serviciosPago', { ...orig, activo: true, desde: hoy() });
    await cargar();
    await sincronizarVencimientos();
    toast('Servicio reactivado');
    location.hash = `#/pagos/${orig.id}`;
  });
}
