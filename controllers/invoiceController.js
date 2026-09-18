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

    value = String(value).trim();

    /* DD/MM/YYYY or DD-MM-YYYY */

    let match = value.match(
        /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/
    );

    if (match) {

        const day = match[1].padStart(2, "0");
        const month = match[2].padStart(2, "0");
        const year = match[3];

        return `${year}-${month}-${day}`;
    }


    /* YYYY-MM-DD */

    match = value.match(
        /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    );

    if (match) {

        return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
    }


    /* MM/YYYY or MM-YYYY */

    match = value.match(
        /^(\d{1,2})[\/\-](\d{4})$/
    );

    if (match) {

        return `${match[2]}-${String(match[1]).padStart(2, "0")}-01`;
    }


    /* DD Mon YYYY / DD Month YYYY */

    match = value.match(
        /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)\s+(\d{4})$/i
    );

    if (match) {

        const months = {
            jan: 1,
            feb: 2,
            mar: 3,
            apr: 4,
            may: 5,
            jun: 6,
            jul: 7,
            aug: 8,
            sep: 9,
            sept: 9,
            oct: 10,
            nov: 11,
            dec: 12
        };

        const monthKey =
            match[2]
                .toLowerCase();

        let month =
            months[monthKey];

        if (!month) {

            month =
                months[
                    monthKey.substring(0, 4)
                ];
        }

        if (month) {

            return `${match[3]}-${String(month).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
        }
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
            .replace(/LKR/gi, "")
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

    let name =
        String(value)
            .replace(/\s+/g, " ")
            .replace(/[|]/g, "")
            .trim();


    /*
       Remove OCR table numbering.

       Example:
       1 Paracetamol 500mg Tablets
       becomes:
       Paracetamol 500mg Tablets
    */

    name =
        name.replace(
            /^#?\d+\s+/,
            ""
        );


    /*
       Remove common packaging descriptions.

       Example:
       Surgical Gloves (Box of 100)
       becomes:
       Surgical Gloves
    */

    name =
        name.replace(
            /\s*\([^)]*(?:box|pack|of|bottle|strip|carton|case)[^)]*\)\s*$/i,
            ""
        );


    return name.trim();
}


/* =========================================================
   INVALID TABLE / SUMMARY NAMES
   ========================================================= */

function isInvalidMedicineName(name) {

    if (!name) {
        return true;
    }

    return /^(total|subtotal|grand total|tax|vat|gst|discount|amount|invoice|invoice no|invoice date|purchase order|payment terms|due date|notes)$/i
        .test(name.trim());
}


/* =========================================================
   INVOICE TEXT PARSER
   ========================================================= */

function parseInvoiceText(text) {

    const lines =
        String(text || "")
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0);


    const fullText =
        lines.join("\n");


    /* =====================================================
       INVOICE NUMBER
       ===================================================== */

    let invoiceNumber = null;

    const invoiceMatch =
        fullText.match(
            /(?:invoice\s*(?:no|number|#)?|bill\s*(?:no|number|#)?)\s*[:\-]?\s*([A-Z0-9\/\-_]+)/i
        );

    if (invoiceMatch) {

        invoiceNumber =
            invoiceMatch[1].trim();
    }


    /* =====================================================
       SUPPLIER
       ===================================================== */

    let supplier = null;

    const knownSuppliers = [
        "Apollo Medical Supplies",
        "MediCore Distributors",
        "LifeLine Pharma",
        "HealthFirst Supplies",
        "PrimeCare Medical",
        "VitalMed Logistics",
        "MedAxis Healthcare",
        "EmergencyMed Services"
    ];


    /*
       First check known suppliers.
       This is more reliable than accidentally treating
       another invoice line as the supplier.
    */

    for (const supplierName of knownSuppliers) {

        if (
            fullText
                .toLowerCase()
                .includes(
                    supplierName.toLowerCase()
                )
        ) {

            supplier =
                supplierName;

            break;
        }
    }


    /*
       If no known supplier was found, try a generic
       Supplier / Vendor / Seller line.
    */

    if (!supplier) {

        const supplierMatch =
            fullText.match(
                /(?:supplier|vendor|seller|from)\s*[:\-]?\s*([^\n]+)/i
            );

        if (supplierMatch) {

            supplier =
                supplierMatch[1]
                    .trim();
        }
    }


    /* =====================================================
       INVOICE DATE
       ===================================================== */

    let invoiceDate = null;

    const dateMatch =
        fullText.match(
            /(?:invoice\s*date|bill\s*date|date)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)\s+\d{4})/i
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


    for (const line of lines) {

        const normalizedLine =
            line
                .replace(/[|]/g, " ")
                .replace(/\s+/g, " ")
                .trim();


        if (!normalizedLine) {
            continue;
        }


        /*
           Skip obvious headings.
        */

        if (
            /^(?:#|item|item description|description|category|unit|quantity|qty|unit price|price|amount|total|subtotal|vat|tax|notes)$/i
                .test(normalizedLine)
        ) {
            continue;
        }


        /* =================================================
           FORMAT 1

           Medicine | Batch | Qty | Expiry | Price

           Example:

           Paracetamol | BATCH-001 | 500 | 20/01/2028 | 2.50
           ================================================= */

        const pipeParts =
            line
                .split(/\||\t/)
                .map(part => part.trim())
                .filter(Boolean);


        if (pipeParts.length >= 5) {

            const possibleQuantity =
                cleanNumber(
                    pipeParts[2]
                );

            const possibleExpiry =
                normalizeDate(
                    pipeParts[3]
                );

            const possiblePrice =
                cleanNumber(
                    pipeParts[4]
                );


            if (
                possibleQuantity !== null &&
                possiblePrice !== null
            ) {

                const medicineName =
                    cleanMedicineName(
                        pipeParts[0]
                    );


                if (
                    medicineName &&
                    !isInvalidMedicineName(
                        medicineName
                    )
                ) {

                    items.push({

                        medicine_name:
                            medicineName,

                        batch_number:
                            pipeParts[1] ||
                            null,

                        quantity:
                            possibleQuantity,

                        expiry_date:
                            possibleExpiry,

                        unit_cost:
                            possiblePrice
                    });

                    continue;
                }
            }
        }


        /* =================================================
           FORMAT 2

           Medicine Batch Qty Expiry Price
           ================================================= */

        const detailedMatch =
            normalizedLine.match(

                /^(.+?)\s+(?:BATCH|LOT)?[-:#]?\s*([A-Z0-9\-\/]+)\s+(\d+(?:,\d+)*(?:\.\d+)?)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s+(?:₹|\$|LKR)?\s*(\d+(?:,\d+)*(?:\.\d+)?)$/i

            );


        if (detailedMatch) {

            const medicineName =
                cleanMedicineName(
                    detailedMatch[1]
                );


            if (
                medicineName &&
                !isInvalidMedicineName(
                    medicineName
                )
            ) {

                items.push({

                    medicine_name:
                        medicineName,

                    batch_number:
                        detailedMatch[2],

                    quantity:
                        cleanNumber(
                            detailedMatch[3]
                        ),

                    expiry_date:
                        normalizeDate(
                            detailedMatch[4]
                        ),

                    unit_cost:
                        cleanNumber(
                            detailedMatch[5]
                        )
                });

                continue;
            }
        }


        /* =================================================
           FORMAT 3

           NORMAL INVOICE TABLE

           Example:

           1 Paracetamol 500mg Tablets Medicine tablets 5,000 2.50 12,500.00
           ================================================= */

        const tableMatch =
            normalizedLine.match(

                /^(\d+\s+)?(.+?)\s+(Medicine|Antibiotic|Critical Medicine|Emergency Medicine|IV Fluid|Consumable|Laboratory|PPE|Emergency Supply|Surgical Supply)\s+([A-Za-z0-9%]+)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)$/i

            );


        if (tableMatch) {

            const medicineName =
                cleanMedicineName(
                    tableMatch[2]
                );

            const quantity =
                cleanNumber(
                    tableMatch[5]
                );

            const unitCost =
                cleanNumber(
                    tableMatch[6]
                );


            if (
                medicineName &&
                !isInvalidMedicineName(
                    medicineName
                ) &&
                quantity !== null &&
                unitCost !== null
            ) {

                items.push({

                    medicine_name:
                        medicineName,

                    batch_number:
                        null,

                    quantity:
                        quantity,

                    expiry_date:
                        null,

                    unit_cost:
                        unitCost
                });

                continue;
            }
        }


        /* =================================================
           FORMAT 4

           GENERIC TABLE

           Example:

           1 Paracetamol 500mg Tablets
           Medicine tablets
           5,000 2.50 12,500.00

           Or all fields in one OCR line.
           ================================================= */

        const genericTableMatch =
            normalizedLine.match(

                /^(?:\d+\s+)?(.+?)\s+\S+\s+\S+\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)$/

            );


        if (genericTableMatch) {

            const medicineName =
                cleanMedicineName(
                    genericTableMatch[1]
                );

            const quantity =
                cleanNumber(
                    genericTableMatch[2]
                );

            const unitCost =
                cleanNumber(
                    genericTableMatch[3]
                );


            if (
                medicineName &&
                !isInvalidMedicineName(
                    medicineName
                ) &&
                quantity !== null &&
                unitCost !== null
            ) {

                items.push({

                    medicine_name:
                        medicineName,

                    batch_number:
                        null,

                    quantity:
                        quantity,

                    expiry_date:
                        null,

                    unit_cost:
                        unitCost
                });
            }
        }
    }


    /* =====================================================
       REMOVE DUPLICATES
       ===================================================== */

    const uniqueItems = [];

    const seen =
        new Set();


    for (const item of items) {

        const key = [

            item.medicine_name
                ? item.medicine_name
                    .toLowerCase()
                : "",

            item.batch_number ||
                "",

            item.quantity,

            item.expiry_date ||
                ""

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

                success: false,

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

                success: false,

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

                                    `OCR Progress: ${Math.round(
                                        message.progress * 100
                                    )}%`

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


        console.log(
            "Raw OCR text length:",
            rawText.length
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
            "Invoice number:",
            extracted.invoice_number
        );


        console.log(
            "Supplier:",
            extracted.supplier
        );


        console.log(
            "Invoice date:",
            extracted.invoice_date
        );


        console.log(
            "======================================"
        );


        return res.json({

            success: true,

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

            success: false,

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
            WHERE id = ?
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
            WHERE name LIKE ?
            ORDER BY id ASC
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
            WHERE id = ?
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
           Exact match.
        */

        let [
            rows
        ] = await connection.query(

            `
            SELECT *
            FROM inventory_items
            WHERE LOWER(name) = LOWER(?)
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
            WHERE LOWER(name) LIKE LOWER(?)
            ORDER BY
                CASE
                    WHEN LOWER(name) = LOWER(?) THEN 0
                    WHEN LOWER(name) LIKE LOWER(?) THEN 1
                    ELSE 2
                END,
                id ASC
            LIMIT 1
            `,

            [
                `%${cleanName}%`,
                cleanName,
                `${cleanName}%`
            ]
        );


        if (
            rows.length
        ) {

            return rows[0];
        }


        /*
           Try the first meaningful words.

           Example:

           "Paracetamol 500mg Tablets"
           →
           "Paracetamol"

           "Surgical Gloves"
           →
           "Surgical Gloves"
        */

        const simplifiedName =
            cleanName
                .replace(
                    /\b\d+(?:mg|ml|mcg|g|kg|%)\b/gi,
                    ""
                )
                .replace(
                    /\b(tablets?|capsules?|vials?|ampoules?|bags?|pieces?|boxes?|packs?|sets?)\b/gi,
                    ""
                )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();


        if (
            simplifiedName &&
            simplifiedName !== cleanName
        ) {

            [
                rows
            ] = await connection.query(

                `
                SELECT *
                FROM inventory_items
                WHERE LOWER(name) LIKE LOWER(?)
                ORDER BY id ASC
                LIMIT 1
                `,

                [
                    `%${simplifiedName}%`
                ]
            );


            if (
                rows.length
            ) {

                return rows[0];
            }
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

            `Medicine not found: ${
                item.medicine_name ||
                item.medicine_id
            }`
        );
    }


    const quantity =
        Number(
            item.quantity
        );


    if (
        !Number.isFinite(quantity) ||
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
        newStock <= 0
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
            batch_id,
            transaction_type,
            quantity,
            reference_number,
            transaction_date
        )
        VALUES
        (
            ?,
            NULL,
            'IN',
            ?,
            ?,
            CURRENT_TIMESTAMP
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

                success: false,

                error:
                    "invoice_number is required."
            });
        }


        if (
            !Array.isArray(items) ||
            items.length === 0
        ) {

            return res.status(400).json({

                success: false,

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
               Resolve medicine first.
            */

            const medicine =
                await resolveMedicine(

                    connection,

                    item.medicine_id,

                    item.medicine_name
                );


            if (!medicine) {

                throw new Error(

                    `Medicine not found: ${
                        item.medicine_name ||
                        item.medicine_id
                    }`
                );
            }


            /*
               Lock inventory row.
            */

            const [
                lockedRows
            ] = await connection.query(

                `
                SELECT *
                FROM inventory_items
                WHERE id = ?
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

            success: true,

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

        try {
            await connection.rollback();
        } catch (_) {}


        console.error(
            "CONFIRM INVOICE ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

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

                success: false,

                error:
                    "invoice_number is required."
            });
        }


        if (
            !medicine_id &&
            !medicine_name
        ) {

            return res.status(400).json({

                success: false,

                error:
                    "medicine_id or medicine_name is required."
            });
        }


        if (
            !quantity ||
            Number(quantity) <= 0
        ) {

            return res.status(400).json({

                success: false,

                error:
                    "A valid quantity is required."
            });
        }


        /*
           Reuse complete invoice confirmation.
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
                            Number(
                                quantity
                            ),

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

            success: false,

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

            success: true,

            data:
                rows
        });

    } catch (error) {

        console.error(
            "GET INVOICES ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

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