import { S, rubro, cat, medio } from './store.js';
import { esc, money, nombreMes } from './util.js';

export function selectorMes() {
  return `<div class="selmes">
    <button class="icono-btn" data-mes="-1" aria-label="Mes anterior">‹</button>
    <span>${nombreMes(S.mes)}</span>
    <button class="icono-btn" data-mes="1" aria-label="Mes siguiente">›</button>
  </div>`;
}

export function itemGasto(g) {
  const r = rubro(g.rubroId);
  const c = cat(g.categoriaId);
  const titulo = g.descripcion || c.nombre || r.nombre;
  const sub = [g.descripcion && c.nombre ? c.nombre : r.nombre, medio(g.medioId).nombre].join(' · ');
  const badges = [
    g.cuotaTotal > 1 ? `<span class="badge">cuota ${g.cuotaNro}/${g.cuotaTotal}</span>` : '',
    g.recurrenteId ? '<span class="badge">↻ fijo</span>' : '',
    g.prescindible ? '<span class="badge prescindible">prescindible</span>' : '',
  ].join('');
  return `<a class="item" href="#/editar/${g.id}">
    <span class="avatar" style="background:${r.color}26;color:${r.color}">${r.icono}</span>
    <span class="item-txt"><b>${esc(titulo)}</b><small>${esc(sub)}</small>${badges ? `<span class="badges">${badges}</span>` : ''}</span>
    <span class="item-monto">${money(g.monto, g.moneda)}</span>
  </a>`;
}

export const vacio = (msg) => `<div class="vacio">${msg}</div>`;

export function barra(valor, tope) {
  const p = tope > 0 ? (valor / tope) * 100 : 0;
  const cls = p >= 100 ? 'rojo' : p >= 80 ? 'amarillo' : 'verde';
  return `<div class="barra"><div class="barra-fill ${cls}" style="width:${Math.min(p, 100)}%"></div></div>`;
}
