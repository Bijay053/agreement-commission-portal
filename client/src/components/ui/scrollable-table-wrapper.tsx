import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function ScrollableTableWrapper({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [btnStyle, setBtnStyle] = useState<{ top: number; left: number; right: number; visible: boolean }>({ top: 0, left: 0, right: 0, visible: false });

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    const rect = el.getBoundingClientRect();
    const vpTop = Math.max(rect.top, 0);
    const vpBottom = Math.min(rect.bottom, window.innerHeight);
    if (vpBottom - vpTop < 40) {
      setBtnStyle(s => ({ ...s, visible: false }));
      return;
    }
    setBtnStyle({
      top: vpTop + (vpBottom - vpTop) / 2,
      left: rect.left,
      right: window.innerWidth - rect.right,
      visible: true,
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const scrollParents: (HTMLElement | Window)[] = [window];
    let p = el.parentElement;
    while (p) {
      const ov = getComputedStyle(p).overflowY;
      if (ov === "auto" || ov === "scroll") scrollParents.push(p);
      p = p.parentElement;
    }
    scrollParents.forEach(sp => sp.addEventListener("scroll", update, { passive: true }));
    window.addEventListener("resize", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      scrollParents.forEach(sp => sp.removeEventListener("scroll", update));
      window.removeEventListener("resize", update);
      ro.disconnect();
    };
  }, [update]);

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });
  };

  return (
    <div className={`flex flex-col min-h-0 ${className || ""}`} {...rest}>
      {btnStyle.visible && canScrollLeft && (
        <button
          onClick={() => scroll(-1)}
          style={{ position: "fixed", top: btnStyle.top, left: btnStyle.left, transform: "translateY(-50%)", zIndex: 50 }}
          className="bg-white/95 dark:bg-gray-800/95 shadow-lg border border-gray-300 dark:border-gray-600 rounded-r-lg p-1.5 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
          data-testid="button-scroll-left"
        >
          <ChevronLeft className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </button>
      )}
      {btnStyle.visible && canScrollRight && (
        <button
          onClick={() => scroll(1)}
          style={{ position: "fixed", top: btnStyle.top, right: btnStyle.right, transform: "translateY(-50%)", zIndex: 50 }}
          className="bg-white/95 dark:bg-gray-800/95 shadow-lg border border-gray-300 dark:border-gray-600 rounded-l-lg p-1.5 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
          data-testid="button-scroll-right"
        >
          <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </button>
      )}
      <div ref={scrollRef} className="overflow-auto border rounded-lg flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
}
