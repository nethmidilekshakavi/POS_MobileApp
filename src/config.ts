// Centralized app config.
// Change the base URL here ONLY — every screen/api file should import
// API_BASE_URL from this file instead of hardcoding it separately.

export const API_BASE_URL = "https://demo.trackerstay.com";

// If your backend routes all live under /api, keep this too so call sites
// don't need to repeat "/api" everywhere.
export const API_URL = `${API_BASE_URL}/api`;