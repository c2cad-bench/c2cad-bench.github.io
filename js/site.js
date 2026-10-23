/**
 * C2CAD-Bench — shared site interactions
 * Theme switching, navigation, reveal animations, lightbox and citation copy.
 */
(function () {
  "use strict";

  var THEME_KEY = "c2cad-theme";
  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------ */
  /* Theme                                                              */
  /* ------------------------------------------------------------------ */

  function readTheme() {
    try {
      var saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "light") return saved;
    } catch (err) {
      /* storage may be unavailable */
    }
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (err) {
      /* ignore */
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#080b15" : "#ffffff");
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      btn.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
    });
    window.dispatchEvent(new CustomEvent("c2cad:themechange", { detail: { theme: theme } }));
  }

  function setupTheme() {
    applyTheme(readTheme());
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Navigation                                                         */
  /* ------------------------------------------------------------------ */

  function setupNavigation() {
    var header = document.querySelector(".site-header");
    var toggle = document.querySelector("[data-nav-toggle]");
    var menu = document.getElementById("site-nav-menu");
    var progress = document.querySelector(".scroll-progress");

    function closeMenu() {
      if (!menu) return;
      menu.classList.remove("is-open");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    }

    if (toggle && menu) {
      toggle.addEventListener("click", function (event) {
        event.stopPropagation();
        var open = menu.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });

      menu.addEventListener("click", function (event) {
        if (event.target.closest("a")) closeMenu();
      });

      document.addEventListener("click", function (event) {
        if (!menu.contains(event.target) && !toggle.contains(event.target)) closeMenu();
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") closeMenu();
      });
    }

    function onScroll() {
      var y = window.scrollY || window.pageYOffset || 0;
      if (header) header.classList.toggle("is-scrolled", y > 8);
      if (progress) {
        var height = document.documentElement.scrollHeight - window.innerHeight;
        var pct = height > 0 ? Math.min(100, (y / height) * 100) : 0;
        progress.style.width = pct + "%";
      }
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    /* Highlight the section currently in view. */
    var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-link[href^='#']"));
    var sections = navLinks
      .map(function (link) {
        return document.querySelector(link.getAttribute("href"));
      })
      .filter(Boolean);

    if ("IntersectionObserver" in window && sections.length) {
      var spy = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            navLinks.forEach(function (link) {
              link.classList.toggle("is-active", link.getAttribute("href") === "#" + entry.target.id);
            });
          });
        },
        { rootMargin: "-35% 0px -55% 0px", threshold: 0 }
      );
      sections.forEach(function (section) {
        spy.observe(section);
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Reveal on scroll                                                   */
  /* ------------------------------------------------------------------ */

  function setupReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );

    items.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Lightbox                                                           */
  /* ------------------------------------------------------------------ */

  function setupLightbox() {
    var cards = document.querySelectorAll(".figure-card[data-full]");
    if (!cards.length) return;

    var box = document.createElement("div");
    box.className = "lightbox";
    box.innerHTML =
      '<button class="lightbox-close" type="button" aria-label="Close image">' +
      '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
      "</button>" +
      '<div class="lightbox-inner"><img alt=""><p class="lightbox-caption"></p></div>';
    document.body.appendChild(box);

    var image = box.querySelector("img");
    var caption = box.querySelector(".lightbox-caption");
    var closeBtn = box.querySelector(".lightbox-close");
    var lastFocus = null;

    function open(card) {
      lastFocus = document.activeElement;
      image.src = card.getAttribute("data-full");
      image.alt = card.getAttribute("data-caption") || "";
      caption.textContent = card.getAttribute("data-caption") || "";
      box.classList.add("is-open");
      document.body.classList.add("has-lightbox");
      closeBtn.focus();
    }

    function close() {
      box.classList.remove("is-open");
      document.body.classList.remove("has-lightbox");
      image.removeAttribute("src");
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    }

    cards.forEach(function (card) {
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.addEventListener("click", function () {
        open(card);
      });
      card.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open(card);
        }
      });
    });

    closeBtn.addEventListener("click", close);
    box.addEventListener("click", function (event) {
      if (event.target === box) close();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && box.classList.contains("is-open")) close();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Citation copy                                                      */
  /* ------------------------------------------------------------------ */

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        document.body.removeChild(area);
      }
    });
  }

  function setupCopyButtons() {
    document.querySelectorAll("[data-copy-target]").forEach(function (button) {
      var original = button.innerHTML;
      button.addEventListener("click", function () {
        var target = document.getElementById(button.getAttribute("data-copy-target"));
        if (!target) return;
        var text = target.innerText || target.textContent || "";
        copyText(text.trim())
          .then(function () {
            button.innerHTML =
              '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 13 4 4L19 7"/></svg><span>Copied</span>';
            button.classList.add("is-copied");
            window.setTimeout(function () {
              button.innerHTML = original;
              button.classList.remove("is-copied");
            }, 1800);
          })
          .catch(function () {
            button.innerHTML = '<span>Press Ctrl+C</span>';
            window.setTimeout(function () {
              button.innerHTML = original;
            }, 1800);
          });
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Family explorer                                                    */
  /* ------------------------------------------------------------------ */

  function setupFamilyExplorer() {
    var explorer = document.querySelector("[data-family-explorer]");
    if (!explorer) return;

    var filters = Array.prototype.slice.call(explorer.querySelectorAll(".family-filter"));
    var chips = Array.prototype.slice.call(explorer.querySelectorAll(".family-chip"));
    var count = explorer.querySelector("[data-family-count]");

    function apply(phase) {
      var shown = 0;
      chips.forEach(function (chip) {
        var match = phase === "all" || chip.getAttribute("data-phase") === phase;
        chip.hidden = !match;
        if (match) shown += 1;
      });
      filters.forEach(function (filter) {
        filter.classList.toggle("is-active", filter.getAttribute("data-filter") === phase);
      });
      if (count) count.textContent = shown;
    }

    filters.forEach(function (filter) {
      filter.addEventListener("click", function () {
        apply(filter.getAttribute("data-filter"));
      });
    });

    apply("all");
  }

  /* ------------------------------------------------------------------ */
  /* Misc                                                               */
  /* ------------------------------------------------------------------ */

  function setupYear() {
    document.querySelectorAll("[data-year]").forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  function setupTooltips() {
    document.querySelectorAll("[data-tooltip]").forEach(function (el) {
      if (!el.getAttribute("title")) el.setAttribute("title", el.getAttribute("data-tooltip"));
    });
  }

  function init() {
    setupTheme();
    setupNavigation();
    setupReveal();
    setupLightbox();
    setupCopyButtons();
    setupFamilyExplorer();
    setupYear();
    setupTooltips();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
