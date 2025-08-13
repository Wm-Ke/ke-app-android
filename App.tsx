// App.tsx — Android only - Optimizado para PayPhone
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BackHandler,
  Linking,
  Platform,
  SafeAreaView,
  Share,
  StatusBar,
  StyleSheet,
  View,
  Alert,
} from "react-native";
import {
  WebView,
  WebViewMessageEvent,
  WebViewNavigation,
} from "react-native-webview";
import CookieManager from "@react-native-cookies/cookies";
import AsyncStorage from "@react-native-async-storage/async-storage";

const IS_ANDROID = Platform.OS === "android";

// ======= Ajustes =======
const HOME_URL = "https://www.kestore.com.ec/";
const ORIGINS = new Set(["kestore.com.ec", "www.kestore.com.ec"]);

const PAY_HOSTS = new Set([
  "pay.payphonetodoesposible.com",
  "payphonetodoesposible.com",
  "www.payphonetodoesposible.com",
]);

const PAY_SUCCESS_KEYS = ["success", "/approved", "resultado=aprobado"];
const PAY_CANCEL_KEYS = ["cancel", "/cancel", "resultado=cancelado"];
const PAY_ERROR_KEYS = ["no autorizado", "unauthorized", "denegado", "/error"];

const UA =
  "Mozilla/5.0 (Linux; Android 10; KestoreApp) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.135 Mobile Safari/537.36 KestoreApp/1.0.8";

// ======= Configuración de logging =======
const DEBUG_COOKIES = true; // Siempre habilitado para debugging
const logCookieInfo = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [COOKIE_DEBUG] ${message}`;
  console.log(logMessage, data || "");

  // También log como warn para que sea más visible
  if (
    message.includes("Error") ||
    message.includes("no autorizado") ||
    message.includes("unauthorized")
  ) {
    console.warn(logMessage, data || "");
  }
};

const isHttp = (u: string) => /^https?:\/\//i.test(u);
const hostOf = (u: string) => {
  try {
    return new URL(u).host.toLowerCase();
  } catch {
    return "";
  }
};
const isKestore = (u: string) => ORIGINS.has(hostOf(u));
const isPayHost = (h: string) => PAY_HOSTS.has(h.toLowerCase());
const looksLikeShareIntent = (u: string) => u.startsWith("share:");
const isSocialScheme = (u: string) =>
  /^(whatsapp|fb|instagram|tiktok|youtube|intent):/i.test(u);

// Debounce sencillo para evitar doble share
let lastShareTs = 0;
const shareDebounced = async (title?: string, url?: string) => {
  const now = Date.now();
  if (now - lastShareTs < 900) return;
  lastShareTs = now;
  const message = url ? `${title ? title + "\n" : ""}${url}` : title || "";
  if (!message) return;
  try {
    await Share.share({ message });
  } catch {}
};

// ======= Manejo mejorado de cookies =======
const PAYPHONE_COOKIE_KEY = "@kestore_payphone_cookies";

// Guardar cookies de PayPhone antes de limpiar
const savePayPhoneCookies = async () => {
  try {
    logCookieInfo("🔄 Iniciando guardado de cookies de PayPhone...");
    const cookies: Record<string, any> = {};
    let totalCookies = 0;

    for (const host of PAY_HOSTS) {
      const url = `https://${host}`;
      logCookieInfo(`📡 Obteniendo cookies de: ${url}`);

      const hostCookies = await CookieManager.get(url);
      const cookieCount = hostCookies ? Object.keys(hostCookies).length : 0;

      if (hostCookies && cookieCount > 0) {
        cookies[host] = hostCookies;
        totalCookies += cookieCount;
        logCookieInfo(
          `💾 Guardando ${cookieCount} cookies para ${host}:`,
          hostCookies
        );
      } else {
        logCookieInfo(`⚠️ No se encontraron cookies para ${host}`);
      }
    }

    if (Object.keys(cookies).length > 0) {
      await AsyncStorage.setItem(PAYPHONE_COOKIE_KEY, JSON.stringify(cookies));
      logCookieInfo(
        `✅ ${totalCookies} cookies de PayPhone guardadas exitosamente`
      );
    } else {
      logCookieInfo("⚠️ No hay cookies de PayPhone para guardar");
    }
  } catch (error) {
    logCookieInfo("❌ Error guardando cookies de PayPhone:", error);
  }
};

// Restaurar cookies de PayPhone
const restorePayPhoneCookies = async () => {
  try {
    const savedCookies = await AsyncStorage.getItem(PAYPHONE_COOKIE_KEY);
    if (savedCookies) {
      const cookies = JSON.parse(savedCookies);
      for (const [host, hostCookies] of Object.entries(cookies)) {
        const url = `https://${host}`;
        for (const [name, cookie] of Object.entries(
          hostCookies as Record<string, any>
        )) {
          try {
            await CookieManager.set(url, {
              name,
              value: cookie.value,
              domain: cookie.domain || host,
              path: cookie.path || "/",
              secure: true,
              httpOnly: cookie.httpOnly || false,
            });
          } catch (cookieError) {
            logCookieInfo(`Error restaurando cookie ${name}:`, cookieError);
          }
        }
        logCookieInfo(`Cookies restauradas para ${host}`);
      }
      await CookieManager.flush();
    }
  } catch (error) {
    logCookieInfo("Error restaurando cookies de PayPhone:", error);
  }
};

// Limpieza selectiva de cookies (solo cuando es necesario)
const clearDomainCookies = async (domain: string, force = false) => {
  try {
    if (!force) {
      logCookieInfo(
        `Saltando limpieza de cookies para ${domain} (conservando sesión)`
      );
      return;
    }

    const base = `https://${domain}`;
    logCookieInfo(`Limpiando cookies para ${domain}`);

    const anyCM: any = CookieManager as any;
    if (
      typeof CookieManager.get === "function" &&
      typeof anyCM.remove === "function"
    ) {
      const cookies = await CookieManager.get(base);
      for (const name of Object.keys(cookies || {})) {
        try {
          await anyCM.remove(base, name);
        } catch (error) {
          logCookieInfo(`Error removiendo cookie ${name}:`, error);
        }
      }
      if (typeof CookieManager.flush === "function")
        await CookieManager.flush();
      return;
    }

    // Fallback: clearAll (solo si es forzado)
    if (typeof CookieManager.clearAll === "function") {
      await CookieManager.clearAll(true);
      if (typeof CookieManager.flush === "function")
        await CookieManager.flush();
    }
  } catch (error) {
    logCookieInfo(`Error limpiando cookies de ${domain}:`, error);
  }
};

export default function App() {
  const webRef = useRef<WebView>(null);
  const payRef = useRef<WebView>(null);

  const [mainUrl, setMainUrl] = useState(HOME_URL);
  const [payVisible, setPayVisible] = useState(false);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [isPaymentInProgress, setIsPaymentInProgress] = useState(false);

  const topInset = useMemo(
    () => (IS_ANDROID ? (StatusBar.currentHeight ?? 24) : 0),
    []
  );

  const injectedMain = useMemo(
    () => `
      (function(){
        try{
          // Configuración de viewport
          var m=document.querySelector('meta[name=viewport]');
          if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}
          m.content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no';
          var s=document.createElement('style');s.innerHTML='html{-webkit-text-size-adjust:100% !important;}';document.head.appendChild(s);
          
          // Configuración de cookies para terceros
          if (document.cookie) {
            document.cookie.split(';').forEach(function(cookie) {
              var eqPos = cookie.indexOf('=');
              var name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
              if (name) {
                document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.' + window.location.hostname + '; SameSite=None; Secure';
              }
            });
          }
        }catch(e){
          console.log('Error en configuración inicial:', e);
        }
        
        // Override del navigator.share
        var origShare=navigator.share;
        navigator.share=function(data){
          try{
            var title=(data&&data.title)||'';
            var url=(data&&data.url)||'';
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage('RN_SHARE|'+encodeURIComponent(title)+'|'+encodeURIComponent(url));
            return Promise.resolve();
          }catch(e){return Promise.reject(e);}
        };
        
        // Notificar que la página está lista
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage('PAGE_READY');
      })(); true;
    `,
    []
  );

  const injectedPay = useMemo(
    () => `
      (function(){
        try{
          // Configuración de viewport para PayPhone
          var m=document.querySelector('meta[name=viewport]');
          if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}
          m.content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no';
          var s=document.createElement('style');s.innerHTML='html{-webkit-text-size-adjust:100% !important;}';document.head.appendChild(s);
          
          // Configuración específica para PayPhone
          // Asegurar que las cookies se manejen correctamente
          if (typeof Storage !== 'undefined') {
            // Preservar sessionStorage y localStorage para PayPhone
            window.addEventListener('beforeunload', function() {
              // Mantener datos de sesión
            });
          }
          
          // Notificar estado de PayPhone
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage('PAYPHONE_READY');
          
        }catch(e){
          console.log('Error en configuración PayPhone:', e);
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage('PAYPHONE_ERROR|' + e.message);
        }
      })(); true;
    `,
    []
  );

  // Diagnóstico específico para el error "no autorizado"
  const diagnosePayPhoneIssue = useCallback(async () => {
    logCookieInfo("🔬 Iniciando diagnóstico de PayPhone...");

    try {
      // 1. Verificar cookies existentes
      for (const host of PAY_HOSTS) {
        const url = `https://${host}`;
        const cookies = await CookieManager.get(url);
        const cookieCount = cookies ? Object.keys(cookies).length : 0;

        if (cookieCount > 0) {
          logCookieInfo(
            `🍪 ${host}: ${cookieCount} cookies encontradas`,
            cookies
          );

          // Verificar si hay cookies de sesión específicas
          const sessionCookies = Object.keys(cookies).filter(
            (name) =>
              name.toLowerCase().includes("session") ||
              name.toLowerCase().includes("auth") ||
              name.toLowerCase().includes("token")
          );

          if (sessionCookies.length > 0) {
            logCookieInfo(
              `🔑 Cookies de sesión encontradas: ${sessionCookies.join(", ")}`
            );
          } else {
            logCookieInfo(
              `⚠️ No se encontraron cookies de sesión para ${host}`
            );
          }
        } else {
          logCookieInfo(
            `❌ No hay cookies para ${host} - POSIBLE CAUSA DEL ERROR`
          );
        }
      }

      // 2. Verificar AsyncStorage
      const savedCookies = await AsyncStorage.getItem(PAYPHONE_COOKIE_KEY);
      if (savedCookies) {
        const parsed = JSON.parse(savedCookies);
        logCookieInfo("💾 Cookies guardadas en AsyncStorage:", parsed);
      } else {
        logCookieInfo("📭 No hay cookies guardadas en AsyncStorage");
      }
    } catch (error) {
      logCookieInfo("❌ Error en diagnóstico:", error);
    }
  }, []);

  // Solución robusta para el error "no autorizado"
  const preparePayPhoneRobust = useCallback(async () => {
    logCookieInfo("🚀 Preparación robusta de PayPhone iniciada...");

    try {
      // 1. Limpiar cookies potencialmente corruptas
      logCookieInfo("🧹 Limpiando cookies potencialmente corruptas...");
      await clearDomainCookies("pay.payphonetodoesposible.com", true);
      await clearDomainCookies("payphonetodoesposible.com", true);
      await AsyncStorage.removeItem(PAYPHONE_COOKIE_KEY);

      // 2. Pre-autenticación para establecer cookies válidas
      logCookieInfo("🔐 Iniciando pre-autenticación con PayPhone...");

      try {
        const response = await fetch("https://pay.payphonetodoesposible.com/", {
          method: "GET",
          credentials: "include",
          headers: {
            "User-Agent": UA,
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        });

        if (response.ok) {
          logCookieInfo("✅ Pre-autenticación exitosa");

          // Verificar que se establecieron cookies
          const newCookies = await CookieManager.get(
            "https://pay.payphonetodoesposible.com"
          );
          const cookieCount = newCookies ? Object.keys(newCookies).length : 0;

          if (cookieCount > 0) {
            logCookieInfo(
              `🍪 ${cookieCount} cookies establecidas después de pre-auth:`,
              newCookies
            );

            // Guardar las nuevas cookies
            await savePayPhoneCookies();
          } else {
            logCookieInfo("⚠️ No se establecieron cookies después de pre-auth");
          }
        } else {
          logCookieInfo(
            `⚠️ Pre-autenticación falló: ${response.status} ${response.statusText}`
          );
        }
      } catch (fetchError) {
        logCookieInfo("❌ Error en pre-autenticación:", fetchError);
        // Continuar de todos modos, tal vez PayPhone funcione sin pre-auth
      }

      // 3. Pequeña pausa para asegurar que las cookies se establezcan
      await new Promise((resolve) => setTimeout(resolve, 1000));

      logCookieInfo("🎯 Preparación robusta completada");
    } catch (error) {
      logCookieInfo("❌ Error en preparación robusta:", error);
    }
  }, []);

  // Solución específica para Android WebView
  const preparePayPhoneForAndroid = useCallback(async () => {
    logCookieInfo("🤖 Preparación específica para Android WebView iniciada...");

    try {
      // 1. Limpiar estado anterior completamente
      logCookieInfo("🧹 Limpieza completa del estado anterior...");
      await clearDomainCookies("pay.payphonetodoesposible.com", true);
      await clearDomainCookies("payphonetodoesposible.com", true);
      await clearDomainCookies("www.payphonetodoesposible.com", true);
      await AsyncStorage.removeItem(PAYPHONE_COOKIE_KEY);

      // 2. Simular comportamiento de navegador web completo
      logCookieInfo("🌐 Simulando comportamiento de navegador web...");

      const browserHeaders = {
        "User-Agent": UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        DNT: "1",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
        Pragma: "no-cache",
      };

      try {
        logCookieInfo("📡 Realizando petición inicial a PayPhone...");
        const response = await fetch("https://pay.payphonetodoesposible.com/", {
          method: "GET",
          credentials: "include",
          headers: browserHeaders,
        });

        logCookieInfo(
          `📊 Respuesta: ${response.status} ${response.statusText}`
        );

        if (response.ok) {
          // Verificar cookies obtenidas
          const cookies = await CookieManager.get(
            "https://pay.payphonetodoesposible.com"
          );
          const cookieCount = cookies ? Object.keys(cookies).length : 0;

          if (cookieCount > 0) {
            logCookieInfo(
              `✅ ${cookieCount} cookies obtenidas automáticamente:`,
              cookies
            );
            await savePayPhoneCookies();
          } else {
            logCookieInfo(
              "⚠️ No se obtuvieron cookies automáticamente, estableciendo manualmente..."
            );

            // Establecer cookies básicas que PayPhone necesita
            const essentialCookies = [
              {
                name: "PHPSESSID",
                value: `android_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                domain: "pay.payphonetodoesposible.com",
                path: "/",
                httpOnly: false,
                secure: true,
              },
              {
                name: "device_info",
                value: "mobile_android",
                domain: "pay.payphonetodoesposible.com",
                path: "/",
                httpOnly: false,
                secure: true,
              },
              {
                name: "user_agent_hash",
                value: btoa(UA).substr(0, 16),
                domain: "pay.payphonetodoesposible.com",
                path: "/",
                httpOnly: false,
                secure: true,
              },
            ];

            for (const cookie of essentialCookies) {
              try {
                await CookieManager.set(
                  "https://pay.payphonetodoesposible.com",
                  {
                    name: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain,
                    path: cookie.path,
                    version: "1",
                    expires: new Date(
                      Date.now() + 24 * 60 * 60 * 1000
                    ).toUTCString(),
                  }
                );
                logCookieInfo(`🍪 Cookie esencial establecida: ${cookie.name}`);
              } catch (cookieError) {
                logCookieInfo(
                  `❌ Error estableciendo ${cookie.name}:`,
                  cookieError
                );
              }
            }
          }
        } else {
          logCookieInfo(
            `⚠️ Respuesta no exitosa: ${response.status} - ${response.statusText}`
          );
        }
      } catch (fetchError) {
        logCookieInfo("❌ Error en petición inicial:", fetchError);
      }

      // 3. Pausa para sincronización
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 4. Verificación final y guardado
      const finalCookies = await CookieManager.get(
        "https://pay.payphonetodoesposible.com"
      );
      const finalCount = finalCookies ? Object.keys(finalCookies).length : 0;

      if (finalCount > 0) {
        logCookieInfo(
          `🎯 Android WebView preparado con ${finalCount} cookies:`,
          finalCookies
        );
        await savePayPhoneCookies();
      } else {
        logCookieInfo(
          "⚠️ No se pudieron establecer cookies - PayPhone podría fallar"
        );
      }
    } catch (error) {
      logCookieInfo("❌ Error crítico en preparación Android:", error);
    }
  }, []);

  // Manejo mejorado de cookies para PayPhone
  const preparePayPhoneSession = useCallback(async () => {
    try {
      logCookieInfo("🚀 Preparando sesión de PayPhone para Android...");

      // Usar preparación específica para Android WebView
      await preparePayPhoneForAndroid();

      // Hacer diagnóstico después de la preparación
      await diagnosePayPhoneIssue();

      // Restaurar cookies guardadas si existen (después de la preparación Android)
      await restorePayPhoneCookies();

      setIsPaymentInProgress(true);
      logCookieInfo(
        "✅ Sesión de PayPhone preparada específicamente para Android"
      );
    } catch (error) {
      logCookieInfo("❌ Error preparando sesión PayPhone:", error);
    }
  }, [preparePayPhoneForAndroid, diagnosePayPhoneIssue]);

  const cleanupPayPhoneSession = useCallback(async (force = false) => {
    try {
      logCookieInfo("Limpiando sesión de PayPhone...", { force });
      if (force) {
        // Solo limpiar si es forzado (error o cancelación)
        await clearDomainCookies("pay.payphonetodoesposible.com", true);
        await clearDomainCookies("payphonetodoesposible.com", true);
        await AsyncStorage.removeItem(PAYPHONE_COOKIE_KEY);
      }
      await CookieManager.flush();
      setIsPaymentInProgress(false);
    } catch (error) {
      logCookieInfo("Error limpiando sesión PayPhone:", error);
    }
  }, []);

  const gotoHomeWithTag = useCallback(
    (tag: string) => {
      const target = `${HOME_URL}#${tag}`;
      logCookieInfo(`Regresando a home con tag: ${tag}`);

      // Guardar cookies antes de cerrar PayPhone si el pago fue exitoso
      if (tag.includes("success")) {
        savePayPhoneCookies();
      }

      setPayVisible(false);
      setPayUrl(null);

      // Solo limpiar si hay error o cancelación
      const shouldForceClean =
        tag.includes("cancel") ||
        tag.includes("expired") ||
        tag.includes("error");
      cleanupPayPhoneSession(shouldForceClean);

      setTimeout(() => setMainUrl(target), 100);
    },
    [cleanupPayPhoneSession]
  );

  const handlePayOutcomeByUrl = useCallback(
    (url: string) => {
      logCookieInfo(`🔍 Analizando URL de PayPhone: ${url}`);

      let u: URL | null = null;
      try {
        u = new URL(url);
      } catch (error) {
        logCookieInfo(`❌ Error parseando URL: ${url}`, error);
        return false;
      }

      const path = (u?.pathname || "") + (u?.search || "") + (u?.hash || "");
      const p = path.toLowerCase();

      logCookieInfo(`📍 Path analizado: ${path}`);
      logCookieInfo(
        `🔍 Host: ${u.host}, Path: ${u.pathname}, Search: ${u.search}`
      );

      // Verificar éxito
      const successKey = PAY_SUCCESS_KEYS.find((k) => p.includes(k));
      if (successKey) {
        logCookieInfo(`✅ Pago exitoso detectado con clave: ${successKey}`);
        gotoHomeWithTag("pay=success");
        return true;
      }

      // Verificar cancelación
      const cancelKey = PAY_CANCEL_KEYS.find((k) => p.includes(k));
      if (cancelKey) {
        logCookieInfo(`❌ Pago cancelado detectado con clave: ${cancelKey}`);
        gotoHomeWithTag("pay=cancel");
        return true;
      }

      // Verificar errores específicos
      const errorKey = PAY_ERROR_KEYS.find((k) => p.includes(k));
      const isExpired = /\/home\/expired/.test(p) || /\/expired/.test(p);
      const isUnauthorized = /unauthorized|no%20autorizado/.test(p);

      if (errorKey || isExpired || isUnauthorized) {
        if (errorKey)
          logCookieInfo(`🚨 Error detectado con clave: ${errorKey}`);
        if (isExpired) logCookieInfo(`⏰ Sesión expirada detectada`);
        if (isUnauthorized)
          logCookieInfo(
            `🔒 Error "no autorizado" detectado - PROBLEMA DE COOKIES`
          );

        logCookieInfo(`🚨 URL completa del error: ${url}`);
        gotoHomeWithTag("pay=expired");
        return true;
      }

      logCookieInfo(`⚠️ URL sin patrón reconocido, continuando navegación`);
      return false;
    },
    [gotoHomeWithTag]
  );

  const openExternal = useCallback(async (url: string) => {
    try {
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    } catch {}
  }, []);

  const onShouldStart = useCallback(
    (req: any) => {
      const { url, navigationType } = req as {
        url: string;
        navigationType?: string;
      };
      const host = hostOf(url);

      logCookieInfo(`onShouldStart: ${url}`, { navigationType, host });

      if (!isHttp(url) && !isSocialScheme(url)) return false;

      if (isSocialScheme(url)) {
        openExternal(url);
        return false;
      }

      if (isPayHost(host)) {
        logCookieInfo("Detectado host de PayPhone, preparando sesión...");
        preparePayPhoneSession();
        setPayUrl(url);
        setPayVisible(true);
        return false;
      }

      if (looksLikeShareIntent(url)) {
        try {
          const decoded = decodeURIComponent(url.replace(/^share:/i, ""));
          shareDebounced(undefined, decoded);
        } catch (error) {
          logCookieInfo("Error en share intent:", error);
        }
        return false;
      }

      if (isKestore(url)) return true;

      if (navigationType === "click") {
        openExternal(url);
        return false;
      }

      return true;
    },
    [openExternal, preparePayPhoneSession]
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (payVisible) {
        logCookieInfo("Back button presionado en PayPhone, cancelando pago...");
        setPayVisible(false);
        setPayUrl(null);
        // Limpiar cookies al cancelar manualmente
        cleanupPayPhoneSession(true);
        return true;
      }
      try {
        webRef.current?.injectJavaScript("history.back(); true;");
        return true;
      } catch (error) {
        logCookieInfo("Error en back navigation:", error);
        return false;
      }
    });
    return () => sub.remove();
  }, [payVisible, cleanupPayPhoneSession]);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    const data = String(event?.nativeEvent?.data || "");
    logCookieInfo("Mensaje recibido del WebView:", data);

    if (data.startsWith("RN_SHARE|")) {
      const parts = data.split("|");
      const title = decodeURIComponent(parts[1] || "");
      const url = decodeURIComponent(parts[2] || "");
      shareDebounced(title, url);
    } else if (data === "PAGE_READY") {
      logCookieInfo("Página principal lista");
    } else if (data === "PAYPHONE_READY") {
      logCookieInfo("PayPhone WebView listo");
    } else if (data.startsWith("PAYPHONE_ERROR|")) {
      const error = data.replace("PAYPHONE_ERROR|", "");
      logCookieInfo("Error en PayPhone:", error);
      if (__DEV__) {
        Alert.alert("Error PayPhone", error);
      }
    }
  }, []);

  const onPayNavChange = useCallback(
    (nav: WebViewNavigation) => {
      const url = String(nav?.url || "");
      logCookieInfo("PayPhone navegación cambió:", {
        url,
        canGoBack: nav.canGoBack,
        loading: nav.loading,
      });
      if (url) {
        handlePayOutcomeByUrl(url);
      }
    },
    [handlePayOutcomeByUrl]
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: topInset }]}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      {/* WEBVIEW PRINCIPAL */}
      <WebView
        ref={webRef}
        source={{ uri: mainUrl }}
        userAgent={UA}
        originWhitelist={["*"]}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        cacheEnabled={true}
        allowFileAccess={false}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        setSupportMultipleWindows={false}
        textZoom={100}
        mixedContentMode="compatibility"
        allowsProtectedMedia={true}
        injectedJavaScript={injectedMain}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStart}
        onNavigationStateChange={(nav) => {
          const url = String(nav?.url || "");
          logCookieInfo("Main WebView navegación:", {
            url,
            loading: nav.loading,
          });
          if (url && isPayHost(hostOf(url))) {
            logCookieInfo(
              "Detectado PayPhone en main WebView, redirigiendo..."
            );
            preparePayPhoneSession();
            setPayUrl(url);
            setPayVisible(true);
          }
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          logCookieInfo("Error en main WebView:", nativeEvent);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          logCookieInfo("HTTP Error en main WebView:", nativeEvent);
        }}
        startInLoadingState={true}
        style={styles.web}
      />

      {/* MODAL PayPhone */}
      {payVisible && (
        <View style={styles.modal}>
          <WebView
            ref={payRef}
            source={{ uri: payUrl || "about:blank" }}
            userAgent={UA}
            originWhitelist={["*"]}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            cacheEnabled={true} // Habilitado para simular navegador web
            allowFileAccess={false}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            thirdPartyCookiesEnabled={true}
            sharedCookiesEnabled={true}
            setBuiltInZoomControls={false}
            setDisplayZoomControls={false}
            setSupportMultipleWindows={false}
            textZoom={100}
            mixedContentMode="compatibility"
            allowsProtectedMedia={true}
            // Configuraciones específicas para Android WebView como navegador
            incognito={false} // Importante: mantener cookies
            allowsBackForwardNavigationGestures={true}
            bounces={false}
            overScrollMode="never"
            scrollEnabled={true}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            // Configuraciones adicionales para compatibilidad con PayPhone
            androidLayerType="hardware"
            injectedJavaScript={injectedPay}
            onNavigationStateChange={onPayNavChange}
            onShouldStartLoadWithRequest={(req: any) => {
              const { url } = req;
              const host = hostOf(url);

              logCookieInfo("PayPhone onShouldStart:", { url, host });

              if (isSocialScheme(url)) {
                openExternal(url);
                return false;
              }

              if (isPayHost(host)) {
                // Permitir navegación dentro de PayPhone
                return true;
              }

              // Salir del dominio de PayPhone → regresar al principal
              if (!isPayHost(host)) {
                logCookieInfo("Saliendo de PayPhone hacia:", url);
                setPayVisible(false);
                setPayUrl(null);
                cleanupPayPhoneSession(false); // No forzar limpieza
                setMainUrl(url);
                return false;
              }

              return true;
            }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              logCookieInfo("Error en PayPhone WebView:", nativeEvent);
              if (__DEV__) {
                Alert.alert(
                  "Error PayPhone",
                  `Error de conexión: ${nativeEvent.description}`
                );
              }
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              logCookieInfo("HTTP Error en PayPhone WebView:", nativeEvent);
            }}
            startInLoadingState={true}
            style={styles.web}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  web: { flex: 1, backgroundColor: "#000" },
  modal: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    elevation: 8,
  },
});
