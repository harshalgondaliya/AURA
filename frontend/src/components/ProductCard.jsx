import React, { useState } from 'react';
import { Sparkles, Layers, Heart } from 'lucide-react';
import ProductImagePlaceholder from './ProductImagePlaceholder';
import { formatProductPrice } from '../utils/formatters';
import { useWishlist } from '../context/WishlistContext';

export default function ProductCard({
  product,
  onSimilarClick,
  onOutfitClick,
  onLikeClick,
  onSelectProduct,
  isLiked = false,
  showScores = false,
  similarityScore = null,
}) {
  const [imageError, setImageError] = useState(false);

  // Consume centralized WishlistContext with safe fallback
  let wishlistCtx = null;
  try {
    wishlistCtx = useWishlist();
  } catch {
    // Rendered outside provider (e.g. standalone test)
  }

  const liked = wishlistCtx
    ? wishlistCtx.isWishlisted(product?.article_id)
    : isLiked;

  const handleLike = (e) => {
    e.stopPropagation();
    if (wishlistCtx) {
      wishlistCtx.toggleWishlist(product);
    }
    if (onLikeClick) {
      onLikeClick(product, !liked);
    }
  };

  const handleCardClick = () => {
    if (onSelectProduct) {
      onSelectProduct(product);
    }
  };

  // Format price in Indian Rupees (₹)
  const priceDisplay = formatProductPrice(product);

  const hasValidImage = product.has_image && !imageError;
  const imageSrc = `/images/${product.article_id.slice(0, 3)}/${product.article_id}.jpg`;

  return (
    <div className="group relative bg-white rounded-2xl border border-aura-espresso/8 shadow-aura-subtle overflow-hidden flex flex-col transition-all duration-300 hover:shadow-aura-card hover:border-aura-espresso/20">
      {/* Top Media Container — Direct click opens Full Product Detail Page */}
      <div
        onClick={handleCardClick}
        className="relative aspect-[3/4] bg-aura-cream/50 overflow-hidden cursor-pointer"
        title={`View details for ${product.prod_name}`}
      >
        {hasValidImage ? (
          <img
            src={imageSrc}
            alt={product.prod_name}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <ProductImagePlaceholder
            category={product.standard_category}
            productName={product.prod_name}
            articleId={product.article_id}
            colorName={product.colour_group_name}
          />
        )}

        {/* Minimal Editorial Category Slot Pill */}
        <div className="absolute top-3 left-3 pointer-events-none">
          <span className="px-2.5 py-1 rounded-full text-[9px] font-mono uppercase tracking-[0.2em] bg-white/90 backdrop-blur-xs text-aura-espresso shadow-xs border border-aura-espresso/5">
            {product.standard_category ? product.standard_category.replace('_', ' ') : 'Piece'}
          </span>
        </div>

        {/* Direct Click Wishlist Heart Button */}
        <button
          onClick={handleLike}
          className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-xs border border-aura-espresso/5 ${
            liked
              ? 'bg-aura-espresso text-aura-champagne'
              : 'bg-white/90 backdrop-blur-xs text-aura-espresso/70 hover:text-aura-espresso hover:bg-white'
          }`}
          title={liked ? 'Remove from Wishlist' : 'Save to Wishlist'}
        >
          <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-current' : 'stroke-[1.5]'}`} />
        </button>

        {/* Similarity Score Pill (Editorial Style) */}
        {showScores && similarityScore !== null && (
          <div className="absolute bottom-3 left-3 pointer-events-none">
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider bg-aura-espresso/90 backdrop-blur-xs text-aura-ivory shadow-xs flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-aura-champagne" />
              Tonal Match
            </span>
          </div>
        )}
      </div>

      {/* Content Details */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div onClick={handleCardClick} className="cursor-pointer space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-aura-olive font-medium truncate">
              {product.product_type_name || 'Apparel'}
            </span>
            <span className="text-xs font-serif font-bold text-aura-espresso">
              {priceDisplay}
            </span>
          </div>

          <h3
            className="text-sm font-serif font-medium text-aura-espresso line-clamp-1 group-hover:text-aura-olive transition-colors"
            title={product.prod_name}
          >
            {product.prod_name}
          </h3>

          <div className="flex items-center gap-1.5 text-[11px] text-aura-muted pt-0.5">
            <span
              className="w-2 h-2 rounded-full border border-aura-espresso/15 inline-block shrink-0"
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
            <span className="truncate">{product.colour_group_name || 'Neutral'}</span>
          </div>
        </div>

        {/* Direct Action Buttons: Similar & Style Outfit */}
        <div className="pt-3 border-t border-aura-espresso/8 grid grid-cols-2 gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onSimilarClick) onSimilarClick(product);
            }}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-aura-cream/70 hover:bg-aura-cream active:bg-aura-taupe/40 text-aura-espresso rounded-xl text-[11px] font-medium transition-colors"
            title="Discover pieces with similar silhouette and style"
          >
            <Sparkles className="w-3 h-3 text-aura-olive" />
            <span>Similar</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onOutfitClick) onOutfitClick(product);
            }}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-aura-espresso hover:bg-aura-dark active:scale-[0.98] text-aura-ivory rounded-xl text-[11px] font-medium transition-colors shadow-xs"
            title="Generate compatible multi-slot outfit"
          >
            <Layers className="w-3 h-3 text-aura-champagne" />
            <span>Style Look</span>
          </button>
        </div>
      </div>
    </div>
  );
}
