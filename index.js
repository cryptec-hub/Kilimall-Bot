const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const readline = require('readline');

// Use Puppeteer Extra with the Stealth Plugin
puppeteer.use(StealthPlugin());

// Create an interface for reading input from the command line
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Function to prompt the user for input
function prompt(question) {
    return new Promise((resolve) => rl.question(question, resolve));
}

// Function to get the current time in a readable format
function getCurrentTimeString() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
}

// Function to update the remaining time until the flash sale
function updateTimeUntilFlashSale(targetHour, targetMinute) {
    setInterval(() => {
        const timeUntilSale = getTimeUntil(targetHour, targetMinute);
        const seconds = Math.floor(timeUntilSale / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const displayMinutes = minutes % 60;
        const displaySeconds = seconds % 60;

        console.log(`Current time: ${getCurrentTimeString()}`);
        console.log(`Time until flash sale: ${hours}h ${displayMinutes}m ${displaySeconds}s`);
    }, 1000); // Update every second
}

// Main function to automate the process
(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36');

    // Prompt the user for the product URL
    const productUrl = await prompt('Please enter the product URL: ');

    // Prompt the user for the desired price
    const desiredPrice = parseFloat(await prompt('Please enter your desired price: '));

    // Prompt the user for the flash sale time
    const saleHour = parseInt(await prompt('Please enter the flash sale hour (24-hour format, e.g., 10 for 10 AM): '), 10);
    const saleMinute = parseInt(await prompt('Please enter the flash sale minute (e.g., 0 for the start of the hour): '), 10);

    console.log(`Product URL: ${productUrl}`);
    console.log(`Desired Price: ${desiredPrice}`);
    console.log(`Flash Sale Time: ${saleHour}:${saleMinute}`);

    // Navigate to Kilimall login page
    await page.goto('https://www.kilimall.co.ke/login', { waitUntil: 'networkidle2' });

    console.log('Please log in manually in the opened browser...');

    // Wait for manual login
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    console.log('Logged in successfully! Preparing for the flash sale...');

    // Start updating the time until the flash sale
    updateTimeUntilFlashSale(saleHour, saleMinute);

    // Calculate time until flash sale starts
    const timeUntilSale = getTimeUntil(saleHour, saleMinute);

    console.log(`Waiting ${Math.ceil(timeUntilSale / 1000)} seconds until the flash sale starts.`);
    await delay(timeUntilSale); // Wait until flash sale starts

    // Navigate to the product page
    await page.goto(productUrl, { waitUntil: 'networkidle2' });

    // Function to check the price and attempt a purchase
    async function checkPriceAndPurchase() {
        try {
            // Refresh the page to get the latest price
            await page.reload({ waitUntil: 'networkidle2' });

            // Extract the product price from the page
            const priceElement = await page.$('.sale-price'); // Replace '.sale-price' with the actual price selector
            if (!priceElement) {
                console.log('Price element not found.');
                return;
            }

            const priceText = await page.evaluate(el => el.textContent, priceElement);
            const currentPrice = parseFloat(priceText.replace(/[^0-9.-]+/g, '')); // Convert price to a number

            console.log(`Current price: Ksh. ${currentPrice}`);

            // If the price is less than or equal to the desired price, proceed to purchase
            if (currentPrice <= desiredPrice) {
                console.log('Price is within the desired range, attempting to purchase...');

                // Listen for new tab
                const [newTab] = await Promise.all([
                    new Promise(resolve => browser.once('targetcreated', async target => resolve(await target.page()))),
                    page.click('#__nuxt > div > div.pc__listing-detail-page > div.sku-wrapper > div.content-box > div.buyer-infos > div.opt-button-bar.info-item > button.van-button.van-button--primary.van-button--normal.opt-btn.red-btn') // Replace '.buy-button-selector' with the actual buy button selector
                ]);

                // Switch to the new tab
                await newTab.waitForNavigation({ waitUntil: 'networkidle2' });

                // Wait for the checkout button to be clickable
                await newTab.waitForSelector('#__nuxt > div > div.pc__order-checkout > div.order-card.price-card > div.place-order > button', { visible: true, timeout: 10000 });

                // Ensure the button is not covered by other elements
                await newTab.evaluate(() => {
                    const button = document.querySelector('#__nuxt > div > div.pc__order-checkout > div.order-card.price-card > div.place-order > button');
                    if (button) {
                        button.scrollIntoView();
                    }
                });

                await newTab.click('#__nuxt > div > div.pc__order-checkout > div.order-card.price-card > div.place-order > button');

                // Optionally, wait for confirmation or further actions
                await newTab.waitForNavigation({ waitUntil: 'networkidle2' });

                console.log('Purchase completed or attempted.');

                // Close the browser after purchase
                await browser.close();
            } else {
                console.log('Price is still too high, checking again in 5 seconds.');
            }
        } catch (error) {
            console.error('Error checking price or making purchase:', error);
        }
    }

    // Set an interval to check the price every 5 seconds
    setInterval(checkPriceAndPurchase, 5000);

    // Close the readline interface
    rl.close();
})();

// Utility functions
function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

function getCurrentTime() {
    return new Date().getTime();
}

function getCurrentTimeString() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
}

function getTimeUntil(targetHour, targetMinute) {
    const now = new Date();
    const target = new Date();
    target.setHours(targetHour, targetMinute, 0, 0);

    // If the target time is earlier today, set to the next day
    if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
    }

    return target.getTime() - now.getTime();
}
