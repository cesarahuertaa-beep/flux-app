package com.fluxsport.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
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
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.lang.ref.WeakReference;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "FluxPlayUpdate";
    private static final int RC_APP_UPDATE = 9001;
    private static WeakReference<MainActivity> activeInstance;
    private AppUpdateManager appUpdateManager;
    private WebView activePdfWebView;

    private static volatile long activeTimerEndMs = 0L;
    private static volatile String activeTimerColor = "#00B4D8";
    private static volatile boolean isTimerRunning = false;

    @Override
    protected void attachBaseContext(Context newBase) {
        if (newBase != null) {
            try {
                Configuration config = new Configuration(newBase.getResources().getConfiguration());
                if (config.fontScale != 1.0f) {
                    config.fontScale = 1.0f;
                    Context ctx = newBase.createConfigurationContext(config);
                    super.attachBaseContext(ctx);
                    return;
                }
            } catch (Exception ignored) {}
        }
        super.attachBaseContext(newBase);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        activeInstance = new WeakReference<>(this);
        try {
            Window window = getWindow();
            WindowCompat.setDecorFitsSystemWindows(window, false);
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

            View contentView = findViewById(android.R.id.content);
            if (contentView != null) {
                contentView.setBackgroundColor(Color.WHITE);
                ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, windowInsets) -> {
                    Insets systemBars = windowInsets.getInsets(
                        WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                    );
                    Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
                    int bottomInset = Math.max(systemBars.bottom, ime.bottom);
                    v.setPadding(systemBars.left, systemBars.top, systemBars.right, bottomInset);
                    return WindowInsetsCompat.CONSUMED;
                });
                ViewCompat.requestApplyInsets(contentView);
            }
        } catch (Exception ignored) {}

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            try {
                WebView.enableSlowWholeDocumentDraw();
            } catch (Exception ignored) {}
        }

        FluxNotificationHelper.ensureChannels(this);

        if (this.bridge != null && this.bridge.getWebView() != null) {
            try {
                WebSettings ws = this.bridge.getWebView().getSettings();
                ws.setTextZoom(100);
            } catch (Exception ignored) {}
            this.bridge.getWebView().addJavascriptInterface(new SystemBarBridge(), "FluxAndroidBars");
            this.bridge.getWebView().addJavascriptInterface(new PlayUpdateBridge(), "FluxPlayUpdate");
            this.bridge.getWebView().addJavascriptInterface(new FluxNativeSyncBridge(), "FluxNativeSync");
            this.bridge.getWebView().addJavascriptInterface(new FluxTimerBridge(), "FluxTimerNative");
            this.bridge.getWebView().addJavascriptInterface(new FluxPdfBridge(), "FluxPdfNative");
            this.bridge.getWebView().addJavascriptInterface(new FluxNotificationBridge(), "FluxNotificationsNative");
        }

        // Solicitar permiso de notificaciones en barra de estado en Android 13+ (API 33+)
        if (Build.VERSION.SDK_INT >= 33) {
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                try {
                    if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
                        ActivityCompat.requestPermissions(
                            MainActivity.this,
                            new String[]{Manifest.permission.POST_NOTIFICATIONS},
                            5501
                        );
                    }
                } catch (Exception ignored) {}
            }, 1500);
        }

        handleNotificationIntent(getIntent());

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
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }

    private void handleNotificationIntent(Intent intent) {
        if (intent == null) return;
        final String linkUrl = intent.getStringExtra("flux_notif_link");
        if (linkUrl != null && !linkUrl.isEmpty()) {
            intent.removeExtra("flux_notif_link");
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                try {
                    if (MainActivity.this.bridge != null && MainActivity.this.bridge.getWebView() != null) {
                        String safeLink = linkUrl.replace("'", "");
                        MainActivity.this.bridge.getWebView().evaluateJavascript(
                            "window.sessionStorage.setItem('flux_pending_notif_link', '" + safeLink + "');" +
                            "window.dispatchEvent(new CustomEvent('flux:notification-click', { detail: { linkUrl: '" + safeLink + "' } }));",
                            null
                        );
                    }
                } catch (Exception ignored) {}
            }, 600);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        activeInstance = new WeakReference<>(this);
        if (this.bridge != null && this.bridge.getWebView() != null) {
            try {
                this.bridge.getWebView().getSettings().setTextZoom(100);
            } catch (Exception ignored) {}
        }
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
                    View contentView = findViewById(android.R.id.content);
                    if (contentView != null) {
                        contentView.setBackgroundColor(color);
                    }
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

    public class FluxPdfBridge {
        @JavascriptInterface
        public void printHtml(final String html, final String jobName) {
            runOnUiThread(() -> {
                try {
                    final WebView printWebView = new WebView(MainActivity.this);
                    activePdfWebView = printWebView;
                    WebSettings ws = printWebView.getSettings();
                    ws.setJavaScriptEnabled(false);
                    ws.setLoadsImagesAutomatically(true);
                    ws.setTextZoom(100);

                    printWebView.setWebViewClient(new WebViewClient() {
                        private boolean printed = false;

                        @Override
                        public void onPageFinished(final WebView view, String url) {
                            if (printed) return;
                            printed = true;
                            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                                try {
                                    PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                                    if (printManager != null) {
                                        String safeJob = (jobName != null && !jobName.trim().isEmpty())
                                            ? jobName.trim()
                                            : "FLUX_Documento";
                                        PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(safeJob);
                                        PrintAttributes attrs = new PrintAttributes.Builder()
                                            .setMediaSize(PrintAttributes.MediaSize.NA_LETTER)
                                            .setResolution(new PrintAttributes.Resolution("pdf", "pdf", 300, 300))
                                            .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                                            .build();
                                        printManager.print(safeJob, adapter, attrs);
                                    }
                                } catch (Exception e) {
                                    Log.w(TAG, "Error printing PDF: " + e.getMessage());
                                }
                            }, 450);
                        }
                    });

                    printWebView.loadDataWithBaseURL("https://localhost/", html, "text/html", "UTF-8", null);
                } catch (Exception e) {
                    Log.w(TAG, "Failed to initialize printHtml: " + e.getMessage());
                }
            });
        }

        @JavascriptInterface
        public void shareHtmlAsPdf(final String html, final String rawFileName) {
            runOnUiThread(() -> {
                try {
                    final int pageWidth = 800;
                    final int pageHeight = 1131; // A4 proportion at 800px width

                    final WebView pdfWebView = new WebView(MainActivity.this);
                    activePdfWebView = pdfWebView;
                    pdfWebView.setBackgroundColor(Color.WHITE);
                    pdfWebView.setInitialScale(100);

                    WebSettings ws = pdfWebView.getSettings();
                    ws.setJavaScriptEnabled(false);
                    ws.setLoadsImagesAutomatically(true);
                    ws.setTextZoom(100);
                    ws.setUseWideViewPort(false);

                    pdfWebView.measure(
                        View.MeasureSpec.makeMeasureSpec(pageWidth, View.MeasureSpec.EXACTLY),
                        View.MeasureSpec.makeMeasureSpec(pageHeight, View.MeasureSpec.EXACTLY)
                    );
                    pdfWebView.layout(0, 0, pageWidth, pageHeight);

                    pdfWebView.setWebViewClient(new WebViewClient() {
                        private boolean exported = false;

                        @Override
                        public void onPageFinished(final WebView view, String url) {
                            if (exported) return;
                            exported = true;
                            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                                try {
                                    view.measure(
                                        View.MeasureSpec.makeMeasureSpec(pageWidth, View.MeasureSpec.EXACTLY),
                                        View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)
                                    );
                                    int contentHeight = (int) (view.getContentHeight() * view.getScale());
                                    int totalHeight = Math.max(pageHeight, Math.max(view.getMeasuredHeight(), contentHeight));
                                    view.layout(0, 0, pageWidth, totalHeight);

                                    int numPages = Math.min(25, Math.max(1, (int) Math.ceil((double) totalHeight / pageHeight)));
                                    PdfDocument document = new PdfDocument();

                                    for (int p = 0; p < numPages; p++) {
                                        PdfDocument.PageInfo pageInfo = new PdfDocument.PageInfo.Builder(pageWidth, pageHeight, p + 1).create();
                                        PdfDocument.Page page = document.startPage(pageInfo);
                                        Canvas canvas = page.getCanvas();
                                        canvas.drawColor(Color.WHITE);
                                        canvas.save();
                                        canvas.translate(0, -p * pageHeight);
                                        canvas.clipRect(0, p * pageHeight, pageWidth, (p + 1) * pageHeight);
                                        view.draw(canvas);
                                        canvas.restore();
                                        document.finishPage(page);
                                    }

                                    String cleanName = (rawFileName != null ? rawFileName : "FLUX_Reporte")
                                        .replaceAll("[^a-zA-Z0-9_\\-]", "_");
                                    if (cleanName.isEmpty()) cleanName = "FLUX_Reporte";
                                    if (!cleanName.toLowerCase().endsWith(".pdf")) {
                                        cleanName = cleanName + ".pdf";
                                    }

                                    File pdfFile = new File(getCacheDir(), cleanName);
                                    try (FileOutputStream fos = new FileOutputStream(pdfFile)) {
                                        document.writeTo(fos);
                                    }
                                    document.close();

                                    Uri uri = FileProvider.getUriForFile(
                                        MainActivity.this,
                                        getPackageName() + ".fileprovider",
                                        pdfFile
                                    );

                                    Intent shareIntent = new Intent(Intent.ACTION_SEND);
                                    shareIntent.setType("application/pdf");
                                    shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
                                    shareIntent.putExtra(Intent.EXTRA_SUBJECT, cleanName.replace(".pdf", ""));
                                    shareIntent.putExtra(Intent.EXTRA_TITLE, cleanName);
                                    shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                                    Intent chooser = Intent.createChooser(shareIntent, "Compartir PDF");
                                    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                    startActivity(chooser);
                                } catch (Exception e) {
                                    Log.w(TAG, "Error generating/sharing PDF: " + e.getMessage());
                                } finally {
                                    if (MainActivity.this.bridge != null && MainActivity.this.bridge.getWebView() != null) {
                                        MainActivity.this.bridge.getWebView().evaluateJavascript(
                                            "window.dispatchEvent(new CustomEvent('flux:pdf-share-done'));",
                                            null
                                        );
                                    }
                                }
                            }, 550);
                        }
                    });

                    pdfWebView.loadDataWithBaseURL("https://localhost/", html, "text/html", "UTF-8", null);
                } catch (Exception e) {
                    Log.w(TAG, "Failed to shareHtmlAsPdf: " + e.getMessage());
                    if (MainActivity.this.bridge != null && MainActivity.this.bridge.getWebView() != null) {
                        MainActivity.this.bridge.getWebView().evaluateJavascript(
                            "window.dispatchEvent(new CustomEvent('flux:pdf-share-done'));",
                            null
                        );
                    }
                }
            });
        }
    }

    /**
     * Puente nativo de notificaciones para disparar alertas en la barra de estado de Android
     * inmediatamente desde la app en primer plano y gestionar permisos de Android 13+.
     */
    private class FluxNotificationBridge {
        @JavascriptInterface
        public boolean hasPermission() {
            return FluxNotificationHelper.hasPermission(getApplicationContext());
        }

        @JavascriptInterface
        public void requestPermission() {
            if (Build.VERSION.SDK_INT >= 33) {
                runOnUiThread(() -> {
                    try {
                        ActivityCompat.requestPermissions(
                            MainActivity.this,
                            new String[]{Manifest.permission.POST_NOTIFICATIONS},
                            5501
                        );
                    } catch (Exception ignored) {}
                });
            }
        }

        @JavascriptInterface
        public boolean isAlreadyShown(final String id) {
            return FluxNotificationHelper.isAlreadyShown(getApplicationContext(), id);
        }

        @JavascriptInterface
        public void showNotification(final String id, final String title, final String message, final String linkUrl) {
            FluxNotificationHelper.showStatusBarNotification(
                getApplicationContext(),
                id,
                title,
                message,
                linkUrl
            );
        }
    }
}

