#!/usr/bin/env python3

import argparse
import ast
import os
from pathlib import Path


MODULE_TEMPLATE = '''import os
import re
import unittest

from playwright.sync_api import sync_playwright, expect

try:
    from .config import BASE_URL, HEADLESS_MODE
except ImportError:
    from config import BASE_URL, HEADLESS_MODE


class Test{class_name}(unittest.TestCase):

{methods}


if __name__ == '__main__':
    unittest.main()
'''

METHOD_TEMPLATE = '''    def test_{test_name}(self):
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=HEADLESS_MODE)

            context = browser.new_context()
            page = context.new_page()
            page.goto(BASE_URL)

            # ---------- START -----------
{body}
            # ----------- END ------------

            context.close()
            browser.close()
'''


class RunExtractor(ast.NodeVisitor):
    def __init__(self):
        self.run_func = None

    def visit_FunctionDef(self, node):
        if node.name == "run":
            self.run_func = node


def extract_test_body(source_text: str) -> str:
    tree = ast.parse(source_text)

    extractor = RunExtractor()
    extractor.visit(tree)

    if extractor.run_func is None:
        raise RuntimeError("Could not find run() function")

    lines = source_text.splitlines()

    body_lines = []

    for stmt in extractor.run_func.body:
        stmt_text = "\n".join(
            lines[stmt.lineno - 1:stmt.end_lineno]
        )

        skip_patterns = [
            "browser = playwright.chromium.launch(",
            "context = browser.new_context(",
            "page = context.new_page(",
            "page.goto(",
            "context.close(",
            "browser.close(",
        ]

        if any(pattern in stmt_text for pattern in skip_patterns):
            continue

        body_lines.append(stmt_text.strip())

    # re-indent inside unittest method
    result = []

    for line in body_lines:
        if line.strip():
            result.append(f"            {line}")
        else:
            result.append("")

    return "\n".join(result)


def create_method(test_name: str, body: str) -> str:
    return METHOD_TEMPLATE.format(
        test_name=test_name,
        body=body,
    )


def create_new_module(class_name: str,
                      test_name: str,
                      body: str) -> str:

    method = create_method(test_name, body)

    return MODULE_TEMPLATE.format(
        class_name=class_name,
        methods=method.rstrip(),
    )


def class_already_exists(source_text: str, class_name: str) -> bool:
    tree = ast.parse(source_text)

    for node in tree.body:
        if isinstance(node, ast.ClassDef) and node.name == f"Test{class_name}":
            return True

    return False


def add_new_class(
        source_text: str,
        class_name: str,
        method_text: str) -> str:
    """
    Add a new class to the source text, with the given method text.
    The new class will be added after the last class in the source text,
    or before the last if statement if there are no classes.
    We already know that the class does not already exist, so we don't need to check for that."""

    tree = ast.parse(source_text)

    insert_location = None
    for node in tree.body:
        if isinstance(node, ast.ClassDef):
            insert_location = node

    if insert_location is None:
        previous_node = None
        for node in tree.body:
            if isinstance(node, ast.If):
                insert_location = previous_node
            else:
                previous_node = node

    if insert_location is None:
        raise RuntimeError(
            "Could not find a suitable location to insert the new class"
        )

    lines = source_text.splitlines()

    insert_line = insert_location.end_lineno

    method_lines = method_text.splitlines()

    lines[insert_line:insert_line] = ["", "", f"class Test{class_name}(unittest.TestCase):"] + method_lines

    lines += [""]

    return "\n".join(lines)


def add_method_to_existing_class(
    source_text: str,
    class_name: str,
    test_name: str,
    method_text: str,
):
    tree = ast.parse(source_text)

    target_class = None

    for node in tree.body:
        if isinstance(node, ast.ClassDef) and node.name == f"Test{class_name}":
            target_class = node
            break

    if target_class is None:
        raise RuntimeError(
            f"Class 'Test{class_name}' not found"
        )

    existing_methods = {
        n.name
        for n in target_class.body
        if isinstance(n, ast.FunctionDef)
    }

    if f"test_{test_name}" in existing_methods:
        raise RuntimeError(
            f"Method 'test_{test_name}' already exists"
        )

    lines = source_text.splitlines()

    insert_line = target_class.end_lineno

    method_lines = method_text.splitlines()

    lines[insert_line:insert_line] = [""] + method_lines

    lines += [""]

    return "\n".join(lines)


def _parse_args():
    parser = argparse.ArgumentParser(
        description="Convert Playwright codegen script into unittest format"
    )

    parser.add_argument(
        "--input",
        required=True,
        help="Playwright codegen file"
    )

    parser.add_argument(
        "--output",
        required=True,
        help="Target unittest file"
    )

    parser.add_argument(
        "--class",
        dest="class_name",
        required=True,
        help="Target unittest class name"
    )

    parser.add_argument(
        "--test",
        dest="test_name",
        required=True,
        help="Test method name"
    )

    parser.add_argument(
        "--keep-input",
        action="store_true",
        help="Keep input file after conversion"
    )

    return parser.parse_args()


def main():

    args = _parse_args()

    input_file = Path(args.input)
    output_file = Path(args.output)

    codegen_source = input_file.read_text()

    body = extract_test_body(codegen_source)

    if output_file.exists():
        existing = output_file.read_text()

        method_text = create_method(
            args.test_name,
            body
        )

        if class_already_exists(existing, args.class_name):
            updated = add_method_to_existing_class(
                existing,
                args.class_name,
                args.test_name,
                method_text
            )
        else:
            updated = add_new_class(
                existing,
                args.class_name,
                method_text
            )

        output_file.write_text(updated)

        print(
            f"Added {args.test_name} "
            f"to {args.class_name}"
        )

    else:
        module_text = create_new_module(
            args.class_name,
            args.test_name,
            body
        )

        output_file.write_text(module_text + "\n")

        print(f"Created {output_file}")

    if os.path.exists(input_file) and not args.keep_input:
        os.remove(input_file)


if __name__ == "__main__":
    main()
