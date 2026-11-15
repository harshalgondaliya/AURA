import React, { useState, useEffect } from 'react';
import {
  Layers,
  Sparkles,
  RefreshCw,
  BookmarkCheck,
  CheckCircle2,
  ArrowRight,
  Info,
  Palette,
  ChevronLeft,
  ChevronRight,
  Heart,
} from 'lucide-react';
import { fetchOutfitRecommendations, saveOutfit, recordInteraction } from '../services/api';
import ProductImagePlaceholder from './ProductImagePlaceholder';
import { formatProductPrice } from '../utils/formatters';
import { useWishlist } from '../context/WishlistContext';

export default function OutfitStudio({
  anchorProduct,
  activeUser,
  onNavigateCatalog,
  onSelectAnchor,
  onProductSelect,
  onToast,
  globalGender = 'all',
}) {
  const [loading, setLoading] = useState(false);
  const [outfitData, setOutfitData] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failedImages, setFailedImages] = useState({});

  // History & Diversity State
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [resynthesizeCount, setResynthesizeCount] = useState(0);
  const [selectedSizes, setSelectedSizes] = useState({});
  const [studioGender, setStudioGender] = useState(() => {
    return globalGender || localStorage.getItem('aura_catalog_gender') || 'all';
  });

  const extractSizesFromData = (data) => {
    const s = {};
    if (data?.anchor) {
      s.anchor = data.anchor.selected_size || (Array.isArray(data.anchor.sizes) && data.anchor.sizes.length > 0 ? data.anchor.sizes[0] : '');
    }
    if (data?.slots) {
      Object.entries(data.slots).forEach(([k, item]) => {
        s[k] = item.selected_size || (Array.isArray(item.sizes) && item.sizes.length > 0 ? item.sizes[0] : '');
      });
    }
    return s;
  };

  // Consume centralized WishlistContext with safe fallback
  let wishlistCtx = null;
  try {
    wishlistCtx = useWishlist();
  } catch {
    // Rendered outside provider
  }

  // Load initial outfit when anchor changes or studioGender changes
  useEffect(() => {
    if (anchorProduct) {
      loadInitialOutfit(anchorProduct.article_id, studioGender);
    }
  }, [anchorProduct, studioGender]);

  const loadInitialOutfit = async (aid, gender) => {
    setLoading(true);
    setIsSaved(false);
    setFailedImages({});
    try {
      const data = await fetchOutfitRecommendations(aid, gender, [], 0);
      const initialSizes = extractSizesFromData(data);
      if (anchorProduct?.selected_size) {
        initialSizes.anchor = anchorProduct.selected_size;
      }
      setSelectedSizes(initialSizes);
      const lookWithSizes = { ...data, selected_sizes: initialSizes };
      setOutfitData(lookWithSizes);
      setHistory([lookWithSizes]);
      setHistoryIndex(0);
      setResynthesizeCount(0);
      recordInteraction(activeUser, aid, 'view', { feature: 'outfit_studio' });
    } catch (err) {
      console.error(err);
      onToast && onToast('Unable to synthesize outfit ensemble', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSizeChange = (key, sz) => {
    setSelectedSizes((prev) => {
      const updated = { ...prev, [key]: sz };
      setHistory((prevHist) => {
        const copy = [...prevHist];
        if (copy[historyIndex]) {
          copy[historyIndex] = {
            ...copy[historyIndex],
            selected_sizes: updated,
          };
        }
        return copy;
      });
      return updated;
    });
  };

  const handleResynthesize = async () => {
    if (!anchor || loading) return;
    setLoading(true);
    setIsSaved(false);
    try {
      // Gather all product IDs seen in previous looks to guarantee diverse, non-repeating looks
      const seenIds = new Set();
      history.forEach((look) => {
        if (look?.slots) {
          Object.values(look.slots).forEach((s) => {
            if (s?.article_id) seenIds.add(s.article_id);
          });
        }
      });

      const nextCount = resynthesizeCount + 1;
      const nextData = await fetchOutfitRecommendations(
        anchor.article_id,
        studioGender,
        Array.from(seenIds),
        nextCount,
        selectedSizes
      );

      const nextSizes = extractSizesFromData(nextData);
      const mergedSizes = { ...selectedSizes, ...nextSizes };
      setSelectedSizes(mergedSizes);
      const lookWithSizes = { ...nextData, selected_sizes: mergedSizes };

      setOutfitData(lookWithSizes);
      setHistory((prev) => [...prev, lookWithSizes]);
      setHistoryIndex(history.length);
      setResynthesizeCount(nextCount);
      onToast && onToast(`Synthesized Look ${history.length + 1}`, 'info');
    } catch (err) {
      console.error(err);
      onToast && onToast('Unable to resynthesize alternative look', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousLook = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      const prevLook = history[prevIdx];
      setHistoryIndex(prevIdx);
      setOutfitData(prevLook);
      if (prevLook.selected_sizes) {
        setSelectedSizes(prevLook.selected_sizes);
      }
      setIsSaved(false);
    }
  };

  const handleNextLook = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      const nextLook = history[nextIdx];
      setHistoryIndex(nextIdx);
      setOutfitData(nextLook);
      if (nextLook.selected_sizes) {
        setSelectedSizes(nextLook.selected_sizes);
      }
      setIsSaved(false);
    }
  };

  const handleSaveOutfit = async () => {
    if (!outfitData) return;
    setSaving(true);
    try {
      const itemIds = Object.values(outfitData.slots).map((s) => s.article_id);
      const outfitName = `Look: ${outfitData.anchor.prod_name} Ensemble`;
      await saveOutfit(activeUser, outfitName, outfitData.anchor.article_id, itemIds, selectedSizes);
      setIsSaved(true);
      onToast && onToast('Ensemble saved to your portfolio', 'success');
    } catch (err) {
      console.error(err);
      onToast && onToast('Failed to save ensemble look', 'error');
    } finally {
      setSaving(false);
    }
  };

  const markImageFailed = (id) => {
    setFailedImages((prev) => ({ ...prev, [id]: true }));
  };

  if (!anchorProduct && !outfitData) {
    return (
      <div className="max-w-4xl mx-auto py-24 px-4 text-center animate-in fade-in space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-aura-cream text-aura-espresso border border-aura-espresso/10 flex items-center justify-center mx-auto shadow-aura-subtle">
          <Layers className="w-8 h-8 stroke-[1.25]" />
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-aura-olive font-medium">
            Personal Styling Suite
          </p>
          <h2 className="text-3xl sm:text-5xl font-serif font-normal text-aura-espresso">
            Complete Outfit Studio
          </h2>
          <p className="text-aura-muted max-w-lg mx-auto text-xs sm:text-sm font-normal leading-relaxed">
            Select any anchor piece from The Collection — whether an essential top, wide-leg trouser, or dress — to curate an effortless, multi-slot ensemble.
          </p>
        </div>
        <div className="pt-2">
          <button
            onClick={onNavigateCatalog}
            className="inline-flex items-center gap-2 px-8 py-4 bg-aura-espresso hover:bg-aura-dark active:scale-[0.98] text-aura-ivory rounded-full text-xs font-medium uppercase tracking-[0.2em] transition-all shadow-aura-card"
          >
            <span>Choose Anchor Piece</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const anchor = outfitData?.anchor || anchorProduct;
  const slots = outfitData?.slots || {};
  const isAnchorLiked = wishlistCtx && anchor ? wishlistCtx.isWishlisted(anchor.article_id) : false;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-200 space-y-10">
      {/* Studio Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-aura-espresso/8 shadow-aura-subtle relative overflow-hidden">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 relative z-10 border-b border-aura-espresso/6 pb-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-aura-cream border border-aura-espresso/10 text-aura-olive text-[10px] font-mono uppercase tracking-[0.22em] font-medium">
              <Sparkles className="w-3 h-3 text-aura-olive" />
              Harmonious Styling Suite
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-normal text-aura-espresso tracking-tight">
              Outfit Compatibility Studio
            </h1>
            <p className="text-xs sm:text-sm text-aura-muted font-normal max-w-2xl">
              Coordinating a complete look around <span className="font-medium text-aura-espresso">{anchor?.prod_name}</span> using balanced color harmony and slot proportions.
            </p>
          </div>

          {/* Interactive Styling Controls & Recommendation History */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Studio Gender Scope Pills */}
            <div className="flex items-center bg-aura-cream/70 p-1 rounded-full border border-aura-espresso/10">
              {[
                { id: 'all', label: 'All' },
                { id: 'women', label: 'Women' },
                { id: 'men', label: 'Men' },
              ].map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    if (studioGender !== g.id) {
                      setStudioGender(g.id);
                      localStorage.setItem('aura_catalog_gender', g.id);
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider transition-all ${
                    studioGender === g.id
                      ? 'bg-aura-espresso text-aura-ivory font-medium shadow-xs'
                      : 'text-aura-espresso/70 hover:text-aura-espresso'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            {/* Previous Look */}
            <button
              onClick={handlePreviousLook}
              disabled={historyIndex <= 0 || loading}
              className="p-2 sm:px-3 sm:py-2 bg-aura-cream hover:bg-aura-taupe/30 active:bg-aura-taupe/50 disabled:opacity-30 disabled:cursor-not-allowed text-aura-espresso rounded-full text-xs font-medium uppercase tracking-wider transition-all flex items-center gap-1"
              title="Previous look in history"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Prev</span>
            </button>

            {/* Look Indicator Badge */}
            <div className="px-3.5 py-1.5 rounded-full bg-aura-ivory border border-aura-espresso/15 text-[11px] font-mono tracking-widest text-aura-espresso font-semibold">
              Look {history.length > 0 ? historyIndex + 1 : 1} of {Math.max(history.length, 1)}
            </div>

            {/* Next Look */}
            <button
              onClick={handleNextLook}
              disabled={historyIndex >= history.length - 1 || loading}
              className="p-2 sm:px-3 sm:py-2 bg-aura-cream hover:bg-aura-taupe/30 active:bg-aura-taupe/50 disabled:opacity-30 disabled:cursor-not-allowed text-aura-espresso rounded-full text-xs font-medium uppercase tracking-wider transition-all flex items-center gap-1"
              title="Next look in history"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Resynthesize Diverse Alternative */}
            <button
              onClick={handleResynthesize}
              disabled={loading}
              className="flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-aura-cream hover:bg-aura-taupe/30 active:bg-aura-taupe/50 text-aura-espresso rounded-full text-xs font-medium uppercase tracking-wider transition-all border border-aura-espresso/10"
              title="Generate fresh, diverse coordinate pieces"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Resynthesize</span>
            </button>

            {/* Save Ensemble to Portfolio */}
            <button
              onClick={handleSaveOutfit}
              disabled={isSaved || saving || loading}
              className={`flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-full text-xs font-medium uppercase tracking-[0.18em] transition-all shadow-aura-subtle ${
                isSaved
                  ? 'bg-aura-olive text-white cursor-default'
                  : 'bg-aura-espresso hover:bg-aura-dark active:scale-[0.98] text-aura-ivory'
              }`}
            >
              {isSaved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-aura-champagne" />
                  <span>Ensemble Saved</span>
                </>
              ) : (
                <>
                  <BookmarkCheck className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Ensemble'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Studio Style Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 text-center sm:text-left">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-aura-muted block font-medium">Color Harmony</span>
            <p className="text-xl font-serif font-semibold text-aura-espresso mt-0.5">
              {outfitData?.overall_score ? Math.round(outfitData.overall_score * 100) : 94}% Balanced
            </p>
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-aura-muted block font-medium">Tonal Palette</span>
            <p className="text-xl font-serif font-semibold text-aura-olive mt-0.5">Classic Contrast</p>
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-aura-muted block font-medium">Wardrobe Pieces</span>
            <p className="text-xl font-serif font-semibold text-aura-espresso mt-0.5">
              {Object.keys(slots).length + 1} Coordinated
            </p>
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-aura-muted block font-medium">Look Status</span>
            <p className="text-xl font-serif font-semibold text-aura-espresso mt-0.5">
              {history.length > 1 ? `Look #${historyIndex + 1}` : 'Curated Match'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Studio Interactive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Anchor Garment (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-aura-espresso/8 shadow-aura-subtle sticky top-28 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-aura-espresso/6">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-aura-olive font-medium">
              Anchor Garment
            </span>
            <span className="text-[11px] text-aura-muted font-normal">Fixed Center</span>
          </div>

          <div
            onClick={() => onProductSelect && onProductSelect(anchor)}
            className="relative aspect-[3/4] bg-aura-cream rounded-2xl overflow-hidden shadow-inner cursor-pointer group"
            title="Inspect anchor piece details"
          >
            {failedImages[anchor.article_id] ? (
              <ProductImagePlaceholder
                category={anchor.standard_category}
                productName={anchor.prod_name}
                articleId={anchor.article_id}
                colorName={anchor.colour_group_name}
              />
            ) : (
              <img
                src={`/images/${anchor.article_id.slice(0, 3)}/${anchor.article_id}.jpg`}
                alt={anchor.prod_name}
                onError={() => markImageFailed(anchor.article_id)}
                className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
              />
            )}

            {/* Direct Anchor Wishlist Heart Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (wishlistCtx) wishlistCtx.toggleWishlist(anchor);
              }}
              className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-xs border border-aura-espresso/10 ${
                isAnchorLiked
                  ? 'bg-aura-espresso text-aura-champagne'
                  : 'bg-white/90 backdrop-blur-xs text-aura-espresso/70 hover:text-aura-espresso hover:bg-white'
              }`}
              title={isAnchorLiked ? 'Remove Anchor from Wishlist' : 'Save Anchor to Wishlist'}
            >
              <Heart className={`w-3.5 h-3.5 ${isAnchorLiked ? 'fill-current' : 'stroke-[1.5]'}`} />
            </button>

            <div className="absolute bottom-3 left-3 right-3 p-3.5 bg-white/95 backdrop-blur-md rounded-xl text-aura-espresso border border-aura-espresso/10">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-aura-olive font-medium">
                  {anchor.standard_category ? anchor.standard_category.replace('_', ' ') : 'Piece'}
                </p>
                <span className="text-xs font-serif font-bold text-aura-espresso">
                  {formatProductPrice(anchor)}
                </span>
              </div>
              <h3 className="font-serif text-sm font-semibold truncate text-aura-espresso">{anchor.prod_name}</h3>
              <p className="text-[11px] text-aura-muted mt-0.5">
                {anchor.colour_group_name || 'Neutral'} &bull; #{anchor.article_id}
              </p>
            </div>
          </div>

          {/* Anchor Size Selection */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[10px] font-mono text-aura-muted">
              <span className="uppercase tracking-widest font-medium">Selected Size</span>
              <span>{anchor.size_type === 'onesize' ? 'Universal' : 'Tap to adjust'}</span>
            </div>
            {Array.isArray(anchor.sizes) && anchor.sizes.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {anchor.sizes.map((sz) => {
                  const isSelected = (selectedSizes.anchor || anchor.selected_size) === sz;
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => handleSizeChange('anchor', sz)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-medium transition-all border ${
                        isSelected
                          ? 'bg-aura-espresso text-aura-ivory border-aura-espresso shadow-xs'
                          : 'bg-aura-ivory text-aura-espresso border-aura-espresso/15 hover:border-aura-espresso/40'
                      }`}
                    >
                      {sz}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className="text-[10px] font-mono text-aura-muted italic">
                {anchor.size_type === 'onesize' ? 'One Size' : 'Size details unavailable'}
              </span>
            )}
          </div>

          <button
            onClick={onNavigateCatalog}
            className="w-full py-3 px-4 bg-aura-cream hover:bg-aura-taupe/30 active:bg-aura-taupe/50 text-aura-espresso rounded-full text-xs font-medium uppercase tracking-wider transition-colors text-center"
          >
            Switch Anchor Piece
          </button>
        </div>

        {/* Right Column: Coordinated Wardrobe Slots (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-aura-espresso/8">
            <h2 className="text-xl font-serif text-aura-espresso flex items-center gap-2">
              <Palette className="w-5 h-5 text-aura-olive" />
              <span>Coordinated Wardrobe Ensemble</span>
            </h2>
            <span className="text-xs text-aura-muted font-normal">
              Slot-isolated compatible pieces
            </span>
          </div>

          {loading ? (
            <div className="bg-white rounded-3xl p-16 text-center border border-aura-espresso/8 text-aura-muted space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-aura-olive" />
              <p className="font-serif text-base text-aura-espresso">Curating complementary pieces & color harmony...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {Object.entries(slots).map(([slotKey, item]) => {
                const isSlotLiked = wishlistCtx ? wishlistCtx.isWishlisted(item.article_id) : false;

                return (
                  <div
                    key={slotKey}
                    className="bg-white rounded-2xl border border-aura-espresso/8 shadow-aura-subtle p-4 flex flex-col justify-between hover:shadow-aura-card transition-shadow"
                  >
                    <div className="space-y-3">
                      {/* Slot Header */}
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.2em] bg-aura-cream text-aura-espresso font-medium">
                          {slotKey.replace('_', ' ')}
                        </span>
                        <span className="text-[11px] font-mono text-aura-olive font-semibold">
                          {Math.round(item.compatibility_score * 100)}% match
                        </span>
                      </div>

                      {/* Slot Image */}
                      <div
                        onClick={() => onProductSelect && onProductSelect(item)}
                        className="aspect-square rounded-xl bg-aura-cream/50 overflow-hidden relative cursor-pointer group"
                        title="Inspect piece details"
                      >
                        {failedImages[item.article_id] ? (
                          <ProductImagePlaceholder
                            category={item.slot}
                            productName={item.prod_name}
                            articleId={item.article_id}
                            colorName={item.colour_group_name}
                          />
                        ) : (
                          <img
                            src={`/images/${item.article_id.slice(0, 3)}/${item.article_id}.jpg`}
                            alt={item.prod_name}
                            onError={() => markImageFailed(item.article_id)}
                            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                          />
                        )}

                        {/* Direct Slot Wishlist Heart Toggle */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (wishlistCtx) wishlistCtx.toggleWishlist(item);
                          }}
                          className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-xs border border-aura-espresso/10 ${
                            isSlotLiked
                              ? 'bg-aura-espresso text-aura-champagne'
                              : 'bg-white/90 backdrop-blur-xs text-aura-espresso/70 hover:text-aura-espresso hover:bg-white'
                          }`}
                          title={isSlotLiked ? 'Remove from Wishlist' : 'Save to Wishlist'}
                        >
                          <Heart className={`w-3 h-3 ${isSlotLiked ? 'fill-current' : 'stroke-[1.5]'}`} />
                        </button>
                      </div>

                      {/* Meta info */}
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <h4
                            onClick={() => onProductSelect && onProductSelect(item)}
                            className="text-xs font-serif font-semibold text-aura-espresso line-clamp-1 cursor-pointer hover:text-aura-olive transition-colors"
                            title={item.prod_name}
                          >
                            {item.prod_name}
                          </h4>
                          <span className="text-xs font-serif font-bold text-aura-espresso shrink-0">
                            {formatProductPrice(item)}
                          </span>
                        </div>
                        <p className="text-[11px] text-aura-muted font-normal">
                          {item.product_type_name} &bull; {item.colour_group_name}
                        </p>
                      </div>

                      {/* Slot Size Selector */}
                      <div className="pt-2 border-t border-aura-espresso/6 space-y-1">
                        <div className="flex items-center justify-between text-[9px] font-mono text-aura-muted">
                          <span className="uppercase tracking-wider">Size:</span>
                          <span className="font-semibold text-aura-espresso">
                            {selectedSizes[slotKey] || item.selected_size || 'Default'}
                          </span>
                        </div>
                        {Array.isArray(item.sizes) && item.sizes.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
                            {item.sizes.map((sz) => {
                              const isSelected = (selectedSizes[slotKey] || item.selected_size) === sz;
                              return (
                                <button
                                  key={sz}
                                  type="button"
                                  onClick={() => handleSizeChange(slotKey, sz)}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-all border ${
                                    isSelected
                                      ? 'bg-aura-espresso text-aura-ivory border-aura-espresso font-semibold shadow-2xs'
                                      : 'bg-aura-ivory text-aura-espresso/80 border-aura-espresso/15 hover:border-aura-espresso/35'
                                  }`}
                                >
                                  {sz}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[9px] font-mono text-aura-muted italic">
                            {item.size_type === 'onesize' ? 'One Size' : 'Size details unavailable'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Slot Action Buttons */}
                    <div className="mt-4 pt-3 border-t border-aura-espresso/6 flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (onSelectAnchor) onSelectAnchor(item);
                        }}
                        className="flex-1 py-1.5 px-2 bg-aura-cream/80 hover:bg-aura-cream text-aura-espresso text-[11px] font-medium rounded-lg transition-colors text-center"
                      >
                        Make Anchor
                      </button>
                      <button
                        onClick={() => onProductSelect && onProductSelect(item)}
                        className="py-1.5 px-2 bg-aura-ivory hover:bg-aura-cream text-aura-muted hover:text-aura-espresso rounded-lg text-xs transition-colors"
                        title="View details"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Editorial Note */}
          <div className="p-5 rounded-2xl bg-aura-cream/60 border border-aura-espresso/8 text-aura-espresso text-xs leading-relaxed space-y-1">
            <span className="font-serif font-bold text-sm block">Editorial Styling Note:</span>
            <p className="text-aura-muted font-normal">
              Outfits in AURA are synthesized using strict category slot constraints (Upper, Lower, Footwear, Accessories) and validated color harmony matrices derived from fashion design theory. Dresses and full-body garments isolate lower-body pieces to prevent conflicting silhouettes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
