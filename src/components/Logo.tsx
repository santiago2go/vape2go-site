import Image from "next/image";
import Link from "next/link";

export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <Link href="/" className="flex items-center gap-2 shrink-0">
      <Image
        src="/logo.jpeg"
        alt="Vape 2 Go"
        width={size}
        height={size}
        className="rounded-lg object-contain"
        priority
      />
      <span
        className="font-bold text-white hidden sm:block"
        style={{ fontFamily: "var(--font-fredoka)", fontSize: size * 0.55 }}
      >
        Vape 2 Go
      </span>
    </Link>
  );
}
