#!/bin/bash
BASE_URL="https://raw.githubusercontent.com/vercel-labs/agent-skills/react-best-practices/skills/react-best-practices/references/rules"

# Async rules
curl -s "$BASE_URL/async-api-routes.md" > async-api-routes.md
curl -s "$BASE_URL/async-defer-await.md" > async-defer-await.md
curl -s "$BASE_URL/async-dependencies.md" > async-dependencies.md
curl -s "$BASE_URL/async-parallel.md" > async-parallel.md
curl -s "$BASE_URL/async-suspense-boundaries.md" > async-suspense-boundaries.md

# Bundle rules
curl -s "$BASE_URL/bundle-barrel-imports.md" > bundle-barrel-imports.md
curl -s "$BASE_URL/bundle-conditional.md" > bundle-conditional.md
curl -s "$BASE_URL/bundle-defer-third-party.md" > bundle-defer-third-party.md
curl -s "$BASE_URL/bundle-dynamic-imports.md" > bundle-dynamic-imports.md
curl -s "$BASE_URL/bundle-preload.md" > bundle-preload.md

# Client rules
curl -s "$BASE_URL/client-event-listeners.md" > client-event-listeners.md
curl -s "$BASE_URL/client-swr-dedup.md" > client-swr-dedup.md

# JavaScript rules
curl -s "$BASE_URL/js-batch-dom-css.md" > js-batch-dom-css.md
curl -s "$BASE_URL/js-cache-function-results.md" > js-cache-function-results.md
curl -s "$BASE_URL/js-cache-property-access.md" > js-cache-property-access.md
curl -s "$BASE_URL/js-cache-storage.md" > js-cache-storage.md
curl -s "$BASE_URL/js-combine-iterations.md" > js-combine-iterations.md
curl -s "$BASE_URL/js-early-exit.md" > js-early-exit.md
curl -s "$BASE_URL/js-hoist-regexp.md" > js-hoist-regexp.md
curl -s "$BASE_URL/js-index-maps.md" > js-index-maps.md
curl -s "$BASE_URL/js-length-check-first.md" > js-length-check-first.md
curl -s "$BASE_URL/js-min-max-loop.md" > js-min-max-loop.md
curl -s "$BASE_URL/js-set-map-lookups.md" > js-set-map-lookups.md
curl -s "$BASE_URL/js-tosorted-immutable.md" > js-tosorted-immutable.md

# Rendering rules
curl -s "$BASE_URL/rendering-activity.md" > rendering-activity.md
curl -s "$BASE_URL/rendering-animate-svg-wrapper.md" > rendering-animate-svg-wrapper.md
curl -s "$BASE_URL/rendering-conditional-render.md" > rendering-conditional-render.md
curl -s "$BASE_URL/rendering-content-visibility.md" > rendering-content-visibility.md
curl -s "$BASE_URL/rendering-hoist-jsx.md" > rendering-hoist-jsx.md
curl -s "$BASE_URL/rendering-hydration-no-flicker.md" > rendering-hydration-no-flicker.md
curl -s "$BASE_URL/rendering-svg-precision.md" > rendering-svg-precision.md

# Re-render rules
curl -s "$BASE_URL/rerender-defer-reads.md" > rerender-defer-reads.md
curl -s "$BASE_URL/rerender-dependencies.md" > rerender-dependencies.md
curl -s "$BASE_URL/rerender-derived-state.md" > rerender-derived-state.md
curl -s "$BASE_URL/rerender-lazy-state-init.md" > rerender-lazy-state-init.md
curl -s "$BASE_URL/rerender-memo.md" > rerender-memo.md
curl -s "$BASE_URL/rerender-transitions.md" > rerender-transitions.md

# Server rules
curl -s "$BASE_URL/server-cache-lru.md" > server-cache-lru.md
curl -s "$BASE_URL/server-cache-react.md" > server-cache-react.md
curl -s "$BASE_URL/server-parallel-fetching.md" > server-parallel-fetching.md
curl -s "$BASE_URL/server-serialization.md" > server-serialization.md

# Advanced rules
curl -s "$BASE_URL/advanced-event-handler-refs.md" > advanced-event-handler-refs.md
curl -s "$BASE_URL/advanced-use-latest.md" > advanced-use-latest.md

echo "Downloaded all rule files successfully!"
