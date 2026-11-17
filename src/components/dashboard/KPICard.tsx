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
          iconBg: 'bg-maroon-50 text-maroon-800 border border-maroon-200',
          badgeBg: 'bg-maroon-100 text-maroon-800',
        };
      case 'warning':
        return {
          iconBg: 'bg-amber-50 text-amber-700 border border-amber-200',
          badgeBg: 'bg-amber-100 text-amber-800',
        };
      case 'danger':
        return {
          iconBg: 'bg-rose-50 text-rose-700 border border-rose-200',
          badgeBg: 'bg-rose-100 text-rose-800',
        };
      case 'success':
        return {
          iconBg: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
          badgeBg: 'bg-emerald-100 text-emerald-800',
        };
      default:
        return {
          iconBg: 'bg-slate-50 text-slate-700 border border-slate-200',
          badgeBg: 'bg-slate-100 text-slate-700',
        };
    }
  };

  const colors = getColors();

  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-soft hover:shadow-md transition-shadow relative overflow-hidden group">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors.iconBg} transition-transform group-hover:scale-105`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {/* Main value */}
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-semibold tabular-nums text-slate-900 tracking-tight">{value}</span>
        {badge && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${colors.badgeBg}`}>
            {badge}
          </span>
        )}
      </div>

      {/* Subtitle */}
      {subtitle && <p className="mt-1 text-xs text-slate-500 font-medium">{subtitle}</p>}
    </div>
  );
}
