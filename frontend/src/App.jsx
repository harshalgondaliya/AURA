import React, { useState } from 'react';
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
import { recordInteraction } from './services/api';

function AppContent({ activeUser, setActiveUser, toast, setToast, showToast }) {
  const [activeTab, setActiveTab] = useState('discover'); // 'discover', 'shop', 'outfits', 'for_you', 'wishlist', 'saved_outfits', 'product', 'similar', 'architecture'
  const [previousTab, setPreviousTab] = useState('discover');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [anchorProduct, setAnchorProduct] = useState(null);
  const [recentViewIds, setRecentViewIds] = useState([]);

  // Persistent Gender Scope (defaults to 'all', can be 'women' or 'men')
  const [selectedGender, setSelectedGender] = useState(() => {
    return localStorage.getItem('aura_catalog_gender') || 'all';
  });

  // Centralized Wishlist Store Hook
  const { wishlistIds, isWishlisted, toggleWishlist, wishlistCount } = useWishlist();

  const handleGenderChange = (gender) => {
    setSelectedGender(gender);
    localStorage.setItem('aura_catalog_gender', gender);
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
        {activeTab === 'product' && selectedProduct && (
          <ProductDetailView
            product={selectedProduct}
            onBack={() => navigateTo(previousTab || 'shop')}
            onSimilarClick={handleSimilarClick}
            onOutfitClick={handleOutfitClick}
            onLikeClick={handleLikeClick}
            isLiked={isWishlisted(selectedProduct.article_id)}
          />
        )}

        {/* DEDICATED SIMILAR PIECES VIEW */}
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

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

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
