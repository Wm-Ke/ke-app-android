# 🔒 Solución para Error "No Autorizado" en PayPhone

## 🎯 **PROBLEMA IDENTIFICADO**

**Error**: "No autorizado" al abrir PayPhone
**Causa**: Falta de cookies de sesión/autenticación requeridas por PayPhone
**Estado**: Sistema de debugging completo implementado

---

## 🛠️ **HERRAMIENTAS DE DEBUGGING IMPLEMENTADAS**

### 1. **Logging Detallado**

- ✅ Logs con timestamp para tracking preciso
- ✅ Logs específicos para errores "no autorizado"
- ✅ Análisis detallado de URLs de PayPhone
- ✅ Tracking completo del flujo de cookies

### 2. **Diagnóstico Automático**

- ✅ Función `diagnosePayPhoneIssue()` que verifica:
  - Cookies existentes por dominio
  - Cookies de sesión específicas (session, auth, token)
  - Estado de AsyncStorage
  - Identificación de causas probables

### 3. **Scripts de Debugging**

- ✅ `debug-payphone.sh` - Monitoreo automático de logs
- ✅ `pre-build-check.sh` - Verificación pre-build
- ✅ Filtros específicos para logs críticos

---

## 🚀 **CÓMO USAR EL SISTEMA DE DEBUGGING**

### Paso 1: Generar APK con Debugging

```bash
eas build -p android --profile apk-test
```

### Paso 2: Instalar y Conectar

1. Instalar APK en teléfono
2. Conectar por USB
3. Habilitar USB Debugging

### Paso 3: Iniciar Monitoreo

```bash
./debug-payphone.sh
```

### Paso 4: Reproducir Error

1. Abrir app Kestore
2. Ir a checkout
3. Seleccionar PayPhone
4. **Observar logs cuando aparece "no autorizado"**

---

## 🔍 **LOGS CLAVE A BUSCAR**

### ✅ **Diagnóstico Exitoso**

```
[COOKIE_DEBUG] 🔬 Iniciando diagnóstico de PayPhone...
[COOKIE_DEBUG] 🍪 pay.payphonetodoesposible.com: 3 cookies encontradas
[COOKIE_DEBUG] 🔑 Cookies de sesión encontradas: sessionId, authToken
[COOKIE_DEBUG] ✅ Sesión de PayPhone preparada
```

### 🚨 **Problema Identificado**

```
[COOKIE_DEBUG] ❌ No hay cookies para pay.payphonetodoesposible.com - POSIBLE CAUSA DEL ERROR
[COOKIE_DEBUG] 📭 No hay cookies guardadas en AsyncStorage
[COOKIE_DEBUG] 🔒 Error "no autorizado" detectado - PROBLEMA DE COOKIES
```

### 🔍 **Análisis de URL**

```
[COOKIE_DEBUG] 🔍 Analizando URL de PayPhone: https://pay.payphonetodoesposible.com/error?msg=unauthorized
[COOKIE_DEBUG] 📍 Path analizado: /error?msg=unauthorized
[COOKIE_DEBUG] 🚨 URL completa del error: https://pay.payphonetodoesposible.com/error?msg=unauthorized
```

---

## 🎯 **POSIBLES CAUSAS Y SOLUCIONES**

### Causa 1: No hay cookies iniciales

**Síntoma**: `❌ No hay cookies para pay.payphonetodoesposible.com`
**Solución**: Implementar pre-autenticación

```typescript
// Agregar al código
const preAuthPayPhone = async () => {
  try {
    await fetch("https://pay.payphonetodoesposible.com/", {
      method: "GET",
      credentials: "include",
      headers: { "User-Agent": UA },
    });
  } catch (error) {
    logCookieInfo("Error en pre-auth:", error);
  }
};
```

### Causa 2: Cookies expiradas

**Síntoma**: `🔑 Cookies de sesión encontradas` pero error persiste
**Solución**: Limpiar cookies corruptas

```typescript
// Ya implementado en cleanupPayPhoneSession(true)
await clearDomainCookies("pay.payphonetodoesposible.com", true);
```

### Causa 3: Problema de User Agent

**Síntoma**: Error de dominio en logs
**Solución**: Verificar User Agent actualizado (ya implementado)

### Causa 4: Configuración SSL

**Síntoma**: Errores de certificado
**Solución**: Verificar network_security_config.xml (ya implementado)

---

## 📊 **PLAN DE ACCIÓN BASADO EN LOGS**

### Escenario A: Sin cookies

```
❌ No hay cookies para pay.payphonetodoesposible.com
```

**Acción**: Implementar pre-autenticación antes de abrir PayPhone

### Escenario B: Cookies inválidas

```
🍪 pay.payphonetodoesposible.com: 2 cookies encontradas
🔒 Error "no autorizado" detectado
```

**Acción**: Limpiar cookies y reintentar

### Escenario C: Problema de red

```
❌ Error en diagnóstico: Network request failed
```

**Acción**: Verificar conectividad y SSL

---

## 🔧 **COMANDOS DE DEBUGGING**

### Ver logs específicos de cookies

```bash
adb logcat | grep "COOKIE_DEBUG.*🔒\|COOKIE_DEBUG.*❌\|COOKIE_DEBUG.*🚨"
```

### Ver solo errores críticos

```bash
adb logcat | grep -E "(COOKIE_DEBUG.*Error|COOKIE_DEBUG.*no autorizado)"
```

### Limpiar y reiniciar logs

```bash
adb logcat -c && adb logcat | grep COOKIE_DEBUG
```

---

## 📈 **MÉTRICAS DE ÉXITO**

### Antes (Sin debugging)

- ❌ Error "no autorizado" frecuente
- ❌ Causa desconocida
- ❌ Solución por prueba y error

### Después (Con debugging)

- ✅ Identificación precisa del problema
- ✅ Logs detallados del flujo completo
- ✅ Diagnóstico automático
- ✅ Solución dirigida basada en evidencia

---

## 🎊 **PRÓXIMOS PASOS**

1. **Generar APK** con sistema de debugging

   ```bash
   eas build -p android --profile apk-test
   ```

2. **Ejecutar debugging** y capturar logs

   ```bash
   ./debug-payphone.sh
   ```

3. **Analizar logs** para identificar causa específica

4. **Implementar solución** basada en los hallazgos

5. **Re-testing** para confirmar fix

6. **Deploy** de la solución final

---

## 📞 **SOPORTE**

Si encuentras logs que no están documentados aquí:

1. **Captura el log completo** desde que abres PayPhone hasta el error
2. **Identifica el patrón** específico del error
3. **Busca en los logs** las líneas con 🚨, ❌, o 🔒
4. **Implementa la solución** correspondiente al patrón identificado

**¡Con este sistema deberías poder identificar y solucionar el problema "no autorizado" de PayPhone!** 🚀
