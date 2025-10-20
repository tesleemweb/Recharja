const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html }) => {
  try {
    await resend.emails.send({
      from: 'Recharja <onboarding@resend.dev>',
      to,
      subject,
      html,
    });
    console.log('✅ Email sent via Resend');
    return true;
  } catch (err) {
    console.error('❌ Resend send error:', err);
    return false;
  }
};

module.exports = sendEmail;

