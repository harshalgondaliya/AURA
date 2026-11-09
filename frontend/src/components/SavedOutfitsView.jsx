import React, { useState, useEffect } from 'react';
import { Layers, Calendar, ArrowRight, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { fetchSavedOutfits } from '../services/api';
import ProductImagePlaceholder from './ProductImagePlaceholder';
import { formatProductPrice } from '../utils/formatters';

export default function SavedOutfitsView({
  activeUser,
  onOutfitClick,
  onNavigateCatalog,
  onProductSelect,
}) {
  const [outfits, setOutfits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failedImages, setFailedImages] = useState({});

  useEffect(() => {
    loadSaved();
  }, [activeUser]);

  const loadSaved = async () => {
    setLoading(true);
    try {
      const data = await fetchSavedOutfits(activeUser);
      setOutfits(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const markImageFailed = (id) => {
    setFailedImages((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-200 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-aura-espresso/8 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-aura-cream border border-aura-espresso/10 text-aura-olive text-[10px] font-mono uppercase tracking-[0.22em] mb-2">
            <Layers className="w-3 h-3 text-aura-olive" />
            Wardrobe Lookbook
          </div>
          <h1 className="text-3xl sm:text-5xl font-serif font-light text-aura-espresso tracking-tight">
            Saved Ensembles
          </h1>
          <p className="text-xs sm:text-sm text-aura-muted mt-1 font-light">
            Complete coordinated multi-piece outfits saved to your personal styling archive.
          </p>
        </div>
        <span className="self-start sm:self-auto text-xs font-mono font-medium text-aura-espresso bg-white px-4 py-2 rounded-full border border-aura-espresso/10 shadow-xs">
          {outfits.length} Saved {outfits.length === 1 ? 'Ensemble' : 'Ensembles'}
        </span>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-aura-muted space-y-2">
          <Loader2 className="w-6 h-6 animate-spin text-aura-olive" />
          <p className="text-xs font-mono uppercase tracking-wider">Loading wardrobe archive...</p>
        </div>
      ) : outfits.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-aura-espresso/8 shadow-aura-subtle max-w-lg mx-auto space-y-4">
          <div className="w-14 h-14 rounded-full bg-aura-cream text-aura-taupe flex items-center justify-center mx-auto">
            <Layers className="w-7 h-7 stroke-[1.25]" />
          </div>
          <h3 className="text-2xl font-serif text-aura-espresso">No saved looks yet</h3>
          <p className="text-xs text-aura-muted leading-relaxed font-light">
            Open the Outfit Studio or select any item from The Collection to synthesize and save your first complete look.
          </p>
          <div className="pt-2">
            <button
              onClick={onNavigateCatalog}
              className="inline-flex items-center gap-2 px-6 py-3 bg-aura-espresso hover:bg-aura-dark text-aura-ivory rounded-full text-xs font-medium uppercase tracking-[0.18em] transition-all shadow-xs"
            >
              <span>Curate in Outfit Studio</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {outfits.map((outfit) => (
            <div
              key={outfit.outfit_id}
              className="bg-white rounded-3xl border border-aura-espresso/8 shadow-aura-subtle p-6 sm:p-8 hover:shadow-aura-card transition-shadow flex flex-col justify-between space-y-6"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-serif font-semibold text-aura-espresso">
                      {outfit.outfit_name}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-aura-muted mt-0.5">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3" />
                        {outfit.created_at ? new Date(outfit.created_at).toLocaleDateString() : 'Archived Look'}
                      </span>
                      <span>&bull;</span>
                      <span className="font-mono">#{outfit.outfit_id}</span>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider bg-aura-cream text-aura-olive border border-aura-espresso/10">
                    {Math.round((outfit.compatibility_score || 0.94) * 100)}% Harmony
                  </span>
                </div>

                {/* Items in Outfit Grid — Clean, legible titles, zero hover dependency */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  {outfit.items && outfit.items.map((it, idx) => (
                    <div
                      key={idx}
                      onClick={() => onProductSelect && onProductSelect(it)}
                      className="group bg-aura-ivory rounded-2xl p-2.5 border border-aura-espresso/8 cursor-pointer hover:border-aura-espresso/25 transition-colors space-y-1.5"
                      title={`Inspect ${it.prod_name}`}
                    >
                      <div className="aspect-square rounded-xl bg-aura-cream overflow-hidden relative">
                        {failedImages[it.article_id] ? (
                          <ProductImagePlaceholder
                            category={it.standard_category}
                            productName={it.prod_name}
                            articleId={it.article_id}
                          />
                        ) : (
                          <img
                            src={`/images/${it.article_id.slice(0, 3)}/${it.article_id}.jpg`}
                            alt={it.prod_name}
                            onError={() => markImageFailed(it.article_id)}
                            className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                          />
                        )}
                      </div>
                      <p className="text-[11px] font-serif font-semibold text-aura-espresso line-clamp-1">
                        {it.prod_name}
                      </p>
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-[9px] font-mono uppercase tracking-wider text-aura-muted truncate">
                          {it.product_type_name || 'Piece'}
                        </p>
                        <span className="text-[10px] font-serif font-bold text-aura-espresso shrink-0">
                          {formatProductPrice(it)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 border-t border-aura-espresso/8 flex items-center justify-between">
                <span className="text-xs text-aura-muted font-light">
                  {outfit.items?.length || 0} coordinated garments
                </span>
                <button
                  onClick={() => {
                    if (outfit.items && outfit.items.length > 0) {
                      onOutfitClick(outfit.items[0]);
                    }
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-aura-espresso hover:bg-aura-dark text-aura-ivory rounded-full text-xs font-medium uppercase tracking-wider transition-colors shadow-xs"
                >
                  <span>Reopen Look</span>
                  <ArrowRight className="w-3.5 h-3.5 text-aura-champagne" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
