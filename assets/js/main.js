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
  var countUp = function (stat, delay) {
    var el = stat.querySelector("strong");
    var text = el ? el.textContent.trim() : "";
    if (!/^\d+$/.test(text)) return;

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
      if (t < 1) window.requestAnimationFrame(tick);
      else el.textContent = text;
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
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 }
    );
    revealTargets.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------- Hero parallax ---------- */
  // --hero-p runs from 0 at the top of the page to 1 once the hero has
  // scrolled away; the CSS turns it into depth.
  var hero = document.querySelector(".hero");
  if (hero && motionOK) {
    var heroHeight = hero.offsetHeight;
    var lastHeroP = -1;
    window.addEventListener("resize", function () { heroHeight = hero.offsetHeight; });
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
  // the scroll, so the sky has parallax. A sky stops drawing while it is off
  // screen or the tab is hidden.
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
      var scrolled = reduceMotion ? 0 : Math.max(0, window.scrollY - hostTop);
      sway.x += (skyPointer.x - sway.x) * 0.04;
      sway.y += (skyPointer.y - sway.y) * 0.04;

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
  // --my), and the home page's product window tilts toward it.
  var SPOTLIT = ".focus-card, .related-card, .mod-card, .plan, .track, .sector, .steps, .module-grid";
  var heroWindow = document.querySelector(".hero .app-window");

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

      if (lit) {
        lit.style.setProperty("--mx", (event.clientX - litBox.left).toFixed(1) + "px");
        lit.style.setProperty("--my", (event.clientY - litBox.top).toFixed(1) + "px");
      }
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
      ["misp", "IOC Vault"],
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
  // Scrolling pushes it along, and scrolling back up pushes it backward.
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
  // fx-heroes: reserved


  /* ---------- Type [fx-type] ---------- */
  // fx-type: reserved


  /* ---------- Scroll choreography [fx-scroll] ---------- */
  // fx-scroll: reserved


  /* ---------- Frame: header, footer, wayfinding [fx-frame] ---------- */
  // fx-frame: reserved


  /* ---------- Surfaces [fx-surfaces] ---------- */
  // fx-surfaces: reserved


  /* ---------- Catalog and commerce [fx-commerce] ---------- */
  // fx-commerce: reserved


  // Set the scroll-driven state for wherever the page opened.
  runScrollHooks();

  /* ---------- Catalog, prices, and the license being built ---------- */
  var catalog = window.NADIRION_CATALOG || null;
  var params = new URLSearchParams(window.location.search);

  var isKnownModule = function (id) {
    return !!(catalog && Object.prototype.hasOwnProperty.call(catalog.modules, id));
  };

  var priceOf = function (id) {
    if (!catalog) return null;
    var item = id === "desktop" ? catalog.desktop : catalog.modules[id];
    return item && typeof item.price === "number" ? item.price : null;
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

  // Only priced items get a price on the page; quoted items keep the HTML's own text.
  document.querySelectorAll("[data-price-for]").forEach(function (el) {
    var price = priceOf(el.getAttribute("data-price-for"));
    if (price === null) return;
    el.textContent = formatPrice(price);
    el.hidden = false;
  });
  document.querySelectorAll("[data-unit-for]").forEach(function (el) {
    if (priceOf(el.getAttribute("data-unit-for")) === null) return;
    el.textContent = catalog.priceUnit || "";
  });

  // The selection lives in localStorage so it survives the walk from the
  // catalog to the quote form. Storage can be missing or throw (private
  // windows, blocked site data), so an in-memory copy backs it up.
  var LICENSE_KEY = "nadirion.license.modules";
  var memorySelection = [];

  var readSelection = function () {
    var list = memorySelection;
    try {
      var raw = window.localStorage.getItem(LICENSE_KEY);
      if (raw) list = JSON.parse(raw);
    } catch (e) { /* fall back to memory */ }
    if (!Array.isArray(list)) return [];
    return list.filter(function (id, index) {
      return isKnownModule(id) && list.indexOf(id) === index;
    });
  };

  var writeSelection = function (list) {
    memorySelection = list.slice();
    try {
      window.localStorage.setItem(LICENSE_KEY, JSON.stringify(list));
    } catch (e) { /* memory copy is enough for this page */ }
  };

  var licenseTotal = function (list) {
    var total = priceOf("desktop");
    if (total === null) return null;
    for (var i = 0; i < list.length; i++) {
      var price = priceOf(list[i]);
      if (price === null) return null;
      total += price;
    }
    return total;
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
    writeSelection(
      params.get("modules").split(",").filter(function (id, index, all) {
        return isKnownModule(id) && all.indexOf(id) === index;
      })
    );
  }

  /* ---------- Module catalog: add to license ---------- */
  var addButtons = document.querySelectorAll(".mod-add[data-module]");
  var tray = document.getElementById("licenseTray");

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
    tray.classList.toggle("is-visible", visible);
    document.body.classList.toggle("has-tray", visible);

    var summary = document.getElementById("traySummary");
    if (summary) {
      var count = document.createElement("strong");
      count.textContent = plural(selected.length, "add-on module");
      summary.textContent = "Nadirion Desktop + ";
      summary.appendChild(count);
    }
    var totalEl = document.getElementById("trayTotal");
    if (totalEl) {
      var total = licenseTotal(selected);
      totalEl.hidden = total === null;
      if (total !== null) totalEl.textContent = formatPrice(total) + " " + (catalog.priceUnit || "");
    }
    var cta = document.getElementById("trayCta");
    if (cta) cta.setAttribute("href", quoteHref(selected));
  };

  if (catalog && addButtons.length) {
    addButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var id = button.getAttribute("data-module");
        var selected = readSelection();
        var at = selected.indexOf(id);
        if (at === -1) selected.push(id);
        else selected.splice(at, 1);
        writeSelection(selected);
        renderSelection();
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

  // After the result set changes, bring its first row into view if the
  // reader has already scrolled past the top of the catalog.
  var returnToCatalogTop = function () {
    var bar = document.querySelector(".catalog-bar");
    if (!bar) return;
    var top = bar.parentElement.getBoundingClientRect().top + window.scrollY - 72;
    if (window.scrollY > top) {
      window.scrollTo({ top: top, behavior: reduceMotion ? "auto" : "smooth" });
    }
  };

  if (modCards.length) {
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        activeFilter = chip.getAttribute("data-filter");
        chips.forEach(function (other) {
          other.setAttribute("aria-pressed", String(other === chip));
        });
        applyFilter();
        returnToCatalogTop();
      });
    });

    if (catalogSearch) {
      catalogSearch.addEventListener("input", applyFilter);
      catalogSearch.addEventListener("keydown", function (event) {
        if (event.key === "Escape" || event.key === "Esc") {
          catalogSearch.value = "";
          applyFilter();
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

  var renderQuote = function () {
    if (!quoteItems || !catalog) return;
    var selected = readSelection();

    quoteItems.textContent = "";
    var base = document.createElement("li");
    base.className = "is-base";
    base.textContent = catalog.desktop.name;
    quoteItems.appendChild(base);

    selected.forEach(function (id) {
      var item = document.createElement("li");
      item.appendChild(document.createTextNode(catalog.modules[id].name));
      var remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", "Remove " + catalog.modules[id].name);
      remove.addEventListener("click", function () {
        writeSelection(readSelection().filter(function (other) { return other !== id; }));
        renderQuote();
      });
      item.appendChild(remove);
      quoteItems.appendChild(item);
    });

    var empty = document.getElementById("quoteEmpty");
    if (empty) empty.hidden = selected.length > 0;

    var totalEl = document.getElementById("quoteTotal");
    if (totalEl) {
      var total = licenseTotal(selected);
      totalEl.hidden = total === null;
      if (total !== null) {
        totalEl.textContent = "List price: " + formatPrice(total) + " " + (catalog.priceUnit || "");
      }
    }

    var field = document.getElementById("quoteModules");
    if (field) {
      field.value = [catalog.desktop.name].concat(
        selected.map(function (id) { return catalog.modules[id].name; })
      ).join(", ");
    }
  };

  renderQuote();
  syncConditionalRows();

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
    var subject = formEl.getAttribute("data-subject") || "Website enquiry";
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

      var button = formEl.querySelector('[type="submit"]');
      if (button) button.disabled = true;
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
          if (button) button.disabled = false;
        });
    });
  });
})();
