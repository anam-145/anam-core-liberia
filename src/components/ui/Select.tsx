import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helper?: string;
  id?: string;
  children: React.ReactNode;
}

export default function Select({ label, helper, id, children, ...props }: SelectProps) {
  const generatedId = React.useId();
  const selectId = id || generatedId;
  return (
    <div>
      {label && (
        <label htmlFor={selectId} className="label">
          {label}
        </label>
      )}
      <select id={selectId} className="select" {...props}>
        {children}
      </select>
      {helper && <div className="helper">{helper}</div>}
    </div>
  );
}
