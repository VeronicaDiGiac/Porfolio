/* PF ARCHIVIO TECNOLOGICO — parallasse leggera per le immagini decorative.
   Un solo listener scroll (passive) + un solo rAF loop, mai transform sullo
   stesso nodo che porta .reveal (che gestisce già fade/traslazione d'ingresso
   tramite l'IntersectionObserver di main.js). */

const MAX_OFFSET_PX = 26;
/* 900px allinea la soglia agli altri breakpoint a due colonne del sito
   (hero-grid/about-grid in theme.css), dove le decorazioni sono comunque
   nascoste via CSS: soglia più conservativa dei 768px indicati nel brief,
   mai meno restrittiva. */
const DISABLE_QUERY = "(max-width: 900px), (prefers-reduced-motion: reduce)";

function initParallax() {
  const disableQuery = window.matchMedia(DISABLE_QUERY);
  if (disableQuery.matches) return;

  const figures = Array.from(document.querySelectorAll(".decor-figure[data-parallax]"))
    .map((figure) => ({ figure, img: figure.querySelector("img, .decor-figure__placeholder") }))
    .filter((entry) => entry.img);

  if (!figures.length) return;

  let dirty = true;
  let ticking = false;

  const onScroll = () => {
    dirty = true;
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };

  const update = () => {
    ticking = false;
    if (!dirty) return;
    dirty = false;

    const viewportCenter = window.innerHeight / 2;
    const strength = 0.12;

    figures.forEach(({ figure, img }) => {
      const rect = figure.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return;
      const distanceFromCenter = rect.top + rect.height / 2 - viewportCenter;
      const offset = Math.max(-MAX_OFFSET_PX, Math.min(MAX_OFFSET_PX, -distanceFromCenter * strength));
      img.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();

  disableQuery.addEventListener("change", (e) => {
    if (e.matches) {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      figures.forEach(({ img }) => {
        img.style.transform = "";
      });
    }
  });
}

document.addEventListener("DOMContentLoaded", initParallax);
