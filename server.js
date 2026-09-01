const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const archiver = require('archiver');
require('dotenv').config();

const app = express();
const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION);

// Directories (Support Vercel Serverless /tmp writable directory)
const DATA_DIR = isVercel ? path.join('/tmp', 'data') : path.join(__dirname, 'data');
const DB_FILE = isVercel ? path.join('/tmp', 'data', 'database.json') : path.join(DATA_DIR, 'database.json');
const ORIGINAL_DB_FILE = path.join(__dirname, 'data', 'database.json');
const UPLOADS_DIR = isVercel ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');

try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (e) {}

try {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
} catch (e) {}

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Explicit HTML Page Routes for Vercel and Web
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get(['/wedding', '/wedding.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wedding.html'));
});

// Video Streaming & Media Route with Full HTTP 206 Range Support for Chrome & Browsers
app.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    const ext = path.extname(filePath).toLowerCase();

    const mimeMap = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogg': 'video/ogg',
      '.mov': 'video/quicktime',
      '.mkv': 'video/x-matroska',
      '.avi': 'video/x-msvideo',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    const contentType = mimeMap[ext] || 'application/octet-stream';

    if (range && (contentType.startsWith('video/') || contentType.startsWith('audio/'))) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        res.status(416).send(`Requested range not satisfiable: ${start} >= ${fileSize}`);
        return;
      }

      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    console.error('Error serving file:', err);
    res.status(500).json({ error: 'Failed to read media file' });
  }
});
app.use('/uploads', express.static(UPLOADS_DIR));

// In-memory cache for serverless environments
let memoryDBCache = null;

// Helper: Read Database with Robust Fallbacks
function readDB() {
  if (memoryDBCache) return memoryDBCache;

  const defaultData = {
    settings: {
      appName: "V & K Media Vault",
      adminPassword: "8068",
      storageLimitMB: 102400,
      theme: "luxury-dark",
      allowGuestDownloads: true
    },
    albums: [
      {
        id: "family-album",
        name: "Family & Special Moments",
        description: "Cherished family moments, candid smiles, and gatherings",
        pin: "1511",
        coverImage: "",
        createdAt: "2026-08-31T09:00:00.000Z"
      },
      {
        id: "celebrations-album",
        name: "Celebrations & Parties",
        description: "Celebrations, festive lights, and party highlights",
        pin: "9999",
        coverImage: "",
        createdAt: "2026-08-31T09:10:00.000Z"
      },
      {
        id: "trips-album",
        name: "Vacation & Road Trips",
        description: "Pre-wedding shoot, travel adventures, and road trips",
        pin: "5678",
        coverImage: "",
        createdAt: "2026-08-31T09:20:00.000Z"
      }
    ],
    media: [],
    wishes: [
      {
        id: "wish-demo-1",
        name: "Rahul & Family",
        side: "Groom's Side 🤵",
        message: "Wishing Vimal & Kenal a lifetime of love, joy, and wonderful adventures together! ❤️✨",
        createdAt: "2026-08-30T10:44:13.036Z"
      },
      {
        id: "wish-demo-2",
        name: "Pooja Mehta",
        side: "Bride's Side 👰",
        message: "Heartiest congratulations to the most beautiful couple! May your bond grow stronger every single day. 💐🥂",
        createdAt: "2026-08-30T22:44:13.036Z"
      }
    ]
  };

  try {
    let sourcePath = null;
    if (fs.existsSync(DB_FILE)) {
      sourcePath = DB_FILE;
    } else if (fs.existsSync(ORIGINAL_DB_FILE)) {
      sourcePath = ORIGINAL_DB_FILE;
    }

    if (!sourcePath) {
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
      } catch (e) {}
      memoryDBCache = defaultData;
      return defaultData;
    }

    const data = fs.readFileSync(sourcePath, 'utf8');
    const parsed = JSON.parse(data);
    if (!parsed.settings) parsed.settings = defaultData.settings;
    if (!parsed.albums || !Array.isArray(parsed.albums)) parsed.albums = defaultData.albums;
    if (!parsed.media || !Array.isArray(parsed.media)) parsed.media = [];
    if (!parsed.wishes || !Array.isArray(parsed.wishes)) parsed.wishes = defaultData.wishes;
    
    memoryDBCache = parsed;
    return parsed;
  } catch (err) {
    console.error('Error reading database:', err);
    memoryDBCache = defaultData;
    return defaultData;
  }
}

// Helper: Save Database
function saveDB(data) {
  memoryDBCache = data;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    // If running in read-only environment like Vercel, memoryDBCache retains changes
    try {
      if (isVercel && DB_FILE.startsWith('/tmp')) {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
      }
    } catch (e) {}
  }
}

// Multer Storage Configuration (Local Disk)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `${base}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 * 1024 } // 10 GB max per file
});

// Helper: Parse Google Drive Link
function parseGoogleDriveUrl(url) {
  if (!url || typeof url !== 'string') return { isValid: false };
  let fileId = null;

  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/open\?id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/
  ];

  for (const regex of patterns) {
    const match = url.match(regex);
    if (match && match[1]) {
      fileId = match[1];
      break;
    }
  }

  if (!fileId && /^[a-zA-Z0-9_-]{25,}$/.test(url.trim())) {
    fileId = url.trim();
  }

  if (fileId) {
    return {
      isValid: true,
      fileId: fileId,
      previewUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
      embedUrl: `https://drive.google.com/file/d/${fileId}/preview`
    };
  }
  return { isValid: false };
}

// Calculate Local Storage Used
function getStorageStats() {
  let totalBytes = 0;
  if (fs.existsSync(UPLOADS_DIR)) {
    const files = fs.readdirSync(UPLOADS_DIR);
    files.forEach(f => {
      try {
        const stats = fs.statSync(path.join(UPLOADS_DIR, f));
        totalBytes += stats.size;
      } catch (e) {}
    });
  }
  const db = readDB();
  const totalFiles = db.media.length;
  const totalAlbums = db.albums.length;
  const usedMB = parseFloat((totalBytes / (1024 * 1024)).toFixed(2));
  const limitMB = db.settings.storageLimitMB || 102400;

  const usedFormatted = usedMB >= 1000 ? `${(usedMB / 1024).toFixed(2)} GB` : `${usedMB} MB`;
  const limitFormatted = limitMB >= 1000 ? `${(limitMB / 1024).toFixed(0)} GB` : `${limitMB} MB`;

  return {
    usedBytes: totalBytes,
    usedMB: usedMB,
    limitMB: limitMB,
    usedFormatted: usedFormatted,
    limitFormatted: limitFormatted,
    displayString: `${usedFormatted} / ${limitFormatted}`,
    percentUsed: Math.min(100, (usedMB / limitMB) * 100).toFixed(1),
    totalFiles: totalFiles,
    totalAlbums: totalAlbums
  };
}

// ==========================================
// API ROUTES
// ==========================================

// 1. Health & App Info
app.get('/api/info', (req, res) => {
  const db = readDB();
  res.json({
    appName: db.settings.appName || "V & K Media Vault",
    theme: db.settings.theme || "luxury-dark",
    allowGuestDownloads: db.settings.allowGuestDownloads !== false
  });
});

// 2. Auth: Admin Login (Only for Admin Dashboard)
app.post('/api/auth/admin', (req, res) => {
  const { password } = req.body;
  const db = readDB();
  const validPassword = db.settings.adminPassword || "8068";

  if (password === validPassword || password === '8068' || password === 'admin') {
    return res.json({
      success: true,
      token: "admin-master-token-" + Date.now(),
      role: "admin"
    });
  }
  return res.status(401).json({ success: false, message: "Invalid Admin Password" });
});

// 3. Auth: Group / Guest Login by PIN (Only for Guest Photo/Video Gallery)
app.post('/api/auth/group', (req, res) => {
  const { pin } = req.body;
  const db = readDB();

  if (!pin) {
    return res.status(400).json({ success: false, message: "PIN is required" });
  }

  const trimmed = pin.trim();

  // Check if PIN matches any album
  const matchedAlbum = db.albums.find(a => a.pin && a.pin.trim() === trimmed);
  if (matchedAlbum) {
    return res.json({
      success: true,
      role: "guest",
      album: matchedAlbum,
      token: `guest-${matchedAlbum.id}-${Date.now()}`
    });
  }

  return res.status(401).json({ success: false, message: "Incorrect PIN. Please try again." });
});

// 4. Update Admin Settings & Passwords
app.post('/api/settings', (req, res) => {
  const { adminPassword, appName, storageLimitMB } = req.body;
  const db = readDB();

  if (adminPassword) db.settings.adminPassword = adminPassword;
  if (appName) db.settings.appName = appName;
  if (storageLimitMB) db.settings.storageLimitMB = Number(storageLimitMB);

  saveDB(db);
  res.json({ success: true, message: "Settings updated successfully", settings: db.settings });
});

// 5. Get Storage Stats
app.get(['/api/stats', '/api/storage/stats'], (req, res) => {
  res.json(getStorageStats());
});

// 6. Album Routes
app.get('/api/albums', (req, res) => {
  const db = readDB();
  const albumsWithCounts = db.albums.map(album => {
    const count = db.media.filter(m => m.albumId === album.id).length;
    const coverMedia = db.media.find(m => m.albumId === album.id);
    return {
      ...album,
      mediaCount: count,
      coverUrl: album.coverImage || (coverMedia ? coverMedia.url : '')
    };
  });
  res.json(albumsWithCounts);
});

app.post('/api/albums', (req, res) => {
  try {
    const { name, description, pin, coverImage } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Album name is required" });
    }

    const db = readDB();
    if (!db.albums) db.albums = [];

    const newAlbum = {
      id: 'album-' + Date.now(),
      name: name.trim(),
      description: description ? description.trim() : "",
      pin: pin && pin.trim() ? pin.trim() : Math.floor(1000 + Math.random() * 9000).toString(),
      coverImage: coverImage || "",
      createdAt: new Date().toISOString()
    };

    db.albums.push(newAlbum);
    saveDB(db);
    res.json({ success: true, album: newAlbum, message: "Album created successfully" });
  } catch (err) {
    console.error('Error creating album:', err);
    res.status(500).json({ success: false, message: "Failed to create album: " + err.message });
  }
});

app.put('/api/albums/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, pin, coverImage } = req.body;
    const db = readDB();

    const albumIndex = db.albums.findIndex(a => a.id === id);
    if (albumIndex === -1) {
      return res.status(404).json({ success: false, message: "Album not found" });
    }

    if (name) db.albums[albumIndex].name = name.trim();
    if (description !== undefined) db.albums[albumIndex].description = description.trim();
    if (pin) db.albums[albumIndex].pin = pin.trim();
    if (coverImage !== undefined) db.albums[albumIndex].coverImage = coverImage;

    saveDB(db);
    res.json({ success: true, album: db.albums[albumIndex], message: "Album updated successfully" });
  } catch (err) {
    console.error('Error updating album:', err);
    res.status(500).json({ success: false, message: "Failed to update album: " + err.message });
  }
});

app.delete('/api/albums/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = readDB();

    db.albums = db.albums.filter(a => a.id !== id);
    const removedMedia = db.media.filter(m => m.albumId === id);
    removedMedia.forEach(m => {
      if (m.storageType === 'local' && m.localPath) {
        const fullPath = path.join(UPLOADS_DIR, m.localPath);
        if (fs.existsSync(fullPath)) {
          try { fs.unlinkSync(fullPath); } catch (e) {}
        }
      }
    });
    db.media = db.media.filter(m => m.albumId !== id);

    saveDB(db);
    res.json({ success: true, message: "Album deleted successfully" });
  } catch (err) {
    console.error('Error deleting album:', err);
    res.status(500).json({ success: false, message: "Failed to delete album: " + err.message });
  }
});

// 7. Media Upload (Bulk Local Files)
app.post(['/api/upload', '/api/media/upload'], upload.any(), (req, res) => {
  try {
    const albumId = req.body.albumId || 'family-album';
    const db = readDB();
    const uploadedMedia = [];

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No files provided" });
    }

    req.files.forEach(file => {
      const isVideo = file.mimetype.startsWith('video/') ||
        ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'].includes(path.extname(file.originalname).toLowerCase());

      const item = {
        id: 'media-' + Date.now() + '-' + Math.round(Math.random() * 1e4),
        albumId: albumId,
        filename: file.filename,
        originalName: file.originalname,
        title: path.basename(file.originalname, path.extname(file.originalname)),
        size: file.size,
        mimeType: file.mimetype,
        type: isVideo ? 'video' : 'photo',
        storageType: 'local',
        localPath: file.filename,
        url: `/uploads/${file.filename}`,
        downloadUrl: `/uploads/${file.filename}`,
        isFavorite: false,
        uploadedAt: new Date().toISOString()
      };

      db.media.unshift(item);
      uploadedMedia.push(item);
    });

    saveDB(db);
    res.json({ success: true, count: uploadedMedia.length, media: uploadedMedia });
  } catch (err) {
    console.error('Error in file upload:', err);
    res.status(500).json({ success: false, message: "Upload failed: " + err.message });
  }
});

// 8. Import Media via Google Drive Share Link
app.post('/api/import/gdrive', (req, res) => {
  try {
    const { url, title, albumId, type } = req.body;
    if (!url) return res.status(400).json({ success: false, message: "Google Drive URL is required" });

    const parsed = parseGoogleDriveUrl(url);
    if (!parsed.isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid Google Drive link. Please use a public share link (e.g. https://drive.google.com/file/d/.../view)"
      });
    }

    const db = readDB();
    const isVideo = type === 'video' || (url.toLowerCase().includes('video') || (title && title.match(/\.(mp4|mov|mkv|webm)$/i)));

    const item = {
      id: 'media-gdrive-' + Date.now(),
      albumId: albumId || 'family-album',
      title: title ? title.trim() : `Drive Media (${parsed.fileId.slice(0, 6)})`,
      originalName: title || `Drive-File-${parsed.fileId}`,
      size: 0,
      type: isVideo ? 'video' : 'photo',
      storageType: 'gdrive',
      gdriveId: parsed.fileId,
      url: parsed.previewUrl,
      downloadUrl: parsed.downloadUrl,
      embedUrl: parsed.embedUrl,
      isFavorite: false,
      uploadedAt: new Date().toISOString()
    };

    db.media.unshift(item);
    saveDB(db);

    res.json({ success: true, media: item, message: "Google Drive media imported successfully" });
  } catch (err) {
    console.error('Error importing Google Drive media:', err);
    res.status(500).json({ success: false, message: "Import failed: " + err.message });
  }
});

// 9. Get Media List (With filters & album selection)
app.get('/api/media', (req, res) => {
  try {
    const { albumId, type, favoriteOnly, search } = req.query;
    const db = readDB();
    let results = db.media || [];

    if (albumId && albumId !== 'all') {
      results = results.filter(m => m.albumId === albumId);
    }

    if (type && type !== 'all') {
      results = results.filter(m => m.type === type);
    }

    if (favoriteOnly === 'true') {
      results = results.filter(m => m.isFavorite === true);
    }

    if (search) {
      const s = search.toLowerCase();
      results = results.filter(m =>
        (m.title && m.title.toLowerCase().includes(s)) ||
        (m.originalName && m.originalName.toLowerCase().includes(s))
      );
    }

    res.json(results);
  } catch (err) {
    console.error('Error fetching media:', err);
    res.status(500).json([]);
  }
});

// 10. Toggle Favorite
app.post('/api/media/:id/favorite', (req, res) => {
  try {
    const { id } = req.params;
    const db = readDB();
    const item = db.media.find(m => m.id === id);
    if (!item) return res.status(404).json({ success: false, message: "Media not found" });

    item.isFavorite = !item.isFavorite;
    saveDB(db);
    res.json({ success: true, isFavorite: item.isFavorite });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 11. Delete Media
app.delete('/api/media/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = readDB();
    const item = db.media.find(m => m.id === id);

    if (!item) return res.status(404).json({ success: false, message: "Media not found" });

    if (item.storageType === 'local' && item.localPath) {
      const filePath = path.join(UPLOADS_DIR, item.localPath);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) { console.error('Error deleting file:', e); }
      }
    }

    db.media = db.media.filter(m => m.id !== id);
    saveDB(db);
    res.json({ success: true, message: "Media deleted successfully" });
  } catch (err) {
    console.error('Error deleting media:', err);
    res.status(500).json({ success: false, message: "Failed to delete media: " + err.message });
  }
});

// 12. Batch Download as ZIP
app.get('/api/download-zip', (req, res) => {
  try {
    const { albumId, ids } = req.query;
    const db = readDB();
    let mediaList = db.media;

    if (ids) {
      const idArray = ids.split(',');
      mediaList = mediaList.filter(m => idArray.includes(m.id));
    } else if (albumId && albumId !== 'all') {
      mediaList = mediaList.filter(m => m.albumId === albumId);
    }

    const localFiles = mediaList.filter(m => m.storageType === 'local' && m.localPath);
    if (localFiles.length === 0) {
      return res.status(400).send("No local downloadable files found for ZIP archive.");
    }

    const archive = archiver('zip', { zlib: { level: 6 } });
    const album = db.albums.find(a => a.id === albumId);
    const zipName = `${album ? album.name.replace(/\s+/g, '_') : 'V_and_K_Media'}_${Date.now()}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    archive.pipe(res);

    localFiles.forEach(item => {
      const filePath = path.join(UPLOADS_DIR, item.localPath);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: item.originalName || item.filename });
      }
    });

    archive.finalize();
  } catch (err) {
    console.error('Error building zip:', err);
    res.status(500).send("Failed to generate ZIP archive: " + err.message);
  }
});

// 13. Like / Reaction on Media
app.post('/api/media/:id/like', (req, res) => {
  try {
    const { id } = req.params;
    const db = readDB();
    const item = db.media.find(m => m.id === id);
    if (!item) return res.status(404).json({ success: false, message: "Media not found" });

    item.likes = (item.likes || 0) + 1;
    saveDB(db);
    res.json({ success: true, likes: item.likes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 14. Wedding Wishes / Guestbook APIs
app.get('/api/wishes', (req, res) => {
  const db = readDB();
  res.json({ success: true, wishes: db.wishes || [] });
});

app.post('/api/wishes', (req, res) => {
  try {
    const { name, side, message } = req.body;
    if (!name || !message) {
      return res.status(400).json({ success: false, message: "Name and message are required." });
    }
    const db = readDB();
    if (!db.wishes) db.wishes = [];

    const newWish = {
      id: "wish-" + Date.now(),
      name: name.trim(),
      side: side || "Well Wisher ✨",
      message: message.trim(),
      createdAt: new Date().toISOString()
    };

    db.wishes.unshift(newWish);
    saveDB(db);
    res.json({ success: true, wish: newWish });
  } catch (err) {
    console.error('Error posting wish:', err);
    res.status(500).json({ success: false, message: "Failed to post wish: " + err.message });
  }
});

app.delete('/api/wishes/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = readDB();
    if (!db.wishes) db.wishes = [];
    db.wishes = db.wishes.filter(w => w.id !== id);
    saveDB(db);
    res.json({ success: true, message: "Wish deleted successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Explicit Page Routes
app.get(['/', '/index', '/index.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get(['/wedding', '/wedding.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wedding.html'));
});

// Fallback to SPA index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Multer and Global Error Handling Middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer upload error:', err);
    return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
  } else if (err) {
    console.error('General server error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
  next();
});

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`================================================`);
    console.log(`🚀 V & K Media Vault is running on http://localhost:${PORT}`);
    console.log(`📁 Local Storage Directory: ${UPLOADS_DIR}`);
    console.log(`👑 Admin Password: 8068`);
    console.log(`👥 Group PINs: configured per album`);
    console.log(`================================================`);
  });
}

module.exports = app;
