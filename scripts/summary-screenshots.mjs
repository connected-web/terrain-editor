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

const buildSummary = async () => {
  const files = await fs.readdir(screenshotDir)
  if (!files.length) return null

  let content = `${marker}\n\n## Playwright Screenshots\n\n`
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

const upsertPullRequestComment = async (content) => {
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
    const existing = await findExistingComment(owner, repo, prNumber)
    if (existing) {
      await githubRequest(
        `https://api.github.com/repos/${owner}/${repo}/issues/comments/${existing.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ body: content }),
        },
      )
      log('Updated existing Playwright screenshots comment.')
    } else {
      await githubRequest(
        `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
        {
          method: 'POST',
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
    const content = await buildSummary()
    if (!content) return
    await appendStepSummary(content)
    await upsertPullRequestComment(content)
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
