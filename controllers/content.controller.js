import {
    SLOT_TYPE,
    CONTENT_SLOTS,
    COLOR_SLOTS,
    getSlot,
    isKnownSlot,
    getSlotKeysForPage
} from "../constants/content.slots.js";
import { getAllContent, upsertContent, deleteContent } from "../models/content.model.js";

// Saved overrides, slot key -> value. Read on every render, so it has to be
// synchronous: the templates cannot await. It is refreshed at boot and after
// every write, and there is exactly one server process, so it cannot go stale.
//
// An empty cache is a valid state, not an error — every slot falls back to its
// template default, and the site renders as it did before this feature. That is
// deliberate: a database outage must never blank the wedding site.
let contentCache = new Map();
let cacheLoaded = false;

async function initContentCache() {
    try {
        contentCache = await getAllContent();
        cacheLoaded = true;
    } catch (error) {
        console.error('Could not load site content, falling back to template defaults:', error.message);
        cacheLoaded = false;
    }
}

function isContentLoaded() {
    return cacheLoaded;
}

// The value a page should render: the admin's override if there is one,
// otherwise the default baked into the slot registry.
function getContentValue(key) {
    const slot = getSlot(key);
    if (slot == null) return '';

    const stored = contentCache.get(key);
    if (stored == null || stored === '') return slot.default;

    return stored;
}

function hasOverride(key) {
    const stored = contentCache.get(key);
    return stored != null && stored !== '';
}

// Every colour slot as { cssVar, value }, for the <style> block in <head>.
function getColorVariables() {
    return COLOR_SLOTS.map((slot) => ({
        cssVar: slot.cssVar,
        // Images are consumed by background-image, so they need the url() wrapper.
        value: slot.type === SLOT_TYPE.IMAGE
            ? `url("${getContentValue(slot.key)}")`
            : getContentValue(slot.key)
    }));
}

// ---------------------------------------------------------------- sanitising

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Tags an admin is allowed to keep in a rich slot. Deliberately tiny: these
// are the only ones that cannot carry a style, a class, a URL or a script, so
// none of them can alter the design or introduce an injection.
const ALLOWED_RICH_TAGS = 'b|strong|i|em|u|br';

// Escape everything first, then selectively un-escape the whitelist. Working in
// this direction rather than stripping bad tags means anything unforeseen —
// attributes, event handlers, unknown elements, malformed markup — has already
// been neutralised into text before the whitelist is applied, so there is no
// bypass to find. A paste from Word arrives as plain text, which is exactly the
// behaviour that keeps the layout intact.
function sanitizeRichText(value) {
    const escaped = escapeHtml(value);

    const withTags = escaped.replace(
        new RegExp(`&lt;(/?)(${ALLOWED_RICH_TAGS})\\s*/?&gt;`, 'gi'),
        (match, slash, tag) => `<${slash}${tag.toLowerCase()}>`
    );

    return balanceRichTags(withTags);
}

// The whitelist pass can leave a closing tag whose opening tag was rejected —
// `<b onclick="…">bold</b>` keeps its `</b>` because the opening tag carried an
// attribute and was escaped into text. Browsers shrug at a stray `</b>`, but
// storing malformed markup invites a real problem later, so the tags are
// balanced here: unmatched closers are dropped and anything left open is closed.
function balanceRichTags(html) {
    const pattern = new RegExp(`<(/?)(${ALLOWED_RICH_TAGS})>`, 'g');
    const open = [];

    let out = '';
    let cursor = 0;
    let match;

    while ((match = pattern.exec(html)) !== null) {
        out += html.slice(cursor, match.index);
        cursor = pattern.lastIndex;

        const isClosing = match[1] === '/';
        const tag = match[2];

        if (tag === 'br') {
            out += '<br>';
            continue;
        }

        if (!isClosing) {
            open.push(tag);
            out += `<${tag}>`;
            continue;
        }

        const openIndex = open.lastIndexOf(tag);
        if (openIndex === -1) continue;

        open.splice(openIndex, 1);
        out += `</${tag}>`;
    }

    out += html.slice(cursor);

    while (open.length > 0) {
        out += `</${open.pop()}>`;
    }

    return out;
}

function stripTags(value) {
    return String(value).replace(/<[^>]*>/g, '');
}

// Length limits are about how much text fits on screen, so markup must not
// count towards them.
function visibleLength(value) {
    return stripTags(value).replace(/&nbsp;/g, ' ').length;
}

// Uploaded files land in /uploads, the photos shipped with the repo live in
// /img. Anything else — an absolute URL, a protocol-relative URL, a path with
// ".." in it — is refused, so a slot can never be pointed at a third-party host.
const IMAGE_PATH_PATTERN = /^\/(img|uploads)\/[A-Za-z0-9/_.-]+$/;

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

// Returns { value } on success or { error } on rejection. Every write goes
// through here, including the upload endpoint's result — the client is never
// trusted, even though the client is the admin's own browser.
function validateSlotValue(key, rawValue) {
    const slot = getSlot(key);
    if (slot == null) {
        return { error: `Champ inconnu : ${key}` };
    }

    if (typeof rawValue !== 'string') {
        return { error: `Valeur invalide pour « ${slot.label} »` };
    }

    if (slot.type === SLOT_TYPE.COLOR) {
        const value = rawValue.trim();
        if (!COLOR_PATTERN.test(value)) {
            return { error: `Couleur invalide pour « ${slot.label} »` };
        }
        return { value: value.toLowerCase() };
    }

    if (slot.type === SLOT_TYPE.COUNT) {
        // Clamped rather than rejected on range: the count is written by the
        // editor, not typed by a human, so an out-of-range value means a bug
        // or a tampered request — either way the safe reading is "as many as
        // are allowed", never zero entries or an unbounded page.
        const value = Number.parseInt(String(rawValue).trim(), 10);

        if (!Number.isFinite(value)) {
            return { error: `Valeur invalide pour « ${slot.label} »` };
        }

        const clamped = Math.min(Math.max(value, slot.min), slot.max);
        return { value: String(clamped) };
    }

    if (slot.type === SLOT_TYPE.IMAGE) {
        const value = rawValue.trim();
        if (!IMAGE_PATH_PATTERN.test(value) || value.includes('..')) {
            return { error: `Image invalide pour « ${slot.label} »` };
        }
        return { value };
    }

    if (slot.type === SLOT_TYPE.TEXT) {
        // Newlines are collapsed rather than rejected: a title or a button
        // label has nowhere to put a second line, and silently fixing it is
        // friendlier than an error the admin cannot act on.
        const value = stripTags(rawValue).replace(/\s+/g, ' ').trim();

        // An optional slot (the per-entry time) may be cleared. Empty means
        // "unset", and an unset slot is simply not rendered — which is how
        // adding the time field changed nothing on the live page.
        if (value.length === 0) {
            if (slot.optional === true) return { value: '' };
            return { error: `« ${slot.label} » ne peut pas être vide` };
        }
        if (value.length > slot.max) {
            return { error: `« ${slot.label} » dépasse ${slot.max} caractères` };
        }
        return { value };
    }

    // SLOT_TYPE.RICH
    const value = sanitizeRichText(rawValue).trim();

    if (visibleLength(value) === 0) {
        return { error: `« ${slot.label} » ne peut pas être vide` };
    }
    if (visibleLength(value) > slot.max) {
        return { error: `« ${slot.label} » dépasse ${slot.max} caractères` };
    }
    return { value };
}

// ------------------------------------------------------------------- writing

// updates: a plain object of { slotKey: value }.
// Validation runs over the whole batch before anything is written, so a single
// bad field cannot leave the page half-updated.
async function saveContentUpdates(updates) {
    if (updates == null || typeof updates !== 'object') {
        return { ok: false, error: 'Requête invalide.' };
    }

    const entries = [];

    for (const [key, rawValue] of Object.entries(updates)) {
        if (!isKnownSlot(key)) {
            return { ok: false, error: `Champ non modifiable : ${key}` };
        }

        const { value, error } = validateSlotValue(key, rawValue);
        if (error != null) {
            return { ok: false, error };
        }
        entries.push([key, value]);
    }

    if (entries.length === 0) {
        return { ok: true, saved: 0 };
    }

    await upsertContent(entries);
    await initContentCache();

    return { ok: true, saved: entries.length };
}

// Restores the template defaults for a whole page by removing its rows.
//
// `includeSite` also clears the site-wide `site.*` slots (the button colours).
// They are shared by both pages, but they are edited from within a page — by
// hovering a button — so an admin who has just made the buttons neon green
// expects "rétablir cette page" to undo that too.
async function resetPageContent(page, includeSite = false) {
    const keys = getSlotKeysForPage(page);
    if (keys.length === 0) {
        return { ok: false, error: 'Page inconnue.' };
    }

    if (includeSite && page !== 'site') {
        keys.push(...getSlotKeysForPage('site'));
    }

    await deleteContent(keys);
    await initContentCache();

    return { ok: true, reset: keys.length };
}

// Restores individual slots — used by the "Rétablir" button on a photo.
async function resetContentKeys(keys) {
    if (!Array.isArray(keys)) {
        return { ok: false, error: 'Requête invalide.' };
    }

    const known = keys.filter((key) => isKnownSlot(key));
    if (known.length === 0) {
        return { ok: false, error: 'Aucun champ valide à rétablir.' };
    }

    await deleteContent(known);
    await initContentCache();

    return { ok: true, reset: known.length };
}

export {
    CONTENT_SLOTS,
    initContentCache,
    isContentLoaded,
    getContentValue,
    hasOverride,
    getColorVariables,
    escapeHtml,
    sanitizeRichText,
    validateSlotValue,
    saveContentUpdates,
    resetPageContent,
    resetContentKeys
};
