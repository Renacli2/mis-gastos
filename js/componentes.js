import { S, rubro, cat, medio } from './store.js';
import { esc, money, nombreMes } from './util.js';

const flecha = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

export function selectorMes() {
  const [mes, anio] = nombreMes(S.mes).split(' ');
  return `<div class="selmes">
    <span>${mes}<small>${anio}</small></span>
    <div class="flechas">
      <button class="icono-btn" data-mes="-1" aria-label="Mes anterior">${flecha('M15 5l-7 7 7 7')}</button>
      <button class="icono-btn" data-mes="1" aria-label="Mes siguiente">${flecha('M9 5l7 7-7 7')}</button>
    </div>
  </div>`;
}

export function itemGasto(g) {
  const r = rubro(g.rubroId);
  const c = cat(g.categoriaId);
  const titulo = g.descripcion || c.nombre || r.nombre;
  const sub = g.descripcion && c.nombre ? c.nombre : r.nombre;
  const badges = [
    g.cuotaTotal > 1 ? `<span class="badge">cuota ${g.cuotaNro}/${g.cuotaTotal}</span>` : '',
    g.recurrenteId ? '<span class="badge">↻ fijo</span>' : '',
    g.prescindible ? '<span class="badge prescindible">prescindible</span>' : '',
  ].join('');
  return `<a class="item" href="#/editar/${g.id}">
    <span class="avatar" style="background:${r.color}2e">${r.icono}</span>
    <span class="item-txt"><b>${esc(titulo)}</b><small>${esc(sub)}</small>${badges ? `<span class="badges">${badges}</span>` : ''}</span>
    <span class="item-der"><span class="item-monto">${money(g.monto, g.moneda)}</span><small>${esc(medio(g.medioId).nombre)}</small></span>
  </a>`;
}

export const vacio = (msg) => `<div class="vacio">${msg}</div>`;

export function barra(valor, tope) {
  const p = tope > 0 ? (valor / tope) * 100 : 0;
  const cls = p >= 100 ? 'rojo' : p >= 80 ? 'amarillo' : 'verde';
  return `<div class="barra"><div class="barra-fill ${cls}" style="width:${Math.min(p, 100)}%"></div></div>`;
}
