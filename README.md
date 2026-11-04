# Codeless Technologies — Dynamic Digital Business Card

Production destination: https://card.codelessai.in/

A mobile-first React/Vite application backed by Google Sheets through a read-only Google Apps Script JSONP endpoint.

## Architecture

- `frontend/`: React + TypeScript + Vite + Tailwind-style custom CSS.
- `apps-script/Code.gs`: Google Apps Script API.
- `Codeless-Digital-Card-Sheets-Template.xlsx`: two-tab spreadsheet template.
- `assets/card-qr.png` and `assets/card-qr.svg`: QR code encoding `https://card.codelessai.in/`.

The QR destination is intentionally permanent. It will resolve only after the subdomain is deployed and DNS/HTTPS are configured.

## 1. Prepare Google Sheets

1. Upload `Codeless-Digital-Card-Sheets-Template.xlsx` to Google Drive.
2. Open it with Google Sheets and convert it to a native Google Spreadsheet.
3. Keep worksheet names exactly `PROFILE` and `ACTIONS`.
4. Fill in the real phone number, email, website and portfolio URLs.
5. Copy the spreadsheet ID from its URL.

`PROFILE` uses `field | value` columns. `ACTIONS` uses:
`key | label | type | value | enabled | sort_order | icon`

Core actions are fixed in the frontend:
- Visit Website (destination from PROFILE.website)
- Save Contact (generates a vCard from PROFILE)
- Connect on WhatsApp (number from PROFILE.phone)

The `ACTIONS` tab may also contain these reserved keys to control visibility:
`website`, `save_contact`, `whatsapp`.
If a reserved row is absent, its core action remains visible when the required profile data exists. If a reserved row exists and `enabled` is false, that action is hidden. Optional actions are rendered dynamically from all other enabled rows.

Supported action types: `link`, `email`, `phone`, `whatsapp`, `website`, `vcard`.

## 2. Deploy Google Apps Script

1. Open https://script.google.com/ and create a new project.
2. Copy `apps-script/Code.gs` into the editor.
3. In **Project Settings → Script Properties**, add:
   - `SPREADSHEET_ID` = your Google Spreadsheet ID
4. Run `setup` once from the editor and authorize access.
5. Deploy → New deployment → Web app:
   - Execute as: Me
   - Who has access: Anyone
6. Copy the deployed `/exec` URL.

The API uses JSONP because Apps Script ContentService does not provide a configurable CORS header interface. It is read-only. Callback names are strictly validated. Do not add public write operations.

## 3. Configure frontend

Copy `frontend/.env.example` to `frontend/.env` and set:

`VITE_CARD_API_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec`

Then:

```bash
cd frontend
npm install
npm run dev
```

For production:

```bash
npm run build
```

Upload the contents of `frontend/dist/` to the document root configured for `card.codelessai.in`.

## 4. Configure the subdomain

At your DNS provider, create the required CNAME or A record according to your hosting provider's instructions. Configure the host's custom domain mapping and issue an SSL certificate. Do not print the QR code until `https://card.codelessai.in/` loads successfully over HTTPS.

## 5. QR code

The QR code assets encode exactly:

`https://card.codelessai.in/`

The QR code does not contain phone numbers, email addresses, or social links. Updating Google Sheets does not require reprinting the card.

## 6. Update content

Edit `PROFILE` to update the name, company, designation, phone, email, website and other contact data.

Add a row to `ACTIONS` to add a new dynamic action. Set `enabled` to TRUE and choose a supported `type`. Change `sort_order` to reorder. Set `enabled` to FALSE or delete the row to remove an optional action.

## 7. Security notes

- The public API is read-only.
- Keep the spreadsheet private; the Apps Script executes as its owner.
- Never publish the spreadsheet ID as an editing credential (it is not a secret by itself, but avoid unnecessary exposure).
- Do not put confidential data in the public PROFILE or ACTIONS tabs.
- Destination URLs are restricted to HTTP/HTTPS by the frontend.
- The JSONP endpoint accepts only conservative JavaScript callback identifiers.
- Review Google Apps Script quotas if traffic becomes significant.

## 8. Validation checklist

- [ ] Google Sheet converted to native Google Sheets and populated.
- [ ] Apps Script deployed as Anyone / Execute as Me.
- [ ] API URL configured in frontend `.env`.
- [ ] API JSONP response tested in a browser.
- [ ] `card.codelessai.in` DNS and HTTPS configured.
- [ ] Website action opens correct URL.
- [ ] vCard saves correct contact data on Android and iOS.
- [ ] WhatsApp opens the configured number.
- [ ] Adding/disabling/reordering an optional action updates the page.
- [ ] QR code scanned from a printed proof.
# Codeless-Business-Card
