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
