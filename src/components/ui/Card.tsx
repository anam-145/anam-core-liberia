import React from 'react';

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="card" style={style}>
      {children}
    </div>
  );
}
export function CardHeader({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="card__header" style={style}>
      {children}
    </div>
  );
}
export function CardBody({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="card__body" style={style}>
      {children}
    </div>
  );
}
export function CardFooter({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="card__footer" style={style}>
      {children}
    </div>
  );
}
