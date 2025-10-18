// utils/email.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER, // your Gmail
    pass: process.env.MAIL_PASS  // app password
  }
});

const sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: `"Recharja" <${process.env.MAIL_USER}>`,
      to,
      subject,
      html
    });
    return true;
  } catch (err) {
    console.error('Email send error:', err);
    return false;
  }
};

module.exports = sendEmail;
