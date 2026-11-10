import * as db from '../db.js';
import { S, cargar, catsDe, rubro, cat, medio, aARS } from '../store.js';
import { $, esc, uid, money, hoy, toast, descargar, round2 } from '../util.js';
import { vacio } from '../componentes.js';

const TIPOS = { efectivo: 'Efectivo', debito: 'Débito', credito: 'Crédito (permite cuotas)', transferencia: 'Transferencia', billetera: 'Billetera virtual', otro: 'Otro' };
const num = (v) => parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;
const abiertos = new Set();

export function render(host, params) {
  if (params[0]) abiertos.add(params[0]);
  // Contenedor nuevo en cada render para no acumular listeners delegados
  const el = document.createElement('div');
  host.replaceChildren(el);
  const sec = (id, titulo, cuerpo) =>
    `<details class="card sec" data-sec="${id}" ${abiertos.has(id) ? 'open' : ''}><summary><h2>${titulo}</h2></summary>${cuerpo}</details>`;

  const usosRubro = (id) => S.gastos.filter((g) => g.rubroId === id).length;
  const usosCat = (id) => S.gastos.filter((g) => g.categoriaId === id).length;
  const usosMedio = (id) => S.gastos.filter((g) => g.medioId === id).length;

  el.innerHTML = `
    <h1 class="titulo">Ajustes</h1>

    ${sec('dolar', '💵 Cotización del dólar', `
      <p class="nota">Se usa para convertir a pesos los gastos en USD. Cada gasto guarda la cotización del día en que lo cargaste.</p>
      <div class="inline">
        <input id="cot" type="text" inputmode="decimal" value="${S.cot || ''}" placeholder="Ej: 1200">
        <button class="btn" data-a="guardar-cot">Guardar</button>
      </div>
      ${S.cotFecha ? `<small>Actualizada el ${S.cotFecha.split('-').reverse().join('/')}</small>` : ''}`)}

    ${sec('presupuestos', '🎯 Presupuestos mensuales', `
      <p class="nota">Tope mensual en pesos por rubro. Dejá vacío para no controlar ese rubro.</p>
      ${S.rubros.map((r) => `<label class="fila"><span>${r.icono} ${esc(r.nombre)}</span>
        <input class="corto" type="text" inputmode="decimal" data-presup="${r.id}" value="${S.presupuestos[r.id] || ''}" placeholder="—"></label>`).join('')}
      <div class="fila total-fila"><span>Total presupuestado</span><b>${money(Object.values(S.presupuestos).reduce((a, b) => a + b, 0))}</b></div>`)}

    ${sec('recurrentes', '↻ Gastos fijos y suscripciones', `
      <p class="nota">Se proponen automáticamente cada mes en Inicio. Para crear uno nuevo, cargá un gasto y activá “Repetir todos los meses”.</p>
      ${S.recurrentes.length ? S.recurrentes.map((r) => `<div class="rec ${r.activo ? '' : 'inactivo'}">
        <div class="fila"><span>${rubro(r.rubroId).icono} <input class="txt" data-rec-desc="${r.id}" value="${esc(r.descripcion)}"></span>
          <label class="mini-switch"><input type="checkbox" data-rec-activo="${r.id}" ${r.activo ? 'checked' : ''}> activo</label></div>
        <div class="fila"><span class="inline">
            <input class="corto" type="text" inputmode="decimal" data-rec-monto="${r.id}" value="${r.monto}"> ${r.moneda}
            · día <input class="mini" type="number" min="1" max="31" data-rec-dia="${r.id}" value="${r.dia}">
          </span>
          <button class="icono-btn" data-rec-borrar="${r.id}" aria-label="Borrar">🗑</button></div>
        <small>${esc(cat(r.categoriaId).nombre || rubro(r.rubroId).nombre)} · ${esc(medio(r.medioId).nombre)}</small>
      </div>`).join('') : vacio('No tenés gastos fijos.')}`)}

    ${sec('rubros', '🗂 Rubros y categorías', `
      ${S.rubros.map((r) => `<details class="rubro">
        <summary><span class="avatar" style="background:${r.color}26">${r.icono}</span> ${esc(r.nombre)} <small>(${catsDe(r.id).length})</small></summary>
        <div class="inline">
          <input class="mini" data-rubro-icono="${r.id}" value="${esc(r.icono)}" maxlength="4" aria-label="Ícono">
          <input class="txt" data-rubro-nombre="${r.id}" value="${esc(r.nombre)}" aria-label="Nombre">
          <input type="color" data-rubro-color="${r.id}" value="${r.color}" aria-label="Color">
          <button class="icono-btn" data-rubro-borrar="${r.id}" aria-label="Borrar rubro">🗑</button>
        </div>
        <ul class="cats">${catsDe(r.id).map((c) => `<li class="inline">
          <input class="txt" data-cat-nombre="${c.id}" value="${esc(c.nombre)}">
          <small>${usosCat(c.id)}</small>
          <button class="icono-btn" data-cat-borrar="${c.id}" aria-label="Borrar">✕</button></li>`).join('')}</ul>
        <div class="inline"><input class="txt" placeholder="Nueva categoría" data-cat-nueva="${r.id}"><button class="btn chico" data-cat-agregar="${r.id}">Agregar</button></div>
      </details>`).join('')}
      <div class="inline nuevo"><input class="mini" id="nr-icono" value="📌" maxlength="4"><input class="txt" id="nr-nombre" placeholder="Nuevo rubro"><button class="btn chico" data-a="rubro-nuevo">Agregar</button></div>`)}

    ${sec('medios', '💳 Medios de pago', `
      ${S.medios.map((m) => `<div class="inline medio">
        <input class="txt" data-medio-nombre="${m.id}" value="${esc(m.nombre)}">
        <select data-medio-tipo="${m.id}">${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}" ${m.tipo === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <button class="icono-btn" data-medio-borrar="${m.id}" aria-label="Borrar">🗑</button></div>`).join('')}
      <div class="inline nuevo"><input class="txt" id="nm-nombre" placeholder="Nuevo medio (ej: Naranja X)">
        <select id="nm-tipo">${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <button class="btn chico" data-a="medio-nuevo">Agregar</button></div>`)}

    ${sec('datos', '💾 Backup y exportación', `
      <p class="nota">Tus datos se guardan solo en este celular. Hacé un backup de vez en cuando y guardalo en Drive o similar.</p>
      <button class="btn" data-a="exp-json">Descargar backup (JSON)</button>
      <button class="btn" data-a="exp-csv">Exportar gastos a Excel (CSV)</button>
      <label class="btn">Restaurar backup… <input type="file" id="imp" accept=".json,application/json" hidden></label>
      <button class="btn peligro" data-a="borrar-todo">Borrar todos los datos</button>
      <small>${S.gastos.length} gastos registrados</small>`)}

    <p class="pie">Mis Gastos · v1</p>`;

  const ok = async (msg, rerender = true) => { await cargar(); if (msg) toast(msg); if (rerender) render(host, []); };

  el.querySelectorAll('details.sec').forEach((d) => d.addEventListener('toggle', () => {
    d.open ? abiertos.add(d.dataset.sec) : abiertos.delete(d.dataset.sec);
  }));

  // Cambios en campos: se guardan al salir del campo
  el.addEventListener('change', async (e) => {
    const t = e.target, d = t.dataset;
    if (d.presup) {
      const v = num(t.value);
      v > 0 ? await db.put('presupuestos', { rubroId: d.presup, monto: v }) : await db.del('presupuestos', d.presup);
      return ok('Presupuesto guardado');
    }
    const editar = async (store, id, cambios, msg = 'Guardado', rerender = false) => {
      const obj = await db.get(store, id);
      await db.put(store, { ...obj, ...cambios });
      return ok(msg, rerender);
    };
    if (d.recDesc) return editar('recurrentes', d.recDesc, { descripcion: t.value.trim() });
    if (d.recMonto) return editar('recurrentes', d.recMonto, { monto: round2(num(t.value)) });
    if (d.recDia) return editar('recurrentes', d.recDia, { dia: Math.max(1, Math.min(31, +t.value || 1)) });
    if (d.recActivo) return editar('recurrentes', d.recActivo, { activo: t.checked }, t.checked ? 'Activado' : 'Pausado', true);
    if (d.rubroNombre && t.value.trim()) return editar('rubros', d.rubroNombre, { nombre: t.value.trim() }, 'Guardado', true);
    if (d.rubroIcono && t.value.trim()) return editar('rubros', d.rubroIcono, { icono: t.value.trim() }, 'Guardado', true);
    if (d.rubroColor) return editar('rubros', d.rubroColor, { color: t.value }, 'Guardado', true);
    if (d.catNombre && t.value.trim()) return editar('categorias', d.catNombre, { nombre: t.value.trim() });
    if (d.medioNombre && t.value.trim()) return editar('medios', d.medioNombre, { nombre: t.value.trim() });
    if (d.medioTipo) return editar('medios', d.medioTipo, { tipo: t.value });
    if (t.id === 'imp' && t.files[0]) {
      try {
        const obj = JSON.parse(await t.files[0].text());
        const n = obj?.data?.gastos?.length ?? 0;
        if (!confirm(`Restaurar backup con ${n} gastos? Se reemplazarán TODOS los datos actuales.`)) return;
        await db.importAll(obj);
        await ok('Backup restaurado');
      } catch (err) { toast(err.message || 'No se pudo leer el archivo'); }
    }
  });

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.a === 'guardar-cot') {
      const v = num($('#cot').value);
      if (!v) return toast('Ingresá un valor');
      await db.setConfig('cotizacion', v);
      await db.setConfig('cotizacionFecha', hoy());
      return ok('Cotización guardada');
    }
    if (d.recBorrar) {
      if (!confirm('¿Borrar este gasto fijo? Los gastos ya cargados se mantienen.')) return;
      await db.del('recurrentes', d.recBorrar); return ok('Eliminado');
    }
    if (d.rubroBorrar) {
      const n = usosRubro(d.rubroBorrar);
      if (n) return toast(`No se puede: tiene ${n} gastos. Renombralo o reasigná esos gastos.`);
      if (!confirm(`¿Borrar el rubro “${rubro(d.rubroBorrar).nombre}” y sus categorías?`)) return;
      await db.delMany('categorias', catsDe(d.rubroBorrar).map((c) => c.id));
      await db.del('rubros', d.rubroBorrar);
      await db.del('presupuestos', d.rubroBorrar);
      return ok('Rubro eliminado');
    }
    if (d.catBorrar) {
      const n = usosCat(d.catBorrar);
      if (n && !confirm(`La categoría tiene ${n} gastos; quedarán sin categoría. ¿Borrar igual?`)) return;
      if (!n && !confirm('¿Borrar categoría?')) return;
      await db.del('categorias', d.catBorrar); return ok('Categoría eliminada');
    }
    if (d.catAgregar) {
      const inp = el.querySelector(`[data-cat-nueva="${d.catAgregar}"]`);
      if (!inp.value.trim()) return;
      await db.put('categorias', { id: uid(), rubroId: d.catAgregar, nombre: inp.value.trim(), orden: catsDe(d.catAgregar).length });
      await ok('Categoría agregada', false);
      render(host, []);
      host.querySelector(`[data-cat-nueva="${d.catAgregar}"]`)?.closest('details.rubro')?.setAttribute('open', '');
      return;
    }
    if (d.a === 'rubro-nuevo') {
      const nombre = $('#nr-nombre').value.trim(); if (!nombre) return;
      const colores = ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#76b7b2', '#edc948', '#b07aa1', '#ff9da7', '#9c755f'];
      const id = uid();
      await db.put('rubros', { id, nombre, icono: $('#nr-icono').value.trim() || '📌', color: colores[S.rubros.length % colores.length], orden: S.rubros.length });
      await db.put('categorias', { id: uid(), rubroId: id, nombre: 'General', orden: 0 });
      return ok('Rubro agregado');
    }
    if (d.medioBorrar) {
      const n = usosMedio(d.medioBorrar);
      if (n) return toast(`No se puede: tiene ${n} gastos. Podés renombrarlo.`);
      if (!confirm('¿Borrar medio de pago?')) return;
      await db.del('medios', d.medioBorrar); return ok('Eliminado');
    }
    if (d.a === 'medio-nuevo') {
      const nombre = $('#nm-nombre').value.trim(); if (!nombre) return;
      await db.put('medios', { id: uid(), nombre, tipo: $('#nm-tipo').value, orden: S.medios.length });
      return ok('Medio agregado');
    }
    if (d.a === 'exp-json') {
      const data = await db.exportAll();
      descargar(`mis-gastos-backup-${hoy()}.json`, JSON.stringify(data), 'application/json');
      return toast('Backup descargado');
    }
    if (d.a === 'exp-csv') {
      const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
      const n = (v) => String(round2(v)).replace('.', ',');
      const filas = [['Fecha', 'Monto', 'Moneda', 'Cotización', 'Monto ARS', 'Rubro', 'Categoría', 'Medio de pago', 'Descripción', 'Prescindible', 'Cuota', 'Fijo']];
      [...S.gastos].reverse().forEach((g) => filas.push([
        g.fecha, n(g.monto), g.moneda, g.cotizacion ? n(g.cotizacion) : '', n(aARS(g)),
        q(rubro(g.rubroId).nombre), q(cat(g.categoriaId).nombre), q(medio(g.medioId).nombre), q(g.descripcion),
        g.prescindible ? 'Sí' : 'No', g.cuotaTotal > 1 ? `${g.cuotaNro}/${g.cuotaTotal}` : '', g.recurrenteId ? 'Sí' : 'No',
      ]));
      descargar(`mis-gastos-${hoy()}.csv`, '﻿' + filas.map((f) => f.join(';')).join('\r\n'), 'text/csv;charset=utf-8');
      return toast('CSV descargado');
    }
    if (d.a === 'borrar-todo') {
      if (!confirm('Esto borra TODOS tus gastos, rubros y ajustes de este celular. ¿Descargaste un backup?')) return;
      if (!confirm('¿Seguro? No se puede deshacer.')) return;
      await db.borrarTodo();
      location.reload();
    }
  });
}
