#!/bin/sh
set -eu

# Parses arguments from the Node worker and invokes your miner binary.
# Place your Linux-compatible miner binary in the same folder (mounted at /miner inside the container),
# for example as ./vanity or set MINER_CMD to a full command string.

MODE=""
PREFIX=""
SUFFIX=""
LEN=""

while [ $# -gt 0 ]; do
  case "$1" in
    --prefix)
      MODE="prefix"
      PREFIX="${2:-}"
      shift 2
      ;;
    --suffix)
      MODE="suffix"
      SUFFIX="${2:-}"
      shift 2
      ;;
    --combo)
      MODE="combo"
      PREFIX="${2:-}"
      SUFFIX="${3:-}"
      shift 3
      ;;
    --len)
      LEN="${2:-}"
      shift 2
      ;;
    *)
      shift 1
      ;;
  esac
done

# Build arg vector for the underlying miner
set --
case "$MODE" in
  prefix)
    set -- "$@" --prefix "$PREFIX" --len "$LEN"
    ;;
  suffix)
    set -- "$@" --suffix "$SUFFIX" --len "$LEN"
    ;;
  combo)
    set -- "$@" --combo "$PREFIX" "$SUFFIX"
    ;;
  *)
    echo "Error: Unknown mode or missing arguments" >&2
    exit 2
    ;;
esac

# Prefer a local executable named 'vanity' or 'vanity_farm'.
# You can also export MINER_CMD to provide a full command.
if [ -x "./vanity" ]; then
  exec ./vanity "$@"
elif [ -x "./vanity_farm" ]; then
  exec ./vanity_farm "$@"
elif [ -n "${MINER_CMD:-}" ]; then
  # Split MINER_CMD into words and append our collected args, then exec
  # shellcheck disable=SC2086
  set -- $MINER_CMD "$@"
  cmd="$1"
  shift
  exec "$cmd" "$@"
else
  echo "Error: No miner found in /miner. Place your binary as /miner/vanity (chmod +x) or set MINER_CMD." >&2
  exit 127
fi


