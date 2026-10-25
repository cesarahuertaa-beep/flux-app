package com.fluxsport.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

public class FloatingTimerService extends Service {
    public static final String ACTION_SHOW = "com.fluxsport.app.ACTION_SHOW_TIMER_BUBBLE";
    public static final String ACTION_HIDE = "com.fluxsport.app.ACTION_HIDE_TIMER_BUBBLE";
    public static final String ACTION_STOP = "com.fluxsport.app.ACTION_STOP_TIMER_BUBBLE";

    public static final String EXTRA_END_TIME_MS = "extra_end_time_ms";
    public static final String EXTRA_BRAND_COLOR = "extra_brand_color";

    private static final String CHANNEL_ID = "flux_floating_timer_channel";
    private static final int NOTIF_ID = 4402;

    private WindowManager windowManager;
    private LinearLayout bubbleRoot;
    private GradientDrawable bubbleBg;
    private View dotView;
    private GradientDrawable dotBg;
    private TextView labelTv;
    private TextView timeTv;
    private WindowManager.LayoutParams layoutParams;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private long endTimeMs = 0L;
    private String brandColorHex = "#00B4D8";
    private boolean alarming = false;
    private int alarmTicks = 0;
    private ToneGenerator toneGen;

    private final Runnable tickRunnable = new Runnable() {
        @Override
        public void run() {
            if (bubbleRoot == null) return;
            long remainingMs = endTimeMs - System.currentTimeMillis();
            if (remainingMs <= 0) {
                if (!alarming) {
                    alarming = true;
                    alarmTicks = 0;
                    onTimerFinished();
                }
                timeTv.setText("00:00");
                labelTv.setText("¡TIEMPO!");
                labelTv.setTextColor(Color.WHITE);
                bubbleBg.setColor(alarmTicks % 2 == 0 ? Color.parseColor("#EF4444") : Color.parseColor("#B91C1C"));
                dotBg.setColor(Color.WHITE);
                alarmTicks++;
                if (alarmTicks < 24) {
                    if (alarmTicks % 2 == 1) triggerBeepAndVibrate();
                    handler.postDelayed(this, 600);
                } else {
                    stopSelfCleanup(true);
                }
            } else {
                int totalSec = (int) Math.ceil(remainingMs / 1000.0);
                int mins = totalSec / 60;
                int secs = totalSec % 60;
                timeTv.setText(String.format("%02d:%02d", mins, secs));
                handler.postDelayed(this, 250);
            }
        }
    };

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        String action = intent.getAction();
        if (ACTION_HIDE.equals(action)) {
            stopSelfCleanup(false);
            return START_NOT_STICKY;
        }
        if (ACTION_STOP.equals(action)) {
            stopSelfCleanup(true);
            return START_NOT_STICKY;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }

        endTimeMs = intent.getLongExtra(EXTRA_END_TIME_MS, 0L);
        String colorExtra = intent.getStringExtra(EXTRA_BRAND_COLOR);
        if (colorExtra != null && !colorExtra.isEmpty()) {
            brandColorHex = colorExtra;
        }
        if (endTimeMs <= System.currentTimeMillis() - 10000) {
            stopSelf();
            return START_NOT_STICKY;
        }

        startForegroundSafely();
        showOrUpdateOverlay();
        return START_NOT_STICKY;
    }

    private void startForegroundSafely() {
        try {
            Intent openIntent = new Intent(this, MainActivity.class);
            openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            int piFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT;
            PendingIntent pi = PendingIntent.getActivity(this, 0, openIntent, piFlags);

            Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);

            Notification notification = builder
                .setContentTitle("FLUX · Cronómetro de descanso")
                .setContentText("Toca para volver a tu entrenamiento")
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentIntent(pi)
                .setOngoing(true)
                .build();

            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(NOTIF_ID, notification);
            }
        } catch (Exception ignored) {}
    }

    private void showOrUpdateOverlay() {
        alarming = false;
        alarmTicks = 0;

        if (bubbleRoot == null) {
            buildBubbleView();
            int overlayType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;

            layoutParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                overlayType,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                    | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
            );
            layoutParams.gravity = Gravity.TOP | Gravity.START;
            layoutParams.x = dp(16);
            layoutParams.y = dp(140);

            try {
                windowManager.addView(bubbleRoot, layoutParams);
            } catch (Exception e) {
                bubbleRoot = null;
                stopSelf();
                return;
            }
        }

        int parsedBrand = Color.parseColor("#00B4D8");
        try {
            if (brandColorHex != null && brandColorHex.startsWith("#")) {
                parsedBrand = Color.parseColor(brandColorHex);
            }
        } catch (Exception ignored) {}

        bubbleBg.setColor(Color.parseColor("#F20B1929"));
        bubbleBg.setStroke(dp(1), Color.parseColor("#33FFFFFF"));
        dotBg.setColor(parsedBrand);
        labelTv.setText("DESCANSO");
        labelTv.setTextColor(Color.parseColor("#94A3B8"));

        handler.removeCallbacks(tickRunnable);
        handler.post(tickRunnable);
    }

    private void buildBubbleView() {
        bubbleRoot = new LinearLayout(this);
        bubbleRoot.setOrientation(LinearLayout.HORIZONTAL);
        bubbleRoot.setGravity(Gravity.CENTER_VERTICAL);
        bubbleRoot.setPadding(dp(14), dp(8), dp(10), dp(8));

        bubbleBg = new GradientDrawable();
        bubbleBg.setColor(Color.parseColor("#F20B1929"));
        bubbleBg.setCornerRadius(dp(999));
        bubbleBg.setStroke(dp(1), Color.parseColor("#33FFFFFF"));
        bubbleRoot.setBackground(bubbleBg);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            bubbleRoot.setElevation(dp(10));
        }

        // Left status dot
        dotView = new View(this);
        LinearLayout.LayoutParams dotLp = new LinearLayout.LayoutParams(dp(9), dp(9));
        dotLp.setMarginEnd(dp(9));
        dotView.setLayoutParams(dotLp);
        dotBg = new GradientDrawable();
        dotBg.setShape(GradientDrawable.OVAL);
        dotBg.setColor(Color.parseColor("#00B4D8"));
        dotView.setBackground(dotBg);
        bubbleRoot.addView(dotView);

        // Center text stack (DESCANSO + MM:SS)
        LinearLayout textCol = new LinearLayout(this);
        textCol.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams textColLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        textColLp.setMarginEnd(dp(10));
        textCol.setLayoutParams(textColLp);

        labelTv = new TextView(this);
        labelTv.setText("DESCANSO");
        labelTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 8.5f);
        labelTv.setTypeface(Typeface.DEFAULT_BOLD);
        labelTv.setTextColor(Color.parseColor("#94A3B8"));
        textCol.addView(labelTv);

        timeTv = new TextView(this);
        timeTv.setText("01:30");
        timeTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f);
        timeTv.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        timeTv.setTextColor(Color.WHITE);
        textCol.addView(timeTv);

        bubbleRoot.addView(textCol);

        // Close button (X)
        TextView closeBtn = new TextView(this);
        closeBtn.setText("✕");
        closeBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f);
        closeBtn.setTypeface(Typeface.DEFAULT_BOLD);
        closeBtn.setTextColor(Color.WHITE);
        closeBtn.setGravity(Gravity.CENTER);
        GradientDrawable closeBg = new GradientDrawable();
        closeBg.setShape(GradientDrawable.OVAL);
        closeBg.setColor(Color.parseColor("#28FFFFFF"));
        closeBtn.setBackground(closeBg);
        LinearLayout.LayoutParams closeLp = new LinearLayout.LayoutParams(dp(24), dp(24));
        closeBtn.setLayoutParams(closeLp);
        closeBtn.setOnClickListener(v -> stopSelfCleanup(true));
        bubbleRoot.addView(closeBtn);

        // Drag & Tap listener on the bubble
        bubbleRoot.setOnTouchListener(new View.OnTouchListener() {
            private int initialX;
            private int initialY;
            private float initialTouchX;
            private float initialTouchY;
            private boolean moved;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                if (layoutParams == null || windowManager == null) return false;
                switch (event.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = layoutParams.x;
                        initialY = layoutParams.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        moved = false;
                        return true;

                    case MotionEvent.ACTION_MOVE:
                        int dx = (int) (event.getRawX() - initialTouchX);
                        int dy = (int) (event.getRawY() - initialTouchY);
                        if (Math.abs(dx) > dp(5) || Math.abs(dy) > dp(5)) {
                            moved = true;
                        }
                        layoutParams.x = initialX + dx;
                        layoutParams.y = initialY + dy;
                        try {
                            windowManager.updateViewLayout(bubbleRoot, layoutParams);
                        } catch (Exception ignored) {}
                        return true;

                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL:
                        if (!moved) {
                            openMainActivity();
                        } else {
                            snapToNearestEdge();
                        }
                        return true;
                }
                return false;
            }
        });
    }

    private void snapToNearestEdge() {
        try {
            DisplayMetrics dm = getResources().getDisplayMetrics();
            int screenW = dm.widthPixels;
            int bubbleW = bubbleRoot != null ? bubbleRoot.getWidth() : dp(135);
            int mid = screenW / 2;
            layoutParams.x = (layoutParams.x + bubbleW / 2 < mid)
                ? dp(12)
                : Math.max(dp(12), screenW - bubbleW - dp(12));
            windowManager.updateViewLayout(bubbleRoot, layoutParams);
        } catch (Exception ignored) {}
    }

    private void openMainActivity() {
        try {
            Intent intent = new Intent(this, MainActivity.class);
            intent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP
                    | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            );
            startActivity(intent);
            stopSelfCleanup(false);
        } catch (Exception ignored) {}
    }

    private void onTimerFinished() {
        triggerBeepAndVibrate();
        FluxNotificationHelper.showStatusBarNotification(
            getApplicationContext(),
            null,
            "¡Tiempo de descanso terminado!",
            "Tu descanso ha finalizado. Continúa con tu siguiente serie.",
            "deporte"
        );
    }

    private void triggerBeepAndVibrate() {
        try {
            Vibrator vib = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vib != null && vib.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vib.vibrate(VibrationEffect.createOneShot(380, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    vib.vibrate(380);
                }
            }
        } catch (Exception ignored) {}

        try {
            if (toneGen == null) {
                toneGen = new ToneGenerator(AudioManager.STREAM_ALARM, 85);
            }
            toneGen.startTone(ToneGenerator.TONE_PROP_BEEP2, 320);
        } catch (Exception ignored) {}
    }

    private void stopSelfCleanup(boolean stoppedByUserOrFinished) {
        handler.removeCallbacks(tickRunnable);
        if (bubbleRoot != null && windowManager != null) {
            try {
                windowManager.removeView(bubbleRoot);
            } catch (Exception ignored) {}
            bubbleRoot = null;
        }
        if (toneGen != null) {
            try {
                toneGen.release();
            } catch (Exception ignored) {}
            toneGen = null;
        }
        if (stoppedByUserOrFinished) {
            MainActivity.onOverlayStoppedTimer();
        }
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(tickRunnable);
        if (bubbleRoot != null && windowManager != null) {
            try {
                windowManager.removeView(bubbleRoot);
            } catch (Exception ignored) {}
            bubbleRoot = null;
        }
        if (toneGen != null) {
            try {
                toneGen.release();
            } catch (Exception ignored) {}
            toneGen = null;
        }
        super.onDestroy();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel chan = new NotificationChannel(
                CHANNEL_ID,
                "Cronómetro Flotante de Entrenamiento",
                NotificationManager.IMPORTANCE_LOW
            );
            chan.setDescription("Muestra la burbuja flotante del cronómetro de descanso fuera de la app");
            chan.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(chan);
        }
    }

    private int dp(int val) {
        return Math.round(
            TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                val,
                getResources().getDisplayMetrics()
            )
        );
    }
}
