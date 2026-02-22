#!/usr/bin/env bash
set -euo pipefail

# Security Manifest:
#   Environment variables: none
#   External endpoint host: ru7m5svay1.execute-api.eu-central-1.amazonaws.com
#   External endpoint path: /prod/mcp
#   Local files accessed: none
#   Data sent: league name, matchweek number, team name filters (no PII)
#   Software installation: none

MCP_HOST="ru7m5svay1.execute-api.eu-central-1.amazonaws.com"
MCP_PATH="/prod/mcp"
MCP_SCHEME="https"
MCP_ENDPOINT="${MCP_SCHEME}://${MCP_HOST}${MCP_PATH}"

usage() {
    cat <<'EOF'
Usage: footballbin.sh <command> [options]

Commands:
  tools                              List available MCP tools
  predictions <league> [matchweek]   Get match predictions

Options for predictions:
  --home <team>    Filter by home team
  --away <team>    Filter by away team

Examples:
  footballbin.sh predictions premier_league
  footballbin.sh predictions epl 27
  footballbin.sh predictions premier_league --home arsenal
  footballbin.sh predictions ucl --away barcelona

Leagues: premier_league, epl, pl, prem, champions_league, ucl, cl
EOF
    exit 1
}

# Call the MCP endpoint with a JSON-RPC payload
mcp_call() {
    local payload="$1"
    curl --fail --show-error --silent --max-time 20 -X POST "$MCP_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "$payload"
}

# Restrict values to expected characters to avoid malformed JSON arguments.
validate_slug() {
    local value="$1"
    [[ "$value" =~ ^[a-zA-Z0-9_-]+$ ]]
}

validate_team() {
    local value="$1"
    [[ "$value" =~ ^[a-zA-Z0-9._-]+$ ]]
}

# List available tools
cmd_tools() {
    local payload='{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
    local response
    response=$(mcp_call "$payload")

    if command -v jq &>/dev/null; then
        echo "$response" | jq '.result.tools[] | {name, description}'
    else
        echo "$response"
    fi
}

# Get match predictions
cmd_predictions() {
    local league=""
    local matchweek=""
    local home_team=""
    local away_team=""

    # Parse arguments
    if [[ $# -lt 1 ]]; then
        echo "Error: league is required" >&2
        usage
    fi

    league="$1"
    if ! validate_slug "$league"; then
        echo "Error: invalid league value '$league'" >&2
        exit 1
    fi
    shift

    # Check if next arg is a matchweek number
    if [[ $# -gt 0 && "$1" =~ ^[0-9]+$ ]]; then
        matchweek="$1"
        shift
    fi

    # Parse optional flags
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --home)
                shift
                home_team="${1:-}"
                if [[ -z "$home_team" ]] || ! validate_team "$home_team"; then
                    echo "Error: invalid --home team value" >&2
                    exit 1
                fi
                shift
                ;;
            --away)
                shift
                away_team="${1:-}"
                if [[ -z "$away_team" ]] || ! validate_team "$away_team"; then
                    echo "Error: invalid --away team value" >&2
                    exit 1
                fi
                shift
                ;;
            *)
                echo "Unknown option: $1" >&2
                usage
                ;;
        esac
    done

    # Build arguments JSON
    local args
    args="{\"league\":\"$league\""
    if [[ -n "$matchweek" ]]; then
        args="$args,\"matchweek\":$matchweek"
    fi
    if [[ -n "$home_team" ]]; then
        args="$args,\"home_team\":\"$home_team\""
    fi
    if [[ -n "$away_team" ]]; then
        args="$args,\"away_team\":\"$away_team\""
    fi
    args="$args}"

    local payload="{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"get_match_predictions\",\"arguments\":$args}}"

    local response
    response=$(mcp_call "$payload")

    if command -v jq &>/dev/null; then
        # Check for errors
        local is_error
        is_error=$(echo "$response" | jq -r '.result.isError // false')
        if [[ "$is_error" == "true" ]]; then
            echo "Error: $(echo "$response" | jq -r '.result.content[0].text')" >&2
            exit 1
        fi

        # Format output
        echo "$response" | jq -r '
            .result.structuredContent |
            "League: \(.league) | Matchweek: \(.matchweek) | Matches: \(.count)",
            "",
            (.matches[] |
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
                "\(.home_team) vs \(.away_team)",
                "Kickoff: \(.kickoff_formatted) (\(.status))",
                (.predictions[] | "  \(.type): \(.value)"),
                (.key_players[] | "  Key: \(.player_name) - \(.reason)"),
                ""
            )
        '
    else
        echo "$response"
    fi
}

# Main dispatch
if [[ $# -lt 1 ]]; then
    usage
fi

command="$1"
shift

case "$command" in
    tools)
        cmd_tools
        ;;
    predictions)
        cmd_predictions "$@"
        ;;
    *)
        echo "Unknown command: $command" >&2
        usage
        ;;
esac
