import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "GameHub",
  description: "GameHub",
}

import { Geist, Geist_Mono, Instrument_Sans } from "next/font/google"

import "@workspace/ui/globals.css"
import { Providers } from "@/components/providers"
import { cn } from "@workspace/ui/lib/utils";

const instrumentSansHeading = Instrument_Sans({subsets:['latin'],variable:'--font-heading'});

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const geistMono = Geist_Mono({subsets:['latin'],variable:'--font-mono'})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontSans.variable, "font-mono", geistMono.variable, instrumentSansHeading.variable)}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
