import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Compass, Loader2 } from 'lucide-react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomepageView from './components/HomepageView';
import CatalogView from './components/CatalogView';
import ProductDetailView from './components/ProductDetailView';
import SimilarView from './components/SimilarView';
import OutfitStudio from './components/OutfitStudio';
import PersonalizedFeed from './components/PersonalizedFeed';
import WishlistView from './components/WishlistView';
import SavedOutfitsView from './components/SavedOutfitsView';
import SystemArchitectureView from './components/SystemArchitectureView';
import NotificationToast from './components/NotificationToast';
import { WishlistProvider, useWishlist } from './context/WishlistContext';
import { recordInteraction, fetchProductById } from './services/api';

/**
 * Clean URL Router Helper
 * Maps browser location to views, extracts parameters, handles legacy redirects.
 */
function parseUrl(pathname = window.location.pathname, search = window.location.search) {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(search);

  // 1. Legacy Query Redirects: ?tab=... or ?view=...
  const legacyTab = params.get('tab') || params.get('view');
  if (legacyTab) {
    const qProduct = params.get('product') || params.get('item');
    if (legacyTab === 'discover') return { tab: 'discover', redirect: '/' };
    if (legacyTab === 'shop') {
      const rest = new URLSearchParams();
      if (params.get('gender')) rest.set('gender', params.get('gender'));
      if (params.get('category')) rest.set('category', params.get('category'));
      const q = rest.toString();
      return {
        tab: 'shop',
        redirect: q ? `/shop?${q}` : '/shop',
        gender: params.get('gender') || undefined,
        category: params.get('category') || undefined,
      };
    }
    if (legacyTab === 'outfits') {
      const q = qProduct ? `?anchor=${qProduct}` : '';
      return { tab: 'outfits', anchorId: qProduct, redirect: `/outfits${q}` };
    }
    if (legacyTab === 'for_you' || legacyTab === 'for-you') return { tab: 'for_you', redirect: '/for-you' };
    if (legacyTab === 'wishlist') return { tab: 'wishlist', redirect: '/wishlist' };
    if (legacyTab === 'saved_outfits' || legacyTab === 'saved-outfits') return { tab: 'saved_outfits', redirect: '/saved-outfits' };
    if (legacyTab === 'architecture') return { tab: 'architecture', redirect: '/architecture' };
    if (legacyTab === 'product' && qProduct) return { tab: 'product', productId: qProduct, redirect: `/product/${qProduct}` };
    if (legacyTab === 'similar' && qProduct) return { tab: 'similar', productId: qProduct, redirect: `/similar/${qProduct}` };
  }

  // 2. Direct Clean Path Routes
  if (cleanPath === '' || cleanPath === '/') {
    return { tab: 'discover' };
  }
  if (cleanPath === '/shop') {
    return {
      tab: 'shop',
      gender: params.get('gender') || undefined,
      category: params.get('category') || undefined,
    };
  }
  if (cleanPath === '/outfits') {
    return {
      tab: 'outfits',
      anchorId: params.get('anchor') || undefined,
    };
  }
  if (cleanPath === '/for-you' || cleanPath === '/for_you') {
    return { tab: 'for_you' };
  }
  if (cleanPath === '/wishlist') {
    return { tab: 'wishlist' };
  }
  if (cleanPath === '/saved-outfits' || cleanPath === '/saved_outfits') {
    return { tab: 'saved_outfits' };
  }
  if (cleanPath === '/architecture') {
    return { tab: 'architecture' };
  }

  // /product/:productId
  const prodMatch = cleanPath.match(/^\/product\/([^\/]+)$/);
  if (prodMatch) {
    return { tab: 'product', productId: decodeURIComponent(prodMatch[1]) };
  }

  // /similar/:productId
  const simMatch = cleanPath.match(/^\/similar\/([^\/]+)$/);
  if (simMatch) {
    return { tab: 'similar', productId: decodeURIComponent(simMatch[1]) };
  }

  // Fallback 404 Route
  return { tab: 'not_found', path: cleanPath };
}

function AppContent({ activeUser, setActiveUser, toast, setToast, showToast }) {
  const [activeTab, setActiveTab] = useState('discover');
  const [previousTab, setPreviousTab] = useState('discover');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [anchorProduct, setAnchorProduct] = useState(null);
  const [recentViewIds, setRecentViewIds] = useState([]);
  const [productLoading, setProductLoading] = useState(false);

  // Synchronization refs to avoid stale closures and eliminate redundant network cascades
  const anchorProductRef = useRef(anchorProduct);
  useEffect(() => {
    anchorProductRef.current = anchorProduct;
  }, [anchorProduct]);

  const selectedProductRef = useRef(selectedProduct);
  useEffect(() => {
    selectedProductRef.current = selectedProduct;
  }, [selectedProduct]);

  // Persistent Gender Scope (defaults to 'all', can be 'women' or 'men')
  const [selectedGender, setSelectedGender] = useState(() => {
    return localStorage.getItem('aura_catalog_gender') || 'all';
  });

  // Centralized Wishlist Store Hook
  const { wishlistIds, isWishlisted, toggleWishlist, wishlistCount } = useWishlist();

  // Async Product Loader for Direct Link / Refresh
  const loadProduct = useCallback(async (id) => {
    if (selectedProductRef.current && selectedProductRef.current.article_id === id) {
      return;
    }
    setProductLoading(true);
    try {
      const prod = await fetchProductById(id);
      setSelectedProduct(prod);
    } catch (err) {
      console.error('Failed to load product by id:', err);
      showToast(`Garment #${id} could not be loaded`, 'error');
      setActiveTab('shop');
      window.history.replaceState(null, '', '/shop');
    } finally {
      setProductLoading(false);
    }
  }, [showToast]);

  const loadAnchor = useCallback(async (id) => {
    if (anchorProductRef.current && anchorProductRef.current.article_id === id) {
      return;
    }
    try {
      const prod = await fetchProductById(id);
      setAnchorProduct(prod);
    } catch (err) {
      console.error('Failed to load anchor:', err);
    }
  }, []);

  // Initial Route Sync on Mount (runs strictly once on initialization)
  useEffect(() => {
    const parsed = parseUrl();
    if (parsed.redirect) {
      window.history.replaceState(null, '', parsed.redirect);
    }
    if (parsed.gender && ['women', 'men', 'all'].includes(parsed.gender)) {
      setSelectedGender(parsed.gender);
    }
    if (parsed.category) {
      setSelectedCategory(parsed.category);
    }
    if (parsed.anchorId) {
      loadAnchor(parsed.anchorId);
    }
    if (parsed.productId) {
      loadProduct(parsed.productId);
    }
    setActiveTab(parsed.tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Browser Back / Forward Handling (window.onpopstate)
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseUrl();
      if (parsed.redirect) {
        window.history.replaceState(null, '', parsed.redirect);
      }
      if (parsed.gender && ['women', 'men', 'all'].includes(parsed.gender)) {
        setSelectedGender(parsed.gender);
      }
      if (parsed.category) {
        setSelectedCategory(parsed.category);
      }
      if (parsed.anchorId && (!anchorProductRef.current || anchorProductRef.current.article_id !== parsed.anchorId)) {
        loadAnchor(parsed.anchorId);
      }
      if (parsed.productId && (!selectedProductRef.current || selectedProductRef.current.article_id !== parsed.productId)) {
        loadProduct(parsed.productId);
      }
      setActiveTab(parsed.tab);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [loadAnchor, loadProduct]);

  const handleGenderChange = (gender) => {
    setSelectedGender(gender);
    localStorage.setItem('aura_catalog_gender', gender);
    if (activeTab === 'shop') {
      const p = new URLSearchParams(window.location.search);
      if (gender && gender !== 'all') p.set('gender', gender);
      else p.delete('gender');
      const q = p.toString();
      window.history.replaceState(null, '', q ? `/shop?${q}` : '/shop');
    }
  };

  const navigateTo = (tab, extra = {}) => {
    let targetTab = tab;
    let targetPath = '/';

    if (tab === 'discover' || tab === '/') {
      targetTab = 'discover';
      targetPath = '/';
    } else if (tab === 'shop' || tab === '/shop') {
      targetTab = 'shop';
      const p = new URLSearchParams();
      const g = extra.gender !== undefined ? extra.gender : selectedGender;
      const c = extra.category !== undefined ? extra.category : selectedCategory;
      if (g && g !== 'all') p.set('gender', g);
      if (c) p.set('category', c);
      const q = p.toString();
      targetPath = q ? `/shop?${q}` : '/shop';
    } else if (tab === 'outfits' || tab === '/outfits') {
      targetTab = 'outfits';
      const anchor = extra.anchor || anchorProduct;
      targetPath = anchor?.article_id ? `/outfits?anchor=${anchor.article_id}` : '/outfits';
    } else if (tab === 'for_you' || tab === 'for-you' || tab === '/for-you') {
      targetTab = 'for_you';
      targetPath = '/for-you';
    } else if (tab === 'wishlist' || tab === '/wishlist') {
      targetTab = 'wishlist';
      targetPath = '/wishlist';
    } else if (tab === 'saved_outfits' || tab === 'saved-outfits' || tab === '/saved-outfits') {
      targetTab = 'saved_outfits';
      targetPath = '/saved-outfits';
    } else if (tab === 'architecture' || tab === '/architecture') {
      targetTab = 'architecture';
      targetPath = '/architecture';
    } else if (tab === 'product') {
      targetTab = 'product';
      const prod = extra.product || selectedProduct;
      if (prod) {
        setSelectedProduct(prod);
        targetPath = `/product/${prod.article_id}`;
      } else {
        targetTab = 'shop';
        targetPath = '/shop';
      }
    } else if (tab === 'similar') {
      targetTab = 'similar';
      const prod = extra.product || selectedProduct;
      if (prod) {
        setSelectedProduct(prod);
        targetPath = `/similar/${prod.article_id}`;
      } else {
        targetTab = 'shop';
        targetPath = '/shop';
      }
    } else if (typeof tab === 'string' && tab.startsWith('/product/')) {
      targetTab = 'product';
      targetPath = tab;
      const pid = tab.replace('/product/', '');
      if (!selectedProduct || selectedProduct.article_id !== pid) {
        loadProduct(pid);
      }
    } else if (typeof tab === 'string' && tab.startsWith('/similar/')) {
      targetTab = 'similar';
      targetPath = tab;
      const pid = tab.replace('/similar/', '');
      if (!selectedProduct || selectedProduct.article_id !== pid) {
        loadProduct(pid);
      }
    } else {
      targetTab = 'not_found';
      targetPath = tab;
    }

    if (activeTab !== targetTab && activeTab !== 'product' && activeTab !== 'similar') {
      setPreviousTab(activeTab);
    }
    window.history.pushState(null, '', targetPath);
    setActiveTab(targetTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCategory = (slot) => {
    setSelectedCategory(slot);
    const p = new URLSearchParams();
    if (selectedGender && selectedGender !== 'all') p.set('gender', selectedGender);
    if (slot) p.set('category', slot);
    const q = p.toString();
    const newPath = q ? `/shop?${q}` : '/shop';
    window.history.pushState(null, '', newPath);
    setActiveTab('shop');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Direct Product Card Selection -> Dedicated Full-Page Product Detail View
  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setPreviousTab(activeTab === 'product' ? previousTab : activeTab);
    setActiveTab('product');
    window.history.pushState(null, '', `/product/${product.article_id}`);
    recordInteraction(activeUser, product.article_id, 'view', { component: 'product_detail' });
    setRecentViewIds((prev) => [product.article_id, ...prev.filter((id) => id !== product.article_id)].slice(0, 10));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Find Similar Action -> Dedicated Similar Pieces View
  const handleSimilarClick = (product) => {
    setSelectedProduct(product);
    setActiveTab('similar');
    window.history.pushState(null, '', `/similar/${product.article_id}`);
    recordInteraction(activeUser, product.article_id, 'view', { action: 'open_similar' });
    setRecentViewIds((prev) => [product.article_id, ...prev.filter((id) => id !== product.article_id)].slice(0, 10));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Style in Outfit Studio Action -> Wardrobe Builder with Selected Anchor
  const handleOutfitClick = (product) => {
    setAnchorProduct(product);
    setActiveTab('outfits');
    window.history.pushState(null, '', `/outfits?anchor=${product.article_id}`);
    recordInteraction(activeUser, product.article_id, 'view', { action: 'style_outfit' });
    setRecentViewIds((prev) => [product.article_id, ...prev.filter((id) => id !== product.article_id)].slice(0, 10));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Centralized Wishlist Toggle
  const handleLikeClick = (product, isLiked) => {
    toggleWishlist(product, isLiked);
    if (isLiked) {
      setRecentViewIds((prev) => [product.article_id, ...prev.filter((id) => id !== product.article_id)].slice(0, 10));
    }
  };

  return (
    <div className="min-h-screen bg-aura-ivory text-aura-espresso flex flex-col selection:bg-aura-espresso selection:text-aura-ivory">
      {/* 1. Global Luxury Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={navigateTo}
        activeUser={activeUser}
        setActiveUser={setActiveUser}
        wishlistCount={wishlistCount}
        onOpenSearch={() => navigateTo('shop')}
      />

      {/* 2. Main Dedicated View Router */}
      <main className="flex-1">
        {/* DISCOVER: Editorial Campaign Homepage */}
        {activeTab === 'discover' && (
          <HomepageView
            onNavigate={navigateTo}
            onProductSelect={handleProductSelect}
            onSelectCategory={handleSelectCategory}
            onOutfitClick={handleOutfitClick}
            onSimilarClick={handleSimilarClick}
            onLikeClick={handleLikeClick}
            wishlistIds={wishlistIds}
          />
        )}

        {/* SHOP: The Collection (Full Catalog with Department Filters) */}
        {activeTab === 'shop' && (
          <CatalogView
            initialCategory={selectedCategory}
            initialGender={selectedGender}
            onGenderChange={handleGenderChange}
            onSimilarClick={handleSimilarClick}
            onOutfitClick={handleOutfitClick}
            onLikeClick={handleLikeClick}
            onProductSelect={handleProductSelect}
            wishlistIds={wishlistIds}
          />
        )}

        {/* DEDICATED FULL-PAGE PRODUCT DETAIL */}
        {activeTab === 'product' && (
          productLoading ? (
            <div className="py-24 text-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-aura-olive" />
              <p className="font-serif text-sm text-aura-espresso">Curating garment details...</p>
            </div>
          ) : selectedProduct ? (
            <ProductDetailView
              product={selectedProduct}
              onBack={() => navigateTo(previousTab || 'shop')}
              onSimilarClick={handleSimilarClick}
              onOutfitClick={handleOutfitClick}
              onLikeClick={handleLikeClick}
              isLiked={isWishlisted(selectedProduct.article_id)}
            />
          ) : (
            <div className="max-w-xl mx-auto px-4 py-24 text-center space-y-4">
              <p className="font-serif text-lg text-aura-espresso">Garment Not Found</p>
              <button
                onClick={() => navigateTo('shop')}
                className="px-6 py-2.5 bg-aura-espresso text-aura-ivory rounded-full text-xs uppercase tracking-widest font-medium"
              >
                Browse Collection
              </button>
            </div>
          )
        )}

        {/* DEDICATED SIMILAR PIECES VIEW */}
        {activeTab === 'similar' && (
          productLoading ? (
            <div className="py-24 text-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-aura-olive" />
              <p className="font-serif text-sm text-aura-espresso">Finding similar silhouettes...</p>
            </div>
          ) : selectedProduct ? (
            <SimilarView
              product={selectedProduct}
              onBack={() => navigateTo('product')}
              onProductSelect={handleProductSelect}
              onOutfitClick={handleOutfitClick}
              onLikeClick={handleLikeClick}
              wishlistIds={wishlistIds}
            />
          ) : (
            <div className="max-w-xl mx-auto px-4 py-24 text-center space-y-4">
              <p className="font-serif text-lg text-aura-espresso">Garment Not Found</p>
              <button
                onClick={() => navigateTo('shop')}
                className="px-6 py-2.5 bg-aura-espresso text-aura-ivory rounded-full text-xs uppercase tracking-widest font-medium"
              >
                Browse Collection
              </button>
            </div>
          )
        )}

        {/* OUTFIT STUDIO: Interactive Wardrobe Synthesizer with Look History */}
        {activeTab === 'outfits' && (
          <OutfitStudio
            anchorProduct={anchorProduct}
            activeUser={activeUser}
            globalGender={selectedGender}
            onNavigateCatalog={() => navigateTo('shop')}
            onSelectAnchor={(item) => setAnchorProduct(item)}
            onProductSelect={handleProductSelect}
            onToast={showToast}
          />
        )}

        {/* FOR YOU: Personalized Shopping Concierge */}
        {activeTab === 'for_you' && (
          <PersonalizedFeed
            activeUser={activeUser}
            gender={selectedGender}
            onSimilarClick={handleSimilarClick}
            onOutfitClick={handleOutfitClick}
            onLikeClick={handleLikeClick}
            onNavigateCatalog={() => navigateTo('shop')}
            onProductSelect={handleProductSelect}
            wishlistIds={wishlistIds}
            recentViewIds={recentViewIds}
          />
        )}

        {/* WISHLIST: Saved Favorites Portfolio */}
        {activeTab === 'wishlist' && (
          <WishlistView
            activeUser={activeUser}
            onProductSelect={handleProductSelect}
            onOutfitClick={handleOutfitClick}
            onSimilarClick={handleSimilarClick}
            onNavigateShop={() => navigateTo('shop')}
          />
        )}

        {/* SAVED OUTFITS: Saved Wardrobe Ensembles */}
        {activeTab === 'saved_outfits' && (
          <SavedOutfitsView
            activeUser={activeUser}
            onOutfitClick={handleOutfitClick}
            onNavigateCatalog={() => navigateTo('shop')}
            onProductSelect={handleProductSelect}
          />
        )}

        {/* DEDICATED SYSTEM ARCHITECTURE PORTAL */}
        {activeTab === 'architecture' && (
          <SystemArchitectureView
            onBackToShopping={() => navigateTo('discover')}
          />
        )}

        {/* 404 NOT FOUND */}
        {activeTab === 'not_found' && (
          <div className="max-w-xl mx-auto px-4 py-28 text-center space-y-6 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-aura-cream mx-auto flex items-center justify-center">
              <Compass className="w-8 h-8 text-aura-olive" />
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-aura-olive font-medium">404 Error</p>
              <h1 className="text-3xl font-serif text-aura-espresso font-normal">Page Not Found</h1>
              <p className="text-xs text-aura-muted max-w-sm mx-auto">
                The requested fashion route could not be located in our editorial collection.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => navigateTo('discover')}
                className="px-6 py-2.5 bg-aura-espresso text-aura-ivory rounded-full text-xs font-medium uppercase tracking-widest hover:bg-aura-dark transition-colors shadow-xs"
              >
                Return to Home
              </button>
              <button
                onClick={() => navigateTo('shop')}
                className="px-6 py-2.5 bg-aura-cream text-aura-espresso rounded-full text-xs font-medium uppercase tracking-widest hover:bg-aura-taupe/30 transition-colors"
              >
                Browse Collection
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 3. Global Notification Toast */}
      <NotificationToast toast={toast} onDismiss={() => setToast(null)} />

      {/* 4. Luxury Editorial Footer */}
      <Footer onNavigate={navigateTo} />
    </div>
  );
}

export default function App() {
  const [activeUser, setActiveUser] = useState('user_000001');
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  return (
    <WishlistProvider activeUser={activeUser} onToast={showToast}>
      <AppContent
        activeUser={activeUser}
        setActiveUser={setActiveUser}
        toast={toast}
        setToast={setToast}
        showToast={showToast}
      />
    </WishlistProvider>
  );
}
