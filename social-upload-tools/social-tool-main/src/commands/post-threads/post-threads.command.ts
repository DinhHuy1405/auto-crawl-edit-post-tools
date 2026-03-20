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
      
      // Scroll button into view
      await postButton.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      
      // Monitor for API calls to confirm post was sent
      let postRequestSent = false;
      const responseListener = async (response) => {
        const url = response.url();
        if ((url.includes('graphql') || url.includes('/api/') || url.includes('threads')) && response.request().method() === 'POST') {
          // Ignore known irrelevant GraphQL calls
          if (url.includes('viewer') || url.includes('nullstate') || url.includes('sugesstions')) return;

          console.log(`📥 Response from ${url}: ${response.status()}`);
          try {
            // Check if response is JSON and try to print relevant parts
            const text = await response.text();
            
            // Check for actual POST success markers
            if (text.includes('media_id') || text.includes('thread_id') || text.includes('posted') || text.includes('created')) {
                console.log('✅ Found media/thread creation confirmation in response!');
                postRequestSent = true;
            }

            if (text.length < 500) {
              console.log('📄 Response body:', text);
            } else {
              console.log('📄 Response body (truncated):', text.substring(0, 200));
            }
          } catch (e) {
            // ignore body read errors (e.g. streaming responses or redirects)
          }
        }
      };
      
      const requestListener = (request) => {
        if (request.url().includes('graphql') || request.url().includes('/api/') || request.url().includes('threads')) {
          const method = request.method();
          if (method === 'POST') {
             // Only log potential candidates, verify response for actual success
             // Don't set postRequestSent=true here anymore, wait for response
             // console.log(`📡 POST request detected: ${request.url()}`);
          }
        }
      };
      
      page.on('request', requestListener);
      page.on('response', responseListener);
      
      try {
        console.log('⏱️  Attempting click...');
        
        // Log the exact text of the button we found
        const buttonText = await postButton.innerText().catch(() => 'unknown');
        const buttonHTML = await postButton.evaluate(el => el.outerHTML).catch(() => 'unknown');
        console.log(`🔍 Button text is: "${buttonText}"`);
        console.log(`🔍 Button HTML is: ${buttonHTML}`);

        // Screenshot BEFORE click
        console.log('📸 Taking pre-click screenshot...');
        await page.screenshot({ path: '/tmp/threads_pre_click_debug.png', fullPage: true });

        // Check if button is enabled (Wait for it)
        try {
           console.log('⏳ Verifying button state...');
           // Sometimes the button takes a moment to become enabled after input
           await page.waitForTimeout(2000); 
        } catch (e) {}

        const isEnabled = await postButton.isEnabled().catch(() => false);
        console.log(`🔍 Button enabled state: ${isEnabled}`);
        
        // Validation: If button is disabled, we shouldn't click
        if (!isEnabled) {
            console.log('⚠️ Button reports disabled! Attempting to refresh input state...');
             // Try to focus input and trigger event again
             if (isTextInputVisible && textInput) {
                await textInput.focus();
                await textInput.press('Space');
                await textInput.press('Backspace');
                await page.waitForTimeout(1000);
             }
        }

        // Strategy 1: Playwright Normal Click (No Force) - to detect if covered
        console.log('👆 Strategy 1: Playwright Normal Click (Strict)');
        try {
          await postButton.click({ timeout: 5000 });
          console.log('✅ Strategy 1 success');
        } catch (e) {
             console.log('⚠️ Strategy 1 failed (likely covered/not visible):', e.message);
             console.log('👆 Strategy 1.5: Playwright Force Click');
             await postButton.click({ force: true, timeout: 3000 }).catch(err => console.log('Strat 1.5 failed', err.message));
        }
        await page.waitForTimeout(1000);

        if (!postRequestSent) {
          // Check if button is still there
          const isStillVisible = await postButton.isVisible({ timeout: 500 }).catch(() => false);
          if (isStillVisible) {
            // Strategy 2: JavaScript Click
            console.log('👆 Strategy 2: Native JavaScript Click');
            await postButton.evaluate((el: HTMLElement) => el.click()).catch(e => console.log('Strategy 2 failed:', e.message));
            await page.waitForTimeout(1000);
          } else {
            console.log('✅ Modal closed after Strategy 1, skipping other click strategies');
            postRequestSent = true; // Assume success if modal closed
          }
        }

        if (!postRequestSent) {
           const isStillVisible = await postButton.isVisible({ timeout: 500 }).catch(() => false);
           if (isStillVisible) {
             // Strategy 3: JavaScript Mouse Events
             console.log('👆 Strategy 3: JavaScript Mouse Events (mousedown/mouseup/click)');
             await postButton.evaluate((el: HTMLElement) => {
               const eventOpts = { bubbles: true, cancelable: true, view: window };
               el.dispatchEvent(new MouseEvent('mousedown', eventOpts));
               el.dispatchEvent(new MouseEvent('mouseup', eventOpts));
               el.dispatchEvent(new MouseEvent('click', eventOpts));
             }).catch(e => console.log('Strategy 3 failed:', e.message));
             await page.waitForTimeout(1000);
           }
        }

      } catch (e) {
        console.log('⚠️  Click execution error:', e);
      } finally {
        page.off('request', requestListener);
      }
      
      if (postRequestSent) {
        console.log('✅ Post request confirmed sent');
      } else {
        console.log('⚠️  WARNING: No POST request detected after click!');
        // Don't throw immediately, check if UI feedback exists
      }

      // Wait for posting to complete - poll for "Posting..." indicator then wait for it to go away
      console.log('⏳ Waiting for post to finish publishing...');
      await this.waitForPostingComplete(page);

      // Verify posting success by checking for error messages
      const errorMessage = page.locator('text=Something went wrong').first();
      const isError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (isError) {
        throw new Error('Thread posting failed - error message displayed');
      }

      // Check if we're still on upload page (which means post might have failed silently)
      const uploadForm = page.locator('[aria-label*="Compose"]').first();
      const isStillOnUpload = await uploadForm.isVisible({ timeout: 1000 }).catch(() => false);
      
      if (isStillOnUpload) {
        console.log('⚠️  Still on compose screen - checking for success message...');
        // Look for "Your thread has been shared" or similar success message
        const successMessages = [
          'thread has been shared',
          'shared',
          'posted',
          'success',
          'Your post',
        ];
        
        let foundSuccess = false;
        for (const msg of successMessages) {
          const msgLocator = page.locator(`text=${msg}`).first();
          const isVisible = await msgLocator.isVisible({ timeout: 1000 }).catch(() => false);
          if (isVisible) {
            console.log(`✅ Found success message: "${msg}"`);
            foundSuccess = true;
            break;
          }
        }
        
        if (!foundSuccess) {
          console.log('⚠️  No success confirmation found - post may have failed');
          throw new Error('No success confirmation - post may not have been sent');
        }
      } else {
        console.log('✅ Compose form closed - post appears to be successful');
      }

      console.log('✅ Thread posted successfully');
    } catch (error) {
      console.error('Error posting thread:', error);
      throw error;
    }
  }

  /**
   * Wait for video upload + server-side processing to finish before posting.
   * Threads shows a progress bar or thumbnail preview while processing.
   * We wait until all known "uploading" indicators are gone AND the Post button is enabled.
   */
  private async waitForVideoUploadComplete(page: Page) {
    console.log('⏳ Waiting for video upload & processing to complete...');
    const MAX_WAIT_MS = 10 * 60 * 1000; // 10 minutes max
    const POLL_MS = 1500;
    const deadline = Date.now() + MAX_WAIT_MS;

    while (Date.now() < deadline) {
      // Check various upload-in-progress indicators
      const indicators = [
        '[role="progressbar"]',
        '[aria-label*="upload" i]',
        '[aria-label*="uploading" i]',
        '[aria-label*="processing" i]',
        'svg[aria-label*="Loading"]',
        // Threads shows a spinner inside the media preview while processing
        'div[aria-label*="Media"] [role="progressbar"]',
      ];

      let uploading = false;
      for (const sel of indicators) {
        const el = page.locator(sel).first();
        const visible = await el.isVisible({ timeout: 300 }).catch(() => false);
        if (visible) { uploading = true; break; }
      }

      if (!uploading) {
        // Double-check: Post button should now be enabled/not aria-disabled
        const postBtn = page.locator('div[role="button"]:has-text("Post"), div[role="button"]:has-text("Đăng"), button:has-text("Post"), button:has-text("Đăng")').first();
        const btnVisible = await postBtn.isVisible({ timeout: 500 }).catch(() => false);
        if (btnVisible) {
          const ariaDisabled = await postBtn.getAttribute('aria-disabled').catch(() => null);
          if (ariaDisabled !== 'true') {
            console.log('✅ Video upload complete — Post button is ready');
            await page.waitForTimeout(1500); // small settle delay
            return;
          }
        } else {
          // Button not visible yet but no progress indicator — wait a bit more
          await page.waitForTimeout(POLL_MS);
          continue;
        }
      }

      const elapsed = Math.round((Date.now() - (deadline - MAX_WAIT_MS)) / 1000);
      console.log(`⏳ Still uploading/processing... (${elapsed}s elapsed)`);
      await page.waitForTimeout(POLL_MS);
    }

    console.log('⚠️  Upload wait timed out after 10 minutes — proceeding anyway');
  }

  /**
   * After clicking Post, wait for Threads to finish publishing the post.
   * Threads shows "Posting..." text during submission, then navigates away or shows success.
   */
  private async waitForPostingComplete(page: Page) {
    const MAX_WAIT_MS = 8 * 60 * 1000; // 8 minutes (video transcoding can be slow)
    const POLL_MS = 1000;
    const deadline = Date.now() + MAX_WAIT_MS;

    // First, wait for the "Posting..." indicator to appear (up to 10s)
    const postingSelectors = [
      'text=Posting...',
      'text=Đang đăng...',
      '[aria-label*="Posting"]',
      '[aria-label*="posting" i]',
    ];

    let postingAppeared = false;
    const detectDeadline = Date.now() + 10000;
    while (Date.now() < detectDeadline) {
      for (const sel of postingSelectors) {
        const visible = await page.locator(sel).first().isVisible({ timeout: 300 }).catch(() => false);
        if (visible) { postingAppeared = true; break; }
      }
      if (postingAppeared) break;
      await page.waitForTimeout(500);
    }

    if (postingAppeared) {
      console.log('⏳ Post submission in progress (video being processed by Threads)...');
      // Now wait for it to disappear
      while (Date.now() < deadline) {
        let anyVisible = false;
        for (const sel of postingSelectors) {
          const visible = await page.locator(sel).first().isVisible({ timeout: 300 }).catch(() => false);
          if (visible) { anyVisible = true; break; }
        }
        if (!anyVisible) {
          console.log('✅ Posting complete');
          break;
        }
        const elapsed = Math.round((Date.now() - (deadline - MAX_WAIT_MS)) / 1000);
        console.log(`⏳ Still posting... (${elapsed}s elapsed)`);
        await page.waitForTimeout(POLL_MS);
      }
    } else {
      console.log('ℹ️  "Posting..." indicator not detected — waiting 8s as fallback');
      await page.waitForTimeout(8000);
    }

    // Final settle: make sure UI has fully transitioned before browser closes
    await page.waitForTimeout(3000);
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
      console.log('🔍 Searching for Post button with improved selector...');
      
      // Attempt to find the Post button SPECIFICALLY inside the Compose Modal (role="dialog")
      // This prevents clicking buttons on the background (timeline) which would close the modal (Save to draft)
      const composeModal = page.locator('div[role="dialog"]').first();
      const isModalVisible = await composeModal.isVisible({ timeout: 1000 }).catch(() => false);
      
      if (isModalVisible) {
        console.log('✅ Found active Compose Modal (role=dialog)');
        
        // Look inside the modal first
        const modalPostButton = composeModal.locator('div[role="button"]:has-text("Post"), button:has-text("Post"), div[role="button"]:has-text("Đăng"), button:has-text("Đăng")').first();
        if (await modalPostButton.isVisible({ timeout: 1000 }).catch(() => false)) {
             console.log('✅ Found Post button INSIDE modal');
             return modalPostButton;
        }
      } else {
        console.log('⚠️ Compose Modal (role=dialog) not found - checking global scope');
      }

      // Method 1: Find by exact text "Post" in div[role="button"] (Global fallback)
      let postButton = page.locator('div[role="button"]:has-text("Post"), div[role="button"]:has-text("Đăng")').first();
      let isVisible = await postButton.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (isVisible) {
        // Don't check isEnabled() for divs - it doesn't work reliably
        // Instead check if it has any disabled classes or aria-disabled
        const ariaDisabled = await postButton.getAttribute('aria-disabled').catch(() => null);
        const hasDisabledClass = await postButton.evaluate((el) => {
          const classList = el.className || '';
          return classList.includes('disabled') || classList.includes('disable');
        }).catch(() => false);
        
        if (ariaDisabled !== 'true' && !hasDisabledClass) {
          console.log('✅ Found Post button (method 1: div[role="button"]:has-text)');
          return postButton;
        } else {
          console.log('⚠️  Post button found but appears disabled');
        }
      }
      
      // Method 2: More specific - looking for all role="button" that contain "Post"
      const allButtonElements = page.locator('div[role="button"]');
      const buttonCount = await allButtonElements.count();
      console.log(`📊 Found ${buttonCount} div[role="button"] elements`);

      for (let i = buttonCount - 1; i >= 0; i--) {
        try {
          const element = allButtonElements.nth(i);
          const text = await element.textContent({ timeout: 300 }).catch(() => '');
          const elemIsVisible = await element.isVisible({ timeout: 300 }).catch(() => false);
          
          // Exact match for "Post" button
          if (elemIsVisible && text && (text.trim() === 'Post' || text.trim() === 'Đăng')) {
            console.log('✅ Found Post button (method 2: exact text match)');
            return element;
          }
        } catch (e) {
          // Continue searching
        }
      }

      // Method 3: Fallback - Look for button by looking at structure
      postButton = page.locator('div[role="button"] > div:has-text("Post"), div[role="button"] > div:has-text("Đăng")').first();
      isVisible = await postButton.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (isVisible) {
        // Get parent button
        const parentButton = postButton.locator('xpath=ancestor::div[@role="button"]').first();
        const parentVisible = await parentButton.isVisible({ timeout: 1000 }).catch(() => false);
        if (parentVisible) {
          console.log('✅ Found Post button (method 3: parent selector)');
          return parentButton;
        }
      }

      console.log('⚠️  Post button not found after trying all methods');
      return null;
    } catch (error) {
      console.error('Error finding post button:', error);
      return null;
    }
  }
}
