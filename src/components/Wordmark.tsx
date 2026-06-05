type Size = 'sm' | 'md' | 'lg';

const sizeClass: Record<Size, string> = {
  sm: 'text-sm',
  md: 'text-xl',
  lg: 'text-4xl',
};

export function Wordmark({ size = 'md' }: { size?: Size }) {
  return (
    <span className={`${sizeClass[size]} font-serif font-medium leading-none`}>
      <span className="text-brand font-serif">Pflege</span>
      <span className="text-accent">·</span>
      <span className="text-brand font-serif">Atlas</span>
    </span>
  );
}
