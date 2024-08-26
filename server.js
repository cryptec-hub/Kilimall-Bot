const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const readline = require('readline');

// Use Puppeteer Extra with the Stealth Plugin
puppeteer.use(StealthPlugin());

// Utility function to delay execution
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Function to calculate the remaining time until the flash sale
function getTimeUntil(targetHour, targetMinute) {
    const now = new Date();
    const target = new Date();
    target.setHours(targetHour, targetMinute, 0, 0);

    // If the target time is earlier today, set to the next day
    if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
    }

    return target.getTime() - now.getTime() - 100;
}

// Promisified readline function to ask user input
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => rl.question(query, (ans) => {
        rl.close();
        resolve(ans);
    }));
}

// Main function to automate the process
(async () => {
    const productUrl = await askQuestion('Enter the product URL: ');
    const desiredPrice = parseFloat(await askQuestion('Enter the desired price: '));
    const saleHour = parseInt(await askQuestion('Enter the sale hour (24-hour format): '), 10);
    const saleMinute = parseInt(await askQuestion('Enter the sale minute: '), 10);

    // Configure Puppeteer to run in headless mode and optimize performance
    const browser = await puppeteer.launch({
        headless: true,  // Set to false if you want to see the browser UI
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-blink-features=AutomationControlled'
        ],
    });
    const page = await browser.newPage();

    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36'
    );

    // Block images and stylesheets for faster page loading
    await page.setRequestInterception(true);
    page.on('request', (request) => {
        if (['image'].includes(request.resourceType())) {
            request.abort();
        } else {
            request.continue();
        }
    });

    // Hardcoded credentials for automated login
    const email = 'njigupaul22@gmail.com'; // Replace with your email
    const password = 'njigupaul22'; // Replace with your password

    // Navigate to the Kilimall login page
    await page.goto('https://www.kilimall.co.ke/login', { waitUntil: 'networkidle2' });

    // ** Add a wait for the login form to load **
    try {
        await page.waitForSelector('input[name="account"]', { visible: true, timeout: 30000 });
    } catch (error) {
        console.error('Login form did not load or selector changed. Please check the website and update the selector.', error);
        await browser.close();
        return;
    }

    // Automate the login process
    console.log("Filling in log in details");
    await page.type('input[name="account"]', email, { delay: 100 });
    await page.type('input[name="password"]', password, { delay: 100 });
    await page.click('#__nuxt > div > div.login-wrapper > div > div:nth-child(1) > div > form > div.submit-button > button');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    console.log('Logged in successfully! Preparing for the flash sale...');

    // Calculate time until flash sale starts
    const timeUntilSale = getTimeUntil(saleHour, saleMinute);
    const minutes = Math.floor(timeUntilSale / 1000 / 60); // Calculate total minutes
    const seconds = Math.floor((timeUntilSale / 1000) % 60); // Calculate remaining seconds

    console.log(`Waiting ${minutes} minutes and ${seconds} seconds until the flash sale starts.`);

    // Wait until the flash sale starts
    await delay(timeUntilSale);

    // Main function to check the price and attempt to purchase
    async function checkPriceAndPurchase() {
        try {
            console.log('Navigating to the product page...');
            await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            console.log('Waiting for the page to fully load...');
            await page.waitForFunction(() => document.readyState === 'complete', { timeout: 60000 });

            // Check for the price element
            const priceSelector = '.sale-price'; // Replace with the actual price selector
            const buyButtonSelector = '#__nuxt > div > div.pc__listing-detail-page > div.sku-wrapper > div.content-box > div.buyer-infos > div.opt-button-bar.info-item > button.van-button.van-button--primary.van-button--normal.opt-btn.red-btn'; // Replace with the actual buy button selector

            // Wait for the price element to be available
            await page.waitForSelector(priceSelector, { visible: true, timeout: 30000 });

            // Extract the product price
            const priceText = await page.$eval(priceSelector, el => el.textContent);
            const currentPrice = parseFloat(priceText.replace(/[^0-9.-]+/g, ''));

            console.log(`Current price: Ksh. ${currentPrice}`);

            // If the price is within the desired range, attempt to purchase
            if (currentPrice <= desiredPrice) {
                console.log('Price is within the desired range, attempting to purchase...');

                // Wait for the "Buy Now" button text to appear
                await page.waitForFunction(
                    (selector, text) => {
                        const button = document.querySelector(selector);
                        return button && button.textContent.includes(text);
                    },
                    { timeout: 30000 },
                    buyButtonSelector,
                    'Buy Now'
                );

                console.log('Buy Now button is available, clicking it.');
                // Click the "Buy Now" button
                await page.click(buyButtonSelector);

                console.log('Waiting for the checkout page to load...');

                // Wait a bit to ensure the new tab has time to open
                await delay(2000);

                // Get all open pages (tabs)
                const pages = await browser.pages();

                // Find the checkout tab by URL
                const checkoutPage = pages.find(p => p.url().includes('https://www.kilimall.co.ke/checkout'));

                if (checkoutPage) {
                    console.log('Checkout tab found. Switching to checkout tab...');

                    // Bring the checkout page to the foreground
                    await checkoutPage.bringToFront();

                    // Selector for the purchase button on the checkout page
                    const purchaseButtonSelector = '#__nuxt > div > div.pc__order-checkout > div.order-card.price-card > div.place-order > button';

                    // Wait for the button to be available and visible
                    try {
                        await checkoutPage.waitForSelector(purchaseButtonSelector, { visible: true, timeout: 30000 });
                        console.log('Purchase button is visible.');
                    } catch (error) {
                        console.error('Purchase button not found or not visible:', error);
                        return;
                    }

                    // Ensure the button is in view and clickable
                    console.log('Ensuring the button is in view and not covered by other elements...');
                    await checkoutPage.evaluate((selector) => {
                        const button = document.querySelector(selector);
                        if (button) {
                            button.scrollIntoView();
                            button.style.display = 'block';  // Ensuring the button is not hidden
                        }
                    }, purchaseButtonSelector);

                    // Wait briefly to ensure all animations or dynamic changes are complete
                    await delay(1000);

                    // Attempt to click the purchase button using a more robust method
                    console.log('Clicking the purchase button...');
                    try {
                        await checkoutPage.evaluate((selector) => {
                            const button = document.querySelector(selector);
                            if (button) {
                                button.click();
                            }
                        }, purchaseButtonSelector);
                    } catch (error) {
                        console.error('Failed to click the purchase button:', error);
                        return;
                    }

                    // Wait for the modal to appear
                    const modalSelector = '#__nuxt > div > div.van-popup.van-popup--round.van-popup--center > div';
                    const modalButtonSelector = '#__nuxt > div > div.van-popup.van-popup--round.van-popup--center > div > div > button';

                    try {
                        console.log('Waiting for the modal to appear...');
                        await checkoutPage.waitForSelector(modalSelector, { visible: true, timeout: 30000 });
                        console.log('Modal is visible.');

                        // Ensure the modal button is visible and interactable
                        await checkoutPage.waitForSelector(modalButtonSelector, { visible: true, timeout: 30000 });
                        console.log('Modal button is visible and interactable.');

                        await checkoutPage.screenshot({ path: 'before-modal-click.png' });

                        // Verify if the button is not disabled
                        const isButtonEnabled = await checkoutPage.evaluate((selector) => {
                            const button = document.querySelector(selector);
                            return button && !button.disabled;
                        }, modalButtonSelector);

                        if (!isButtonEnabled) {
                            console.error('Modal button is present but disabled.');
                            return;
                        }

                        // Click the button inside the modal
                        console.log('Clicking the button inside the modal...');
                        await delay(3000);
                        await checkoutPage.click(modalButtonSelector, { delay: 100 });

                        // Add a manual delay to wait for any further actions or changes
                        await delay(10000);

                        await checkoutPage.screenshot({ path: 'after-modal-click.png' });
                        console.log('Button clicked inside the modal successfully.');

                    } catch (error) {
                        console.error('Modal or button inside the modal not found, not visible, or clicking failed:', error);
                        await checkoutPage.screenshot({ path: 'modal-not-found.png' }); // Screenshot if the modal fails to load
                    }

                    console.log('Purchase completed or attempted.');
                    // Close the browser after purchase if needed
                    // await browser.close();
                } else {
                    console.error('Checkout tab not found.');
                }
            } else {
                console.log('Price is still too high. Checking again in 5 seconds...');
                setTimeout(checkPriceAndPurchase, 5000);
            }
        } catch (error) {
            console.error('An error occurred during the purchase process:', error);
        }
    }

    // Start the price check and purchase process
    await checkPriceAndPurchase();

    // Close the browser after the script completes
    await browser.close();
})();
