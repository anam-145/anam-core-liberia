'use client';

import { useState } from 'react';
import commafy from '@/utils/commafy';

export default function InputTest() {
  const [inputValue, setInputValue] = useState('');
  const [formattedValue, setFormattedValue] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(inputValue, 10);
    if (!isNaN(num)) {
      setFormattedValue(commafy(num));
    }
  };

  return (
    <div className="p-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="number-input" className="block text-sm font-medium mb-1">
            Enter a number:
          </label>
          <input
            id="number-input"
            data-testid="number-input"
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="border rounded px-3 py-2 w-full"
            placeholder="Enter a number"
          />
        </div>
        <button
          type="submit"
          data-testid="submit-button"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Format Number
        </button>
      </form>

      {formattedValue !== null && (
        <div className="mt-4 p-3 bg-gray-100 rounded">
          <span data-testid="formatted-value">Value : {formattedValue}</span>
        </div>
      )}
    </div>
  );
}
