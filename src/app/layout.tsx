import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Curatela — Platform voor Professionele Bewindvoering (CRBP & Vredegerecht)",
  description:
    "Beheerplatform voor advocaat-bewindvoerders: financieel dossierbeheer, OCR-facturen, SEPA betaalbatches, PDF-export voor het Vredegerecht (CRBP) en WZC zorgportaal."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
