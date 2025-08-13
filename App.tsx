// App.tsx — Android only (errores TS corregidos, misma lógica)
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
} from "react-native";
import { WebView } from "react-native-webview";
import CookieManager from "@react-native-cookies/cookies";

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
  "Mozilla/5.0 (Linux; Android 10; KestoreApp) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36 KestoreApp/1.0";

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

// ======= Limpieza de cookies por dominio (corrige TS) =======
const clearDomainCookies = async (domain: string) => {
  try {
    const base = `https://${domain}`;
    // Si existe remove(), borra por nombre
    const anyCM: any = CookieManager as any;
    if (
      typeof CookieManager.get === "function" &&
      typeof anyCM.remove === "function"
    ) {
      const cookies = await CookieManager.get(base);
      for (const name of Object.keys(cookies || {})) {
        try {
          await anyCM.remove(base, name);
        } catch {}
      }
      if (typeof CookieManager.flush === "function")
        await CookieManager.flush();
      return;
    }
    // Fallback: clearAll (puede borrar todo el jar)
    if (typeof CookieManager.clearAll === "function") {
      await CookieManager.clearAll(true);
      if (typeof CookieManager.flush === "function")
        await CookieManager.flush();
      return;
    }
    // Último recurso para instalaciones antiguas (evita error TS)
    if (typeof (CookieManager as any).clear === "function") {
      await (CookieManager as any).clear(true);
      if (typeof CookieManager.flush === "function")
        await CookieManager.flush();
    }
  } catch {}
};

export default function App() {
  const webRef = useRef<WebView>(null);
  const payRef = useRef<WebView>(null);

  const [mainUrl, setMainUrl] = useState(HOME_URL);
  const [payVisible, setPayVisible] = useState(false);
  const [payUrl, setPayUrl] = useState<string | null>(null);

  const topInset = useMemo(
    () => (IS_ANDROID ? (StatusBar.currentHeight ?? 24) : 0),
    []
  );

  const injectedMain = useMemo(
    () => `
      (function(){
        try{
          var m=document.querySelector('meta[name=viewport]');
          if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}
          m.content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no';
          var s=document.createElement('style');s.innerHTML='html{-webkit-text-size-adjust:100% !important;}';document.head.appendChild(s);
        }catch(e){}
        var origShare=navigator.share;
        navigator.share=function(data){
          try{
            var title=(data&&data.title)||'';
            var url=(data&&data.url)||'';
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage('RN_SHARE|'+encodeURIComponent(title)+'|'+encodeURIComponent(url));
            return Promise.resolve();
          }catch(e){return Promise.reject(e);}
        };
      })(); true;
    `,
    []
  );

  const injectedPay = useMemo(
    () => `
      (function(){
        try{
          var m=document.querySelector('meta[name=viewport]');
          if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}
          m.content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no';
          var s=document.createElement('style');s.innerHTML='html{-webkit-text-size-adjust:100% !important;}';document.head.appendChild(s);
        }catch(e){}
      })(); true;
    `,
    []
  );

  const wipePayCookies = useCallback(async () => {
    await clearDomainCookies("pay.payphonetodoesposible.com");
    await clearDomainCookies("payphonetodoesposible.com");
  }, []);

  const clearTmpForPay = useCallback(async () => {
    try {
      await CookieManager.flush();
    } catch {}
  }, []);

  const gotoHomeWithTag = useCallback(
    (tag: string) => {
      const target = `${HOME_URL}#${tag}`;
      setPayVisible(false);
      setPayUrl(null);
      clearTmpForPay();
      setTimeout(() => setMainUrl(target), 0);
    },
    [clearTmpForPay]
  );

  const handlePayOutcomeByUrl = useCallback(
    (url: string) => {
      let u: URL | null = null;
      try {
        u = new URL(url);
      } catch {}
      const path = (u?.pathname || "") + (u?.search || "") + (u?.hash || "");
      const p = path.toLowerCase();

      if (PAY_SUCCESS_KEYS.some((k) => p.includes(k))) {
        gotoHomeWithTag("pay=success");
        return true;
      }
      if (PAY_CANCEL_KEYS.some((k) => p.includes(k))) {
        gotoHomeWithTag("pay=cancel");
        return true;
      }

      if (
        PAY_ERROR_KEYS.some((k) => p.includes(k)) ||
        /\/home\/expired/.test(p) ||
        /\/expired/.test(p) ||
        /unauthorized|no%20autorizado/.test(p)
      ) {
        gotoHomeWithTag("pay=expired");
        return true;
      }

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

      if (!isHttp(url) && !isSocialScheme(url)) return false;

      if (isSocialScheme(url)) {
        openExternal(url);
        return false;
      }

      if (isPayHost(host)) {
        wipePayCookies();
        setPayUrl(url);
        setPayVisible(true);
        return false;
      }

      if (looksLikeShareIntent(url)) {
        try {
          const decoded = decodeURIComponent(url.replace(/^share:/i, ""));
          shareDebounced(undefined, decoded);
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
    [openExternal, wipePayCookies]
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (payVisible) {
        setPayVisible(false);
        setPayUrl(null);
        clearTmpForPay();
        return true;
      }
      try {
        webRef.current?.injectJavaScript("history.back(); true;");
        return true;
      } catch {
        return false;
      }
    });
    return () => sub.remove();
  }, [payVisible, clearTmpForPay]);

  const onMessage = useCallback((event: any) => {
    const data = String(event?.nativeEvent?.data || "");
    if (data.startsWith("RN_SHARE|")) {
      const parts = data.split("|");
      const title = decodeURIComponent(parts[1] || "");
      const url = decodeURIComponent(parts[2] || "");
      shareDebounced(title, url);
    }
  }, []);

  const onPayNavChange = useCallback(
    (nav: any) => {
      const url = String(nav?.url || "");
      if (url) handlePayOutcomeByUrl(url);
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
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        allowFileAccess={false}
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        setSupportMultipleWindows={false} // <- evita usar onCreateWindow (tipos viejos)
        textZoom={100}
        injectedJavaScript={injectedMain}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStart}
        onNavigationStateChange={(nav) => {
          const url = String((nav as any)?.url || "");
          if (url && isPayHost(hostOf(url))) {
            wipePayCookies();
            setPayUrl(url);
            setPayVisible(true);
          }
        }}
        startInLoadingState
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
            javaScriptEnabled
            domStorageEnabled
            cacheEnabled={false}
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            allowFileAccess={false}
            setBuiltInZoomControls={false}
            setDisplayZoomControls={false}
            setSupportMultipleWindows={false} // <- igual aquí
            textZoom={100}
            injectedJavaScript={injectedPay}
            onNavigationStateChange={onPayNavChange}
            onShouldStartLoadWithRequest={(req: any) => {
              const { url } = req;
              const host = hostOf(url);
              if (isSocialScheme(url)) {
                openExternal(url);
                return false;
              }
              if (isPayHost(host)) {
                handlePayOutcomeByUrl(url);
                return true;
              }
              // salir del dominio de PayPhone dentro del modal → al principal
              if (!isPayHost(host)) {
                setPayVisible(false);
                setPayUrl(null);
                clearTmpForPay();
                setMainUrl(url);
                return false;
              }
              return true;
            }}
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
