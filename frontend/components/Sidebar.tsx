'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Jobs', icon: '◈' },
  { href: '/outreach', label: 'Outreach', icon: '◎' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-52 shrink-0 border-r border-zinc-800 flex flex-col px-4 py-6 gap-6">
      {/* Logo */}
      <div className="flex items-center gap-2 px-2">
        <span className="text-lg font-bold text-indigo-400">JH</span>
        <span className="text-sm font-semibold text-zinc-300">Job Hunter</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {links.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
              }`}
            >
              <span className="text-xs">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
