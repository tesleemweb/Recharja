// utils/email.js

// ============================================
// SENDGRID (CURRENT - Works on Render)
// ============================================
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async ({ to, subject, html }) => {
  try {
    await sgMail.send({
      to,
      from: `"Recharja" <${process.env.SENDGRID_MAIL_USER}>`,
      subject,
      html
    });
    console.log('✅ Email sent successfully');
    return true;
  } catch (err) {
    console.error('❌ Email send error:', err.message);
    if (err.response) {
      console.error('Error details:', err.response.body);
    }
    return false;
  }
};

module.exports = sendEmail;


// ============================================
// NODEMAILER + GMAIL (OLD - Commented out)
// ============================================
// const nodemailer = require('nodemailer');
//
// const transporter = nodemailer.createTransport({
//   host: 'smtp.gmail.com',
//   port: 465,
//   secure: true,
//   auth: {
//     user: process.env.MAIL_USER,
//     pass: process.env.MAIL_PASS
//   },
//   socketTimeout: 15000
// });
//
// const sendEmail = async ({ to, subject, html }) => {
//   try {
//     const info = await transporter.sendMail({
//       from: `"Recharja" <${process.env.MAIL_USER}>`,
//       to,
//       subject,
//       html
//     });
//     console.log('✅ Email sent:', info.messageId);
//     return true;
//   } catch (err) {
//     console.error('❌ Email send error:', err.message);
//     return false;
//   }
// };
//
// module.exports = sendEmail;
