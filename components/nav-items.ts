import type { ComponentType, SVGProps } from "react";
import { Settings } from "lucide-react";
import {
  OversiktLine,
  OversiktFilled,
  FravaerLine,
  FravaerFilled,
  AnsatteLine,
  AnsatteFilled,
  TimeplanLine,
  TimeplanFilled,
  VikarerLine,
  VikarerFilled,
  HistorikkLine,
  HistorikkFilled,
} from "./nav-icons";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export interface NavItem {
  href: string;
  label: string;
  icon: Icon; // inactive (line)
  activeIcon?: Icon; // active (filled)
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Oversikt", icon: OversiktLine, activeIcon: OversiktFilled },
  { href: "/fravaer", label: "Registrer fravær", icon: FravaerLine, activeIcon: FravaerFilled },
  { href: "/laerere", label: "Ansatte", icon: AnsatteLine, activeIcon: AnsatteFilled },
  { href: "/timeplan", label: "Timeplan", icon: TimeplanLine, activeIcon: TimeplanFilled },
  { href: "/vikarer", label: "Vikarer", icon: VikarerLine, activeIcon: VikarerFilled },
  { href: "/ekstratimer", label: "Historikk", icon: HistorikkLine, activeIcon: HistorikkFilled },
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
