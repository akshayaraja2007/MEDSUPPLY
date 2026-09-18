import sys
import json
import math
from datetime import datetime, timedelta

import numpy as np


# =========================================================
# MEDSUPPLY INTELLIGENCE
# DEMAND FORECASTING ENGINE
#
# Input:
# {
#   "history": [
#       {
#           "date": "2026-09-01",
#           "quantity": 25
#       }
#   ],
#   "forecast_days": 7
# }
#
# Output:
# {
#   "success": true,
#   "model": "Weighted Moving Average + Trend",
#   "predicted_daily": 27.4,
#   "forecast": [...]
# }
# =========================================================


def safe_number(value, default=0.0):
    """
    Convert a value safely to float.
    """

    try:
        number = float(value)

        if math.isfinite(number):
            return number

        return default

    except (TypeError, ValueError):
        return default


def parse_date(value):
    """
    Convert a date string into datetime.
    """

    if not value:
        return None

    try:
        return datetime.strptime(
            str(value)[:10],
            "%Y-%m-%d"
        )

    except ValueError:
        return None


def prepare_history(history):
    """
    Clean and sort consumption history.
    """

    cleaned = []

    for record in history:

        if not isinstance(record, dict):
            continue

        date = parse_date(
            record.get("date")
            or record.get("consumption_date")
        )

        quantity = safe_number(
            record.get("quantity")
            or record.get("quantity_consumed")
        )

        if date is None:
            continue

        if quantity < 0:
            continue

        cleaned.append({
            "date": date,
            "quantity": quantity
        })


    cleaned.sort(
        key=lambda item: item["date"]
    )

    return cleaned


def fill_daily_series(history):
    """
    Convert irregular consumption records into a
    continuous daily time series.

    Missing days are treated as zero consumption.
    """

    if not history:
        return []

    start_date = history[0]["date"]
    end_date = history[-1]["date"]

    values = {}

    for record in history:

        date_key = record["date"].date()

        values[date_key] = (
            values.get(date_key, 0.0)
            + record["quantity"]
        )


    series = []

    current = start_date

    while current <= end_date:

        quantity = values.get(
            current.date(),
            0.0
        )

        series.append({
            "date": current,
            "quantity": quantity
        })

        current += timedelta(days=1)

    return series


def weighted_average(values):
    """
    Weighted moving average.

    Recent observations receive greater weight.
    """

    if not values:
        return 0.0

    values = np.asarray(
        values,
        dtype=float
    )

    weights = np.arange(
        1,
        len(values) + 1,
        dtype=float
    )

    denominator = np.sum(weights)

    if denominator == 0:
        return 0.0

    return float(
        np.sum(values * weights)
        / denominator
    )


def calculate_trend(values):
    """
    Estimate linear demand trend.

    Returns the estimated daily change.
    """

    if len(values) < 3:
        return 0.0

    y = np.asarray(
        values,
        dtype=float
    )

    x = np.arange(
        len(y),
        dtype=float
    )

    try:

        slope, _ = np.polyfit(
            x,
            y,
            1
        )

        if math.isfinite(slope):
            return float(slope)

    except Exception:
        pass

    return 0.0


def calculate_confidence(
    history_count,
    variability
):
    """
    Estimate forecast confidence.

    This is an operational confidence indicator,
    not a statistical probability.
    """

    if history_count >= 60:
        base = 92

    elif history_count >= 30:
        base = 87

    elif history_count >= 14:
        base = 78

    elif history_count >= 7:
        base = 68

    elif history_count >= 3:
        base = 58

    else:
        base = 45


    # Penalize highly variable demand.

    if variability >= 1.0:
        base -= 15

    elif variability >= 0.75:
        base -= 10

    elif variability >= 0.50:
        base -= 5


    return max(
        30,
        min(95, int(base))
    )


def calculate_forecast(
    history,
    forecast_days=7
):
    """
    Main forecasting function.
    """

    prepared = prepare_history(
        history
    )


    if not prepared:

        return {
            "success": True,
            "model":
                "Weighted Moving Average + Trend",
            "history_count": 0,
            "avg_7": 0.0,
            "avg_30": 0.0,
            "predicted_daily": 0.0,
            "trend": "STABLE",
            "trend_change": 0.0,
            "confidence": 30,
            "forecast": []
        }


    daily_series = fill_daily_series(
        prepared
    )


    values = [
        item["quantity"]
        for item in daily_series
    ]


    history_count = len(values)


    # ---------------------------------------------------------
    # Recent demand windows
    # ---------------------------------------------------------

    last_7 = values[-7:]

    last_30 = values[-30:]


    avg_7 = (
        float(np.mean(last_7))
        if last_7
        else 0.0
    )


    avg_30 = (
        float(np.mean(last_30))
        if last_30
        else 0.0
    )


    # ---------------------------------------------------------
    # Weighted recent demand
    # ---------------------------------------------------------
    last_14 = values[-14:]
    weighted_recent = weighted_average(
        last_14 if len(values) >= 14
        else values
    )


    # ---------------------------------------------------------
    # Trend
    # ---------------------------------------------------------

    trend_change = calculate_trend(
        last_30
    )


    # ---------------------------------------------------------
    # Normalize trend contribution
    # ---------------------------------------------------------

    if avg_30 > 0:

        trend_percent = (
            trend_change
            / avg_30
        )

    else:

        trend_percent = 0.0


    # Avoid excessive extrapolation.

    trend_percent = max(
        -0.30,
        min(0.30, trend_percent)
    )


    # ---------------------------------------------------------
    # Base prediction
    # ---------------------------------------------------------

    if avg_7 > 0 and avg_30 > 0:

        predicted_daily = (
            weighted_recent * 0.50
            + avg_7 * 0.30
            + avg_30 * 0.20
        )

    elif avg_7 > 0:

        predicted_daily = (
            weighted_recent * 0.65
            + avg_7 * 0.35
        )

    else:

        predicted_daily = avg_30


    # Apply trend.

    predicted_daily *= (
        1.0 + trend_percent * 0.35
    )


    predicted_daily = max(
        0.0,
        predicted_daily
    )


    # ---------------------------------------------------------
    # Demand variability
    # ---------------------------------------------------------

    if len(last_30) >= 2:

        mean_value = float(
            np.mean(last_30)
        )

        std_value = float(
            np.std(last_30)
        )

        if mean_value > 0:

            variability = (
                std_value
                / mean_value
            )

        else:

            variability = 0.0

    else:

        variability = 0.0


    confidence = calculate_confidence(
        history_count,
        variability
    )


    # ---------------------------------------------------------
    # Trend classification
    # ---------------------------------------------------------

    if trend_percent >= 0.10:

        trend = "INCREASING"

    elif trend_percent <= -0.10:

        trend = "DECREASING"

    else:

        trend = "STABLE"


    # ---------------------------------------------------------
    # Generate future forecast
    # ---------------------------------------------------------

    forecast_days = int(
        safe_number(
            forecast_days,
            7
        )
    )

    forecast_days = max(
        1,
        min(30, forecast_days)
    )


    last_date = daily_series[-1]["date"]

    forecast = []


    for day in range(
        1,
        forecast_days + 1
    ):

        future_date = (
            last_date
            + timedelta(days=day)
        )


        # Small controlled trend progression.

        day_factor = (
            1.0
            + trend_percent
            * 0.35
            * (day / forecast_days)
        )


        prediction = (
            predicted_daily
            * day_factor
        )


        prediction = max(
            0.0,
            prediction
        )


        forecast.append({

            "date":
                future_date.strftime(
                    "%Y-%m-%d"
                ),

            "predicted_demand":
                round(
                    prediction,
                    2
                ),

            "confidence":
                confidence

        })


    # ---------------------------------------------------------
    # Return result
    # ---------------------------------------------------------

    return {

        "success": True,

        "model":
            "Weighted Moving Average + Trend",

        "history_count":
            history_count,

        "avg_7":
            round(avg_7, 2),

        "avg_30":
            round(avg_30, 2),

        "weighted_recent":
            round(
                weighted_recent,
                2
            ),

        "predicted_daily":
            round(
                predicted_daily,
                2
            ),

        "trend":
            trend,

        "trend_change":
            round(
                trend_change,
                4
            ),

        "variability":
            round(
                variability,
                4
            ),

        "confidence":
            confidence,

        "forecast":
            forecast

    }


def main():

    try:

        # -----------------------------------------------------
        # Read JSON from Node.js
        # -----------------------------------------------------

        raw_input = sys.stdin.read()


        if not raw_input.strip():

            print(
                json.dumps({
                    "success": False,
                    "error":
                        "No input data received."
                })
            )

            return


        payload = json.loads(
            raw_input
        )


        history = payload.get(
            "history",
            []
        )


        forecast_days = payload.get(
            "forecast_days",
            7
        )


        result = calculate_forecast(
            history,
            forecast_days
        )


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
                "success": False,
                "error":
                    "Invalid JSON input.",
                "details":
                    str(error)
            })
        )


    except Exception as error:

        print(
            json.dumps({
                "success": False,
                "error":
                    "Forecast calculation failed.",
                "details":
                    str(error)
            })
        )


if __name__ == "__main__":
    main()