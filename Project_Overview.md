# Health Assistant - Agentic AI Symptom Checker

> **Powered by IBM Granite & IBM Cloud**

## 1. Project Overview
**Health Assistant** is an advanced, AI-driven symptom checker designed to provide users with immediate, reliable health insights. It acts as a first line of defense, helping users understand their condition, assess urgency, and access verified medical resources.

By leveraging **Agentic AI**, the system doesn't just "chat"—it proactively analyzes, structures, and cross-references user symptoms with trusted medical guidelines (like WHO data) to offer a comprehensive health assessment.

---

## 2. Problem Statement & Solution
### **The Challenge**
Users often struggle with uncertainty when experiencing symptoms. Internet searches can lead to misinformation or unnecessary panic ("Cyberchondria"). There is a need for a tool that:
*   Analyzes symptoms in natural language.
*   Provides probable causes and urgency levels.
*   Offers home remedies and care recommendations.
*   Retrieves verified medical data (WHO, government portals).
*   Avoids self-diagnosis risks by emphasizing education and referral.
*   **Mandatory:** Uses IBM Cloud Lite / IBM Granite.

### **Our Solution**
**Health Assistant** directly addresses this challenge by providing a verified, structured, and multi-modal interface for health analysis.

| Challenge Requirement | How Health Assistant Fulfills It |
| :--- | :--- |
| **Natural Language Input** | Users can type or speak their symptoms freely (e.g., "I have a sore throat and fever"). |
| **Probable Causes & Urgency** | The AI Agent outputs a structured analysis including "Probable Causes," "Urgency Level" (Low to Emergency), and "Medical Advice." |
| **Verified Data Retrieval** | The system automatically fetches relevant articles from the **World Health Organization (WHO)** based on the analysis. |
| **Preventive & Home Care** | Specific "Home Remedies" are generated for immediate relief. |
| **Avoids Self-Diagnosis** | Includes clear disclaimers and structured "Medical Advice" urging professional consultation for high-risk cases. |
| **Multi-Language** | Supports real-time interaction in **English, Spanish, and French**. |

## 3. Application Architecture & Workflow

### **System Architecture Diagram**

> **Note:** If the diagram below does not render, please view the Text-Based Architecture Layout underneath.

[![](https://mermaid.ink/img/pako:eNqFVGtv2jAU_SuWP4HEs5AC0TSJQTeQxjot2ZBGqspNPMhG7MhxOijhv-_acUK6MI0Pzr0-x-c-fPEJ-zyg2MYe2woS75A79xiC39eEisZGrQ_NfCdfk_QpJ74XnEnKgo2HCxM1PtGD7PxMmh5-yOlaaql10BJI4gfxaQVbEBbsqdjcPVMmCy-pEBxJJN3oFa0II1saAdMQIObV3Kafl48fyRF0PQw20naZHfrCU0n_SlIdcVwXDnRJHHYTKWvwlJH98YUWFJK7NZrrOgVFyqQGrxf3ZRAfsqXd3ztesv5V0fLd6nG256lqN9hI28ih4jn06esgayITzlQtuYWcmFJ_15a87UIDaswPgrBQqrJy_9AhIWqY3eYVaVWgkVaCSjgP8Z8a7g5w_9A0iFSYaE4keR1icb-mTxv4IPgmkEJV9TKbqN1-m33jUH1XJZHBlBlwqaBilPI942hAj1I1vwqYTdMg5FkxDHXcOUax5FGSVQfiiowCktDQoF91yoyzIJQhZ1kxFdWcTALojcq4vNALZiJXcXNhFw6EreJlFiacwXS7PYZbOKIiImEAb8FJET0sd_Bf87ANZkDELw_eiDPwSCq5c2Q-tqVIaQsLnm53hZPGAbR3HhK48qjY3Aola9hwj1TMeMoktse3LRwT9p3zkkuhK1ys8kdJv02agu0TPsABq3M7Hg1H_cng9mYyGvRb-Ijtfm_csW6sXn9o9YYDazyxzi38okV7nfHIOv8BpnqE7Q?type=png)](https://mermaid.live/edit#pako:eNqFVGtv2jAU_SuWP4HEs5AC0TSJQTeQxjot2ZBGqspNPMhG7MhxOijhv-_acUK6MI0Pzr0-x-c-fPEJ-zyg2MYe2woS75A79xiC39eEisZGrQ_NfCdfk_QpJ74XnEnKgo2HCxM1PtGD7PxMmh5-yOlaaql10BJI4gfxaQVbEBbsqdjcPVMmCy-pEBxJJN3oFa0II1saAdMQIObV3Kafl48fyRF0PQw20naZHfrCU0n_SlIdcVwXDnRJHHYTKWvwlJH98YUWFJK7NZrrOgVFyqQGrxf3ZRAfsqXd3ztesv5V0fLd6nG256lqN9hI28ih4jn06esgayITzlQtuYWcmFJ_15a87UIDaswPgrBQqrJy_9AhIWqY3eYVaVWgkVaCSjgP8Z8a7g5w_9A0iFSYaE4keR1icb-mTxv4IPgmkEJV9TKbqN1-m33jUH1XJZHBlBlwqaBilPI942hAj1I1vwqYTdMg5FkxDHXcOUax5FGSVQfiiowCktDQoF91yoyzIJQhZ1kxFdWcTALojcq4vNALZiJXcXNhFw6EreJlFiacwXS7PYZbOKIiImEAb8FJET0sd_Bf87ANZkDELw_eiDPwSCq5c2Q-tqVIaQsLnm53hZPGAbR3HhK48qjY3Aola9hwj1TMeMoktse3LRwT9p3zkkuhK1ys8kdJv02agu0TPsABq3M7Hg1H_cng9mYyGvRb-Ijtfm_csW6sXn9o9YYDazyxzi38okV7nfHIOv8BpnqE7Q)

### **Text-Based Architecture Layout**
*(Fallback visualization)*

```text
+--------+       +-------------------------+       +------------------------+
|  USER  | ----> |   Frontend (Next.js)    | <---> |       API Layer        |
+--------+       | (UI, State, Handlers)   |       | (/api/analyze, etc.)   |
                 +-------------------------+       +-----------+------------+
                                                               |
                                      +------------------------+-------------------------+
                                      |                        |                         |
                           +----------v-----------+  +---------v----------+   +----------v----------+
                           |  IBM Watsonx.ai      |  | IBM Watson STT/TTS |   |   WHO Web Scraper   |
                           | (Granite Model)      |  | (Voice Services)   |   | (External Data)     |
                           +----------------------+  +--------------------+   +---------------------+
```

### **Detailed Data Flow**

1.  **Symptom Intake (Multi-Modal)**
    *   **Voice:** User speaks symptoms. The browser captures audio (MediaRecorder API) and sends a Blob to `/api/stt`.
    *   **Analysis:** IBM Watson STT converts audio to text using the Broadband model for high accuracy.
    *   **Text:** Alternatively, user types directly into the chat interface.

2.  **Intelligent Processing (The Logic Core)**
    *   The standardized text is sent to `/api/analyze`.
    *   The system constructs a secure, prompt-engineered request to **IBM Granite (via Watsonx.ai)**.
    *   **Safety Check:** The model first scans for emergency keywords (e.g., "heart attack", "difficulty breathing"). If detected, the `urgency_level` is set to "Emergency" overriding other logic.
    *   **Structuring:** Granite processes the unstructured text and returns a strict JSON object containing the clinical analysis, causes, and advice.

3.  **Contextual Enrichment (External Verification)**
    *   Once the "Probable Cause" is identified (e.g., "Influenza"), the frontend automatically triggers `/api/scrape/who`.
    *   This API dynamically searches the **World Health Organization (WHO)** website for that specific condition.
    *   Real-time data (Overview, Symptoms, Prevention) is scraped, cited, and presented in a "WHO Insight" card, ensuring the user has access to official global health standards.

4.  **Response Delivery & Accessibility**
    *   **Visual:** The analysis is displayed with color-coded urgency badges (Red/Orange/Green).
    *   **Auditory:** The user can click "Read Analysis". The text is sent to `/api/tts`, where **IBM Watson TTS** generates a natural-sounding audio file which plays back to the user.

---

## 4. IBM Technology Stack
This project is built on the robust foundation of **IBM Cloud** and **IBM WatsonX** services.

### **1. IBM Granite (via WatsonX.ai)**
*   **Role:** The "Brain" of the application.
*   **Implementation:** We utilize the `ibm/granite-3-8b-instruct` model via the WatsonX API.
*   **Function:** 
    *   Receives natural language symptom descriptions.
    *   Processes the input against a strict "Medical Agent" system prompt.
    *   Generates a structured JSON response containing:
        *   Clinical Analysis
        *   Probable Causes
        *   Urgency Assessment
        *   Actionable Home Remedies
*   **Why Granite?** Its high reasoning capability ensures the medical advice is logical, context-aware, and strictly adheres to safety guidelines (prioritizing emergencies).

### **2. IBM Watson Speech-to-Text (STT)**
*   **Role:** Voice Input Interface.
*   **Implementation:** Uses the `en-US_BroadbandModel` via IBM Cloud STT API.
*   **Function:** Converts user voice recordings directly into text, enabling hands-free interaction for users who may be in pain or unable to type.

### **3. IBM Watson Text-to-Speech (TTS)**
*   **Role:** Accessibility & Empathy.
*   **Implementation:** Uses the `en-US_AllisonV3Voice` (Expressive Neural Voice) via IBM Cloud TTS API.
*   **Function:** Reads the medical analysis aloud in a soothing, clear voice, making the information accessible to visually impaired users or those who prefer listening.

---

## 4. Key Application Features
*   **Real-time Analysis:** Instant feedback on health concerns.
*   **Visual Urgency Indicators:** Color-coded badges (e.g., Red for Emergency, Green for Low) for immediate visual cues.
*   **WHO Integration:** A focused "WHO Insight" card appears dynamically, linking users to verified external sources relevant to their specific condition.
*   **Privacy-First:** No personal data is stored persistently; the session is ephemeral.
*   **Responsive UI:** A geometric, modern interface that works seamlessly on desktop and mobile.

## 5. Implementation Details
*   **Frontend:** Next.js (React) for a fast, server-side rendered application.
*   **Styling:** Tailwind CSS with a custom "Geometric Background" for a premium feel.
*   **API Layer:** Next.js API Routes (`/api/analyze`, `/api/stt`, `/api/tts`) act as secure gateways to IBM Cloud services, protecting API keys.
