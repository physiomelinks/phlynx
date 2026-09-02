import os
import re
import unittest

from playwright.sync_api import sync_playwright, expect

try:
    from .config import BASE_URL, HEADLESS_MODE
except ImportError:
    from config import BASE_URL, HEADLESS_MODE


class TestVersionInformation(unittest.TestCase):

    def test_version(self):
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=HEADLESS_MODE)
            
            context = browser.new_context()
            page = context.new_page()
            page.goto(BASE_URL)

            # ---------------------
            main_version = page.get_by_text(re.compile(r"^PhLynx v[\d]+\.[\d]+\.[\d]+$"))
            expect(main_version).to_have_text(re.compile(r"^PhLynx v[\d]+\.[\d]+\.[\d]+$"))
            page.get_by_role("link", name="About").click()
            version_chip = page.locator("div").filter(has_text=re.compile(r"^v[\d]+\.[\d]+\.[\d]+$"))
            expect(version_chip).to_have_text(re.compile(r"^v[\d]+\.[\d]+\.[\d]+$"))
            # ---------------------

            context.close()
            browser.close()


if __name__ == '__main__':
    unittest.main()

