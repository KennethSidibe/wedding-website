import nodemailer from "nodemailer";
import { transporter } from "../database/connection.js";
import emailBody from "../constants/email.register.body.js";
import { emailImgCid } from "../constants/string.constants.js";

import path, {resolve} from "path";

const imgDirPath = path.resolve('./img/');

const imgDirPathFromModule = path.resolve('../public/img');

console.log(imgDirPath);
console.log(`From module: ${imgDirPathFromModule}`);

try {
    const resp = await transporter.sendMail({
        to :'sidibekenstevea@gmail.com',
        subject: 'Merci de ta reservation au mariage!',
        attachments: [{
            filename: 'couple-3.webp',
            path: `${imgDirPathFromModule}/webp/couple-3.webp`,
            cid: emailImgCid
        }],
        html: emailBody
    });

    console.log(`Email send response`);
    console.log(resp);
    
    
} catch(error) {
    console.log('Error while sending email');
    console.error(error);
}