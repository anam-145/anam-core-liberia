'use client';
import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export default function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  const classes = ['btn', `btn--${variant}`, size === 'sm' ? 'btn--sm' : size === 'lg' ? 'btn--lg' : '', className]
    .filter(Boolean)
    .join(' ');
  return <button className={classes} {...props} />;
}
