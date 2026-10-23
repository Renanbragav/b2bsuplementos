import React, { useState } from 'react';
import { ClientOrder, ProductItem } from '../types';
import { consolidateOrders, exportConsolidatedToExcel, ConsolidatedItem } from '../lib/spreadsheet';
import { formatCurrency } from '../lib/formatters';
import {
  Download,
  Copy,
  Check,
  Building2,
  Package,
  DollarSign,
  TrendingUp,
  Share2,
  Users,
  Search,
  Filter
} from 'lucide-react';

interface AdminConsolidatedTabProps {
  orders: ClientOrder[];
  products: ProductItem[];
}

export const AdminConsolidatedTab: React.FC<AdminConsolidatedTabProps> = ({ orders }) => {
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedSupplier, setCopiedSupplier] = useState<string | null>(null);

  const {
    consolidatedItems,
    bySupplier,
    totalGrossRevenue,
    totalSupplierCost,
    totalProfit,
    marginPercent,
  } = consolidateOrders(orders);

  const supplierList = Object.keys(bySupplier).sort();

  const filteredItems = consolidatedItems.filter(item => {
    const matchesSupplier = selectedSupplier === 'all' || item.supplier === selectedSupplier;
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.supplier.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSupplier && matchesSearch;
  });

  const handleCopyWhatsAppForSupplier = (supplierName: string) => {
    const items = bySupplier[supplierName] || [];
    if (items.length === 0) return;

    let text = `📦 *PEDIDO CONSOLIDADO DE COMPRA*\n`;
    text += `🏢 *Fornecedor:* ${supplierName}\n`;
    text += `📅 *Data:* ${new Date().toLocaleDateString('pt-BR')}\n`;
    text += `------------------------------------\n`;
    items.forEach(it => {
      text += `▪️ *${it.totalQuantity} ${it.unit}* - ${it.name} (Cód: ${it.sku})\n`;
    });
    text += `------------------------------------\n`;
    const totalSupplierCost = items.reduce((acc, curr) => acc + curr.totalCost, 0);
    text += `💰 *Valor Total do Pedido:* ${formatCurrency(totalSupplierCost)}\n`;
    text += `Favor confirmar disponibilidade e prazo de faturamento/entrega. Obrigado!`;

    navigator.clipboard.writeText(text);
    setCopiedSupplier(supplierName);
    setTimeout(() => setCopiedSupplier(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Financial Overview Banner */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-sm border border-slate-700/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Fechamento & Consolidação
            </span>
            <h3 className="text-2xl font-bold mt-1 text-white">Consolidado Geral de Compras</h3>
            <p className="text-sm text-slate-300 mt-1">
              Todos os pedidos de clientes agrupados por produto e fornecedor para envio direto.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => exportConsolidatedToExcel(orders)}
              disabled={orders.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Excel Completo (.xlsx)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-700/80">
          <div>
            <div className="text-xs text-slate-400">Total a Pagar aos Fornecedores</div>
            <div className="text-xl font-bold text-amber-300 mt-0.5">{formatCurrency(totalSupplierCost)}</div>
            <div className="text-[11px] text-slate-400">Custo base das tabelas</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Total a Receber dos Clientes</div>
            <div className="text-xl font-bold text-emerald-300 mt-0.5">{formatCurrency(totalGrossRevenue)}</div>
            <div className="text-[11px] text-slate-400">Com margem percentual</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Lucro Bruto Previsto</div>
            <div className="text-xl font-bold text-teal-300 mt-0.5">{formatCurrency(totalProfit)}</div>
            <div className="text-[11px] text-slate-400">Retorno da intermediação</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Margem Média</div>
            <div className="text-xl font-bold text-blue-300 mt-0.5">{marginPercent.toFixed(1)}%</div>
            <div className="text-[11px] text-slate-400">Margem sobre faturamento</div>
          </div>
        </div>
      </div>

      {/* Supplier Quick Actions Cards */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-600" />
          <span>Pedidos Individuais por Fornecedor ({supplierList.length})</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {supplierList.map(supp => {
            const items = bySupplier[supp];
            const totalCost = items.reduce((acc, curr) => acc + curr.totalCost, 0);
            const totalUnits = items.reduce((acc, curr) => acc + curr.totalQuantity, 0);
            const isCopied = copiedSupplier === supp;

            return (
              <div
                key={supp}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h5 className="font-bold text-slate-900 text-sm truncate">{supp}</h5>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {items.length} itens
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Total: <strong className="text-slate-800">{totalUnits} unidades</strong> | Custo:{' '}
                    <strong className="text-emerald-700">{formatCurrency(totalCost)}</strong>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => handleCopyWhatsAppForSupplier(supp)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                      isCopied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar p/ WhatsApp</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setSelectedSupplier(supp)}
                    className="py-1.5 px-3 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Filtrar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter and Table of Consolidated Items */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar item, código SKU ou fornecedor..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            <span className="text-xs text-slate-500 flex items-center gap-1 whitespace-nowrap">
              <Filter className="w-3.5 h-3.5" />
              Fornecedor:
            </span>
            <select
              value={selectedSupplier}
              onChange={e => setSelectedSupplier(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos os Fornecedores ({supplierList.length})</option>
              {supplierList.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-medium text-sm">Nenhum produto consolidado no momento.</p>
            <p className="text-xs text-slate-400 mt-1">
              Os produtos consolidados aparecerão assim que os clientes salvarem pedidos.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Fornecedor</th>
                  <th className="py-3 px-4">Código / SKU</th>
                  <th className="py-3 px-4">Produto</th>
                  <th className="py-3 px-4 text-center">Quantidade Total</th>
                  <th className="py-3 px-4 text-right">Custo Fornecedor</th>
                  <th className="py-3 px-4 text-right">Total Custo</th>
                  <th className="py-3 px-4 text-right">Venda Unit.</th>
                  <th className="py-3 px-4 text-right">Total Venda</th>
                  <th className="py-3 px-4 text-right">Lucro</th>
                  <th className="py-3 px-4">Clientes Interessados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredItems.map(item => (
                  <tr key={item.productId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">{item.supplier}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{item.sku}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900 max-w-xs">{item.name}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 font-bold text-xs">
                        {item.totalQuantity} {item.unit}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">{formatCurrency(item.costPrice)}</td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900">
                      {formatCurrency(item.totalCost)}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-700">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-800">
                      {formatCurrency(item.totalRevenue)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-teal-600">{formatCurrency(item.profit)}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-sm">
                        {item.clientBreakdown.map((c, i) => (
                          <span
                            key={i}
                            className="inline-block text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-700 border border-slate-200"
                            title={`${c.clientName} solicitou ${c.quantity} ${item.unit}`}
                          >
                            {c.clientName}: <strong>{c.quantity}</strong>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
