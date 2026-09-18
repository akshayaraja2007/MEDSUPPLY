const { pool } = require("../config/db");


/* =========================================================
   CREATE BILL / MEDICINE ISSUE
   Supports:
   1. Single medicine:
      {
          medicine_id: 7,
          quantity: 20,
          reference_number: "..."
      }

   2. Multiple medicines:
      {
          items: [
              {
                  medicine_id: 7,
                  quantity: 20
              },
              {
                  medicine_id: 2,
                  quantity: 10
              }
          ]
      }
   ========================================================= */

async function createBill(req, res) {

    const connection = await pool.getConnection();

    try {

        let items = [];

        /* -----------------------------------------------------
           FORMAT 1: Single medicine from billing.js
           ----------------------------------------------------- */

        if (
            req.body.medicine_id !== undefined &&
            req.body.quantity !== undefined
        ) {

            items.push({
                medicine_id: Number(req.body.medicine_id),
                quantity: Number(req.body.quantity)
            });
        }


        /* -----------------------------------------------------
           FORMAT 2: Multiple medicines
           ----------------------------------------------------- */

        if (
            Array.isArray(req.body.items) &&
            req.body.items.length > 0
        ) {

            items = req.body.items.map(item => ({
                medicine_id: Number(item.medicine_id),
                quantity: Number(item.quantity)
            }));
        }


        /* -----------------------------------------------------
           VALIDATE
           ----------------------------------------------------- */

        if (items.length === 0) {

            return res.status(400).json({
                success: false,
                error: "Bill must contain at least one medicine"
            });
        }


        for (const item of items) {

            if (
                !Number.isInteger(item.medicine_id) ||
                item.medicine_id <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    error: "Invalid medicine ID"
                });
            }


            if (
                !Number.isFinite(item.quantity) ||
                item.quantity <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    error: "Quantity must be greater than zero"
                });
            }
        }


        /* -----------------------------------------------------
           REQUEST DATA
           ----------------------------------------------------- */

        const patientName =
            req.body.patient_name ||
            req.body.patientName ||
            null;

        const patientId =
            req.body.patient_id ||
            req.body.patientId ||
            null;

        const referenceNumber =
            req.body.reference_number ||
            req.body.billReference ||
            `BILL-${Date.now()}`;


        /* -----------------------------------------------------
           START TRANSACTION
           ----------------------------------------------------- */

        await connection.beginTransaction();


        const results = [];


        /* =====================================================
           PROCESS EACH MEDICINE
           ===================================================== */

        for (const item of items) {

            /* -------------------------------------------------
               Lock inventory row
               ------------------------------------------------- */

            const [inventoryRows] =
                await connection.query(
                    `
                    SELECT
                        id,
                        name,
                        current_stock,
                        minimum_stock,
                        emergency_reserve,
                        criticality,
                        unit_cost
                    FROM inventory_items
                    WHERE id = ?
                    FOR UPDATE
                    `,
                    [item.medicine_id]
                );


            if (inventoryRows.length === 0) {

                throw new Error(
                    `Medicine not found: ${item.medicine_id}`
                );
            }


            const medicine = inventoryRows[0];


            /* -------------------------------------------------
               Check stock
               ------------------------------------------------- */

            const currentStock =
                Number(medicine.current_stock || 0);

            const quantity =
                Number(item.quantity);


            if (currentStock < quantity) {

                throw new Error(
                    `${medicine.name}: insufficient stock. ` +
                    `Available: ${currentStock}, ` +
                    `Requested: ${quantity}`
                );
            }


            /* -------------------------------------------------
               Calculate new stock
               ------------------------------------------------- */

            const newStock =
                currentStock - quantity;


            let newStatus = "NORMAL";


            if (newStock <= 0) {

                newStatus = "STOCKOUT_RISK";

            } else if (
                newStock <=
                Number(medicine.emergency_reserve || 0)
            ) {

                newStatus = "CRITICAL";

            } else if (
                newStock <=
                Number(medicine.minimum_stock || 0)
            ) {

                newStatus = "LOW";
            }


            /* -------------------------------------------------
               Update inventory
               ------------------------------------------------- */

            await connection.query(
                `
                UPDATE inventory_items
                SET
                    current_stock = ?,
                    status = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                `,
                [
                    newStock,
                    newStatus,
                    item.medicine_id
                ]
            );


            /* -------------------------------------------------
               Record STOCK OUT transaction
               ------------------------------------------------- */

            await connection.query(
                `
                INSERT INTO transactions
                (
                    medicine_id,
                    batch_id,
                    transaction_type,
                    quantity,
                    reference_number,
                    transaction_date
                )
                VALUES
                (
                    ?,
                    NULL,
                    'OUT',
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
                `,
                [
                    item.medicine_id,
                    quantity,
                    referenceNumber
                ]
            );


            /* -------------------------------------------------
               Record consumption history
               ------------------------------------------------- */

            await connection.query(
                `
                INSERT INTO consumption_history
                (
                    item_id,
                    consumption_date,
                    quantity_consumed,
                    usage_type
                )
                VALUES
                (
                    ?,
                    CURDATE(),
                    ?,
                    'NORMAL'
                )
                `,
                [
                    item.medicine_id,
                    quantity
                ]
            );


            results.push({
                medicine_id: item.medicine_id,
                medicine_name: medicine.name,
                quantity,
                previous_stock: currentStock,
                remaining_stock: newStock,
                status: newStatus,
                unit_cost: Number(medicine.unit_cost || 0),
                estimated_value:
                    quantity *
                    Number(medicine.unit_cost || 0)
            });
        }


        /* -----------------------------------------------------
           COMMIT
           ----------------------------------------------------- */

        await connection.commit();


        /* -----------------------------------------------------
           RESPONSE
           ----------------------------------------------------- */

        const totalUnits =
            results.reduce(
                (sum, item) =>
                    sum + item.quantity,
                0
            );


        const totalValue =
            results.reduce(
                (sum, item) =>
                    sum + item.estimated_value,
                0
            );


        return res.status(201).json({

            success: true,

            message:
                "Medicine issue recorded successfully",

            bill: {

                patient_name: patientName,

                patient_id: patientId,

                reference_number:
                    referenceNumber,

                medicine_count:
                    results.length,

                total_units:
                    totalUnits,

                estimated_value:
                    Number(totalValue.toFixed(2)),

                items: results
            }
        });

    } catch (error) {

        /* -----------------------------------------------------
           ROLLBACK
           ----------------------------------------------------- */

        try {
            await connection.rollback();
        } catch (_) {}


        console.error(
            "CREATE BILL ERROR:",
            error.message
        );


        return res.status(400).json({

            success: false,

            error: error.message ||
                "Unable to create bill"
        });

    } finally {

        connection.release();
    }
}


/* =========================================================
   GET RECENT BILLS / TRANSACTIONS
   ========================================================= */

async function getBills(req, res) {

    try {

        const [rows] = await pool.query(
            `
            SELECT
                t.id,
                t.medicine_id,
                i.name AS medicine_name,
                t.transaction_type,
                t.quantity,
                t.reference_number,
                t.transaction_date
            FROM transactions t
            LEFT JOIN inventory_items i
                ON i.id = t.medicine_id
            WHERE t.transaction_type = 'OUT'
            ORDER BY
                t.transaction_date DESC,
                t.id DESC
            LIMIT 100
            `
        );


        return res.json({

            success: true,

            data: rows
        });

    } catch (error) {

        console.error(
            "GET BILLS ERROR:",
            error.message
        );


        return res.status(500).json({

            success: false,

            error:
                "Unable to fetch billing history"
        });
    }
}


module.exports = {
    createBill,
    getBills
};