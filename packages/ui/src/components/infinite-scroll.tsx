import * as React from "react";

interface InfiniteScrollProps {
  isLoading: boolean;
  hasMore: boolean;
  next: () => unknown;
  threshold?: number;
  root?: Element | Document | null;
  rootMargin?: string;
  reverse?: boolean;
  children?: React.ReactNode;
}

export function InfiniteScroll({
  isLoading,
  hasMore,
  next,
  threshold = 1,
  root = null,
  rootMargin = "0px",
  reverse,
  children,
}: InfiniteScrollProps) {
  const observer = React.useRef<IntersectionObserver>(null);

  const observerRef = React.useCallback(
    (element: HTMLElement | null) => {
      let safeThreshold = threshold;
      if (threshold < 0 || threshold > 1) {
        console.warn(
          "threshold should be between 0 and 1. You are exceed the range. will use default value: 1"
        );
        safeThreshold = 1;
      }

      if (isLoading) return;

      if (observer.current) observer.current.disconnect();

      if (!element) return;

      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore) {
            next();
          }
        },
        { threshold: safeThreshold, root, rootMargin }
      );

      observer.current.observe(element);
    },
    [hasMore, isLoading, next, threshold, root, rootMargin]
  );

  return (
    <>
      {reverse && <div ref={observerRef} style={{ height: "1px" }} />}
      {children}
      {!reverse && <div ref={observerRef} style={{ height: "1px" }} />}
    </>
  );
}
