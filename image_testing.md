# Image Integration Testing Playbook (Scan Bill)

You are the Test Agent responsible for validating the `/api/scan-bill` endpoint that uses OpenAI vision via emergentintegrations.

## Image Handling Rules
- Always use base64-encoded images for all tests and requests.
- Accepted formats: JPEG, PNG, WEBP only.
- Do not use SVG, BMP, HEIC, or other formats.
- Do not upload blank, solid-color, or uniform-variance images.
- Every image must contain real visual features — text, edges, textures, shadows.
- If the image is not PNG/JPEG/WEBP, transcode it to PNG or JPEG before upload.
- If the image is animated (GIF, APNG, animated WEBP), extract the first frame only.
- Resize large images to reasonable bounds (avoid oversized payloads — keep under 2 MB base64).

## Endpoint
POST `/api/scan-bill` (Bearer auth)
Body: `{ "image_base64": "<JPEG or PNG base64, no data: prefix>" }`
Returns: `{ "vendor": "...", "amount": <float>, "currency": "INR|USD|...", "category": "food|trip|home|friends|shopping|bills|other", "date": "YYYY-MM-DD", "suggested_name": "..." }`

## Test Approach
1. Login as `demo@merizo.app` / `Demo@123` to get a JWT.
2. Find a real receipt image online (any restaurant bill, grocery receipt, hotel invoice with visible amount and merchant). Download as JPEG.
3. Encode to base64 and POST to `/api/scan-bill` with `Authorization: Bearer <token>`.
4. Validate the response is a JSON object with all 6 fields and that `amount` parses to a number > 0 and `currency` is a 3-letter ISO code.
5. Verify a clearly invalid payload (no image, blank base64) returns a 4xx error.
