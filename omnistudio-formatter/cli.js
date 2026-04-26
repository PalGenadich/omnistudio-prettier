#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const formatter = require("./index.js");

// ─────────────────────────────────────────────────────────────────────────────
// Arg parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
    const result = { command: null, target: null, indent: "\t" };
    for (let i = 0; i < argv.length; i++) {
        if ((argv[i] === "--indent" || argv[i] === "-i") && argv[i + 1]) {
            const val = argv[++i];
            if (val === "2") result.indent = "  ";
            else if (val === "4") result.indent = "    ";
            else result.indent = "\t";
        } else if (!result.command) {
            result.command = argv[i];
        } else if (!result.target) {
            result.target = argv[i];
        }
    }
    return result;
}

function printHelp() {
    console.log(`
Usage: omnistudio-formatter <command> [options] <path>

Commands:
  format <path>   Format a file or all Omnistudio files in a directory
  minify <path>   Minify a file or all Omnistudio files in a directory

Options:
  --indent, -i <n>   Indentation: tab (default), 2, or 4 spaces

Examples:
  omnistudio-formatter format force-app/main/default/omnistudio
  omnistudio-formatter format MyScript.os-meta.xml --indent 2
  omnistudio-formatter minify MyScript.os-meta.xml
  omnistudio-formatter minify force-app/ --indent 4
`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

function getFiles(targetPath) {
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
        return fs.globSync("**/*.{os,oip,ouc,rpt}-meta.xml", { cwd: targetPath }).map((f) => path.join(targetPath, f));
    }
    return [targetPath];
}

function runFormat(targetPath, indent) {
    for (const filePath of getFiles(targetPath)) {
        const result = formatter.formatFile(filePath, indent);
        console.log(result.message);
        if (result.message.startsWith("File not found")) process.exit(1);
    }
}

function runMinify(targetPath, indent) {
    for (const filePath of getFiles(targetPath)) {
        const result = formatter.minifyFile(filePath, indent);
        console.log(result.message);
        if (result.message.startsWith("File not found")) process.exit(1);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

const { command, target, indent } = parseArgs(process.argv.slice(2));

if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
}

if (!target) {
    console.error("Error: path is required\n");
    printHelp();
    process.exit(1);
}

const absolutePath = path.resolve(target);

if (!fs.existsSync(absolutePath)) {
    console.error(`Error: path not found: ${absolutePath}`);
    process.exit(1);
}

if (command === "format") {
    runFormat(absolutePath, indent);
} else if (command === "minify") {
    runMinify(absolutePath, indent);
} else {
    console.error(`Error: unknown command "${command}"\n`);
    printHelp();
    process.exit(1);
}
