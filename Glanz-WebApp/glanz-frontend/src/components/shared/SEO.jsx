import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { BUSINESS } from '../../config/business';

const SITE_URL    = 'https://flowly.qa';
const DEFAULT_OG  = `${SITE_URL}/Logo.png`;

/**
 * Drop-in SEO head manager.
 * Props:
 *   title        — page title (appended with " | Flowly")
 *   description  — meta description (150–160 chars ideal)
 *   image        — OG image URL (defaults to logo)
 *   noindex      — pass true for auth/private pages
 *   jsonLd       — structured-data object (or array) to serialise as JSON-LD
 */
export default function SEO({ title, description, image = DEFAULT_OG, noindex = false, jsonLd }) {
  const { pathname } = useLocation();
  const canonical    = `${SITE_URL}${pathname}`;
  const fullTitle    = title ? `${title} | ${BUSINESS.name}` : BUSINESS.name;
  const desc         = description || BUSINESS.tagline;

  return (
    <Helmet>
      {/* Primary */}
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      <link rel="canonical" href={canonical} />

      {/* Open Graph */}
      <meta property="og:type"        content="website" />
      <meta property="og:url"         content={canonical} />
      <meta property="og:title"       content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image"       content={image} />
      <meta property="og:site_name"   content={BUSINESS.name} />
      <meta property="og:locale"      content="en_QA" />

      {/* Twitter card */}
      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:title"       content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image"       content={image} />

      {/* JSON-LD structured data */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(Array.isArray(jsonLd) ? jsonLd : [jsonLd])}
        </script>
      )}
    </Helmet>
  );
}
