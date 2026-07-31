import {
    getAdminAccess,
    incrementAdminAttempts,
    resetAdminAttempts,
    lockAdminAccess
} from "../models/admin.model.js";

const MAX_LOGIN_ATTEMPTS = 10;

// Possible results of a login attempt
const LOGIN_RESULT = {
    SUCCESS: 'success',
    LOCKED: 'locked',
    WRONG_PIN: 'wrongPin',
    ERROR: 'error'
};

async function isAdminLoginLocked() {
    const access = await getAdminAccess();
    return access.locked === 1;
}

async function attemptAdminLogin(pin) {

    try {
        const access = await getAdminAccess();

        if (access.locked === 1) {
            return { result: LOGIN_RESULT.LOCKED, remainingTries: 0 };
        }

        // The dev unlocked the account (locked was unset) but the counter is
        // still maxed out: treat the unlock as a fresh start.
        if (access.attempts >= MAX_LOGIN_ATTEMPTS) {
            await resetAdminAttempts();
            access.attempts = 0;
        }

        const adminPin = process.env.ADMIN_PIN;
        if (adminPin == null || adminPin === '') {
            console.error('ADMIN_PIN is not set in the environment, admin login is disabled');
            return { result: LOGIN_RESULT.ERROR, remainingTries: 0 };
        }

        if (typeof pin === 'string' && pin === adminPin) {
            await resetAdminAttempts();
            return { result: LOGIN_RESULT.SUCCESS, remainingTries: MAX_LOGIN_ATTEMPTS };
        }

        await incrementAdminAttempts();
        const attemptsUsed = access.attempts + 1;

        if (attemptsUsed >= MAX_LOGIN_ATTEMPTS) {
            await lockAdminAccess();
            return { result: LOGIN_RESULT.LOCKED, remainingTries: 0 };
        }

        return {
            result: LOGIN_RESULT.WRONG_PIN,
            remainingTries: MAX_LOGIN_ATTEMPTS - attemptsUsed
        };
    } catch (error) {
        throw error;
    }
}

export {
    MAX_LOGIN_ATTEMPTS,
    LOGIN_RESULT,
    isAdminLoginLocked,
    attemptAdminLogin
}
