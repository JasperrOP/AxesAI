import React from 'react';

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'standard' | 'accent';
  className?: string;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  variant = 'standard',
  className = '',
  ...props
}) => {
  const baseClass = variant === 'accent' ? 'glass-btn-accent' : 'glass-btn';
  return (
    <button
      className={`${baseClass} px-5 py-3 text-sm font-medium transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default GlassButton;
