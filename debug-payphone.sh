#!/bin/bash

# Script de debugging para PayPhone
# Ejecutar después de instalar el APK y conectar el teléfono por USB

echo "🔍 Iniciando debugging de PayPhone..."
echo ""

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verificar que ADB esté disponible
if ! command -v adb &> /dev/null; then
    echo -e "${RED}❌ ADB no está instalado o no está en el PATH${NC}"
    echo "Instala Android SDK Platform Tools"
    exit 1
fi

# Verificar dispositivos conectados
echo -e "${BLUE}📱 Verificando dispositivos conectados...${NC}"
devices=$(adb devices | grep -v "List of devices" | grep "device$" | wc -l)

if [ "$devices" -eq 0 ]; then
    echo -e "${RED}❌ No hay dispositivos Android conectados${NC}"
    echo "Conecta tu teléfono por USB y habilita USB Debugging"
    exit 1
else
    echo -e "${GREEN}✅ $devices dispositivo(s) conectado(s)${NC}"
fi

echo ""
echo -e "${YELLOW}🚀 Instrucciones:${NC}"
echo "1. Abre la app Kestore en tu teléfono"
echo "2. Navega a un producto y procede al checkout"
echo "3. Selecciona PayPhone como método de pago"
echo "4. Observa los logs en tiempo real aquí"
echo ""
echo -e "${YELLOW}📋 Logs que debes buscar:${NC}"
echo "- 🔍 Analizando URL de PayPhone"
echo "- 🔒 Error 'no autorizado' detectado - PROBLEMA DE COOKIES"
echo "- 📡 Obteniendo cookies de"
echo "- ⚠️ No se encontraron cookies para"
echo ""
echo -e "${BLUE}Presiona Ctrl+C para detener el debugging${NC}"
echo ""
echo "=================================================="

# Función para limpiar logs anteriores
echo -e "${YELLOW}🧹 Limpiando logs anteriores...${NC}"
adb logcat -c

# Iniciar monitoreo de logs
echo -e "${GREEN}📡 Monitoreando logs de PayPhone...${NC}"
echo ""

# Filtrar logs específicos de la app y PayPhone
adb logcat | grep -E "(COOKIE_DEBUG|PayPhone|kestore|ReactNativeJS|chromium)" --line-buffered | while read line; do
    # Colorear diferentes tipos de logs
    if [[ $line == *"COOKIE_DEBUG"* ]]; then
        if [[ $line == *"Error"* ]] || [[ $line == *"no autorizado"* ]]; then
            echo -e "${RED}🚨 $line${NC}"
        elif [[ $line == *"✅"* ]] || [[ $line == *"exitoso"* ]]; then
            echo -e "${GREEN}✅ $line${NC}"
        elif [[ $line == *"⚠️"* ]] || [[ $line == *"No se encontraron"* ]]; then
            echo -e "${YELLOW}⚠️  $line${NC}"
        else
            echo -e "${BLUE}🔍 $line${NC}"
        fi
    elif [[ $line == *"PayPhone"* ]]; then
        echo -e "${YELLOW}💳 $line${NC}"
    elif [[ $line == *"ERROR"* ]] || [[ $line == *"FATAL"* ]]; then
        echo -e "${RED}❌ $line${NC}"
    else
        echo "$line"
    fi
done