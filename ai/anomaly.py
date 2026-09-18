import sys
import json
import math

import numpy as np


# =========================================================
# MEDSUPPLY INTELLIGENCE
# CONSUMPTION ANOMALY DETECTION ENGINE
#
# Input:
# {
#   "history": [
#       {
#           "date": "2026-09-01",
#           "quantity": 20
#       }
#   ]
# }
#
# Output:
# {
#   "success": true,
#   "is_anomaly": true,
#   "anomaly_score": 2.31,
#   "severity": "HIGH",
#   "reason": "...",
#   "recent_average": 45.2,
#   "historical_average": 20.1
# }
# =========================================================


def safe_number(value, default=0.0):

    try:

        number = float(value)

        if math.isfinite(number):
            return number

        return default

    except (TypeError, ValueError):

        return default


def prepare_history(history):

    cleaned = []

    if not isinstance(history, list):
        return cleaned


    for record in history:

        if not isinstance(record, dict):
            continue


        date = (
            record.get("date")
            or record.get("consumption_date")
        )


        quantity = safe_number(
            record.get("quantity")
            if record.get("quantity") is not None
            else record.get("quantity_consumed")
        )


        if not date:
            continue


        if quantity < 0:
            continue


        cleaned.append({

            "date": str(date)[:10],

            "quantity": quantity

        })


    cleaned.sort(
        key=lambda item: item["date"]
    )


    return cleaned


def calculate_statistics(values):

    if not values:

        return {
            "mean": 0.0,
            "std": 0.0,
            "median": 0.0
        }


    array = np.asarray(
        values,
        dtype=float
    )


    return {

        "mean":
            float(np.mean(array)),

        "std":
            float(np.std(array)),

        "median":
            float(np.median(array))

    }


def detect_anomaly(history):

    cleaned = prepare_history(history)


    if len(cleaned) < 3:

        return {

            "success": True,

            "is_anomaly": False,

            "anomaly_score": 0.0,

            "severity": "INFO",

            "reason":
                "Not enough consumption history " +
                "for reliable anomaly detection.",

            "history_count":
                len(cleaned),

            "recent_average": 0.0,

            "historical_average": 0.0,

            "recent_quantity": 0.0

        }


    values = [

        item["quantity"]

        for item in cleaned

    ]


    # =====================================================
    # Historical baseline
    # =====================================================

    statistics = calculate_statistics(values)


    historical_average =statistics["mean"]


    historical_std =statistics["std"]


    # =====================================================
    # Recent demand
    # =====================================================

    recent_count =min(7, len(values))


    recent_values =values[-recent_count:]


    recent_average =float(np.mean(recent_values))


    recent_quantity =values[-1]


    # =====================================================
    # Robust baseline using median
    # =====================================================

    median =statistics["median"]


    if median > 0:

        median_deviation = (

            abs(
                recent_quantity
                - median
            )
            / median

        )

    else:

        median_deviation = 0.0


    # =====================================================
    # Z-score
    # =====================================================

    if historical_std > 0:

        z_score = (

            (
                recent_quantity
                - historical_average
            )
            / historical_std

        )

    else:

        z_score = 0.0


    # =====================================================
    # Recent vs historical change
    # =====================================================

    if historical_average > 0:

        demand_change = (

            (
                recent_average
                - historical_average
            )
            / historical_average
        )

    else:

        demand_change = 0.0


    # =====================================================
    # Anomaly decision
    # =====================================================

    is_anomaly = False

    severity = "INFO"

    reason = (
        "Consumption is within the expected range."
    )


    # -----------------------------------------------------
    # Critical anomaly
    # -----------------------------------------------------

    if (

        abs(z_score) >= 3.0

        or

        median_deviation >= 2.0

        or

        abs(demand_change) >= 1.0

    ):

        is_anomaly = True

        severity = "CRITICAL"


        if demand_change > 0:

            reason = (
                "Consumption is significantly above "
                "historical demand."
            )

        else:

            reason = (
                "Consumption is significantly below "
                "historical demand."
            )


    # -----------------------------------------------------
    # High anomaly
    # -----------------------------------------------------

    elif (

        abs(z_score) >= 2.0

        or

        median_deviation >= 1.0

        or

        abs(demand_change) >= 0.50

    ):

        is_anomaly = True

        severity = "HIGH"


        if demand_change > 0:

            reason = (
                "Recent consumption is substantially "
                "higher than historical demand."
            )

        else:

            reason = (
                "Recent consumption is substantially "
                "lower than historical demand."
            )


    # -----------------------------------------------------
    # Warning anomaly
    # -----------------------------------------------------

    elif (

        abs(z_score) >= 1.5

        or

        median_deviation >= 0.50

        or

        abs(demand_change) >= 0.25

    ):

        is_anomaly = True

        severity = "WARNING"


        if demand_change > 0:

            reason = (
                "Recent consumption is increasing "
                "above the normal range."
            )

        else:

            reason = (
                "Recent consumption is decreasing "
                "below the normal range."
            )


    # =====================================================
    # Combined anomaly score
    # =====================================================

    score_components = [

        abs(z_score),

        median_deviation,

        abs(demand_change)

    ]


    anomaly_score = max(
        score_components
    )


    # =====================================================
    # Direction
    # =====================================================

    if demand_change >= 0.10:

        direction = "INCREASING"

    elif demand_change <= -0.10:

        direction = "DECREASING"

    else:

        direction = "STABLE"


    # =====================================================
    # Confidence
    # =====================================================

    if len(cleaned) >= 60:

        confidence = 92

    elif len(cleaned) >= 30:

        confidence = 87

    elif len(cleaned) >= 14:

        confidence = 78

    elif len(cleaned) >= 7:

        confidence = 68

    else:

        confidence = 55


    return {

        "success": True,

        "is_anomaly":
            is_anomaly,

        "anomaly_score":
            round(
                float(anomaly_score),
                4
            ),

        "z_score":
            round(
                float(z_score),
                4
            ),

        "severity":
            severity,

        "direction":
            direction,

        "reason":
            reason,

        "history_count":
            len(cleaned),

        "recent_count":
            recent_count,

        "recent_average":
            round(
                recent_average,
                2
            ),

        "historical_average":
            round(
                historical_average,
                2
            ),

        "recent_quantity":
            round(
                recent_quantity,
                2
            ),

        "demand_change_percent":
            round(
                demand_change * 100,
                2
            ),

        "variability":
            round(
                (
                    historical_std
                    / historical_average
                )
                if historical_average > 0
                else 0.0,
                4
            ),

        "confidence":
            confidence

    }


def main():

    try:

        raw_input = sys.stdin.read()


        if not raw_input.strip():

            print(
                json.dumps({

                    "success":
                        False,

                    "error":
                        "No input data received."

                })
            )

            return


        payload = json.loads(raw_input)


        history =payload.get("history",[])


        result =detect_anomaly(history)


        print(
            json.dumps(
                result,
                separators=(
                    ",",
                    ":"
                )
            )
        )


    except json.JSONDecodeError as error:

        print(
            json.dumps({

                "success":
                    False,

                "error":
                    "Invalid JSON input.",

                "details":
                    str(error)

            })
        )


    except Exception as error:

        print(
            json.dumps({

                "success":
                    False,

                "error":
                    "Anomaly detection failed.",

                "details":
                    str(error)

            })
        )


if __name__ == "__main__":

    main()