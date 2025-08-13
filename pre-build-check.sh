#!/bin/bash

# Script de verificación pre-build para PayPhone fixes
# Ejecutar antes de: eas build -p android --profile apk-test

echo "🔍 Verificando configuración antes del build..."
echo ""

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para verificar archivos
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅ $1 - Existe${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 - No encontrado${NC}"
        return 1
    fi
}

# Función para verificar contenido
check_content() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${GREEN}✅ $3${NC}"
        return 0
    else
        echo -e "${RED}❌ $3${NC}"
        return 1
    fi
}

echo "📋 Verificando archivos principales..."
all_good=true

# Verificar archivos críticos
check_file "App.tsx" || all_good=false
check_file "package.json" || all_good=false
check_file "app.config.ts" || all_good=false
check_file "eas.json" || all_good=false
check_file "android/app/src/main/res/xml/network_security_config.xml" || all_good=false

echo ""
echo "📋 Verificando contenido de App.tsx..."

# Verificar mejoras en App.tsx
check_content "App.tsx" "AsyncStorage" "Import de AsyncStorage" || all_good=false
check_content "App.tsx" "logCookieInfo" "Sistema de logging" || all_good=false
check_content "App.tsx" "savePayPhoneCookies" "Función savePayPhoneCookies" || all_good=false
check_content "App.tsx" "restorePayPhoneCookies" "Función restorePayPhoneCookies" || all_good=false
check_content "App.tsx" "isPaymentInProgress" "Estado isPaymentInProgress" || all_good=false
check_content "App.tsx" "thirdPartyCookiesEnabled.*true" "thirdPartyCookiesEnabled configurado" || all_good=false
check_content "App.tsx" "Chrome/131.0.6778.135" "User Agent actualizado" || all_good=false

echo ""
echo "📋 Verificando versiones..."

# Verificar versión en package.json
if grep -q '"version": "1.0.8"' package.json; then
    echo -e "${GREEN}✅ Versión 1.0.8 en package.json${NC}"
else
    echo -e "${RED}❌ Versión incorrecta en package.json${NC}"
    all_good=false
fi

# Verificar versión en app.config.ts
if grep -q 'version: "1.0.8"' app.config.ts; then
    echo -e "${GREEN}✅ Versión 1.0.8 en app.config.ts${NC}"
else
    echo -e "${RED}❌ Versión incorrecta en app.config.ts${NC}"
    all_good=false
fi

# Verificar versionCode en app.config.ts
if grep -q 'versionCode: 14' app.config.ts; then
    echo -e "${GREEN}✅ versionCode 14 en app.config.ts${NC}"
else
    echo -e "${YELLOW}⚠️  versionCode podría necesitar actualización${NC}"
fi

echo ""
echo "📋 Verificando configuración de red..."

# Verificar network security config
check_content "android/app/src/main/res/xml/network_security_config.xml" "payphonetodoesposible.com" "Configuración PayPhone en network security" || all_good=false

echo ""
echo "📋 Verificando certificados..."

# Verificar certificados
check_file "certs/sectigo_r46.cer" || all_good=false

echo ""
echo "=================================================="

if [ "$all_good" = true ]; then
    echo -e "${GREEN}🎉 ¡Todo listo para el build!${NC}"
    echo ""
    echo -e "${YELLOW}📱 Comando para ejecutar:${NC}"
    echo "eas build -p android --profile apk-test"
    echo ""
    echo -e "${YELLOW}⏱️  Tiempo estimado: 5-10 minutos${NC}"
    echo ""
    echo -e "${YELLOW}📋 Después del build:${NC}"
    echo "1. Descargar e instalar el APK"
    echo "2. Probar pagos con PayPhone"
    echo "3. Verificar logs si es necesario"
    echo "4. Reportar resultados"
else
    echo -e "${RED}⚠️  Hay problemas que necesitan atención${NC}"
    echo "Revisa los elementos marcados con ❌ antes de hacer el build"
    echo ""
    echo -e "${YELLOW}🔧 Posibles soluciones:${NC}"
    echo "- Verificar que todos los archivos estén guardados"
    echo "- Revisar que las versiones sean consistentes"
    echo "- Confirmar que los certificados estén en su lugar"
fi

echo ""
echo "📚 Documentación disponible:"
echo "- RESUMEN_MEJORAS.md - Resumen completo de cambios"
echo "- TESTING_GUIDE.md - Guía detallada de testing"
echo "- PAYPHONE_FIXES.md - Documentación técnica"