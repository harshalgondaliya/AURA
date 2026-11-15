import React, { useState, useEffect } from 'react';
import { Sparkles, Clock, Heart, RefreshCw, ShoppingBag, ArrowRight } from 'lucide-react';
import { fetchPersonalizedFeed, fetchUserHistory, fetchUserFavorites } from '../services/api';
import ProductCard from './ProductCard';

export default function PersonalizedFeed({
  activeUser,
  gender = 'all',
  onSimilarClick,
  onOutfitClick,
  onLikeClick,
  onNavigateCatalog,
  onProductSelect,
  wishlistIds = [],
  recentViewIds = [],
}) {
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [refreshCount, setRefreshCount] = useState(0);
  const [feedNotification, setFeedNotification] = useState('');

  useEffect(() => {
    loadPersonalizedData(0);
  }, [activeUser, recentViewIds.length, gender]);

  const loadPersonalizedData = async (offset = 0) => {
    setLoading(true);
    try {
      const [recs, hist, favs] = await Promise.all([
        fetchPersonalizedFeed(activeUser, 10, recentViewIds, gender, '', offset > 0, offset),
        fetchUserHistory(activeUser),
        fetchUserFavorites(activeUser),
      ]);
      setRecommendations(recs);
      setHistoryItems(hist);
      setFavorites(favs);
      if (offset > 0) {
        setFeedNotification('Feed refreshed with new curated pieces');
        setTimeout(() => setFeedNotification(''), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshClick = () => {
    const nextOffset = refreshCount + 1;
    setRefreshCount(nextOffset);
    loadPersonalizedData(nextOffset);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-200 space-y-16">
      {/* Editorial Persona Banner */}
      <div className="bg-aura-cream/70 rounded-3xl p-8 sm:p-12 border border-aura-espresso/8 shadow-aura-subtle flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-aura-espresso/10 text-aura-olive text-[10px] font-mono uppercase tracking-[0.22em]">
            <Sparkles className="w-3 h-3 text-aura-olive" />
            Personal Lookbook Concierge
          </div>
          <h1 className="text-3xl sm:text-5xl font-serif font-light text-aura-espresso tracking-tight">
            Curated For {activeUser.replace('user_', 'Persona ').toUpperCase()}
          </h1>
          <p className="text-xs sm:text-sm text-aura-muted font-light max-w-xl leading-relaxed">
            Personal recommendations weighted by your recent browsing silhouettes, favorited fabrics, and wardrobe preferences.
          </p>
        </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefreshClick}
              disabled={loading}
              className="self-start md:self-center flex items-center gap-2 px-6 py-3 bg-aura-espresso hover:bg-aura-dark active:scale-[0.98] text-aura-ivory rounded-full text-xs font-medium uppercase tracking-wider transition-all shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Feed</span>
            </button>
            {feedNotification && (
              <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full animate-fade-in inline-flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                {feedNotification}
              </span>
            )}
          </div>
      </div>

      {/* Section 1: Recommended For You */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-aura-espresso/8 pb-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-aura-olive mb-0.5">
              Curated Selection
            </p>
            <h2 className="text-2xl sm:text-3xl font-serif font-light text-aura-espresso">
              Recommended For Your Silhouette
            </h2>
          </div>
          <span className="text-xs font-serif italic text-aura-muted">
            Aligned with your browsing tone
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-aura-cream/60 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-aura-espresso/8 space-y-3 shadow-aura-subtle">
            <ShoppingBag className="w-10 h-10 text-aura-taupe mx-auto" />
            <p className="font-serif text-lg text-aura-espresso">No personalized recommendations yet</p>
            <p className="text-xs text-aura-muted max-w-xs mx-auto">
              Browse The Collection or save favorite pieces to train your lookbook.
            </p>
            <div className="pt-2">
              <button
                onClick={onNavigateCatalog}
                className="px-6 py-2.5 bg-aura-espresso text-aura-ivory rounded-full text-xs uppercase tracking-wider font-medium"
              >
                Browse Collection
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {recommendations.map((prod) => (
              <ProductCard
                key={prod.article_id}
                product={prod}
                isLiked={wishlistIds.includes(prod.article_id)}
                onSimilarClick={onSimilarClick}
                onOutfitClick={onOutfitClick}
                onLikeClick={onLikeClick}
                onSelectProduct={onProductSelect}
              />
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Recently Viewed & Explored */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-aura-espresso/8 pb-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-aura-olive mb-0.5">
              Session History
            </p>
            <h2 className="text-2xl sm:text-3xl font-serif font-light text-aura-espresso">
              Recently Viewed Pieces
            </h2>
          </div>
          <span className="text-xs font-mono text-aura-muted">
            {historyItems.length} {historyItems.length === 1 ? 'item' : 'items'} viewed
          </span>
        </div>

        {historyItems.length === 0 ? (
          <div className="p-10 text-center bg-white rounded-3xl border border-dashed border-aura-espresso/15 text-aura-muted text-xs font-light">
            You haven't viewed any garments yet in this session. Click any piece in The Collection to start exploring.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {historyItems.slice(0, 5).map((prod) => (
              <ProductCard
                key={prod.article_id}
                product={prod}
                isLiked={wishlistIds.includes(prod.article_id)}
                onSimilarClick={onSimilarClick}
                onOutfitClick={onOutfitClick}
                onLikeClick={onLikeClick}
                onSelectProduct={onProductSelect}
              />
            ))}
          </div>
        )}
      </section>

      {/* Section 3: Favorite Picks */}
      {favorites.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-aura-espresso/8 pb-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-aura-olive mb-0.5">
                Saved Lookbook
              </p>
              <h2 className="text-2xl sm:text-3xl font-serif font-light text-aura-espresso">
                Your Saved Favorites
              </h2>
            </div>
            <span className="text-xs font-mono text-aura-muted">
              {favorites.length} saved
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {favorites.slice(0, 5).map((prod) => (
              <ProductCard
                key={prod.article_id}
                product={prod}
                isLiked={true}
                onSimilarClick={onSimilarClick}
                onOutfitClick={onOutfitClick}
                onLikeClick={onLikeClick}
                onSelectProduct={onProductSelect}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
