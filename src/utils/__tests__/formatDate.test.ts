import { formatDate } from '../formatDate';

describe('formatDate function tests', () => {
  const testDate = new Date('2024-01-15T12:00:00Z');

  test('should format date in short format (YYYY-MM-DD)', () => {
    expect(formatDate(testDate, 'short')).toBe('2024-01-15');
    expect(formatDate('2024-01-15', 'short')).toBe('2024-01-15');
  });

  test('should format date in long format', () => {
    expect(formatDate(testDate, 'long')).toBe('January 15, 2024');
  });

  test('should format date in ISO format', () => {
    expect(formatDate(testDate, 'iso')).toBe('2024-01-15T12:00:00.000Z');
  });

  test('should use short format as default', () => {
    expect(formatDate(testDate)).toBe('2024-01-15');
  });

  test('should handle invalid dates', () => {
    expect(formatDate('invalid-date')).toBe('Invalid Date');
    expect(formatDate('2024-13-45')).toBe('Invalid Date');
  });
});
