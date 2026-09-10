/**
 * Parse structured JSON detection results from model or agent text output
 */
export function extractDetectionsFromText(
  rawText: string,
  ontologyClasses: string[]
): {
  detections: Array<{
    label: string;
    box_2d: [number, number, number, number];
    confidence: number;
    description?: string;
  }>;
  summary: string;
} {
  let detections: any[] = [];
  let summary = "";

  try {
    let clean = rawText.trim();
    // Strip markdown code fences if present
    if (clean.includes("```json")) {
      clean = clean.split("```json")[1].split("```")[0].trim();
    } else if (clean.includes("```")) {
      clean = clean.split("```")[1].split("```")[0].trim();
    }

    // Try finding outer JSON object
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed.detections)) {
      detections = parsed.detections;
    }
    if (typeof parsed.summary === "string") {
      summary = parsed.summary;
    }
  } catch (parseErr) {
    console.warn("Could not directly parse JSON from model response:", parseErr);
  }

  // Sanitize and validate bounding boxes
  const sanitizedDetections = detections
    .filter((d: any) => d && Array.isArray(d.box_2d) && d.box_2d.length === 4)
    .map((d: any) => {
      // Ensure coordinates are [ymin, xmin, ymax, xmax] clamped 0..1000
      const box_2d: [number, number, number, number] = [
        Math.max(0, Math.min(1000, Math.round(Number(d.box_2d[0]) || 0))),
        Math.max(0, Math.min(1000, Math.round(Number(d.box_2d[1]) || 0))),
        Math.max(0, Math.min(1000, Math.round(Number(d.box_2d[2]) || 1000))),
        Math.max(0, Math.min(1000, Math.round(Number(d.box_2d[3]) || 1000))),
      ];

      // Match label with ontology if possible
      let label = String(d.label || "").trim();
      const matchedOntology = ontologyClasses.find(
        (c) => c.toLowerCase() === label.toLowerCase()
      );
      if (matchedOntology) {
        label = matchedOntology;
      }

      return {
        label: label || ontologyClasses[0] || "Target Object",
        box_2d,
        confidence: typeof d.confidence === "number" ? Math.min(1, Math.max(0.1, d.confidence)) : 0.88,
        description: d.description || `Detected instance of ${label}`,
      };
    });

  return {
    detections: sanitizedDetections,
    summary: summary || `Localized ${sanitizedDetections.length} objects matching target ontology classes.`,
  };
}
