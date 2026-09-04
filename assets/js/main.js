(function () {
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

  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

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
        "Thank you, " + name + ". Your message has been received — we'll be in touch shortly.";
      status.classList.add("is-success");
      form.reset();
    });
  }
})();
