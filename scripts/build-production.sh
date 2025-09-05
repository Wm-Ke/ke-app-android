#!/bin/bash

# Script de build para producción de KeApp
# Este script ejecuta todas las verificaciones necesarias antes del build

set -e  # Salir si cualquier comando falla

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BOLD}${BLUE}🚀 KeApp Production Build Script${NC}"
echo "=================================================="

# Función para logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    error "No se encontró package.json. Asegúrate de estar en el directorio raíz del proyecto."
    exit 1
fi

# Verificar que Node.js esté instalado
if ! command -v node &> /dev/null; then
    error "Node.js no está instalado. Por favor, instala Node.js primero."
    exit 1
fi

# Verificar que npm esté instalado
if ! command -v npm &> /dev/null; then
    error "npm no está instalado. Por favor, instala npm primero."
    exit 1
fi

# Verificar que EAS CLI esté instalado
if ! command -v eas &> /dev/null; then
    warning "EAS CLI no está instalado. Instalando..."
    npm install -g @expo/eas-cli
fi

log "📋 Ejecutando verificaciones pre-build..."
node scripts/pre-build-check.js

if [ $? -ne 0 ]; then
    error "Las verificaciones pre-build fallaron. Por favor, corrige los errores antes de continuar."
    exit 1
fi

log "✅ Verificaciones pre-build completadas exitosamente"

# Limpiar caché de npm
log "🧹 Limpiando caché de npm..."
npm cache clean --force

# Instalar dependencias
log "📦 Instalando dependencias..."
npm install

# Verificar que expo esté instalado
log "🔧 Verificando instalación de Expo..."
npx expo install --fix

# Limpiar caché de Expo
log "🧹 Limpiando caché de Expo..."
npx expo r -c

# Verificar configuración de EAS
log "⚙️ Verificando configuración de EAS..."
if [ ! -f "eas.json" ]; then
    warning "eas.json no encontrado. Creando configuración básica..."
    npx eas build:configure
fi

# Mostrar información del build
log "📊 Información del build:"
echo "   Proyecto: $(grep '"name"' package.json | cut -d'"' -f4)"
echo "   Versión: $(grep '"version"' package.json | cut -d'"' -f4)"
echo "   Plataforma: Android"
echo "   Perfil: production"

# Confirmar antes de proceder
echo ""
read -p "¿Deseas continuar con el build de producción? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log "Build cancelado por el usuario."
    exit 0
fi

# Ejecutar build de producción
log "🏗️ Iniciando build de producción..."
log "Este proceso puede tomar varios minutos..."

npx eas build -p android --profile production --non-interactive

if [ $? -eq 0 ]; then
    log "🎉 Build de producción completado exitosamente!"
    log "📱 El APK estará disponible en tu dashboard de EAS."
    log "🔗 Puedes verlo en: https://expo.dev/accounts/wm-notificaciones/projects/keapp/builds"
    
    echo ""
    echo "Próximos pasos:"
    echo "1. Descarga el APK desde el dashboard de EAS"
    echo "2. Prueba la aplicación en dispositivos reales"
    echo "3. Si todo funciona correctamente, sube a Google Play con:"
    echo "   npx eas submit -p android --profile production"
else
    error "El build de producción falló. Revisa los logs para más detalles."
    exit 1
fi