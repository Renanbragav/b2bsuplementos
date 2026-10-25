import React, { useState } from 'react';
import { ClientOrder, OrderItem } from '../types';
import { formatCurrency, formatCNPJ, formatPhone, formatDateTime, getRemainingTime } from '../lib/formatters';
import {
  Users,
  Search,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  Calendar,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  Lock,
  Unlock,
  ShieldCheck,
  FileText,
  Camera
} from 'lucide-react';

import { ConfirmModal } from './ConfirmModal';
import { OrderMirrorModal } from './OrderMirrorModal';
import { ComboFlyerModal } from './ComboFlyerModal';

interface AdminOrdersTabProps {
  orders: ClientOrder[];
  onDeleteOrder: (id: string) => Promise<void>;
  onClearAllOrders: () => Promise<void>;
  onViewOrderDetails: (order: ClientOrder) => void;
  onOpenClientPortal: (order: ClientOrder) => void;
  onTogglePaymentSettled?: (id: string, settled: boolean) => Promise<void>;
}

export const AdminOrdersTab: React.FC<AdminOrdersTabProps> = ({
  orders,
  onDeleteOrder,
  onClearAllOrders,
  onViewOrderDetails,
  onOpenClientPortal,
  onTogglePaymentSettled,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGoal, setFilterGoal] = useState<'all' | 'reached' | 'below'>('all');
  const [filterPayment, setFilterPayment] = useState<'all' | 'settled' | 'pending'>('all');
  const [orderToDelete, setOrderToDelete] = useState<ClientOrder | null>(null);
  const [isConfirmingClearAllOrders, setIsConfirmingClearAllOrders] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [orderForMirror, setOrderForMirror] = useState<ClientOrder | null>(null);
  const [orderForFlyer, setOrderForFlyer] = useState<ClientOrder | null>(null);

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.clientCnpj.includes(searchTerm) ||
      order.clientWhatsapp.includes(searchTerm);

    if (!matchesSearch) return false;

    const isGoalReached = order.totalAmount >= (order.targetAmount || 0);
    if (filterGoal === 'reached' && !isGoalReached) return false;
    if (filterGoal === 'below' && isGoalReached) return false;

    const isSettled = Boolean(order.paymentSettled || order.status === 'settled');
    if (filterPayment === 'settled' && !isSettled) return false;
    if (filterPayment === 'pending' && isSettled) return false;

    return true;
  });

  const totalClients = orders.length;
  const totalRevenue = orders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
  const reachedCount = orders.filter(o => o.totalAmount >= (o.targetAmount || 0) && (o.targetAmount || 0) > 0).length;
  const settledCount = orders.filter(o => o.paymentSettled || o.status === 'settled').length;
  const pendingSettlementCount = totalClients - settledCount;
  const avgOrderValue = totalClients > 0 ? totalRevenue / totalClients : 0;

  const handleToggleSettled = async (order: ClientOrder, targetStatus: boolean) => {
    if (!onTogglePaymentSettled) return;
    setUpdatingPaymentId(order.id);
    try {
      await onTogglePaymentSettled(order.id, targetStatus);
      if (targetStatus) {
        setActionMessage({
          text: `Pagamento de "${order.clientName}" marcado como ACERTADO! O cliente não poderá mais fazer nenhuma alteração no pedido.`,
          type: 'success',
        });
      } else {
        setActionMessage({
          text: `Acerto do pedido de "${order.clientName}" desmarcado. Pedido liberado para edição caso esteja no prazo.`,
          type: 'success',
        });
      }
    } catch (err: any) {
      setActionMessage({
        text: 'Erro ao atualizar pagamento: ' + err.message,
        type: 'error',
      });
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteOrder(orderToDelete.id);
      setActionMessage({ text: `Pedido de "${orderToDelete.clientName}" excluído com sucesso do Firebase!`, type: 'success' });
      setOrderToDelete(null);
    } catch (err: any) {
      setActionMessage({ text: 'Erro ao excluir pedido: ' + err.message, type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmClearAllOrders = async () => {
    setIsDeleting(true);
    try {
      await onClearAllOrders();
      setActionMessage({ text: 'Todos os pedidos foram limpos com sucesso do Firebase!', type: 'success' });
      setIsConfirmingClearAllOrders(false);
    } catch (err: any) {
      setActionMessage({ text: 'Erro ao limpar pedidos: ' + err.message, type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action feedback banner */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-xs font-semibold shadow-xs animate-fadeIn ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="underline ml-4 font-bold">
            Fechar
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total de Clientes</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalClients}</div>
          <div className="text-xs text-slate-500 mt-1">Pedidos registrados no Firestore</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Volume Total Solicitado</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalRevenue)}</div>
          <div className="text-xs text-slate-500 mt-1">Soma de todos os carrinhos</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pagamentos Acertados</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700">
            {settledCount} <span className="text-xs font-normal text-slate-400">/ {totalClients}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {totalClients > 0 ? `${pendingSettlementCount} aguardando acerto` : 'Sem pedidos'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Ticket Médio</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-purple-600">{formatCurrency(avgOrderValue)}</div>
          <div className="text-xs text-slate-500 mt-1">Por cliente interessado</div>
        </div>
      </div>

      {/* Filter, Search Bar & Clear Orders Action */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por cliente, CNPJ ou WhatsApp..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {orders.length > 0 && (
            <button
              onClick={() => setIsConfirmingClearAllOrders(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors self-end md:self-auto"
              title="Excluir todos os pedidos registrados no Firestore"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar Todos os Pedidos</span>
            </button>
          )}
        </div>

        {/* Filters pills row */}
        <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 mr-1">Status Acerto:</span>
            <button
              onClick={() => setFilterPayment('all')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                filterPayment === 'all'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({orders.length})
            </button>
            <button
              onClick={() => setFilterPayment('settled')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                filterPayment === 'settled'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Acertados ({settledCount})</span>
            </button>
            <button
              onClick={() => setFilterPayment('pending')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                filterPayment === 'pending'
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <span>Aguardando Acerto ({pendingSettlementCount})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 mr-1">Meta:</span>
            <button
              onClick={() => setFilterGoal('all')}
              className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                filterGoal === 'all'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilterGoal('reached')}
              className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                filterGoal === 'reached'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              Atingida ({reachedCount})
            </button>
            <button
              onClick={() => setFilterGoal('below')}
              className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                filterGoal === 'below'
                  ? 'bg-purple-600 text-white font-semibold'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              Abaixo ({totalClients - reachedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">Nenhum pedido encontrado</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
            {searchTerm || filterGoal !== 'all' || filterPayment !== 'all'
              ? 'Tente ajustar os filtros de pesquisa.'
              : 'Compartilhe o link do pedido na aba "Gerador de Links" para que os clientes enviem suas quantidades.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredOrders.map(order => {
            const timeInfo = getRemainingTime(order.expiresAt);
            const targetAmount = order.targetAmount || 0;
            const progressPercent = targetAmount > 0 ? Math.min(100, (order.totalAmount / targetAmount) * 100) : 100;
            const isGoalReached = targetAmount > 0 ? order.totalAmount >= targetAmount : true;
            const isSettled = Boolean(order.paymentSettled || order.status === 'settled');
            const itemsCount = Array.isArray(order.items)
              ? order.items.length
              : typeof order.items === 'object' && order.items !== null
              ? Object.keys(order.items).length
              : 0;

            const cleanPhone = order.clientWhatsapp.replace(/\D/g, '');
            const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(
              `Olá ${order.clientName}, tudo bem? Sobre seu pedido conjunto no valor de ${formatCurrency(order.totalAmount)}...`
            )}`;

            return (
              <div
                key={order.id}
                className={`bg-white rounded-2xl border transition-all p-5 shadow-xs ${
                  isSettled
                    ? 'border-emerald-300 ring-2 ring-emerald-100/80 bg-gradient-to-r from-emerald-50/20 via-white to-white'
                    : 'border-slate-200/80 hover:border-blue-300 hover:shadow-md'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Client info */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-bold text-slate-900">{order.clientName}</h4>
                      
                      {/* Settlement Status Badge */}
                      {isSettled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Pagamento Acertado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          Aguardando Acerto
                        </span>
                      )}

                      {/* Locked Badge if settled */}
                      {isSettled && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200" title="O cliente não pode mais alterar itens ou quantidades">
                          <Lock className="w-3 h-3 text-amber-600" />
                          Bloqueado p/ Cliente
                        </span>
                      )}

                      {/* Payment Method Badge */}
                      {order.paymentMethod === 'card_10x' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                          💳 Cartão 10x
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          🟢 PIX à Vista
                        </span>
                      )}

                      {/* Allowed Suppliers */}
                      {order.allowedSuppliers && order.allowedSuppliers.length > 0 && (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200" title="Fornecedores selecionados para este cliente">
                          🏭 {order.allowedSuppliers.join(', ')}
                        </span>
                      )}

                      {isGoalReached ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Meta Atingida
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          Faltam {formatCurrency(targetAmount - order.totalAmount)}
                        </span>
                      )}

                      {timeInfo.isExpired ? (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          Prazo Encerrado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          <Clock className="w-3 h-3 text-blue-500" />
                          Resta {timeInfo.formatted}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      <span>CNPJ: <strong className="text-slate-700">{formatCNPJ(order.clientCnpj) || 'Não informado'}</strong></span>
                      <span>WhatsApp: <strong className="text-slate-700">{formatPhone(order.clientWhatsapp)}</strong></span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDateTime(order.createdAt)}
                      </span>
                      {order.paymentSettledAt && (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Acertado em: {formatDateTime(order.paymentSettledAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Goal Progress */}
                  <div className="w-full lg:w-72 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">
                        Meta: <strong>{formatCurrency(targetAmount)}</strong>
                      </span>
                      <span className={`font-bold ${isGoalReached ? 'text-emerald-600' : 'text-blue-600'}`}>
                        {progressPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          isGoalReached
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                            : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center text-xs mt-1 text-slate-600">
                      <span>{order.totalItems} unidades</span>
                      <div className="text-right">
                        <div className="font-bold text-slate-900 text-sm">{formatCurrency(order.totalAmount)}</div>
                        {order.paymentMethod === 'card_10x' && (
                          <div className="text-[10px] text-blue-700 font-semibold">
                            10x de {formatCurrency(order.totalAmount / 10)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-end lg:self-center flex-wrap justify-end">
                    {/* Toggle Payment Settled Button */}
                    {isSettled ? (
                      <button
                        onClick={() => handleToggleSettled(order, false)}
                        disabled={updatingPaymentId === order.id}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all"
                        title="Desmarcar acerto e reabrir pedido para o cliente poder editar novamente"
                      >
                        <Unlock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Desmarcar Acerto</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleSettled(order, true)}
                        disabled={updatingPaymentId === order.id}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-sm shadow-emerald-200 rounded-xl transition-all"
                        title="Marcar pagamento como acertado. O cliente ficará bloqueado para fazer qualquer alteração no pedido."
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Marcar Acertado</span>
                      </button>
                    )}

                    {cleanPhone && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors"
                        title="Conversar no WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    )}

                    <button
                      onClick={() => onViewOrderDetails(order)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver Itens ({itemsCount})</span>
                    </button>

                    <button
                      onClick={() => setOrderForMirror(order)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl transition-colors"
                      title="Gerar espelho do pedido em PDF com fotos dos produtos"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Espelho PDF</span>
                    </button>

                    <button
                      onClick={() => onOpenClientPortal(order)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                      title="Abrir como o cliente visualiza"
                    >
                      <span>Abrir Portal</span>
                    </button>

                    <button
                      onClick={() => setOrderToDelete(order)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                      title="Excluir pedido"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Delete Single Order */}
      <ConfirmModal
        isOpen={Boolean(orderToDelete)}
        title="Excluir Pedido"
        message={`Tem certeza que deseja excluir o pedido de "${orderToDelete?.clientName}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        isDangerous={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setOrderToDelete(null)}
      />

      {/* Confirm Clear All Orders */}
      <ConfirmModal
        isOpen={isConfirmingClearAllOrders}
        title="Limpar Todos os Pedidos"
        message="Atenção: Todos os pedidos dos clientes serão permanentemente removidos do banco de dados oficial do Firestore. Esta ação é irreversível!"
        confirmLabel="Sim, limpar todos"
        cancelLabel="Cancelar"
        isDangerous={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmClearAllOrders}
        onCancel={() => setIsConfirmingClearAllOrders(false)}
      />

      {/* Modal: Espelho do Pedido com Fotos em PDF */}
      {orderForMirror && (
        <OrderMirrorModal
          order={orderForMirror}
          onClose={() => setOrderForMirror(null)}
          onOpenComboFlyer={(ord) => {
            setOrderForMirror(null);
            setOrderForFlyer(ord);
          }}
        />
      )}

      {/* Modal: Foto do Combo Flyer */}
      {orderForFlyer && (
        <ComboFlyerModal
          order={orderForFlyer}
          onClose={() => setOrderForFlyer(null)}
        />
      )}
    </div>
  );
};
