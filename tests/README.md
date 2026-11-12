# Keyboard regression tests

These tests open the local HTML file, supply synthetic posts, and block external requests. They never contact Reddit or the deployed proxy. No server or deployment is needed.

Install test tooling in a Python virtual environment:

```sh
python -m venv .venv
. .venv/bin/activate
pip install playwright
python -m playwright install chromium
python -m unittest discover -s tests -v
```

Set `CHROMIUM_EXECUTABLE` to use an existing Chromium installation instead.

Coverage: actual Tab navigation, visible focus, Enter/Space signal toggling, pressed state, retained focus, filtered results, last-active-filter guard, pointer toggling, labeled slider, keyboard post selection, and a 390px viewport. This focused suite is not a full WCAG audit or a substitute for screen-reader testing.
