/* Responsive gallery media: native lazy fallback, bounded early loading and decode. */
(() => {
  'use strict';

  const gallery = document.querySelector('.photo-gallery');
  const images = gallery ? Array.from(gallery.querySelectorAll('.polaroid .photo-media img')) : [];
  if (!gallery || !images.length) {
    window.BlizheGalleryMedia = { prepareForScroll: () => Promise.resolve(), prewarm: () => {} };
    return;
  }

  const states = new Map();
  const queue = new Map();
  const maxActive = 2;
  let active = 0;
  let warmed = false;
  let scrollTimer = 0;
  let observer;

  function finish(state, success) {
    if (state.settled) return;
    state.settled = true;
    state.success = success;
    state.media.classList.remove('is-pending');
    state.media.classList.toggle('is-ready', success);
    state.media.classList.toggle('is-error', !success);
    // A failed high-resolution request leaves the inline preview intact.
    if (!success) state.img.style.opacity = '0';
    state.img.removeEventListener('load', state.onLoad);
    state.img.removeEventListener('error', state.onError);
    state.resolve(success);
  }

  function decode(state) {
    if (state.settled || state.decoding) return;
    if (!state.img.naturalWidth) {
      finish(state, false);
      return;
    }
    state.decoding = true;
    let decoded;
    try {
      decoded = state.img.decode ? state.img.decode() : Promise.resolve();
    } catch (_) {
      decoded = Promise.resolve();
    }
    // Some browsers reject decode() for a usable cached image; do not strand it.
    Promise.resolve(decoded).then(
      () => finish(state, true),
      () => finish(state, state.img.naturalWidth > 0)
    );
  }

  images.forEach(img => {
    const media = img.closest('.photo-media');
    const state = { img, media, settled: false, started: false, decoding: false };
    state.promise = new Promise(resolve => { state.resolve = resolve; });
    state.onLoad = () => decode(state);
    state.onError = () => finish(state, false);
    states.set(img, state);
    img.addEventListener('load', state.onLoad);
    img.addEventListener('error', state.onError);
    if (img.complete) {
      if (img.naturalWidth) decode(state);
      else finish(state, false);
    } else {
      media.classList.add('is-pending');
    }
  });

  function pump() {
    while (active < maxActive && queue.size) {
      const job = Array.from(queue.values()).sort((a, b) => b.priority - a.priority)[0];
      queue.delete(job.img);
      const state = states.get(job.img);
      if (!state || state.settled || state.started) continue;
      if (job.img.complete || state.decoding) {
        if (!state.decoding) decode(state);
        continue;
      }
      state.started = true;
      active += 1;
      // Use the existing src/srcset selection. No second Image() or duplicate fetch.
      job.img.fetchPriority = job.priority >= 900 ? 'auto' : 'low';
      job.img.loading = 'eager';
      state.promise.finally(() => {
        active -= 1;
        pump();
      });
    }
  }

  function bounds(img) {
    const card = img.closest('.polaroid');
    const cardRect = card.getBoundingClientRect();
    const galleryRect = gallery.getBoundingClientRect();
    const left = cardRect.left - galleryRect.left + gallery.scrollLeft;
    return { left, right: left + cardRect.width, width: cardRect.width };
  }

  function scheduleFor(left, includeRemainder) {
    const width = gallery.clientWidth;
    const target = Math.max(0, Math.min(Number(left) || 0, Math.max(0, gallery.scrollWidth - width)));
    const viewportEnd = target + width;
    const centre = target + width / 2;
    const measurements = images.map(img => ({ img, ...bounds(img) }));
    const buffer = measurements.length ? measurements[0].width + 32 : 360;
    const wanted = [];

    measurements.forEach(item => {
      const state = states.get(item.img);
      const visible = item.right > target && item.left < viewportEnd;
      const nearby = item.right > target - buffer && item.left < viewportEnd + buffer;
      if (nearby) wanted.push(state.promise);
      if (state.started && visible) item.img.fetchPriority = 'auto';
      if (state.settled || state.started || state.decoding || (!nearby && !includeRemainder && !queue.has(item.img))) return;
      const distance = Math.abs((item.left + item.right) / 2 - centre);
      const priority = (visible ? 1100 : nearby ? 750 : 100) - Math.min(distance / 20, 200);
      // Rebase queued priorities when the intended scroll target changes.
      queue.set(item.img, { img: item.img, priority });
    });
    pump();
    return wanted;
  }

  function prewarm() {
    warmed = true;
    if (observer) observer.disconnect();
    scheduleFor(gallery.scrollLeft, true);
  }

  function prepareForScroll(left) {
    warmed = true;
    if (observer) observer.disconnect();
    const wanted = scheduleFor(left, true);
    // Controls can continue after 1.2s; every image still has its tiny preview.
    return new Promise(resolve => {
      let done = false;
      const timeout = window.setTimeout(complete, 1200);
      function complete() {
        if (done) return;
        done = true;
        window.clearTimeout(timeout);
        resolve();
      }
      Promise.all(wanted).then(complete, complete);
    });
  }

  window.BlizheGalleryMedia = { prepareForScroll, prewarm };

  gallery.addEventListener('scroll', () => {
    warmed = true;
    if (scrollTimer) return;
    scrollTimer = window.setTimeout(() => {
      scrollTimer = 0;
      scheduleFor(gallery.scrollLeft, false);
    }, 90);
  }, { passive: true });

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) prewarm();
    }, { rootMargin: '1100px 0px', threshold: 0 });
    observer.observe(gallery);
  } else {
    prewarm();
  }

  const warmOnHash = () => {
    if (window.location.hash === '#atmosphere') prewarm();
  };
  window.addEventListener('hashchange', warmOnHash);
  warmOnHash();

  window.addEventListener('resize', () => {
    if (warmed) scheduleFor(gallery.scrollLeft, false);
  }, { passive: true });
})();
