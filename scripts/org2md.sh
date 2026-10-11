#!/bin/bash
# Convert Org-mode files to Markdown using Pandoc
# Usage: ./scripts/org2md.sh input.org > src/content/blog/output.md

if [ -z "$1" ]; then
  echo "Usage: $0 <input.org>" >&2
  exit 1
fi

if ! command -v pandoc &> /dev/null; then
  echo "Error: pandoc is not installed." >&2
  echo "Install it: https://pandoc.org/installing.html" >&2
  exit 1
fi

pandoc "$1" -t markdown --wrap=none
