// backend/services/sms.js
// Africa's Talking SMS API integration
// Docs: https://developers.africastalking.com/docs/sms/sending

const AfricasTalking = require("africastalking");

const client = AfricasTalking({
  apiKey:   process.env.AT_API_KEY   || "sandbox",   // replace with real key in production
  username: process.env.AT_USERNAME  || "sandbox"
});

const sms = client.SMS;

/**
 * Send a single SMS notification.
 * @param {string} phone   - Recipient phone number e.g. "+254712345678"
 * @param {string} message - SMS body text
 */
async function send(phone, message) {
  if (!phone) return null;
  try {
    const result = await sms.send({
      to:      [phone],
      message,
      from:    "LandChain"    // registered short code / sender ID
    });
    console.log("SMS sent:", result);
    return result;
  } catch (err) {
    // SMS failure should never crash the main flow
    console.error("SMS error:", err.message);
    return null;
  }
}

/**
 * Send OTP for 2FA login.
 * @param {string} phone - Recipient phone number
 * @returns {string}     - The generated OTP (save to Redis/DB temporarily)
 */
async function sendOTP(phone) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
  await send(phone, `LandChain OTP: ${otp}. Valid for 10 minutes. Do not share this code.`);
  return otp;
}

/**
 * Send ownership alert when someone attempts to transfer a parcel.
 */
async function sendTransferAlert(phone, parcelId, initiatorName) {
  await send(
    phone,
    `LANDCHAIN ALERT: A transfer of your land parcel ${parcelId} ` +
    `has been initiated by ${initiatorName}. ` +
    `If this was not you, contact support immediately at support@landchain.io`
  );
}

/**
 * Send dispute notification.
 */
async function sendDisputeAlert(phone, parcelId, disputeId) {
  await send(
    phone,
    `LandChain: A dispute (ID: ${disputeId}) has been filed against ` +
    `your land parcel ${parcelId}. Log in to respond with evidence within 7 days.`
  );
}

/**
 * Send loan status notification.
 */
async function sendLoanAlert(phone, loanId, message) {
  await send(phone, `LandChain Loan #${loanId}: ${message}`);
}

module.exports = { send, sendOTP, sendTransferAlert, sendDisputeAlert, sendLoanAlert };
