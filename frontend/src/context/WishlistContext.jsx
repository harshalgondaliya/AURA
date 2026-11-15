/**
 * context/WishlistContext.jsx
 * Authoritative Centralized Wishlist Store for AURA.
 * Synchronizes heart toggles across all surfaces (Shop, ProductDetail, Similar, OutfitStudio, Wishlist).
 * Provides instant optimistic UI updates, localStorage persistence for reload & guest sessions,
 * and background API synchronization with error recovery.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchUserFavorites, addFavorite, removeFavorite, recordInteraction } from '../services/api';

const WishlistContext = createContext(null);

const STORAGE_KEY_PREFIX = 'aura_wishlist_v1_';

export function WishlistProvider({ children, activeUser = 'user_000001', onToast }) {
  const [wishlistItems, setWishlistItems] = useState([]);
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const storageKey = `${STORAGE_KEY_PREFIX}${activeUser}`;

  // 1. Initial Load: Read from localStorage first (instant, zero flicker), then reconcile with backend
  useEffect(() => {
    let isMounted = true;

    // Fast-path: local storage
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setWishlistItems(parsed);
          setWishlistIds(new Set(parsed.map((p) => String(p.article_id))));
        }
      }
    } catch (e) {
      console.warn('Could not read cached wishlist:', e);
    }

    // Sync-path: fetch backend favorites
    const syncBackend = async () => {
      setLoading(true);
      try {
        const serverFavs = await fetchUserFavorites(activeUser);
        if (isMounted && Array.isArray(serverFavs) && serverFavs.length > 0) {
          // Merge server favorites with any locally cached favorites by canonical article_id
          setWishlistItems((prev) => {
            const map = new Map();
            // Start with previous local cache
            prev.forEach((p) => {
              if (p && p.article_id) map.set(String(p.article_id), p);
            });
            // Overwrite/enrich with server records
            serverFavs.forEach((p) => {
              if (p && p.article_id) map.set(String(p.article_id), p);
            });
            const merged = Array.from(map.values());
            try {
              localStorage.setItem(storageKey, JSON.stringify(merged));
            } catch (err) {
              console.warn('Failed to cache wishlist in localStorage:', err);
            }
            return merged;
          });
          setWishlistIds(new Set(serverFavs.map((p) => String(p.article_id))));
        }
      } catch (err) {
        console.warn('Backend wishlist sync failed, relying on local session:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    syncBackend();

    return () => {
      isMounted = false;
    };
  }, [activeUser, storageKey]);

  // 2. Helper to check if an article is wishlisted in O(1)
  const isWishlisted = useCallback(
    (articleId) => {
      if (!articleId) return false;
      return wishlistIds.has(String(articleId));
    },
    [wishlistIds]
  );

  // 3. Centralized Wishlist Toggle
  const toggleWishlist = useCallback(
    async (product, explicitNextState = null) => {
      if (!product || !product.article_id) return;
      const aid = String(product.article_id);
      const currentlyLiked = wishlistIds.has(aid);
      const shouldLike = explicitNextState !== null ? explicitNextState : !currentlyLiked;

      if (shouldLike === currentlyLiked) return; // No change needed

      // Optimistic State Update
      if (shouldLike) {
        // Add to Wishlist
        setWishlistIds((prev) => new Set([...prev, aid]));
        setWishlistItems((prev) => {
          const exists = prev.some((p) => String(p.article_id) === aid);
          if (exists) return prev;
          const next = [product, ...prev];
          try {
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch (e) {
            console.warn(e);
          }
          return next;
        });
        if (onToast) onToast(`Added "${product.prod_name || 'Item'}" to your Wishlist.`, 'success');

        // Backend Sync
        try {
          await addFavorite(activeUser, aid);
          await recordInteraction(activeUser, aid, 'like', { component: 'wishlist_heart' });
        } catch (err) {
          console.warn('Failed to record favorite on server:', err);
        }
      } else {
        // Remove from Wishlist
        setWishlistIds((prev) => {
          const next = new Set(prev);
          next.delete(aid);
          return next;
        });
        setWishlistItems((prev) => {
          const next = prev.filter((p) => String(p.article_id) !== aid);
          try {
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch (e) {
            console.warn(e);
          }
          return next;
        });
        if (onToast) onToast(`Removed "${product.prod_name || 'Item'}" from Wishlist.`, 'info');

        // Backend Sync
        try {
          await removeFavorite(activeUser, aid);
          await recordInteraction(activeUser, aid, 'dismiss', { component: 'wishlist_heart' });
        } catch (err) {
          console.warn('Failed to remove favorite on server:', err);
        }
      }
    },
    [wishlistIds, activeUser, storageKey, onToast]
  );

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems,
        wishlistIds: Array.from(wishlistIds),
        wishlistCount: wishlistIds.size,
        isWishlisted,
        toggleWishlist,
        loading,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}
