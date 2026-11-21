import { useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

const hoverEvents = ['pointerenter', 'pointerleave'];
const touchEndEvents = ['pointerup', 'pointercancel'];

export function useCarousel(count, intervalMs) {
  const interval = Number.isInteger(intervalMs) && intervalMs >= 1_000 && intervalMs <= 2_147_483_647
    ? intervalMs
    : 7_000;
  const rootRef = useRef(null);
  const viewportRef = useRef(null);
  const rotationRef = useRef(null);
  const [hydrated, setHydrated] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [announcedIndex, setAnnouncedIndex] = useState(null);
  const [playing, setPlaying] = useState(false);
  const interactive = hydrated && count > 1;

  useLayoutEffect(() => {
    if (count < 2) return;

    const root = rootRef.current;
    const viewport = viewportRef.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const focused = document.activeElement;
    const slides = [...viewport.querySelectorAll('[data-carousel-slide]')];
    const activeTouches = new Set();
    let hovering = window.matchMedia('(any-hover: hover)').matches && viewport.matches(':hover');
    let rotationEnabled = !motion.matches && !root.contains(focused);
    let timer;

    // A visitor can focus or hover a static card before React finishes loading.
    setActiveIndex(Math.max(0, slides.findIndex((slide) => slide.contains(focused))));
    setAnnouncedIndex(null);
    setPlaying(rotationEnabled);
    setHydrated(true);

    function syncTimer() {
      window.clearInterval(timer);
      if (!rotationEnabled || hovering || activeTouches.size) return;
      timer = window.setInterval(() => {
        // Commit the new link before another native touch or focus can target the old one.
        flushSync(() => setActiveIndex((previous) => (previous + 1) % count));
      }, interval);
    }

    function setRotation(enabled) {
      if (rotationEnabled === enabled) return;
      rotationEnabled = enabled;
      setPlaying(enabled);
      syncTimer();
    }

    function handleMotion({ matches }) {
      if (matches) setRotation(false);
    }

    function handleHover({ type, pointerType }) {
      if (pointerType === 'touch') return;
      hovering = type === 'pointerenter';
      syncTimer();
    }

    function handleTouchStart({ pointerType, pointerId }) {
      if (pointerType !== 'touch') return;
      activeTouches.add(pointerId);
      syncTimer();
    }

    function handleTouchEnd({ pointerId }) {
      if (activeTouches.delete(pointerId)) syncTimer();
    }

    rotationRef.current = {
      pause: () => setRotation(false),
      toggle: () => setRotation(!rotationEnabled),
    };
    motion.addEventListener('change', handleMotion);
    for (const type of hoverEvents) viewport.addEventListener(type, handleHover);
    viewport.addEventListener('pointerdown', handleTouchStart);
    for (const type of touchEndEvents) window.addEventListener(type, handleTouchEnd, true);
    syncTimer();

    return () => {
      window.clearInterval(timer);
      rotationRef.current = null;
      motion.removeEventListener('change', handleMotion);
      for (const type of hoverEvents) viewport.removeEventListener(type, handleHover);
      viewport.removeEventListener('pointerdown', handleTouchStart);
      for (const type of touchEndEvents) window.removeEventListener(type, handleTouchEnd, true);
    };
  }, [count, interval]);

  function pause() {
    rotationRef.current?.pause();
  }

  function select(index) {
    const next = (index + count) % count;
    pause();
    setActiveIndex(next);
    setAnnouncedIndex(next);
  }

  function toggleRotation() {
    rotationRef.current?.toggle();
  }

  return {
    rootRef, viewportRef, activeIndex: activeIndex < count ? activeIndex : 0, announcedIndex,
    interactive, interval, playing, pause, select, toggleRotation,
  };
}
