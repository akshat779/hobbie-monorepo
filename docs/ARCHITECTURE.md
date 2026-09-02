# System Architecture Document

## Overview
Hobbie is a real-time, activity-anchored matching engine built for dense urban hubs (tech parks, gated communities).

```mermaid
graph TD
    subgraph ClientLayer["Mobile Client (Expo / React Native)"]
        UI["Screens (expo-router)"]
        State["Zustand (Local) / TanStack Query (Remote)"]
        Theme["NativeWind (global.css)"]
        DevMenu["Dev Persona Switcher"]
    end

    subgraph ServiceLayer["Backend API (Fastify / Node.js)"]
        Matching["Matching Engine (Dynamic Radius)"]
        Trust["Rolling Trust Decay Engine"]
        Notif["k-Anonymity Notification Gate"]
        DevBypass["Dev Auth Header Middleware"]
    end

    subgraph DataLayer["Supabase Backend"]
        PostGIS[("PostGIS (ST_DWithin, Spatial Indexes)")]
        Realtime["Supabase Realtime (Live Rooms & Chat)"]
        Auth["Phone OTP Auth"]
        Cron["Edge Functions (TTL Auto-Destruct)"]
    end

    UI --> State
    State -->|REST API| ServiceLayer
    State -->|Realtime WebSocket| Realtime
    ServiceLayer --> PostGIS
    ServiceLayer --> Auth
```

## Key Architectural Directives
1. **Independent Deployability:** `apps/mobile` and `apps/server` have zero cross-runtime dependencies. Shared contracts live in `packages/shared`.
2. **Ephemerality & TTL Lifecycle:** All room chats and pins auto-expire after TTL (2-4 hrs).
3. **Privacy First:** Unaccepted participants see fuzzed coordinates (~100m). Exact venue is revealed only upon join acceptance.
