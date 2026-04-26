# omnistudio-formatter

[![CI](https://github.com/PalGenadich/omnistudio-prettier/actions/workflows/ci.yml/badge.svg)](https://github.com/PalGenadich/omnistudio-prettier/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/omnistudio-formatter)](https://www.npmjs.com/package/omnistudio-formatter)
[![npm downloads](https://img.shields.io/npm/dm/omnistudio-formatter)](https://www.npmjs.com/package/omnistudio-formatter)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](../LICENSE)

Node.js library that formats and minifies Salesforce Omnistudio metadata XML files.

- **Pretty-prints embedded JSON** inside OmniScript, FlexCard, Integration Procedure, and Data Mapper XML fields
- **Sorts Data Mapper items** by `globalKey` for deterministic diffs
- **Minifies JSON** before deploy to keep payloads small

## Installation

```sh
npm install omnistudio-formatter
```

## CLI

```sh
# Install globally to use the CLI
npm install -g omnistudio-formatter
```

```
Usage: omnistudio-formatter <command> [options] <path>

Commands:
  format <path>   Format a file or all Omnistudio files in a directory
  minify <path>   Minify a file or all Omnistudio files in a directory

Options:
  --indent, -i <n>   Indentation: tab (default), 2, or 4 spaces
```

**Examples**

```sh
# Format all files in a directory
omnistudio-formatter format force-app/main/default/omnistudio

# Format a single file with 2-space indent
omnistudio-formatter format MyScript.os-meta.xml --indent 2

# Minify a single file before deploying
omnistudio-formatter minify MyScript.os-meta.xml

# Minify all files in a directory
omnistudio-formatter minify force-app/ --indent 4
```

## API

```js
const { formatFile, formatFileContent, formatDirectory, minifyFile } = require("omnistudio-formatter");
```

All functions are synchronous.

### `formatFileContent(filePath, content, indent?)`

Pure in-memory formatter — reads nothing, writes nothing. Returns a result object.

```js
const result = formatFileContent(
    "MyOmniScript.os-meta.xml",
    xmlString,
    "\t", // optional: "\t" (default), "  ", or "    "
);

console.log(result.changed); // true if formatting changed the content
console.log(result.formatted); // formatted XML string (only present when changed)
console.log(result.message); // human-readable status message
```

### `formatFile(filePath, indent?)`

Reads a file, formats it, and writes it back if changed.

```js
const result = formatFile("path/to/MyFlexCard.ouc-meta.xml", "\t");
console.log(result.message); // "Formatted: ..." or "Already formatted: ..."
```

### `formatDirectory(dirPath, indent?)`

Formats all Omnistudio XML files under a directory recursively.

```js
const results = formatDirectory("force-app/main/default", "\t");
results.forEach((r) => console.log(r.message));
```

### `minifyFile(filePath, indent?)`

Compacts embedded JSON in the file (for use before deploying to an org). Reads and writes the file on disk.

```js
const result = minifyFile("path/to/MyScript.os-meta.xml", "\t");
console.log(result.changed); // true if the file was changed
```

## Return values

All functions return a result object:

| Field       | Type      | Description                                                    |
| ----------- | --------- | -------------------------------------------------------------- |
| `filePath`  | `string`  | Path passed to the function                                    |
| `changed`   | `boolean` | Whether the content was modified                               |
| `formatted` | `string`  | The formatted/minified content (only when `changed` is `true`) |
| `message`   | `string`  | Human-readable status message                                  |

## Supported metadata types

| File extension  | Metadata type                   | JSON fields formatted                                                                       |
| --------------- | ------------------------------- | ------------------------------------------------------------------------------------------- |
| `.os-meta.xml`  | OmniScript                      | `propertySetConfig`                                                                         |
| `.oip-meta.xml` | OmniIntegrationProcedure        | `customJavaScript`                                                                          |
| `.ouc-meta.xml` | OmniUiCard (FlexCard)           | `dataSourceConfig`, `propertySetConfig`, `sampleDataSourceResponse`, `stylingConfiguration` |
| `.rpt-meta.xml` | OmniDataTransform (Data Mapper) | `expectedInputJson`, `expectedOutputJson`                                                   |

## License

[GPL-3.0](../LICENSE)
