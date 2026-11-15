'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  badge?: string;
  variant?: 'default' | 'warning' | 'danger' | 'success' | 'maroon';
}

export function KPICard({ title, value, subtitle, icon: Icon, badge, variant = 'default' }: KPICardProps) {
  const getColors = () => {
    switch (variant) {
      case 'maroon':
        return {
          iconBg: 'bg-gradient-to-br from-maroon-700 to-maroon-900 text-white shadow-maroon shadow-sm ring-1 ring-white/40',
          badgeBg: 'bg-maroon-100/80 text-maroon-900 border border-maroon-200/60',
          glow: 'from-maroon-500/10 to-transparent',
        };
      case 'warning':
        return {
          iconBg: 'bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-sm ring-1 ring-white/40',
          badgeBg: 'bg-amber-100/80 text-amber-900 border border-amber-200/60',
          glow: 'from-amber-500/10 to-transparent',
        };
      case 'danger':
        return {
          iconBg: 'bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-sm ring-1 ring-white/40',
          badgeBg: 'bg-rose-100/80 text-rose-900 border border-rose-200/60',
          glow: 'from-rose-500/10 to-transparent',
        };
      case 'success':
        return {
          iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm ring-1 ring-white/40',
          badgeBg: 'bg-emerald-100/80 text-emerald-900 border border-emerald-200/60',
          glow: 'from-emerald-500/10 to-transparent',
        };
      default:
        return {
          iconBg: 'bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-sm ring-1 ring-white/40',
          badgeBg: 'bg-slate-100/80 text-slate-800 border border-slate-200/60',
          glow: 'from-slate-400/10 to-transparent',
        };
    }
  };

  const colors = getColors();

  return (
    <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
      {/* 3D Ambient Corner Glow */}
      <div className={`absolute -right-8 -top-8 w-24 h-24 bg-gradient-to-bl ${colors.glow} rounded-full blur-xl pointer-events-none group-hover:scale-150 transition-transform duration-500`} />

      {/* Top row */}
      <div className="flex items-center justify-between relative z-10">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors.iconBg} transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}>
          <Icon className="w-5 h-5 drop-shadow-sm" />
        </div>
      </div>

      {/* Main value */}
      <div className="mt-3 flex items-baseline gap-2 relative z-10">
        <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{value}</span>
        {badge && (
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full badge-3d ${colors.badgeBg}`}>
            {badge}
          </span>
        )}
      </div>

      {/* Subtitle */}
      {subtitle && <p className="mt-1 text-xs text-slate-500 font-medium relative z-10">{subtitle}</p>}
    </div>
  );
}
