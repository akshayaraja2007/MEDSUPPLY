const { pool } = require("../config/db");

const {
    generateForecast
} = require("../services/forecastService");

const {
    calculateRisk
} = require("../services/riskService");

const {
    calculateProcurement
} = require("../services/procurementService");


/* =========================================================
   MEDSUPPLY INTELLIGENCE
   INTELLIGENCE CONTROLLER

   Pipeline:

   MySQL Inventory
        ↓
   Python Forecast
        ↓
   Python Anomaly Detection
        ↓
   Risk Engine
        ↓
   Procurement Engine
        ↓
   Dashboard
   ========================================================= */


/* =========================================================
   GET INVENTORY
   ========================================================= */

async function getInventory() {

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
            i.id ASC
        `

    );


    return rows;

}


/* =========================================================
   GET ACTIVE RISK EVENTS
   ========================================================= */

async function getExistingRiskEvents() {

    const [
        rows
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

                WHEN 'CRITICAL' THEN 1
                WHEN 'HIGH' THEN 2
                WHEN 'WARNING' THEN 3
                ELSE 4

            END,

            r.detected_at DESC

        LIMIT 100
        `

    );


    return rows;

}


/* =========================================================
   SAVE RISK EVENT
   ========================================================= */

async function saveRiskEvent(
    connection,
    event
) {

    if (!event) {
        return null;
    }


    /*
       Avoid creating unlimited duplicate events
       every time the dashboard refreshes.

       If the same ACTIVE risk already exists for
       the medicine, update its message/severity.
    */

    const [
        existing
    ] = await connection.query(

        `
        SELECT
            id

        FROM risk_events

        WHERE
            item_id = ?

            AND risk_type = ?

            AND status = 'ACTIVE'

        LIMIT 1
        `,

        [
            event.item_id,
            event.risk_type
        ]

    );


    if (existing.length) {

        await connection.query(

            `
            UPDATE risk_events

            SET
                severity = ?,
                message = ?,
                detected_at = CURRENT_TIMESTAMP

            WHERE
                id = ?
            `,

            [
                event.severity,
                event.message,
                existing[0].id
            ]

        );


        return existing[0].id;

    }


    const [
        result
    ] = await connection.query(

        `
        INSERT INTO risk_events
        (
            item_id,
            risk_type,
            severity,
            message,
            detected_at,
            status
        )

        VALUES
        (
            ?,
            ?,
            ?,
            ?,
            CURRENT_TIMESTAMP,
            'ACTIVE'
        )
        `,

        [
            event.item_id,
            event.risk_type,
            event.severity,
            event.message
        ]

    );


    return result.insertId;

}


/* =========================================================
   RESOLVE OLD RISK EVENTS
   ========================================================= */

async function resolveOldRiskEvents(
    connection,
    activeEventKeys
) {

    /*
       Get all currently active events.

       Events which were previously active but
       are no longer detected will be resolved.
    */

    const [
        rows
    ] = await connection.query(

        `
        SELECT
            id,
            item_id,
            risk_type

        FROM risk_events

        WHERE
            status = 'ACTIVE'
        `

    );


    for (
        const row of rows
    ) {

        const key =
            `${row.item_id}:${row.risk_type}`;


        if (
            !activeEventKeys.has(key)
        ) {

            await connection.query(

                `
                UPDATE risk_events

                SET
                    status = 'RESOLVED'

                WHERE
                    id = ?
                `,

                [
                    row.id
                ]

            );

        }

    }

}


/* =========================================================
   PROCESS ONE MEDICINE
   ========================================================= */

async function processMedicine(
    item
) {

    let forecast = null;


    /* =====================================================
       PYTHON FORECAST
       ===================================================== */

    try {

        forecast =
            await generateForecast(
                item.id,
                7
            );

    } catch (error) {

        console.error(

            `FORECAST FAILED [${item.name}]:`,

            error.message

        );


        /*
           Do not crash the entire dashboard because
           one medicine has insufficient/bad history.
        */

        forecast = {

            item_id:
                item.id,

            model:
                "Fallback",

            history_count:
                0,

            avg_7:
                0,

            avg_30:
                0,

            weighted_recent:
                0,

            predicted_daily:
                Number(
                    item.avg_daily_consumption || 0
                ),

            trend:
                "STABLE",

            trend_change:
                0,

            variability:
                0,

            confidence:
                0,

            forecast:
                []

        };

    }


    /* =====================================================
       RISK ENGINE
       ===================================================== */

    const risk =
        await calculateRisk(
            item,
            forecast
        );


    /* =====================================================
       PROCUREMENT ENGINE
       ===================================================== */

    const procurement =
        await calculateProcurement(
            item,
            forecast,
            risk
        );


    /* =====================================================
       CONVERT RISK INTO EVENTS
       ===================================================== */

    const events = [];


    if (
        risk.stockout_risk
    ) {

        events.push({

            item_id:
                item.id,

            risk_type:
                "STOCKOUT",

            severity:
                risk.stockout_risk &&
                risk.current_stock <= 0

                    ? "CRITICAL"

                    : risk.overall_severity,

            message:
                risk.reasons.find(
                    reason =>
                        reason
                            .toLowerCase()
                            .includes("stock")
                )
                ||
                "Stockout risk detected."

        });

    }


    if (
        risk.low_stock_risk
        &&
        !risk.stockout_risk
    ) {

        events.push({

            item_id:
                item.id,

            risk_type:
                "LOW_STOCK",

            severity:
                risk.current_stock
                <=
                risk.emergency_reserve

                    ? "CRITICAL"

                    : "WARNING",

            message:
                risk.current_stock
                <=
                risk.emergency_reserve

                    ? "Stock is at or below emergency reserve."

                    : "Stock is at or below minimum stock."

        });

    }


    if (
        risk.expiry_risk
    ) {

        events.push({

            item_id:
                item.id,

            risk_type:
                "EXPIRY",

            severity:
                risk.days_to_expiry !== null &&
                risk.days_to_expiry <= 7

                    ? "CRITICAL"

                    : "WARNING",

            message:

                risk.days_to_expiry < 0

                    ? "Medicine has expired."

                    : `Medicine expires in ${risk.days_to_expiry} days.`

        });

    }


    if (
        risk.anomaly &&
        risk.anomaly.is_anomaly
    ) {

        events.push({

            item_id:
                item.id,

            risk_type:
                "ABNORMAL_USAGE",

            severity:
                risk.anomaly.severity,

            message:
                risk.anomaly.reason

        });

    }


    return {

        item,

        forecast,

        risk,

        procurement,

        events

    };

}


/* =========================================================
   GET INTELLIGENCE
   ========================================================= */

async function getIntelligence(
    req,
    res
) {

    try {

        console.log("");
        console.log(
            "======================================"
        );

        console.log(
            "   MEDSUPPLY DEMAND INTELLIGENCE"
        );

        console.log(
            "======================================"
        );


        /* =================================================
           LOAD INVENTORY
           ================================================= */

        const inventory =
            await getInventory();


        console.log(
            "Inventory items:",
            inventory.length
        );


        /* =================================================
           PROCESS MEDICINES
           ================================================= */

        const results = [];


        for (
            const item of inventory
        ) {

            try {

                const result =
                    await processMedicine(
                        item
                    );


                results.push(
                    result
                );


            } catch (error) {

                console.error(

                    `INTELLIGENCE FAILED [${item.name}]:`,

                    error.message

                );


                /*
                   Keep the dashboard alive even if
                   one item fails.
                */

                results.push({

                    item,

                    forecast: null,

                    risk: {

                        item_id:
                            item.id,

                        medicine_name:
                            item.name,

                        current_stock:
                            Number(
                                item.current_stock || 0
                            ),

                        overall_risk:
                            "UNKNOWN",

                        overall_severity:
                            "INFO",

                        reasons:
                            [
                                "Unable to calculate intelligence for this item."
                            ]

                    },

                    procurement: {

                        item_id:
                            item.id,

                        medicine_name:
                            item.name,

                        procurement_required:
                            false,

                        recommended_quantity:
                            0,

                        priority:
                            "LOW"

                    },

                    events: []

                });

            }

        }


        /* =================================================
           SAVE RISK EVENTS
           ================================================= */

        const connection =
            await pool.getConnection();


        const activeEventKeys =
            new Set();


        try {

            await connection.beginTransaction();


            for (
                const result of results
            ) {

                for (
                    const event of result.events
                ) {

                    const key =
                        `${event.item_id}:${event.risk_type}`;


                    activeEventKeys.add(
                        key
                    );


                    await saveRiskEvent(
                        connection,
                        event
                    );

                }

            }


            await resolveOldRiskEvents(
                connection,
                activeEventKeys
            );


            await connection.commit();


        } catch (error) {

            await connection.rollback();

            console.error(
                "RISK EVENT SAVE ERROR:",
                error.message
            );

        } finally {

            connection.release();

        }


        /* =================================================
           SORT BY RISK
           ================================================= */

        results.sort(

            (a, b) => {

                const priority = {

                    CRITICAL: 1,

                    HIGH: 2,

                    WARNING: 3,

                    NORMAL: 4,

                    INFO: 5,

                    UNKNOWN: 6

                };


                const aPriority =
                    priority[
                        a.risk.overall_severity
                    ]
                    ||
                    6;


                const bPriority =
                    priority[
                        b.risk.overall_severity
                    ]
                    ||
                    6;


                return (
                    aPriority -
                    bPriority
                );

            }

        );


        /* =================================================
           STATISTICS
           ================================================= */

        const totalItems =
            results.length;


        const criticalItems =
            results.filter(
                result =>
                    result.risk.overall_severity
                    ===
                    "CRITICAL"
            ).length;


        const highRiskItems =
            results.filter(
                result =>
                    result.risk.overall_severity
                    ===
                    "HIGH"
            ).length;


        const warningItems =
            results.filter(
                result =>
                    result.risk.overall_severity
                    ===
                    "WARNING"
            ).length;


        const stockoutRisk =
            results.filter(
                result =>
                    result.risk.stockout_risk
            ).length;


        const lowStockRisk =
            results.filter(
                result =>
                    result.risk.low_stock_risk
            ).length;


        const expiryRisk =
            results.filter(
                result =>
                    result.risk.expiry_risk
            ).length;


        const abnormalUsage =
            results.filter(
                result =>
                    result.risk.anomaly &&
                    result.risk.anomaly.is_anomaly
            ).length;


        const procurementRequired =
            results.filter(
                result =>
                    result.procurement
                    &&
                    result.procurement
                        .procurement_required
            ).length;


        const totalRecommendedUnits =
            results.reduce(

                (sum, result) =>

                    sum
                    +
                    Number(
                        result.procurement
                            ?.recommended_quantity
                        ||
                        0
                    ),

                0

            );


        /* =================================================
           RISK EVENTS
           ================================================= */

        const activeRisks =
            await getExistingRiskEvents();


        /* =================================================
           MODEL INFORMATION
           ================================================= */

        const models = {

            forecast:
                "Weighted Moving Average + Trend",

            anomaly:
                "Statistical Anomaly Detection",

            risk:
                "Hybrid Inventory Risk Engine",

            procurement:
                "Demand + Lead-Time Procurement Engine"

        };


        console.log("");
        console.log(
            "Intelligence completed."
        );

        console.log(
            "Critical:",
            criticalItems
        );

        console.log(
            "High:",
            highRiskItems
        );

        console.log(
            "Warnings:",
            warningItems
        );

        console.log(
            "Procurement required:",
            procurementRequired
        );

        console.log(
            "======================================"
        );


        /* =================================================
           RESPONSE
           ================================================= */

        return res.json({

            success:
                true,

            generated_at:
                new Date().toISOString(),

            system:
                "MedSupply Intelligence",

            models,

            statistics: {

                total_items:
                    totalItems,

                critical_items:
                    criticalItems,

                high_risk_items:
                    highRiskItems,

                warning_items:
                    warningItems,

                stockout_risk:
                    stockoutRisk,

                low_stock_risk:
                    lowStockRisk,

                expiry_risk:
                    expiryRisk,

                abnormal_usage:
                    abnormalUsage,

                procurement_required:
                    procurementRequired,

                total_recommended_units:
                    totalRecommendedUnits

            },

            active_risks:
                activeRisks,

            data:
                results

        });

    } catch (error) {

        console.error(
            "INTELLIGENCE CONTROLLER ERROR:",
            error
        );


        return res.status(500).json({

            success:
                false,

            error:
                "Failed to generate demand intelligence.",

            details:
                error.message

        });

    }

}


/* =========================================================
   GET SINGLE MEDICINE INTELLIGENCE
   ========================================================= */

async function getMedicineIntelligence(
    req,
    res
) {

    try {

        const itemId =
            Number(
                req.params.id
            );


        if (
            !Number.isInteger(itemId)
            ||
            itemId <= 0
        ) {

            return res.status(400).json({

                success:
                    false,

                error:
                    "Invalid medicine ID."

            });

        }


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

            WHERE
                i.id = ?

            LIMIT 1
            `,

            [
                itemId
            ]

        );


        if (!rows.length) {

            return res.status(404).json({

                success:
                    false,

                error:
                    "Medicine not found."

            });

        }


        const result =
            await processMedicine(
                rows[0]
            );


        return res.json({

            success:
                true,

            generated_at:
                new Date().toISOString(),

            data:
                result

        });

    } catch (error) {

        console.error(
            "SINGLE MEDICINE INTELLIGENCE ERROR:",
            error
        );


        return res.status(500).json({

            success:
                false,

            error:
                "Failed to generate medicine intelligence.",

            details:
                error.message

        });

    }

}


/* =========================================================
   EXPORTS
   ========================================================= */

module.exports = {

    getIntelligence,

    getMedicineIntelligence,

    processMedicine,

    getInventory,

    getExistingRiskEvents

};