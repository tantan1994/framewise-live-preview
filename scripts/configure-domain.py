#!/usr/bin/env python3
"""Apply the deployed HTTPS URL to the Figma plugin files.

Usage: python3 scripts/configure-domain.py https://framewise.example.com
"""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

if len(sys.argv) != 2:
    raise SystemExit("Usage: python3 scripts/configure-domain.py https://your-domain.example")

domain = sys.argv[1].rstrip("/")
parsed = urlparse(domain)
if parsed.scheme != "https" or not parsed.netloc:
    raise SystemExit("An HTTPS URL is required, for example https://framewise.example.com")

root = Path(__file__).resolve().parents[1]
manifest_path = root / "figma-plugin" / "manifest.json"
manifest = json.loads(manifest_path.read_text())
manifest["networkAccess"]["allowedDomains"] = [domain]
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

ui_path = root / "figma-plugin" / "ui.html"
ui = ui_path.read_text()
ui = re.sub(r'https://YOUR_RELAY_DOMAIN', domain, ui)
ui_path.write_text(ui)
print(f"Figma plugin configured for {domain}")
