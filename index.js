const puppeteer = require("puppeteer");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const TARGET_URL = "https://www.ntc.net.np/post/interview-results"; // Replace with your website
const CHECK_INTERVAL = 60000; // Check every 60 seconds
const EMAIL = {
  service: "gmail",
  user: "pramodlaha375@gmail.com", // Your email
  pass: "jetf vklm cgfh yhyg", // App password for Gmail
  recipients: ["kamleshlaha@gmail.com", "pramodlaha@himalayacollege.edu.np"], // Array of emails
};
const DOWNLOAD_DIR = path.resolve(__dirname, "downloads");
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);

let lastNotices = []; // Store the last notices to detect changes

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  service: EMAIL.service,
  auth: {
    user: EMAIL.user,
    pass: EMAIL.pass,
  },
});

// Function to send email
async function sendEmail(subject, text, attachmentPath = null) {
  const mailOptions = {
    from: EMAIL.user,
    to: EMAIL.recipients.join(","),
    subject,
    text,
    ...(attachmentPath && {
      attachments: [
        {
          path: attachmentPath,
        },
      ],
    }),
  };

  await transporter.sendMail(mailOptions);
  console.log("Notification sent!");
}

// Function to scrape notices
async function scrapeNotices() {
  console.log(`Checking for updates on ${TARGET_URL}...`);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });

    // Extract notice links (example: all links with "pdf" in href)
    const notices = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href$='.pdf']"), (el) => ({
        text: el.innerText.trim(),
        href: el.href,
      }))
    );

    if (!notices.length) {
      console.log("No notices found.");
      return;
    }

    // Compare with the last fetched notices
    const newNotices = notices.filter(
      (notice) => !lastNotices.some((n) => n.href === notice.href)
    );

    if (newNotices.length) {
      console.log(`New notices found: ${newNotices.length}`);
      for (const notice of newNotices) {
        console.log(`New notice: ${notice.text} - ${notice.href}`);

        // Download PDF (optional)
        const pdfPath = path.join(DOWNLOAD_DIR, path.basename(notice.href));
        await downloadPDF(notice.href, pdfPath);

        // Notify via email
        await sendEmail(
          `New Notice: ${notice.text}`,
          `A new notice has been posted: ${notice.text}\n\nLink: ${notice.href}`,
          pdfPath
        );
      }

      // Update the last notices
      lastNotices = notices;
    } else {
      console.log("No new notices.");
    }
  } catch (err) {
    console.error("Error scraping notices:", err);
  } finally {
    await browser.close();
  }
}

// Function to download PDF
async function downloadPDF(url, outputPath) {
  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
    });
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  } catch (err) {
    console.error("Error downloading PDF:", err);
  }
}

// Main function to start monitoring
async function monitorNotices() {
  await scrapeNotices();
  setInterval(scrapeNotices, CHECK_INTERVAL);
}

// Start the script
monitorNotices();
