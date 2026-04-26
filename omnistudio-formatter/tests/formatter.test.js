const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { formatFile, formatFileContent, minifyFile } = require("../index.js");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const OMNISCRIPT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<OmniScript xmlns="http://soap.sforce.com/2006/04/metadata">
    <propertySetConfig>{"layout":"vertical","pubsub":false}</propertySetConfig>
</OmniScript>`;

const OMNISCRIPT_XML_FORMATTED = `<?xml version="1.0" encoding="UTF-8"?>
<OmniScript xmlns="http://soap.sforce.com/2006/04/metadata">
\t<propertySetConfig>
\t{
\t\t"layout": "vertical",
\t\t"pubsub": false
\t}
\t</propertySetConfig>
</OmniScript>`;

const OMNI_DATA_TRANSFORM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<OmniDataTransform xmlns="http://soap.sforce.com/2006/04/metadata">
    <expectedInputJson>{"input":true}</expectedInputJson>
    <omniDataTransformItem>
        <globalKey>zzz-last</globalKey>
    </omniDataTransformItem>
    <omniDataTransformItem>
        <globalKey>aaa-first</globalKey>
    </omniDataTransformItem>
</OmniDataTransform>`;

const FLEXCARD_XML = `<?xml version="1.0" encoding="UTF-8"?>
<OmniUiCard xmlns="http://soap.sforce.com/2006/04/metadata">
    <dataSourceConfig>{"type":"SOQL"}</dataSourceConfig>
    <propertySetConfig>{"width":"full"}</propertySetConfig>
</OmniUiCard>`;

const NON_OMNISTUDIO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>My Object</label>
</CustomObject>`;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function tmpFile(name, content) {
    const filePath = path.join(os.tmpdir(), name);
    fs.writeFileSync(filePath, content, "utf-8");
    return filePath;
}

// ─────────────────────────────────────────────────────────────────────────────
// formatFileContent
// ─────────────────────────────────────────────────────────────────────────────

describe("formatFileContent", () => {
    it("pretty-prints JSON fields in OmniScript", () => {
        const result = formatFileContent("test.os-meta.xml", OMNISCRIPT_XML, "\t");
        assert.equal(result.changed, true);
        assert.ok(result.formatted.includes('"layout": "vertical"'), "JSON should be expanded");
        assert.ok(!result.formatted.includes('{"layout":"vertical"'), "compact JSON should be gone");
    });

    it("pretty-prints multiple JSON fields in FlexCard", () => {
        const result = formatFileContent("test.ouc-meta.xml", FLEXCARD_XML, "\t");
        assert.equal(result.changed, true);
        assert.ok(result.formatted.includes('"type": "SOQL"'), "dataSourceConfig should be expanded");
        assert.ok(result.formatted.includes('"width": "full"'), "propertySetConfig should be expanded");
    });

    it("sorts OmniDataTransform items by globalKey", () => {
        const result = formatFileContent("test.rpt-meta.xml", OMNI_DATA_TRANSFORM_XML, "\t");
        assert.equal(result.changed, true);
        const aaaIdx = result.formatted.indexOf("aaa-first");
        const zzzIdx = result.formatted.indexOf("zzz-last");
        assert.ok(aaaIdx < zzzIdx, "aaa-first should appear before zzz-last after sort");
    });

    it("returns changed=false when content is already formatted", () => {
        const firstPass = formatFileContent("test.os-meta.xml", OMNISCRIPT_XML, "\t");
        assert.equal(firstPass.changed, true);
        const secondPass = formatFileContent("test.os-meta.xml", firstPass.formatted, "\t");
        assert.equal(secondPass.changed, false, "second format of already-formatted content should be idempotent");
    });

    it("skips files that are not Omnistudio metadata", () => {
        const result = formatFileContent("test.xml", NON_OMNISTUDIO_XML, "\t");
        assert.equal(result.changed, false);
        assert.ok(result.message.includes("Skipped"), "message should say Skipped");
    });

    it("skips files whose filename does not match the Omnistudio pattern (formatFile)", () => {
        const filePath = tmpFile("custom-object.xml", OMNISCRIPT_XML);
        const result = formatFile(filePath, "\t");
        assert.equal(result.changed, false);
        assert.ok(result.message.includes("Skipped"));
    });

    it("respects 2-space indent", () => {
        const result = formatFileContent("test.os-meta.xml", OMNISCRIPT_XML, "  ");
        assert.equal(result.changed, true);
        assert.ok(result.formatted.includes('  "layout"'), "should use 2-space indent in JSON");
    });

    it("leaves non-JSON XML content untouched", () => {
        const result = formatFileContent("test.rpt-meta.xml", OMNI_DATA_TRANSFORM_XML, "\t");
        assert.equal(result.changed, true);
        assert.ok(result.formatted.includes("zzz-last"), "non-JSON content should be preserved");
    });

    it("handles invalid JSON gracefully (leaves as-is)", () => {
        const badJson = OMNISCRIPT_XML.replace('{"layout":"vertical","pubsub":false}', "{not valid json}");
        const result = formatFileContent("test.os-meta.xml", badJson, "\t");
        assert.ok(result.formatted.includes("{not valid json}"), "invalid JSON should be left unchanged");
    });

    it("returns filePath in result", () => {
        const result = formatFileContent("test.os-meta.xml", OMNISCRIPT_XML, "\t");
        assert.equal(result.filePath, "test.os-meta.xml");
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// minifyFile
// ─────────────────────────────────────────────────────────────────────────────

describe("minifyFile", () => {
    it("minifies pretty-printed JSON fields", () => {
        const firstPass = formatFileContent("test.os-meta.xml", OMNISCRIPT_XML, "\t");
        const filePath = tmpFile("test.os-meta.xml", firstPass.formatted);

        const result = minifyFile(filePath, "\t");
        assert.equal(result.changed, true);

        const written = fs.readFileSync(filePath, "utf-8");
        assert.ok(!written.includes("\n{"), "minified output should not have pretty-printed JSON");
        assert.ok(written.includes('"layout":"vertical"'), "minified JSON should be compact");
    });

    it("returns changed=false when file is already minified", () => {
        const filePath = tmpFile("test-idempotent.os-meta.xml", OMNISCRIPT_XML);
        // First call normalizes XML whitespace and compacts JSON
        minifyFile(filePath, "\t");
        // Second call should find no changes
        const result = minifyFile(filePath, "\t");
        assert.equal(result.changed, false);
    });

    it("skips file not matching Omnistudio pattern", () => {
        const filePath = tmpFile("custom-object.xml", NON_OMNISTUDIO_XML);
        const result = minifyFile(filePath, "\t");
        assert.equal(result.changed, false);
        assert.ok(result.message.includes("Skipped"));
    });

    it("reports an error for missing files", () => {
        const result = minifyFile("/no/such/file.os-meta.xml", "\t");
        assert.equal(result.changed, false);
        assert.ok(result.message.includes("File not found"));
    });
});
