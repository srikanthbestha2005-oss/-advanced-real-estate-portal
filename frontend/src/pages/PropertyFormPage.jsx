import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api';
import { isAdmin, getUserFromToken } from '../utils/auth';
import {
  supportsBedrooms,
  supportsBathrooms,
  supportsParking,
  requiresBathrooms,
} from '../utils/propertyTypes';
import {
  getStates,
  getDistricts,
} from '../utils/locationData';
import { formatImageUrl } from '../components/PropertyCard';

export {
  RESIDENTIAL_TYPES,
  LAND_TYPES,
  COMMERCIAL_TYPES,
  ALL_PROPERTY_TYPES,
  isResidentialType,
  isLandType,
  supportsBedrooms,
  supportsBathrooms,
  supportsParking,
  requiresBathrooms,
} from '../utils/propertyTypes';

export const validateIndianMobileNumber = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  const trimmed = phone.trim();
  if (!trimmed) {
    return false;
  }
  // Allow digits, spaces, hyphens, and optional leading +
  if (!/^\+?[\d\s-]+$/.test(trimmed)) {
    return false;
  }
  // Strip spaces and hyphens
  const digitsOnly = trimmed.replace(/[\s-]/g, '');
  // Match optional +91, 91, or 0 followed by 10 digits starting with 6, 7, 8, or 9
  const pattern = /^(?:\+91|91|0)?([6-9]\d{9})$/;
  return pattern.test(digitsOnly);
};

export const normalizeIndianMobileNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  if (!/^\+?[\d\s-]+$/.test(trimmed)) return null;
  const digitsOnly = trimmed.replace(/[\s-]/g, '');
  const match = digitsOnly.match(/^(?:\+91|91|0)?([6-9]\d{9})$/);
  if (!match) return null;
  return `+91${match[1]}`;
};

const PropertyFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Property Image states
  const [selectedFiles, setSelectedFiles] = useState([]); // [{ id, file, previewUrl, isPrimary }]
  const [existingImages, setExistingImages] = useState([]); // [{ id, image, is_primary, is_active, display_order }]
  const [imageError, setImageError] = useState(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [deletingImageId, setDeletingImageId] = useState(null);
  const [settingPrimaryImageId, setSettingPrimaryImageId] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    property_type: 'APARTMENT',
    listing_type: 'SALE',
    price: '',
    area: '',
    bedrooms: '',
    bathrooms: '',
    parking: '',
    address: '',
    state: '',
    district: '',
    city: '',
    locality: '',
    pincode: '',
    latitude: '',
    longitude: '',
    contact_phone: '',
    status: 'ACTIVE',
    verification_status: 'PENDING'
  });

  useEffect(() => {
    // Security check on client
    const user = getUserFromToken();
    if (!user) {
      navigate('/login');
      return;
    }

    if (isEditMode) {
      const fetchProperty = async () => {
        try {
          const res = await api.get(`properties/${id}/`);
          const prop = res.data;

          // Frontend ownership check: Allow if admin or if user ID matches property owner
          const isAuthorized = isAdmin() || (user && prop && String(user.user_id || user.id) === String(prop.owner));
          if (!isAuthorized) {
            navigate(`/properties/${id}`, {
              replace: true,
              state: { error: 'You do not have permission to edit this property.' }
            });
            return;
          }

          setFormData({
            title: prop.title || '',
            description: prop.description || '',
            property_type: prop.property_type || 'APARTMENT',
            listing_type: prop.listing_type || 'SALE',
            price: prop.price || '',
            area: prop.area || '',
            bedrooms: prop.bedrooms !== null && prop.bedrooms !== undefined ? prop.bedrooms : '',
            bathrooms: prop.bathrooms !== null && prop.bathrooms !== undefined ? prop.bathrooms : '',
            parking: prop.parking !== null && prop.parking !== undefined ? prop.parking : '',
            address: prop.address || '',
            state: prop.state || '',
            district: prop.district || '',
            city: prop.city || '',
            locality: prop.locality || '',
            pincode: prop.pincode || '',
            latitude: prop.latitude !== null && prop.latitude !== undefined ? prop.latitude : '',
            longitude: prop.longitude !== null && prop.longitude !== undefined ? prop.longitude : '',
            contact_phone: prop.contact_phone || '',
            status: prop.status || 'ACTIVE',
            verification_status: prop.verification_status || 'PENDING'
          });

          setExistingImages(Array.isArray(prop.images) ? prop.images : []);
        } catch (err) {
          setError("Failed to load property details.");
        } finally {
          setLoading(false);
        }
      };
      fetchProperty();
    }
  }, [id, isEditMode, navigate]);

  const handleStateChange = (e) => {
    const newState = e.target.value;
    setFormData(prev => ({
      ...prev,
      state: newState,
      district: ''
    }));
    setFieldErrors(prev => ({
      ...prev,
      state: null,
      district: null,
      location: null
    }));
  };

  const handleDistrictChange = (e) => {
    const newDistrict = e.target.value;
    setFormData(prev => ({
      ...prev,
      district: newDistrict
    }));
    setFieldErrors(prev => ({
      ...prev,
      district: null,
      location: null
    }));
  };

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      selectedFiles.forEach(f => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    };
  }, [selectedFiles]);

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const validFiles = [];
    const errors = [];
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const maxSizeBytes = 5 * 1024 * 1024; // 5 MB

    files.forEach(file => {
      const isTypeAllowed = allowedTypes.includes(file.type.toLowerCase()) || /\.(jpe?g|png|webp)$/i.test(file.name);
      if (!isTypeAllowed) {
        errors.push(`"${file.name}": Unsupported format. Only JPEG, PNG, and WebP are allowed.`);
        return;
      }
      if (file.size > maxSizeBytes) {
        errors.push(`"${file.name}": File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds 5 MB limit.`);
        return;
      }
      validFiles.push(file);
    });

    if (errors.length > 0) {
      setImageError(errors.join('\n'));
    } else {
      setImageError(null);
    }

    if (validFiles.length > 0) {
      const hasExistingPrimary = existingImages.some(img => img.is_primary);
      const hasNewPrimary = selectedFiles.some(f => f.isPrimary);
      const needsPrimary = !hasExistingPrimary && !hasNewPrimary;

      const newItems = validFiles.map((file, idx) => ({
        id: `new_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${idx}`,
        file,
        previewUrl: URL.createObjectURL(file),
        isPrimary: needsPrimary && idx === 0,
      }));

      setSelectedFiles(prev => [...prev, ...newItems]);
    }

    if (e.target) {
      e.target.value = '';
    }
  };

  const handleRemoveSelectedFile = (idToRemove) => {
    setSelectedFiles(prev => {
      const target = prev.find(f => f.id === idToRemove);
      if (target && target.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      const remaining = prev.filter(f => f.id !== idToRemove);
      if (target && target.isPrimary && remaining.length > 0) {
        const hasExistingPrimary = existingImages.some(img => img.is_primary);
        if (!hasExistingPrimary) {
          remaining[0].isPrimary = true;
        }
      }
      return remaining;
    });
  };

  const handleSetPrimaryNewFile = (idToPrimary) => {
    setSelectedFiles(prev => prev.map(f => ({
      ...f,
      isPrimary: f.id === idToPrimary
    })));
    setExistingImages(prev => prev.map(img => ({
      ...img,
      is_primary: false
    })));
  };

  const handleSetPrimaryExisting = async (existingImg) => {
    setSettingPrimaryImageId(existingImg.id);
    setImageError(null);
    try {
      await api.patch(`properties/${id}/images/${existingImg.id}/`, {
        is_primary: true,
        is_active: true
      });
      setExistingImages(prev => prev.map(img => ({
        ...img,
        is_primary: img.id === existingImg.id
      })));
      setSelectedFiles(prev => prev.map(f => ({
        ...f,
        isPrimary: false
      })));
    } catch (err) {
      console.error("Failed to set primary image:", err);
      setImageError(err.response?.data?.detail || "Failed to set primary image.");
    } finally {
      setSettingPrimaryImageId(null);
    }
  };

  const handleDeleteExisting = async (existingImgId) => {
    if (!window.confirm("Are you sure you want to delete this image?")) return;
    setDeletingImageId(existingImgId);
    setImageError(null);
    try {
      await api.delete(`properties/${id}/images/${existingImgId}/`);
      setExistingImages(prev => {
        const deleted = prev.find(img => img.id === existingImgId);
        const remaining = prev.filter(img => img.id !== existingImgId);
        if (deleted && deleted.is_primary && remaining.length > 0 && !selectedFiles.some(f => f.isPrimary)) {
          api.patch(`properties/${id}/images/${remaining[0].id}/`, { is_primary: true })
            .catch(() => {});
          remaining[0].is_primary = true;
        }
        return remaining;
      });
    } catch (err) {
      console.error("Failed to delete image:", err);
      setImageError(err.response?.data?.detail || "Failed to delete image.");
    } finally {
      setDeletingImageId(null);
    }
  };

  const handleUploadStagedNow = async () => {
    if (!selectedFiles.length || !isEditMode) return;
    setUploadingImages(true);
    setImageError(null);
    let uploadErrorCount = 0;
    let lastUploadError = null;

    for (let i = 0; i < selectedFiles.length; i++) {
      const item = selectedFiles[i];
      setUploadProgress(`Uploading image ${i + 1} of ${selectedFiles.length}...`);
      try {
        const formData = new FormData();
        formData.append('image', item.file);
        formData.append('is_primary', item.isPrimary ? 'true' : 'false');
        formData.append('is_active', 'true');
        formData.append('display_order', existingImages.length + i);
        await api.post(`properties/${id}/images/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } catch (uploadErr) {
        console.error(`Failed to upload ${item.file.name}:`, uploadErr);
        uploadErrorCount++;
        const detail = uploadErr.response?.data?.image?.[0] || uploadErr.response?.data?.detail || "Upload failed.";
        lastUploadError = `"${item.file.name}": ${detail}`;
      }
    }

    try {
      const res = await api.get(`properties/${id}/`);
      setExistingImages(Array.isArray(res.data.images) ? res.data.images : []);
      selectedFiles.forEach(f => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
      setSelectedFiles([]);
    } catch (refreshErr) {
      console.error("Failed to refresh images:", refreshErr);
    }

    setUploadingImages(false);
    if (uploadErrorCount > 0) {
      setImageError(`${uploadErrorCount} image(s) failed to upload:\n${lastUploadError}`);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: null }));
    }

  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    // Client-side validation for contact phone number
    const trimmedPhone = (formData.contact_phone || '').trim();
    if (!isEditMode && !trimmedPhone) {
      const msg = "Contact Phone Number is required.";
      setError(msg);
      setFieldErrors({ contact_phone: msg });
      setSubmitting(false);
      return;
    }

    if (trimmedPhone && !validateIndianMobileNumber(trimmedPhone)) {
      const msg = "Please enter a valid 10-digit Indian mobile number (e.g. +91 9876543210 or 9876543210) starting with 6, 7, 8, or 9.";
      setError(msg);
      setFieldErrors({ contact_phone: msg });
      setSubmitting(false);
      return;
    }


    // Client-side validation for shop bathrooms
    if (requiresBathrooms(formData.property_type)) {
      const bStr = formData.bathrooms !== null && formData.bathrooms !== undefined ? String(formData.bathrooms).trim() : '';
      if (bStr === '') {
        const msg = "Bathrooms is required for shops (enter 0 if none).";
        setError(msg);
        setFieldErrors({ bathrooms: msg });
        setSubmitting(false);
        return;
      }
      const numBathrooms = Number(bStr);
      if (isNaN(numBathrooms) || numBathrooms < 0 || !Number.isInteger(numBathrooms)) {
        const msg = "Bathrooms must be a non-negative whole number (0 or greater).";
        setError(msg);
        setFieldErrors({ bathrooms: msg });
        setSubmitting(false);
        return;
      }
    }

    // Location validation
    const trimmedCity = (formData.city || '').trim();
    if (!formData.state || !formData.district || !trimmedCity) {
      const msg = "Please provide State, District, and City/Town for your property.";
      setError(msg);
      setFieldErrors({
        state: !formData.state ? 'State is required.' : null,
        district: !formData.district ? 'District is required.' : null,
        city: !trimmedCity ? 'City/Town is required.' : null
      });
      setSubmitting(false);
      return;
    }

    // Prepare payload based on property type visibility rules
    const payload = {
      ...formData,
      contact_phone: trimmedPhone || null,
      district: formData.district || null,
      city: trimmedCity,
      locality: (formData.locality || '').trim() || null,
      latitude: formData.latitude ? Number(Number(formData.latitude).toFixed(6)) : null,
      longitude: formData.longitude ? Number(Number(formData.longitude).toFixed(6)) : null
    };

    if (!supportsBedrooms(payload.property_type)) {
      payload.bedrooms = null;
    } else if (payload.bedrooms === '' || payload.bedrooms === undefined) {
      payload.bedrooms = null;
    } else {
      payload.bedrooms = Number(payload.bedrooms);
    }

    if (!supportsBathrooms(payload.property_type)) {
      payload.bathrooms = null;
    } else if (payload.bathrooms === '' || payload.bathrooms === undefined) {
      payload.bathrooms = null;
    } else {
      payload.bathrooms = Number(payload.bathrooms);
    }

    if (!supportsParking(payload.property_type)) {
      payload.parking = 0;
    } else if (payload.parking === '' || payload.parking === null || payload.parking === undefined) {
      payload.parking = 0;
    } else {
      payload.parking = Number(payload.parking);
    }

    try {
      if (isEditMode) {
        await api.patch(`properties/${id}/`, payload);

        // Upload any newly selected images
        let uploadErrorCount = 0;
        let lastUploadError = null;

        if (selectedFiles.length > 0) {
          setUploadingImages(true);
          for (let i = 0; i < selectedFiles.length; i++) {
            const item = selectedFiles[i];
            setUploadProgress(`Uploading new image ${i + 1} of ${selectedFiles.length}...`);
            try {
              const formData = new FormData();
              formData.append('image', item.file);
              formData.append('is_primary', item.isPrimary ? 'true' : 'false');
              formData.append('is_active', 'true');
              formData.append('display_order', existingImages.length + i);
              await api.post(`properties/${id}/images/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
              });
            } catch (uploadErr) {
              console.error(`Failed to upload ${item.file.name}:`, uploadErr);
              uploadErrorCount++;
              const detail = uploadErr.response?.data?.image?.[0] || uploadErr.response?.data?.detail || "Upload failed.";
              lastUploadError = `"${item.file.name}": ${detail}`;
            }
          }
        }

        if (uploadErrorCount > 0) {
          alert(`Property updated, but ${uploadErrorCount} image(s) could not be uploaded:\n${lastUploadError}`);
        } else {
          alert('Property updated successfully!');
        }

        navigate(`/properties/${id}`);
      } else {
        // Create mode: Create property first
        const res = await api.post('properties/', payload);
        const newPropertyId = res.data.id;

        // Upload any selected images now that we have newPropertyId
        let uploadErrorCount = 0;
        let lastUploadError = null;

        if (selectedFiles.length > 0) {
          setUploadingImages(true);
          for (let i = 0; i < selectedFiles.length; i++) {
            const item = selectedFiles[i];
            setUploadProgress(`Uploading image ${i + 1} of ${selectedFiles.length}...`);
            try {
              const formData = new FormData();
              formData.append('image', item.file);
              formData.append('is_primary', item.isPrimary ? 'true' : 'false');
              formData.append('is_active', 'true');
              formData.append('display_order', i);
              await api.post(`properties/${newPropertyId}/images/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
              });
            } catch (uploadErr) {
              console.error(`Failed to upload ${item.file.name}:`, uploadErr);
              uploadErrorCount++;
              const detail = uploadErr.response?.data?.image?.[0] || uploadErr.response?.data?.detail || "Upload failed.";
              lastUploadError = `"${item.file.name}": ${detail}`;
            }
          }
        }

        if (uploadErrorCount > 0) {
          alert(`Property created, but ${uploadErrorCount} image(s) could not be uploaded:\n${lastUploadError}`);
        } else {
          alert('Property created successfully!');
        }

        navigate(`/properties/${newPropertyId}`, { state: { newlyCreated: true } });
      }
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data) {
        const errObj = err.response.data;
        setFieldErrors(typeof errObj === 'object' && errObj !== null ? errObj : {});
        const msg = Object.keys(errObj).map(k => `${k}: ${Array.isArray(errObj[k]) ? errObj[k].join(' ') : errObj[k]}`).join('\n');
        setError(msg || "An error occurred.");
      } else {
        setError("Failed to save property.");
      }
    } finally {
      setSubmitting(false);
      setUploadingImages(false);
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
      
      <main className="flex-grow max-w-4xl mx-auto w-full px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-6">{isEditMode ? 'Edit Property' : 'Add New Property'}</h1>
          
          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6 border border-red-200 whitespace-pre-wrap">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Title *</label>
                <input required type="text" name="title" value={formData.title} onChange={handleChange} className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea required name="description" rows="4" value={formData.description} onChange={handleChange} className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"></textarea>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Type *</label>
                <select required name="property_type" value={formData.property_type} onChange={handleChange} className="w-full border-gray-300 rounded-md shadow-sm p-2 border bg-white focus:ring-blue-500 focus:border-blue-500">
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
                <label htmlFor="listing_type" className="block text-sm font-medium text-gray-700 mb-1">Listing Type *</label>
                <select id="listing_type" required name="listing_type" value={formData.listing_type} onChange={handleChange} className="w-full border-gray-300 rounded-md shadow-sm p-2 border bg-white focus:ring-blue-500 focus:border-blue-500">
                  <option value="SALE">Sell</option>
                  <option value="RENT">Rent</option>
                </select>
              </div>

              <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
                  <span>{formData.listing_type === 'RENT' ? 'Monthly Rent (₹/month)' : 'Price (₹)'}</span> *
                </label>
                <input
                  id="price"
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder={formData.listing_type === 'RENT' ? 'Enter monthly rent' : 'Enter property price'}
                  className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Area (sq.ft) *</label>
                <input required type="number" step="0.01" min="0" name="area" value={formData.area} onChange={handleChange} className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
              </div>

              {supportsBedrooms(formData.property_type) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bedrooms</label>
                  <input type="number" min="0" name="bedrooms" value={formData.bedrooms} onChange={handleChange} className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
                </div>
              )}

              {supportsBathrooms(formData.property_type) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bathrooms {requiresBathrooms(formData.property_type) && '*'}
                  </label>
                  <input
                    required={requiresBathrooms(formData.property_type)}
                    type="number"
                    min="0"
                    step="1"
                    name="bathrooms"
                    value={formData.bathrooms}
                    onChange={handleChange}
                    placeholder={requiresBathrooms(formData.property_type) ? "e.g. 0 or 1" : ""}
                    className={`w-full border rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 ${
                      fieldErrors.bathrooms ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                  {requiresBathrooms(formData.property_type) && (
                    <p className="mt-1 text-xs text-gray-500">
                      Enter 0 if this shop does not have a private or dedicated bathroom.
                    </p>
                  )}
                  {fieldErrors.bathrooms && (
                    <p className="mt-1 text-sm text-red-600">
                      {Array.isArray(fieldErrors.bathrooms) ? fieldErrors.bathrooms.join(' ') : fieldErrors.bathrooms}
                    </p>
                  )}
                </div>
              )}

              {supportsParking(formData.property_type) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parking Spots</label>
                  <input type="number" min="0" name="parking" value={formData.parking} onChange={handleChange} className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
                </div>
              )}

              <div className="md:col-span-2 mt-4 pt-4 border-t border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Location Details</h3>
                <p className="text-sm text-gray-500 mb-2">
                  Select your property's State and District, and enter the City and Locality.
                </p>
                {fieldErrors.location && (
                  <div className="bg-red-50 text-red-700 p-3 rounded-md mb-3 border border-red-200 text-sm">
                    {fieldErrors.location}
                  </div>
                )}
              </div>

              {/* State Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                <select
                  required
                  name="state"
                  value={formData.state}
                  onChange={handleStateChange}
                  className={`w-full border rounded-md shadow-sm p-2 bg-white focus:ring-blue-500 focus:border-blue-500 ${
                    fieldErrors.state ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select State</option>
                  {getStates().map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
                {fieldErrors.state && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.state}</p>
                )}
              </div>

              {/* District Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">District *</label>
                <select
                  required
                  name="district"
                  value={formData.district}
                  onChange={handleDistrictChange}
                  disabled={!formData.state}
                  className={`w-full border rounded-md shadow-sm p-2 bg-white focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400 ${
                    fieldErrors.district ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                >
                  <option value="">{formData.state ? 'Select District' : 'First select a State'}</option>
                  {getDistricts(formData.state).map(dist => (
                    <option key={dist} value={dist}>{dist}</option>
                  ))}
                </select>
                {fieldErrors.district && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.district}</p>
                )}
              </div>

              {/* City/Town Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City / Town *</label>
                <input
                  required
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Enter city name"
                  className={`w-full border rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 ${
                    fieldErrors.city ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {fieldErrors.city && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.city}</p>
                )}
              </div>

              {/* Locality / Area Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Locality / Area</label>
                <input
                  type="text"
                  name="locality"
                  value={formData.locality}
                  onChange={handleChange}
                  placeholder="e.g. Banjara Hills, MVP Colony, etc."
                  className={`w-full border rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 ${
                    fieldErrors.locality ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {fieldErrors.locality && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.locality}</p>
                )}
              </div>

              {/* Detailed Address */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Detailed Address / Street / Landmark *</label>
                <input
                  required
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="e.g. Flat 301, Sri Sai Residency, Road No. 2"
                  className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pincode *</label>
                <input
                  required
                  type="text"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleChange}
                  placeholder="e.g. 500081"
                  className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Property Images Section */}
              <div className="md:col-span-2 mt-4 pt-4 border-t border-gray-100" id="property-images-section">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-0.5">Property Images</h3>
                    <p className="text-sm text-gray-500">
                      Upload photos to showcase your property. The designated primary image will appear as the main card thumbnail.
                    </p>
                  </div>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded mt-1 sm:mt-0 inline-block self-start">
                    JPEG, PNG, WebP &bull; Max 5 MB each
                  </span>
                </div>

                {imageError && (
                  <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 border border-red-200 text-sm whitespace-pre-wrap flex items-start justify-between">
                    <div className="flex items-start">
                      <svg className="w-4 h-4 mr-2 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>{imageError}</span>
                    </div>
                    <button type="button" onClick={() => setImageError(null)} className="text-red-400 hover:text-red-600 font-bold ml-2">
                      &times;
                    </button>
                  </div>
                )}

                {/* Upload Dropzone / File Picker Button */}
                <div className="mb-4">
                  <input
                    type="file"
                    id="property-images-input"
                    name="property_images"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    multiple
                    onChange={handleImageSelect}
                    disabled={submitting || uploadingImages}
                    className="hidden"
                  />
                  <label
                    htmlFor="property-images-input"
                    className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                      submitting || uploadingImages
                        ? 'bg-gray-100 border-gray-300 cursor-not-allowed text-gray-400'
                        : 'border-blue-300 bg-blue-50/40 hover:bg-blue-50 hover:border-blue-500 text-blue-700'
                    }`}
                  >
                    <svg className="w-10 h-10 mb-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="font-semibold text-sm">
                      {isEditMode ? 'Add More Images' : 'Choose Property Images'}
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      Click to select one or multiple files (JPEG, PNG, WebP)
                    </span>
                  </label>
                </div>

                {uploadingImages && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent mr-2"></div>
                    <span>{uploadProgress || 'Uploading images...'}</span>
                  </div>
                )}

                {/* Grid of Images (Existing and Newly Selected) */}
                {((isEditMode && existingImages.length > 0) || selectedFiles.length > 0) ? (
                  <div>
                    {isEditMode && selectedFiles.length > 0 && (
                      <div className="mb-3 flex items-center justify-between bg-blue-50 p-2.5 rounded-lg border border-blue-200">
                        <span className="text-xs text-blue-800 font-medium">
                          {selectedFiles.length} new image(s) selected to upload.
                        </span>
                        <button
                          type="button"
                          onClick={handleUploadStagedNow}
                          disabled={uploadingImages}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-sm disabled:bg-blue-300 transition-colors"
                        >
                          {uploadingImages ? 'Uploading...' : 'Upload Selected Now'}
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {/* Render existing images if in Edit Mode */}
                      {isEditMode && existingImages.map(img => (
                        <div
                          key={`existing-${img.id}`}
                          className={`relative rounded-xl overflow-hidden border-2 flex flex-col bg-white shadow-sm transition-all ${
                            img.is_primary ? 'border-blue-600 ring-2 ring-blue-300' : 'border-gray-200'
                          }`}
                        >
                          {img.is_primary && (
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-bold bg-blue-600 text-white shadow-sm z-10 flex items-center gap-1">
                              ★ Primary
                            </span>
                          )}
                          <div className="relative w-full h-32 bg-gray-100">
                            <img
                              src={formatImageUrl(img.image)}
                              alt="Property"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = formatImageUrl(null);
                              }}
                              className="w-full h-32 object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => handleDeleteExisting(img.id)}
                              disabled={deletingImageId === img.id || uploadingImages}
                              className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-600 text-white rounded-full transition-colors z-10 shadow"
                              title="Delete this image"
                            >
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                          <div className="p-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs">
                            <span className="text-gray-500 truncate max-w-[80px]">Uploaded</span>
                            {img.is_primary ? (
                              <span className="text-blue-700 font-semibold flex items-center">
                                Primary
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSetPrimaryExisting(img)}
                                disabled={settingPrimaryImageId === img.id || uploadingImages}
                                className="text-blue-600 hover:text-blue-800 font-medium hover:underline flex items-center gap-1"
                              >
                                {settingPrimaryImageId === img.id ? 'Setting...' : 'Make Primary'}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Render newly selected files */}
                      {selectedFiles.map(fileObj => (
                        <div
                          key={fileObj.id}
                          className={`relative rounded-xl overflow-hidden border-2 flex flex-col bg-white shadow-sm transition-all ${
                            fileObj.isPrimary ? 'border-blue-600 ring-2 ring-blue-300' : 'border-gray-200'
                          }`}
                        >
                          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white shadow-sm z-10">
                            {fileObj.isPrimary ? '★ Primary (New)' : 'New'}
                          </span>
                          <div className="relative w-full h-32 bg-gray-100">
                            <img
                              src={fileObj.previewUrl}
                              alt="Selected preview"
                              className="w-full h-32 object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveSelectedFile(fileObj.id)}
                              disabled={uploadingImages}
                              className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-600 text-white rounded-full transition-colors z-10 shadow"
                              title="Remove this image"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          <div className="p-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs">
                            <span className="text-gray-500 truncate max-w-[80px]" title={fileObj.file.name}>
                              {(fileObj.file.size / (1024 * 1024)).toFixed(1)} MB
                            </span>
                            {fileObj.isPrimary ? (
                              <span className="text-blue-700 font-semibold flex items-center">
                                Primary
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSetPrimaryNewFile(fileObj.id)}
                                disabled={uploadingImages}
                                className="text-blue-600 hover:text-blue-800 font-medium hover:underline flex items-center gap-1"
                              >
                                Make Primary
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <p className="text-sm text-gray-500">No images selected yet.</p>
                    <p className="text-xs text-gray-400 mt-1">Select one or more photos above to preview them here.</p>
                  </div>
                )}
              </div>

              <div className="md:col-span-2 mt-4 pt-4 border-t border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Contact Information</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Interested buyers or tenants will use this phone number to contact the listing owner.
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Phone Number {!isEditMode && '*'}
                </label>
                <input
                  required={!isEditMode}
                  type="tel"
                  name="contact_phone"
                  value={formData.contact_phone}
                  onChange={handleChange}
                  placeholder="e.g. +91 98765 43210 or 9876543210"
                  className={`w-full border rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 ${
                    fieldErrors.contact_phone ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter a valid 10-digit Indian mobile number (optional +91 or 0 prefix accepted).
                </p>
                {fieldErrors.contact_phone && (
                  <p className="mt-1 text-sm text-red-600">
                    {Array.isArray(fieldErrors.contact_phone) ? fieldErrors.contact_phone.join(' ') : fieldErrors.contact_phone}
                  </p>
                )}
              </div>

              {isAdmin() && (
                <>
                  <div className="md:col-span-2 mt-4 pt-4 border-t border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Admin Status</h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select name="status" value={formData.status} onChange={handleChange} className="w-full border-gray-300 rounded-md shadow-sm p-2 border bg-white focus:ring-blue-500 focus:border-blue-500">
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="SOLD">Sold</option>
                      <option value="RENTED">Rented</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Verification Status</label>
                    <select name="verification_status" value={formData.verification_status} onChange={handleChange} className="w-full border-gray-300 rounded-md shadow-sm p-2 border bg-white focus:ring-blue-500 focus:border-blue-500">
                      <option value="PENDING">Pending</option>
                      <option value="APPROVED">Approved</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                  </div>
                </>
              )}

            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <button 
                type="button" 
                onClick={() => navigate(-1)} 
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                disabled={submitting || uploadingImages}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={submitting || uploadingImages}
                className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors flex items-center shadow-sm disabled:bg-blue-400"
              >
                {uploadingImages ? (uploadProgress || 'Uploading Images...') : (submitting ? 'Saving...' : (isEditMode ? 'Update Property' : 'Create Property'))}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default PropertyFormPage;
