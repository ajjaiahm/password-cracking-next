import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ProgressProvider } from "@/context/ProgressContext";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap"
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#09090b",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://password-cracking-lab-23857.web.app"),
  title: {
    default: "Password Cracking Lab — Interactive Cybersecurity Training",
    template: "%s | PCL"
  },
  description: "Hands-on, interactive password security auditing platform. Learn Hashcat, John the Ripper, Hydra & Wireshark with AI-guided labs, challenges, and a leaderboard.",
  keywords: ["password cracking", "cybersecurity", "hashcat", "john the ripper", "hydra", "wireshark", "ethical hacking", "security training", "CTF"],
  authors: [{ name: "PCL Team" }],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Password Cracking Lab",
    title: "Password Cracking Lab — Cybersecurity Training",
    description: "AI-powered, hands-on password security auditing platform with labs, challenges, and leaderboard.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Password Cracking Lab",
    description: "Interactive cybersecurity training — Hashcat, John, Hydra & Wireshark.",
  },
  appleWebApp: {
    capable: true,
    title: "PCL",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="PCL" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <ProgressProvider>
            {children}
          </ProgressProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
