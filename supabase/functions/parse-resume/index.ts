// Public endpoint: analyses an uploaded resume with Lovable AI and returns
// structured information. Never persists the raw file.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const EXTRACT_TOOL = {
  type: "function",
  function: {
    name: "submit_resume_analysis",
    description: "Return structured information extracted from the resume",
    parameters: {
      type: "object",
      properties: {
        candidate_name: { type: "string" },
        headline: { type: "string", description: "One line summary of the candidate profile" },
        years_experience: { type: "string" },
        education: {
          type: "array",
          items: {
            type: "object",
            properties: {
              degree: { type: "string" },
              institution: { type: "string" },
              year: { type: "string" },
            },
            required: ["degree", "institution", "year"],
          },
        },
        skills: { type: "array", items: { type: "string" } },
        programming_languages: { type: "array", items: { type: "string" } },
        frameworks: { type: "array", items: { type: "string" } },
        tools: { type: "array", items: { type: "string" } },
        projects: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              technologies: { type: "array", items: { type: "string" } },
            },
            required: ["name", "description", "technologies"],
          },
        },
        experience: {
          type: "array",
          items: {
            type: "object",
            properties: {
              role: { type: "string" },
              company: { type: "string" },
              duration: { type: "string" },
              highlights: { type: "array", items: { type: "string" } },
            },
            required: ["role", "company", "duration", "highlights"],
          },
        },
        internships: {
          type: "array",
          items: {
            type: "object",
            properties: {
              role: { type: "string" },
              company: { type: "string" },
              duration: { type: "string" },
            },
            required: ["role", "company", "duration"],
          },
        },
        certifications: { type: "array", items: { type: "string" } },
        keywords: { type: "array", items: { type: "string" } },
      },
      required: [
        "candidate_name", "headline", "years_experience", "education", "skills",
        "programming_languages", "frameworks", "tools", "projects", "experience",
        "internships", "certifications", "keywords",
      ],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI is not configured. Please contact support." }, 500);

    const body = await req.json().catch(() => ({}));
    const fileName: string = typeof body.fileName === "string" ? body.fileName.slice(0, 200) : "resume";
    const mimeType: string = typeof body.mimeType === "string" ? body.mimeType.slice(0, 120) : "";
    const fileBase64: string = typeof body.fileBase64 === "string" ? body.fileBase64 : "";
    const plainText: string = typeof body.text === "string" ? body.text.slice(0, 120000) : "";

    if (!fileBase64 && plainText.trim().length < 40) {
      return json({ error: "We couldn't read any text from that file. Please upload a text-based PDF or DOCX." }, 400);
    }

    const instruction =
      "Extract structured information from this resume. Only report information that is actually present " +
      "in the document — never invent skills, projects, employers or dates. Leave a field as an empty array " +
      "or empty string when the resume does not mention it.";

    const content: any[] = [{ type: "text", text: instruction }];
    if (fileBase64 && mimeType === "application/pdf") {
      content.push({
        type: "file",
        file: { filename: fileName, file_data: `data:${mimeType};base64,${fileBase64}` },
      });
    } else {
      content.push({ type: "text", text: `RESUME TEXT:\n${plainText}` });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          { role: "system", content: "You are an expert technical recruiter that parses resumes accurately and never fabricates data." },
          { role: "user", content },
        ],
        tools: [EXTRACT_TOOL],
        tool_choice: { type: "function", function: { name: "submit_resume_analysis" } },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("parse-resume AI error", res.status, errText);
      if (res.status === 429) return json({ error: "Too many requests right now. Please try again in a moment." }, 429);
      if (res.status === 402) return json({ error: "AI credits are exhausted. Please contact the hiring team." }, 402);
      return json({ error: "We couldn't analyse this resume. Please try a different file." }, 502);
    }

    const data = await res.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return json({ error: "We couldn't extract details from this resume. Please try another file." }, 422);

    const parsed = JSON.parse(args);
    parsed.source_file = fileName;
    parsed.parsed_at = new Date().toISOString();
    return json({ resume: parsed });
  } catch (err) {
    console.error("parse-resume error", err);
    return json({ error: "Something went wrong while analysing your resume. Please try again." }, 500);
  }
});