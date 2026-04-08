/**
 * GoHighLevel (GHL) API Client
 * Handles email and SMS distribution through the MMDB GHL account
 * 
 * GHL API Docs: https://highlevel.stoplight.io/docs/integrations
 */

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

function getHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    'Content-Type': 'application/json',
    Version: '2021-07-28',
  };
}

// ---- Contacts ----

export async function searchContacts(query: string, limit = 20) {
  const res = await fetch(
    `${GHL_BASE_URL}/contacts/?locationId=${process.env.GHL_LOCATION_ID}&query=${encodeURIComponent(query)}&limit=${limit}`,
    { headers: getHeaders() }
  );
  if (!res.ok) throw new Error(`GHL search failed: ${res.status}`);
  return res.json();
}

export async function getContactsByTag(tag: string) {
  const res = await fetch(
    `${GHL_BASE_URL}/contacts/?locationId=${process.env.GHL_LOCATION_ID}&query=${encodeURIComponent(tag)}&limit=100`,
    { headers: getHeaders() }
  );
  if (!res.ok) throw new Error(`GHL tag search failed: ${res.status}`);
  return res.json();
}

// ---- Email ----

export interface GHLEmailPayload {
  contactId?: string;
  emailTo: string;
  subject: string;
  htmlBody: string;
  from: string;
  fromName: string;
  replyTo?: string;
}

export async function sendEmail(payload: GHLEmailPayload) {
  // GHL sends email through their platform via the conversations endpoint
  // or through a workflow/campaign trigger
  const res = await fetch(
    `${GHL_BASE_URL}/conversations/messages`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        type: 'Email',
        locationId: process.env.GHL_LOCATION_ID,
        contactId: payload.contactId,
        emailTo: payload.emailTo,
        subject: payload.subject,
        html: payload.htmlBody,
        emailFrom: payload.from || process.env.GHL_FROM_EMAIL || 'scott@scottbottoms.com',
        emailReplyMode: 'reply',
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GHL email failed: ${res.status} - ${err}`);
  }
  return res.json();
}

/**
 * Trigger a GHL workflow (for bulk email campaigns)
 * This is the preferred method for blast emails -- create a workflow in GHL
 * that sends the email, then trigger it via API with the content injected.
 */
export async function triggerWorkflow(workflowId: string, contactIds: string[]) {
  const results = [];
  for (const contactId of contactIds) {
    try {
      const res = await fetch(
        `${GHL_BASE_URL}/contacts/${contactId}/workflow/${workflowId}`,
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            locationId: process.env.GHL_LOCATION_ID,
          }),
        }
      );
      results.push({ contactId, success: res.ok });
    } catch (err) {
      results.push({ contactId, success: false, error: err });
    }
  }
  return results;
}

// ---- SMS ----

export interface GHLSMSPayload {
  contactId: string;
  message: string;
  fromNumber?: string;
}

export async function sendSMS(payload: GHLSMSPayload) {
  const res = await fetch(
    `${GHL_BASE_URL}/conversations/messages`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        type: 'SMS',
        locationId: process.env.GHL_LOCATION_ID,
        contactId: payload.contactId,
        message: payload.message,
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GHL SMS failed: ${res.status} - ${err}`);
  }
  return res.json();
}

// ---- Campaigns ----

/**
 * Create a new email campaign in GHL
 * Used for blast emails to the entire supporter list
 */
export async function createCampaign(name: string, subject: string, htmlBody: string) {
  // GHL campaign creation via API
  // Note: Some GHL plans require campaign creation through the UI
  // This endpoint may need adjustment based on your GHL plan
  const res = await fetch(
    `${GHL_BASE_URL}/campaigns/`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        locationId: process.env.GHL_LOCATION_ID,
        name,
        status: 'draft',
      }),
    }
  );
  if (!res.ok) {
    console.warn('[GHL] Campaign creation may require UI - falling back to workflow trigger');
    return null;
  }
  return res.json();
}

// ---- Utility ----

/**
 * Check if GHL is configured and accessible
 */
export async function checkGHLConnection(): Promise<boolean> {
  if (!process.env.GHL_API_KEY || !process.env.GHL_LOCATION_ID) {
    return false;
  }
  try {
    const res = await fetch(
      `${GHL_BASE_URL}/locations/${process.env.GHL_LOCATION_ID}`,
      { headers: getHeaders() }
    );
    return res.ok;
  } catch {
    return false;
  }
}
