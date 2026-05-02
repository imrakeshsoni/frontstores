import { useState, useRef, useCallback, ReactNode, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Trash2, Plus, Minus, IndianRupee, UserPlus, X, CheckCircle, Download, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
    quantity: number;
    unitPrice: number;
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
  customerPhone: string | null;
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

type ProductForm = {
  name: string;
  unit: string;
  dosageForm: string;
  mlVolume: string;
  mrp: string;
  gstRate: string;
  totalUnits: string;
  looseSellingPrice: string;
  lowStockQuantity: string;
  nrx: boolean;
  locationSection: string;
  locationRack: string;
  locationShelf: string;
};

type KeyboardZone = 'search' | 'results' | 'cart' | 'cart-action' | 'customer' | 'payment-method' | 'payment-customer' | 'payment-fields' | 'payment-confirm';
type CartEditField = 'quantity' | 'loose' | 'discount' | 'remove';
type PaymentFieldFocus = 'patient' | 'doctor' | 'loyalty';

const HELD_CARTS_STORAGE_KEY = 'frontstores-held-carts';
const ML_VOLUME_OPTIONS = ['30', '60', '80', '100', '120', '150', '180', '200', '220', '250', '300', '350', '400', '450', '500', '550', '600', '650', '900', '1000'];
const DOSAGE_FORM_OPTIONS = ['Tablet', 'Syrup', 'Powder', 'Drop', 'Injection', 'Opthalmic', 'Ointment', 'Inhalation'];
const emptyProductForm: ProductForm = {
  name: '',
  unit: 'piece',
  dosageForm: '',
  mlVolume: '',
  mrp: '',
  gstRate: '12',
  totalUnits: '',
  looseSellingPrice: '',
  lowStockQuantity: '',
  nrx: false,
  locationSection: '',
  locationRack: '',
  locationShelf: '',
};

export function POSPage() {
  const [search, setSearch] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [focusedPaymentMethod, setFocusedPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentMethodConfirmed, setPaymentMethodConfirmed] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [creditCustomerSearch, setCreditCustomerSearch] = useState('');
  const [showCreditCustomerDropdown, setShowCreditCustomerDropdown] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showCreateCustomerForm, setShowCreateCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [creditCustomerResultIndex, setCreditCustomerResultIndex] = useState(0);
  const [loyaltyPointsRedeemed, setLoyaltyPointsRedeemed] = useState('0');
  const [patientName, setPatientName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [invoiceSnapshot, setInvoiceSnapshot] = useState<InvoiceSnapshot | null>(null);
  const [invoiceDateTime, setInvoiceDateTime] = useState('');
  const [isSendingInvoiceWhatsapp, setIsSendingInvoiceWhatsapp] = useState(false);
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>(() => readHeldCarts());
  const [predefinedCustomerId, setPredefinedCustomerId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [selectedCartIndex, setSelectedCartIndex] = useState(0);
  const [keyboardZone, setKeyboardZone] = useState<KeyboardZone>('search');
  const [batchSelectionActive, setBatchSelectionActive] = useState(false);
  const [selectedBatchIndex, setSelectedBatchIndex] = useState(0);
  const [customerResultIndex, setCustomerResultIndex] = useState(0);
  const [cartEditField, setCartEditField] = useState<CartEditField>('quantity');
  const [paymentFieldFocus, setPaymentFieldFocus] = useState<PaymentFieldFocus>('patient');
  const [isCustomerSearchActive, setIsCustomerSearchActive] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const customerSearchRef = useRef<HTMLInputElement>(null);
  const patientNameRef = useRef<HTMLInputElement>(null);
  const doctorNameRef = useRef<HTMLInputElement>(null);
  const loyaltyPointsRef = useRef<HTMLInputElement>(null);
  const invoiceSheetRef = useRef<HTMLDivElement>(null);
  const activeDiscountInputRef = useRef<HTMLInputElement>(null);
  const collectPaymentButtonRef = useRef<HTMLButtonElement>(null);
  const confirmPaymentBtnRef = useRef<HTMLButtonElement>(null);
  const newCustomerNameRef = useRef<HTMLInputElement>(null);
  const newCustomerPhoneRef = useRef<HTMLInputElement>(null);
  const saveCustomerBtnRef = useRef<HTMLButtonElement>(null);
  const creditCustomerSearchRef = useRef<HTMLInputElement>(null);

  const shopId = useAuthStore((s) => s.activeShopId);
  const activeShopType = useActiveShopType();
  const isMedicalStore = isMedicalShopType(activeShopType);
  const queryClient = useQueryClient();
  const cart = useCartStore();
  const activeShop = useAuthStore((s) => s.shops.find((shop) => shop.id === s.activeShopId) ?? null);
  const can = useAuthStore((s) => s.can);
  const navigate = useNavigate();
  const trimmedSearch = search.trim();
  const showingSearchResults = trimmedSearch.length > 0;

  const { data: settingsContext } = useQuery({
    queryKey: ['settings-context-pos'],
    queryFn: () => apiClient.get('/api/core/context/settings').then((r) => r.data.data),
    enabled: !!shopId,
  });

  const invoiceTemplate = settingsContext?.shop?.settings?.invoiceTemplate ?? {};
  const shopAddress = settingsContext?.shop?.address ?? {};
  const tenantSlug = settingsContext?.tenant?.slug ?? '';
  const isLocalMedplusTenant = tenantSlug === 'medplus';
  const keyboardBillingMode =
    isMedicalStore || settingsContext?.tenant?.settings?.enableKeyboardBillingMode === true || isLocalMedplusTenant;
  const canEditInvoiceDateTime = isMedicalStore || tenantSlug === 'roshan-medical-store' || isLocalMedplusTenant;
  const hasBillableItems = cart.items.some((item) => getCartItemBillableQuantity(item) > 0);

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

  const trimmedCustomerSearch = customerSearch.trim();
  const { data: customerSearchResults = [], isFetching: isFetchingCustomers } = useQuery({
    queryKey: ['pos-customer-search', trimmedCustomerSearch],
    queryFn: () =>
      apiClient
        .get(`/api/core/customers?search=${encodeURIComponent(trimmedCustomerSearch)}&perPage=8`)
        .then((r) => r.data.data),
    enabled: trimmedCustomerSearch.length > 1,
  });

  const trimmedCreditCustomerSearch = creditCustomerSearch.trim();
  const { data: creditCustomerResults = [] } = useQuery({
    queryKey: ['pos-credit-customer-search', trimmedCreditCustomerSearch],
    queryFn: () =>
      apiClient
        .get(`/api/core/customers?search=${encodeURIComponent(trimmedCreditCustomerSearch)}&perPage=8`)
        .then((r) => r.data.data),
    enabled: trimmedCreditCustomerSearch.length > 1,
  });

  const attachCustomerIfNeeded = async () => {
    return cart.customerId ?? null;
  };

  const handleCustomerSelect = async (customer: any) => {
    cart.setCustomer(customer.id, customer.name ?? customer.phone ?? 'Customer', customer.phone ?? null);
    setCustomerSearch('');
    setShowCustomerDropdown(false);
    toast.success(`Attached ${customer.name ?? customer.phone}`);

    try {
      const res = await apiClient.get(`/api/core/customers/${customer.id}/predefined-products`);
      const products: any[] = res.data.data ?? [];
      setPredefinedCustomerId(products.length > 0 ? customer.id : null);
    } catch {
      setPredefinedCustomerId(null);
    }
  };

  const handleOpenAddProduct = () => {
    setProductForm(emptyProductForm);
    setShowAddProduct(true);
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
    if (!hasBillableItems) {
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
    setCustomerSearch('');
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
      if (showingSearchResults && resultList.length > 0) {
        e.preventDefault();
        addSelectedResultToCart();
        focusSearch();
        return;
      }

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

  const addFromNextBatchIfAvailable = useCallback((item: CartItem) => {
    const batches = Array.isArray(item.availableBatches) ? item.availableBatches : [];
    if (batches.length === 0) {
      return false;
    }

    const currentBatchIndex = batches.findIndex(
      (batch) =>
        (batch.batchNo ?? 'no-batch') === (item.batchNo ?? 'no-batch') &&
        (batch.expiry ?? 'no-exp') === (item.expiryDate ?? 'no-exp'),
    );

    for (const batch of batches.slice(currentBatchIndex >= 0 ? currentBatchIndex + 1 : 0)) {
      const allocatedQuantity = cart.items
        .filter(
          (cartItem) =>
            cartItem.productId === item.productId &&
            (cartItem.batchNo ?? 'no-batch') === (batch.batchNo ?? 'no-batch') &&
            (cartItem.expiryDate ?? 'no-exp') === (batch.expiry ?? 'no-exp'),
        )
        .reduce((sum, cartItem) => sum + getCartItemBillableQuantity(cartItem), 0);

      if (allocatedQuantity >= Number(batch.quantity ?? 0)) {
        continue;
      }

      cart.addItem({
        itemKey: [item.productId, batch.batchNo ?? 'no-batch', batch.expiry ?? 'no-exp'].join(':'),
        productId: item.productId,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        unitPrice: item.unitPrice,
        looseUnitPrice: item.looseUnitPrice,
        gstRate: item.gstRate,
        discount: 0,
        batchNo: batch.batchNo,
        manufactureDate: batch.manufactureDate,
        expiryDate: batch.expiry,
        availableBatches: item.availableBatches,
        availableQuantity: item.availableQuantity,
        batchAvailableQuantity: Number(batch.quantity ?? 0) || undefined,
        totalUnits: item.totalUnits,
        quantity: 1,
      });

      toast.message(`Added 1 unit from batch ${batch.batchNo ?? 'next batch'}`);
      return true;
    }

    return false;
  }, [cart]);

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
      if (!hasBillableItems) {
        throw new Error('Add at least one product to continue');
      }

      const customerId = await attachCustomerIfNeeded();
      const finalCustomerId = paymentMethod === 'credit' ? (cart.customerId || customerId) : customerId;

      if (paymentMethod === 'credit' && !finalCustomerId) {
        throw new Error('Select a customer before selling on credit');
      }

      return apiClient.post('/api/orders/orders', {
        shopId,
        customerId: finalCustomerId || undefined,
        items: cart.items
          .filter((i) => getCartItemBillableQuantity(i) > 0)
          .map((i) => ({
          productId: i.productId,
          quantity: getCartItemBillableQuantity(i),
          unitPrice: (() => {
            const combinedQty = getCartItemBillableQuantity(i);
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
        quantity: item.quantity,
        unitPrice: item.unitPrice,
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
        customerPhone: cart.customerPhone ?? '',
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
      setCustomerSearch('');
      setLoyaltyPointsRedeemed('0');
      setPatientName('');
      setDoctorName('');
      setPredefinedCustomerId(null);
      setCreditCustomerSearch('');
      setShowCreditCustomerDropdown(false);
      setShowPayment(false);
      invalidateSalesData();
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? err.message ?? 'Order failed');
    },
  });

  const createProductMutation = useMutation({
    mutationFn: async () => {
      if (!shopId) throw new Error('Select a shop before creating products');

      const payload = {
        name: productForm.name.trim(),
        unit: productForm.unit,
        mrp: productForm.mrp ? Number(productForm.mrp) : undefined,
        sellingPrice: productForm.mrp ? Number(productForm.mrp) : undefined,
        gstRate: Number(productForm.gstRate || 0),
        shopId,
        attributes: {
          ...(productForm.lowStockQuantity ? { lowStockQuantity: Number(productForm.lowStockQuantity) } : {}),
          ...(productForm.unit === 'strip' && productForm.totalUnits ? { totalUnits: Number(productForm.totalUnits) } : {}),
          ...(productForm.unit === 'strip' && productForm.looseSellingPrice ? { looseSellingPrice: Number(productForm.looseSellingPrice) } : {}),
          ...(productForm.unit === 'ml' && productForm.mlVolume ? { mlVolume: Number(productForm.mlVolume) } : {}),
          ...(productForm.dosageForm ? { dosageForm: productForm.dosageForm } : {}),
          nrx: productForm.nrx,
          ...(productForm.locationSection ? { locationSection: productForm.locationSection } : {}),
          ...(productForm.locationRack.trim() ? { locationRack: productForm.locationRack.trim() } : {}),
          ...(productForm.locationShelf ? { locationShelf: productForm.locationShelf } : {}),
        },
      };

      if (!payload.name) throw new Error('Product name is required');

      return apiClient.post('/api/core/products', payload);
    },
    onSuccess: (response) => {
      const product = response.data?.data;
      toast.success('Product created. Add opening stock now.');
      setShowAddProduct(false);
      setProductForm(emptyProductForm);
      queryClient.invalidateQueries({ queryKey: ['product-search'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['pos-top-products'] });
      navigate('/inventory', {
        state: {
          openAdjustStock: true,
          productId: product?.id ?? '',
          productName: product?.name ?? '',
          direction: 'add',
          type: 'purchase',
          returnTo: '/pos',
        },
      });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg ?? err.message ?? 'Unable to save product'));
    },
  });

  const createCreditCustomerMutation = useMutation({
    mutationFn: async ({ name, phone }: { name: string; phone: string }) => {
      if (!name.trim()) throw new Error('Customer name is required');
      const res = await apiClient.post('/api/core/customers', {
        name: name.trim(),
        phone: phone.trim() || undefined,
      });
      return res.data?.data;
    },
    onSuccess: (customer) => {
      cart.setCustomer(customer.id, customer.name ?? customer.phone ?? 'Customer', customer.phone ?? null);
      setCreditCustomerSearch('');
      setShowCreateCustomerForm(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['pos-credit-customer-search'] });
      toast.success('Customer created and selected.');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg ?? err.message ?? 'Unable to create customer'));
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
    const invoiceDate = getInvoiceDisplayDate(invoiceSnapshot, invoiceDateTime, canEditInvoiceDateTime);

    const itemRows = invoiceSnapshot.items.map((item, idx) => {
      const lineValueAmount = getInvoiceItemValueAmount(item);
      const lineTotalAmount = getInvoiceItemTotalAmount(item);
      return `
        <tr>
          <td class="td-center">${idx + 1}</td>
          <td class="td-name">${item.name}</td>
          <td class="td-center">${item.quantityLabel}</td>
          <td class="td-amount">${item.unitPrice.toFixed(2)}</td>
          <td class="td-amount">${lineValueAmount.toFixed(2)}</td>
          <td class="td-center">${item.gstRate > 0 ? `${item.gstRate}%` : '-'}</td>
          <td class="td-amount">${item.discountAmount > 0 ? item.discountAmount.toFixed(2) : '-'}</td>
          <td class="td-amount">${lineTotalAmount.toFixed(2)}</td>
        </tr>`;
    }).join('');

    const dateStr = invoiceDate.toLocaleString('en-IN', {
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
        <th style="width:5%;text-align:center">Sr.</th>
        <th style="width:27%">Product</th>
        <th style="width:12%;text-align:center;border-left:1px solid #bfdbfe">Qty</th>
        <th class="th-amount" style="width:12%;border-left:1px solid #bfdbfe">MRP</th>
        <th class="th-amount" style="width:12%;border-left:1px solid #bfdbfe">Value</th>
        <th style="width:8%;text-align:center;border-left:1px solid #bfdbfe">GST%</th>
        <th class="th-amount" style="width:10%;border-left:1px solid #bfdbfe">Discount</th>
        <th class="th-amount" style="width:12%;border-left:1px solid #bfdbfe">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr class="total-row">
        <td colspan="6">${footerNote}</td>
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

  const resultList = showingSearchResults ? (searchResults ?? []) : (predefinedCustomerId ? (predefinedDefaultProducts ?? []) : []);
  const resultHeading = showingSearchResults
    ? 'Search results'
    : predefinedCustomerId
      ? 'Predefined products'
      : '';
  const resultSubheading = showingSearchResults
    ? 'Tap any matching item to add it directly to the bill.'
    : predefinedCustomerId
      ? 'Showing products predefined for this customer.'
      : '';
  const resultLoading = showingSearchResults ? isFetching : (predefinedCustomerId ? isFetchingPredefined : false);

  const clampIndex = (index: number, size: number) => {
    if (size <= 0) return 0;
    if (index < 0) return 0;
    if (index >= size) return size - 1;
    return index;
  };

  const focusSearch = () => {
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const moveSelectedResult = (delta: number) => {
    const newIndex = clampIndex(selectedResultIndex + delta, resultList.length);
    setSelectedResultIndex(newIndex);
    const newProduct = resultList[newIndex];
    const batches = newProduct ? getSortedBatches(newProduct) : [];
    setBatchSelectionActive(batches.length > 0);
    setSelectedBatchIndex(0);
  };

  const moveSelectedCart = (delta: number) => {
    setSelectedCartIndex((current) => clampIndex(current + delta, cart.items.length));
  };

  const selectedCartItem = cart.items[selectedCartIndex];

  const focusKeyboardZone = useCallback((zone: KeyboardZone) => {
    setKeyboardZone(zone);
    if (zone !== 'results') {
      setBatchSelectionActive(false);
      setSelectedBatchIndex(0);
    }
    requestAnimationFrame(() => {
      if (zone === 'search' || zone === 'results') {
        searchRef.current?.focus();
        return;
      }
      if (zone === 'cart') {
        (document.activeElement as HTMLElement)?.blur();
        return;
      }
      if (zone === 'cart-action') {
        collectPaymentButtonRef.current?.focus();
        return;
      }
      if (zone === 'customer') {
        customerSearchRef.current?.focus();
        return;
      }
      if (zone === 'payment-fields') {
        if (paymentFieldFocus === 'doctor') {
          doctorNameRef.current?.focus();
          return;
        }
        if (paymentFieldFocus === 'loyalty') {
          loyaltyPointsRef.current?.focus();
          return;
        }
        patientNameRef.current?.focus();
        return;
      }
      if (zone === 'payment-customer') {
        creditCustomerSearchRef.current?.focus();
        return;
      }
      if (zone === 'payment-confirm') {
        confirmPaymentBtnRef.current?.focus();
        return;
      }
    });
  }, [paymentFieldFocus]);

  const addSelectedResultToCart = () => {
    const target = resultList[selectedResultIndex];
    if (!target) return;
    const batches = getSortedBatches(target);
    addToCart(target, batches[selectedBatchIndex] ?? batches[0]);
    setBatchSelectionActive(false);
    setSelectedBatchIndex(0);
  };

  const cyclePaymentMethod = () => {
    setPaymentMethod((current) => {
      const methods: PaymentMethod[] = ['cash', 'upi', 'card', 'credit'];
      const nextIndex = (methods.indexOf(current) + 1) % methods.length;
      return methods[nextIndex];
    });
  };

  const openPaymentKeyboardFlow = useCallback(() => {
    if (!hasBillableItems) {
      toast.error('Add items before collecting payment');
      return;
    }
    setShowPayment(true);
    setKeyboardZone('payment-method');
  }, [hasBillableItems]);

  const cycleKeyboardZone = useCallback((direction: 1 | -1) => {
    const billingZones: KeyboardZone[] = ['search', 'results', 'cart', 'customer', 'payment-method'];
    const paymentZones: KeyboardZone[] = ['payment-method', 'payment-fields', 'payment-confirm'];
    const zones = showPayment ? paymentZones : billingZones;
    const currentIndex = zones.indexOf(keyboardZone);
    const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (fallbackIndex + direction + zones.length) % zones.length;
    const nextZone = zones[nextIndex];
    if (nextZone === 'payment-method' && !showPayment) {
      openPaymentKeyboardFlow();
      return;
    }
    focusKeyboardZone(nextZone);
  }, [focusKeyboardZone, keyboardZone, openPaymentKeyboardFlow, showPayment]);

  const cycleCartEditField = useCallback((direction: 1 | -1) => {
    const fields: CartEditField[] = ['quantity', 'loose', 'discount', 'remove'];
    const currentIndex = fields.indexOf(cartEditField);
    const nextIndex = (currentIndex + direction + fields.length) % fields.length;
    setCartEditField(fields[nextIndex]);
  }, [cartEditField]);

  const moveCartEditField = useCallback((direction: 1 | -1) => {
    if (!selectedCartItem) return;

    const canSellLoose = selectedCartItem.unit === 'strip' && Number(selectedCartItem.totalUnits ?? 0) > 0;

    if (direction === 1) {
      if (cartEditField === 'quantity') {
        if (canSellLoose) {
          if ((selectedCartItem.looseQty ?? 0) <= 0) {
            if (!canApplyCartQuantityChange(selectedCartItem, {
              nextQuantity: selectedCartItem.quantity,
              nextLooseQty: 1,
            })) {
              toast.error('Not enough stock available');
              return;
            }
            cart.toggleLoose(selectedCartItem.itemKey, true);
            cart.updateLooseQty(selectedCartItem.itemKey, 1);
          }
          setCartEditField('loose');
          return;
        }

        setCartEditField('discount');
        return;
      }

      if (cartEditField === 'loose') {
        setCartEditField('discount');
      }

      return;
    }

    if (cartEditField === 'discount') {
      setCartEditField(canSellLoose ? 'loose' : 'quantity');
      return;
    }

    if (cartEditField === 'loose') {
      setCartEditField('quantity');
    }
  }, [cart, cartEditField, selectedCartItem]);

  const adjustSelectedCartItem = useCallback((delta: number) => {
    if (!selectedCartItem) return;

    if (cartEditField === 'quantity') {
      const nextQuantity = selectedCartItem.quantity + delta;
      if (nextQuantity < 0) return;
      if (
        delta > 0 &&
        !canApplyCartQuantityChange(selectedCartItem, {
          nextQuantity,
          nextLooseQty: selectedCartItem.looseQty ?? 0,
        })
      ) {
        if (addFromNextBatchIfAvailable(selectedCartItem)) {
          return;
        }
      }
      if (!canApplyCartQuantityChange(selectedCartItem, {
        nextQuantity,
        nextLooseQty: selectedCartItem.looseQty ?? 0,
      })) {
        toast.error('Not enough stock available');
        return;
      }
      cart.updateQty(selectedCartItem.itemKey, nextQuantity);
      return;
    }

    if (cartEditField === 'loose') {
      if (!(selectedCartItem.unit === 'strip' && Number(selectedCartItem.totalUnits ?? 0) > 0)) {
        toast.error('Loose sale is only available for strip products');
        return;
      }
      const nextLooseQty = Math.max(0, (selectedCartItem.looseQty ?? 0) + delta);
      if (!canApplyCartQuantityChange(selectedCartItem, {
        nextQuantity: selectedCartItem.quantity,
        nextLooseQty,
      })) {
        toast.error('Not enough stock available');
        return;
      }
      if (nextLooseQty > 0 && !selectedCartItem.isLoose) {
        cart.toggleLoose(selectedCartItem.itemKey, true);
      }
      cart.updateLooseQty(selectedCartItem.itemKey, nextLooseQty);
      return;
    }

    if (cartEditField === 'discount') {
      cart.setDiscountPercent(selectedCartItem.itemKey, Number(selectedCartItem.discountPercent ?? 0) + delta);
    }
  }, [addFromNextBatchIfAvailable, cart, cartEditField, selectedCartItem]);

  const moveCustomerResult = useCallback((delta: number) => {
    setCustomerResultIndex((current) => clampIndex(current + delta, customerSearchResults.length));
  }, [customerSearchResults.length]);

  const selectHighlightedCustomer = useCallback(() => {
    const targetCustomer = customerSearchResults[customerResultIndex];
    if (targetCustomer) {
      void handleCustomerSelect(targetCustomer);
    }
  }, [customerResultIndex, customerSearchResults]);

  const cyclePaymentFieldFocus = useCallback((direction: 1 | -1) => {
    const fields: PaymentFieldFocus[] = cart.customerId
      ? ['patient', 'doctor', 'loyalty']
      : ['patient', 'doctor'];
    const currentIndex = fields.indexOf(paymentFieldFocus);
    const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextField = fields[(fallbackIndex + direction + fields.length) % fields.length];
    setPaymentFieldFocus(nextField);
    focusKeyboardZone('payment-fields');
  }, [cart.customerId, focusKeyboardZone, paymentFieldFocus]);

  const handleKeyboardModeKeyDown = useCallback((event: KeyboardEvent) => {
    if (!keyboardBillingMode) return;
    if (showAddProduct || invoiceSnapshot) return;
    if (showPayment) return;

    const target = event.target as HTMLElement | null;
    const tagName = target?.tagName;
    const isTypingField = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
    const isDiscountField = target === activeDiscountInputRef.current;

    if (event.key === 'Shift' && !event.repeat) {
      if (!showPayment) {
        if (keyboardZone === 'search' || keyboardZone === 'results') {
          if (cart.items.length > 0) {
            const lastIndex = cart.items.length - 1;
            const lastItem = cart.items[lastIndex];
            const canSellLoose = lastItem && lastItem.unit === 'strip' && Number(lastItem.totalUnits ?? 0) > 0;
            setSelectedCartIndex(lastIndex);
            setCartEditField(canSellLoose ? 'loose' : 'quantity');
            focusKeyboardZone('cart');
          }
          return;
        }
        if (keyboardZone === 'cart') {
          if (selectedCartIndex > 0) {
            setSelectedCartIndex(selectedCartIndex - 1);
            setCartEditField('quantity');
          } else {
            focusKeyboardZone('customer');
          }
          return;
        }
        if (keyboardZone === 'cart-action') {
          if (cart.items.length > 0) {
            setSelectedCartIndex(cart.items.length - 1);
            setCartEditField('quantity');
            focusKeyboardZone('cart');
          }
          return;
        }
      }
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      if (!showPayment) {
        if (keyboardZone === 'search' || keyboardZone === 'results') {
          if (cart.items.length > 0) {
            setSelectedCartIndex(0);
            setCartEditField('quantity');
            focusKeyboardZone('cart');
          }
          return;
        }
        if (keyboardZone === 'cart' && selectedCartItem) {
          if (selectedCartIndex < cart.items.length - 1) {
            setSelectedCartIndex(selectedCartIndex + 1);
            setCartEditField('quantity');
          } else {
            focusKeyboardZone('cart-action');
          }
          return;
        }
        if (keyboardZone === 'cart-action') {
          focusKeyboardZone('cart-action');
          return;
        }
        if (keyboardZone === 'customer') {
          if (cart.items.length > 0) {
            setSelectedCartIndex(0);
            setCartEditField('quantity');
            focusKeyboardZone('cart');
          }
          return;
        }
      }
      return;
    }

    if (!showPayment) {
      if (event.key === 'F2') {
        event.preventDefault();
        focusKeyboardZone('customer');
        return;
      }
      if (event.key === 'F4') {
        event.preventDefault();
        openPaymentKeyboardFlow();
        return;
      }
      if (keyboardZone === 'search') {
        if (event.key === 'ArrowDown' && resultList.length > 0) {
          event.preventDefault();
          const firstProduct = resultList[0];
          const firstBatches = firstProduct ? getSortedBatches(firstProduct) : [];
          setSelectedResultIndex(0);
          setBatchSelectionActive(firstBatches.length > 0);
          setSelectedBatchIndex(0);
          setKeyboardZone('results');
          return;
        }
        if (event.key === 'Enter' && resultList.length > 0 && showingSearchResults) {
          event.preventDefault();
          addSelectedResultToCart();
          focusKeyboardZone('search');
          return;
        }
        if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && resultList.length > 0 && showingSearchResults) {
          const firstProduct = resultList[selectedResultIndex];
          const firstBatches = firstProduct ? getSortedBatches(firstProduct) : [];
          if (firstBatches.length > 1) {
            event.preventDefault();
            setSelectedBatchIndex((current) =>
              event.key === 'ArrowRight'
                ? Math.min(current + 1, firstBatches.length - 1)
                : Math.max(current - 1, 0),
            );
          }
          return;
        }
      }
      if (keyboardZone === 'results') {
        const curProduct = resultList[selectedResultIndex];
        const curBatches = curProduct ? getSortedBatches(curProduct) : [];
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          moveSelectedResult(1);
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          if (selectedResultIndex === 0) {
            focusKeyboardZone('search');
            return;
          }
          moveSelectedResult(-1);
          return;
        }
        if (curBatches.length > 1 && event.key === 'ArrowRight') {
          event.preventDefault();
          setSelectedBatchIndex((i) => Math.min(i + 1, curBatches.length - 1));
          return;
        }
        if (curBatches.length > 1 && event.key === 'ArrowLeft') {
          event.preventDefault();
          setSelectedBatchIndex((i) => Math.max(i - 1, 0));
          return;
        }
        if (event.key === 'Enter' && curProduct) {
          event.preventDefault();
          addSelectedResultToCart();
          focusKeyboardZone('search');
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          focusKeyboardZone('search');
          return;
        }
      }
      if (keyboardZone === 'cart' && selectedCartItem && (isDiscountField || !isTypingField)) {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          adjustSelectedCartItem(1);
          return;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          adjustSelectedCartItem(-1);
          return;
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          moveCartEditField(1);
          return;
        }
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          moveCartEditField(-1);
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          if (cartEditField === 'loose' && selectedCartItem.unit === 'strip' && Number(selectedCartItem.totalUnits ?? 0) > 0) {
            cart.toggleLoose(selectedCartItem.itemKey, !selectedCartItem.isLoose);
          }
          return;
        }
        if (isDeleteKey(event) && (!isDiscountField || isRecordDeleteKey(event))) {
          event.preventDefault();
          event.stopPropagation();
          cart.removeItem(selectedCartItem.itemKey);
          return;
        }
      }
      if (keyboardZone === 'cart-action') {
        if (event.key === 'Enter') {
          event.preventDefault();
          collectPaymentButtonRef.current?.click();
          return;
        }
        if (event.key === 'ArrowUp' && cart.items.length > 0) {
          event.preventDefault();
          setSelectedCartIndex(cart.items.length - 1);
          setCartEditField('quantity');
          focusKeyboardZone('cart');
          return;
        }
      }
      if (keyboardZone === 'customer') {
        if (cart.customerId && isDeleteKey(event)) {
          event.preventDefault();
          cart.setCustomer('', '', null);
          setCustomerSearch('');
          setPredefinedCustomerId(null);
          return;
        }
        if (event.key === 'ArrowDown' && customerSearchResults.length > 0) {
          event.preventDefault();
          setShowCustomerDropdown(true);
          moveCustomerResult(1);
          return;
        }
        if (event.key === 'ArrowUp' && customerSearchResults.length > 0) {
          event.preventDefault();
          setShowCustomerDropdown(true);
          moveCustomerResult(-1);
          return;
        }
        if (event.key === 'Enter' && customerSearchResults.length > 0) {
          event.preventDefault();
          selectHighlightedCustomer();
          focusKeyboardZone('search');
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          setShowCustomerDropdown(false);
          focusKeyboardZone('search');
          return;
        }
      }
    } else {
      if (keyboardZone === 'cart' && selectedCartItem && (isDiscountField || !isTypingField)) {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          adjustSelectedCartItem(1);
          return;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          adjustSelectedCartItem(-1);
          return;
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          moveCartEditField(1);
          return;
        }
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          moveCartEditField(-1);
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          if (cartEditField === 'loose' && selectedCartItem.unit === 'strip' && Number(selectedCartItem.totalUnits ?? 0) > 0) {
            cart.toggleLoose(selectedCartItem.itemKey, !selectedCartItem.isLoose);
          }
          return;
        }
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setShowPayment(false);
        focusKeyboardZone('search');
        return;
      }
      if (event.key === 'F2') {
        event.preventDefault();
        setPaymentFieldFocus('patient');
        focusKeyboardZone('payment-fields');
        return;
      }
      if (event.key === 'F3') {
        event.preventDefault();
        setPaymentFieldFocus('doctor');
        focusKeyboardZone('payment-fields');
        return;
      }
      if (event.key === 'F6') {
        event.preventDefault();
        if (cart.customerId) {
          setPaymentFieldFocus('loyalty');
          focusKeyboardZone('payment-fields');
        }
        return;
      }
      if (keyboardZone === 'payment-fields') {
        if (event.key === 'ArrowDown' || (event.key === 'Enter' && !event.ctrlKey)) {
          event.preventDefault();
          const isLastPaymentField = paymentFieldFocus === 'loyalty' || (!cart.customerId && paymentFieldFocus === 'doctor');
          if (isLastPaymentField) {
            focusKeyboardZone('payment-confirm');
          } else {
            cyclePaymentFieldFocus(1);
          }
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          if (paymentFieldFocus === 'patient') {
            focusKeyboardZone('payment-method');
          } else {
            cyclePaymentFieldFocus(-1);
          }
          return;
        }
      }
      if (keyboardZone === 'payment-confirm' && (event.key === 'ArrowUp' || event.key === 'ArrowLeft')) {
        event.preventDefault();
        focusKeyboardZone('payment-fields');
        return;
      }
      if ((event.ctrlKey && event.key === 'Enter') || event.key === 'F9') {
        event.preventDefault();
        if (!placeMutation.isPending) {
          placeMutation.mutate(undefined);
        }
        return;
      }
      if (keyboardZone === 'payment-confirm' && event.key === 'Enter') {
        event.preventDefault();
        if (!placeMutation.isPending) {
          placeMutation.mutate(undefined);
        }
      }
    }
  }, [activeDiscountInputRef, addToCart, adjustSelectedCartItem, cart, cartEditField, customerSearchResults.length, cyclePaymentFieldFocus, cyclePaymentMethod, focusedPaymentMethod, focusKeyboardZone, invoiceSnapshot, isMedicalStore, keyboardBillingMode, keyboardZone, moveCartEditField, moveCustomerResult, openPaymentKeyboardFlow, paymentFieldFocus, paymentMethod, placeMutation, resultList, selectHighlightedCustomer, selectedCartItem, selectedResultIndex, setShowCustomerDropdown, showAddProduct, showPayment, showingSearchResults]);

  useEffect(() => {
    if (resultList.length === 0) {
      setSelectedResultIndex(0);
      setBatchSelectionActive(false);
      setSelectedBatchIndex(0);
      return;
    }

    const firstProduct = resultList[0];
    const firstBatches = firstProduct ? getSortedBatches(firstProduct) : [];
    setSelectedResultIndex(0);
    setBatchSelectionActive(firstBatches.length > 0);
    setSelectedBatchIndex(0);
  }, [resultList]);

  useEffect(() => {
    setSelectedCartIndex((current) => clampIndex(current, cart.items.length));
  }, [cart.items.length]);

  useEffect(() => {
    setCustomerResultIndex((current) => clampIndex(current, customerSearchResults.length));
  }, [customerSearchResults.length]);

  useEffect(() => {
    if (!keyboardBillingMode) return;
    window.addEventListener('keydown', handleKeyboardModeKeyDown);
    return () => window.removeEventListener('keydown', handleKeyboardModeKeyDown);
  }, [handleKeyboardModeKeyDown, keyboardBillingMode]);

  useEffect(() => {
    if (!showPayment || !keyboardBillingMode) return;
    if (showCreateCustomerForm) return;

    const METHODS: PaymentMethod[] = ['cash', 'upi', 'card', 'credit'];

    const focusZone = (zone: KeyboardZone, field?: 'patient' | 'doctor') => {
      setKeyboardZone(zone);
      if (zone === 'payment-fields') {
        setPaymentFieldFocus(field === 'doctor' ? 'doctor' : 'patient');
      }
      if (zone === 'payment-customer') {
        setCreditCustomerSearch('');
        setShowCreditCustomerDropdown(false);
        setCreditCustomerResultIndex(0);
        cart.setCustomer('', '', null);
      }
      requestAnimationFrame(() => {
        if (zone === 'payment-customer') { creditCustomerSearchRef.current?.focus(); return; }
        if (zone === 'payment-fields') {
          if (field === 'doctor') { doctorNameRef.current?.focus(); }
          else { patientNameRef.current?.focus(); }
          return;
        }
        if (zone === 'payment-confirm') { confirmPaymentBtnRef.current?.focus(); return; }
        if (zone === 'payment-method') { (document.activeElement as HTMLElement)?.blur(); }
      });
    };

    const goForward = () => {
      if (keyboardZone === 'payment-method') {
        focusZone('payment-customer'); return;
      }
      if (keyboardZone === 'payment-customer') {
        if (isMedicalStore) { focusZone('payment-fields', 'patient'); return; }
        focusZone('payment-confirm');
        return;
      }
      if (keyboardZone === 'payment-fields') {
        const activeEl = document.activeElement;
        if (activeEl === patientNameRef.current) { focusZone('payment-fields', 'doctor'); return; }
        focusZone('payment-confirm');
        return;
      }
    };

    const backToPaymentMethod = () => {
      setPaymentMethodConfirmed(false);
      setFocusedPaymentMethod(paymentMethod);
      focusZone('payment-method');
    };

    const goBackward = () => {
      if (keyboardZone === 'payment-confirm') {
        if (isMedicalStore) { focusZone('payment-fields', 'doctor'); return; }
        focusZone('payment-customer');
        return;
      }
      if (keyboardZone === 'payment-fields') {
        const activeEl = document.activeElement;
        if (activeEl === doctorNameRef.current) { focusZone('payment-fields', 'patient'); return; }
        focusZone('payment-customer');
        return;
      }
      if (keyboardZone === 'payment-customer') { backToPaymentMethod(); return; }
      if (keyboardZone === 'payment-method') {
        if (isMedicalStore) { focusZone('payment-fields', 'doctor'); return; }
        focusZone('payment-confirm');
      }
    };

    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (showCreateCustomerForm) return;

      if (e.key === 'Escape') { setShowPayment(false); return; }

      if (e.key === 'Tab') {
        e.preventDefault();
        if (!paymentMethodConfirmed) {
          const idx = METHODS.indexOf(focusedPaymentMethod);
          setFocusedPaymentMethod(METHODS[(idx + 1) % METHODS.length]);
        } else {
          goForward();
        }
        return;
      }

      if (e.key === 'Shift' && !e.repeat) {
        if (!paymentMethodConfirmed) {
          const idx = METHODS.indexOf(focusedPaymentMethod);
          setFocusedPaymentMethod(METHODS[(idx - 1 + METHODS.length) % METHODS.length]);
        } else {
          goBackward();
        }
        return;
      }

      if (keyboardZone === 'payment-customer') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!showCreditCustomerDropdown) { setShowCreditCustomerDropdown(true); return; }
          setCreditCustomerResultIndex((i) => Math.min(i + 1, creditCustomerResults.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setCreditCustomerResultIndex((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (showCreditCustomerDropdown && creditCustomerResults.length > 0) {
            const c = creditCustomerResults[creditCustomerResultIndex];
            if (c) {
              cart.setCustomer(c.id, c.name ?? c.phone ?? 'Customer', c.phone ?? null);
              setCreditCustomerSearch('');
              setShowCreditCustomerDropdown(false);
              setCreditCustomerResultIndex(0);
              if (isMedicalStore) { focusZone('payment-fields', 'patient'); }
              else { focusZone('payment-confirm'); }
            }
          } else if (creditCustomerSearch.trim().length > 0 && creditCustomerResults.length === 0) {
            setShowCreateCustomerForm(true);
            setNewCustomerName(creditCustomerSearch.trim());
            setShowCreditCustomerDropdown(false);
            requestAnimationFrame(() => newCustomerNameRef.current?.focus());
          } else {
            setShowCreditCustomerDropdown(true);
            requestAnimationFrame(() => creditCustomerSearchRef.current?.focus());
          }
          return;
        }
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (!paymentMethodConfirmed) {
          setPaymentMethod(focusedPaymentMethod);
          setPaymentMethodConfirmed(true);
          focusZone('payment-customer');
          return;
        }
        if (keyboardZone === 'payment-fields') {
          const activeEl = document.activeElement;
          if (activeEl === patientNameRef.current) { focusZone('payment-fields', 'doctor'); return; }
          focusZone('payment-confirm');
          return;
        }
        if (keyboardZone === 'payment-confirm' && !placeMutation.isPending) {
          placeMutation.mutate(undefined);
        }
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [showPayment, keyboardBillingMode, paymentMethodConfirmed, focusedPaymentMethod, paymentMethod, cart.customerId, isMedicalStore, keyboardZone, paymentFieldFocus, placeMutation, setShowPayment, showCreditCustomerDropdown, creditCustomerResults, creditCustomerResultIndex, showCreateCustomerForm]);

  useEffect(() => {
    if (!keyboardBillingMode) return;
    if (showPayment) {
      setKeyboardZone('payment-method');
      setFocusedPaymentMethod('cash');
      setPaymentMethodConfirmed(false);
      setPaymentFieldFocus('patient');
      setShowCreateCustomerForm(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
    } else {
      setKeyboardZone('search');
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [keyboardBillingMode, showPayment]);

  useEffect(() => {
    if (keyboardZone === 'cart' && cartEditField === 'discount') {
      requestAnimationFrame(() => activeDiscountInputRef.current?.focus());
    }
  }, [cartEditField, keyboardZone, selectedCartIndex]);

  useEffect(() => {
    if (keyboardZone === 'cart' && cartEditField === 'discount') {
      return;
    }

    const active = document.activeElement as HTMLElement | null;
    if (
      active?.tagName === 'INPUT' &&
      active !== searchRef.current &&
      active !== customerSearchRef.current
    ) {
      active.blur();
    }
  }, [cartEditField, keyboardZone, selectedCartIndex]);

  useEffect(() => {
    if (showPayment || showAddProduct || invoiceSnapshot) return;

    const routeTypingToSearch = (event: KeyboardEvent) => {
      if (isCustomerSearchActive) return;
      if (showPayment) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isTypingField = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
      const isSearchField = target === searchRef.current;
      const isCustomerField = target === customerSearchRef.current;
      const isDiscountField = target === activeDiscountInputRef.current;
      const isCreditCustomerField = target === creditCustomerSearchRef.current;
      const isDigitKey = /^\d$/.test(event.key);
      const isAllowedField = isCustomerField || isDiscountField || isCreditCustomerField;
      const isNavigationKey = [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Tab',
        'Enter',
        'Escape',
        'Shift',
        'Delete',
        'Backspace',
      ].includes(event.key);

      if (keyboardZone === 'cart' && cartEditField === 'discount' && isDigitKey) {
        requestAnimationFrame(() => activeDiscountInputRef.current?.focus());
        return;
      }

      // Let customer search and cart discount inputs behave like normal inputs.
      if (isAllowedField || isSearchField || isNavigationKey) {
        return;
      }

      if (isTypingField && !isSearchField && !isAllowedField) {
        event.preventDefault();
        event.stopPropagation();
      }

      if (isPrintableKey(event.key)) {
        event.preventDefault();
        setKeyboardZone('search');
        setShowCustomerDropdown(false);
        setSearch((current) => current + event.key);
        requestAnimationFrame(() => searchRef.current?.focus());
        return;
      }

      if (event.key === 'Backspace' && !isSearchField) {
        event.preventDefault();
        setKeyboardZone('search');
        setShowCustomerDropdown(false);
        setSearch((current) => current.slice(0, -1));
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    };

    window.addEventListener('keydown', routeTypingToSearch, true);
    return () => window.removeEventListener('keydown', routeTypingToSearch, true);
  }, [cartEditField, invoiceSnapshot, isCustomerSearchActive, keyboardZone, showAddProduct, showPayment]);

  return (
    <div className="w-full px-2 py-2 md:px-3 xl:px-4">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="section-label">Point Of Sale</p>
        {keyboardBillingMode && (
          <p className="text-xs text-emerald-600">
            Keyboard mode active — Tab moves zones, arrows navigate, Enter confirms, Esc backs out.
          </p>
        )}
      </div>

      <div className="grid h-[calc(100vh-3.5rem)] min-h-[540px] gap-2 xl:grid-cols-2">
        <div className="card flex h-full min-h-0 flex-col gap-3 overflow-hidden p-3 md:p-4">
          <div className="flex flex-col gap-2">
            <div className="flex gap-3">
              <div className="relative flex-1">
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
              {can('products', 'write') && (
                <button className="btn-secondary shrink-0" onClick={handleOpenAddProduct}>
                  <Plus className="h-4 w-4" />
                  New Product
                </button>
              )}
            </div>
          </div>

          <div className="card-strong flex min-h-0 flex-1 flex-col overflow-hidden">
            {(resultHeading || resultSubheading) && (
              <div className="border-b border-slate-200/50 px-4 py-4">
                {resultHeading && <p className="text-sm font-semibold text-slate-950">{resultHeading}</p>}
                {resultSubheading && <p className="mt-1 text-xs leading-5 text-slate-500">{resultSubheading}</p>}
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {resultLoading && (
                <div className="p-4 text-center text-sm text-slate-400">Loading products…</div>
              )}
              {!resultLoading && resultList.length === 0 && (
                <div className="p-4 text-center text-sm text-slate-400">No products found</div>
              )}
              {resultList.map((p: any, index: number) => {
                const batches = getSortedBatches(p);
                const primaryBatch = batches[0];
                const visibleBatchCards = batches;
                const isSelected = keyboardBillingMode && index === selectedResultIndex;
                const isActiveRow = isSelected && (keyboardZone === 'results' || (keyboardZone === 'search' && showingSearchResults));
                return (
                  <div
                    key={p.id ?? p.product_id}
                    className={`border-b border-slate-200/50 px-4 py-4 last:border-0 transition-colors ${
                      isActiveRow ? 'bg-emerald-50 border-l-2 border-emerald-500' : 'hover:bg-white/65'
                    }`}
                  >
                    {/* product info — text forced white when row is active */}
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
                        {(p.attributes?.dosageForm || p.attributes?.dosage_form) && (
                          <p className="mt-1 text-[11px] font-medium text-emerald-700">
                            Dosage Form: {p.attributes?.dosageForm ?? p.attributes?.dosage_form}
                          </p>
                        )}
                        {isMedicalStore && batches.length > 0 && (
                          <p className="mt-1 text-[11px] text-slate-500">
                            {batches.length > 1
                              ? `${batches.length} batches — press Enter to pick`
                              : '1 batch available'}
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
                    {/* batch cards — always natural colors; only the keyboard-active card gets blue */}
                    {isMedicalStore && visibleBatchCards.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {visibleBatchCards.map((batch: any, batchIdx: number) => {
                          const isBatchActive =
                            keyboardBillingMode &&
                            isSelected &&
                            batchIdx === selectedBatchIndex &&
                            (
                              (keyboardZone === 'results' && batchSelectionActive) ||
                              (keyboardZone === 'search' && showingSearchResults)
                            );
                          return (
                            <button
                              key={`${p.id ?? p.product_id}-${batch.batchNo ?? batch.batch_no}`}
                              type="button"
                              onClick={() => addToCart(p, batch)}
                              className={`rounded-2xl border px-3 py-2 text-left text-xs transition-colors ${
                                isBatchActive
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50'
                              }`}
                            >
                              <div className="font-semibold">{batch.batchNo ?? batch.batch_no}</div>
                              <div>Mfg {batch.manufactureDate || batch.manufacture_date || '—'}</div>
                              <div>Exp {batch.expiry || batch.expiry_date || '—'}</div>
                              <div>Qty {Number(batch.quantity ?? 0).toFixed(0)}</div>
                            </button>
                          );
                        })}
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
          customerSearch={customerSearch}
          setCustomerSearch={setCustomerSearch}
          setIsCustomerSearchActive={setIsCustomerSearchActive}
          showCustomerDropdown={showCustomerDropdown}
          setShowCustomerDropdown={setShowCustomerDropdown}
          customerSearchResults={customerSearchResults}
          isFetchingCustomers={isFetchingCustomers}
          onCustomerSelect={handleCustomerSelect}
          onClearCustomer={() => { setCustomerSearch(''); setPredefinedCustomerId(null); }}
          formatCurrency={formatCurrency}
          onCollectPayment={() => setShowPayment(true)}
          onClearCart={() => { setCustomerSearch(''); setPredefinedCustomerId(null); }}
          keyboardBillingMode={keyboardBillingMode}
          selectedCartIndex={selectedCartIndex}
          keyboardZone={keyboardZone}
          cartEditField={cartEditField}
          customerResultIndex={customerResultIndex}
          customerSearchRef={customerSearchRef}
          activeDiscountInputRef={activeDiscountInputRef}
          collectPaymentButtonRef={collectPaymentButtonRef}
          onAddFromNextBatch={addFromNextBatchIfAvailable}
          onActivateCartItem={(index) => {
            setSelectedCartIndex(index);
            setKeyboardZone('cart');
          }}
        />
      </div>

      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-6 backdrop-blur-sm">
          <div className="card-strong flex w-full max-w-xl flex-col rounded-[2rem] shadow-2xl h-[calc(100vh-3rem)] overflow-y-auto">
            <div className="sticky top-0 z-10 card-strong rounded-t-[2rem] px-8 pt-7 pb-4 flex items-center justify-between border-b border-slate-100">
              <h3 className="text-xl font-semibold">Payment</h3>
              <button onClick={() => setShowPayment(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            {/* Amount Due */}
            <div className="mb-6 rounded-[1.5rem] border border-blue-100 bg-blue-50 px-6 py-7 text-center mt-6 mx-8">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-500">Amount Due</p>
              <p className="text-5xl font-semibold text-blue-700 mt-1">{formatCurrency(cart.total())}</p>
            </div>

            {/* Payment method */}
            <div className="mb-6 grid grid-cols-4 gap-3 px-8">
              {(['cash', 'upi', 'card', 'credit'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setPaymentMethod(m); setFocusedPaymentMethod(m); setPaymentMethodConfirmed(true); }}
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium capitalize transition-colors ${
                    paymentMethod === m && (!keyboardBillingMode || paymentMethodConfirmed)
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  } ${keyboardBillingMode && keyboardZone === 'payment-method' && focusedPaymentMethod === m ? 'ring-2 ring-emerald-500' : ''}`}
                >
                  {m === 'upi' ? 'UPI / QR' : m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>

            {/* Customer — mandatory for credit, optional for others */}
            <div className="mb-6 px-8">
              <p className="mb-2 text-sm font-medium text-slate-700">
                Customer {paymentMethod === 'credit' && <span className="text-rose-500">*</span>}
              </p>
              {cart.customerId ? (
                <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <div>
                    <p className="font-medium">{cart.customerName || 'Customer selected'}</p>
                    {cart.customerPhone && <p className="text-xs text-emerald-600">{cart.customerPhone}</p>}
                  </div>
                  <button onClick={() => { setCreditCustomerSearch(''); cart.setCustomer('', '', null); }} className="ml-2 text-emerald-500 hover:text-emerald-700">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : showCreateCustomerForm ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <p className="text-sm font-medium text-slate-700">New customer</p>
                  <input ref={newCustomerNameRef} value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Name *" className="input" autoFocus onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); newCustomerPhoneRef.current?.focus(); } }} />
                  <input ref={newCustomerPhoneRef} value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} placeholder="Mobile number" className="input" inputMode="numeric" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (newCustomerName.trim()) saveCustomerBtnRef.current?.click(); } }} />
                  <div className="flex gap-2">
                    <button ref={saveCustomerBtnRef} onClick={() => createCreditCustomerMutation.mutate({ name: newCustomerName, phone: newCustomerPhone })} disabled={createCreditCustomerMutation.isPending || !newCustomerName.trim()} className="btn-primary flex-1 py-2 text-sm">
                      {createCreditCustomerMutation.isPending ? 'Saving…' : 'Save & Select'}
                    </button>
                    <button onClick={() => { setShowCreateCustomerForm(false); setNewCustomerName(''); setNewCustomerPhone(''); }} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={creditCustomerSearchRef}
                    value={creditCustomerSearch}
                    onChange={(e) => { setCreditCustomerSearch(e.target.value); setShowCreditCustomerDropdown(true); setCreditCustomerResultIndex(0); }}
                    onFocus={() => setShowCreditCustomerDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCreditCustomerDropdown(false), 150)}
                    placeholder="Search customer…"
                    className={`input pl-11 ${keyboardBillingMode && keyboardZone === 'payment-customer' ? 'ring-2 ring-emerald-500' : ''}`}
                    autoComplete="off"
                  />
                  {showCreditCustomerDropdown && (
                    <div className="absolute z-10 mt-1 w-full rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                      {creditCustomerResults.length > 0 ? (
                        creditCustomerResults.map((c: any, idx: number) => (
                          <button key={c.id} onMouseDown={() => { cart.setCustomer(c.id, c.name ?? c.phone ?? 'Customer', c.phone ?? null); setCreditCustomerSearch(''); setShowCreditCustomerDropdown(false); setCreditCustomerResultIndex(0); }} className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm border-b border-slate-100 last:border-0 ${idx === creditCustomerResultIndex ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                            <div>
                              <p className="font-medium text-slate-900">{c.name}</p>
                              <p className="text-xs text-slate-500">{c.phone ?? '—'}</p>
                            </div>
                          </button>
                        ))
                      ) : creditCustomerSearch.trim().length > 0 ? (
                        <div className="px-4 py-3">
                          <p className="text-sm text-slate-500 mb-2">No customer found.</p>
                          <button onMouseDown={() => { setShowCreateCustomerForm(true); setNewCustomerName(creditCustomerSearch.trim()); setShowCreditCustomerDropdown(false); }} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800">
                            <span className="text-lg leading-none">+</span> Create "{creditCustomerSearch.trim()}"
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                  {paymentMethod === 'credit' && (
                    <p className="mt-1.5 text-xs text-amber-600">Select a customer to tag this order as credit.</p>
                  )}
                </div>
              )}
            </div>

            {/* Patient & Doctor (Medical Store only) */}
            {isMedicalStore && (
              <div className="mb-6 grid gap-3 px-8">
                <input ref={patientNameRef} value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Patient name" className={`input ${keyboardBillingMode && keyboardZone === 'payment-fields' && paymentFieldFocus === 'patient' ? 'ring-2 ring-emerald-500' : ''}`} />
                <input ref={doctorNameRef} value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="Doctor / Other" className={`input ${keyboardBillingMode && keyboardZone === 'payment-fields' && paymentFieldFocus === 'doctor' ? 'ring-2 ring-emerald-500' : ''}`} />
              </div>
            )}

            {/* Order summary + Confirm */}
            <div className="mt-auto space-y-3 px-8 pb-8">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <div className="flex justify-between text-slate-600"><span>Items</span><span>{cart.itemCount()}</span></div>
                <div className="mt-2 flex justify-between text-slate-600"><span>Subtotal</span><span>{formatCurrency(cart.subtotal())}</span></div>
                <div className="mt-2 flex justify-between text-slate-600"><span>GST</span><span>{formatCurrency(cart.taxAmount())}</span></div>
              </div>

              {paymentMethod === 'credit' && !cart.customerId && (
                <p className="text-center text-xs text-rose-500">Select a customer to proceed with credit sale.</p>
              )}

              <button
                ref={confirmPaymentBtnRef}
                onClick={() => placeMutation.mutate(undefined)}
                disabled={placeMutation.isPending || (paymentMethod === 'credit' && !cart.customerId)}
                className={`btn-primary w-full py-3 text-base disabled:opacity-40 ${keyboardBillingMode && keyboardZone === 'payment-confirm' ? 'ring-2 ring-offset-2 ring-slate-950' : ''}`}
              >
                <CheckCircle className="h-5 w-5" />
                {placeMutation.isPending ? 'Processing…' : paymentMethod === 'credit' ? 'Sell On Credit' : 'Confirm Payment'}
              </button>
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
                  Print
                </button>
                <button className="btn-secondary" onClick={() => void handleSendWhatsApp()} disabled={isSendingInvoiceWhatsapp}>
                  <MessageCircle className="h-4 w-4" />
                  {isSendingInvoiceWhatsapp ? 'Sending…' : 'WhatsApp'}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setInvoiceSnapshot(null);
                    setInvoiceDateTime('');
                  }}
                >
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
                  <div className="space-y-2">
                    <div><span className="font-bold">Date.</span> {getInvoiceDisplayDate(invoiceSnapshot, invoiceDateTime, canEditInvoiceDateTime).toLocaleString('en-IN')}</div>
                    {canEditInvoiceDateTime && (
                      <div className="flex flex-wrap gap-2">
                        <input
                          type="date"
                          className="input h-9 min-w-[148px] px-3 py-1 text-sm"
                          value={invoiceDateTime.slice(0, 10)}
                          onChange={(e) => setInvoiceDateTime((current) => mergeInvoiceDatePart(current, e.target.value, 'date'))}
                        />
                        <input
                          type="time"
                          className="input h-9 min-w-[120px] px-3 py-1 text-sm"
                          value={invoiceDateTime.slice(11, 16)}
                          onChange={(e) => setInvoiceDateTime((current) => mergeInvoiceDatePart(current, e.target.value, 'time'))}
                        />
                      </div>
                    )}
                  </div>
                  <div><span className="font-bold">Name of Patient.</span> {invoiceSnapshot.patientName || invoiceSnapshot.customerName || '-'}</div>
                  <div><span className="font-bold">Rx. by Doctor / Other.</span> {invoiceSnapshot.doctorName || '-'}</div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-sm text-blue-900">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b-2 border-blue-900">
                        <th className="border-r border-blue-900 px-4 py-3 text-center">Sr.</th>
                        <th className="border-r border-blue-900 px-4 py-3 text-left">Product</th>
                        <th className="border-r border-blue-900 px-4 py-3 text-center">Qty</th>
                        <th className="border-r border-blue-900 px-4 py-3 text-right">MRP</th>
                        <th className="border-r border-blue-900 px-4 py-3 text-right">Value</th>
                        <th className="border-r border-blue-900 px-4 py-3 text-right">GST%</th>
                        <th className="border-r border-blue-900 px-4 py-3 text-right">Discount</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceSnapshot.items.map((item, index) => (
                        <tr key={`${item.name}-${index}`} className="border-b border-blue-200 align-top">
                          <td className="border-r border-blue-200 px-4 py-3 text-center text-slate-500">{index + 1}</td>
                          <td className="border-r border-blue-200 px-4 py-3 break-words">{item.name}</td>
                          <td className="border-r border-blue-200 px-4 py-3 text-center whitespace-nowrap">
                            {item.quantityLabel}
                          </td>
                          <td className="border-r border-blue-200 px-4 py-3 text-right whitespace-nowrap">
                            ₹{item.unitPrice.toFixed(2)}
                          </td>
                          <td className="border-r border-blue-200 px-4 py-3 text-right whitespace-nowrap">
                            ₹{getInvoiceItemValueAmount(item).toFixed(2)}
                          </td>
                          <td className="border-r border-blue-200 px-4 py-3 text-right whitespace-nowrap">
                            {item.gstRate > 0 ? `${item.gstRate}%` : '—'}
                          </td>
                          <td className="border-r border-blue-200 px-4 py-3 text-right whitespace-nowrap">
                            {item.discountAmount > 0 ? `₹${item.discountAmount.toFixed(2)}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                            ₹{getInvoiceItemTotalAmount(item).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {invoiceSnapshot.totalDiscount > 0 && (
                        <tr className="border-b border-blue-200">
                          <td colSpan={6} className="px-4 py-2 text-right text-xs text-blue-600">{invoiceSnapshot.footerNote}</td>
                          <td className="border-r border-blue-200 px-4 py-2 text-right text-xs font-medium text-blue-700">Total Discount</td>
                          <td className="px-4 py-2 text-right text-xs font-semibold whitespace-nowrap">₹{invoiceSnapshot.totalDiscount.toFixed(2)}</td>
                        </tr>
                      )}
                      <tr className="border-b border-blue-200">
                        <td colSpan={6} className={`px-4 py-2 ${invoiceSnapshot.totalDiscount > 0 ? '' : 'font-semibold'}`}>
                          {invoiceSnapshot.totalDiscount > 0 ? '' : invoiceSnapshot.footerNote}
                        </td>
                        <td className="border-r border-blue-200 px-4 py-2 text-right text-xs font-medium text-blue-700">GST</td>
                        <td className="px-4 py-2 text-right text-xs font-semibold whitespace-nowrap">₹{invoiceSnapshot.gstAmount.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td colSpan={6} className="px-4 py-4 font-semibold">
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

      {showAddProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="card-strong flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col rounded-[2rem] p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="section-label">Billing</p>
                <h2 className="mt-2 text-2xl">Add product</h2>
                <p className="mt-2 text-sm text-slate-500">Save the product here, then continue directly into opening stock entry.</p>
              </div>
              <button className="btn-secondary" onClick={() => setShowAddProduct(false)}>Close</button>
            </div>

            <div className="grid gap-4 overflow-y-auto pr-1 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Name</label>
                <input className="input" value={productForm.name} onChange={(e) => setProductForm((current) => ({ ...current, name: e.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Unit</label>
                <select className="input" value={productForm.unit} onChange={(e) => setProductForm((current) => ({ ...current, unit: e.target.value }))}>
                  {['ml', 'piece', 'strip', 'dozen', 'unit'].map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Dosage Form</label>
                <select className="input" value={productForm.dosageForm} onChange={(e) => setProductForm((current) => ({ ...current, dosageForm: e.target.value }))}>
                  <option value="">Select dosage form</option>
                  {DOSAGE_FORM_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              {productForm.unit === 'ml' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Bottle Size (ml)</label>
                  <select className="input" value={productForm.mlVolume} onChange={(e) => setProductForm((current) => ({ ...current, mlVolume: e.target.value }))}>
                    <option value="">Select ml size</option>
                    {ML_VOLUME_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              )}
              {productForm.unit === 'strip' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Total Units</label>
                  <input className="input" value={productForm.totalUnits} onChange={(e) => setProductForm((current) => ({ ...current, totalUnits: e.target.value }))} />
                </div>
              )}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">{productForm.unit === 'strip' ? 'Strip MRP' : 'MRP'}</label>
                <input className="input" value={productForm.mrp} onChange={(e) => setProductForm((current) => ({ ...current, mrp: e.target.value }))} />
              </div>
              {productForm.unit === 'strip' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Loose MRP</label>
                  <input className="input" value={productForm.looseSellingPrice} onChange={(e) => setProductForm((current) => ({ ...current, looseSellingPrice: e.target.value }))} />
                </div>
              )}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">GST Rate</label>
                <select className="input" value={productForm.gstRate} onChange={(e) => setProductForm((current) => ({ ...current, gstRate: e.target.value }))}>
                  {[0, 5, 12, 18, 28].map((rate) => (
                    <option key={rate} value={rate}>{rate}%</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Low Stock Quantity</label>
                <input type="number" min="0" className="input" value={productForm.lowStockQuantity} onChange={(e) => setProductForm((current) => ({ ...current, lowStockQuantity: e.target.value }))} />
              </div>
              <div className="md:col-span-2 border-t border-slate-100 pt-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Store Placement</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Rack</label>
                    <input className="input" value={productForm.locationSection} onChange={(e) => setProductForm((current) => ({ ...current, locationSection: e.target.value }))} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Shelf</label>
                    <input className="input" value={productForm.locationRack} onChange={(e) => setProductForm((current) => ({ ...current, locationRack: e.target.value }))} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Container</label>
                    <input className="input" value={productForm.locationShelf} onChange={(e) => setProductForm((current) => ({ ...current, locationShelf: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700">NRX</span>
                <button
                  type="button"
                  onClick={() => setProductForm((current) => ({ ...current, nrx: !current.nrx }))}
                  className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
                    productForm.nrx ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                  aria-pressed={productForm.nrx}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      productForm.nrx ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex gap-3">
                <button className="btn-secondary" onClick={() => setShowAddProduct(false)}>Cancel</button>
                <button className="btn-primary" onClick={() => createProductMutation.mutate()} disabled={createProductMutation.isPending}>
                  {createProductMutation.isPending ? 'Saving…' : 'Save Product'}
                </button>
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
  customerSearch,
  setCustomerSearch,
  setIsCustomerSearchActive,
  showCustomerDropdown,
  setShowCustomerDropdown,
  customerSearchResults,
  isFetchingCustomers,
  onCustomerSelect,
  onClearCustomer,
  formatCurrency,
  onCollectPayment,
  onClearCart,
  titleSuffix,
  footerContent,
  keyboardBillingMode,
  selectedCartIndex,
  keyboardZone,
  cartEditField,
  customerResultIndex,
  customerSearchRef,
  activeDiscountInputRef,
  collectPaymentButtonRef,
  onActivateCartItem,
  onAddFromNextBatch,
}: {
  cart: CartPanelStore;
  customerSearch: string;
  setCustomerSearch: (value: string) => void;
  setIsCustomerSearchActive: (value: boolean) => void;
  showCustomerDropdown: boolean;
  setShowCustomerDropdown: (v: boolean) => void;
  customerSearchResults: any[];
  isFetchingCustomers: boolean;
  onCustomerSelect: (customer: any) => void;
  onClearCustomer: () => void;
  formatCurrency: (n: number) => string;
  onCollectPayment?: () => void;
  onClearCart?: () => void;
  titleSuffix?: string;
  footerContent?: ReactNode;
  keyboardBillingMode?: boolean;
  selectedCartIndex?: number;
  keyboardZone?: KeyboardZone;
  cartEditField?: CartEditField;
  customerResultIndex?: number;
  customerSearchRef?: React.RefObject<HTMLInputElement>;
  activeDiscountInputRef?: React.RefObject<HTMLInputElement>;
  collectPaymentButtonRef?: React.RefObject<HTMLButtonElement>;
  onActivateCartItem?: (index: number) => void;
  onAddFromNextBatch?: (item: CartItem) => boolean;
}) {
  const selectedCartItem = selectedCartIndex !== undefined ? cart.items[selectedCartIndex] : undefined;

  const handleQtyChange = (item: CartItem, nextQuantity: number) => {
    if (
      nextQuantity > item.quantity &&
      !canApplyCartQuantityChange(item, { nextQuantity, nextLooseQty: item.looseQty ?? 0 })
    ) {
      if (onAddFromNextBatch?.(item)) {
        return;
      }
    }
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
    <div
      className="card flex h-full min-h-0 flex-col overflow-hidden"
      onKeyDownCapture={(event) => {
        if (!isDeleteKey(event.nativeEvent)) return;
        if (!selectedCartItem) return;
        if (event.target === customerSearchRef?.current) return;
        if (event.target === activeDiscountInputRef?.current && !isRecordDeleteKey(event.nativeEvent)) return;
        event.preventDefault();
        event.stopPropagation();
        cart.removeItem(selectedCartItem.itemKey);
      }}
    >
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
            {cart.customerPhone && <span className="text-xs text-blue-400">{cart.customerPhone}</span>}
            <button
              onClick={() => { cart.setCustomer('', '', null); onClearCustomer(); }}
              className="ml-auto"
            >
              <X className="h-3.5 w-3.5 text-blue-400" />
            </button>
          </div>
        ) : (
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              ref={customerSearchRef}
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
              onFocus={() => {
                setIsCustomerSearchActive(true);
                if (customerSearch.trim().length > 1) setShowCustomerDropdown(true);
              }}
              onBlur={() => {
                setIsCustomerSearchActive(false);
                setTimeout(() => setShowCustomerDropdown(false), 150);
              }}
              placeholder="Search customer by name or mobile…"
              className="input h-10 py-2 pl-9 text-sm"
            />
            {showCustomerDropdown && customerSearch.trim().length > 1 && (
              <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
                {isFetchingCustomers && (
                  <div className="px-4 py-3 text-sm text-slate-400">Searching…</div>
                )}
                {!isFetchingCustomers && customerSearchResults.length === 0 && (
                  <div className="px-4 py-3 text-sm text-slate-400">No customers found</div>
                )}
                {customerSearchResults.map((customer: any) => (
                  <button
                    key={customer.id}
                    type="button"
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left first:rounded-t-xl last:rounded-b-xl transition-colors ${
                      keyboardBillingMode && keyboardZone === 'customer' && customerResultIndex === customerSearchResults.indexOf(customer)
                        ? 'bg-emerald-50'
                        : 'hover:bg-slate-50'
                    }`}
                    onMouseDown={() => onCustomerSelect(customer)}
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{customer.name ?? 'Customer'}</p>
                      <p className="text-xs text-slate-500">{customer.phone ?? '—'}</p>
                    </div>
                    <span className="text-xs text-slate-400">₹{Number(customer.creditBalance ?? 0).toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
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
        {cart.items.map((item, index) => {
          const canSellLoose = item.unit === 'strip' && Number(item.totalUnits ?? 0) > 0;
          const lineGross = item.unitPrice * item.quantity + (item.isLoose ? (item.looseUnitPrice ?? 0) * (item.looseQty ?? 0) : 0);
          const lineNet = lineGross - item.discount;
          const lineTax = (lineNet * item.gstRate) / 100;
          const lineTotal = lineNet + lineTax;
          const isSelected = keyboardBillingMode && index === selectedCartIndex;
          const editFieldBadge = cartEditField === 'quantity'
            ? 'Qty'
            : cartEditField === 'loose'
              ? 'Loose'
              : cartEditField === 'discount'
                ? 'Discount'
                : 'Remove';

          const isActiveCartItem = isSelected && keyboardZone === 'cart';
          const isQtyActive = isActiveCartItem && cartEditField === 'quantity';
          const isLooseActive = isActiveCartItem && cartEditField === 'loose';
          const isDiscountActive = isActiveCartItem && cartEditField === 'discount';
          return (
            <div key={item.itemKey} className="p-3">
              <div
                tabIndex={0}
                onMouseDown={() => onActivateCartItem?.(index)}
                onClick={() => onActivateCartItem?.(index)}
                onFocus={() => onActivateCartItem?.(index)}
                onKeyDown={(event) => {
                  if (event.target === activeDiscountInputRef?.current && !isRecordDeleteKey(event.nativeEvent)) return;
                  if (isDeleteKey(event.nativeEvent)) {
                    event.preventDefault();
                    cart.removeItem(item.itemKey);
                  }
                }}
                className={`rounded-xl border px-3 py-2 transition-colors ${
                isActiveCartItem ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300' : 'border-slate-200/70 bg-white/80'
              }`}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm leading-5">
                      <p className="truncate font-semibold text-slate-950">{item.name}</p>
                      <span className="shrink-0 text-xs text-slate-400">{formatCurrency(item.unitPrice)}/{item.unit}</span>
                      {isActiveCartItem && keyboardBillingMode && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                          {editFieldBadge}
                        </span>
                      )}
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

                <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                  <div className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 transition-colors ${
                    isQtyActive ? 'bg-emerald-100 ring-1 ring-emerald-300' : 'bg-slate-50'
                  }`}>
                    <span className={isQtyActive ? 'text-emerald-800' : 'text-slate-500'}>Qty</span>
                    <button
                      onClick={() => handleQtyChange(item, item.quantity - 1)}
                      className={`flex h-6 w-6 items-center justify-center rounded-full border bg-white ${
                        isQtyActive ? 'border-emerald-300 hover:bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className={`w-7 text-center font-semibold ${isQtyActive ? 'text-emerald-900' : 'text-slate-900'}`}>{item.quantity}</span>
                    <button
                      onClick={() => handleQtyChange(item, item.quantity + 1)}
                      className={`flex h-6 w-6 items-center justify-center rounded-full border bg-white ${
                        isQtyActive ? 'border-emerald-300 hover:bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  {canSellLoose && (
                    <div className={`flex shrink-0 items-center gap-2 rounded-full px-2 py-1 transition-colors ${
                      isLooseActive ? 'bg-emerald-100 ring-1 ring-emerald-300' : 'bg-emerald-50'
                    }`}>
                      <span className={isLooseActive ? 'text-emerald-800' : 'text-emerald-700'}>Loose</span>
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
                        className={`flex h-6 w-6 items-center justify-center rounded-full border bg-white ${
                          isLooseActive ? 'border-emerald-300 hover:bg-emerald-50' : 'border-emerald-200 hover:bg-emerald-50'
                        }`}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center font-semibold text-emerald-900">{item.looseQty ?? 0}</span>
                      <button
                        onClick={() => handleLooseQtyChange(item, (item.looseQty ?? 0) + 1)}
                        className={`flex h-6 w-6 items-center justify-center rounded-full border bg-white ${
                          isLooseActive ? 'border-emerald-300 hover:bg-emerald-50' : 'border-emerald-200 hover:bg-emerald-50'
                        }`}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  <div className={`flex shrink-0 items-center gap-2 rounded-full px-2 py-1 transition-colors ${
                    isDiscountActive ? 'bg-emerald-100 ring-1 ring-emerald-300' : 'bg-slate-50'
                  }`}>
                    <span className={isDiscountActive ? 'text-emerald-800' : 'text-slate-500'}>Disc %</span>
                    <input
                      ref={isActiveCartItem && cartEditField === 'discount' ? activeDiscountInputRef : undefined}
                      type="number"
                      min={0}
                      max={100}
                      step="1"
                      inputMode="numeric"
                      value={item.discountPercent && item.discountPercent > 0 ? item.discountPercent : ''}
                      onChange={(e) => cart.setDiscountPercent(item.itemKey, Number.parseInt(e.target.value || '0', 10) || 0)}
                      onKeyDown={(event) => {
                        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Delete', 'Backspace'].includes(event.key)) {
                          event.preventDefault();
                        }
                      }}
                      className={`input h-7 w-20 py-1 text-right text-xs ${
                        isDiscountActive ? 'border-emerald-300 bg-white ring-1 ring-emerald-200' : ''
                      }`}
                    />
                    <span className={isDiscountActive ? 'text-emerald-800' : 'text-slate-500'}>{formatCurrency(item.discount)}</span>
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
                  ref={collectPaymentButtonRef}
                  onClick={onCollectPayment}
                  className={`w-full py-3 text-base btn-primary ${
                    keyboardBillingMode && keyboardZone === 'cart-action'
                      ? 'ring-4 ring-blue-400 ring-offset-2'
                      : ''
                  }`}
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

function toDateTimeLocalValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function mergeInvoiceDatePart(currentValue: string, nextValue: string, part: 'date' | 'time') {
  const fallback = toDateTimeLocalValue(new Date());
  const source = currentValue || fallback;
  const datePart = part === 'date' ? nextValue : source.slice(0, 10);
  const timePart = part === 'time' ? nextValue : source.slice(11, 16);
  return `${datePart || fallback.slice(0, 10)}T${timePart || fallback.slice(11, 16)}`;
}

function getInvoiceDisplayDate(
  invoiceSnapshot: InvoiceSnapshot,
  invoiceDateTime: string,
  canEditInvoiceDateTime: boolean,
) {
  if (canEditInvoiceDateTime && invoiceDateTime) {
    const editedDate = new Date(invoiceDateTime);
    if (!Number.isNaN(editedDate.getTime())) {
      return editedDate;
    }
  }

  const originalDate = new Date(invoiceSnapshot.createdAt);
  if (!Number.isNaN(originalDate.getTime())) {
    return originalDate;
  }

  return new Date();
}

function getInvoiceItemTaxAmount(item: Pick<InvoiceSnapshot['items'][number], 'amount' | 'gstRate'>) {
  return Number(((item.amount * item.gstRate) / 100).toFixed(2));
}

function getInvoiceItemValueAmount(item: Pick<InvoiceSnapshot['items'][number], 'amount'>) {
  return Number(item.amount.toFixed(2));
}

function getInvoiceItemTotalAmount(item: Pick<InvoiceSnapshot['items'][number], 'amount' | 'gstRate'>) {
  return Number((getInvoiceItemValueAmount(item) + getInvoiceItemTaxAmount(item)).toFixed(2));
}

function isPrintableKey(key: string) {
  return key.length === 1;
}

function isDeleteKey(event: Pick<KeyboardEvent, 'key' | 'code'>) {
  return event.key === 'Delete' || event.key === 'Backspace' || event.code === 'Delete' || event.code === 'Backspace';
}

function isRecordDeleteKey(event: Pick<KeyboardEvent, 'key' | 'code'>) {
  return event.key === 'Delete' || event.code === 'Delete';
}

function getCartItemBillableQuantity(item: Pick<CartItem, 'quantity' | 'isLoose' | 'looseQty' | 'totalUnits'>) {
  return item.quantity + (item.isLoose && item.totalUnits ? (item.looseQty ?? 0) / item.totalUnits : 0);
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
