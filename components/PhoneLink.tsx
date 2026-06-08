import { telHref } from "@/lib/format";

/** A tappable phone number (works as a tel: link on phones). */
export function PhoneLink({
  phone,
  className = "",
}: {
  phone: string | null | undefined;
  className?: string;
}) {
  const href = telHref(phone);
  if (!href || !phone) return <span className="text-muted">—</span>;
  return (
    <a
      href={href}
      className={`tabular text-brand-700 hover:text-brand-900 hover:underline ${className}`}
    >
      {phone}
    </a>
  );
}
