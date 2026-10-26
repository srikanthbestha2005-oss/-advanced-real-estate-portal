import React from 'react';
import { Link } from 'react-router-dom';
import { supportsBedrooms, supportsBathrooms } from '../utils/propertyTypes';

const PLACEHOLDER_IMAGE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300' fill='%23f3f4f6'><rect width='400' height='300' fill='%23f3f4f6'/><path d='M160 140l-30 40h140l-40-55-30 40z' fill='%239ca3af'/><circle cx='170' cy='115' r='12' fill='%239ca3af'/><text x='200' y='215' font-family='sans-serif' font-size='14' font-weight='500' fill='%236b7280' text-anchor='middle'>No Image Available</text></svg>";

export const formatImageUrl = (url) => {
  if (!url || typeof url !== 'string') return PLACEHOLDER_IMAGE;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  const backendBase = 'http://127.0.0.1:8000';
  return url.startsWith('/') ? `${backendBase}${url}` : `${backendBase}/${url}`;
};

const PropertyCard = ({ property }) => {
  if (!property) return null;

  // Find primary image or first active image
  let rawImageUrl = null;
  if (Array.isArray(property.images) && property.images.length > 0) {
    const activeImages = property.images.filter((img) => img.is_active !== false);
    if (activeImages.length > 0) {
      const primary = activeImages.find((img) => img.is_primary) || activeImages[0];
      rawImageUrl = primary?.image;
    }
  }

  const imageUrl = formatImageUrl(rawImageUrl);

  const handleImageError = (e) => {
    e.currentTarget.onerror = null; // Prevent repeated error loops
    e.currentTarget.src = PLACEHOLDER_IMAGE;
  };

  const locationText = [property.city, property.state].filter(Boolean).join(', ') || 'Location Unspecified';
  const priceDisplay = property.price != null ? `₹${Number(property.price).toLocaleString('en-IN')}` : 'Price on Request';

  const formattedType = property.property_type
    ? property.property_type.replace(/_/g, ' ')
    : 'Property';

  const specs = [];
  if (supportsBedrooms(property.property_type) && property.bedrooms != null && Number(property.bedrooms) > 0) {
    specs.push({ label: 'Beds', value: property.bedrooms });
  }
  if (supportsBathrooms(property.property_type) && property.bathrooms != null && Number(property.bathrooms) > 0) {
    specs.push({ label: 'Baths', value: property.bathrooms });
  }
  if (property.area != null && property.area !== '') {
    specs.push({ label: 'Sq.Ft', value: property.area });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 overflow-hidden flex flex-col justify-between h-full group">
      <div>
        {/* Image Container with Badges */}
        <Link to={`/properties/${property.id}`} className="block relative h-52 w-full overflow-hidden bg-slate-100 flex-shrink-0">
          <img
            src={imageUrl}
            alt={property.title || 'Property listing'}
            onError={handleImageError}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          
          {/* Top Badges */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none gap-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider shadow-sm text-white ${
              property.listing_type === 'RENT' ? 'bg-indigo-600' : 'bg-blue-600'
            }`}>
              {property.listing_type ? `For ${property.listing_type}` : 'For Sale'}
            </span>

            {property.verification_status === 'APPROVED' && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-green-600 text-white shadow-sm gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Verified
              </span>
            )}
          </div>
        </Link>

        {/* Card Body */}
        <div className="p-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              {formattedType}
            </span>
          </div>

          <Link to={`/properties/${property.id}`} className="block">
            <h3
              className="text-lg font-bold text-slate-900 line-clamp-1 hover:text-blue-600 transition-colors"
              title={property.title}
            >
              {property.title}
            </h3>
          </Link>

          <p className="text-slate-500 text-sm mt-1 flex items-center gap-1 line-clamp-1" title={locationText}>
            <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {locationText}
          </p>

          {/* Specs Grid: Beds, Baths, Area (Dynamic based on property type) */}
          {specs.length > 0 && (
            <div className={`grid gap-2 py-3 mt-4 border-y border-slate-100 text-center ${
              specs.length === 3 ? 'grid-cols-3' : specs.length === 2 ? 'grid-cols-2' : 'grid-cols-1'
            }`}>
              {specs.map((spec, index) => (
                <div key={spec.label} className={`flex flex-col items-center ${index > 0 ? 'border-l border-slate-100' : ''}`}>
                  <span className="font-bold text-slate-900 text-sm">
                    {spec.value}
                  </span>
                  <span className="text-slate-500 text-[11px] uppercase tracking-wider">{spec.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Card Footer: Price & View Details Button */}
      <div className="px-5 pb-5 pt-1 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs text-slate-400 block font-medium uppercase tracking-wider">Price</span>
          <span className="text-xl font-extrabold text-blue-600 truncate block">
            {priceDisplay}
          </span>
        </div>

        <Link
          to={`/properties/${property.id}`}
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex-shrink-0"
        >
          View Details
          <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
};

export default PropertyCard;
