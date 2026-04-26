const fs = require("fs");
const path = require("path");
const { XMLParser, XMLBuilder } = require("fast-xml-parser");

// ─────────────────────────────────────────────────────────────────────────────
// Omnistudio metadata type detection
// ─────────────────────────────────────────────────────────────────────────────

const OMNISTUDIO_FILE_PATTERN = /\.(oip|os|ouc|rpt)-meta\.xml$/i;

const METADATA_JSON_FIELDS = {
    OmniUiCard: new Set(["dataSourceConfig", "propertySetConfig", "sampleDataSourceResponse", "stylingConfiguration"]),
    OmniIntegrationProcedure: new Set(["customJavaScript"]),
    OmniScript: new Set(["propertySetConfig"]),
    OmniDataTransform: new Set(["expectedInputJson", "expectedOutputJson"]),
};

function isOmnistudioFile(filePath) {
    return OMNISTUDIO_FILE_PATTERN.test(path.basename(filePath));
}

function detectMetadataType(xmlContent) {
    const match = xmlContent.match(/<(\w+)\s+xmlns=/);
    if (match && match[1] in METADATA_JSON_FIELDS) {
        return match[1];
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// XML helpers
// ─────────────────────────────────────────────────────────────────────────────

let currentIndent = "\t";

const ENTITIES = [
    { regex: new RegExp("&", "g"), val: "&amp;" },
    { regex: new RegExp(">", "g"), val: "&gt;" },
    { regex: new RegExp("<", "g"), val: "&lt;" },
    { regex: new RegExp("'", "g"), val: "&apos;" },
    { regex: new RegExp('"', "g"), val: '"' }, // do not escape quotes
];

const xmlParser = new XMLParser({ ignoreAttributes: false, cdataPropName: "__cdata" });

const builderCache = new Map();

function getBuilder(indent) {
    if (!builderCache.has(indent)) {
        builderCache.set(
            indent,
            new XMLBuilder({
                ignoreAttributes: false,
                cdataPropName: "__cdata",
                format: true,
                indentBy: indent,
                entities: ENTITIES,
            }),
        );
    }
    return builderCache.get(indent);
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

function applyFormattingRules(originalContent, metadataType) {
    const parsed = xmlParser.parse(originalContent);
    const jsonFields = METADATA_JSON_FIELDS[metadataType];
    if (jsonFields) {
        prettyJSON(parsed, jsonFields);
        if (metadataType === "OmniDataTransform") {
            sortOmniDataTransformItems(parsed);
        }
    }
    const formattedContent = getBuilder(currentIndent).build(parsed);
    return { formatted: formattedContent, changed: originalContent !== formattedContent };
}

function prettyJSON(parsed, jsonFields, depth = 0) {
    if (!parsed || typeof parsed !== "object") {
        return;
    }

    for (const key of Object.keys(parsed)) {
        const value = parsed[key];
        if (!value) {
            continue;
        }
        if (Array.isArray(value)) {
            for (const arrayElement of value) {
                prettyJSON(value, jsonFields, depth);
            }
        } else if (typeof value === "object") {
            prettyJSON(value, jsonFields, depth + 1);
        } else if (jsonFields.has(key)) {
            try {
                let pretty = JSON.stringify(JSON.parse(parsed[key]), null, currentIndent);
                const whitespace = currentIndent.repeat(depth);
                pretty = pretty
                    .split("\n")
                    .map((line) => whitespace + line)
                    .join("\n");
                parsed[key] = `\n${pretty}\n` + whitespace;
            } catch {
                // not valid JSON, leave as-is
            }
        }
    }
}

function sortOmniDataTransformItems(parsed) {
    let items = parsed?.OmniDataTransform?.omniDataTransformItem;

    if (!items || !Array.isArray(items)) {
        return;
    }

    items.sort((a, b) => {
        return (a.globalKey || "").localeCompare(b.globalKey || "");
    });

    parsed.OmniDataTransform.omniDataTransformItem = items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public methods
// ─────────────────────────────────────────────────────────────────────────────

function minifyFile(filePath, indent = currentIndent) {
    currentIndent = indent;
    let result = { filePath, changed: false, message: "" };

    if (!fs.existsSync(filePath)) {
        result.message = `File not found: ${filePath}`;
        return result;
    }

    if (!isOmnistudioFile(filePath)) {
        result.message = `Skipped: ${filePath}`;
        return result;
    }

    const originalContent = fs.readFileSync(filePath, "utf-8");
    const metadataType = detectMetadataType(originalContent);

    if (!metadataType) {
        result.message = `Skipped: could not detect Omnistudio metadata type in ${filePath}`;
        return result;
    }

    const { formatted, changed } = applyMinifyRules(originalContent, metadataType);

    if (!changed) {
        result.message = `Already minified: ${filePath}`;
        return result;
    }

    fs.writeFileSync(filePath, formatted, "utf-8");

    result.formatted = formatted;
    result.changed = changed;
    result.message = `Minified: ${filePath}`;
    return result;
}

function applyMinifyRules(originalContent, metadataType) {
    const parsed = xmlParser.parse(originalContent);
    const jsonFields = METADATA_JSON_FIELDS[metadataType];
    if (jsonFields) {
        minifyJSON(parsed, jsonFields);
    }
    const formattedContent = getBuilder(currentIndent).build(parsed);
    return { formatted: formattedContent, changed: originalContent !== formattedContent };
}

function minifyJSON(parsed, jsonFields) {
    if (!parsed || typeof parsed !== "object") {
        return;
    }

    for (const key of Object.keys(parsed)) {
        const value = parsed[key];
        if (!value) {
            continue;
        }
        if (Array.isArray(value)) {
            for (const arrayElement of value) {
                minifyJSON(value, jsonFields);
            }
        } else if (typeof value === "object") {
            minifyJSON(value, jsonFields);
        } else if (jsonFields.has(key)) {
            try {
                let minified = JSON.stringify(JSON.parse(parsed[key]));
                parsed[key] = minified;
            } catch {
                // not valid JSON, leave as-is
            }
        }
    }
}

function formatFile(filePath, indent = currentIndent) {
    let result = { filePath, changed: false, message: "" };

    if (!fs.existsSync(filePath)) {
        result.message = `File not found: ${filePath}`;
        return result;
    }

    if (!isOmnistudioFile(filePath)) {
        result.message = `Skipped: ${filePath}`;
        return result;
    }

    const originalContent = fs.readFileSync(filePath, "utf-8");
    result = formatFileContent(filePath, originalContent, indent);
    if (result.changed) {
        fs.writeFileSync(filePath, result.formatted, "utf-8");
    }
    return result;
}

function formatFileContent(filePath, originalContent, indent = currentIndent) {
    currentIndent = indent;
    let result = { filePath, changed: false, message: "" };
    const metadataType = detectMetadataType(originalContent);

    if (!metadataType) {
        result.message = `Skipped: could not detect Omnistudio metadata type in ${filePath}`;
        return result;
    }

    const { formatted, changed } = applyFormattingRules(originalContent, metadataType);

    if (!changed) {
        result.message = `Already formatted: ${filePath}`;
        return result;
    }

    result.formatted = formatted;
    result.changed = changed;
    result.message = `Formatted: ${filePath}`;
    return result;
}

function formatDirectory(dirPath, indent = currentIndent) {
    const xmlFiles = fs.globSync("**/*.{os,oip,ouc,rpt}-meta.xml", { cwd: dirPath }).map((f) => path.join(dirPath, f));
    const results = [];
    for (const filePath of xmlFiles) {
        results.push(formatFile(filePath, indent));
    }
    return results;
}

module.exports = {
    formatFile,
    formatFileContent,
    formatDirectory,
    minifyFile,
};
