# Architecture - Markdown Docgen

## Processing Pipeline
Markdown Docgen operates as a multi-stage compilation pipeline:

```
[Input Files (.js, .ts, .md)]
             │
             ▼
      [File Scanner]
             │
             ▼
     [AST / JSDoc Parser]
             │
             ▼
   [Intermediate Schema / IR]
             │
             ▼
     [Formatters & Renderers] (Tables, Code Blocks, Frontmatter)
             │
             ▼
  [Output Markdown Documents]
```

## Core Modules
- `bin/docgen.js`: CLI entry point using Commander.
- `src/scanner.js`: Discovers input source files, handles ignore patterns (`.gitignore`, `.docgenignore`).
- `src/parser/`: Extracts comments, docstrings, function signatures, and types.
- `src/renderers/`: Markdown template engine that formats parsed objects into clean markdown.
- `src/utils/`: Frontmatter extraction, file system helpers, and string transformers.
