const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function testConnection() {
    const connection = await pool.getConnection();

    console.log("MYSQL: CONNECTED");
    console.log(`Database: ${process.env.DB_NAME}`);

    connection.release();
}

module.exports = {
    pool,
    testConnection
};