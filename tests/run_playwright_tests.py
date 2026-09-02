import os
import sys
import unittest


here = os.path.abspath(os.path.dirname(__file__))


if __name__ == '__main__':
    loader = unittest.TestLoader()
    playwright_tests = os.path.join(here, "playwright")
    tests = loader.discover(playwright_tests)
    testRunner = unittest.runner.TextTestRunner()
    result = testRunner.run(tests)

    if not result.wasSuccessful():
        sys.exit(1)

    sys.exit(0)
