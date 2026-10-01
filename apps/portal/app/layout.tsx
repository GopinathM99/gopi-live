import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "gopi.live", template: "%s · gopi.live" },
  description: "A hub of browser games.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="logo">
            gopi<span>.live</span>
          </Link>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
