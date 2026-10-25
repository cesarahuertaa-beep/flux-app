package com.fluxsport.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.BridgeActivity;

// Google Play In-App Updates API
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;
import com.google.android.gms.tasks.Task;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.lang.ref.WeakReference;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "FluxPlayUpdate";
    private static final int RC_APP_UPDATE = 9001;
    private static WeakReference<MainActivity> activeInstance;
    private AppUpdateManager appUpdateManager;

    private static volatile long activeTimerEndMs = 0L;
    private static volatile String activeTimerColor = "#00B4D8";
    private static volatile boolean isTimerRunning = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        activeInstance = new WeakReference<>(this);
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
            this.bridge.getWebView().addJavascriptInterface(new FluxNativeSyncBridge(), "FluxNativeSync");
            this.bridge.getWebView().addJavascriptInterface(new FluxTimerBridge(), "FluxTimerNative");
        }

        // Programar sincronización periódica nativa con WorkManager (incluso con la app cerrada)
        scheduleNativeSync(false);

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
        activeInstance = new WeakReference<>(this);
        hideFloatingTimerOverlay();
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

    @Override
    public void onPause() {
        super.onPause();
        // Si el cronómetro de descanso está corriendo y el usuario sale de la app, mostrar burbuja estilo DiDi
        if (isTimerRunning && activeTimerEndMs > System.currentTimeMillis()) {
            showFloatingTimerOverlay();
        }
        // Cuando el usuario sale de la app o apaga la pantalla, encolar un trabajo de sincronización
        // sujeto a NetworkType.CONNECTED para subir cambios offline y mantener la caché fresca.
        scheduleNativeSync(true);
    }

    private void scheduleNativeSync(boolean includeOneTimeWhenConnected) {
        try {
            Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

            PeriodicWorkRequest periodicSync = new PeriodicWorkRequest.Builder(
                FluxSyncWorker.class, 15, TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build();

            WorkManager wm = WorkManager.getInstance(getApplicationContext());
            wm.enqueueUniquePeriodicWork(
                "FluxPeriodicSync",
                ExistingPeriodicWorkPolicy.KEEP,
                periodicSync
            );

            if (includeOneTimeWhenConnected) {
                OneTimeWorkRequest immediateSync = new OneTimeWorkRequest.Builder(FluxSyncWorker.class)
                    .setConstraints(constraints)
                    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
                    .build();
                wm.enqueueUniqueWork(
                    "FluxImmediateSync",
                    ExistingWorkPolicy.REPLACE,
                    immediateSync
                );
            }
        } catch (Exception e) {
            Log.w(TAG, "Error scheduling WorkManager sync: " + e.getMessage());
        }
    }

    public static void notifyWebViewSyncComplete() {
        MainActivity act = activeInstance != null ? activeInstance.get() : null;
        if (act == null) return;
        act.runOnUiThread(() -> {
            try {
                if (act.bridge != null && act.bridge.getWebView() != null) {
                    act.bridge.getWebView().evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('flux:native-sync-complete'));",
                        null
                    );
                }
            } catch (Exception ignored) {}
        });
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

    public class FluxNativeSyncBridge {
        @JavascriptInterface
        public void saveCredentials(String json) {
            try {
                JSONObject obj = new JSONObject(json);
                SharedPreferences prefs = getApplicationContext()
                    .getSharedPreferences(FluxSyncWorker.PREFS_NAME, Context.MODE_PRIVATE);
                SharedPreferences.Editor ed = prefs.edit();
                if (obj.has("supaUrl")) ed.putString("supa_url", obj.optString("supaUrl", ""));
                if (obj.has("supaKey")) ed.putString("supa_key", obj.optString("supaKey", ""));
                if (obj.has("token") && !obj.optString("token", "").isEmpty()) {
                    ed.putString("access_token", obj.optString("token", ""));
                }
                if (obj.has("refreshToken") && !obj.optString("refreshToken", "").isEmpty()) {
                    ed.putString("refresh_token", obj.optString("refreshToken", ""));
                }
                if (obj.has("role")) ed.putString("role", obj.optString("role", ""));
                if (obj.has("clientId")) ed.putString("client_id", obj.optString("clientId", ""));
                if (obj.has("profileId")) ed.putString("profile_id", obj.optString("profileId", ""));
                if (obj.has("nutriId")) ed.putString("nutri_id", obj.optString("nutriId", ""));
                if (obj.has("email")) ed.putString("email", obj.optString("email", ""));
                ed.apply();
                scheduleNativeSync(false);
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void clearCredentials() {
            try {
                SharedPreferences prefs = getApplicationContext()
                    .getSharedPreferences(FluxSyncWorker.PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit().clear().apply();
                File file = new File(getApplicationContext().getFilesDir(), FluxSyncWorker.CACHE_FILENAME);
                if (file.exists()) file.delete();
                WorkManager.getInstance(getApplicationContext()).cancelUniqueWork("FluxImmediateSync");
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void setPendingMutations(String jsonArray) {
            try {
                SharedPreferences prefs = getApplicationContext()
                    .getSharedPreferences(FluxSyncWorker.PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit().putString("pending_mutations_json", jsonArray != null ? jsonArray : "[]").apply();
                if (jsonArray != null && !jsonArray.equals("[]") && jsonArray.length() > 2) {
                    scheduleNativeSync(true);
                }
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public String consumeFlushedMutationIds() {
            try {
                SharedPreferences prefs = getApplicationContext()
                    .getSharedPreferences(FluxSyncWorker.PREFS_NAME, Context.MODE_PRIVATE);
                String ids = prefs.getString("flushed_mutation_ids", "[]");
                if (!"[]".equals(ids)) {
                    prefs.edit().putString("flushed_mutation_ids", "[]").apply();
                }
                return ids;
            } catch (Exception e) {
                return "[]";
            }
        }

        @JavascriptInterface
        public String getRefreshedTokens() {
            try {
                SharedPreferences prefs = getApplicationContext()
                    .getSharedPreferences(FluxSyncWorker.PREFS_NAME, Context.MODE_PRIVATE);
                if (!prefs.getBoolean("tokens_refreshed_by_worker", false)) {
                    return "";
                }
                String accessToken = prefs.getString("access_token", "");
                String refreshToken = prefs.getString("refresh_token", "");
                prefs.edit().putBoolean("tokens_refreshed_by_worker", false).apply();
                JSONObject res = new JSONObject();
                res.put("access_token", accessToken);
                res.put("refresh_token", refreshToken);
                return res.toString();
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public String getSyncedCache() {
            try {
                File file = new File(getApplicationContext().getFilesDir(), FluxSyncWorker.CACHE_FILENAME);
                if (!file.exists()) return "";
                StringBuilder sb = new StringBuilder();
                try (FileInputStream fis = new FileInputStream(file);
                     BufferedReader br = new BufferedReader(new InputStreamReader(fis, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = br.readLine()) != null) {
                        sb.append(line);
                    }
                }
                return sb.toString();
            } catch (Exception e) {
                return "";
            }
        }
    }

    public void showFloatingTimerOverlay() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
                return;
            }
            Intent intent = new Intent(this, FloatingTimerService.class);
            intent.setAction(FloatingTimerService.ACTION_SHOW);
            intent.putExtra(FloatingTimerService.EXTRA_END_TIME_MS, activeTimerEndMs);
            intent.putExtra(FloatingTimerService.EXTRA_BRAND_COLOR, activeTimerColor);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent);
            } else {
                startService(intent);
            }
        } catch (Exception ignored) {}
    }

    public void hideFloatingTimerOverlay() {
        try {
            Intent intent = new Intent(this, FloatingTimerService.class);
            intent.setAction(FloatingTimerService.ACTION_HIDE);
            startService(intent);
        } catch (Exception ignored) {}
    }

    public static void onOverlayStoppedTimer() {
        isTimerRunning = false;
        activeTimerEndMs = 0L;
        MainActivity act = activeInstance != null ? activeInstance.get() : null;
        if (act == null) return;
        act.runOnUiThread(() -> {
            try {
                if (act.bridge != null && act.bridge.getWebView() != null) {
                    act.bridge.getWebView().evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('flux:overlay-timer-stopped'));",
                        null
                    );
                }
            } catch (Exception ignored) {}
        });
    }

    public class FluxTimerBridge {
        @JavascriptInterface
        public boolean canDrawOverlays() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                return Settings.canDrawOverlays(MainActivity.this);
            }
            return true;
        }

        @JavascriptInterface
        public void requestOverlayPermission() {
            runOnUiThread(() -> {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(MainActivity.this)) {
                        Intent intent = new Intent(
                            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                            Uri.parse("package:" + getPackageName())
                        );
                        startActivity(intent);
                    }
                } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public void setTimerState(long endTimeMs, int totalSeconds, String brandColorHex, boolean running) {
            activeTimerEndMs = endTimeMs;
            if (brandColorHex != null && !brandColorHex.isEmpty()) {
                activeTimerColor = brandColorHex;
            }
            isTimerRunning = running;
        }

        @JavascriptInterface
        public void stopTimer() {
            isTimerRunning = false;
            activeTimerEndMs = 0L;
            runOnUiThread(() -> hideFloatingTimerOverlay());
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
