{
  "description": "Automatically trigger build processes when source files change. Detects common build tools and runs appropriate build commands.",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ -f package.json ]] && grep -q '\"build\"' package.json; then npm run build 2>/dev/null || yarn build 2>/dev/null || true; elif [[ -f Makefile ]]; then make 2>/dev/null || true; elif [[ -f Cargo.toml ]]; then cargo build 2>/dev/null || true; elif [[ -f pom.xml ]]; then mvn compile 2>/dev/null || true; elif [[ -f build.gradle ]]; then ./gradlew build 2>/dev/null || true; fi"
          }
        ]
      }
    ]
  }
}