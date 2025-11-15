import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import {onSchedule} from "firebase-functions/v2/scheduler";

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// --- Nodemailer Configuration ---
// Get email credentials from environment variables
const gmailUser = process.env.GMAIL_USER;
const gmailPass = process.env.GMAIL_PASSWORD;
const notificationRecipient = process.env.NOTIFICATION_RECIPIENT;

// Only create transporter if credentials exist
let transporter: nodemailer.Transporter | null = null;
if (gmailUser && gmailPass) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });
}

/**
 * Sends a notification email to the configured recipient
 * @param {string} subject - Email subject line
 * @param {string} htmlBody - HTML email body content
 * @return {Promise<void>}
 */
async function sendNotificationEmail(
  subject: string,
  htmlBody: string
): Promise<void> {
  if (!transporter) {
    functions.logger.warn(
      "Email transporter not configured. Skipping email notification."
    );
    return;
  }

  if (!notificationRecipient) {
    functions.logger.warn(
      "Notification recipient not configured. Skipping email."
    );
    return;
  }

  const mailOptions = {
    from: `"Lab Inventory" <${gmailUser}>`,
    to: notificationRecipient,
    subject: subject,
    html: htmlBody,
  };

  try {
    await transporter.sendMail(mailOptions);
    functions.logger.info(`Notification email sent: ${subject}`);
  } catch (error) {
    functions.logger.error("Error sending email:", error);
  }
}

/**
 * Daily scheduled function to check inventory for low stock and
 * expiring items, sending email notifications when thresholds are met
 */
export const checkInventoryAndNotify = onSchedule(
  {
    schedule: "0 */6 * * *",
    timeZone: "Asia/Riyadh",
  },
  async () => {
    functions.logger.info("Running daily inventory check...");

    const now = new Date();
    // Set the warning period for expiration (e.g., 30 days from now)
    const expirationWarningDate = new Date();
    expirationWarningDate.setDate(now.getDate() + 7);

    const inventoryRef = db.collection("inventory");
    const itemsToUpdate: Promise<FirebaseFirestore.WriteResult>[] = [];

    // 1. Check for Low Stock
    const lowStockQuery = inventoryRef
      .where("lowStockNotified", "==", false);

    const lowStockSnapshot = await lowStockQuery.get();
    lowStockSnapshot.forEach((doc) => {
      const item = doc.data();
      // Ensure quantity and minStock exist before comparing
      if (item.quantity <= (item.minStock ?? 5)) {
        functions.logger.log(`Low stock detected for: ${item.name}`);
        const subject = `Low Stock Alert: ${item.name}`;
        const body = `<p>The stock for <strong>${item.name}</strong>
          (Lot: ${item.lotNumber || "N/A"}) is low.</p>
          <p>Current Quantity: <strong>${item.quantity}</strong></p>
          <p>Minimum Stock Level: ${item.minStock ?? 5}</p>`;

        sendNotificationEmail(subject, body);
        // Mark for update to prevent re-notifying
        itemsToUpdate.push(
          doc.ref.update({lowStockNotified: true})
        );
      }
    });

    // 2. Check for Expiring Items
    const expiringQuery = inventoryRef
      .where("expiryWarningNotified", "==", false)
      .where(
        "expiryDate",
        "<=",
        admin.firestore.Timestamp.fromDate(expirationWarningDate)
      );

    const expiringSnapshot = await expiringQuery.get();
    expiringSnapshot.forEach((doc) => {
      const item = doc.data();
      functions.logger.log(`Expiration warning for: ${item.name}`);
      const subject = `Expiration Alert: ${item.name}`;
      const expiryDateStr = item.expiryDate.toDate()
        .toLocaleDateString();
      const body = `<p>The item <strong>${item.name}</strong>
        (Lot: ${item.lotNumber || "N/A"}) is expiring soon.</p>
        <p>Expiration Date: <strong>${expiryDateStr}</strong></p>
        <p>Current Quantity: ${item.quantity}</p>`;

      sendNotificationEmail(subject, body);
      // Mark for update to prevent re-notifying
      itemsToUpdate.push(
        doc.ref.update({expiryWarningNotified: true})
      );
    });

    // Wait for all database updates to complete
    await Promise.all(itemsToUpdate);

    const processedCount = itemsToUpdate.length;
    functions.logger.info(
      `Inventory check complete. ${processedCount} items processed.`
    );
  }
);
