import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const manifestPath = resolve('dist/.vite/manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const entries = Object.values(manifest).filter(chunk => chunk.isEntry)

if (entries.length !== 1) {
  throw new Error(`Expected one frontend entry chunk, found ${entries.length}`)
}

const byFile = new Map(Object.values(manifest).map(chunk => [chunk.file, chunk]))
const initialFiles = new Set()

function includeStaticImports(chunk) {
  if (!chunk || initialFiles.has(chunk.file)) return
  initialFiles.add(chunk.file)
  for (const importedFile of chunk.imports ?? []) {
    includeStaticImports(byFile.get(importedFile))
  }
}

includeStaticImports(entries[0])

const javascriptFiles = [...initialFiles].filter(file => file.endsWith('.js'))
const measurements = javascriptFiles.map(file => {
  const contents = readFileSync(resolve('dist', file))
  return {
    file,
    rawBytes: contents.byteLength,
    gzipBytes: gzipSync(contents).byteLength,
  }
})

const totalRawBytes = measurements.reduce((total, item) => total + item.rawBytes, 0)
const totalGzipBytes = measurements.reduce((total, item) => total + item.gzipBytes, 0)
// Keep enough headroom for normal maintenance while preventing a return to
// the former single 900+ KiB entry bundle.
const rawBudgetBytes = 325 * 1024
const gzipBudgetBytes = 100 * 1024

for (const item of measurements) {
  console.log(`${item.file}: ${(item.rawBytes / 1024).toFixed(1)} KiB raw, ${(item.gzipBytes / 1024).toFixed(1)} KiB gzip`)
}
console.log(`Initial JavaScript: ${(totalRawBytes / 1024).toFixed(1)} KiB raw, ${(totalGzipBytes / 1024).toFixed(1)} KiB gzip`)
console.log(`Budget: ${(rawBudgetBytes / 1024).toFixed(0)} KiB raw, ${(gzipBudgetBytes / 1024).toFixed(0)} KiB gzip`)

if (totalRawBytes > rawBudgetBytes || totalGzipBytes > gzipBudgetBytes) {
  throw new Error('Frontend initial JavaScript exceeds the enforced production budget')
}
