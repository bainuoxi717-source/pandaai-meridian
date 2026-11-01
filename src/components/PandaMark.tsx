export function PandaMark({ size = 34, className = '' }: { size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M10 14C4 14 3 5 9 4C14 3 17 8 16 12M38 14C44 14 45 5 39 4C34 3 31 8 32 12" fill="currentColor" opacity=".82" />
    <path d="M24 8C36 8 42 16 40 28C38 39 31 44 24 44C17 44 10 39 8 28C6 16 12 8 24 8Z" stroke="currentColor" strokeWidth="2.2" />
    <path d="M12 22C13 16 20 16 21 22C22 28 17 31 14 28C12 27 11 24 12 22ZM36 22C35 16 28 16 27 22C26 28 31 31 34 28C36 27 37 24 36 22Z" fill="currentColor" />
    <path d="M16 20L19 24M32 20L29 24" stroke="#14252c" strokeWidth="2" strokeLinecap="round" />
    <path d="M21 32C22 30 26 30 27 32C26 35 22 35 21 32Z" fill="currentColor" />
    <path d="M24 34V37M24 37C21 39 19 38 18 36M24 37C27 39 29 38 30 36" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>;
}
