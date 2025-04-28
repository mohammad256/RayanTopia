// Backend (server.js)
const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Rate limiting (simple in-memory implementation)
const rateLimits = new Map();

app.post('/api/generate', async (req, res) => {
    try {
        const apiKey = req.headers.authorization?.split(' ')[1];
        const { model, prompt } = req.body;

        // Validate inputs
        if (!apiKey) return res.status(401).json({ error: "API key required" });
        if (!model || !prompt) return res.status(400).json({ error: "Missing parameters" });

        // Rate limiting
        const limit = 10; // Requests per minute
        if (!rateLimits.has(apiKey)) {
            rateLimits.set(apiKey, { count: 0, lastReset: Date.now() });
        }

        const userLimit = rateLimits.get(apiKey);
        if (Date.now() - userLimit.lastReset > 60000) {
            userLimit.count = 0;
            userLimit.lastReset = Date.now();
        }

        if (userLimit.count >= limit) {
            return res.status(429).json({ error: "Rate limit exceeded" });
        }
        userLimit.count++;

        // Initialize Gemini with user's API key
        const genAI = new GoogleGenerativeAI(apiKey);
        const modelInstance = genAI.getGenerativeModel({ model });

        // Generate content
        const result = await modelInstance.generateContent(prompt);
        const response = await result.response;
        
        res.json({ 
            content: response.text(),
            usage: {
                promptTokens: response.usageMetadata?.promptTokenCount,
                responseTokens: response.usageMetadata?.candidatesTokenCount
            }
        });

    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ 
            error: "Generation failed",
            details: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});