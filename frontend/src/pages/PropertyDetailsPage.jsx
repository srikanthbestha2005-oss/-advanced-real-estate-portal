import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api';
import PropertyImageManager from '../components/PropertyImageManager';
import { formatImageUrl } from '../components/PropertyCard';
import { isAdmin, getUserFromToken } from '../utils/auth';
import {
  supportsBedrooms,
  supportsBathrooms,
  supportsParking,
} from '../utils/propertyTypes';

export const parseIndianMobileNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  // Accept only digits, spaces, hyphens, and optional leading +
  if (!/^\+?[\d\s-]+$/.test(trimmed)) return null;
  const digitsOnly = trimmed.replace(/[\s-]/g, '');
  const match = digitsOnly.match(/^(?:\+91|91|0)?([6-9]\d{9})$/);
  if (!match) return null;
  return match[1]; // Exactly 10 digits
};

export const formatDisplayPhone = (tenDigits) => {
  if (!tenDigits || tenDigits.length !== 10) return '';
  return `+91 ${tenDigits.slice(0, 5)} ${tenDigits.slice(5)}`;
};

const PropertyDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [notificationError, setNotificationError] = useState(location.state?.error || null);
  const [showUploadGuidance, setShowUploadGuidance] = useState(Boolean(location.state?.newlyCreated));

  useEffect(() => {
    const fetchPropertyDetails = async () => {
      try {
        setLoading(true);
        const response = await api.get(`properties/${id}/`);
        setProperty(response.data);
        setError(null);
      } catch (err) {
        console.error("Error fetching property:", err);
        if (err.response && err.response.status === 404) {
          setError('Property not found.');
        } else {
          setError('Failed to fetch property details. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPropertyDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <Navbar />
        <div className="flex-grow flex justify-center items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center p-4">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Oops!</h2>
            <p className="text-red-600 mb-6">{error || 'Property not found.'}</p>
            <button 
              onClick={() => navigate('/properties')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
            >
              Back to Properties
            </button>
          </div>
        </div>
      </div>
    );
  }

  
  const token = localStorage.getItem('access');
  
  const handleMessageOwner = async () => {
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      const response = await api.post('messaging/conversations/', { property_id: property.id });
      navigate(`/messages/${response.data.id}`);
    } catch (err) {
      alert(err.response?.data?.detail || "Could not start conversation.");
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this property?")) {
      try {
        await api.delete(`properties/${id}/`);
        navigate('/properties');
      } catch (err) {
        alert("Failed to delete property.");
      }
    }
  };

  const user = getUserFromToken();
  let isOwnerOrAdmin = isAdmin() || (user && property && String(user.user_id || user.id) === String(property.owner));

  const activeImages = property.images ? property.images.filter(img => img.is_active !== false) : [];
  const hasImages = activeImages.length > 0;
  const rawDisplayImage = hasImages ? (activeImages[activeImage]?.image || activeImages[0]?.image) : null;
  const displayImage = rawDisplayImage ? formatImageUrl(rawDisplayImage) : null;

  const validContactPhone = property ? parseIndianMobileNumber(property.contact_phone) : null;
  const displayContactPhone = validContactPhone ? formatDisplayPhone(validContactPhone) : null;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Navbar />
      
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link */}
        <div className="mb-6">
          <Link to="/properties" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors">
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            Back to Properties
          </Link>
        </div>

        {/* Flash notifications from navigation state */}
        {notificationError && (
          <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 flex items-center justify-between shadow-sm">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-3 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{notificationError}</span>
            </div>
            <button
              onClick={() => setNotificationError(null)}
              className="text-red-400 hover:text-red-600 p-1 rounded-md ml-4 transition-colors"
              title="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {showUploadGuidance && isOwnerOrAdmin && (
          <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-900 p-4 rounded-xl flex items-start justify-between shadow-sm">
            <div className="flex items-start">
              <svg className="w-5 h-5 mr-3 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-semibold text-blue-900">Property created successfully!</p>
                <p className="text-sm text-blue-700 mt-0.5">
                  You can now upload photos for this property in the <strong>Manage Property Images</strong> section below.
                </p>
                <a href="#property-image-manager" className="inline-block mt-2 text-xs font-semibold text-blue-600 underline hover:text-blue-800">
                  Jump to photo upload &darr;
                </a>
              </div>
            </div>
            <button
              onClick={() => setShowUploadGuidance(false)}
              className="text-blue-400 hover:text-blue-600 p-1 rounded-md ml-4 transition-colors"
              title="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            
            {/* Left Column - Images */}
            <div className="flex flex-col gap-4">
              {/* Main Image */}
              <div className="w-full h-80 sm:h-96 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200">
                {displayImage ? (
                  <img
                    src={displayImage}
                    alt={property.title || 'Property image'}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = formatImageUrl(null);
                    }}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <svg className="w-16 h-16 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <span className="text-lg font-medium">No Image Available</span>
                  </div>
                )}
              </div>
              
              {/* Thumbnails */}
              {hasImages && activeImages.length > 1 && (
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {activeImages.map((img, idx) => (
                    <button
                      key={img.id}
                      onClick={() => setActiveImage(idx)}
                      className={`flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 transition-all ${
                        activeImage === idx ? 'border-blue-600 opacity-100 shadow-md' : 'border-transparent opacity-60 hover:opacity-100 hover:border-gray-300'
                      }`}
                    >
                      <img
                        src={formatImageUrl(img.image)}
                        alt={`Thumbnail ${idx + 1}`}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = formatImageUrl(null);
                        }}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column - Details */}
            <div className="flex flex-col">
              {/* Badges and Price */}
              <div className="mb-6">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-bold rounded-full tracking-wide">FOR {property.listing_type}</span>
                  <span className="px-3 py-1 bg-slate-100 text-slate-800 text-sm font-semibold rounded-full uppercase">{property.property_type}</span>
                  
                  {property.verification_status === 'APPROVED' && (
                    <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-semibold rounded-full flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                      Verified
                    </span>
                  )}
                  
                  <span className={`px-3 py-1 text-sm font-semibold rounded-full ${property.status === 'ACTIVE' ? 'bg-indigo-100 text-indigo-800' : 'bg-red-100 text-red-800'}`}>
                    {property.status}
                  </span>
                </div>
                
                <h1 className="text-3xl font-extrabold text-slate-900 mb-3">{property.title}</h1>
                <div className="text-4xl font-extrabold text-blue-600 mb-4">₹{Number(property.price).toLocaleString('en-IN')}</div>
                {isOwnerOrAdmin && (
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => navigate(`/properties/${id}/edit`)} className="bg-yellow-500 text-white px-5 py-2 rounded-lg font-medium hover:bg-yellow-600 transition-colors shadow-sm text-sm flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                      Edit Property
                    </button>
                    <button onClick={handleDelete} className="bg-red-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm text-sm flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      Delete Property
                    </button>
                  </div>
                )}
              </div>

              {/* Specs Grid */}
              <div className="flex flex-wrap gap-4 py-6 border-y border-slate-200 mb-6">
                {supportsBedrooms(property.property_type) && property.bedrooms != null && (
                  <div className="flex-1 min-w-[120px] flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200/60 rounded-xl">
                    <span className="text-slate-500 text-xs uppercase font-semibold mb-1">Bedrooms</span>
                    <span className="font-bold text-slate-900 text-xl">{property.bedrooms}</span>
                  </div>
                )}
                {supportsBathrooms(property.property_type) && property.bathrooms != null && (
                  <div className="flex-1 min-w-[120px] flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200/60 rounded-xl">
                    <span className="text-slate-500 text-xs uppercase font-semibold mb-1">Bathrooms</span>
                    <span className="font-bold text-slate-900 text-xl">{property.bathrooms}</span>
                  </div>
                )}
                <div className="flex-1 min-w-[120px] flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200/60 rounded-xl">
                  <span className="text-slate-500 text-xs uppercase font-semibold mb-1">Area (sqft)</span>
                  <span className="font-bold text-slate-900 text-xl">{property.area}</span>
                </div>
                {supportsParking(property.property_type) && property.parking != null && (
                  <div className="flex-1 min-w-[120px] flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200/60 rounded-xl">
                    <span className="text-slate-500 text-xs uppercase font-semibold mb-1">Parking</span>
                    <span className="font-bold text-slate-900 text-xl">{property.parking}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-900 mb-3">Description</h3>
                <p className="text-slate-600 whitespace-pre-line leading-relaxed">{property.description}</p>
              </div>

              {/* Location */}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-900 mb-3">Location</h3>
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-start">
                  <svg className="w-5 h-5 text-slate-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  <p className="text-slate-700 font-medium">
                    {property.address}
                    {property.locality && <span>, {property.locality}</span>}
                    <br/>
                    {property.city}{property.district && property.district !== property.city && <span>, {property.district}</span>}, {property.state} - {property.pincode}
                  </p>
                </div>
              </div>

              {/* Features & Amenities */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-slate-900 mb-3">Features</h3>
                <div className="mb-4 flex items-center">
                  <span className="font-semibold text-slate-700 mr-2">Furnishing:</span>
                  <span className="text-slate-700 px-3 py-1 bg-slate-100 rounded-md text-sm font-medium">{property.furnishing}</span>
                </div>
                
                {property.amenities && property.amenities.length > 0 && (
                  <div>
                    <span className="font-semibold text-slate-700 block mb-2">Amenities:</span>
                    <div className="flex flex-wrap gap-2">
                      {property.amenities.map((amenity, index) => {
                        const amenityName = typeof amenity === 'object' ? amenity.name : amenity;
                        return (
                          <span key={index} className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-sm font-medium">
                            {amenityName}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Contact Block */}
              <div className="bg-white p-6 rounded-xl mt-auto shadow-sm border border-slate-200 flex flex-col gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">Interested in this property?</h3>
                  <p className="text-slate-500 text-sm">Have questions about this property? Connect directly with the owner.</p>
                </div>

                {/* Property Contact Options (WhatsApp) */}
                {validContactPhone && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                        Contact Owner
                      </span>
                      <span className="text-base font-bold text-slate-900">
                        {displayContactPhone}
                      </span>
                    </div>

                    <a 
                      href={`https://wa.me/91${validContactPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center text-sm shadow-sm"
                    >
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.173.086.275.073.376-.044.101-.116.433-.506.549-.68.116-.173.231-.145.39-.086s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.155.57 4.181 1.574 5.942l-1.682 6.136 6.309-1.654c1.705.932 3.659 1.464 5.741 1.464 6.627 0 12-5.373 12-12 0-6.627-5.373-12-12-12z" />
                      </svg>
                      WhatsApp
                    </a>
                  </div>
                )}
                
                <div>
                  <button 
                    onClick={handleMessageOwner}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 shadow-sm"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                    Message Owner
                  </button>
                </div>
                
                <div className="text-center pt-2 border-t border-slate-100">
                  <a href={`mailto:${property.owner_email}`} className="text-sm text-slate-500 hover:text-blue-600 transition-colors flex items-center justify-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                    Email Owner
                  </a>
                </div>
              </div>


              {/* Image Manager for Owner/Admin */}
              {isOwnerOrAdmin && (
                <div id="property-image-manager">
                  <PropertyImageManager 
                    propertyId={property.id} 
                    images={property.images || []} 
                    onImagesUpdated={() => {
                      setActiveImage(0);
                      // Refetch property to get updated images
                      api.get(`properties/${property.id}/`).then(res => setProperty(res.data));
                    }} 
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

    </div>
  );
};

export default PropertyDetailsPage;
