// components/Loader.tsx
'use client';

import { CSSProperties } from 'react';

interface LoaderProps {
  size?: number; // Size in pixels (default: 48)
  color?: string; // Optional color override (default: gradient)
  className?: string; // Additional classes
  style?: CSSProperties; // Inline styles
}

export default function Loader({ size = 48, color, className = '', style }: LoaderProps) {
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{ width: size, height: size, ...style }}
    >
      <style jsx>{`
        .orbital-spinner {
          position: relative;
          width: 100%;
          height: 100%;
        }
        .orbital-spinner::before,
        .orbital-spinner::after {
          content: '';
          position: absolute;
          border-radius: 50%;
          animation: pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .orbital-spinner::before {
          width: 60%;
          height: 60%;
          top: 20%;
          left: 20%;
          background: ${color || 'linear-gradient(45deg, #9333ea, #06b6d4)'};
          animation-delay: -0.6s;
        }
        .orbital-spinner::after {
          width: 40%;
          height: 40%;
          top: 30%;
          left: 30%;
          background: ${color || 'linear-gradient(45deg, #d946ef, #22d3ee)'};
        }
        @keyframes pulse {
          0%,
          100% {
            transform: scale(0.8);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.2);
            opacity: 1;
          }
        }
      `}</style>
      <div className="orbital-spinner" />
    </div>
  );
}