import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";

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

    // Launch headless Chromium
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();

    // Set content and wait for fonts/images to load
    await page.setContent(body.html, {
      waitUntil: "networkidle0",
    });

    await page.waitForNetworkIdle({ idleTime: 500 });

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
