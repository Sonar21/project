import React from "react";
import Providers from "@/app/providers/Providers";
import Footer from "@/components/Footer";

// Root application layout. Added <head> with responsive meta tag to ensure
// proper mobile viewport scaling on smartphones.
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1,maximum-scale=1"
        />
        <meta charSet="utf-8" />
      </head>
      <body className="appRoot">
        <Providers>{children}</Providers>
        <Footer />
      </body>
    </html>
  );
}
