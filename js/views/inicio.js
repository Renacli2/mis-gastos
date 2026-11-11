import { S, aARS, delMes, rubro } from '../store.js';
import { $, $$, esc, money, pct, sum, sumarMeses, hoy, mesActual, toast, nombreMes } from '../util.js';
import { selectorMes, itemGasto, vacio, barra } from '../componentes.js';
import { pendientes, cargarPendiente, omitirPendiente } from '../recurrentes.js';
import { cargar } from '../store.js';

export function render(el) {
  const mes = S.mes;
  const gm = delMes(mes);
  const total = sum(gm.map(aARS));
  const usd = sum(gm.filter((g) => g.moneda === 'USD').map((g) => g.monto));
  const mesPrev = sumarMeses(mes, -1);
  const gPrev = delMes(mesPrev);
  const prev = sum(gPrev.map(aARS));

  // Ritmo: lo gastado hasta hoy vs. lo que llevabas el mes anterior al mismo día
  const esActual = mes === mesActual();
  const dia = esActual ? +hoy().slice(8) : 31;
  const totalHasta = esActual ? sum(gm.filter((g) => g.fecha <= hoy()).map(aARS)) : total;
  const prevHasta = sum(gPrev.filter((g) => +g.fecha.slice(8) <= dia).map(aARS));
  const nombrePrev = nombreMes(mesPrev).split(' ')[0];
  const dif = totalHasta - prevHasta;
  const varRitmo = prevHasta > 0 ? (dif / prevHasta) * 100 : null;
  const ritmo = prev > 0 ? `
      <div class="ritmo">
        <div class="pista" role="img" aria-label="Gastado: ${Math.round((totalHasta / prev) * 100)}% del total de ${nombrePrev}">
          <div class="pista-fill" style="width:${Math.min(totalHasta / prev, 1) * 100}%"></div>
          ${esActual ? `<div class="pista-marca" style="left:${Math.min(prevHasta / prev, 1) * 100}%"></div>` : ''}
        </div>
        <div class="ritmo-txt">
          <span>${esActual
            ? `Llevás <b>${money(Math.abs(dif))} ${dif > 0 ? 'más' : 'menos'}</b> que en ${nombrePrev} a esta altura del mes.`
            : `${nombrePrev[0].toUpperCase() + nombrePrev.slice(1)} cerró en ${money(prev)}.`}</span>
          ${varRitmo !== null ? `<span class="delta">${pct(varRitmo)}</span>` : ''}
        </div>
        ${esActual ? `<div class="leyenda"><span><i></i>Este mes</span><span><i class="marca"></i>${esc(nombrePrev)} al día ${dia}</span></div>` : ''}
      </div>` : '';
  const pend = pendientes();
  const hayUSD = S.gastos.some((g) => g.moneda === 'USD');

  const presup = S.rubros
    .filter((r) => S.presupuestos[r.id] > 0)
    .map((r) => {
      const gastado = sum(gm.filter((g) => g.rubroId === r.id).map(aARS));
      return { r, gastado, tope: S.presupuestos[r.id] };
    })
    .sort((a, b) => b.gastado / b.tope - a.gastado / a.tope);

  const limite = mes === mesActual() ? hoy() : `${mes}-31`;
  const ultimos = gm.filter((g) => g.fecha <= limite).slice(0, 6);

  el.innerHTML = `
    ${selectorMes()}
    <section class="hero">
      <small>${esActual ? 'Gastaste este mes' : 'Gastaste en el mes'}</small>
      <div class="total">${money(total)}</div>
      ${usd ? `<small>Incluye ${money(usd, 'USD')} a $${S.cot || '?'} por dólar</small>` : ''}
      ${ritmo}
    </section>

    ${hayUSD && !S.cot ? `<a class="card aviso" href="#/ajustes">⚠️ Cargá la cotización del dólar en Ajustes para convertir tus gastos en USD.</a>` : ''}

    ${pend.length ? `<section class="card">
      <div class="card-tit"><h2>Gastos fijos pendientes (${pend.length})</h2><button class="btn chico" id="cargar-todos">Cargar todos</button></div>
      ${pend.map((p, i) => `<div class="fila">
        <span>${rubro(p.r.rubroId).icono} ${esc(p.r.descripcion)} <small>${p.fecha.split('-').reverse().join('/')}</small></span>
        <span class="fila-der">${money(p.r.monto, p.r.moneda)}
          <button class="icono-btn ok" data-cargar="${i}" aria-label="Cargar">✓</button>
          <button class="icono-btn" data-omitir="${i}" aria-label="Omitir">✕</button></span>
      </div>`).join('')}
    </section>` : ''}

    <section class="card">
      <div class="card-tit"><h2>Presupuestos</h2><a href="#/ajustes/presupuestos" class="link">Editar</a></div>
      ${presup.length ? presup.map(({ r, gastado, tope }) => `<div class="presup">
          <div class="fila"><span>${r.icono} ${esc(r.nombre)}</span><span>${money(gastado)} <small>/ ${money(tope)}</small></span></div>
          ${barra(gastado, tope)}
        </div>`).join('') : vacio('Definí un tope mensual por rubro para controlar tus gastos.')}
    </section>

    <section class="card">
      <div class="card-tit"><h2>Últimos gastos</h2><a href="#/gastos" class="link">Ver todos</a></div>
      ${ultimos.length ? `<div class="lista">${ultimos.map(itemGasto).join('')}</div>` : vacio('Todavía no hay gastos este mes. Tocá <b>+</b> para cargar uno.')}
    </section>`;

  const listo = async (msg) => { await cargar(); toast(msg); S.rerender(); };
  $('#cargar-todos')?.addEventListener('click', async () => {
    for (const p of pend) await cargarPendiente(p);
    listo(`${pend.length} gastos fijos cargados`);
  });
  $$('[data-cargar]', el).forEach((b) => b.addEventListener('click', async () => {
    await cargarPendiente(pend[+b.dataset.cargar]); listo('Gasto cargado');
  }));
  $$('[data-omitir]', el).forEach((b) => b.addEventListener('click', async () => {
    await omitirPendiente(pend[+b.dataset.omitir]); listo('Omitido');
  }));
}
