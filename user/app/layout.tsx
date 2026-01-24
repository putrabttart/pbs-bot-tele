import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Putra BTT Store - Belanja Mudah",
  description: "Toko online Putra BTT Store dengan berbagai produk digital premium",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
        <script
          src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.js"
          crossOrigin="anonymous"
          defer
        ></script>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css"
        />
      </head>
      <body className="antialiased">
        <CartProvider>
          <Header />
          <main className="min-h-screen bg-[#f6f7fb] pb-24 md:pb-0">
            {children}
          </main>
          <footer className="bg-[#0f1229] text-white py-8 border-t border-white/10">
            <div className="container mx-auto px-4 text-center">
              <p className="text-sm text-white/60">
                &copy; 2026 Putra BTT Store. All rights reserved.
              </p>
              <p className="text-xs text-white/40 mt-2 flex items-center justify-center gap-1">
                Made with <i className="fa-solid fa-heart text-red-400"></i> dari Lombok.
              </p>
            </div>
          </footer>
          <BottomNav />
        </CartProvider>
      </body>
    </html>
  );
}
