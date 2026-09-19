/* =========================================
   MEDSUPPLY INTELLIGENCE
   DASHBOARD JAVASCRIPT
   ========================================= */

const API_BASE =
    "https://medsupply-oegb.onrender.com/api";

let intelligenceData = [];
let dashboardLoaded = false;
let intelligenceStatistics = null;


/* =========================================
   DOM HELPERS
   ========================================= */

function $(id) {
    return document.getElementById(id);
}


function showElement(id) {

    const element = $(id);

    if (element) {
        element.style.display = "";
    }

}


function hideElement(id) {

    const element = $(id);

    if (element) {
        element.style.display = "none";
    }

}


function setText(id, value) {

    const element = $(id);

    if (element) {
        element.textContent = value;
    }

}


/* =========================================
   FORMATTERS
   ========================================= */

function formatNumber(value) {

    const number =
        Number(value || 0);

    return number.toLocaleString(
        "en-IN",
        {
            maximumFractionDigits: 2
        }
    );

}


function formatInteger(value) {

    const number =
        Math.round(
            Number(value || 0)
        );

    return number.toLocaleString(
        "en-IN"
    );

}


function formatCurrency(value) {

    const number =
        Number(value || 0);

    return number.toLocaleString(
        "en-IN",
        {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2
        }
    );

}


function formatDate(value) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return value;
    }

    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


function getDaysUntil(dateValue) {

    if (!dateValue) {
        return null;
    }

    const expiry =
        new Date(dateValue);

    const today =
        new Date();

    expiry.setHours(
        0,
        0,
        0,
        0
    );

    today.setHours(
        0,
        0,
        0,
        0
    );

    return Math.ceil(
        (
            expiry - today
        ) /
        (
            1000 *
            60 *
            60 *
            24
        )
    );

}


/* =========================================
   STATUS HELPERS
   ========================================= */

function normalizeStatus(status) {

    return String(
        status || ""
    )
        .trim()
        .toUpperCase()
        .replace(
            /[\s-]+/g,
            "_"
        );

}


function statusLabel(status) {

    const normalized =
        normalizeStatus(status);

    const labels = {

        NORMAL:
            "Normal",

        LOW:
            "Low",

        CRITICAL:
            "Critical",

        STOCKOUT_RISK:
            "Stockout Risk",

        EXPIRING_SOON:
            "Expiring Soon",

        INFO:
            "Info",

        WARNING:
            "Warning",

        HIGH:
            "High"

    };

    return (
        labels[normalized]
        ||
        status
        ||
        "Unknown"
    );

}


function riskClass(status) {

    const normalized =
        normalizeStatus(status);

    if (
        normalized === "CRITICAL" ||
        normalized === "STOCKOUT_RISK"
    ) {
        return "risk-critical";
    }

    if (
        normalized === "HIGH"
    ) {
        return "risk-high";
    }

    if (
        normalized === "WARNING" ||
        normalized === "LOW" ||
        normalized === "EXPIRING_SOON"
    ) {
        return "risk-warning";
    }

    return "risk-normal";

}


function riskBadge(status) {

    const normalized =
        normalizeStatus(status);

    let className =
        "badge badge-neutral";

    if (
        normalized === "CRITICAL" ||
        normalized === "STOCKOUT_RISK"
    ) {

        className =
            "badge badge-danger";

    } else if (
        normalized === "HIGH"
    ) {

        className =
            "badge badge-high";

    } else if (
        normalized === "WARNING" ||
        normalized === "LOW" ||
        normalized === "EXPIRING_SOON"
    ) {

        className =
            "badge badge-warning";

    } else if (
        normalized === "NORMAL" ||
        normalized === "INFO"
    ) {

        className =
            "badge badge-success";

    }

    return `
        <span class="${className}">
            ${escapeHtml(
                statusLabel(status)
            )}
        </span>
    `;

}


function trendClass(trend) {

    const normalized =
        String(trend || "")
            .trim()
            .toUpperCase();

    if (
        normalized.includes("INCREAS")
    ) {
        return "trend-up";
    }

    if (
        normalized.includes("DECREAS")
    ) {
        return "trend-down";
    }

    return "trend-stable";

}


function trendLabel(trend) {

    const normalized =
        String(trend || "")
            .trim()
            .toUpperCase();

    if (
        normalized.includes("INCREAS")
    ) {
        return "Increasing";
    }

    if (
        normalized.includes("DECREAS")
    ) {
        return "Decreasing";
    }

    return "Stable";

}


/* =========================================
   SECURITY HELPER
   ========================================= */

function escapeHtml(value) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================
   MESSAGE HANDLING
   ========================================= */

function showMessage(
    message,
    type = "info"
) {

    const element =
        $("dashboardMessage");

    if (!element) {
        return;
    }

    element.textContent =
        message;

    element.className =
        `dashboard-message ${type}`;

    element.style.display =
        "block";

}


function hideMessage() {

    const element =
        $("dashboardMessage");

    if (element) {
        element.style.display =
            "none";
    }

}


/* =========================================
   API REQUEST
   ========================================= */

async function fetchIntelligence() {

    const response =
        await fetch(
            `${API_BASE}/intelligence`,
            {
                method: "GET",

                headers: {
                    "Accept":
                        "application/json"
                },

                cache: "no-store"
            }
        );

    let result;

    try {

        result =
            await response.json();

    } catch (error) {

        throw new Error(
            `Server returned invalid JSON (${response.status}).`
        );

    }

    if (!response.ok) {

        throw new Error(
            result.error
            ||
            result.message
            ||
            `Request failed with status ${response.status}.`
        );

    }

    if (!result.success) {

        throw new Error(
            result.error
            ||
            result.message
            ||
            "Intelligence engine failed."
        );

    }

    return result;

}


/* =========================================
   DATA NORMALIZATION
   IMPORTANT:
   API STRUCTURE IS:

   {
       item: {...},
       forecast: {...},
       risk: {...},
       procurement: {...}
   }
   ========================================= */

function normalizeIntelligenceItem(record) {

    const item =
        record.item
        ||
        {};

    const forecast =
        record.forecast
        ||
        {};

    const risk =
        record.risk
        ||
        {};

    const procurement =
        record.procurement
        ||
        {};

    /* -------------------------------------
       STOCK
       ------------------------------------- */

    const stock =
        Number(
            item.current_stock ??
            0
        );


    /* -------------------------------------
       DAILY DEMAND
       ------------------------------------- */

    const dailyDemand =
        Number(
            forecast.predicted_daily ??
            risk.daily_demand ??
            0
        );


    /* -------------------------------------
       DAYS OF COVER
       ------------------------------------- */

    let daysOfCover =
        Number(
            risk.days_of_cover
        );

    if (
        !Number.isFinite(daysOfCover)
        ||
        daysOfCover < 0
    ) {

        if (
            dailyDemand > 0
        ) {

            daysOfCover =
                stock /
                dailyDemand;

        } else {

            daysOfCover =
                Infinity;

        }

    }


    /* -------------------------------------
       RISK
       ------------------------------------- */

    const riskLevel =
        risk.overall_risk
        ||
        risk.overall_severity
        ||
        "NORMAL";


    /* -------------------------------------
       RECOMMENDED PROCUREMENT
       ------------------------------------- */

    const recommendedOrder =
        Number(
            procurement.recommended_quantity
            ??
            0
        );


    /* -------------------------------------
       EXPIRY
       ------------------------------------- */

    const expiryDate =
        item.expiry_date
        ||
        null;


    /* -------------------------------------
       FORECAST
       ------------------------------------- */

    const forecastModel =
        forecast.model
        ||
        "Weighted Moving Average + Trend";


    const confidence =
        Number(
            forecast.confidence
            ??
            0
        );


    /* -------------------------------------
       NORMALIZED OBJECT
       ------------------------------------- */

    return {

        /* Raw data */
        ...record,

        /* Inventory */
        id:
            item.id,

        item_id:
            item.id,

        name:
            item.name
            ||
            risk.medicine_name
            ||
            procurement.medicine_name
            ||
            "Unknown Medicine",

        medicine_name:
            item.name
            ||
            risk.medicine_name
            ||
            procurement.medicine_name
            ||
            "Unknown Medicine",

        category:
            item.category
            ||
            procurement.category
            ||
            "—",

        unit:
            item.unit
            ||
            "units",

        current_stock:
            stock,

        minimum_stock:
            Number(
                item.minimum_stock ??
                0
            ),

        emergency_reserve:
            Number(
                item.emergency_reserve ??
                0
            ),

        criticality:
            item.criticality
            ||
            risk.criticality
            ||
            "MEDIUM",

        expiry_date:
            expiryDate,

        status:
            item.status
            ||
            "NORMAL",

        supplier_id:
            item.supplier_id
            ??
            procurement.supplier_id
            ??
            null,

        supplier_name:
            item.supplier_name
            ||
            procurement.supplier_name
            ||
            "Supplier not assigned",

        lead_time_days:
            Number(
                item.lead_time_days
                ??
                procurement.lead_time_days
                ??
                0
            ),

        unit_cost:
            Number(
                item.unit_cost
                ??
                procurement.unit_cost
                ??
                0
            ),


        /* Forecast */

        daily_demand:
            dailyDemand,

        predicted_daily:
            Number(
                forecast.predicted_daily
                ??
                0
            ),

        days_of_cover:
            daysOfCover,

        trend:
            forecast.trend
            ||
            "STABLE",

        trend_change:
            Number(
                forecast.trend_change
                ??
                0
            ),

        confidence:
            confidence,

        forecast_model:
            forecastModel,

        forecast_data:
            forecast.forecast
            ||
            [],


        /* Risk */

        risk_level:
            riskLevel,

        overall_risk:
            risk.overall_risk
            ||
            "NORMAL",

        overall_severity:
            risk.overall_severity
            ||
            "INFO",

        stock_level:
            risk.stock_level
            ||
            "NORMAL",

        stockout_risk:
            Boolean(
                risk.stockout_risk
            ),

        low_stock_risk:
            Boolean(
                risk.low_stock_risk
            ),

        expiry_risk:
            Boolean(
                risk.expiry_risk
            ),

        days_to_expiry:
            risk.days_to_expiry,

        risk_message:
            (
                risk.reasons
                &&
                risk.reasons.length
            )
                ? risk.reasons.join(" ")
                : "",

        risk_reasons:
            risk.reasons
            ||
            [],

        anomaly:
            risk.anomaly
            ||
            null,


        /* Procurement */

        recommended_order:
            recommendedOrder,

        recommended_quantity:
            recommendedOrder,

        procurement_required:
            Boolean(
                procurement.procurement_required
            ),

        procurement_priority:
            procurement.priority
            ||
            "LOW",

        procurement_reason:
            procurement.reason
            ||
            "",

        procurement_reasons:
            procurement.reasons
            ||
            [],

        estimated_cost:
            Number(
                procurement.estimated_cost
                ??
                0
            ),

        expected_delivery_date:
            procurement.expected_delivery_date
            ||
            null

    };

}


/* =========================================
   KPI CALCULATIONS
   ========================================= */

function calculateKpis(items) {

    const statistics =
        intelligenceStatistics
        ||
        {};


    /* -------------------------------------
       TOTAL MEDICINES
       ------------------------------------- */

    const totalMedicines =
        Number(
            statistics.total_items
            ??
            items.length
        );


    /* -------------------------------------
       TOTAL STOCK
       ------------------------------------- */

    const totalStock =
        items.reduce(
            (
                sum,
                item
            ) =>
                sum +
                Number(
                    item.current_stock || 0
                ),
            0
        );


    /* -------------------------------------
       CRITICAL RISKS

       Prefer backend statistics because
       backend risk engine is authoritative.
       ------------------------------------- */

    const criticalRisks =
        Number(
            statistics.critical_items
            ??
            items.filter(
                item =>
                    normalizeStatus(
                        item.overall_risk
                    ) === "CRITICAL"
            ).length
        );


    /* -------------------------------------
       PROCUREMENT NEED
       ------------------------------------- */

    const procurementNeed =
        Number(
            statistics.total_recommended_units
            ??
            items.reduce(
                (
                    sum,
                    item
                ) =>
                    sum +
                    Number(
                        item.recommended_order || 0
                    ),
                0
            )
        );


    /* -------------------------------------
       AVERAGE CONFIDENCE
       ------------------------------------- */

    const confidenceValues =
        items
            .map(
                item =>
                    Number(
                        item.confidence
                    )
            )
            .filter(
                value =>
                    Number.isFinite(value)
                    &&
                    value > 0
            );


    const averageConfidence =
        confidenceValues.length
            ? confidenceValues.reduce(
                (
                    sum,
                    value
                ) =>
                    sum + value,
                0
            ) /
            confidenceValues.length
            : 0;


    /* -------------------------------------
       UPDATE DOM
       ------------------------------------- */

    setText(
        "totalMedicines",
        formatInteger(
            totalMedicines
        )
    );


    setText(
        "totalStock",
        formatInteger(
            totalStock
        )
    );


    setText(
        "criticalRisks",
        formatInteger(
            criticalRisks
        )
    );


    setText(
        "procurementNeed",
        formatInteger(
            procurementNeed
        )
    );


    setText(
        "averageConfidence",
        averageConfidence
            ? `${averageConfidence.toFixed(0)}%`
            : "—"
    );


    /* -------------------------------------
       FORECAST MODEL
       ------------------------------------- */

    const model =
        items.find(
            item =>
                item.forecast_model
        )?.forecast_model
        ||
        "Weighted Moving Average + Trend";


    setText(
        "forecastModel",
        model
    );

}


/* =========================================
   RISK SUMMARY
   ========================================= */

function calculateRiskSummary(items) {

    const statistics =
        intelligenceStatistics
        ||
        {};


    /*
       Backend statistics are used first.
       This exactly matches the intelligence
       engine's risk classification.
    */

    const critical =
        Number(
            statistics.critical_items
            ??
            0
        );


    const high =
        Number(
            statistics.high_risk_items
            ??
            items.filter(
                item =>
                    normalizeStatus(
                        item.overall_risk
                    ) === "HIGH"
            ).length
        );


    const warning =
        Number(
            statistics.warning_items
            ??
            items.filter(
                item =>
                    normalizeStatus(
                        item.overall_risk
                    ) === "WARNING"
            ).length
        );


    const normal =
        Math.max(
            items.length -
            critical -
            high -
            warning,
            0
        );


    setText(
        "criticalRiskCount",
        critical
    );


    setText(
        "highRiskCount",
        high
    );


    setText(
        "warningRiskCount",
        warning
    );


    setText(
        "normalRiskCount",
        normal
    );

}


/* =========================================
   INVENTORY STATUS
   ========================================= */

function calculateInventoryStatus(items) {

    let normal = 0;
    let low = 0;
    let critical = 0;
    let stockout = 0;
    let expiring = 0;


    items.forEach(
        item => {

            const status =
                normalizeStatus(
                    item.status
                );


            const risk =
                normalizeStatus(
                    item.overall_risk
                );


            const daysToExpiry =
                Number(
                    item.days_to_expiry
                );


            /*
               Stockout status
            */

            if (
                status === "STOCKOUT_RISK"
                ||
                item.stockout_risk
            ) {

                stockout++;

                return;

            }


            /*
               Critical inventory
            */

            if (
                status === "CRITICAL"
            ) {

                critical++;

                return;

            }


            /*
               Low inventory
            */

            if (
                status === "LOW"
                ||
                item.low_stock_risk
            ) {

                low++;

                return;

            }


            /*
               Expiry risk

               Only classify as expiry here if
               there is no stock-level issue.
            */

            if (
                item.expiry_risk
                ||
                (
                    Number.isFinite(daysToExpiry)
                    &&
                    daysToExpiry <= 30
                )
            ) {

                expiring++;

                return;

            }


            /*
               Normal
            */

            normal++;

        }
    );


    setText(
        "inventoryNormalCount",
        normal
    );


    setText(
        "inventoryLowCount",
        low
    );


    setText(
        "inventoryCriticalCount",
        critical
    );


    setText(
        "inventoryStockoutCount",
        stockout
    );


    setText(
        "inventoryExpiringCount",
        expiring
    );

}


/* =========================================
   PRIORITY MEDICINES
   ========================================= */

function renderPriorityMedicines(items) {

    const body =
        $("priorityMedicinesBody");

    if (!body) {
        return;
    }


    const priorityItems =
        [...items]
            .filter(
                item => {

                    const status =
                        normalizeStatus(
                            item.status
                        );


                    const risk =
                        normalizeStatus(
                            item.overall_risk
                        );


                    const recommended =
                        Number(
                            item.recommended_order ||
                            0
                        );


                    const days =
                        Number(
                            item.days_of_cover
                        );


                    const leadTime =
                        Number(
                            item.lead_time_days
                        );


                    return (

                        status !== "NORMAL"
                        ||
                        risk !== "NORMAL"
                        ||
                        recommended > 0
                        ||
                        (
                            Number.isFinite(days)
                            &&
                            leadTime > 0
                            &&
                            days <= leadTime
                        )

                    );

                }
            )
            .sort(
                (
                    a,
                    b
                ) => {

                    const scoreA =
                        getPriorityScore(a);

                    const scoreB =
                        getPriorityScore(b);

                    return (
                        scoreB -
                        scoreA
                    );

                }
            )
            .slice(
                0,
                12
            );


    if (!priorityItems.length) {

        body.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="table-empty"
                >

                    No medicines currently require attention.

                </td>

            </tr>

        `;

        return;

    }


    body.innerHTML =
        priorityItems
            .map(
                item => {

                    const days =
                        Number(
                            item.days_of_cover
                        );


                    const daysText =
                        Number.isFinite(days)
                            ? `${days.toFixed(1)} days`
                            : "∞";


                    return `

                        <tr>

                            <td>

                                <div class="medicine-name-cell">

                                    <strong>
                                        ${escapeHtml(
                                            item.name
                                        )}
                                    </strong>

                                    <small>
                                        ${escapeHtml(
                                            item.criticality ||
                                            "MEDIUM"
                                        )}
                                    </small>

                                </div>

                            </td>


                            <td>

                                <strong>
                                    ${formatInteger(
                                        item.current_stock
                                    )}
                                </strong>

                            </td>


                            <td>

                                ${formatNumber(
                                    item.daily_demand
                                )}

                            </td>


                            <td>

                                ${daysText}

                            </td>


                            <td>

                                <span class="${trendClass(
                                    item.trend
                                )}">

                                    ${trendLabel(
                                        item.trend
                                    )}

                                </span>

                            </td>


                            <td>

                                ${riskBadge(
                                    item.overall_risk
                                )}

                            </td>


                            <td>

                                <strong>

                                    ${
                                        item.recommended_order > 0
                                            ? formatInteger(
                                                item.recommended_order
                                            )
                                            : "—"
                                    }

                                </strong>

                            </td>

                        </tr>

                    `;

                }
            )
            .join("");

}


/* =========================================
   PRIORITY SCORE
   ========================================= */

function getPriorityScore(item) {

    const status =
        normalizeStatus(
            item.status
        );


    const risk =
        normalizeStatus(
            item.overall_risk
        );


    let score = 0;


    if (
        status === "STOCKOUT_RISK"
        ||
        risk === "STOCKOUT_RISK"
        ||
        item.stockout_risk
    ) {

        score += 100;

    }


    if (
        status === "CRITICAL"
        ||
        risk === "CRITICAL"
    ) {

        score += 90;

    }


    if (
        risk === "HIGH"
    ) {

        score += 70;

    }


    if (
        status === "LOW"
        ||
        risk === "LOW"
        ||
        risk === "WARNING"
        ||
        item.low_stock_risk
    ) {

        score += 40;

    }


    if (
        item.expiry_risk
    ) {

        score += 30;

    }


    const days =
        Number(
            item.days_of_cover
        );


    const leadTime =
        Number(
            item.lead_time_days
        );


    if (
        Number.isFinite(days)
        &&
        leadTime > 0
    ) {

        if (
            days <= leadTime
        ) {

            score += 50;

        }


        if (
            days <=
            leadTime / 2
        ) {

            score += 25;

        }

    }


    score += Math.min(
        Number(
            item.recommended_order ||
            0
        ) / 100,
        20
    );


    return score;

}


/* =========================================
   PROCUREMENT RECOMMENDATIONS
   ========================================= */

function renderProcurement(items) {

    const container =
        $("procurementList");

    if (!container) {
        return;
    }


    const recommendations =
        [...items]
            .filter(
                item =>
                    Number(
                        item.recommended_order ||
                        0
                    ) > 0
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    Number(
                        b.recommended_order ||
                        0
                    ) -
                    Number(
                        a.recommended_order ||
                        0
                    )
            )
            .slice(
                0,
                8
            );


    if (!recommendations.length) {

        container.innerHTML = `

            <div class="table-empty">

                No procurement actions required.

            </div>

        `;

        return;

    }


    container.innerHTML =
        recommendations
            .map(
                item => {

                    const supplier =
                        item.supplier_name
                        ||
                        "Supplier not assigned";


                    return `

                        <div class="procurement-item">

                            <div class="procurement-main">

                                <strong>
                                    ${escapeHtml(
                                        item.name
                                    )}
                                </strong>

                                <span>
                                    ${escapeHtml(
                                        supplier
                                    )}
                                </span>

                            </div>


                            <div class="procurement-quantity">

                                <strong>
                                    ${formatInteger(
                                        item.recommended_order
                                    )}
                                </strong>

                                <span>
                                    units
                                </span>

                            </div>

                        </div>

                    `;

                }
            )
            .join("");

}


/* =========================================
   EXPIRY WATCH
   ========================================= */

function renderExpiryWatch(items) {

    const body =
        $("expiryTableBody");

    if (!body) {
        return;
    }


    const expiryItems =
        items
            .filter(
                item =>
                    item.expiry_date
            )
            .map(
                item => ({

                    ...item,

                    days_until_expiry:
                        getDaysUntil(
                            item.expiry_date
                        )

                })
            )
            .filter(
                item =>
                    item.days_until_expiry !== null
                    &&
                    item.days_until_expiry <= 90
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    a.days_until_expiry -
                    b.days_until_expiry
            )
            .slice(
                0,
                12
            );


    if (!expiryItems.length) {

        body.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="table-empty"
                >

                    No medicines are approaching expiry.

                </td>

            </tr>

        `;

        return;

    }


    body.innerHTML =
        expiryItems
            .map(
                item => {

                    const days =
                        item.days_until_expiry;


                    let expiryRisk =
                        "NORMAL";


                    if (
                        days <= 0
                    ) {

                        expiryRisk =
                            "CRITICAL";

                    } else if (
                        days <= 15
                    ) {

                        expiryRisk =
                            "CRITICAL";

                    } else if (
                        days <= 30
                    ) {

                        expiryRisk =
                            "WARNING";

                    } else {

                        expiryRisk =
                            "INFO";

                    }


                    return `

                        <tr>

                            <td>

                                <strong>

                                    ${escapeHtml(
                                        item.name
                                    )}

                                </strong>

                            </td>


                            <td>

                                ${formatDate(
                                    item.expiry_date
                                )}

                            </td>


                            <td>

                                <strong>

                                    ${
                                        days <= 0
                                            ? "Expired"
                                            : `${days} days`
                                    }

                                </strong>

                            </td>


                            <td>

                                ${formatInteger(
                                    item.current_stock
                                )}

                            </td>


                            <td>

                                ${riskBadge(
                                    expiryRisk
                                )}

                            </td>

                        </tr>

                    `;

                }
            )
            .join("");

}


/* =========================================
   AI ENGINE STATUS
   ========================================= */

function updateAiStatus(items) {

    const status =
        $("aiEngineStatus");

    if (!status) {
        return;
    }


    if (!items.length) {

        status.textContent =
            "NO DATA";

        status.className =
            "badge badge-warning";

        return;

    }


    status.textContent =
        "ACTIVE";

    status.className =
        "badge badge-success";

}


/* =========================================
   DASHBOARD RENDER
   ========================================= */

function renderDashboard(result) {

    /*
       Save backend statistics.

       Example:

       total_items: 21
       critical_items: 4
       warning_items: 4
       procurement_required: 8
       total_recommended_units: 3462
    */

    intelligenceStatistics =
        result.statistics
        ||
        null;


    const rawData =
        Array.isArray(
            result.data
        )
            ? result.data
            : [];


    /*
       IMPORTANT FIX

       Convert:

       {
           item: {},
           forecast: {},
           risk: {},
           procurement: {}
       }

       into the flat structure used
       by the dashboard UI.
    */

    intelligenceData =
        rawData.map(
            normalizeIntelligenceItem
        );


    console.log(
        "MEDSUPPLY INTELLIGENCE:",
        {
            statistics:
                intelligenceStatistics,

            records:
                intelligenceData.length,

            data:
                intelligenceData
        }
    );


    /* -------------------------------------
       RENDER ALL SECTIONS
       ------------------------------------- */

    calculateKpis(
        intelligenceData
    );


    calculateRiskSummary(
        intelligenceData
    );


    calculateInventoryStatus(
        intelligenceData
    );


    renderPriorityMedicines(
        intelligenceData
    );


    renderProcurement(
        intelligenceData
    );


    renderExpiryWatch(
        intelligenceData
    );


    updateAiStatus(
        intelligenceData
    );


    dashboardLoaded =
        true;


    /* -------------------------------------
       UPDATE CONNECTION STATUS
       ------------------------------------- */

    const status =
        $("dashboardStatus");


    if (status) {

        status.innerHTML = `

            <span class="status-dot"></span>

            Updated ${new Date().toLocaleTimeString(
                "en-IN",
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            )}

        `;

    }

}


/* =========================================
   LOAD DASHBOARD
   ========================================= */

async function loadDashboard() {

    const loading =
        $("dashboardLoading");


    const refreshButton =
        $("refreshDashboardBtn");


    hideMessage();


    if (loading) {

        loading.style.display =
            "block";

    }


    if (refreshButton) {

        refreshButton.disabled =
            true;

    }


    try {

        const result =
            await fetchIntelligence();


        renderDashboard(
            result
        );


    } catch (error) {

        console.error(
            "DASHBOARD ERROR:",
            error
        );


        showMessage(
            error.message
            ||
            "Unable to load dashboard intelligence.",
            "error"
        );


        const status =
            $("dashboardStatus");


        if (status) {

            status.innerHTML = `

                <span class="status-dot"></span>

                Connection Error

            `;

        }

    } finally {

        if (loading) {

            loading.style.display =
                "none";

        }


        if (refreshButton) {

            refreshButton.disabled =
                false;

        }

    }

}


/* =========================================
   REFRESH BUTTON
   ========================================= */

function setupRefreshButton() {

    const button =
        $("refreshDashboardBtn");


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        async () => {

            await loadDashboard();

        }
    );

}


/* =========================================
   AUTO REFRESH
   ========================================= */

function setupAutoRefresh() {

    /*
       Refresh every 5 minutes.

       This keeps the dashboard current after
       billing/invoice transactions without
       continuously hitting the backend.
    */

    setInterval(
        async () => {

            if (
                document.visibilityState ===
                "visible"
            ) {

                await loadDashboard();

            }

        },
        5 * 60 * 1000
    );

}


/* =========================================
   INITIALIZE
   ========================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        setupRefreshButton();

        setupAutoRefresh();

        await loadDashboard();

    }
);


/* =========================================
   GLOBAL ACCESS
   ========================================= */

window.MedSupplyDashboard = {

    loadDashboard,

    getData:
        () => intelligenceData,

    refresh:
        loadDashboard

};