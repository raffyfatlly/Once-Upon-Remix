import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";
import { db } from "./firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";

export const app = express();

async function startServer() {
  const PORT = 3000;

  app.use(express.json());

  // ---------------------------------------------------------------------------
  // SHORT LINK SERVER-SIDE REDIRECT HANDLER (/l/:shortCode)
  // Performs a 302 HTTP redirect to the full tagged destination URL.
  // Merges any incoming query parameters with the destination's query parameters.
  // ---------------------------------------------------------------------------
  app.get(/^\/l\/(.+)/, async (req, res) => {
    try {
      const fullShortCode = (req.params[0] || '').replace(/^\/|\/$/g, '').trim();

      if (!fullShortCode) {
        return res.redirect(302, 'https://onceuponmy.com/');
      }

      let destinationUrl = '';

      // 1. Lookup shortCode in Firestore tracked_links
      if (db) {
        try {
          const q = query(
            collection(db, 'tracked_links'),
            where('shortCode', '==', fullShortCode),
            limit(1)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = snap.docs[0].data();
            destinationUrl = data.originalUrl || '';
          } else {
            // Check by campaign
            const q2 = query(
              collection(db, 'tracked_links'),
              where('campaign', '==', fullShortCode),
              limit(1)
            );
            const snap2 = await getDocs(q2);
            if (!snap2.empty) {
              const data = snap2.docs[0].data();
              destinationUrl = data.originalUrl || '';
            }
          }
        } catch (dbErr) {
          console.warn('Firestore shortlink query error in server:', dbErr);
        }
      }

      // 2. Dynamic resolution fallback if not in database
      if (!destinationUrl) {
        const lowerCode = fullShortCode.toLowerCase();
        const parts = lowerCode.split('-');
        const lastPart = parts[parts.length - 1];
        const isChannel = ['ig', 'tt', 'th', 'instagram', 'tiktok', 'threads'].includes(lastPart);

        const ref = (req.get('referrer') || req.get('referer') || '').toLowerCase();
        let platform = '';
        if (ref.includes('tiktok') || ref.includes('vt.tiktok') || ref.includes('vm.tiktok')) platform = 'tiktok';
        else if (ref.includes('instagram') || ref.includes('l.instagram')) platform = 'instagram';
        else if (ref.includes('threads')) platform = 'threads';
        else if (ref.includes('facebook') || ref.includes('fb.me')) platform = 'facebook';
        else if (ref.includes('youtube') || ref.includes('youtu.be')) platform = 'youtube';

        if (!platform) {
          if (isChannel) {
            platform = (lastPart === 'ig' || lastPart === 'instagram') ? 'instagram' : (lastPart === 'tt' || lastPart === 'tiktok') ? 'tiktok' : 'threads';
          } else {
            platform = 'instagram';
          }
        }

        let ambHandle = parts[0].replace(/^amb[-_]?/i, '');
        if (!ambHandle) ambHandle = lowerCode.replace(/^amb[-_]?/i, '');

        const campaignCode = `amb-${ambHandle}`;
        destinationUrl = `https://onceuponmy.com/?utm_source=ambassador&utm_medium=${platform}&utm_campaign=${campaignCode}`;
      }

      // Determine base host domain to construct full target URL
      let baseDomain = 'https://onceuponmy.com';
      const hostHeader = req.get('host') || '';
      if (hostHeader.includes('localhost') || hostHeader.includes('run.app') || hostHeader.includes('127.0.0.1')) {
        baseDomain = `${req.protocol}://${hostHeader}`;
      }

      // Parse destinationUrl into URL object
      let targetUrlObj: URL;
      try {
        targetUrlObj = new URL(destinationUrl, baseDomain);
      } catch (e) {
        targetUrlObj = new URL(`https://onceuponmy.com/?utm_source=ambassador&utm_campaign=amb-${fullShortCode}`);
      }

      // 3. MERGE QUERY PARAMETERS from incoming request
      if (req.query) {
        for (const [key, val] of Object.entries(req.query)) {
          if (val !== undefined && val !== null) {
            if (Array.isArray(val)) {
              val.forEach(v => targetUrlObj.searchParams.append(key, String(v)));
            } else {
              targetUrlObj.searchParams.set(key, String(val));
            }
          }
        }
      }

      const finalRedirectUrl = targetUrlObj.toString();
      console.log(`[HTTP 302 Redirect] /l/${fullShortCode} -> ${finalRedirectUrl}`);

      return res.redirect(302, finalRedirectUrl);
    } catch (err) {
      console.error('Server shortlink redirect error:', err);
      return res.redirect(302, 'https://onceuponmy.com/');
    }
  });

  // Check if API key is provided
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;

  // Initialize Gemini client
  let ai: GoogleGenAI | null = null;
  if (hasGeminiKey) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }

  // CHIP Payment Gateway Status Check Endpoint
  app.get("/api/chip/status", (req, res) => {
    const apiKey = (process.env.CHIP_API || process.env.CHIP_SECRET || process.env.CHIP_KEY || process.env.VITE_CHIP_API || '').trim().replace(/^["']|["']$/g, '');
    const brandId = (process.env.CHIP_ID || process.env.CHIP_BRAND_ID || process.env.VITE_CHIP_ID || '').trim().replace(/^["']|["']$/g, '');
    return res.json({
      configured: Boolean(apiKey && brandId),
      hasApiKey: Boolean(apiKey),
      hasBrandId: Boolean(brandId),
      brandIdPreview: brandId ? `${brandId.substring(0, 4)}...${brandId.substring(Math.max(0, brandId.length - 4))}` : null
    });
  });

  // CHIP Payment Gateway Proxy Endpoint
  app.post("/api/chip/purchases/", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const clientApiKey = authHeader && authHeader.replace(/^Bearer\s+/i, '') !== 'undefined' && authHeader.replace(/^Bearer\s+/i, '') !== 'CHIP_API' ? authHeader.replace(/^Bearer\s+/i, '') : '';
      
      const apiKey = (process.env.CHIP_API || process.env.CHIP_SECRET || process.env.CHIP_KEY || process.env.VITE_CHIP_API || clientApiKey || '').trim().replace(/^["']|["']$/g, '');
      const clientBrandId = req.body.brand_id && req.body.brand_id !== 'CHIP_BRAND_ID' && req.body.brand_id !== 'CHIP_ID' ? req.body.brand_id : '';
      const envBrandId = (process.env.CHIP_ID || process.env.CHIP_BRAND_ID || process.env.VITE_CHIP_ID || process.env.VITE_CHIP_BRAND_ID || '').trim().replace(/^["']|["']$/g, '');
      const brandId = envBrandId || clientBrandId || 'a8861126-311a-465d-a7c2-1d5b43c05e7f';

      if (!apiKey) {
        return res.status(400).json({ 
          message: "CHIP Payment Gateway API key is missing. Please ensure CHIP_API and CHIP_ID are configured in Settings > Secrets." 
        });
      }

      if (!brandId) {
        return res.status(400).json({ 
          message: "CHIP Brand ID is missing. Please ensure CHIP_ID and CHIP_API are configured in Settings > Secrets." 
        });
      }

      // Format client phone number for CHIP API standards (E.164 format)
      const clientObj = req.body.client || {};
      let rawPhone = (clientObj.phone || '').toString().trim().replace(/[^0-9+]/g, '');
      if (rawPhone && !rawPhone.startsWith('+')) {
        if (rawPhone.startsWith('60')) {
          rawPhone = '+' + rawPhone;
        } else if (rawPhone.startsWith('0')) {
          rawPhone = '+60' + rawPhone.substring(1);
        } else {
          rawPhone = '+60' + rawPhone;
        }
      }
      if (!rawPhone || rawPhone.length < 8) {
        rawPhone = '+60120000000';
      }

      // Format products array to ensure price is integer in cents
      const rawPurchase = req.body.purchase || {};
      const rawProducts = Array.isArray(rawPurchase.products) ? rawPurchase.products : [];
      const formattedProducts = rawProducts.map((p: any) => ({
        name: String(p.name || 'Item').substring(0, 256),
        quantity: Math.max(1, parseInt(p.quantity, 10) || 1),
        price: Math.round(Number(p.price) || 0)
      }));

      const requestBody = {
        brand_id: brandId,
        client: {
          email: (clientObj.email || 'customer@example.com').trim(),
          phone: rawPhone,
          full_name: (clientObj.full_name || 'Customer').trim().substring(0, 30),
        },
        purchase: {
          currency: rawPurchase.currency || 'MYR',
          products: formattedProducts
        },
        reference: (req.body.reference || `ORDER-${Date.now()}`).toString(),
        success_redirect: req.body.success_redirect,
        failure_redirect: req.body.failure_redirect,
        cancel_redirect: req.body.cancel_redirect,
        ...(req.body.force_redirect !== undefined ? { force_redirect: req.body.force_redirect } : { force_redirect: true })
      };

      console.log("Connecting to CHIP Gateway with Brand ID:", brandId, "Reference:", requestBody.reference);

      const chipResponse = await fetch("https://gate.chip-in.asia/api/v1/purchases/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      let responseData: any = {};
      const responseText = await chipResponse.text();
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.error("Non-JSON response from CHIP Gateway:", responseText);
        return res.status(chipResponse.status).json({
          message: `CHIP Gateway Error (${chipResponse.status}): ${responseText.substring(0, 200)}`
        });
      }

      if (!chipResponse.ok) {
        console.error("CHIP Gateway API error:", chipResponse.status, responseData);
        let errorMsg = responseData.message || responseData.error || responseData.detail;
        if (!errorMsg && responseData.errors) {
          if (typeof responseData.errors === 'string') {
            errorMsg = responseData.errors;
          } else if (typeof responseData.errors === 'object') {
            errorMsg = Object.entries(responseData.errors)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : v}`)
              .join('; ');
          }
        }
        return res.status(chipResponse.status).json({
          ...responseData,
          message: errorMsg || `CHIP Gateway Error (${chipResponse.status}): ${JSON.stringify(responseData)}`
        });
      }

      // Check if CHIP immediately cancelled the purchase due to missing merchant terminals
      if (responseData.status === 'cancelled' || responseData.status === 'failed') {
        const attemptErr = responseData.transaction_data?.attempts?.[0]?.error;
        const errCode = attemptErr?.code || 'purchase_cancelled';
        const errDetail = attemptErr?.message || 'No matching terminal';
        
        console.warn("CHIP purchase returned cancelled status:", errCode, errDetail);
        
        return res.status(400).json({
          ...responseData,
          success: false,
          error_code: errCode,
          message: errCode === 'no_matching_terminal'
            ? `CHIP Terminal Missing: Your CHIP Brand ID (${brandId}) does not have active Payment Terminals (FPX / Visa / Mastercard) configured in your CHIP Merchant Portal at gate.chip-in.asia.`
            : `CHIP Payment Failed (${errCode}): ${errDetail}`
        });
      }

      return res.json(responseData);
    } catch (err: any) {
      console.error("Server proxy error calling CHIP gateway:", err);
      return res.status(500).json({ message: err.message || "Failed to connect to CHIP payment gateway." });
    }
  });

  // API endpoints
  app.post("/api/analytics/expert", async (req, res) => {
    if (!ai) {
      return res.status(500).json({ error: "Gemini API key is missing or invalid. Please check Settings > Secrets." });
    }

    try {
      const { data, type, period } = req.body;
      
      const prompt = `As an expert business analyst, please analyze the following sales data for a premium store. The data shows ${type === 'daily' ? 'daily' : 'monthly'} sales trends for the period: ${period}. It also includes the top products sold in each time grouping.

Data payload:
${JSON.stringify(data.slice(-30), null, 2)}

Please provide a concise, smart analysis of the overall sales trend focusing on:
1. Identifying peaks or slow periods (e.g. slow mid-month, specific high-performing weeks, etc.)
2. Any notable anomalies or consistencies and actionable insights.
3. Observations about which products are performing best during these trends month-by-month (or day-by-day) and overall.

Format your response in Markdown with clear headings and bullet points.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          temperature: 0.7,
        }
      });

      res.json({ analysis: response.text });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message || "Failed to run analysis." });
    }
  });

  // API endpoint to send emails (receipts)
  app.post("/api/send-email", async (req, res) => {
    try {
      const { to, subject, html } = req.body;
      
      if (!to || !subject || !html) {
        return res.status(400).json({ error: "Missing required fields: to, subject, and html are required." });
      }

      const host = process.env.SMTP_HOST;
      const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      const from = process.env.SMTP_FROM || user || '"Once Upon" <noreply@onceupon.com>';

      if (!host || !user || !pass) {
        return res.status(400).json({ 
          error: "SMTP credentials are missing. Please configure SMTP_HOST, SMTP_USER, and SMTP_PASS in Settings > Secrets to enable real email sending." 
        });
      }

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
      });

      const mailOptions = {
        from,
        to,
        subject,
        html,
      };

      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: "Email sent successfully!" });
    } catch (error: any) {
      console.error("Failed to send email:", error);
      res.status(500).json({ error: error.message || "Failed to send email." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

export default app;
