# 🔍 Debugging Simple - Sin ADB

## 🚨 **PROBLEMA: Error "No Autorizado" en PayPhone**

Como no tienes ADB instalado, vamos a usar métodos alternativos para hacer debugging.

---

## 🛠️ **MÉTODOS DE DEBUGGING DISPONIBLES**

### Método 1: React Native CLI (Recomendado)

```bash
# Si tienes React Native CLI
npx react-native log-android
```

### Método 2: Expo CLI

```bash
# Con Expo CLI
npx expo logs --platform android
```

### Método 3: Flipper (Si está instalado)

- Abre Flipper
- Conecta tu dispositivo
- Ve a la sección "Logs"

### Método 4: Chrome DevTools

1. Abre Chrome
2. Ve a `chrome://inspect`
3. Busca tu dispositivo
4. Haz clic en "inspect"

---

## 🚀 **PLAN SIMPLIFICADO**

### Paso 1: Generar APK

```bash
eas build -p android --profile apk-test
```

### Paso 2: Instalar y Probar

1. Instalar APK en teléfono
2. Abrir la app
3. Ir a checkout
4. Seleccionar PayPhone
5. **Observar el comportamiento**

### Paso 3: Identificar el Patrón

Sin logs, podemos identificar el problema por el comportamiento:

#### ✅ **Comportamiento Normal**

- PayPhone se abre correctamente
- Formulario de pago aparece
- Se pueden ingresar datos
- Pago se procesa

#### 🚨 **Comportamiento con Error "No Autorizado"**

- PayPhone se abre
- Aparece mensaje "No autorizado" inmediatamente
- O página en blanco
- O redirección inmediata de vuelta a la app

---

## 🎯 **SOLUCIONES BASADAS EN COMPORTAMIENTO**

### Si PayPhone muestra "No autorizado" inmediatamente:

**Causa Probable**: Falta de cookies de sesión
**Solución**: Implementar pre-autenticación

Vamos a agregar esta función al código:

```typescript
// Agregar antes de abrir PayPhone
const preAuthPayPhone = async () => {
  try {
    logCookieInfo("🔄 Intentando pre-autenticación...");

    // Hacer una llamada previa para establecer cookies
    await fetch("https://pay.payphonetodoesposible.com/", {
      method: "GET",
      credentials: "include",
      headers: {
        "User-Agent": UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
    });

    logCookieInfo("✅ Pre-autenticación completada");
  } catch (error) {
    logCookieInfo("❌ Error en pre-autenticación:", error);
  }
};
```

### Si PayPhone se abre pero falla después:

**Causa Probable**: Cookies corruptas
**Solución**: Limpiar cookies antes de cada intento

```typescript
// Limpiar cookies antes de PayPhone
const cleanBeforePayPhone = async () => {
  try {
    await clearDomainCookies("pay.payphonetodoesposible.com", true);
    await clearDomainCookies("payphonetodoesposible.com", true);
    await AsyncStorage.removeItem(PAYPHONE_COOKIE_KEY);
  } catch (error) {
    logCookieInfo("Error limpiando cookies:", error);
  }
};
```

---

## 🔧 **IMPLEMENTACIÓN PASO A PASO**

### Opción A: Pre-autenticación (Para error inmediato)

1. **Agregar función de pre-auth** al código
2. **Llamarla antes de abrir PayPhone**
3. **Probar si resuelve el problema**

### Opción B: Limpieza agresiva (Para cookies corruptas)

1. **Limpiar todas las cookies** antes de PayPhone
2. **Permitir que PayPhone establezca nuevas cookies**
3. **Probar si resuelve el problema**

### Opción C: Combinación (Solución robusta)

1. **Limpiar cookies corruptas**
2. **Hacer pre-autenticación**
3. **Abrir PayPhone con sesión limpia**

---

## 📱 **TESTING SIN LOGS**

### Casos de Prueba:

#### Caso 1: Primera instalación

1. Instalar app limpia
2. Ir directo a PayPhone
3. **¿Se abre correctamente?**

#### Caso 2: Segundo intento

1. Fallar un pago
2. Intentar inmediatamente otro
3. **¿Funciona el segundo intento?**

#### Caso 3: Reiniciar app

1. Cerrar app completamente
2. Abrir de nuevo
3. Intentar PayPhone
4. **¿Funciona después de reiniciar?**

---

## 🎯 **SOLUCIÓN RECOMENDADA**

Basándome en el patrón típico del error "no autorizado", te recomiendo implementar esta solución:

```typescript
// Función completa de preparación
const preparePayPhoneRobust = async () => {
  try {
    logCookieInfo("🚀 Preparación robusta de PayPhone...");

    // 1. Limpiar cookies potencialmente corruptas
    await clearDomainCookies("pay.payphonetodoesposible.com", true);
    await clearDomainCookies("payphonetodoesposible.com", true);

    // 2. Pre-autenticación para establecer cookies válidas
    const response = await fetch("https://pay.payphonetodoesposible.com/", {
      method: "GET",
      credentials: "include",
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-ES,es;q=0.9",
      },
    });

    if (response.ok) {
      logCookieInfo("✅ PayPhone preparado exitosamente");
    } else {
      logCookieInfo("⚠️ Respuesta no OK:", response.status);
    }
  } catch (error) {
    logCookieInfo("❌ Error en preparación:", error);
  }
};
```

---

## 🎊 **PRÓXIMOS PASOS**

1. **Generar APK** con las mejoras actuales
2. **Probar comportamiento** sin logs
3. **Si sigue fallando**, implementar la solución robusta
4. **Re-generar APK** y probar de nuevo
5. **Confirmar que funciona** en múltiples intentos

**¡No necesitas ADB para solucionar este problema! El comportamiento de la app te dirá todo lo que necesitas saber.** 🚀

¿Quieres que implemente la solución robusta directamente en el código?
