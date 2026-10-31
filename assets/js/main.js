(function () {
  "use strict";

  var root = document.documentElement;

  // Lets CSS hide controls that only work with the script running. boot.js
  // already set it before first paint; this keeps pages without it working.
  root.classList.add("js");

  // matchMedia lists gained addEventListener late in Safari (14).
  var onMediaChange = function (query, handler) {
    if (!query) return;
    if (query.addEventListener) query.addEventListener("change", handler);
    else if (query.addListener) query.addListener(handler);
  };

  var motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var reduceMotion = !!(motionQuery && motionQuery.matches);

  // Announces a message through a role="status" element. Clearing it first
  // makes a repeat of the same text announce again.
  var makeAnnouncer = function (el) {
    var timer = 0;
    return function (message, delay) {
      if (!el) return;
      window.clearTimeout(timer);
      el.textContent = "";
      if (message) timer = window.setTimeout(function () { el.textContent = message; }, delay || 60);
    };
  };

  /* ---------- Header state ---------- */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 12);
    };
    // The first check waits until after the first frame, so reading the
    // scroll position does not force a layout while the script starts.
    window.requestAnimationFrame(function () { window.setTimeout(onScroll, 0); });
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Mobile navigation ---------- */
  var navToggle = document.getElementById("navToggle");
  var primaryNav = document.getElementById("primaryNav");
  var capsGroup = document.getElementById("capsGroup");
  var capsToggle = document.getElementById("capsToggle");
  // Matches the stylesheet's breakpoint for the folded menu.
  var narrowNav = window.matchMedia ? window.matchMedia("(max-width: 960px)") : null;

  var setCaps = function (open) {
    if (!capsGroup || !capsToggle) return;
    capsGroup.classList.toggle("is-open", open);
    capsToggle.setAttribute("aria-expanded", String(open));
  };
  var capsOpen = function () {
    return !!capsToggle && capsToggle.getAttribute("aria-expanded") === "true";
  };

  var navOpen = function () {
    return !!primaryNav && primaryNav.classList.contains("is-open");
  };
  var setNav = function (open) {
    if (!navToggle || !primaryNav) return;
    primaryNav.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    root.classList.toggle("nav-open", open);
    if (!open) setCaps(false);
  };

  if (navToggle && primaryNav) {
    navToggle.addEventListener("click", function () {
      setNav(!navOpen());
    });

    primaryNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () { setNav(false); });
    });

    // A tap outside the header only dismisses the open menu; it does not also
    // follow whatever link sat underneath.
    document.addEventListener("click", function (event) {
      if (!navOpen() || (header && header.contains(event.target))) return;
      event.preventDefault();
      event.stopPropagation();
      setNav(false);
    }, true);

    if (header) {
      header.addEventListener("focusout", function (event) {
        if (navOpen() && event.relatedTarget && !header.contains(event.relatedTarget)) setNav(false);
      });
    }

    onMediaChange(narrowNav, function (event) {
      if (!event.matches) setNav(false);
    });
  }

  /* ---------- Services menu ---------- */
  if (capsGroup && capsToggle) {
    capsToggle.addEventListener("click", function () {
      setCaps(!capsOpen());
    });

    capsGroup.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () { setCaps(false); });
    });

    document.addEventListener("click", function (event) {
      if (!capsGroup.contains(event.target)) setCaps(false);
    });

    // On wide screens the menu floats over the page, so it closes once focus
    // moves on. Inside the folded mobile menu it is an ordinary expanded
    // section and stays open.
    capsGroup.addEventListener("focusout", function (event) {
      if (narrowNav && narrowNav.matches) return;
      if (event.relatedTarget && !capsGroup.contains(event.relatedTarget)) setCaps(false);
    });
  }

  // Escape closes the innermost open menu. Focus moves only when it was
  // inside the menu that just closed; otherwise Escape leaves it alone.
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" && event.key !== "Esc") return;
    var active = document.activeElement;
    if (capsOpen()) {
      var inCaps = !!capsGroup && capsGroup.contains(active);
      setCaps(false);
      if (inCaps) capsToggle.focus();
    } else if (navOpen()) {
      var inNav = primaryNav.contains(active);
      setNav(false);
      if (inNav) navToggle.focus();
    }
  });

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Reveal on scroll ---------- */
  // Content already on screen at load paints in its final state; only what is
  // still below the fold fades in, staggered with whatever enters beside it.
  var revealTargets = document.querySelectorAll(
    ".section-head, .page-hero-copy, .page-hero-glyph, .stat, .focus-card, .toolkit-showcase, " +
      ".module, .service, .step, .table-scroll, .spec-note, .program-status, .about-copy, " +
      ".about-visual, .sector, .related-card, .cta-inner, .contact-copy, .contact-form, " +
      ".contact-more, .plan, .track, .app-window"
  );
  if ("IntersectionObserver" in window && !reduceMotion && revealTargets.length) {
    var revealer = new IntersectionObserver(
      function (entries) {
        var order = 0;
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          var delay = Math.min(order++, 3) * 80;
          if (delay) {
            el.style.transitionDelay = delay + "ms";
            // Drop the delay afterwards so hover transitions are not held back.
            window.setTimeout(function () { el.style.transitionDelay = ""; }, delay + 800);
          }
          el.classList.add("is-visible");
          revealer.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 }
    );
    var sorter = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        sorter.unobserve(entry.target);
        if (entry.isIntersecting) return;
        entry.target.classList.add("reveal");
        revealer.observe(entry.target);
      });
    });
    revealTargets.forEach(function (el) { sorter.observe(el); });
  }

  /* ---------- Printing ---------- */
  // A printout shows everything. Closed answers open for the print and close
  // again afterwards. The reveal ends for good: content still waiting to fade
  // in, or caught mid-fade, prints at full strength.
  var openedForPrint = [];
  window.addEventListener("beforeprint", function () {
    document.querySelectorAll("details:not([open])").forEach(function (details) {
      details.open = true;
      openedForPrint.push(details);
    });
    if (sorter) sorter.disconnect();
    if (revealer) revealer.disconnect();
    document.querySelectorAll(".reveal").forEach(function (el) {
      el.style.transitionDelay = "";
      el.classList.remove("reveal");
      // A fade already under way would otherwise carry on into the print.
      if (el.getAnimations) {
        el.getAnimations().forEach(function (animation) {
          if (animation.transitionProperty) animation.finish();
        });
      }
    });
  });
  window.addEventListener("afterprint", function () {
    openedForPrint.forEach(function (details) { details.open = false; });
    openedForPrint = [];
  });

  /* ---------- Wide tables ---------- */
  // A table's scrolling wrapper is a tab stop, so the keyboard can scroll it,
  // only while it is actually wider than its box. On phones the rows stack
  // into cards that fit, and the stop would lead nowhere.
  var tableScrolls = document.querySelectorAll(".table-scroll");

  var syncTableStop = function (wrap) {
    var scrolls = /auto|scroll/.test(window.getComputedStyle(wrap).overflowX) &&
      wrap.scrollWidth - wrap.clientWidth > 1;
    if (scrolls) wrap.setAttribute("tabindex", "0");
    // A wrapper that has focus keeps it; the blur handler checks again.
    else if (document.activeElement !== wrap) wrap.removeAttribute("tabindex");
  };
  var syncTableStops = function () { tableScrolls.forEach(syncTableStop); };

  if (tableScrolls.length) {
    tableScrolls.forEach(function (wrap) {
      wrap.addEventListener("blur", function () { syncTableStop(wrap); });
    });
    // The table is observed too: a web font arriving widens it, not the box.
    if (window.ResizeObserver) {
      var tableObserver = new ResizeObserver(syncTableStops);
      tableScrolls.forEach(function (wrap) {
        tableObserver.observe(wrap);
        if (wrap.firstElementChild) tableObserver.observe(wrap.firstElementChild);
      });
    } else {
      var tableTimer = 0;
      window.addEventListener("resize", function () {
        window.clearTimeout(tableTimer);
        tableTimer = window.setTimeout(syncTableStops, 150);
      });
      window.addEventListener("load", syncTableStops);
      syncTableStops();
    }
  }

  /* ---------- Motion preference ---------- */
  // Reduced-motion visitors start paused. The home page's toggle overrides
  // that either way, and the choice is kept in localStorage (privacy.html
  // names this key; update it there if it changes).
  var MOTION_KEY = "nadirion.motion";
  var motionChoice = null;
  try {
    motionChoice = window.localStorage.getItem(MOTION_KEY);
  } catch (e) { /* storage blocked: follow the system setting */ }
  var motionPaused = motionChoice === "paused" || (motionChoice !== "running" && reduceMotion);
  var motionListeners = [];
  var motionToggle = document.getElementById("motionToggle");

  var setMotionPaused = function (paused, remember) {
    motionPaused = paused;
    root.classList.toggle("motion-paused", paused);
    if (motionToggle) motionToggle.textContent = paused ? "Resume motion" : "Pause motion";
    if (remember) {
      motionChoice = paused ? "paused" : "running";
      try {
        window.localStorage.setItem(MOTION_KEY, motionChoice);
      } catch (e) { /* the choice lasts for this page only */ }
    }
    motionListeners.forEach(function (listener) { listener(); });
  };

  if (motionToggle) {
    // The visible label says what the button will do, so it carries no
    // pressed state as well ("Resume motion, pressed" reads as a contradiction).
    motionToggle.removeAttribute("aria-pressed");
    motionToggle.addEventListener("click", function () {
      setMotionPaused(!motionPaused, true);
    });
  }

  // A system setting changed mid-visit wins over an earlier "running" choice,
  // but never restarts motion the visitor paused themselves.
  onMediaChange(motionQuery, function (event) {
    reduceMotion = event.matches;
    if (reduceMotion) setMotionPaused(true, false);
    else if (motionChoice !== "paused") setMotionPaused(false, false);
  });

  setMotionPaused(motionPaused, false);

  /* ---------- Starfield ---------- */
  // Draws only while the hero is on screen, the tab is visible and motion is
  // not paused; otherwise it holds a still frame. Movement is time-based, so
  // it runs at the same speed on any refresh rate.
  var canvas = document.getElementById("starfield");
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext("2d");
    var dpr = 1;
    var width = 0, height = 0;
    var stars = [];
    var streak = null;
    var clock = 0;           // milliseconds of motion actually shown
    var lastTime = 0;
    var nextStreakAt = 2500;
    var rafId = null;
    var inView = true;
    var loaded = document.readyState === "complete";

    var makeStar = function (x, y) {
      return {
        x: x,
        y: y,
        r: 0.3 + Math.random() * 1.1,
        a: 0.15 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        speed: 0.0006 + Math.random() * 0.0016,
        drift: 0.006 + Math.random() * 0.014
      };
    };

    // Keeps the stars already placed and fills or trims only the area that
    // changed, so a phone toolbar showing or hiding never reshuffles the sky.
    var fitStars = function (oldW, oldH) {
      stars = stars.filter(function (s) { return s.x <= width && s.y <= height + 2; });
      var count = Math.round((width * height) / 5200);
      while (stars.length > count) stars.pop();
      // New stars go only where the canvas grew: the strip right of the old
      // width and the strip below the old height (the whole canvas at first).
      var keptW = Math.min(width, oldW);
      var right = Math.max(0, width - oldW) * height;
      var below = Math.max(0, height - oldH) * keptW;
      while (stars.length < count) {
        if (!right && !below) {
          stars.push(makeStar(Math.random() * width, Math.random() * height));
        } else if (Math.random() * (right + below) < right) {
          stars.push(makeStar(oldW + Math.random() * (width - oldW), Math.random() * height));
        } else {
          stars.push(makeStar(Math.random() * keptW, oldH + Math.random() * (height - oldH)));
        }
      }
    };

    var paint = function () {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgb(235, 235, 240)";
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        ctx.globalAlpha = s.a * (0.65 + 0.35 * Math.sin(s.phase + clock * s.speed));
        if (s.r < 0.9) {
          // A square of the same area reads as a dot at this size and is far
          // cheaper than an arc.
          var d = s.r * 1.77;
          ctx.fillRect(s.x - d / 2, s.y - d / 2, d, d);
        } else {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

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
      }
    };

    var spawnStreak = function () {
      streak = {
        x: width * (0.35 + Math.random() * 0.6),
        y: height * (0.05 + Math.random() * 0.35),
        vx: -(3.5 + Math.random() * 2.5),
        vy: 1.4 + Math.random() * 1.2,
        life: 0,
        maxLife: 55 + Math.random() * 25
      };
      nextStreakAt = clock + 7000 + Math.random() * 9000;
    };

    // steps: elapsed time in 60fps frames, the unit every speed above uses.
    var advance = function (steps) {
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.y -= s.drift * steps;
        if (s.y < -2) { s.y = height + 2; s.x = Math.random() * width; }
      }
      if (!streak && clock > nextStreakAt) spawnStreak();
      if (streak) {
        streak.x += streak.vx * steps;
        streak.y += streak.vy * steps;
        streak.life += steps;
        if (streak.life > streak.maxLife) streak = null;
      }
    };

    var frame = function (time) {
      rafId = window.requestAnimationFrame(frame);
      if (!lastTime) lastTime = time;
      var elapsed = time - lastTime;
      // Between shooting stars the sky changes slowly; about 30fps is plenty.
      if (elapsed < (streak ? 1 : 30)) return;
      lastTime = time;
      elapsed = Math.min(elapsed, 50);
      clock += elapsed;
      advance(elapsed / 16.67);
      paint();
    };

    var update = function () {
      var run = loaded && !motionPaused && inView && !document.hidden;
      if (run && !rafId) {
        lastTime = 0;
        rafId = window.requestAnimationFrame(frame);
      } else if (!run && rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    var resize = function (w, h) {
      w = Math.round(w);
      h = Math.round(h);
      // Phones draw at 1x: their CPUs are the weakest, and their pixels too
      // small to show the difference on dots this size. Elsewhere 1.5x at most.
      var nextDpr = Math.min(window.devicePixelRatio || 1, w <= 720 ? 1 : 1.5);
      if (w === width && h === height && nextDpr === dpr) return;
      var oldW = width, oldH = height;
      dpr = nextDpr;
      width = w;
      height = h;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fitStars(oldW, oldH);
      paint(); // a new backing size clears the canvas
    };

    // ResizeObserver reports after layout, so sizing never forces one; it
    // also reports the first size as soon as it starts observing.
    if (window.ResizeObserver) {
      new ResizeObserver(function (entries) {
        var box = entries[entries.length - 1].contentRect;
        resize(box.width, box.height);
      }).observe(canvas);
    } else {
      var resizeQueued = false;
      var measure = function () {
        resizeQueued = false;
        resize(canvas.clientWidth, canvas.clientHeight);
      };
      window.addEventListener("resize", function () {
        if (resizeQueued) return;
        resizeQueued = true;
        window.requestAnimationFrame(measure);
      });
      window.requestAnimationFrame(measure);
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[entries.length - 1].isIntersecting;
        update();
      }).observe(canvas);
    }

    document.addEventListener("visibilitychange", update);

    motionListeners.push(function () {
      if (motionPaused && streak) {
        // A shooting star frozen mid-flight looks like a glitch.
        streak = null;
        if (width) paint();
      }
      update();
    });

    // The first frames would only compete with the page's own loading.
    if (!loaded) {
      window.addEventListener("load", function () {
        loaded = true;
        update();
      });
    }
    update();
  }

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
  // privacy.html names this key; update it there if it changes.
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

  var moduleName = function (id) {
    return isKnownModule(id) ? catalog.modules[id].name : id;
  };

  var licenseSummary = function (list) {
    var base = catalog ? catalog.desktop.name : "Nadirion Desktop";
    return list.length ? base + " and " + plural(list.length, "add-on module") : base + " only";
  };

  // The tray's quote link carries the selection in the URL too, in case
  // storage was unavailable on the catalog page. Only the contact page reads
  // it, and only once: the parameter then leaves the address, so a reload or
  // a shared link cannot bring back modules the visitor has since removed,
  // and a list of unknown ids never wipes the stored selection.
  if (catalog && params.has("modules") && document.getElementById("quoteItems")) {
    var fromUrl = (params.get("modules") || "").split(",").filter(function (id, index, all) {
      return isKnownModule(id) && all.indexOf(id) === index;
    });
    if (fromUrl.length) writeSelection(fromUrl);
    params.delete("modules");
    if (window.history && window.history.replaceState) {
      var query = params.toString();
      try {
        window.history.replaceState(
          window.history.state,
          "",
          window.location.pathname + (query ? "?" + query : "") + window.location.hash
        );
      } catch (e) { /* the address keeps the parameter; harmless */ }
    }
  }

  /* ---------- Module catalog: add to license ---------- */
  var addButtons = document.querySelectorAll(".mod-add[data-module]");
  var tray = document.getElementById("licenseTray");
  var announceCatalog = makeAnnouncer(document.getElementById("catalogStatus"));
  var catalogSearch = document.getElementById("catalogSearch");
  var chips = document.querySelectorAll(".chip[data-filter]");

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
        announceCatalog(
          moduleName(id) + (at === -1 ? " added." : " removed.") +
            " Your license: " + licenseSummary(selected) + "."
        );
      });
    });

    var trayClear = document.getElementById("trayClear");
    if (trayClear) {
      trayClear.addEventListener("click", function (event) {
        writeSelection([]);
        renderSelection();
        announceCatalog("License cleared.");
        // The tray hides, so focus would fall to the page itself. A keyboard
        // press lands in the search; a tap lands on the active category chip
        // instead, which does not pop up a phone's keyboard.
        var activeChip = document.querySelector('.chip[aria-pressed="true"]');
        var target = event.detail === 0 && catalogSearch ? catalogSearch : activeChip || catalogSearch;
        if (target) target.focus();
      });
    }

    renderSelection();
  }

  /* ---------- Module catalog: search and category filter ---------- */
  var modCards = document.querySelectorAll(".mod-card[data-category]");
  var catGroups = document.querySelectorAll(".cat-group[data-category]");
  var catalogEmpty = document.getElementById("catalogEmpty");
  var emptyReason = document.getElementById("catalogEmptyReason");
  var emptyNext = document.getElementById("catalogEmptyNext");
  var emptyNextText = emptyNext ? emptyNext.textContent : "";
  var allChip = document.querySelector('.chip[data-filter="all"]');
  var activeFilter = "all";
  var activeName = "";

  // What a search matches: the card's own words and aliases, never its
  // button or link text (otherwise "license" or "add" match every card).
  // Only cards with an add button are add-ons on sale; the "In development"
  // previews are counted apart, so totals agree with the page's own count.
  var haystacks = [];
  var forSale = [];
  modCards.forEach(function (card, index) {
    var words = [];
    card.querySelectorAll("h3, p, .focus-points li, .mod-tags li, .mod-code").forEach(function (node) {
      words.push(node.textContent);
    });
    words.push(card.getAttribute("data-aliases") || "");
    haystacks[index] = words.join(" ").replace(/\s+/g, " ").toLowerCase();
    forSale[index] = !!card.querySelector(".mod-add");
  });

  var selectChip = function (chip) {
    activeFilter = chip.getAttribute("data-filter");
    activeName = activeFilter === "all" ? "" : chip.textContent.replace(/\s+/g, " ").trim();
    chips.forEach(function (other) {
      other.setAttribute("aria-pressed", String(other === chip));
    });
  };

  // Offered when the active category hides matches that other categories have.
  var showAllButton = null;
  var makeShowAllButton = function () {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = "Show all categories";
    button.addEventListener("click", function () {
      if (!allChip) return;
      selectChip(allChip);
      applyFilter();
      // The message and this button hide, so focus goes to the chip now pressed.
      allChip.focus();
      returnToCatalogTop();
    });
    return button;
  };

  // delay: how long to wait before announcing the result, longer while typing.
  var applyFilter = function (delay) {
    var terms = (catalogSearch ? catalogSearch.value : "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    var addOns = 0;     // shown cards on sale
    var previews = 0;   // shown cards still in development
    var elsewhere = 0;  // matches the active category hides

    modCards.forEach(function (card, index) {
      var inCategory = activeFilter === "all" || card.getAttribute("data-category") === activeFilter;
      var matches = terms.every(function (term) { return haystacks[index].indexOf(term) !== -1; });
      card.hidden = !(inCategory && matches);
      if (card.hidden) {
        if (matches) elsewhere++;
      } else if (forSale[index]) {
        addOns++;
      } else {
        previews++;
      }
    });

    catGroups.forEach(function (group) {
      group.hidden = !group.querySelector(".mod-card:not([hidden])");
    });

    var message;
    if (addOns) {
      message = "Showing " + plural(addOns, "add-on module") +
        (previews ? " and " + previews + " in development" : "") + ".";
    } else if (elsewhere && allChip) {
      message = "No " + activeName + " module matches that search, but " + elsewhere +
        (elsewhere === 1 ? " in another category does." : " in other categories do.");
    } else if (previews) {
      message = "No add-on module matches that search, but " + previews +
        " in development " + (previews === 1 ? "does." : "do.");
    } else {
      message = "No module matches that search.";
    }

    if (catalogEmpty) {
      catalogEmpty.hidden = addOns > 0;
      if (!addOns && emptyReason) emptyReason.textContent = message;
      if (!addOns && emptyNext) {
        emptyNext.textContent = "";
        if (elsewhere && allChip) {
          showAllButton = showAllButton || makeShowAllButton();
          emptyNext.appendChild(showAllButton);
          emptyNext.appendChild(document.createTextNode(" or"));
        } else {
          emptyNext.textContent = emptyNextText;
        }
      }
    }
    announceCatalog(message, delay);
  };

  // Height of the header when it stays pinned over the page, else 0.
  var headerOffset = function () {
    if (!header) return 0;
    var position = window.getComputedStyle(header).position;
    return position === "sticky" || position === "fixed" ? header.offsetHeight : 0;
  };

  // After the result set changes, bring its first row into view if the
  // reader has already scrolled past the top of the catalog.
  var returnToCatalogTop = function () {
    var bar = document.querySelector(".catalog-bar");
    if (!bar) return;
    var top = bar.parentElement.getBoundingClientRect().top + window.scrollY - headerOffset();
    if (window.scrollY > top) {
      window.scrollTo({ top: top, behavior: reduceMotion ? "auto" : "smooth" });
    }
  };

  if (modCards.length) {
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        selectChip(chip);
        applyFilter();
        returnToCatalogTop();
      });
    });

    // On narrow screens the chips scroll sideways under an edge fade; keep
    // the focused one fully in view.
    var chipRow = document.querySelector(".chip-row");
    if (chipRow) {
      chipRow.addEventListener("focusin", function (event) {
        if (chipRow.scrollWidth > chipRow.clientWidth && event.target.scrollIntoView) {
          event.target.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
      });
    }

    if (catalogSearch) {
      catalogSearch.addEventListener("input", function () { applyFilter(400); });
      catalogSearch.addEventListener("keydown", function (event) {
        if ((event.key === "Escape" || event.key === "Esc") && catalogSearch.value) {
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
  var announceQuote = makeAnnouncer(document.getElementById("quoteStatus"));

  var renderQuote = function () {
    if (!quoteItems || !catalog) return;
    var selected = readSelection();

    quoteItems.textContent = "";
    var base = document.createElement("li");
    base.className = "is-base";
    base.textContent = catalog.desktop.name;
    quoteItems.appendChild(base);

    selected.forEach(function (id) {
      var name = catalog.modules[id].name;
      var item = document.createElement("li");
      item.appendChild(document.createTextNode(name));
      var remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", "Remove " + name);
      remove.addEventListener("click", function () {
        // Rebuilding the list destroys this button, so focus moves to the
        // next one (or the previous, or "Edit modules" once none are left).
        var at = Array.prototype.indexOf.call(quoteItems.querySelectorAll("button"), remove);
        writeSelection(readSelection().filter(function (other) { return other !== id; }));
        renderQuote();
        var left = quoteItems.querySelectorAll("button");
        var next = left[Math.min(at, left.length - 1)] || document.querySelector(".quote-box-head a");
        if (next) next.focus();
        announceQuote(name + " removed from your license.");
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
  // that accepts a form POST and answers 2xx). The pages' CSP allows
  // connect-src 'self' only, so the endpoint must be on this site, or its
  // origin must be added to connect-src in every page's CSP and in _headers.
  // Without an endpoint, the message is handed to the visitor's email app,
  // addressed to data-to. Nothing is ever reported as sent when it was not.
  var SEND_TIMEOUT = 15000;

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
    // "How can we help?" reads as "How can we help: ..." in the email body.
    return text.replace(/\(optional\)/i, "").replace(/\s+/g, " ").trim().replace(/[?:.]+$/, "");
  };

  var valueFor = function (control) {
    if (control.tagName === "SELECT") {
      var option = control.options[control.selectedIndex];
      return option ? option.text : "";
    }
    if (control.type === "radio" || control.type === "checkbox") {
      var label = control.closest("label");
      var strong = label && label.querySelector("strong");
      if (strong) return strong.textContent.trim();
      return control.type === "checkbox" ? "Yes" : control.value;
    }
    // RFC 6068: line breaks in a mailto body are CRLF.
    return control.value.trim().replace(/\r?\n/g, "\r\n");
  };

  var describeForm = function (formEl) {
    var lines = [];
    Array.prototype.forEach.call(formEl.elements, function (control) {
      if (!control.name || control.disabled || control.type === "submit") return;
      if (control.hasAttribute("data-trap")) return;
      if ((control.type === "radio" || control.type === "checkbox") && !control.checked) return;
      var value = valueFor(control);
      if (value) lines.push(labelFor(control) + ": " + value);
    });
    return lines.join("\r\n\r\n");
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

  /* Field errors: a p.field-error after the control, tied to it with
     aria-describedby, and aria-invalid on the control. */
  var formatNumber = function (value) {
    var n = Number(value);
    return isNaN(n) ? value : n.toLocaleString("en-US");
  };

  var errorFor = function (control) {
    var v = control.validity;
    if (v.valueMissing) {
      var picked = control.tagName === "SELECT" || control.type === "radio";
      return picked ? "Choose an option." : "This field is required.";
    }
    if (control.type === "email" && (v.typeMismatch || v.patternMismatch)) {
      return "Enter an email address like name@example.com.";
    }
    if (control.type === "url" && (v.typeMismatch || v.patternMismatch)) {
      return "Enter the full address, starting with https://.";
    }
    if (control.type === "number" && (v.badInput || v.rangeUnderflow || v.rangeOverflow || v.stepMismatch)) {
      var min = control.getAttribute("min");
      var max = control.getAttribute("max");
      if (min !== null && max !== null) {
        return "Enter a whole number from " + formatNumber(min) + " to " + formatNumber(max) + ".";
      }
      if (min !== null) return "Enter a whole number, " + formatNumber(min) + " or more.";
      return "Enter a whole number.";
    }
    if (v.tooLong) return "Keep this to " + formatNumber(control.maxLength) + " characters or fewer.";
    return control.validationMessage || "Check this field.";
  };

  var errorIdFor = function (control) {
    return (control.type === "radio" ? control.name : control.id || control.name) + "-error";
  };

  var describedBy = function (control, id, add) {
    var ids = (control.getAttribute("aria-describedby") || "").split(/\s+/).filter(function (other) {
      return other && other !== id;
    });
    if (add) ids.push(id);
    if (ids.length) control.setAttribute("aria-describedby", ids.join(" "));
    else control.removeAttribute("aria-describedby");
  };

  var setFieldError = function (control, message) {
    var id = errorIdFor(control);
    var error = document.getElementById(id);
    if (!error) {
      // A radio group's message goes after its fieldset, not inside a label.
      var anchor = (control.type === "radio" && control.closest("fieldset")) || control;
      error = document.createElement("p");
      error.className = "field-error";
      error.id = id;
      anchor.parentNode.insertBefore(error, anchor.nextSibling);
    }
    if (error.textContent !== message) error.textContent = message;
    control.setAttribute("aria-invalid", "true");
    describedBy(control, id, true);
  };

  var clearFieldError = function (control) {
    if (control.getAttribute("aria-invalid") !== "true") return;
    var id = errorIdFor(control);
    control.removeAttribute("aria-invalid");
    describedBy(control, id, false);
    // A radio group shares one message; it stays while any member is flagged.
    var shared = control.form &&
      control.form.querySelector('[aria-invalid="true"][aria-describedby~="' + id + '"]');
    var error = document.getElementById(id);
    if (error && !shared) error.parentNode.removeChild(error);
  };

  var checkableFields = function (formEl) {
    return Array.prototype.filter.call(formEl.elements, function (control) {
      return /^(INPUT|SELECT|TEXTAREA)$/.test(control.tagName) &&
        control.willValidate && !control.hasAttribute("data-trap");
    });
  };

  document.querySelectorAll("form.js-send").forEach(function (formEl) {
    var statusEl = formEl.querySelector(".form-status");
    var announceStatus = makeAnnouncer(statusEl);
    var button = formEl.querySelector('[type="submit"]');
    var sending = false;

    var say = function (message, ok) {
      if (!statusEl) return;
      statusEl.classList.toggle("is-success", !!ok);
      announceStatus(message, 50);
    };

    var endpointOf = function () {
      return (formEl.getAttribute("data-endpoint") || "").trim();
    };

    // Shows the note that describes how this form actually sends.
    var syncSendMode = function () {
      var hasEndpoint = !!endpointOf();
      formEl.querySelectorAll(".form-note[data-send-mode]").forEach(function (note) {
        note.hidden = (note.getAttribute("data-send-mode") === "endpoint") !== hasEndpoint;
      });
    };
    syncSendMode();

    var clearAllErrors = function () {
      Array.prototype.forEach.call(formEl.elements, clearFieldError);
    };

    // "2 fields need attention: Email, Message." A radio group counts once.
    var summaryOf = function (controls) {
      var names = [];
      controls.forEach(function (control) {
        var name = labelFor(control);
        if (names.indexOf(name) === -1) names.push(name);
      });
      return (names.length === 1 ? "1 field needs" : names.length + " fields need") +
        " attention: " + names.join(", ") + ".";
    };

    // The summary follows the flagged fields as they are fixed or hidden. A
    // fixed field is not flagged again before the next submit, so the list only
    // shrinks: it is said again once per field fixed, not on every keystroke.
    var summary = "";
    var refreshSummary = function () {
      if (!statusEl || statusEl.getAttribute("data-state") !== "invalid") return;
      var flagged = Array.prototype.filter.call(formEl.elements, function (control) {
        return control.getAttribute("aria-invalid") === "true" &&
          !control.disabled && !control.closest("[hidden]");
      });
      if (!flagged.length) {
        statusEl.removeAttribute("data-state");
        summary = "";
        say("", false);
        return;
      }
      var next = summaryOf(flagged);
      if (next === summary) return;
      summary = next;
      say(summary, false);
    };

    // Once a field has been flagged, it is re-checked as the visitor edits it,
    // and its message goes away as soon as the value is acceptable.
    var recheck = function (event) {
      var control = event.target;
      var group = control.type === "radio" && control.name
        ? formEl.querySelectorAll('input[type="radio"][name="' + control.name + '"]')
        : [control];
      Array.prototype.forEach.call(group, function (member) {
        if (member.getAttribute("aria-invalid") !== "true") return;
        if (member.disabled || member.validity.valid) clearFieldError(member);
        else setFieldError(member, errorFor(member));
      });
      // Fields in a row that just hid no longer count.
      Array.prototype.forEach.call(formEl.elements, function (other) {
        if (other.disabled) clearFieldError(other);
      });
      refreshSummary();
    };
    formEl.addEventListener("input", recheck);
    formEl.addEventListener("change", recheck);

    formEl.addEventListener("submit", function (event) {
      event.preventDefault();
      if (sending) return;
      syncSendMode();
      if (statusEl) statusEl.removeAttribute("data-state");

      var invalid = [];
      checkableFields(formEl).forEach(function (control) {
        // Spaces alone do not count as an answer to a required field.
        if ((control.tagName === "TEXTAREA" || /^(text|search|tel)$/.test(control.type)) &&
            control.value && !control.value.trim()) {
          control.value = "";
        }
        if (control.validity.valid) {
          clearFieldError(control);
        } else {
          setFieldError(control, errorFor(control));
          invalid.push(control);
        }
      });

      if (invalid.length) {
        summary = summaryOf(invalid);
        say(summary, false);
        if (statusEl) statusEl.setAttribute("data-state", "invalid");
        invalid[0].focus();
        return;
      }

      var to = formEl.getAttribute("data-to") || "contact@nadirion.us";

      // A filled honeypot means a bot, or an autofill gone wrong. Refuse
      // honestly; a person reading this still has a way through.
      var trap = formEl.querySelector("[data-trap]");
      if (trap && trap.value) {
        say("That didn't go through. Please email " + to + " directly.", false);
        return;
      }

      var subject = subjectFor(formEl);
      var name = formEl.elements.name ? formEl.elements.name.value.trim() : "";
      var endpoint = endpointOf();

      if (!endpoint) {
        var mailto = "mailto:" + to + "?subject=" + encodeURIComponent(subject) +
          "&body=" + encodeURIComponent(describeForm(formEl));
        window.location.href = mailto;
        var note = "Your email app should open with this message ready to send. " +
          "Nothing is sent until you send it from there. If nothing opened, email " + to + ".";
        // Some mail apps cut off very long mailto links.
        if (mailto.length > 1800) {
          note += " If the message opens without your full text, copy it from this form.";
        }
        say(note, false);
        return;
      }

      // aria-disabled rather than disabled, so the button keeps focus.
      sending = true;
      if (button) button.setAttribute("aria-disabled", "true");
      say("Sending…", false);

      var data = new FormData(formEl);
      data.append("_subject", subject);
      var controller = window.AbortController ? new window.AbortController() : null;
      var timer = controller ? window.setTimeout(function () { controller.abort(); }, SEND_TIMEOUT) : 0;

      var request;
      try {
        request = window.fetch(endpoint, {
          method: "POST",
          body: data,
          headers: { Accept: "application/json" },
          credentials: "omit",
          signal: controller ? controller.signal : undefined
        });
      } catch (e) {
        request = Promise.reject(e);
      }

      request
        .then(function (response) {
          if (!response.ok) throw new Error("HTTP " + response.status);
        })
        .then(
          function () {
            say(
              "Thank you" + (name ? ", " + name : "") + ". Your message is with the Nadirion team " +
                "and someone will follow up by email.",
              true
            );
            formEl.reset();
            clearAllErrors();
            syncConditionalRows();
            renderQuote();
          },
          function () {
            // A timeout or a lost response may still have arrived, so this
            // never says it failed outright, only that it is unconfirmed.
            say(
              "We couldn't confirm that your message arrived. Please try again, or email " +
                to + " directly.",
              false
            );
          }
        )
        .then(function () {
          window.clearTimeout(timer);
          sending = false;
          if (button) button.removeAttribute("aria-disabled");
        });
    });
  });
})();
