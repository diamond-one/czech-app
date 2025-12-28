import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  themeColor: "#3F9AAE",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  userScalable: false,
};

export const metadata = {
  title: "Czech Patterns",
  description: "Learn Czech through spoken patterns.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-v3-192.png",
    apple: "/icons/icon-v3-192.png",
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
