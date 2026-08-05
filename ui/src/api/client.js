/**
 * src/api/client.js
 * Connects the React frontend to the Express backend at localhost:5000
 */

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getHeaders = (customHeaders = {}) => {
  const headers = { ...customHeaders };
  try {
    const saved = localStorage.getItem('crm_user');
    const user = saved ? JSON.parse(saved) : null;
    if (user && user.id) {
      headers['x-user-id'] = user.id;
    }
  } catch (error) {
    console.error('Error reading user from localStorage:', error);
  }
  return headers;
};

// In-flight GET request deduplication map to prevent redundant concurrent fetches
const pendingRequests = new Map();

export const api = {

  async get(route) {
    if (pendingRequests.has(route)) {
      return pendingRequests.get(route);
    }

    const requestPromise = (async () => {
      try {
        const separator = route.includes('?') ? '&' : '?';
        const res = await fetch(`${BASE_URL}${route}${separator}t=${Date.now()}`, {
          headers: getHeaders()
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.details || errorData.error || `GET ${route} failed: ${res.status}`);
        }
        return await res.json();
      } finally {
        pendingRequests.delete(route);
      }
    })();

    pendingRequests.set(route, requestPromise);
    return requestPromise;
  },

  async post(route, body) {
    const res = await fetch(`${BASE_URL}${route}`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.details || errorData.error || `POST ${route} failed: ${res.status}`);
    }
    return res.json();
  },


  async put(route, body) {
    const res = await fetch(`${BASE_URL}${route}`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.details || errorData.error || `PUT ${route} failed: ${res.status}`);
    }
    return res.json();
  },

  async delete(route) {
    const res = await fetch(`${BASE_URL}${route}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.details || errorData.error || `DELETE ${route} failed: ${res.status}`);
    }
    return res.json();
  },
};
