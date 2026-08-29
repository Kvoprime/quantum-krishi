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
                    data-message="What is the current market situation for my crop?"
                >
                    <span class="quick-icon">
                        💰
                    </span>

                    <span>
                        <strong>Market Intelligence</strong>
                        <small>Prices & selling decisions</small>
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

    return new Promise((resolve, reject) => {

        const reader =
            new FileReader();

        reader.onload = () => {

            const result =
                reader.result;

            /*
             * FileReader returns:
             *
             * data:image/jpeg;base64,XXXX
             *
             * Gemini only needs the XXXX portion.
             */

            const base64 =
                result.split(",")[1];

            resolve(base64);

        };

        reader.onerror = () => {

            reject(
                new Error(
                    "Could not read image."
                )
            );

        };

        reader.readAsDataURL(file);

    });

}


// =====================================================
// SEND MESSAGE
// =====================================================

async function sendMessage(customMessage = null) {

    const message =
        customMessage !== null
            ? customMessage.trim()
            : input.value.trim();


    /*
     * Allow an image even if there is no text.
     */

    if (
        message === "" &&
        !selectedImage
    ) {

        return;

    }


    // Stop current speech

    stopSpeaking();


    // Remove welcome screen

    const welcome =
        document.querySelector(".welcome");

    if (welcome) {

        welcome.remove();

    }


    // =================================================
    // USER MESSAGE
    // =================================================

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


    // =================================================
    // PREPARE IMAGE
    // =================================================

    let imageData = null;


    try {

        if (selectedImage) {

            /*
             * Convert the selected image to Base64.
             */

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
            document.createElement("div");

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


    // =================================================
    // CLEAR INPUT
    // =================================================

    input.value = "";

    input.style.height =
        "43px";


    // =================================================
    // BOT MESSAGE
    // =================================================

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


    // =================================================
    // SEND TO SERVER
    // =================================================

    try {

        const response =
            await fetch(
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


        // =================================================
        // SERVER ERROR
        // =================================================

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
                    "Could not read error response:",
                    e
                );

            }


            throw new Error(
                errorText
            );

        }


        // =================================================
        // RESPONSE
        // =================================================

        const data =
            await response.json();


        if (data.reply) {

            botMessage.textContent =
                data.reply;


            scrollToBottom();


            /*
             * Speak the answer.
             *
             * Keep this enabled because your
             * voice-output feature is already present.
             */

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


    // =================================================
    // REMOVE IMAGE AFTER SENDING
    // =================================================

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

        /*
         * Enter = send
         *
         * Shift + Enter = new line
         */

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
// AUTO GROW TEXTAREA
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

                        const message =
                            this.dataset.message;

                        sendMessage(
                            message
                        );

                    }
                );

            }
        );

}


setupQuickActions();


// =====================================================
// IMAGE UPLOAD BUTTON
// =====================================================

if (imageButton && imageInput) {

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


            // Check image type

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


            /*
             * Limit image size.
             *
             * 10 MB is more than enough
             * for crop photos.
             */

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
                                ${file.name}
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


if (
    SpeechRecognition &&
    voiceButton
) {

    recognition =
        new SpeechRecognition();


    recognition.continuous =
        true;


    recognition.interimResults =
        true;


    recognition.maxAlternatives =
        1;


    // =================================================
    // START
    // =================================================

    recognition.onstart =
        function() {

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


    // =================================================
    // RESULT
    // =================================================

    recognition.onresult =
        function(event) {

            let interimTranscript =
                "";


            for (
                let i = event.resultIndex;
                i < event.results.length;
                i++
            ) {

                const transcript =
                    event.results[i][0]
                        .transcript;


                if (
                    event.results[i].isFinal
                ) {

                    finalTranscript +=
                        transcript + " ";

                } else {

                    interimTranscript +=
                        transcript;

                }

            }


            input.value =
                finalTranscript +
                interimTranscript;


            input.dispatchEvent(
                new Event("input")
            );


            input.focus();

        };


    // =================================================
    // ERROR
    // =================================================

    recognition.onerror =
        function(event) {

            console.error(
                "Speech recognition error:",
                event.error
            );


            /*
             * Don't show an annoying alert
             * for temporary network errors.
             */

            if (
                event.error ===
                "not-allowed"
            ) {

                shouldKeepListening =
                    false;

                alert(
                    "Microphone permission was denied. Please allow microphone access in Chrome."
                );

            }


            if (
                event.error ===
                "no-speech"
            ) {

                console.log(
                    "No speech detected."
                );

            }


            if (
                event.error ===
                "network"
            ) {

                console.warn(
                    "Speech recognition network error."
                );

            }

        };


    // =================================================
    // END
    // =================================================

    recognition.onend =
        function() {

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


            /*
             * Automatically send the recognized
             * speech after the user stops speaking.
             */

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
                    200
                );

            }

        };


    // =================================================
    // MICROPHONE BUTTON
    // =================================================

    voiceButton.addEventListener(
        "click",
        function() {

            /*
             * Stop listening.
             */

            if (isListening) {

                shouldKeepListening =
                    true;

                recognition.stop();

                return;

            }


            stopSpeaking();


            finalTranscript =
                "";


            shouldKeepListening =
                true;


            recognition.lang =
                getSpeechLanguage(
                    selectedLanguage
                );


            try {

                recognition.start();

            } catch (error) {

                console.error(
                    "Could not start microphone:",
                    error
                );

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

function getSpeechLanguage(
    language
) {

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

        console.warn(
            "Text-to-speech is not supported."
        );

        return;

    }


    if (!text) {

        return;

    }


    stopSpeaking();


    /*
     * Remove markdown before speaking.
     */

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


    /*
     * Slightly slower makes agricultural
     * explanations easier to understand.
     */

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

        // Stop speech

        stopSpeaking();


        // Stop recognition

        if (
            recognition &&
            isListening
        ) {

            shouldKeepListening =
                false;

            recognition.stop();

        }


        // Restore welcome screen

        chatBox.innerHTML =
            createWelcome();


        // Reset input

        input.value =
            "";

        input.style.height =
            "43px";


        input.placeholder =
            `Ask Quantum in ${selectedLanguage}...`;


        // Remove image

        removeImage();


        // Reconnect quick actions

        setupQuickActions();


        input.focus();


        // Clear server conversation

        try {

            await fetch(
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
