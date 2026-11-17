'use client';

import { useEffect, useState, type HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';

let openOverlays = 0;
let previousOverflow = '';

/** Keep viewport overlays outside page spacing and stacking contexts. */
export function ModalOverlay({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setContainer(document.body);
    if (openOverlays === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openOverlays += 1;

    return () => {
      openOverlays -= 1;
      if (openOverlays === 0) document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (!container) return null;

  return createPortal(
    <div {...props} data-modal-overlay>{children}</div>,
    container,
  );
}
