/* =========================================
   MEDSUPPLY INTELLIGENCE
   DASHBOARD JAVASCRIPT
   ========================================= */

const API_BASE = "/api";

let intelligenceData = [];
let dashboardLoaded = false;


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
    const number = Number(value || 0);

    return number.toLocaleString("en-IN", {
        maximumFractionDigits: 2
    });
}


function formatInteger(value) {
    const number = Math.round(Number(value || 0));

    return number.toLocaleString("en-IN");
}


function formatCurrency(value) {
    const number = Number(value || 0);

    return number.toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    });
}


function formatDate(value) {

    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}


function getDaysUntil(dateValue) {

    if (!dateValue) {
        return null;
    }

    const expiry = new Date(dateValue);
    const today = new Date();

    expiry.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return Math.ceil(
        (expiry - today) /
        (1000 * 60 * 60 * 24)
    );
}


/* =========================================
   STATUS HELPERS
   ========================================= */

function normalizeStatus(status) {

    return String(status || "")
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, "_");
}


function statusLabel(status) {

    const normalized = normalizeStatus(status);

    const labels = {
        NORMAL: "Normal",
        LOW: "Low",
        CRITICAL: "Critical",
        STOCKOUT_RISK: "Stockout Risk",
        EXPIRING_SOON: "Expiring Soon",
        INFO: "Info",
        WARNING: "Warning",
        HIGH: "High"
    };

    return labels[normalized] || status || "Unknown";
}


function riskClass(status) {

    const normalized = normalizeStatus(status);

    if (
        normalized === "CRITICAL" ||
        normalized === "STOCKOUT_RISK"
    ) {
        return "risk-critical";
    }

    if (normalized === "HIGH") {
        return "risk-high";
    }

    if (normalized === "WARNING" ||
        normalized === "LOW" ||
        normalized === "EXPIRING_SOON") {
        return "risk-warning";
    }

    return "risk-normal";
}


function riskBadge(status) {

    const normalized = normalizeStatus(status);

    let className = "badge badge-neutral";

    if (
        normalized === "CRITICAL" ||
        normalized === "STOCKOUT_RISK"
    ) {
        className = "badge badge-danger";
    } else if (
        normalized === "HIGH"
    ) {
        className = "badge badge-high";
    } else if (
        normalized === "WARNING" ||
        normalized === "LOW" ||
        normalized === "EXPIRING_SOON"
    ) {
        className = "badge badge-warning";
    } else if (
        normalized === "NORMAL" ||
        normalized === "INFO"
    ) {
        className = "badge badge-success";
    }

    return `<span class="${className}">
        ${escapeHtml(statusLabel(status))}
    </span>`;
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

    if (normalized.includes("INCREAS")) {
        return "Increasing";
    }

    if (normalized.includes("DECREAS")) {
        return "Decreasing";
    }

    return "Stable";
}


/* =========================================
   SECURITY HELPER
   ========================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================
   MESSAGE HANDLING
   ========================================= */

function showMessage(message, type = "info") {

    const element = $("dashboardMessage");

    if (!element) {
        return;
    }

    element.textContent = message;

    element.className =
        `dashboard-message ${type}`;

    element.style.display = "block";
}


function hideMessage() {

    const element = $("dashboardMessage");

    if (element) {
        element.style.display = "none";
    }
}


/* =========================================
   API REQUEST
   ========================================= */

async function fetchIntelligence() {

    const response = await fetch(
        `${API_BASE}/intelligence`,
        {
            method: "GET",
            headers: {
                "Accept": "application/json"
            }
        }
    );

    let result;

    try {
        result = await response.json();
    } catch (error) {
        throw new Error(
            `Server returned invalid JSON (${response.status}).`
        );
    }

    if (!response.ok) {

        throw new Error(
            result.error ||
            result.message ||
            `Request failed with status ${response.status}.`
        );
    }

    if (!result.success) {

        throw new Error(
            result.error ||
            result.message ||
            "Intelligence engine failed."
        );
    }

    return result;
}


/* =========================================
   DATA NORMALIZATION
   ========================================= */

function normalizeIntelligenceItem(item) {

    const forecast =
        item.forecast ||
        item.demand ||
        {};

    const risk =
        item.risk ||
        {};

    const procurement =
        item.procurement ||
        {};

    const stock =
        Number(
            item.current_stock ??
            item.stock ??
            0
        );

    const dailyDemand =
        Number(
            forecast.predicted_daily ??
            forecast.predictedDemand ??
            item.predicted_daily ??
            item.daily_demand ??
            item.avg_daily_demand ??
            0
        );

    const leadTime =
        Number(
            item.lead_time_days ??
            procurement.lead_time_days ??
            0
        );

    let daysOfCover =
        Number(
            risk.days_of_cover ??
            risk.daysOfCover ??
            item.days_of_cover
        );

    if (
        !Number.isFinite(daysOfCover) ||
        daysOfCover < 0
    ) {

        if (dailyDemand > 0) {
            daysOfCover = stock / dailyDemand;
        } else {
            daysOfCover = Infinity;
        }
    }

    const riskLevel =
        risk.severity ||
        risk.risk_level ||
        risk.status ||
        item.status ||
        "NORMAL";

    const recommendedOrder =
        Number(
            procurement.recommended_quantity ??
            procurement.recommendedQuantity ??
            procurement.quantity ??
            item.recommended_order ??
            item.recommended_quantity ??
            0
        );

    const expiryDate =
        item.expiry_date ||
        item.expiryDate ||
        null;

    const forecastModel =
        forecast.model ||
        item.model ||
        "Python Demand Intelligence";

    const confidence =
        Number(
            forecast.confidence ??
            item.confidence ??
            0
        );

    return {
        ...item,

        id:
            item.id ??
            item.item_id,

        name:
            item.name ||
            item.medicine_name ||
            "Unknown Medicine",

        category:
            item.category ||
            "—",

        current_stock: stock,

        minimum_stock:
            Number(
                item.minimum_stock ??
                item.min_stock ??
                0
            ),

        emergency_reserve:
            Number(
                item.emergency_reserve ??
                item.reserve ??
                0
            ),

        criticality:
            item.criticality ||
            "MEDIUM",

        expiry_date: expiryDate,

        status:
            item.status ||
            "NORMAL",

        daily_demand: dailyDemand,

        days_of_cover: daysOfCover,

        lead_time_days: leadTime,

        risk_level: riskLevel,

        risk_message:
            risk.message ||
            item.risk_message ||
            "",

        trend:
            forecast.trend ||
            item.trend ||
            "STABLE",

        trend_change:
            Number(
                forecast.trend_change ??
                item.trend_change ??
                0
            ),

        confidence,

        forecast_model: forecastModel,

        recommended_order: recommendedOrder,

        procurement_reason:
            procurement.reason ||
            item.procurement_reason ||
            ""
    };
}


/* =========================================
   KPI CALCULATIONS
   ========================================= */

function calculateKpis(items) {

    const totalMedicines =
        items.length;

    const totalStock =
        items.reduce(
            (sum, item) =>
                sum + Number(item.current_stock || 0),
            0
        );

    const criticalRisks =
        items.filter(item => {

            const risk =
                normalizeStatus(item.risk_level);

            const status =
                normalizeStatus(item.status);

            return (
                risk === "CRITICAL" ||
                risk === "STOCKOUT_RISK" ||
                status === "CRITICAL" ||
                status === "STOCKOUT_RISK"
            );

        }).length;


    const procurementNeed =
        items.reduce(
            (sum, item) =>
                sum +
                Number(
                    item.recommended_order || 0
                ),
            0
        );


    const confidenceValues =
        items
            .map(item =>
                Number(item.confidence)
            )
            .filter(value =>
                Number.isFinite(value) &&
                value > 0
            );


    const averageConfidence =
        confidenceValues.length
            ? confidenceValues.reduce(
                (sum, value) =>
                    sum + value,
                0
            ) / confidenceValues.length
            : 0;


    setText(
        "totalMedicines",
        formatInteger(totalMedicines)
    );

    setText(
        "totalStock",
        formatInteger(totalStock)
    );

    setText(
        "criticalRisks",
        formatInteger(criticalRisks)
    );

    setText(
        "procurementNeed",
        formatInteger(procurementNeed)
    );

    setText(
        "averageConfidence",
        averageConfidence
            ? `${averageConfidence.toFixed(0)}%`
            : "—"
    );


    const model =
        items.find(
            item => item.forecast_model
        )?.forecast_model ||
        "Python Demand Intelligence";

    setText(
        "forecastModel",
        model
    );
}


/* =========================================
   RISK SUMMARY
   ========================================= */

function calculateRiskSummary(items) {

    let critical = 0;
    let high = 0;
    let warning = 0;
    let normal = 0;

    items.forEach(item => {

        const risk =
            normalizeStatus(item.risk_level);

        const status =
            normalizeStatus(item.status);

        if (
            risk === "CRITICAL" ||
            risk === "STOCKOUT_RISK" ||
            status === "CRITICAL" ||
            status === "STOCKOUT_RISK"
        ) {

            critical++;

        } else if (
            risk === "HIGH"
        ) {

            high++;

        } else if (
            risk === "WARNING" ||
            risk === "LOW" ||
            status === "LOW" ||
            status === "EXPIRING_SOON"
        ) {

            warning++;

        } else {

            normal++;
        }
    });


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


    items.forEach(item => {

        const status =
            normalizeStatus(item.status);

        if (status === "STOCKOUT_RISK") {

            stockout++;

        } else if (status === "CRITICAL") {

            critical++;

        } else if (
            status === "LOW"
        ) {

            low++;

        } else if (
            status === "EXPIRING_SOON"
        ) {

            expiring++;

        } else {

            normal++;
        }

    });


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
            .filter(item => {

                const status =
                    normalizeStatus(item.status);

                const risk =
                    normalizeStatus(item.risk_level);

                return (
                    status !== "NORMAL" ||
                    risk !== "NORMAL" ||
                    Number(item.recommended_order || 0) > 0 ||
                    Number(item.days_of_cover) <=
                        Number(item.lead_time_days)
                );
            })
            .sort((a, b) => {

                const scoreA =
                    getPriorityScore(a);

                const scoreB =
                    getPriorityScore(b);

                return scoreB - scoreA;
            })
            .slice(0, 12);


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
            .map(item => {

                const days =
                    Number(item.days_of_cover);

                const daysText =
                    Number.isFinite(days)
                        ? `${days.toFixed(1)} days`
                        : "∞";


                return `
                    <tr>

                        <td>
                            <div class="medicine-name-cell">
                                <strong>
                                    ${escapeHtml(item.name)}
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
                                item.risk_level
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
            })
            .join("");
}


function getPriorityScore(item) {

    const status =
        normalizeStatus(item.status);

    const risk =
        normalizeStatus(item.risk_level);

    let score = 0;


    if (
        status === "STOCKOUT_RISK" ||
        risk === "STOCKOUT_RISK"
    ) {
        score += 100;
    }

    if (
        status === "CRITICAL" ||
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
        status === "LOW" ||
        risk === "LOW" ||
        risk === "WARNING"
    ) {
        score += 40;
    }

    if (
        status === "EXPIRING_SOON"
    ) {
        score += 30;
    }


    const days =
        Number(item.days_of_cover);

    const leadTime =
        Number(item.lead_time_days);


    if (
        Number.isFinite(days) &&
        leadTime > 0
    ) {

        if (days <= leadTime) {
            score += 50;
        }

        if (days <= leadTime / 2) {
            score += 25;
        }
    }


    score += Math.min(
        Number(item.recommended_order || 0) / 100,
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
            .filter(item =>
                Number(item.recommended_order || 0) > 0
            )
            .sort(
                (a, b) =>
                    Number(b.recommended_order || 0) -
                    Number(a.recommended_order || 0)
            )
            .slice(0, 8);


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
            .map(item => {

                const supplier =
                    item.supplier_name ||
                    item.supplier ||
                    "Supplier not assigned";


                return `
                    <div class="procurement-item">

                        <div class="procurement-main">

                            <strong>
                                ${escapeHtml(item.name)}
                            </strong>

                            <span>
                                ${escapeHtml(supplier)}
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
            })
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
            .filter(item =>
                item.expiry_date
            )
            .map(item => ({
                ...item,
                days_until_expiry:
                    getDaysUntil(
                        item.expiry_date
                    )
            }))
            .filter(item =>
                item.days_until_expiry !== null &&
                item.days_until_expiry <= 90
            )
            .sort(
                (a, b) =>
                    a.days_until_expiry -
                    b.days_until_expiry
            )
            .slice(0, 12);


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
            .map(item => {

                const days =
                    item.days_until_expiry;


                let expiryRisk =
                    "NORMAL";

                if (days <= 0) {

                    expiryRisk = "CRITICAL";

                } else if (days <= 15) {

                    expiryRisk = "CRITICAL";

                } else if (days <= 30) {

                    expiryRisk = "WARNING";

                } else {

                    expiryRisk = "INFO";
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
            })
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

    const rawData =
        Array.isArray(result.data)
            ? result.data
            : [];


    intelligenceData =
        rawData.map(
            normalizeIntelligenceItem
        );


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


    dashboardLoaded = true;


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
        loading.style.display = "block";
    }


    if (refreshButton) {
        refreshButton.disabled = true;
    }


    try {

        const result =
            await fetchIntelligence();

        renderDashboard(result);

    } catch (error) {

        console.error(
            "DASHBOARD ERROR:",
            error
        );


        showMessage(
            error.message ||
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
            loading.style.display = "none";
        }

        if (refreshButton) {
            refreshButton.disabled = false;
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

    getData: () =>
        intelligenceData,

    refresh: loadDashboard

};