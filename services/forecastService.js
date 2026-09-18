const { spawn } = require("child_process");
const path = require("path");

const { pool } = require("../config/db");


/* =========================================================
   MEDSUPPLY INTELLIGENCE
   PYTHON FORECAST SERVICE

   Node.js
       ↓
   MySQL consumption_history
       ↓
   Python forecast.py
       ↓
   JSON forecast
       ↓
   Node.js
   ========================================================= */


/* =========================================================
   RUN PYTHON FORECAST
   ========================================================= */

function runPythonForecast(history, forecastDays = 7) {

    return new Promise((resolve, reject) => {

        const pythonScript =
            path.join(
                __dirname,
                "..",
                "ai",
                "forecast.py"
            );


        /*
         * Windows systems may use:
         *
         * python
         * python3
         * py
         *
         * "python" is used first because you already
         * successfully tested it from PowerShell.
         */

        const python =
            spawn(
                "python",
                [pythonScript]
            );


        let output = "";

        let errorOutput = "";


        /* =====================================================
           SEND DATA TO PYTHON
           ===================================================== */

        const input = JSON.stringify({

            history:
                history.map(row => ({

                    date:
                        row.consumption_date,

                    quantity:
                        Number(
                            row.quantity_consumed || 0
                        )

                })),

            forecast_days:
                forecastDays

        });


        python.stdin.write(input);

        python.stdin.end();


        /* =====================================================
           RECEIVE PYTHON OUTPUT
           ===================================================== */

        python.stdout.on(
            "data",
            data => {

                output +=
                    data.toString();

            }
        );


        /* =====================================================
           RECEIVE PYTHON ERRORS
           ===================================================== */

        python.stderr.on(
            "data",
            data => {

                errorOutput +=
                    data.toString();

            }
        );


        /* =====================================================
           PYTHON PROCESS FINISHED
           ===================================================== */

        python.on(
            "close",
            code => {

                if (code !== 0) {

                    return reject(
                        new Error(
                            errorOutput ||
                            `Python process exited with code ${code}`
                        )
                    );

                }


                try {

                    const result =
                        JSON.parse(
                            output.trim()
                        );


                    if (
                        !result.success
                    ) {

                        return reject(
                            new Error(
                                result.error ||
                                "Python forecast failed."
                            )
                        );

                    }


                    resolve(result);


                } catch (error) {

                    reject(

                        new Error(
                            "Invalid JSON returned by Python forecast engine. " +
                            `Python output: ${output}`
                        )

                    );

                }

            }
        );


        /* =====================================================
           PROCESS ERROR
           ===================================================== */

        python.on(
            "error",
            error => {

                reject(

                    new Error(
                        "Unable to start Python forecast engine: " +
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
                  INTERVAL ? DAY
              )
        ORDER BY
            consumption_date ASC
        `,

        [
            itemId,
            days
        ]

    );


    return rows;

}



/* =========================================================
   GENERATE FORECAST
   ========================================================= */

async function generateForecast(
    itemId,
    forecastDays = 7
) {

    try {

        console.log("");
        console.log(
            "--------------------------------------"
        );

        console.log(
            "PYTHON FORECAST"
        );

        console.log(
            "Medicine ID:",
            itemId
        );


        /* -----------------------------------------------------
           Get historical consumption
           ----------------------------------------------------- */

        const history =
            await getConsumptionHistory(
                itemId,
                90
            );


        console.log(
            "History records:",
            history.length
        );


        /* -----------------------------------------------------
           Run Python
           ----------------------------------------------------- */

        const result =
            await runPythonForecast(
                history,
                forecastDays
            );


        console.log(
            "Python model:",
            result.model
        );

        console.log(
            "Predicted daily:",
            result.predicted_daily
        );

        console.log(
            "Trend:",
            result.trend
        );

        console.log(
            "Confidence:",
            result.confidence
        );


        console.log(
            "--------------------------------------"
        );


        return {

            item_id:
                itemId,

            model:
                result.model,

            history_count:
                result.history_count,

            avg_7:
                result.avg_7,

            avg_30:
                result.avg_30,

            weighted_recent:
                result.weighted_recent,

            predicted_daily:
                result.predicted_daily,

            trend:
                result.trend,

            trend_change:
                result.trend_change,

            variability:
                result.variability,

            confidence:
                result.confidence,

            forecast:
                result.forecast

        };


    } catch (error) {

        console.error(
            "FORECAST SERVICE ERROR:",
            error.message
        );


        throw error;

    }

}



/* =========================================================
   SAVE FORECAST TO DATABASE
   ========================================================= */

async function saveForecast(
    itemId,
    forecast
) {

    try {

        /*
         * Save the first forecast value as the
         * current daily demand prediction.
         */

        const predictedDemand =
            Number(
                forecast.predicted_daily || 0
            );


        const confidence =
            Number(
                forecast.confidence || 0
            );


        await pool.query(

            `
            INSERT INTO demand_forecasts
            (
                item_id,
                forecast_date,
                predicted_demand,
                confidence,
                model_name
            )
            VALUES
            (
                ?,
                CURDATE(),
                ?,
                ?,
                ?
            )
            `,

            [

                itemId,

                predictedDemand,

                confidence,

                forecast.model ||
                    "Python Demand Intelligence"

            ]

        );


        return true;


    } catch (error) {

        console.error(
            "SAVE FORECAST ERROR:",
            error.message
        );


        throw error;

    }

}



/* =========================================================
   GENERATE + SAVE
   ========================================================= */

async function generateAndSaveForecast(
    itemId,
    forecastDays = 7
) {

    const forecast =
        await generateForecast(
            itemId,
            forecastDays
        );


    await saveForecast(
        itemId,
        forecast
    );


    return forecast;

}



/* =========================================================
   EXPORTS
   ========================================================= */

module.exports = {

    generateForecast,

    saveForecast,

    generateAndSaveForecast,

    getConsumptionHistory,

    runPythonForecast

};