import React, { useState, useEffect } from 'react';
import { Search, Filter, SlidersHorizontal, ChevronLeft, ChevronRight, X, Sparkles, Ruler } from 'lucide-react';
import { fetchProducts } from '../services/api';
import ProductCard from './ProductCard';

export default function CatalogView({
  initialCategory = '',
  initialGender = '',
  onGenderChange,
  onSimilarClick,
  onOutfitClick,
  onLikeClick,
  onProductSelect,
  wishlistIds = [],
}) {
  const [products, setProducts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [category, setCategory] = useState(initialCategory);
  const [color, setColor] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [gender, setGender] = useState(() => {
    return initialGender || localStorage.getItem('aura_catalog_gender') || 'all';
  });

  // Sync category if navigated from external section (e.g. homepage silhouette click)
  useEffect(() => {
    if (initialCategory !== undefined && initialCategory !== category) {
      setCategory(initialCategory);
      setSelectedSize('');
      setPage(1);
    }
  }, [initialCategory]);

  // Sync external gender prop if provided
  useEffect(() => {
    if (initialGender && initialGender !== gender) {
      setGender(initialGender);
      setSelectedSize('');
      setPage(1);
    }
  }, [initialGender]);

  const categories = [
    { label: 'All Pieces', value: '' },
    { label: 'Tops & Shirts', value: 'upper_body' },
    { label: 'Trousers & Skirts', value: 'lower_body' },
    { label: 'Dresses & Jumpsuits', value: 'full_body' },
    { label: 'Footwear & Boots', value: 'shoes' },
    { label: 'Bags & Accessories', value: 'accessories' },
  ];

  const colors = [
    { label: 'All Tones', value: '' },
    { label: 'Black', value: 'Black' },
    { label: 'White', value: 'White' },
    { label: 'Dark Blue', value: 'Dark Blue' },
    { label: 'Light Beige', value: 'Light Beige' },
    { label: 'Grey', value: 'Grey' },
    { label: 'Red', value: 'Red' },
  ];

  const getCategorySizeOptions = (cat) => {
    switch (cat) {
      case 'upper_body':
        return ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
      case 'lower_body':
        return ['28', '30', '32', '34', '36', '38'];
      case 'full_body':
        return ['XS', 'S', 'M', 'L', 'XL'];
      case 'shoes':
        return ['UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'];
      case 'accessories':
        return ['One Size'];
      default:
        return ['XS', 'S', 'M', 'L', 'XL', '30', '32', '34', 'UK 8', 'UK 9', 'One Size'];
    }
  };

  useEffect(() => {
    loadCatalog();
  }, [page, category, color, search, gender, selectedSize]);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const res = await fetchProducts(page, limit, category, color, search, gender, selectedSize);
      setProducts(res.items || []);
      setTotalCount(res.total || 0);
    } catch (err) {
      console.error('Error loading catalog:', err);
      setProducts([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-200 space-y-8">
      {/* Editorial Catalog Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-aura-espresso/8 shadow-aura-subtle space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-aura-espresso/6 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-aura-cream border border-aura-espresso/10 text-aura-olive text-[10px] font-mono uppercase tracking-[0.22em] mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-aura-olive" />
              The Collection
            </div>
            <h1 className="text-3xl sm:text-5xl font-serif font-normal text-aura-espresso tracking-tight">
              Curated Wardrobe Pieces
            </h1>
            <p className="text-xs sm:text-sm text-aura-muted mt-1.5 font-normal max-w-xl">
              {totalCount.toLocaleString()} pieces carefully indexed for versatile styling, harmonious color pairing, and contemporary silhouettes.
            </p>
          </div>

          {/* Search Bar with Clear Button */}
          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Search by silhouette, knit, fabric..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-9 py-3 bg-aura-ivory border border-aura-espresso/15 rounded-full text-xs font-normal text-aura-espresso placeholder:text-aura-muted focus:outline-none focus:ring-1 focus:ring-aura-espresso focus:border-aura-espresso transition-all"
            />
            <Search className="w-4 h-4 text-aura-muted absolute left-3.5 top-3.5 stroke-[1.5]" />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3.5 top-3.5 text-aura-muted hover:text-aura-espresso"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>
        </div>

        {/* Department / Gender Scope Selector: Women | Men | All Pieces */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-b border-aura-espresso/6 pb-4">
          <span className="text-[11px] font-mono uppercase tracking-widest text-aura-muted mr-2 flex items-center gap-1 font-medium">
            Department:
          </span>
          {[
            { label: 'All Pieces', value: 'all' },
            { label: 'Women', value: 'women' },
            { label: 'Men', value: 'men' },
          ].map((g) => (
            <button
              key={g.value}
              onClick={() => {
                if (gender !== g.value) {
                  setGender(g.value);
                  setPage(1);
                  localStorage.setItem('aura_catalog_gender', g.value);
                  if (onGenderChange) onGenderChange(g.value);
                }
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider transition-all border ${
                gender === g.value
                  ? 'bg-aura-espresso text-aura-ivory border-aura-espresso shadow-xs'
                  : 'bg-white text-aura-espresso/80 border-aura-espresso/15 hover:border-aura-espresso/40 hover:bg-aura-ivory'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Category Slot Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-mono uppercase tracking-widest text-aura-muted mr-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-aura-olive" /> Silhouette:
          </span>
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => {
                setPage(1);
                setCategory(cat.value);
                setSelectedSize('');
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs transition-all ${
                category === cat.value
                  ? 'bg-aura-espresso text-aura-ivory font-medium shadow-xs'
                  : 'bg-aura-cream/60 text-aura-espresso/80 hover:bg-aura-cream hover:text-aura-espresso'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Color Palette Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-widest text-aura-muted mr-2 flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5 text-aura-olive" /> Palette:
          </span>
          {colors.map((c) => (
            <button
              key={c.value}
              onClick={() => {
                setPage(1);
                setColor(c.value);
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all border ${
                color === c.value
                  ? 'bg-aura-espresso text-aura-ivory border-aura-espresso shadow-xs'
                  : 'bg-white text-aura-espresso/70 border-aura-espresso/15 hover:border-aura-espresso/40'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Category-Conditioned Size Filter Strip */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-aura-espresso/6">
          <span className="text-[11px] font-mono uppercase tracking-widest text-aura-muted mr-2 flex items-center gap-1 font-medium">
            <Ruler className="w-3.5 h-3.5 text-aura-olive" /> Sizing:
          </span>
          <button
            onClick={() => {
              setPage(1);
              setSelectedSize('');
            }}
            className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all border ${
              selectedSize === ''
                ? 'bg-aura-espresso text-aura-ivory border-aura-espresso shadow-xs'
                : 'bg-white text-aura-espresso/70 border-aura-espresso/15 hover:border-aura-espresso/40'
            }`}
          >
            All Sizes
          </button>
          {getCategorySizeOptions(category).map((sz) => (
            <button
              key={sz}
              onClick={() => {
                setPage(1);
                setSelectedSize(sz === selectedSize ? '' : sz);
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-mono font-medium transition-all border ${
                selectedSize === sz
                  ? 'bg-aura-espresso text-aura-ivory border-aura-espresso shadow-xs'
                  : 'bg-white text-aura-espresso/70 border-aura-espresso/15 hover:border-aura-espresso/40'
              }`}
            >
              {sz}
            </button>
          ))}
          {selectedSize && (
            <button
              onClick={() => {
                setPage(1);
                setSelectedSize('');
              }}
              className="text-[10px] font-mono text-aura-olive hover:underline ml-1 uppercase tracking-wider"
            >
              Reset Size
            </button>
          )}
        </div>
      </div>

      {/* Products Grid Area */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-aura-espresso/8 p-3 space-y-3 shadow-aura-subtle animate-pulse"
            >
              <div className="aspect-[3/4] bg-aura-cream/60 rounded-xl" />
              <div className="h-4 bg-aura-cream rounded-md w-3/4" />
              <div className="h-3 bg-aura-ivory rounded-md w-1/2" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-aura-espresso/10 text-aura-muted space-y-3 shadow-aura-subtle">
          <Sparkles className="w-10 h-10 text-aura-taupe mx-auto" />
          <h3 className="text-xl font-serif text-aura-espresso">No pieces matched your selection</h3>
          <p className="text-xs max-w-sm mx-auto leading-relaxed">
            Try adjusting your search terms, selecting a broader silhouette, or resetting your color filters.
          </p>
          <button
            onClick={() => {
              setCategory('');
              setColor('');
              setSearch('');
              setSearchInput('');
              setPage(1);
            }}
            className="mt-4 px-6 py-2.5 bg-aura-espresso hover:bg-aura-dark text-aura-ivory rounded-full text-xs uppercase tracking-wider font-medium transition-colors"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {products.map((prod) => (
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

          {/* Editorial Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-12 pt-6 border-t border-aura-espresso/10 bg-white p-5 rounded-3xl shadow-aura-subtle">
            <button
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                window.scrollTo({ top: 300, behavior: 'smooth' });
              }}
              disabled={page === 1}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-aura-cream hover:bg-aura-taupe/30 active:bg-aura-taupe/50 disabled:opacity-30 disabled:cursor-not-allowed text-aura-espresso rounded-full text-xs font-medium uppercase tracking-wider transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <div className="text-center">
              <span className="text-xs font-serif font-semibold text-aura-espresso text-base">
                Page {page} of {totalPages}
              </span>
              <p className="text-[11px] text-aura-muted mt-0.5 font-mono">
                Showing {((page - 1) * limit) + 1} &ndash; {Math.min(page * limit, totalCount)} of {totalCount.toLocaleString()} pieces
              </p>
            </div>

            <button
              onClick={() => {
                setPage((p) => Math.min(totalPages, p + 1));
                window.scrollTo({ top: 300, behavior: 'smooth' });
              }}
              disabled={page >= totalPages}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-aura-espresso hover:bg-aura-dark active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed text-aura-ivory rounded-full text-xs font-medium uppercase tracking-wider transition-colors shadow-xs"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
