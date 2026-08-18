/ Free product-detail lookup: reads the page's own Open Graph / meta tags.
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

exports.handler = async (event) => {
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

    const name =
      getMeta(html, "og:title", "property") ||
      getMeta(html, "twitter:title", "name") ||
      decodeEntities((html.match(/<title>([^<]+)<\/title>/i) || [])[1] || "");

    const imageUrl =
      getMeta(html, "og:image:secure_url", "property") ||
      getMeta(html, "og:image", "property") ||
      getMeta(html, "twitter:image", "name");

    let price =
      getMeta(html, "og:price:amount", "property") ||
      getMeta(html, "product:price:amount", "property") ||
      getMeta(html, "twitter:data1", "name") ||
      getMeta(html, "price", "itemprop");

    let currency =
      getMeta(html, "og:price:currency", "property") ||
      getMeta(html, "product:price:currency", "property") ||
      getMeta(html, "priceCurrency", "itemprop");

    // Fallback: hunt for a plain currency symbol + number somewhere in the page.
    if (!price) {
      const priceMatch = html.match(/[\$£€]\s?(\d{1,4}(?:[.,]\d{2})?)/);
      if (priceMatch) {
        price = priceMatch[1].replace(",", ".");
        if (!currency) {
          const symbol = priceMatch[0].trim()[0];
          currency = symbol === "£" ? "GBP" : symbol === "€" ? "EUR" : "USD";
        }
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name || "",
        brand: "",
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
