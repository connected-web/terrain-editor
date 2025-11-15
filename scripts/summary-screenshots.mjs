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
      const title = file.replace(/\.(png|jpg|jpeg)$/i, '')
      const ext = path.extname(file).toLowerCase()
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg'
      content += [
        `### ${title}`,
        `<img src="data:${mime};base64,${base64}" alt="${title}" />`,
      ].join('\n\n')
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
