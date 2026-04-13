import { useEffect } from "react";

interface HeadProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogType?: string;
  jsonLd?: Record<string, any>;
}

const setMeta = (attr: string, value: string, content: string) => {
  let el = document.querySelector(`meta[${attr}="${value}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, value);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
  return el;
};

const JSONLD_ID = "app-jsonld";

export function useHead({ title, description, canonical, ogTitle, ogDescription, ogType, jsonLd }: HeadProps) {
  useEffect(() => {
    const prev = document.title;
    if (title) document.title = title;

    const metas: HTMLMetaElement[] = [];
    if (description) metas.push(setMeta("name", "description", description));
    if (ogTitle) metas.push(setMeta("property", "og:title", ogTitle));
    if (ogDescription) metas.push(setMeta("property", "og:description", ogDescription));
    if (ogType) metas.push(setMeta("property", "og:type", ogType));

    let linkEl: HTMLLinkElement | null = null;
    if (canonical) {
      linkEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!linkEl) {
        linkEl = document.createElement("link");
        linkEl.setAttribute("rel", "canonical");
        document.head.appendChild(linkEl);
      }
      linkEl.setAttribute("href", canonical);
    }

    let scriptEl: HTMLScriptElement | null = null;
    if (jsonLd) {
      scriptEl = document.getElementById(JSONLD_ID) as HTMLScriptElement | null;
      if (!scriptEl) {
        scriptEl = document.createElement("script");
        scriptEl.id = JSONLD_ID;
        scriptEl.type = "application/ld+json";
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = JSON.stringify(jsonLd);
    }

    return () => {
      document.title = prev;
      metas.forEach((el) => el.remove());
      linkEl?.remove();
      scriptEl?.remove();
    };
  }, [title, description, canonical, ogTitle, ogDescription, ogType, jsonLd]);
}
