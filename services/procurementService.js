const { pool } = require("../config/db");


/* =========================================================
   MEDSUPPLY INTELLIGENCE
   PROCUREMENT DECISION ENGINE

   Purpose:
   Convert demand + inventory risk into an actionable
   procurement recommendation.

   Inputs:
   - Current stock
   - Minimum stock
   - Emergency reserve
   - Criticality
   - Forecasted daily demand
   - Supplier lead time
   - Days of cover
   - Expiry risk

   Output:
   - Recommended order quantity
   - Target stock
   - Lead-time demand
   - Safety stock
   - Priority
   - Explanation
   ========================================================= */


/* =========================================================
   ROUND ORDER QUANTITY
   ========================================================= */

function roundOrderQuantity(quantity) {

    const value =
        Math.ceil(
            Number(quantity || 0)
        );


    if (value <= 0) {
        return 0;
    }


    /*
       Small orders:
       Keep the exact requirement.

       Larger orders:
       Round to practical procurement
       quantities of 10.
    */

    if (value < 10) {
        return value;
    }


    return Math.ceil(
        value / 10
    ) * 10;

}


/* =========================================================
   DETERMINE PROCUREMENT PRIORITY
   ========================================================= */

function determinePriority(
    item,
    risk
) {

    const criticality =
        String(
            item.criticality || "MEDIUM"
        ).toUpperCase();


    if (
        risk.overall_severity === "CRITICAL"
        ||
        risk.stockout_risk
        ||
        risk.current_stock <= 0
    ) {

        return "CRITICAL";

    }


    if (
        risk.overall_severity === "HIGH"
        ||
        risk.current_stock <=
            risk.emergency_reserve
    ) {

        return "HIGH";

    }


    if (
        criticality === "CRITICAL"
        &&
        risk.procurement_required
    ) {

        return "HIGH";

    }


    if (
        risk.procurement_required
        ||
        risk.low_stock_risk
    ) {

        return "MEDIUM";

    }


    return "LOW";

}


/* =========================================================
   GENERATE PROCUREMENT RECOMMENDATION
   ========================================================= */

async function calculateProcurement(
    item,
    forecast,
    risk
) {

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


    const dailyDemand =
        Number(
            forecast?.predicted_daily
            ||
            risk?.daily_demand
            ||
            0
        );


    /* =====================================================
       NO DEMAND
       ===================================================== */

    if (dailyDemand <= 0) {

        return {

            item_id:
                Number(item.id),

            medicine_name:
                item.name,

            procurement_required:
                false,

            recommended_quantity:
                0,

            priority:
                "LOW",

            daily_demand:
                0,

            lead_time_days:
                leadTimeDays,

            lead_time_demand:
                0,

            safety_stock:
                emergencyReserve,

            target_stock:
                Math.max(
                    minimumStock,
                    emergencyReserve
                ),

            current_stock:
                currentStock,

            shortage:
                0,

            reason:
                "Insufficient consumption history to generate a demand-based procurement quantity."

        };

    }


    /* =====================================================
       LEAD-TIME DEMAND
       ===================================================== */

    const leadTimeDemand =
        dailyDemand *
        leadTimeDays;


    /* =====================================================
       SAFETY STOCK
       ===================================================== */

    /*
       Base safety stock:
       Emergency reserve + 3 days expected demand.

       Critical medicines receive an additional
       demand buffer because stockout consequences
       are higher.
    */

    let safetyDays = 3;


    if (
        String(
            item.criticality || ""
        ).toUpperCase() === "CRITICAL"
    ) {

        safetyDays = 5;

    } else if (
        String(
            item.criticality || ""
        ).toUpperCase() === "HIGH"
    ) {

        safetyDays = 4;

    }


    const safetyStock =
        emergencyReserve
        +
        (
            dailyDemand *
            safetyDays
        );


    /* =====================================================
       DEMAND TREND BUFFER
       ===================================================== */

    let trendBuffer = 0;


    if (
        forecast &&
        forecast.trend === "INCREASING"
    ) {

        trendBuffer =
            dailyDemand * 2;

    }


    /*
       Abnormal usage means we should avoid
       ordering only against the normal baseline.
    */

    if (
        risk.anomaly &&
        risk.anomaly.is_anomaly &&
        risk.anomaly.direction === "INCREASING"
    ) {

        trendBuffer +=
            dailyDemand * 2;

    }


    /* =====================================================
       TARGET STOCK
       ===================================================== */

    const targetStock =
        Math.max(

            minimumStock,

            emergencyReserve,

            leadTimeDemand
            +
            safetyStock
            +
            trendBuffer

        );


    /* =====================================================
       SHORTAGE
       ===================================================== */

    const shortage =
        Math.max(
            0,
            targetStock -
            currentStock
        );


    /* =====================================================
       ORDER QUANTITY
       ===================================================== */

    const recommendedQuantity =
        roundOrderQuantity(
            shortage
        );


    /* =====================================================
       PROCUREMENT REQUIRED?
       ===================================================== */

    let procurementRequired =
        recommendedQuantity > 0;


    /*
       If stock is currently healthy and
       there is no immediate risk, avoid
       unnecessary procurement.
    */

    if (
        !risk.procurement_required
        &&
        !risk.stockout_risk
        &&
        !risk.low_stock_risk
        &&
        !risk.expiry_risk
        &&
        recommendedQuantity > 0
    ) {

        procurementRequired =
            false;

    }


    /* =====================================================
       PRIORITY
       ===================================================== */

    const priority =
        determinePriority(
            item,
            risk
        );


    /* =====================================================
       REASON
       ===================================================== */

    const reasons = [];


    if (
        risk.current_stock <= 0
    ) {

        reasons.push(
            "Current stock is zero."
        );

    }


    if (
        risk.stockout_risk
    ) {

        reasons.push(
            "Projected stock cover is insufficient for supplier lead time."
        );

    }


    if (
        risk.current_stock <=
        risk.emergency_reserve
    ) {

        reasons.push(
            "Inventory is at or below emergency reserve."
        );

    } else if (
        risk.current_stock <=
        risk.minimum_stock
    ) {

        reasons.push(
            "Inventory is at or below minimum stock."
        );

    }


    if (
        forecast &&
        forecast.trend === "INCREASING"
    ) {

        reasons.push(
            "Demand trend is increasing."
        );

    }


    if (
        risk.anomaly &&
        risk.anomaly.is_anomaly &&
        risk.anomaly.direction === "INCREASING"
    ) {

        reasons.push(
            "Recent consumption shows abnormal upward usage."
        );

    }


    if (
        risk.expiry_risk
    ) {

        reasons.push(
            "Current inventory has an expiry risk; procurement should consider usable stock before ordering."
        );

    }


    if (!reasons.length) {

        reasons.push(
            "Current inventory is adequate for expected demand."
        );

    }


    /* =====================================================
       EXPECTED DELIVERY
       ===================================================== */

    let expectedDeliveryDate =
        null;


    if (
        procurementRequired &&
        leadTimeDays > 0
    ) {

        const deliveryDate =
            new Date();


        deliveryDate.setDate(
            deliveryDate.getDate()
            +
            leadTimeDays
        );


        expectedDeliveryDate =
            deliveryDate
                .toISOString()
                .split("T")[0];

    }


    /* =====================================================
       ESTIMATED COST
       ===================================================== */

    const unitCost =
        Number(
            item.unit_cost || 0
        );


    const estimatedCost =
        recommendedQuantity *
        unitCost;


    /* =====================================================
       RETURN
       ===================================================== */

    return {

        item_id:
            Number(item.id),

        medicine_name:
            item.name,

        category:
            item.category,

        criticality:
            item.criticality,

        supplier_id:
            item.supplier_id || null,

        supplier_name:
            item.supplier_name || null,

        current_stock:
            currentStock,

        minimum_stock:
            minimumStock,

        emergency_reserve:
            emergencyReserve,

        daily_demand:
            Number(
                dailyDemand.toFixed(2)
            ),

        lead_time_days:
            leadTimeDays,

        lead_time_demand:
            Number(
                leadTimeDemand.toFixed(2)
            ),

        safety_stock:
            Number(
                safetyStock.toFixed(2)
            ),

        trend_buffer:
            Number(
                trendBuffer.toFixed(2)
            ),

        target_stock:
            Number(
                targetStock.toFixed(2)
            ),

        shortage:
            Number(
                shortage.toFixed(2)
            ),

        recommended_quantity:
            recommendedQuantity,

        procurement_required:
            procurementRequired,

        priority,

        expected_delivery_date:
            expectedDeliveryDate,

        unit_cost:
            unitCost,

        estimated_cost:
            Number(
                estimatedCost.toFixed(2)
            ),

        reason:
            reasons.join(" "),

        reasons

    };

}


/* =========================================================
   FETCH INVENTORY FOR PROCUREMENT
   ========================================================= */

async function getProcurementItems() {

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
   CREATE PROCUREMENT ORDER
   ========================================================= */

async function createProcurementOrder(
    recommendation
) {

    if (
        !recommendation ||
        !recommendation.procurement_required
    ) {

        return {

            success:
                false,

            message:
                "Procurement is not required."

        };

    }


    const quantity =
        Number(
            recommendation.recommended_quantity
            || 0
        );


    if (quantity <= 0) {

        return {

            success:
                false,

            message:
                "Recommended quantity must be greater than zero."

        };

    }


    const orderDate =
        new Date();


    const expectedDelivery =
        recommendation.expected_delivery_date;


    const [
        result
    ] = await pool.query(

        `
        INSERT INTO procurement_orders
        (
            item_id,
            supplier_id,
            quantity,
            order_date,
            expected_delivery_date,
            status,
            unit_cost
        )
        VALUES
        (
            ?,
            ?,
            ?,
            ?,
            ?,
            'PENDING',
            ?
        )
        `,

        [

            recommendation.item_id,

            recommendation.supplier_id
                || null,

            quantity,

            orderDate,

            expectedDelivery,

            recommendation.unit_cost
                || 0

        ]

    );


    return {

        success:
            true,

        order_id:
            result.insertId,

        message:
            "Procurement order created.",

        quantity,

        expected_delivery_date:
            expectedDelivery

    };

}


/* =========================================================
   GET ACTIVE PROCUREMENT ORDERS
   ========================================================= */

async function getProcurementOrders() {

    const [
        rows
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

        LIMIT 100
        `

    );


    return rows;

}


module.exports = {

    calculateProcurement,

    getProcurementItems,

    createProcurementOrder,

    getProcurementOrders,

    roundOrderQuantity,

    determinePriority

};