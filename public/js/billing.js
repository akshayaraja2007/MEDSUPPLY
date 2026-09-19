/* =========================================================
   MEDSUPPLY INTELLIGENCE
   BILLING JAVASCRIPT

   Responsibilities:
   - Load inventory medicines
   - Create medicine issue rows
   - Validate available stock
   - Calculate bill summary
   - Submit STOCK OUT transaction
   - Record patient information
   - Load recent transactions
   ========================================================= */


/* =========================================================
   GLOBAL STATE
   ========================================================= */

const API_BASE =
    "https://medsupply-oegb.onrender.com/api";

let medicines = [];

let billingRows = [];


/* =========================================================
   DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeBilling();

    }
);


/* =========================================================
   INITIALIZE
   ========================================================= */

async function initializeBilling() {

    setupBillingButtons();

    await loadMedicines();

    addMedicineRow();

    await loadBills();

}


/* =========================================================
   DOM HELPER
   ========================================================= */

function getElement(id) {

    return document.getElementById(id);

}


/* =========================================================
   SETUP BUTTONS
   ========================================================= */

function setupBillingButtons() {

    const addButton =
        getElement(
            "addMedicineBtn"
        );


    if (addButton) {

        addButton.addEventListener(
            "click",
            () => {

                addMedicineRow();

            }
        );

    }


    const confirmButton =
        getElement(
            "confirmBillBtn"
        );


    if (confirmButton) {

        confirmButton.addEventListener(
            "click",
            confirmMedicineIssue
        );

    }


    const clearButton =
        getElement(
            "clearBillingBtn"
        );


    if (clearButton) {

        clearButton.addEventListener(
            "click",
            resetBillingForm
        );

    }


    const refreshButton =
        getElement(
            "refreshBillsBtn"
        );


    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            async () => {

                await loadBills();

            }
        );

    }

}


/* =========================================================
   LOAD MEDICINES
   ========================================================= */

async function loadMedicines() {

    try {

        const response =
            await fetch(
                `${API_BASE}/medicines`
            );


        const result =
            await response.json();


        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(

                result.error
                ||
                result.details
                ||
                "Failed to load medicines."

            );

        }


        medicines =
            Array.isArray(
                result.data
            )
                ? result.data
                : [];


        /*
           Update existing rows if any.
        */

        renderAllMedicineSelectors();

        updateStockPreview();

        updateBillingSummary();


    } catch (error) {

        console.error(
            "LOAD MEDICINES ERROR:",
            error
        );


        showMessage(

            "billingMessage",

            error.message
            ||
            "Failed to load medicines.",

            "error"

        );

    }

}


/* =========================================================
   ADD MEDICINE ROW
   ========================================================= */

function addMedicineRow(
    medicineId = "",
    quantity = 1
) {

    const container =
        getElement(
            "medicineRows"
        );


    if (!container) {

        return;

    }


    const rowId =
        Date.now() +
        Math.floor(
            Math.random() * 10000
        );


    const row = {

        id:
            rowId,

        medicine_id:
            medicineId
                ? Number(
                    medicineId
                )
                : "",

        quantity:
            Number(
                quantity
                ||
                1
            )

    };


    billingRows.push(
        row
    );


    renderMedicineRows();

    updateBillingSummary();

    updateStockPreview();

}


/* =========================================================
   RENDER MEDICINE ROWS
   ========================================================= */

function renderMedicineRows() {

    const container =
        getElement(
            "medicineRows"
        );


    const emptyState =
        getElement(
            "medicineEmptyState"
        );


    if (!container) {

        return;

    }


    if (
        billingRows.length === 0
    ) {

        container.innerHTML =
            "";


        if (emptyState) {

            emptyState.hidden =
                false;

        }


        return;

    }


    if (emptyState) {

        emptyState.hidden =
            true;

    }


    container.innerHTML =
        billingRows
            .map(
                row =>
                    createMedicineRowHtml(
                        row
                    )
            )
            .join("");


    /*
       Attach event handlers.
    */

    container
        .querySelectorAll(
            ".billing-medicine-select"
        )
        .forEach(
            select => {

                select.addEventListener(
                    "change",
                    handleMedicineChange
                );

            }
        );


    container
        .querySelectorAll(
            ".billing-quantity-input"
        )
        .forEach(
            input => {

                input.addEventListener(
                    "input",
                    handleQuantityChange
                );

            }
        );


    container
        .querySelectorAll(
            ".remove-medicine-btn"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    handleRemoveRow
                );

            }
        );


    updateStockPreview();

}


/* =========================================================
   CREATE MEDICINE ROW HTML
   ========================================================= */

function createMedicineRowHtml(
    row
) {

    const medicine =
        findMedicineById(
            row.medicine_id
        );


    const stock =
        medicine
            ? Number(
                medicine.current_stock
                ||
                0
            )
            : null;


    const unit =
        medicine?.unit
        ||
        "units";


    const cost =
        medicine
            ? Number(
                medicine.unit_cost
                ||
                0
            )
            : 0;


    const estimatedValue =
        cost *
        Number(
            row.quantity
            ||
            0
        );


    let stockClass =
        "stock-ok";


    let stockText =
        medicine
            ? `${formatNumber(stock)} ${escapeHtml(unit)} available`
            : "Select a medicine";


    if (
        medicine &&
        stock <= 0
    ) {

        stockClass =
            "stock-danger";


        stockText =
            "OUT OF STOCK";

    } else if (
        medicine &&
        Number(row.quantity) > stock
    ) {

        stockClass =
            "stock-danger";


        stockText =
            `Insufficient stock: ${formatNumber(stock)} available`;

    } else if (
        medicine &&
        Number(row.quantity) >
        Number(
            medicine.minimum_stock
            ||
            0
        )
    ) {

        stockClass =
            "stock-ok";

    }


    return `

        <div
            class="billing-medicine-row"
            data-row-id="${row.id}"
        >

            <div class="billing-row-main">

                <div class="form-group">

                    <label>
                        Medicine
                    </label>

                    <select
                        class="billing-medicine-select"
                        data-row-id="${row.id}"
                    >

                        <option value="">
                            Select medicine
                        </option>

                        ${medicines
                            .map(
                                medicineItem => `

                                    <option
                                        value="${medicineItem.id}"
                                        ${
                                            String(
                                                row.medicine_id
                                            ) ===
                                            String(
                                                medicineItem.id
                                            )
                                                ? "selected"
                                                : ""
                                        }
                                    >
                                        ${escapeHtml(
                                            medicineItem.name
                                        )}
                                    </option>

                                `
                            )
                            .join("")}

                    </select>

                </div>


                <div class="form-group">

                    <label>
                        Quantity
                    </label>

                    <input
                        type="number"
                        class="billing-quantity-input"
                        data-row-id="${row.id}"
                        min="1"
                        step="1"
                        value="${Number(
                            row.quantity
                            ||
                            1
                        )}"
                    >

                </div>


                <div class="billing-stock-preview ${stockClass}">

                    <span class="stock-preview-dot"></span>

                    <span>
                        ${stockText}
                    </span>

                </div>


                <div class="billing-row-value">

                    <span>
                        Estimated value
                    </span>

                    <strong>
                        ${formatCurrency(
                            estimatedValue
                        )}
                    </strong>

                </div>


                <button
                    type="button"
                    class="btn btn-secondary remove-medicine-btn"
                    data-row-id="${row.id}"
                    title="Remove medicine"
                >
                    Remove
                </button>

            </div>

        </div>

    `;

}


/* =========================================================
   HANDLE MEDICINE CHANGE
   ========================================================= */

function handleMedicineChange(
    event
) {

    const select =
        event.target;


    const rowId =
        Number(
            select.dataset.rowId
        );


    const row =
        findBillingRow(
            rowId
        );


    if (!row) {

        return;

    }


    row.medicine_id =
        select.value
            ? Number(
                select.value
            )
            : "";


    renderMedicineRows();

    updateStockPreview();

    updateBillingSummary();

}


/* =========================================================
   HANDLE QUANTITY CHANGE
   ========================================================= */

function handleQuantityChange(
    event
) {

    const input =
        event.target;


    const rowId =
        Number(
            input.dataset.rowId
        );


    const row =
        findBillingRow(
            rowId
        );


    if (!row) {

        return;

    }


    let quantity =
        Number(
            input.value
        );


    if (
        !Number.isFinite(
            quantity
        )
        ||
        quantity < 1
    ) {

        quantity =
            1;

    }


    row.quantity =
        quantity;


    updateRowPreview(
        rowId
    );

    updateStockPreview();

    updateBillingSummary();

}


/* =========================================================
   UPDATE ONE ROW PREVIEW
   ========================================================= */

function updateRowPreview(
    rowId
) {

    const row =
        findBillingRow(
            rowId
        );


    if (!row) {

        return;

    }


    const domRow =
        document.querySelector(
            `.billing-medicine-row[data-row-id="${rowId}"]`
        );


    if (!domRow) {

        renderMedicineRows();

        return;

    }


    const medicine =
        findMedicineById(
            row.medicine_id
        );


    const stockPreview =
        domRow.querySelector(
            ".billing-stock-preview"
        );


    const valueElement =
        domRow.querySelector(
            ".billing-row-value strong"
        );


    if (!medicine) {

        if (stockPreview) {

            stockPreview.className =
                "billing-stock-preview stock-ok";


            stockPreview.innerHTML = `

                <span class="stock-preview-dot"></span>

                <span>
                    Select a medicine
                </span>

            `;

        }


        if (valueElement) {

            valueElement.textContent =
                "₹0.00";

        }


        return;

    }


    const stock =
        Number(
            medicine.current_stock
            ||
            0
        );


    const quantity =
        Number(
            row.quantity
            ||
            0
        );


    const cost =
        Number(
            medicine.unit_cost
            ||
            0
        );


    const value =
        quantity *
        cost;


    if (stockPreview) {

        if (stock <= 0) {

            stockPreview.className =
                "billing-stock-preview stock-danger";


            stockPreview.innerHTML = `

                <span class="stock-preview-dot"></span>

                <span>
                    OUT OF STOCK
                </span>

            `;

        } else if (
            quantity > stock
        ) {

            stockPreview.className =
                "billing-stock-preview stock-danger";


            stockPreview.innerHTML = `

                <span class="stock-preview-dot"></span>

                <span>
                    Insufficient stock:
                    ${formatNumber(stock)}
                    available
                </span>

            `;

        } else {

            stockPreview.className =
                "billing-stock-preview stock-ok";


            stockPreview.innerHTML = `

                <span class="stock-preview-dot"></span>

                <span>
                    ${formatNumber(stock)}
                    ${escapeHtml(
                        medicine.unit
                        ||
                        "units"
                    )}
                    available
                </span>

            `;

        }

    }


    if (valueElement) {

        valueElement.textContent =
            formatCurrency(
                value
            );

    }

}


/* =========================================================
   REMOVE MEDICINE ROW
   ========================================================= */

function handleRemoveRow(
    event
) {

    const button =
        event.target;


    const rowId =
        Number(
            button.dataset.rowId
        );


    billingRows =
        billingRows.filter(
            row =>
                row.id !== rowId
        );


    renderMedicineRows();

    updateBillingSummary();

    updateStockPreview();

}


/* =========================================================
   FIND BILLING ROW
   ========================================================= */

function findBillingRow(
    rowId
) {

    return billingRows.find(
        row =>
            row.id === rowId
    );

}


/* =========================================================
   FIND MEDICINE
   ========================================================= */

function findMedicineById(
    medicineId
) {

    if (
        medicineId === ""
        ||
        medicineId === null
        ||
        medicineId === undefined
    ) {

        return null;

    }


    return medicines.find(
        medicine =>
            Number(
                medicine.id
            ) ===
            Number(
                medicineId
            )
    )
    ||
    null;

}


/* =========================================================
   RENDER ALL SELECTORS
   ========================================================= */

function renderAllMedicineSelectors() {

    if (
        billingRows.length > 0
    ) {

        renderMedicineRows();

    }

}


/* =========================================================
   UPDATE STOCK PREVIEW
   ========================================================= */

function updateStockPreview() {

    let hasError =
        false;


    const warnings = [];


    for (
        const row of billingRows
    ) {

        const medicine =
            findMedicineById(
                row.medicine_id
            );


        if (!medicine) {

            continue;

        }


        const stock =
            Number(
                medicine.current_stock
                ||
                0
            );


        const quantity =
            Number(
                row.quantity
                ||
                0
            );


        if (stock <= 0) {

            hasError =
                true;


            warnings.push(
                `${medicine.name} is out of stock.`
            );

        } else if (
            quantity > stock
        ) {

            hasError =
                true;


            warnings.push(
                `${medicine.name}: only ${formatNumber(stock)} available.`
            );

        }

    }


    const warningElement =
        getElement(
            "stockWarning"
        );


    if (warningElement) {

        if (hasError) {

            warningElement.hidden =
                false;


            warningElement.className =
                "message-box warning";


            warningElement.textContent =
                warnings.join(" ");

        } else {

            warningElement.hidden =
                true;


            warningElement.textContent =
                "";

        }

    }


    const statusElement =
        getElement(
            "billingStockStatus"
        );


    if (statusElement) {

        if (hasError) {

            statusElement.className =
                "billing-stock-status danger";


            statusElement.innerHTML = `

                <span class="status-dot danger"></span>

                <div>

                    <strong>
                        Stock validation failed
                    </strong>

                    <small>
                        Review medicine quantities before confirming.
                    </small>

                </div>

            `;

        } else if (
            billingRows.length > 0
        ) {

            const selectedCount =
                billingRows.filter(
                    row =>
                        row.medicine_id
                ).length;


            if (
                selectedCount ===
                billingRows.length
            ) {

                statusElement.className =
                    "billing-stock-status success";


                statusElement.innerHTML = `

                    <span class="status-dot success"></span>

                    <div>

                        <strong>
                            Inventory available
                        </strong>

                        <small>
                            All selected quantities are within stock.
                        </small>

                    </div>

                `;

            } else {

                statusElement.className =
                    "billing-stock-status";


                statusElement.innerHTML = `

                    <span class="status-dot"></span>

                    <div>

                        <strong>
                            Inventory check
                        </strong>

                        <small>
                            Select medicines to validate stock.
                        </small>

                    </div>

                `;

            }

        }

    }


    /*
       Update individual row previews without
       unnecessarily rebuilding the whole UI.
    */

    for (
        const row of billingRows
    ) {

        updateRowPreview(
            row.id
        );

    }

}


/* =========================================================
   UPDATE BILLING SUMMARY
   ========================================================= */

function updateBillingSummary() {

    const selectedRows =
        billingRows.filter(
            row =>
                row.medicine_id
        );


    let totalQuantity =
        0;


    let totalValue =
        0;


    for (
        const row of selectedRows
    ) {

        const medicine =
            findMedicineById(
                row.medicine_id
            );


        if (!medicine) {

            continue;

        }


        const quantity =
            Number(
                row.quantity
                ||
                0
            );


        const cost =
            Number(
                medicine.unit_cost
                ||
                0
            );


        totalQuantity +=
            quantity;


        totalValue +=
            quantity *
            cost;

    }


    setText(
        "summaryMedicineCount",
        selectedRows.length
    );


    setText(
        "summaryQuantity",
        formatNumber(
            totalQuantity
        )
    );


    setText(
        "summaryValue",
        formatCurrency(
            totalValue
        )
    );

}


/* =========================================================
   CONFIRM MEDICINE ISSUE
   ========================================================= */

async function confirmMedicineIssue() {

    const patientName =
        getElement(
            "patientName"
        )?.value?.trim()
        ||
        "";


    const patientId =
        getElement(
            "patientId"
        )?.value?.trim()
        ||
        "";


    const referenceNumber =
        getElement(
            "billReference"
        )?.value?.trim()
        ||
        "";


    /*
       Patient name is useful for the UI but the
       current backend transaction table does not
       have a patient_name column.
    */

    const selectedRows =
        billingRows.filter(
            row =>
                row.medicine_id
        );


    if (
        selectedRows.length === 0
    ) {

        showMessage(

            "billingMessage",

            "Please select at least one medicine.",

            "error"

        );

        return;

    }


    /*
       Validate quantities and stock before
       sending anything to the backend.
    */

    const items = [];


    for (
        const row of selectedRows
    ) {

        const medicine =
            findMedicineById(
                row.medicine_id
            );


        if (!medicine) {

            showMessage(

                "billingMessage",

                "One of the selected medicines is no longer available.",

                "error"

            );

            return;

        }


        const quantity =
            Number(
                row.quantity
            );


        const stock =
            Number(
                medicine.current_stock
                ||
                0
            );


        if (
            !Number.isInteger(
                quantity
            )
            ||
            quantity <= 0
        ) {

            showMessage(

                "billingMessage",

                `Enter a valid whole-number quantity for ${medicine.name}.`,

                "error"

            );

            return;

        }


        if (
            quantity > stock
        ) {

            showMessage(

                "billingMessage",

                `${medicine.name}: requested ${quantity}, but only ${stock} is available.`,

                "error"

            );

            return;

        }


        items.push({

            medicine_id:
                Number(
                    medicine.id
                ),

            quantity:
                quantity

        });

    }


    /*
       Current billing backend supports medicine_id
       + quantity. We send the first medicine through
       the existing endpoint when one medicine is being
       issued, and use the items array when multiple
       medicines are selected.
    */

    const payload = {

        patient_name:
            patientName,

        patient_id:
            patientId,

        reference_number:
            referenceNumber,

        transaction_type:
            "OUT"

    };


    /*
       For compatibility with the controller:
       - Single medicine → medicine_id + quantity
       - Multiple medicines → items[]
    */

    if (
        items.length === 1
    ) {

        payload.medicine_id =
            items[0].medicine_id;

        payload.quantity =
            items[0].quantity;

    } else {

        payload.items =
            items;

    }


    const confirmButton =
        getElement(
            "confirmBillBtn"
        );


    if (confirmButton) {

        confirmButton.disabled =
            true;


        confirmButton.dataset.originalText =
            confirmButton.innerText;


        confirmButton.innerText =
            "Processing...";

    }


    try {

        const response =
            await fetch(

                `${API_BASE}/billing`,

                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify(
                            payload
                        )

                }

            );


        const result =
            await response.json();


        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(

                result.error
                ||
                result.details
                ||
                "Medicine issue failed."

            );

        }


        /*
           Success.
        */

        const issuedQuantity =
            result.data?.total_quantity
            ||
            result.data?.quantity
            ||
            items.reduce(

                (
                    total,
                    item
                ) =>
                    total +
                    item.quantity,

                0

            );


        showMessage(

            "billingMessage",

            `Medicine issue confirmed successfully. ${formatNumber(issuedQuantity)} unit(s) recorded as STOCK OUT.`,

            "success"

        );


        /*
           Reload inventory so the next billing
           operation uses fresh stock values.
        */

        await loadMedicines();


        /*
           Reload recent transactions.
        */

        await loadBills();


        /*
           Clear the current billing form after
           successful transaction.
        */

        setTimeout(
            () => {

                resetBillingForm();

            },
            1200
        );


    } catch (error) {

        console.error(
            "CONFIRM BILL ERROR:",
            error
        );


        showMessage(

            "billingMessage",

            error.message
            ||
            "Medicine issue failed.",

            "error"

        );

    } finally {

        if (confirmButton) {

            confirmButton.disabled =
                false;


            confirmButton.innerText =
                confirmButton.dataset.originalText
                ||
                "Confirm Medicine Issue";

        }

    }

}


/* =========================================================
   LOAD RECENT BILLS / TRANSACTIONS
   ========================================================= */

async function loadBills() {

    try {

        const response =
            await fetch(

                `${API_BASE}/billing`

            );


        const result =
            await response.json();


        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(

                result.error
                ||
                result.details
                ||
                "Failed to load transaction history."

            );

        }


        const rows =
            Array.isArray(
                result.data
            )
                ? result.data
                : [];


        renderBills(
            rows
        );


    } catch (error) {

        console.error(
            "LOAD BILLS ERROR:",
            error
        );


        const body =
            getElement(
                "billsTableBody"
            );


        if (body) {

            body.innerHTML = `

                <tr>

                    <td
                        colspan="5"
                        class="empty-state"
                    >

                        Failed to load transactions.

                    </td>

                </tr>

            `;

        }

    }

}


/* =========================================================
   RENDER BILLS
   ========================================================= */

function renderBills(
    rows
) {

    const body =
        getElement(
            "billsTableBody"
        );


    if (!body) {

        return;

    }


    if (
        !rows.length
    ) {

        body.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="empty-state"
                >

                    No medicine issue transactions yet.

                </td>

            </tr>

        `;

        return;

    }


    body.innerHTML =
        rows
            .map(
                row => `

                    <tr>

                        <td>

                            <strong>

                                ${escapeHtml(
                                    row.medicine_name
                                    ||
                                    "Unknown"
                                )}

                            </strong>

                        </td>


                        <td>

                            ${createTransactionBadge(
                                row.transaction_type
                            )}

                        </td>


                        <td>

                            ${formatNumber(
                                row.quantity
                            )}

                        </td>


                        <td>

                            ${escapeHtml(
                                row.reference_number
                                ||
                                "—"
                            )}

                        </td>


                        <td>

                            ${formatDate(
                                row.transaction_date
                            )}

                        </td>

                    </tr>

                `
            )
            .join("");

}


/* =========================================================
   RESET BILLING FORM
   ========================================================= */

function resetBillingForm() {

    billingRows = [];


    /*
       Clear patient fields.
    */

    [

        "patientName",

        "patientId",

        "billReference"

    ].forEach(
        id => {

            const element =
                getElement(
                    id
                );


            if (element) {

                element.value =
                    "";

            }

        }
    );


    /*
       Add a fresh medicine row.
    */

    renderMedicineRows();

    addMedicineRow();


    /*
       Clear warning.
    */

    const warning =
        getElement(
            "stockWarning"
        );


    if (warning) {

        warning.hidden =
            true;

    }


    updateBillingSummary();

    updateStockPreview();

}


/* =========================================================
   MESSAGE HELPER
   ========================================================= */

function showMessage(
    id,
    message,
    type = "info"
) {

    const element =
        getElement(
            id
        );


    if (!element) {

        console.log(

            `[${type.toUpperCase()}]`,

            message

        );

        return;

    }


    element.textContent =
        message;


    element.hidden =
        false;


    element.className =
        `message-box ${type}`;


    if (
        type === "success"
        ||
        type === "info"
    ) {

        setTimeout(
            () => {

                element.hidden =
                    true;

            },
            5000
        );

    }

}


/* =========================================================
   SET TEXT
   ========================================================= */

function setText(
    id,
    value
) {

    const element =
        getElement(
            id
        );


    if (element) {

        element.textContent =
            value ?? "";

    }

}


/* =========================================================
   FORMAT NUMBER
   ========================================================= */

function formatNumber(
    value
) {

    const number =
        Number(
            value || 0
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return "0";

    }


    return number.toLocaleString(
        "en-IN"
    );

}


/* =========================================================
   FORMAT CURRENCY
   ========================================================= */

function formatCurrency(
    value
) {

    const number =
        Number(
            value || 0
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return "₹0.00";

    }


    return number.toLocaleString(

        "en-IN",

        {

            style:
                "currency",

            currency:
                "INR",

            minimumFractionDigits:
                2

        }

    );

}


/* =========================================================
   FORMAT DATE
   ========================================================= */

function formatDate(
    value
) {

    if (!value) {

        return "—";

    }


    const dateString =
        String(value)
            .substring(
                0,
                10
            );


    const parts =
        dateString.split("-");


    if (
        parts.length !== 3
    ) {

        return escapeHtml(
            String(value)
        );

    }


    return `${parts[2]}-${parts[1]}-${parts[0]}`;

}


/* =========================================================
   TRANSACTION BADGE
   ========================================================= */

function createTransactionBadge(
    type
) {

    const transactionType =
        String(
            type || "OUT"
        ).toUpperCase();


    return `

        <span class="status-badge status-${transactionType.toLowerCase()}">

            ${escapeHtml(
                transactionType
            )}

        </span>

    `;

}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(
    value
) {

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


/* =========================================================
   PUBLIC DEBUG API
   ========================================================= */

window.MedSupplyBilling = {

    getMedicines:
        () => medicines,

    getRows:
        () => billingRows,

    reload:
        initializeBilling,

    reset:
        resetBillingForm

};