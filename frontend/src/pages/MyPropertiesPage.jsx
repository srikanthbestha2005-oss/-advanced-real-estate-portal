import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import Navbar from '../components/Navbar';
import { formatImageUrl } from '../components/PropertyCard';
import { supportsBedrooms, supportsBathrooms } from '../utils/propertyTypes';

const MyPropertiesPage = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('access');
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchMyProperties = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('properties/?my_properties=true');
      const data = response.data?.results || response.data;
      setProperties(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load my properties:', err);
      if (err.response && err.response.status === 401) {
        setError('Your session has expired. Please log in again.');
      } else {
        setError(err.response?.data?.detail || 'Failed to fetch your properties. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyProperties();
  }, [token]);

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <Navbar />
        <main className="flex-grow flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              🔒
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Sign in Required</h2>
            <p className="text-slate-500 mb-6 text-sm">
              Please sign in to your account to view and manage your property listings.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-colors"
            >
              Sign In
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Derived filtered lists
  const approvedCount = properties.filter((p) => p.verification_status === 'APPROVED').length;
  const pendingCount = properties.filter((p) => p.verification_status === 'PENDING').length;
  const rejectedCount = properties.filter((p) => p.verification_status === 'REJECTED').length;

  const filteredProperties = properties.filter((p) => {
    if (statusFilter === 'ALL') return true;
    return p.verification_status === statusFilter;
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">My Properties</h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage your property listings, track verification status, and update details.
            </p>
          </div>

          <Link
            to="/properties/new"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors self-start sm:self-auto gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Post New Property
          </Link>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 mb-6">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              statusFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            All Listings
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                statusFilter === 'ALL' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {properties.length}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              statusFilter === 'APPROVED'
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-green-50 border border-slate-200'
            }`}
          >
            Approved
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                statusFilter === 'APPROVED' ? 'bg-green-700 text-white' : 'bg-green-100 text-green-800'
              }`}
            >
              {approvedCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              statusFilter === 'PENDING'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-amber-50 border border-slate-200'
            }`}
          >
            Pending Verification
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                statusFilter === 'PENDING' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {pendingCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              statusFilter === 'REJECTED'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-red-50 border border-slate-200'
            }`}
          >
            Rejected
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                statusFilter === 'REJECTED' ? 'bg-red-700 text-white' : 'bg-red-100 text-red-800'
              }`}
            >
              {rejectedCount}
            </span>
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm font-medium">{error}</span>
            </div>
            <button
              onClick={fetchMyProperties}
              className="text-xs font-semibold px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-md transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-500 text-sm font-medium">Loading your listings...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredProperties.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </div>
            {properties.length === 0 ? (
              <>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No properties listed yet</h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
                  Ready to sell or rent your property? Post your first listing to reach potential buyers and tenants.
                </p>
                <Link
                  to="/properties/new"
                  className="inline-flex items-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Post Your First Property
                </Link>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No properties in this category</h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
                  You do not have any properties matching the "{statusFilter.toLowerCase()}" filter.
                </p>
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-sm rounded-lg transition-colors"
                >
                  View All Listings
                </button>
              </>
            )}
          </div>
        )}

        {/* Properties Grid */}
        {!loading && !error && filteredProperties.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProperties.map((property) => {
              // Find primary or first image
              const activeImages = Array.isArray(property.images)
                ? property.images.filter((img) => img.is_active !== false)
                : [];
              const primary = activeImages.find((img) => img.is_primary) || activeImages[0];
              const imageUrl = formatImageUrl(primary?.image);

              const formattedType = property.property_type
                ? property.property_type.replace(/_/g, ' ')
                : 'Property';

              const locationText =
                [property.city, property.state].filter(Boolean).join(', ') || 'Location Unspecified';

              return (
                <div
                  key={property.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {/* Image Header with Verification & Type Badges */}
                    <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                      <img
                        src={imageUrl}
                        alt={property.title || 'Property listing'}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = formatImageUrl(null);
                        }}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none gap-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider shadow-sm text-white ${
                            property.listing_type === 'RENT' ? 'bg-indigo-600' : 'bg-blue-600'
                          }`}
                        >
                          For {property.listing_type || 'Sale'}
                        </span>

                        {/* Distinct Verification Status Badge */}
                        {property.verification_status === 'APPROVED' && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-green-600 text-white shadow-sm gap-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Approved
                          </span>
                        )}

                        {property.verification_status === 'PENDING' && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500 text-white shadow-sm gap-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Pending
                          </span>
                        )}

                        {property.verification_status === 'REJECTED' && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-red-600 text-white shadow-sm gap-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Rejected
                          </span>
                        )}
                      </div>

                      {/* Bottom-right Status Badge (Active/Inactive) */}
                      <div className="absolute bottom-2 right-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                            property.status === 'ACTIVE'
                              ? 'bg-blue-900 bg-opacity-80 text-white'
                              : 'bg-gray-800 bg-opacity-80 text-gray-200'
                          }`}
                        >
                          {property.status}
                        </span>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-5">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="inline-block text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          {formattedType}
                        </span>
                        <span className="text-xs text-slate-400">
                          {activeImages.length} image{activeImages.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      <Link to={`/properties/${property.id}`} className="block group">
                        <h3
                          className="text-lg font-bold text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors"
                          title={property.title}
                        >
                          {property.title}
                        </h3>
                      </Link>

                      <p className="text-slate-500 text-sm mt-1 flex items-center gap-1 line-clamp-1" title={locationText}>
                        <svg
                          className="w-4 h-4 text-slate-400 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        {locationText}
                      </p>

                      {/* Specs */}
                      <div className="grid grid-cols-3 gap-2 py-2.5 mt-3 border-y border-slate-100 text-center text-xs">
                        {supportsBedrooms(property.property_type) ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{property.bedrooms || '—'}</span>
                            <span className="text-slate-400 uppercase text-[10px]">Beds</span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{property.parking || 0}</span>
                            <span className="text-slate-400 uppercase text-[10px]">Parking</span>
                          </div>
                        )}

                        <div className="flex flex-col border-x border-slate-100">
                          <span className="font-bold text-slate-900">
                            {supportsBathrooms(property.property_type) ? property.bathrooms ?? '—' : '—'}
                          </span>
                          <span className="text-slate-400 uppercase text-[10px]">Baths</span>
                        </div>

                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{property.area || '—'}</span>
                          <span className="text-slate-400 uppercase text-[10px]">Sq.Ft</span>
                        </div>
                      </div>

                      {/* Helpful guidance notes for pending/rejected */}
                      {property.verification_status === 'PENDING' && (
                        <div className="mt-3 p-2 bg-amber-50 rounded-lg text-amber-800 text-xs flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>Under admin review before public listing.</span>
                        </div>
                      )}

                      {property.verification_status === 'REJECTED' && (
                        <div className="mt-3 p-2 bg-red-50 rounded-lg text-red-800 text-xs flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>Listing rejected. Click Edit to adjust details.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Price & Action Buttons */}
                  <div className="px-5 pb-5 pt-2 border-t border-slate-100 flex flex-col gap-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Price</span>
                      <span className="text-xl font-extrabold text-blue-600">
                        ₹{Number(property.price).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        to={`/properties/${property.id}`}
                        className="text-center py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
                      >
                        View Details
                      </Link>

                      <Link
                        to={`/properties/${property.id}/edit`}
                        className="text-center py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 transition-colors"
                      >
                        Edit Property
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyPropertiesPage;
