import React from 'react';
import { ClientOrder, OrderItem } from '../types';
import { formatCurrency, formatCNPJ, formatPhone, formatDateTime, getRemainingTime } from '../lib/formatters';
import {
  X,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  Building2,
  Phone,
  FileText,
  Calendar,
  Package,
  MessageCircle
} from 'lucide-react';

interface OrderSummaryModalProps {
  order: ClientOrder | null;
  onClose: () => void;
}

export const OrderSummaryModal: React.FC<OrderSummaryModalProps> = ({ order, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  if (!order) return null;

  const itemsList: OrderItem[] = Array.isArray(order.items)
    ? order.items
    : typeof order.items === 'object' && order.items !== null
    ? Object.values(order.items)
    : [];

  const timeInfo = getRemainingTime(order.expiresAt);
  const target = order.targetAmount || 0;
  const progressPercent = target > 0 ? (order.totalAmount / target) * 100 : 100;
  const isGoalReached = target > 0 ? order.totalAmount >= target : true;

  const copyWhatsAppText = () => {
    const paymentLabel = order.paymentMethod === 'card_10x'
      ? `Cartão de Crédito em até 10x (${formatCurrency(order.totalAmount / 10)} /mês)`
      : 'PIX à Vista';

    let text = `📦 *RESUMO DO PEDIDO CONJUNTO*\n`;
    text += `👤 *Cliente:* ${order.clientName}\n`;
    text += `🏢 *CNPJ:* ${formatCNPJ(order.clientCnpj)}\n`;
    text += `📱 *WhatsApp:* ${formatPhone(order.clientWhatsapp)}\n`;
    text += `💳 *Forma de Pagamento:* ${paymentLabel}\n`;
    if (order.paymentSettled || order.status === 'settled') {
      text += `✅ *Status Financeiro:* PAGAMENTO ACERTADO (PEDIDO FECHADO)\n`;
    }
    if (order.allowedSuppliers && order.allowedSuppliers.length > 0) {
      text += `🏭 *Fornecedores Liberados:* ${order.allowedSuppliers.join(', ')}\n`;
    }
    text += `📅 *Data:* ${formatDateTime(order.createdAt)}\n`;
    text += `------------------------------------\n`;
    itemsList.forEach(it => {
      text += `▪️ ${it.quantity} ${it.unit} x ${it.name} (${formatCurrency(it.unitPrice)}) = ${formatCurrency(it.subtotal)}\n`;
    });
    text += `------------------------------------\n`;
    text += `🎯 *Meta:* ${formatCurrency(target)}\n`;
    text += `💰 *VALOR TOTAL:* ${formatCurrency(order.totalAmount)}\n`;
    if (order.paymentMethod === 'card_10x') {
      text += `💳 *Parcelamento:* 10x de ${formatCurrency(order.totalAmount / 10)}\n`;
    }
    text += `📊 *Status da Meta:* ${isGoalReached ? 'Atingida (100%+)' : `Abaixo (${progressPercent.toFixed(1)}%)`}\n`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-scaleIn">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{order.clientName}</h3>
              <p className="text-xs text-slate-400">Detalhamento dos itens solicitados</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Client & Goal Summary Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-600">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>CNPJ: <strong>{formatCNPJ(order.clientCnpj) || 'Não informado'}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>WhatsApp: <strong>{formatPhone(order.clientWhatsapp)}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Data: <strong>{formatDateTime(order.createdAt)}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-slate-500">Pagamento:</span>
                <span className={`px-2 py-0.5 rounded font-bold ${
                  order.paymentMethod === 'card_10x'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {order.paymentMethod === 'card_10x' ? '💳 Cartão em até 10x' : '🟢 PIX à Vista'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-slate-500">Status Acerto:</span>
                {order.paymentSettled || order.status === 'settled' ? (
                  <span className="px-2 py-0.5 rounded font-black bg-emerald-600 text-white flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Pagamento Acertado (Fechado)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    Aguardando Acerto
                  </span>
                )}
              </div>
              {order.paymentSettledAt && (
                <div className="text-[11px] text-emerald-700 font-semibold">
                  Acerto registrado em: {formatDateTime(order.paymentSettledAt)}
                </div>
              )}
            </div>

            <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Meta Estabelecida:</span>
                <strong className="text-slate-800">{formatCurrency(target)}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Valor Total:</span>
                <strong className="text-emerald-700 font-bold">{formatCurrency(order.totalAmount)}</strong>
              </div>
              {order.paymentMethod === 'card_10x' && (
                <div className="flex justify-between items-center text-blue-800 font-semibold">
                  <span className="text-slate-500">Parcelas:</span>
                  <span>10x de {formatCurrency(order.totalAmount / 10)}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Status do Prazo:</span>
                <span className="font-semibold text-slate-700">{timeInfo.formatted}</span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
              Itens Solicitados ({itemsList.length})
            </h4>

            {itemsList.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Nenhum item adicionado.</p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-3">Produto</th>
                      <th className="py-2.5 px-3">Fornecedor</th>
                      <th className="py-2.5 px-3 text-center">Qtd/Cx</th>
                      <th className="py-2.5 px-3 text-center">Qtd Solicitada</th>
                      <th className="py-2.5 px-3 text-right">Preço Unit.</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {itemsList.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{item.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{item.sku}</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{item.supplier}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            {item.quantityPerBox && item.quantityPerBox > 1 ? `${item.quantityPerBox} un/cx` : '1 un'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-bold text-slate-900 bg-blue-50 text-blue-800 px-2.5 py-0.5 rounded">
                            {item.quantity} {item.unit}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600">{formatCurrency(item.unitPrice)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold border-t border-slate-200 text-slate-900">
                      <td colSpan={3} className="py-3 px-3">TOTAL GERAL</td>
                      <td className="py-3 px-3 text-center">{order.totalItems} un</td>
                      <td className="py-3 px-3 text-right">-</td>
                      <td className="py-3 px-3 text-right text-sm text-emerald-700">
                        {formatCurrency(order.totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            onClick={copyWhatsAppText}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado!' : 'Copiar Resumo Formatado'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
