/**
 * 날짜를 지정된 형식으로 포맷팅하는 유틸리티 함수
 * @param date - 포맷팅할 날짜
 * @param format - 날짜 형식 ('short' | 'long' | 'iso')
 * @returns 포맷팅된 날짜 문자열
 */
export function formatDate(date: Date | string, format: 'short' | 'long' | 'iso' = 'short'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }

  switch (format) {
    case 'short':
      // YYYY-MM-DD
      return dateObj.toISOString().split('T')[0] || '';
    case 'long':
      // January 1, 2024
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    case 'iso':
      return dateObj.toISOString();
    default:
      return dateObj.toISOString().split('T')[0] || '';
  }
}
