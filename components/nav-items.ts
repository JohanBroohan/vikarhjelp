export interface NavItem {
  href: string;
  label: string;
  icon: string; // SVG path data
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "I dag", icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { href: "/fravaer", label: "Registrer fravær", icon: "M12 5v14M5 12h14" },
  { href: "/laerere", label: "Lærere", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21v-1a6 6 0 0112 0v1" },
  { href: "/timeplan", label: "Timeplan", icon: "M4 5h16v16H4zM4 9h16M9 5v16" },
  { href: "/vikarer", label: "Vikarer", icon: "M17 20h5v-1a4 4 0 00-4-4M9 7a4 4 0 100 8 4 4 0 000-8zM1 20v-1a5 5 0 015-5h2a5 5 0 015 5v1" },
  { href: "/ekstratimer", label: "Ekstratimer", icon: "M9 7h6m-6 4h6m-6 4h4M5 3h14v18H5z" },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
