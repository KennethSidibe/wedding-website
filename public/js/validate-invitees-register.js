import * as CONST from "./form-constants.js";

$(`#${CONST.SUBMIT_BUTTON_ID}`).on('click', () => {
    $(`#${CONST.FORM_ID}`).trigger('submit');
});

$(`#${CONST.FORM_ID}`).on('submit', function(event) {
    event.preventDefault();

    let formFirstName = $(`#${CONST.FIRST_NAME_INPUT_ID}`).val();
    let formLastName = $(`#${CONST.LAST_NAME_INPUT_ID}`).val();
    let formEmail = $(`#${CONST.EMAIL_INPUT_ID}`).val();

    let firstNameValid = hasValue(formFirstName, CONST.FIRST_NAME_REQUIRED, CONST.FIRST_NAME_ERROR_ID, CONST.FIRST_NAME_INPUT_ID);
    let lastNameValid = hasValue(formLastName, CONST.LAST_NAME_REQUIRED, CONST.LAST_NAME_ERROR_ID, CONST.LAST_NAME_INPUT_ID);
    let emailValid = validateEmail(formEmail, CONST.EMAIL_REQUIRED, CONST.EMAIL_INVALID, CONST.EMAIL_ERROR_ID, CONST.EMAIL_INPUT_ID);

    // if valid, submit the form.
    if (firstNameValid && lastNameValid && emailValid) {
        this.submit();
    } else {
        event.preventDefault();
        blinkSubmitBtn();
        $(`#${CONST.FORM_ID}`)[0].scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }

});

    function validateEmail(email, requiredMsg, invalidMsg, emailErrorId, emailInputId) {
        // check if the value is not empty
        if (!hasValue(email, requiredMsg, emailErrorId, emailInputId)) {
            return false;
        }
        // validate email format
        const emailRegex =
            /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    
        const emailTrimmed = email.trim();
        if (!emailRegex.test(emailTrimmed)) {
            $(`#${CONST.EMAIL_LABEL_ID}`).css('filter', "drop-shadow(1px 1px 1px black)")
            showError(emailErrorId, invalidMsg, emailInputId);
            return false;
        }
        hideError(emailErrorId);
        return true;
    }

    // filter: drop-shadow(1px 1px 1px black);

function hasValue(input, errorMessage, errorElementId, inputId) {
    if (input.trim() === "") {
        showError(errorElementId, errorMessage, inputId);
        return false;
    }
    hideError(errorElementId);
    return true;
}

function showError(errorElementId, errorMessage, inputId) {
    let element = $(`#${errorElementId}`);
    element.removeClass('hide');
    element.text(errorMessage);
}
function hideError(inputErrorId) {
    let element = $(`#${inputErrorId}`);
    element.addClass('hide');
    element.text('');
}

function blinkSubmitBtn() {
    const btn = document.querySelector("#submitFormBtn");

    let count = 0;
    const interval = setInterval(() => {
        const isRed = btn.style.backgroundColor === "red";

        btn.style.backgroundColor = isRed ? "" : "red";
        btn.style.borderColor = isRed ? "" : "red";

        count++;

        if (count === 4) { // 2 blinks
            clearInterval(interval);
            btn.style.backgroundColor = "";
            btn.style.borderColor = "";
        }
    }, 250);
}