// Shown instantly while a dynamic page's data loads. Its presence also lets
// Next.js prefetch these dynamic routes (up to this boundary), so navigating
// between screens feels immediate instead of frozen.
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div
        role="status"
        aria-label="Laster"
        className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-brand-600"
      />
    </div>
  );
}
