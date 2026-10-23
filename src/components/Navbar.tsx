import React from 'react';
import { ShoppingBag, ShieldCheck, Users, Link as LinkIcon, Database, Eye } from 'lucide-react';

interface NavbarProps {
  currentMode: 'admin' | 'client';
  setCurrentMode: (mode: 'admin' | 'client') => void;
  campaignTitle: string;
  markupPercent: number;
  markupPercentPix?: number;
  markupPercentCard?: number;
  totalOrders: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  setCurrentMode,
  campaignTitle,
  markupPercent,
  markupPercentPix,
  markupPercentCard,
  totalOrders,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
                ColetivoB2B
              </span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Pedidos Conjuntos
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-xs">
              {campaignTitle || 'Rodada de Compras Ativa'}
            </p>
          </div>
        </div>

        {/* Center Indicators */}
        <div className="hidden md:flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Firestore Conectado</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
            <span className="text-slate-400">PIX:</span>
            <span className="font-bold text-emerald-400">+{markupPercentPix ?? markupPercent}%</span>
            <span className="text-slate-500 mx-1">|</span>
            <span className="text-slate-400">Cartão 10x:</span>
            <span className="font-bold text-blue-400">+{markupPercentCard ?? 25}%</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold text-white">{totalOrders}</span>
            <span className="text-slate-400">pedidos</span>
          </div>
        </div>

        {/* Switch Mode Controls */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-800/90 p-1 rounded-xl border border-slate-700/80 flex items-center shadow-inner">
            <button
              onClick={() => setCurrentMode('admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentMode === 'admin'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Painel Admin</span>
            </button>
            <button
              onClick={() => setCurrentMode('client')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentMode === 'client'
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Testar a tela que o cliente recebe"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Simular Cliente</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
