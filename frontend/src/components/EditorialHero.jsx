import React from 'react';
import { ArrowRight, Sparkles, Layers } from 'lucide-react';
import { formatPrice } from '../utils/formatters';

export default function EditorialHero({ onExploreCollection, onCreateOutfit, onProductSelect }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-aura-cream/70 via-aura-ivory to-aura-ivory py-16 sm:py-24 border-b border-aura-espresso/8">
      {/* Decorative Editorial Background Typography Watermark */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none select-none text-[16vw] font-serif font-light text-aura-espresso/[0.025] leading-none tracking-tighter">
        AURA
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Text Narrative (7 cols) */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* Editorial Kicker */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-aura-cream border border-aura-espresso/10 text-aura-espresso text-[11px] font-mono uppercase tracking-[0.22em]">
              <span className="w-1.5 h-1.5 rounded-full bg-aura-olive" />
              Autumn / Winter Editorial Edit
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-serif font-normal text-aura-espresso tracking-tight leading-[1.08]">
              Discover <br />
              <span className="italic font-normal text-aura-espresso/90">Your Style.</span>
            </h1>

            {/* Supporting Prose */}
            <p className="text-base sm:text-lg text-aura-muted max-w-xl mx-auto lg:mx-0 font-normal leading-relaxed">
              Find pieces you love. Create looks that feel like you. Seamless wardrobe curation powered by thoughtful garment intelligence.
            </p>

            {/* Direct Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4">
              <button
                onClick={onExploreCollection}
                className="w-full sm:w-auto px-8 py-4 bg-aura-espresso hover:bg-aura-dark active:scale-[0.98] text-aura-ivory rounded-full text-xs font-medium uppercase tracking-[0.2em] transition-all shadow-aura-subtle flex items-center justify-center gap-2 group"
              >
                <span>Explore Collection</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>

              <button
                onClick={onCreateOutfit}
                className="w-full sm:w-auto px-8 py-4 bg-white/80 hover:bg-white active:scale-[0.98] text-aura-espresso border border-aura-espresso/20 rounded-full text-xs font-medium uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
              >
                <Layers className="w-4 h-4 text-aura-olive" />
                <span>Create Your Outfit</span>
              </button>
            </div>

            {/* Editorial Features Strip */}
            <div className="pt-8 grid grid-cols-3 gap-4 border-t border-aura-espresso/10 max-w-md mx-auto lg:mx-0 text-left">
              <div>
                <p className="text-lg sm:text-xl font-serif font-semibold text-aura-espresso">6,500+</p>
                <p className="text-[10px] uppercase font-mono tracking-wider text-aura-muted mt-0.5">Curated Pieces</p>
              </div>
              <div>
                <p className="text-lg sm:text-xl font-serif font-semibold text-aura-espresso">100%</p>
                <p className="text-[10px] uppercase font-mono tracking-wider text-aura-muted mt-0.5">Color Harmony</p>
              </div>
              <div>
                <p className="text-lg sm:text-xl font-serif font-semibold text-aura-espresso">Ensembles</p>
                <p className="text-[10px] uppercase font-mono tracking-wider text-aura-muted mt-0.5">Multi-Slot Studio</p>
              </div>
            </div>
          </div>

          {/* Right Editorial Lookbook Composition (5 cols) */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-sm sm:max-w-md">
              {/* Primary Campaign Visual Card — Click to open dedicated Product Detail */}
              <div
                onClick={() =>
                  onProductSelect &&
                  onProductSelect({
                    article_id: '0202017055',
                    prod_name: 'Minimalist Silhouette Dress',
                    product_type_name: 'Dress',
                    standard_category: 'full_body',
                    colour_group_name: 'White',
                    price_cents: 2999,
                    has_image: true,
                  })
                }
                className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-aura-cream shadow-aura-card border border-aura-espresso/10 group cursor-pointer hover:border-aura-espresso/30 transition-all"
                title="View Minimalist Silhouette Dress details"
              >
                <img
                  src="/images/020/0202017055.jpg"
                  alt="Editorial Campaign Look"
                  onError={(e) => {
                    // Graceful fallback to real sweater image if dress is unavailable
                    e.currentTarget.src = '/images/014/0145872001.jpg';
                  }}
                  className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                />
                
                {/* Floating Editorial Badge Overlay */}
                <div className="absolute bottom-5 left-5 right-5 p-4 bg-white/90 backdrop-blur-md rounded-2xl border border-aura-espresso/10 text-aura-espresso shadow-aura-subtle transition-transform duration-300 group-hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-aura-olive">
                        Featured Piece
                      </p>
                      <h3 className="font-serif text-sm font-semibold truncate group-hover:text-aura-olive transition-colors">
                        Minimalist Silhouette Dress
                      </h3>
                    </div>
                    <span className="text-xs font-serif font-bold text-aura-espresso">
                      {formatPrice(4499)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Offset Accent Mini Card — Click to open dedicated Product Detail */}
              <div
                onClick={() =>
                  onProductSelect &&
                  onProductSelect({
                    article_id: '0112679048',
                    prod_name: 'Soft Texture Knitwear',
                    product_type_name: 'Sweater',
                    standard_category: 'upper_body',
                    colour_group_name: 'Grey',
                    price_cents: 2999,
                    has_image: true,
                  })
                }
                className="hidden sm:block absolute -bottom-6 -left-8 w-44 aspect-square rounded-2xl overflow-hidden bg-white p-2 shadow-aura-hover border border-aura-espresso/10 animate-in fade-in duration-300 cursor-pointer group hover:border-aura-espresso/30 hover:scale-105 transition-all"
                title="View Soft Texture Knitwear details"
              >
                <div className="relative w-full h-full rounded-xl overflow-hidden bg-aura-cream">
                  <img
                    src="/images/011/0112679048.jpg"
                    alt="Accent Knit Piece"
                    onError={(e) => {
                      e.currentTarget.src = '/images/010/0108775015.jpg';
                    }}
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-aura-espresso/60 via-transparent to-transparent flex items-end p-2">
                    <span className="text-[10px] font-mono uppercase text-white tracking-wider">
                      Soft Textures
                    </span>
                  </div>
                </div>
              </div>

              {/* Floating Floating Tag */}
              <div className="absolute -top-3 -right-3 px-3.5 py-1.5 rounded-full bg-aura-espresso text-aura-ivory text-[10px] font-mono uppercase tracking-[0.2em] shadow-md">
                Look 01 &bull; SS26
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
