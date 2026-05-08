const express    = require('express');
const nodemailer = require('nodemailer');

const router = express.Router();

// ── Crează transporter Nodemailer ──
function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: { rejectUnauthorized: false },
  });
}

// ── POST /api/orders ──
router.post('/', async (req, res) => {
  const {
    orderId, orderDate,
    customerName, customerPhone, customerEmail,
    customerCity, customerAddress, customerNotes,
    items, subtotal, deliveryCost, total,
  } = req.body;

  if (!customerName || !customerPhone || !customerCity || !customerAddress || !items?.length)
    return res.status(400).json({ error: 'Date incomplete' });

  const orderEmail = process.env.ORDER_EMAIL || 'nicolae.grincu@mail.ru';

  // ── HTML Email ──
  const itemsRows = items.map(i => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0e8e0">
        <img src="${i.img}" width="50" style="border-radius:6px;vertical-align:middle;margin-right:8px" alt="">
        ${i.title}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0e8e0;text-align:center">${i.qty}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0e8e0;text-align:right;font-weight:bold">${i.price * i.qty} MDL</td>
    </tr>`).join('');

  const deliveryStr = deliveryCost === 0 ? '✓ Gratuit' :
                      deliveryCost === null ? 'Contra-cost (poștă/curier)' :
                      deliveryCost + ' MDL';

  const htmlBody = `
<!DOCTYPE html>
<html lang="ro">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4efe9;font-family:Arial,sans-serif">
<div style="max-width:620px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">

  <div style="background:linear-gradient(135deg,#3d2b24,#8b6355);padding:32px 36px;text-align:center">
    <h1 style="margin:0;color:#fff;font-size:24px;font-weight:300;letter-spacing:1px">
      🌸 Comandă Nouă
    </h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,.75);font-size:14px">
      Nr. <strong style="color:#c9a97a">${orderId}</strong> &nbsp;|&nbsp; ${orderDate}
    </p>
  </div>

  <div style="padding:28px 36px">

    <h2 style="margin:0 0 16px;color:#6b4a3c;font-size:16px;border-bottom:2px solid #f0e8e0;padding-bottom:8px">
      📋 Date Client
    </h2>
    <table style="width:100%;font-size:14px;color:#2c2422">
      <tr><td style="padding:5px 0;color:#8a7b75;width:130px">Nume</td><td style="font-weight:bold">${customerName}</td></tr>
      <tr><td style="padding:5px 0;color:#8a7b75">Telefon</td><td style="font-weight:bold"><a href="tel:${customerPhone}" style="color:#8b6355">${customerPhone}</a></td></tr>
      <tr><td style="padding:5px 0;color:#8a7b75">Email</td><td>${customerEmail || '—'}</td></tr>
      <tr><td style="padding:5px 0;color:#8a7b75">Localitate</td><td>${customerCity}</td></tr>
      <tr><td style="padding:5px 0;color:#8a7b75">Adresă</td><td>${customerAddress}</td></tr>
      <tr><td style="padding:5px 0;color:#8a7b75">Note</td><td>${customerNotes || '—'}</td></tr>
    </table>

    <h2 style="margin:24px 0 12px;color:#6b4a3c;font-size:16px;border-bottom:2px solid #f0e8e0;padding-bottom:8px">
      🛍️ Produse Comandate
    </h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead>
        <tr style="background:#fdfaf6">
          <th style="padding:8px 12px;text-align:left;color:#8a7b75;font-size:11px;text-transform:uppercase;letter-spacing:.06em">Produs</th>
          <th style="padding:8px 12px;text-align:center;color:#8a7b75;font-size:11px;text-transform:uppercase">Cant.</th>
          <th style="padding:8px 12px;text-align:right;color:#8a7b75;font-size:11px;text-transform:uppercase">Preț</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>

    <div style="margin-top:16px;background:#fdfaf6;border-radius:8px;padding:16px 20px;font-size:14px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;color:#8a7b75">
        <span>Subtotal</span><span>${subtotal} MDL</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:10px;color:#8a7b75">
        <span>Livrare</span><span>${deliveryStr}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:17px;font-weight:bold;color:#6b4a3c;border-top:1px solid #e5d9cf;padding-top:10px">
        <span>TOTAL DE PLATĂ</span><span>${total}</span>
      </div>
    </div>

    <div style="margin-top:20px;background:#f5ead8;border:1px solid #c9a97a;border-radius:8px;padding:14px 20px;font-size:14px;color:#6b4a3c;text-align:center">
      💳 Metodă de plată: <strong>Ramburs la livrare</strong>
    </div>

  </div>

  <div style="background:#2c2422;padding:18px 36px;text-align:center;color:rgba(255,255,255,.5);font-size:12px">
    Accesorii Nuntă – Chișinău &nbsp;|&nbsp; +373 69 488 656
  </div>
</div>
</body>
</html>`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from:    `"Accesorii Nuntă" <${process.env.EMAIL_USER}>`,
      to:      orderEmail,
      replyTo: customerEmail || undefined,
      subject: `🌸 Comandă nouă #${orderId} – ${customerName}`,
      html:    htmlBody,
    });
    res.json({ ok: true, orderId });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: 'Eroare la trimiterea emailului', details: err.message });
  }
});

module.exports = router;
