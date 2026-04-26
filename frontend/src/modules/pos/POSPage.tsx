import { useState, useRef, useCallback, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Trash2, Plus, Minus, IndianRupee, UserPlus, X, CheckCircle, Download, MessageCircle } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useCartStore } from '@/app/store/cart.store';
import type { CartItem } from '@/app/store/cart.store';
import { useAuthStore } from '@/app/store/auth.store';
import { isMedicalShopType, useActiveShopType } from '@/lib/shop/shopType';

type PaymentMethod = 'cash' | 'upi' | 'card' | 'credit';

type InvoiceSnapshot = {
  billNumber: string;
  createdAt: string;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  patientName: string;
  doctorName: string;
  customerName: string;
  customerPhone: string;
  items: Array<{
    name: string;
    batchNo?: string;
    manufactureDate?: string;
    expiry?: string;
    quantityLabel: string;
    amount: number;
    gstRate: number;
    discountAmount: number;
  }>;
  subtotal: number;
  gstAmount: number;
  totalDiscount: number;
  total: number;
  // template fields captured at order-time so print/share don't depend on live query state
  dlNumbers: string;
  storeName: string;
  storeAddress: string;
  headerLeft: string;
  headerRight: string;
  whatsappNumber: string;
  footerNote: string;
  signatureLabel: string;
};

type CartPanelStore = {
  items: CartItem[];
  customerId: string | null;
  customerName: string | null;
  clearCart: () => void;
  removeItem: (itemKey: string) => void;
  toggleLoose: (itemKey: string, enabled: boolean) => void;
  updateQty: (itemKey: string, quantity: number) => void;
  updateLooseQty: (itemKey: string, looseQty: number) => void;
  setDiscountPercent: (itemKey: string, discountPercent: number) => void;
  setCustomer: (id: string, name: string, phone?: string | null) => void;
  subtotal: () => number;
  taxAmount: () => number;
  total: () => number;
  itemCount: () => number;
};

type HeldCart = {
  id: string;
  createdAt: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  items: CartItem[];
};

const HELD_CARTS_STORAGE_KEY = 'shoposphere-held-carts';

export function POSPage() {
  const [search, setSearch] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [customerPhone, setCustomerPhone] = useState('');
  const [creditCustomerSearch, setCreditCustomerSearch] = useState('');
  const [loyaltyPointsRedeemed, setLoyaltyPointsRedeemed] = useState('0');
  const [patientName, setPatientName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [invoiceSnapshot, setInvoiceSnapshot] = useState<InvoiceSnapshot | null>(null);
  const [isSendingInvoiceWhatsapp, setIsSendingInvoiceWhatsapp] = useState(false);
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>(() => readHeldCarts());
  const [predefinedCustomerId, setPredefinedCustomerId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const invoiceSheetRef = useRef<HTMLDivElement>(null);

  const shopId = useAuthStore((s) => s.activeShopId);
  const activeShopType = useActiveShopType();
  const isMedicalStore = isMedicalShopType(activeShopType);
  const queryClient = useQueryClient();
  const cart = useCartStore();
  const activeShop = useAuthStore((s) => s.shops.find((shop) => shop.id === s.activeShopId) ?? null);
  const trimmedSearch = search.trim();
  const showingSearchResults = trimmedSearch.length > 0;

  const { data: settingsContext } = useQuery({
    queryKey: ['settings-context-pos'],
    queryFn: () => apiClient.get('/api/core/context/settings').then((r) => r.data.data),
    enabled: !!shopId,
  });

  const invoiceTemplate = settingsContext?.shop?.settings?.invoiceTemplate ?? {};
  const shopAddress = settingsContext?.shop?.address ?? {};

  const { data: popularProducts, isFetching: isFetchingPopular } = useQuery({
    queryKey: ['pos-top-products', shopId],
    queryFn: () =>
      apiClient
        .get(`/api/reports/reports/sales/top-products?shopId=${shopId}&days=180&limit=50`)
        .then((r) => r.data.data),
    enabled: !!shopId && !showingSearchResults && !predefinedCustomerId,
  });

  const { data: predefinedDefaultProducts, isFetching: isFetchingPredefined } = useQuery({
    queryKey: ['pos-predefined-products', predefinedCustomerId],
    queryFn: () =>
      apiClient
        .get(`/api/core/products?customerId=${predefinedCustomerId}&perPage=100`)
        .then((r) => r.data.data),
    enabled: !!predefinedCustomerId && !showingSearchResults,
  });

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ['product-search', trimmedSearch],
    queryFn: () =>
      apiClient
        .get(`/api/core/products?search=${encodeURIComponent(trimmedSearch)}&perPage=50`)
        .then((r) => r.data.data),
    enabled: trimmedSearch.length > 0,
  });

  const { data: creditCustomerResults, isFetching: isFetchingCreditCustomers } = useQuery({
    queryKey: ['credit-customer-search', creditCustomerSearch],
    queryFn: () =>
      apiClient
        .get(`/api/core/customers?search=${encodeURIComponent(creditCustomerSearch)}&perPage=10`)
        .then((r) => r.data.data),
    enabled: showPayment && isMedicalStore && creditCustomerSearch.trim().length > 0,
  });

  const customerMutation = useMutation({
    mutationFn: async () => {
      const phone = customerPhone.trim();
      if (!phone) {
        return null;
      }

      const response = await apiClient.post('/api/core/customers/upsert-by-phone', {
        phone,
      });

      return response.data.data;
    },
    onSuccess: async (customer) => {
      if (!customer) {
        return;
      }

      cart.setCustomer(customer.id, customer.name ?? customer.phone ?? 'Customer', customer.phone ?? null);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(`Attached ${customer.name ?? customer.phone}`);

      try {
        const res = await apiClient.get(`/api/core/customers/${customer.id}/predefined-products`);
        const products: any[] = res.data.data ?? [];
        setPredefinedCustomerId(products.length > 0 ? customer.id : null);
      } catch {
        setPredefinedCustomerId(null);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? 'Unable to attach customer');
    },
  });

  const attachCustomerIfNeeded = async () => {
    if (cart.customerId || !customerPhone.trim()) {
      return cart.customerId ?? null;
    }

    const customer = await customerMutation.mutateAsync();
    return customer?.id ?? null;
  };

  const invalidateSalesData = () => {
    queryClient.invalidateQueries({ queryKey: ['today-summary'] });
    queryClient.invalidateQueries({ queryKey: ['sales-summary'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['low-stock'] });
    queryClient.invalidateQueries({ queryKey: ['report-sales'] });
    queryClient.invalidateQueries({ queryKey: ['report-gst'] });
    queryClient.invalidateQueries({ queryKey: ['report-valuation'] });
    queryClient.invalidateQueries({ queryKey: ['pos-top-products'] });
  };

  const saveCurrentCartAsHold = () => {
    if (cart.items.length === 0) {
      toast.error('Add items before holding the cart');
      return;
    }

    const nextHeldCart: HeldCart = {
      id: `hold-${Date.now()}`,
      createdAt: new Date().toISOString(),
      customerId: cart.customerId,
      customerName: cart.customerName,
      customerPhone: cart.customerPhone,
      items: cart.items,
    };

    const nextHeldCarts = [nextHeldCart, ...heldCarts].slice(0, 20);
    setHeldCarts(nextHeldCarts);
    persistHeldCarts(nextHeldCarts);
    cart.clearCart();
    setCustomerPhone('');
    setPredefinedCustomerId(null);
    toast.success('Cart held successfully');
  };

  const resumeHeldCart = (heldCartId: string) => {
    const heldCart = heldCarts.find((entry) => entry.id === heldCartId);
    if (!heldCart) {
      toast.error('Held cart not found');
      return;
    }

    cart.clearCart();
    heldCart.items.forEach((item) => {
      cart.addItem({
        ...item,
        quantity: item.quantity,
      });
      if (item.isLoose) {
        cart.toggleLoose(item.itemKey, true);
        cart.updateLooseQty(item.itemKey, item.looseQty ?? 0);
      }
      if ((item.discountPercent ?? 0) > 0) {
        cart.setDiscountPercent(item.itemKey, Number(item.discountPercent ?? 0));
      }
    });
    if (heldCart.customerId && heldCart.customerName) {
      cart.setCustomer(heldCart.customerId, heldCart.customerName, heldCart.customerPhone ?? null);
    }
    setCustomerPhone(heldCart.customerPhone ?? '');

    const nextHeldCarts = heldCarts.filter((entry) => entry.id !== heldCartId);
    setHeldCarts(nextHeldCarts);
    persistHeldCarts(nextHeldCarts);
    toast.success('Held cart resumed');
  };

  const removeHeldCart = (heldCartId: string) => {
    const nextHeldCarts = heldCarts.filter((entry) => entry.id !== heldCartId);
    setHeldCarts(nextHeldCarts);
    persistHeldCarts(nextHeldCarts);
  };

  const handleSearchKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && trimmedSearch) {
      try {
        const res = await apiClient.get(`/api/core/products/barcode/${encodeURIComponent(trimmedSearch)}`);
        const product = res.data.data;
        addToCart(product);
        setSearch('');
      } catch {
        toast.error('Product not found');
      }
    }
  };

  const handleCustomerKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await attachCustomerIfNeeded();
    }
  };

  const addToCart = useCallback((product: any, selectedBatch?: any) => {
    const resolvedProductId = product.id ?? product.product_id;
    const batchNo = selectedBatch?.batchNo ?? selectedBatch?.batch_no;
    const manufactureDate = selectedBatch?.manufactureDate ?? selectedBatch?.manufacture_date;
    const expiryDate = selectedBatch?.expiry ?? selectedBatch?.expiryDate ?? selectedBatch?.expiry_date;
    const batchAvailableQuantity = Number(selectedBatch?.quantity ?? 0) || undefined;
    const unitPrice = isMedicalStore
      ? Number(product.mrp ?? product.sellingPrice ?? product.selling_price ?? 0)
      : Number(product.sellingPrice ?? product.selling_price ?? product.mrp ?? 0);
    const currentItem = cart.items.find(
      (item) =>
        item.productId === resolvedProductId &&
        (item.batchNo ?? 'no-batch') === (batchNo ?? 'no-batch') &&
        (item.expiryDate ?? 'no-exp') === (expiryDate ?? 'no-exp'),
    );

    const availableQuantity = Number(product.availableQuantity ?? product.available_quantity ?? 0) || undefined;
    const targetItemToCheck = currentItem ?? {
      quantity: 0,
      looseQty: 0,
      totalUnits: Number(product.attributes?.totalUnits ?? 0) || undefined,
      availableQuantity,
      batchAvailableQuantity,
    };

    if (!canApplyCartQuantityChange(targetItemToCheck, {
      nextQuantity: (currentItem?.quantity ?? 0) + 1,
      nextLooseQty: currentItem?.looseQty ?? 0,
    })) {
      toast.error('Not enough stock available');
      return;
    }

    cart.addItem({
      itemKey: [resolvedProductId, batchNo ?? 'no-batch', expiryDate ?? 'no-exp'].join(':'),
      productId: resolvedProductId,
      name: product.name ?? product.product_name,
      sku: product.sku,
      unit: product.unit ?? 'pc',
      unitPrice,
      looseUnitPrice: Number(product.attributes?.looseSellingPrice ?? 0) || undefined,
      gstRate: Number(product.gstRate ?? product.gst_rate ?? 0),
      discount: 0,
      batchNo,
      manufactureDate,
      expiryDate,
      availableBatches: getSortedBatches(product),
      availableQuantity: Number(product.availableQuantity ?? product.available_quantity ?? 0) || undefined,
      batchAvailableQuantity,
      totalUnits: Number(product.attributes?.totalUnits ?? 0) || undefined,
    });
    setSearch('');
    searchRef.current?.focus();
  }, [cart, isMedicalStore]);

  const placeMutation = useMutation({
    mutationFn: async (paymentRef?: string) => {
      if (!shopId) {
        throw new Error('Select a shop before billing');
      }
      if (cart.items.length === 0) {
        throw new Error('Add at least one product to continue');
      }

      const customerId = await attachCustomerIfNeeded();
      const finalCustomerId = paymentMethod === 'credit' ? (cart.customerId || customerId) : customerId;

      if (paymentMethod === 'credit' && !finalCustomerId) {
        throw new Error('Select a customer before selling on credit');
      }

      return apiClient.post('/api/orders/orders', {
        shopId,
        customerId: finalCustomerId ?? undefined,
        items: cart.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity + (i.isLoose && i.totalUnits ? (i.looseQty ?? 0) / i.totalUnits : 0),
          unitPrice: (() => {
            const combinedQty = i.quantity + (i.isLoose && i.totalUnits ? (i.looseQty ?? 0) / i.totalUnits : 0);
            if (combinedQty <= 0) return i.unitPrice;
            const combinedSubtotal = i.unitPrice * i.quantity + (i.isLoose ? (i.looseUnitPrice ?? 0) * (i.looseQty ?? 0) : 0);
            return combinedSubtotal / combinedQty;
          })(),
          discount: i.discount,
          gstRate: i.gstRate,
          batchNo: i.batchNo,
          manufactureDate: i.manufactureDate,
          expiryDate: i.expiryDate,
        })),
        globalDiscount: cart.globalDiscount,
        loyaltyPointsRedeemed: Number(loyaltyPointsRedeemed || 0),
        payment: {
          method: paymentMethod,
          amount: cart.total(),
          reference: paymentRef,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`Bill ${res.data.data.billNumber} created`);
      const snapshotItems = cart.items.map((item) => ({
        name: item.name,
        batchNo: item.batchNo,
        manufactureDate: item.manufactureDate,
        expiry: item.expiryDate,
        quantityLabel: item.isLoose && (item.looseQty ?? 0) > 0
          ? `${item.quantity} ${item.unit} + ${item.looseQty} loose`
          : `${item.quantity} ${item.unit}`,
        amount:
          item.unitPrice * item.quantity +
          (item.isLoose ? (item.looseUnitPrice ?? 0) * (item.looseQty ?? 0) : 0) -
          item.discount,
        gstRate: item.gstRate ?? 0,
        discountAmount: item.discount ?? 0,
      }));
      const totalDiscount = cart.items.reduce((sum, item) => sum + (item.discount ?? 0), 0);

      setInvoiceSnapshot({
        billNumber: res.data.data.billNumber,
        createdAt: res.data.data.createdAt ?? new Date().toISOString(),
        paymentMethod,
        paymentStatus: paymentMethod === 'credit' ? 'pending' : 'paid',
        patientName,
        doctorName,
        customerName: cart.customerName ?? '',
        customerPhone: cart.customerPhone ?? customerPhone ?? '',
        items: snapshotItems,
        subtotal: cart.subtotal(),
        gstAmount: cart.taxAmount(),
        totalDiscount,
        total: cart.total(),
        dlNumbers: invoiceTemplate.dlNumbers ?? '',
        storeName: invoiceTemplate.storeDisplayName || activeShop?.name || '',
        storeAddress: invoiceTemplate.addressLine || [shopAddress.line1, shopAddress.city].filter(Boolean).join(', ') || '',
        headerLeft: invoiceTemplate.headerLeft || 'Chemist & Druggist',
        headerRight: invoiceTemplate.headerRight || 'Cash/Credit Memo',
        whatsappNumber: invoiceTemplate.whatsappNumber ?? '',
        footerNote: invoiceTemplate.footerNote || 'Thanks for your purchase',
        signatureLabel: invoiceTemplate.signatureLabel || 'Authorised Signature',
      });
      cart.clearCart();
      setCustomerPhone('');
      setCreditCustomerSearch('');
      setLoyaltyPointsRedeemed('0');
      setPatientName('');
      setDoctorName('');
      setPredefinedCustomerId(null);
      setShowPayment(false);
      invalidateSalesData();
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? err.message ?? 'Order failed');
    },
  });

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

  const buildInvoiceSummary = () => {
    if (!invoiceSnapshot) return '';

    return [
      `${invoiceTemplate.storeDisplayName || activeShop?.name || 'Medical Invoice'}`,
      `Bill No: ${invoiceSnapshot.billNumber}`,
      `Patient: ${invoiceSnapshot.patientName || invoiceSnapshot.customerName || '-'}`,
      ...invoiceSnapshot.items.map((item) => {
        const parts = [
          `${item.name} (${item.quantityLabel})`,
          item.batchNo ? `Batch ${item.batchNo}` : null,
          item.expiry ? `Exp ${item.expiry}` : null,
        ].filter(Boolean);
        return `- ${parts.join(' | ')}`;
      }),
      `Amount: ${formatCurrency(invoiceSnapshot.total)}`,
      `Payment: ${invoiceSnapshot.paymentMethod === 'credit' ? 'Credit' : 'Paid'}`,
    ].join('\n');
  };

  const generateInvoiceImage = useCallback(async () => {
    if (!invoiceSheetRef.current || !invoiceSnapshot) {
      throw new Error('Invoice is not ready yet');
    }

    const { toJpeg } = await import('html-to-image');
    return toJpeg(invoiceSheetRef.current, {
      backgroundColor: '#ffffff',
      cacheBust: true,
      pixelRatio: 1.5,
      quality: 0.82,
    });
  }, [invoiceSnapshot]);

  const handleDownloadInvoice = async () => {
    if (!invoiceSnapshot) return;

    try {
      const imageDataUrl = await generateInvoiceImage();
      const link = document.createElement('a');
      link.href = imageDataUrl;
      link.download = `${invoiceSnapshot.billNumber}.jpeg`;
      link.click();
      toast.success('Invoice image downloaded');
    } catch (error: any) {
      toast.error(error?.message ?? 'Unable to download invoice image');
    }
  };

  const handleSendWhatsApp = async () => {
    if (!invoiceSnapshot) return;

    const phone = String(invoiceSnapshot.customerPhone ?? '').replace(/\D/g, '');
    if (!phone) {
      toast.error('Customer phone is required to send the invoice on WhatsApp');
      return;
    }

    try {
      setIsSendingInvoiceWhatsapp(true);
      const imageDataUrl = await generateInvoiceImage();
      const summary = buildInvoiceSummary();

      const response = await apiClient.post('/api/core/broadcasts/send-invoice', {
        phone,
        message: summary,
        imageDataUrl,
        fileName: `${invoiceSnapshot.billNumber}.jpeg`,
        mimeType: 'image/jpeg',
      });

      const warning = response.data?.data?.warning;
      if (warning) {
        toast.success('Invoice fallback sent to WhatsApp');
        toast.message(warning);
      } else {
        toast.success('Invoice image sent to WhatsApp');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? err.message ?? 'Unable to send invoice to WhatsApp');
    } finally {
      setIsSendingInvoiceWhatsapp(false);
    }
  };

  const handlePrintInvoiceA5 = () => {
    if (!invoiceSnapshot) return;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast.error('Unable to open print window');
      return;
    }

    const storeName = invoiceSnapshot.storeName || 'Medical Store';
    const address = invoiceSnapshot.storeAddress || '';
    const headerLeft = invoiceSnapshot.headerLeft;
    const dlNumbers = invoiceSnapshot.dlNumbers;
    const headerRight = invoiceSnapshot.headerRight;
    const whatsapp = invoiceSnapshot.whatsappNumber;
    const footerNote = invoiceSnapshot.footerNote;
    const signatureLabel = invoiceSnapshot.signatureLabel;

    const itemRows = invoiceSnapshot.items.map((item) => {
      const mfgExp = [
        item.manufactureDate ? `Mfg: ${item.manufactureDate}` : '',
        item.expiry ? `Exp: ${item.expiry}` : '',
      ].filter(Boolean).join(' / ') || '-';
      return `
        <tr>
          <td class="td-name">${item.name}<br><span class="qty-label">${item.quantityLabel}</span></td>
          <td class="td-center">${item.batchNo || '-'}</td>
          <td class="td-center">${mfgExp}</td>
          <td class="td-amount">${item.amount.toFixed(2)}</td>
        </tr>`;
    }).join('');

    const dateStr = new Date(invoiceSnapshot.createdAt).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${invoiceSnapshot.billNumber}</title>
  <style>
    @page { size: A5 portrait; margin: 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #1e3a8a; background: white; }

    .invoice { border: 2px solid #1e3a8a; width: 100%; }

    /* header strip */
    .hdr { display: flex; justify-content: space-between; align-items: flex-start;
           padding: 8px 14px; border-bottom: 2px solid #1e3a8a; font-weight: 600; font-size: 11px; }
    .hdr-right { text-align: right; }
    .hdr-phone { font-size: 12px; margin-top: 3px; }

    /* store name banner */
    .banner { text-align: center; padding: 8px 14px; border-bottom: 2px solid #1e3a8a; }
    .store-name { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
    .store-addr { font-size: 10px; font-weight: 600; margin-top: 2px; }

    /* meta row */
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px;
            padding: 7px 14px; border-bottom: 2px solid #1e3a8a; font-size: 10px; }
    .meta span { font-weight: 700; }

    /* items table */
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { padding: 6px 8px; border-bottom: 2px solid #1e3a8a; font-weight: 700;
         text-align: left; background: white; }
    th.th-amount { text-align: right; }
    td { padding: 5px 8px; border-bottom: 1px solid #bfdbfe; vertical-align: top; }
    td.td-center { text-align: center; border-left: 1px solid #bfdbfe; }
    td.td-amount { text-align: right; font-weight: 700; white-space: nowrap; border-left: 1px solid #bfdbfe; }
    td.td-name { border-right: none; }
    .qty-label { color: #3b82f6; font-size: 9px; }

    /* total row */
    .total-row td { border-top: 2px solid #1e3a8a; border-bottom: none; font-weight: 700; padding: 6px 8px; }
    .total-label { text-align: right; }
    .total-value { text-align: right; font-size: 13px; font-weight: 900; white-space: nowrap; }

    /* footer */
    .footer { display: flex; justify-content: space-between; align-items: flex-end;
               padding: 10px 14px 8px; }
    .footer-note { font-size: 10px; font-weight: 600; max-width: 55%; }
    .sig-block { text-align: right; font-size: 10px; font-weight: 600; min-width: 100px; }
    .sig-line { border-top: 1px solid #1e3a8a; margin-top: 28px; padding-top: 3px; }
  </style>
</head>
<body>
<div class="invoice">
  <div class="hdr">
    <div>${headerLeft.replace(/\n/g, '<br>')}</div>
    <div class="hdr-right">
      <div>${headerRight}</div>
      ${whatsapp ? `<div class="hdr-phone">${whatsapp}</div>` : ''}
    </div>
  </div>

  <div class="banner">
    <div class="store-name">${storeName}</div>
    ${address ? `<div class="store-addr">${address}</div>` : ''}
  </div>

  <div class="meta">
    <div><span>DL No.</span> ${dlNumbers || '-'}</div>
    <div><span>Date.</span> ${dateStr}</div>
    <div><span>Patient.</span> ${invoiceSnapshot.patientName || invoiceSnapshot.customerName || '-'}</div>
    <div><span>Doctor.</span> ${invoiceSnapshot.doctorName || '-'}</div>
    <div><span>Bill No.</span> ${invoiceSnapshot.billNumber}</div>
    <div><span>Payment.</span> ${invoiceSnapshot.paymentMethod === 'credit' ? 'Credit' : invoiceSnapshot.paymentMethod.toUpperCase()}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:40%">Drug Name &amp; Qty</th>
        <th style="width:16%;text-align:center;border-left:1px solid #bfdbfe">Batch No</th>
        <th style="width:28%;text-align:center;border-left:1px solid #bfdbfe">Mfg / Exp</th>
        <th class="th-amount" style="width:16%;border-left:1px solid #bfdbfe">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr class="total-row">
        <td colspan="2">${footerNote}</td>
        <td class="total-label">Total ₹</td>
        <td class="total-value">${invoiceSnapshot.total.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <div class="footer-note">* Goods once sold will not be taken back</div>
    <div class="sig-block"><div class="sig-line">${signatureLabel}</div></div>
  </div>
</div>
<script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`);
    printWindow.document.close();
  };

  const defaultList = predefinedCustomerId ? (predefinedDefaultProducts ?? []) : (popularProducts ?? []);
  const resultList = showingSearchResults ? (searchResults ?? []) : defaultList;
  const resultHeading = showingSearchResults
    ? 'Search results'
    : predefinedCustomerId
      ? 'Predefined products'
      : 'Top selling products';
  const resultSubheading = showingSearchResults
    ? 'Tap any matching item to add it directly to the bill.'
    : predefinedCustomerId
      ? 'Showing products predefined for this customer.'
      : 'Your 50 most sold items are ready first, so billing can start immediately.';
  const resultLoading = showingSearchResults ? isFetching : (predefinedCustomerId ? isFetchingPredefined : isFetchingPopular);

  return (
    <div className="page-shell">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-label">Point Of Sale</p>
          <h1 className="mt-3 text-balance">Checkout built like a modern product surface.</h1>
        </div>
        <div className="flex gap-2">
          <span className="chip">Fast barcode lookup</span>
          <span className="chip">Live cart totals</span>
          <span className="chip">Hold / Resume carts</span>
        </div>
      </div>

      <div className="grid h-[calc(100vh-15rem)] min-h-[540px] gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="card flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4 md:p-5">
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search product or scan barcode (press Enter for barcode)"
                className="input py-3 pl-11 text-base"
              />
            </div>
          </div>

          <div className="card-strong flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="border-b border-slate-200/50 px-4 py-4">
              <p className="text-sm font-semibold text-slate-950">{resultHeading}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{resultSubheading}</p>
            </div>

            <div className="flex-1 overflow-y-auto">
              {resultLoading && (
                <div className="p-4 text-center text-sm text-slate-400">Loading products…</div>
              )}
              {!resultLoading && resultList.length === 0 && (
                <div className="p-4 text-center text-sm text-slate-400">No products found</div>
              )}
              {resultList.map((p: any) => {
                const batches = getSortedBatches(p);
                const primaryBatch = batches[0];
                const visibleBatchCards = showingSearchResults && batches.length > 0 ? batches : batches.slice(0, batches.length);

                return (
                  <div
                    key={p.id ?? p.product_id}
                    className="border-b border-slate-200/50 px-4 py-4 last:border-0 hover:bg-white/65"
                  >
                    <button
                      onClick={() => addToCart(p, batches[0])}
                      className="flex w-full items-center justify-between text-left"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{p.name ?? p.product_name}</p>
                        <p className="text-xs text-slate-400">
                          {p.sku} · {p.unit}
                          {!showingSearchResults && p.total_qty ? ` · Sold ${Number(p.total_qty).toFixed(0)}` : ''}
                        </p>
                        {isMedicalStore && batches.length > 0 && (
                          <p className="mt-1 text-[11px] text-slate-500">
                            Batch-aware stock: {batches.length} batch{batches.length > 1 ? 'es' : ''} available
                          </p>
                        )}
                        {isMedicalStore && showingSearchResults && (
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1">
                              Batch: {primaryBatch?.batchNo ?? primaryBatch?.batch_no ?? '—'}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1">
                              Mfg: {primaryBatch?.manufactureDate ?? primaryBatch?.manufacture_date ?? '—'}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1">
                              Exp: {primaryBatch?.expiry ?? primaryBatch?.expiry_date ?? '—'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-blue-700">
                          {formatCurrency(
                            Number(
                              isMedicalStore
                                ? (p.mrp ?? p.sellingPrice ?? p.selling_price ?? 0)
                                : (p.sellingPrice ?? p.selling_price ?? p.mrp ?? 0),
                            ),
                          )}
                        </p>
                        <p className="text-xs text-slate-400">
                          {!showingSearchResults && p.total_revenue
                            ? `Revenue ${formatCurrency(Number(p.total_revenue))}`
                            : `MRP ${formatCurrency(Number(p.mrp ?? 0))}`}
                        </p>
                      </div>
                    </button>
                    {isMedicalStore && visibleBatchCards.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {visibleBatchCards.map((batch: any) => (
                          <button
                            key={`${p.id ?? p.product_id}-${batch.batchNo ?? batch.batch_no}`}
                            type="button"
                            onClick={() => addToCart(p, batch)}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-600 hover:border-blue-300 hover:bg-blue-50"
                          >
                            <div className="font-semibold text-slate-900">{batch.batchNo ?? batch.batch_no}</div>
                            <div>Mfg {batch.manufactureDate || batch.manufacture_date || '—'}</div>
                            <div>Exp {batch.expiry || batch.expiry_date || '—'}</div>
                            <div>Qty {Number(batch.quantity ?? 0).toFixed(0)}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card-strong shrink-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200/50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">Held carts</p>
                <p className="text-xs text-slate-500">Pause a bill and bring it back later.</p>
              </div>
              <button className="btn-secondary" onClick={saveCurrentCartAsHold}>
                Hold Current Cart
              </button>
            </div>
            <div className="max-h-44 overflow-y-auto">
              {heldCarts.length === 0 ? (
                <div className="px-4 py-5 text-sm text-slate-400">No held carts yet.</div>
              ) : (
                heldCarts.map((heldCart) => (
                  <div key={heldCart.id} className="flex items-center gap-3 border-t border-slate-100 px-4 py-3 first:border-t-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {heldCart.customerName || 'Walk-in customer'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {heldCart.items.length} items · {new Date(heldCart.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button className="btn-secondary" onClick={() => resumeHeldCart(heldCart.id)}>Resume</button>
                    <button className="rounded-full bg-rose-50 p-2 text-rose-500" onClick={() => removeHeldCart(heldCart.id)}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <CartPanel
          cart={cart}
          customerPhone={customerPhone}
          setCustomerPhone={setCustomerPhone}
          handleCustomerKeyDown={handleCustomerKeyDown}
          attachCustomerIfNeeded={attachCustomerIfNeeded}
          formatCurrency={formatCurrency}
          onCollectPayment={() => setShowPayment(true)}
          onClearCart={() => { setCustomerPhone(''); setPredefinedCustomerId(null); }}
        />
      </div>

      {showPayment && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="mx-auto grid h-full max-w-7xl gap-4 lg:grid-cols-[1.4fr_0.6fr]">
            <CartPanel
              cart={cart}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              handleCustomerKeyDown={handleCustomerKeyDown}
              attachCustomerIfNeeded={attachCustomerIfNeeded}
              formatCurrency={formatCurrency}
              titleSuffix="Checkout"
              footerContent={
                <button
                  onClick={() => setShowPayment(false)}
                  className="btn-secondary w-full py-3 text-base"
                >
                  Back To Billing
                </button>
              }
            />

            <div className="card-strong flex h-full min-h-0 flex-col rounded-[2rem] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Payment</h3>
              <button onClick={() => setShowPayment(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="mb-6 rounded-[1.5rem] border border-blue-100 bg-blue-50 px-5 py-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-500">Amount Due</p>
              <p className="text-4xl font-semibold text-blue-700">{formatCurrency(cart.total())}</p>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3">
              {(['cash', 'upi', 'card', 'credit'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium capitalize transition-colors ${
                    paymentMethod === m
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {m === 'upi' ? 'UPI / QR' : m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>

            {isMedicalStore && (
              <div className="mb-6 space-y-3">
                <div className="grid gap-3">
                  <input
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Patient name"
                    className="input"
                  />
                  <input
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    placeholder="Doctor / Other"
                    className="input"
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Customer</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Search and select a customer if you want to tag this order. It becomes required for credit sales.
                  </p>
                </div>
                <input
                  value={creditCustomerSearch}
                  onChange={(e) => setCreditCustomerSearch(e.target.value)}
                  placeholder="Search customer by name, mobile, or customer ID"
                  className="input"
                />
                {cart.customerName && (
                  <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    Selected customer: <span className="font-semibold">{cart.customerName}</span>
                  </div>
                )}
                {cart.customerId && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Redeem Loyalty Points</label>
                    <input
                      type="number"
                      min="0"
                      className="input"
                      value={loyaltyPointsRedeemed}
                      onChange={(e) => setLoyaltyPointsRedeemed(e.target.value)}
                      placeholder="0"
                    />
                    <p className="mt-1 text-xs text-slate-500">10 points redeem as roughly Rs 1 discount.</p>
                  </div>
                )}
                {paymentMethod === 'credit' && !cart.customerId && (
                  <div className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    Customer selection is required for credit sales.
                  </div>
                )}
                {isFetchingCreditCustomers && (
                  <div className="text-sm text-slate-400">Searching customers…</div>
                )}
                {(creditCustomerResults ?? []).length > 0 && (
                  <div className="max-h-52 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-2">
                    {(creditCustomerResults ?? []).map((customer: any) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => cart.setCustomer(customer.id, customer.name ?? customer.phone ?? customer.id, customer.phone ?? null)}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{customer.name ?? 'Customer'}</p>
                          <p className="text-xs text-slate-500">{customer.phone ?? customer.id}</p>
                        </div>
                        <span className="text-xs text-slate-500">₹{Number(customer.creditBalance ?? 0).toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-auto space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Items</span>
                  <span>{cart.itemCount()}</span>
                </div>
                <div className="mt-2 flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(cart.subtotal())}</span>
                </div>
                <div className="mt-2 flex justify-between text-slate-600">
                  <span>GST</span>
                  <span>{formatCurrency(cart.taxAmount())}</span>
                </div>
              </div>

              <button
                onClick={() => placeMutation.mutate(undefined)}
                disabled={placeMutation.isPending || customerMutation.isPending}
                className="btn-primary w-full py-3 text-base"
              >
                <CheckCircle className="h-5 w-5" />
                {placeMutation.isPending || customerMutation.isPending
                  ? 'Processing…'
                  : paymentMethod === 'credit'
                    ? 'Sell On Credit'
                    : 'Confirm Payment'}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {invoiceSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="card-strong flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col rounded-[2rem] p-6">
            <div className="flex shrink-0 items-start justify-between gap-4">
              <div>
                <h2 className="mt-2 text-2xl text-slate-950">{invoiceSnapshot.billNumber}</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Generated right after {invoiceSnapshot.paymentMethod === 'credit' ? 'credit sale' : 'payment confirmation'}.
                </p>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={() => void handleDownloadInvoice()}>
                  <Download className="h-4 w-4" />
                  Download
                </button>
                <button className="btn-secondary" onClick={handlePrintInvoiceA5}>
                  Print A5
                </button>
                <button className="btn-secondary" onClick={() => void handleSendWhatsApp()} disabled={isSendingInvoiceWhatsapp}>
                  <MessageCircle className="h-4 w-4" />
                  {isSendingInvoiceWhatsapp ? 'Sending…' : 'WhatsApp'}
                </button>
                <button className="btn-secondary" onClick={() => setInvoiceSnapshot(null)}>
                  Close
                </button>
              </div>
            </div>

            <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
              <div ref={invoiceSheetRef} className="min-w-0 overflow-hidden rounded-[1.75rem] border-2 border-blue-900 bg-white">
                <div className="flex items-start justify-between gap-6 border-b-2 border-blue-900 px-6 py-4 text-sm font-semibold text-blue-900">
                  <div className="whitespace-pre-line">
                    {invoiceSnapshot.headerLeft}
                  </div>
                  <div className="text-right">
                    <div>{invoiceSnapshot.headerRight}</div>
                    {invoiceSnapshot.whatsappNumber && (
                      <div className="mt-1 flex items-center justify-end gap-1.5 text-base">
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-green-500" xmlns="http://www.w3.org/2000/svg">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        {invoiceSnapshot.whatsappNumber}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-b-2 border-blue-900 px-6 py-4 text-center text-blue-900">
                  <div className="text-[2rem] font-black uppercase tracking-wide">
                    {invoiceSnapshot.storeName}
                  </div>
                  <div className="mt-1 text-base font-semibold">
                    {invoiceSnapshot.storeAddress}
                  </div>
                </div>

                <div className="grid gap-3 border-b-2 border-blue-900 px-6 py-4 text-sm text-blue-900 md:grid-cols-2">
                  <div><span className="font-bold">DL Number.</span> {invoiceSnapshot.dlNumbers || '-'}</div>
                  <div><span className="font-bold">Date.</span> {new Date(invoiceSnapshot.createdAt).toLocaleString('en-IN')}</div>
                  <div><span className="font-bold">Name of Patient.</span> {invoiceSnapshot.patientName || invoiceSnapshot.customerName || '-'}</div>
                  <div><span className="font-bold">Rx. by Doctor / Other.</span> {invoiceSnapshot.doctorName || '-'}</div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-sm text-blue-900">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b-2 border-blue-900">
                        <th className="border-r border-blue-900 px-4 py-3 text-left">Name of Drug & Qty.</th>
                        <th className="border-r border-blue-900 px-4 py-3 text-left">Batch No</th>
                        <th className="border-r border-blue-900 px-4 py-3 text-left">Expiry Date</th>
                        <th className="border-r border-blue-900 px-4 py-3 text-right">GST%</th>
                        <th className="border-r border-blue-900 px-4 py-3 text-right">Discount</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceSnapshot.items.map((item, index) => (
                        <tr key={`${item.name}-${index}`} className="border-b border-blue-200 align-top">
                          <td className="border-r border-blue-200 px-4 py-3 break-words">{item.name} ({item.quantityLabel})</td>
                          <td className="border-r border-blue-200 px-4 py-3 break-words">{item.batchNo || '-'}</td>
                          <td className="border-r border-blue-200 px-4 py-3 break-words">
                            {item.expiry || '-'}
                          </td>
                          <td className="border-r border-blue-200 px-4 py-3 text-right whitespace-nowrap">
                            {item.gstRate > 0 ? `${item.gstRate}%` : '—'}
                          </td>
                          <td className="border-r border-blue-200 px-4 py-3 text-right whitespace-nowrap">
                            {item.discountAmount > 0 ? `₹${item.discountAmount.toFixed(2)}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{item.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                      {invoiceSnapshot.totalDiscount > 0 && (
                        <tr className="border-b border-blue-200">
                          <td colSpan={4} className="px-4 py-2 text-right text-xs text-blue-600">{invoiceSnapshot.footerNote}</td>
                          <td className="border-r border-blue-200 px-4 py-2 text-right text-xs font-medium text-blue-700">Total Discount</td>
                          <td className="px-4 py-2 text-right text-xs font-semibold whitespace-nowrap">₹{invoiceSnapshot.totalDiscount.toFixed(2)}</td>
                        </tr>
                      )}
                      <tr className="border-b border-blue-200">
                        <td colSpan={4} className={`px-4 py-2 ${invoiceSnapshot.totalDiscount > 0 ? '' : 'font-semibold'}`}>
                          {invoiceSnapshot.totalDiscount > 0 ? '' : invoiceSnapshot.footerNote}
                        </td>
                        <td className="border-r border-blue-200 px-4 py-2 text-right text-xs font-medium text-blue-700">GST</td>
                        <td className="px-4 py-2 text-right text-xs font-semibold whitespace-nowrap">₹{invoiceSnapshot.gstAmount.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="px-4 py-4 font-semibold">
                          {invoiceSnapshot.totalDiscount > 0 ? invoiceSnapshot.footerNote : ''}
                        </td>
                        <td className="border-r border-blue-900 px-4 py-4 text-right font-bold">Total</td>
                        <td className="px-4 py-4 text-right text-lg font-black whitespace-nowrap">{invoiceSnapshot.total.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end px-6 py-6 text-blue-900">
                  <div className="min-w-40 text-right font-semibold">
                    <div className="text-xs uppercase tracking-[0.2em] text-blue-500">For Store</div>
                    <div className="mt-10">{invoiceSnapshot.signatureLabel}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CartPanel({
  cart,
  customerPhone,
  setCustomerPhone,
  handleCustomerKeyDown,
  attachCustomerIfNeeded,
  formatCurrency,
  onCollectPayment,
  onClearCart,
  titleSuffix,
  footerContent,
}: {
  cart: CartPanelStore;
  customerPhone: string;
  setCustomerPhone: (value: string) => void;
  handleCustomerKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => Promise<void>;
  attachCustomerIfNeeded: () => Promise<string | null>;
  formatCurrency: (n: number) => string;
  onCollectPayment?: () => void;
  onClearCart?: () => void;
  titleSuffix?: string;
  footerContent?: ReactNode;
}) {
  const handleQtyChange = (item: CartItem, nextQuantity: number) => {
    if (!canApplyCartQuantityChange(item, { nextQuantity, nextLooseQty: item.looseQty ?? 0 })) {
      toast.error('Not enough stock available for this item');
      return;
    }
    cart.updateQty(item.itemKey, nextQuantity);
  };

  const handleLooseQtyChange = (item: CartItem, nextLooseQty: number) => {
    if (!canApplyCartQuantityChange(item, { nextQuantity: item.quantity, nextLooseQty })) {
      toast.error('Not enough stock available for this batch');
      return;
    }
    cart.updateLooseQty(item.itemKey, nextLooseQty);
  };

  const handleLooseToggle = (item: CartItem, nextEnabled: boolean) => {
    const targetLooseQty = nextEnabled ? (item.looseQty && item.looseQty > 0 ? item.looseQty : 1) : 0;
    if (!canApplyCartQuantityChange(item, { nextQuantity: item.quantity, nextLooseQty: targetLooseQty })) {
      toast.error('Not enough stock available for this batch');
      return;
    }
    cart.toggleLoose(item.itemKey, nextEnabled);
  };

  return (
    <div className="card flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-slate-200/60 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-950">
            Cart ({cart.itemCount()}){titleSuffix ? ` · ${titleSuffix}` : ''}
          </h2>
          {cart.items.length > 0 && (
            <button
              onClick={() => { cart.clearCart(); onClearCart?.(); }}
              className="text-sm font-medium text-rose-500 hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        {cart.customerName ? (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm">
            <UserPlus className="h-3.5 w-3.5 text-blue-600" />
            <span className="font-medium text-blue-700">{cart.customerName}</span>
            <button
              onClick={() => {
                cart.setCustomer('', '', null);
                setCustomerPhone('');
              }}
              className="ml-auto"
            >
              <X className="h-3.5 w-3.5 text-blue-400" />
            </button>
          </div>
        ) : (
          <div className="mt-2 flex gap-2">
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              onKeyDown={(e) => { void handleCustomerKeyDown(e); }}
              onBlur={() => {
                if (customerPhone.trim()) {
                  void attachCustomerIfNeeded();
                }
              }}
              placeholder="Customer mobile (optional)"
              className="input h-10 py-2 text-sm"
            />
          </div>
        )}
      </div>

      <div className="flex-1 divide-y divide-slate-200/50 overflow-y-auto">
        {cart.items.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-slate-400">
            <ShoppingCartIcon className="mb-3 h-12 w-12 opacity-30" />
            <p className="text-sm">Cart is empty</p>
          </div>
        )}
        {cart.items.map((item) => {
          const canSellLoose = item.unit === 'strip' && Number(item.totalUnits ?? 0) > 0;
          const lineGross = item.unitPrice * item.quantity + (item.isLoose ? (item.looseUnitPrice ?? 0) * (item.looseQty ?? 0) : 0);
          const lineNet = lineGross - item.discount;
          const lineTax = (lineNet * item.gstRate) / 100;
          const lineTotal = lineNet + lineTax;

          return (
            <div key={item.itemKey} className="p-3">
              <div className="rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm leading-5">
                      <p className="truncate font-semibold text-slate-950">{item.name}</p>
                      <span className="shrink-0 text-xs text-slate-400">{formatCurrency(item.unitPrice)}/{item.unit}</span>
                    </div>
                    <p className="truncate text-[11px] leading-4 text-slate-500">
                      Batch {item.batchNo ?? '—'} · Mfg {item.manufactureDate ?? '—'} · Exp {item.expiryDate ?? '—'}
                      {canSellLoose ? ` · Loose ${formatCurrency(item.looseUnitPrice ?? 0)}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-950">{formatCurrency(lineTotal)}</p>
                    <p className="text-[11px] text-slate-400">GST {formatCurrency(lineTax)}</p>
                  </div>
                  <button
                    onClick={() => cart.removeItem(item.itemKey)}
                    className="shrink-0 text-rose-400 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
                    <span className="text-slate-500">Qty</span>
                    <button
                      onClick={() => handleQtyChange(item, item.quantity - 1)}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-7 text-center font-semibold text-slate-900">{item.quantity}</span>
                    <button
                      onClick={() => handleQtyChange(item, item.quantity + 1)}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  {canSellLoose && (
                    <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-2 py-1">
                      <span className="text-emerald-700">Loose</span>
                      <button
                        type="button"
                        onClick={() => handleLooseToggle(item, !item.isLoose)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          item.isLoose ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                        aria-pressed={item.isLoose}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            item.isLoose ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => handleLooseQtyChange(item, (item.looseQty ?? 0) - 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-white hover:bg-emerald-50"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center font-semibold text-emerald-900">{item.looseQty ?? 0}</span>
                      <button
                        onClick={() => handleLooseQtyChange(item, (item.looseQty ?? 0) + 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-white hover:bg-emerald-50"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  <div className="ml-auto flex items-center gap-2 rounded-full bg-slate-50 px-2 py-1">
                    <span className="text-slate-500">Disc %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={item.discountPercent && item.discountPercent > 0 ? item.discountPercent : ''}
                      onChange={(e) => cart.setDiscountPercent(item.itemKey, Number(e.target.value || 0))}
                      className="input h-7 w-20 py-1 text-right text-xs"
                    />
                    <span className="text-slate-500">{formatCurrency(item.discount)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {cart.items.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-slate-200/60 bg-white/60 p-4 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatCurrency(cart.subtotal())}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Total Discount</span>
              <span>
                {formatCurrency(
                  cart.items.reduce((sum, item) => sum + Number(item.discount ?? 0), 0),
                )}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>GST</span>
              <span>{formatCurrency(cart.taxAmount())}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="text-blue-700">{formatCurrency(cart.total())}</span>
            </div>
          </div>

          <div className="p-4 pt-0">
            {footerContent ?? (
              onCollectPayment && (
                <button
                  onClick={onCollectPayment}
                  className="btn-primary w-full py-3 text-base"
                >
                  <IndianRupee className="h-4 w-4" />
                  Collect Payment
                </button>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ShoppingCartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  );
}

function getSortedBatches(product: any) {
  const batches = Array.isArray(product.batchDetails)
    ? product.batchDetails
    : Array.isArray(product.batch_details)
      ? product.batch_details
      : [];

  return [...batches].sort((left: any, right: any) => {
    const leftDate = left.expiry ? new Date(left.expiry).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDate = right.expiry ? new Date(right.expiry).getTime() : Number.MAX_SAFE_INTEGER;
    return leftDate - rightDate;
  });
}

function canApplyCartQuantityChange(
  item: Pick<CartItem, 'quantity' | 'looseQty' | 'totalUnits' | 'availableQuantity' | 'batchAvailableQuantity'> | undefined,
  next: { nextQuantity: number; nextLooseQty: number },
) {
  if (!item) {
    return true;
  }

  const availableBaseQuantity = Number(item.batchAvailableQuantity ?? item.availableQuantity ?? 0);
  if (availableBaseQuantity <= 0) {
    return next.nextQuantity <= 0 && next.nextLooseQty <= 0;
  }

  const safeQuantity = Math.max(0, next.nextQuantity);
  const safeLooseQty = Math.max(0, next.nextLooseQty);
  const unitsPerPack = Number(item.totalUnits ?? 0);

  if (unitsPerPack > 0) {
    return safeQuantity + safeLooseQty / unitsPerPack <= availableBaseQuantity;
  }

  return safeQuantity <= availableBaseQuantity;
}

function readHeldCarts(): HeldCart[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HELD_CARTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistHeldCarts(carts: HeldCart[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(HELD_CARTS_STORAGE_KEY, JSON.stringify(carts));
}
