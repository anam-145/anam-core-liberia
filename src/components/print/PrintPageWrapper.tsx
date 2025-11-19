'use client';

import type { ReactNode } from 'react';

interface PrintPageWrapperProps {
  children: ReactNode;
}

export default function PrintPageWrapper({ children }: PrintPageWrapperProps) {
  return (
    <>
      <style jsx global>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }

          @page {
            size: A4 portrait;
            margin: 0;
          }

          .no-print {
            display: none !important;
          }
        }

        @media screen {
          body {
            background-color: #f5f5f5;
          }
        }
      `}</style>

      <div className="flex flex-col items-center min-h-screen bg-gray-100 p-5">
        <div className="fixed top-5 right-5 z-50 flex gap-3 no-print">
          <button className="btn btn--primary" onClick={() => window.print()}>
            인쇄하기
          </button>
          <button className="btn btn--secondary" onClick={() => window.close()}>
            닫기
          </button>
        </div>

        {children}
      </div>
    </>
  );
}
