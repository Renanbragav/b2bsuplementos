import * as XLSX from 'xlsx';
import { ProductItem, ClientOrder, OrderItem } from '../types';

// Helper to normalize strings for header matching
function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Helper to parse price string or number
function parsePrice(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const str = String(val).trim();
  // If string contains comma as decimal separator, e.g. "1.234,50" or "45,90"
  const clean = str.replace(/[^\d.,]/g, '');
  if (clean.includes(',') && clean.includes('.')) {
    // Determine format by last position
    if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
      // 1.250,50 -> 1250.50
      return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
    } else {
      // 1,250.50 -> 1250.50
      return parseFloat(clean.replace(/,/g, '')) || 0;
    }
  } else if (clean.includes(',')) {
    return parseFloat(clean.replace(',', '.')) || 0;
  }
  return parseFloat(clean) || 0;
}

export async function parseSpreadsheet(
  file: File,
  campaignId: string,
  defaultSupplier: string,
  markupPercentPix: number = 15,
  markupPercentCard: number = 25
): Promise<{ products: ProductItem[]; errors: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (jsonRows.length === 0) {
          return resolve({ products: [], errors: ['A planilha está vazia ou não contém dados válidos.'] });
        }

        const errors: string[] = [];
        const products: ProductItem[] = [];

        // Identify column mappings by examining the first row keys
        const firstRow = jsonRows[0];
        const keys = Object.keys(firstRow);

        let nameKey = '';
        let skuKey = '';
        let costKey = '';
        let supplierKey = '';
        let brandKey = '';
        let categoryKey = '';
        let unitKey = '';
        let minQtyKey = '';
        let boxQtyKey = '';
        let eanKey = '';
        let ncmKey = '';

        for (const k of keys) {
          const norm = normalizeKey(k);
          if (!nameKey && (norm.includes('nome') || norm.includes('produto') || norm.includes('descricao') || norm.includes('item') || norm.includes('product'))) {
            nameKey = k;
          } else if (!skuKey && (norm.includes('sku') || norm.includes('codigo') || norm.includes('cod') || norm.includes('ref'))) {
            skuKey = k;
          } else if (!costKey && (norm.includes('preco') || norm.includes('custo') || norm.includes('valor') || norm.includes('price') || norm.includes('tabela'))) {
            costKey = k;
          } else if (!supplierKey && (norm.includes('fornecedor') || norm.includes('distribuidor') || norm.includes('supplier'))) {
            supplierKey = k;
          } else if (!brandKey && (norm.includes('marca') || norm.includes('fabricante') || norm.includes('brand'))) {
            brandKey = k;
          } else if (!boxQtyKey && (norm.includes('qtdcaixa') || norm.includes('qtdporcaixa') || norm.includes('quantidadeporcaixa') || norm.includes('porcaixa') || norm.includes('cx') || norm.includes('caixa') || norm.includes('uncaixa') || norm.includes('embalagem') || norm.includes('fator') || norm.includes('multiplo') || norm.includes('pack'))) {
            boxQtyKey = k;
          } else if (!eanKey && (norm.includes('ean') || norm.includes('gtin') || norm.includes('barras') || norm.includes('codigobarras'))) {
            eanKey = k;
          } else if (!ncmKey && (norm.includes('ncm') || norm.includes('classificacao'))) {
            ncmKey = k;
          } else if (!categoryKey && (norm.includes('categoria') || norm.includes('secao') || norm.includes('grupo') || norm.includes('departamento') || norm.includes('cat'))) {
            categoryKey = k;
          } else if (!unitKey && (norm.includes('unidade') || norm.includes('unid') || norm.includes('un') || norm.includes('medida'))) {
            unitKey = k;
          } else if (!minQtyKey && (norm.includes('min') || norm.includes('minimo'))) {
            minQtyKey = k;
          }
        }

        // Fallback: if nameKey not detected, use first column; if costKey not detected, use second column
        if (!nameKey && keys.length > 0) nameKey = keys[0];
        if (!costKey && keys.length > 1) costKey = keys[1];

        jsonRows.forEach((row, idx) => {
          const name = String(row[nameKey] || '').trim();
          if (!name) return; // Skip empty rows

          const rawCost = row[costKey];
          const costPrice = parsePrice(rawCost);
          const pixMultiplier = 1 + (markupPercentPix / 100);
          const cardMultiplier = 1 + (markupPercentCard / 100);
          const unitPricePix = Number((costPrice * pixMultiplier).toFixed(2));
          const unitPriceCard = Number((costPrice * cardMultiplier).toFixed(2));
          const unitPrice = unitPricePix;

          const sku = skuKey && row[skuKey] ? String(row[skuKey]).trim() : `SKU-${Date.now().toString().slice(-4)}-${idx + 1}`;
          const supplier = defaultSupplier ? defaultSupplier.trim() : (supplierKey && row[supplierKey] ? String(row[supplierKey]).trim() : 'Fornecedor Principal');
          const brand = (brandKey && row[brandKey] ? String(row[brandKey]).trim() : '') || supplier;
          const category = (categoryKey && row[categoryKey] ? String(row[categoryKey]).trim() : '') || 'Geral';
          const unit = (unitKey && row[unitKey] ? String(row[unitKey]).trim() : '') || 'un';
          const minQty = minQtyKey && row[minQtyKey] ? parseInt(String(row[minQtyKey]), 10) || 1 : 1;

          // Parse quantity per box / embalagem
          let quantityPerBox = 1;
          if (boxQtyKey && row[boxQtyKey]) {
            const rawBox = String(row[boxQtyKey]).replace(/[^\d]/g, '');
            const parsedBox = parseInt(rawBox, 10);
            if (!isNaN(parsedBox) && parsedBox > 0) quantityPerBox = parsedBox;
          } else if (unit) {
            // Check if unit mentions quantity, e.g. "cx c/ 12", "fardo c/ 6"
            const match = unit.match(/(?:c\/|com|\*)\s*(\d+)/i);
            if (match) {
              const matchedNum = parseInt(match[1], 10);
              if (!isNaN(matchedNum) && matchedNum > 0) quantityPerBox = matchedNum;
            }
          }

          const ean = eanKey && row[eanKey] ? String(row[eanKey]).trim() : '';
          const ncm = ncmKey && row[ncmKey] ? String(row[ncmKey]).trim() : '';

          const product: ProductItem = {
            id: `prod_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
            campaignId: campaignId || 'default',
            name,
            sku,
            category,
            supplier,
            brand,
            quantityPerBox,
            ean,
            ncm,
            costPrice,
            unitPrice,
            unitPricePix,
            unitPriceCard,
            unit,
            minQuantity: minQty,
            createdAt: new Date().toISOString(),
          };

          products.push(product);
        });

        resolve({ products, errors });
      } catch (err: any) {
        reject(new Error(`Falha ao processar arquivo: ${err.message}`));
      }
    };

    reader.onerror = () => reject(new Error('Erro ao ler o arquivo selecionado.'));
    reader.readAsArrayBuffer(file);
  });
}

// Download a formatted sample template for users
export function downloadSampleSpreadsheet(): void {
  const sampleData = [
    {
      'Código / SKU': 'ALIM-001',
      'Nome do Produto': 'Café Torrado Especial 500g',
      'Marca': 'Brasil Minas',
      'Fornecedor': 'Torrefação Brasil Minas',
      'Categoria': 'Alimentos & Bebidas',
      'Qtd por Caixa': 10,
      'Unidade': 'cx c/ 10 un',
      'Preço de Custo (R$)': 18.50,
      'EAN / Cód. Barras': '7891000100012',
      'NCM': '0901.21.00',
    },
    {
      'Código / SKU': 'ALIM-002',
      'Nome do Produto': 'Azeite Extra Virgem 500ml',
      'Marca': 'Serra Verde',
      'Fornecedor': 'Distribuidora Serra Verde',
      'Categoria': 'Alimentos & Bebidas',
      'Qtd por Caixa': 6,
      'Unidade': 'cx c/ 6 un',
      'Preço de Custo (R$)': 32.90,
      'EAN / Cód. Barras': '7892000200023',
      'NCM': '1509.10.00',
    },
    {
      'Código / SKU': 'ALIM-003',
      'Nome do Produto': 'Arroz Especial Tipo 1 - 5kg',
      'Marca': 'Sul Nobre',
      'Fornecedor': 'Cerealista Sul Nobre',
      'Categoria': 'Mercearia',
      'Qtd por Caixa': 6,
      'Unidade': 'fardo c/ 6 un',
      'Preço de Custo (R$)': 24.80,
      'EAN / Cód. Barras': '7893000300034',
      'NCM': '1006.30.21',
    },
    {
      'Código / SKU': 'DESC-104',
      'Nome do Produto': 'Papel Toalha Interfolhado 2 Dobras',
      'Marca': 'CleanPack',
      'Fornecedor': 'CleanPack Distribuidora',
      'Categoria': 'Higiene & Descartáveis',
      'Qtd por Caixa': 1000,
      'Unidade': 'pct c/ 1000 fls',
      'Preço de Custo (R$)': 14.20,
      'EAN / Cód. Barras': '7894000400045',
      'NCM': '4818.20.00',
    },
    {
      'Código / SKU': 'DESC-105',
      'Nome do Produto': 'Detergente Neutro Concentrado 5L',
      'Marca': 'CleanPack',
      'Fornecedor': 'CleanPack Distribuidora',
      'Categoria': 'Higiene & Descartáveis',
      'Qtd por Caixa': 4,
      'Unidade': 'galão 5L',
      'Preço de Custo (R$)': 22.50,
      'EAN / Cód. Barras': '7895000500056',
      'NCM': '3402.20.00',
    },
    {
      'Código / SKU': 'EMB-201',
      'Nome do Produto': 'Sacola Kraft Delivery M (30x20x10)',
      'Marca': 'EcoBag',
      'Fornecedor': 'EcoBag Embalagens',
      'Categoria': 'Embalagens',
      'Qtd por Caixa': 100,
      'Unidade': 'fardo c/ 100 un',
      'Preço de Custo (R$)': 68.00,
      'EAN / Cód. Barras': '7896000600067',
      'NCM': '4819.40.00',
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ModeloFornecedor');

  // Trigger download
  XLSX.writeFile(workbook, 'modelo_planilha_fornecedor.xlsx');
}

export interface ConsolidatedItem {
  productId: string;
  name: string;
  sku: string;
  category: string;
  supplier: string;
  brand?: string;
  quantityPerBox: number;
  totalBoxes: number;
  unit: string;
  costPrice: number;
  unitPrice: number;
  totalQuantity: number;
  totalCost: number;
  totalRevenue: number;
  profit: number;
  clientBreakdown: { clientName: string; clientWhatsapp: string; quantity: number }[];
}

export function consolidateOrders(orders: ClientOrder[]): {
  consolidatedItems: ConsolidatedItem[];
  bySupplier: Record<string, ConsolidatedItem[]>;
  totalOrdersCount: number;
  totalGrossRevenue: number;
  totalSupplierCost: number;
  totalProfit: number;
  marginPercent: number;
} {
  const itemMap: Record<string, ConsolidatedItem> = {};

  orders.forEach(order => {
    // Normalise items whether array or map
    const itemsList: OrderItem[] = Array.isArray(order.items)
      ? order.items
      : order.items && typeof order.items === 'object'
      ? Object.values(order.items)
      : [];

    itemsList.forEach(item => {
      if (!item || item.quantity <= 0) return;
      const key = item.productId || item.sku || item.name;

      if (!itemMap[key]) {
        const qtyPerBox = item.quantityPerBox && item.quantityPerBox > 0 ? item.quantityPerBox : 1;
        itemMap[key] = {
          productId: item.productId,
          name: item.name,
          sku: item.sku || '-',
          category: item.category || 'Geral',
          supplier: item.supplier || 'Fornecedor Geral',
          brand: item.brand || item.supplier || 'Geral',
          quantityPerBox: qtyPerBox,
          totalBoxes: 0,
          unit: item.unit || 'un',
          costPrice: item.costPrice || 0,
          unitPrice: item.unitPrice || 0,
          totalQuantity: 0,
          totalCost: 0,
          totalRevenue: 0,
          profit: 0,
          clientBreakdown: [],
        };
      }

      itemMap[key].totalQuantity += item.quantity;
      itemMap[key].totalBoxes = itemMap[key].quantityPerBox > 1
        ? Number((itemMap[key].totalQuantity / itemMap[key].quantityPerBox).toFixed(1))
        : itemMap[key].totalQuantity;
      itemMap[key].totalCost += (item.costPrice || 0) * item.quantity;
      itemMap[key].totalRevenue += (item.unitPrice || 0) * item.quantity;
      itemMap[key].profit = itemMap[key].totalRevenue - itemMap[key].totalCost;

      itemMap[key].clientBreakdown.push({
        clientName: order.clientName,
        clientWhatsapp: order.clientWhatsapp,
        quantity: item.quantity,
      });
    });
  });

  const consolidatedItems = Object.values(itemMap).sort((a, b) => b.totalQuantity - a.totalQuantity);

  const bySupplier: Record<string, ConsolidatedItem[]> = {};
  consolidatedItems.forEach(item => {
    const s = item.supplier || 'Outros Fornecedores';
    if (!bySupplier[s]) bySupplier[s] = [];
    bySupplier[s].push(item);
  });

  let totalGrossRevenue = 0;
  let totalSupplierCost = 0;

  consolidatedItems.forEach(item => {
    totalGrossRevenue += item.totalRevenue;
    totalSupplierCost += item.totalCost;
  });

  const totalProfit = totalGrossRevenue - totalSupplierCost;
  const marginPercent = totalGrossRevenue > 0 ? (totalProfit / totalGrossRevenue) * 100 : 0;

  return {
    consolidatedItems,
    bySupplier,
    totalOrdersCount: orders.length,
    totalGrossRevenue,
    totalSupplierCost,
    totalProfit,
    marginPercent,
  };
}

export function exportConsolidatedToExcel(orders: ClientOrder[]): void {
  const { consolidatedItems, bySupplier, totalGrossRevenue, totalSupplierCost, totalProfit } = consolidateOrders(orders);

  const workbook = XLSX.utils.book_new();

  // Sheet 1: Resumo Geral por Produto
  const generalData = consolidatedItems.map(item => ({
    'Fornecedor': item.supplier,
    'Código/SKU': item.sku,
    'Produto': item.name,
    'Unidade': item.unit,
    'Qtd Total': item.totalQuantity,
    'Custo Unit. (R$)': item.costPrice,
    'Total Custo Fornecedor (R$)': Number(item.totalCost.toFixed(2)),
    'Preço Venda Unit. (R$)': item.unitPrice,
    'Total Faturado (R$)': Number(item.totalRevenue.toFixed(2)),
    'Margem/Lucro (R$)': Number(item.profit.toFixed(2)),
    'Clientes': item.clientBreakdown.map(c => `${c.clientName} (${c.quantity} ${item.unit})`).join('; ')
  }));

  const generalSheet = XLSX.utils.json_to_sheet(generalData);
  XLSX.utils.book_append_sheet(workbook, generalSheet, 'Consolidado Geral');

  // Sheet 2: Pedido por Fornecedor (para envio direto)
  Object.entries(bySupplier).forEach(([supplierName, items]) => {
    const supplierData = items.map(it => ({
      'Código/SKU': it.sku,
      'Descrição do Item': it.name,
      'Unidade': it.unit,
      'Quantidade a Pedir': it.totalQuantity,
      'Preço Tabela (R$)': it.costPrice,
      'Subtotal a Pagar (R$)': Number(it.totalCost.toFixed(2)),
    }));

    // Add total row
    const supplierTotal = items.reduce((acc, curr) => acc + curr.totalCost, 0);
    supplierData.push({
      'Código/SKU': 'TOTAL',
      'Descrição do Item': `TOTAL DO PEDIDO - ${supplierName}`,
      'Unidade': '-',
      'Quantidade a Pedir': items.reduce((acc, curr) => acc + curr.totalQuantity, 0),
      'Preço Tabela (R$)': 0,
      'Subtotal a Pagar (R$)': Number(supplierTotal.toFixed(2)),
    });

    const safeSheetName = supplierName.slice(0, 28).replace(/[\\/?*[\]]/g, '');
    const supSheet = XLSX.utils.json_to_sheet(supplierData);
    XLSX.utils.book_append_sheet(workbook, supSheet, safeSheetName || 'Fornecedor');
  });

  // Sheet 3: Pedidos individuais dos clientes
  const clientsData = orders.map(o => ({
    'ID Pedido': o.id,
    'Cliente / Razão Social': o.clientName,
    'CNPJ': o.clientCnpj,
    'WhatsApp': o.clientWhatsapp,
    'Meta Definida (R$)': o.targetAmount,
    'Total Pedido (R$)': o.totalAmount,
    'Atingiu Meta?': o.totalAmount >= o.targetAmount ? 'SIM' : 'NÃO',
    'Total Itens': o.totalItems,
    'Status': o.status,
    'Data/Hora': o.createdAt,
  }));
  const clientsSheet = XLSX.utils.json_to_sheet(clientsData);
  XLSX.utils.book_append_sheet(workbook, clientsSheet, 'Pedidos Clientes');

  XLSX.writeFile(workbook, `Consolidado_Compras_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Initial default seed items so the app is rich and functional from minute 1
export function getInitialSampleProducts(
  campaignId: string = 'camp_default',
  markupPercentPix: number = 15,
  markupPercentCard: number = 25
): ProductItem[] {
  const samples = [
    {
      name: 'Café Grão Torrado Gourmet 1kg',
      sku: 'CF-GR-100',
      category: 'Cafeteria & Grãos',
      supplier: 'Torrefação Brasil Minas',
      costPrice: 42.00,
      unit: 'kg',
      minQuantity: 1,
    },
    {
      name: 'Café Especial Tradicional 500g (Cx c/ 10)',
      sku: 'CF-CX-10',
      category: 'Cafeteria & Grãos',
      supplier: 'Torrefação Brasil Minas',
      costPrice: 165.00,
      unit: 'cx',
      minQuantity: 1,
    },
    {
      name: 'Azeite Extra Virgem Importado 500ml (Cx c/ 6)',
      sku: 'AZ-EV-06',
      category: 'Mercearia Fina',
      supplier: 'Distribuidora Serra Verde',
      costPrice: 198.00,
      unit: 'cx',
      minQuantity: 1,
    },
    {
      name: 'Molho de Tomate Rústico Pelati 2.5kg (Lata)',
      sku: 'ML-PL-25',
      category: 'Mercearia Fina',
      supplier: 'Distribuidora Serra Verde',
      costPrice: 38.50,
      unit: 'lata',
      minQuantity: 2,
    },
    {
      name: 'Arroz Nobre Especial 5kg (Fardo c/ 6)',
      sku: 'AR-FD-06',
      category: 'Grãos & Cereais',
      supplier: 'Cerealista Sul Nobre',
      costPrice: 148.80,
      unit: 'fardo',
      minQuantity: 1,
    },
    {
      name: 'Feijão Carioca Selecionado 1kg (Fardo c/ 10)',
      sku: 'FJ-FD-10',
      category: 'Grãos & Cereais',
      supplier: 'Cerealista Sul Nobre',
      costPrice: 79.00,
      unit: 'fardo',
      minQuantity: 1,
    },
    {
      name: 'Papel Toalha Interfolhado 2 Dobras 1000 fls',
      sku: 'PL-IN-100',
      category: 'Higiene & Descartáveis',
      supplier: 'CleanPack Distribuidora',
      costPrice: 14.50,
      unit: 'pct',
      minQuantity: 5,
    },
    {
      name: 'Detergente Neutro Concentrado 5L',
      sku: 'DT-NC-05',
      category: 'Higiene & Descartáveis',
      supplier: 'CleanPack Distribuidora',
      costPrice: 24.00,
      unit: 'galão',
      minQuantity: 2,
    },
    {
      name: 'Sacola Kraft Delivery G c/ Alça (Fardo 100un)',
      sku: 'SC-KF-100',
      category: 'Embalagens B2B',
      supplier: 'EcoBag Embalagens',
      costPrice: 85.00,
      unit: 'fardo',
      minQuantity: 1,
    },
    {
      name: 'Copo Térmico Biodegradável 240ml (Cx 500un)',
      sku: 'CP-TM-500',
      category: 'Embalagens B2B',
      supplier: 'EcoBag Embalagens',
      costPrice: 120.00,
      unit: 'cx',
      minQuantity: 1,
    }
  ];

  const pixMultiplier = 1 + markupPercentPix / 100;
  const cardMultiplier = 1 + markupPercentCard / 100;

  return samples.map((s, idx) => {
    const costPrice = s.costPrice;
    const unitPricePix = Number((costPrice * pixMultiplier).toFixed(2));
    const unitPriceCard = Number((costPrice * cardMultiplier).toFixed(2));
    return {
      id: `prod_seed_${idx + 1}`,
      campaignId,
      name: s.name,
      sku: s.sku,
      category: s.category,
      supplier: s.supplier,
      costPrice,
      unitPrice: unitPricePix,
      unitPricePix,
      unitPriceCard,
      unit: s.unit,
      minQuantity: s.minQuantity,
      quantityPerBox: idx % 2 === 0 ? 6 : 12,
      createdAt: new Date().toISOString(),
    };
  });
}
