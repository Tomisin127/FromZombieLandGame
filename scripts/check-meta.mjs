// Fetches the deployed site and prints exactly what base.dev's scraper would see.
const URL = "https://fromzombielandgame.vercel.app"

console.log("[v0] Fetching:", URL)
const res = await fetch(URL, {
  redirect: "manual",
  headers: {
    // Pretend to be a generic scraper (similar to what base.dev likely uses)
    "user-agent": "Mozilla/5.0 (compatible; BaseAppScraper/1.0)",
    accept: "text/html,application/xhtml+xml",
  },
})

console.log("[v0] Status:", res.status)
console.log("[v0] Location header:", res.headers.get("location"))
console.log("[v0] Content-Type:", res.headers.get("content-type"))
console.log("[v0] X-Vercel-Cache:", res.headers.get("x-vercel-cache"))
console.log("[v0] X-Vercel-Id:", res.headers.get("x-vercel-id"))
console.log("[v0] Cache-Control:", res.headers.get("cache-control"))

const html = await res.text()
console.log("[v0] HTML length:", html.length)

// Extract just the <head>
const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
if (!headMatch) {
  console.log("[v0] NO <head> tag found in response!")
  console.log("[v0] First 1000 chars of body:")
  console.log(html.slice(0, 1000))
} else {
  const head = headMatch[1]
  console.log("[v0] <head> length:", head.length)

  // Find every meta tag
  const metaTags = head.match(/<meta[^>]*>/gi) ?? []
  console.log("[v0] Total <meta> tags found:", metaTags.length)

  // Specifically look for base:app_id
  const baseAppId = metaTags.filter((t) => /base:app_id/i.test(t))
  console.log("[v0] base:app_id meta tags:", baseAppId.length)
  baseAppId.forEach((t, i) => console.log(`[v0]   [${i}]`, t))

  // Print all meta tags so we can see ordering
  console.log("[v0] All meta tags in order:")
  metaTags.forEach((t, i) => console.log(`[v0]   [${i}]`, t.slice(0, 200)))
}
