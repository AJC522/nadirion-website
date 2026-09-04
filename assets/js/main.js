(function () {
  "use strict";

  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Header state ---------- */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Mobile navigation ---------- */
  var navToggle = document.getElementById("navToggle");
  var primaryNav = document.getElementById("primaryNav");

  if (navToggle && primaryNav) {
    navToggle.addEventListener("click", function () {
      var isOpen = primaryNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    primaryNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        primaryNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Reveal on scroll ---------- */
  var revealTargets = document.querySelectorAll(
    ".section-head, .toolkit-showcase, .module, .service, .program, .program-thesis, .program-status, .about-copy, .about-visual, .sector, .contact-copy, .contact-form"
  );
  if ("IntersectionObserver" in window && !reduceMotion) {
    revealTargets.forEach(function (el, i) {
      el.classList.add("reveal");
      el.style.transitionDelay = (i % 3) * 80 + "ms";
    });
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 }
    );
    revealTargets.forEach(function (el) { observer.observe(el); });
  }

  /* ---------- Starfield ---------- */
  var canvas = document.getElementById("starfield");
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var width = 0, height = 0;
    var stars = [];
    var streak = null;
    var nextStreakAt = 0;
    var rafId = null;

    var makeStars = function () {
      var count = Math.round((width * height) / 5200);
      stars = [];
      for (var i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: 0.3 + Math.random() * 1.1,
          a: 0.15 + Math.random() * 0.7,
          phase: Math.random() * Math.PI * 2,
          speed: 0.0006 + Math.random() * 0.0016,
          drift: 0.006 + Math.random() * 0.014
        });
      }
    };

    var resize = function () {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      makeStars();
      if (reduceMotion) draw(0);
    };

    var spawnStreak = function (time) {
      var startX = width * (0.35 + Math.random() * 0.6);
      var startY = height * (0.05 + Math.random() * 0.35);
      streak = {
        x: startX,
        y: startY,
        vx: -(3.5 + Math.random() * 2.5),
        vy: 1.4 + Math.random() * 1.2,
        life: 0,
        maxLife: 55 + Math.random() * 25
      };
      nextStreakAt = time + 7000 + Math.random() * 9000;
    };

    var draw = function (time) {
      ctx.clearRect(0, 0, width, height);

      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var alpha = reduceMotion
          ? s.a
          : s.a * (0.65 + 0.35 * Math.sin(s.phase + time * s.speed));

        if (!reduceMotion) {
          s.y -= s.drift;
          if (s.y < -2) { s.y = height + 2; s.x = Math.random() * width; }
        }

        ctx.beginPath();
        ctx.fillStyle = "rgba(235, 235, 240," + alpha.toFixed(3) + ")";
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduceMotion) {
        if (!streak && time > nextStreakAt) spawnStreak(time);
        if (streak) {
          var t = streak.life / streak.maxLife;
          var fade = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
          var tailX = streak.x - streak.vx * 14;
          var tailY = streak.y - streak.vy * 14;
          var grad = ctx.createLinearGradient(streak.x, streak.y, tailX, tailY);
          grad.addColorStop(0, "rgba(255,255,255," + (0.9 * fade).toFixed(3) + ")");
          grad.addColorStop(1, "rgba(255,255,255,0)");
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(streak.x, streak.y);
          ctx.lineTo(tailX, tailY);
          ctx.stroke();

          streak.x += streak.vx;
          streak.y += streak.vy;
          streak.life++;
          if (streak.life > streak.maxLife) streak = null;
        }
        rafId = window.requestAnimationFrame(draw);
      }
    };

    resize();
    window.addEventListener("resize", resize);

    if (!reduceMotion) {
      nextStreakAt = 2500;
      rafId = window.requestAnimationFrame(draw);

      // Pause the animation when the tab is hidden.
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
          if (rafId) window.cancelAnimationFrame(rafId);
          rafId = null;
        } else if (!rafId) {
          rafId = window.requestAnimationFrame(draw);
        }
      });
    }
  }

  /* ---------- Contact form ---------- */
  var form = document.getElementById("contactForm");
  var status = document.getElementById("formStatus");

  if (form && status) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();

      if (!form.checkValidity()) {
        status.textContent = "Please fill in all required fields.";
        status.classList.remove("is-success");
        return;
      }

      var name = form.elements.name.value.trim();

      status.textContent =
        "Thank you, " + name + ". Your message has been received. We'll be in touch shortly.";
      status.classList.add("is-success");
      form.reset();
    });
  }
})();
