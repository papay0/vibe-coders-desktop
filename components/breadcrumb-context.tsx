'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface BreadcrumbContextType {
  customName: string | null;
  setCustomName: (name: string | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(undefined);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [customName, setCustomName] = useState<string | null>(null);

  return (
    <BreadcrumbContext.Provider value={{ customName, setCustomName }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb() {
  const context = useContext(BreadcrumbContext);
  if (context === undefined) {
    throw new Error('useBreadcrumb must be used within a BreadcrumbProvider');
  }
  return context;
}

export function SetBreadcrumbName({ name }: { name: string }) {
  const { setCustomName } = useBreadcrumb();

  useEffect(() => {
    setCustomName(name);
    return () => setCustomName(null);
  }, [name, setCustomName]);

  return null;
}
