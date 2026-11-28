import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Instrument_Sans, Unbounded } from "next/font/google";
import "./globals.css";

// Tipografías de la marca común (autoalojadas por next/font, sin peticiones a Google en el navegador).
const display = Unbounded({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display", display: "swap" });
const text = Instrument_Sans({ subsets: ["latin"], variable: "--font-text", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Firma", template: "%s · Firma" },
  description: "Consentimientos informados digitales para estudios de tatuaje, piercing y micropigmentación.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${display.variable} ${text.variable}`}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
