# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# Preserve annotations and JavaScript interfaces for WebView
-keepattributes *Annotation*
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve MainActivity bridges and WorkManager sync worker
-keep class com.fluxsport.app.MainActivity$* { *; }
-keep class com.fluxsport.app.FluxSyncWorker { *; }
-keep class * extends androidx.work.ListenableWorker {
    public <init>(android.content.Context, androidx.work.WorkerParameters);
}

# Preserve Capacitor core and plugin reflection
-keep class com.getcapacitor.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }

# Preserve RevenueCat
-keep class com.revenuecat.purchases.** { *; }
-keep class com.revenuecat.** { *; }

# Preserve Google Play In-App Update
-keep class com.google.android.play.core.** { *; }
