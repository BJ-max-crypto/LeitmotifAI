import Image from "next/image";

export function BrandLogo({
  size = 36,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/logo.png"
      alt="Leitmotif"
      width={size}
      height={size}
      className={`shrink-0 rounded-md ${className}`.trim()}
      priority
    />
  );
}
