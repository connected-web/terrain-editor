// video-utils.ts
import { TestInfo, Page } from '@playwright/test'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

export function videoNameFromTest(testInfo: any) {
  return testInfo.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function saveVideoAsGif(page: Page, testInfo: TestInfo, outputName: string) {
  if (!process.env.RECORD_VIDEO) {
    console.log('Video recording is disabled; skipping saveVideoAsGif. Set RECORD_VIDEO=1 to enable.')
    return
  }
  
  const video = page.video()
  if (!video) {
    console.warn('Video is not enabled for this test:', outputName)
    return
  }

  const context = page.context()
  await context.close()

  const videoPath = await video.path() // waits until video is written
  if (!videoPath) {
    console.warn('No video path available for', outputName)
    return
  }

  const outputDir = path.join(process.cwd(), 'documentation', 'animations')
  fs.mkdirSync(outputDir, { recursive: true })

  const webmOutput = path.join(outputDir, `${outputName}.webm`)
  const mp4Output = path.join(outputDir, `${outputName}.mp4`)
  const gifOutput = path.join(outputDir, `${outputName}.gif`)

  // Keep original container
  fs.copyFileSync(videoPath, webmOutput)
  console.log(`✓ Saved video: ${webmOutput}`)

  // Convert to mp4 (real conversion, not rename)
  try {
    execSync(
      `ffmpeg -y -i "${webmOutput}" -movflags +faststart "${mp4Output}"`,
      { stdio: 'inherit' }
    )
    console.log(`✓ Converted to MP4: ${mp4Output}`)
  } catch (err) {
    console.warn('⚠️ Video conversion failed for', outputName)
    return
  }

  // Convert to GIF (palette workflow)
  try {
    execSync(
      `ffmpeg -y -i "${mp4Output}" -vf "fps=10,scale=512:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 "${gifOutput}"`,
      { stdio: 'inherit' }
    )
  } catch (err) {
    console.warn('⚠️ GIF conversion failed for', outputName)
    return
  }

  console.log(`✓ Converted to GIF: ${gifOutput}`)
}

export function registerVideoRecordingHooks(test: { afterEach: (fn: (args: { page: Page }, testInfo: TestInfo) => Promise<void>) => void }) {
  test.afterEach(async ({ page }, testInfo) => {
    if (!process.env.RECORD_VIDEO) return

    // Don't try to record if the test already blew up before page existed
    if (!page) {
      console.log('🎥 Skipped saving video; no page available for test:', testInfo.title)
      return
    }

    // Only save video for failed tests 
    if (testInfo.status !== testInfo.expectedStatus) {
      console.log('🎥 Skipped saving video for failed test:', testInfo.title, '(' + testInfo.status + ')')
      return
    }

    const outputName = videoNameFromTest(testInfo)

    try {
      await saveVideoAsGif(page, testInfo, outputName)
    } catch (err) {
      console.warn('⚠️ Failed to save video for', testInfo.title)
    }
  })
}
