import React, { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, Filter, SlidersHorizontal, Loader2, Layers } from 'lucide-react';
import { fetchSimilarItems } from '../services/api';
import ProductCard from './ProductCard';

export default function SimilarView({
  product,
  onBack,
  onProductSelect,
  onOutfitClick,
  onLikeClick,
  wishlistIds = [],
}) {
  const [mode, setMode] = useState('hybrid');
  const [filterCategory, setFilterCategory] = useState(true);
  const [similarItems, setSimilarItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!product) return;
    loadSimilar(mode, filterCategory);
  }, [product, mode, filterCategory]);

  const loadSimilar = async (selectedMode, strictCat) => {
    setLoading(true);
    setError(null);
    try {
      const genderScope = product?.gender || '';
      const data = await fetchSimilarItems(product.article_id, 10, selectedMode, strictCat, genderScope);
      setSimilarItems(data);
    } catch (err) {
      console.error(err);
      setError('Unable to load matching recommendations.');
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  const categoryName = product.standard_category
    ? product.standard_category.replace('_', ' ')
    : 'Piece';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-200 space-y-10">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between border-b border-aura-espresso/8 pb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs text-aura-muted hover:text-aura-espresso font-medium transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to Product</span>
        </button>

        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-aura-olive bg-aura-cream px-3 py-1 rounded-full">
          Harmonious Pieces
        </span>
      </div>

      {/* Anchor Banner Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-aura-espresso/8 shadow-aura-subtle flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-24 rounded-2xl overflow-hidden bg-aura-cream shrink-0 border border-aura-espresso/10">
            <img
              src={`/images/${product.article_id.slice(0, 3)}/${product.article_id}.jpg`}
              alt={product.prod_name}
              className="w-full h-full object-cover object-top"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-aura-olive">
              Selected Anchor Garment
            </p>
            <h1 className="text-2xl sm:text-3xl font-serif text-aura-espresso font-normal">
              {product.prod_name}
            </h1>
            <p className="text-xs text-aura-muted mt-0.5">
              {categoryName} &bull; {product.colour_group_name || 'Neutral'} &bull; #{product.article_id}
            </p>
          </div>
        </div>

        <button
          onClick={() => onOutfitClick && onOutfitClick(product)}
          className="px-6 py-3 bg-aura-espresso hover:bg-aura-dark active:scale-[0.98] text-aura-ivory rounded-full text-xs font-medium uppercase tracking-[0.18em] transition-all flex items-center justify-center gap-2 shrink-0 shadow-xs"
        >
          <Layers className="w-3.5 h-3.5 text-aura-champagne" />
          <span>Style Outfit with Anchor</span>
        </button>
      </div>

      {/* Editorial Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-aura-cream/50 p-4 rounded-2xl border border-aura-espresso/8">
        {/* Harmonious Discovery Modes */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-widest text-aura-muted mr-1 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-aura-olive" /> Alignment:
          </span>
          <button
            onClick={() => setMode('hybrid')}
            className={`px-3.5 py-1.5 rounded-full text-xs transition-all ${
              mode === 'hybrid'
                ? 'bg-aura-espresso text-aura-ivory font-medium shadow-xs'
                : 'bg-white text-aura-espresso/80 hover:bg-aura-ivory border border-aura-espresso/10'
            }`}
          >
            Curated Alignment
          </button>
          <button
            onClick={() => setMode('visual')}
            className={`px-3.5 py-1.5 rounded-full text-xs transition-all ${
              mode === 'visual'
                ? 'bg-aura-espresso text-aura-ivory font-medium shadow-xs'
                : 'bg-white text-aura-espresso/80 hover:bg-aura-ivory border border-aura-espresso/10'
            }`}
          >
            Visual Silhouette
          </button>
          <button
            onClick={() => setMode('text')}
            className={`px-3.5 py-1.5 rounded-full text-xs transition-all ${
              mode === 'text'
                ? 'bg-aura-espresso text-aura-ivory font-medium shadow-xs'
                : 'bg-white text-aura-espresso/80 hover:bg-aura-ivory border border-aura-espresso/10'
            }`}
          >
            Fabric & Narrative
          </button>
        </div>

        {/* Silhouette Lock Toggle */}
        <button
          onClick={() => setFilterCategory(!filterCategory)}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs transition-all border ${
            filterCategory
              ? 'bg-white text-aura-olive border-aura-olive/40 font-medium'
              : 'bg-aura-ivory text-aura-muted border-aura-espresso/10'
          }`}
          title="Locks recommendations to the same clothing silhouette"
        >
          <Filter className="w-3.5 h-3.5" />
          <span>Strict Silhouette</span>
          <span className={`w-2 h-2 rounded-full ${filterCategory ? 'bg-aura-olive' : 'bg-aura-taupe/40'}`} />
        </button>
      </div>

      {/* Similar Items Gallery Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-aura-cream/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-12 text-center text-aura-muted bg-white rounded-3xl border border-aura-espresso/10 text-xs">
          {error}
        </div>
      ) : similarItems.length === 0 ? (
        <div className="p-16 text-center text-aura-muted bg-white rounded-3xl border border-aura-espresso/10 text-xs space-y-2">
          <p className="font-serif text-lg text-aura-espresso">No similar pieces found</p>
          <p>Try switching the alignment mode or disabling Strict Silhouette.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {similarItems.map((item) => (
            <ProductCard
              key={item.article_id}
              product={item}
              isLiked={wishlistIds.includes(item.article_id)}
              onSelectProduct={onProductSelect}
              onOutfitClick={onOutfitClick}
              onLikeClick={onLikeClick}
              showScores={true}
              similarityScore={item.similarity_score}
            />
          ))}
        </div>
      )}
    </div>
  );
}
