import React, { useState, useEffect } from 'react';
import { ArrowRight, Sparkles, Layers, Heart, Compass, ShieldCheck } from 'lucide-react';
import EditorialHero from './EditorialHero';
import ProductCard from './ProductCard';
import { fetchProducts } from '../services/api';

export default function HomepageView({
  onNavigate,
  onProductSelect,
  onSelectCategory,
  onOutfitClick,
  onSimilarClick,
  onLikeClick,
  wishlistIds = [],
}) {
  const [spotlightItems, setSpotlightItems] = useState([]);
  const [trendingItems, setTrendingItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHomepageContent();
  }, []);

  const loadHomepageContent = async () => {
    setLoading(true);
    try {
      // Fetch 8 spotlight items and 8 trending items from real backend catalog
      const [res1, res2] = await Promise.all([
        fetchProducts(1, 8, 'upper_body', '', ''),
        fetchProducts(1, 8, '', 'Black', ''),
      ]);
      setSpotlightItems(res1.items || []);
      setTrendingItems(res2.items || []);
    } catch (err) {
      console.error('Failed to load homepage content:', err);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    {
      slot: 'upper_body',
      title: 'Tops & Knitwear',
      subtitle: 'Sculpted layers, tailored shirts & fine knits',
      img: '/images/011/0112679048.jpg',
    },
    {
      slot: 'lower_body',
      title: 'Trousers & Skirts',
      subtitle: 'Wide-leg draping, structured denim & clean lines',
      img: '/images/070/0706016001.jpg',
    },
    {
      slot: 'full_body',
      title: 'Dresses & Jumpsuits',
      subtitle: 'Effortless day-to-evening one-piece silhouettes',
      img: '/images/020/0202017055.jpg',
    },
    {
      slot: 'shoes',
      title: 'Footwear & Boots',
      subtitle: 'Modern leather staples, loafers & sculpted heels',
      img: '/images/014/0145872001.jpg',
    },
    {
      slot: 'accessories',
      title: 'Accessories & Bags',
      subtitle: 'Minimalist leather goods, scarves & timeless accents',
      img: '/images/010/0108775015.jpg',
    },
  ];

  return (
    <div className="space-y-20 pb-20 animate-in fade-in duration-300">
      {/* 1. Large Editorial Campaign Hero */}
      <EditorialHero
        onExploreCollection={() => onNavigate('shop')}
        onCreateOutfit={() => onNavigate('outfits')}
        onProductSelect={onProductSelect}
      />

      {/* 2. Curated Editorial Manifesto Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-aura-cream/60 rounded-3xl p-8 sm:p-12 border border-aura-espresso/8 text-center max-w-4xl mx-auto space-y-4">
          <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-aura-olive font-medium">
            The AURA Philosophy
          </p>
          <h2 className="text-2xl sm:text-4xl font-serif font-light text-aura-espresso leading-snug">
            Wardrobe building shouldn't be about endless scrolling. It should feel like opening a <span className="italic font-normal">curated personal lookbook.</span>
          </h2>
          <p className="text-xs sm:text-sm text-aura-muted max-w-xl mx-auto leading-relaxed">
            Every garment in our collection is analyzed by silhouette, tone, and texture — giving you intelligent outfit pairings that feel natural and authentic.
          </p>
        </div>
      </section>

      {/* 3. Discover the Collection (Spotlight Edit) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-aura-espresso/10 pb-5">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-aura-olive mb-1">
              Curated Spotlight
            </p>
            <h2 className="text-2xl sm:text-3xl font-serif text-aura-espresso font-light">
              Essential Layers & Silhouette Pieces
            </h2>
          </div>
          <button
            onClick={() => onNavigate('shop')}
            className="self-start sm:self-auto text-xs uppercase tracking-[0.18em] font-medium text-aura-espresso hover:text-aura-olive flex items-center gap-1.5 transition-colors group"
          >
            <span>View All Pieces</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-aura-cream/60 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {spotlightItems.slice(0, 4).map((product) => (
              <ProductCard
                key={product.article_id}
                product={product}
                isLiked={wishlistIds.includes(product.article_id)}
                onSelectProduct={onProductSelect}
                onOutfitClick={onOutfitClick}
                onSimilarClick={onSimilarClick}
                onLikeClick={onLikeClick}
              />
            ))}
          </div>
        )}
      </section>

      {/* 4. Complete the Look — Interactive Outfit Teaser */}
      <section className="bg-aura-espresso text-aura-ivory py-16 sm:py-20 my-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Narrative (5 cols) */}
            <div className="lg:col-span-5 space-y-5">
              <span className="px-3 py-1 rounded-full bg-white/10 text-aura-champagne text-[10px] font-mono uppercase tracking-[0.24em]">
                Interactive Styling
              </span>
              <h2 className="text-3xl sm:text-5xl font-serif font-light text-white leading-tight">
                Complete The Look. <br />
                <span className="italic text-aura-champagne font-normal">Effortlessly.</span>
              </h2>
              <p className="text-xs sm:text-sm text-aura-cream/70 leading-relaxed font-light">
                Select any garment — whether a tailored coat, silk shirt, or pleated trouser — and let our compatibility engine assemble harmonious footwear and accessories around your anchor piece.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => onNavigate('outfits')}
                  className="px-7 py-3.5 bg-aura-ivory hover:bg-white active:scale-95 text-aura-espresso rounded-full text-xs font-medium uppercase tracking-[0.2em] transition-all flex items-center gap-2 group"
                >
                  <Layers className="w-4 h-4 text-aura-olive" />
                  <span>Open Outfit Studio</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>

            {/* Right Coordinated Visual Trio (7 cols) */}
            <div className="lg:col-span-7 grid grid-cols-3 gap-3 sm:gap-4">
              <div
                onClick={() =>
                  onProductSelect &&
                  onProductSelect({
                    article_id: '0145872001',
                    prod_name: 'Dorian Basic Knit',
                    product_type_name: 'Sweater',
                    standard_category: 'upper_body',
                    colour_group_name: 'Black',
                    price_cents: 2999,
                    has_image: true,
                  })
                }
                className="space-y-2 cursor-pointer group"
                title="View Dorian Basic Knit details"
              >
                <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-aura-champagne/40 transition-colors">
                  <img
                    src="/images/014/0145872001.jpg"
                    alt="Upper Body Slot"
                    onError={(e) => { e.currentTarget.src = '/images/010/0108775015.jpg'; }}
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-aura-champagne">01. Top</p>
                  <p className="text-xs font-serif text-white truncate group-hover:text-aura-champagne transition-colors">Dorian Basic Knit</p>
                </div>
              </div>

              <div
                onClick={() =>
                  onProductSelect &&
                  onProductSelect({
                    article_id: '0706016001',
                    prod_name: 'Skinny Denim TRS',
                    product_type_name: 'Trousers',
                    standard_category: 'lower_body',
                    colour_group_name: 'Black',
                    price_cents: 2999,
                    has_image: true,
                  })
                }
                className="space-y-2 translate-y-3 sm:translate-y-4 cursor-pointer group"
                title="View Skinny Denim TRS details"
              >
                <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-aura-champagne/40 transition-colors">
                  <img
                    src="/images/070/0706016001.jpg"
                    alt="Lower Body Slot"
                    onError={(e) => { e.currentTarget.src = '/images/011/0112679048.jpg'; }}
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-aura-champagne">02. Trouser</p>
                  <p className="text-xs font-serif text-white truncate group-hover:text-aura-champagne transition-colors">Skinny Denim TRS</p>
                </div>
              </div>

              <div
                onClick={() =>
                  onProductSelect &&
                  onProductSelect({
                    article_id: '0112679052',
                    prod_name: 'Light Blue Layer',
                    product_type_name: 'Sweater',
                    standard_category: 'upper_body',
                    colour_group_name: 'Light Blue',
                    price_cents: 2999,
                    has_image: true,
                  })
                }
                className="space-y-2 cursor-pointer group"
                title="View Light Blue Layer details"
              >
                <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-aura-champagne/40 transition-colors">
                  <img
                    src="/images/011/0112679052.jpg"
                    alt="Accent Knit Slot"
                    onError={(e) => { e.currentTarget.src = '/images/020/0202017055.jpg'; }}
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-aura-champagne">03. Accent</p>
                  <p className="text-xs font-serif text-white truncate group-hover:text-aura-champagne transition-colors">Light Blue Layer</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Explore by Silhouette & Category */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-aura-olive font-medium">
            Wardrobe Architecture
          </p>
          <h2 className="text-2xl sm:text-3xl font-serif text-aura-espresso font-light">
            Explore By Silhouette
          </h2>
          <p className="text-xs text-aura-muted">
            Thoughtfully grouped into structural wardrobe categories to make pairing seamless.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {categories.map((cat, idx) => (
            <div
              key={idx}
              onClick={() => (onSelectCategory ? onSelectCategory(cat.slot) : onNavigate('shop'))}
              title={`Explore ${cat.title} in The Collection`}
              className="group bg-white rounded-2xl p-4 border border-aura-espresso/8 shadow-aura-subtle cursor-pointer hover:shadow-aura-card hover:border-aura-espresso/20 transition-all flex flex-col justify-between"
            >
              <div className="aspect-[4/5] rounded-xl overflow-hidden bg-aura-cream/60 mb-3 relative">
                <img
                  src={cat.img}
                  alt={cat.title}
                  onError={(e) => { e.currentTarget.src = '/images/010/0108775015.jpg'; }}
                  className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-serif font-semibold text-aura-espresso group-hover:text-aura-olive transition-colors">
                  {cat.title}
                </h3>
                <p className="text-[11px] text-aura-muted leading-snug line-clamp-2">
                  {cat.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Trending Now */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-aura-espresso/10 pb-5">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-aura-olive mb-1">
              Current Desires
            </p>
            <h2 className="text-2xl sm:text-3xl font-serif text-aura-espresso font-light">
              Trending In The Lookbook
            </h2>
          </div>
          <button
            onClick={() => onNavigate('shop')}
            className="self-start sm:self-auto text-xs uppercase tracking-[0.18em] font-medium text-aura-espresso hover:text-aura-olive flex items-center gap-1.5 transition-colors group"
          >
            <span>Explore All 5,000 Pieces</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-aura-cream/60 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {trendingItems.slice(0, 4).map((product) => (
              <ProductCard
                key={product.article_id}
                product={product}
                isLiked={wishlistIds.includes(product.article_id)}
                onSelectProduct={onProductSelect}
                onOutfitClick={onOutfitClick}
                onSimilarClick={onSimilarClick}
                onLikeClick={onLikeClick}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
