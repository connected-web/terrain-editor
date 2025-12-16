// video-utils.ts
import { TestInfo, Page } from '@playwright/test'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

// Extend window interface for terrain viewer handle (matching editor's declaration)
declare global {
  interface Window {
    __terrainViewer?: {
      enableFrameCaptureMode: (fps?: number) => { fps: number }
      disableFrameCaptureMode: () => void
      captureFrame: (frameNumber: number, fps?: number) => { frameNumber: number; time: number }
    } | null
  }
}

export function videoNameFromTest(testInfo: any) {
  return testInfo.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * Capture frames deterministically by manually advancing the scene time
 * and taking screenshots. This produces smooth, consistent videos regardless
 * of machine performance.
 */
export async function captureFrames(
  page: Page,
  options: {
    fps?: number
    durationSeconds: number
    outputName: string
  }
) {
  const fps = options.fps ?? 30
  const totalFrames = Math.ceil(options.durationSeconds * fps)
  const outputDir = path.join(process.cwd(), 'documentation', 'animations')
  const framesDir = path.join(outputDir, `${options.outputName}-frames`)

  // Clean and create frames directory
  if (fs.existsSync(framesDir)) {
    fs.rmSync(framesDir, { recursive: true })
  }
  fs.mkdirSync(framesDir, { recursive: true })

  console.log(`📹 Capturing ${totalFrames} frames at ${fps}fps...`)

  const frameBuffers: Buffer[] = []

  // Enable frame capture mode once at the start
  await page.evaluate((fps) => {
    if (!window.__terrainViewer) {
      throw new Error('Terrain viewer not found on window.__terrainViewer')
    }
    window.__terrainViewer.enableFrameCaptureMode(fps)
  }, fps)

  // Capture frames one at a time using Playwright screenshots
  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    console.log(`  ├─ Capturing frame ${frameIndex + 1}/${totalFrames}...`)

    // Advance to next frame
    await page.evaluate(({ frameNumber, fps }) => {
      window.__terrainViewer!.captureFrame(frameNumber, fps)
    }, { frameNumber: frameIndex, fps })

    // Take screenshot using Playwright (includes all UI elements)
    const screenshot = await page.screenshot({ type: 'png' })
    frameBuffers.push(screenshot)
  }

  // Disable frame capture mode
  await page.evaluate(() => {
    window.__terrainViewer?.disableFrameCaptureMode()
  })

  console.log(`✓ Rendered all ${totalFrames} frames`)
  console.log(`📝 Writing frames to disk...`)

  // Write all frames to disk in parallel
  await Promise.all(
    frameBuffers.map((buffer, index) => {
      const framePath = path.join(framesDir, `frame-${index.toString().padStart(5, '0')}.png`)
      return fs.promises.writeFile(framePath, buffer)
    })
  )

  console.log(`✓ Wrote all ${totalFrames} frames to disk`)

  return { framesDir, totalFrames, fps }
}

/**
 * Stitch frames into video formats using ffmpeg
 */
export function stitchFramesToVideo(options: {
  framesDir: string
  outputName: string
  fps: number
}) {
  const outputDir = path.join(process.cwd(), 'documentation', 'animations')
  const mp4Output = path.join(outputDir, `${options.outputName}.mp4`)
  const gifOutput = path.join(outputDir, `${options.outputName}.gif`)

  console.log(`🎬 Stitching frames into video...`)

  // Create MP4 from frames
  try {
    execSync(
      `ffmpeg -y -framerate ${options.fps} -i "${options.framesDir}/frame-%05d.png" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "${mp4Output}"`,
      { stdio: 'inherit' }
    )
    console.log(`✓ Created MP4: ${mp4Output}`)
  } catch (err) {
    console.warn('⚠️ MP4 creation failed')
    throw err
  }

  // Create GIF from MP4
  try {
    execSync(
      `ffmpeg -y -i "${mp4Output}" -vf "fps=${options.fps},scale=512:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 "${gifOutput}"`,
      { stdio: 'inherit' }
    )
    console.log(`✓ Created GIF: ${gifOutput}`)
  } catch (err) {
    console.warn('⚠️ GIF creation failed')
  }

  // Clean up frames directory
  fs.rmSync(options.framesDir, { recursive: true })
  console.log(`✓ Cleaned up frames directory`)

  return { mp4Output, gifOutput }
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
