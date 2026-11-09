import React from 'react';
import { Shirt, Scissors, Footprints, Sparkles, Watch, Tag } from 'lucide-react';

export default function ProductImagePlaceholder({
  category = 'other',
  productName = 'Fashion Apparel',
  articleId = '',
  colorName = 'Neutral',
  className = 'w-full h-full',
}) {
  const normCat = (category || '').toLowerCase();

  const getCategoryIcon = () => {
    if (normCat.includes('upper') || normCat.includes('shirt') || normCat.includes('top') || normCat.includes('jacket') || normCat.includes('sweater')) {
      return <Shirt className="w-8 h-8 text-aura-muted stroke-[1.25]" />;
    }
    if (normCat.includes('lower') || normCat.includes('pant') || normCat.includes('trouser') || normCat.includes('skirt')) {
      return <Scissors className="w-8 h-8 text-aura-muted stroke-[1.25]" />;
    }
    if (normCat.includes('shoe') || normCat.includes('boot') || normCat.includes('footwear')) {
      return <Footprints className="w-8 h-8 text-aura-muted stroke-[1.25]" />;
    }
    if (normCat.includes('access') || normCat.includes('bag') || normCat.includes('belt') || normCat.includes('hat')) {
      return <Watch className="w-8 h-8 text-aura-muted stroke-[1.25]" />;
    }
    return <Sparkles className="w-8 h-8 text-aura-muted stroke-[1.25]" />;
  };

  return (
    <div
      className={`relative flex flex-col items-center justify-center p-4 bg-gradient-to-b from-aura-cream/80 to-aura-cream text-aura-muted select-none overflow-hidden ${className}`}
      role="img"
      aria-label={`${productName} placeholder`}
    >
      {/* Background Architectural Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #28231F 1px, transparent 0)',
          backgroundSize: '16px 16px',
        }}
      />

      {/* Elegant Stylized Garment Icon */}
      <div className="relative w-14 h-14 rounded-2xl bg-white/80 backdrop-blur-xs border border-aura-espresso/8 shadow-aura-subtle flex items-center justify-center mb-3">
        {getCategoryIcon()}
      </div>

      {/* Minimal Label */}
      <div className="text-center px-2 z-10 space-y-0.5">
        <span className="text-[9px] font-mono uppercase tracking-[0.22em] text-aura-olive block">
          {category ? category.replace('_', ' ') : 'Piece'}
        </span>
        <span className="text-xs font-serif font-medium text-aura-espresso line-clamp-1 max-w-[140px] mx-auto">
          {productName}
        </span>
        {articleId && (
          <span className="text-[9px] font-mono text-aura-muted block">
            #{articleId}
          </span>
        )}
      </div>

      {/* Subtle Bottom Accent Tag */}
      <div className="absolute bottom-2.5 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/70 text-[9px] font-mono text-aura-muted border border-aura-espresso/8">
        <Tag className="w-2.5 h-2.5 text-aura-olive" />
        <span>{colorName || 'Neutral'}</span>
      </div>
    </div>
  );
}
