#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../" && pwd)"
SETTINGS_FILE="$PROJECT_ROOT/.vscode/settings.json"
PYPROJECT="$PROJECT_ROOT/orchestrator/pyproject.toml"

update_paths() {
    local members=$(grep -A2 '\[tool.uv.workspace\]' "$PYPROJECT" | grep 'members' | sed 's/.*= \[\(.*\)\].*/\1/' | tr -d '"')

    if [[ -z "$members" ]]; then
        return
    fi

    local extra_paths="["
    local first=true
    local pattern="${members//\*/*}"

    for dir in $(find "$PROJECT_ROOT/orchestrator/packages" -maxdepth 1 -type d); do
        if [[ "$dir" == *"packages"* ]]; then
            local rel_path="${dir#$PROJECT_ROOT/}"
            local src_path="${rel_path}/src"
            if [[ -d "${dir}/src" ]]; then
                if [[ "$first" == true ]]; then
                    extra_paths+="\"${src_path}\""
                    first=false
                else
                    extra_paths+=", \"${src_path}\""
                fi
            fi
        fi
    done
    extra_paths+="]"

    if [[ -f "$SETTINGS_FILE" ]]; then
        if grep -q '"python.analysis.extraPaths"' "$SETTINGS_FILE"; then
            tmp_file=$(mktemp)
            jq --arg paths "$extra_paths" '."python.analysis.extraPaths" = $paths | .["python.analysis.extraPaths"] = ($paths | fromjson)' "$SETTINGS_FILE" > "$tmp_file" && mv "$tmp_file" "$SETTINGS_FILE"
        else
            tmp_file=$(mktemp)
            jq --argjson paths "$extra_paths" '. + {"python.analysis.extraPaths": $paths}' "$SETTINGS_FILE" > "$tmp_file" && mv "$tmp_file" "$SETTINGS_FILE"
        fi
    else
        echo "{\"python.analysis.extraPaths\": $extra_paths}" > "$SETTINGS_FILE"
    fi
}

update_paths

if command -v inotifywait &> /dev/null; then
    while inotifywait -e modify,create,delete "$PYPROJECT" 2>/dev/null; do
        sleep 0.1
        update_paths
    done
fi
