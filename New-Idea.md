# AI Clothing Try-On System Prompts

This document defines the system prompts for two core tasks:

1. **Onboarding Prompt** – generating base avatars of the user in neutral clothing.  
2. **Closet Try-On Prompt** – overlaying clothing onto the user for outfit visualization.  

---

## 1. Onboarding Prompt (Avatar Generation)

**Goal:**  
When a new user joins, they will upload **3+ photos** of themselves.  
The AI model will then generate **4 avatar images** of the user in neutral clothing, on a white background.  
These avatars will serve as **standard base models** for future clothing try-ons.  

### Core Instructions (apply to all 4 avatars)
- Use the provided user photos to capture **identity, face, hairstyle, body type, and skin tone**.  
- Dress the user in **neutral clothing**: plain white/grey T-shirt, black/grey/neutral **shorts (NOT long pants)**, neutral shoes if visible.  
- **Shorts should be mid-thigh length for optimal outfit layering compatibility**.
- Background must be **plain white**.  
- Output must be a **realistic, high-resolution photo** of the user.  
- No text, logos, or watermarks.  
- Preserve realism and identity (no stylization, no cartoon effects).  

### Avatar Poses (4 separate prompts, run in parallel)

- **Avatar 1 – Neutral front-facing:**  
  Standing, facing the camera directly, arms relaxed at sides.  

- **Avatar 2 – Front-facing, open stance:**  
  Standing, facing the camera directly, arms slightly apart from the body, legs slightly apart.  

- **Avatar 3 – Three-quarter angle:**  
  Standing at a ¾ angle (about 45° to camera), upright, arms relaxed.  

- **Avatar 4 – Side profile:**  
  Standing in a full side profile (90° angle to camera), arms relaxed.  

---

## 2. Closet Try-On Prompt (Outfit Application)

**Goal:**  
Apply clothing from one or more provided clothing images onto the user’s avatar (or directly onto the base photo).  

### Inputs
1. **Base Image** – the user photo or avatar onto which clothing will be applied.  
2. **Clothing Image(s)** – one or more photos of clothing (may be flat, on a mannequin, or worn by another person).  

### Instructions
- **Remove existing clothing** from the base image before applying new clothing.  
- Place the clothing item(s) from the clothing image(s) onto the user, ensuring realistic alignment, fit, and drape.  
- You may adjust the user’s **pose or stance** so the clothing fits naturally.  
- Always use a **plain white background**.  
- Preserve user’s **face, hairstyle, body, and skin tone**.  

### Clothing Handling Rules
- **Multiple clothing inputs (outfit scenario):**  
  - Combine all provided items into a coherent outfit.  
  - Respect layering (shirt under jacket, pants with shoes).  
  - Maintain consistent style, scale, and lighting.  

- **Single or partial clothing inputs:**  
  - Apply the item realistically.  
  - Generate **neutral-colored base clothing** for missing areas:  
    - Pants only → add a neutral top.  
    - Top only → add neutral bottoms.  
    - Strapless/revealing clothing (tube tops, bikinis, lingerie) → add neutral base pieces to cover uncovered areas.  
  - Neutral clothing = simple/plain (white/grey T-shirt, black/grey pants/shorts).  

### Additional Requirements
- Remove mannequins, people, or backgrounds from clothing inputs.  
- Preserve fabric **textures, colors, logos, and patterns** accurately.  
- Adjust lighting/shading to blend naturally with the person.  
- Final result must look like an **authentic photo** of the user in a complete, modest outfit.  

### Output
- A single, **high-resolution image** of the user wearing the clothing (or full outfit).  
- Posed naturally, on a plain white background.  
- No text, watermarks, or extra elements.  

---

## 3. Gemini Integration (models/gemini-2.5-flash-image-preview)

**Goal:**  
Integrate Google’s Gemini API into the app to enable image-based try-ons using `models/gemini-2.5-flash-image-preview`.  

### Prerequisites
- Get a **Gemini API key** from [Google AI Studio](https://aistudio.google.com/).  
- Set the key as an environment variable:  

Install Google GenAI SDK (Node.js example)
```bash
export GEMINI_API_KEY="your_api_key_here"
```

```bash
npm install @google/genai
```

Example Request (Text-only)
```javascript
import { GoogleGenAI } from "@google/genai";

// The client picks up the GEMINI_API_KEY environment variable
const ai = new GoogleGenAI({});

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Explain how AI works in a few words",
  });
  console.log(response.text);
}

main();
```

Example Request (Image + Text with Image Preview Model)
```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image-preview",
    contents: [
      {
        role: "user",
        parts: [
          { text: "Overlay this clothing onto this person." },
          { inlineData: { mimeType: "image/png", data: "<base64_user_image>" } },
          { inlineData: { mimeType: "image/png", data: "<base64_clothing_image>" } }
        ]
      }
    ]
  });
  console.log(response);
}

main();
```

Notes

Use gemini-2.5-flash-image-preview for fast multimodal image processing.

“Thinking” is enabled by default for gemini-2.5-flash. To disable:
```javascript
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash-image-preview",
  contents: "Your request here",
  config: {
    thinkingConfig: {
      thinkingBudget: 0 // disables thinking
    }
  }
});
```