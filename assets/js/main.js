/* PF ARCHIVIO TECNOLOGICO — comportamento sito */

function switchLanguage(lang) {
  localStorage.setItem("lang", lang);

  document.querySelectorAll("[data-lang]").forEach((el) => {
    el.classList.toggle("is-active", el.getAttribute("data-lang") === lang);
  });

  document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-lang-btn") === lang);
  });

  document.documentElement.setAttribute("lang", lang);
}

function initLanguage() {
  const savedLang = localStorage.getItem("lang") || "it";
  switchLanguage(savedLang);

  document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
    btn.addEventListener("click", () => switchLanguage(btn.getAttribute("data-lang-btn")));
  });
}

function initScrollSpy() {
  const sections = Array.from(document.querySelectorAll("main [data-section]"));
  const navItems = Array.from(document.querySelectorAll(".site-nav__item"));
  const progressSegs = Array.from(document.querySelectorAll(".progress-bar__seg"));

  if (!sections.length || !navItems.length) return;

  const setActive = (id) => {
    navItems.forEach((item) => {
      item.classList.toggle("is-active", item.getAttribute("href") === `#${id}`);
    });
    const idx = sections.findIndex((s) => s.id === id);
    progressSegs.forEach((seg, i) => {
      seg.classList.toggle("is-filled", i <= idx);
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActive(entry.target.id);
        }
      });
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
  );

  sections.forEach((section) => observer.observe(section));
}

function initReveal() {
  const items = document.querySelectorAll(".reveal");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!items.length) return;

  if (reduceMotion) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  items.forEach((el) => observer.observe(el));
}

document.addEventListener("DOMContentLoaded", () => {
  initLanguage();
  initScrollSpy();
  initReveal();
});
