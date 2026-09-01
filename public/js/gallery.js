// ==========================================================================
// V & K MEDIA VAULT - GALLERY & LIGHTBOX MODULE
// ==========================================================================

const Gallery = {
  currentMediaList: [],
  currentLightboxIndex: 0,
  activeFilter: 'all',
  searchQuery: '',

  init() {
    this.bindEvents();
  },

  bindEvents() {
    // Toolbar Filters
    const tabBtns = document.querySelectorAll('#gallery-type-tabs .tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.dataset.type;
        this.render();
      });
    });

    // Search Input
    const searchInput = document.getElementById('gallery-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.render();
      });
    }

    // ZIP Download Button
    const zipBtn = document.getElementById('gallery-download-zip-btn');
    if (zipBtn) {
      zipBtn.addEventListener('click', () => {
        if (!App.currentAlbum) {
          App.showToast('Please select an album first', 'error');
          return;
        }
        App.showToast('Preparing ZIP download...', 'success');
        window.location.href = API.getZipDownloadUrl(App.currentAlbum.id);
      });
    }

    // Lightbox Controls
    document.getElementById('lightbox-close-btn').addEventListener('click', () => this.closeLightbox());
    document.getElementById('lightbox-prev-btn').addEventListener('click', () => this.prevLightbox());
    document.getElementById('lightbox-next-btn').addEventListener('click', () => this.nextLightbox());
    document.querySelector('.lightbox-backdrop').addEventListener('click', () => this.closeLightbox());

    // Lightbox Favorite Toggle
    document.getElementById('lightbox-fav-btn').addEventListener('click', async () => {
      const currentItem = this.currentMediaList[this.currentLightboxIndex];
      if (currentItem) {
        const res = await API.toggleFavorite(currentItem.id);
        if (res.success) {
          currentItem.isFavorite = res.isFavorite;
          this.updateLightboxFavIcon(res.isFavorite);
          this.render();
        }
      }
    });

    // Keyboard Navigation for Lightbox
    window.addEventListener('keydown', (e) => {
      const modal = document.getElementById('lightbox-modal');
      if (modal.classList.contains('active')) {
        if (e.key === 'Escape') this.closeLightbox();
        if (e.key === 'ArrowLeft') this.prevLightbox();
        if (e.key === 'ArrowRight') this.nextLightbox();
      }
    });

    // Touch Swipe for Mobile Lightbox
    let touchStartX = 0;
    let touchEndX = 0;
    const lightboxBody = document.querySelector('.lightbox-body');
    lightboxBody.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lightboxBody.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      if (touchStartX - touchEndX > 50) {
        this.nextLightbox(); // Swipe Left -> Next
      }
      if (touchEndX - touchStartX > 50) {
        this.prevLightbox(); // Swipe Right -> Prev
      }
    }, { passive: true });

    // Video Modal Close
    document.getElementById('video-modal-close').addEventListener('click', () => this.closeVideoModal());
    document.querySelector('.video-backdrop').addEventListener('click', () => this.closeVideoModal());
  },

  async loadAlbumMedia(album) {
    if (!album) return;
    
    // Update Header Text
    document.getElementById('gallery-album-title').textContent = album.name;
    document.getElementById('gallery-album-desc').textContent = album.description || 'Private Gallery';
    
    const media = await API.getMedia({ albumId: album.id });
    this.currentMediaList = media;
    
    // Update Counts
    const photoCount = media.filter(m => m.type === 'photo').length;
    const videoCount = media.filter(m => m.type === 'video').length;
    document.getElementById('gallery-count-photos').innerHTML = `<i class="fa-regular fa-image"></i> ${photoCount} Photos`;
    document.getElementById('gallery-count-videos').innerHTML = `<i class="fa-solid fa-video"></i> ${videoCount} Videos`;

    this.render();
  },

  render() {
    const grid = document.getElementById('media-grid');
    const emptyState = document.getElementById('gallery-empty-state');
    grid.innerHTML = '';

    let filtered = this.currentMediaList;

    // Filter by type
    if (this.activeFilter === 'photo') filtered = filtered.filter(m => m.type === 'photo');
    if (this.activeFilter === 'video') filtered = filtered.filter(m => m.type === 'video');
    if (this.activeFilter === 'favorite') filtered = filtered.filter(m => m.isFavorite);

    // Search filter
    if (this.searchQuery) {
      filtered = filtered.filter(m => (m.title && m.title.toLowerCase().includes(this.searchQuery)) ||
        (m.originalName && m.originalName.toLowerCase().includes(this.searchQuery)));
    }

    if (filtered.length === 0) {
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    filtered.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'media-card glass-panel';
      
      const isVideo = item.type === 'video';
      const previewSrc = item.url;

      card.innerHTML = `
        <div class="media-badge-type ${isVideo ? 'video' : ''}">
          <i class="fa-${isVideo ? 'solid fa-video' : 'regular fa-image'}"></i>
          <span>${isVideo ? 'Video' : 'Photo'}</span>
        </div>

        ${isVideo ? `
          <div class="video-play-indicator">
            <i class="fa-solid fa-play"></i>
          </div>
          <video class="media-thumbnail video-thumb" preload="none" muted playsinline loop src="${previewSrc}#t=0.1">
          </video>
        ` : `
          <img src="${previewSrc}" alt="Photo" class="media-thumbnail" loading="lazy" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\\'300\\' viewBox=\\'0 0 400 300\\'><rect fill=\\'%2311141e\\' width=\\'400\\' height=\\'300\\'/><text fill=\\'%23d4af37\\' font-size=\\'18\\' font-family=\\'sans-serif\\' x=\\'50%\\' y=\\'50%\\' text-anchor=\\'middle\\'>Photo</text></svg>';">
        `}

        <div class="media-overlay">
          <div class="overlay-top-actions">
          </div>
          <div class="overlay-bottom-info">
            <span class="overlay-title"></span>
          </div>
        </div>
      `;

      // Set Title safely
      const titleSpan = card.querySelector('.overlay-title');
      if (titleSpan) {
        titleSpan.textContent = item.title || item.originalName;
        titleSpan.title = item.title || item.originalName;
      }

      // Actions
      const topActions = card.querySelector('.overlay-top-actions');

      // Fav btn
      const favBtn = document.createElement('button');
      favBtn.className = `overlay-btn ${item.isFavorite ? 'active-fav' : ''}`;
      favBtn.title = 'Favorite';
      favBtn.innerHTML = `<i class="fa-${item.isFavorite ? 'solid' : 'regular'} fa-heart"></i>`;
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        Gallery.toggleCardFav(e, item.id);
      });
      topActions.appendChild(favBtn);

      // Download btn
      const dlBtn = document.createElement('a');
      dlBtn.className = 'overlay-btn';
      dlBtn.title = 'Download';
      dlBtn.href = item.downloadUrl || item.url;
      dlBtn.download = item.originalName || 'media';
      dlBtn.innerHTML = '<i class="fa-solid fa-download"></i>';
      dlBtn.addEventListener('click', (e) => e.stopPropagation());
      topActions.appendChild(dlBtn);

      // If Admin, show direct Delete btn
      if (typeof App !== 'undefined' && App.currentRole === 'admin') {
        const delBtn = document.createElement('button');
        delBtn.className = 'overlay-btn';
        delBtn.title = 'Delete Media';
        delBtn.style.color = '#ef4444';
        delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          App.confirmDialog({
            title: 'Delete Media File?',
            desc: `Are you sure you want to delete "${item.title || item.originalName}"?`,
            confirmText: 'Delete',
            onConfirm: async () => {
              const res = await API.deleteMedia(item.id);
              if (res && res.success !== false) {
                App.showToast('Item deleted successfully', 'success');
                if (App.currentAlbum) Gallery.loadAlbumMedia(App.currentAlbum);
                if (typeof Admin !== 'undefined') {
                  Admin.loadMediaTable();
                  Admin.refreshStats();
                }
              } else {
                App.showToast('Failed to delete item', 'error');
              }
            }
          });
        });
        topActions.appendChild(delBtn);
      }

      // Hover preview for videos
      if (isVideo) {
        const vidEl = card.querySelector('video');
        if (vidEl) {
          card.addEventListener('mouseenter', () => {
            vidEl.play().catch(() => {});
          });
          card.addEventListener('mouseleave', () => {
            vidEl.pause();
            vidEl.currentTime = 0.1;
          });
        }
      }

      card.addEventListener('click', () => {
        if (isVideo) {
          this.openVideoModal(item);
        } else {
          this.openLightbox(item, filtered);
        }
      });

      grid.appendChild(card);
    });
  },

  async toggleCardFav(event, id) {
    if (event) event.stopPropagation();
    const res = await API.toggleFavorite(id);
    if (res.success) {
      const item = this.currentMediaList.find(m => m.id === id);
      if (item) item.isFavorite = res.isFavorite;
      this.render();
    }
  },

  // Lightbox View
  openLightbox(item, list) {
    this.currentMediaList = list;
    this.currentLightboxIndex = list.findIndex(m => m.id === item.id);
    if (this.currentLightboxIndex === -1) this.currentLightboxIndex = 0;

    const modal = document.getElementById('lightbox-modal');
    modal.classList.add('active');
    this.updateLightboxContent();
  },

  updateLightboxContent() {
    const item = this.currentMediaList[this.currentLightboxIndex];
    if (!item) return;

    document.getElementById('lightbox-title').textContent = item.title || item.originalName;
    document.getElementById('lightbox-counter').textContent = `${this.currentLightboxIndex + 1} of ${this.currentMediaList.length}`;
    document.getElementById('lightbox-img').src = item.url;
    
    const dlBtn = document.getElementById('lightbox-download-btn');
    dlBtn.href = item.downloadUrl || item.url;
    dlBtn.setAttribute('download', item.originalName || 'photo.jpg');

    this.updateLightboxFavIcon(item.isFavorite);
  },

  updateLightboxFavIcon(isFav) {
    const favBtn = document.getElementById('lightbox-fav-btn');
    favBtn.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-heart" style="${isFav ? 'color:#ef4444' : ''}"></i>`;
  },

  prevLightbox() {
    if (this.currentLightboxIndex > 0) {
      this.currentLightboxIndex--;
      this.updateLightboxContent();
    } else {
      this.currentLightboxIndex = this.currentMediaList.length - 1;
      this.updateLightboxContent();
    }
  },

  nextLightbox() {
    if (this.currentLightboxIndex < this.currentMediaList.length - 1) {
      this.currentLightboxIndex++;
      this.updateLightboxContent();
    } else {
      this.currentLightboxIndex = 0;
      this.updateLightboxContent();
    }
  },

  closeLightbox() {
    document.getElementById('lightbox-modal').classList.remove('active');
  },

  // Video Modal
  openVideoModal(item) {
    const modal = document.getElementById('video-modal');
    const container = document.getElementById('video-player-container');
    const dlBtn = document.getElementById('video-download-btn');
    
    document.getElementById('video-modal-title').textContent = item.title || 'Video Player';
    dlBtn.href = item.downloadUrl || item.url;
    dlBtn.setAttribute('download', item.originalName || 'video.mp4');

    if (item.storageType === 'gdrive' && item.embedUrl) {
      container.innerHTML = `<iframe src="${item.embedUrl}" allow="autoplay" allowfullscreen style="width:100%; height:450px; border:none; border-radius:12px;"></iframe>`;
    } else {
      container.innerHTML = `
        <video id="active-video-element" controls autoplay playsinline controlsList="nodownload" style="width:100%; max-height:75vh; border-radius:12px; background:#000;">
          <source src="${item.url}" type="${item.mimeType || 'video/mp4'}">
          <source src="${item.url}">
          Your browser does not support playing this video file directly.
        </video>
        <div id="video-fallback-msg" style="display:none; text-align:center; padding:20px; color:var(--text-muted);">
          <p style="margin-bottom:10px;"><i class="fa-solid fa-circle-exclamation" style="color:var(--gold-primary); font-size:1.5rem;"></i></p>
          <p>Browser cannot decode this video container directly.</p>
          <a href="${item.url}" download="${item.originalName || 'video'}" class="btn btn-gold btn-sm" style="margin-top:10px;">
            <i class="fa-solid fa-download"></i> Download to Play Locally
          </a>
        </div>
      `;

      const videoEl = container.querySelector('video');
      if (videoEl) {
        videoEl.onerror = () => {
          const fallback = document.getElementById('video-fallback-msg');
          if (fallback) fallback.style.display = 'block';
        };
      }
    }

    modal.classList.add('active');
  },

  closeVideoModal() {
    const modal = document.getElementById('video-modal');
    const container = document.getElementById('video-player-container');
    const videoEl = container.querySelector('video');
    if (videoEl) {
      videoEl.pause();
      videoEl.src = '';
    }
    container.innerHTML = '';
    modal.classList.remove('active');
  }
};

window.Gallery = Gallery;

