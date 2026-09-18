const express = require("express");

const router = express.Router();

const invoiceController =
    require("../controllers/invoiceController");

const upload =
    require("../middleware/upload");


/* =========================================================
   OCR EXTRACTION
   ========================================================= */

router.post(
    "/extract",
    upload.single("invoice"),
    invoiceController.extractInvoice
);


/* =========================================================
   UPLOAD INVOICE + STOCK IN
   ========================================================= */

router.post(
    "/",
    upload.single("invoice"),
    invoiceController.uploadInvoice
);


/* =========================================================
   INVOICE HISTORY
   ========================================================= */

router.get(
    "/",
    invoiceController.getInvoices
);


module.exports = router;