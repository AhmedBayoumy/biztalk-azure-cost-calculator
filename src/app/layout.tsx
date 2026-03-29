import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "BizTalk Migration Cost Calculator",
  description: "Estimate Azure costs for BizTalk Server migrations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <Providers>
          <Header />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
