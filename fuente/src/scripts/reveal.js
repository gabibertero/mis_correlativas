// Presentación: las secciones/tarjetas que están bajo el pliegue aparecen (fade + desliz) la primera vez que entran en pantalla.
if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  const objetivos = [...document.querySelectorAll('main .cab, main .seccion, main .card, main .nivel, main .kpi')]
    .filter((el) => !el.parentElement.closest('.cab, .seccion, .card, .nivel, .kpi') && el.getBoundingClientRect().top > innerHeight);
  const io = new IntersectionObserver((vistos) => {
    for (const v of vistos) {
      if (!v.isIntersecting) continue;
      io.unobserve(v.target);
      v.target.classList.add('rv-in');
      setTimeout(() => v.target.classList.remove('rv', 'rv-in'), 700); // devuelve el control al hover de la tarjeta
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  for (const el of objetivos) { el.classList.add('rv'); io.observe(el); }
}
