// Perception "pauvre" et déterministe d'une page : on tague chaque élément
// interactif visible avec un attribut data-bot-ref et on renvoie une liste
// compacte (ref, kind, name) + les titres + le texte visible. C'est ce que
// le LLM "voit" — pas de pixels, donc pas de tokens d'image (économe, fiable).

/**
 * @param {import('@playwright/test').Page} page
 */
export async function perceive(page) {
  return await page.evaluate(() => {
    const isVisible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) return false;
      const s = getComputedStyle(el);
      return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
    };
    const clean = (t) => (t || '').replace(/\s+/g, ' ').trim();

    const selector =
      'a[href], button, input, textarea, select, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [onclick]';
    const els = Array.from(document.querySelectorAll(selector)).filter(isVisible);

    const interactables = [];
    els.forEach((el, i) => {
      el.setAttribute('data-bot-ref', String(i));
      const name = clean(
        el.getAttribute('aria-label') ||
          el.getAttribute('placeholder') ||
          (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? el.value : '') ||
          el.innerText ||
          el.getAttribute('title') ||
          el.getAttribute('name') ||
          '',
      ).slice(0, 80);
      const kind = el.tagName.toLowerCase() + (el.type ? ':' + el.type : '');
      interactables.push({ ref: i, kind, name });
    });

    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
      .filter(isVisible)
      .map((h) => clean(h.innerText).slice(0, 90))
      .filter(Boolean)
      .slice(0, 15);

    const text = clean(document.body.innerText).slice(0, 1200);

    return {
      url: location.pathname + location.search,
      title: document.title,
      headings,
      interactables,
      text,
    };
  });
}
