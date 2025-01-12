const puppeteer = require("puppeteer");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const URL = "https://www.ntc.net.np/post/interview-results"; // Replace with your website
const CHECK_INTERVAL = 60000; // Check every 60 seconds
const EMAIL = {
  service: "gmail",
  user: "pramodlaha375@gmail.com", // Your email
  pass: process.env.APP_PASS, // Securely use the app password
  recipients: ["pramodlaha@himalayacollege.edu.np", "kamleshlaha@gmail.com"], // Array of emails
};
const PROCESSED_FILE = path.join(__dirname, "processed.json");

async function fetchPDFs() {
  const browser = await puppeteer.launch({
    headless: true, // Run in headless mode (without opening a visible browser window)
    args: ["--no-sandbox", "--disable-setuid-sandbox"], // Disable the sandbox for environments like GitHub Actions
  });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "networkidle2" });

  const pdfLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href$=".pdf"]')).map(
      (link) => ({
        text: link.textContent.trim(),
        href: link.href,
      })
    );
  });

  await browser.close();
  return pdfLinks;
}

async function loadProcessed() {
  if (!fs.existsSync(PROCESSED_FILE)) {
    console.error(
      `Error: "${PROCESSED_FILE}" does not exist. Please create an empty "processed.json" file.`
    );
    process.exit(1);
  }

  try {
    const data = JSON.parse(fs.readFileSync(PROCESSED_FILE, "utf-8"));
    if (!Array.isArray(data)) {
      throw new Error("Invalid file format.");
    }
    return data;
  } catch (err) {
    console.error(`Error reading "${PROCESSED_FILE}":`, err.message);
    process.exit(1);
  }
}

async function saveProcessed(processed) {
  fs.writeFileSync(PROCESSED_FILE, JSON.stringify(processed, null, 2));
}

async function sendEmail(newPDFs) {
  const transporter = nodemailer.createTransport({
    service: EMAIL.service,
    auth: {
      user: EMAIL.user,
      pass: EMAIL.pass,
    },
  });

  const emailBody = newPDFs
    .map((pdf) => `<p><a href="${pdf.href}">${pdf.text}</a></p>`)
    .join("");

  const mailOptions = {
    from: `"Notifier Bot" <${EMAIL.user}>`,
    to: EMAIL.recipients.join(","),
    subject: "New PDFs Found on the Website",
    html: `<h3>New PDFs Found:</h3>${emailBody}`,
  };

  await transporter.sendMail(mailOptions);
  console.log("Email sent successfully!");
}

async function main() {
  const newPDFs = await fetchPDFs();
  const processedPDFs = await loadProcessed();

  // Find PDFs that haven't been processed yet
  const unprocessedPDFs = newPDFs.filter(
    (pdf) => !processedPDFs.some((p) => p.href === pdf.href)
  );

  if (unprocessedPDFs.length > 0) {
    console.log("New PDFs found. Sending email...");
    await sendEmail(unprocessedPDFs);

    // Update processed list
    const updatedProcessedList = [...processedPDFs, ...unprocessedPDFs];
    await saveProcessed(updatedProcessedList);
  } else {
    console.log("No new PDFs found.");
  }
}

// Run the script
main().catch((err) => {
  console.error("An error occurred:", err);
});
