import { HttpService } from '@nestjs/axios';
import { readFileSync } from 'fs';
import { Command } from 'nest-commander';
import { CommandRunner } from 'nest-commander';
import { launchBrowser } from '../../utils/browser.util';
import { Page } from 'playwright-core';
import { Audience } from './post-tiktok.enum';
import * as os from 'os';

type PostTiktokCommandInputs = {
  show_browser: boolean;
  is_close_browser: boolean;
  video_path: string;
  description: string;
  audience: keyof typeof Audience;
  is_ai_generated: boolean;
  run_copyright_check: boolean;
  is_comment_on: boolean;
  is_duet_on: boolean;
  is_stitch_on: boolean;
};

@Command({
  name: 'post-tiktok',
  description: 'Post a TikTok video',
  arguments: '<file-settings>',
})
export class PostTiktokCommand extends CommandRunner {
  constructor(private readonly httpService: HttpService) {
    super();
  }

  async run(inputs: string[]) {
    const pathFileSetting = inputs[0];
    const fileSettings = JSON.parse(
      readFileSync(pathFileSetting, 'utf8'),
    ) as PostTiktokCommandInputs;

    const browser = await launchBrowser(fileSettings.show_browser);

    try {
      const page = await browser.newPage();

      await page.goto('https://www.tiktok.com/tiktokstudio/upload', {
        waitUntil: 'domcontentloaded',
      });

      const currentUrl = page.url();
      if (currentUrl.includes('login')) {
        console.log('Please login to TikTok');
        if (!fileSettings.show_browser) {
          throw new Error('Please set show_browser to true to login to TikTok');
        }
      }

      try {
        const cancelDraftButton = page.getByRole('button', { name: 'Hủy bỏ' });
        if (await cancelDraftButton.isVisible({ timeout: 2000 })) {
          await cancelDraftButton.click();

          await page.waitForSelector(
            '.common-modal-footer .TUXButton-label:text("Hủy bỏ")',
            {
              timeout: 3000,
            },
          );

          await page
            .locator('.common-modal-footer .TUXButton-label:text("Hủy bỏ")')
            .click();
        }
      } catch (e) {
        console.log('No draft cancel popup', e);
      }

      console.log('📤 Uploading video file...');
      await page.setInputFiles('input[type="file"]', fileSettings.video_path);

      console.log('⏳ Waiting for video processing...');
      try {
        await page.waitForSelector(
          '.info-body .info-main span[data-icon="CheckCircleFill"]',
          { timeout: 60000 },
        );
        console.log('✅ Video processing complete');
      } catch (e) {
        console.log('⚠️ Video processing CheckCircleFill indicator not found (or timed out), continuing anyway...');
      }

      await this.setDescription(page, fileSettings.description);

      await this.selectDropdownById(page, Audience[fileSettings.audience]);

      await page.locator('.more-btn').click();

      await this.clickCheckboxByIndex(page, 0, fileSettings.is_comment_on);
      await this.clickCheckboxByIndex(page, 1, fileSettings.is_duet_on);
      await this.clickCheckboxByIndex(page, 2, fileSettings.is_stitch_on);

      await this.setSwitchAIGenerated(page, fileSettings.is_ai_generated);

      await this.setSwitchCopyright(page, fileSettings.run_copyright_check);

      // Wait for any checking/processing to complete
      await this.waitForProcessingComplete(page);

      // Handle cookie banner and overlays before posting
      await this.handleCookieBannerAndOverlays(page);
      
      // Wait for any overlays to disappear and ensure button is clickable
      console.log('Waiting before attempting to click post button...');
      await page.waitForTimeout(3000);
      
      // Handle "Continue to post?" dialog if it appears
      console.log('🔍 Checking for "Continue to post?" dialog...');
      try {
        const continueDialog = page.locator('text=Continue to post?');
        if (await continueDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('⚠️  Found "Continue to post?" dialog - clicking "Post now"');
          const postNowBtn = page.locator('button:has-text("Post now")').first();
          if (await postNowBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await postNowBtn.click({ force: true });
            await page.waitForTimeout(2000);
          }
        }
      } catch (e) {
        console.log('No continue dialog found');
      }
      
      // Handle "Stop copyright checking?" dialog if it appears
      console.log('🔍 Checking for "Stop copyright checking?" dialog...');
      try {
        const stopDialog = page.locator('text=Stop copyright checking?');
        if (await stopDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('⚠️  Found "Stop copyright checking?" dialog - clicking "Stop"');
          const stopBtn = page.locator('button:has-text("Stop")').last();
          if (await stopBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await stopBtn.click({ force: true });
            await page.waitForTimeout(2000);
          }
        }
      } catch (e) {
        console.log('No stop dialog found');
      }
      
      const postButton = page.locator('.footer button[data-e2e="post_video_button"]');
      await postButton.waitFor({ state: 'visible', timeout: 10000 });
      
      console.log('Post button is visible, attempting to click...');
      
      // Check if button is actually enabled
      const isEnabled = await postButton.isEnabled().catch(() => false);
      console.log(`📍 Post button enabled: ${isEnabled}`);
      
      // Remove any overlay elements that might interfere
      await page.evaluate(() => {
        // Remove cookie banner completely
        const cookieBanners = document.querySelectorAll('tiktok-cookie-banner');
        cookieBanners.forEach(banner => banner.remove());
        
        // Remove any overlay elements
        const overlays = document.querySelectorAll('[style*="position: fixed"], [style*="z-index"]');
        overlays.forEach(overlay => {
          const element = overlay as HTMLElement;
          if (element.style.zIndex && parseInt(element.style.zIndex) > 1000) {
            element.remove();
          }
        });
      });
      
      await page.waitForTimeout(500);
      
      // Scroll to button and ensure it's in view
      await postButton.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      
      // Try to click the post button - force click bypasses stability checks
      let clickSuccess = false;
      try {
        console.log('📍 Attempting force click on post button...');
        await postButton.click({ force: true, timeout: 10000 });
        clickSuccess = true;
        console.log('✅ Post button clicked successfully');
      } catch (clickError) {
        console.log(`⚠️ Click failed: ${clickError.message}, trying JavaScript click...`);
        // Try JavaScript click as fallback
        try {
          const jsResult = await page.evaluate(() => {
            const btn = document.querySelector('.footer button[data-e2e="post_video_button"]') as HTMLElement;
            if (btn && !btn.hasAttribute('disabled')) {
              btn.click();
              return true;
            }
            return false;
          });
          if (jsResult) {
            clickSuccess = true;
            console.log('✅ JavaScript click succeeded');
          }
        } catch (jsError) {
          console.log(`⚠️ JavaScript click also failed: ${jsError.message}`);
        }
      }

      // Handle "Continue to post?" dialog immediately after clicking post button
      // This dialog appears when video is still being checked by TikTok
      if (clickSuccess) {
        console.log('⏳ Monitoring for "Continue to post?" dialog (critical - must click immediately)...');
        
        // Check for dialog with rapid polling to catch it as soon as it appears
        let dialogHandled = false;
        const maxAttempts = 15; // 15 * 300ms = 4.5 seconds
        
        for (let attempt = 0; attempt < maxAttempts && !dialogHandled; attempt++) {
          try {
            // Look for the dialog that says "Continue to post?"
            const dialogText = page.locator('[role="dialog"] >> text=Continue to post?');
            const isVisible = await dialogText.isVisible({ timeout: 300 }).catch(() => false);
            
            if (isVisible) {
              console.log('⚠️  CRITICAL: "Continue to post?" dialog detected - clicking "Post now" immediately!');
              
              // Find and click the red "Post now" button
              const postNowBtn = page.locator('[role="dialog"] button:has-text("Post now")').first();
              const isBtnVisible = await postNowBtn.isVisible({ timeout: 300 }).catch(() => false);
              
              if (isBtnVisible) {
                await postNowBtn.click({ force: true, timeout: 5000 });
                console.log('✅ SUCCESS: "Post now" button clicked - video posting initiated!');
                dialogHandled = true;
                await page.waitForTimeout(1500);
                break;
              }
            }
          } catch (e) {
            // Continue polling
          }
          
          if (!dialogHandled && attempt < maxAttempts - 1) {
            await page.waitForTimeout(300); // 300ms between checks
          }
        }
        
        if (!dialogHandled) {
          console.log('ℹ️  No "Continue to post?" dialog detected - video may be ready to post immediately');
        }
      }

      // Wait for TikTok to process and publish the video
      if (clickSuccess) {
        console.log('⏳ Waiting for TikTok to publish video...');
        
        // Check for loading indicators that show during publish
        const publishingIndicators = [
          '.publish-progress',
          '.uploading-progress',
          '[class*="publishing"]',
          '[class*="upload-progress"]',
          '.spinner',
          '.loader'
        ];

        let isPublishing = false;
        
        // Look for publishing indicators (max 5 seconds)
        for (let i = 0; i < 5; i++) {
          for (const selector of publishingIndicators) {
            try {
              const indicator = page.locator(selector);
              if (await indicator.isVisible({ timeout: 500 }).catch(() => false)) {
                console.log(`🔄 Publishing in progress (indicator: ${selector})...`);
                isPublishing = true;
                break;
              }
            } catch (e) {
              // Continue
            }
          }
          if (isPublishing) break;
          await page.waitForTimeout(1000);
        }

        // Wait for publishing to complete (max 2 minutes)
        if (isPublishing) {
          console.log('⏳ Video is being published, waiting for completion...');
          try {
            await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {
              console.log('Navigation did not occur, checking for success message...');
            });
          } catch (e) {
            console.log('Navigation timeout - video may still be publishing');
          }
        }

        // Look for success message or verification
        console.log('⏳ Checking for publish success confirmation...');
        const successIndicators = [
          'text=successfully posted',
          'text=successfully published',
          'text=posted',
          'text=发布成功',
          'text=视频发布成功',
          '[data-testid="success-message"]'
        ];

        let foundSuccess = false;
        for (const indicator of successIndicators) {
          try {
            const element = page.locator(indicator);
            if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
              console.log(`✅ Found success confirmation: ${indicator}`);
              foundSuccess = true;
              break;
            }
          } catch (e) {
            // Continue
          }
        }

        if (!foundSuccess) {
          console.log('⏳ Still waiting for final confirmation (20 seconds)...');
          await page.waitForTimeout(20000);
          console.log('✅ Video publish command completed - TikTok is processing');
        } else {
          console.log('✅ Video successfully published!');
        }
      }
    } catch (error) {
      console.log('Can not post video');
      console.error(error);
      throw error;
    } finally {
      if (fileSettings.is_close_browser) {
        await browser.close();
      }
    }
  }

  private async setDescription(page: Page, description: string) {
    const platform = os.platform();
    const selectAllShortcut = platform === 'darwin' ? 'Meta+A' : 'Control+A';
    await page.click('.public-DraftEditor-content');
    await page.keyboard.press(selectAllShortcut);
    await page.keyboard.press('Backspace');
    await page.type('.public-DraftEditor-content', description);
  }

  private async clickCheckboxByIndex(
    page: Page,
    index: number,
    value: boolean,
  ) {
    const labels = page.locator('.checkbox-container label');
    const checkboxCount = await labels.count();

    if (index >= checkboxCount) {
      console.log(
        `⚠️  Checkbox index ${index} not available (only ${checkboxCount} found) – skipping toggle`,
      );
      return;
    }

    const label = labels.nth(index);
    const checkbox = label.locator('input[type="checkbox"]');
    const isChecked = await checkbox.isChecked();

    const isDisabled = await checkbox.isDisabled();

    if (isDisabled) {
      return;
    }

    if (isChecked !== value) {
      await label.click();
    }
  }

  private async setSwitchAIGenerated(page: Page, checked: boolean) {
    const toggle = page.locator('[data-e2e="aigc_container"] .Switch__content');
    const current = await toggle.getAttribute('aria-checked');
    if ((checked && current === 'false') || (!checked && current === 'true')) {
      await toggle.click();
    }

    if (checked) {
      try {
        const modalFooter = page.locator('.common-modal-footer');
        await modalFooter.waitFor({ state: 'visible', timeout: 500 });

        const primaryButton = modalFooter.locator(
          'button[data-type="primary"]',
        );

        await primaryButton.click({
          timeout: 500,
        });
      } catch (e: unknown) {
        console.log('No modal footer', (e as Error).message);
      }
    }
  }

  private async waitForProcessingComplete(page: Page) {
    try {
      console.log('⏳ Waiting for any processing/checking to complete...');
      
      // Look for processing indicators
      const processingIndicators = [
        '.upload-progress',
        '.checking-icon',
        '[class*="loading"]',
        '[class*="processing"]',
        '[class*="checking"]',
        '.spinner',
        '.loader'
      ];

      for (const selector of processingIndicators) {
        try {
          const indicator = page.locator(selector);
          const isVisible = await indicator.isVisible({ timeout: 2000 }).catch(() => false);
          
          if (isVisible) {
            console.log(`Found processing indicator: ${selector}`);
            // Wait for it to disappear (max 30 seconds)
            await indicator.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {
              console.warn(`Timeout waiting for ${selector} to disappear`);
            });
            console.log(`✅ Processing indicator disappeared`);
          }
        } catch (e) {
          // Continue checking other indicators
        }
      }

      // Also wait a bit after any indicators disappear
      await page.waitForTimeout(2000);
      
    } catch (error) {
      console.warn(`⚠️ Error waiting for processing: ${error.message}`);
      // Don't throw - just continue
    }
  }

  private async selectDropdownById(page: Page, optionId: number) {
    const escapedId = `option-\\"${optionId}\\"`;

    await page
      .locator('.view-auth-container .Select__root button.Select__trigger')
      .click();

    await page.locator(`[id=${escapedId}]`).click();
  }

  private async setSwitchCopyright(page: Page, checked: boolean) {
    const switchContent = page.locator('.copyright-check .Switch__content');

    const isDisabled = await switchContent.getAttribute('data-disabled');
    if (isDisabled === 'true') {
      console.warn('⚠️ Switch is disabled. Cannot change state.');
      return;
    }

    const current = await switchContent.getAttribute('aria-checked');
    if ((checked && current === 'false') || (!checked && current === 'true')) {
      await switchContent.click();

      // No waiting for copyright check completion – post immediately
      console.log('⚡ Triggered copyright switch and continuing without wait');
    }
  }

  // Helper method to handle cookie banner and overlays
  private async handleCookieBannerAndOverlays(page: Page) {
    try {
      console.log('Starting cookie banner and overlay handling...');
      
      // Wait a bit for any dynamic content to load
      await page.waitForTimeout(3000);

      // Handle cookie banner - try multiple aggressive approaches
      const cookieBanner = page.locator('tiktok-cookie-banner');
      let attempts = 0;
      const maxAttempts = 5;

      while (await cookieBanner.isVisible({ timeout: 1000 }) && attempts < maxAttempts) {
        console.log(`Cookie banner attempt ${attempts + 1}/${maxAttempts}...`);
        
        try {
          // Strategy 1: Try to find and click buttons inside cookie banner
          const buttons = await cookieBanner.locator('button').all();
          for (const button of buttons) {
            try {
              const text = await button.textContent({ timeout: 1000 });
              console.log(`Found button in cookie banner: "${text}"`);
              if (text && /accept|agree|got it|okay|allow|continue/i.test(text)) {
                await button.click({ force: true });
                await page.waitForTimeout(1000);
                break;
              }
            } catch (e) {
              // Continue to next button
            }
          }

          // Strategy 2: Try to click any clickable element in cookie banner
          if (await cookieBanner.isVisible({ timeout: 500 })) {
            await cookieBanner.click({ force: true, position: { x: 100, y: 50 } });
            await page.waitForTimeout(1000);
          }

          // Strategy 3: Use JavaScript to remove the banner
          if (await cookieBanner.isVisible({ timeout: 500 })) {
            await page.evaluate(() => {
              const banner = document.querySelector('tiktok-cookie-banner');
              if (banner) {
                banner.remove();
              }
            });
          }

          // Strategy 4: Set display none via CSS
          if (await cookieBanner.isVisible({ timeout: 500 })) {
            await page.evaluate(() => {
              const banner = document.querySelector('tiktok-cookie-banner');
              if (banner) {
                (banner as HTMLElement).style.display = 'none';
                (banner as HTMLElement).style.visibility = 'hidden';
                (banner as HTMLElement).style.opacity = '0';
                (banner as HTMLElement).style.pointerEvents = 'none';
              }
            });
          }

        } catch (error) {
          console.log(`Cookie banner strategy failed: ${error.message}`);
        }
        
        attempts++;
        await page.waitForTimeout(1000);
      }

      if (!(await cookieBanner.isVisible({ timeout: 1000 }))) {
        console.log('Cookie banner successfully handled!');
      } else {
        console.log('Cookie banner still visible, trying to proceed anyway...');
      }

      // Handle any other modal overlays
      try {
        const modals = page.locator('.modal, [role="dialog"], .overlay, .popup');
        const modalCount = await modals.count();
        
        for (let i = 0; i < modalCount; i++) {
          const modal = modals.nth(i);
          if (await modal.isVisible({ timeout: 1000 })) {
            console.log(`Found modal overlay ${i + 1}, trying to close...`);
            
            // Try to find close button
            const closeSelectors = [
              'button[aria-label*="close"]',
              'button[aria-label*="Close"]',
              'button:has-text("×")',
              'button:has-text("Close")',
              '.close-button',
              '[data-testid="close"]'
            ];

            for (const selector of closeSelectors) {
              try {
                const closeButton = modal.locator(selector).first();
                if (await closeButton.isVisible({ timeout: 500 })) {
                  await closeButton.click({ force: true });
                  await page.waitForTimeout(500);
                  break;
                }
              } catch (e) {
                // Continue to next selector
              }
            }
          }
        }
      } catch (error) {
        console.log('Modal handling error:', error.message);
      }

    } catch (error) {
      console.log('Error handling overlays:', error.message);
    }
  }
}
