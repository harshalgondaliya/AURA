/**
 * utils/formatters.js
 * Centralized formatting utilities for AURA luxury fashion platform.
 * Formats all currency in Indian Rupees (₹) using Indian numbering locale (en-IN).
 */

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/**
 * Format a number or numeric string into Indian Rupee currency (e.g. ₹2,499, ₹1,25,000).
 * @param {number|string} amount
 * @returns {string} Formatted Indian Rupee string
 */
export function formatPrice(amount) {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '₹2,499';
  }
  const numeric = Math.round(Number(amount));
  return inrFormatter.format(numeric);
}

/**
 * Maps a product object or its attributes to a realistic Indian fashion retail price point (₹).
 * Handles default dataset placeholder prices (e.g. 2999 cents) by assigning realistic,
 * tier-based Indian market prices aligned with the garment's silhouette and category.
 *
 * Tier reference:
 * - Accessories & Small Goods: ₹999 - ₹1,499
 * - Tops, T-Shirts & Layering: ₹1,499 - ₹1,999
 * - Trousers, Denim & Skirts:  ₹2,499 - ₹2,999
 * - Sweaters, Hoodies & Knits: ₹2,499 - ₹3,499
 * - Dresses & Jumpsuits:       ₹3,499 - ₹4,499
 * - Footwear & Boots:          ₹3,999 - ₹4,999
 *
 * @param {Object} product - Product record
 * @returns {string} Formatted price string in Indian Rupees (e.g. "₹2,499")
 */
export function formatProductPrice(product) {
  if (!product) return '₹2,499';

  // 1. Explicit INR price if provided
  if (product.price_inr && !isNaN(Number(product.price_inr))) {
    return formatPrice(product.price_inr);
  }

  // 2. If a non-default custom price is stored in price_cents (other than default 2999)
  if (product.price_cents && product.price_cents !== 2999) {
    const val = Number(product.price_cents);
    if (val > 10000) {
      return formatPrice(Math.round(val / 100));
    }
    return formatPrice(val);
  }

  // 3. For catalog items with default price_cents (2999), apply realistic category price bands
  const category = (product.standard_category || '').toLowerCase();
  const prodType = (product.product_type_name || '').toLowerCase();
  const articleId = String(product.article_id || '0');

  // Deterministic hash digit (0-9) from article_id for natural luxury price variety
  const lastDigit = parseInt(articleId.slice(-1), 10) || 0;

  if (category === 'accessories' || prodType.includes('sock') || prodType.includes('scarf') || prodType.includes('belt') || prodType.includes('hat') || prodType.includes('bag')) {
    return lastDigit < 5 ? formatPrice(999) : formatPrice(1499);
  }

  if (category === 'full_body' || prodType.includes('dress') || prodType.includes('jumpsuit') || prodType.includes('suit')) {
    return lastDigit < 5 ? formatPrice(3499) : formatPrice(4499);
  }

  if (category === 'shoes' || prodType.includes('shoe') || prodType.includes('boot') || prodType.includes('loafer')) {
    return lastDigit < 5 ? formatPrice(3999) : formatPrice(4999);
  }

  if (category === 'lower_body' || prodType.includes('trouser') || prodType.includes('denim') || prodType.includes('skirt') || prodType.includes('pant')) {
    return lastDigit < 5 ? formatPrice(2499) : formatPrice(2999);
  }

  if (category === 'upper_body') {
    if (prodType.includes('sweater') || prodType.includes('hoodie') || prodType.includes('jacket') || prodType.includes('blazer') || prodType.includes('cardigan')) {
      return lastDigit < 5 ? formatPrice(2499) : formatPrice(3499);
    }
    if (prodType.includes('t-shirt') || prodType.includes('vest') || prodType.includes('tank') || prodType.includes('top')) {
      return lastDigit < 5 ? formatPrice(1499) : formatPrice(1999);
    }
    return lastDigit < 5 ? formatPrice(1999) : formatPrice(2499);
  }

  // Fallback catalog baseline
  return formatPrice(2499);
}
