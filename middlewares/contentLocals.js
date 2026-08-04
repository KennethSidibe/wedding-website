import {
    SLOT_TYPE,
    CONTENT_SLOTS,
    MAX_PROGRAM_ITEMS,
    MIN_PROGRAM_ITEMS,
    PROGRAM_LOCATIONS,
    getSlot
} from "../constants/content.slots.js";
import {
    getContentValue,
    getColorVariables,
    escapeHtml,
    hasOverride
} from "../controllers/content.controller.js";
import { isAdminAuthenticated, getCsrfToken, isEditorSessionOpen } from "./adminAuth.js";

// Exposes the content helpers to every template through res.locals.
//
// This deliberately does NOT wrap res.render. Two wrappers are already stacked
// (lazyLoad, then cacheBusting) and a third would have to forward its callback
// correctly or it would silently swallow the ones above it — a bug that has
// already happened once in this codebase and is invisible when it does. Locals
// achieve the same thing with none of that risk.
// The only pages the editor may ever open, and the slot-key prefix each one
// owns. This is the whole lock on /invitees: the registration form is not in
// this map, so ?edit=1 does nothing there — no editor chrome, no stylesheet, no
// editable fields — for an admin as much as for a visitor. A new editable page
// has to be added here deliberately; nothing becomes editable by accident.
const EDITABLE_PAGES = new Map([
    ['/', 'home'],
    ['/give', 'give']
]);

export function contentLocals(req, res, next) {

    // Edit mode needs four things: an editable page, `?edit=1`, the admin
    // cookie, and an editor session opened from the dashboard. The fourth is
    // what stops a bookmark or the back button from reopening the editor —
    // see openEditorSession() in adminAuth.js. A visitor adding the query
    // string sees the normal page; an admin browsing normally is not stuck in
    // the editor.
    const editPageKey = EDITABLE_PAGES.get(req.path) ?? null;

    const editMode = editPageKey != null
        && req.query.edit === '1'
        && isAdminAuthenticated(req)
        && isEditorSessionOpen(req);

    res.locals.editPageKey = editPageKey;

    res.locals.editMode = editMode;
    res.locals.csrfToken = editMode ? getCsrfToken(req) : '';
    res.locals.contentVars = getColorVariables();

    // Only the colour pickers, for the editor's colour panel. The hero photo
    // is also published as a CSS variable but is edited by hovering the photo
    // itself, so it does not belong in this list.
    res.locals.editableColors = editMode
        ? CONTENT_SLOTS
            .filter((slot) => slot.type === SLOT_TYPE.COLOR)
            .map((slot) => ({
                key: slot.key,
                label: slot.label,
                short: slot.short ?? slot.label,
                cssVar: slot.cssVar,
                value: getContentValue(slot.key)
            }))
        : [];

    // Renders a slot, wrapping it in the editable span when the admin is in
    // edit mode. Always output with <%- %>: text slots are escaped here, rich
    // slots were sanitised when they were saved.
    res.locals.slot = (key) => {
        const definition = getSlot(key);
        if (definition == null) return '';

        const value = getContentValue(key);
        const html = definition.type === SLOT_TYPE.TEXT ? escapeHtml(value) : value;

        if (!editMode) return html;

        // A field with no value is rendered genuinely empty. The editor draws
        // the hint with a CSS ::before on :empty, so typing starts from a clean
        // field instead of inside the hint text, and an emptied field keeps its
        // dashed outline instead of collapsing to nothing.
        //
        // `data-slot-placeholder` therefore carries hint *text*, not a value —
        // it is never stored and never shown to a visitor.
        return '<span class="ls-slot"'
            + ` data-slot="${escapeHtml(key)}"`
            + ` data-slot-type="${definition.type}"`
            + ` data-slot-max="${definition.max ?? 0}"`
            + ` data-slot-label="${escapeHtml(definition.label)}"`
            + ` data-slot-custom="${hasOverride(key) ? '1' : '0'}"`
            + (definition.optional === true ? ' data-slot-optional="1"' : '')
            + (definition.placeholder != null
                ? ` data-slot-placeholder="${escapeHtml(definition.placeholder)}"` : '')
            + ' contenteditable="true" spellcheck="false" role="textbox">'
            + html
            + '</span>';
    };

    // Whether an optional slot has been filled in — the template uses it to
    // leave the element out entirely for visitors.
    res.locals.slotHasValue = (key) => getContentValue(key) !== '';

    // The URL for an image slot. The template also carries a data-img-slot
    // attribute, which is what the editor hooks its overlay onto.
    res.locals.imgSrc = (key) => escapeHtml(getContentValue(key));

    res.locals.hasOverride = hasOverride;

    // The Programme timelines, one per ceremony. In edit mode the template
    // renders each whole pool and hides the entries past the count, so the
    // editor can reveal one without having to build markup in JavaScript —
    // which is what would otherwise let the editor's copy of the design drift
    // from the template's.
    res.locals.programLocations = PROGRAM_LOCATIONS.map((location) => ({
        id: location.id,
        label: location.label,
        count: Math.min(
            Math.max(
                Number.parseInt(getContentValue(`home.program.${location.id}.count`), 10)
                    || MIN_PROGRAM_ITEMS,
                MIN_PROGRAM_ITEMS
            ),
            MAX_PROGRAM_ITEMS
        )
    }));
    res.locals.maxProgramItems = MAX_PROGRAM_ITEMS;

    next();
}
