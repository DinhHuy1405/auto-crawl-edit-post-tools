import { Command, CommandRunner } from 'nest-commander';
import { HttpService } from '@nestjs/axios';
import { launchBrowser } from '../../utils/browser.util';
import { readFileSync } from 'fs';
import { Page, Browser } from 'playwright-core';

type PostThreadsCommandInputs = {
  show_browser: boolean;
  is_close_browser: boolean;
  video_path?: string;
  image_paths?: string[];
  description: string;
};

@Command({
  name: 'post-threads',
  description: 'Post a thread to Threads',
  arguments: '<file-settings>',
})
export class PostThreadsCommand extends CommandRunner {
  constructor(private readonly httpService: HttpService) {
    super();
  }

  async run(inputs: string[]) {
    const pathFileSetting = inputs[0];
    const fileSettings = JSON.parse(
      readFileSync(pathFileSetting, 'utf8'),
    ) as PostThreadsCommandInputs;

    const browser = await launchBrowser(fileSettings.show_browser);

    try {
      const page = await browser.newPage();

      await page.goto('https://www.threads.net/', {
        waitUntil: 'domcontentloaded',
      });

      const currentUrl = page.url();
      if (currentUrl.includes('login')) {
        console.log('⚠️  Not logged in to Threads!');
        console.log('📱 Opening browser - please login to Threads first');
        console.log('💡 After login, the script will continue automatically');
        
        if (!fileSettings.show_browser) {
          throw new Error(
            'Please set show_browser to true to login to Threads',
          );
        }
        
        // Wait for user to login - check if URL changes from login page
        console.log('⏳ Waiting for login (max 5 minutes)...');
        await page.waitForURL('**/threads.net/**', { waitUntil: 'domcontentloaded', timeout: 300000 });
        console.log('✅ Login detected, continuing...');
      }

      // Wait for home page to fully load
      console.log('⏳ Waiting for page to fully load...');
      await page.waitForTimeout(5000);
      
      // Look for compose button and click it to open composer
      console.log('🔍 Looking for compose/new post button...');
      const composeButtons = page.locator('[aria-label*="Compose"], [aria-label*="compose"], button:has-text("Compose"), div:has-text("Compose")');
      const composeCount = await composeButtons.count();
      console.log(`📊 Found ${composeCount} potential compose buttons`);
      
      if (composeCount > 0) {
        const composeButton = composeButtons.first();
        const isComposeVisible = await composeButton.isVisible({ timeout: 2000 }).catch(() => false);
        if (isComposeVisible) {
          console.log('✅ Clicking compose button...');
          await composeButton.click();
          await page.waitForTimeout(3000);
        }
      }

      await this.postThread(page, fileSettings);
    } catch (error) {
      console.error('❌ Failed to post thread:', error);
      throw error;
    } finally {
      console.log('Closing browser...');
      await browser.close();
    }
  }

  private async postThread(
    page: Page,
    input: PostThreadsCommandInputs,
  ) {
    try {
      console.log('📝 Starting thread posting...');
      console.log('⏳ Waiting for compose interface to fully load...');
      
      // Wait longer for SPA to fully render after compose button click
      await page.waitForTimeout(4000);
      
      // Debug: Save page state
      console.log('🔍 Debugging compose interface...');
      const pageHTML = await page.content();
      const fs = await import('fs');
      fs.writeFileSync('/tmp/threads_compose_debug.html', pageHTML);
      console.log('💾 Saved compose page HTML');
      
      // Take screenshot
      await page.screenshot({ path: '/tmp/threads_compose_debug.png', fullPage: true });
      console.log('📸 Saved compose screenshot');
      
      // Try different selectors to find text input
      const allTextareas = page.locator('textarea');
      const textareaCount = await allTextareas.count();
      const allContentEditable = page.locator('[contenteditable="true"]');
      const contentEditableCount = await allContentEditable.count();
      const allInputs = page.locator('input[type="text"]');
      const inputCount = await allInputs.count();
      console.log(`📊 Textareas: ${textareaCount}, Contenteditable: ${contentEditableCount}, Text inputs: ${inputCount}`);
      
      // Try each method to find text input
      let textInput: any = null;
      let isTextInputVisible = false;
      
      if (contentEditableCount > 0) {
        textInput = page.locator('[contenteditable="true"]').first();
        isTextInputVisible = await textInput.isVisible({ timeout: 1000 }).catch(() => false);
        if (isTextInputVisible) console.log('✅ Using contenteditable');
      }
      
      if (!isTextInputVisible && textareaCount > 0) {
        textInput = page.locator('textarea').first();
        isTextInputVisible = await textInput.isVisible({ timeout: 1000 }).catch(() => false);
        if (isTextInputVisible) console.log('✅ Using textarea');
      }
      
      if (!isTextInputVisible && inputCount > 0) {
        textInput = page.locator('input[type="text"]').first();
        isTextInputVisible = await textInput.isVisible({ timeout: 1000 }).catch(() => false);
        if (isTextInputVisible) console.log('✅ Using text input');
      }
      
      if (!isTextInputVisible) {
        console.log('⚠️  No text input found');
      }

      // Fill in description
      if (input.description && isTextInputVisible && textInput) {
        console.log('📝 Adding description...');
        try {
          await textInput.click();
          await page.waitForTimeout(300);
          await textInput.type(input.description);
          console.log('✅ Description added');
        } catch (e) {
          console.log('⚠️  Error adding description:', e.message);
        }
      }

      // Upload media if provided
      if (input.video_path) {
        console.log(`📹 Uploading video: ${input.video_path}`);
        await this.uploadMedia(page, input.video_path);
        await this.waitForVideoUploadComplete(page);
      } else if (input.image_paths && input.image_paths.length > 0) {
        for (const imagePath of input.image_paths) {
          console.log(`🖼️  Uploading image: ${imagePath}`);
          await this.uploadMedia(page, imagePath);
        }
      }

      await page.waitForTimeout(500);

      console.log('🔍 Looking for post button...');
      const postButton = await this.findPostButton(page);
      if (!postButton) {
        console.log('⚠️  Post button not found');
        console.log('📱 You can now manually complete the post in the browser');
        console.log('🎯 Press Ctrl+C in the terminal when done');
        await page.waitForTimeout(600000); // Wait 10 minutes
        return;
      }

      console.log('✅ Found post button, clicking...');
      await postButton.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await postButton.click();
      console.log('✅ Post button clicked');

      // Wait for "Posting..." to appear then disappear before closing browser
      console.log('⏳ Waiting for post to finish publishing...');
      await this.waitForPostingComplete(page);

      console.log('✅ Thread posted successfully');
    } catch (error) {
      console.error('Error posting thread:', error);
      throw error;
    }
  }

  /**
   * Wait for the video thumbnail/preview to appear in the compose area.
   * Threads shows a video thumbnail once upload is complete.
   * Strategy: wait until a <video> or <img> preview appears inside the compose area,
   * OR until the "..." loading dots inside the media container disappear.
   * Max 3 minutes.
   */
  private async waitForVideoUploadComplete(page: Page) {
    console.log('⏳ Waiting for video upload to complete (thumbnail to appear)...');
    const MAX_WAIT_MS = 3 * 60 * 1000;
    const POLL_MS = 2000;
    const startTs = Date.now();
    const deadline = startTs + MAX_WAIT_MS;

    // Wait a moment for Threads to begin processing
    await page.waitForTimeout(3000);

    while (Date.now() < deadline) {
      const elapsed = Math.round((Date.now() - startTs) / 1000);

      // Check if a video/image thumbnail is visible inside the compose area
      const hasVideoThumb = await page.locator('video[src]').first().isVisible({ timeout: 300 }).catch(() => false);
      const hasImgThumb   = await page.locator('img[src*="cdninstagram"], img[src*="fbcdn"], img[src*="threads"]').first().isVisible({ timeout: 300 }).catch(() => false);

      // Also check: if there's NO loading spinner/progress anymore = done
      const hasProgress   = await page.locator('[role="progressbar"]').first().isVisible({ timeout: 300 }).catch(() => false);
      const hasSpinner    = await page.locator('svg[aria-label*="Loading"], [aria-label*="loading" i]').first().isVisible({ timeout: 300 }).catch(() => false);

      if (hasVideoThumb || hasImgThumb) {
        console.log(`✅ Video thumbnail visible (${elapsed}s) — ready to post`);
        await page.waitForTimeout(1000);
        return;
      }

      if (!hasProgress && !hasSpinner && elapsed >= 5) {
        // No spinner and some time has passed — assume upload done
        console.log(`✅ No loading indicators after ${elapsed}s — proceeding to post`);
        await page.waitForTimeout(1000);
        return;
      }

      console.log(`⏳ Waiting for upload... (${elapsed}s)`);
      await page.waitForTimeout(POLL_MS);
    }

    console.log('⚠️  Upload wait timed out (3 min) — proceeding anyway');
  }

  /**
   * After clicking Post, wait for Threads to finish publishing the post.
   * Strategy:
   *  1. Wait up to 15s for any "Posting..." / "Đang đăng..." indicator to appear.
   *  2. Once appeared (or even if not), wait for ALL of:
   *     - "Posting..." indicator to disappear
   *     - compose modal (role="dialog") to close  OR  success toast to appear
   *  3. Extra settle: 4s after everything looks done.
   * Max total wait: 10 minutes (video server-side transcoding on Threads can be very slow).
   */
  private async waitForPostingComplete(page: Page) {
    const MAX_WAIT_MS = 10 * 60 * 1000;
    const POLL_MS = 1500;
    const startTs = Date.now();
    const deadline = startTs + MAX_WAIT_MS;

    // Detect the "Posting..." toast/overlay that Threads shows after clicking Post.
    // Use exact text selectors to avoid matching the "Post" button itself.
    const isPostingVisible = async () => {
      const checks = [
        // Exact "Posting..." string (with ellipsis char or 3 dots)
        () => page.locator('text=Posting...').first().isVisible({ timeout: 300 }),
        () => page.locator('text=Đang đăng...').first().isVisible({ timeout: 300 }),
        // Threads wraps the toast in a span/div — check innerText exactly
        () => page.locator('span:text("Posting..."), div:text("Posting...")').first().isVisible({ timeout: 300 }),
        () => page.locator('[aria-label="Posting"]').first().isVisible({ timeout: 300 }),
      ];
      for (const check of checks) {
        const v = await check().catch(() => false);
        if (v) return true;
      }
      return false;
    };

    // ── Phase 1: wait up to 15s for "Posting..." to appear after click ────────
    console.log('⏳ Waiting for "Posting..." indicator...');
    let postingAppeared = false;
    const detectDeadline = Date.now() + 15000;
    while (Date.now() < detectDeadline) {
      if (await isPostingVisible()) { postingAppeared = true; break; }
      await page.waitForTimeout(500);
    }

    if (!postingAppeared) {
      console.log('ℹ️  "Posting..." not detected within 15s — will wait 10s as fallback then close');
      await page.waitForTimeout(10000);
      return;
    }

    console.log('✅ "Posting..." detected — waiting for it to disappear...');

    // ── Phase 2: wait for "Posting..." to disappear ───────────────────────────
    while (Date.now() < deadline) {
      const elapsed = Math.round((Date.now() - startTs) / 1000);
      const stillPosting = await isPostingVisible();

      if (!stillPosting) {
        console.log(`✅ "Posting..." gone — post is complete (${elapsed}s)`);
        break;
      }

      console.log(`⏳ Still posting... (${elapsed}s elapsed)`);
      await page.waitForTimeout(POLL_MS);
    }

    if (Date.now() >= deadline) {
      console.log('⚠️  Post wait timed out after 10 minutes — closing browser anyway');
    }

    // Final settle
    console.log('⏳ Final settle (3s)...');
    await page.waitForTimeout(3000);
    console.log('✅ Browser will now close');
  }

  private async uploadMedia(page: Page, mediaPath: string) {
    try {
      // Debug: Look for all file inputs
      console.log('🔍 Debugging file inputs...');
      const allFileInputs = page.locator('input[type="file"]');
      const fileInputCount = await allFileInputs.count();
      console.log(`📊 Found ${fileInputCount} file input elements`);
      
      // Threads uses: <input accept="image/avif,image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" multiple="" type="file">
      // This is inside the compose area
      let fileInputs = page.locator('input[type="file"][accept*="video/mp4"]');
      let count = await fileInputs.count();
      console.log(`📊 Found ${count} file inputs with video/mp4 accept`);
      
      // Fallback: Try all file inputs
      if (count === 0) {
        console.log('⚠️  No file input with video/mp4 found, trying all file inputs...');
        fileInputs = page.locator('input[type="file"]');
        count = await fileInputs.count();
        console.log(`📊 Fallback: Found ${count} file inputs total`);
      }
      
      if (count === 0) {
        console.log('⚠️  No file input found for media upload');
        return;
      }

      console.log(`✅ Found file input, uploading media...`);
      const fileInput = fileInputs.first();
      await fileInput.setInputFiles(mediaPath);
      
      console.log('✅ Media file uploaded');
      // Wait for media to be processed
      await page.waitForTimeout(5000);
    } catch (error) {
      console.error('Error uploading media:', error);
      // Don't throw - continue anyway as media upload is optional
    }
  }

  private async findPostButton(page: Page) {
    try {
      console.log('🔍 Looking for Post button...');

      // Try candidates in priority order
      const candidates = [
        // Native <button> with exact text — matches the button in the screenshot
        () => page.getByRole('button', { name: 'Post', exact: true }),
        () => page.getByRole('button', { name: 'Đăng', exact: true }),
        // div[role="button"] with text
        () => page.locator('div[role="button"]').filter({ hasText: /^Post$/ }),
        () => page.locator('div[role="button"]').filter({ hasText: /^Đăng$/ }),
      ];

      for (const getBtn of candidates) {
        const btn = getBtn();
        const visible = await btn.first().isVisible({ timeout: 1000 }).catch(() => false);
        if (visible) {
          const text = await btn.first().textContent().catch(() => '');
          console.log(`✅ Found Post button: "${text?.trim()}"`);
          return btn.first();
        }
      }

      console.log('⚠️  Post button not found');
      return null;
    } catch (error) {
      console.error('Error finding post button:', error);
      return null;
    }
  }
}
