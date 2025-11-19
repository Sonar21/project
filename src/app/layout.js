import React from "react";
import Providers from "@/app/providers/Providers";
import Footer from "@/components/Footer";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="appRoot">
        <Providers>{children}</Providers>
        <Footer />
      </body>
    </html>
  );
}
