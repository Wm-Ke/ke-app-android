// Config plugin para agregar <queries> en AndroidManifest
const { withAndroidManifest } = require("@expo/config-plugins");

const PKGS = [
  "com.whatsapp",
  "com.whatsapp.w4b",
  "com.facebook.katana",
  "com.instagram.android",
  "com.google.android.youtube",
  "com.twitter.android",
  "com.zhiliaoapp.musically",
  "com.android.vending",
];

const SCHEMES = [
  "whatsapp",
  "fb",
  "instagram",
  "tiktok",
  "youtube",
  "twitter",
  "market",
];

module.exports = function withAndroidQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.queries = manifest.queries || [{}];

    // Agrega <package> entries
    PKGS.forEach((name) => {
      manifest.queries.push({ package: [{ $: { "android:name": name } }] });
    });

    // Agrega <intent> para esquemas (por si alguna lib usa canOpenURL/intents)
    SCHEMES.forEach((scheme) => {
      manifest.queries.push({
        intent: [
          {
            action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
            data: [{ $: { "android:scheme": scheme } }],
          },
        ],
      });
    });

    return cfg;
  });
};
