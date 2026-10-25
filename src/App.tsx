import React, { useState, useEffect } from 'react';
import { Campaign, ProductItem, ClientOrder, OrderItem } from './types';
import {
  db,
  getCampaign,
  saveCampaign,
  getProducts,
  saveProduct,
  saveMultipleProducts,
  deleteProduct,
  getOrders,
  saveOrder,
  deleteOrder,
  updateOrderPaymentSettled,
  subscribeToOrders,
  subscribeToProducts,
  testConnection,
  clearAllProductsFromFirestore,
  clearAllOrdersFromFirestore,
  deleteProductsBySupplier,
} from './lib/firebase';
import { getInitialSampleProducts } from './lib/spreadsheet';
import { Navbar } from './components/Navbar';
import { AdminOrdersTab } from './components/AdminOrdersTab';
import { AdminConsolidatedTab } from './components/AdminConsolidatedTab';
import { AdminCatalogTab } from './components/AdminCatalogTab';
import { AdminLinksGeneratorTab } from './components/AdminLinksGeneratorTab';
import { AdminSettingsTab } from './components/AdminSettingsTab';
import { ClientPortalSimple } from './components/ClientPortalSimple';
import { OrderSummaryModal } from './components/OrderSummaryModal';
import {
  Users,
  PackageCheck,
  FileSpreadsheet,
  Link as LinkIcon,
  Settings,
  ShoppingBag,
  ArrowRight,
  TrendingUp,
  Percent,
  Clock,
  Sparkles,
  ArrowLeft
} from 'lucide-react';

const DEFAULT_CAMPAIGN_ID = 'camp_default_2026';

export default function App() {
  const [currentMode, setCurrentMode] = useState<'admin' | 'client'>('admin');
  const [isClientOnlyLink, setIsClientOnlyLink] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState<'orders' | 'consolidated' | 'catalog' | 'links' | 'settings'>('orders');

  const [campaign, setCampaign] = useState<Campaign>({
    id: DEFAULT_CAMPAIGN_ID,
    title: 'Rodada de Compras Coletivas B2B - Distribuidoras & Indústrias',
    markupPercent: 15,
    markupPercentPix: 15,
    markupPercentCard: 25,
    defaultDurationHours: 48,
    defaultTargetAmount: 2000,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [currentClientOrder, setCurrentClientOrder] = useState<ClientOrder | null>(null);
  const [inspectedOrder, setInspectedOrder] = useState<ClientOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize and check URL parameters on boot
  useEffect(() => {
    const initApp = async () => {
      setIsLoading(true);
      try {
        await testConnection();

        // Load Campaign
        const existingCamp = await getCampaign(DEFAULT_CAMPAIGN_ID);
        if (existingCamp) {
          setCampaign({
            ...existingCamp,
            markupPercentPix: existingCamp.markupPercentPix ?? existingCamp.markupPercent ?? 15,
            markupPercentCard: existingCamp.markupPercentCard ?? 25,
          });
        } else {
          await saveCampaign(campaign);
        }

        // Check URL search params
        const params = new URLSearchParams(window.location.search);
        const portalParam = params.get('portal');
        const orderIdParam = params.get('order');
        const modeParam = params.get('mode');

        if (portalParam === 'cliente' || orderIdParam) {
          setIsClientOnlyLink(true);
          setCurrentMode('client');
        } else if (modeParam === 'client') {
          setCurrentMode('client');
        }

        // Subscribe to real-time products (catalogs persist permanently in Firestore until admin deletes)
        const unsubProducts = subscribeToProducts(null, loadedProducts => {
          setProducts(loadedProducts);
        });

        // Subscribe to real-time orders (without auto-seeding)
        const unsubOrders = subscribeToOrders(null, loadedOrders => {
          setOrders(loadedOrders);

          if (orderIdParam) {
            const found = loadedOrders.find(o => o.id === orderIdParam);
            if (found) setCurrentClientOrder(found);
          }
        });

        return () => {
          unsubProducts();
          unsubOrders();
        };
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initApp();
  }, []);

  // Handlers
  const handleUpdateMarkupPercents = async (pixPercent: number, cardPercent: number) => {
    // 1. Update Campaign
    const updatedCampaign: Campaign = {
      ...campaign,
      markupPercent: pixPercent,
      markupPercentPix: pixPercent,
      markupPercentCard: cardPercent,
      updatedAt: new Date().toISOString(),
    };
    setCampaign(updatedCampaign);
    await saveCampaign(updatedCampaign);

    // 2. Recalculate selling prices of all products
    const pixMultiplier = 1 + pixPercent / 100;
    const cardMultiplier = 1 + cardPercent / 100;
    const updatedProducts = products.map(p => {
      const pixPrice = Number((p.costPrice * pixMultiplier).toFixed(2));
      const cardPrice = Number((p.costPrice * cardMultiplier).toFixed(2));
      return {
        ...p,
        unitPrice: pixPrice,
        unitPricePix: pixPrice,
        unitPriceCard: cardPrice,
      };
    });

    await saveMultipleProducts(updatedProducts);
  };

  const handleUpdateMarkupPercent = async (newPercent: number) => {
    await handleUpdateMarkupPercents(newPercent, campaign.markupPercentCard || 25);
  };

  const handleAddProducts = async (newProducts: ProductItem[]) => {
    await saveMultipleProducts(newProducts);
  };

  const handleDeleteProduct = async (id: string) => {
    await deleteProduct(id);
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const handleDeleteSupplierProducts = async (supplierName: string) => {
    await deleteProductsBySupplier(supplierName);
    setProducts(prev => prev.filter(p => p.supplier !== supplierName));
  };

  const handleClearAllProducts = async () => {
    await clearAllProductsFromFirestore();
    setProducts([]);
  };

  const handleCreateClientLink = async (data: {
    clientName: string;
    clientWhatsapp: string;
    clientCnpj: string;
    targetAmount: number;
    durationHours: number;
    allowedSuppliers?: string[];
  }): Promise<string> => {
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const expiresAt = new Date(Date.now() + data.durationHours * 3600 * 1000).toISOString();

    const newOrder: ClientOrder = {
      id: orderId,
      campaignId: campaign.id,
      clientName: data.clientName,
      clientWhatsapp: data.clientWhatsapp,
      clientCnpj: data.clientCnpj,
      targetAmount: data.targetAmount,
      totalAmount: 0,
      totalItems: 0,
      durationHours: data.durationHours,
      expiresAt,
      status: 'open',
      paymentSettled: false,
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (data.allowedSuppliers && data.allowedSuppliers.length > 0) {
      newOrder.allowedSuppliers = data.allowedSuppliers;
    }

    await saveOrder(newOrder);
    return orderId;
  };

  const handleSaveClientOrder = async (
    orderData: Partial<ClientOrder> & { items: OrderItem[]; isDraft?: boolean }
  ) => {
    try {
      const orderId = currentClientOrder?.id || `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const fullOrder: ClientOrder = {
        id: orderId,
        campaignId: campaign.id,
        clientName: orderData.clientName || currentClientOrder?.clientName || 'Cliente B2B',
        clientWhatsapp: orderData.clientWhatsapp || currentClientOrder?.clientWhatsapp || '',
        clientCnpj: orderData.clientCnpj || currentClientOrder?.clientCnpj || '',
        targetAmount: orderData.targetAmount ?? currentClientOrder?.targetAmount ?? campaign.defaultTargetAmount,
        totalAmount: orderData.totalAmount || 0,
        totalAmountPix: orderData.totalAmountPix ?? 0,
        totalAmountCard: orderData.totalAmountCard ?? 0,
        paymentMethod: orderData.paymentMethod || currentClientOrder?.paymentMethod || 'pix',
        totalItems: orderData.totalItems || 0,
        durationHours: orderData.durationHours ?? currentClientOrder?.durationHours ?? campaign.defaultDurationHours,
        expiresAt: orderData.expiresAt || currentClientOrder?.expiresAt || new Date(Date.now() + campaign.defaultDurationHours * 3600 * 1000).toISOString(),
        status: orderData.isDraft ? (currentClientOrder?.status || 'open') : 'submitted',
        paymentSettled: currentClientOrder?.paymentSettled ?? false,
        items: orderData.items || [],
        createdAt: currentClientOrder?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (orderData.allowedSuppliers || currentClientOrder?.allowedSuppliers) {
        fullOrder.allowedSuppliers = orderData.allowedSuppliers || currentClientOrder?.allowedSuppliers;
      }
      if (currentClientOrder?.paymentSettledAt) {
        fullOrder.paymentSettledAt = currentClientOrder.paymentSettledAt;
      }

      await saveOrder(fullOrder);

      // Keep orders state updated without blowing away local draft
      setOrders(prev => {
        const idx = prev.findIndex(o => o.id === orderId);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = fullOrder;
          return copy;
        }
        return [fullOrder, ...prev];
      });

      if (!currentClientOrder || currentClientOrder.id === orderId) {
        setCurrentClientOrder(fullOrder);
      }
    } catch (err) {
      console.error('Error saving client order:', err);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    await deleteOrder(id);
    setOrders(prev => prev.filter(o => o.id !== id));
  };

  const handleTogglePaymentSettled = async (orderId: string, settled: boolean) => {
    await updateOrderPaymentSettled(orderId, settled);
    const nowIso = new Date().toISOString();
    setOrders(prev =>
      prev.map(o =>
        o.id === orderId
          ? {
              ...o,
              paymentSettled: settled,
              status: settled ? 'settled' : 'submitted',
              paymentSettledAt: settled ? nowIso : undefined,
              updatedAt: nowIso,
            }
          : o
      )
    );
    if (currentClientOrder && currentClientOrder.id === orderId) {
      setCurrentClientOrder(prev =>
        prev
          ? {
              ...prev,
              paymentSettled: settled,
              status: settled ? 'settled' : 'submitted',
              paymentSettledAt: settled ? nowIso : undefined,
              updatedAt: nowIso,
            }
          : null
      );
    }
  };

  const handleClearAllOrders = async () => {
    await clearAllOrdersFromFirestore();
    setOrders([]);
    setCurrentClientOrder(null);
  };

  const handleUpdateCampaign = async (updated: Partial<Campaign>) => {
    const merged = { ...campaign, ...updated };
    setCampaign(merged);
    await saveCampaign(merged);
  };

  const handleResetDatabaseWithDemoData = async () => {
    // Re-seed products with dual markups
    const initialProds = getInitialSampleProducts(
      campaign.id,
      campaign.markupPercentPix || campaign.markupPercent || 15,
      campaign.markupPercentCard || 25
    );
    await saveMultipleProducts(initialProds);

    // Create 3 realistic sample client orders
    const demoOrders: ClientOrder[] = [
      {
        id: `ord_demo_1_${Date.now()}`,
        campaignId: campaign.id,
        clientName: 'Padaria & Confeitaria Bela Vista',
        clientWhatsapp: '(11) 98765-4321',
        clientCnpj: '12.345.678/0001-90',
        targetAmount: 2000,
        totalAmount: 2154.00,
        totalItems: 42,
        durationHours: 48,
        expiresAt: new Date(Date.now() + 32 * 3600 * 1000).toISOString(),
        status: 'submitted',
        items: [
          {
            productId: initialProds[0].id,
            name: initialProds[0].name,
            sku: initialProds[0].sku,
            category: initialProds[0].category,
            supplier: initialProds[0].supplier,
            unit: initialProds[0].unit,
            costPrice: initialProds[0].costPrice,
            unitPrice: initialProds[0].unitPrice,
            quantity: 20,
            subtotal: initialProds[0].unitPrice * 20,
          },
          {
            productId: initialProds[2].id,
            name: initialProds[2].name,
            sku: initialProds[2].sku,
            category: initialProds[2].category,
            supplier: initialProds[2].supplier,
            unit: initialProds[2].unit,
            costPrice: initialProds[2].costPrice,
            unitPrice: initialProds[2].unitPrice,
            quantity: 4,
            subtotal: initialProds[2].unitPrice * 4,
          }
        ],
        createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: `ord_demo_2_${Date.now()}`,
        campaignId: campaign.id,
        clientName: 'Restaurante Sabor de Minas',
        clientWhatsapp: '(31) 99887-1122',
        clientCnpj: '98.765.432/0001-11',
        targetAmount: 1800,
        totalAmount: 1420.00,
        totalItems: 28,
        durationHours: 24,
        expiresAt: new Date(Date.now() + 14 * 3600 * 1000).toISOString(),
        status: 'submitted',
        items: [
          {
            productId: initialProds[4].id,
            name: initialProds[4].name,
            sku: initialProds[4].sku,
            category: initialProds[4].category,
            supplier: initialProds[4].supplier,
            unit: initialProds[4].unit,
            costPrice: initialProds[4].costPrice,
            unitPrice: initialProds[4].unitPrice,
            quantity: 6,
            subtotal: initialProds[4].unitPrice * 6,
          },
          {
            productId: initialProds[6].id,
            name: initialProds[6].name,
            sku: initialProds[6].sku,
            category: initialProds[6].category,
            supplier: initialProds[6].supplier,
            unit: initialProds[6].unit,
            costPrice: initialProds[6].costPrice,
            unitPrice: initialProds[6].unitPrice,
            quantity: 20,
            subtotal: initialProds[6].unitPrice * 20,
          }
        ],
        createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ];

    for (const ord of demoOrders) {
      await saveOrder(ord);
    }
  };

  const handleClearOfficialDatabase = async () => {
    await clearAllProductsFromFirestore();
    await clearAllOrdersFromFirestore();
    setProducts([]);
    setOrders([]);
    setCurrentClientOrder(null);
  };

  const handleOpenClientFromAdmin = (order: ClientOrder) => {
    setCurrentClientOrder(order);
    setCurrentMode('client');
  };

  // 1. Direct Client Link: accessed via client URL (portal=cliente or orderId)
  // The client sees strictly the simplified list/table and has NO admin navigation or controls.
  if (isClientOnlyLink || (currentMode === 'client' && !window.location.search.includes('admin=true'))) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans">
        {/* If an admin opened this view from their dashboard simulation */}
        {!isClientOnlyLink && (
          <div className="bg-slate-900 text-white px-4 py-2 text-xs flex items-center justify-between border-b border-slate-800">
            <span className="font-semibold text-slate-300">
              Modo de Simulação do Administrador (O cliente não vê esta barra)
            </span>
            <button
              onClick={() => setCurrentMode('admin')}
              className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao Painel Admin</span>
            </button>
          </div>
        )}

        <ClientPortalSimple
          products={products}
          currentOrder={currentClientOrder}
          campaignTitle={campaign.title}
          defaultDurationHours={campaign.defaultDurationHours}
          defaultTargetAmount={campaign.defaultTargetAmount}
          onSaveClientOrder={handleSaveClientOrder}
        />
      </div>
    );
  }

  // 2. Admin Workspace
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        currentMode={currentMode}
        setCurrentMode={setCurrentMode}
        campaignTitle={campaign.title}
        markupPercent={campaign.markupPercent}
        markupPercentPix={campaign.markupPercentPix}
        markupPercentCard={campaign.markupPercentCard}
        totalOrders={orders.length}
      />

      {/* Admin Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Admin Navigation Tabs */}
        <div className="border-b border-slate-200">
          <nav className="flex space-x-2 sm:space-x-8 overflow-x-auto pb-2 sm:pb-0">
            <button
              onClick={() => setActiveAdminTab('orders')}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 font-bold text-xs sm:text-sm whitespace-nowrap transition-colors ${
                activeAdminTab === 'orders'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Painel de Pedidos ({orders.length})</span>
            </button>

              <button
                onClick={() => setActiveAdminTab('consolidated')}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 font-bold text-xs sm:text-sm whitespace-nowrap transition-colors ${
                  activeAdminTab === 'consolidated'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <PackageCheck className="w-4 h-4 text-emerald-600" />
                <span>Consolidado p/ Fornecedores</span>
              </button>

              <button
                onClick={() => setActiveAdminTab('catalog')}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 font-bold text-xs sm:text-sm whitespace-nowrap transition-colors ${
                  activeAdminTab === 'catalog'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Upload & Catálogo ({products.length})</span>
              </button>

              <button
                onClick={() => setActiveAdminTab('links')}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 font-bold text-xs sm:text-sm whitespace-nowrap transition-colors ${
                  activeAdminTab === 'links'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <LinkIcon className="w-4 h-4 text-purple-600" />
                <span>Gerador de Links & Metas</span>
              </button>

              <button
                onClick={() => setActiveAdminTab('settings')}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 font-bold text-xs sm:text-sm whitespace-nowrap transition-colors ${
                  activeAdminTab === 'settings'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Configurações</span>
              </button>
            </nav>
          </div>

          {/* Tab Views */}
          {activeAdminTab === 'orders' && (
            <AdminOrdersTab
              orders={orders}
              onDeleteOrder={handleDeleteOrder}
              onClearAllOrders={handleClearAllOrders}
              onViewOrderDetails={order => setInspectedOrder(order)}
              onOpenClientPortal={handleOpenClientFromAdmin}
              onTogglePaymentSettled={handleTogglePaymentSettled}
            />
          )}

          {activeAdminTab === 'consolidated' && (
            <AdminConsolidatedTab orders={orders} products={products} />
          )}

          {activeAdminTab === 'catalog' && (
            <AdminCatalogTab
              products={products}
              markupPercent={campaign.markupPercent}
              markupPercentPix={campaign.markupPercentPix ?? campaign.markupPercent}
              markupPercentCard={campaign.markupPercentCard ?? 25}
              onUpdateMarkupPercent={handleUpdateMarkupPercent}
              onUpdateMarkupPercents={handleUpdateMarkupPercents}
              onAddProducts={handleAddProducts}
              onDeleteProduct={handleDeleteProduct}
              onClearAllProducts={handleClearAllProducts}
              onDeleteSupplierProducts={handleDeleteSupplierProducts}
              campaignId={campaign.id}
            />
          )}

          {activeAdminTab === 'links' && (
            <AdminLinksGeneratorTab
              campaignId={campaign.id}
              defaultDurationHours={campaign.defaultDurationHours}
              defaultTargetAmount={campaign.defaultTargetAmount}
              orders={orders}
              products={products}
              onCreateClientLink={handleCreateClientLink}
              onOpenClientPortal={handleOpenClientFromAdmin}
            />
          )}

          {activeAdminTab === 'settings' && (
            <AdminSettingsTab
              campaign={campaign}
              onUpdateCampaign={handleUpdateCampaign}
              onResetDatabaseWithDemoData={handleResetDatabaseWithDemoData}
              onClearOfficialDatabase={handleClearOfficialDatabase}
            />
          )}
        </main>

      {/* Inspect Order Details Modal */}
      <OrderSummaryModal
        order={inspectedOrder}
        onClose={() => setInspectedOrder(null)}
      />
    </div>
  );
}
