import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";

const BROWSERLESS_TOKEN = "2UmKLTSZ47WQhuNdc82d1cfa63f1a34659a2f6d1f89767351";
const BROWSERLESS_WS = `wss://chrome.browserless.io?token=${BROWSERLESS_TOKEN}`;

interface RequestBody {
  html: string;
  filename?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const body: RequestBody = await req.json();

    if (!body.html) {
      return new Response(
        JSON.stringify({ error: "Missing 'html' field in request body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Connect to Browserless.io cloud Chrome
    const browser = await puppeteer.connect({
      browserWSEndpoint: BROWSERLESS_WS,
    });

    const page = await browser.newPage();

    // Set content and render as fast as possible
    await page.setContent(body.html, {
      waitUntil: "load",
      timeout: 15000,
    });

    // Small safety wait for layout
    await new Promise(r => setTimeout(r, 500));

    // Generate PDF with print CSS respected
    const pdf = await page.pdf({
      format: "letter",
      margin: { top: "5mm", right: "5mm", bottom: "5mm", left: "5mm" },
      printBackground: true,
      preferCSSPageSize: false,
    });

    await browser.close();

    const filename = body.filename || "documento.pdf";

    return new Response(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Access-Control-Allow-Origin": "*",
        "Content-Length": pdf.length.toString(),
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
