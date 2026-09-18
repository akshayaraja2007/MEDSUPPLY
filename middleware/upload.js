const multer = require("multer");
const path = require("path");
const fs = require("fs");

/* =========================================================
   UPLOAD DIRECTORY
   ========================================================= */

const uploadDir = path.join(
    __dirname,
    "..",
    "uploads"
);

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, {
        recursive: true
    });
}


/* =========================================================
   STORAGE
   ========================================================= */

const storage = multer.diskStorage({

    destination: function (req, file, cb) {

        cb(
            null,
            uploadDir
        );

    },

    filename: function (req, file, cb) {

        const extension =
            path.extname(file.originalname);

        const baseName =
            path
                .basename(
                    file.originalname,
                    extension
                )
                .replace(
                    /[^a-zA-Z0-9-_]/g,
                    "_"
                );

        const filename =
            `${Date.now()}-${baseName}${extension}`;

        cb(
            null,
            filename
        );

    }

});


/* =========================================================
   FILE FILTER
   ========================================================= */

const fileFilter = function (
    req,
    file,
    cb
) {

    const allowedTypes = [

        "application/pdf",

        "image/jpeg",

        "image/png",

        "image/jpg"

    ];


    if (
        allowedTypes.includes(
            file.mimetype
        )
    ) {

        cb(
            null,
            true
        );

    } else {

        cb(
            new Error(
                "Only PDF, JPG, JPEG and PNG invoice files are allowed."
            ),
            false
        );

    }

};


/* =========================================================
   MULTER
   ========================================================= */

const upload = multer({

    storage,

    fileFilter,

    limits: {

        fileSize:
            10 * 1024 * 1024

    }

});


module.exports = upload;