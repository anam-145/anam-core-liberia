'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface PaperVoucherCardProps {
  user: {
    name: string;
    did: string | null;
    walletAddress: string | null;
    kycFacePath: string | null;
  };
  payload: unknown;
}

export default function PaperVoucherCard({ user, payload }: PaperVoucherCardProps) {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const generateQR = async () => {
      if (qrCanvasRef.current && payload) {
        try {
          await QRCode.toCanvas(qrCanvasRef.current, JSON.stringify(payload), {
            width: 300,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF',
            },
            errorCorrectionLevel: 'M',
          });
        } catch (err) {
          console.error('Failed to generate QR code:', err);
        }
      }
    };

    generateQR();
  }, [payload]);

  return (
    <div className="voucher-card">
      <style jsx>{`
        .voucher-card {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          background: white;
          font-family: 'VT323', monospace;
          color: #000;
          font-size: 20px;
          line-height: 1.4;
          display: flex;
          flex-direction: column;
        }

        .card-header {
          background-color: #000;
          color: white;
          padding: 12px 20px;
          text-align: center;
          border-bottom: 1px solid #000;
        }

        .card-header h2 {
          margin: 0;
          font-size: 1.5em;
          font-weight: normal;
          text-transform: uppercase;
        }

        .card-header p {
          margin: 5px 0 0;
          font-size: 1.1em;
        }

        .card-body {
          display: flex;
          padding: 25px;
          gap: 25px;
          align-items: flex-start;
        }

        .left-panel {
          flex: 0 0 120px;
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .middle-panel {
          flex: 1;
          padding: 0 10px;
        }

        .placeholder-box {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          border: 2px dashed #aaa;
          background-color: #f9f9f9;
          color: #999;
          font-size: 0.9em;
          text-align: center;
          box-sizing: border-box;
          line-height: 1.3;
        }

        .logo-box {
          width: 120px;
          height: 60px;
          background: white;
          border: 2px solid #0066cc;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }

        .logo-box img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .photo-box {
          width: 120px;
          height: 150px;
          overflow: hidden;
          border: 2px solid #333;
          background-color: #f0f0f0;
        }

        .photo-box img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .details p {
          margin: 0 0 15px 0;
          line-height: 1.3;
        }

        .details .label {
          font-size: 0.9em;
          color: #666;
        }

        .details .value {
          font-size: 1.1em;
          color: #000;
          word-break: break-all;
        }

        .qr-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 25px;
          border-top: 1px solid #ccc;
        }

        .qr-container {
          background: white;
          padding: 20px;
          border: 2px solid #333;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .qr-label {
          font-size: 1.2em;
          font-weight: bold;
          color: #333;
          margin-top: 8px;
        }

        .card-footer {
          background-color: #f0f0f0;
          border-top: 1px solid #ccc;
          padding: 15px 20px;
          text-align: center;
          font-size: 1em;
          color: #333;
          margin-top: auto;
        }

        @media print {
          .voucher-card {
            width: 100%;
            min-height: auto;
          }
        }
      `}</style>

      <div className="card-header">
        <h2>Participant Payment Voucher • Liberia</h2>
        <p>UNITED NATIONS DEVELOPMENT PROGRAMME</p>
      </div>

      <div className="card-body">
        <div className="left-panel">
          <div className="logo-box">
            {/* eslint-disable-next-line @next/next/no-img-element -- Native img is required for print pages */}
            <img src="/img/undp-logo.png" alt="UNDP Logo" />
          </div>
          <div className="photo-box">
            {user.kycFacePath ? (
              // eslint-disable-next-line @next/next/no-img-element -- Native img is required for print pages
              <img src={`/api/admin/files?path=${encodeURIComponent(user.kycFacePath)}`} alt="User photo" />
            ) : (
              <div className="placeholder-box" style={{ width: '100%', height: '100%' }}>
                PHOTO
                <br />
                120x150px
              </div>
            )}
          </div>
        </div>

        <div className="middle-panel">
          <div className="details">
            <p>
              <span className="label">Participant Name</span>
              <br />
              <span className="value">{user.name}</span>
            </p>
            <p>
              <span className="label">Digital Identity (DID)</span>
              <br />
              <span className="value">{user.did || '[DID not assigned]'}</span>
            </p>
            <p>
              <span className="label">Wallet Address</span>
              <br />
              <span className="value">{user.walletAddress || '[Wallet not assigned]'}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="qr-section">
        <div className="qr-container">
          <canvas ref={qrCanvasRef} />
          <span className="qr-label">UNIFIED QR CODE</span>
        </div>
      </div>

      <div className="card-footer">Keep this document secure | UNDP Liberia DSA Program</div>
    </div>
  );
}
