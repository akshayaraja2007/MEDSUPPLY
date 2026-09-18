const { pool } = require("../config/db");
const Tesseract = require("tesseract.js");


/* =========================================================
   MEDSUPPLY INTELLIGENCE
   AI INVOICE + OCR CONTROLLER

   Flow:

   Invoice Image
        ↓
   Multer Upload
        ↓
   Tesseract OCR
        ↓
   Structured Extraction
        ↓
   Admin Review
        ↓
   Invoice Confirmation
        ↓
   Stock IN
        ↓
   Inventory + Batch + Transaction
   ========================================================= */


/* =========================================================
   DATE NORMALIZATION
   ========================================================= */

function normalizeDate(value) {

    if (!value) {
        return null;
    }


    value =
        String(value)
            .trim();


    let match =
        value.match(
            /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/
        );


    if (match) {

        const day =
            match[1].padStart(2, "0");

        const month =
            match[2].padStart(2, "0");

        const year =
            match[3];


        return `${year}-${month}-${day}`;

    }


    match =
        value.match(
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/
        );


    if (match) {

        return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;

    }


    /*
       MM/YYYY
       Convert to first day of month.
    */

    match =
        value.match(
            /^(\d{1,2})[\/\-](\d{4})$/
        );


    if (match) {

        return `${match[2]}-${String(match[1]).padStart(2, "0")}-01`;

    }


    return null;

}


/* =========================================================
   NUMBER CLEANING
   ========================================================= */

function cleanNumber(value) {

    if (
        value === undefined ||
        value === null
    ) {

        return null;

    }


    const cleaned =
        String(value)
            .replace(/,/g, "")
            .replace(/[₹$]/g, "")
            .trim();


    const number =
        Number(cleaned);


    return Number.isFinite(number)
        ? number
        : null;

}


/* =========================================================
   MEDICINE NAME CLEANING
   ========================================================= */

function cleanMedicineName(value) {

    if (!value) {
        return null;
    }


    return String(value)
        .replace(/\s+/g, " ")
        .replace(/[|]/g, "")
        .trim();

}


/* =========================================================
   INVOICE TEXT PARSER
   ========================================================= */

function parseInvoiceText(text) {

    const lines =
        String(text || "")
            .split(/\r?\n/)
            .map(
                line =>
                    line.trim()
            )
            .filter(
                line =>
                    line.length > 0
            );


    const fullText =
        lines.join("\n");


    /* =====================================================
       INVOICE NUMBER
       ===================================================== */

    let invoiceNumber =
        null;


    const invoiceMatch =
        fullText.match(

            /(?:invoice\s*(?:no|number|#)?|bill\s*(?:no|number|#)?)\s*[:\-]?\s*([A-Z0-9\/\-_]+)/i

        );


    if (invoiceMatch) {

        invoiceNumber =
            invoiceMatch[1];

    }


    /* =====================================================
       SUPPLIER
       ===================================================== */

    let supplier =
        null;


    const supplierMatch =
        fullText.match(

            /(?:supplier|vendor|seller|from)\s*[:\-]?\s*(.+)/i

        );


    if (supplierMatch) {

        supplier =
            supplierMatch[1]
                .trim();

    }


    /* =====================================================
       INVOICE DATE
       ===================================================== */

    let invoiceDate =
        null;


    const dateMatch =
        fullText.match(

            /(?:invoice\s*date|bill\s*date|date)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i

        );


    if (dateMatch) {

        invoiceDate =
            normalizeDate(
                dateMatch[1]
            );

    }


    /* =====================================================
       LINE ITEMS
       ===================================================== */

    const items = [];


    for (
        const line of lines
    ) {

        /*
           Skip obvious table headings.
        */

        if (
            /(?:medicine|description|product|item|quantity|qty|batch|lot|expiry|price|amount)/i.test(line)
            &&
            !/\d/.test(line)
        ) {

            continue;

        }


        /* =================================================
           FORMAT:

           Medicine
           Batch
           Quantity
           Expiry
           Price
           ================================================= */

        const match =
            line.match(

                /^(.+?)\s+(?:BATCH|LOT)?[-:#]?\s*([A-Z0-9\-\/]+)\s+(\d+(?:\.\d+)?)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{1,2}[\/\-]\d{4})\s+(?:₹|\$)?\s*(\d+(?:\.\d+)?)$/i

            );


        if (match) {

            const medicineName =
                cleanMedicineName(
                    match[1]
                );


            if (
                medicineName &&
                medicineName.length >= 2 &&
                !/^(total|subtotal|tax|gst|discount|amount)$/i.test(medicineName)
            ) {

                items.push({

                    medicine_name:
                        medicineName,

                    batch_number:
                        match[2],

                    quantity:
                        cleanNumber(
                            match[3]
                        ),

                    expiry_date:
                        normalizeDate(
                            match[4]
                        ),

                    unit_cost:
                        cleanNumber(
                            match[5]
                        )

                });

            }


            continue;

        }


        /* =================================================
           PIPE / TAB FORMAT

           Medicine | Batch | Qty | Expiry | Price
           ================================================= */

        const parts =
            line
                .split(/\||\t/)
                .map(
                    part =>
                        part.trim()
                )
                .filter(Boolean);


        if (
            parts.length >= 5
        ) {

            const possibleQuantity =
                cleanNumber(
                    parts[2]
                );


            const possibleExpiry =
                normalizeDate(
                    parts[3]
                );


            const possiblePrice =
                cleanNumber(
                    parts[4]
                );


            if (
                possibleQuantity !== null &&
                possibleExpiry !== null &&
                possiblePrice !== null
            ) {

                const medicineName =
                    cleanMedicineName(
                        parts[0]
                    );


                if (medicineName) {

                    items.push({

                        medicine_name:
                            medicineName,

                        batch_number:
                            parts[1],

                        quantity:
                            possibleQuantity,

                        expiry_date:
                            possibleExpiry,

                        unit_cost:
                            possiblePrice

                    });

                }

            }

        }

    }


    /* =====================================================
       REMOVE DUPLICATES
       ===================================================== */

    const uniqueItems = [];

    const seen =
        new Set();


    for (
        const item of items
    ) {

        const key = [

            item.medicine_name,

            item.batch_number,

            item.quantity,

            item.expiry_date

        ].join("|");


        if (
            !seen.has(key)
        ) {

            seen.add(key);

            uniqueItems.push(
                item
            );

        }

    }


    return {

        invoice_number:
            invoiceNumber,

        supplier:
            supplier,

        invoice_date:
            invoiceDate,

        items:
            uniqueItems

    };

}


/* =========================================================
   OCR EXTRACTION
   ========================================================= */

async function extractInvoice(
    req,
    res
) {

    try {

        if (!req.file) {

            return res.status(400).json({

                success:
                    false,

                error:
                    "Invoice image is required."

            });

        }


        if (
            !req.file.mimetype.startsWith(
                "image/"
            )
        ) {

            return res.status(400).json({

                success:
                    false,

                error:
                    "AI OCR currently supports JPG, JPEG and PNG invoice images."

            });

        }


        console.log("");
        console.log(
            "======================================"
        );

        console.log(
            "        AI INVOICE OCR"
        );

        console.log(
            "======================================"
        );

        console.log(
            "File:",
            req.file.originalname
        );

        console.log(
            "Processing invoice..."
        );


        const result =
            await Tesseract.recognize(

                req.file.path,

                "eng",

                {

                    logger:
                        message => {

                            if (
                                message.status ===
                                "recognizing text"
                                &&
                                message.progress
                            ) {

                                console.log(

                                    `OCR Progress: ${Math.round(message.progress * 100)}%`

                                );

                            }

                        }

                }

            );


        const rawText =
            result.data.text;


        console.log(
            "OCR completed."
        );


        const extracted =
            parseInvoiceText(
                rawText
            );


        console.log(
            "Items detected:",
            extracted.items.length
        );


        console.log(
            "======================================"
        );


        return res.json({

            success:
                true,

            message:
                "Invoice scanned successfully.",

            data: {

                file_name:
                    req.file.filename,

                original_file_name:
                    req.file.originalname,

                raw_text:
                    rawText,

                extracted

            }

        });

    } catch (error) {

        console.error(
            "OCR ERROR:",
            error
        );


        return res.status(500).json({

            success:
                false,

            error:
                "Invoice OCR failed.",

            details:
                error.message

        });

    }

}


/* =========================================================
   RESOLVE SUPPLIER
   ========================================================= */

async function resolveSupplier(
    connection,
    supplierId,
    supplierName
) {

    if (
        supplierId
    ) {

        const [
            rows
        ] = await connection.query(

            `
            SELECT
                id,
                name

            FROM suppliers

            WHERE
                id = ?

            LIMIT 1
            `,

            [
                supplierId
            ]

        );


        if (
            rows.length
        ) {

            return rows[0];

        }

    }


    if (
        supplierName
    ) {

        const [
            rows
        ] = await connection.query(

            `
            SELECT
                id,
                name

            FROM suppliers

            WHERE
                name LIKE ?

            ORDER BY
                id ASC

            LIMIT 1
            `,

            [
                `%${supplierName}%`
            ]

        );


        if (
            rows.length
        ) {

            return rows[0];

        }

    }


    return null;

}


/* =========================================================
   RESOLVE MEDICINE
   ========================================================= */

async function resolveMedicine(
    connection,
    medicineId,
    medicineName
) {

    if (
        medicineId
    ) {

        const [
            rows
        ] = await connection.query(

            `
            SELECT *
            FROM inventory_items

            WHERE
                id = ?

            LIMIT 1
            `,

            [
                medicineId
            ]

        );


        if (
            rows.length
        ) {

            return rows[0];

        }

    }


    if (
        medicineName
    ) {

        const cleanName =
            cleanMedicineName(
                medicineName
            );


        /*
           Exact match first.
        */

        let [
            rows
        ] = await connection.query(

            `
            SELECT *
            FROM inventory_items

            WHERE
                LOWER(name) =
                LOWER(?)

            LIMIT 1
            `,

            [
                cleanName
            ]

        );


        if (
            rows.length
        ) {

            return rows[0];

        }


        /*
           Partial match.
        */

        [
            rows
        ] = await connection.query(

            `
            SELECT *
            FROM inventory_items

            WHERE
                LOWER(name) LIKE LOWER(?)

            ORDER BY
                id ASC

            LIMIT 1
            `,

            [
                `%${cleanName}%`
            ]

        );


        if (
            rows.length
        ) {

            return rows[0];

        }

    }


    return null;

}


/* =========================================================
   UPDATE INVENTORY FROM ONE INVOICE ITEM
   ========================================================= */

async function processInvoiceItem(
    connection,
    invoiceId,
    invoiceNumber,
    item
) {

    const medicine =
        await resolveMedicine(

            connection,

            item.medicine_id,

            item.medicine_name

        );


    if (!medicine) {

        throw new Error(

            `Medicine not found: ${item.medicine_name || item.medicine_id}`

        );

    }


    const quantity =
        Number(
            item.quantity
        );


    if (
        !Number.isFinite(quantity)
        ||
        quantity <= 0
    ) {

        throw new Error(

            `Invalid quantity for ${medicine.name}.`

        );

    }


    const oldStock =
        Number(
            medicine.current_stock || 0
        );


    const newStock =
        oldStock +
        quantity;


    let status =
        "NORMAL";


    if (
        newStock === 0
    ) {

        status =
            "STOCKOUT_RISK";

    } else if (
        newStock <=
        Number(
            medicine.emergency_reserve || 0
        )
    ) {

        status =
            "CRITICAL";

    } else if (
        newStock <=
        Number(
            medicine.minimum_stock || 0
        )
    ) {

        status =
            "LOW";

    }


    /* =====================================================
       UPDATE INVENTORY
       ===================================================== */

    await connection.query(

        `
        UPDATE inventory_items

        SET

            current_stock = ?,

            unit_cost =
                COALESCE(
                    ?,
                    unit_cost
                ),

            expiry_date =
                COALESCE(
                    ?,
                    expiry_date
                ),

            status = ?,

            updated_at =
                CURRENT_TIMESTAMP

        WHERE
            id = ?
        `,

        [

            newStock,

            item.unit_cost ||
                null,

            item.expiry_date ||
                null,

            status,

            medicine.id

        ]

    );


    /* =====================================================
       INSERT BATCH
       ===================================================== */

    if (
        item.batch_number
    ) {

        await connection.query(

            `
            INSERT INTO inventory_batches
            (
                item_id,
                batch_number,
                quantity,
                expiry_date
            )

            VALUES
            (
                ?,
                ?,
                ?,
                ?
            )
            `,

            [

                medicine.id,

                item.batch_number,

                quantity,

                item.expiry_date ||
                    null

            ]

        );

    }


    /* =====================================================
       TRANSACTION
       ===================================================== */

    await connection.query(

        `
        INSERT INTO transactions
        (
            medicine_id,
            transaction_type,
            quantity,
            reference_number,
            transaction_date
        )

        VALUES
        (
            ?,
            'IN',
            ?,
            ?,
            CURDATE()
        )
        `,

        [

            medicine.id,

            quantity,

            invoiceNumber

        ]

    );


    return {

        medicine_id:
            medicine.id,

        medicine_name:
            medicine.name,

        stock_before:
            oldStock,

        stock_added:
            quantity,

        stock_after:
            newStock,

        status

    };

}


/* =========================================================
   CONFIRM COMPLETE INVOICE
   ========================================================= */

async function confirmInvoice(
    req,
    res
) {

    const connection =
        await pool.getConnection();


    try {

        const {

            invoice_number,

            supplier_id,

            supplier_name,

            invoice_date,

            file_name,

            items

        } = req.body;


        /* =================================================
           VALIDATION
           ================================================= */

        if (
            !invoice_number
        ) {

            return res.status(400).json({

                success:
                    false,

                error:
                    "invoice_number is required."

            });

        }


        if (
            !Array.isArray(items)
            ||
            items.length === 0
        ) {

            return res.status(400).json({

                success:
                    false,

                error:
                    "At least one invoice item is required."

            });

        }


        await connection.beginTransaction();


        /* =================================================
           SUPPLIER
           ================================================= */

        const supplier =
            await resolveSupplier(

                connection,

                supplier_id,

                supplier_name

            );


        /* =================================================
           CREATE ONE INVOICE HEADER
           ================================================= */

        const [
            invoiceResult
        ] = await connection.query(

            `
            INSERT INTO invoices
            (
                invoice_number,
                supplier_id,
                invoice_date,
                file_name
            )

            VALUES
            (
                ?,
                ?,
                ?,
                ?
            )
            `,

            [

                invoice_number,

                supplier
                    ? supplier.id
                    : null,

                invoice_date ||
                    null,

                file_name ||
                    null

            ]

        );


        const invoiceId =
            invoiceResult.insertId;


        /* =================================================
           PROCESS EVERY MEDICINE
           ================================================= */

        const processedItems = [];


        for (
            const item of items
        ) {

            /*
               Lock the inventory row before modifying it.
            */

            const medicine =
                await resolveMedicine(

                    connection,

                    item.medicine_id,

                    item.medicine_name

                );


            if (!medicine) {

                throw new Error(

                    `Medicine not found: ${item.medicine_name || item.medicine_id}`

                );

            }


            const [
                lockedRows
            ] = await connection.query(

                `
                SELECT *

                FROM inventory_items

                WHERE
                    id = ?

                FOR UPDATE
                `,

                [
                    medicine.id
                ]

            );


            if (
                !lockedRows.length
            ) {

                throw new Error(

                    `Medicine no longer exists: ${medicine.name}`

                );

            }


            const result =
                await processInvoiceItem(

                    connection,

                    invoiceId,

                    invoice_number,

                    {

                        ...item,

                        medicine_id:
                            medicine.id,

                        medicine_name:
                            medicine.name

                    }

                );


            processedItems.push(
                result
            );

        }


        await connection.commit();


        return res.status(201).json({

            success:
                true,

            message:
                "Invoice confirmed and all stock updated.",

            data: {

                invoice_id:
                    invoiceId,

                invoice_number:
                    invoice_number,

                supplier:
                    supplier,

                items:
                    processedItems,

                total_items:
                    processedItems.length,

                total_quantity:
                    processedItems.reduce(

                        (sum, item) =>
                            sum +
                            Number(
                                item.stock_added
                            ),

                        0

                    )

            }

        });

    } catch (error) {

        await connection.rollback();


        console.error(
            "CONFIRM INVOICE ERROR:",
            error
        );


        return res.status(500).json({

            success:
                false,

            error:
                "Invoice confirmation failed.",

            details:
                error.message

        });

    } finally {

        connection.release();

    }

}


/* =========================================================
   LEGACY SINGLE ITEM UPLOAD
   ========================================================= */

async function uploadInvoice(
    req,
    res
) {

    try {

        const {

            invoice_number,

            supplier_id,

            supplier_name,

            invoice_date,

            medicine_id,

            medicine_name,

            batch_number,

            quantity,

            expiry_date,

            unit_cost

        } = req.body;


        if (
            !invoice_number
        ) {

            return res.status(400).json({

                success:
                    false,

                error:
                    "invoice_number is required."

            });

        }


        if (
            !medicine_id &&
            !medicine_name
        ) {

            return res.status(400).json({

                success:
                    false,

                error:
                    "medicine_id or medicine_name is required."

            });

        }


        if (
            !quantity
            ||
            Number(quantity) <= 0
        ) {

            return res.status(400).json({

                success:
                    false,

                error:
                    "A valid quantity is required."

            });

        }


        /*
           Reuse the bulk confirmation engine
           for consistency.
        */

        const fakeRequest = {

            body: {

                invoice_number,

                supplier_id,

                supplier_name,

                invoice_date,

                file_name:
                    req.file
                        ? req.file.filename
                        : null,

                items: [

                    {

                        medicine_id,

                        medicine_name,

                        batch_number,

                        quantity:
                            Number(quantity),

                        expiry_date,

                        unit_cost

                    }

                ]

            }

        };


        let responseData = null;

        let responseStatus = 201;


        const fakeResponse = {

            status(code) {

                responseStatus =
                    code;

                return this;

            },

            json(data) {

                responseData =
                    data;

                return this;

            }

        };


        await confirmInvoice(
            fakeRequest,
            fakeResponse
        );


        return res
            .status(responseStatus)
            .json(responseData);


    } catch (error) {

        console.error(
            "UPLOAD INVOICE ERROR:",
            error
        );


        return res.status(500).json({

            success:
                false,

            error:
                "Invoice upload failed.",

            details:
                error.message

        });

    }

}


/* =========================================================
   GET INVOICES
   ========================================================= */

async function getInvoices(
    req,
    res
) {

    try {

        const [
            rows
        ] = await pool.query(

            `
            SELECT

                i.id,

                i.invoice_number,

                i.invoice_date,

                i.file_name,

                i.uploaded_at,

                s.name AS supplier_name

            FROM invoices i

            LEFT JOIN suppliers s
                ON s.id = i.supplier_id

            ORDER BY
                i.uploaded_at DESC

            LIMIT 100
            `

        );


        return res.json({

            success:
                true,

            data:
                rows

        });

    } catch (error) {

        console.error(
            "GET INVOICES ERROR:",
            error
        );


        return res.status(500).json({

            success:
                false,

            error:
                "Failed to fetch invoices.",

            details:
                error.message

        });

    }

}


/* =========================================================
   EXPORTS
   ========================================================= */

module.exports = {

    extractInvoice,

    confirmInvoice,

    uploadInvoice,

    getInvoices,

    parseInvoiceText,

    normalizeDate,

    cleanNumber,

    cleanMedicineName

};