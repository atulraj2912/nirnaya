import "./globals.css";

export const metadata = {
  title: "NIRNAYA",
  description: "AI-powered enterprise IT Service Management platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
