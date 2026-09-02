# API Specification (v1)

## Endpoints

### 1. Discovery Radar Feed
* **Method:** `GET /api/v1/discovery`
* **Query Params:**
  * `latitude` (number)
  * `longitude` (number)
  * `radiusKm` (number, default: 4.5)
  * `interestIds` (array of string, optional)
* **Response (200 OK):**
  ```json
  {
    "activities": [
      {
        "id": "act-1",
        "title": "5-a-side Turf Football",
        "interestId": "football",
        "tier": "physical",
        "fuzzedLocation": { "latitude": 12.972, "longitude": 77.595 },
        "distanceKm": 0.8,
        "expiresAt": "2026-08-30T17:30:00.000Z",
        "status": "open",
        "hostName": "Alex",
        "hostIsVerified": true,
        "hostTrustScore": 4.9
      }
    ]
  }
  ```

### 2. Create Activity
* **Method:** `POST /api/v1/activities`
* **Headers:** `Authorization: Bearer <token>` or `X-Dev-User-Id: <uuid>`
* **Body:** `CreateActivitySchema`
* **Response:** `201 Created`

### 3. Request to Join
* **Method:** `POST /api/v1/join-requests`
* **Headers:** `Authorization: Bearer <token>` or `X-Dev-User-Id: <uuid>`
* **Body:** `RequestToJoinSchema`
* **Response:** `201 Created`

### 4. Ephemeral Room Chat
* **Method:** `POST /api/v1/rooms/messages`
* **Headers:** `Authorization: Bearer <token>` or `X-Dev-User-Id: <uuid>`
* **Body:** `SendMessageSchema`
* **Response:** `201 Created`
