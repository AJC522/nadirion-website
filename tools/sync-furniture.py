#!/usr/bin/env python3
"""Rewrite the shared header, footer and breadcrumbs on every page.

Usage: python3 tools/sync-furniture.py [repo-root]

Edit HEADER or FOOTER below, then run this script: every page gets the same
markup, with aria-current="page" on its own nav link. Breadcrumbs are rebuilt
as an ordered list from the page's current crumb label, with an optional
plain-text middle level from SECTION. 404.html is served at any path, so all of
its local URLs are made root-absolute.
Idempotent: safe to run repeatedly. Run tools/check-site.mjs afterwards.
"""
import re
import sys
from pathlib import Path

REPO = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent

HEADER = """<a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header" id="top">
    <div class="wrap header-inner">
      <a class="brand" href="./" aria-label="Nadirion home">
        <img class="brand-mark" src="assets/img/logo-mark.svg" alt="" width="22" height="34" />
        <span class="brand-word">NADIRION</span>
      </a>

      <button type="button" class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="primaryNav" aria-label="Menu">
        <span></span><span></span>
      </button>

      <nav class="primary-nav" id="primaryNav" aria-label="Primary">
        <a href="desktop.html">Nadirion Desktop</a>
        <a href="modules.html">Modules</a>
        <a href="pricing.html">Pricing</a>
        <a href="resellers.html">Resellers</a>
        <a href="in-development.html">In Development</a>
        <a href="contact.html?interest=quote" class="nav-cta">Request a Quote</a>
      </nav>
    </div>
  </header>"""

FOOTER = """<footer class="site-footer">
    <div class="wrap">
      <div class="footer-main">
        <a class="brand" href="./" aria-label="Nadirion home">
          <img class="brand-mark" src="assets/img/logo-mark.svg" alt="" width="18" height="28" />
          <span class="brand-word">NADIRION</span>
        </a>
        <nav class="footer-nav" aria-label="Footer">
          <a href="desktop.html">Nadirion Desktop</a>
          <a href="modules.html">Modules</a>
          <a href="pricing.html">Pricing</a>
          <a href="resellers.html">Resellers</a>
          <a href="in-development.html">In Development</a>
          <a href="contact.html">Contact</a>
        </nav>
      </div>
      <div class="footer-meta">
        <p>&copy; <span id="year">2026</span> Nadirion. All rights reserved.</p>
        <a href="mailto:contact@nadirion.us">contact@nadirion.us</a>
      </div>
    </div>
  </footer>"""

# Optional middle breadcrumb level (plain text) and crumb label overrides, by filename.
# Every page currently sits directly under Home, so both are empty.
SECTION = {}
CRUMB_NAME = {}


def header_for(name):
    out = HEADER
    needle = f'<a href="{name}">'
    if needle in out:
        out = out.replace(needle, f'<a href="{name}" aria-current="page">', 1)
    return out


def crumb_for(name, current, indent):
    i = " " * indent
    items = [f'{i}  <li><a href="./">Home</a></li>']
    if name in SECTION:
        items.append(f"{i}  <li>{SECTION[name]}</li>")
    items.append(f'{i}  <li><span aria-current="page">{current}</span></li>')
    return (f'<nav class="crumb" aria-label="Breadcrumb">\n{i}<ol>\n'
            + "\n".join(items) + f"\n{i}</ol>\n{i[:-2]}</nav>")


def rewrite_crumb(src, name):
    m = re.search(r'( *)<nav class="crumb" aria-label="Breadcrumb">(.*?)</nav>', src, re.S)
    if not m:
        return src
    inner = m.group(2)
    cur = re.search(r'<span aria-current="page">([^<]+)</span>', inner)
    if not cur:
        # Old markup: the last non-decorative span is the current page.
        spans = re.findall(r'<span(?![^>]*aria-hidden)[^>]*>([^<]+)</span>', inner)
        cur_text = spans[-1].strip()
    else:
        cur_text = cur.group(1).strip()
    cur_text = CRUMB_NAME.get(name, cur_text)
    indent = len(m.group(1))
    new = crumb_for(name, cur_text, indent + 2)
    return src[: m.start()] + m.group(1) + new + src[m.end():]


def main():
    for path in sorted(REPO.glob("*.html")):
        name = path.name
        src = path.read_text()
        src = re.sub(r'<a class="skip-link".*?</header>', lambda _: header_for(name), src, count=1, flags=re.S)
        src = re.sub(r"<footer class=\"site-footer\">.*?</footer>", lambda _: FOOTER, src, count=1, flags=re.S)
        src = rewrite_crumb(src, name)
        if name == "404.html":
            src = rootify(src)
        path.write_text(src)
        print("furniture:", name)


def rootify(src):
    """404.html is served at any path, so every local URL must be root-absolute."""
    def fix(m):
        attr, url = m.group(1), m.group(2)
        if re.match(r"^(?:[a-z]+:|/|#)", url):
            return m.group(0)
        return f'{attr}="/{"" if url == "./" else url.removeprefix("./")}"'
    return re.sub(r'\b(href|src)="([^"]*)"', fix, src)


if __name__ == "__main__":
    main()
