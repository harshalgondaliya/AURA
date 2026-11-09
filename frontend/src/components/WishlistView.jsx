import React, { useState, useEffect } from 'react';
import { Heart, Sparkles, Layers, ArrowRight, Trash2, ShoppingBag } from 'lucide-react';
import { fetchUserFavorites, recordInteraction } from '../services/api';
import ProductCard from './ProductCard';

export default function WishlistView({
  activeUser,
  onProductSelect,
  onOutfitClick,
  onSimilarClick,
  onNavigateShop,
}) {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, [activeUser]);

  const loadFavorites = async () => {
    setLoading(true);
    try {
      const data = await fetchUserFavorites(activeUser);
      setFavorites(data);
    } catch (err) {
      console.error('Failed to load wishlist:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (product) => {
    await recordInteraction(activeUser, product.article_id, 'dismiss', { component: 'wishlist' });
    setFavorites((prev) => prev.filter((p) => p.article_id !== product.article_id));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-200 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-aura-espresso/8 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-aura-cream border border-aura-espresso/10 text-aura-olive text-[10px] font-mono uppercase tracking-[0.22em] mb-2">
            <Heart className="w-3 h-3 fill-current" />
            Curated Favorites
          </div>
          <h1 className="text-3xl sm:text-5xl font-serif font-light text-aura-espresso tracking-tight">
            Your Saved Wishlist
          </h1>
          <p className="text-xs sm:text-sm text-aura-muted mt-1 font-light">
            Pieces you have saved to your personal lookbook for upcoming ensembles and seasonal inspiration.
          </p>
        </div>

        <span className="self-start sm:self-auto text-xs font-mono font-medium text-aura-espresso bg-white px-4 py-2 rounded-full border border-aura-espresso/10 shadow-xs">
          {favorites.length} Saved {favorites.length === 1 ? 'Piece' : 'Pieces'}
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-aura-cream/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : favorites.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-aura-espresso/8 shadow-aura-subtle max-w-lg mx-auto space-y-4">
          <div className="w-14 h-14 rounded-full bg-aura-cream text-aura-taupe flex items-center justify-center mx-auto">
            <Heart className="w-7 h-7 stroke-[1.25]" />
          </div>
          <h3 className="text-2xl font-serif text-aura-espresso">Your wishlist is empty</h3>
          <p className="text-xs text-aura-muted leading-relaxed font-light">
            Browse The Collection and tap the heart on any garment to collect your favorite silhouettes.
          </p>
          <div className="pt-2">
            <button
              onClick={onNavigateShop}
              className="inline-flex items-center gap-2 px-6 py-3 bg-aura-espresso hover:bg-aura-dark text-aura-ivory rounded-full text-xs font-medium uppercase tracking-[0.18em] transition-all"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Explore The Collection</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {favorites.map((product) => (
            <div key={product.article_id} className="relative group">
              <ProductCard
                product={product}
                isLiked={true}
                onSelectProduct={onProductSelect}
                onOutfitClick={onOutfitClick}
                onSimilarClick={onSimilarClick}
                onLikeClick={() => handleRemoveFavorite(product)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
