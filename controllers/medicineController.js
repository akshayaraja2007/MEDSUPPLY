const { pool } = require("../config/db");

/* GET ALL MEDICINES */
exports.getMedicines = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                i.id,
                i.name,
                i.category,
                i.unit,
                i.current_stock,
                i.minimum_stock,
                i.emergency_reserve,
                i.criticality,
                i.expiry_date,
                i.unit_cost,
                i.status,
                s.name AS supplier_name,
                s.id AS supplier_id,
                s.lead_time_days,
                s.reliability_score
            FROM inventory_items i
            LEFT JOIN suppliers s ON i.supplier_id = s.id
            ORDER BY i.name
        `);

        res.json({
            success: true,
            count: rows.length,
            data: rows
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            error: "Failed to fetch medicines",
            details: error.message
        });
    }
};


/* GET SUPPLIERS */
exports.getSuppliers = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                id,
                name,
                lead_time_days,
                reliability_score,
                status
            FROM suppliers
            WHERE status = 'ACTIVE'
            ORDER BY name
        `);

        res.json({
            success: true,
            count: rows.length,
            data: rows
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            error: "Failed to fetch suppliers",
            details: error.message
        });
    }
};


/* ADD MEDICINE */
exports.addMedicine = async (req, res) => {
    try {

        const {
            name,
            category,
            unit,
            current_stock,
            minimum_stock,
            emergency_reserve,
            criticality,
            expiry_date,
            supplier_id,
            unit_cost
        } = req.body;

        if (!name || !category) {
            return res.status(400).json({
                success: false,
                error: "Medicine name and category are required"
            });
        }

        const stock = Number(current_stock) || 0;
        const minimum = Number(minimum_stock) || 0;
        const reserve = Number(emergency_reserve) || 0;

        let status = "NORMAL";

        if (stock === 0) {
            status = "STOCKOUT_RISK";
        } else if (stock < reserve) {
            status = "CRITICAL";
        } else if (stock < minimum) {
            status = "LOW";
        }

        const [result] = await pool.query(
            `
            INSERT INTO inventory_items
            (
                name,
                category,
                unit,
                current_stock,
                minimum_stock,
                emergency_reserve,
                criticality,
                expiry_date,
                supplier_id,
                unit_cost,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                name,
                category,
                unit || "units",
                stock,
                minimum,
                reserve,
                criticality || "MEDIUM",
                expiry_date || null,
                supplier_id || null,
                Number(unit_cost) || 0,
                status
            ]
        );

        res.status(201).json({
            success: true,
            message: "Medicine added successfully",
            id: result.insertId
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            error: "Failed to add medicine",
            details: error.message
        });
    }
};