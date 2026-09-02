import os

from dotenv import load_dotenv

load_dotenv()
load_dotenv(".env.local")

BASE_URL = os.environ.get("PHLYNX_BASE_URL", "https://phlynx.com/")
RESOURCE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "resources"))
HEADLESS_MODE = os.environ.get("HEADLESS_MODE", "true").lower() == "true"

print(f"Using base URL: {BASE_URL}")
print(f"Using resource path: {RESOURCE_PATH}")
print(f"Headless mode: {HEADLESS_MODE}")
