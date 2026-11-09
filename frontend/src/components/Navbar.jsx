import React, { useState } from 'react';
import { Search, Heart, User, Menu, X, ArrowRight, Layers, Sparkles } from 'lucide-react';
import AuraLogo from './AuraLogo';

export default function Navbar({
  activeTab,
  setActiveTab,
  activeUser,
  setActiveUser,
  wishlistCount = 0,
  onOpenSearch,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const navItems = [
    { id: 'discover', label: 'Discover' },
    { id: 'shop', label: 'Shop' },
    { id: 'outfits', label: 'Outfit Studio' },
    { id: 'for_you', label: 'For You' },
  ];

  const clientProfiles = [
    { id: 'user_000001', name: 'Harshal', style: 'Curated Minimalist' },
    { id: 'user_demo_01', name: 'Alex', style: 'Contemporary Street' },
    { id: 'user_demo_02', name: 'Elena', style: 'Tailored Editorial' },
    { id: 'guest_user', name: 'Guest', style: 'Discovering' },
  ];

  const currentProfile = clientProfiles.find((p) => p.id === activeUser) || clientProfiles[0];

  const handleNavClick = (tabId) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 bg-aura-ivory/95 backdrop-blur-md border-b border-aura-espresso/8 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* LEFT: Distinctive AURA Brandmark */}
          <div
            onClick={() => handleNavClick('discover')}
            className="cursor-pointer transition-opacity hover:opacity-85"
            title="AURA — Home"
          >
            <AuraLogo variant="dark" size="md" />
          </div>

          {/* CENTER: Editorial Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 lg:gap-10">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`relative py-2 text-xs uppercase tracking-[0.2em] font-medium transition-colors ${
                    isActive
                      ? 'text-aura-espresso font-semibold'
                      : 'text-aura-muted hover:text-aura-espresso'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-aura-espresso rounded-full animate-in fade-in duration-200" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* RIGHT: Search, Wishlist & Client Profile */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Quick Search */}
            <button
              onClick={() => {
                if (onOpenSearch) onOpenSearch();
                else handleNavClick('shop');
              }}
              className="p-2.5 rounded-full text-aura-muted hover:text-aura-espresso hover:bg-aura-cream/60 transition-colors"
              title="Search collection"
            >
              <Search className="w-4 h-4 stroke-[1.5]" />
            </button>

            {/* Wishlist Link with Live Counter */}
            <button
              onClick={() => handleNavClick('wishlist')}
              className={`relative p-2.5 rounded-full transition-colors ${
                activeTab === 'wishlist'
                  ? 'text-aura-espresso bg-aura-cream/80'
                  : 'text-aura-muted hover:text-aura-espresso hover:bg-aura-cream/60'
              }`}
              title="View Wishlist"
            >
              <Heart className={`w-4 h-4 stroke-[1.5] ${wishlistCount > 0 ? 'fill-aura-espresso/15 text-aura-espresso' : ''}`} />
              {wishlistCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-aura-espresso text-aura-ivory text-[9px] font-bold rounded-full flex items-center justify-center animate-in zoom-in-75">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Client Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full border border-aura-espresso/15 bg-white/70 hover:bg-white text-aura-espresso transition-all text-xs"
                title="Switch styling persona"
              >
                <div className="w-5 h-5 rounded-full bg-aura-espresso text-aura-ivory flex items-center justify-center text-[10px] font-serif">
                  {currentProfile.name.charAt(0)}
                </div>
                <span className="hidden sm:inline font-medium tracking-tight">
                  {currentProfile.name}
                </span>
              </button>

              {/* Profile Selector Overlay */}
              {userDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setUserDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-aura-hover border border-aura-espresso/10 p-2 z-40 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-2 border-b border-aura-espresso/5 mb-1">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-aura-muted">
                        Styling Persona
                      </p>
                      <p className="text-xs font-serif font-semibold text-aura-espresso">
                        {currentProfile.name} &bull; {currentProfile.style}
                      </p>
                    </div>
                    {clientProfiles.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setActiveUser(p.id);
                          setUserDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                          activeUser === p.id
                            ? 'bg-aura-cream/70 font-semibold text-aura-espresso'
                            : 'text-aura-muted hover:text-aura-espresso hover:bg-aura-ivory'
                        }`}
                      >
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-[10px] text-aura-muted">{p.style}</p>
                        </div>
                        {activeUser === p.id && (
                          <span className="w-1.5 h-1.5 rounded-full bg-aura-olive" />
                        )}
                      </button>
                    ))}
                    <div className="pt-2 mt-1 border-t border-aura-espresso/5 px-2">
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          handleNavClick('saved_outfits');
                        }}
                        className="w-full text-left py-1 text-[11px] text-aura-espresso hover:text-aura-olive flex items-center gap-1.5 font-medium"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Saved Ensembles Portfolio</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Mobile Menu Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-aura-espresso hover:bg-aura-cream/60 rounded-xl"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-aura-ivory border-b border-aura-espresso/10 px-6 py-6 space-y-4 animate-in slide-in-from-top-4 duration-200">
          <div className="flex flex-col space-y-3">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`text-left py-2 text-base font-serif tracking-wider ${
                  activeTab === item.id
                    ? 'text-aura-espresso font-semibold pl-2 border-l-2 border-aura-espresso'
                    : 'text-aura-muted hover:text-aura-espresso'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => handleNavClick('saved_outfits')}
              className="text-left py-2 text-base font-serif tracking-wider text-aura-muted hover:text-aura-espresso"
            >
              Saved Ensembles
            </button>
            <button
              onClick={() => handleNavClick('wishlist')}
              className="text-left py-2 text-base font-serif tracking-wider text-aura-muted hover:text-aura-espresso flex items-center justify-between"
            >
              <span>Wishlist</span>
              {wishlistCount > 0 && (
                <span className="px-2 py-0.5 text-xs bg-aura-espresso text-aura-ivory rounded-full">
                  {wishlistCount}
                </span>
              )}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
