from pathlib import Path
import json

VERSION="2.4.0"

pkg_path=Path("package.json")
pkg=json.loads(pkg_path.read_text())
pkg["version"]=VERSION
pkg_path.write_text(json.dumps(pkg,indent=2)+"\n")

lock_path=Path("package-lock.json")
lock=json.loads(lock_path.read_text())
lock["version"]=VERSION
lock.setdefault("packages",{}).setdefault("",{})["version"]=VERSION
lock_path.write_text(json.dumps(lock,indent=2)+"\n")

changelog=Path("CHANGELOG.md")
text=changelog.read_text()
heading="# Shadow Garden Changelog\n\n"
entry="""## 2.4.0 — Interaction & UX Polish
- Make Library discovery faster with context-aware facet counts, disabled zero-result choices, persistent per-library View/Sort preferences, multi-filter Clear all, actionable empty states, subtle result transitions, and an explicit Another suggestion action for random reading suggestions.
- Add quiet reading-progress rails to Library/Series covers, canonical Unread / Continue / Up next / Finished volume states, and a simple reduced-motion-aware Back to top control for long Series pages.
- Polish Reader interaction with staged loading copy, external-link affordances, tap feedback, and immersive mobile chrome that auto-hides while reading and returns on interaction without obscuring Continuous-mode progress.
- Improve Garden Keeper with dirty-aware Series editing, discard protection, persistent save controls, canonical Novel Updates Genre chips, upload review summaries, safer Trash hierarchy, and focus restoration across dialogs.
- Replace blank or unstable Library/Series startup with geometry-matched Main/Adult skeletons that preserve persisted Compact/Grid preference and apply Adult Series theming before visible loading content can paint.
- Keep all new transitions and loading motion compatible with `prefers-reduced-motion` and add permanent unit/browser regression coverage for the new interaction contracts.

"""
if not text.startswith(heading):
    raise SystemExit("CHANGELOG heading missing")
if "## 2.4.0 — Interaction & UX Polish" not in text:
    changelog.write_text(heading+entry+text[len(heading):])
