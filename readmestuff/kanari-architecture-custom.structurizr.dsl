workspace "Kanari Architecture (Custom View)" "Readable hackathon architecture diagram for Kanari" {

    model {
        user = element "User" "Actor" "Starts check-ins and reviews recovery progress." {
            tags "Actor"
        }

        frontend = element "Frontend Experience" "Next.js UI" "/check-ins and /overview routes, global providers, and dashboard views." {
            tags "Primary"
        }

        checkin = element "Check-in Orchestrator" "Hooks" "useCheckIn, useCheckInAudio, useGeminiLive, useCheckInSession, and widgets flow." {
            tags "Primary"
        }

        analytics = element "Audio + Forecasting" "ML Pipeline" "VAD/Meyda extraction, acoustic inference, semantic fusion, and predictBurnoutRisk." {
            tags "Data"
        }

        storage = element "Client Storage" "Dexie + localStorage" "IndexedDB (kanari or kanari_demo) and workspace mode flag." {
            tags "Data"
        }

        apis = element "Gemini APIs" "Server Routes" "/api/gemini/check-in-context, /synthesize, /gemini, /semantic, and /achievements." {
            tags "Server"
        }

        scheduler = element "In-app Scheduler" "Scheduling" "useLocalCalendar workflow and persisted recovery blocks." {
            tags "Data"
        }

        legacy = element "Legacy Live Proxy (inactive)" "Optional Path" "Older /api/gemini/session and /api/gemini/live/* bridge path." {
            tags "Legacy"
        }

        geminiLive = element "Gemini Live API" "External Service" "Realtime voice model endpoint (WebSocket)." {
            tags "External"
        }

        geminiFlash = element "Gemini Flash API" "External Service" "Synthesis/context/semantic endpoint (REST)." {
            tags "External"
        }

        user -> frontend "Uses"
        frontend -> checkin "Runs voice check-ins"
        frontend -> scheduler "Schedules actions"
        frontend -> storage "Reads/writes dashboard history"

        checkin -> geminiLive "Realtime voice session" "WebSocket"
        checkin -> apis "Requests context+synthesis" "HTTPS"
        apis -> geminiFlash "Calls Flash models" "HTTPS"

        checkin -> analytics "Runs end-session analysis"
        analytics -> storage "Stores biomarkers + trend updates"

        checkin -> storage "Persists sessions + synthesis"
        scheduler -> storage "Stores recovery blocks"

        checkin -> legacy "Fallback/inactive path" {
            tags "LegacyPath"
        }
        legacy -> geminiLive "Server bridge (legacy)" "WebSocket" {
            tags "LegacyPath"
        }
    }

    views {
        custom "kanari-architecture-custom" {
            title "Kanari Architecture"
            include *
            autoLayout lr 90 70
        }

        styles {
            element "Element" {
                shape RoundedBox
                width 320
                height 125
                background #0f1722
                color #dcf3ff
                stroke #5fc8ff
                strokeWidth 2
                fontSize 26
                metadata false
                description false
            }

            element "Actor" {
                shape Person
                background #132033
                stroke #6fd2ff
            }

            element "Primary" {
                background #132235
                stroke #5fc8ff
            }

            element "Server" {
                background #0d141f
                stroke #6abde8
            }

            element "Data" {
                background #11263b
                stroke #4cbcff
            }

            element "External" {
                background #12263a
                stroke #74d6ff
                border Dashed
            }

            element "Legacy" {
                background #142233
                stroke #9bb7c9
                border Dashed
            }

            relationship "Relationship" {
                color #69ccff
                thickness 3
                style Solid
                routing Curved
                fontSize 18
                width 220
                position 50
            }

            relationship "LegacyPath" {
                style Dashed
                color #9bb7c9
                opacity 70
            }
        }
    }
}
