import * as db from '../db.js';
import { S, cargar, vehiculo } from '../store.js';
import { $, $$, esc, uid, toast } from '../util.js';
import { vacio, engranaje } from '../componentes.js';

export const COMBUSTIBLES = ['Nafta', 'Nafta premium', 'Diésel', 'GNC', 'Eléctrico', 'Híbrido'];
export const km = (n) => `${Math.round(n || 0).toLocaleString('es-AR')} km`;
const entero = (v) => parseInt(String(v).replace(/\D/g, ''), 10);

export function render(el, params) {
  if (params[0]) return formulario(el, params[0]);
  lista(el);
}

function lista(el) {
  const fila = (v) => {
    const detalle = [[v.marca, v.modelo, v.anio].filter(Boolean).join(' '), v.patente].filter(Boolean).join(' · ');
    return `<a class="item ${v.activo === false ? 'inactivo' : ''}" href="#/vehiculos/${v.id}">
      <span class="item-txt"><b>${esc(v.alias)}</b><small>${esc(detalle || v.combustible)}</small>
        ${v.activo === false ? '<span class="badges"><span class="badge">inactivo</span></span>' : ''}</span>
      <span class="item-der"><span class="item-monto">${km(v.odometro)}</span><small>${esc(v.combustible)}</small></span>
    </a>`;
  };
  el.innerHTML = `
    <div class="cab"><h1 class="titulo">Vehículos</h1>${engranaje}</div>
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
      <a class="btn" href="#/vehiculos">Cancelar</a>
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
    location.hash = '#/vehiculos';
  });
}
