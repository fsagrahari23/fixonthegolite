const nodemailer = require('nodemailer');

exports.generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

exports.sendOtp = async (email, otp) => {
  // Create transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Send mail
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP is ${otp}`,
  });
};
