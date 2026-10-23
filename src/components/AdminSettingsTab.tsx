import React, { useState } from 'react';
import { Campaign } from '../types';
import { formatCurrency } from '../lib/formatters';
import { Settings, Save, Check, Clock, Target, Percent, Database, RefreshCw, Trash2 } from 'lucide-react';

import { ConfirmModal } from './ConfirmModal';

interface AdminSettingsTabProps {
  campaign: Campaign;
  onUpdateCampaign: (updated: Partial<Campaign>) => Promise<void>;
  onResetDatabaseWithDemoData: () => Promise<void>;
  onClearOfficialDatabase: () => Promise<void>;
}

export const AdminSettingsTab: React.FC<AdminSettingsTabProps> = ({
  campaign,
  onUpdateCampaign,
  onResetDatabaseWithDemoData,
  onClearOfficialDatabase,
}) => {
  const [title, setTitle] = useState(campaign.title);
  const [markupPercentPix, setMarkupPercentPix] = useState(campaign.markupPercentPix ?? campaign.markupPercent ?? 15);
  const [markupPercentCard, setMarkupPercentCard] = useState(campaign.markupPercentCard ?? 25);
  const [defaultDurationHours, setDefaultDurationHours] = useState(campaign.defaultDurationHours);
  const [defaultTargetAmount, setDefaultTargetAmount] = useState(campaign.defaultTargetAmount);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [isConfirmingClearAllOfficial, setIsConfirmingClearAllOfficial] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdateCampaign({
        title,
        markupPercent: Number(markupPercentPix),
        markupPercentPix: Number(markupPercentPix),
        markupPercentCard: Number(markupPercentCard),
        defaultDurationHours: Number(defaultDurationHours),
        defaultTargetAmount: Number(defaultTargetAmount),
        updatedAt: new Date().toISOString(),
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmResetDemo = async () => {
    setIsResetting(true);
    try {
      await onResetDatabaseWithDemoData();
      setIsConfirmingReset(false);
      setResetSuccessMessage('Dados de demonstração recarregados com sucesso no Firebase!');
      setTimeout(() => setResetSuccessMessage(null), 3500);
    } finally {
      setIsResetting(false);
    }
  };

  const handleConfirmClearOfficial = async () => {
    setIsResetting(true);
    try {
      await onClearOfficialDatabase();
      setIsConfirmingClearAllOfficial(false);
      setResetSuccessMessage('Banco de dados completamente zerado! Pronto para uso oficial.');
      setTimeout(() => setResetSuccessMessage(null), 3500);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-100">
          <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Configurações Gerais da Rodada</h3>
            <p className="text-xs text-slate-500">Defina os parâmetros padrão para pedidos conjuntos</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Título da Rodada / Campanha *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/80">
              <label className="block text-xs font-bold text-emerald-900 mb-1">
                Acréscimo PIX à Vista (%) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="500"
                  required
                  value={markupPercentPix}
                  onChange={e => setMarkupPercentPix(Number(e.target.value))}
                  className="w-full text-xs pl-3 pr-7 py-2 bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-950"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-emerald-600 font-bold">%</span>
              </div>
              <p className="text-[10px] text-emerald-700 mt-1">Margem p/ pagamento à vista via PIX</p>
            </div>

            <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200/80">
              <label className="block text-xs font-bold text-blue-900 mb-1">
                Acréscimo Cartão 10x (%) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="500"
                  required
                  value={markupPercentCard}
                  onChange={e => setMarkupPercentCard(Number(e.target.value))}
                  className="w-full text-xs pl-3 pr-7 py-2 bg-white border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-blue-950"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-blue-600 font-bold">%</span>
              </div>
              <p className="text-[10px] text-blue-700 mt-1">Margem p/ cartão em até 10x</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Prazo Padrão (Horas) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="720"
                  required
                  value={defaultDurationHours}
                  onChange={e => setDefaultDurationHours(Number(e.target.value))}
                  className="w-full text-xs pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">h</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Meta Padrão (R$) *
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">R$</span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  required
                  value={defaultTargetAmount}
                  onChange={e => setDefaultTargetAmount(Number(e.target.value))}
                  className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Salvo de forma persistente no Firestore.
            </span>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
            >
              {isSaved ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
              <span>{isSaving ? 'Salvando...' : isSaved ? 'Salvo com Sucesso!' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Demo Data Management */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <Database className="w-4 h-4 text-blue-600" />
          <span>Ambiente de Demonstração & Dados Iniciais</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Deseja carregar dados de demonstração com planilhas de fornecedores e pedidos de clientes simulados para testar relatórios e consolidações?
        </p>

        {resetSuccessMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{resetSuccessMessage}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2.5 pt-1">
          <button
            onClick={() => setIsConfirmingClearAllOfficial(true)}
            disabled={isResetting}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar Banco de Dados para Uso Oficial (Zerar Produtos e Pedidos)</span>
          </button>

          <button
            onClick={() => setIsConfirmingReset(true)}
            disabled={isResetting}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            <span>Recarregar Produtos de Teste (Exemplo)</span>
          </button>
        </div>
      </div>

      {/* Modal: Clear for official use */}
      <ConfirmModal
        isOpen={isConfirmingClearAllOfficial}
        title="Limpar Tudo para Uso Oficial"
        message="Tem certeza que deseja apagar todos os produtos cadastrados e todos os pedidos de exemplo? O banco de dados no Firebase Firestore ficará 100% limpo e pronto para suas planilhas e pedidos oficiais."
        confirmLabel="Sim, Zerar Tudo para Uso Oficial"
        isDangerous={true}
        isLoading={isResetting}
        onConfirm={handleConfirmClearOfficial}
        onCancel={() => setIsConfirmingClearAllOfficial(false)}
      />

      {/* Modal: Reset demo */}
      <ConfirmModal
        isOpen={isConfirmingReset}
        title="Recarregar Dados de Demonstração"
        message="Deseja recarregar o banco de dados com produtos e pedidos de demonstração? Isso irá adicionar novos produtos e atualizar as tabelas para testes no Firebase."
        confirmLabel="Sim, Recarregar Dados"
        isDangerous={false}
        isLoading={isResetting}
        onConfirm={handleConfirmResetDemo}
        onCancel={() => setIsConfirmingReset(false)}
      />
    </div>
  );
};
