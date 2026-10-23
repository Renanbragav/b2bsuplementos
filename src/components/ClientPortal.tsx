import React, { useState, useEffect } from 'react';
import { ProductItem, ClientOrder, OrderItem } from '../types';
import {
  formatCurrency,
  formatCNPJ,
  formatPhone,
  getRemainingTime,
  isValidCNPJ
} from '../lib/formatters';
import {
  ShoppingBag,
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
  Check,
  Share2,
  Lock,
  ArrowLeft,
  Sparkles
} from 'lucide-react';

interface ClientPortalProps {
  products: ProductItem[];
  currentOrder: ClientOrder | null;
  campaignTitle: string;
  defaultDurationHours: number;
  defaultTargetAmount: number;
  onSaveClientOrder: (order: Partial<ClientOrder> & { items: OrderItem[] }) => Promise<void>;
  onBackToAdmin?: () => void;
  isAdminView?: boolean;
}

export const ClientPortal: React.FC<ClientPortalProps> = ({
  products,
  currentOrder,
  campaignTitle,
  defaultDurationHours,
  defaultTargetAmount,
  onSaveClientOrder,
  onBackToAdmin,
  isAdminView = false,
}) => {
  // Client Info State
  const [clientName, setClientName] = useState(currentOrder?.clientName || '');
  const [clientWhatsapp, setClientWhatsapp] = useState(currentOrder?.clientWhatsapp || '');
  const [clientCnpj, setClientCnpj] = useState(currentOrder?.clientCnpj || '');
  const [isEditingInfo, setIsEditingInfo] = useState(!currentOrder?.clientName);

  // Target and Deadline from currentOrder or defaults
  const targetAmount = currentOrder?.targetAmount ?? defaultTargetAmount;
  const durationHours = currentOrder?.durationHours ?? defaultDurationHours;
  const expiresAt =
    currentOrder?.expiresAt ||
    new Date(Date.now() + durationHours * 3600 * 1000).toISOString();

  // Quantities State map: productId -> quantity
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState('all');

  // Timer State (ticks every second)
  const [remainingTime, setRemainingTime] = useState(getRemainingTime(expiresAt));

  // Save feedback state
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [savedOrderResult, setSavedOrderResult] = useState<ClientOrder | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize quantities from currentOrder if available
  useEffect(() => {
    if (currentOrder?.items) {
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
      setQuantities(initialMap);
    }
  }, [currentOrder]);

  // Live timer tick
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingTime(getRemainingTime(expiresAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  // Unique categories and suppliers
  const categories = Array.from(new Set(products.map(p => p.category || 'Geral'))).sort();
  const suppliers = Array.from(new Set(products.map(p => p.supplier || 'Geral'))).sort();

  // Handle quantity changes
  const updateQuantity = (productId: string, delta: number) => {
    if (remainingTime.isExpired) return;
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

  const setDirectQuantity = (productId: string, val: string) => {
    if (remainingTime.isExpired) return;
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

  // Calculate order totals
  let totalOrderAmount = 0;
  let totalOrderItems = 0;
  const orderItemsList: OrderItem[] = [];

  products.forEach(p => {
    const qty = quantities[p.id] || 0;
    if (qty > 0) {
      const subtotal = Number((qty * p.unitPrice).toFixed(2));
      totalOrderAmount += subtotal;
      totalOrderItems += qty;
      orderItemsList.push({
        productId: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        supplier: p.supplier,
        unit: p.unit,
        costPrice: p.costPrice,
        unitPrice: p.unitPrice,
        quantity: qty,
        subtotal,
      });
    }
  });

  const progressPercent = targetAmount > 0 ? Math.min(100, (totalOrderAmount / targetAmount) * 100) : 100;
  const isGoalReached = targetAmount > 0 ? totalOrderAmount >= targetAmount : true;
  const remainingToGoal = Math.max(0, targetAmount - totalOrderAmount);

  const handleSaveOrder = async () => {
    setValidationError(null);

    if (!clientName.trim()) {
      setValidationError('Por favor, informe seu Nome ou Razão Social.');
      setIsEditingInfo(true);
      return;
    }

    if (!clientWhatsapp.trim()) {
      setValidationError('Por favor, informe seu WhatsApp para contato.');
      setIsEditingInfo(true);
      return;
    }

    if (!clientCnpj.trim()) {
      setValidationError('Por favor, informe o CNPJ da sua empresa.');
      setIsEditingInfo(true);
      return;
    }

    if (totalOrderItems === 0) {
      setValidationError('Por favor, selecione as quantidades de ao menos um produto antes de salvar.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        clientName: clientName.trim(),
        clientWhatsapp: clientWhatsapp.trim(),
        clientCnpj: clientCnpj.trim(),
        targetAmount,
        totalAmount: totalOrderAmount,
        totalItems: totalOrderItems,
        durationHours,
        expiresAt,
        status: 'submitted' as const,
        items: orderItemsList,
      };

      await onSaveClientOrder(payload);

      setSavedOrderResult({
        id: currentOrder?.id || `ord_${Date.now()}`,
        campaignId: currentOrder?.campaignId || 'default',
        ...payload,
        createdAt: currentOrder?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setIsSuccessModalOpen(true);
      setIsEditingInfo(false);
    } catch (err: any) {
      setValidationError('Erro ao salvar pedido no Firebase: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.supplier.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSupplier = selectedSupplier === 'all' || p.supplier === selectedSupplier;
    return matchesSearch && matchesCategory && matchesSupplier;
  });

  return (
    <div className="min-h-screen bg-slate-100/70 pb-36">
      {/* Top Bar for Admin Return & Notice */}
      {isAdminView && onBackToAdmin && (
        <div className="bg-blue-900 text-white px-4 py-2 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="bg-blue-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px]">
              Modo de Simulação
            </span>
            <span>Você está visualizando a tela exatamente como o cliente vê.</span>
          </div>
          <button
            onClick={onBackToAdmin}
            className="flex items-center gap-1 bg-white text-blue-950 px-3 py-1 rounded-lg font-bold hover:bg-blue-50 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Painel Admin</span>
          </button>
        </div>
      )}

      {/* Hero Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5" />
                Pedido Conjunto B2B
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1">
                {campaignTitle || 'Catálogo de Compras Compartilhadas'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
                Selecione as quantidades desejadas de cada produto. O pedido consolidado garante preços de atacado direto das indústrias e distribuidores.
              </p>
            </div>

            {/* Countdown Badge */}
            <div className={`p-4 rounded-2xl border flex items-center gap-3 self-start md:self-center ${
              remainingTime.isExpired
                ? 'bg-rose-950/80 border-rose-800 text-rose-200'
                : 'bg-slate-800/90 border-slate-700/80 text-white shadow-lg'
            }`}>
              <div className={`p-2.5 rounded-xl ${
                remainingTime.isExpired ? 'bg-rose-900 text-rose-300' : 'bg-blue-600 text-white animate-pulse'
              }`}>
                {remainingTime.isExpired ? <Lock className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block">
                  {remainingTime.isExpired ? 'Status do Pedido' : 'Tempo Restante para Envio'}
                </span>
                <span className={`text-lg sm:text-xl font-mono font-bold tracking-tight ${
                  remainingTime.isExpired ? 'text-rose-400' : 'text-amber-300'
                }`}>
                  {remainingTime.formatted}
                </span>
              </div>
            </div>
          </div>

          {/* Client Identification Card */}
          <div className="mt-6 bg-slate-800/80 rounded-2xl p-4 sm:p-5 border border-slate-700/90 backdrop-blur-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Identificação da Empresa / Cliente</h3>
              </div>
              {clientName && (
                <button
                  type="button"
                  onClick={() => setIsEditingInfo(!isEditingInfo)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold self-start sm:self-center"
                >
                  {isEditingInfo ? 'Concluir Edição' : 'Editar Dados'}
                </button>
              )}
            </div>

            {isEditingInfo ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Nome Completo ou Razão Social *
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: Mercado Central Ltda"
                      value={clientName}
                      onChange={e => setClientName(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    WhatsApp para Contato *
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: (11) 98765-4321"
                      value={clientWhatsapp}
                      onChange={e => setClientWhatsapp(formatPhone(e.target.value))}
                      className="w-full text-xs pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    CNPJ da Empresa *
                  </label>
                  <div className="relative">
                    <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: 00.000.000/0000-00"
                      value={clientCnpj}
                      onChange={e => setClientCnpj(formatCNPJ(e.target.value))}
                      className="w-full text-xs pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Cliente / Razão Social:</span>
                  <strong className="text-white text-sm">{clientName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">WhatsApp:</span>
                  <strong className="text-white text-sm">{clientWhatsapp}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">CNPJ:</span>
                  <strong className="text-white text-sm">{clientCnpj}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Progress & Goal Bar */}
      <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl shrink-0 ${
                isGoalReached ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {isGoalReached ? <CheckCircle2 className="w-5 h-5" /> : <Target className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    Sua Meta: {formatCurrency(targetAmount)}
                  </span>
                  {isGoalReached ? (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      🎉 Meta Atingida!
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-500">
                      (Faltam {formatCurrency(remainingToGoal)})
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  Total Selecionado: <strong className="text-slate-900 font-bold">{formatCurrency(totalOrderAmount)}</strong> ({totalOrderItems} unidades)
                </div>
              </div>
            </div>

            <div className="w-full sm:w-64">
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-slate-500">Progresso</span>
                <span className={isGoalReached ? 'text-emerald-600 font-bold' : 'text-blue-600'}>
                  {progressPercent.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    isGoalReached
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        {/* Validation Error Banner */}
        {validationError && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
            <button onClick={() => setValidationError(null)} className="underline ml-4">
              Dispensar
            </button>
          </div>
        )}

        {/* Search & Category Filter */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs mb-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por produto, SKU ou fornecedor..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas Categorias ({products.length})
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 text-base">Nenhum produto encontrado</h3>
            <p className="text-xs text-slate-400 mt-1">Tente pesquisar por outro termo ou limpar os filtros.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map(prod => {
              const qty = quantities[prod.id] || 0;
              const subtotal = qty * prod.unitPrice;
              const hasQuantity = qty > 0;

              return (
                <div
                  key={prod.id}
                  className={`bg-white rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                    hasQuantity
                      ? 'border-emerald-500 shadow-md ring-1 ring-emerald-500/20'
                      : 'border-slate-200/90 shadow-xs hover:border-slate-300'
                  }`}
                >
                  <div>
                    {/* Tags */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {prod.category}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{prod.sku}</span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 mb-1">
                      {prod.name}
                    </h4>

                    <div className="text-[11px] text-slate-500 mb-3 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      <span>{prod.supplier}</span>
                    </div>

                    {/* Price and Unit */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Preço Unitário</div>
                      <div className="flex items-baseline justify-between mt-0.5">
                        <span className="text-lg font-extrabold text-slate-900">
                          {formatCurrency(prod.unitPrice)}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          / {prod.unit}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                        <button
                          type="button"
                          onClick={() => updateQuantity(prod.id, -1)}
                          disabled={qty === 0 || remainingTime.isExpired}
                          className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={qty || ''}
                          placeholder="0"
                          disabled={remainingTime.isExpired}
                          onChange={e => setDirectQuantity(prod.id, e.target.value)}
                          className="w-12 h-9 text-center text-xs font-bold bg-white text-slate-900 border-x border-slate-200 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateQuantity(prod.id, 1)}
                          disabled={remainingTime.isExpired}
                          className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Subtotal</span>
                        <span className={`text-xs font-bold ${hasQuantity ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {formatCurrency(subtotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fixed Bottom Checkout / Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-2xl py-3 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center justify-between w-full sm:w-auto gap-6">
            <div>
              <span className="text-[11px] text-slate-500 uppercase font-semibold">Itens Selecionados</span>
              <div className="text-sm font-bold text-slate-800">
                {orderItemsList.length} itens ({totalOrderItems} un)
              </div>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 uppercase font-semibold">Valor Total do Pedido</span>
              <div className="text-xl sm:text-2xl font-black text-emerald-600">
                {formatCurrency(totalOrderAmount)}
              </div>
            </div>
          </div>

          <div className="w-full sm:w-auto flex items-center gap-3">
            {remainingTime.isExpired ? (
              <div className="w-full sm:w-auto px-6 py-3 bg-rose-100 text-rose-800 font-bold text-xs rounded-xl text-center border border-rose-200">
                Prazo Encerrado - Pedido em Conferência
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSaveOrder}
                disabled={isSaving || totalOrderItems === 0}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Gravando no Firebase...' : 'Salvar Pedido / Registrar Interesse'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Success Confirmation Modal */}
      {isSuccessModalOpen && savedOrderResult && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-center animate-scaleIn">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Interesse Registrado com Sucesso!
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              Seu pedido conjunto foi salvo na nuvem com segurança. O administrador recebeu suas quantidades.
            </p>

            <div className="my-5 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2">
              <div className="flex justify-between border-b border-slate-200/80 pb-2">
                <span className="text-slate-500">Cliente / Razão Social:</span>
                <strong className="text-slate-900">{savedOrderResult.clientName}</strong>
              </div>
              <div className="flex justify-between border-b border-slate-200/80 pb-2">
                <span className="text-slate-500">CNPJ:</span>
                <strong className="text-slate-900">{savedOrderResult.clientCnpj}</strong>
              </div>
              <div className="flex justify-between border-b border-slate-200/80 pb-2">
                <span className="text-slate-500">WhatsApp:</span>
                <strong className="text-slate-900">{savedOrderResult.clientWhatsapp}</strong>
              </div>
              <div className="flex justify-between border-b border-slate-200/80 pb-2">
                <span className="text-slate-500">Total de Unidades:</span>
                <strong className="text-slate-900">{savedOrderResult.totalItems} unidades</strong>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-700 font-bold">Valor Total Registrado:</span>
                <strong className="text-emerald-700 font-extrabold text-sm">
                  {formatCurrency(savedOrderResult.totalAmount)}
                </strong>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const summary = `*PEDIDO CONJUNTO REGISTRADO*\nCliente: ${savedOrderResult.clientName}\nCNPJ: ${savedOrderResult.clientCnpj}\nTotal: ${formatCurrency(savedOrderResult.totalAmount)} (${savedOrderResult.totalItems} un)\nData: ${new Date().toLocaleDateString('pt-BR')}`;
                  navigator.clipboard.writeText(summary);
                  alert('Resumo do pedido copiado para a área de transferência!');
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Copiar Resumo</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSuccessModalOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
