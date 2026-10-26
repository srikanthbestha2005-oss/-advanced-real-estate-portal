import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api';
import { isAdmin } from '../utils/auth';
import { Link } from 'react-router-dom';
import { formatImageUrl } from '../components/PropertyCard';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/properties');
      return;
    }

    fetchPendingProperties();
  }, [navigate]);

  const fetchPendingProperties = async () => {
    setLoading(true);
    try {
      const res = await api.get('properties/?verification_status=PENDING&page_size=100');
      const pendingProps = res.data.results || res.data;
      setProperties(Array.isArray(pendingProps) ? pendingProps : []);
    } catch (err) {
      setError('Failed to fetch properties');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    setError(null);
    setSuccess(null);
    try {
      await api.patch(`properties/${id}/`, { verification_status: status });
      setSuccess(`Property successfully ${status.toLowerCase()}.`);
      fetchPendingProperties();
    } catch (err) {
      setError("Failed to update status.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Navbar />
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard - Pending Approvals</h1>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6 border border-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 text-green-700 p-4 rounded-md mb-6 border border-green-200">
            {success}
          </div>
        )}

        {properties.length === 0 ? (
          <div className="bg-white text-center py-20 rounded-lg shadow-sm border border-slate-200">
            <p className="text-slate-500 text-lg">No pending properties require review.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map(property => {
              const activeImages = property.images ? property.images.filter(img => img.is_active !== false) : [];
              const rawDisplay = activeImages.length > 0 ? (activeImages.find(img => img.is_primary)?.image || activeImages[0].image) : null;
              const displayImage = rawDisplay ? formatImageUrl(rawDisplay) : null;
              
              return (
                <div key={property.id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt={property.title || 'Property'}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = formatImageUrl(null);
                      }}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 bg-slate-100 flex items-center justify-center">
                      <span className="text-slate-400 text-sm font-medium">No Image Available</span>
                    </div>
                  )}
                  <div className="p-4 flex-grow">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-bold text-slate-900 line-clamp-1">{property.title}</h3>
                      <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                        {property.verification_status}
                      </span>
                    </div>
                    <p className="text-blue-600 font-bold text-xl mb-2">₹{Number(property.price).toLocaleString('en-IN')}</p>
                    
                    <div className="text-sm text-slate-600 mb-2">
                      <span className="font-semibold">Type:</span> {property.property_type} | <span className="font-semibold">For:</span> {property.listing_type}
                    </div>
                    <div className="text-sm text-slate-600 mb-2">
                      <span className="font-semibold">Location:</span> {property.city}, {property.state}
                    </div>
                    <div className="text-sm text-slate-600 mb-4">
                      <span className="font-semibold">Owner:</span> {property.owner_email || 'Unknown'}
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-slate-100">
                      <Link to={`/properties/${property.id}`} className="flex-1 text-center bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-2 rounded font-medium transition-colors">View Details</Link>
                      <button onClick={() => handleStatusUpdate(property.id, 'APPROVED')} className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded font-medium transition-colors">Approve</button>
                      <button onClick={() => handleStatusUpdate(property.id, 'REJECTED')} className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded font-medium transition-colors">Reject</button>
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

export default AdminDashboard;
