// ==========================================================================
// V & K MEDIA VAULT - API CLIENT WITH OFFLINE / LOCAL FALLBACK
// ==========================================================================

const LOCAL_FALLBACK_ALBUMS = [
  {
    id: "family-album",
    name: "Family & Special Moments",
    description: "Cherished wedding and family memories of Vimal & Kenal",
    pin: "1511",
    coverImage: "",
    createdAt: new Date().toISOString()
  },
  {
    id: "celebrations-album",
    name: "Celebrations & Parties",
    description: "Celebrations, festive lights, and party highlights",
    pin: "9999",
    coverImage: "",
    createdAt: new Date().toISOString()
  },
  {
    id: "trips-album",
    name: "Vacation & Road Trips",
    description: "Pre-wedding shoot, travel adventures, and road trips",
    pin: "5678",
    coverImage: "",
    createdAt: new Date().toISOString()
  }
];

const LOCAL_FALLBACK_MEDIA = [
  {
    id: "demo-photo-1",
    albumId: "family-album",
    title: "Ring Ceremony Grand Entry",
    originalName: "ring_ceremony_entry.jpg",
    type: "photo",
    storageType: "cloud",
    url: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80",
    downloadUrl: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80",
    likes: 12,
    isFavorite: true,
    size: 2450000,
    createdAt: new Date().toISOString()
  },
  {
    id: "demo-photo-2",
    albumId: "family-album",
    title: "Haldi Yellow Vibes",
    originalName: "haldi_rituals.jpg",
    type: "photo",
    storageType: "cloud",
    url: "https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80",
    downloadUrl: "https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80",
    likes: 8,
    isFavorite: false,
    size: 1980000,
    createdAt: new Date().toISOString()
  },
  {
    id: "demo-photo-3",
    albumId: "family-album",
    title: "The Royal Wedding Vows",
    originalName: "royal_wedding_vows.jpg",
    type: "photo",
    storageType: "cloud",
    url: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80",
    downloadUrl: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80",
    likes: 24,
    isFavorite: true,
    size: 3200000,
    createdAt: new Date().toISOString()
  },
  {
    id: "demo-photo-4",
    albumId: "trips-album",
    title: "Pre-Wedding Twilight Shoot",
    originalName: "twilight_portrait.jpg",
    type: "photo",
    storageType: "cloud",
    url: "https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=1200&q=80",
    downloadUrl: "https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=1200&q=80",
    likes: 19,
    isFavorite: true,
    size: 2100000,
    createdAt: new Date().toISOString()
  }
];

const API = {
  // App Info
  async getInfo() {
    try {
      const res = await fetch('/api/info');
      if (res.ok) return await res.json();
    } catch (e) {}
    return {
      appName: "V & K Media Vault",
      theme: "luxury-dark",
      allowGuestDownloads: true
    };
  },

  // Auth: Admin Login
  async loginAdmin(password) {
    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) return data;
      if (data.message) return { success: false, message: data.message };
    } catch (e) {}

    if (password === '8068' || password === 'admin') {
      return { success: true, token: "admin-local-token", role: "admin" };
    }
    return { success: false, message: "Invalid Master Password (Default: 8068)" };
  },

  // Auth: Group PIN Login
  async loginGroup(pin) {
    try {
      const res = await fetch('/api/auth/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) return data;
      if (data.message) return { success: false, message: data.message };
    } catch (e) {}

    const trimmed = (pin || '').trim();
    const matched = LOCAL_FALLBACK_ALBUMS.find(a => a.pin === trimmed);
    if (matched) {
      return { success: true, role: 'guest', album: matched, token: 'guest-local-token' };
    }
    return { success: false, message: "Invalid PIN. Please enter the valid PIN for this folder." };
  },

  // Storage & Stats
  async getStats() {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) return await res.json();
    } catch (e) {}
    return {
      usedMB: 0,
      limitMB: 102400,
      percentUsed: 0,
      totalFiles: 0,
      totalAlbums: LOCAL_FALLBACK_ALBUMS.length
    };
  },

  // Update Settings
  async updateSettings(data) {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) return await res.json();
    } catch (e) {}
    return { success: true, settings: data };
  },

  // Albums CRUD
  async getAlbums() {
    try {
      const res = await fetch('/api/albums');
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) return list;
      }
    } catch (e) {}
    return LOCAL_FALLBACK_ALBUMS;
  },

  async createAlbum(data) {
    try {
      const res = await fetch('/api/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json().catch(() => null);
      if (res.ok && result && result.success) {
        if (result.album) {
          const idx = LOCAL_FALLBACK_ALBUMS.findIndex(a => a.id === result.album.id);
          if (idx === -1) LOCAL_FALLBACK_ALBUMS.push(result.album);
          else LOCAL_FALLBACK_ALBUMS[idx] = result.album;
        }
        return result;
      }
      if (result && result.message) return result;
    } catch (e) {
      console.error('Error creating album on server:', e);
    }
    const newAlbum = {
      id: 'album-' + Date.now(),
      name: data.name ? data.name.trim() : 'New Album',
      description: data.description ? data.description.trim() : '',
      pin: data.pin ? data.pin.trim() : Math.floor(1000 + Math.random() * 9000).toString(),
      coverImage: data.coverImage || '',
      createdAt: new Date().toISOString()
    };
    LOCAL_FALLBACK_ALBUMS.push(newAlbum);
    return { success: true, album: newAlbum, message: 'Album created' };
  },

  async updateAlbum(id, data) {
    try {
      const res = await fetch(`/api/albums/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json().catch(() => null);
      if (res.ok && result) {
        const idx = LOCAL_FALLBACK_ALBUMS.findIndex(a => a.id === id);
        if (idx !== -1) {
          LOCAL_FALLBACK_ALBUMS[idx] = { ...LOCAL_FALLBACK_ALBUMS[idx], ...data };
        }
        return result;
      }
      if (result && result.message) return result;
    } catch (e) {
      console.error('Error updating album:', e);
    }
    const idx = LOCAL_FALLBACK_ALBUMS.findIndex(a => a.id === id);
    if (idx !== -1) {
      LOCAL_FALLBACK_ALBUMS[idx] = { ...LOCAL_FALLBACK_ALBUMS[idx], ...data };
    }
    return { success: true, message: 'Album updated' };
  },

  async deleteAlbum(id) {
    try {
      const res = await fetch(`/api/albums/${id}`, { method: 'DELETE' });
      const result = await res.json().catch(() => null);
      const idx = LOCAL_FALLBACK_ALBUMS.findIndex(a => a.id === id);
      if (idx !== -1) LOCAL_FALLBACK_ALBUMS.splice(idx, 1);
      if (res.ok && result) return result;
      if (result && result.message) return result;
    } catch (e) {
      console.error('Error deleting album:', e);
    }
    const idx = LOCAL_FALLBACK_ALBUMS.findIndex(a => a.id === id);
    if (idx !== -1) {
      LOCAL_FALLBACK_ALBUMS.splice(idx, 1);
      return { success: true, message: 'Album deleted' };
    }
    return { success: false, message: 'Failed to delete album' };
  },

  // Media Operations
  async getMedia(params = {}) {
    try {
      const query = new URLSearchParams(params).toString();
      const res = await fetch(`/api/media?${query}`);
      if (res.ok) return await res.json();
    } catch (e) {}

    let list = [...LOCAL_FALLBACK_MEDIA];
    if (params.albumId && params.albumId !== 'all') {
      list = list.filter(m => m.albumId === params.albumId);
    }
    return list;
  },

  async uploadFiles(albumId, files, onProgress) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('albumId', albumId);
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');

      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            onProgress(percentComplete, e.loaded, e.total);
          }
        };
      }

      xhr.onload = () => {
        try {
          const resData = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && resData.success !== false) {
            resolve(resData);
          } else if (xhr.status === 413) {
            reject(new Error('File exceeds Vercel 4.5MB serverless limit. For large videos, use "Import from Google Drive" tab or local Wi-Fi!'));
          } else {
            reject(new Error(resData.message || `Upload failed with status ${xhr.status}`));
          }
        } catch (err) {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ success: true, count: files.length });
          } else if (xhr.status === 413) {
            reject(new Error('File exceeds Vercel 4.5MB serverless limit. For large videos, use "Import from Google Drive" tab or local Wi-Fi!'));
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during file upload'));
      };
      xhr.send(formData);
    });
  },

  async importGDrive(data) {
    try {
      const res = await fetch('/api/import/gdrive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json().catch(() => null);
      if (res.ok && result) return result;
      if (result && result.message) return result;
    } catch (e) {
      console.error('Error importing Google Drive:', e);
    }
    return { success: false, message: "Failed to connect to server for Google Drive import" };
  },

  async toggleFavorite(id) {
    try {
      const res = await fetch(`/api/media/${id}/favorite`, { method: 'POST' });
      if (res.ok) return await res.json();
    } catch (e) {}
    const item = LOCAL_FALLBACK_MEDIA.find(m => m.id === id);
    if (item) {
      item.isFavorite = !item.isFavorite;
      return { success: true, isFavorite: item.isFavorite };
    }
    return { success: true, isFavorite: true };
  },

  async likeMedia(id) {
    try {
      const res = await fetch(`/api/media/${id}/like`, { method: 'POST' });
      if (res.ok) return await res.json();
    } catch (e) {}
    const item = LOCAL_FALLBACK_MEDIA.find(m => m.id === id);
    if (item) {
      item.likes = (item.likes || 0) + 1;
      return { success: true, likes: item.likes };
    }
    return { success: true, likes: 1 };
  },

  async deleteMedia(id) {
    try {
      const res = await fetch(`/api/media/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      const idx = LOCAL_FALLBACK_MEDIA.findIndex(m => m.id === id);
      if (idx !== -1) LOCAL_FALLBACK_MEDIA.splice(idx, 1);
      if (res.ok && data) return data;
      if (data && data.message) return data;
      return { success: true, message: 'Media deleted' };
    } catch (e) {
      console.error('Error deleting media:', e);
    }
    const idx = LOCAL_FALLBACK_MEDIA.findIndex(m => m.id === id);
    if (idx !== -1) {
      LOCAL_FALLBACK_MEDIA.splice(idx, 1);
      return { success: true, message: 'Media deleted' };
    }
    return { success: false, message: 'Failed to delete media item' };
  },

  async getWishes() {
    try {
      const res = await fetch('/api/wishes');
      if (res.ok) return await res.json();
    } catch (e) {}
    return {
      success: true,
      wishes: [
        {
          id: "wish-demo-1",
          name: "Rahul & Family",
          side: "Groom's Side 🤵",
          message: "Wishing Vimal & Kenal a lifetime of love, joy, and wonderful adventures together! ❤️✨",
          createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
        }
      ]
    };
  },

  async submitWish(data) {
    try {
      const res = await fetch('/api/wishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json().catch(() => null);
      if (res.ok && result) return result;
      if (result && result.message) return result;
    } catch (e) {}
    return { success: true, wish: { id: 'wish-' + Date.now(), ...data, createdAt: new Date().toISOString() } };
  },

  getZipDownloadUrl(albumId, ids = null) {
    if (ids && ids.length > 0) {
      return `/api/download-zip?ids=${ids.join(',')}`;
    }
    return `/api/download-zip?albumId=${albumId || 'all'}`;
  }
};

window.API = API;
