import { promises as fs } from 'node:fs'
import path from 'node:path'

const marker = '<!-- pr-check-step-summary -->'
const summaryPath = process.env.GITHUB_STEP_SUMMARY
const githubToken = process.env.GITHUB_TOKEN
const githubRepo = process.env.GITHUB_REPOSITORY
const eventPath = process.env.GITHUB_EVENT_PATH
const screenshotDir = path.join(process.cwd(), 'test-results', 'screenshots')

const log = (...args) => console.log('[summary-screenshots]', ...args)
const warn = (...args) => console.warn('[summary-screenshots]', ...args)

const readPullRequestNumber = async () => {
  if (!eventPath) return null
  try {
    const raw = await fs.readFile(eventPath, 'utf8')
    const event = JSON.parse(raw)
    return event?.pull_request?.number ?? null
  } catch (err) {
    warn('Unable to read pull request number from event payload.', err)
    return null
  }
}

const loadScreenshots = async () => {
  const files = await fs.readdir(screenshotDir)
  const screenshots = []
  for (const file of files.sort()) {
    const filePath = path.join(screenshotDir, file)
    const data = await fs.readFile(filePath)
    const title = file.replace(/\.(png|jpg|jpeg)$/i, '')
    const ext = path.extname(file).toLowerCase()
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg'
    screenshots.push({
      file,
      title,
      mime,
      data,
      base64: data.toString('base64'),
    })
  }

  return screenshots
}

const buildSummary = (screenshots) => {
  if (!screenshots.length) return null

  let content = `${marker}\n\n## Playwright Screenshots\n\n`
  for (const screenshot of screenshots) {
    content += [
      `### ${screenshot.title}`,
      `<img src="data:${screenshot.mime};base64,${screenshot.base64}" alt="${screenshot.title}" />`,
    ].join('\n\n')
    content += '\n\n'
  }

  return content.trimEnd() + '\n'
}

const appendStepSummary = async (content) => {
  if (!summaryPath || !content) return
  const stats = await fs.stat(summaryPath).catch(() => null)
  const prefix = stats && stats.size > 0 ? '\n' : ''
  await fs.appendFile(summaryPath, `${prefix}${content}`)
  log('Appended Playwright screenshots to step summary.')
}

const githubRequest = async (url, init) => {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'terrain-editor-playwright-summary',
      ...(init?.headers ?? {}),
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}\n${errorText}`)
  }

  return response
}

const findExistingComment = async (owner, repo, prNumber) => {
  let page = 1
  while (true) {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=100&page=${page}`
    const response = await githubRequest(url)
    const comments = await response.json()
    const match = comments.find((comment) => {
      const body = comment?.body ?? ''
      const login = comment?.user?.login
      return body.includes(marker) && login === 'github-actions[bot]'
    })
    if (match) return match
    if (comments.length < 100) return null
    page += 1
  }
}

const uploadScreenshotAsset = async (owner, repo, prNumber, screenshot) => {
  const url = `https://uploads.github.com/repos/${owner}/${repo}/issues/${prNumber}/assets`

  // Create proper multipart form data
  const boundary = `----FormBoundary${Math.random().toString(36).substring(2)}`
  const parts = []
  
  // Add the name field
  parts.push(`--${boundary}\r\n`)
  parts.push(`Content-Disposition: form-data; name="name"\r\n\r\n`)
  parts.push(`${screenshot.file}\r\n`)
  
  // Add the file field
  parts.push(`--${boundary}\r\n`)
  parts.push(`Content-Disposition: form-data; name="file"; filename="${screenshot.file}"\r\n`)
  parts.push(`Content-Type: ${screenshot.mime}\r\n\r\n`)
  
  const header = Buffer.from(parts.join(''))
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`)
  const body = Buffer.concat([header, screenshot.data, footer])

  const response = await githubRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length.toString(),
    },
    body: body,
  })

  const asset = await response.json()
  const downloadUrl = asset?.url
  if (!downloadUrl) throw new Error(`Unable to determine download URL for ${screenshot.file}`)
  return { ...screenshot, downloadUrl }
}

const buildCommentBody = (screenshots) => {
  if (!screenshots.length) return null

  let content = `${marker}\n\n## Playwright Screenshots\n\n`
  for (const screenshot of screenshots) {
    content += [
      `### ${screenshot.title}`,
      `![${screenshot.title}](${screenshot.downloadUrl})`,
    ].join('\n\n')
    content += '\n\n'
  }

  return content.trimEnd() + '\n'
}

const upsertPullRequestComment = async (screenshots) => {
  if (!githubToken) {
    warn('GITHUB_TOKEN not available; skipping PR comment update.')
    return
  }
  if (!githubRepo) {
    warn('GITHUB_REPOSITORY not available; skipping PR comment update.')
    return
  }

  const prNumber = await readPullRequestNumber()
  if (!prNumber) {
    warn('Pull request number missing from event payload; skipping PR comment update.')
    return
  }

  const [owner, repo] = githubRepo.split('/')
  if (!owner || !repo) {
    warn('Could not determine owner/repo from GITHUB_REPOSITORY; skipping PR comment update.')
    return
  }

  try {
    const uploadedScreenshots = []
    for (const screenshot of screenshots) {
      try {
        if (screenshot.data.length > 9_000_000) {
          warn(`${screenshot.file} too large (${screenshot.data.length} bytes) – skipping upload.`)
        } else {
          const uploaded = await uploadScreenshotAsset(owner, repo, prNumber, screenshot)
          uploadedScreenshots.push(uploaded)
        }
      } catch (err) {
        warn(`Failed to upload screenshot asset for ${screenshot.file}.`, err)
      }
    }

    const content = buildCommentBody(uploadedScreenshots)
    if (!content) {
      return
    }

    const existing = await findExistingComment(owner, repo, prNumber)
    if (existing) {
      await githubRequest(
        `https://api.github.com/repos/${owner}/${repo}/issues/comments/${existing.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body: content }),
        },
      )
      log('Updated existing Playwright screenshots comment.')
    } else {
      await githubRequest(
        `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body: content }),
        },
      )
      log('Created Playwright screenshots comment.')
    }
  } catch (err) {
    warn('Unable to update GitHub pull request comment.', err)
  }
}

const run = async () => {
  try {
    const screenshots = await loadScreenshots()
    if (!screenshots.length) return
    const summary = buildSummary(screenshots)
    if (summary) {
      await appendStepSummary(summary)
    }
    await upsertPullRequestComment(screenshots)
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