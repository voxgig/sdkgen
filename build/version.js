#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Read package.json to get the version
const packageJsonPath = path.join(__dirname, '..', 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
const version = packageJson.version

// Read the bin file
const binFilePath = path.join(__dirname, '..', 'bin', 'voxgig-sdkgen')
let binContent = fs.readFileSync(binFilePath, 'utf8')

// Replace the VERSION constant idempotently
// This regex matches: const VERSION = 'any-content-or-empty'
const versionRegex = /const VERSION = '[^']*'/
const replacement = `const VERSION = '${version}'`

if (!versionRegex.test(binContent)) {
  console.error('Error: Could not find "const VERSION = \'...\'" in', binFilePath)
  process.exit(1)
}

binContent = binContent.replace(versionRegex, replacement)

// Write back the updated content
fs.writeFileSync(binFilePath, binContent, 'utf8')
