import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import Navbar from '../components/Navbar';
import PropertyCard from '../components/PropertyCard';
import { isAdmin, getUserFromToken } from '../utils/auth';
import { getStates, getDistricts } from '../utils/locationData';

const PropertiesPage = () => {
  const [searchParams] = useSearchParams();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const pageSize = 12;
  const requestSeqRef = useRef(0);
  
  const [filters, setFilters] = useState(() => ({
    search: searchParams.get('search') || '',
    city: searchParams.get('city') || '',
    district: searchParams.get('district') || '',
    state: searchParams.get('state') || '',
    property_type: searchParams.get('property_type') || '',
    listing_type: searchParams.get('listing_type') || '',
    min_price: searchParams.get('min_price') || '',
    max_price: searchParams.get('max_price') || '',
    min_bedrooms: searchParams.get('min_bedrooms') || '',
    ordering: searchParams.get('ordering') || '-created_at'
  }));

  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      search: searchParams.get('search') || '',
      city: searchParams.get('city') || '',
      district: searchParams.get('district') || '',
      state: searchParams.get('state') || '',
      property_type: searchParams.get('property_type') || '',
      listing_type: searchParams.get('listing_type') || '',
      min_price: searchParams.get('min_price') || '',
      max_price: searchParams.get('max_price') || '',
      min_bedrooms: searchParams.get('min_bedrooms') || '',
      ordering: searchParams.get('ordering') || '-created_at'
    }));
  }, [searchParams]);

  const fetchProperties = async (targetPage = page) => {
    const currentSeq = ++requestSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key] !== '') {
          params.append(key, filters[key]);
        }
      });
      if (targetPage > 1) {
        params.append('page', targetPage);
      }
      
      const response = await api.get(`properties/?${params.toString()}`);
      if (currentSeq !== requestSeqRef.current) return;

      if (response.data && response.data.results) {
        setProperties(Array.isArray(response.data.results) ? response.data.results : []);
        setCount(response.data.count || 0);
      } else if (Array.isArray(response.data)) {
        setProperties(response.data);
        setCount(response.data.length);
      } else {
        setProperties([]);
        setCount(0);
      }
    } catch (err) {
      if (currentSeq !== requestSeqRef.current) return;
      setError('Failed to fetch properties. Please check your connection or try again later.');
    } finally {
      if (currentSeq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    setPage(1);
    const delayDebounceFn = setTimeout(() => {
      fetchProperties(1);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleStateFilterChange = (e) => {
    const newState = e.target.value;
    setFilters(prev => ({
      ...prev,
      state: newState,
      district: '' // Reset dependent district filter when state changes
    }));
  };

  const handlePageChange = (newPage) => {
    const totalPages = Math.ceil(count / pageSize) || 1;
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
    fetchProperties(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      city: '',
      district: '',
      state: '',
      property_type: '',
      listing_type: '',
      min_price: '',
      max_price: '',
      min_bedrooms: '',
      ordering: '-created_at'
    });
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Navbar />
      
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-8">
        
        {/* Filters Sidebar */}
        <aside className="w-full md:w-64 flex-shrink-0 bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Search & Filters</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input type="text" name="search" value={filters.search} onChange={handleFilterChange} placeholder="Keywords..." className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <select
                name="state"
                value={filters.state}
                onChange={handleStateFilterChange}
                className="w-full border-gray-300 rounded-md shadow-sm p-2 border bg-white focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All States</option>
                {getStates().map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
              <select
                name="district"
                value={filters.district}
                onChange={handleFilterChange}
                disabled={!filters.state}
                className="w-full border-gray-300 rounded-md shadow-sm p-2 border bg-white focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">{filters.state ? 'All Districts' : 'Select a State first'}</option>
                {filters.state && getDistricts(filters.state).map(dist => (
                  <option key={dist} value={dist}>{dist}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input type="text" name="city" value={filters.city} onChange={handleFilterChange} placeholder="e.g. Hyderabad" className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
              <select name="property_type" value={filters.property_type} onChange={handleFilterChange} className="w-full border-gray-300 rounded-md shadow-sm p-2 border bg-white focus:ring-blue-500 focus:border-blue-500">
                <option value="">All Types</option>
                <option value="APARTMENT">Apartment</option>
                <option value="FLAT">Flat</option>
                <option value="HOUSE">House</option>
                <option value="VILLA">Villa</option>
                <option value="PLOT">Residential Plot / Land</option>
                <option value="COMMERCIAL">Commercial Shop / Space</option>
                <option value="OFFICE">Office</option>
                <option value="COMMERCIAL_LAND">Commercial Land</option>
                <option value="SHOP">Shop</option>
                <option value="WAREHOUSE">Warehouse</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Listing Type</label>
              <select name="listing_type" value={filters.listing_type} onChange={handleFilterChange} className="w-full border-gray-300 rounded-md shadow-sm p-2 border bg-white focus:ring-blue-500 focus:border-blue-500">
                <option value="">Any</option>
                <option value="SALE">Sale</option>
                <option value="RENT">Rent</option>
              </select>
            </div>

            <div className="flex gap-2">
              <div className="w-1/2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Price</label>
                <input type="number" name="min_price" value={filters.min_price} onChange={handleFilterChange} className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="w-1/2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Price</label>
                <input type="number" name="max_price" value={filters.max_price} onChange={handleFilterChange} className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Bedrooms</label>
              <input type="number" name="min_bedrooms" value={filters.min_bedrooms} onChange={handleFilterChange} min="0" className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
            </div>
            
            <button 
              onClick={handleClearFilters}
              className="w-full mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium py-2"
            >
              Clear All Filters
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-grow">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-slate-900">Properties</h1>
              {getUserFromToken() && (
                <Link to="/properties/new" className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center shadow-sm">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                  Add Property
                </Link>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-600">Sort by:</label>
              <select name="ordering" value={filters.ordering} onChange={handleFilterChange} className="border-gray-300 rounded-md shadow-sm p-2 border bg-white text-sm focus:ring-blue-500 focus:border-blue-500">
                <option value="-created_at">Newest</option>
                <option value="price">Price: Low to High</option>
                <option value="-price">Price: High to Low</option>
                <option value="-area">Area: Largest First</option>
                <option value="area">Area: Smallest First</option>
              </select>
            </div>
          </div>

          {/* Status states */}
          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6 border border-red-200">
              {error}
            </div>
          )}

          {loading && !error && (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          )}

          {!loading && !error && properties.length === 0 && (
            <div className="bg-white text-center py-20 rounded-xl shadow-sm border border-slate-200">
              <p className="text-slate-500 text-lg">No properties found matching your criteria.</p>
              <button 
                onClick={handleClearFilters}
                className="mt-4 text-blue-600 hover:underline font-medium"
              >
                Clear filters to see all properties
              </button>
            </div>
          )}

          {/* Grid */}
          {!loading && !error && properties.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
              {properties.map(property => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {!loading && !error && count > pageSize && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-8 rounded-lg shadow-sm">
              <div className="flex flex-1 justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= Math.ceil(count / pageSize)}
                  className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(page - 1) * pageSize + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(page * pageSize, count)}</span> of{' '}
                    <span className="font-medium">{count}</span> properties
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                    <button
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1}
                      className="relative inline-flex items-center rounded-l-md px-3 py-2 text-gray-500 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      Previous
                    </button>
                    <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300">
                      Page {page} of {Math.ceil(count / pageSize) || 1}
                    </span>
                    <button
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= Math.ceil(count / pageSize)}
                      className="relative inline-flex items-center rounded-r-md px-3 py-2 text-gray-500 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PropertiesPage;
