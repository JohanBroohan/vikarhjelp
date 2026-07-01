import {
  Home,
  CalendarPlus,
  Users,
  CalendarDays,
  UserCheck,
  ClipboardList,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Oversikt", icon: Home },
  { href: "/fravaer", label: "Registrer fravær", icon: CalendarPlus },
  { href: "/laerere", label: "Ansatte", icon: Users },
  { href: "/timeplan", label: "Timeplan", icon: CalendarDays },
  { href: "/vikarer", label: "Vikarer", icon: UserCheck },
  { href: "/ekstratimer", label: "Historikk", icon: ClipboardList },
];

// Settings sits separately at the bottom of the sidebar (above "Logg ut").
export const SETTINGS_ITEM: NavItem = {
  href: "/innstillinger",
  label: "Innstillinger",
  icon: Settings,
};

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
