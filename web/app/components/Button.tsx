import { PixelArrow } from './PixelArrow';

interface ButtonProps {
  href?: string;
  variant?: 'primary' | 'ghost' | 'accent';
  children: React.ReactNode;
  className?: string;
  showArrows?: boolean;
  onClick?: () => void;
  target?: string;
  rel?: string;
}

const variantClasses: Record<string, string> = {
  primary: 'btn btn-primary',
  ghost: 'btn btn-ghost',
  accent: 'btn btn-accent',
};

export function Button({
  href,
  variant = 'primary',
  children,
  className = '',
  showArrows = true,
  onClick,
  target,
  rel,
}: ButtonProps) {
  const baseClasses = `${variantClasses[variant]} ${className}`;

  const content = showArrows ? (
    <span className="group relative flex items-center overflow-hidden">
      {/* Left arrow — slides in from off-screen left on hover */}
      <span
        className="absolute left-0 -translate-x-7 opacity-0 transition-all duration-300 will-change-transform group-hover:translate-x-0 group-hover:opacity-100 group-hover:delay-100"
        aria-hidden="true"
      >
        <PixelArrow direction="right" className="h-4 w-4" />
      </span>

      {/* Text content — shifts right on hover */}
      <span className="transition-transform duration-300 will-change-transform group-hover:translate-x-6 group-hover:delay-75">
        {children}
      </span>

      {/* Right arrow — shifts further right on hover */}
      <span className="ml-1 transition-transform duration-300 will-change-transform group-hover:translate-x-7">
        <PixelArrow direction="right" className="h-4 w-4" />
      </span>
    </span>
  ) : (
    children
  );

  if (href) {
    return (
      <a
        href={href}
        className={baseClasses}
        onClick={onClick}
        target={target}
        rel={rel}
      >
        {content}
      </a>
    );
  }

  return (
    <button className={baseClasses} onClick={onClick}>
      {content}
    </button>
  );
}
