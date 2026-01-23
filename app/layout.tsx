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
