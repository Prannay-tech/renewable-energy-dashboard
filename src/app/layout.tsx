import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "U.S. Renewable Energy Investment Dashboard",
  description: "Multi-tab investment analysis dashboard for U.S. solar and wind energy projects",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-900 text-slate-100">{children}</body>
    </html>
  );
}
