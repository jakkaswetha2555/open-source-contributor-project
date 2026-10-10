# Formatters Reference - Markdown Docgen

Formatters dictate how parsed syntax trees are transformed into markdown representations.

## Built-In Formatters

### 1. Table Formatter (`table`)
Renders parameter lists, property schemas, and CLI flags as Markdown tables:
```markdown
| Parameter | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | Project identifier |
| `verbose` | `boolean` | No | Enables debug logging |
```

### 2. Collapsible Details Formatter (`github`)
Wraps long method listings in HTML `<details>` and `<summary>` tags for cleaner GitHub preview rendering.

### 3. Frontmatter Formatter
Injects title, description, slug, and category metadata in YAML format at the head of every file:
```yaml
---
id: cli-reference
title: CLI Reference
sidebar_label: CLI
---
```
