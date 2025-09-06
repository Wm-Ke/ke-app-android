#!/usr/bin/env node

/**
 * Script de verificación pre-build para KeApp
 * Verifica que todas las configuraciones estén correctas antes del build de producción
 */

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");

// Colores para la consola
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function checkFile(filePath, description) {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  if (fs.existsSync(fullPath)) {
    log(`✅ ${description}`, colors.green);
    return true;
  } else {
    log(`❌ ${description} - Archivo no encontrado: ${filePath}`, colors.red);
    return false;
  }
}

function checkVersionConsistency() {
  log("\n📋 Verificando consistencia de versiones...", colors.blue);

  try {
    // Leer package.json
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8")
    );
    const packageVersion = packageJson.version;

    // Leer app.config.ts
    const appConfigContent = fs.readFileSync(
      path.join(PROJECT_ROOT, "app.config.ts"),
      "utf8"
    );
    const versionMatch = appConfigContent.match(/version:\s*["']([^"']+)["']/);
    const runtimeVersionMatch = appConfigContent.match(
      /runtimeVersion:\s*["']([^"']+)["']/
    );
    const versionCodeMatch = appConfigContent.match(/versionCode:\s*(\d+)/);

    if (!versionMatch || !runtimeVersionMatch || !versionCodeMatch) {
      log(
        "❌ No se pudieron extraer las versiones de app.config.ts",
        colors.red
      );
      return false;
    }

    const appVersion = versionMatch[1];
    const runtimeVersion = runtimeVersionMatch[1];
    const versionCode = parseInt(versionCodeMatch[1]);

    // Leer build.gradle
    const buildGradleContent = fs.readFileSync(
      path.join(PROJECT_ROOT, "android/app/build.gradle"),
      "utf8"
    );
    const gradleVersionNameMatch = buildGradleContent.match(
      /versionName\s*["']([^"']+)["']/
    );
    const gradleVersionCodeMatch =
      buildGradleContent.match(/versionCode\s*(\d+)/);

    if (!gradleVersionNameMatch || !gradleVersionCodeMatch) {
      log(
        "❌ No se pudieron extraer las versiones de build.gradle",
        colors.red
      );
      return false;
    }

    const gradleVersionName = gradleVersionNameMatch[1];
    const gradleVersionCode = parseInt(gradleVersionCodeMatch[1]);

    // Verificar consistencia
    let allConsistent = true;

    log(`\n📊 Versiones encontradas:`);
    log(`   package.json: ${packageVersion}`);
    log(`   app.config.ts version: ${appVersion}`);
    log(`   app.config.ts runtimeVersion: ${runtimeVersion}`);
    log(`   app.config.ts versionCode: ${versionCode}`);
    log(`   build.gradle versionName: ${gradleVersionName}`);
    log(`   build.gradle versionCode: ${gradleVersionCode}`);

    if (packageVersion !== appVersion) {
      log(
        `❌ Inconsistencia: package.json (${packageVersion}) != app.config.ts (${appVersion})`,
        colors.red
      );
      allConsistent = false;
    }

    if (appVersion !== runtimeVersion) {
      log(
        `❌ Inconsistencia: app.config.ts version (${appVersion}) != runtimeVersion (${runtimeVersion})`,
        colors.red
      );
      allConsistent = false;
    }

    if (appVersion !== gradleVersionName) {
      log(
        `❌ Inconsistencia: app.config.ts (${appVersion}) != build.gradle (${gradleVersionName})`,
        colors.red
      );
      allConsistent = false;
    }

    if (versionCode !== gradleVersionCode) {
      log(
        `❌ Inconsistencia: app.config.ts versionCode (${versionCode}) != build.gradle (${gradleVersionCode})`,
        colors.red
      );
      allConsistent = false;
    }

    if (allConsistent) {
      log("✅ Todas las versiones son consistentes", colors.green);
    }

    return allConsistent;
  } catch (error) {
    log(`❌ Error verificando versiones: ${error.message}`, colors.red);
    return false;
  }
}

function checkSSLConfiguration() {
  log("\n🔒 Verificando configuración SSL...", colors.blue);

  let allGood = true;

  // Verificar certificado
  allGood &= checkFile("certs/sectigo_r46.cer", "Certificado SSL Sectigo R46");

  // Verificar network security config
  allGood &= checkFile(
    "android/app/src/main/res/xml/network_security_config.xml",
    "Configuración de seguridad de red"
  );

  // Verificar que el certificado esté en raw
  allGood &= checkFile(
    "android/app/src/main/res/raw/sectigo_r46.cer",
    "Certificado en recursos raw"
  );

  return allGood;
}

function checkUserAgent() {
  log("\n🌐 Verificando User Agent...", colors.blue);

  try {
    const appTsxContent = fs.readFileSync(
      path.join(PROJECT_ROOT, "App.tsx"),
      "utf8"
    );
    const uaMatch = appTsxContent.match(/const UA =\s*["']([^"']+)["']/);

    if (!uaMatch) {
      log("❌ No se pudo encontrar el User Agent en App.tsx", colors.red);
      return false;
    }

    const userAgent = uaMatch[1];

    if (userAgent.includes("KeApp/1.0.10")) {
      log("✅ User Agent actualizado correctamente", colors.green);
      log(`   ${userAgent}`, colors.yellow);

      // Verificar que también tenga configuración para Google Auth
      if (
        userAgent.includes("Chrome/") &&
        userAgent.includes("Mobile Safari/")
      ) {
        log("✅ User Agent compatible con Google OAuth", colors.green);
        return true;
      } else {
        log(
          "⚠️  User Agent podría tener problemas con Google OAuth",
          colors.yellow
        );
        return true; // No es crítico, pero es una advertencia
      }
    } else {
      log("❌ User Agent no contiene la versión correcta (1.0.10)", colors.red);
      log(`   ${userAgent}`, colors.yellow);
      return false;
    }
  } catch (error) {
    log(`❌ Error verificando User Agent: ${error.message}`, colors.red);
    return false;
  }
}

function checkUtilsFile() {
  log("\n🛠️ Verificando archivo de utilidades...", colors.blue);

  return checkFile(
    "src/utils/AppUtils.ts",
    "Archivo de utilidades AppUtils.ts"
  );
}

function getAndroidVersionName(apiLevel) {
  const versions = {
    21: "5.0 Lollipop",
    22: "5.1 Lollipop",
    23: "6.0 Marshmallow",
    24: "7.0 Nougat",
    25: "7.1 Nougat",
    26: "8.0 Oreo",
    27: "8.1 Oreo",
    28: "9.0 Pie",
    29: "10",
    30: "11",
    31: "12",
    32: "12L",
    33: "13",
    34: "14",
    35: "15",
  };
  return versions[apiLevel] || `API ${apiLevel}`;
}

function checkAndroidApiLevel() {
  log("\n📱 Verificando nivel de API de Android...", colors.blue);

  let allGood = true;

  try {
    // Verificar android/build.gradle
    const buildGradleContent = fs.readFileSync(
      path.join(PROJECT_ROOT, "android/build.gradle"),
      "utf8"
    );

    const targetSdkMatch = buildGradleContent.match(/targetSdkVersion.*?(\d+)/);
    const compileSdkMatch = buildGradleContent.match(
      /compileSdkVersion.*?(\d+)/
    );
    const minSdkMatch = buildGradleContent.match(/minSdkVersion.*?(\d+)/);

    if (targetSdkMatch) {
      const targetSdk = parseInt(targetSdkMatch[1]);
      if (targetSdk >= 35) {
        log(`✅ Target SDK Version: ${targetSdk} (Android 15+)`, colors.green);
      } else {
        log(
          `❌ Target SDK Version: ${targetSdk} (Debe ser 35+ para Android 15)`,
          colors.red
        );
        log(
          "   Google Play requiere Android 15 (API 35) desde agosto 2025",
          colors.yellow
        );
        allGood = false;
      }
    }

    if (compileSdkMatch) {
      const compileSdk = parseInt(compileSdkMatch[1]);
      if (compileSdk >= 35) {
        log(`✅ Compile SDK Version: ${compileSdk}`, colors.green);
      } else {
        log(`❌ Compile SDK Version: ${compileSdk} (Debe ser 35+)`, colors.red);
        allGood = false;
      }
    }

    if (minSdkMatch) {
      const minSdk = parseInt(minSdkMatch[1]);
      if (minSdk <= 21) {
        log(
          `✅ Min SDK Version: ${minSdk} (Android ${getAndroidVersionName(minSdk)}) - Máxima compatibilidad`,
          colors.green
        );
      } else if (minSdk <= 24) {
        log(
          `✅ Min SDK Version: ${minSdk} (Android ${getAndroidVersionName(minSdk)}) - Buena compatibilidad`,
          colors.yellow
        );
      } else {
        log(
          `⚠️ Min SDK Version: ${minSdk} (Android ${getAndroidVersionName(minSdk)}) - Compatibilidad limitada`,
          colors.yellow
        );
      }
    }

    // Verificar app.config.ts
    const appConfigContent = fs.readFileSync(
      path.join(PROJECT_ROOT, "app.config.ts"),
      "utf8"
    );

    if (appConfigContent.includes("targetSdkVersion: 35")) {
      log("✅ App.config.ts configurado para Android 15", colors.green);
    } else {
      log("❌ App.config.ts no tiene targetSdkVersion: 35", colors.red);
      allGood = false;
    }

    return allGood;
  } catch (error) {
    log(`❌ Error verificando nivel de API: ${error.message}`, colors.red);
    return false;
  }
}

function checkGoogleOAuthConfiguration() {
  log("\n🔐 Verificando configuración de Google OAuth...", colors.blue);

  let allGood = true;

  try {
    // Verificar AndroidManifest.xml para queries de Google
    const manifestContent = fs.readFileSync(
      path.join(PROJECT_ROOT, "android/app/src/main/AndroidManifest.xml"),
      "utf8"
    );

    if (manifestContent.includes("com.google.android.gms")) {
      log(
        "✅ Google Play Services configurado en AndroidManifest",
        colors.green
      );
    } else {
      log(
        "❌ Google Play Services no encontrado en AndroidManifest",
        colors.red
      );
      allGood = false;
    }

    if (manifestContent.includes("accounts.google.com")) {
      log("✅ Queries para Google OAuth configuradas", colors.green);
    } else {
      log("❌ Queries para Google OAuth no encontradas", colors.red);
      allGood = false;
    }

    // Verificar network security config para Google
    const networkConfigContent = fs.readFileSync(
      path.join(
        PROJECT_ROOT,
        "android/app/src/main/res/xml/network_security_config.xml"
      ),
      "utf8"
    );

    if (
      networkConfigContent.includes("accounts.google.com") &&
      networkConfigContent.includes("googleapis.com")
    ) {
      log("✅ Configuración SSL para Google OAuth", colors.green);
    } else {
      log("❌ Configuración SSL para Google OAuth incompleta", colors.red);
      allGood = false;
    }

    // Verificar App.tsx para manejo de OAuth
    const appContent = fs.readFileSync(
      path.join(PROJECT_ROOT, "App.tsx"),
      "utf8"
    );

    if (
      appContent.includes("GOOGLE_OAUTH_SUCCESS") &&
      appContent.includes("handleGoogleOAuth")
    ) {
      log("✅ Manejo de Google OAuth implementado en App.tsx", colors.green);
    } else {
      log("❌ Manejo de Google OAuth no encontrado en App.tsx", colors.red);
      allGood = false;
    }

    return allGood;
  } catch (error) {
    log(
      `❌ Error verificando configuración de Google OAuth: ${error.message}`,
      colors.red
    );
    return false;
  }
}

function main() {
  log(
    `${colors.bold}🚀 KeApp Pre-Build Verification${colors.reset}`,
    colors.blue
  );
  log("=".repeat(50));

  let allChecksPass = true;

  // Verificar archivos esenciales
  log("\n📁 Verificando archivos esenciales...", colors.blue);
  allChecksPass &= checkFile("App.tsx", "Archivo principal App.tsx");
  allChecksPass &= checkFile("app.config.ts", "Configuración de la app");
  allChecksPass &= checkFile("package.json", "Package.json");
  allChecksPass &= checkFile(
    "android/app/build.gradle",
    "Build.gradle de Android"
  );
  allChecksPass &= checkFile(
    "android/app/src/main/AndroidManifest.xml",
    "AndroidManifest.xml"
  );

  // Verificar consistencia de versiones
  allChecksPass &= checkVersionConsistency();

  // Verificar configuración SSL
  allChecksPass &= checkSSLConfiguration();

  // Verificar User Agent
  allChecksPass &= checkUserAgent();

  // Verificar utilidades
  allChecksPass &= checkUtilsFile();

  // Verificar nivel de API de Android
  allChecksPass &= checkAndroidApiLevel();

  // Verificar configuración de Google OAuth
  allChecksPass &= checkGoogleOAuthConfiguration();

  // Resultado final
  log("\n" + "=".repeat(50));
  if (allChecksPass) {
    log(
      `${colors.bold}✅ TODAS LAS VERIFICACIONES PASARON${colors.reset}`,
      colors.green
    );
    log("🎉 La aplicación está lista para build de producción!", colors.green);
    process.exit(0);
  } else {
    log(
      `${colors.bold}❌ ALGUNAS VERIFICACIONES FALLARON${colors.reset}`,
      colors.red
    );
    log(
      "⚠️  Por favor, corrige los errores antes de hacer el build.",
      colors.yellow
    );
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
