const { pool } = require("../config/db");


/* =========================================================
   MEDSUPPLY INTELLIGENCE
   DASHBOARD CONTROLLER

   Provides:
   - Inventory KPIs
   - Stock status
   - Expiry risk
   - Active risks
   - Procurement orders
   - Recent transactions
   - Consumption summary

   AI calculations are handled by:
   /api/intelligence

   Dashboard remains fast by reading the database directly.
   ========================================================= */


/* =========================================================
   GET DASHBOARD
   ========================================================= */

async function getDashboard(req, res) {

    try {

        /* =================================================
           INVENTORY SUMMARY
           ================================================= */

        const [
            inventoryStats
        ] = await pool.query(

            `
            SELECT

                COUNT(*) AS total_items,

                COALESCE(
                    SUM(current_stock),
                    0
                ) AS total_units,

                SUM(
                    CASE
                        WHEN current_stock <= 0
                        THEN 1
                        ELSE 0
                    END
                ) AS stockout_items,

                SUM(
                    CASE
                        WHEN current_stock > 0
                         AND current_stock <= minimum_stock
                        THEN 1
                        ELSE 0
                    END
                ) AS low_stock_items,

                SUM(
                    CASE
                        WHEN current_stock > 0
                         AND current_stock <= emergency_reserve
                        THEN 1
                        ELSE 0
                    END
                ) AS emergency_items,

                SUM(
                    CASE
                        WHEN expiry_date IS NOT NULL
                         AND expiry_date >= CURDATE()
                         AND expiry_date <= DATE_ADD(
                             CURDATE(),
                             INTERVAL 30 DAY
                         )
                        THEN 1
                        ELSE 0
                    END
                ) AS expiring_items

            FROM inventory_items
            `

        );


        const inventory =
            inventoryStats[0];


        /* =================================================
           ACTIVE RISK SUMMARY
           ================================================= */

        const [
            riskStats
        ] = await pool.query(

            `
            SELECT

                COUNT(*) AS total_active_risks,

                SUM(
                    CASE
                        WHEN severity = 'CRITICAL'
                        THEN 1
                        ELSE 0
                    END
                ) AS critical_risks,

                SUM(
                    CASE
                        WHEN severity = 'HIGH'
                        THEN 1
                        ELSE 0
                    END
                ) AS high_risks,

                SUM(
                    CASE
                        WHEN severity = 'WARNING'
                        THEN 1
                        ELSE 0
                    END
                ) AS warning_risks,

                SUM(
                    CASE
                        WHEN risk_type = 'STOCKOUT'
                        THEN 1
                        ELSE 0
                    END
                ) AS stockout_risks,

                SUM(
                    CASE
                        WHEN risk_type = 'LOW_STOCK'
                        THEN 1
                        ELSE 0
                    END
                ) AS low_stock_risks,

                SUM(
                    CASE
                        WHEN risk_type = 'EXPIRY'
                        THEN 1
                        ELSE 0
                    END
                ) AS expiry_risks,

                SUM(
                    CASE
                        WHEN risk_type = 'ABNORMAL_USAGE'
                        THEN 1
                        ELSE 0
                    END
                ) AS abnormal_usage_risks,

                SUM(
                    CASE
                        WHEN risk_type = 'SUPPLIER_DELAY'
                        THEN 1
                        ELSE 0
                    END
                ) AS supplier_delay_risks

            FROM risk_events

            WHERE
                status = 'ACTIVE'
            `

        );


        const risks =
            riskStats[0];


        /* =================================================
           PROCUREMENT SUMMARY
           ================================================= */

        const [
            procurementStats
        ] = await pool.query(

            `
            SELECT

                COUNT(*) AS total_orders,

                COALESCE(
                    SUM(quantity),
                    0
                ) AS total_ordered_units,

                COALESCE(
                    SUM(total_cost),
                    0
                ) AS total_order_value,

                SUM(
                    CASE
                        WHEN status = 'PENDING'
                        THEN 1
                        ELSE 0
                    END
                ) AS pending_orders,

                SUM(
                    CASE
                        WHEN status = 'ORDERED'
                        THEN 1
                        ELSE 0
                    END
                ) AS ordered_orders,

                SUM(
                    CASE
                        WHEN status = 'IN_TRANSIT'
                        THEN 1
                        ELSE 0
                    END
                ) AS in_transit_orders,

                SUM(
                    CASE
                        WHEN status = 'DELIVERED'
                        THEN 1
                        ELSE 0
                    END
                ) AS delivered_orders

            FROM procurement_orders
            `

        );


        const procurement =
            procurementStats[0];


        /* =================================================
           RECENT PROCUREMENT ORDERS
           ================================================= */

        const [
            purchaseOrders
        ] = await pool.query(

            `
            SELECT

                po.id,

                po.item_id,

                i.name AS medicine_name,

                po.supplier_id,

                s.name AS supplier_name,

                po.quantity,

                po.order_date,

                po.expected_delivery_date,

                po.status,

                po.unit_cost,

                po.total_cost,

                po.created_at

            FROM procurement_orders po

            LEFT JOIN inventory_items i
                ON i.id = po.item_id

            LEFT JOIN suppliers s
                ON s.id = po.supplier_id

            ORDER BY
                po.created_at DESC

            LIMIT 10
            `

        );


        /* =================================================
           INVENTORY OVERVIEW
           ================================================= */

        const [
            inventoryItems
        ] = await pool.query(

            `
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

                i.supplier_id,

                i.unit_cost,

                i.status,

                s.name AS supplier_name,

                s.lead_time_days,

                s.reliability_score

            FROM inventory_items i

            LEFT JOIN suppliers s
                ON s.id = i.supplier_id

            ORDER BY

                CASE

                    WHEN i.current_stock <= 0
                    THEN 1

                    WHEN i.current_stock <= i.emergency_reserve
                    THEN 2

                    WHEN i.current_stock <= i.minimum_stock
                    THEN 3

                    ELSE 4

                END,

                i.name ASC

            LIMIT 100
            `

        );


        /* =================================================
           ACTIVE RISK EVENTS
           ================================================= */

        const [
            activeRisks
        ] = await pool.query(

            `
            SELECT

                r.id,

                r.item_id,

                i.name AS medicine_name,

                i.criticality,

                r.risk_type,

                r.severity,

                r.message,

                r.detected_at,

                r.status

            FROM risk_events r

            LEFT JOIN inventory_items i
                ON i.id = r.item_id

            WHERE
                r.status = 'ACTIVE'

            ORDER BY

                CASE r.severity

                    WHEN 'CRITICAL'
                    THEN 1

                    WHEN 'HIGH'
                    THEN 2

                    WHEN 'WARNING'
                    THEN 3

                    ELSE 4

                END,

                r.detected_at DESC

            LIMIT 20
            `

        );


        /* =================================================
           RECENT TRANSACTIONS
           ================================================= */

        const [
            transactions
        ] = await pool.query(

            `
            SELECT

                t.id,

                t.medicine_id,

                i.name AS medicine_name,

                t.batch_id,

                t.transaction_type,

                t.quantity,

                t.reference_number,

                t.transaction_date

            FROM transactions t

            LEFT JOIN inventory_items i
                ON i.id = t.medicine_id

            ORDER BY

                t.transaction_date DESC,

                t.id DESC

            LIMIT 20
            `

        );


        /* =================================================
           CONSUMPTION SUMMARY
           ================================================= */

        const [
            consumptionStats
        ] = await pool.query(

            `
            SELECT

                COALESCE(
                    SUM(
                        CASE
                            WHEN consumption_date >= DATE_SUB(
                                CURDATE(),
                                INTERVAL 7 DAY
                            )
                            THEN quantity_consumed
                            ELSE 0
                        END
                    ),
                    0
                ) AS consumption_7_days,

                COALESCE(
                    SUM(
                        CASE
                            WHEN consumption_date >= DATE_SUB(
                                CURDATE(),
                                INTERVAL 30 DAY
                            )
                            THEN quantity_consumed
                            ELSE 0
                        END
                    ),
                    0
                ) AS consumption_30_days,

                COUNT(
                    CASE
                        WHEN consumption_date >= DATE_SUB(
                            CURDATE(),
                            INTERVAL 30 DAY
                        )
                        THEN 1
                    END
                ) AS consumption_records_30_days

            FROM consumption_history
            `

        );


        const consumption =
            consumptionStats[0];


        /* =================================================
           SUPPLIER SUMMARY
           ================================================= */

        const [
            supplierStats
        ] = await pool.query(

            `
            SELECT

                COUNT(*) AS total_suppliers,

                SUM(
                    CASE
                        WHEN status = 'ACTIVE'
                        THEN 1
                        ELSE 0
                    END
                ) AS active_suppliers,

                ROUND(
                    COALESCE(
                        AVG(
                            CASE
                                WHEN status = 'ACTIVE'
                                THEN reliability_score
                            END
                        ),
                        0
                    ),
                    2
                ) AS average_reliability

            FROM suppliers
            `

        );


        const suppliers =
            supplierStats[0];


        /* =================================================
           MEDICINE CATEGORY SUMMARY
           ================================================= */

        const [
            categories
        ] = await pool.query(

            `
            SELECT

                category,

                COUNT(*) AS medicine_count,

                COALESCE(
                    SUM(current_stock),
                    0
                ) AS total_stock,

                SUM(
                    CASE
                        WHEN current_stock <= minimum_stock
                        THEN 1
                        ELSE 0
                    END
                ) AS low_stock_count

            FROM inventory_items

            GROUP BY
                category

            ORDER BY
                medicine_count DESC
            `

        );


        /* =================================================
           FORMAT NUMERIC VALUES
           ================================================= */

        const toNumber =
            value =>
                Number(
                    value || 0
                );


        /* =================================================
           RESPONSE
           ================================================= */

        return res.json({

            success:
                true,

            generated_at:
                new Date().toISOString(),

            stats: {

                total_medicines:
                    toNumber(
                        inventory.total_items
                    ),

                total_items:
                    toNumber(
                        inventory.total_items
                    ),

                total_stock:
                    toNumber(
                        inventory.total_units
                    ),

                total_units:
                    toNumber(
                        inventory.total_units
                    ),

                stockout_items:
                    toNumber(
                        inventory.stockout_items
                    ),

                low_stock_items:
                    toNumber(
                        inventory.low_stock_items
                    ),

                emergency_items:
                    toNumber(
                        inventory.emergency_items
                    ),

                expiring_items:
                    toNumber(
                        inventory.expiring_items
                    ),

                expiry_risk:
                    toNumber(
                        risks.expiry_risks
                    ),

                critical_risks:
                    toNumber(
                        risks.critical_risks
                    ),

                high_risks:
                    toNumber(
                        risks.high_risks
                    ),

                warning_risks:
                    toNumber(
                        risks.warning_risks
                    ),

                total_active_risks:
                    toNumber(
                        risks.total_active_risks
                    ),

                stockout_risks:
                    toNumber(
                        risks.stockout_risks
                    ),

                low_stock_risks:
                    toNumber(
                        risks.low_stock_risks
                    ),

                abnormal_usage_risks:
                    toNumber(
                        risks.abnormal_usage_risks
                    ),

                supplier_delay_risks:
                    toNumber(
                        risks.supplier_delay_risks
                    ),

                total_orders:
                    toNumber(
                        procurement.total_orders
                    ),

                pending_orders:
                    toNumber(
                        procurement.pending_orders
                    ),

                ordered_orders:
                    toNumber(
                        procurement.ordered_orders
                    ),

                in_transit_orders:
                    toNumber(
                        procurement.in_transit_orders
                    ),

                delivered_orders:
                    toNumber(
                        procurement.delivered_orders
                    ),

                total_ordered_units:
                    toNumber(
                        procurement.total_ordered_units
                    ),

                total_order_value:
                    Number(
                        procurement.total_order_value
                        || 0
                    ),

                consumption_7_days:
                    toNumber(
                        consumption.consumption_7_days
                    ),

                consumption_30_days:
                    toNumber(
                        consumption.consumption_30_days
                    ),

                consumption_records_30_days:
                    toNumber(
                        consumption.consumption_records_30_days
                    ),

                total_suppliers:
                    toNumber(
                        suppliers.total_suppliers
                    ),

                active_suppliers:
                    toNumber(
                        suppliers.active_suppliers
                    ),

                average_supplier_reliability:
                    Number(
                        suppliers.average_reliability
                        || 0
                    )

            },

            inventory:
                inventoryItems,

            risks:
                activeRisks,

            procurement:
                purchaseOrders,

            transactions,

            consumption: {

                last_7_days:
                    toNumber(
                        consumption.consumption_7_days
                    ),

                last_30_days:
                    toNumber(
                        consumption.consumption_30_days
                    ),

                records:
                    toNumber(
                        consumption.consumption_records_30_days
                    )

            },

            suppliers: {

                total:
                    toNumber(
                        suppliers.total_suppliers
                    ),

                active:
                    toNumber(
                        suppliers.active_suppliers
                    ),

                average_reliability:
                    Number(
                        suppliers.average_reliability
                        || 0
                    )

            },

            categories

        });

    } catch (error) {

        console.error(
            "DASHBOARD CONTROLLER ERROR:",
            error
        );


        return res.status(500).json({

            success:
                false,

            error:
                "Failed to load dashboard data.",

            details:
                error.message

        });

    }

}


/* =========================================================
   GET INVENTORY DETAILS
   ========================================================= */

async function getInventoryDetails(
    req,
    res
) {

    try {

        const [
            rows
        ] = await pool.query(

            `
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

                i.supplier_id,

                i.unit_cost,

                i.status,

                s.name AS supplier_name,

                s.lead_time_days,

                s.reliability_score

            FROM inventory_items i

            LEFT JOIN suppliers s
                ON s.id = i.supplier_id

            ORDER BY
                i.name ASC
            `

        );


        return res.json({

            success:
                true,

            data:
                rows

        });

    } catch (error) {

        console.error(
            "INVENTORY DETAILS ERROR:",
            error
        );


        return res.status(500).json({

            success:
                false,

            error:
                "Failed to load inventory.",

            details:
                error.message

        });

    }

}


/* =========================================================
   GET TRANSACTION HISTORY
   ========================================================= */

async function getTransactions(
    req,
    res
) {

    try {

        const [
            rows
        ] = await pool.query(

            `
            SELECT

                t.id,

                t.medicine_id,

                i.name AS medicine_name,

                t.batch_id,

                t.transaction_type,

                t.quantity,

                t.reference_number,

                t.transaction_date

            FROM transactions t

            LEFT JOIN inventory_items i
                ON i.id = t.medicine_id

            ORDER BY

                t.transaction_date DESC,

                t.id DESC

            LIMIT 100
            `

        );


        return res.json({

            success:
                true,

            data:
                rows

        });

    } catch (error) {

        console.error(
            "TRANSACTION HISTORY ERROR:",
            error
        );


        return res.status(500).json({

            success:
                false,

            error:
                "Failed to load transactions.",

            details:
                error.message

        });

    }

}


/* =========================================================
   EXPORTS
   ========================================================= */

module.exports = {

    getDashboard,

    getInventoryDetails,

    getTransactions

};