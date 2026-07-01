import type { ComponentType, SVGProps } from "react";
import { Settings } from "lucide-react";
import {
  OversiktIcon,
  FravaerIcon,
  AnsatteIcon,
  TimeplanIcon,
  VikarerIcon,
  HistorikkIcon,
} from "./nav-icons";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Oversikt", icon: OversiktIcon },
  { href: "/fravaer", label: "Registrer fravær", icon: FravaerIcon },
  { href: "/laerere", label: "Ansatte", icon: AnsatteIcon },
  { href: "/timeplan", label: "Timeplan", icon: TimeplanIcon },
  { href: "/vikarer", label: "Vikarer", icon: VikarerIcon },
  { href: "/ekstratimer", label: "Historikk", icon: HistorikkIcon },
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
