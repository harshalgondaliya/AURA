import React from 'react';

/**
 * Resolves truthful normalized gender label from product attributes or raw string.
 * Supports index_group_name, department_name, section_name, and normalized gender.
 */
export function getProductGenderLabel(productOrGender) {
  let g = '';
  if (typeof productOrGender === 'string') {
    g = productOrGender;
  } else if (productOrGender && typeof productOrGender === 'object') {
    g =
      productOrGender.gender ||
      productOrGender.index_group_name ||
      productOrGender.section_name ||
      productOrGender.department_name ||
      '';
  }

  const raw = String(g).trim().toLowerCase();

  if (raw === 'men' || raw === 'menswear' || raw.startsWith('men ') || raw.includes('mens')) {
    return 'MEN';
  }
  if (
    raw === 'women' ||
    raw === 'ladieswear' ||
    raw === 'ladies' ||
    raw.includes('ladies') ||
    raw.includes('lingerie')
  ) {
    return 'WOMEN';
  }
  if (raw === 'unisex' || raw === 'sport') {
    return 'UNISEX';
  }
  if (raw === 'kids' || raw.includes('children') || raw.includes('baby')) {
    return 'KIDS';
  }
  return 'GENDER NOT SPECIFIED';
}

export default function ProductGenderLabel({
  product,
  gender,
  className = '',
  size = 'sm',
}) {
  const label = getProductGenderLabel(product || gender);

  const getStyle = () => {
    switch (label) {
      case 'MEN':
        return 'bg-aura-cream text-aura-espresso border-aura-espresso/15';
      case 'WOMEN':
        return 'bg-[#F2ECE4] text-aura-espresso border-aura-espresso/15';
      case 'UNISEX':
        return 'bg-aura-olive/10 text-aura-olive border-aura-olive/20';
      case 'KIDS':
        return 'bg-aura-cream/60 text-aura-muted border-aura-espresso/10';
      case 'GENDER NOT SPECIFIED':
      default:
        return 'bg-aura-cream/40 text-aura-muted/80 border-aura-espresso/5';
    }
  };

  const sizeClasses =
    size === 'xs'
      ? 'px-1.5 py-0.2 text-[8px] tracking-[0.14em]'
      : 'px-2 py-0.5 text-[9px] tracking-[0.16em]';

  return (
    <span
      className={`inline-flex items-center font-mono uppercase font-medium rounded-full border shadow-2xs select-none transition-colors ${sizeClasses} ${getStyle()} ${className}`}
      title={`Gender Scope: ${label}`}
    >
      {label}
    </span>
  );
}
