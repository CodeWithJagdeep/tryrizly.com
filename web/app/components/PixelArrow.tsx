interface Props {
  direction?: 'right' | 'left';
  className?: string;
}

export function PixelArrow({ direction = 'right', className }: Props) {
  if (direction === 'left') {
    return (
      <svg
        viewBox="0 0 30 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <path d="M16.9995 5L20.9995 5V9L16.9995 9L16.9995 5Z" fill="currentColor" />
        <path d="M12.9995 9L16.9995 9V13L12.9995 13L12.9995 9Z" fill="currentColor" />
        <path d="M8.99951 13H12.9995L12.9995 17L8.99951 17L8.99951 13Z" fill="currentColor" />
        <path d="M12.9995 17H16.9995L16.9995 21H12.9995L12.9995 17Z" fill="currentColor" />
        <path d="M16.9995 21H20.9995L20.9995 25H16.9995V21Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 30 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M12.9995 25H8.99951V21H12.9995V25Z" fill="currentColor" />
      <path d="M16.9995 21H12.9995V17H16.9995V21Z" fill="currentColor" />
      <path d="M20.9995 17H16.9995V13H20.9995V17Z" fill="currentColor" />
      <path d="M16.9995 13H12.9995V9H16.9995V13Z" fill="currentColor" />
      <path d="M12.9995 9H8.99951V5H12.9995V9Z" fill="currentColor" />
    </svg>
  );
}
