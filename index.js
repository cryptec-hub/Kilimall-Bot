const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use Puppeteer Extra with the Stealth Plugin
puppeteer.use(StealthPlugin());

// Define your Kilimall credentials and the product URL
const kilimallCredentials = {
    email: 'njigupaul22@gmail.com',
    password: 'njigupaul22',
};

const productUrl = 'https://www.kilimall.co.ke/listing/18709976-pafel-humidifier-250ml-mini-ultrasonic-air-humidifiers-romantic-light-usb-essential-oil-diffuser-vehicle-mounted-purifier-led-changing-color-light-aromatic-anion-spray-humidifier-pinks?from=flash-sale&source=homePage-flashSale-'; // Replace with the actual product URL
const desiredPrice = 1000; // The maximum price you're willing to pay

// Utility function to delay actions
function delay(time) {
    return new Promise(function (resolve) {
        setTimeout(resolve, time);
    });
}

// Main function to automate the process
(async () => {
    const browser = await puppeteer.launch({ headless: false }); // Launch browser with GUI
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36');

    // Navigate to Kilimall login page
    await page.goto('https://www.kilimall.co.ke/login', { waitUntil: 'networkidle2' });

    console.log('Please log in manually in the opened browser...');

    // Wait for manual login
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // After successful login, execute remaining code
    console.log('Logged in successfully! Continuing with the script...');

    // After logging in, navigate to the product page
    await page.goto(productUrl, { waitUntil: 'networkidle2' });

    // Function to check the price and attempt a purchase
    async function checkPriceAndPurchase() {
        try {
            // Extract the product price from the page
            const priceElement = await page.$('.sale-price'); // Replace '.product-price-selector' with the actual price selector
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
})();
