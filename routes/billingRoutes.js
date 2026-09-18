const express = require("express");
const router = express.Router();

const billingController = require("../controllers/billingController");

router.post("/", billingController.createBill);
router.get("/", billingController.getBills);

module.exports = router;