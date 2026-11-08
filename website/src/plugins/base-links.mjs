/**
 * Prefixes the root-relative links of the content ("/guides/review/") with the site's base path, so that pages
 * can link to each other the same way wherever the site is published. Handles Markdown links and the JSX
 * elements of MDX pages; external links, anchors and links that already carry the base are left as they are.
 */
export function baseLinks(base) {
  const prefix = base.replace(/\/$/, '');
  const fix = (url) => (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && url !== prefix && !url.startsWith(`${prefix}/`) ? `${prefix}${url}` : url);
  const walk = (node) => {
    if (node.type === 'element' && node.properties && typeof node.properties.href === 'string') node.properties.href = fix(node.properties.href);
    if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && Array.isArray(node.attributes)) {
      for (const a of node.attributes) if (a.type === 'mdxJsxAttribute' && a.name === 'href' && typeof a.value === 'string') a.value = fix(a.value);
    }
    for (const child of node.children ?? []) walk(child);
  };
  return () => (tree) => walk(tree);
}
