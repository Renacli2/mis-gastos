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

## Probar en la PC
```
powershell -ExecutionPolicy Bypass -File servidor.ps1
```
y abrir http://localhost:8765

## Instalar en Android
1. Publicar la carpeta en un hosting HTTPS (por ejemplo GitHub Pages).
2. Abrir la URL en Chrome para Android → menú ⋮ → **Instalar app** (o "Agregar a pantalla principal").

## Actualizar
Después de modificar archivos, subí `VERSION` en `sw.js` y volvé a publicar.

Los datos **no** viajan al servidor: hacé backups periódicos desde Ajustes → Backup.
