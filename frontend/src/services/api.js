/**
 * frontend/src/services/api.js
 * Client API Client communicating with API Gateway (/api)
 */

const BASE_URL = '/api';

export async function fetchProducts(page = 1, limit = 24, category = '', color = '', search = '') {
  const params = new URLSearchParams({ page, limit });
  if (category) params.append('category', category);
  if (color) params.append('color', color);
  if (search) params.append('search', search);

  const res = await fetch(`${BASE_URL}/products?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch products: ${res.statusText}`);
  const data = await res.json();
  
  // Return normalized structure preserving total count and pagination metadata
  if (Array.isArray(data)) {
    return { items: data, total: data.length, page: 1, limit };
  }
  return {
    items: data.items || [],
    total: data.total || (data.items || []).length,
    page: data.page || page,
    limit: data.limit || limit,
  };
}

export async function fetchProductById(articleId) {
  const res = await fetch(`${BASE_URL}/products/${articleId}`);
  if (!res.ok) throw new Error(`Product not found: ${articleId}`);
  return res.json();
}

export async function fetchSimilarItems(articleId, topK = 6, mode = 'hybrid', filterCategory = true) {
  const params = new URLSearchParams({ 
    top_k: topK, 
    mode, 
    filter_category: filterCategory 
  });
  const res = await fetch(`${BASE_URL}/recommendations/similar/${articleId}?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch similar items: ${res.statusText}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchOutfitRecommendations(anchorArticleId) {
  const res = await fetch(`${BASE_URL}/recommendations/outfits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ anchor_article_id: anchorArticleId }),
  });
  if (!res.ok) throw new Error(`Failed to generate outfit: ${res.statusText}`);
  return res.json();
}

export async function fetchPersonalizedFeed(userId, topK = 12, recentViews = []) {
  const params = new URLSearchParams({ top_k: topK });
  if (recentViews.length > 0) {
    params.append('recent_views', recentViews.join(','));
  }
  const res = await fetch(`${BASE_URL}/recommendations/personalized/${userId}?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch personalized feed: ${res.statusText}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function recordInteraction(userId, articleId, interactionType, context = {}) {
  try {
    const res = await fetch(`${BASE_URL}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        article_id: articleId,
        interaction_type: interactionType,
        session_id: 'session_' + userId,
        context: context,
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to record interaction:', err);
    return false;
  }
}

export async function fetchUserHistory(userId) {
  const res = await fetch(`${BASE_URL}/users/${userId}/history`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchUserFavorites(userId) {
  const res = await fetch(`${BASE_URL}/users/${userId}/favorites`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function saveOutfit(userId, outfitName, anchorId, itemIds) {
  const res = await fetch(`${BASE_URL}/outfits/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      outfit_name: outfitName,
      anchor_article_id: anchorId,
      item_article_ids: itemIds,
    }),
  });
  if (!res.ok) throw new Error(`Failed to save outfit`);
  return res.json();
}

export async function fetchSavedOutfits(userId) {
  const res = await fetch(`${BASE_URL}/users/${userId}/outfits`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchSystemHealth() {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error('System health check failed');
  return res.json();
}

export async function fetchSystemMetrics() {
  const res = await fetch(`${BASE_URL}/metrics`);
  if (!res.ok) throw new Error('System metrics check failed');
  return res.json();
}
