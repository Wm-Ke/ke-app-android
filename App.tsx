// App.tsx — Android
// PayPhone OK + Deep Links sociales + Modo inmersivo (inset) +
// Persistencia de última URL y posición de scroll con LRU (restauración al reabrir)

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
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import CookieManager from "@react-native-cookies/cookies";
import * as NavigationBar from "expo-navigation-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

// UA móvil realista
const UA =
  "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.135 Mobile Safari/537.36";

// ================= Persistencia =================
const LAST_URL_KEY = "@kestore_last_url";
const SCROLL_PREFIX = "@kestore_scroll:"; // key por URL canonical
const SCROLL_INDEX_KEY = "@kestore_scroll_index"; // índice LRU
const MAX_SCROLL_ENTRIES = 30; // tope LRU

// ================= Utils ===================
const log = (msg: string, extra?: any) =>
  console.log(`[${new Date().toISOString()}] [APP] ${msg}`, extra ?? "");

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
      var s=document.createElement('style'); s.innerHTML='html{-webkit-text-size-adjust:100% !important;}'; document.head.appendChild(s);
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

  // última URL real de la principal (para Referer)
  const lastMainUrlRef = useRef<string>(HOME_URL);
  // bypass una vez para permitir que la principal navegue a PayPhone si hace falta
  const bypassNextPayInterceptRef = useRef<boolean>(false);
  const initialPayUrlRef = useRef<string | null>(null);

  // inmersivo al montar y al volver al foreground
  useEffect(() => {
    ensureImmersive();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") ensureImmersive();
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
          source={{ uri: mainUrl }}
          userAgent={UA}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          cacheEnabled
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
          injectedJavaScript={INJECT_MAIN}
          onMessage={onMainMessage}
          onShouldStartLoadWithRequest={onMainShouldStart}
          onNavigationStateChange={onMainNavChange}
          onError={(e) => log("Main WebView error", e.nativeEvent)}
          onHttpError={(e) => log("Main WebView HTTP error", e.nativeEvent)}
          startInLoadingState
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
              },
            }}
            userAgent={UA}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            cacheEnabled
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
            injectedJavaScript={INJECT_PAY}
            onMessage={onPayMessage}
            onShouldStartLoadWithRequest={onPayShouldStart}
            onNavigationStateChange={onPayNavChange}
            onError={(e) => {
              log("PayPhone WebView error", e.nativeEvent);
              if (__DEV__)
                Alert.alert(
                  "PayPhone",
                  `Error de conexión: ${e.nativeEvent.description}`
                );
            }}
            onHttpError={(e) =>
              log("PayPhone WebView HTTP error", e.nativeEvent)
            }
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
