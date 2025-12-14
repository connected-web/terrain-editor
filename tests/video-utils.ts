import { TestInfo } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function saveVideoAsGif(testInfo: TestInfo, outputName: string) {
  // Wait a moment for video to finalize
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const videoAttachment = testInfo.attachments.find(att => att.name === 'video');
  const videoPath = videoAttachment?.path;
  if (!videoPath) {
    console.warn('No video recorded for', outputName);
    return;
  }

  const outputDir = path.join(process.cwd(), 'documentation', 'animations');
  fs.mkdirSync(outputDir, { recursive: true });

  const mp4Output = path.join(outputDir, `${outputName}.mp4`);
  const gifOutput = path.join(outputDir, `${outputName}.gif`);

  // Copy the video file
  fs.copyFileSync(videoPath, mp4Output);
  console.log(`✓ Saved video: ${mp4Output}`);

  // Convert to GIF using ffmpeg (lower resolution, 10fps)
  try {
    execSync(
      `ffmpeg -i "${mp4Output}" -vf "fps=10,scale=512:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 "${gifOutput}" -y`,
      { stdio: 'inherit' }
    );
    console.log(`✓ Converted to GIF: ${gifOutput}`);
  } catch (error) {
    console.warn('Failed to convert to GIF. Make sure ffmpeg is installed.');
    console.warn('Install with: brew install ffmpeg (macOS) or apt-get install ffmpeg (Linux)');
  }
}
