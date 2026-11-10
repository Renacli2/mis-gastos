import { S, aARS, delMes, rubro, cat, medio, catsDe } from '../store.js';
import { $, esc, money, sum, fechaLarga } from '../util.js';
import { selectorMes, itemGasto, vacio } from '../componentes.js';

const F = { rubroId: '', categoriaId: '', medioId: '', moneda: '', q: '', prescindible: false };

function filtrar() {
  const q = F.q.trim().toLowerCase();
  return delMes(S.mes).filter((g) =>
    (!F.rubroId || g.rubroId === F.rubroId) &&
    (!F.categoriaId || g.categoriaId === F.categoriaId) &&
    (!F.medioId || g.medioId === F.medioId) &&
    (!F.moneda || g.moneda === F.moneda) &&
    (!F.prescindible || g.prescindible) &&
    (!q || [g.descripcion, cat(g.categoriaId).nombre, rubro(g.rubroId).nombre, medio(g.medioId).nombre]
      .join(' ').toLowerCase().includes(q))
  );
}

const opt = (v, txt, sel) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${esc(txt)}</option>`;

export function render(el) {
  el.innerHTML = `
    ${selectorMes()}
    <section class="card filtros">
      <input type="search" id="f-q" placeholder="Buscar…" value="${esc(F.q)}">
      <div class="grid2">
        <select id="f-rubro">${opt('', 'Todos los rubros', F.rubroId)}${S.rubros.map((r) => opt(r.id, `${r.icono} ${r.nombre}`, F.rubroId)).join('')}</select>
        <select id="f-cat" ${F.rubroId ? '' : 'disabled'}>${opt('', 'Todas las categorías', F.categoriaId)}${catsDe(F.rubroId).map((c) => opt(c.id, c.nombre, F.categoriaId)).join('')}</select>
        <select id="f-medio">${opt('', 'Todos los medios', F.medioId)}${S.medios.map((m) => opt(m.id, m.nombre, F.medioId)).join('')}</select>
        <select id="f-moneda">${opt('', 'ARS y USD', F.moneda)}${opt('ARS', 'Solo ARS', F.moneda)}${opt('USD', 'Solo USD', F.moneda)}</select>
      </div>
      <label class="check"><input type="checkbox" id="f-presc" ${F.prescindible ? 'checked' : ''}> Solo prescindibles</label>
    </section>
    <div id="resultado"></div>`;

  const pintar = () => {
    const lista = filtrar();
    const porDia = {};
    lista.forEach((g) => (porDia[g.fecha] ??= []).push(g));
    $('#resultado').innerHTML = lista.length
      ? `<div class="resumen-filtro">${lista.length} gastos · <b>${money(sum(lista.map(aARS)))}</b></div>` +
        Object.entries(porDia).map(([f, gs]) => `<section class="card dia">
          <div class="card-tit"><h3>${fechaLarga(f)}</h3><small>${money(sum(gs.map(aARS)))}</small></div>
          <div class="lista">${gs.map(itemGasto).join('')}</div></section>`).join('')
      : vacio('No hay gastos que coincidan.');
  };

  $('#f-q').addEventListener('input', (e) => { F.q = e.target.value; pintar(); });
  $('#f-rubro').addEventListener('change', (e) => { F.rubroId = e.target.value; F.categoriaId = ''; render(el); });
  $('#f-cat').addEventListener('change', (e) => { F.categoriaId = e.target.value; pintar(); });
  $('#f-medio').addEventListener('change', (e) => { F.medioId = e.target.value; pintar(); });
  $('#f-moneda').addEventListener('change', (e) => { F.moneda = e.target.value; pintar(); });
  $('#f-presc').addEventListener('change', (e) => { F.prescindible = e.target.checked; pintar(); });
  pintar();
}
