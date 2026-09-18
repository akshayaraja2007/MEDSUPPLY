const express = require("express");
const router = express.Router();

const medicineController = require("../controllers/medicineController");

router.get("/", medicineController.getMedicines);

router.get("/suppliers", medicineController.getSuppliers);

router.post("/", medicineController.addMedicine);

module.exports = router;