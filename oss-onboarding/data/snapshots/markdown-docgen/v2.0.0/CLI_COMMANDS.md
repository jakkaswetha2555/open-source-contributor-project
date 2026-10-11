# CLI Command Reference - Markdown Docgen

Markdown Docgen provides a rich set of command-line arguments.

## Commands

### `docgen build`
Generates documentation from input files.
```bash
docgen build [options] [patterns...]
```

**Options:**
- `-o, --output <dir>`: Target directory for generated documentation (default: `./docs`).
- `-f, --format <type>`: Output format (`github`, `docusaurus`, `table`, `json`).
- `-t, --theme <theme>`: Syntax highlighting color scheme.
- `--include-private`: Include functions and classes marked `@private`.
- `--dry-run`: Parse and validate without writing files to disk.

### `docgen lint`
Checks code comments for missing documentation tags, invalid type annotations, or broken markdown links.
```bash
docgen lint src/
```

### `docgen init`
Creates a default `.docgenrc.json` configuration file in the current working directory.
```bash
docgen init
```
