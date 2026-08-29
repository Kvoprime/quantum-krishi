const express = require("express");
const dotenv = require("dotenv");
const crypto = require("crypto");
const { GoogleGenAI } = require("@google/genai");

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;

// =====================================================
// PRIVATE ACCESS
// =====================================================

const ACCESS_CODE =
    process.env.ACCESS_CODE || "";


// =====================================================
// GEMINI
// =====================================================

const MODEL =
    process.env.GEMINI_MODEL ||
    "gemini-3.5-flash-lite";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});


// =====================================================
// ACCESS TOKENS
// =====================================================

const activeTokens = new Set();


// =====================================================
// SERVER CONFIG
// =====================================================

app.use(
    express.json({
        limit: "20mb"
    })
);

app.use(express.static("public"));


// =====================================================
// VERIFY ACCESS CODE
// =====================================================

app.post(
    "/verify-access",
    (req, res) => {

        const code =
            String(req.body.code || "").trim();


        if (!ACCESS_CODE) {

            return res.status(500).json({

                success: false,

                message:
                    "ACCESS_CODE is not configured on the server."

            });

        }


        if (code !== ACCESS_CODE) {

            return res.status(401).json({

                success: false,

                message:
                    "Incorrect access code."

            });

        }


        const token =
            crypto
                .randomBytes(32)
                .toString("hex");


        activeTokens.add(token);


        console.log(
            "New Quantum Krishi access session created."
        );


        return res.json({

            success: true,

            token: token

        });

    }
);


// =====================================================
// ACCESS MIDDLEWARE
// =====================================================

function requireAccess(req, res, next) {

    const token =
        req.headers["x-quantum-access"];


    if (
        !token ||
        !activeTokens.has(token)
    ) {

        return res.status(401).json({

            reply:
                "Access required. Please enter the Quantum Krishi access code."

        });

    }


    next();

}


// =====================================================
// QUANTUM KRISHI SYSTEM INSTRUCTION
// =====================================================

const SYSTEM_INSTRUCTION = `
You are Quantum, the AI assistant inside Quantum Krishi.

Quantum Krishi is a smart agricultural platform designed to help farmers get better access to:

- Agricultural information
- Crop health support
- Markets
- Buyers
- Logistics
- Agricultural planning
- Government agricultural support

Your goal is to make farming support:

- Simple
- Accessible
- Practical
- Multilingual
- Transparent
- Farmer-friendly

Be:

- Friendly
- Patient
- Professional
- Practical
- Trustworthy
- Encouraging

Quantum should feel like a helpful agricultural companion.

Use simple language.

Avoid unnecessary technical terminology.

Keep answers reasonably concise and useful.


=====================================================
LANGUAGE
=====================================================

The application may provide a selected language.

When a selected language is provided, ALWAYS answer in that language.

Supported languages include:

English
Hindi
Bengali
Tamil
Telugu
Marathi

If no language is provided, detect the language used by the farmer.

Do not unnecessarily mix languages.


=====================================================
FARMER ASSISTANCE
=====================================================

Help farmers with:

- Crop problems
- Crop health
- Pest identification
- Disease identification
- Farming practices
- Produce listing
- Selling decisions
- Market information
- Buyer requirements
- Logistics
- Transportation
- Demand estimates
- Government schemes
- Agricultural planning


=====================================================
CROP IMAGE ANALYSIS
=====================================================

When an image is provided:

Analyze ONLY what can reasonably be observed.

Clearly explain:

1. Possible crop problem
2. Visible symptoms
3. Possible causes
4. Immediate steps
5. Prevention
6. When professional agricultural advice should be sought

Never claim that an image gives a 100% confirmed diagnosis.

Use phrases such as:

"Possible issue"
"Likely"
"Based on the visible symptoms"
"This image alone cannot confirm the diagnosis"

If the image is unclear, say so.

Never pretend to have laboratory confirmation.

Never recommend dangerous or illegal chemical use.

If suggesting a pesticide or treatment:

- Recommend following the product label.
- Encourage local agricultural guidance.
- Do not provide unsafe chemical mixing instructions.


=====================================================
MARKETPLACE
=====================================================

If marketplace data is supplied by the application, use ONLY that supplied information.

You may use supplied data to:

- Compare listings
- Match farmers and buyers
- Compare prices
- Compare quantities
- Consider distance
- Consider logistics

NEVER invent:

- Buyers
- Farmers
- Orders
- Prices
- Listings
- Market availability
- Transportation availability
- Buyer requirements
- Sales
- Marketplace activity

Do not claim that a specific buyer is currently looking for produce unless the application supplies that information.

Do not claim that a listing has been published unless the application confirms it.


=====================================================
SELLING ASSISTANCE
=====================================================

When a farmer wants to sell produce, collect:

- Crop
- Quantity
- Location
- Expected price
- Availability date
- Quality or grade
- Packaging when relevant

Help the farmer prepare a professional listing.

Do NOT claim the listing has been published.

Say that the application must confirm publication.


=====================================================
MARKET PRICES
=====================================================

Never invent a current market price.

If real-time market data is NOT supplied:

Say clearly:

"I don't have verified live market data right now."

You may explain general factors affecting prices.

Never guarantee a selling price.


=====================================================
DEMAND FORECASTING
=====================================================

When prediction data is supplied:

Explain it as an estimate.

Use phrases such as:

"Estimated demand"
"Predicted demand"
"Based on the available data"

Never guarantee:

- Future demand
- Future prices
- Profit


=====================================================
LOGISTICS
=====================================================

Help farmers think about:

- Quantity
- Distance
- Vehicle capacity
- Packaging
- Loading
- Unloading
- Timing
- Product protection

Do not claim that a vehicle or transporter is available unless the application provides that information.


=====================================================
SAFETY
=====================================================

Do not pretend to be a certified agricultural officer.

Do not guarantee:

- Crop diagnosis
- Crop yield
- Prices
- Profits
- Buyers
- Sales
- Future demand

Clearly distinguish between:

Confirmed information
Estimates
Predictions
Suggestions


=====================================================
VOICE USERS
=====================================================

Keep spoken responses natural.

Use short sentences when appropriate.

Explain difficult agricultural terms simply.


=====================================================
IDENTITY
=====================================================

Your name is Quantum.

You are the AI assistant inside Quantum Krishi.

You exist to help farmers make better agricultural decisions and improve access to agricultural markets and services.

Never say that you are another AI assistant.
`;


// =====================================================
// CONVERSATION MEMORY
// =====================================================

let conversation = [];


// =====================================================
// CLEAN RESPONSE
// =====================================================

function cleanResponse(text) {

    if (!text) {

        return "I couldn't generate a response right now.";

    }


    return text

        .replace(/\$\$(.*?)\$\$/gs, "$1")

        .replace(/\\\[(.*?)\\\]/gs, "$1")

        .replace(/\\\((.*?)\\\)/gs, "$1")

        .replace(/\$(.*?)\$/gs, "$1")

        .replace(
            /\\frac\{([^{}]*)\}\{([^{}]*)\}/g,
            "($1/$2)"
        )

        .replace(
            /\\sqrt\{([^{}]*)\}/g,
            "sqrt($1)"
        )

        .replace(
            /\\text\{([^{}]*)\}/g,
            "$1"
        )

        .replace(
            /\\mathrm\{([^{}]*)\}/g,
            "$1"
        )

        .replace(
            /\\mathbf\{([^{}]*)\}/g,
            "$1"
        )

        .replace(/\\times/g, "×")

        .replace(/\\cdot/g, "·")

        .replace(/\\div/g, "÷")

        .replace(/\\pm/g, "±")

        .replace(/\\leq/g, "≤")

        .replace(/\\geq/g, "≥")

        .replace(/\\neq/g, "≠")

        .replace(/\\infty/g, "∞")

        .replace(/[ \t]+/g, " ")

        .trim();

}


// =====================================================
// RETRY CHECK
// =====================================================

function isRetryableError(error) {

    const message =
        error?.message ||
        JSON.stringify(error) ||
        "";

    return (

        message.includes("503") ||

        message.includes("UNAVAILABLE") ||

        message.includes("temporarily unavailable") ||

        message.includes("high demand") ||

        message.includes("429") ||

        message.includes("RESOURCE_EXHAUSTED") ||

        message.includes("quota")

    );

}


// =====================================================
// WAIT
// =====================================================

function wait(ms) {

    return new Promise(
        resolve => setTimeout(resolve, ms)
    );

}


// =====================================================
// GENERATE AI RESPONSE
// =====================================================

async function generateAIResponse(
    message,
    language = "English",
    imageData = null
) {

    const contents = [];


    for (const item of conversation) {

        contents.push({

            role:
                item.role,

            parts:
                item.parts

        });

    }


    const currentParts = [];


    currentParts.push({

        text:
            message

    });


    if (imageData) {

        currentParts.push({

            inlineData: {

                mimeType:
                    imageData.mimeType,

                data:
                    imageData.data

            }

        });

    }


    contents.push({

        role:
            "user",

        parts:
            currentParts

    });


    const languageInstruction = `

IMPORTANT APPLICATION LANGUAGE:

The farmer selected the language:

${language}

Respond in ${language}.

Do not switch to English unless the farmer asks you to.
`;


    const fullSystemInstruction =
        SYSTEM_INSTRUCTION +
        languageInstruction;


    let lastError = null;


    const maxAttempts = 3;


    for (
        let attempt = 1;
        attempt <= maxAttempts;
        attempt++
    ) {

        try {

            console.log(
                `Gemini request attempt ${attempt}/${maxAttempts}`
            );


            const response =
                await ai.models.generateContent({

                    model:
                        MODEL,

                    contents:
                        contents,

                    config: {

                        systemInstruction:
                            fullSystemInstruction,

                        temperature:
                            0.5,

                        maxOutputTokens:
                            1200

                    }

                });


            if (
                !response ||
                !response.text
            ) {

                throw new Error(
                    "Gemini returned an empty response."
                );

            }


            console.log(
                "Gemini response received successfully."
            );


            return response.text;

        } catch (error) {

            lastError =
                error;


            console.error(
                `Gemini attempt ${attempt} failed:`,
                error.message
            );


            if (
                !isRetryableError(error) ||
                attempt === maxAttempts
            ) {

                break;

            }


            await wait(
                attempt * 1500
            );

        }

    }


    throw lastError;

}


// =====================================================
// CHAT
// =====================================================

app.post(
    "/chat",
    requireAccess,
    async (req, res) => {

        try {

            const userMessage =
                req.body.message;

            const image =
                req.body.image || null;

            const language =
                req.body.language ||
                "English";


            if (
                !userMessage ||
                !userMessage.trim()
            ) {

                return res.status(400).json({

                    reply:
                        "Please enter a message."

                });

            }


            console.log(
                "------------------------------------"
            );

            console.log(
                "User:",
                userMessage
            );

            console.log(
                "Language:",
                language
            );


            if (image) {

                console.log(
                    "Crop image received:",
                    image.mimeType
                );

            }


            const rawReply =
                await generateAIResponse(
                    userMessage,
                    language,
                    image
                );


            const cleanReply =
                cleanResponse(
                    rawReply
                );


            conversation.push({

                role:
                    "user",

                parts: [

                    {
                        text:
                            userMessage
                    }

                ]

            });


            conversation.push({

                role:
                    "model",

                parts: [

                    {
                        text:
                            cleanReply
                    }

                ]

            });


            if (
                conversation.length > 20
            ) {

                conversation =
                    conversation.slice(-20);

            }


            res.json({

                reply:
                    cleanReply,

                language:
                    language

            });


        } catch (error) {

            console.error(
                "CHAT ERROR:",
                error
            );


            const errorMessage =
                error?.message ||
                "";


            if (
                errorMessage.includes("503") ||
                errorMessage.includes("UNAVAILABLE") ||
                errorMessage.includes("high demand")
            ) {

                return res.status(503).json({

                    reply:
                        "Quantum's AI service is temporarily busy. Please try again in a few seconds."

                });

            }


            if (
                errorMessage.includes("429") ||
                errorMessage.includes("quota") ||
                errorMessage.includes("RESOURCE_EXHAUSTED")
            ) {

                return res.status(429).json({

                    reply:
                        "Quantum's AI service has temporarily reached its usage limit. Please wait a little and try again."

                });

            }


            return res.status(500).json({

                reply:
                    "Quantum couldn't connect to the AI service right now. Please check the server terminal."

            });

        }

    }
);


// =====================================================
// CLEAR CHAT
// =====================================================

app.post(
    "/clear-chat",
    requireAccess,
    (req, res) => {

        conversation = [];


        res.json({

            success:
                true,

            memory:
                0

        });

    }
);


// =====================================================
// HEALTH
// =====================================================

app.get(
    "/health",
    (req, res) => {

        res.json({

            status:
                "Quantum Krishi server running",

            ai:
                "Gemini configured",

            model:
                MODEL

        });

    }
);


// =====================================================
// START SERVER
// =====================================================

app.listen(
    PORT,
    () => {

        console.log(
            "======================================"
        );

        console.log(
            "🌾 QUANTUM KRISHI"
        );

        console.log(
            "Smart Farming Companion"
        );

        console.log(
            "======================================"
        );

        console.log(
            `Server running on port ${PORT}`
        );

        console.log(
            `Model: ${MODEL}`
        );

        console.log(
            "Gemini: Connected"
        );

        console.log(
            "Private access: ENABLED"
        );

        console.log(
            "======================================"
        );

    }
);