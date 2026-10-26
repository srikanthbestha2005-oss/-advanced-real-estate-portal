import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import PropertyCard from '../components/PropertyCard';
import api from '../api';

const HERO_SLIDES = [
  {
    id: 'houses-villas',
    title: 'Luxury Villas & Houses',
    categoryName: 'Houses & Villas',
    tagline: 'Private architectural sanctuaries with spacious living and lush gardens',
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80',
    alt: 'Luxury villa with modern architecture and swimming pool',
    filterPath: '/properties?property_type=HOUSE'
  },
  {
    id: 'apartments',
    title: 'Modern Apartments & Flats',
    categoryName: 'Apartments',
    tagline: 'Contemporary urban living in prime locations with world-class amenities',
    image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1600&q=80',
    alt: 'High-rise residential apartments with landscaped surroundings',
    filterPath: '/properties?property_type=APARTMENT'
  },
  {
    id: 'plots-lands',
    title: 'Open Plots & Lands',
    categoryName: 'Lands & Plots',
    tagline: 'Verified development sites and scenic land plots ready for your vision',
    image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=80',
    alt: 'Expansive sunny green land and open development plots',
    filterPath: '/properties?property_type=PLOT'
  },
  {
    id: 'commercial',
    title: 'Shops & Commercial Spaces',
    categoryName: 'Shops & Commercial',
    tagline: 'High-footfall retail shops, offices, and strategic commercial properties',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80',
    alt: 'Modern commercial glass facade building and storefronts',
    filterPath: '/properties?property_type=COMMERCIAL'
  }
];

const CATEGORY_CARDS = [
  {
    id: 'houses',
    title: 'Houses',
    subtitle: 'Independent homes & villas',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
    alt: 'Beautiful independent house',
    filterPath: '/properties?property_type=HOUSE'
  },
  {
    id: 'apartments',
    title: 'Apartments',
    subtitle: 'Flats & gated communities',
    image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80',
    alt: 'Modern residential apartment',
    filterPath: '/properties?property_type=APARTMENT'
  },
  {
    id: 'lands',
    title: 'Lands',
    subtitle: 'Residential & farm plots',
    image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=80',
    alt: 'Green open plot & land',
    filterPath: '/properties?property_type=PLOT'
  },
  {
    id: 'shops',
    title: 'Shops',
    subtitle: 'Commercial spaces & retail',
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=600&q=80',
    alt: 'Commercial retail shop space',
    filterPath: '/properties?property_type=COMMERCIAL'
  }
];

const FALLBACK_IMAGE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600' fill='%230f172a'><rect width='800' height='600' fill='%230f172a'/><path d='M300 280l-80 100h360l-100-140-80 100z' fill='%232563eb'/><circle cx='320' cy='220' r='24' fill='%2338bdf8'/><text x='400' y='460' font-family='sans-serif' font-size='24' font-weight='600' fill='%2394a3b8' text-anchor='middle'>Property Showcase</text></svg>";

const HomePage = () => {
  const navigate = useNavigate();

  // Search form state
  const [searchCity, setSearchCity] = useState('');
  const [searchPropertyType, setSearchPropertyType] = useState('');
  const [searchListingType, setSearchListingType] = useState('');
  const [searchMaxBudget, setSearchMaxBudget] = useState('');

  // Hero carousel state
  const [currentSlide, setCurrentSlide] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Check user preference for reduced motion
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(mediaQuery.matches);
      const handler = (e) => setReducedMotion(e.matches);
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
      }
    }
  }, []);

  // Auto-advance carousel every 2 seconds; continues sliding and restarts countdown on slide change
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 2000);

    return () => clearInterval(timer);
  }, [currentSlide]);

  // Touch gesture support for mobile
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);

  // Featured properties state
  const [featuredProperties, setFeaturedProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFeatured = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get('properties/');
        const data = response.data.results || response.data;
        if (Array.isArray(data)) {
          // Public view automatically respects ACTIVE and APPROVED backend rules
          const approved = data.filter(p => p.verification_status === 'APPROVED');
          // Pick up to 3 featured properties
          setFeaturedProperties(approved.slice(0, 3));
        } else {
          setFeaturedProperties([]);
        }
      } catch (err) {
        setError('Unable to load properties at this time.');
      } finally {
        setLoading(false);
      }
    };

    fetchFeatured();
  }, []);

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? HERO_SLIDES.length - 1 : prev - 1));
  };

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
  };

  const handleTouchStart = (e) => {
    setTouchEndX(null);
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStartX || !touchEndX) return;
    const distance = touchStartX - touchEndX;
    const minSwipeDistance = 50;
    if (distance > minSwipeDistance) {
      handleNextSlide();
    } else if (distance < -minSwipeDistance) {
      handlePrevSlide();
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchCity.trim()) params.append('city', searchCity.trim());
    if (searchPropertyType) params.append('property_type', searchPropertyType);
    if (searchListingType) params.append('listing_type', searchListingType);
    if (searchMaxBudget) params.append('max_price', searchMaxBudget);
    navigate(`/properties?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <Navbar />

      {/* SECTION 1 — MODERN HERO WITH CAROUSEL */}
      <section
        className="relative bg-slate-950 overflow-hidden min-h-[580px] sm:min-h-[620px] lg:min-h-[660px] flex items-center justify-center text-white"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Background Images Carousel */}
        {HERO_SLIDES.map((slide, index) => {
          const isActive = index === currentSlide;
          return (
            <div
              key={slide.id}
              aria-hidden={!isActive}
              className={`absolute inset-0 ${
                reducedMotion ? '' : 'transition-opacity duration-700 ease-in-out'
              } ${isActive ? 'opacity-100 z-0' : 'opacity-0 pointer-events-none'}`}
            >
              <img
                src={slide.image}
                alt={slide.alt}
                loading={index === 0 ? 'eager' : 'lazy'}
                className={`w-full h-full object-cover object-center brightness-105 ${
                  reducedMotion
                    ? ''
                    : 'transform scale-105 transition-transform duration-[6000ms] ease-out'
                }`}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = FALLBACK_IMAGE;
                }}
              />
            </div>
          );
        })}

        {/* Premium Dark-Blue Gradient Overlays (Slightly brightened for enhanced property visibility) */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 via-blue-950/60 to-slate-900/55 z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-black/25 z-10 pointer-events-none" />

        {/* Carousel Prev/Next Buttons */}
        <button
          type="button"
          onClick={handlePrevSlide}
          aria-label="Previous property image"
          className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 p-2.5 sm:p-3 rounded-full bg-black/40 hover:bg-blue-600 text-white border border-white/20 backdrop-blur-md transition-all shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400 group cursor-pointer"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6 transform group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          type="button"
          onClick={handleNextSlide}
          aria-label="Next property image"
          className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 p-2.5 sm:p-3 rounded-full bg-black/40 hover:bg-blue-600 text-white border border-white/20 backdrop-blur-md transition-all shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400 group cursor-pointer"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6 transform group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Hero Foreground Content */}
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30 backdrop-blur-md mb-6 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
            Verified &amp; Reliable Real Estate Portal
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight max-w-4xl mx-auto drop-shadow-md">
            Buy, Sell, Rent{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-sky-200 to-indigo-200">
              Your Perfect Property
            </span>
          </h1>

          <p className="mt-5 text-base sm:text-lg lg:text-xl text-slate-100 max-w-2xl mx-auto leading-relaxed drop-shadow">
            Discover verified houses, luxury apartments, premium plots, and commercial spaces tailored to your lifestyle and budget.
          </p>

          {/* Interactive Active Category Badge linking to category search */}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => navigate(HERO_SLIDES[currentSlide].filterPath)}
              className="group inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/25 text-white text-xs sm:text-sm font-medium backdrop-blur-md transition-all shadow-lg hover:border-blue-400 cursor-pointer"
              title={`Explore ${HERO_SLIDES[currentSlide].categoryName}`}
            >
              <span className="px-2 py-0.5 rounded-full bg-blue-500/40 text-blue-200 text-[10px] font-bold uppercase tracking-wider">
                Featured
              </span>
              <span>{HERO_SLIDES[currentSlide].title}</span>
              <span className="text-blue-300 font-semibold group-hover:translate-x-1 transition-transform flex items-center">
                Explore &rarr;
              </span>
            </button>
          </div>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center items-center w-full sm:w-auto">
            <a
              href="#search-section"
              className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-blue-500/25 transition-all text-center flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search Properties
            </a>
            <Link
              to="/properties"
              className="w-full sm:w-auto px-8 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl border border-white/20 backdrop-blur-md transition-all text-center"
            >
              Browse All Listings
            </Link>
          </div>

          {/* Slide Indicators / Dots */}
          <div className="mt-10 flex items-center gap-2 bg-black/40 px-3.5 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
            {HERO_SLIDES.map((slide, idx) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                aria-label={`Jump to slide ${idx + 1}: ${slide.categoryName}`}
                className={`transition-all rounded-full cursor-pointer ${
                  idx === currentSlide
                    ? 'w-7 h-2 bg-blue-500 shadow-sm'
                    : 'w-2 h-2 bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 2 — PROPERTY SEARCH */}
      <section id="search-section" className="relative -mt-12 sm:-mt-14 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full z-30">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              Find Properties
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Filter verified properties in real time
            </span>
          </div>

          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                City / Location
              </label>
              <input
                type="text"
                placeholder="e.g. Hyderabad, Pune"
                value={searchCity}
                onChange={(e) => setSearchCity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Property Type
              </label>
              <select
                value={searchPropertyType}
                onChange={(e) => setSearchPropertyType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 bg-white transition-colors"
              >
                <option value="">All Categories</option>
                <option value="APARTMENT">Apartment</option>
                <option value="FLAT">Flat</option>
                <option value="HOUSE">House</option>
                <option value="VILLA">Villa</option>
                <option value="PLOT">Residential Plot / Land</option>
                <option value="COMMERCIAL">Commercial Space</option>
                <option value="OFFICE">Office</option>
                <option value="COMMERCIAL_LAND">Commercial Land</option>
                <option value="SHOP">Shop</option>
                <option value="WAREHOUSE">Warehouse</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Listing Type
              </label>
              <select
                value={searchListingType}
                onChange={(e) => setSearchListingType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 bg-white transition-colors"
              >
                <option value="">Any (Sale or Rent)</option>
                <option value="SALE">For Sale</option>
                <option value="RENT">For Rent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Max Budget (₹)
              </label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 5000000"
                value={searchMaxBudget}
                onChange={(e) => setSearchMaxBudget(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-400 transition-colors"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-4 mt-2 flex justify-end">
              <button
                type="submit"
                className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search Properties
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* SECTION 3 — PROPERTY CATEGORY GALLERY */}
      <section className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-blue-600 text-xs font-bold uppercase tracking-wider bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            Explore Marketplace
          </span>
          <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl mt-3">
            Browse by Property Category
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-500">
            Select any category below to immediately view verified properties matching your requirements.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {CATEGORY_CARDS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => navigate(cat.filterPath)}
              className="group bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all text-left flex flex-col cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="relative w-full h-44 sm:h-48 overflow-hidden bg-slate-100">
                <img
                  src={cat.image}
                  alt={cat.alt}
                  loading="lazy"
                  className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = FALLBACK_IMAGE;
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
              </div>
              <div className="p-4 flex flex-col flex-grow justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {cat.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                    {cat.subtitle}
                  </p>
                </div>
                <div className="mt-3 flex items-center text-xs font-semibold text-blue-600 group-hover:text-blue-700">
                  <span>Explore</span>
                  <svg className="w-3.5 h-3.5 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* SECTION 4 — FEATURED PROPERTIES */}
      <section className="py-16 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-10 gap-4">
            <div>
              <span className="text-blue-600 text-xs font-bold uppercase tracking-wider bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                Verified Listings
              </span>
              <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl mt-3">
                Featured Properties
              </h2>
              <p className="mt-2 text-base sm:text-lg text-slate-500">
                Explore active, verified listings currently available on our platform.
              </p>
            </div>
            <Link
              to="/properties"
              className="text-blue-600 hover:text-blue-800 font-semibold text-sm flex items-center gap-1 group whitespace-nowrap"
            >
              View all listings
              <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {loading && (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && !loading && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg text-center border border-red-200 max-w-md mx-auto">
              {error}
            </div>
          )}

          {!loading && !error && featuredProperties.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 max-w-2xl mx-auto p-8 shadow-sm">
              <svg className="w-16 h-16 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No Properties Available Yet</h3>
              <p className="text-slate-500 mb-6">
                Be the first to list a verified property or check back soon as new listings are approved.
              </p>
              <Link
                to="/properties/new"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg shadow-sm transition-colors text-sm"
              >
                List Your Property
              </Link>
            </div>
          )}

          {!loading && !error && featuredProperties.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredProperties.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* SECTION 5 — HOW IT WORKS */}
      <section className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-blue-600 text-sm font-bold uppercase tracking-wider">Transparent Process</span>
          <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl mt-2">
            How It Works
          </h2>
          <p className="mt-3 text-lg text-slate-500">
            A straightforward process to explore, evaluate, and connect with listing owners.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm flex flex-col">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-extrabold text-lg mb-6">
              01
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Discover Properties</h3>
            <p className="text-slate-500 leading-relaxed text-sm">
              Search verified residential and commercial properties by city, property type, price range, and listing type using our real-time filters.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm flex flex-col">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-extrabold text-lg mb-6">
              02
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Explore Property Details</h3>
            <p className="text-slate-500 leading-relaxed text-sm">
              Review property specifications, high-resolution photographs, verified status badges, amenities, and accurate pricing.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm flex flex-col">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-extrabold text-lg mb-6">
              03
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Contact Owner or Agent</h3>
            <p className="text-slate-500 leading-relaxed text-sm">
              Connect directly with property owners and agents using our built-in messaging system to ask questions or arrange visits.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 6 — LIST YOUR PROPERTY */}
      <section className="py-16 bg-blue-600 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Are You a Property Owner or Agent?
          </h2>
          <p className="mt-4 text-lg text-blue-100 max-w-2xl mx-auto leading-relaxed">
            List your residential or commercial properties on our portal and connect directly with interested buyers and tenants.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/properties/new"
              className="px-8 py-3.5 bg-white text-blue-600 hover:bg-blue-50 font-bold rounded-lg shadow transition-colors"
            >
              List Your Property
            </Link>
            <Link
              to="/properties"
              className="px-8 py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg transition-colors border border-blue-500"
            >
              Browse Existing Listings
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 7 — FOOTER */}
      <footer className="bg-gray-900 text-gray-400 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 pb-8 border-b border-gray-800">
            <div>
              <h3 className="text-white text-lg font-bold mb-3">
                Advanced Reliable Real Estate Portal
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                A verified marketplace for discovering, listing, and inquiring about residential and commercial properties.
              </p>
            </div>

            <div>
              <h4 className="text-white text-sm font-semibold uppercase tracking-wider mb-3">
                Explore Marketplace
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/" className="hover:text-white transition-colors">Home</Link>
                </li>
                <li>
                  <Link to="/properties" className="hover:text-white transition-colors">Browse Properties</Link>
                </li>
                <li>
                  <Link to="/properties/new" className="hover:text-white transition-colors">List a Property</Link>
                </li>
                <li>
                  <Link to="/messages" className="hover:text-white transition-colors">My Messages</Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-white text-sm font-semibold uppercase tracking-wider mb-3">
                Account & Access
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/login" className="hover:text-white transition-colors">Account Login</Link>
                </li>
                <li>
                  <Link to="/register" className="hover:text-white transition-colors">User Registration</Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-gray-500 gap-4">
            <p>© {new Date().getFullYear()} Advanced Reliable Real Estate Portal. All rights reserved.</p>
            <p>Built with React &amp; Django REST Framework.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
