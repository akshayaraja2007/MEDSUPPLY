const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const caPath = path.join(
    __dirname,
    "..",
    "certs",
    "ca.pem"
);

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    ssl: {
        ca: fs.readFileSync(caPath),
        rejectUnauthorized: true
    }
});

async function testConnection() {
    const connection = await pool.getConnection();

    console.log("MYSQL: CONNECTED");
    console.log(`Host: ${process.env.DB_HOST}`);
    console.log(`Port: ${process.env.DB_PORT}`);
    console.log(`Database: ${process.env.DB_NAME}`);

    connection.release();
}

module.exports = {
    pool,
    testConnection
};