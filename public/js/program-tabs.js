// Programme location tabs.
//
// Loaded for everyone, not just the admin: the two ceremonies are a feature of
// the site, and a guest switching between Abidjan and Ouagadougou should not
// cost a page load.
//
// Both panels are always in the DOM. Switching is a class swap, which means the
// editor can edit the hidden ceremony simply by bringing it to the front —
// there is no second rendering path to keep in step.

(function () {
    "use strict";

    var tabs = Array.prototype.slice.call(document.querySelectorAll("[data-program-tab]"));
    var panels = Array.prototype.slice.call(document.querySelectorAll("[data-program-panel]"));

    if (tabs.length === 0 || panels.length === 0) return;

    function select(locationId) {
        tabs.forEach(function (tab) {
            var active = tab.dataset.programTab === locationId;
            tab.classList.toggle("is-active", active);
            tab.setAttribute("aria-selected", active ? "true" : "false");
        });

        panels.forEach(function (panel) {
            panel.classList.toggle("is-active", panel.dataset.programPanel === locationId);
        });
    }

    tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
            select(tab.dataset.programTab);
        });

        // Left/right arrows move between tabs, which is what a screen reader
        // user expects from role="tablist".
        tab.addEventListener("keydown", function (event) {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

            event.preventDefault();
            var index = tabs.indexOf(tab);
            var next = event.key === "ArrowRight"
                ? (index + 1) % tabs.length
                : (index - 1 + tabs.length) % tabs.length;

            tabs[next].focus();
            select(tabs[next].dataset.programTab);
        });
    });

    // Lets the editor bring a hidden ceremony to the front when it needs to.
    window.lsSelectProgramLocation = select;
})();
