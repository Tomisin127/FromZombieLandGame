"""Fetch the deployed site and look for the base:app_id meta tag.
Read-only: only does HTTP GETs against the public production URL."""

import urllib.request
import re

URL = "https://fromzombielandgame.vercel.app/"

req = urllib.request.Request(
    URL,
    headers={
        # Mimic what dashboard.base.org's scraper likely sends.
        "User-Agent": "Mozilla/5.0 (compatible; base-dev-scraper/1.0)",
        "Accept": "text/html,application/xhtml+xml",
    },
)

with urllib.request.urlopen(req, timeout=20) as resp:
    print("=== STATUS ===")
    print(resp.status, resp.reason)
    print()
    print("=== RESPONSE HEADERS ===")
    for k, v in resp.headers.items():
        print(f"{k}: {v}")
    print()
    body = resp.read().decode("utf-8", errors="replace")

print(f"=== BODY LENGTH ===\n{len(body)} bytes\n")

# Extract <head>...</head>
m = re.search(r"<head[^>]*>(.*?)</head>", body, re.DOTALL | re.IGNORECASE)
if not m:
    print("!!! NO <head> TAG FOUND IN RESPONSE !!!")
else:
    head = m.group(1)
    print(f"=== <head> LENGTH ===\n{len(head)} bytes\n")
    print("=== ALL <meta> TAGS IN <head> ===")
    for tag in re.findall(r"<meta[^>]*>", head, re.IGNORECASE):
        print(tag)
    print()
    print("=== base:app_id MATCHES ===")
    matches = re.findall(r'<meta[^>]*base:app_id[^>]*>', body, re.IGNORECASE)
    if matches:
        for tag in matches:
            print("FOUND:", tag)
    else:
        print("NOT FOUND ANYWHERE IN BODY")
