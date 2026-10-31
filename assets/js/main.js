(function () {
  "use strict";

  // Lets CSS hide controls that only work with the script running.
  document.documentElement.classList.add("js");

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

  /* ---------- Capabilities menu ---------- */
  var capsGroup = document.getElementById("capsGroup");
  var capsToggle = document.getElementById("capsToggle");

  if (capsGroup && capsToggle) {
    var setCaps = function (open) {
      capsGroup.classList.toggle("is-open", open);
      capsToggle.setAttribute("aria-expanded", String(open));
    };

    capsToggle.addEventListener("click", function (event) {
      event.stopPropagation();
      setCaps(capsToggle.getAttribute("aria-expanded") !== "true");
    });

    capsGroup.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () { setCaps(false); });
    });

    document.addEventListener("click", function (event) {
      if (!capsGroup.contains(event.target)) setCaps(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" || event.key === "Esc") {
        setCaps(false);
        capsToggle.focus();
      }
    });
  }

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Reveal on scroll ---------- */
  var revealTargets = document.querySelectorAll(
    ".section-head, .page-hero-copy, .page-hero-glyph, .stat, .focus-card, .toolkit-showcase, " +
      ".module, .service, .step, .table-scroll, .spec-note, .program, .program-thesis, " +
      ".program-status, .about-copy, .about-visual, .sector, .related-card, .cta-inner, " +
      ".contact-copy, .contact-form, .plan, .track, .app-window"
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
