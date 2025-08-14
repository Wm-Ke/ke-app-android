import { ConfigContext, ExpoConfig } from "@expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,

  // ====== App metadata ======
  name: "Keapp",
  slug: "keapp",
  scheme: "kestoreec",
  version: "1.0.8", // <- si subes a PROD, súbelo (p.ej. 1.0.9)
  orientation: "default",
  userInterfaceStyle: "automatic",
  owner: "wm-notificaciones",

  icon: "./assets/images/icon.png",
  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#000000",
  },
  assetBundlePatterns: ["**/*"],

  // ====== OTA / Updates ======
  updates: {
    url: "https://u.expo.dev/f1c0a9ca-595e-4122-af9b-b27f196a7988",
    fallbackToCacheTimeout: 0,
  },
  // Si prefieres no actualizar esto a mano, puedes usar:
  // runtimeVersion: { policy: "appVersion" },
  runtimeVersion: "1.0.8",

  extra: {
    eas: { projectId: "d1ba3c41-db4d-4c80-95a3-1a18dfa35aab" },
  },

  // ====== Status bar ======
  androidStatusBar: {
    translucent: true,
    barStyle: "light-content",
  },

  // ====== ANDROID ONLY ======
  android: {
    package: "com.ke.ecuadorv2",
    versionCode: 14, // <- súbelo en cada release (15, 16, ...)
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#000000",
    },

    // Mantengo tus permisos. Si no usas alguno en nativo, puedes limpiarlos.
    permissions: [
      "INTERNET",
      "ACCESS_NETWORK_STATE",
      "POST_NOTIFICATIONS",
      "CAMERA",
      "RECORD_AUDIO",
      "READ_MEDIA_IMAGES",
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "RECEIVE_BOOT_COMPLETED",
      "VIBRATE",
      "WAKE_LOCK",
    ],

    // App Links (autoVerify): recuerda publicar /.well-known/assetlinks.json
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          { scheme: "https", host: "www.kestore.com.ec", pathPrefix: "/" },
          { scheme: "https", host: "kestore.com.ec", pathPrefix: "/" },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "www.kestore.com.ec",
            pathPrefix: "/producto",
          },
          { scheme: "https", host: "www.kestore.com.ec", pathPrefix: "/promo" },
          {
            scheme: "https",
            host: "www.kestore.com.ec",
            pathPrefix: "/oferta",
          },
          { scheme: "https", host: "kestore.com.ec", pathPrefix: "/producto" },
          { scheme: "https", host: "kestore.com.ec", pathPrefix: "/promo" },
          { scheme: "https", host: "kestore.com.ec", pathPrefix: "/oferta" },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },

  // ====== Plugins ======
  plugins: [
    "expo-updates",
    "expo-navigation-bar", // modo inmersivo (ocultar barra inferior)

    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#000000",
        imageWidth: 200,
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/images/notification-icon.png",
        color: "#000000",
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 24,
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          buildToolsVersion: "35.0.0",

          kotlinVersion: "1.9.25",
          composeCompilerVersion: "1.5.15",
          kspVersion: "1.9.25-1.0.20",

          // HTTPS only (si necesitas HTTP en dev, se maneja en AndroidManifest debug)
          manifestApplicationAttributes: {
            "android:usesCleartextTraffic": "false",
          },
        },
      },
    ],

    // 🔸 imprescindible para abrir apps sociales en Android 11+
    ["./plugins/with-android-queries.js"],

    // Tu trust anchor (certificado)
    ["./plugins/with-r46-trust-anchor", { certPath: "certs/sectigo_r46.cer" }],
  ],

  // ====== Web (no afecta Android nativo) ======
  web: { favicon: "./assets/favicon.png" },

  // ❌ iOS: se elimina porque este proyecto es solo Android.
});
