// plugins/with-r46-trust-anchor.js
const fs = require("fs");
const path = require("path");
const {
  withDangerousMod,
  withAndroidManifest,
} = require("@expo/config-plugins");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

const NETWORK_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system" />
      <certificates src="@raw/sectigo_r46" />
    </trust-anchors>
  </base-config>
  
  <!-- Configuración específica para PayPhone -->
  <domain-config>
    <domain includeSubdomains="true">payphonetodoesposible.com</domain>
    <domain includeSubdomains="true">pay.payphonetodoesposible.com</domain>
    <domain includeSubdomains="true">www.payphonetodoesposible.com</domain>
    <trust-anchors>
      <certificates src="system" />
      <certificates src="@raw/sectigo_r46" />
    </trust-anchors>
  </domain-config>
  
  <!-- Configuración para Kestore -->
  <domain-config>
    <domain includeSubdomains="true">kestore.com.ec</domain>
    <domain includeSubdomains="true">www.kestore.com.ec</domain>
    <trust-anchors>
      <certificates src="system" />
      <certificates src="@raw/sectigo_r46" />
    </trust-anchors>
  </domain-config>
  
  <!-- Configuración para Google Services (para autenticación) -->
  <domain-config>
    <domain includeSubdomains="true">accounts.google.com</domain>
    <domain includeSubdomains="true">googleapis.com</domain>
    <domain includeSubdomains="true">gstatic.com</domain>
    <domain includeSubdomains="true">googleusercontent.com</domain>
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </domain-config>
  
  <!-- Configuración para CDNs comunes -->
  <domain-config>
    <domain includeSubdomains="true">cloudflare.com</domain>
    <domain includeSubdomains="true">amazonaws.com</domain>
    <domain includeSubdomains="true">cloudfront.net</domain>
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </domain-config>
</network-security-config>
`;

module.exports = function withR46TrustAnchor(
  config,
  { certPath = "certs/sectigo_r46.cer" } = {}
) {
  // Copia sectigo_r46.cer a res/raw y genera xml/network_security_config.xml
  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      const androidRoot = cfg.modRequest.platformProjectRoot; // ./android
      const rawDir = path.join(androidRoot, "app", "src", "main", "res", "raw");
      const xmlDir = path.join(androidRoot, "app", "src", "main", "res", "xml");

      ensureDir(rawDir);
      ensureDir(xmlDir);

      // Copiar el .cer (DER) a res/raw/sectigo_r46.cer
      const src = path.join(cfg.modRequest.projectRoot, certPath);
      const dst = path.join(rawDir, "sectigo_r46.cer");
      if (!fs.existsSync(src)) {
        throw new Error(
          `No encontré el certificado en ${src}. Genera primero certs/sectigo_r46.cer`
        );
      }
      fs.copyFileSync(src, dst);

      // Crear/actualizar el network_security_config.xml
      const xmlFile = path.join(xmlDir, "network_security_config.xml");
      fs.writeFileSync(xmlFile, NETWORK_XML, "utf8");

      return cfg;
    },
  ]);

  // Añadir el atributo android:networkSecurityConfig en AndroidManifest.xml
  config = withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) {
      app.$["android:networkSecurityConfig"] = "@xml/network_security_config";
      // Ya desactivaste cleartext en app.config, pero por si acaso:
      app.$["android:usesCleartextTraffic"] = "false";
    }
    return cfg;
  });

  return config;
};
