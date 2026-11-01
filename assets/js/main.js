(function () {
  "use strict";

  // Lets CSS hide controls that only work with the script running.
  document.documentElement.classList.add("js");

  var mediaMatches = function (query) {
    return !!(window.matchMedia && window.matchMedia(query).matches);
  };
  var reduceMotion = mediaMatches("(prefers-reduced-motion: reduce)");
  // Effects that follow the pointer only make sense with a mouse or trackpad.
  var finePointer = mediaMatches("(hover: hover) and (pointer: fine)");
  // Scroll-triggered animation needs IntersectionObserver. Without it, or when
  // the visitor prefers less motion, everything simply stays in place, and
  // html.motion (which some CSS waits for) is never set.
  var motionOK = !reduceMotion && "IntersectionObserver" in window;
  if (motionOK) document.documentElement.classList.add("motion");

  var clamp = function (value, min, max) {
    return Math.min(Math.max(value, min), max);
  };

  /* ---------- Scroll-linked effects ---------- */
  // One listener, throttled to animation frames, drives everything tied to
  // the scroll position. Each hook gets the scroll offset, the change since
  // the previous frame, and the page's scrollable height, and only writes.
  var scrollHooks = [];
  var scrollQueued = false;
  var lastScrollY = window.scrollY;

  var runScrollHooks = function () {
    scrollQueued = false;
    var y = window.scrollY;
    var dy = y - lastScrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    lastScrollY = y;
    for (var i = 0; i < scrollHooks.length; i++) scrollHooks[i](y, dy, max);
  };
  var queueScroll = function () {
    if (scrollQueued) return;
    scrollQueued = true;
    window.requestAnimationFrame(runScrollHooks);
  };
  window.addEventListener("scroll", queueScroll, { passive: true });
  window.addEventListener("resize", queueScroll);

  /* ---------- Header state and reading progress ---------- */
  var header = document.querySelector(".site-header");
  if (header) {
    scrollHooks.push(function (y, dy, max) {
      header.classList.toggle("is-scrolled", y > 12);
      header.style.setProperty("--progress", max > 0 ? clamp(y / max, 0, 1).toFixed(4) : "0");
    });
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

  /* ---------- Counting stats ---------- */
  // Whole-number figures such as "33" or "08" count up from zero as they come
  // into view, keeping their leading zeros. Screen readers get the real
  // figure the whole time; the counting copy is hidden from them.
  // As each figure lands it catches a glint (.is-counted), and the first to
  // land sends a scanning light along its strip (.is-scanned). Figures that
  // are words land when the numbers beside them do.
  var landed = function (stat) {
    stat.classList.add("is-counted");
    var strip = stat.closest(".stat-strip");
    if (strip) strip.classList.add("is-scanned");
  };

  var countUp = function (stat, delay) {
    var el = stat.querySelector("strong");
    var text = el ? el.textContent.trim() : "";
    if (!/^\d+$/.test(text)) {
      window.setTimeout(function () { landed(stat); }, delay + 1500);
      return;
    }

    var target = parseInt(text, 10);
    var pad = function (n) {
      var out = String(n);
      while (out.length < text.length) out = "0" + out;
      return out;
    };
    var real = document.createElement("span");
    real.className = "visually-hidden";
    real.textContent = text;
    var shown = document.createElement("span");
    shown.setAttribute("aria-hidden", "true");
    shown.textContent = pad(0);
    el.textContent = "";
    el.appendChild(real);
    el.appendChild(shown);

    var start = null;
    var tick = function (now) {
      if (start === null) start = now + delay;
      var t = clamp((now - start) / 1600, 0, 1);
      shown.textContent = pad(Math.round(target * (1 - Math.pow(1 - t, 4))));
      if (t < 1) {
        window.requestAnimationFrame(tick);
      } else {
        el.textContent = text;
        landed(stat);
      }
    };
    window.requestAnimationFrame(tick);
  };

  /* ---------- Console: typed in on arrival ---------- */
  // Each console listing is regrouped into one span per line. When the
  // console scrolls into view its commands are typed out after the prompt and
  // each result appears once its command has finished.
  var prepareConsole = function (consoleEl) {
    var code = consoleEl.querySelector(".console-body code");
    if (!code) return;

    var lines = [];
    var line = null;
    var startLine = function () {
      line = document.createElement("span");
      line.className = "c-line";
      lines.push(line);
    };
    startLine();
    Array.prototype.slice.call(code.childNodes).forEach(function (node) {
      if (node.nodeType !== 3) {
        line.appendChild(node);
        return;
      }
      node.nodeValue.split("\n").forEach(function (part, i) {
        if (i > 0) startLine();
        if (part) line.appendChild(document.createTextNode(part));
      });
    });

    code.textContent = "";
    lines.forEach(function (each, i) {
      if (i > 0) code.appendChild(document.createTextNode("\n"));
      code.appendChild(each);

      var prompt = each.firstChild;
      if (!(prompt && prompt.nodeType === 1 && prompt.classList.contains("c-prompt"))) {
        each.classList.add("c-out");
        return;
      }
      // A command line: the prompt shows at once and the rest is typed.
      var typed = document.createElement("span");
      typed.className = "c-typed";
      while (prompt.nextSibling) typed.appendChild(prompt.nextSibling);
      if (typed.textContent.trim()) {
        typed.style.setProperty("--chars", String(typed.textContent.length));
        each.appendChild(typed);
      } else {
        // The closing prompt with its cursor has nothing to type.
        while (typed.firstChild) each.appendChild(typed.firstChild);
      }
    });
    consoleEl.classList.add("is-typing");
  };

  var typeConsole = function (consoleEl, delay) {
    var lines = consoleEl.querySelectorAll(".c-line");
    if (!lines.length) return;
    var i = 0;
    var next = function () {
      if (i >= lines.length) {
        consoleEl.classList.remove("is-typing");
        return;
      }
      var line = lines[i++];
      line.classList.add("is-shown");
      var typed = line.querySelector(".c-typed");
      window.setTimeout(next, typed ? typed.textContent.length * 32 + 420 : 260);
    };
    window.setTimeout(next, delay + 450);
  };

  if (motionOK) document.querySelectorAll(".console").forEach(prepareConsole);

  /* ---------- Reveal on scroll ---------- */
  var revealTargets = document.querySelectorAll(
    ".section-head, .stat, .focus-card, .console, .point, .point-actions, .module, .service, " +
      ".step, .table-scroll, .spec-note, .about-copy, .about-visual, .sector, .related-card, " +
      ".cta-inner, .contact-copy, .contact-form, .plan, .plan-plus, .track, .cat-head, .mod-card, " +
      ".faq details, .marquee"
  );
  // Effects that start with an item's reveal, such as headings that rise word
  // by word, register here and hear about each item as it arrives.
  var revealHooks = [];

  if (motionOK) {
    revealTargets.forEach(function (el) { el.classList.add("reveal"); });

    // Once an item has settled it drops .reveal, so the item's own hover
    // transitions take over again. .is-visible stays as a marker that CSS
    // can key later effects from (the constellation, for one).
    var settle = function (el, delay) {
      var onEnd;
      var done = function () {
        el.classList.remove("reveal");
        el.style.removeProperty("--reveal-delay");
        el.removeEventListener("transitionend", onEnd);
      };
      onEnd = function (event) {
        if (event.target === el && event.propertyName === "transform") done();
      };
      el.addEventListener("transitionend", onEnd);
      window.setTimeout(done, delay + 1400);
    };

    var revealObserver = new IntersectionObserver(
      function (entries) {
        var batch = 0;
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          revealObserver.unobserve(el);
          // Items that come into view together, such as a row of cards,
          // arrive one after another.
          var delay = Math.min(batch++, 6) * 90;
          if (delay) el.style.setProperty("--reveal-delay", delay + "ms");
          el.classList.add("is-visible");
          settle(el, delay);
          if (el.classList.contains("stat")) countUp(el, delay);
          if (el.classList.contains("console")) typeConsole(el, delay);
          for (var h = 0; h < revealHooks.length; h++) revealHooks[h](el, delay);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 }
    );
    revealTargets.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------- Hero parallax ---------- */
  // --hero-p runs from 0 at the top of the page to 1 once the hero has
  // scrolled away; the CSS turns it into depth. Inner pages' heroes get it
  // too, so their copy and glyph part as the page moves on.
  var hero = document.querySelector(".hero, .page-hero");
  if (hero && motionOK) {
    var heroHeight = hero.offsetHeight;
    var lastHeroP = -1;
    var measureHero = function () { heroHeight = hero.offsetHeight; };
    window.addEventListener("resize", measureHero);
    window.addEventListener("load", measureHero);
    scrollHooks.push(function (y) {
      var p = Math.round(clamp(y / (heroHeight || 1), 0, 1) * 1000) / 1000;
      if (p === lastHeroP) return;
      lastHeroP = p;
      hero.style.setProperty("--hero-p", String(p));
    });
  }

  /* ---------- Starfields ---------- */
  // Every hero has a sky. Stars sit at different depths: nearer ones are
  // larger and brighter, lean further with the pointer, and lag less behind
  // the scroll, so the sky has parallax. Scrolling fast stretches the stars
  // into streaks, nearer ones furthest, like a jump to light speed, and they
  // relax back to points once the page settles. A sky stops drawing while it
  // is off screen or the tab is hidden.
  var skyPointer = { x: 0, y: 0 };
  if (finePointer && !reduceMotion) {
    window.addEventListener(
      "pointermove",
      function (event) {
        skyPointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        skyPointer.y = (event.clientY / window.innerHeight) * 2 - 1;
      },
      { passive: true }
    );
  }

  var startStarfield = function (canvas) {
    var ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return;
    var host = canvas.parentElement;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var width = 0, height = 0, hostTop = 0;
    var stars = [];
    var streak = null;
    var nextStreakAt = 2500;
    var rafId = null;
    var onScreen = true;
    var sway = { x: 0, y: 0 };
    // Warp: the scroll's speed in pixels per frame, eased so streaks grow
    // quickly and fade slowly.
    var warp = 0;
    var lastY = null;
    var lastTime = 0;

    var makeStar = function (z, bright) {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        z: z,
        r: bright ? 1.2 + Math.random() * 0.6 : 0.3 + z * 1.15,
        a: bright ? 0.95 : Math.min(0.15 + Math.random() * 0.55 + z * 0.3, 1),
        phase: Math.random() * Math.PI * 2,
        speed: 0.0006 + Math.random() * 0.0016,
        drift: 0.004 + z * 0.016,
        bright: bright
      };
    };

    var makeStars = function () {
      var count = Math.round((width * height) / 5200);
      stars = [];
      // Most stars are far away (z near 0); a few are close (z near 1).
      for (var i = 0; i < count; i++) stars.push(makeStar(Math.pow(Math.random(), 2), false));
      var bright = Math.max(2, Math.round(count / 70));
      for (var b = 0; b < bright; b++) stars.push(makeStar(0.75 + Math.random() * 0.25, true));
    };

    var spike = function (x0, y0, x1, y1, alpha) {
      var grad = ctx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.5, "rgba(255,255,255," + alpha.toFixed(3) + ")");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    };

    var spawnStreak = function (time) {
      streak = {
        x: width * (0.35 + Math.random() * 0.6),
        y: height * (0.05 + Math.random() * 0.35),
        vx: -(3.5 + Math.random() * 2.5),
        vy: 1.4 + Math.random() * 1.2,
        life: 0,
        maxLife: 55 + Math.random() * 25
      };
      nextStreakAt = time + 7000 + Math.random() * 9000;
    };

    var draw = function (time) {
      ctx.clearRect(0, 0, width, height);
      // How far the page has scrolled past the top of this sky.
      var pageY = window.scrollY;
      var scrolled = reduceMotion ? 0 : Math.max(0, pageY - hostTop);
      sway.x += (skyPointer.x - sway.x) * 0.04;
      sway.y += (skyPointer.y - sway.y) * 0.04;

      if (!reduceMotion) {
        // Speed per 60th of a second, whatever the display's refresh rate.
        var frames = lastTime ? clamp((time - lastTime) / 16.7, 0.5, 4) : 1;
        var speed = lastY === null ? 0 : clamp((pageY - lastY) / frames, -140, 140);
        warp += (speed - warp) * (Math.abs(speed) > Math.abs(warp) ? 0.3 : 0.07);
        if (Math.abs(warp) < 0.05) warp = 0;
        lastY = pageY;
        lastTime = time;
      }
      // A soft knee keeps reading-pace scrolls to a faint smear while a fling
      // stretches the sky fully. The trails fan out a little from the middle.
      var stretch = warp * Math.abs(warp) / (Math.abs(warp) + 24);
      var midX = width / 2;
      var boost = Math.min(Math.abs(warp) / 50, 1);
      ctx.lineCap = "round";

      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var alpha = reduceMotion
          ? s.a
          : s.a * (0.65 + 0.35 * Math.sin(s.phase + time * s.speed));

        if (!reduceMotion) {
          s.y -= s.drift;
          if (s.y < -2) { s.y = height + 2; s.x = Math.random() * width; }
        }

        // Far stars lag further behind the scroll and barely follow the pointer.
        var x = s.x - sway.x * 18 * s.z;
        var y = s.y + scrolled * (0.5 - s.z * 0.3) - sway.y * 10 * s.z;
        y = ((y % height) + height) % height;

        // A star moves up the screen as the page scrolls down, so its trail
        // hangs below it; nearer stars move faster and trail further.
        var trail = stretch ? clamp(stretch * (0.25 + s.z * 1.9), -170, 170) : 0;
        if (trail > 3 || trail < -3) {
          var lit = Math.min(alpha * (1 + boost * 0.6), 1);
          var trailX = x + ((x - midX) / width) * Math.abs(trail) * 0.18;
          var trailY = y + trail;
          var tail = ctx.createLinearGradient(x, y, trailX, trailY);
          tail.addColorStop(0, "rgba(240, 240, 245," + lit.toFixed(3) + ")");
          tail.addColorStop(1, "rgba(240, 240, 245,0)");
          ctx.strokeStyle = tail;
          ctx.lineWidth = Math.max(s.r * 1.7, 0.8);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(trailX, trailY);
          ctx.stroke();
        }

        if (s.bright) {
          var reach = s.r * 8;
          var glow = ctx.createRadialGradient(x, y, 0, x, y, reach);
          glow.addColorStop(0, "rgba(255,255,255," + (0.32 * alpha).toFixed(3) + ")");
          glow.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = glow;
          ctx.fillRect(x - reach, y - reach, reach * 2, reach * 2);
          ctx.lineWidth = 0.7;
          spike(x - reach * 1.4, y, x + reach * 1.4, y, 0.55 * alpha);
          spike(x, y - reach * 1.4, x, y + reach * 1.4, 0.55 * alpha);
        }

        ctx.beginPath();
        ctx.fillStyle = "rgba(235, 235, 240," + alpha.toFixed(3) + ")";
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (reduceMotion) return;
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
    };

    var loop = function (time) {
      draw(time);
      rafId = onScreen && !document.hidden ? window.requestAnimationFrame(loop) : null;
    };
    var wake = function () {
      if (reduceMotion || rafId || !onScreen || document.hidden) return;
      // Coming back on screen is not a jump in speed.
      lastY = null;
      lastTime = 0;
      rafId = window.requestAnimationFrame(loop);
    };

    var resize = function () {
      hostTop = host.getBoundingClientRect().top + window.scrollY;
      // Mobile browsers fire resize as their toolbars slide; keep the same
      // sky unless the canvas really changed size.
      if (canvas.clientWidth === width && canvas.clientHeight === height) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      makeStars();
      if (reduceMotion) draw(0);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("load", resize);
    if (reduceMotion) return;

    document.addEventListener("visibilitychange", wake);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[entries.length - 1].isIntersecting;
        wake();
      }).observe(canvas);
    }
    wake();
  };

  document.querySelectorAll("canvas.starfield").forEach(startStarfield);

  /* ---------- Pointer effects ---------- */
  // Cards and hairline grids carry a light that follows the pointer (--mx and
  // --my), and the home page's product window tilts toward it. The larger
  // cards also lean toward the pointer in depth (--rx, --ry), and their
  // contents shift with it (--px, --py, from -1 to 1).
  var SPOTLIT = ".focus-card, .related-card, .mod-card, .plan, .track, .sector, .steps, .module-grid";
  var LEANING = ".focus-card, .related-card, .plan, .track";
  var heroWindow = document.querySelector(".hero .app-window");
  // Other pointer effects join the same frame: each hook reads what it needs
  // from the pointer event and returns a function that does its writing.
  var pointerHooks = [];

  if (finePointer) {
    var pointerEvent = null;
    var pointerQueued = false;
    var tilting = false;

    var resetTilt = function () {
      if (!tilting) return;
      tilting = false;
      heroWindow.classList.remove("is-tilting");
      heroWindow.style.removeProperty("--tilt-x");
      heroWindow.style.removeProperty("--tilt-y");
    };

    var applyPointer = function () {
      pointerQueued = false;
      var event = pointerEvent;
      var target = event && event.target;
      if (!target || !target.closest) return;

      // Read every box first, then write, so the frame lays out only once.
      var lit = target.closest(SPOTLIT);
      var litBox = lit && lit.getBoundingClientRect();
      var tilt = heroWindow && !reduceMotion && target.closest(".hero");
      var winBox = tilt && heroWindow.getBoundingClientRect();
      var writes = [];
      for (var h = 0; h < pointerHooks.length; h++) {
        var write = pointerHooks[h](event);
        if (write) writes.push(write);
      }

      if (lit) {
        lit.style.setProperty("--mx", (event.clientX - litBox.left).toFixed(1) + "px");
        lit.style.setProperty("--my", (event.clientY - litBox.top).toFixed(1) + "px");
        if (motionOK && lit.matches(LEANING)) {
          // Three degrees at most; tall cards lean less, so their far edge
          // moves about as far as a small card's.
          var px = clamp(((event.clientX - litBox.left) / litBox.width) * 2 - 1, -1, 1);
          var py = clamp(((event.clientY - litBox.top) / litBox.height) * 2 - 1, -1, 1);
          var lean = litBox.height > 440 ? 1.6 : 3;
          lit.style.setProperty("--rx", (-py * lean).toFixed(2) + "deg");
          lit.style.setProperty("--ry", (px * lean).toFixed(2) + "deg");
          lit.style.setProperty("--px", px.toFixed(3));
          lit.style.setProperty("--py", py.toFixed(3));
        }
      }
      for (var w = 0; w < writes.length; w++) writes[w]();
      if (tilt) {
        var nx = clamp((event.clientX - (winBox.left + winBox.width / 2)) / (winBox.width / 2), -1.5, 1.5);
        var ny = clamp((event.clientY - (winBox.top + winBox.height / 2)) / (winBox.height / 2), -1.5, 1.5);
        heroWindow.style.setProperty("--tilt-x", (-ny * 4).toFixed(2) + "deg");
        heroWindow.style.setProperty("--tilt-y", (nx * 6).toFixed(2) + "deg");
        heroWindow.style.setProperty("--glare-x", (event.clientX - winBox.left).toFixed(0) + "px");
        heroWindow.style.setProperty("--glare-y", (event.clientY - winBox.top).toFixed(0) + "px");
        if (!tilting) {
          tilting = true;
          heroWindow.classList.add("is-tilting");
        }
      } else if (heroWindow) {
        resetTilt();
      }
    };

    document.addEventListener(
      "pointermove",
      function (event) {
        pointerEvent = event;
        if (pointerQueued) return;
        pointerQueued = true;
        window.requestAnimationFrame(applyPointer);
      },
      { passive: true }
    );
    if (heroWindow) document.documentElement.addEventListener("mouseleave", resetTilt);
  }

  /* ---------- Hero: the product window searches by itself ---------- */
  // The launcher's search box cycles through real search aliases (each card's
  // data-aliases on modules.html) and highlights the module each one finds.
  var typedEl = heroWindow && heroWindow.querySelector(".app-search .typed");
  if (typedEl && motionOK) {
    var demoSearches = [
      ["autoruns", "Registry & Persistence"],
      ["phishing", "Email Analysis"],
      ["evtx", "Event Log & Logon"],
      ["campaigns", "IOC Vault"],
      ["quarantine", "Secure Host"],
      ["cve", "Intelligence Feed"],
      ["remediation", "Malware Scan"]
    ];
    var appTiles = heroWindow.querySelectorAll(".app-tile");
    var demoIndex = 0;
    var heroInView = true;
    new IntersectionObserver(function (entries) {
      heroInView = entries[entries.length - 1].isIntersecting;
    }).observe(heroWindow);

    var later = function (fn, ms) { window.setTimeout(fn, ms); };
    var tileNamed = function (name) {
      for (var t = 0; t < appTiles.length; t++) {
        if (appTiles[t].textContent.trim() === name) return appTiles[t];
      }
      return null;
    };
    var focusTile = function (tile) {
      appTiles.forEach(function (each) { each.classList.toggle("is-focus", each === tile); });
    };
    var typeOut = function (word, done) {
      var n = 0;
      var step = function () {
        typedEl.textContent = word.slice(0, ++n);
        if (n < word.length) later(step, 60 + Math.random() * 70);
        else done();
      };
      later(step, 220);
    };
    var erase = function (done) {
      var text = typedEl.textContent;
      if (!text) { done(); return; }
      typedEl.textContent = text.slice(0, -1);
      later(function () { erase(done); }, 30);
    };

    var nextSearch = function () {
      if (!heroInView || document.hidden) { later(nextSearch, 1000); return; }
      // Skip searches whose module tile is hidden at this screen size.
      var pick = null, tile = null;
      for (var tries = 0; tries < demoSearches.length; tries++) {
        demoIndex = (demoIndex + 1) % demoSearches.length;
        tile = tileNamed(demoSearches[demoIndex][1]);
        if (tile && tile.offsetParent) { pick = demoSearches[demoIndex]; break; }
      }
      if (!pick) return;
      erase(function () {
        focusTile(null);
        typeOut(pick[0], function () {
          focusTile(tile);
          later(nextSearch, 2600);
        });
      });
    };
    later(nextSearch, 3600);
  }

  /* ---------- Module marquee (home) ---------- */
  // Every module's name, from catalog.js, on a band that drifts sideways.
  // Scrolling pushes it along, and scrolling back up pushes it backward;
  // the faster the scroll, the further the names lean.
  var marquee = document.querySelector("[data-marquee]");
  var catalogData = window.NADIRION_CATALOG;
  if (marquee && catalogData) {
    var names = Object.keys(catalogData.modules).map(function (id) {
      return catalogData.modules[id].name;
    });
    // Names alternate between outlined and solid, so each copy of the list
    // needs an even count for the loop to join without two alike in a row.
    if (names.length % 2) names = names.concat(names);

    var group = document.createElement("div");
    group.className = "marquee-group";
    names.forEach(function (name) {
      var item = document.createElement("span");
      item.className = "marquee-item";
      item.textContent = name;
      group.appendChild(item);
    });
    var track = document.createElement("div");
    track.className = "marquee-track";
    track.appendChild(group);
    track.appendChild(group.cloneNode(true));
    marquee.appendChild(track);

    // A steady 60 pixels a second, whatever the list's length or font size.
    var pace = function () {
      if (group.offsetWidth) track.style.animationDuration = group.offsetWidth / 60 + "s";
    };
    pace();
    window.addEventListener("resize", pace);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(pace);

    if (motionOK && track.getAnimations) {
      var rate = 1;
      var rateTarget = 1;
      var rateQueued = false;
      var easeRate = function () {
        rateQueued = false;
        var anim = track.getAnimations()[0];
        if (!anim) return;
        rate += (rateTarget - rate) * 0.12;
        rateTarget += (1 - rateTarget) * 0.06;
        if (Math.abs(rate - 1) < 0.01 && Math.abs(rateTarget - 1) < 0.01) {
          rate = 1;
          rateTarget = 1;
        }
        anim.playbackRate = rate;
        // The names lean into their travel while the scroll hurries them.
        marquee.style.setProperty("--lean", clamp((rate - 1) * 1.5, -9, 9).toFixed(2) + "deg");
        if (rate !== 1) {
          rateQueued = true;
          window.requestAnimationFrame(easeRate);
        }
      };
      scrollHooks.push(function (y, dy) {
        if (!dy) return;
        rateTarget = clamp((dy > 0 ? 1 : -1) * (1 + Math.abs(dy) / 5), -8, 8);
        if (rateQueued) return;
        rateQueued = true;
        window.requestAnimationFrame(easeRate);
      });
    }
  }

  /* ---------- Element scroll progress ---------- */
  // watchScroll(el, fn) calls fn(p, el) whenever the page scrolls and p has
  // changed. p runs from 0, when the element's top edge reaches the bottom of
  // the viewport, to 1, when its bottom edge leaves the top. Positions are
  // measured on load and whenever the page changes height, never during a
  // scroll, so the hooks themselves only write.
  var watched = [];
  var viewportH = window.innerHeight;

  var docTop = function (el) {
    var top = 0;
    while (el) {
      top += el.offsetTop;
      el = el.offsetParent;
    }
    return top;
  };
  var measureWatched = function () {
    viewportH = window.innerHeight;
    for (var i = 0; i < watched.length; i++) {
      watched[i].top = docTop(watched[i].el);
      watched[i].height = watched[i].el.offsetHeight;
      watched[i].last = -1;
    }
    queueScroll();
  };
  var watchScroll = function (el, fn) {
    var item = { el: el, fn: fn, top: docTop(el), height: el.offsetHeight, last: -1 };
    watched.push(item);
    return item;
  };
  scrollHooks.push(function (y) {
    for (var i = 0; i < watched.length; i++) {
      var w = watched[i];
      var p = clamp((y + viewportH - w.top) / (viewportH + w.height || 1), 0, 1);
      p = Math.round(p * 1000) / 1000;
      if (p === w.last) continue;
      w.last = p;
      w.fn(p, w.el);
    }
  });
  window.addEventListener("resize", measureWatched);
  window.addEventListener("load", measureWatched);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureWatched);
  // Filtering the catalog or opening an FAQ answer moves everything below it.
  if ("ResizeObserver" in window) new ResizeObserver(measureWatched).observe(document.body);

  /* ---------- Inner pages [fx-inner] ---------- */
  // Movement for the parts that live only on the inner pages: the license
  // assembling itself on Pricing, the lab on In Development, the install
  // table and icons on the Desktop page, the catalog's category icons, a
  // beacon on Contact and a seal on the reseller check. Everything built
  // here is decoration, hidden from screen readers. The block keeps its own
  // scope so its names never collide with the blocks around it.
  (function () {
    var SVG_NS = "http://www.w3.org/2000/svg";
    var makeSvg = function (name, attrs) {
      var node = document.createElementNS(SVG_NS, name);
      Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
      return node;
    };
    var makeDecor = function (className) {
      var node = document.createElement("span");
      node.className = className;
      node.setAttribute("aria-hidden", "true");
      return node;
    };
    var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
    var stretch = function (v, from, to) { return clamp((v - from) / (to - from), 0, 1); };
    var stacked = function () { return mediaMatches("(max-width: 1000px)"); };

    // Items that come into view together take turns a beat apart, whether a
    // whole row arrives at once on a wide screen or one at a time on a phone.
    var inTurn = function (els, beat, threshold, fn) {
      if (!motionOK || !els.length) return;
      var nextAt = 0;
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            observer.unobserve(entry.target);
            var now = Date.now();
            var at = Math.max(now, nextAt);
            nextAt = at + beat;
            window.setTimeout(function () { fn(entry.target); }, at - now);
          });
        },
        { rootMargin: "0px 0px -10% 0px", threshold: threshold }
      );
      Array.prototype.forEach.call(els, function (el) { observer.observe(el); });
    };

    // Ambient loops rest while their element is off screen.
    var restOffscreen = function (el) {
      if (!motionOK) return;
      new IntersectionObserver(function (entries) {
        el.classList.toggle("is-resting", !entries[entries.length - 1].isIntersecting);
      }).observe(el);
    };

    /* Icons trace their strokes in, each shape dashed to its own length. */
    var prepareTrace = function (icon) {
      var svg = icon && icon.querySelector("svg");
      if (!svg || !motionOK) return false;
      var k = 0;
      svg.querySelectorAll("path, circle, rect, ellipse, line, polyline, polygon").forEach(function (shape) {
        // A filled dot has no stroke to trace, and a dashed one would lose
        // its dashes; those fade in instead.
        if (shape.getAttribute("stroke") === "none" || shape.hasAttribute("stroke-dasharray")) {
          shape.classList.add("fx-fade");
          return;
        }
        var length = 0;
        try { length = shape.getTotalLength(); } catch (e) { length = 0; }
        if (!(length > 0)) return;
        shape.style.setProperty("--trace-len", (Math.ceil(length * 10) / 10) + "px");
        shape.style.setProperty("--trace-k", String(k++));
        shape.classList.add("fx-trace");
      });
      icon.classList.add("fx-draw");
      return true;
    };
    var traceIcons = function (holders, iconSelector, beat, threshold) {
      var ready = Array.prototype.filter.call(holders, function (holder) {
        return prepareTrace(holder.querySelector(iconSelector));
      });
      inTurn(ready, beat, threshold, function (holder) {
        holder.querySelector(iconSelector).classList.add("is-drawn");
      });
    };
    // Desktop: what every license includes, card by card.
    traceIcons(document.querySelectorAll(".module-grid .module"), ".module-icon", 140, 0.45);
    // Catalog: each category's icon as its heading arrives.
    traceIcons(document.querySelectorAll(".cat-head"), ".focus-icon", 0, 0.6);

    /* Pricing: the license assembles. The two plans glide together from
       either side, the "+" turns into place, and a beam of light joins the
       cards through it, settled by the time the pair is mid-screen. Stacked
       on a phone, the add-on card docks under the base and the beam runs
       down. The cards move only by the translate property, so a reveal or a
       pointer tilt on their transform still applies. */
    var anatomy = document.querySelector(".license-anatomy");
    var plus = anatomy && anatomy.querySelector(".plan-plus");
    if (plus && anatomy.querySelectorAll(".plan").length === 2) {
      // The "+" is redrawn as two strokes so it turns about its true centre.
      // It sits in a small ring, a junction on the beam that joins the cards.
      var plusMark = makeSvg("svg", { "class": "plan-plus-mark", viewBox: "0 0 22 22", focusable: "false" });
      plusMark.appendChild(makeSvg("circle", { "class": "plus-node", cx: "11", cy: "11", r: "18.5" }));
      plusMark.appendChild(makeSvg("path", { d: "M11 4v14M4 11h14" }));
      plus.textContent = "";
      plus.appendChild(plusMark);
      var sparkTrack = makeDecor("plan-spark-track");
      sparkTrack.appendChild(makeDecor("plan-spark"));
      plus.appendChild(makeDecor("plan-beam"));
      plus.appendChild(sparkTrack);
      plus.appendChild(makeDecor("plan-contact is-start"));
      plus.appendChild(makeDecor("plan-contact is-end"));
      anatomy.classList.add("fx-assembly");

      if (motionOK) {
        restOffscreen(anatomy);
        var wideAnatomy = !stacked();
        window.addEventListener("resize", function () { wideAnatomy = !stacked(); });
        // The cards may start wider than the page; keep that off the scrollbar.
        var anatomySection = anatomy.closest("section");
        if (anatomySection) anatomySection.classList.add("fx-clip-x");

        var assemble = function (a) {
          var glide = stretch(a, 0, 0.8);
          anatomy.style.setProperty("--fx-glide", (1 - (1 - glide) * (1 - glide)).toFixed(3));
          anatomy.style.setProperty("--fx-turn", easeOut(stretch(a, 0.3, 0.85)).toFixed(3));
          anatomy.style.setProperty("--fx-beam", stretch(a, 0.78, 1).toFixed(3));
          anatomy.classList.toggle("is-assembled", a >= 1);
        };
        // Side by side: under way once the cards show, done when the pair's
        // centre is just above mid-screen.
        var anatomyWatch = watchScroll(anatomy, function (p) {
          if (!wideAnatomy) return;
          var risen = p * (viewportH + anatomyWatch.height) - viewportH * 0.1;
          assemble(clamp(risen / (viewportH * 0.35 + anatomyWatch.height * 0.5), 0, 1));
        });
        // Stacked: done when the "+" has climbed a little past mid-screen.
        var plusWatch = watchScroll(plus, function (p) {
          if (wideAnatomy) return;
          var risen = p * (viewportH + plusWatch.height);
          assemble(clamp(risen / (viewportH * 0.45), 0, 1));
        });
      }
    }

    /* In Development: preview cards read as work in progress. A dashed
       frame marches slowly round each one, a faint blueprint grid sits
       inside, and now and then a scanner passes down the card, lighting the
       grid as it goes. Each card takes its turn. */
    document.querySelectorAll(".mod-card.is-preview").forEach(function (card, i) {
      var lab = makeDecor("wip-lab");
      var frame = makeSvg("svg", { "class": "wip-frame", focusable: "false" });
      frame.appendChild(makeSvg("rect", { x: "0.5", y: "0.5", width: "100%", height: "100%", rx: "13.5" }));
      var scan = document.createElement("span");
      scan.className = "wip-scan";
      var scanGrid = document.createElement("span");
      scanGrid.className = "wip-scan-grid";
      scan.appendChild(scanGrid);
      var grid = document.createElement("span");
      grid.className = "wip-grid";
      lab.appendChild(grid);
      lab.appendChild(scan);
      lab.appendChild(frame);
      lab.style.setProperty("--wip-i", String(i));
      card.insertBefore(lab, card.firstChild);
      card.classList.add("has-lab");
      restOffscreen(card);
    });

    /* Stage lists. "From research to release" numbers its stages, so a line
       of progress runs through them in order as the reader scrolls, lighting
       each stage's label and rule as it arrives. A list of requirements
       (resellers: what "certified" means) ticks each one off in turn. */
    document.querySelectorAll(".service-list-grid").forEach(function (list) {
      var stages = Array.prototype.slice.call(list.querySelectorAll(".service"));
      if (!stages.length) return;
      var numbered = stages.every(function (stage) {
        var label = stage.querySelector(".service-index");
        return !!label && /^\d+\s*\u00b7/.test(label.textContent.trim());
      });
      stages.forEach(function (stage) { stage.appendChild(makeDecor("stage-fill")); });

      if (numbered) {
        list.classList.add("fx-timeline");
        stages.forEach(function (stage) { stage.appendChild(makeDecor("stage-head")); });
        if (!motionOK) return;
        var shown = [];
        var listWatch = watchScroll(list, function (p) {
          // 0 as the list's top comes 15% up the screen, 1 once its foot is
          // 28% up, so the last stage lights while it is still well in view.
          var risen = p * (viewportH + listWatch.height);
          var run = clamp((risen - viewportH * 0.15) / (viewportH * 0.13 + listWatch.height), 0, 1);
          stages.forEach(function (stage, n) {
            var fill = Math.round(clamp(run * stages.length - n, 0, 1) * 1000) / 1000;
            if (fill === shown[n]) return;
            shown[n] = fill;
            stage.style.setProperty("--stage-fill", String(fill));
            stage.classList.toggle("is-reached", fill > 0);
            // The head of the line rides the stage in progress, and rests at
            // the end of the last one.
            stage.classList.toggle("is-current", fill > 0 && (fill < 1 || n === stages.length - 1));
          });
        });
        return;
      }

      list.classList.add("fx-checklist");
      stages.forEach(function (stage) {
        var label = stage.querySelector(".service-index");
        if (!label) return;
        var check = makeSvg("svg", { "class": "service-check", viewBox: "0 0 14 14", "aria-hidden": "true", focusable: "false" });
        check.appendChild(makeSvg("rect", { x: "0.75", y: "0.75", width: "12.5", height: "12.5", rx: "3" }));
        check.appendChild(makeSvg("path", { d: "M3.8 7.2l2.2 2.2 4.4-4.8", pathLength: "1" }));
        label.insertBefore(check, label.firstChild);
      });
      inTurn(stages, 320, 0.45, function (stage) { stage.classList.add("is-ticked"); });
    });

    /* Desktop: the install table is scanned in. A soft line of light passes
       down it, each row settling as the line reaches it and each platform's
       name lighting up as it passes. The notes beneath then light in turn. */
    document.querySelectorAll(".table-scroll").forEach(function (box) {
      var rows = box.querySelectorAll("tbody tr");
      if (!motionOK || !rows.length) return;
      box.appendChild(makeDecor("spec-scan"));
      box.classList.add("fx-scan");
      var scanObserver = new IntersectionObserver(
        function (entries) {
          if (!entries[entries.length - 1].isIntersecting) return;
          scanObserver.disconnect();
          // Measured once, as the scan starts: where each row sits.
          var height = box.clientHeight || 1;
          rows.forEach(function (row) {
            row.style.setProperty("--row-top", (row.offsetTop / height).toFixed(3));
            row.style.setProperty("--row-mid", ((row.offsetTop + row.offsetHeight / 2) / height).toFixed(3));
          });
          box.classList.add("is-scanning");
        },
        { rootMargin: "0px 0px -15% 0px", threshold: 0.45 }
      );
      scanObserver.observe(box);
    });
    var specNotes = document.querySelectorAll(".spec-note");
    if (motionOK && specNotes.length) {
      specNotes[0].parentElement.classList.add("fx-notes");
      inTurn(specNotes, 170, 0.6, function (note) { note.classList.add("is-lit"); });
    }

    /* Contact: the short hero has no artwork, so a beacon transmits from its
       right side: a bright point sending rings outward, under a slow radar
       sweep, drifting back as the hero scrolls away. */
    var quietHero = document.querySelector(".page-hero-short");
    if (quietHero && !quietHero.querySelector(".page-hero-glyph")) {
      var beacon = makeDecor("fx-beacon");
      var scope = makeSvg("svg", { "class": "fx-beacon-scope", viewBox: "-180 -180 360 360", focusable: "false" });
      [62, 118, 174].forEach(function (radius, n) {
        scope.appendChild(makeSvg("circle", { r: String(radius), "class": "scope-ring scope-ring-" + n }));
      });
      // Bearing marks round the rim, longer at the four quarters.
      var marks = "";
      for (var deg = 0; deg < 360; deg += 10) {
        var rad = (deg * Math.PI) / 180;
        var inner = deg % 90 === 0 ? 158 : 167;
        marks += "M" + (Math.cos(rad) * inner).toFixed(1) + " " + (Math.sin(rad) * inner).toFixed(1) +
          "L" + (Math.cos(rad) * 174).toFixed(1) + " " + (Math.sin(rad) * 174).toFixed(1);
      }
      scope.appendChild(makeSvg("path", { d: marks, "class": "scope-marks" }));
      scope.appendChild(makeSvg("path", { d: "M-174 0H-24M24 0H174M0 -174V-24M0 24V174", "class": "scope-cross" }));
      beacon.appendChild(scope);
      beacon.appendChild(makeDecor("fx-beacon-sweep"));
      for (var ring = 0; ring < 3; ring++) {
        var pulse = makeDecor("fx-beacon-ring");
        pulse.style.setProperty("--ring", String(ring));
        beacon.appendChild(pulse);
      }
      beacon.appendChild(makeDecor("fx-beacon-core"));
      quietHero.insertBefore(beacon, quietHero.querySelector(".page-hero-inner"));

      if (motionOK) {
        restOffscreen(beacon);
        var heroWatch = watchScroll(quietHero, function (p) {
          // Turned back into the scroll offset, as a share of the hero's height.
          var scrolled = p * (viewportH + heroWatch.height) - viewportH + heroWatch.top;
          beacon.style.setProperty("--beacon-drift", clamp(scrolled / (heroWatch.height || 1), 0, 1).toFixed(3));
        });
      }
    }

    /* Resellers: "Verify before you pay." carries a seal that draws itself,
       rim first and then the check, when the band comes into view. It sits
       just after the heading, or in the band's corner where that is too
       narrow. */
    var verifyBand = document.getElementById("verify");
    var verifyCopy = verifyBand && verifyBand.classList.contains("cta-band") &&
      verifyBand.querySelector(".cta-inner > div");
    var verifyHeading = verifyCopy && verifyCopy.querySelector("h2");
    if (verifyHeading) {
      var seal = makeSvg("svg", { "class": "verify-seal", viewBox: "0 0 120 120", "aria-hidden": "true", focusable: "false" });
      var sealMarks = "";
      for (var tick = 0; tick < 60; tick++) {
        var angle = (tick * 6 * Math.PI) / 180;
        var reach = tick % 5 === 0 ? 44 : 46.5;
        sealMarks += "M" + (60 + Math.cos(angle) * reach).toFixed(2) + " " + (60 + Math.sin(angle) * reach).toFixed(2) +
          "L" + (60 + Math.cos(angle) * 49).toFixed(2) + " " + (60 + Math.sin(angle) * 49).toFixed(2);
      }
      var sealTicks = makeSvg("g", { "class": "seal-ticks" });
      sealTicks.appendChild(makeSvg("path", { d: sealMarks }));
      seal.appendChild(makeSvg("circle", { "class": "seal-rim", cx: "60", cy: "60", r: "56", pathLength: "1", transform: "rotate(-90 60 60)" }));
      seal.appendChild(sealTicks);
      seal.appendChild(makeSvg("circle", { "class": "seal-inner", cx: "60", cy: "60", r: "37" }));
      seal.appendChild(makeSvg("path", { "class": "seal-check", d: "M45 61.5l10.5 10.5L77 49.5", pathLength: "1" }));
      verifyCopy.classList.add("has-seal");
      verifyCopy.appendChild(seal);

      // Measured on load and resize, never while scrolling.
      var placeSeal = function () {
        var range = document.createRange();
        range.selectNodeContents(verifyHeading);
        var text = range.getBoundingClientRect();
        var box = verifyCopy.getBoundingClientRect();
        var room = box.right - text.right;
        var fits = text.width > 0 && room >= 76 + 56;
        seal.classList.toggle("is-cornered", !fits);
        seal.style.setProperty("--seal-x", Math.round(text.right - box.left + 28) + "px");
        seal.style.setProperty("--seal-y", Math.round(verifyHeading.offsetTop + verifyHeading.offsetHeight / 2) + "px");
      };
      placeSeal();
      window.addEventListener("resize", placeSeal);
      window.addEventListener("load", placeSeal);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeSeal);

      if (motionOK) {
        var sealObserver = new IntersectionObserver(
          function (entries) {
            if (!entries[entries.length - 1].isIntersecting) return;
            sealObserver.disconnect();
            seal.classList.add("is-sealed");
          },
          { rootMargin: "0px 0px -15% 0px", threshold: 0.5 }
        );
        sealObserver.observe(verifyCopy);
        restOffscreen(seal);
      }
    }

    /* Contact details and the links under them settle one after another
       once their column has risen into place. */
    if (motionOK) {
      document.querySelectorAll(".contact-copy").forEach(function (copy) {
        var items = copy.querySelectorAll(".contact-details > div, .route-links a");
        if (!items.length) return;
        items.forEach(function (item, n) { item.style.setProperty("--detail-i", String(n)); });
        copy.classList.add("fx-details");
      });
    }
  })();

  /* ==========================================================
     Round two. Each block below holds one area's effects.
     ========================================================== */

  /* ---------- Heroes [fx-heroes] ---------- */
  // Home headline: each line rises out of its own mask, sharpening as it
  // comes, and once it has landed a single glint runs along the metal line.
  // The rising words are a copy hidden from screen readers; the real heading
  // sits beside them the whole time and takes their place once they land.
  var heroTitle = document.querySelector(".hero h1");
  if (heroTitle && motionOK) {
    var titleReal = document.createElement("span");
    titleReal.className = "visually-hidden";
    var titleShown = document.createElement("span");
    titleShown.setAttribute("aria-hidden", "true");
    var titleWords = [];

    var addTitleWords = function (text, metal) {
      text.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (!part.trim()) {
          titleShown.appendChild(document.createTextNode(" "));
          return;
        }
        var mask = document.createElement("span");
        mask.className = "title-mask";
        var word = document.createElement("span");
        word.className = metal ? "title-word metal" : "title-word";
        word.textContent = part;
        mask.appendChild(word);
        titleShown.appendChild(mask);
        titleWords.push(word);
      });
    };

    Array.prototype.slice.call(heroTitle.childNodes).forEach(function (node) {
      if (node.nodeName === "BR") titleShown.appendChild(document.createElement("br"));
      else addTitleWords(node.textContent, !!(node.classList && node.classList.contains("metal")));
      titleReal.appendChild(node);
    });
    heroTitle.appendChild(titleReal);
    heroTitle.appendChild(titleShown);
    heroTitle.classList.add("title-split");

    // Words on one line rise together, a beat apart, then the next line.
    var titleLineTop = null;
    var titleLine = -1;
    var titleInLine = 0;
    var titleLast = 0;
    titleWords.forEach(function (word) {
      var top = word.parentNode.offsetTop;
      if (titleLineTop === null || Math.abs(top - titleLineTop) > 4) {
        titleLineTop = top;
        titleLine++;
        titleInLine = 0;
      }
      titleLast = 120 + titleLine * 150 + titleInLine++ * 60;
      word.style.setProperty("--d", titleLast + "ms");
    });

    window.setTimeout(function () {
      while (titleReal.firstChild) heroTitle.insertBefore(titleReal.firstChild, titleReal);
      heroTitle.removeChild(titleReal);
      heroTitle.removeChild(titleShown);
      var metalLine = heroTitle.querySelector(".metal");
      if (!metalLine) return;
      metalLine.classList.add("is-glinting");
      window.setTimeout(function () { metalLine.classList.remove("is-glinting"); }, 1800);
    }, titleLast + 1300);
  }

  // Inner pages: the hero glyph draws itself in, stroke by stroke, then
  // settles into its float. Dotted strokes and points of light fade in on
  // their turn instead, since tracing them would lose their dots.
  if (motionOK) {
    document.querySelectorAll(".page-hero-glyph svg").forEach(function (svg) {
      var parts = svg.querySelectorAll("circle, ellipse, line, path, polygon, polyline, rect");
      var last = 0;
      Array.prototype.forEach.call(parts, function (part, i) {
        last = 200 + i * 75;
        part.style.setProperty("--draw-delay", last + "ms");
        if (!part.getTotalLength || part.getAttribute("stroke-dasharray") || part.closest("[stroke='none']")) {
          part.classList.add("glyph-fade");
          return;
        }
        part.style.setProperty("--draw-len", (part.getTotalLength() + 1).toFixed(1));
        part.classList.add("glyph-trace");
      });
      svg.classList.add("is-drawing");
      window.setTimeout(function () { svg.classList.remove("is-drawing"); }, last + 1800);
    });
  }

  // Home: the license panel floats on its own layer in front of the product
  // window and drifts a little further with the pointer, so the hero has
  // depth.
  var heroHud = heroWindow && document.querySelector(".hero .hud");
  var heroStage = heroWindow && heroWindow.closest(".hero");
  if (heroHud && heroStage && finePointer && motionOK) {
    var hudAt = { x: 0, y: 0 };
    var hudQueued = false;
    var placeHud = function () {
      hudQueued = false;
      heroHud.style.setProperty("--hud-x", (hudAt.x * 14).toFixed(1) + "px");
      heroHud.style.setProperty("--hud-y", (hudAt.y * 9).toFixed(1) + "px");
    };
    var queueHud = function () {
      if (hudQueued) return;
      hudQueued = true;
      window.requestAnimationFrame(placeHud);
    };
    heroStage.addEventListener(
      "pointermove",
      function (event) {
        hudAt.x = (event.clientX / window.innerWidth) * 2 - 1;
        hudAt.y = (event.clientY / window.innerHeight) * 2 - 1;
        queueHud();
      },
      { passive: true }
    );
    heroStage.addEventListener("pointerleave", function () {
      hudAt.x = 0;
      hudAt.y = 0;
      queueHud();
    });
  }


  /* ---------- Type [fx-type] ---------- */
  // Section headings rise word by word, each out of its own mask, and the
  // mono labels above them decrypt: random glyphs settle into the real words
  // from left to right. The block a heading sits in no longer rises as one
  // piece; its label, heading, lede, and buttons arrive in that order.
  if (motionOK) {
    var TYPE_HEADINGS = ".section-head h2, .about h2, .cta-band h2, .cat-head h2, .contact-copy h2";
    var TYPE_LABELS = ".eyebrow, .block-label";
    var WORD_STAGGER = 55;
    var WORD_SPACES = /^[ \t\n\r\f]+$/;

    // Wraps each word of el's text in a mask and a riser, walking into
    // nested elements (the .metal phrases) and leaving <br>s alone. Only
    // ordinary spaces part words, so non-breaking spaces and hyphens hold.
    // The words stay plain spans, so the heading reads exactly as before.
    var splitHeading = function (el, words) {
      Array.prototype.slice.call(el.childNodes).forEach(function (node) {
        if (node.nodeType === 1) {
          splitHeading(node, words);
          return;
        }
        if (node.nodeType !== 3) return;
        var frag = document.createDocumentFragment();
        node.nodeValue.split(/([ \t\n\r\f]+)/).forEach(function (part) {
          if (!part) return;
          if (WORD_SPACES.test(part)) {
            frag.appendChild(document.createTextNode(part));
            return;
          }
          var mask = document.createElement("span");
          mask.className = "tw";
          var riser = document.createElement("span");
          riser.className = "tw-in";
          riser.textContent = part;
          mask.appendChild(riser);
          frag.appendChild(mask);
          words.push(riser);
        });
        el.replaceChild(frag, node);
      });
      return words;
    };

    // A moving word leaves its .metal phrase's own text, so it carries the
    // metal itself: its slice of the phrase's gradient (the phrase's lines
    // laid end to end, as an inline background is), in step with the
    // phrase's sheen. Nothing shifts when the heading is whole again.
    var matchHeadingMetal = function (heading) {
      heading.querySelectorAll(".metal").forEach(function (metal) {
        var lines = metal.getClientRects();
        var width = 0;
        for (var i = 0; i < lines.length; i++) width += lines[i].width;
        if (!width) return;
        var sheen = null;
        if (metal.getAnimations) {
          metal.getAnimations().forEach(function (anim) {
            if (anim.animationName === "metal-sheen") sheen = anim;
          });
        }
        var phase = sheen && sheen.currentTime ? -(sheen.currentTime % 11000) : 0;
        metal.querySelectorAll(".tw").forEach(function (mask) {
          var box = mask.getBoundingClientRect();
          var mid = box.top + box.height / 2;
          var line = 0;
          var before = 0;
          for (var j = 1; j < lines.length; j++) {
            if (Math.abs(lines[j].top + lines[j].height / 2 - mid) <
                Math.abs(lines[line].top + lines[line].height / 2 - mid)) line = j;
          }
          for (var k = 0; k < line; k++) before += lines[k].width;
          var word = mask.firstChild;
          word.style.setProperty("--metal-w", (width * 2.2).toFixed(1) + "px");
          word.style.setProperty("--metal-h", lines[line].height.toFixed(1) + "px");
          word.style.setProperty("--metal-run", (width * 1.2).toFixed(1) + "px");
          word.style.setProperty("--metal-x", (before + box.left - lines[line].left).toFixed(1) + "px");
          word.style.setProperty("--metal-y", (box.top - lines[line].top).toFixed(1) + "px");
          word.style.setProperty("--metal-delay", phase.toFixed(0) + "ms");
        });
      });
    };

    // Once the words have landed the heading goes back to plain text, so
    // nothing is left clipped or split.
    var joinHeading = function (heading) {
      heading.querySelectorAll(".tw").forEach(function (mask) {
        mask.parentNode.replaceChild(document.createTextNode(mask.textContent), mask);
      });
      heading.normalize();
      heading.classList.remove("is-split", "is-rising");
      if (!heading.className) heading.removeAttribute("class");
    };

    // The rest of a block, in reading order, walking down only through the
    // branch that holds the heading.
    var blockParts = function (host, heading) {
      var parts = [];
      Array.prototype.forEach.call(host.children, function (child) {
        if (child === heading) parts.push(child);
        else if (child.contains(heading)) parts = parts.concat(blockParts(child, heading));
        else parts.push(child);
      });
      return parts;
    };

    var labelsWithin = function (el) {
      if (el.matches(TYPE_LABELS)) return [el];
      return Array.prototype.slice.call(el.querySelectorAll(TYPE_LABELS));
    };

    /* Decrypting labels */
    var NOISE_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#_+";
    var noiseGlyph = function (ch) {
      if (!/[A-Za-z0-9]/.test(ch)) return ch;
      var pool = /[0-9]/.test(ch) ? "0123456789" : NOISE_GLYPHS;
      return pool.charAt(Math.floor(Math.random() * pool.length));
    };

    // Each run of text gets a hidden real copy for screen readers and a
    // scrambled copy on screen (resolved part, then the noise). The font is
    // monospaced, so the label keeps its width throughout. When the label
    // has resolved, the original text goes back in place.
    var scrambleLabel = function (label) {
      if (label.typeRuns) return label.typeRuns;
      var runs = [];
      var total = 0;
      var walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT, null, false);
      for (var node = walker.nextNode(); node; node = walker.nextNode()) {
        var text = node.nodeValue;
        if (/[A-Za-z0-9]/.test(text)) runs.push({ node: node, text: text, at: total });
        total += text.length;
      }
      runs.forEach(function (run) {
        var real = document.createElement("span");
        real.className = "visually-hidden";
        var shown = document.createElement("span");
        shown.className = "dc";
        shown.setAttribute("aria-hidden", "true");
        run.done = document.createTextNode("");
        run.noise = document.createElement("span");
        run.noise.className = "dc-noise";
        shown.appendChild(run.done);
        shown.appendChild(run.noise);
        run.node.parentNode.replaceChild(shown, run.node);
        shown.parentNode.insertBefore(real, shown);
        real.appendChild(run.node);
        run.real = real;
        run.shown = shown;
      });
      runs.total = total || 1;
      label.typeRuns = runs;
      return runs;
    };

    var renderLabel = function (runs, resolvedTo) {
      runs.forEach(function (run) {
        var k = clamp(Math.floor(resolvedTo - run.at), 0, run.text.length);
        var noise = "";
        for (var i = k; i < run.text.length; i++) noise += noiseGlyph(run.text.charAt(i));
        run.done.nodeValue = run.text.slice(0, k);
        run.noise.textContent = noise;
      });
    };

    var decryptLabel = function (label, delay) {
      if (label.typeStarted || !label.classList.contains("type-label")) return;
      label.typeStarted = true;
      var runs = scrambleLabel(label);
      if (!runs.length) return;
      // Longer labels take a little longer, within 0.6 to 0.9 seconds. The
      // first quarter is pure noise; then the text resolves left to right.
      var duration = clamp(300 + runs.total * 24, 600, 900);
      var start = null;
      var last = -Infinity;
      var tick = function (now) {
        if (start === null) start = now + delay;
        var t = now - start;
        if (t >= duration) {
          runs.forEach(function (run) {
            run.real.parentNode.replaceChild(run.node, run.real);
            run.shown.parentNode.removeChild(run.shown);
          });
          label.typeRuns = null;
          label.classList.remove("is-decrypting");
          label.classList.add("is-decrypted");
          return;
        }
        if (t >= 0) label.classList.add("is-decrypting");
        // New glyphs about twenty times a second: faster reads as flicker.
        if (now - last >= 48) {
          last = now;
          renderLabel(runs, ((t / duration - 0.25) / 0.75) * runs.total);
        }
        window.requestAnimationFrame(tick);
      };
      renderLabel(runs, 0);
      window.requestAnimationFrame(tick);
    };

    /* Headings and the blocks they lead */
    var typeBlocks = [];

    document.querySelectorAll(TYPE_HEADINGS).forEach(function (heading) {
      if (heading.classList.contains("visually-hidden") || !heading.textContent.trim()) return;
      // The block the reveal observer was going to raise as one piece.
      var host = heading.parentElement && heading.parentElement.closest(".reveal");
      if (!host) return;
      var block = { host: host, heading: heading, parts: blockParts(host, heading) };
      host.classList.remove("reveal");
      host.classList.add("type-host");
      block.parts.forEach(function (part) {
        if (part === heading || part.classList.contains("reveal")) return;
        part.classList.add("reveal", "type-part");
        if (part.tagName === "P" && !part.matches(TYPE_LABELS)) part.classList.add("type-wipe");
      });
      heading.classList.add("is-split");
      block.words = splitHeading(heading, []);
      typeBlocks.push(block);
    });

    // The label first, the heading's words a beat later, then the rest
    // while the last words are still rising.
    var playTypeBlock = function (block, delay) {
      var t = delay;
      block.parts.forEach(function (part) {
        if (part === block.heading) {
          block.words.forEach(function (word, i) {
            word.style.setProperty("--tw-d", t + Math.min(i, 12) * WORD_STAGGER + "ms");
          });
          matchHeadingMetal(block.heading);
          block.heading.classList.add("is-rising");
          var landed = t + Math.min(block.words.length - 1, 12) * WORD_STAGGER + 1300;
          window.setTimeout(function () { joinHeading(block.heading); }, landed);
          t += 140 + Math.min(block.words.length, 8) * WORD_STAGGER * 0.6;
          return;
        }
        if (part.classList.contains("type-part")) {
          part.style.setProperty("--reveal-delay", t + "ms");
          part.classList.add("is-visible");
          settle(part, t);
          if (part.classList.contains("type-wipe")) {
            part.style.setProperty("--wipe-d", t + "ms");
            // Done with once it has run, so filtering the catalog (which
            // hides and shows whole groups) never replays it.
            window.setTimeout(function () {
              part.classList.remove("type-wipe");
              part.style.removeProperty("--wipe-d");
            }, t + 1700);
          }
        }
        labelsWithin(part).forEach(function (label) { decryptLabel(label, t); });
        t += 110;
      });
    };

    document.querySelectorAll(TYPE_LABELS).forEach(function (label) {
      label.classList.add("type-label");
    });

    revealHooks.push(function (el, delay) {
      for (var b = 0; b < typeBlocks.length; b++) {
        if (typeBlocks[b].host === el) {
          playTypeBlock(typeBlocks[b], delay);
          return;
        }
      }
      labelsWithin(el).forEach(function (label) { decryptLabel(label, delay); });
    });

    // Labels outside anything the reveal observer watches (the page heroes'
    // labels) start scrambled and resolve as they come into view, a moment
    // after the hero's entrance has begun.
    var typeLabelObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          typeLabelObserver.unobserve(entry.target);
          decryptLabel(entry.target, entry.target.closest(".hero, .page-hero") ? 180 : 0);
        });
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    document.querySelectorAll(".type-label").forEach(function (label) {
      if (label.closest(".reveal, .type-host")) return;
      scrambleLabel(label);
      typeLabelObserver.observe(label);
    });
  }


  /* ---------- Scroll choreography [fx-scroll] ---------- */
  // Where an element's top edge sits on screen, worked out from watchScroll's
  // progress and its measured height, so the hooks never read layout.
  var topInView = function (p, item) {
    return viewportH - p * (viewportH + item.height);
  };
  var smoothstep = function (t) { return t * t * (3 - 2 * t); };

  // Light sections open like an aperture. Each arrives as a rounded panel
  // inset from the screen's edges and widens to full bleed as its top nears
  // the middle of the screen, then narrows again as it leaves at the top.
  // The panel's edges are two dark curtains with rounded inner corners that
  // slide out sideways, so the section itself is never clipped or repainted.
  if (motionOK) {
    document.querySelectorAll("section.light").forEach(function (section) {
      var curtains = document.createElement("span");
      curtains.className = "aperture";
      curtains.setAttribute("aria-hidden", "true");
      section.appendChild(curtains);
      section.classList.add("has-aperture");
      var item = watchScroll(section, function (p) {
        var top = topInView(p, item);
        var arriving = smoothstep(clamp((viewportH - top) / (viewportH * 0.6), 0, 1));
        var leaving = smoothstep(clamp((top + item.height) / (viewportH * 0.5), 0, 1));
        var shut = 1 - Math.min(arriving, leaving);
        curtains.style.setProperty("--aperture", shut.toFixed(3));
        curtains.classList.toggle("is-open", shut === 0);
      });
    });
  }

  // Steps: a line of light travels the grid as it moves up the screen, along
  // the top edge when the steps sit in a row and down the side when they
  // stack. Each numeral fills with metal as the light reaches it.
  var offsetInGrid = function (el, ancestor, side) {
    var total = 0;
    while (el && el !== ancestor) {
      total += el[side];
      el = el.offsetParent;
    }
    return total;
  };

  if (motionOK) {
    document.querySelectorAll(".steps").forEach(function (grid) {
      var steps = grid.querySelectorAll(".step");
      if (!steps.length) return;
      var across = true;
      var length = 1;
      var marks = [];

      // The line's length, and where each numeral sits along it (0 to 1).
      var measure = function () {
        across = true;
        for (var i = 1; i < steps.length; i++) {
          if (steps[i].offsetTop !== steps[0].offsetTop) across = false;
        }
        grid.classList.toggle("beam-down", !across);
        length = (across ? grid.clientWidth : grid.clientHeight) || 1;
        marks = [];
        // The numeral is a block as wide as its cell, so its glyphs start at
        // its left edge; half its line height in is about where they begin.
        Array.prototype.forEach.call(steps, function (step) {
          var num = step.querySelector(".step-num") || step;
          var reach = num.offsetHeight * 0.5;
          marks.push((offsetInGrid(num, grid, across ? "offsetLeft" : "offsetTop") + reach) / length);
        });
        queueScroll();
      };

      grid.classList.add("has-beam");
      measure();
      window.addEventListener("resize", measure);
      window.addEventListener("load", measure);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

      var item = watchScroll(grid, function (p) {
        var top = topInView(p, item);
        // In a row the line crosses as the grid rises from near the bottom
        // of the screen to above the middle; stacked, its head follows a
        // reading line a little below the middle.
        var beam = across
          ? clamp((viewportH * 0.86 - top) / (viewportH * 0.5), 0, 1)
          : clamp((viewportH * 0.68 - top) / (item.height || 1), 0, 1);
        grid.style.setProperty("--beam", beam.toFixed(4));
        grid.style.setProperty("--beam-at", (beam * length).toFixed(1) + "px");
        for (var i = 0; i < steps.length; i++) {
          steps[i].classList.toggle("is-lit", beam > 0 && beam >= marks[i]);
        }
      });
    });
  }

  // Watermark numerals: a section numbered in its eyebrow (01, 02...) carries
  // the number huge, outlined and faint in its corner, drifting slower than
  // the page. The CSS draws the digits from data-numeral, so they are never
  // text that screen readers, find-in-page or copying would meet.
  document.querySelectorAll(".section-head .eyebrow .index").forEach(function (index) {
    var digits = index.textContent.trim();
    var section = index.closest("section");
    if (!/^\d+$/.test(digits) || !section) return;

    var frame = document.createElement("span");
    frame.className = "watermark";
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("data-numeral", digits);
    section.appendChild(frame);
    section.classList.add("has-watermark");

    if (motionOK) {
      watchScroll(section, function (p) {
        frame.style.setProperty("--drift", p.toFixed(3));
      });
    }
  });

  // Horizons: where a dark section meets the one above it, a soft light
  // pools beneath the dividing line, and the line flares at its centre as it
  // crosses the middle of the screen.
  document.querySelectorAll(
    ".toolkit, .capabilities, .process, .specs, .related, .about, .contact, .cta-band"
  ).forEach(function (section) {
    if (!section.previousElementSibling) return;
    var glow = document.createElement("span");
    glow.className = "seam-glow";
    glow.setAttribute("aria-hidden", "true");
    section.appendChild(glow);
    section.classList.add("has-seam");
    if (!motionOK) return;
    var item = watchScroll(section, function (p) {
      var top = topInView(p, item);
      var near = 1 - clamp(Math.abs(top - viewportH * 0.6) / (viewportH * 0.5), 0, 1);
      glow.style.setProperty("--seam", smoothstep(near).toFixed(3));
    });
  });

  // Stage lists on light sections: each item's top rule draws itself in from
  // the left as it arrives, running on from one item to the next along a row.
  if (motionOK) {
    document.querySelectorAll(".service-list-grid").forEach(function (list) {
      var items = Array.prototype.slice.call(list.querySelectorAll(".service"));
      if (!items.length) return;
      var rows = items.map(function () { return { col: 0, across: 1 }; });

      // Which column each item sits in, and how many share its row.
      var place = function () {
        items.forEach(function (svc, i) {
          var col = 0, across = 0;
          items.forEach(function (other, j) {
            if (other.offsetTop !== svc.offsetTop) return;
            across++;
            if (j < i) col++;
          });
          rows[i].col = col;
          rows[i].across = across || 1;
        });
      };
      place();
      window.addEventListener("resize", place);
      window.addEventListener("load", place);
      list.classList.add("has-rules");

      items.forEach(function (svc, i) {
        var item = watchScroll(svc, function (p) {
          var top = topInView(p, item);
          var drawn = clamp((viewportH * 0.92 - top) / (viewportH * 0.32), 0, 1);
          var rule = clamp(drawn * rows[i].across - rows[i].col, 0, 1);
          svc.style.setProperty("--rule", rule.toFixed(3));
        });
      });
    });
  }


  /* ---------- Frame: header, footer, wayfinding [fx-frame] ---------- */
  // Header links share one soft highlight that glides to whichever link is
  // under the pointer or has keyboard focus. The Request a Quote button keeps
  // its own sheen.
  if (primaryNav && finePointer) {
    var navGlide = document.createElement("span");
    navGlide.className = "nav-glide";
    navGlide.setAttribute("aria-hidden", "true");
    primaryNav.insertBefore(navGlide, primaryNav.firstChild);
    primaryNav.classList.add("has-glide");
    var glideOn = false;

    var glideTo = function (link) {
      navGlide.style.setProperty("--glide-x", link.offsetLeft + "px");
      navGlide.style.setProperty("--glide-w", link.offsetWidth + "px");
      if (glideOn) return;
      // Arriving from outside the nav, the highlight fades in where it is
      // instead of sliding over from the last link it lit.
      void navGlide.offsetWidth;
      glideOn = true;
      navGlide.classList.add("is-on");
    };
    var glideOff = function () {
      glideOn = false;
      navGlide.classList.remove("is-on");
    };

    primaryNav.querySelectorAll("a:not(.nav-cta)").forEach(function (link) {
      link.addEventListener("pointerenter", function () { glideTo(link); });
      link.addEventListener("focus", function () { glideTo(link); });
    });
    var cta = primaryNav.querySelector(".nav-cta");
    if (cta) cta.addEventListener("pointerenter", glideOff);
    // When the pointer leaves, the highlight goes back to a link that has
    // keyboard focus, or fades out.
    primaryNav.addEventListener("pointerleave", function () {
      var focused = document.activeElement;
      if (focused && focused !== cta && primaryNav.contains(focused) &&
          focused.matches && focused.matches(":focus-visible")) glideTo(focused);
      else glideOff();
    });
    primaryNav.addEventListener("focusout", function (event) {
      if (!primaryNav.contains(event.relatedTarget)) glideOff();
    });
  }

  // Footer finale: a giant wordmark rises out of the horizon as the visitor
  // reaches the bottom of the page, centre letters first, and a glint runs
  // across it as it lands. --finale-rise goes from 0 to 1 over the last
  // stretch of the page; without the script, or with reduced motion, the
  // wordmark simply stands.
  var finale = document.querySelector(".footer-finale");
  var footerEl = finale && finale.closest(".site-footer");
  if (finale && footerEl && motionOK) {
    var finaleWord = finale.querySelector(".finale-word");
    var finaleLetters = finale.querySelectorAll(".finale-word span");
    var riseFrom = 0;
    var riseTo = 1;

    // The rise starts once a third of the wordmark is on screen and ends
    // just before the bottom of the page, in pixels the footer has come up
    // from the bottom of the window.
    var measureFinale = function () {
      var foot = footerEl.getBoundingClientRect();
      var box = finale.getBoundingClientRect();
      riseFrom = box.top - foot.top + box.height / 3;
      riseTo = Math.max(foot.height - 6, riseFrom + 1);
      // Each letter paints its share of one glint that spans the whole word.
      finale.style.setProperty("--finale-w", finaleWord.offsetWidth + "px");
      finaleLetters.forEach(function (letter) {
        letter.style.setProperty("--finale-x", letter.offsetLeft + "px");
      });
    };
    measureFinale();
    finale.classList.add("is-live");

    var footerWatch = watchScroll(footerEl, function (p) {
      var risen = p * (viewportH + footerWatch.height);
      var rise = clamp((risen - riseFrom) / (riseTo - riseFrom), 0, 1);
      finale.style.setProperty("--finale-rise", rise.toFixed(3));
    });
    window.addEventListener("resize", measureFinale);
    window.addEventListener("load", measureFinale);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureFinale);
  }

  // Moving between pages, the CSS asks for a view transition (see the end of
  // styles.css). When the browser abandons one, say because the visitor
  // clicked on again mid-way, its promises reject; the page simply loads,
  // so the rejections are caught here instead of reaching the console.
  var quietTransition = function (event) {
    var transition = event.viewTransition;
    if (!transition) return;
    var ignore = function () {};
    ["ready", "finished", "updateCallbackDone"].forEach(function (name) {
      if (transition[name] && transition[name].catch) transition[name].catch(ignore);
    });
  };
  window.addEventListener("pageswap", quietTransition);
  window.addEventListener("pagereveal", quietTransition);

  // Altimeter: on wide screens, a slim gauge on the right edge lists the
  // page's numbered sections between zenith (the top of the page) and nadir
  // (the bottom). A marker glides down it with the scroll, the current
  // section lights up, and hovering or focusing it slides out the section
  // names. It needs at least three numbered sections to be worth showing.
  var altMain = document.querySelector("main");
  var altSections = [];
  if (altMain) {
    altMain.querySelectorAll("section").forEach(function (section) {
      var eyebrow = section.querySelector(".eyebrow");
      var index = eyebrow && eyebrow.querySelector(".index");
      var num = index ? index.textContent.trim() : "";
      if (!/^\d+$/.test(num)) return;
      // The label is the eyebrow's own text, without its number, tags, or
      // any decorative copy another effect may have added.
      var copy = eyebrow.cloneNode(true);
      copy.querySelectorAll(".index, .tag, [aria-hidden='true']").forEach(function (el) {
        el.parentNode.removeChild(el);
      });
      var label = copy.textContent.replace(/\s+/g, " ").trim();
      if (!label) return;
      if (!section.id) {
        var slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        section.id = slug && !document.getElementById(slug) ? slug : "section-" + num;
      }
      altSections.push({ el: section, num: num, label: label });
    });
  }

  if (altSections.length >= 3) {
    var altNav = document.createElement("nav");
    altNav.className = "altimeter";
    altNav.setAttribute("aria-label", "Sections");

    var altScale = document.createElement("div");
    altScale.className = "alt-scale";
    altScale.setAttribute("aria-hidden", "true");
    ["alt-cap alt-zenith", "alt-rail", "alt-trail", "alt-marker", "alt-cap alt-nadir"].forEach(function (name) {
      var part = document.createElement("span");
      part.className = name;
      if (name === "alt-cap alt-zenith") part.textContent = "Zenith";
      if (name === "alt-cap alt-nadir") part.textContent = "Nadir";
      altScale.appendChild(part);
    });
    altNav.appendChild(altScale);

    var altList = document.createElement("ol");
    altList.className = "alt-list";
    var altCount = altSections.length;
    altSections.forEach(function (sec, i) {
      var item = document.createElement("li");
      item.style.setProperty("--alt-t", ((i + 1) / (altCount + 1)).toFixed(4));
      var link = document.createElement("a");
      link.className = "alt-link";
      link.href = "#" + sec.el.id;
      var num = document.createElement("span");
      num.className = "alt-num";
      num.textContent = sec.num;
      var label = document.createElement("span");
      label.className = "alt-label";
      label.textContent = sec.label;
      // Read as "03 Inside the Desktop"; drawn with the name to the left.
      link.appendChild(num);
      link.appendChild(document.createTextNode(" "));
      link.appendChild(label);
      item.appendChild(link);
      altList.appendChild(item);
      sec.link = link;
    });
    altNav.appendChild(altList);
    altMain.parentNode.insertBefore(altNav, altMain.nextSibling);

    // Scroll offsets where the marker reaches each tick: the top of the page
    // (zenith), each section once its top is a third of the way up the
    // window, and the bottom of the page (nadir). Measured with the layout,
    // never during a scroll.
    var altStops = [];
    var altShowAt = 0;
    var altHero = document.querySelector(".hero, .page-hero");
    var measureAltimeter = function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var lead = window.innerHeight / 3;
      altStops = [0];
      altSections.forEach(function (sec) {
        altStops.push(clamp(docTop(sec.el) - lead, 0, max));
      });
      altStops.push(max);
      // Every stop at least a little past the one before, and every section
      // still reachable at the very bottom of the page.
      for (var i = altStops.length - 2; i > 0; i--) {
        altStops[i] = Math.min(altStops[i], altStops[i + 1] - 2);
      }
      for (var j = 1; j < altStops.length; j++) {
        altStops[j] = Math.max(altStops[j], altStops[j - 1] + 1);
      }
      altShowAt = altHero ? docTop(altHero) + altHero.offsetHeight * 0.6 : 0;
      queueScroll();
    };
    measureAltimeter();
    window.addEventListener("resize", measureAltimeter);
    window.addEventListener("load", measureAltimeter);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureAltimeter);
    if ("ResizeObserver" in window) new ResizeObserver(measureAltimeter).observe(document.body);

    var altShown = null;
    var altCurrent = -1;
    var altLastPos = -1;
    scrollHooks.push(function (y) {
      var shown = y > altShowAt;
      if (shown !== altShown) {
        altShown = shown;
        altNav.classList.toggle("is-shown", shown);
      }

      var stops = altStops;
      var k = 0;
      while (k < stops.length - 2 && y >= stops[k + 1]) k++;
      var span = stops[k + 1] - stops[k];
      var frac = span > 0 ? clamp((y - stops[k]) / span, 0, 1) : 0;
      var current = clamp(frac >= 1 ? k + 1 : k, 0, altCount) - 1;
      // With reduced motion the marker steps from section to section.
      var pos = (reduceMotion ? current + 1 : k + frac) / (altCount + 1);
      pos = Math.round(pos * 1000) / 1000;
      if (pos !== altLastPos) {
        altLastPos = pos;
        altNav.style.setProperty("--alt", String(pos));
      }

      if (current !== altCurrent) {
        if (altCurrent >= 0) altSections[altCurrent].link.removeAttribute("aria-current");
        if (current >= 0) altSections[current].link.setAttribute("aria-current", "location");
        altCurrent = current;
      }
    });
  }


  /* ---------- Surfaces [fx-surfaces] ---------- */
  // Loops on these surfaces run only while they are on screen: .is-live is
  // set while any part of one is in view, and the CSS pauses it without.
  var liveWhileVisible = function (el) {
    new IntersectionObserver(function (entries) {
      el.classList.toggle("is-live", entries[entries.length - 1].isIntersecting);
    }).observe(el);
  };
  var addSpan = function (className, parent) {
    var span = document.createElement("span");
    span.className = className;
    parent.appendChild(span);
    return span;
  };

  // Magnetic buttons: the primary buttons and the header's quote button lean
  // a few pixels toward a pointer that comes near, then spring back, with a
  // little overshoot, once it moves away. A highlight inside follows the
  // pointer across the silver (--bx, --by).
  if (finePointer && motionOK) {
    var magnets = [];
    var MAGNET_REACH = 44;
    var navFolded = mediaMatches("(max-width: 960px)");
    window.addEventListener("resize", function () {
      navFolded = mediaMatches("(max-width: 960px)");
    });

    document.querySelectorAll(".btn-primary, .primary-nav a.nav-cta").forEach(function (el) {
      // Full-width form buttons and the license tray's button stay put.
      if (el.classList.contains("btn-block") || el.closest(".license-tray")) return;
      magnets.push({ el: el, nav: el.classList.contains("nav-cta"), seen: false, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 });
    });

    var magnetsSeen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        for (var i = 0; i < magnets.length; i++) {
          if (magnets[i].el === entry.target) magnets[i].seen = entry.isIntersecting;
        }
      });
    });
    magnets.forEach(function (m) { magnetsSeen.observe(m.el); });

    var springQueued = false;
    var springAt = 0;
    var spring = function (now) {
      springQueued = false;
      // Tuned per 60Hz frame and scaled to the real frame time.
      var dt = springAt ? clamp((now - springAt) / 16.7, 0.25, 3) : 1;
      springAt = now;
      var busy = false;
      for (var i = 0; i < magnets.length; i++) {
        var m = magnets[i];
        if (!m.x && !m.y && !m.vx && !m.vy && !m.tx && !m.ty) continue;
        m.vx = (m.vx + (m.tx - m.x) * 0.14 * dt) * Math.pow(0.74, dt);
        m.vy = (m.vy + (m.ty - m.y) * 0.14 * dt) * Math.pow(0.74, dt);
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        if (Math.abs(m.tx - m.x) + Math.abs(m.ty - m.y) + Math.abs(m.vx) + Math.abs(m.vy) < 0.05) {
          m.x = m.tx;
          m.y = m.ty;
          m.vx = m.vy = 0;
        } else {
          busy = true;
        }
        if (m.x || m.y) m.el.style.setProperty("translate", m.x.toFixed(2) + "px " + m.y.toFixed(2) + "px");
        else m.el.style.removeProperty("translate");
      }
      if (busy) {
        springQueued = true;
        window.requestAnimationFrame(spring);
      } else {
        springAt = 0;
      }
    };
    var kickSpring = function () {
      if (springQueued) return;
      springQueued = true;
      window.requestAnimationFrame(spring);
    };
    var releaseMagnets = function () {
      var moved = false;
      magnets.forEach(function (m) {
        if (m.tx || m.ty) moved = true;
        m.tx = m.ty = 0;
      });
      if (moved) kickSpring();
    };

    pointerHooks.push(function (event) {
      var pulls = [];
      for (var i = 0; i < magnets.length; i++) {
        var m = magnets[i];
        var box = m.seen && !(m.nav && navFolded) ? m.el.getBoundingClientRect() : null;
        if (!box || !box.width) {
          if (m.tx || m.ty) pulls.push({ m: m, x: 0, y: 0 });
          continue;
        }
        // Measure from where the button rests, not where it has been pulled.
        var halfW = box.width / 2;
        var halfH = box.height / 2;
        var dx = event.clientX - (box.left + halfW - m.x);
        var dy = event.clientY - (box.top + halfH - m.y);
        var outX = Math.max(Math.abs(dx) - halfW, 0);
        var outY = Math.max(Math.abs(dy) - halfH, 0);
        var near = clamp(1 - Math.sqrt(outX * outX + outY * outY) / MAGNET_REACH, 0, 1);
        near = near * near * (3 - 2 * near);
        var reach = m.nav ? 0.7 : 1;
        pulls.push({
          m: m,
          x: clamp(dx / (halfW + MAGNET_REACH), -1, 1) * 8 * reach * near,
          y: clamp(dy / (halfH + MAGNET_REACH), -1, 1) * 5 * reach * near,
          bx: event.clientX - box.left,
          by: event.clientY - box.top,
          over: near === 1
        });
      }
      if (!pulls.length) return null;
      return function () {
        var moved = false;
        pulls.forEach(function (pull) {
          var m = pull.m;
          if (pull.x !== m.tx || pull.y !== m.ty) moved = true;
          m.tx = pull.x;
          m.ty = pull.y;
          if (pull.over) {
            m.el.style.setProperty("--bx", pull.bx.toFixed(1) + "px");
            m.el.style.setProperty("--by", pull.by.toFixed(1) + "px");
          }
        });
        if (moved) kickSpring();
      };
    });
    // A pointer that stops while the page scrolls under it lets go.
    scrollHooks.push(function (y, dy) {
      if (dy) releaseMagnets();
    });
    document.documentElement.addEventListener("mouseleave", releaseMagnets);
  }

  // Consoles: rise out of a slight tilt-back as they scroll into view, flat
  // by the time they reach the middle of the screen (--console-rise, 1 to 0).
  if (motionOK) {
    document.querySelectorAll(".console").forEach(function (consoleEl) {
      watchScroll(consoleEl, function (p) {
        consoleEl.style.setProperty("--console-rise", clamp(1 - p / 0.42, 0, 1).toFixed(3));
      });
      liveWhileVisible(consoleEl);
    });

    // Stat strips: a light that scans along the strip once the figures land.
    document.querySelectorAll(".stat-strip").forEach(function (strip) {
      addSpan("stat-scan", strip).setAttribute("aria-hidden", "true");
    });

    // The base license's border carries a point of light, on screen only.
    document.querySelectorAll(".plan.is-base").forEach(liveWhileVisible);
  }

  // About constellation (home): the figure turns slowly as it scrolls past,
  // its faint background stars drift at their own depth (--sky-p, -0.5 to
  // 0.5), and each star flares as its line reaches it.
  var constellation = document.querySelector(".constellation");
  if (constellation && motionOK) {
    var SVG_NS = "http://www.w3.org/2000/svg";
    watchScroll(constellation.closest(".about-visual") || constellation, function (p) {
      constellation.style.setProperty("--sky-p", (p - 0.5).toFixed(3));
    });
    Array.prototype.forEach.call(constellation.children, function (child) {
      if (child.tagName.toLowerCase() === "g" && !child.getAttribute("class")) {
        child.setAttribute("class", "c-far");
      }
    });

    // The lines draw over 2.2s on the site's ease, cubic-bezier(0.22, 1,
    // 0.36, 1), the second and third starting 0.6s and 1.1s in (see the
    // constellation CSS). A star flares at the moment its line's drawn
    // length reaches it. The lines are straight segments ("M x y L x y ...").
    var LINE_STARTS = [0, 0.6, 1.1];
    var LINE_TIME = 2.2;
    var bezier = function (a, b, s) {
      var r = 1 - s;
      return 3 * r * r * s * a + 3 * r * s * s * b + s * s * s;
    };
    var timeFor = function (progress) {
      var lo = 0, hi = 1;
      for (var k = 0; k < 24; k++) {
        var mid = (lo + hi) / 2;
        if (bezier(1, 1, mid) < progress) lo = mid;
        else hi = mid;
      }
      return bezier(0.22, 0.36, (lo + hi) / 2);
    };
    var flareAt = {};
    constellation.querySelectorAll(".c-lines path").forEach(function (path, i) {
      var nums = (path.getAttribute("d") || "").match(/-?\d*\.?\d+/g) || [];
      var pts = [];
      for (var n = 0; n + 1 < nums.length; n += 2) pts.push([parseFloat(nums[n]), parseFloat(nums[n + 1])]);
      var along = [0];
      for (var j = 1; j < pts.length; j++) {
        var sx = pts[j][0] - pts[j - 1][0];
        var sy = pts[j][1] - pts[j - 1][1];
        along.push(along[j - 1] + Math.sqrt(sx * sx + sy * sy));
      }
      var total = along[along.length - 1] || 1;
      pts.forEach(function (pt, j) {
        // The line touches a star a few units before its centre; the ease's
        // long tail would otherwise hold the last flare back by a second.
        var at = (LINE_STARTS[i] || 0) + timeFor(Math.max(along[j] - 3, 0) / total) * LINE_TIME;
        var key = pt[0] + "," + pt[1];
        if (!(key in flareAt) || at < flareAt[key]) flareAt[key] = at;
      });
    });

    var flares = document.createElementNS(SVG_NS, "g");
    flares.setAttribute("class", "c-flares");
    constellation.querySelectorAll(".c-stars circle").forEach(function (star) {
      var x = parseFloat(star.getAttribute("cx"));
      var y = parseFloat(star.getAttribute("cy"));
      var at = flareAt[x + "," + y];
      if (at === undefined) return;
      // A four-pointed glint and a ring that opens around the star.
      var reach = 6 + parseFloat(star.getAttribute("r") || "2") * 2.4;
      var waist = reach * 0.14;
      var group = document.createElementNS(SVG_NS, "g");
      group.style.setProperty("--flare-at", at.toFixed(2) + "s");
      var glint = document.createElementNS(SVG_NS, "path");
      glint.setAttribute("class", "c-glint");
      glint.setAttribute(
        "d",
        "M" + x + " " + (y - reach) + "L" + (x + waist) + " " + (y - waist) + "L" + (x + reach) + " " + y +
          "L" + (x + waist) + " " + (y + waist) + "L" + x + " " + (y + reach) + "L" + (x - waist) + " " + (y + waist) +
          "L" + (x - reach) + " " + y + "L" + (x - waist) + " " + (y - waist) + "Z"
      );
      var halo = document.createElementNS(SVG_NS, "circle");
      halo.setAttribute("class", "c-halo");
      halo.setAttribute("cx", String(x));
      halo.setAttribute("cy", String(y));
      halo.setAttribute("r", (reach * 0.8).toFixed(1));
      group.appendChild(halo);
      group.appendChild(glint);
      flares.appendChild(group);
    });
    var starGroup = constellation.querySelector(".c-stars");
    if (starGroup) starGroup.parentNode.insertBefore(flares, starGroup.nextSibling);
  }

  // CTA bands: the finale. The satellite now leaves a fading trail, a second
  // orbit crosses the first at a tilt with its own slower satellite, and a
  // faint haze sits where the orbits meet. The tilted orbit swings open as
  // the band scrolls in (--cta-open, 1 to 0).
  document.querySelectorAll(".cta-band").forEach(function (band) {
    var orbit = document.createElement("span");
    orbit.className = "cta-orbit";
    orbit.setAttribute("aria-hidden", "true");
    addSpan("cta-haze", orbit);
    var near = addSpan("cta-spin", orbit);
    addSpan("cta-trail", near);
    addSpan("cta-dot", addSpan("cta-sat", near));
    var far = addSpan("cta-spin", addSpan("cta-plane", orbit));
    addSpan("cta-trail", far);
    addSpan("cta-dot", addSpan("cta-sat", far));
    band.insertBefore(orbit, band.firstChild);
    band.classList.add("has-orbit");
    if (!motionOK) return;
    liveWhileVisible(band);
    watchScroll(band, function (p) {
      band.style.setProperty("--cta-open", clamp(1 - p / 0.38, 0, 1).toFixed(3));
    });
  });


  /* ---------- Catalog and commerce [fx-commerce] ---------- */
  // The rest of this area lives with the catalog, tray, and form code at the end of the file.

  // The catalog's filter bar sticks under the header. Once it does, it turns
  // to frosted glass with a soft shadow and a lit lower edge, so it reads as
  // floating over the cards. A one-pixel marker where the bar starts says
  // when: it leaves the area below the header just as the bar sticks.
  var catalogBar = document.querySelector(".catalog-bar");
  if (catalogBar && "IntersectionObserver" in window) {
    var catalogBarMarker = document.createElement("div");
    catalogBarMarker.className = "catalog-bar-marker";
    catalogBarMarker.setAttribute("aria-hidden", "true");
    catalogBar.parentElement.insertBefore(catalogBarMarker, catalogBar);
    new IntersectionObserver(
      function (entries) {
        var entry = entries[entries.length - 1];
        catalogBar.classList.toggle("is-stuck", !entry.isIntersecting && entry.boundingClientRect.top < 80);
      },
      { rootMargin: "-73px 0px 0px 0px" }
    ).observe(catalogBarMarker);
  }


  // Set the scroll-driven state for wherever the page opened.
  runScrollHooks();

  /* ---------- Catalog, prices, and the license being built ---------- */
  var catalog = window.NADIRION_CATALOG || null;
  var params = new URLSearchParams(window.location.search);

  var isKnownModule = function (id) {
    return !!(catalog && Object.prototype.hasOwnProperty.call(catalog.modules, id));
  };
  var moduleOf = function (id) {
    return isKnownModule(id) ? catalog.modules[id] : null;
  };
  var isAmount = function (value) {
    return typeof value === "number" && isFinite(value);
  };

  var formatPrice = function (amount) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: catalog.currency || "USD",
        maximumFractionDigits: amount % 1 === 0 ? 0 : 2
      }).format(amount);
    } catch (e) {
      return "$" + amount;
    }
  };
  // Any price still null in catalog.js shows as this visible placeholder.
  var pendingLabel = function () {
    return (catalog && catalog.pendingLabel) || "[VERIFY: price]";
  };
  var seatUnit = function () { return (catalog && catalog.priceUnit) || "/seat/yr"; };
  var orgUnit = function () { return (catalog && catalog.orgUnit) || "/org/yr"; };
  var priceText = function (amount, unit) {
    return (isAmount(amount) ? formatPrice(amount) : pendingLabel()) + unit;
  };

  var bundleOf = function (key) {
    return catalog && catalog.bundles ? catalog.bundles[key] || null : null;
  };
  // Every module a bundle covers: whole categories, or everything per seat.
  var bundleMembers = function (key) {
    var bundle = bundleOf(key);
    if (!bundle) return [];
    return Object.keys(catalog.modules).filter(function (id) {
      var mod = catalog.modules[id];
      if (bundle.everything) return bundle.includeOrg || mod.unit !== "org";
      return (bundle.categories || []).indexOf(mod.category) !== -1;
    });
  };
  // The bundle a module is sold only as part of (Host Utilities), if any.
  var soleBundleOf = function (id) {
    var mod = moduleOf(id);
    var bundle = mod && mod.bundle ? bundleOf(mod.bundle) : null;
    return bundle && bundle.only ? mod.bundle : null;
  };
  var isOrgItem = function (id) {
    var mod = moduleOf(id);
    return !!(mod && mod.unit === "org");
  };
  var isPreview = function (id) {
    var mod = moduleOf(id);
    return !!(mod && mod.preview);
  };
  var displayName = function (id) {
    return catalog.modules[id].name + (isPreview(id) ? " (Preview)" : "");
  };

  // One module's own annual price, per seat (or per organization), before
  // any bundle. Null while a price it depends on is still unset.
  var modulePrice = function (id) {
    var mod = moduleOf(id);
    if (!mod) return null;
    var base = null;
    if (mod.unit === "org" || "price" in mod) {
      base = isAmount(mod.price) ? mod.price : null;
    } else if (mod.tier && catalog.tiers && catalog.tiers[mod.tier]) {
      base = isAmount(catalog.tiers[mod.tier].price) ? catalog.tiers[mod.tier].price : null;
    } else {
      return null;
    }
    if (!mod.preview) return base;
    var preview = catalog.preview || {};
    if (preview.mode === "free") return 0;
    if (preview.mode === "discount" && isAmount(preview.discount) && base !== null) {
      return Math.round(base * (1 - preview.discount) * 100) / 100;
    }
    return null;
  };

  // Prices a selection the cheapest way it can be covered: modules one by
  // one, or with a bundle where the bundle costs less. Nadirion Desktop is
  // included with any paid module. Returns null for any figure that still
  // depends on an unset price, so nothing is ever totalled from a guess.
  var priceLicense = function (list, seats) {
    seats = seats > 0 ? seats : 1;
    var seatIds = list.filter(function (id) { return !isOrgItem(id); });
    var orgIds = list.filter(isOrgItem);

    // Modules priced one by one; bundle-only modules cost their bundle once.
    var oneByOne = function (ids) {
      var total = 0;
      var counted = {};
      for (var i = 0; i < ids.length; i++) {
        var sole = soleBundleOf(ids[i]);
        if (sole) {
          if (counted[sole]) continue;
          counted[sole] = true;
          if (!isAmount(bundleOf(sole).price)) return null;
          total += bundleOf(sole).price;
        } else {
          var price = modulePrice(ids[i]);
          if (price === null) return null;
          total += price;
        }
      }
      return total;
    };
    var orgTotal = 0;
    for (var o = 0; o < orgIds.length; o++) {
      var orgPrice = modulePrice(orgIds[o]);
      if (orgPrice === null) { orgTotal = null; break; }
      orgTotal += orgPrice;
    }

    var seat = oneByOne(seatIds);
    var result = { seat: seat, org: orgTotal, bundle: null, desktopOnly: false };
    if (seat === null || orgTotal === null) return result;

    Object.keys(catalog.bundles || {}).forEach(function (key) {
      var bundle = catalog.bundles[key];
      if (bundle.only || !isAmount(bundle.price)) return;
      var members = bundleMembers(key);
      var covered = list.filter(function (id) { return members.indexOf(id) !== -1; });
      if (!covered.length) return;
      var rest = oneByOne(seatIds.filter(function (id) { return members.indexOf(id) === -1; }));
      if (rest === null) return;
      var withOrg = bundle.includeOrg ? 0 : orgTotal;
      var cost = (bundle.price + rest) * seats + withOrg;
      if (cost < result.seat * seats + result.org) {
        result = { seat: bundle.price + rest, org: withOrg, bundle: key, desktopOnly: false };
      }
    });

    // Nothing paid in the license: Nadirion Desktop is bought on its own.
    if (result.seat === 0 && result.org === 0) {
      var desktop = catalog.desktop && isAmount(catalog.desktop.price) ? catalog.desktop.price : null;
      result.seat = desktop;
      result.desktopOnly = true;
    }
    return result;
  };

  // The running total in words, e.g. "$1,200/seat/yr + $500/org/yr".
  var totalText = function (priced) {
    var text = priceText(priced.seat, seatUnit());
    if (priced.org === null) text += " + " + pendingLabel() + orgUnit();
    else if (priced.org > 0) text += " + " + formatPrice(priced.org) + orgUnit();
    return text;
  };

  // Price labels: module cards ("Core · $0/seat/yr") and the price list.
  var cardPriceText = function (id) {
    var mod = moduleOf(id);
    if (!mod) return "";
    var sole = soleBundleOf(id);
    if (sole) {
      return "Bundle of " + bundleMembers(sole).length + " · " + priceText(bundleOf(sole).price, seatUnit());
    }
    var label = mod.unit === "org" ? "Per org" :
      (mod.tier && catalog.tiers[mod.tier] ? catalog.tiers[mod.tier].name : "");
    var unit = mod.unit === "org" ? orgUnit() : seatUnit();
    if (mod.preview) {
      var preview = catalog.preview || {};
      label = "Preview";
      if (preview.mode === "free") return label + " · Included free";
    }
    return label + " · " + priceText(modulePrice(id), unit);
  };

  var listPriceText = function (key) {
    if (key === "desktop") return priceText(catalog.desktop && catalog.desktop.price, seatUnit());
    var parts = key.split(":");
    if (parts[0] === "tier" && catalog.tiers[parts[1]]) return priceText(catalog.tiers[parts[1]].price, seatUnit());
    if (parts[0] === "bundle" && bundleOf(parts[1])) return priceText(bundleOf(parts[1]).price, seatUnit());
    if (parts[0] === "module" && isKnownModule(parts[1])) {
      return priceText(modulePrice(parts[1]), isOrgItem(parts[1]) ? orgUnit() : seatUnit());
    }
    if (parts[0] === "preview") {
      var preview = catalog.preview || {};
      if (preview.mode === "free") return "Included free";
      if (preview.mode === "discount" && isAmount(preview.discount)) {
        return Math.round(preview.discount * 100) + "% off the module's tier price";
      }
      return "[VERIFY: discounted or included free]";
    }
    return null;
  };

  if (catalog) {
    // Module cards: [data-price-for="<module id>"].
    document.querySelectorAll(".mod-price[data-price-for]").forEach(function (el) {
      var text = cardPriceText(el.getAttribute("data-price-for"));
      if (!text) return;
      el.textContent = text;
      el.hidden = false;
    });
    // Price list and other labels: [data-list-price="tier:core"] and friends.
    document.querySelectorAll("[data-list-price]").forEach(function (el) {
      var text = listPriceText(el.getAttribute("data-list-price"));
      if (text !== null) el.textContent = text;
    });
    // Preview modules carry a "Preview" tag on their catalog card.
    document.querySelectorAll(".mod-add[data-module]").forEach(function (button) {
      var id = button.getAttribute("data-module");
      var tags = button.closest(".mod-card") && button.closest(".mod-card").querySelector(".mod-tags");
      if (!isPreview(id) || !tags) return;
      var tag = document.createElement("li");
      tag.textContent = "Preview";
      tags.insertBefore(tag, tags.firstChild);
    });
  }

  // The selection lives in localStorage so it survives the walk from the
  // catalog to the quote form. Storage can be missing or throw (private
  // windows, blocked site data), so an in-memory copy backs it up.
  var LICENSE_KEY = "nadirion.license.modules";
  var memorySelection = [];

  // A module sold only in a bundle brings the rest of its bundle with it.
  var withWholeBundles = function (list) {
    var out = list.slice();
    list.forEach(function (id) {
      var sole = soleBundleOf(id);
      if (!sole) return;
      bundleMembers(sole).forEach(function (member) {
        if (out.indexOf(member) === -1) out.push(member);
      });
    });
    return out;
  };

  var readSelection = function () {
    var list = memorySelection;
    try {
      var raw = window.localStorage.getItem(LICENSE_KEY);
      if (raw) list = JSON.parse(raw);
    } catch (e) { /* fall back to memory */ }
    if (!Array.isArray(list)) return [];
    return withWholeBundles(list.filter(function (id, index) {
      return isKnownModule(id) && list.indexOf(id) === index;
    }));
  };

  var writeSelection = function (list) {
    memorySelection = list.slice();
    try {
      window.localStorage.setItem(LICENSE_KEY, JSON.stringify(list));
    } catch (e) { /* memory copy is enough for this page */ }
  };

  var quoteHref = function (list) {
    var href = "contact.html?interest=quote";
    if (list.length) href += "&modules=" + encodeURIComponent(list.join(","));
    return href;
  };

  var plural = function (count, word) {
    return count + " " + word + (count === 1 ? "" : "s");
  };

  // A quote link from the catalog carries the selection in the URL too, in
  // case storage was unavailable there.
  if (catalog && params.has("modules")) {
    writeSelection(withWholeBundles(
      params.get("modules").split(",").filter(function (id, index, all) {
        return isKnownModule(id) && all.indexOf(id) === index;
      })
    ));
  }

  /* ---------- Module catalog: add to license ---------- */
  var addButtons = document.querySelectorAll(".mod-add[data-module]");
  var tray = document.getElementById("licenseTray");
  var COMMERCE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
  var commerceMotion = motionOK && !!document.documentElement.animate;
  var trayLastCount = null;

  // Runs a Web Animation, quietly doing nothing where one can't run.
  var commerceAnimate = function (el, frames, options) {
    if (!commerceMotion || !el) return null;
    try {
      return el.animate(frames, options);
    } catch (e) {
      return null;
    }
  };

  // Each button draws its own mark: a plus whose two strokes turn into a
  // check once the module is in the license. The typed + and check move
  // into the drawing; the words stay as they were. The button's
  // aria-label names it either way.
  var markAddButton = function (button) {
    var mark = document.createElement("span");
    mark.className = "mod-add-mark";
    mark.setAttribute("aria-hidden", "true");
    ["mod-add-bar", "mod-add-bar", "mod-add-ring"].forEach(function (name) {
      var part = document.createElement("span");
      part.className = name;
      mark.appendChild(part);
    });
    button.querySelectorAll(".when-off, .when-on").forEach(function (words) {
      words.textContent = words.textContent.replace(/^\s*[+\u2713]\s*/, "");
    });
    button.insertBefore(mark, button.firstChild);
  };

  // Adding a module: the button sends out a ring of light, the check's own
  // ring bursts, and the card's border flares before settling to its
  // selected glow.
  var celebrateAdd = function (button) {
    commerceAnimate(button, [
      { boxShadow: "0 0 0 0 rgba(255, 255, 255, 0.5)" },
      { boxShadow: "0 0 0 14px rgba(255, 255, 255, 0)" }
    ], { duration: 750, easing: COMMERCE_EASE });
    commerceAnimate(button.querySelector(".mod-add-ring"), [
      { transform: "scale(0.3)", opacity: 0.9 },
      { transform: "scale(2.4)", opacity: 0 }
    ], { duration: 650, easing: COMMERCE_EASE });
    commerceAnimate(button.closest(".mod-card"), [
      { borderColor: "rgba(255, 255, 255, 1)", boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.35), 0 0 80px -16px rgba(255, 255, 255, 0.45)" }
    ], { duration: 1100, easing: COMMERCE_EASE });
  };

  // The tray's count rolls to its new figure, up for more and down for
  // fewer, with a small pulse.
  var bumpTrayCount = function (count, num, more) {
    commerceAnimate(num, [
      { transform: "translate3d(0, " + (more ? 70 : -70) + "%, 0)", opacity: 0, filter: "blur(3px)" },
      { transform: "none", opacity: 1, filter: "blur(0)" }
    ], { duration: 480, easing: COMMERCE_EASE });
    commerceAnimate(count, [
      { transform: "scale(1)" },
      { transform: "scale(1.06)", offset: 0.35 },
      { transform: "scale(1)" }
    ], { duration: 520, easing: "ease-out" });
  };

  var renderSelection = function () {
    var selected = readSelection();

    addButtons.forEach(function (button) {
      var on = selected.indexOf(button.getAttribute("data-module")) !== -1;
      button.setAttribute("aria-pressed", String(on));
      var card = button.closest(".mod-card");
      if (card) card.classList.toggle("is-selected", on);
    });

    if (!tray) return;
    var visible = selected.length > 0;
    var wasVisible = tray.classList.contains("is-visible");
    tray.classList.toggle("is-visible", visible);
    document.body.classList.toggle("has-tray", visible);

    var summary = document.getElementById("traySummary");
    if (summary) {
      // Same words as before ("3 add-on modules"); the figure is its own
      // span so it can roll.
      var count = document.createElement("strong");
      var num = document.createElement("span");
      num.className = "tray-num";
      num.textContent = String(selected.length);
      count.appendChild(num);
      count.appendChild(document.createTextNode(plural(selected.length, "add-on module").slice(num.textContent.length)));
      summary.textContent = "Nadirion Desktop + ";
      summary.appendChild(count);
      if (wasVisible && visible && trayLastCount !== null && trayLastCount !== selected.length) {
        bumpTrayCount(count, num, selected.length > trayLastCount);
      }
    }
    trayLastCount = selected.length;
    // The running total at founding prices, with any bundle that brings it down.
    var priced = priceLicense(selected, 1);
    if (summary && priced.bundle) {
      summary.appendChild(document.createTextNode(" \u00b7 priced as " + bundleOf(priced.bundle).name));
    }
    var totalEl = document.getElementById("trayTotal");
    if (totalEl) {
      totalEl.hidden = false;
      totalEl.textContent = totalText(priced);
    }
    var cta = document.getElementById("trayCta");
    if (cta) cta.setAttribute("href", quoteHref(selected));
  };

  if (catalog && addButtons.length) {
    addButtons.forEach(function (button) {
      markAddButton(button);
      button.addEventListener("click", function () {
        var id = button.getAttribute("data-module");
        var selected = readSelection();
        var at = selected.indexOf(id);
        // Host Utilities come as one bundle: all eight go in or out together.
        var group = soleBundleOf(id) ? bundleMembers(soleBundleOf(id)) : [id];
        if (at === -1) {
          group.forEach(function (member) {
            if (selected.indexOf(member) === -1) selected.push(member);
          });
        } else {
          selected = selected.filter(function (member) { return group.indexOf(member) === -1; });
        }
        writeSelection(selected);
        renderSelection();
        if (at === -1) celebrateAdd(button);
      });
    });

    var trayClear = document.getElementById("trayClear");
    if (trayClear) {
      trayClear.addEventListener("click", function () {
        writeSelection([]);
        renderSelection();
      });
    }

    renderSelection();
    // Back from the quote form, where modules can be removed, the browser
    // may restore this page as it was; show the license as it is now.
    window.addEventListener("pageshow", function (event) {
      if (event.persisted) renderSelection();
    });
  }

  /* ---------- Module catalog: search and category filter ---------- */
  var catalogSearch = document.getElementById("catalogSearch");
  var chips = document.querySelectorAll(".chip[data-filter]");
  var modCards = document.querySelectorAll(".mod-card[data-category]");
  var catGroups = document.querySelectorAll(".cat-group[data-category]");
  var catalogEmpty = document.getElementById("catalogEmpty");
  var activeFilter = "all";

  var applyFilter = function () {
    var terms = (catalogSearch ? catalogSearch.value : "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    var shown = 0;

    modCards.forEach(function (card) {
      var haystack = (card.textContent + " " + (card.getAttribute("data-aliases") || "")).toLowerCase();
      var inCategory = activeFilter === "all" || card.getAttribute("data-category") === activeFilter;
      var matches = terms.every(function (term) { return haystack.indexOf(term) !== -1; });
      card.hidden = !(inCategory && matches);
      if (!card.hidden) shown++;
    });

    catGroups.forEach(function (group) {
      group.hidden = !group.querySelector(".mod-card:not([hidden])");
    });

    if (catalogEmpty) catalogEmpty.hidden = shown > 0;
  };

  // Where the page scrolls back to after the result set changes: the top of
  // the catalog, just under the header.
  var catalogTop = function () {
    var bar = document.querySelector(".catalog-bar");
    if (!bar) return null;
    return bar.parentElement.getBoundingClientRect().top + window.scrollY - 72;
  };

  // After the result set changes, bring its first row into view if the
  // reader has already scrolled past the top of the catalog.
  var returnToCatalogTop = function () {
    var top = catalogTop();
    if (top !== null && window.scrollY > top) {
      window.scrollTo({ top: top, behavior: reduceMotion ? "auto" : "smooth" });
    }
  };

  // Filtering moves things rather than swapping them. Cards and category
  // headings that stay glide from where they were to where they now sit,
  // the ones that drop out fade where they stood, and the ones that arrive
  // rise in one after another. The hidden attribute still decides what is
  // listed; this only animates the change, and only what is on screen.
  var catalogSection = document.getElementById("catalog");
  var flipItems = [];
  catGroups.forEach(function (group) {
    var head = group.querySelector(".cat-head");
    if (head) flipItems.push(head);
    group.querySelectorAll(".mod-card").forEach(function (card) { flipItems.push(card); });
  });
  if (catalogEmpty) flipItems.push(catalogEmpty);

  var isListed = function (el) {
    var group = el.closest(".cat-group");
    return !el.hidden && !(group && group.hidden);
  };
  // Items still waiting for their first reveal are invisible anyway, and
  // the reveal brings them in when they reach the screen.
  var awaitsReveal = function (el) {
    return el.classList.contains("reveal") && !el.classList.contains("is-visible");
  };

  var catalogGhosts = null;
  var ghostOut = function (el, box, base, opacity) {
    if (!catalogGhosts) {
      catalogGhosts = document.createElement("div");
      catalogGhosts.className = "flip-ghosts";
      catalogGhosts.setAttribute("aria-hidden", "true");
      catalogSection.appendChild(catalogGhosts);
    }
    // A stand-in copy fades where the item stood, so the item itself can be
    // hidden at once.
    var ghost = el.cloneNode(true);
    ghost.removeAttribute("id");
    ghost.removeAttribute("hidden");
    ghost.classList.remove("reveal", "is-visible");
    ghost.classList.add("flip-ghost");
    ghost.inert = true;
    ghost.style.setProperty("left", (box.left - base.left - catalogSection.clientLeft).toFixed(1) + "px");
    ghost.style.setProperty("top", (box.top - base.top - catalogSection.clientTop).toFixed(1) + "px");
    ghost.style.setProperty("width", box.width.toFixed(1) + "px");
    ghost.style.setProperty("height", box.height.toFixed(1) + "px");
    catalogGhosts.appendChild(ghost);
    var anim = commerceAnimate(ghost, [
      { opacity: opacity, transform: "none", filter: "blur(0)" },
      { opacity: 0, transform: "scale(0.96)", filter: "blur(6px)" }
    ], { duration: 240, easing: "ease", fill: "forwards" });
    var drop = function () {
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
    };
    if (anim) anim.onfinish = drop;
    else drop();
  };

  var keepFlip = function (el, anim) {
    el.fxFlip = anim;
    if (anim) anim.onfinish = function () { el.fxFlip = null; };
  };

  var refilter = function (fromChip) {
    if (!commerceMotion || !catalogSection) {
      applyFilter();
      if (fromChip) returnToCatalogTop();
      return;
    }
    var viewH = window.innerHeight;
    var startY = window.scrollY;
    var onScreen = function (box, shift) {
      return box.height > 0 && box.bottom + shift > 0 && box.top + shift < viewH;
    };

    // First: where everything sits now, as the reader sees it, including
    // any glide still under way from a previous change.
    var before = flipItems.map(function (el) {
      var shown = isListed(el) && !awaitsReveal(el);
      var box = shown ? el.getBoundingClientRect() : null;
      var opacity = 1;
      if (el.fxFlip) {
        if (shown) opacity = parseFloat(window.getComputedStyle(el).opacity) || 0;
        el.fxFlip.cancel();
        el.fxFlip = null;
      }
      return { box: box, seen: shown && onScreen(box, 0), opacity: opacity };
    });

    applyFilter();

    // Then: where everything lands. A chip pressed deep in the list takes
    // the page back to the top of the catalog, so judge what will be on
    // screen from there.
    var top = fromChip ? catalogTop() : null;
    var shift = top !== null && window.scrollY > top ? window.scrollY - top : 0;
    // The page itself moves when a chip takes it back up, or when the list
    // gets shorter than the point the reader had reached. Then nothing
    // stays put to glide or fade, and whatever greets the reader where the
    // page comes to rest rises in.
    var moved = shift > 0 || Math.abs(window.scrollY - startY) > 1;
    var base = catalogSection.getBoundingClientRect();
    var arriving = [];
    var faded = 0;

    flipItems.forEach(function (el, i) {
      var was = before[i];
      var now = isListed(el) && !awaitsReveal(el);
      var box = now ? el.getBoundingClientRect() : null;
      var seenAfter = now && onScreen(box, shift);

      if (moved) {
        if (seenAfter) arriving.push({ el: el, box: box });
        return;
      }
      if (!now) {
        if (was.seen) {
          ghostOut(el, was.box, base, was.opacity);
          faded++;
        }
        return;
      }
      if (!was.box || !(was.seen || seenAfter)) {
        if (seenAfter) arriving.push({ el: el, box: box });
        return;
      }
      var dx = was.box.left - box.left;
      var dy = was.box.top - box.top;
      if (Math.abs(dy) > viewH) {
        // Too far to travel: let it go here and arrive there.
        if (was.seen) {
          ghostOut(el, was.box, base, was.opacity);
          faded++;
        }
        if (seenAfter) arriving.push({ el: el, box: box });
        return;
      }
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && was.opacity === 1) return;
      keepFlip(el, commerceAnimate(el, [
        { transform: "translate3d(" + dx.toFixed(1) + "px, " + dy.toFixed(1) + "px, 0)", opacity: was.opacity },
        { transform: "none", opacity: 1 }
      ], { duration: 620, easing: COMMERCE_EASE }));
    });

    // Arrivals rise in reading order, a beat after anything fading out.
    arriving.sort(function (a, b) {
      return a.box.top - b.box.top || a.box.left - b.box.left;
    });
    arriving.forEach(function (item, n) {
      keepFlip(item.el, commerceAnimate(item.el, [
        { opacity: 0, transform: "translate3d(0, 26px, 0) scale(0.97)", filter: "blur(6px)" },
        { opacity: 1, transform: "none", filter: "blur(0)" }
      ], {
        duration: 680,
        delay: (faded ? 170 : 0) + Math.min(n, 9) * 50,
        easing: COMMERCE_EASE,
        fill: "backwards"
      }));
    });

    if (fromChip) returnToCatalogTop();
  };

  // The pressed chip is one white pill that slides from chip to chip,
  // underneath the labels. Each label inverts against it, so the pressed
  // one reads black on white and the ones it crosses darken as it passes.
  var chipRow = chips.length ? chips[0].parentElement : null;
  var chipGlider = null;

  var placeChipGlider = function () {
    var pressed = chipRow.querySelector('.chip[aria-pressed="true"]');
    chipGlider.hidden = !pressed;
    if (!pressed) return;
    chipGlider.style.setProperty("--gx", pressed.offsetLeft + "px");
    chipGlider.style.setProperty("--gy", pressed.offsetTop + "px");
    chipGlider.style.setProperty("--gw", pressed.offsetWidth + "px");
    chipGlider.style.setProperty("--gh", pressed.offsetHeight + "px");
  };
  // Resizes and late-loading fonts move the pill without a slide.
  var settleChipGlider = function () {
    chipRow.classList.remove("glider-ready");
    placeChipGlider();
    chipGlider.getBoundingClientRect();
    chipRow.classList.add("glider-ready");
  };
  // On a narrow screen the chips scroll sideways; bring the pressed one to
  // the middle of the row.
  var centerChip = function (chip) {
    var spare = chipRow.scrollWidth - chipRow.clientWidth;
    if (spare < 2 || !chipRow.scrollTo) return;
    chipRow.scrollTo({
      left: clamp(chip.offsetLeft - (chipRow.clientWidth - chip.offsetWidth) / 2, 0, spare),
      behavior: reduceMotion ? "auto" : "smooth"
    });
  };

  if (chipRow && modCards.length) {
    chipGlider = document.createElement("span");
    chipGlider.className = "chip-glider";
    chipGlider.setAttribute("aria-hidden", "true");
    chipRow.appendChild(chipGlider);
    // Each chip's words move into a span of their own, which the CSS
    // blends against the pill. The chip's name stays the same.
    chips.forEach(function (chip) {
      var label = document.createElement("span");
      label.className = "chip-label";
      while (chip.firstChild) label.appendChild(chip.firstChild);
      chip.appendChild(label);
    });
    chipRow.classList.add("has-glider");
    settleChipGlider();
    if ("ResizeObserver" in window) {
      var chipSizes = new ResizeObserver(settleChipGlider);
      chipSizes.observe(chipRow);
      chips.forEach(function (chip) { chipSizes.observe(chip); });
    } else {
      window.addEventListener("resize", settleChipGlider);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(settleChipGlider);
  }

  // While every category is listed, the chip for the category passing
  // under the bar lights its border, so the row doubles as a map of where
  // the reader is.
  var chipSpyBand = [];
  var markCurrentChip = function () {
    var current = activeFilter === "all" && chipSpyBand.length ? chipSpyBand[0] : null;
    chips.forEach(function (chip) {
      chip.classList.toggle("is-current", chip.getAttribute("data-filter") === current);
    });
  };
  if (chips.length && catGroups.length && "IntersectionObserver" in window) {
    var chipSpyOrder = Array.prototype.map.call(catGroups, function (group) {
      return group.getAttribute("data-category");
    });
    var chipSpy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var name = entry.target.getAttribute("data-category");
          var at = chipSpyBand.indexOf(name);
          if (entry.isIntersecting && at === -1) chipSpyBand.push(name);
          if (!entry.isIntersecting && at !== -1) chipSpyBand.splice(at, 1);
        });
        chipSpyBand.sort(function (a, b) { return chipSpyOrder.indexOf(a) - chipSpyOrder.indexOf(b); });
        markCurrentChip();
      },
      { rootMargin: "-30% 0px -58% 0px" }
    );
    catGroups.forEach(function (group) { chipSpy.observe(group); });
  }

  // Each category's rule draws itself in, left to right, as the category
  // scrolls up into view.
  if (motionOK) {
    catGroups.forEach(function (group) {
      var head = group.querySelector(".cat-head");
      if (!head) return;
      head.classList.add("has-rule");
      watchScroll(head, function (p) {
        head.style.setProperty("--rule", clamp((p - 0.04) / 0.3, 0, 1).toFixed(3));
      });
    });
  }

  if (modCards.length) {
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        activeFilter = chip.getAttribute("data-filter");
        chips.forEach(function (other) {
          other.setAttribute("aria-pressed", String(other === chip));
        });
        if (chipGlider) {
          placeChipGlider();
          centerChip(chip);
        }
        markCurrentChip();
        refilter(true);
      });
    });

    if (catalogSearch) {
      catalogSearch.addEventListener("input", function () { refilter(false); });
      catalogSearch.addEventListener("keydown", function (event) {
        if (event.key === "Escape" || event.key === "Esc") {
          catalogSearch.value = "";
          refilter(false);
        }
      });
    }
  }

  /* ---------- Conditional form rows ---------- */
  // A row marked data-show-when="field:value|value" appears only while that
  // field holds one of the listed values. Hidden rows are disabled so their
  // required inputs neither block submission nor get sent.
  var conditionalRows = document.querySelectorAll("[data-show-when]");

  var fieldValue = function (formEl, name) {
    var field = formEl.elements[name];
    if (!field) return "";
    if (typeof field.value === "string") return field.value;
    return "";
  };

  var syncConditionalRows = function () {
    conditionalRows.forEach(function (row) {
      var formEl = row.closest("form");
      var rule = row.getAttribute("data-show-when").split(":");
      var allowed = (rule[1] || "").split("|");
      var show = !!formEl && allowed.indexOf(fieldValue(formEl, rule[0])) !== -1;
      row.hidden = !show;
      row.querySelectorAll("input, select, textarea, button").forEach(function (control) {
        control.disabled = !show;
      });
    });
  };

  if (conditionalRows.length) {
    document.querySelectorAll("form").forEach(function (formEl) {
      formEl.addEventListener("change", syncConditionalRows);
    });
  }

  /* ---------- Contact form: interest and the quote summary ---------- */
  var contactForm = document.getElementById("contactForm");

  if (contactForm && contactForm.elements.interest) {
    // Pages link here as contact.html?interest=<slug>.
    var requested = params.get("interest");
    var select = contactForm.elements.interest;
    if (requested) {
      for (var i = 0; i < select.options.length; i++) {
        if (select.options[i].value === requested) {
          select.selectedIndex = i;
          break;
        }
      }
    }
  }

  // Links such as resellers.html?track=company#apply preselect a radio choice.
  document.querySelectorAll("form.js-send input[type='radio']").forEach(function (radio) {
    if (params.get(radio.name) === radio.value) radio.checked = true;
  });

  var quoteItems = document.getElementById("quoteItems");
  // The modules the list showed last time. Only newcomers rise in, so
  // removing one leaves the rest where they are.
  var quoteShown = null;

  // Items rise in one after another once the form has risen into view
  // (the CSS waits for it); --i sets each one's turn.
  var arriveInQuote = function (item, n) {
    if (!motionOK) return;
    item.classList.add("is-arriving");
    item.style.setProperty("--i", String(n));
  };

  // A removed module folds away and the ones after it close the gap.
  var foldAway = function (item) {
    if (!commerceMotion) return null;
    var style = window.getComputedStyle(item);
    var gap = window.getComputedStyle(quoteItems).columnGap;
    var width = item.getBoundingClientRect().width;
    item.classList.add("is-leaving");
    return commerceAnimate(item, [
      {
        width: width + "px", paddingLeft: style.paddingLeft, paddingRight: style.paddingRight,
        borderLeftWidth: style.borderLeftWidth, borderRightWidth: style.borderRightWidth,
        marginRight: "0px", opacity: 1, transform: "scale(1)"
      },
      {
        width: "0px", paddingLeft: "0px", paddingRight: "0px",
        borderLeftWidth: "0px", borderRightWidth: "0px",
        marginRight: gap && gap !== "normal" ? "-" + gap : "0px", opacity: 0, transform: "scale(0.8)"
      }
    ], { duration: 360, easing: COMMERCE_EASE, fill: "forwards" });
  };

  // The license as quote entries: one per module, except that a bundle sold
  // only as a whole (Host Utilities) is a single entry.
  var quoteEntries = function (selected) {
    var entries = [];
    var seen = {};
    selected.forEach(function (id) {
      var sole = soleBundleOf(id);
      var key = sole ? "bundle:" + sole : id;
      if (seen[key]) return;
      seen[key] = true;
      if (sole) {
        var members = bundleMembers(sole);
        entries.push({ key: key, ids: members, name: bundleOf(sole).name + " (" + members.length + " modules)" });
      } else {
        entries.push({ key: key, ids: [id], name: displayName(id) });
      }
    });
    return entries;
  };

  var seatsField = document.getElementById("seats");
  var seatCount = function () {
    var n = seatsField ? parseInt(seatsField.value, 10) : NaN;
    return n > 0 ? n : 1;
  };

  // The founding-price total for the license being quoted, in words.
  var quoteTotalText = function (selected) {
    var seats = seatCount();
    var priced = priceLicense(selected, seats);
    var text = "Founding price: " + priceText(priced.seat, seatUnit());
    if (seats > 1) text += " × " + seats + " seats";
    if (priced.org === null) text += " + " + pendingLabel() + orgUnit();
    else if (priced.org > 0) text += " + " + formatPrice(priced.org) + orgUnit();
    if (isAmount(priced.seat) && priced.org !== null && (seats > 1 || priced.org > 0)) {
      text += " = " + formatPrice(priced.seat * seats + priced.org) + "/yr";
    }
    text += ".";
    if (priced.bundle) {
      text += " Priced as the " + bundleOf(priced.bundle).name + " (" + bundleMembers(priced.bundle).length +
        " modules), which costs less than the modules you chose one by one.";
    }
    if (priced.desktopOnly) text += " That is Nadirion Desktop on its own; it is included with any paid module.";
    text += " Multi-seat, government, and reseller purchases receive a formal quote.";
    return text;
  };

  var renderQuote = function (focusAt) {
    if (!quoteItems || !catalog) return;
    var selected = readSelection();
    var entries = quoteEntries(selected);
    var first = quoteShown === null;

    quoteItems.textContent = "";
    var base = document.createElement("li");
    base.className = "is-base";
    base.textContent = catalog.desktop.name;
    if (first) arriveInQuote(base, 0);
    quoteItems.appendChild(base);

    entries.forEach(function (entry, n) {
      var item = document.createElement("li");
      item.appendChild(document.createTextNode(entry.name));
      var remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", "Remove " + entry.name);
      remove.addEventListener("click", function () {
        if (item.classList.contains("is-leaving")) return;
        writeSelection(readSelection().filter(function (other) { return entry.ids.indexOf(other) === -1; }));
        // Keyboard focus moves on to the next remove button rather than
        // dropping back to the page.
        var refocus = document.activeElement === remove ? n : -1;
        var fold = foldAway(item);
        if (fold) fold.onfinish = function () { renderQuote(refocus); };
        else renderQuote(refocus);
      });
      item.appendChild(remove);
      if (first || quoteShown.indexOf(entry.key) === -1) arriveInQuote(item, n + 1);
      quoteItems.appendChild(item);
    });
    quoteShown = entries.map(function (entry) { return entry.key; });

    if (typeof focusAt === "number" && focusAt >= 0) {
      var removers = quoteItems.querySelectorAll("button");
      var next = removers[Math.min(focusAt, removers.length - 1)] ||
        document.querySelector(".quote-box-head a");
      if (next) next.focus();
    }

    var empty = document.getElementById("quoteEmpty");
    if (empty) empty.hidden = selected.length > 0;

    var totalEl = document.getElementById("quoteTotal");
    if (totalEl) {
      totalEl.hidden = false;
      totalEl.textContent = quoteTotalText(selected);
    }

    var field = document.getElementById("quoteModules");
    if (field) {
      field.value = [catalog.desktop.name].concat(
        entries.map(function (entry) { return entry.name; })
      ).join(", ");
    }
  };

  // The total follows the seat count as it is typed.
  if (seatsField && quoteItems) {
    seatsField.addEventListener("input", function () {
      var totalEl = document.getElementById("quoteTotal");
      if (totalEl && catalog) totalEl.textContent = quoteTotalText(readSelection());
    });
  }

  renderQuote();
  syncConditionalRows();
  // Back from the catalog, the browser may restore this page as it was;
  // list the license as it is now.
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) renderQuote();
  });

  /* ---------- Sending forms ---------- */
  // Each form posts to its data-endpoint when one is configured (any service
  // that accepts a form POST and answers 2xx). Without one, the message is
  // handed to the visitor's email app, addressed to data-to, so nothing is
  // ever reported as sent when it was not.
  var labelFor = function (control) {
    var text = "";
    if (control.type === "radio") {
      var legend = control.closest("fieldset") && control.closest("fieldset").querySelector("legend");
      text = legend ? legend.textContent : control.name;
    } else if (control.getAttribute("data-label")) {
      text = control.getAttribute("data-label");
    } else {
      var label = control.id && document.querySelector('label[for="' + control.id + '"]');
      text = label ? label.textContent : control.name;
    }
    return text.replace(/\(optional\)/i, "").replace(/\s+/g, " ").trim();
  };

  var valueFor = function (control) {
    if (control.tagName === "SELECT") {
      return control.options[control.selectedIndex].text;
    }
    if (control.type === "radio") {
      var label = control.closest("label");
      var strong = label && label.querySelector("strong");
      return strong ? strong.textContent.trim() : control.value;
    }
    return control.value.trim();
  };

  var describeForm = function (formEl) {
    var lines = [];
    Array.prototype.forEach.call(formEl.elements, function (control) {
      if (!control.name || control.disabled || control.type === "submit") return;
      if (control.type === "radio" && !control.checked) return;
      var value = valueFor(control);
      if (value) lines.push(labelFor(control) + ": " + value);
    });
    return lines.join("\n\n");
  };

  var subjectFor = function (formEl) {
    var subject = formEl.getAttribute("data-subject") || "Website inquiry";
    var topicName = formEl.getAttribute("data-subject-field");
    if (!topicName) return subject;
    var topic = formEl.querySelector(
      'select[name="' + topicName + '"], [name="' + topicName + '"]:checked'
    );
    return topic ? subject + ": " + valueFor(topic) : subject;
  };

  document.querySelectorAll("form.js-send").forEach(function (formEl) {
    var statusEl = formEl.querySelector(".form-status");

    var say = function (message, ok) {
      if (!statusEl) return;
      statusEl.textContent = message;
      statusEl.classList.toggle("is-success", !!ok);
      // Each new message rises in, so a repeated one still reads as new.
      commerceAnimate(statusEl, [
        { opacity: 0, transform: "translate3d(0, 6px, 0)" },
        { opacity: 1, transform: "none" }
      ], { duration: 420, easing: COMMERCE_EASE });
    };

    formEl.addEventListener("submit", function (event) {
      event.preventDefault();

      if (!formEl.checkValidity()) {
        say("Please fill in all required fields.", false);
        var invalid = formEl.querySelector(":invalid");
        if (invalid) invalid.focus();
        return;
      }

      var to = formEl.getAttribute("data-to") || "contact@nadirion.us";
      var subject = subjectFor(formEl);
      var body = describeForm(formEl);
      var mailto = "mailto:" + to + "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);
      var name = formEl.elements.name ? formEl.elements.name.value.trim() : "";
      var endpoint = formEl.getAttribute("data-endpoint");

      if (!endpoint) {
        window.location.href = mailto;
        say(
          "Your email app should now open with this message ready to send. " +
            "If nothing opened, write to " + to + " and we'll take it from there.",
          true
        );
        return;
      }

      // While it sends, light keeps sweeping across the button.
      var button = formEl.querySelector('[type="submit"]');
      if (button) {
        button.disabled = true;
        button.classList.add("is-sending");
      }
      say("Sending…", false);

      var data = new FormData(formEl);
      data.append("_subject", subject);

      fetch(endpoint, { method: "POST", body: data, headers: { Accept: "application/json" } })
        .then(function (response) {
          if (!response.ok) throw new Error("HTTP " + response.status);
          say(
            "Thank you" + (name ? ", " + name : "") + ". Your message is with the Nadirion team " +
              "and someone will follow up by email.",
            true
          );
          formEl.reset();
          syncConditionalRows();
          renderQuote();
        })
        .catch(function () {
          say("That didn't go through. Please try again, or email " + to + " directly.", false);
        })
        .then(function () {
          if (!button) return;
          button.disabled = false;
          button.classList.remove("is-sending");
        });
    });
  });
})();
