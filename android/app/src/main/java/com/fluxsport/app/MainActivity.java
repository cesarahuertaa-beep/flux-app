package com.fluxsport.app;

import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

// Google Play In-App Updates API
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;
import com.google.android.gms.tasks.Task;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "FluxPlayUpdate";
    private static final int RC_APP_UPDATE = 9001;
    private AppUpdateManager appUpdateManager;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            Window window = getWindow();
            if (Build.VERSION.SDK_INT < 35) {
                window.setStatusBarColor(Color.WHITE);
                window.setNavigationBarColor(Color.WHITE);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    window.setNavigationBarContrastEnforced(false);
                }
            }
            View decorView = window.getDecorView();
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);
            if (controller != null) {
                controller.setAppearanceLightStatusBars(true);
                controller.setAppearanceLightNavigationBars(true);
            }
        } catch (Exception ignored) {}

        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().addJavascriptInterface(new SystemBarBridge(), "FluxAndroidBars");
            this.bridge.getWebView().addJavascriptInterface(new PlayUpdateBridge(), "FluxPlayUpdate");
        }

        // Inicializar Google Play In-App Update oficial
        try {
            appUpdateManager = AppUpdateManagerFactory.create(this);
            checkForPlayUpdate();
        } catch (Exception e) {
            Log.w(TAG, "Error initializing AppUpdateManager: " + e.getMessage());
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (appUpdateManager != null) {
            try {
                appUpdateManager.getAppUpdateInfo().addOnSuccessListener(appUpdateInfo -> {
                    if (appUpdateInfo.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                        try {
                            appUpdateManager.startUpdateFlowForResult(
                                appUpdateInfo,
                                this,
                                AppUpdateOptions.defaultOptions(AppUpdateType.IMMEDIATE),
                                RC_APP_UPDATE
                            );
                        } catch (Exception e) {
                            Log.w(TAG, "Failed to resume in-progress update: " + e.getMessage());
                        }
                    }
                });
            } catch (Exception ignored) {}
        }
    }

    private void checkForPlayUpdate() {
        if (appUpdateManager == null) return;
        try {
            Task<AppUpdateInfo> appUpdateInfoTask = appUpdateManager.getAppUpdateInfo();
            appUpdateInfoTask.addOnSuccessListener(appUpdateInfo -> {
                if (appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                        && appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
                    try {
                        appUpdateManager.startUpdateFlowForResult(
                            appUpdateInfo,
                            this,
                            AppUpdateOptions.defaultOptions(AppUpdateType.IMMEDIATE),
                            RC_APP_UPDATE
                        );
                    } catch (Exception e) {
                        Log.w(TAG, "Failed to start update flow: " + e.getMessage());
                    }
                }
            }).addOnFailureListener(e -> {
                Log.d(TAG, "Google Play In-App Update check: " + e.getMessage());
            });
        } catch (Exception e) {
            Log.w(TAG, "Error checking for play update: " + e.getMessage());
        }
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == RC_APP_UPDATE) {
            if (resultCode != RESULT_OK) {
                Log.d(TAG, "Update flow cancelled or failed. Result code: " + resultCode);
            }
        }
    }

    public class PlayUpdateBridge {
        @JavascriptInterface
        public void checkNow() {
            runOnUiThread(() -> checkForPlayUpdate());
        }

        @JavascriptInterface
        public boolean isPlayStoreSupported() {
            return true;
        }
    }

    public class SystemBarBridge {
        @JavascriptInterface
        public void setBars(final String bgHex, final boolean darkIcons) {
            runOnUiThread(() -> {
                try {
                    Window window = getWindow();
                    int color = Color.parseColor(bgHex);
                    if (Build.VERSION.SDK_INT < 35) {
                        window.setStatusBarColor(color);
                        window.setNavigationBarColor(color);
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            window.setNavigationBarContrastEnforced(false);
                        }
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
