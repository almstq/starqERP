import { useState, useEffect } from 'react';
export function useSidebarState() {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    try { setExpanded(JSON.parse(localStorage.getItem('erp-sidebar-expanded') ?? 'true')); } catch { setExpanded(true); }
  }, []);
  useEffect(() => { localStorage.setItem('erp-sidebar-expanded', JSON.stringify(expanded)); }, [expanded]);
  return { expanded, setExpanded, toggle: () => setExpanded(p => !p) };
}
