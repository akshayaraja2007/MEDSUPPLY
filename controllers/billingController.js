const { pool } = require("../config/db");

exports.createBill = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const { patient_id, items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: "Bill must contain at least one medicine"
            });
        }

        await connection.beginTransaction();

        const billReference =
            `BILL-${Date.now()}`;

        for (const item of items) {

            const medicineId = Number(item.medicine_id);
            const quantity = Number(item.quantity);

            if (!medicineId || !quantity || quantity <= 0) {
                throw new Error("Invalid medicine or quantity");
            }

            const [medicineRows] = await connection.query(
                `SELECT * FROM inventory_items WHERE id = ? FOR UPDATE`,
                [medicineId]
            );

            if (medicineRows.length === 0) {
                throw new Error(`Medicine ID ${medicineId} not found`);
            }

            const medicine = medicineRows[0];

            if (medicine.current_stock < quantity) {
                throw new Error(
                    `Insufficient stock for ${medicine.name}. Available: ${medicine.current_stock}`
                );
            }

            await connection.query(
                `
                UPDATE inventory_items
                SET current_stock = current_stock - ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                `,
                [quantity, medicineId]
            );

            await connection.query(
                `
                INSERT INTO transactions
                (
                    medicine_id,
                    transaction_type,
                    quantity,
                    reference_number
                )
                VALUES (?, 'OUT', ?, ?)
                `,
                [medicineId, quantity, billReference]
            );

            await connection.query(
                `
                INSERT INTO consumption_history
                (
                    item_id,
                    consumption_date,
                    quantity_consumed,
                    usage_type
                )
                VALUES (?, CURDATE(), ?, 'NORMAL')
                `,
                [medicineId, quantity]
            );
        }

        await connection.commit();

        res.status(201).json({
            success: true,
            message: "Bill created successfully",
            bill_reference: billReference,
            patient_id: patient_id || null
        });

    } catch (error) {

        await connection.rollback();

        console.error(error);

        res.status(400).json({
            success: false,
            error: "Failed to create bill",
            details: error.message
        });

    } finally {
        connection.release();
    }
};

exports.getBills = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                t.id,
                t.medicine_id,
                i.name AS medicine_name,
                t.quantity,
                t.reference_number,
                t.transaction_date
            FROM transactions t
            JOIN inventory_items i
                ON t.medicine_id = i.id
            WHERE t.transaction_type = 'OUT'
            ORDER BY t.transaction_date DESC
            LIMIT 100
        `);

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: "Failed to fetch billing history",
            details: error.message
        });
    }
};