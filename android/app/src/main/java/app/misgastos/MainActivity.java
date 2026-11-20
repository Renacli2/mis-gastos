package app.misgastos;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Los plugins propios se registran antes de crear el puente con la app web.
        registerPlugin(WidgetDatosPlugin.class);
        super.onCreate(savedInstanceState);

        // El visor web agranda todo el texto según el "Tamaño de letra" de Android (por ejemplo 130 %),
        // y la app, pensada para el celular, se ve sobredimensionada: títulos que no entran, tarjetas cortadas.
        // Se fija al 100 %, como se ve la app web en Chrome. El zoom de accesibilidad del sistema sigue andando.
        WebSettings ajustes = getBridge().getWebView().getSettings();
        ajustes.setTextZoom(100);
    }
}
