import { S, rubro, cat, medio, vehiculo } from './store.js';
import { esc, money, nombreMes } from './util.js';

const flecha = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

export function selectorMes() {
  const [mes, anio] = nombreMes(S.mes).split(' ');
  return `<div class="selmes">
    <span>${mes}<small>${anio}</small></span>
    <div class="flechas">
      <button class="icono-btn" data-mes="-1" aria-label="Mes anterior">${flecha('M15 5l-7 7 7 7')}</button>
      <button class="icono-btn" data-mes="1" aria-label="Mes siguiente">${flecha('M9 5l7 7-7 7')}</button>
      ${engranaje}
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
    g.litros > 0 ? `<span class="badge">${String(g.litros).replace('.', ',')} L${vehiculo(g.vehiculoId) ? ' · ' + esc(vehiculo(g.vehiculoId).alias) : ''}</span>` : '',
    g.recurrenteId ? '<span class="badge">fijo</span>' : '',
    g.servicioId ? '<span class="badge">servicio</span>' : '',
    g.prescindible ? '<span class="badge prescindible">prescindible</span>' : '',
  ].join('');
  return `<a class="item" href="#/editar/${g.id}">
    <i class="traza" style="background:${r.color}"></i>
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

export const engranaje = `<a class="icono-btn" href="#/ajustes" aria-label="Ajustes"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg></a>`;

/** Fila de un vencimiento de servicio. `conVehiculo` agrega el nombre del vehículo (para Inicio). */
export function filaVencimiento(v, textoVenc, conVehiculo = false) {
  const etiqueta = { vencido: 'vencido', proximo: 'próximo', 'al-dia': 'al día' }[v.estado];
  const destino = conVehiculo ? `#/vehiculos/${v.vehiculo.id}` : `#/servicios/nuevo/${v.vehiculo.id}/${encodeURIComponent(v.servicio.tipo)}`;
  return `<a class="item venc ${v.estado}" href="${destino}">
    <i class="traza"></i>
    <span class="item-txt"><b>${esc(v.servicio.tipo)}${conVehiculo ? ` · ${esc(v.vehiculo.alias)}` : ''}</b><small>${esc(textoVenc)}</small></span>
    <span class="badge ${v.estado}">${etiqueta}</span>
  </a>`;
}

/** Selector de vehículo para filtrar listados y reportes. El filtro elegido se comparte entre Gastos y Análisis. */
export function selectVehiculo(id) {
  const ops = S.vehiculos.map((v) => `<option value="${v.id}" ${v.id === S.vehFiltro ? "selected" : ""}>${esc(v.alias)}${v.activo === false ? " (inactivo)" : ""}</option>`).join("");
  return `<select id="${id}" aria-label="Filtrar por vehículo"><option value="">Todos los vehículos</option>${ops}</select>`;
}
