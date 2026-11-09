import React from 'react';
import AuraLogo from './AuraLogo';
import { ArrowUpRight } from 'lucide-react';

export default function Footer({ onNavigate }) {
  const handleLink = (tab) => {
    if (onNavigate) {
      onNavigate(tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-aura-espresso text-aura-ivory border-t border-aura-espresso selection:bg-aura-champagne selection:text-aura-espresso">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-14 border-b border-white/10">
          {/* Brand Column (5 cols) */}
          <div className="md:col-span-5 space-y-4">
            <AuraLogo variant="light" size="lg" />
            <p className="text-xl sm:text-2xl font-serif font-light text-aura-cream max-w-sm leading-snug pt-2">
              Style is personal.<br />
              <span className="italic text-aura-champagne font-normal">Discover yours.</span>
            </p>
            <p className="text-xs text-aura-muted max-w-md leading-relaxed">
              A curated digital fashion destination blending timeless garment curation with intuitive personal outfit synthesis.
            </p>
          </div>

          {/* Links Column: Explore (2 cols) */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-[11px] font-mono uppercase tracking-[0.22em] text-aura-champagne font-medium">
              Explore
            </h4>
            <ul className="space-y-2.5 text-xs text-aura-cream/80">
              <li>
                <button
                  onClick={() => handleLink('discover')}
                  className="hover:text-white transition-colors"
                >
                  Discover
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleLink('shop')}
                  className="hover:text-white transition-colors"
                >
                  The Collection
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleLink('outfits')}
                  className="hover:text-white transition-colors"
                >
                  Outfit Studio
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleLink('for_you')}
                  className="hover:text-white transition-colors"
                >
                  Curated For You
                </button>
              </li>
            </ul>
          </div>

          {/* Links Column: Your Account (2 cols) */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-[11px] font-mono uppercase tracking-[0.22em] text-aura-champagne font-medium">
              Your Wardrobe
            </h4>
            <ul className="space-y-2.5 text-xs text-aura-cream/80">
              <li>
                <button
                  onClick={() => handleLink('wishlist')}
                  className="hover:text-white transition-colors"
                >
                  Saved Wishlist
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleLink('saved_outfits')}
                  className="hover:text-white transition-colors"
                >
                  Saved Ensembles
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleLink('for_you')}
                  className="hover:text-white transition-colors"
                >
                  Style Persona
                </button>
              </li>
            </ul>
          </div>

          {/* Links Column: About & Academic Project (3 cols) */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-[11px] font-mono uppercase tracking-[0.22em] text-aura-champagne font-medium">
              Project & Architecture
            </h4>
            <ul className="space-y-2.5 text-xs text-aura-cream/80">
              <li>
                <button
                  onClick={() => handleLink('discover')}
                  className="hover:text-white transition-colors"
                >
                  About AURA
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleLink('architecture')}
                  className="inline-flex items-center gap-1.5 text-aura-champagne hover:text-white font-medium transition-colors group"
                >
                  <span>System Architecture Portal</span>
                  <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              </li>
              <li className="pt-2 text-[11px] text-aura-muted leading-relaxed">
                Academic & Distributed Systems Engineering defense portal for evaluators.
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-aura-muted">
          <p>
            &copy; {new Date().getFullYear()} AURA. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-[11px]">
            <span>Curated with H&M Kaggle Dataset</span>
            <span>&bull;</span>
            <button
              onClick={() => handleLink('architecture')}
              className="text-aura-champagne/80 hover:text-aura-champagne transition-colors underline underline-offset-4"
            >
              Evaluator Documentation
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
