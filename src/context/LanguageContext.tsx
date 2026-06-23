import React, { createContext, useContext, useState, useEffect } from 'react'

export type Language = 'en' | 'hi' | 'es' | 'fr'

const translations: Record<Language, Record<string, string>> = {
  en: {
    dashboard: "Dashboard",
    clients: "Clients",
    projects: "Projects",
    tasks: "Tasks",
    files: "Files",
    approvals: "Approvals",
    invoices: "Invoices",
    payments: "Payments",
    proposals: "Proposals",
    contracts: "Contracts",
    settings: "Settings",
    logout: "Log Out",
    welcome: "Welcome",
    createInvoice: "Create Invoice",
    newInvoice: "New Invoice",
    taxTemplate: "Tax Template",
    currency: "Currency",
    billingModel: "Billing Model",
    fixed: "Fixed Price",
    hourly: "Hourly Billing",
    gstr1Export: "GSTR-1 Export",
    language: "Language",
    whiteLabel: "Custom Branding",
    theme: "Theme",
    notifications: "Notifications",
    totalRevenue: "Total Revenue",
    activeProjects: "Active Projects",
    pendingApprovals: "Pending Approvals",
    overdueInvoices: "Overdue Invoices",
    recentActivity: "Recent Activity",
  },
  hi: {
    dashboard: "डैशबोर्ड",
    clients: "ग्राहक",
    projects: "परियोजनाएं",
    tasks: "कार्य",
    files: "फ़ाइलें",
    approvals: "स्वीकृतियाँ",
    invoices: "चालान",
    payments: "भुगतान",
    proposals: "प्रस्ताव",
    contracts: "अनुबंध",
    settings: "सेटिंग्स",
    logout: "लॉग आउट",
    welcome: "स्वागत हे",
    createInvoice: "चालान बनाएं",
    newInvoice: "नया चालान",
    taxTemplate: "कर टेम्पलेट",
    currency: "मुद्रा",
    billingModel: "बिलिंग मॉडल",
    fixed: "निश्चित मूल्य",
    hourly: "प्रति घंटा बिलिंग",
    gstr1Export: "जीएसटीआर-1 निर्यात",
    language: "भाषा",
    whiteLabel: "कस्टम ब्रांडिंग",
    theme: "थीम",
    notifications: "सूचनाएं",
    totalRevenue: "कुल राजस्व",
    activeProjects: "सक्रिय परियोजनाएं",
    pendingApprovals: "लंबित स्वीकृतियाँ",
    overdueInvoices: "देय चालान",
    recentActivity: "हाल की गतिविधि",
  },
  es: {
    dashboard: "Tablero",
    clients: "Clientes",
    projects: "Proyectos",
    tasks: "Tareas",
    files: "Archivos",
    approvals: "Aprobaciones",
    invoices: "Facturas",
    payments: "Pagos",
    proposals: "Propuestas",
    contracts: "Contratos",
    settings: "Ajustes",
    logout: "Cerrar sesión",
    welcome: "Bienvenido",
    createInvoice: "Crear factura",
    newInvoice: "Nueva factura",
    taxTemplate: "Plantilla de impuestos",
    currency: "Moneda",
    billingModel: "Modelo de facturación",
    fixed: "Precio fijo",
    hourly: "Facturación por horas",
    gstr1Export: "Exportar GSTR-1",
    language: "Idioma",
    whiteLabel: "Branding personalizado",
    theme: "Tema",
    notifications: "Notificaciones",
    totalRevenue: "Ingresos totales",
    activeProjects: "Proyectos activos",
    pendingApprovals: "Aprobaciones pendientes",
    overdueInvoices: "Facturas vencidas",
    recentActivity: "Actividad reciente",
  },
  fr: {
    dashboard: "Tableau de bord",
    clients: "Clients",
    projects: "Projets",
    tasks: "Tâches",
    files: "Fichiers",
    approvals: "Approbations",
    invoices: "Factures",
    payments: "Paiements",
    proposals: "Propositions",
    contracts: "Contrats",
    settings: "Paramètres",
    logout: "Se déconnecter",
    welcome: "Bienvenue",
    createInvoice: "Créer une facture",
    newInvoice: "Nouvelle facture",
    taxTemplate: "Modèle de taxe",
    currency: "Devise",
    billingModel: "Modèle de facturation",
    fixed: "Prix fixe",
    hourly: "Facturation horaire",
    gstr1Export: "Exporter GSTR-1",
    language: "Langue",
    whiteLabel: "Marque personnalisée",
    theme: "Thème",
    notifications: "Notifications",
    totalRevenue: "Revenu total",
    activeProjects: "Projets actifs",
    pendingApprovals: "Approbations en attente",
    overdueInvoices: "Factures impayées",
    recentActivity: "Activité récente",
  }
}

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('zenithos_language')
    return (saved as Language) || 'en'
  })

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('zenithos_language', lang)
  }

  const t = (key: string): string => {
    const translation = translations[language]?.[key] || translations['en']?.[key]
    return translation || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
