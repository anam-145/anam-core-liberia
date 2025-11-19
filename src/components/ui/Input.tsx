import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helper?: string;
  id?: string;
}

export default function Input({ label, helper, id, ...props }: InputProps) {
  const generatedId = React.useId();
  const inputId = id || generatedId;
  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="label">
          {label}
        </label>
      )}
      <input id={inputId} className="input" {...props} />
      {helper && <div className="helper">{helper}</div>}
    </div>
  );
}
