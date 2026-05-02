"""
generate_reports.py — Generate fordeepseek.rtf and pantheon.rtf.

* fordeepseek.rtf  – Results of running the Pantheon1.0 neural network demo.
* pantheon.rtf     – Full source code of the project.

Run this script any time you want to refresh the RTF files:
    python generate_reports.py
"""

import os
import datetime
import sys

# Ensure the repo root is on the path so we can import pantheon.py
REPO_ROOT = os.path.dirname(os.path.abspath(__file__))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from pantheon import run_demo  # noqa: E402


# ---------------------------------------------------------------------------
# RTF helpers
# ---------------------------------------------------------------------------

def _rtf_escape(text):
    """Escape special RTF characters and encode non-ASCII as Unicode escapes."""
    out = []
    for ch in text:
        if ch == "\\":
            out.append("\\\\")
        elif ch == "{":
            out.append("\\{")
        elif ch == "}":
            out.append("\\}")
        elif ch == "\n":
            out.append("\\par\n")
        elif ch == "\t":
            out.append("\\tab ")
        elif ord(ch) > 127:
            out.append(f"\\u{ord(ch)}?")
        else:
            out.append(ch)
    return "".join(out)


def _wrap_rtf(body_text, title=""):
    """Wrap plain text in a minimal RTF envelope."""
    header = (
        r"{\rtf1\ansi\deff0"
        r"{\fonttbl{\f0\fmodern\fcharset0 Courier New;}}"
        r"{\colortbl;\red0\green0\blue0;}"
        r"\f0\fs20 "
    )
    if title:
        header += r"\b " + _rtf_escape(title) + r"\b0\par\par "
    footer = "}"
    return header + _rtf_escape(body_text) + footer


def write_rtf(path, body_text, title=""):
    """Write an RTF file at *path* with the given body text."""
    content = _wrap_rtf(body_text, title=title)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content)
    print(f"  Written: {path}")


# ---------------------------------------------------------------------------
# Content builders
# ---------------------------------------------------------------------------

def build_fordeepseek_content():
    """Run the Pantheon demo and return a plain-text summary."""
    print("Running Pantheon1.0 demo …")
    results, history, final_loss = run_demo()

    lines = [
        "Pantheon1.0 — Results of Work",
        "=" * 50,
        f"Generated: {datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}",
        "",
        "Project: pantheon1.0",
        "Description: Multilevel Clustered Neuronet AI",
        "",
        "Demo task: XOR classification",
        "-" * 40,
    ]
    for inputs, expected, predicted in results:
        status = "OK" if abs(predicted - expected) < 0.3 else "FAIL"
        lines.append(
            f"  Input: {inputs}  Expected: {expected}  Predicted: {predicted:.4f}  [{status}]"
        )
    lines += [
        "",
        f"Final training loss: {final_loss:.8f}",
        f"Training epochs completed: {len(history)}",
        "",
        "Architecture: Multilevel Clustered Neuronet",
        "  - Level 1: 2 clusters, each [2 → 3 → 1]",
        "  - Activation: Sigmoid",
        "  - Learning: Backpropagation with gradient descent",
        "",
        "Status: COMPLETE",
    ]
    return "\n".join(lines)


def build_pantheon_content():
    """Return the full source code of every Python file in the project."""
    source_files = []
    for fname in sorted(os.listdir(REPO_ROOT)):
        if fname.endswith(".py"):
            source_files.append(fname)

    lines = [
        "Pantheon1.0 — Full Project Source Code",
        "=" * 50,
        f"Generated: {datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}",
        "",
    ]
    for fname in source_files:
        fpath = os.path.join(REPO_ROOT, fname)
        lines.append(f"{'=' * 60}")
        lines.append(f"FILE: {fname}")
        lines.append(f"{'=' * 60}")
        with open(fpath, "r", encoding="utf-8") as fh:
            lines.append(fh.read())
        lines.append("")

    # Also include README
    readme_path = os.path.join(REPO_ROOT, "README.md")
    if os.path.exists(readme_path):
        lines.append(f"{'=' * 60}")
        lines.append("FILE: README.md")
        lines.append(f"{'=' * 60}")
        with open(readme_path, "r", encoding="utf-8") as fh:
            lines.append(fh.read())

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=== Pantheon1.0 Report Generator ===\n")

    fordeepseek_path = os.path.join(REPO_ROOT, "fordeepseek.rtf")
    pantheon_rtf_path = os.path.join(REPO_ROOT, "pantheon.rtf")

    print("Building fordeepseek.rtf …")
    fordeepseek_text = build_fordeepseek_content()
    write_rtf(fordeepseek_path, fordeepseek_text, title="Pantheon1.0 — Results of Work")

    print("\nBuilding pantheon.rtf …")
    pantheon_text = build_pantheon_content()
    write_rtf(pantheon_rtf_path, pantheon_text, title="Pantheon1.0 — Full Project Source Code")

    print("\nDone.  Both RTF files have been created/updated.")


if __name__ == "__main__":
    main()
