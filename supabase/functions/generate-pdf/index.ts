import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const BROWSERLESS_TOKEN = "2UmKLTSZ47WQhuNdc82d1cfa63f1a34659a2f6d1f89767351";
const BROWSERLESS_API = "https://chrome.browserless.io/pdf";

interface RequestBody {
  html: string;
  filename?: string;
}

serve(async (req) => {
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
      return new Response(JSON.stringify({ error: "Missing 'html' field" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Forward HTML to Browserless.io PDF API (no puppeteer needed)
    const response = await fetch(`${BROWSERLESS_API}?token=${BROWSERLESS_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: body.html,
        options: {
          format: "Letter",
          margin: { top: 5, right: 5, bottom: 5, left: 5 },
          printBackground: true,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Browserless error (${response.status}): ${text}`);
    }

    const pdf = await response.arrayBuffer();
    const filename = body.filename || "documento.pdf";

    return new Response(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
