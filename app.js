'use strict';

const EVENT = Object.freeze({
  name: 'Ближе',
  title: 'Ближе — вечер, который хочется разделить',
  city: 'Москва',
  venue: 'лофт «Комната»',
  dayMonth: '28 ноября',
  fullDate: '28 ноября 2026',
  weekdayTime: 'суббота, 18:30',
  calendarStartUTC: '20261128T153000Z',
  calendarEndUTC: '20261128T200000Z',
  calendarDescription: 'Демонстрационное мероприятие. Дата и место вымышлены. Сайт-приглашение «Ближе».',
});

document.title = EVENT.title;
document.querySelectorAll('[data-event]').forEach(element => {
  const value = EVENT[element.dataset.event];
  if (typeof value === 'string') element.textContent = value;
});

const body = document.body;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const toggle = document.querySelector('.motion-toggle');
const stage = document.querySelector('.ticket-stage');
const ticket = document.querySelector('#ticket');
const hero = document.querySelector('.hero');
const programme = document.querySelector('.programme');
const programmeList = document.querySelector('.programme-list');
const programmeRows = [...programmeList.querySelectorAll('li')];
const place = document.querySelector('.place');
const rsvp = document.querySelector('.rsvp');
const galleryScene = document.querySelector('.gallery-scene');
const motionSections = [hero, galleryScene, programme, place, rsvp];
const visibleSections = new Set(motionSections);
let paused = false;
let scrollFrame = 0;
let pointerFrame = 0;
let pointerX = 0;
let pointerY = 0;
let activeProgramme = 0;
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function motionAllowed() {
  return !paused && !reduceMotion.matches && !document.hidden;
}

function syncMotion() {
  body.classList.toggle('motion-paused', paused || reduceMotion.matches || document.hidden);
  toggle.setAttribute('aria-pressed', String(paused));
  toggle.setAttribute('aria-label', paused ? 'Возобновить анимацию' : 'Приостановить анимацию');
  toggle.querySelector('use').setAttribute('href', paused ? '#play' : '#pause');
  if (!motionAllowed()) {
    cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    stage.style.setProperty('--tilt-x', '0deg');
    stage.style.setProperty('--tilt-y', '0deg');
  }
  scheduleScroll();
}

toggle.addEventListener('click', () => { paused = !paused; syncMotion(); });
reduceMotion.addEventListener('change', syncMotion);
document.addEventListener('visibilitychange', syncMotion);

ticket.addEventListener('click', () => {
  const flipped = !ticket.classList.contains('is-flipped');
  ticket.classList.toggle('is-flipped', flipped);
  ticket.setAttribute('aria-pressed', String(flipped));
  ticket.setAttribute('aria-label', flipped ? 'Показать лицевую сторону приглашения' : 'Перевернуть приглашение');
  ticket.querySelector('.ticket-front').setAttribute('aria-hidden', String(flipped));
  ticket.querySelector('.ticket-back').setAttribute('aria-hidden', String(!flipped));
});

function updateScroll() {
  scrollFrame = 0;
  if (document.hidden || visibleSections.size === 0) return;
  const viewport = window.innerHeight;
  const moving = motionAllowed();
  const rects = new Map();
  const writes = [];
  motionSections.forEach(section => {
    if (visibleSections.has(section)) rects.set(section, section.getBoundingClientRect());
  });
  const rowRects = rects.has(programme) ? programmeRows.map(row => row.getBoundingClientRect()) : null;
  const listRect = rowRects ? programmeList.getBoundingClientRect() : null;
  if (moving && rects.has(hero)) {
    const bounds = rects.get(hero);
    const progress = clamp(-bounds.top / (bounds.height * .72));
    writes.push([stage, '--scroll', progress.toFixed(4)], [stage, '--frozen-scroll', progress.toFixed(4)]);
    writes.push([hero, '--hero-back', `${(progress * 52).toFixed(2)}px`]);
    writes.push([hero, '--ribbon-shift', `${(-progress * 85).toFixed(2)}px`]);
    writes.push([hero, '--ribbon-turn', `${(progress * 12).toFixed(2)}deg`]);
  }
  let nextActive = activeProgramme;
  if (rowRects) {
    const target = viewport * .57;
    const centers = rowRects.map(rect => rect.top + rect.height / 2);
    let nearest = Infinity;
    centers.forEach((center, index) => {
      const distance = Math.abs(center - target);
      if (distance < nearest) { nearest = distance; nextActive = index; }
    });
    // Small scroll reversals at a midpoint should not restart the light handoff.
    const currentDistance = Math.abs(centers[activeProgramme] - target);
    const handoffMargin = Math.min(22, viewport * .025);
    if (nextActive !== activeProgramme && nearest + handoffMargin >= currentDistance) {
      nextActive = activeProgramme;
    }
    const routeTop = centers[0] - listRect.top;
    const routeHeight = centers.at(-1) - centers[0];
    const progress = clamp((target - centers[0]) / Math.max(1, routeHeight));
    writes.push([programmeList, '--route-top', `${routeTop.toFixed(2)}px`]);
    writes.push([programmeList, '--route-height', `${routeHeight.toFixed(2)}px`]);
    writes.push([programmeList, '--route-progress', progress.toFixed(4)]);
    if (moving) {
      const bounds = rects.get(programme);
      const passage = clamp((viewport - bounds.top) / (viewport + bounds.height));
      writes.push([programme, '--programme-beam', passage.toFixed(4)]);
      writes.push([programme, '--clock-angle', `${(nextActive * 76 + passage * 36).toFixed(2)}deg`]);
    }
  }
  if (moving && rects.has(place)) {
    const bounds = rects.get(place);
    const progress = clamp((viewport - bounds.top) / (viewport + bounds.height));
    writes.push([place, '--place-shift', `${(progress * 52 - 26).toFixed(2)}px`]);
    writes.push([place, '--place-turn', `${(progress * 8 - 4).toFixed(2)}deg`]);
  }
  if (moving && rects.has(rsvp)) {
    const bounds = rects.get(rsvp);
    const progress = clamp((viewport - bounds.top) / (viewport + bounds.height));
    writes.push([rsvp, '--rsvp-shift', `${(-progress * 75).toFixed(2)}px`]);
    writes.push([rsvp, '--rsvp-turn', `${(progress * 13).toFixed(2)}deg`]);
  }
  if (moving && rects.has(galleryScene)) {
    const bounds = rects.get(galleryScene);
    const progress = clamp((viewport - bounds.top) / (viewport + bounds.height));
    writes.push([galleryScene, '--gallery-turn', `${(progress * 12 - 6).toFixed(2)}deg`]);
  }
  writes.forEach(([element, property, value]) => element.style.setProperty(property, value));
  if (nextActive !== activeProgramme) {
    programmeRows.forEach((row, index) => {
      row.classList.toggle('is-active', index === nextActive);
      if (index === nextActive) row.setAttribute('aria-current', 'step');
      else row.removeAttribute('aria-current');
    });
    activeProgramme = nextActive;
  }
}

function scheduleScroll() {
  if (!scrollFrame && !document.hidden && visibleSections.size) scrollFrame = requestAnimationFrame(updateScroll);
}

window.addEventListener('scroll', scheduleScroll, { passive: true });
window.addEventListener('resize', scheduleScroll, { passive: true });
window.addEventListener('load', scheduleScroll, { once: true });
if (document.fonts?.ready) document.fonts.ready.then(scheduleScroll);

stage.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse' || !motionAllowed() || !visibleSections.has(hero)) return;
  const bounds = stage.getBoundingClientRect();
  pointerX = (event.clientX - bounds.left) / bounds.width - .5;
  pointerY = (event.clientY - bounds.top) / bounds.height - .5;
  if (!pointerFrame) pointerFrame = requestAnimationFrame(() => {
    pointerFrame = 0;
    stage.style.setProperty('--tilt-x', `${(-pointerY * 7).toFixed(2)}deg`);
    stage.style.setProperty('--tilt-y', `${(pointerX * 13).toFixed(2)}deg`);
  });
});

stage.addEventListener('pointerleave', () => {
  cancelAnimationFrame(pointerFrame);
  pointerFrame = 0;
  stage.style.setProperty('--tilt-x', '0deg');
  stage.style.setProperty('--tilt-y', '0deg');
});

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      entry.target.classList.toggle('offscreen', !entry.isIntersecting);
      if (entry.isIntersecting) visibleSections.add(entry.target);
      else visibleSections.delete(entry.target);
    });
    scheduleScroll();
  }, { rootMargin: '80px 0px', threshold: 0 });
  motionSections.forEach(section => observer.observe(section));
}

const gallery = document.querySelector('.photo-gallery');
const photos = [...gallery.querySelectorAll('.polaroid')];
const galleryControls = document.querySelector('.gallery-controls');
const galleryPosition = document.querySelector('#gallery-position');
let galleryIndex = 0;

function syncGalleryControls() {
  galleryControls.style.display = gallery.scrollWidth <= gallery.clientWidth + 2 ? 'none' : '';
  updateGalleryPosition();
}
function updateGalleryPosition() {
  const leading = gallery.scrollLeft + photos[0].offsetLeft;
  let distance = Infinity;
  photos.forEach((photo, index) => {
    const nextDistance = Math.abs(photo.offsetLeft - leading);
    if (nextDistance < distance) { distance = nextDistance; galleryIndex = index; }
  });
  galleryPosition.textContent = String(galleryIndex + 1);
}
if ('ResizeObserver' in window) new ResizeObserver(syncGalleryControls).observe(gallery);
else window.addEventListener('resize', syncGalleryControls, { passive: true });
syncGalleryControls();

function moveGallery(direction) {
  const max = Math.max(0, gallery.scrollWidth - gallery.clientWidth);
  const step = photos[1].offsetLeft - photos[0].offsetLeft;
  const atStart = gallery.scrollLeft <= 2;
  const atEnd = gallery.scrollLeft >= max - 2;
  const target = direction > 0 ? (atEnd ? 0 : Math.min(max, gallery.scrollLeft + step)) : (atStart ? max : Math.max(0, gallery.scrollLeft - step));
  gallery.scrollTo({ left: target, behavior: motionAllowed() ? 'smooth' : 'instant' });
}

document.querySelector('.gallery-prev').addEventListener('click', () => moveGallery(-1));
document.querySelector('.gallery-next').addEventListener('click', () => moveGallery(1));
gallery.addEventListener('keydown', event => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  moveGallery(event.key === 'ArrowRight' ? 1 : -1);
});

let dragging = false;
let dragStartX = 0;
let dragStartScroll = 0;
gallery.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'mouse' || event.button !== 0) return;
  dragging = true;
  dragStartX = event.clientX;
  dragStartScroll = gallery.scrollLeft;
  gallery.setPointerCapture(event.pointerId);
  gallery.style.scrollSnapType = 'none';
});
gallery.addEventListener('pointermove', event => {
  if (!dragging) return;
  gallery.scrollLeft = dragStartScroll - (event.clientX - dragStartX);
});
function stopDragging() {
  dragging = false;
  gallery.style.removeProperty('scroll-snap-type');
}
gallery.addEventListener('pointerup', stopDragging);
gallery.addEventListener('pointercancel', stopDragging);
gallery.addEventListener('lostpointercapture', stopDragging);

let galleryScrollFrame = 0;
gallery.addEventListener('scroll', () => {
  if (galleryScrollFrame) return;
  galleryScrollFrame = requestAnimationFrame(() => {
    galleryScrollFrame = 0;
    updateGalleryPosition();
  });
}, { passive: true });

const options = document.querySelector('.rsvp-options');
const result = document.querySelector('.rsvp-result');
const invitation = document.querySelector('.rsvp-invitation');
const resultTitle = document.querySelector('.result-title');
const status = document.querySelector('#rsvp-status');

document.querySelectorAll('[data-answer]').forEach(button => {
  button.addEventListener('click', () => {
    const answer = button.dataset.answer === 'yes' ? 'Вы выбрали «Буду»' : 'Оставим вечер в планах';
    options.hidden = true;
    options.style.display = 'none';
    invitation.hidden = true;
    result.hidden = false;
    resultTitle.textContent = answer;
    status.textContent = `${answer}. Дату можно сохранить в календарь.`;
    document.querySelector('.rsvp-reset').focus({ preventScroll: true });
  });
});

document.querySelector('.rsvp-reset').addEventListener('click', () => {
  result.hidden = true;
  options.hidden = false;
  options.style.removeProperty('display');
  invitation.hidden = false;
  status.textContent = '';
  document.querySelector('.rsvp-yes').focus({ preventScroll: true });
});

function escapeICS(value) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function saveCalendar() {
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Blizhe Demo//Invitation//RU', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', 'UID:blizhe-demo-20261128@example.invalid', 'DTSTAMP:20261116T090000Z',
    `DTSTART:${EVENT.calendarStartUTC}`, `DTEND:${EVENT.calendarEndUTC}`,
    `SUMMARY:${escapeICS(`${EVENT.name} — демонстрационный вечер`)}`,
    `LOCATION:${escapeICS(`${EVENT.city}, ${EVENT.venue} (вымышленное место)`)}`,
    `DESCRIPTION:${escapeICS(EVENT.calendarDescription)}`, 'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'blizhe-demo.ics';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.querySelectorAll('.calendar-button').forEach(button => button.addEventListener('click', saveCalendar));

document.querySelectorAll('.button,.header-rsvp,.gallery-controls .icon-button,.calendar-button').forEach(control => {
  let releaseTimer;
  control.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') return;
    clearTimeout(releaseTimer);
    control.classList.add('is-pressing');
  });
  const release = () => { releaseTimer = setTimeout(() => control.classList.remove('is-pressing'), 130); };
  control.addEventListener('pointerup', release);
  control.addEventListener('pointercancel', release);
  control.addEventListener('pointerleave', release);
});

syncMotion();
