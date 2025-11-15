import { promises as fs } from 'node:fs'
import path from 'node:path'

const summaryPath = process.env.GITHUB_STEP_SUMMARY
if (!summaryPath) {
  process.exit(0)
}

const screenshotDir = path.join(process.cwd(), 'test-results', 'screenshots')

const run = async () => {
  try {
    const files = await fs.readdir(screenshotDir)
    if (!files.length) return
    let content = '## Playwright Screenshots\n\n'
    for (const file of files.sort()) {
      const filePath = path.join(screenshotDir, file)
      const data = await fs.readFile(filePath)
      const base64 = data.toString('base64')
      const title = file.replace(/\.png$/i, '')
      content += `### ${title}\n\n` +
        `![${title}](data:image/png;base64,${base64})\n\n`
    }
    await fs.appendFile(summaryPath, content)
  } catch (err) {
    if (err.code === 'ENOENT') return
    throw err
  }
}

run()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
