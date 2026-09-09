/** The Bodha AI mark: a "B" monogram with a profit dot. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-label="Bodha AI logo">
      <rect width="64" height="64" rx="4" fill="#141814" />
      <path
        d="M18 44V20h11.5c5 0 8 2.5 8 6.4 0 2.7-1.5 4.6-3.9 5.4 3 .7 4.9 2.9 4.9 6 0 4.3-3.3 6.2-8.6 6.2H18Zm6.1-14.2h4c2 0 3.2-.9 3.2-2.5s-1.2-2.4-3.2-2.4h-4v4.9Zm0 9.7h4.6c2.2 0 3.4-1 3.4-2.7 0-1.7-1.2-2.6-3.4-2.6h-4.6v5.3Z"
        fill="#fff"
      />
      <circle cx="45" cy="24" r="5" fill="#0d6b4c" />
    </svg>
  );
}
