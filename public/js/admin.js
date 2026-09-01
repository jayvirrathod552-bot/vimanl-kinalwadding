// ==========================================================================
// V & K MEDIA VAULT - ADMIN MANAGEMENT MODULE
// ==========================================================================

const Admin = {
  albumsList: [],
  selectedMediaIds: new Set(),

  init() {
    this.bindEvents();
  },

  bindEvents() {
    // Admin Tab Navigation
    const tabBtns = document.querySelectorAll('.admin-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const target = document.getElementById(btn.dataset.tab);
        if (target) target.classList.add('active');

        if (btn.dataset.tab === 'tab-manage-media') this.loadMediaTable();
        if (btn.dataset.tab === 'tab-albums') this.loadAlbumsManager();
      });
    });

    // Dropzone & File Input
    const dropzone = document.getElementById('file-dropzone');
    const fileInput = document.getElementById('file-input-bulk');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.handleFileUpload(e.dataTransfer.files);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target && e.target.files && e.target.files.length > 0) {
          this.handleFileUpload(e.target.files);
        }
      });
    }

    // Google Drive Link Importer Form
    const gdriveForm = document.getElementById('gdrive-import-form');
    if (gdriveForm) {
      gdriveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const urlEl = document.getElementById('gdrive-url-input');
        const titleEl = document.getElementById('gdrive-title-input');
        const albumSelect = document.getElementById('gdrive-album-select');
        const typeEl = document.querySelector('input[name="gdrive-type"]:checked');

        const url = urlEl ? urlEl.value.trim() : '';
        const title = titleEl ? titleEl.value.trim() : '';
        const albumId = albumSelect ? albumSelect.value : 'family-album';
        const type = typeEl ? typeEl.value : 'photo';

        if (!url) {
          App.showToast('Please enter a Google Drive link', 'error');
          return;
        }

        const btn = document.getElementById('gdrive-submit-btn');
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importing...';
        }

        try {
          const res = await API.importGDrive({ url, title, albumId, type });
          if (res && res.success) {
            App.showToast('Media imported successfully from Google Drive! ✨', 'success');
            gdriveForm.reset();
            await this.refreshStats();
          } else {
            App.showToast((res && res.message) ? res.message : 'Import failed. Ensure the link is public.', 'error');
          }
        } catch (err) {
          console.error('GDrive import error:', err);
          App.showToast('Error importing Google Drive media: ' + err.message, 'error');
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-plus"></i> <span>Import from Google Drive</span>';
          }
        }
      });
    }

    // Album Creation / Edit Modal
    const createAlbumBtn = document.getElementById('btn-create-album-modal');
    if (createAlbumBtn) createAlbumBtn.addEventListener('click', () => this.openAlbumModal());

    const createAlbumClose = document.getElementById('create-album-close');
    if (createAlbumClose) createAlbumClose.addEventListener('click', () => this.closeAlbumModal());

    const modalAlbumCancel = document.getElementById('modal-album-cancel');
    if (modalAlbumCancel) modalAlbumCancel.addEventListener('click', () => this.closeAlbumModal());

    const albumModal = document.getElementById('create-album-modal');
    if (albumModal) {
      albumModal.addEventListener('click', (e) => {
        if (e.target === albumModal || e.target.classList.contains('modal-backdrop')) {
          this.closeAlbumModal();
        }
      });
    }

    const albumForm = document.getElementById('create-album-form');
    if (albumForm) {
      albumForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-album-id').value;
        const name = document.getElementById('modal-album-name').value.trim();
        const description = document.getElementById('modal-album-desc').value.trim();
        const pin = document.getElementById('modal-album-pin').value.trim();
        const saveBtn = document.getElementById('modal-album-save-btn');

        if (!name) {
          App.showToast('Please enter an album name', 'error');
          return;
        }

        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        }

        try {
          if (id) {
            // Edit
            const res = await API.updateAlbum(id, { name, description, pin });
            if (res && res.success) {
              App.showToast('Album updated successfully! ✅', 'success');
              this.closeAlbumModal();
              await this.loadAlbumsManager();
              await this.populateAlbumSelects();
            } else {
              App.showToast((res && res.message) ? res.message : 'Failed to update album', 'error');
            }
          } else {
            // Create
            const res = await API.createAlbum({ name, description, pin });
            if (res && res.success) {
              const albumPin = (res.album && res.album.pin) ? res.album.pin : pin;
              App.showToast(`New album "${name}" created with PIN: ${albumPin} 🎉`, 'success');
              this.closeAlbumModal();
              await this.loadAlbumsManager();
              await this.populateAlbumSelects();
              await this.refreshStats();
            } else {
              App.showToast((res && res.message) ? res.message : 'Failed to create album', 'error');
            }
          }
        } catch (err) {
          console.error('Error creating/updating album:', err);
          App.showToast('Error saving album: ' + err.message, 'error');
        } finally {
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Save Album';
          }
        }
      });
    }

    // Master Password Update Form
    const passForm = document.getElementById('settings-password-form');
    if (passForm) {
      passForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const p1 = document.getElementById('setting-new-pass').value;
        const p2 = document.getElementById('setting-confirm-pass').value;
        if (p1 !== p2) {
          App.showToast('Passwords do not match', 'error');
          return;
        }
        try {
          const res = await API.updateSettings({ adminPassword: p1 });
          if (res && res.success) {
            App.showToast('Master Admin password changed successfully! 🔐', 'success');
            passForm.reset();
          } else {
            App.showToast('Failed to update password', 'error');
          }
        } catch (err) {
          App.showToast('Error updating password: ' + err.message, 'error');
        }
      });
    }

    // Media Manager Filters & Select All
    const albumFilter = document.getElementById('admin-media-album-filter');
    const typeFilter = document.getElementById('admin-media-type-filter');
    if (albumFilter) albumFilter.addEventListener('change', () => this.loadMediaTable());
    if (typeFilter) typeFilter.addEventListener('change', () => this.loadMediaTable());

    const selectAll = document.getElementById('select-all-media');
    if (selectAll) {
      selectAll.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.media-select-chk');
        checkboxes.forEach(cb => {
          cb.checked = e.target.checked;
          if (e.target.checked) this.selectedMediaIds.add(cb.value);
          else this.selectedMediaIds.delete(cb.value);
        });
        this.updateBatchDeleteBtn();
      });
    }

    const batchDeleteBtn = document.getElementById('btn-batch-delete');
    if (batchDeleteBtn) {
      batchDeleteBtn.addEventListener('click', () => {
        const count = this.selectedMediaIds.size;
        if (count === 0) return;
        App.confirmDialog({
          title: `Delete ${count} Selected Items?`,
          desc: `Are you sure you want to permanently delete these ${count} selected media files?`,
          confirmText: `Delete ${count} Items`,
          onConfirm: async () => {
            for (let id of this.selectedMediaIds) {
              await API.deleteMedia(id);
            }
            App.showToast(`${count} items deleted successfully`, 'success');
            this.selectedMediaIds.clear();
            await this.loadMediaTable();
            await this.refreshStats();
            if (App.currentAlbum) Gallery.loadAlbumMedia(App.currentAlbum);
          }
        });
      });
    }
  },

  formatMB(mb) {
    const num = parseFloat(mb) || 0;
    if (num >= 1000) {
      const gb = num / 1024;
      return `${gb.toFixed(2)} GB`;
    }
    return `${num.toFixed(1)} MB`;
  },

  formatSize(bytes) {
    if (!bytes || bytes <= 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1000) {
      const gb = mb / 1024;
      return `${gb.toFixed(2)} GB`;
    }
    if (mb >= 1) {
      return `${mb.toFixed(2)} MB`;
    }
    const kb = bytes / 1024;
    return `${kb.toFixed(1)} KB`;
  },

  async refreshStats() {
    try {
      const stats = await API.getStats();
      if (!stats) return;
      const totalFilesEl = document.getElementById('stat-total-media');
      const totalAlbumsEl = document.getElementById('stat-total-albums');
      const storageUsedEl = document.getElementById('stat-storage-used');
      const storageLimitEl = document.getElementById('stat-storage-limit');
      const storagePercentEl = document.getElementById('stat-storage-percent');
      const storageProgressEl = document.getElementById('stat-storage-progress');

      if (totalFilesEl) totalFilesEl.textContent = stats.totalFiles;
      if (totalAlbumsEl) totalAlbumsEl.textContent = stats.totalAlbums;

      const usedFormatted = stats.usedFormatted || this.formatMB(stats.usedMB);
      const limitFormatted = stats.limitFormatted || (stats.limitMB >= 1000 ? `${(stats.limitMB / 1024).toFixed(0)} GB` : `${stats.limitMB} MB`);

      if (storageUsedEl) storageUsedEl.textContent = usedFormatted;
      if (storageLimitEl) storageLimitEl.textContent = `/ ${limitFormatted}`;
      if (storagePercentEl) storagePercentEl.textContent = `${stats.percentUsed}% Local Disk Used (${usedFormatted} of ${limitFormatted})`;
      if (storageProgressEl) storageProgressEl.style.width = `${Math.max(2, stats.percentUsed)}%`;
    } catch (err) {
      console.error('Error refreshing stats:', err);
    }
  },

  async populateAlbumSelects() {
    try {
      this.albumsList = await API.getAlbums();
      const uploadSelect = document.getElementById('upload-target-album');
      const gdriveSelect = document.getElementById('gdrive-album-select');
      const filterSelect = document.getElementById('admin-media-album-filter');

      if (!this.albumsList || this.albumsList.length === 0) {
        this.albumsList = [
          { id: 'family-album', name: 'Family & Special Moments', pin: '1511' }
        ];
      }

      if (uploadSelect) {
        uploadSelect.innerHTML = this.albumsList.map(a => `<option value="${a.id}">${a.name} (PIN: ${a.pin})</option>`).join('');
      }
      if (gdriveSelect) {
        gdriveSelect.innerHTML = this.albumsList.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
      }
      if (filterSelect) {
        filterSelect.innerHTML = '<option value="all">All Albums</option>' +
          this.albumsList.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
      }
    } catch (err) {
      console.error('Error populating album selects:', err);
    }
  },

  async handleFileUpload(files) {
    if (!files || files.length === 0) return;

    const albumSelect = document.getElementById('upload-target-album');
    const albumId = (albumSelect && albumSelect.value) ? albumSelect.value : 'family-album';
    const progressContainer = document.getElementById('upload-progress-container');
    const progressFill = document.getElementById('upload-progress-fill');
    const percentText = document.getElementById('upload-percent-text');
    const statusText = document.getElementById('upload-status-text');
    const queueList = document.getElementById('upload-queue-list');

    if (progressContainer) progressContainer.style.display = 'block';
    if (statusText) statusText.textContent = `Uploading ${files.length} file(s)...`;
    if (progressFill) progressFill.style.width = '0%';
    if (percentText) percentText.textContent = '0%';

    try {
      const res = await API.uploadFiles(albumId, files, (percent) => {
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (percentText) percentText.textContent = `${percent}%`;
      });

      if (res && res.success !== false) {
        App.showToast(`Successfully uploaded ${res.count || files.length} items! 🚀`, 'success');
        await this.refreshStats();
        
        if (res.media && res.media.length > 0 && queueList) {
          queueList.innerHTML = `
            <div style="margin-top: 16px; padding: 14px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <strong style="color:#10b981;"><i class="fa-solid fa-circle-check"></i> Uploaded Successfully (${res.media.length} items)</strong>
                <button class="btn btn-sm btn-gold" onclick="document.querySelector('[data-tab=\\'tab-manage-media\\']').click()">
                  Manage Media &rarr;
                </button>
              </div>
              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                ${res.media.map(m => `
                  <div style="display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.4); padding:6px 12px; border-radius:8px; font-size:0.82rem;">
                    <i class="fa-${m.type === 'video' ? 'solid fa-video' : 'regular fa-image'}" style="color:var(--gold-primary);"></i>
                    <span style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${m.title || m.originalName}</span>
                    <span class="badge ${m.type === 'video' ? 'badge-gold' : 'badge-success'}" style="font-size:0.7rem;">${m.type}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }

        setTimeout(() => {
          if (progressContainer) progressContainer.style.display = 'none';
        }, 1500);
      }
    } catch (err) {
      console.error('File upload error:', err);
      App.showToast('Upload failed: ' + err.message, 'error');
      if (progressContainer) progressContainer.style.display = 'none';
    }
  },

  async loadMediaTable() {
    try {
      const albumFilter = document.getElementById('admin-media-album-filter');
      const typeFilter = document.getElementById('admin-media-type-filter');
      const albumId = albumFilter ? albumFilter.value : 'all';
      const type = typeFilter ? typeFilter.value : 'all';

      const media = await API.getMedia({ albumId, type });
      const tbody = document.getElementById('admin-media-tbody');
      if (!tbody) return;

      tbody.innerHTML = '';
      this.selectedMediaIds.clear();
      this.updateBatchDeleteBtn();

      if (!media || media.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 30px; color: var(--text-muted);">No media items found.</td></tr>`;
        return;
      }

      media.forEach(item => {
        const tr = document.createElement('tr');
        const isVideo = item.type === 'video';
        const albumObj = this.albumsList.find(a => a.id === item.albumId);

        // Checkbox cell
        const chkTd = document.createElement('td');
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'media-select-chk';
        chk.value = item.id;
        chk.addEventListener('change', (e) => {
          if (e.target.checked) this.selectedMediaIds.add(item.id);
          else this.selectedMediaIds.delete(item.id);
          this.updateBatchDeleteBtn();
        });
        chkTd.appendChild(chk);
        tr.appendChild(chkTd);

        // Preview cell
        const previewTd = document.createElement('td');
        if (isVideo) {
          const vidWrapper = document.createElement('div');
          vidWrapper.style.cssText = "position:relative; width:52px; height:52px; border-radius:8px; overflow:hidden; background:#000; display:flex; align-items:center; justify-content:center; cursor:pointer;";
          vidWrapper.title = "Click to play video";
          vidWrapper.innerHTML = `
            <video src="${item.url}#t=0.1" style="width:100%; height:100%; object-fit:cover;" muted preload="metadata"></video>
            <div style="position:absolute; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; color:#d4af37;">
              <i class="fa-solid fa-play" style="font-size:0.75rem;"></i>
            </div>
          `;
          vidWrapper.addEventListener('click', () => Gallery.openVideoModal(item));
          previewTd.appendChild(vidWrapper);
        } else {
          const img = document.createElement('img');
          img.src = item.url;
          img.className = 'table-img-preview';
          img.alt = 'Preview';
          img.style.cursor = 'pointer';
          img.onerror = () => { img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52"><rect fill="%231a1a2e" width="52" height="52"/><text fill="%23d4af37" font-size="10" x="50%" y="50%" text-anchor="middle">Photo</text></svg>'; };
          img.addEventListener('click', () => Gallery.openLightbox(item, [item]));
          previewTd.appendChild(img);
        }
        tr.appendChild(previewTd);

        // Title & Size cell
        const infoTd = document.createElement('td');
        const titleStrong = document.createElement('strong');
        titleStrong.textContent = item.title || item.originalName;
        const sizeSmall = document.createElement('small');
        sizeSmall.style.color = 'var(--text-muted)';
        sizeSmall.style.display = 'block';
        sizeSmall.textContent = item.size ? this.formatSize(item.size) : 'Cloud/Drive';
        infoTd.appendChild(titleStrong);
        infoTd.appendChild(sizeSmall);
        tr.appendChild(infoTd);

        // Album cell
        const albumTd = document.createElement('td');
        albumTd.innerHTML = `<span class="badge badge-gold">${albumObj ? albumObj.name : (item.albumId || 'General')}</span>`;
        tr.appendChild(albumTd);

        // Type cell
        const typeTd = document.createElement('td');
        typeTd.innerHTML = `<span class="badge ${isVideo ? 'badge-gold' : 'badge-success'}">${(item.type || 'PHOTO').toUpperCase()}</span>`;
        tr.appendChild(typeTd);

        // Storage cell
        const storageTd = document.createElement('td');
        storageTd.innerHTML = `<small style="color:var(--text-muted);">${(item.storageType || 'local').toUpperCase()}</small>`;
        tr.appendChild(storageTd);

        // Actions cell
        const actionsTd = document.createElement('td');
        const actionsDiv = document.createElement('div');
        actionsDiv.style.display = 'flex';
        actionsDiv.style.gap = '6px';

        if (isVideo) {
          const playBtn = document.createElement('button');
          playBtn.className = 'btn btn-sm btn-secondary';
          playBtn.title = 'Play Video';
          playBtn.innerHTML = '<i class="fa-solid fa-play" style="color:var(--gold-primary);"></i>';
          playBtn.addEventListener('click', () => Gallery.openVideoModal(item));
          actionsDiv.appendChild(playBtn);
        } else {
          const viewBtn = document.createElement('button');
          viewBtn.className = 'btn btn-sm btn-secondary';
          viewBtn.title = 'View Photo';
          viewBtn.innerHTML = '<i class="fa-regular fa-eye"></i>';
          viewBtn.addEventListener('click', () => Gallery.openLightbox(item, [item]));
          actionsDiv.appendChild(viewBtn);
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-danger-outline';
        deleteBtn.title = 'Delete Media';
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          Admin.deleteSingleMedia(item.id);
        });
        actionsDiv.appendChild(deleteBtn);

        actionsTd.appendChild(actionsDiv);
        tr.appendChild(actionsTd);

        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error('Error loading media table:', err);
    }
  },

  updateBatchDeleteBtn() {
    const btn = document.getElementById('btn-batch-delete');
    if (!btn) return;
    if (this.selectedMediaIds.size > 0) {
      btn.style.display = 'inline-flex';
      btn.innerHTML = `<i class="fa-solid fa-trash"></i> Delete Selected (${this.selectedMediaIds.size})`;
    } else {
      btn.style.display = 'none';
    }
  },

  async deleteSingleMedia(id) {
    App.confirmDialog({
      title: 'Delete Media File?',
      desc: 'Are you sure you want to permanently delete this media file? This cannot be undone.',
      confirmText: 'Delete Permanently',
      onConfirm: async () => {
        const res = await API.deleteMedia(id);
        if (res && res.success !== false) {
          App.showToast('Item deleted successfully', 'success');
          await Admin.loadMediaTable();
          await Admin.refreshStats();
          if (App.currentAlbum) {
            Gallery.loadAlbumMedia(App.currentAlbum);
          }
        } else {
          App.showToast((res && res.message) ? res.message : 'Failed to delete item', 'error');
        }
      }
    });
  },

  // Albums Manager Cards
  async loadAlbumsManager() {
    try {
      this.albumsList = await API.getAlbums();
      const grid = document.getElementById('admin-albums-grid');
      if (!grid) return;
      grid.innerHTML = '';

      if (!this.albumsList || this.albumsList.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted);">No albums created yet. Click "Create New Album" above!</div>`;
        return;
      }

      this.albumsList.forEach(album => {
        const card = document.createElement('div');
        card.className = 'album-admin-card glass-panel';
        card.innerHTML = `
          <div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
              <h4 style="font-size:1.15rem; color:#fff;">${album.name}</h4>
              <span class="badge badge-success">${album.mediaCount || 0} Files</span>
            </div>
            <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:14px;">${album.description || 'Private folder for family members'}</p>
            
            <div class="album-pin-display" style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:rgba(0,0,0,0.35); border-radius:10px; border:1px dashed var(--gold-primary); margin-bottom:14px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-key" style="color:var(--gold-primary); font-size:0.9rem;"></i>
                <span style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Folder PIN:</span>
                <span class="album-pin-value" id="pin-val-${album.id}" style="font-family:monospace; font-weight:700; font-size:1.15rem; letter-spacing:2px; color:#fef08a;">${album.pin || 'None'}</span>
              </div>
              <div style="display:flex; gap:6px;">
                <button type="button" class="btn btn-sm btn-icon" id="toggle-pin-${album.id}" title="Toggle PIN Visibility" style="padding:4px 8px; font-size:0.8rem; background:rgba(255,255,255,0.06); border:1px solid var(--border-subtle); border-radius:6px; color:var(--text-muted); cursor:pointer;">
                  <i class="fa-regular fa-eye-slash"></i>
                </button>
                <button type="button" class="btn btn-sm btn-icon" id="copy-pin-${album.id}" title="Copy PIN to share with family" style="padding:4px 8px; font-size:0.8rem; background:rgba(255,255,255,0.06); border:1px solid var(--border-subtle); border-radius:6px; color:var(--gold-primary); cursor:pointer;">
                  <i class="fa-regular fa-copy"></i>
                </button>
              </div>
            </div>
          </div>

          <div class="album-card-actions" style="display:flex; gap:8px; justify-content:flex-end; border-top:1px solid var(--border-subtle); padding-top:12px;">
          </div>
        `;

        // Wire Copy PIN button
        const copyBtn = card.querySelector(`#copy-pin-${album.id}`);
        if (copyBtn) {
          copyBtn.addEventListener('click', () => {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(album.pin).then(() => {
                App.showToast(`PIN for "${album.name}" copied: ${album.pin} 📋`, 'success');
              }).catch(() => {
                App.showToast(`PIN: ${album.pin}`);
              });
            } else {
              App.showToast(`PIN: ${album.pin}`);
            }
          });
        }

        // Wire Toggle Visibility button
        const toggleBtn = card.querySelector(`#toggle-pin-${album.id}`);
        const pinValSpan = card.querySelector(`#pin-val-${album.id}`);
        let isVisible = true;
        if (toggleBtn && pinValSpan) {
          toggleBtn.addEventListener('click', () => {
            isVisible = !isVisible;
            if (isVisible) {
              pinValSpan.textContent = album.pin || 'None';
              toggleBtn.innerHTML = '<i class="fa-regular fa-eye-slash"></i>';
              toggleBtn.title = 'Hide PIN';
            } else {
              pinValSpan.textContent = '••••••';
              toggleBtn.innerHTML = '<i class="fa-regular fa-eye"></i>';
              toggleBtn.title = 'Show PIN';
            }
          });
        }

        const actionsDiv = card.querySelector('.album-card-actions');
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-sm btn-secondary';
        editBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Edit';
        editBtn.addEventListener('click', () => Admin.editAlbum(album.id));
        actionsDiv.appendChild(editBtn);

        const delAlbumBtn = document.createElement('button');
        delAlbumBtn.className = 'btn btn-sm btn-danger-outline';
        delAlbumBtn.title = 'Delete Album';
        delAlbumBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        delAlbumBtn.addEventListener('click', () => Admin.deleteAlbum(album.id));
        actionsDiv.appendChild(delAlbumBtn);

        grid.appendChild(card);
      });
    } catch (err) {
      console.error('Error loading albums manager:', err);
    }
  },

  openAlbumModal(album = null) {
    const modal = document.getElementById('create-album-modal');
    const title = document.getElementById('album-modal-title');
    const idInput = document.getElementById('edit-album-id');
    const nameInput = document.getElementById('modal-album-name');
    const descInput = document.getElementById('modal-album-desc');
    const pinInput = document.getElementById('modal-album-pin');

    if (!modal) return;

    if (album) {
      if (title) title.innerHTML = '<i class="fa-solid fa-pen"></i> Edit Album &amp; PIN';
      if (idInput) idInput.value = album.id;
      if (nameInput) nameInput.value = album.name;
      if (descInput) descInput.value = album.description || '';
      if (pinInput) pinInput.value = album.pin || '';
    } else {
      if (title) title.innerHTML = '<i class="fa-solid fa-folder-plus"></i> Create New Album';
      if (idInput) idInput.value = '';
      if (nameInput) nameInput.value = '';
      if (descInput) descInput.value = '';
      if (pinInput) pinInput.value = Math.floor(1000 + Math.random() * 9000).toString();
    }

    modal.classList.add('active');
    setTimeout(() => {
      if (nameInput) nameInput.focus();
    }, 120);
  },

  closeAlbumModal() {
    const modal = document.getElementById('create-album-modal');
    if (modal) modal.classList.remove('active');
  },

  editAlbum(id) {
    const album = this.albumsList.find(a => a.id === id);
    if (album) this.openAlbumModal(album);
  },

  async deleteAlbum(id) {
    const album = this.albumsList.find(a => a.id === id);
    const albumName = album ? album.name : 'this album';

    App.confirmDialog({
      title: `Delete Album "${albumName}"?`,
      desc: 'Deleting this album will permanently remove all its media files. Are you sure?',
      confirmText: 'Delete Album',
      onConfirm: async () => {
        const res = await API.deleteAlbum(id);
        if (res && res.success !== false) {
          App.showToast('Album deleted successfully', 'success');
          await Admin.loadAlbumsManager();
          await Admin.populateAlbumSelects();
          await Admin.refreshStats();
        } else {
          App.showToast((res && res.message) ? res.message : 'Failed to delete album', 'error');
        }
      }
    });
  }
};

window.Admin = Admin;
