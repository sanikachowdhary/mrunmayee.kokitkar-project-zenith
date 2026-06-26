import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "./components/NavBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Project Zenith: The Celestial Eye",
  description: "An advanced real-time orbital tracking and celestial reconstruction platform. Track the ISS, simulate historical night skies, and discover the cosmos above any coordinate on Earth.",
  keywords: ["astronomy", "space tracking", "ISS live tracking", "NASA Horizons", "satellite radar", "CesiumJS", "Next.js", "stargazing", "Bortle scale"],
  authors: [{ name: "Mrunmayee Kokitkar" }, { name: "Sanika Chowdhary" }],
  openGraph: {
    title: "Project Zenith: The Celestial Eye",
    description: "An advanced real-time orbital tracking and celestial reconstruction platform. Track the ISS, simulate historical night skies, and discover the cosmos above any coordinate on Earth.",
    url: "https://mrunmayee-kokitkar-project-zenith.vercel.app",
    siteName: "Project Zenith",
    images: [
      {
        url: "/screenshots/dashboard_view.png",
        width: 1200,
        height: 630,
        alt: "Project Zenith Celestial Intelligence Dashboard",
      }
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Project Zenith: The Celestial Eye",
    description: "An advanced real-time orbital tracking and celestial reconstruction platform. Track the ISS, simulate historical night skies, and discover the cosmos above any coordinate on Earth.",
    images: ["/screenshots/dashboard_view.png"],
  },
  metadataBase: new URL("https://mrunmayee-kokitkar-project-zenith.vercel.app"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-[100dvh] flex flex-col bg-transparent relative">
        <div className="cosmic-bg" />
        <NavBar />
        {children}
      </body>
    </html>
  );
}
