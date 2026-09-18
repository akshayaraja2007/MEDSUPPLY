const { spawn } = require("child_process");
const path = require("path");

const { pool } = require("../config/db");


/* =========================================================
   MEDSUPPLY INTELLIGENCE
   RISK INTELLIGENCE ENGINE

   Inputs:
   - Current inventory
   - Minimum stock
   - Emergency reserve
   - Criticality
   - Expiry
   - Supplier lead time
   - Python demand forecast
   - Python anomaly detection

   Output:
   - Stockout risk
   - Low stock risk
   - Expiry risk
   - Abnormal usage risk
   - Days of cover
   - Lead-time demand
   ========================================================= */


/* =========================================================
   RUN PYTHON ANOMALY ENGINE
   ========================================================= */

function runPythonAnomaly(history) {

    return new Promise((resolve, reject) => {

        const pythonScript =
            path.join(
                __dirname,
                "..",
                "ai",
                "anomaly.py"
            );


        const python =
            spawn(
                "python",
                [pythonScript]
            );


        let output = "";
        let errorOutput = "";


        const input =
            JSON.stringify({

                history:
                    history.map(row => ({

                        date:
                            row.consumption_date,

                        quantity:
                            Number(
                                row.quantity_consumed || 0
                            )

                    }))

            });


        python.stdin.write(input);
        python.stdin.end();


        python.stdout.on(
            "data",
            data => {

                output +=
                    data.toString();

            }
        );


        python.stderr.on(
            "data",
            data => {

                errorOutput +=
                    data.toString();

            }
        );


        python.on(
            "close",
            code => {

                if (code !== 0) {

                    return reject(
                        new Error(
                            errorOutput ||
                            `Python anomaly process exited with code ${code}`
                        )
                    );

                }


                try {

                    const result =
                        JSON.parse(
                            output.trim()
                        );


                    if (!result.success) {

                        return reject(
                            new Error(
                                result.error ||
                                "Python anomaly engine failed."
                            )
                        );

                    }


                    resolve(result);

                } catch (error) {

                    reject(
                        new Error(
                            "Invalid JSON returned by Python anomaly engine. " +
                            `Python output: ${output}`
                        )
                    );

                }

            }
        );


        python.on(
            "error",
            error => {

                reject(
                    new Error(
                        "Unable to start Python anomaly engine: " +
                        error.message
                    )
                );

            }
        );

    });

}


/* =========================================================
   GET CONSUMPTION HISTORY
   ========================================================= */

async function getConsumptionHistory(
    itemId,
    days = 90
) {

    const [
        rows
    ] = await pool.query(

        `
        SELECT
            item_id,
            consumption_date,
            quantity_consumed,
            usage_type
        FROM consumption_history
        WHERE item_id = ?
          AND consumption_date >=
              DATE_SUB(
                  CURDATE(),
                  INTERVAL 90 DAY
              )
        ORDER BY
            consumption_date ASC
        `,

        [
            itemId
        ]

    );


    return rows;

}


/* =========================================================
   CALCULATE RISK
   ========================================================= */

async function calculateRisk(
    item,
    forecast = null
) {

    const itemId =
        Number(item.id);


    const currentStock =
        Number(
            item.current_stock || 0
        );


    const minimumStock =
        Number(
            item.minimum_stock || 0
        );


    const emergencyReserve =
        Number(
            item.emergency_reserve || 0
        );


    const leadTimeDays =
        Number(
            item.lead_time_days || 0
        );


    const criticality =
        String(
            item.criticality || "MEDIUM"
        ).toUpperCase();


    /* =====================================================
       DEMAND
       ===================================================== */

    let dailyDemand = 0;


    if (
        forecast &&
        Number(forecast.predicted_daily) > 0
    ) {

        dailyDemand =
            Number(
                forecast.predicted_daily
            );

    } else {

        dailyDemand =
            Number(
                item.avg_daily_consumption || 0
            );

    }


    /* =====================================================
       DAYS OF COVER
       ===================================================== */

    let daysOfCover = null;


    if (dailyDemand > 0) {

        daysOfCover =
            currentStock /
            dailyDemand;

    }


    /* =====================================================
       LEAD-TIME DEMAND
       ===================================================== */

    const leadTimeDemand =
        dailyDemand *
        leadTimeDays;


    /* =====================================================
       STOCK LEVEL CLASSIFICATION
       ===================================================== */

    let stockLevel =
        "NORMAL";


    if (currentStock <= 0) {

        stockLevel =
            "STOCKOUT";

    } else if (
        currentStock <= emergencyReserve
    ) {

        stockLevel =
            "EMERGENCY_RESERVE";

    } else if (
        currentStock <= minimumStock
    ) {

        stockLevel =
            "LOW";

    }


    /* =====================================================
       EXPIRY ANALYSIS
       ===================================================== */

    let daysToExpiry = null;

    let expiryRisk = false;

    let expirySeverity = "INFO";


    if (item.expiry_date) {

        const expiryDate =
            new Date(
                item.expiry_date
            );


        const today =
            new Date();


        today.setHours(
            0,
            0,
            0,
            0
        );


        expiryDate.setHours(
            0,
            0,
            0,
            0
        );


        const difference =
            expiryDate.getTime()
            - today.getTime();


        daysToExpiry =
            Math.ceil(
                difference /
                (1000 * 60 * 60 * 24)
            );


        if (daysToExpiry < 0) {

            expiryRisk = true;

            expirySeverity =
                "CRITICAL";

        } else if (
            daysToExpiry <= 7
        ) {

            expiryRisk = true;

            expirySeverity =
                "CRITICAL";

        } else if (
            daysToExpiry <= 30
        ) {

            expiryRisk = true;

            expirySeverity =
                "WARNING";

        }

    }


    /* =====================================================
       STOCKOUT RISK
       ===================================================== */

    let stockoutRisk =
        false;


    let stockoutSeverity =
        "INFO";


    let stockoutMessage =
        "Inventory is sufficient for the current demand."


    if (currentStock <= 0) {

        stockoutRisk =
            true;

        stockoutSeverity =
            "CRITICAL";

        stockoutMessage =
            "Medicine is currently out of stock.";

    } else if (
        daysOfCover !== null &&
        daysOfCover <= leadTimeDays
    ) {

        stockoutRisk =
            true;

        stockoutSeverity =
            criticality === "CRITICAL"
                ? "CRITICAL"
                : "HIGH";


        stockoutMessage =
            `Projected stock cover is ${daysOfCover.toFixed(1)} days, ` +
            `while supplier lead time is ${leadTimeDays} days.`;

    }


    /* =====================================================
       LOW STOCK RISK
       ===================================================== */

    let lowStockRisk =
        false;


    let lowStockSeverity =
        "INFO";


    let lowStockMessage =
        "Stock is above the minimum inventory level.";


    if (
        currentStock <= emergencyReserve
    ) {

        lowStockRisk =
            true;

        lowStockSeverity =
            criticality === "CRITICAL"
                ? "CRITICAL"
                : "HIGH";


        lowStockMessage =
            "Stock has reached or fallen below the emergency reserve.";

    } else if (
        currentStock <= minimumStock
    ) {

        lowStockRisk =
            true;

        lowStockSeverity =
            "WARNING";


        lowStockMessage =
            "Stock is at or below the minimum inventory level.";

    }


    /* =====================================================
       ANOMALY ANALYSIS
       ===================================================== */

    let anomaly = {

        is_anomaly:
            false,

        severity:
            "INFO",

        reason:
            "No anomaly detected.",

        anomaly_score:
            0,

        direction:
            "STABLE",

        confidence:
            0,

        recent_average:
            0,

        historical_average:
            0,

        demand_change_percent:
            0

    };


    try {

        const history =
            await getConsumptionHistory(
                itemId
            );


        if (history.length >= 3) {

            anomaly =
                await runPythonAnomaly(
                    history
                );

        }

    } catch (error) {

        console.error(
            `ANOMALY ERROR [Item ${itemId}]:`,
            error.message
        );

    }


    /* =====================================================
       OVERALL RISK
       ===================================================== */

    let overallSeverity =
        "INFO";


    let overallRisk =
        "NORMAL";


    if (
        stockoutSeverity === "CRITICAL"
        ||
        expirySeverity === "CRITICAL"
        ||
        (
            anomaly.is_anomaly &&
            anomaly.severity === "CRITICAL"
        )
    ) {

        overallSeverity =
            "CRITICAL";

        overallRisk =
            "CRITICAL";

    } else if (
        stockoutSeverity === "HIGH"
        ||
        lowStockSeverity === "HIGH"
        ||
        expirySeverity === "CRITICAL"
        ||
        (
            anomaly.is_anomaly &&
            anomaly.severity === "HIGH"
        )
    ) {

        overallSeverity =
            "HIGH";

        overallRisk =
            "HIGH";

    } else if (
        lowStockRisk
        ||
        expiryRisk
        ||
        (
            anomaly.is_anomaly &&
            anomaly.severity === "WARNING"
        )
    ) {

        overallSeverity =
            "WARNING";

        overallRisk =
            "WARNING";

    }


    /* =====================================================
       RISK REASONS
       ===================================================== */

    const reasons = [];


    if (stockoutRisk) {

        reasons.push(
            stockoutMessage
        );

    }


    if (lowStockRisk) {

        reasons.push(
            lowStockMessage
        );

    }


    if (expiryRisk) {

        if (daysToExpiry < 0) {

            reasons.push(
                "Medicine has already passed its recorded expiry date."
            );

        } else {

            reasons.push(
                `Medicine expires in ${daysToExpiry} days.`
            );

        }

    }


    if (anomaly.is_anomaly) {

        reasons.push(
            anomaly.reason
        );

    }


    if (!reasons.length) {

        reasons.push(
            "No significant inventory risk detected."
        );

    }


    /* =====================================================
       PROCUREMENT SIGNAL
       ===================================================== */

    let procurementRequired =
        false;


    if (
        currentStock <= minimumStock
        ||
        stockoutRisk
        ||
        (
            daysOfCover !== null &&
            daysOfCover <= leadTimeDays + 3
        )
    ) {

        procurementRequired =
            true;

    }


    /* =====================================================
       RETURN RESULT
       ===================================================== */

    return {

        item_id:
            itemId,

        medicine_name:
            item.name,

        criticality,

        current_stock:
            currentStock,

        minimum_stock:
            minimumStock,

        emergency_reserve:
            emergencyReserve,

        stock_level:
            stockLevel,

        daily_demand:
            Number(
                dailyDemand.toFixed(2)
            ),

        days_of_cover:
            daysOfCover === null
                ? null
                : Number(
                    daysOfCover.toFixed(2)
                ),

        lead_time_days:
            leadTimeDays,

        lead_time_demand:
            Number(
                leadTimeDemand.toFixed(2)
            ),

        stockout_risk:
            stockoutRisk,

        low_stock_risk:
            lowStockRisk,

        expiry_risk:
            expiryRisk,

        days_to_expiry:
            daysToExpiry,

        anomaly,

        overall_risk:
            overallRisk,

        overall_severity:
            overallSeverity,

        procurement_required:
            procurementRequired,

        reasons

    };

}


/* =========================================================
   GENERATE RISK EVENTS
   ========================================================= */

async function generateRiskEvents(
    item,
    forecast = null
) {

    const risk =
        await calculateRisk(
            item,
            forecast
        );


    const events = [];


    /* =====================================================
       STOCKOUT
       ===================================================== */

    if (
        risk.stockout_risk
    ) {

        events.push({

            item_id:
                risk.item_id,

            risk_type:
                "STOCKOUT",

            severity:
                risk.overall_severity === "CRITICAL"
                    ? "CRITICAL"
                    : "HIGH",

            message:
                risk.reasons.find(
                    reason =>
                        reason.toLowerCase()
                            .includes("stock")
                )
                ||
                "Stockout risk detected."

        });

    }


    /* =====================================================
       LOW STOCK
       ===================================================== */

    if (
        risk.low_stock_risk
        &&
        !risk.stockout_risk
    ) {

        events.push({

            item_id:
                risk.item_id,

            risk_type:
                "LOW_STOCK",

            severity:
                risk.low_stock_risk
                    ? (
                        risk.current_stock
                        <=
                        risk.emergency_reserve
                            ? "CRITICAL"
                            : "WARNING"
                    )
                    : "INFO",

            message:
                risk.current_stock
                <=
                risk.emergency_reserve

                    ? "Stock is at or below emergency reserve."

                    : "Stock is at or below minimum level."

        });

    }


    /* =====================================================
       EXPIRY
       ===================================================== */

    if (
        risk.expiry_risk
    ) {

        events.push({

            item_id:
                risk.item_id,

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


    /* =====================================================
       ABNORMAL USAGE
       ===================================================== */

    if (
        risk.anomaly &&
        risk.anomaly.is_anomaly
    ) {

        events.push({

            item_id:
                risk.item_id,

            risk_type:
                "ABNORMAL_USAGE",

            severity:
                risk.anomaly.severity,

            message:
                risk.anomaly.reason

        });

    }


    return {

        risk,

        events

    };

}


module.exports = {

    calculateRisk,

    generateRiskEvents,

    getConsumptionHistory,

    runPythonAnomaly

};