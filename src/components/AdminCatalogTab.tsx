import React, { useState, useRef } from 'react';
import { ProductItem } from '../types';
import { parseSpreadsheet, downloadSampleSpreadsheet, getInitialSampleProducts } from '../lib/spreadsheet';
import { formatCurrency } from '../lib/formatters';
import {
  Upload,
  FileSpreadsheet,
  Download,
  Percent,
  Plus,
  Trash2,
  Edit2,
  Check,
  Search,
  AlertCircle,
  Sparkles,
  Building2,
  RefreshCw
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface AdminCatalogTabProps {
  products: ProductItem[];
  markupPercent: number;
  markupPercentPix?: number;
  markupPercentCard?: number;
  onUpdateMarkupPercent: (percent: number) => Promise<void>;
  onUpdateMarkupPercents?: (pix: number, card: number) => Promise<void>;
  onAddProducts: (newProducts: ProductItem[]) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onClearAllProducts: () => Promise<void>;
  campaignId: string;
}

export const AdminCatalogTab: React.FC<AdminCatalogTabProps> = ({
  products,
  markupPercent,
  markupPercentPix,
  markupPercentCard,
  onUpdateMarkupPercent,
  onUpdateMarkupPercents,
  onAddProducts,
  onDeleteProduct,
  onClearAllProducts,
  campaignId,
}) => {
  const [newMarkupPix, setNewMarkupPix] = useState<number>(markupPercentPix ?? markupPercent ?? 15);
  const [newMarkupCard, setNewMarkupCard] = useState<number>(markupPercentCard ?? 25);
  const [isApplyingMarkup, setIsApplyingMarkup] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [supplierInput, setSupplierInput] = useState('');
  const [uploadMessage, setUploadMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('all');

  // Confirmation states
  const [productToDelete, setProductToDelete] = useState<ProductItem | null>(null);
  const [isConfirmingClearAll, setIsConfirmingClearAll] = useState(false);
  const [isDeletingAction, setIsDeletingAction] = useState(false);

  // New product manual modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('');
  const [newProdSupplier, setNewProdSupplier] = useState('');
  const [newProdBrand, setNewProdBrand] = useState('');
  const [newProdBoxQty, setNewProdBoxQty] = useState('1');
  const [newProdEan, setNewProdEan] = useState('');
  const [newProdCost, setNewProdCost] = useState('');
  const [newProdUnit, setNewProdUnit] = useState('un');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const suppliers = Array.from(new Set(products.map(p => p.supplier || 'Geral'))).sort();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!supplierInput.trim()) {
      setUploadMessage({
        text: 'Atenção: É obrigatório identificar o Fornecedor no campo ao lado antes de importar a planilha!',
        type: 'error',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    setUploadMessage(null);

    try {
      const { products: parsed, errors } = await parseSpreadsheet(
        file,
        campaignId,
        supplierInput.trim(),
        newMarkupPix,
        newMarkupCard
      );

      if (parsed.length === 0) {
        setUploadMessage({
          text: errors[0] || 'Nenhum produto válido encontrado no arquivo.',
          type: 'error',
        });
      } else {
        await onAddProducts(parsed);
        setUploadMessage({
          text: `Sucesso! ${parsed.length} produtos do fornecedor "${supplierInput.trim()}" importados com margem PIX (+${newMarkupPix}%) e Cartão (+${newMarkupCard}%).`,
          type: 'success',
        });
      }
    } catch (err: any) {
      setUploadMessage({ text: err.message || 'Erro ao processar planilha.', type: 'error' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApplyMarkup = async () => {
    if (newMarkupPix < 0 || newMarkupCard < 0) return;
    setIsApplyingMarkup(true);
    try {
      if (onUpdateMarkupPercents) {
        await onUpdateMarkupPercents(newMarkupPix, newMarkupCard);
      } else {
        await onUpdateMarkupPercent(newMarkupPix);
      }
      setUploadMessage({
        text: `Margens de +${newMarkupPix}% (PIX) e +${newMarkupCard}% (Cartão 10x) aplicadas com sucesso a todos os produtos!`,
        type: 'success',
      });
    } catch (err: any) {
      setUploadMessage({ text: 'Falha ao atualizar margens percentuais.', type: 'error' });
    } finally {
      setIsApplyingMarkup(false);
    }
  };

  const handleLoadDemoCatalog = async () => {
    const demoItems = getInitialSampleProducts(campaignId, newMarkupPix, newMarkupCard);
    await onAddProducts(demoItems);
    setUploadMessage({
      text: `${demoItems.length} produtos de exemplo adicionados ao catálogo com preços PIX e Cartão!`,
      type: 'success',
    });
  };

  const handleCreateManualProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdCost) return;
    const finalSupplier = newProdSupplier.trim() || supplierInput.trim();
    if (!finalSupplier) {
      setUploadMessage({ text: 'É obrigatório informar o fornecedor do produto.', type: 'error' });
      return;
    }

    const costPrice = parseFloat(newProdCost.replace(',', '.')) || 0;
    const unitPricePix = Number((costPrice * (1 + newMarkupPix / 100)).toFixed(2));
    const unitPriceCard = Number((costPrice * (1 + newMarkupCard / 100)).toFixed(2));
    const unitPrice = unitPricePix;
    const boxQty = parseInt(newProdBoxQty, 10) || 1;

    const item: ProductItem = {
      id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      campaignId,
      name: newProdName,
      sku: newProdSku || `SKU-${Date.now().toString().slice(-4)}`,
      category: newProdCategory || 'Geral',
      supplier: finalSupplier,
      brand: newProdBrand || finalSupplier,
      quantityPerBox: boxQty,
      ean: newProdEan || '',
      costPrice,
      unitPrice,
      unitPricePix,
      unitPriceCard,
      unit: newProdUnit || 'un',
      minQuantity: 1,
      createdAt: new Date().toISOString(),
    };

    await onAddProducts([item]);
    setIsAddModalOpen(false);
    setNewProdName('');
    setNewProdSku('');
    setNewProdCost('');
    setNewProdBrand('');
    setNewProdBoxQty('1');
    setNewProdEan('');
    setUploadMessage({ text: `Produto "${item.name}" adicionado com sucesso!`, type: 'success' });
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSupplier = selectedSupplier === 'all' || p.supplier === selectedSupplier;
    return matchesSearch && matchesSupplier;
  });

  return (
    <div className="space-y-6">
      {/* Feedback banner */}
      {uploadMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm ${
            uploadMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{uploadMessage.text}</span>
          <button onClick={() => setUploadMessage(null)} className="text-xs font-bold underline ml-4">
            Fechar
          </button>
        </div>
      )}

      {/* Top 2 Columns: 1) Upload Planilhas de Fornecedores, 2) Margem Percentual */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upload Planilhas */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Upload de Planilhas de Fornecedores</h3>
                <p className="text-xs text-slate-500">Envie arquivos Excel (.xlsx, .xls) ou CSV de qualquer distribuidor</p>
              </div>
            </div>

            <button
              onClick={downloadSampleSpreadsheet}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              title="Baixar planilha de exemplo para preencher"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Baixar Modelo</span>
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                  <span>Fornecedor da Planilha * (Obrigatório)</span>
                  <span className="text-[10px] text-rose-600 font-semibold">Exigido</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Ambev, Nestlé, Torrefação Minas..."
                  value={supplierInput}
                  onChange={e => setSupplierInput(e.target.value)}
                  className={`w-full text-xs px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold ${
                    !supplierInput.trim()
                      ? 'bg-amber-50/60 border border-amber-300 text-slate-800 placeholder:text-amber-800/60'
                      : 'bg-slate-50 border border-slate-200 text-slate-900'
                  }`}
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  Identifique a qual fornecedor pertencem os produtos desta planilha.
                </span>
              </div>

              <div className="flex flex-col justify-end">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  id="spreadsheet-upload-input"
                />
                <label
                  htmlFor="spreadsheet-upload-input"
                  onClick={e => {
                    if (!supplierInput.trim()) {
                      e.preventDefault();
                      setUploadMessage({
                        text: 'Atenção: Digite o Nome do Fornecedor antes de selecionar o arquivo da planilha.',
                        type: 'error',
                      });
                    }
                  }}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm transition-all ${
                    !supplierInput.trim()
                      ? 'bg-slate-400 hover:bg-slate-500'
                      : 'bg-blue-600 hover:bg-blue-700'
                  } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{isUploading ? 'Processando arquivo...' : 'Selecionar Arquivo Excel / CSV'}</span>
                </label>
                <span className="text-[10px] text-center text-slate-400 mt-1">
                  Lê colunas: Produto, Custo, Qtd por Caixa, Marca, SKU, EAN...
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 text-xs">
              <button
                onClick={handleLoadDemoCatalog}
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-semibold hover:text-blue-700"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Carregar catálogo de exemplo pronto (10 produtos B2B)</span>
              </button>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-1 text-slate-700 font-medium hover:text-slate-900"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar produto avulso</span>
              </button>
            </div>
          </div>
        </div>

        {/* Margem Percentual Dupla: PIX e Cartão em até 10x */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-sm border border-slate-700/80 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <Percent className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Percentuais de Acréscimo (Preços)</h3>
                <p className="text-xs text-slate-400">Gera automaticamente as duas colunas: PIX e Cartão 10x</p>
              </div>
            </div>

            <div className="space-y-3 mt-3">
              {/* PIX Markup */}
              <div className="bg-slate-800/90 p-3.5 rounded-xl border border-emerald-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    1. Acréscimo PIX à Vista:
                  </span>
                  <span className="text-xl font-black text-emerald-300">+{newMarkupPix}%</span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={newMarkupPix}
                    onChange={e => setNewMarkupPix(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="relative w-20 shrink-0">
                    <input
                      type="number"
                      min="0"
                      max="500"
                      value={newMarkupPix}
                      onChange={e => setNewMarkupPix(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-900 text-emerald-300 font-bold text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 text-right pr-6 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                  </div>
                </div>
              </div>

              {/* Card 10x Markup */}
              <div className="bg-slate-800/90 p-3.5 rounded-xl border border-blue-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    2. Acréscimo Cartão em até 10x:
                  </span>
                  <span className="text-xl font-black text-blue-300">+{newMarkupCard}%</span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={newMarkupCard}
                    onChange={e => setNewMarkupCard(Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                  <div className="relative w-20 shrink-0">
                    <input
                      type="number"
                      min="0"
                      max="500"
                      value={newMarkupCard}
                      onChange={e => setNewMarkupCard(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-900 text-blue-300 font-bold text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 text-right pr-6 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-700/80 flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-400 leading-tight">
              Recalcula as 2 colunas de preços de venda para todos os clientes
            </span>
            <button
              onClick={handleApplyMarkup}
              disabled={isApplyingMarkup}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-600 hover:to-teal-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-all whitespace-nowrap"
            >
              {isApplyingMarkup ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>{isApplyingMarkup ? 'Aplicando...' : 'Aplicar Preços PIX e Cartão'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <h4 className="text-sm font-bold text-slate-900 whitespace-nowrap">
              Produtos no Catálogo ({filteredProducts.length})
            </h4>

            {products.length > 0 && (
              <button
                onClick={() => setIsConfirmingClearAll(true)}
                className="text-xs text-rose-600 hover:text-rose-700 hover:underline font-bold transition-colors"
              >
                Limpar Catálogo
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar por nome, SKU..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={selectedSupplier}
              onChange={e => setSelectedSupplier(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 font-medium focus:outline-none"
            >
              <option value="all">Todos Fornecedores</option>
              {suppliers.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-800 text-sm">Nenhum produto cadastrado</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Faça upload de uma planilha Excel de fornecedor ou clique em &ldquo;Carregar catálogo de exemplo pronto&rdquo; para começar.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-3 px-3">Código / SKU</th>
                  <th className="py-3 px-3">Produto</th>
                  <th className="py-3 px-3">Marca</th>
                  <th className="py-3 px-3">Fornecedor</th>
                  <th className="py-3 px-3 text-center">Qtd / Caixa</th>
                  <th className="py-3 px-3 text-center">Unidade</th>
                  <th className="py-3 px-3 text-right">Preço de Custo</th>
                  <th className="py-3 px-3 text-right text-emerald-800 bg-emerald-50/60 font-bold border-l border-emerald-100">
                    Preço PIX (+{newMarkupPix}%)
                  </th>
                  <th className="py-3 px-3 text-right text-blue-800 bg-blue-50/60 font-bold border-l border-blue-100">
                    Preço Cartão 10x (+{newMarkupCard}%)
                  </th>
                  <th className="py-3 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredProducts.map(prod => {
                  const pixPrice = prod.unitPricePix ?? Number((prod.costPrice * (1 + newMarkupPix / 100)).toFixed(2));
                  const cardPrice = prod.unitPriceCard ?? Number((prod.costPrice * (1 + newMarkupCard / 100)).toFixed(2));
                  const installment10 = Number((cardPrice / 10).toFixed(2));

                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-500">{prod.sku}</td>
                      <td className="py-3 px-3 font-bold text-slate-900 max-w-xs">{prod.name}</td>
                      <td className="py-3 px-3 text-slate-700 font-semibold">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {prod.brand || prod.supplier}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800">{prod.supplier}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-bold text-[11px]">
                          {prod.quantityPerBox ? `${prod.quantityPerBox} un/cx` : '1 un'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-500 font-medium">{prod.unit}</td>
                      <td className="py-3 px-3 text-right text-slate-500 font-mono">{formatCurrency(prod.costPrice)}</td>
                      
                      {/* Preço PIX */}
                      <td className="py-3 px-3 text-right bg-emerald-50/40 border-l border-emerald-100">
                        <div className="font-extrabold text-emerald-800 text-sm">
                          {formatCurrency(pixPrice)}
                        </div>
                        <div className="text-[10px] text-emerald-600 font-semibold">à vista</div>
                      </td>

                      {/* Preço Cartão 10x */}
                      <td className="py-3 px-3 text-right bg-blue-50/30 border-l border-blue-100">
                        <div className="font-extrabold text-blue-900 text-sm">
                          {formatCurrency(cardPrice)}
                        </div>
                        <div className="text-[10px] text-blue-600 font-semibold">
                          10x de {formatCurrency(installment10)}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => setProductToDelete(prod)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Remover produto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal: Delete Single Product */}
      <ConfirmModal
        isOpen={!!productToDelete}
        title="Excluir Produto do Catálogo"
        message={`Tem certeza que deseja remover o produto "${productToDelete?.name}" (${productToDelete?.sku}) do catálogo? Esta alteração será sincronizada no Firebase Firestore.`}
        confirmLabel="Sim, Remover Produto"
        isLoading={isDeletingAction}
        onConfirm={async () => {
          if (!productToDelete) return;
          setIsDeletingAction(true);
          try {
            await onDeleteProduct(productToDelete.id);
            setUploadMessage({ text: `Produto "${productToDelete.name}" removido com sucesso!`, type: 'success' });
            setProductToDelete(null);
          } catch (err: any) {
            setUploadMessage({ text: 'Erro ao remover produto: ' + err.message, type: 'error' });
          } finally {
            setIsDeletingAction(false);
          }
        }}
        onCancel={() => setProductToDelete(null)}
      />

      {/* Confirmation Modal: Clear Entire Catalog */}
      <ConfirmModal
        isOpen={isConfirmingClearAll}
        title="Limpar Todo o Catálogo"
        message={`Atenção! Você está prestes a excluir TODOS os ${products.length} produtos do catálogo no Firebase Firestore. Esta ação é irreversível e os clientes não verão mais nenhum item até que uma nova planilha seja carregada. Deseja continuar?`}
        confirmLabel="Sim, Apagar Todos os Produtos"
        isDangerous={true}
        isLoading={isDeletingAction}
        onConfirm={async () => {
          setIsDeletingAction(true);
          try {
            await onClearAllProducts();
            setIsConfirmingClearAll(false);
            setUploadMessage({ text: 'Catálogo limpo com sucesso!', type: 'success' });
          } catch (err: any) {
            setUploadMessage({ text: 'Erro ao limpar catálogo: ' + err.message, type: 'error' });
          } finally {
            setIsDeletingAction(false);
          }
        }}
        onCancel={() => setIsConfirmingClearAll(false)}
      />

      {/* Manual Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Adicionar Produto Avulso</h3>
            <p className="text-xs text-slate-500 mb-4">Insira os dados do produto para incluir no catálogo.</p>

            <form onSubmit={handleCreateManualProduct} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Produto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Açúcar Refinado 1kg"
                  value={newProdName}
                  onChange={e => setNewProdName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Código / SKU</label>
                  <input
                    type="text"
                    placeholder="Ex: AC-01"
                    value={newProdSku}
                    onChange={e => setNewProdSku(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unidade</label>
                  <input
                    type="text"
                    placeholder="Ex: cx, un, fardo"
                    value={newProdUnit}
                    onChange={e => setNewProdUnit(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fornecedor *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Distribuidora Sol"
                    value={newProdSupplier}
                    onChange={e => setNewProdSupplier(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Marca</label>
                  <input
                    type="text"
                    placeholder="Ex: Marca Premium"
                    value={newProdBrand}
                    onChange={e => setNewProdBrand(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Qtd por Caixa (Unidades)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ex: 12"
                    value={newProdBoxQty}
                    onChange={e => setNewProdBoxQty(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria</label>
                  <input
                    type="text"
                    placeholder="Ex: Mercearia"
                    value={newProdCategory}
                    onChange={e => setNewProdCategory(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Código EAN / Barras (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: 7891234567890"
                  value={newProdEan}
                  onChange={e => setNewProdEan(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Preço de Custo (R$) *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 25.50 ou 25,50"
                  value={newProdCost}
                  onChange={e => setNewProdCost(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400">
                  Preço final com margem de +{markupPercent}% será calculado automaticamente.
                </span>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm"
                >
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
