// State Management
let state = {
  invoices: [],
  customers: [],
  inventory: [],
  profile: {
    companyName: 'My Business',
    taxId: '',
    phone: '',
    email: '',
    address: '',
    currency: 'USD',
    taxRate: 18,
    prefix: 'INV-',
    upi: '',
    bankDetails: '',
    terms: 'Thank you for your business!',
    logo: '',
    passcode: { enabled: false, pin: '' },
    fontFamily: 'font-sans',
    fontSize: 'fs-md'
  },
  activeTab: 'dashboard',
  editingInvoiceId: null,
  accentColor: '#3b82f6',
  signatureImage: '',
  customerSignatureImage: ''
};

// Security Entry Lock State
let pinAttempt = '';

// Signature Drawing pad logic
let isDrawing = false;
let sigCanvas, sigCtx;
let isCustDrawing = false;
let custSigCanvas, custSigCtx;

// DOM Elements cache
let elements = {};

// Initializer
document.addEventListener('DOMContentLoaded', () => {
  initDOMElements();
  loadData();
  setupEventListeners();
  setupSignaturePad();
  setupCustomerSignaturePad();
  
  // Handle default tab routing on load
  handleHashRouting();
  
  // Start with at least one item row in editor
  ensureDefaultItemRow();
  
  // Render view
  renderActiveView();
});

// Setup DOM elements reference
function initDOMElements() {
  const ids = [
    'nav-company-name', 'nav-currency', 'current-section-title',
    'kpi-total-billings', 'kpi-total-collected', 'kpi-total-due', 'kpi-invoice-count',
    'dashboard-outstanding-list', 'sales-chart',
    'editor-template-select', 'editor-custom-color', 'editor-customer-select',
    'inv-number', 'inv-date', 'inv-due-date', 'inv-currency', 'inv-tax-type',
    'company-logo', 'btn-remove-logo', 'logo-preview-box',
    'seller-name', 'seller-tax-id', 'seller-phone', 'seller-email', 'seller-address',
    'buyer-name', 'buyer-tax-id', 'buyer-phone', 'buyer-email', 'buyer-address',
    'editor-items-list', 'btn-add-item',
    'inv-discount', 'inv-discount-type', 'inv-paid-amount',
    'payment-upi-id', 'payment-bank-details', 'inv-terms',
    'signature-pad', 'btn-clear-signature',
    'btn-save-invoice', 'btn-reset-invoice', 'btn-quick-create',
    'btn-print-invoice', 'btn-share-whatsapp',
    'invoices-search', 'invoices-filter-status', 'invoices-table-body',
    'customers-table-body', 'customers-search',
    'cust-id', 'cust-name', 'cust-tax-id', 'cust-phone', 'cust-email', 'cust-address',
    'btn-save-customer', 'btn-clear-customer',
    'settings-company-name', 'settings-company-tax-id', 'settings-company-phone',
    'settings-company-email', 'settings-company-address', 'settings-default-currency',
    'settings-default-tax-rate', 'settings-invoice-prefix', 'settings-default-upi',
    'settings-default-bank', 'settings-default-terms', 'btn-save-settings',
    'btn-backup-export', 'restore-file-input', 'btn-clear-db',
    'invoice-render-target',
    'settings-passcode-enabled', 'settings-passcode-pin', 'btn-save-security',
    'editor-font-family', 'editor-font-size', 'lock-screen', 'lock-error-msg',
    'btn-keypad-clear', 'btn-keypad-delete',
    'prod-id', 'prod-name', 'prod-sku', 'prod-price', 'prod-stock', 'prod-tax',
    'btn-save-product', 'btn-clear-product', 'inventory-search', 'inventory-table-body',
    'opt-letterhead', 'opt-single-line-header', 'opt-company-name-fs', 'opt-company-details-fs',
    'opt-company-name-color', 'seller-issued-by', 'inv-previous-due', 'val-company-name-fs', 'val-company-details-fs',
    'opt-customer-name-fs', 'opt-customer-details-fs', 'val-customer-name-fs', 'val-customer-details-fs',
    'customer-signature-pad', 'btn-clear-customer-sig', 'customer-sig-name'
  ];
  
  ids.forEach(id => {
    elements[id] = document.getElementById(id);
  });
  
  sigCanvas = elements['signature-pad'];
  if (sigCanvas) {
    sigCtx = sigCanvas.getContext('2d');
  }
}

// Load database state from LocalStorage
function loadData() {
  try {
    const invoicesData = localStorage.getItem('invoice_maker_invoices');
    state.invoices = invoicesData ? JSON.parse(invoicesData) : [];
    
    const inventoryData = localStorage.getItem('invoice_maker_inventory');
    state.inventory = inventoryData ? JSON.parse(inventoryData) : [];
    
    const customersData = localStorage.getItem('invoice_maker_customers');
    if (customersData) {
      state.customers = JSON.parse(customersData);
    } else {
      buildCustomersDirectoryFromInvoices();
      localStorage.setItem('invoice_maker_customers', JSON.stringify(state.customers));
    }
    
    const profileData = localStorage.getItem('invoice_maker_profile');
    if (profileData) {
      state.profile = JSON.parse(profileData);
    } else {
      // Save defaults
      localStorage.setItem('invoice_maker_profile', JSON.stringify(state.profile));
    }
    
    // Set default structures if missing
    if (!state.profile.passcode) {
      state.profile.passcode = { enabled: false, pin: '' };
    }
    if (!state.profile.fontFamily) state.profile.fontFamily = 'font-sans';
    if (!state.profile.fontSize) state.profile.fontSize = 'fs-md';

    // Show Lock Screen if Enabled
    if (state.profile.passcode.enabled && state.profile.passcode.pin) {
      setTimeout(() => {
        if (elements['lock-screen']) {
          elements['lock-screen'].classList.remove('d-none');
          initLockScreenKeypad();
        }
      }, 0);
    }

    // Apply profile settings to form fields
    loadProfileToSettingsForm();
    applyProfileDefaultsToEditor();
    
    // Auto sync sidebar metadata
    updateSidebarProfile();
  } catch (e) {
    console.error('Error loading database:', e);
  }
}

// Save database state
function saveInvoices() {
  try {
    localStorage.setItem('invoice_maker_invoices', JSON.stringify(state.invoices));
    updateSidebarProfile();
  } catch (e) {
    console.error('Error saving invoices:', e);
  }
}

// Setup Event Listeners
function setupEventListeners() {

  // Sidebar Toggle (Hamburger button)
  const sidebarToggleBtn = document.getElementById('btn-sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');

  if (sidebarToggleBtn && sidebar) {
    sidebarToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      if (sidebarOverlay) {
        // On small screens show overlay, on large screens don't
        if (window.innerWidth <= 768 && !sidebar.classList.contains('collapsed')) {
          sidebarOverlay.classList.add('active');
        } else {
          sidebarOverlay.classList.remove('active');
        }
      }
      // Recalculate invoice preview after sidebar transition completes
      setTimeout(() => {
        fitPreviewSheet();
      }, 320);
    });
  }

  // Clicking overlay closes sidebar (mobile)
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
      if (sidebar) sidebar.classList.add('collapsed');
      sidebarOverlay.classList.remove('active');
    });
  }

  // Sidebar tab navigation
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.getAttribute('data-tab');
      if (tab === 'editor') {
        clearEditorForm();
      }
      navigateToTab(tab);
    });
  });
  
  // Quick Create buttons
  if (elements['btn-quick-create']) {
    elements['btn-quick-create'].addEventListener('click', () => {
      navigateToTab('editor');
      clearEditorForm();
    });
  }
  
  // Hash listener for popup link integrations
  window.addEventListener('hashchange', handleHashRouting);

  // Profile Settings form submission
  if (elements['btn-save-settings']) {
    elements['btn-save-settings'].addEventListener('click', saveSettingsConfiguration);
  }

  // Backup and Restore
  if (elements['btn-backup-export']) {
    elements['btn-backup-export'].addEventListener('click', exportDatabaseJSON);
  }
  if (elements['restore-file-input']) {
    elements['restore-file-input'].addEventListener('change', importDatabaseJSON);
  }
  if (elements['btn-clear-db']) {
    elements['btn-clear-db'].addEventListener('click', clearEntireDatabase);
  }

  // Editor Actions
  if (elements['btn-add-item']) {
    elements['btn-add-item'].addEventListener('click', () => {
      addItemRow();
      recalculateInvoice();
    });
  }
  if (elements['btn-save-invoice']) {
    elements['btn-save-invoice'].addEventListener('click', saveInvoiceAction);
  }
  if (elements['btn-reset-invoice']) {
    elements['btn-reset-invoice'].addEventListener('click', clearEditorForm);
  }
  if (elements['btn-print-invoice']) {
    elements['btn-print-invoice'].addEventListener('click', () => {
      window.print();
    });
  }
  if (elements['btn-share-whatsapp']) {
    elements['btn-share-whatsapp'].addEventListener('click', shareWhatsAppAction);
  }

  // Logo upload handling
  if (elements['company-logo']) {
    elements['company-logo'].addEventListener('change', handleLogoUpload);
  }
  if (elements['btn-remove-logo']) {
    elements['btn-remove-logo'].addEventListener('click', removeLogoAction);
  }

  // Form Live Updates
  const inputChangeListeners = [
    'inv-number', 'inv-date', 'inv-due-date', 'inv-currency', 'inv-tax-type',
    'seller-name', 'seller-tax-id', 'seller-phone', 'seller-email', 'seller-address', 'seller-issued-by',
    'buyer-name', 'buyer-tax-id', 'buyer-phone', 'buyer-email', 'buyer-address',
    'inv-discount', 'inv-discount-type', 'inv-paid-amount', 'inv-previous-due',
    'payment-upi-id', 'payment-bank-details', 'inv-terms', 'customer-sig-name'
  ];
  
  inputChangeListeners.forEach(id => {
    const el = elements[id];
    if (el) {
      el.addEventListener('input', () => {
        // If changing client details, auto update customer selector state to empty custom
        if (id.startsWith('buyer-')) {
          elements['editor-customer-select'].value = '';
        }
        recalculateInvoice();
      });
    }
  });

  // Style customization listeners
  ['opt-letterhead', 'opt-single-line-header', 'opt-company-name-color'].forEach(id => {
    const el = elements[id];
    if (el) {
      el.addEventListener('change', recalculateInvoice);
      el.addEventListener('input', recalculateInvoice);
    }
  });

  if (elements['opt-company-name-fs']) {
    elements['opt-company-name-fs'].addEventListener('input', (e) => {
      if (elements['val-company-name-fs']) {
        elements['val-company-name-fs'].textContent = e.target.value + 'px';
      }
      recalculateInvoice();
    });
  }

  if (elements['opt-company-details-fs']) {
    elements['opt-company-details-fs'].addEventListener('input', (e) => {
      if (elements['val-company-details-fs']) {
        elements['val-company-details-fs'].textContent = e.target.value + 'px';
      }
      recalculateInvoice();
    });
  }

  if (elements['opt-customer-name-fs']) {
    elements['opt-customer-name-fs'].addEventListener('input', (e) => {
      if (elements['val-customer-name-fs']) {
        elements['val-customer-name-fs'].textContent = e.target.value + 'px';
      }
      recalculateInvoice();
    });
  }

  if (elements['opt-customer-details-fs']) {
    elements['opt-customer-details-fs'].addEventListener('input', (e) => {
      if (elements['val-customer-details-fs']) {
        elements['val-customer-details-fs'].textContent = e.target.value + 'px';
      }
      recalculateInvoice();
    });
  }

  // Template select
  if (elements['editor-template-select']) {
    elements['editor-template-select'].addEventListener('change', () => {
      recalculateInvoice();
    });
  }

  // Color Accent Picker
  document.querySelectorAll('.palette-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.palette-option').forEach(p => p.classList.remove('active'));
      opt.classList.add('active');
      state.accentColor = opt.getAttribute('data-color');
      recalculateInvoice();
    });
  });
  
  if (elements['editor-custom-color']) {
    elements['editor-custom-color'].addEventListener('input', (e) => {
      document.querySelectorAll('.palette-option').forEach(p => p.classList.remove('active'));
      state.accentColor = e.target.value;
      recalculateInvoice();
    });
  }

  // Saved Customer dropdown
  if (elements['editor-customer-select']) {
    elements['editor-customer-select'].addEventListener('change', (e) => {
      const idx = e.target.value;
      if (idx !== '') {
        const customer = state.customers[idx];
        elements['buyer-name'].value = customer.name || '';
        elements['buyer-tax-id'].value = customer.taxId || '';
        elements['buyer-phone'].value = customer.phone || '';
        elements['buyer-email'].value = customer.email || '';
        elements['buyer-address'].value = customer.address || '';
        recalculateInvoice();
      }
    });
  }

  // Invoices Registry Filters
  if (elements['invoices-search']) {
    elements['invoices-search'].addEventListener('input', renderInvoicesListTable);
  }
  if (elements['invoices-filter-status']) {
    elements['invoices-filter-status'].addEventListener('change', renderInvoicesListTable);
  }

  // Customer actions
  if (elements['btn-save-customer']) {
    elements['btn-save-customer'].addEventListener('click', saveCustomerAction);
  }
  if (elements['btn-clear-customer']) {
    elements['btn-clear-customer'].addEventListener('click', clearCustomerForm);
  }
  if (elements['customers-search']) {
    elements['customers-search'].addEventListener('input', renderCustomersListTable);
  }

  // Inventory actions
  if (elements['btn-save-product']) {
    elements['btn-save-product'].addEventListener('click', saveProductAction);
  }
  if (elements['btn-clear-product']) {
    elements['btn-clear-product'].addEventListener('click', clearProductForm);
  }
  if (elements['inventory-search']) {
    elements['inventory-search'].addEventListener('input', renderInventoryTable);
  }

  // Security configuration
  if (elements['btn-save-security']) {
    elements['btn-save-security'].addEventListener('click', saveSecurityPINConfig);
  }

  // Typography selection listeners
  if (elements['editor-font-family']) {
    elements['editor-font-family'].addEventListener('change', (e) => {
      state.profile.fontFamily = e.target.value;
      localStorage.setItem('invoice_maker_profile', JSON.stringify(state.profile));
      recalculateInvoice();
    });
  }
  if (elements['editor-font-size']) {
    elements['editor-font-size'].addEventListener('change', (e) => {
      state.profile.fontSize = e.target.value;
      localStorage.setItem('invoice_maker_profile', JSON.stringify(state.profile));
      recalculateInvoice();
    });
  }
}

// Handle routing from #new-invoice or #dashboard
function handleHashRouting() {
  const hash = window.location.hash;
  if (hash === '#new-invoice') {
    navigateToTab('editor');
    clearEditorForm();
  } else if (hash === '#invoices-list') {
    navigateToTab('invoices');
  } else if (hash === '#customers') {
    navigateToTab('customers');
  } else if (hash === '#inventory') {
    navigateToTab('inventory');
  } else if (hash === '#settings') {
    navigateToTab('settings');
  } else {
    navigateToTab('dashboard');
  }
}

// Navigation between tabs
function navigateToTab(tabId) {
  state.activeTab = tabId;
  
  // Update sidebar active classes
  document.querySelectorAll('.menu-item').forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update DOM active sections
  document.querySelectorAll('.content-section').forEach(sec => {
    sec.classList.remove('active');
  });

  // Handle display transitions
  let currentTitle = 'Dashboard';
  if (tabId === 'dashboard') {
    document.getElementById('tab-dashboard').classList.add('active');
    renderDashboardView();
  } else if (tabId === 'editor') {
    document.getElementById('tab-editor').classList.add('active');
    currentTitle = state.editingInvoiceId ? 'Edit Invoice' : 'Create Invoice';
    recalculateInvoice();
    setTimeout(fitPreviewSheet, 50);
  } else if (tabId === 'invoices') {
    document.getElementById('tab-invoices').classList.add('active');
    currentTitle = 'Billing Registry';
    renderInvoicesListTable();
  } else if (tabId === 'customers') {
    document.getElementById('tab-customers').classList.add('active');
    currentTitle = 'Customer Directory';
    renderCustomersListTable();
  } else if (tabId === 'inventory') {
    document.getElementById('tab-inventory').classList.add('active');
    currentTitle = 'Inventory Control';
    renderInventoryTable();
  } else if (tabId === 'settings') {
    document.getElementById('tab-settings').classList.add('active');
    currentTitle = 'Configuration Panel';
  }

  elements['current-section-title'].textContent = currentTitle;
}

// Render active views based on tabs
function renderActiveView() {
  navigateToTab(state.activeTab);
}

// Load company info to settings forms
function loadProfileToSettingsForm() {
  if (!elements['settings-company-name']) return;
  
  elements['settings-company-name'].value = state.profile.companyName || '';
  elements['settings-company-tax-id'].value = state.profile.taxId || '';
  elements['settings-company-phone'].value = state.profile.phone || '';
  elements['settings-company-email'].value = state.profile.email || '';
  elements['settings-company-address'].value = state.profile.address || '';
  elements['settings-default-currency'].value = state.profile.currency || 'USD';
  elements['settings-default-tax-rate'].value = state.profile.taxRate || 18;
  elements['settings-invoice-prefix'].value = state.profile.prefix || 'INV-';
  elements['settings-default-upi'].value = state.profile.upi || '';
  elements['settings-default-bank'].value = state.profile.bankDetails || '';
  elements['settings-default-terms'].value = state.profile.terms || '';
  
  // Load passcode settings
  if (state.profile.passcode) {
    if (elements['settings-passcode-enabled']) elements['settings-passcode-enabled'].value = String(state.profile.passcode.enabled);
    if (elements['settings-passcode-pin']) elements['settings-passcode-pin'].value = state.profile.passcode.pin || '';
  }
  
  // Show image preview if exists
  if (state.profile.logo) {
    showLogoPreview(state.profile.logo);
  } else {
    hideLogoPreview();
  }
}

// Setup base presets on invoice creator
function applyProfileDefaultsToEditor() {
  try {
    if (!elements['inv-number']) return;
    
    // Set Sequential Invoice Number
    if (!state.editingInvoiceId) {
      const prefix = state.profile.prefix || '';
      let nextNum = 1001;
      
      if (state.invoices.length > 0) {
        let maxNum = 1000;
        state.invoices.forEach(inv => {
          if (inv.number) {
            const numStr = String(inv.number);
            let numPart = numStr;
            if (prefix && numStr.startsWith(prefix)) {
              numPart = numStr.substring(prefix.length);
            }
            // Strip non-numbers to find exact numeric suffix
            const parsed = parseInt(numPart.replace(/[^0-9]/g, '')) || 0;
            if (parsed > maxNum) {
              maxNum = parsed;
            }
          }
        });
        nextNum = maxNum + 1;
      }
      
      elements['inv-number'].value = `${prefix}${nextNum}`;
    }

    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14); // 2 weeks default terms
    const dueDateStr = dueDate.toISOString().split('T')[0];
    
    if (elements['inv-date'] && !elements['inv-date'].value) elements['inv-date'].value = today;
    if (elements['inv-due-date'] && !elements['inv-due-date'].value) elements['inv-due-date'].value = dueDateStr;
    
    // Setup other default inputs
    if (elements['inv-currency']) elements['inv-currency'].value = state.profile.currency || 'USD';
    if (elements['seller-name']) elements['seller-name'].value = state.profile.companyName || '';
    if (elements['seller-tax-id']) elements['seller-tax-id'].value = state.profile.taxId || '';
    if (elements['seller-phone']) elements['seller-phone'].value = state.profile.phone || '';
    if (elements['seller-email']) elements['seller-email'].value = state.profile.email || '';
    if (elements['seller-address']) elements['seller-address'].value = state.profile.address || '';
    if (elements['payment-upi-id']) elements['payment-upi-id'].value = state.profile.upi || '';
    if (elements['payment-bank-details']) elements['payment-bank-details'].value = state.profile.bankDetails || '';
    if (elements['inv-terms']) elements['inv-terms'].value = state.profile.terms || '';
    
    // Set fonts
    if (elements['editor-font-family']) elements['editor-font-family'].value = state.profile.fontFamily || 'font-sans';
    if (elements['editor-font-size']) elements['editor-font-size'].value = state.profile.fontSize || 'fs-md';

    // Load Logo from Profile defaults
    state.logoDataUri = state.profile.logo || '';
    if (state.logoDataUri) {
      showLogoPreview(state.logoDataUri);
    } else {
      hideLogoPreview();
    }
  } catch (err) {
    console.error('Error applying profile defaults:', err);
  }
}

// Update sidebar headers
function updateSidebarProfile() {
  elements['nav-company-name'].textContent = state.profile.companyName || 'My Business';
  elements['nav-currency'].textContent = `${state.profile.currency || 'USD'} (${getCurrencySymbol(state.profile.currency)})`;
  
  const initials = (state.profile.companyName || 'MB')
    .split(' ')
    .map(w => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
  elements['avatar-fallback'].textContent = initials || 'CP';
  
  // Refresh customer cache from invoices
  populateCustomersDropdown();
}

// Save Settings Event Handler
function saveSettingsConfiguration() {
  state.profile = {
    companyName: elements['settings-company-name'].value,
    taxId: elements['settings-company-tax-id'].value,
    phone: elements['settings-company-phone'].value,
    email: elements['settings-company-email'].value,
    address: elements['settings-company-address'].value,
    currency: elements['settings-default-currency'].value,
    taxRate: parseFloat(elements['settings-default-tax-rate'].value) || 0,
    prefix: elements['settings-invoice-prefix'].value,
    upi: elements['settings-default-upi'].value,
    bankDetails: elements['settings-default-bank'].value,
    terms: elements['settings-default-terms'].value,
    logo: state.logoDataUri || '' // Keep current uploaded logo as default
  };
  
  localStorage.setItem('invoice_maker_profile', JSON.stringify(state.profile));
  updateSidebarProfile();
  
  // Show notification
  alert('Settings saved successfully!');
  navigateToTab('dashboard');
}

// Ensure there is at least 1 empty row in items
function ensureDefaultItemRow() {
  if (elements['editor-items-list'].children.length === 0) {
    addItemRow();
  }
}

// Add Item Row in DOM
function addItemRow(item = { name: '', quantity: 1, price: 0, tax: state.profile.taxRate }) {
  const rowId = `item-row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  
  const row = document.createElement('div');
  row.className = 'item-editor-row';
  row.id = rowId;
  
  row.innerHTML = `
    <div style="position: relative;">
      <div class="item-editor-col-header">Item Description</div>
      <input type="text" class="form-control item-name" placeholder="Item/Service name" value="${item.name}" autocomplete="off">
      <div class="autocomplete-suggestions-box d-none" id="suggest-${rowId}"></div>
    </div>
    <div>
      <div class="item-editor-col-header">Qty</div>
      <input type="number" class="form-control item-qty" min="1" step="any" value="${item.quantity}">
    </div>
    <div>
      <div class="item-editor-col-header">Price</div>
      <input type="number" class="form-control item-price" min="0" step="0.01" placeholder="0.00" value="${item.price}">
    </div>
    <div>
      <div class="item-editor-col-header">Tax %</div>
      <input type="number" class="form-control item-tax" min="0" max="100" step="0.1" value="${item.tax}">
    </div>
    <div>
      <button type="button" class="btn-icon-only btn-remove-row" title="Remove item">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
      </button>
    </div>
  `;
  
  elements['editor-items-list'].appendChild(row);
  
  // Autocomplete search suggestions logic
  const nameInput = row.querySelector('.item-name');
  const suggestionsBox = row.querySelector(`#suggest-${rowId}`);
  
  nameInput.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase().trim();
    if (!val) {
      suggestionsBox.classList.add('d-none');
      return;
    }
    
    // Search products in inventory
    const matches = state.inventory.filter(p => 
      p.name.toLowerCase().includes(val) || 
      p.sku.toLowerCase().includes(val)
    );
    
    if (matches.length === 0) {
      suggestionsBox.classList.add('d-none');
      return;
    }
    
    suggestionsBox.innerHTML = matches.map(p => `
      <div class="suggestion-row" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" data-tax="${p.tax}">
        <span>${p.name} <span class="suggestion-sku">(${p.sku})</span></span>
        <strong>$${p.price.toFixed(2)}</strong>
      </div>
    `).join('');
    
    suggestionsBox.classList.remove('d-none');
    
    // Bind click to suggestion rows
    suggestionsBox.querySelectorAll('.suggestion-row').forEach(sRow => {
      sRow.addEventListener('click', () => {
        nameInput.value = sRow.getAttribute('data-name');
        row.querySelector('.item-price').value = sRow.getAttribute('data-price');
        row.querySelector('.item-tax').value = sRow.getAttribute('data-tax');
        suggestionsBox.classList.add('d-none');
        recalculateInvoice();
      });
    });
  });
  
  // Hide suggestions if user clicks outside
  document.addEventListener('click', (e) => {
    if (e.target !== nameInput && !suggestionsBox.contains(e.target)) {
      suggestionsBox.classList.add('d-none');
    }
  });
  
  // Attach change listeners to inputs
  row.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', recalculateInvoice);
  });
  
  row.querySelector('.btn-remove-row').addEventListener('click', () => {
    row.remove();
    ensureDefaultItemRow();
    recalculateInvoice();
  });
}

// Logo uploading and preview helpers
function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    state.logoDataUri = event.target.result;
    showLogoPreview(state.logoDataUri);
    recalculateInvoice();
  };
  reader.readAsDataURL(file);
}

function showLogoPreview(dataUri) {
  elements['logo-preview-box'].innerHTML = `<img src="${dataUri}" alt="Logo">`;
  elements['btn-remove-logo'].classList.remove('d-none');
}

function removeLogoAction() {
  state.logoDataUri = '';
  elements['company-logo'].value = '';
  elements['logo-preview-box'].innerHTML = `<span class="text-muted text-xs">No Logo</span>`;
  elements['btn-remove-logo'].classList.add('d-none');
  recalculateInvoice();
}

// Signature pad capture setup
function setupSignaturePad() {
  if (!sigCanvas) return;
  
  const clearBtn = elements['btn-clear-signature'];
  
  // Mouse Events
  sigCanvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    const pos = getMousePos(sigCanvas, e);
    sigCtx.beginPath();
    sigCtx.moveTo(pos.x, pos.y);
  });
  
  sigCanvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const pos = getMousePos(sigCanvas, e);
    sigCtx.lineTo(pos.x, pos.y);
    sigCtx.strokeStyle = '#000000';
    sigCtx.lineWidth = 2;
    sigCtx.lineCap = 'round';
    sigCtx.stroke();
  });
  
  window.addEventListener('mouseup', () => {
    if (isDrawing) {
      isDrawing = false;
      saveSignaturePadImage();
    }
  });

  // Touch Events
  sigCanvas.addEventListener('touchstart', (e) => {
    isDrawing = true;
    const pos = getTouchPos(sigCanvas, e);
    sigCtx.beginPath();
    sigCtx.moveTo(pos.x, pos.y);
    e.preventDefault();
  }, { passive: false });

  sigCanvas.addEventListener('touchmove', (e) => {
    if (!isDrawing) return;
    const pos = getTouchPos(sigCanvas, e);
    sigCtx.lineTo(pos.x, pos.y);
    sigCtx.strokeStyle = '#000000';
    sigCtx.lineWidth = 2;
    sigCtx.lineCap = 'round';
    sigCtx.stroke();
    e.preventDefault();
  }, { passive: false });

  sigCanvas.addEventListener('touchend', () => {
    if (isDrawing) {
      isDrawing = false;
      saveSignaturePadImage();
    }
  });
  
  clearBtn.addEventListener('click', () => {
    sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    state.signatureImage = '';
    recalculateInvoice();
  });
}

// Customer Receiving Signature Pad Setup
function setupCustomerSignaturePad() {
  custSigCanvas = elements['customer-signature-pad'];
  if (!custSigCanvas) return;

  custSigCtx = custSigCanvas.getContext('2d');

  const clearBtn = elements['btn-clear-customer-sig'];

  // Helper: draw line smoothly
  function drawLine(ctx, x, y) {
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // Mouse events
  custSigCanvas.addEventListener('mousedown', (e) => {
    isCustDrawing = true;
    const pos = getMousePos(custSigCanvas, e);
    custSigCtx.beginPath();
    custSigCtx.moveTo(pos.x, pos.y);
  });

  custSigCanvas.addEventListener('mousemove', (e) => {
    if (!isCustDrawing) return;
    const pos = getMousePos(custSigCanvas, e);
    drawLine(custSigCtx, pos.x, pos.y);
  });

  window.addEventListener('mouseup', () => {
    if (isCustDrawing) {
      isCustDrawing = false;
      saveCustomerSignaturePadImage();
    }
  });

  // Touch / Stylus events (passive:false to allow preventDefault for scroll blocking)
  custSigCanvas.addEventListener('touchstart', (e) => {
    isCustDrawing = true;
    const pos = getTouchPos(custSigCanvas, e);
    custSigCtx.beginPath();
    custSigCtx.moveTo(pos.x, pos.y);
    e.preventDefault();
  }, { passive: false });

  custSigCanvas.addEventListener('touchmove', (e) => {
    if (!isCustDrawing) return;
    const pos = getTouchPos(custSigCanvas, e);
    drawLine(custSigCtx, pos.x, pos.y);
    e.preventDefault();
  }, { passive: false });

  custSigCanvas.addEventListener('touchend', () => {
    if (isCustDrawing) {
      isCustDrawing = false;
      saveCustomerSignaturePadImage();
    }
  });

  // Pointer events (stylus support for Surface / iPad Apple Pencil)
  custSigCanvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'pen' || e.pointerType === 'touch') {
      isCustDrawing = true;
      const pos = getMousePos(custSigCanvas, e);
      custSigCtx.beginPath();
      custSigCtx.moveTo(pos.x, pos.y);
    }
  });
  custSigCanvas.addEventListener('pointermove', (e) => {
    if (!isCustDrawing || (e.pointerType !== 'pen' && e.pointerType !== 'touch')) return;
    const pos = getMousePos(custSigCanvas, e);
    drawLine(custSigCtx, pos.x, pos.y);
  });
  custSigCanvas.addEventListener('pointerup', () => {
    if (isCustDrawing) {
      isCustDrawing = false;
      saveCustomerSignaturePadImage();
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      custSigCtx.clearRect(0, 0, custSigCanvas.width, custSigCanvas.height);
      state.customerSignatureImage = '';
      recalculateInvoice();
    });
  }
}

function saveCustomerSignaturePadImage() {
  if (!custSigCanvas) return;
  const blank = document.createElement('canvas');
  blank.width = custSigCanvas.width;
  blank.height = custSigCanvas.height;
  if (custSigCanvas.toDataURL() === blank.toDataURL()) {
    state.customerSignatureImage = '';
  } else {
    state.customerSignatureImage = custSigCanvas.toDataURL();
  }
  recalculateInvoice();
}

function getMousePos(canvas, evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (evt.clientX - rect.left) * (canvas.width / rect.width),
    y: (evt.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function getTouchPos(canvas, touchEvent) {
  const rect = canvas.getBoundingClientRect();
  const touch = touchEvent.touches[0];
  return {
    x: (touch.clientX - rect.left) * (canvas.width / rect.width),
    y: (touch.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function saveSignaturePadImage() {
  // Check if canvas is empty
  const blank = document.createElement('canvas');
  blank.width = sigCanvas.width;
  blank.height = sigCanvas.height;
  if (sigCanvas.toDataURL() === blank.toDataURL()) {
    state.signatureImage = '';
  } else {
    state.signatureImage = sigCanvas.toDataURL();
  }
  recalculateInvoice();
}

function loadSignatureToPad(dataUri) {
  if (!sigCanvas || !dataUri) return;
  const img = new Image();
  img.onload = () => {
    sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    sigCtx.drawImage(img, 0, 0);
  };
  img.src = dataUri;
  state.signatureImage = dataUri;
}

// Realtime calculations & updates
function recalculateInvoice() {
  const currencyCode = elements['inv-currency'].value;
  const symbol = getCurrencySymbol(currencyCode);
  const taxMode = elements['inv-tax-type'].value;

  let subtotal = 0;
  let taxTotal = 0;
  const lineItems = [];

  // Parse lines
  const rows = elements['editor-items-list'].querySelectorAll('.item-editor-row');
  rows.forEach(row => {
    const name = row.querySelector('.item-name').value || 'Unlabelled Item';
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    const taxRate = parseFloat(row.querySelector('.item-tax').value) || 0;
    
    const rowSubtotal = qty * price;
    const rowTax = rowSubtotal * (taxRate / 100);
    
    subtotal += rowSubtotal;
    taxTotal += rowTax;
    
    lineItems.push({
      name,
      quantity: qty,
      price,
      taxRate,
      subtotal: rowSubtotal
    });
  });

  // Discount
  const discountInput = parseFloat(elements['inv-discount'].value) || 0;
  const discountType = elements['inv-discount-type'].value;
  let discountVal = 0;
  if (discountType === 'percent') {
    discountVal = subtotal * (discountInput / 100);
  } else {
    discountVal = discountInput;
  }

  const previousDue = parseFloat(elements['inv-previous-due'].value) || 0;
  const grandTotal = subtotal - discountVal + taxTotal + previousDue;
  
  // Payments
  const paidAmount = parseFloat(elements['inv-paid-amount'].value) || 0;
  const balanceDue = grandTotal - paidAmount;

  // Build current calculation model
  const invoiceData = {
    number: elements['inv-number'].value || 'INV-TEMP',
    date: elements['inv-date'].value,
    dueDate: elements['inv-due-date'].value,
    currency: currencyCode,
    taxType: taxMode,
    seller: {
      name: elements['seller-name'].value,
      taxId: elements['seller-tax-id'].value,
      phone: elements['seller-phone'].value,
      email: elements['seller-email'].value,
      address: elements['seller-address'].value,
      logo: state.logoDataUri,
      issuedBy: elements['seller-issued-by'] ? elements['seller-issued-by'].value : ''
    },
    buyer: {
      name: elements['buyer-name'].value,
      taxId: elements['buyer-tax-id'].value,
      phone: elements['buyer-phone'].value,
      email: elements['buyer-email'].value,
      address: elements['buyer-address'].value
    },
    items: lineItems,
    subtotal,
    taxTotal,
    discountType,
    discountInput,
    discountValue: discountVal,
    previousDue,
    total: grandTotal,
    paid: paidAmount,
    balance: balanceDue,
    upi: elements['payment-upi-id'].value,
    bankDetails: elements['payment-bank-details'].value,
    terms: elements['inv-terms'].value,
    signature: state.signatureImage,
    fontFamily: elements['editor-font-family'] ? elements['editor-font-family'].value : 'font-sans',
    fontSize: elements['editor-font-size'] ? elements['editor-font-size'].value : 'fs-md',
    optLetterhead: elements['opt-letterhead'] ? elements['opt-letterhead'].checked : false,
    optSingleLineHeader: elements['opt-single-line-header'] ? elements['opt-single-line-header'].checked : false,
    optCompanyNameFs: elements['opt-company-name-fs'] ? elements['opt-company-name-fs'].value : '24',
    optCompanyDetailsFs: elements['opt-company-details-fs'] ? elements['opt-company-details-fs'].value : '11',
    optCompanyNameColor: elements['opt-company-name-color'] ? elements['opt-company-name-color'].value : '#3b82f6',
    optCustomerNameFs: elements['opt-customer-name-fs'] ? elements['opt-customer-name-fs'].value : '14',
    optCustomerDetailsFs: elements['opt-customer-details-fs'] ? elements['opt-customer-details-fs'].value : '11',
    customerSignature: state.customerSignatureImage,
    customerSigName: elements['customer-sig-name'] ? elements['customer-sig-name'].value : ''
  };

  // Render the invoice preview DOM on the right
  renderInvoicePreviewTemplate(invoiceData);
  fitPreviewSheet();
}

// Renders the preview template inside preview panel
function renderInvoicePreviewTemplate(inv) {
  const target = elements['invoice-render-target'];
  if (!target) return;

  const symbol = getCurrencySymbol(inv.currency);
  const tplStyle = elements['editor-template-select'].value;
  
  // Set Accent variables
  target.style.setProperty('--theme-color', state.accentColor);
  
  // Remove existing styles and attach active
  target.className = `template-renderer ${tplStyle} ${inv.fontFamily || 'font-sans'} ${inv.fontSize || 'fs-md'}`;

  // Helper format currency
  const fC = (val) => `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Construct item rows HTML
  const itemsHtml = inv.items.map(item => `
    <tr>
      <td>${item.name}</td>
      <td class="text-center">${item.quantity}</td>
      <td class="text-right">${fC(item.price)}</td>
      <td class="text-center">${item.taxRate}%</td>
      <td class="text-right">${fC(item.subtotal)}</td>
    </tr>
  `).join('');

  // Logo rendering
  const logoHtml = inv.seller.logo 
    ? `<img src="${inv.seller.logo}" class="tpl-logo" alt="Logo">` 
    : '';

  // QR Code canvas container
  const qrCanvasId = 'tpl-payment-qr-canvas';
  const qrContainerHtml = inv.upi 
    ? `<canvas id="${qrCanvasId}" class="tpl-qr-canvas"></canvas>` 
    : '';

  // Bank container
  const bankHtml = inv.bankDetails 
    ? `<div class="tpl-bank-box">
         <div class="tpl-bank-title">Bank Account Details</div>
         <div>${inv.bankDetails}</div>
       </div>`
    : '';

  // Payment details layout
  let paymentBlockHtml = '';
  if (inv.upi || inv.bankDetails) {
    paymentBlockHtml = `
      <div class="tpl-qr-and-bank">
        ${qrContainerHtml}
        ${bankHtml}
      </div>
    `;
  }

  // Signature rendering
  const sigHtml = inv.signature 
    ? `<img src="${inv.signature}" class="tpl-signature-img" alt="Signature">` 
    : `<div style="height: 35px; border-bottom: 1px solid #d1d5db; width: 140px; margin-bottom: 4px;"></div>`;

  // Hiding company header (letterhead option)
  const sellerHeaderStyle = inv.optLetterhead ? 'style="visibility: hidden;"' : '';

  // Single line layout for details
  let companyDetailsHtml = '';
  if (inv.optSingleLineHeader) {
    const parts = [];
    if (inv.seller.address) parts.push(inv.seller.address.replace(/\n/g, ' '));
    if (inv.seller.phone) parts.push('Phone: ' + inv.seller.phone);
    if (inv.seller.email) parts.push('Email: ' + inv.seller.email);
    if (inv.seller.taxId) parts.push(inv.taxType + ': ' + inv.seller.taxId);
    companyDetailsHtml = `<div class="tpl-company-details" style="font-size: ${inv.optCompanyDetailsFs}px;">${parts.join(' | ')}</div>`;
  } else {
    companyDetailsHtml = `
      <div class="tpl-company-details" style="font-size: ${inv.optCompanyDetailsFs}px;">
        ${inv.seller.address ? inv.seller.address.replace(/\n/g, '<br>') : ''}<br>
        ${inv.seller.phone ? 'Phone: ' + inv.seller.phone : ''} ${inv.seller.email ? ' | Email: ' + inv.seller.email : ''}
        ${inv.seller.taxId ? '<br>' + inv.taxType + ': ' + inv.seller.taxId : ''}
      </div>
    `;
  }

  // Company Name style
  const companyNameStyle = `style="font-size: ${inv.optCompanyNameFs}px; color: ${inv.optCompanyNameColor};"`;

  // General layout
  target.innerHTML = `
    <!-- HEADER -->
    <div class="tpl-header">
      <div class="tpl-header-left" ${sellerHeaderStyle}>
        ${logoHtml}
        <div class="tpl-company-name" ${companyNameStyle}>${inv.seller.name || 'Your Company'}</div>
        ${companyDetailsHtml}
      </div>
      <div class="tpl-header-right">
        <div class="tpl-inv-title">Invoice</div>
        <div class="tpl-meta-list">
          <div class="tpl-meta-label">Invoice No:</div>
          <div class="tpl-meta-val">${inv.number}</div>
          <div class="tpl-meta-label">Issue Date:</div>
          <div class="tpl-meta-val">${formatDate(inv.date)}</div>
          <div class="tpl-meta-label">Due Date:</div>
          <div class="tpl-meta-val">${formatDate(inv.dueDate)}</div>
        </div>
      </div>
    </div>

    <!-- BILLING DETAILS -->
    <div class="tpl-billing-row">
      <div class="tpl-bill-to">
        <div class="tpl-section-title">Billed To</div>
        <div class="tpl-client-name" style="font-size: ${inv.optCustomerNameFs}px;">${inv.buyer.name || 'Client Name'}</div>
        <div class="tpl-client-details" style="font-size: ${inv.optCustomerDetailsFs}px;">
          ${inv.buyer.address ? inv.buyer.address.replace(/\n/g, '<br>') : ''}<br>
          ${inv.buyer.phone ? 'Phone: ' + inv.buyer.phone : ''} ${inv.buyer.email ? ' | Email: ' + inv.buyer.email : ''}
          ${inv.buyer.taxId ? '<br>Tax Registration: ' + inv.buyer.taxId : ''}
        </div>
      </div>
    </div>

    <!-- ITEMS TABLE -->
    <table class="tpl-items-table ${tplStyle === 'minimalist' ? 'minimalist-table' : (tplStyle === 'retail' ? 'retail-table' : '')}">
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-center" style="width: 60px;">Qty</th>
          <th class="text-right" style="width: 100px;">Price</th>
          <th class="text-center" style="width: 70px;">Tax</th>
          <th class="text-right" style="width: 110px;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml || '<tr><td colspan="5" class="text-center text-muted">No items added yet.</td></tr>'}
      </tbody>
    </table>

    <!-- TOTALS & REMARKS -->
    <div class="tpl-summary-section">
      <div class="tpl-payment-info">
        ${paymentBlockHtml}
        <div class="tpl-terms-box">
          <div style="font-weight: 700; margin-bottom: 2px;">Terms & Notes</div>
          <div>${inv.terms || 'Payment is requested via bank details or UPI code above.'}</div>
        </div>
      </div>

      <div class="tpl-totals-block">
        <div class="tpl-totals-row">
          <span>Subtotal:</span>
          <span>${fC(inv.subtotal)}</span>
        </div>
        ${inv.discountValue > 0 ? `
          <div class="tpl-totals-row">
            <span>Discount (${inv.discountType === 'percent' ? inv.discountInput + '%' : 'Flat'}):</span>
            <span>-${fC(inv.discountValue)}</span>
          </div>
        ` : ''}
        <div class="tpl-totals-row">
          <span>Taxes (${inv.taxType}):</span>
          <span>${fC(inv.taxTotal)}</span>
        </div>
        ${inv.previousDue > 0 ? `
          <div class="tpl-totals-row">
            <span>Previous Due:</span>
            <span>${fC(inv.previousDue)}</span>
          </div>
        ` : ''}
        <div class="tpl-totals-row grand-total">
          <span>Grand Total:</span>
          <span>${fC(inv.total)}</span>
        </div>
        <div class="tpl-totals-row">
          <span>Paid Amount:</span>
          <span>${fC(inv.paid)}</span>
        </div>
        <div class="tpl-totals-row balance-due">
          <span>Balance Due:</span>
          <span>${fC(inv.balance)}</span>
        </div>

        <!-- Dual Signature Row: Customer Left, Seller Right -->
        <div class="tpl-dual-sig-row">
          <div class="tpl-sig-col">
            ${inv.customerSignature
              ? `<img src="${inv.customerSignature}" class="tpl-signature-img" alt="Customer Signature">`
              : `<div style="height: 40px; border-bottom: 1.5px solid #9ca3af; width: 130px; margin-bottom: 4px;"></div>`
            }
            <div class="tpl-signature-lbl">${inv.customerSigName || 'Receiving Customer'}</div>
          </div>
          <div class="tpl-sig-col" style="text-align:right;">
            ${sigHtml}
            <div class="tpl-signature-lbl">${inv.seller.issuedBy || 'Authorized Representative'}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Draw UPI Payment QR code in A4 sheet if needed
  if (inv.upi && typeof QRCode !== 'undefined') {
    const qrCanvas = document.getElementById(qrCanvasId);
    if (qrCanvas) {
      // Build standard UPI URL or fallback url
      let qrText = inv.upi;
      if (!inv.upi.includes('://')) {
        // UPI deep link VPA format
        qrText = `upi://pay?pa=${inv.upi}&pn=${encodeURIComponent(inv.seller.name || 'Invoice Payment')}&am=${inv.balance.toFixed(2)}&cu=${inv.currency}`;
      }
      QRCode.drawQRCode(qrText, qrCanvas, 80, 80);
    }
  }
}

// Action: Save Invoice
function saveInvoiceAction() {
  const number = elements['inv-number'].value.trim();
  if (!number) {
    alert('Please enter an invoice number.');
    return;
  }

  // Parse lines
  const lineItems = [];
  const rows = elements['editor-items-list'].querySelectorAll('.item-editor-row');
  rows.forEach(row => {
    const name = row.querySelector('.item-name').value || 'Unlabelled Item';
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    const taxRate = parseFloat(row.querySelector('.item-tax').value) || 0;
    
    lineItems.push({
      name,
      quantity: qty,
      price,
      taxRate,
      subtotal: qty * price
    });
  });

  const discountInput = parseFloat(elements['inv-discount'].value) || 0;
  const discountType = elements['inv-discount-type'].value;
  const subtotal = lineItems.reduce((acc, curr) => acc + curr.subtotal, 0);
  const taxTotal = lineItems.reduce((acc, curr) => acc + (curr.subtotal * (curr.taxRate / 100)), 0);
  let discountVal = discountType === 'percent' ? subtotal * (discountInput / 100) : discountInput;
  const previousDue = parseFloat(elements['inv-previous-due'].value) || 0;
  const total = subtotal - discountVal + taxTotal + previousDue;
  const paid = parseFloat(elements['inv-paid-amount'].value) || 0;
  const balance = total - paid;

  const invoice = {
    id: state.editingInvoiceId || `inv-${Date.now()}`,
    number: number,
    date: elements['inv-date'].value,
    dueDate: elements['inv-due-date'].value,
    currency: elements['inv-currency'].value,
    taxType: elements['inv-tax-type'].value,
    seller: {
      name: elements['seller-name'].value,
      taxId: elements['seller-tax-id'].value,
      phone: elements['seller-phone'].value,
      email: elements['seller-email'].value,
      address: elements['seller-address'].value,
      logo: state.logoDataUri,
      issuedBy: elements['seller-issued-by'] ? elements['seller-issued-by'].value : ''
    },
    buyer: {
      name: elements['buyer-name'].value,
      taxId: elements['buyer-tax-id'].value,
      phone: elements['buyer-phone'].value,
      email: elements['buyer-email'].value,
      address: elements['buyer-address'].value
    },
    items: lineItems,
    subtotal,
    taxTotal,
    discountType,
    discountInput,
    discountValue: discountVal,
    previousDue,
    total,
    paid,
    balance,
    upi: elements['payment-upi-id'].value,
    bankDetails: elements['payment-bank-details'].value,
    terms: elements['inv-terms'].value,
    signature: state.signatureImage,
    optLetterhead: elements['opt-letterhead'] ? elements['opt-letterhead'].checked : false,
    optSingleLineHeader: elements['opt-single-line-header'] ? elements['opt-single-line-header'].checked : false,
    optCompanyNameFs: elements['opt-company-name-fs'] ? elements['opt-company-name-fs'].value : '24',
    optCompanyDetailsFs: elements['opt-company-details-fs'] ? elements['opt-company-details-fs'].value : '11',
    optCompanyNameColor: elements['opt-company-name-color'] ? elements['opt-company-name-color'].value : '#3b82f6'
  };

  // Add or edit
  if (state.editingInvoiceId) {
    const idx = state.invoices.findIndex(inv => inv.id === state.editingInvoiceId);
    if (idx !== -1) {
      state.invoices[idx] = invoice;
    }
  } else {
    // Check if invoice number is duplicate
    const isDuplicate = state.invoices.some(inv => inv.number.toLowerCase() === number.toLowerCase());
    if (isDuplicate) {
      alert(`Warning: Invoice number ${number} already exists! Saving anyway.`);
    }
    state.invoices.push(invoice);
  }

  saveInvoices();
  
  // Auto-save or update buyer details in customer directory
  autoSaveCustomerFromInvoice(invoice.buyer);
  
  // Deduct billed quantities from local stock
  deductInventoryStock(lineItems);

  alert('Invoice saved successfully!');
  state.editingInvoiceId = null;
  navigateToTab('invoices');
}

// Action: Share WhatsApp deep link
function shareWhatsAppAction() {
  const number = elements['inv-number'].value;
  const buyerName = elements['buyer-name'].value || 'Valued Customer';
  const total = parseFloat(elements['inv-paid-amount'].value) + parseFloat(state.profile.taxRate) || 0; // fallback calculation if not updated
  const currency = elements['inv-currency'].value;
  const symbol = getCurrencySymbol(currency);
  const upiId = elements['payment-upi-id'].value;
  
  // Calculate current parameters
  const rows = elements['editor-items-list'].querySelectorAll('.item-editor-row');
  let subtotal = 0;
  let tax = 0;
  rows.forEach(r => {
    const q = parseFloat(r.querySelector('.item-qty').value) || 0;
    const p = parseFloat(r.querySelector('.item-price').value) || 0;
    const t = parseFloat(r.querySelector('.item-tax').value) || 0;
    subtotal += q * p;
    tax += (q * p) * (t / 100);
  });
  
  const discountInput = parseFloat(elements['inv-discount'].value) || 0;
  const discountType = elements['inv-discount-type'].value;
  let discountVal = discountType === 'percent' ? subtotal * (discountInput / 100) : discountInput;
  const previousDue = parseFloat(elements['inv-previous-due'].value) || 0;
  const grandTotal = subtotal - discountVal + tax + previousDue;
  const paid = parseFloat(elements['inv-paid-amount'].value) || 0;
  const balance = grandTotal - paid;

  let message = `Dear *${buyerName}*,\n\n`;
  message += `Here is your invoice *${number}* from *${state.profile.companyName}*.\n\n`;
  message += `*Total Amount:* ${symbol}${grandTotal.toFixed(2)}\n`;
  message += `*Amount Paid:* ${symbol}${paid.toFixed(2)}\n`;
  message += `*Balance Due:* *${symbol}${balance.toFixed(2)}*\n\n`;
  
  if (balance > 0) {
    message += `Please make payment of *${symbol}${balance.toFixed(2)}* at your earliest convenience.\n`;
    if (upiId) {
      message += `UPI ID: ${upiId}\n`;
    }
  } else {
    message += `Thank you for your payment! This invoice is fully paid.\n`;
  }
  
  message += `\nThank you for choosing us!`;
  
  const phone = elements['buyer-phone'].value.replace(/[^0-9+]/g, '');
  const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
  
  window.open(url, '_blank');
}

// Clear Invoice Editor Form
function clearEditorForm() {
  try {
    state.editingInvoiceId = null;
    state.signatureImage = '';
    
    // Reset fields safely
    if (elements['inv-number']) elements['inv-number'].value = '';
    if (elements['buyer-name']) elements['buyer-name'].value = '';
    if (elements['buyer-tax-id']) elements['buyer-tax-id'].value = '';
    if (elements['buyer-phone']) elements['buyer-phone'].value = '';
    if (elements['buyer-email']) elements['buyer-email'].value = '';
    if (elements['buyer-address']) elements['buyer-address'].value = '';
    if (elements['inv-discount']) elements['inv-discount'].value = '0';
    if (elements['inv-paid-amount']) elements['inv-paid-amount'].value = '0';
    if (elements['inv-previous-due']) elements['inv-previous-due'].value = '0';
    if (elements['seller-issued-by']) elements['seller-issued-by'].value = '';
    
    // Reset styling controls
    if (elements['opt-letterhead']) elements['opt-letterhead'].checked = false;
    if (elements['opt-single-line-header']) elements['opt-single-line-header'].checked = false;
    if (elements['opt-company-name-fs']) {
      elements['opt-company-name-fs'].value = '24';
      if (elements['val-company-name-fs']) elements['val-company-name-fs'].textContent = '24px';
    }
    if (elements['opt-company-details-fs']) {
      elements['opt-company-details-fs'].value = '11';
      if (elements['val-company-details-fs']) elements['val-company-details-fs'].textContent = '11px';
    }
    if (elements['opt-company-name-color']) elements['opt-company-name-color'].value = '#3b82f6';
    
    // Clear items safely
    if (elements['editor-items-list']) {
      elements['editor-items-list'].innerHTML = '';
      addItemRow();
    }
    
    // Clear signature pad safely
    if (sigCanvas && sigCtx) {
      sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    }

    // Load defaults safely
    applyProfileDefaultsToEditor();
    recalculateInvoice();
  } catch (err) {
    console.error('Error clearing editor form:', err);
  }
}

// Load and populate fields when editing an invoice
function loadInvoiceToEditor(invoiceId) {
  const inv = state.invoices.find(invoice => invoice.id === invoiceId);
  if (!inv) return;
  
  state.editingInvoiceId = inv.id;
  
  // Setup inputs
  elements['inv-number'].value = inv.number || '';
  elements['inv-date'].value = inv.date || '';
  elements['inv-due-date'].value = inv.dueDate || '';
  elements['inv-currency'].value = inv.currency || 'USD';
  elements['inv-tax-type'].value = inv.taxType || 'GST';
  
  elements['seller-name'].value = inv.seller.name || '';
  elements['seller-tax-id'].value = inv.seller.taxId || '';
  elements['seller-phone'].value = inv.seller.phone || '';
  elements['seller-email'].value = inv.seller.email || '';
  elements['seller-address'].value = inv.seller.address || '';
  
  elements['buyer-name'].value = inv.buyer.name || '';
  elements['buyer-tax-id'].value = inv.buyer.taxId || '';
  elements['buyer-phone'].value = inv.buyer.phone || '';
  elements['buyer-email'].value = inv.buyer.email || '';
  elements['buyer-address'].value = inv.buyer.address || '';
  
  elements['inv-discount'].value = inv.discountInput || '0';
  elements['inv-discount-type'].value = inv.discountType || 'percent';
  elements['inv-paid-amount'].value = inv.paid || '0';
  elements['inv-previous-due'].value = inv.previousDue || '0';
  if (elements['seller-issued-by']) {
    elements['seller-issued-by'].value = inv.seller.issuedBy || '';
  }
  elements['payment-upi-id'].value = inv.upi || '';
  elements['payment-bank-details'].value = inv.bankDetails || '';
  elements['inv-terms'].value = inv.terms || '';

  // Style controls load
  if (elements['opt-letterhead']) {
    elements['opt-letterhead'].checked = inv.optLetterhead || false;
  }
  if (elements['opt-single-line-header']) {
    elements['opt-single-line-header'].checked = inv.optSingleLineHeader || false;
  }
  if (elements['opt-company-name-fs']) {
    elements['opt-company-name-fs'].value = inv.optCompanyNameFs || '24';
    if (elements['val-company-name-fs']) {
      elements['val-company-name-fs'].textContent = (inv.optCompanyNameFs || '24') + 'px';
    }
  }
  if (elements['opt-company-details-fs']) {
    elements['opt-company-details-fs'].value = inv.optCompanyDetailsFs || '11';
    if (elements['val-company-details-fs']) {
      elements['val-company-details-fs'].textContent = (inv.optCompanyDetailsFs || '11') + 'px';
    }
  }
  if (elements['opt-company-name-color']) {
    elements['opt-company-name-color'].value = inv.optCompanyNameColor || '#3b82f6';
  }

  // Logo
  state.logoDataUri = inv.seller.logo || '';
  if (state.logoDataUri) {
    showLogoPreview(state.logoDataUri);
  } else {
    hideLogoPreview();
  }

  // Draw items
  elements['editor-items-list'].innerHTML = '';
  if (inv.items && inv.items.length > 0) {
    inv.items.forEach(item => {
      addItemRow(item);
    });
  } else {
    addItemRow();
  }

  // Load signature pad
  state.signatureImage = inv.signature || '';
  if (state.signatureImage) {
    loadSignatureToPad(state.signatureImage);
  } else if (sigCanvas) {
    sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
  }

  navigateToTab('editor');
  recalculateInvoice();
}

// Render Dashboard (Metrics & Charts)
function renderDashboardView() {
  let billings = 0;
  let collected = 0;
  let due = 0;
  let count = state.invoices.length;
  
  state.invoices.forEach(inv => {
    billings += inv.total || 0;
    collected += inv.paid || 0;
    due += inv.balance || 0;
  });

  const symbol = getCurrencySymbol(state.profile.currency);
  const fC = (val) => `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  elements['kpi-total-billings'].textContent = fC(billings);
  elements['kpi-total-collected'].textContent = fC(collected);
  elements['kpi-total-due'].textContent = fC(due);
  elements['kpi-invoice-count'].textContent = count;

  renderDashboardOutstandingInvoices();
  renderSalesTrendChart();
}

// Renders outstanding payments inside dashboard
function renderDashboardOutstandingInvoices() {
  const container = elements['dashboard-outstanding-list'];
  if (!container) return;

  const symbol = getCurrencySymbol(state.profile.currency);
  const fC = (val) => `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Find invoices with balance > 0
  const outstanding = state.invoices.filter(inv => inv.balance > 0);
  
  if (outstanding.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted py-4">No outstanding invoices. Good job!</td>
      </tr>
    `;
    return;
  }

  // Sort outstanding by due date (closest first)
  outstanding.sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));

  container.innerHTML = outstanding.map(inv => {
    const daysOverdue = Math.ceil((new Date() - new Date(inv.dueDate)) / (1000 * 60 * 60 * 24));
    const overdueLabel = daysOverdue > 0 
      ? `<span class="text-danger">Overdue ${daysOverdue}d</span>` 
      : `<span class="text-muted">Due in ${Math.abs(daysOverdue)}d</span>`;

    return `
      <tr>
        <td><strong>${inv.number}</strong></td>
        <td>${inv.buyer.name}</td>
        <td>${formatDate(inv.dueDate)} <div class="text-xs">${overdueLabel}</div></td>
        <td>${fC(inv.total)}</td>
        <td><strong class="text-warning">${fC(inv.balance)}</strong></td>
        <td>
          <div class="d-flex gap-2">
            <button class="btn btn-secondary btn-sm btn-action-remind" data-id="${inv.id}" title="Send Remind">Remind</button>
            <button class="btn btn-primary btn-sm btn-action-edit" data-id="${inv.id}">Edit</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Bind events
  container.querySelectorAll('.btn-action-remind').forEach(btn => {
    btn.addEventListener('click', () => {
      const invId = btn.getAttribute('data-id');
      sendQuickWhatsAppReminder(invId);
    });
  });
  
  container.querySelectorAll('.btn-action-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const invId = btn.getAttribute('data-id');
      loadInvoiceToEditor(invId);
    });
  });
}

// Action: Quick reminder via WhatsApp
function sendQuickWhatsAppReminder(invoiceId) {
  const inv = state.invoices.find(i => i.id === invoiceId);
  if (!inv) return;
  
  const symbol = getCurrencySymbol(inv.currency);
  let message = `Dear *${inv.buyer.name}*,\n\n`;
  message += `Friendly reminder that payment for invoice *${inv.number}* is outstanding.\n\n`;
  message += `*Total Amount:* ${symbol}${inv.total.toFixed(2)}\n`;
  message += `*Outstanding Balance:* *${symbol}${inv.balance.toFixed(2)}*\n`;
  message += `*Due Date:* ${formatDate(inv.dueDate)}\n\n`;
  
  if (inv.upi) {
    message += `You can transfer via UPI using VPA: *${inv.upi}*\n`;
  }
  if (inv.bankDetails) {
    message += `Or Bank transfer: ${inv.bankDetails}\n`;
  }
  
  message += `\nThank you for your business!`;
  
  const phone = inv.buyer.phone.replace(/[^0-9+]/g, '');
  const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

// Renders dynamic SVG Sales chart
function renderSalesTrendChart() {
  const svg = elements['sales-chart'];
  if (!svg) return;

  const width = 500;
  const height = 200;
  const paddingLeft = 45;
  const paddingBottom = 25;
  const paddingRight = 15;
  const paddingTop = 15;
  
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  // Retrieve last 7 days keys
  const dateKeys = [];
  const dateLabels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    dateKeys.push(key);
    // Display as Jun 25
    dateLabels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
  }

  // Sum invoices per day
  const salesData = dateKeys.map(key => {
    let dayTotal = 0;
    state.invoices.forEach(inv => {
      if (inv.date === key) {
        dayTotal += inv.total || 0;
      }
    });
    return dayTotal;
  });

  // Calculate scales
  const maxSale = Math.max(...salesData, 100); // minimum scale ceiling
  const yMax = Math.ceil(maxSale / 100) * 100;

  // Generate grid SVG lines
  let gridHtml = `
    <defs>
      <linearGradient id="chart-gradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#3b82f6" />
        <stop offset="100%" stop-color="#8b5cf6" />
      </linearGradient>
      <linearGradient id="chart-bg-gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.4" />
        <stop offset="100%" stop-color="#3b82f6" stop-opacity="0" />
      </linearGradient>
    </defs>
  `;

  // Draw Y Axis grid lines (4 ticks)
  for (let i = 0; i <= 3; i++) {
    const yVal = (yMax / 3) * i;
    const yPos = paddingTop + chartH - (chartH * (yVal / yMax));
    
    // Grid line
    gridHtml += `<line x1="${paddingLeft}" y1="${yPos}" x2="${width - paddingRight}" y2="${yPos}" class="chart-grid-line" />`;
    
    // Label
    const symbol = getCurrencySymbol(state.profile.currency);
    gridHtml += `<text x="${paddingLeft - 8}" y="${yPos + 3}" text-anchor="end" class="chart-axis-text">${symbol}${Math.round(yVal)}</text>`;
  }

  // Draw X axis and plots
  const stepX = chartW / 6;
  const points = [];
  
  salesData.forEach((val, i) => {
    const x = paddingLeft + (i * stepX);
    const y = paddingTop + chartH - (chartH * (val / yMax));
    points.push({ x, y, val });
    
    // X label
    gridHtml += `<text x="${x}" y="${height - 6}" text-anchor="middle" class="chart-axis-text">${dateLabels[i]}</text>`;
  });

  // Line & Area path strings
  let pathStr = '';
  let areaStr = `M ${points[0].x} ${paddingTop + chartH} `;
  
  points.forEach((pt, i) => {
    if (i === 0) {
      pathStr += `M ${pt.x} ${pt.y} `;
      areaStr += `L ${pt.x} ${pt.y} `;
    } else {
      pathStr += `L ${pt.x} ${pt.y} `;
      areaStr += `L ${pt.x} ${pt.y} `;
    }
  });
  
  areaStr += `L ${points[points.length - 1].x} ${paddingTop + chartH} Z`;

  // Draw area & line paths
  gridHtml += `<path d="${areaStr}" class="chart-area" />`;
  gridHtml += `<path d="${pathStr}" class="chart-line" />`;

  // Draw dots
  points.forEach(pt => {
    gridHtml += `<circle cx="${pt.x}" cy="${pt.y}" r="4" class="chart-point" data-val="${pt.val}" />`;
  });

  svg.innerHTML = gridHtml;
}

// Render Invoices List Registry
function renderInvoicesListTable() {
  const tbody = elements['invoices-table-body'];
  if (!tbody) return;

  const search = elements['invoices-search'].value.toLowerCase();
  const filter = elements['invoices-filter-status'].value;
  const symbol = getCurrencySymbol(state.profile.currency);
  const fC = (val) => `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const filtered = state.invoices.filter(inv => {
    // Search
    const numMatch = inv.number.toLowerCase().includes(search);
    const nameMatch = inv.buyer.name.toLowerCase().includes(search);
    const matchesSearch = numMatch || nameMatch;
    
    // Filter
    if (filter === 'paid') {
      return matchesSearch && inv.balance <= 0;
    } else if (filter === 'pending') {
      return matchesSearch && inv.balance > 0;
    }
    return matchesSearch;
  });

  // Sort by date desc (newest first)
  filtered.sort((a,b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-4">No matching invoices found.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(inv => {
    const isPaid = inv.balance <= 0;
    const badge = isPaid 
      ? `<span class="status-badge paid">Paid</span>` 
      : `<span class="status-badge pending">Pending</span>`;

    return `
      <tr>
        <td><strong>${inv.number}</strong></td>
        <td>${formatDate(inv.date)}</td>
        <td>${inv.buyer.name || 'Unsaved'}</td>
        <td>${fC(inv.total)}</td>
        <td><span class="${inv.balance > 0 ? 'text-warning' : ''}">${fC(inv.balance)}</span></td>
        <td>${badge}</td>
        <td>
          <div class="d-flex gap-2">
            ${!isPaid ? `<button class="btn btn-success btn-sm btn-tbl-pay" data-id="${inv.id}">Mark Paid</button>` : ''}
            <button class="btn btn-secondary btn-sm btn-tbl-edit" data-id="${inv.id}">Edit</button>
            <button class="btn btn-danger btn-sm btn-tbl-del" data-id="${inv.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Bind Actions
  tbody.querySelectorAll('.btn-tbl-pay').forEach(btn => {
    btn.addEventListener('click', () => {
      const invId = btn.getAttribute('data-id');
      markInvoiceAsPaid(invId);
    });
  });
  
  tbody.querySelectorAll('.btn-tbl-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const invId = btn.getAttribute('data-id');
      loadInvoiceToEditor(invId);
    });
  });

  tbody.querySelectorAll('.btn-tbl-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const invId = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to permanently delete this invoice?')) {
        deleteInvoice(invId);
      }
    });
  });
}

function markInvoiceAsPaid(invoiceId) {
  const inv = state.invoices.find(i => i.id === invoiceId);
  if (inv) {
    inv.paid = inv.total;
    inv.balance = 0;
    saveInvoices();
    renderInvoicesListTable();
  }
}

function deleteInvoice(invoiceId) {
  state.invoices = state.invoices.filter(i => i.id !== invoiceId);
  saveInvoices();
  renderInvoicesListTable();
}

// Build Customer Registry from invoices (used for migration on first load)
function buildCustomersDirectoryFromInvoices() {
  const custMap = {};
  
  state.invoices.forEach(inv => {
    const name = inv.buyer.name;
    if (!name) return;
    
    const key = name.trim().toLowerCase();
    if (!custMap[key]) {
      custMap[key] = {
        id: `cust-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: inv.buyer.name,
        taxId: inv.buyer.taxId || '',
        phone: inv.buyer.phone || '',
        email: inv.buyer.email || '',
        address: inv.buyer.address || ''
      };
    } else {
      if (inv.buyer.phone) custMap[key].phone = inv.buyer.phone;
      if (inv.buyer.email) custMap[key].email = inv.buyer.email;
      if (inv.buyer.address) custMap[key].address = inv.buyer.address;
      if (inv.buyer.taxId) custMap[key].taxId = inv.buyer.taxId;
    }
  });

  state.customers = Object.values(custMap);
}

// Populate customer selector dropdown in editor
function populateCustomersDropdown() {
  const select = elements['editor-customer-select'];
  if (!select) return;

  select.innerHTML = '<option value="">-- Load Saved Customer --</option>' + 
    state.customers.map((c, i) => `<option value="${i}">${c.name} (${c.phone || c.email || 'No Contacts'})</option>`).join('');
}

// Render Customers List Directory with Live Dynamic Financial Stats
function renderCustomersListTable() {
  const tbody = elements['customers-table-body'];
  if (!tbody) return;

  const search = elements['customers-search'] ? elements['customers-search'].value.toLowerCase().trim() : '';
  const symbol = getCurrencySymbol(state.profile.currency);
  const fC = (val) => `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const filtered = state.customers.filter(c => 
    c.name.toLowerCase().includes(search) || 
    (c.phone && c.phone.toLowerCase().includes(search)) || 
    (c.email && c.email.toLowerCase().includes(search)) || 
    (c.taxId && c.taxId.toLowerCase().includes(search))
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted py-4">No matching customers found.</td>
      </tr>
    `;
    return;
  }

  filtered.sort((a, b) => a.name.localeCompare(b.name));

  tbody.innerHTML = filtered.map(cust => {
    // Calculate live dynamic financial stats from invoices
    let invoiceCount = 0;
    let totalBilled = 0;
    let balanceOutstanding = 0;
    
    const key = cust.name.trim().toLowerCase();
    state.invoices.forEach(inv => {
      if (inv.buyer && inv.buyer.name && inv.buyer.name.trim().toLowerCase() === key) {
        invoiceCount++;
        totalBilled += inv.total || 0;
        balanceOutstanding += inv.balance || 0;
      }
    });

    return `
      <tr>
        <td><strong>${cust.name}</strong><br><small class="text-muted">${cust.taxId ? 'Tax ID: ' + cust.taxId : ''}</small></td>
        <td>
          <div class="text-sm">${cust.phone || ''}</div>
          <div class="text-xs text-muted">${cust.email || ''}</div>
        </td>
        <td>${invoiceCount}</td>
        <td>${fC(totalBilled)}</td>
        <td><span class="${balanceOutstanding > 0 ? 'text-warning font-semibold' : ''}">${fC(balanceOutstanding)}</span></td>
        <td>
          <div class="d-flex gap-2">
            <button class="btn btn-secondary btn-sm btn-cust-edit" data-id="${cust.id}">Edit</button>
            <button class="btn btn-danger btn-sm btn-cust-del" data-id="${cust.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Bind actions
  tbody.querySelectorAll('.btn-cust-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      loadCustomerToForm(id);
    });
  });
  
  tbody.querySelectorAll('.btn-cust-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to permanently delete this customer?')) {
        deleteCustomer(id);
      }
    });
  });
}

// Load customer details into form
function loadCustomerToForm(id) {
  const cust = state.customers.find(c => c.id === id);
  if (!cust) return;
  
  elements['cust-id'].value = cust.id;
  elements['cust-name'].value = cust.name || '';
  elements['cust-tax-id'].value = cust.taxId || '';
  elements['cust-phone'].value = cust.phone || '';
  elements['cust-email'].value = cust.email || '';
  elements['cust-address'].value = cust.address || '';
}

// Delete customer
function deleteCustomer(id) {
  state.customers = state.customers.filter(c => c.id !== id);
  localStorage.setItem('invoice_maker_customers', JSON.stringify(state.customers));
  renderCustomersListTable();
  populateCustomersDropdown();
  if (elements['cust-id'].value === id) {
    clearCustomerForm();
  }
}

// Clear customer form
function clearCustomerForm() {
  elements['cust-id'].value = '';
  elements['cust-name'].value = '';
  elements['cust-tax-id'].value = '';
  elements['cust-phone'].value = '';
  elements['cust-email'].value = '';
  elements['cust-address'].value = '';
}

// Save customer (Add/Edit)
function saveCustomerAction() {
  const name = elements['cust-name'].value.trim();
  const taxId = elements['cust-tax-id'].value.trim();
  const phone = elements['cust-phone'].value.trim();
  const email = elements['cust-email'].value.trim();
  const address = elements['cust-address'].value.trim();
  const id = elements['cust-id'].value;
  
  if (!name) {
    alert('Please enter the Customer Name.');
    return;
  }
  
  const customer = {
    id: id || `cust-${Date.now()}`,
    name,
    taxId,
    phone,
    email,
    address
  };
  
  if (id) {
    const idx = state.customers.findIndex(c => c.id === id);
    if (idx !== -1) {
      state.customers[idx] = customer;
    }
  } else {
    // Check for duplicate name
    const isDuplicate = state.customers.some(c => c.name.toLowerCase() === name.toLowerCase());
    if (isDuplicate) {
      alert(`Warning: A customer with the name "${name}" already exists!`);
      return;
    }
    state.customers.push(customer);
  }
  
  localStorage.setItem('invoice_maker_customers', JSON.stringify(state.customers));
  alert('Customer saved successfully!');
  clearCustomerForm();
  renderCustomersListTable();
  populateCustomersDropdown();
}

// Auto-save customer details from invoice
function autoSaveCustomerFromInvoice(buyer) {
  try {
    if (!buyer.name || !buyer.name.trim()) return;
    const name = buyer.name.trim();
    const key = name.toLowerCase();
    
    // Find customer by name
    const existing = state.customers.find(c => c.name.trim().toLowerCase() === key);
    
    if (existing) {
      if (buyer.taxId) existing.taxId = buyer.taxId.trim();
      if (buyer.phone) existing.phone = buyer.phone.trim();
      if (buyer.email) existing.email = buyer.email.trim();
      if (buyer.address) existing.address = buyer.address.trim();
    } else {
      const newCust = {
        id: `cust-${Date.now()}`,
        name: name,
        taxId: (buyer.taxId || '').trim(),
        phone: (buyer.phone || '').trim(),
        email: (buyer.email || '').trim(),
        address: (buyer.address || '').trim()
      };
      state.customers.push(newCust);
    }
    
    localStorage.setItem('invoice_maker_customers', JSON.stringify(state.customers));
    populateCustomersDropdown();
    if (state.activeTab === 'customers') {
      renderCustomersListTable();
    }
  } catch (err) {
    console.error('Error auto-saving customer:', err);
  }
}

// Database Export/Import Tools
function exportDatabaseJSON() {
  try {
    const db = {
      invoices: state.invoices,
      profile: state.profile,
      inventory: state.inventory,
      customers: state.customers
    };
    
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-maker-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('Failed to export backup: ' + e.message);
  }
}

function importDatabaseJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (!data.invoices || !data.profile) {
        throw new Error('Invalid database backup format. Key objects missing.');
      }
      
      if (confirm('Importing will merge with or overwrite settings. Proceed?')) {
        state.invoices = data.invoices;
        state.profile = data.profile;
        state.inventory = data.inventory || [];
        state.customers = data.customers || [];
        
        // Save
        localStorage.setItem('invoice_maker_invoices', JSON.stringify(state.invoices));
        localStorage.setItem('invoice_maker_profile', JSON.stringify(state.profile));
        localStorage.setItem('invoice_maker_inventory', JSON.stringify(state.inventory));
        localStorage.setItem('invoice_maker_customers', JSON.stringify(state.customers));
        
        // Refresh app state
        loadData();
        loadProfileToSettingsForm();
        applyProfileDefaultsToEditor();
        navigateToTab('dashboard');
        
        alert('Database restored successfully!');
      }
    } catch (err) {
      alert('Failed to restore backup: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function clearEntireDatabase() {
  if (confirm('CRITICAL WARNING: This will permanently delete ALL invoice data and configuration profiles. This cannot be undone. Are you absolutely sure?')) {
    localStorage.clear();
    location.reload();
  }
}

// General Date formatting helper
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function getCurrencySymbol(currencyCode) {
  const symbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'INR': '₹',
    'PKR': 'Rs',
    'AED': 'د.إ',
    'SAR': 'ر.س',
    'SGD': 'S$',
    'AUD': 'A$',
    'CAD': 'C$'
  };
  return symbols[currencyCode] || currencyCode || '$';
}

// Fit preview sheet to container using CSS zoom dynamically
// Bind resize listener
window.addEventListener('resize', fitPreviewSheet);

function fitPreviewSheet() {
  const target = elements['invoice-render-target'];
  if (!target) return;
  const container = target.parentElement;
  if (!container) return;
  
  const padding = 24;
  const availableW = container.clientWidth - padding;
  const sheetW = 794;
  
  if (availableW < sheetW) {
    target.style.zoom = availableW / sheetW;
  } else {
    target.style.zoom = 1;
  }
}


/* ==========================================
   ADVANCED EXTENSIONS LOGIC HELPERS
   ========================================== */

// 1. PIN Lock Screen Keypad Initialization
function initLockScreenKeypad() {
  pinAttempt = '';
  updatePinDots();
  
  if (elements['lock-error-msg']) {
    elements['lock-error-msg'].textContent = '';
  }
  
  // Re-bind numeric keys to avoid double events
  document.querySelectorAll('.keypad-btn[data-val]').forEach(btn => {
    const cloned = btn.cloneNode(true);
    btn.replaceWith(cloned);
  });
  
  document.querySelectorAll('.keypad-btn[data-val]').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-val');
      if (pinAttempt.length < 4) {
        pinAttempt += val;
        updatePinDots();
        
        if (pinAttempt.length === 4) {
          setTimeout(verifyPasscode, 150);
        }
      }
    });
  });
  
  // Keypad CLR button
  const clearBtn = document.getElementById('btn-keypad-clear');
  if (clearBtn) {
    const clonedClear = clearBtn.cloneNode(true);
    clearBtn.replaceWith(clonedClear);
    document.getElementById('btn-keypad-clear').addEventListener('click', () => {
      pinAttempt = '';
      updatePinDots();
      if (elements['lock-error-msg']) elements['lock-error-msg'].textContent = '';
    });
  }
  
  // Keypad DEL button
  const deleteBtn = document.getElementById('btn-keypad-delete');
  if (deleteBtn) {
    const clonedDelete = deleteBtn.cloneNode(true);
    deleteBtn.replaceWith(clonedDelete);
    document.getElementById('btn-keypad-delete').addEventListener('click', () => {
      if (pinAttempt.length > 0) {
        pinAttempt = pinAttempt.slice(0, -1);
        updatePinDots();
        if (elements['lock-error-msg']) elements['lock-error-msg'].textContent = '';
      }
    });
  }
}

// Highlights indicator dots based on PIN progress
function updatePinDots() {
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById(`pin-dot-${i}`);
    if (dot) {
      if (i <= pinAttempt.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    }
  }
}

// Verifies Lock Screen passcode attempts
function verifyPasscode() {
  const correctPin = state.profile.passcode.pin || '';
  if (pinAttempt === correctPin) {
    // Unlocked successfully
    if (elements['lock-screen']) {
      elements['lock-screen'].classList.add('d-none');
    }
    pinAttempt = '';
  } else {
    // Shake animation and warning
    const lockCard = document.querySelector('.lock-card');
    if (lockCard) {
      lockCard.classList.add('shake');
      setTimeout(() => lockCard.classList.remove('shake'), 400);
    }
    
    if (elements['lock-error-msg']) {
      elements['lock-error-msg'].textContent = 'Incorrect PIN! Please try again.';
    }
    
    pinAttempt = '';
    updatePinDots();
  }
}

// 2. Save Passcode Settings Config
function saveSecurityPINConfig() {
  const enabled = elements['settings-passcode-enabled'].value === 'true';
  const pin = elements['settings-passcode-pin'].value.trim();
  
  if (enabled) {
    if (pin.length !== 4 || isNaN(pin)) {
      alert('Error: Passcode PIN must be exactly 4 digits!');
      return;
    }
  }
  
  state.profile.passcode = {
    enabled: enabled,
    pin: pin
  };
  
  localStorage.setItem('invoice_maker_profile', JSON.stringify(state.profile));
  alert('Security settings saved successfully!');
  
  // If passcode is activated, require immediate entry to verify
  if (enabled && pin) {
    location.reload();
  }
}

// 3. Render Inventory List Table
function renderInventoryTable() {
  const tbody = elements['inventory-table-body'];
  if (!tbody) return;
  
  const search = elements['inventory-search'].value.toLowerCase().trim();
  const filtered = state.inventory.filter(p => 
    p.name.toLowerCase().includes(search) || 
    p.sku.toLowerCase().includes(search)
  );
  
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted py-4">No matching products found.</td>
      </tr>
    `;
    return;
  }
  
  filtered.sort((a, b) => a.name.localeCompare(b.name));
  
  tbody.innerHTML = filtered.map(p => {
    const stockVal = parseFloat(p.stock) || 0;
    let badgeClass = 'stock-badge in-stock';
    let statusLabel = 'In Stock';
    
    if (stockVal === 0) {
      badgeClass = 'stock-badge out-of-stock';
      statusLabel = 'Out of Stock';
    } else if (stockVal <= 10) {
      badgeClass = 'stock-badge low-stock';
      statusLabel = `Low Stock (${Math.round(stockVal)})`;
    } else {
      statusLabel = `In Stock (${Math.round(stockVal)})`;
    }
    
    return `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td><code class="text-muted text-xs">${p.sku}</code></td>
        <td>$${p.price.toFixed(2)}</td>
        <td>${p.stock}</td>
        <td><span class="${badgeClass}">${statusLabel}</span></td>
        <td>
          <div class="d-flex gap-2">
            <button class="btn btn-secondary btn-sm btn-prod-edit" data-id="${p.id}">Edit</button>
            <button class="btn btn-danger btn-sm btn-prod-del" data-id="${p.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  // Bind actions
  tbody.querySelectorAll('.btn-prod-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const prodId = btn.getAttribute('data-id');
      loadProductToForm(prodId);
    });
  });
  
  tbody.querySelectorAll('.btn-prod-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const prodId = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to permanently delete this product?')) {
        deleteProduct(prodId);
      }
    });
  });
}

function loadProductToForm(id) {
  const p = state.inventory.find(item => item.id === id);
  if (!p) return;
  
  elements['prod-id'].value = p.id;
  elements['prod-name'].value = p.name || '';
  elements['prod-sku'].value = p.sku || '';
  elements['prod-price'].value = p.price || 0;
  elements['prod-stock'].value = p.stock || 0;
  elements['prod-tax'].value = p.tax !== undefined ? p.tax : 18;
}

function deleteProduct(id) {
  state.inventory = state.inventory.filter(p => p.id !== id);
  localStorage.setItem('invoice_maker_inventory', JSON.stringify(state.inventory));
  renderInventoryTable();
  if (elements['prod-id'].value === id) {
    clearProductForm();
  }
}

// 4. Save Product/Stock Action
function saveProductAction() {
  const name = elements['prod-name'].value.trim();
  const sku = elements['prod-sku'].value.trim().toUpperCase();
  const price = parseFloat(elements['prod-price'].value) || 0;
  const stock = parseFloat(elements['prod-stock'].value) || 0;
  const tax = parseFloat(elements['prod-tax'].value) || 0;
  const id = elements['prod-id'].value;
  
  if (!name || !sku) {
    alert('Please enter both Product Name and SKU Code.');
    return;
  }
  
  const product = {
    id: id || `prod-${Date.now()}`,
    name,
    sku,
    price,
    stock,
    tax
  };
  
  if (id) {
    const idx = state.inventory.findIndex(p => p.id === id);
    if (idx !== -1) {
      state.inventory[idx] = product;
    }
  } else {
    const isDuplicate = state.inventory.some(p => p.sku === sku);
    if (isDuplicate) {
      alert(`Warning: Product SKU ${sku} already exists in inventory!`);
      return;
    }
    state.inventory.push(product);
  }
  
  localStorage.setItem('invoice_maker_inventory', JSON.stringify(state.inventory));
  alert('Product saved successfully!');
  clearProductForm();
  renderInventoryTable();
}

function clearProductForm() {
  elements['prod-id'].value = '';
  elements['prod-name'].value = '';
  elements['prod-sku'].value = '';
  elements['prod-price'].value = '0.00';
  elements['prod-stock'].value = '10';
  elements['prod-tax'].value = '18';
}

// 5. Automatic stock level deduction
function deductInventoryStock(invoiceItems) {
  try {
    let updated = false;
    invoiceItems.forEach(item => {
      const name = item.name.trim().toLowerCase();
      // Match by product name
      const prod = state.inventory.find(p => p.name.trim().toLowerCase() === name);
      if (prod) {
        const billedQty = parseFloat(item.quantity) || 0;
        prod.stock = Math.max(0, prod.stock - billedQty);
        updated = true;
      }
    });
    
    if (updated) {
      localStorage.setItem('invoice_maker_inventory', JSON.stringify(state.inventory));
      if (state.activeTab === 'inventory') {
        renderInventoryTable();
      }
    }
  } catch (err) {
    console.error('Error deducting stock levels:', err);
  }
}


