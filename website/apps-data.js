/* [website] [tenant: FrontStores.com]
   Single source of truth for the public app catalogue.
   Every business type FrontStores offers lives here as one object.
   solutions.html (catalogue + search) and app.html (detail page) both read this.
   To add a new business type later: add one object below — nothing else to touch. */

// ── Reusable feature groups (cross-cutting, shared by most apps) ──
const F = {
  gst: {
    group: 'Billing, GST & Tax',
    items: [
      'GST / non-GST invoices — auto CGST + SGST / IGST split',
      'Bill of Supply mode for shops without GST',
      'Thermal (58/80mm) + A4 / A5 printing',
      'Hold, split and part-payment bills',
      'Daily / monthly GST summary ready for your CA',
    ],
  },
  khata: {
    group: 'Khata / Credit Ledger',
    items: [
      'Customer-wise credit (udhaar) tracking',
      'Record part payments, see running balance',
      'WhatsApp / SMS payment reminders',
      'Outstanding-dues report by customer',
    ],
  },
  reports: {
    group: 'Reports & Analytics',
    items: [
      'Daily, weekly, monthly sales dashboards',
      'Best-sellers, dead stock and profit margins',
      'Customer & supplier statements',
      'One-click CSV / Excel export',
    ],
  },
  data: {
    group: 'Your Data & Security',
    items: [
      'Works 100% offline — your data never leaves your machine',
      'Optional encrypted cloud sync across branches',
      'Automatic local backups + one-click restore',
      'Full audit trail of every change',
      'Role-based staff logins & permissions',
    ],
  },
};

// helper to keep delivery text consistent
const DESKTOP = 'Downloadable desktop app for Windows & Mac. Installs in minutes, runs fully offline. Optional encrypted cloud sync if you want access from anywhere.';
const DESKTOP_WEB = 'Available as a Windows & Mac desktop app (offline-first) AND a cloud web app you open from any browser — your choice.';

const APPS = [
  /* ───────────────────────── RETAIL ───────────────────────── */
  {
    id: 'medical', name: 'Medical Store / Pharmacy', icon: '💊', category: 'Retail',
    color: 'cyan', tagline: 'Billing, batch & expiry management built for Indian pharmacies.',
    platforms: ['Windows', 'Mac'], delivery: DESKTOP,
    who: 'Chemists, medical stores and pharmacies that need fast counter billing with strict batch, expiry and GST control.',
    features: [
      { group: 'Pharmacy Billing', items: [
        'Lightning-fast counter billing with barcode scan',
        'Salt / generic search + brand suggestions',
        'GSTIN, HSN, CGST + SGST and drug schedule on every invoice',
        'Doctor & prescription details captured on the bill',
        'Strip / box / loose unit pricing',
      ]},
      { group: 'Batch & Expiry Control', items: [
        'Batch-wise stock with expiry dates',
        'Near-expiry alerts on launch (configurable days)',
        'Expiry report with supplier for easy returns',
        'FEFO (first-expiry-first-out) billing',
        'Supplier-wise purchase & return tracking',
      ]},
      F.khata, F.reports, F.data,
    ],
  },
  {
    id: 'hardware', name: 'Hardware Store', icon: '🔧', category: 'Retail',
    color: 'amber', tagline: 'Built for paints, tools, plumbing & electrical — units, brands and credit.',
    platforms: ['Windows', 'Mac'], delivery: DESKTOP,
    who: 'Hardware, paint, sanitary, electrical and building-material shops.',
    features: [
      { group: 'Hardware Billing', items: [
        'Sell by piece, box, metre, kg or set',
        'Brand + model + size variants per item',
        'Quotations / estimates that convert to bills',
        'Bulk / contractor wholesale pricing',
      ]},
      { group: 'Inventory', items: [
        'Multi-unit stock (piece ↔ box)',
        'Brand & category-wise catalogue',
        'Low-stock reorder alerts',
        'Supplier price comparison',
      ]},
      F.khata, F.gst, F.reports, F.data,
    ],
  },

  /* ─────────────────── FOOD & HOSPITALITY ─────────────────── */
  {
    id: 'restaurant', name: 'Restaurant / Café', icon: '🍽️', category: 'Food & Hospitality',
    color: 'coral', tagline: 'Table KOT, dine-in / takeaway / delivery, menu & kitchen — all live.',
    platforms: ['Windows', 'Mac'], delivery: DESKTOP,
    who: 'Restaurants, cafés, dhabas and cloud kitchens needing table, KOT and menu control.',
    features: [
      { group: 'Orders & Tables', items: [
        'Dine-in tables, takeaway & delivery modes',
        'KOT printing straight to the kitchen',
        'Split / merge bills, table transfers',
        'Running tabs & captain ordering',
      ]},
      { group: 'Menu & Kitchen', items: [
        'Menu with categories, variants & add-ons',
        'Recipe & raw-material consumption',
        'Item-wise sales & best-seller report',
        'Wastage & stock-out tracking',
      ]},
      F.gst, F.reports, F.data,
    ],
  },

  /* ───────────────────────── SERVICES ─────────────────────── */
  {
    id: 'carwash', name: 'Car Wash / Detailing', icon: '🚗', category: 'Services',
    color: 'cyan', tagline: 'Vehicle service tickets, packages, memberships and bay scheduling.',
    platforms: ['Windows', 'Mac'], delivery: DESKTOP,
    who: 'Car wash, detailing and auto-spa centres with service packages & memberships.',
    features: [
      { group: 'Service Tickets', items: [
        'Vehicle entry by number plate & type',
        'Service packages (wash, polish, detailing)',
        'Bay / staff assignment & status',
        'SMS / WhatsApp “your car is ready”',
      ]},
      { group: 'Memberships & Loyalty', items: [
        'Prepaid wash packages & memberships',
        'Visit history per vehicle / customer',
        'Loyalty points & discounts',
        'Recurring-customer reminders',
      ]},
      F.gst, F.reports, F.data,
    ],
  },

  /* ───────────────────────── HEALTH ───────────────────────── */

  /* ─────────────────────── PROFESSIONAL ───────────────────── */

  /* ───────────────────────── EDUCATION ────────────────────── */

  /* ───────────────────────── FITNESS ──────────────────────── */

  /* ──────────────────────── REAL ESTATE ───────────────────── */
];

// Categories in display order
const CATEGORIES = ['Retail', 'Food & Hospitality', 'Services'];

// Map colour name → hex (matches index.html spectrum)
const COLORS = {
  cyan: '#06d6f9', violet: '#8b5cf6', magenta: '#ff3d9a',
  coral: '#ff5e62', amber: '#ffb73d', mint: '#2dd4a8',
};

if (typeof window !== 'undefined') { window.APPS = APPS; window.CATEGORIES = CATEGORIES; window.COLORS = COLORS; }
