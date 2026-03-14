import dotenv  from "dotenv";
import path,{ resolve } from "path";
import mysql from "mysql2/promise";

const configFilePath = path.resolve('./config/.env');

dotenv.config({path:configFilePath,  quiet: true});

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USR,
    password: process.env.MYSQL_PWD,
    database: process.env.MYSQL_WEDDING_DB,
});


export default pool;