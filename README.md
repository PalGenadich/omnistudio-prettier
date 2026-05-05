# Omnistudio Prettier

[![CI](https://github.com/PalGenadich/omnistudio-prettier/actions/workflows/ci.yml/badge.svg)](https://github.com/PalGenadich/omnistudio-prettier/actions/workflows/ci.yml)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)

A VS Code extension that formats Salesforce Omnistudio metadata XML files. It pretty-prints embedded JSON, sorts Data Mapper items deterministically, and minifies on deploy so diffs stay readable and whitespace doesn't consume the character limit (on deployment).

## Features

- **Format on save** — automatically formats Omnistudio files when you save them in VS Code
- **Format on retrieve** — after retrieving source from an org, files are formatted before being written to disk
- **Minify on deploy** — before deploying, embedded JSON is compacted to reduce payload size; the file is re-formatted after deploy completes
- **Format directory** — right-click any folder in the Explorer and format all Omnistudio files inside it
- **Format workspace** — format every Omnistudio file in the open workspace in one command
- **Pretty JSON** — expands minified JSON stored in Omnistudio XML fields
- **Sorted Data Mapper items** — `omniDataTransformItem` entries are sorted by `globalKey` so field-level diffs are meaningful

## Supported file types

| Extension       | Metadata type                   |
| --------------- | ------------------------------- |
| `.os-meta.xml`  | OmniScript                      |
| `.oip-meta.xml` | OmniIntegrationProcedure        |
| `.ouc-meta.xml` | OmniUiCard (FlexCard)           |
| `.rpt-meta.xml` | OmniDataTransform (Data Mapper) |

## Installation

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=pavlo-kashko.omnistudio-prettier).

The extension activates automatically in any workspace that contains an `sfdx-project.json` file.

## Commands

All commands are available from the Command Palette (`Ctrl+Shift+P`) and, where applicable, via right-click in the Explorer.

| Command                                     | Description                                                           |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `Omnistudio: Format All Files in Directory` | Format all Omnistudio files in the selected folder                    |
| `Omnistudio: Format All Files in Workspace` | Format all Omnistudio files in the workspace                          |
| `Omnistudio: Retrieve This Source from Org` | Retrieve selected file(s) or folder from the default org, then format |
| `Omnistudio: Deploy This Source to Org`     | Minify, deploy selected file(s) or folder, then re-format             |

## Settings

| Setting                                 | Default    | Description                                                   |
| --------------------------------------- | ---------- | ------------------------------------------------------------- |
| `omnistudio-prettier.indent`            | `\t` (tab) | Indentation used when formatting — tab, 2 spaces, or 4 spaces |
| `omnistudio-prettier.showNotifications` | `true`     | Show a notification after formatting or retrieve completes    |

## Repository structure

```
omnistudio-prettier/       VS Code extension
omnistudio-formatter/      Standalone npm package (formatter core)
```

The formatter logic lives in the [`omnistudio-formatter`](omnistudio-formatter/) npm package and can be used independently of VS Code — see its [README](omnistudio-formatter/README.md).

## License

[GPL-3.0](LICENSE)
