import { useEffect, useRef } from "react";

interface HeadProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogType?: string;
  jsonLd?: Record<string, any>;
}

/**
 * Manages document head elements (title, meta, canonical, JSON-LD).
 * Safe to call unconditionally — undefined values are skipped.
 * Cleans up on unmount.
 */
export function useHead(props: HeadProps) {
  const jsonLdStr = props.jsonLd ? JSON.stringify(props.jsonLd) : "";
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const { title, description, canonical, ogTitle, ogDescription, ogType } = propsRef.current;
    const prevTitle = document.title;
    const created: Element[] = [];

    if (title) document.title = title;

    const setMeta = (attr: string, val: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${val}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, val);
        document.head.appendChild(el);
        created.push(el);
      }
      el.setAttribute("content", content);
    };

    if (description) setMeta("name", "description", description);
    if (ogTitle) setMeta("property", "og:title", ogTitle);
    if (ogDescription) setMeta("property", "og:description", ogDescription);
    if (ogType) setMeta("property", "og:type", ogType);

    let linkEl: HTMLLinkElement | null = null;
    if (canonical) {
      linkEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!linkEl) {
        linkEl = document.createElement("link");
        linkEl.setAttribute("rel", "canonical");
        document.head.appendChild(linkEl);
        created.push(linkEl);
      }
      linkEl.setAttribute("href", canonical);
    }

    if (jsonLdStr) {
      let scriptEl = document.getElementById("app-jsonld") as HTMLScriptElement | null;
      if (!scriptEl) {
        scriptEl = document.createElement("script");
        scriptEl.id = "app-jsonld";
        scriptEl.type = "application/ld+json";
        document.head.appendChild(scriptEl);
        created.push(scriptEl);
      }
      scriptEl.textContent = jsonLdStr;
    }

    return () => {
      document.title = prevTitle;
      created.forEach((el) => el.remove());
    };
  }, [
    propsRef.current.title,
    propsRef.current.description,
    propsRef.current.canonical,
    propsRef.current.ogTitle,
    propsRef.current.ogDescription,
    propsRef.current.ogType,
    jsonLdStr,
  ]);
}
