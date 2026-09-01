// ==========================================================================
// V & K MEDIA VAULT - MAIN APP CONTROLLER & ROUTER
// ==========================================================================

const App = {
  currentRole: null, // 'admin' | 'guest' | null
  currentAlbum: null,
  albums: [],

  init() {
    this.bindEvents();
    if (typeof Gallery !== 'undefined' && Gallery.init) Gallery.init();
    if (typeof Admin !== 'undefined' && Admin.init) Admin.init();

    // Check URL Query Parameters for Auto-Login from QR Code Passkey Scan
    const urlParams = new URLSearchParams(window.location.search);
    const pinParam = urlParams.get('pin') || urlParams.get('passkey');
    if (pinParam) {
      this.handleAutoLogin(pinParam.trim());
      return;
    }

    // Check Session
    const savedRole = sessionStorage.getItem('vk_role') || localStorage.getItem('vk_role');
    const savedAlbum = sessionStorage.getItem('vk_album') || localStorage.getItem('vk_album');

    if (savedRole === 'admin') {
      this.setAdminSession();
    } else if (savedRole === 'guest' && savedAlbum) {
      try {
        this.setGuestSession(JSON.parse(savedAlbum));
      } catch (e) {
        this.switchView('auth');
      }
    } else {
      this.switchView('auth');
      if (window.location.hash === '#admin') {
        setTimeout(() => this.promptAdminPassword(), 200);
      }
    }
  },

  async handleAutoLogin(pin) {
    this.showToast('Unlocking with scanned passkey...', 'success');
    try {
      const res = await API.loginGroup(pin);
      if (res && res.success) {
        if (res.role === 'admin') {
          await this.setAdminSession();
          this.showToast('Logged in as Master Admin!', 'success');
        } else {
          this.setGuestSession(res.album);
          this.showToast(`✨ Unlocked: ${res.album.name}`, 'success');
        }
        try {
          const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
          window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
        } catch (e) {}
      } else {
        this.showToast((res && res.message) ? res.message : 'Passkey invalid. Please enter PIN.', 'error');
        this.switchView('auth');
        const pinInput = document.getElementById('group-pin-input');
        if (pinInput) pinInput.value = pin;
      }
    } catch (err) {
      this.showToast('Login failed. Please enter PIN.', 'error');
      this.switchView('auth');
    }
  },

  bindEvents() {
    // Brand Logo Click
    const brandBtn = document.getElementById('brand-home-btn');
    if (brandBtn) {
      brandBtn.addEventListener('click', () => {
        if (this.currentRole === 'admin') this.switchView('admin');
        else if (this.currentRole === 'guest') this.switchView('gallery');
        else this.switchView('auth');
      });
    }

    // Group Login Form
    const groupForm = document.getElementById('group-login-form');
    if (groupForm) {
      groupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pinInput = document.getElementById('group-pin-input');
        const pin = pinInput ? pinInput.value.trim() : '';
        const btn = document.getElementById('group-login-btn');
        if (btn) btn.disabled = true;

        try {
          const res = await API.loginGroup(pin);
          if (res && res.success) {
            if (res.role === 'admin') {
              await this.setAdminSession();
              this.showToast('Logged in as Master Admin!', 'success');
            } else {
              this.setGuestSession(res.album);
              this.showToast(`Unlocked album: ${res.album.name}`, 'success');
            }
          } else {
            this.showToast((res && res.message) ? res.message : 'Invalid PIN', 'error');
          }
        } catch (err) {
          this.showToast('Login failed. Please check connection.', 'error');
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    }

    // Admin Login Form
    const adminForm = document.getElementById('admin-login-form');
    if (adminForm) {
      adminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const passInput = document.getElementById('admin-pass-input');
        const pass = passInput ? passInput.value : '';
        const btn = document.getElementById('admin-login-btn');
        if (btn) btn.disabled = true;

        try {
          const res = await API.loginAdmin(pass);
          if (res && res.success) {
            await this.setAdminSession();
            this.showToast('Welcome Master Admin!', 'success');
          } else {
            this.showToast((res && res.message) ? res.message : 'Incorrect Password', 'error');
          }
        } catch (err) {
          this.showToast('Login error. Please try again.', 'error');
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    }

    // Toggle Password Visibility
    const toggleGroupPin = document.getElementById('toggle-group-pin');
    if (toggleGroupPin) {
      toggleGroupPin.addEventListener('click', () => {
        const input = document.getElementById('group-pin-input');
        const icon = toggleGroupPin.querySelector('i');
        if (!input) return;
        if (input.type === 'password') {
          input.type = 'text';
          if (icon) icon.className = 'fa-regular fa-eye-slash';
        } else {
          input.type = 'password';
          if (icon) icon.className = 'fa-regular fa-eye';
        }
      });
    }

    const toggleAdminPass = document.getElementById('toggle-admin-pass');
    if (toggleAdminPass) {
      toggleAdminPass.addEventListener('click', () => {
        const input = document.getElementById('admin-pass-input');
        const icon = toggleAdminPass.querySelector('i');
        if (!input) return;
        if (input.type === 'password') {
          input.type = 'text';
          if (icon) icon.className = 'fa-regular fa-eye-slash';
        } else {
          input.type = 'password';
          if (icon) icon.className = 'fa-regular fa-eye';
        }
      });
    }

    // Admin Password Modal Handlers
    const adminAuthClose = document.getElementById('admin-auth-close');
    const adminAuthCancel = document.getElementById('admin-auth-cancel');
    const adminAuthModal = document.getElementById('admin-auth-modal');
    if (adminAuthClose) adminAuthClose.addEventListener('click', () => this.closeAdminPasswordModal());
    if (adminAuthCancel) adminAuthCancel.addEventListener('click', () => this.closeAdminPasswordModal());
    if (adminAuthModal) {
      adminAuthModal.addEventListener('click', (e) => {
        if (e.target === adminAuthModal || e.target.classList.contains('modal-backdrop')) {
          this.closeAdminPasswordModal();
        }
      });
    }

    const toggleAdminModalPass = document.getElementById('toggle-admin-auth-modal-pass');
    if (toggleAdminModalPass) {
      toggleAdminModalPass.addEventListener('click', () => {
        const input = document.getElementById('admin-auth-modal-pass');
        const icon = toggleAdminModalPass.querySelector('i');
        if (!input) return;
        if (input.type === 'password') {
          input.type = 'text';
          if (icon) icon.className = 'fa-regular fa-eye-slash';
        } else {
          input.type = 'password';
          if (icon) icon.className = 'fa-regular fa-eye';
        }
      });
    }

    const adminAuthModalForm = document.getElementById('admin-auth-modal-form');
    if (adminAuthModalForm) {
      adminAuthModalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const passInput = document.getElementById('admin-auth-modal-pass');
        const pass = passInput ? passInput.value.trim() : '';
        const btn = document.getElementById('admin-auth-submit-btn');
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';
        }

        try {
          const res = await API.loginAdmin(pass);
          if (res && res.success) {
            this.closeAdminPasswordModal();
            await this.setAdminSession();
            this.showToast('Welcome Master Admin!', 'success');
          } else {
            this.showToast((res && res.message) ? res.message : 'Incorrect Admin Password', 'error');
            if (passInput) {
              passInput.style.borderColor = 'var(--danger-accent)';
              passInput.focus();
              setTimeout(() => { passInput.style.borderColor = ''; }, 2000);
            }
          }
        } catch (err) {
          this.showToast('Login verification failed. Please try again.', 'error');
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span>Unlock Dashboard</span> <i class="fa-solid fa-arrow-right"></i>';
          }
        }
      });
    }

    // Switch Album Button (Gallery Header)
    const switchAlbumBtn = document.getElementById('gallery-switch-album-btn');
    if (switchAlbumBtn) {
      switchAlbumBtn.addEventListener('click', () => this.openAlbumPicker());
    }

    const albumSwitcherClose = document.getElementById('album-switcher-close');
    if (albumSwitcherClose) {
      albumSwitcherClose.addEventListener('click', () => {
        const modal = document.getElementById('album-switcher-modal');
        if (modal) modal.classList.remove('active');
      });
    }

    const albumSwitcherModal = document.getElementById('album-switcher-modal');
    if (albumSwitcherModal) {
      albumSwitcherModal.addEventListener('click', (e) => {
        if (e.target === albumSwitcherModal || e.target.classList.contains('modal-backdrop')) {
          albumSwitcherModal.classList.remove('active');
        }
      });
    }

    // Mobile Navigation Controls
    const mobNavGallery = document.getElementById('mob-nav-gallery');
    if (mobNavGallery) {
      mobNavGallery.addEventListener('click', () => {
        if (this.currentRole) this.switchView('gallery');
        else this.switchView('auth');
      });
    }

    const mobNavAlbums = document.getElementById('mob-nav-albums');
    if (mobNavAlbums) {
      mobNavAlbums.addEventListener('click', () => {
        if (this.currentRole === 'admin') {
          this.switchView('admin');
          const albumsTab = document.querySelector('[data-tab="tab-albums"]');
          if (albumsTab) albumsTab.click();
        } else if (this.currentRole === 'guest') {
          this.openAlbumPicker();
        } else {
          this.switchView('auth');
        }
      });
    }

    const mobNavFavorites = document.getElementById('mob-nav-favorites');
    if (mobNavFavorites) {
      mobNavFavorites.addEventListener('click', () => {
        if (this.currentRole) {
          this.switchView('gallery');
          const favTab = document.querySelector('[data-type="favorite"]');
          if (favTab) favTab.click();
        }
      });
    }

    const mobNavAdmin = document.getElementById('mob-nav-admin');
    if (mobNavAdmin) {
      mobNavAdmin.addEventListener('click', () => {
        if (this.currentRole === 'admin') {
          this.switchView('admin');
        } else {
          this.promptAdminPassword();
        }
      });
    }

    const mobNavLogout = document.getElementById('mob-nav-logout');
    if (mobNavLogout) {
      mobNavLogout.addEventListener('click', () => this.logout());
    }
  },

  promptAdminPassword() {
    const modal = document.getElementById('admin-auth-modal');
    if (modal) {
      modal.classList.add('active');
      const passInput = document.getElementById('admin-auth-modal-pass');
      if (passInput) {
        passInput.value = '';
        setTimeout(() => passInput.focus(), 120);
      }
    }
  },

  closeAdminPasswordModal() {
    const modal = document.getElementById('admin-auth-modal');
    if (modal) modal.classList.remove('active');
  },

  switchView(viewName) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.updateHeaderNav();
  },

  async setAdminSession() {
    this.currentRole = 'admin';
    localStorage.setItem('vk_role', 'admin');
    this.albums = await API.getAlbums();
    if (this.albums && this.albums.length > 0) this.currentAlbum = this.albums[0];

    const mobAdmin = document.getElementById('mob-nav-admin');
    if (mobAdmin) mobAdmin.style.display = 'flex';

    if (typeof Admin !== 'undefined') {
      await Admin.populateAlbumSelects();
      await Admin.refreshStats();
    }
    this.switchView('admin');
  },

  setGuestSession(album) {
    this.currentRole = 'guest';
    this.currentAlbum = album;
    localStorage.setItem('vk_role', 'guest');
    localStorage.setItem('vk_album', JSON.stringify(album));

    const mobAdmin = document.getElementById('mob-nav-admin');
    if (mobAdmin) mobAdmin.style.display = 'flex';

    if (typeof Gallery !== 'undefined' && Gallery.loadAlbumMedia) {
      Gallery.loadAlbumMedia(album);
    }
    this.switchView('gallery');
  },

  logout() {
    this.currentRole = null;
    this.currentAlbum = null;
    localStorage.removeItem('vk_role');
    localStorage.removeItem('vk_album');
    localStorage.removeItem('vk_token');
    sessionStorage.removeItem('vk_role');
    sessionStorage.removeItem('vk_album');
    sessionStorage.removeItem('vk_token');

    const groupPinInput = document.getElementById('group-pin-input');
    if (groupPinInput) groupPinInput.value = '';
    const adminPassInput = document.getElementById('admin-pass-input');
    if (adminPassInput) adminPassInput.value = '';

    this.switchView('auth');
    this.showToast('Logged out securely', 'success');
  },

  updateHeaderNav() {
    const container = document.getElementById('header-actions');
    if (!container) return;

    const weddingLink = `
      <a href="/wedding.html" class="btn btn-sm btn-gold" style="background: linear-gradient(135deg, #d4af37, #b8860b); color: #0d0f17; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 8px; font-size: 0.85rem;">
        <i class="fa-solid fa-ring"></i> Wedding
      </a>
    `;

    if (!this.currentRole) {
      container.innerHTML = `
        ${weddingLink}
        <button class="badge-role admin" onclick="App.promptAdminPassword()" style="cursor: pointer;" title="Master Admin Login">
          <i class="fa-solid fa-crown"></i> Admin
        </button>
      `;
      return;
    }

    if (this.currentRole === 'admin') {
      container.innerHTML = `
        ${weddingLink}
        <button class="badge-role admin" onclick="App.switchView('admin');" style="cursor: pointer;">
          <i class="fa-solid fa-crown"></i> Admin
        </button>
        <button class="btn btn-sm btn-secondary" onclick="App.switchView('gallery'); if (App.currentAlbum) Gallery.loadAlbumMedia(App.currentAlbum);">
          <i class="fa-regular fa-image"></i> View Gallery
        </button>
        <button class="btn btn-sm btn-secondary" onclick="App.switchView('admin');">
          <i class="fa-solid fa-gauge"></i> Dashboard
        </button>
        <button class="btn btn-sm btn-danger-outline" onclick="App.logout()" title="Logout">
          <i class="fa-solid fa-power-off"></i>
        </button>
      `;
    } else {
      container.innerHTML = `
        ${weddingLink}
        <button class="badge-role admin" onclick="App.promptAdminPassword()" style="cursor: pointer;" title="Master Admin Login">
          <i class="fa-solid fa-crown"></i> Admin
        </button>
        <span class="badge-role"><i class="fa-solid fa-user"></i> Guest</span>
        <button class="btn btn-sm btn-secondary" onclick="App.openAlbumPicker()">
          <i class="fa-solid fa-folder-tree"></i> Albums
        </button>
        <button class="btn btn-sm btn-danger-outline" onclick="App.logout()" title="Exit">
          <i class="fa-solid fa-arrow-right-from-bracket"></i> Exit
        </button>
      `;
    }
  },

  async openAlbumPicker() {
    this.albums = await API.getAlbums();
    const modal = document.getElementById('album-switcher-modal');
    const list = document.getElementById('albums-picker-list');
    if (!modal || !list) return;
    list.innerHTML = '';

    if (!this.albums || this.albums.length === 0) {
      list.innerHTML = `<p style="text-align:center; padding:20px; color:var(--text-muted);">No albums available.</p>`;
    } else {
      this.albums.forEach(album => {
        const item = document.createElement('div');
        item.className = 'glass-panel';
        item.style.padding = '14px 18px';
        item.style.marginBottom = '10px';
        item.style.cursor = 'pointer';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';

        item.innerHTML = `
          <div>
            <h4 style="font-size:1.05rem; margin-bottom:2px;">${album.name}</h4>
            <small style="color:var(--text-secondary);">${album.description || 'Private Collection'}</small>
          </div>
          <span class="badge badge-gold"><i class="fa-solid fa-key"></i> PIN: ${album.pin}</span>
        `;

        item.addEventListener('click', () => {
          modal.classList.remove('active');
          if (this.currentRole === 'admin') {
            this.currentAlbum = album;
            Gallery.loadAlbumMedia(album);
            this.switchView('gallery');
          } else {
            const inputPin = prompt(`Enter Access PIN for "${album.name}":`);
            if (inputPin && inputPin.trim() === album.pin) {
              this.setGuestSession(album);
            } else if (inputPin) {
              App.showToast('Incorrect PIN for this album', 'error');
            }
          }
        });

        list.appendChild(item);
      });
    }

    modal.classList.add('active');
  },

  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  confirmDialog({ title, desc, confirmText = 'Delete', onConfirm }) {
    const modal = document.getElementById('delete-confirm-modal');
    if (!modal) {
      if (confirm(desc || title || 'Are you sure?')) {
        if (onConfirm) onConfirm();
      }
      return;
    }

    const titleEl = document.getElementById('delete-confirm-title');
    const descEl = document.getElementById('delete-confirm-desc');
    const confirmBtn = document.getElementById('btn-confirm-delete');
    const cancelBtn = document.getElementById('btn-cancel-delete');

    if (titleEl && title) titleEl.textContent = title;
    if (descEl && desc) descEl.textContent = desc;
    if (confirmBtn) confirmBtn.innerHTML = `<i class="fa-solid fa-trash"></i> ${confirmText}`;

    const cleanup = () => {
      modal.classList.remove('active');
      if (confirmBtn) confirmBtn.onclick = null;
      if (cancelBtn) cancelBtn.onclick = null;
      modal.onclick = null;
    };

    if (cancelBtn) cancelBtn.onclick = () => cleanup();
    modal.onclick = (e) => {
      if (e.target === modal || e.target.classList.contains('modal-backdrop')) cleanup();
    };

    if (confirmBtn) {
      confirmBtn.onclick = async () => {
        cleanup();
        if (onConfirm) await onConfirm();
      };
    }

    modal.classList.add('active');
  }
};

// Global Helpers
function fillPin(pin) {
  const input = document.getElementById('group-pin-input');
  if (input) input.value = pin;
}

function fillAdminPass(pass) {
  const input = document.getElementById('admin-pass-input');
  if (input) input.value = pass;
}

window.App = App;
window.fillPin = fillPin;
window.fillAdminPass = fillAdminPass;

// Start on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
