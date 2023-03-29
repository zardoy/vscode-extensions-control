//@ts-check
const tjs = require('typescript-json-schema')
const { defineConfig } = require('@zardoy/vscode-utils/build/defineConfig.cjs')
const { patchPackageJson } = require('@zardoy/vscode-utils/build/patchPackageJson.cjs')
const fs = require('fs')

const generateSchema = tjs.generateSchema
tjs.generateSchema = (program, fullTypeName, args) => {
    return generateSchema(program, fullTypeName, {
        ...args,
        ignoreErrors: true,
    })
}

fs.mkdirSync('./out', { recursive: true })
fs.copyFileSync('./node_modules/source-map/lib/mappings.wasm', './out/mappings.wasm')

patchPackageJson({})

module.exports = defineConfig({
    consoleStatements: false,
    development: {
        disableExtensions: false,
    },
})
