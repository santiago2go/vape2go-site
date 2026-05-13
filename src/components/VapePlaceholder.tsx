export default function VapePlaceholder({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Background */}
      <rect width="200" height="200" rx="16" fill="#1a0a2e" />

      {/* Smoke puffs */}
      <ellipse cx="80" cy="55" rx="22" ry="16" fill="#7c3aed" opacity="0.3" />
      <ellipse cx="100" cy="38" rx="16" ry="12" fill="#7c3aed" opacity="0.2" />
      <ellipse cx="120" cy="50" rx="18" ry="13" fill="#7c3aed" opacity="0.25" />
      <ellipse cx="100" cy="65" rx="28" ry="18" fill="#7c3aed" opacity="0.35" />

      {/* Vape device body */}
      <rect x="83" y="88" width="34" height="88" rx="10" fill="#2d1b4e" />
      <rect x="83" y="88" width="34" height="88" rx="10" stroke="#7c3aed" strokeWidth="1.5" />

      {/* LED strip on device */}
      <rect x="87" y="140" width="26" height="4" rx="2" fill="#39ff14" opacity="0.8" />

      {/* Screen/display area */}
      <rect x="88" y="100" width="24" height="16" rx="4" fill="#111827" />
      <rect x="88" y="100" width="24" height="16" rx="4" stroke="#39ff14" strokeWidth="0.8" opacity="0.6" />

      {/* Mouthpiece */}
      <rect x="90" y="78" width="20" height="12" rx="6" fill="#3d2060" stroke="#7c3aed" strokeWidth="1" />

      {/* Neon green accent line */}
      <line x1="83" y1="130" x2="117" y2="130" stroke="#39ff14" strokeWidth="1" opacity="0.5" />

      {/* Bottom indicator dots */}
      <circle cx="95" cy="162" r="2.5" fill="#39ff14" opacity="0.7" />
      <circle cx="100" cy="162" r="2.5" fill="#7c3aed" opacity="0.5" />
      <circle cx="105" cy="162" r="2.5" fill="#39ff14" opacity="0.7" />
    </svg>
  );
}
