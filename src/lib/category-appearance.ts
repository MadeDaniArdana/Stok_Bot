import type { CSSProperties } from 'react';

const palette = [
  { color: '#1d4ed8', backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  { color: '#6d28d9', backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' },
  { color: '#047857', backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  { color: '#92400e', backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  { color: '#c2410c', backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  { color: '#0e7490', backgroundColor: '#ecfeff', borderColor: '#a5f3fc' },
];

const categoryColors: Record<string, number> = {
  'cat-atk': 0,
  'cat-elektronik': 1,
  'cat-clean': 2,
  'cat-paper': 3,
  'cat-pack': 4,
  'cat-it': 5,
};

/** Category identity keeps its color when renamed, reordered, or reloaded. */
export function getCategoryAppearance(categoryId: string): CSSProperties {
  const index = categoryColors[categoryId];
  if (index !== undefined) return palette[index];

  let hash = 2166136261;
  for (const character of categoryId) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  const hue = hash % 360;
  return {
    color: `hsl(${hue} 65% 28%)`,
    backgroundColor: `hsl(${hue} 75% 97%)`,
    borderColor: `hsl(${hue} 60% 82%)`,
  };
}
