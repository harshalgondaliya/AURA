import React, { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, Layers, Heart, Share2, Check, ShieldCheck, Tag, Ruler, X } from 'lucide-react';
import ProductImagePlaceholder from './ProductImagePlaceholder';
import ProductGenderLabel from './ProductGenderLabel';
import { formatProductPrice } from '../utils/formatters';
import { getSizeSystemLabel, SIZE_CHARTS } from '../utils/sizeFormatters';
import { useWishlist } from '../context/WishlistContext';

export default function ProductDetailView({
  product,
  onBack,
  onSimilarClick,
  onOutfitClick,
  onLikeClick,
  isLiked = false,
}) {
  const [imageError, setImageError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSizeGuide, setShowSizeGuide] = useState(false);

  const [selectedSize, setSelectedSize] = useState(() => {
    return product?.selected_size || (Array.isArray(product?.sizes) && product.sizes.length > 0 ? product.sizes[0] : '');
  });

  useEffect(() => {
    if (product) {
      setSelectedSize(product.selected_size || (Array.isArray(product.sizes) && product.sizes.length > 0 ? product.sizes[0] : ''));
    }
  }, [product]);

  // Consume centralized WishlistContext with safe fallback
  let wishlistCtx = null;
  try {
    wishlistCtx = useWishlist();
  } catch {
    // Rendered outside provider
  }

  const isSaved = wishlistCtx
    ? wishlistCtx.isWishlisted(product?.article_id)
    : isLiked;

  const handleWishlistToggle = () => {
    const itemWithChoice = { ...product, selected_size: selectedSize };
    if (wishlistCtx) {
      wishlistCtx.toggleWishlist(itemWithChoice, undefined, selectedSize);
    }
    if (onLikeClick) {
      onLikeClick(itemWithChoice, !isSaved);
    }
  };

  const handleOutfitAction = () => {
    if (onOutfitClick) {
      onOutfitClick({ ...product, selected_size: selectedSize });
    }
  };

  if (!product) return null;

  // Format price in Indian Rupees (₹)
  const priceDisplay = formatProductPrice(product);

  const categoryLabel = product.standard_category
    ? product.standard_category.replace('_', ' ')
    : 'Fashion Garment';

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.origin + `?item=${product.article_id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasValidImage = product.has_image && !imageError;
  const imageSrc = `/images/${product.article_id.slice(0, 3)}/${product.article_id}.jpg`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-200 space-y-12">
      {/* Top Breadcrumb & Return Bar */}
      <div className="flex items-center justify-between border-b border-aura-espresso/8 pb-4 text-xs">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-aura-muted hover:text-aura-espresso font-medium transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to Collection</span>
        </button>

        <div className="flex items-center gap-3 text-aura-muted">
          <span className="font-mono text-[10px] uppercase tracking-widest">
            Item #{product.article_id}
          </span>
          <button
            onClick={handleShare}
            className="p-1.5 rounded-full hover:bg-aura-cream transition-colors text-aura-espresso"
            title="Share product link"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-aura-olive" /> : <Share2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Dedicated 2-Column Editorial Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
        {/* LEFT COLUMN: Expansive Product Imagery (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-white border border-aura-espresso/10 shadow-aura-card">
            {hasValidImage ? (
              <img
                src={imageSrc}
                alt={product.prod_name}
                onError={() => setImageError(true)}
                className="w-full h-full object-cover object-top"
              />
            ) : (
              <ProductImagePlaceholder
                category={product.standard_category}
                productName={product.prod_name}
                articleId={product.article_id}
                colorName={product.colour_group_name}
              />
            )}

            {/* Category & Gender Floating Badges */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.22em] bg-white/90 backdrop-blur-md text-aura-espresso shadow-xs border border-aura-espresso/5">
                {categoryLabel}
              </span>
              <ProductGenderLabel product={product} />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Garment Narrative, Attributes & Actions (5 cols) */}
        <div className="lg:col-span-5 space-y-8">
          {/* Header & Title */}
          <div className="space-y-2 border-b border-aura-espresso/8 pb-6">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-aura-olive flex-wrap">
              <span>{product.product_type_name || 'Apparel'}</span>
              <span>&bull;</span>
              <span>{product.product_group_name || 'Garment'}</span>
              <span>&bull;</span>
              <ProductGenderLabel product={product} />
            </div>

            <h1 className="text-3xl sm:text-5xl font-serif font-normal text-aura-espresso tracking-tight leading-tight">
              {product.prod_name}
            </h1>

            <div className="pt-2 flex items-baseline gap-4">
              <span className="text-2xl font-serif font-bold text-aura-espresso">
                {priceDisplay}
              </span>
              <span className="text-[11px] font-mono uppercase tracking-wider text-aura-olive bg-aura-cream px-2.5 py-0.5 rounded-full">
                Available in Collection
              </span>
            </div>
          </div>

          {/* Description Narrative */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-mono uppercase tracking-[0.2em] text-aura-muted">
              Design & Silhouette
            </h3>
            <p className="text-sm font-normal text-aura-espresso leading-relaxed bg-white/70 p-5 rounded-2xl border border-aura-espresso/8 shadow-aura-subtle">
              {product.detail_desc && product.detail_desc !== 'nan'
                ? product.detail_desc
                : `${product.prod_name} tailored from selected fabric in ${product.colour_group_name}. Crafted with balanced proportions for effortless daily layering and versatile wardrobe ensemble pairings.`}
            </p>
          </div>

          {/* Color & Slot Specifications */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 bg-white rounded-2xl border border-aura-espresso/8 shadow-aura-subtle space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-aura-muted block">
                Primary Tone
              </span>
              <div className="flex items-center gap-2 pt-0.5">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-aura-espresso/15 inline-block"
                  style={{
                    backgroundColor:
                      product.colour_group_name === 'White'
                        ? '#ffffff'
                        : product.colour_group_name === 'Black'
                        ? '#1C1917'
                        : product.colour_group_name === 'Dark Blue'
                        ? '#1e3a8a'
                        : product.colour_group_name === 'Light Beige'
                        ? '#f5f5dc'
                        : product.colour_group_name === 'Grey'
                        ? '#9ca3af'
                        : '#D8C9B2',
                  }}
                />
                <span className="font-medium text-aura-espresso">
                  {product.colour_group_name || 'Neutral'}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-white rounded-2xl border border-aura-espresso/8 shadow-aura-subtle space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-aura-muted block">
                Wardrobe Slot
              </span>
              <span className="font-medium text-aura-espresso capitalize block pt-0.5">
                {categoryLabel}
              </span>
            </div>
          </div>

          {/* Dedicated Size Selection Section */}
          <div className="space-y-3">
            {(!product.sizes || product.sizes.length === 0 || product.availability_status === 'unavailable') ? (
              <div className="p-4 rounded-2xl bg-white border border-aura-espresso/10 space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-aura-muted block font-medium">
                  Sizing Metadata
                </span>
                <p className="text-xs font-serif font-medium text-aura-espresso">
                  Size details unavailable
                </p>
                <p className="text-[11px] text-aura-muted font-normal leading-relaxed">
                  Detailed sizing metadata is not documented for this archival garment. Please refer to standard proportions.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-white rounded-2xl border border-aura-espresso/8 shadow-aura-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-aura-muted font-medium">
                      Select Size
                    </span>
                    <span className="text-[9px] font-mono uppercase tracking-wider text-aura-olive bg-aura-cream px-2 py-0.5 rounded-full border border-aura-espresso/10">
                      {getSizeSystemLabel(product.size_type, product.size_system)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowSizeGuide(true)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-mono text-aura-olive hover:text-aura-espresso transition-colors font-medium"
                    title="View dimension specifications"
                  >
                    <Ruler className="w-3.5 h-3.5" />
                    <span>Size Guide</span>
                  </button>
                </div>

                {/* Size Pills */}
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Available Garment Sizes">
                  {product.sizes.map((sz) => {
                    const isSelected = selectedSize === sz;
                    return (
                      <button
                        key={sz}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onClick={() => setSelectedSize(sz)}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            setSelectedSize(sz);
                          }
                        }}
                        className={`min-w-[44px] h-10 px-3 rounded-xl text-xs font-mono font-medium tracking-wide transition-all border flex items-center justify-center cursor-pointer ${
                          isSelected
                            ? 'bg-aura-espresso text-aura-ivory border-aura-espresso shadow-xs scale-102'
                            : 'bg-white text-aura-espresso border-aura-espresso/20 hover:border-aura-espresso/50 hover:bg-aura-ivory'
                        }`}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>

                {selectedSize && (
                  <p className="text-[11px] font-mono text-aura-muted pt-1">
                    Selected: <span className="font-semibold text-aura-espresso">{selectedSize}</span>
                    {product.size_type === 'onesize' && ' (Universal Proportions)'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action CTAs */}
          <div className="space-y-3 pt-2">
            {/* Primary Action: Style Outfit */}
            <button
              onClick={handleOutfitAction}
              className="w-full py-4 px-6 bg-aura-espresso hover:bg-aura-dark active:scale-[0.98] text-aura-ivory rounded-full text-xs font-medium uppercase tracking-[0.2em] transition-all shadow-aura-card flex items-center justify-center gap-2 group"
            >
              <Layers className="w-4 h-4 text-aura-champagne" />
              <span>Style in Outfit Studio</span>
            </button>

            {/* Secondary Action: Find Similar */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onSimilarClick && onSimilarClick(product)}
                className="py-3.5 px-4 bg-aura-cream hover:bg-aura-taupe/30 active:bg-aura-taupe/50 text-aura-espresso rounded-full text-xs font-medium uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-aura-olive" />
                <span>Find Similar</span>
              </button>

              {/* Wishlist Toggle Button */}
              <button
                onClick={handleWishlistToggle}
                className={`py-3.5 px-4 rounded-full text-xs font-medium uppercase tracking-wider transition-all flex items-center justify-center gap-2 border ${
                  isSaved
                    ? 'bg-aura-espresso text-aura-champagne border-aura-espresso'
                    : 'bg-white text-aura-espresso border-aura-espresso/20 hover:border-aura-espresso/40'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : 'stroke-[1.5]'}`} />
                <span>{isSaved ? 'Saved' : 'Wishlist'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Size Guide Modal */}
      {showSizeGuide && (
        <div
          className="fixed inset-0 z-50 bg-aura-espresso/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowSizeGuide(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 border border-aura-espresso/15 shadow-2xl space-y-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-aura-espresso/10 pb-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-aura-olive font-medium">
                  Measurement Specifications
                </span>
                <h3 className="text-xl sm:text-2xl font-serif font-normal text-aura-espresso">
                  {(() => {
                    const isMen = product.index_group_name === 'Menswear' || product.gender === 'men';
                    if (product.size_type === 'waist') return isMen ? SIZE_CHARTS.waist_men.title : SIZE_CHARTS.waist_women.title;
                    if (product.size_type === 'footwear_uk') return isMen ? SIZE_CHARTS.shoes_men.title : SIZE_CHARTS.shoes_women.title;
                    return isMen ? SIZE_CHARTS.alpha_men.title : SIZE_CHARTS.alpha_women.title;
                  })()}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setShowSizeGuide(false)}
                className="w-8 h-8 rounded-full bg-aura-cream hover:bg-aura-taupe/30 text-aura-espresso flex items-center justify-center transition-colors"
                title="Close size guide"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Table Content */}
            <div className="overflow-x-auto">
              {(() => {
                const isMen = product.index_group_name === 'Menswear' || product.gender === 'men';
                let chart = isMen ? SIZE_CHARTS.alpha_men : SIZE_CHARTS.alpha_women;
                if (product.size_type === 'waist') chart = isMen ? SIZE_CHARTS.waist_men : SIZE_CHARTS.waist_women;
                if (product.size_type === 'footwear_uk') chart = isMen ? SIZE_CHARTS.shoes_men : SIZE_CHARTS.shoes_women;

                return (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-aura-espresso/10 bg-aura-cream/50">
                        {chart.columns.map((col, idx) => (
                          <th key={idx} className="py-2.5 px-3 font-mono font-medium uppercase tracking-wider text-aura-espresso">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-aura-espresso/6 font-mono">
                      {chart.rows.map((row, rIdx) => (
                        <tr key={rIdx} className={row[0] === selectedSize ? 'bg-aura-cream/70 font-semibold' : 'hover:bg-aura-ivory'}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="py-2.5 px-3 text-aura-espresso/90">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            {/* Note & Footer */}
            <div className="p-3.5 bg-aura-cream/50 rounded-2xl border border-aura-espresso/8 text-[11px] text-aura-muted leading-relaxed">
              <p>
                <span className="font-semibold text-aura-espresso font-mono uppercase tracking-wider">Note:</span> Measurements represent standard body proportions. Garment drape and fit may vary by silhouette and fabric stretch.
              </p>
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={() => setShowSizeGuide(false)}
                className="px-5 py-2 bg-aura-espresso text-aura-ivory rounded-full text-xs font-mono uppercase tracking-wider hover:bg-aura-dark transition-colors"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
