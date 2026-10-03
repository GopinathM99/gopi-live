import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import UserMenu from "@/components/UserMenu";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["500", "700"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: { default: "gopi.live", template: "%s · gopi.live" },
  description: "A hub of browser games.",
};

export const viewport: Viewport = {
  themeColor: "#07070d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${display.variable} ${body.variable}`}>
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="logo">
              <span className="logo-mark" aria-hidden="true" />
              gopi<span>.live</span>
            </Link>
            <nav className="nav">
              <Link href="/#games">Games</Link>
              <UserMenu />
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="container">
            <span>
              gopi<span className="accent">.live</span>
            </span>
            <span>Made for players. Runs in your browser.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
