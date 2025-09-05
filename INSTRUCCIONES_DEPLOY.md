# 🚀 Instrucciones de Deploy - KeApp v1.0.9

## ✅ Estado Actual

- **Versión**: 1.0.9
- **Version Code**: 15
- **Estado**: ✅ LISTO PARA PRODUCCIÓN

## 🔧 Mejoras Implementadas

### Problemas Solucionados:

1. ✅ **Pantalla negra al minimizar** - Sistema de manejo de AppState mejorado
2. ✅ **Problemas con Google Auth** - Configuración SSL y User Agent optimizados
3. ✅ **Errores SSL** - Trust anchors y certificados configurados correctamente
4. ✅ **Funcionalidad general** - Sistema robusto de manejo de errores

## 📋 Verificaciones Pre-Deploy

Ejecuta el script de verificación antes del deploy:

```bash
node scripts/pre-build-check.js
```

**Resultado esperado**: ✅ TODAS LAS VERIFICACIONES PASARON

## 🏗️ Comandos de Build

### Opción 1: Script Automatizado (Recomendado)

```bash
./scripts/build-production.sh
```

### Opción 2: Comandos Manuales

```bash
# 1. Limpiar e instalar dependencias
npm cache clean --force
npm install
npx expo install --fix

# 2. Build de producción
npx eas build -p android --profile production

# 3. Submit a Google Play (después de probar)
npx eas submit -p android --profile production
```

## 📱 Proceso de Deploy Completo

### 1. Pre-Deploy

- [x] Verificaciones pasadas
- [x] Versiones sincronizadas
- [x] Certificados SSL configurados
- [x] Configuración de red actualizada

### 2. Build

```bash
# Ejecutar build automatizado
./scripts/build-production.sh
```

### 3. Testing

- [ ] Descargar APK desde EAS Dashboard
- [ ] Probar en dispositivos reales
- [ ] Verificar Google Auth funciona
- [ ] Verificar PayPhone funciona
- [ ] Probar minimizar/maximizar app
- [ ] Verificar SSL sin errores

### 4. Deploy a Google Play

```bash
# Solo después de testing exitoso
npx eas submit -p android --profile production
```

## 🔗 Enlaces Importantes

- **EAS Dashboard**: https://expo.dev/accounts/wm-notificaciones/projects/keapp/builds
- **Google Play Console**: https://play.google.com/console
- **Kestore Website**: https://www.kestore.com.ec

## 📊 Información Técnica

### Configuración de Producción

- **Package ID**: com.ke.ecuadorv2
- **Target SDK**: 34
- **Min SDK**: 23
- **Build Tools**: EAS Build
- **Signing**: Automático con EAS

### Certificados SSL

- **Sectigo R46**: ✅ Configurado
- **Network Security Config**: ✅ Actualizado
- **Trust Anchors**: ✅ Para Kestore, PayPhone, Google

### User Agent

```
Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.135 Mobile Safari/537.36 KeApp/1.0.9
```

## ⚠️ Notas Importantes

1. **Claves de Producción**: Todas las claves están configuradas correctamente en EAS
2. **Google Play**: La app ya está en producción, este es un update
3. **Testing**: SIEMPRE probar en dispositivos reales antes del deploy final
4. **Rollback**: Si hay problemas, se puede hacer rollback a la versión anterior

## 🐛 Troubleshooting

### Si el build falla:

```bash
# Limpiar todo y reintentar
npx expo r -c
npm cache clean --force
rm -rf node_modules
npm install
npx expo install --fix
```

### Si hay errores SSL en testing:

- Verificar que los certificados estén en `/certs/`
- Verificar `network_security_config.xml`
- Verificar que el User Agent esté actualizado

### Si Google Auth no funciona:

- Verificar queries en AndroidManifest.xml
- Verificar configuración de dominios de Google
- Verificar User Agent contiene KeApp/1.0.9

## 📞 Contacto

Si hay problemas durante el deploy, revisar:

1. Logs de EAS Build
2. Logs de la aplicación en dispositivos de prueba
3. Google Play Console para errores de upload

---

**¡La aplicación está lista para producción!** 🎉
