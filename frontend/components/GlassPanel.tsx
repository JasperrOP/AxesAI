import React from 'react';

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'dark' | 'light';
  className?: string;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  variant = 'dark',
  className = '',
  ...props
}) => {
  const baseClass = variant === 'light' ? 'glass-panel-light' : 'glass-panel';
  return (
    <div className={`${baseClass} p-6 ${className}`} {...props}>
      {children}
    </div>
  );
};

export default GlassPanel;
