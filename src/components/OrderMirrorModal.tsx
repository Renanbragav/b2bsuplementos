import React, { useState, useEffect, useRef } from 'react';
import { ClientOrder, OrderItem } from '../types';
import { formatCurrency, formatCNPJ, formatPhone, formatDateTime } from '../lib/formatters';
import { getSafeImageBase64 } from '../lib/imageUtils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  X,
  Download,
  Printer,
  Copy,
  Check,
  CheckCircle2,
  Package,
  Building2,
  Calendar,
  CreditCard,
  QrCode,
  Sparkles,
  Image as ImageIcon
} from 'lucide-react';

interface OrderMirrorModalProps {
  order: ClientOrder | null;
  campaignTitle?: string;
  onClose: () => void;
  onOpenComboFlyer?: (order: ClientOrder) => void;
}

export const OrderMirrorModal: React.FC<OrderMirrorModalProps> = ({
  order,
  campaignTitle = 'Distribuidora B2B - Pedidos Coletivos',
  onClose,
  onOpenComboFlyer,
}) => {
  const [copied, setCopied] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [imagesMap, setImagesMap] = useState<Record<string, string>>({});
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const printContentRef = useRef<HTMLDivElement>(null);

  if (!order) return null;

  const itemsList: OrderItem[] = Array.isArray(order.items)
    ? order.items
    : typeof order.items === 'object' && order.items !== null
    ? Object.values(order.items)
    : [];

  // Pre-load all product photos into Base64 data URLs to guarantee 100% CORS-safe rendering in PDF/Canvas on Vercel
  useEffect(() => {
    let isMounted = true;
    const loadImages = async () => {
      setIsLoadingImages(true);
      const map: Record<string, string> = {};
      await Promise.all(
        itemsList.map(async item => {
          const key = item.productId || item.sku || item.name;
          const safeBase64 = await getSafeImageBase64(item.imageUrl, item.name);
          map[key] = safeBase64;
        })
      );
      if (isMounted) {
        setImagesMap(map);
        setIsLoadingImages(false);
      }
    };
    loadImages();
    return () => {
      isMounted = false;
    };
  }, [order?.id, itemsList.length]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = async () => {
    if (!printContentRef.current) return;
    setIsExportingPdf(true);

    try {
      // Ensure all images are fully loaded and rendered before capturing
      const canvas = await html2canvas(printContentRef.current, {
        scale: 2, // High resolution for crisp text & photos
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#FFFFFF',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 16; // 8mm margins
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 8; // Top margin

      pdf.addImage(imgData, 'JPEG', 8, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Add extra pages if order is very long
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 8, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const clientClean = (order.clientName || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`Espelho_Pedido_${clientClean}_${order.id.slice(-6)}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      // Fallback to native print if html2canvas meets any unexpected browser limitation
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  const copyWhatsAppText = () => {
    const paymentLabel = order.paymentMethod === 'card_10x'
      ? `Cartão de Crédito em até 10x (${formatCurrency(order.totalAmount / 10)} /mês)`
      : 'PIX à Vista';

    let text = `📦 *ESPELHO OFICIAL DO PEDIDO*\n`;
    text += `👤 *Cliente:* ${order.clientName}\n`;
    text += `🏢 *CNPJ:* ${formatCNPJ(order.clientCnpj) || 'Não informado'}\n`;
    text += `📱 *WhatsApp:* ${formatPhone(order.clientWhatsapp)}\n`;
    text += `💳 *Forma de Pagamento:* ${paymentLabel}\n`;
    if (order.paymentSettled || order.status === 'settled') {
      text += `✅ *Status Financeiro:* PAGAMENTO ACERTADO & PEDIDO FECHADO\n`;
    }
    text += `📅 *Data:* ${formatDateTime(order.createdAt)}\n`;
    text += `------------------------------------\n`;
    itemsList.forEach((it, idx) => {
      text += `${idx + 1}. *${it.name}* (SKU: ${it.sku})\n`;
      text += `   Qtd: ${it.quantity} ${it.unit} | Preço: ${formatCurrency(it.unitPrice)} | Subtotal: ${formatCurrency(it.subtotal)}\n`;
    });
    text += `------------------------------------\n`;
    text += `📊 *Total de Itens:* ${order.totalItems} unidades\n`;
    text += `💰 *VALOR TOTAL DO PEDIDO:* ${formatCurrency(order.totalAmount)}\n`;
    if (order.paymentMethod === 'card_10x') {
      text += `💳 *Condição:* 10 parcelas de ${formatCurrency(order.totalAmount / 10)}\n`;
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const isCard = order.paymentMethod === 'card_10x';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Header Controls (Hidden during print) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between gap-3 border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/30 text-blue-400 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                Espelho Oficial do Pedido (PDF & Impressão)
              </h3>
              <p className="text-[11px] text-slate-300">
                Fotos dos produtos integradas e compatíveis com exportação em qualquer ambiente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenComboFlyer && (
              <button
                type="button"
                onClick={() => onOpenComboFlyer(order)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
                title="Criar flyer promocional ou imagem para WhatsApp com fotos dos produtos"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Foto do Combo</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf || isLoadingImages}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingPdf ? 'Gerando PDF...' : 'Baixar PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Printable Body */}
        <div className="p-4 sm:p-8 overflow-y-auto print:p-0 print:overflow-visible">
          {/* Printable Document Box */}
          <div
            ref={printContentRef}
            className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200 print:border-none print:p-0 text-slate-900"
          >
            {/* Document Header */}
            <div className="border-b-2 border-slate-900 pb-5 mb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-blue-700 block">
                  Comprovante Oficial de Compra B2B
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                  ESPELHO DO PEDIDO
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  {campaignTitle}
                </p>
              </div>

              <div className="text-left sm:text-right text-xs space-y-1">
                <div className="inline-block px-3 py-1 bg-slate-900 text-white font-mono font-bold rounded-lg text-xs">
                  PEDIDO: #{order.id.slice(-8).toUpperCase()}
                </div>
                <div className="text-slate-500">
                  Data: <strong className="text-slate-800">{formatDateTime(order.createdAt)}</strong>
                </div>
                {order.paymentSettled || order.status === 'settled' ? (
                  <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Pagamento Acertado (Fechado)</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    <span>Aguardando Acerto Financeiro</span>
                  </div>
                )}
              </div>
            </div>

            {/* Client & Commercial Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs mb-6">
              <div className="space-y-1.5">
                <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Dados do Cliente / Faturamento
                </h4>
                <div className="text-sm font-extrabold text-slate-900">
                  {order.clientName}
                </div>
                <div className="text-slate-600">
                  CNPJ: <strong>{formatCNPJ(order.clientCnpj) || 'Não informado'}</strong>
                </div>
                <div className="text-slate-600">
                  WhatsApp: <strong>{formatPhone(order.clientWhatsapp)}</strong>
                </div>
              </div>

              <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-4">
                <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Condição Comercial & Pagamento
                </h4>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  {isCard ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
                      <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                      Cartão de Crédito em até 10x
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                      <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                      PIX à Vista
                    </span>
                  )}
                </div>
                {isCard && (
                  <div className="text-blue-900 font-semibold">
                    Parcelamento: <strong>10x de {formatCurrency(order.totalAmount / 10)}</strong>
                  </div>
                )}
                {order.allowedSuppliers && order.allowedSuppliers.length > 0 && (
                  <div className="text-slate-500">
                    Fornecedores autorizados: <strong className="text-slate-800">{order.allowedSuppliers.join(', ')}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Items Table with Product Photos */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Itens do Pedido ({itemsList.length} produtos / {order.totalItems} unidades)
                </h3>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3 w-14 text-center">Foto</th>
                      <th className="py-2.5 px-3">Produto / Especificação</th>
                      <th className="py-2.5 px-3">Marca / Fornecedor</th>
                      <th className="py-2.5 px-3 text-center">Qtd/Cx</th>
                      <th className="py-2.5 px-3 text-center">Quantidade</th>
                      <th className="py-2.5 px-3 text-right">Preço Unit.</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {itemsList.map((item, idx) => {
                      const itemKey = item.productId || item.sku || item.name;
                      const photoUrl = imagesMap[itemKey] || item.imageUrl;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/70">
                          {/* Product Photo */}
                          <td className="py-2.5 px-3 text-center align-middle">
                            <div className="w-11 h-11 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center mx-auto shrink-0 shadow-2xs">
                              {photoUrl ? (
                                <img
                                  src={photoUrl}
                                  alt={item.name}
                                  crossOrigin="anonymous"
                                  className="w-full h-full object-cover"
                                  onError={e => {
                                    // Fallback to placeholder if an external URL fails
                                    (e.target as HTMLImageElement).src = imagesMap[itemKey] || '';
                                  }}
                                />
                              ) : (
                                <ImageIcon className="w-4 h-4 text-slate-300" />
                              )}
                            </div>
                          </td>

                          {/* Product Description */}
                          <td className="py-2.5 px-3 align-middle">
                            <div className="font-extrabold text-slate-900 text-xs">
                              {item.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              SKU: {item.sku || '-'} {item.ean ? `| EAN: ${item.ean}` : ''}
                            </div>
                          </td>

                          {/* Brand & Supplier */}
                          <td className="py-2.5 px-3 align-middle text-slate-600">
                            <span className="font-semibold text-slate-800 block">
                              {item.brand || item.supplier}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {item.supplier}
                            </span>
                          </td>

                          {/* Qty per box */}
                          <td className="py-2.5 px-3 text-center align-middle">
                            <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                              {item.quantityPerBox && item.quantityPerBox > 1 ? `${item.quantityPerBox} un/cx` : '1 un'}
                            </span>
                          </td>

                          {/* Quantity */}
                          <td className="py-2.5 px-3 text-center align-middle">
                            <span className="inline-block px-2.5 py-0.5 rounded font-black text-blue-900 bg-blue-50 border border-blue-200 text-xs">
                              {item.quantity} {item.unit}
                            </span>
                          </td>

                          {/* Unit Price */}
                          <td className="py-2.5 px-3 text-right align-middle text-slate-700 font-semibold">
                            {formatCurrency(item.unitPrice)}
                          </td>

                          {/* Subtotal */}
                          <td className="py-2.5 px-3 text-right align-middle font-extrabold text-slate-900 text-xs">
                            {formatCurrency(item.subtotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Table Footer with Totals */}
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                      <td colSpan={4} className="py-3 px-3 uppercase text-xs">
                        TOTAL CONSOLIDADO DO PEDIDO
                      </td>
                      <td className="py-3 px-3 text-center text-xs font-black">
                        {order.totalItems} un
                      </td>
                      <td className="py-3 px-3 text-right text-xs">
                        {isCard ? '10x de:' : 'À vista:'}
                      </td>
                      <td className="py-3 px-3 text-right text-base font-black text-emerald-700">
                        {formatCurrency(order.totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Financial Summary & Sign-off Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-200 pt-5 text-xs">
              <div className="space-y-1 text-slate-500">
                <p className="font-semibold text-slate-700">
                  Termos e Condições do Pedido Coletivo:
                </p>
                <p className="text-[11px]">
                  &bull; Preços e condições garantidos pelo fechamento consolidado com os fornecedores.
                </p>
                <p className="text-[11px]">
                  &bull; A nota fiscal e faturamento serão emitidos diretamente de acordo com os dados cadastrados.
                </p>
              </div>

              <div className="flex flex-col items-end justify-center text-right space-y-1">
                <div className="text-slate-500 text-xs">Valor Total a Pagar:</div>
                <div className="text-2xl font-black text-emerald-700">
                  {formatCurrency(order.totalAmount)}
                </div>
                {isCard && (
                  <div className="text-blue-900 font-bold text-xs">
                    (10 parcelas mensais de {formatCurrency(order.totalAmount / 10)})
                  </div>
                )}
              </div>
            </div>

            {/* Signature lines for physical print */}
            <div className="hidden print:grid grid-cols-2 gap-8 mt-12 pt-8 border-t border-slate-300 text-center text-xs">
              <div>
                <div className="border-t border-slate-400 w-3/4 mx-auto mb-1"></div>
                <p className="font-bold text-slate-800">{order.clientName}</p>
                <p className="text-[10px] text-slate-500">Responsável / Assinatura do Cliente</p>
              </div>
              <div>
                <div className="border-t border-slate-400 w-3/4 mx-auto mb-1"></div>
                <p className="font-bold text-slate-800">{campaignTitle}</p>
                <p className="text-[10px] text-slate-500">Distribuidora / Faturamento</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls (Hidden during print) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyWhatsAppText}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado para WhatsApp!' : 'Copiar Resumo WhatsApp'}</span>
            </button>

            {onOpenComboFlyer && (
              <button
                type="button"
                onClick={() => onOpenComboFlyer(order)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Gerar Foto do Combo</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf || isLoadingImages}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingPdf ? 'Exportando...' : 'Baixar PDF'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
