import { promises as fs } from 'node:fs'
import path from 'node:path'
import { Client } from 'basic-ftp'

const marker = '<!-- pr-check-step-summary -->'
const summaryPath = process.env.GITHUB_STEP_SUMMARY
const githubToken = process.env.GITHUB_TOKEN
const githubRepo = process.env.GITHUB_REPOSITORY
const eventPath = process.env.GITHUB_EVENT_PATH
const screenshotDir = path.join(process.cwd(), 'test-results', 'screenshots')

const ftpHost = 'ftp.connected-web.net'
const ftpUser = process.env.CWEB_IMAGES_FTP_USER
const ftpPassword = process.env.CWEB_IMAGES_FTP_PASSWORD
const ftpBaseDir = '' // defaults to: /www/images/github
const baseUrl = 'https://images.connected-web.net/github'

function log(...args) {
  return console.log('[summary-screenshots]', ...args)
}

function warn(...args) {
  return console.warn('[summary-screenshots]', ...args)
}

async function readPullRequestNumber() {
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

async function loadScreenshots() {
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
      filePath,
    })
  }

  return screenshots
}

function buildSummary(screenshots) {
  if (!screenshots.length) return null

  let content = `${marker}\n\n## Playwright Screenshots\n\n`
  for (const screenshot of screenshots) {
    // Use FTP URL if available, otherwise fall back to base64
    if (screenshot.url) {
      content += [
        `### ${screenshot.title}`,
        `[![${screenshot.title}](${screenshot.url})](${screenshot.url})`,
      ].join('\n\n')
    } else {
      content += [
        `### ${screenshot.title}`,
        `<img src="data:${screenshot.mime};base64,${screenshot.base64}" alt="${screenshot.title}" />`,
      ].join('\n\n')
    }
    content += '\n\n'
  }
  return content.trimEnd() + '\n'
}

async function appendStepSummary(content) {
  if (!summaryPath || !content) return
  const stats = await fs.stat(summaryPath).catch(() => null)
  const prefix = stats && stats.size > 0 ? '\n' : ''
  await fs.appendFile(summaryPath, `${prefix}${content}`)
  log('Appended Playwright screenshots to step summary.')
}

async function uploadScreenshotsToFtp(screenshots) {
  if (!ftpUser || !ftpPassword) {
    warn('FTP credentials not available; skipping FTP upload.')
    return []
  }

  const client = new Client()
  client.ftp.verbose = true // Enable verbose logging for debugging
  
  try {
    log(`Attempting FTP connection to ${ftpHost} with user: ${ftpUser}`)
    
    // Try standard FTP first
    try {
      await client.access({
        host: ftpHost,
        user: ftpUser,
        password: ftpPassword,
        secure: false,
        port: 21,
      })
    } catch (err) {
      log('Standard FTP failed, trying with passive mode disabled...')
      client.close()
      const client2 = new Client()
      client2.ftp.verbose = true
      await client2.access({
        host: ftpHost,
        user: ftpUser,
        password: ftpPassword,
        secure: false,
        port: 21,
        pasvTimeout: 10000,
      })
      // If this succeeds, use client2 instead
      return await uploadWithClient(client2, screenshots)
    }
    
    log(`Connected to FTP server: ${ftpHost}`)
    return await uploadWithClient(client, screenshots)
  } catch (err) {
    warn('FTP upload failed:', err)
    return []
  }
}

async function uploadWithClient(client, screenshots) {
  try {
    const date = new Date().toISOString().split('T')[0]
    const uploadDir = `${ftpBaseDir}/${date}`
    
    // Ensure the date directory exists
    await client.ensureDir(uploadDir)
    log(`Ensured directory exists: ${uploadDir}`)
    
    const uploadedScreenshots = []
    
    for (const screenshot of screenshots) {
      try {
        const remotePath = `${uploadDir}/${screenshot.file}`
        await client.uploadFrom(screenshot.filePath, remotePath)
        
        const publicUrl = `${baseUrl}/${date}/${screenshot.file}`
        uploadedScreenshots.push({
          ...screenshot,
          url: publicUrl,
        })
        
        log(`Uploaded: ${screenshot.file} -> ${publicUrl}`)
      } catch (err) {
        warn(`Failed to upload ${screenshot.file}:`, err)
      }
    }
    
    return uploadedScreenshots
  } catch (err) {
    warn('FTP upload failed:', err)
    return []
  } finally {
    client.close()
  }
}

async function githubRequest(url, init) {
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

async function findExistingComment(owner, repo, prNumber) {
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

function buildCommentBody(screenshots) {
  if (!screenshots.length) return null

  let content = `${marker}\n\n## Playwright Screenshots\n\n`
  for (const screenshot of screenshots) {
    content += [
      `### ${screenshot.title}`,
      `![${screenshot.title}](${screenshot.url})`,
    ].join('\n\n')
    content += '\n\n'
  }
  return content.trimEnd() + '\n'
}

async function upsertPullRequestComment(screenshots) {
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
    const content = buildCommentBody(screenshots)
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

async function run() {
  try {
    const screenshots = await loadScreenshots()
    if (!screenshots.length) return
    
    // Upload to FTP first to get URLs
    const uploadedScreenshots = await uploadScreenshotsToFtp(screenshots)
    
    // Build summary with FTP links if available
    const screenshotsForSummary = uploadedScreenshots.length > 0 
      ? uploadedScreenshots 
      : screenshots
    
    const summary = buildSummary(screenshotsForSummary)
    if (summary) {
      await appendStepSummary(summary)
    }
    
    // Create/update PR comment with FTP links
    if (uploadedScreenshots.length > 0) {
      await upsertPullRequestComment(uploadedScreenshots)
    }
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
