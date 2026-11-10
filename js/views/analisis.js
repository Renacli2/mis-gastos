import { S, aARS, delMes, rubro, cat, medio } from '../store.js';
import { $, esc, money, pct, sum, sumarMeses, mesCorto, mesActual, hoy, diasDelMes } from '../util.js';
import { selectorMes, itemGasto, vacio } from '../componentes.js';
import { chart, PALETA } from '../charts.js';
import { costoMensual } from '../recurrentes.js';

function agrupar(lista, key) {
  const m = new Map();
  lista.forEach((g) => m.set(g[key], (m.get(g[key]) || 0) + aARS(g)));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

const fmtCorto = (v) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)}k` : Math.round(v));
const tooltipARS = { callbacks: { label: (c) => ` ${c.dataset.label ? c.dataset.label + ': ' : c.label ? c.label + ': ' : ''}${money(c.parsed.y ?? c.parsed)}` } };

export function render(el) {
  const mes = S.mes;
  const gm = delMes(mes);
  const total = sum(gm.map(aARS));
  const prev = sum(delMes(sumarMeses(mes, -1)).map(aARS));
  const meses3 = [1, 2, 3].map((i) => sumarMeses(mes, -i));
  const tot3 = meses3.map((m) => sum(delMes(m).map(aARS)));
  const con3 = tot3.filter((t) => t > 0);
  const prom3 = con3.length ? sum(con3) / con3.length : 0;
  const dias = mes === mesActual() ? +hoy().slice(8) : diasDelMes(mes);
  const diario = total / dias;

  // Alertas: rubros que subieron más de 20% vs. su promedio de los 3 meses anteriores
  const alertas = S.rubros.map((r) => {
    const act = sum(gm.filter((g) => g.rubroId === r.id).map(aARS));
    const ant = meses3.map((m) => sum(delMes(m).filter((g) => g.rubroId === r.id).map(aARS))).filter((v) => v > 0);
    const prom = ant.length ? sum(ant) / ant.length : 0;
    return { r, act, prom, var: prom ? ((act - prom) / prom) * 100 : 0 };
  }).filter((a) => a.prom > 0 && a.var > 20 && a.act - a.prom > total * 0.01).sort((a, b) => (b.act - b.prom) - (a.act - a.prom));

  const presc = sum(gm.filter((g) => g.prescindible).map(aARS));
  const porRubro = agrupar(gm, 'rubroId');
  const porCat = agrupar(gm, 'categoriaId').slice(0, 10);
  const porMedio = agrupar(gm, 'medioId');
  const top = [...gm].sort((a, b) => aARS(b) - aARS(a)).slice(0, 10);
  const recMes = costoMensual();

  // Evolución de 12 meses, apilado por rubro
  const meses12 = Array.from({ length: 12 }, (_, i) => sumarMeses(mes, i - 11));
  const rubrosEvo = S.rubros.filter((r) => S.gastos.some((g) => g.rubroId === r.id && g.fecha >= meses12[0] && g.fecha <= `${mes}-31`));

  // Cuotas futuras (después del mes actual real)
  const ma = mesActual();
  const mesesFut = Array.from({ length: 12 }, (_, i) => sumarMeses(ma, i + 1));
  const cuotasFut = mesesFut.map((m) => sum(delMes(m).filter((g) => g.cuotaGrupo).map(aARS)));
  const totalCuotasFut = sum(cuotasFut);

  el.innerHTML = `
    ${selectorMes()}
    <section class="kpis">
      <div class="kpi"><small>Total del mes</small><b>${money(total)}</b></div>
      <div class="kpi"><small>vs. mes anterior</small><b class="${total > prev ? 'sube' : 'baja'}">${prev ? pct(((total - prev) / prev) * 100) : '—'}</b></div>
      <div class="kpi"><small>Promedio 3 meses</small><b>${money(prom3)}</b></div>
      <div class="kpi"><small>Promedio diario</small><b>${money(diario)}</b></div>
    </section>

    ${alertas.length ? `<section class="card alerta">
      <h2>⚠️ Rubros en alza</h2>
      ${alertas.map((a) => `<div class="fila"><span>${a.r.icono} ${esc(a.r.nombre)}</span>
        <span class="der"><b class="sube">${pct(a.var)}</b><small>${money(a.act)} vs ${money(a.prom)} prom.</small></span></div>`).join('')}
    </section>` : ''}

    <section class="card">
      <h2>Por rubro</h2>
      ${porRubro.length ? `<div class="graf graf-torta"><canvas id="c-rubros"></canvas></div>
      ${porRubro.map(([id, v]) => {
        const r = rubro(id);
        const tope = S.presupuestos[id];
        return `<div class="fila"><span><i class="punto" style="background:${r.color}"></i>${r.icono} ${esc(r.nombre)}</span>
          <span class="der">${money(v)}<small>${Math.round((v / total) * 100)}%${tope ? ` · tope ${money(tope)}` : ''}</small></span></div>`;
      }).join('')}` : vacio('Sin gastos este mes.')}
    </section>

    ${porCat.length ? `<section class="card"><h2>Top categorías</h2>
      <div class="graf" style="height:${porCat.length * 34 + 30}px"><canvas id="c-cats"></canvas></div></section>` : ''}

    ${porMedio.length ? `<section class="card"><h2>Por medio de pago</h2>
      <div class="graf graf-torta"><canvas id="c-medios"></canvas></div></section>` : ''}

    <section class="card"><h2>Evolución 12 meses</h2>
      <div class="graf"><canvas id="c-evo"></canvas></div></section>

    <section class="card ahorro">
      <h2>💡 Oportunidades de ahorro</h2>
      <div class="fila"><span>Gastos prescindibles del mes</span><span class="der"><b>${money(presc)}</b><small>${total ? Math.round((presc / total) * 100) : 0}% del total</small></span></div>
      ${presc ? `<p class="nota">Si recortás la mitad de los prescindibles ahorrarías <b>${money(presc / 2)}</b> por mes (<b>${money(presc * 6)}</b> por año).</p>` : '<p class="nota">Marcá gastos como <i>prescindibles</i> al cargarlos para ver cuánto podrías ahorrar.</p>'}
      <div class="fila"><span>Gastos fijos (recurrentes activos)</span><span class="der"><b>${money(recMes)}/mes</b><small>${money(recMes * 12)}/año</small></span></div>
      <a class="link" href="#/ajustes/recurrentes">Revisar gastos fijos y suscripciones →</a>
    </section>

    <section class="card"><h2>Cuotas por pagar</h2>
      ${totalCuotasFut ? `<p class="nota">Tenés <b>${money(totalCuotasFut)}</b> comprometidos en cuotas para los próximos meses.</p>
        <div class="graf graf-chico"><canvas id="c-cuotas"></canvas></div>` : vacio('No tenés cuotas pendientes.')}
    </section>

    <section class="card"><h2>Gastos más grandes del mes</h2>
      ${top.length ? `<div class="lista">${top.map(itemGasto).join('')}</div>` : vacio('Sin gastos.')}
    </section>`;

  const torta = (id, data, colors) => chart($(id), {
    type: 'doughnut',
    data: { labels: data.map((d) => d[0]), datasets: [{ data: data.map((d) => d[1]), backgroundColor: colors, borderWidth: 0 }] },
    options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { display: false }, tooltip: tooltipARS } },
  });

  if (porRubro.length) torta('#c-rubros', porRubro.map(([id, v]) => [rubro(id).nombre, v]), porRubro.map(([id]) => rubro(id).color));
  if (porMedio.length) {
    chart($('#c-medios'), {
      type: 'doughnut',
      data: { labels: porMedio.map(([id]) => medio(id).nombre), datasets: [{ data: porMedio.map((d) => d[1]), backgroundColor: PALETA, borderWidth: 0 }] },
      options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'right' }, tooltip: tooltipARS } },
    });
  }
  if (porCat.length) {
    chart($('#c-cats'), {
      type: 'bar',
      data: {
        labels: porCat.map(([id]) => cat(id).nombre || '(sin categoría)'),
        datasets: [{ data: porCat.map((d) => d[1]), borderRadius: 4,
          backgroundColor: porCat.map(([id]) => rubro(S.categorias.find((c) => c.id === id)?.rubroId).color) }],
      },
      options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${money(c.parsed.x)}` } } },
        scales: { x: { ticks: { callback: fmtCorto } }, y: { grid: { display: false } } } },
    });
  }
  chart($('#c-evo'), {
    type: 'bar',
    data: {
      labels: meses12.map(mesCorto),
      datasets: rubrosEvo.map((r) => ({
        label: r.nombre, backgroundColor: r.color,
        data: meses12.map((m) => sum(delMes(m).filter((g) => g.rubroId === r.id).map(aARS))),
      })),
    },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false },
      tooltip: { mode: 'index', filter: (i) => i.parsed.y > 0, callbacks: { label: (c) => ` ${c.dataset.label}: ${money(c.parsed.y)}` } } },
      scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { callback: fmtCorto } } } },
  });
  if (totalCuotasFut) {
    chart($('#c-cuotas'), {
      type: 'bar',
      data: { labels: mesesFut.map(mesCorto), datasets: [{ data: cuotasFut, backgroundColor: '#4e79a7', borderRadius: 4 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${money(c.parsed.y)}` } } },
        scales: { x: { grid: { display: false } }, y: { ticks: { callback: fmtCorto } } } },
    });
  }
}
