/**
 * Codeless Technologies Dynamic Digital Card API
 * Public read-only JSONP API backed by PROFILE and ACTIONS sheets.
 *
 * Script Properties required:
 *   SPREADSHEET_ID = native Google Spreadsheet ID
 */

const PROFILE_SHEET = "PROFILE";
const ACTIONS_SHEET = "ACTIONS";
const CACHE_SECONDS = 60;
const SPREADSHEET_ID_FALLBACK = "1AX2Gcf-FvB1_QYlUiWXcfuEriBGnPTSPAyW0KfcufRg";

function setup() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID") || SPREADSHEET_ID_FALLBACK;
  const ss = SpreadsheetApp.openById(id);
  if (!ss.getSheetByName(PROFILE_SHEET) || !ss.getSheetByName(ACTIONS_SHEET)) {
    throw new Error("Spreadsheet must contain PROFILE and ACTIONS worksheets.");
  }
  Logger.log("Setup successful: " + ss.getName());
}

function doGet(e) {
  const callback = e && e.parameter ? String(e.parameter.callback || "") : "";
  if (!/^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*){0,3}$/.test(callback)) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: "A valid callback parameter is required." }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const payload = getPublicCardData_();
    const js = callback + "(" + JSON.stringify(payload).replace(/</g, "\\u003c") + ");";
    return ContentService.createTextOutput(js).setMimeType(ContentService.MimeType.JAVASCRIPT);
  } catch (err) {
    const errorPayload = { success: false, error: "Unable to load card data." };
    return ContentService
      .createTextOutput(callback + "(" + JSON.stringify(errorPayload) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}

function getPublicCardData_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("public-card-v1");
  if (cached) return JSON.parse(cached);

  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID") || SPREADSHEET_ID_FALLBACK;

  const ss = SpreadsheetApp.openById(id);
  const profileSheet = ss.getSheetByName(PROFILE_SHEET);
  const actionsSheet = ss.getSheetByName(ACTIONS_SHEET);
  if (!profileSheet || !actionsSheet) throw new Error("Required worksheet missing.");

  const profileValues = profileSheet.getDataRange().getDisplayValues();
  const profile = {};
  profileValues.slice(1).forEach(row => {
    const key = String(row[0] || "").trim();
    if (key) profile[key] = String(row[1] || "").trim();
  });

  const actionValues = actionsSheet.getDataRange().getDisplayValues();
  const headers = (actionValues[0] || []).map(h => String(h).trim().toLowerCase());
  const index = {};
  headers.forEach((h, i) => index[h] = i);

  ["key", "label", "type", "value", "enabled", "sort_order"].forEach(h => {
    if (index[h] === undefined) throw new Error("Missing ACTIONS column: " + h);
  });

  const actions = actionValues.slice(1).map(row => ({
    key: String(row[index.key] || "").trim(),
    label: String(row[index.label] || "").trim(),
    type: String(row[index.type] || "").trim().toLowerCase(),
    value: String(row[index.value] || "").trim(),
    enabled: String(row[index.enabled] || "").trim().toLowerCase() === "true",
    sort_order: Number(row[index.sort_order] || 999),
    icon: index.icon === undefined ? "" : String(row[index.icon] || "").trim()
  })).filter(a => a.key && a.label && a.enabled && a.type);

  actions.sort((a, b) => a.sort_order - b.sort_order);

  const result = { success: true, profile: profile, actions: actions, generated_at: new Date().toISOString() };
  cache.put("public-card-v1", JSON.stringify(result), CACHE_SECONDS);
  return result;
}

/** Optional manual cache reset after bulk edits. */
function clearCardCache() {
  CacheService.getScriptCache().remove("public-card-v1");
}
