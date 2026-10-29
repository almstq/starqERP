// SERP-450 regression: the sidebar must be COLLAPSED by default.
//
// The literal useState(false) initializer was already correct before this fix,
// so a test asserting only that would pass on the broken code. The observable
// contract is the state AFTER mount effects run, because the persistence
// effect reads localStorage with a fallback and overrode the initializer.
//
// These cases are red on 83bbb3a and green only with the fallback corrected.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useSidebarState } from '../hooks/useSidebarState';

const KEY = 'erp-sidebar-expanded';

describe('SERP-450 sidebar collapsed-by-default contract', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => cleanup());

  it('is COLLAPSED on a first visit with no stored preference', () => {
    // Capture the pre-mount state so the write effect (which persists on mount)
    // cannot mask a genuinely absent preference.
    expect(window.localStorage.getItem(KEY), 'precondition: no stored preference').toBeNull();

    const { result } = renderHook(() => useSidebarState());

    expect(result.current.expanded, 'first visit must render collapsed').toBe(false);
  });

  it('is COLLAPSED when the stored value is malformed', () => {
    window.localStorage.setItem(KEY, 'not-json');
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.expanded, 'malformed preference must fail closed to collapsed').toBe(false);
  });

  it('honours a stored expanded=true preference', () => {
    window.localStorage.setItem(KEY, 'true');
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.expanded, 'stored expanded preference must be honoured').toBe(true);
  });

  it('honours a stored collapsed=false preference', () => {
    window.localStorage.setItem(KEY, 'false');
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.expanded, 'stored collapsed preference must be honoured').toBe(false);
  });

  it('toggles from collapsed to expanded and persists the choice', () => {
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.expanded, 'precondition: starts collapsed').toBe(false);

    act(() => { result.current.toggle(); });

    expect(result.current.expanded, 'toggle must expand from the collapsed default').toBe(true);
    expect(window.localStorage.getItem(KEY), 'the expanded choice must persist').toBe('true');
  });

  it('toggles back to collapsed and persists again', () => {
    window.localStorage.setItem(KEY, 'true');
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.expanded, 'precondition: restored expanded').toBe(true);

    act(() => { result.current.toggle(); });

    expect(result.current.expanded, 'toggle must collapse again').toBe(false);
    expect(window.localStorage.getItem(KEY), 'the collapsed choice must persist').toBe('false');
  });
});
