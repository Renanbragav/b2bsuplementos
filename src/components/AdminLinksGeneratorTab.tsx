import React, { useState, useMemo } from 'react';
import { ClientOrder, ProductItem } from '../types';
import { formatCurrency, formatCNPJ, formatPhone } from '../lib/formatters';
import {
  Link as LinkIcon,
  Copy,
  Check,
  Send,
  Clock,
  Target,
  UserPlus,
  Share2,
  ExternalLink,
  Sparkles,
  QrCode,
  Building2,
  CheckSquare,
  Square,
  Filter
} from 'lucide-react';

interface AdminLinksGeneratorTabProps {
  campaignId: string;
  defaultDurationHours: number;
  defaultTargetAmount: number;
  orders: ClientOrder[];
  products: ProductItem[];
  onCreateClientLink: (data: {
    clientName: string;
    clientWhatsapp: string;
    clientCnpj: string;
    targetAmount: number;
    durationHours: number;
    allowedSuppliers?: string[];
  }) => Promise<string>;
  onOpenClientPortal: (order: ClientOrder) => void;
}

export const AdminLinksGeneratorTab: React.FC<AdminLinksGeneratorTabProps> = ({
  campaignId,
  defaultDurationHours,
  defaultTargetAmount,
  orders,
  products,
  onCreateClientLink,
  onOpenClientPortal,
}) => {
  const [clientName, setClientName] = useState('');
  const [clientWhatsapp, setClientWhatsapp] = useState('');
  const [clientCnpj, setClientCnpj] = useState('');
  const [targetAmount, setTargetAmount] = useState<number>(defaultTargetAmount || 2000);
  const [durationHours, setDurationHours] = useState<number>(defaultDurationHours || 48);

  // Supplier selection for specific link
  const availableSuppliers = useMemo(() => {
    return Array.from(new Set(products.map(p => p.supplier || 'Geral'))).sort();
  }, [products]);

  const [supplierScope, setSupplierScope] = useState<'all' | 'selected'>('all');
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);

  // Supplier selection for general campaign link
  const [generalSupplierScope, setGeneralSupplierScope] = useState<'all' | 'selected'>('all');
  const [generalSelectedSuppliers, setGeneralSelectedSuppliers] = useState<string[]>([]);

  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [lastCreatedOrder, setLastCreatedOrder] = useState<ClientOrder | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Toggle supplier selection
  const toggleSupplier = (sup: string) => {
    setSelectedSuppliers(prev =>
      prev.includes(sup) ? prev.filter(s => s !== sup) : [...prev, sup]
    );
  };

  const toggleGeneralSupplier = (sup: string) => {
    setGeneralSelectedSuppliers(prev =>
      prev.includes(sup) ? prev.filter(s => s !== sup) : [...prev, sup]
    );
  };

  // General Campaign Link
  const currentUrl = window.location.origin + window.location.pathname;
  const generalSuppliersQuery =
    generalSupplierScope === 'selected' && generalSelectedSuppliers.length > 0
      ? `&suppliers=${encodeURIComponent(generalSelectedSuppliers.join(','))}`
      : '';
  const generalCampaignLink = `${currentUrl}?portal=cliente&campaign=${campaignId}&goal=${defaultTargetAmount}&hours=${defaultDurationHours}${generalSuppliersQuery}`;
  const [copiedGeneral, setCopiedGeneral] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!clientName.trim()) {
      setValidationError('Por favor, informe o nome ou razão social do cliente.');
      return;
    }

    if (supplierScope === 'selected' && selectedSuppliers.length === 0) {
      setValidationError('Por favor, selecione pelo menos um fornecedor para liberar o pedido.');
      return;
    }

    setIsGenerating(true);
    try {
      const allowedSuppliersList =
        supplierScope === 'selected' && selectedSuppliers.length > 0
          ? selectedSuppliers
          : undefined;

      const orderId = await onCreateClientLink({
        clientName: clientName.trim(),
        clientWhatsapp: clientWhatsapp.trim(),
        clientCnpj: clientCnpj.trim(),
        targetAmount: Number(targetAmount),
        durationHours: Number(durationHours),
        allowedSuppliers: allowedSuppliersList,
      });

      let clientUrl = `${currentUrl}?portal=cliente&order=${orderId}&campaign=${campaignId}`;
      if (allowedSuppliersList && allowedSuppliersList.length > 0) {
        clientUrl += `&suppliers=${encodeURIComponent(allowedSuppliersList.join(','))}`;
      }
      setGeneratedLink(clientUrl);

      const createdOrder = orders.find(o => o.id === orderId) || {
        id: orderId,
        campaignId,
        clientName: clientName.trim(),
        clientWhatsapp: clientWhatsapp.trim(),
        clientCnpj: clientCnpj.trim(),
        targetAmount: Number(targetAmount),
        totalAmount: 0,
        totalItems: 0,
        durationHours: Number(durationHours),
        expiresAt: new Date(Date.now() + Number(durationHours) * 3600 * 1000).toISOString(),
        status: 'open',
        allowedSuppliers: allowedSuppliersList,
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setLastCreatedOrder(createdOrder as ClientOrder);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, isGeneral: boolean = false) => {
    navigator.clipboard.writeText(text);
    if (isGeneral) {
      setCopiedGeneral(true);
      setTimeout(() => setCopiedGeneral(false), 2500);
    } else {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const getWhatsAppShareUrl = (link: string, name: string, goal: number, hours: number, suppliers?: string[]) => {
    const suppliersInfo = suppliers && suppliers.length > 0
      ? `\n🏭 *Fornecedores Disponíveis:* ${suppliers.join(', ')}`
      : '';

    const text = `Olá ${name || 'Parceiro'}, tudo bem?\n\nSegue seu link exclusivo para registrar seu pedido no nosso *Pedido Conjunto B2B* com condições especiais direto dos fornecedores:\n\n🔗 ${link}\n${suppliersInfo}\n\n⏱ *Prazo para envio:* ${hours} horas\n🎯 *Meta recomendada:* ${formatCurrency(goal)}\n\nBasta abrir o link, selecionar as quantidades e definir se deseja pagar via PIX ou Cartão em até 10x!`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="space-y-6">
      {/* Introduction Card */}
      <div className="bg-gradient-to-br from-blue-900 to-indigo-900 text-white p-6 rounded-2xl shadow-sm border border-blue-800/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-300">
              Controle de Metas, Prazos & Fornecedores
            </span>
            <h3 className="text-2xl font-bold mt-1 text-white">Gerador de Links para Clientes</h3>
            <p className="text-sm text-blue-100/90 mt-1 max-w-2xl">
              Escolha <strong>qual fornecedor o cliente poderá fazer pedido</strong> antes de enviar o link. O cliente terá acesso aos itens apenas dos fornecedores selecionados, com preços no PIX e Cartão até 10x.
            </p>
          </div>

          <div className="bg-blue-800/60 p-3 rounded-xl border border-blue-700/60 text-xs text-blue-200">
            <div>⏱ Horas Padrão: <strong>{defaultDurationHours}h</strong></div>
            <div className="mt-1">🎯 Meta Padrão: <strong>{formatCurrency(defaultTargetAmount)}</strong></div>
            <div className="mt-1 text-emerald-300">🏭 Fornecedores: <strong>{availableSuppliers.length} cadastrados</strong></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form to create customized client link */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-100">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Configurar Link para Cliente Específico</h4>
              <p className="text-xs text-slate-500">Defina fornecedor(es), prazo e meta individual antes de enviar</p>
            </div>
          </div>

          {validationError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold">
              {validationError}
            </div>
          )}

          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome do Cliente ou Razão Social *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Mercado Bela Vista / João da Silva"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  WhatsApp do Cliente (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: (11) 98765-4321"
                  value={clientWhatsapp}
                  onChange={e => setClientWhatsapp(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  CNPJ da Empresa (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 00.000.000/0000-00"
                  value={clientCnpj}
                  onChange={e => setClientCnpj(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* SELEÇÃO DO FORNECEDOR (Exigência do usuário) */}
            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-bold text-amber-950">
                    Escolher Fornecedor(es) para este Cliente *
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                  Exclusividade de Pedido
                </span>
              </div>
              <p className="text-[11px] text-amber-800/90 leading-tight">
                O cliente fará pedido <strong>apenas dos itens dos fornecedores que você selecionar abaixo</strong>. Os demais fornecedores ficarão ocultos para ele.
              </p>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setSupplierScope('all')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all text-center ${
                    supplierScope === 'all'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Todos os Fornecedores ({availableSuppliers.length})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSupplierScope('selected');
                    if (selectedSuppliers.length === 0 && availableSuppliers.length > 0) {
                      setSelectedSuppliers([availableSuppliers[0]]);
                    }
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all text-center ${
                    supplierScope === 'selected'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Fornecedores Específicos {selectedSuppliers.length > 0 ? `(${selectedSuppliers.length})` : ''}
                </button>
              </div>

              {supplierScope === 'selected' && (
                <div className="pt-2 border-t border-amber-200/60 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span className="font-semibold">Marque os fornecedores permitidos:</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedSuppliers([...availableSuppliers])}
                        className="text-blue-600 hover:underline font-bold"
                      >
                        Marcar Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSuppliers([])}
                        className="text-slate-500 hover:underline"
                      >
                        Desmarcar
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {availableSuppliers.length === 0 ? (
                      <p className="text-xs text-slate-400 italic col-span-2">
                        Nenhum fornecedor cadastrado no catálogo ainda.
                      </p>
                    ) : (
                      availableSuppliers.map(sup => {
                        const isChecked = selectedSuppliers.includes(sup);
                        const count = products.filter(p => p.supplier === sup).length;

                        return (
                          <div
                            key={sup}
                            onClick={() => toggleSupplier(sup)}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border text-xs transition-all ${
                              isChecked
                                ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                              <span className="truncate">{sup}</span>
                            </div>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono shrink-0 ml-1">
                              {count} {count === 1 ? 'item' : 'itens'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-1">
                  <Target className="w-4 h-4 text-emerald-600" />
                  <span>Meta de Valor (R$) *</span>
                </div>
                <p className="text-[11px] text-slate-500 mb-2">Objetivo que o cliente deve atingir no carrinho</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">R$</span>
                  <input
                    type="number"
                    min="1"
                    step="50"
                    required
                    value={targetAmount}
                    onChange={e => setTargetAmount(Number(e.target.value))}
                    className="w-full pl-8 pr-3 py-1.5 text-sm font-bold text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-1">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Tempo Limite (Horas) *</span>
                </div>
                <p className="text-[11px] text-slate-500 mb-2">Quantas horas o cliente terá para responder</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="720"
                    required
                    value={durationHours}
                    onChange={e => setDurationHours(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-sm font-bold text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-600">horas</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              {[24, 48, 72].map(h => (
                <button
                  type="button"
                  key={h}
                  onClick={() => setDurationHours(h)}
                  className={`px-3 py-1 text-xs rounded-lg border transition-all ${
                    durationHours === h
                      ? 'bg-blue-600 text-white font-bold border-blue-600'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  {h} horas
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              <LinkIcon className="w-4 h-4" />
              <span>{isGenerating ? 'Gerando Link...' : 'Gerar Link com Fornecedores Selecionados'}</span>
            </button>
          </form>

          {/* Generated Result Card */}
          {generatedLink && (
            <div className="mt-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 animate-fadeIn space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Link Exclusivo Gerado para {clientName}!
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Meta: {formatCurrency(targetAmount)} | {durationHours}h
                </span>
              </div>

              {supplierScope === 'selected' && selectedSuppliers.length > 0 && (
                <div className="text-[11px] text-blue-900 bg-blue-100/70 p-2 rounded-lg font-semibold flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                  <span>
                    Fornecedor(es) liberado(s) neste link: <strong>{selectedSuppliers.join(', ')}</strong>
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-emerald-200">
                <input
                  type="text"
                  readOnly
                  value={generatedLink}
                  className="w-full text-xs bg-transparent border-none focus:outline-none text-slate-700 font-mono truncate"
                />
                <button
                  onClick={() => copyToClipboard(generatedLink)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <a
                  href={getWhatsAppShareUrl(
                    generatedLink,
                    clientName,
                    targetAmount,
                    durationHours,
                    supplierScope === 'selected' ? selectedSuppliers : undefined
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar pelo WhatsApp</span>
                </a>
                {lastCreatedOrder && (
                  <button
                    onClick={() => onOpenClientPortal(lastCreatedOrder)}
                    className="flex items-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Testar Link</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* General Campaign Link & Quick Instructions */}
        <div className="lg:col-span-5 space-y-4">
          {/* General Open Link */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Share2 className="w-4 h-4 text-emerald-600" />
              <span>Link Geral da Rodada (Aberto)</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Use este link geral para enviar em grupos de WhatsApp. O cliente informará os dados no primeiro acesso e verá os fornecedores escolhidos.
            </p>

            {/* General Supplier Filter */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Filtrar Fornecedor do Link Geral:</span>
                <select
                  value={generalSupplierScope === 'all' ? 'all' : generalSelectedSuppliers[0] || 'all'}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === 'all') {
                      setGeneralSupplierScope('all');
                      setGeneralSelectedSuppliers([]);
                    } else {
                      setGeneralSupplierScope('selected');
                      setGeneralSelectedSuppliers([val]);
                    }
                  }}
                  className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-slate-800 focus:outline-none"
                >
                  <option value="all">Todos os Fornecedores</option>
                  {availableSuppliers.map(s => (
                    <option key={s} value={s}>
                      Apenas {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                <span>Meta padrão: <strong>{formatCurrency(defaultTargetAmount)}</strong></span>
                <span>Prazo: <strong>{defaultDurationHours}h</strong></span>
              </div>

              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                <input
                  type="text"
                  readOnly
                  value={generalCampaignLink}
                  className="w-full text-xs font-mono text-slate-600 bg-transparent border-none focus:outline-none truncate"
                />
                <button
                  onClick={() => copyToClipboard(generalCampaignLink, true)}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Copiar link geral"
                >
                  {copiedGeneral ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Participe da nossa rodada de compras coletivas B2B com preços especiais de fornecedores direto de fábrica!\n\n${
                    generalSupplierScope === 'selected' && generalSelectedSuppliers.length > 0
                      ? `Fornecedor liberado: ${generalSelectedSuppliers.join(', ')}\n`
                      : ''
                  }Acesse o catálogo e faça seu pedido (PIX ou Cartão em até 10x): ${generalCampaignLink}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 transition-all"
              >
                <Send className="w-4 h-4" />
                <span>Compartilhar Link Geral no WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Quick FAQ / Guide */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700">Como funciona o novo fluxo</h5>
            <ul className="text-xs text-slate-600 space-y-2">
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                <span>Você seleciona o(s) fornecedor(es) desejado(s), meta e tempo limite.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                <span>O cliente abre o link e visualiza <strong>somente os produtos do(s) fornecedor(es) escolhido(s)</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                <span>O cliente vê as <strong>duas colunas de preços: PIX e Cartão até 10x</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">4</span>
                <span>Ao final do pedido, o cliente define se pagará o pedido todo no <strong>PIX</strong> ou no <strong>Cartão</strong>.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
