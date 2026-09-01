const input = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const chatBox = document.getElementById("chat-box");
const clearButton = document.getElementById("clear-button");

const imageButton = document.getElementById("image-button");
const imageInput = document.getElementById("image-input");
const attachmentPreview = document.getElementById("attachment-preview");

const voiceButton = document.getElementById("voice-button");

const languageButton = document.getElementById("language-button");
const languageModal = document.getElementById("language-modal");
const closeLanguage = document.getElementById("close-language");

const languageOptions =
    document.querySelectorAll(".language-option");


// =====================================================
// QUANTUM PRIVATE ACCESS
// =====================================================

let quantumAccessToken =
    localStorage.getItem("quantum_access_token") || null;


// =====================================================
// STATE
// =====================================================

let selectedLanguage = "English";
let selectedImage = null;

let recognition = null;
let isListening = false;
let isSpeaking = false;

let finalTranscript = "";
let shouldKeepListening = false;


// =====================================================
// PRIVATE ACCESS
// =====================================================

async function requestAccessCode() {

    const code =
        prompt(
            "Enter your Quantum Krishi access code:"
        );

    if (!code) {
        return false;
    }

    try {

        const response =
            await fetch(
                "/verify-access",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        code: code.trim()
                    })
                }
            );


        const data =
            await response.json();


        if (
            response.ok &&
            data.success &&
            data.token
        ) {

            quantumAccessToken =
                data.token;


            localStorage.setItem(
                "quantum_access_token",
                quantumAccessToken
            );


            console.log(
                "🌾 Quantum Krishi private access granted."
            );


            return true;

        }


        alert(
            data.message ||
            "Incorrect access code."
        );


        return false;

    } catch (error) {

        console.error(
            "Access verification error:",
            error
        );


        alert(
            "Could not connect to Quantum Krishi server."
        );


        return false;

    }

}


// =====================================================
// ENSURE ACCESS
// =====================================================

async function ensureAccess() {

    if (quantumAccessToken) {
        return true;
    }

    return await requestAccessCode();

}


// =====================================================
// AUTHENTICATED FETCH
// =====================================================

async function quantumFetch(
    url,
    options = {}
) {

    if (!quantumAccessToken) {

        const granted =
            await ensureAccess();

        if (!granted) {

            throw new Error(
                "Access required. Please enter the Quantum Krishi access code."
            );

        }

    }


    const headers =
        options.headers || {};


    headers["x-quantum-access"] =
        quantumAccessToken;


    options.headers =
        headers;


    let response =
        await fetch(
            url,
            options
        );


    // -------------------------------------------------
    // TOKEN EXPIRED / INVALID
    // -------------------------------------------------

    if (response.status === 401) {

        localStorage.removeItem(
            "quantum_access_token"
        );


        quantumAccessToken =
            null;


        const granted =
            await requestAccessCode();


        if (!granted) {

            throw new Error(
                "Access required. Please enter the Quantum Krishi access code."
            );

        }


        headers["x-quantum-access"] =
            quantumAccessToken;


        response =
            await fetch(
                url,
                options
            );

    }


    return response;

}


// =====================================================
// WELCOME SCREEN
// =====================================================

function createWelcome() {

    return `
        <div class="welcome">

            <div class="welcome-icon">
                🌾
            </div>

            <div class="welcome-badge">
                AI FOR SMARTER FARMING
            </div>

            <h2>
                How can Quantum help your farm?
            </h2>

            <p>
                Ask about crops, pests, weather, markets,
                farming practices, government schemes,
                transportation and more.
                You can also speak to Quantum or share a crop photo.
            </p>

            <div class="quick-actions">

                <button
                    class="quick-action"
                    data-message="Help me identify a problem with my crop"
                >
                    <span class="quick-icon">
                        🌱
                    </span>

                    <span>
                        <strong>Crop Help</strong>
                        <small>Identify crop problems</small>
                    </span>
                </button>


                <button
                    class="quick-action"
                    data-message="I want to sell my crop and need help creating a marketplace listing"
                >
                    <span class="quick-icon">
                        💰
                    </span>

                    <span>
                        <strong>Sell Produce</strong>
                        <small>Create a marketplace listing</small>
                    </span>
                </button>


                <button
                    class="quick-action"
                    data-message="What weather information should I consider for farming today?"
                >
                    <span class="quick-icon">
                        🌦️
                    </span>

                    <span>
                        <strong>Weather Advice</strong>
                        <small>Weather-based farming help</small>
                    </span>
                </button>


                <button
                    class="quick-action"
                    data-message="Help me find government schemes that may benefit a farmer"
                >
                    <span class="quick-icon">
                        🏛️
                    </span>

                    <span>
                        <strong>Government Schemes</strong>
                        <small>Discover possible support</small>
                    </span>
                </button>

            </div>

        </div>
    `;

}


// =====================================================
// SCROLL
// =====================================================

function scrollToBottom() {

    chatBox.scrollTop =
        chatBox.scrollHeight;

}


// =====================================================
// FILE → BASE64
// =====================================================

function fileToBase64(file) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();


            reader.onload =
                () => {

                    const result =
                        reader.result;


                    const base64 =
                        result.split(",")[1];


                    resolve(base64);

                };


            reader.onerror =
                () => {

                    reject(
                        new Error(
                            "Could not read image."
                        )
                    );

                };


            reader.readAsDataURL(file);

        }
    );

}


// =====================================================
// MARKETPLACE LISTING DETECTION
// =====================================================

function extractListingDetails(text) {

    if (!text) {
        return null;
    }


    const lower =
        text.toLowerCase();


    const sellingWords = [
        "sell",
        "selling",
        "sale",
        "marketplace",
        "listing",
        "buyer",
        "produce",
        "available"
    ];


    const isSelling =
        sellingWords.some(
            word =>
                lower.includes(word)
        );


    if (!isSelling) {
        return null;
    }


    let quantity = null;


    const quantityMatch =
        text.match(
            /(\d+(?:\.\d+)?)\s*(kg|kgs|kilograms|ton|tons|tonne|tonnes)/i
        );


    if (quantityMatch) {

        let value =
            parseFloat(
                quantityMatch[1]
            );


        const unit =
            quantityMatch[2].toLowerCase();


        if (
            unit.includes("ton")
        ) {

            value =
                value * 1000;

        }


        quantity =
            value;

    }


    let price = null;


    const priceMatch =
        text.match(
            /(?:₹|rs\.?|rupees?)\s*(\d+(?:\.\d+)?)\s*(?:per\s*kg|\/\s*kg)?/i
        )
        ||
        text.match(
            /(\d+(?:\.\d+)?)\s*(?:₹|rs\.?|rupees?)\s*(?:per\s*kg|\/\s*kg)?/i
        );


    if (priceMatch) {

        price =
            parseFloat(
                priceMatch[1] ||
                priceMatch[2]
            );

    }


    const crops = [
        "tomatoes",
        "tomato",
        "potatoes",
        "potato",
        "rice",
        "wheat",
        "onion",
        "onions",
        "maize",
        "corn",
        "cabbage",
        "cauliflower",
        "brinjal",
        "eggplant",
        "chilli",
        "chillies",
        "pepper",
        "cotton",
        "sugarcane",
        "banana",
        "mango",
        "apple"
    ];


    let crop = null;


    for (const item of crops) {

        if (lower.includes(item)) {

            crop =
                item;

            break;

        }

    }


    if (!crop) {
        return null;
    }


    const cropNames = {

        tomatoes: "Tomatoes",
        tomato: "Tomatoes",

        potatoes: "Potatoes",
        potato: "Potatoes",

        rice: "Rice",
        wheat: "Wheat",

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
        apple: "Apple"

    };


    crop =
        cropNames[crop] ||
        crop;


    let grade = null;


    const gradeMatch =
        text.match(
            /grade\s*([a-z0-9]+)/i
        );


    if (gradeMatch) {

        grade =
            "Grade " +
            gradeMatch[1].toUpperCase();

    }


    let location = null;


    const locationMatch =
        text.match(
            /(?:in|at|near|from|location[:\s]+)\s+([A-Za-z][A-Za-z\s-]{2,40})/i
        );


    if (locationMatch) {

        let possibleLocation =
            locationMatch[1]
                .trim();


        possibleLocation =
            possibleLocation.replace(
                /\s+(?:and|with|for|ready|want|i|they)\b.*$/i,
                ""
            )
            .trim();


        if (
            possibleLocation.length >= 3 &&
            possibleLocation.length <= 30
        ) {

            location =
                possibleLocation;

        }

    }


    let availability = null;


    if (
        lower.includes("tomorrow")
    ) {

        availability =
            "Tomorrow";

    } else if (
        lower.includes("today")
    ) {

        availability =
            "Today";

    } else if (
        lower.includes("ready")
    ) {

        availability =
            "Ready for sale";

    }


    return {

        crop,
        quantity,
        grade,
        location,
        price,
        availability

    };

}


// =====================================================
// CREATE LISTING CARD
// =====================================================

function createListingCard(details) {

    if (!details) {
        return null;
    }


    if (
        !details.crop ||
        !details.quantity ||
        !details.price
    ) {

        return null;

    }


    const totalValue =
        details.quantity *
        details.price;


    const location =
        details.location ||
        "Not specified";


    const grade =
        details.grade ||
        "Not specified";


    const availability =
        details.availability ||
        "Not specified";


    const card =
        document.createElement("div");


    card.classList.add(
        "listing-card"
    );


    card.innerHTML = `

        <div class="listing-header">

            <div>

                <span class="listing-label">
                    QUANTUM KRISHI
                </span>

                <h3>
                    🌾 Marketplace Listing Preview
                </h3>

            </div>

            <div class="listing-status">
                DRAFT
            </div>

        </div>


        <div class="listing-grid">

            <div class="listing-item">
                <span>🌱 Crop</span>
                <strong>
                    ${escapeHTML(details.crop)}
                </strong>
            </div>


            <div class="listing-item">
                <span>📦 Quantity</span>
                <strong>
                    ${details.quantity} kg
                </strong>
            </div>


            <div class="listing-item">
                <span>⭐ Quality</span>
                <strong>
                    ${escapeHTML(grade)}
                </strong>
            </div>


            <div class="listing-item">
                <span>📍 Location</span>
                <strong>
                    ${escapeHTML(location)}
                </strong>
            </div>


            <div class="listing-item">
                <span>💰 Expected Price</span>
                <strong>
                    ₹${details.price}/kg
                </strong>
            </div>


            <div class="listing-item">
                <span>📅 Availability</span>
                <strong>
                    ${escapeHTML(availability)}
                </strong>
            </div>

        </div>


        <div class="listing-total">

            <span>
                Estimated Total Value
            </span>

            <strong>
                ₹${totalValue.toLocaleString("en-IN")}
            </strong>

        </div>


        <div class="listing-note">

            ⚠️ This is a preview.
            The listing will only be published after confirmation.

        </div>


        <div class="listing-actions">

            <button
                type="button"
                class="listing-confirm"
            >
                ✅ Confirm Listing
            </button>

            <button
                type="button"
                class="listing-edit"
            >
                ✏️ Edit Details
            </button>

        </div>

    `;


    const confirmButton =
        card.querySelector(
            ".listing-confirm"
        );


    confirmButton.addEventListener(
        "click",
        function() {

            this.disabled =
                true;


            this.textContent =
                "✓ Listing Confirmed";


            const status =
                card.querySelector(
                    ".listing-status"
                );


            if (status) {

                status.textContent =
                    "CONFIRMED";

                status.classList.add(
                    "confirmed"
                );

            }


            const note =
                card.querySelector(
                    ".listing-note"
                );


            if (note) {

                note.innerHTML =
                    "🌾 Listing confirmed in this demo. Connect this button to your marketplace database when the backend is ready.";

            }


            const editButton =
                card.querySelector(
                    ".listing-edit"
                );


            if (editButton) {

                editButton.disabled =
                    true;

            }

        }
    );


    const editButton =
        card.querySelector(
            ".listing-edit"
        );


    editButton.addEventListener(
        "click",
        function() {

            input.value =
                `I want to edit my ${details.crop} listing. Quantity: ${details.quantity} kg, ${details.grade || ""}, Location: ${details.location || ""}, Price: ₹${details.price}/kg, Availability: ${details.availability || ""}.`;


            input.focus();


            input.dispatchEvent(
                new Event("input")
            );

        }
    );


    return card;

}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


// =====================================================
// SHOW LISTING
// =====================================================

function showListingPreview(text) {

    const details =
        extractListingDetails(text);


    if (!details) {
        return;
    }


    const card =
        createListingCard(details);


    if (!card) {
        return;
    }


    chatBox.appendChild(
        card
    );


    scrollToBottom();

}


// =====================================================
// SEND MESSAGE
// =====================================================

async function sendMessage(customMessage = null) {

    const message =
        customMessage !== null
            ? customMessage.trim()
            : input.value.trim();


    if (
        message === "" &&
        !selectedImage
    ) {

        return;

    }


    stopSpeaking();


    const welcome =
        document.querySelector(
            ".welcome"
        );


    if (welcome) {
        welcome.remove();
    }


    // -------------------------------------------------
    // USER MESSAGE
    // -------------------------------------------------

    const userMessage =
        document.createElement("div");


    userMessage.classList.add(
        "message",
        "user"
    );


    if (selectedImage) {

        const imageName =
            document.createElement("div");


        imageName.style.fontWeight =
            "600";


        imageName.style.marginBottom =
            "8px";


        imageName.textContent =
            "📷 Crop image attached";


        userMessage.appendChild(
            imageName
        );

    }


    if (message !== "") {

        const textElement =
            document.createElement("div");


        textElement.textContent =
            message;


        userMessage.appendChild(
            textElement
        );

    }


    chatBox.appendChild(
        userMessage
    );


    // -------------------------------------------------
    // IMAGE
    // -------------------------------------------------

    let imageData = null;


    try {

        if (selectedImage) {

            const base64 =
                await fileToBase64(
                    selectedImage
                );


            imageData = {

                mimeType:
                    selectedImage.type,

                data:
                    base64

            };

        }

    } catch (error) {

        console.error(
            "Image processing error:",
            error
        );


        const errorMessage =
            document.createElement(
                "div"
            );


        errorMessage.classList.add(
            "message",
            "bot"
        );


        errorMessage.textContent =
            "I couldn't read that crop image. Please try another image.";


        chatBox.appendChild(
            errorMessage
        );


        return;

    }


    // -------------------------------------------------
    // CLEAR INPUT
    // -------------------------------------------------

    input.value =
        "";


    input.style.height =
        "43px";


    // -------------------------------------------------
    // BOT MESSAGE
    // -------------------------------------------------

    const botMessage =
        document.createElement("div");


    botMessage.classList.add(
        "message",
        "bot"
    );


    botMessage.textContent =
        "Quantum is analyzing... 🌾";


    chatBox.appendChild(
        botMessage
    );


    scrollToBottom();


    // -------------------------------------------------
    // SERVER
    // -------------------------------------------------

    try {

        const response =
            await quantumFetch(
                "/chat",
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            message:
                                message !== ""
                                    ? message
                                    : "Please analyze this crop image and tell me what problem the plant may have, what symptoms you can see, what I should do now, and how I can prevent the problem.",

                            language:
                                selectedLanguage,

                            image:
                                imageData

                        })

                }
            );


        if (!response.ok) {

            let errorText =
                "Server error";


            try {

                const errorData =
                    await response.json();


                if (errorData.reply) {

                    errorText =
                        errorData.reply;

                }

            } catch (e) {

                console.error(
                    "Could not read server error:",
                    e
                );

            }


            throw new Error(
                errorText
            );

        }


        const data =
            await response.json();


        if (data.reply) {

            botMessage.textContent =
                data.reply;


            scrollToBottom();


            showListingPreview(
                message
            );


            speakText(
                data.reply
            );

        } else {

            botMessage.textContent =
                "Quantum couldn't generate a response right now.";

        }


    } catch (error) {

        console.error(
            "Quantum error:",
            error
        );


        botMessage.textContent =
            error.message &&
            error.message !== "Failed to fetch"
                ? error.message
                : "Quantum couldn't connect to the server. Please check that your server is running.";

    }


    // -------------------------------------------------
    // REMOVE IMAGE
    // -------------------------------------------------

    if (selectedImage) {
        removeImage();
    }


    scrollToBottom();

}


// =====================================================
// SEND BUTTON
// =====================================================

sendButton.addEventListener(
    "click",
    function() {

        sendMessage();

    }
);


// =====================================================
// ENTER TO SEND
// =====================================================

input.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage();

        }

    }
);


// =====================================================
// AUTO GROW
// =====================================================

input.addEventListener(
    "input",
    function() {

        this.style.height =
            "43px";


        this.style.height =
            Math.min(
                this.scrollHeight,
                130
            ) + "px";

    }
);


// =====================================================
// QUICK ACTIONS
// =====================================================

function setupQuickActions() {

    document
        .querySelectorAll(".quick-action")
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function() {

                        sendMessage(
                            this.dataset.message
                        );

                    }
                );

            }
        );

}


setupQuickActions();


// =====================================================
// IMAGE BUTTON
// =====================================================

if (
    imageButton &&
    imageInput
) {

    imageButton.addEventListener(
        "click",
        function() {

            imageInput.click();

        }
    );

}


// =====================================================
// IMAGE SELECTED
// =====================================================

if (imageInput) {

    imageInput.addEventListener(
        "change",
        function() {

            const file =
                this.files[0];


            if (!file) {
                return;
            }


            if (
                !file.type.startsWith(
                    "image/"
                )
            ) {

                alert(
                    "Please select an image file."
                );


                this.value =
                    "";


                return;

            }


            if (
                file.size >
                10 * 1024 * 1024
            ) {

                alert(
                    "Please choose an image smaller than 10 MB."
                );


                this.value =
                    "";


                return;

            }


            selectedImage =
                file;


            const imageURL =
                URL.createObjectURL(
                    file
                );


            if (attachmentPreview) {

                attachmentPreview.innerHTML = `

                    <div class="attachment-card">

                        <img
                            src="${imageURL}"
                            alt="Crop preview"
                        >

                        <div class="attachment-info">

                            <strong>
                                ${escapeHTML(file.name)}
                            </strong>

                            <span>
                                Crop photo attached
                            </span>

                        </div>

                        <button
                            class="remove-attachment"
                            id="remove-attachment"
                            type="button"
                        >
                            ✕
                        </button>

                    </div>

                `;


                attachmentPreview.classList.add(
                    "active"
                );


                const removeButton =
                    document.getElementById(
                        "remove-attachment"
                    );


                if (removeButton) {

                    removeButton.addEventListener(
                        "click",
                        removeImage
                    );

                }

            }

        }
    );

}


// =====================================================
// REMOVE IMAGE
// =====================================================

function removeImage() {

    selectedImage =
        null;


    if (imageInput) {

        imageInput.value =
            "";

    }


    if (attachmentPreview) {

        attachmentPreview.innerHTML =
            "";


        attachmentPreview.classList.remove(
            "active"
        );

    }

}

// =====================================================
// VOICE RECOGNITION
// =====================================================

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

let microphoneStream = null;


// -----------------------------------------------------
// GET MICROPHONE PERMISSION
// -----------------------------------------------------

async function requestMicrophonePermission() {

    if (!navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia) {

        throw new Error(
            "Microphone access is not supported by this browser."
        );

    }

    try {

        microphoneStream =
            await navigator.mediaDevices.getUserMedia({
                audio: true
            });

        console.log(
            "🎤 Microphone permission granted."
        );

        // We only use getUserMedia to confirm access.
        // SpeechRecognition handles the actual speech input.

        microphoneStream
            .getTracks()
            .forEach(track => track.stop());

        microphoneStream = null;

        return true;

    } catch (error) {

        console.error(
            "🎤 Microphone permission error:",
            error
        );

        if (error.name === "NotAllowedError") {

            alert(
                "Microphone permission was denied. Please click the microphone icon in Chrome's address bar and choose Allow."
            );

        } else if (error.name === "NotFoundError") {

            alert(
                "No microphone was found. Please connect or enable a microphone and try again."
            );

        } else {

            alert(
                "Quantum could not access your microphone."
            );

        }

        return false;

    }

}


// -----------------------------------------------------
// CREATE SPEECH RECOGNITION
// -----------------------------------------------------

if (
    SpeechRecognition &&
    voiceButton
) {

    recognition =
        new SpeechRecognition();


    // IMPORTANT:
    // false is more reliable than continuous mode
    // for browser microphone recognition.

    recognition.continuous =
        false;


    recognition.interimResults =
        true;


    recognition.maxAlternatives =
        1;


    recognition.lang =
        getSpeechLanguage(
            selectedLanguage
        );


    // -------------------------------------------------
    // START
    // -------------------------------------------------

    recognition.onstart =
        function() {

            console.log(
                "🎤 Quantum voice recognition started."
            );


            isListening =
                true;


            shouldKeepListening =
                true;


            finalTranscript =
                "";


            voiceButton.classList.add(
                "listening"
            );


            voiceButton.textContent =
                "🔴";


            input.placeholder =
                `Listening in ${selectedLanguage}...`;

        };


    // -------------------------------------------------
    // RESULT
    // -------------------------------------------------

    recognition.onresult =
        function(event) {

            console.log(
                "🎤 Speech result received:",
                event
            );


            let transcript =
                "";


            for (
                let i = event.resultIndex;
                i < event.results.length;
                i++
            ) {

                const result =
                    event.results[i];


                const text =
                    result[0].transcript;


                transcript +=
                    text;


                if (
                    result.isFinal
                ) {

                    finalTranscript +=
                        text + " ";

                }

            }


            // Show the recognized speech immediately.

            const currentText =
                (
                    finalTranscript +
                    transcript
                ).trim();


            if (currentText !== "") {

                input.value =
                    currentText;


                input.dispatchEvent(
                    new Event("input")
                );


                input.focus();


                console.log(
                    "📝 Recognized text:",
                    currentText
                );

            }

        };


    // -------------------------------------------------
    // ERROR
    // -------------------------------------------------

    recognition.onerror =
        function(event) {

            console.error(
                "🎤 Speech recognition error:",
                event.error
            );


            isListening =
                false;


            voiceButton.classList.remove(
                "listening"
            );


            voiceButton.textContent =
                "🎤";


            input.placeholder =
                `Ask Quantum in ${selectedLanguage}...`;


            shouldKeepListening =
                false;


            if (
                event.error ===
                "not-allowed"
            ) {

                alert(
                    "Quantum does not have microphone permission. Please allow microphone access for this site in Chrome."
                );

                return;

            }


            if (
                event.error ===
                "audio-capture"
            ) {

                alert(
                    "Quantum cannot access your microphone. Please check that your microphone is connected and not being used exclusively by another application."
                );

                return;

            }


            if (
                event.error ===
                "no-speech"
            ) {

                console.log(
                    "🎤 No speech detected."
                );

                return;

            }


            if (
                event.error ===
                "network"
            ) {

                alert(
                    "Speech recognition could not connect. Please check your internet connection."
                );

                return;

            }


            console.warn(
                "Unhandled speech recognition error:",
                event.error
            );

        };


    // -------------------------------------------------
    // END
    // -------------------------------------------------

    recognition.onend =
        function() {

            console.log(
                "🎤 Quantum voice recognition ended."
            );


            isListening =
                false;


            voiceButton.classList.remove(
                "listening"
            );


            voiceButton.textContent =
                "🎤";


            input.placeholder =
                `Ask Quantum in ${selectedLanguage}...`;


            const message =
                finalTranscript.trim();


            console.log(
                "📝 Final voice message:",
                message
            );


            if (
                message !== "" &&
                shouldKeepListening
            ) {

                shouldKeepListening =
                    false;


                setTimeout(
                    function() {

                        sendMessage(
                            message
                        );

                    },
                    300
                );

            }

        };


    // -------------------------------------------------
    // VOICE BUTTON
    // -------------------------------------------------

    voiceButton.addEventListener(
        "click",
        async function() {

            console.log(
                "🎤 Voice button clicked."
            );


            // -----------------------------------------
            // STOP LISTENING
            // -----------------------------------------

            if (isListening) {

                shouldKeepListening =
                    true;


                try {

                    recognition.stop();

                } catch (error) {

                    console.error(
                        "Could not stop recognition:",
                        error
                    );

                }

                return;

            }


            stopSpeaking();


            finalTranscript =
                "";


            shouldKeepListening =
                true;


            // -----------------------------------------
            // CHECK MICROPHONE FIRST
            // -----------------------------------------

            const microphoneReady =
                await requestMicrophonePermission();


            if (!microphoneReady) {

                shouldKeepListening =
                    false;

                return;

            }


            // -----------------------------------------
            // SET LANGUAGE
            // -----------------------------------------

            recognition.lang =
                getSpeechLanguage(
                    selectedLanguage
                );


            console.log(
                "🌐 Recognition language:",
                recognition.lang
            );


            // -----------------------------------------
            // START RECOGNITION
            // -----------------------------------------

            try {

                recognition.start();

            } catch (error) {

                console.error(
                    "🎤 Could not start recognition:",
                    error
                );

                // Chrome can throw InvalidStateError
                // if start() is called too quickly.

                if (
                    error.name ===
                    "InvalidStateError"
                ) {

                    setTimeout(
                        function() {

                            try {

                                recognition.start();

                            } catch (retryError) {

                                console.error(
                                    "🎤 Retry failed:",
                                    retryError
                                );

                            }

                        },
                        500
                    );

                }

            }

        }
    );


} else if (voiceButton) {

    voiceButton.addEventListener(
        "click",
        function() {

            alert(
                "Voice input is not supported by this browser. Please use the latest Google Chrome or Microsoft Edge."
            );

        }
    );

}


// =====================================================
// SPEECH LANGUAGE
// =====================================================

function getSpeechLanguage(language) {

    const languages = {

        English:
            "en-IN",

        Hindi:
            "hi-IN",

        Bengali:
            "bn-IN",

        Tamil:
            "ta-IN",

        Telugu:
            "te-IN",

        Marathi:
            "mr-IN"

    };


    return (
        languages[language] ||
        "en-IN"
    );

}
// =====================================================
// TEXT TO SPEECH
// =====================================================

function speakText(text) {

    if (
        !("speechSynthesis" in window)
    ) {

        return;

    }


    if (!text) {
        return;
    }


    stopSpeaking();


    const cleanText =
        text
            .replace(
                /[*#_`]/g,
                ""
            )
            .replace(
                /\[(.*?)\]\(.*?\)/g,
                "$1"
            )
            .replace(
                /\n+/g,
                ". "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();


    if (!cleanText) {
        return;
    }


    const utterance =
        new SpeechSynthesisUtterance(
            cleanText
        );


    utterance.lang =
        getSpeechLanguage(
            selectedLanguage
        );


    utterance.rate =
        0.9;


    utterance.pitch =
        1;


    utterance.volume =
        1;


    utterance.onstart =
        function() {

            isSpeaking =
                true;

        };


    utterance.onend =
        function() {

            isSpeaking =
                false;

        };


    utterance.onerror =
        function(error) {

            console.warn(
                "Speech synthesis error:",
                error
            );


            isSpeaking =
                false;

        };


    window.speechSynthesis.speak(
        utterance
    );

}


// =====================================================
// STOP SPEAKING
// =====================================================

function stopSpeaking() {

    if (
        "speechSynthesis" in window
    ) {

        window.speechSynthesis.cancel();

    }


    isSpeaking =
        false;

}


// =====================================================
// LANGUAGE MODAL
// =====================================================

if (
    languageButton &&
    languageModal
) {

    languageButton.addEventListener(
        "click",
        function() {

            languageModal.classList.add(
                "active"
            );

        }
    );

}


if (closeLanguage) {

    closeLanguage.addEventListener(
        "click",
        function() {

            languageModal.classList.remove(
                "active"
            );

        }
    );

}


if (languageModal) {

    languageModal.addEventListener(
        "click",
        function(event) {

            if (
                event.target ===
                languageModal
            ) {

                languageModal.classList.remove(
                    "active"
                );

            }

        }
    );

}


// =====================================================
// LANGUAGE SELECTION
// =====================================================

languageOptions.forEach(
    button => {

        button.addEventListener(
            "click",
            function() {

                selectedLanguage =
                    this.dataset.language;


                languageButton.innerHTML =
                    `🌐 <span>${selectedLanguage}</span>`;


                languageModal.classList.remove(
                    "active"
                );


                input.placeholder =
                    `Ask Quantum in ${selectedLanguage}...`;


                if (recognition) {

                    recognition.lang =
                        getSpeechLanguage(
                            selectedLanguage
                        );

                }

            }
        );

    }
);


// =====================================================
// NEW CHAT
// =====================================================

clearButton.addEventListener(
    "click",
    async function() {

        stopSpeaking();


        if (
            recognition &&
            isListening
        ) {

            shouldKeepListening =
                false;


            recognition.stop();

        }


        chatBox.innerHTML =
            createWelcome();


        input.value =
            "";


        input.style.height =
            "43px";


        input.placeholder =
            `Ask Quantum in ${selectedLanguage}...`;


        removeImage();


        setupQuickActions();


        input.focus();


        try {

            await quantumFetch(
                "/clear-chat",
                {
                    method:
                        "POST"
                }
            );

        } catch (error) {

            console.error(
                "Could not clear server memory:",
                error
            );

        }

    }
);


// =====================================================
// INITIAL PLACEHOLDER
// =====================================================

input.placeholder =
    `Ask Quantum in ${selectedLanguage}...`;


// =====================================================
// DONE
// =====================================================

console.log(
    "🌾 Quantum Krishi frontend loaded successfully."
);

console.log(
    "🔐 Private access system ready."
);