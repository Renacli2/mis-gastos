package app.misgastos;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Puente entre la app web y el widget de la pantalla de inicio.
 *
 * El widget es nativo y no puede leer la base de la app web (IndexedDB). Por eso la app web le deja
 * acá una copia chica de los próximos vencimientos (ver datosWidget() en js/pagos.js), y el widget
 * deja en una cola lo que el usuario pidió desde la pantalla de inicio (por ejemplo, ocultar un vencimiento)
 * para que la app web lo aplique al abrirse.
 *
 * Todo vive en SharedPreferences privadas de la app: ninguna otra app puede leerlas. No hay montos,
 * claves ni datos de tarjetas: solo nombres de servicios, fechas, la app y el medio de pago.
 */
@CapacitorPlugin(name = "WidgetDatos")
public class WidgetDatosPlugin extends Plugin {

    static final String PREFS = "mis_gastos_widget";
    static final String CLAVE_DATOS = "vencimientos";
    static final String CLAVE_ACCIONES = "acciones";

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Guarda la copia de los vencimientos (JSON armado por la app web) y avisa a los widgets. */
    @PluginMethod
    public void guardar(PluginCall call) {
        String datos = call.getString("datos");
        if (datos == null) {
            call.reject("Faltan los datos");
            return;
        }
        try {
            new JSONObject(datos); // no se guarda nada que no sea JSON válido
        } catch (JSONException e) {
            call.reject("Los datos no son JSON válido");
            return;
        }
        Context context = getContext();
        prefs(context).edit().putString(CLAVE_DATOS, datos).apply();
        avisarWidgets(context);
        call.resolve();
    }

    /** Devuelve la copia guardada, tal cual (o null si todavía no hay). Sirve para verificar. */
    @PluginMethod
    public void leer(PluginCall call) {
        JSObject r = new JSObject();
        r.put("datos", prefs(getContext()).getString(CLAVE_DATOS, null));
        call.resolve(r);
    }

    /** Devuelve las acciones pedidas desde el widget y vacía la cola en el mismo paso. */
    @PluginMethod
    public void tomarAcciones(PluginCall call) {
        JSArray acciones = new JSArray();
        synchronized (WidgetDatosPlugin.class) {
            SharedPreferences p = prefs(getContext());
            String crudo = p.getString(CLAVE_ACCIONES, "[]");
            try {
                JSONArray lista = new JSONArray(crudo);
                for (int i = 0; i < lista.length(); i++) acciones.put(lista.get(i));
            } catch (JSONException e) {
                // Cola dañada: se descarta, lo peor que pasa es que una acción del widget no se aplica.
            }
            p.edit().remove(CLAVE_ACCIONES).commit();
        }
        JSObject r = new JSObject();
        r.put("acciones", acciones);
        call.resolve(r);
    }

    /** Lo usa el widget (etapa 4): agrega una acción a la cola para que la app web la aplique. */
    static void encolarAccion(Context context, JSONObject accion) {
        synchronized (WidgetDatosPlugin.class) {
            SharedPreferences p = prefs(context);
            JSONArray lista;
            try {
                lista = new JSONArray(p.getString(CLAVE_ACCIONES, "[]"));
            } catch (JSONException e) {
                lista = new JSONArray();
            }
            lista.put(accion);
            p.edit().putString(CLAVE_ACCIONES, lista.toString()).commit();
        }
    }

    /** Pide a los widgets que se redibujen con los datos nuevos. */
    static void avisarWidgets(Context context) {
        VencimientosWidget.actualizarTodos(context);
    }

    /**
     * Ofrece poner el widget en la pantalla de inicio (Android muestra su propio cartel para confirmar).
     * Devuelve { pedido: false } si el lanzador del teléfono no lo permite: ahí hay que agregarlo a mano.
     */
    @PluginMethod
    public void fijarWidget(PluginCall call) {
        android.appwidget.AppWidgetManager mgr = android.appwidget.AppWidgetManager.getInstance(getContext());
        boolean pedido = false;
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O && mgr.isRequestPinAppWidgetSupported()) {
            pedido = mgr.requestPinAppWidget(new android.content.ComponentName(getContext(), VencimientosWidget.class), null, null);
        }
        JSObject r = new JSObject();
        r.put("pedido", pedido);
        r.put("cantidad", mgr.getAppWidgetIds(new android.content.ComponentName(getContext(), VencimientosWidget.class)).length);
        call.resolve(r);
    }

    // ---------- Aperturas desde el widget (misgastos://pagar/ID, misgastos://servicio/ID, …) ----------

    private static String apertura = null;

    /** La app se abrió de cero tocando el widget. */
    @Override
    public void load() {
        if (getActivity() != null) leerApertura(getActivity().getIntent());
    }

    /** La app ya estaba abierta (en segundo plano) y se tocó el widget. */
    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        leerApertura(intent);
    }

    private static synchronized void leerApertura(Intent intent) {
        Uri data = intent != null ? intent.getData() : null;
        if (data == null || !"misgastos".equals(data.getScheme())) return;
        apertura = data.toString();
        intent.setData(null); // para no repetirla si Android recrea la pantalla
    }

    /** Devuelve adónde pidió ir el widget (o null) y lo olvida. La app web lo llama al abrirse y al volver. */
    @PluginMethod
    public void tomarApertura(PluginCall call) {
        String url;
        synchronized (WidgetDatosPlugin.class) {
            url = apertura;
            apertura = null;
        }
        JSObject r = new JSObject();
        r.put("url", url);
        call.resolve(r);
    }
}
