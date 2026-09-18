const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const { testConnection } = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;


/* =========================================================
   MIDDLEWARE
   ========================================================= */

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));


/* =========================================================
   ROUTES
   ========================================================= */

const medicineRoutes =
    require("./routes/medicineRoutes");

const billingRoutes =
    require("./routes/billingRoutes");

const invoiceRoutes =
    require("./routes/invoiceRoutes");

const dashboardRoutes =
    require("./routes/dashboardRoutes");

const intelligenceRoutes =
    require("./routes/intelligenceRoutes");


/* =========================================================
   ROOT → DASHBOARD
   IMPORTANT:
   This must come BEFORE express.static()
   ========================================================= */

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "pages",
            "dashboard.html"
        )
    );

});


/* =========================================================
   STATIC FRONTEND FILES
   ========================================================= */

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


/* =========================================================
   API ROUTES
   ========================================================= */

app.use(
    "/api/medicines",
    medicineRoutes
);

app.use(
    "/api/billing",
    billingRoutes
);

app.use(
    "/api/invoices",
    invoiceRoutes
);

app.use(
    "/api/dashboard",
    dashboardRoutes
);

app.use(
    "/api/intelligence",
    intelligenceRoutes
);


/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get("/api/health", (req, res) => {

    res.json({

        success: true,

        message:
            "MedSupply Intelligence API is running"

    });

});


/* =========================================================
   404 HANDLER
   ========================================================= */

app.use((req, res) => {

    res.status(404).json({

        success: false,

        error: "Not found",

        details:
            `Route not found: ${req.originalUrl}`

    });

});


/* =========================================================
   START SERVER
   ========================================================= */

async function startServer() {

    try {

        await testConnection();


        app.listen(PORT, () => {

            console.log("");

            console.log(
                "======================================"
            );

            console.log(
                "     MEDSUPPLY INTELLIGENCE"
            );

            console.log(
                "======================================"
            );

            console.log(
                `Server: http://localhost:${PORT}`
            );

            console.log(
                `Health: http://localhost:${PORT}/api/health`
            );

            console.log(
                `Dashboard: http://localhost:${PORT}/`
            );

            console.log(
                `Admin: http://localhost:${PORT}/pages/admin.html`
            );

            console.log(
                `Billing: http://localhost:${PORT}/pages/billing.html`
            );

            console.log(
                `Intelligence: http://localhost:${PORT}/api/intelligence`
            );

            console.log(
                "======================================"
            );

        });

    } catch (error) {

        console.error("");

        console.error(
            "SERVER START FAILED"
        );

        console.error(
            error.message
        );

        process.exit(1);

    }

}


startServer();