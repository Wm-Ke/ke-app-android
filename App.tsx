// App.tsx — Android
// PayPhone OK + Deep Links sociales + Modo inmersivo (inset) +
// Persistencia de última URL y posición de scroll con LRU (restauración al reabrir)
// Mejoras: Manejo de estado de app, Google Auth, SSL, y estabilidad general

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  BackHandler,
  Linking,
  Platform,
  Share,
  StatusBar,
  StyleSheet,
  View,
  Alert,
  AppStateStatus,
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import CookieManager from "@react-native-cookies/cookies";
import * as NavigationBar from "expo-navigation-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SplashScreen from "expo-splash-screen";
import NetInfo from "@react-native-community/netinfo";
import {
  isSSLError,
  isNetworkError,
  showUserFriendlyError,
  ERROR_TYPES,
  logWithContext,
  clearAppCache,
} from "./src/utils/AppUtils";

const IS_ANDROID = Platform.OS === "android";

// ================= Config =================
const HOME_URL = "https://www.kestore.com.ec/";
const ORIGINS = new Set(["kestore.com.ec", "www.kestore.com.ec"]);
const isPayHost = (h: string) =>
  /(^|\.)payphonetodoesposible\.com$/i.test(h || "");
const PAY_ERR_KEYS = [
  "no autorizado",
  "unauthorized",
  "denegado",
  "/error",
  "/expired",
];

// UA móvil realista - Actualizado para mejor compatibilidad con Google Auth
const UA =
  "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.135 Mobile Safari/537.36 KeApp/1.0.10";

// ================= Persistencia =================
const LAST_URL_KEY = "@kestore_last_url";
const SCROLL_PREFIX = "@kestore_scroll:"; // key por URL canonical
const SCROLL_INDEX_KEY = "@kestore_scroll_index"; // índice LRU
const MAX_SCROLL_ENTRIES = 30; // tope LRU

// ================= Utils ===================
const log = (msg: string, extra?: any) => {
  if (__DEV__) {
    logWithContext(`[APP] ${msg}`, extra);
  } else {
    // En producción, solo log errores críticos
    if (
      msg.toLowerCase().includes("error") ||
      msg.toLowerCase().includes("fail")
    ) {
      logWithContext(`[APP] ${msg}`, extra);
    }
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
const pathOf = (u: string) => {
  try {
    return new URL(u).pathname;
  } catch {
    return "";
  }
};
const isKestore = (u: string) => ORIGINS.has(hostOf(u));
const isSocialScheme = (u: string) =>
  /^(whatsapp|fb|instagram|tiktok|youtube|twitter|x|vnd\.youtube|mailto|tel|intent):/i.test(
    u
  );
const looksLikeShareIntent = (u: string) => u.startsWith("share:");

// share debounce
let lastShareTs = 0;
const shareDebounced = async (title?: string, url?: string) => {
  const now = Date.now();
  if (now - lastShareTs < 800) return;
  lastShareTs = now;
  const message = url ? `${title ? title + "\n" : ""}${url}` : title || "";
  if (!message) return;
  try {
    await Share.share({ message });
  } catch {}
};

// ================= Deep links sociales =================
function mapSocialToApp(
  originalUrl: string
): { appUrls: string[]; packages: string[] } | null {
  if (!isHttp(originalUrl)) return null;
  const url = new URL(originalUrl);
  const host = url.host.toLowerCase();
  const path = url.pathname;
  const q = url.searchParams;

  // WhatsApp
  if (host === "wa.me" || host === "api.whatsapp.com") {
    let phone = "";
    let text = "";
    if (host === "wa.me") {
      const parts = path.split("/").filter(Boolean);
      if (parts[0]) phone = parts[0].replace(/\D/g, "");
      text = q.get("text") || "";
    } else {
      phone = (q.get("phone") || "").replace(/\D/g, "");
      text = q.get("text") || "";
    }
    const app = `whatsapp://send${phone ? `?phone=${phone}` : ""}${
      text ? `${phone ? "&" : "?"}text=${encodeURIComponent(text)}` : ""
    }`;
    return {
      appUrls: [app, "whatsapp://send"],
      packages: ["com.whatsapp", "com.whatsapp.w4b"],
    };
  }

  // Facebook
  if (host.endsWith("facebook.com") || host === "m.facebook.com") {
    const faceModal = `fb://facewebmodal/f?href=${encodeURIComponent(
      originalUrl
    )}`;
    return {
      appUrls: [faceModal, "fb://profile"],
      packages: ["com.facebook.katana"],
    };
  }

  // Instagram
  if (host.endsWith("instagram.com")) {
    const parts = path.split("/").filter(Boolean);
    const username =
      parts[0] && !["p", "reels", "stories", "explore"].includes(parts[0])
        ? parts[0]
        : "";
    const appUrls = username
      ? [
          `instagram://user?username=${username}`,
          `instagram://library`,
          `instagram://app`,
        ]
      : [`instagram://app`];
    return { appUrls, packages: ["com.instagram.android"] };
  }

  // YouTube / youtu.be
  if (host === "youtu.be" || host.endsWith("youtube.com")) {
    let vid = "";
    if (host === "youtu.be") {
      vid = path.split("/").filter(Boolean)[0] || "";
    } else {
      if (path.startsWith("/watch")) vid = q.get("v") || "";
      if (path.startsWith("/shorts/"))
        vid = path.split("/").filter(Boolean)[1] || "";
    }
    const appUrls = vid
      ? [`vnd.youtube:${vid}`, `youtube://www.youtube.com/watch?v=${vid}`]
      : [`youtube://`];
    return { appUrls, packages: ["com.google.android.youtube"] };
  }

  // X / Twitter
  if (
    host.endsWith("twitter.com") ||
    host === "x.com" ||
    host.endsWith(".x.com")
  ) {
    const parts = path.split("/").filter(Boolean);
    let appUrls: string[] = ["twitter://timeline"];
    if (parts.length >= 3 && parts[1].toLowerCase() === "status") {
      const id = parts[2];
      appUrls = [`twitter://status?status_id=${id}`, ...appUrls];
    } else if (parts[0]) {
      const user = parts[0];
      appUrls = [`twitter://user?screen_name=${user}`, ...appUrls];
    }
    return { appUrls, packages: ["com.twitter.android"] };
  }

  // TikTok
  if (host.endsWith("tiktok.com")) {
    const parts = path.split("/").filter(Boolean);
    const hasUser = parts[0]?.startsWith("@");
    const user = hasUser ? parts[0] : "";
    const appUrls = user
      ? [
          `snssdk1128://user/profile/${user}`,
          `tiktok://user/${user}`,
          `tiktok://`,
        ]
      : [`tiktok://`];
    return { appUrls, packages: ["com.zhiliaoapp.musically"] };
  }

  return null;
}

// Abrir app primero; si falla, Play Store; si no, web del store
async function openPreferInstalled(appUrls: string[], packages: string[]) {
  for (const u of appUrls) {
    try {
      await Linking.openURL(u);
      return true;
    } catch {}
  }
  if (packages[0]) {
    const market = `market://details?id=${packages[0]}`;
    try {
      await Linking.openURL(market);
      return true;
    } catch {}
    const web = `https://play.google.com/store/apps/details?id=${packages[0]}`;
    try {
      await Linking.openURL(web);
      return true;
    } catch {}
  }
  Alert.alert("App no instalada", "Instala la aplicación para continuar.");
  return false;
}

// ================= Injects =================
const INJECT_MAIN = `
  (function(){
    try{
      var m=document.querySelector('meta[name=viewport]');
      if(!m){ m=document.createElement('meta');m.name='viewport';document.head.appendChild(m); }
      m.content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no';
      var s=document.createElement('style'); 
      s.innerHTML='html{-webkit-text-size-adjust:100% !important;} body{-webkit-touch-callout:none;-webkit-user-select:none;}'; 
      document.head.appendChild(s);
    }catch(e){}

    // Mejorar compatibilidad con Google Auth
    try{
      // Configurar manejo específico para Google OAuth
      var originalOpen = window.open;
      window.open = function(url, target, features) {
        if (url && (url.includes('accounts.google.com') || url.includes('oauth'))) {
          // Para Google Auth, mantener en la misma ventana pero con mejor manejo
          if (target === '_blank' || target === '_new') {
            // Forzar que se abra en la misma ventana para OAuth
            window.location.href = url;
            return window;
          }
          return originalOpen.call(this, url, '_self', features);
        }
        return originalOpen.call(this, url, target, features);
      };
      
      // Interceptar redirects de Google para evitar que abra YouTube
      var originalAssign = window.location.assign;
      window.location.assign = function(url) {
        if (url && url.includes('youtube.com') && document.referrer.includes('google.com')) {
          // Si viene de Google y va a YouTube, probablemente es un error de redirect
          console.log('Interceptando redirect incorrecto a YouTube desde Google Auth');
          return;
        }
        return originalAssign.call(this, url);
      };
      
      // Mejorar navigator.userAgent para Google Auth
      Object.defineProperty(navigator, 'userAgent', {
        get: function() { return '${UA}'; },
        configurable: true
      });
      
      // Configurar propiedades adicionales para mejor compatibilidad con Google
      Object.defineProperty(navigator, 'platform', {
        get: function() { return 'Linux armv7l'; },
        configurable: true
      });
      
      // Asegurar que Google detecte que es un dispositivo móvil
      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: function() { return 5; },
        configurable: true
      });
    }catch(e){}

    // share → RN
    var origShare = navigator.share;
    navigator.share = function(data){
      try{
        var t=(data&&data.title)||''; var u=(data&&data.url)||'';
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage('RN_SHARE|'+encodeURIComponent(t)+'|'+encodeURIComponent(u));
        return Promise.resolve();
      }catch(e){ return Promise.reject(e); }
    };

    // Notificar URL actual (SPA-friendly) y enviar scroll en onscroll (throttle)
    function post(msg){ try{ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(msg); }catch(e){} }
    function sendURL(){ post('URL|' + encodeURIComponent(location.href)); }
    var last=0;
    function onScroll(){
      var now=Date.now();
      if(now-last<250) return;
      last=now;
      var y = (window.pageYOffset||document.documentElement.scrollTop||document.body.scrollTop||0)|0;
      post('SCROLL|' + encodeURIComponent(location.href) + '|' + y);
    }
    window.addEventListener('scroll', onScroll, {passive:true});
    document.addEventListener('DOMContentLoaded', sendURL);
    window.addEventListener('hashchange', sendURL);
    
    // Manejar visibilidad de la página para evitar pantalla negra
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') {
        post('PAGE_VISIBLE');
      } else {
        post('PAGE_HIDDEN');
      }
    });
    
    // Detectar y manejar Google OAuth
    function handleGoogleOAuth() {
      // Detectar si estamos en una página de Google OAuth
      if (location.hostname.includes('accounts.google.com')) {
        console.log('Google OAuth page detected');
        
        // Mejorar la experiencia de OAuth
        var style = document.createElement('style');
        style.textContent = 'body { -webkit-user-select: text !important; }';
        document.head.appendChild(style);
        
        // Detectar cuando el OAuth se complete exitosamente
        var observer = new MutationObserver(function(mutations) {
          mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
              // Buscar indicadores de OAuth exitoso
              var successElements = document.querySelectorAll('[data-value*="success"], .success, #success');
              if (successElements.length > 0) {
                console.log('Google OAuth success detected');
                post('GOOGLE_OAUTH_SUCCESS');
              }
            }
          });
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
      
      // Detectar si regresamos a Kestore después de OAuth
      if (location.hostname.includes('kestore.com.ec') && document.referrer.includes('google.com')) {
        console.log('Returned to Kestore from Google OAuth');
        post('GOOGLE_OAUTH_RETURN');
      }
    }
    
    // Ejecutar detección de OAuth
    handleGoogleOAuth();
    
    // También ejecutar cuando cambie la URL
    window.addEventListener('hashchange', handleGoogleOAuth);
    window.addEventListener('popstate', handleGoogleOAuth);
    
    // llamadas iniciales
    sendURL();
    post('PAGE_READY');
  })(); true;
`;

const INJECT_PAY = `
  (function(){
    try{
      var m=document.querySelector('meta[name=viewport]');
      if(!m){ m=document.createElement('meta');m.name='viewport';document.head.appendChild(m); }
      m.content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no';
      var s=document.createElement('style'); s.innerHTML='html{-webkit-text-size-adjust:100% !important;}'; document.head.appendChild(s);
    }catch(e){}
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage('PAYPHONE_READY');
  })(); true;
`;

// ================= Cookies PayPhone (limpieza selectiva) =================
async function clearPayCookies() {
  const bases = [
    "https://pay.payphonetodoesposible.com",
    "https://www.payphonetodoesposible.com",
    "https://payphonetodoesposible.com",
  ];
  try {
    for (const base of bases) {
      const cookies = await CookieManager.get(base);
      for (const name of Object.keys(cookies || {})) {
        try {
          await CookieManager.set(base, {
            name,
            value: "",
            path: "/",
            expires: "Thu, 01 Jan 1970 00:00:00 GMT",
          });
        } catch {}
      }
    }
    await CookieManager.flush?.();
    log("Cookies PayPhone limpiadas");
  } catch (e) {
    log("Error limpiando cookies PayPhone", e);
  }
}

// ============== Modo inmersivo (sin superposición) ==============
const ensureImmersive = async () => {
  if (!IS_ANDROID) return;
  try {
    await NavigationBar.setBackgroundColorAsync("transparent");
    await NavigationBar.setButtonStyleAsync("light");
    // Clave: inset-swipe para que Android aplique insets cuando aparece la barra
    await NavigationBar.setBehaviorAsync("inset-swipe");
    await NavigationBar.setVisibilityAsync("hidden");
  } catch {}
};

// ============== Helpers de persistencia de scroll/URL + LRU ==============
const urlKey = (href: string) => {
  try {
    const u = new URL(href);
    // sin hash, con search (para distinguir productos con queries)
    return `${u.origin}${u.pathname}${u.search}`.toLowerCase();
  } catch {
    return href.toLowerCase();
  }
};
const scrollKey = (href: string) => `${SCROLL_PREFIX}${urlKey(href)}`;

async function getScrollIndex(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SCROLL_INDEX_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((x) => typeof x === "string");
    return [];
  } catch {
    return [];
  }
}
async function setScrollIndex(arr: string[]) {
  try {
    await AsyncStorage.setItem(SCROLL_INDEX_KEY, JSON.stringify(arr));
  } catch {}
}

async function removeFromScrollIndex(key: string) {
  const idx = await getScrollIndex();
  const i = idx.indexOf(key);
  if (i >= 0) {
    idx.splice(i, 1);
    await setScrollIndex(idx);
  }
}

async function touchScrollIndex(key: string) {
  let idx = await getScrollIndex();
  const i = idx.indexOf(key);
  if (i >= 0) idx.splice(i, 1);
  idx.unshift(key);
  if (idx.length > MAX_SCROLL_ENTRIES) {
    const toRemove = idx.slice(MAX_SCROLL_ENTRIES);
    idx = idx.slice(0, MAX_SCROLL_ENTRIES);
    try {
      await AsyncStorage.multiRemove(toRemove);
    } catch {}
  }
  await setScrollIndex(idx);
}

async function saveLastUrlIfKestore(href: string) {
  if (href && isHttp(href) && isKestore(href)) {
    await AsyncStorage.setItem(LAST_URL_KEY, href).catch(() => {});
  }
}

async function saveScroll(href: string, y: number) {
  if (!href || !isHttp(href) || !isKestore(href)) return;
  const key = scrollKey(href);
  if (y > 0) {
    await AsyncStorage.setItem(key, String(Math.max(0, y | 0))).catch(() => {});
    await touchScrollIndex(key);
  } else {
    // si vuelve al top, limpiamos la entrada y la sacamos del índice
    await AsyncStorage.removeItem(key).catch(() => {});
    await removeFromScrollIndex(key);
  }
}

// ejecuta varios intentos de scrollTo para asegurar que el DOM ya está listo
function injectScrollTo(webRef: React.RefObject<WebView>, y: number) {
  if (!webRef.current || !(y > 0)) return;
  const js = `
    (function(){
      var y=${y | 0};
      var tries=0;
      var id=setInterval(function(){
        try{ window.scrollTo(0, y); }catch(e){}
        if(++tries>=6){ clearInterval(id); }
      }, 80);
    })(); true;
  `;
  webRef.current.injectJavaScript(js);
}

// =============== App ======================
export default function App() {
  const webRef = useRef<WebView>(null);
  const payRef = useRef<WebView>(null);

  const [mainUrl, setMainUrl] = useState<string | null>(null); // evita flash del home
  const [payVisible, setPayVisible] = useState(false);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState
  );
  const [isAppReady, setIsAppReady] = useState<boolean>(false);

  // última URL real de la principal (para Referer)
  const lastMainUrlRef = useRef<string>(HOME_URL);
  // bypass una vez para permitir que la principal navegue a PayPhone si hace falta
  const bypassNextPayInterceptRef = useRef<boolean>(false);
  const initialPayUrlRef = useRef<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Inicialización de la app y manejo de SplashScreen
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await SplashScreen.preventAutoHideAsync();
        await ensureImmersive();

        // Limpiar caché viejo si es necesario (cada 7 días)
        const lastClearKey = "@kestore_last_cache_clear";
        const lastClear = await AsyncStorage.getItem(lastClearKey);
        const now = Date.now();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;

        if (!lastClear || now - parseInt(lastClear) > sevenDays) {
          log("Limpiando caché antiguo...");
          await clearAppCache();
          await AsyncStorage.setItem(lastClearKey, now.toString());
        }

        setIsAppReady(true);
        await SplashScreen.hideAsync();
      } catch (error) {
        log("Error inicializando app", error);
        setIsAppReady(true);
        await SplashScreen.hideAsync();
      }
    };

    initializeApp();
  }, []);

  // Monitoreo de conectividad de red
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? true);
      if (state.isConnected) {
        log("Conexión restaurada");
      } else {
        log("Sin conexión a internet");
      }
    });

    return unsubscribe;
  }, []);

  // inmersivo al montar y al volver al foreground + manejo de estado de app
  useEffect(() => {
    ensureImmersive();
    const sub = AppState.addEventListener("change", (nextAppState) => {
      const prevAppState = appStateRef.current;
      appStateRef.current = nextAppState;
      setAppState(nextAppState);

      log(`AppState cambió de ${prevAppState} a ${nextAppState}`);

      if (nextAppState === "active") {
        ensureImmersive();
        // Recargar WebView si estuvo en background por mucho tiempo
        if (prevAppState === "background") {
          setTimeout(() => {
            if (webRef.current) {
              webRef.current.injectJavaScript(`
                (function() {
                  try {
                    if (document.visibilityState === 'visible') {
                      window.ReactNativeWebView.postMessage('APP_RESUMED');
                    }
                  } catch(e) {}
                })(); true;
              `);
            }
          }, 100);
        }
      }
    });
    return () => sub.remove();
  }, []);

  // Restaurar URL al iniciar: primero deep link, luego última vista, luego HOME
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const initialIntent = await Linking.getInitialURL();
        if (
          initialIntent &&
          isHttp(initialIntent) &&
          isKestore(initialIntent)
        ) {
          if (mounted) setMainUrl(initialIntent);
          return;
        }
        const saved = await AsyncStorage.getItem(LAST_URL_KEY);
        if (saved && isHttp(saved) && isKestore(saved)) {
          if (mounted) setMainUrl(saved);
          return;
        }
        if (mounted) setMainUrl(HOME_URL);
      } catch {
        if (mounted) setMainUrl(HOME_URL);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const openExternal = useCallback((url: string) => {
    Linking.openURL(url).catch(() => {});
  }, []);

  // Mensajes desde el WebView principal
  const onMainMessage = useCallback(async (e: WebViewMessageEvent) => {
    const raw = String(e?.nativeEvent?.data || "");
    if (!raw) return;

    if (raw.startsWith("RN_SHARE|")) {
      const parts = raw.split("|");
      const title = decodeURIComponent(parts[1] || "");
      const url = decodeURIComponent(parts[2] || "");
      shareDebounced(title, url);
      return;
    }

    if (raw === "PAGE_READY") {
      log("Página principal lista");
      return;
    }

    if (raw === "PAGE_VISIBLE") {
      log("Página visible - restaurando estado");
      ensureImmersive();
      return;
    }

    if (raw === "PAGE_HIDDEN") {
      log("Página oculta - guardando estado");
      return;
    }

    if (raw === "APP_RESUMED") {
      log("App resumida desde background");
      ensureImmersive();
      return;
    }

    if (raw === "GOOGLE_OAUTH_SUCCESS") {
      log("Google OAuth completado exitosamente");
      // Asegurar que la app esté en estado correcto
      ensureImmersive();
      return;
    }

    if (raw === "GOOGLE_OAUTH_RETURN") {
      log("Regreso a Kestore desde Google OAuth");
      // Restaurar estado de la app
      ensureImmersive();
      // Limpiar caché para asegurar que los datos de sesión se actualicen
      setTimeout(() => {
        if (webRef.current) {
          webRef.current.reload();
        }
      }, 1000);
      return;
    }

    if (raw.startsWith("URL|")) {
      const href = decodeURIComponent(raw.slice(4));
      if (href && isHttp(href) && isKestore(href)) {
        // Guardar última URL
        await saveLastUrlIfKestore(href);
        // Restaurar scroll si existe
        const yStr = await AsyncStorage.getItem(scrollKey(href)).catch(
          () => null
        );
        const y = yStr ? parseInt(yStr, 10) : 0;
        if (y > 0) {
          injectScrollTo(webRef, y);
        }
      }
      return;
    }

    if (raw.startsWith("SCROLL|")) {
      // SCROLL|<href>|<y>
      const rest = raw.slice(7);
      const firstSep = rest.indexOf("|");
      if (firstSep > 0) {
        const href = decodeURIComponent(rest.slice(0, firstSep));
        const y = parseInt(rest.slice(firstSep + 1), 10) || 0;
        void saveScroll(href, y);
      }
      return;
    }
  }, []);

  // Intercepta navegación principal (SIN async → boolean)
  const onMainShouldStart = useCallback(
    (req: any): boolean => {
      const { url, navigationType } = req as {
        url: string;
        navigationType?: string;
      };
      const host = hostOf(url);
      log("Main shouldStart", { url, navigationType, host });

      // Manejo especial para Google OAuth
      if (
        host.includes("accounts.google.com") ||
        host.includes("oauth.google.com")
      ) {
        log("Google OAuth detectado, permitiendo navegación", { url });
        return true;
      }

      // Prevenir redirects incorrectos a YouTube desde Google Auth
      if (host.includes("youtube.com") && mainUrl.includes("google.com")) {
        log("Bloqueando redirect incorrecto a YouTube desde Google Auth");
        return false;
      }

      // Schemes directos
      if (!isHttp(url) && isSocialScheme(url)) {
        openExternal(url);
        return false;
      }
      if (!isHttp(url)) return false;

      // HTTPS sociales → abrir app primero
      const social = mapSocialToApp(url);
      if (social) {
        setTimeout(() => {
          void openPreferInstalled(social.appUrls, social.packages);
        }, 0);
        return false;
      }

      // PayPhone en principal → abrir modal
      if (isPayHost(host)) {
        if (bypassNextPayInterceptRef.current) {
          log("Bypass intercept PayPhone → permitir en principal");
          bypassNextPayInterceptRef.current = false;
          return true;
        }
        initialPayUrlRef.current = url;
        setPayUrl(url);
        setPayVisible(true);
        return false;
      }

      // Share pseudo-scheme
      if (looksLikeShareIntent(url)) {
        try {
          const decoded = decodeURIComponent(url.replace(/^share:/i, ""));
          setTimeout(() => {
            Share.share({ message: decoded }).catch(() => {});
          }, 0);
        } catch {}
        return false;
      }

      if (isKestore(url)) return true;
      if (navigationType === "click") {
        openExternal(url);
        return false;
      }
      return true;
    },
    [openExternal]
  );

  // Cambios de navegación principal
  const onMainNavChange = useCallback((nav: any) => {
    const url = String(nav?.url || "");
    lastMainUrlRef.current = url || lastMainUrlRef.current;
    log("Main navChange", { url, loading: nav?.loading });

    // Persistir última URL de Kestore
    if (url && isHttp(url) && isKestore(url)) {
      AsyncStorage.setItem(LAST_URL_KEY, url).catch(() => {});
    }

    if (isPayHost(hostOf(url))) bypassNextPayInterceptRef.current = false;
    ensureImmersive();
  }, []);

  // Botón back físico
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (payVisible) {
        log("Back en PayPhone → cerrar y limpiar cookies PayPhone");
        setPayVisible(false);
        setPayUrl(null);
        clearPayCookies();
        setTimeout(ensureImmersive, 0);
        return true;
      }
      try {
        webRef.current?.injectJavaScript("history.back(); true;");
        setTimeout(ensureImmersive, 0);
        return true;
      } catch {
        return false;
      }
    });
    return () => sub.remove();
  }, [payVisible]);

  // ====== PayPhone (modal) ======
  const onPayShouldStart = useCallback(
    (req: any): boolean => {
      const { url } = req as { url: string };
      const host = hostOf(url);
      const path = pathOf(url);
      log("Pay shouldStart", { url, host, path });

      if (!isHttp(url) && isSocialScheme(url)) {
        openExternal(url);
        return false;
      }
      if (!isHttp(url)) return false;

      const social = mapSocialToApp(url);
      if (social) {
        setTimeout(() => {
          void openPreferInstalled(social.appUrls, social.packages);
        }, 0);
        return false;
      }

      if (isPayHost(host)) return true;

      // Salir de PayPhone → a principal
      log("Saliendo de PayPhone → cerrar modal y navegar principal", url);
      setPayVisible(false);
      setPayUrl(null);
      setMainUrl(url);
      setTimeout(ensureImmersive, 0);
      return false;
    },
    [openExternal]
  );

  const onPayNavChange = useCallback((nav: any) => {
    const url = String(nav?.url || "");
    const p = (url || "").toLowerCase();
    log("Pay navChange", { url });
    if (PAY_ERR_KEYS.some((k) => p.includes(k))) {
      log("PayPhone: NO AUTORIZADO/ERROR → fallback a principal con Referer");
      const target = initialPayUrlRef.current || url;
      setPayVisible(false);
      setPayUrl(null);
      bypassNextPayInterceptRef.current = true;
      const js = `
        (function(){ try { window.location.href = ${JSON.stringify(
          target
        )}; } catch(e){} })(); true;
      `;
      webRef.current?.injectJavaScript(js);
      setTimeout(ensureImmersive, 0);
    }
  }, []);

  const onPayMessage = useCallback((e: WebViewMessageEvent) => {
    const data = String(e?.nativeEvent?.data || "");
    if (data === "PAYPHONE_READY") log("PayPhone listo");
  }, []);

  // ============== Render ==============
  if (!isAppReady) {
    return (
      <View style={styles.container}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle="light-content"
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      {/* WEBVIEW PRINCIPAL */}
      {!mainUrl ? (
        <View style={{ flex: 1, backgroundColor: "#000" }} />
      ) : (
        <WebView
          ref={webRef}
          source={{
            uri: mainUrl,
            headers: {
              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
              "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          }}
          userAgent={UA}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          cacheEnabled={false}
          allowFileAccess={false}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          setBuiltInZoomControls={false}
          setDisplayZoomControls={false}
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          setSupportMultipleWindows={false}
          textZoom={100}
          mixedContentMode="compatibility"
          allowsFullscreenVideo
          allowsProtectedMedia
          incognito={false}
          injectedJavaScript={INJECT_MAIN}
          onMessage={onMainMessage}
          onShouldStartLoadWithRequest={onMainShouldStart}
          onNavigationStateChange={onMainNavChange}
          onError={(e) => {
            const errorDesc = e.nativeEvent.description || "";
            log("Main WebView error", e.nativeEvent);

            if (isSSLError(errorDesc)) {
              log("SSL Error detectado, intentando recargar...");
              showUserFriendlyError(ERROR_TYPES.SSL_ERROR);
              setTimeout(() => {
                if (webRef.current) {
                  webRef.current.reload();
                }
              }, 2000);
            } else if (isNetworkError(errorDesc)) {
              log("Network Error detectado");
              showUserFriendlyError(ERROR_TYPES.NETWORK_ERROR);
              // Intentar recargar después de un tiempo más largo para errores de red
              setTimeout(() => {
                if (webRef.current && isConnected) {
                  webRef.current.reload();
                }
              }, 5000);
            } else {
              // Error genérico
              log("Error genérico en WebView principal");
              setTimeout(() => {
                if (webRef.current) {
                  webRef.current.reload();
                }
              }, 3000);
            }
          }}
          onHttpError={(e) => {
            log("Main WebView HTTP error", e.nativeEvent);
            // Manejar errores HTTP específicos
            if (e.nativeEvent.statusCode >= 500) {
              setTimeout(() => {
                if (webRef.current) {
                  webRef.current.reload();
                }
              }, 3000);
            }
          }}
          onLoadStart={() => log("WebView cargando...")}
          onLoadEnd={() => log("WebView carga completada")}
          startInLoadingState
          renderLoading={() => (
            <View
              style={[
                styles.web,
                { justifyContent: "center", alignItems: "center" },
              ]}
            >
              <View
                style={{
                  backgroundColor: "#000",
                  padding: 20,
                  borderRadius: 10,
                }}
              >
                {/* Aquí podrías agregar un spinner si quieres */}
              </View>
            </View>
          )}
          style={styles.web}
        />
      )}

      {/* MODAL PayPhone */}
      {payVisible && (
        <View style={styles.modal}>
          <WebView
            ref={payRef}
            source={{
              uri: payUrl || "about:blank",
              headers: {
                Referer: lastMainUrlRef.current || HOME_URL,
                Origin: lastMainUrlRef.current?.startsWith("https://")
                  ? new URL(lastMainUrlRef.current).origin
                  : "https://www.kestore.com.ec",
                Accept:
                  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
              },
            }}
            userAgent={UA}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            cacheEnabled={false}
            allowFileAccess={false}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            setBuiltInZoomControls={false}
            setDisplayZoomControls={false}
            setSupportMultipleWindows={false}
            textZoom={100}
            mixedContentMode="compatibility"
            androidLayerType="hardware"
            allowsFullscreenVideo
            allowsProtectedMedia
            incognito={false}
            injectedJavaScript={INJECT_PAY}
            onMessage={onPayMessage}
            onShouldStartLoadWithRequest={onPayShouldStart}
            onNavigationStateChange={onPayNavChange}
            onError={(e) => {
              const errorDesc = e.nativeEvent.description || "";
              log("PayPhone WebView error", e.nativeEvent);

              if (isSSLError(errorDesc)) {
                log("SSL Error en PayPhone, intentando recargar...");
                showUserFriendlyError(ERROR_TYPES.PAYPHONE_ERROR);
                setTimeout(() => {
                  if (payRef.current) {
                    payRef.current.reload();
                  }
                }, 1500);
              } else if (isNetworkError(errorDesc)) {
                log("Network Error en PayPhone");
                showUserFriendlyError(ERROR_TYPES.NETWORK_ERROR);
                setTimeout(() => {
                  if (payRef.current && isConnected) {
                    payRef.current.reload();
                  }
                }, 3000);
              } else {
                log("Error genérico en PayPhone");
                if (__DEV__) {
                  Alert.alert("PayPhone", `Error de conexión: ${errorDesc}`);
                } else {
                  showUserFriendlyError(ERROR_TYPES.PAYPHONE_ERROR);
                }
              }
            }}
            onHttpError={(e) => {
              log("PayPhone WebView HTTP error", e.nativeEvent);
              // Reintentar en errores 5xx
              if (e.nativeEvent.statusCode >= 500) {
                setTimeout(() => {
                  if (payRef.current) {
                    payRef.current.reload();
                  }
                }, 2000);
              }
            }}
            onLoadStart={() => log("PayPhone cargando...")}
            onLoadEnd={() => log("PayPhone carga completada")}
            startInLoadingState
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
