import { S, aARS, delMes, rubro } from '../store.js';
import { $, $$, esc, money, pct, sum, sumarMeses, hoy, mesActual, toast } from '../util.js';
import { selectorMes, itemGasto, vacio, barra } from '../componentes.js';
import { pendientes, cargarPendiente, omitirPendiente } from '../recurrentes.js';
import { cargar } from '../store.js';

export function render(el) {
  const mes = S.mes;
  const gm = delMes(mes);
  const total = sum(gm.map(aARS));
  const usd = sum(gm.filter((g) => g.moneda === 'USD').map((g) => g.monto));
  const prev = sum(delMes(sumarMeses(mes, -1)).map(aARS));
  const varPrev = prev > 0 ? ((total - prev) / prev) * 100 : null;
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
    <section class="card hero">
      <small>Gastado en el mes</small>
      <div class="total">${money(total)}</div>
      ${usd ? `<small>incluye ${money(usd, 'USD')} convertidos a $${S.cot || '?'}</small>` : ''}
      ${varPrev !== null ? `<div class="var ${varPrev > 0 ? 'sube' : 'baja'}">${pct(varPrev)} vs. mes anterior (${money(prev)})</div>` : ''}
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
