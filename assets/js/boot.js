document.documentElement.classList.add("js");

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
