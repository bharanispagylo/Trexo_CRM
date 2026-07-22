/**
 * elementInfo.js
 * Collects comprehensive information about a DOM element.
 * Used by the content script when the user clicks an element in comment mode.
 */

/**
 * Generate a unique CSS selector path for the element.
 * Prefers id, then walks the DOM tree upward.
 */
function getCSSSelector(el) {
  if (!el || el.nodeType !== 1) return '';
  if (el.id) return `#${CSS.escape(el.id)}`;

  const parts = [];
  let node = el;

  while (node && node.nodeType === 1 && node !== document.body) {
    let selector = node.tagName.toLowerCase();

    if (node.id) {
      selector = `#${CSS.escape(node.id)}`;
      parts.unshift(selector);
      break;
    }

    // Add nth-child to disambiguate siblings
    const parent = node.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(c => c.tagName === node.tagName);
      if (siblings.length > 1) {
        const idx = siblings.indexOf(node) + 1;
        selector += `:nth-of-type(${idx})`;
      }
    }

    parts.unshift(selector);
    node = node.parentElement;
  }

  if (node === document.body) parts.unshift('body');
  return parts.join(' > ');
}

/**
 * Generate an XPath expression for the element.
 */
function getXPath(el) {
  if (!el || el.nodeType !== 1) return '';
  if (el.id) return `//*[@id="${el.id}"]`;

  const parts = [];
  let node = el;

  while (node && node.nodeType === 1) {
    const tag = node.tagName.toLowerCase();
    const parent = node.parentElement;
    let idx = 1;

    if (parent) {
      const siblings = Array.from(parent.children).filter(c => c.tagName === node.tagName);
      if (siblings.length > 1) idx = siblings.indexOf(node) + 1;
    }

    parts.unshift(siblings && siblings.length > 1 ? `${tag}[${idx}]` : tag);
    node = node.parentElement;
  }

  return '/' + parts.join('/');
}

/**
 * Collect data-* attributes from an element.
 */
function getDataAttributes(el) {
  const attrs = {};
  for (const attr of el.attributes) {
    if (attr.name.startsWith('data-')) {
      attrs[attr.name] = attr.value;
    }
  }
  return attrs;
}

/**
 * Get a compact HTML snippet (outerHTML truncated to 500 chars).
 */
function getHTMLSnippet(el) {
  try {
    return el.outerHTML.substring(0, 500);
  } catch {
    return '';
  }
}

/**
 * Primary export: collect all element info needed for bug reports.
 */
function collectElementInfo(el) {
  const rect = el.getBoundingClientRect();

  return {
    selector: getCSSSelector(el),
    xpath: getXPath(el),
    tagName: el.tagName.toLowerCase(),
    id: el.id || null,
    classes: Array.from(el.classList),
    textContent: (el.innerText || el.textContent || '').trim().substring(0, 300),
    htmlSnippet: getHTMLSnippet(el),
    dataAttributes: getDataAttributes(el),
    ariaLabel: el.getAttribute('aria-label') || null,
    role: el.getAttribute('role') || null,
    name: el.getAttribute('name') || null,
    type: el.getAttribute('type') || null,
    placeholder: el.getAttribute('placeholder') || null,
    href: el.tagName === 'A' ? el.getAttribute('href') : null,

    // Bounding box relative to viewport (for screenshot annotation)
    bounds: {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      // Absolute page coordinates
      pageX: Math.round(rect.left + window.scrollX),
      pageY: Math.round(rect.top + window.scrollY),
    },

    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    pageWidth: document.documentElement.scrollWidth,
    pageHeight: document.documentElement.scrollHeight,
    scrollX: Math.round(window.scrollX),
    scrollY: Math.round(window.scrollY),
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}

// Export for use in content.js (loaded via content_scripts, so we attach to window)
window.__spagyloElementInfo = { collectElementInfo };
