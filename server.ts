import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";
import { db } from "./firebase";
import { collection, query, where, getDocs, limit, doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";

export const DEFAULT_CHIP_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAx4pspTG+p6wBuVxnYUXT
a3rEfa2fq3sTf1lPfNciE9ZYlZgyzaLWhJ2afsYH/q7U6JZ/KYgjOwtGhl9TMtdU
yFOAMvwfaPS8I2KYFhXP8eoeM7Wb0RmKIZGQHa37kZX2YMD8PnUIOPrBaKo9yNHB
GaOGxTbkB2svvh6Kvte8EJcXY4AuO9S1NapTP+JwKZ4cyWJPtKvwNIxEnH6GszsT
KKQG8GqGBfNKqAZeZ3svct2fIS1MxrmNJiVnWkheoE2StTOmm2q0Rx3IMczmO3jF
flec6TUu+eVlk+fsfIhxwkizkdR+eZmbLGbC7VeYFrUQq5Wj9ZWHrRI/kEbCjo25
ntPwHJYsyqRmVsh3mfhP+lDo0McdJ2EGDVubVJ4ObY4oS7SQB7h9TP24gnqF9bEJ
c2DQt5IDq9gikqtb4FKoI2zzeO7ElF4NHsXilww5N7mak5k7zENUudytIp5/jWGz
dDziUycgJOaBuwgOrXdCzNRV5pc5KskSaCdTtd2JhWVZAgMBAAE=
-----END PUBLIC KEY-----`;

export const app = express();

const PORT = 3000;

app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));
app.use(express.urlencoded({
  extended: true,
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

// ---------------------------------------------------------------------------
// CAKENIC CLEAN URL SERVER-SIDE REDIRECT HANDLER (/cakenic, /cakenic-event)
  // Performs a 302 HTTP redirect from clean path /cakenic to hash route /#/cakenic
  // for Instagram bio links and direct browser access.
  // ---------------------------------------------------------------------------
  app.get(['/cakenic', '/cakenic/*splat', '/cakenic-event', '/cakenic-event/*splat'], (req, res) => {
    const originalUrl = req.originalUrl || req.url;
    const queryIndex = originalUrl.indexOf('?');
    const pathPart = queryIndex !== -1 ? originalUrl.substring(0, queryIndex) : originalUrl;
    const queryPart = queryIndex !== -1 ? originalUrl.substring(queryIndex) : '';

    let cleanPath = pathPart.replace(/\/+$/, '');
    if (!cleanPath) cleanPath = '/cakenic';

    console.log(`[HTTP 302 Redirect] ${originalUrl} -> /#${cleanPath}${queryPart}`);
    return res.redirect(302, `/#${cleanPath}${queryPart}`);
  });

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
    const publicKey = (process.env.CHIP_PUBLIC_KEY || DEFAULT_CHIP_PUBLIC_KEY || '').trim();
    return res.json({
      configured: Boolean(apiKey && brandId),
      hasApiKey: Boolean(apiKey),
      hasBrandId: Boolean(brandId),
      hasPublicKey: Boolean(publicKey),
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

      // Determine the callback URL for server-to-server notifications from CHIP
      const host = req.get('host') || '';
      let callbackHost = 'https://onceuponmy.com';
      if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
        const proto = req.protocol === 'http' && !host.includes('run.app') ? 'https' : req.protocol;
        callbackHost = `${proto}://${host}`;
      }
      const successCallbackUrl = req.body.success_callback || `${callbackHost}/api/chip/callback`;

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
        success_callback: successCallbackUrl,
        success_redirect: req.body.success_redirect,
        failure_redirect: req.body.failure_redirect,
        cancel_redirect: req.body.cancel_redirect,
        ...(req.body.force_redirect !== undefined ? { force_redirect: req.body.force_redirect } : { force_redirect: true })
      };

      console.log("Connecting to CHIP Gateway with Brand ID:", brandId, "Reference:", requestBody.reference, "Callback:", successCallbackUrl);

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

      // Record chip_purchase_id on Firestore order document immediately
      if (responseData.id && requestBody.reference && db) {
        try {
          const cleanRef = requestBody.reference.toString().replace(/^#/, '').trim();
          const orderDocRef = doc(db, 'orders', cleanRef);
          await updateDoc(orderDocRef, {
            chip_purchase_id: responseData.id,
            chip_checkout_url: responseData.checkout_url || '',
            chip_brand_id: brandId,
            chip_created_at: new Date().toISOString()
          });
          console.log(`[CHIP] Linked purchase ID ${responseData.id} to Order #${cleanRef}`);
        } catch (dbLinkErr) {
          console.warn(`[CHIP] Could not immediately attach chip_purchase_id to order #${requestBody.reference}:`, dbLinkErr);
        }
      }

      return res.json(responseData);
    } catch (err: any) {
      console.error("Server proxy error calling CHIP gateway:", err);
      return res.status(500).json({ message: err.message || "Failed to connect to CHIP payment gateway." });
    }
  });

  // ---------------------------------------------------------------------------
  // CHIP SERVER-TO-SERVER WEBHOOK & SUCCESS CALLBACK HANDLER
  // Direct asynchronous delivery from gate.chip-in.asia when payment succeeds
  // ---------------------------------------------------------------------------
  app.all(["/api/chip/callback", "/api/chip/webhook", "/api/chip/ipn", "/api/chip/notify"], async (req, res) => {
    // Respond immediately to GET / HEAD requests for webhook URL validation / health check
    if (req.method === 'GET' || req.method === 'HEAD') {
      return res.status(200).json({ status: "ok", message: "CHIP Webhook Endpoint is active and listening" });
    }

    try {
      const rawBody = req.body || {};
      const payload = rawBody.data || rawBody.purchase || rawBody.payload || rawBody;
      
      console.log("[CHIP Webhook] Received callback notification:", JSON.stringify({
        id: payload.id,
        status: payload.status,
        event_type: payload.event_type,
        reference: payload.reference,
        is_paid: payload.is_paid
      }));

      const purchaseId = payload.id || rawBody.id;
      const rawReference = (payload.reference || rawBody.reference || payload.client_reference || '').toString().trim();
      const status = (payload.status || rawBody.status || '').toLowerCase();
      const eventType = (payload.event_type || rawBody.event_type || '').toLowerCase();
      
      // Optional cryptographic RSA signature check with CHIP Public Key
      const signatureHeader = req.get('x-signature') || req.get('http_x_signature') || req.get('X-Signature');
      const publicKey = (process.env.CHIP_PUBLIC_KEY || DEFAULT_CHIP_PUBLIC_KEY || '').trim();
      if (signatureHeader && publicKey && (req as any).rawBody) {
        try {
          const isSignatureValid = crypto.verify(
            'RSA-SHA256',
            Buffer.from((req as any).rawBody, 'utf8'),
            publicKey,
            Buffer.from(signatureHeader, 'base64')
          );
          console.log(`[CHIP Webhook] RSA Signature verification: ${isSignatureValid ? 'PASSED (Authentic CHIP)' : 'MISMATCH'}`);
        } catch (sigErr: any) {
          console.warn(`[CHIP Webhook] Signature validation note: ${sigErr.message}`);
        }
      }
      
      const isPaid = 
        status === 'paid' || 
        status === 'cleared' || 
        status === 'settled' || 
        status === 'completed' || 
        status === 'success' ||
        status === 'authorized' ||
        eventType === 'purchase.paid' || 
        eventType === 'payment.paid' ||
        eventType === 'purchase.settled' ||
        eventType === 'payment.success' ||
        eventType === 'purchase.authorized' ||
        payload.is_paid === true ||
        rawBody.is_paid === true;

      if (!db) {
        console.warn("[CHIP Webhook] Database not initialized.");
        return res.status(200).json({ status: "ok", received: true, note: "db not connected" });
      }

      if (isPaid && (rawReference || purchaseId)) {
        let orderDocRef = null;
        let orderData: any = null;
        const cleanRef = rawReference.replace(/^#/, '').trim();

        // 1. Try finding order by direct reference (doc ID)
        if (cleanRef) {
          const refDoc = doc(db, 'orders', cleanRef);
          const snap = await getDoc(refDoc);
          if (snap.exists()) {
            orderDocRef = refDoc;
            orderData = { id: snap.id, ...snap.data() };
          }
        }

        // 1b. Try finding order with '#' prefix in doc ID
        if (!orderDocRef && cleanRef) {
          const hashDoc = doc(db, 'orders', `#${cleanRef}`);
          const snap = await getDoc(hashDoc);
          if (snap.exists()) {
            orderDocRef = hashDoc;
            orderData = { id: snap.id, ...snap.data() };
          }
        }

        // 2. Try finding order by query (id field)
        if (!orderDocRef && cleanRef) {
          const q = query(collection(db, 'orders'), where('id', '==', cleanRef), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            orderDocRef = snap.docs[0].ref;
            orderData = { id: snap.docs[0].id, ...snap.docs[0].data() };
          }
        }

        // 2b. Try finding order by query with '#' prefix
        if (!orderDocRef && cleanRef) {
          const q = query(collection(db, 'orders'), where('id', '==', `#${cleanRef}`), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            orderDocRef = snap.docs[0].ref;
            orderData = { id: snap.docs[0].id, ...snap.docs[0].data() };
          }
        }

        // 3. Try finding order by chip_purchase_id
        if (!orderDocRef && purchaseId) {
          const q = query(collection(db, 'orders'), where('chip_purchase_id', '==', purchaseId), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            orderDocRef = snap.docs[0].ref;
            orderData = { id: snap.docs[0].id, ...snap.docs[0].data() };
          }
        }

        // 4. Fallback: If not found, fetch purchase details from CHIP to get the exact reference
        if (!orderDocRef && purchaseId) {
          const apiKey = (process.env.CHIP_API || process.env.CHIP_SECRET || process.env.CHIP_KEY || process.env.VITE_CHIP_API || '').trim().replace(/^["']|["']$/g, '');
          if (apiKey) {
            try {
              const chipResp = await fetch(`https://gate.chip-in.asia/api/v1/purchases/${purchaseId}/`, {
                headers: { "Authorization": `Bearer ${apiKey}` }
              });
              if (chipResp.ok) {
                const chipData = await chipResp.json();
                const fetchedRef = (chipData.reference || '').replace(/^#/, '').trim();
                if (fetchedRef) {
                  const refDoc = doc(db, 'orders', fetchedRef);
                  const snap = await getDoc(refDoc);
                  if (snap.exists()) {
                    orderDocRef = refDoc;
                    orderData = { id: snap.id, ...snap.data() };
                  }
                }
              }
            } catch (fallbackErr) {
              console.warn("[CHIP Webhook] Fallback purchase lookup failed:", fallbackErr);
            }
          }
        }

        if (orderDocRef) {
          // If order was mistakenly marked as cancelled or failed, re-deduct stock!
          if (orderData && (orderData.status === 'cancelled' || orderData.status === 'failed') && Array.isArray(orderData.items)) {
            for (const item of orderData.items) {
              let docId = item.baseProductId || item.id;
              if (typeof docId === 'string' && docId.endsWith('-protected')) {
                docId = docId.replace(/-protected$/, '');
              }
              if (docId) {
                try {
                  const prodRef = doc(db, 'products', docId);
                  const prodSnap = await getDoc(prodRef);
                  if (prodSnap.exists()) {
                    const currentStock = prodSnap.data().stock || 0;
                    await updateDoc(prodRef, { stock: Math.max(0, currentStock - (item.quantity || 1)) });
                  }
                } catch (stockErr) {
                  console.warn(`[CHIP Webhook] Could not re-deduct stock for product ${docId}:`, stockErr);
                }
              }
            }
          }

          await updateDoc(orderDocRef, {
            status: 'paid',
            chip_purchase_id: purchaseId || orderData?.chip_purchase_id || '',
            chip_payment_status: status || 'paid',
            chip_paid_at: payload.transaction_data?.paid_at || payload.paid_at || new Date().toISOString(),
            chip_event_type: eventType || 'purchase.paid',
            updatedAt: new Date().toISOString(),
            statusHistory: arrayUnion({
              status: 'paid',
              timestamp: new Date().toISOString(),
              source: 'chip_webhook_callback'
            })
          });
          console.log(`[CHIP Webhook] SUCCESS: Order #${rawReference || purchaseId} marked as PAID in Firestore!`);
        } else {
          console.warn(`[CHIP Webhook] Received paid callback but no order matching reference "${rawReference}" or purchase ID "${purchaseId}" was found in Firestore.`);
        }
      }

      // Always return 200 to acknowledge CHIP webhook delivery
      return res.status(200).json({ status: "ok", received: true, reference: rawReference, purchaseId });
    } catch (err: any) {
      console.error("[CHIP Webhook] Error processing callback:", err);
      return res.status(200).json({ status: "error_logged", error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // CHIP ORDER VERIFICATION & RESCUE HELPER
  // Actively verifies an order against the CHIP Gateway API and rescues it to PAID
  // ---------------------------------------------------------------------------
  const verifyAndRescueSingleOrder = async (orderIdParam: string, apiKey: string): Promise<{ paid: boolean; status: string; rescued?: boolean; order?: any; note?: string; purchaseId?: string }> => {
    const cleanOrderId = (orderIdParam || '').replace(/^#/, '').trim();
    if (!cleanOrderId || !db) {
      return { paid: false, status: 'unknown', note: 'Missing order ID or DB' };
    }

    // 1. Fetch current order from Firestore
    let orderDocRef = doc(db, 'orders', cleanOrderId);
    let orderSnap = await getDoc(orderDocRef);
    let orderData: any = null;

    if (orderSnap.exists()) {
      orderData = { id: orderSnap.id, ...orderSnap.data() };
    } else {
      const hashDoc = doc(db, 'orders', `#${cleanOrderId}`);
      const hashSnap = await getDoc(hashDoc);
      if (hashSnap.exists()) {
        orderDocRef = hashDoc;
        orderData = { id: hashSnap.id, ...hashSnap.data() };
      } else {
        const q = query(collection(db, 'orders'), where('id', '==', cleanOrderId), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          orderDocRef = snap.docs[0].ref;
          orderData = { id: snap.docs[0].id, ...snap.docs[0].data() };
        }
      }
    }

    if (!orderData) {
      return { paid: false, status: 'not_found', note: 'Order not found in database' };
    }

    // If order is already in paid/packed/shipped/delivered, return success
    if (['paid', 'packed', 'shipped', 'delivered'].includes(orderData.status)) {
      return {
        paid: true,
        status: orderData.status,
        order: orderData
      };
    }

    if (!apiKey) {
      return {
        paid: false,
        status: orderData.status,
        order: orderData,
        note: "CHIP_API key not available for live gateway query"
      };
    }

    const checkIsPaidStatus = (p: any) => {
      if (!p) return false;
      const st = (p.status || '').toString().toLowerCase();
      const evt = (p.event_type || '').toString().toLowerCase();
      const paySt = (p.payment?.status || p.transaction_data?.status || '').toString().toLowerCase();
      const isPaidFlag = p.is_paid === true || p.paid === true || p.transaction_data?.is_paid === true;
      return (
        st === 'paid' || st === 'cleared' || st === 'settled' || st === 'completed' || st === 'success' || st === 'authorized' ||
        evt === 'purchase.paid' || evt === 'payment.paid' || evt === 'purchase.settled' || evt === 'purchase.authorized' || evt === 'payment.success' ||
        paySt === 'paid' || paySt === 'success' || paySt === 'cleared' || paySt === 'settled' || paySt === 'authorized' ||
        isPaidFlag
      );
    };

    const isMatchingOrderPurchase = (p: any) => {
      if (!p) return false;
      const pId = p.id ? String(p.id).trim() : '';
      const knownChipId = orderData?.chip_purchase_id ? String(orderData.chip_purchase_id).trim() : '';
      if (knownChipId && pId === knownChipId) return true;

      const rawRef = (p.reference || p.client_reference || p.order_id || '').toString().trim();
      const cleanPRef = rawRef.replace(/^#/, '').trim();
      const targetClean = cleanOrderId.replace(/^#/, '').trim();

      if (cleanPRef && cleanPRef === targetClean) return true;
      if (cleanPRef && (cleanPRef === `ORDER-${targetClean}` || targetClean === `ORDER-${cleanPRef}`)) return true;

      // Email + total fallback comparison
      if (orderData?.customerEmail && p.client?.email) {
        const pEmail = String(p.client.email).trim().toLowerCase();
        const oEmail = String(orderData.customerEmail).trim().toLowerCase();
        if (pEmail === oEmail && p.purchase?.products) {
          const pTotalCents = (p.purchase.products || []).reduce((sum: number, item: any) => sum + (Number(item.price) * Number(item.quantity || 1)), 0);
          const oTotalCents = Math.round((Number(orderData.total) || 0) * 100);
          if (pTotalCents > 0 && Math.abs(pTotalCents - oTotalCents) <= 10) {
            return true;
          }
        }
      }

      return false;
    };

    const candidatePurchases: any[] = [];

    // A. Check by known purchase ID
    if (orderData.chip_purchase_id) {
      try {
        const resp = await fetch(`https://gate.chip-in.asia/api/v1/purchases/${orderData.chip_purchase_id}/`, {
          headers: { "Authorization": `Bearer ${apiKey}` }
        });
        if (resp.ok) {
          const pData = await resp.json();
          candidatePurchases.push(pData);
        }
      } catch (err) {
        console.warn(`[CHIP Verify] Could not query purchase ${orderData.chip_purchase_id}:`, err);
      }
    }

    // B. Search CHIP Gateway by reference queries
    const searchRefs = [cleanOrderId, `#${cleanOrderId}`, `ORDER-${cleanOrderId}`];
    for (const refToSearch of searchRefs) {
      try {
        const listResp = await fetch(`https://gate.chip-in.asia/api/v1/purchases/?reference=${encodeURIComponent(refToSearch)}`, {
          headers: { "Authorization": `Bearer ${apiKey}` }
        });
        if (listResp.ok) {
          const listData = await listResp.json();
          const items = Array.isArray(listData) ? listData : listData?.results || listData?.data || [];
          items.forEach((item: any) => candidatePurchases.push(item));
        }
      } catch (err) {
        console.warn(`[CHIP Verify] Query reference ${refToSearch} failed:`, err);
      }
    }

    // C. Fallback: List recent purchases from CHIP to find matching order
    try {
      const listResp = await fetch(`https://gate.chip-in.asia/api/v1/purchases/`, {
        headers: { "Authorization": `Bearer ${apiKey}` }
      });
      if (listResp.ok) {
        const listData = await listResp.json();
        const items = Array.isArray(listData) ? listData : listData?.results || listData?.data || [];
        items.forEach((item: any) => candidatePurchases.push(item));
      }
    } catch (err) {
      console.warn(`[CHIP Verify] List purchases fallback failed:`, err);
    }

    // Find paid matching purchase
    const paidMatch = candidatePurchases.find(p => isMatchingOrderPurchase(p) && checkIsPaidStatus(p));

    if (paidMatch) {
      // Re-deduct product stock if order was previously cancelled or failed
      if ((orderData.status === 'cancelled' || orderData.status === 'failed') && Array.isArray(orderData.items)) {
        for (const item of orderData.items) {
          let docId = item.baseProductId || item.id;
          if (typeof docId === 'string' && docId.endsWith('-protected')) {
            docId = docId.replace(/-protected$/, '');
          }
          if (docId) {
            try {
              const prodRef = doc(db, 'products', docId);
              const prodSnap = await getDoc(prodRef);
              if (prodSnap.exists()) {
                const currentStock = prodSnap.data().stock || 0;
                await updateDoc(prodRef, { stock: Math.max(0, currentStock - (item.quantity || 1)) });
              }
            } catch (stockErr) {
              console.warn(`[CHIP Verify] Could not re-deduct stock for product ${docId}:`, stockErr);
            }
          }
        }
      }

      // Update Firestore document to PAID
      await updateDoc(orderDocRef, {
        status: 'paid',
        chip_purchase_id: paidMatch.id || orderData.chip_purchase_id || '',
        chip_payment_status: paidMatch.status || 'paid',
        chip_verified_at: new Date().toISOString(),
        chip_paid_at: paidMatch.transaction_data?.paid_at || paidMatch.paid_at || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        statusHistory: arrayUnion({
          status: 'paid',
          timestamp: new Date().toISOString(),
          source: 'chip_gateway_live_verify_rescue'
        })
      });

      console.log(`[CHIP Verify] RESCUED Order #${cleanOrderId} from "${orderData.status}" to "PAID" via CHIP purchase ID ${paidMatch.id}!`);
      orderData.status = 'paid';

      return {
        paid: true,
        status: 'paid',
        rescued: true,
        order: orderData,
        purchaseId: paidMatch.id
      };
    }

    return {
      paid: false,
      status: orderData.status,
      order: orderData
    };
  };

  app.get("/api/chip/verify/:orderId", async (req, res) => {
    try {
      const apiKey = (process.env.CHIP_API || process.env.CHIP_SECRET || process.env.CHIP_KEY || process.env.VITE_CHIP_API || '').trim().replace(/^["']|["']$/g, '');
      const result = await verifyAndRescueSingleOrder(req.params.orderId, apiKey);
      return res.json(result);
    } catch (err: any) {
      console.error("[CHIP Verify] Error:", err);
      return res.status(500).json({ error: err.message || "Failed to verify order" });
    }
  });

  app.post("/api/chip/verify", async (req, res) => {
    try {
      const apiKey = (process.env.CHIP_API || process.env.CHIP_SECRET || process.env.CHIP_KEY || process.env.VITE_CHIP_API || '').trim().replace(/^["']|["']$/g, '');
      const orderId = req.body.orderId || req.body.order_id || req.body.reference;
      const result = await verifyAndRescueSingleOrder(orderId, apiKey);
      return res.json(result);
    } catch (err: any) {
      console.error("[CHIP Verify] Error:", err);
      return res.status(500).json({ error: err.message || "Failed to verify order" });
    }
  });

  // ---------------------------------------------------------------------------
  // BATCH SYNC: AUTO-VERIFY PENDING, FAILED & CANCELLED ORDERS WITH CHIP GATEWAY
  // ---------------------------------------------------------------------------
  app.all("/api/chip/sync-pending", async (req, res) => {
    try {
      if (!db) {
        return res.status(500).json({ error: "Database not connected" });
      }

      const apiKey = (process.env.CHIP_API || process.env.CHIP_SECRET || process.env.CHIP_KEY || process.env.VITE_CHIP_API || '').trim().replace(/^["']|["']$/g, '');
      if (!apiKey) {
        return res.status(400).json({ error: "CHIP_API key not configured" });
      }

      // 1. Query pending orders
      const pendingQ = query(
        collection(db, 'orders'),
        where('status', '==', 'pending'),
        limit(50)
      );
      
      // 2. Query cancelled and failed orders (to rescue any mistakenly cancelled)
      const cancelledQ = query(
        collection(db, 'orders'),
        where('status', 'in', ['cancelled', 'failed', 'pending_transfer']),
        limit(50)
      );

      const [pendingSnap, unconfirmedSnap] = await Promise.all([
        getDocs(pendingQ),
        getDocs(cancelledQ)
      ]);

      const allDocMap = new Map<string, any>();
      pendingSnap.docs.forEach(d => allDocMap.set(d.id, d));
      unconfirmedSnap.docs.forEach(d => allDocMap.set(d.id, d));

      if (allDocMap.size === 0) {
        return res.json({ synced: 0, rescued: 0, message: "No unconfirmed orders to verify." });
      }

      const rescuedOrders: string[] = [];
      let checkedCount = 0;

      for (const [orderId] of allDocMap) {
        checkedCount++;
        try {
          const resObj = await verifyAndRescueSingleOrder(orderId, apiKey);
          if (resObj.paid && resObj.rescued) {
            rescuedOrders.push(orderId);
          }
        } catch (singleErr) {
          console.warn(`[CHIP Sync Batch] Error checking order #${orderId}:`, singleErr);
        }
      }

      console.log(`[CHIP Sync Batch] Checked ${checkedCount} unconfirmed orders, rescued ${rescuedOrders.length} to PAID:`, rescuedOrders);

      return res.json({
        synced: checkedCount,
        rescued: rescuedOrders.length,
        rescuedOrderIds: rescuedOrders,
        message: rescuedOrders.length > 0 
          ? `Successfully synced with CHIP: Rescued ${rescuedOrders.length} order(s) to Paid!`
          : `Synced ${checkedCount} order(s) with CHIP. All statuses are up to date.`
      });
    } catch (err: any) {
      console.error("[CHIP Sync Batch] Error:", err);
      return res.status(500).json({ error: err.message || "Failed to batch sync orders" });
    }
  });

  // Admin Manual Order Rescue Endpoint
  app.all("/api/admin/force-paid/:orderId", async (req, res) => {
    try {
      if (!db) {
        return res.status(500).json({ error: "Database not connected" });
      }
      const cleanOrderId = (req.params.orderId || '').replace(/^#/, '').trim();
      let orderDocRef = doc(db, 'orders', cleanOrderId);
      let orderSnap = await getDoc(orderDocRef);
      if (!orderSnap.exists()) {
        const hashDoc = doc(db, 'orders', `#${cleanOrderId}`);
        const hashSnap = await getDoc(hashDoc);
        if (hashSnap.exists()) {
          orderDocRef = hashDoc;
          orderSnap = hashSnap;
        } else {
          const q = query(collection(db, 'orders'), where('id', '==', cleanOrderId), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            orderDocRef = snap.docs[0].ref;
            orderSnap = snap.docs[0] as any;
          }
        }
      }

      if (!orderSnap || !orderSnap.exists()) {
        return res.status(404).json({ error: "Order not found" });
      }

      const orderData: any = orderSnap.data();

      // Re-deduct product stock if order was previously cancelled or failed
      if ((orderData.status === 'cancelled' || orderData.status === 'failed') && Array.isArray(orderData.items)) {
        for (const item of orderData.items) {
          let docId = item.baseProductId || item.id;
          if (typeof docId === 'string' && docId.endsWith('-protected')) {
            docId = docId.replace(/-protected$/, '');
          }
          if (docId) {
            try {
              const prodRef = doc(db, 'products', docId);
              const prodSnap = await getDoc(prodRef);
              if (prodSnap.exists()) {
                const currentStock = prodSnap.data().stock || 0;
                await updateDoc(prodRef, { stock: Math.max(0, currentStock - (item.quantity || 1)) });
              }
            } catch (stockErr) {
              console.warn(`[Force Paid] Could not re-deduct stock for product ${docId}:`, stockErr);
            }
          }
        }
      }

      await updateDoc(orderDocRef, {
        status: 'paid',
        chip_payment_status: 'paid',
        chip_verified_at: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        statusHistory: arrayUnion({
          status: 'paid',
          timestamp: new Date().toISOString(),
          source: 'admin_manual_reconciliation_force_paid'
        })
      });

      console.log(`[Admin] Force-updated Order #${cleanOrderId} to PAID.`);
      return res.json({ success: true, message: `Order #${cleanOrderId} successfully updated to PAID!`, orderId: cleanOrderId });
    } catch (err: any) {
      console.error("[Force Paid] Error:", err);
      return res.status(500).json({ error: err.message || "Failed to update order status" });
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

async function startServer() {
  // If running in Vercel serverless function environment, do not start local HTTP listener
  if (process.env.VERCEL) {
    return;
  }

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
