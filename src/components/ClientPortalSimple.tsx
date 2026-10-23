import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ProductItem, ClientOrder, OrderItem, PaymentMethod } from '../types';
import {
  formatCurrency,
  formatCNPJ,
  formatPhone,
  getRemainingTime
} from '../lib/formatters';
import {
  Clock,
  Target,
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  Search,
  Building2,
  User,
  Phone,
  FileText,
  Save,
  Share2,
  Lock,
  Filter,
  Check,
  CreditCard,
  QrCode,
  Sparkles,
  CloudCheck,
  Cloud
} from 'lucide-react';

interface ClientPortalSimpleProps {
  products: ProductItem[];
  currentOrder: ClientOrder | null;
  campaignTitle: string;
  defaultDurationHours: number;
  defaultTargetAmount: number;
  onSaveClientOrder: (order: Partial<ClientOrder> & { items: OrderItem[]; isDraft?: boolean }) => Promise<void>;
}

export const ClientPortalSimple: React.FC<ClientPortalSimpleProps> = ({
  products,
  currentOrder,
  campaignTitle,
  defaultDurationHours,
  defaultTargetAmount,
  onSaveClientOrder,
}) => {
  // Storage key for auto-saving drafts locally (preserves work on refresh/connection drop)
  const draftStorageKey = useMemo(() => {
    return `coletivo_draft_order_${currentOrder?.id || 'general'}`;
  }, [currentOrder?.id]);

  // Client Identification
  const [clientName, setClientName] = useState(currentOrder?.clientName || '');
  const [clientWhatsapp, setClientWhatsapp] = useState(currentOrder?.clientWhatsapp || '');
  const [clientCnpj, setClientCnpj] = useState(currentOrder?.clientCnpj || '');

  // Payment Method Selection: 'pix' or 'card_10x'
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    currentOrder?.paymentMethod || 'pix'
  );

  // Target and Deadline
  const targetAmount = currentOrder?.targetAmount ?? defaultTargetAmount;
  const durationHours = currentOrder?.durationHours ?? defaultDurationHours;
  const expiresAt =
    currentOrder?.expiresAt ||
    new Date(Date.now() + durationHours * 3600 * 1000).toISOString();

  // Quantities map: productId -> quantity
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');

  // Timer
  const [remainingTime, setRemainingTime] = useState(getRemainingTime(expiresAt));

  // Auto-save & saving states
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isSaving, setIsSaving] = useState(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [isSummaryCopied, setIsSummaryCopied] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Interaction & Initialization tracking refs
  const hasUserInteractedRef = useRef(false);
  const isInitializedRef = useRef(false);
  const currentOrderIdRef = useRef(currentOrder?.id);

  // Allowed Suppliers from order doc or URL parameters
  const effectiveAllowedSuppliers = useMemo<string[] | null>(() => {
    if (currentOrder?.allowedSuppliers && currentOrder.allowedSuppliers.length > 0) {
      return currentOrder.allowedSuppliers;
    }
    const params = new URLSearchParams(window.location.search);
    const paramSuppliers = params.get('suppliers');
    if (paramSuppliers) {
      const parsed = paramSuppliers.split(',').map(s => decodeURIComponent(s.trim())).filter(Boolean);
      if (parsed.length > 0) return parsed;
    }
    return null;
  }, [currentOrder]);

  // Filter products by allowed suppliers first
  const supplierFilteredProducts = useMemo(() => {
    if (!effectiveAllowedSuppliers || effectiveAllowedSuppliers.length === 0) {
      return products;
    }
    return products.filter(p => effectiveAllowedSuppliers.includes(p.supplier));
  }, [products, effectiveAllowedSuppliers]);

  // Unique brands / suppliers for quick filter pills
  const brands = useMemo(() => {
    return Array.from(new Set(supplierFilteredProducts.map(p => p.supplier || 'Geral'))).sort();
  }, [supplierFilteredProducts]);

  // Safe price calculation helpers to prevent NaN or blank prices
  const getSafePixPrice = (p: ProductItem): number => {
    if (typeof p.unitPricePix === 'number' && !isNaN(p.unitPricePix) && p.unitPricePix > 0) {
      return p.unitPricePix;
    }
    if (typeof p.unitPrice === 'number' && !isNaN(p.unitPrice) && p.unitPrice > 0) {
      return p.unitPrice;
    }
    const cost = Number(p.costPrice) || 0;
    return Number((cost * 1.15).toFixed(2));
  };

  const getSafeCardPrice = (p: ProductItem): number => {
    if (typeof p.unitPriceCard === 'number' && !isNaN(p.unitPriceCard) && p.unitPriceCard > 0) {
      return p.unitPriceCard;
    }
    const pix = getSafePixPrice(p);
    return Number((pix * 1.10).toFixed(2));
  };

  // Lock condition: Either admin marked payment as settled OR the countdown has expired
  const isPaymentSettled = Boolean(currentOrder?.paymentSettled || currentOrder?.status === 'settled');
  const isLocked = isPaymentSettled || remainingTime.isExpired;

  // Initialize order from localStorage draft first, then currentOrder (protects against wiping state)
  useEffect(() => {
    // If already initialized AND user already entered quantities in local state, NEVER wipe them out!
    if (isInitializedRef.current && hasUserInteractedRef.current && Object.keys(quantities).length > 0) {
      return;
    }
    if (isInitializedRef.current && currentOrderIdRef.current === currentOrder?.id) {
      return;
    }
    currentOrderIdRef.current = currentOrder?.id;

    let draftLoaded = false;
    // 1. Check all candidate draft storage keys (order-specific, general, and latest active)
    try {
      const candidateKeys = [
        draftStorageKey,
        currentOrder?.id ? `coletivo_draft_order_${currentOrder.id}` : null,
        'coletivo_draft_order_general',
        'coletivo_last_active_draft',
      ].filter(Boolean) as string[];

      for (const key of candidateKeys) {
        const cached = localStorage.getItem(key);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.quantities && Object.keys(parsed.quantities).length > 0) {
            setQuantities(parsed.quantities);
            if (parsed.paymentMethod === 'pix' || parsed.paymentMethod === 'card_10x') {
              setPaymentMethod(parsed.paymentMethod);
            }
            if (parsed.clientName) setClientName(parsed.clientName);
            if (parsed.clientWhatsapp) setClientWhatsapp(parsed.clientWhatsapp);
            if (parsed.clientCnpj) setClientCnpj(parsed.clientCnpj);
            draftLoaded = true;
            setAutoSaveStatus('saved');
            break;
          }
        }
      }
    } catch (err) {
      console.warn('Error reading draft from localStorage:', err);
    }

    // 2. If no localStorage draft, load from currentOrder
    if (!draftLoaded && currentOrder) {
      if (currentOrder.items) {
        const itemsList: OrderItem[] = Array.isArray(currentOrder.items)
          ? currentOrder.items
          : typeof currentOrder.items === 'object'
          ? Object.values(currentOrder.items)
          : [];

        const initialMap: Record<string, number> = {};
        itemsList.forEach(item => {
          if (item.productId && item.quantity > 0) {
            initialMap[item.productId] = item.quantity;
          }
        });
        if (Object.keys(initialMap).length > 0) {
          setQuantities(initialMap);
          setAutoSaveStatus('saved');
        }
      }
      if (currentOrder.paymentMethod) {
        setPaymentMethod(currentOrder.paymentMethod);
      }
      if (currentOrder.clientName) setClientName(currentOrder.clientName);
      if (currentOrder.clientWhatsapp) setClientWhatsapp(currentOrder.clientWhatsapp);
      if (currentOrder.clientCnpj) setClientCnpj(currentOrder.clientCnpj);
    }

    isInitializedRef.current = true;
  }, [currentOrder?.id, draftStorageKey]);

  // Live timer tick
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingTime(getRemainingTime(expiresAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  // Calculations for both PIX and Cartão 10x
  const {
    totalOrderAmountPix,
    totalOrderAmountCard,
    totalOrderAmount,
    totalOrderUnits,
    orderItemsList
  } = useMemo(() => {
    let amountPix = 0;
    let amountCard = 0;
    let totalUnits = 0;
    const itemsList: OrderItem[] = [];

    supplierFilteredProducts.forEach(p => {
      const qty = quantities[p.id] || 0;
      if (qty > 0) {
        const pixPrice = getSafePixPrice(p);
        const cardPrice = getSafeCardPrice(p);
        const chosenUnitPrice = paymentMethod === 'pix' ? pixPrice : cardPrice;

        const subtotal = Number((qty * chosenUnitPrice).toFixed(2));
        amountPix += Number((qty * pixPrice).toFixed(2));
        amountCard += Number((qty * cardPrice).toFixed(2));
        totalUnits += qty;

        itemsList.push({
          productId: p.id,
          name: p.name,
          sku: p.sku,
          category: p.category,
          supplier: p.supplier,
          brand: p.brand || p.supplier,
          quantityPerBox: p.quantityPerBox || 1,
          unit: p.unit,
          costPrice: p.costPrice,
          unitPrice: chosenUnitPrice,
          unitPricePix: pixPrice,
          unitPriceCard: cardPrice,
          quantity: qty,
          subtotal,
        });
      }
    });

    const activeTotal = paymentMethod === 'pix' ? amountPix : amountCard;

    return {
      totalOrderAmountPix: Number(amountPix.toFixed(2)),
      totalOrderAmountCard: Number(amountCard.toFixed(2)),
      totalOrderAmount: Number(activeTotal.toFixed(2)),
      totalOrderUnits: totalUnits,
      orderItemsList: itemsList,
    };
  }, [supplierFilteredProducts, quantities, paymentMethod]);

  const progressPercent = targetAmount > 0 ? Math.min(100, (totalOrderAmount / targetAmount) * 100) : 100;
  const isGoalReached = targetAmount > 0 ? totalOrderAmount >= targetAmount : true;
  const remainingToGoal = Math.max(0, targetAmount - totalOrderAmount);

  // Filter products by brand and search
  const filteredProducts = useMemo(() => {
    return supplierFilteredProducts.filter(p => {
      const matchesBrand = selectedBrand === 'all' || p.supplier === selectedBrand;
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.supplier.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesBrand && matchesSearch;
    });
  }, [supplierFilteredProducts, selectedBrand, searchTerm]);

  // Quantity updates with interaction flag
  const updateQuantity = (productId: string, delta: number) => {
    if (isLocked) return;
    hasUserInteractedRef.current = true;
    setQuantities(prev => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: next };
    });
  };

  const handleInputChange = (productId: string, val: string) => {
    if (isLocked) return;
    hasUserInteractedRef.current = true;
    const num = parseInt(val, 10);
    setQuantities(prev => {
      if (isNaN(num) || num <= 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: num };
    });
  };

  // Payment method selection handler (ensures instant state update and auto-save trigger)
  const handleSelectPaymentMethod = (method: PaymentMethod) => {
    if (isPaymentSettled) return;
    hasUserInteractedRef.current = true;
    setPaymentMethod(method);

    // Immediate synchronous save to local storage keys so quantities and payment selection never blank out
    try {
      const draft = {
        quantities,
        paymentMethod: method,
        clientName,
        clientWhatsapp,
        clientCnpj,
        updatedAt: new Date().toISOString(),
      };
      const serialized = JSON.stringify(draft);
      localStorage.setItem(draftStorageKey, serialized);
      localStorage.setItem('coletivo_last_active_draft', serialized);
      if (currentOrder?.id) {
        localStorage.setItem(`coletivo_draft_order_${currentOrder.id}`, serialized);
      }
      localStorage.setItem('coletivo_draft_order_general', serialized);
    } catch (e) {
      console.warn('Sync draft save failed:', e);
    }
  };

  // Real-time auto-saving of draft: persists to localStorage immediately and debounces to Firestore
  useEffect(() => {
    if (!isInitializedRef.current || !hasUserInteractedRef.current) return;
    if (isPaymentSettled || remainingTime.isExpired) return;

    // 1. Instant save to all localStorage backup keys (immune to network drops / instant refresh recovery)
    try {
      const draft = {
        quantities,
        paymentMethod,
        clientName,
        clientWhatsapp,
        clientCnpj,
        updatedAt: new Date().toISOString(),
      };
      const serialized = JSON.stringify(draft);
      localStorage.setItem(draftStorageKey, serialized);
      localStorage.setItem('coletivo_last_active_draft', serialized);
      if (currentOrder?.id) {
        localStorage.setItem(`coletivo_draft_order_${currentOrder.id}`, serialized);
      }
      localStorage.setItem('coletivo_draft_order_general', serialized);
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }

    // 2. Debounced background sync to Firestore (800ms of idle time)
    setAutoSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await onSaveClientOrder({
          clientName: clientName.trim(),
          clientWhatsapp: clientWhatsapp.trim(),
          clientCnpj: clientCnpj.trim(),
          targetAmount,
          totalAmount: totalOrderAmount,
          totalAmountPix: totalOrderAmountPix,
          totalAmountCard: totalOrderAmountCard,
          paymentMethod,
          allowedSuppliers: effectiveAllowedSuppliers || undefined,
          totalItems: totalOrderUnits,
          durationHours,
          expiresAt,
          items: orderItemsList,
          isDraft: true,
        });
        setAutoSaveStatus('saved');
      } catch (err) {
        console.error('Auto-save sync error:', err);
        setAutoSaveStatus('idle');
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [
    quantities,
    paymentMethod,
    clientName,
    clientWhatsapp,
    clientCnpj,
    totalOrderAmount,
    totalOrderAmountPix,
    totalOrderAmountCard,
    totalOrderUnits,
    orderItemsList,
    isPaymentSettled,
    remainingTime.isExpired,
    draftStorageKey,
    currentOrder?.id,
    effectiveAllowedSuppliers,
    targetAmount,
    durationHours,
    expiresAt,
    onSaveClientOrder
  ]);

  // Final Order Submission
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (isPaymentSettled) {
      setValidationError('Este pedido já teve o pagamento acertado com a administração e está bloqueado para quaisquer alterações.');
      return;
    }

    if (remainingTime.isExpired) {
      setValidationError('O prazo para alteração deste pedido expirou.');
      return;
    }

    if (!clientName.trim()) {
      setValidationError('Por favor, informe seu Nome ou Razão Social no topo da página.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!clientWhatsapp.trim()) {
      setValidationError('Por favor, informe seu WhatsApp para contato.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!clientCnpj.trim()) {
      setValidationError('Por favor, informe o CNPJ da sua empresa.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (totalOrderUnits === 0) {
      setValidationError('Por favor, defina a quantidade de pelo menos um produto na tabela.');
      return;
    }

    setIsSaving(true);
    try {
      await onSaveClientOrder({
        clientName: clientName.trim(),
        clientWhatsapp: clientWhatsapp.trim(),
        clientCnpj: clientCnpj.trim(),
        targetAmount,
        totalAmount: totalOrderAmount,
        totalAmountPix: totalOrderAmountPix,
        totalAmountCard: totalOrderAmountCard,
        paymentMethod,
        allowedSuppliers: effectiveAllowedSuppliers || undefined,
        totalItems: totalOrderUnits,
        durationHours,
        expiresAt,
        status: 'submitted',
        items: orderItemsList,
        isDraft: false,
      });

      // Clear local draft upon official submission
      try {
        localStorage.removeItem(draftStorageKey);
      } catch {}

      setIsSavedSuccess(true);
      setAutoSaveStatus('saved');
    } catch (err: any) {
      setValidationError('Erro ao salvar pedido: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-36 font-sans">
      {/* Client Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-base tracking-tight text-white">
                Distribuidora B2B
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Portal do Cliente
              </span>

              {/* Real-time draft auto-save indicator badge */}
              {autoSaveStatus === 'saving' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                  <Clock className="w-3 h-3 animate-spin" />
                  <span>Salvando rascunho...</span>
                </span>
              )}
              {autoSaveStatus === 'saved' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Rascunho salvo</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {campaignTitle || 'Pedido Coletivo Direto com Fornecedores'}
            </p>
          </div>

          {/* Countdown Clock or Settlement Status */}
          {isPaymentSettled ? (
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border border-emerald-600 bg-emerald-950/70 text-emerald-300 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-400 block leading-none">
                  Status do Pedido:
                </span>
                <span className="font-bold text-xs text-white">
                  Pagamento Acertado (Fechado)
                </span>
              </div>
            </div>
          ) : (
            <div className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border text-xs font-semibold ${
              remainingTime.isExpired
                ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                : 'bg-slate-800 border-slate-700 text-amber-300 shadow-xs'
            }`}>
              {remainingTime.isExpired ? (
                <Lock className="w-4 h-4 text-rose-400" />
              ) : (
                <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
              )}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">
                  {remainingTime.isExpired ? 'Status:' : 'Prazo para envio:'}
                </span>
                <span className="font-mono font-bold text-sm">
                  {remainingTime.formatted}
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-5 space-y-5">
        {/* Banner: Pedido com Pagamento Acertado */}
        {isPaymentSettled && (
          <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-800 to-teal-800 text-white rounded-2xl border border-emerald-600 shadow-md flex items-start gap-3.5 animate-fadeIn">
            <div className="p-2 bg-white/20 rounded-xl mt-0.5 shrink-0">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-white">Pagamento Acertado &bull; Pedido Bloqueado</h3>
                <span className="text-[11px] bg-white text-emerald-900 font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Fechado
                </span>
              </div>
              <p className="text-xs sm:text-sm text-emerald-100 mt-1 leading-relaxed">
                A administração já registrou o <strong>pagamento acertado</strong> para este pedido. Conforme a regra de segurança, o pedido está <strong>bloqueado contra novas alterações</strong> (itens e quantidades), mesmo que o prazo em horas ainda não tenha terminado.
              </p>
              {currentOrder?.paymentSettledAt && (
                <div className="text-xs text-emerald-200 font-semibold mt-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Acerto registrado em: {new Date(currentOrder.paymentSettledAt).toLocaleString('pt-BR')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Validation Error Banner */}
        {validationError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
            <button onClick={() => setValidationError(null)} className="underline ml-4 font-bold text-[11px]">
              Fechar
            </button>
          </div>
        )}

        {/* Exclusive Suppliers Alert Banner (if filtered by admin) */}
        {effectiveAllowedSuppliers && effectiveAllowedSuppliers.length > 0 && (
          <div className="p-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl border border-blue-700/80 shadow-xs flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/50 rounded-xl text-blue-200">
                <Building2 className="w-5 h-5 text-blue-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-200">
                    Catálogo Exclusivo Liberado para Você
                  </h3>
                  <span className="text-[10px] font-bold bg-blue-500/40 text-blue-100 px-2 py-0.5 rounded-full">
                    {effectiveAllowedSuppliers.length} fornecedor{effectiveAllowedSuppliers.length > 1 ? 'es' : ''}
                  </span>
                </div>
                <p className="text-sm font-semibold text-white mt-0.5">
                  Este link dá acesso aos produtos de: <strong>{effectiveAllowedSuppliers.join(', ')}</strong>
                </p>
              </div>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-blue-800/80 text-blue-200 rounded-full border border-blue-600/60">
              {supplierFilteredProducts.length} itens disponíveis
            </span>
          </div>
        )}

        {/* Step 1: Identification Card */}
        <section className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">
                1. Seus Dados de Identificação
              </h2>
            </div>
            <span className="text-[11px] text-slate-400">
              Dados salvos automaticamente no rascunho
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome do Responsável / Razão Social *
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="Ex: Mercado Central Ltda / Maria"
                  value={clientName}
                  disabled={isLocked}
                  onChange={e => {
                    hasUserInteractedRef.current = true;
                    setClientName(e.target.value);
                  }}
                  className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                WhatsApp para Contato *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="Ex: (11) 98765-4321"
                  value={clientWhatsapp}
                  disabled={isLocked}
                  onChange={e => {
                    hasUserInteractedRef.current = true;
                    setClientWhatsapp(e.target.value);
                  }}
                  className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                CNPJ da sua Empresa *
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="Ex: 00.000.000/0000-00"
                  value={clientCnpj}
                  disabled={isLocked}
                  onChange={e => {
                    hasUserInteractedRef.current = true;
                    setClientCnpj(e.target.value);
                  }}
                  className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Step 2: Goal Progress Card */}
        {targetAmount > 0 && (
          <section className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-600" />
                <div>
                  <h3 className="text-xs font-bold text-slate-900">
                    Meta Recomendada para o Pedido: {formatCurrency(targetAmount)}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Garanta melhores condições de frete e faturamento atingindo o valor sugerido.
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Valor Atual ({paymentMethod === 'pix' ? 'PIX à Vista' : 'Cartão em até 10x'})
                </span>
                <span className="text-lg font-black text-slate-900">
                  {formatCurrency(totalOrderAmount)}
                </span>
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">
                  {isGoalReached ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Parabéns! Meta recomendada atingida ({progressPercent.toFixed(0)}%)
                    </span>
                  ) : (
                    <span>
                      Faltam <strong>{formatCurrency(remainingToGoal)}</strong> para atingir a meta
                    </span>
                  )}
                </span>
                <span className="font-bold text-slate-700">{progressPercent.toFixed(1)}%</span>
              </div>

              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isGoalReached
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm'
                      : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </section>
        )}

        {/* Step 3: Product Table with 2 Price Columns: PIX and CARTÃO 10x */}
        <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Table Header Controls */}
          <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">
                    2. Tabela de Preços & Quantidades
                  </h2>
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {filteredProducts.length} itens
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Preços no <strong>PIX à vista</strong> e no <strong>Cartão em até 10x</strong>. Clique na coluna para alternar o cálculo.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar produto ou SKU..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Quick Supplier / Brand Filters */}
            {brands.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 text-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                  Filtrar:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedBrand('all')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedBrand === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todos ({supplierFilteredProducts.length})
                </button>
                {brands.map(b => {
                  const count = supplierFilteredProducts.filter(p => p.supplier === b).length;
                  return (
                    <button
                      type="button"
                      key={b}
                      onClick={() => setSelectedBrand(b)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                        selectedBrand === b
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>{b}</span>
                      <span className="text-[10px] opacity-75 font-mono">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Table Container */}
          {filteredProducts.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              Nenhum produto encontrado com os filtros atuais.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-3 px-3">Marca / Fornecedor</th>
                    <th className="py-3 px-3">Produto / Descrição</th>
                    <th className="py-3 px-3 text-center">Qtd / Caixa</th>
                    <th className="py-3 px-3 text-center">Unidade</th>
                    
                    {/* DUAS COLUNAS DE PREÇOS (Interativas: clicar seleciona a forma de pagamento) */}
                    <th
                      onClick={() => handleSelectPaymentMethod('pix')}
                      className={`py-3 px-3 text-right font-bold transition-all border-l cursor-pointer select-none ${
                        paymentMethod === 'pix'
                          ? 'bg-emerald-100/90 text-emerald-950 border-emerald-400 ring-2 ring-emerald-500/20'
                          : 'bg-emerald-50/40 text-emerald-800 border-emerald-100 hover:bg-emerald-100/50'
                      }`}
                      title="Clique para definir o pedido todo no PIX à vista"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Preço PIX</span>
                        {paymentMethod === 'pix' && (
                          <span className="text-[9px] font-black bg-emerald-600 text-white px-1.5 py-0.2 rounded-md ml-1">
                            ATIVO
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-semibold text-emerald-600">à vista</div>
                    </th>

                    <th
                      onClick={() => handleSelectPaymentMethod('card_10x')}
                      className={`py-3 px-3 text-right font-bold transition-all border-l cursor-pointer select-none ${
                        paymentMethod === 'card_10x'
                          ? 'bg-blue-100/90 text-blue-950 border-blue-400 ring-2 ring-blue-500/20'
                          : 'bg-blue-50/40 text-blue-800 border-blue-100 hover:bg-blue-100/50'
                      }`}
                      title="Clique para definir o pedido todo no Cartão em até 10x"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <CreditCard className="w-3.5 h-3.5 text-blue-700" />
                        <span>Preço Cartão</span>
                        {paymentMethod === 'card_10x' && (
                          <span className="text-[9px] font-black bg-blue-600 text-white px-1.5 py-0.2 rounded-md ml-1">
                            ATIVO
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-semibold text-blue-600">em até 10x</div>
                    </th>

                    <th className="py-3 px-3 text-center w-36">Sua Quantidade</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredProducts.map(prod => {
                    const qty = quantities[prod.id] || 0;
                    const pixPrice = getSafePixPrice(prod);
                    const cardPrice = getSafeCardPrice(prod);
                    const cardInstallment10 = Number((cardPrice / 10).toFixed(2));

                    const activePrice = paymentMethod === 'pix' ? pixPrice : cardPrice;
                    const subtotal = Number((qty * activePrice).toFixed(2));
                    const isSelected = qty > 0;

                    return (
                      <tr
                        key={prod.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-blue-50/30' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="py-3 px-3 font-medium text-slate-800 whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                            {prod.brand || prod.supplier}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 text-xs">{prod.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            SKU: {prod.sku}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-bold text-[11px]">
                            {prod.quantityPerBox ? `${prod.quantityPerBox} un/cx` : '1 un'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center text-slate-600 font-medium whitespace-nowrap">
                          {prod.unit}
                        </td>

                        {/* COLUNA PREÇO PIX (Clicável) */}
                        <td
                          onClick={() => handleSelectPaymentMethod('pix')}
                          className={`py-3 px-3 text-right font-extrabold whitespace-nowrap border-l transition-all cursor-pointer ${
                            paymentMethod === 'pix'
                              ? 'bg-emerald-100/50 text-emerald-950 font-black text-sm'
                              : 'bg-emerald-50/20 text-emerald-800 text-xs hover:bg-emerald-50/60'
                          }`}
                          title="Clique para selecionar PIX à vista"
                        >
                          <div>{formatCurrency(pixPrice)}</div>
                          <div className="text-[9px] text-emerald-600 font-semibold">à vista</div>
                        </td>

                        {/* COLUNA PREÇO CARTÃO (Clicável) */}
                        <td
                          onClick={() => handleSelectPaymentMethod('card_10x')}
                          className={`py-3 px-3 text-right font-extrabold whitespace-nowrap border-l transition-all cursor-pointer ${
                            paymentMethod === 'card_10x'
                              ? 'bg-blue-100/50 text-blue-950 font-black text-sm'
                              : 'bg-blue-50/20 text-blue-800 text-xs hover:bg-blue-50/60'
                          }`}
                          title="Clique para selecionar Cartão em até 10x"
                        >
                          <div>{formatCurrency(cardPrice)}</div>
                          <div className="text-[9px] text-blue-600 font-semibold">
                            10x de {formatCurrency(cardInstallment10)}
                          </div>
                        </td>

                        {/* QUANTITY CONTROL */}
                        <td className="py-3 px-3 text-center">
                          <div className={`inline-flex items-center border rounded-lg overflow-hidden bg-white shadow-2xs ${
                            isLocked ? 'border-slate-200 bg-slate-100 opacity-60' : 'border-slate-300'
                          }`}>
                            <button
                              type="button"
                              onClick={() => updateQuantity(prod.id, -1)}
                              disabled={qty === 0 || isLocked}
                              className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                              title={isLocked ? 'Pedido bloqueado para alterações' : undefined}
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={qty || ''}
                              disabled={isLocked}
                              onChange={e => handleInputChange(prod.id, e.target.value)}
                              className="w-12 h-8 text-center text-xs font-bold text-slate-900 border-x border-slate-200 focus:outline-none focus:bg-blue-50 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                            />
                            <button
                              type="button"
                              onClick={() => updateQuantity(prod.id, 1)}
                              disabled={isLocked}
                              className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                              title={isLocked ? 'Pedido bloqueado para alterações' : undefined}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        {/* SUBTOTAL */}
                        <td className="py-3 px-4 text-right font-bold text-sm whitespace-nowrap">
                          <span className={isSelected ? 'text-blue-700 font-extrabold' : 'text-slate-400'}>
                            {formatCurrency(subtotal)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Step 4: Final Payment Definition */}
        <section className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">
                Etapa Final
              </span>
              <h3 className="text-base font-bold text-slate-900">
                3. Escolha a Forma de Pagamento do Pedido Completo
              </h3>
              <p className="text-xs text-slate-500">
                O valor total do seu pedido será calculado de acordo com a sua escolha:
              </p>
            </div>

            <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
              {orderItemsList.length} itens no carrinho
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Opção PIX */}
            <div
              onClick={() => handleSelectPaymentMethod('pix')}
              className={`p-5 rounded-2xl border-2 transition-all relative ${
                isPaymentSettled ? 'cursor-not-allowed opacity-90' : 'cursor-pointer hover:shadow-md'
              } ${
                paymentMethod === 'pix'
                  ? 'border-emerald-600 bg-gradient-to-br from-emerald-50/90 to-teal-50/70 shadow-md ring-2 ring-emerald-500/25'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl transition-colors ${
                    paymentMethod === 'pix'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    <QrCode className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-extrabold text-sm text-slate-900">
                        PIX à Vista
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-950">
                        Menor Preço
                      </span>
                      {paymentMethod === 'pix' && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                          ✓ SELECIONADO
                        </span>
                      )}
                      {isPaymentSettled && paymentMethod === 'pix' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                          Confirmado no Acerto
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Chave PIX e confirmação imediata
                    </p>
                  </div>
                </div>

                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  paymentMethod === 'pix'
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                    : 'border-slate-300 bg-white'
                }`}>
                  {paymentMethod === 'pix' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-emerald-200/60 flex items-center justify-between">
                <span className="text-xs text-slate-600 font-medium">Total no PIX:</span>
                <span className="text-xl font-black text-emerald-700">
                  {formatCurrency(totalOrderAmountPix)}
                </span>
              </div>
            </div>

            {/* Opção Cartão 10x */}
            <div
              onClick={() => handleSelectPaymentMethod('card_10x')}
              className={`p-5 rounded-2xl border-2 transition-all relative ${
                isPaymentSettled ? 'cursor-not-allowed opacity-90' : 'cursor-pointer hover:shadow-md'
              } ${
                paymentMethod === 'card_10x'
                  ? 'border-blue-600 bg-gradient-to-br from-blue-50/90 to-indigo-50/70 shadow-md ring-2 ring-blue-500/25'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl transition-colors ${
                    paymentMethod === 'card_10x'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-extrabold text-sm text-slate-900">
                        Cartão de Crédito em até 10x
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-200 text-blue-950">
                        Até 10x sem juros
                      </span>
                      {paymentMethod === 'card_10x' && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-2xs">
                          ✓ SELECIONADO
                        </span>
                      )}
                      {isPaymentSettled && paymentMethod === 'card_10x' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300">
                          Confirmado no Acerto
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Parcelamento facilitado no fechamento
                    </p>
                  </div>
                </div>

                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  paymentMethod === 'card_10x'
                    ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                    : 'border-slate-300 bg-white'
                }`}>
                  {paymentMethod === 'card_10x' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-blue-200/60 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-600 block font-medium">Total no Cartão:</span>
                  <span className="text-[11px] text-blue-700 font-bold">
                    10x de {formatCurrency(totalOrderAmountCard / 10)}
                  </span>
                </div>
                <span className="text-xl font-black text-blue-800">
                  {formatCurrency(totalOrderAmountCard)}
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Floating Bottom Bar with Selected Payment & Save Action */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-2xl py-3 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center justify-between w-full sm:w-auto gap-6">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                Itens Selecionados
              </span>
              <div className="text-xs sm:text-sm font-extrabold text-slate-800">
                {orderItemsList.length} produtos ({totalOrderUnits} un)
              </div>
            </div>

            {/* Selected payment indicator badge */}
            <div className="hidden sm:block">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                Condição Escolhida
              </span>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 mt-0.5">
                {paymentMethod === 'pix' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold">
                    <QrCode className="w-3 h-3 text-emerald-600" />
                    PIX à Vista
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 font-extrabold">
                    <CreditCard className="w-3 h-3 text-blue-600" />
                    Cartão em até 10x
                  </span>
                )}
              </div>
            </div>

            {/* Auto-save status in footer */}
            <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border bg-slate-50 border-slate-200">
              {autoSaveStatus === 'saving' ? (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  <span className="text-amber-700">Salvando rascunho...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Rascunho salvo</span>
                </>
              )}
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                Total a Pagar
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-600">
                {formatCurrency(totalOrderAmount)}
              </div>
            </div>
          </div>

          <div className="w-full sm:w-auto flex items-center gap-3">
            {isPaymentSettled ? (
              <div className="w-full sm:w-auto flex items-center gap-2">
                <div className="px-5 py-3 bg-emerald-100 text-emerald-900 font-bold text-xs rounded-xl text-center border border-emerald-300 flex items-center justify-center gap-2 shadow-xs">
                  <Lock className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Pagamento Acertado &bull; Pedido Fechado</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSavedSuccess(true)}
                  className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors whitespace-nowrap"
                >
                  Ver Resumo
                </button>
              </div>
            ) : remainingTime.isExpired ? (
              <div className="w-full sm:w-auto px-6 py-3 bg-rose-100 text-rose-800 font-bold text-xs rounded-xl text-center border border-rose-200">
                Prazo Encerrado - Pedido em Conferência
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || totalOrderUnits === 0}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                <Save className="w-4 h-4" />
                <span>
                  {isSaving
                    ? 'Salvando no Sistema...'
                    : `Confirmar Pedido no ${paymentMethod === 'pix' ? 'PIX' : 'Cartão 10x'}`}
                </span>
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Success Modal */}
      {isSavedSuccess && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 text-center animate-scaleIn">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h3 className="text-xl font-extrabold text-slate-900">
              Pedido Registrado com Sucesso!
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Suas quantidades e a forma de pagamento foram salvas no sistema e o distribuidor já recebeu sua solicitação.
            </p>

            <div className="my-5 p-4 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2">
              <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-500">Empresa / Cliente:</span>
                <strong className="text-slate-900">{clientName}</strong>
              </div>
              <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-500">CNPJ:</span>
                <strong className="text-slate-900">{formatCNPJ(clientCnpj)}</strong>
              </div>
              <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-500">WhatsApp:</span>
                <strong className="text-slate-900">{formatPhone(clientWhatsapp)}</strong>
              </div>
              <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-500">Forma de Pagamento:</span>
                <strong className="text-blue-700 font-bold">
                  {paymentMethod === 'pix' ? '🟢 PIX à Vista' : '💳 Cartão de Crédito (em até 10x)'}
                </strong>
              </div>
              {paymentMethod === 'card_10x' && (
                <div className="flex justify-between border-b border-slate-200/80 pb-1.5 text-blue-900">
                  <span className="text-slate-500">Parcelamento:</span>
                  <strong>10 parcelas de {formatCurrency(totalOrderAmount / 10)}</strong>
                </div>
              )}
              <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-500">Total de Unidades:</span>
                <strong className="text-slate-900">{totalOrderUnits} un ({orderItemsList.length} itens)</strong>
              </div>
              <div className="flex justify-between pt-1 text-sm">
                <span className="text-slate-700 font-bold">Total Final do Pedido:</span>
                <strong className="text-emerald-700 font-black">{formatCurrency(totalOrderAmount)}</strong>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const summary = `*PEDIDO CONFIRMADO*\nCliente: ${clientName}\nCNPJ: ${formatCNPJ(clientCnpj)}\nWhatsApp: ${formatPhone(clientWhatsapp)}\nForma de Pagamento: ${paymentMethod === 'pix' ? 'PIX à Vista' : 'Cartão de Crédito em até 10x'}\nTotal: ${formatCurrency(totalOrderAmount)} (${totalOrderUnits} unidades)\n${paymentMethod === 'card_10x' ? `Condição: 10x de ${formatCurrency(totalOrderAmount / 10)}\n` : ''}Data: ${new Date().toLocaleDateString('pt-BR')}`;
                  navigator.clipboard.writeText(summary);
                  setIsSummaryCopied(true);
                  setTimeout(() => setIsSummaryCopied(false), 2500);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold transition-all ${
                  isSummaryCopied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                {isSummaryCopied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{isSummaryCopied ? 'Resumo Copiado!' : 'Copiar Resumo WhatsApp'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSavedSuccess(false)}
                className="px-5 py-3 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
