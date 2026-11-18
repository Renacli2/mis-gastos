import { S, aARS, delMes, rubro, cargar } from '../store.js';
import { $, $$, esc, money, pct, sum, sumarMeses, hoy, mesActual, toast, nombreMes, diasDelMes } from '../util.js';
import { selectorMes, itemGasto, vacio, barra, filaVencimiento } from '../componentes.js';
import { avisos, textoVencimiento } from '../vencimientos.js';
import { pendientes, cargarPendiente, omitirPendiente } from '../recurrentes.js';
import { paraTarjeta } from '../pagos.js';
import { vencimientosActuales, ocultarVencimiento, restaurarVencimiento } from '../pagos-datos.js';
import { htmlTarjeta, montarTarjeta } from '../tarjeta-vencimientos.js';

// Vencimientos recién ocultados: se ofrece deshacer mientras sigas en el inicio.
let ocultados = [];
let conservarOcultados = false;

const entero = (n) => Math.round(n).toLocaleString('es-AR');

/** Una barra por día del mes: lo gastado ese día. Los días que faltan quedan vacíos. */
function calendario(gm, mes, esActual) {
  const n = diasDelMes(mes);
  const hoyDia = esActual ? +hoy().slice(8) : null;
  const porDia = Array(n).fill(0);
  gm.forEach((g) => { porDia[+g.fecha.slice(8) - 1] += aARS(g); });
  const max = Math.max(...porDia, 1);
  const barras = porDia.map((v, i) => {
    const d = i + 1;
    if (hoyDia && d > hoyDia) return '<span class="vacio"></span>';
    const alto = v ? 8 + Math.sqrt(v / max) * 54 : 3;
    return `<span class="${d === hoyDia ? 'hoy' : ''}" style="height:${alto.toFixed(1)}px"></span>`;
  }).join('');
  return `<div class="tira" role="img" aria-label="Gasto de cada día de ${nombreMes(mes)}">${barras}</div>
    <div class="escala"><span>1</span><span>10</span><span>20</span><span>${n}</span></div>`;
}

export function render(el) {
  const mes = S.mes;
  const esActual = mes === mesActual();
  const gm = delMes(mes);
  const total = sum(gm.map(aARS));
  const usd = sum(gm.filter((g) => g.moneda === 'USD').map((g) => g.monto));
  const mesPrev = sumarMeses(mes, -1);
  const gPrev = delMes(mesPrev);
  const prev = sum(gPrev.map(aARS));
  const pend = pendientes();
  const hayUSD = S.gastos.some((g) => g.moneda === 'USD');
  const venc = avisos(S.servicios, S.vehiculos, hoy());
  if (!conservarOcultados) ocultados = [];
  conservarOcultados = false;
  const tarjetaPagos = htmlTarjeta({
    ...paraTarjeta(vencimientosActuales()),
    hayServicios: S.serviciosPago.some((s) => s.activo !== false),
    ocultados,
  });

  // Ritmo: lo gastado hasta hoy vs. lo que llevabas el mes anterior al mismo día
  const dia = esActual ? +hoy().slice(8) : 31;
  const totalHasta = esActual ? sum(gm.filter((g) => g.fecha <= hoy()).map(aARS)) : total;
  const prevHasta = sum(gPrev.filter((g) => +g.fecha.slice(8) <= dia).map(aARS));
  const nombrePrev = nombreMes(mesPrev).split(' ')[0];
  const dif = totalHasta - prevHasta;
  const base = esActual ? prevHasta : prev;
  const variacion = base > 0 ? ((totalHasta - base) / base) * 100 : null;
  const ritmo = prev > 0 ? `
    <div class="ritmo">
      <p>${esActual
        ? `Llevás <b>${money(Math.abs(dif))} ${dif > 0 ? 'más' : 'menos'}</b> que en ${esc(nombrePrev)} al día ${dia}.`
        : `${esc(nombrePrev[0].toUpperCase() + nombrePrev.slice(1))} cerró en <b>${money(prev)}</b>.`}</p>
      ${variacion !== null ? `<span class="pct ${variacion < 0 ? 'baja' : ''}">${pct(variacion)}</span>` : ''}
    </div>` : '';

  const presup = S.rubros
    .filter((r) => S.presupuestos[r.id] > 0)
    .map((r) => ({ r, gastado: sum(gm.filter((g) => g.rubroId === r.id).map(aARS)), tope: S.presupuestos[r.id] }))
    .sort((a, b) => b.gastado / b.tope - a.gastado / a.tope);

  const limite = esActual ? hoy() : `${mes}-31`;
  const ultimos = gm.filter((g) => g.fecha <= limite).slice(0, 6);

  el.innerHTML = `
    ${selectorMes()}
    <section class="hero">
      <span class="lead">${esActual ? 'Gastaste este mes' : 'Gastaste en el mes'}</span>
      <div class="total"><i>$</i>${entero(total)}</div>
      ${usd ? `<small>Incluye ${money(usd, 'USD')} a $${S.cot ? entero(S.cot) : '?'} por dólar</small>` : ''}
      ${calendario(gm, mes, esActual)}
      ${ritmo}
    </section>

    ${hayUSD && !S.cot ? '<a class="card aviso" href="#/ajustes/dolar" style="margin-top:14px">Cargá la cotización del dólar en Ajustes para convertir tus gastos en USD.</a>' : ''}

    ${tarjetaPagos}

    ${venc.length ? `<section class="card" style="margin-top:14px">
      <div class="card-tit"><h2>Servicios del vehículo</h2><a href="#/vehiculos" class="link">Ver vehículos</a></div>
      <div class="lista">${venc.map((x) => filaVencimiento(x, textoVencimiento(x), true)).join("")}</div>
    </section>` : ""}

    ${pend.length ? `<section class="card" style="margin-top:14px">
      <div class="card-tit"><h2>Gastos fijos pendientes</h2><button class="btn chico" id="cargar-todos">Cargar ${pend.length > 1 ? `los ${pend.length}` : 'el gasto'}</button></div>
      ${pend.map((p, i) => `<div class="fila">
        <span>${esc(p.r.descripcion)} <small>${p.fecha.split('-').reverse().join('/')}</small></span>
        <span class="fila-der">${money(p.r.monto, p.r.moneda)}
          <button class="icono-btn ok" data-cargar="${i}" aria-label="Cargar">✓</button>
          <button class="icono-btn" data-omitir="${i}" aria-label="Omitir">✕</button></span>
      </div>`).join('')}
    </section>` : ''}

    <section class="sec">
      <div class="card-tit"><h2>Presupuestos</h2><a href="#/ajustes/presupuestos" class="link">Editar</a></div>
      ${presup.length ? presup.map(({ r, gastado, tope }) => `<div class="tope">
          <div class="fila"><b>${esc(r.nombre)}</b><span><span class="num ${gastado > tope ? 'sube' : ''}">${money(gastado)}</span> <small>de ${money(tope)}</small></span></div>
          ${barra(gastado, tope)}
        </div>`).join('') : vacio('Definí un tope mensual por rubro para controlar tus gastos.')}
    </section>

    <section class="sec">
      <div class="card-tit"><h2>Últimos gastos</h2><a href="#/gastos" class="link">Ver todos</a></div>
      ${ultimos.length ? `<div class="lista">${ultimos.map(itemGasto).join('')}</div>` : vacio('Todavía no hay gastos este mes. Tocá <b>Cargar</b> para sumar uno.')}
    </section>`;

  const listo = async (msg) => { await cargar(); toast(msg); S.rerender(); };

  montarTarjeta(el, {
    // El diálogo de pago llega en la etapa (d).
    onPagar: () => toast('Pronto: acá vas a cargar el monto pagado'),
    onOcultar: async (id) => {
      const v = await ocultarVencimiento(id);
      if (!v) return;
      const s = S.serviciosPago.find((x) => x.id === v.servicioId);
      ocultados = [...ocultados, { id, nombre: s?.nombre || '', fecha: v.fecha }];
      conservarOcultados = true; S.rerender();
    },
    onDeshacer: async (id) => {
      await restaurarVencimiento(id);
      ocultados = ocultados.filter((o) => o.id !== id);
      conservarOcultados = true; S.rerender();
    },
  });
  $('#cargar-todos')?.addEventListener('click', async () => {
    for (const p of pend) await cargarPendiente(p);
    listo(pend.length > 1 ? `${pend.length} gastos fijos cargados` : 'Gasto cargado');
  });
  $$('[data-cargar]', el).forEach((b) => b.addEventListener('click', async () => {
    await cargarPendiente(pend[+b.dataset.cargar]); listo('Gasto cargado');
  }));
  $$('[data-omitir]', el).forEach((b) => b.addEventListener('click', async () => {
    await omitirPendiente(pend[+b.dataset.omitir]); listo('Omitido');
  }));
}
