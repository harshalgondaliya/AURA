import React, { useState, useEffect } from 'react';
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
import { recordInteraction, fetchUserFavorites } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('discover'); // 'discover', 'shop', 'outfits', 'for_you', 'wishlist', 'saved_outfits', 'product', 'similar', 'architecture'
  const [previousTab, setPreviousTab] = useState('discover');
  const [activeUser, setActiveUser] = useState('user_000001');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [anchorProduct, setAnchorProduct] = useState(null);
  const [recentViewIds, setRecentViewIds] = useState([]);
  const [wishlistIds, setWishlistIds] = useState([]);
  const [toast, setToast] = useState(null);

  // Load user wishlist on mount or user switch
  useEffect(() => {
    loadWishlist();
  }, [activeUser]);

  const loadWishlist = async () => {
    try {
      const favs = await fetchUserFavorites(activeUser);
      if (Array.isArray(favs)) {
        setWishlistIds(favs.map((p) => p.article_id));
      }
    } catch (err) {
      console.warn('Could not load user favorites:', err);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const navigateTo = (tab) => {
    if (activeTab !== tab && activeTab !== 'product' && activeTab !== 'similar') {
      setPreviousTab(activeTab);
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCategory = (slot) => {
    setSelectedCategory(slot);
    navigateTo('shop');
  };

  // Direct Product Card Selection -> Dedicated Full-Page Product Detail View
  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setPreviousTab(activeTab === 'product' ? previousTab : activeTab);
    setActiveTab('product');
    recordInteraction(activeUser, product.article_id, 'view', { component: 'product_detail' });
    setRecentViewIds((prev) => [product.article_id, ...prev.filter((id) => id !== product.article_id)].slice(0, 10));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Find Similar Action -> Dedicated Similar Pieces View
  const handleSimilarClick = (product) => {
    setSelectedProduct(product);
    setActiveTab('similar');
    recordInteraction(activeUser, product.article_id, 'view', { action: 'open_similar' });
    setRecentViewIds((prev) => [product.article_id, ...prev.filter((id) => id !== product.article_id)].slice(0, 10));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Style in Outfit Studio Action -> Wardrobe Builder with Selected Anchor
  const handleOutfitClick = (product) => {
    setAnchorProduct(product);
    setActiveTab('outfits');
    recordInteraction(activeUser, product.article_id, 'view', { action: 'style_outfit' });
    setRecentViewIds((prev) => [product.article_id, ...prev.filter((id) => id !== product.article_id)].slice(0, 10));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Direct Wishlist Toggle
  const handleLikeClick = async (product, isLiked) => {
    const action = isLiked ? 'like' : 'dismiss';
    await recordInteraction(activeUser, product.article_id, action, { component: 'card' });
    if (isLiked) {
      setWishlistIds((prev) => [...prev.filter((id) => id !== product.article_id), product.article_id]);
      showToast(`Added "${product.prod_name}" to your Wishlist.`);
      setRecentViewIds((prev) => [product.article_id, ...prev.filter((id) => id !== product.article_id)].slice(0, 10));
    } else {
      setWishlistIds((prev) => prev.filter((id) => id !== product.article_id));
      showToast(`Removed "${product.prod_name}" from Wishlist.`);
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
        wishlistCount={wishlistIds.length}
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

        {/* SHOP: The Collection (Full Catalog) */}
        {activeTab === 'shop' && (
          <CatalogView
            initialCategory={selectedCategory}
            onSimilarClick={handleSimilarClick}
            onOutfitClick={handleOutfitClick}
            onLikeClick={handleLikeClick}
            onProductSelect={handleProductSelect}
            wishlistIds={wishlistIds}
          />
        )}

        {/* DEDICATED FULL-PAGE PRODUCT DETAIL (Replaces Drawer) */}
        {activeTab === 'product' && selectedProduct && (
          <ProductDetailView
            product={selectedProduct}
            onBack={() => navigateTo(previousTab || 'shop')}
            onSimilarClick={handleSimilarClick}
            onOutfitClick={handleOutfitClick}
            onLikeClick={handleLikeClick}
            isLiked={wishlistIds.includes(selectedProduct.article_id)}
          />
        )}

        {/* DEDICATED SIMILAR PIECES VIEW (Replaces Dense Modal) */}
        {activeTab === 'similar' && selectedProduct && (
          <SimilarView
            product={selectedProduct}
            onBack={() => navigateTo('product')}
            onProductSelect={handleProductSelect}
            onOutfitClick={handleOutfitClick}
            onLikeClick={handleLikeClick}
            wishlistIds={wishlistIds}
          />
        )}

        {/* OUTFIT STUDIO: Interactive Wardrobe Synthesizer */}
        {activeTab === 'outfits' && (
          <OutfitStudio
            anchorProduct={anchorProduct}
            activeUser={activeUser}
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

        {/* DEDICATED SYSTEM ARCHITECTURE PORTAL (For Evaluators & Project Defense) */}
        {activeTab === 'architecture' && (
          <SystemArchitectureView
            onBackToShopping={() => navigateTo('discover')}
          />
        )}
      </main>

      {/* 3. Global Notification Toast */}
      <NotificationToast toast={toast} onDismiss={() => setToast(null)} />

      {/* 4. Luxury Editorial Footer */}
      <Footer onNavigate={navigateTo} />
    </div>
  );
}
