# Directrices del Proyecto FLUX (Reglas para Agentes de IA)

Este archivo define los estándares de sincronización, arquitectura y despliegue del proyecto FLUX para mantener todas las plataformas (PWA/Web, Android Nativo y Electron) perfectamente alineadas.

---

## 1. Arquitectura Multiplataforma

- **Núcleo de Código Compartido**: Todo el código de la interfaz y lógica de negocio vive en `src/`.
- **Web / PWA**: Se despliega automáticamente a Vercel con cada push a la rama `main`.
- **Android (Capacitor)**: Proyecto nativo en `android/`. Depende de los archivos compilados en `dist/` copiados a `android/app/src/main/assets/public`.
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions).

---

## 2. Regla Obligatoria de Sincronización Automática

> [!IMPORTANT]
> **SIEMPRE que se realicen cambios en el código (`src/`) y se vaya a hacer commit o push:**
> 1. Ejecutar `npm run build` para garantizar que la compilación de Vite sea limpia (0 errores).
> 2. Ejecutar `npx cap sync android` para inyectar automáticamente la versión más reciente en el proyecto nativo de Android (`android/app/src/main/assets/public`).
> 3. De esta manera, el proyecto interno de Android y cualquier APK o AAB que se genere estará 100% al día con la PWA.

---

## 3. Comandos de Compilación Android

- **Sincronizar cambios web con Android**:
  `npx cap sync android` (o `npm run android:sync`)
- **Compilar APK Release (Instalador directo)**:
  `cd android && gradlew.bat assembleRelease` (o `npm run android:apk`)
  *Salida: `android/app/build/outputs/apk/release/app-release.apk`*
- **Compilar AAB Release (Google Play Bundle)**:
  `cd android && gradlew.bat bundleRelease` (o `npm run android:bundle`)
  *Salida: `android/app/build/outputs/bundle/release/app-release.aab`*

---

## 4. Entorno de Ejecución (Windows)
En Windows PowerShell, las políticas de ejecución pueden restringir scripts directos `.ps1`. Ejecutar los comandos a través de `cmd.exe /c "..."` para garantizar compatibilidad total.
