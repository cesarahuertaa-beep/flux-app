package com.fluxsport.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().addJavascriptInterface(new SystemBarBridge(), "FluxAndroidBars");
        }
    }

    public class SystemBarBridge {
        @JavascriptInterface
        public void setBars(final String bgHex, final boolean darkIcons) {
            runOnUiThread(() -> {
                try {
                    Window window = getWindow();
                    int color = Color.parseColor(bgHex);
                    window.setStatusBarColor(color);
                    window.setNavigationBarColor(color);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        window.setNavigationBarContrastEnforced(false);
                    }
                    View decorView = window.getDecorView();
                    WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);
                    if (controller != null) {
                        controller.setAppearanceLightStatusBars(darkIcons);
                        controller.setAppearanceLightNavigationBars(darkIcons);
                    }
                } catch (Exception ignored) {}
            });
        }
    }
}
