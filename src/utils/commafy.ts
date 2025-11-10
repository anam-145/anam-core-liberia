/**
 * 숫자에 천 단위로 콤마를 추가하는 유틸리티 함수
 * @param num - 포맷팅할 숫자
 * @returns 콤마가 추가된 문자열
 */
export default function commafy(num: number): string {
  // 숫자를 문자열로 변환
  const numStr = num.toString();

  // 정규식으로 3자리마다 콤마 추가
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
