import React from 'react';

export default function AuraLogo({
  variant = 'dark',
  size = 'md',
  showWordmark = true,
  className = '',
}) {
  const isLight = variant === 'light';
  const primaryColor = isLight ? '#F8F6F1' : '#28231F';
  const accentColor = isLight ? '#D8C9B2' : '#777B61';

  // Sizing matrix
  const dimensions = {
    sm: { symbol: 24, text: 'text-lg tracking-[0.24em]' },
    md: { symbol: 32, text: 'text-2xl tracking-[0.28em]' },
    lg: { symbol: 44, text: 'text-3xl tracking-[0.32em]' },
  }[size] || { symbol: 32, text: 'text-2xl tracking-[0.28em]' };

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Precision Architectural "A" Monogram */}
      <svg
        width={dimensions.symbol}
        height={dimensions.symbol}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-300 hover:scale-105"
        aria-hidden="true"
      >
        {/* Outer Architectural Frame */}
        <rect
          x="1"
          y="1"
          width="34"
          height="34"
          rx="2"
          stroke={primaryColor}
          strokeWidth="1.2"
          strokeOpacity={isLight ? '0.35' : '0.2'}
        />
        {/* Abstract Architectural 'A' Monogram */}
        <path
          d="M18 7L8 28H12.4L14.8 22.4H21.2L23.6 28H28L18 7Z"
          fill={primaryColor}
        />
        {/* Floating Apex Accent Counter */}
        <polygon
          points="18,12.8 20.3,18.8 15.7,18.8"
          fill={isLight ? '#28231F' : '#F8F6F1'}
        />
        {/* Minimalist Horizon Line */}
        <line
          x1="12"
          y1="25"
          x2="24"
          y2="25"
          stroke={accentColor}
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>

      {/* Pure Editorial Serif Wordmark: A U R A */}
      {showWordmark && (
        <span
          className={`font-serif font-light uppercase transition-colors duration-200 ${dimensions.text}`}
          style={{ color: primaryColor }}
        >
          AURA
        </span>
      )}
    </div>
  );
}
