# Retail Order Processing Automation (n8n)

## Live demo

Try the animated interactive demo — no n8n installation needed:

https://anggittaba.github.io/retail-order-automation-n8n/

It walks through the full flow against a mock Google Sheet and Gmail notification: a valid order, an invalid order (HTTP 400), a duplicate retry of the same `order_id` (row updated in place), and a formula-injection payload (stored as plain text via RAW cell formatting).


**Status:** Importable workflow template; local validation and structure tests included. **Not yet integrated or end-to-end tested against live n8n, Google Sheets, or Gmail.**

## Business problem
Manual order processing wastes time, leads to copy/paste errors and delays notifications.

## Workflow
`POST /webhook/new-customer-order` → Validate and normalize JSON → IF valid → Google Sheets upsert on `order_id` → Gmail notification → JSON 200 response.

Invalid order → JSON 400. Google Sheets error → JSON 502. Gmail error after Sheets write → JSON 502 with partial-failure status.

**Note:** Same `order_id` updates an existing row rather than adding another row. Duplicate webhook submissions can still send repeated emails; exactly-once email delivery is not included in this MVP. Authentication and rate limits are required for production.

## Files
- `order_processing_n8n_workflow.json`: import into n8n.
- `valid_order.json`, `invalid_order.json`, `valid_retry.json`, `formula_injection.json`: sample webhook payloads.
- `run_local_tests.js`: checks workflow references, error routing and order validation (without remote APIs).
- `CLIENT_QUESTIONS.md`, `PROPOSAL.md`: client discovery and proposal draft.

## Configuration (required before live use)
1. Create a Google Sheet named **Orders** with the exact first-row column names, in the same order:

   `received_at, order_id, customer_name, customer_email, product, quantity, unit_price, currency, total_amount, notes`

2. In n8n, open **Workflows** → **Import from File**, select `order_processing_n8n_workflow.json`.
3. Configure **Receive New Order**: create a **Header Auth** credential. Suggested header: `X-Order-Webhook-Key` and a high-entropy secret set by the owner. The template requires Header Auth, but exports no secret. Send the matching header with every request.
4. Open **Save Order to Google Sheets**: connect a Google Sheets credential with access to the sheet, replace `REPLACE_WITH_GOOGLE_SHEET_ID` with the actual spreadsheet ID, verify sheet tab `Orders`, refresh the column mapping if prompted. Keep `order_id` as the matching column and RAW cell formatting.
5. Open **Notify Business Owner (Gmail)**: connect the owner's authorized Gmail account, change `owner@example.com` to the real recipient. You can replace Gmail with SMTP Send Email if the owner prefers.
6. Save and **Listen for Test Event** on the Webhook node. Use the Test URL, not Production URL, until testing passes.
7. Send a sample order using the curl command below. Verify the row in Google Sheets and the received email. Then test the invalid order and each error path before publishing.
8. Publish/activate the workflow according to the n8n version and use its **Production URL** when the client has signed off.

### Example test command

```bash
curl -i -X POST 'https://YOUR-N8N-DOMAIN/webhook-test/new-customer-order' \
  -H 'Content-Type: application/json' \
  -H 'X-Order-Webhook-Key: REPLACE_WITH_YOUR_SECRET' \
  --data-binary @valid_order.json
```

**Successful sample response (only after live integrations are configured):**

```json
{"status":"success","order_id":"ORD-1001","saved":true,"notified":true}
```

## Fields and validation

| Field | Required | Rules |
|---|---|---|
| order_id | Yes | 1-64 letters, digits, `_`, `-` |
| customer_name | Yes | Nonempty string |
| customer_email | Yes | Simple email format check |
| product | Yes | Nonempty string |
| quantity | Yes | Whole number 1-10000 |
| unit_price | Yes | Number 0-1,000,000,000 |
| currency | No | Three-letter currency code, default USD |
| notes | No | Maximum 500 characters stored |

`total_amount = round(quantity × unit_price, 2)`. This MVP assumes a single product per order, with no tax, discounts, or shipping fields. Validation is intentionally basic rather than a complete ecommerce schema.

### Operational behavior
- Customer data is inserted/updated first. The owner is emailed **only if the spreadsheet write succeeds**.
- Invalid order → HTTP 400, **no sheet write or email**.
- Sheets failure → HTTP 502, **no email**.
- Gmail failure → HTTP 502, order **already stored**. Do not blindly retry without checking notification state.
- Header authentication restricts callers; keep its credential secret and rotate if exposed.
- The execution records may contain personal customer data. Set an appropriate n8n retention policy and access controls.
- Use only a Google account the owner has authorized and minimize spreadsheet sharing.

## Production hardening (out of scope for this MVP)
Implement per-order notification state (`notification_sent_at`), an idempotency/locking mechanism for concurrent webhook deliveries, retries with a dead-letter queue, monitoring for failed executions, validated decimal/money handling, proper currency validation, and client-specific privacy/retention rules. Configure TLS, request size/rate limits, and upstream payment verification if applicable. Do not take payment-card details into this workflow.

## Acceptance test checklist
- [ ] Authenticated webhook accepts valid order and replies HTTP 200
- [ ] Valid order saved with correct data and computed amount
- [ ] One email received with order summary
- [ ] Invalid body rejected HTTP 400 without writing/email
- [ ] Repeating an order ID does not add another row
- [ ] Simulated Sheets failure has no notification and returns 502
- [ ] Simulated Gmail failure is reported as partial failure 502
- [ ] Confirm owner can operate and troubleshoot the workflow

## Portfolio notes
Show a short video, sample JSON, a flow diagram, **verified** timing measurements, and the before/after workflow. Never claim production deployment or quantified impact without actual evidence. Replace all data and credentials with demo data before publishing.
