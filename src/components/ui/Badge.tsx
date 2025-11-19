export default function Badge({ children, brand }: { children: React.ReactNode; brand?: boolean }) {
  return <span className={`badge ${brand ? 'badge--brand' : ''}`}>{children}</span>;
}
