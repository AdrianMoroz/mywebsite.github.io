const DEFAULT_INTERVAL = 7_000;

function initializeCarousel(root) {
  const slides = [...root.querySelectorAll('[data-carousel-slide]')];
  if (slides.length < 2) return;

  const picker = root.querySelector('[data-carousel-picker]');
  const status = root.querySelector('[data-carousel-status]');
  const rotation = root.querySelector('[data-carousel-rotation]');
  const viewport = root.querySelector('[data-carousel-viewport]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canHover = window.matchMedia('(any-hover: hover)');
  const requestedInterval = Number(root.dataset.interval);
  const interval = Number.isInteger(requestedInterval) && requestedInterval >= 1_000 && requestedInterval <= 2_147_483_647
    ? requestedInterval
    : DEFAULT_INTERVAL;
  let activeIndex = 0;
  let autoplay;
  let hovering = canHover.matches && viewport.matches(':hover');
  let timer;
  const activeTouches = new Set();

  const titles = slides.map((slide) => slide.querySelector('h3'));
  const projectButtons = titles.map((title, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = title.textContent.trim();
    if (title.lang) button.lang = title.lang;
    button.addEventListener('click', () => selectSlide(index));
    return button;
  });

  function showSlide(index) {
    activeIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, position) => {
      const active = position === activeIndex;
      slide.hidden = !active;
      if (active) projectButtons[position].setAttribute('aria-current', 'true');
      else projectButtons[position].removeAttribute('aria-current');
    });
  }

  function selectSlide(index) {
    setAutoplay(false);
    showSlide(index);
    status.textContent = `${projectButtons[activeIndex].textContent} (${activeIndex + 1} of ${slides.length})`;
  }

  function scheduleRotation() {
    window.clearTimeout(timer);
    if (!autoplay || hovering || activeTouches.size) return;
    timer = window.setTimeout(() => {
      showSlide(activeIndex + 1);
      scheduleRotation();
    }, interval);
  }

  function setAutoplay(enabled) {
    if (autoplay === enabled) return;
    autoplay = enabled;
    rotation.textContent = enabled ? 'Pause autoplay' : 'Start autoplay';
    scheduleRotation();
  }

  root.querySelector('[data-carousel-prev]').addEventListener('click', () => selectSlide(activeIndex - 1));
  root.querySelector('[data-carousel-next]').addEventListener('click', () => selectSlide(activeIndex + 1));
  rotation.addEventListener('click', () => setAutoplay(!autoplay));

  for (const type of ['pointerenter', 'pointerleave']) {
    viewport.addEventListener(type, (event) => {
      if (event.pointerType === 'touch') return;
      hovering = type === 'pointerenter';
      scheduleRotation();
    });
  }

  viewport.addEventListener('pointerdown', ({ pointerType, pointerId }) => {
    if (pointerType !== 'touch') return;
    activeTouches.add(pointerId);
    scheduleRotation();
  });

  for (const type of ['pointerup', 'pointercancel']) {
    window.addEventListener(type, ({ pointerId }) => {
      if (activeTouches.delete(pointerId)) scheduleRotation();
    }, { capture: true });
  }

  root.addEventListener('focusin', ({ target }) => {
    // A pointer click on Pause must not change it to Play before the click runs.
    if (target !== rotation || rotation.matches(':focus-visible')) setAutoplay(false);
  });

  reducedMotion.addEventListener('change', ({ matches }) => {
    if (matches) setAutoplay(false);
  });

  root.addEventListener('keydown', (event) => {
    if (!event.target.closest('[data-carousel-navigation]')) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    selectSlide(activeIndex + (event.key === 'ArrowLeft' ? -1 : 1));
  });

  root.classList.add('carousel--enhanced');
  root.setAttribute('aria-roledescription', 'carousel');
  slides.forEach((slide, index) => {
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `${index + 1} of ${slides.length}`);
  });
  picker.append(...projectButtons);
  const focusedElement = document.activeElement;
  const focusedIndex = slides.findIndex((slide) => slide.contains(focusedElement));
  // The static cards may already have been reached on a slow connection.
  showSlide(Math.max(0, focusedIndex));
  root.querySelectorAll('[data-carousel-navigation]').forEach((group) => { group.hidden = false; });
  rotation.hidden = false;
  setAutoplay(!reducedMotion.matches && !root.contains(focusedElement));
}

document.querySelectorAll('[data-carousel]').forEach(initializeCarousel);
