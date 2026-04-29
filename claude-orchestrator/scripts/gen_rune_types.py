#!/usr/bin/env python3
"""
Generate claude_orchestrator/_rune_types.py from bifrost Go struct definitions.

Reads:
  ../../bifrost/domain/projectors/rune_detail.go
  ../../bifrost/domain/projectors/rune_retro_projector.go

Emits:
  ../claude_orchestrator/_rune_types.py

Run after any change to RuneDetail or its sub-structs in Go.
"""

import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent.parent
PROJECTORS_DIR = REPO_ROOT / "bifrost" / "domain" / "projectors"
OUTPUT = SCRIPT_DIR.parent / "claude_orchestrator" / "_rune_types.py"

GO_SOURCES = [
    PROJECTORS_DIR / "rune_detail.go",
    PROJECTORS_DIR / "rune_retro_projector.go",
]

# Go type → Python type
GO_TYPE_MAP = {
    "string": "str",
    "int": "int",
    "int64": "int",
    "float64": "float",
    "bool": "bool",
    "time.Time": "datetime",
}

STRUCT_RE = re.compile(r"type (\w+) struct \{([^}]*)\}", re.DOTALL)
FIELD_RE = re.compile(
    r"""
    ^\s*
    (?P<names>[\w,\s]+?)   # one or more field names (possibly comma-grouped)
    \s+
    (?P<gotype>\[\])?      # optional slice prefix
    (?P<type>[\w.]+)       # type name
    \s*
    `json:"(?P<json>[^"]+)"`  # json tag
    """,
    re.VERBOSE | re.MULTILINE,
)


def parse_structs(source: str) -> dict[str, list[tuple[str, str, str]]]:
    """Return {StructName: [(field_name, python_type, json_key), ...]}"""
    structs = {}
    for m in STRUCT_RE.finditer(source):
        struct_name = m.group(1)
        body = m.group(2)
        fields = []
        for fm in FIELD_RE.finditer(body):
            names = [n.strip() for n in fm.group("names").split(",")]
            go_type = fm.group("type")
            is_slice = fm.group("gotype") is not None
            json_key_raw = fm.group("json")
            # Strip omitempty etc.
            json_key = json_key_raw.split(",")[0]
            if json_key == "-":
                continue
            py_type = GO_TYPE_MAP.get(go_type, go_type)  # unknown = keep as-is
            if is_slice:
                py_type = f"list[{py_type}]"
            for name in names:
                if name:
                    fields.append((name, py_type, json_key))
        structs[struct_name] = fields
    return structs


def snake(name: str) -> str:
    """GoFieldName → python_field_name"""
    s = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", name)
    s = re.sub(r"([a-z\d])([A-Z])", r"\1_\2", s)
    return s.lower()


def emit_dataclass(name: str, fields: list[tuple[str, str, str]], all_structs: set[str]) -> str:
    lines = [f"@dataclass(frozen=True)"]
    lines.append(f"class {name}:")

    # Build from_dict classmethod body
    from_dict_lines = []
    field_lines = []

    for go_name, py_type, json_key in fields:
        py_name = snake(go_name)
        # Determine from_dict conversion
        raw_expr = f'raw.get("{json_key}")'

        # Nested struct?
        inner_type = py_type
        is_list = py_type.startswith("list[")
        if is_list:
            inner_type = py_type[5:-1]

        if inner_type == "datetime":
            if is_list:
                conv = f"[_parse_dt(v) for v in ({raw_expr} or [])]"
            else:
                conv = f"_parse_dt({raw_expr})"
        elif inner_type in all_structs:
            if is_list:
                conv = f"[{inner_type}.from_dict(v) for v in ({raw_expr} or [])]"
            else:
                conv = f"{inner_type}.from_dict({raw_expr} or {{}})"
        elif is_list:
            conv = f"list({raw_expr} or [])"
        else:
            default = '""' if py_type == "str" else "0" if py_type == "int" else "0.0" if py_type == "float" else "False"
            conv = f"{raw_expr} or {default}"

        field_lines.append(f"    {py_name}: {py_type}")
        from_dict_lines.append(f"            {py_name}={conv},")

    lines.extend(field_lines)
    lines.append("")
    lines.append("    @classmethod")
    lines.append("    def from_dict(cls, raw: dict) -> \"" + name + "\":")
    lines.append("        return cls(")
    lines.extend(from_dict_lines)
    lines.append("        )")

    return "\n".join(lines)


def main() -> None:
    combined = ""
    for src in GO_SOURCES:
        if not src.exists():
            print(f"ERROR: {src} not found", file=sys.stderr)
            sys.exit(1)
        combined += src.read_text()

    structs = parse_structs(combined)
    all_struct_names = set(structs.keys())

    # Emit order: sub-types before RuneDetail
    emit_order = [
        "DependencyRef",
        "NoteEntry",
        "ACEntry",
        "RetroEntry",
        "RuneDetail",
    ]

    out_lines = [
        "# AUTO-GENERATED — do not edit by hand.",
        "# Run scripts/gen_rune_types.py to regenerate from Go source.",
        "#",
        "# Source: bifrost/domain/projectors/rune_detail.go",
        "#         bifrost/domain/projectors/rune_retro_projector.go",
        "",
        "from __future__ import annotations",
        "",
        "from dataclasses import dataclass",
        "from datetime import datetime, timezone",
        "",
        "",
        "def _parse_dt(v: str | None) -> datetime:",
        '    if not v:',
        '        return datetime(1970, 1, 1, tzinfo=timezone.utc)',
        '    if isinstance(v, datetime):',
        '        return v',
        '    return datetime.fromisoformat(v.replace("Z", "+00:00"))',
        "",
        "",
    ]

    for name in emit_order:
        if name not in structs:
            print(f"WARNING: struct {name!r} not found in Go sources", file=sys.stderr)
            continue
        out_lines.append(emit_dataclass(name, structs[name], all_struct_names))
        out_lines.append("")
        out_lines.append("")

    # Alias RuneDetail → Rune
    out_lines.append("# Public alias — import as Rune throughout the package")
    out_lines.append("Rune = RuneDetail")
    out_lines.append("")

    OUTPUT.write_text("\n".join(out_lines))
    print(f"Generated {OUTPUT}")


if __name__ == "__main__":
    main()
