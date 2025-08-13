#!/usr/bin/env node

/**
 * Script de verificación para las mejoras de PayPhone
 * Ejecutar con: node test-payphone.js
 */

const fs = require("fs");
const path = require("path");

console.log("🔍 Verificando mejoras de PayPhone...\n");

// Verificar archivos modificados
const filesToCheck = [
  "App.tsx",
  "package.json",
  "app.config.ts",
  "android/app/src/main/res/xml/network_security_config.xml",
  "PAYPHONE_FIXES.md",
];

let allFilesOk = true;

filesToCheck.forEach((file) => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} - Existe`);
  } else {
    console.log(`❌ ${file} - No encontrado`);
    allFilesOk = false;
  }
});

console.log("\n📋 Verificando contenido de App.tsx...");

// Verificar mejoras específicas en App.tsx
const appTsxPath = path.join(__dirname, "App.tsx");
if (fs.existsSync(appTsxPath)) {
  const content = fs.readFileSync(appTsxPath, "utf8");

  const checks = [
    { name: "AsyncStorage import", pattern: /import AsyncStorage/ },
    { name: "Sistema de logging", pattern: /logCookieInfo/ },
    { name: "Función savePayPhoneCookies", pattern: /savePayPhoneCookies/ },
    {
      name: "Función restorePayPhoneCookies",
      pattern: /restorePayPhoneCookies/,
    },
    { name: "Estado isPaymentInProgress", pattern: /isPaymentInProgress/ },
    {
      name: "Configuración thirdPartyCookiesEnabled",
      pattern: /thirdPartyCookiesEnabled.*true/,
    },
    {
      name: "Configuración sharedCookiesEnabled",
      pattern: /sharedCookiesEnabled.*true/,
    },
    { name: "Configuración incognito false", pattern: /incognito.*false/ },
    { name: "Manejo de errores onError", pattern: /onError.*syntheticEvent/ },
    { name: "User Agent actualizado", pattern: /Chrome\/131\.0\.6778\.135/ },
  ];

  checks.forEach((check) => {
    if (check.pattern.test(content)) {
      console.log(`✅ ${check.name}`);
    } else {
      console.log(`❌ ${check.name}`);
      allFilesOk = false;
    }
  });
}

console.log("\n📋 Verificando package.json...");

// Verificar versión en package.json
const packagePath = path.join(__dirname, "package.json");
if (fs.existsSync(packagePath)) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));

  if (packageJson.version === "1.0.8") {
    console.log("✅ Versión actualizada a 1.0.8");
  } else {
    console.log(
      `❌ Versión incorrecta: ${packageJson.version} (esperada: 1.0.8)`
    );
    allFilesOk = false;
  }

  // Verificar dependencias necesarias
  const requiredDeps = [
    "@react-native-async-storage/async-storage",
    "@react-native-cookies/cookies",
    "react-native-webview",
  ];

  requiredDeps.forEach((dep) => {
    if (packageJson.dependencies[dep]) {
      console.log(`✅ Dependencia ${dep}: ${packageJson.dependencies[dep]}`);
    } else {
      console.log(`❌ Dependencia faltante: ${dep}`);
      allFilesOk = false;
    }
  });
}

console.log("\n📋 Verificando configuración de red...");

// Verificar network security config
const networkConfigPath = path.join(
  __dirname,
  "android/app/src/main/res/xml/network_security_config.xml"
);
if (fs.existsSync(networkConfigPath)) {
  const networkConfig = fs.readFileSync(networkConfigPath, "utf8");

  if (networkConfig.includes("payphonetodoesposible.com")) {
    console.log("✅ Configuración de PayPhone en network security");
  } else {
    console.log("❌ Falta configuración de PayPhone en network security");
    allFilesOk = false;
  }
}

console.log("\n" + "=".repeat(50));

if (allFilesOk) {
  console.log("🎉 ¡Todas las mejoras están implementadas correctamente!");
  console.log("\n📱 Próximos pasos:");
  console.log("1. Ejecutar: npx expo run:android");
  console.log("2. Probar un pago con PayPhone");
  console.log("3. Verificar logs en desarrollo");
  console.log("4. Confirmar que los pagos se completan");
} else {
  console.log("⚠️  Hay algunos problemas que necesitan atención");
  console.log("Revisa los elementos marcados con ❌");
}

console.log("\n🔧 Comandos útiles:");
console.log("- Desarrollo: npx expo start");
console.log("- Android: npx expo run:android");
console.log("- Logs: npx react-native log-android");
console.log("- Build: eas build -p android --profile production");
