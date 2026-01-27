#!/bin/bash
set -e

# Convert .drawio files to .drawio.png
generated_files=()

for drawio in "$@"; do
  png="${drawio%.drawio}.drawio.png"
  echo "Converting $drawio to $png..."

  # drawio CLI export to PNG with 2x scale for high quality
  if ! drawio -x -f png -s 2 -t -o "$png" "$drawio" 2>/dev/null; then
    echo "✗ drawio PNG export failed for $drawio" >&2
    continue
  fi

  generated_files+=("$png")
  echo "✓ Generated $png"
done

# Stage all generated files at once to avoid index.lock conflicts
if [ ${#generated_files[@]} -gt 0 ]; then
  git add "${generated_files[@]}"
  echo "Staged ${#generated_files[@]} file(s)"
fi
