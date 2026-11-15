# Mis Gastos

App web instalable (PWA) para registrar y analizar gastos personales desde Android. Funciona sin conexión y guarda los datos solo en el celular (IndexedDB).

## Funciones
- Rubros y categorías editables (vienen precargados) y medios de pago editables.
- Gastos en ARS y USD (cada gasto en USD guarda la cotización del día).
- Compras en cuotas con tarjeta de crédito (se reparten en los meses siguientes).
- Gastos fijos que se repiten todos los meses (alquiler, suscripciones…).
- Presupuesto mensual por rubro con barras de avance.
- Análisis: comparación con el mes anterior y con el promedio, rubros en alza, gráficos por rubro, categoría y medio de pago, evolución de 12 meses, gastos prescindibles, cuotas pendientes.
- Backup JSON (descargar y restaurar) y exportación CSV para Excel.
- Vehículos:
  - Cargas de combustible con litros, odómetro y tanque lleno. Son el mismo gasto, no un registro aparte.
  - Consumo en l/100 km y km/l, calculado entre tanques llenos.
  - Servicios y mantenimiento, con avisos de vencimiento por km o por fecha. Un servicio con costo genera su gasto.
  - Costo total y costo por km de cada vehículo, y filtro por vehículo en Gastos y Análisis.

## Cómo está organizado el código
- `js/views/`: una pantalla por archivo.
- `js/combustible.js`, `js/consumo.js`, `js/servicios.js`, `js/vencimientos.js`, `js/costos.js`: reglas y cálculos del módulo de vehículos, como funciones puras (no leen la base ni la pantalla).
- `js/db.js`: base de datos local. `js/seed.js`: datos iniciales y migraciones.
- `tests/`: tests de las funciones puras.

## Datos y migraciones
La base es IndexedDB y su esquema está en la versión 2. No hay nada que aplicar a mano: al abrir una versión nueva de la app, `js/db.js` crea las tablas que falten y `migrarDatos()` en `js/seed.js` completa los datos. Los gastos existentes no se modifican.

Para un cambio de esquema futuro: subir `VERSION` en `js/db.js`, agregar la tabla en `STORES` y sumar un paso en `migrarDatos()`.

## Probar en la PC
```
powershell -ExecutionPolicy Bypass -File servidor.ps1
```
y abrir http://localhost:8765

Los tests se corren en el navegador, con el servidor andando: http://localhost:8765/tests/index.html

## Instalar en Android
1. Publicar la carpeta en un hosting HTTPS (por ejemplo GitHub Pages).
2. Abrir la URL en Chrome para Android → menú ⋮ → **Instalar app** (o "Agregar a pantalla principal").

## Publicar una actualización
1. Subí el número en `version.js` (por ejemplo `1.1.0` → `1.2.0`) y escribí en `APP_NOTAS` qué cambió.
2. Hacé commit y push a `main`; GitHub Pages la publica en 1–2 minutos.

En el celular, la app busca versiones nuevas sola al abrirse y al volver a ella. Si encuentra una, muestra un cartel con el botón **Actualizar**. También se puede buscar a mano en **Ajustes → Actualizaciones**. Actualizar no borra los gastos.

Los datos **no** viajan al servidor: hacé backups periódicos desde Ajustes → Backup.
