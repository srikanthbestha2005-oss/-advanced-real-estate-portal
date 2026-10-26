import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('access');
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [user, setUser] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const pad = base64.length % 4;
        const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
        const jsonPayload = decodeURIComponent(atob(padded).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const payload = JSON.parse(jsonPayload);
        
        // Basic expiry check
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          handleLogout();
        } else {
          setUser({
            email: payload.email,
            role: payload.role,
            isStaff: payload.is_staff
          });
        }
      } catch (e) {
        console.error("Invalid token", e);
        handleLogout();
      }
    }
  }, [token]);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    setUser(null);
    setIsDropdownOpen(false);
    navigate('/login');
    // We avoid window.location.reload() by relying on state updates or router redirects,
    // but preserving the original behavior if it works best for the app context:
    window.location.reload();
  };

  const getRoleDisplay = () => {
    if (!user) return { icon: '👤', label: 'User' };
    switch (user.role) {
      case 'ADMIN': return { icon: '🛡️', label: 'Admin' };
      case 'AGENT': return { icon: '🏠', label: 'Agent' };
      case 'USER':
      default: return { icon: '👤', label: 'User' };
    }
  };

  const roleData = getRoleDisplay();

  const isCurrentPath = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="text-xl font-bold text-blue-600 flex items-center whitespace-nowrap">
              <svg 
                className="w-5 h-5 mr-2 shrink-0 inline-block text-blue-600" 
                viewBox="0 0 20 20" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                {/* Chimney */}
                <path d="M14 3.5V7H16V4C16 3.72 15.78 3.5 15.5 3.5H14.5C14.22 3.5 14 3.72 14 4V3.5Z" fill="#1E40AF" />
                {/* House Body */}
                <path d="M10 1.5L1.5 9.5H4V17C4 17.55 4.45 18 5 18H15C15.55 18 16 17.55 16 17V9.5H18.5L10 1.5Z" fill="#2563EB" />
                {/* Roof Fascia */}
                <path d="M10 1.5L1.5 9.5H4.8L10 4.5L15.2 9.5H18.5L10 1.5Z" fill="#1D4ED8" />
                {/* Accent Door (Warm Amber) */}
                <path d="M8 11.5C8 10.95 8.45 10.5 9 10.5H11C11.55 10.5 12 10.95 12 11.5V18H8V11.5Z" fill="#F59E0B" />
                <circle cx="11.2" cy="14.2" r="0.4" fill="#78350F" />
                {/* Windows */}
                <rect x="5.5" y="11" width="1.8" height="1.8" rx="0.3" fill="#DBEAFE" />
                <rect x="12.7" y="11" width="1.8" height="1.8" rx="0.3" fill="#DBEAFE" />
              </svg>
              <span>Advanced Reliable Real Estate Portal</span>
            </Link>
            <div className="hidden md:ml-10 md:flex md:space-x-8">
              <Link to="/" className={`${location.pathname === '/' ? 'border-blue-500 text-gray-900 border-b-2' : 'text-gray-500 hover:text-gray-900'} inline-flex items-center px-1 pt-1 text-sm font-medium whitespace-nowrap`}>Home</Link>
              <Link to="/properties" className={`${isCurrentPath('/properties') ? 'border-blue-500 text-gray-900 border-b-2' : 'text-gray-500 hover:text-gray-900'} inline-flex items-center px-1 pt-1 text-sm font-medium whitespace-nowrap`}>Properties</Link>
              {token && user && (
                <Link to="/my-properties" className={`${isCurrentPath('/my-properties') ? 'border-blue-500 text-gray-900 border-b-2' : 'text-gray-500 hover:text-gray-900'} inline-flex items-center px-1 pt-1 text-sm font-medium whitespace-nowrap`}>My Properties</Link>
              )}
              <Link to="/messages" className={`${isCurrentPath('/messages') ? 'border-blue-500 text-gray-900 border-b-2' : 'text-gray-500 hover:text-gray-900'} inline-flex items-center px-1 pt-1 text-sm font-medium whitespace-nowrap`}>Messages</Link>
              {user && user.role === 'ADMIN' && (
                <Link to="/admin" className={`${isCurrentPath('/admin') ? 'border-blue-500 text-gray-900 border-b-2' : 'text-gray-500 hover:text-gray-900'} inline-flex items-center px-1 pt-1 text-sm font-medium whitespace-nowrap`}>Admin Dashboard</Link>
              )}
            </div>
          </div>
          <div className="hidden md:flex md:items-center space-x-4">
            {token && user ? (
              <div className="flex items-center space-x-4">
                
                {/* Profile / Admin Indicator Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center space-x-2 px-3.5 py-1.5 border border-slate-200 hover:border-slate-300 rounded-full text-sm font-semibold text-slate-700 bg-slate-50/90 hover:bg-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition-all cursor-pointer"
                    aria-expanded={isDropdownOpen}
                    aria-haspopup="true"
                    title={`Role: ${roleData.label}`}
                  >
                    <span className="text-base leading-none">{roleData.icon}</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">{roleData.label}</span>
                    <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {isDropdownOpen && (
                    <div 
                      className="origin-top-right absolute right-0 mt-2 w-52 rounded-xl shadow-xl bg-white ring-1 ring-black/5 divide-y divide-gray-100 focus:outline-none z-50 border border-gray-100"
                      role="menu"
                      aria-orientation="vertical"
                    >
                      <div className="px-4 py-3" role="none">
                        <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold" role="none">Signed in as</p>
                        <p className="text-sm font-semibold text-gray-900 truncate mt-0.5" role="none">{user.email}</p>
                      </div>
                      <div className="py-1.5" role="none">
                        <div className="px-4 py-2 text-xs font-semibold text-gray-600 flex items-center bg-gray-50/60" role="menuitem">
                          <span className="mr-2 text-sm">{roleData.icon}</span>
                          Role: <span className="ml-1 text-gray-900 font-bold">{roleData.label}</span>
                        </div>
                        <Link
                          to="/my-properties"
                          onClick={() => setIsDropdownOpen(false)}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-50/60 hover:text-blue-700 font-medium transition-colors"
                          role="menuitem"
                        >
                          <span className="mr-2.5">📋</span> My Properties
                        </Link>
                        {user.role === 'ADMIN' && (
                          <Link
                            to="/admin"
                            onClick={() => setIsDropdownOpen(false)}
                            className="flex items-center px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 font-semibold transition-colors"
                            role="menuitem"
                          >
                            <span className="mr-2.5">🛡️</span> Admin Dashboard
                          </Link>
                        )}
                      </div>
                      <div className="py-1.5" role="none">
                        <button
                          onClick={handleLogout}
                          className="flex items-center w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 font-medium transition-colors"
                          role="menuitem"
                        >
                          <svg className="w-4 h-4 mr-2.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="group flex items-center gap-1.5 px-3.5 py-1.5 border border-red-200/90 rounded-full text-sm font-medium text-red-600 bg-red-50/40 hover:bg-red-50 hover:border-red-300 hover:text-red-700 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-400 cursor-pointer"
                  title="Sign out of your account"
                >
                  <svg className="w-4 h-4 text-red-500 group-hover:text-red-600 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="font-semibold text-xs tracking-wide">Logout</span>
                </button>
              </div>
            ) : (
              <>
                <Link to="/login" className="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium">Login</Link>
                <Link to="/register" className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">Register</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
