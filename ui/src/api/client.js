/**
 * src/api/client.js
 * Connects the React frontend to the Express backend at localhost:5000
 */

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const api = {

  async get(route) {
    const res = await fetch(`${BASE_URL}${route}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.details || errorData.error || `GET ${route} failed: ${res.status}`);
    }
    return res.json();
  },

  async post(route, body) {
    const res = await fetch(`${BASE_URL}${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.details || errorData.error || `DELETE ${route} failed: ${res.status}`);
    }
    return res.json();
  },
};
