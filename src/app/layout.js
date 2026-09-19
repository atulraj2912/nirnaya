import "./globals.css";
import Providers from "@/lib/providers";

export const metadata = {
  title: "NIRNAYA",
  description: "AI-powered enterprise IT Service Management platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
