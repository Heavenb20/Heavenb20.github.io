// Fade sections in the first time they scroll into view.
// Content stays visible without JavaScript: the hidden starting state only
// applies when <html> has the "js" class, which the page adds in its <head>.
(function () {
  var els = document.querySelectorAll('[data-reveal],[data-pic]');
  if (!('IntersectionObserver' in window)) {
    els.forEach(function (e) { e.classList.add('is-in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  els.forEach(function (e) { io.observe(e); });
})();
