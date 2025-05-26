const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;
const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || 'https://api-m.paypal.com'; // or sandbox: https://api-m.sandbox.paypal.com

app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf.toString(); } }));

app.post('/webhook', async (req, res) => {
  try {
    console.log('🔔 Received webhook from PayPal');

    // Extract headers
    const transmissionId = req.headers['paypal-transmission-id'];
    const transmissionTime = req.headers['paypal-transmission-time'];
    const certUrl = req.headers['paypal-cert-url'];
    const authAlgo = req.headers['paypal-auth-algo'];
    const transmissionSig = req.headers['paypal-transmission-sig'];

    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
      console.error('❌ Missing PayPal headers');
      return res.status(400).send('Missing headers');
    }

    // Get an access token from PayPal
    const token = await getPayPalAccessToken();

    // Call PayPal’s API to verify webhook signature
    const verifyResponse = await axios.post(
      `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
      {
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: transmissionSig,
        webhook_id: PAYPAL_WEBHOOK_ID,
        webhook_event: req.body
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const verificationStatus = verifyResponse.data.verification_status;
    console.log('🔐 Verification status:', verificationStatus);

    if (verificationStatus !== 'SUCCESS') {
      console.error('❌ Signature verification failed');
      return res.status(400).send('Invalid signature');
    }

    console.log('✅ Verified webhook event:', req.body);
    res.status(200).send('Webhook verified');
  } catch (err) {
    console.error('❌ Error:', err?.response?.data || err.message);
    res.status(500).send('Error verifying webhook');
  }
});

async function getPayPalAccessToken() {
  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const response = await axios.post(
    `${PAYPAL_API_BASE}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
  return response.data.access_token;
}

app.listen(port, () => {
  console.log(`🚀 Listening on http://localhost:${port}`);
});
