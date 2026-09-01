require("dotenv").config();

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { GoogleGenAI } = require("@google/genai");

const app = express();

const PORT = process.env.PORT || 3000;
const ACCESS_CODE =
    process.env.QUANTUM_ACCESS_CODE || "Quantum2026Sih";


// =====================================================
// GEMINI
// =====================================================

if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️ GEMINI_API_KEY is missing.");
}

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});


// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
    express.json({
        limit: "15mb"
    })
);

app.use(
    express.urlencoded({
        extended: true
    })
);

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// =====================================================
// SESSION STORAGE
// =====================================================

const sessions = new Map();

function createSession() {

    const token =
        crypto.randomBytes(32).toString("hex");

    sessions.set(token, {

        createdAt: Date.now(),

        messages: [],

        memory: {
            name: null,
            crops: [],
            quantity: null,
            quantityUnit: "kg",
            location: null,
            quality: null,
            price: null,
            availability: null,
            packaging: null
        },

        listings: [],

        calculations: [],

        preferences: {
            language: "English"
        }

    });

    return token;
}


function getSession(req) {

    const token =
        req.headers["x-quantum-access"];

    if (!token) {
        return null;
    }

    return sessions.get(token) || null;
}


function requireAccess(req, res, next) {

    const session =
        getSession(req);

    if (!session) {

        return res.status(401).json({

            success: false,

            message:
                "Quantum Krishi access required."

        });

    }

    req.quantumSession =
        session;

    next();
}


// =====================================================
// ACCESS
// =====================================================

app.post(
    "/verify-access",
    (req, res) => {

        const code =
            String(
                req.body.code || ""
            ).trim();


        if (!code) {

            return res.status(400).json({

                success: false,

                message:
                    "Please enter an access code."

            });

        }


        if (code !== ACCESS_CODE) {

            return res.status(401).json({

                success: false,

                message:
                    "Incorrect Quantum Krishi access code."

            });

        }


        const token =
            createSession();


        res.json({

            success: true,

            token

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

            success: true,

            status: "online",

            service: "Quantum Krishi",

            version: "2.0",

            aiConfigured:
                Boolean(
                    process.env.GEMINI_API_KEY
                ),

            sessions:
                sessions.size,

            timestamp:
                new Date().toISOString()

        });

    }
);


// =====================================================
// MEMORY EXTRACTION
// =====================================================

function updateMemory(
    session,
    text
) {

    if (!text) {
        return;
    }


    const lower =
        text.toLowerCase();


    // -------------------------------------------------
    // NAME
    // -------------------------------------------------

    const nameMatch =
        text.match(
            /(?:my name is|i am|i'm|name[:\s]+)([A-Za-z][A-Za-z .'-]{1,40})/i
        );


    if (nameMatch) {

        session.memory.name =
            nameMatch[1].trim();

    }


    // -------------------------------------------------
    // QUANTITY
    // -------------------------------------------------

    const quantityMatch =
        text.match(
            /(\d+(?:\.\d+)?)\s*(kg|kgs|kilograms|ton|tons|tonne|tonnes)/i
        );


    if (quantityMatch) {

        let quantity =
            parseFloat(
                quantityMatch[1]
            );


        const unit =
            quantityMatch[2]
                .toLowerCase();


        if (
            unit.includes("ton")
        ) {

            quantity *= 1000;

        }


        session.memory.quantity =
            quantity;

        session.memory.quantityUnit =
            "kg";

    }


    // -------------------------------------------------
    // PRICE
    // -------------------------------------------------

    const priceMatch =
        text.match(
            /(?:₹|rs\.?|rupees?)\s*(\d+(?:\.\d+)?)\s*(?:per\s*kg|\/\s*kg)?/i
        )
        ||
        text.match(
            /(\d+(?:\.\d+)?)\s*(?:₹|rs\.?|rupees?)\s*(?:per\s*kg|\/\s*kg)?/i
        );


    if (priceMatch) {

        session.memory.price =
            parseFloat(
                priceMatch[1] ||
                priceMatch[2]
            );

    }


    // -------------------------------------------------
    // LOCATION
    // -------------------------------------------------

    const locationMatch =
        text.match(
            /(?:in|at|near|from|location[:\s]+)([A-Za-z][A-Za-z\s,-]{2,50})/i
        );


    if (locationMatch) {

        let location =
            locationMatch[1]
                .trim();


        location =
            location.replace(
                /\s+(and|with|for|ready|want|i|my|the)\b.*$/i,
                ""
            )
            .trim();


        if (location.length >= 3) {

            session.memory.location =
                location;

        }

    }


    // -------------------------------------------------
    // AVAILABILITY
    // -------------------------------------------------

    if (
        lower.includes("tomorrow")
    ) {

        session.memory.availability =
            "Tomorrow";

    } else if (
        lower.includes("today")
    ) {

        session.memory.availability =
            "Today";

    } else if (
        lower.includes("ready")
    ) {

        session.memory.availability =
            "Ready for sale";

    }


    // -------------------------------------------------
    // QUALITY
    // -------------------------------------------------

    const gradeMatch =
        text.match(
            /(?:grade|quality)\s*[:\-]?\s*([A-Za-z0-9]+)/i
        );


    if (gradeMatch) {

        session.memory.quality =
            gradeMatch[1].toUpperCase();

    }


    // -------------------------------------------------
    // PACKAGING
    // -------------------------------------------------

    const packagingMatch =
        text.match(
            /(?:packaging|packed in|bags?)\s*[:\-]?\s*([A-Za-z0-9 .'-]{2,40})/i
        );


    if (packagingMatch) {

        session.memory.packaging =
            packagingMatch[1].trim();

    }


    // -------------------------------------------------
    // CROPS
    // -------------------------------------------------

    const cropMap = {

        rice: "Rice",

        wheat: "Wheat",

        tomato: "Tomatoes",
        tomatoes: "Tomatoes",

        potato: "Potatoes",
        potatoes: "Potatoes",

        onion: "Onions",
        onions: "Onions",

        maize: "Maize",
        corn: "Corn",

        cabbage: "Cabbage",

        cauliflower: "Cauliflower",

        brinjal: "Brinjal",
        eggplant: "Eggplant",

        chilli: "Chilli",
        chillies: "Chilli",

        pepper: "Pepper",

        cotton: "Cotton",

        sugarcane: "Sugarcane",

        banana: "Banana",

        mango: "Mango",

        apple: "Apple",

        pulses: "Pulses",

        lentils: "Lentils",

        mustard: "Mustard",

        groundnut: "Groundnut",

        soybean: "Soybean",

        chickpea: "Chickpea",

        gram: "Gram"

    };


    for (
        const [keyword, cropName]
        of Object.entries(cropMap)
    ) {

        if (
            lower.includes(keyword)
        ) {

            if (
                !session.memory.crops.includes(
                    cropName
                )
            ) {

                session.memory.crops.push(
                    cropName
                );

            }

        }

    }

}


// =====================================================
// SYSTEM INSTRUCTION
// =====================================================

const SYSTEM_INSTRUCTION = `

You are Quantum, the AI assistant inside Quantum Krishi.

Quantum Krishi is an advanced farmer-focused digital agriculture platform.

Your purpose is to help farmers make better decisions about:

• Crop health
• Pest and disease problems
• Crop image analysis
• Farming practices
• Irrigation
• Soil management
• Weather-related decisions
• Market intelligence
• Produce selling
• Marketplace listings
• Buyer preparation
• Logistics
• Transportation
• Earnings calculations
• Government schemes
• Farmer education
• Regional language communication

IMPORTANT:

Use simple, practical language.

Do not unnecessarily use complicated technical terms.

If technical terminology is required, explain it simply.

Never pretend that you have live information unless it has actually been supplied.

Never invent:

• buyers
• market prices
• weather conditions
• government scheme availability
• transportation availability
• agricultural statistics

Clearly label estimates as estimates.

For crop images:

Explain:

1. What you can see
2. Possible problem
3. Possible causes
4. Immediate actions
5. Prevention
6. Uncertainty

Image analysis is advisory and not a laboratory diagnosis.

For chemicals and pesticides:

Do not provide dangerous or reckless instructions.

Tell the farmer to follow the product label and local agricultural guidance.

MARKETPLACE:

When a farmer wants to sell produce, collect:

• crop
• quantity
• location
• quality
• expected price
• availability
• packaging

Do not invent missing information.

Ask only for missing information.

When enough information is available, summarize the proposed listing.

EARNINGS:

If quantity and price are available:

estimated total =
quantity × price

Clearly call it an estimate.

MEMORY:

Use the farmer information supplied during the current session.

Do not claim to remember information that was never provided.

LANGUAGE:

Respond in the requested language.

Be respectful and farmer-friendly.

Keep answers structured.

Use headings and bullet points where useful.

`;


// =====================================================
// AI RESPONSE HELPER
// =====================================================

async function generateAIResponse({
    message,
    language,
    image,
    memory
}) {

    const memoryText =
        JSON.stringify(
            memory,
            null,
            2
        );


    const prompt = `

Requested language:
${language}

Current farmer information:
${memoryText}

Farmer message:
${message}

Respond as Quantum Krishi.

If this is a selling/listing request:

Use known information.

Identify missing information.

Ask only for information that is actually missing.

If all important listing information exists,
provide a clean marketplace listing summary.

If this is an earnings question,
show the calculation clearly.

If a crop image is attached,
analyze only visible evidence and clearly state uncertainty.

`;

    const parts = [

        {
            text: prompt
        }

    ];


    if (
        image &&
        image.data &&
        image.mimeType
    ) {

        parts.push({

            inlineData: {

                mimeType:
                    image.mimeType,

                data:
                    image.data

            }

        });

    }


    const result =
        await ai.models.generateContent({

            model:
                "gemini-3.5-flash",

            contents: [

                {

                    role: "user",

                    parts

                }

            ],

            config: {

                systemInstruction:
                    SYSTEM_INSTRUCTION,

                temperature:
                    0.35

            }

        });


    return (
        result.text ||
        "Quantum could not generate a response right now."
    );

}


// =====================================================
// CHAT
// =====================================================

app.post(
    "/chat",
    requireAccess,
    async (req, res) => {

        const session =
            req.quantumSession;


        const message =
            String(
                req.body.message || ""
            ).trim();


        const language =
            String(
                req.body.language ||
                "English"
            );


        const image =
            req.body.image ||
            null;


        if (
            !message &&
            !image
        ) {

            return res.status(400).json({

                success: false,

                reply:
                    "Please send a message or crop image."

            });

        }


        session.preferences.language =
            language;


        updateMemory(
            session,
            message
        );


        session.messages.push({

            role: "user",

            content:
                message,

            timestamp:
                Date.now()

        });


        try {

            const reply =
                await generateAIResponse({

                    message:
                        message ||
                        "Please analyze this crop image.",

                    language,

                    image,

                    memory:
                        session.memory

                });


            session.messages.push({

                role: "assistant",

                content:
                    reply,

                timestamp:
                    Date.now()

            });


            if (
                session.messages.length >
                50
            ) {

                session.messages =
                    session.messages.slice(
                        -50
                    );

            }


            res.json({

                success: true,

                reply,

                memory:
                    session.memory,

                timestamp:
                    new Date().toISOString()

            });

        } catch (error) {

            console.error(
                "Gemini error:",
                error
            );


            res.status(500).json({

                success: false,

                reply:
                    "Quantum is temporarily unable to connect to the AI service. Please check your Gemini API key and server."

            });

        }

    }
);


// =====================================================
// MEMORY
// =====================================================

app.get(
    "/memory",
    requireAccess,
    (req, res) => {

        res.json({

            success: true,

            memory:
                req.quantumSession.memory

        });

    }
);


// =====================================================
// CHAT HISTORY
// =====================================================

app.get(
    "/chat-history",
    requireAccess,
    (req, res) => {

        res.json({

            success: true,

            messages:
                req.quantumSession.messages

        });

    }
);


// =====================================================
// CLEAR CHAT
// =====================================================

app.post(
    "/clear-chat",
    requireAccess,
    (req, res) => {

        const session =
            req.quantumSession;


        session.messages = [];


        session.memory = {

            name: null,

            crops: [],

            quantity: null,

            quantityUnit: "kg",

            location: null,

            quality: null,

            price: null,

            availability: null,

            packaging: null

        };


        session.listings = [];


        session.calculations = [];


        res.json({

            success: true

        });

    }
);


// =====================================================
// EARNINGS CALCULATOR
// =====================================================

app.post(
    "/calculate-earnings",
    requireAccess,
    (req, res) => {

        const quantity =
            Number(
                req.body.quantity
            );


        const price =
            Number(
                req.body.price
            );


        if (
            !Number.isFinite(quantity) ||
            !Number.isFinite(price) ||
            quantity <= 0 ||
            price < 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Please provide a valid quantity and price."

            });

        }


        const gross =
            quantity * price;


        const calculation = {

            id:
                crypto.randomUUID(),

            quantity,

            unit:
                "kg",

            pricePerKg:
                price,

            estimatedGrossValue:
                gross,

            createdAt:
                new Date().toISOString()

        };


        req.quantumSession.calculations.push(
            calculation
        );


        res.json({

            success: true,

            calculation

        });

    }
);


// =====================================================
// GET CALCULATIONS
// =====================================================

app.get(
    "/calculations",
    requireAccess,
    (req, res) => {

        res.json({

            success: true,

            calculations:
                req.quantumSession.calculations

        });

    }
);


// =====================================================
// MARKETPLACE
// =====================================================

app.get(
    "/marketplace/listings",
    requireAccess,
    (req, res) => {

        res.json({

            success: true,

            listings:
                req.quantumSession.listings

        });

    }
);


// =====================================================
// CREATE LISTING
// =====================================================

app.post(
    "/marketplace/listings",
    requireAccess,
    (req, res) => {

        const session =
            req.quantumSession;


        const crop =
            String(
                req.body.crop || ""
            ).trim();


        const quantity =
            Number(
                req.body.quantity
            );


        const location =
            String(
                req.body.location || ""
            ).trim();


        const quality =
            String(
                req.body.quality ||
                "Not specified"
            ).trim();


        const price =
            Number(
                req.body.price
            );


        const availability =
            String(
                req.body.availability ||
                "Not specified"
            ).trim();


        const packaging =
            String(
                req.body.packaging ||
                "Not specified"
            ).trim();


        if (
            !crop ||
            !Number.isFinite(quantity) ||
            quantity <= 0 ||
            !location ||
            !Number.isFinite(price) ||
            price < 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Crop, valid quantity, location and valid price are required."

            });

        }


        const listing = {

            id:
                crypto.randomUUID(),

            crop,

            quantity,

            unit:
                "kg",

            location,

            quality,

            price,

            availability,

            packaging,

            estimatedTotalValue:
                quantity * price,

            status:
                "ACTIVE",

            createdAt:
                new Date().toISOString()

        };


        session.listings.push(
            listing
        );


        res.json({

            success: true,

            listing

        });

    }
);


// =====================================================
// UPDATE LISTING
// =====================================================

app.put(
    "/marketplace/listings/:id",
    requireAccess,
    (req, res) => {

        const session =
            req.quantumSession;


        const listing =
            session.listings.find(
                item =>
                    item.id ===
                    req.params.id
            );


        if (!listing) {

            return res.status(404).json({

                success: false,

                message:
                    "Listing not found."

            });

        }


        const allowedFields = [

            "crop",

            "location",

            "quality",

            "availability",

            "packaging"

        ];


        for (
            const field
            of allowedFields
        ) {

            if (
                req.body[field] !==
                undefined
            ) {

                listing[field] =
                    String(
                        req.body[field]
                    ).trim();

            }

        }


        if (
            req.body.quantity !==
            undefined
        ) {

            const quantity =
                Number(
                    req.body.quantity
                );


            if (
                !Number.isFinite(quantity) ||
                quantity <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid quantity."

                });

            }


            listing.quantity =
                quantity;

        }


        if (
            req.body.price !==
            undefined
        ) {

            const price =
                Number(
                    req.body.price
                );


            if (
                !Number.isFinite(price) ||
                price < 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid price."

                });

            }


            listing.price =
                price;

        }


        listing.estimatedTotalValue =
            listing.quantity *
            listing.price;


        listing.updatedAt =
            new Date().toISOString();


        res.json({

            success: true,

            listing

        });

    }
);


// =====================================================
// CONFIRM LISTING
// =====================================================

app.post(
    "/marketplace/listings/:id/confirm",
    requireAccess,
    (req, res) => {

        const session =
            req.quantumSession;


        const listing =
            session.listings.find(
                item =>
                    item.id ===
                    req.params.id
            );


        if (!listing) {

            return res.status(404).json({

                success: false,

                message:
                    "Listing not found."

            });

        }


        listing.status =
            "CONFIRMED";


        listing.confirmedAt =
            new Date().toISOString();


        res.json({

            success: true,

            listing

        });

    }
);


// =====================================================
// DELETE LISTING
// =====================================================

app.delete(
    "/marketplace/listings/:id",
    requireAccess,
    (req, res) => {

        const session =
            req.quantumSession;


        const before =
            session.listings.length;


        session.listings =
            session.listings.filter(
                listing =>
                    listing.id !==
                    req.params.id
            );


        if (
            session.listings.length ===
            before
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Listing not found."

            });

        }


        res.json({

            success: true

        });

    }
);


// =====================================================
// SESSION INFO
// =====================================================

app.get(
    "/session",
    requireAccess,
    (req, res) => {

        const session =
            req.quantumSession;


        res.json({

            success: true,

            session: {

                createdAt:
                    session.createdAt,

                messageCount:
                    session.messages.length,

                listingCount:
                    session.listings.length,

                calculationCount:
                    session.calculations.length,

                language:
                    session.preferences.language

            }

        });

    }
);


// =====================================================
// LOGOUT
// =====================================================

app.post(
    "/logout",
    requireAccess,
    (req, res) => {

        const token =
            req.headers["x-quantum-access"];


        sessions.delete(token);


        res.json({

            success: true

        });

    }
);


// =====================================================
// CLEAN OLD SESSIONS
// =====================================================

setInterval(
    () => {

        const MAX_AGE =
            24 * 60 * 60 * 1000;


        const now =
            Date.now();


        for (
            const [
                token,
                session
            ]
            of sessions.entries()
        ) {

            if (
                now -
                session.createdAt >
                MAX_AGE
            ) {

                sessions.delete(
                    token
                );

            }

        }

    },
    60 * 60 * 1000
);

// =====================================================
// FALLBACK
// =====================================================

app.use((req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});

// =====================================================
// START SERVER
// =====================================================

app.listen(
    PORT,
    () => {

        console.log("");

        console.log(
            "🌾 ========================================"
        );

        console.log(
            "🌾       QUANTUM KRISHI SERVER 2.0"
        );

        console.log(
            "🌾 ========================================"
        );

        console.log(
            `🌐 http://localhost:${PORT}`
        );

        console.log(
            "🔐 Private access: ENABLED"
        );

        console.log(
            `🤖 Gemini AI: ${
                process.env.GEMINI_API_KEY
                    ? "CONFIGURED"
                    : "MISSING"
            }`
        );

        console.log(
            "🧠 Session memory: ENABLED"
        );

        console.log(
            "🛒 Marketplace: ENABLED"
        );

        console.log(
            "💰 Earnings calculator: ENABLED"
        );

        console.log(
            "📷 Image analysis: ENABLED"
        );

        console.log(
            "🎤 Voice-compatible frontend: ENABLED"
        );

        console.log(
            "🌐 Multilingual support: ENABLED"
        );

        console.log(
            "🌾 Server ready."
        );

        console.log("");

    }
);