export const ACCENT_THEMES = {
  Orange: { primary: '#F4511E', secondary: '#FF8C42', hoverPrimary: '#D13B0E', rgba: '244, 81, 30' },
  Blue: { primary: '#2563EB', secondary: '#3B82F6', hoverPrimary: '#1D4ED8', rgba: '37, 99, 235' },
  Emerald: { primary: '#059669', secondary: '#10B981', hoverPrimary: '#047857', rgba: '5, 150, 105' },
  Indigo: { primary: '#4F46E5', secondary: '#6366F1', hoverPrimary: '#3730A3', rgba: '79, 70, 229' },
  Violet: { primary: '#7C3AED', secondary: '#8B5CF6', hoverPrimary: '#6D28D9', rgba: '124, 58, 237' }
}

export type ThemeName = keyof typeof ACCENT_THEMES

export function applyAccentTheme(themeName: ThemeName) {
  const theme = ACCENT_THEMES[themeName] || ACCENT_THEMES.Orange
  let styleTag = document.getElementById('zenithos-branding-overrides') as HTMLStyleElement

  if (!styleTag) {
    styleTag = document.createElement('style')
    styleTag.id = 'zenithos-branding-overrides'
    document.head.appendChild(styleTag)
  }

  styleTag.innerHTML = `
    :root {
      --brand-primary: ${theme.primary};
      --brand-secondary: ${theme.secondary};
      --brand-hover-primary: ${theme.hoverPrimary};
      --brand-rgba: ${theme.rgba};
    }
    
    .btn-primary, .badge-brand {
      background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%) !important;
    }
    
    .btn-primary:hover {
      background: linear-gradient(135deg, var(--brand-hover-primary) 0%, var(--brand-primary) 100%) !important;
    }
    
    .text-orange-600, 
    .hover\\:text-orange-600:hover,
    .group:hover .group-hover\\:text-orange-600,
    a.text-orange-600:hover {
      color: var(--brand-primary) !important;
    }
    
    .hover\\:bg-orange-50:hover, .hover\\:bg-orange-50\\/20:hover {
      background-color: rgba(var(--brand-rgba), 0.08) !important;
    }
    
    .focus\\:border-orange-500:focus {
      border-color: var(--brand-primary) !important;
    }
    
    .focus\\:ring-orange-500\\/10:focus {
      --tw-ring-color: rgba(var(--brand-rgba), 0.1) !important;
      ring-color: rgba(var(--brand-rgba), 0.1) !important;
    }
    
    .border-orange-500 {
      border-color: var(--brand-primary) !important;
    }
    
    .bg-orange-50\\/10 {
      background-color: rgba(var(--brand-rgba), 0.05) !important;
    }
    
    .accent-orange-500 {
      accent-color: var(--brand-primary) !important;
    }
    
    .sidebar-item.active, .dark .sidebar-item.active {
      background-color: rgba(var(--brand-rgba), 0.08) !important;
      color: var(--brand-primary) !important;
    }
    
    .avatar, .progress-fill {
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary)) !important;
    }
  `
}
