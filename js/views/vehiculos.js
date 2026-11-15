import * as db from '../db.js';
import { S, cargar, vehiculo, vehiculosActivos, cat, aARS } from '../store.js';
import { costosVehiculo } from '../costos.js';
import { cargasDe } from '../combustible.js';
import { resumenConsumo } from '../consumo.js';
import { historial } from '../servicios.js';
import { vencimientosDe, textoVencimiento } from '../vencimientos.js';
import { chart } from '../charts.js';
import { $, $$, esc, uid, toast, money, hoy } from '../util.js';
import { vacio, engranaje, itemGasto, filaVencimiento } from '../componentes.js';

export const COMBUSTIBLES = ['Nafta', 'Nafta premium', 'Diésel', 'GNC', 'Eléctrico', 'Híbrido'];
export const km = (n) => `${Math.round(n || 0).toLocaleString('es-AR')} km`;
const entero = (v) => parseInt(String(v).replace(/\D/g, ''), 10);

/** Gastos de combustible cargados antes de tener vehículos (o sin elegir uno). */
export const cargasSinVehiculo = () => S.gastos.filter((g) => !g.vehiculoId && cat(g.categoriaId).tipo === 'combustible');

export function render(el, params) {
  if (params[0] === 'asociar') return asociar(el);
  if (params[0] === 'nuevo' || params[1] === 'editar') return formulario(el, params[0]);
  if (params[0]) return ficha(el, params[0]);
  lista(el);
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
function etiquetas(v) {
  if (v.activo === false) return '<span class="badges"><span class="badge">inactivo</span></span>';
  const vs = vencimientosDe(S.servicios, v, hoy());
  const venc = vs.filter((x) => x.estado === 'vencido').length;
  const prox = vs.filter((x) => x.estado === 'proximo').length;
  if (!venc && !prox) return '';
  return `<span class="badges">${venc ? `<span class="badge vencido">${plural(venc, 'servicio vencido', 'servicios vencidos')}</span>` : ''}${prox ? `<span class="badge proximo">${plural(prox, 'próximo', 'próximos')}</span>` : ''}</span>`;
}

function lista(el) {
  const fila = (v) => {
    const detalle = [[v.marca, v.modelo, v.anio].filter(Boolean).join(' '), v.patente].filter(Boolean).join(' · ');
    return `<a class="item ${v.activo === false ? 'inactivo' : ''}" href="#/vehiculos/${v.id}">
      <span class="item-txt"><b>${esc(v.alias)}</b><small>${esc(detalle || v.combustible)}</small>
        ${etiquetas(v)}</span>
      <span class="item-der"><span class="item-monto">${km(v.odometro)}</span><small>${esc(v.combustible)}</small></span>
    </a>`;
  };
  const sueltas = vehiculosActivos().length ? cargasSinVehiculo().length : 0;
  el.innerHTML = `
    <div class="cab"><h1 class="titulo">Vehículos</h1>${engranaje}</div>
    ${sueltas ? `<a class="card aviso" href="#/vehiculos/asociar">Tenés ${plural(sueltas, 'gasto', 'gastos')} de combustible sin vehículo. <b>Asociarlos</b></a>` : ''}
    ${S.vehiculos.length
      ? `<div class="lista">${S.vehiculos.map(fila).join('')}</div>`
      : vacio('Todavía no cargaste ningún vehículo. Agregá uno para registrar su combustible y sus servicios.')}
    <a class="btn primario" href="#/vehiculos/nuevo">Agregar vehículo</a>`;
}

function formulario(el, id) {
  const orig = id === 'nuevo' ? null : vehiculo(id);
  if (id !== 'nuevo' && !orig) { location.hash = '#/vehiculos'; return; }
  const f = orig ? { ...orig } : { alias: '', patente: '', marca: '', modelo: '', anio: '', combustible: COMBUSTIBLES[0], odometro: '', activo: true };
  const anioMax = new Date().getFullYear() + 1;

  el.innerHTML = `
    <h1 class="titulo">${orig ? 'Editar vehículo' : 'Agregar vehículo'}</h1>
    <form id="form-v" class="form" autocomplete="off">
      <label class="campo">Nombre o alias
        <input id="v-alias" type="text" maxlength="30" placeholder="Ej: El Gol" value="${esc(f.alias)}" required></label>
      <label class="campo">Patente
        <input id="v-patente" type="text" maxlength="10" placeholder="Ej: AB123CD" value="${esc(f.patente)}" style="text-transform:uppercase"></label>
      <div class="grid2">
        <label class="campo">Marca <input id="v-marca" type="text" maxlength="30" value="${esc(f.marca)}"></label>
        <label class="campo">Modelo <input id="v-modelo" type="text" maxlength="30" value="${esc(f.modelo)}"></label>
      </div>
      <div class="grid2">
        <label class="campo">Año <input id="v-anio" type="text" inputmode="numeric" maxlength="4" value="${f.anio || ''}"></label>
        <label class="campo">Odómetro actual (km) <input id="v-odo" type="text" inputmode="numeric" value="${f.odometro === '' ? '' : f.odometro}" required></label>
      </div>
      <div class="campo"><span>Tipo de combustible</span>
        <div class="chips" id="v-comb">${COMBUSTIBLES.map((c) =>
          `<button type="button" class="chip ${c === f.combustible ? 'sel' : ''}" data-c="${c}">${c}</button>`).join('')}</div></div>
      ${orig ? `<label class="switch"><input type="checkbox" id="v-activo" ${f.activo !== false ? 'checked' : ''}>
        <span><b>Activo</b><small>Un vehículo inactivo no aparece al cargar combustible o servicios. Su historial se conserva.</small></span></label>` : ''}
      <button class="btn primario" type="submit">${orig ? 'Guardar cambios' : 'Guardar vehículo'}</button>
      <a class="btn" href="${orig ? `#/vehiculos/${orig.id}` : '#/vehiculos'}">Cancelar</a>
    </form>`;

  $('#v-comb').addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    f.combustible = b.dataset.c;
    $$('#v-comb .chip').forEach((x) => x.classList.toggle('sel', x === b));
  });

  $('#form-v').addEventListener('submit', async (e) => {
    e.preventDefault();
    const alias = $('#v-alias').value.trim();
    const patente = $('#v-patente').value.trim().toUpperCase().replace(/\s+/g, '');
    const anioTxt = $('#v-anio').value.trim();
    const anio = anioTxt ? entero(anioTxt) : null;
    const odometro = entero($('#v-odo').value);
    if (!alias) return toast('Poné un nombre para el vehículo');
    if (anioTxt && !(anio >= 1950 && anio <= anioMax)) return toast(`El año debe estar entre 1950 y ${anioMax}`);
    if (!(odometro >= 0)) return toast('Ingresá el odómetro actual en km');
    if (patente && S.vehiculos.some((v) => v.id !== orig?.id && v.patente === patente)) return toast('Ya hay un vehículo con esa patente');

    await db.put('vehiculos', {
      ...(orig || { id: uid(), creado: Date.now() }),
      alias, patente, marca: $('#v-marca').value.trim(), modelo: $('#v-modelo').value.trim(), anio,
      combustible: f.combustible, odometro,
      activo: orig ? $('#v-activo').checked : true,
    });
    await cargar();
    toast('Vehículo guardado');
    location.hash = orig ? `#/vehiculos/${orig.id}` : '#/vehiculos';
  });
}

const dec = (n, d = 1) => n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fechaCorta = (f) => { const [y, m, d] = f.split('-'); return `${d}/${m}/${y.slice(2)}`; };

function bloqueConsumo(r) {
  if (r.estado === 'sin-cargas') {
    return vacio('Todavía no hay cargas de combustible para este vehículo. Cargá un gasto en la categoría Combustible y elegí este vehículo.');
  }
  if (r.estado === 'faltan-llenos') {
    return vacio(`Para calcular el consumo hacen falta dos cargas con <b>tanque lleno</b>. ${r.llenos === 1 ? 'Ya tenés una: falta la próxima.' : 'Todavía no hay ninguna.'}`);
  }
  const dato = (titulo, p, pie) => `<div class="kpi"><small>${titulo}</small>
    <b>${dec(p.l100)}<span class="uni"> l/100 km</span></b><small>${dec(p.kml)} km/l · ${pie}</small></div>`;
  const u = r.ultimo;
  return `
    <div class="kpis consumo">
      ${dato('Último tramo', u, `${u.km.toLocaleString('es-AR')} km`)}
      ${dato(r.ultimosN.tramos < r.n ? `Últimos ${r.ultimosN.tramos} tramos` : `Últimos ${r.n} tramos`, r.ultimosN, `${r.ultimosN.km.toLocaleString('es-AR')} km`)}
      ${dato('Promedio histórico', r.historico, `${r.historico.tramos} ${r.historico.tramos === 1 ? 'tramo' : 'tramos'}`)}
    </div>
    ${r.tramos.length > 1 ? '<div class="graf graf-chico"><canvas id="c-consumo"></canvas></div>'
      : '<p class="nota">El gráfico de evolución aparece a partir del segundo tramo.</p>'}
    <div class="tramos">
      ${[...r.tramos].reverse().slice(0, 6).map((t) => `<div class="fila">
        <span>${fechaCorta(t.desde)} al ${fechaCorta(t.hasta)}<small> · ${t.km.toLocaleString('es-AR')} km, ${dec(t.litros)} L${t.parciales ? `, ${t.parciales} ${t.parciales === 1 ? 'parcial' : 'parciales'}` : ''}</small></span>
        <span class="der"><b>${dec(t.l100)}</b><small>l/100 km</small></span></div>`).join('')}
    </div>`;
}

function ficha(el, id) {
  const v = vehiculo(id);
  if (!v) { location.hash = '#/vehiculos'; return; }
  const cargas = cargasDe(S.gastos, v.id);
  const r = resumenConsumo(cargas);
  const detalle = [[v.marca, v.modelo, v.anio].filter(Boolean).join(' '), v.patente, v.combustible].filter(Boolean).join(' · ');
  const ultimas = S.gastos.filter((g) => g.vehiculoId === v.id && g.litros > 0).slice(0, 5);
  const servicios = historial(S.servicios, v.id);
  const vencs = vencimientosDe(S.servicios, v, hoy());
  const c = costosVehiculo(S.gastos, S.servicios, v.id, aARS, (id) => cat(id).tipo);
  const filaCosto = (nombre, monto) => `<div class="fila"><span>${nombre}</span>
    <span class="der"><b>${money(monto)}</b><small>${c.total ? Math.round((monto / c.total) * 100) : 0}%</small></span></div>`;
  const filaServicio = (s) => `<a class="item" href="#/servicios/${s.id}">
      <span class="item-txt"><b>${esc(s.tipo)}</b>
        <small>${[fechaCorta(s.fecha), km(s.odometro), s.taller].filter(Boolean).map(esc).join(' · ')}</small>
        ${s.notas ? `<small>${esc(s.notas)}</small>` : ''}</span>
      <span class="item-der"><span class="item-monto">${s.costo > 0 ? money(s.costo) : '—'}</span>${s.costo > 0 ? '' : '<small>sin costo</small>'}</span>
    </a>`;

  el.innerHTML = `
    <a class="link volver" href="#/vehiculos">‹ Vehículos</a>
    <div class="cab"><h1 class="titulo">${esc(v.alias)}</h1>
      <a class="btn chico" href="#/vehiculos/${v.id}/editar" style="margin-bottom:22px">Editar</a></div>
    <p class="nota" style="margin-top:-10px">${esc(detalle)}${v.activo === false ? ' · inactivo' : ''}</p>

    <section class="hero odo">
      <span class="lead">Odómetro</span>
      <div class="total">${Math.round(v.odometro || 0).toLocaleString('es-AR')}<i class="km"> km</i></div>
    </section>

    <section class="sec"><h2>Próximos vencimientos</h2>
      ${vencs.length ? `<div class="lista">${vencs.map((x) => filaVencimiento(x, textoVencimiento(x))).join('')}</div>
        <p class="nota">Tocá un vencimiento para registrar ese servicio.</p>`
        : vacio('Sin vencimientos cargados. Al registrar un servicio podés indicar cuándo toca el próximo, por km o por fecha.')}
    </section>

    <section class="sec"><h2>Consumo</h2>${bloqueConsumo(r)}</section>

    <section class="sec costos">
      <div class="card-tit"><h2>Costos</h2><a class="link" href="#/gastos/vehiculo/${v.id}">Ver gastos</a></div>
      ${c.total ? `
        <div class="kpis" style="margin-top:10px">
          <div class="kpi"><small>Costo total</small><b>${money(c.total)}</b></div>
          <div class="kpi"><small>Costo por km</small><b>${c.porKm ? money(c.porKm) : '—'}</b></div>
        </div>
        ${filaCosto('Combustible', c.combustible)}${filaCosto('Servicios', c.servicios)}${filaCosto('Otros gastos', c.otros)}
        <p class="nota">${c.porKm
          ? `Costo por km sobre los ${c.km.toLocaleString('es-AR')} km registrados, del primer al último odómetro cargado.`
          : 'El costo por km aparece cuando haya al menos dos registros de odómetro distintos (cargas o servicios).'}</p>`
        : vacio('Todavía no hay gastos asociados a este vehículo.')}
    </section>

    <section class="sec">
      <div class="card-tit"><h2>Servicios</h2>${v.activo === false ? '' : `<a class="btn chico" href="#/servicios/nuevo/${v.id}">Registrar servicio</a>`}</div>
      ${servicios.length ? `<div class="lista">${servicios.map(filaServicio).join('')}</div>`
        : vacio('Todavía no registraste servicios para este vehículo.')}
    </section>

    <section class="sec"><div class="card-tit"><h2>Últimas cargas</h2></div>
      ${ultimas.length ? `<div class="lista">${ultimas.map(itemGasto).join('')}</div>` : vacio('Sin cargas registradas.')}
    </section>`;

  if (r.tramos.length > 1) {
    chart($('#c-consumo'), {
      type: 'line',
      data: {
        labels: r.tramos.map((t) => fechaCorta(t.hasta)),
        datasets: [{ data: r.tramos.map((t) => +t.l100.toFixed(2)), borderColor: '#f2b705', backgroundColor: '#f2b705', tension: 0, pointRadius: 4, borderWidth: 3 }],
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${dec(c.parsed.y)} l/100 km` } } },
        scales: { x: { grid: { display: false } }, y: { title: { display: true, text: 'l/100 km' }, ticks: { callback: (x) => dec(x, 0) } } },
      },
    });
  }
}

function asociar(el) {
  const vehs = vehiculosActivos();
  const pendientes = cargasSinVehiculo();
  if (!vehs.length) { location.hash = '#/vehiculos'; return; }
  let elegido = vehs[0].id;

  el.innerHTML = `
    <a class="link volver" href="#/vehiculos">‹ Vehículos</a>
    <h1 class="titulo">Asociar cargas</h1>
    ${pendientes.length ? `
      <p class="nota">Estos gastos de combustible no tienen vehículo. Al asociarlos pasan a contar en el costo del vehículo.
        Para que también cuenten en el consumo, tocá uno y completá los litros y el odómetro.</p>
      <div class="campo"><span>Asociar a</span><div class="chips" id="a-vehs"></div></div>
      <div class="lista" style="margin-top:14px">
        ${pendientes.map((g) => `<div class="item">
          <input type="checkbox" class="a-chk" value="${g.id}" checked aria-label="Incluir el gasto del ${g.fecha.split('-').reverse().join('/')}">
          <a class="item-txt" href="#/editar/${g.id}"><b>${g.fecha.split('-').reverse().join('/')}</b><small>${esc(g.descripcion || cat(g.categoriaId).nombre)} · tocá para completar litros</small></a>
          <span class="item-monto">${money(g.monto, g.moneda)}</span></div>`).join('')}
      </div>
      <button class="btn primario" id="a-ok"></button>`
      : vacio('No quedan gastos de combustible sin vehículo.')}`;
  if (!pendientes.length) return;

  const marcados = () => $$('.a-chk', el).filter((x) => x.checked).map((x) => x.value);
  const pintar = () => {
    $('#a-vehs').innerHTML = vehs.map((v) => `<button type="button" class="chip ${v.id === elegido ? 'sel' : ''}" data-v="${v.id}">${esc(v.alias)}</button>`).join('');
    const n = marcados().length;
    $('#a-ok').textContent = `Asociar ${plural(n, 'gasto', 'gastos')} a ${vehiculo(elegido).alias}`;
    $('#a-ok').disabled = !n;
  };
  pintar();
  $('#a-vehs').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { elegido = b.dataset.v; pintar(); } });
  $$('.a-chk', el).forEach((x) => x.addEventListener('change', pintar));
  $('#a-ok').addEventListener('click', async () => {
    const ids = new Set(marcados());
    const cambios = pendientes.filter((g) => ids.has(g.id)).map((g) => ({ ...g, vehiculoId: elegido }));
    await db.putMany('gastos', cambios);
    await cargar();
    toast(`${plural(cambios.length, 'gasto asociado', 'gastos asociados')} a ${vehiculo(elegido).alias}`);
    location.hash = `#/vehiculos/${elegido}`;
  });
}
