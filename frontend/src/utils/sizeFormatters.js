/**
 * utils/sizeFormatters.js
 * Centralized size formatting, system detection, and size-chart definitions for AURA.
 */

export function getCardSizeDisplay(product) {
  if (!product) return 'Size details unavailable';
  
  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  if (sizes.length === 0 || product.availability_status === 'unavailable') {
    return 'Size details unavailable';
  }

  const stype = product.size_type;

  if (stype === 'onesize' || (sizes.length === 1 && sizes[0].toLowerCase().includes('one size'))) {
    return 'One Size';
  }

  if (stype === 'alpha') {
    const first = sizes[0];
    const last = sizes[sizes.length - 1];
    return sizes.length > 1 ? `Sizes: ${first}–${last}` : `Size: ${first}`;
  }

  if (stype === 'waist') {
    const first = sizes[0];
    const last = sizes[sizes.length - 1];
    return sizes.length > 1 ? `Waist: ${first}–${last}` : `Waist: ${first}`;
  }

  if (stype === 'footwear_uk') {
    const first = sizes[0].replace('Child', '').trim();
    const last = sizes[sizes.length - 1].replace('Child', '').trim();
    return sizes.length > 1 ? `Sizes: ${first}–${last}` : `Size: ${first}`;
  }

  if (stype === 'age') {
    const first = sizes[0].replace('Y', '');
    const last = sizes[sizes.length - 1];
    return sizes.length > 1 ? `Sizes: ${first}–${last}` : `Size: ${first}`;
  }

  // Fallback for custom or irregular size runs
  if (sizes.length <= 3) {
    return `Sizes: ${sizes.join(', ')}`;
  }
  return `Sizes: ${sizes[0]}–${sizes[sizes.length - 1]}`;
}

export function getSizeSystemLabel(sizeType, sizeSystem) {
  if (sizeSystem) return sizeSystem;
  switch (sizeType) {
    case 'alpha':
      return 'Standard Alpha';
    case 'waist':
      return 'Waist (inches)';
    case 'footwear_uk':
      return 'UK Footwear';
    case 'onesize':
      return 'Universal';
    case 'age':
      return 'Age Range';
    default:
      return 'Catalog Standard';
  }
}

/**
 * Verified standard size charts for modal / drawer
 */
export const SIZE_CHARTS = {
  alpha_women: {
    title: "Women's Standard Sizing",
    system: "Standard Alpha (Inches / CM)",
    columns: ["Size", "Bust (in)", "Waist (in)", "Hips (in)"],
    rows: [
      ["XS", "32–33", "24–25", "34–35"],
      ["S", "34–35", "26–27", "36–37"],
      ["M", "36–37", "28–29", "38–39"],
      ["L", "38.5–40", "30.5–32", "40.5–42"],
      ["XL", "41.5–43", "33.5–35", "43.5–45"],
    ],
  },
  alpha_men: {
    title: "Men's Standard Sizing",
    system: "Standard Alpha (Inches / CM)",
    columns: ["Size", "Chest (in)", "Waist (in)", "Neck (in)"],
    rows: [
      ["S", "36–38", "30–32", "14.5–15"],
      ["M", "39–41", "33–35", "15.5–16"],
      ["L", "42–44", "36–38", "16.5–17"],
      ["XL", "45–47", "39–41", "17.5–18"],
      ["XXL", "48–50", "42–44", "18.5–19"],
    ],
  },
  waist_men: {
    title: "Men's Trousers & Denim Sizing",
    system: "Waist Size in Inches",
    columns: ["Waist Size", "Natural Waist (cm)", "Seat / Hip (in)", "Inseam (in)"],
    rows: [
      ["28", "71–73 cm", "34–35", "30 / 32"],
      ["30", "76–78 cm", "36–37", "30 / 32"],
      ["32", "81–83 cm", "38–39", "32 / 34"],
      ["34", "86–88 cm", "40–41", "32 / 34"],
      ["36", "91–93 cm", "42–43", "32 / 34"],
      ["38", "96–98 cm", "44–45", "32 / 34"],
    ],
  },
  waist_women: {
    title: "Women's Trousers & Denim Sizing",
    system: "Waist Size in Inches",
    columns: ["Waist Size", "Natural Waist (cm)", "Hip (in)", "Inseam (in)"],
    rows: [
      ["26", "66–68 cm", "35–36", "30 / 32"],
      ["28", "71–73 cm", "37–38", "30 / 32"],
      ["30", "76–78 cm", "39–40", "30 / 32"],
      ["32", "81–83 cm", "41–42", "32"],
      ["34", "86–88 cm", "43–44", "32"],
    ],
  },
  shoes_women: {
    title: "Women's Footwear Sizing",
    system: "UK / EUR / Foot Length",
    columns: ["UK Size", "EUR Size", "US Size", "Foot Length (cm)"],
    rows: [
      ["UK 3", "36", "5", "22.5 cm"],
      ["UK 4", "37", "6", "23.5 cm"],
      ["UK 5", "38", "7", "24.0 cm"],
      ["UK 6", "39", "8", "25.0 cm"],
      ["UK 7", "40", "9", "25.5 cm"],
      ["UK 8", "41", "10", "26.5 cm"],
    ],
  },
  shoes_men: {
    title: "Men's Footwear Sizing",
    system: "UK / EUR / Foot Length",
    columns: ["UK Size", "EUR Size", "US Size", "Foot Length (cm)"],
    rows: [
      ["UK 6", "40", "7", "25.0 cm"],
      ["UK 7", "41", "8", "26.0 cm"],
      ["UK 8", "42", "9", "26.8 cm"],
      ["UK 9", "43", "10", "27.5 cm"],
      ["UK 10", "44", "11", "28.5 cm"],
      ["UK 11", "45", "12", "29.2 cm"],
      ["UK 12", "46", "13", "30.0 cm"],
    ],
  },
};
