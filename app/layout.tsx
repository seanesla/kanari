import type { Metadata, Viewport } from "next"
import Script from "next/script"
import {
  // Current fonts (defaults)
  Instrument_Sans,
  Instrument_Serif,
  // Sans fonts
  Inter,
  DM_Sans,
  Work_Sans,
  Public_Sans,
  Plus_Jakarta_Sans,
  Manrope,
  Sora,
  Outfit,
  Quicksand,
  Karla,
  Nunito_Sans,
  Poppins,
  Raleway,
  Rubik,
  Source_Sans_3,
  Montserrat,
  Lexend,
  // Serif fonts
  Merriweather,
  Lora,
  Playfair_Display,
  IBM_Plex_Serif,
  Spectral,
  Crimson_Pro,
  Libre_Baskerville,
  Cardo,
  Bitter,
  Fraunces,
  EB_Garamond,
} from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Providers } from "@/components/providers"
import { ErrorBoundary } from "@/components/error-boundary"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

// Sans fonts
const instrumentSans = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument-sans" })
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" })
const workSans = Work_Sans({ subsets: ["latin"], variable: "--font-work-sans" })
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans" })
const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-plus-jakarta-sans" })
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" })
const sora = Sora({ subsets: ["latin"], variable: "--font-sora" })
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" })
const quicksand = Quicksand({ subsets: ["latin"], variable: "--font-quicksand" })
const karla = Karla({ subsets: ["latin"], variable: "--font-karla" })
const nunitoSans = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito-sans" })
const poppins = Poppins({ subsets: ["latin"], weight: "400", variable: "--font-poppins" })
const raleway = Raleway({ subsets: ["latin"], variable: "--font-raleway" })
const rubik = Rubik({ subsets: ["latin"], variable: "--font-rubik" })
const sourceSans3 = Source_Sans_3({ subsets: ["latin"], variable: "--font-source-sans-3" })
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" })
const lexend = Lexend({ subsets: ["latin"], variable: "--font-lexend" })

// Serif fonts
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
})
const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-merriweather",
})
const lora = Lora({ subsets: ["latin"], variable: "--font-lora" })
const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair-display",
})
const ibmPlexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-ibm-plex-serif",
})
const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-spectral",
})
const crimsonPro = Crimson_Pro({ subsets: ["latin"], variable: "--font-crimson-pro" })
const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-libre-baskerville",
})
const cardo = Cardo({ subsets: ["latin"], weight: "400", variable: "--font-cardo" })
const bitter = Bitter({ subsets: ["latin"], variable: "--font-bitter" })
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" })
const ebGaramond = EB_Garamond({ subsets: ["latin"], variable: "--font-eb-garamond" })

export const metadata: Metadata = {
  title: "kanari",
  description: "Your metrics are lying to you.",
  generator: "v0.app",
  icons: {
    icon: "/icon.svg",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <Script id="startup-animation-pref" strategy="beforeInteractive">
          {`try { if (localStorage.getItem("kanari:disableStartupAnimation") === "true") { document.documentElement.dataset.disableStartupAnimation = "true" } } catch (e) {}`}
        </Script>
        <Script id="startup-accent-color" strategy="beforeInteractive">
          {`(function () {
  function normalizeHexColor(input) {
    if (typeof input !== "string") return null;
    var value = input.trim();
    if (!value.startsWith("#")) return null;
    var hex = value.slice(1);
    if (hex.length === 3) {
      var r = hex[0], g = hex[1], b = hex[2];
      if (!r || !g || !b) return null;
      return ("#" + r + r + g + g + b + b).toLowerCase();
    }
    if (hex.length === 6) return ("#" + hex).toLowerCase();
    return null;
  }

  function clampByte(n) {
    return Math.max(0, Math.min(255, n | 0));
  }

  function shadeHex(hex, mode, amount) {
    // mode: "lighten" | "darken"
    var c = normalizeHexColor(hex);
    if (!c) return null;
    var raw = c.slice(1);
    var r = parseInt(raw.slice(0, 2), 16);
    var g = parseInt(raw.slice(2, 4), 16);
    var b = parseInt(raw.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;

    if (mode === "lighten") {
      r = clampByte(r + (255 - r) * amount);
      g = clampByte(g + (255 - g) * amount);
      b = clampByte(b + (255 - b) * amount);
    } else {
      r = clampByte(r * (1 - amount));
      g = clampByte(g * (1 - amount));
      b = clampByte(b * (1 - amount));
    }

    var toHex = function (n) { return n.toString(16).padStart(2, "0"); };
    return ("#" + toHex(r) + toHex(g) + toHex(b));
  }

  function applyAccent(hex) {
    var accent = normalizeHexColor(hex);
    if (!accent) return;

    var light = shadeHex(accent, "lighten", 0.15) || accent;
    var dark = shadeHex(accent, "darken", 0.30) || accent;

    var root = document.documentElement;
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-light", light);
    root.style.setProperty("--accent-dark", dark);
    root.style.setProperty("--ring", accent);
    root.style.setProperty("--chart-1", accent);
    root.style.setProperty("--sidebar-primary", accent);
    root.style.setProperty("--sidebar-ring", accent);
  }

  try {
    var fromStorage = localStorage.getItem("kanari:accentColor");
    if (fromStorage) {
      applyAccent(fromStorage);
      return;
    }
  } catch (e) {}

  try {
    if (!("indexedDB" in window)) return;

    var open = indexedDB.open("kanari");
    open.onerror = function () {};
    open.onsuccess = function () {
      try {
        var db = open.result;
        if (!db.objectStoreNames || !db.objectStoreNames.contains("settings")) return;
        var tx = db.transaction("settings", "readonly");
        var store = tx.objectStore("settings");
        var req = store.get("default");
        req.onsuccess = function () {
          try {
            var settings = req.result;
            var accent = settings && settings.accentColor;
            if (!accent) return;
            applyAccent(accent);
            try { localStorage.setItem("kanari:accentColor", accent); } catch (e) {}
          } catch (e) {}
        };
      } catch (e) {}
    };
  } catch (e) {}
})();`}
        </Script>
      </head>
      <body
        className={`
          ${instrumentSans.variable} ${inter.variable} ${dmSans.variable} ${workSans.variable}
          ${publicSans.variable} ${plusJakartaSans.variable} ${manrope.variable} ${sora.variable}
          ${outfit.variable} ${quicksand.variable} ${karla.variable} ${nunitoSans.variable}
          ${poppins.variable} ${raleway.variable} ${rubik.variable} ${sourceSans3.variable}
          ${montserrat.variable} ${lexend.variable}
          ${instrumentSerif.variable} ${merriweather.variable} ${lora.variable} ${playfairDisplay.variable}
          ${ibmPlexSerif.variable} ${spectral.variable} ${crimsonPro.variable} ${libreBaskerville.variable}
          ${cardo.variable} ${bitter.variable} ${fraunces.variable} ${ebGaramond.variable}
          font-sans antialiased
        `}
      >
        <Providers>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <Toaster position="bottom-right" />
          <Analytics />
        </Providers>
      </body>
    </html>
  )
}
