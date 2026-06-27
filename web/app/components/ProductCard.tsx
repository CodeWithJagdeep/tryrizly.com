import { PixelArrow } from './PixelArrow';

interface ProductCardProps {
  href: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function ProductCard({
  href,
  title,
  description,
  icon,
  className = '',
}: ProductCardProps) {
  return (
    <a
      href={href}
      className={`group/link relative flex items-center gap-4 border-t border-border-primary p-4 transition-colors duration-300 hover:bg-surface-brand-secondary ${className}`}
    >
      {/* Left arrow — slides in from off-screen on hover */}
      <span
        className="absolute left-4 -translate-x-10 opacity-0 transition-all duration-300 delay-50 will-change-transform group-hover/link:translate-x-0 group-hover/link:opacity-100"
        aria-hidden="true"
      >
        <PixelArrow direction="right" className="h-4 w-4" />
      </span>

      {/* Icon */}
      {icon && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center transition-transform duration-300 will-change-transform group-hover/link:translate-x-8">
          {icon}
        </span>
      )}

      {/* Text content */}
      <span className="flex min-w-0 flex-1 flex-col transition-transform duration-300 will-change-transform group-hover/link:translate-x-8">
        <span className="text-h6 text-text-primary">{title}</span>
        {description && (
          <span className="text-body-small text-text-tertiary">
            {description}
          </span>
        )}
      </span>

      {/* Right arrow */}
      <span className="shrink-0 transition-transform duration-300 will-change-transform group-hover/link:translate-x-10">
        <PixelArrow direction="right" className="h-4 w-4 text-text-tertiary" />
      </span>
    </a>
  );
}
