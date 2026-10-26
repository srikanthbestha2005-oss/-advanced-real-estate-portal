import React, { useState } from 'react';
import api from '../api';
import { formatImageUrl } from './PropertyCard';

const PropertyImageManager = ({ propertyId, images = [], onImagesUpdated }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState(null);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Validate format and size
    const maxSizeBytes = 5 * 1024 * 1024;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const invalidFiles = files.filter(f => !allowedTypes.includes(f.type.toLowerCase()) && !/\.(jpe?g|png|webp)$/i.test(f.name));
    if (invalidFiles.length > 0) {
      setError(`Unsupported format for "${invalidFiles[0].name}". Please upload JPEG, PNG, or WebP.`);
      e.target.value = '';
      return;
    }
    const oversizeFiles = files.filter(f => f.size > maxSizeBytes);
    if (oversizeFiles.length > 0) {
      setError(`Image "${oversizeFiles[0].name}" exceeds the 5 MB file size limit.`);
      e.target.value = '';
      return;
    }

    setUploading(true);
    setError(null);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('image', file);
        formData.append('is_active', 'true');
        formData.append('display_order', images.length + i);

        await api.post(`properties/${propertyId}/images/`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }
      onImagesUpdated();
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.image) {
        setError(err.response.data.image[0]);
      } else if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Failed to upload image.');
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (imageId) => {
    if (!window.confirm("Are you sure you want to delete this image?")) return;
    try {
      await api.delete(`properties/${propertyId}/images/${imageId}/`);
      onImagesUpdated();
    } catch (err) {
      console.error(err);
      setError('Failed to delete image.');
    }
  };

  const toggleActive = async (image) => {
    try {
      await api.patch(`properties/${propertyId}/images/${image.id}/`, {
        is_active: !image.is_active
      });
      onImagesUpdated();
    } catch (err) {
      console.error(err);
      setError('Failed to update image status.');
    }
  };

  const handleSetPrimary = async (image) => {
    setSettingPrimaryId(image.id);
    setError(null);
    try {
      await api.patch(`properties/${propertyId}/images/${image.id}/`, {
        is_primary: true,
        is_active: true
      });
      onImagesUpdated();
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Failed to set primary image.');
      }
    } finally {
      setSettingPrimaryId(null);
    }
  };

  return (
    <div className="mt-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <h3 className="text-xl font-bold text-slate-900 mb-4">Manage Property Images</h3>
      
      {error && <div className="mb-4 text-red-600 bg-red-50 p-3 rounded-lg border border-red-200 text-sm">{error}</div>}
      
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">Upload Images (JPEG, PNG, WebP up to 5 MB each)</label>
        <input 
          type="file" 
          accept="image/jpeg,image/png,image/webp,image/jpg"
          multiple
          onChange={handleFileUpload}
          disabled={uploading}
          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {uploading && <p className="text-sm text-blue-600 mt-2">Uploading image(s)...</p>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {images.map(img => (
          <div 
            key={img.id} 
            className={`relative rounded-lg overflow-hidden border-2 flex flex-col ${
              img.is_primary 
                ? 'border-blue-600 ring-2 ring-blue-300' 
                : (img.is_active ? 'border-green-500' : 'border-slate-300 opacity-60')
            }`}
          >
            {/* Primary badge overlay */}
            {img.is_primary && (
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-bold bg-blue-600 text-white shadow-sm flex items-center gap-1 z-10">
                ★ Primary
              </span>
            )}

            <div className="relative w-full h-32 bg-slate-100">
              <img 
                src={formatImageUrl(img.image)} 
                alt="Property" 
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = formatImageUrl(null);
                }}
                className="w-full h-32 object-cover" 
              />
              <div className="absolute top-0 right-0 p-1 flex gap-1 bg-black bg-opacity-50 rounded-bl-lg z-10">
                <button 
                  type="button"
                  onClick={() => toggleActive(img)}
                  className="p-1 text-white hover:text-blue-300 transition-colors"
                  title={img.is_active ? "Deactivate" : "Activate"}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                </button>
                <button 
                  type="button"
                  onClick={() => handleDelete(img.id)}
                  className="p-1 text-white hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                </button>
              </div>
            </div>

            {/* Set as Primary Button or Primary Indicator */}
            <div className="border-t border-slate-100 bg-white p-2">
              {img.is_primary ? (
                <div className="py-1.5 px-2 bg-blue-50 text-blue-700 text-xs font-semibold rounded text-center flex items-center justify-center gap-1">
                  <svg className="w-3.5 h-3.5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Primary Image
                </div>
              ) : (
                <button
                  type="button"
                  disabled={settingPrimaryId === img.id}
                  onClick={() => handleSetPrimary(img)}
                  className="w-full py-1.5 px-2 bg-slate-50 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Set this image as primary thumbnail"
                >
                  {settingPrimaryId === img.id ? (
                    <>
                      <span className="inline-block animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent"></span>
                      <span>Setting Primary...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span>Set as Primary</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {images.length === 0 && <p className="text-slate-500 text-sm">No images uploaded yet.</p>}
    </div>
  );
};

export default PropertyImageManager;
