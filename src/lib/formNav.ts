import type { KeyboardEvent } from 'react';

// [all apps] [all tenants] — shared form keyboard navigation:
// Tab moves focus forward, Shift+Tab moves focus backward, contained within
// `container` and following DOM order. Attach to a wrapper's onKeyDown.
export function handleFormTabNav(container: HTMLElement | null, e: KeyboardEvent) {
  if (e.key !== 'Tab' || !container) return;
  const focusables = Array.from(
    container.querySelectorAll<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
    ),
  ).filter((el) => el.tabIndex !== -1 && el.offsetParent !== null);
  const idx = focusables.indexOf(document.activeElement as HTMLElement);
  if (idx === -1) return;
  const next = focusables[idx + (e.shiftKey ? -1 : 1)];
  if (next) {
    e.preventDefault();
    next.focus();
  }
}
