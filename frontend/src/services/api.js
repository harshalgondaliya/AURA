/**
 * frontend/src/services/api.js
 * Client API Client communicating with API Gateway (/api)
 */

const BASE_URL = '/api';

export async function fetchProducts(page = 1, limit = 24, category = '', color = '', search = '', gender = '') {
  const params = new URLSearchParams({ page, limit });
  if (category) params.append('category', category);
  if (color) params.append('color', color);
  if (search) params.append('search', search);
  if (gender && gender !== 'all') params.append('gender', gender);

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

export async function fetchCategories(gender = '') {
  const params = new URLSearchParams();
  if (gender && gender !== 'all') params.append('gender', gender);
  try {
    const res = await fetch(`${BASE_URL}/categories?${params.toString()}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch categories:', err);
    return [];
  }
}

export async function fetchProductById(articleId) {
  const res = await fetch(`${BASE_URL}/products/${articleId}`);
  if (!res.ok) throw new Error(`Product not found: ${articleId}`);
  return res.json();
}

export async function fetchSimilarItems(articleId, topK = 6, mode = 'hybrid', filterCategory = true, gender = '') {
  const params = new URLSearchParams({ 
    top_k: topK, 
    mode, 
    filter_category: filterCategory 
  });
  if (gender && gender !== 'all') params.append('gender', gender);
  const res = await fetch(`${BASE_URL}/recommendations/similar/${articleId}?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch similar items: ${res.statusText}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchOutfitRecommendations(anchorArticleId, gender = '', excludeIds = [], resynthesizeCount = 0) {
  const payload = {
    anchor_article_id: anchorArticleId,
    resynthesize_count: resynthesizeCount,
  };
  if (gender && gender !== 'all') payload.gender = gender;
  if (Array.isArray(excludeIds) && excludeIds.length > 0) payload.exclude_ids = excludeIds;

  const res = await fetch(`${BASE_URL}/recommendations/outfits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to generate outfit: ${res.statusText}`);
  return res.json();
}

export async function fetchPersonalizedFeed(userId, topK = 12, recentViews = [], gender = '') {
  const params = new URLSearchParams({ top_k: topK });
  if (recentViews.length > 0) {
    params.append('recent_views', recentViews.join(','));
  }
  if (gender && gender !== 'all') {
    params.append('gender', gender);
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

export async function addFavorite(userId, articleId) {
  try {
    const res = await fetch(`${BASE_URL}/users/${userId}/favorites/${articleId}`, { method: 'POST' });
    return res.ok;
  } catch (err) {
    console.warn('Failed to add favorite:', err);
    return false;
  }
}

export async function removeFavorite(userId, articleId) {
  try {
    const res = await fetch(`${BASE_URL}/users/${userId}/favorites/${articleId}`, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    console.warn('Failed to remove favorite:', err);
    return false;
  }
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
