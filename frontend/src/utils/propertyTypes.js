export const RESIDENTIAL_TYPES = ['APARTMENT', 'FLAT', 'HOUSE', 'VILLA'];
export const LAND_TYPES = ['PLOT', 'COMMERCIAL_LAND'];
export const COMMERCIAL_TYPES = ['COMMERCIAL', 'OFFICE', 'SHOP', 'WAREHOUSE'];

export const ALL_PROPERTY_TYPES = [
  ...RESIDENTIAL_TYPES,
  ...LAND_TYPES,
  ...COMMERCIAL_TYPES,
];

export const isResidentialType = (type) => RESIDENTIAL_TYPES.includes(type);
export const isLandType = (type) => LAND_TYPES.includes(type);

// Visibility helpers
export const supportsBedrooms = (type) => isResidentialType(type);
export const supportsBathrooms = (type) => !isLandType(type);
export const supportsParking = (type) => !isLandType(type);

// Requirement helpers
export const requiresBathrooms = (type) => type === 'SHOP';
