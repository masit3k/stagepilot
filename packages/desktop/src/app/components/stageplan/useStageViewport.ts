import { useEffect, useRef, useState } from "react";

export type Viewport = { readonly widthPx: number; readonly heightPx: number };

/**
 * Plocha se přizpůsobuje oknu, takže měřítko musí přepočítat každá změna
 * velikosti. ResizeObserver místo window.resize — panel se mění i bez okna.
 */
export function useStageViewport() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<Viewport>({
    widthPx: 0,
    heightPx: 0,
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      setViewport({ widthPx: box.width, heightPx: box.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, viewport };
}
