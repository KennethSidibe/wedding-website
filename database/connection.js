import dotenv  from "dotenv";
import path,{ resolve } from "path";
import mysql from "mysql2/promise";
import nodemailer from "nodemailer";
import { websiteEmail } from "../constants/string.constants.js";
import Mailjet from "node-mailjet";

const configFilePath = path.resolve('./config/.env');

const configFilePahFromModule = path.resolve('../config/.env');

dotenv.config({path:configFilePath,  quiet: true});

// console.log(`ENV check usr : ${process.env.NODEMAILER_USR}`);
// console.log(`ENV check pwd exists : ${!!process.env.NODEMAILER_PWD}`);


const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USR,
    password: process.env.MYSQL_PWD,
    database: process.env.MYSQL_WEDDING_DB,
});

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port : 465,
    secure : true,
    auth : {
        user: process.env.NODEMAILER_USR,
        pass : process.env.NODEMAILER_PWD
    },
    from: websiteEmail
});

export {
    pool,
    transporter
};