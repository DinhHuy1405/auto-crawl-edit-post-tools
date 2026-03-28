import { Command, CommandRunner } from 'nest-commander';
import { HttpService } from '@nestjs/axios';
import { launchBrowser } from '../../utils/browser.util';
import { readFileSync } from 'fs';
import { Page } from 'playwright-core';
import { retry } from '../../utils/common.util';

type PostReelsFacebookCommandInputs = {
  show_browser: boolean;
  is_close_browser: boolean;
  video_path: string;
  description: string;
  page?: string;
  profile_id?: string;
};

@Command({
  name: 'post-reels-facebook',
  description: 'Post a reels to Facebook',
})
export class PostReelsFacebookCommand extends CommandRunner {
  constructor(private readonly httpService: HttpService) {
    super();
  }

  async run(inputs: string[]) {
    const pathFileSetting = inputs[0];
    const fileSettings = JSON.parse(
      readFileSync(pathFileSetting, 'utf8'),
    ) as PostReelsFacebookCommandInputs;

    const browser = await launchBrowser(fileSettings.show_browser);

    try {
      const page = await browser.newPage();

      // If profile_id is provided, go directly to that profile
      if (fileSettings.profile_id) {
        console.log(`Going directly to profile: ${fileSettings.profile_id}`);
        await page.goto(`https://www.facebook.com/profile.php?id=${fileSettings.profile_id}`, {
          waitUntil: 'domcontentloaded',
        });
        await page.waitForTimeout(3000);
      } else {
        await page.goto('https://www.facebook.com/', {
          waitUntil: 'domcontentloaded',
        });
      }

      const loginForm = await page.$('[data-testid="royal_login_form"]');
      if (loginForm) {
        console.log('Please login to Facebook');
        if (!fileSettings.show_browser) {
          throw new Error(
            'Please set show_browser to true to login to Facebook',
          );
        }
      }

      if (fileSettings.page && !fileSettings.profile_id) {
        await retry(async () => {
          await this.selectProfile(page, fileSettings.page!);
        });
      }

      await this.postReels(page, fileSettings);
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      // Always close browser after completion (success or failure)
      console.log('Closing browser...');
      await browser.close();
    }
  }

  private async selectProfile(page: Page, profileName: string) {
    // Check if profile already selected (without clicking)
    const alreadySelected = await this.isProfileSelected(page, profileName);
    if (alreadySelected) {
      console.log(`✅ Profile ${profileName} already selected`);
      return;
    }

    console.log(`Attempting to select profile: ${profileName}`);
    
    // Open profile dialog
    const profileButton = page.locator('div[aria-label="Your profile"][role="button"]');
    await profileButton.waitFor({ state: 'visible', timeout: 30000 });
    await profileButton.click();

    await page.waitForTimeout(1500);

    const dialog = page.locator(
      'div[role="dialog"][aria-label="Your profile"]',
    );
    await dialog.waitFor({ state: 'visible', timeout: 15000 });

    // Check if we need to click "See all profiles"
    const seeAllButton = dialog.locator(
      '[role="button"][aria-label="See all profiles"]',
    );
    if ((await seeAllButton.count()) > 0) {
      console.log('Clicking "See all profiles"...');
      await seeAllButton.click();
      await page.waitForTimeout(1500);
    }

    const list = dialog.locator('[role="list"]');
    await list.waitFor({ state: 'visible', timeout: 10000 });

    // Find profile button with exact name
    const targetButton = list.locator(
      `div[role="button"][tabindex="0"]`
    );
    
    const count = await targetButton.count();
    console.log(`Found ${count} profile buttons`);
    
    // Find the one that matches
    let found = false;
    for (let i = 0; i < count; i++) {
      const text = await targetButton.nth(i).getAttribute('aria-label');
      if (text && text.includes(profileName)) {
        console.log(`Found matching profile at index ${i}: ${text}`);
        await targetButton.nth(i).click();
        found = true;
        break;
      }
    }
    
    if (!found) {
      throw new Error(`Không tìm thấy profile "${profileName}"`);
    }

    // Wait for profile switch loader
    await page.waitForTimeout(2000);
    const loader = page.locator('#switching-info-container');
    const loaderExists = await loader.count() > 0;
    if (loaderExists) {
      try {
        await loader.waitFor({ state: 'hidden', timeout: 10000 });
      } catch (e) {
        console.log('Loader did not appear, continuing...');
      }
    }

    // Close dialog if it's still open
    await page.waitForTimeout(500);
    const closeButton = page.locator('div[role="dialog"] button[aria-label="Close"]').first();
    if (await closeButton.count() > 0) {
      await closeButton.click();
    }

    // Verify profile is selected
    await page.waitForTimeout(1000);
    const isSelected = await this.isProfileSelected(page, profileName);
    if (isSelected) {
      console.log(`✅ Successfully selected profile: ${profileName}`);
    } else {
      throw new Error(`Failed to select profile ${profileName}`);
    }
  }

  private async isProfileSelected(page: Page, profileName: string): Promise<boolean> {
    try {
      // Check page title or current URL that might indicate profile
      const title = await page.title();
      console.log(`Current page title: ${title}`);
      
      // Alternative: check if we can find the page name in top navigation
      const pageIndicator = page.locator(`[aria-label^="${profileName}"][role="link"]`);
      if ((await pageIndicator.count()) > 0) {
        return true;
      }
      
      // Another approach: check if creating reels shows correct page  
      // This will be verified when we try to post
      return false;
    } catch (error) {
      return false;
    }
  }

  private async postReels(page: Page, input: PostReelsFacebookCommandInputs) {
    try {
      console.log('Current URL:', page.url());
      
      // Try to click Reel button if it exists (for old flow)
      const reelButton = page.locator('div[role="button"]:has-text("Reel")');
      if ((await reelButton.count()) > 0) {
        console.log('Found Reel button, clicking...');
        await reelButton.click();
        await page.waitForTimeout(2000);
      } else {
        console.log('No Reel button found, checking current state...');
        // Check if we're already on upload page
        const fileInput = page.locator('div[aria-label="Reels"][role="form"] input[type="file"]');
        if ((await fileInput.count()) > 0) {
          console.log('Already on new Reels upload page');
        } else {
          console.log('Not on expected page, trying old URL path');
          await page.goto('https://www.facebook.com/reels/create/');
          await page.waitForTimeout(2000);
        }
      }

      const currentUrl = page.url();
      if (currentUrl.includes('/reels/create/')) {
        console.log('Using old URL path');
        return this.postReelsOldUrl(page, input);
      }

      console.log('Using new URL path');
      return this.postReelsNewUrl(page, input);
    } catch (error) {
      console.error('Đăng reels thất bại:', error);
      throw error;
    }
  }

  private async postReelsOldUrl(
    page: Page,
    input: PostReelsFacebookCommandInputs,
  ) {
    await page.goto('https://www.facebook.com/reels/create/');

    await page.setInputFiles('input[type="file"]', input.video_path);

    await page.waitForSelector('div[aria-label="Next"][role="button"]');
    await page.click('div[aria-label="Next"]');

    await page.waitForTimeout(1000);

    const nextButtonStep2 = page
      .locator('div[aria-label="Next"][role="button"]')
      .nth(1);
    await nextButtonStep2.click();

    await page.waitForSelector('div[role="form"]');
    const editor = page.locator('div[role="form"] [contenteditable="true"]');
    await editor.click();
    await page.keyboard.type(input.description, {
      delay: 100,
    });

    await page.waitForTimeout(1000);

    const publishButton = page.locator(
      'div[aria-label="Publish"][role="button"]:not([aria-disabled="true"])',
    );
    await publishButton.waitFor({ state: 'visible' });
    await publishButton.click();

    await page.waitForTimeout(2000);

    await page.waitForSelector('[role="status"][aria-label="Loading..."]', {
      state: 'hidden',
    });

    console.log('✅ Reels đã được đăng thành công');
  }

  private async postReelsNewUrl(
    page: Page,
    input: PostReelsFacebookCommandInputs,
  ) {
    console.log('Starting postReelsNewUrl...');
    
    // Step 1: Upload video file
    console.log('Step 1: Uploading video file...');
    const fileInput = page.locator('div[aria-label="Reels"][role="form"] input[type="file"]');
    await fileInput.waitFor({ state: 'attached', timeout: 15000 });
    await fileInput.setInputFiles(input.video_path);
    console.log('✅ Video file selected');
    
    await page.waitForTimeout(2000);

    // Step 2: Click first Next button (after video preview)
    console.log('Step 2: Waiting for first Next button...');
    const nextButton1 = page.locator('div[aria-label="Next"][role="button"]').first();
    await nextButton1.waitFor({ state: 'visible', timeout: 30000 });
    await nextButton1.click();
    console.log('✅ Clicked first Next');
    
    await page.waitForTimeout(2000);

    // Step 3: Wait for copyright check to finish, then click Next
    console.log('Step 3: Waiting for copyright check to complete...');
    try {
      // Wait for "Checking for copyrighted content" text to disappear (up to 60s)
      await page.waitForFunction(
        () => !document.body.innerText.includes('Checking for copyrighted content'),
        { timeout: 60000 }
      );
      console.log('✅ Copyright check done');
    } catch (e) {
      console.log('Copyright check timeout, proceeding anyway...');
    }
    await page.waitForTimeout(1000);

    console.log('Step 3: Waiting for second Next button...');
    const nextButton2 = page.locator('div[aria-label="Next"][role="button"]');
    const nextCountStep3 = await nextButton2.count();
    console.log(`Found ${nextCountStep3} Next buttons`);

    if (nextCountStep3 >= 2) {
      await nextButton2.nth(1).waitFor({ state: 'visible', timeout: 30000 });
      await nextButton2.nth(1).click();
      console.log('✅ Clicked second Next');
    } else if (nextCountStep3 === 1) {
      await nextButton2.first().waitFor({ state: 'visible', timeout: 30000 });
      await nextButton2.first().click();
      console.log('✅ Clicked Next (single button)');
    } else {
      console.warn('No Next button found, proceeding anyway...');
    }

    await page.waitForTimeout(2000);

    // Step 4: Fill description
    console.log('Step 4: Filling description...');
    
    // Wait for any contenteditable element to appear
    const editables = page.locator('[contenteditable="true"]');
    await editables.first().waitFor({ state: 'visible', timeout: 20000 });
    
    const editableCount = await editables.count();
    console.log(`Found ${editableCount} contenteditable elements`);
    
    // Click on the description input (usually first or last contenteditable)
    const descInput = editables.filter({ has: page.locator('text=Describe your reel') }).first();
    const descInputCount = await descInput.count();
    
    let targetInput;
    if (descInputCount > 0) {
      targetInput = descInput;
      console.log('Found description input by text');
    } else {
      // Try to find by aria-label
      targetInput = page.locator('[aria-label*="Describe"]').first();
      if ((await targetInput.count()) === 0) {
        // Just use last contenteditable if description-specific one not found
        targetInput = editables.last();
        console.log('Using last contenteditable element');
      }
    }
    
    await targetInput.click();
    await page.waitForTimeout(500);
    await page.keyboard.type(input.description, { delay: 50 });
    console.log('✅ Description filled');
    
    await page.waitForTimeout(1500);

    // Step 5: Find and click Post button
    console.log('Step 5: Finding Post button...');
    
    // Wait a moment for page to settle
    await page.waitForTimeout(1000);
    
    // Scroll down to make sure button is visible
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    
    // First check if there's a "Next" button we need to click
    const nextButtons = page.locator('div[aria-label="Next"][role="button"]');
    const nextCountFinal = await nextButtons.count();
    
    if (nextCountFinal > 0) {
      console.log(`Found ${nextCountFinal} Next button(s), clicking to proceed to final step...`);
      await nextButtons.last().click();
      console.log('✅ Clicked Next button');
      await page.waitForTimeout(3000);
    }
    
    // Look for Post button - it should be in the same location as Next was
    console.log('Step 5: Looking for Post button...');
    
    let button: any = null;
    
    // Method 1: Find span with exact text "Post" 
    const postSpans = page.locator('span');
    const spanCount = await postSpans.count();
    console.log(`Total spans on page: ${spanCount}`);
    
    for (let i = 0; i < spanCount; i++) {
      const span = postSpans.nth(i);
      const text = await span.textContent();
      
      if (text === 'Post' || text === 'Đăng') {
        console.log(`Found "${text}" span at index ${i}`);
        
        // Get parent div that has role="button"
        // Try going up 1-5 levels
        for (let level = 1; level <= 5; level++) {
          const parent = span.locator(`xpath=ancestor::div[${level}]`);
          if ((await parent.count()) > 0) {
            const role = await parent.getAttribute('role');
            const hasRole = await parent.getAttribute('role');
            
            if (hasRole === 'button') {
              button = parent;
              console.log(`✅ Found parent button at level ${level}`);
              break;
            }
          }
        }
        
        if (button) break;
      }
    }
    
    // Method 2: If not found, search for clickable div near the Post text
    if (!button || (await button.count()) === 0) {
      console.log('Post button not found via span, trying direct search...');
      
      // Find all divs with role="button" in the bottom area
      const allBtnDivs = page.locator('div[role="button"]');
      const btnCount = await allBtnDivs.count();
      
      // Look through last 15 buttons for one with Post text
      for (let i = Math.max(0, btnCount - 15); i < btnCount; i++) {
        const btn = allBtnDivs.nth(i);
        const text = await btn.textContent();
        
        if (text?.includes('Post') && !text?.includes('Support') && !text?.includes('Share')) {
          console.log(`Found button with "Post" at index ${i}: "${text?.trim()}"`);
          button = btn;
          break;
        }
      }
    }
    
    if (!button || (await button.count()) === 0) {
      console.log('❌ Post button not found');
      throw new Error('Could not find Post button');
    }
    
    // Scroll to button and click
    console.log('Scrolling to Post button...');
    await button.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    
    console.log('Clicking Post button...');
    await button.first().click();
    console.log('✅ Post button clicked');

    // Wait for upload to complete
    await page.waitForTimeout(2000);
    const loader = page.locator('[role="status"][aria-label="Loading..."]');
    if ((await loader.count()) > 0) {
      try {
        await loader.waitFor({ state: 'hidden', timeout: 30000 });
      } catch (e) {
        console.log('Loading indicator did not hide, continuing...');
      }
    }

    console.log('✅ Reels đã được đăng thành công');
  }
}
