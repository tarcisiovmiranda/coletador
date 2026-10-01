"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

export function NavTabs({ items }: { items: NavItem[] }) {
  const path = usePathname();
  // o item mais específico que casa com a rota atual fica ativo
  const ativo = items
    .filter((i) => path === i.href || path.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`shrink-0 rounded-full px-5 py-3 text-base font-bold ${
            i.href === ativo ? "bg-brand-600 text-white" : "bg-white text-slate-700 shadow-sm"
          }`}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
