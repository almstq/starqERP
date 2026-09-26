import { useState, useEffect } from 'react';
export function useSidebarState() {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    // SERP-450: default must be COLLAPSED on a first visit. The previous
    // fallback was 'true', so a cashier with no stored preference got an
    // expanded rail, which contradicted the collapsed-by-default contract
    // even though the useState initializer below was already false.
    // A malformed stored value must also fall back to collapsed, not expanded.
    try { setExpanded(JSON.parse(localStorage.getItem('erp-sidebar-expanded') ?? 'false')); } catch { setExpanded(false); }
  }, []);
  useEffect(() => { localStorage.setItem('erp-sidebar-expanded', JSON.stringify(expanded)); }, [expanded]);
  return { expanded, setExpanded, toggle: () => setExpanded(p => !p) };
}
