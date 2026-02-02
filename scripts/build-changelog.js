import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import semver from 'semver'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const changelogsDir = path.resolve(__dirname, '../changelogs')
const outputFile = path.resolve(__dirname, '../docs/reference/change-log.md')

// 1. Get files and sort them (Newest first usually makes sense for changelogs)
// Note: You might want to sort by Version Number, not just string
let files = fs
  .readdirSync(changelogsDir)
  .filter((file) => file.endsWith('.md'))
  .sort((a, b) => {
    const verA = a.replace('.md', '')
    const verB = b.replace('.md', '')

    // Use semver to compare versions
    const aVer = semver.valid(semver.coerce(verA)) || '0.0.0'
    const bVer = semver.valid(semver.coerce(verB)) || '0.0.0'

    return semver.rcompare(aVer, bVer)
  })

let content = '# Changelog\n\n'
if (files.includes('latest.md')) {
  content += fs.readFileSync(path.join(changelogsDir, 'latest.md'), 'utf-8')
  content += '\n\n---\n'
  files = files.filter((file) => file !== 'latest.md')
}
files.forEach((file) => {
  const version = file.replace('.md', '')

  // Append to content.
  const fileContent = fs.readFileSync(path.join(changelogsDir, file), 'utf-8')
  content += fileContent + '\n\n---\n'
})

// Write to output file.
fs.writeFileSync(outputFile, content)
console.log('✔ docs/reference/change-log.md updated successfully.')
