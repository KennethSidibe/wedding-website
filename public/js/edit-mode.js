// Edit mode.
//
// Only served to an authenticated admin who reached the page through the admin
// dashboard. It turns the real page into the editor: no separate preview, no
// second rendering path, so what the admin edits is literally what a guest will
// see.
//
// Two invariants shape the whole file:
//
//   1. Nothing is written to the server until "Enregistrer" is pressed. Every
//      change lives in `pending` until then, which is what makes "Annuler"
//      trivially correct — it just reloads the page.
//   2. The editor never changes the page's layout. It adds classes and reads
//      geometry; the only positioned elements it owns are fixed-position chrome
//      appended outside the content.

(function () {
    "use strict";

    var bar = document.getElementById("lsEditBar");
    if (bar == null) return;

    var CSRF_TOKEN = bar.dataset.csrf;
    var PAGE = bar.dataset.page;

    var saveButton = document.getElementById("lsEditSave");
    var discardButton = document.getElementById("lsEditDiscard");
    var exitButton = document.getElementById("lsEditExit");
    var resetButton = document.getElementById("lsEditReset");
    var statusLabel = document.getElementById("lsEditStatus");

    var toastElement = document.getElementById("lsEditToast");
    var counterElement = document.getElementById("lsSlotCounter");

    var imageOverlay = document.getElementById("lsImageOverlay");
    var imageChangeButton = document.getElementById("lsImageChange");
    var imageResetButton = document.getElementById("lsImageReset");
    var imageInput = document.getElementById("lsImageInput");

    var buttonOverlay = document.getElementById("lsButtonOverlay");

    // slot key -> value as it was when the page loaded (or as last saved).
    var baseline = new Map();
    // slot key -> unsaved value. Its size is the "N modifications" count.
    var pending = new Map();

    // Colour slot definitions (key, label, short, cssVar, current value),
    // published by the server so the picker needs no round trip.
    var colorSlots = new Map();
    (function loadColorSlots() {
        var node = document.getElementById("lsColorSlots");
        if (node == null) return;
        try {
            JSON.parse(node.textContent).forEach(function (slot) {
                colorSlots.set(slot.key, slot);
                baseline.set(slot.key, String(slot.value).toLowerCase());
            });
        } catch (error) {
            /* the picker simply will not open */
        }
    })();

    // True on devices that cannot hover — phones and tablets. `(hover: none)`
    // is the right question to ask: a touchscreen laptop still has a mouse and
    // should keep the desktop behaviour, so `maxTouchPoints` would be wrong.
    var NO_HOVER = window.matchMedia != null
        && window.matchMedia("(hover: none)").matches;

    // Set before navigations the editor itself triggers, so the unsaved-changes
    // guard does not fire on them.
    var allowUnload = false;

    var toastTimer = null;

    // ------------------------------------------------------------ utilities

    function escapeText(value) {
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    // The client-side half of the sanitiser. The server sanitises again on
    // write and is the authority; this exists so that what the admin sees in
    // the editor is already what will be stored, rather than something the
    // server silently rewrites afterwards.
    var ALLOWED_TAGS = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1 };

    function serializeRich(node) {
        var out = "";

        node.childNodes.forEach(function (child) {
            if (child.nodeType === Node.TEXT_NODE) {
                out += escapeText(child.nodeValue);
                return;
            }
            if (child.nodeType !== Node.ELEMENT_NODE) return;

            var tag = child.tagName;

            if (tag === "BR") {
                out += "<br>";
                return;
            }

            var inner = serializeRich(child);

            if (ALLOWED_TAGS[tag] === 1) {
                var name = tag.toLowerCase();
                out += "<" + name + ">" + inner + "</" + name + ">";
            } else if (tag === "DIV" || tag === "P") {
                // Browsers wrap new lines in DIVs inside contenteditable;
                // fold them back into the <br> the templates use.
                out += (out === "" ? "" : "<br>") + inner;
            } else {
                // Anything else (a pasted span carrying styles, a stray font
                // tag) loses its wrapper and keeps only its text.
                out += inner;
            }
        });

        return out;
    }

    function readSlot(element) {
        if (element.dataset.slotType === "text") {
            return element.textContent.replace(/\s+/g, " ").trim();
        }
        return serializeRich(element).trim();
    }

    function plainLength(element) {
        return element.textContent.replace(/ /g, " ").length;
    }

    function slotMax(element) {
        return Number(element.dataset.slotMax) || 0;
    }

    function showToast(message, kind) {
        toastElement.textContent = message;
        toastElement.className = "ls-edit-toast" + (kind ? " is-" + kind : "");
        toastElement.hidden = false;

        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(function () {
            toastElement.hidden = true;
        }, kind === "error" ? 6000 : 3000);
    }

    // The bar is fixed, so the page is pushed down by a body padding whose size
    // has to match the bar exactly. Measuring beats hardcoding: the buttons
    // wrap at small widths and the title wraps on narrow screens.
    function measureBar() {
        document.documentElement.style.setProperty(
            "--ls-edit-offset",
            bar.offsetHeight + "px"
        );
    }

    // --------------------------------------------------------- dirty state

    function emptySlotExists() {
        return Array.prototype.some.call(
            document.querySelectorAll(".ls-slot"),
            function (element) {
                return plainLength(element) === 0;
            }
        );
    }

    function refreshBar() {
        var count = pending.size;
        var blocked = emptySlotExists();

        if (count === 0) {
            statusLabel.textContent = "Aucune modification";
            statusLabel.classList.remove("is-dirty");
        } else {
            statusLabel.textContent =
                count + " modification" + (count > 1 ? "s" : "") + " non enregistrée" + (count > 1 ? "s" : "");
            statusLabel.classList.add("is-dirty");
        }

        saveButton.disabled = count === 0 || blocked;
        discardButton.disabled = count === 0;

        saveButton.textContent = count === 0 ? "Enregistrer" : "Enregistrer (" + count + ")";
        saveButton.title = blocked
            ? "Un champ est vide. Remplissez-le avant d'enregistrer."
            : "";
    }

    function setPending(key, value) {
        if (value === baseline.get(key)) {
            pending.delete(key);
        } else {
            pending.set(key, value);
        }
        refreshBar();
    }

    function syncSlot(element) {
        var key = element.dataset.slot;
        var value = readSlot(element);
        var max = slotMax(element);

        setPending(key, value);

        element.classList.toggle("is-dirty", pending.has(key));
        element.classList.toggle("is-at-limit", max > 0 && plainLength(element) >= max);
    }

    // ---------------------------------------------------------- text slots

    function positionCounter(element) {
        var max = slotMax(element);
        if (max === 0) {
            counterElement.hidden = true;
            return;
        }

        var used = plainLength(element);

        // Only appears when the limit is actually in play — a counter on every
        // field would be noise on a page that is mostly short labels.
        if (used < max * 0.75) {
            counterElement.hidden = true;
            return;
        }

        var rect = element.getBoundingClientRect();
        counterElement.textContent = used + " / " + max;
        counterElement.classList.toggle("is-at-limit", used >= max);
        counterElement.style.left = Math.max(8, rect.left) + "px";
        counterElement.style.top = Math.max(8, rect.top - 24) + "px";
        counterElement.hidden = false;
    }

    function selectionLength() {
        var selection = window.getSelection();
        if (selection == null || selection.isCollapsed) return 0;
        return selection.toString().length;
    }

    function onBeforeInput(event) {
        var element = event.currentTarget;
        var max = slotMax(element);
        if (max === 0) return;

        var type = event.inputType || "";
        if (type.indexOf("insert") !== 0) return;
        if (type === "insertFromPaste") return; // handled by the paste listener

        var incoming = event.data != null ? event.data.length : 1;

        if (plainLength(element) - selectionLength() + incoming > max) {
            event.preventDefault();
            element.classList.add("is-at-limit");
            positionCounter(element);
        }
    }

    function onPaste(event) {
        var element = event.currentTarget;
        event.preventDefault();

        // Always plain text. A paste from Word or from another website carries
        // its own fonts, colours and margins, and letting that through is the
        // single most likely way an admin could wreck the design.
        var clipboard = event.clipboardData || window.clipboardData;
        var text = clipboard ? clipboard.getData("text/plain") : "";
        if (text === "") return;

        if (element.dataset.slotType === "text") {
            text = text.replace(/\s+/g, " ");
        }

        var max = slotMax(element);
        if (max > 0) {
            var room = max - (plainLength(element) - selectionLength());
            if (room <= 0) {
                showToast("Limite de " + max + " caractères atteinte.", "error");
                return;
            }
            if (text.length > room) {
                text = text.slice(0, room);
                showToast("Texte raccourci à " + max + " caractères pour préserver la mise en page.", null);
            }
        }

        document.execCommand("insertText", false, text);
    }

    function onKeyDown(event) {
        var element = event.currentTarget;
        var isText = element.dataset.slotType === "text";

        if (event.key === "Enter") {
            // A title, a date or a button label has nowhere to put a second
            // line, so Enter is simply refused there.
            if (isText) {
                event.preventDefault();
                return;
            }
            event.preventDefault();
            if (!document.execCommand("insertLineBreak")) {
                document.execCommand("insertHTML", false, "<br>");
            }
            return;
        }

        // Bold/italic/underline are allowed in paragraphs (they survive the
        // sanitiser) but meaningless in a single-line field.
        if (isText && (event.ctrlKey || event.metaKey)) {
            var key = event.key.toLowerCase();
            if (key === "b" || key === "i" || key === "u") {
                event.preventDefault();
            }
        }

        if (event.key === "Escape") {
            element.blur();
        }
    }

    function initTextSlots() {
        document.querySelectorAll(".ls-slot").forEach(function (element) {
            baseline.set(element.dataset.slot, readSlot(element));

            element.addEventListener("beforeinput", onBeforeInput);
            element.addEventListener("paste", onPaste);
            element.addEventListener("keydown", onKeyDown);

            element.addEventListener("input", function () {
                syncSlot(element);
                positionCounter(element);
            });

            element.addEventListener("focus", function () {
                positionCounter(element);
            });

            element.addEventListener("blur", function () {
                counterElement.hidden = true;
                syncSlot(element);
            });

            // Dropping content into a contenteditable bypasses the paste
            // handler and can carry arbitrary markup with it.
            element.addEventListener("drop", function (event) {
                event.preventDefault();
            });
        });
    }

    // -------------------------------------------------------- image slots

    var hoverTarget = null;

    // The controls float a few pixels clear of the element they belong to, so
    // the pointer necessarily leaves both on its way to the buttons — hiding on
    // the first stray mousemove made them impossible to click. They now linger,
    // and any move back onto the element or the control itself cancels the
    // pending hide.
    var HOVER_HIDE_DELAY = 3000;
    var hoverHideTimer = null;

    function cancelHoverHide() {
        window.clearTimeout(hoverHideTimer);
        hoverHideTimer = null;
    }

    function scheduleHoverHide() {
        if (hoverHideTimer != null) return;
        hoverHideTimer = window.setTimeout(function () {
            hoverHideTimer = null;
            hideHoverControls();
        }, HOVER_HIDE_DELAY);
    }

    function currentImageValue(element) {
        if (element.tagName === "IMG") {
            return element.getAttribute("src");
        }
        return element.dataset.imgValue || "";
    }

    function applyImageValue(element, url) {
        if (element.tagName === "IMG") {
            element.setAttribute("src", url);
            return;
        }
        // Background images are driven by a CSS custom property so the
        // stylesheet keeps ownership of sizing, position and the media query.
        // Which property is named by the element itself — inferring it from
        // class names meant every new background slot had to be added to a
        // chain of ifs here, which is how the Offrir photo came to be the only
        // uneditable image on the site.
        element.style.setProperty(
            element.dataset.imgVar || "--ls-hero-image",
            'url("' + url + '")'
        );
        element.dataset.imgValue = url;
    }

    function positionOverlay(overlay, element, placement) {
        var rect = element.getBoundingClientRect();

        overlay.hidden = false;
        var width = overlay.offsetWidth;
        var height = overlay.offsetHeight;

        var left = rect.left + rect.width / 2 - width / 2;
        var top = placement === "above"
            // Anchored above the element: a control centred on a button would
            // cover the label, which is itself editable text.
            ? rect.top - height - 10
            : rect.top + rect.height / 2 - height / 2;

        // Never let a control leave the viewport, or it becomes unclickable
        // for an element at the very top of the page.
        left = Math.min(Math.max(8, left), window.innerWidth - width - 8);
        top = Math.min(Math.max(8, top), window.innerHeight - height - 8);

        overlay.style.left = left + "px";
        overlay.style.top = top + "px";
    }

    function hideHoverControls() {
        cancelHoverHide();
        if (hoverTarget != null) {
            hoverTarget.classList.remove("ls-img-hover", "ls-color-hover");
            setLabelEditable(hoverTarget, false);
        }
        hoverTarget = null;
        imageOverlay.hidden = true;
        buttonOverlay.hidden = true;
    }

    function showImageControls(element) {
        cancelHoverHide();

        if (hoverTarget === element) {
            positionOverlay(imageOverlay, element, "center");
            return;
        }

        hideHoverControls();
        hoverTarget = element;
        element.classList.add("ls-img-hover");

        imageResetButton.hidden = !pending.has(element.dataset.imgSlot);
        positionOverlay(imageOverlay, element, "center");
    }

    // Builds the little control that floats above a button: one chip per
    // colour the element owns, each showing that colour as a dot.
    function showColorControls(element) {
        cancelHoverHide();

        if (hoverTarget === element) {
            positionOverlay(buttonOverlay, element, "above");
            return;
        }

        hideHoverControls();
        hoverTarget = element;
        element.classList.add("ls-color-hover");
        setLabelEditable(element, true);

        buttonOverlay.textContent = "";

        element.dataset.colorSlots.split("|").forEach(function (key) {
            var definition = colorSlots.get(key);
            if (definition == null) return;

            var chip = document.createElement("button");
            chip.type = "button";
            chip.className = "ls-button-chip";

            var dot = document.createElement("span");
            dot.className = "ls-button-chip-dot";
            dot.style.background = currentColorValue(key);

            chip.appendChild(dot);
            chip.appendChild(document.createTextNode(definition.short));

            chip.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                cancelHoverHide();
                openColorPicker(key, element);
            });

            buttonOverlay.appendChild(chip);
        });

        positionOverlay(buttonOverlay, element, "above");
    }

    // On a phone, tapping a button's label did two things at once: it revealed
    // the colour chips (via the synthetic mousemove a tap produces) *and*
    // focused the contenteditable, throwing up the keyboard over the controls
    // that had just appeared. Making those labels non-editable until their
    // controls are showing splits it into two deliberate taps: reveal, then
    // edit. Desktop is untouched — with a mouse, hover reveals the controls
    // before any click happens, so there is nothing to disambiguate.
    function initDeferredLabels() {
        if (!NO_HOVER) return;

        document.querySelectorAll("[data-color-slots] .ls-slot").forEach(function (element) {
            element.dataset.deferEdit = "1";
            element.setAttribute("contenteditable", "false");
        });
    }

    function setLabelEditable(element, editable) {
        if (!NO_HOVER || element == null || element.querySelectorAll == null) return;

        // Setting contenteditable="false" on a focused element blurs it and
        // drops the on-screen keyboard. Opening that keyboard fires a resize,
        // which is one of the things that hides the controls — so without this
        // guard the field being typed in would close itself the moment the
        // keyboard appeared.
        if (!editable && element.contains(document.activeElement)) return;

        element.querySelectorAll(".ls-slot[data-defer-edit]").forEach(function (label) {
            label.setAttribute("contenteditable", editable ? "true" : "false");
        });
    }

    function initImageSlots() {
        document.querySelectorAll("[data-img-slot]").forEach(function (element) {
            if (element.tagName !== "IMG" && element.dataset.imgValue == null) {
                // A background image with no server-stamped value. Falling back
                // to the computed style is unreliable — a strip is display:none
                // below 1000px and reports no background at all — so every
                // background slot stamps data-img-value in the template and
                // this branch should never run.
                var computed = window.getComputedStyle(element).backgroundImage;
                var match = /url\(["']?([^"')]+)["']?\)/.exec(computed);
                element.dataset.imgValue = match ? match[1].replace(window.location.origin, "") : "";
            }
            baseline.set(element.dataset.imgSlot, currentImageValue(element));
        });

        // One listener for both kinds of control. `closest` with a combined
        // selector returns the *nearest* match, which resolves the nesting
        // correctly: the hero dates carry a colour slot and sit inside the hero
        // photo, and hovering them must offer the text colour, not the photo.
        document.addEventListener("mousemove", function (event) {
            // Moving onto a control keeps it up: the pointer is on its way to
            // a button, not away from the element.
            if (event.target.closest("#lsImageOverlay, #lsButtonOverlay, #lsColorPicker") != null) {
                cancelHoverHide();
                return;
            }
            if (event.target.closest("#lsEditBar") != null) return;

            var element = event.target.closest("[data-img-slot], [data-color-slots]");

            if (element == null) {
                if (hoverTarget != null) scheduleHoverHide();
                return;
            }

            if (element.dataset.imgSlot != null) {
                showImageControls(element);
            } else {
                showColorControls(element);
            }
        });

        window.addEventListener("scroll", function () {
            if (hoverTarget == null) return;
            if (!imageOverlay.hidden) positionOverlay(imageOverlay, hoverTarget, "center");
            if (!buttonOverlay.hidden) positionOverlay(buttonOverlay, hoverTarget, "above");
        }, { passive: true });

        imageChangeButton.addEventListener("click", function () {
            if (hoverTarget == null) return;
            imageInput.dataset.targetSlot = hoverTarget.dataset.imgSlot;
            imageInput.click();
        });

        imageResetButton.addEventListener("click", function () {
            if (hoverTarget == null) return;

            var key = hoverTarget.dataset.imgSlot;
            applyImageValue(hoverTarget, baseline.get(key));
            pending.delete(key);
            hoverTarget.classList.remove("is-dirty");
            imageResetButton.hidden = true;
            refreshBar();
        });

        imageInput.addEventListener("change", function () {
            var file = imageInput.files && imageInput.files[0];
            var key = imageInput.dataset.targetSlot;
            imageInput.value = "";

            if (file == null || key == null) return;
            uploadPhoto(file, key);
        });
    }

    function uploadPhoto(file, key) {
        var element = document.querySelector('[data-img-slot="' + key + '"]');
        if (element == null) return;

        var form = new FormData();
        form.append("photo", file);

        imageOverlay.classList.add("is-busy");
        showToast("Envoi de la photo…", null);

        window.fetch("/admin/upload", {
            method: "POST",
            headers: { "X-CSRF-Token": CSRF_TOKEN },
            body: form
        })
            .then(function (response) {
                return response.json().then(function (data) {
                    return { ok: response.ok, data: data };
                });
            })
            .then(function (result) {
                imageOverlay.classList.remove("is-busy");

                if (!result.ok || !result.data.ok) {
                    showToast(result.data.error || "Échec de l'envoi de l'image.", "error");
                    return;
                }

                applyImageValue(element, result.data.url);
                setPending(key, result.data.url);
                element.classList.add("is-dirty");
                imageResetButton.hidden = !pending.has(key);

                showToast("Photo remplacée. Cliquez sur Enregistrer pour publier.", "success");
            })
            .catch(function () {
                imageOverlay.classList.remove("is-busy");
                showToast("Échec de l'envoi de l'image. Vérifiez votre connexion.", "error");
            });
    }

    // ------------------------------------------------------- colour picker

    var picker = document.getElementById("lsColorPicker");
    var pickerLabel = document.getElementById("lsColorPickerLabel");
    var pickerClose = document.getElementById("lsColorPickerClose");
    var colorArea = document.getElementById("lsColorArea");
    var colorAreaThumb = document.getElementById("lsColorAreaThumb");
    var colorHue = document.getElementById("lsColorHue");
    var colorHueThumb = document.getElementById("lsColorHueThumb");
    var colorSwatches = document.getElementById("lsColorSwatches");
    var colorPreview = document.getElementById("lsColorPreview");
    var colorHex = document.getElementById("lsColorHex");
    var colorReset = document.getElementById("lsColorReset");

    var pickerSlot = null;
    var pickerHsv = { h: 0, s: 1, v: 1 };

    var SWATCHES = [
        "#7b1b38", "#591427", "#a72e52", "#c2185b",
        "#0f172a", "#334155", "#64748b", "#ffffff",
        "#1d7a4c", "#2563eb", "#b45309", "#d97706"
    ];

    function clamp01(value) {
        return Math.min(1, Math.max(0, value));
    }

    function hexToRgb(hex) {
        var value = String(hex).replace("#", "");
        if (value.length === 3) {
            value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
        }
        var number = parseInt(value, 16);
        if (isNaN(number)) return { r: 0, g: 0, b: 0 };
        return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
    }

    function rgbToHex(r, g, b) {
        function part(value) {
            var text = Math.round(value).toString(16);
            return text.length === 1 ? "0" + text : text;
        }
        return "#" + part(r) + part(g) + part(b);
    }

    function rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;

        var max = Math.max(r, g, b);
        var min = Math.min(r, g, b);
        var delta = max - min;
        var h = 0;

        if (delta !== 0) {
            if (max === r) h = ((g - b) / delta) % 6;
            else if (max === g) h = (b - r) / delta + 2;
            else h = (r - g) / delta + 4;
            h *= 60;
            if (h < 0) h += 360;
        }

        return { h: h, s: max === 0 ? 0 : delta / max, v: max };
    }

    function hsvToRgb(h, s, v) {
        var c = v * s;
        var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        var m = v - c;
        var rgb;

        if (h < 60) rgb = [c, x, 0];
        else if (h < 120) rgb = [x, c, 0];
        else if (h < 180) rgb = [0, c, x];
        else if (h < 240) rgb = [0, x, c];
        else if (h < 300) rgb = [x, 0, c];
        else rgb = [c, 0, x];

        return {
            r: (rgb[0] + m) * 255,
            g: (rgb[1] + m) * 255,
            b: (rgb[2] + m) * 255
        };
    }

    function currentColorValue(key) {
        if (pending.has(key)) return pending.get(key);
        return baseline.get(key) || "#000000";
    }

    // Pushes the picker's colour to the live page, to the picker's own widgets,
    // and into the pending set. Applying it to the page immediately is the
    // whole point of editing in place: the admin sees the button change colour
    // as they drag.
    function applyPickerColor(commit) {
        var rgb = hsvToRgb(pickerHsv.h, pickerHsv.s, pickerHsv.v);
        var hex = rgbToHex(rgb.r, rgb.g, rgb.b);
        var definition = colorSlots.get(pickerSlot);

        colorArea.style.setProperty(
            "--ls-picker-hue",
            rgbToHex(
                hsvToRgb(pickerHsv.h, 1, 1).r,
                hsvToRgb(pickerHsv.h, 1, 1).g,
                hsvToRgb(pickerHsv.h, 1, 1).b
            )
        );

        colorAreaThumb.style.left = (pickerHsv.s * 100) + "%";
        colorAreaThumb.style.top = ((1 - pickerHsv.v) * 100) + "%";
        colorHueThumb.style.left = ((pickerHsv.h / 360) * 100) + "%";

        colorPreview.style.background = hex;
        if (document.activeElement !== colorHex) colorHex.value = hex;

        if (definition != null) {
            document.documentElement.style.setProperty(definition.cssVar, hex);
        }

        if (commit) {
            setPending(pickerSlot, hex);
            refreshHoverDots();
        }
    }

    function refreshHoverDots() {
        if (hoverTarget == null || hoverTarget.dataset.colorSlots == null) return;
        var keys = hoverTarget.dataset.colorSlots.split("|");
        buttonOverlay.querySelectorAll(".ls-button-chip-dot").forEach(function (dot, index) {
            if (keys[index] != null) dot.style.background = currentColorValue(keys[index]);
        });
    }

    function setPickerFromHex(hex, commit) {
        var rgb = hexToRgb(hex);
        pickerHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
        applyPickerColor(commit);
    }

    function openColorPicker(key, anchor) {
        var definition = colorSlots.get(key);
        if (definition == null) return;

        pickerSlot = key;
        pickerLabel.textContent = definition.label;

        picker.hidden = false;
        setPickerFromHex(currentColorValue(key), false);

        var rect = anchor.getBoundingClientRect();
        var width = picker.offsetWidth;
        var height = picker.offsetHeight;

        var left = Math.min(
            Math.max(8, rect.left + rect.width / 2 - width / 2),
            window.innerWidth - width - 8
        );
        // Prefer above the element, fall back to below when there is no room.
        var top = rect.top - height - 12;
        if (top < 8) top = Math.min(rect.bottom + 12, window.innerHeight - height - 8);

        picker.style.left = left + "px";
        picker.style.top = top + "px";
    }

    function closeColorPicker() {
        picker.hidden = true;
        pickerSlot = null;
    }

    // One drag handler for both the square and the hue strip.
    function trackPointer(element, onMove) {
        function handle(event) {
            var rect = element.getBoundingClientRect();
            onMove(
                clamp01((event.clientX - rect.left) / rect.width),
                clamp01((event.clientY - rect.top) / rect.height)
            );
        }

        element.addEventListener("pointerdown", function (event) {
            event.preventDefault();

            try {
                element.setPointerCapture(event.pointerId);
            } catch (error) {
                /* capture is an optimisation, not a requirement */
            }

            handle(event);

            function move(moveEvent) { handle(moveEvent); }

            function end() {
                element.removeEventListener("pointermove", move);
                element.removeEventListener("pointerup", end);
                // pointercancel fires when the browser takes the gesture over
                // (a scroll, a system swipe, a second finger). Without this the
                // listeners leaked and the square stayed live after the finger
                // was gone.
                element.removeEventListener("pointercancel", end);

                try {
                    element.releasePointerCapture(event.pointerId);
                } catch (error) {
                    /* already released */
                }
            }

            element.addEventListener("pointermove", move);
            element.addEventListener("pointerup", end);
            element.addEventListener("pointercancel", end);
        });
    }

    function initColorPicker() {
        SWATCHES.forEach(function (hex) {
            var swatch = document.createElement("button");
            swatch.type = "button";
            swatch.className = "ls-color-swatch";
            swatch.style.background = hex;
            swatch.title = hex;
            swatch.addEventListener("click", function () {
                setPickerFromHex(hex, true);
            });
            colorSwatches.appendChild(swatch);
        });

        trackPointer(colorArea, function (x, y) {
            pickerHsv.s = x;
            pickerHsv.v = 1 - y;
            applyPickerColor(true);
        });

        trackPointer(colorHue, function (x) {
            pickerHsv.h = x * 360;
            applyPickerColor(true);
        });

        colorHex.addEventListener("input", function () {
            if (/^#[0-9a-fA-F]{6}$/.test(colorHex.value)) {
                setPickerFromHex(colorHex.value, true);
            }
        });

        colorReset.addEventListener("click", function () {
            if (pickerSlot == null) return;
            var definition = colorSlots.get(pickerSlot);
            pending.delete(pickerSlot);
            document.documentElement.style.removeProperty(definition.cssVar);
            setPickerFromHex(baseline.get(pickerSlot), false);
            refreshHoverDots();
            refreshBar();
        });

        pickerClose.addEventListener("click", closeColorPicker);

        document.addEventListener("mousedown", function (event) {
            if (picker.hidden) return;
            if (event.target.closest("#lsColorPicker, #lsButtonOverlay") != null) return;
            closeColorPicker();
        });
    }

    // ------------------------------------------------- confirmation dialog

    var confirmRoot = document.getElementById("lsConfirm");
    var confirmTitle = document.getElementById("lsConfirmTitle");
    var confirmText = document.getElementById("lsConfirmText");
    var confirmPoints = document.getElementById("lsConfirmPoints");
    var confirmOk = document.getElementById("lsConfirmOk");
    var confirmCancel = document.getElementById("lsConfirmCancel");
    var confirmBackdrop = confirmRoot.querySelector("[data-confirm-cancel]");

    // Replaces window.confirm() for the actions that discard work or log the
    // admin out. The native dialog cannot be styled, has no room to spell out
    // consequences, and in some browsers is a thin strip at the top of the
    // window that is easy to dismiss without reading.
    //
    // It resolves a promise rather than returning a value, so it cannot cancel
    // a navigation the way `return false` used to — every caller must therefore
    // preventDefault first and navigate itself afterwards.
    function askConfirm(options) {
        return new Promise(function (resolve) {

            confirmTitle.textContent = options.title;
            confirmText.textContent = options.text;
            confirmOk.textContent = options.okLabel;
            confirmCancel.textContent = options.cancelLabel;

            confirmPoints.textContent = "";
            var points = options.points || [];
            points.forEach(function (point) {
                var item = document.createElement("li");
                item.textContent = point;
                confirmPoints.appendChild(item);
            });
            confirmPoints.hidden = points.length === 0;

            confirmRoot.classList.toggle("is-danger", options.danger === true);
            confirmRoot.hidden = false;
            document.body.classList.add("ls-confirm-open");

            // Focus lands on Cancel, never on the destructive button: a stray
            // Enter or Space must not confirm the thing being warned about.
            confirmCancel.focus();

            function close(answer) {
                confirmRoot.hidden = true;
                document.body.classList.remove("ls-confirm-open");

                confirmOk.removeEventListener("click", onOk);
                confirmCancel.removeEventListener("click", onCancel);
                confirmBackdrop.removeEventListener("click", onCancel);
                document.removeEventListener("keydown", onKeyDown, true);

                resolve(answer);
            }

            function onOk() { close(true); }
            function onCancel() { close(false); }

            function onKeyDown(event) {
                if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    close(false);
                    return;
                }
                // Keep the tab ring inside the dialog while it is open.
                if (event.key === "Tab") {
                    event.preventDefault();
                    (document.activeElement === confirmCancel ? confirmOk : confirmCancel).focus();
                }
            }

            confirmOk.addEventListener("click", onOk);
            confirmCancel.addEventListener("click", onCancel);
            confirmBackdrop.addEventListener("click", onCancel);
            document.addEventListener("keydown", onKeyDown, true);
        });
    }

    function isConfirmOpen() {
        return !confirmRoot.hidden;
    }

    // Phrases "3 modifications non enregistrées seront perdues" correctly.
    function unsavedWarning(count) {
        return count + " modification" + (count > 1 ? "s" : "")
            + " non enregistrée" + (count > 1 ? "s seront perdues" : " sera perdue")
            + " définitivement.";
    }

    // -------------------------------------------------------------- saving

    function save() {
        if (pending.size === 0) return;

        var updates = {};
        pending.forEach(function (value, key) {
            updates[key] = value;
        });

        saveButton.disabled = true;
        saveButton.textContent = "Enregistrement…";

        window.fetch("/admin/content", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": CSRF_TOKEN
            },
            body: JSON.stringify({ updates: updates })
        })
            .then(function (response) {
                return response.json().then(function (data) {
                    return { ok: response.ok, data: data };
                });
            })
            .then(function (result) {
                if (!result.ok || !result.data.ok) {
                    showToast(result.data.error || "Échec de l'enregistrement.", "error");
                    refreshBar();
                    return;
                }

                pending.forEach(function (value, key) {
                    baseline.set(key, value);
                });
                pending.clear();

                document.querySelectorAll(".is-dirty").forEach(function (element) {
                    element.classList.remove("is-dirty");
                });

                showToast("Modifications publiées sur le site.", "success");
                refreshBar();
            })
            .catch(function () {
                showToast("Échec de l'enregistrement. Vérifiez votre connexion.", "error");
                refreshBar();
            });
    }

    function discard() {
        var unsaved = pending.size;
        if (unsaved === 0) return;

        askConfirm({
            title: "Annuler les modifications ?",
            text: "La page reviendra à ce qui est actuellement publié sur le site.",
            points: [unsavedWarning(unsaved), "Ce qui est déjà publié ne sera pas touché."],
            okLabel: "Annuler les modifications",
            cancelLabel: "Continuer à modifier",
            danger: true
        }).then(function (confirmed) {
            if (!confirmed) return;
            allowUnload = true;
            window.location.reload();
        });
    }

    function resetPage() {
        askConfirm({
            title: "Rétablir le contenu d'origine ?",
            text: "Cette page retrouvera le texte, les photos et les couleurs livrés avec le site.",
            points: [
                "Toutes vos modifications publiées sur cette page seront effacées.",
                "L'action est immédiate et ne peut pas être annulée.",
                "Vous resterez en mode édition pour continuer à travailler."
            ],
            okLabel: "Rétablir la page",
            cancelLabel: "Annuler",
            danger: true
        }).then(function (confirmed) {
            if (confirmed) requestReset();
        });
    }

    function requestReset() {
        window.fetch("/admin/content/reset", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": CSRF_TOKEN
            },
            body: JSON.stringify({ page: PAGE, includeSite: true })
        })
            .then(function (response) {
                return response.json().then(function (data) {
                    return { ok: response.ok, data: data };
                });
            })
            .then(function (result) {
                if (!result.ok || !result.data.ok) {
                    showToast(result.data.error || "Échec du rétablissement.", "error");
                    return;
                }

                // Explicitly back into edit mode rather than location.reload().
                // A reload only preserves ?edit=1 if it is still on the URL, and
                // the admin has no reason to be thrown out of the editor by an
                // action taken inside it — they will usually want to carry on
                // editing straight after restoring the originals.
                pending.clear();
                allowUnload = true;
                window.location.href = window.location.pathname + "?edit=1";
            })
            .catch(function () {
                showToast("Échec du rétablissement. Vérifiez votre connexion.", "error");
            });
    }

    // Quitter logs the admin out entirely — the session token is destroyed
    // server-side, not merely flagged closed. That is what makes the back
    // button safe: returning to /?edit=1 finds no session at all and renders
    // the ordinary public page. The cost is one PIN entry to resume, which is
    // cheap next to leaving an unattended browser one Back press away from an
    // editor that can rewrite the site.
    function exitEditMode() {
        var unsaved = pending.size;

        var points = ["Vous devrez saisir votre code PIN pour revenir en mode édition."];
        if (unsaved > 0) {
            points.unshift(unsavedWarning(unsaved));
        }

        askConfirm({
            title: "Quitter le mode édition ?",
            text: unsaved > 0
                ? "Vous allez être déconnecté et vos modifications en cours ne seront pas publiées."
                : "Vous allez être déconnecté. Le site reste en ligne tel qu'il est aujourd'hui.",
            points: points,
            okLabel: "Quitter et se déconnecter",
            cancelLabel: unsaved > 0 ? "Continuer à modifier" : "Rester",
            danger: unsaved > 0
        }).then(function (confirmed) {
            if (!confirmed) return;

            allowUnload = true;

            function leave() {
                window.location.href = window.location.pathname;
            }

            window.fetch("/admin/edit/exit", {
                method: "POST",
                headers: { "X-CSRF-Token": CSRF_TOKEN }
            }).then(leave, leave);
        });
    }

    // ---------------------------------------------------------------- init

    initTextSlots();
    initDeferredLabels();
    initImageSlots();
    initColorPicker();

    saveButton.addEventListener("click", save);
    discardButton.addEventListener("click", discard);
    resetButton.addEventListener("click", resetPage);
    exitButton.addEventListener("click", exitEditMode);

    // A link wrapping editable content would navigate away the moment the admin
    // clicked the text to edit it — which is exactly what the "S'enregistrer"
    // and "Offrir" buttons did. Only those links are neutralised; the navbar
    // and footer still work, so the editor does not trap the admin on one page.
    document.addEventListener("click", function (event) {
        var link = event.target.closest("a");
        if (link == null || link.hasAttribute("data-edit-link")) return;
        if (link.closest("#lsEditBar") != null) return;

        if (link.querySelector(".ls-slot, [data-color-slots]") != null) {
            event.preventDefault();
        }
    });

    // Ctrl/Cmd+S is the reflex for anything that looks like an editor.
    document.addEventListener("keydown", function (event) {
        if (isConfirmOpen()) return;

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            save();
        }
        if (event.key === "Escape" && !picker.hidden) {
            closeColorPicker();
        }
    });

    document.querySelectorAll("[data-edit-link]").forEach(function (link) {
        link.addEventListener("click", function (event) {
            var unsaved = pending.size;

            if (unsaved === 0) {
                allowUnload = true;
                return;
            }

            // The dialog is asynchronous, so the navigation has to be stopped
            // first and re-issued by hand if the admin confirms.
            event.preventDefault();
            var destination = link.getAttribute("href");

            askConfirm({
                title: "Changer de page ?",
                text: "Vos modifications sur cette page n'ont pas encore été publiées.",
                points: [unsavedWarning(unsaved)],
                okLabel: "Changer de page",
                cancelLabel: "Continuer à modifier",
                danger: true
            }).then(function (confirmed) {
                if (!confirmed) return;
                allowUnload = true;
                window.location.href = destination;
            });
        });
    });

    window.addEventListener("beforeunload", function (event) {
        if (allowUnload || pending.size === 0) return;
        event.preventDefault();
        event.returnValue = "";
    });

    window.addEventListener("resize", function () {
        measureBar();

        // On a phone the on-screen keyboard opening *is* a resize event. If a
        // field has focus this is that, not a real viewport change, and tearing
        // down the controls mid-edit would be wrong.
        if (document.activeElement != null
            && document.activeElement.classList.contains("ls-slot")) {
            return;
        }

        hideHoverControls();
        closeColorPicker();
    });

    measureBar();
    refreshBar();
})();
