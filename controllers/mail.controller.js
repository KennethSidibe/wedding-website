import nodemailer from "nodemailer";
import { transporter, mailjet } from "../database/connection.js";
import emailBody from "../constants/email.register.body.js";
import { emailImgCid, websiteEmail } from "../constants/string.constants.js";
import path, { resolve } from "path";
import { validate } from "deep-email-validator";
import { error } from "console";
import fs from "fs";

const imgDirPath = path.resolve('./public/img/');
const imgDirPathFromModule = path.resolve('../public/img');

console.log(imgDirPath);
console.log(`From module: ${imgDirPath}`);

const imgBuffer = fs.readFileSync(`${imgDirPath}/webp/couple-3.webp`);
const imgBase64 = imgBuffer.toString("base64");

async function sendEmail(recipient) {
    let emailValid = await validate(recipient);
    console.log('email Valid: ');

    console.log(emailValid);

    try {
        if (emailValid.valid === true) {
            const resp = await transporter.sendMail({
                from: `"Légende et Sheridan" <${websiteEmail}>`,
                to: recipient,
                text: "Merci d'avoir RSVP",
                subject: 'Merci de ta réservation au mariage!',
                attachments: [{
                    filename: 'couple-3.webp',
                    path: `${imgDirPath}/webp/couple-3.webp`,
                    cid: emailImgCid
                }],
                html: emailBody
            });

            console.log(`Email send response`);
            console.log(resp);

            return resp;
        }
        throw new Error('Email is invalid');
    } catch (error) {
        console.error(error);
        throw error
    }
}

// console.log('email resp: ');
// console.log(await sendEmail('sidibestevekenus@gmail.com'));

export {
    sendEmail
};
