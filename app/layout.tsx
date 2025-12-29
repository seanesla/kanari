import type React from "react"
import type { Metadata } from "next"
import { Instrument_Sans, Instrument_Serif, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Providers } from "@/components/providers"
import "./globals.css"

const instrumentSans = Instrument_Sans({ subsets: ["latin"], variable: "--font-sans" })
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
})
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "kanari",
  description: "Your metrics are lying to you.",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <Providers>
      <html lang="en" className="dark">
        <body
          className={`${instrumentSans.variable} ${instrumentSerif.variable} ${geistMono.variable} font-sans antialiased`}
        >
          {children}
          <Analytics />
        </body>
      </html>
    </Providers>
  )
}
