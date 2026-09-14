import "dotenv/config";
import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { extractDetectionsFromText } from "./server-parser.ts";

const app = express();
const PORT = 3000;

// Middleware for parsing JSON with a larger limit for base64 images
app.use(express.json({ limit: "25mb" }));

// Healthcheck API
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Test Bedrock Connection Endpoint
app.post("/api/bedrock/test-connection", async (req, res) => {
  try {
    const { testBedrockConnection } = await import("./server-bedrock.ts");
    const { accessKeyId, secretAccessKey, sessionToken, region, modelId } = req.body;
    const result = await testBedrockConnection({
      accessKeyId: (accessKeyId || process.env.AWS_ACCESS_KEY_ID || "").trim(),
      secretAccessKey: (secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "").trim(),
      sessionToken: (sessionToken || process.env.AWS_SESSION_TOKEN || "").trim(),
      region: (region || process.env.AWS_REGION || "us-east-1").trim(),
      modelId,
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to test Bedrock credentials.",
    });
  }
});

// Object Detection Endpoint (Supports Gemini and Bedrock)
app.post("/api/detect", async (req, res) => {
  try {
    const {
      imageBase64,
      mimeType = "image/jpeg",
      ontology,
      model: requestedModel,
      useBedrock = false,
      bedrockConfig,
    } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing imageBase64 data" });
    }

    if (!ontology || !Array.isArray(ontology) || ontology.length === 0) {
      return res.status(400).json({ error: "Ontology must be a non-empty list of classes" });
    }

    // --- Branch 1: Amazon Bedrock AgentCore & Vision Detection ---
    if (useBedrock) {
      const selectedBedrockModel =
        requestedModel ||
        bedrockConfig?.modelId ||
        "amazon.nova-pro-v1:0";

      const effectiveConfig = {
        accessKeyId: (process.env.AWS_ACCESS_KEY_ID || bedrockConfig?.accessKeyId || "").trim(),
        secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY || bedrockConfig?.secretAccessKey || "").trim(),
        sessionToken: (process.env.AWS_SESSION_TOKEN || bedrockConfig?.sessionToken || "").trim(),
        region: (process.env.AWS_REGION || bedrockConfig?.region || "us-east-1").trim(),
        invocationType: bedrockConfig?.invocationType || "model",
        agentId: bedrockConfig?.agentId || "",
        agentAliasId: bedrockConfig?.agentAliasId || "TSTALIASID",
        sessionId: `session-${Date.now()}`,
        mockIfCredentialsInvalid: false,
        modelId: selectedBedrockModel,
      };

      const { runBedrockDetection } = await import("./server-bedrock.ts");
      const bedrockResult = await runBedrockDetection({
        imageBase64,
        mimeType,
        ontology,
        bedrockConfig: effectiveConfig,
      });

      return res.json(bedrockResult);
    }

    // --- Branch 2: Google Gemini Vision Object Detection (Default) ---
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured in server environment secrets.",
      });
    }

    const selectedGeminiModel = requestedModel || "gemini-3.5-flash";
    const cleanBase64 = imageBase64.includes("base64,")
      ? imageBase64.split("base64,")[1]
      : imageBase64;

    const ontologyText = ontology
      .map((item: any) => `- ${item.name}: ${item.description || "Target visual class"}`)
      .join("\n");

    const promptText = `You are an expert computer vision model.
Detect and locate all visible instances of the target ontology classes in this image:

Target Ontology Classes:
${ontologyText}

Return a valid JSON object strictly matching this schema:
{
  "detections": [
    {
      "label": "Exact class name matching one of the target ontology classes",
      "box_2d": [ymin, xmin, ymax, xmax],
      "confidence": 0.95,
      "description": "Short visual details of the detected entity"
    }
  ],
  "summary": "Short scene summary of detected objects"
}

Important Instructions:
- Coordinates [ymin, xmin, ymax, xmax] MUST be normalized integers from 0 to 1000.
- ymin is the top boundary (0-1000), xmin is the left boundary (0-1000), ymax is the bottom boundary (0-1000), xmax is the right boundary (0-1000).
- Locate every distinct occurrence accurately.
- Return raw JSON only, without any markdown fences or conversational remarks.`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: selectedGeminiModel,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: mimeType || "image/jpeg",
              },
            },
            {
              text: promptText,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const textOutput = response.text || "";
    const ontologyClassNames = ontology.map((o: any) => o.name);
    const parsed = extractDetectionsFromText(textOutput, ontologyClassNames);

    return res.json({
      success: true,
      detections: parsed.detections,
      summary: parsed.summary || `Detected ${parsed.detections.length} objects using ${selectedGeminiModel}`,
      model: `Google ${selectedGeminiModel}`,
      processedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Error in /api/detect:", err);
    return res.status(500).json({
      error: err.message || "Failed to process object detection.",
    });
  }
});

// Ontology Brainstorming Endpoint
app.post("/api/brainstorm-ontology", async (req, res) => {
  try {
    const {
      messages = [],
      currentOntology = [],
      domainExpertise = "",
      referenceUrl = "",
    } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing. Please configure it in Settings > Secrets.",
      });
    }

    // Optional external reference URL fetch
    let fetchedUrlContext = "";
    let fetchAttempted = false;
    if (referenceUrl && typeof referenceUrl === "string" && referenceUrl.trim().startsWith("http")) {
      fetchAttempted = true;
      try {
        const cleanUrl = referenceUrl.trim();
        const urlRes = await fetch(cleanUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
          },
          signal: AbortSignal.timeout(6000),
        });
        if (urlRes.ok) {
          const rawHtml = await urlRes.text();
          const textOnly = rawHtml
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          fetchedUrlContext = textOnly.slice(0, 7000);
        }
      } catch (err: any) {
        console.warn("Could not fetch reference URL directly:", err.message);
      }
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const currentClassesSummary =
      Array.isArray(currentOntology) && currentOntology.length > 0
        ? currentOntology
          .map(
            (c: any) =>
              `- "${c.name}": ${c.description || "(no description provided)"}`
          )
          .join("\n")
        : "No classes defined yet.";

    const systemInstruction = `You are a world-class Computer Vision Taxonomist, Domain Expert, and AI Labeling Architect.
Your mission is to help the user brainstorm, establish, refine, and optimize class labels and visual descriptions for zero-shot object detection with Gemini Vision models.

Context Provided by the User:
- Domain Expertise / Field: ${domainExpertise ? domainExpertise : "General Object Localization"}
- Current Classes in Taxonomy:
${currentClassesSummary}
${referenceUrl ? `- External Reference URL provided by user: ${referenceUrl}` : ""}
${fetchedUrlContext ? `- Extracted Content from External URL Reference:\n"""\n${fetchedUrlContext}\n"""` : ""}
${fetchAttempted && !fetchedUrlContext ? `(Note: Direct web fetch for ${referenceUrl} was not reachable, but utilize your deep domain knowledge of this source or domain).` : ""}

Guidelines for Effective Object Detection Descriptions:
1. Ground every description in clear visual signatures: shape contours, color hues, boundary margins, surface textures, typical scale, aspect ratio, and surrounding context.
2. Formulate descriptions that allow Gemini Vision to distinguish between subtly different or overlapping classes.
3. Keep individual class descriptions sharp, unambiguous, and focused on visual appearance (typically 1-3 sentences per class).
4. Whenever you suggest new classes or refined descriptions, ALWAYS populate the 'suggestedClasses' array with structured items:
   - 'name': Exact label class name
   - 'description': The refined visual grounding description
   - 'rationale': Brief explanation of the key visual discriminator cues
5. Format your main conversational reply in clean, readable Markdown with helpful sections, tips, or comparative analysis.`;

    const formattedContents = messages.map((msg: any) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    if (
      formattedContents.length === 0 ||
      formattedContents[formattedContents.length - 1].role !== "user"
    ) {
      formattedContents.push({
        role: "user",
        parts: [
          {
            text:
              "Please analyze my domain requirements and suggest recommended classes with visual descriptions for object detection.",
          },
        ],
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: formattedContents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description:
                "Detailed conversational response, domain analysis, discriminator guidelines, and tips in clean Markdown.",
            },
            suggestedClasses: {
              type: Type.ARRAY,
              description:
                "List of recommended classes and descriptions for the ontology",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: {
                    type: Type.STRING,
                    description: "Class label name",
                  },
                  description: {
                    type: Type.STRING,
                    description:
                      "Visual grounding description for Gemini Vision localization",
                  },
                  rationale: {
                    type: Type.STRING,
                    description: "Why this visual description is effective",
                  },
                },
                required: ["name", "description"],
              },
            },
          },
          required: ["reply", "suggestedClasses"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");

    return res.json({
      success: true,
      reply: parsed.reply || "Here are my recommendations for your taxonomy.",
      suggestedClasses: parsed.suggestedClasses || [],
      urlFetched: Boolean(fetchedUrlContext),
    });
  } catch (err: any) {
    console.error("Error in /api/brainstorm-ontology:", err);
    return res.status(500).json({
      error: err.message || "Failed to brainstorm ontology with Gemini API",
    });
  }
});

async function startServer() {
  try {
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Object Detection App server listening on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
