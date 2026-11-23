// Page-level motion, kept small on purpose:
// 1. the background grid drifts a little slower than the page, so scrolling has depth;
// 2. the nav marks which section you are reading.
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduce) {
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        root.style.setProperty('--grid-shift', (window.scrollY * 0.12).toFixed(1) + 'px');
        ticking = false;
      });
    }, { passive: true });
  }

  var links = [].slice.call(document.querySelectorAll('.nav a[href^="#"]'));
  var map = {};
  links.forEach(function (a) {
    var s = document.querySelector(a.getAttribute('href'));
    if (s && s.id !== 'top') map[s.id] = a;
  });
  var hero = document.getElementById('top');
  var ids = Object.keys(map);
  if (!ids.length || !('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      links.forEach(function (a) { a.classList.remove('here'); });
      if (map[e.target.id]) map[e.target.id].classList.add('here');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ids.forEach(function (id) { io.observe(document.getElementById(id)); });
  if (hero) io.observe(hero);
})();
