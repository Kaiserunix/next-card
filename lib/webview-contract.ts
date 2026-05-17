export type WebViewTarget = {
  platform: "android-webview";
  maxPreviewWidth: number;
  minSupportedWidth: number;
  layoutMode: "mobile-only";
  safeArea: "css-env";
  storage: "localStorage";
  exportMode: "next-server";
};

export type AndroidWebViewRequirement = {
  name: string;
  required: boolean;
  reason: string;
};

export const WEBVIEW_TARGET: WebViewTarget = {
  platform: "android-webview",
  maxPreviewWidth: 430,
  minSupportedWidth: 360,
  layoutMode: "mobile-only",
  safeArea: "css-env",
  storage: "localStorage",
  exportMode: "next-server"
};

export const ANDROID_WEBVIEW_REQUIREMENTS: AndroidWebViewRequirement[] = [
  {
    name: "JavaScript enabled",
    required: true,
    reason: "The MVP is a client-side React app with Zustand state actions."
  },
  {
    name: "DOM storage enabled",
    required: true,
    reason: "Decks, proof records, and mock planning state persist through localStorage."
  },
  {
    name: "Viewport meta honored",
    required: true,
    reason: "The app locks to device width and uses safe-area CSS env values."
  },
  {
    name: "HTTPS app loading",
    required: true,
    reason: "This version is a Next server build with API routes, so the WebView should load a deployed HTTPS URL."
  },
  {
    name: "Back button bridge",
    required: false,
    reason: "There is only one route today; Android can later map back to mode history."
  }
];
