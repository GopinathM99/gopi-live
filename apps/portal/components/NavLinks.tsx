"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/#games", label: "Games", isCurrent: (path: string) => path === "/" },
  { href: "/contact", label: "Contact", isCurrent: (path: string) => path === "/contact" },
] as const;

/** Shared header/footer links, with the current page marked for assistive tech. */
export default function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} aria-current={link.isCurrent(pathname) ? "page" : undefined}>
          {link.label}
        </Link>
      ))}
    </>
  );
}
