// Logo 컴포넌트 - /public/logo.svg 파일을 사용합니다
import Image from 'next/image';

export default function Logo({ size = 40 }: { size?: number }) {
  return <Image src="/logo.svg" width={size} height={size} alt="ANAM Logo" />;
}
