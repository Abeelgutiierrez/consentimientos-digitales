"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof Icons;
}

export function PanelNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav>
      {items.map((it) => {
        const Icon = Icons[it.icon];
        const on = it.href === "/panel" ? path === "/panel" : path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
            <Icon />
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
