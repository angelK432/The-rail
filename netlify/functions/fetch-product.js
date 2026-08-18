// Free product-detail lookup: reads the page's own Open Graph / meta tags.
// No AI calls, no per-lookup cost — just a plain fetch + text parsing.

function decodeEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function getMeta(html, key, attr) {
  // Handles both attribute orders: property before content, and content before property.
  const re1 = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${key}["']`, "i");
  const m = html.match(re1) || html.match(re2);
  return m ? decodeEntities(m[1].trim()) : "";
}

// Many stores (Shopify especially) embed structured product data as
// JSON-LD instead of, or in addition to, Open Graph meta tags. This is
// often more reliable for image + price than scraping meta tags.
function getJsonLdProduct(html) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const s of scripts) {
    try {
      let parsed = JSON.parse(s[1].trim());
      const candidates = Array.isArray(parsed) ? parsed : parsed["@graph"] ? parsed["@graph"] : [parsed];
      for (const item of candidates) {
        if (item && (item["@type"] === "Product" || (Array.isArray(item["@type"]) && item["@type"].includes("Product")))) {
          const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
          const image = Array.isArray(item.image) ? item.image[0] : item.image;
          return {
            name: item.name || "",
            imageUrl: typeof image === "object" ? image.url || "" : image || "",
            price: offer ? offer.price || offer.lowPrice || "" : "",
            currency: offer ? offer.priceCurrency || "" : "",
            brand: item.brand ? (typeof item.brand === "object" ? item.brand.name : item.brand) : "",
          };
        }
      }
    } catch (e) {
      // Not valid JSON, or not the product block — skip it.
    }
  }
  return null;
}

export const handler = async (event) => {
  const url = event.queryStringParameters && event.queryStringParameters.url;

  if (!url) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing url parameter" }),
    };
  }

  try {
    const pageRes = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        Accept: "text/html",
      },
    });

    if (!pageRes.ok) {
      throw new Error(`Page responded with ${pageRes.status}`);
    }

    const html = await pageRes.text();
    const jsonLd = getJsonLdProduct(html);

    const name =
      (jsonLd && jsonLd.name) ||
      getMeta(html, "og:title", "property") ||
      getMeta(html, "twitter:title", "name") ||
      decodeEntities((html.match(/<title>([^<]+)<\/title>/i) || [])[1] || "");

    const imageUrl =
      (jsonLd && jsonLd.imageUrl) ||
      getMeta(html, "og:image:secure_url", "property") ||
      getMeta(html, "og:image", "property") ||
      getMeta(html, "twitter:image", "name");

    let price =
      (jsonLd && jsonLd.price) ||
      getMeta(html, "og:price:amount", "property") ||
      getMeta(html, "product:price:amount", "property") ||
      getMeta(html, "twitter:data1", "name") ||
      getMeta(html, "price", "itemprop");

    let currency =
      (jsonLd && jsonLd.currency) ||
      getMeta(html, "og:price:currency", "property") ||
      getMeta(html, "product:price:currency", "property") ||
      getMeta(html, "priceCurrency", "itemprop");

    const brand = (jsonLd && jsonLd.brand) || "";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name || "",
        brand: brand || "",
        price: price ? parseFloat(String(price).replace(/[^0-9.]/g, "")) : 0,
        currency: (currency || "NZD").toUpperCase(),
        imageUrl: imageUrl || "",
      }),
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Couldn't read that page automatically. Add the details manually below." }),
    };
  }
};
