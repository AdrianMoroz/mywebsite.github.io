const outlet = '<!--app-html-->';

export function injectMarkup(html, markup) {
  if (!html.includes(outlet)) throw new Error(`Missing ${outlet} in the homepage template.`);
  // Use a callback so replacement patterns in project copy are treated as text.
  return html.replace(outlet, () => markup);
}
