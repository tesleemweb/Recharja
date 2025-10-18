const Otp = require('../models/Otp');
const nodemailer = require('nodemailer');

exports.sendOtp = async (req, res) => {
  const { email } = req.body;

  try {
    const code = Math.floor(100000 + Math.random() * 900000); // 6-digit
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await Otp.findOneAndUpdate(
      { email },
      { code, expiresAt },
      { upsert: true }
    );

    // 🔐 Send mail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER, // from .env
        pass: process.env.MAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP is ${code}. It expires in 10 minutes.`
    });

    res.json({ success: true, message: 'OTP sent to email' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Could not send OTP' });
  }
};
