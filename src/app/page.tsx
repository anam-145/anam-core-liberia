import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8 text-center">ANAM Core Liberia</h1>
        <div className="text-center">
          <p className="mb-8 text-lg text-gray-600">
            Multi-service platform for decentralized identity, wallet, and custody infrastructure
          </p>
          <Link
            href="/admin"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-block"
          >
            Go to Admin Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
