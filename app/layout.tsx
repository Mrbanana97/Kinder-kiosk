import type React from "react"
import type { Metadata, Viewport } from "next"
import { GeistMono } from "geist/font/mono"
import { Plus_Jakarta_Sans } from "next/font/google"
import "./globals.css"
import { Suspense } from "react"
import PasswordProtection from "@/components/password-protection"

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-geist-sans" })

export const metadata: Metadata = {
  title: "Kindergarten Sign-Out Kiosk",
  description: "Digital sign-out system for kindergarten students",
  generator: "v0.app",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kindergarten Kiosk",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
  <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ffffff" />
  {/* mobile-web-app-capable is the modern, non-Apple-prefixed variant; Next.js will still emit the apple tags from metadata.appleWebApp for backward compatibility */}
  <meta name="mobile-web-app-capable" content="yes" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.svg" />
  <link rel="icon" type="image/svg+xml" sizes="192x192" href="/icon-192.svg" />
  <link rel="icon" type="image/svg+xml" sizes="512x512" href="/icon-512.svg" />
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
  <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js')
                    .then(reg => console.log('[sw] registered', reg.scope))
                    .catch(err => console.warn('[sw] registration failed', err));
                });
              } else {
                // During development ensure any old SW is removed to prevent caching issues
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(regs => {
                    regs.forEach(r => r.unregister());
                  });
                }
              }
            `,
          }}
        />
      </head>
      <body className={`font-sans ${jakarta.variable} ${GeistMono.variable}`}>
        <PasswordProtection>
          <Suspense fallback={null}>{children}</Suspense>
        </PasswordProtection>
      </body>
    </html>
  )
}
