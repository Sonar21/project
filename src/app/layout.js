import React from "react";
import Providers from "@/app/providers/Providers";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      
      <body>
        
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
