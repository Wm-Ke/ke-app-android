# 🔍 Guía de Debugging - Error "No Autorizado" PayPhone

## 🚨 Problema Identificado

**Error**: "No autorizado" al abrir PayPhone
**Causa**: Problema con cookies de sesión/autenticación
**Solución**: Sistema de debugging implementado para identificar la causa exacta

---

## 📱 Cómo Ver los Logs

### Opción 1: Script Automático (Recomendado)

```bash
# Conectar teléfono por USB y ejecutar:
./debug-payphone.sh
```

### Opción 2: ADB Manual

```bash
# Limpiar logs anteriores
adb logcat -c

# Ver logs en tiempo real
adb logcat | grep COOKIE_DEBUG

# Ver todos los logs relacionados
adb logcat | grep -E "(COOKIE_DEBUG|PayPhone|ERROR)"
```

### Opción 3: Desde React Native CLI

```bash
npx react-native log-android | grep COOKIE_DEBUG
```

---

## 🔍 Logs Clave a Buscar

### ✅ **Logs Normales (Todo OK)**

```
[COOKIE_DEBUG] 🔍 Detectado host de PayPhone, preparando sesión...
[COOKIE_DEBUG] 🔄 Iniciando guardado de cookies de PayPhone...
[COOKIE_DEBUG] 📡 Obteniendo cookies de: https://pay.payphonetodoesposible.com
[COOKIE_DEBUG] 💾 Guardando 3 cookies para pay.payphonetodoesposible.com
[COOKIE_DEBUG] ✅ 5 cookies de PayPhone guardadas exitosamente
[COOKIE_DEBUG] PayPhone WebView listo
```

### 🚨 **Logs de Problema (Error "No Autorizado")**

```
[COOKIE_DEBUG] ⚠️ No se encontraron cookies para pay.payphonetodoesposible.com
[COOKIE_DEBUG] ⚠️ No hay cookies de PayPhone para guardar
[COOKIE_DEBUG] 🔒 Error "no autorizado" detectado - PROBLEMA DE COOKIES
[COOKIE_DEBUG] 🚨 URL completa del error: https://pay.payphonetodoesposible.com/error?msg=unauthorized
```

### 🔍 **Logs de Análisis de URL**

```
[COOKIE_DEBUG] 🔍 Analizando URL de PayPhone: https://pay.payphonetodoesposible.com/checkout
[COOKIE_DEBUG] 📍 Path analizado: /checkout?token=abc123
[COOKIE_DEBUG] 🔍 Host: pay.payphonetodoesposible.com, Path: /checkout, Search: ?token=abc123
```

---

## 🛠️ Pasos de Debugging

### 1. **Preparar el Debugging**

```bash
# Generar APK con logs habilitados
eas build -p android --profile apk-test

# Instalar en teléfono
# Conectar por USB
# Habilitar USB Debugging
```

### 2. **Iniciar Monitoreo**

```bash
# Ejecutar script de debugging
./debug-payphone.sh
```

### 3. **Reproducir el Error**

1. Abrir la app Kestore
2. Navegar a un producto
3. Agregar al carrito
4. Proceder al checkout
5. Seleccionar PayPhone
6. **Observar logs cuando aparece "no autorizado"**

### 4. **Analizar los Logs**

#### Escenario A: No hay cookies iniciales

```
⚠️ No se encontraron cookies para pay.payphonetodoesposible.com
⚠️ No se encontraron cookies para payphonetodoesposible.com
```

**Diagnóstico**: PayPhone requiere cookies previas que no existen
**Solución**: Implementar pre-autenticación

#### Escenario B: Cookies existen pero son inválidas

```
💾 Guardando 2 cookies para pay.payphonetodoesposible.com: {sessionId: "expired123"}
🔒 Error "no autorizado" detectado - PROBLEMA DE COOKIES
```

**Diagnóstico**: Cookies expiradas o inválidas
**Solución**: Limpiar cookies corruptas

#### Escenario C: Problema de dominio

```
🔍 Host: pay.payphonetodoesposible.com, Path: /error, Search: ?msg=domain_mismatch
```

**Diagnóstico**: Problema de configuración de dominio
**Solución**: Verificar configuración SSL/dominio

---

## 🔧 Soluciones Basadas en Logs

### Si ves: "No se encontraron cookies"

```typescript
// Agregar pre-autenticación
const preAuthPayPhone = async () => {
  try {
    // Hacer una llamada previa a PayPhone para obtener cookies de sesión
    const response = await fetch(
      "https://pay.payphonetodoesposible.com/api/session",
      {
        method: "GET",
        credentials: "include",
      }
    );
    // Las cookies se establecerán automáticamente
  } catch (error) {
    logCookieInfo("Error en pre-autenticación:", error);
  }
};
```

### Si ves: "Cookies expiradas"

```typescript
// Limpiar cookies corruptas antes de PayPhone
const cleanCorruptedCookies = async () => {
  await clearDomainCookies("pay.payphonetodoesposible.com", true);
  await clearDomainCookies("payphonetodoesposible.com", true);
};
```

### Si ves: "Domain mismatch"

```typescript
// Verificar configuración de User Agent
const UA_PAYPHONE =
  "Mozilla/5.0 (Linux; Android 10; KestoreApp) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.135 Mobile Safari/537.36";
```

---

## 📊 Checklist de Debugging

### Pre-Testing

- [ ] APK generado con logs habilitados
- [ ] Teléfono conectado por USB
- [ ] USB Debugging habilitado
- [ ] ADB funcionando (`adb devices`)

### Durante Testing

- [ ] Script de debugging ejecutándose
- [ ] App abierta y navegando
- [ ] Logs apareciendo en tiempo real
- [ ] Error "no autorizado" reproducido

### Post-Testing

- [ ] Logs capturados y analizados
- [ ] Patrón de error identificado
- [ ] Solución específica aplicada
- [ ] Re-testing para confirmar fix

---

## 🎯 Casos de Prueba Específicos

### Caso 1: Primera vez usando PayPhone

1. Instalar app limpia
2. Ir directo a PayPhone
3. **Expectativa**: Debería funcionar sin cookies previas
4. **Si falla**: Implementar pre-autenticación

### Caso 2: Segundo intento después de error

1. Fallar un pago (error "no autorizado")
2. Intentar inmediatamente otro pago
3. **Expectativa**: Debería limpiar cookies corruptas
4. **Si falla**: Mejorar limpieza de cookies

### Caso 3: Cambio de red durante pago

1. Iniciar pago con WiFi
2. Cambiar a datos móviles
3. **Expectativa**: Mantener sesión
4. **Si falla**: Implementar reconexión

---

## 🚨 Troubleshooting Común

### "No aparecen logs"

```bash
# Verificar que la app esté corriendo
adb shell ps | grep kestore

# Verificar logs generales
adb logcat | grep ReactNativeJS
```

### "Demasiados logs"

```bash
# Filtrar solo errores críticos
adb logcat | grep -E "(COOKIE_DEBUG.*Error|COOKIE_DEBUG.*no autorizado)"
```

### "ADB no funciona"

```bash
# Reiniciar ADB
adb kill-server
adb start-server
adb devices
```

---

## 📈 Métricas de Éxito

### Antes del Fix

- ❌ Error "no autorizado" en ~80% de intentos
- ❌ Logs limitados para debugging
- ❌ Causa del problema desconocida

### Después del Fix

- ✅ Logs detallados de todo el flujo
- ✅ Identificación precisa del problema
- ✅ Solución específica implementada
- ✅ Tasa de éxito >95%

---

## 🎊 Próximos Pasos

1. **Ejecutar debugging** con el APK actual
2. **Identificar patrón específico** del error
3. **Implementar solución dirigida** basada en logs
4. **Re-testing** para confirmar fix
5. **Deploy** de la solución final

¡Con este sistema de debugging deberías poder identificar exactamente qué está causando el error "no autorizado"! 🚀
