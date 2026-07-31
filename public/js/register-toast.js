const DISPLAY_DURATION = 5000;
const FADE_OUT_DURATION = 500;

const toast = document.querySelector('#registerToast');

if (toast) {
    const closeBtn = toast.querySelector('#registerToastClose');
    let dismissTimer = null;

    // Drop the query param so a refresh doesn't bring the card back.
    if (window.history.replaceState) {
        window.history.replaceState({}, '', window.location.pathname);
    }

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

    closeBtn.addEventListener('click', dismiss);
    dismissTimer = setTimeout(dismiss, DISPLAY_DURATION);

    // Let the entrance animation run on the next frame.
    requestAnimationFrame(() => {
        toast.classList.add('is-visible');
    });
}
