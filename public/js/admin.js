/* =========================================================
   MEDSUPPLY INTELLIGENCE
   ADMIN JAVASCRIPT

   Responsibilities:
   - Load medicines
   - Load suppliers
   - Add medicine
   - Upload invoice
   - AI OCR
   - Match OCR medicines to inventory
   - Confirm complete invoice
   - Update inventory
   ========================================================= */


/* =========================================================
   GLOBAL STATE
   ========================================================= */

let medicines = [];

let suppliers = [];

let extractedInvoice = null;

let selectedInvoiceFile = null;


/* =========================================================
   DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeAdmin();

    }
);


/* =========================================================
   INITIALIZE
   ========================================================= */

async function initializeAdmin() {

    setupInvoiceUpload();

    setupForms();

    setupButtons();

    await Promise.all([
        loadMedicines(),
        loadSuppliers()
    ]);

}


/* =========================================================
   DOM HELPERS
   ========================================================= */

function getElement(id) {

    return document.getElementById(id);

}


/* =========================================================
   MESSAGE HELPER
   ========================================================= */

function showMessage(
    elementOrId,
    message,
    type = "info"
) {

    const element =
        typeof elementOrId === "string"
            ? getElement(elementOrId)
            : elementOrId;


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


    /*
       Automatically hide normal success/info
       messages after a few seconds.
    */

    if (
        type === "success" ||
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
   SETUP INVOICE UPLOAD
   ========================================================= */

function setupInvoiceUpload() {

    const fileInput =
        getElement(
            "invoiceFile"
        );


    const chooseButton =
        getElement(
            "chooseInvoiceBtn"
        );


    const uploadArea =
        getElement(
            "invoiceUploadArea"
        );


    if (
        chooseButton &&
        fileInput
    ) {

        chooseButton.addEventListener(
            "click",
            () => {

                fileInput.click();

            }
        );

    }


    if (fileInput) {

        fileInput.addEventListener(
            "change",
            handleInvoiceFile
        );

    }


    /*
       Allow clicking the upload area.
    */

    if (
        uploadArea &&
        fileInput
    ) {

        uploadArea.addEventListener(
            "click",
            event => {

                if (
                    event.target.tagName ===
                    "BUTTON"
                ) {

                    return;

                }


                fileInput.click();

            }
        );


        /*
           Drag and drop.
        */

        uploadArea.addEventListener(
            "dragover",
            event => {

                event.preventDefault();

                uploadArea.classList.add(
                    "dragover"
                );

            }
        );


        uploadArea.addEventListener(
            "dragleave",
            () => {

                uploadArea.classList.remove(
                    "dragover"
                );

            }
        );


        uploadArea.addEventListener(
            "drop",
            event => {

                event.preventDefault();

                uploadArea.classList.remove(
                    "dragover"
                );


                const files =
                    event.dataTransfer.files;


                if (
                    files &&
                    files.length
                ) {

                    fileInput.files =
                        files;

                    handleInvoiceFile({
                        target: fileInput
                    });

                }

            }
        );

    }

}


/* =========================================================
   HANDLE SELECTED INVOICE
   ========================================================= */

function handleInvoiceFile(event) {

    const file =
        event.target.files?.[0];


    if (!file) {

        selectedInvoiceFile =
            null;

        updateSelectedFileUI();

        return;

    }


    const allowedTypes = [

        "image/jpeg",

        "image/jpg",

        "image/png"

    ];


    if (
        !allowedTypes.includes(
            file.type
        )
    ) {

        showMessage(

            "invoiceMessage",

            "Please select a JPG, JPEG or PNG invoice image.",

            "error"

        );


        event.target.value =
            "";

        selectedInvoiceFile =
            null;

        updateSelectedFileUI();

        return;

    }


    const maxSize =
        10 * 1024 * 1024;


    if (
        file.size > maxSize
    ) {

        showMessage(

            "invoiceMessage",

            "Invoice file must be smaller than 10 MB.",

            "error"

        );


        event.target.value =
            "";

        selectedInvoiceFile =
            null;

        updateSelectedFileUI();

        return;

    }


    selectedInvoiceFile =
        file;


    updateSelectedFileUI();


    const scanButton =
        getElement(
            "scanInvoiceBtn"
        );


    if (scanButton) {

        scanButton.disabled =
            false;

    }

}


/* =========================================================
   UPDATE SELECTED FILE UI
   ========================================================= */

function updateSelectedFileUI() {

    const element =
        getElement(
            "selectedInvoiceFile"
        );


    if (!element) {
        return;
    }


    if (!selectedInvoiceFile) {

        element.textContent =
            "No invoice selected";

        return;

    }


    const sizeMB =
        (
            selectedInvoiceFile.size
            /
            (1024 * 1024)
        ).toFixed(2);


    element.textContent =
        `${selectedInvoiceFile.name} (${sizeMB} MB)`;

}


/* =========================================================
   SETUP FORMS
   ========================================================= */

function setupForms() {

    const medicineForm =
        getElement(
            "medicineForm"
        );


    if (medicineForm) {

        medicineForm.addEventListener(
            "submit",
            addMedicine
        );

    }


    const cancelButton =
        getElement(
            "cancelInvoiceBtn"
        );


    if (cancelButton) {

        cancelButton.addEventListener(
            "click",
            resetScanner
        );

    }


    const confirmButton =
        getElement(
            "confirmInvoiceBtn"
        );


    if (confirmButton) {

        confirmButton.addEventListener(
            "click",
            confirmInvoice
        );

    }

}


/* =========================================================
   SETUP BUTTONS
   ========================================================= */

function setupButtons() {

    const scanButton =
        getElement(
            "scanInvoiceBtn"
        );


    if (scanButton) {

        scanButton.addEventListener(
            "click",
            scanInvoice
        );

    }


    const resetButton =
        getElement(
            "resetScannerBtn"
        );


    if (resetButton) {

        resetButton.addEventListener(
            "click",
            resetScanner
        );

    }


    const refreshButton =
        getElement(
            "refreshInventoryBtn"
        );


    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            async () => {

                await loadMedicines();

                showMessage(
                    "medicineMessage",
                    "Inventory refreshed.",
                    "success"
                );

            }
        );

    }


    const resetMedicineButton =
        getElement(
            "resetMedicineBtn"
        );


    if (resetMedicineButton) {

        resetMedicineButton.addEventListener(
            "click",
            () => {

                const message =
                    getElement(
                        "medicineMessage"
                    );


                if (message) {

                    message.hidden =
                        true;

                }

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
                "/api/medicines"
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


        renderInventory();

        updateMedicineSelectors();


        /*
           If OCR results are already visible,
           rebuild their matching selectors using
           the newly loaded inventory.
        */

        if (
            extractedInvoice &&
            extractedInvoice.items
        ) {

            renderExtractedItems();

        }

    } catch (error) {

        console.error(
            "LOAD MEDICINES ERROR:",
            error
        );


        renderInventoryError(
            error.message
        );

    }

}


/* =========================================================
   LOAD SUPPLIERS
   ========================================================= */

async function loadSuppliers() {

    try {

        const response =
            await fetch(
                "/api/medicines/suppliers"
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
                "Failed to load suppliers."

            );

        }


        suppliers =
            Array.isArray(
                result.data
            )
                ? result.data
                : [];


        updateSupplierSelectors();

    } catch (error) {

        console.error(
            "LOAD SUPPLIERS ERROR:",
            error
        );

    }

}


/* =========================================================
   UPDATE SUPPLIER SELECTORS
   ========================================================= */

function updateSupplierSelectors() {

    const selectors = [

        getElement(
            "supplierSelect"
        ),

        getElement(
            "medicineSupplier"
        )

    ];


    selectors.forEach(
        select => {

            if (!select) {
                return;
            }


            const currentValue =
                select.value;


            const isInvoiceSelector =
                select.id ===
                "supplierSelect";


            select.innerHTML = "";


            const defaultOption =
                document.createElement(
                    "option"
                );


            defaultOption.value =
                "";


            defaultOption.textContent =
                isInvoiceSelector
                    ? "Select supplier"
                    : "Select supplier";


            select.appendChild(
                defaultOption
            );


            suppliers.forEach(
                supplier => {

                    const option =
                        document.createElement(
                            "option"
                        );


                    option.value =
                        supplier.id;


                    option.textContent =
                        supplier.name;


                    if (
                        String(
                            supplier.id
                        ) ===
                        String(
                            currentValue
                        )
                    ) {

                        option.selected =
                            true;

                    }


                    select.appendChild(
                        option
                    );

                }
            );

        }
    );

}


/* =========================================================
   UPDATE MEDICINE SELECTORS
   ========================================================= */

function updateMedicineSelectors() {

    /*
       OCR selectors are generated dynamically
       by renderExtractedItems().
    */

    renderExtractedItems();

}


/* =========================================================
   RENDER INVENTORY
   ========================================================= */

function renderInventory() {

    const body =
        getElement(
            "inventoryTableBody"
        );


    if (!body) {
        return;
    }


    if (!medicines.length) {

        body.innerHTML = `

            <tr>

                <td
                    colspan="9"
                    class="empty-state"
                >
                    No medicines found.

                </td>

            </tr>

        `;

        return;

    }


    body.innerHTML =
        medicines
            .map(
                medicine =>
                    `

                    <tr>

                        <td>
                            <strong>
                                ${escapeHtml(
                                    medicine.name
                                )}
                            </strong>
                        </td>

                        <td>
                            ${escapeHtml(
                                medicine.category
                                ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                medicine.current_stock
                            )}
                            ${escapeHtml(
                                medicine.unit
                                ||
                                "units"
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                medicine.minimum_stock
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                medicine.emergency_reserve
                            )}
                        </td>

                        <td>
                            ${createCriticalityBadge(
                                medicine.criticality
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                medicine.supplier_name
                                ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${formatDate(
                                medicine.expiry_date
                            )}
                        </td>

                        <td>
                            ${createStatusBadge(
                                medicine.status
                            )}
                        </td>

                    </tr>

                    `
            )
            .join("");

}


/* =========================================================
   RENDER INVENTORY ERROR
   ========================================================= */

function renderInventoryError(
    message
) {

    const body =
        getElement(
            "inventoryTableBody"
        );


    if (!body) {
        return;
    }


    body.innerHTML = `

        <tr>

            <td
                colspan="9"
                class="empty-state"
            >

                Failed to load inventory:
                ${escapeHtml(message)}

            </td>

        </tr>

    `;

}


/* =========================================================
   SCAN INVOICE
   ========================================================= */

async function scanInvoice() {

    if (!selectedInvoiceFile) {

        showMessage(

            "invoiceMessage",

            "Please select an invoice image first.",

            "error"

        );

        return;

    }


    const loading =
        getElement(
            "ocrLoading"
        );


    const scanButton =
        getElement(
            "scanInvoiceBtn"
        );


    if (loading) {

        loading.hidden =
            false;

    }


    if (scanButton) {

        scanButton.disabled =
            true;

        scanButton.dataset.originalText =
            scanButton.innerText;

        scanButton.innerText =
            "Scanning...";

    }


    try {

        const formData =
            new FormData();


        formData.append(
            "invoice",
            selectedInvoiceFile
        );


        const response =
            await fetch(

                "/api/invoices/extract",

                {

                    method:
                        "POST",

                    body:
                        formData

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
                "Invoice OCR failed."

            );

        }


        /*
           Store OCR result globally.
        */

        extractedInvoice =
            result.data.extracted;


        /*
           Preserve uploaded file name
           for confirmation.
        */

        extractedInvoice.file_name =
            result.data.file_name;


        /*
           Display OCR result.
        */

        renderOcrResult(
            result.data
        );


        showMessage(

            "invoiceMessage",

            `Invoice scanned successfully. ${extractedInvoice.items?.length || 0} medicine(s) detected.`,

            "success"

        );


    } catch (error) {

        console.error(
            "SCAN INVOICE ERROR:",
            error
        );


        showMessage(

            "invoiceMessage",

            error.message
            ||
            "Invoice OCR failed.",

            "error"

        );

    } finally {

        if (loading) {

            loading.hidden =
                true;

        }


        if (scanButton) {

            scanButton.disabled =
                !selectedInvoiceFile;

            scanButton.innerText =
                scanButton.dataset.originalText
                ||
                "Scan Invoice with AI";

        }

    }

}


/* =========================================================
   RENDER OCR RESULT
   ========================================================= */

function renderOcrResult(
    data
) {

    const extracted =
        data.extracted
        ||
        {};


    /* =====================================================
       SUMMARY
       ===================================================== */

    const summarySection =
        getElement(
            "ocrSummarySection"
        );


    if (summarySection) {

        summarySection.hidden =
            false;

    }


    setText(
        "invoiceNumberDisplay",
        extracted.invoice_number
        ||
        "Not detected"
    );


    setText(
        "supplierDisplay",
        extracted.supplier
        ||
        "Not detected"
    );


    setText(
        "invoiceDateDisplay",
        extracted.invoice_date
        ||
        "Not detected"
    );


    setText(

        "itemsDetectedDisplay",

        extracted.items?.length
        ||
        0

    );


    /* =====================================================
       CONFIRMATION DEFAULT VALUES
       ===================================================== */

    const invoiceNumber =
        getElement(
            "invoiceNumber"
        );


    if (invoiceNumber) {

        invoiceNumber.value =
            extracted.invoice_number
            ||
            "";

    }


    const invoiceDate =
        getElement(
            "invoiceDate"
        );


    if (invoiceDate) {

        invoiceDate.value =
            extracted.invoice_date
            ||
            "";

    }


    selectSupplierFromOcr(
        extracted.supplier
    );


    /* =====================================================
       EXTRACTED ITEMS
       ===================================================== */

    renderExtractedItems();


    /* =====================================================
       RAW OCR
       ===================================================== */

    const rawText =
        data.raw_text
        ||
        "";


    setText(
        "rawOcrText",
        rawText
    );


    const rawSection =
        getElement(
            "rawOcrSection"
        );


    if (rawSection) {

        rawSection.hidden =
            false;

    }


    /* =====================================================
       SECTIONS
       ===================================================== */

    const itemsSection =
        getElement(
            "extractedItemsSection"
        );


    if (itemsSection) {

        itemsSection.hidden =
            false;

    }


    const confirmationSection =
        getElement(
            "invoiceConfirmationSection"
        );


    if (confirmationSection) {

        confirmationSection.hidden =
            false;

    }


    updateConfirmationSummary();

}


/* =========================================================
   SELECT SUPPLIER FROM OCR
   ========================================================= */

function selectSupplierFromOcr(
    supplierName
) {

    if (!supplierName) {
        return;
    }


    const select =
        getElement(
            "supplierSelect"
        );


    if (!select) {
        return;
    }


    const normalized =
        normalizeName(
            supplierName
        );


    let match =
        suppliers.find(
            supplier =>
                normalizeName(
                    supplier.name
                ) ===
                normalized
        );


    /*
       Partial matching fallback.
    */

    if (!match) {

        match =
            suppliers.find(
                supplier => {

                    const supplierNormalized =
                        normalizeName(
                            supplier.name
                        );


                    return (

                        supplierNormalized.includes(
                            normalized
                        )

                        ||

                        normalized.includes(
                            supplierNormalized
                        )

                    );

                }
            );

    }


    if (match) {

        select.value =
            match.id;

    }

}


/* =========================================================
   RENDER EXTRACTED ITEMS
   ========================================================= */

function renderExtractedItems() {

    const body =
        getElement(
            "extractedItemsBody"
        );


    if (!body) {
        return;
    }


    if (
        !extractedInvoice ||
        !Array.isArray(
            extractedInvoice.items
        ) ||
        extractedInvoice.items.length === 0
    ) {

        body.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="empty-state"
                >
                    No medicines detected by OCR.

                </td>

            </tr>

        `;

        updateConfirmationSummary();

        return;

    }


    body.innerHTML =
        extractedInvoice.items
            .map(
                (
                    item,
                    index
                ) => {

                    const matched =
                        findMedicine(
                            item.medicine_name
                        );


                    /*
                       Preserve an existing selected ID.
                    */

                    if (
                        !item.medicine_id &&
                        matched
                    ) {

                        /*
                           Automatically match only when
                           the name is an exact match.

                           Partial matches require user
                           verification.
                        */

                        if (
                            normalizeName(
                                matched.name
                            ) ===
                            normalizeName(
                                item.medicine_name
                            )
                        ) {

                            item.medicine_id =
                                matched.id;

                        }

                    }


                    const selectedId =
                        item.medicine_id
                        ||
                        "";


                    return `

                        <tr
                            data-item-index="${index}"
                        >

                            <td>

                                <strong>
                                    ${escapeHtml(
                                        item.medicine_name
                                        ||
                                        "Unknown"
                                    )}
                                </strong>

                            </td>


                            <td>

                                <select
                                    class="ocr-medicine-select"
                                    data-index="${index}"
                                >

                                    <option value="">
                                        Select medicine
                                    </option>

                                    ${medicines
                                        .map(
                                            medicine => `

                                                <option
                                                    value="${medicine.id}"
                                                    ${
                                                        String(
                                                            selectedId
                                                        ) ===
                                                        String(
                                                            medicine.id
                                                        )
                                                            ? "selected"
                                                            : ""
                                                    }
                                                >
                                                    ${escapeHtml(
                                                        medicine.name
                                                    )}
                                                </option>

                                            `
                                        )
                                        .join("")}

                                </select>

                            </td>


                            <td>
                                ${escapeHtml(
                                    item.batch_number
                                    ||
                                    "—"
                                )}
                            </td>


                            <td>
                                ${formatNumber(
                                    item.quantity
                                )}
                            </td>


                            <td>
                                ${formatDate(
                                    item.expiry_date
                                )}
                            </td>


                            <td>
                                ${
                                    item.unit_cost !== null &&
                                    item.unit_cost !== undefined
                                        ? formatCurrency(
                                            item.unit_cost
                                        )
                                        : "—"
                                }
                            </td>


                            <td>

                                <span
                                    class="ocr-match-status ${
                                        selectedId
                                            ? "matched"
                                            : "unmatched"
                                    }"
                                    data-status-index="${index}"
                                >

                                    ${
                                        selectedId
                                            ? "MATCHED"
                                            : "REVIEW"
                                    }

                                </span>

                            </td>

                        </tr>

                    `;

                }
            )
            .join("");


    /*
       Add change listeners after HTML creation.
    */

    document
        .querySelectorAll(
            ".ocr-medicine-select"
        )
        .forEach(
            select => {

                select.addEventListener(
                    "change",
                    handleMedicineMatch
                );

            }
        );


    updateConfirmationSummary();

}


/* =========================================================
   HANDLE MEDICINE MATCH
   ========================================================= */

function handleMedicineMatch(
    event
) {

    const select =
        event.target;


    const index =
        Number(
            select.dataset.index
        );


    if (
        !extractedInvoice ||
        !extractedInvoice.items[index]
    ) {

        return;

    }


    const medicineId =
        select.value
        ? Number(
            select.value
        )
        : null;


    extractedInvoice.items[index]
        .medicine_id =
            medicineId;


    /*
       Update match status.
    */

    const status =
        document.querySelector(
            `[data-status-index="${index}"]`
        );


    if (status) {

        status.textContent =
            medicineId
                ? "MATCHED"
                : "REVIEW";


        status.className =
            `ocr-match-status ${
                medicineId
                    ? "matched"
                    : "unmatched"
            }`;

    }


    updateConfirmationSummary();

}


/* =========================================================
   FIND MEDICINE
   ========================================================= */

function findMedicine(
    name
) {

    if (!name) {
        return null;
    }


    const normalized =
        normalizeName(
            name
        );


    /*
       Exact match.
    */

    let match =
        medicines.find(
            medicine =>
                normalizeName(
                    medicine.name
                ) ===
                normalized
        );


    if (match) {
        return match;
    }


    /*
       Partial match.
    */

    match =
        medicines.find(
            medicine => {

                const medicineName =
                    normalizeName(
                        medicine.name
                    );


                return (

                    medicineName.includes(
                        normalized
                    )

                    ||

                    normalized.includes(
                        medicineName
                    )

                );

            }
        );


    return match || null;

}


/* =========================================================
   UPDATE CONFIRMATION SUMMARY
   ========================================================= */

function updateConfirmationSummary() {

    const items =
        extractedInvoice?.items
        ||
        [];


    const count =
        items.length;


    const totalQuantity =
        items.reduce(

            (
                total,
                item
            ) =>

                total +
                Number(
                    item.quantity
                    ||
                    0
                ),

            0

        );


    setText(
        "confirmationItemCount",
        count
    );


    setText(
        "confirmationTotalQuantity",
        formatNumber(
            totalQuantity
        )
    );

}


/* =========================================================
   CONFIRM COMPLETE INVOICE
   ========================================================= */

async function confirmInvoice() {

    if (
        !extractedInvoice ||
        !Array.isArray(
            extractedInvoice.items
        ) ||
        extractedInvoice.items.length === 0
    ) {

        showMessage(

            "confirmationMessage",

            "No extracted medicines available to confirm.",

            "error"

        );

        return;

    }


    const invoiceNumber =
        getElement(
            "invoiceNumber"
        )?.value?.trim();


    const supplierSelect =
        getElement(
            "supplierSelect"
        );


    const supplierId =
        supplierSelect?.value
            ? Number(
                supplierSelect.value
            )
            : null;


    const invoiceDate =
        getElement(
            "invoiceDate"
        )?.value
        ||
        null;


    if (!invoiceNumber) {

        showMessage(

            "confirmationMessage",

            "Invoice number is required.",

            "error"

        );

        return;

    }


    /*
       Supplier is recommended but not mandatory
       because the database allows NULL supplier_id.
    */


    const items = [];


    for (
        let index = 0;
        index <
        extractedInvoice.items.length;
        index++
    ) {

        const item =
            extractedInvoice.items[index];


        const medicineId =
            item.medicine_id;


        const quantity =
            Number(
                item.quantity
            );


        if (!medicineId) {

            showMessage(

                "confirmationMessage",

                `Please match "${item.medicine_name}" with an inventory medicine.`,

                "error"

            );

            return;

        }


        if (
            !Number.isFinite(
                quantity
            )
            ||
            quantity <= 0
        ) {

            showMessage(

                "confirmationMessage",

                `Invalid quantity for "${item.medicine_name}".`,

                "error"

            );

            return;

        }


        items.push({

            medicine_id:
                Number(
                    medicineId
                ),

            medicine_name:
                item.medicine_name
                ||
                null,

            batch_number:
                item.batch_number
                ||
                null,

            quantity:
                quantity,

            expiry_date:
                item.expiry_date
                ||
                null,

            unit_cost:
                item.unit_cost !== null &&
                item.unit_cost !== undefined &&
                item.unit_cost !== ""
                    ? Number(
                        item.unit_cost
                    )
                    : null

        });

    }


    const confirmButton =
        getElement(
            "confirmInvoiceBtn"
        );


    if (confirmButton) {

        confirmButton.disabled =
            true;

        confirmButton.dataset.originalText =
            confirmButton.innerText;

        confirmButton.innerText =
            "Confirming Invoice...";

    }


    try {

        /*
           ONE request for the COMPLETE invoice.
        */

        const response =
            await fetch(

                "/api/invoices/confirm",

                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            invoice_number:
                                invoiceNumber,

                            supplier_id:
                                supplierId,

                            supplier_name:
                                extractedInvoice.supplier
                                ||
                                null,

                            invoice_date:
                                invoiceDate,

                            file_name:
                                extractedInvoice.file_name
                                ||
                                null,

                            items:
                                items

                        })

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
                "Invoice confirmation failed."

            );

        }


        const processedItems =
            result.data?.items
            ||
            [];


        const totalQuantity =
            processedItems.reduce(

                (
                    total,
                    item
                ) =>

                    total +
                    Number(
                        item.stock_added
                        ||
                        0
                    ),

                0

            );


        showMessage(

            "confirmationMessage",

            `Invoice ${invoiceNumber} confirmed successfully. ${processedItems.length} medicine(s) added to inventory. Total quantity: ${formatNumber(totalQuantity)}.`,

            "success"

        );


        /*
           Refresh live inventory.
        */

        await loadMedicines();


        /*
           Clear OCR scanner after successful
           confirmation.
        */

        setTimeout(
            () => {

                resetScanner();

            },
            1200
        );


    } catch (error) {

        console.error(
            "CONFIRM INVOICE ERROR:",
            error
        );


        showMessage(

            "confirmationMessage",

            error.message
            ||
            "Invoice confirmation failed.",

            "error"

        );

    } finally {

        if (confirmButton) {

            confirmButton.disabled =
                false;

            confirmButton.innerText =
                confirmButton.dataset.originalText
                ||
                "Confirm Invoice";

        }

    }

}


/* =========================================================
   ADD MEDICINE
   ========================================================= */

async function addMedicine(
    event
) {

    event.preventDefault();


    const form =
        event.target;


    const submitButton =
        getElement(
            "addMedicineBtn"
        );


    const medicineData = {

        name:
            getElement(
                "medicineName"
            )?.value?.trim(),

        category:
            getElement(
                "medicineCategory"
            )?.value?.trim()
            ||
            null,

        unit:
            getElement(
                "medicineUnit"
            )?.value
            ||
            "units",

        criticality:
            getElement(
                "medicineCriticality"
            )?.value
            ||
            "MEDIUM",

        current_stock:
            Number(
                getElement(
                    "medicineStock"
                )?.value
                ||
                0
            ),

        minimum_stock:
            Number(
                getElement(
                    "medicineMinimumStock"
                )?.value
                ||
                0
            ),

        emergency_reserve:
            Number(
                getElement(
                    "medicineReserve"
                )?.value
                ||
                0
            ),

        expiry_date:
            getElement(
                "medicineExpiry"
            )?.value
            ||
            null,

        supplier_id:
            getElement(
                "medicineSupplier"
            )?.value
                ? Number(
                    getElement(
                        "medicineSupplier"
                    ).value
                )
                : null,

        unit_cost:
            getElement(
                "medicineCost"
            )?.value
                ? Number(
                    getElement(
                        "medicineCost"
                    ).value
                )
                : null

    };


    if (!medicineData.name) {

        showMessage(

            "medicineMessage",

            "Medicine name is required.",

            "error"

        );

        return;

    }


    if (
        medicineData.current_stock < 0
        ||
        medicineData.minimum_stock < 0
        ||
        medicineData.emergency_reserve < 0
    ) {

        showMessage(

            "medicineMessage",

            "Stock values cannot be negative.",

            "error"

        );

        return;

    }


    if (
        medicineData.emergency_reserve >
        medicineData.minimum_stock
    ) {

        showMessage(

            "medicineMessage",

            "Emergency reserve should normally not exceed minimum stock.",

            "error"

        );

        return;

    }


    if (submitButton) {

        submitButton.disabled =
            true;

        submitButton.dataset.originalText =
            submitButton.innerText;

        submitButton.innerText =
            "Adding...";

    }


    try {

        const response =
            await fetch(

                "/api/medicines",

                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify(
                            medicineData
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
                "Failed to add medicine."

            );

        }


        showMessage(

            "medicineMessage",

            `${medicineData.name} was added to the inventory successfully.`,

            "success"

        );


        form.reset();


        /*
           Restore sensible defaults after reset.
        */

        const unit =
            getElement(
                "medicineUnit"
            );


        if (unit) {

            unit.value =
                "units";

        }


        const criticality =
            getElement(
                "medicineCriticality"
            );


        if (criticality) {

            criticality.value =
                "MEDIUM";

        }


        await loadMedicines();


    } catch (error) {

        console.error(
            "ADD MEDICINE ERROR:",
            error
        );


        showMessage(

            "medicineMessage",

            error.message
            ||
            "Failed to add medicine.",

            "error"

        );

    } finally {

        if (submitButton) {

            submitButton.disabled =
                false;

            submitButton.innerText =
                submitButton.dataset.originalText
                ||
                "Add Medicine";

        }

    }

}


/* =========================================================
   RESET SCANNER
   ========================================================= */

function resetScanner() {

    extractedInvoice =
        null;


    selectedInvoiceFile =
        null;


    const fileInput =
        getElement(
            "invoiceFile"
        );


    if (fileInput) {

        fileInput.value =
            "";

    }


    updateSelectedFileUI();


    const scanButton =
        getElement(
            "scanInvoiceBtn"
        );


    if (scanButton) {

        scanButton.disabled =
            true;

        scanButton.innerText =
            "Scan Invoice with AI";

    }


    /*
       Hide OCR sections.
    */

    [

        "ocrSummarySection",

        "extractedItemsSection",

        "invoiceConfirmationSection",

        "rawOcrSection"

    ].forEach(
        id => {

            const element =
                getElement(id);


            if (element) {

                element.hidden =
                    true;

            }

        }
    );


    /*
       Clear messages.
    */

    [

        "invoiceMessage",

        "confirmationMessage"

    ].forEach(
        id => {

            const element =
                getElement(id);


            if (element) {

                element.hidden =
                    true;

                element.textContent =
                    "";

            }

        }
    );


    /*
       Clear extracted table.
    */

    const itemsBody =
        getElement(
            "extractedItemsBody"
        );


    if (itemsBody) {

        itemsBody.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="empty-state"
                >
                    No extracted medicines yet.

                </td>

            </tr>

        `;

    }


    /*
       Clear raw OCR.
    */

    setText(
        "rawOcrText",
        ""
    );

}


/* =========================================================
   TEXT HELPER
   ========================================================= */

function setText(
    id,
    value
) {

    const element =
        getElement(id);


    if (element) {

        element.textContent =
            value ?? "";

    }

}


/* =========================================================
   NUMBER FORMAT
   ========================================================= */

function formatNumber(
    value
) {

    const number =
        Number(
            value || 0
        );


    if (!Number.isFinite(number)) {

        return "0";

    }


    return number.toLocaleString(
        "en-IN"
    );

}


/* =========================================================
   CURRENCY FORMAT
   ========================================================= */

function formatCurrency(
    value
) {

    const number =
        Number(
            value || 0
        );


    if (!Number.isFinite(number)) {

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
   DATE FORMAT
   ========================================================= */

function formatDate(
    value
) {

    if (!value) {

        return "—";

    }


    /*
       MySQL date may be returned as:
       YYYY-MM-DD
       or an ISO timestamp.
    */

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
   NORMALIZE NAME
   ========================================================= */

function normalizeName(
    value
) {

    return String(
        value || ""
    )
        .toLowerCase()
        .replace(
            /[^a-z0-9]+/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();

}


/* =========================================================
   CRITICALITY BADGE
   ========================================================= */

function createCriticalityBadge(
    value
) {

    const criticality =
        String(
            value || "MEDIUM"
        ).toUpperCase();


    return `

        <span class="status-badge criticality-${criticality.toLowerCase()}">

            ${escapeHtml(
                criticality
            )}

        </span>

    `;

}


/* =========================================================
   STATUS BADGE
   ========================================================= */

function createStatusBadge(
    value
) {

    const status =
        String(
            value || "NORMAL"
        ).toUpperCase();


    return `

        <span class="status-badge status-${status.toLowerCase()}">

            ${escapeHtml(
                status.replace(
                    /_/g,
                    " "
                )
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
   DEBUG HELPER
   ========================================================= */

window.MedSupplyAdmin = {

    getMedicines:
        () => medicines,

    getSuppliers:
        () => suppliers,

    getExtractedInvoice:
        () => extractedInvoice,

    reload:
        initializeAdmin

};