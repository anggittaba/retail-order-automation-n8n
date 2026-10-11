# Client Discovery Questions

1. Where do orders originate (Tally, Typeform, Shopify, custom form, or direct JSON webhook)?
2. What is the exact order payload and required/optional fields? Is there more than one line item?
3. Which Google Sheets document and tab should store orders? Which account has edit permission?
4. What email address should receive order alerts? Do you prefer Gmail or SMTP?
5. Should duplicate `order_id` values be updated, rejected, or ignored? What if two requests arrive simultaneously?
6. Should emails also go to customers, or only to the business owner?
7. Does the sender support a secret authentication header? Which webhook retries are expected?
8. Should failures trigger backup alerts, and what time zone / working hours apply?
9. Which fields are personal data and what are the retention requirements?
10. Who owns the n8n workspace and approves the final production test?
