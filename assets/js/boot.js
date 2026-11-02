document.documentElement.classList.add("js");

// Links preset the forms' choices (contact.html?interest=demo,
// resellers.html?track=individual). main.js selects them once it runs; until
// then styles.css draws the rows those choices show. Only values the forms
// offer count (the #interest select's options, the track radios).
(function () {
  var presets = {
    interest: /^(quote|demo|modules|support|reseller|verify|research|other)$/,
    track: /^(company|individual)$/
  };
  var query = window.location.search;
  for (var name in presets) {
    var m = new RegExp("[?&]" + name + "=([^&#]*)").exec(query);
    if (m && presets[name].test(m[1])) document.documentElement.setAttribute("data-" + name, m[1]);
  }
})();

// A reload, or a step back or forward to a page the browser didn't keep
// whole, returns to where the reader was as the page loads. With the page's
// smooth scrolling that would be a glide all the way down from the top, so
// until a moment after load it is a jump (html.is-restoring). Set here, in
// the <head>, because the browser can begin that return while the page is
// still being read in, long before the main script runs.
(function () {
  var nav = window.performance && performance.getEntriesByType ? performance.getEntriesByType("navigation")[0] : null;
  if (!nav || (nav.type !== "reload" && nav.type !== "back_forward")) return;
  var root = document.documentElement.classList;
  root.add("is-restoring");
  window.addEventListener("load", function () {
    setTimeout(function () { root.remove("is-restoring"); }, 150);
  });
})();

// If the main script never runs (blocked, or it failed to load), the mark
// comes off, so the page reads as it does without script: no menu button
// that can't open anything, and no search bar that can't search. It comes
// off as soon as the script fails to load, before the page is drawn where
// possible, so the layout doesn't change under the reader later; failing
// that (a script that loads but stops early), once the page has loaded.
window.addEventListener("error", function (event) {
  var el = event.target;
  if (el && el.tagName === "SCRIPT" && /\/assets\/js\/main\.js(\?|$)/.test(el.src)) {
    document.documentElement.classList.remove("js");
  }
}, true);
window.addEventListener("load", function () {
  var root = document.documentElement.classList;
  if (!root.contains("js-ready")) root.remove("js");
});

// The contact and reseller forms send only through main.js. While it is
// still on its way (a stalled connection), or if it stopped before reaching
// them, the browser would send the form the plain way: the page reloads with
// every field in its address and nothing is sent. So that send is held back,
// and the form says where to write instead.
document.addEventListener("submit", function (event) {
  var form = event.target;
  if (!form || !form.classList || !form.classList.contains("js-send") || form.nadirionSends) return;
  event.preventDefault();
  var status = form.querySelector(".form-status");
  var note = form.parentNode && form.parentNode.querySelector(".form-fallback");
  if (status && note) status.textContent = note.textContent;
}, true);
