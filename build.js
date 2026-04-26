const esbuild = require("esbuild");

esbuild
    .build({
        entryPoints: ["extension.js"],
        bundle: true,
        outfile: "dist/extension.js",
        external: ["vscode", "@salesforce/core", "@salesforce/source-deploy-retrieve"],
        format: "cjs",
        platform: "node",
        target: "node18",
    })
    .catch(() => process.exit(1));
