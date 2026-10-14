#!/usr/bin/env bash
# Fails if component code under web/src contains hex colours, literal px sizes or arbitrary Tailwind values.
# Every colour, size, radius, shadow and spacing value lives in web/tailwind.config.ts.
set -u
cd "$(dirname "$0")/.." || exit 1

status=0
check() {
  local label="$1" pattern="$2"
  local hits
  hits=$(grep -rnE --include='*.ts' --include='*.tsx' --include='*.css' "$pattern" web/src || true)
  if [ -n "$hits" ]; then
    echo "FAIL: $label"
    echo "$hits"
    status=1
  fi
}

check "hex colour" '#[0-9a-fA-F]{3,8}\b'
check "literal px value" '[0-9]+(\.[0-9]+)?px'
check "arbitrary Tailwind value" '\b[a-z-]+-\[[^]]+\]'
check "rgb()/rgba()/hsl() colour" '\b(rgb|rgba|hsl|hsla)\('

if [ "$status" -eq 0 ]; then
  echo "check-tokens: no literal colour or size values in web/src"
fi
exit "$status"
