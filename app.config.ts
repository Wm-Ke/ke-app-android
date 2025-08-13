import { ConfigContext, ExpoConfig } from "@expo/config";
// si prefieres tomarlo de package.json:  import pkg from "./package.json";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,

  name: "Keapp",
  slug: "keapp",
  scheme: "kestoreec",
  version: "1.0.8",
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

  updates: {
    url: "https://u.expo.dev/f1c0a9ca-595e-4122-af9b-b27f196a7988",
  },
  // ✅ En bare debe ser string, no policy
  // runtimeVersion: pkg.version as string,
  runtimeVersion: "1.0.8",

  extra: {
    eas: { projectId: "d1ba3c41-db4d-4c80-95a3-1a18dfa35aab" },
  },

  androidStatusBar: {
    translucent: true,
    barStyle: "light-content",
  },

  android: {
    package: "com.ke.ecuadorv2", // (nota: en bare lo que cuenta es android/app/build.gradle)
    versionCode: 14,
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#000000",
    },
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

  ios: {
    bundleIdentifier: "com.ke.newapp",
    buildNumber: "8",
    supportsTablet: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription:
        "Esta app necesita acceso a la cámara para que puedas subir fotos o escanear códigos.",
      NSMicrophoneUsageDescription:
        "Esta app necesita acceso al micrófono para grabar audio o usar videollamadas.",
      NSPhotoLibraryUsageDescription:
        "Esta app necesita acceso a tu galería para que puedas seleccionar imágenes.",
      NSLocationWhenInUseUsageDescription:
        "Esta app necesita tu ubicación para mostrarte productos cercanos y mejorar la entrega de tus pedidos.",
      NSUserTrackingUsageDescription:
        "Solicitamos permiso de seguimiento para mostrarte anuncios personalizados.",
    },
  },

  plugins: [
    "expo-updates",
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

          // En bare, esta bandera puede ser ignorada por tener /android.
          // Para dev client, si necesitas HTTP, ponlo también en AndroidManifest (debug).
          manifestApplicationAttributes: {
            "android:usesCleartextTraffic": "false",
          },
        },
      },
    ],
    ["./plugins/with-r46-trust-anchor", { certPath: "certs/sectigo_r46.cer" }],
  ],

  web: { favicon: "./assets/favicon.png" },
});
