import React, { useState, useEffect, useRef } from 'react';
import { ProductItem, OrderItem, ClientOrder } from '../types';
import { formatCurrency } from '../lib/formatters';
import { getSafeImageBase64 } from '../lib/imageUtils';
import {
  X,
  Download,
  Copy,
  Check,
  Share2,
  Sparkles,
  RefreshCw,
  Sliders,
  Layers,
  Image as ImageIcon
} from 'lucide-react';

interface ComboItem {
  id: string;
  name: string;
  brand?: string;
  supplier: string;
  imageUrl?: string;
  unit: string;
  quantityPerBox?: number;
  quantity: number;
  unitPricePix: number;
  unitPriceCard: number;
}

interface ComboFlyerModalProps {
  products?: ProductItem[];
  order?: ClientOrder | null;
  campaignTitle?: string;
  onClose: () => void;
}

export const ComboFlyerModal: React.FC<ComboFlyerModalProps> = ({
  products = [],
  order = null,
  campaignTitle = 'Distribuidora B2B - Pedidos Coletivos',
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [comboTitle, setComboTitle] = useState<string>(
    order ? `Combo Especial: ${order.clientName}` : 'Combo Promocional Coletivo'
  );
  const [subtitle, setSubtitle] = useState<string>('Condições Exclusivas Direto de Fábrica');
  const [selectedItems, setSelectedItems] = useState<ComboItem[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(true);
  const [copiedImage, setCopiedImage] = useState<boolean>(false);
  const [generatedDataUrl, setGeneratedDataUrl] = useState<string | null>(null);

  // Initialize items from order or products
  useEffect(() => {
    if (order && order.items) {
      const list: OrderItem[] = Array.isArray(order.items)
        ? order.items
        : Object.values(order.items);

      const items: ComboItem[] = list.map((it, idx) => ({
        id: it.productId || `item_${idx}`,
        name: it.name,
        brand: it.brand || it.supplier,
        supplier: it.supplier,
        imageUrl: it.imageUrl,
        unit: it.unit || 'un',
        quantityPerBox: it.quantityPerBox || 1,
        quantity: it.quantity || 1,
        unitPricePix: it.unitPricePix || it.unitPrice || 0,
        unitPriceCard: it.unitPriceCard || Number(((it.unitPrice || 0) * 1.1).toFixed(2)),
      }));

      setSelectedItems(items);
    } else if (products && products.length > 0) {
      // Default select first 6 products
      const initial = products.slice(0, 6).map(p => ({
        id: p.id,
        name: p.name,
        brand: p.brand || p.supplier,
        supplier: p.supplier,
        imageUrl: p.imageUrl,
        unit: p.unit || 'un',
        quantityPerBox: p.quantityPerBox || 1,
        quantity: 1,
        unitPricePix: p.unitPricePix || p.unitPrice || 0,
        unitPriceCard: p.unitPriceCard || Number(((p.unitPrice || 0) * 1.1).toFixed(2)),
      }));

      setSelectedItems(initial);
    }
  }, [order, products]);

  // Totals of the combo
  const totalPix = selectedItems.reduce((acc, it) => acc + it.unitPricePix * it.quantity, 0);
  const totalCard = selectedItems.reduce((acc, it) => acc + it.unitPriceCard * it.quantity, 0);
  const totalItemsCount = selectedItems.reduce((acc, it) => acc + it.quantity, 0);

  // Render high-definition flyer onto HTML5 Canvas
  useEffect(() => {
    let isCancelled = false;

    const renderCanvas = async () => {
      if (selectedItems.length === 0) return;
      setIsGenerating(true);

      const canvas = canvasRef.current;
      if (!canvas) return;

      // High-resolution canvas dimensions (WhatsApp / Instagram Portrait 1080 x 1440)
      const width = 1080;
      const height = 1440;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Preload all product photos via getSafeImageBase64 to eliminate CORS tainted canvas restrictions on Vercel
      const safeImages = await Promise.all(
        selectedItems.map(item => getSafeImageBase64(item.imageUrl, item.name))
      );

      if (isCancelled) return;

      // Load Image objects from Base64
      const loadedImgObjects = await Promise.all(
        safeImages.map(src => {
          return new Promise<HTMLImageElement>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => {
              const fallback = new Image();
              fallback.onload = () => resolve(fallback);
              fallback.src = getSafeImageBase64(undefined, 'Produto') as any;
            };
            img.src = src;
          });
        })
      );

      if (isCancelled) return;

      // --- 1. Background Gradient ---
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#0F172A'); // Slate 900
      bgGrad.addColorStop(0.4, '#1E293B'); // Slate 800
      bgGrad.addColorStop(1, '#0B0F19'); // Darkest Slate
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle decorative top accent
      const accentGrad = ctx.createLinearGradient(0, 0, width, 0);
      accentGrad.addColorStop(0, '#3B82F6'); // Blue
      accentGrad.addColorStop(0.5, '#10B981'); // Emerald
      accentGrad.addColorStop(1, '#8B5CF6'); // Purple
      ctx.fillStyle = accentGrad;
      ctx.fillRect(0, 0, width, 12);

      // --- 2. Header Area ---
      // Brand tag
      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(campaignTitle.toUpperCase(), 60, 70);

      // Main Title
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(comboTitle, 60, 130);

      // Subtitle
      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(subtitle, 60, 172);

      // Promo Pill on Right
      drawPill(ctx, width - 260, 60, 200, 48, '#059669', 'OFERTA COLETIVA', '#FFFFFF');

      // Divider line
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(60, 205);
      ctx.lineTo(width - 60, 205);
      ctx.stroke();

      // --- 3. Product Cards Grid ---
      const maxItemsToDraw = Math.min(selectedItems.length, 6);
      const cols = maxItemsToDraw <= 2 ? 1 : (maxItemsToDraw <= 4 ? 2 : (maxItemsToDraw <= 6 ? 3 : 3));
      const rows = Math.ceil(maxItemsToDraw / cols);

      const gridStartX = 60;
      const gridStartY = 235;
      const gridWidth = width - 120;
      const gridHeight = 940;

      const cardGap = 24;
      const cardWidth = (gridWidth - (cols - 1) * cardGap) / cols;
      const cardHeight = (gridHeight - (rows - 1) * cardGap) / rows;

      for (let i = 0; i < maxItemsToDraw; i++) {
        const item = selectedItems[i];
        const img = loadedImgObjects[i];
        const col = i % cols;
        const row = Math.floor(i / cols);

        const cardX = gridStartX + col * (cardWidth + cardGap);
        const cardY = gridStartY + row * (cardHeight + cardGap);

        // Draw Card Background
        drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 24, '#1E293B', '#334155', 2);

        // Photo Container
        const photoHeight = Math.min(cardHeight * 0.48, 170);
        const photoPad = 14;
        const photoWidth = cardWidth - photoPad * 2;
        const photoX = cardX + photoPad;
        const photoY = cardY + photoPad;

        drawRoundedRect(ctx, photoX, photoY, photoWidth, photoHeight, 16, '#0F172A');

        // Draw Product Photo (preserving aspect ratio)
        if (img) {
          ctx.save();
          // Clip inside photo container with rounded corners
          roundedRectPath(ctx, photoX, photoY, photoWidth, photoHeight, 16);
          ctx.clip();

          const imgRatio = img.width / img.height;
          const targetRatio = photoWidth / photoHeight;
          let renderW = photoWidth;
          let renderH = photoHeight;
          let renderX = photoX;
          let renderY = photoY;

          if (imgRatio > targetRatio) {
            renderW = photoHeight * imgRatio;
            renderX = photoX - (renderW - photoWidth) / 2;
          } else {
            renderH = photoWidth / imgRatio;
            renderY = photoY - (renderH - photoHeight) / 2;
          }

          ctx.drawImage(img, renderX, renderY, renderW, renderH);
          ctx.restore();
        }

        // Qty Badge on photo top-left
        if (item.quantity > 1) {
          drawPill(ctx, photoX + 10, photoY + 10, 80, 32, '#2563EB', `${item.quantity}x`, '#FFFFFF');
        }

        // Brand tag
        const textStartY = photoY + photoHeight + 18;
        ctx.fillStyle = '#38BDF8'; // Sky blue
        ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const brandText = (item.brand || item.supplier).slice(0, 24).toUpperCase();
        ctx.fillText(brandText, cardX + 16, textStartY);

        // Product Name (truncated to 2 lines)
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const nameLines = wrapText(ctx, item.name, cardWidth - 32, 2);
        let currentTextY = textStartY + 24;
        nameLines.forEach(line => {
          ctx.fillText(line, cardX + 16, currentTextY);
          currentTextY += 22;
        });

        // Price Section inside Card
        const priceBoxY = cardY + cardHeight - 74;
        const priceBoxH = 60;
        const priceBoxW = cardWidth - 32;

        drawRoundedRect(ctx, cardX + 16, priceBoxY, priceBoxW, priceBoxH, 14, '#0F172A');

        // PIX Price
        ctx.fillStyle = '#10B981';
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('PIX À VISTA', cardX + 28, priceBoxY + 22);

        ctx.fillStyle = '#34D399';
        ctx.font = '900 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(formatCurrency(item.unitPricePix), cardX + 28, priceBoxY + 48);

        // Card Price
        ctx.fillStyle = '#94A3B8';
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const cardInstallment = (item.unitPriceCard / 10).toFixed(2);
        ctx.textAlign = 'right';
        ctx.fillText('CARTÃO 10X', cardX + priceBoxW + 4, priceBoxY + 22);
        ctx.fillStyle = '#60A5FA';
        ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`10x R$ ${cardInstallment}`, cardX + priceBoxW + 4, priceBoxY + 46);
        ctx.textAlign = 'left'; // Reset
      }

      // --- 4. Grand Total & Promo Banner Footer ---
      const footerY = 1205;
      const footerH = 175;
      const footerW = width - 120;
      const footerX = 60;

      // Outer gradient box for the combo total
      const footerGrad = ctx.createLinearGradient(footerX, footerY, footerX + footerW, footerY + footerH);
      footerGrad.addColorStop(0, '#064E3B'); // Dark Emerald
      footerGrad.addColorStop(0.6, '#065F46');
      footerGrad.addColorStop(1, '#1E3A8A'); // Dark Blue
      drawRoundedRect(ctx, footerX, footerY, footerW, footerH, 24, footerGrad, '#10B981', 3);

      // Left: Total Summary
      ctx.fillStyle = '#A7F3D0';
      ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`TOTAL DO COMBO (${totalItemsCount} ITENS)`, footerX + 36, footerY + 45);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(formatCurrency(totalPix), footerX + 36, footerY + 105);

      ctx.fillStyle = '#D1FAE5';
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('À vista no PIX com super desconto', footerX + 36, footerY + 140);

      // Right: Card Option
      ctx.textAlign = 'right';
      ctx.fillStyle = '#93C5FD';
      ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('OU PARCELADO NO CARTÃO', footerX + footerW - 36, footerY + 45);

      ctx.fillStyle = '#60A5FA';
      ctx.font = '900 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`10x de ${formatCurrency(totalCard / 10)}`, footerX + footerW - 36, footerY + 95);

      ctx.fillStyle = '#BFDBFE';
      ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`Total Cartão: ${formatCurrency(totalCard)}`, footerX + footerW - 36, footerY + 135);
      ctx.textAlign = 'left';

      // --- 5. Watermark Note ---
      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        `Preços e quantidades sujeitos ao fechamento coletivo • Emitido em ${new Date().toLocaleDateString('pt-BR')}`,
        width / 2,
        height - 24
      );
      ctx.textAlign = 'left';

      // Generate Data URL for direct preview & download
      const dataUrl = canvas.toDataURL('image/png', 0.95);
      setGeneratedDataUrl(dataUrl);
      setIsGenerating(false);
    };

    renderCanvas();

    return () => {
      isCancelled = true;
    };
  }, [selectedItems, comboTitle, subtitle, campaignTitle]);

  const handleDownloadImage = () => {
    if (!generatedDataUrl) return;
    const a = document.createElement('a');
    a.href = generatedDataUrl;
    const cleanTitle = comboTitle.replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `Foto_Combo_${cleanTitle}_${Date.now().toString().slice(-4)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyImage = async () => {
    if (!canvasRef.current) return;
    try {
      canvasRef.current.toBlob(async blob => {
        if (!blob) return;
        if (navigator.clipboard && (window as any).ClipboardItem) {
          await navigator.clipboard.write([
            new (window as any).ClipboardItem({ 'image/png': blob }),
          ]);
          setCopiedImage(true);
          setTimeout(() => setCopiedImage(false), 2500);
        } else {
          handleDownloadImage();
        }
      }, 'image/png');
    } catch {
      handleDownloadImage();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 text-white rounded-3xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                Gerador de Foto do Combo Promocional
              </h3>
              <p className="text-xs text-slate-400">
                Gera imagem em alta resolução para envio no WhatsApp com fotos dos produtos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyImage}
              disabled={isGenerating || !generatedDataUrl}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                copiedImage
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {copiedImage ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedImage ? 'Imagem Copiada!' : 'Copiar Imagem'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={isGenerating || !generatedDataUrl}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Imagem PNG</span>
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

        {/* Modal Body: Settings + Live Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto">
          {/* Left Settings Panel */}
          <div className="lg:col-span-4 p-5 border-b lg:border-b-0 lg:border-r border-slate-800 space-y-4 text-xs">
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                Título do Combo
              </label>
              <input
                type="text"
                value={comboTitle}
                onChange={e => setComboTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                placeholder="Ex: Combo Especial Café & Azeite"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                Subtítulo / Chamada
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={e => setSubtitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                placeholder="Ex: Condições Exclusivas Direto de Fábrica"
              />
            </div>

            {/* Selected Products List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Produtos no Combo ({selectedItems.length})
                </span>
                <span className="text-[10px] text-slate-400">Máx. 6 recomendados</span>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {selectedItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center font-bold text-[10px] text-slate-300 shrink-0">
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <div className="font-bold text-white text-xs truncate">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-emerald-400 font-semibold">
                          {formatCurrency(item.unitPricePix)} (PIX)
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedItems(prev => prev.filter(p => p.id !== item.id))}
                      className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors shrink-0"
                      title="Remover do Combo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="p-3.5 rounded-xl bg-slate-800 border border-slate-700 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Total PIX à Vista:</span>
                <strong className="text-emerald-400 text-sm font-black">{formatCurrency(totalPix)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Cartão 10x:</span>
                <strong className="text-blue-400">{formatCurrency(totalCard)}</strong>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-700">
                <span>Parcelas no Cartão:</span>
                <span>10x de {formatCurrency(totalCard / 10)}</span>
              </div>
            </div>
          </div>

          {/* Right Live Preview Panel */}
          <div className="lg:col-span-8 p-6 bg-slate-950 flex flex-col items-center justify-center relative min-h-[460px]">
            {isGenerating && (
              <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center z-10 gap-3">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                <span className="text-xs font-bold text-slate-300">
                  Renderizando fotos e gerando imagem de alta resolução...
                </span>
              </div>
            )}

            {/* Hidden canvas that generates the crisp image */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Interactive Image Preview */}
            {generatedDataUrl ? (
              <div className="max-w-md w-full shadow-2xl rounded-2xl overflow-hidden border border-slate-700 transition-all hover:scale-101">
                <img
                  src={generatedDataUrl}
                  alt="Prévia do Combo"
                  className="w-full h-auto object-contain"
                />
              </div>
            ) : (
              <div className="text-center text-slate-500 text-xs">
                Selecione produtos para gerar a foto do combo.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

// --- Canvas Drawing Helpers ---

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillColor: string | CanvasGradient,
  strokeColor?: string,
  strokeWidth: number = 1
) {
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = fillColor;
  ctx.fill();

  if (strokeColor && strokeWidth > 0) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  bgColor: string,
  text: string,
  textColor: string
) {
  const r = height / 2;
  drawRoundedRect(ctx, x, y, width, height, r, bgColor);
  ctx.fillStyle = textColor;
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + width / 2, y + height / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number = 2
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && i > 0) {
      lines.push(currentLine);
      currentLine = words[i];
      if (lines.length >= maxLines) break;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  // If last line overflows, add ellipsis
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1] + '...';
  }

  return lines;
}
