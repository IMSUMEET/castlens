"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function NavBar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onWatch = pathname?.startsWith("/watch");
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors ${
        scrolled || onWatch ? "bg-night-950/90 backdrop-blur" : "bg-gradient-to-b from-black/80 to-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-[1500px] items-center gap-6 px-5 py-3.5 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-iq to-iq-deep font-bold text-black shadow-glow">◐</span>
          <span className="text-xl font-extrabold tracking-tight">
            Cast<span className="text-iq">lens</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-white/70 md:flex">
          <Link href="/" className="hover:text-white">Home</Link>
          <Link href="/studio" className="hover:text-white">Castlens Studio</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="pill hidden sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-iq animate-pulse2" /> video intelligence
          </span>
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-fuchsia-500 to-indigo-500" />
        </div>
      </div>
    </header>
  );
}
