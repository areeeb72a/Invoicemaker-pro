document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  const btnOpenDashboard = document.getElementById('btn-open-dashboard');
  const btnCreateInvoice = document.getElementById('btn-create-invoice');

  const openApp = (hash = '') => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: chrome.runtime.getURL('index.html' + hash) });
    } else {
      window.open('index.html' + hash, '_blank');
    }
  };

  btnOpenDashboard.addEventListener('click', () => openApp());
  btnCreateInvoice.addEventListener('click', () => openApp('#new-invoice'));

  // Load stats from LocalStorage
  loadStats();
});

function loadStats() {
  try {
    const rawInvoices = localStorage.getItem('invoice_maker_invoices');
    const invoices = rawInvoices ? JSON.parse(rawInvoices) : [];
    
    // Sum stats
    let totalSales = 0;
    let outstanding = 0;
    let count = invoices.length;

    invoices.forEach(inv => {
      const total = parseFloat(inv.total) || 0;
      const paid = parseFloat(inv.paid) || 0;
      const balance = parseFloat(inv.balance) || 0;
      
      totalSales += total;
      outstanding += balance;
    });

    // Detect currency symbol (default to $ but look at profile if available)
    let currencySymbol = '$';
    const rawProfile = localStorage.getItem('invoice_maker_profile');
    if (rawProfile) {
      const profile = JSON.parse(rawProfile);
      if (profile.currency) {
        currencySymbol = getCurrencySymbol(profile.currency);
      }
    }

    // Update UI
    document.getElementById('stat-total-sales').textContent = formatCurrency(totalSales, currencySymbol);
    document.getElementById('stat-invoice-count').textContent = count;
    document.getElementById('stat-pending-amount').textContent = formatCurrency(outstanding, currencySymbol);
  } catch (e) {
    console.error('Error loading stats in popup:', e);
  }
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

function formatCurrency(amount, symbol) {
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
