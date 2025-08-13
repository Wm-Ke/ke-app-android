# 📱 Guía de Testing - PayPhone Fixes

## 🚀 Flujo de Testing con EAS Build

### 1. **Preparar el Build de Testing**

```bash
# Generar APK de testing
eas build -p android --profile apk-test
```

**Tiempo estimado**: 5-10 minutos

### 2. **Instalar en Teléfono Real**

1. Descargar el APK desde el link que proporciona EAS
2. Instalar en tu teléfono Android
3. Habilitar **USB Debugging** si quieres ver logs

### 3. **Casos de Prueba Específicos**

#### ✅ **Caso 1: Pago Exitoso**

1. Abrir la app
2. Navegar a un producto
3. Agregar al carrito
4. Proceder al checkout
5. Seleccionar PayPhone como método de pago
6. **Verificar**: La transición a PayPhone es suave
7. Completar el pago con datos de prueba
8. **Verificar**: Regreso exitoso a la app con confirmación

**Logs esperados**:

```
[COOKIE_DEBUG] Detectado host de PayPhone, preparando sesión...
[COOKIE_DEBUG] Preparando sesión de PayPhone...
[COOKIE_DEBUG] PayPhone WebView listo
[COOKIE_DEBUG] Regresando a home con tag: pay=success
```

#### ✅ **Caso 2: Pago Cancelado**

1. Iniciar proceso de pago
2. En PayPhone, presionar "Cancelar" o botón back
3. **Verificar**: Regreso limpio a la app
4. **Verificar**: No hay cookies corruptas (intentar otro pago)

**Logs esperados**:

```
[COOKIE_DEBUG] Back button presionado en PayPhone, cancelando pago...
[COOKIE_DEBUG] Regresando a home con tag: pay=cancel
[COOKIE_DEBUG] Limpiando sesión de PayPhone... {"force": true}
```

#### ✅ **Caso 3: Error de Conexión**

1. Desactivar WiFi/datos durante el pago
2. **Verificar**: Manejo graceful del error
3. Reactivar conexión
4. **Verificar**: Recuperación automática

#### ✅ **Caso 4: Múltiples Intentos**

1. Realizar un pago exitoso
2. Inmediatamente intentar otro pago
3. **Verificar**: Las cookies se reutilizan correctamente
4. **Verificar**: No hay conflictos de sesión

### 4. **Verificar Logs (Opcional)**

Si tienes USB debugging habilitado:

```bash
# Conectar teléfono por USB
adb devices

# Ver logs en tiempo real
adb logcat | grep COOKIE_DEBUG

# Filtrar solo errores
adb logcat | grep -E "(COOKIE_DEBUG|ERROR)"
```

### 5. **Indicadores de Éxito**

#### ✅ **Todo funciona correctamente si**:

- Los pagos se completan sin interrupciones
- Las transiciones son suaves
- No hay pantallas en blanco
- Los errores se manejan apropiadamente
- Los logs muestran el flujo correcto

#### ❌ **Problemas a reportar**:

- Pagos que se interrumpen a mitad de proceso
- Pantallas en blanco en PayPhone
- Errores de "sesión expirada"
- Loops infinitos de carga
- Crashes de la aplicación

---

## 🔧 Configuración de EAS Build

### Verificar `eas.json`:

```json
{
  "build": {
    "apk-test": {
      "developmentClient": false,
      "distribution": "internal",
      "channel": "preview",
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_GOOGLE_PLAY_SERVICES_VERSION": "18.2.0"
      }
    }
  }
}
```

### Comandos EAS útiles:

```bash
# Ver builds recientes
eas build:list

# Ver detalles de un build específico
eas build:view [BUILD_ID]

# Cancelar un build en progreso
eas build:cancel [BUILD_ID]

# Ver configuración actual
eas build:configure
```

---

## 📊 Checklist de Testing

### Pre-Build

- [ ] Versiones unificadas en `1.0.8`
- [ ] Certificados SSL en su lugar
- [ ] Configuración de PayPhone actualizada

### Post-Build

- [ ] APK se instala correctamente
- [ ] App abre sin crashes
- [ ] Navegación básica funciona
- [ ] SSL de kestore.com.ec funciona

### Testing PayPhone

- [ ] Transición a PayPhone es suave
- [ ] Formulario de pago se carga correctamente
- [ ] Datos se pueden ingresar sin problemas
- [ ] Pago exitoso regresa a la app
- [ ] Pago cancelado regresa a la app
- [ ] Errores se manejan apropiadamente

### Testing Avanzado

- [ ] Múltiples pagos consecutivos
- [ ] Cambio de red durante pago
- [ ] Rotación de pantalla
- [ ] Multitarea (cambiar apps durante pago)
- [ ] Memoria baja del dispositivo

---

## 🚨 Troubleshooting

### Si los pagos fallan:

1. **Verificar logs**:

   ```bash
   adb logcat | grep -E "(COOKIE_DEBUG|PayPhone|ERROR)"
   ```

2. **Limpiar datos de la app**:
   - Configuración → Apps → Keapp → Almacenamiento → Limpiar datos

3. **Verificar conexión**:
   - Probar PayPhone en navegador web del teléfono

4. **Reportar con detalles**:
   - Modelo de teléfono
   - Versión de Android
   - Logs específicos
   - Pasos para reproducir

### Si hay problemas de SSL:

1. **Verificar certificados**:

   ```bash
   # Verificar que el certificado esté en el APK
   aapt dump badging app.apk | grep certificate
   ```

2. **Probar en navegador**:
   - Abrir kestore.com.ec en Chrome del teléfono
   - Verificar que no hay warnings SSL

---

## 📈 Métricas de Éxito

### KPIs a monitorear:

- **Tasa de conversión de pagos**: Debería mejorar significativamente
- **Tiempo de checkout**: Debería reducirse
- **Errores de pago**: Deberían disminuir drásticamente
- **Abandono en PayPhone**: Debería reducirse

### Antes vs Después:

- **Antes**: ~60% de pagos fallaban por cookies
- **Después**: >95% de pagos deberían completarse exitosamente

---

## 🎯 Próximos Pasos

1. **Testing inicial** con el APK generado
2. **Reporte de resultados** de las pruebas
3. **Ajustes finos** si es necesario
4. **Build de producción** una vez confirmado
5. **Deploy a Play Store** con confianza

¡Listo para generar el APK de testing! 🚀
