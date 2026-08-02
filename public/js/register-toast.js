// The floating confirmation card.
//
// Two callers today: the post-registration "Merci" card on the home page, and
// the "you left the editor open" notice on the admin dashboard. They behave
// identically, so they share one implementation rather than two copies that
// would drift.
//
// DISPLAY_DURATION is duplicated as the `5s` countdown animation in
// /styles/toast.css. Change one, change the other — the bar animates on the
// compositor while the JS owns removal.
const DISPLAY_DURATION = 5000;
const FADE_OUT_DURATION = 500;

function setupToast(toast, options) {
    if (!toast) return;

    const closeBtn = toast.querySelector('.register-toast-close');
    const duration = options.duration || DISPLAY_DURATION;
    let dismissTimer = null;

    function dismiss() {
        if (toast.classList.contains('is-leaving')) {
            return;
        }

        clearTimeout(dismissTimer);
        toast.classList.add('is-leaving');

        setTimeout(() => {
            toast.remove();
        }, FADE_OUT_DURATION);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', dismiss);
    }
    dismissTimer = setTimeout(dismiss, duration);

    // Let the entrance animation run on the next frame.
    requestAnimationFrame(() => {
        toast.classList.add('is-visible');
    });
}

const registerToast = document.querySelector('#registerToast');

if (registerToast) {
    // Drop the query param so a refresh doesn't bring the card back. This is
    // specific to the registration card — the editor notice is driven by
    // server state, not by the URL.
    if (window.history.replaceState) {
        window.history.replaceState({}, '', window.location.pathname);
    }
    setupToast(registerToast, {});
}

// Longer than the registration card: this one is telling the admin that work
// may have been lost, which is worth a second read.
setupToast(document.querySelector('#editorNotice'), { duration: 9000 });
