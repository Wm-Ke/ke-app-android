// src/utils/AppUtils.ts
// Utilidades para mejorar la funcionalidad de la aplicación

import { Alert, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Constantes para el manejo de errores
export const ERROR_TYPES = {
  SSL_ERROR: "SSL_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  GOOGLE_AUTH_ERROR: "GOOGLE_AUTH_ERROR",
  PAYPHONE_ERROR: "PAYPHONE_ERROR",
} as const;

// Función para detectar errores SSL
export const isSSLError = (errorDescription: string): boolean => {
  const sslKeywords = [
    "SSL",
    "certificate",
    "ERR_CERT",
    "ERR_SSL",
    "CERT_AUTHORITY_INVALID",
    "CERT_DATE_INVALID",
    "CERT_COMMON_NAME_INVALID",
    "NET_ERR_CERT",
  ];

  return sslKeywords.some((keyword) =>
    errorDescription.toLowerCase().includes(keyword.toLowerCase())
  );
};

// Función para detectar errores de red
export const isNetworkError = (errorDescription: string): boolean => {
  const networkKeywords = [
    "ERR_NETWORK",
    "ERR_INTERNET_DISCONNECTED",
    "ERR_NAME_NOT_RESOLVED",
    "ERR_CONNECTION",
    "timeout",
    "unreachable",
  ];

  return networkKeywords.some((keyword) =>
    errorDescription.toLowerCase().includes(keyword.toLowerCase())
  );
};

// Función para manejar errores de Google Auth
export const handleGoogleAuthError = (error: any): void => {
  console.log("Google Auth Error:", error);

  // Intentar abrir Google Chrome si está disponible
  const chromeUrl = "googlechrome://navigate?url=https://accounts.google.com";

  Linking.canOpenURL(chromeUrl)
    .then((supported) => {
      if (supported) {
        return Linking.openURL(chromeUrl);
      } else {
        // Fallback a navegador por defecto
        return Linking.openURL("https://accounts.google.com");
      }
    })
    .catch((err) => {
      console.log("Error opening Google Auth:", err);
    });
};

// Función para limpiar caché de la aplicación
export const clearAppCache = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(
      (key) =>
        key.startsWith("@kestore_") ||
        key.includes("cache") ||
        key.includes("temp")
    );

    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
      console.log("Cache cleared successfully");
    }
  } catch (error) {
    console.log("Error clearing cache:", error);
  }
};

// Función para mostrar alertas de error amigables
export const showUserFriendlyError = (
  errorType: string,
  errorMessage?: string
): void => {
  let title = "Error";
  let message =
    "Ha ocurrido un error inesperado. Por favor, intenta nuevamente.";

  switch (errorType) {
    case ERROR_TYPES.SSL_ERROR:
      title = "Error de Seguridad";
      message =
        "Hay un problema con la conexión segura. La aplicación intentará reconectarse automáticamente.";
      break;

    case ERROR_TYPES.NETWORK_ERROR:
      title = "Sin Conexión";
      message =
        "No se puede conectar a internet. Verifica tu conexión y vuelve a intentar.";
      break;

    case ERROR_TYPES.GOOGLE_AUTH_ERROR:
      title = "Error de Autenticación";
      message =
        "No se pudo iniciar sesión con Google. Verifica tu conexión e intenta nuevamente.";
      break;

    case ERROR_TYPES.PAYPHONE_ERROR:
      title = "Error de Pago";
      message =
        "Hubo un problema con el procesador de pagos. Por favor, intenta nuevamente.";
      break;
  }

  Alert.alert(title, message, [{ text: "OK", style: "default" }]);
};

// Función para validar URLs
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Función para obtener información del dispositivo
export const getDeviceInfo = () => {
  return {
    userAgent:
      "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.135 Mobile Safari/537.36 KeApp/1.0.9",
    platform: "android",
    version: "1.0.9",
  };
};

// Función para logging mejorado
export const logWithContext = (message: string, context?: any): void => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;

  console.log(logMessage, context || "");

  // En producción, podrías enviar logs a un servicio de analytics
  // Analytics.track('app_log', { message, context, timestamp });
};

export default {
  ERROR_TYPES,
  isSSLError,
  isNetworkError,
  handleGoogleAuthError,
  clearAppCache,
  showUserFriendlyError,
  isValidUrl,
  getDeviceInfo,
  logWithContext,
};
