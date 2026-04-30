// Simple localStorage persistence layer
// Saves and loads data from browser storage
// Will be replaced by Supabase when we add the backend

const KEYS = {
  TENANTS: 'gi_tenants',
  TICKETS: 'gi_tickets',
  SETTINGS: 'gi_settings',
  MESSAGES: 'gi_messages',
};

export function saveTenants(tenants) {
  try { localStorage.setItem(KEYS.TENANTS, JSON.stringify(tenants)); } catch(e) {}
}

export function loadTenants(fallback) {
  try {
    const saved = localStorage.getItem(KEYS.TENANTS);
    return saved ? JSON.parse(saved) : fallback;
  } catch(e) { return fallback; }
}

export function saveTickets(tickets) {
  try { localStorage.setItem(KEYS.TICKETS, JSON.stringify(tickets)); } catch(e) {}
}

export function loadTickets() {
  try {
    const saved = localStorage.getItem(KEYS.TICKETS);
    return saved ? JSON.parse(saved) : [];
  } catch(e) { return []; }
}

export function saveSettings(settings) {
  try { localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings)); } catch(e) {}
}

export function loadSettings(fallback) {
  try {
    const saved = localStorage.getItem(KEYS.SETTINGS);
    return saved ? JSON.parse(saved) : fallback;
  } catch(e) { return fallback; }
}

export function saveMessages(messages) {
  try { localStorage.setItem(KEYS.MESSAGES, JSON.stringify(messages)); } catch(e) {}
}

export function loadMessages() {
  try {
    const saved = localStorage.getItem(KEYS.MESSAGES);
    return saved ? JSON.parse(saved) : [];
  } catch(e) { return []; }
}

export function clearAll() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}
