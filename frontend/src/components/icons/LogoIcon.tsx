export default function LogoIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#06080F" stroke="#00D4B8" strokeWidth="1.5" />
      <path d="M12 28L20 10L28 28" stroke="#00D4B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 22H25" stroke="#00D4B8" strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="14" r="2" fill="#00D4B8" />
    </svg>
  );
}
