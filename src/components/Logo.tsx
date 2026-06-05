import Image from 'next/image';

export function Logo({ priority = false }: { priority?: boolean }) {
  return (
    <Image
      src="/logo-compass-snake-transparent.png"
      alt="PflegeAtlas"
      width={1536}
      height={1024}
      priority={priority}
      className="h-40 w-auto"
    />
  );
}
