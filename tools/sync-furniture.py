#!/usr/bin/env python3
"""Rewrite the shared header, footer and breadcrumbs on every page.

Usage: python3 tools/sync-furniture.py [repo-root]

Edit HEADER or FOOTER below, then run this script: every page gets the same
markup, with aria-current="page" on its own nav link. Breadcrumbs are rebuilt
as an ordered list from the page's current crumb label; pages under the
Services menu get a plain-text middle level from SECTION. 404.html is served at
any path, so all of its local URLs are made root-absolute.
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
        <div class="nav-group" id="capsGroup">
          <button type="button" class="nav-group-btn" id="capsToggle" aria-expanded="false" aria-controls="capsMenu">
            Services
            <span class="caret" aria-hidden="true"></span>
          </button>
          <div class="nav-menu" id="capsMenu">
            <div class="nav-menu-col" role="group" aria-labelledby="navHeadServices">
              <p class="nav-menu-head" id="navHeadServices">Digital &amp; Security Services</p>
              <a href="cyber.html">Cyber Operations</a>
              <a href="software-development.html">Software Development</a>
              <a href="digital-forensics.html">Digital Forensics</a>
              <a href="it-consulting.html">IT Consulting</a>
              <a href="training.html">Training</a>
            </div>
            <div class="nav-menu-col" role="group" aria-labelledby="navHeadPlatforms">
              <p class="nav-menu-head" id="navHeadPlatforms">Autonomous Platforms</p>
              <a href="satellites.html">Satellites</a>
              <a href="maritime-drones.html">Maritime Drones</a>
              <a href="aerial-drones.html">Aerial Drones</a>
            </div>
          </div>
        </div>
        <a href="contact.html?interest=quote" class="nav-cta">Request a Quote</a>
      </nav>
    </div>
  </header>"""

FOOTER = """<footer class="site-footer">
    <div class="wrap">
      <div class="footer-grid">
        <div class="footer-brand">
          <a class="brand" href="./" aria-label="Nadirion home">
            <img class="brand-mark" src="assets/img/logo-mark.svg" alt="" width="18" height="28" />
            <span class="brand-word">NADIRION</span>
          </a>
          <p>
            Nadirion Desktop and its add-on modules: one application for collection,
            enrichment, triage, and storage, sold direct and through certified resellers.
          </p>
        </div>
        <nav class="footer-nav" aria-label="Footer">
          <div class="footer-col" role="group" aria-labelledby="footHeadProduct">
            <p class="footer-head" id="footHeadProduct">Product</p>
            <a href="desktop.html">Nadirion Desktop</a>
            <a href="modules.html">Module Catalog</a>
            <a href="pricing.html">Pricing &amp; Licensing</a>
            <a href="contact.html?interest=quote">Request a Quote</a>
            <a href="contact.html?interest=demo">Book a Demo</a>
          </div>
          <div class="footer-col" role="group" aria-labelledby="footHeadResellers">
            <p class="footer-head" id="footHeadResellers">Resellers</p>
            <a href="resellers.html">Reseller Program</a>
            <a href="resellers.html#apply">Apply to Resell</a>
            <a href="resellers.html#verify">Verify a Reseller</a>
          </div>
          <div class="footer-col" role="group" aria-labelledby="footHeadServices">
            <p class="footer-head" id="footHeadServices">Services &amp; Platforms</p>
            <a href="cyber.html">Cyber Operations</a>
            <a href="software-development.html">Software Development</a>
            <a href="digital-forensics.html">Digital Forensics</a>
            <a href="it-consulting.html">IT Consulting</a>
            <a href="training.html">Training</a>
            <a href="satellites.html">Satellites</a>
            <a href="maritime-drones.html">Maritime Drones</a>
            <a href="aerial-drones.html">Aerial Drones</a>
          </div>
          <div class="footer-col" role="group" aria-labelledby="footHeadCompany">
            <p class="footer-head" id="footHeadCompany">Company</p>
            <a href="./#about">About</a>
            <a href="contact.html">Contact</a>
            <a href="privacy.html">Privacy</a>
            <a href="mailto:contact@nadirion.us">contact@nadirion.us</a>
          </div>
        </nav>
      </div>
      <p class="footer-note">&copy; <span id="year">2026</span> Nadirion. All rights reserved.</p>
    </div>
  </footer>"""

# Middle breadcrumb level for pages under the Services menu.
SECTION = {
    "cyber.html": "Services",
    "software-development.html": "Services",
    "digital-forensics.html": "Services",
    "it-consulting.html": "Services",
    "training.html": "Services",
    "satellites.html": "Autonomous Platforms",
    "maritime-drones.html": "Autonomous Platforms",
    "aerial-drones.html": "Autonomous Platforms",
}
CRUMB_NAME = {"training.html": "Training"}


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
