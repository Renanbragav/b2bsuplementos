export interface ProductItem {
  id: string;
  campaignId: string;
  name: string;
  sku: string;
  category: string;
  supplier: string;
  brand?: string;
  quantityPerBox?: number;
  ean?: string;
  ncm?: string;
  costPrice: number;
  unitPrice: number; // Base unit price (defaults to Pix)
  unitPricePix?: number; // Price with PIX markup
  unitPriceCard?: number; // Price with Card 10x markup
  unit: string;
  minQuantity?: number;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  category: string;
  supplier: string;
  brand?: string;
  quantityPerBox?: number;
  ean?: string;
  ncm?: string;
  unit: string;
  costPrice: number;
  unitPrice: number; // Applied unit price based on selected payment
  unitPricePix?: number;
  unitPriceCard?: number;
  quantity: number;
  subtotal: number;
}

export type PaymentMethod = 'pix' | 'card_10x';

export interface ClientOrder {
  id: string;
  campaignId: string;
  clientName: string;
  clientWhatsapp: string;
  clientCnpj: string;
  targetAmount: number;
  totalAmount: number;
  totalAmountPix?: number;
  totalAmountCard?: number;
  paymentMethod?: PaymentMethod;
  allowedSuppliers?: string[]; // Specific suppliers allowed for this client
  totalCostAmount?: number;
  totalItems: number;
  durationHours: number;
  expiresAt: string;
  status: 'open' | 'submitted' | 'settled' | 'expired';
  paymentSettled?: boolean; // Admin marked as payment settled (locks client from making any changes)
  paymentSettledAt?: string; // When the admin confirmed the settlement
  items: Record<string, OrderItem> | OrderItem[]; // Supports serialized or array
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface Campaign {
  id: string;
  title: string;
  description?: string;
  markupPercent: number; // Backwards compat (Pix)
  markupPercentPix: number; // Markup for PIX à vista
  markupPercentCard: number; // Markup for Cartão em até 10x
  defaultDurationHours: number;
  defaultTargetAmount: number;
  status: 'active' | 'closed';
  createdAt: string;
  updatedAt: string;
}
